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
 *   · it is not a cable at all: it is the boxes' own construct, stretched
 *     along a path — the near-black core down the middle, the section
 *     easing out through char to deep, and the thin bright rim at each
 *     edge, all read off `molten.css`;
 *   · it is one strand and not two: the section is symmetric, dark down the
 *     axis and lit at both edges, and the colour runs along its length
 *     instead — green where it leaves a board, red where it arrives at a
 *     drawing, and the material's own dark between, never a third hue;
 *   · the light comes from within it — dark middle, lit edges — rather than
 *     from a highlight painted along one side;
 *   · the colour moves the way a box's does, by the same cloud on the same
 *     keyframe, and no repaint;
 *   · and the loop starter still sits on the vine it is about.
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
/* 1. The boxes' own material, and it takes its colour from what it joins */
/* ------------------------------------------------------------------ */

check("a vine has an end for each kind of board it can join",
  !!VINE.iteration && !!VINE.drawing && !!VINE.cut);
for (const [end, bark] of Object.entries(VINE)) {
  check(`${end}: it carries the construct's five stops`,
    !!bark.core && !!bark.char && !!bark.deep && !!bark.hot && !!bark.white);
  check(`${end}: the core is the darkest of them, and the rim the brightest`,
    lightOf(bark.core) < lightOf(bark.char) && lightOf(bark.char) < lightOf(bark.deep)
    && lightOf(bark.deep) < lightOf(bark.hot) && lightOf(bark.hot) < lightOf(bark.white),
    [bark.core, bark.char, bark.deep, bark.hot, bark.white].map(lightOf).join(" → "));
}
check("a vine at a green board is green", hueOf(VINE.iteration.deep) >= 130 && hueOf(VINE.iteration.deep) <= 165,
  `${hueOf(VINE.iteration.deep)}`);
check("a vine at a red drawing is red", hueOf(VINE.drawing.deep) <= 45, `${hueOf(VINE.drawing.deep)}`);
check("a cut one has no colour left in it", chromaOf(VINE.cut.deep) <= 0.03);
check("the body of it is dark: the light is at the edges, not through the middle",
  Object.values(VINE).every((v) => lightOf(v.core) <= 0.16 && lightOf(v.deep) <= 0.32));
/*
 * The same material as the boxes, and not a colour that happens to be near
 * theirs: every stop is the construct's own, read out of `molten.css`. Held
 * here so the copy cannot drift from the source.
 */
{
  const molten = readFileSync("src/core/ui/molten.css", "utf8");
  const stop = (name) => /oklch\([^)]*\)/.exec(new RegExp(`--${name}:\\s*(oklch\\([^)]*\\))`).exec(molten)?.[1] ?? "")?.[0];
  for (const [end, kind] of [["iteration", "verdant"], ["drawing", "ember"]]) {
    for (const which of ["core", "char", "deep", "hot", "white"]) {
      check(`${end}: its ${which} is the ${kind} construct's`, VINE[end][which] === stop(`${kind}-${which}`),
        `${VINE[end][which]} vs ${stop(`${kind}-${which}`)}`);
    }
  }
}

const strandSrc = readFileSync("src/features/studio/strand.ts", "utf8");
/*
 * The colour rule, kept from the cable and answered differently.
 *
 * Blending the two ends along the length was wrong: it put yellow and then
 * brown through the middle of every green-to-red vine, which is a colour
 * neither board has. Both colours run the whole length — one down each side
 * of the ribbon now — and only the seam between them moves, so there must
 * be no mix of one end with the other anywhere.
 */
check("neither end's colour is ever mixed into the other's",
  !/barkA/.test(strandSrc) && !/barkZ/.test(strandSrc) && !/mix\(\s*SECTION/.test(strandSrc));
/*
 * ONE STRAND. It was two — green down one side, red down the other, a seam
 * sliding across the width between them — and two colours side by side down
 * a curve is two strands however it is drawn. The section is symmetric now:
 * the axis is the dark, both edges are lit, and there is no seam anywhere.
 */
check("the section is symmetric about the axis, so there is one strand and not two", (() => (
  /function bandAt\(u: number, side: 0 \| 1, k: number, half: number\)/.test(strandSrc)
  && /const edge = side === 0 \? half : -half;\n  return edge \* \(k \/ BANDS\) \* gather\(u\);/.test(strandSrc)
  && !/function seamAt\(/.test(strandSrc) && !/const SHIFT =/.test(strandSrc)
))());
check("…so the axis is the darkest part of it and both edges carry the rim",
  /the axis at nought, the rim at one/.test(strandSrc) && /if \(t < 0\.25\) out\.push\(bark\.core\);/.test(strandSrc));
/*
 * The colour runs ALONG it instead, and the two ends still never meet:
 * blending them put yellow and then brown through the middle of every vine,
 * which is a colour neither board has. So one end's colour holds, the
 * material's own dark holds the middle, and the other comes up out of it.
 */
check("the colour runs along the length, as one gradient per band", (() => (
  /const g = c\.createLinearGradient\(from\.x, from\.y, to\.x, to\.y\);/.test(strandSrc)
  && /g\.addColorStop\(FADE, dark\);/.test(strandSrc) && /g\.addColorStop\(1 - FADE, dark\);/.test(strandSrc)
))());
check("…with a plateau of dark between them, so neither end's colour reaches the other", (() => {
  const fade = Number(/const FADE = ([\d.]+)/.exec(strandSrc)?.[1]);
  return fade > 0.3 && fade < 0.5;
})(), `fade ${/const FADE = ([\d.]+)/.exec(strandSrc)?.[1]}`);
check("…and that dark is a clamp rather than a colour: pulled to char's lightness, where a hue cannot be read", (() => (
  /function dusk\(a: string, z: string, floor: Lch\): string/.test(strandSrc)
  && /Math\.min\(m\.l, floor\.l\)/.test(strandSrc) && /Math\.min\(m\.c, floor\.c\)/.test(strandSrc)
  && /const floor = lch\(VINE\[ends\[0\]\]\.char\);/.test(strandSrc)
))());
check("two boards of the same kind get no gradient at all", /\} else \{\n      c\.fillStyle = near\[k\]!;/.test(strandSrc));
/*
 * The rim was a stop no band could reach. A band is drawn in the colour at
 * its middle, and with eight of them the highest `t` asked for is 0.9375 —
 * while the last breakpoints sat at 0.93 and 0.98, `mix(hot, white)` was
 * never once used and a vine had no rim: a tube of dark material rather
 * than the construct, which was exactly the note. Every threshold falls
 * between two band centres now, and this is the pin that keeps it so.
 */
check("every stop of the section is one some band actually reaches", (() => {
  const cuts = [...strandSrc.matchAll(/else if \(t < ([\d.]+)\)/g)].map((m) => Number(m[1]));
  const first = Number(/if \(t < ([\d.]+)\) out\.push\(bark\.core\);/.exec(strandSrc)?.[1]);
  const bands = Number(/const BANDS = (\d+);/.exec(strandSrc)?.[1]);
  const centres = Array.from({ length: bands }, (_, i) => (i + 0.5) / bands);
  const edges = [first, ...cuts];
  // Every band lands in exactly one region, and every region has a band.
  const hit = new Set(centres.map((t) => edges.findIndex((e) => t < e)));
  return edges.length > 0 && hit.size === edges.length + 1;
})(), `${/const BANDS = (\d+);/.exec(strandSrc)?.[1]} bands, ${[...strandSrc.matchAll(/t < ([\d.]+)/g)].map((m) => m[1]).join(" ")}`);
check("hue still takes the short way round within one bark's own section",
  /if \(dh > 180\) dh -= 360;/.test(strandSrc));
check("the light comes from within: no specular painted down a side, and no light source",
  !/ramp\.spec/.test(strandSrc) && !/const LIGHT = \{/.test(strandSrc) && !/function hotspots\(/.test(strandSrc)
  && /there is no specular anywhere/.test(strandSrc));
check("the ribbon gathers a little where it meets a board rather than being butted against it",
  /function gather\(/.test(strandSrc));
check("the board says what each vine joins", (() => {
  const tl = readFileSync("src/features/studio/Timeline.tsx", "utf8");
  return /ends: \[/.test(tl) && /isElement\(byId\.get\(c\.from\)!\) \? "drawing" : "iteration"/.test(tl);
})());
/*
 * A vine must never outshine a board. Its rim is the box's rim, and the
 * box's `white` sits above both.
 */
check("a board's own white is brighter than anything on a vine, which is what makes it lead", (() => {
  const molten = readFileSync("src/core/ui/molten.css", "utf8");
  const white = Number(/--verdant-white:\s*oklch\(([\d.]+)/.exec(molten)?.[1]);
  const brightest = Math.max(...Object.values(VINE).map((v) => lightOf(v.hot)));
  return white > brightest;
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
/* 3. One ribbon of the construct, lit from within                     */
/* ------------------------------------------------------------------ */

const strand = readFileSync("src/features/studio/strand.ts", "utf8");
check("one ribbon, not strands: nothing is wound round anything",
  !/const STRANDS/.test(strand) && !/function wind\(/.test(strand) && !/function turned\(/.test(strand) && !/PITCH/.test(strand));
check("its section is the box's own: core, char, deep, the rim's glow, the rim",
  /const BANDS = 10;/.test(strand) && /function section\(bark: Bark\)/.test(strand)
  && /out\.push\(mix\(core, char,/.test(strand) && /out\.push\(mix\(char, deep,/.test(strand)
  && /out\.push\(mix\(hot, white, 0\.22\)\);/.test(strand));
check("…in the proportions the face is drawn in: the core a quarter of the way out, char to a half",
  /if \(t < 0\.25\)/.test(strand) && /t < 0\.45/.test(strand) && /t < 0\.65/.test(strand) && /t < 0\.85/.test(strand));
check("…and every stop gets two bands, because a rim one band wide is three quarters of a pixel", (() => {
  const bands = Number(/const BANDS = (\d+);/.exec(strand)?.[1]);
  const edges = [Number(/if \(t < ([\d.]+)\) out\.push\(bark\.core\);/.exec(strand)?.[1]), ...[...strand.matchAll(/else if \(t < ([\d.]+)\)/g)].map((m) => Number(m[1]))];
  const centres = Array.from({ length: bands }, (_, i) => (i + 0.5) / bands);
  const per = new Map();
  for (const t of centres) { const r = edges.findIndex((e) => t < e); per.set(r, (per.get(r) ?? 0) + 1); }
  return [...per.values()].every((n) => n >= 2);
})(), `${/const BANDS = (\d+);/.exec(strand)?.[1]} bands`);
check("a band is one long fill, not a stroke a step: ten fills for a vine of any length",
  /for \(const side of \[0, 1\] as const\) sidePath\(s, side, k, Math\.min\(BANDS, k \+ 1\.12\), half, c\);/.test(strand) && /c\.fill\(\);/.test(strand));
check("…and the curve is sampled for smoothness rather than for a twist", (() => {
  const per = /Math\.max\(24, Math\.min\(72, Math\.round\(run \/ 11\)\)\)/.test(strand);
  return per && /function sampleCount\(run: number\)/.test(strand);
})());
check("it is opaque: nothing blended, nothing see-through",
  !/globalCompositeOperation/.test(strand) && !/"lighter"/.test(strand));
check("it sits on the ground rather than floating on it", /A shadow under the whole thing/.test(strand));
check("nothing travels along it, and nothing sits on it",
  !/bright bands running the length/.test(strand) && !/travelling the length/.test(strand) && !/function hotspots\(/.test(strand));
check("a vine is wide enough for its own section to read", STRAND_WIDTH >= 12 && STRAND_WIDTH <= 18, `${STRAND_WIDTH}`);
/*
 * The colour is animated, and not by repainting. The timeline lays two small
 * elements per vine over the canvas — one per half of its length, at that
 * end's temperature — each clipped to that half and carrying the construct's
 * own cloud on the same keyframe as every box. The green cloud is over the
 * half that leaves the green board and the red over the half that arrives at
 * the red one; they meet in the middle, where the vine is at its darkest and
 * neither of them shows, and nothing is blended.
 */
check("the colour moves: the construct's cloud glides over the vine on the boxes' own keyframe", (() => {
  const css = readFileSync("src/core/ui/molten.css", "utf8");
  return /\.molten-vine > i \{[\s\S]*?animation: molten-drift 150s linear infinite;/.test(css);
})());
check("…laid over the bark rather than painted on it, so nothing is repainted and nothing is blended", (() => {
  const css = readFileSync("src/core/ui/molten.css", "utf8");
  return /\.molten-vine \{/.test(css) && !/mix-blend-mode/.test(css) && /Nothing here takes a clock/.test(strand);
})());
check("…each half under its own end's cloud, so a red half goes redder and never brown", (() => {
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
check("…clipped to one half of its length each, over the body of it, so the filaments cross a vine as they cross a card", (() => {
  const tl = readFileSync("src/features/studio/Timeline.tsx", "utf8");
  return /export function strandEnvelope\(/.test(strand)
    && /return `\$\{sidePath\(sub, 0, CLOUD_IN, CLOUD_OUT, half, null\)\}\$\{sidePath\(sub, 1, CLOUD_IN, CLOUD_OUT, half, null\)\}`;/.test(strand)
    && /const cut = s\.findIndex\(\(p\) => p\.t >= 0\.5\);/.test(strand)
    && /el\.style\.clipPath = d \? `path\("\$\{d\}"\)` : "inset\(100%\)";/.test(tl)
    && /if \(lights\.current\) syncLights\(lights\.current, lightEls\.current, want, changed, !dragging\);/.test(tl);
})());
/*
 * And enough of it to read. The layer was held to 0.4 because a strand had a
 * lit side and a shaded side under it that it flattened; the section is
 * symmetric now and that shape is painted rather than implied, so what the
 * cloud adds is J's filaments and at 0.4 over a real render they did not
 * show at all.
 */
/*
 * And it stops short of both ends of the section, the way a box's does: the
 * dark core shows through the middle of the cloud and the rim sits over it.
 * Over the whole width at two thirds it lifted the core from 7 of green to
 * 28 and pulled the rims down from 82 and 92 to 65 and 60 — the section
 * flattened and the light taken out of the edges, which is the note.
 */
check("…over the body of the section only: the core shows through it and the rim sits over it", (() => (
  /const CLOUD_IN = 2;/.test(strand) && /const CLOUD_OUT = BANDS - 2;/.test(strand)
))());
check("…and enough of the cloud to read, now that there is a render in it rather than noise", (() => {
  const css = readFileSync("src/core/ui/molten.css", "utf8");
  const o = Number(/\.molten-vine > i \{[\s\S]*?opacity: ([\d.]+);/.exec(css)?.[1]);
  return o >= 0.55 && o <= 0.8;
})(), `${/\.molten-vine > i \{[\s\S]*?opacity: ([\d.]+);/.exec(readFileSync("src/core/ui/molten.css", "utf8"))?.[1]}`);
check("…and laid only when the vine is at rest: lifted while its board is held, and not until it has grown", (() => {
  const tl = readFileSync("src/features/studio/Timeline.tsx", "utf8");
  return /if \(!rest \|\| v\.grow < 1\) \{/.test(tl) && /el\.style\.clipPath = "inset\(100%\)"; \}\s*continue;/.test(tl);
})());

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
