/**
 * One place to finish a thing, and contents you travel rather than scroll.
 *
 * HIS WORDS on the panel: "I want one tab that lets me complete step 1 2 and
 * 3 from one place like either the panel or the below without too much
 * information I dont want to see." And the three lines he approved, his own:
 *
 *   say what this thing should be, and show me the drawing if i drew one
 *   pick what makes it, and tell me what it costs before i press anything
 *   press make, and when it comes back put it on the page
 *
 * HIS WORDS on the undercard: "just make it so the contents are always full
 * size and show fully and scrolling down i can go down and see them without a
 * scroll bar bothering the side of the screen, away from the timeline, and
 * scrolling back up the timeline comes back into full view as it is
 * currently."
 *
 * So the panel holds those three and nothing else — no second copy of the
 * route choice, no bill line, no book — and the strip below stops being a
 * fixed-height box with a scroller in it: it is as tall as what it holds, and
 * the one wheel that already runs from the board into the categories runs
 * from the timeline into the contents instead.
 *
 *   node tests/finish-panel.mjs [url]
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(!!ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const T0 = 1700000000000;
/** A board with a few updates on it, one of them long enough to have to travel. */
const LONG = Array.from({ length: 40 }, (_, i) => `line ${i + 1} of what came back, long enough that a small box would have to be scrolled to read it all`).join("\n");
const doc = {
  state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    activePageId: "page_home", nodes: [], shapes: [], groups: [], spaces: [], selection: [],
    threads: [
      { id: "t0", at: T0 + 1000, mode: "make", ask: "lay out the home page", answer: "done", changes: [], state: "done", form: { p: 1, gen: 0 } },
      /* With a real bill on it: "no bill line in the panel" has to be a
         statement about the panel, not about there being nothing to bill. */
      { id: "t1", at: T0 + 2000, mode: "make", ask: "the one he opens", answer: LONG, changes: [], state: "done", form: { p: 1, gen: 0 },
        usage: { sent: 1200, skipped: 0, cached: 0, input: 1200, output: 400, cost: 0.12, claude: 0.08, renderer: 0.04, ms: 4200, calls: 2 } },
    ],
  },
  version: 0,
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: [], allow: null }, vercel: { hook: false } };
await page.route("**/api/studio/**", (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(what === "publish" ? STATUS : {}) });
});
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify(d)), doc);
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1400);

/* Into the timeline, and open the long one. */
await page.locator('[aria-label^="Finish"]').first().click({ force: true });
await page.waitForTimeout(2200);
const box = page.locator('[data-box="t1"]').first();
check("the timeline is open with the updates on it", (await page.locator("[data-box]").count()) === 2, `${await page.locator("[data-box]").count()} boxes`);
await box.click({ force: true });
await page.waitForTimeout(1200);

/* ------------------------------------------------------------------ */
/* 1. THE PANEL HOLDS HIS THREE LINES AND NOTHING ELSE                 */
/* ------------------------------------------------------------------ */

const blocks = await page.evaluate(() => [...document.querySelectorAll("[data-timeline-panel] [data-panel-block]")].map((e) => e.getAttribute("data-panel-block")));
check("the panel holds three things", blocks.length === 3, `${blocks.length}: ${blocks.join(", ") || "none"}`);
check("and they are his three", blocks.join(",") === "say,make,take", `${blocks.join(", ")}`);

const strays = await page.evaluate(() => {
  const p = document.querySelector("[data-timeline-panel]");
  if (!p) return null;
  return {
    /* The bill by what it SAYS rather than by a marker that does not exist
       yet: a marker nothing carries answers zero and passes. */
    bill: [...p.querySelectorAll("*")].filter((e) => e.children.length === 0 && /\$\d|\bms\b|\bcached\b/i.test(e.textContent ?? "")).length,
    /* Either way the route choice is drawn: the panel for a part that exists,
       the readout for an update that made nothing. */
    routes: document.querySelectorAll("[data-audit-panel], [data-audit-readout]").length,
  };
});
check("no bill line in it", strays?.bill === 0, `${strays?.bill} lines of price and timing`);
check("and one route choice on screen, not two", strays?.routes === 1, `${strays?.routes} of them`);

const price = await page.evaluate(() => document.querySelector("[data-panel-price]")?.textContent?.trim() ?? "");
/* Either a real figure, or the honest answer that nothing is spent yet —
   both tell him what it costs before he presses, which is what he asked for.
   A blank does not. */
check("what it costs is said before he presses anything",
  /\$\d|nothing is spent|free|no charge/i.test(price), price || "nothing said");
check("and there is one button to make it", (await page.locator("[data-panel-make]").count()) === 1);

/* ------------------------------------------------------------------ */
/* 2. NO SCROLLBAR IN THE STRIP                                        */
/* ------------------------------------------------------------------ */

const bars = await page.evaluate(() => {
  const strip = document.querySelector("[data-timeline-detail]");
  if (!strip) return null;
  const out = [];
  for (const el of [strip, ...strip.querySelectorAll("*")]) {
    const cs = getComputedStyle(el);
    const scrolls = /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight - el.clientHeight > 2;
    if (scrolls) out.push(`${el.tagName.toLowerCase()}${el.getAttribute("data-timeline-detail") !== null ? "[strip]" : ""} ${el.scrollHeight - el.clientHeight}px over`);
  }
  return { out, clipped: strip.scrollHeight - strip.clientHeight };
});
check("nothing inside the strip has a scrollbar", bars && bars.out.length === 0,
  bars ? (bars.out.join("; ") || "none of it scrolls inside itself") : "no strip");
check("and the contents are shown whole rather than clipped", bars && bars.clipped <= 2, `${bars?.clipped}px hidden`);

/* ------------------------------------------------------------------ */
/* 3. SCROLLING DOWN TRAVELS, SCROLLING BACK UP BRINGS IT BACK         */
/* ------------------------------------------------------------------ */

/* The pane is the one thing that scrolls — the column outside it holds the
   ground still and never moves, so reading ITS scrollTop answered 0 at every
   stage and called a working travel a failure. */
const view = () => page.evaluate(() => {
  const sc = document.querySelector("[data-studio-pane]");
  const tl = document.querySelector("[data-timeline]")?.getBoundingClientRect();
  return { top: Math.round(sc?.scrollTop ?? -1), timelineH: Math.round(tl?.height ?? 0), timelineTop: Math.round(tl?.top ?? 0) };
});
const atRest = await view();
check("the timeline is whole to begin with", atRest.timelineH > 200, `${atRest.timelineH}px tall`);

await page.mouse.move(750, 700);
for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 240); await page.waitForTimeout(60); }
await page.waitForTimeout(500);
const down = await view();
check("scrolling down travels the contents", down.top > atRest.top, `${atRest.top} → ${down.top}`);

for (let i = 0; i < 16; i++) { await page.mouse.wheel(0, -240); await page.waitForTimeout(60); }
await page.waitForTimeout(600);
const back = await view();
check("and scrolling back up brings the timeline into full view", back.top <= atRest.top + 2 && back.timelineH >= atRest.timelineH - 2,
  `back to ${back.top}, timeline ${back.timelineH}px`);

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
