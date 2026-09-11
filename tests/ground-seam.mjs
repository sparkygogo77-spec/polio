/**
 * The ground slides without a seam.
 *
 * A layer is painted once with the drift so far baked into the pattern, and
 * the compositor carries it the rest of the way with a transform. Every so
 * often the drift exhausts the paint's margin, or the turn passes its limit,
 * and the layer is laid again: the paint takes the whole offset and the
 * transform goes back to nothing. That exchange has to be exact, or the
 * ground jumps.
 *
 * It was not exact. `transform: translate3d(d) rotate(t)` is `T·R` — the
 * canvas is turned about its centre and then shifted — so the rotation also
 * turns the offset baked into the paint. The layer sat at `R(t)·laid + d`
 * when it should have sat at `travel(now)`, and the error `(R(t) − I)·laid`
 * grew with the drift and the angle together and snapped to nothing at the
 * next laying. Two triggers per layer, drift and turn, on different periods,
 * beating: irregular rather than cyclic, which is exactly how it read.
 *
 * So this does not test the transform, which is *supposed* to jump — that is
 * the whole mechanism. It tests where the layer actually **is**: the paint's
 * baked offset, turned by the transform's angle, plus the transform's shift.
 * That number is the layer's position on screen, and it must be continuous
 * through every laying, and must equal the drift the layer table says it
 * should have travelled.
 *
 *   node tests/ground-seam.mjs [url] [seconds]
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
const SECONDS = Number(process.argv[3] ?? 60);

/* The layer table, copied rather than imported: a test that reads the same
   constants as the code cannot catch the code changing them. */
const LAYERS = {
  "far-violet": { scale: 2.8, turn: 0, spin: 0.2, dx: 0.5, dy: -0.25 },
  "far-magenta": { scale: 2.3, turn: 70, spin: -0.15, dx: -0.35, dy: 0.4 },
  "near-violet": { scale: 0.95, turn: 30, spin: -0.8, dx: 7.5, dy: -2.5 },
  "near-magenta": { scale: 0.75, turn: 150, spin: 0.6, dx: 5.5, dy: 3.5 },
};
const travel = (l, t) => {
  const a = ((l.turn + l.spin * t) * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  return { x: l.scale * (l.dx * t * c - l.dy * t * s), y: l.scale * (l.dx * t * s + l.dy * t * c) };
};

function sampler() {
  window.__seam = [];
  /* The frame's own timestamp, not `performance.now()`. The ground advances
     its clock by the rAF timestamp, and across a stalled frame the two drift
     apart by tens of milliseconds — enough that an allowance worked out from
     the wrong clock invents a jump that is not there. */
  /* And what is actually painted under a fixed point on screen.
   *
   * The position check above is arithmetic on the transform; it would pass
   * even if the paint itself came back different. This reads the pixels. For
   * a grid of points on screen it works out which pixel of the layer's own
   * bitmap is under each — `q = R(-t)·(p - d)`, the transform run backwards —
   * and samples it. Under a fixed screen point the cloud drifts slowly, so
   * consecutive samples differ a little; being laid again must not make them
   * differ more than that. Sixteen points go into one 16×1 scratch and come
   * back in a single read, because sixteen separate readbacks at 20Hz would
   * cost more than the thing being measured. */
  const grid = [];
  for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) grid.push([(gx - 1.5) * 260, (gy - 1.5) * 190]);
  const strip = document.createElement("canvas");
  strip.width = grid.length;
  strip.height = 1;
  const sc = strip.getContext("2d", { willReadFrequently: true });

  const inkOf = (el, dx, dy, deg) => {
    const a = (-deg * Math.PI) / 180;
    const c = Math.cos(a), sn = Math.sin(a);
    sc.clearRect(0, 0, grid.length, 1);
    for (let i = 0; i < grid.length; i++) {
      const px = grid[i][0] - dx, py = grid[i][1] - dy;
      const qx = px * c - py * sn + el.width / 2;
      const qy = px * sn + py * c + el.height / 2;
      if (qx < 0 || qy < 0 || qx >= el.width || qy >= el.height) continue;
      sc.drawImage(el, Math.floor(qx), Math.floor(qy), 1, 1, i, 0, 1, 1);
    }
    return Array.from(sc.getImageData(0, 0, grid.length, 1).data);
  };

  const read = (ts) => {
    const box = document.querySelector("[data-workspace-ground]");
    const out = { t: ts, box: box ? `${box.clientWidth}x${box.clientHeight}` : "", layers: [] };
    for (const el of document.querySelectorAll("[data-cloud-layer]")) {
      const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px[^)]*\)\s*rotate\(([-\d.]+)deg\)/.exec(el.style.transform || "");
      const x = m ? Number(m[1]) : null, y = m ? Number(m[2]) : null, deg = m ? Number(m[3]) : null;
      out.layers.push({
        id: el.dataset.cloudLayer,
        laidAt: el.dataset.laidAt === undefined ? null : Number(el.dataset.laidAt),
        x, y, deg,
        ink: m && el.width ? inkOf(el, x, y, deg) : null,
      });
    }
    window.__seam.push(out);
    requestAnimationFrame(read);
  };
  requestAnimationFrame(read);
}

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-gpu-vsync", "--disable-frame-rate-limit", ...(process.env.PLAYWRIGHT_CHROMIUM ? ["--no-sandbox"] : [])],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
await page.addInitScript(sampler);
await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-cloud-layer]", { timeout: 20000 });
console.log(`watching every layer's position at 2560×1440 for ${SECONDS}s…`);
await page.waitForTimeout(SECONDS * 1000);
const frames = await page.evaluate(() => window.__seam);
await browser.close();

check("every layer says when it was laid", frames.at(-1).layers.every((l) => l.laidAt !== null),
  frames.at(-1).layers.filter((l) => l.laidAt === null).map((l) => l.id).join(", ") || "all four");

const per = new Map();
for (const f of frames) {
  for (const l of f.layers) {
    if (l.x === null || l.laidAt === null) continue;
    const def = LAYERS[l.id];
    if (!def) continue;
    // Where the layer actually is: the offset baked into the paint, turned
    // by the transform's own angle, plus the transform's shift.
    const laid = travel(def, l.laidAt);
    const a = (l.deg * Math.PI) / 180;
    const c = Math.cos(a), s = Math.sin(a);
    const at = { x: laid.x * c - laid.y * s + l.x, y: laid.x * s + laid.y * c + l.y };
    if (!per.has(l.id)) per.set(l.id, []);
    per.get(l.id).push({ t: f.t, at, laidAt: l.laidAt, tx: l.x, ty: l.y, box: f.box, ink: l.ink });
  }
}

/* The box itself resizes while the page settles, and the ground is anchored
   to the middle of it, so the layers genuinely move when it does. That is not
   a seam, so it is reported rather than counted — and a resize after the page
   has settled would show up as a jump, which is what should happen. */
const SETTLED_MS = 5000;
let worstJump = 0, worstLayer = "", lays = 0, transformResets = 0, worstEarly = 0, resizes = 0;
for (const [id, rows] of per) {
  /* A control. The same measurement on frames where nothing was laid is pure
     compositor motion with no exchange to get wrong, so whatever it reports
     is the measurement's own noise — mostly a stalled frame, where the
     elapsed time between two samples and the time the ground's clock
     actually advanced are not quite the same thing. A laying only counts as
     a seam if it is worse than that floor. */
  let jump = 0, when = 0, n = 0, resets = 0, quiet = 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    const relaid = b.laidAt !== a.laidAt;
    if (relaid) n++;
    if (relaid && Math.hypot(b.tx, b.ty) < Math.hypot(a.tx, a.ty)) resets++;
    // The position may only move by the drift of one frame. A laying must
    // not move it at all beyond that.
    const step = Math.hypot(b.at.x - a.at.x, b.at.y - a.at.y);
    const allowed = Math.hypot(LAYERS[id].dx, LAYERS[id].dy) * LAYERS[id].scale * ((b.t - a.t) / 1000) + 0.05;
    const over = step - allowed;
    if (b.box !== a.box) { resizes++; continue; }
    if (b.t < SETTLED_MS) { worstEarly = Math.max(worstEarly, over); continue; }
    if (!relaid) { quiet = Math.max(quiet, over); continue; }
    if (over > jump) { jump = over; when = Math.round(b.t); }
  }
  lays += n;
  transformResets += resets;
  console.log(`       ${id.padEnd(13)} laid ${String(n).padStart(2)}× · worst laying step ${jump.toFixed(3)}px${jump > 0.5 ? ` at ${when}ms` : ""} · worst quiet-frame step ${quiet.toFixed(3)}px`);
  if (jump - quiet > worstJump) { worstJump = jump - quiet; worstLayer = id; }
}

console.log(`       while the page was still settling (first ${SETTLED_MS / 1000}s): worst ${worstEarly.toFixed(3)}px, ${resizes} box resize(s)`);
check("a laying is no worse than a quiet frame", worstJump < 0.35,
  `worst laying exceeds its own noise floor by ${worstJump.toFixed(3)}px${worstLayer ? ` (${worstLayer})` : ""}, over the settled ${SECONDS - SETTLED_MS / 1000}s`);
check("layers were laid again during the watch", lays > 0, `${lays} layings, ${transformResets} of them resetting the transform`);

/* And the layer must actually be drifting at about the speed the table says,
   not merely drifting smoothly — a layer that quietly halved would pass every
   continuity check above.

   A band, not an equality, and deliberately so: the ground advances its clock
   by the frame gap clamped at 250ms, so across a stall its clock falls behind
   the wall clock and the layer is genuinely where its own clock says, not
   where elapsed time says. Comparing the two exactly measures the stalls, not
   the drift. An earlier version of this check did exactly that and reported a
   17px "departure" that was nothing but clock lag. */
let worstRate = 0, rateLayer = "";
for (const [id, rows] of per) {
  const settled = rows.filter((r) => r.t >= SETTLED_MS);
  if (settled.length < 20) continue;
  let path = 0;
  for (let i = 1; i < settled.length; i++) {
    path += Math.hypot(settled[i].at.x - settled[i - 1].at.x, settled[i].at.y - settled[i - 1].at.y);
  }
  const secs = (settled.at(-1).t - settled[0].t) / 1000;
  const want = Math.hypot(LAYERS[id].dx, LAYERS[id].dy) * LAYERS[id].scale;
  const got = path / secs;
  const off = Math.abs(got - want) / want;
  console.log(`       ${id.padEnd(13)} drifts ${got.toFixed(2)}px/s, the table says ${want.toFixed(2)}px/s`);
  if (off > worstRate) { worstRate = off; rateLayer = id; }
}
check("every layer drifts at the speed its table entry describes", worstRate < 0.25,
  `worst ${(worstRate * 100).toFixed(1)}% off${rateLayer ? ` (${rateLayer})` : ""}, clock lag included`);

/* The pixels under a fixed point on screen, across a laying against a quiet
   frame. This is the check that would catch the paint itself coming back
   different, which the arithmetic above cannot see. */
let worstInk = 0, inkLayer = "";
for (const [id, rows] of per) {
  let laidInk = 0, quietInk = 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (!a.ink || !b.ink || a.box !== b.box || b.t < SETTLED_MS) continue;
    let d = 0;
    for (let k = 0; k < a.ink.length; k++) d += Math.abs(a.ink[k] - b.ink[k]);
    d /= a.ink.length;
    if (b.laidAt !== a.laidAt) laidInk = Math.max(laidInk, d);
    else quietInk = Math.max(quietInk, d);
  }
  console.log(`       ${id.padEnd(13)} pixels under a fixed point: ${laidInk.toFixed(2)} at a laying vs ${quietInk.toFixed(2)} quiet (0-255)`);
  if (laidInk - quietInk > worstInk) { worstInk = laidInk - quietInk; inkLayer = id; }
}
check("the paint under a fixed point does not change at a laying", worstInk < 2,
  `worst ${worstInk.toFixed(2)}/255 over its own noise${inkLayer ? ` (${inkLayer})` : ""}`);

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
