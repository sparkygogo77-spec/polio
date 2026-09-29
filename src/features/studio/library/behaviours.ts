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
      { id: "scale", label: "Starts at scale", kind: "number", default: "1", advanced: true },
      { id: "duration", label: "Takes (ms)", kind: "number", default: "700", advanced: true },
      { id: "ease", label: "Curve", kind: "text", default: "cubic-bezier(.2,.8,.2,1)", advanced: true },
      { id: "origin", label: "Scales about", kind: "text", default: "", placeholder: "its own centre", advanced: true },
      { id: "after", label: "Starts", kind: "one", default: "page", values: ["page", "loader"], advanced: true },
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
  var k = Number(inputs.scale); if (!isFinite(k) || k <= 0 || inputs.scale === "" || inputs.scale === undefined) k = 1;
  var ms = Number(inputs.duration); if (!isFinite(ms) || ms <= 0) ms = 700;
  var ease = /^[\\w\\s.,()-]+$/.test(inputs.ease || "") ? inputs.ease : "cubic-bezier(.2,.8,.2,1)";
  var delay = Math.max(0, Number(inputs.delay) || 0), once = inputs.once !== "no", s = el.style;
  var was = { opacity: s.opacity, translate: s.translate, scale: s.scale, transition: s.transition, origin: s.transformOrigin };
  function hide() { s.transition = "none"; s.opacity = "0"; s.translate = from; if (k !== 1) { s.scale = String(k); if (inputs.origin) s.transformOrigin = inputs.origin; } }
  function show() {
    var move = ms + "ms " + ease + " " + delay + "ms";
    s.transition = "opacity " + Math.round(ms * 0.86) + "ms ease " + delay + "ms, translate " + move + (k !== 1 ? ", scale " + move : "");
    s.opacity = was.opacity; s.translate = was.translate; if (k !== 1) s.scale = was.scale;
    if (inputs.origin) setTimeout(function () { s.transformOrigin = was.origin; }, delay + ms + 50);
  }
  /* Set to start after the loader: held until the tuning screen has gone. */
  function when(go) { if (inputs.after !== "loader") return go(); (function wait() { if (document.querySelector("[data-crt]")) setTimeout(wait, 80); else go(); })(); }
  hide();
  var io = new IntersectionObserver(function (seen) {
    for (var i = 0; i < seen.length; i++) {
      if (seen[i].isIntersecting) { when(show); if (once) io.disconnect(); }
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
      { id: "across", label: "Turns across (degrees over the whole part)", kind: "number", default: "", placeholder: "twice the strength", advanced: true },
      { id: "down", label: "Turns down (degrees over the whole part)", kind: "number", default: "", placeholder: "twice the strength", advanced: true },
      { id: "lift", label: "Rises (px) while tilted", kind: "number", default: "0", advanced: true },
      { id: "depth", label: "Comes forward (px) while tilted", kind: "number", default: "0", advanced: true },
      { id: "perspective", label: "Perspective (px)", kind: "number", default: "800", advanced: true },
      { id: "pace", label: "Follows in (ms)", kind: "number", default: "250", advanced: true },
      { id: "parts", label: "Carries (the parts on it)", kind: "text", default: "", placeholder: "part ids, comma-separated", advanced: true },
      { id: "area", label: "Watches the pointer over", kind: "text", default: "", placeholder: "the part itself", advanced: true },
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
    var num = function (v, d) { var n = Number(v); return v === "" || v === undefined || v === null || !isFinite(n) ? d : n; };
    var across = num(inputs.across, 2 * k), down = num(inputs.down, 2 * k), lift = num(inputs.lift, 0), depth = num(inputs.depth, 0);
    var persp = Math.max(100, num(inputs.perspective, 800)), pace = Math.max(0, num(inputs.pace, 250));
    /* The parts it carries turn with it, about its middle, so a thing drawn as several parts (a TV and its screen, knobs and words) turns whole. */
    var ids = String(inputs.parts || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    var carried = [el];
    ids.forEach(function (id) { var p = document.getElementById(id) || (el.ownerDocument || document).querySelector('[data-live-node="' + id + '"]'); if (p && p !== el) carried.push(p); });
    var areaId = String(inputs.area || "").trim(), area = areaId ? (document.getElementById(areaId) || document.querySelector('[data-live-node="' + areaId + '"]')) : null;
    var bases = carried.map(function (p) { return { t: p.style.transform, o: p.style.transformOrigin, tr: p.style.transition }; });
    carried.forEach(function (p) { if (!p.style.transition) p.style.transition = "transform " + pace + "ms ease-out"; });
    function pose(x, y) {
      var ry = axis === "y" ? 0 : x * across, rx = axis === "x" ? 0 : -y * down;
      return "perspective(" + persp + "px) rotateY(" + ry.toFixed(2) + "deg) rotateX(" + rx.toFixed(2) + "deg)" + (lift ? " translateY(" + (-lift) + "px)" : "") + (depth ? " translateZ(" + depth + "px)" : "");
    }
    if (carried.length === 1 && !area) {
      var box = null;
      el.addEventListener("pointerenter", function () { box = el.getBoundingClientRect(); });
      el.addEventListener("pointermove", function (e) {
        var r = box || (box = el.getBoundingClientRect());
        s.transform = pose((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5) + (bases[0].t ? " " + bases[0].t : "");
      });
      el.addEventListener("pointerleave", function () { box = null; s.transform = bases[0].t; });
      return;
    }
    /* Carried parts sit over it and take the pointer: it is watched from the window, over the box it had standing still. */
    var geo = null, on = false;
    function measure() {
      var r = (area || el).getBoundingClientRect(), m = el.getBoundingClientRect();
      var cx = m.left + m.width / 2, cy = m.top + m.height / 2;
      geo = { r: r, sx: window.scrollX, sy: window.scrollY, origins: carried.map(function (p) { var b = p.getBoundingClientRect(), kx = b.width ? p.offsetWidth / b.width : 1, ky = b.height ? p.offsetHeight / b.height : 1; return ((cx - b.left) * kx).toFixed(2) + "px " + ((cy - b.top) * ky).toFixed(2) + "px"; }) };
    }
    function rest() { on = false; carried.forEach(function (p, i) { p.style.transform = bases[i].t; }); }
    window.addEventListener("pointermove", function (e) {
      if (!on) measure();
      var r = geo.r, dx = window.scrollX - geo.sx, dy = window.scrollY - geo.sy;
      var x = (e.clientX + dx - r.left) / r.width - 0.5, y = (e.clientY + dy - r.top) / r.height - 0.5;
      if (x < -0.5 || x > 0.5 || y < -0.5 || y > 0.5) { if (on) rest(); return; }
      on = true;
      var t = pose(x, y);
      carried.forEach(function (p, i) { p.style.transformOrigin = geo.origins[i]; p.style.transform = t + (bases[i].t ? " " + bases[i].t : ""); });
    }, { passive: true });
    document.addEventListener("mouseleave", rest);
    window.addEventListener("scroll", function () { if (on) rest(); }, { passive: true });
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
    blurb: "The part moves, or turns, toward the cursor, never further than its travel: an eye's pupil that watches. As a layer, it shifts with the pointer's place in the window and with the scroll: parallax.",
    inputs: [
      { id: "travel", label: "Max travel (px)", kind: "number", default: "12", heard: "(\\d+)\\s*px\\b" },
      { id: "how", label: "How", kind: "one", default: "move", values: ["move", "turn", "layer"], heard: "\\b(turn|rotate|layer)s?\\b" },
      { id: "x", label: "As a layer: across (px over the window)", kind: "number", default: "-20", advanced: true },
      { id: "y", label: "As a layer: down (px over the window)", kind: "number", default: "-10", advanced: true },
      { id: "scroll", label: "As a layer: with the scroll (px a px)", kind: "number", default: "0", advanced: true },
      { id: "ease", label: "As a layer: catch-up a frame (0 to 1)", kind: "number", default: "0.06", advanced: true },
    ],
    needs: "none",
    says: ["follow the pointer", "follow the mouse", "follow the cursor", "follows cursor", "eye follows cursor", "look at the cursor", "watch the mouse", "pupil", "pointer parallax", "mouse parallax"],
    look: { sample: "◉ →", caption: "follows the pointer" },
    version: 1,
  },
  script: `siteFeatures.define("follow-pointer", function (el, inputs) {
  if (${CALM}) return;
  var s = el.style;
  if (inputs.how === "layer") {
    var num = function (v, d) { var n = Number(v); return v === "" || v === undefined || !isFinite(n) ? d : n; };
    var kx = num(inputs.x, -20), ky = num(inputs.y, -10), ks = num(inputs.scroll, 0), e = Math.min(1, Math.max(0.01, num(inputs.ease, 0.06)));
    /* The page scrolls the window, or, in a preview, the box it stands in. */
    var box = null;
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) { var o = getComputedStyle(p).overflowY; if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) { box = p; break; } }
    var mx = 0, my = 0, cx = 0, cy = 0, me = {};
    /* Run again on the same part (a preview drawn again), the newer run is the one that moves it. */
    el.__follow = me;
    window.addEventListener("pointermove", function (ev) { mx = ev.clientX / window.innerWidth - 0.5; my = ev.clientY / window.innerHeight - 0.5; }, { passive: true });
    (function frame() {
      if (!el.isConnected || el.__follow !== me) return;
      cx += (mx - cx) * e; cy += (my - cy) * e;
      var y = box ? box.scrollTop : window.scrollY;
      s.translate = (cx * kx).toFixed(2) + "px " + (cy * ky + y * ks).toFixed(2) + "px";
      requestAnimationFrame(frame);
    })();
    return;
  }
  var travel = Math.max(0, Number(inputs.travel)); if (!isFinite(travel) || inputs.travel === "") travel = 12;
  var turn = /turn|rotate/.test(inputs.how || ""), cxx = 0, cyy = 0;
  if (!s.transition) s.transition = turn ? "rotate .15s ease-out" : "translate .12s ease-out";
  function to(x, y) {
    var r = el.getBoundingClientRect();
    var ox = r.left + r.width / 2 - cxx, oy = r.top + r.height / 2 - cyy;
    var dx = x - ox, dy = y - oy, d = Math.sqrt(dx * dx + dy * dy);
    if (turn) { s.rotate = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1) + "deg"; return; }
    var m = d ? travel * Math.min(1, d / 160) / d : 0;
    cxx = dx * m; cyy = dy * m;
    s.translate = cxx.toFixed(2) + "px " + cyy.toFixed(2) + "px";
  }
  window.addEventListener("pointermove", function (e) { to(e.clientX, e.clientY); }, { passive: true });
  document.addEventListener("mouseleave", function () { cxx = cyy = 0; s.translate = ""; });
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
      { id: "boost", label: "Speeds up with the scroll (px a frame, per px scrolled a frame)", kind: "number", default: "0", advanced: true },
      { id: "cap", label: "Speeds up by at most (px a frame)", kind: "number", default: "14", advanced: true },
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
  /* A part drawn turned or cut (a ribbon's words, tilted, seen through the ribbon's window) keeps its box, turn and window still: only the words inside it run, clipped in their own frame. Sliding the whole part slid its window off the ribbon, and a clip on the untilted box outside cut the tilted words level. */
  var host = el;
  for (var q = el; q && q.children.length === 1; q = q.children[0]) {
    var qs = getComputedStyle(q);
    if (q !== el && ((qs.transform && qs.transform !== "none") || (qs.clipPath && qs.clipPath !== "none"))) { host = q.children[0]; break; }
  }
  var track = document.createElement("div"), one = document.createElement("div");
  track.setAttribute("data-marquee-track", "");
  track.style.cssText = "display:flex;width:max-content;height:100%;align-items:center;white-space:nowrap;will-change:transform";
  one.style.cssText = "display:flex;flex:none;align-items:center;padding-right:" + gap + "px";
  while (host.firstChild) one.appendChild(host.firstChild);
  track.appendChild(one); host.appendChild(track);
  host.style.overflow = "hidden";
  var anim = null, held = false;
  function build() {
    while (track.children.length > 1) track.removeChild(track.lastChild);
    var w = one.offsetWidth || one.getBoundingClientRect().width, need = Math.max(1, Math.ceil(host.clientWidth / Math.max(1, w)));
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
  /* The scroll hurries it: its step a frame is its own plus the scroll's pace (eased, as the page measured it) times the boost, never more than the cap. */
  var boost = Math.max(0, Number(inputs.boost) || 0), cap = Math.max(0, Number(inputs.cap)); if (!isFinite(cap) || inputs.cap === "" || inputs.cap === undefined) cap = 14;
  if (boost > 0) {
    var sbox = null;
    for (var q = el.parentElement; q && q !== document.body; q = q.parentElement) { var ov = getComputedStyle(q).overflowY; if ((ov === "auto" || ov === "scroll") && q.scrollHeight > q.clientHeight) { sbox = q; break; } }
    var y0 = sbox ? sbox.scrollTop : window.scrollY, vel = 0, step = speed / 60;
    (function hurry() {
      if (!el.isConnected) return;
      var y = sbox ? sbox.scrollTop : window.scrollY;
      vel = vel * 0.9 + (y - y0) * 0.1; y0 = y;
      var rate = (step + Math.min(Math.abs(vel) * boost, cap)) / step;
      if (anim && Math.abs(anim.playbackRate - rate) > 0.01) anim.playbackRate = rate;
      requestAnimationFrame(hurry);
    })();
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

const SCROLL_HEADER: Work = {
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

const BLINK: Work = {
  manifest: {
    id: "blink",
    name: "Blink",
    category: "motion",
    blurb: "The part blinks on and off, like a LIVE light: in two steps, or fading.",
    inputs: [
      { id: "every", label: "Every (seconds)", kind: "number", default: "1" },
      { id: "how", label: "How", kind: "one", default: "steps", values: ["steps", "fade"], heard: "\\b(fade|fades|fading)\\b" },
    ],
    needs: "none",
    says: ["blink", "blinking", "blinking light", "live dot", "flash", "flashing", "on air light"],
    look: { sample: "● LIVE", caption: "blink" },
    version: 1,
  },
  script: `siteFeatures.define("blink", function (el, inputs) {
  if (${CALM} || !el.animate) return;
  var t = Number(inputs.every); if (!isFinite(t) || t <= 0) t = 1;
  var frames = inputs.how === "fade"
    ? [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }]
    : [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }];
  el.animate(frames, { duration: t * 1000, iterations: Infinity, easing: inputs.how === "fade" ? "ease-in-out" : "linear" });
});
`,
};


/* ------------------------------------------------------------------ */
/* Motion sampled from a page (sink docs/behaviours.md, "Motion        */
/* sampled"): what it did at rest, under the pointer and as it scrolled */
/* ------------------------------------------------------------------ */

const SPIN: Work = {
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

const FLOAT: Work = {
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

const HOVER_LIFT: Work = {
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
  s.transition = (was.transition ? was.transition + ", " : "") + "translate " + ms + "ms ease, rotate " + ms + "ms ease, scale " + ms + "ms ease";
  el.addEventListener("pointerenter", function () { s.translate = x + "px " + (-lift) + "px"; if (turn) s.rotate = turn + "deg"; if (k !== 1) s.scale = String(k); });
  el.addEventListener("pointerleave", function () { s.translate = was.translate; s.rotate = was.rotate; s.scale = was.scale; });
});
`,
};

const SCROLL_GROW: Work = {
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

/** The behaviours, in shelf order. */
/*
 * WHAT A PRESS SHOWS (sink `behaviours.states`): a row of cards that each
 * open their own panel, a device's buttons that each change its screen.
 * The capture pressed each and kept what changed as parts of their own,
 * marked `state` and not drawn where the page opens. A press anywhere on
 * this part (its words and pictures are parts of their own, laid over it)
 * shows its parts and hides the page's own that they stand in for, and puts
 * back whatever another press of the same group showed. The card chosen as
 * the page opens is a press too (sink's opening press, `opening: true`): it
 * shows the page's own parts, so it can be chosen again. Nothing is fetched
 * and nothing is kept: a press shows what the page showed when it was
 * captured.
 */
const PRESS_SHOWS: Work = {
  manifest: {
    id: "press-shows",
    name: "Show on press",
    category: "interact",
    blurb: "A press on the part shows the parts its page showed for it (a card's panel, a button's screen) in place of the others of its group.",
    inputs: [
      { id: "shows", label: "Shows (parts)", kind: "text", default: "", placeholder: "part ids, comma-separated" },
      { id: "hides", label: "In place of (parts)", kind: "text", default: "", placeholder: "part ids, comma-separated", advanced: true },
      { id: "group", label: "Group", kind: "text", default: "", placeholder: "presses that take turns", advanced: true },
      { id: "opening", label: "The page as it opens", kind: "one", default: "no", values: ["yes", "no"], advanced: true },
    ],
    needs: "none",
    says: ["show on press", "tabs", "switch panel", "select card", "choose one", "press to show", "click to show"],
    look: { sample: "▣ ▢ ▢ → panel", caption: "press · shows" },
    version: 1,
  },
  script: `siteFeatures.define("press-shows", function (el, inputs) {
  var root = el.ownerDocument || document;
  var find = function (id) { return root.getElementById(id) || root.querySelector('[data-live-node="' + id + '"]'); };
  var ids = function (v) { return String(v || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); };
  var all = window.__pressShows || (window.__pressShows = {});
  var key = String(inputs.group || "").trim() || ("own:" + Math.random());
  var group = all[key] || (all[key] = []);
  /* The opening press shows the page's own parts: another press undoing it leaves them showing, and hides only what it says it hides. */
  var me = { el: el, shows: ids(inputs.shows), hides: ids(inputs.hides), opening: String(inputs.opening || "") === "yes" };
  group.push(me);
  /* A picture that plays (a screen's frames, as an svg) plays from the press: shown, it is asked for again under a new fragment, which starts its clock. */
  var isSvg = function (src) { return /[.]svg([#?]|$)/i.test(src) || src.indexOf("data:image/svg") === 0; };
  var replay = function (p) { try { Array.prototype.forEach.call(p.querySelectorAll("img"), function (im) { var src = im.getAttribute("src") || ""; if (isSvg(src)) im.setAttribute("src", src.split("#")[0] + "#p" + Date.now()); }); } catch (e) { /* a picture never stops the press */ } };
  var set = function (list, on) { list.forEach(function (id) { var p = find(id); if (!p) return; p.style.display = on ? "flex" : "none"; if (on) replay(p); }); };
  function press() {
    group.forEach(function (o) { if (o !== me) { set(o.shows, o.opening); set(o.hides, true); } });
    set(me.hides, false);
    set(me.shows, true);
  }
  /* The part's words and pictures sit over it as parts of their own: a press anywhere inside its box is its press. */
  root.addEventListener("click", function (e) {
    var r = el.getBoundingClientRect();
    if (!(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)) return;
    var t = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (t) return;
    press();
  });
  el.style.cursor = "pointer";
});
`,
};

export const BEHAVIOURS: Work[] = [REVEAL, COPY, TILT, FOLLOW, MARQUEE, EMBED, CRT, DUST, SCROLL_HEADER, BLINK, SPIN, FLOAT, HOVER_LIFT, SCROLL_GROW, PRESS_SHOWS];

/** The ones that move on their own, with nobody touching anything: the only ones the board plays (live/runWorks.ts). */
export const AMBIENT = ["spin", "float", "dust-canvas"] as const;
