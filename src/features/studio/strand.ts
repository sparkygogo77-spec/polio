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
 * **The colour runs along it instead, and the two never meet.** A vine
 * joins a green board to a red drawing and belongs to both, so it is green
 * where it leaves the green one, red where it arrives at the red one, and
 * in between it goes down to the material's own dark — not through a mix.
 * Blending the ends was tried and the middle of every vine came out yellow
 * and then brown, which is a colour neither board has; the way through is
 * that the light in a construct gathers where the construct is, and a vine
 * far from either board has nothing lighting it. Each band is one fill with
 * a gradient along the run, so it is still one fill per band whatever the
 * colours are, and the darkening is a clamp rather than a colour: the two
 * ends' bands are mixed and then pulled down to the lightness and the
 * chroma of `char`, where a hue cannot be read. A vine between two boards
 * of the same kind has no gradient at all.
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
export type VineEnd = "iteration" | "drawing" | "cut";

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
};

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
 * Which bands the drifting cloud is laid over: the body, and neither end of
 * the section. Inside `CLOUD_IN` is the dark axis, outside `CLOUD_OUT` is
 * the rim, and both are the vine's own light rather than the weather's.
 */
const CLOUD_IN = 2;
const CLOUD_OUT = BANDS - 2;

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
    if (t < 0.25) out.push(bark.core);
    else if (t < 0.45) out.push(mix(core, char, (t - 0.25) / 0.20));
    else if (t < 0.65) out.push(mix(char, deep, (t - 0.45) / 0.20));
    // The rim's inner glow: the face, warmed towards the rim rather than
    // jumping to it, which is the `inset 0 0 10px -4px` at a third.
    else if (t < 0.85) out.push(mix(deep, hot, 0.34));
    // The rim itself, with the white sliver mixed into it.
    else out.push(mix(hot, white, 0.22));
  }
  return out;
}

const SECTION: Record<VineEnd, string[]> = {
  iteration: section(VINE.iteration),
  drawing: section(VINE.drawing),
  cut: section(VINE.cut),
};

/** How wide the ribbon is, across both sides of the axis. */
export const STRAND_WIDTH = 15;

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
export function strandPath(from: Point, to: Point): [Point, Point, Point, Point] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const run = Math.hypot(dx, dy) || 1;
  const pull = Math.max(34, Math.min(210, run * 0.5));
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
  const bow = Math.min(150, run * BOW);
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
function build(from: Point, to: Point, opts: { ends?: [VineEnd, VineEnd]; grow?: number; tone?: StrandTone }) {
  const run = Math.hypot(to.x - from.x, to.y - from.y) * (1 + BOW * 0.8);
  const whole = samples(strandPath(from, to), sampleCount(run));
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
  return { s, dead, ends: [a, z] as [VineEnd, VineEnd], mixed: a !== z, half: STRAND_WIDTH / 2 };
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
  opts: { ends?: [VineEnd, VineEnd]; grow?: number; tone?: StrandTone } = {},
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
  opts: { tone: StrandTone; lit?: number; ends?: [VineEnd, VineEnd]; grow?: number },
) {
  const lit = opts.lit ?? 1;
  const { s, dead, ends, mixed, half } = build(from, to, opts);
  if (s.length < 2) return;

  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.globalAlpha = lit;

  /*
   * A shadow under the whole thing, so it sits on the ground rather than
   * floating on it. One stroke, the width of the ribbon and a little more.
   */
  c.strokeStyle = "oklch(0.08 0.01 150)";
  c.lineWidth = STRAND_WIDTH * 1.16;
  c.beginPath();
  s.forEach((p, i) => (i ? c.lineTo(p.x + 1, p.y + 2) : c.moveTo(p.x + 1, p.y + 2)));
  c.stroke();

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
  for (let k = 0; k < BANDS; k++) {
    /*
     * One fill, and the colour along it is the gradient's job rather than
     * another polygon's. The axis is the straight line between the boards
     * and not the curve, which is right: a linear gradient projects onto
     * its axis, so a point halfway along the bow is halfway along the
     * gradient, and a vine still growing is coloured as it will be when it
     * is done.
     */
    if (mixed) {
      const g = c.createLinearGradient(from.x, from.y, to.x, to.y);
      const dark = dusk(near[k]!, far[k]!, floor);
      g.addColorStop(0, near[k]!);
      g.addColorStop(FADE, dark);
      g.addColorStop(1 - FADE, dark);
      g.addColorStop(1, far[k]!);
      c.fillStyle = g;
    } else {
      c.fillStyle = near[k]!;
    }
    c.beginPath();
    for (const side of [0, 1] as const) sidePath(s, side, k, Math.min(BANDS, k + 1.12), half, c);
    c.fill();
  }

  c.restore();
}

/** The middle of a strand, where the loop starter sits. */
export function strandMiddle(from: Point, to: Point): Point {
  return at(strandPath(from, to), 0.5);
}
