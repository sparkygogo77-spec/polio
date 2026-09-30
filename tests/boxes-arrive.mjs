/**
 * The boxes arrive when you open the timeline, one after another.
 *
 * HIS WORDS, the spec: "if you are in the design preview and havent seen
 * the timeline yet dont have the elements add until you open the timeline
 * where everything not seen yet is all loaded in sequentially but each box
 * starts maybe .2 seconds apart, not once the previous is finished."
 *
 * Three things in that sentence, and all three are measured here:
 *
 *   · nothing arrives while he is on the board — the timeline is not a
 *     thing that happened somewhere he was not looking;
 *   · opening it starts every box he has not watched arrive;
 *   · they start .2s apart and OVERLAP. The last clause is the whole point
 *     and the easiest to get wrong: a run where each waits for the one
 *     before it to finish would also be "sequential" and would take six
 *     times as long, so this measures the gap between two STARTS and the
 *     number of boxes forming at once, not merely the order.
 *
 * Measured off `data-forming`, which the box carries only while it is
 * arriving, so what is timed is what is drawn.
 *
 *   node tests/boxes-arrive.mjs [url]
 *
 * Runs alone: times how the boxes start (all inside a second and a half); under load the first to last took 2758ms.
 */
import { createRequire } from "node:module";
import { STAGGER_MS } from "../src/features/studio/timelineView.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const N = 6;
const thread = (i) => ({
  id: `t${i}`, parentId: i ? `t${i - 1}` : null, at: 1_700_000_000_000 + i * 1000,
  mode: i ? "critique" : "start", ask: `ask ${i}`, answer: `answer ${i}`, changes: [`changed ${i}`],
});
const THREADS = Array.from({ length: N }, (_, i) => thread(i));
const SPOTS = Object.fromEntries(THREADS.map((t, i) => [`box:${t.id}`, { x: 200 + (i % 3) * 330, y: 160 + Math.floor(i / 3) * 200 }]));
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [], groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], threads: THREADS, threadSpots: SPOTS,
}, version: 0 });

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

/* ------------------------------------------------------------------ */
/* 1. On the board, nothing of the timeline is arriving                 */
/* ------------------------------------------------------------------ */

const onBoard = await page.evaluate(() => ({
  boxes: document.querySelectorAll("[data-box]").length,
  timeline: document.querySelectorAll("[data-timeline]").length,
}));
check("the board is the board: no timeline, no boxes", onBoard.boxes === 0 && onBoard.timeline === 0, `${onBoard.boxes} boxes, ${onBoard.timeline} timelines`);

/* ------------------------------------------------------------------ */
/* 2. Open it, and watch them come                                      */
/* ------------------------------------------------------------------ */

const t0 = Date.now();
await page.locator("[data-finish]").first().click();

/*
 * Sampled as fast as the page will answer. Each box's first sighting is
 * when it started arriving; each box's last is when it stopped.
 */
const began = new Map();
const ended = new Map();
const together = [];
for (let i = 0; i < 260; i++) {
  const now = await page.evaluate(() => ({
    at: performance.now(),
    forming: [...document.querySelectorAll("[data-box][data-forming]")].map((e) => e.getAttribute("data-box")),
    all: document.querySelectorAll("[data-box]").length,
  }));
  const t = Date.now() - t0;
  for (const id of now.forming) {
    if (!began.has(id)) began.set(id, t);
    ended.set(id, t);
  }
  if (now.forming.length) together.push(now.forming.length);
  if (began.size >= N && !now.forming.length && i > 20) break;
}
await page.waitForTimeout(3200);

const starts = [...began.entries()].sort((a, b) => a[1] - b[1]);
check("every box arrived rather than simply being there", began.size === N, `${began.size} of ${N} arrived`);
console.log(`\n  box      started at\n${starts.map(([id, at]) => `    ${id.padEnd(6)} ${String(at).padStart(5)}ms`).join("\n")}\n`);

/* ------------------------------------------------------------------ */
/* 3. .2 seconds apart, and overlapping                                 */
/* ------------------------------------------------------------------ */

const gaps = starts.slice(1).map(([, at], i) => at - starts[i][1]);
const typical = gaps.length ? gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0;
/* A wide window: this is wall-clock in a container, sampled over a round
   trip to the page, so the number being held is "about a fifth of a
   second", not a frame count. What it rules out is the two answers that
   are actually wrong — all at once, and one after another. */
check(`they start about ${STAGGER_MS}ms apart`, typical >= STAGGER_MS * 0.4 && typical <= STAGGER_MS * 2.6,
  `gaps ${gaps.join(", ")}ms, middle one ${typical}ms`);
/* The count first: `[].every()` is true, so a run where nothing arrived at
   all would pass this for having no gaps too small. */
check("not all at once", gaps.length > 0 && gaps.every((g) => g > 20), `${gaps.length} gaps, smallest ${gaps.length ? Math.min(...gaps) : "—"}ms`);

/*
 * And the clause he wrote it for: overlapping. One box's formation takes a
 * couple of seconds, so starting .2s apart means several are arriving at
 * the same moment. If each waited for the last, this would never be above
 * one.
 */
const most = Math.max(0, ...together);
check("a box does not wait for the one before it to finish", most >= 3, `${most} arriving at once, at the busiest`);

const spread = starts.length ? starts[starts.length - 1][1] - starts[0][1] : 0;
check("so the whole run starts inside a second and a half", spread < 1500, `${spread}ms from the first start to the last`);

/* ------------------------------------------------------------------ */
/* 4. And it does not happen twice                                      */
/* ------------------------------------------------------------------ */

/* The same key both ways: Finish opens the timeline and closes it again. */
await page.locator("[data-finish]").first().click();
await page.waitForTimeout(1000);
check("and that key takes you back to the board", (await page.locator("[data-timeline]").count()) === 0);
await page.locator("[data-finish]").first().click();
const again = [];
for (let i = 0; i < 40; i++) {
  again.push(await page.evaluate(() => document.querySelectorAll("[data-box][data-forming]").length));
  await page.waitForTimeout(50);
}
check("going back and returning does not replay it", Math.max(...again) === 0, `${Math.max(...again)} arriving on the second look`);
check("and the boxes are all still there", (await page.locator("[data-box]").count()) === N, `${await page.locator("[data-box]").count()} boxes`);

await page.screenshot({ path: ".screenshots/boxes-arrive.png" });
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
console.log(".screenshots/boxes-arrive.png");
process.exit(bad ? 1 : 0);
