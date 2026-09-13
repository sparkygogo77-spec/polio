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
 * **Both colours run the whole length, and the dark middle is the seam.**
 * A vine joins a green board to a red drawing and belongs to both. So the
 * ribbon is green down one side and red down the other, end to end, and
 * what shifts is where the seam sits across its width: the green side is
 * three-quarters of it at a green board and a quarter at a red drawing. The
 * two colours meet only at the seam, which is the near-black core — the
 * darkest line on the vine — so they never mix and never go through brown.
 * A vine between two boards of the same kind is that colour on both sides,
 * seam down the middle, and the rule costs nothing to look at.
 *
 * **The colour moves the way a box's does.** Not painted here: the timeline
 * lays the construct's own nebula over each side of the ribbon, clipped to
 * that side (`strandEnvelope`) and gliding on the same keyframe at the same
 * rate as the cloud on every box. So a vine is not a still picture of the
 * material next to a moving one — it is the same weather, and it costs no
 * repaint.
 *
 * The path is not the shortest line either. It bows out to one side, always
 * the same side for the same pair, so a run of boxes is joined by curves
 * that take a little room rather than by something pulled taut.
 *
 * Three passes, and that is all there is:
 *
 * 1. **The shadow.** One dark stroke under everything, offset a pixel or
 *    two. It is what makes the vine sit on the ground rather than float.
 * 2. **The section.** Each side of the ribbon is filled as a few long
 *    bands, from the seam out to the edge, in the colours the box's own
 *    face and rim are made of. Bands rather than strokes: a band is one
 *    fill of one polygon down the whole length, so a vine is eighteen fills
 *    however long it is, where the cable was six hundred short strokes.
 * 3. **The rim.** The outermost band, in `hot` with a sliver of `white` —
 *    the box's rim, on the edge of the ribbon, and nothing past it.
 *
 * The ribbon narrows over the last few percent at each end so it grows out
 * of a board rather than being butted against it.
 *
 * Everything is sampled off the curve rather than stroked as a bezier,
 * because the offsets — the seam, the widths, the gather — are functions of
 * how far along the vine a point is, which a bezier cannot say.
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
  /** The darkest line on it: the middle of the ribbon, and the seam. `--*-core`. */
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
 * its rim — and nothing else. The two ends are never mixed with each other:
 * a side of the ribbon is green or it is red. An earlier vine blended the
 * ends along its length and the middle of every long one came out yellow
 * and then brown, which is a colour neither board has.
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
 * The section, as the bands it is drawn in: the seam at nought, the rim at one.
 *
 * Read straight off the box's own face and rim in `molten.css`:
 *
 *     face   radial-gradient(… core 0%, core 18%, char 62%, deep 100%)
 *     rim    inset 0 0 0 1px  hot   at 82%
 *            inset 0 0 0 2px  white at 22%
 *            inset 0 0 10px -4px hot at 34%
 *
 * so the section runs core, core, core→char, char→deep, deep, deep warmed
 * by the rim's inner glow, hot, hot with the white sliver in it. The box
 * eases; a ribbon nine pixels wide has no room to ease, so it is stepped —
 * and the steps are what let a whole side be eight fills rather than eight
 * hundred strokes.
 */
const BANDS = 8;

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
    if (t < 0.18) out.push(bark.core);
    else if (t < 0.62) out.push(mix(core, char, (t - 0.18) / 0.44));
    else if (t < 0.86) out.push(mix(char, deep, (t - 0.62) / 0.24));
    // The rim's inner glow: the face, warmed towards the rim rather than
    // jumping to it, which is the `inset 0 0 10px -4px` at a third.
    else if (t < 0.93) out.push(mix(deep, hot, 0.34));
    else if (t < 0.98) out.push(mix(deep, hot, 0.82));
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

/** How wide the ribbon is, across both sides of the seam. */
export const STRAND_WIDTH = 15;

/**
 * How far the seam moves across the width from one end to the other.
 *
 * The share of the ribbon one end's colour has runs from `0.5 - SHIFT` at
 * the far board to `0.5 + SHIFT` at its own: three to one at either end,
 * never all of one colour, so both are there the whole length. Two boards
 * of the same kind sit at a half each and the shift does nothing at all.
 */
const SHIFT = 0.25;

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

/**
 * Where the seam sits across the width at `u`, as a share of the ribbon.
 *
 * Nought is hard against one edge, one against the other, a half is the
 * middle. The near end's colour has the larger share at its own end.
 */
function seamAt(u: number, mixed: boolean): number {
  if (!mixed) return 0.5;
  return 0.5 + (0.5 - u) * SHIFT * 2;
}

/** What one vine is made of, before anything is painted: the same for the paint and the outline. */
function build(from: Point, to: Point, opts: { ends?: [VineEnd, VineEnd]; grow?: number; tone?: StrandTone }) {
  const run = Math.hypot(to.x - from.x, to.y - from.y) * (1 + BOW * 0.8);
  const whole = samples(strandPath(from, to), sampleCount(run));
  /*
   * A vine forming grows from where it leaves: `grow` is how much of it
   * there is yet, and only that much of the curve is drawn. The seam and
   * the widths are functions of where a point is along the *whole* vine, so
   * what has grown looks exactly as it will when it is done.
   */
  const grow = Math.max(0, Math.min(1, opts.grow ?? 1));
  const s = grow >= 1 ? whole : whole.slice(0, Math.max(2, Math.ceil(whole.length * grow)));
  const dead = opts.tone === "cut";
  const [a, z] = dead ? (["cut", "cut"] as [VineEnd, VineEnd]) : (opts.ends ?? ["iteration", "iteration"]);
  return { s, dead, ends: [a, z] as [VineEnd, VineEnd], mixed: a !== z, half: STRAND_WIDTH / 2 };
}

/**
 * Where one band of the section runs, across the ribbon, at `u`.
 *
 * `side` 0 is the near end's colour and 1 the far end's; `k` counts out
 * from the seam, so band 0 is the seam itself and band `BANDS` the edge.
 * Both are offsets from the axis, in pixels, signed: side 0 is the positive
 * way across and side 1 the negative.
 */
function bandAt(u: number, side: 0 | 1, k: number, half: number, mixed: boolean): number {
  /* `seamAt` is the share of the width side 0 has, and side 0 is the
     positive way across, so the seam sits that far in from the + edge. */
  const seam = (1 - 2 * seamAt(u, mixed)) * half;
  const edge = side === 0 ? half : -half;
  return (seam + (edge - seam) * (k / BANDS)) * gather(u);
}

/**
 * One side of the ribbon, as a path: the seam down one way, the edge back.
 *
 * `k0`..`k1` are band numbers out from the seam, so the whole side is 0 to
 * `BANDS` and one band is `k` to `k + 1`.
 */
function sidePath(s: Sample[], side: 0 | 1, k0: number, k1: number, half: number, mixed: boolean, into: CanvasRenderingContext2D | null): string {
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const p = s[i]!;
    const a = bandAt(p.t, side, k1, half, mixed);
    const b = bandAt(p.t, side, k0, half, mixed);
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
      const b = bandAt(p.t, side, k0, half, mixed);
      into.lineTo(p.x + p.nx * b, p.y + p.ny * b);
    }
    into.closePath();
    return "";
  }
  return `M${outer.join("L")}L${inner.reverse().join("L")}Z`;
}

/**
 * The outline of one side of the ribbon, as an SVG path in the canvas's own
 * coordinates.
 *
 * The timeline lays the construct's drifting cloud over each side of the
 * vine, clipped to this — the green cloud on the green side and the red on
 * the red — so the weather on a vine is the weather on a box, and the two
 * colours still never touch: the clips meet at the seam and stop. Sampled
 * off the same curve with the same widths as the paint, so the two cannot
 * disagree.
 */
export function strandEnvelope(
  from: Point,
  to: Point,
  side: 0 | 1,
  opts: { ends?: [VineEnd, VineEnd]; grow?: number; tone?: StrandTone } = {},
): string {
  const { s, mixed, half, dead } = build(from, to, opts);
  if (dead || s.length < 2) return "";
  return sidePath(s, side, 0, BANDS, half, mixed, null);
}

/**
 * Draw one vine.
 *
 * Opaque, and built from the middle out: the shadow, then each side of the
 * section band by band from the seam to the rim. Nothing is blended and
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
   * The section, a band at a time, from the seam out to each rim.
   *
   * One fill of one long polygon per band — eighteen fills for a vine of
   * any length — where the cable was a stroke per strand per step, six
   * hundred of them. The bands overlap by a hair so there is no seam
   * between them; the only seam on a vine is the one in the middle, where
   * the two colours meet at their darkest.
   */
  for (const side of [0, 1] as const) {
    const ramp = SECTION[ends[side]]!;
    for (let k = 0; k < BANDS; k++) {
      c.fillStyle = ramp[k]!;
      c.beginPath();
      sidePath(s, side, k, Math.min(BANDS, k + 1.12), half, mixed, c);
      c.fill();
    }
  }

  c.restore();
}

/** The middle of a strand, where the loop starter sits. */
export function strandMiddle(from: Point, to: Point): Point {
  return at(strandPath(from, to), 0.5);
}
