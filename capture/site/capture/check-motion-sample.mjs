/**
 * Motion only a page's script (or its stylesheet, unnamed by any class
 * change) makes, sampled from the browser the way a visitor would see it,
 * on ANY page (docs/behaviours.md, "Motion sampled"):
 *
 *   (1) a disc turned by `requestAnimationFrame` (inline `rotate()`, one
 *       turn in 12 s, anticlockwise): a spin, its period and direction;
 *   (2) a ring floated by CSS `@keyframes` on the `translate` property
 *       (14 px up and back every 4 s, ease-in-out), and a moon a script
 *       bobs (a sine, 10 px either way, every 5 s): floats, their axis,
 *       travel, period and curve;
 *   (3) a card a `mousemove` listener tilts toward the pointer over it
 *       (`perspective(900px) rotateY(px × 14deg) rotateX(−py × 12deg)
 *       translateY(−6px)`), and a button a `:hover` rule lifts 4 px: a
 *       hover tilt with its degrees per unit and lift, and a hover lift;
 *   (4) a canvas repainted every frame with specks drifting up (four
 *       colours, one speck every 20 px of width): a particle canvas;
 *   (5) a marquee whose step is `0.6 + min(|scroll velocity| × 0.25, 14)`
 *       px a frame: its base step, its boost per px of scroll a frame and
 *       its cap;
 *   (6) a line whose width a script grows from 0 to 100 % as its section
 *       passes (`(vh × .85 − top) / (height + vh × .3)`): a scroll-grow
 *       line, where it starts and ends;
 *   (7) a list the page's script rebuilds every time it is scrolled (a live
 *       feed: parasiteonsol.fun's /coins): its old rows leave the page
 *       while the scroll is sampled, and the capture goes on without them.
 *
 * Captured with `--behaviours` and converted: `doc.behaviours.motion`
 * must hold each on its part (or, for the canvas, its box and the parts
 * either side of it), with the numbers measured; a still decoy must not
 * be named, and the committed SOLCINERATOR captures still convert byte
 * for byte.
 *
 *   node capture/site/capture/check-motion-sample.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile, spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); c.stdout.pipe(process.stdout); });
const dir = mkdtempSync(join(tmpdir(), "check-motion-sample-"));

const PAGE = `<!doctype html><html><head><style>
  body{margin:0;font-family:sans-serif;background:#f3d440}
  .hero{position:relative;height:760px;overflow:hidden;background:#6ac}
  #dust{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}
  .disc{position:absolute;left:60px;top:80px;width:220px;height:220px;border-radius:50%;background:conic-gradient(#e74,#fc6,#e74);z-index:2}
  .ring{position:absolute;left:420px;top:120px;width:160px;height:90px;border-radius:50%;border:10px solid #3cb;z-index:2;animation:bob 4s ease-in-out infinite}
  @keyframes bob{50%{translate:0 -14px}}
  .still{position:absolute;left:700px;top:120px;width:120px;height:120px;background:#c33;z-index:2}
  .moon{position:absolute;left:940px;top:90px;width:90px;height:90px;border-radius:50%;background:#eee;z-index:2}
  .card{position:absolute;left:300px;top:380px;width:320px;height:220px;background:#fff;border:4px solid #111;border-radius:18px;z-index:3;transition:transform .15s linear}
  .btn{position:absolute;left:760px;top:420px;padding:18px 30px;background:#a6e22e;border:3px solid #111;border-radius:12px;font-size:24px;cursor:pointer;transition:transform .2s ease;z-index:3}
  .btn:hover{transform:translateY(-4px)}
  .tape{position:relative;height:120px;overflow:hidden;background:#d23c34}
  .track{position:absolute;top:30px;left:0;display:inline-block;white-space:nowrap;font-size:32px;color:#fff;will-change:transform}
  .road{position:relative;padding:120px 100px;min-height:900px;background:#1f2a6b}
  .line{position:relative;height:14px;border:3px solid #111;border-radius:10px;background:rgba(255,255,255,.12);overflow:hidden}
  .line i{display:block;height:100%;width:0;background:repeating-linear-gradient(-45deg,#a6e22e 0 12px,#7cc21a 12px 24px)}
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:26px;padding-top:40px}
  .cards div{height:180px;background:#fff}
  .tail{height:900px;background:#f3d440}
</style></head><body>
  <section class="hero" id="hero">
    <canvas id="dust"></canvas>
    <div class="disc" id="disc"></div>
    <div class="ring"></div>
    <div class="still"></div>
    <div class="card" id="card"><h3 style="margin:20px">A CARD</h3></div>
    <a class="btn" href="#road">LIFT ME</a>
    <div class="moon" id="moon"></div>
  </section>
  <div class="tape"><div class="track" id="track">ALPHA ✦ BETA ✦ GAMMA ✦ DELTA ✦ </div></div>
  <section class="road" id="road">
    <div class="line"><i id="fill"></i></div>
    <div class="cards"><div></div><div></div><div></div><div></div></div>
  </section>
  <section class="tail"><ul id="feed"><li>row 0</li><li>row 1</li><li>row 2</li></ul></section>
<script>
(function () {
  var disc = document.getElementById("disc"), a = 0, last = performance.now();
  function spin(t) { a -= (t - last) / 12000 * 360; last = t; disc.style.transform = "rotate(" + a.toFixed(3) + "deg)"; requestAnimationFrame(spin); }
  requestAnimationFrame(spin);
  var moon = document.getElementById("moon");
  (function bob(t) { moon.style.transform = "translateY(" + (Math.sin(t / 5000 * 2 * Math.PI) * 10).toFixed(2) + "px)"; requestAnimationFrame(bob); })(0);

  var card = document.getElementById("card");
  card.addEventListener("mousemove", function (e) {
    var b = card.getBoundingClientRect(), px = (e.clientX - b.left) / b.width - 0.5, py = (e.clientY - b.top) / b.height - 0.5;
    card.style.transform = "perspective(900px) rotateY(" + (px * 14) + "deg) rotateX(" + (-py * 12) + "deg) translateY(-6px)";
  });
  card.addEventListener("mouseleave", function () { card.style.transform = ""; });

  var cv = document.getElementById("dust"), ctx = cv.getContext("2d"), parts = [];
  var cols = ["#8fbf7a", "#89cebc", "#fff3a0", "#ef9043"];
  function speck(any, i) { return { x: Math.random() * cv.width, y: any ? Math.random() * cv.height : cv.height + 10, r: 2.5 + (i % 3), vy: -(0.4 + Math.random() * 0.3), c: cols[i % cols.length] }; }
  function size() { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; parts = []; for (var i = 0; i < Math.round(cv.width / 20); i++) parts.push(speck(true, i)); }
  function dust() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < parts.length; i++) { var p = parts[i]; p.y += p.vy; if (p.y < -10) parts[i] = speck(false, i); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
    requestAnimationFrame(dust);
  }
  size(); requestAnimationFrame(dust);

  var track = document.getElementById("track"); track.innerHTML = track.innerHTML + track.innerHTML + track.innerHTML + track.innerHTML;
  var x = 0, lastY = scrollY, vel = 0, road = document.getElementById("road"), fill = document.getElementById("fill");
  function frame() {
    var y = scrollY, vh = innerHeight;
    vel = vel * 0.9 + (y - lastY) * 0.1; lastY = y;
    x -= 0.6 + Math.min(Math.abs(vel) * 0.25, 14);
    var w = track.scrollWidth / 4; if (x <= -w) x += w;
    track.style.transform = "translate3d(" + x + "px,0,0)";
    var r = road.getBoundingClientRect(), p = Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (r.height + vh * 0.3)));
    fill.style.width = (p * 100) + "%";
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  var feed = document.getElementById("feed"), n = 3;
  addEventListener("scroll", function () { feed.innerHTML = "<li>row " + n++ + "</li><li>row " + n++ + "</li><li>row " + n++ + "</li>"; });
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
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1200", "--height", "800", "--assets", assets, "--settle", "3", "--behaviours"]).catch(() => {});
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* the converter failed */ }
const M = doc.behaviours?.motion ?? {};
const node = (id) => doc.nodes.find((n) => n.id === id);
const sel = (id) => node(id)?.from?.selector ?? "";
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const J = (x) => JSON.stringify(x);
const onSel = (list, re) => (list ?? []).find((m) => re.test(sel(m.part) || m.selector || ""));

check("the document holds doc.behaviours.motion", doc.behaviours?.version === 1 && M && typeof M === "object" && Array.isArray(M.spin), J(Object.keys(doc.behaviours ?? {})));

/* (1) The JS-spun disc. */
const sp = onSel(M.spin, /div:nth-of-type\(1\)$/);
check("the disc turned by a script is a spin, on its part", sp && sp.part && node(sp.part), J(M.spin));
check("…one turn in 12 s (±10 %)", near(sp?.period, 12000, 1200), J(sp?.period));
check("…anticlockwise, done by the page's script", sp?.direction === "ccw" && sp?.via === "script", J({ direction: sp?.direction, via: sp?.via }));

/* (2) The CSS-floated ring. */
const fl = onSel(M.float, /div:nth-of-type\(2\)$/);
check("the ring floated by @keyframes is a float, on its part", fl && fl.part && node(fl.part), J(M.float));
check("…up and down (axis y), 14 px out (amplitude 7 about its middle, travel 14)", fl?.axis === "y" && near(fl?.travel, 14, 1.5), J({ axis: fl?.axis, travel: fl?.travel, amplitude: fl?.amplitude }));
check("…every 4 s, ease-in-out, by the stylesheet", near(fl?.period, 4000, 200) && fl?.via === "css" && /ease-in-out/.test(fl?.easing ?? ""), J({ period: fl?.period, via: fl?.via, easing: fl?.easing }));
const fj = onSel(M.float, /section:nth-of-type\(1\) > div:nth-of-type\(5\)$/);
check("the moon a script bobs is a float, on its part, up and down, by the page's script", fj && fj.axis === "y" && fj.via === "script", J(M.float));
check("…travelling 20 px (±3) every 5 s (±15 %), read from the frames drawn", near(fj?.travel, 20, 3) && near(fj?.period, 5000, 750), J({ travel: fj?.travel, period: fj?.period }));
check("control: the still square is neither a spin nor a float", ![...(M.spin ?? []), ...(M.float ?? [])].some((m) => /div:nth-of-type\(3\)$/.test(sel(m.part) || m.selector || "")), J([...(M.spin ?? []), ...(M.float ?? [])].map((m) => sel(m.part))));

/* (3) Hover. */
const hv = (M.hover ?? []).find((h) => h.kind === "tilt");
check("the card a listener tilts is a hover tilt, on its part", hv && /div:nth-of-type\(4\)$/.test(sel(hv.part)), J(M.hover));
check("…14° across and 12° down per whole card of pointer travel (±1°)", near(hv?.across, 14, 1) && near(hv?.down, 12, 1), J({ across: hv?.across, down: hv?.down }));
check("…lifted 6 px, in a 900 px perspective, done by a script", near(hv?.lift, 6, 0.5) && hv?.perspective === 900 && hv?.via === "script", J({ lift: hv?.lift, perspective: hv?.perspective, via: hv?.via }));
const lf = (M.hover ?? []).find((h) => h.kind === "lift");
check("the button a :hover rule lifts is a hover lift of 4 px, by the stylesheet", lf && /LIFT ME/.test(J(node(lf.part))) && near(lf?.lift, 4, 0.5) && lf?.via === "css", J(lf));

/* (4) The particle canvas. */
const cv = (M.canvases ?? [])[0];
check("the canvas repainted every frame is a particle canvas", cv && cv.kind === "particles" && cv.repaints >= 0.8, J(M.canvases));
check("…its box (the hero, 1200 × 760) and the parts painted either side of it", cv && near(cv.box?.[2], 1200, 2) && near(cv.box?.[3], 760, 2) && cv.above && node(cv.above) && /div:nth-of-type\(1\)$/.test(sel(cv.above)), J({ box: cv?.box, below: cv?.below, above: cv?.above }));
check("…its specks drift up", cv?.drift === "up" && cv?.speed > 0, J({ drift: cv?.drift, speed: cv?.speed, perFrame: cv?.perFrame }));
check("…its colours (the four the page draws with)", ["#8fbf7a", "#89cebc", "#fff3a0", "#ef9043"].every((c) => (cv?.colours ?? []).includes(c)), J(cv?.colours));
check("…about one speck every 20 px of width (15–27)", cv && cv.spacing >= 15 && cv.spacing <= 27, J({ specks: cv?.specks, spacing: cv?.spacing }));

/* (5) The marquee's speed-up while scrolling. */
const ss = (M.scrollSpeed ?? [])[0];
check("the marquee that speeds up while scrolling is recorded on its part", ss && /ALPHA/.test(String(node(ss.part)?.content ?? "")), J(M.scrollSpeed));
check("…its step at rest (0.6 px a frame), its boost (0.25 per px of scroll a frame) and its cap (14)", near(ss?.base, 0.6, 0.08) && near(ss?.perScroll, 0.25, 0.04) && near(ss?.max, 14, 1.5), J({ base: ss?.base, perScroll: ss?.perScroll, max: ss?.max }));

/* (6) The line grown by the scroll. */
const gr = (M.scrollGrow ?? [])[0];
check("the line a script grows with the scroll is a scroll-grow, on its part, by width", gr && /> i$/.test(sel(gr.part)) && gr.prop === "width", J(M.scrollGrow));
check("…from nothing to its whole holder", near(gr?.from, 0, 2) && near(gr?.to, 100, 2), J({ from: gr?.from, to: gr?.to }));
check("…its part kept as drawn with its section in view (check-capture-2000 (10)), and how much of the holder that is said beside it", gr && node(gr.part)?.w > 20 && node(gr.part)?.w < 990 && near(gr.kept, node(gr.part).w / 994 * 100, 1), J({ w: node(gr?.part)?.w, kept: gr?.kept }));
/* The page's own sum, said by the line's own top: it starts with its section's top 85 % down the window (the line sits 120 px under it: 1.0 of an 800 px window) and is whole once the section's top is at 0.55 of the window less its 1140 px (the line's top at −0.725). */
check("…starting as its own top is a whole window down (1.0) and whole once it is 0.725 of a window above the top", near(gr?.start, 1.0, 0.06) && near(gr?.end, -0.725, 0.08), J({ start: gr?.start, end: gr?.end }));

/* (7) The list rebuilt while scrolled. */
check("a list the page rebuilds while it is scrolled leaves the capture whole: the page and its feed are in the document", doc.nodes.length > 10 && doc.nodes.some((n) => /row \d/.test(J(n.content ?? ""))), J(doc.nodes.length));

/* Control: the committed SOLCINERATOR captures, untouched. */
const old = join(dir, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());

for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 500)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
