/**
 * A column drawn taller than the ceiling keeps its proportion (inventory C8).
 *
 * A part is held to 1600 px tall, in three places, each written out as its
 * own number: the outline fit, the answer checker, and the landing of a
 * drawing. Each held the height alone and kept the width, so a tall thin
 * column drawn past the ceiling landed shorter and fatter than drawn, and
 * nothing said so. Now the ceiling is one number, and a part over it is
 * scaled to it on both sides, so the proportion the drawing said survives.
 *
 *   node tests/tall-column.mjs
 */
import { readFileSync } from "node:fs";
import { PART_MAX_H, fitToSketch, readSketch } from "../src/features/studio/sketch.ts";
import { checkAnswer } from "../src/features/studio/reshape.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const FRAME = 1440;
const kind = (id) => (id === "custom-idea" ? { id, name: "Idea", w: 132, h: 76, options: [] } : null);

/* 1. One ceiling, off the source. */
const files = ["src/features/studio/sketch.ts", "src/features/studio/reshape.ts", "src/features/studio/reshapeRun.ts"];
const literal = files.map((f) => [f, (readFileSync(f, "utf8").match(/\b1600\b/g) ?? []).length]);
check("the ceiling is written once, in sketch.ts, and the other two read it (source read)", literal.every(([f, n]) => n === (f.endsWith("sketch.ts") ? 1 : 0)), literal.map(([f, n]) => `${f.split("/").pop()} ${n}`).join(", "));
check("and it is 1600", PART_MAX_H === 1600, String(PART_MAX_H));

/* 2. A tall thin column: one closed box, a tenth as wide as it is tall. */
const column = { strokes: [[[0.45, 0.05], [0.55, 0.05], [0.55, 0.95], [0.45, 0.95], [0.45, 0.05]]], words: "" };
const aspect = readSketch(column).aspect;
check("the drawing is read a tenth as wide as tall", near(aspect, 1 / 9, 0.02), aspect.toFixed(3));

/* The outline fit, at an area that puts the height past the ceiling. */
const fit = fitToSketch(column, 800, 800, FRAME);
check("fitted at a large area it lands at the ceiling", fit.h === PART_MAX_H, `${fit.w} × ${fit.h}`);
check("and keeps the drawing's proportion, narrowed to match", near(fit.w / fit.h, aspect, 0.02), `${fit.w} × ${fit.h} is ${(fit.w / fit.h).toFixed(3)}, drawn ${aspect.toFixed(3)}`);

/* The answer checker, with the drawn size known and past the ceiling. */
const drawn = checkAnswer({ patch: { w: 200, h: 3200 }, node: null, drawn: column, aspect, outline: "box", frameWidth: FRAME, kind, drawnSize: { w: 200, h: 3200 } });
check("drawn 200 × 3200, the part lands at the ceiling", drawn.h === PART_MAX_H, `${drawn.w} × ${drawn.h}`);
check("and as thin as it was drawn", near(drawn.w / drawn.h, 200 / 3200, 0.01), `${drawn.w} × ${drawn.h} is ${(drawn.w / drawn.h).toFixed(3)}, drawn 0.063`);

/* The answer checker, with only the reader's numbers, in the drawing's proportion but past the ceiling. */
const answered = checkAnswer({ patch: { w: 400, h: 3600 }, node: null, drawn: column, aspect, outline: "box", frameWidth: FRAME, kind });
check("answered 400 × 3600 in the drawing's proportion, the part lands at the ceiling", answered.h === PART_MAX_H, `${answered.w} × ${answered.h}`);
check("in that proportion, not fattened by the cap", near(answered.w / answered.h, aspect, 0.02), `${answered.w} × ${answered.h} is ${(answered.w / answered.h).toFixed(3)}, drawn ${aspect.toFixed(3)}`);

/* Under the ceiling nothing changes. */
const short = checkAnswer({ patch: { w: 100, h: 900 }, node: null, drawn: column, aspect, outline: "box", frameWidth: FRAME, kind, drawnSize: { w: 100, h: 900 } });
check("a column under the ceiling lands at the size it was drawn", short.w === 100 && short.h === 900, `${short.w} × ${short.h}`);

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
