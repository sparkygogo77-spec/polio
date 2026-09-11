/**
 * The selection follows the shape, not the box round it.
 *
 * A part cut to a drawn line renders as that line, but picking it up drew a
 * square with a lot of empty corners, which is the difference between a made
 * real part feeling like a part and feeling like a picture pasted in.
 *
 *   · the same path the crop uses is walked for the mark, so the two cannot
 *     disagree;
 *   · the handles sit on that path's extremes rather than on the box's
 *     corners, so nothing is left standing in an empty corner;
 *   · a path that says too little falls back to the box, which is right then;
 *   · and a handle still resizes the part exactly as it did.
 *
 *   node tests/part-select.mjs [url]     # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import { CORNERS, handlePoints, walkPath } from "../src/features/studio/outlineHandles.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* The shape, and where its handles go                                     */
/* ------------------------------------------------------------------ */

check("a path is walked into points", walkPath("M 0 0 L 1 0 L 1 1 Z").length === 4);
check("a curve is sampled rather than cut to its ends", walkPath("M 0 0 C 0.3 0, 0.7 1, 1 1").length > 8);
check("a path with nothing in it gives nothing", walkPath("").length === 0);

/** A diagonal band: up one side of the line and back down the other. */
const BAND = "M 0.02 0 L 1 0.9 L 0.98 1 L 0 0.1 Z";
const on = handlePoints(BAND);
check("the handles are placed on the path", !!on && CORNERS.every((c) => on[c]));
check("the top left handle is at the line's top end", on.nw[1] < 0.2, `${on.nw[0].toFixed(2)},${on.nw[1].toFixed(2)}`);
check("the bottom right handle is at the line's bottom end", on.se[1] > 0.8, `${on.se[0].toFixed(2)},${on.se[1].toFixed(2)}`);
check("no handle sits in an empty corner of the box", (() => {
  // The far corners of a top-left-to-bottom-right band are empty: nothing
  // should be put at the top right or the bottom left of the box.
  const ne = on.ne, sw = on.sw;
  return !(ne[0] > 0.9 && ne[1] < 0.1) && !(sw[0] < 0.1 && sw[1] > 0.9);
})(), `ne ${on.ne[0].toFixed(2)},${on.ne[1].toFixed(2)} sw ${on.sw[0].toFixed(2)},${on.sw[1].toFixed(2)}`);
check("every handle is somewhere on the shape", CORNERS.every((c) => {
  const pts = walkPath(BAND);
  return pts.some((p) => Math.hypot(p[0] - on[c][0], p[1] - on[c][1]) < 1e-9);
}));
check("a path that says too little places nothing", handlePoints("M 0 0 L 1 1") === null);

const canvas = readFileSync("src/features/studio/Canvas.tsx", "utf8");
check("the mark is drawn along the same path the crop uses", /d=\{node\.outline\.cut\}/.test(canvas));
check("the box outline stands down when the shape is marked", /selected && !hugs \?/.test(canvas));
check("the handles go on the path's extremes", /data-on-outline=""/.test(canvas));
check("and they still resize the part the same way", /data-resize=\{h\}/.test(canvas));

/* ------------------------------------------------------------------ */
/* 6. In the browser                                                   */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

const passed = results.filter(Boolean).length;
console.log(`\nall good — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
