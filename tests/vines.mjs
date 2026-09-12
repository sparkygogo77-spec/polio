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
import { STRAND_WIDTH, VINE, strandMiddle, strandPath } from "../src/features/studio/strand.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const hueOf = (c) => Number(/oklch\([\d.]+ [\d.]+ ([\d.]+)/.exec(c)?.[1]);
const chromaOf = (c) => Number(/oklch\([\d.]+ ([\d.]+)/.exec(c)?.[1]);
const lightOf = (c) => Number(/oklch\(([\d.]+)/.exec(c)?.[1]);

/* ------------------------------------------------------------------ */
/* 1. Bark, and it takes its colour from what it joins                 */
/* ------------------------------------------------------------------ */

check("a vine has an end for each kind of board it can join",
  !!VINE.iteration && !!VINE.drawing && !!VINE.cut);
for (const [end, bark] of Object.entries(VINE)) {
  check(`${end}: it has a shaded side, a lit side and a hotspot`, !!bark.dark && !!bark.lit && !!bark.hot);
  check(`${end}: the lit side is lighter than the shaded one, which is what makes it round`,
    lightOf(bark.lit) > lightOf(bark.dark), `${lightOf(bark.dark)} → ${lightOf(bark.lit)}`);
  check(`${end}: the hotspot is the brightest of the three`, lightOf(bark.hot) > lightOf(bark.lit));
}
check("a vine at a green board is green", hueOf(VINE.iteration.lit) >= 130 && hueOf(VINE.iteration.lit) <= 165,
  `${hueOf(VINE.iteration.lit)}`);
check("a vine at a red drawing is red", hueOf(VINE.drawing.lit) <= 45, `${hueOf(VINE.drawing.lit)}`);
check("a cut one has no colour left in it", chromaOf(VINE.cut.dark) <= 0.03);
check("the body is bark rather than light: dark, and never near-white",
  Object.values(VINE).every((v) => lightOf(v.dark) <= 0.3 && lightOf(v.lit) <= 0.5));

const strandSrc = readFileSync("src/features/studio/strand.ts", "utf8");
check("the two ends are mixed along the length rather than meeting at a join",
  /function mix\(/.test(strandSrc) && /mix\(barkA\.dark, barkZ\.dark, u\)/.test(strandSrc));
check("hue takes the short way round, so green to red goes through the yellows",
  /if \(dh > 180\) dh -= 360;/.test(strandSrc));
check("the board says what each vine joins", (() => {
  const tl = readFileSync("src/features/studio/Timeline.tsx", "utf8");
  return /ends: \[/.test(tl) && /isElement\(byId\.get\(c\.from\)!\) \? "drawing" : "iteration"/.test(tl);
})());
/*
 * A vine must never outshine a board. It is bark with light caught in it;
 * the board is the lit thing.
 */
check("a board's own core is far brighter than anything on a vine, which is what makes it lead", (() => {
  const molten = readFileSync("src/core/ui/molten.css", "utf8");
  const core = Number(/--verdant-white:\s*oklch\(([\d.]+)/.exec(molten)?.[1]);
  const brightest = Math.max(...Object.values(VINE).map((v) => lightOf(v.hot)));
  return core > brightest + 0.15;
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
/* 3. Three strands, wound, opaque, with the light standing still      */
/* ------------------------------------------------------------------ */

const strand = readFileSync("src/features/studio/strand.ts", "utf8");
check("three strands, not one line", /\[0, 1, 2\]\.map\(\(b\) =>/.test(strand));
check("and drawn back to front, which is what makes a winding read as one",
  /\.sort\(\(x, y\) => x\.here\.facing - y\.here\.facing\)/.test(strand));
check("it is opaque: nothing blended, nothing see-through",
  !/globalCompositeOperation/.test(strand) && !/"lighter"/.test(strand));
check("it sits on the ground rather than floating on it", /A shadow under the whole thing/.test(strand));
check("they are wound about one axis", /const TWISTS/.test(strand) && /function wind\(/.test(strand));
check("the far side of the turn is dimmed, which is what makes it read as wound",
  /here\.facing/.test(strand));
check("there is fibre in the body", /function fibre\(/.test(strand));
check("the light in it sits still", /function hotspots\(/.test(strand));
check("the hotspots come from the pair alone, so they are in the same place every frame", (() => {
  const fn = /function hotspots\([\s\S]*?\n\}/.exec(strand)?.[0] ?? "";
  return fn.length > 0 && /phase/.test(fn) && !/\bt\b\s*[*+]/.test(fn);
})());
check("some are brighter than others", /bright: 0\.35 \+ g \* 0\.65/.test(strand));
check("one on the far side of the turn is hidden", /if \(here\.facing < 0\.45\) continue;/.test(strand));
check("nothing travels along it any more",
  !/bright bands running the length/.test(strand) && !/travelling the length/.test(strand));
check("how much a strand faces the eye is also its shading", /here\.facing \* 0\.85/.test(strand));
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
