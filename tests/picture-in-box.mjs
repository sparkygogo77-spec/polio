/**
 * A PICTURE STAYS IN ITS BOX, AND A LAYER SIZED BY ITS BLOCK STAYS WHERE IT STOOD.
 *
 * parasiteonsol.fun's hero canvas (n_picture_836) is `position: absolute;
 * width: 100%; height: 100%` of its 1251 × 706 frame, 2px in from its left.
 * Published at 2000 its left came from the rule for a centred column
 * (`133px + 0.5 × (… − min(1247px, …))`) and its width from its units (all of
 * the frame): 1826 wide at x 423, over the page. And its picture, in wrappers
 * of height auto, stood 1028 tall in a 706 box. A layer whose units set its
 * width and not its left keeps its own offset in its block; a picture part's
 * picture is held to the part's box.
 *
 *   node tests/picture-in-box.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { chromium } = require("playwright-core");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
const { layerStyle, innerBlock } = await jiti.import(join(here, "..", "src", "features", "studio", "layerUnits.ts"));
const { Block } = await jiti.import(join(here, "..", "src", "features", "studio", "blocks.tsx"));
const { themeFrom, resolvePalette } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
/* The frame grows with the window (all of it); the canvas stood 2px in from its left. */
const block = { left: "133px", top: "95px", width: "calc(1251px + (100% - 1425px))", height: "706px" };
/* Its units are of the frame's inside (units.of.box: 135, 97, 1247 × 702), the frame being 133, 95, 1251 × 706 with a 2px border. */
const inner = innerBlock(block, { x: 133, y: 95, w: 1251, h: 706 }, [135, 97, 1247, 702]);
const st = layerStyle({ width: "100%", height: "100%" }, inner, 1247, 702, 702 / 1247, { x: 0, y: 0 });
const browser = await chromium.launch({ args: ["--no-sandbox"], executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
for (const W of [1425, 2000]) {
  const page = await browser.newPage({ viewport: { width: W, height: 900 } });
  await page.setContent(`<body style="margin:0"><div style="position:relative;width:100%;height:900px"><div id="f" style="position:absolute;left:${block.left};width:${block.width};top:95px;height:706px"></div><div id="c" style="position:absolute;left:${st?.left ?? "auto"};width:${st?.width ?? "auto"};top:${st?.top ?? "97px"};height:${st?.height ?? "702px"}"></div></div></body>`);
  const b = await page.evaluate(() => Object.fromEntries(["f", "c"].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [id, [Math.round(r.left), Math.round(r.right), Math.round(r.height)]]; })));
  check(`${W}: the canvas fills its frame's inside: 2px in from each edge, 702 tall`, b.c[0] === b.f[0] + 2 && b.c[1] === b.f[1] - 2 && b.c[2] === 702, JSON.stringify(b));
  await page.close();
}
/* A picture part 400 × 200 holding a 1600 × 900 picture, in its box. */
const t = themeFrom({}), palette = resolvePalette({}, undefined);
const pic = { id: "pic_w", path: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'/%3E", type: "image/svg+xml", w: 1600, h: 900, bytes: 1, alt: "", from: "upload" };
const n = { id: "p", pageId: "p0", featureId: "picture", label: "canvas", prompt: "", content: "", data: "", x: 0, y: 0, w: 400, h: 200, groupId: null, options: {}, priority: "must", custom: false, locked: false, link: null, colour: null, font: null, texture: null, picture: pic, from: { url: "https://x/", host: "x", selector: "body > canvas" } };
const html = renderToStaticMarkup(React.createElement(Block, { node: n, t, palette, mode: "live", size: { w: 400, h: 200 }, pictureAt: (p) => p.path }));
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.setContent(`<body style="margin:0"><div id="part" style="position:absolute;left:10px;top:10px;width:400px;height:200px;min-height:200px;display:flex;flex-direction:column">${html}</div></body>`);
/* What the export does to a picture a layer's units size (exportSite.ts): its wrapper held to the part's height. */
await page.evaluate(() => { const el = document.getElementById("part"); for (const box of el.querySelectorAll(":scope > [data-part-box], :scope > [data-still-cut], :scope > [data-still-cut] > [data-part-box]")) { box.style.flex = "1 1 0"; box.style.minHeight = "0"; } });
const img = await page.evaluate(() => { const i = document.querySelector("img"); const r = i.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.top), Math.round(r.bottom)]; });
check("a picture part's picture stays inside its 400 × 200 box", img[1] <= 200 && img[3] <= 210, JSON.stringify(img));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED — ${results.length - failed}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
