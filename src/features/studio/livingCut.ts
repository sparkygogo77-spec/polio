/**
 * Cutting a picture into layers, in the browser.
 *
 * No model and no prompt: the picture is split by how bright it is. The
 * back layer is the whole picture, so nothing behind ever shows through;
 * each layer in front holds only the parts brighter than the one behind it,
 * see-through elsewhere, with soft edges. On a generated picture that is
 * usually right: the glowing lines and highlights lift off the dark ground
 * and drift over it (`living.ts`).
 *
 * Front first, the order CSS stacks backgrounds in.
 */
import { MAX_LAYERS } from "./living";

/** The longest side a layer is kept at: enough for a panel, light enough to ride in the style layer. */
const MAX_SIDE = 640;

function open(src: string): Promise<HTMLImageElement> {
  return new Promise((done, fail) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => done(img);
    img.onerror = () => fail(new Error("This browser cannot open that picture."));
    img.src = src;
  });
}

export async function cutLayers(src: string, count: number): Promise<string[]> {
  const n = Math.max(2, Math.min(MAX_LAYERS, Math.round(count)));
  const img = await open(src);
  const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("This browser cannot cut pictures.");
  g.drawImage(img, 0, 0, w, h);
  const base = g.getImageData(0, 0, w, h);
  const px = base.data;
  /* Brightness of every pixel; the front layers split what lies between the middle brightness and the brightest. */
  const lum = new Float32Array(w * h);
  for (let i = 0; i < lum.length; i++) lum[i] = (0.2126 * px[i * 4]! + 0.7152 * px[i * 4 + 1]! + 0.0722 * px[i * 4 + 2]!) * (px[i * 4 + 3]! / 255);
  const sorted = Array.from(lum).sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)]!, top = sorted[Math.floor(sorted.length * 0.995)]!;
  const out: string[] = [c.toDataURL("image/png")];
  for (let layer = 1; layer < n; layer++) {
    const at = mid + ((top - mid) * layer) / n;
    const soft = Math.max(4, (top - mid) / (4 * n));
    const cut = new ImageData(new Uint8ClampedArray(px), w, h);
    for (let i = 0; i < lum.length; i++) {
      const t = Math.min(1, Math.max(0, (lum[i]! - at + soft) / (2 * soft)));
      cut.data[i * 4 + 3] = Math.round(px[i * 4 + 3]! * t * t * (3 - 2 * t));
    }
    g.putImageData(cut, 0, 0);
    out.push(c.toDataURL("image/png"));
  }
  return out.reverse();
}
