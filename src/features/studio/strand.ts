"use client";
/**
 * The strands between iterations: energy in a line, not a bead on a wire.
 *
 * The trail's cords were braided vines with a bright node travelling them,
 * which read as a package being delivered — something moving *along* a
 * pipe. What is actually between two iterations is not cargo, it is
 * charge: the second one carries what the first one made. So a strand is
 * one tight line, a little thicker than a hairline, with light moving
 * *inside* it: bands of brightness that run the length of the cord and
 * fade, and a steady core under them so the line never disappears.
 *
 * They are drawn on a canvas under the boxes and re-measured every frame
 * from where the boxes actually are, so dragging a box stretches its
 * strands rather than leaving them behind. The curve is a cubic with its
 * handles pulled along the axis of travel, which is what makes two boxes
 * side by side connect with a lazy S rather than a diagonal.
 */

export type StrandTone = "live" | "landed" | "pending" | "cut";

export interface Point {
  x: number;
  y: number;
}

/** Emerald, the timeline's own colour, in the four states a strand can be in. */
export const STRAND = {
  live: { core: "oklch(0.86 0.19 158)", glow: "oklch(0.72 0.2 158)", pulse: "oklch(0.96 0.14 160)" },
  landed: { core: "oklch(0.62 0.14 158)", glow: "oklch(0.5 0.12 158)", pulse: "oklch(0.82 0.16 158)" },
  pending: { core: "oklch(0.6 0.18 300)", glow: "oklch(0.5 0.18 300)", pulse: "oklch(0.86 0.18 300)" },
  cut: { core: "oklch(0.42 0.03 158)", glow: "oklch(0.34 0.02 158)", pulse: "oklch(0.5 0.03 158)" },
} as const;

/** How thick a strand is at rest. Tighter than the old vines, and one line rather than four. */
export const STRAND_WIDTH = 2.4;

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

/** A point along a cubic, and the direction it is going. */
function at(p: [Point, Point, Point, Point], t: number): Point {
  const u = 1 - t;
  const [a, b, c, d] = p;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

/**
 * Draw one strand.
 *
 * Three passes: a wide soft glow that says where the line is in the dark, a
 * core that is always there, and the energy — short bands of brightness
 * running the length of it, each fading in and out so the line pulses
 * rather than parades. `t` is seconds; `phase` staggers strands so a
 * hundred of them are not one flashing bar.
 */
export function paintStrand(
  c: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  opts: { t: number; tone: StrandTone; phase?: number; lit?: number },
) {
  const p = strandPath(from, to);
  const tone = STRAND[opts.tone];
  const lit = opts.lit ?? 1;
  const phase = opts.phase ?? 0;
  const line = () => {
    c.beginPath();
    c.moveTo(p[0].x, p[0].y);
    c.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y);
  };

  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";

  // The glow: wide, dim, and only worth having on a strand that is alive.
  if (opts.tone !== "cut") {
    c.globalCompositeOperation = "lighter";
    c.strokeStyle = tone.glow;
    c.globalAlpha = 0.16 * lit;
    c.lineWidth = STRAND_WIDTH * 4.5;
    line();
    c.stroke();
  }

  // The core: always there, so a strand is never invisible between pulses.
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = opts.tone === "cut" ? 0.5 : 0.75 * lit;
  c.strokeStyle = tone.core;
  c.lineWidth = STRAND_WIDTH;
  line();
  c.stroke();

  // The energy: bands of light inside the line, running its length.
  if (opts.tone !== "cut") {
    c.globalCompositeOperation = "lighter";
    const SEGS = 44;
    const speed = opts.tone === "pending" ? 0.22 : 0.14;
    for (let i = 0; i < SEGS; i++) {
      const t0 = i / SEGS;
      const t1 = (i + 1.2) / SEGS;
      // A travelling wave rather than a single bead: two humps, always
      // somewhere along the line, brightest in the middle of each.
      const wave = Math.sin((t0 - opts.t * speed + phase) * Math.PI * 2 * 2);
      const bright = Math.pow(Math.max(0, wave), 6);
      if (bright < 0.03) continue;
      const a = at(p, t0);
      const b = at(p, Math.min(1, t1));
      c.globalAlpha = bright * 0.85 * lit;
      c.strokeStyle = tone.pulse;
      c.lineWidth = STRAND_WIDTH * 0.9;
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
  }
  c.restore();
}

/** The middle of a strand, where the loop starter sits. */
export function strandMiddle(from: Point, to: Point): Point {
  return at(strandPath(from, to), 0.5);
}
