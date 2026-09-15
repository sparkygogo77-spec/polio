/**
 * Several open lines describe a shape; they are not an edge to cut to (inventory C6).
 *
 * An open stroke becomes a band along itself, so a drawn spiral or diagonal
 * is cut to its own line. That was applied to every open drawing: three bars
 * drawn for a list took the band along the *longest* bar alone, in that
 * bar's own box (a straight bar is a box a few thousandths tall, so the
 * band was noise), laid over a part sized to *all three*. The list landed
 * as a sliver. Now:
 *
 *   · more than one open line cuts nothing: the drawing says a shape, and
 *     the part is its box;
 *   · one straight bar cuts nothing either: its box is the bar;
 *   · one open line with some body to it, a diagonal or a spiral, is still
 *     a band along itself.
 *
 *   node tests/open-lines.mjs
 */
import { CLIP_STROKE, outlinePath, sketchBox } from "../src/features/studio/sketch.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const bar = (y, x0 = 0.2, x1 = 0.8) => Array.from({ length: 12 }, (_, i) => [x0 + ((x1 - x0) * i) / 11, y + (i % 2 ? 0.001 : -0.001)]);
const bars = { strokes: [bar(0.3), bar(0.5, 0.2, 0.75), bar(0.7, 0.2, 0.7)], words: "" };
const one = { strokes: [bar(0.5)], words: "" };
const diagonal = { strokes: [[[0.05, 0.95], [0.95, 0.05]]], words: "" };
const spiral = { strokes: [Array.from({ length: 80 }, (_, i) => { const t = i / 79; const a = t * Math.PI * 6; const r = 0.05 + t * 0.4; return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]; })], words: "" };

/* What a cut spans, in the part's box: the y-extent of the band's path. */
const spanY = (clip) => {
  const ys = [...(clip?.cut ?? "").matchAll(/[ML] ([\d.]+) ([\d.]+)/g)].map((m) => Number(m[2]));
  return ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
};

/* 1. Three bars for a list. */
const whole = sketchBox(bars.strokes);
check("three bars span a box with height to it", whole && whole.h > 0.35, `${whole?.w.toFixed(2)} × ${whole?.h.toFixed(2)}`);
const listClip = outlinePath(bars);
check("and cut nothing: the part is its box, not a band along the longest bar", listClip === null, listClip ? `a ${listClip.closed ? "closed" : "open"} cut of ${listClip.points} points, spanning ${spanY(listClip).toFixed(2)} of the part's height` : "no cut");

/* 2. One straight bar. */
const barBox = sketchBox(one.strokes);
check("a straight bar is a box a few thousandths tall", barBox && barBox.h < 0.01, `${barBox?.h.toFixed(3)} tall`);
const barClip = outlinePath(one);
check("and cuts nothing: its box is the bar", barClip === null, barClip ? `a cut of ${barClip.points} points spanning ${spanY(barClip).toFixed(2)} of the part's height, noise off a ${barBox?.h.toFixed(3)} box` : "no cut");

/* 3. One open line with body to it is still a band along itself. */
const diag = outlinePath(diagonal);
check("a diagonal is still a band along the stroke", !!diag && !diag.closed && diag.width === CLIP_STROKE && diag.cut !== diag.d, diag ? `${diag.points} points` : "null");
const sp = outlinePath(spiral);
check("a spiral is still a band along the stroke", !!sp && !sp.closed && sp.cut.split(" L ").length > 20, sp ? `${sp.points} points` : "null");

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
