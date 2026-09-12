"use client";
/**
 * The vines between iterations: three beams wound round each other.
 *
 * A cord with a bead travelling it reads as cargo in a pipe, and a single
 * bright line reads as a diagram. What is actually between two iterations is
 * growth — the second one is made of what the first one produced — so a
 * strand is drawn as a tree vine: three opaque strands wound about a common
 * axis, bark with grain in it, a lit side and a shaded side, and light caught
 * still in its fibres.
 *
 * It takes its colour from what it joins — green where it leaves a green
 * board, red where it arrives at a red drawing, changing along its length
 * rather than at a join. And it is darker than either end's board, because a
 * vine is bark with light caught in it and a board is the lit thing.
 *
 * The path is not the shortest line either. It bows out to one side, always
 * the same side for the same pair, so a run of boxes is joined by curves
 * that take a little room rather than by a taut cable.
 *
 * Four passes, in the order a solid thing is built:
 *
 * 1. **The shadow.** One dark pass, offset a pixel or two, under everything.
 *    It is what makes the vine sit on the ground rather than float over it.
 * 2. **The strands.** Three of them, a third of a turn apart, sorted at every
 *    step by how much each faces the eye and drawn furthest first — so the
 *    near one covers the far one, the way a real winding does. Nothing is
 *    blended and nothing is translucent: you cannot see the nebula through a
 *    vine, because it is a thing rather than a glow.
 * 3. **The bark.** How much a strand faces the eye is also its shading, mixed
 *    between a shaded side and a lit one, with a deterministic grain moving
 *    it a little either way so no strand is a smooth tube.
 * 4. **The hotspots.** Light caught in the fibres, and it stays where it is.
 *    A glow that travelled the length read as a signal being sent, which is
 *    the one thing this has been trying not to be since it was a cord with a
 *    bead on it. Their places and brightnesses come from the pair alone, so
 *    they are the same on every frame and after every drag, and one on the
 *    far side of the turn is hidden.
 *
 * Everything is sampled off the curve rather than stroked as a bezier,
 * because the offsets — the winding, the shades, the fibre — are all
 * functions of how far along the vine a point is, which a bezier cannot say.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * A vine takes its colour from what it joins.
 *
 * Green at a green board, red at a red drawing, and the change happens along
 * its length rather than at a join: a vine between the two is green at one
 * end and red at the other, which is what makes the timeline read as one
 * growth rather than as cables of assorted colours. Both ends of a pair of
 * boards of the same kind are the same, so most vines are one colour and the
 * gradient costs nothing to look at.
 *
 * Three tones per end, and they are the tones of *bark*, not of light: this
 * is an opaque thing with a lit side and a shaded side, and the brightness in
 * it is in the hotspots rather than in the body.
 */
export type VineEnd = "iteration" | "drawing" | "cut";

interface Bark {
  /** The shaded side of a strand. */
  dark: string;
  /** The lit side. */
  lit: string;
  /** A hotspot caught in the fibres. */
  hot: string;
}

export const VINE: Record<VineEnd, Bark> = {
  iteration: {
    dark: "oklch(0.22 0.045 150)",
    lit: "oklch(0.42 0.09 146)",
    hot: "oklch(0.7 0.16 143)",
  },
  drawing: {
    dark: "oklch(0.22 0.045 24)",
    lit: "oklch(0.42 0.09 22)",
    hot: "oklch(0.7 0.15 26)",
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
 * Hue goes the short way round, which for green to red means through the
 * yellows rather than through the blues — bark browning toward the red end
 * rather than passing through a colour neither end has.
 */
function mix(a: Lch, b: Lch, u: number): string {
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = (a.h + dh * u + 360) % 360;
  return `oklch(${(a.l + (b.l - a.l) * u).toFixed(3)} ${(a.c + (b.c - a.c) * u).toFixed(3)} ${h.toFixed(1)})`;
}

/** How far the three beams swing from the axis. The vine is about this wide. */
export const STRAND_WIDTH = 7;

/** How many turns the three beams make between one box and the next. */
const TWISTS = 2.1;

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

/** A point along a cubic. */
function at(p: [Point, Point, Point, Point], t: number): Point {
  const u = 1 - t;
  const [a, b, c, d] = p;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

/** How many points the curve is sampled at. Enough that the marbling is smooth at any length. */
const SAMPLES = 72;

interface Sample extends Point {
  /** The unit normal here: which way "sideways" is. */
  nx: number;
  ny: number;
  t: number;
}

function samples(p: [Point, Point, Point, Point]): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
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
 * boiled would be noise, not texture.
 */
function fibre(u: number, seed: number): number {
  return (
    Math.sin(u * 37 + seed * 1.7) * 0.5
    + Math.sin(u * 13.3 + seed * 3.1) * 0.32
    + Math.sin(u * 71.7 + seed * 5.3) * 0.18
  );
}

/** Where strand `b` of three sits across the axis at `u`, and how much it faces the eye. */
function wind(u: number, b: number, phase: number, radius: number) {
  const turn = u * TWISTS * Math.PI * 2 + (b * Math.PI * 2) / 3 + phase;
  return { across: Math.sin(turn) * radius, facing: (Math.cos(turn) + 1) / 2 };
}

/**
 * The hotspots: light caught in the fibres, and it stays where it is.
 *
 * A glow that travelled the length read as a signal being sent — cargo in a
 * pipe, which is the thing this has been trying not to be since it was a
 * cord with a bead on it. These sit still. Where they are and how bright
 * each one is comes from the pair alone, so they are in the same places on
 * every frame and after every drag, and they differ from vine to vine.
 */
function hotspots(phase: number): { u: number; b: number; bright: number }[] {
  const out: { u: number; b: number; bright: number }[] = [];
  // A deterministic scatter: enough to read as many, few enough to read as
  // caught rather than painted on.
  for (let i = 0; i < 14; i++) {
    const r = Math.sin((i + 1) * 12.9898 + phase * 7.233) * 43758.5453;
    const f = r - Math.floor(r);
    const r2 = Math.sin((i + 1) * 78.233 + phase * 3.17) * 12345.678;
    const g = r2 - Math.floor(r2);
    out.push({ u: (i + f * 0.9) / 14, b: i % 3, bright: 0.35 + g * 0.65 });
  }
  return out;
}

/**
 * Draw one vine.
 *
 * Opaque, and painted back to front: at every step along the axis the three
 * strands are sorted by how much each faces the eye and drawn furthest
 * first, so the near one covers the far one the way a real winding does.
 * Nothing is blended and nothing is translucent — a vine is a thing, not a
 * glow, and you cannot see the nebula through it.
 *
 * `t` is seconds, and almost nothing here uses it: the vine is a still
 * object. `phase` is the pair's own seed, which sets where the winding
 * starts and where the hotspots fall.
 */
export function paintStrand(
  c: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  opts: { t: number; tone: StrandTone; phase?: number; lit?: number; ends?: [VineEnd, VineEnd] },
) {
  const lit = opts.lit ?? 1;
  const phase = (opts.phase ?? 0) * Math.PI * 2;
  const W = STRAND_WIDTH;
  const s = samples(strandPath(from, to));
  const dead = opts.tone === "cut";

  // What it joins, at each end. A cut vine is grey at both.
  const [a, z] = dead ? (["cut", "cut"] as [VineEnd, VineEnd]) : (opts.ends ?? ["iteration", "iteration"]);
  const barkA = { dark: lch(VINE[a].dark), lit: lch(VINE[a].lit), hot: lch(VINE[a].hot) };
  const barkZ = { dark: lch(VINE[z].dark), lit: lch(VINE[z].lit), hot: lch(VINE[z].hot) };

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
  c.lineWidth = W * 1.5;
  c.beginPath();
  s.forEach((p, i) => (i ? c.lineTo(p.x + 1, p.y + 2) : c.moveTo(p.x + 1, p.y + 2)));
  c.stroke();

  /* The three strands, back to front at every step. */
  const R = W * 0.52;
  for (let i = 0; i < s.length - 1; i++) {
    const p = s[i]!;
    const q = s[i + 1]!;
    const u = p.t;
    const dark = mix(barkA.dark, barkZ.dark, u);
    const light = mix(barkA.lit, barkZ.lit, u);

    const legs = [0, 1, 2].map((b) => {
      const here = wind(u, b, phase, R);
      const next = wind(q.t, b, phase, R);
      return { b, here, next };
    }).sort((x, y) => x.here.facing - y.here.facing);

    for (const leg of legs) {
      const { here, next, b } = leg;
      const grain = fibre(u, b * 2.7 + (opts.phase ?? 0) * 9);
      /*
       * The lit side and the shaded side of one strand. `facing` is how much
       * of it is turned toward the eye, so it is also the shading — and the
       * grain moves the mix a little either way, which is what stops each
       * strand being a smooth tube.
       */
      const shade = Math.max(0, Math.min(1, here.facing * 0.85 + grain * 0.12));
      c.strokeStyle = mix(lch(dark), lch(light), shade);
      c.lineWidth = Math.max(1, W * 0.38 * (0.72 + here.facing * 0.42) * (0.92 + grain * 0.1));
      c.beginPath();
      c.moveTo(p.x + p.nx * here.across, p.y + p.ny * here.across);
      c.lineTo(q.x + q.nx * next.across, q.y + q.ny * next.across);
      c.stroke();
    }
  }

  /* The hotspots, still, some brighter than others. */
  for (const spot of hotspots(opts.phase ?? 0)) {
    const at = Math.max(0, Math.min(s.length - 1, Math.round(spot.u * (s.length - 1))));
    const p = s[at]!;
    const here = wind(p.t, spot.b, phase, R);
    // Only the ones on this side of the turn: a light caught in the fibres
    // is hidden when the fibre it is on has turned away.
    if (here.facing < 0.45) continue;
    const hot = mix(barkA.hot, barkZ.hot, p.t);
    const r = 0.7 + spot.bright * 1.5;
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

/**
 * The short connector between a box and the card growing out of it.
 *
 * The same construct, straight up or straight down, so the card reads as
 * something the box extruded rather than a panel that appeared next to it.
 */
export function paintConnector(c: CanvasRenderingContext2D, from: Point, to: Point, opts: { t: number; tone: StrandTone; end?: VineEnd }) {
  // Both ends are the same board, so it is one colour end to end.
  const end = opts.end ?? "iteration";
  paintStrand(c, from, to, { ...opts, phase: 0.5, ends: [end, end] });
}
