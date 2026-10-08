/**
 * A PART'S WINDOW DOES NOT TURN WITH THE PART.
 *
 * THE OWNER'S REPORT, trumpmorty.fun published: the big planet top-left
 * showed as an orange shape with a straight diagonal edge, not a circle's
 * arc. The capture cuts the planet to the hero it hangs out of
 * (`art.clipPath: inset(452px 0 0 365px)`), and the planet spins
 * (`spin 140s`). Both were written on one element, so the cut turned with
 * the planet and its straight edge swept across it. On the page the cut is
 * the hero's, and the hero does not turn. So a part that moves by an
 * animation of its own wears its cut on a still box round it; a part with
 * no animation keeps it where it was (the tilted ribbon's marquee, whose cut
 * sink works out in its own turned frame).
 *
 *   node tests/clip-stays.mjs
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
const format = { "palette.mode": "dark" };
const t = themeFrom(format), palette = resolvePalette(format, undefined);
const node = (id, f, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content: "", data: "", x: -365, y: -452, w: 1129, h: 1129, groupId: null, options: {},
  priority: "must", custom: false, locked: false, link: null, colour: null, font: null, texture: null,
  from: { url: "https://trumpmorty.fun/", host: "trumpmorty.fun", selector: `body > main > section:nth-of-type(1) > div#${id}` }, ...extra,
});
const draw = (n) => renderToStaticMarkup(React.createElement(Block, { node: n, t, palette, mode: "live", size: { w: n.w, h: n.h }, pictureAt: (p) => p.path }));
/* The style of the element carrying the part's animation class, and of what holds it. */
const around = (html, id) => {
  const i = html.indexOf(`mo-${id}`);
  const tagAt = html.lastIndexOf("<div", i);
  const own = html.slice(tagAt, html.indexOf(">", i));
  return { own, before: html.slice(0, tagAt) };
};

const planet = draw(node("n_picture_11", "picture", {
  picture: { id: "pic_fc667c26", path: "assets/pictures/pic_fc667c26.webp", type: "image/webp", w: 1200, h: 1200 },
  art: { clipPath: "inset(452px 0px 0px 365px)", animation: "spin" },
  motion: { animation: [{ name: "spin", duration: "140s", timing: "linear", delay: "0s", iterations: "infinite", direction: "normal", fill: "none" }] },
}));
const p = around(planet, "n_picture_11");
check("the spinning planet's own box carries no cut", p.own.length > 0 && !/clip-path/.test(p.own), p.own.slice(0, 220));
check("…the cut is on a still box round it, as written", /clip-path:inset\(452px 0px 0px 365px\)/.test(p.before), (p.before.match(/clip-path:[^;"]*/) ?? ["none"])[0]);

const track = draw(node("n_prose_20", "box", { x: -72, y: 862, w: 5660, h: 64, art: { clipPath: "inset(0px 2889px 0px 1331px)", transform: "matrix(0.999, -0.0436, 0.0436, 0.999, -1259.23, -34)" } }));
check("control: a still part keeps its cut on its own box, with its transform", /clip-path:inset\(0px 2889px 0px 1331px\)[^"]*transform:matrix/.test(track), (track.match(/style="[^"]*clip-path[^"]*"/) ?? ["none"])[0].slice(0, 200));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
