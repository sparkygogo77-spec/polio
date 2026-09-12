"use client";
/**
 * The vines between iterations: three beams wound round each other.
 *
 * A cord with a bead travelling it reads as cargo in a pipe, and a single
 * bright line reads as a diagram. What is actually between two iterations is
 * growth — the second one is made of what the first one produced — so a
 * strand is drawn as a vine: three beams of green light wound about a common
 * axis, several shades running through their length, fibre in the body, and
 * one glow passing through all three at once rather than chasing along one
 * of them at a time.
 *
 * It is dimmer than it was on purpose. The boxes are the lanterns and these
 * are what holds them up: a vine that outshines the fruit is the wrong way
 * round, and a screen of bright green lines was reading as the subject.
 *
 * The path is not the shortest line either. It bows out to one side, always
 * the same side for the same pair, so a run of boxes is joined by curves
 * that take a little room rather than by a taut cable.
 *
 * Six passes, in the order light stacks:
 *
 * 1. **The haze.** One wide, very dim wash along the axis: the air the vine
 *    displaces, and the only thing that keeps three thin beams reading as one
 *    object.
 * 2. **The beams.** Three ribbons at a third of a turn apart, each swinging
 *    about the axis. The one on the far side of the turn is dimmed and
 *    thinned, which is the whole of why it reads as wound rather than as
 *    three parallel lines.
 * 3. **The shades.** Each beam is stroked segment by segment, its colour
 *    walked through the greens along its length, so no beam is one flat
 *    colour end to end.
 * 4. **The fibre.** A deterministic jitter in width and alpha along each
 *    beam, so the body has grain in it rather than being a smooth tube.
 * 5. **The rim.** A hair of lighter green on the beam nearest the eye, which
 *    is what stops the whole thing reading as a glow. Lighter, not white:
 *    a white hair here would put a hot core on the vine, and that is the
 *    board's.
 * 6. **The glow.** One band of light travelling the length, hitting the same
 *    place on all three beams at the same moment.
 *
 * Everything is sampled off the curve rather than stroked as a bezier,
 * because the offsets — the winding, the shades, the fibre — are all
 * functions of how far along the vine a point is, which a bezier cannot say.
 */

export type StrandTone = "live" | "landed" | "pending" | "cut";

export interface Point {
  x: number;
  y: number;
}

/**
 * Green, in shades, for the four states a vine can be in.
 *
 * Three shades rather than one colour: a vine walks through them along its
 * length, so the eye reads a grown thing rather than a stroked path.
 *
 * The vines stayed green when the boards went green, rather than changing
 * hue to get out of the way — so they get out of the way by being pulled
 * back instead: lower through the whole range and less colour in them, and
 * **nothing on a vine is near-white**. The hot core belongs to the board,
 * which is what makes a board read as the lit thing and a vine as what holds
 * it. The brightest thing here is the travelling glow at 0.64, against a
 * board's 0.97 skin.
 */
export const STRAND = {
  live: {
    shades: ["oklch(0.46 0.095 152)", "oklch(0.54 0.11 140)", "oklch(0.4 0.08 162)"],
    rim: "oklch(0.58 0.085 148)",
    pulse: "oklch(0.64 0.1 145)",
  },
  landed: {
    shades: ["oklch(0.35 0.065 152)", "oklch(0.41 0.075 140)", "oklch(0.3 0.055 162)"],
    rim: "oklch(0.44 0.055 148)",
    pulse: "oklch(0.5 0.065 145)",
  },
  /**
   * An element prompt's vine.
   *
   * It used to be purple, to match the piece it runs to. The pieces are red
   * now — purple on purple vanished into the nebula — and the vines stayed
   * green, because green is what a connection is here whatever it connects.
   * This one is a shade younger and quicker, which is what "pending" meant.
   */
  pending: {
    shades: ["oklch(0.5 0.105 142)", "oklch(0.58 0.12 130)", "oklch(0.43 0.09 154)"],
    rim: "oklch(0.62 0.095 138)",
    pulse: "oklch(0.68 0.105 136)",
  },
  cut: {
    shades: ["oklch(0.36 0.02 152)", "oklch(0.4 0.02 152)", "oklch(0.33 0.02 152)"],
    rim: "oklch(0.44 0.02 152)",
    pulse: "oklch(0.44 0.02 152)",
  },
} as const;

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

/** Stroke a line through samples, each offset sideways by however much `off` says. */
function ribbon(c: CanvasRenderingContext2D, s: Sample[], off: (t: number) => number) {
  c.beginPath();
  s.forEach((p, i) => {
    const d = off(p.t);
    const x = p.x + p.nx * d;
    const y = p.y + p.ny * d;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  });
  c.stroke();
}

/**
 * Fibre: a repeatable wobble along the vine, so the body has grain.
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

/** Where beam `b` of three sits across the axis at `u`, and how much it faces the eye. */
function wind(u: number, b: number, phase: number, t: number, radius: number) {
  const turn = u * TWISTS * Math.PI * 2 + (b * Math.PI * 2) / 3 + phase + t * 0.18;
  return { across: Math.sin(turn) * radius, facing: (Math.cos(turn) + 1) / 2 };
}

/**
 * Draw one vine.
 *
 * `t` is seconds; `phase` staggers vines so a hundred of them are not one
 * flashing bar. `lit` dims the whole thing without changing what it is, for
 * a vine that is not the one being looked at.
 */
export function paintStrand(
  c: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  opts: { t: number; tone: StrandTone; phase?: number; lit?: number },
) {
  const tone = STRAND[opts.tone];
  const lit = opts.lit ?? 1;
  const phase = (opts.phase ?? 0) * Math.PI * 2;
  const t = opts.t;
  const W = STRAND_WIDTH;
  const s = samples(strandPath(from, to));
  const dead = opts.tone === "cut";

  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";

  if (dead) {
    // Cut: no light in it at all, and it says so by being the only flat
    // line on the screen.
    c.strokeStyle = tone.shades[0]!;
    c.globalAlpha = 0.5;
    c.lineWidth = 1.5;
    ribbon(c, s, () => 0);
    c.restore();
    return;
  }

  c.globalCompositeOperation = "lighter";

  /* 1. The haze: what keeps three thin beams reading as one object. */
  c.strokeStyle = tone.shades[0]!;
  c.globalAlpha = 0.07 * lit;
  c.lineWidth = W * 2.4;
  ribbon(c, s, () => 0);
  c.globalAlpha = 0.06 * lit;
  c.lineWidth = W * 1.2;
  ribbon(c, s, () => 0);

  /*
   * 2-5. The three beams, wound, in shades, with fibre and a rim.
   *
   * Segment by segment rather than as one stroked ribbon, because the colour
   * walks along the length and the width breathes with the fibre: a single
   * stroke can only be one colour and one width.
   */
  const speed = opts.tone === "pending" ? 0.26 : 0.18;
  for (let b = 0; b < 3; b++) {
    const seed = b * 2.7 + (opts.phase ?? 0) * 9;
    for (let i = 0; i < s.length - 1; i++) {
      const a = s[i]!;
      const z = s[i + 1]!;
      const here = wind(a.t, b, phase, t, W * 0.85);
      const next = wind(z.t, b, phase, t, W * 0.85);

      // Several shades through the length: two of the three greens, walked.
      const walk = (a.t * 2 + b / 3) % 1;
      const pick = Math.floor(walk * 3) % 3;
      c.strokeStyle = tone.shades[pick]!;

      // The far side of the turn is dimmer and thinner. That, and nothing
      // else, is why it reads as wound rather than as three parallel lines.
      const grain = fibre(a.t, seed);
      const depth = 0.3 + here.facing * 0.7;
      c.globalAlpha = Math.max(0, (0.26 + here.facing * 0.42) * lit * (0.86 + grain * 0.14));
      c.lineWidth = Math.max(0.5, W * 0.34 * depth * (0.88 + grain * 0.18));
      c.beginPath();
      c.moveTo(a.x + a.nx * here.across, a.y + a.ny * here.across);
      c.lineTo(z.x + z.nx * next.across, z.y + z.ny * next.across);
      c.stroke();

      // A hair of pale green on whichever beam is nearest the eye here.
      if (here.facing > 0.82) {
        c.strokeStyle = tone.rim;
        c.globalAlpha = 0.22 * lit * (here.facing - 0.82) / 0.18;
        c.lineWidth = 0.8;
        c.stroke();
      }
    }
  }

  /*
   * 6. The glow: one band travelling the length, through all three at once.
   *
   * It used to run along one beam and then the next, which read as three
   * separate wires taking turns. One position, `u`, is lit on every beam in
   * the same frame, so the light goes through the vine rather than along a
   * part of it.
   */
  c.strokeStyle = tone.pulse;
  for (let i = 0; i < s.length - 1; i++) {
    const u = s[i]!.t;
    const wave = Math.sin((u - t * speed + (opts.phase ?? 0)) * Math.PI * 2);
    const bright = Math.pow(Math.max(0, wave), 9);
    if (bright < 0.05) continue;
    const a = s[i]!;
    const z = s[i + 1]!;
    for (let b = 0; b < 3; b++) {
      const here = wind(a.t, b, phase, t, W * 0.85);
      const next = wind(z.t, b, phase, t, W * 0.85);
      c.globalAlpha = bright * (0.16 + here.facing * 0.3) * lit;
      c.lineWidth = W * 0.34;
      c.beginPath();
      c.moveTo(a.x + a.nx * here.across, a.y + a.ny * here.across);
      c.lineTo(z.x + z.nx * next.across, z.y + z.ny * next.across);
      c.stroke();
    }
    // …and a soft one down the axis, which is what makes the three read as
    // lit together rather than as three lit lines.
    c.globalAlpha = bright * 0.16 * lit;
    c.lineWidth = W * 1.1;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(z.x, z.y);
    c.stroke();
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
export function paintConnector(c: CanvasRenderingContext2D, from: Point, to: Point, opts: { t: number; tone: StrandTone }) {
  paintStrand(c, from, to, { ...opts, phase: 0.5 });
}
