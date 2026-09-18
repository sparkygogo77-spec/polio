/**
 * The seam where a red vine becomes a green one.
 *
 * HIS FAULT, AS IT WAS MEASURED ON THE DEPLOY: sampled along the run, the hue
 * crossed ninety degrees in eight pixels while the chroma was still a tenth.
 * Green ended and red began, and he could see the join. The fix was to stop
 * laying each end's colour over the other as a stroke of its own and make
 * every band one fill interpolated along its length.
 *
 * This holds that shut. The colour path is a pure function of where you are
 * along the run, so it is walked here directly rather than photographed:
 * every step of a thousand along a vine between a green board and a red one,
 * and what is measured is the largest step in hue, in chroma and in
 * lightness that any one of them makes.
 *
 * A seam is a STEP, not a change. A vine is meant to go from green to red;
 * what must not happen is for it to do it suddenly.
 *
 *   node --experimental-strip-types tests/vine-seam.mjs
 */
import { along, dusk, lch, VINE } from "../src/features/studio/strand.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** The shortest way round the wheel between two hues. */
const apart = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** Walk the run and report the worst single step of each kind. */
function walk(nearStop, farStop, floorStop, steps = 1000) {
  const near = lch(nearStop);
  const far = lch(farStop);
  const middle = lch(dusk(nearStop, farStop, lch(floorStop)));
  let hue = 0, chroma = 0, light = 0, at = 0;
  let prev = lch(along(near, far, middle, 0));
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    const now = lch(along(near, far, middle, u));
    /* A hue step only counts where there is enough colour for an eye to see
       it: rotating the hue of something with no chroma left is invisible. */
    const seen = Math.min(prev.c, now.c) > 0.02 ? apart(prev.h, now.h) : 0;
    if (seen > hue) { hue = seen; at = u; }
    chroma = Math.max(chroma, Math.abs(prev.c - now.c));
    light = Math.max(light, Math.abs(prev.l - now.l));
    prev = now;
  }
  return { hue, chroma, light, at };
}

/* A vine between a green board and a red drawing: the one he was looking at. */
const green = VINE.iteration.deep;
const red = VINE.drawing.deep;
const floor = VINE.iteration.char;

const run = walk(green, red, floor);
/*
 * A thousandth of the run is about a fifth of a pixel on a vine of any size
 * worth looking at, so a degree here is five degrees a pixel. The fault he
 * saw was ninety degrees in eight pixels — eleven a pixel — so anything
 * under a degree a step is an order of magnitude inside it.
 */
check(
  "the hue never jumps: it turns, the whole way",
  run.hue < 1,
  `worst hue step ${run.hue.toFixed(3)}° in a thousandth of the run, at ${(run.at * 100).toFixed(1)}% along`,
);
check(
  "and the colour never drops out from under it",
  run.chroma < 0.01,
  `worst chroma step ${run.chroma.toFixed(4)}`,
);
check(
  "nor the light",
  run.light < 0.01,
  `worst lightness step ${run.light.toFixed(4)}`,
);

/* The middle is where the two halves meet, and it is the place a seam would
   be if there were one. Both halves must arrive at the same colour, and
   arrive flat — the slope either side of it as near nothing as the rest. */
const near = lch(green), far = lch(red), mid = lch(dusk(green, red, lch(floor)));
const justBefore = lch(along(near, far, mid, 0.4995));
const justAfter = lch(along(near, far, mid, 0.5005));
check(
  "the two halves meet at the middle at the same colour",
  apart(justBefore.h, justAfter.h) < 1 && Math.abs(justBefore.c - justAfter.c) < 0.005 && Math.abs(justBefore.l - justAfter.l) < 0.005,
  `${apart(justBefore.h, justAfter.h).toFixed(3)}°, ${Math.abs(justBefore.c - justAfter.c).toFixed(4)} chroma, ${Math.abs(justBefore.l - justAfter.l).toFixed(4)} light across the join`,
);

/* And a vine between two boards of the SAME kind still runs into the dark
   and out again, rather than being one flat colour end to end. */
const same = walk(green, green, floor);
const flat = lch(along(lch(green), lch(green), lch(dusk(green, green, lch(floor))), 0.5));
check(
  "a vine between two of a kind is still lit at its ends and dark in its middle",
  lch(green).l - flat.l > 0.02,
  `ends at ${lch(green).l.toFixed(3)} light, middle at ${flat.l.toFixed(3)}`,
);
check("and it has no step in it either", same.hue < 1 && same.light < 0.01, `hue ${same.hue.toFixed(3)}°, light ${same.light.toFixed(4)}`);

/* ------------------------------------------------------------------ */
/* Does this catch a seam at all?                                      */
/* ------------------------------------------------------------------ */

/*
 * A check that is green the first time it is run, against code nobody has
 * just changed, has said nothing. So here is the thing it exists to catch:
 * the colour path as it was, with each end's colour laid over the other and
 * the crossover in the middle. If the walk above cannot tell that apart from
 * the one that ships, it is not measuring anything.
 */
const seamed = (near, far, u) => (u < 0.5 ? near : far);
{
  const near = lch(green), far = lch(red);
  let worst = 0;
  let prev = lch(seamed(green, red, 0));
  for (let i = 1; i <= 1000; i++) {
    const now = lch(seamed(green, red, i / 1000));
    if (Math.min(prev.c, now.c) > 0.02) worst = Math.max(worst, apart(prev.h, now.h));
    prev = now;
  }
  check(
    "and it would catch the seam it is here for: a crossover reads as one step of the whole distance",
    worst > 90 && run.hue < 1,
    `the old path steps ${worst.toFixed(1)}\u00b0 at once; this one\u2019s worst is ${run.hue.toFixed(3)}\u00b0`,
  );
}

console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
