/**
 * A PICTURE ON A PART'S CONTENTS GOES BACK WITH THE DESIGN, FOR THE CODE TO APPLY.
 *
 * J's ask: drop or generate a picture for a part (PonsStars' trade buttons),
 * and the code chat that picks up his next design branch makes it that
 * part's look, keeping the hook and what the part does, even when the
 * picture is cropped loosely (`partPicture.ts`, BUILDER-RULES.md rule 25).
 *
 * Held here, without a browser:
 *   · the edges of a loosely cropped picture are found, on a see-through
 *     and on a plain margin; a picture with no margin is whole;
 *   · each hooked part wearing a picture becomes design/pictures/<hook>.<ext>
 *     (base64) plus design/pictures.json with hook, crop and note; a part
 *     with no hook, or whose bytes are gone, is said and not sent;
 *   · the kit rules carry "Pictures on parts" in the doc and builder.json.
 *
 *   node tests/part-picture.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pictureFiles, trimBox, PICTURES_LIST } from "../src/features/studio/partPicture.ts";

const canvas = (w, h, back) => {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) px.set(back, i * 4);
  return px;
};
const paint = (px, w, x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px.set(c, (y * w + x) * 4); };

// A button drawn at 10..29 × 5..14 on a see-through 40×20 canvas.
const clear = canvas(40, 20, [0, 0, 0, 0]);
paint(clear, 40, 10, 5, 29, 14, [40, 200, 90, 255]);
assert.deepEqual(trimBox(clear, 40, 20), { x: 10, y: 5, w: 20, h: 10 });

// The same on a plain white margin, with a little noise in the white.
const white = canvas(40, 20, [255, 255, 255, 255]);
white.set([248, 250, 252, 255], (3 * 40 + 3) * 4);
paint(white, 40, 4, 2, 35, 17, [200, 30, 30, 255]);
assert.deepEqual(trimBox(white, 40, 20), { x: 4, y: 2, w: 32, h: 16 });

// Corners that disagree: no margin, the whole picture.
const full = canvas(8, 8, [10, 10, 10, 255]);
paint(full, 8, 7, 7, 7, 7, [250, 250, 250, 255]);
assert.deepEqual(trimBox(full, 8, 8), { x: 0, y: 0, w: 8, h: 8 });

const pic = (id, type = "image/png") => ({ id, path: `pictures/${id}.png`, type, w: 40, h: 20, bytes: 10, alt: "" });
const nodes = [
  { label: "Buy", hooks: { "data-hook": "trade-buy" }, lookPicture: { picture: pic("a"), crop: { x: 10, y: 5, w: 20, h: 10 }, note: " glow on hover " } },
  { label: "Sell", source: { hook: { attr: "data-hook", value: "trade-sell" } }, lookPicture: { picture: pic("b", "image/webp"), crop: null } },
  { label: "Gone", hooks: { "data-hook": "trade-gone" }, lookPicture: { picture: pic("c"), crop: null } },
  { label: "Made here", lookPicture: { picture: pic("d"), crop: null } },
  { label: "Plain", hooks: { "data-hook": "plain" } },
];
const got = await pictureFiles(nodes, async (look) => (look.picture.id === "c" ? null : "QUJD"));
assert.deepEqual(got.files.map((f) => [f.path, f.encoding ?? "text"]), [
  ["design/pictures/trade-buy.png", "base64"],
  ["design/pictures/trade-sell.webp", "base64"],
  [PICTURES_LIST, "text"],
]);
assert.deepEqual(got.missing, ["trade-gone"]);
assert.deepEqual(got.unhooked, ["Made here"]);
const list = JSON.parse(got.files.at(-1).content);
assert.deepEqual(list.pictures[0], { hook: "trade-buy", label: "Buy", file: "design/pictures/trade-buy.png", size: { w: 40, h: 20 }, crop: { x: 10, y: 5, w: 20, h: 10 }, note: "glow on hover" });
assert.equal(list.pictures[1].hook, "trade-sell");
assert.match(list.about, /Pictures on parts/);

// Nothing wearing a picture: nothing added.
assert.deepEqual((await pictureFiles([{ hooks: { "data-hook": "x" } }], async () => "QUJD")).files, []);

const doc = readFileSync(new URL("../kit/BUILDER-RULES.md", import.meta.url), "utf8");
assert.match(doc, /^## 25\. Pictures on parts$/m);
assert.match(doc, /design\/pictures\.json/);
const { rules } = JSON.parse(readFileSync(new URL("../kit/builder.json", import.meta.url), "utf8"));
assert.equal(rules.list.at(-1).id, "pictures-on-parts");

console.log("part-picture: ok");
