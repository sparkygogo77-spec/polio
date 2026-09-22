import { NextResponse } from "next/server";
import { findPlaywright, NO_PLAYWRIGHT, type PWPage } from "../headless";
import { readZipInfo } from "@/features/studio/zipFile";
import { checkZip, contentType, fileFor, hadScripts, MAX_ZIP_BYTES, sansScripts, ZIP_BUDGET_MS, ZIP_REFUSAL_SAYS } from "@/features/studio/zipImport";
import { MAX_ELEMENTS } from "@/features/studio/siteFetch";
import { CANDIDATES, FACES, MEASURE, type Candidate } from "@/features/studio/siteRead";
import { carryFaces, type FacesRead } from "@/features/studio/fonts";

/**
 * Reading the page inside a zip, exactly.
 *
 * The same measuring as `api/studio/element`, on a page that arrived as a
 * file rather than an address. The zip is unpacked in memory, its page is
 * opened in the browser this server already finds, and **every request the
 * page makes is answered out of the zip or refused**: nothing it asks for
 * reaches the network, which is what makes a zip the right first proof of
 * measuring first. Scripts are taken out before the page is opened
 * (`sansScripts`), so what is measured is what the HTML and the CSS say.
 *
 * Two shapes of call, both multipart with the zip in `zip`:
 *
 *   · no `selectors`: what is worth pointing at, with a picture of the
 *     page, exactly as the element route lists a live one; or
 *   · `selectors`, a JSON list: those elements measured in full, in one
 *     go, because a page taken whole is a dozen blocks and a dozen
 *     uploads of the same zip would be a dozen too many.
 *
 * The zip is sent each time rather than kept on the server: the route
 * holds nothing between calls, like every other route here. Every failure
 * is HTTP 200 with a reason and the seconds it took.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const HOME = "https://zip.invalid";

export async function POST(request: Request) {
  const began = Date.now();
  const took = () => Math.round((Date.now() - began) / 100) / 10;
  const no = (reason: string, message: string) => NextResponse.json({ ok: false, reason, message, took: took() });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a form with a zip in it." }, { status: 400 });
  }
  const file = form.get("zip");
  if (!(file instanceof File)) return no("not-a-zip", ZIP_REFUSAL_SAYS["not-a-zip"]);
  if (file.size > MAX_ZIP_BYTES) return no("too-big", ZIP_REFUSAL_SAYS["too-big"]);
  const name = (file.name || "page.zip").replace(/[^\w.\- ]+/g, "").slice(0, 80) || "page.zip";

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { files, why } = readZipInfo(bytes);
  if (!files) return no(why ?? "not-a-zip", ZIP_REFUSAL_SAYS[why ?? "not-a-zip"]);
  const gate = checkZip(files, bytes.length);
  if (!gate.ok) return no(gate.why, gate.says);

  const selectors = (() => {
    const raw = form.get("selectors");
    if (typeof raw !== "string") return null;
    try {
      const list = JSON.parse(raw) as unknown;
      return Array.isArray(list) ? list.filter((s): s is string => typeof s === "string").slice(0, 40) : null;
    } catch {
      return null;
    }
  })();
  const width = Math.max(360, Math.min(1920, Number(form.get("width")) || 1280));

  const found = await findPlaywright();
  if (!found.pw) return no("no-browser", NO_PLAYWRIGHT);

  const byName = new Map(files.map((f) => [f.name, f]));
  const names = new Set(byName.keys());
  let entryHtml: string;
  try {
    entryHtml = new TextDecoder().decode(byName.get(gate.entry)!.bytes());
  } catch (e) {
    // A page that will not unpack (past what it declared, or a method the gate could not see) is a refusal, not a 500.
    return no("unread-method", e instanceof Error ? e.message : ZIP_REFUSAL_SAYS["unread-method"]);
  }
  const scripts = hadScripts(entryHtml);
  // An asset that will not unpack is answered as missing, the way a file not in the zip is.
  const unpacked = (n: string): Uint8Array => { try { return byName.get(n)!.bytes(); } catch { return new Uint8Array(0); } };

  let browser: Awaited<ReturnType<typeof found.pw.chromium.launch>> | null = null;
  try {
    browser = await found.pw.chromium.launch(await found.launchOptions());
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await serveZip(page, names, gate.dir, (n) => (n === gate.entry ? new TextEncoder().encode(sansScripts(entryHtml)) : unpacked(n)));
    await page.goto(`${HOME}/${gate.entry}`, { waitUntil: "load", timeout: ZIP_BUDGET_MS });
    await page.waitForTimeout(300);
    const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, innerHeight));

    if (!selectors) {
      const shot = await page.screenshot({ fullPage: false });
      const list = (await page.evaluate(CANDIDATES, MAX_ELEMENTS)) as Candidate[];
      await context.close();
      return NextResponse.json({
        ok: true,
        name,
        entry: gate.entry,
        files: files.length,
        scripts,
        unread: gate.unread,
        page: { width, height, shot: shot.toString("base64") },
        candidates: list,
        took: took(),
      });
    }

    const readings = [];
    for (const selector of selectors) {
      const reading = (await page.evaluate(MEASURE, selector)) as Record<string, unknown> | null;
      if (reading) readings.push({ ...reading, from: { url: `zip:${name}/${gate.entry}`, host: name, selector, at: Date.now() } });
    }
    /* The faces the readings are set in, carried out of the zip: a face's
       address under the served home is a file in the zip, or is not. */
    const read = (await page.evaluate(FACES).catch(() => ({ faces: [], links: [] }))) as FacesRead;
    const used = readings.map((r) => (r as { type?: { face?: string | null } }).type?.face ?? "").filter(Boolean);
    const faces = await carryFaces(read, used, `zip:${name}/${gate.entry}`, async (url) => {
      if (!url.startsWith(`${HOME}/`)) return { error: "the zip cannot reach beyond itself" };
      const hit = fileFor(decodeURIComponent(url.slice(HOME.length + 1).split(/[?#]/)[0] ?? ""), names, gate.dir);
      const bytes = hit ? unpacked(hit) : null;
      return bytes && bytes.length ? { bytes } : { error: "that file is not in the zip" };
    });
    await context.close();
    if (!readings.length) return no("gone", "None of those are on the page any more. Read the zip again.");
    return NextResponse.json({ ok: true, name, entry: gate.entry, scripts, page: { width, height }, readings, faces, took: took() });
  } catch (err) {
    const said = (err instanceof Error ? err.message.split("\n")[0] : String(err)) ?? "";
    const timedOut = /timeout|timed out/i.test(said);
    return no(timedOut ? "slow" : "failed", timedOut ? `The page in the zip did not finish drawing within ${Math.round(ZIP_BUDGET_MS / 1000)} seconds.` : `The page in the zip could not be opened: ${said}`);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

/**
 * Every request the page makes, answered from the zip or refused.
 *
 * The route surface this server's page type declares carries `continue`
 * and `abort`, which is what every other route here needs; answering a
 * request with bytes is `fulfill`, which Playwright's route has always
 * had and only this route uses. It is reached through a narrower view of
 * the same object rather than by widening a type five routes share.
 */
async function serveZip(page: PWPage, names: ReadonlySet<string>, dir: string, bytesOf: (name: string) => Uint8Array): Promise<void> {
  type Answering = { request: () => { url: () => string }; abort: () => Promise<void>; fulfill: (o: { status: number; contentType?: string; body: Buffer }) => Promise<void> };
  await page.route("**/*", (route) => {
    const r = route as unknown as Answering;
    const url = r.request().url();
    if (!url.startsWith(`${HOME}/`)) { void r.abort(); return; }
    const path = url.slice(HOME.length + 1);
    const hit = fileFor(path, names, dir);
    // A file with no extension is served as what its bytes say.
    const body = hit ? bytesOf(hit) : null;
    const type = hit && body ? contentType(hit, body) : null;
    if (!hit || !body || !type) { void r.abort(); return; }
    void r.fulfill({ status: 200, contentType: type, body: Buffer.from(body) });
  });
}
