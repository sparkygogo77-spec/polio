/**
 * Which strokes are one drawing.
 *
 * A gull is four strokes and one bird; before this it was four buttons and
 * would have been four unrelated parts. The rules a person already follows:
 *
 *   · strokes laid down one after another, near each other, are one drawing;
 *   · a pause closes it, so the next stroke starts a new one;
 *   · distance splits it, even within the same run;
 *   · and a person's word beats the guess, both ways, join and split.
 *
 *   node tests/ink.mjs [url]        # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import { NEAR_FLOOR, PAUSE_MS, boundsOf, gap, inkGroups, near, nearestTo, union } from "../src/features/studio/inkGroups.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** A stroke as a little box of points, at a place and a time. */
const stroke = (id, x, y, w, h, at) => ({
  id,
  at,
  points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
});

/* ------------------------------------------------------------------ */
/* 1. The measurements underneath                                      */
/* ------------------------------------------------------------------ */

check("a box is the ink's extent", (() => {
  const b = boundsOf([[10, 20], [30, 5], [15, 40]]);
  return b.x === 10 && b.y === 5 && b.w === 20 && b.h === 35;
})());
check("two boxes that overlap have no gap between them",
  gap({ x: 0, y: 0, w: 20, h: 20 }, { x: 10, y: 10, w: 20, h: 20 }) === 0);
check("a gap is the shortest way across", gap({ x: 0, y: 0, w: 10, h: 10 }, { x: 40, y: 0, w: 10, h: 10 }) === 30);
check("a union covers both", (() => {
  const u = union({ x: 0, y: 0, w: 10, h: 10 }, { x: 40, y: 20, w: 10, h: 10 });
  return u.x === 0 && u.y === 0 && u.w === 50 && u.h === 30;
})());
check("two small strokes side by side are near", near({ x: 0, y: 0, w: 8, h: 8 }, { x: 20, y: 0, w: 8, h: 8 }),
  `floor ${NEAR_FLOOR}`);
check("two strokes a page apart are not", !near({ x: 0, y: 0, w: 8, h: 8 }, { x: 600, y: 0, w: 8, h: 8 }));

/* ------------------------------------------------------------------ */
/* 2. The gull: four strokes, one bird                                 */
/* ------------------------------------------------------------------ */

const GULL = [
  stroke("a", 100, 100, 40, 24, 1000),
  stroke("b", 132, 96, 40, 24, 1300),
  stroke("c", 116, 118, 20, 16, 1600),
  stroke("d", 104, 92, 16, 12, 1900),
];
const gull = inkGroups(GULL);
check("a four-stroke gull is one drawing", gull.length === 1, `${gull.length} groups`);
check("and it holds all four strokes", gull[0]?.strokeIds.length === 4, gull[0]?.strokeIds.join(","));
check("its box covers every stroke", (() => {
  const b = gull[0].bounds;
  return b.x <= 100 && b.y <= 92 && b.x + b.w >= 172 && b.y + b.h >= 134;
})());
check("nothing was decided, so it is still a guess", gull[0]?.decided === false);

/** J's bird: fifteen strokes, drawn steadily, one part. */
const BIRD = Array.from({ length: 15 }, (_, i) =>
  stroke(`s${i}`, 200 + (i % 5) * 18, 200 + Math.floor(i / 5) * 16, 22, 14, 5000 + i * 400));
const bird = inkGroups(BIRD);
check("a fifteen-stroke bird is one drawing, not fifteen", bird.length === 1, `${bird.length} groups`);
check("one button would be drawn for it", bird[0]?.strokeIds.length === 15);

/* ------------------------------------------------------------------ */
/* 3. A pause closes it                                                */
/* ------------------------------------------------------------------ */

const paused = inkGroups([
  stroke("one", 100, 100, 30, 20, 1000),
  stroke("two", 110, 104, 30, 20, 1200),
  // …then a think, in the same place.
  stroke("three", 104, 96, 30, 20, 1200 + PAUSE_MS + 400),
  stroke("four", 118, 108, 30, 20, 1200 + PAUSE_MS + 700),
]);
check("a pause starts a new drawing even in the same place", paused.length === 2, `${paused.length} groups`);
check("and each side of the pause keeps its own strokes",
  paused[0]?.strokeIds.join(",") === "one,two" && paused[1]?.strokeIds.join(",") === "three,four",
  paused.map((g) => g.strokeIds.join("+")).join(" | "));
check("the older drawing comes first", paused[0].at < paused[1].at);

const nudge = inkGroups([
  stroke("one", 100, 100, 30, 20, 1000),
  // Lifting the pen to reposition is not a pause.
  stroke("two", 108, 104, 30, 20, 1000 + PAUSE_MS - 200),
]);
check("lifting the pen for under the pause does not split a drawing", nudge.length === 1);

/* ------------------------------------------------------------------ */
/* 4. Distance splits it                                               */
/* ------------------------------------------------------------------ */

const apart = inkGroups([
  stroke("here", 100, 100, 30, 20, 1000),
  stroke("also-here", 112, 106, 30, 20, 1150),
  stroke("far", 900, 700, 30, 20, 1300),
]);
check("a stroke across the page is its own drawing even in the same run", apart.length === 2, `${apart.length} groups`);
check("the far one is alone", apart.some((g) => g.strokeIds.length === 1 && g.strokeIds[0] === "far"));

/** A chain of small strokes stays one drawing, growing as it goes. */
const chain = inkGroups(Array.from({ length: 8 }, (_, i) => stroke(`c${i}`, 100 + i * 30, 100, 12, 12, 1000 + i * 200)));
check("a chain of strokes across a shape stays one drawing", chain.length === 1, `${chain.length} groups`);

/* ------------------------------------------------------------------ */
/* 5. A person's word beats the guess                                  */
/* ------------------------------------------------------------------ */

const joined = inkGroups([
  { ...stroke("here", 100, 100, 30, 20, 1000), group: "k" },
  { ...stroke("far", 900, 700, 30, 20, 1300), group: "k" },
]);
check("two drawings a person joined are one", joined.length === 1, `${joined.length} groups`);
check("and the group says it was decided", joined[0]?.decided === true);

const split = inkGroups([
  { ...stroke("a", 100, 100, 30, 20, 1000), group: "a" },
  { ...stroke("b", 108, 104, 30, 20, 1100), group: "b" },
]);
check("two strokes a person split stay apart, however close", split.length === 2, `${split.length} groups`);
check("splitting is not undone by the guess", split.every((g) => g.strokeIds.length === 1));

check("the nearest drawing is the one a join takes in", (() => {
  const three = inkGroups([
    stroke("a", 0, 0, 20, 20, 1000),
    stroke("b", 200, 0, 20, 20, 1000 + PAUSE_MS + 100),
    stroke("c", 900, 0, 20, 20, 1000 + 2 * (PAUSE_MS + 100)),
  ]);
  const mate = nearestTo(three, three[0].id);
  return three.length === 3 && mate?.strokeIds[0] === "b";
})());
check("nothing is nearest when there is only one drawing",
  nearestTo(inkGroups([stroke("a", 0, 0, 20, 20, 1)]), "a") === null);

/* ------------------------------------------------------------------ */
/* 6. Ink from before this existed                                     */
/* ------------------------------------------------------------------ */

const old = inkGroups([
  { id: "a", points: [[100, 100], [130, 120]] },
  { id: "b", points: [[108, 104], [138, 124]] },
  { id: "c", points: [[900, 700], [930, 720]] },
]);
check("ink with no time on it groups by space alone", old.length === 2, `${old.length} groups`);
check("and nothing is lost", old.reduce((n, g) => n + g.strokeIds.length, 0) === 3);
check("nothing at all is no drawings", inkGroups([]).length === 0);

/* ------------------------------------------------------------------ */
/* 7. The board hangs the door on the drawing                          */
/* ------------------------------------------------------------------ */

const canvas = readFileSync("src/features/studio/Canvas.tsx", "utf8");
check("the button is keyed to a group, not a stroke", /data-make-real=\{g\.id\}/.test(canvas));
check("one button per drawing", /drawings\.map\(\(g\)/.test(canvas));
check("every stroke in the drawing goes into the sketch", /group\.strokeIds\.includes/.test(canvas));
check("the whole drawing is taken off the board, not one stroke", /removeShapes\(group\.strokeIds\)/.test(canvas));
check("the grouping can be seen", /data-ink-group=/.test(canvas));
check("and changed, both ways", /data-ink-join=/.test(canvas) && /data-ink-split=/.test(canvas));

const store = readFileSync("src/features/studio/store.ts", "utf8");
check("a stroke is stamped with when it went down", /at: Date\.now\(\)/.test(store));
check("joining and splitting are undoable like everything else",
  /joinInk: \(ids\) => \{[\s\S]{0,240}push\(\);/.test(store) && /splitInk: \(ids\) => \{[\s\S]{0,240}push\(\);/.test(store));

/* ------------------------------------------------------------------ */
/* 8. In the browser                                                   */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

const passed = results.filter(Boolean).length;
console.log(`\nall good — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
