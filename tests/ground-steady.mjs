/**
 * The ground must never blink, and the sparks must never stop.
 *
 * Two complaints that a screenshot cannot settle, so this watches instead.
 *
 * **The blink.** "It flickers black every so often, like the nebula reloads."
 * Three things could do that and they leave different marks, so this looks
 * for each by name rather than guessing:
 *
 *  · *The layers are torn down and rebuilt.* `useGround` starts with
 *    `holder.replaceChildren()`, so anything that re-runs the effect empties
 *    the holder and the app's own background shows until the first paint. A
 *    `MutationObserver` on the holder catches it: one childList burst is the
 *    mount, any later one is a reload.
 *  · *A canvas loses its backing store.* Four window-sized canvases at 1440p
 *    are about 80MB of backing store, and a browser under memory pressure
 *    may drop one; it reads back transparent until something draws to it
 *    again. Sampling one known-painted pixel per layer catches that, and
 *    nothing else does — the element is still there, the right size, and
 *    still being moved.
 *  · *A resize blanks them.* Assigning `canvas.width` clears it. That is in
 *    the same task as the repaint that follows, so it should never be seen;
 *    this records resizes anyway so a blink can be lined up against one.
 *
 * **The stopping.** The ground holds still while `data-board-drag` is set.
 * A flag that goes on and does not come off freezes the weather for good, so
 * this samples the ember canvas over time and reports the longest run of
 * samples in which nothing moved at all.
 *
 *   node tests/ground-steady.mjs [url] [seconds]
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
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const SECONDS = Number(process.argv[3] ?? 60);
/* Sampling pixels is how this finds a blanked layer, but a readback off a
   promoted canvas costs about a millisecond here and nearly a second on real
   hardware, so the probe can be heavier than what it measures. `--no-pixels`
   drops the sampling and leaves the frame timing, to check the timings are
   the ground's and not the probe's. */
const PIXELS = !process.argv.includes("--no-pixels");

/** Installed in the page before the ground exists, so the mount is seen too. */
function watch(PIXELS) {
  const w = {
    rebuilds: 0, mountSeen: false, blank: [], resizes: 0, frames: 0, gaps: [],
    still: 0, stillMax: 0, stillNow: 0, lastInk: "", dragOn: 0, dragSince: 0, dragMax: 0, stalls: [], empties: 0, errors: [],
  };
  window.__ground = w;
  const start = performance.now();

  const hook = () => {
    const holder = document.querySelector("[data-ground-clouds]");
    if (!holder) return false;
    new MutationObserver((recs) => {
      for (const r of recs) {
        if (r.type !== "childList") continue;
        if (r.addedNodes.length) w.mountSeen = true;
        /* Removals, not additions. The mount appends a sky and four canvases
           one at a time, which is five records and would read as four
           rebuilds if additions were counted. Only `replaceChildren` on a
           holder that already has children removes anything, and that is
           exactly the teardown being hunted. */
        if (r.removedNodes.length) w.rebuilds++;
      }
    }).observe(holder, { childList: true });
    return true;
  };
  if (!hook()) {
    const poll = setInterval(() => { if (hook()) clearInterval(poll); }, 50);
  }

  let last = performance.now();
  const size = new Map();
  const tick = (t) => {
    requestAnimationFrame(tick);
    w.frames++;
    const gap = Math.round((t - last) * 10) / 10;
    w.gaps.push(gap);
    // Where the long ones fall matters more than that they exist: a recycle
    // is periodic, a garbage collection is not.
    if (gap > 80) w.stalls.push({ at: Math.round(t - start), gap });
    last = t;
    if (document.documentElement.dataset.boardDrag === "1") {
      if (!w.dragSince) w.dragSince = t;
      w.dragOn++;
      w.dragMax = Math.max(w.dragMax, t - w.dragSince);
    } else w.dragSince = 0;

    for (const c of document.querySelectorAll("[data-cloud-layer]")) {
      const k = c.dataset.cloudLayer;
      const s = `${c.width}x${c.height}`;
      if (size.has(k) && size.get(k) !== s) w.resizes++;
      size.set(k, s);
    }
  };
  requestAnimationFrame(tick);

  /* Is each layer still carrying paint? A dropped backing store reads back
     transparent while the element stays the right size and keeps moving, so
     nothing but a pixel read finds it. Ten times a second, eight points each.

     The layers carry a `bitmaprenderer` context, not a 2D one, so they
     cannot be read directly — `getContext("2d")` on them returns null, and
     an earlier version of this file called `getImageData` on that null,
     threw inside the interval, and then reported every check green because
     nothing ever got as far as recording a failure. A probe that breaks has
     to say so, so each sample runs in its own guard and an error is counted
     rather than swallowed. The layer is drawn into a scratch 2D canvas a
     pixel at a time, which reads the bitmap the compositor is showing. */
  const scratch = document.createElement("canvas");
  scratch.width = 8;
  scratch.height = 1;
  const sg = scratch.getContext("2d", { willReadFrequently: true });

  if (PIXELS) setInterval(() => {
    try {
      for (const c of document.querySelectorAll("[data-cloud-layer]")) {
        if (!c.width || !c.height) continue;
        sg.clearRect(0, 0, 8, 1);
        // A band across the middle: the clouds are patchy, so one point could
        // honestly be empty. Eight points, and all eight clear is a blank layer.
        for (let i = 1; i <= 8; i++) {
          sg.drawImage(c, Math.floor((c.width * i) / 9), Math.floor(c.height / 2), 1, 1, i - 1, 0, 1, 1);
        }
        const d = sg.getImageData(0, 0, 8, 1).data;
        let ink = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 2) ink++;
        if (ink === 0) w.blank.push({ at: Math.round(performance.now() - start), layer: c.dataset.cloudLayer });
      }
    } catch (e) { w.errors.push(`layers: ${e}`); }

    try {
    /* And are the embers moving at all? A small window of the canvas, not
       all of it: reading back a full 2560×1440 ImageData is 14MB, and at ten
       a second that is 140MB/s of GPU-to-CPU sync — heavy enough to cause
       the stalls it would then be credited with finding. An instrument has
       to be lighter than what it measures. A 360×300 window holds several
       sparks and costs 400KB. The measure is the centroid of lit pixels
       rather than a hash: it shifts whenever anything moves at all, where a
       sparse hash misses a spark that drifted half a pixel. */
    const sp = document.querySelector("canvas[data-ground-sparks]");
    if (sp && sp.width > 400) {
      const g = sp.getContext("2d", { willReadFrequently: true });
      const W = 360, H = 300;
      const d = g.getImageData(Math.floor(sp.width / 2 - W / 2), Math.floor(sp.height / 2 - H / 2), W, H).data;
      let n = 0, sx = 0, sy = 0;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a < 4) continue;
        const px = (i / 4) % W, py = Math.floor(i / 4 / W);
        n += a; sx += px * a; sy += py * a;
      }
      const ink = n ? `${(sx / n).toFixed(2)},${(sy / n).toFixed(2)},${n}` : "";
      // An empty window is not a still one: say so rather than counting it.
      if (!n) { w.stillNow = 0; w.empties++; }
      else if (ink === w.lastInk) { w.stillNow++; w.stillMax = Math.max(w.stillMax, w.stillNow); }
      else w.stillNow = 0;
      w.lastInk = ink;
      w.still = w.stillMax;
    }
    } catch (e) { w.errors.push(`embers: ${e}`); }
  }, 100);
}

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-gpu-vsync", "--disable-frame-rate-limit", ...(process.env.PLAYWRIGHT_CHROMIUM ? ["--no-sandbox"] : [])],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
await page.addInitScript(watch, PIXELS);
await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-cloud-layer]", { timeout: 20000 });

console.log(`watching the ground at 2560×1440 for ${SECONDS}s…`);
await page.waitForTimeout(SECONDS * 1000);

const w = await page.evaluate(() => {
  const g = window.__ground;
  const gaps = g.gaps.slice(5).sort((a, b) => a - b);
  return {
    rebuilds: g.rebuilds, blank: g.blank.slice(0, 12), blanks: g.blank.length, resizes: g.resizes,
    frames: g.frames, beat: gaps[Math.floor(gaps.length / 2)] ?? 0, worst: gaps[gaps.length - 1] ?? 0,
    stillMax: g.stillMax, dragMax: Math.round(g.dragMax), layers: document.querySelectorAll("[data-cloud-layer]").length,
    stalls: g.stalls.filter((x) => x.at > 5000), over80: g.stalls.filter((x) => x.at > 5000).length,
    early: g.stalls.filter((x) => x.at <= 5000).length, empties: g.empties, errors: [...new Set(g.errors)].slice(0, 3), errorCount: g.errors.length,
  };
});

console.log(`\n       ${w.frames} frames, beat ${w.beat}ms, worst ${w.worst}ms, ${w.layers} layers`);
console.log(`       over 80ms: ${w.early} while loading (first 5s), ${w.over80} in steady state`);
console.log(`       steady-state stalls: ${w.stalls.slice(0, 14).map((s) => `${s.at}ms/${s.gap}`).join("  ") || "none"}`);
console.log(`       ember window empty on ${w.empties} samples\n`);
check("the probe itself never threw", w.errorCount === 0, w.errorCount ? `${w.errorCount} error(s): ${w.errors.join(" | ")}` : "every sample ran");
check("the ground is never torn down and rebuilt", w.rebuilds === 0, `${w.rebuilds} teardown(s) of the holder`);
if (PIXELS) check("no layer ever loses its paint", w.blanks === 0, w.blanks ? `${w.blanks} blank reads, first: ${w.blank.slice(0, 4).map((b) => `${b.layer}@${b.at}ms`).join(", ")}` : "all layers inked throughout");
check("no unexplained canvas resize", w.resizes === 0, `${w.resizes} resize(s)`);
if (PIXELS) check("the embers never stop", w.stillMax < 3, `longest still run ${w.stillMax} samples (${w.stillMax * 100}ms)`);
check("the drag pause never sticks", w.dragMax < 1000, `longest hold ${w.dragMax}ms`);

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
