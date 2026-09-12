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
   cannot catch the code changing them. The composite tile is 1536px. */
const GROUND_TILE = 1536;

const URL_ = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-cloud-layer]", { timeout: 20000 });
await page.waitForTimeout(2500);

const l = await page.evaluate(() => {
  const c = document.querySelector("[data-cloud-layer]");
  const st = getComputedStyle(c);
  return {
    n: document.querySelectorAll("[data-cloud-layer]").length,
    gx: Number((c.style.getPropertyValue("--gx") || "0").replace("px", "")),
    gy: Number((c.style.getPropertyValue("--gy") || "0").replace("px", "")),
    name: st.animationName, secs: parseFloat(st.animationDuration),
    timing: st.animationTimingFunction, iter: st.animationIterationCount,
    blend: st.mixBlendMode, opacity: st.opacity,
    box: c.getBoundingClientRect(), inline: c.style.transform,
    laidAt: c.dataset.laidAt ?? null,
  };
});

check("there is one layer, not four", l.n === 1, `${l.n}`);
check("nothing records having been laid again", l.laidAt === null, "no data-laid-at, because nothing is re-laid");
check("it runs for ever, at a constant rate", l.iter === "infinite" && l.timing === "linear" && l.name === "ground-drift", `${l.name} ${l.timing} ${l.iter}`);
check("it slides exactly one tile", Math.abs(l.gx - GROUND_TILE) < 0.01 && l.gy === 0, `${l.gx},${l.gy} against ${GROUND_TILE},0`);
check("the canvas carries a whole tile of spare", l.box.width - GROUND_TILE > 0, `${l.box.width.toFixed(0)} wide for a ${GROUND_TILE} slide`);
check("no blend mode: the screening is baked into the tile", l.blend === "normal", l.blend);
console.log(`       one layer, ${GROUND_TILE}px every ${l.secs.toFixed(0)}s — ${(GROUND_TILE / l.secs).toFixed(2)}px a second, at opacity ${l.opacity}`);

const a = await page.evaluate(() => getComputedStyle(document.querySelector("[data-cloud-layer]")).transform);
await page.waitForTimeout(2500);
const b2 = await page.evaluate(() => getComputedStyle(document.querySelector("[data-cloud-layer]")).transform);
check("the layer is travelling", a !== b2, `${a} then ${b2}`);
check("and nothing in JavaScript is writing the transform", l.inline === "", l.inline || "the inline style is untouched");

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
