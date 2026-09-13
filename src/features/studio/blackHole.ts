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
 *
 * **Two horizons.** The drawing disc's is a circle, and `paintBlackHole`
 * draws that. A space drawn on the page (`space.ts`) is a black hole whose
 * horizon is the line a person drew, so `paintHoleAlong` draws the same
 * four things along any closed path: the beaming is still angular about the
 * middle of the area, the ring is still one pixel on the line, and the
 * slivers are the far side bent over and under the shape rather than the
 * circle. Pass the path grown from its centroid and the hole is consuming.
 */
import { centroid } from "./space.ts";
import type { SketchPoint } from "./sketch.ts";

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
     the way an overexposed edge does, and only on the side that is coming.
     Into the dark outside the rim only — cut to an annulus so none of it
     reaches the disc's own face, where the ring is the only light. */
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
    c.arc(cx, cy, r, 0, TAU, true);
    c.fill("evenodd");
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

/* ------------------------------------------------------------------ */
/* Along a drawn line                                                  */
/* ------------------------------------------------------------------ */

/** How many pieces a path is cut into for the per-piece beaming. */
const PIECES = 160;

/** Evenly spaced points round a closed path, by arc length. */
function resample(path: SketchPoint[], n: number): SketchPoint[] {
  const pts = path.length > 1 && Math.hypot(path[0]![0] - path[path.length - 1]![0], path[0]![1] - path[path.length - 1]![1]) < 1e-6 ? path.slice(0, -1) : path;
  const m = pts.length;
  if (m < 2) return pts.slice();
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < m; i++) {
    const a = pts[i]!, b = pts[(i + 1) % m]!;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push(d);
    total += d;
  }
  if (total < 1e-6) return pts.slice();
  const out: SketchPoint[] = [];
  let i = 0, along = 0;
  for (let k = 0; k < n; k++) {
    const want = (k / n) * total;
    while (i < m - 1 && along + seg[i]! < want) { along += seg[i]!; i++; }
    const a = pts[i]!, b = pts[(i + 1) % m]!;
    const f = seg[i]! > 0 ? Math.min(1, (want - along) / seg[i]!) : 0;
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

function trace(c: CanvasRenderingContext2D, pts: SketchPoint[]) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
}

/** Everything outside the line, as a clip. Nothing painted under it reaches the inside. */
function clipOutside(c: CanvasRenderingContext2D, pts: SketchPoint[]) {
  c.beginPath();
  c.rect(-1e5, -1e5, 2e5, 2e5);
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.clip("evenodd");
}

export interface HoleAlongOptions {
  /** The horizon: a closed line in the canvas's own pixels. */
  path: SketchPoint[];
  /** Seconds since the space opened; the disc turns, slowly. */
  t: number;
  /** Which way the approaching side is, in degrees. Left by default. */
  beam?: number;
  /**
   * What one pixel is, in the canvas's units. A space's canvas lives in the
   * page layer and is scaled by the board's zoom, so the things that are one
   * pixel wide on the disc (the ring, its hairs of bloom) are drawn this
   * many units wide to land as one pixel on the screen. One by default.
   */
  hair?: number;
}

/**
 * The hole along a drawn line. Same light, same order, any shape.
 *
 * Each piece of the path is lit by the angle of its middle about the
 * centroid of the area, so a blob's bright side is still the side coming at
 * you and the dim side is still barely there. Widths scale with the mean
 * radius, so a small hole wears a small crescent.
 */
export function paintHoleAlong(c: CanvasRenderingContext2D, o: HoleAlongOptions) {
  const pts = resample(o.path, PIECES);
  if (pts.length < 3) return;
  const [cx, cy] = centroid(pts);
  const R = pts.reduce((acc, [x, y]) => acc + Math.hypot(x - cx, y - cy), 0) / pts.length;
  if (R < 1) return;
  const beam = ((o.beam ?? 180) * Math.PI) / 180;
  const hair = o.hair ?? 1;
  const TAU = Math.PI * 2;
  const breathe = 0.92 + 0.08 * Math.sin((o.t / 26) * TAU);
  const angleOf = (p: SketchPoint) => Math.atan2(p[1] - cy, p[0] - cx);
  const norm = (a: number) => ((a % TAU) + TAU) % TAU;

  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";

  /* The bent slivers: the far side, lifted over the top and under the
     bottom of the shape. The same shape, stretched a little, drawn only in
     the two arcs the circle's slivers occupy, tapering to nothing. */
  c.globalCompositeOperation = "lighter";
  {
    const bent = pts.map(([x, y]) => [cx + (x - cx) * 1.15, cy + (y - cy) * 1.055] as SketchPoint);
    c.lineWidth = Math.max(1.1, R * 0.02);
    const bands: [number, number][] = [[Math.PI + 0.42, TAU - 0.42], [0.42, Math.PI - 0.42]];
    for (let i = 0; i < bent.length; i++) {
      const a = bent[i]!, b = bent[(i + 1) % bent.length]!;
      const th = norm(angleOf([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]));
      for (const [from, to] of bands) {
        if (th < from || th > to) continue;
        const face = Math.max(0, Math.cos(th - beam));
        const taper = Math.sin((Math.PI * (th - from)) / (to - from));
        const lit = (0.12 + 0.88 * Math.pow(face, 3)) * taper;
        if (lit < 0.02) continue;
        c.strokeStyle = WARM(0.5 * lit * breathe);
        c.beginPath();
        c.moveTo(a[0], a[1]);
        c.lineTo(b[0], b[1]);
        c.stroke();
      }
    }
  }

  /* Outside the line only, from here: the inside is the space's own. */
  clipOutside(c, pts);

  /* The disc, beamed: one piece at a time, each faded outward along its own
     normal, laid down rather than added so the pieces never comb. */
  c.globalCompositeOperation = "source-over";
  {
    const reach = R * 0.42;
    c.lineWidth = reach * 2;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const th = angleOf([mx, my]);
      const face = Math.max(0, Math.cos(th - beam));
      const lit = Math.pow(face, 4) * 0.96 + 0.04;
      // Outward is away from the middle of the area.
      const d = Math.hypot(mx - cx, my - cy) || 1;
      const nx = (mx - cx) / d, ny = (my - cy) / d;
      const g = c.createLinearGradient(mx, my, mx + nx * reach, my + ny * reach);
      g.addColorStop(0, HOT(0.5));
      g.addColorStop(0.06, WARM(0.34));
      g.addColorStop(0.22, WARM(0.13));
      g.addColorStop(0.5, FAR(0.05));
      g.addColorStop(1, "oklch(0 0 0 / 0)");
      c.strokeStyle = g;
      c.globalAlpha = lit * breathe;
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  /* The bright side's bloom, into the dark outside the line. */
  c.globalCompositeOperation = "lighter";
  {
    const bx = cx + Math.cos(beam) * R * 0.5;
    const by = cy + Math.sin(beam) * R * 0.5;
    const g = c.createRadialGradient(bx, by, R * 0.2, bx, by, R * 1.25);
    g.addColorStop(0, WARM(0.12 * breathe));
    g.addColorStop(0.45, WARM(0.05 * breathe));
    g.addColorStop(1, "oklch(0 0 0 / 0)");
    c.fillStyle = g;
    c.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
  }

  /* The photon ring, and its hair of bloom: widest first, so the thin white
     line lands on top. Everything here is centred on the line and clipped
     to its outer half. */
  for (const [style, width] of [[WARM(0.22), 10.4], [HOT(0.5), 5.6], ["oklch(1 0.02 90 / 1)", 2.8]] as [string, number][]) {
    c.strokeStyle = style;
    c.lineWidth = width * hair;
    trace(c, pts);
    c.stroke();
  }
  c.restore();

  // And the one hair inside the line.
  c.save();
  trace(c, pts);
  c.clip();
  c.globalCompositeOperation = "lighter";
  c.strokeStyle = WARM(0.2);
  c.lineWidth = 2.4 * hair;
  trace(c, pts);
  c.stroke();
  c.restore();
}

/**
 * The shadow inside a drawn line: the surface falls to black as it nears
 * the horizon, whatever shape the horizon is.
 *
 * A gradient from the middle would reach a near edge too soon and a far one
 * too late, so the shadow is laid as bands along the line itself, each a
 * share of the mean radius wide, darker as they narrow. Clipped to the
 * inside, so nothing here touches the light outside.
 */
export function paintHorizonShadowAlong(c: CanvasRenderingContext2D, path: SketchPoint[], hair = 1) {
  const pts = resample(path, PIECES);
  if (pts.length < 3) return;
  const [cx, cy] = centroid(pts);
  const R = pts.reduce((acc, [x, y]) => acc + Math.hypot(x - cx, y - cy), 0) / pts.length;
  c.save();
  trace(c, pts);
  c.clip();
  c.lineJoin = "round";
  const bands: [number, number][] = [[0.5, 0.1], [0.4, 0.12], [0.3, 0.15], [0.22, 0.19], [0.16, 0.24], [0.11, 0.3], [0.07, 0.4], [0.04, 0.55]];
  for (const [share, a] of bands) {
    c.strokeStyle = `oklch(0.01 0.005 290 / ${a})`;
    c.lineWidth = Math.max(2, R * share * 2);
    trace(c, pts);
    c.stroke();
  }
  c.strokeStyle = "oklch(0 0 0 / 1)";
  c.lineWidth = 3 * hair;
  trace(c, pts);
  c.stroke();
  c.restore();
}

/** How much room the light needs outside the disc. */
export const HALO = 64;
