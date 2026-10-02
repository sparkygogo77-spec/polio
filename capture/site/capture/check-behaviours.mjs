/**
 * What a page's SCRIPTS do to it comes through the capture, as data, so
 * polio can attach a working feature in its place (docs/behaviours.md).
 *
 * `check-motion.mjs` holds what the page's stylesheets say: keyframes,
 * animations, transitions, hover. This holds what only its script does,
 * which no stylesheet names, the way trumpmorty.fun's `main.js` does it:
 *
 *   (1) a loader: a fixed element over the whole window, a channel, a title
 *       and a "TUNING n%" that counts up, switched off with a class and
 *       removed once the page has loaded, `is-loading` taken off the body;
 *   (2) an intro: `element.animate()` on the hero's words as the loader goes;
 *   (3) reveal on scroll: `.reveal` sections an IntersectionObserver gives
 *       `.in` as each scrolls in, with a stagger set as `transition-delay`;
 *   (4) a header that takes `.scrolled` once the page is scrolled past 40px,
 *       and loses it back at the top;
 *   (5) pointer parallax: layers with `data-depth` moved by `translate3d`
 *       from `requestAnimationFrame`, by the pointer's place in the window
 *       and by the scroll; a card turned toward the pointer over it;
 *   (6) two marquee tracks moved by `requestAnimationFrame`, one left, one
 *       right (`data-reverse`), their words written four times;
 *   (7) a blinking dot and a scanline sheet (CSS, idle loops).
 *
 * Captured with `--behaviours` and converted: the capture and the document
 * must hold each, in the additive `behaviours` section naming parts by id,
 * with the values measured (speeds, factors, thresholds, rest states), and
 * the committed SOLCINERATOR captures must still convert to the committed
 * document byte for byte.
 *
 *   node capture/site/capture/check-behaviours.mjs
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
const dir = mkdtempSync(join(tmpdir(), "check-behaviours-"));

const PAGE = `<!doctype html><html><head><style>
  body{margin:0;font-family:sans-serif;background:#f3d440}
  #loader{position:fixed;inset:0;z-index:2000;background:#000;color:#b8ff6a;display:grid;place-items:center}
  #loader.is-off{opacity:0;transition:opacity .3s}
  .osd{position:absolute;top:20px;left:20px;font-size:30px}
  .title-l{font-size:60px;color:#fff}
  .site-header{position:fixed;top:0;left:0;right:0;height:60px;z-index:50;display:flex;align-items:center;padding:14px 20px;transition:background .3s,box-shadow .3s,padding .3s}
  .site-header.scrolled{background:#f3d440;box-shadow:0 4px 0 #1a0f0b;padding-top:8px;padding-bottom:8px}
  .hero{position:relative;height:800px;overflow:hidden}
  .layer{position:absolute;will-change:transform}
  .sky{inset:-40px;background:#6ac}
  .far{left:-40px;right:-40px;bottom:120px;height:200px;background:#c96}
  .near{left:-40px;right:-40px;bottom:-10px;height:160px;background:#a74}
  .copy{position:absolute;left:100px;top:200px;z-index:3}
  .copy h1{font-size:70px;margin:0}
  .dot{display:inline-block;width:12px;height:12px;border-radius:50%;background:#ff4b3e;animation:blink 1s steps(2) infinite}
  @keyframes blink{50%{opacity:0}}
  .tv{position:absolute;right:100px;top:200px;width:300px;height:300px;background:#222;transition:transform .15s linear;z-index:3}
  .scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0 2px,transparent 2px 4px);animation:scanroll 8s linear infinite}
  @keyframes scanroll{to{background-position:0 400px}}
  .tape{position:relative;height:150px;overflow:hidden}
  .row{position:absolute;left:-5%;right:-5%;overflow:hidden;white-space:nowrap}
  .row-a{top:20px;background:#d23c34;transform:rotate(-2.5deg);z-index:2}
  .row-b{top:62px;background:#1f2a6b;transform:rotate(2deg)}
  .track{display:inline-block;font-size:32px;padding:10px 0;color:#fff;will-change:transform}
  section.more{padding:80px 100px;min-height:600px}
  .reveal{opacity:0;transform:translateY(46px) scale(.96);transition:opacity .7s ease,transform .8s cubic-bezier(.2,.9,.25,1.2)}
  .reveal.in{opacity:1;transform:none}
  .card{width:300px;height:160px;background:#fff;margin:20px 0}
</style></head><body class="is-loading">
  <div id="loader"><div class="osd">CH 47</div><div class="title-l">STAND &amp; IN</div><div class="osd" style="top:auto;bottom:20px">TUNING <span id="pct">0</span>%</div></div>
  <header class="site-header" id="hdr"><span>STANDIN</span></header>
  <section class="hero" id="hero">
    <div class="layer sky" data-depth="0.05"></div>
    <div class="layer far" data-depth="0.15"></div>
    <div class="layer near" data-depth="0.3"></div>
    <div class="copy"><div class="onair"><i class="dot"></i> LIVE</div><h1>STAND IN</h1></div>
    <div class="tv" id="tv"><div class="scan"></div></div>
  </section>
  <div class="tape">
    <div class="row row-a"><div class="track" data-marquee>ALPHA ✦ BETA ✦ GAMMA ✦ </div></div>
    <div class="row row-b"><div class="track" data-marquee data-reverse>ONE ● TWO ● THREE ● </div></div>
  </div>
  <section class="more">
    <h2 class="reveal">FIRST</h2>
    <p class="reveal">One sentence that comes in.</p>
    <div class="card reveal">A card</div>
    <div class="card reveal">Another card</div>
  </section>
  <section class="more"><h2 class="reveal">SECOND</h2><p class="reveal">The last words.</p></section>
<script>
(function () {
  var $ = function (s) { return document.querySelector(s); }, $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var loader = $("#loader"), pct = $("#pct"), shown = 0, t0 = performance.now();
  (function tick() {
    shown = Math.min(100, (performance.now() - t0) / 12);
    pct.textContent = Math.round(shown);
    if (shown >= 100) { setTimeout(close, 200); return; }
    requestAnimationFrame(tick);
  })();
  function close() {
    loader.classList.add("is-off"); document.body.classList.remove("is-loading");
    setTimeout(function () { loader.remove(); }, 400);
    $$(".copy > *").forEach(function (el, i) {
      el.animate([{ opacity: 0, transform: "translateY(40px) scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 800, delay: 150 + i * 110, easing: "cubic-bezier(.2,.9,.25,1.2)", fill: "backwards" });
    });
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (!en.isIntersecting) return;
      var sib = Array.prototype.indexOf.call(en.target.parentNode.children, en.target);
      en.target.style.transitionDelay = Math.min(sib, 5) * 90 + "ms";
      en.target.classList.add("in"); io.unobserve(en.target);
      setTimeout(function () { en.target.style.transitionDelay = ""; }, 1400);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach(function (el) { io.observe(el); });
  var tracks = $$("[data-marquee]").map(function (t) { t.innerHTML = t.innerHTML + t.innerHTML + t.innerHTML + t.innerHTML; return { el: t, x: 0, dir: t.hasAttribute("data-reverse") ? 1 : -1 }; });
  var layers = $$(".hero [data-depth]"), hero = $("#hero"), hdr = $("#hdr"), mx = 0, my = 0, cmx = 0, cmy = 0;
  addEventListener("mousemove", function (e) { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
  function frame() {
    var y = scrollY;
    hdr.classList.toggle("scrolled", y > 40);
    cmx += (mx - cmx) * 0.06; cmy += (my - cmy) * 0.06;
    if (y < hero.offsetHeight + 100) layers.forEach(function (l) {
      var d = parseFloat(l.getAttribute("data-depth"));
      l.style.transform = "translate3d(" + (-cmx * d * 90) + "px," + (y * d * 0.9 - cmy * d * 50) + "px,0)";
    });
    tracks.forEach(function (t) {
      t.x += t.dir * 0.6;
      var w = t.el.scrollWidth / 4; if (t.x <= -w) t.x += w; if (t.x > 0) t.x -= w;
      t.el.style.transform = "translate3d(" + t.x + "px,0,0)";
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  var tv = $("#tv");
  tv.addEventListener("mousemove", function (e) { var b = tv.getBoundingClientRect(); var px = (e.clientX - b.left) / b.width - 0.5, py = (e.clientY - b.top) / b.height - 0.5; tv.style.transform = "rotateY(" + (px * 22) + "deg) rotateX(" + (-py * 18) + "deg) translateZ(20px)"; });
  tv.addEventListener("mouseleave", function () { tv.style.transform = ""; });
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
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1200", "--height", "800", "--assets", assets, "--settle", "4", "--behaviours"]).catch(() => {});
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
let cap = {};
try { cap = JSON.parse(readFileSync(capture, "utf8")); } catch { /* the capture failed; every check below is red */ }
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* the converter failed */ }
const B = doc.behaviours ?? {};
const node = (id) => doc.nodes.find((n) => n.id === id);
const sel = (id) => node(id)?.from?.selector ?? "";
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const J = (x) => JSON.stringify(x);

check("the capture holds a behaviours section", cap.behaviours && cap.behaviours.version === 1, J(Object.keys(cap.behaviours ?? {})));
check("the document holds it as doc.behaviours, version 1", B.version === 1, J(Object.keys(B)));

/* (1) The loader. */
const L = B.loader;
check("the loader is recorded: a fixed element over the whole window, with its words", L && L.covers === true && /CH 47/.test(J(L.words)) && /STAND & IN/.test(J(L.words)), J(L));
check("…its count seen rising (TUNING n% at several values, the last 100)", L && (L.counts ?? []).length >= 3 && L.counts.at(-1) === 100 && L.counts[0] < 50, J(L?.counts));
check("…the label before the count (TUNING), and the channel (CH 47)", L?.label === "TUNING" && L?.channel === "CH 47", J({ label: L?.label, channel: L?.channel }));
check("…how long it stood (ms), the class that switched it off, and that it was then removed", L && L.lastedMs > 800 && L.lastedMs < 6000 && L.off?.class === "is-off" && L.removed === true, J({ lastedMs: L?.lastedMs, off: L?.off, removed: L?.removed }));
check("…the body class it held while loading", (L?.bodyClass ?? []).includes("is-loading"), J(L?.bodyClass));

/* (2) The intro. */
const intro = B.intro ?? [];
const h1 = doc.nodes.find((n) => n.content === "STAND IN" || n.label === "STAND IN");
check("the intro's element.animate() calls are recorded on their parts, keyframes and timing", intro.length >= 2 && intro.some((a) => a.part === h1?.id && a.duration === 800 && a.delay === 260 && /translateY\(40px\)/.test(J(a.keyframes)) && a.easing === "cubic-bezier(.2,.9,.25,1.2)"), J(intro));

/* (3) Reveal on scroll. */
const rev = B.reveal ?? [];
const first = doc.nodes.find((n) => n.content === "FIRST");
const r1 = rev.find((r) => r.part === first?.id);
check("six reveals, each on its part, by the class the script added (in)", rev.length === 6 && rev.every((r) => r.part && node(r.part) && r.class === "in"), J(rev.map((r) => [r.part, r.class])));
check("…the rest state before it came in (opacity 0, moved 46px down, scale .96) and the state shown", r1 && r1.rest?.opacity === 0 && /0\.96/.test(r1.rest?.transform) && /46/.test(r1.rest?.transform) && r1.shown?.opacity === 1 && r1.shown?.transform === "none", J(r1));
check("…its transition as computed", r1 && /opacity 0\.7s/.test(r1.transition ?? "") && /transform 0\.8s/.test(r1.transition ?? ""), J(r1?.transition));
check("…the stagger the script set (0, 90, 180 … ms by place among its siblings)", rev.map((r) => r.delayMs).join(",") === "0,90,180,270,0,90", J(rev.map((r) => r.delayMs)));
check("…where it came in: the scroll and how far into the window its top was", r1 && Number.isFinite(r1.atScroll) && Number.isFinite(r1.enterAt) && r1.enterAt > 0 && r1.enterAt <= 1, J({ atScroll: r1?.atScroll, enterAt: r1?.enterAt }));

/* (4) The header. */
const sc = (B.scrollClass ?? [])[0];
check("the header's scrolled class is recorded on its part, with the scroll it turns on at (40 < at <= 50)", sc && sc.class === "scrolled" && sc.part && /header/.test(sel(sc.part)) && sc.at > 40 && sc.at <= 50, J(sc));
check("…and that it turns off again at the top", sc?.toggles === true, J(sc));
check("…the styles before and after (the yellow, the 4px ink edge, the padding)", sc && sc.after?.background === "rgb(243, 212, 64)" && /4px 0px 0px/.test(sc.after?.boxShadow ?? "") && sc.after?.paddingTop === "8px" && sc.before?.paddingTop === "14px" && sc.before?.background === "rgba(0, 0, 0, 0)", J({ before: sc?.before, after: sc?.after }));
check("…and its transition", sc && /background 0\.3s/.test(sc.transition ?? ""), J(sc?.transition));

/* (5) Pointer parallax and the turned card. */
const par = (B.pointer ?? []).filter((p) => p.kind === "move");
const depthOf = (p) => ({ "rgb(102, 170, 204)": 0.05, "rgb(204, 153, 102)": 0.15, "rgb(170, 119, 68)": 0.3 })[node(p.part)?.colour?.bg];
check("three layers move with the pointer, each on its part", par.length === 3 && par.every((p) => depthOf(p) !== undefined), J(par.map((p) => [p.part, node(p.part)?.colour?.bg])));
check("…each at two pointer places, with the transform the script set there", par.length === 3 && par.every((p) => p.at?.length === 2 && p.at.every((a) => Array.isArray(a.pointer) && /translate3d/.test(a.transform))), J(par.map((p) => p.at)));
check("…the factor per layer, in px per whole window of pointer (x = -90 × depth, y = -50 × depth)", par.length === 3 && par.every((p) => near(p.perX, -90 * depthOf(p), 1.5) && near(p.perY, -50 * depthOf(p), 1.5)), J(par.map((p) => ({ d: depthOf(p), perX: p.perX, perY: p.perY }))));
check("…and per px of scroll (0.9 × depth)", par.length === 3 && par.every((p) => near(p.perScroll, 0.9 * depthOf(p), 0.03)), J(par.map((p) => ({ d: depthOf(p), perScroll: p.perScroll }))));
const turn = (B.pointer ?? []).find((p) => p.kind === "turn");
check("the TV turned toward the pointer over it is recorded as a turn, on its part", turn && node(turn.part)?.colour?.bg === "rgb(34, 34, 34)" && /rotateY/.test(J(turn.at)), J(turn));

/* (6) The marquees. */
const loops = (B.loops ?? []).filter((l) => l.kind === "marquee");
const words = (l) => String(node(l.part)?.content ?? "");
const a = loops.find((l) => /ALPHA/.test(words(l))), b = loops.find((l) => /ONE/.test(words(l)));
check("two marquee tracks, each on its part", loops.length === 2 && a && b, J(loops));
check("…the first runs left, the second right", a?.direction === "left" && b?.direction === "right", J([a?.direction, b?.direction]));
check("…at the speed measured (0.6 px a frame, about 36 px a second)", near(a?.speed, 36, 8) && near(b?.speed, 36, 8), J([a?.speed, b?.speed]));
check("…and the step per frame the script takes (0.6 px), with the frame rate it was measured at", near(a?.perFrame, 0.6, 0.05) && near(b?.perFrame, 0.6, 0.05) && a?.fps > 0, J([a?.perFrame, a?.fps, b?.perFrame, b?.fps]));
check("…with the words written four times: one loop is a quarter of the track", a?.copies === 4 && b?.copies === 4, J([a?.copies, b?.copies]));

/* (7) Idle loops. */
const idle = B.idle ?? [];
check("the idle loops are listed: the blink on the dot's part and the scanline sheet's", idle.some((i) => i.name === "blink" && i.part && node(i.part)?.colour?.bg === "rgb(255, 75, 62)") && idle.some((i) => i.name === "scanroll"), J(idle));

/* Nothing is left marked on the page's own words, and polio's fields are untouched. */
check("control: no data-sink-bh reaches a part's words or prompt", !/data-sink-bh/.test(J(doc.nodes)), "");

/* Control: the committed SOLCINERATOR captures, untouched. */
const old = join(dir, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());
const git = spawnSync("git", ["status", "--porcelain", "--", "site/document.json", "assets"], { cwd: root, encoding: "utf8" });
check("control: the root site/document.json and assets/ are untouched", git.status === 0 && git.stdout.trim() === "", git.stdout.trim());

for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 500)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
