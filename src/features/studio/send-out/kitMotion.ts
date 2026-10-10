/**
 * EVERY MOTION SNAPS ONTO ANY PART OF A CODE SITE, WITH NO CODE CHAT.
 *
 * J (2026-10-10): "what's stopping a code chat from making it in a way that
 * the builder can export and preview within the builder, snapping onto any
 * panel". Nothing: the Preview already runs the shelf's own effect scripts
 * on any part (`live/runWorks.ts`), and a published Polio site ships the
 * same scripts. A code site (PonsStars) now ships them too, once, as one
 * file from the kit: `vendor/builder-motion.js`, written by
 * `npm run kit:motion` from the very scripts below, so the builder's
 * Preview and the site run the same code.
 *
 * Publish writes only which hook wears which motion, in the style layer:
 *
 *   [data-hook="wallet-panel"] { --builder-motion: "tilt?strength=12 marquee"; }
 *   :root { --builder-site-motion: "back-to-top hover-tilt parallax?strength=0.18"; }
 *
 * and the file reads those custom properties off each hooked element when
 * the page loads (and off parts a script adds later), so any motion goes on
 * any part. What CSS can carry is still written as CSS (`motionCss.ts`);
 * only a motion neither can do goes out as a NEXT.md line.
 *
 * Pure: no store, no DOM.
 */
import { getWork, inputsOf, RUNTIME_JS, usesOf, type WorkUse } from "../shelf/library/works.ts";
import { SITE_MOTION_JS } from "../shelf/library/siteMotion.ts";
import { carriedEffect, carriedSite } from "./motionCss.ts";

/** The shelf effects the kit's file runs: the ones that move or draw on their own part and need nothing but the page. */
export const KIT_EFFECTS: readonly string[] = ["tilt", "follow-pointer", "marquee", "dust-canvas", "scroll-grow", "glide", "screen-filter", "scroll-header", "crt-loader", "copy-toast"];
/** The whole-site motions it runs, where CSS does not (`SITE_MOTION_JS`). */
export const KIT_SITE: readonly string[] = ["back-to-top", "parallax", "hover-tilt", "cursor-effects", "smooth-scroll"];

/** Parallax strength by name, as the Preview takes it (`live/behaviours.ts` STRENGTH). */
const PARALLAX: Record<string, number> = { subtle: 0.08, medium: 0.18, strong: 0.32, light: 0.08, heavy: 0.32, off: 0 };

export const kitEffect = (id: string) => KIT_EFFECTS.includes(id) && !carriedEffect(id);
export function kitSite(featureId: string, options?: Record<string, string> | null): boolean {
  if (options?.off === "yes" || !KIT_SITE.includes(featureId)) return false;
  /* CSS eases a link's jump; only the file makes the wheel glide (`smoothWheelJs.ts`), so smooth scrolling rides both. */
  if (featureId === "smooth-scroll") return (options?.strength ?? "light") !== "off";
  if (carriedSite(featureId, options)) return false;
  return featureId !== "parallax" || (PARALLAX[options?.strength ?? "medium"] ?? 0.18) > 0;
}

const word = (id: string, inputs: Record<string, string>) => {
  const q = Object.entries(inputs).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return q ? `${id}?${q}` : id;
};

/** What a part's `--builder-motion` says: each effect the kit runs, with the inputs set away from their defaults. Null when none. */
export function motionValue(work: WorkUse | null | undefined): string | null {
  const words: string[] = [];
  for (const u of usesOf(work)) {
    if (u.off || !kitEffect(u.id)) continue;
    const w = getWork(u.id);
    if (!w) continue;
    const all = inputsOf(w.manifest, u.inputs);
    const set = Object.fromEntries(w.manifest.inputs.filter((i) => (all[i.id] ?? "") !== i.default).map((i) => [i.id, all[i.id]!]));
    words.push(word(u.id, set));
  }
  return words.length ? `"${words.join(" ")}"` : null;
}

/** What `:root`'s `--builder-site-motion` says, for the whole-site motions switched on. Null when none. */
export function siteMotionValue(on: readonly { featureId: string; options?: Record<string, string> | null }[]): string | null {
  const words: string[] = [];
  const seen = new Set<string>();
  for (const s of on) {
    if (seen.has(s.featureId) || !kitSite(s.featureId, s.options)) continue;
    seen.add(s.featureId);
    const o = s.options ?? {};
    if (s.featureId === "parallax") words.push(word("parallax", { strength: String(PARALLAX[o.strength ?? "medium"] ?? 0.18) }));
    else if (s.featureId === "smooth-scroll") words.push(word("smooth-scroll", o.strength === "heavy" ? { strength: "heavy" } : {}));
    else if (s.featureId === "cursor-effects") words.push(word("cursor-effects", { style: o.style && o.style !== "picture" ? o.style : "dot" }));
    else words.push(s.featureId);
  }
  return words.length ? `"${words.join(" ")}"` : null;
}

/** The custom properties the layer writes, for one part and for the site. A colour the file draws with (the back-to-top button) rides as one too. */
export function siteMotionDeclarations(on: Parameters<typeof siteMotionValue>[0], palette?: Record<string, string> | null): string[] {
  const v = siteMotionValue(on);
  if (!v) return [];
  const safe = (c: string | undefined) => (c && /^[#\w(),.%\s-]+$/.test(c) ? c : null);
  const accent = safe(palette?.accent), surface = safe(palette?.surface ?? palette?.bg);
  return [`--builder-site-motion: ${v}`, ...(accent ? [`--builder-motion-accent: ${accent}`] : []), ...(surface ? [`--builder-motion-surface: ${surface}`] : [])];
}

/**
 * The kit's `vendor/builder-motion.js`: the runtime, each effect's script as
 * the Preview runs it, the whole-site motions, and what binds them to the
 * hooks the style layer names. Generated; a site never edits it.
 */
export function kitMotionJs(): string {
  const effects = KIT_EFFECTS.filter((id) => !carriedEffect(id)).map((id) => getWork(id)!).filter(Boolean);
  const defaults = Object.fromEntries(effects.map((w) => [w.manifest.id, inputsOf(w.manifest)]));
  return `/*
 * The builder's motion, for a builder-ready site (polio kit, vendor/builder-motion.js).
 * GENERATED by \`npm run kit:motion\` in polio from the scripts its Preview runs: never edit it here.
 *
 * The style layer says which part wears which motion, as custom properties:
 *   [data-hook="x"] { --builder-motion: "tilt?strength=12 marquee"; }
 *   :root { --builder-site-motion: "back-to-top hover-tilt"; --builder-motion-accent: #fff; }
 * This file reads them off every hooked element when the page loads, and off
 * parts a script adds later. With none set, it does nothing.
 */
${RUNTIME_JS}
(function () {
  var F = window.siteFeatures;
  if (!F) return;
  var defs = {};
  var define = F.define;
  F.define = function (id, fn) { defs[id] = fn; define(id, fn); };
${effects.map((w) => `  /* ${w.manifest.name}: ${w.manifest.blurb} */\n  (function (siteFeatures) {\n${w.script}\n  })(F);`).join("\n")}
  var DEFAULTS = ${JSON.stringify(defaults)};
  var bound = typeof WeakMap === "function" ? new WeakMap() : null;
  function words(v) {
    v = String(v || "").trim().replace(/^["']|["']$/g, "");
    return v ? v.split(/\\s+/).map(function (w) {
      var q = w.indexOf("?"), id = q < 0 ? w : w.slice(0, q), inputs = {};
      var d = DEFAULTS[id] || {};
      for (var k in d) inputs[k] = d[k];
      if (q >= 0) w.slice(q + 1).split("&").forEach(function (p) { var e = p.indexOf("="); if (e > 0) inputs[decodeURIComponent(p.slice(0, e))] = decodeURIComponent(p.slice(e + 1)); });
      return { id: id, inputs: inputs };
    }) : [];
  }
  function own(el) {
    var v = getComputedStyle(el).getPropertyValue("--builder-motion").trim();
    if (!v) return "";
    /* A custom property is inherited: what a part's panel wears is the panel's, not the part's. */
    var up = el.parentElement;
    return up && getComputedStyle(up).getPropertyValue("--builder-motion").trim() === v ? "" : v;
  }
  function bind(el) {
    if (!el.getAttribute || !el.hasAttribute("data-hook")) return;
    var v = own(el);
    if (!v || (bound && bound.get(el) === v)) return;
    if (bound) bound.set(el, v);
    words(v).forEach(function (m) { var fn = defs[m.id]; if (fn) { try { fn(el, m.inputs, F.api); } catch (e) { /* the part keeps its look */ } } });
  }
  function scan(root) {
    if (root.nodeType !== 1) return;
    bind(root);
    var all = root.querySelectorAll("[data-hook]");
    for (var i = 0; i < all.length; i++) bind(all[i]);
  }
  function site() {
    var css = getComputedStyle(document.documentElement);
    var on = words(css.getPropertyValue("--builder-site-motion"));
    if (!on.length) return;
    var c = { progress: false, backToTop: false, reveal: false, parallax: 0, smooth: false, snap: null, intro: false, cursor: null, tilt: false, parts: [],
      select: "[data-panel]", accent: css.getPropertyValue("--builder-motion-accent").trim() || "currentColor", surface: css.getPropertyValue("--builder-motion-surface").trim() || "Canvas" };
    on.forEach(function (m) {
      if (m.id === "back-to-top") c.backToTop = true;
      if (m.id === "hover-tilt") c.tilt = true;
      if (m.id === "parallax") c.parallax = Number(m.inputs.strength) || 0.18;
      if (m.id === "cursor-effects") c.cursor = m.inputs.style || "dot";
      if (m.id === "smooth-scroll") { c.smooth = true; c.smoothStrength = m.inputs.strength || "light"; }
    });
    window.siteMotionSettings = c;
    ${SITE_MOTION_JS.trim().replace(/\n/g, "\n    ")}
  }
  function start() {
    site();
    scan(document.body);
    if (typeof MutationObserver === "function") new MutationObserver(function (list) {
      list.forEach(function (r) { for (var i = 0; i < r.addedNodes.length; i++) scan(r.addedNodes[i]); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
`;
}
