/**
 * The behaviour features: working parts that move, copy and show.
 *
 * Same shape as the price features in `works.ts` — a manifest and a few
 * lines of plain browser JavaScript calling `siteFeatures.define` — and the
 * same rule: no look of their own. Each works on whatever part it is
 * attached to, in the published site, through the part's own element:
 *
 *   · Reveal on scroll — fades / slides the part in as it comes into view;
 *   · Copy with toast — a click (or Enter) copies the part's words, or the
 *     text it was given, and says so in one small toast;
 *   · Tilt — the part leans toward the mouse, or drifts as the page scrolls;
 *   · Follow the pointer — the part (an eye's pupil) moves or turns toward
 *     the cursor, never further than its travel;
 *   · Marquee loop — the part's contents run round, a hidden copy behind;
 *   · Embed — another page in a sandboxed frame at the part's size;
 *   · CRT loader and Dust — the owner's own two, from trumpmorty.fun: the
 *     tuning screen that switches off like an old set, and specks drifting
 *     up through the part.
 *
 * Motion lives in the individual `translate` / `rotate` properties where it
 * can, so a part's own `transform` is left as designed. Everything that
 * moves holds still when the visitor asked for less motion.
 *
 * Pure: no imports, so the tests run it as written.
 */
import type { Work } from "./works.ts";

/** Every script starts by asking this. */
const CALM = `window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches`;

const REVEAL: Work = {
  manifest: {
    id: "reveal",
    name: "Reveal on scroll",
    category: "motion",
    blurb: "The part fades and slides in as it comes into view.",
    inputs: [
      { id: "direction", label: "Moves", kind: "one", default: "up", values: ["up", "down", "left", "right", "none"], heard: "\\b(?:from|slide|slides|moves?)\\s+(?:the\\s+)?(up|down|left|right)\\b" },
      { id: "distance", label: "Distance (px)", kind: "number", default: "32", heard: "(\\d+)\\s*px\\b" },
      { id: "delay", label: "Delay (ms)", kind: "number", default: "0", heard: "(\\d+)\\s*ms\\b" },
      { id: "once", label: "Only the first time", kind: "one", default: "yes", values: ["yes", "no"] },
    ],
    needs: "none",
    says: ["reveal on scroll", "reveal", "scroll reveal", "fade in on scroll", "slide in on scroll", "animate on scroll", "appear on scroll"],
    look: { sample: "↑ fade in", caption: "reveal · on scroll" },
    version: 1,
  },
  script: `siteFeatures.define("reveal", function (el, inputs) {
  if (${CALM}) return;
  if (!("IntersectionObserver" in window)) return;
  var d = Math.max(0, Number(inputs.distance)); if (!isFinite(d)) d = 32;
  var dir = inputs.direction || "up";
  var from = dir === "up" ? "0 " + d + "px" : dir === "down" ? "0 " + -d + "px" : dir === "left" ? d + "px 0" : dir === "right" ? -d + "px 0" : "0 0";
  var delay = Math.max(0, Number(inputs.delay) || 0), once = inputs.once !== "no", s = el.style;
  var was = { opacity: s.opacity, translate: s.translate, transition: s.transition };
  function hide() { s.transition = "none"; s.opacity = "0"; s.translate = from; }
  function show() {
    s.transition = "opacity 0.6s ease " + delay + "ms, translate 0.7s cubic-bezier(.2,.8,.2,1) " + delay + "ms";
    s.opacity = was.opacity; s.translate = was.translate;
  }
  hide();
  var io = new IntersectionObserver(function (seen) {
    for (var i = 0; i < seen.length; i++) {
      if (seen[i].isIntersecting) { show(); if (once) io.disconnect(); }
      else if (!once) hide();
    }
  }, { threshold: 0.1 });
  io.observe(el);
});
`,
};

const COPY: Work = {
  manifest: {
    id: "copy-toast",
    name: "Copy with toast",
    category: "interact",
    blurb: "A click copies the part's words, or the text it was given, and a small toast says so. For contract addresses.",
    inputs: [
      { id: "text", label: "Copies", kind: "text", default: "", placeholder: "the part's own words" },
      { id: "toast", label: "Toast says", kind: "text", default: "Copied" },
    ],
    needs: "none",
    says: ["copy with toast", "click to copy", "copy to clipboard", "copy address", "copy contract address", "copy ca", "copy button", "copyable"],
    look: { sample: "7xKX…gAsU ⧉", caption: "copy · toast" },
    version: 1,
  },
  script: `siteFeatures.define("copy-toast", function (el, inputs) {
  var given = String(inputs.text || "").trim();
  var say = String(inputs.toast || "").trim() || "Copied";
  var calm = ${CALM};
  function words() { return given || String(el.textContent || "").replace(/\\s+/g, " ").trim(); }
  function fallback(t) {
    var a = document.createElement("textarea");
    a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(a); a.select();
    var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    a.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error("no copy"));
  }
  function toast(text) {
    var t = document.querySelector("[data-feature-toast]");
    if (!t) {
      t = document.createElement("div");
      t.setAttribute("data-feature-toast", ""); t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite");
      t.style.cssText = "position:fixed;left:50%;bottom:24px;translate:-50% 0;z-index:2147483000;pointer-events:none;" +
        "padding:8px 14px;border-radius:999px;background:rgba(18,18,20,.92);color:#fff;font:inherit;font-size:14px;line-height:1.3;" +
        "box-shadow:0 6px 24px rgba(0,0,0,.25);opacity:0;transition:" + (calm ? "none" : "opacity .18s ease");
      document.body.appendChild(t);
    }
    t.textContent = text;
    requestAnimationFrame(function () { t.style.opacity = "1"; });
    clearTimeout(Number(t.getAttribute("data-until")));
    t.setAttribute("data-until", String(setTimeout(function () {
      t.style.opacity = "0";
      setTimeout(function () { if (t.style.opacity === "0") t.remove(); }, calm ? 0 : 220);
    }, 1800)));
  }
  function copy(e) {
    if (e) e.preventDefault();
    var t = words();
    if (!t) return;
    var p;
    try { p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : fallback(t); } catch (x) { p = fallback(t); }
    p.then(null, function () { return fallback(t); }).then(function () { toast(say); }, function () { toast("Could not copy"); });
  }
  if (!/^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
  if (!el.getAttribute("role") && el.tagName !== "BUTTON") el.setAttribute("role", "button");
  if (!el.getAttribute("title")) el.setAttribute("title", "Copy");
  el.style.cursor = "copy";
  el.addEventListener("click", copy);
  el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") copy(e); });
});
`,
};

const TILT: Work = {
  manifest: {
    id: "tilt",
    name: "Tilt",
    category: "motion",
    blurb: "The part leans toward the mouse over it, or drifts as the page scrolls (parallax).",
    inputs: [
      { id: "mode", label: "Moves with", kind: "one", default: "mouse", values: ["mouse", "scroll"], heard: "\\b(mouse|scroll)\\b" },
      { id: "strength", label: "Strength (degrees, or px on scroll)", kind: "number", default: "10" },
      { id: "axis", label: "Axis", kind: "one", default: "both", values: ["both", "x", "y"] },
    ],
    needs: "none",
    says: ["tilt", "tilt toward the mouse", "tilt on hover", "3d tilt", "parallax", "parallax scroll", "move with scroll"],
    look: { sample: "◇ tilt", caption: "tilt · mouse or scroll" },
    version: 1,
  },
  script: `siteFeatures.define("tilt", function (el, inputs) {
  if (${CALM}) return;
  var scroll = inputs.mode === "scroll", axis = inputs.axis === "x" || inputs.axis === "y" ? inputs.axis : "both";
  var k = Number(inputs.strength); if (!isFinite(k) || inputs.strength === "") k = 10;
  var s = el.style;
  if (!scroll) {
    var base = s.transform, box = null;
    if (!s.transition) s.transition = "transform .25s ease-out";
    el.addEventListener("pointerenter", function () { box = el.getBoundingClientRect(); });
    el.addEventListener("pointermove", function (e) {
      var r = box || (box = el.getBoundingClientRect());
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      var ry = axis === "y" ? 0 : x * 2 * k, rx = axis === "x" ? 0 : -y * 2 * k;
      s.transform = "perspective(800px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)" + (base ? " " + base : "");
    });
    el.addEventListener("pointerleave", function () { box = null; s.transform = base; });
    return;
  }
  var at = 0, queued = false;
  function place() {
    queued = false;
    var r = el.getBoundingClientRect(), vh = window.innerHeight || 1;
    var off = (r.top + r.height / 2 - (axis === "x" ? 0 : at) - vh / 2) / vh;
    at = -off * k;
    s.translate = axis === "x" ? at.toFixed(2) + "px 0" : "0 " + at.toFixed(2) + "px";
  }
  function soon() { if (!queued) { queued = true; requestAnimationFrame(place); } }
  window.addEventListener("scroll", soon, { passive: true });
  window.addEventListener("resize", soon);
  place();
});
`,
};

const FOLLOW: Work = {
  manifest: {
    id: "follow-pointer",
    name: "Follow the pointer",
    category: "interact",
    blurb: "The part moves, or turns, toward the cursor, never further than its travel: an eye's pupil that watches.",
    inputs: [
      { id: "travel", label: "Max travel (px)", kind: "number", default: "12", heard: "(\\d+)\\s*px\\b" },
      { id: "how", label: "How", kind: "one", default: "move", values: ["move", "turn"], heard: "\\b(turn|rotate)s?\\b" },
    ],
    needs: "none",
    says: ["follow the pointer", "follow the mouse", "follow the cursor", "follows cursor", "eye follows cursor", "look at the cursor", "watch the mouse", "pupil"],
    look: { sample: "◉ →", caption: "follows the pointer" },
    version: 1,
  },
  script: `siteFeatures.define("follow-pointer", function (el, inputs) {
  if (${CALM}) return;
  var travel = Math.max(0, Number(inputs.travel)); if (!isFinite(travel) || inputs.travel === "") travel = 12;
  var turn = /turn|rotate/.test(inputs.how || ""), s = el.style, cx = 0, cy = 0;
  if (!s.transition) s.transition = turn ? "rotate .15s ease-out" : "translate .12s ease-out";
  function to(x, y) {
    var r = el.getBoundingClientRect();
    var ox = r.left + r.width / 2 - cx, oy = r.top + r.height / 2 - cy;
    var dx = x - ox, dy = y - oy, d = Math.sqrt(dx * dx + dy * dy);
    if (turn) { s.rotate = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1) + "deg"; return; }
    var m = d ? travel * Math.min(1, d / 160) / d : 0;
    cx = dx * m; cy = dy * m;
    s.translate = cx.toFixed(2) + "px " + cy.toFixed(2) + "px";
  }
  window.addEventListener("pointermove", function (e) { to(e.clientX, e.clientY); }, { passive: true });
  document.addEventListener("mouseleave", function () { cx = cy = 0; s.translate = ""; });
});
`,
};

const MARQUEE: Work = {
  manifest: {
    id: "marquee",
    name: "Marquee loop",
    category: "motion",
    blurb: "The part's contents run round continuously, like a ticker.",
    inputs: [
      { id: "speed", label: "Speed (px a second)", kind: "number", default: "60" },
      { id: "direction", label: "Runs", kind: "one", default: "left", values: ["left", "right"], heard: "\\b(left|right)\\b" },
      { id: "pause", label: "Pause under the mouse", kind: "one", default: "yes", values: ["yes", "no"] },
      { id: "gap", label: "Gap between loops (px)", kind: "number", default: "40" },
    ],
    needs: "none",
    says: ["marquee", "marquee loop", "ticker", "scrolling ticker", "news ticker", "scrolling text", "loop text"],
    look: { sample: "« $TICK · $TICK ·", caption: "marquee · loop" },
    version: 1,
  },
  script: `siteFeatures.define("marquee", function (el, inputs) {
  if (${CALM} || !el.animate || el.hasAttribute("data-marquee")) return;
  el.setAttribute("data-marquee", "");
  var speed = Math.max(5, Number(inputs.speed) || 60), right = inputs.direction === "right";
  var gap = Math.max(0, Number(inputs.gap)); if (!isFinite(gap) || inputs.gap === "") gap = 40;
  var track = document.createElement("div"), one = document.createElement("div");
  track.style.cssText = "display:flex;width:max-content;height:100%;align-items:center;white-space:nowrap;will-change:transform";
  one.style.cssText = "display:flex;flex:none;align-items:center;padding-right:" + gap + "px";
  while (el.firstChild) one.appendChild(el.firstChild);
  track.appendChild(one); el.appendChild(track);
  el.style.overflow = "hidden";
  var anim = null, held = false;
  function build() {
    while (track.children.length > 1) track.removeChild(track.lastChild);
    var w = one.getBoundingClientRect().width, need = Math.max(1, Math.ceil(el.clientWidth / Math.max(1, w)));
    for (var i = 0; i < need; i++) {
      var c = one.cloneNode(true);
      c.setAttribute("aria-hidden", "true");
      var ids = c.querySelectorAll("[id]"); for (var j = 0; j < ids.length; j++) ids[j].removeAttribute("id");
      track.appendChild(c);
    }
    if (anim) anim.cancel();
    var a = "translateX(0px)", b = "translateX(" + -w + "px)";
    anim = track.animate([{ transform: right ? b : a }, { transform: right ? a : b }], { duration: Math.max(1, w / speed * 1000), iterations: Infinity });
    if (held) anim.pause();
  }
  build();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  window.addEventListener("resize", build);
  if (inputs.pause !== "no") {
    el.addEventListener("pointerenter", function () { held = true; if (anim) anim.pause(); });
    el.addEventListener("pointerleave", function () { held = false; if (anim) anim.play(); });
  }
});
`,
};

const EMBED: Work = {
  manifest: {
    id: "embed",
    name: "Embed",
    category: "media",
    blurb: "Another page shown inside the part, at its size, in a sandbox.",
    inputs: [
      { id: "url", label: "Address", kind: "text", default: "", placeholder: "https://…", heard: "(https?://[^\\s\"'<>]+)", required: true },
      { id: "title", label: "Title (read out)", kind: "text", default: "Embedded page" },
    ],
    needs: "none",
    says: ["embed", "iframe", "embed a page", "embed chart", "show a page inside"],
    look: { sample: "▭ https://…", caption: "embed · sandboxed" },
    version: 1,
  },
  script: `siteFeatures.define("embed", function (el, inputs, api) {
  var u;
  try { u = new URL(String(inputs.url || "").trim(), location.href); } catch (e) { api.stale(el); return; }
  if (!inputs.url || (u.protocol !== "https:" && u.protocol !== "http:")) { api.stale(el); return; }
  var sandbox = ["allow-scripts", "allow-forms", "allow-popups", "allow-popups-to-escape-sandbox", "allow-presentation"];
  /* A page of the site's own, with scripts and its origin, could reach out of the frame: it gets scripts only. */
  if (u.origin !== location.origin) sandbox.push("allow-same-origin");
  var f = document.createElement("iframe");
  f.src = u.href;
  f.title = String(inputs.title || "").trim() || "Embedded page";
  f.setAttribute("sandbox", sandbox.join(" "));
  f.setAttribute("referrerpolicy", "no-referrer");
  f.setAttribute("loading", "lazy");
  f.setAttribute("allow", "fullscreen");
  f.style.cssText = "display:block;width:100%;height:100%;border:0";
  var tall = el.clientHeight;
  el.textContent = "";
  if (tall < 20) f.style.aspectRatio = "16 / 9";
  el.appendChild(f);
});
`,
};

/* ------------------------------------------------------------------ */
/* The owner's own two, from trumpmorty.fun                            */
/* ------------------------------------------------------------------ */

const CRT: Work = {
  manifest: {
    id: "crt-loader",
    name: "CRT loader",
    category: "hero",
    blurb: "A full-screen tuning screen while the page loads: static, scanlines, a channel and a bar. It switches off like an old set.",
    inputs: [
      { id: "title", label: "Title", kind: "text", default: "", placeholder: "the part's own words" },
      { id: "ticker", label: "Ticker", kind: "text", default: "" },
      { id: "picture", label: "Picture", kind: "text", default: "", placeholder: "the part's own picture" },
      { id: "channel", label: "Channel", kind: "text", default: "CH 47" },
      { id: "label", label: "Label", kind: "text", default: "TUNING" },
      { id: "hold", label: "Shown at least (seconds)", kind: "number", default: "1.8" },
    ],
    needs: "none",
    says: ["crt loader", "crt", "tv loader", "tuning screen", "loading screen", "preloader"],
    look: { sample: "▒ TUNING 47%", caption: "crt · loader" },
    version: 1,
  },
  script: `siteFeatures.define("crt-loader", function (el, inputs) {
  if (${CALM} || document.querySelector("[data-crt]")) return;
  var img = el.querySelector && el.querySelector("img");
  var title = String(inputs.title || "").trim() || String(el.textContent || "").replace(/\\s+/g, " ").trim();
  var ticker = String(inputs.ticker || "").trim(), pic = String(inputs.picture || "").trim() || (img && img.currentSrc) || "";
  var hold = Math.max(0.3, Number(inputs.hold) || 1.8) * 1000;
  var green = "#b8ff6a", glow = "0 0 8px rgba(160,255,90,.8),2px 2px 0 #000", mono = "ui-monospace,SFMono-Regular,Menlo,monospace";
  function add(parent, tag, css, text) { var n = document.createElement(tag); n.style.cssText = css; if (text) n.textContent = text; parent.appendChild(n); return n; }
  var o = document.createElement("div");
  o.setAttribute("data-crt", ""); o.setAttribute("aria-hidden", "true");
  o.style.cssText = "position:fixed;inset:0;z-index:2147482000;background:#000;overflow:hidden;display:grid;place-items:center";
  var full = "position:absolute;inset:0;width:100%;height:100%;";
  if (pic) {
    var p = add(o, "img", full + "object-fit:cover;filter:saturate(1.15) contrast(1.05)");
    p.src = pic; p.alt = "";
    p.animate([{ transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 6000, easing: "ease-out", fill: "forwards" });
  }
  var cv = add(o, "canvas", full + "mix-blend-mode:screen;opacity:.55;image-rendering:pixelated");
  cv.width = 160; cv.height = 90;
  var cx = cv.getContext("2d"), on = true;
  (function noise() {
    if (!on || !cx) return;
    var im = cx.createImageData(160, 90), d = im.data;
    for (var i = 0; i < d.length; i += 4) { var v = Math.random() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    cx.putImageData(im, 0, 0);
    setTimeout(function () { requestAnimationFrame(noise); }, 50);
  })();
  var scan = add(o, "div", full + "pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 2px,transparent 2px 4px)");
  scan.animate([{ backgroundPosition: "0 0" }, { backgroundPosition: "0 400px" }], { duration: 8000, iterations: Infinity });
  add(o, "div", full + "background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.75) 100%)");
  var osd = "position:absolute;top:22px;font-family:" + mono + ";font-size:clamp(20px,3vw,40px);color:" + green + ";text-shadow:" + glow;
  add(o, "div", osd + ";left:28px", String(inputs.channel || ""));
  add(o, "div", osd + ";right:28px;color:#ff5a4a;text-shadow:0 0 8px rgba(255,80,60,.8),2px 2px 0 #000", "\\u25CF REC")
    .animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], { duration: 1000, iterations: Infinity });
  var mid = add(o, "div", "position:relative;text-align:center;rotate:-3deg");
  if (title) add(mid, "div", "font-size:clamp(40px,9vw,140px);line-height:.9;font-weight:900;color:#fff;-webkit-text-stroke:3px #111;paint-order:stroke fill;text-shadow:6px 6px 0 #111,10px 10px 0 #e0322b", title);
  if (ticker) add(mid, "div", "display:inline-block;margin-top:14px;font-size:clamp(22px,3.4vw,46px);font-weight:800;background:#a6e22e;color:#111;padding:6px 22px 2px;border:3px solid #111;border-radius:14px;box-shadow:6px 6px 0 #111;rotate:4deg", ticker);
  var foot = add(o, "div", "position:absolute;left:50%;bottom:34px;translate:-50% 0;width:min(520px,82vw);text-align:center");
  var lab = add(foot, "div", "font-family:" + mono + ";font-size:clamp(18px,3vw,30px);color:" + green + ";text-shadow:" + glow + ";margin-bottom:6px");
  var barBox = add(foot, "div", "height:18px;border:3px solid #111;background:rgba(0,0,0,.55);border-radius:10px;overflow:hidden;box-shadow:4px 4px 0 #111");
  var bar = add(barBox, "i", "display:block;height:100%;width:0;background:repeating-linear-gradient(-45deg,#a6e22e 0 12px,#7cc21a 12px 24px)");
  document.body.appendChild(o);
  var root = document.documentElement, flow = root.style.overflow;
  root.style.overflow = "hidden";
  var t0 = Date.now(), shown = 0, done = false, loaded = document.readyState === "complete";
  window.addEventListener("load", function () { loaded = true; });
  setTimeout(function () { loaded = true; }, hold + 6000);
  (function tick() {
    if (done) return;
    var cap = Math.min(loaded ? 100 : 90, (Date.now() - t0) / hold * 100);
    shown += (cap - shown) * 0.12;
    if (shown > 99.4 && loaded) shown = 100;
    lab.textContent = String(inputs.label || "") + " " + Math.round(shown) + "%";
    bar.style.width = shown + "%";
    cv.style.opacity = String(0.55 - shown / 100 * 0.4);
    if (shown >= 100) { done = true; setTimeout(off, 350); return; }
    requestAnimationFrame(tick);
  })();
  function off() {
    root.style.overflow = flow;
    var a = o.animate([
      { clipPath: "inset(0 0 0 0)", filter: "brightness(1)" },
      { clipPath: "inset(49.6% 0 49.6% 0)", filter: "brightness(3)", offset: 0.45 },
      { clipPath: "inset(49.6% 49% 49.6% 49%)", filter: "brightness(5)", offset: 0.75 },
      { clipPath: "inset(50% 50% 50% 50%)", opacity: 0 }
    ], { duration: 750, easing: "cubic-bezier(.7,0,.3,1)", fill: "forwards" });
    function gone() { on = false; o.remove(); }
    a.onfinish = gone;
    setTimeout(gone, 1200);
  }
});
`,
};

const DUST: Work = {
  manifest: {
    id: "dust-canvas",
    name: "Dust",
    category: "motion",
    blurb: "Specks drifting up through the part, drawn on a canvas behind its contents.",
    inputs: [
      { id: "colours", label: "Colours", kind: "text", default: "#8fbf7a, #a6d86f, #89cebc, #fff3a0, #ef9043" },
      { id: "spacing", label: "One speck every (px of width)", kind: "number", default: "18" },
      { id: "speed", label: "Speed", kind: "number", default: "1" },
    ],
    needs: "none",
    says: ["floating dust", "dust", "dust canvas", "particles", "floating particles", "specks"],
    look: { sample: "· ˙ ∙ · ˙", caption: "dust · drifting" },
    version: 1,
  },
  script: `siteFeatures.define("dust-canvas", function (el, inputs) {
  if (${CALM}) return;
  var cols = String(inputs.colours || "").split(",").map(function (c) { return c.trim(); }).filter(Boolean);
  if (!cols.length) cols = ["#8fbf7a", "#a6d86f", "#89cebc", "#fff3a0", "#ef9043"];
  var gap = Math.max(4, Number(inputs.spacing) || 18), speed = Math.max(0.1, Number(inputs.speed) || 1);
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  el.style.isolation = "isolate";
  var cv = document.createElement("canvas");
  cv.setAttribute("aria-hidden", "true");
  cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:-1";
  el.insertBefore(cv, el.firstChild);
  var ctx = cv.getContext("2d"), parts = [], DPR = Math.min(window.devicePixelRatio || 1, 2), seen = true;
  if (!ctx) return;
  function spawn(any) {
    return { x: Math.random() * cv.width, y: any ? Math.random() * cv.height : cv.height + 10,
      r: (Math.random() * 2.6 + 0.8) * DPR, vy: -(Math.random() * 0.35 + 0.1) * DPR * speed, vx: (Math.random() - 0.5) * 0.3 * DPR * speed,
      c: cols[Math.random() * cols.length | 0], a: Math.random() * 0.6 + 0.3, ph: Math.random() * 6.28 };
  }
  function resize() {
    cv.width = Math.max(1, cv.offsetWidth * DPR); cv.height = Math.max(1, cv.offsetHeight * DPR);
    var n = Math.round(cv.offsetWidth / gap); parts = [];
    for (var i = 0; i < n; i++) parts.push(spawn(true));
    draw();
  }
  function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
  }
  function frame() {
    if (seen) {
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i]; p.ph += 0.02; p.x += p.vx + Math.sin(p.ph) * 0.3; p.y += p.vy;
        if (p.y < -10) parts[i] = spawn(false);
      }
      draw();
    }
    requestAnimationFrame(frame);
  }
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { seen = e[e.length - 1].isIntersecting; }).observe(el);
  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(frame);
});
`,
};

/** The behaviours, in shelf order. */
export const BEHAVIOURS: Work[] = [REVEAL, COPY, TILT, FOLLOW, MARQUEE, EMBED, CRT, DUST];
