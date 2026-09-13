"use client";
/**
 * The vines between iterations: a twisted cable of the boxes' own material.
 *
 * A cord with a bead travelling it reads as cargo in a pipe, and a single
 * bright line reads as a diagram. What is actually between two iterations is
 * growth — the second one is made of what the first one produced — so a vine
 * is drawn as a thing: two thick strands wound tight about a dark core, made
 * of the same stuff the boxes are, with a lit side and a shaded side and
 * light caught still in the fibres.
 *
 * **Two strands, not four.** The four-strand cable read as threaded — a rope
 * of loose ends rather than a cable — and it will not stay. Two thick strands
 * in a tight helix is the reference: a twisted pair, smooth, with a crossing
 * every half turn and nothing frayed about it.
 *
 * **Both colours run the whole length.** Not a gradient: one strand carries
 * one end's colour and the other strand the other's, end to end, so at every
 * point along the cable you see green and red side by side and never a blend
 * of the two. What shifts from end to end is the *ratio*, and with two
 * strands the ratio is thickness — the green strand is the fat one at a
 * green board and the thin one at a red drawing, and the red strand the
 * other way about. Neither ever changes colour, so there is no change-over
 * and no seam anywhere. A vine that joins two boards of the same kind is one
 * colour and its two strands are the same width.
 *
 * **The same material as the boxes.** The strands are painted in the
 * construct's own stops — `deep` for the shaded side, `body` for the lit
 * side, `hot` for the hard line of light down the edge — so a vine is
 * literally a rope of what the boxes are made of, at the same temperatures
 * (`molten.css`). The cloud that drifts over a box's face drifts over the
 * cable too, and by the same mechanism: it is not painted here. The timeline
 * lays the construct's cloud over each strand — the green cloud over the
 * green strand, the red over the red — clipped to that strand's near side
 * (`strandEnvelope`) and sliding by the same transform as a box's, so the
 * colour of a vine moves the way a box's does and costs what a box's costs,
 * which is no repaint at all. Each strand gets its own colour's cloud and
 * nothing else's: two colours that never meet cannot go through brown.
 *
 * The path is not the shortest line either. It bows out to one side, always
 * the same side for the same pair, so a run of boxes is joined by curves that
 * take a little room rather than by a taut cable.
 *
 * Five passes, in the order a solid thing is built:
 *
 * 1. **The shadow.** One dark pass, offset a pixel or two, under everything.
 *    It is what makes the vine sit on the ground rather than float over it.
 * 2. **The core.** Near black, straight down the axis, under both strands
 *    for the whole length. It is what the two wind *around*: the dark seam
 *    you see between them wherever they part. The four-strand cable put its
 *    core down *between* the back strands and the front ones, a step at a
 *    time, and where the front strand turned away the core showed through
 *    as a row of dark teeth along the edge — the serration in the old one.
 *    Once, underneath, there is nothing to poke through.
 * 3. **The strands.** The one turned away goes down first, then the one
 *    facing you — so the near one covers the far one, the way a real
 *    winding does. Nothing is blended and nothing is translucent.
 * 4. **The speculars.** A hard thin line down the edge of the strand that
 *    faces the light — a highlight, not a bloom. There is no halo anywhere
 *    on a vine; every bright pixel is on a strand.
 * 5. **The hotspots.** Light caught in the fibres, and it stays where it is.
 *    Their places and brightnesses come from the pair alone, so they are the
 *    same on every frame and after every drag.
 *
 * The cable gathers into the axis over the last few percent at each end, so
 * it meets a board's edge and terminates rather than blooming into it.
 *
 * Everything is sampled off the curve rather than stroked as a bezier,
 * because the offsets — the winding, the shades, the widths — are all
 * functions of how far along the vine a point is, which a bezier cannot say.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * A vine takes its colour from what it joins.
 *
 * Green at a green board, red at a red drawing — carried by whole strands
 * rather than mixed into the body, so a green-to-red cable is green and red
 * twisted together for its whole length and the ratio is what shifts.
 *
 * The three tones per end are the construct's own stops, the same numbers
 * `molten.css` paints the boxes with: `deep` is the shaded side, `body` the
 * lit side, `hot` the light down the edge. Held to the stylesheet by
 * `tests/vines.mjs`, so the copy cannot drift from the source. A vine is the
 * boxes' material in a rope, not a colour that happens to be near theirs.
 */
export type VineEnd = "iteration" | "drawing" | "cut";

interface Bark {
  /** The shaded side of a strand: the construct's `deep`. */
  dark: string;
  /** The lit side: the construct's `body`. */
  lit: string;
  /** The light down the edge, and a hotspot: the construct's `hot`. */
  hot: string;
}

export const VINE: Record<VineEnd, Bark> = {
  iteration: {
    dark: "oklch(0.309 0.076 148)",
    lit: "oklch(0.506 0.152 144)",
    hot: "oklch(0.798 0.209 135)",
  },
  drawing: {
    dark: "oklch(0.309 0.075 16)",
    lit: "oklch(0.506 0.15 18)",
    hot: "oklch(0.798 0.207 31)",
  },
  cut: {
    dark: "oklch(0.2 0.012 150)",
    lit: "oklch(0.3 0.014 150)",
    hot: "oklch(0.36 0.016 150)",
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
 * This mixes *within* one end's bark — its shaded side toward its lit side,
 * its lit side toward its hotspot — and nothing else. The two ends are never
 * mixed with each other: a strand is green or it is red. An earlier version
 * blended the ends along the length and the middle of every long vine came
 * out yellow and then brown, which is a colour neither board has.
 *
 * Hue still goes the short way round, so a bark's own shading never swings
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
 * The shading of one bark, worked out once at load rather than per stroke.
 *
 * A vine is a few hundred short strokes and each one used to build and parse
 * an `oklch(…)` string, which is most of what painting one cost. There are
 * only so many shades in a strand, so here they are, indexed.
 */
const SHADES = 20;

interface Ramp {
  /** Shaded side to lit side. */
  body: string[];
  /** The hard line down the edge facing the light. */
  spec: string[];
  /** Light caught in the fibres. */
  hot: string;
}

function ramp(bark: Bark): Ramp {
  const d = lch(bark.dark);
  const l = lch(bark.lit);
  const h = lch(bark.hot);
  const body: string[] = [];
  const spec: string[] = [];
  for (let i = 0; i < SHADES; i++) {
    const u = i / (SHADES - 1);
    body.push(mix(d, l, u));
    spec.push(mix(l, h, 0.5 + u * 0.5));
  }
  return { body, spec, hot: bark.hot };
}

const RAMP: Record<VineEnd, Ramp> = {
  iteration: ramp(VINE.iteration),
  drawing: ramp(VINE.drawing),
  cut: ramp(VINE.cut),
};

/** How far the strands swing from the axis. The vine is about this wide. */
export const STRAND_WIDTH = 9;

/** How many strands are wound about the core. Two: a twisted pair. */
const STRANDS = 2;

/**
 * How tight the helix is: one full turn every this many pixels of cable.
 *
 * A count of turns per span cannot be right on its own — three turns across
 * a short gap is a tight cable and three across a long one is two lines
 * lying almost parallel. A pitch keeps the same cable at every length. With
 * two strands a turn is two crossings, so this is a crossing every
 * seventeen pixels: half again the cable's width between crossings, which
 * is a twisted pair. Tighter than that and each strand shows for less than
 * its own width between crossings, and the cable reads as a chain of links
 * rather than two tubes wound together; looser and it is a ribbon.
 */
const PITCH = 34;

/** …and never fewer than this many turns, however short the gap. */
const LEAST_TURNS = 3;

/**
 * How much tighter the helix is in the middle of a span than at its ends.
 *
 * A real cable is wound hardest where it is under tension and opens out
 * where it is anchored. Kept small: the four-strand cable ran this at over a
 * half and the middle of every span turned busy, which is part of what read
 * as threaded.
 */
const TIGHTEN = 0.3;

/**
 * How far the ratio of the two colours shifts from one end to the other.
 *
 * The share of the cable's width that one end's strand has runs from
 * `0.5 - SHIFT` at the other end to `0.5 + SHIFT` at its own: three-to-one
 * at either board, never all of one colour, so both are present the whole
 * length. Two boards of the same kind sit at a half each and the shift does
 * nothing.
 */
const SHIFT = 0.25;

/** Where the light is, in the plane the timeline is drawn on: above and left. */
const LIGHT = { x: -0.55, y: -0.83 };

/** The core the two strands wind round. Near black, and it is what gives depth. */
const CORE = "oklch(0.13 0.014 150)";

/**
 * How far the path bows away from the straight line, as a share of the run.
 *
 * Less direct and a little longer, which is the difference between boxes
 * joined by growth and boxes joined by a cable.
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
 * hull of those four, let out by the width of the cable and its shadow. It
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
 * Enough per turn that the winding is a curve rather than a chain of
 * facets — twice what the four-strand cable had, because a thick strand
 * shows a corner a thin one hides. A long cable with twenty turns in it
 * gets more samples than a short one with three.
 */
function sampleCount(turns: number): number {
  return Math.max(64, Math.min(640, turns * 22));
}

interface Sample extends Point {
  /** The unit normal here: which way "sideways" is. */
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
 * Fibre: a repeatable wobble along the vine, so the bark has grain.
 *
 * Three sines that do not share a period, which is enough to read as
 * irregular and is the same every frame for the same point — a body that
 * boiled would be noise, not texture. It moves the shade a little and the
 * width not at all: a strand whose width wobbled was the lumpiness in the
 * old cable.
 */
function fibre(u: number, seed: number): number {
  return (
    Math.sin(u * 37 + seed * 1.7) * 0.5
    + Math.sin(u * 13.3 + seed * 3.1) * 0.32
    + Math.sin(u * 71.7 + seed * 5.3) * 0.18
  );
}

/**
 * How far round the helix has turned at `u`, as a share of the whole twist.
 *
 * Not `u`: its slope is a little under one at the ends and a little over in
 * the middle, so the winding is tight across the span and opens out where
 * the cable meets a board.
 */
function turned(u: number): number {
  return u - (TIGHTEN / (Math.PI * 2)) * Math.sin(u * Math.PI * 2);
}

/**
 * How wide the helix is at `u`: gathered into the axis where it meets a board.
 *
 * A cable that kept its full radius to the very end left the strands fanning
 * against the box edge. This brings them together over the last few
 * percent, so the vine arrives as one thing and stops.
 */
function girth(u: number): number {
  return 0.36 + 0.64 * Math.min(1, Math.min(u, 1 - u) / 0.07);
}

/** How many turns a cable of this length makes: a fixed pitch, with a floor. */
function turnsFor(from: Point, to: Point): number {
  const run = Math.hypot(to.x - from.x, to.y - from.y) * (1 + BOW * 0.8);
  return Math.max(LEAST_TURNS, Math.round(run / PITCH));
}

/** Where strand `b` sits across the axis at `u`, and how much it faces the eye. */
function wind(u: number, b: number, phase: number, radius: number, turns: number) {
  const turn = turned(u) * turns * Math.PI * 2 + (b * Math.PI * 2) / STRANDS + phase;
  return { across: Math.sin(turn) * radius, facing: (Math.cos(turn) + 1) / 2 };
}

/**
 * The share of the cable strand `b` has at `u`: the ratio of the two colours.
 *
 * Strand 0 carries the near end's colour and strand 1 the far end's. When
 * the ends differ, strand 0 is the fat one at its own end and thins toward
 * the other, and strand 1 the reverse; when they are the same, both are a
 * half the whole way and the cable is one colour with two equal strands.
 */
function share(u: number, b: number, mixed: boolean): number {
  if (!mixed) return 0.5;
  const s = 0.5 + (u - 0.5) * SHIFT * 2;
  return b === 0 ? 1 - s : s;
}

/** The width of a strand that has this share of the cable. */
function widthOf(s: number): number {
  return STRAND_WIDTH * 0.62 * (2 * s);
}

/**
 * The hotspots: light caught in the fibres, and it stays where it is.
 *
 * A glow that travelled the length read as a signal being sent — cargo in a
 * pipe, which is the thing this has been trying not to be since it was a
 * cord with a bead on it. These sit still. Where they are and how bright
 * each one is comes from the pair alone, so they are in the same places on
 * every frame and after every drag, and they differ from vine to vine.
 * Fewer than the four-strand cable carried: two smooth strands want less
 * on them.
 */
function hotspots(phase: number): { u: number; b: number; bright: number }[] {
  const out: { u: number; b: number; bright: number }[] = [];
  // A deterministic scatter: enough to read as many, few enough to read as
  // caught rather than painted on.
  for (let i = 0; i < 8; i++) {
    const r = Math.sin((i + 1) * 12.9898 + phase * 7.233) * 43758.5453;
    const f = r - Math.floor(r);
    const r2 = Math.sin((i + 1) * 78.233 + phase * 3.17) * 12345.678;
    const g = r2 - Math.floor(r2);
    out.push({ u: (i + f * 0.9) / 8, b: i % STRANDS, bright: 0.35 + g * 0.65 });
  }
  return out;
}

/** What one vine is made of, before anything is painted: the same for the paint and the outline. */
function build(from: Point, to: Point, opts: { ends?: [VineEnd, VineEnd]; grow?: number; tone?: StrandTone }) {
  const turns = turnsFor(from, to);
  const whole = samples(strandPath(from, to), sampleCount(turns));
  /*
   * A vine forming grows from where it leaves: `grow` is how much of it there
   * is yet, and only that much of the curve is drawn. The winding, the
   * colours and the hotspots are all functions of where a point is along the
   * whole vine, so what has grown looks exactly as it will when it is done.
   */
  const grow = Math.max(0, Math.min(1, opts.grow ?? 1));
  const s = grow >= 1 ? whole : whole.slice(0, Math.max(2, Math.ceil(whole.length * grow)));
  const dead = opts.tone === "cut";
  const [a, z] = dead ? (["cut", "cut"] as [VineEnd, VineEnd]) : (opts.ends ?? ["iteration", "iteration"]);
  return { turns, s, dead, ends: [a, z] as [VineEnd, VineEnd], mixed: a !== z, R: STRAND_WIDTH * 0.34 };
}

/**
 * The outline of one strand's near side, as an SVG path in the canvas's own
 * coordinates.
 *
 * The timeline lays the construct's drifting cloud over each vine — the
 * green cloud over the green strand and the red over the red, each clipped
 * to this — so the light is on that strand's bark and nowhere else: not on
 * the other strand, not a halo round the cable, not a glow on the ground
 * beside it. Only the runs where the strand faces the eye, because those
 * are the runs you see; where it has turned behind the other one, the
 * other one's cloud is there instead. So the two clouds never overlap and
 * the two colours never meet. Sampled off the same curve with the same
 * widths as the paint, so the two cannot disagree.
 */
export function strandEnvelope(
  from: Point,
  to: Point,
  strand: 0 | 1,
  opts: { ends?: [VineEnd, VineEnd]; grow?: number; phase?: number; tone?: StrandTone } = {},
): string {
  const { turns, s, mixed, R, dead } = build(from, to, opts);
  if (dead || s.length < 2) return "";
  const phase = (opts.phase ?? 0) * Math.PI * 2;
  const runs: string[] = [];
  let left: string[] = [];
  let right: string[] = [];
  const close = () => {
    if (left.length >= 2) runs.push(`M${left.join("L")}L${right.reverse().join("L")}Z`);
    left = [];
    right = [];
  };
  for (const p of s) {
    const { across, facing } = wind(p.t, strand, phase, R * girth(p.t), turns);
    if (facing < 0.5) { close(); continue; }
    const half = widthOf(share(p.t, strand, mixed)) / 2;
    left.push(`${(p.x + p.nx * (across + half)).toFixed(1)} ${(p.y + p.ny * (across + half)).toFixed(1)}`);
    right.push(`${(p.x + p.nx * (across - half)).toFixed(1)} ${(p.y + p.ny * (across - half)).toFixed(1)}`);
  }
  close();
  return runs.join("");
}

/**
 * Draw one vine.
 *
 * Opaque, and painted back to front: the core under everything, then at
 * every step along the axis the strand turned away, then the one facing
 * you. That order is the whole trick — it is what makes two curves read as
 * a cable with something solid inside it.
 *
 * Nothing here takes a clock. The vine is a still object and painting it is
 * a pure function of its two ends, so it is painted when one of them moves
 * and not otherwise; the colour that moves over it is the timeline's light,
 * not a repaint. `phase` is the pair's own seed, which sets where the winding
 * starts and where the hotspots fall.
 */
export function paintStrand(
  c: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  opts: { tone: StrandTone; phase?: number; lit?: number; ends?: [VineEnd, VineEnd]; grow?: number },
) {
  const lit = opts.lit ?? 1;
  const seed = opts.phase ?? 0;
  const phase = seed * Math.PI * 2;
  const W = STRAND_WIDTH;
  const { turns, s, dead, ends, mixed, R } = build(from, to, opts);
  if (s.length < 2) return;

  // What it joins, at each end. A cut vine is grey at both.
  const bark = [RAMP[ends[0]], RAMP[ends[1]]];

  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.globalAlpha = lit;

  if (dead) {
    c.strokeStyle = VINE.cut.dark;
    c.lineWidth = 2;
    c.beginPath();
    s.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.stroke();
    c.restore();
    return;
  }

  /*
   * A shadow under the whole thing, so it sits on the ground rather than
   * floating on it. One pass, the width of the vine and a little more.
   */
  c.strokeStyle = "oklch(0.08 0.01 150)";
  c.lineWidth = W * 1.3;
  c.beginPath();
  s.forEach((p, i) => (i ? c.lineTo(p.x + 1, p.y + 2) : c.moveTo(p.x + 1, p.y + 2)));
  c.stroke();

  /*
   * The core: once, whole, under both strands. It shows as the dark seam
   * between them wherever they part and nowhere else. Not put down between
   * the back strand and the front one step by step — that is what left a
   * row of dark teeth along every edge of the old cable.
   */
  c.strokeStyle = CORE;
  c.lineWidth = W * 0.5;
  c.beginPath();
  s.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.stroke();

  for (let i = 0; i < s.length - 1; i++) {
    const p = s[i]!;
    const q = s[i + 1]!;
    const u = p.t;
    const here0 = R * girth(u);
    const next0 = R * girth(q.t);

    const legs = [0, 1].map((b) => ({
      b,
      here: wind(u, b, phase, here0, turns),
      next: wind(q.t, b, phase, next0, turns),
      // Strand 0 is the near end's colour, strand 1 the far end's, the whole
      // way: neither ever changes over.
      ramp: bark[b]!,
      width: widthOf(share(u, b, mixed)),
    })).sort((x, y) => x.here.facing - y.here.facing);

    for (const leg of legs) {
      const { here, next, b, ramp, width } = leg;
      const grain = fibre(u, b * 2.7 + seed * 9);
      /*
       * The lit side and the shaded side of one strand. `facing` is how much
       * of it is turned toward the eye, so it is also the shading — and the
       * grain moves the mix a little either way, which is what stops each
       * strand being a smooth tube. A little: the width does not move at all.
       */
      const shade = Math.max(0, Math.min(1, here.facing * 0.85 + grain * 0.06));
      c.strokeStyle = ramp.body[Math.round(shade * (SHADES - 1))]!;
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(p.x + p.nx * here.across, p.y + p.ny * here.across);
      c.lineTo(q.x + q.nx * next.across, q.y + q.ny * next.across);
      c.stroke();

      /*
       * The specular: a hard thin line down the edge that faces the light,
       * not a glow around the strand. Only on the strand turned toward the
       * eye — an edge you cannot see cannot catch anything — and it is what
       * makes the cable read as the boxes' rim does: a thin bright line on a
       * dark body. Nothing down the other edge: a dark line there turned the
       * strand into a ribbon with a hem, not a tube.
       */
      if (here.facing > 0.58) {
        const side = p.nx * LIGHT.x + p.ny * LIGHT.y >= 0 ? 1 : -1;
        const off = side * (width / 2 - 0.4);
        const keen = Math.round(((here.facing - 0.58) / 0.42) * (SHADES - 1));
        c.strokeStyle = ramp.spec[Math.max(0, Math.min(SHADES - 1, keen))]!;
        c.lineWidth = 0.9;
        c.beginPath();
        c.moveTo(p.x + p.nx * (here.across + off), p.y + p.ny * (here.across + off));
        c.lineTo(q.x + q.nx * (next.across + off), q.y + q.ny * (next.across + off));
        c.stroke();
      }
    }
  }

  /* The hotspots, still, some brighter than others. */
  for (const spot of hotspots(seed)) {
    const idx = Math.max(0, Math.min(s.length - 1, Math.round(spot.u * (s.length - 1))));
    const p = s[idx]!;
    const here = wind(p.t, spot.b, phase, R * girth(p.t), turns);
    // Only the ones on this side of the turn: a light caught in the fibres
    // is hidden when the fibre it is on has turned away.
    if (here.facing < 0.45) continue;
    const hot = bark[spot.b]!.hot;
    const r = 0.6 + spot.bright * 1.3;
    c.fillStyle = hot;
    c.globalAlpha = lit * (0.45 + spot.bright * 0.55) * ((here.facing - 0.45) / 0.55);
    c.beginPath();
    c.arc(p.x + p.nx * here.across, p.y + p.ny * here.across, r, 0, Math.PI * 2);
    c.fill();
  }

  c.restore();
}

/** The middle of a strand, where the loop starter sits. */
export function strandMiddle(from: Point, to: Point): Point {
  return at(strandPath(from, to), 0.5);
}
