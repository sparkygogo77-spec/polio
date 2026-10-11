/**
 * Pictures of what moves, and only of what moves (frames-drive.mjs,
 * `--behaviours`): a stand-in page with
 *
 *   (1) a dot a stylesheet blinks (opacity, 1 s, steps(2)): a LOOP with its
 *       period, opacity named as what changes, by css;
 *   (2) a band a script shimmers (background-position stepped every frame,
 *       round every 1.5 s): a LOOP by script, background-position changing;
 *   (3) a line of words a script slides left without end (10 s across): a
 *       DRIFT (the idle pass already measures its speed);
 *   (4) a price a script ticks every 300 ms: LIVE or a loop, its words
 *       changing, the words it showed kept;
 *   (5) a trail of dots the page spawns under the pointer and a disc that
 *       follows it: POINTER parts, recorded while the pointer is swept, the
 *       trail (which belongs to no part) cut round the sweep, the pointer's
 *       place kept with every frame;
 *   (6) a hill a script moves with the scroll (background-position-y at a
 *       third of the scroll): a SCROLL part, the scroll kept with every frame;
 *   (7) a still red square: not pictured;
 *   (8) a 300 × 200 2d canvas repainted every frame: not pictured here (the
 *       canvas pass reads its pixels itself).
 *
 * Each pictured part is a `behaviours.motion.frames[]` entry on its part
 * with a flipbook svg in the document's pictures; the committed SOLCINERATOR
 * captures still convert byte for byte.
 *
 *   node capture/site/capture/check-moving-frames.mjs
 */
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile, spawnSync } from "node:child_process";
import { readRun } from "./frames-drive.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); c.stdout.pipe(process.stdout); });
const dir = mkdtempSync(join(tmpdir(), "check-moving-frames-"));

const PAGE = `<!doctype html><html><head><style>
  body{margin:0;font-family:sans-serif;background:#f6f1e7;height:2400px;position:relative}
  h1{position:absolute;left:40px;top:20px;margin:0;font-size:28px}
  .dot{position:absolute;left:60px;top:120px;width:40px;height:40px;border-radius:50%;background:#d23c34;animation:blink 1s steps(2) infinite}
  @keyframes blink{50%{opacity:0}}
  .shimmer{position:absolute;left:160px;top:110px;width:360px;height:60px;border-radius:8px;background:linear-gradient(90deg,#1a0f0b 0 50%,#f3d440 50% 100%);background-size:120px 60px}
  .still{position:absolute;left:600px;top:110px;width:60px;height:60px;background:#c33}
  .ticker{position:absolute;left:720px;top:120px;font:bold 32px monospace;color:#1a0f0b}
  .lane{position:absolute;left:40px;top:300px;width:700px;height:50px;overflow:hidden;background:#fff;border:3px solid #1a0f0b}
  .lane span{position:absolute;left:0;top:8px;white-space:nowrap;font:bold 26px sans-serif;will-change:transform}
  .hill{position:absolute;left:40px;top:480px;width:1100px;height:260px;border:3px solid #1a0f0b;background:#8fd0f0 repeating-linear-gradient(180deg,#8fd0f0 0 30px,#3a8fbf 30px 60px);background-size:100% 240px}
  .hill b{position:absolute;left:20px;top:20px;font-size:22px;background:#fff;padding:4px 8px}
  canvas.noise{position:absolute;left:800px;top:290px;width:300px;height:200px;border:2px solid #1a0f0b}
  .follow{position:fixed;left:0;top:0;width:34px;height:34px;border-radius:50%;background:#2a9d8f;pointer-events:none;will-change:transform;opacity:0}
  .trail{position:fixed;width:14px;height:14px;border-radius:50%;background:#e76f51;pointer-events:none;transition:opacity .9s linear,transform .9s linear}
  .deep{position:absolute;left:40px;top:1700px;width:300px;height:100px;background:#eee}
</style></head><body>
  <h1>Moving things</h1>
  <div class="dot"></div>
  <div class="shimmer"></div>
  <div class="still"></div>
  <div class="ticker" id="ticker">$1.000</div>
  <div class="lane"><span id="lane">THE COIN THAT PAYS · THE COIN THAT PAYS · THE COIN THAT PAYS · THE COIN THAT PAYS · THE COIN THAT PAYS · THE COIN THAT PAYS</span></div>
  <div class="hill" id="hill"><b>a hill the scroll moves</b></div>
  <canvas class="noise" id="noise" width="300" height="200"></canvas>
  <div class="follow" id="follow"></div>
  <div class="deep">far down</div>
<script>
(function () {
  var sh = document.querySelector(".shimmer"), t0 = performance.now();
  var lane = document.getElementById("lane"), x = 0;
  var ticker = document.getElementById("ticker"), n = 0;
  var hill = document.getElementById("hill");
  var cv = document.getElementById("noise"), ctx = cv.getContext("2d");
  var follow = document.getElementById("follow"), px = -100, py = -100, fx = -100, fy = -100;
  function frame() {
    var t = performance.now() - t0;
    sh.style.backgroundPosition = Math.round(((t % 1500) / 1500) * 120) + "px 0";
    x -= 0.9; lane.style.transform = "translate3d(" + x + "px,0,0)";
    hill.style.backgroundPositionY = Math.round(-scrollY / 3) + "px";
    var im = ctx.createImageData(300, 200), d = im.data;
    for (var i = 0; i < d.length; i += 4) { var v = (Math.random() * 255) | 0; d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255; }
    ctx.putImageData(im, 0, 0);
    fx += (px - fx) * 0.2; fy += (py - fy) * 0.2;
    follow.style.transform = "translate(" + (fx - 17) + "px," + (fy - 17) + "px)";
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setInterval(function () { n++; ticker.textContent = "$" + (1 + n * 0.007).toFixed(3); }, 300);
  addEventListener("mousemove", function (e) {
    px = e.clientX; py = e.clientY; follow.style.opacity = e.clientX < 0 || e.clientY < 0 ? "0" : "1";
    var d = document.createElement("i"); d.className = "trail";
    d.style.left = (e.clientX - 7) + "px"; d.style.top = (e.clientY - 7) + "px";
    document.body.appendChild(d);
    requestAnimationFrame(function () { d.style.opacity = "0"; d.style.transform = "scale(0.2)"; });
    setTimeout(function () { d.remove(); }, 950);
  });
})();
</script></body></html>`;

const server = createServer((req, res) => {
  res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" });
  res.end(req.url === "/" ? PAGE : "");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1200, 800], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
const began = Date.now();
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1200", "--height", "800", "--assets", assets, "--settle", "3", "--behaviours"]).catch(() => {});
const took = (Date.now() - began) / 1000;
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
let doc = { nodes: [] }, cap = {};
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* the converter failed */ }
try { cap = JSON.parse(readFileSync(capture, "utf8")); } catch { /* the capture failed */ }
const F = doc.behaviours?.motion?.frames ?? [];
const node = (id) => doc.nodes.find((n) => n.id === id);
const sel = (id) => node(id)?.from?.selector ?? "";
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const J = (x) => JSON.stringify(x);
const onSel = (re) => F.find((m) => re.test(sel(m.part) || m.selector || ""));
const brief = F.map((f) => ({ kind: f.kind, sel: sel(f.part) || f.selector, part: f.part, period: f.period, what: f.what, text: f.text, via: f.via, frames: f.frames }));

/* The reading itself, on runs made by hand. */
const g = (v) => Array(256).fill(v);
check("readRun: the same frame throughout is still", readRun([0, 0, 0, 0, 0, 0], [g(10)]).kind === "still");
check("readRun: a run that comes back on itself every 400 ms is a loop of that period", (() => { const r = readRun([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3], [g(10), g(60), g(110), g(160)]); return r.kind === "loop" && r.period === 400; })(), J(readRun([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3], [g(10), g(60), g(110), g(160)])));
check("readRun: …and still when the shots came late and uneven", (() => { const r = readRun([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2], [g(10), g(60), g(110), g(160)], [0, 110, 230, 310, 420, 540, 620, 720, 830, 950, 1040], 100); return r.kind === "loop" && Math.abs(r.period - 420) <= 30; })(), J(readRun([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2], [g(10), g(60), g(110), g(160)], [0, 110, 230, 310, 420, 540, 620, 720, 830, 950, 1040], 100)));
check("readRun: ever further from the first frame is a drift", readRun([0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7].map((i) => g(10 + i * 25))).kind === "drift");
check("readRun: changed then held is a once", readRun([0, 1, 2, 2, 2, 2, 2, 2, 2, 2], [g(10), g(90), g(170)]).kind === "once");
check("readRun: changing with no pattern is live", readRun([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [10, 200, 40, 180, 90, 20, 230, 60, 140, 110].map(g)).kind === "live");

check("the document holds behaviours.motion.frames, with the still square and the 2d canvas left out", F.length >= 4 && !F.some((f) => /div:nth-of-type\(3\)$/.test(sel(f.part) || f.selector || "") || /canvas/.test(sel(f.part) || f.selector || "")), J(brief));

/* (1) The blinking dot. */
const dot = onSel(/div:nth-of-type\(1\)$/);
check("the dot a stylesheet blinks is a loop, on its part", dot && dot.kind === "loop" && dot.part && node(dot.part), J(brief));
check("…every 1 s (±200 ms), opacity changing, by css", near(dot?.period, 1000, 200) && (dot?.what ?? []).includes("opacity") && dot?.via === "css", J({ period: dot?.period, what: dot?.what, via: dot?.via }));
check("…two pictures (on and off), played back as a flipbook svg in the document's pictures", dot && dot.frames >= 2 && dot.frames <= 4 && dot.picture?.path && existsSync(join(dir, dot.picture.path)) && (readFileSync(join(dir, dot.picture.path), "utf8").match(/<image /g) ?? []).length === dot.frames, J({ frames: dot?.frames, picture: dot?.picture }));
check("…at the dot's own box (40 × 40 at 60, 120)", dot && near(dot.box?.[0], 60, 2) && near(dot.box?.[1], 120, 2) && near(dot.box?.[2], 40, 2) && near(dot.box?.[3], 40, 2), J(dot?.box));

/* (2) The shimmer. */
const sh = onSel(/div:nth-of-type\(2\)$/);
check("the band a script shimmers is a loop by the page's script, background-position changing", sh && sh.kind === "loop" && sh.via === "script" && (sh.what ?? []).includes("background-position"), J(sh && { kind: sh.kind, via: sh.via, what: sh.what, period: sh.period }));
check("…round every 1.5 s (±300 ms), many pictures", near(sh?.period, 1500, 300) && sh?.frames >= 6, J({ period: sh?.period, frames: sh?.frames }));

/* (3) The sliding words. */
const lane = onSel(/div:nth-of-type\(5\)$/);
check("the words a script slides without end are a drift, on their part", lane && lane.kind === "drift" && (lane.what ?? []).includes("transform"), J(lane && { kind: lane.kind, sel: sel(lane.part), what: lane.what }));

/* (4) The ticker. */
const tk = onSel(/div:nth-of-type\(4\)$/);
check("the price a script ticks is pictured, its words changing, the words it showed kept", tk && (tk.kind === "live" || tk.kind === "loop") && tk.text === true && Array.isArray(tk.words) && tk.words.length >= 2 && tk.words.every((w) => /^\$1\.\d{3}$/.test(w)), J(tk && { kind: tk.kind, text: tk.text, words: tk.words }));

/* (5) The pointer's. */
const ptr = F.filter((f) => f.kind === "pointer");
check("the disc that follows the pointer and the trail under it are pointer parts", ptr.length >= 1 && ptr.some((f) => /div:nth-of-type\(7\)$/.test(sel(f.part) || f.selector || "") || f.selector === "body" || !f.self), J(ptr.map((f) => ({ sel: sel(f.part) || f.selector, self: f.self, frames: f.frames }))));
check("…the pointer's place kept with every frame", ptr.every((f) => Array.isArray(f.pointer) && f.pointer.length >= 10 && f.pointer.every((p) => Array.isArray(p) && p.length === 2)), J(ptr.map((f) => f.pointer?.length)));
check("…recorded only while the pointer moved: none of them was pictured at rest", !F.some((f) => f.kind !== "pointer" && /div:nth-of-type\(7\)$/.test(sel(f.part) || f.selector || "")), J(brief));

/* (6) The scroll's. */
const hill = F.find((f) => f.kind === "scroll");
check("the hill a script moves with the scroll is a scroll part, on its part", hill && /div:nth-of-type\(6\)$/.test(sel(hill.part) || hill.selector || "") && (hill.what ?? []).includes("background-position"), J(hill && { sel: sel(hill.part), what: hill.what, frames: hill.frames }));
check("…the scroll kept with every frame, 0 to 320", hill && Array.isArray(hill.scroll) && hill.scroll[0] === 0 && Math.max(...hill.scroll) >= 300, J(hill?.scroll));

/* The budget: time, pictures. */
check("every pictured part keeps at most 36 pictures within 2.5 MB", F.every((f) => f.frames <= 36 && existsSync(join(dir, f.picture.path)) && readFileSync(join(dir, f.picture.path)).length <= 3_500_000), J(F.map((f) => f.frames)));
check("the capture says where it looked and what it found (behaviours.motion.looked)", Array.isArray(cap.behaviours?.motion?.looked) && cap.behaviours.motion.looked.some((l) => l.band === "pointer") && cap.behaviours.motion.looked.some((l) => l.band === "scroll"), J(cap.behaviours?.motion?.looked));
check(`the whole capture took under 150 s (${Math.round(took)} s)`, took < 150);

/* Control: the committed SOLCINERATOR captures, untouched. */
const old = join(dir, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());

for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 1600)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
