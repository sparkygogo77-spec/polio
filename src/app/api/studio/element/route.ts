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

/** How tall a picture of the page, or of one element, may be. A first screen 3000px tall was cut at 2000. */
const MAX_SHOT_HEIGHT = 4000;

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
  // Several at once: a page taken whole is a dozen blocks, and a dozen
  // openings of the same page would be a dozen too many.
  // Up to 120: sixteen blocks may make a page and each may be a run of members, and a cap of 40 lost the readings past it.
  const selectors = Array.isArray(body.selectors) ? body.selectors.filter((s): s is string => typeof s === "string").slice(0, 120) : null;
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
    const answer = await page.goto(gate.url, { waitUntil: "domcontentloaded", timeout: READ_BUDGET_MS });
    /* A page that answers with an error is not a page to point at. A bot
       wall's 403 and a 404's own error page loaded "successfully" and were
       listed as things to point at. */
    const status = answer && typeof (answer as { status?: () => number }).status === "function" ? (answer as { status: () => number }).status() : 200;
    if (status >= 400) {
      await context.close();
      return NextResponse.json({ ok: false, reason: "status", message: `That page answered ${status}${status === 403 ? ", which is a wall against being read by a machine" : status === 404 ? ", so there is no page at that address" : ""}. Check the address, or try another page of the site.`, took: took() });
    }
    /* A moment for what loads late: a page that draws itself by script
       is given until its requests go quiet, up to four seconds, and never
       the whole budget. A fixed 900ms read a slow page as empty. */
    await Promise.race([
      (page as unknown as { waitForLoadState: (s: string, o?: Record<string, unknown>) => Promise<void> }).waitForLoadState("networkidle", { timeout: 4000 }).catch(() => undefined),
      page.waitForTimeout(4000),
    ]);
    await page.waitForTimeout(300);

    if (!selector && !selectors) {
      const list = (await page.evaluate(CANDIDATES, MAX_ELEMENTS)) as Candidate[];
      const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, innerHeight));
      /* The whole page, so that what is listed can be pointed at by eye:
         the first 900px were shown while the candidates came from all of
         it. Cut at 4000px tall, past which it is a document, not a page. */
      const shot = await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width, height: Math.min(height, MAX_SHOT_HEIGHT) } });
      await context.close();
      return NextResponse.json({
        ok: true,
        url: gate.url,
        host: gate.host,
        page: { width, height, shot: shot.toString("base64") },
        candidates: list,
        took: took(),
      });
    }

    if (selectors) {
      const readings = [];
      for (const sel of selectors) {
        const one = (await page.evaluate(MEASURE, sel)) as Record<string, unknown> | null;
        if (one) readings.push({ ...one, from: { url: gate.url, host: gate.host, selector: sel, at: Date.now() } });
      }
      const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0, innerHeight));
      await context.close();
      if (!readings.length) return NextResponse.json({ ok: false, reason: "gone", message: "None of those are on the page any more. Read the page again.", took: took() });
      return NextResponse.json({ ok: true, page: { width, height }, readings, took: took() });
    }

    const reading = (await page.evaluate(MEASURE, selector ?? "")) as { box: { x: number; y: number; w: number; h: number } } | null;
    if (!reading) {
      await context.close();
      return NextResponse.json({ ok: false, reason: "gone", message: "That element is not on the page any more. Read the page again.", took: took() });
    }
    /* The element alone, cut out of a picture of the page at the box that
       was just measured. One screenshot rather than two, and the crop is
       the measurement rather than a second opinion about where it is. */
    const b = reading.box;
    const shot = b.w > 0 && b.h > 0
      ? await page.screenshot({ fullPage: true, clip: { x: b.x, y: b.y, width: Math.min(b.w, MAX_SHOT_HEIGHT), height: Math.min(b.h, MAX_SHOT_HEIGHT) } }).catch(() => null)
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

