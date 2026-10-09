/**
 * A PICTURE MADE INTO A CURSOR.
 *
 * J (2026-10-09): "I would like to be able to generate an image and turn it
 * into a cursor ... a dedicated generate cursor option in the generate
 * section where it orientates the clickable or pointed section in the top
 * left as a normal cursor works, and it of course transparents the
 * background around it properly."
 *
 * So any picture becomes a cursor the same way: its plain background is
 * made see-through from the corners in (`seeThrough.ts`), it is cropped to
 * what is left, and the crop is fitted into a small square from the top
 * left, which is where the pointer's tip sits (the hotspot is 0 0). Browsers
 * drop a cursor picture larger than 128px, and draw anything past 32px
 * oversized, so it is made at 32. Pure but for `cursorFrom`, which needs a
 * canvas: `tests/cursor-picture.mjs` holds the pure half.
 */
import { cornerSeeds, seeThrough } from "./seeThrough";

/** What the Generate panel adds to the ask when it is drawing a cursor. */
export const CURSOR_ASK =
  "Draw it as a mouse pointer cursor icon: its tip at the very top-left corner of the picture, the shape pointing up and to the left, bold and simple so it reads at 32 pixels, on a plain flat pure white background with nothing else on it.";

/** The cursor's size in pixels: what every browser draws as is. */
export const CURSOR_PX = 32;

/** The box round what is not see-through (alpha above `min`), or null when nothing is. */
export function subjectBox(rgba: Uint8ClampedArray, w: number, h: number, min = 24): { x: number; y: number; w: number; h: number } | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3]! <= min) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Whether the corners are solid: a background to clear, not one already see-through. */
export function solidCorners(rgba: Uint8ClampedArray, w: number, h: number): boolean {
  return cornerSeeds(w, h).every(([x, y]) => rgba[(y * w + x) * 4 + 3]! > 200);
}

/** The picture's background cleared from its corners in, as RGBA. */
export function clearedForCursor(rgba: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  if (!solidCorners(rgba, w, h)) return rgba;
  return seeThrough(rgba, w, h, { seeds: cornerSeeds(w, h), tolerance: 34, feather: 22, trim: 1 });
}

/** Where the crop lands in the cursor square: scaled to fit, from the top left. */
export function fitTopLeft(box: { w: number; h: number }, size = CURSOR_PX): { w: number; h: number } {
  const k = size / Math.max(box.w, box.h);
  return { w: Math.max(1, Math.round(box.w * k)), h: Math.max(1, Math.round(box.h * k)) };
}

/** A picture (any address an <img> loads) as a cursor: a 32px PNG data address, tip at the top left. */
export async function cursorFrom(src: string, size = CURSOR_PX): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  const w = img.naturalWidth, h = img.naturalHeight;
  /* Read at most 512 across: the cut is the same, and a 2048² picture is slow to walk. */
  const k = Math.min(1, 512 / Math.max(w, h));
  const W = Math.max(1, Math.round(w * k)), H = Math.max(1, Math.round(h * k));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, W, H);
  const data = g.getImageData(0, 0, W, H);
  const clear = clearedForCursor(data.data, W, H);
  g.putImageData(new ImageData(new Uint8ClampedArray(clear), W, H), 0, 0);
  const box = subjectBox(clear, W, H) ?? { x: 0, y: 0, w: W, h: H };
  const fit = fitTopLeft(box, size);
  const out = document.createElement("canvas");
  out.width = size; out.height = size;
  const o = out.getContext("2d")!;
  o.imageSmoothingQuality = "high";
  o.drawImage(c, box.x, box.y, box.w, box.h, 0, 0, fit.w, fit.h);
  return out.toDataURL("image/png");
}

/**
 * "Generate a cursor" on the Custom cursor card opens the Pictures tab with
 * "Make it a cursor" on. The tab may not be mounted yet, so the ask is kept
 * here until it is, and said as an event for one that already is.
 */
let asked = false;
export function askCursorDraw(): void {
  asked = true;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("studio:cursor-draw"));
}
export function takeCursorAsk(): boolean {
  const was = asked;
  asked = false;
  return was;
}
