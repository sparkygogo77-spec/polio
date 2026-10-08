/**
 * Where vines cross, one goes over the other. It does not go muddy.
 *
 * HIS WORDS: overlapping colours on the vines. A pile of crossings comes out
 * murkier than any vine in it, and a vine that passes behind another loses
 * its colour where it goes.
 *
 * IT IS THE SHADOW, NOT THE COLOUR. Every vine strokes a dark shadow under
 * itself, a sixth wider than its body, so it sits on the ground rather than
 * floating. Each vine paints itself whole, one after another, so a vine
 * drawn later lays its shadow ACROSS the body of one drawn earlier — and the
 * shadow is nearly black. Two crossings and the pile is darker than anything
 * in it.
 *
 * The fix is the order, not the colour: every shadow first, then every body.
 * A shadow then falls only on the ground, which is what a shadow is for, and
 * a crossing shows one vine cleanly over another.
 *
 * Measured on a bare canvas, because the fault is in the painting: a bar,
 * then a second bar crossing it, both ways round.
 *
 *   node tests/vine-crossing.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

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

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.goto("about:blank");

const read = await page.evaluate(() => {
  const SHADOW = "#0a120c";
  const BODY = "#4ec47a";
  /** Two bars at right angles. `together` paints shadows first, then bodies. */
  const paint = (together) => {
    const c = document.createElement("canvas");
    c.width = 100; c.height = 100;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.fillStyle = "#101014"; g.fillRect(0, 0, 100, 100);
    const shadow = (fn) => { g.strokeStyle = SHADOW; g.lineWidth = 14; fn(); };
    const body = (fn) => { g.strokeStyle = BODY; g.lineWidth = 12; fn(); };
    const across = () => { g.beginPath(); g.moveTo(0, 50); g.lineTo(100, 50); g.stroke(); };
    const down = () => { g.beginPath(); g.moveTo(50, 0); g.lineTo(50, 100); g.stroke(); };
    if (together) { shadow(across); shadow(down); body(across); body(down); }
    else { shadow(across); body(across); shadow(down); body(down); }
    const at = (x, y) => { const d = g.getImageData(x, y, 1, 1).data; return d[1]; };
    /*
     * Along the first bar rather than at a pixel somebody guessed.
     *
     * The first draft sampled eight pixels from the crossing, which is
     * outside the other bar's shadow — it spans seven either side — and
     * reported nothing wrong. So the whole approach is walked and the
     * darkest point on the first bar anywhere near the crossing is taken,
     * which is where a shadow laid over it would be.
     */
    let darkest = 255;
    for (let x = 36; x <= 64; x++) darkest = Math.min(darkest, at(x, 50));
    return { clear: at(12, 50), beside: darkest, crossing: at(50, 50) };
  };
  return { apart: paint(false), together: paint(true) };
});

const lost = read.apart.clear - read.apart.beside;
check(
  "painted one vine at a time, a later vine's shadow lands on an earlier vine's body",
  lost > 20,
  `the first bar reads ${read.apart.clear} in the clear and ${read.apart.beside} beside the crossing — ${lost} darker`,
);
check(
  "every shadow first and every body after, and it does not",
  read.together.clear - read.together.beside <= 2,
  `${read.together.clear} in the clear against ${read.together.beside} beside the crossing`,
);
check(
  "and the crossing still shows the vine on top, rather than a blend of the two",
  read.together.crossing >= read.together.clear - 2,
  `the crossing reads ${read.together.crossing} against ${read.together.clear} in the clear`,
);

/* And the painter does it in that order. */
const timeline = ["Timeline.tsx", ...["layout.tsx", "Timeline.tsx", "vines.ts", "IterationBox.tsx", "pieces.tsx", "cards.tsx"].map((f) => `timeline/${f}`)].map((f) => readFileSync(`src/features/studio/loop/${f}`, "utf8")).join("\n");
check(
  "the timeline lays every shadow down before any body",
  /shadowsFirst|\{ shadow: true \}|pass: "shadow"/.test(timeline),
  /pass: "shadow"/.test(timeline) ? "two passes" : "still one vine at a time, shadow and body together",
);

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
