/**
 * A tap is not traced, and not paid for.
 *
 * A one-point stroke (a tap is kept as two identical points so it still
 * draws) has no outline; the ink mask saw a zero-width box and gave up; the
 * target fell to the whole box; and the tracer was paid three times, about
 * $0.08 a go, to draw a dot and be scored at about 1%. Row C5. The tracer
 * now asks `isTap` first and answers with a sentence and a cost of 0.
 *
 *   node tests/tap-not-traced.mjs
 */
import { readFileSync } from "node:fs";
import { isTap, TAP_SIZE, tidyStroke } from "../src/features/studio/pictures/sketch.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const tap = tidyStroke([[0.5, 0.5]]);
check("a tap is kept as two points so it draws", tap.length === 2 && tap[0][0] === tap[1][0]);
check("and is a tap", isTap([tap]));
check("a scribble no wider than a dot is a tap too", isTap([[[0.5, 0.5], [0.504, 0.503], [0.5, 0.506]]]), `${TAP_SIZE * 100}% of the board a side`);
check("a drawn line is not", !isTap([[[0.2, 0.5], [0.6, 0.5]]]));
check("a tall thin line is not either", !isTap([[[0.5, 0.2], [0.5, 0.6]]]));
check("nothing drawn at all is a tap", isTap([]));
check("a tap beside a real stroke is a drawing", !isTap([tap, [[0.1, 0.1], [0.4, 0.4]]]));

const run = readFileSync("src/features/studio/pictures/drawRun.ts", "utf8");
const before = run.indexOf("isTap(input.strokes)");
const loop = run.indexOf("for (let n = 1; n <= MAX_TRACES");
check("the tracer asks before it pays", before > 0 && loop > before, `isTap at ${before}, the paid loop at ${loop}`);
check("and answers with no cost and a reason", /cost: 0, ms: Date\.now\(\) - from, calls: 0, renderer: 0/.test(run) && /reason: "no-drawing"/.test(run));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
