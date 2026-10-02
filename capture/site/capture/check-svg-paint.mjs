/**
 * AN INLINE SVG IS CARRIED AS THE PAGE DRAWS IT: ITS SHAPES' TURNS, AND THE
 * PAINT A STYLESHEET GIVES THEM.
 *
 * THE OWNER'S REPORT, trumpmorty.fun's BUY ON PUMP.FUN pill: the page draws
 * `<rect x=2 y=7 width=20 height=10 rx=5 transform="rotate(-35 12 12)"/>`,
 * painted only by `.btn--pump .pill { fill: var(--white); stroke: var(--ink);
 * stroke-width: 2 }`. His copy had a level outline in the text's colour: the
 * rect as a path, the turn dropped, the fill and stroke replaced. An icon is
 * carried as strokes for the Builder's drawn icon only when every shape is in
 * the icon's own colour, unturned and opaque (its width and caps aside: a
 * plain line icon stays one the Builder can recolour). Anything else is kept whole, a picture of
 * itself, each shape's computed paint and its own turn (attribute or CSS, its
 * origin and box as the browser resolved them) written on it.
 *
 * A stand-in page, each icon rasterised as carried against the page's own
 * pixels (mean difference per channel, over the icon's box):
 *   (1) the pill: a turned rect, fill and stroke from a stylesheet;
 *   (2) a bar turned by a CSS transform (`rotate(45deg)`, origin centre,
 *       `transform-box: fill-box`), in the text's colour;
 *   (3) one colour, a fixed red from a stylesheet, 3 wide, square caps: a
 *       drawn icon still (the Builder can recolour it), its colour carried
 *       as the part's and its width and caps as `vector.stroke`;
 *   (4) a group turned by its attribute, holding a plain shape;
 *   (5) a shape half transparent (opacity .4 on the circle, not the svg);
 *   (5b) a one-colour pixel X drawn `shape-rendering: crispEdges` (gotchi.gg's
 *       close): a drawn icon still (check-late-art (8)), its edges hard
 *       (`vector.crisp`);
 *   (6) control: a 2-wide round outline in the text's colour, unturned, is
 *       still a drawn icon (gotchi's check-late-art (4) holds the same);
 *   (7) control: a pixel icon of rects in three colours is still a picture.
 * Control: the committed SOLCINERATOR captures convert byte for byte.
 *
 *   node capture/site/capture/check-svg-paint.mjs
 */
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Stand-in icons</title>
<style>
  body{margin:0;font:16px/20px sans-serif;color:rgb(26,15,11);background:rgb(166,216,111)}
  .row{display:flex;gap:24px;padding:40px}
  .i{width:56px;height:56px;display:block}
  .pill{fill:rgb(250,250,250);stroke:rgb(26,15,11);stroke-width:2}
  .spin{transform:rotate(45deg);transform-origin:center;transform-box:fill-box}
  .red path{stroke:rgb(200,30,30);stroke-width:3;stroke-linecap:square;fill:none}
  .faint{opacity:.4}
</style></head><body><div class="row">
  <svg class="i" id="i1" viewBox="0 0 24 24"><rect class="pill" x="2" y="7" width="20" height="10" rx="5" transform="rotate(-35 12 12)"/></svg>
  <svg class="i" id="i2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="spin" d="M4 12h16"/></svg>
  <svg class="i red" id="i3" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
  <svg class="i" id="i4" viewBox="0 0 24 24" fill="currentColor"><g transform="rotate(30 12 12)"><rect x="6" y="4" width="12" height="16"/></g></svg>
  <svg class="i" id="i5" viewBox="0 0 24 24" fill="currentColor"><circle class="faint" cx="12" cy="12" r="9"/></svg>
  <svg class="i" id="i6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18M5 16l4-5 4 3 6-8"/></svg>
  <svg class="i" id="i7" viewBox="0 0 4 4" shape-rendering="crispEdges"><rect x="0" y="0" width="2" height="2" fill="currentColor"/><rect x="2" y="0" width="2" height="2" fill="#FFFFFF"/><rect x="0" y="2" width="4" height="2" fill="#FF5CA8"/></svg>
  <svg class="i" id="i8" viewBox="0 0 12 12" shape-rendering="crispEdges" fill="currentColor"><path d="M1 1h3v1h1v1h1v1h1V3h1V2h1V1h2v1h-1v1H9v1H8v1H7v1h1v1h1v1h1v1h1v2H8v-1H7V9H6V8H5v1H4v1H3v1H1v-1h1V9h1V8h1V7h1V6H4V5H3V4H2V3H1z"/></svg>
</div><div style="height:600px"></div></body></html>`;

const server = createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  if (req.url === "/p.png") { res.writeHead(200, { "content-type": "image/png" }); res.end(PNG); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const work = mkdtempSync(join(tmpdir(), "capture-svg-paint-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap0 = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "600", "--assets", assets, "--settle", "1"], { stdio: ["ignore", "pipe", "pipe"], env });
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
  p.on("close", (status) => resolve({ status, out, err }));
});
server.close();
check("the stand-in page was captured", cap0.status === 0 && existsSync(capFile), (cap0.err || cap0.out).trim().split("\n").pop());
writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [1000, 600], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the capture converts", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };
/* The page's own pixels, each icon's box. */
const { chromium } = await import("playwright-core").catch(async () => ({ chromium: (await import("module")).createRequire(import.meta.url)("/opt/node22/lib/node_modules/playwright").chromium }));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 1 });
await page.setContent(PAGE);
const J = (x) => JSON.stringify(x);
const ICONS = ["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8"];
const BG = "rgb(166,216,111)";
/** A picture of what is carried for one icon, drawn at its box on the page's ground: the picture's file, or the drawn icon as the Builder draws it (polio vector.ts#vectorMarkup, with `vector.stroke`). */
const carried = (n) => {
  if (!n) return null;
  /* The part's own opacity, as the Builder draws a part's box (parts/theme.ts#boxStyle). */
  const op = typeof n.opacity === "number" ? n.opacity : 1;
  const html = carriedOf(n);
  return html && op < 1 ? `<div style="opacity:${op}">${html}</div>` : html;
};
const carriedOf = (n) => {
  if (n.picture) return `<img src="data:image/svg+xml;base64,${readFileSync(join(work, "out", n.picture.path)).toString("base64")}" style="width:${n.w}px;height:${n.h}px;display:block">`;
  if (n.vector) {
    const line = n.options?.["drawn as"] !== "solid";
    const k = n.vector.stroke ?? { width: 2, cap: "round", join: "round" };
    const inner = n.vector.paths.map((p) => (line ? `<path d="${p.d}" fill="none" stroke="currentColor" stroke-width="${k.width}" stroke-linecap="${k.cap}" stroke-linejoin="${k.join}"/>` : `<path d="${p.d}" fill="currentColor"/>`)).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n.vector.viewBox}"${n.vector.crisp ? ' shape-rendering="crispEdges"' : ""} style="width:${n.w}px;height:${n.h}px;display:block;color:${n.colour?.text ?? "rgb(26, 15, 11)"}" fill="currentColor">${inner}</svg>`;
  }
  return null;
};
const pixels = async (html, w, h) => {
  const p = await browser.newPage({ viewport: { width: w + 20, height: h + 20 }, deviceScaleFactor: 1 });
  await p.setContent(`<body style="margin:0;background:${BG}"><div style="position:absolute;left:10px;top:10px">${html}</div></body>`);
  await p.waitForTimeout(100);
  const b = await p.screenshot({ clip: { x: 10, y: 10, width: w, height: h } });
  await p.close();
  return b;
};
const diff = (a, b) => page.evaluate(async ([a, b]) => {
  const load = async (s) => { const i = new Image(); i.src = `data:image/png;base64,${s}`; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
  const x = await load(a), y = await load(b);
  if (x.length !== y.length) return 255;
  let t = 0; for (let i = 0; i < x.length; i += 4) t += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]);
  return t / (x.length / 4) / 3;
}, [a.toString("base64"), b.toString("base64")]);
const nodeOf = (id) => doc.nodes.find((n) => new RegExp(`svg:nth-of-type\\(${Number(id.slice(1))}\\)$`).test(n.from?.selector ?? ""));
const said = {};
for (const id of ICONS) {
  const n = nodeOf(id);
  const box = await page.evaluate((id) => { const q = document.getElementById(id).getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; }, id);
  const live = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
  const html = carried(n);
  said[id] = { kind: n?.picture ? "picture" : n?.vector ? "drawn icon" : "nothing", diff: html ? +(await diff(live, await pixels(html, box.w, box.h))).toFixed(2) : null };
}
const close = (id) => said[id].diff !== null && said[id].diff <= 3;
check("(1) the pill is drawn as the page draws it: turned, white, outlined in ink", close("i1"), J(said.i1));
check("(2) a bar turned by a CSS transform is turned", close("i2"), J(said.i2));
check("(3) one fixed red, 3 wide, square caps, from a stylesheet: still a drawn icon, drawn at its colour, width and caps", said.i3.kind === "drawn icon" && close("i3"), J(said.i3));
check("(4) a group turned by its attribute", close("i4"), J(said.i4));
check("(5) a shape half transparent", close("i5"), J(said.i5));
check("(5b) a one-colour pixel X drawn on the pixel grid is still a drawn icon, with its hard edges", said.i8.kind === "drawn icon" && close("i8"), J(said.i8));
check("(6) control: a 2-wide round outline in the text's colour is still a drawn icon, and draws the same", said.i6.kind === "drawn icon" && close("i6"), J(said.i6));
check("(7) control: a pixel icon in three colours is still a picture, and draws the same", said.i7.kind === "picture" && close("i7"), J(said.i7));
await browser.close();

/* Control */
const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
