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
  const read = (ts) => {
    const box = document.querySelector("[data-workspace-ground]");
    const out = { t: ts, box: box ? `${box.clientWidth}x${box.clientHeight}` : "", layers: [] };
    for (const el of document.querySelectorAll("[data-cloud-layer]")) {
      const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px[^)]*\)\s*rotate\(([-\d.]+)deg\)/.exec(el.style.transform || "");
      out.layers.push({
        id: el.dataset.cloudLayer,
        laidAt: el.dataset.laidAt === undefined ? null : Number(el.dataset.laidAt),
        x: m ? Number(m[1]) : null, y: m ? Number(m[2]) : null, deg: m ? Number(m[3]) : null,
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
    per.get(l.id).push({ t: f.t, at, laidAt: l.laidAt, tx: l.x, ty: l.y, box: f.box });
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

// And the position must be the drift the table says, not merely continuous.
let worstDrift = 0;
for (const [id, rows] of per) {
  const def = LAYERS[id];
  const t0 = rows[0].t;
  for (const r of rows) {
    const want = travel(def, (r.t - t0) / 1000 + rows[0].laidAt);
    const got = { x: r.at.x - rows[0].at.x + travel(def, rows[0].laidAt).x, y: r.at.y - rows[0].at.y + travel(def, rows[0].laidAt).y };
    worstDrift = Math.max(worstDrift, Math.hypot(want.x - got.x, want.y - got.y));
  }
}
check("and it tracks the drift the layer table describes", worstDrift < 6, `worst departure ${worstDrift.toFixed(2)}px`);

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
