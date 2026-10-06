/**
 * Three complaints about a drawn part, held shut.
 *
 * 1. Colour on a drawn part did not respond when changed — said of a drawn
 *    diagonal. A traced drawing is one ink, near-black, and the body painter
 *    called near-black "text"; the wheel's "colour" is the accent; so the
 *    line ignored the person. A one-ink body now follows whichever of its
 *    own colours the person set.
 * 2. The selection round a drawing was a square. A straight diagonal snapped
 *    to its ends is two points and the outline asked for three, so the part
 *    had no outline, and so no mark along the line and an aura on the box.
 * 3. A made real part filled the screen. A drawing off the disc carried no
 *    size — the strokes are fractions of the disc — so the fallback was a
 *    band across the page. The disc's pixels and the zoom give the size, and
 *    where the ink sat on the disc gives the place.
 *
 *   node tests/drawn-part.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { paintRoles, rolesFor, inksOf } from "../src/features/studio/bodyPaint.ts";
import { discLanding, outlinePath } from "../src/features/studio/sketch.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. Colour                                                           */
/* ------------------------------------------------------------------ */

const line = '<svg viewBox="0 0 200 120"><path d="M10 110 L190 10" fill="none" stroke="#111111" stroke-width="6"/></svg>';
check("a traced line is one ink", inksOf(line).length === 1);
check("read on its own, near-black is text — right for a body with several colours", rolesFor(inksOf(line)).get("#111111") === "text");
check("with nothing set on the part it still reads as text, so nothing already on a board changes", /var\(--part-text, #111111\)/.test(paintRoles(line)));
check("turn the accent on that part, and the line is the accent", /var\(--part-accent, #111111\)/.test(paintRoles(line, { prefer: ["accent"] })));
check("turn the text, and it is the text", /var\(--part-text, #111111\)/.test(paintRoles(line, { prefer: ["text"] })));
check("set two, and the one a person means by \"the colour\" wins", /var\(--part-accent, #111111\)/.test(paintRoles(line, { prefer: ["accent", "text"] })));
const two = '<svg><rect fill="#ffffff"/><path stroke="#111111"/></svg>';
check("a body with more than one ink keeps the reading: ground and ink, whatever is set",
  /var\(--part-bg, #ffffff\)/.test(paintRoles(two, { prefer: ["accent"] })) && /var\(--part-text, #111111\)/.test(paintRoles(two, { prefer: ["accent"] })));
check("never the ground: a line that took its own background's colour would vanish into it", (() => {
  const src = readFileSync("src/features/studio/blocks.tsx", "utf8");
  return !/\["accent", "text", "muted", "bg"\]/.test(src);
})());
check("painting is still reversible", paintRoles(paintRoles(line, { prefer: ["accent"] }), { prefer: ["text"] }).includes("var(--part-text, #111111)"));
check("the board hands the part's own colours over, the accent first", (() => {
  const src = readFileSync("src/features/studio/blocks.tsx", "utf8");
  return /\(\["accent", "text", "muted"\] as const\)\.filter\(\(r\) => !!node\.colour\?\.\[r\]\)/.test(src) && /paintRoles\(node\.code!\.html, \{ prefer: own \}\)/.test(src);
})());

/* ------------------------------------------------------------------ */
/* 2. The selection wraps the line                                      */
/* ------------------------------------------------------------------ */

const diagonal = { strokes: [[[0.05, 0.95], [0.95, 0.05]]], words: "" };
const clip = outlinePath(diagonal);
check("a straight diagonal of two points has an outline", !!clip, clip ? `${clip.points} points` : "null");
check("it is open: a band along the stroke, not a box", !!clip && !clip.closed && clip.cut !== clip.d && clip.encloses === 0);
check("the band has enough of an edge for the handles to sit on", !!clip && (clip.cut.match(/[ML]/g) ?? []).length >= 4);
check("a dot is still nothing", outlinePath({ strokes: [[[0.5, 0.5]]], words: "" }) === null);
check("the board marks the selection along the outline when there is one, and puts the aura on the shape", (() => {
  const src = ["Canvas.tsx", ...readdirSync("src/features/studio/canvas").map((f) => `canvas/${f}`)].map((f) => readFileSync(`src/features/studio/${f}`, "utf8")).join("\n");
  return /const hugs = React\.useMemo\(\(\) => \(node\.outline\?\.cut \? handlePoints\(node\.outline\.cut\) : null\)/.test(src)
    && /selected && hugs && node\.outline \?/.test(src) && /hugs \? \(\(auraFilter\(/.test(src);
})());

/* ------------------------------------------------------------------ */
/* 3. The size and the place it was drawn                              */
/* ------------------------------------------------------------------ */

// A mark a fifth of the disc wide and a tenth tall, in its top-left, on a
// 360px disc at zoom 1, opened at (500, 400).
const small = [[[0.1, 0.1], [0.3, 0.1], [0.3, 0.2]]];
const landed = discLanding(small, { x: 500, y: 400 }, 360, 1);
check("a small mark lands small: the disc's pixels, not the page's width", landed.drawn?.w === 72 && landed.drawn?.h === 36, JSON.stringify(landed.drawn));
check("and where it sat on the disc, relative to where the disc was opened", landed.at && Math.round(landed.at.x) === 500 + Math.round((0.2 - 0.5) * 360) && Math.round(landed.at.y) === 400 + Math.round((0.15 - 0.5) * 360), JSON.stringify(landed.at));
check("zoomed in, the same mark is the same page size: screen pixels over the zoom", discLanding(small, null, 360, 2).drawn?.w === 36);
check("reshaping a part that has a place keeps the place", discLanding(small, null, 360, 1).at === null);
check("nothing drawn, nothing sized", discLanding([], { x: 1, y: 1 }, 360, 1).drawn === null);
check("the disc queues the size and the place it worked out", (() => {
  const src = readFileSync("src/features/studio/DrawBoard.tsx", "utf8");
  return /const landing = discLanding\(drawn\.strokes, at, size, useStudio\.getState\(\)\.zoom \|\| 1\);/.test(src)
    && /at: landing\.at,/.test(src) && /\.\.\.\(landing\.drawn \? \{ drawn: landing\.drawn \} : \{\}\),/.test(src);
})());
check("…and the run keeps a drawn size unless the drawing was made across the page", (() => {
  const src = readFileSync("src/features/studio/reshape.ts", "utf8");
  return /const drewWide = drawnSize!\.w >= frameWidth \* FULL_BLEED;/.test(src) && /keptSize = nw !== w \|\| nh !== h;/.test(src);
})());

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} failed of ${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
