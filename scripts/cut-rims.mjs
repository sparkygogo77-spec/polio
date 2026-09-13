/**
 * Cut a nine-slice rim sheet out of one of J's box sprites.
 *
 *   node scripts/cut-rims.mjs      # with the Builder running on :3000
 *
 * J renders whole lantern boxes: a moulded bezel with its own glass and its
 * own light caught in the corners, around a face. A card is a band on one
 * row and a square on another, so the sprite cannot be stretched to it —
 * the corners would stretch with everything else and the moulding would
 * smear. `border-image` cuts the picture into nine and stretches only the
 * four sides, which is what this prepares the sheet for.
 *
 * Three things are done to a sprite here, and each of them is why the raw
 * file cannot be used as it stands:
 *
 * 1. **The tabs come off.** Every one of J's boxes has a small decorative
 *    tab sticking out at the middle of a left or right edge. That is exactly
 *    where a nine-slice's side strip is, and a side strip stretches — one
 *    tab would become a bar down the whole side of the card. Cropping to the
 *    rounded box's own bounding rectangle leaves them outside it. The boxes
 *    below are that rectangle, measured off the alpha.
 * 2. **The middle is cleared.** A nine-slice with no `fill` throws the
 *    middle away, and the face comes from the tile underneath; a transparent
 *    middle is a third of the bytes for the same picture.
 * 3. **It is halved.** The rim draws about nine pixels thick, so a forty
 *    pixel slice was four times more detail than it can ever show. Twenty is
 *    still more than a two-times screen asks for, and a quarter of the file.
 *
 * It runs in the browser because the browser is the only image decoder here,
 * and because it decodes and resamples the file exactly as the page will.
 */
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

/** The sheet's own slice, in its own pixels, and what `molten.css` cuts at. */
const SLICE = 20;
/** Half: nine pixels of rim never needed forty pixels of sprite. */
const SCALE = 0.5;

/** Each sprite, and the rounded box inside it — left, top, right, bottom, inclusive. */
const CUTS = [
  ["box-green.png", "rim-green.png", [6, 5, 530, 268]],
  ["box-red.png", "rim-red.png", [6, 6, 396, 301]],
  // The other red J sent. Cut it if it is wanted; nothing wears it today.
  // ["box-red-alt.png", "rim-red-alt.png", [5, 5, 434, 308]],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
await page.goto(process.env.AT ?? "http://localhost:3000/builder", { waitUntil: "domcontentloaded" });

for (const [src, out, [x0, y0, x1, y1]] of CUTS) {
  const b64 = await page.evaluate(async ([src, x0, y0, x1, y1, slice, scale]) => {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });
    const sw = x1 - x0 + 1, sh = y1 - y0 + 1;
    const w = Math.round(sw * scale), h = Math.round(sh * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(img, x0, y0, sw, sh, 0, 0, w, h);
    x.clearRect(slice, slice, w - slice * 2, h - slice * 2);
    return c.toDataURL("image/png").split(",")[1];
  }, [`/construct/${src}`, x0, y0, x1, y1, SLICE, SCALE]);
  const bytes = Buffer.from(b64, "base64");
  writeFileSync(`public/construct/${out}`, bytes);
  console.log(`${out}  ${Math.round((x1 - x0 + 1) * SCALE)}×${Math.round((y1 - y0 + 1) * SCALE)}  slice ${SLICE}  ${(bytes.length / 1024).toFixed(0)}kb`);
}
await browser.close();
