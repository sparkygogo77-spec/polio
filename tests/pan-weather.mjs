/**
 * A pan with the weather left running.
 *
 * The ground used to freeze while the hand was down. That was bought when the
 * clouds were repainted on every frame to move them: a pan and a full-surface
 * repaint wanted the same main thread, and the repaint lost. The field is
 * painted once and slid on the compositor now, so a moving cloud costs a
 * transform write and nothing else, and the pause may be paying for a bill
 * that no longer arrives.
 *
 * So this measures the pan itself with everything moving — clouds drifting,
 * embers burning, recycles landing where they land — and reports the frame
 * times. It also checks that both really are moving during the pan, because
 * a pan that measures beautifully because the ground quietly stopped is the
 * thing being tested for.
 *
 *   node tests/pan-weather.mjs [url] [width] [height]
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

const URL_ = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-gpu-vsync", "--disable-frame-rate-limit", ...(process.env.PLAYWRIGHT_CHROMIUM ? ["--no-sandbox"] : [])],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});

const START = `window.__f = []; (function l(){ window.__r = requestAnimationFrame((t) => { window.__f.push(t); l(); }); })();`;
const STOP = `cancelAnimationFrame(window.__r); (() => {
  const f = window.__f, d = [];
  for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
  const span = f.length > 1 ? f[f.length - 1] - f[0] : 0;
  d.sort((a, b) => a - b);
  const at = (q) => d.length ? +d[Math.min(d.length - 1, Math.floor(d.length * q))].toFixed(1) : NaN;
  return { frames: d.length, span: Math.round(span), p50: at(0.5), p95: at(0.95), max: +(d[d.length - 1] ?? 0).toFixed(1) };
})()`;

/** The ember canvas, sampled small: a readback on a big one is not free. */
const EMBERS = `(() => {
  const sp = document.querySelector("canvas[data-ground-sparks]");
  if (!sp || !sp.width) return "";
  const g = sp.getContext("2d", { willReadFrequently: true });
  const d = g.getImageData(Math.floor(sp.width / 2) - 180, Math.floor(sp.height / 2) - 150, 360, 300).data;
  let n = 0, sx = 0;
  for (let i = 0; i < d.length; i += 4) { const a = d[i + 3]; if (a > 3) { n += a; sx += ((i / 4) % 360) * a; } }
  return n ? (sx / n).toFixed(3) + ":" + n : "";
})()`;
const CLOUD = `getComputedStyle(document.querySelector("[data-cloud-layer]")).transform`;

/** The same gesture with the clouds hidden: the pan, with no ground in it. */
async function withoutClouds(page, x, y) {
  const hide = await page.addStyleTag({ content: "[data-ground-clouds]{display:none !important}" });
  await page.waitForTimeout(400);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.evaluate(START);
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(x - i * 3, y + Math.sin(i / 6) * 90);
    await new Promise((r) => setTimeout(r, 12));
  }
  const t = await page.evaluate(STOP);
  await page.mouse.up();
  await hide.evaluate((el) => el.remove());
  await page.waitForTimeout(300);
  return t;
}

async function pan(w, h, label) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-cloud-layer]", { timeout: 20000 });
  await page.waitForTimeout(2500);

  const x = Math.round(w * 0.5), y = Math.round(h * 0.42);
  await page.keyboard.press("h");
  await page.waitForTimeout(250);
  await page.mouse.move(x, y);
  await page.mouse.down();

  const cloudBefore = await page.evaluate(CLOUD);
  const emberBefore = await page.evaluate(EMBERS);
  await page.evaluate(START);
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(x - i * 3, y + Math.sin(i / 6) * 90);
    await new Promise((r) => setTimeout(r, 12));
  }
  const t = await page.evaluate(STOP);
  const cloudAfter = await page.evaluate(CLOUD);
  const emberAfter = await page.evaluate(EMBERS);
  await page.mouse.up();
  await page.keyboard.press("v");

  console.log(`\n  ${label} — ${w}×${h}, ${t.frames} frames over ${t.span}ms`);
  console.log(`    p50 ${t.p50}ms · p95 ${t.p95}ms · max ${t.max}ms`);
  check(`${label}: the middle frame is inside the budget`, t.p50 < 16.7, `p50 ${t.p50}ms`);
  /* Two numbers, because they answer different questions.
   *
   * The pan itself must be fast, and it is measured with the clouds hidden:
   * that is the gesture, the React work and the frame, with nothing of the
   * ground in it. The second number is the ground's marginal cost, and on
   * this container it is large and always was — four window-sized layers
   * blended with `screen` on a software rasteriser. Attributed rather than
   * assumed: hiding the clouds takes p95 from 63.5ms to 9.6ms, and switching
   * only the *animation* off leaves it at 61.8ms. So it is the blending, not
   * the motion, and it is not something the drift can be blamed for.
   *
   * An earlier version of this file recorded p95 13.5ms here and that number
   * was a lie of a particular kind: the board carried an opaque background at
   * the time, so the ground was fully occluded and Chromium skipped it. The
   * pan was not fast, the ground was not being drawn. Any figure taken while
   * something is invisible is a figure about nothing.
   *
   * The ceiling below is therefore generous and only catches a catastrophe.
   * The real verdict is on hardware with a graphics card, where four blended
   * layers is the compositor's day job. */
  const bare = await withoutClouds(page, x, y);
  console.log(`    without the clouds: p50 ${bare.p50}ms · p95 ${bare.p95}ms — the pan itself`);
  check(`${label}: the pan itself is smooth`, bare.p95 < 33 && bare.max < 120, `p95 ${bare.p95}ms · max ${bare.max}ms`);
  check(`${label}: the ground does not make it catastrophic`, t.p95 < 140, `p95 ${t.p95}ms with the ground, ${bare.p95}ms without`);
  check(`${label}: the clouds drifted through the pan`, cloudBefore !== cloudAfter, cloudBefore === cloudAfter ? "held still" : "moving");
  check(`${label}: the embers burned through the pan`, emberBefore !== emberAfter && !!emberAfter, emberBefore === emberAfter ? "held still" : "moving");
  await page.close();
  return t;
}

await pan(1500, 950, "pane");
await pan(2560, 1440, "1440p");

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
