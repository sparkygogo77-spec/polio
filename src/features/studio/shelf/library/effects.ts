/**
 * EFFECTS THAT WERE ONE SITE'S, MADE ANY PART'S.
 *
 * THE OWNER'S WORDS: the image filter on the picture inside the TV must be
 * usable on anything; the TV's switch-on too; the hover and press effects on
 * a box or any button must be universally available. Each is a library
 * feature like the others (`works.ts`): a manifest whose inputs the part
 * panel edits, and a small script the published page runs, so what the
 * preview shows is what ships. Every site an import brings in can give its
 * own settings for them (`learned.ts`): trumpmorty.fun's TV screen,
 * stonkfun's washed-out pictures, Parasite's pressed keys.
 *
 *   · Screen filter: a picture (or any part) as seen on a screen: a CSS
 *     filter (colour shift, saturation, contrast, or the site's own filter
 *     word for word), scanlines over it, a flicker of static, and a jitter.
 *   · Switch on: the part opens the way an old television does, a bright
 *     line that grows to the whole picture, once, when it first comes into
 *     view.
 *   · Push on press: the part sinks (and may shrink, or lose its shadow)
 *     while it is held down, and springs back.
 *
 * Pure strings: no store, no React.
 */
import type { Work } from "./works";

const CALM = `window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches`;
const NUM = `var num = function (v, d) { var n = Number(v); return v === "" || v === undefined || !isFinite(n) ? d : n; };`;

export const SCREEN_FILTER: Work = {
  manifest: {
    id: "screen-filter",
    name: "Screen filter",
    category: "media",
    blurb: "Shows the part as if on a screen: its colours shifted, scanlines over it, a flicker of static and a little jitter.",
    inputs: [
      { id: "scanlines", label: "Scanlines (how dark, 0 to 1)", kind: "number", default: "0.14" },
      { id: "lines", label: "Scanline spacing (px)", kind: "number", default: "3", advanced: true },
      { id: "static", label: "Static (how much, 0 to 1)", kind: "number", default: "0.06" },
      { id: "shift", label: "Colour shift (degrees)", kind: "number", default: "0" },
      { id: "saturate", label: "Colour strength", kind: "number", default: "1.1", advanced: true },
      { id: "contrast", label: "Contrast", kind: "number", default: "1.05", advanced: true },
      { id: "jitter", label: "Jitter (px)", kind: "number", default: "0" },
      { id: "every", label: "Jitters every (seconds)", kind: "number", default: "6", advanced: true },
      { id: "css", label: "Filter as the site wrote it", kind: "text", default: "", placeholder: "e.g. saturate(0.8)", advanced: true },
    ],
    needs: "none",
    says: ["screen filter", "tv filter", "crt filter", "scanlines", "static", "old tv", "vhs", "picture filter", "image filter"],
    look: { sample: "▤ screen", caption: "picture · on a screen" },
    version: 1,
  },
  script: `siteFeatures.define("screen-filter", function (el, inputs) {
  ${NUM}
  var lines = Math.max(2, num(inputs.lines, 3)), dark = Math.max(0, Math.min(1, num(inputs.scanlines, 0.14)));
  var grain = Math.max(0, Math.min(1, num(inputs["static"], 0.06))), shift = num(inputs.shift, 0);
  var sat = num(inputs.saturate, 1.1), con = num(inputs.contrast, 1.05), jit = num(inputs.jitter, 0), every = Math.max(0.5, num(inputs.every, 6));
  var own = String(inputs.css || "").trim();
  el.style.filter = (own ? own + " " : "") + "hue-rotate(" + shift + "deg) saturate(" + sat + ") contrast(" + con + ")";
  /* A picture element holds nothing: the veil goes beside it, over its box, in what holds it. */
  var bare = /^(IMG|VIDEO|CANVAS|IFRAME|INPUT|SVG)$/i.test(el.tagName), host = bare && el.parentElement ? el.parentElement : el;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  if (!document.getElementById("sf-keys")) {
    var k = document.createElement("style"); k.id = "sf-keys";
    k.textContent = "@keyframes sf-static{0%{background-position:0 0}25%{background-position:-40px 30px}50%{background-position:30px -20px}75%{background-position:-20px -40px}100%{background-position:0 0}}" +
      "@keyframes sf-jit{0%,92%,100%{translate:0 0}93%{translate:var(--sf-j) 0}95%{translate:calc(var(--sf-j) * -1) 0}97%{translate:calc(var(--sf-j) / 2) 0}}";
    document.head.appendChild(k);
  }
  var veil = document.createElement("div");
  veil.setAttribute("data-screen-filter", "");
  veil.setAttribute("aria-hidden", "true");
  var noise = "url(\\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='1'/></svg>\\")";
  var layers = [];
  if (dark > 0) layers.push("repeating-linear-gradient(0deg, rgba(0,0,0," + dark + ") 0 1px, transparent 1px " + lines + "px)");
  if (grain > 0) layers.push(noise);
  var box = bare && host !== el ? "left:" + el.offsetLeft + "px;top:" + el.offsetTop + "px;width:" + el.offsetWidth + "px;height:" + el.offsetHeight + "px;" : "inset:0;";
  veil.style.cssText = "position:absolute;" + box + "pointer-events:none;border-radius:inherit;mix-blend-mode:overlay;opacity:1;background-image:" + layers.join(",") + ";";
  if (grain > 0) { veil.style.setProperty("--sf-grain", String(grain)); veil.style.backgroundSize = (dark > 0 ? "auto," : "") + "120px 120px"; }
  if (grain > 0 && !(${CALM})) veil.style.animation = "sf-static 0.4s steps(4) infinite";
  if (grain > 0) veil.style.opacity = String(Math.min(1, 0.35 + grain * 6));
  if (layers.length) host.appendChild(veil);
  if (jit && !(${CALM})) { el.style.setProperty("--sf-j", jit + "px"); el.style.animation = (el.style.animation ? el.style.animation + ", " : "") + "sf-jit " + every + "s steps(1) infinite"; }
});
`,
};

export const SWITCH_ON: Work = {
  manifest: {
    id: "switch-on",
    name: "Switch on",
    category: "motion",
    blurb: "The part opens like an old television: a bright line that grows to the whole picture, once, when it first comes into view.",
    inputs: [
      { id: "duration", label: "Takes (ms)", kind: "number", default: "900" },
      { id: "delay", label: "After (ms)", kind: "number", default: "0", advanced: true },
      { id: "flash", label: "Flashes bright", kind: "one", default: "yes", values: ["yes", "no"] },
    ],
    needs: "none",
    says: ["switch on", "tv on", "turn on like a tv", "crt on", "power on", "opening"],
    look: { sample: "— ▭", caption: "opens · like a tv" },
    version: 1,
  },
  script: `siteFeatures.define("switch-on", function (el, inputs) {
  if (${CALM}) return;
  ${NUM}
  var ms = Math.max(120, num(inputs.duration, 900)), wait = Math.max(0, num(inputs.delay, 0)), flash = inputs.flash !== "no";
  var bright = flash ? "brightness(3)" : "brightness(1)";
  var frames = [
    { transform: "scale(1, 0.006)", filter: bright, opacity: 1 },
    { transform: "scale(1, 0.006)", filter: bright, offset: 0.3 },
    { transform: "scale(1, 1)", filter: "brightness(1)" }
  ];
  var go = function () { el.animate(frames, { duration: ms, delay: wait, easing: "cubic-bezier(.2,.9,.25,1)", fill: "backwards" }); };
  if (!("IntersectionObserver" in window)) { go(); return; }
  var seen = new IntersectionObserver(function (es) { for (var i = 0; i < es.length; i++) if (es[i].isIntersecting) { seen.disconnect(); go(); return; } }, { threshold: 0.2 });
  seen.observe(el);
});
`,
};

export const PRESS_PUSH: Work = {
  manifest: {
    id: "press-push",
    name: "Push on press",
    category: "interact",
    blurb: "While it is held down the part sinks a little (and may shrink or lose its shadow), and springs back when let go.",
    inputs: [
      { id: "down", label: "Sinks (px)", kind: "number", default: "2" },
      { id: "x", label: "Moves across (px)", kind: "number", default: "0", advanced: true },
      { id: "scale", label: "Shrinks to", kind: "number", default: "1" },
      { id: "shadow", label: "Shadow while pressed", kind: "text", default: "", placeholder: "as it is", advanced: true },
      { id: "pace", label: "Takes (ms)", kind: "number", default: "80", advanced: true },
    ],
    needs: "none",
    says: ["push on press", "press down", "sink on click", "button press", "pressed state", "active state"],
    look: { sample: "▼ press", caption: "press · sinks" },
    version: 1,
  },
  script: `siteFeatures.define("press-push", function (el, inputs) {
  ${NUM}
  var down = num(inputs.down, 2), x = num(inputs.x, 0), k = num(inputs.scale, 1), ms = Math.max(0, num(inputs.pace, 80)), sh = String(inputs.shadow || "").trim();
  var s = el.style, was = { translate: s.translate, scale: s.scale, boxShadow: s.boxShadow, transition: s.transition };
  s.transition = (was.transition ? was.transition + ", " : "") + "translate " + ms + "ms ease, scale " + ms + "ms ease, box-shadow " + ms + "ms ease";
  var cur = getComputedStyle(el).cursor;
  if (cur === "auto" || cur === "default") s.cursor = "pointer";
  var on = function () { s.translate = x + "px " + down + "px"; if (k !== 1) s.scale = String(k); if (sh) s.boxShadow = sh; el.setAttribute("data-pressed", ""); };
  var off = function () { s.translate = was.translate; s.scale = was.scale; s.boxShadow = was.boxShadow; el.removeAttribute("data-pressed"); };
  el.addEventListener("pointerdown", on);
  el.addEventListener("pointerup", off);
  el.addEventListener("pointerleave", off);
  el.addEventListener("pointercancel", off);
});
`,
};

export const EFFECTS: Work[] = [SCREEN_FILTER, SWITCH_ON, PRESS_PUSH];
