/**
 * A FILM MAY ONLY RECORD PIXELS THE ELEMENT ITSELF PAINTS (frames-drive.mjs),
 * from thesolface.site's hero.
 *
 * J saw a blurry copy of the whole hero laid over the board: the frames pass
 * filmed `section:nth-of-type(1)` as a "pointer" film (1440 x 991 from frames
 * 512 x 320, the fixed header and the title in the shot), the cursor glow as a
 * screenshot of whatever sat under it, and the ticker (1917 x 124 from frames
 * 512 x 59). The real parts were under it, crisp, and the film covered them.
 *
 * A stand-in page has
 *
 *   (1) a hero section (1100 x 640) of a heading, a button and three layers
 *       that blink in three places, a fixed header with links above it:
 *       no film of the section;
 *   (2) a glow that follows the pointer (fixed, `mix-blend-mode: screen`, 450
 *       square): no film (its pixels are the page under it);
 *   (3) a ticker, a track of words 1900 px wide sliding in a clipped band
 *       (already parts and motion): no film;
 *   (4) a small dot that blinks (48 x 48): still filmed;
 *   (5) a floating picture (an <img> with a drop-shadow, 200 square): already a
 *       part, no film (a blurry copy of the frog lay over the real one);
 *   (6) a blurred, translucent glow (a div of a radial gradient with a blur,
 *       300 square): its pixels are the page behind it, no film.
 *
 *   node capture/site/capture/check-film-own-pixels.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); c.stdout.pipe(process.stdout); });
const dir = mkdtempSync(join(tmpdir(), "check-film-own-pixels-"));

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#0a1018;color:#f6f5ef;font:16px sans-serif}
  header{position:fixed;top:0;left:0;right:0;height:60px;z-index:20;display:flex;gap:24px;padding:18px 24px;background:#0a1018cc}
  header a{color:#4cff83}
  .hero{position:relative;width:1100px;height:640px;margin:80px 50px 0;background:#101c2c;overflow:hidden}
  .hero h1{position:absolute;left:40px;top:40px;margin:0;font-size:56px}
  .hero button{position:absolute;left:40px;top:150px;padding:14px 26px;font-size:20px}
  .hero .l{position:absolute;width:120px;height:120px;border-radius:50%;background:#4cff83;animation:blink 1s steps(2) infinite}
  .hero .l1{left:500px;top:100px}.hero .l2{left:760px;top:260px}.hero .l3{left:300px;top:430px}
  @keyframes blink{50%{opacity:.15}}
  #glow{position:fixed;left:-500px;top:-500px;width:450px;height:450px;margin:-225px 0 0 -225px;pointer-events:none;mix-blend-mode:screen;background:radial-gradient(circle,rgba(53,255,138,.5),rgba(0,0,0,0) 65%);z-index:5}
  .ticker{width:1200px;height:70px;overflow:hidden;margin:40px 50px;background:#0c2a22}
  .track{display:flex;width:1900px;animation:slide 8s linear infinite}
  .track span{flex:none;width:380px;font:700 36px/70px sans-serif;color:#4cff83}
  @keyframes slide{to{transform:translateX(-950px)}}
  .dot{width:48px;height:48px;margin:30px 50px;border-radius:50%;background:#ff8a3c;animation:blink 1s steps(2) infinite}
  .frog{position:absolute;left:880px;top:140px;width:200px;height:200px;filter:drop-shadow(0 0 20px #4cff83);animation:bob 2s ease-in-out infinite}
  @keyframes bob{50%{translate:0 -14px;opacity:.6}}
  .aura{position:absolute;left:600px;top:380px;width:300px;height:300px;background:radial-gradient(circle,rgba(23,234,166,.55),rgba(0,0,0,0) 70%);filter:blur(12px);animation:blink 1s steps(2) infinite}
  .tall{height:600px}
</style></head><body>
<header><a href="#a">LORE</a><a href="#b">STORY</a><a href="#c">ROADMAP</a></header>
<section class="hero"><h1>THE HERO TITLE</h1><button>MEET THE LEGEND</button><div class="l l1"></div><div class="l l2"></div><div class="l l3"></div><img class="frog" alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Ccircle cx='100' cy='100' r='80' fill='%234cff83'/%3E%3C/svg%3E"><div class="aura"></div></section>
<div class="ticker"><div class="track"><span>SEE THE GREEN</span><span>TRUST THE VISION</span><span>SEE THE GREEN</span><span>TRUST THE VISION</span><span>SEE THE GREEN</span></div></div>
<div class="dot"></div>
<div id="glow"></div>
<div class="tall"></div>
<script>addEventListener("pointermove", function (e) { var g = document.getElementById("glow"); g.style.left = e.clientX + "px"; g.style.top = e.clientY + "px"; });</script>
</body></html>`;

const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1200, 800], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1200", "--height", "800", "--assets", assets, "--settle", "3", "--behaviours"]).catch(() => {});
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* the converter failed */ }
const F = doc.behaviours?.motion?.frames ?? [];
const J = (x) => JSON.stringify(x);
const boxes = F.map((f) => ({ kind: f.kind, box: f.box, frame: [f.w, f.h] }));
const wide = (f) => f.box && f.box[2] >= 600;
check("(1) the hero section is not filmed", !F.some((f) => f.box && f.box[2] >= 1000 && f.box[3] >= 500), J(boxes));
check("(2) the glow is not filmed (a 450 square)", !F.some((f) => f.box && f.box[2] === 450 && f.box[3] === 450), J(boxes));
check("(3) the ticker is not filmed (nothing 600 px wide or more)", !F.some(wide), J(boxes));
check("(4) the small blinking dot is still filmed", F.some((f) => f.box && f.box[2] === 48 && f.box[3] === 48), J(boxes));
check("(5) the floating picture is not filmed (a 200 square)", !F.some((f) => f.box && f.box[2] === 200 && f.box[3] === 200), J(boxes));
check("(6) the blurred glow is not filmed (a 300 square)", !F.some((f) => f.box && f.box[2] >= 290 && f.box[2] <= 330 && f.box[3] >= 290 && f.box[3] <= 330), J(boxes));
check("(7) no film is shown larger than its frames (no blur over the board): drawn at most 1.5 times the frame", F.every((f) => f.box && f.w && Math.max(f.box[2], f.box[3]) / Math.max(f.w, f.h) <= 1.5), J(boxes));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.name}${r.ok ? "" : ` — ${String(r.detail).slice(0, 500)}`}`); }
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} ok`);
process.exit(failed ? 1 : 0);
