/**
 * What grows while the Builder is left open.
 *
 * The complaint is that it gets worse the longer it is open, which means
 * something is accumulating rather than being replaced. This does not guess
 * which; it counts every candidate over a long run and reports what climbs.
 *
 * Everything is instrumented before the page's own scripts run, by wrapping
 * the browser's own bookkeeping:
 *
 *  · **Animation loops.** Not how many `requestAnimationFrame` calls have
 *    been made, which only goes up, but how many callbacks run *per frame*.
 *    A loop restarted on a re-render without the old one being cancelled
 *    shows as that number climbing — one loop is one callback a frame.
 *  · **Listeners.** `addEventListener` and `removeEventListener` on the
 *    prototype, counted net and per type, so a listener added per part and
 *    never removed is visible by name.
 *  · **Timers.** `setInterval`/`setTimeout` outstanding, the same way.
 *  · **Canvases and their backing store.** Count, and total pixels times
 *    four bytes, which is the real cost of a laying allocating rather than
 *    reusing.
 *  · **The heap and the DOM.** `usedJSHeapSize` and the node count.
 *
 * Nothing here reads pixels: a readback off a promoted layer is expensive
 * enough to be its own confound, and none of these questions need one.
 *
 *   node tests/ground-growth.mjs [url] [minutes]
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const MINUTES = Number(process.argv[3] ?? 12);

function instrument() {
  const S = {
    listeners: {}, listenerNet: 0, timersLive: 0, intervalsLive: 0,
    rafCalls: 0, frames: 0, samples: [],
  };
  window.__grow = S;

  /* rAF: count callbacks and the frames they land in, so the ratio is the
     number of loops actually running rather than the number ever started. */
  const raf = window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame.bind(window);
  let lastStamp = -1;
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      S.rafCalls++;
      if (t !== lastStamp) { S.frames++; lastStamp = t; }
      return cb(t);
    });
  window.cancelAnimationFrame = caf;

  const EA = EventTarget.prototype.addEventListener;
  const ER = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    S.listeners[type] = (S.listeners[type] ?? 0) + 1;
    S.listenerNet++;
    return EA.call(this, type, fn, opts);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opts) {
    S.listeners[type] = (S.listeners[type] ?? 0) - 1;
    S.listenerNet--;
    return ER.call(this, type, fn, opts);
  };

  const SI = window.setInterval, CI = window.clearInterval;
  const ST = window.setTimeout, CT = window.clearTimeout;
  window.setInterval = function (...a) { S.intervalsLive++; return SI.apply(window, a); };
  window.clearInterval = function (id) { S.intervalsLive--; return CI.call(window, id); };
  window.setTimeout = function (fn, ms, ...a) {
    S.timersLive++;
    return ST.call(window, (...x) => { S.timersLive--; return typeof fn === "function" ? fn(...x) : fn; }, ms, ...a);
  };
  window.clearTimeout = function (id) { S.timersLive--; return CT.call(window, id); };

  window.__sample = () => {
    const canvases = [...document.querySelectorAll("canvas")];
    const bytes = canvases.reduce((n, c) => n + c.width * c.height * 4, 0);
    const calls = S.rafCalls, frames = S.frames;
    S.rafCalls = 0; S.frames = 0;
    const busy = Object.entries(S.listeners).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return {
      loopsPerFrame: frames ? +(calls / frames).toFixed(2) : 0,
      listenerNet: S.listenerNet,
      topListeners: busy.map(([k, n]) => `${k}:${n}`).join(" "),
      timers: S.timersLive,
      intervals: S.intervalsLive,
      canvases: canvases.length,
      canvasMB: +(bytes / 1048576).toFixed(1),
      cloudLayers: document.querySelectorAll("[data-cloud-layer]").length,
      nodes: document.getElementsByTagName("*").length,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
    };
  };
}

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-precise-memory-info", ...(process.env.PLAYWRIGHT_CHROMIUM ? ["--no-sandbox"] : [])],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
await page.addInitScript(instrument);
await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-cloud-layer]", { timeout: 20000 });
await page.waitForTimeout(4000);

const rows = [];
const EVERY = 20;
const total = Math.round((MINUTES * 60) / EVERY);
console.log(`leaving the Builder open for ${MINUTES} minutes, sampling every ${EVERY}s…\n`);
console.log(`   min  loops/frame  listeners  timers  intervals  canvases  canvasMB  nodes  heapMB`);
for (let i = 0; i <= total; i++) {
  const s = await page.evaluate(() => window.__sample());
  s.min = +((i * EVERY) / 60).toFixed(1);
  rows.push(s);
  console.log(
    `  ${String(s.min).padStart(4)}  ${String(s.loopsPerFrame).padStart(11)}  ${String(s.listenerNet).padStart(9)}  ${String(s.timers).padStart(6)}  ${String(s.intervals).padStart(9)}  ${String(s.canvases).padStart(8)}  ${String(s.canvasMB).padStart(8)}  ${String(s.nodes).padStart(5)}  ${String(s.heapMB).padStart(6)}`,
  );
  if (i < total) await page.waitForTimeout(EVERY * 1000);
}
await browser.close();

const a = rows[0], z = rows.at(-1);
const climbed = [];
for (const k of ["loopsPerFrame", "listenerNet", "timers", "intervals", "canvases", "canvasMB", "nodes", "heapMB"]) {
  if (a[k] === null || z[k] === null) continue;
  const d = z[k] - a[k];
  const pc = a[k] ? (d / a[k]) * 100 : d ? Infinity : 0;
  if (d > 0 && (pc > 15 || d > 4)) climbed.push(`${k}: ${a[k]} → ${z[k]} (+${d.toFixed(1)}, ${pc === Infinity ? "from nothing" : `+${pc.toFixed(0)}%`})`);
}
console.log(`\n  over ${MINUTES} minutes:`);
console.log(climbed.length ? climbed.map((c) => `    ${c}`).join("\n") : "    nothing climbed");
console.log(`\n  busiest listener types at the end: ${z.topListeners}`);
writeFileSync(".screenshots/ground-growth.json", JSON.stringify(rows, null, 2));
