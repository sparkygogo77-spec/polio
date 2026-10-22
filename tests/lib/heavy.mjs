/**
 * A HEAVY BOARD IN A SLOW BROWSER, for the checks that hold the Builder light.
 *
 * The sol face board (tests/fixtures/boards/solface.json.gz: 800 parts, 13,500
 * elements drawn, pictures left out) opened in a 1280×800 window. `slow(n)`
 * throttles the CPU n× the way the Claude app's browser pane feels on an
 * ordinary laptop; `trace(fn)` runs fn under a Chromium trace and answers its
 * main-thread events.
 *
 *   const h = await heavyBoard(URL_BASE);
 *   const ev = await h.trace(async () => { ...gesture... });
 *   await h.close();
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./board.mjs";

export async function heavyBoard(base, { board = "solface", width = 1280, height = 800 } = {}) {
  const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  const doc = await openBoard(page, base, board);
  /* Settled: the first open of a board heals its words for a few seconds. */
  await page.waitForTimeout(4000);
  const slow = (rate) => cdp.send("Emulation.setCPUThrottlingRate", { rate });
  const trace = async (fn, categories = "devtools.timeline,disabled-by-default-devtools.timeline") => {
    const events = [];
    const onData = (e) => events.push(...e.value);
    cdp.on("Tracing.dataCollected", onData);
    const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
    await cdp.send("Tracing.start", { categories, transferMode: "ReportEvents" });
    const out = await fn();
    await cdp.send("Tracing.end");
    await done;
    cdp.off("Tracing.dataCollected", onData);
    const mains = new Set(events.filter((e) => e.name === "thread_name" && e.args?.name === "CrRendererMain").map((e) => `${e.pid}:${e.tid}`));
    return { out, events: events.filter((e) => mains.has(`${e.pid}:${e.tid}`)) };
  };
  /** A part drawn on screen that is its own at its middle: what a hand would grab. */
  const grabbable = () => page.evaluate(() => {
    for (const el of document.querySelectorAll("[data-node-id]")) {
      const r = el.getBoundingClientRect();
      if (r.width > 40 && r.height > 30 && r.width < 700 && r.top > 120 && r.bottom < 760 && r.left > 320 && r.right < 1200) {
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (document.elementFromPoint(x, y)?.closest("[data-node-id]") === el) return { id: el.getAttribute("data-node-id"), x, y };
      }
    }
    return null;
  });
  return { browser, page, cdp, doc, errors, slow, trace, grabbable, close: () => browser.close() };
}

/** Milliseconds in events of these names. */
export const msIn = (events, names) => Math.round(events.filter((e) => e.ph === "X" && names.includes(e.name)).reduce((a, e) => a + (e.dur ?? 0), 0) / 1000);
