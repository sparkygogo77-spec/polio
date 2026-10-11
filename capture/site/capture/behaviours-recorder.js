/*
 * What the page's scripts do to it, recorded as it happens (`--behaviours`
 * on capture-route.mjs; the fields are in docs/behaviours.md).
 *
 * Injected before the page's own scripts. It watches, and changes nothing
 * the page does:
 *
 *   · a fixed element over the whole window as the page opens (a loader):
 *     its words, its count as it rises, the class it is switched off with,
 *     and when it goes;
 *   · every `element.animate()` the page calls (an intro);
 *   · every class the page's script adds or takes off an element, and the
 *     scroll and the moment it did, with the `transition-delay` it set
 *     beside it (reveal on scroll, a header that changes once scrolled);
 *   · every element a pointer listener is put on (where the hover pass of
 *     motion-drive.mjs looks).
 *
 * The rest (the pointer, the scroll, the idle loops) is measured by
 * capture-route.mjs driving the page, through `__sinkBehaviours.snap()`.
 * `mark()` writes `data-sink-bh` on every element named, for the dump to
 * carry; `report()` is the capture's `behaviours` section.
 */
(() => {
  if (window.__sinkBehaviours) return;
  const t0 = performance.now();
  const now = () => Math.round(performance.now() - t0);
  const els = [];
  /* Each element's number, looked up, not searched for: a whole-page map was every element against every other. */
  const numOf = new WeakMap();
  const idOf = (el) => { let i = numOf.get(el); if (i === undefined) { i = els.length; els.push(el); numOf.set(el, i); } return `b${i}`; };
  const elOf = (id) => els[Number(String(id).slice(1))] ?? null;
  const phase = { at: "load" };

  /* ---------------------------------------------------------------- animate() */
  const animations = [];
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (keyframes, options) {
    try {
      const o = typeof options === "number" ? { duration: options } : { ...(options ?? {}) };
      const frames = Array.isArray(keyframes) ? keyframes.map((f) => ({ ...f })) : keyframes;
      if (animations.length < 400) animations.push({ el: this, keyframes: JSON.parse(JSON.stringify(frames)), duration: o.duration ?? 0, delay: o.delay ?? 0, easing: o.easing ?? "linear", fill: o.fill ?? "none", iterations: o.iterations === Infinity ? "infinite" : (o.iterations ?? 1), t: now(), phase: phase.at });
    } catch { /* recording never stops the page */ }
    return animate.apply(this, arguments);
  };

  /* ---------------------------------------------------------------- pointer listeners */
  /* Every element the page listens to the pointer on (a card that tilts, a TV that turns): where the hover pass looks. */
  const pointerListened = new Set();
  const POINTER = /^(mousemove|mouseenter|mouseover|pointermove|pointerenter|pointerover)$/;
  const listen = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type) {
    try { if (this instanceof Element && POINTER.test(String(type))) pointerListened.add(this); } catch { /* recording never stops the page */ }
    return listen.apply(this, arguments);
  };

  /* ---------------------------------------------------------------- classes */
  const classes = [];
  const seenClass = new WeakMap();
  const classSet = (el) => new Set(Array.from(el.classList ?? []));
  const watch = new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target;
      if (m.type !== "attributes" || m.attributeName !== "class" || !(el instanceof Element)) continue;
      const before = new Set(String(m.oldValue ?? "").split(/\s+/).filter(Boolean)), after = classSet(el);
      const added = [...after].filter((c) => !before.has(c)), removed = [...before].filter((c) => !after.has(c));
      if (!added.length && !removed.length) continue;
      if (classes.length < 4000) classes.push({ el, added, removed, t: now(), y: Math.round(scrollY), phase: phase.at, delay: el.style?.transitionDelay || "" });
      seenClass.set(el, true);
    }
  });
  /* An init script can run before the document has its root: watched from the moment there is one. */
  const start = () => { if (document.documentElement) watch.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true }); else setTimeout(start, 0); };
  start();

  /* ---------------------------------------------------------------- the loader */
  const loaders = [];
  const ownWords = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim();
  const wordsIn = (el) => {
    const out = [];
    (function walk(e) { if (!(e instanceof Element)) return; const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") return; const inline = Array.from(e.children).every((k) => getComputedStyle(k).display.startsWith("inline") && !k.children.length); const w = inline ? (e.textContent ?? "").replace(/\s+/g, " ").trim() : ownWords(e); if (w) out.push({ tag: e.tagName.toLowerCase(), cls: String(e.className?.baseVal ?? e.className ?? ""), text: w, size: parseFloat(cs.fontSize) || 0 }); if (!inline) for (const k of e.children) walk(k); })(el);
    return out;
  };
  const covering = () => Array.from(document.body?.querySelectorAll("*") ?? []).filter((el) => {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9 && !loaders.some((l) => l.el.contains(el));
  });
  function look() {
    for (const el of covering()) {
      if (loaders.some((l) => l.el === el)) continue;
      loaders.push({ el, from: now(), texts: [], words: wordsIn(el), pictures: Array.from(el.querySelectorAll("img")).map((i) => i.currentSrc || i.src).filter(Boolean), canvases: el.querySelectorAll("canvas").length, animations: [], bodyClass: Array.from(document.body.classList), gone: null, removed: false, hidden: null });
    }
    for (const l of loaders) {
      if (l.gone !== null) continue;
      const text = String(l.el.innerText ?? l.el.textContent ?? "").split("\n").map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
      if (text && l.texts.at(-1) !== text) l.texts.push(text);
      for (const a of l.el.getAnimations?.({ subtree: true }) ?? []) {
        const name = a.animationName ?? null;
        if (name && !l.animations.includes(name)) l.animations.push(name);
      }
      const cs = getComputedStyle(l.el);
      if (!l.el.isConnected) { l.gone = now(); l.removed = true; }
      else if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) { if (l.hidden === null) l.hidden = now(); }
    }
    if (loaders.length && loaders.every((l) => l.gone !== null)) return;
    if (now() < 30000) setTimeout(look, 40);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", look); else look();

  /* ---------------------------------------------------------------- snapshots */
  const PROPS = ["opacity", "transform", "backgroundColor", "boxShadow", "paddingTop", "paddingBottom", "transition"];
  /** Every element's inline transform, and the computed styles a class change moves. */
  function snap() {
    const out = new Map();
    for (const el of document.body.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      const s = { inline: el.style?.transform ?? "", classes: String(el.className?.baseVal ?? el.className ?? "") };
      for (const p of PROPS) s[p] = cs[p];
      out.set(el, s);
    }
    return out;
  }

  const B = window.__sinkBehaviours = {
    phase: (p) => { phase.at = p; },
    snap,
    snaps: {},
    loops: [],
    pointer: [],
    scrolled: [],
    idle: [],
    idOf, elOf,
    /* When the recorder started, in ms from the navigation's start (performance.now's own origin): every `now()` plus this is a time from the navigation. */
    t0: Math.round(t0),
    classes, animations, loaders, pointerListened,
    /** Writes data-sink-bh on every element named, for the dump to carry. */
    mark() {
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (!(el instanceof Element) || !el.isConnected) continue;
        const had = el.getAttribute("data-sink-bh");
        el.setAttribute("data-sink-bh", had ? `${had} b${i}` : `b${i}`);
      }
      watch.disconnect();
    },
  };
  void B;
})();
