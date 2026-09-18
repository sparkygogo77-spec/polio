/**
 * The surface inside a drawn space falls away smoothly, not in rings.
 *
 * HIS WORDS: contour bands in a drawn space. The shadow that takes the
 * surface down to black as it nears the edge was laid as eight strokes of
 * the same path, each narrower and darker than the last. Eight strokes are
 * eight hard edges: the alpha goes up a step at each one and holds flat
 * between, which is a contour map, and that is what he can see.
 *
 * So what is measured is the profile from the edge inward: walk in from the
 * line and read the brightness at every pixel. A smooth falloff never stands
 * still and never jumps; a staircase does both, and the size of its largest
 * jump is the thing to drive down.
 *
 *   node tests/space-falloff.mjs
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The band list as it ships, read off the painter so this cannot drift. */
const { readFileSync } = await import("node:fs");
const src = readFileSync("src/features/studio/blackHole.ts", "utf8");
const listed = src.match(/const bands: \[number, number\]\[\] = \[(.+?)\];/s);
const generated = /for \(let i = 0; i < BANDS_IN; i\+\+\)/.test(src);


const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
await page.goto("about:blank");

/**
 * Paint a disc's falloff with a given set of bands and walk in from the edge.
 *
 * A circle rather than a scribble: the profile is then the same on every
 * approach, so what the walk finds is the banding and not the shape.
 */
const profile = await page.evaluate(async (bandsSrc) => {
  const R = 150;
  const run = (bands) => {
    const c = document.createElement("canvas");
    c.width = 400; c.height = 400;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.fillStyle = "#6a6a72"; g.fillRect(0, 0, 400, 400);
    const trace = () => { g.beginPath(); g.arc(200, 200, R, 0, Math.PI * 2); g.closePath(); };
    g.save();
    trace(); g.clip();
    g.lineJoin = "round";
    for (const [share, a] of bands) {
      g.strokeStyle = `oklch(0.01 0.005 290 / ${a})`;
      g.lineWidth = Math.max(2, R * share * 2);
      trace(); g.stroke();
    }
    g.restore();
    /* In from the edge along one radius. */
    const walk = [];
    for (let d = 1; d < R - 4; d++) walk.push(g.getImageData(200 + (R - d), 200, 1, 1).data[0]);
    return walk;
  };
  /*
   * A CONTOUR RING IS A PLATEAU FOLLOWED BY A STEP.
   *
   * The first draft of this counted the biggest jump and the longest flat
   * run, and both misled: the steepest place in a smooth falloff is at the
   * line itself, where it is meant to be steep, and the longest flat run is
   * the middle of the space where no shadow reaches at all \u2014 which is the
   * surface, not a ring. So a ring is counted only where the walk stands
   * still for a few pixels and THEN steps, and the last stretch is left out
   * because that is the surface.
   */
  const worst = (walk) => {
    let rings = 0, step = 0, run = 0, steepest = 0;
    for (let i = 1; i < walk.length; i++) {
      const d = Math.abs(walk[i] - walk[i - 1]);
      steepest = Math.max(steepest, d);
      if (d === 0) { run++; continue; }
      if (run >= 3 && d >= 3 && i < walk.length - 20) { rings++; step = Math.max(step, d); }
      run = 0;
    }
    return { rings, step, steepest };
  };
  const eight = [[0.5, 0.1], [0.4, 0.12], [0.3, 0.15], [0.22, 0.19], [0.16, 0.24], [0.11, 0.3], [0.07, 0.4], [0.04, 0.55]];
  const many = JSON.parse(bandsSrc);
  return { eight: worst(run(eight)), many: worst(run(many)) };
}, JSON.stringify(
  /* The same curve, in many more steps: each band's share and alpha read off
     a continuous function of how far in it is, rather than off a list. */
  /* The curve the painter now uses, kept the same shape here on purpose. */
  Array.from({ length: 48 }, (_, i) => {
    const t = i / 48;
    return [0.5 * (1 - t), 0.04 + 0.14 * t];
  }),
));

check(
  "eight bands ring the surface, one ring a band",
  profile.eight.rings >= 6,
  `${profile.eight.rings} rings, the worst a step of ${profile.eight.step} in 255`,
);
check(
  "the curve the painter uses now rings it nowhere",
  profile.many.rings === 0,
  `${profile.many.rings} rings, and the steepest place in the whole run is ${profile.many.steepest} in 255`,
);
check(
  "and the painter reads its bands off that curve rather than a list",
  generated && !listed,
  generated ? `${(src.match(/const BANDS_IN = (\d+)/) ?? [])[1]} bands, generated` : "still a written list of eight",
);

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
