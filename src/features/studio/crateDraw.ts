"use client";
/**
 * Drawing a crate's frames: one in the editor, or all of them as a strip.
 *
 * Every keyframe is fitted into the frame once (whole, centred, never
 * cropped) and read back as pixels and as OKLab (`oklab.ts`); an in-between
 * is then only a mix of two of those, written straight into the canvas. The
 * editor paints one at a time as it plays or is scrubbed; a part that wears
 * the crate gets the whole sequence as one strip of frames (`crateSheet`),
 * which `crateLayer.tsx` steps through with nothing but CSS.
 */
import { filled, playSeconds, sampledPlan, type MotionAsset, type Tween } from "./motion";
import { labOf, mixLab } from "./oklab";

/** One keyframe, fitted into a w × h frame: its bytes and its OKLab. */
export interface Fitted { px: Uint8ClampedArray; lab: Float32Array }

/** A keyframe's picture, loaded; null when it would not load. */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Contain: the whole keyframe, centred, never cropped, on a clear ground. */
export function fit(img: HTMLImageElement, w: number, h: number): Fitted | null {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  const px = ctx.getImageData(0, 0, w, h).data;
  return { px, lab: labOf(px) };
}

/** The pixels of one step of the plan, mixed in OKLab; null while its keyframes are not in. */
export function tweenPixels(step: Tween, keys: (Fitted | null)[], out: Uint8ClampedArray): Uint8ClampedArray | null {
  const a = keys[step.from];
  const b = keys[step.to];
  if (!a) return null;
  if (!b || step.t <= 0) { out.set(a.px); return out; }
  return mixLab(a.px, b.px, a.lab, b.lab, step.t, out);
}

/* ------------------------------------------------------------------ */
/* The strip a part plays                                              */
/* ------------------------------------------------------------------ */

/**
 * At most this many frames in a part's strip, and a frame at most this
 * wide or tall. 48 frames at 240 px is 11,520 px across, inside every
 * browser's canvas; a crate longer than 48 frames plays at its own length
 * with an even sample of its in-betweens.
 */
export const STRIP_FRAMES = 48;
export const STRIP_CELL = 240;

export interface CrateSheet {
  /** Something an element can show while the Builder is open (a blob address). */
  url: string;
  /** The strip itself, for the published site. */
  blob: Blob;
  /** Its file type, and the extension it is published under. */
  ext: "webp" | "png";
  frames: number;
  cellW: number;
  cellH: number;
  /** Seconds for one pass, and whether it goes round again. */
  seconds: number;
  once: boolean;
}

/** The frame size a part of this shape gets: its own proportions, no wider or taller than `STRIP_CELL`. */
export function cellFor(w: number, h: number): { w: number; h: number } {
  const W = Math.max(1, w), H = Math.max(1, h);
  const k = Math.min(1, STRIP_CELL / Math.max(W, H));
  return { w: Math.max(8, Math.round(W * k)), h: Math.max(8, Math.round(H * k)) };
}

async function build(asset: MotionAsset, cellW: number, cellH: number): Promise<CrateSheet | null> {
  const keys = filled(asset);
  if (keys.length < 2) return null;
  const imgs = await Promise.all(keys.map((k) => loadImage(k.src)));
  const fitted = imgs.map((img) => (img ? fit(img, cellW, cellH) : null));
  if (!fitted.some(Boolean)) return null;
  const plan = sampledPlan(asset, STRIP_FRAMES);
  const sheet = document.createElement("canvas");
  sheet.width = cellW * plan.length;
  sheet.height = cellH;
  const ctx = sheet.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(cellW, cellH);
  plan.forEach((step, i) => {
    if (tweenPixels(step, fitted, img.data)) ctx.putImageData(img, i * cellW, 0);
  });
  /* WebP where the browser writes it (a fraction of the PNG), PNG otherwise. */
  const as = (type: string) => new Promise<Blob | null>((r) => sheet.toBlob(r, type, 0.86));
  let blob = await as("image/webp");
  let ext: CrateSheet["ext"] = "webp";
  if (!blob || blob.type !== "image/webp") { blob = await as("image/png"); ext = "png"; }
  if (!blob) return null;
  return {
    url: URL.createObjectURL(blob), blob, ext,
    frames: plan.length, cellW, cellH,
    seconds: Math.max(0.05, playSeconds(asset)),
    once: asset.loop === "once",
  };
}

/*
 * One strip per crate and frame size, made once and kept while the crate is
 * the same object: the store hands back a new object for every change, so a
 * changed crate is a new key and the old strip is let go.
 */
const made = new WeakMap<MotionAsset, Map<string, Promise<CrateSheet | null>>>();
const ready = new WeakMap<MotionAsset, Map<string, CrateSheet | null>>();
const lastUrl = new Map<string, string>();

/** The strip, from the cache when it is already made. */
export function crateSheet(asset: MotionAsset, cellW: number, cellH: number): Promise<CrateSheet | null> {
  const key = `${cellW}x${cellH}`;
  let byKey = made.get(asset);
  if (!byKey) { byKey = new Map(); made.set(asset, byKey); }
  const had = byKey.get(key);
  if (had) return had;
  const p = build(asset, cellW, cellH).then((s) => {
    let r = ready.get(asset);
    if (!r) { r = new Map(); ready.set(asset, r); }
    r.set(key, s);
    /* The strip this one replaces is let go, once nothing is left showing it. */
    const slot = `${asset.id}:${key}`;
    const old = lastUrl.get(slot);
    if (s) lastUrl.set(slot, s.url);
    if (old && old !== s?.url) setTimeout(() => URL.revokeObjectURL(old), 4000);
    return s;
  }).catch(() => null);
  byKey.set(key, p);
  return p;
}

/** The strip if it is already made, without waiting: what a render in one pass (the export) reads. */
export function crateSheetNow(asset: MotionAsset, cellW: number, cellH: number): CrateSheet | null | undefined {
  return ready.get(asset)?.get(`${cellW}x${cellH}`);
}
