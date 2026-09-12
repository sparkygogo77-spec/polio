/**
 * The ground cannot have a seam, because nothing is ever re-laid.
 *
 * This file used to be a long watch. A layer was painted with the drift so far
 * baked in, carried the rest of the way by a transform, and re-laid whenever
 * it ran out of material or turned too far — and that exchange had to be
 * exact or the ground jumped. It was not exact for a while, and finding out
 * why took most of a night: `transform: translate3d(d) rotate(t)` is `T·R`,
 * so the rotation turned the offset baked into the paint as well.
 *
 * None of that exists now. A layer is painted **once**, oversized by exactly
 * one tile period along its heading, and slid by exactly that period by a CSS
 * animation that loops. A repeating pattern lands back on itself after one
 * period, so the loop point is the same pixels in the same place. There is no
 * recycle, no exhaustion, no baked offset and nothing to compensate for, so
 * the seam is not fixed — it is unrepresentable.
 *
 * What is left to check is that the mechanism really is that, and that the
 * numbers line up: the animation's distance must be exactly one period, or
 * the loop shows.
 *
 *   node tests/ground-seam.mjs [url]
 */
import { createRequire } from "node:module";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

/* Copied, not imported: a test that reads the same constants as the code
   cannot catch the code changing them. TILE is 256. */
const LAYERS = {
  "far-violet": { scale: 2.8, turn: 0 },
  "far-magenta": { scale: 2.3, turn: 70 },
  "near-violet": { scale: 0.95, turn: 30 },
  "near-magenta": { scale: 0.75, turn: 150 },
};

const URL_ = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-cloud-layer]", { timeout: 20000 });
await page.waitForTimeout(2500);

const seen = await page.evaluate(() => [...document.querySelectorAll("[data-cloud-layer]")].map((c) => {
  const st = getComputedStyle(c);
  return {
    id: c.dataset.cloudLayer,
    gx: Number((c.style.getPropertyValue("--gx") || "0").replace("px", "")),
    gy: Number((c.style.getPropertyValue("--gy") || "0").replace("px", "")),
    name: st.animationName,
    secs: parseFloat(st.animationDuration),
    timing: st.animationTimingFunction,
    iter: st.animationIterationCount,
    w: c.width, h: c.height, box: c.getBoundingClientRect(),
    laidAt: c.dataset.laidAt ?? null,
  };
}));

check("all four layers are there", seen.length === 4, `${seen.length}`);
check("nothing records having been laid again", seen.every((l) => l.laidAt === null), "no data-laid-at, because nothing is re-laid");
check("they share one keyframe", new Set(seen.map((l) => l.name)).size === 1 && seen[0].name === "ground-drift", seen.map((l) => l.name).join(","));
check("it runs for ever, at a constant rate", seen.every((l) => l.iter === "infinite" && l.timing === "linear"));

for (const l of seen) {
  const def = LAYERS[l.id];
  const period = 256 * def.scale;
  const want = { x: Math.cos((def.turn * Math.PI) / 180) * period, y: Math.sin((def.turn * Math.PI) / 180) * period };
  const off = Math.hypot(l.gx - want.x, l.gy - want.y);
  check(`${l.id}: it slides exactly one tile period`, off < 0.02, `${l.gx},${l.gy} against ${want.x.toFixed(2)},${want.y.toFixed(2)}`);
  // And the canvas is oversized by that much, or the box would run off it.
  const spare = { x: l.box.width - Math.abs(l.gx), y: l.box.height - Math.abs(l.gy) };
  check(`${l.id}: the canvas carries a period of spare`, spare.x > 0 && spare.y > 0,
    `${l.box.width.toFixed(0)}×${l.box.height.toFixed(0)} for a ${Math.abs(l.gx).toFixed(0)},${Math.abs(l.gy).toFixed(0)} slide`);
  console.log(`       ${l.id.padEnd(13)} ${Math.round(period)}px every ${l.secs.toFixed(0)}s — ${(period / l.secs).toFixed(2)}px a second`);
}

/* And it is genuinely moving, on the compositor rather than in the DOM. */
const a = await page.evaluate(() => getComputedStyle(document.querySelector("[data-cloud-layer]")).transform);
const inlineA = await page.evaluate(() => document.querySelector("[data-cloud-layer]").style.transform);
await page.waitForTimeout(2500);
const b = await page.evaluate(() => getComputedStyle(document.querySelector("[data-cloud-layer]")).transform);
check("the layer is travelling", a !== b, `${a} then ${b}`);
check("and nothing in JavaScript is writing the transform", inlineA === "", inlineA || "the inline style is untouched");

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
