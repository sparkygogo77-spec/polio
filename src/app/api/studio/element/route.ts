import { NextResponse } from "next/server";
import { findPlaywright, NO_PLAYWRIGHT } from "../headless";
import { allowed, MAX_ELEMENTS, READ_BUDGET_MS } from "@/features/studio/siteFetch";
import { CANDIDATES, MEASURE, type Candidate } from "@/features/studio/siteRead";

/**
 * Reading one element off a live page, exactly.
 *
 * This is the measuring half of the recreate step, and it asks no model
 * anything. It opens the address in the browser this server already finds
 * (`findPlaywright`), and then either:
 *
 *   · **lists** what is worth pointing at — the bands and boxes a person
 *     would name, each with its box and a line saying what it is — with a
 *     picture of the page to point at them on; or
 *   · **reads** the one a person picked, in full: its box, every run of
 *     words with the size it was set at, its links, its buttons, its
 *     pictures, what it is painted with, how it is set, how its children
 *     run, and a picture of the element alone.
 *
 * The measurements are the browser's own. Nothing here describes anything
 * in words for a model to read back: a colour is the string
 * `getComputedStyle` reported, a size is the number it reported, and the
 * one place judgement enters is which library part the reading becomes,
 * which happens on the client in `recreate.ts` off these numbers.
 *
 * **Bounds** are `siteFetch.ts` and are checked before anything opens:
 * https only, no private addresses, one page, one element, a budget at
 * both ends. Every failure is HTTP 200 with a reason and the seconds it
 * took, like every other route here, and the browser keeps a longer
 * deadline of its own for the case where nothing arrives at all.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const found = await findPlaywright();
  return NextResponse.json({ ok: !!found.pw, ...(found.pw ? { from: found.from } : { reason: "no-browser", message: NO_PLAYWRIGHT }) });
}

export async function POST(request: Request) {
  const began = Date.now();
  const took = () => Math.round((Date.now() - began) / 100) / 10;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }

  const gate = allowed(String(body.url ?? ""));
  if (!gate.ok) return NextResponse.json({ ok: false, reason: gate.why, message: gate.says, took: took() });

  const found = await findPlaywright();
  if (!found.pw) return NextResponse.json({ ok: false, reason: "no-browser", message: NO_PLAYWRIGHT, took: took() });

  const selector = typeof body.selector === "string" ? body.selector : null;
  const width = Math.max(360, Math.min(1920, Number(body.width) || 1280));

  let browser: Awaited<ReturnType<typeof found.pw.chromium.launch>> | null = null;
  try {
    browser = await found.pw.chromium.launch(await found.launchOptions());
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    /*
     * The budget, at this end. The route answers itself before the platform
     * kills it, so a page that never settles comes back as a sentence
     * rather than as nothing at all. Every wait below carries its own
     * timeout rather than leaning on a default, because the page type this
     * server drives is a hand-written surface with only what its routes
     * use on it, and widening it is somebody else's file.
     */
    await page.goto(gate.url, { waitUntil: "domcontentloaded", timeout: READ_BUDGET_MS });
    // A moment for what loads late, never the whole budget.
    await page.waitForTimeout(900);

    if (!selector) {
      const shot = await page.screenshot({ fullPage: false });
      const list = (await page.evaluate(CANDIDATES, MAX_ELEMENTS)) as Candidate[];
      await context.close();
      return NextResponse.json({
        ok: true,
        url: gate.url,
        host: gate.host,
        page: { width, height: 900, shot: shot.toString("base64") },
        candidates: list,
        took: took(),
      });
    }

    const reading = (await page.evaluate(MEASURE, selector)) as { box: { x: number; y: number; w: number; h: number } } | null;
    if (!reading) {
      await context.close();
      return NextResponse.json({ ok: false, reason: "gone", message: "That element is not on the page any more. Read the page again.", took: took() });
    }
    /* The element alone, cut out of a picture of the page at the box that
       was just measured. One screenshot rather than two, and the crop is
       the measurement rather than a second opinion about where it is. */
    const b = reading.box;
    const shot = b.w > 0 && b.h > 0
      ? await page.screenshot({ fullPage: true, clip: { x: b.x, y: b.y, width: Math.min(b.w, 2000), height: Math.min(b.h, 2000) } }).catch(() => null)
      : null;
    await context.close();
    return NextResponse.json({
      ok: true,
      reading: { ...reading, from: { url: gate.url, host: gate.host, selector, at: Date.now() } },
      shot: shot ? shot.toString("base64") : null,
      took: took(),
    });
  } catch (err) {
    const said = (err instanceof Error ? err.message.split("\n")[0] : String(err)) ?? "";
    const timedOut = /timeout|timed out/i.test(said);
    return NextResponse.json({
      ok: false,
      reason: timedOut ? "slow" : "failed",
      message: timedOut
        ? `That page did not finish loading within ${Math.round(READ_BUDGET_MS / 1000)} seconds.`
        : `The page could not be opened: ${said}`,
      took: took(),
    });
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

