/**
 * The nebula inside a card, painted once and slid for ever.
 *
 * The ground already does this: a field of cloud is generated one time,
 * oversized by one period, and slid by a CSS transform so the loop lands on
 * itself and nothing repaints. The cards use the same mechanism with the
 * same noise, so thirty of them cost what one composited layer costs, which
 * is nothing that can be measured.
 *
 * Two tiles, one per temperature — red for a drawing, green for an
 * iteration — each wrapping on its own width so it can slide seamlessly.
 * They are handed to the stylesheet as two custom properties on the root
 * (`--nebula-verdant`, `--nebula-ember`) and `molten.css` does the rest; a
 * construct that renders before the tiles exist falls back to its flat dark
 * face and picks the cloud up the moment the properties land.
 *
 * **The centre is the darkest part.** The reference (the opaque one) has a
 * very, very dark red or green at the middle, not black, and the light sits
 * around it and eases in rather than falling off a cliff. So the cloud is
 * painted with a soft radial vignette — thin in the middle, full towards the
 * edges — and the face underneath carries the dark core. Nothing here is
 * black.
 */
import { nebulaNoise } from "./darkMatter";

/** The tile wraps on this width and slides exactly it. */
export const NEBULA_PERIOD = 512;
/** Taller than any card, and clipped: a card only ever shows a band of it. */
export const NEBULA_HEIGHT = 256;

export type NebulaKind = "verdant" | "ember";

/**
 * The two clouds per temperature, as the ground's clouds are: a body and a
 * brighter thick of it, cut out of noise at a feature size in pixels.
 * Colours are the family's own stops in sRGB, kept well under the rim.
 */
const CLOUDS: Record<NebulaKind, { rgb: [number, number, number]; seed: number; feature: number; from: number; to: number; gamma: number; alpha: number }[]> = {
  /*
   * The green sits a shade brighter than the red in sRGB for the same read:
   * a green of the same numbers looks darker, and a card is short, so it
   * only ever shows the tile's middle band, which is the thin part.
   */
  verdant: [
    { rgb: [30, 118, 52], seed: 5, feature: 150, from: 0.3, to: 0.8, gamma: 1.25, alpha: 0.76 },
    { rgb: [66, 204, 88], seed: 17, feature: 90, from: 0.44, to: 0.86, gamma: 1.6, alpha: 0.56 },
  ],
  ember: [
    { rgb: [122, 32, 32], seed: 7, feature: 150, from: 0.3, to: 0.8, gamma: 1.25, alpha: 0.74 },
    { rgb: [222, 76, 62], seed: 19, feature: 90, from: 0.44, to: 0.86, gamma: 1.6, alpha: 0.54 },
  ],
};

const OCTAVES = 6;
const COARSE = 2;
const CURVE = 1024;

const tiles = new Map<NebulaKind, string>();

/** One temperature's tile, as a data URL, made once. */
export function nebulaTile(kind: NebulaKind): string {
  const had = tiles.get(kind);
  if (had) return had;
  if (typeof document === "undefined") return "";
  const pw = NEBULA_PERIOD, ph = NEBULA_HEIGHT;
  const el = document.createElement("canvas");
  el.width = pw;
  el.height = ph;
  const c = el.getContext("2d");
  if (!c) return "";

  const nw = Math.round(pw / COARSE), nh = Math.round(ph / COARSE);
  const [A, B] = CLOUDS[kind];
  const na = nebulaNoise(nw, nh, A!.seed, A!.feature / COARSE, OCTAVES);
  const nb = nebulaNoise(nw, nh, B!.seed, B!.feature / COARSE, OCTAVES);
  const curve = (cl: typeof A) => {
    const t = new Float32Array(CURVE + 1);
    for (let i = 0; i <= CURVE; i++) {
      const n = i / CURVE;
      t[i] = Math.pow(Math.max(0, Math.min(1, (n - cl!.from) / (cl!.to - cl!.from))), cl!.gamma) * cl!.alpha;
    }
    return t;
  };
  const la = curve(A), lb = curve(B);
  const [a0, a1, a2] = A!.rgb, [b0, b1, b2] = B!.rgb;

  const img = c.createImageData(pw, ph);
  const px = img.data;
  const sx = nw / pw, sy = nh / ph;
  for (let y = 0, p = 0; y < ph; y++) {
    const v = y * sy, y0 = v | 0, fy = v - y0;
    const r0 = (y0 % nh) * nw, r1 = ((y0 + 1) % nh) * nw;
    /*
     * The vignette that puts the light round the centre. The card shows the
     * middle band of the tile, so "the centre" is the tile's vertical middle:
     * thin there, full at the top and bottom edges, eased so there is no
     * ring where it changes.
     */
    const d = Math.abs(y / ph - 0.5) * 2;
    const vig = 0.3 + 0.7 * (d * d * (3 - 2 * d));
    for (let x = 0; x < pw; x++, p += 4) {
      const u = x * sx, x0 = u | 0, fx = u - x0;
      const c0 = x0 % nw, c1 = (x0 + 1) % nw;
      const q00 = na[r0 + c0]!, q10 = na[r0 + c1]!, q01 = na[r1 + c0]!, q11 = na[r1 + c1]!;
      const w00 = nb[r0 + c0]!, w10 = nb[r0 + c1]!, w01 = nb[r1 + c0]!, w11 = nb[r1 + c1]!;
      const aa = la[(((q00 + (q10 - q00) * fx) * (1 - fy) + (q01 + (q11 - q01) * fx) * fy) * CURVE) | 0]! * vig;
      const ab = lb[(((w00 + (w10 - w00) * fx) * (1 - fy) + (w01 + (w11 - w01) * fx) * fy) * CURVE) | 0]! * vig;
      const ao = ab + aa * (1 - ab);
      if (ao <= 0) continue;
      // The bright cloud screened over the body, as the ground does it.
      const k = ab * (1 - aa), q = ab * aa, z = (1 - ab) * aa;
      px[p] = ((k * b0 + q * (a0 + b0 - (a0 * b0) / 255) + z * a0) / ao + 0.5) | 0;
      px[p + 1] = ((k * b1 + q * (a1 + b1 - (a1 * b1) / 255) + z * a1) / ao + 0.5) | 0;
      px[p + 2] = ((k * b2 + q * (a2 + b2 - (a2 * b2) / 255) + z * a2) / ao + 0.5) | 0;
      px[p + 3] = (ao * 255 + 0.5) | 0;
    }
  }
  c.putImageData(img, 0, 0);
  const url = `url("${el.toDataURL("image/png")}")`;
  tiles.set(kind, url);
  return url;
}

/**
 * Hand both tiles to the stylesheet, once.
 *
 * On the root, so every construct anywhere — the timeline's boxes, the
 * Finish key, the rows under it — reads the same two pictures. Idempotent:
 * a second call is a lookup.
 */
export function mountNebula(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (root.style.getPropertyValue("--nebula-verdant")) return;
  root.style.setProperty("--nebula-period", `${NEBULA_PERIOD}px`);
  root.style.setProperty("--nebula-verdant", nebulaTile("verdant"));
  root.style.setProperty("--nebula-ember", nebulaTile("ember"));
}
