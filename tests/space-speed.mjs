/**
 * What the black holes cost, measured.
 *
 * J says the lighting on the holes makes the site stutter, panning
 * especially, and trunk has the timeline dropping frames while idle with
 * euler hunting that from the card side. So this puts a number on the
 * holes alone, the same way for both sides: a board with no space on it,
 * then the same board with five open holes drawn at the sizes and shapes
 * J draws them, idle and then panned, and the frame times of each.
 *
 * Two numbers per run. The share of frames that missed the budget (over
 * 16.7ms), which is the number trunk quotes, and p95, which is what a
 * hand feels. Both are taken on this container's software rasteriser, so
 * the absolute figures are worse than any machine with a graphics card;
 * the difference between the two boards is what is being measured.
 *
 *   node tests/space-speed.mjs [url]
 */
import { createRequire } from "node:module";
import { roundBoundary } from "../src/features/studio/space.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* Five holes the way J draws them: wildly different sizes and shapes, all
   on the one page. A wobble on each so they are drawn lines. */
const loop = (cx, cy, rx, ry) => roundBoundary(cx, cy, rx, 48).map(([x, y], i) => [x + Math.sin(i * 1.7) * rx * 0.05, cy + (y - cy) * (ry / rx) + Math.cos(i * 2.3) * ry * 0.05]);
const box = (x, y, w, h) => [[x, y], [x + w * 0.5, y - 3], [x + w, y], [x + w + 2, y + h * 0.5], [x + w, y + h], [x + w * 0.5, y + h + 3], [x, y + h], [x - 2, y + h * 0.5], [x, y]];
const SPACES = [
  box(120, 90, 700, 430),
  loop(1050, 240, 150, 110),
  box(900, 440, 420, 250),
  loop(240, 640, 90, 60),
  box(420, 600, 900, 260),
].map((boundary, i) => ({ id: `sp_${i}`, pageId: "page_home", boundary, since: 1, prompt: "", label: "", at: 1 }));

const doc = (spaces) => JSON.stringify({
  state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    nodes: [], groups: [], shapes: [], spaces,
    format: {}, brief: { name: "SPEED", gimmick: "", master: "" },
    frameWidth: 1440, activePageId: "page_home", trail: [],
  },
  version: 0,
});

const START = `window.__f = []; (function l(){ window.__r = requestAnimationFrame((t) => { window.__f.push(t); l(); }); })();`;
const STOP = `cancelAnimationFrame(window.__r); (() => {
  const f = window.__f, d = [];
  for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
  const span = f.length > 1 ? f[f.length - 1] - f[0] : 0;
  const dropped = d.filter((x) => x > 16.7).length;
  d.sort((a, b) => a - b);
  const at = (q) => d.length ? +d[Math.min(d.length - 1, Math.floor(d.length * q))].toFixed(1) : NaN;
  return { frames: d.length, span: Math.round(span), dropped: d.length ? Math.round((dropped / d.length) * 100) : 0, p50: at(0.5), p95: at(0.95), max: +(d[d.length - 1] ?? 0).toFixed(1) };
})()`;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox", "--disable-gpu-vsync", "--disable-frame-rate-limit"],
});

async function measure(spaces, label, hide = "") {
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  await context.addInitScript((d) => { localStorage.setItem("builder.studio", d); }, doc(spaces));
  const page = await context.newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-cloud-layer]", { timeout: 20000 });
  await page.waitForTimeout(2500);
  if (hide) { await page.addStyleTag({ content: hide }); await page.waitForTimeout(400); }
  const holes = await page.locator("[data-space-horizon][data-space-open]").count();

  // Idle: nothing moving but the board itself, three seconds of it.
  await page.evaluate(START);
  await page.waitForTimeout(3000);
  const idle = await page.evaluate(STOP);

  // A pan: the hand down on bare ground, dragged in a slow wave.
  const x = 750, y = 420;
  await page.keyboard.press("h");
  await page.waitForTimeout(250);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.evaluate(START);
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(x - i * 3, y + Math.sin(i / 6) * 90);
    await new Promise((r) => setTimeout(r, 12));
  }
  const pan = await page.evaluate(STOP);
  await page.mouse.up();
  await context.close();
  console.log(`\n  ${label} (${holes} open holes)`);
  console.log(`    idle: ${idle.dropped}% of ${idle.frames} frames over budget · p50 ${idle.p50}ms · p95 ${idle.p95}ms · max ${idle.max}ms`);
  console.log(`    pan:  ${pan.dropped}% of ${pan.frames} frames over budget · p50 ${pan.p50}ms · p95 ${pan.p95}ms · max ${pan.max}ms`);
  return { idle, pan, holes };
}

const bare = await measure([], "no spaces");
const full = await measure(SPACES, "five spaces");
/* And, to say what is left costing what: the same five with the ground
   under them hidden, so what remains is the light and the marks alone. */
const noGround = await measure(SPACES, "five spaces, the ground hidden", "[data-space-ground]{display:none !important}").catch(() => null);
if (noGround) {
  console.log(`\n  attribution, idle frames over budget: none ${bare.idle.dropped}% · five ${full.idle.dropped}% · five without their ground ${noGround.idle.dropped}%`);
  console.log(`  attribution, pan p95: none ${bare.pan.p95}ms · five ${full.pan.p95}ms · five without their ground ${noGround.pan.p95}ms`);
}

/* Five surfaces already made are five lit holes at once: the light itself,
   painted once each and left, measured on its own with nothing closed. */
const MADE = SPACES.map((sp) => ({ ...sp, locked: [{ nodeId: "none", x: 0.1, y: 0.1, w: 0.2, h: 0.2 }], form: { p: 1, gen: 1 } }));
const lit = await measure(MADE, "five made surfaces, all lit").catch(() => null);
if (lit) {
  console.log(`\n  five lit at once, idle: ${lit.idle.dropped}% over budget · p50 ${lit.idle.p50}ms · p95 ${lit.idle.p95}ms; pan p95 ${lit.pan.p95}ms`);
  check("five holes lit at once, painted once each, cost the idle board almost nothing", lit.idle.dropped <= bare.idle.dropped + 8 && lit.idle.p50 <= 16.7, `${lit.idle.dropped}% over budget, p50 ${lit.idle.p50}ms`);
  check("and a pan over five lit holes is not a delayed one", lit.pan.p95 <= Math.max(bare.pan.p95 * 2, bare.pan.p95 + 12), `p95 ${lit.pan.p95}ms with five lit, ${bare.pan.p95}ms without`);
}

/* One open at a time: five spaces on a page is one lit hole and four
   closed lines, which is most of why five cost what one does. */
check("five spaces on a page is one open hole and four closed lines", full.holes === 1, `${full.holes} open`);
/* The bar: five open holes may not turn an idle board into a stuttering
   one, nor a pan into a delayed one. Within a few points of the bare board
   idle, and within half again of it panning. */
check("five spaces cost the idle board almost nothing", full.idle.dropped <= bare.idle.dropped + 8, `${full.idle.dropped}% of frames over budget with spaces, ${bare.idle.dropped}% without`);
check("and a pan with five spaces on the board is the pan without them", full.pan.p95 <= Math.max(bare.pan.p95 * 1.5, bare.pan.p95 + 6), `p95 ${full.pan.p95}ms with spaces, ${bare.pan.p95}ms without`);
check("the middle frame stays in budget with five spaces, idle", full.idle.p50 <= 16.7, `p50 ${full.idle.p50}ms`);

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
