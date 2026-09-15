/**
 * THE GROUND'S ONE SLIDING LAYER LANDS ON WHOLE PIXELS.
 *
 * The ground is one canvas the size of the pane and a bit, sliding sideways
 * for ever: at the pane the shelf left behind it that is 1835 by 1191, two
 * and a quarter million pixels. A composited layer that lands *between*
 * pixels has to be resampled across its whole surface on every frame it
 * moves; one that lands on a pixel can be copied. So all of that was being
 * filtered thirty times a second to move the clouds six pixels.
 *
 * `steps(period)` over a slide of exactly `period` pixels is a step of
 * exactly one pixel. Same speed, same distance, same loop — at six pixels a
 * second it is a step every sixth of a second — and every frame lands on the
 * grid.
 *
 * WHICH HALF OF THAT MATTERS, measured at twelve boards, frames per 900ms:
 *
 *   a continuous slide              31.0     (43% dropped)
 *   steps of exactly one pixel      34.0     (37%)
 *   steps of two thirds of a pixel  31.4     (42%)
 *   steps of one and a half pixels  31.3     (42%)
 *   steps of exactly two pixels     35.2     (35%)
 *   not sliding at all              34.3     (37%)
 *
 * Read the two fractional rows. More steps than one-pixel gives back
 * nothing; fewer steps than one-pixel gives back nothing. It is not the
 * stepping, it is the alignment — and aligned, a sliding layer costs what a
 * still one costs.
 *
 * AND WHAT IT BOUGHT, paired on one machine, the pane at 1191:
 *
 *                            ground on      ground off    the ground's share
 *   a continuous slide      31.3  (42%)    40.9           9.6 frames
 *   steps of one pixel      34.3  (36%)    41.8           7.5 frames
 *
 *   node tests/ground-drift.mjs [url]     # default http://localhost:3000
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const src = readFileSync("src/features/studio/ground.ts", "utf8");
const dark = readFileSync("src/features/studio/darkMatter.ts", "utf8");

/* ------------------------------------------------------------------ */
/* 1. The slide is a whole number of pixels, in whole-pixel steps       */
/* ------------------------------------------------------------------ */

check("the cloud slides in steps rather than continuously",
  /ground-drift \$\{secs\}s steps\(\$\{Math\.round\(period\)\}, end\) infinite/.test(src));
/*
 * The step count has to equal the distance in pixels, or the step is not a
 * pixel. `--gx` is the distance and the step count is the same number.
 */
check("…and there are exactly as many steps as there are pixels to cross", (() => {
  const gx = /setProperty\("--gx", `\$\{(\w+)\}px`\)/.exec(src)?.[1];
  const steps = /steps\(\$\{Math\.round\((\w+)\)\}, end\)/.exec(src)?.[1];
  return !!gx && gx === steps;
})());
/*
 * A period of 1024.5 would put every other step back between the pixels and
 * quietly give all of this away, so the whole-number-ness is a requirement
 * rather than a coincidence that happens to hold today.
 */
check("…and the distance is a whole number of pixels by construction",
  /Math\.max\(1024, Math\.ceil\(\(w \* FIELD_ROOM\) \/ FIELD_STEP\) \* FIELD_STEP\)/.test(dark));
check("the speed is unchanged: the same pixels a second over the same period",
  /const secs = Math\.round\(period \/ DRIFT_PX_S\);/.test(src) && /const DRIFT_PX_S = 6;/.test(src));
check("…and why it is done is written where the code is",
  /IT SLIDES A WHOLE PIXEL AT A TIME/.test(src) && /steps of two thirds of a pixel  31\.4/.test(src));

/* ------------------------------------------------------------------ */
/* 2. On the screen: still moving, and never between pixels            */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

if (live) {
  const { chromium } = await import("playwright-core");
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1039, height: 1278 } });
  await p.goto(`${url}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);

  const where = () => p.evaluate(() => {
    const c = document.querySelector("[data-ground-clouds] canvas");
    if (!c) return null;
    return +new DOMMatrixReadOnly(getComputedStyle(c).transform).m41.toFixed(3);
  });
  const seen = [];
  for (let i = 0; i < 12; i++) { seen.push(await where()); await p.waitForTimeout(250); }
  await b.close();

  check("there is a cloud layer to read", seen.every((v) => v !== null), seen.slice(0, 3).join(", "));
  check("every position it is caught at is a whole pixel",
    seen.every((v) => Number.isInteger(v)), seen.join(", "));
  /*
   * And it has not been quietly stopped in the name of making it cheap: over
   * three seconds at six pixels a second it should have moved about eighteen,
   * and each sample a quarter of a second apart should be one or two.
   */
  const moved = Math.abs(seen[seen.length - 1] - seen[0]);
  check("…and it is still moving, at the speed it always moved", moved >= 10 && moved <= 30,
    `${moved}px over three seconds, against the 18 that six a second makes`);
  const steps = seen.slice(1).map((v, i) => Math.abs(v - seen[i]));
  check("…a pixel or two at a time, which is what a sixth of a second at that speed is",
    steps.every((d) => d <= 3), steps.join(", "));
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
