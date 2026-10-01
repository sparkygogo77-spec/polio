/**
 * REMAKE A PICTURE FROM ONE PROMPT: the parts that are only arithmetic.
 *
 * The owner's words: "right-click any image on the site, type one prompt,
 * make that image an instant reference, and by default have GPT Image 2
 * regenerate it with the prompt, replacing it at the exact same dimensions,
 * with the same purpose and animations."
 *
 * The picture goes to OpenAI's image edit call as the reference, with the
 * prompt; what comes back is fitted to the original's exact pixel width and
 * height and put on the same part in place of the old one. This file holds
 * what that needs that is not a network call or a canvas: which models there
 * are and which to fall back to, and which size to ask for.
 *
 * Pure: no React, no fetch, so `tests/remake-picture.mjs` runs it as written,
 * and the route and the browser read the same answers.
 */

/** OpenAI's GPT image models that take an image to edit, newest first. */
export const REMAKE_MODELS: { id: string; label: string; free: boolean }[] = [
  /* `free`: any width and height in multiples of 16 (the 2 family); the rest take three fixed sizes. */
  { id: "gpt-image-2", label: "GPT Image 2", free: true },
  { id: "gpt-image-2.5-sunburst", label: "GPT Image 2.5 Sunburst", free: true },
  { id: "gpt-image-2.5-flare", label: "GPT Image 2.5 Flare", free: true },
  { id: "gpt-image-1.5", label: "GPT Image 1.5", free: false },
  { id: "gpt-image-1", label: "GPT Image 1", free: false },
];

/** The owner's default: GPT Image 2. */
export const DEFAULT_REMAKE_MODEL = "gpt-image-2";

/** The setting that holds the model, in the Builder's settings. */
export const REMAKE_MODEL_SETTING = "studio.remakeModel";

export function modelLabel(id: string): string {
  return REMAKE_MODELS.find((m) => m.id === id)?.label ?? id;
}

/** Newest first, for falling back: the 2.5 models are newer than 2, then 1.5, then 1. */
const NEWEST_FIRST = ["gpt-image-2.5-sunburst", "gpt-image-2.5-flare", "gpt-image-2", "gpt-image-1.5", "gpt-image-1"];

/**
 * Which model to use, given the one asked for and the ones the key can use
 * (`null` when the list could not be read, in which case the one asked for
 * is tried as it is). When it is not open to the key, the newest GPT image
 * model that is, and the caller says so.
 */
export function pickModel(wanted: string, open: readonly string[] | null): { model: string; fellBack: boolean } | null {
  if (!open) return { model: wanted, fellBack: false };
  const has = (id: string) => open.some((o) => o === id || o.startsWith(`${id}-20`));
  if (has(wanted)) return { model: wanted, fellBack: false };
  const next = NEWEST_FIRST.find(has);
  return next ? { model: next, fellBack: true } : null;
}

/**
 * The size to ask for, nearest the original.
 *
 * The 2 family takes any size whose sides are multiples of 16, between 1:3
 * and 3:1, no side over 3840, and between 655,360 and 8,294,400 pixels: the
 * original's own shape is kept, scaled into that range. The older models
 * take three sizes; the one nearest the original's shape is asked for. Either
 * way the answer is fitted to the exact original size afterwards.
 */
export function askSize(model: string, w: number, h: number): { w: number; h: number } {
  const free = REMAKE_MODELS.find((m) => m.id === model)?.free ?? model.startsWith("gpt-image-2");
  const ratio = Math.max(1 / 3, Math.min(3, w / Math.max(1, h)));
  if (!free) {
    const sizes = [{ w: 1024, h: 1024 }, { w: 1536, h: 1024 }, { w: 1024, h: 1536 }];
    return sizes.reduce((best, s) => (Math.abs(Math.log(s.w / s.h / ratio)) < Math.abs(Math.log(best.w / best.h / ratio)) ? s : best));
  }
  const MIN = 655_360, MAX = 8_294_400, EDGE = 3840;
  /* The original's area, held inside the range, at the original's (clamped) shape. */
  const area = Math.max(MIN, Math.min(MAX, w * h));
  let W = Math.sqrt(area * ratio);
  let H = W / ratio;
  const over = Math.max(W / EDGE, H / EDGE, 1);
  W /= over; H /= over;
  const snap = (v: number) => Math.max(16, Math.round(v / 16) * 16);
  let sw = snap(W), sh = snap(H);
  /* Rounding can step out of the range by a row of sixteen: step back in. */
  while (sw * sh < MIN) { if (sw / sh < ratio) sw += 16; else sh += 16; }
  while (sw * sh > MAX || sw > EDGE || sh > EDGE) { if (sw / sh > ratio) sw -= 16; else sh -= 16; }
  return { w: sw, h: sh };
}

/**
 * Where to cut the answer so it fills the original exactly: scaled until it
 * covers the original's box, and the overhang taken equally from both sides,
 * so the middle of the picture, where its subject usually is, stays put.
 */
export function coverCrop(srcW: number, srcH: number, outW: number, outH: number): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(outW / srcW, outH / srcH);
  const sw = outW / scale, sh = outH / scale;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh };
}

/** Pictures this many versions back are kept, the first (the original) always. */
export const KEEP_VERSIONS = 12;
