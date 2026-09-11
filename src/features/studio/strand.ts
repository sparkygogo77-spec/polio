"use client";
/**
 * The strands between iterations: hard light, not wire.
 *
 * A cord with a bead travelling it reads as cargo in a pipe. What is
 * actually between two iterations is charge — the second one is made of
 * what the first one produced — so a strand is drawn as a construct of
 * light: a translucent emerald body with a thin brilliant rim, marbling
 * turning over inside it, and energy running both *along* the line and
 * *around* it. Solid enough to look load-bearing, transparent enough to
 * see the nebula through.
 *
 * Five passes, in the order light stacks:
 *
 * 1. **The body.** Wide, dim, additive: the volume of the thing.
 * 2. **The marbling.** Two or three bands inside the body, each swimming
 *    laterally on its own slow phase, so the inside is never flat.
 * 3. **The rim.** A hair of near-white down each edge. This is what makes
 *    it read as a solid object rather than a glow.
 * 4. **The core.** Always lit, so the line never disappears between
 *    pulses.
 * 5. **The energy.** Bright bands running the length, and a helix of
 *    sparks turning around the axis as they go.
 *
 * Everything is sampled off the curve rather than stroked as a bezier,
 * because the offsets — marbling, rim, helix — are all functions of how
 * far along the strand a point is, which a bezier cannot say.
 */

export type StrandTone = "live" | "landed" | "pending" | "cut";

export interface Point {
  x: number;
  y: number;
}

/** Emerald, the timeline's own colour, in the four states a strand can be in. */
export const STRAND = {
  live: { body: "oklch(0.72 0.2 158)", rim: "oklch(0.97 0.14 160)", pulse: "oklch(0.99 0.12 162)", marble: "oklch(0.82 0.19 152)" },
  landed: { body: "oklch(0.58 0.15 158)", rim: "oklch(0.88 0.14 158)", pulse: "oklch(0.93 0.15 158)", marble: "oklch(0.68 0.15 150)" },
  /** An element prompt's own colour: the purple construct pieces, and the strands to them. */
  pending: { body: "oklch(0.6 0.2 300)", rim: "oklch(0.92 0.16 300)", pulse: "oklch(0.97 0.15 302)", marble: "oklch(0.7 0.2 292)" },
  cut: { body: "oklch(0.4 0.03 158)", rim: "oklch(0.5 0.03 158)", pulse: "oklch(0.5 0.03 158)", marble: "oklch(0.42 0.02 158)" },
} as const;

/** How thick the construct is. Thicker than a wire, thinner than a pipe. */
export const STRAND_WIDTH = 7;

/** The curve between two boxes: handles pulled along the way it is going. */
export function strandPath(from: Point, to: Point): [Point, Point, Point, Point] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const pull = Math.max(28, Math.min(180, Math.hypot(dx, dy) * 0.42));
  // Mostly horizontal runs bend sideways; mostly vertical ones bend down.
  const flat = Math.abs(dx) >= Math.abs(dy);
  const c1 = flat ? { x: from.x + pull, y: from.y } : { x: from.x, y: from.y + pull };
  const c2 = flat ? { x: to.x - pull, y: to.y } : { x: to.x, y: to.y - pull };
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
 * Draw one strand.
 *
 * `t` is seconds; `phase` staggers strands so a hundred of them are not
 * one flashing bar. `lit` dims the whole construct without changing what
 * it is, for a strand that is not the one being looked at.
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
    c.strokeStyle = tone.body;
    c.globalAlpha = 0.5;
    c.lineWidth = 1.5;
    ribbon(c, s, () => 0);
    c.restore();
    return;
  }

  c.globalCompositeOperation = "lighter";

  /* 1. The body: the volume, translucent. */
  c.strokeStyle = tone.body;
  c.globalAlpha = 0.16 * lit;
  c.lineWidth = W * 1.9;
  ribbon(c, s, () => 0);
  c.globalAlpha = 0.2 * lit;
  c.lineWidth = W;
  ribbon(c, s, () => 0);

  /* 2. The marbling: bands swimming inside the body, each on its own phase. */
  c.strokeStyle = tone.marble;
  for (let b = 0; b < 3; b++) {
    const k = 5 + b * 2.5;
    const speed = 0.35 + b * 0.18;
    const swing = W * (0.3 - b * 0.06);
    c.globalAlpha = (0.2 - b * 0.05) * lit;
    c.lineWidth = W * (0.42 - b * 0.08);
    ribbon(c, s, (u) => Math.sin(u * k + phase + t * speed) * swing);
  }

  /* 3. The rim: a hair of near-white down each edge. */
  c.strokeStyle = tone.rim;
  c.globalAlpha = 0.5 * lit;
  c.lineWidth = 1;
  ribbon(c, s, () => W / 2);
  ribbon(c, s, () => -W / 2);

  /* 4. The core: always lit. */
  c.globalAlpha = 0.5 * lit;
  c.lineWidth = 1.4;
  ribbon(c, s, () => 0);

  /* 5. The energy: along the line, and around it. */
  const speed = opts.tone === "pending" ? 0.3 : 0.2;
  // Along: bright bands running the length, two of them, always somewhere.
  c.strokeStyle = tone.pulse;
  for (let i = 0; i < s.length - 1; i++) {
    const u = s[i]!.t;
    const wave = Math.sin((u - t * speed + opts.phase!) * Math.PI * 2 * 2);
    const bright = Math.pow(Math.max(0, wave), 7);
    if (bright < 0.04) continue;
    c.globalAlpha = bright * 0.9 * lit;
    c.lineWidth = W * 0.5;
    c.beginPath();
    c.moveTo(s[i]!.x, s[i]!.y);
    c.lineTo(s[i + 1]!.x, s[i + 1]!.y);
    c.stroke();
  }
  // Around: a helix of sparks turning about the axis as it travels.
  c.fillStyle = tone.pulse;
  for (let i = 0; i < s.length; i += 2) {
    const p = s[i]!;
    const turn = p.t * 9 - t * (speed * 6) + phase;
    const across = Math.sin(turn) * (W * 0.62);
    // Behind the body half the time: dimmer when it is going away.
    const facing = (Math.cos(turn) + 1) / 2;
    const near = Math.max(0, Math.sin((p.t - t * speed + opts.phase!) * Math.PI * 2 * 2));
    const bright = Math.pow(near, 3) * (0.25 + facing * 0.75);
    if (bright < 0.05) continue;
    c.globalAlpha = bright * 0.8 * lit;
    const r = 0.7 + facing * 1.1;
    c.beginPath();
    c.arc(p.x + p.nx * across, p.y + p.ny * across, r, 0, Math.PI * 2);
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
export function paintConnector(c: CanvasRenderingContext2D, from: Point, to: Point, opts: { t: number; tone: StrandTone }) {
  paintStrand(c, from, to, { ...opts, phase: 0.5 });
}
