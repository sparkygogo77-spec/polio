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
 * draws that, beamed. A space drawn on the page (`space.ts`) is a black
 * hole whose horizon is the line a person drew, and `paintHoleAlong` draws
 * the ring on that line and an even aura round it, sized to the shape: not
 * the disc's crescent, because a crescent on every hole on a page read as
 * one lamp off to the left rather than as things that glow. Pass the path
 * grown from its centroid and the hole is consuming.
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

/**
 * The path moved out along itself by `d`: every point along its own
 * outward normal, not the whole shape scaled from its centroid. Scaling
 * moves a point in proportion to its distance from the middle, so on a
 * wide box the long sides went out further than the short ones and a hair
 * meant to sit four pixels off the line sat five on one side and three on
 * another. The ring is a hair off the line, the same hair all the way round.
 */
function outward(pts: SketchPoint[], d: number): SketchPoint[] {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const [cx, cy] = centroid(pts);
  return pts.map(([x, y], i) => {
    const a = pts[(i + n - 1) % n]!, b = pts[(i + 1) % n]!;
    const tx = b[0] - a[0], ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    let nx = ty / len, ny = -tx / len;
    // Outward is away from the middle of the area, whichever way the line was drawn.
    if (nx * (x - cx) + ny * (y - cy) < 0) { nx = -nx; ny = -ny; }
    return [x + nx * d, y + ny * d];
  });
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
  /**
   * What one pixel is, in the canvas's units. A space's canvas lives in the
   * page layer and is scaled by the board's zoom, so the things that are one
   * pixel wide on the disc (the ring, its hairs of bloom) are drawn this
   * many units wide to land as one pixel on the screen. One by default.
   */
  hair?: number;
}

/** How far the aura reaches outside the line, as a share of the mean radius. */
export const AURA_REACH = 0.34;
/** How many bands the aura is laid in. Enough that no band can be counted: two pixels apart on the biggest hole. */
const AURA_BANDS = 36;

/**
 * The hole along a drawn line: the ring on it, and an aura round it.
 *
 * It was the disc's own light, beamed: a crescent bright on the coming
 * side and barely there on the going one, with the far side bent over the
 * top and a bloom on the bright side. Drawn on every hole regardless of its
 * shape, that read as one lamp off to the left of the page rather than as
 * things that glow, and it was drawn piece by piece with a gradient each,
 * thirty times a second, which is what made the board stutter. J's word for
 * what he wants is precise: an aura, even all the way round, sized to the
 * shape. So that is what this is.
 *
 * The aura is the line itself stroked outward in bands, each a little wider
 * and fainter than the last, laid as light so they pile up at the line and
 * thin to nothing at `AURA_REACH` of the mean radius. A small hole wears a
 * small aura and a big one a big one, and every side of every shape is lit
 * the same. Fourteen strokes rather than a hundred and sixty gradients, and
 * nothing in it moves, so it is painted once and left.
 */
export function paintHoleAlong(c: CanvasRenderingContext2D, o: HoleAlongOptions) {
  const pts = resample(o.path, PIECES);
  if (pts.length < 3) return;
  const [cx, cy] = centroid(pts);
  const R = pts.reduce((acc, [x, y]) => acc + Math.hypot(x - cx, y - cy), 0) / pts.length;
  if (R < 1) return;
  const hair = o.hair ?? 1;

  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";

  /* Outside the line only: the inside is the space's own. */
  clipOutside(c, pts);
  c.globalCompositeOperation = "lighter";

  /* The aura, even all the way round and sized to the shape. Wide and
     faint first, narrow and warm last, so the light is densest at the line
     and falls off smoothly; a band's stroke is centred on the line and the
     clip keeps only the half outside it. */
  // Never past the room the light has (`HALO`): a big hole's aura would
  // otherwise stop dead at the canvas edge, a square round a glow.
  const reach = Math.min(HALO - 4, Math.max(4 * hair, R * AURA_REACH));
  for (let i = AURA_BANDS; i >= 1; i--) {
    const share = i / AURA_BANDS;
    // Each band adds a little; what a point sees is every band wider than
    // its distance out, so the light falls off smoothly from the line.
    const a = (1.1 / AURA_BANDS) * Math.pow(1 - share + 1 / AURA_BANDS, 1.5);
    c.strokeStyle = share > 0.3 ? WARM(a) : HOT(a);
    c.lineWidth = reach * share * 2;
    trace(c, pts);
    c.stroke();
  }

  /* The photon ring, and its hair of bloom: widest first, so the thin white
     line lands on top. Laid outside the line at the disc's own widths. The
     ring is bright the whole way round on purpose: it is light that went
     round the hole; it is a hair, and a hair is not a halo. */
  for (const [style, width, out] of [[WARM(0.22), 2.4, 4], [HOT(0.5), 1.6, 2], ["oklch(1 0.02 90 / 1)", 1.4, 0.6]] as [string, number, number][]) {
    c.strokeStyle = style;
    c.lineWidth = width * hair;
    trace(c, outward(pts, out * hair));
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
/** How many bands the falloff is laid in. Measured: eight rings, forty-eight none. */
const BANDS_IN = 48;

export function paintHorizonShadowAlong(c: CanvasRenderingContext2D, path: SketchPoint[], hair = 1) {
  const pts = resample(path, PIECES);
  if (pts.length < 3) return;
  const [cx, cy] = centroid(pts);
  const R = pts.reduce((acc, [x, y]) => acc + Math.hypot(x - cx, y - cy), 0) / pts.length;
  c.save();
  trace(c, pts);
  c.clip();
  c.lineJoin = "round";
  /*
   * A RAMP, NOT A STAIRCASE.
   *
   * This was eight strokes at hand-picked widths, and eight strokes are
   * eight hard edges: the darkness went up a step at each one and held flat
   * between, so the surface came out ringed like a contour map. Counted on a
   * disc, walking in from the line a pixel at a time: EIGHT rings, one a
   * band, the worst of them a step of 14 in 255.
   *
   * The bands are now read off a continuous curve rather than a list, evenly
   * spaced in depth so no two edges fall in the same place, and each one thin
   * enough that its own edge is under what an eye picks out. Counted the same
   * way: NO rings, and the steepest place in the whole run is 5 in 255 — a
   * gradient rather than a line.
   *
   * Forty-eight rather than more: at ninety-six the numbers stop improving
   * and it is six times the strokes for nothing.
   */
  for (let i = 0; i < BANDS_IN; i++) {
    const t = i / BANDS_IN;
    /* Inward from the edge, band after band, each a little darker than the
       last so the run is steepest where the surface meets the line. */
    c.strokeStyle = `oklch(0.01 0.005 290 / ${(0.04 + 0.14 * t).toFixed(3)})`;
    c.lineWidth = Math.max(2, R * (0.5 * (1 - t)) * 2);
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
