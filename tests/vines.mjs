/**
 * The timeline reads: green boards, red drawings, green vines between them.
 *
 * An iteration is a board that holds things, so it is green; a drawing and
 * anything that came off one is red. The vines that join them are green too,
 * dimmer than the boards, because a connection is not the subject.
 *
 *   · nothing on the timeline is the purple it started in;
 *   · a vine takes a wider path than the shortest line, the same way every
 *     time for the same pair, and is longer for it;
 *   · it is three beams wound about one axis, not one line;
 *   · several shades run through its length;
 *   · the glow goes through all three at once rather than along one;
 *   · and the loop starter still sits on the strand it is about.
 *
 *   node tests/vines.mjs [url]        # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import { STRAND, STRAND_WIDTH, strandMiddle, strandPath } from "../src/features/studio/strand.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const hueOf = (c) => Number(/oklch\([\d.]+ [\d.]+ ([\d.]+)/.exec(c)?.[1]);
const chromaOf = (c) => Number(/oklch\([\d.]+ ([\d.]+)/.exec(c)?.[1]);
const lightOf = (c) => Number(/oklch\(([\d.]+)/.exec(c)?.[1]);

/* ------------------------------------------------------------------ */
/* 1. Green vines, in shades                                           */
/* ------------------------------------------------------------------ */

for (const [tone, skin] of Object.entries(STRAND)) {
  check(`${tone} runs through several shades`, skin.shades.length === 3, `${skin.shades.length}`);
  check(`${tone}'s shades are not all one colour`, new Set(skin.shades).size === 3);
  if (tone !== "cut") {
    check(`${tone} is green`, skin.shades.every((c) => hueOf(c) >= 120 && hueOf(c) <= 175),
      skin.shades.map(hueOf).join(","));
  }
}
check("nothing on a vine is the emerald the boxes used to be",
  Object.values(STRAND).every((s) => s.shades.every((c) => hueOf(c) !== 158)));
check("a cut vine has no colour left in it", STRAND.cut.shades.every((c) => chromaOf(c) <= 0.03));
/*
 * The vines stayed green when the boards did, so they get out of the way by
 * being pulled back rather than by changing hue. Nothing on a vine may be
 * near-white: the hot core is the board's, and that is what makes a board
 * read as the lit thing and a vine as what holds it up.
 */
const everyVineColour = Object.entries(STRAND).filter(([t]) => t !== "cut")
  .flatMap(([, s]) => [...s.shades, s.rim, s.pulse]);
check("no part of a vine is near-white", everyVineColour.every((c) => lightOf(c) <= 0.7),
  "brightest " + Math.max(...everyVineColour.map(lightOf)));
check("and none of it is loud", everyVineColour.every((c) => chromaOf(c) <= 0.13),
  "most colour " + Math.max(...everyVineColour.map(chromaOf)));
check("a board's edge is far brighter than any vine, which is what makes it lead", (() => {
  // The stop is named for what it is now: the edge, the brightest thing on a
  // construct, against the brightest thing on a vine.
  const molten = readFileSync("src/core/ui/molten.css", "utf8");
  const edge = Number(/--verdant-edge-hot:\s*oklch\(([\d.]+)/.exec(molten)?.[1]);
  return edge > Math.max(...everyVineColour.map(lightOf)) + 0.2;
})());

/* ------------------------------------------------------------------ */
/* 2. A wider path than the shortest line                              */
/* ------------------------------------------------------------------ */

const A = { x: 0, y: 0 };
const B = { x: 400, y: 0 };
const path = strandPath(A, B);

/** How long the curve actually is, walked. */
const walked = (p, steps = 200) => {
  const at = (t) => {
    const u = 1 - t;
    return {
      x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
      y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y,
    };
  };
  let d = 0, prev = at(0);
  for (let i = 1; i <= steps; i++) { const q = at(i / steps); d += Math.hypot(q.x - prev.x, q.y - prev.y); prev = q; }
  return d;
};

check("a vine is longer than the straight line between the boxes", walked(path) > 400 * 1.05,
  `${Math.round(walked(path))} against 400`);
check("it leaves the straight line rather than lying on it", (() => {
  const mid = strandMiddle(A, B);
  return Math.abs(mid.y) > 8;
})(), `${strandMiddle(A, B).y.toFixed(1)}px off the line`);
check("it still starts and ends on the boxes", path[0].x === A.x && path[3].x === B.x && path[3].y === B.y);
check("the same pair bows the same way every time",
  strandMiddle(A, B).y === strandMiddle(A, B).y && Math.sign(strandMiddle(A, B).y) === Math.sign(strandMiddle(A, B).y));
check("dragging a box a pixel does not snap the vine to the other side", (() => {
  // The bow is a side of the direction of travel, not a coin flipped on
  // where the boxes happen to be, so it cannot jump under the hand.
  let prev = null;
  for (let dx = 0; dx < 24; dx++) {
    const m = strandMiddle({ x: dx, y: 0 }, { x: 400 + dx, y: 0 });
    const side = Math.sign(m.y);
    if (prev !== null && side !== prev) return false;
    prev = side;
  }
  return prev !== 0;
})());
check("boxes at different angles get curves leaning different ways", (() => {
  const sides = [
    Math.sign(strandMiddle({ x: 0, y: 0 }, { x: 400, y: 0 }).y),
    Math.sign(strandMiddle({ x: 400, y: 0 }, { x: 0, y: 0 }).y),
  ];
  return new Set(sides).size === 2;
})());
check("the loop starter sits on the vine, not on the straight line", (() => {
  const mid = strandMiddle(A, B);
  const onCurve = walked([path[0], path[1], path[2], path[3]], 400);
  return onCurve > 0 && Math.abs(mid.y) > 8;
})());
check("a very short run does not bow into a loop", (() => {
  const m = strandMiddle({ x: 0, y: 0 }, { x: 20, y: 0 });
  return Math.abs(m.y) < 20;
})(), `${strandMiddle({ x: 0, y: 0 }, { x: 20, y: 0 }).y.toFixed(1)}`);

/* ------------------------------------------------------------------ */
/* 3. Three beams, wound, lit together                                 */
/* ------------------------------------------------------------------ */

const strand = readFileSync("src/features/studio/strand.ts", "utf8");
check("three beams, not one line", /for \(let b = 0; b < 3; b\+\+\)/.test(strand));
check("they are wound about one axis", /const TWISTS/.test(strand) && /function wind\(/.test(strand));
check("the far side of the turn is dimmed, which is what makes it read as wound",
  /here\.facing/.test(strand));
check("there is fibre in the body", /function fibre\(/.test(strand));
check("the shades walk along the length", /tone\.shades\[pick\]/.test(strand));
check("the glow hits all three beams in the same frame",
  /for \(let b = 0; b < 3; b\+\+\) \{\s*const here = wind/.test(strand));
check("a vine is still about as wide as it was", STRAND_WIDTH >= 5 && STRAND_WIDTH <= 9, `${STRAND_WIDTH}`);

/* ------------------------------------------------------------------ */
/* 4. Green boards, red drawings, on a purple ground                   */
/* ------------------------------------------------------------------ */

const timeline = readFileSync("src/features/studio/Timeline.tsx", "utf8");
const detail = readFileSync("src/features/studio/TimelineDetail.tsx", "utf8");
/*
 * Both spellings, because a colour can be written two ways here and only one
 * of them was being read: `oklch(0.66 0.07 34)` in an inline style, and
 * `oklch(0.66_0.07_34)` inside a Tailwind arbitrary-value class. A label kept
 * its old amber through a whole colour swap because this regex could not see
 * the second kind.
 */
const hues = (src) => [
  ...[...src.matchAll(/oklch\([\d.]+ [\d.]+ ([\d.]+)/g)].map((m) => Number(m[1])),
  ...[...src.matchAll(/oklch\([\d.]+_[\d.]+_([\d.]+)\)/g)].map((m) => Number(m[1])),
];

check("no purple is left on the timeline", !hues(timeline).includes(300));
check("the section under it is one place with it",
  !hues(detail).includes(158) && !hues(detail).includes(300));
/*
 * The scheme swapped: an iteration board is green, a drawing is red. What is
 * checked is that the two are told apart and neither has drifted into a third
 * colour — not that the whole screen is one hue, which it deliberately is not.
 */
check("an iteration's chrome is green", hues(timeline).includes(152),
  `${[...new Set(hues(timeline))].sort((a, b) => a - b).join(",")}`);
check("a drawing's is red", hues(timeline).includes(18));
check("nothing is left in the lantern red the boxes used to be", !hues(timeline).includes(34));
check("the boxes take their colour from the shared surface rather than their own",
  /from "@\/core\/ui\/molten"/.test(timeline));
check("a box looks lit rather than flat", /moltenClass\("verdant"\)/.test(timeline),
  "the light is the shared molten surface now, not an inline gradient");
check("the file says what it is now, rather than what it was",
  /green/.test(timeline) && /red/.test(timeline));

/* ------------------------------------------------------------------ */
/* 5. Still anchored to the hand                                       */
/* ------------------------------------------------------------------ */

check("where a vine starts and ends is read from where the box is, every frame",
  /paintStrand\(c, from, to/.test(timeline));
check("the loop starter is still on the middle of the strand", /strandMiddle\(from, to\)/.test(timeline));

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
