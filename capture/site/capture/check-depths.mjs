/**
 * A CANVAS PINNED TO THE WINDOW IS READ AT EVERY DEPTH OF THE PAGE.
 *
 * sunkcoin.fun (J, 2026-10-11): the sea is a fixed canvas under the whole
 * page whose camera is the scroll, and its minimap, fixed at the right,
 * draws a window where the scroll is. Read once at the top, the sea was the
 * surface everywhere and the minimap a still: "the scrollbar on the right is
 * a static image in the preview instead of a live scroll bar that shows you
 * the depth of the site". Now every canvas with a fixed ancestor is read
 * again at each depth of the page (capture-route.mjs `sampleDepths`), kept
 * as `depths` when what it shows changes with the scroll by more than it
 * changes on its own, and the converter lays the stills in one strip
 * (`canvas-depths.svg`, `picture.depths`) that the Builder slides to the
 * band for where the scroll is (`scroll-depths`, tests/scroll-depths.mjs).
 *
 *   node capture/site/capture/check-depths.mjs
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
/*
 * The stand-in page, 3000px tall in a 1000 × 600 window: a sea the window's
 * size whose colour deepens with the scroll and a line that marks it; a
 * minimap 20 × 300 at the right with a window where the scroll is; a badge
 * drawn once (fixed, but the same at every depth: read once); and a canvas
 * in the flow (not pinned: read once).
 */
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;height:3000px}
#sea{position:fixed;inset:0;width:100vw;height:100vh;z-index:0}#map{position:fixed;right:10px;top:150px;width:20px;height:300px;z-index:2}
#badge{position:fixed;left:10px;top:10px;width:40px;height:40px;z-index:2}#flow{position:absolute;left:100px;top:1200px;width:200px;height:100px}
section{position:relative;z-index:1;margin:0 0 0 100px;width:600px;height:400px;background:rgba(255,255,255,.2)}</style></head><body>
<canvas id="sea" width="500" height="300"></canvas><canvas id="map" width="20" height="300"></canvas><canvas id="badge" width="40" height="40"></canvas><canvas id="flow" width="200" height="100"></canvas>
<section></section><section></section><section></section>
<script>
const s=sea.getContext("2d"),m=map.getContext("2d"),b=badge.getContext("2d"),f=flow.getContext("2d");
b.fillStyle="#f5d90a";b.fillRect(0,0,40,40);b.fillStyle="#000";b.fillRect(10,10,20,20);
f.fillStyle="#3a7";f.fillRect(0,0,200,100);f.fillStyle="#fff";f.fillRect(20,20,160,10);
function paint(){const H=document.documentElement.scrollHeight-innerHeight,q=H>0?scrollY/H:0;
s.fillStyle="rgb("+Math.round(40-q*35)+","+Math.round(120-q*100)+","+Math.round(200-q*150)+")";s.fillRect(0,0,500,300);
s.fillStyle="#fff";s.fillRect(0,Math.round(q*280),500,8);
m.fillStyle="#102040";m.fillRect(0,0,20,300);m.strokeStyle="#fff";m.lineWidth=2;m.strokeRect(1,1+Math.round(q*240),18,58);
requestAnimationFrame(paint);}
paint();
</script></body></html>`;
const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const work = mkdtempSync(join(tmpdir(), "capture-depths-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "600", "--assets", assets, "--settle", "1", "--frames", "1", "--depths-every", "300"], { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
server.close();
check("the stand-in page was captured", cap.status === 0 && existsSync(capFile), cap.err.trim().split("\n").pop());
const capd = existsSync(capFile) ? JSON.parse(readFileSync(capFile, "utf8")) : null;
const canvases = {};
(function w(e) { if (!e) return; if (e.t === "canvas") canvases[e.w] = e; (e.kids ?? []).forEach(w); })(capd?.tree);
const sea = canvases[1000], map = canvases[20], badge = canvases[40], flow = canvases[200];
const d = sea?.depths;
check("the sea, pinned to the window, is read at 9 depths: every 300px from the top to the foot (2400)", d?.stills?.length === 9 && d.at[0] === 0 && d.at[8] === 2400 && d.every === 300 && d.view === 600 && d.page === 3000, JSON.stringify(d ? { n: d.stills?.length, at: d.at, every: d.every, view: d.view, page: d.page } : Object.keys(sea ?? {})));
check("…each depth its own picture", d && new Set(d.stills).size === d.stills.length, d ? `${new Set(d.stills).size} distinct of ${d.stills.length}` : "");
check("the minimap, 20 × 300 with a moving window, is read at the same depths", map?.depths?.stills?.length === 9 && map.depths.at[8] === 2400, JSON.stringify(map?.depths?.at ?? Object.keys(map ?? {})));
check("a badge pinned to the window but the same at every depth is read once", !!badge && !badge.depths, JSON.stringify(badge?.depths?.at));
check("a canvas in the flow is read once", !!flow && !flow.depths, JSON.stringify(flow?.depths?.at));
check("the stderr says which canvases follow the scroll", /depths: canvas \d+ follows the scroll/.test(cap.err) && /depths: canvas \d+ is the same at every depth/.test(cap.err), cap.err.split("\n").filter((l) => l.startsWith("depths:")).join(" | "));

writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [1000, 600], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the capture converts", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };
const seaNode = doc.nodes.find((n) => /canvas:nth-of-type\(1\)$/.test(n.from?.selector ?? ""));
const mapNode = doc.nodes.find((n) => /canvas:nth-of-type\(2\)$/.test(n.from?.selector ?? ""));
const badgeNode = doc.nodes.find((n) => /canvas:nth-of-type\(3\)$/.test(n.from?.selector ?? ""));
const sp = seaNode?.picture;
check("the sea is a strip of depths: canvas-depths.svg, picture.depths of 9 bands each 600 tall, at the scrolls read", sp?.path?.endsWith(".svg") && sp.depths?.bands === 9 && sp.depths.band === 600 && sp.depths.at?.[8] === 2400 && seaNode.from?.position === "fixed", JSON.stringify(sp));
const seaFile = sp?.path ? join(work, "out", sp.path) : null;
const svg = seaFile && existsSync(seaFile) ? readFileSync(seaFile, "utf8") : "";
check("…the svg is the canvas's width and 9 times its height, 9 stills down it", /width="1000" height="5400"/.test(svg) && (svg.match(/<image /g) ?? []).length === 9, svg.slice(0, 160));
check("the minimap is a strip too: 9 bands of 300", mapNode?.picture?.depths?.bands === 9 && mapNode.picture.depths.band === 300, JSON.stringify(mapNode?.picture));
check("the badge is one picture, no depths", !!badgeNode?.picture && !badgeNode.picture.depths, JSON.stringify(badgeNode?.picture));

const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
