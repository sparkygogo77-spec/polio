"use client";
/**
 * The drawing board's edge, drawn as a black hole.
 *
 * It was an orange aura: a warm halo bleeding out of the disc, which read
 * as a glow round a plate rather than the thing itself. A photograph of a
 * black hole looks nothing like that, and the disc is already a hole in the
 * screen, so this draws what the photographs show.
 *
 * Four things, in the order light does them:
 *
 * - **The shadow.** Just inside the rim the surface falls to near black.
 *   Nothing is lit from within; whatever is inside is inside.
 * - **The photon ring.** A hair of near-white right at the edge, one pixel
 *   of it and no more, because that is what it is: light that went round.
 *   Everything else on the board is dimmer than this line.
 * - **The disc, beamed.** The accretion light outside the ring is bright on
 *   the approaching side and faint on the receding one — the same material,
 *   coming and going at a good fraction of light. The bright side is a
 *   crescent, not a halo, and the dim side is barely there.
 * - **The bent slivers.** The far side of the disc is not hidden behind the
 *   hole: it is bent over the top and under the bottom, so a thin arc of it
 *   shows above and below the shadow, brighter where the beaming is.
 *
 * Nothing else lights the screen. The colour is the near-white-into-amber a
 * hot disc actually is, not orange paint, and it falls off fast enough that
 * a few tens of pixels out there is nothing left.
 */

export interface HoleOptions {
  /** The middle of the hole, in canvas pixels. */
  cx: number;
  cy: number;
  /** The event horizon: where the drawing surface ends. */
  r: number;
  /** Seconds since the board opened; the disc turns, slowly. */
  t: number;
  /** Which way the approaching side is, in degrees. Left by default. */
  beam?: number;
}

/** The disc's colours: white-hot at the ring, amber a little out, gone soon after. */
const HOT = (a: number) => `oklch(0.98 0.06 85 / ${a})`;
const WARM = (a: number) => `oklch(0.86 0.16 72 / ${a})`;
const FAR = (a: number) => `oklch(0.68 0.17 55 / ${a})`;

/**
 * Paint the hole. The canvas must be bigger than the disc — the light lives
 * outside it — and the middle of it must be `(cx, cy)`.
 *
 * The drawing surface itself is left alone: everything here is either
 * outside `r` or a shadow laid just inside it.
 */
export function paintBlackHole(c: CanvasRenderingContext2D, o: HoleOptions) {
  const { cx, cy, r, t } = o;
  const beam = ((o.beam ?? 180) * Math.PI) / 180;
  const TAU = Math.PI * 2;
  // The disc wobbles a little, the way a photograph taken on another night
  // is not the same photograph. Slow enough to never be caught moving.
  const breathe = 0.92 + 0.08 * Math.sin((t / 26) * TAU);

  c.save();
  // Light adds. Every stroke here is light, so they pile up where they cross
  // instead of painting over one another, which is what makes the crescent
  // and the ring look lit rather than drawn.
  c.globalCompositeOperation = "lighter";

  /* The bent slivers: the far side of the disc, lifted over the top of the
     hole and under the bottom by the lensing, so it shows as a thin arc
     outside the rim where nothing should be able to be. Flattened, because
     what is being seen is a disc nearly edge-on, bent. */
  const sliver = (up: boolean) => {
    const rx = r * 1.15;
    const ry = r * 1.055;
    const from = up ? Math.PI + 0.42 : 0.42;
    const to = up ? TAU - 0.42 : Math.PI - 0.42;
    const steps = 60;
    c.lineWidth = Math.max(1.1, r * 0.02);
    for (let i = 0; i < steps; i++) {
      const a0 = from + ((to - from) * i) / steps;
      const a1 = from + ((to - from) * (i + 1.05)) / steps;
      const face = Math.max(0, Math.cos((a0 + a1) / 2 - beam));
      // Ends taper to nothing, so it is a sliver rather than a hoop.
      const taper = Math.sin((Math.PI * i) / steps);
      const lit = (0.12 + 0.88 * Math.pow(face, 3)) * taper;
      if (lit < 0.02) continue;
      c.strokeStyle = WARM(0.5 * lit * breathe);
      c.beginPath();
      c.ellipse(cx, cy, rx, ry, 0, a0, a1);
      c.stroke();
    }
  };
  sliver(true);
  sliver(false);

  /* The disc itself, outside the ring: a crescent, beamed.

     The falloff outward is a radial gradient centred on the hole, so it is
     smooth however it is cut; the falloff *round* the ring is done segment
     by segment, because beaming is angular — brightest where the material
     is coming at you, nothing where it is going away — and no gradient
     across the box can say that. Rings at set radii made bands you could
     count, which is a diagram, not light. */
  {
    const inner = r * 1.001;
    const outer = r * 1.42;
    const g = c.createRadialGradient(cx, cy, inner, cx, cy, outer);
    g.addColorStop(0, HOT(0.5));
    g.addColorStop(0.06, WARM(0.34));
    g.addColorStop(0.22, WARM(0.13));
    g.addColorStop(0.5, FAR(0.05));
    g.addColorStop(1, "oklch(0 0 0 / 0)");
    c.strokeStyle = g;
    c.lineWidth = outer - inner;
    const rad = (inner + outer) / 2;
    const SEGS = 180;
    // Laid down, not added: segments that overlap under `lighter` leave a
    // comb of brighter seams — a spoked wheel, which is the one thing this
    // must not look like.
    c.globalCompositeOperation = "source-over";
    for (let i = 0; i < SEGS; i++) {
      const a0 = (i / SEGS) * TAU;
      const a1 = ((i + 1.02) / SEGS) * TAU;
      // One at the approaching side, nothing at the receding one, and the
      // fourth power because beaming is not a gentle thing.
      const face = Math.max(0, Math.cos((a0 + a1) / 2 - beam));
      const lit = Math.pow(face, 4) * 0.96 + 0.04;
      c.globalAlpha = lit * breathe;
      c.beginPath();
      c.arc(cx, cy, rad, a0, a1);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "lighter";
  }

  /* The bright side's bloom: the crescent bleeds a little into the dark,
     the way an overexposed edge does, and only on the side that is coming. */
  {
    const bx = cx + Math.cos(beam) * r * 0.5;
    const by = cy + Math.sin(beam) * r * 0.5;
    const g = c.createRadialGradient(bx, by, r * 0.2, bx, by, r * 1.25);
    g.addColorStop(0, WARM(0.12 * breathe));
    g.addColorStop(0.45, WARM(0.05 * breathe));
    g.addColorStop(1, "oklch(0 0 0 / 0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r * 1.9, 0, TAU);
    c.fill();
  }

  /* The photon ring: the brightest thing on the screen, and thin. */
  c.strokeStyle = "oklch(1 0.02 90 / 1)";
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(cx, cy, r + 0.6, 0, TAU);
  c.stroke();
  // A hair of bloom either side of it — a ring this bright is never one
  // pixel clean in a photograph — and nothing else beyond.
  c.strokeStyle = HOT(0.5);
  c.lineWidth = 1.6;
  c.beginPath();
  c.arc(cx, cy, r + 2, 0, TAU);
  c.stroke();
  c.strokeStyle = WARM(0.22);
  c.lineWidth = 2.4;
  c.beginPath();
  c.arc(cx, cy, r + 4, 0, TAU);
  c.stroke();
  c.strokeStyle = WARM(0.2);
  c.lineWidth = 1;
  c.beginPath();
  c.arc(cx, cy, r - 0.6, 0, TAU);
  c.stroke();

  c.restore();
}

/**
 * The shadow inside the rim, laid over the drawing surface.
 *
 * Painted in the board's own frame (the disc's canvas), after everything
 * else, so the surface fades into black as it approaches the horizon and
 * the strokes near the edge fade with it. Nothing about it is a border.
 */
export function paintHorizonShadow(c: CanvasRenderingContext2D, size: number) {
  const r = size / 2;
  const g = c.createRadialGradient(r, r, r * 0.5, r, r, r);
  g.addColorStop(0, "oklch(0 0 0 / 0)");
  g.addColorStop(0.4, "oklch(0.02 0.01 290 / 0.4)");
  g.addColorStop(0.72, "oklch(0.01 0.005 290 / 0.78)");
  g.addColorStop(0.92, "oklch(0 0 0 / 0.95)");
  g.addColorStop(1, "oklch(0 0 0 / 1)");
  c.fillStyle = g;
  c.beginPath();
  c.arc(r, r, r, 0, Math.PI * 2);
  c.fill();
}

/** How much room the light needs outside the disc. */
export const HALO = 64;
