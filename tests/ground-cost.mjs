/**
 * WHAT THE GROUND COSTS AT A GIVEN PANE SIZE. It changes nothing.
 *
 * The shelf moved in and the pane went from 1039x943 to 1039x1191 — a quarter
 * more ground generated, drawn and damaged every frame — and the question was
 * what that costs before anybody edits the paint. This answers it, and it can
 * be re-run for the next pane size rather than argued about.
 *
 * TWO THINGS IT HAD TO GET RIGHT, both of which the obvious approach gets
 * wrong:
 *
 *   · **The ground has to be really generated at each size.** Clipping the
 *     host to each height measures nothing at all — 33.1 frames per 900ms
 *     against 32.1 — because the cloud and the spark canvases keep their own
 *     width and height and go on painting all of it. So it opens a page per
 *     size.
 *   · **One page at a time.** Two pages open at once means two grounds
 *     running, and the one that is not in front still animates: measured that
 *     way the same pair came out 18.0 and 16.7, which is a reading of a
 *     machine carrying both.
 *
 * WHAT IT SAID, at twelve boards on this container, three passes a cell,
 * interleaved so the container's own drift falls on every cell equally:
 *
 *                      ground on        ground off
 *     pane  943      40.0  (26%)      54.0  (0%)
 *     pane 1191      31.9  (41%)      49.6  (8%)
 *
 *   · **The pane change costs eight frames**, 26% of frames dropped to 41%.
 *   · **About half of that is the ground and half is the timeline.** With the
 *     ground hidden the same pane change still costs 4.4 frames, because a
 *     taller pane is a bigger surface for the boards to be laid out on.
 *   · **The ground's own marginal cost went from 14.0 frames to 17.7** — the
 *     difference each row makes between ground on and ground off. That is 26%
 *     more, against 26% more pane: the area law, confirmed on the nose.
 *
 * The canvases grew with it: the cloud 1.73MP to 2.19MP, the sparks 0.76MP to
 * 0.97MP.
 *
 *   node tests/ground-cost.mjs [url]     # default http://localhost:3000
 *   N=30 node tests/ground-cost.mjs      # how many boards (default 12)
 *   A=943 Z=1191 node tests/ground-cost.mjs   # which two pane heights
 */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const s = readFileSync("tests/idle-cost.mjs", "utf8");
const seedSrc = s.slice(s.indexOf("const seed = (n) => {"), s.indexOf("const b = await chromium.launch"));
const seed = new Function("n", seedSrc.replace("const seed = (n) => {", "").replace(/\};\s*$/, ""));
const N = Number(process.env.N ?? 12), MS = Number(process.env.MS ?? 2400);
const A = Number(process.env.A ?? 943), Z = Number(process.env.Z ?? 1191);
const URL_ = process.argv[2] ?? "http://localhost:3000";
const START = `window.__f = []; (function l(){ window.__r = requestAnimationFrame((t) => { window.__f.push(t); l(); }); })();`;
const STOP = `cancelAnimationFrame(window.__r); (() => {
  const f = window.__f, d = [];
  for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
  const span = f.length > 1 ? f[f.length - 1] - f[0] : 0;
  return { per900: span ? +(d.length / span * 900).toFixed(1) : 0 };
})()`;

const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
const open = async (want) => {
  const p = await b.newPage({ viewport: { width: 1039, height: want + 87 } });
  await p.addInitScript(seed, N);
  await p.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  if (N > 0) { await p.locator("[data-finish]").first().click(); await p.waitForTimeout(2600); }
  const facts = await p.evaluate(() => {
    const g = document.querySelector("[data-workspace-ground]");
    const c = g?.querySelector("[data-ground-clouds] canvas");
    const sp = g?.querySelector("[data-ground-sparks]");
    const r = g.getBoundingClientRect();
    const px = (el) => (el ? el.width * el.height : 0);
    return { size: `${Math.round(r.width)}x${Math.round(r.height)}`,
      cloudMP: +(px(c) / 1e6).toFixed(2), sparkMP: +(px(sp) / 1e6).toFixed(2) };
  });
  return { p, facts };
};
/* One page at a time. Two open at once means two grounds running, and the
   page that is not in front still animates — the comparison would be of a
   machine carrying both. */
/* Four cells, because the pane getting taller is two things at once: more
   ground, and — since the timeline clamps its zoom to fit the boards — a
   larger card on a larger surface. Hiding the ground separates them. */
const runs = {};
const facts = {};
const take = async (want, off, key) => {
  const { p, facts: f } = await open(want);
  facts[key] = f;
  if (off) await p.evaluate(() => { const st = document.createElement("style"); st.textContent = "[data-workspace-ground]{display:none!important}"; document.head.append(st); });
  await p.waitForTimeout(800);
  await p.evaluate(START);
  await p.waitForTimeout(MS);
  const r = (await p.evaluate(STOP)).per900;
  const seen = await p.evaluate(() => {
    let area = 0;
    for (const el of document.querySelectorAll(".molten")) {
      const r2 = el.getBoundingClientRect();
      const w = Math.max(0, Math.min(innerWidth, r2.right) - Math.max(0, r2.left));
      const h = Math.max(0, Math.min(innerHeight, r2.bottom) - Math.max(0, r2.top));
      area += Math.max(0, w) * Math.max(0, h);
    }
    return +(area / (innerWidth * innerHeight) * 100).toFixed(0);
  });
  await p.close();
  (runs[key] ??= []).push(r);
  facts[key].cover = seen;
};
for (let pass = 0; pass < 3; pass++) {
  await take(A, false, `${A}, ground on`);
  await take(Z, false, `${Z}, ground on`);
  await take(A, true, `${A}, ground off`);
  await take(Z, true, `${Z}, ground off`);
}
console.log(`\n  ${N} boards\n`);
console.log(`  as it was   ground ${facts[`${A}, ground on`].size}   cloud ${facts[`${A}, ground on`].cloudMP}MP   sparks ${facts[`${A}, ground on`].sparkMP}MP   constructs over ${facts[`${A}, ground on`].cover}% of the pane`);
console.log(`  as it is    ground ${facts[`${Z}, ground on`].size}   cloud ${facts[`${Z}, ground on`].cloudMP}MP   sparks ${facts[`${Z}, ground on`].sparkMP}MP   constructs over ${facts[`${Z}, ground on`].cover}% of the pane\n`);
for (const [k, xs] of Object.entries(runs)) {
  const m = xs.reduce((s2, c) => s2 + c, 0) / xs.length;
  console.log(`  ${k.padEnd(20)}${m.toFixed(1).padStart(6)} /900ms   dropped ${String(Math.round((1 - m / 54) * 100)).padStart(3)}%   [${xs.join(", ")}]`);
}
await b.close();
