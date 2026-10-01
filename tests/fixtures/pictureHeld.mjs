/**
 * The capture's own pictures, decoded the way the Builder decodes them, for
 * the words-over-a-picture checks (`pictureSampler.ts`). A browser draws
 * each file from sink's assets/pictures into a small canvas and hands back
 * its pixels, so a pure check can sample the real picture under the words.
 * Pictures whose file is not in the checkout are left out (their words go
 * unjudged, as in the Builder).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export async function pictureHeld(chromium, sinkSite, nodes, executablePath) {
  const files = nodes.filter((n) => n.picture?.path && existsSync(join(sinkSite, n.picture.path)));
  if (!files.length) return new Map();
  const browser = await chromium.launch({ args: ["--no-sandbox"], ...(executablePath && existsSync(executablePath) ? { executablePath } : {}) });
  const page = await browser.newPage();
  const out = new Map();
  for (const n of files) {
    const bytes = readFileSync(join(sinkSite, n.picture.path)).toString("base64");
    const type = n.picture.type || (n.picture.path.endsWith(".png") ? "image/png" : n.picture.path.endsWith(".webp") ? "image/webp" : "image/jpeg");
    const got = await page.evaluate(async ({ src }) => {
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });
      const s = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h);
      return { w, h, natural: { w: img.naturalWidth, h: img.naturalHeight }, data: Array.from(g.getImageData(0, 0, w, h).data) };
    }, { src: `data:${type};base64,${bytes}` }).catch(() => null);
    if (got) out.set(n.id, { w: got.w, h: got.h, natural: got.natural, data: { data: Uint8ClampedArray.from(got.data) } });
  }
  await browser.close();
  return out;
}
