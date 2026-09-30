/**
 * Two pictures mixed in OKLab, pixel by pixel.
 *
 * The crate's in-betweens used to be a cross-dissolve in plain RGB: the
 * frame it was leaving at full strength with the next drawn over it at `t`.
 * RGB is not how the eye adds light, so halfway between a red and a green
 * was a muddy olive (128, 128, 0), darker than either end. OKLab is a space
 * built so that equal steps look equal: the same halfway is a clear yellow,
 * as bright as the two it sits between. This mixes there.
 *
 * Pure: arrays of RGBA bytes in and out, no canvas, so a test runs it as
 * written. Tables stand in for the two slow curves (the sRGB transfer each
 * way), so a 264 × 148 frame mixes in a millisecond or two.
 */

/** sRGB byte → linear light, 0..1. */
const TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
/** Linear light (0..1, in 4096 steps) → sRGB byte. */
const STEPS = 4096;
const TO_BYTE = new Uint8ClampedArray(STEPS + 1);
for (let i = 0; i <= STEPS; i++) {
  const c = i / STEPS;
  TO_BYTE[i] = Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
}
const toByte = (l: number) => TO_BYTE[l <= 0 ? 0 : l >= 1 ? STEPS : Math.round(l * STEPS)]!;

/** One sRGB colour (bytes) as OKLab. */
export function toOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = TO_LINEAR[r]!, lg = TO_LINEAR[g]!, lb = TO_LINEAR[b]!;
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab back to sRGB bytes, clipped into the gamut. */
export function fromOklab(L: number, A: number, B: number): [number, number, number] {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    toByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/**
 * `a` and `b` (RGBA bytes, the same length) mixed `t` of the way from `a`
 * to `b`, into `out`. At `t = 0` it is `a` exactly and at `t = 1` it is `b`
 * exactly, so a keyframe is its own picture to the last pixel. Where either
 * is see-through, each side's colour counts by how much of it is there, so
 * an empty corner never greys what it mixes into.
 */
export function mixOklab(a: Uint8ClampedArray, b: Uint8ClampedArray, t: number, out: Uint8ClampedArray): Uint8ClampedArray {
  if (t <= 0) { out.set(a); return out; }
  if (t >= 1) { out.set(b); return out; }
  const u = 1 - t;
  for (let i = 0; i < out.length; i += 4) {
    const r1 = a[i]!, g1 = a[i + 1]!, b1 = a[i + 2]!, a1 = a[i + 3]!;
    const r2 = b[i]!, g2 = b[i + 1]!, b2 = b[i + 2]!, a2 = b[i + 3]!;
    const alpha = a1 * u + a2 * t;
    if (alpha <= 0) { out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0; continue; }
    if (r1 === r2 && g1 === g2 && b1 === b2) { out[i] = r1; out[i + 1] = g1; out[i + 2] = b1; out[i + 3] = alpha; continue; }
    const w1 = (a1 * u) / alpha, w2 = (a2 * t) / alpha;
    const p = toOklab(r1, g1, b1), q = toOklab(r2, g2, b2);
    const c = fromOklab(p[0] * w1 + q[0] * w2, p[1] * w1 + q[1] * w2, p[2] * w1 + q[2] * w2);
    out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = alpha;
  }
  return out;
}

/** A picture's pixels as OKLab, worked out once, so a crate playing at 60 frames a second only mixes. */
export function labOf(px: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(px.length);
  for (let i = 0; i < px.length; i += 4) {
    const c = toOklab(px[i]!, px[i + 1]!, px[i + 2]!);
    out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = px[i + 3]!;
  }
  return out;
}

/** `mixOklab` with both pictures already in OKLab (`labOf`); the bytes are still what `t = 0` and `t = 1` hand back. */
export function mixLab(a: Uint8ClampedArray, b: Uint8ClampedArray, la: Float32Array, lb: Float32Array, t: number, out: Uint8ClampedArray): Uint8ClampedArray {
  if (t <= 0) { out.set(a); return out; }
  if (t >= 1) { out.set(b); return out; }
  const u = 1 - t;
  for (let i = 0; i < out.length; i += 4) {
    const a1 = la[i + 3]!, a2 = lb[i + 3]!;
    const alpha = a1 * u + a2 * t;
    if (alpha <= 0) { out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0; continue; }
    if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2]) { out[i] = a[i]!; out[i + 1] = a[i + 1]!; out[i + 2] = a[i + 2]!; out[i + 3] = alpha; continue; }
    const w1 = (a1 * u) / alpha, w2 = (a2 * t) / alpha;
    const c = fromOklab(la[i]! * w1 + lb[i]! * w2, la[i + 1]! * w1 + lb[i + 1]! * w2, la[i + 2]! * w1 + lb[i + 2]! * w2);
    out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = alpha;
  }
  return out;
}
