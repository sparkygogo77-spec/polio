import type { Work } from "../works.ts";
import { CALM, SHEET_TRANSITION } from "./motion.ts";

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
  /* On the rotate property, added to any turn the part has of its own. */
  el.animate([{ rotate: "0deg" }, { rotate: turn }], { duration: t * 1000, iterations: Infinity, easing: "linear", composite: "add" });
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
  /* On the translate property, added to wherever else the part is moved (a layer following the pointer). */
  el.animate([{ translate: "0px 0px", easing: ease }, { translate: out, easing: ease, offset: 0.5 }, { translate: "0px 0px" }], { duration: t * 1000, iterations: Infinity, composite: "add" });
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
