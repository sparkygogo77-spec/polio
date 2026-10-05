/**
 * A PICTURE'S BACKGROUND MADE SEE-THROUGH, FROM THE COLOURS POINTED AT.
 *
 * The owner's words: "add a right click menu transparent background
 * selector". He points at the background (one press or several), and every
 * pixel near enough in colour to what he pointed at goes see-through:
 * touching the spots he pressed (a white plate round a card, but not the
 * white of the card's own text), or anywhere in the picture when he says so.
 *
 * Pure, on RGBA bytes, so it is held without a browser
 * (`tests/see-through.mjs`); the card that drives it is `ClearBackground.tsx`.
 *
 * A hard cut leaves a ring of half-mixed pixels round the subject, so the
 * cut has a soft edge: within `tolerance` of a picked colour a pixel goes
 * fully clear, and over the next `feather` it fades from clear to as it was.
 * Only fully cleared pixels carry the fill on, so the fade is one band wide
 * and never creeps into the subject.
 */

export interface SeeThroughOptions {
  /** Pixels pointed at, in the picture's own pixels. */
  seeds: readonly (readonly [number, number])[];
  /** How far a colour may be from a picked one and still go clear, 0 to 255 (RGB distance per channel, roughly). */
  tolerance: number;
  /** The soft band past the tolerance, in the same units. */
  feather?: number;
  /** Clear that colour wherever it is, not only where it touches what was pointed at. */
  everywhere?: boolean;
}

/** Distance between two colours, scaled so that 255 is "as far as one channel can go". */
function distance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((dr * dr + dg * dg + db * db) / 3);
}

/**
 * The alpha each pixel should have, given the picture's RGBA bytes. Returns a
 * new RGBA array; the one passed in is not changed. Already see-through
 * pixels stay as see-through as they were.
 */
export function seeThrough(data: Uint8ClampedArray, w: number, h: number, opts: SeeThroughOptions): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(data);
  const tol = Math.max(0, opts.tolerance);
  const feather = Math.max(0, opts.feather ?? Math.max(6, tol * 0.5));
  const seeds = opts.seeds.filter(([x, y]) => x >= 0 && y >= 0 && x < w && y < h).map(([x, y]) => [Math.floor(x), Math.floor(y)] as const);
  if (!seeds.length) return out;
  const picked = seeds.map(([x, y]) => { const i = (y * w + x) * 4; return [data[i]!, data[i + 1]!, data[i + 2]!] as const; });
  /* How far a pixel is from the nearest colour he picked. */
  const near = (i: number) => {
    let best = Infinity;
    for (const [r, g, b] of picked) best = Math.min(best, distance(data[i]!, data[i + 1]!, data[i + 2]!, r, g, b));
    return best;
  };
  /* Its new alpha: clear inside the tolerance, a fade across the feather, untouched past it. */
  const apply = (p: number, d: number) => {
    const i = p * 4;
    if (d <= tol) out[i + 3] = 0;
    else if (feather > 0 && d < tol + feather) out[i + 3] = Math.min(data[i + 3]!, Math.round((255 * (d - tol)) / feather));
  };

  if (opts.everywhere) {
    for (let p = 0; p < w * h; p++) apply(p, near(p * 4));
    return out;
  }

  /* Touching what was pointed at: a fill from each spot, carried on only through fully cleared pixels. */
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (const [x, y] of seeds) { const p = y * w + x; if (!seen[p]) { seen[p] = 1; stack.push(p); } }
  while (stack.length) {
    const p = stack.pop()!;
    const d = near(p * 4);
    apply(p, d);
    if (d > tol) continue;
    const x = p % w, y = (p - x) / w;
    if (x > 0 && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
    if (x < w - 1 && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
    if (y > 0 && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
    if (y < h - 1 && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
  }
  return out;
}

/** The four corners, a little in: where a background usually is, as a first guess before he points. */
export function cornerSeeds(w: number, h: number): [number, number][] {
  const m = Math.max(0, Math.min(2, Math.floor(Math.min(w, h) / 4)));
  return [[m, m], [w - 1 - m, m], [m, h - 1 - m], [w - 1 - m, h - 1 - m]];
}

/** How much of the picture is see-through, 0 to 1: for the card to say what a setting did. */
export function clearShare(data: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] === 0) n++;
  return n / Math.max(1, data.length / 4);
}
