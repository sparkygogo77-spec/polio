/**
 * The vine has no end lines: one colour dissipates into the other.
 *
 * His words: "the blend kind isnt there its just a little overlap clearly,
 * can you make it so the green flows and dissipates into the red and vice
 * versa? i can see the end lines of each."
 *
 * He is looking at pixels, so this looks at pixels. It seeds one green board
 * and one red drawing, opens the timeline, reads the vine between them off
 * the canvas, and walks its colour along the run: for each column of the
 * ribbon, the mean lightness and chroma of its pixels and the chroma-weighted
 * mean of their hue. One pixel is the rim, another the dark core, a third is
 * under the cloud's mottling; the ribbon's colour is what they average to.
 *
 * What it then asks is not "are both colours present" — they were — but
 * WHERE THE CHANGE HAPPENS. Two ribbons laid over each other, each solid
 * and then faded, keep their own colour flat along most of the run and swap
 * over in a short stretch in the middle: that stretch is the end line he can
 * see. A single ribbon whose colour is interpolated along its length has the
 * change spread over the whole of it and no stretch you could point at.
 *
 * Measured on the deploy at 9567416, which is what he is looking at: three
 * degrees of hue in the first third of the run, and then 85 of the 112
 * degrees — 76% of the whole journey — between two fifths and two thirds.
 * That is the shape of the fault: not a cliff, but two flat blocks with the
 * change crammed between them, and the edge of a flat block is a line.
 *
 * Worth saying plainly, because it decides what a check here can claim: the
 * sharpest twelve-pixel step in perceptual distance was 1.9 times the
 * average on that build against 1.4 on this one, and both are under any
 * honest bar. The old vine's seam was not a big step in colour — it happens
 * where the ribbon is at its darkest and has least colour in it — so a
 * check that only looked for one would have passed the thing he is pointing
 * at. What bites is where the change sits, not how steep it is.
 *
 *   node tests/vine-blend.mjs [url]
 *
 * Runs alone: reads the vine's hue as it passes from green to red; under load the hue was read mid-change.
 */
const req = (await import("node:module")).createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const thread = (id, parentId, i, mode) => ({
  id, parentId, at: 1_700_000_000_000 + i * 1000, mode,
  ask: `ask ${i}`, answer: `answer ${i}`, changes: [`changed ${i}`],
});
/* One green board and one red drawing, far enough apart that the run is
   worth sampling: the blend is a property of the length. */
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [], groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
  threads: [thread("t0", null, 0, "critique"), thread("t1", "t0", 1, "drawing")],
  threadSpots: { "box:t0": { x: 200, y: 400 }, "box:t1": { x: 900, y: 400 } },
}, version: 0 });

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const finish = page.getByRole("button", { name: /^Finish/ }).first();
check("the timeline opens", (await finish.count()) > 0, (await finish.count()) ? "" : "no Finish to press");
if (await finish.count()) { await finish.click(); await page.waitForTimeout(1800); }

const read = await page.evaluate(() => {
  const c = document.querySelector("[data-timeline-vines]");
  if (!c) return { error: "no vine canvas" };
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const { width: w, height: h } = c;
  const img = ctx.getImageData(0, 0, w, h).data;
  const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const oklch = (R, G, B) => {
    const r = f(R), g = f(G), b = f(B);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    const B2 = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return { L, C: Math.hypot(A, B2), H: (Math.atan2(B2, A) * 180 / Math.PI + 360) % 360 };
  };
  const cols = [];
  for (let x = 0; x < w; x++) {
    let n = 0, sL = 0, sC = 0, sx = 0, sy = 0;
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      if (img[i + 3] < 200) continue;
      const p = oklch(img[i], img[i + 1], img[i + 2]);
      n++; sL += p.L; sC += p.C;
      const r = p.H * Math.PI / 180;
      sx += Math.cos(r) * p.C; sy += Math.sin(r) * p.C;
    }
    if (n >= 4) cols.push({ x, L: sL / n, C: sC / n, H: ((Math.atan2(sy, sx) * 180 / Math.PI) + 360) % 360 });
  }
  return { w, h, cols };
});
if (read.error) {
  check("the vine is on the canvas to be read", false, read.error);
} else {
  const all = read.cols;
  check("the vine is on the canvas to be read", all.length >= 40, `${all.length} columns of ribbon in a ${read.w}×${read.h} canvas`);
  /* The two ends are where the ribbon gathers into a board and tapers out of
     the sampling, and that taper is a bigger change per pixel than anything
     the blend does: trimmed at a tenth, the sharpest step in both the old
     build and the new one was the tail rather than the seam, and the check
     would have been reporting the wrong thing in both directions. A fifth
     off each end leaves the run the colour is made over. */
  const run = all.slice(Math.round(all.length * 0.2), Math.round(all.length * 0.8));
  const at = (f) => run[Math.min(run.length - 1, Math.round(f * (run.length - 1)))];
  /* Hue is circular; this vine's journey is the short way round, green to red. */
  const step = (a, b) => { let d = b - a; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
  const first = at(0).H, last = at(1).H;
  const travel = Math.abs(step(first, last));
  check("it leaves green and arrives red", first > 90 && first < 190 && (last < 60 || last > 330), `hue ${first.toFixed(0)} → ${last.toFixed(0)}`);
  check("and the whole journey between them is made", travel > 90, `${travel.toFixed(0)} degrees of hue`);

  /*
   * WHERE THE CHANGE HAPPENS, in colour rather than in hue.
   *
   * Hue alone is the wrong instrument here and the first version of this
   * check used it: a ninety-degree swing where the ribbon has almost no
   * colour in it is nothing to look at, and the same swing at the rim's
   * chroma is a line across the vine. So the reading is the perceptual
   * distance between two points twelve pixels apart — about the smallest
   * stretch a person can point at on a vine this size — and what is asked
   * is how the biggest of those compares with the average.
   *
   * A colour interpolated smoothly along a length has a peak a little above
   * its average, because any ease is faster in its middle than at its ends:
   * smoothstep's is half as fast again. Two ribbons that swap over have a
   * peak many times their average, and that peak is the end line.
   */
  const lab = (p) => ({ L: p.L, a: p.C * Math.cos(p.H * Math.PI / 180), b: p.C * Math.sin(p.H * Math.PI / 180) });
  const STEP = 6;
  const jumps = [];
  for (let i = STEP; i < run.length - STEP; i++) {
    const a = lab(run[i - STEP]);
    const b = lab(run[i + STEP]);
    jumps.push({ at: i / run.length, d: Math.hypot(b.L - a.L, b.a - a.a, b.b - a.b) });
  }
  const mean = jumps.reduce((n, j) => n + j.d, 0) / (jumps.length || 1);
  const peak = jumps.reduce((w, j) => (j.d > w.d ? j : w), { at: 0, d: 0 });
  /* This one passed on the old build too, at 1.9 against this one's 1.4. It
     is kept as a guard rather than as a witness: it is what would catch
     somebody putting a hard edge back. The two below are the ones that
     bite on what he is looking at. */
  check("no twelve pixels of it carry a step: the sharpest change along the run is close to the average one",
    peak.d < mean * 2.5, `the sharpest is ${peak.d.toFixed(4)} at ${(peak.at * 100).toFixed(0)}% of the run, against an average of ${mean.toFixed(4)} — ${(peak.d / mean).toFixed(1)} times`);

  const quarter = Math.abs(step(at(0.4).H, at(0.65).H));
  check("and the middle quarter does not carry the whole of it either",
    quarter < travel * 0.7, `${quarter.toFixed(0)} of ${travel.toFixed(0)} degrees, ${(100 * quarter / travel).toFixed(0)}%, happens between two fifths and two thirds`);

  /* Neither end is a solid block of its own colour: it is already going by
     the time it is a third of the way along. */
  const early = Math.abs(step(at(0.1).H, at(0.35).H));
  check("neither end holds flat and then switches: the colour is already moving in the first third",
    early > travel * 0.05, `${early.toFixed(0)} degrees have gone by a third of the way along`);

  /* And it goes by dissipating rather than by turning: the material's own
     dark in the middle, so there is no third colour and nothing to see. */
  const cm = at(0.5).C, ca = at(0.05).C, cz = at(0.95).C;
  check("it dissipates through the material's own dark rather than turning through a third colour",
    cm < ca * 0.95 && cm < cz * 0.95, `chroma ${ca.toFixed(3)} at the green end, ${cm.toFixed(3)} in the middle, ${cz.toFixed(3)} at the red`);

  console.log("\n  the run, every twentieth:");
  for (let i = 0; i <= 20; i++) {
    const p = at(i / 20);
    console.log(`    ${String(i * 5).padStart(3)}%  L ${p.L.toFixed(3)}  C ${p.C.toFixed(3)}  H ${p.H.toFixed(0)}`);
  }
}
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
