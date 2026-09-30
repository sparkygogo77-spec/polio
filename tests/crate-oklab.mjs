#!/usr/bin/env node
/**
 * A crate's in-betweens are mixed in OKLab, its gaps are named by their
 * sleeves, and how it plays has one name.
 *
 * Found walking the live Builder's Motion tab:
 *   · the in-betweens were a plain RGB cross-dissolve, so halfway from a red
 *     to a green was (128, 128, 0), an olive darker than either end;
 *   · with sleeves 1, 3 and 5 filled the gaps read "1 → 2, 2 → 3, 3 → 1",
 *     numbers no sleeve wears;
 *   · the control showed "Wrap" and was named "Loop".
 *
 * Held here, on the code as written (pure, no browser):
 *   · the mix is OKLab: red to green at a half is brighter than the RGB
 *     middle and is the OKLab middle; t = 0 and t = 1 are the keyframes to
 *     the byte; a see-through side does not grey the other; the precomputed
 *     path is the same mix;
 *   · sleeves 1, 3, 5 give gaps "1 → 3", "3 → 5", "5 → 1" (round and round)
 *     and two gaps played once;
 *   · three keyframes still play, loop and blend: 45 frames at 30 a second
 *     over 1.5 s, every gap goes from its keyframe toward the next, and the
 *     last gap comes home to the first;
 *   · the three ways of playing have one name each, and the brief uses it;
 *   · a part's strip is at most 48 frames and keeps the sequence's length.
 *
 *   node --experimental-strip-types tests/crate-oklab.mjs
 */
import { fromOklab, labOf, mixLab, mixOklab, toOklab } from "../src/features/studio/oklab.ts";
import { gapCount, gapLabel, LOOP_NAME, motionBrief, newMotion, planFrames, playOrder, playSeconds, sampledPlan, sleeveOf, totalFrames } from "../src/features/studio/motion.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const px = (...c) => new Uint8ClampedArray(c);

/* ------------------------------------------------------------ the mix */
const red = px(255, 0, 0, 255), green = px(0, 255, 0, 255);
const mid = mixOklab(red, green, 0.5, new Uint8ClampedArray(4));
const luma = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
check("red to green at a half is not the dull RGB middle (128, 128, 0)", !(mid[0] === 128 && mid[1] === 128 && mid[2] === 0), `${[...mid]}`);
check("…it is brighter than that middle", luma(mid) > luma([128, 128, 0]) + 30, `luma ${luma(mid).toFixed(0)} against ${luma([128, 128, 0]).toFixed(0)}`);
const a = toOklab(255, 0, 0), b = toOklab(0, 255, 0);
const want = fromOklab((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
check("…and it is the OKLab middle, to a unit", Math.max(...want.map((v, i) => Math.abs(v - mid[i]))) <= 1, `${want} against ${[...mid.slice(0, 3)]}`);
check("t = 0 is the first keyframe to the byte", mixOklab(red, green, 0, new Uint8ClampedArray(4)).join() === red.join());
check("t = 1 is the second to the byte", mixOklab(red, green, 1, new Uint8ClampedArray(4)).join() === green.join());
const clear = px(0, 0, 0, 0);
const half = mixOklab(clear, red, 0.5, new Uint8ClampedArray(4));
check("a see-through side does not grey the other: red at half strength stays red", half[0] === 255 && half[1] === 0 && half[2] === 0 && Math.abs(half[3] - 128) <= 1, `${[...half]}`);
const many = new Uint8ClampedArray(4 * 64).map((_, i) => (i * 37) % 256);
const other = new Uint8ClampedArray(4 * 64).map((_, i) => (i * 91 + 13) % 256);
const slow = mixOklab(many, other, 0.3, new Uint8ClampedArray(many.length));
const fast = mixLab(many, other, labOf(many), labOf(other), 0.3, new Uint8ClampedArray(many.length));
check("the precomputed path the editor plays is the same mix", slow.every((v, i) => Math.abs(v - fast[i]) <= 1));
for (let i = 0; i < 256; i += 51) {
  const back = fromOklab(...toOklab(i, 255 - i, (i * 3) % 256));
  if (Math.max(Math.abs(back[0] - i), Math.abs(back[1] - (255 - i)), Math.abs(back[2] - (i * 3) % 256)) > 1) { check(`sRGB to OKLab and back keeps ${i}`, false); break; }
}

/* ------------------------------------------------------------ sleeves 1, 3, 5 */
const P = "data:image/png;base64,x";
const crate = { ...newMotion("Walk"), frames: [P, null, P, null, P] };
check("sleeves 1, 3 and 5 are keyframes 1, 2 and 3, and wear 1, 3 and 5", [0, 1, 2].map((k) => sleeveOf(crate, k)).join() === "1,3,5");
const labels = Array.from({ length: gapCount(crate) }, (_, i) => gapLabel(crate, i));
check("played round and round, the gaps read 1 → 3, 3 → 5, 5 → 1", labels.join(", ") === "1 → 3, 3 → 5, 5 → 1", labels.join(", "));
const once = { ...crate, loop: "once" };
check("played once, two gaps: 1 → 3 and 3 → 5", Array.from({ length: gapCount(once) }, (_, i) => gapLabel(once, i)).join(", ") === "1 → 3, 3 → 5");

/* ------------------------------------------------------------ three frames still play, loop and blend */
const plan = planFrames(crate);
check("three keyframes, 1.5 s at 30 a second, are 45 frames", plan.length === 45 && totalFrames(crate) === 45, `${plan.length}`);
const gapsSeen = [...new Set(plan.map((s) => `${s.from}>${s.to}`))];
check("every gap goes from a keyframe to the next, and the last comes home to the first", gapsSeen.join(" ") === "0>1 1>2 2>0", gapsSeen.join(" "));
const rising = [0, 1, 2].every((g) => {
  const ts = plan.filter((s) => s.from === g && !s.holding).map((s) => s.t);
  return ts.length > 0 && ts.every((t, i) => i === 0 || t > ts[i - 1]) && ts[0] > 0 && ts[ts.length - 1] < 1;
});
check("across each gap the blend only rises, strictly between its two keyframes", rising);
check("each keyframe is held before its gap", [0, 1, 2].every((g) => plan.some((s) => s.from === g && s.holding && s.t === 0)));
const pp = { ...crate, loop: "ping-pong" };
const ppo = playOrder(pp, planFrames(pp));
check("there and back plays forward then back, not repeating the turn", ppo.length === planFrames(pp).length * 2 - 2, `${ppo.length}`);

/* ------------------------------------------------------------ one name */
const names = Object.values(LOOP_NAME);
check("the three ways of playing have three names, none of them Wrap or Loop", new Set(names).size === 3 && !names.some((n) => /^(wrap|loop)$/i.test(n)), names.join(", "));
const brief = motionBrief(crate);
check("the brief says how it plays in the same words", /Plays: round and round/.test(brief) && !/\bwrap\b/i.test(brief), brief.split("\n").find((l) => l.startsWith("Plays")) ?? "no line");
check("the brief names the part that wears it", /the part "Hero picture"/.test(motionBrief(crate, undefined, "Hero picture")));

/* ------------------------------------------------------------ a part's strip */
const long = { ...crate, fps: 60, duration: 6 };
const strip = sampledPlan(long, 48);
check("a part's strip of a 360-frame crate is 48 frames", strip.length === 48, `${strip.length}`);
check("…starting on the first keyframe, held", strip[0].from === 0 && strip[0].holding);
check("…and plays for the crate's own 6 seconds", Math.abs(playSeconds(long) - 6) < 1e-9, `${playSeconds(long)}`);
check("a short crate's strip is every frame", sampledPlan(crate, 48).length === 45);

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
