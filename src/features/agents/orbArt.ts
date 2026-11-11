/**
 * THE ORBS' TEXTURES (Orbs 2, piece E): three sets J picks from in Tune.
 *
 *   · glass: no surface pattern, a clear sphere with a bright highlight and
 *     a soft inner refraction;
 *   · planet: soft bands, like a gas giant, that turn as the orb spins;
 *   · marble: veins of value noise, turning the same way.
 *
 * A texture is a greyscale strip drawn once per page on a small canvas (two
 * periods wide, so it can scroll and wrap) and laid over the orb's own colour
 * as light and shade in its alpha, so one strip serves every state colour.
 * The orb clips it to its circle and slides it sideways as it spins, under
 * the same shading gradient: a sphere turning, with no filter per frame.
 *
 * `stripPixels` is pure (tests read it); `stripUrl` needs a canvas.
 */
import type { TextureSet } from "./boardTune";

export const STRIP_W = 256, STRIP_H = 64;
/** A small steady random from a seed. */
function rand(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }

/** Value noise that wraps every `period` pixels across, so the strip joins up. */
function noise(period: number, seed: number) {
  const r = rand(seed), cells = 8, rows = 4;
  const g = Array.from({ length: (cells + 1) * (rows + 1) }, () => r());
  const at = (i: number, j: number) => g[(j % (rows + 1)) * (cells + 1) + (i % cells)] ?? 0;
  const s = (u: number) => u * u * (3 - 2 * u);
  return (x: number, y: number) => {
    const fx = ((x % period) / period) * cells, fy = (y / STRIP_H) * rows;
    const i = Math.floor(fx), j = Math.floor(fy), u = s(fx - i), v = s(fy - j);
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
  };
}

/** The strip's pixels as RGBA, white light where the alpha says, dark shade below half. Null for glass, which has no pattern. */
export function stripPixels(set: TextureSet): Uint8ClampedArray | null {
  if (set === "glass") return null;
  const out = new Uint8ClampedArray(STRIP_W * STRIP_H * 4), period = STRIP_W / 2;
  const n1 = noise(period, 7), n2 = noise(period / 2, 19);
  for (let y = 0; y < STRIP_H; y++) for (let x = 0; x < STRIP_W; x++) {
    let v: number;
    if (set === "planet") {
      /* Bands across, bent a little by the noise so they swirl. */
      const yy = y + 6 * (n1(x, y) - 0.5);
      v = 0.5 + 0.32 * Math.sin(yy * 0.42) + 0.14 * Math.sin(yy * 1.3 + 1) + 0.12 * (n2(x, y) - 0.5);
    } else {
      /* Marble: thin bright veins where turbulent noise crosses zero. */
      const t = n1(x, y) * 0.65 + n2(x, y) * 0.35;
      const vein = Math.abs(Math.sin((x / period) * Math.PI * 2 + t * 9 + y * 0.05));
      v = 0.42 + 0.5 * Math.pow(1 - vein, 6) - 0.12 * t;
    }
    v = Math.min(1, Math.max(0, v));
    const k = (y * STRIP_W + x) * 4, light = v >= 0.5;
    out[k] = out[k + 1] = out[k + 2] = light ? 255 : 0;
    out[k + 3] = Math.round(Math.abs(v - 0.5) * 2 * (light ? 150 : 120));
  }
  return out;
}

const urls = new Map<TextureSet, string | null>();
/** The strip as a picture the orbs can use, made once per page. */
export function stripUrl(set: TextureSet): string | null {
  if (urls.has(set)) return urls.get(set) ?? null;
  const px = stripPixels(set);
  let url: string | null = null;
  if (px && typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = STRIP_W; c.height = STRIP_H;
    const g = c.getContext("2d");
    if (g) { g.putImageData(new ImageData(px as unknown as Uint8ClampedArray<ArrayBuffer>, STRIP_W, STRIP_H), 0, 0); url = c.toDataURL("image/png"); }
  }
  urls.set(set, url);
  return url;
}
