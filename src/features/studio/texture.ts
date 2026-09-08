/**
 * Turning a picture into a texture.
 *
 * A photograph is not a texture. Dropped in as-is it tiles as a grid of
 * photographs, covers the background colour completely, and ignores every
 * control — the colour role, the opacity, the contrast all have nothing to
 * bite on, because an opaque rectangle has no holes for the site to show
 * through.
 *
 * So the picture is cooked first, on a canvas, in the browser and for free:
 *
 *   - the background can be keyed out, so a pattern shot on paper becomes the
 *     pattern alone;
 *   - it can be reduced to a *pattern* — a monochrome mask of where the
 *     picture is light and dark — which is what makes it tintable. Painted in
 *     the accent over the site's own background, a croc-skin photograph
 *     becomes croc-skin *in your palette*, at any scale, with the background
 *     colour still showing through the crevices.
 *
 * The result is baked once and kept on the layer, so everything downstream —
 * the board, the live site, the previews — stays a plain synchronous CSS
 * lookup.
 */
import type * as React from "react";
import { oklchToRgb, parseColor } from "./look";

/** How a picture is cooked. Every field here changes the baked tile. */
export interface Treatment {
  /** Key out the colour the edges are sitting on. */
  cutout: boolean;
  /** How much of that colour goes, 0..1. */
  tolerance: number;
  /** Reduce to a tintable mask instead of keeping the picture's own colours. */
  pattern: boolean;
  /** Hardness of the pattern, 0..1. */
  contrast: number;
  /** The colour a pattern is painted in. Ignored when `pattern` is off. */
  tint: string;
  /** Degrees. The tile is rotated, and grown so nothing is clipped. */
  angle: number;
  /** Degrees to turn the colour by, -180..180. */
  hue: number;
  /**
   * How solid the tile is, 0..1, multiplied into its own alpha.
   *
   * It used to be a wash of the background colour laid back over the picture,
   * which is fine for one layer on a flat page and useless for two: the wash
   * hid whatever was underneath. Baked into the alpha, a half-solid layer is
   * half see-through, and a stack reads as a stack.
   */
  alpha: number;
  /**
   * How much the tile thins toward its edges, 0..1.
   *
   * Same story as `alpha`, and the same fix: the weave used to be a radial
   * wash of the *page* colour laid over the picture, so a woven layer painted
   * an opaque disc over every layer beneath it. Cut into the tile's own alpha
   * it is a hole, not a lid — tiles bleed into each other and into whatever is
   * under them.
   */
  weave: number;
}

/** The baked tile is small on purpose: the document lives in localStorage. */
const MAX_TILE = 320;

export function treatmentKey(t: Treatment): string {
  return [
    t.cutout ? `cut${t.tolerance.toFixed(2)}` : "keep",
    t.pattern ? `pat${t.contrast.toFixed(2)}:${t.tint}` : "colour",
    `a${Math.round(t.angle)}`,
    `h${Math.round(t.hue)}`,
    `o${clamp01(t.alpha).toFixed(2)}`,
    `w${clamp01(t.weave).toFixed(2)}`,
  ].join("|");
}

const cache = new Map<string, string>();

/** Cook a picture into a tile. Resolves to a PNG data URL, alpha and all. */
export async function treatImage(src: string, t: Treatment): Promise<string> {
  const key = `${src.length}:${src.slice(-64)}:${treatmentKey(t)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const img = await load(src);
  const scale = Math.min(1, MAX_TILE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;
  // A pattern is repainted in the tint anyway, so only a picture keeping its
  // own colours needs the hue turned here.
  if (!t.pattern && t.hue) ctx.filter = `hue-rotate(${t.hue}deg)`;
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";

  const data = ctx.getImageData(0, 0, w, h);
  if (t.cutout) keyOutBackground(data, t.tolerance);
  if (t.pattern) toPattern(data, t.contrast, t.tint);
  fade(data, t.alpha);
  weaveEdges(data, t.weave);
  ctx.putImageData(data, 0, 0);

  const out = t.angle % 360 === 0 ? canvas : rotate(canvas, t.angle);
  const url = out.toDataURL("image/png");
  // A handful of tiles is plenty; the panel re-bakes as you drag a slider.
  if (cache.size > 24) cache.clear();
  cache.set(key, url);
  return url;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 1));

/** Multiply the whole tile's alpha, so the layer under it shows through. */
function fade(data: ImageData, alpha: number) {
  const a = clamp01(alpha);
  if (a >= 0.999) return;
  const px = data.data;
  for (let i = 3; i < px.length; i += 4) px[i] = Math.round(px[i]! * a);
}

/**
 * Thin the tile toward its edges, so a woven picture gathers in the middle.
 *
 * The clear circle in the centre shrinks as the weave goes up; outside it the
 * alpha falls away to almost nothing at the corners. Because it is the tile's
 * own alpha and not a wash of colour, what shows through the thin part is the
 * layer underneath — which is the whole point of a stack.
 */
function weaveEdges(data: ImageData, weave: number) {
  const w = clamp01(weave);
  if (w <= 0.001) return;
  const { width, height, data: px } = data;
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const max = Math.max(1, Math.hypot(cx, cy));
  const hole = 0.7 - w * 0.62;
  const span = Math.max(0.001, 1 - hole);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.hypot(x - cx, y - cy) / max;
      if (d <= hole) continue;
      const t = Math.min(1, (d - hole) / span);
      const i = (y * width + x) * 4 + 3;
      px[i] = Math.round(px[i]! * (1 - t * 0.92));
    }
  }
}

/**
 * Flatten a stack of layers into one picture.
 *
 * Two textures you liked together used to have to stay two, which meant every
 * later change to either one changed the pair, and the stack grew until you
 * could not see what was doing what. Merging bakes them: the layers are
 * painted into an SVG `foreignObject` exactly as the browser would paint them
 * on the page — same gradients, same blend modes, same order — and the result
 * comes back as a single tile that behaves like any dropped-in picture.
 *
 * The tile is square and small on purpose. A merged layer is a *pattern*, not
 * a photograph of your page: it goes on to be scaled, turned and tinted like
 * everything else.
 */
export async function flattenLayers(css: React.CSSProperties, size = 256): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const style = Object.entries(css)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${String(v)}`)
    .join(";");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${size}px;height:${size}px;${escapeAttr(style)}"></div>` +
    `</foreignObject></svg>`;
  try {
    const img = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    return canvas.toDataURL("image/png");
  } catch {
    // A browser that will not render foreignObject leaves the layers alone.
    return null;
  }
}

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not read the picture"));
    img.src = src;
  });
}

/**
 * Whatever colour the border pixels are sitting on is the background. Median
 * rather than mean, so one bright speck in a corner does not shift it.
 */
function keyOutBackground(data: ImageData, tolerance: number) {
  const { width: w, height: h, data: px } = data;
  const samples: [number, number, number][] = [];
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    samples.push([px[i]!, px[i + 1]!, px[i + 2]!]);
  };
  for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 24))) { take(x, 0); take(x, h - 1); }
  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 24))) { take(0, y); take(w - 1, y); }
  const median = (n: 0 | 1 | 2) => {
    const xs = samples.map((s) => s[n]).sort((a, b) => a - b);
    return xs[Math.floor(xs.length / 2)] ?? 0;
  };
  const bg = [median(0), median(1), median(2)] as const;

  // A band rather than a threshold, so the cut has a soft edge instead of jaggies.
  const near = 40 + tolerance * 190;
  const far = near + 30;
  for (let i = 0; i < px.length; i += 4) {
    const d = Math.hypot(px[i]! - bg[0], px[i + 1]! - bg[1], px[i + 2]! - bg[2]);
    if (d <= near) px[i + 3] = 0;
    else if (d < far) px[i + 3] = Math.round(px[i + 3]! * ((d - near) / (far - near)));
  }
}

/**
 * Reduce to a mask: alpha follows how far each pixel strays from the picture's
 * average brightness, and the colour becomes the tint. Both the light ridges
 * and the dark crevices of a grain survive, which is what makes it read as
 * the same material rather than a flat stencil.
 */
function toPattern(data: ImageData, contrast: number, tint: string) {
  const px = data.data;
  const rgb = parseRgb(tint) ?? [255, 255, 255];
  const lum = (i: number) => 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!;

  let total = 0;
  let counted = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3]! < 8) continue;
    total += lum(i);
    counted++;
  }
  const mean = counted ? total / counted : 128;

  // Normalise against the picture's own spread rather than a fixed range — a
  // dark photograph and a bright one should both come out as a pattern, not as
  // a solid slab.
  let widest = 1;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3]! < 8) continue;
    const d = Math.abs(lum(i) - mean);
    if (d > widest) widest = d;
  }

  // Low: the soft middle of the range survives too, so it reads as a wash.
  // High: only the extremes survive, which is what turns a photograph into
  // line work.
  const exponent = 0.6 + contrast * 3;
  for (let i = 0; i < px.length; i += 4) {
    const deviation = Math.abs(lum(i) - mean) / widest;
    const a = Math.pow(Math.max(0, Math.min(1, deviation)), exponent);
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
    px[i + 3] = Math.round(a * (px[i + 3]! / 255) * 255);
  }
}

function rotate(source: HTMLCanvasElement, angle: number): HTMLCanvasElement {
  const rad = (angle * Math.PI) / 180;
  const { width: w, height: h } = source;
  // Grow the tile to the rotated bounding box so no corner is clipped away.
  const rw = Math.ceil(Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad)));
  const rh = Math.ceil(Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad)));
  const out = document.createElement("canvas");
  out.width = rw;
  out.height = rh;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.translate(rw / 2, rh / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -w / 2, -h / 2);
  return out;
}

/**
 * The palette speaks oklch, and asking the browser to resolve it is not
 * reliable — Chromium hands `oklch(...)` straight back from `getComputedStyle`
 * rather than converting, so a regex looking for `rgb(` finds nothing and every
 * pattern comes out white. Convert it ourselves, and keep a canvas probe for
 * anything exotic, since a canvas always normalises what it is given.
 */
export function parseRgb(colour: string): [number, number, number] | null {
  const oklch = parseColor(colour);
  // The colour module works in 0..1; canvas pixels are bytes.
  if (oklch) return oklchToRgb(oklch).map((v) => Math.round(v * 255)) as [number, number, number];
  if (typeof document === "undefined") return null;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillStyle = colour;
  const hex = /^#([0-9a-f]{6})$/i.exec(ctx.fillStyle as string);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = /rgba?\(([^)]+)\)/.exec(String(ctx.fillStyle));
  if (!m) return null;
  const parts = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return [parts[0]!, parts[1]!, parts[2]!];
}
