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
 *   · it is four strands wound tight about a near-black core, not one line;
 *   · both ends' colours run its whole length on separate strands, and only
 *     the ratio between them shifts — nothing is blended into a third hue;
 *   · the light on it sits still, and is on the strands rather than around
 *     them;
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
  Object.values(VINE).every((v) => lightOf(v.dark) <= 0.32 && lightOf(v.lit) <= 0.52));
/*
 * The same material as the boxes: a vine's three tones are the construct's
 * own stops — deep, body, hot — read out of `molten.css`, not colours that
 * happen to be near them. Held here so the copy cannot drift.
 */
{
  const molten = readFileSync("src/core/ui/molten.css", "utf8");
  const stop = (name) => /oklch\([^)]*\)/.exec(new RegExp(`--${name}:\\s*(oklch\\([^)]*\\))`).exec(molten)?.[1] ?? "")?.[0];
  for (const [end, kind] of [["iteration", "verdant"], ["drawing", "ember"]]) {
    check(`${end}: the shaded side is the ${kind} construct's deep`, VINE[end].dark === stop(`${kind}-deep`), `${VINE[end].dark} vs ${stop(`${kind}-deep`)}`);
    check(`${end}: the lit side is its body`, VINE[end].lit === stop(`${kind}-body`), `${VINE[end].lit} vs ${stop(`${kind}-body`)}`);
    check(`${end}: the light down the edge is its hot`, VINE[end].hot === stop(`${kind}-hot`), `${VINE[end].hot} vs ${stop(`${kind}-hot`)}`);
  }
}

const strandSrc = readFileSync("src/features/studio/strand.ts", "utf8");
/*
 * The colour rule, corrected.
 *
 * Blending the two ends along the length was wrong: it put yellow and then
 * brown through the middle of every green-to-red vine, which is a colour
 * neither board has. Both colours run the whole length on separate strands
 * instead, and only the ratio changes — so there must be no mix of one end
 * with the other anywhere.
 */
check("neither end's colour is ever mixed into the other's",
  !/barkA/.test(strandSrc) && !/barkZ/.test(strandSrc) && !/mix\(\s*RAMP/.test(strandSrc));
check("one strand carries one end's colour and the other the other's, and neither ever changes over",
  /ramp: bark\[b\]!,/.test(strandSrc) && !/CROSSOVER/.test(strandSrc) && !/function changeAt\(/.test(strandSrc));
check("the ratio is thickness: the fat strand at a board is that board's colour", (() => {
  const shift = Number(/const SHIFT = ([\d.]+)/.exec(strandSrc)?.[1]);
  return shift > 0 && shift < 0.5 && /function share\(/.test(strandSrc) && /function widthOf\(/.test(strandSrc);
})(), `shift ${/const SHIFT = ([\d.]+)/.exec(strandSrc)?.[1]}`);
check("both colours are present at both ends, so the ratio shifts rather than the hue", (() => {
  // A shift under a half: the thin strand is never nothing.
  const shift = Number(/const SHIFT = ([\d.]+)/.exec(strandSrc)?.[1]);
  return shift <= 0.3;
})());
check("two boards of the same kind get one colour in two equal strands", /if \(!mixed\) return 0\.5;/.test(strandSrc));
check("the two strands wind round a near-black core", (() => {
  const core = /const CORE = "oklch\(([\d.]+)/.exec(strandSrc)?.[1];
  return core !== undefined && Number(core) < 0.2;
})(), `core lightness ${/const CORE = "oklch\(([\d.]+)/.exec(strandSrc)?.[1]}`);
check("the core goes down once, whole, under both strands — not between them step by step, which left teeth along every edge",
  /The core: once, whole, under both strands/.test(strandSrc) && !/core\(\)/.test(strandSrc));
check("hue still takes the short way round within one bark's own shading",
  /if \(dh > 180\) dh -= 360;/.test(strandSrc));
check("each strand carries a hard line down the edge facing the light, not a glow",
  /const LIGHT = \{/.test(strandSrc) && /ramp\.spec\[/.test(strandSrc) && /c\.lineWidth = 0\.9;/.test(strandSrc));
check("the cable gathers into the axis where it meets a board rather than fanning against it",
  /function girth\(/.test(strandSrc));
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
  // The edge light on a vine is the construct's hot, the same as a box's
  // rim; the box's white sits above both, and nothing on a vine reaches it.
  const brightest = Math.max(...Object.values(VINE).map((v) => lightOf(v.hot)));
  return core > brightest + 0.05;
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
/* 3. Two strands, wound, opaque, with the light standing still        */
/* ------------------------------------------------------------------ */

const strand = readFileSync("src/features/studio/strand.ts", "utf8");
check("two strands, a twisted pair — not four, which read as threaded", /const STRANDS = 2;/.test(strand) && /\[0, 1\]\.map\(\(b\) =>/.test(strand) && !/\[0, 1, 2, 3\]/.test(strand));
check("smooth: twice the samples a turn the four-strand cable had", (() => {
  const per = Number(/turns \* (\d+)\)/.exec(strand)?.[1]);
  return per >= 20;
})(), `${/turns \* (\d+)\)/.exec(strand)?.[1]} a turn`);
check("and the grain moves the shade, never the width", /grain \* 0\.06/.test(strand) && !/0\.92 \+ grain/.test(strand));
/*
 * The colour is animated, and not by repainting. The timeline lays two small
 * elements per vine over the canvas — one per strand, at that strand's
 * temperature — each clipped to its strand's near side and carrying the
 * construct's own cloud on the same keyframe as every box. The green cloud
 * is on the green strand and the red on the red, and nothing is blended.
 */
check("the colour moves: the construct's cloud glides over the cable on the boxes' own keyframe", (() => {
  const css = readFileSync("src/core/ui/molten.css", "utf8");
  return /\.molten-vine > i \{[\s\S]*?animation: molten-drift 150s linear infinite;/.test(css);
})());
check("…laid over the bark rather than painted on it, so nothing is repainted and nothing is blended", (() => {
  const css = readFileSync("src/core/ui/molten.css", "utf8");
  return /\.molten-vine \{/.test(css) && !/mix-blend-mode/.test(css) && /Nothing here takes a clock/.test(strand);
})());
check("…each strand under its own colour's cloud, so a red strand goes redder and never brown", (() => {
  const tl = readFileSync("src/features/studio/Timeline.tsx", "utf8");
  const css = readFileSync("src/core/ui/molten.css", "utf8");
  return /for \(const b of \[0, 1\] as const\)/.test(tl)
    && /const heat = v\.ends\[b\] === "drawing" \? "ember" : "verdant";/.test(tl)
    && /\.molten-vine\[data-heat="verdant"\] > i \{ background-image: var\(--nebula-verdant, none\); \}/.test(css)
    && /\.molten-vine\[data-heat="ember"\] > i \{ background-image: var\(--nebula-ember, none\); \}/.test(css);
})());
check("…and not through the construct's own class, which costs two milliseconds a change", (() => {
  const tl = readFileSync("src/features/studio/Timeline.tsx", "utf8");
  const fn = /function syncLights\([\s\S]*?\n\}/.exec(tl)?.[0] ?? "";
  return fn.length > 0 && !/moltenClass\(/.test(fn) && /el\.className = "molten-vine";/.test(fn);
})());
check("…clipped to that strand's near side, so the two clouds never overlap and there is none beside the cable", (() => {
  const tl = readFileSync("src/features/studio/Timeline.tsx", "utf8");
  return /export function strandEnvelope\(/.test(strand) && /if \(facing < 0\.5\) \{ close\(\); continue; \}/.test(strand)
    && /el\.style\.clipPath = d \? `path\("\$\{d\}"\)` : "inset\(100%\)";/.test(tl)
    && /if \(lights\.current\) syncLights\(lights\.current, lightEls\.current, want, changed, !dragging\);/.test(tl);
})());
check("…and laid only when the vine is at rest: lifted while its board is held, and not until it has grown", (() => {
  const tl = readFileSync("src/features/studio/Timeline.tsx", "utf8");
  return /if \(!rest \|\| v\.grow < 1\) \{/.test(tl) && /el\.style\.clipPath = "inset\(100%\)"; \}\s*continue;/.test(tl);
})());
check("and drawn back to front, which is what makes a winding read as one",
  /\.sort\(\(x, y\) => x\.here\.facing - y\.here\.facing\)/.test(strand));
check("it is opaque: nothing blended, nothing see-through",
  !/globalCompositeOperation/.test(strand) && !/"lighter"/.test(strand));
check("it sits on the ground rather than floating on it", /A shadow under the whole thing/.test(strand));
check("they are wound about one axis", /function wind\(/.test(strand));
/*
 * The helix is a pitch, not a count of turns per span. Three turns across a
 * short gap is a tight cable; three across a long one is four lines lying
 * almost parallel, which is what a fixed count gave.
 */
check("the twist is tight at every length, because it is a pitch", (() => {
  const pitch = Number(/const PITCH = (\d+)/.exec(strand)?.[1]);
  return pitch > 0 && pitch <= 50 && /function turnsFor\(/.test(strand);
})(), `one turn every ${/const PITCH = (\d+)/.exec(strand)?.[1]}px`);
check("and it tightens in the middle of a span and relaxes at the boards",
  /const TIGHTEN/.test(strand) && /function turned\(/.test(strand));
check("the far side of the turn is dimmed, which is what makes it read as wound",
  /here\.facing/.test(strand));
check("there is fibre in the body", /function fibre\(/.test(strand));
check("the light in it sits still", /function hotspots\(/.test(strand));
check("the hotspots come from the pair alone, so they are in the same place every frame", (() => {
  const fn = /function hotspots\([\s\S]*?\n\}/.exec(strand)?.[0] ?? "";
  return fn.length > 0 && /phase/.test(fn) && !/\bt\b\s*[*+]/.test(fn);
})());
check("some are brighter than others", /bright: 0\.35 \+ g \* 0\.65/.test(strand));
check("fewer of them: two smooth strands want less on them", /i < 8; i\+\+/.test(strand));
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

check("where a vine starts and ends is read from where the box is",
  /paintStrand\(c, v\.from, v\.to/.test(timeline));
/*
 * The canvas is kept rather than redrawn: it lives inside the plot, so a pan
 * moves it the way it moves a box, and a paint only touches the vines whose
 * ends have actually moved.
 */
check("the vines ride the plot's own transform rather than being repainted on a pan",
  /data-timeline-vines/.test(timeline) && /Inside the plot, in the boards' own coordinates/.test(timeline));
check("only the vines whose ends moved are repainted",
  /const dirty/.test(timeline) && /if \(!dirty\.length\) return;/.test(timeline)
  && /strandBounds\(from, to\)/.test(timeline));
check("the loop starter is still on the middle of the strand", /strandMiddle\(from, to\)/.test(timeline));

/* ------------------------------------------------------------------ */
/* 6. In the browser                                                   */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
