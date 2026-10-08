/**
 * A BOX THAT CARRIES A PICTURE DRAWS IT.
 *
 * THE OWNER'S REPORT, trumpmorty.fun imported: the hero's sky, both desert
 * layers and the star field behind the lore section are missing, and the page
 * looks flat. The capture reads a CSS background as `node.picture` on a box
 * (n_box_9 sky.webp, n_box_12 desert-far, n_box_13 desert-near, n_box_3
 * space-navy, and five more), and the box part (`PlainBox`) never drew its
 * picture: no <img>, no background-image, on the board, in Preview or in the
 * export. A `picture` part draws its <img>; a box drew nothing.
 *
 * Drawn as the page's background was. The capture keeps the picture, not
 * how it was sized, so the size is inferred from the picture's shape: a strip
 * (three times wider than tall or more: desert-far 2400×520, desert-near
 * 2400×460) is the full height of the box and repeats across it, as the
 * site's `auto 100% repeat-x`; anything else covers the box, centred, as its
 * `center/cover`. Rendered here through the same `Block` the board, Preview
 * and the export draw with, with the export's `pictureAt`.
 *
 *   node tests/box-picture.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
const { Block } = await jiti.import(join(here, "..", "src", "features", "studio", "blocks.tsx"));
const { themeFrom, resolvePalette } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const t = themeFrom({ "palette.mode": "dark" });
const palette = resolvePalette({ "palette.mode": "dark" }, undefined);
const pic = (id, w, h) => ({ id, path: `assets/pictures/${id}.webp`, type: "image/webp", w, h, bytes: 1, alt: "", from: "upload" });
const node = (id, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: "box", label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, locked: false, link: null, colour: null, font: null, texture: null,
  from: { url: "https://trumpmorty.fun/", host: "trumpmorty.fun", selector: `body > main > div#${id}` }, ...extra,
});
const draw = (n) => renderToStaticMarkup(React.createElement(Block, { node: n, t, palette, mode: "live", size: { w: n.w, h: n.h }, pictureAt: (p) => p.path }));

const sky = draw(node("n_box_9", -58, -54, 1555, 1008, { picture: pic("pic_e708d8b0", 2400, 1350), colour: { text: "rgb(26, 15, 11)" } }));
check("the hero's sky box draws its picture", sky.includes("assets/pictures/pic_e708d8b0.webp"), sky.slice(0, 300));
check("…covering the box, centred (the site's center/cover)", /background-size:\s*cover/.test(sky) && /background-position:\s*(center|50% 50%)/.test(sky), sky.match(/background[^;"]*/g)?.join("; "));

const far = draw(node("n_box_12", -72, 459, 1584, 324, { picture: pic("pic_35adc8e6", 2400, 520) }));
check("a desert strip draws its picture", far.includes("assets/pictures/pic_35adc8e6.webp"));
check("…the box's full height, repeating across (the site's auto 100% repeat-x)", /background-size:\s*auto 100%/.test(far) && /background-repeat:\s*repeat-x/.test(far), far.match(/background[^;"]*/g)?.join("; "));

const space = draw(node("n_box_3", 0, 900, 1440, 801, { picture: pic("pic_41810bca", 1600, 1000), colour: { bg: "rgb(41, 47, 68)", surface: "rgb(41, 47, 68)" }, pad: { top: 150, bottom: 130 } }));
check("the lore section's star field draws over its navy ground", space.includes("assets/pictures/pic_41810bca.webp") && /rgb\(41, 47, 68\)/.test(space));

const bare = draw(node("plain", 0, 0, 200, 100));
check("control: a box with no picture draws no background picture", !/background-image|url\(/.test(bare), bare.slice(0, 200));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
