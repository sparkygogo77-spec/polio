import { NextResponse } from "next/server";
import { findPlaywright, NO_PLAYWRIGHT, type PWPage } from "../headless";
import { readZipInfo } from "@/features/studio/zipFile";
import { checkZip, contentType, fileFor, hadScripts, MAX_ZIP_BYTES, sansScripts, ZIP_BUDGET_MS, ZIP_REFUSAL_SAYS } from "@/features/studio/bring-in";
import { MAX_ELEMENTS } from "@/features/studio/siteFetch";
import { CANDIDATES, FACES, MEASURE, PARTS, type Candidate, type PageRead } from "@/features/studio/bring-in";
import { carryFaces, type FacesRead } from "@/features/studio/look";
import { sourceOfPage, withLines } from "@/features/studio/sourceHooks";
import { BUSY_NOW, ISOLATE, readStillsAsk, type StillTaken } from "@/features/studio/stills";

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
 *     uploads of the same zip would be a dozen too many; or
 *   · `parts`: the page read element by element (`PARTS`), and every other
 *     page in the zip beside it, each its own reading, in one go
 *     (`pageParts.ts` makes them pages of parts); with `only`, that page
 *     alone, and the names of the others (`siblings`) for the Builder to
 *     ask for one request at a time, `dir` naming the site's folder;
 *     with `widths=0`, without its tablet and phone readings, which
 *     `boxes` (the desktop parts' kind, selector and type size) asks for
 *     in a request of their own.
 *
 * The zip is sent each time rather than kept on the server: the route
 * holds nothing between calls, like every other route here. Every failure
 * is HTTP 200 with a reason and the seconds it took.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const HOME = "https://zip.invalid";
/** How many parts one page is read into. A page past it says so. */
const MAX_PARTS = 1500;

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
  const checked = checkZip(files, bytes.length);
  if (!checked.ok) return no(checked.why, checked.says);
  /* The page a builder.json names is the page, when the zip has it; else the one the zip would open. */
  const askedEntry = typeof form.get("entry") === "string" ? String(form.get("entry")) : "";
  const byParts = form.get("parts") === "1";
  /*
   * ONE PAGE A REQUEST (`only`). Reading every page of a site in one request
   * put the whole site inside one deadline: PonsStars' redesign branch, six
   * pages of 1,800 parts, took 27 seconds here and longer on the host, and
   * the browser gave up at 45 ("Nothing came back within 45 seconds") on a
   * branch that was fine to read. With `only`, this reads the entry alone
   * and names the site's other pages (`siblings`), and the Builder asks for
   * each in a request of its own (`FromASite.tsx#landParts`), so a site of
   * any size is read a page at a time, each inside its own deadline.
   */
  const onlyEntry = byParts && form.get("only") === "1";
  /*
   * AND ONE WIDTH A REQUEST. The same branch's front page, read alone,
   * still took a minute on the host: the reading at the desktop, then
   * again at 834 and at 390 for its tablet and phone, three readings of
   * 750 parts in one request. `widths=0` leaves the tablet and phone out
   * of the parts reading; `boxes` (the desktop parts' kind, selector and
   * type size, as the Builder got them) asks for those two readings on
   * their own, boxes only, in a request of their own.
   */
  const withWidths = form.get("widths") !== "0";
  const boxesAsk = (() => {
    try { const v = JSON.parse(String(form.get("boxes") ?? "null")) as unknown; return Array.isArray(v) && byParts ? v.filter((x): x is [string, string, number | undefined] => Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "string").slice(0, 4000) : null; } catch { return null; }
  })();
  /* The site's folder, when the Builder names it: a sibling page read on its own is served from the site's folder, as it was when every page was read behind the entry. */
  const siteDir = typeof form.get("dir") === "string" && files.some((f) => f.name.startsWith(String(form.get("dir")))) ? String(form.get("dir")) : null;
  const gate0 = askedEntry && askedEntry !== checked.entry && /\.html?$/i.test(askedEntry) && files.some((f) => f.name === askedEntry)
    ? { ...checked, entry: askedEntry, dir: askedEntry.includes("/") ? askedEntry.slice(0, askedEntry.lastIndexOf("/") + 1) : "" }
    : checked;
  const gate = siteDir !== null && byParts ? { ...gate0, dir: siteDir } : gate0;

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
  const width = Math.max(360, Math.min(2560, Number(form.get("width")) || 1280));
  /* The preview page a builder.json names, and how a screen is asked for: its screens are read instead of its parts. */
  /* The pages whose pictures its scripts draw, asked for after the import (`FromASite.tsx#readPicturesOf`). */
  const picturesAsk = (() => {
    try { const v = JSON.parse(String(form.get("pictures") ?? "null")) as unknown; return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 12) : null; } catch { return null; }
  })();
  const screensAsk = (() => {
    try {
      const v = JSON.parse(String(form.get("screens") ?? "null")) as { page?: unknown; list?: unknown } | null;
      if (!v) return null;
      const page = typeof v.page === "string" && files.some((f) => f.name === v.page) ? v.page : null;
      const list = Array.isArray(v.list) ? v.list.filter((x): x is { name: string; src: string } => !!x && typeof (x as { name?: unknown }).name === "string" && typeof (x as { src?: unknown }).src === "string").slice(0, 40) : [];
      return page || list.length ? { page, list } : null;
    } catch { return null; }
  })();
  /* The design-tokens file a builder.json names: read for its variables whether or not a page links it. */
  const tokensFile = typeof form.get("tokens") === "string" ? String(form.get("tokens")) || null : null;

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

  /* `still`: pictures of what a part's code draws, taken on the preview page with its scripts (`stills.ts`). */
  const stillsAsked = readStillsAsk(form.get("still"));
  if (form.get("still") !== null && !stillsAsked) return no("bad-still", "That is not a still this can take: it wants a page and the hooks to take.");
  if (stillsAsked && !names.has(stillsAsked.page)) return no("no-page", `${stillsAsked.page} is not in the zip.`);

  let browser: Awaited<ReturnType<typeof found.pw.chromium.launch>> | null = null;
  try {
    browser = await found.pw.chromium.launch(await found.launchOptions());
    if (stillsAsked) {
      /*
       * THE PREVIEW PAGE, WITH ITS SCRIPTS, THIS ONCE. Every request is
       * answered out of the zip or refused, as for every page here, and a
       * socket or an event stream cannot even be opened: the page draws
       * from its own sample data or not at all.
       */
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      await context.addInitScript(() => {
        const refuse = function () { throw new Error("A still is taken with no network."); };
        Object.defineProperty(window, "WebSocket", { value: refuse });
        Object.defineProperty(window, "EventSource", { value: refuse });
      }, null);
      const page = await context.newPage();
      await serveZip(page, names, "", unpacked);
      const stills: StillTaken[] = [];
      const missed: string[] = [];
      for (const shot of stillsAsked.shots) {
        try {
          await page.goto(`${HOME}/${stillsAsked.page}${shot.query}`, { waitUntil: "load", timeout: ZIP_BUDGET_MS });
          /* A page that says it is still building is waited for (capture/site/capture/ready.mjs), then given a moment to draw. */
          for (let i = 0; i < 80 && (await page.evaluate(BUSY_NOW).catch(() => 0)) > 0; i++) await page.waitForTimeout(250);
          await page.waitForTimeout(600);
          const size = (await page.evaluate(ISOLATE, shot.hook)) as { x: number; y: number; w: number; h: number; unshown: string[] } | null;
          if (!size) { missed.push(shot.hook); continue; }
          await page.waitForTimeout(100);
          const shotBytes = await page.screenshot({ type: "jpeg", quality: 85, animations: "disabled", clip: { x: size.x, y: size.y, width: size.w, height: size.h } });
          stills.push({ hook: shot.hook, query: shot.query, src: `data:image/jpeg;base64,${Buffer.from(shotBytes).toString("base64")}`, w: size.w, h: size.h, unshown: size.unshown });
        } catch {
          missed.push(shot.hook);
        }
      }
      await context.close();
      return NextResponse.json({ ok: true, page: stillsAsked.page, stills, missed, took: took() });
    }
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    /* The repository's preview screens, read as its own code builds them (`boardStates.ts`): its scripts run here, and only here, with nothing reachable but the zip's own files. */
    /*
     * THE PICTURES ITS SCRIPTS DRAW. The page is read without its scripts
     * (below), so an <img> its code fills (PonsStars' avatars, written as
     * data: SVG at load) came in as a stand-in. Each asked page is opened
     * here with its scripts, and every hooked <img> it shows is handed back
     * as what it draws: its data: address, or read through a canvas.
     */
    if (picturesAsk) {
      await serveZip(page, names, "", (n) => unpacked(n));
      const out: Record<string, Record<string, string>> = {};
      for (const file of picturesAsk) {
        if (!names.has(file)) continue;
        try {
          await page.goto(`${HOME}/${file}`, { waitUntil: "load", timeout: ZIP_BUDGET_MS });
          await page.waitForTimeout(1500);
          out[file] = (await (page as unknown as { evaluate: (fn: string) => Promise<unknown> }).evaluate(`(${DRAWN_PICTURES})()`)) as Record<string, string>;
        } catch { /* a page that will not open keeps its stand-ins */ }
      }
      await context.close();
      return NextResponse.json({ ok: true, name, pictures: out, took: took() });
    }
    if (screensAsk) {
      await serveZip(page, names, "", (n) => unpacked(n));
      const got = await readScreens(page, screensAsk, width);
      await context.close();
      return NextResponse.json({ ok: true, name, screens: got, took: took() });
    }
    /* Every page is opened as its HTML says without its scripts: the entry, and in the reading by parts each other page too. */
    const htmlOf = new Map<string, string>([[gate.entry, entryHtml]]);
    await serveZip(page, names, gate.dir, (n) => {
      if (n === gate.entry) return new TextEncoder().encode(sansScripts(entryHtml));
      if (byParts && /\.html?$/i.test(n)) {
        const text = htmlOf.get(n) ?? (() => { try { return new TextDecoder().decode(unpacked(n)); } catch { return ""; } })();
        htmlOf.set(n, text);
        return new TextEncoder().encode(sansScripts(text));
      }
      return unpacked(n);
    });
    await page.goto(`${HOME}/${gate.entry}`, { waitUntil: "load", timeout: ZIP_BUDGET_MS });
    await page.waitForTimeout(300);
    const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, innerHeight));

    if (byParts) {
      /*
       * THE PAGE, ELEMENT BY ELEMENT, AND ITS SIBLINGS. The entry first, then
       * each other page of the site in the zip (beside it or under it, never
       * above it), up to `MOST_PAGES`, each opened as its HTML says and read
       * the same way. Each reading names its file and whether it brought
       * scripts, which were not run.
       */
      const MOST_PAGES = 12;
      /* The pages a builder.json lists, in its order; else every page beside or under the entry. */
      const listed = (() => { try { const l = JSON.parse(String(form.get("pages") ?? "null")) as unknown; return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string" && names.has(x) && x !== gate.entry) : null; } catch { return null; } })();
      const others = listed ?? [...names]
        .filter((n) => n !== gate.entry && /\.html?$/i.test(n) && n.startsWith(gate.dir) && !/(^|\/)(node_modules|vendor|test|tests)\//i.test(n))
        .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
      const read: { file: string; scripts: boolean; read: PageRead; source: ReturnType<typeof sourceOfPage> }[] = [];
      /*
       * THE PAGE'S OWN PICTURES IN ITS CSS, CARRIED. A background or a mask
       * at one of the zip's addresses (PST's icons, web/assets/tv/*.svg,
       * painted through a mask) would be a broken link on the board: each is
       * put in as data: from the zip, up to 300 KB each. One the zip does not
       * hold takes the paint it is in off the part, as before.
       */
      const dataOf = new Map<string, string | null>();
      const inline = (css: string | undefined): string | undefined => {
        if (!css) return css;
        let lost = false;
        const out = css.replace(/url\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g, (all, url: string) => {
          if (/^data:/i.test(url)) return all;
          if (!url.startsWith(`${HOME}/`)) { lost = true; return all; }
          if (!dataOf.has(url)) {
            const hit = fileFor(decodeURIComponent(url.slice(HOME.length + 1).split(/[?#]/)[0] ?? ""), names, gate.dir);
            const bytes = hit ? unpacked(hit) : null;
            const type = hit && bytes?.length ? contentType(hit, bytes) : null;
            dataOf.set(url, bytes && type && bytes.length <= 300_000 ? `data:${type.split(";")[0]};base64,${Buffer.from(bytes).toString("base64")}` : null);
          }
          const d = dataOf.get(url);
          if (!d) { lost = true; return all; }
          return `url("${d}")`;
        });
        return lost ? undefined : out;
      };
      const ownPictures = (r: PageRead): PageRead => {
        for (const p of r.parts) {
          const s = p.style;
          if (s.image) { s.image = inline(s.image); if (!s.image) { delete s.imageOptions; delete s.imageClip; } }
          if (s.mask) { s.mask = inline(s.mask); if (!s.mask) delete s.maskOptions; }
        }
        return r;
      };
      /* What the page's own code is written against, read off its source: every hook with its line, and the CSS variables it exposes (`sourceHooks.ts`). */
      const textOf = (n: string) => { try { return new TextDecoder().decode(unpacked(n)); } catch { return ""; } };
      const sourced = (file: string, html: string, r: PageRead) => {
        const source = sourceOfPage(file, html, (href) => { const hit = fileFor(href, names, gate.dir); return hit ? { file: hit, text: textOf(hit) } : null; }, { tokens: tokensFile });
        return { read: withLines(r, source, html, (href) => { const hit = fileFor(href, names, gate.dir); return hit ? { file: hit, text: textOf(hit) } : null; }), source };
      };
      /*
       * THE SITE'S OWN TABLET AND PHONE (docs/RESPONSIVE.md). The page read
       * again with the window at 834 and at 390, each part's box there written
       * onto the part it is at the desktop: the same element (its path), the
       * same turn among parts of that path. A part with no box at a width is
       * one the site does not draw there. So the Builder's Tablet and Phone,
       * and the published page under them, lay the page out as the site does,
       * not as a guess.
       */
      const atWidths = async (r: PageRead): Promise<PageRead> => {
        const out: NonNullable<PageRead["widths"]> = {};
        for (const [device, w] of [["tablet", 834], ["phone", 390]] as const) {
          if (w >= width) continue;
          try {
            await page.setViewportSize({ width: w, height: 900 });
            await page.waitForTimeout(150);
            /* Boxes and type sizes are all that is kept of these readings, so the page's rules and states are not read for each part. */
            const small = (await page.evaluate(PARTS, { cap: MAX_PARTS, lean: true })) as PageRead;
            const seen = new Map<string, number>();
            const key = (p: PageRead["parts"][number]) => { const k = `${p.kind}|${p.selector}`; const i = seen.get(k) ?? 0; seen.set(k, i + 1); return `${k}#${i}`; };
            const boxes = new Map<string, PageRead["parts"][number]>();
            for (const p of small.parts) boxes.set(key(p), p);
            seen.clear();
            /* Its type size there too, where the site's own rules change it (PST's "Tuning in" box: 11px on a phone, 16px wide). */
            out[device] = r.parts.map((p) => { const q = boxes.get(key(p)); return q && !q.hidden && q.box.w > 0 && q.box.h > 0 ? { ...q.box, ...(q.style.px !== p.style.px ? { px: q.style.px } : {}) } : null; });
          } catch {
            /* A width that will not read is left to the Builder's own plan. */
          }
        }
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(100);
        return Object.keys(out).length ? { ...r, widths: out } : r;
      };
      if (boxesAsk) {
        /* The tablet and phone boxes of a page read already: aligned to the desktop parts the Builder holds, by kind and selector, as `atWidths` aligns them. */
        const stand = { parts: boxesAsk.map(([kind, selector, px]) => ({ kind, selector, style: { px } })) } as unknown as PageRead;
        const got = await atWidths(stand);
        await context.close();
        return NextResponse.json({ ok: true, name, entry: gate.entry, widths: got.widths ?? {}, took: took() });
      }
      const desk = async (r: PageRead) => (withWidths ? atWidths(r) : r);
      read.push({ file: gate.entry, scripts, ...sourced(gate.entry, entryHtml, ownPictures(await desk((await page.evaluate(PARTS, MAX_PARTS)) as PageRead))) });
      if (onlyEntry) {
        await context.close();
        return NextResponse.json({ ok: true, name, entry: gate.entry, scripts, pages: read, siblings: others.slice(0, MOST_PAGES - 1), left: Math.max(0, others.length - (MOST_PAGES - 1)), failed: 0, took: took() });
      }
      for (const file of others.slice(0, MOST_PAGES - 1)) {
        try {
          await page.goto(`${HOME}/${file}`, { waitUntil: "load", timeout: ZIP_BUDGET_MS });
          await page.waitForTimeout(150);
          const html = htmlOf.get(file) ?? textOf(file);
          read.push({ file, scripts: hadScripts(html), ...sourced(file, html, ownPictures(await desk((await page.evaluate(PARTS, MAX_PARTS)) as PageRead))) });
        } catch {
          /* A page that will not open is left out, and the count says so. */
        }
      }
      await context.close();
      return NextResponse.json({ ok: true, name, entry: gate.entry, scripts, pages: read, left: Math.max(0, others.length - (MOST_PAGES - 1)), failed: Math.min(others.length, MOST_PAGES - 1) - (read.length - 1), took: took() });
    }

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

/** In the page: every hook drawn, once each (not one inside a template, nor one with no box). */
const DRAWN_HOOKS = `() => {
  const out = new Set();
  for (const el of Array.from(document.querySelectorAll("[data-hook]"))) {
    if (el.closest("template")) continue;
    if (!el.getClientRects().length) continue;
    if (getComputedStyle(el).visibility === "hidden") continue;
    /* Inside a <details> the page keeps shut (a "?" box): not drawn, though the browser still gives it a box. */
    const shut = el.parentElement && el.parentElement.closest("details:not([open])");
    if (shut && !el.closest("summary")) continue;
    out.add(el.getAttribute("data-hook"));
  }
  return [...out].sort();
}`;

/** In the page: each hooked <img> it shows, as what it draws (a data: address, at most 256px across). */
const DRAWN_PICTURES = `() => {
  const out = {};
  for (const im of Array.from(document.querySelectorAll("img[data-hook]"))) {
    const v = im.getAttribute("data-hook");
    if (!v || out[v] || !im.complete || !im.naturalWidth) continue;
    const src = im.currentSrc || im.src || "";
    if (src.startsWith("data:")) { if (src.length < 400000) out[v] = src; continue; }
    try {
      const k = Math.min(1, 256 / Math.max(im.naturalWidth, im.naturalHeight));
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
      cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
      out[v] = cv.toDataURL("image/webp", 0.85);
    } catch (e) { /* another origin's picture */ }
  }
  return out;
}`;

/** In the page: where each drawn hook is, in page pixels (its first box), so the board can draw a screen where the code drew it (`boardStates.ts#screenPlaces`). */
const DRAWN_BOXES = `() => {
  const out = {};
  for (const el of Array.from(document.querySelectorAll("[data-hook]"))) {
    if (el.closest("template") || !el.getClientRects().length || getComputedStyle(el).visibility === "hidden") continue;
    const shut = el.parentElement && el.parentElement.closest("details:not([open])");
    if (shut && !el.closest("summary")) continue;
    const v = el.getAttribute("data-hook");
    if (!v || out[v]) continue;
    const r = el.getBoundingClientRect();
    out[v] = [Math.round(r.x + scrollX), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)];
  }
  return out;
}`;

/** In the preview page, once built: each screen's name, its label and the page it is a state of. */
const SCREEN_LIST = `() => {
  const out = [];
  for (const el of Array.from(document.querySelectorAll("[data-preview-screen]"))) {
    const name = (el.getAttribute("data-preview-screen") || "").trim();
    if (!name || out.some((s) => s.name === name)) continue;
    const label = (el.querySelector("[data-preview-label]")?.textContent || "").trim();
    const a = el.querySelector('[data-hook="preview-screen-full"], a[href]');
    /* The screen as the preview copied it in (PonsStars': the real page, its hooks kept): what it draws, not counting the preview's own. */
    const body = el.querySelector("[data-preview-body]");
    const shows = new Set();
    /* Where each sits, from the copy's own corner: the board lines these up with the page's parts (\`boardStates.ts#screenPlaces\`). */
    const boxes = {};
    /* What each says in this screen (its words where it has its own, or holds no other element): the board shows a step with them ("You lost.", FINAL), and two screens drawing the same parts but saying other things are two states (\`boardStates.ts#screensOfPart\`). */
    const texts = {};
    const sizes = {};
    const at = body ? body.getBoundingClientRect() : null;
    /* The <details> open in this screen, by hook: what is inside a shut one (a "?" box's words) is not drawn, though the browser still gives it a box. */
    const opened = body ? Array.from(body.querySelectorAll("details[open][data-hook]")).map((d) => d.getAttribute("data-hook")) : [];
    if (body) for (const h of Array.from(body.querySelectorAll("[data-hook]"))) {
      if (h.closest("template") || !h.getClientRects().length || getComputedStyle(h).visibility === "hidden") continue;
      const shut = h.parentElement && h.parentElement.closest("details:not([open])");
      if (shut && !h.closest("summary")) continue;
      const v = h.getAttribute("data-hook");
      if (!v || v.startsWith("preview-")) continue;
      shows.add(v);
      if (!boxes[v]) { const r = h.getBoundingClientRect(); boxes[v] = [Math.round(r.x - at.x), Math.round(r.y - at.y), Math.round(r.width), Math.round(r.height)]; }
      const own = Array.from(h.childNodes).some((n) => n.nodeType === 3 && (n.textContent || "").trim());
      if ((own || !h.children.length) && !(v in texts)) texts[v] = (h.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 200);
      /* And the size its words are set at there: a part the page left empty as it opens (the trade buttons' reason, the countdown) came in with none. */
      if ((own || !h.children.length) && !(v in sizes)) sizes[v] = Math.round(parseFloat(getComputedStyle(h).fontSize) || 0);
    }
    /* The step of the site's flow it shows, when the site says (\`data-preview-step\`): a part is stepped through these, in this order. */
    const step = (el.getAttribute("data-preview-step") || "").trim();
    /* And what each hooked <img> draws here, where its code drew it (\`FromASite.tsx#readScreensOf\`): small data: addresses as they are. */
    const pictures = {};
    if (body) for (const im of Array.from(body.querySelectorAll("img[data-hook]"))) {
      const v = im.getAttribute("data-hook"); const src = im.currentSrc || im.src || "";
      if (v && !pictures[v] && im.complete && im.naturalWidth && src.startsWith("data:") && src.length < 1500000) {
        pictures[v] = src;
        /* A drawing the page copied in as a picture (its chart's canvas) is also what the part round it shows in this screen. */
        const up = im.parentElement && im.parentElement.closest("[data-hook]");
        const u = up && up.getAttribute("data-hook");
        const a = im.getBoundingClientRect(), b = up ? up.getBoundingClientRect() : null;
        if (u && !pictures[u] && b && a.width * a.height >= 0.8 * b.width * b.height) pictures[u] = src;
      }
    }
    out.push({ name, label, href: a ? a.href : "", shows: [...shows].sort(), boxes, pictures, texts, sizes, opened, ...(step ? { step } : {}) });
  }
  return out;
}`;

/** The page still says it is building (`data-preview="loading"`, `aria-busy`), as the capturer reads it (`capture/site/capture/ready.mjs`). */
const BUSY = `() => [document.documentElement, document.body].some((el) => el && Array.from(el.attributes).some((a) => (a.name.startsWith("data-") && ["loading", "building", "pending", "busy", "starting", "working"].includes(a.value.trim().toLowerCase())) || (a.name === "aria-busy" && a.value === "true")))`;

/**
 * Every screen the preview page lists, and the hooks each shows. The
 * preview page is opened still and waited for until it says it is built;
 * each screen's page is then opened at its own address, with `still=1`, and
 * read once what it draws has stopped changing.
 */
type Boxes = Record<string, [number, number, number, number]>;
type Pictures = Record<string, string>;
type Read = { name: string; label: string; page: string; shows: string[]; boxes?: Boxes; pictures?: Pictures; texts?: Record<string, string>; sizes?: Record<string, number>; step?: string; opened?: string[] };
async function readScreens(page: PWPage, ask: { page: string | null; list: { name: string; src: string }[] }, width: number): Promise<Read[]> {
  type Evaluating = { evaluate: (fn: string) => Promise<unknown>; goto: (url: string, o: { waitUntil: "load"; timeout: number }) => Promise<unknown>; waitForTimeout: (ms: number) => Promise<void> };
  const p = page as unknown as Evaluating;
  const settle = async (most: number) => {
    const t0 = Date.now();
    while (Date.now() - t0 < most && (await p.evaluate(`(${BUSY})()`).catch(() => false))) await p.waitForTimeout(200);
    /* Then until what it draws stops changing: a page building itself from replayed messages has no mark to wait for. */
    let last = "";
    for (let i = 0; i < 20; i++) {
      const now = JSON.stringify(await p.evaluate(`(${DRAWN_HOOKS})()`).catch(() => []));
      if (now === last) break;
      last = now;
      await p.waitForTimeout(250);
    }
  };
  /* The manifest's own list when it gives each screen's page (the kit's); else the screens the built preview page shows (PonsStars'). */
  let listed: (Omit<Read, "page" | "shows"> & { href: string; shows?: string[] })[] = ask.list.map((x) => ({ name: x.name, label: "", href: `${HOME}/${x.src}` }));
  if (!listed.length && ask.page) {
    /* At the board's width (J, 2026-10-05: at 1920 the TV keeps its size; read at 1440 it narrowed): the preview builds each screen in a window that wide. */
    await p.goto(`${HOME}/${ask.page}?still=1&width=${width}`, { waitUntil: "load", timeout: ZIP_BUDGET_MS });
    await settle(90000);
    listed = (await p.evaluate(`(${SCREEN_LIST})()`)) as typeof listed;
  }
  const out: Read[] = [];
  for (const s of listed.slice(0, 40)) {
    let u: URL | null = null;
    try { u = new URL(s.href); } catch { /* no address of its own */ }
    const file = u && u.origin === HOME ? decodeURIComponent(u.pathname.slice(1)) : "";
    /* Its address is the preview page again (PonsStars' links open the screen alone there): what the preview copied in is the screen, and its page is the one whose hooks it carries (`boardStates.ts`). */
    if (!file || file === ask.page || !u) {
      if (s.shows?.length) out.push({ name: s.name, label: s.label, page: "", shows: s.shows, ...(s.boxes ? { boxes: s.boxes } : {}), ...(s.pictures ? { pictures: s.pictures } : {}), ...(s.texts ? { texts: s.texts } : {}), ...(s.sizes ? { sizes: s.sizes } : {}), ...(s.opened ? { opened: s.opened } : {}), ...(s.step ? { step: s.step } : {}) });
      continue;
    }
    if (!u.searchParams.has("still")) u.searchParams.set("still", "1");
    try {
      await p.goto(u.toString(), { waitUntil: "load", timeout: ZIP_BUDGET_MS });
      await settle(20000);
      out.push({ name: s.name, label: s.label, page: file, shows: (await p.evaluate(`(${DRAWN_HOOKS})()`)) as string[], boxes: (await p.evaluate(`(${DRAWN_BOXES})()`).catch(() => ({}))) as Boxes, pictures: (await p.evaluate(`(${DRAWN_PICTURES})()`).catch(() => ({}))) as Pictures, opened: (await p.evaluate(`() => Array.from(document.querySelectorAll("details[open][data-hook]")).map((d) => d.getAttribute("data-hook"))`).catch(() => [])) as string[] });
    } catch {
      /* A screen whose page will not open is left out. */
    }
  }
  return out;
}
