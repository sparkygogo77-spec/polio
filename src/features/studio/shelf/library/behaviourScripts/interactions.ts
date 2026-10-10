import type { Work } from "../works.ts";
import { STAGE_ENGINE } from "../stageEngine.ts";
import { CALM } from "./motion.ts";

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
export const PRESS_SHOWS: Work = {
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
      { id: "timing", label: "How long each shows, and where it comes in from", kind: "text", default: "", placeholder: '[{"part":"n_1","lasts":1600,"from":{"y":220}}]', advanced: true },
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
  /* The page ends at the foot of what it opens with (live/layout.ts): a part shown lower makes it longer, so it is never cut off. */
  var grow = function (p) {
    var page = p.closest && p.closest("[data-live-root]");
    if (!page) return;
    var r = p.getBoundingClientRect(), g = page.getBoundingClientRect(), k = page.offsetHeight / (g.height || 1);
    var foot = Math.ceil((r.bottom - g.top) * k);
    if (foot > page.offsetHeight) page.style.height = foot + "px";
  };
  var set = function (list, on) { list.forEach(function (id) { var p = find(id); if (!p) return; p.style.display = on ? "flex" : "none"; if (on) { replay(p); grow(p); } }); };
  function press() {
    group.forEach(function (o) { if (o !== me) { set(o.shows, o.opening); set(o.hides, true); } });
    set(me.hides, false);
    set(me.shows, true);
    flash();
  }
  /*
   * WHAT A PRESS FLASHES (sink presses.mjs): trumpmorty.fun's CA bar turns
   * its label to "COPIED!" for 1600 ms and slides a toast up from below the
   * window for 1900 ms. Each part the press showed or stood in for goes
   * back after its own time (\`lasts\`, from the press); one that came in
   * from somewhere (\`from\`: a move and an opacity) comes that way, over the
   * transition the page gave it, and leaves the same way back.
   */
  var timing = [];
  try { timing = JSON.parse(String(inputs.timing || "[]")); if (!Array.isArray(timing)) timing = []; } catch (e) { timing = []; }
  var calm = ${CALM};
  var ease = function (p) {
    var box = p.querySelector(".mo") || p, c = getComputedStyle(box), cut = /,\\s*(?![^()]*\\))/;
    var P = c.transitionProperty.split(cut), D = c.transitionDuration.split(cut), T = c.transitionTimingFunction.split(cut);
    for (var i = 0; i < P.length; i++) if (P[i] === "transform" || P[i] === "translate" || P[i] === "all") return { ms: parseFloat(D[i % D.length]) * (/ms$/.test(D[i % D.length]) ? 1 : 1000) || 300, curve: T[i % T.length] };
    return { ms: 300, curve: "ease" };
  };
  var come = function (p, from, back, done) {
    if (calm || !p.animate) { if (done) done(); return; }
    var e = ease(p), a = { translate: (Number(from.x) || 0) + "px " + (Number(from.y) || 0) + "px", opacity: from.opacity == null ? 1 : Number(from.opacity) }, z = { translate: "0px 0px", opacity: 1 };
    var run = p.animate(back ? [z, a] : [a, z], { duration: e.ms, easing: e.curve, fill: back ? "forwards" : "none" });
    run.onfinish = function () { if (done) done(); if (back) run.cancel(); };
  };
  function flash() {
    timing.forEach(function (t) {
      var p = t && find(String(t.part || ""));
      if (!p) return;
      var shown = me.shows.indexOf(t.part) >= 0;
      if (shown && t.from) come(p, t.from, false);
      clearTimeout(p.__flash);
      var ms = Number(t.lasts);
      if (!(ms >= 0)) return;
      p.__flash = setTimeout(function () {
        if (!shown) { p.style.display = "flex"; return; }
        if (t.from) come(p, t.from, true, function () { p.style.display = "none"; }); else p.style.display = "none";
      }, ms);
    });
  }
  /*
   * The part's words and pictures sit over it as parts of their own: a press anywhere inside its box is its press.
   * Another press may hide the part itself and show a copy in its place (gotchi.gg's mochi card, untilted once pup is chosen):
   * a press where it last stood is still its press, so the card chosen as the page opens can be chosen again.
   */
  var last = null;
  var boxOf = function () {
    var r = el.getBoundingClientRect(), sx = window.scrollX || 0, sy = window.scrollY || 0;
    if (r.right > r.left && r.bottom > r.top) { last = { left: r.left + sx, top: r.top + sy, right: r.right + sx, bottom: r.bottom + sy }; return r; }
    return last ? { left: last.left - sx, top: last.top - sy, right: last.right - sx, bottom: last.bottom - sy } : r;
  };
  boxOf();
  root.addEventListener("click", function (e) {
    var r = boxOf();
    if (!(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)) return;
    var t = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (t) return;
    press();
  });
  el.style.cursor = "pointer";
});
`,
};

/*
 * HOW A PAGE GOES TO ITS OWN PLACES (sink glide.mjs, `behaviours.glide`).
 * trumpmorty.fun's nav and remote keys glide to their sections by its
 * script, over `min(1600, 500 + distance × 0.25)` ms on an ease-in-out
 * cubic, a header's height short; a copy that jumped there was another
 * page. A link that goes to a part of this page glides the same way: the
 * time for its distance, the page's own curve (named, or as the shape the
 * capture measured), and where it stops against the place. A page that
 * glided by its stylesheet (`scroll-behavior: smooth`) gets that back.
 */
export const GLIDE: Work = {
  manifest: {
    id: "glide",
    name: "Glide to its place",
    category: "motion",
    blurb: "A link to a place on the page scrolls there smoothly, over the time and curve the page itself took.",
    inputs: [
      { id: "to", label: "Goes to (part)", kind: "text", default: "", placeholder: "the part the link goes to" },
      { id: "how", label: "How", kind: "one", default: "script", values: ["script", "css"], advanced: true },
      { id: "base", label: "Takes (ms)", kind: "number", default: "600" },
      { id: "perPx", label: "And per px of distance (ms)", kind: "number", default: "0", advanced: true },
      { id: "max", label: "At most (ms)", kind: "number", default: "", advanced: true },
      { id: "ease", label: "Curve", kind: "one", default: "ease-in-out-cubic", values: ["ease-in-out-cubic", "ease-in-out-quad", "ease-in-out-quart", "ease-in-out-sine", "ease-out-quad", "ease-out-cubic", "ease-out-quart", "ease-out-expo", "linear", "measured"], advanced: true },
      { id: "curve", label: "The measured curve", kind: "text", default: "", placeholder: "21 shares of the distance, comma-separated", advanced: true },
      { id: "offset", label: "Stops short of the place (px)", kind: "number", default: "0", advanced: true },
    ],
    needs: "none",
    says: ["smooth scroll", "scroll smoothly", "glide to section", "smooth anchor", "scroll to section"],
    look: { sample: "↧ glide", caption: "in-page link · glide" },
    version: 1,
  },
  script: `siteFeatures.define("glide", function (el, inputs) {
  var root = el.ownerDocument || document;
  if (inputs.how === "css") { root.documentElement.style.scrollBehavior = ${CALM} ? "auto" : "smooth"; return; }
  var to = String(inputs.to || "").trim();
  var num = function (v, d) { var n = Number(v); return v === "" || v == null || !isFinite(n) ? d : n; };
  var E = {
    "linear": function (p) { return p; },
    "ease-in-out-quad": function (p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; },
    "ease-in-out-cubic": function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; },
    "ease-in-out-quart": function (p) { return p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2; },
    "ease-in-out-sine": function (p) { return -(Math.cos(Math.PI * p) - 1) / 2; },
    "ease-out-quad": function (p) { return 1 - (1 - p) * (1 - p); },
    "ease-out-cubic": function (p) { return 1 - Math.pow(1 - p, 3); },
    "ease-out-quart": function (p) { return 1 - Math.pow(1 - p, 4); },
    "ease-out-expo": function (p) { return p >= 1 ? 1 : 1 - Math.pow(2, -10 * p); }
  };
  var pts = String(inputs.curve || "").split(",").map(Number).filter(isFinite);
  var shape = E[inputs.ease] || (pts.length > 2 ? function (p) { var x = p * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x)); return pts[i] + (pts[i + 1] - pts[i]) * (x - i); } : E["ease-in-out-cubic"]);
  var scroller = function (n) { for (var a = n && n.parentElement; a && a !== root.body && a !== root.documentElement; a = a.parentElement) { var o = getComputedStyle(a).overflowY; if ((o === "auto" || o === "scroll") && a.scrollHeight > a.clientHeight) return a; } return null; };
  el.addEventListener("click", function (e) {
    var t = to && (root.getElementById(to) || root.querySelector('[data-live-node="' + to + '"]'));
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    var box = scroller(t), win = root.defaultView || window;
    var now = box ? box.scrollTop : win.scrollY, view = box ? box.clientHeight : win.innerHeight;
    var most = (box ? box.scrollHeight : root.documentElement.scrollHeight) - view;
    var top = t.getBoundingClientRect().top - (box ? box.getBoundingClientRect().top : 0) + now;
    var y = Math.max(0, Math.min(most, top + num(inputs.offset, 0))), dist = y - now;
    var go = function (v) { if (box) box.scrollTop = v; else win.scrollTo(0, v); };
    if (${CALM} || !dist) { go(y); return; }
    var ms = num(inputs.base, 600) + num(inputs.perPx, 0) * Math.abs(dist), cap = num(inputs.max, 0);
    if (cap > 0) ms = Math.min(cap, ms);
    var t0 = performance.now();
    (function step(n) { var p = Math.min(1, (n - t0) / ms); go(now + dist * shape(p)); if (p < 1) requestAnimationFrame(step); })(t0);
  });
});
`,
};

/*
 * A CANVAS WORLD'S DIALOGS (parts/World.tsx, sink worlds.mjs). The part draws
 * a press area over each character and the dialogs they open, closed; this
 * opens one on a press and closes it by its close control, Escape (the
 * browser's own, for a modal dialog) or a press outside it. Inside, each
 * control does what sink saw it do on the page (`data-world-does`): goes
 * where it went when that is a page of the site (never off it), copies what
 * it copied, or changes the dialog as it
 * did (a preset filling the amount, a tab, a side switch). One that needed a
 * wallet or a server (`data-world-does="hook"`, what was seen in
 * `data-world-hook`) does nothing until a backend wires it by its
 * `data-world-control`; a form in a dialog is never sent. Links are links. The flipbook's clock and
 * the areas' walk are started together, so each area stays on its character.
 */
export const WORLD_DIALOGS: Work = {
  manifest: {
    id: "world-dialogs",
    name: "Characters open their dialogs",
    category: "interact",
    blurb: "A press on a character walking in a captured canvas world opens its dialog, as the page did; Escape, the close button or a press outside closes it. Inside, each control does what it did on the page (a link within the site, a copy, a toggle or preset); one that needed a wallet or a server, or went off the site, waits for a backend.",
    inputs: [],
    needs: "none",
    says: ["press a character", "click a pet", "character dialog", "open its dialog", "clickable characters"],
    look: { sample: "🐾 → ▣", caption: "press · dialog" },
    version: 1,
  },
  script: `${STAGE_ENGINE}
siteFeatures.define("world-dialogs", function (el) {
  var layer = el.querySelector("[data-part-world]");
  if (!layer || layer.hasAttribute("data-world-on")) return;
  layer.setAttribute("data-world-on", "");
  var hits = function () { return Array.prototype.slice.call(layer.querySelectorAll("[data-world-hit]")); };
  /* Both clocks from the same moment: the flipbook asked for again (an svg's animation starts when it loads), and the areas' walk from nought as it arrives. */
  var sync = function () { hits().forEach(function (h) { try { (h.getAnimations ? h.getAnimations() : []).forEach(function (a) { a.currentTime = 0; }); } catch (e) { /* the walk goes on as it is */ } }); };
  /* A sprite world: drawn again live by its engine, which places the press areas itself; its scenes switched by the page's own tabs. */
  var stageJson = layer.querySelector("script[data-world-stage]");
  if (stageJson) {
    var stageData = null; try { stageData = JSON.parse(stageJson.textContent || "{}"); } catch (x) { stageData = null; }
    var stage = stageData ? runStage(layer, stageData) : null;
    /* A tab's words are a part of their own over its button: a press anywhere in the tab's box is the tab's. */
    if (stage) (stageData.scenes || []).forEach(function (sc, i) {
      if (!sc.tab) return;
      var root = el.ownerDocument || document, t = root.getElementById(sc.tab) || root.querySelector('[data-live-node="' + sc.tab + '"]');
      if (!t) { try { t = root.querySelector(sc.tab); } catch (x) { t = null; } }
      if (!t) return;
      t.style.cursor = "pointer";
      root.addEventListener("click", function (e) {
        var r = t.getBoundingClientRect();
        if (r.width && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) stage.setScene(i);
      });
    });
  }
  var img = stageJson ? null : el.querySelector("img");
  if (img) {
    var src = img.getAttribute("src") || "";
    if (/[.]svg([#?]|$)/i.test(src) || src.indexOf("data:image/svg") === 0) {
      img.addEventListener("load", sync, { once: true });
      img.setAttribute("src", src.split("#")[0] + "#w" + Date.now());
    }
  }
  sync();
  var dialogOf = function (k) { return layer.querySelector('dialog[data-world-dialog="' + k + '"]'); };
  layer.addEventListener("click", function (e) {
    var t = e.target;
    var hit = t && t.closest ? t.closest("[data-world-open]") : null;
    if (hit && layer.contains(hit)) {
      e.preventDefault();
      var d = dialogOf(hit.getAttribute("data-world-open"));
      if (d && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); }
      return;
    }
    var d2 = t && t.closest ? t.closest("dialog[data-world-dialog]") : null;
    if (!d2) return;
    var close = function () { if (d2.close) d2.close(); else d2.removeAttribute("open"); };
    if (t.closest("[data-world-close]")) { e.preventDefault(); close(); return; }
    /* What the control did on the page, done again; a hook (a wallet, a server) waits for a backend and does nothing. */
    var c = t.closest("[data-world-does]");
    if (c && d2.contains(c)) {
      var does = c.getAttribute("data-world-does");
      if (does === "native") return;
      e.preventDefault();
      if (does === "close") { close(); return; }
      if (does === "link") {
        var href = c.getAttribute("data-world-href");
        /* A place on this site, or an address the site's allow-list lets through (marked when the part was drawn). */
        if (href && (c.hasAttribute("data-world-allowed") || !/^([a-z][a-z0-9+.-]*:|\\/\\/)/i.test(href))) { if (c.getAttribute("data-world-target") === "_blank") window.open(href, "_blank", "noopener"); else window.location.href = href; }
        return;
      }
      /* The site's own address, copied as this site's (where it is published), not the one it was captured at. */
      if (does === "copy") { var own = c.getAttribute("data-world-copy-path"); copy(own ? new URL(own, window.location.href).href : c.getAttribute("data-world-copy") || ""); return; }
      /* Share of the site's own page (allowed by \`share:own\`): the machine's share sheet, else the link copied. */
      if (does === "share") {
        var sh = {}; try { sh = JSON.parse(c.getAttribute("data-world-share") || "{}"); } catch (x) { sh = {}; }
        var url = sh.url && !/^([a-z][a-z0-9+.-]*:|\\/\\/)/i.test(sh.url) ? new URL(sh.url, window.location.href).href : window.location.href;
        var data = { title: sh.title || document.title, text: sh.text || "", url: url };
        if (navigator.share) navigator.share(data).catch(function () {}); else copy(url);
        return;
      }
      if (does === "ui") { replay(d2, c.getAttribute("data-world-change")); return; }
      return;
    }
    /* A press on the dialog itself and not on anything in it: outside its box is the backdrop. */
    if (t === d2) {
      var r = d2.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
    }
  });
  /* A change a press made on the page: each element it touched, by its place, given its attributes, look, words and value after. */
  function replay(d, json) {
    var list = []; try { list = JSON.parse(json || "[]"); } catch (x) { list = []; }
    list.forEach(function (ch) {
      var el = d.querySelector('[data-world-el="' + ch.e + '"]');
      if (!el) return;
      if (ch.a) Object.keys(ch.a).forEach(function (k) { if (/^on/i.test(k)) return; if (ch.a[k] === null) el.removeAttribute(k); else el.setAttribute(k, ch.a[k]); });
      if (typeof ch.c === "string") el.setAttribute("class", ch.c);
      if (typeof ch.t === "string" && !el.children.length) el.textContent = ch.t;
      if (typeof ch.v === "string" && "value" in el) el.value = ch.v;
      if (typeof ch.o === "boolean" && "open" in el) el.open = ch.o;
      if (typeof ch.k === "boolean" && "checked" in el) el.checked = ch.k;
    });
  }
  function copy(text) {
    var done = function () {
      var t = document.createElement("div");
      t.setAttribute("role", "status");
      t.textContent = "Copied";
      t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483000;padding:8px 14px;border-radius:999px;background:rgba(18,18,20,.92);color:#fff;font:14px/1.3 system-ui,sans-serif;pointer-events:none";
      (document.querySelector("dialog[open]") || document.body).appendChild(t);
      setTimeout(function () { t.remove(); }, 1600);
    };
    try { navigator.clipboard.writeText(text).then(done, function () {}); } catch (x) { /* no clipboard here */ }
  }
  /* A form in a dialog is the page's, and is never sent from here. */
  layer.addEventListener("submit", function (e) { if (e.target && e.target.closest && e.target.closest("dialog[data-world-dialog]")) e.preventDefault(); }, true);
});
`,
};
