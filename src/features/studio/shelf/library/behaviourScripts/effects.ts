import type { Work } from "../works.ts";
import { CALM, SHEET_TRANSITION } from "./motion.ts";
import { PLANET_JS } from "../planetJs.ts";

export const EMBED: Work = {
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

export const CRT: Work = {
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
      /* The moment the original switched off, from the navigation's start (sink `loader.nav.off`): set, it goes then, on the visitor's own clock, however late its script ran. */
      { id: "at", label: "Switches off at (seconds after the page is asked for; blank uses Shown at least)", kind: "number", default: "", advanced: true },
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
  /* Timed from the navigation (performance.now's own origin), as the original was: the ramp ends 350 ms before it and the switch-off starts on it. Blank: from when this script ran, for Shown at least. */
  var at = inputs.at === "" || inputs.at === undefined ? NaN : Number(inputs.at) * 1000, byNav = isFinite(at) && at > 0 && !!(window.performance && performance.now);
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
  setTimeout(function () { loaded = true; }, (byNav ? Math.max(0, at - performance.now()) + 1500 : hold + 6000));
  (function tick() {
    if (done) return;
    if (byNav) {
      /* Its own clock: the bar full 350 ms before the moment, then off on it; a page still loading holds it at most 1.5 s more. */
      var now = performance.now(), ramp = Math.max(1, at - 350);
      shown = Math.min(loaded ? 100 : 90, now / ramp * 100);
      if (now >= ramp && loaded) shown = 100;
    } else {
      var cap = Math.min(loaded ? 100 : 90, (Date.now() - t0) / hold * 100);
      shown += (cap - shown) * 0.12;
      if (shown > 99.4 && loaded) shown = 100;
    }
    lab.textContent = String(inputs.label || "") + " " + Math.round(shown) + "%";
    bar.style.width = shown + "%";
    cv.style.opacity = String(0.55 - shown / 100 * 0.4);
    if (shown >= 100) { done = true; setTimeout(off, byNav ? Math.max(0, at - performance.now()) : 350); return; }
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

export const DUST: Work = {
  manifest: {
    id: "dust-canvas",
    name: "Dust",
    category: "motion",
    blurb: "Specks drifting up through the part, drawn on a canvas behind its contents.",
    inputs: [
      { id: "colours", label: "Colours", kind: "text", default: "#8fbf7a, #a6d86f, #89cebc, #fff3a0, #ef9043" },
      { id: "spacing", label: "One speck every (px of width)", kind: "number", default: "18" },
      { id: "speed", label: "Speed", kind: "number", default: "1" },
      { id: "size", label: "Speck size (px, across the middle)", kind: "number", default: "2.1", advanced: true },
      { id: "direction", label: "Drifts", kind: "one", default: "up", values: ["up", "down"], advanced: true },
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
  var size = Math.max(0.3, Number(inputs.size) || 2.1) / 2.1, down = inputs.direction === "down";
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  el.style.isolation = "isolate";
  var cv = document.createElement("canvas");
  cv.setAttribute("aria-hidden", "true"); cv.setAttribute("data-feature-layer", "dust-canvas");
  cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:-1";
  el.insertBefore(cv, el.firstChild);
  var ctx = cv.getContext("2d"), parts = [], DPR = Math.min(window.devicePixelRatio || 1, 2), seen = true;
  if (!ctx) return;
  function spawn(any) {
    return { x: Math.random() * cv.width, y: any ? Math.random() * cv.height : down ? -10 : cv.height + 10,
      r: (Math.random() * 2.6 + 0.8) * DPR * size, vy: (down ? 1 : -1) * (Math.random() * 0.35 + 0.1) * DPR * speed, vx: (Math.random() - 0.5) * 0.3 * DPR * speed,
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
        if (p.y < -10 || p.y > cv.height + 10) parts[i] = spawn(false);
      }
      draw();
    }
    if (cv.isConnected) requestAnimationFrame(frame);
  }
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { seen = e[e.length - 1].isIntersecting; }).observe(el);
  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(frame);
});
`,
};

/* ------------------------------------------------------------------ */
/* Two small ones, from what trumpmorty.fun's script did               */
/* ------------------------------------------------------------------ */

export const SCROLL_HEADER: Work = {
  manifest: {
    id: "scroll-header",
    name: "Header bar on scroll",
    category: "nav",
    blurb: "Once the page is scrolled, the part (a header) takes a bar: a fill and an edge of its own. Back at the top it goes.",
    inputs: [
      { id: "at", label: "After (px scrolled)", kind: "number", default: "40", heard: "(\\d+)\\s*px\\b" },
      { id: "background", label: "Fill", kind: "text", default: "", placeholder: "a colour, e.g. #f3d440" },
      { id: "edge", label: "Edge (shadow)", kind: "text", default: "0 4px 0 #111", placeholder: "e.g. 0 4px 0 #111" },
      { id: "duration", label: "Takes (ms)", kind: "number", default: "300" },
      { id: "padding", label: "Padding once scrolled (top bottom)", kind: "text", default: "", placeholder: "e.g. 8px 8px" },
      { id: "parts", label: "Carries (the parts in the header)", kind: "text", default: "", placeholder: "part ids, comma-separated" },
    ],
    needs: "none",
    says: ["header bar on scroll", "sticky header background", "header on scroll", "scrolled header", "header changes on scroll", "shrink header"],
    look: { sample: "▔▔ bar ▔▔", caption: "header · on scroll" },
    version: 1,
  },
  script: `siteFeatures.define("scroll-header", function (el, inputs) {
  var calm = ${CALM};
  var at = Number(inputs.at); if (!isFinite(at) || inputs.at === "") at = 40;
  var safe = function (v) { v = String(v || "").trim(); return /^[#\\w\\s.,()%-]+$/.test(v) ? v : ""; };
  var fill = safe(inputs.background), edge = safe(inputs.edge), ms = Math.max(0, Number(inputs.duration) || 0), s = el.style;
  var was = { background: s.background, boxShadow: s.boxShadow, transition: s.transition };
  /* The padding closes on the part's own box, where its captured padding is (the page's .scrolled rule: 14px to 8px); the bar shrinks by as much, and the parts it holds (its own parts here) ride up with it. */
  var pads = String(inputs.padding || "").trim().split(/\\s+/).filter(function (v) { return /^\\d*\\.?\\d+px$/.test(v); });
  var inner = pads.length ? (el.firstElementChild || el) : null, is = inner ? inner.style : null;
  var wasPad = is ? { top: is.paddingTop, bottom: is.paddingBottom } : null;
  var cp = inner ? getComputedStyle(inner) : null;
  var dTop = cp ? parseFloat(cp.paddingTop) - parseFloat(pads[0]) : 0, dBottom = cp ? parseFloat(cp.paddingBottom) - parseFloat(pads[1] || pads[0]) : 0;
  var wasH = s.height, wasMin = s.minHeight, hPx = /^\\d*\\.?\\d+px$/.test(wasH) ? parseFloat(wasH) : null;
  var held = String(inputs.parts || "").split(",").map(function (id) { return id ? document.getElementById(id.trim()) : null; }).filter(Boolean);
  /* A change of state, not a motion: it still happens for a visitor who asked for less motion, only at once. */
  s.transition = calm || !ms ? "none" : "background " + ms + "ms, background-color " + ms + "ms, box-shadow " + ms + "ms";
  var t2 = calm || !ms ? "none" : "padding " + ms + "ms, height " + ms + "ms, translate " + ms + "ms";
  if (is) { is.transition = t2; s.transition = s.transition === "none" ? "none" : s.transition + ", height " + ms + "ms"; }
  held.forEach(function (h) { h.style.transition = t2; });
  var box = null;
  for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) { var o = getComputedStyle(p).overflowY; if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) { box = p; break; } }
  var on = null;
  function place() {
    var now = (box ? box.scrollTop : window.scrollY) > at;
    if (now === on) return;
    on = now;
    s.background = now && fill ? fill : was.background;
    s.boxShadow = now && edge ? edge : was.boxShadow;
    if (is) { is.paddingTop = now ? pads[0] : wasPad.top; is.paddingBottom = now ? (pads[1] || pads[0]) : wasPad.bottom; }
    if (is && hPx !== null) { s.height = now ? (hPx - dTop - dBottom) + "px" : wasH; s.minHeight = now ? s.height : wasMin; }
    held.forEach(function (h) { h.style.translate = now && dTop ? "0 " + (-dTop) + "px" : ""; });
    if (now) el.setAttribute("data-scrolled", ""); else el.removeAttribute("data-scrolled");
  }
  (box || window).addEventListener("scroll", place, { passive: true });
  place();
});
`,
};

/**
 * THE TOP BAR, ON SCROLL. The Sticky top bar's own "On scroll" option
 * (shrink, hide-then-show, blur; `catalog.ts`) was read nowhere, so the part
 * said it did something and did nothing (shelf audit, item 3). Every
 * Sticky top bar carries this, with the option as its input
 * (`works.ts#usesHere`), and it runs where the part is:
 *
 *   · on the published page, where the bar's box is `position: sticky`
 *     (`LiveSite.tsx`), and the window is what scrolls;
 *   · in the Preview, the same markup inside the Preview's own scroller;
 *   · on the board, where nothing sticks (a stuck box could not be picked
 *     up where it is drawn): the drawn layer inside the part rides the
 *     board's scroll instead, so the bar is seen doing what the site's does,
 *     while its box, selection and handles stay where they are.
 *
 * `at`: how far the page has gone before the bar changes. Hide-then-show
 * hides on the way down once the bar's own height has passed, and comes back
 * on the first move up. A visitor who asked for less motion gets each state
 * at once, with no transition: a change of state, not a motion.
 */
export const STICKY_BAR: Work = {
  manifest: {
    id: "sticky-bar",
    name: "Top bar on scroll",
    category: "nav",
    blurb: "As the page scrolls, the bar shrinks, hides until the reader scrolls up, or goes to glass. The Sticky top bar carries it; its On scroll option says which.",
    inputs: [
      { id: "on", label: "On scroll", kind: "one", default: "shrink", values: ["shrink", "hide-then-show", "blur", "static"], heard: "\\b(shrink|hide-then-show|hide|blur|static)\\b" },
      { id: "at", label: "After (px scrolled)", kind: "number", default: "24", heard: "(\\d+)\\s*px\\b" },
    ],
    needs: "none",
    says: ["top bar on scroll", "shrink the bar on scroll", "hide the bar on scroll", "blur the bar on scroll", "bar on scroll"],
    look: { sample: "▔▔ bar ▔▔ ↕", caption: "top bar · on scroll" },
    version: 1,
  },
  script: `siteFeatures.define("sticky-bar", function (el, inputs) {
  var calm = ${CALM};
  var on = String(inputs.on || "shrink"); if (on === "hide") on = "hide-then-show";
  if (on !== "shrink" && on !== "hide-then-show" && on !== "blur") return;
  var at = Number(inputs.at); if (!isFinite(at) || inputs.at === "") at = 24;
  /* The bar itself: the part's own element, inside the box this runs on. */
  var bar = el.matches("[data-part]") ? el : (el.querySelector("[data-part]") || el.firstElementChild || el); /* the published page keeps no data-*: the first thing in the box is the bar */
  var bs = bar.style, es = el.style;
  /* What scrolls: the nearest box that does (the Preview's window, the board's pane), else the window. */
  var box = null;
  for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) { var o = getComputedStyle(p).overflowY; if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) { box = p; break; } }
  var board = !!(box && box.hasAttribute("data-studio-pane"));
  var top = function () { return box ? box.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0); };
  /* Where the bar's top stands in the page, so "scrolled" is scrolled past the bar. A stuck box reads its own margin (LiveSite sets it to the bar's y); anything else is measured. */
  var wrap = el.parentElement;
  var stuck = wrap && getComputedStyle(el).position === "sticky" ? el : (wrap && getComputedStyle(wrap).position === "sticky" ? wrap : null);
  var start;
  if (stuck) start = parseFloat(getComputedStyle(stuck).marginTop) || 0;
  else { var r = el.getBoundingClientRect(), br = box ? box.getBoundingClientRect() : { top: 0 }; start = top() + r.top - br.top; }
  var h = bar.getBoundingClientRect().height || el.getBoundingClientRect().height || 64;
  /* The board draws the page at a zoom: a screen pixel of scroll is less than a page pixel. */
  var zoom = function () { var w = el.offsetWidth; return w ? el.getBoundingClientRect().width / w : 1; };
  var was = { height: bs.height, translate: bs.translate, filter: bs.backdropFilter, wfilter: bs.webkitBackdropFilter, background: bs.background, transition: bs.transition, ride: es.translate };
  var bg = getComputedStyle(bar).backgroundColor;
  var ms = calm ? 0 : 260;
  bs.transition = ms ? "height " + ms + "ms ease, translate " + ms + "ms ease, backdrop-filter " + ms + "ms ease, background-color " + ms + "ms ease" : "none";
  var state = null, last = top(), hidden = false;
  function apply(now) {
    if (now === state) return;
    state = now;
    if (on === "shrink") bs.height = now ? Math.round(h * 0.76) + "px" : was.height;
    if (on === "blur") {
      bs.backdropFilter = now ? "blur(12px) saturate(1.2)" : was.filter;
      bs.webkitBackdropFilter = now ? "blur(12px) saturate(1.2)" : was.wfilter;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") bs.background = now ? "color-mix(in srgb, " + bg + " 68%, transparent)" : was.background;
    }
    if (now) el.setAttribute("data-scrolled", on); else el.removeAttribute("data-scrolled");
  }
  function hide(yes) {
    if (yes === hidden) return;
    hidden = yes;
    bs.translate = yes ? "0 " + (-Math.round(h * 1.15)) + "px" : (was.translate || "0 0");
    if (yes) el.setAttribute("data-bar-hidden", ""); else el.removeAttribute("data-bar-hidden");
  }
  function place() {
    var t = top(), gone = t - start;
    /* On the board the drawn layer rides along the pane's top edge, as the stuck bar does on the site. */
    if (board) es.translate = gone > 0 ? "0 " + Math.round(gone / zoom()) + "px" : (was.ride || "0 0");
    apply(gone > at);
    if (on === "hide-then-show") { if (t < last) hide(false); else if (gone > h && t > last) hide(true); }
    last = t;
  }
  (box || window).addEventListener("scroll", place, { passive: true });
  place();
});
`,
};

export const BLINK: Work = {
  manifest: {
    id: "blink",
    name: "Blink",
    category: "motion",
    blurb: "The part blinks on and off, like a LIVE light: in two steps, or fading.",
    inputs: [
      { id: "every", label: "Every (seconds)", kind: "number", default: "1" },
      { id: "how", label: "How", kind: "one", default: "steps", values: ["steps", "fade"], heard: "\\b(fade|fades|fading)\\b" },
      { id: "css", label: "The page's own blink", kind: "text", default: "", placeholder: "1s steps(2) 0s infinite normal none cap-blink", advanced: true },
    ],
    needs: "none",
    says: ["blink", "blinking", "blinking light", "live dot", "flash", "flashing", "on air light"],
    look: { sample: "● LIVE", caption: "blink" },
    version: 1,
  },
  /*
   * A CAPTURED BLINK PLAYS AS THE PAGE WROTE IT. trumpmorty.fun's LIVE dots
   * are `blink 1s steps(2)` over `50% { opacity: 0 }`: a timing function
   * steps each stretch between two stops, so they run 1, .5, 0, .5, three
   * stages. The two ends played here ran 1, 0. So a blink the capture
   * carried is its own animation, every longhand, over the page's own
   * keyframes (`cap-<name>`, in the stylesheet `capturedMotion.ts` writes),
   * and the two made-up ones are for a part the owner asked to blink.
   *
   * IT BLINKS THE PART'S DRAWING, NOT ITS BOX. The page's rule has no 0% or
   * 100% (`50% { opacity: 0 }`): those stops are the element's own opacity.
   * On trumpmorty.fun the remote's LED sits in a card that is revealed, so
   * the card's opacity is what goes 0 to 1 and the LED's own stays 1. Here
   * every part is a box of its own and the card's Reveal is carried onto the
   * LED's box too, where it holds `opacity: 0` until scrolled to; a blink on
   * that box read 0 at every stop. So when the box paints nothing itself and
   * holds one layer that draws the part (an exported part's, a `.mo`
   * layer's), the blink runs on that layer, and the two multiply as they did
   * on the page. A box that paints the light itself blinks itself.
   */
  script: `siteFeatures.define("blink", function (el, inputs) {
  if (${CALM}) return;
  function bare(x) {
    var c = getComputedStyle(x), t = x.childNodes;
    for (var i = 0; i < t.length; i++) if (t[i].nodeType === 3 && /\\S/.test(t[i].nodeValue)) return false;
    return (c.backgroundColor === "transparent" || /^rgba\\(.*,\\s*0\\)$/.test(c.backgroundColor)) && c.backgroundImage === "none" && c.boxShadow === "none" && !parseFloat(c.borderTopWidth) && !parseFloat(c.borderRightWidth) && !parseFloat(c.borderBottomWidth) && !parseFloat(c.borderLeftWidth) && c.outlineStyle === "none";
  }
  var at = el.children && el.children.length === 1 && el.firstElementChild.style && bare(el) ? el.firstElementChild : el;
  var own = String(inputs.css || "").trim();
  if (own && /^[\\w\\s().,%-]+$/.test(own) && /\\bcap-[\\w-]+\\b/.test(own)) { at.style.animation = own; return; }
  if (!at.animate) return;
  var t = Number(inputs.every); if (!isFinite(t) || t <= 0) t = 1;
  var frames = inputs.how === "fade"
    ? [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }]
    : [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }];
  at.animate(frames, { duration: t * 1000, iterations: Infinity, easing: inputs.how === "fade" ? "ease-in-out" : "linear" });
});
`,
};


/* ------------------------------------------------------------------ */
/* Motion sampled from a page (sink docs/behaviours.md, "Motion        */
/* sampled"): what it did at rest, under the pointer and as it scrolled */
/* ------------------------------------------------------------------ */

export const SPIN: Work = {
  manifest: {
    id: "spin",
    name: "Spin",
    category: "motion",
    blurb: "The part turns round and round, slowly: a planet, a badge, a record.",
    inputs: [
      { id: "period", label: "One turn takes (seconds)", kind: "number", default: "20", heard: "(\\d+(?:\\.\\d+)?)\\s*(?:s|sec|secs|seconds)\\b" },
      { id: "direction", label: "Turns", kind: "one", default: "cw", values: ["cw", "ccw"], heard: "\\b(cw|ccw)\\b" },
    ],
    needs: "none",
    says: ["spin", "spinning", "rotate slowly", "slowly spins", "turns round", "rotating"],
    look: { sample: "↻ spin", caption: "spin · slow" },
    version: 1,
  },
  script: `siteFeatures.define("spin", function (el, inputs) {
  if (${CALM} || !el.animate) return;
  var t = Number(inputs.period); if (!isFinite(t) || t <= 0) t = 20;
  var turn = inputs.direction === "ccw" ? "-360deg" : "360deg";
  /* On the rotate property, added to any turn the part has of its own. With none, it replaces, so the browser's compositor turns it smoothly off the main thread. */
  var own = getComputedStyle(el).rotate, mine = own && own !== "none" && parseFloat(own) !== 0;
  el.animate([{ rotate: "0deg" }, { rotate: turn }], { duration: t * 1000, iterations: Infinity, easing: "linear", composite: mine ? "add" : "replace" });
});
`,
};

export const FLOAT: Work = {
  manifest: {
    id: "float",
    name: "Float",
    category: "motion",
    blurb: "The part bobs gently up and back (or side to side), as if on water.",
    inputs: [
      { id: "travel", label: "Travels (px)", kind: "number", default: "12", heard: "(\\d+)\\s*px\\b" },
      { id: "period", label: "Out and back takes (seconds)", kind: "number", default: "6", heard: "(\\d+(?:\\.\\d+)?)\\s*(?:s|sec|secs|seconds)\\b" },
      { id: "axis", label: "Along", kind: "one", default: "y", values: ["y", "x"] },
      { id: "toward", label: "Goes first", kind: "one", default: "-", values: ["-", "+"], advanced: true },
      { id: "ease", label: "Curve", kind: "text", default: "ease-in-out", advanced: true },
    ],
    needs: "none",
    says: ["float", "floating", "bob", "bobbing", "floats up and down", "hover up and down", "drift up and down"],
    look: { sample: "≈ float", caption: "float · bob" },
    version: 1,
  },
  script: `siteFeatures.define("float", function (el, inputs) {
  if (${CALM} || !el.animate) return;
  var d = Number(inputs.travel); if (!isFinite(d) || inputs.travel === "") d = 12;
  var t = Number(inputs.period); if (!isFinite(t) || t <= 0) t = 6;
  var sign = inputs.toward === "+" ? 1 : -1, far = (sign * d).toFixed(2) + "px";
  var ease = /^[\\w\\s.,()-]+$/.test(inputs.ease || "") ? inputs.ease : "ease-in-out";
  var out = inputs.axis === "x" ? far + " 0px" : "0px " + far;
  /*
   * On the translate property, added to wherever else the part is moved (a
   * layer following the pointer). With no move of its own it replaces: an
   * added animation runs on the main thread, where a few pixels of travel
   * land on whole pixels and step (J, 2026-10-10: "slightly framey"); a
   * replaced one runs on the compositor and glides between pixels.
   */
  var own = getComputedStyle(el).translate, mine = own && own !== "none" && !/^0(px)?( 0(px)?)*$/.test(own);
  el.animate([{ translate: "0px 0px", easing: ease }, { translate: out, easing: ease, offset: 0.5 }, { translate: "0px 0px" }], { duration: t * 1000, iterations: Infinity, composite: mine ? "add" : "replace" });
});
`,
};

export const HOVER_LIFT: Work = {
  manifest: {
    id: "hover-lift",
    name: "Lift on hover",
    category: "interact",
    blurb: "Under the pointer the part rises a little (and may lean or grow), and settles back when it leaves.",
    inputs: [
      { id: "lift", label: "Rises (px)", kind: "number", default: "4", heard: "(\\d+)\\s*px\\b" },
      { id: "x", label: "Moves across (px)", kind: "number", default: "0", advanced: true },
      { id: "turn", label: "Leans (degrees)", kind: "number", default: "0", advanced: true },
      { id: "scale", label: "Grows to", kind: "number", default: "1", advanced: true },
      { id: "pace", label: "Takes (ms)", kind: "number", default: "200", advanced: true },
    ],
    needs: "none",
    says: ["lift on hover", "hover lift", "rise on hover", "raise on hover", "pop on hover", "hover up"],
    look: { sample: "▲ lift", caption: "hover · lift" },
    version: 1,
  },
  script: `siteFeatures.define("hover-lift", function (el, inputs) {
  if (${CALM}) return;
  var num = function (v, d) { var n = Number(v); return v === "" || v === undefined || !isFinite(n) ? d : n; };
  var lift = num(inputs.lift, 4), x = num(inputs.x, 0), turn = num(inputs.turn, 0), k = num(inputs.scale, 1), ms = Math.max(0, num(inputs.pace, 200));
  var s = el.style, was = { translate: s.translate, rotate: s.rotate, scale: s.scale, transition: s.transition };
  ${SHEET_TRANSITION}
  var own = was.transition || sheetTransition(el);
  s.transition = (own ? own + ", " : "") + "translate " + ms + "ms ease, rotate " + ms + "ms ease, scale " + ms + "ms ease";
  el.addEventListener("pointerenter", function () { s.translate = x + "px " + (-lift) + "px"; if (turn) s.rotate = turn + "deg"; if (k !== 1) s.scale = String(k); });
  el.addEventListener("pointerleave", function () { s.translate = was.translate; s.rotate = was.rotate; s.scale = was.scale; });
});
`,
};

export const SCROLL_DEPTHS: Work = {
  manifest: {
    id: "scroll-depths",
    name: "Follows the scroll",
    category: "motion",
    blurb: "A picture taken at each depth of the page shows the one for where the scroll is: a sea that dives with the page, a map whose window moves.",
    inputs: [
      { id: "bands", label: "Pictures in the strip", kind: "number", default: "2" },
      { id: "ease", label: "Slide between them (ms)", kind: "number", default: "0", advanced: true },
    ],
    needs: "none",
    says: ["follows the scroll", "depth strip", "scroll-driven picture", "minimap", "dives with the page", "picture by scroll"],
    look: { sample: "▤▤▤", caption: "slides · on scroll" },
    version: 1,
  },
  script: `siteFeatures.define("scroll-depths", function (el, inputs) {
  var num = function (v, d) { var n = Number(v); return v === "" || v === undefined || !isFinite(n) ? d : n; };
  /* The strip is looked up each time: the Preview draws the part anew as the page is re-anchored, and the one first found is then no longer in the page. */
  var stripOf = function () { return el.querySelector("[data-depth-strip]") || el; };
  var strip = stripOf();
  var bands = Math.max(1, Math.round(num(inputs.bands, 1)));
  /* The strip is as tall as its bands: the count written on its holder wins over the input where the two differ. */
  var holder = strip.parentElement && strip.parentElement.getAttribute("data-picture-depths");
  if (holder && Number(holder) > 1) bands = Number(holder);
  if (bands < 2) return;
  var box = null;
  for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) { var o = getComputedStyle(p).overflowY; if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) { box = p; break; } }
  var ms = Math.max(0, num(inputs.ease, 0));
  var queued = false, shown = -1, placed = null;
  function place() {
    queued = false;
    if (!el.isConnected) return;
    var strip = stripOf();
    var top = box ? box.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);
    var range = box ? box.scrollHeight - box.clientHeight : (document.documentElement.scrollHeight - window.innerHeight);
    var q = range > 0 ? Math.max(0, Math.min(1, top / range)) : 0;
    var band = Math.round(q * (bands - 1));
    if (band === shown && strip === placed) return;
    shown = band; placed = strip;
    if (ms) strip.style.transition = "translate " + ms + "ms linear";
    var tall = strip.getBoundingClientRect().height / bands;
    strip.style.translate = "0 " + (-band * tall).toFixed(2) + "px";
    el.setAttribute("data-depth", String(band));
    if (strip.tagName === "IMG" && !strip.complete && !strip.__depthsLoad) { strip.__depthsLoad = true; strip.addEventListener("load", function () { shown = -1; soon(); }); }
  }
  function soon() { if (!queued) { queued = true; requestAnimationFrame(place); } }
  (box || window).addEventListener("scroll", soon, { passive: true });
  window.addEventListener("resize", function () { shown = -1; soon(); });
  place();
});
`,
};

/**
 * MOVES AS CAPTURED. The capture pictures each part the screen showed
 * changing (sink `behaviours.motion.frames`, capture/site/capture/frames-drive.mjs):
 * a run of frames cut to the part, played back as one svg the way a
 * canvas's flipbook is. The hand-over (`captured.ts`) lays that picture over
 * the part as a layer of its own, carrying this. A loop, a once, a drift and
 * a live run play themselves: the svg animates wherever an `<img>` shows it,
 * on the board as on the page. The pointer's and the scroll's runs stand
 * still until this script takes the svg over and shows, frame by frame, the
 * picture the recording took when the pointer stood where the visitor's
 * does, or the page was scrolled as far as theirs is.
 *
 * The pointer was swept round a circle through the middle of the captured
 * window (its places kept in `pointer`, one a frame); a visitor's pointer is
 * read against their own window the same way, so the follower meets it
 * wherever the window is wider or narrower. The scroll was read every frame
 * (`scroll`, px); the nearest reading wins, and past the last the last holds.
 */
export const MOVING_FRAMES: Work = {
  manifest: {
    id: "moving-frames",
    name: "Moves as captured",
    category: "motion",
    blurb: "The pictures the capture took of this part as it moved, played back: a loop loops, a once plays once, and what the pointer or the scroll drove follows the visitor's.",
    inputs: [
      { id: "kind", label: "How it moved", kind: "one", default: "loop", values: ["loop", "once", "drift", "live", "pointer", "scroll"] },
      { id: "pointer", label: "Where the pointer was, a frame (x,y;x,y;…)", kind: "text", default: "", advanced: true },
      { id: "scroll", label: "How far the page was scrolled, a frame (px, comma-separated)", kind: "text", default: "", advanced: true },
      { id: "every", label: "A frame every (ms)", kind: "number", default: "100", advanced: true },
      { id: "src", label: "The flipbook (a code site's own file)", kind: "text", default: "", advanced: true },
    ],
    needs: "none",
    says: ["moves as captured", "captured frames", "flipbook", "as it moved", "play its frames", "moving picture"],
    look: { sample: "▶▶▶", caption: "frames · as captured" },
    version: 1,
  },
  script: `siteFeatures.define("moving-frames", function (el, inputs) {
  var num = function (v, d) { var n = Number(v); return v === "" || v === undefined || !isFinite(n) ? d : n; };
  var kind = String(inputs.kind || "loop");
  var every = Math.max(1, num(inputs.every, 100));
  var calm = ${CALM};
  var driven = kind === "pointer" || kind === "scroll";
  var samples = kind === "pointer"
    ? String(inputs.pointer || "").split(";").map(function (p) { var q = p.split(","); return [Number(q[0]), Number(q[1])]; }).filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); })
    : kind === "scroll" ? String(inputs.scroll || "").split(",").map(Number).filter(function (v) { return isFinite(v); }) : [];
  /* The flipbook: the layer's own picture, or the file a code site names. */
  if (!el.querySelector("img[data-moving-frames]") && inputs.src) { var made = document.createElement("img"); made.setAttribute("data-moving-frames", ""); made.alt = ""; made.src = inputs.src; made.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block"; if (!el.style.position) el.style.position = "relative"; el.appendChild(made); }
  /* Taken over: inlined, no animation of its own, one picture at a time, by hand. */
  var take = function (img) {
    var src = img.getAttribute("src");
    var holder = img.parentElement;
    if (!src || !holder) return;
    fetch(src).then(function (r) { return r.ok ? r.text() : null; }).then(function (text) {
      if (!text || !img.isConnected) return;
      var svg = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
      if (!svg || svg.tagName.toLowerCase() !== "svg") return;
      var uses = Array.prototype.slice.call(svg.querySelectorAll("use"));
      if (!uses.length) return;
      Array.prototype.slice.call(svg.querySelectorAll("style")).forEach(function (st) { st.parentNode.removeChild(st); });
      uses.forEach(function (u, i) { u.style.animation = "none"; u.style.opacity = i === 0 ? "1" : "0"; });
      svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%"); svg.setAttribute("preserveAspectRatio", "none");
      svg.style.display = "block"; svg.style.width = "100%"; svg.style.height = "100%";
      Array.prototype.forEach.call(img.attributes, function (a) { if (/^data-/.test(a.name)) svg.setAttribute(a.name, a.value); });
      svg.setAttribute("data-moving-frames", kind);
      holder.replaceChild(svg, img);
      if (!driven || samples.length < 2) return;
      /* When each picture was on: its own time (data-ms), else the pictures evenly over the recording. */
      var ends = [], at = 0;
      uses.forEach(function (u) { var d = Number(u.getAttribute("data-ms")); at += isFinite(d) && d > 0 ? d : every * Math.max(1, Math.round(samples.length / uses.length)); ends.push(at); });
      var total = at;
      var frameAt = function (k) { var t = Math.min(total - 1, Math.max(0, k * every)); for (var i = 0; i < ends.length; i++) if (t < ends[i]) return i; return ends.length - 1; };
      var shown = 0;
      var show = function (i) { if (i === shown || i < 0 || i >= uses.length) return; uses[shown].style.opacity = "0"; uses[i].style.opacity = "1"; shown = i; svg.setAttribute("data-frame", String(i)); };
      var queued = false, want = 0;
      var soon = function () { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; show(frameAt(want)); }); } };
      if (kind === "pointer") {
        /* The captured sweep: a circle round the middle of the window, its radii 22 % of the window's sides (frames-drive.mjs), so the window it was read in is known from the sweep, and a visitor's pointer is read against theirs the same way. */
        var xs = samples.map(function (p) { return p[0]; }), ys = samples.map(function (p) { return p[1]; });
        var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
        var rx = Math.max(1, (maxX - minX) / 2), ry = Math.max(1, (maxY - minY) / 2);
        var capW = rx / 0.22, capH = ry / 0.22, capX = (minX + maxX) / 2 - capW / 2, capY = (minY + maxY) / 2 - capH / 2;
        var windowOf = function () { var box = el.closest("[data-live-scroller]"); return box ? box.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }; };
        window.addEventListener("pointermove", function (e) {
          if (!svg.isConnected) return;
          var r = windowOf();
          if (!r.width || !r.height) return;
          var x = capX + ((e.clientX - r.left) / r.width) * capW, y = capY + ((e.clientY - r.top) / r.height) * capH;
          var best = 0, d = Infinity;
          for (var i = 0; i < samples.length; i++) { var dx = samples[i][0] - x, dy = samples[i][1] - y, q = dx * dx + dy * dy; if (q < d) { d = q; best = i; } }
          want = best; soon();
        }, { passive: true });
      } else {
        var scroller = null;
        for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) { var o = getComputedStyle(p).overflowY; if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) { scroller = p; break; } }
        var read = function () {
          if (!svg.isConnected) return;
          var top = scroller ? scroller.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);
          var best = 0, d = Infinity;
          for (var i = 0; i < samples.length; i++) { var q = Math.abs(samples[i] - top); if (q < d) { d = q; best = i; } }
          want = best; soon();
        };
        (scroller || window).addEventListener("scroll", read, { passive: true });
        read();
      }
    }).catch(function () { /* the picture stays as drawn */ });
  };
  /* A loop, a once, a drift, a live run: the svg plays itself, and a visitor who asked for less motion sees its first picture. The pointer's and the scroll's are taken over. The picture can arrive after the feature (the Preview finds its bytes first), and be drawn again: each new one is looked at. */
  var look = function () {
    var img = el.querySelector("img[data-moving-frames]");
    if (!img) return;
    if (!img.getAttribute("data-moving-frames")) img.setAttribute("data-moving-frames", kind);
    if (!driven && !calm) return;
    if (img.__movingTaken) return;
    img.__movingTaken = true;
    take(img);
  };
  look();
  if ((driven || calm) && typeof MutationObserver === "function") new MutationObserver(look).observe(el, { childList: true, subtree: true });
});
`,
};

export const SCROLL_GROW: Work = {
  manifest: {
    id: "scroll-grow",
    name: "Grow with the scroll",
    category: "motion",
    blurb: "The part (a progress line) fills as the page scrolls past it, and empties again on the way back.",
    inputs: [
      { id: "prop", label: "Grows", kind: "one", default: "width", values: ["width", "height"] },
      { id: "start", label: "Starts when its top is (share of the window down)", kind: "number", default: "0.9" },
      { id: "end", label: "Full when its top is (share of the window down)", kind: "number", default: "0.2" },
      { id: "from", label: "From (%)", kind: "number", default: "0", advanced: true },
      { id: "to", label: "To (%)", kind: "number", default: "100", advanced: true },
      { id: "kept", label: "Drawn at (% of the whole line)", kind: "number", default: "100", advanced: true },
    ],
    needs: "none",
    says: ["grow with the scroll", "scroll progress", "progress line", "progress bar on scroll", "fill on scroll", "timeline line"],
    look: { sample: "▰▰▰▱▱", caption: "grows · on scroll" },
    version: 1,
  },
  script: `siteFeatures.define("scroll-grow", function (el, inputs) {
  /* A visitor who asked for less motion sees it whole. */
  if (${CALM}) return;
  var num = function (v, d) { var n = Number(v); return v === "" || v === undefined || !isFinite(n) ? d : n; };
  var a = num(inputs.start, 0.9), b = num(inputs.end, 0.2), lo = num(inputs.from, 0), hi = num(inputs.to, 100), tall = inputs.prop === "height";
  if (a === b) b = a - 0.01;
  var box = null;
  for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) { var o = getComputedStyle(p).overflowY; if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) { box = p; break; } }
  var s = el.style, queued = false;
  /* Drawn at part of its length (a capture keeps it as seen mid-scroll): made whole first, then shown as far as the scroll has reached. */
  var kept = num(inputs.kept, 100);
  if (kept > 0 && kept < 100) { if (tall) s.height = (el.offsetHeight * 100 / kept).toFixed(2) + "px"; else s.width = (el.offsetWidth * 100 / kept).toFixed(2) + "px"; }
  function place() {
    queued = false;
    if (!el.isConnected) return;
    var top = box ? box.getBoundingClientRect().top : 0, h = box ? box.clientHeight : window.innerHeight || 1;
    var t = (el.getBoundingClientRect().top - top) / h;
    var q = Math.max(0, Math.min(1, (a - t) / (a - b))), pct = lo + (hi - lo) * q, cut = Math.max(0, Math.min(100, 100 - pct)).toFixed(2) + "%";
    s.clipPath = tall ? "inset(0 0 " + cut + " 0)" : "inset(0 " + cut + " 0 0)";
    el.setAttribute("data-grown", String(Math.round(pct)));
  }
  function soon() { if (!queued) { queued = true; requestAnimationFrame(place); } }
  (box || window).addEventListener("scroll", soon, { passive: true });
  window.addEventListener("resize", soon);
  place();
});
`,
};

/**
 * The planet: a ball that turns on its own and in the hand (`../planetJs.ts`).
 * The shelf's orbs carry it (`works.ts#PART_SCRIPT`), so a published orb
 * turns as the Preview's does; given to any other part, or named on a hook
 * of a builder-ready site (`--builder-motion: "planet"`), it draws the ball
 * in the part, as big as fits.
 */
export const PLANET: Work = {
  manifest: {
    id: "planet",
    name: "3D shape",
    category: "media",
    blurb: "A sphere, cube or pyramid in the part that turns slowly on its own and can be dragged round any way to see every side. Pictures wrap round it, one per face.",
    inputs: [
      { id: "shape", label: "Shape", kind: "one", default: "sphere", values: ["sphere", "cube", "pyramid"] },
      { id: "picture", label: "Pictures to wrap round it (one per face, spaces between)", kind: "text", default: "", placeholder: "/front.png /side.png" },
      { id: "hue", label: "Colour (0 to 360, round the wheel)", kind: "number", default: "96" },
      { id: "spin", label: "Turns on its own", kind: "one", default: "yes", values: ["yes", "no"] },
      { id: "speed", label: "Speed", kind: "number", default: "1", advanced: true },
      { id: "tilt", label: "Lean (degrees)", kind: "number", default: "-22", advanced: true },
    ],
    needs: "none",
    says: ["planet", "globe", "turnable sphere", "draggable sphere", "spinning globe", "rotating planet", "3d cube", "3d pyramid", "3d shape"],
    look: { sample: "◐ ▣ △", caption: "3d shape · turns in the hand" },
    version: 1,
  },
  script: `siteFeatures.define("planet", function (el, inputs) {
${PLANET_JS}
  var hosts = el.hasAttribute("data-planet") ? [el] : Array.prototype.slice.call(el.querySelectorAll("[data-planet]"));
  if (!hosts.length) {
    /* Any other part: a ball as big as fits, in its middle. */
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    var h = document.createElement("div");
    h.setAttribute("data-planet", ""); h.setAttribute("data-feature-layer", "planet");
    h.style.cssText = "position:absolute;left:50%;top:50%;height:100%;max-width:100%;aspect-ratio:1/1;transform:translate(-50%,-50%);border-radius:50%";
    /* A picture the part was given for it goes inside the ball. */
    Array.prototype.forEach.call(el.querySelectorAll("img[data-planet-picture]"), function (pic) { h.appendChild(pic); });
    el.appendChild(h);
    hosts = [h];
  }
  hosts.forEach(function (h) { polioPlanet(h, inputs); });
});
`,
};

/**
 * Any part, turned in 3D by the hand (J, 2026-10-10: "for any object I want
 * really to be placed in a 3d space"). A drag turns the part itself about
 * its middle, whichever way the hand goes, in depth; a throw carries on, and
 * it stays where it is left (or, with "Comes back", turns back to face
 * front). A press that does not move is still a press: links and buttons in
 * it work as before. The part's own transform is kept after the turn.
 */
export const TURN_3D: Work = {
  manifest: {
    id: "turn-3d",
    name: "Turn in 3D",
    category: "motion",
    blurb: "Drag the part to turn it round in depth, any way, and see it from every side. It stays where it is left.",
    inputs: [
      { id: "spin", label: "Turns on its own", kind: "one", default: "no", values: ["no", "yes"] },
      { id: "back", label: "Comes back to face front", kind: "one", default: "no", values: ["no", "yes"] },
      { id: "depth", label: "Depth (px, smaller is deeper)", kind: "number", default: "900", advanced: true },
    ],
    needs: "none",
    says: ["turn in 3d", "3d drag", "drag to rotate", "rotate in 3d", "turnable", "spin it round", "3d space"],
    look: { sample: "⟲ 3D", caption: "turn in 3d · drag" },
    version: 1,
  },
  script: `siteFeatures.define("turn-3d", function (el, inputs) {
  if (el.__turn3d) return;
  el.__turn3d = true;
  var calm = ${CALM};
  var spin = inputs.spin === "yes" && !calm, back = inputs.back === "yes", depth = Math.max(200, Number(inputs.depth) || 900);
  var own = el.style.transform || "";
  function mul(a, b) {
    return [a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
      a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
      a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8]];
  }
  function rx(t) { var c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; }
  function ry(t) { var c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
  function unit(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function tidy() {
    var a = unit([M[0], M[3], M[6]]), b = [M[1], M[4], M[7]], k = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    b = unit([b[0] - k * a[0], b[1] - k * a[1], b[2] - k * a[2]]);
    var c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    M = [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];
  }
  var M = [1, 0, 0, 0, 1, 0, 0, 0, 1], vel = [0, 0], held = false, from = null, dragged = false, last = 0, frame = 0;
  function show() {
    /* Turned in the page's own axes (y down): the same turn, read the way CSS reads it. */
    var m = [M[0], -M[1], M[2], -M[3], M[4], -M[5], M[6], -M[7], M[8]];
    var flat = Math.abs(M[0] - 1) + Math.abs(M[4] - 1) + Math.abs(M[8] - 1) < 1e-4;
    el.style.transform = flat ? own : "perspective(" + depth + "px) matrix3d(" + [m[0], m[3], m[6], 0, m[1], m[4], m[7], 0, m[2], m[5], m[8], 0, 0, 0, 0, 1].join(",") + ")" + (own ? " " + own : "");
  }
  function turn(dx, dy) { M = mul(rx(dy), mul(ry(dx), M)); }
  function step() {
    frame = 0;
    if (!el.isConnected) return;
    if (!held) {
      if (Math.abs(vel[0]) + Math.abs(vel[1]) > 0.00005) { turn(vel[0], vel[1]); vel[0] *= 0.93; vel[1] *= 0.93; }
      else vel = [0, 0];
      if (spin) M = mul(M, ry(0.004));
      else if (back && !vel[0] && !vel[1]) { for (var i = 0; i < 9; i++) M[i] += ((i % 4 === 0 ? 1 : 0) - M[i]) * 0.12; }
    }
    tidy();
    show();
    var home = Math.abs(M[0] - 1) + Math.abs(M[4] - 1) + Math.abs(M[8] - 1) < 1e-4;
    if (spin || held || vel[0] || vel[1] || (back && !home)) frame = requestAnimationFrame(step);
  }
  function wake() { if (!frame) frame = requestAnimationFrame(step); }
  el.style.touchAction = "none";
  if (!el.style.cursor) el.style.cursor = "grab";
  el.addEventListener("pointerdown", function (e) {
    if (e.button > 0) return;
    from = [e.clientX, e.clientY]; dragged = false; vel = [0, 0];
  });
  el.addEventListener("pointermove", function (e) {
    if (!from) return;
    if (!dragged) {
      /* A press that has not gone anywhere is still a press. */
      if (Math.abs(e.clientX - from[0]) + Math.abs(e.clientY - from[1]) < 5) return;
      dragged = true; held = true;
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* turns all the same */ }
      el.style.cursor = "grabbing";
      wake();
    }
    var r = el.getBoundingClientRect(), w = Math.max(80, Math.min(r.width, r.height) || r.width);
    var dx = ((e.clientX - from[0]) / w) * Math.PI * 0.9, dy = ((e.clientY - from[1]) / w) * Math.PI * 0.9;
    from = [e.clientX, e.clientY];
    turn(dx, dy);
    vel = [dx, dy];
    last = Date.now();
  });
  function up() {
    from = null;
    if (!held) return;
    held = false;
    if (Date.now() - last > 90) vel = [0, 0];
    el.style.cursor = "grab";
    wake();
  }
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  /* A drag that turned the part is not also a click on what is in it. */
  el.addEventListener("click", function (e) { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
  el.__turn3dTurn = function () { return M.slice(); };
  if (spin) wake();
});
`,
};
