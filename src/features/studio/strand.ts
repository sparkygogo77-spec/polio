"use client";
/**
 * The vines between iterations: a cable of strands wound round a dark core.
 *
 * A cord with a bead travelling it reads as cargo in a pipe, and a single
 * bright line reads as a diagram. What is actually between two iterations is
 * growth — the second one is made of what the first one produced — so a vine
 * is drawn as a thing: bright strands in a tight helix about a near-black
 * core, bark with grain in it, a lit side and a shaded side, and light caught
 * still in its fibres.
 *
 * **Both colours run the whole length.** Not a gradient: a strand carries one
 * end's colour or the other's and never a blend, so at every point along the
 * cable you see green and red side by side. What changes from end to end is
 * only the ratio — green strands outnumber red near a green board and the
 * other way round at a red drawing. Each strand changes over once, and it
 * does it while it is turned behind the core, so the change is never a seam.
 *
 * A vine that joins two boards of the same kind is one colour, because both
 * its ends are.
 *
 * The path is not the shortest line either. It bows out to one side, always
 * the same side for the same pair, so a run of boxes is joined by curves that
 * take a little room rather than by a taut cable.
 *
 * Five passes, in the order a solid thing is built:
 *
 * 1. **The shadow.** One dark pass, offset a pixel or two, under everything.
 *    It is what makes the vine sit on the ground rather than float over it.
 * 2. **The core.** Near black, straight down the axis, drawn between the
 *    strands that have turned away and the ones facing the eye. It is what
 *    the bright ones wind *around*, and what stops a cable from reading as a
 *    flat ribbon.
 * 3. **The strands.** Sorted at every step by how much each faces the eye and
 *    drawn furthest first — so the near one covers the far one, the way a
 *    real winding does. Nothing is blended and nothing is translucent: you
 *    cannot see the nebula through a vine, because it is a thing rather than
 *    a glow. The helix is tight, three full turns across a span, and it
 *    tightens further in the middle and relaxes where it meets a board.
 * 4. **The speculars.** A hard thin line down the edge of each strand that
 *    faces the light — a highlight, not a bloom. There is no halo anywhere
 *    on a vine; every bright pixel is on a strand.
 * 5. **The hotspots.** Light caught in the fibres, and it stays where it is.
 *    A glow that travelled the length read as a signal being sent, which is
 *    the one thing this has been trying not to be since it was a cord with a
 *    bead on it. Their places and brightnesses come from the pair alone, so
 *    they are the same on every frame and after every drag, and one on the
 *    far side of the turn is hidden.
 *
 * The cable gathers into the axis over the last few percent at each end, so
 * it meets a board's edge and terminates rather than blooming into it.
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
 * Green at a green board, red at a red drawing — but carried by whole
 * strands rather than mixed into the body, so the cable is green and red
 * twisted together for its whole length and the ratio is what shifts. Both
 * ends of a pair of boards of the same kind are the same, so most vines are
 * one colour and the rule costs nothing to look at.
 *
 * Three tones per end, and they are the tones of *bark*, not of light: this
 * is an opaque thing with a lit side and a shaded side, and the brightness in
 * it is in the speculars and the hotspots rather than in the body.
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
    lit: "oklch(0.48 0.105 146)",
    hot: "oklch(0.7 0.16 143)",
  },
  drawing: {
    dark: "oklch(0.22 0.045 24)",
    lit: "oklch(0.48 0.1 22)",
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

/** How many bright strands are wound about the core. */
const STRANDS = 4;

/**
 * How tight the helix is: one full turn every this many pixels of cable.
 *
 * A count of turns per span cannot be right on its own — three turns across
 * a short gap is a tight cable and three across a long one is four lines
 * lying almost parallel, which is what the first attempt at this looked
 * like. A pitch keeps the same cable at every length. Three turns across a
 * short span is what it works out as, which is what the reference shows.
 */
const PITCH = 30;

/** …and never fewer than this many turns, however short the gap. */
const LEAST_TURNS = 3;

/**
 * How much tighter the helix is in the middle of a span than at its ends.
 *
 * A real vine is wound hardest where it is under tension and opens out where
 * it is anchored, so the turn rate runs from a little under half in the last
 * few percent to about one and a half times in the middle.
 */
const TIGHTEN = 0.55;

/**
 * Where along the cable each strand changes which end's colour it carries.
 *
 * One strand never changes and one has changed before it starts, so both
 * colours are present at both ends: the ratio runs three-to-one, two-to-two,
 * one-to-three rather than all of one to all of the other. The two that do
 * change are staggered, and each change is moved to where that strand is
 * behind the core (see `changeAt`) so it is never a visible seam.
 */
const CROSSOVER = [2, 0.36, 0.64, -1];

/** Where the light is, in the plane the timeline is drawn on: above and left. */
const LIGHT = { x: -0.55, y: -0.83 };

/** The core the bright strands wind round. Near black, and it is what gives depth. */
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
 * Enough per turn that the winding is smooth rather than faceted, so a long
 * cable with twenty turns in it gets more samples than a short one with
 * three. A fixed count made long vines read as beads on a wire.
 */
function sampleCount(turns: number): number {
  return Math.max(48, Math.min(340, turns * 11));
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
 * boiled would be noise, not texture.
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
 * Not `u`: its slope is under half at the ends and about one and a half in
 * the middle, so the winding is tight across the span and opens out where
 * the cable meets a board.
 */
function turned(u: number): number {
  return u - (TIGHTEN / (Math.PI * 2)) * Math.sin(u * Math.PI * 2);
}

/** `turned` run backwards, by iteration — it contracts, so five passes is exact enough. */
function unturn(T: number): number {
  let u = T;
  for (let i = 0; i < 5; i++) u = T + (TIGHTEN / (Math.PI * 2)) * Math.sin(u * Math.PI * 2);
  return u;
}

/**
 * How wide the helix is at `u`: gathered into the axis where it meets a board.
 *
 * A cable that kept its full radius to the very end left four strands
 * fanning against the box edge. This brings them together over the last few
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
 * Where strand `b` changes which end's colour it carries.
 *
 * As near `want` as possible, but moved to a point where that strand has
 * turned behind the core — a strand that changed colour in plain sight would
 * be a join, and the whole point of carrying the two colours on separate
 * strands is that there is no join anywhere.
 */
function changeAt(b: number, want: number, phase: number, turns: number): number {
  if (want < 0 || want > 1) return want;
  const off = (b * Math.PI * 2) / STRANDS + phase;
  const full = turns * Math.PI * 2;
  let best = want;
  let gap = Infinity;
  // Facing is least where the turn is an odd multiple of π.
  for (let m = -turns; m <= turns * 2; m++) {
    const T = (Math.PI + 2 * Math.PI * m - off) / full;
    if (T < 0 || T > 1) continue;
    const u = unturn(T);
    if (Math.abs(u - want) < gap) {
      gap = Math.abs(u - want);
      best = u;
    }
  }
  return best;
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
    out.push({ u: (i + f * 0.9) / 14, b: i % STRANDS, bright: 0.35 + g * 0.65 });
  }
  return out;
}

/**
 * Draw one vine.
 *
 * Opaque, and painted back to front: at every step along the axis the
 * strands are sorted by how much each faces the eye, the ones turned away go
 * down first, then the core, then the ones facing you. That order is the
 * whole trick — it is what makes a flat set of curves read as a cable with
 * something solid inside it.
 *
 * Nothing here takes a clock. The vine is a still object and painting it is
 * a pure function of its two ends, so it is painted when one of them moves
 * and not otherwise. `phase` is the pair's own seed, which sets where the
 * winding starts, where the colours change over and where the hotspots fall.
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
  const turns = turnsFor(from, to);
  /*
   * A vine forming grows from where it leaves: `grow` is how much of it there
   * is yet, and only that much of the curve is drawn. The winding, the
   * colours and the hotspots are all functions of where a point is along the
   * whole vine, so what has grown looks exactly as it will when it is done.
   */
  const whole = samples(strandPath(from, to), sampleCount(turns));
  const grow = Math.max(0, Math.min(1, opts.grow ?? 1));
  const s = grow >= 1 ? whole : whole.slice(0, Math.max(2, Math.ceil(whole.length * grow)));
  if (s.length < 2) return;
  const dead = opts.tone === "cut";

  // What it joins, at each end. A cut vine is grey at both.
  const [a, z] = dead ? (["cut", "cut"] as [VineEnd, VineEnd]) : (opts.ends ?? ["iteration", "iteration"]);
  const bark = [RAMP[a], RAMP[z]];

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
  c.lineWidth = W * 1.25;
  c.beginPath();
  s.forEach((p, i) => (i ? c.lineTo(p.x + 1, p.y + 2) : c.moveTo(p.x + 1, p.y + 2)));
  c.stroke();

  /* Where each strand swaps which end's colour it is carrying. */
  const change = CROSSOVER.map((want, b) => changeAt(b, want, phase, turns));

  const R = W * 0.52;
  for (let i = 0; i < s.length - 1; i++) {
    const p = s[i]!;
    const q = s[i + 1]!;
    const u = p.t;
    const here0 = R * girth(u);
    const next0 = R * girth(q.t);

    const legs = [0, 1, 2, 3].map((b) => ({
      b,
      here: wind(u, b, phase, here0, turns),
      next: wind(q.t, b, phase, next0, turns),
      // One end's colour or the other's, never a mix of the two.
      end: u < change[b]! ? 0 : 1,
    })).sort((x, y) => x.here.facing - y.here.facing);

    let cored = false;
    const core = () => {
      if (cored) return;
      cored = true;
      c.strokeStyle = CORE;
      c.lineWidth = W * 0.44;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(q.x, q.y);
      c.stroke();
    };

    for (const leg of legs) {
      // The core goes in once the strands behind it are down: anything from
      // here on is in front of it.
      if (leg.here.facing >= 0.5) core();
      const { here, next, b } = leg;
      const ramp = bark[leg.end]!;
      const grain = fibre(u, b * 2.7 + seed * 9);
      /*
       * The lit side and the shaded side of one strand. `facing` is how much
       * of it is turned toward the eye, so it is also the shading — and the
       * grain moves the mix a little either way, which is what stops each
       * strand being a smooth tube.
       */
      const shade = Math.max(0, Math.min(1, here.facing * 0.85 + grain * 0.12));
      const width = Math.max(1.4, W * 0.42 * (0.74 + here.facing * 0.4) * (0.92 + grain * 0.1));
      c.strokeStyle = ramp.body[Math.round(shade * (SHADES - 1))]!;
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(p.x + p.nx * here.across, p.y + p.ny * here.across);
      c.lineTo(q.x + q.nx * next.across, q.y + q.ny * next.across);
      c.stroke();

      /*
       * The specular: a hard thin line down the edge that faces the light,
       * not a glow around the strand. Only on the strands turned toward the
       * eye — an edge you cannot see cannot catch anything — and it is what
       * makes the cable read as wet bark rather than as painted lines.
       */
      if (here.facing > 0.58) {
        const side = p.nx * LIGHT.x + p.ny * LIGHT.y >= 0 ? 1 : -1;
        const off = side * (width / 2 - 0.3);
        const keen = Math.round(((here.facing - 0.58) / 0.42) * (SHADES - 1));
        c.strokeStyle = ramp.spec[Math.max(0, Math.min(SHADES - 1, keen))]!;
        c.lineWidth = 0.9;
        c.beginPath();
        c.moveTo(p.x + p.nx * (here.across + off), p.y + p.ny * (here.across + off));
        c.lineTo(q.x + q.nx * (next.across + off), q.y + q.ny * (next.across + off));
        c.stroke();
      }
    }
    // Every strand was behind it: the core is the front of the cable here.
    core();
  }

  /* The hotspots, still, some brighter than others. */
  for (const spot of hotspots(seed)) {
    const idx = Math.max(0, Math.min(s.length - 1, Math.round(spot.u * (s.length - 1))));
    const p = s[idx]!;
    const here = wind(p.t, spot.b, phase, R * girth(p.t), turns);
    // Only the ones on this side of the turn: a light caught in the fibres
    // is hidden when the fibre it is on has turned away.
    if (here.facing < 0.45) continue;
    const hot = bark[p.t < change[spot.b]! ? 0 : 1]!.hot;
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

