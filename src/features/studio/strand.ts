"use client";
/**
 * The vines between iterations: the boxes' own material, drawn out into a line.
 *
 * Three goes at this have been rope. A cord with a bead travelling it was
 * cargo in a pipe; four bright strands round a core were threaded and
 * frayed; two thick strands were cleaner and still a cable. The note each
 * time was the same one, and it was never really about the number of
 * strands: **a vine should not look like something tied between two boxes.
 * It should look like the boxes.**
 *
 * So it is not a cable at all. It is a **construct**, the same one the
 * boxes are (`molten.css`), stretched along a path: take the cross-section
 * of a box — the near-black core at the middle, easing out through char to
 * deep, and the thin bright rim of `hot` at the edge with a sliver of
 * `white` inside it — and run that section down a curve. Nothing is wound
 * round anything, there is nothing to fray, and every number in it is read
 * off the stylesheet rather than chosen to look similar.
 *
 * **The light comes from within it.** A box is not lit by a highlight
 * painted along one side; it is dark in the middle and the light gathers at
 * its edges, which is what makes it read as a thing glowing rather than a
 * thing with a shine on it. A vine is the same: the dark is the middle of
 * the ribbon, the light is its two edges, and there is no specular anywhere
 * — the old one had a hard line down the lit side, which is the single
 * thing that made it read as wet rope.
 *
 * **One strand, and the dark is down the middle of it.** It was two for a
 * while — green down one side and red down the other, with the seam between
 * them sliding across the width — and two colours side by side down a curve
 * is two strands however it is drawn. So the section is symmetric now: the
 * core is the axis, the light gathers at both edges, and there is one
 * ribbon rather than a pair lying against each other.
 *
 * **The colour runs along it instead, and the two flow into each other.** A vine
 * joins a green board to a red drawing and belongs to both, so it is green
 * where it leaves the green one, red where it arrives at the red one, and
 * through the middle each colour thins out over the material's own dark
 * as the other comes in, so some green flows into the red and some red
 * back into the green, each end still the majority of its own (`HOLD`).
 * Mixing the two into one colour was tried and the middle came out yellow
 * and then brown, which is a colour neither board has; laid over each
 * other, each thinning, over a dark that is the two ends' bands mixed and
 * pulled down to the lightness and the chroma of `char`, they meet without
 * making a third. A vine between two boards of the same kind runs down
 * into the same dark: lit at both ends, dark along the middle.
 *
 * **The colour moves the way a box's does.** Not painted here: the timeline
 * lays the construct's own nebula over the ribbon, clipped to it
 * (`strandEnvelope`) and gliding on the same keyframe at the same rate as
 * the cloud on every box. Two elements per vine, one for each half of its
 * length, each at that end's temperature — so the green cloud is over the
 * green half and the red over the red, and they meet where the vine is at
 * its darkest and neither shows. J's filaments cross a vine the way they
 * cross a card, which is most of what makes it the same material; it took
 * turning the layer up from a coat that flattened the section to weather
 * that reads, now that there is a real render in it rather than noise. And
 * it costs no repaint.
 *
 * **And it carries one line down its middle, which is what it is for.**
 * Cutting that line takes the iteration at the far end of the vine out of
 * the run. The line is scored into the groove at the axis rather than laid
 * on top of it, and it is faint until it is wanted: a bright line down the
 * middle with a bright rim at each edge would be three rails, and a vine
 * would be a cable again. The press that lights it and takes it is the
 * timeline's (`molten.css`, `.vine-cut`); nothing here knows about
 * pressing.
 *
 * The path is not the shortest line either. It bows out to one side, always
 * the same side for the same pair, so a run of boxes is joined by curves
 * that take a little room rather than by something pulled taut.
 *
 * Three passes, and that is all there is:
 *
 * 1. **The shadow.** One dark stroke under everything, offset a pixel or
 *    two. It is what makes the vine sit on the ground rather than float.
 * 2. **The section.** The ribbon is filled as a few long bands, both sides
 *    of the axis at once, from the axis out to the edges, in the colours the box's own
 *    face and rim are made of. Bands rather than strokes: a band is one
 *    fill of one polygon down the whole length, so a vine is ten fills
 *    however long it is, where the cable was six hundred short strokes.
 * 3. **The rim.** The outermost band, in `hot` with a sliver of `white` —
 *    the box's rim, on the edge of the ribbon, and nothing past it.
 *
 * The ribbon narrows over the last few percent at each end so it grows out
 * of a board rather than being butted against it.
 *
 * Everything is sampled off the curve rather than stroked as a bezier,
 * because the offsets — the widths and the gather — are functions of how
 * far along the vine a point is, which a bezier cannot say.
 */

import type { Band } from "./lanes";

export interface Point {
  x: number;
  y: number;
}

/**
 * A vine takes its colour from what it joins.
 *
 * Green at a green board, red at a red drawing, and the five stops are the
 * construct's own — the same numbers `molten.css` paints a face and a rim
 * with, held to the stylesheet by `tests/vines.mjs` so the copy cannot
 * drift from the source. A vine is the boxes' material, not a colour that
 * happens to be near theirs.
 */
export type VineEnd = "iteration" | "drawing" | "cut" | Band;

interface Bark {
  /** The darkest line on it: the axis, down the middle of the ribbon. `--*-core`. */
  core: string;
  /** Out of the core: `--*-char`. */
  char: string;
  /** The body of the section: `--*-deep`. */
  deep: string;
  /** The rim: `--*-hot`. */
  hot: string;
  /** The sliver inside the rim: `--*-white`. */
  white: string;
}

export const VINE: Record<VineEnd, Bark> = {
  iteration: {
    core: "oklch(0.13 0.03 149)",
    char: "oklch(0.254 0.058 149)",
    deep: "oklch(0.309 0.076 148)",
    hot: "oklch(0.798 0.209 135)",
    white: "oklch(0.888 0.208 126)",
  },
  drawing: {
    core: "oklch(0.13 0.034 16)",
    char: "oklch(0.254 0.057 15)",
    deep: "oklch(0.309 0.075 16)",
    hot: "oklch(0.798 0.207 31)",
    white: "oklch(0.888 0.206 40)",
  },
  /* A cut vine is the same section with the colour taken out of it. */
  cut: {
    core: "oklch(0.12 0.006 150)",
    char: "oklch(0.2 0.008 150)",
    deep: "oklch(0.26 0.01 150)",
    hot: "oklch(0.42 0.014 150)",
    white: "oklch(0.5 0.016 150)",
  },
  /*
   * A lane's vine is coloured by the lane: green at the top, yellow in the
   * middle, red at the bottom, the same colour as the line inside that
   * lane's rim. The same five stops as the construct's, at the same
   * lightness and chroma, turned to the band's own hue (`lanes.ts`,
   * `BAND_COLOUR`), so a lane's vine is the boxes' material like every
   * other and only its hue says which lane it is.
   */
  green: onHue(148),
  yellow: onHue(92),
  red: onHue(27),
};

/** The construct's five stops, at the construct's own lightness and chroma, on another hue. */
function onHue(hue: number): Bark {
  return {
    core: `oklch(0.13 0.03 ${hue})`,
    char: `oklch(0.254 0.058 ${hue})`,
    deep: `oklch(0.309 0.076 ${hue})`,
    hot: `oklch(0.798 0.209 ${hue})`,
    white: `oklch(0.888 0.208 ${hue})`,
  };
}

/** The four states a vine can be in, kept for the callers that name them. */
export type StrandTone = "live" | "landed" | "pending" | "cut";

/* ------------------------------------------------------------------ */
/* Mixing two oklch colours                                            */
/* ------------------------------------------------------------------ */

interface Lch { l: number; c: number; h: number }

const READ = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/;

function lch(s: string): Lch {
  const m = READ.exec(s);
  return m ? { l: +m[1]!, c: +m[2]!, h: +m[3]! } : { l: 0.3, c: 0.05, h: 150 };
}

/**
 * Two colours, `u` of the way between them.
 *
 * This mixes *within* one bark — its core toward its char, its deep toward
 * its rim — and it is the one place two ends are ever brought together, in
 * `dusk`, which immediately clamps what comes out into the dark. An earlier
 * vine blended the ends along its length without the clamp and the middle
 * of every long one came out yellow and then brown, which is a colour
 * neither board has.
 *
 * Hue still goes the short way round, so a bark's own section never swings
 * through the far side of the wheel.
 */
function mix(a: Lch, b: Lch, u: number): string {
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = (a.h + dh * u + 360) % 360;
  return `oklch(${(a.l + (b.l - a.l) * u).toFixed(3)} ${(a.c + (b.c - a.c) * u).toFixed(3)} ${h.toFixed(1)})`;
}

/**
 * The section, as the bands it is drawn in: the axis at nought, the rim at one.
 *
 * Read straight off the box's own face and rim in `molten.css`:
 *
 *     face   radial-gradient(… core 0%, core 18%, char 62%, deep 100%)
 *     rim    inset 0 0 0 1px  hot   at 82%
 *            inset 0 0 0 2px  white at 22%
 *            inset 0 0 10px -4px hot at 34%
 *
 * so the section runs core, core, core→char, char→deep, the rim's inner
 * glow, and then the rim itself with the white sliver in it. The box eases;
 * a ribbon fifteen pixels wide has no room to ease, so it is stepped — and
 * the steps are what let a whole section be eight fills rather than eight
 * hundred strokes.
 *
 * **The breakpoints sit on band centres and that is not incidental.** A
 * band is drawn in the colour at its middle, so with eight of them the
 * highest `t` any band ever asked for was 0.9375 — and while the last two
 * breakpoints sat at 0.93 and 0.98, `mix(hot, white)` was a stop no band
 * could reach and a vine had no rim at all. It read as a tube of dark
 * material rather than as the construct, which is exactly the note. Every
 * threshold below falls between two band centres.
 *
 * **And ten bands rather than eight, so each stop gets two of them.** A rim
 * one band wide is three quarters of a pixel on a ribbon this size, and
 * antialiasing against the shadow under it ate a third of the light on
 * whichever edge the shadow fell — measured across the section, one edge
 * peaked at 76 of green and the other at 49, which reads as a vine lit from
 * one side rather than lit from within. Two bands is a pixel and a half and
 * survives it. Ten fills for a vine of any length instead of eight.
 */
const BANDS = 10;

/**
 * Which bands the drifting cloud is laid over: everything but the seat of
 * the cut line and the rim. Inside `CLOUD_IN` is the groove the cut line
 * runs in, outside `CLOUD_OUT` is the rim, and both are the vine's own light
 * rather than the weather's — exactly as on a card, where the cloud lies on
 * the face with the core showing through it and the bezel over it.
 */
const CLOUD_IN = 1;
const CLOUD_OUT = BANDS - 1;

function section(bark: Bark): string[] {
  const core = lch(bark.core);
  const char = lch(bark.char);
  const deep = lch(bark.deep);
  const hot = lch(bark.hot);
  const white = lch(bark.white);
  const out: string[] = [];
  for (let i = 0; i < BANDS; i++) {
    // The middle of the band, as a share of the half-width.
    const t = (i + 0.5) / BANDS;
    // The axis: no groove. The core band read as a line running down the
    // middle of every vine, his words, so the middle is char with a little
    // of the core in it and the ribbon reads as one painted body.
    if (t < 0.10) out.push(mix(core, char, 0.75));
    else if (t < 0.30) out.push(mix(core, char, (t - 0.10) / 0.20));
    else if (t < 0.70) out.push(mix(char, deep, (t - 0.30) / 0.40));
    // The rim's inner glow: the face, warmed towards the rim rather than
    // jumping to it, which is the `inset 0 0 10px -4px` at a third.
    else if (t < 0.90) out.push(mix(deep, hot, 0.34));
    // The rim itself: `hot` held down toward the face rather than lifted
    // toward `white`. J saw the rim at the sliver's brightness as a bright
    // pink line round every red vine and asked for the darker red the
    // green-to-red vine shows; the white sliver is the box's, not the
    // vine's, and it is not used here.
    else out.push(mix(deep, hot, RIM));
  }
  return out;
}

/**
 * How far the rim band goes from the face toward `hot`.
 *
 * At one, and with a sliver of `white` in it, the rim of a vine between
 * two red drawings ran the whole length at the brightness of the box's
 * rim, and read as a bright pink outline; the vine from a green box to a
 * red drawing, whose rim goes down into the dark along the middle, looked
 * right beside it. So the rim stops short of `hot`: its lightness ends at
 * about two thirds instead of four fifths, and with the run along the
 * length dark in the middle for every vine (`FADE`), that brightness is
 * reached only where a vine meets a board.
 */
const RIM = 0.72;

const SECTION: Record<VineEnd, string[]> = {
  iteration: section(VINE.iteration),
  drawing: section(VINE.drawing),
  cut: section(VINE.cut),
  green: section(VINE.green),
  yellow: section(VINE.yellow),
  red: section(VINE.red),
};

/**
 * How wide the ribbon is, across both sides of the axis.
 *
 * Wide enough for the material to be in it. At fifteen the whole section —
 * the groove, the field, the glow and the rim — was seven and a half pixels
 * a side and every band under a pixel, which is not a construct seen small,
 * it is a tube with a line down each edge. J said so three times. At
 * twenty-four there is a field to put the cloud on and the arrangement a
 * card has is legible at the size a vine actually is.
 */
export const STRAND_WIDTH = 24;

/**
 * A lane's bracket is thinner than the timeline's vines: his words, twice.
 *
 * Three quarters was the first answer and he asked again, so it is now
 * fourteen against twenty-four — a little under three fifths, and plainly
 * the lighter line of the two. It does not go below this: the section is
 * ten bands to a side, so at fourteen the rim is seven tenths of a pixel,
 * and thinner than that the lit edge stops being an edge and the ribbon
 * goes back to being the flat line the bracket used to be.
 */
export const LANE_STRAND_WIDTH = 14;

/**
 * Where the colour stops being one end's and starts being the other's.
 *
 * Not a crossover: the two never touch. One end's colour holds to `FADE`,
 * the material's own dark holds the middle from there to `1 - FADE`, and
 * the other end's colour comes up out of it. A fifth of the length is dark,
 * which on a long vine reads as a thing lit from the boards it joins and on
 * a short one barely shows, because a short vine is nearly all end.
 */
const FADE = 0.42;

/**
 * How much of the run each end's colour keeps whole before it begins to go.
 *
 * AN EIGHTH, AND THEN IT DISSIPATES THE WHOLE WAY TO THE MIDDLE. It was
 * three tenths, with each end's colour laid over the other as a stroke of
 * its own that faded out — and two strokes, each with a start and a stop,
 * is two ribbons overlapping however gently they are faded. Sampled along
 * the run on the deploy, the hue crossed ninety degrees in eight pixels
 * while the chroma was still a tenth: green ended and red began, and he
 * could see both ends.
 *
 * So there is no overlay. Each band is one fill whose colour is
 * interpolated along the length — its own end's colour, easing into the
 * material's own dark by the middle, and out again into the other end's.
 * Nothing has a start or a stop to see. The ease is `smoothstep`, which
 * arrives at both the hold and the middle with no slope at all, so there
 * is not even a bend in the run to catch the eye where one stage becomes
 * the next.
 */
const HOLD = 0.12;

/** How many stops the ramp is written with: one every fortieth of the run. */
const RAMP_STOPS = 40;

/** Nought to one, arriving at both ends flat, so a ramp has no corners in it. */
const ease = (x: number) => x * x * (3 - 2 * x);

/**
 * One band's colour at `u` along the run: its own end's, dissolving.
 *
 * Whole to `HOLD`, then easing into the dark by the middle. The far half is
 * the same thing mirrored, so the two meet at the middle at exactly the
 * same colour and with exactly the same slope, which is nought.
 */
function along(near: Lch, far: Lch, middle: Lch, u: number): string {
  const own = u <= 0.5 ? near : far;
  const s = u <= 0.5 ? u : 1 - u;
  const k = s <= HOLD ? 0 : ease(Math.min(1, (s - HOLD) / (0.5 - HOLD)));
  return mix(own, middle, k);
}

/** Write that ramp onto a gradient, over the stretch of the run the gradient spans. */
function ramp(g: CanvasGradient, near: Lch, far: Lch, middle: Lch, a = 0, z = 1) {
  for (let i = 0; i <= RAMP_STOPS; i++) {
    const at = i / RAMP_STOPS;
    g.addColorStop(at, along(near, far, middle, a + (z - a) * at));
  }
}

/**
 * How far the path bows away from the straight line, as a share of the run.
 *
 * Less direct and a little longer, which is the difference between boxes
 * joined by growth and boxes joined by something pulled taut.
 */
const BOW = 0.22;

/**
 * The curve between two boxes: pulled along the way it is going, and bowed
 * out to one side so it takes a wider path than the shortest line.
 */
export function strandPath(from: Point, to: Point, tug = 0): [Point, Point, Point, Point] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const run = Math.hypot(dx, dy) || 1;
  /*
   * `tug` is the vine being pulled, 0 to 1: the bow comes out of it and it
   * draws a little taut, the way a slack line does when something takes
   * hold of it. His words for what a vine should do under the pointer —
   * "i would rather no line, the vine maybe pulls a little when you hover".
   * It is the shape that answers, not a bar laid over the top of it.
   */
  const taut = 1 - 0.3 * Math.max(0, Math.min(1, tug));
  const pull = Math.max(34, Math.min(210, run * 0.5)) * (1 - 0.1 * Math.max(0, Math.min(1, tug)));
  // Mostly horizontal runs bend sideways; mostly vertical ones bend down.
  const flat = Math.abs(dx) >= Math.abs(dy);
  /*
   * …and both bow across the run, always to the same side of the way it is
   * going.
   *
   * Not a side picked per pair from where the boxes happen to be: dragging a
   * box a pixel would change that answer and the vine would snap across to
   * the other side under the hand. One side of travel is stable, and because
   * boxes sit at every angle to each other the screen still gets curves
   * leaning every way.
   */
  const bow = Math.min(150, run * BOW) * taut;
  const nx = (-dy / run) * bow;
  const ny = (dx / run) * bow;
  const c1 = flat ? { x: from.x + pull + nx, y: from.y + ny } : { x: from.x + nx, y: from.y + pull + ny };
  const c2 = flat ? { x: to.x - pull + nx, y: to.y + ny } : { x: to.x + nx, y: to.y - pull + ny };
  return [from, c1, c2, to];
}

/**
 * Everything a vine between these two points can touch.
 *
 * A cubic never leaves the box round its own control points, so this is the
 * hull of those four, let out by the width of the ribbon and its shadow. It
 * is what lets the canvas repaint one vine and leave the rest alone, and it
 * has to be generous rather than exact: a rectangle that is a little too big
 * costs a few pixels, one that is too small leaves a stripe of the old vine
 * on the canvas.
 */
export function strandBounds(from: Point, to: Point): { x: number; y: number; w: number; h: number } {
  const p = strandPath(from, to);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const q of p) {
    if (q.x < minX) minX = q.x;
    if (q.x > maxX) maxX = q.x;
    if (q.y < minY) minY = q.y;
    if (q.y > maxY) maxY = q.y;
  }
  const pad = STRAND_WIDTH * 2;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

/** A point along a cubic. */
function at(p: [Point, Point, Point, Point], t: number): Point {
  const u = 1 - t;
  const [a, b, c, d] = p;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

/**
 * How many points the curve is sampled at.
 *
 * A smooth curve, so far fewer than a helix wanted: enough that the edge of
 * the ribbon is a curve rather than a chain of facets, and no more. This is
 * most of why the ribbon costs less than the cable did — every band is a
 * polygon of twice this many points, and there are eighteen of them.
 */
function sampleCount(run: number): number {
  return Math.max(24, Math.min(72, Math.round(run / 11)));
}

interface Sample extends Point {
  /** The unit normal here: which way "across" is. */
  nx: number;
  ny: number;
  t: number;
}

function samples(p: [Point, Point, Point, Point], n: number): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const here = at(p, t);
    const next = at(p, Math.min(1, t + 0.01));
    const prev = at(p, Math.max(0, t - 0.01));
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    out.push({ ...here, nx: -dy / len, ny: dx / len, t });
  }
  return out;
}

/**
 * How wide the ribbon is at `u`: gathered a little where it meets a board.
 *
 * Not much — a ribbon does not fan the way a cable did — but enough that it
 * grows out of a board rather than being butted against it.
 */
function gather(u: number): number {
  return 0.62 + 0.38 * Math.min(1, Math.min(u, 1 - u) / 0.06);
}

/** What one vine is made of, before anything is painted: the same for the paint and the outline. */
interface Build {
  ends?: [VineEnd, VineEnd];
  grow?: number;
  tone?: StrandTone;
  /** How wide the ribbon is, across both sides of the axis. `STRAND_WIDTH` unless the caller says. */
  width?: number;
  /** How hard it is being pulled, 0..1: the bow comes out of it. */
  tug?: number;
  /**
   * How far the break has opened, 0..1.
   *
   * A cut vine does not blink out. It parts at its middle and the two ends
   * draw back towards the boards they came from, crumbling as they go —
   * "when click vanishes and fades away and disintegrates from the middle".
   * At 1 there is nothing of it left.
   */
  cut?: number;
}

function build(from: Point, to: Point, opts: Build) {
  const run = Math.hypot(to.x - from.x, to.y - from.y) * (1 + BOW * 0.8);
  const whole = samples(strandPath(from, to, opts.tug ?? 0), sampleCount(run));
  /*
   * A vine forming grows from where it leaves: `grow` is how much of it
   * there is yet, and only that much of the curve is drawn. The widths and
   * the gradient are functions of where a point is along the *whole* vine,
   * so what has grown looks exactly as it will when it is done.
   */
  const grow = Math.max(0, Math.min(1, opts.grow ?? 1));
  const s = grow >= 1 ? whole : whole.slice(0, Math.max(2, Math.ceil(whole.length * grow)));
  const dead = opts.tone === "cut";
  const [a, z] = dead ? (["cut", "cut"] as [VineEnd, VineEnd]) : (opts.ends ?? ["iteration", "iteration"]);
  const width = opts.width ?? STRAND_WIDTH;
  /*
   * The break, as two pieces of the one curve.
   *
   * Sliced rather than erased: every sample carries where it is along the
   * *whole* vine, so a piece of it is painted with the widths and the
   * colours it would have had — and nothing is rubbed off the canvas, so a
   * vine crossing this one is not punched through while this one goes.
   */
  const cut = Math.max(0, Math.min(1, opts.cut ?? 0));
  const pieces = cut <= 0
    ? [s]
    : [s.filter((p) => p.t <= 0.5 - cut / 2), s.filter((p) => p.t >= 0.5 + cut / 2)].filter((piece) => piece.length >= 2);
  return { s, pieces, cut, dead, ends: [a, z] as [VineEnd, VineEnd], half: width / 2, width };
}

/**
 * The middle of a mixed vine: the two ends' bands, pulled down into the dark.
 *
 * Neither end's colour reaches the other, so the only question is what sits
 * between them, and the answer cannot be a mix — green and red meet at
 * yellow going one way round the wheel and at blue going the other, and
 * both are colours neither board has. So the mix is taken and then clamped
 * to the lightness and the chroma of `char`, the second darkest stop the
 * material has. At that lightness a hue cannot be read, so what is left is
 * the material's own dark rather than a third colour — and the inner bands,
 * which are already darker than `char`, are not touched by the clamp at
 * all.
 */
function dusk(a: string, z: string, floor: Lch): string {
  const m = lch(mix(lch(a), lch(z), 0.5));
  return `oklch(${Math.min(m.l, floor.l).toFixed(3)} ${Math.min(m.c, floor.c).toFixed(3)} ${m.h.toFixed(1)})`;
}

/**
 * Where one band of the section runs, across the ribbon, at `u`.
 *
 * `k` counts out from the axis, so band 0 is the middle of the ribbon and
 * band `BANDS` its edge, and `side` is which way out — 0 the positive way
 * across and 1 the negative. The two sides are the same section mirrored,
 * which is what makes it one strand: the dark is down the middle of it and
 * the light is at both edges, the way a box is dark in the middle and lit
 * around it.
 */
function bandAt(u: number, side: 0 | 1, k: number, half: number): number {
  const edge = side === 0 ? half : -half;
  return edge * (k / BANDS) * gather(u);
}

/**
 * One side of the ribbon, as a path: the axis down one way, the edge back.
 *
 * `k0`..`k1` are band numbers out from the axis, so the whole side is 0 to
 * `BANDS` and one band is `k` to `k + 1`.
 */
function sidePath(s: Sample[], side: 0 | 1, k0: number, k1: number, half: number, into: CanvasRenderingContext2D | null): string {
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const p = s[i]!;
    const a = bandAt(p.t, side, k1, half);
    const b = bandAt(p.t, side, k0, half);
    const ax = p.x + p.nx * a, ay = p.y + p.ny * a;
    const bx = p.x + p.nx * b, by = p.y + p.ny * b;
    if (into) {
      if (i === 0) into.moveTo(ax, ay);
      else into.lineTo(ax, ay);
    } else {
      outer.push(`${ax.toFixed(1)} ${ay.toFixed(1)}`);
      inner.push(`${bx.toFixed(1)} ${by.toFixed(1)}`);
    }
  }
  if (into) {
    for (let i = s.length - 1; i >= 0; i--) {
      const p = s[i]!;
      const b = bandAt(p.t, side, k0, half);
      into.lineTo(p.x + p.nx * b, p.y + p.ny * b);
    }
    into.closePath();
    return "";
  }
  return `M${outer.join("L")}L${inner.reverse().join("L")}Z`;
}

/**
 * The outline of one half of the ribbon's *length*, as an SVG path in the
 * canvas's own coordinates.
 *
 * The timeline lays the construct's drifting cloud over the vine, clipped
 * to this, so the weather on a vine is the weather on a box. It is halves
 * of the length rather than sides of the width because that is where the
 * colour changes now: the green cloud goes over the half that leaves the
 * green board and the red over the half that arrives at the red one, and
 * they meet in the middle, where the vine is at its darkest and neither of
 * them shows. The whole width each, so J's filaments cross a vine the way
 * they cross a card.
 *
 * **Not the whole width: the body of it, between the axis and the rim.**
 * The cloud is a layer at two thirds, so wherever it lies it pulls what is
 * under it towards the tile's own middling dark — measured across a vine,
 * over the whole width it lifted the core from 7 of green to 28 and pulled
 * the rims down from 82 and 92 to 65 and 60, which is the section flattened
 * and the light taken out of the edges. That is the same note as before,
 * answered properly this time: on a box the cloud lies on the *face*, the
 * dark core shows through the middle of it and the rim sits over it, and a
 * vine is arranged the same way. The two innermost bands and the two
 * outermost are the vine's core and its rim, and the cloud stops short of
 * both.
 *
 * Two subpaths, one per side of the axis, because that is what `sidePath`
 * makes and the union of them is the ribbon's body. Sampled off the same
 * curve with the same widths as the paint, so the two cannot disagree.
 */
export function strandEnvelope(
  from: Point,
  to: Point,
  part: 0 | 1,
  opts: Build = {},
): string {
  const { s, half, dead } = build(from, to, opts);
  if (dead || s.length < 2) return "";
  /* A hair of overlap at the join, so a rounding error cannot leave a gap
     of bare bark between the two clouds. */
  const cut = s.findIndex((p) => p.t >= 0.5);
  const sub = part === 0
    ? s.slice(0, cut < 0 ? s.length : Math.min(s.length, cut + 2))
    : s.slice(Math.max(0, (cut < 0 ? s.length : cut) - 1));
  if (sub.length < 2) return "";
  return `${sidePath(sub, 0, CLOUD_IN, CLOUD_OUT, half, null)}${sidePath(sub, 1, CLOUD_IN, CLOUD_OUT, half, null)}`;
}

/**
 * How wide the cut line's own target is, across the ribbon, in pixels.
 *
 * The line is what a vine is *for* — cutting it takes the iteration out —
 * so it has to be pressable without being a thing you press by accident. A
 * third of the ribbon, centred on the groove the line already sits in.
 */
export const SEAM_WIDTH = 7;

/* ------------------------------------------------------------------ */
/* The bracket: the same ribbon, with square corners                    */
/* ------------------------------------------------------------------ */

/**
 * A run of straight legs with right-angle turns, drawn in the same material.
 *
 * The lanes are not joined by curves. They are a **bracket**: a spine out of
 * the last box, a turn, and an arm into each lane, square corners, fixed,
 * never moving. That was the original shape and the geometry was right; what
 * was wrong with it was that it was a flat line with no body. So it is the
 * vine's own section — dark down the axis, lit at both edges, the cloud over
 * it — bent round square corners instead of bowed, and thinner than the
 * timeline's.
 *
 * A corner is mitred by letting each leg overrun it by half the ribbon's
 * width. Without that the outside of every turn is a missing square the size
 * of the half-width, because a leg's end is square to its own direction and
 * the next leg's start is square to another. With it, the two fills cover the
 * corner between them and the turn is a clean right angle.
 *
 * The colour runs along the whole bracket, not along each leg: a leg's
 * gradient is written over the stretch of the *whole* run that leg occupies,
 * so the two colours dissipate into each other across the turns exactly as
 * they do along a curve, and a corner is not a place where anything starts
 * or stops.
 */
interface Leg {
  a: Point;
  z: Point;
  /** Where this leg begins and ends, as a share of the whole run. */
  t0: number;
  t1: number;
  /** The unit normal: which way "across" is on this leg. */
  nx: number;
  ny: number;
}

function legsOf(corners: Point[], half: number): Leg[] {
  const out: Leg[] = [];
  const runs: { a: Point; z: Point; len: number }[] = [];
  for (let i = 0; i + 1 < corners.length; i++) {
    const a = corners[i]!;
    const z = corners[i + 1]!;
    const len = Math.hypot(z.x - a.x, z.y - a.y);
    if (len > 0.5) runs.push({ a, z, len });
  }
  const total = runs.reduce((n, r) => n + r.len, 0) || 1;
  let done = 0;
  runs.forEach((r, i) => {
    const ux = (r.z.x - r.a.x) / r.len;
    const uy = (r.z.y - r.a.y) / r.len;
    // Overrun into the corners, and only into the corners: the two ends of
    // the whole bracket stay where the box and the lane put them.
    const back = i > 0 ? half : 0;
    const on = i + 1 < runs.length ? half : 0;
    out.push({
      a: { x: r.a.x - ux * back, y: r.a.y - uy * back },
      z: { x: r.z.x + ux * on, y: r.z.y + uy * on },
      t0: (done - back) / total,
      t1: (done + r.len + on) / total,
      nx: -uy,
      ny: ux,
    });
    done += r.len;
  });
  return out;
}

/** A leg, as samples the ribbon's own band maths can read. */
function legSamples(leg: Leg): Sample[] {
  const len = Math.hypot(leg.z.x - leg.a.x, leg.z.y - leg.a.y);
  const n = Math.max(2, Math.min(24, Math.round(len / 9)));
  const out: Sample[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    out.push({
      x: leg.a.x + (leg.z.x - leg.a.x) * u,
      y: leg.a.y + (leg.z.y - leg.a.y) * u,
      nx: leg.nx,
      ny: leg.ny,
      t: leg.t0 + (leg.t1 - leg.t0) * u,
    });
  }
  return out;
}

/** Everything a bracket through these corners can touch. */
export function bracketBounds(corners: Point[], width = LANE_STRAND_WIDTH): { x: number; y: number; w: number; h: number } {
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const pad = width * 1.5;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
}

/** The bracket's body, as an SVG path, for the cloud to be clipped to. */
export function bracketEnvelope(corners: Point[], width = LANE_STRAND_WIDTH): string {
  const half = width / 2;
  return legsOf(corners, half)
    .map((leg) => {
      const s = legSamples(leg);
      return `${sidePath(s, 0, CLOUD_IN, CLOUD_OUT, half, null)}${sidePath(s, 1, CLOUD_IN, CLOUD_OUT, half, null)}`;
    })
    .join(" ");
}

export function paintBracket(
  c: CanvasRenderingContext2D,
  corners: Point[],
  opts: { ends: [VineEnd, VineEnd]; width?: number; lit?: number },
) {
  const width = opts.width ?? LANE_STRAND_WIDTH;
  const half = width / 2;
  const legs = legsOf(corners, half);
  if (!legs.length) return;
  const near = SECTION[opts.ends[0]]!;
  const far = SECTION[opts.ends[1]]!;
  const floor = lch(VINE[opts.ends[0]].char);

  c.save();
  c.lineCap = "butt";
  c.lineJoin = "miter";
  c.miterLimit = 4;
  c.globalAlpha = opts.lit ?? 1;

  // The shadow, the whole run in one stroke, so it sits on the ground.
  c.strokeStyle = "oklch(0.08 0.01 150)";
  c.lineWidth = width * 1.16;
  c.beginPath();
  corners.forEach((p, i) => (i ? c.lineTo(p.x + 1, p.y + 2) : c.moveTo(p.x + 1, p.y + 2)));
  c.stroke();

  for (let k = 0; k < BANDS; k++) {
    const middle = lch(dusk(near[k]!, far[k]!, floor));
    for (const leg of legs) {
      const s = legSamples(leg);
      const g = c.createLinearGradient(leg.a.x, leg.a.y, leg.z.x, leg.z.y);
      ramp(g, lch(near[k]!), lch(far[k]!), middle, leg.t0, leg.t1);
      c.fillStyle = g;
      c.beginPath();
      for (const side of [0, 1] as const) sidePath(s, side, k, Math.min(BANDS, k + 1.12), half, c);
      c.fill();
    }
  }
  c.restore();
}

/**
 * The cut line down the middle of a vine, as an SVG path.
 *
 * The timeline lays one small element over each vine clipped to this: it is
 * the thing that takes the press, and hovering it lights the line so what
 * would be cut is plain before anything is. Two subpaths, one each side of
 * the axis, because that is what `sidePath` makes.
 */
export function strandSeam(
  from: Point,
  to: Point,
  opts: Build = {},
): string {
  const { s, half, dead } = build(from, to, opts);
  if (dead || s.length < 2) return "";
  const k = (SEAM_WIDTH / 2) / half * BANDS;
  return `${sidePath(s, 0, 0, k, half, null)}${sidePath(s, 1, 0, k, half, null)}`;
}

/**
 * Draw one vine.
 *
 * Opaque, and built from the middle out: the shadow, then each side of the
 * section band by band from the axis out to both rims. Nothing is blended and
 * nothing is translucent — you cannot see the nebula through a vine,
 * because it is a construct rather than a glow.
 *
 * Nothing here takes a clock. The vine is a still object and painting it is
 * a pure function of its two ends, so it is painted when one of them moves
 * and not otherwise; the colour that moves over it is the timeline's cloud,
 * not a repaint.
 */
export function paintStrand(
  c: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  opts: Build & { tone: StrandTone; lit?: number },
) {
  const lit = opts.lit ?? 1;
  const { pieces, cut, dead, ends, half, width } = build(from, to, opts);
  if (!pieces.length) return;

  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  /* Going, and going dimmer as it goes: the break opening and the vine
     fading are one gesture, not two. */
  c.globalAlpha = lit * (1 - cut * 0.8);

  /*
   * A shadow under the whole thing, so it sits on the ground rather than
   * floating on it. One stroke, the width of the ribbon and a little more.
   */
  c.strokeStyle = "oklch(0.08 0.01 150)";
  c.lineWidth = width * 1.16;
  for (const piece of pieces) {
    c.beginPath();
    piece.forEach((p, i) => (i ? c.lineTo(p.x + 1, p.y + 2) : c.moveTo(p.x + 1, p.y + 2)));
    c.stroke();
  }

  /*
   * The section, a band at a time, from the axis out to both rims.
   *
   * One fill per band, both sides of the axis in the same path — ten
   * fills for a vine of any length — where the cable was a stroke per
   * strand per step, six hundred of them. The bands overlap by a hair so
   * there is no line between them, and there is no seam anywhere: the
   * darkest part of a vine is its axis, which is where the section starts.
   */
  const near = SECTION[ends[0]]!;
  const far = SECTION[ends[1]]!;
  const floor = lch(VINE[ends[0]].char);
  /*
   * Every vine runs down into the dark along its middle, whatever it
   * joins. The ramp was the mixed vine's alone, and a vine between two
   * boards of the same kind was one flat colour end to end, rim and all:
   * J put the two side by side and asked for the darker one. So a vine
   * between two red drawings, or two green boxes, is lit where it leaves
   * and where it arrives and is the material's own dark between, exactly
   * as the vine from the green box to the red drawing is. Only a cut vine
   * stays flat, and it has no colour to lose.
   */
  const ramped = !dead;
  /**
   * The run, as one ramp per band.
   *
   * The axis is the straight line between the boards and not the curve,
   * which is right: a linear gradient projects onto its axis, so a point
   * halfway along the bow is halfway along the gradient, and a vine still
   * growing is coloured as it will be when it is done.
   */
  const band = (k: number) => {
    c.beginPath();
    for (const piece of pieces) for (const side of [0, 1] as const) sidePath(piece, side, k, Math.min(BANDS, k + 1.12), half, c);
    c.fill();
  };
  for (let k = 0; k < BANDS; k++) {
    if (!ramped) { c.fillStyle = near[k]!; band(k); continue; }
    /*
     * One fill a band, and one colour at every point of it. It was three —
     * the dark the whole length, then each end's colour laid over it and
     * thinned out — and that is two ribbons over a third however softly
     * they are faded, which is exactly what he saw.
     */
    const g = c.createLinearGradient(from.x, from.y, to.x, to.y);
    ramp(g, lch(near[k]!), lch(far[k]!), lch(dusk(near[k]!, far[k]!, floor)));
    c.fillStyle = g;
    band(k);
  }

  /*
   * THE CUT LINE, down the middle, and it is what the vine is for.
   *
   * One line scored along the axis: the core band either side of it is the
   * groove it lies in, so it reads as a seam in the material rather than as
   * a highlight painted along it — dark, then light, then dark, which is
   * how a scored line looks and is the opposite of the shine on a cable.
   * It is drawn in the rim's own colour, because the light on a construct
   * is one light.
   *
   * The timeline puts a small element over it to take the press
   * (`strandSeam`); nothing here knows about pressing.
   */
  /*
   * THE CUT LINE, down the middle, and it is what the vine is for: nothing
   * is painted for it at rest. A faint thread was scored along the axis
   * and he saw it as a line running down the middle of every vine that
   * should not be seen. The seam is still there to press (`strandSeam`):
   * the timeline lays a small element over it; what a press does to the
   * vine is the break above, and there is nothing to light.
   */

  /*
   * The crumbling edge.
   *
   * Two ends drawing back from a break look like a line being trimmed.
   * What makes it read as *disintegrating* is what comes off them: a
   * handful of pieces of the material, thrown from where the break is
   * opening, getting smaller and dimmer as the vine goes. Deterministic
   * from where they are on the curve, so a repaint mid-cut draws the same
   * grains rather than a fresh shower every frame.
   */
  if (cut > 0.001 && cut < 0.999) {
    const grit = SECTION[ends[0]]![Math.max(0, BANDS - 2)]!;
    c.fillStyle = grit;
    c.globalAlpha = lit * (1 - cut) * 0.75;
    for (const piece of pieces) {
      const edge = piece[piece.length - 1]!.t <= 0.5 ? piece[piece.length - 1]! : piece[0]!;
      const away = piece[piece.length - 1]!.t <= 0.5 ? 1 : -1;
      for (let i = 0; i < 7; i++) {
        /* One number off the grain's own index and where the edge is, so
           the same grain is in the same place every frame of the cut. */
        const r = Math.abs(Math.sin((i + 1) * 12.9898 + edge.t * 78.233)) % 1;
        const back = (i / 7) * cut * 46 * away;
        const across = (r - 0.5) * half * 2.4 * (0.4 + cut);
        const size = Math.max(0.6, half * 0.26 * (1 - i / 9) * (1 - cut));
        c.beginPath();
        c.arc(edge.x + edge.nx * across + (away > 0 ? -back : back), edge.y + edge.ny * across, size, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  c.restore();
}

/**
 * The middle of a strand: the point on the curve, not on the line between
 * the boxes.
 *
 * Nothing sits there any more — a small green node did, and it is gone —
 * but where the curve's middle is *against* that straight line is how far a
 * vine bows, which is the thing `tests/vines.mjs` measures.
 */
export function strandMiddle(from: Point, to: Point): Point {
  return at(strandPath(from, to), 0.5);
}
