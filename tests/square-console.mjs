/**
 * A square menu is square all the way in.
 *
 * The console's controls used to be drawn as arcs whatever shape the wheel
 * was, so a square menu was a round one in a square frame: bent sliders with
 * the corners of every box left empty, and two colour spectrums sharing half
 * a quadrant each when the box had room for both at full width. These check
 * the parts of that which can be checked without eyes.
 *
 *   node tests/square-console.mjs [url]     # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });

/** Open a part's wheel in the given shape and walk into the colour editor. */
async function openSpectrum(shape) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto(`${URL}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const toggle = page.locator("[data-menu-shape]").first();
  if ((await toggle.getAttribute("data-menu-shape")) !== shape) {
    await toggle.click();
    await page.waitForTimeout(350);
  }
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(250);
  await page.keyboard.type("drop a new idea");
  await page.waitForTimeout(350);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(650);
  const nb = await page.locator("[data-node-id]").first().boundingBox();
  await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2, { button: "right" });
  await page.waitForTimeout(600);
  for (const word of [/^Looks$/, /^Hue$/]) {
    const el = page.locator("[data-radial]").getByText(word).first();
    if (await el.count()) { await el.click({ force: true }); await page.waitForTimeout(700); }
  }
  return page;
}

/** The outline drawn round a slider's run: the one path on it that is not filled. */
const outlineOf = (page, label) => page.locator(`[data-arc-slider="${label}"] path[fill="none"]`).first();

/** Drag a slider from wherever it is to a point along its own bounding box. */
async function dragTo(page, label, fx, fy) {
  const b = await page.locator(`[data-arc-slider="${label}"]`).first().boundingBox();
  return press(page, label, b.x + b.width * fx, b.y + b.height * fy);
}

/**
 * Drag to the middle of one of the slider's own steps.
 *
 * An arc's bounding box is mostly the empty corner it does not pass through,
 * so a fraction of it lands off the control and the press does nothing at
 * all — which reads as a pass if you only check that the value stayed put.
 * A step is a piece of the run, so its middle is on the run.
 */
async function dragToStep(page, label, i) {
  const step = page.locator(`[data-arc-slider="${label}"] path:not([fill="none"])`).nth(i);
  const b = await step.boundingBox();
  return press(page, label, b.x + b.width / 2, b.y + b.height / 2);
}

async function press(page, label, x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  return Number(await page.locator(`[data-arc-slider="${label}"]`).first().getAttribute("aria-valuenow"));
}

/* ------------------------------------------------------------------ */
/* Square                                                              */
/* ------------------------------------------------------------------ */
const sq = await openSpectrum("square");
const sqLabels = ["Hue", "Lightness", "Strength"];
check("square: the whole colour is on one slab", (await sq.locator("[data-arc-slider]").count()) >= 3);

// 1. Nothing on a square slab is bent. An SVG arc command is an arc.
const bent = [];
for (const l of sqLabels) {
  const d = (await outlineOf(sq, l).getAttribute("d")) ?? "";
  if (/[Aa]\s/.test(d)) bent.push(l);
}
check("square: no slider is drawn as an arc", bent.length === 0, bent.join(", "));

// 2. The three bands are stacked and each one runs the full width of the box.
const boxes = [];
for (const l of sqLabels) boxes.push(await sq.locator(`[data-arc-slider="${l}"]`).first().boundingBox());
const widths = boxes.map((b) => b.width);
const lefts = boxes.map((b) => b.x);
const sameWidth = Math.max(...widths) - Math.min(...widths) < 3;
const sameLeft = Math.max(...lefts) - Math.min(...lefts) < 3;
check("square: the three bands are the same width", sameWidth, widths.map((w) => Math.round(w)).join(" / "));
check("square: the three bands share a left edge", sameLeft, lefts.map((x) => Math.round(x)).join(" / "));
const tops = boxes.map((b) => b.y).sort((a, b) => a - b);
check("square: the three bands are stacked, not side by side", tops[2] - tops[0] > 30, tops.map(Math.round).join(" / "));

// 3. A band is wider than it is tall — it is a bar, not a block.
check("square: a band is a bar", boxes.every((b) => b.width > b.height * 2), boxes.map((b) => `${Math.round(b.width)}x${Math.round(b.height)}`).join(" "));

// 4. The hand sets the value from where it is along the bar.
const low = await dragTo(sq, "Hue", 0.2, 0.5);
const high = await dragTo(sq, "Hue", 0.8, 0.5);
check("square: dragging along the bar follows the hand", low < high - 25, `${low} then ${high}`);
check("square: the hand lands where it is pointing", Math.abs(low - 20) < 14 && Math.abs(high - 80) < 14, `${low} / ${high}`);

// 5. Chips sit in straight rows: at least one row holds several of them at one height.
const chips = await sq.locator("[data-arc-chip]").all();
const ys = [];
for (const c of chips) { const b = await c.boundingBox(); if (b) ys.push(Math.round(b.y + b.height / 2)); }
const rows = new Map();
for (const y of ys) {
  const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
  rows.set(key, (rows.get(key) ?? 0) + 1);
}
const widestRow = Math.max(0, ...rows.values());
check("square: chips line up in rows", widestRow >= 3, `${chips.length} chips, widest row ${widestRow}`);

// 6. And in columns: a row that ran out of chips sits under the one above it.
const cells = [];
for (const c of chips) { const b = await c.boundingBox(); if (b) cells.push({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }); }
const byRow = new Map();
for (const cell of cells) {
  const key = [...byRow.keys()].find((k) => Math.abs(k - cell.y) <= 2) ?? cell.y;
  byRow.set(key, [...(byRow.get(key) ?? []), cell.x]);
}
const pair = [...byRow.values()].sort((a, b) => b.length - a.length).slice(0, 2);
const shared = pair.length < 2 ? 0 : pair[1].filter((x) => pair[0].some((o) => Math.abs(o - x) <= 2)).length;
check("square: a short row sits under the one above it", pair.length < 2 || shared === Math.min(pair[0].length, pair[1].length),
  `${shared} of ${pair.length < 2 ? 0 : Math.min(pair[0].length, pair[1].length)} columns shared`);

// 7. A square wheel's chips have square corners.
const sqRound = await chips[0].evaluate((el) => {
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return { r, w: el.getBoundingClientRect().width };
});
check("square: chips are boxes, not circles", sqRound.r < sqRound.w / 3, `${sqRound.r}px on ${sqRound.w}px`);
await sq.close();

/* ------------------------------------------------------------------ */
/* Round                                                               */
/* ------------------------------------------------------------------ */
const rd = await openSpectrum("round");
const arced = [];
for (const l of sqLabels) {
  const d = (await outlineOf(rd, l).getAttribute("d")) ?? "";
  if (/[Aa]\s/.test(d)) arced.push(l);
}
check("round: the sliders are still arcs", arced.length === 3, arced.join(", "));
const rLow = await dragToStep(rd, "Hue", 3);
const rHigh = await dragToStep(rd, "Hue", 18);
check("round: dragging round the arc still follows the hand", rLow < rHigh - 25, `${rLow} then ${rHigh}`);
check("round: the hand lands on the step it pressed", Math.abs(rLow - 16) < 12 && Math.abs(rHigh - 84) < 12, `${rLow} / ${rHigh}`);

// A round wheel's chips are circles.
const rChip = rd.locator("[data-arc-chip]").first();
const shapeOf = await rChip.evaluate((el) => {
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return { r, w: el.getBoundingClientRect().width };
});
check("round: chips are circles", shapeOf.r >= shapeOf.w / 2 - 0.5, `${shapeOf.r}px on ${shapeOf.w}px`);
await rd.close();

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
