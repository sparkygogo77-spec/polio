/**
 * The "What's new" card at work on a page: the same script in the Preview
 * and on the published site (`works.ts`), on the markup `parts/WhatsNew.tsx`
 * draws.
 *
 * The card is drawn closed and nothing shows until this runs, so a script
 * that fails to load leaves the site as it was: never a card stuck over it.
 * It opens on a visitor's first visit, on each update the owner marks, or
 * only from a link to it ("What's new"), as the owner chose. Escape, the
 * close button, Finish or a press outside it closes it, and what this
 * visitor has seen is kept in their own browser (`localStorage`), so each
 * update is shown to each visitor once. Back, Next and the arrow keys move
 * through the steps; Tab stays inside the card while it is open.
 *
 * Each step's button does what it says: scroll to the part, open it (the
 * press the part itself takes: a menu, a tab, a panel, a copy), turn a
 * site option on (remembered for the visitor), or go to a page of the site.
 */
import type { Work } from "./works.ts";

export const WHATS_NEW: Work = {
  manifest: {
    id: "whats-new",
    name: "What's new card",
    category: "interact",
    blurb: "Shows a visitor what the site has, step by step: the real part playing on top of a centred card, a title and two or three lines, one button that does what it says, dots, Back, Next and Finish. Opens on a first visit, on each new update, or only from a link; each visitor sees an update once, remembered in their own browser.",
    inputs: [],
    needs: "none",
    says: ["what's new", "whats new", "intro tour", "update card", "new feature popup", "onboarding steps", "changelog popup"],
    look: { sample: "▣ ● ○ ○  Next →", caption: "steps · once per update" },
    version: 1,
  },
  script: `
siteFeatures.define("whats-new", function (el) {
  var root = el.matches && el.matches("[data-tour]") ? el : el.querySelector("[data-tour]");
  if (!root || root.getAttribute("data-tour-on") !== null) return;
  root.setAttribute("data-tour-on", "");
  var doc = el.ownerDocument || document, win = doc.defaultView || window;
  var lid = root.getAttribute("data-tour-lid");
  var layer = root.querySelector("[data-tour-layer]") || (lid ? doc.querySelector('[data-tour-layer="' + lid + '"]') : null);
  var card = layer && layer.querySelector("[data-tour-card]");
  if (!layer || !card) return;
  /*
   * Published, the card is lifted out of the page into the body, closed: a
   * page drawn at its own width and scaled to a phone's would carry it
   * scaled down with it, and "fixed" means the window only outside it. The
   * Preview's page is React's and is left where it is.
   */
  if (!el.hasAttribute("data-live-node") && doc.body && layer.parentNode !== doc.body) doc.body.appendChild(layer);
  var all = function (sel, at) { return Array.prototype.slice.call((at || layer).querySelectorAll(sel)); };
  var one = function (sel) { return layer.querySelector(sel); };
  var steps = all("[data-tour-step]"), dots = all("[data-tour-dot]");
  var back = one("[data-tour-back]"), next = one("[data-tour-next]"), finish = one("[data-tour-finish]");
  var pastOpen = one("[data-tour-past-open]"), past = one("[data-tour-past]"), pastClose = one("[data-tour-past-close]"), body = one("[data-tour-body]");
  var update = Number(root.getAttribute("data-tour-update")) || 1;
  var when = root.getAttribute("data-tour-when") || "update";
  var key = "whats-new:" + (root.getAttribute("data-tour-key") || el.id || el.getAttribute("data-live-node") || "card");
  var read = function (k) { try { return JSON.parse(win.localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  var write = function (k, v) { try { win.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* a private window: shown again next time, never an error */ } };
  var calm = function () { try { return win.matchMedia("(prefers-reduced-motion: reduce)").matches || doc.documentElement.hasAttribute("data-site-calm"); } catch (e) { return false; } };

  /* Site options a visitor turns on, kept for them; put back as the page opens. */
  var OPTS = "site-options";
  var options = read(OPTS) || {};
  var setOption = function (name, on) {
    if (!name) return;
    options[name] = !!on;
    write(OPTS, options);
    if (on) doc.documentElement.setAttribute("data-site-" + name, "on"); else doc.documentElement.removeAttribute("data-site-" + name);
    all('[data-tour-switch][data-tour-option="' + name + '"]').forEach(function (s) { s.setAttribute("aria-checked", on ? "true" : "false"); });
  };
  if (!doc.getElementById("site-option-css")) {
    var css = doc.createElement("style");
    css.id = "site-option-css";
    css.textContent = "html[data-site-calm] *, html[data-site-calm] *::before, html[data-site-calm] *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }";
    (doc.head || doc.documentElement).appendChild(css);
  }
  for (var o in options) if (options[o]) setOption(o, true);

  var at = 0, open = false, before = null;
  var find = function (id) { return id ? (doc.getElementById(id) || doc.querySelector('[data-live-node="' + id + '"]')) : null; };
  var show = function (i) {
    at = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function (s, j) { if (j === at) s.removeAttribute("hidden"); else s.setAttribute("hidden", ""); });
    dots.forEach(function (d, j) { if (j === at) d.setAttribute("aria-current", "step"); else d.removeAttribute("aria-current"); });
    if (back) back.hidden = at === 0;
    if (next) next.hidden = at >= steps.length - 1;
    if (finish) finish.hidden = at < steps.length - 1;
    var t = steps[at] && steps[at].querySelector("[data-tour-title]");
    if (t && t.id) card.setAttribute("aria-labelledby", t.id);
  };
  var showPast = function (on) {
    if (!past || !body) return;
    if (on) { past.removeAttribute("hidden"); body.setAttribute("hidden", ""); } else { past.setAttribute("hidden", ""); body.removeAttribute("hidden"); }
    var f = (on ? past : body).querySelector("button, a[href]");
    if (f && f.focus) f.focus();
  };
  var focusables = function () { return all('a[href], button:not([hidden]), [role="switch"], [tabindex]:not([tabindex="-1"])', card).filter(function (x) { return !x.closest("[hidden]") && x.offsetParent !== null; }); };
  /*
   * A site that keeps its desktop layout on a phone (a captured page sets its
   * own width) is shown zoomed out; the card is zoomed back in, so on a phone
   * it is a phone's card: as wide as the screen allows, buttons a finger wide.
   */
  var fit = function () {
    var v = win.visualViewport, k = v && v.scale ? v.scale : 1;
    if (!v || k > 0.95) { card.style.zoom = ""; card.style.width = ""; card.style.maxHeight = ""; return; }
    var max = Number(root.getAttribute("data-tour-width")) || 440;
    card.style.zoom = String(1 / k);
    card.style.width = Math.min(max, v.width * k - 24) + "px";
    card.style.maxHeight = (v.height * k - 24) + "px";
  };
  if (win.visualViewport) win.visualViewport.addEventListener("resize", function () { if (open) fit(); });
  var openIt = function (from) {
    if (open || !steps.length) return;
    open = true;
    fit();
    before = doc.activeElement;
    showPast(false);
    show(from || 0);
    layer.removeAttribute("hidden");
    root.setAttribute("data-tour-open", "");
    if (!calm() && card.animate) card.animate([{ opacity: 0, transform: "translateY(12px) scale(.98)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "cubic-bezier(.2,.9,.2,1)" });
    var f = focusables()[0] || card;
    try { (next && !next.hidden ? next : f).focus({ preventScroll: true }); } catch (e) { /* focus is a courtesy */ }
  };
  var close = function () {
    if (!open) return;
    open = false;
    layer.setAttribute("hidden", "");
    root.removeAttribute("data-tour-open");
    write(key, { seen: update, at: Date.now() });
    if (before && before.focus) try { before.focus({ preventScroll: true }); } catch (e) { /* the page keeps its focus */ }
  };
  var flash = function (t) {
    var was = t.style.outline, off = t.style.outlineOffset;
    t.style.outline = "3px solid " + (root.getAttribute("data-tour-accent") || "currentColor");
    t.style.outlineOffset = "4px";
    win.setTimeout(function () { t.style.outline = was; t.style.outlineOffset = off; }, 1600);
  };
  var press = function (t) {
    var p = t.matches && t.matches("a[href], button, [role=button]") ? t : t.querySelector("a[href], button, [role=button]");
    (p || t).click();
  };

  if (back) back.addEventListener("click", function () { show(at - 1); });
  if (next) next.addEventListener("click", function () { show(at + 1); if (next.hidden && finish) finish.focus(); });
  if (finish) finish.addEventListener("click", close);
  all("[data-tour-close]").forEach(function (b) { b.addEventListener("click", close); });
  if (pastOpen) pastOpen.addEventListener("click", function () { showPast(true); });
  if (pastClose) pastClose.addEventListener("click", function () { showPast(false); });
  dots.forEach(function (d, j) { d.addEventListener("click", function () { show(j); }); });
  /* A press outside the card closes it. */
  layer.addEventListener("click", function (e) { if (e.target === layer) close(); });
  all("[data-tour-switch]").forEach(function (s) {
    s.addEventListener("click", function () { setOption(s.getAttribute("data-tour-option"), s.getAttribute("aria-checked") !== "true"); });
  });
  all("[data-tour-action]").forEach(function (b) {
    b.addEventListener("click", function (e) {
      var kind = b.getAttribute("data-tour-action"), t = find(b.getAttribute("data-tour-target"));
      if (kind === "option") { setOption(b.getAttribute("data-tour-option"), true); b.setAttribute("data-tour-done", ""); return; }
      if (kind === "link") { close(); return; }
      e.preventDefault();
      close();
      if (!t) return;
      if (kind === "scroll") { t.scrollIntoView({ behavior: calm() ? "auto" : "smooth", block: "center" }); flash(t); }
      if (kind === "open") { t.scrollIntoView({ behavior: "auto", block: "center" }); press(t); }
    });
  });
  doc.addEventListener("keydown", function (e) {
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    var inField = e.target && e.target.closest && e.target.closest("input, textarea, select");
    if (!inField && e.key === "ArrowRight") { e.preventDefault(); show(at + 1); }
    if (!inField && e.key === "ArrowLeft") { e.preventDefault(); show(at - 1); }
    if (e.key === "Tab") {
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (doc.activeElement === last || !card.contains(doc.activeElement))) { e.preventDefault(); first.focus(); }
    }
  });
  /* A "What's new" link: one to this card, or to #whats-new, opens it. */
  var self = el.id || el.getAttribute("data-live-node") || "";
  doc.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || layer.contains(a)) return;
    var h = a.getAttribute("href") || "";
    if ((self && h === "#" + self) || h === "#whats-new") { e.preventDefault(); openIt(0); }
  });
  el.addEventListener("whats-new:open", function () { openIt(0); });
  if (/^#whats-new$/.test(win.location ? win.location.hash : "")) { openIt(0); return; }
  var seen = read(key);
  /* After the site's own loading screen, if it has one: the card is the first thing after the page, not over its entrance. */
  var whenReady = function (n) {
    win.setTimeout(function () { if (n < 40 && doc.querySelector("[data-crt]")) whenReady(n + 1); else openIt(0); }, n ? 300 : 500);
  };
  if (when === "first" ? !seen : when === "update" ? !seen || Number(seen.seen) < update : false) whenReady(0);
});
`,
};
