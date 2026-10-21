/**
 * A CANVAS KEEPS WHAT IT DREW.
 *
 * gotchi.gg draws its pets as pixel art on <canvas> elements (the egg and
 * the blob in "hatch and raise", the pet on the device's screen). A capture
 * kept each as an empty box, so the export showed nothing there. A canvas
 * that is drawn and readable (not tainted by another origin's picture) is
 * a picture now: the pixels it held when the dump ran, as a PNG, at its box.
 * A blank canvas stays a box.
 *
 * And a big scene repainted every frame (parasiteonsol.fun's hero: 416×234
 * pixels, a new picture every read, ~3.5 MB over three seconds) was dropped
 * whole once its frames passed the budget, leaving one still. It keeps as
 * many frames as fit, taken evenly across the time it was watched, each
 * standing as long as the ones it stands for: a flipbook still.
 *
 * And a 3D (webgl) canvas, which clears what it drew once the frame is on
 * screen, was read as blank: mochi.trade's creatures were lost. It keeps
 * the picture it showed.
 *
 *   node capture/site/capture/check-canvas.mjs
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
const PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">
<canvas id="pet" width="14" height="16" style="width:56px;height:64px;image-rendering:pixelated;margin:40px"></canvas>
<canvas id="blank" width="10" height="10" style="width:40px;height:40px"></canvas>
<canvas id="scene" width="416" height="234" style="display:block;width:832px;height:468px;image-rendering:pixelated"></canvas>
<canvas id="gl" width="120" height="60" style="display:block;width:120px;height:60px"></canvas>
<script>const gx=gl.getContext("webgl");(function draw(){gx.clearColor(0.2,0.8,0.4,1);gx.clear(gx.COLOR_BUFFER_BIT);requestAnimationFrame(draw);})();
const g=pet.getContext("2d");g.fillStyle="#f6c";g.fillRect(2,2,10,12);g.fillStyle="#2b1d2e";g.fillRect(4,5,2,2);g.fillRect(8,5,2,2);
const sc=scene.getContext("2d"),img=sc.createImageData(416,234);let seed=1;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
(function paint(){for(let i=0;i<img.data.length;i+=4){img.data[i]=rnd()*255;img.data[i+1]=rnd()*255;img.data[i+2]=rnd()*255;img.data[i+3]=255;}sc.putImageData(img,0,0);requestAnimationFrame(paint);})();</script></body></html>`;
const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const work = mkdtempSync(join(tmpdir(), "capture-canvas-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "600", "--assets", assets, "--settle", "1"], { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
server.close();
check("the stand-in page was captured", cap.status === 0 && existsSync(capFile), cap.err.trim().split("\n").pop());
writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [1000, 600], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the capture converts", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };
const pet = doc.nodes.find((n) => /canvas(:nth-of-type\(1\))?$/.test(n.from?.selector ?? "") && n.w === 56);
const blank = doc.nodes.find((n) => /canvas:nth-of-type\(2\)$/.test(n.from?.selector ?? ""));
const file = pet?.picture?.path ? join(work, "out", pet.picture.path) : null;
check("the drawn canvas is a picture at its box", !!pet?.picture && pet.w === 56 && pet.h === 64, JSON.stringify(doc.nodes.map((n) => [n.from?.selector, n.w, n.h, !!n.picture])));
check("…whose file is the PNG of its 14×16 pixels", !!file && existsSync(file) && pet.picture.w === 14 && pet.picture.h === 16 && readFileSync(file).subarray(1, 4).toString() === "PNG", JSON.stringify(pet?.picture));
check("a blank canvas is not a picture", !blank?.picture, JSON.stringify(blank?.picture));
const capd = existsSync(capFile) ? JSON.parse(readFileSync(capFile, "utf8")) : null;
let sceneEl = null; (function w(e) { if (!e) return; if (e.t === "canvas" && e.w === 832) sceneEl = e; (e.kids ?? []).forEach(w); })(capd?.tree);
const fr = sceneEl?.frames;
const span = (fr?.steps ?? []).reduce((a, [, d]) => a + d, 0);
check("the big scene repainted every frame keeps frames, not one still", (fr?.frames?.length ?? 0) >= 6, JSON.stringify(fr ? { frames: fr.frames.length, steps: fr.steps.length } : Object.keys(sceneEl ?? {})));
check("…within the budget, taken across the whole time watched (≥ 2.5 s)", fr && fr.frames.reduce((a, u) => a + u.length, 0) <= 4_000_000 && span >= 2500, JSON.stringify(fr && { bytes: fr.frames.reduce((a, u) => a + u.length, 0), span }));
let glEl = null; (function w(e) { if (!e) return; if (e.t === "canvas" && e.w === 120) glEl = e; (e.kids ?? []).forEach(w); })(capd?.tree);
/* Its middle pixel, read back from the PNG by a browser: green and solid, where a blank read is see-through. */
const glPx = glEl?.drawn ? await (async () => {
  const { launch } = await import("./tools/browser.mjs");
  const b = await launch();
  try {
    const pg = await b.newPage();
    return await pg.evaluate(async (src) => { const im = new Image(); im.src = src; await im.decode(); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0); return Array.from(g.getImageData(im.width >> 1, im.height >> 1, 1, 1).data); }, glEl.drawn);
  } finally { await b.close(); }
})().catch(() => null) : null;
check("a 3D (webgl) canvas keeps the picture it showed, not a blank", !!glPx && glPx[3] === 255 && glPx[1] > 150 && glPx[0] < 100, JSON.stringify(glPx ?? (glEl ? Object.keys(glEl) : null)));
const sceneNode = doc.nodes.find((n) => /canvas:nth-of-type\(3\)$/.test(n.from?.selector ?? ""));
check("…and it is a flipbook picture", sceneNode?.picture?.path?.endsWith(".svg"), JSON.stringify(sceneNode?.picture));

const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
