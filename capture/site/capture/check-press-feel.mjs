#!/usr/bin/env node
/**
 * WHAT TRUMPMORTY.FUN DOES THAT ITS COPY DID NOT (the owner's four, 2026-09-30).
 * On a stand-in page (all STANDIN data), built the way trumpmorty.fun is:
 *
 *   (1) its nav's links to `#lore`, `#buy` glide there by its script, over
 *       `min(1600, 500 + distance × 0.25)` ms on an ease-in-out cubic, a
 *       header's height short: `behaviours.glide` says so, as one rule
 *       (`glide.mjs`);
 *   (2) its "Copy CA" bar turns its label into "COPIED!" for 1600 ms and
 *       slides a toast up from below the window for 1900 ms: the press is
 *       still its copy, and a state now shows both, each with how long it
 *       stayed (`timing[].lasts`) and the toast where it came in from
 *       (`timing[].from`); and a panel that arrives by a timer of its own
 *       is still read as it was (check-presses.mjs (5)); and a bar in a
 *       section the page reveals on scroll, which lands a pixel apart on
 *       each load, still flashes: a pixel is a place settling, not a change;
 *   (3) a nav item's hover paints a pill behind it, once as its own
 *       background and once as a `::before` that is only there under the
 *       hover: both reach the item's `motion.hover`, the second with the
 *       pseudo-element's look at rest and under the hover;
 *   (4) a LIVE dot blinks `1s steps(2)` over `50% { opacity: 0 }` and a
 *       badge pulses to `scale(1.05)`: caught at any moment of either, the
 *       part keeps its look at rest (opacity 1, no transform), since a
 *       keyframe with no 0% of its own starts from it; and a rule of many
 *       stops, each with its own timing function, comes through stop for
 *       stop with every longhand of the animation that runs it.
 *
 *   node capture/site/capture/check-press-feel.mjs
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { glideRule } from "./glide.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 700)}`}`); };
const J = (x) => JSON.stringify(x);

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>STANDIN feel</title><style>
body{margin:0;font:16px sans-serif}
header{position:fixed;top:0;left:0;right:0;height:64px;background:#fff;display:flex;gap:10px;align-items:center;padding:0 20px;z-index:5}
.nav a{padding:8px 16px;border-radius:999px;transition:background .2s,transform .2s;color:#111;text-decoration:none;position:relative}
.nav a:hover{background:#f3d440;transform:rotate(-3deg)}
.nav a.ghost::before{content:"";position:absolute;inset:0;border-radius:999px;background:#89cebc;opacity:0;transition:opacity .2s}
.nav a.ghost:hover::before{opacity:1}
section{height:1400px;padding-top:90px;border-top:1px solid #ccc}
@keyframes blink{50%{opacity:0}}
@keyframes pulse{50%{transform:scale(1.05) rotate(2deg)}}
@keyframes stops{0%{opacity:1;animation-timing-function:steps(3,jump-start)}20%{opacity:.2}35%,60%{opacity:.6;animation-timing-function:cubic-bezier(.1,.7,.3,1)}100%{opacity:1}}
.dot{display:inline-block;width:14px;height:14px;border-radius:50%;background:#ff4b3e;animation:blink 1s steps(2) infinite}
.badge{display:inline-block;padding:8px 20px;background:#d23c34;color:#fff;animation:pulse 2.4s ease-in-out infinite}
.lamp{display:inline-block;width:30px;height:30px;background:#0a0;animation:stops 3s ease-out -.4s 7 alternate-reverse both}
.ca{display:flex;border:3px solid #111;background:#fff;margin:20px}.ca span{padding:10px}.ca__label{background:#123;color:#fd4}.ca.copied .ca__btn{background:#a6d86f}
.toast{position:fixed;left:40%;bottom:28px;padding:14px 24px;background:#a6d86f;border:3px solid #111;transform:translate(0,220px);transition:transform .35s cubic-bezier(.2,.9,.25,1.2)}
.toast.show{transform:translate(0,0)}
#panel{display:none;padding:20px;background:#eef}
.reveal{opacity:0;transform:translateY(46px) scale(.96);transition:opacity .7s ease,transform .8s cubic-bezier(.2,.9,.25,1.2)}.reveal.in{opacity:1;transform:none}
</style></head><body>
<header><nav class="nav"><a href="#lore" data-scroll>Lore</a><a href="#buy" data-scroll class="ghost">How to buy</a><a href="#chart" data-scroll>Chart</a><a href="#roadmap" data-scroll>Roadmap</a></nav></header>
<section id="top"><p><i class="dot"></i> LIVE FROM STANDIN</p><p><span class="badge">$STANDIN</span> <span class="lamp"></span></p>
<button class="ca" type="button" data-copy><span class="ca__label">CA</span><span class="ca__value">STANDIN0MINT0ADDRESS0000000001</span><span class="ca__btn">COPY</span></button>
<button type="button" id="res">Resources</button><div id="panel">STANDIN resources panel</div></section>
<section id="lore"><h2>STANDIN lore</h2></section><section id="buy"><h2>STANDIN buy</h2><div class="reveal"><p>STANDIN step one</p></div><div class="reveal"><button class="ca" type="button" data-copy><span class="ca__label">CA</span><span class="ca__value">STANDIN0MINT0ADDRESS0000000001</span><span class="ca__btn">COPY</span></button></div></section><section id="chart"><h2>STANDIN chart</h2></section><section id="roadmap"><h2>STANDIN roadmap</h2></section>
<div class="toast" id="toast"></div>
<script>
var toastEl = document.getElementById("toast"), toastT;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 1900); }
document.querySelectorAll("[data-copy]").forEach(function (btn) { btn.addEventListener("click", function () {
  navigator.clipboard.writeText("STANDIN0MINT0ADDRESS0000000001").catch(function () {}).then(function () {
    toast("CA copied!"); btn.classList.add("copied");
    var lbl = btn.querySelector("span"), old = lbl.textContent; lbl.textContent = "COPIED!";
    setTimeout(function () { btn.classList.remove("copied"); lbl.textContent = old; }, 1600);
  });
}); });
/* As trumpmorty's reveal and scroll-driven layers settle a hair apart on each load, the revealed section lands up to 1.5 px differently every time. */
document.getElementById("buy").style.paddingTop = (90 + Math.random() * 1.5).toFixed(2) + "px";
var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (!e.isIntersecting) return; var i = Array.prototype.indexOf.call(e.target.parentNode.children, e.target); e.target.style.transitionDelay = Math.min(i, 5) * 90 + "ms"; e.target.classList.add("in"); io.unobserve(e.target); setTimeout(function () { e.target.style.transitionDelay = ""; }, 1400); }); }, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
document.getElementById("res").onclick = function () { setTimeout(function () { document.getElementById("panel").style.display = "block"; }, 900); };
function maxScroll() { return document.documentElement.scrollHeight - innerHeight; }
function scrollToEl(el) {
  var y = el.getBoundingClientRect().top + scrollY - document.querySelector("header").offsetHeight + 2;
  y = Math.max(0, Math.min(maxScroll(), y));
  var from = scrollY, dist = y - from, dur = Math.min(1600, 500 + Math.abs(dist) * 0.25), t0 = performance.now();
  (function anim(now) { var p = Math.min(1, (now - t0) / dur), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; scrollTo(0, from + dist * e); if (p < 1) requestAnimationFrame(anim); })(t0);
}
document.querySelectorAll("[data-scroll]").forEach(function (a) { a.addEventListener("click", function (e) { var el = document.querySelector(a.getAttribute("href")); if (!el) return; e.preventDefault(); scrollToEl(el); }); });
</script></body></html>`;

const server = createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const work = process.env.KEEP ?? mkdtempSync(join(tmpdir(), "capture-feel-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const run = (args) => new Promise((resolve) => {
  const p = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
const cap = await run([join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1200", "--height", "800", "--assets", join(work, "source"), "--settle", "1", "--frames", "0", "--hide-gate", "--states", "--behaviours"]);
if (process.env.DEBUG) console.log(cap.err);
check("the stand-in page was captured", cap.status === 0 && existsSync(capFile), cap.err.trim().split("\n").slice(-6).join(" | "));
writeFileSync(join(work, "routes.json"), J({ site: origin, viewport: [1200, 800], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = await run([join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", join(work, "source")]);
check("the capture converts", conv.status === 0, conv.err.trim().split("\n").pop());
server.close();
const raw = existsSync(capFile) ? JSON.parse(readFileSync(capFile, "utf8")) : { tree: {} };
const doc = existsSync(join(work, "out", "site", "document.json")) ? JSON.parse(readFileSync(join(work, "out", "site", "document.json"), "utf8")) : { nodes: [] };
const words = (n) => (typeof n?.content === "string" ? n.content : Array.isArray(n?.content) ? n.content.map((x) => x.text ?? "").join("") : "").trim();
const part = (w) => doc.nodes.find((n) => words(n) === w && !n.state);
const byId = (id) => doc.nodes.find((n) => n.id === id);

/* (1) The glide. */
const g = doc.behaviours?.glide;
check("(1) the nav's links glide by the page's script", g?.how === "script", J(g));
check("(1) …over 500 ms and a quarter of a ms a px, as the script says", g && Math.abs(g.ms.base - 500) <= 40 && Math.abs(g.ms.perPx - 0.25) <= 0.02, J(g?.ms));
check("(1) …on the script's own ease-in-out cubic", g?.ease === "ease-in-out-cubic", J({ ease: g?.ease, curve: g?.curve }));
check("(1) …stopping a header's height short of the place (64 − 2 px)", g && Math.abs(g.offset - -62) <= 2, J(g?.offset));
check("(1) the rule reads a cap where the farthest presses fall under the line", (() => { const r = glideRule({ css: "auto", links: [1000, 2000, 3000, 6000, 8000].map((d, i) => ({ id: `p${i}`, top: d + 62, from: 0, to: d, ms: Math.round(Math.min(1600, 500 + d * 0.25)), frames: Array.from({ length: 101 }, (_, k) => [Math.round((k / 100) * Math.min(1600, 500 + d * 0.25)), Math.round((d * k) / 100)]) })) }); return Math.abs(r?.ms.max - 1600) <= 4 && Math.abs(r.ms.base - 500) < 5 && r.ease === "linear"; })());
check("(1) a jump is a jump", glideRule({ css: "auto", links: [{ id: "a", top: 900, from: 0, to: 900, ms: 0 }] })?.how === "jump");

/* (2) What the copy flashed. */
const copies = doc.behaviours?.presses ?? [];
const bar = doc.nodes.find((n) => n.state == null && copies.some((c) => c.part === n.id));
check("(2) the bar is still its copy", copies.some((c) => c.copy === "STANDIN0MINT0ADDRESS0000000001"), J(copies));
const flash = (doc.behaviours?.states ?? []).find((st) => st.part === bar?.id);
const shown = (flash?.shows ?? []).map(byId);
check("(2) the press is a state that shows COPIED! and the toast", shown.some((n) => /COPIED!/.test(words(n))) && shown.some((n) => /CA copied!/.test(words(n))), J(shown.map(words)));
const t = (w) => flash?.timing?.find((x) => words(byId(x.part)).includes(w));
check("(2) …COPIED! for 1600 ms", t("COPIED!")?.lasts === 1600, J(flash?.timing));
check("(2) …the toast for 1900 ms, in from 220 px below", t("CA copied!")?.lasts === 1900 && t("CA copied!")?.from?.y === 220, J(flash?.timing));
check("(2) …and the CA label it stood in for comes back as it goes", (flash?.hides ?? []).some((id) => words(byId(id)) === "CA" || words(byId(id)).includes("CA")) && (flash?.timing ?? []).some((x) => (flash.hides ?? []).includes(x.part) && x.lasts === 1600), J({ hides: (flash?.hides ?? []).map((id) => words(byId(id))), timing: flash?.timing }));
{
  /* The same bar inside a section the page reveals as it scrolls in: the press's COPIED! is the press's, not the reveal's settling. */
  const inBuy = doc.nodes.filter((n) => n.state == null && copies.some((c) => c.part === n.id) && n.id !== bar?.id);
  const st = (doc.behaviours?.states ?? []).find((s) => inBuy.some((n) => n.id === s.part));
  check("(2) a bar in a section revealed on scroll still flashes COPIED! for 1600 ms", (st?.shows ?? []).map(byId).some((n) => /COPIED!/.test(words(n))) && st?.timing?.some((x) => /COPIED!/.test(words(byId(x.part))) && x.lasts === 1600), J({ bars: inBuy.map((n) => n.id), state: st && { shows: st.shows.map((id) => words(byId(id))), timing: st.timing } }));
}
check("(2) a panel its own timer brings is still read (not held as a flash)", (doc.behaviours?.states ?? []).some((st) => st.part === part("Resources")?.id && st.shows.some((id) => words(byId(id)) === "STANDIN resources panel") && !st.timing), J((doc.behaviours?.states ?? []).map((s) => [s.name, s.shows.length, s.timing])));

/* (3) The hover pill. */
const lore = part("Lore"), buy = part("How to buy");
check("(3) a hover that fills the item's own background reaches it", lore?.motion?.hover?.some((h) => h.self && /#f3d440|243, 212, 64/.test(h.style?.background ?? h.style?.["background-color"] ?? "")), J(lore?.motion));
const ghost = buy?.motion?.hover?.find((h) => h.pseudo === "::before");
check("(3) a hover that brings a ::before pill reaches the item, with the pill's look", ghost && ghost.style?.opacity === "1" && ghost.base?.opacity === "0" && /137, 206, 188/.test(ghost.base?.["background-color"] ?? "") && ghost.base?.position === "absolute", J(buy?.motion));

/* (4) Every stop, at rest. */
const els = []; (function go(e) { if (!e) return; els.push(e); (e.kids ?? []).forEach(go); })(raw.tree);
const dot = els.find((e) => e.bg === "rgb(255, 75, 62)");
check("(4) the blinking dot is read at rest, whatever moment it was caught at (opacity 1)", dot && (dot.op === undefined || dot.op === 1), J(dot && { op: dot.op, motion: dot.motion }));
const badge = els.find((e) => e.bg === "rgb(210, 60, 52)");
check("(4) the pulsing badge is read at rest (no transform)", badge && !badge.tf, J(badge && { tf: badge.tf }));
const kf = (doc.keyframes ?? []).find((k) => k.name === "stops");
check("(4) a rule of many stops comes through stop for stop", J(kf?.frames?.map((f) => f.key)) === J(["0%", "20%", "35%, 60%", "100%"]), J(kf));
check("(4) …each stop's own timing function with it, steps() included", kf?.frames?.[0]?.style?.["animation-timing-function"] === "steps(3, jump-start)" && /cubic-bezier\(0\.1, 0\.7, 0\.3, 1\)/.test(kf?.frames?.[2]?.style?.["animation-timing-function"] ?? ""), J(kf?.frames));
const lamp = doc.nodes.find((n) => n.motion?.animation?.some((a) => a.name === "stops"));
check("(4) …and every longhand of the animation that runs it", J(lamp?.motion?.animation?.[0]) === J({ name: "stops", duration: "3s", timing: "ease-out", delay: "-0.4s", iterations: "7", direction: "alternate-reverse", fill: "both" }), J(lamp?.motion));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
