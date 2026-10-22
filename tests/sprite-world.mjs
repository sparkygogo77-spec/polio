/**
 * A SPRITE WORLD DRAWN AGAIN LIVE, AT ANY WIDTH (parts/World.tsx `stage`,
 * library/stageEngine.ts).
 *
 * The owner at 2000 wide: the page's pets wander on paths of their own at the
 * canvas's own size, so a wider window is a wider meadow; our flipbook, one
 * picture scaled to cover the box, made them huge, cut, and looping. A world
 * the capture read the makings of (a STANDIN one here: a sprite sheet of four
 * coloured squares, a green ground, two scenes, a host with a rider, a prop)
 * is drawn by the engine:
 *
 *   · at the page's own scale for the width (3 below 1900, 4 from it), so the
 *     art is as wide as the box and a pet is its own size, never stretched;
 *   · its characters wander: they move, not on a loop, each within its range,
 *     turning at its edge; a rider stays where it sat on its host;
 *   · each press area stands where its character is drawn, and opens its
 *     dialog; the scene's tab pans to the other scene and its characters;
 *   · a visitor asking for less motion sees it stand still.
 *
 *   node tests/sprite-world.mjs
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
await jiti.import("@/features/studio/board/store"); // the store door first: through jiti on Windows its create/builds/heldView cycle only forms when this loads first
const S = (...p) => join(here, "..", "src", "features", "studio", ...p);
const { Block } = await jiti.import(S("blocks.tsx"));
const { themeFrom, resolvePalette } = await jiti.import(S("shelf", "parts", "theme.ts"));
const { BEHAVIOURS } = await jiti.import(S("shelf", "library", "behaviours.ts"));
const { RUNTIME_JS } = await jiti.import(S("shelf", "library", "works.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 500)}`}`);
};
const svg = (w, h, body) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`).toString("base64")}`;
/* The sheet: host red 20×16 at 0, rider blue 8×6 at 20, prop yellow 6×6 at 28, sea host magenta 12×10 at 34. */
const sheet = svg(46, 16, `<rect x="0" y="0" width="20" height="16" fill="#ff0000"/><rect x="20" y="0" width="8" height="6" fill="#0000ff"/><rect x="28" y="0" width="6" height="6" fill="#ffff00"/><rect x="34" y="0" width="12" height="10" fill="#ff00ff"/>`);
const meadow = svg(100, 40, `<rect width="100" height="40" fill="#44aa44"/>`);
const beach = svg(100, 40, `<rect width="100" height="40" fill="#eecc88"/>`);
/* The ground the page painted at scale 3 (its widest box, 480 art px): a sky band over a dark foot, as sink keeps it. */
const painted = svg(480, 200, `<rect width="480" height="200" fill="#223366"/><rect y="180" width="480" height="20" fill="#123456"/>`);
const stage = {
  px: 3, scaleAt: [[0, 1.5], [700, 3], [1900, 4]], art: { w: 400, h: 200 },
  images: [sheet, meadow, beach, painted],
  sprites: { host: [0, 0, 0, 20, 16], rider: [0, 20, 0, 8, 6], prop: [0, 28, 0, 6, 6], sea: [0, 34, 0, 12, 10] },
  scenes: [
    { name: "Swamp", sky: "#aaddff", tab: "n_tab_swamp", layers: [{ img: 1, sx: 0, sy: 0, sw: 100, sh: 40, w: 100, h: 40, bottom: 0, repeat: true, side: "centre", x: 0 }], props: [{ frames: ["prop"], every: 200, side: "right", x: 10, bottom: 4 }] },
    { name: "Beach", sky: "#bbeeff", tab: "n_tab_beach", backgrounds: [{ img: 3, w: 480, h: 200, px: 3 }], layers: [{ img: 2, sx: 0, sy: 0, sw: 100, sh: 40, w: 100, h: 40, bottom: 0, repeat: true, side: "centre", x: 0 }], props: [] },
  ],
  label: { font: "8px monospace", fg: "#000000", bg: "#ffffff", edge: "#000000", h: 9, pad: 2 },
  motion: { speed: 40, pause: [0.2, 0.5], stop: 0.3 },
};
const dialog = (mint, t) => `<dialog class="sw0" data-mint="${mint}"><button class="sw0" type="button" data-world-close="" data-world-does="close" aria-label="Close">×</button><h2 class="sw0">${t}</h2></dialog>`;
const world = {
  every: 200, frames: 1, css: { sw0: "color:rgb(0, 0, 0);background-color:rgb(255, 255, 255)" },
  dialogs: [{ html: dialog("STANDIN_HOST", "$HOST") }, { html: dialog("STANDIN_RIDER", "$RIDER") }, { html: dialog("STANDIN_SEA", "$SEA") }],
  chars: [
    { key: "STANDIN_HOST", name: "$HOST", boxes: [null], dialog: 0, scene: 0, sprite: { r: "host" }, face: 1, at: 0.5, range: 0.2, foot: 4, label: "$HOST" },
    { key: "STANDIN_RIDER", name: "$RIDER", boxes: [null], dialog: 1, scene: 0, sprite: { r: "rider" }, face: 1, rides: 0, ride: [2, -4] },
    { key: "STANDIN_SEA", name: "$SEA", boxes: [null], dialog: 2, scene: 1, sprite: { r: "sea" }, face: 1, at: 0.3, range: 0.1, foot: 6, label: "$SEA" },
  ],
  stage,
};
const format = { "palette.mode": "light" };
const t = themeFrom(format), palette = resolvePalette(format, undefined);
const pic = { id: "pic_w", path: "assets/pictures/pic_w.png", type: "image/svg+xml", w: 1200, h: 600, bytes: 1, alt: "", from: "upload", pixelated: true };
const still = svg(1200, 600, `<rect width="1200" height="600" fill="#888"/>`);
const node = { id: "n_world", pageId: "page_home", featureId: "picture", label: "canvas-frames", prompt: "", content: "", data: "", x: 0, y: 0, w: 1200, h: 600, groupId: null, options: {}, priority: "must", custom: false, locked: false, link: null, colour: null, font: null, texture: null, picture: pic, world, from: { url: "https://STANDIN.example/", host: "STANDIN.example", selector: "body > main > canvas" } };
const draw = (w, h, mode = "live") => renderToStaticMarkup(React.createElement(Block, { node: { ...node, w, h }, t, palette, mode, size: { w, h }, pictureAt: () => still }));
const board = draw(1200, 600, "board");
check("on the board it is the captured picture: no engine, no canvas", !/data-world-canvas|data-world-stage/.test(board) && /<img/.test(board));
const script = BEHAVIOURS.find((w) => w.manifest.id === "world-dialogs").script;
const page = (w, h) => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style></head><body>
<div id="n_tab_swamp" style="position:absolute;left:0;top:0;width:60px;height:20px">Swamp</div><div id="n_tab_beach" style="position:absolute;left:70px;top:0;width:60px;height:20px">Beach</div>
<div id="n_world" style="position:absolute;left:0;top:30px;width:${w}px;height:${h}px">${draw(w, h)}</div>
<script id="site-features" type="application/json">${JSON.stringify([{ part: "n_world", feature: "world-dialogs", inputs: {} }])}</script>
<script>${RUNTIME_JS}</script><script>(function (siteFeatures) {\n${script}})(window.siteFeatures);</script></body></html>`;

const browser = await chromium.launch({ args: ["--no-sandbox"], executablePath: "/opt/pw-browsers/chromium" });
try {
  const errors = [];
  const at = async (W, H, reduce = false) => {
    const tab = await browser.newPage({ viewport: { width: W, height: H + 40 }, reducedMotion: reduce ? "reduce" : "no-preference" });
    tab.on("pageerror", (e) => errors.push(e.message));
    await tab.setContent(page(W, H), { waitUntil: "load" });
    await tab.waitForTimeout(300);
    return tab;
  };
  /* Where a colour is on the canvas, in art pixels, and the canvas's own size. */
  const find = (tab, rgb) => tab.evaluate((rgb) => {
    const c = document.querySelector("canvas[data-world-canvas]"), g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (d[i] === rgb[0] && d[i + 1] === rgb[1] && d[i + 2] === rgb[2]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
    return { art: [c.width, c.height], box: x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1] };
  }, rgb);
  const RED = [255, 0, 0], BLUE = [0, 0, 255], MAG = [255, 0, 255];

  const narrow = await at(1440, 600), wide = await at(2000, 600);
  const n = await find(narrow, RED), w = await find(wide, RED);
  check("drawn at the page's own scale for the width: 3 at 1440, 4 at 2000; the art as wide as the box", n.art[0] === 480 && w.art[0] === 500 && n.art[1] === 200 && w.art[1] === 150, JSON.stringify({ n: n.art, w: w.art }));
  check("…and a pet is its own size, never stretched or cut", JSON.stringify(n.box?.slice(2)) === "[20,16]" && JSON.stringify(w.box?.slice(2)) === "[20,16]", JSON.stringify({ n: n.box, w: w.box }));
  check("…standing on its foot, above the ground", n.box && n.box[1] + n.box[3] <= 200 - 4 + 1 && n.box[1] + n.box[3] >= 200 - 4 - 1, JSON.stringify(n.box));
  /* It wanders: sampled over two seconds, it goes somewhere and back, not round a fixed loop. */
  const xs = [];
  await narrow.bringToFront();
  for (let i = 0; i < 24; i++) { xs.push((await find(narrow, RED)).box?.[0]); await narrow.waitForTimeout(170); }
  const home = 0.5 * 480, range = 0.2 * 480;
  check("its host wanders: it moves, both ways, within its range either side of home", new Set(xs).size > 4 && xs.every((x) => x !== undefined && x + 10 >= home - range - 1 && x + 10 <= home + range + 1) && xs.some((x, i) => i > 0 && x > xs[i - 1]) && xs.some((x, i) => i > 0 && x < xs[i - 1]), JSON.stringify(xs));
  const h1 = await find(narrow, RED), r1 = await find(narrow, BLUE);
  check("a rider stays where it sat on its host", h1.box && r1.box && Math.abs((r1.box[1] - h1.box[1]) - -4) <= 1 && r1.box[0] >= h1.box[0] - 1 && r1.box[0] + r1.box[2] <= h1.box[0] + h1.box[2] + 1, JSON.stringify({ h1, r1 }));
  /* Its press area stands where it is drawn, and opens its dialog. */
  const hit = await narrow.evaluate(() => { for (const el of document.querySelectorAll("[data-world-hit]")) el.getBoundingClientRect(); const h = document.querySelector('[data-world-hit="0"]'), r = h.getBoundingClientRect(), c = document.querySelector("canvas[data-world-canvas]").getBoundingClientRect(); return { x: r.left - c.left, w: r.width, shown: getComputedStyle(h).visibility, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
  const now = await find(narrow, RED);
  check("the host's press area stands on it", hit.shown === "visible" && Math.abs(hit.x - (now.box[0] - 2) * 3) <= 3 * 8 && Math.abs(hit.w - (20 + 4) * 3) <= 1, JSON.stringify({ hit, now }));
  await narrow.evaluate(() => { window.__hold = true; });
  const box0 = await narrow.evaluate(() => { const r = document.querySelector('[data-world-hit="1"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await narrow.mouse.click(box0.x, box0.y);
  await narrow.waitForTimeout(80);
  const opened = await narrow.evaluate(() => Array.from(document.querySelectorAll("dialog[open]")).map((d) => d.getAttribute("data-world-key")));
  check("pressing where the rider is drawn opens the rider's dialog", JSON.stringify(opened) === '["STANDIN_RIDER"]', JSON.stringify(opened));
  await narrow.keyboard.press("Escape");
  /* The scene's tab pans to the beach: its own ground and its own pet. */
  await narrow.click("#n_tab_beach");
  await narrow.waitForTimeout(1200);
  const sea = await find(narrow, MAG), gone = await find(narrow, RED);
  const shown = await narrow.evaluate(() => ({ host: getComputedStyle(document.querySelector('[data-world-hit="0"]')).visibility, sea: getComputedStyle(document.querySelector('[data-world-hit="2"]')).visibility }));
  check("the Beach tab pans to the beach: its pet shown, the swamp's gone, and only its press area standing", !!sea.box && !gone.box && shown.sea === "visible" && shown.host === "hidden", JSON.stringify({ sea: sea.box, gone: gone.box, shown }));
  const band = await narrow.evaluate(() => { const c = document.querySelector("canvas[data-world-canvas]"), d = c.getContext("2d").getImageData(5, c.height - 5, 1, 1).data, u = c.getContext("2d").getImageData(5, 20, 1, 1).data; return [[d[0], d[1], d[2]], [u[0], u[1], u[2]]]; });
  check("…drawn on the ground the page painted there, as captured at this scale (its layers left for it)", JSON.stringify(band) === "[[18,52,86],[34,51,102]]", JSON.stringify(band));
  await narrow.click("#n_tab_swamp");
  await narrow.waitForTimeout(1200);
  check("…and the Swamp tab back", !!(await find(narrow, RED)).box && !(await find(narrow, MAG)).box);
  const calm = await at(1440, 600, true);
  await calm.bringToFront();
  const c1 = (await find(calm, RED)).box; await calm.waitForTimeout(700); const c2 = (await find(calm, RED)).box;
  check("a visitor asking for less motion sees the world stand still", !!c1 && JSON.stringify(c1) === JSON.stringify(c2), JSON.stringify({ c1, c2 }));
  check("no error on the page", !errors.length, errors.join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED — ${results.length - failed}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
