import type { Work } from "../works.ts";
import { RAISE_JS } from "../raiseJs.ts";

/** Every script starts by asking this. */
export const CALM = `window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches`;

/**
 * THE TRANSITIONS THE PART ALREADY HAS, from the stylesheet. A script that
 * writes an inline `transition` replaces every one the stylesheet gave the
 * part, and the stylesheet is where a captured part keeps the move it makes
 * with the box it sits in (`capturedMotion.ts`: trumpmorty.fun's CA and COPY
 * ends ease back with the CA bar when the pointer leaves). The reveal wrote
 * its own and the ends snapped home while the bar eased, so the bar's white
 * fill showed round them for a fifth of a second. A script adds its own to
 * these, and gives the inline value back when it is done.
 */
export const SHEET_TRANSITION = `function sheetTransition(el) {
    var s = el.style, was = s.transition; s.transition = "";
    var c = getComputedStyle(el), cut = /,\\s*(?![^()]*\\))/;
    var P = c.transitionProperty.split(cut), D = c.transitionDuration.split(cut), T = c.transitionTimingFunction.split(cut), L = c.transitionDelay.split(cut);
    s.transition = was;
    var out = [];
    for (var i = 0; i < P.length; i++) { var d = D[i % D.length]; if (P[i] === "none" || !(parseFloat(d) > 0)) continue; out.push(P[i] + " " + d + " " + T[i % T.length] + " " + L[i % L.length]); }
    return out.join(", ");
  }`;

export const REVEAL: Work = {
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
  ${SHEET_TRANSITION}
  function show() {
    var move = ms + "ms " + ease + " " + delay + "ms", own = sheetTransition(el);
    s.transition = (own ? own + ", " : "") + "opacity " + Math.round(ms * 0.86) + "ms ease " + delay + "ms, translate " + move + (k !== 1 ? ", scale " + move : "");
    s.opacity = was.opacity; s.translate = was.translate; if (k !== 1) s.scale = was.scale;
    setTimeout(function () { if (inputs.origin) s.transformOrigin = was.origin; if (s.opacity === was.opacity) s.transition = was.transition; }, delay + ms + 50);
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

export const COPY: Work = {
  manifest: {
    id: "copy-toast",
    name: "Copy with toast",
    category: "interact",
    blurb: "A click copies the part's words, or the text it was given, and a small toast says so. For contract addresses.",
    inputs: [
      { id: "text", label: "Copies", kind: "text", default: "", placeholder: "the part's own words" },
      { id: "toast", label: "Toast says", kind: "text", default: "Copied" },
      { id: "quiet", label: "No toast of its own (the page's own shows)", kind: "one", default: "no", values: ["yes", "no"], advanced: true },
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
    /* A captured page's own "COPIED!" and toast are its press's to show (\`press-shows\`): none of this one's over them. */
    var quiet = inputs.quiet === "yes";
    p.then(null, function () { return fallback(t); }).then(function () { if (!quiet) toast(say); }, function () { toast("Could not copy"); });
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

export const TILT: Work = {
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
    /* One already inside it (the published page puts a part inside the box that carries it) turns with it as it is. */
    ids.forEach(function (id) { var p = document.getElementById(id) || (el.ownerDocument || document).querySelector('[data-live-node="' + id + '"]'); if (p && p !== el && !el.contains(p)) carried.push(p); });
    var areaId = String(inputs.area || "").trim(), area = areaId ? (document.getElementById(areaId) || document.querySelector('[data-live-node="' + areaId + '"]')) : null;
    var bases = carried.map(function (p) { return { t: p.style.transform, o: p.style.transformOrigin, tr: p.style.transition }; });
    /*
     * All of them on one clock, set when they first move: a reveal still
     * running when this starts writes its own transition and then gives the
     * part's back, and the card was left with none while its words eased,
     * so the card jumped and its words trailed after it.
     */
    function paced() { carried.forEach(function (p) { var t = p.style.transition; if (!/(^|,)\\s*(transform|all)\\b/.test(t)) p.style.transition = (t && t !== "none" ? t + ", " : "") + "transform " + pace + "ms ease-out"; }); }
    function pose(x, y) {
      var ry = axis === "y" ? 0 : x * across, rx = axis === "x" ? 0 : -y * down;
      return "perspective(" + persp + "px) rotateY(" + ry.toFixed(2) + "deg) rotateX(" + rx.toFixed(2) + "deg)" + (lift ? " translateY(" + (-lift) + "px)" : "") + (depth ? " translateZ(" + depth + "px)" : "");
    }
    /* While it tilts it comes up over the parts around it, and goes back under once it has settled. */
    ${RAISE_JS}
    var lower = null, settle = 0;
    function raise() { clearTimeout(settle); if (!lower) lower = raiseOver(carried); }
    function drop() { clearTimeout(settle); settle = setTimeout(function () { if (lower) { lower(); lower = null; } }, pace + 40); }
    if (carried.length === 1 && !area) {
      var box = null;
      el.addEventListener("pointerenter", function () { box = el.getBoundingClientRect(); });
      el.addEventListener("pointermove", function (e) {
        paced();
        raise();
        var r = box || (box = el.getBoundingClientRect());
        s.transform = pose((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5) + (bases[0].t ? " " + bases[0].t : "");
      });
      el.addEventListener("pointerleave", function () { box = null; s.transform = bases[0].t; drop(); });
      return;
    }
    /* Carried parts sit over it and take the pointer: it is watched from the window, over the box it had standing still. */
    var geo = null, on = false;
    function measure() {
      var r = (area || el).getBoundingClientRect(), m = el.getBoundingClientRect();
      var cx = m.left + m.width / 2, cy = m.top + m.height / 2;
      geo = { r: r, sx: window.scrollX, sy: window.scrollY, origins: carried.map(function (p) { var b = p.getBoundingClientRect(), kx = b.width ? p.offsetWidth / b.width : 1, ky = b.height ? p.offsetHeight / b.height : 1; return ((cx - b.left) * kx).toFixed(2) + "px " + ((cy - b.top) * ky).toFixed(2) + "px"; }) };
    }
    function rest() { on = false; carried.forEach(function (p, i) { p.style.transform = bases[i].t; }); drop(); }
    window.addEventListener("pointermove", function (e) {
      if (!on) measure();
      var r = geo.r, dx = window.scrollX - geo.sx, dy = window.scrollY - geo.sy;
      var x = (e.clientX + dx - r.left) / r.width - 0.5, y = (e.clientY + dy - r.top) / r.height - 0.5;
      if (x < -0.5 || x > 0.5 || y < -0.5 || y > 0.5) { if (on) rest(); return; }
      if (!on) { paced(); raise(); }
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

export const FOLLOW: Work = {
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

export const MARQUEE: Work = {
  manifest: {
    id: "marquee",
    name: "Marquee loop",
    category: "motion",
    blurb: "The part's contents run round continuously, like a ticker.",
    inputs: [
      { id: "speed", label: "Speed (px a second)", kind: "number", default: "60" },
      /* Moved by so much every frame the screen draws, as a page's own script does it (trumpmorty.fun's ribbons: 0.6 px): as fast as the original on any screen, 60 Hz or 144 Hz. Set, it is used instead of Speed. */
      { id: "step", label: "Step (px a frame; blank uses Speed)", kind: "number", default: "" },
      { id: "direction", label: "Runs", kind: "one", default: "left", values: ["left", "right"], heard: "\\b(left|right)\\b" },
      { id: "pause", label: "Pause under the mouse", kind: "one", default: "yes", values: ["yes", "no"] },
      { id: "gap", label: "Gap between loops (px)", kind: "number", default: "40" },
      /* Where its words sit in the band they run along (a ribbon): as the page set them, or in its middle, at the size asked. Drawn by the part itself (blocks.tsx#bandOf), so the board shows it too. */
      { id: "middle", label: "Centre in its band", kind: "one", default: "no", values: ["no", "yes"] },
      { id: "size", label: "Text size (px; blank keeps it)", kind: "number", default: "", advanced: true },
      { id: "boost", label: "Scroll boost (px a frame, per px scrolled a frame)", kind: "number", default: "0" },
      { id: "cap", label: "Scroll boost at most (px a frame)", kind: "number", default: "14" },
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
  /* By the frame: stepped in a frame loop of its own, the scroll's boost added to each step, wrapped at one copy's width. */
  var perFrame = Number(inputs.step), byFrame = inputs.step !== "" && inputs.step !== undefined && isFinite(perFrame) && perFrame > 0, loopW = 1, fx = 0;
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
    loopW = Math.max(1, w);
    if (byFrame) return;
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
  if (byFrame) {
    var fbox = null;
    for (var fq = el.parentElement; fq && fq !== document.body; fq = fq.parentElement) { var fov = getComputedStyle(fq).overflowY; if ((fov === "auto" || fov === "scroll") && fq.scrollHeight > fq.clientHeight) { fbox = fq; break; } }
    var fy0 = fbox ? fbox.scrollTop : window.scrollY, fvel = 0, dir = right ? 1 : -1;
    (function run() {
      if (!el.isConnected) return;
      var y = fbox ? fbox.scrollTop : window.scrollY;
      fvel = fvel * 0.9 + (y - fy0) * 0.1; fy0 = y;
      if (!held) {
        fx += dir * (perFrame + Math.min(Math.abs(fvel) * boost, cap));
        if (fx <= -loopW) fx += loopW; else if (fx > 0) fx -= loopW;
        track.style.transform = "translateX(" + fx + "px)";
      }
      requestAnimationFrame(run);
    })();
    return;
  }
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
