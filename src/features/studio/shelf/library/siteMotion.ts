/**
 * What the published page runs so that the shelf's "Works when published"
 * is true for the whole-site motions and the parts that answer a press.
 *
 * THE GAP IT CLOSES. The published page is the preview's markup with React
 * gone (`exportSite.ts`). The whole-site motions (a scroll bar, back to top,
 * parts appearing as they scroll in, the background moving slower than the
 * page, smooth and snap scrolling, the opening wipe, a cursor of the site's
 * own, parts tilting under the pointer) were run by `LiveShell` with React
 * effects, so on the published page they did nothing, while their cards
 * said "Works now". And a folding row, a tab strip or a Copy button kept
 * the state it was drawn in.
 *
 * THREE SMALL THINGS, each shipped only where a page uses it:
 *
 *   · `assets/site-motion.js` and the page's `#site-motion` settings: the
 *     whole-site motions, from the same `Behaviours` the preview derives,
 *     in plain browser JavaScript. Every one holds still when the visitor
 *     asks for less motion, except the plain facts (the bar, the button).
 *   · `assets/parts.js` and the page's `#site-parts` list: which part is a
 *     folding row, a tab strip or a copy button, worked through the
 *     accessible markup the part already draws (`aria-expanded`,
 *     `role="tab"`), so the published part does what the preview's does.
 *   · the keyframes a part's own style names (`PART_KEYFRAMES`), which lived
 *     in the app's stylesheet and so were missing on the published page: a
 *     ticker named `marquee-scroll` and stood still.
 *
 * Pure: no store, no React, so `tests/shelf-publish.mjs` runs it as written.
 */
import { RAISE_JS } from "./raiseJs.ts";

/** The whole-site motions a page asks for: `live/behaviours.ts#Behaviours`, as the page needs them. */
export interface SiteMotionSettings {
  progress: boolean;
  backToTop: boolean;
  reveal: boolean;
  /** fade-up, fade, scale, blur or stagger. */
  revealStyle?: string;
  parallax: number;
  smooth: boolean;
  snap: "vertical" | "horizontal" | null;
  intro: boolean;
  cursor: string | null;
  /** The cursor's picture, a small PNG as a data address, when the cursor is "picture". */
  cursorPicture?: string | null;
  tilt: boolean;
  /** The parts on the page, by the id each is published under. */
  parts: string[];
  accent: string;
  surface: string;
}

/** Whether a page asks for any of them. */
export function wantsMotion(b: Omit<SiteMotionSettings, "parts" | "accent" | "surface">): boolean {
  return b.progress || b.backToTop || b.reveal || b.parallax > 0 || b.smooth || !!b.snap || b.intro || !!b.cursor || b.tilt;
}

export const SITE_MOTION_JS = `/* The whole site's motion: its settings are in #site-motion on each page. */
(function () {
  /* A builder-ready code site hands its settings over directly (the kit's vendor/builder-motion.js), its parts by a selector. */
  var c = window.siteMotionSettings;
  if (!c) { var el = document.getElementById("site-motion"); if (!el) return; try { c = JSON.parse(el.textContent || "{}"); } catch (e) { return; } }
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  var parts = c.select ? Array.prototype.slice.call(document.querySelectorAll(c.select)) : (c.parts || []).map(function (id) { return document.getElementById(id); }).filter(Boolean);
  var sheet = document.createElement("style");
  sheet.textContent = "@keyframes sm-wipe{from{transform:scaleY(1)}to{transform:scaleY(0)}}";
  document.head.appendChild(sheet);
  function scrolled() { return window.scrollY || root.scrollTop || 0; }
  var bar = null, fill = null, back = null;
  if (c.progress) {
    bar = document.createElement("div");
    bar.setAttribute("role", "progressbar"); bar.setAttribute("aria-label", "Reading progress");
    bar.setAttribute("aria-valuemin", "0"); bar.setAttribute("aria-valuemax", "100");
    bar.style.cssText = "position:fixed;top:0;left:0;right:0;height:3px;z-index:2147483000;pointer-events:none";
    fill = document.createElement("div");
    fill.style.cssText = "height:100%;width:0;background:" + c.accent + ";transition:width 90ms linear";
    bar.appendChild(fill); document.body.appendChild(bar);
  }
  if (c.backToTop) {
    back = document.createElement("button");
    back.type = "button"; back.setAttribute("aria-label", "Back to top"); back.textContent = "\\u2191";
    back.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:2147483000;width:38px;height:38px;border-radius:999px;border:none;cursor:pointer;background:" + c.accent + ";color:" + c.surface + ";font-size:16px;box-shadow:0 8px 22px rgba(0,0,0,.35);display:none";
    back.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" }); });
    document.body.appendChild(back);
  }
  function onScroll() {
    var top = scrolled(), max = root.scrollHeight - window.innerHeight;
    if (fill) { var p = max > 0 ? Math.min(1, top / max) : 0; fill.style.width = (p * 100) + "%"; bar.setAttribute("aria-valuenow", String(Math.round(p * 100))); }
    if (back) back.style.display = top > 220 ? "block" : "none";
    if (c.parallax && !still) document.body.style.backgroundPositionY = (-top * c.parallax) + "px";
  }
  if (c.progress || c.backToTop || c.parallax) { window.addEventListener("scroll", onScroll, { passive: true }); onScroll(); }
  if (c.smooth && !still) root.style.scrollBehavior = "smooth";
  if (c.snap) {
    root.style.scrollSnapType = (c.snap === "horizontal" ? "x" : "y") + " proximity";
    parts.forEach(function (p) { if (p.getBoundingClientRect().width >= window.innerWidth * 0.8) p.style.scrollSnapAlign = "start"; });
  }
  if (c.reveal && !still && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.style.opacity = ""; e.target.style.transform = ""; e.target.style.filter = ""; io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    var rs = c.revealStyle || "fade-up", hidden = 0;
    parts.forEach(function (p) {
      var r = p.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) return;
      p.style.transition = "opacity 600ms ease, transform 600ms cubic-bezier(.2,.7,.3,1), filter 600ms ease";
      if (rs === "stagger") p.style.transitionDelay = (hidden++ % 3) * 90 + "ms";
      p.style.opacity = "0";
      p.style.transform = rs === "fade" || rs === "blur" ? "" : rs === "scale" ? "scale(.94)" : "translateY(18px)";
      if (rs === "blur") p.style.filter = "blur(8px)";
      io.observe(p);
    });
  }
  if (c.intro && !still) {
    var wipe = document.createElement("div");
    wipe.setAttribute("aria-hidden", "true");
    wipe.style.cssText = "position:fixed;inset:0;z-index:2147483001;pointer-events:none;transform-origin:top;background:" + c.surface + ";animation:sm-wipe 900ms cubic-bezier(.7,0,.2,1) both";
    document.body.appendChild(wipe);
    setTimeout(function () { wipe.remove(); }, 1000);
  }
  if (c.tilt && !still) {
    /* A tilted part comes up over the parts around it while it leans, and goes back once it has settled. */
    ${RAISE_JS}
    parts.forEach(function (p) {
      var lower = null, settle = 0;
      p.addEventListener("pointermove", function (e) {
        var r = p.getBoundingClientRect(); if (!r.width || !r.height) return;
        clearTimeout(settle); if (!lower) lower = raiseOver([p]);
        var dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
        p.style.transition = "transform 120ms ease-out";
        p.style.transform = "perspective(900px) rotateX(" + (-dy * 7).toFixed(2) + "deg) rotateY(" + (dx * 9).toFixed(2) + "deg)";
      });
      p.addEventListener("pointerleave", function () {
        p.style.transform = "";
        clearTimeout(settle); settle = setTimeout(function () { if (lower) { lower(); lower = null; } }, 160);
      });
    });
  }
  if (c.cursor === "picture" && c.cursorPicture && /^data:image\\//.test(c.cursorPicture)) {
    var sheet = document.createElement("style");
    sheet.textContent = "html,html *{cursor:url(\\"" + c.cursorPicture + "\\") 0 0,auto !important}";
    document.head.appendChild(sheet);
  } else if (c.cursor && !still && window.matchMedia && matchMedia("(pointer: fine)").matches) {
    var spot = c.cursor === "spotlight", size = spot ? 220 : 16;
    var dot = document.createElement("span");
    dot.setAttribute("aria-hidden", "true");
    dot.style.cssText = "position:fixed;left:0;top:0;z-index:2147483002;pointer-events:none;border-radius:999px;width:" + size + "px;height:" + size + "px;margin:" + (-size / 2) + "px 0 0 " + (-size / 2) + "px;display:none;" +
      (spot ? "mix-blend-mode:screen;background:radial-gradient(circle,color-mix(in srgb," + c.accent + " 26.7%,transparent),transparent 70%)" : "mix-blend-mode:difference;background:" + c.accent) +
      (c.cursor === "trail" ? ";transition:transform 140ms ease-out" : "");
    document.body.appendChild(dot);
    if (!spot) document.body.style.cursor = "none";
    window.addEventListener("pointermove", function (e) { dot.style.display = "block"; dot.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)"; });
    document.addEventListener("pointerleave", function () { dot.style.display = "none"; });
  }
})();
`;

/** The page's settings and the script's tag, or nothing when the page asks for none. */
export function siteMotionTags(settings: SiteMotionSettings, up: string): string {
  if (!wantsMotion(settings)) return "";
  const json = JSON.stringify(settings).replace(/</g, "\\u003c");
  return `<script id="site-motion" type="application/json">${json}</script>\n<script src="${up}assets/site-motion.js" defer></script>`;
}

/* ------------------------------------------------------------------ */
/* Parts that answer a press                                           */
/* ------------------------------------------------------------------ */

/** Which catalogue parts the parts script works, and as what. */
export const PART_KINDS: Record<string, "fold" | "tabs" | "copy"> = {
  accordion: "fold",
  faq: "fold",
  "tabs-panel": "tabs",
  "copy-button": "copy",
  "code-block": "copy",
};

export const PARTS_JS = `/* Parts that answer a press: which part is which is in #site-parts on each page. */
(function () {
  var el = document.getElementById("site-parts");
  if (!el) return;
  var list; try { list = JSON.parse(el.textContent || "[]"); } catch (e) { return; }
  function fold(root) {
    var heads = [].slice.call(root.querySelectorAll("button[aria-expanded]"));
    heads.forEach(function (b) {
      b.addEventListener("click", function () {
        var open = b.getAttribute("aria-expanded") !== "true";
        heads.forEach(function (o) {
          var on = o === b ? open : false;
          o.setAttribute("aria-expanded", on ? "true" : "false");
          var body = document.getElementById(o.getAttribute("aria-controls") || "");
          if (body) body.hidden = !on;
          var mark = o.querySelector("[aria-hidden]");
          if (mark && (mark.textContent === "+" || mark.textContent === "\\u2212")) mark.textContent = on ? "\\u2212" : "+";
        });
      });
    });
  }
  function tabs(root) {
    var ts = [].slice.call(root.querySelectorAll("[role=tab]"));
    function pick(t) {
      var was = ts.filter(function (x) { return x.getAttribute("aria-selected") === "true"; })[0];
      if (!was || was === t) return;
      /* The picked tab's look is the one it was drawn in: the two swap it. */
      var look = was.getAttribute("style"); was.setAttribute("style", t.getAttribute("style") || ""); t.setAttribute("style", look || "");
      ts.forEach(function (x) {
        var on = x === t;
        x.setAttribute("aria-selected", on ? "true" : "false"); x.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(x.getAttribute("aria-controls") || "");
        if (panel) panel.hidden = !on;
      });
    }
    ts.forEach(function (t, i) {
      t.addEventListener("click", function () { pick(t); });
      t.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        var n = ts[(i + (e.key === "ArrowRight" ? 1 : ts.length - 1)) % ts.length]; pick(n); n.focus();
      });
    });
  }
  function copy(root) {
    var b = root.querySelector("button");
    if (!b) return;
    b.addEventListener("click", function () {
      var src = root.querySelector("pre, code");
      var text = (src ? src.textContent : root.textContent) || "";
      var label = b.textContent;
      function said() { b.textContent = "Copied \\u2713"; setTimeout(function () { b.textContent = label; }, 1600); }
      if (navigator.clipboard) navigator.clipboard.writeText(text.trim()).then(said, said); else said();
    });
  }
  list.forEach(function (x) {
    var root = document.getElementById(x.part);
    if (!root) return;
    if (x.kind === "fold") fold(root);
    else if (x.kind === "tabs") tabs(root);
    else if (x.kind === "copy") copy(root);
  });
})();
`;

/** The parts on a page the parts script works, by the id each is published under. */
export function pageParts(nodes: readonly { id: string; featureId: string }[]): { part: string; kind: string }[] {
  return nodes.flatMap((n) => (PART_KINDS[n.featureId] ? [{ part: n.id, kind: PART_KINDS[n.featureId]! }] : []));
}

export function partsTags(nodes: readonly { id: string; featureId: string }[], up: string): string {
  const list = pageParts(nodes);
  if (!list.length) return "";
  return `<script id="site-parts" type="application/json">${JSON.stringify(list).replace(/</g, "\\u003c")}</script>\n<script src="${up}assets/parts.js" defer></script>`;
}

/* ------------------------------------------------------------------ */
/* Keyframes a part's own style names                                  */
/* ------------------------------------------------------------------ */

/**
 * The app stylesheet's keyframes that parts name in their own style
 * (`src/app/globals.css`, the same rules). The published page has no app
 * stylesheet, so each one a page names is written into it.
 */
export const PART_KEYFRAMES: Record<string, string> = {
  "marquee-scroll": "@keyframes marquee-scroll { from { transform: translateX(0); } to { transform: translateX(-33.33%); } }",
  "pulse-soft": "@keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }",
  shimmer: "@keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }",
  "fade-in": "@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }",
  "slide-up": "@keyframes slide-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }",
  "slide-in-right": "@keyframes slide-in-right { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }",
  pop: "@keyframes pop { from { opacity: 0; transform: scale(0.97) translateY(2px); } to { opacity: 1; transform: none; } }",
  glow: "@keyframes glow { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.9; } }",
};

/** The animation names a page's markup uses. */
export function animationNames(html: string): Set<string> {
  const out = new Set<string>();
  for (const m of html.matchAll(/animation(?:-name)?\s*:\s*([^;"]+)/g)) {
    for (const word of m[1]!.split(/[\s,]+/)) if (/^[a-z][\w-]*$/i.test(word)) out.add(word);
  }
  return out;
}

/** The keyframes a set of pages names that only the app's stylesheet held. */
export function partKeyframesFor(htmls: readonly string[]): string {
  const used = new Set<string>();
  for (const h of htmls) for (const n of animationNames(h)) if (PART_KEYFRAMES[n]) used.add(n);
  return [...used].map((n) => PART_KEYFRAMES[n]).join("\n");
}

/** Between pages, the browser's own cross-page fade, asked for in the stylesheet. */
export function pageTransitionCss(transition: unknown): string {
  const t = typeof transition === "string" ? transition : "fade";
  if (t === "none") return "";
  return "@view-transition { navigation: auto; }\n@media (prefers-reduced-motion: reduce) { @view-transition { navigation: none; } }";
}
