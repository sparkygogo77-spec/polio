/**
 * THIRTY THINGS ALIGHT, NOT ONE MACHINE.
 *
 * Every construct runs the same keyframes; what makes a screen of them read
 * as separate things is the share each one takes of those keyframes. The
 * note was that they did not take separate shares — individually good,
 * together one rhythm, which reads as a loop rather than as life.
 *
 * Two causes, and the second is the one worth remembering.
 *
 *   · `Row` defaulted its seed to the constant "row", so every box in a
 *     panel that did not think to pass one got the identical share. Two
 *     neighbours measured 0.99 correlation between their motion: not alike,
 *     the same animation twice.
 *   · And phase alone would not have saved it anyway. A loop started at a
 *     different moment is the same loop. Pace, heading and where in the tile
 *     a face starts are what make two constructs different things.
 *
 * The measure is the real screen, not the stylesheet: two shots a beat
 * apart, the difference between them per box — that box's motion for that
 * beat, as a picture — reduced to a common grid so boxes of different sizes
 * can be compared at all, then the correlation between each box and the one
 * next to it. One machine is 1.0.
 *
 * And the measure checks itself. With the dials forced back to one value it
 * has to *see* the old behaviour return, or it is not measuring anything.
 *
 *   node tests/not-one-machine.mjs [url]     # default http://localhost:3000
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const ts = readFileSync("src/core/ui/molten.ts", "utf8");
const css = readFileSync("src/core/ui/molten.css", "utf8");
const detail = readFileSync("src/features/studio/TimelineDetail.tsx", "utf8");

/* ------------------------------------------------------------------ */
/* 1. Four dials off one number, and none of them a new mechanism      */
/* ------------------------------------------------------------------ */

const seedFn = ts.slice(ts.indexOf("export function moltenSeed("), ts.indexOf("export function moltenSeed(") + 900);
for (const [dial, what] of [
  ["--molten-seed", "the phase"],
  ["--mo-pace", "the rate"],
  ["--mo-way", "the heading"],
  ["--mo-shift", "where in the tile it starts"],
]) {
  check(`a construct gets ${what} of its own (${dial})`, seedFn.includes(`"${dial}"`));
  check(`…and the stylesheet reads it`, new RegExp(`var\\(${dial}`).test(css) || css.includes(`var(${dial})`));
}
check("the rate is a real spread, not a rounding of one number", (() => {
  const m = /0\.82 \+ \(n % (\d+)\) \* 0\.06/.exec(seedFn);
  return !!m && Number(m[1]) >= 5;
})());
/*
 * The heading is a claim about neighbours, and a hash knows nothing about
 * who its neighbours are — so a list passes the index and consecutive items
 * alternate whatever their ids hash to.
 */
check("a list can guarantee its neighbours differ rather than hope they do",
  /moltenSeed\(from: string \| number, at\?: number\)/.test(ts) && /const turn = at \?\? n;/.test(ts));
check("…and reversing a construct reverses both its layers, so the two stay opposed inside it",
  (css.match(/animation-direction: var\(--mo-way, normal\);/g) ?? []).length === 2);
/*
 * A default that makes a column of constructs one sheet is worse than a
 * compile error, which is what it is now.
 */
check("no construct can take a share by accident: the seed is required", /\n  seed: string;/.test(detail) && !/seed = "row"/.test(detail));
/*
 * The rate is a multiplier, so the floor moves with it: the slowest share is
 * 1.18 and the fastest 0.82, and nothing here may end up faster than the nine
 * seconds the surface's own rules set. Written rates are checked in
 * `molten.mjs`; this is the same rule after the dial has had its way.
 */
check("…and the fastest share of the fastest motion is still slower than nine seconds", (() => {
  const floor = Number(/0\.82 \+/.exec(seedFn) ? 0.82 : NaN);
  const runs = [...css.matchAll(/animation:\s*molten-[a-z]+\s+([\d.]+)s/g)].map((m) => Number(m[1]));
  return runs.length > 0 && !Number.isNaN(floor) && Math.min(...runs) * floor >= 9;
})(), (() => {
  const runs = [...css.matchAll(/animation:\s*molten-[a-z]+\s+([\d.]+)s/g)].map((m) => Number(m[1]));
  return `fastest written ${Math.min(...runs)}s, at 0.82 of it ${(Math.min(...runs) * 0.82).toFixed(1)}s`;
})());

/* ------------------------------------------------------------------ */
/* 2. On the screen                                                    */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

if (live) {
  const { chromium } = await import("playwright-core");
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  await p.goto(`${url}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await p.locator("[data-updates-toggle]").first().click();
  await p.waitForTimeout(1400);

  const boxes = await p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("[data-updates-panel] section.molten")) {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight || r.width < 40 || r.height < 40) continue;
      out.push({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return out;
  });

  /* Each box's motion over one beat, on a common grid, then neighbour
     against neighbour. */
  const FIELDS = async ([as, bs]) => {
    const load = async (s) => { const i = new Image(); i.src = "data:image/png;base64," + s; await i.decode(); return i; };
    const GW = 48, GH = 16, out = [];
    for (let k = 0; k < as.length; k++) {
      const [i1, i2] = [await load(as[k]), await load(bs[k])];
      const grab = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
        const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height); };
      const [d1, d2] = [grab(i1), grab(i2)];
      const cell = new Float64Array(GW * GH);
      for (let y = 0; y < d1.height; y++) for (let x = 0; x < d1.width; x++) {
        const i = (d1.width * y + x) << 2;
        cell[Math.min(GH - 1, (y / d1.height * GH) | 0) * GW + Math.min(GW - 1, (x / d1.width * GW) | 0)]
          += (d2.data[i] - d1.data[i]) + (d2.data[i + 1] - d1.data[i + 1]) + (d2.data[i + 2] - d1.data[i + 2]);
      }
      out.push([...cell]);
    }
    return out;
  };
  const corr = (u, v) => {
    const n = u.length;
    const mu = u.reduce((s, x) => s + x, 0) / n, mv = v.reduce((s, x) => s + x, 0) / n;
    let a = 0, c = 0, d = 0;
    for (let i = 0; i < n; i++) { const q = u[i] - mu, r = v[i] - mv; a += q * r; c += q * q; d += r * r; }
    return c && d ? a / Math.sqrt(c * d) : 0;
  };
  const run = async () => {
    const shot = async (bx) => (await p.screenshot({ clip: bx.w ? { x: bx.x, y: bx.y, width: bx.w, height: bx.h } : bx })).toString("base64");
    const A = [];
    for (const bx of boxes) A.push(await shot(bx));
    await p.waitForTimeout(500);
    const B = [];
    for (const bx of boxes) B.push(await shot(bx));
    const fields = await p.evaluate(FIELDS, [A, B]);
    const pairs = [];
    for (let i = 1; i < fields.length; i++) pairs.push(corr(fields[i - 1], fields[i]));
    return { mean: pairs.reduce((s, x) => s + x, 0) / Math.max(1, pairs.length), worst: Math.max(...pairs), n: pairs.length };
  };

  check("there are boxes side by side to read", boxes.length >= 4, `${boxes.length} on screen`);
  const now = await run();
  check("no box moves like the box next to it", now.mean < 0.3,
    `mean ${now.mean.toFixed(3)} across ${now.n} pairs`);
  check("…and not one pair of them is running the same animation", now.worst < 0.6,
    `the closest pair is ${now.worst.toFixed(3)}`);

  /*
   * And the instrument is not blind. Forced back to one share — one phase,
   * one pace, one heading, one place in the tile — the old reading has to
   * come back, or this measures nothing and passing it means nothing.
   */
  await p.addStyleTag({ content: "[data-updates-panel] section.molten{--molten-seed:42!important;--mo-pace:1!important;--mo-way:normal!important;--mo-shift:0px!important}" });
  await p.waitForTimeout(700);
  const one = await run();
  check("the measure can see one machine when there is one: forced to a single share, it comes back",
    one.mean > now.mean + 0.25 && one.worst > 0.8,
    `forced: mean ${one.mean.toFixed(3)}, closest pair ${one.worst.toFixed(3)} — against ${now.mean.toFixed(3)} and ${now.worst.toFixed(3)}`);
  await b.close();
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
