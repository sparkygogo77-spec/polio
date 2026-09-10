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

  /* The bent slivers first: they pass behind the ring, over and under the
     shadow. Two arcs of the far side of the disc, lifted by the lensing. */
  const sliver = (up: boolean) => {
    const lift = r * 0.055;
    const g = c.createLinearGradient(cx - r, cy, cx + r, cy);
    // The same beaming as the disc: bright on the approaching side.
    const near = Math.cos(beam) < 0;
    g.addColorStop(0, near ? HOT(0.5 * breathe) : FAR(0.06));
    g.addColorStop(0.5, WARM(0.16 * breathe));
    g.addColorStop(1, near ? FAR(0.06) : HOT(0.5 * breathe));
    c.strokeStyle = g;
    c.lineWidth = Math.max(1.2, r * 0.028);
    c.beginPath();
    // An arc that hugs the horizon and flattens away from it: the far side
    // of the disc, seen over the top of the hole.
    c.ellipse(cx, cy + (up ? -lift : lift), r * 1.02, r * (up ? 0.30 : 0.26), 0, up ? Math.PI : 0, up ? TAU : Math.PI);
    c.stroke();
  };
  sliver(true);
  sliver(false);

  /* The disc itself, outside the ring: a crescent, beamed. Painted as a
     handful of rings of falling brightness, each cut by the same beaming,
     so the light thins with distance rather than stopping at an edge. */
  const bands: [number, number, (a: number) => string][] = [
    [1.012, 0.55, HOT],
    [1.04, 0.34, WARM],
    [1.09, 0.17, WARM],
    [1.17, 0.085, FAR],
    [1.3, 0.04, FAR],
    [1.5, 0.018, FAR],
  ];
  for (const [scale, alpha, tone] of bands) {
    const g = c.createLinearGradient(cx + Math.cos(beam) * r * 1.5, cy, cx - Math.cos(beam) * r * 1.5, cy);
    g.addColorStop(0, tone(alpha * breathe));
    g.addColorStop(0.42, tone(alpha * 0.28 * breathe));
    g.addColorStop(1, tone(alpha * 0.05));
    c.strokeStyle = g;
    c.lineWidth = Math.max(1, r * (scale - 1) * 1.6);
    c.beginPath();
    c.arc(cx, cy, r * ((scale + 1) / 2), 0, TAU);
    c.stroke();
  }

  /* The photon ring: the brightest thing on the screen, and thin. */
  c.strokeStyle = HOT(0.92);
  c.lineWidth = 1;
  c.beginPath();
  c.arc(cx, cy, r + 0.5, 0, TAU);
  c.stroke();
  // A second, dimmer line just outside it — the ring is not one photograph
  // sharp, and this is what stops it reading as a drawn circle.
  c.strokeStyle = WARM(0.3);
  c.lineWidth = 1;
  c.beginPath();
  c.arc(cx, cy, r + 2, 0, TAU);
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
  const g = c.createRadialGradient(r, r, r * 0.62, r, r, r);
  g.addColorStop(0, "oklch(0 0 0 / 0)");
  g.addColorStop(0.55, "oklch(0.02 0.01 290 / 0.42)");
  g.addColorStop(0.88, "oklch(0.01 0.005 290 / 0.82)");
  g.addColorStop(1, "oklch(0 0 0 / 0.96)");
  c.fillStyle = g;
  c.beginPath();
  c.arc(r, r, r, 0, Math.PI * 2);
  c.fill();
}

/** How much room the light needs outside the disc. */
export const HALO = 64;
