/**
 * A person can tell one category from another, and read the small print.
 *
 * J's report was that the row along the bottom had converged until the boxes
 * read as the same thing, and that the sameness had made some of the labels
 * hard to read. Both halves turned out to be true and neither was where I
 * first looked, so both are measured rather than eyeballed.
 *
 *   · **The small print failed AA.** Measured off the rendered page: twelve
 *     of the thirty-three words in the bottom row came in at 3.22:1, every
 *     one of them `fg-faint` — the count under each category, and the
 *     blurbs. The light theme's was 3.49:1. Both are under 4.5 for text this
 *     small, and that token carries most of the app's small print.
 *   · **The hues had drifted together.** Twelve categories picked one at a
 *     time: five pairs sat 20 degrees or less apart and the closest two were
 *     10 apart, which at this chroma is not a difference anybody can see.
 *
 * The first version of the contrast probe reported 1.00:1 for all nineteen
 * things it found, because it read colours with a regex for `rgb(` and every
 * one of them is written in `oklch` — so it scored white on black as black
 * on black and would have passed anything. The second read a button's own
 * colour for every word inside it, which is how the counts hid: they have a
 * colour of their own. This one reads leaves, through the project's own
 * `contrast`.
 *
 *   node tests/shelf-apart.mjs
 */
import { contrast, parseColor } from "../src/features/studio/look.ts";
import { CATEGORIES } from "../src/features/studio/catalog.ts";
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. Every category is its own colour                                 */
/* ------------------------------------------------------------------ */

const hues = CATEGORIES.map((c) => ({ id: c.id, label: c.label, hue: c.hue })).sort((a, b) => a.hue - b.hue);
/** The short way round the wheel between two hues. */
const apart = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
let worst = { gap: 360, pair: "" };
for (let i = 0; i < hues.length; i++) {
  const next = hues[(i + 1) % hues.length];
  const gap = apart(hues[i].hue, next.hue);
  if (gap < worst.gap) worst = { gap, pair: `${hues[i].label} ${hues[i].hue} and ${next.label} ${next.hue}` };
}
/* 30 apart is what twelve evenly spaced comes to. Below about 25 at this
   chroma two categories stop reading as two. */
check("no two categories are closer than a person can see", worst.gap >= 25,
  `closest are ${worst.pair}, ${worst.gap} apart`);
check("and they are spread all the way round rather than bunched",
  new Set(hues.map((h) => Math.floor(h.hue / 90))).size === 4,
  `quarters used: ${[...new Set(hues.map((h) => Math.floor(h.hue / 90)))].sort().join(", ")}`);

/* Every one of them still lands where it did, within a nudge: a category
   that changed colour family would have changed meaning. */
const WAS = { structure: 210, nav: 230, hero: 30, content: 60, media: 300, motion: 190,
  interact: 160, forms: 130, data: 265, social: 340, ai: 280, platform: 20 };
const moved = CATEGORIES.map((c) => ({ label: c.label, by: apart(c.hue, WAS[c.id] ?? c.hue) }))
  .filter((m) => m.by > 20);
check("and none of them changed colour family to get there", moved.length === 0,
  moved.length ? moved.map((m) => `${m.label} moved ${m.by}`).join(", ") : "nothing moved more than 20 degrees");

/* ------------------------------------------------------------------ */
/* 2. The small print clears AA                                        */
/* ------------------------------------------------------------------ */

const css = readFileSync("src/app/globals.css", "utf8");
/** One token's value out of a theme block. */
const tokenIn = (block, name) => {
  const b = css.slice(css.indexOf(block));
  const m = new RegExp(`--${name}:\\s*(oklch\\([^)]*\\))`).exec(b);
  return m ? m[1] : null;
};
/** The themes name their hue with a variable; the numbers are what matter. */
const solid = (v, hue) => parseColor(v.replace(/var\(--[a-z-]+\)/, String(hue)));

for (const [what, marker, hue, ground] of [
  ["the dark theme", ":root {", 288, ":root {"],
  ["the light theme", '[data-theme="light"]', 265, '[data-theme="light"]'],
]) {
  const faint = tokenIn(marker, "fg-faint");
  const bg = tokenIn(ground, "bg");
  if (!faint || !bg) { check(`${what} has a faint and a ground to compare`, false, `${faint} on ${bg}`); continue; }
  const r = contrast(solid(faint, hue), solid(bg, hue));
  check(`${what}'s small print clears AA against its own ground`, r >= 4.5,
    `${r.toFixed(2)}:1 — ${faint} on ${bg}`);
}

/* And it is still the quietest of the three, or it is not "faint". */
const faint = solid(tokenIn(":root {", "fg-faint"), 288);
const muted = solid(tokenIn(":root {", "fg-muted"), 288);
const full = solid(tokenIn(":root {", "fg"), 288);
check("faint is still quieter than muted, and muted than plain", faint.l < muted.l && muted.l < full.l,
  `${faint.l} < ${muted.l} < ${full.l}`);

console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
