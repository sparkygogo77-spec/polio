/**
 * One zoom control, and it acts on whichever surface is showing.
 *
 * The timeline kept a `React.useState(1)` of its own, so the minus and plus
 * in the header moved the store's number while the timeline scaled by its
 * own — the control looked broken because it was pointing at nothing. This
 * checks the thing a person sees: press the header's plus and the surface in
 * front of you gets bigger, on both surfaces, and the readout agrees with
 * what is actually on the screen.
 *
 *   node tests/one-zoom.mjs [url]
 */
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-studio-bar]", { timeout: 20000 });
await page.waitForTimeout(2500);

/**
 * What the bar says, and how big the surface actually is.
 *
 * `scale` is the element's own transform, which is the honest number for the
 * timeline's plot because that is where the scale is set. The board's is set
 * on an ancestor, so reading the frame's own transform gives 1 however far in
 * you zoom — the first version of this check did exactly that and reported
 * "scale 1 then 1" while the board was plainly getting bigger. `width` is
 * what it measures instead: the rendered size, which is what a person sees
 * and which no amount of scaling somewhere up the tree can hide.
 */
const read = (sel) => page.evaluate((s) => {
  const bar = document.querySelector("[data-studio-bar]");
  const hud = [...bar.querySelectorAll("button")].find((e) => /^\d+%$/.test((e.textContent || "").trim()));
  const el = document.querySelector(s);
  return {
    hud: hud ? Number((hud.textContent || "").replace("%", "")) : null,
    scale: el ? +new DOMMatrixReadOnly(getComputedStyle(el).transform).a.toFixed(4) : null,
    width: el ? Math.round(el.getBoundingClientRect().width) : null,
  };
}, sel);

const plus = async () => {
  await page.evaluate(() => document.querySelector("[aria-label='Zoom in']")?.click());
  await page.waitForTimeout(400);
};

/* ------------------------------------------------------------- the board */
const BOARD = "[data-frame]";
const b0 = await read(BOARD);
await plus();
const b1 = await read(BOARD);
check(
  "on the board, the header's plus makes the board bigger",
  b0.width !== null && b1.width !== null && b1.width > b0.width + 2,
  `the frame measured ${b0.width}px, then ${b1.width}px`,
);
check("and the readout climbs with it", b1.hud > b0.hud, `${b0.hud}% then ${b1.hud}%`);

/* ---------------------------------------------------------- the timeline */
/* In through the Finish key, which is how a person gets there. */
await page.evaluate(() => document.querySelector("[data-finish]")?.click());
await page.waitForTimeout(2500);
const inBook = await page.evaluate(() => !!document.querySelector("[data-timeline-plot]"));
check("the Finish key opens the timeline", inBook, inBook ? "the plot is there" : "no [data-timeline-plot]");

if (inBook) {
  const PLOT = "[data-timeline-plot]";
  const t0 = await read(PLOT);
  await plus();
  const t1 = await read(PLOT);
  check(
    "in the timeline, the same plus makes the timeline bigger",
    t0.scale !== null && t1.scale !== null && t1.scale > t0.scale,
    `scale ${t0.scale} then ${t1.scale}`,
  );
  check("and the readout climbs there too", t1.hud > t0.hud, `${t0.hud}% then ${t1.hud}%`);
  /* The readout and the surface are the same number, which is the whole
     complaint: they were two numbers and only one of them moved. */
  check(
    "the readout is the scale the timeline is actually drawn at",
    Math.abs(t1.hud / 100 - t1.scale) < 0.02,
    `${t1.hud}% against a scale of ${t1.scale}`,
  );
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
