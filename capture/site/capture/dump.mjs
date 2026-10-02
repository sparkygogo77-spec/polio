/**
 * The dump itself, run inside the page: the tree from `body`, every
 * visible element with its real box, its own words and its computed
 * styles, and the page's `@font-face` rules. `capture-route.mjs` runs it
 * in a headless browser; `console-capture.mjs` writes it into the snippet
 * the owner pastes into his own browser's console. One function, so the
 * two are the same dump.
 *
 * It must stay self-contained: it is serialised and run in the page, so it
 * closes over nothing.
 */

/**
 * Runs in the browser. Returns the capture as `ccc-capture.json` had it, plus faces, `d`, `vb` and `title`.
 * `sheets` is the text of the stylesheets the page cannot read (cross-origin), as `capture-route.mjs`
 * fetched them: their `@keyframes` and `:hover` / `:focus` rules are read from it, parsed by the
 * browser into a sheet that is never applied. The console snippet passes none.
 */
export const DUMP = ({ sheets = [], paths = false } = {}) => {
  /* With `paths` (capture-route.mjs --states): each element's place in the page's own tree, every sibling counted, so one element is found again in a dump of the page taken after a press. */
  const domPath = (el) => { const out = []; for (let n = el; n && n !== document.body && n.parentElement; n = n.parentElement) { const t = n.tagName.toLowerCase(); let i = 1; for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === n.tagName) i++; out.unshift(`${t}:${i}`); } return `body${out.length ? ">" : ""}${out.join(">")}`; };
  const SKIP = new Set(["script", "style", "noscript", "template", "link", "meta", "head", "title"]);
  const SHAPES = new Set(["path", "polyline", "polygon", "line", "circle", "ellipse", "rect"]);
  const num = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };
  const round = (n) => Math.round(n);
  /* Its own words; a `<br>` the page shows is a line break in them (check-line-breaks.mjs), one it hides is not. */
  const own = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 3 || (n.nodeName === "BR" && getComputedStyle(n).display !== "none")).map((n) => (n.nodeType === 3 ? n.textContent : "\u0000")).join(" ").replace(/\s+/g, " ").replace(/ ?\u0000 ?/g, "\n").replace(/\n+/g, "\n").replace(/^\n+|\n+$/g, "").trim();
  const family = (ff) => (ff.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
  const zeroes = (a) => a.every((v) => !v);
  /** A stroke's shape as the path that draws it: mechanical, so an icon keeps its lines. */
  const pathOf = (el) => {
    const a = (n) => num(el.getAttribute(n)) ?? 0;
    switch (el.tagName.toLowerCase()) {
      case "path": return el.getAttribute("d") ?? null;
      case "line": return `M${a("x1")} ${a("y1")}L${a("x2")} ${a("y2")}`;
      case "polyline": case "polygon": {
        const pts = (el.getAttribute("points") ?? "").trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
        if (pts.length < 4) return null;
        let d = `M${pts[0]} ${pts[1]}`;
        for (let i = 2; i + 1 < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
        return el.tagName.toLowerCase() === "polygon" ? `${d}Z` : d;
      }
      case "circle": { const cx = a("cx"), cy = a("cy"), r = a("r"); return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`; }
      case "ellipse": { const cx = a("cx"), cy = a("cy"), rx = a("rx"), ry = a("ry"); return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`; }
      case "rect": {
        const x = a("x"), y = a("y"), w = a("width"), h = a("height");
        /* Rounded corners as SVG rounds them: rx or ry alone stands for both, each at most half the side. */
        const rxa = el.getAttribute("rx"), rya = el.getAttribute("ry");
        let rx = num(rxa ?? rya) ?? 0, ry = num(rya ?? rxa) ?? 0;
        rx = Math.min(Math.max(rx, 0), w / 2); ry = Math.min(Math.max(ry, 0), h / 2);
        if (!rx || !ry) return `M${x} ${y}h${w}v${h}h${-w}Z`;
        return `M${x + rx} ${y}h${w - 2 * rx}a${rx} ${ry} 0 0 1 ${rx} ${ry}v${h - 2 * ry}a${rx} ${ry} 0 0 1 ${-rx} ${ry}h${-(w - 2 * rx)}a${rx} ${ry} 0 0 1 ${-rx} ${-ry}v${-(h - 2 * ry)}a${rx} ${ry} 0 0 1 ${rx} ${-ry}Z`;
      }
      default: return null;
    }
  };
  /*
   * THE PAGE'S OWN MOTION. Its `@keyframes` (name and frames), and the rules
   * that apply to an element only while it, or something round it, is
   * hovered or focused. A value written through a custom property is
   * resolved against the element it applies to (a frame, against the root),
   * so what is recorded is what the browser would use.
   */
  const splitTop = (v, sep = ",") => { const out = []; let depth = 0, cur = ""; for (const ch of v ?? "") { if (ch === "(" || ch === "[") depth++; else if (ch === ")" || ch === "]") depth--; if (ch === sep && !depth) { out.push(cur.trim()); cur = ""; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
  /** A selector as its compounds and combinators, outside brackets and parentheses. */
  const compounds = (sel) => {
    const out = []; let depth = 0, cur = "";
    const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ""; };
    for (const ch of sel) {
      if (ch === "(" || ch === "[") depth++; else if (ch === ")" || ch === "]") depth--;
      if (!depth && /[\s>+~]/.test(ch)) { flush(); if (ch !== " " && ch.trim()) out.push(ch); } else cur += ch;
    }
    flush();
    return out;
  };
  const resolveVars = (v, at) => {
    const cs = getComputedStyle(at);
    for (let i = 0; i < 8 && /var\(/.test(v); i++) v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (m, name, fb) => cs.getPropertyValue(name).trim() || (fb ?? "").trim());
    return v;
  };
  /* As declared (a shorthand stays one: `background: var(--mustard)` has no longhands the CSSOM will give until it is applied), each value resolved. */
  const declsOf = (style, at) => {
    const o = {};
    for (const d of splitTop(style.cssText, ";")) { const i = d.indexOf(":"); if (i > 0) o[d.slice(0, i).trim()] = resolveVars(d.slice(i + 1).trim(), at); }
    return o;
  };
  const keyframes = new Map();
  const stateRules = [];
  /* Hovered, pressed (`:active`: trumpmorty's sticker pushed into its shadow) and focused: each its own state, never the resting look. */
  const STATE = /:(hover|active|focus-visible|focus-within|focus)(?![\w-])/;
  /* Heights given in the window's units (a hero `min-height: 100vh`): the rule, so the unit travels beside the px it measured. */
  const VU = /\d(?:\.\d+)?(?:[sld]?v(?:h|min|max|b))\b/;
  const unitRules = [];
  /*
   * Where a positioned layer is placed, as written: trumpmorty's planet is
   * `left: -16vw; top: -22vw; width: min(62vw, 860px)`, its deserts `left:
   * -5%; bottom: 13%; height: 36%`, so they keep their place at any window
   * or browser zoom while the content scales. Every declaration of these,
   * in cascade order, so the one the browser used can be picked per element.
   */
  const PLACE = ["left", "top", "right", "bottom", "width", "height", "background-size", "background-position"];
  const placeRules = [];
  /* Every font-size declared, in cascade order: type set with the window (trumpmorty's title, `clamp(58px, 8.6vw, 132px)`) is read from the rule. */
  const fontRules = [];
  const motionRules = (list, sheet) => {
    for (const r of Array.from(list)) {
      if (r instanceof CSSStyleRule) for (const prop of ["min-height", "height"]) { const v = r.style.getPropertyValue(prop).trim(); if (VU.test(v)) unitRules.push({ selector: r.selectorText, prop, value: v }); }
      if (r instanceof CSSStyleRule) { const v = r.style.getPropertyValue("font-size").trim(); if (v) fontRules.push({ selector: r.selectorText, value: v, important: r.style.getPropertyPriority("font-size") === "important", order: fontRules.length }); }
      if (r instanceof CSSStyleRule) for (const prop of PLACE) { const v = r.style.getPropertyValue(prop).trim(); if (v) placeRules.push({ selector: r.selectorText, prop, value: v, important: r.style.getPropertyPriority(prop) === "important", order: placeRules.length }); }
      if (r instanceof CSSKeyframesRule) {
        /* A later rule of the same name replaces an earlier one, as the browser uses it. */
        keyframes.set(r.name, { name: r.name, frames: Array.from(r.cssRules).map((f) => ({ key: f.keyText, style: declsOf(f.style, document.documentElement) })), ...(sheet ? { sheet } : {}) });
      } else if (r instanceof CSSStyleRule && STATE.test(r.selectorText)) {
        for (const selector of splitTop(r.selectorText)) {
          const m = STATE.exec(selector);
          /*
           * A state that paints a pseudo-element of what it moves
           * (`.nav a:hover::before`, a pill drawn behind a link on hover):
           * kept with the pseudo-element it paints (`pe`), and read against
           * the element that bears it. Any other pseudo-element is no part.
           */
          const pm = /::?(before|after)\s*$/i.exec(selector);
          if (!m || (selector.includes("::") && !pm)) continue;
          const pe = pm ? `::${pm[1].toLowerCase()}` : null;
          const plain = pm ? selector.slice(0, pm.index) : selector;
          /* The element the rule moves: the selector without its states. A state on the last compound is the element's own; earlier, it is a hovered ancestor or sibling's. */
          const tokens = compounds(plain);
          const bare = tokens.map((x) => (/^[>+~]$/.test(x) ? x : x.replace(new RegExp(STATE.source, "g"), "") || "*")).join(" ");
          stateRules.push({ on: m[1], selector, bare, self: STATE.test(tokens[tokens.length - 1] ?? ""), style: r.style, rule: sheet === undefined ? null : r, ...(pe ? { pe } : {}) });
        }
      } else if (r instanceof CSSMediaRule) {
        if (matchMedia(r.conditionText ?? r.media.mediaText).matches) motionRules(r.cssRules, sheet);
      } else if (r.cssRules && !(r instanceof CSSKeyframesRule)) motionRules(r.cssRules, sheet);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    let list = null;
    try { list = sheet.cssRules; } catch { continue; }
    if (list) motionRules(list, sheet.href ?? null);
  }
  const fetchedFrom = stateRules.length;
  for (const { href, text } of sheets) {
    try { const s = new CSSStyleSheet(); s.replaceSync(text); motionRules(s.cssRules, href); } catch { /* not a sheet the browser parses */ }
  }
  /* A rule read off a copy of a sheet the page cannot read cannot be tried on the page. */
  for (let i = fetchedFrom; i < stateRules.length; i++) stateRules[i].rule = null;
  /*
   * A STATE RULE THAT TAKES. `.sp-card:hover { transform: translateY(-2px) }`
   * matches gotchi.gg's chosen starter card, but `.sp-card[aria-pressed=true]`
   * is as specific and later, so hovered the chosen card keeps its tilt; the
   * rule, read alone, took the tilt away. Tried on the page: the rule again,
   * in its own place, its state swapped for an attribute of the same weight,
   * the attribute set on the element, and only what that changes is kept.
   */
  const takes = (r, el, style, pe = null) => {
    const host = r.rule?.parentRule ?? r.rule?.parentStyleSheet;
    if (!r.self || !host?.cssRules) return style;
    let at = -1;
    try { at = Array.from(host.cssRules).indexOf(r.rule); } catch { return style; }
    if (at < 0) return style;
    const probe = r.selector.replace(new RegExp(STATE.source, "g"), "[data-sink-st]");
    let added = false;
    try { host.insertRule(`${probe}{${r.rule.style.cssText}}`, at + 1); added = true; } catch { return style; }
    const was = el.style.getPropertyValue("transition"), wasP = el.style.getPropertyPriority("transition");
    el.style.setProperty("transition", "none", "important");
    /* A pseudo-element's transition is its own: off too while it is read, or the read is its first frame. */
    const still = pe ? document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "*::before,*::after{transition:none!important}" })) : null;
    const read = () => { const c = getComputedStyle(el, pe); return Object.fromEntries(Object.keys(style).map((k) => [k, c.getPropertyValue(k)])); };
    const before = read();
    el.setAttribute("data-sink-st", "");
    const after = read();
    /* A pseudo-element's state: what it paints under the state, every property it is drawn with (`PSEUDO_LOOK`), for one that is not there at rest. */
    if (pe && r.whole) { const c = getComputedStyle(el, pe); r.whole.after = Object.fromEntries(PSEUDO_LOOK.map((k) => [k, c.getPropertyValue(k)])); }
    el.removeAttribute("data-sink-st");
    if (added) host.deleteRule(at + 1);
    /*
     * BACK AT REST BEFORE ITS TRANSITION RETURNS. The state was last read
     * applied; put its transition back unread and the next read starts a
     * transition from the state to rest, and reads its first frame: every
     * sticker, button and CA bar of trumpmorty.fun kept its hover shadow
     * (7px for 4px) as its resting one. Read once more with none on.
     */
    read();
    still?.remove();
    if (was) el.style.setProperty("transition", was, wasP); else el.style.removeProperty("transition");
    return Object.fromEntries(Object.entries(style).filter(([k]) => before[k] !== after[k]));
  };
  /* What a pseudo-element is drawn with, read whole when a state brings it (below, `motionOf`). */
  const PSEUDO_LOOK = ["content", "display", "position", "top", "right", "bottom", "left", "width", "height", "margin-top", "margin-left", "background-color", "background-image", "background-size", "background-position", "background-repeat", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius", "border-top", "border-right", "border-bottom", "border-left", "box-shadow", "opacity", "transform", "transform-origin", "z-index", "filter", "mix-blend-mode", "color", "pointer-events", "transition"];
  const LOOK_DEFAULT = /^(none|auto|normal|0px|0px 0px|rgba\(0, 0, 0, 0\)|repeat|0% 0%|50% 50%|static|visible|1|inline|all 0s ease 0s|0s)$|^0px none /;
  /* A selector's specificity as one number: ids, then classes, attributes and pseudo-classes, then types. */
  const specOf = (sel) => {
    let a = 0, b = 0, c = 0;
    const add = (n) => { a += Math.floor(n / 1e6); b += Math.floor(n / 1e3) % 1e3; c += n % 1e3; };
    const t = sel.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, "")
      .replace(/:(?:not|is|has)\(((?:[^()]|\([^()]*\))*)\)/g, (m, x) => { add(Math.max(0, ...splitTop(x).map(specOf))); return ""; })
      .replace(/::[\w-]+(?:\([^)]*\))?/g, () => { c++; return ""; });
    a += (t.match(/#[\w-]+/g) ?? []).length;
    b += (t.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+(?:\([^)]*\))?/g) ?? []).length;
    c += (t.replace(/\[[^\]]*\]|[.#:][\w-]+(?:\([^)]*\))?/g, " ").match(/(?:^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length;
    return a * 1e6 + b * 1e3 + c;
  };
  /* Relative to something the window or the block sets: a percentage, a window unit, or a sum or bound of them. */
  const REL = /%|\d(?:[sld]?v(?:w|h|i|b|min|max))\b|\b(?:calc|min|max|clamp)\(/;
  const camel = (p) => p.replace(/-(\w)/g, (m, ch) => ch.toUpperCase());
  /*
   * An absolute or fixed element's placement as written, where the value the
   * cascade picked is in relative units (a px value is the px measured, so it
   * says nothing more), and the block those units are taken of: the window
   * for a fixed one, else the nearest positioned ancestor's padding box, `up`
   * levels above it, or the first screen when there is none.
   */
  const placeOf = (el, cs) => {
    if (cs.position !== "absolute" && cs.position !== "fixed") return null;
    const won = {};
    for (const r of placeRules) {
      let spec = -1;
      for (const part of splitTop(r.selector)) { let hit = false; try { hit = el.matches(part); } catch { /* not a selector this browser takes */ } if (hit) spec = Math.max(spec, specOf(part)); }
      if (spec < 0) continue;
      const w = won[r.prop];
      if (!w || r.important > w.important || (r.important === w.important && (spec > w.spec || (spec === w.spec && r.order > w.order)))) won[r.prop] = { value: r.value, important: r.important, spec, order: r.order };
    }
    for (const prop of PLACE) { const v = el.style.getPropertyValue(prop).trim(); if (v && !(won[prop]?.important && el.style.getPropertyPriority(prop) !== "important")) won[prop] = { value: v }; }
    const au = {};
    for (const [prop, w] of Object.entries(won)) {
      const v = w.value;
      if (/var\(/.test(v)) continue;
      const keep = /^(?:initial|inherit|unset|revert|revert-layer)(?:\s*,\s*(?:initial|inherit|unset|revert|revert-layer))*$/.test(v) ? false : prop.startsWith("background") ? !/^(auto|auto auto|0% 0%|0px 0px|left top)$/.test(v) && !/^(-?[\d.]+px\s*)+$/.test(v) : REL.test(v);
      if (keep) au[camel(prop)] = v;
    }
    if (!Object.keys(au).length) return null;
    if (cs.position === "fixed") return { ...au, of: { by: "viewport", box: [0, 0, innerWidth, innerHeight] } };
    let up = 0, cb = null;
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) { up++; if (getComputedStyle(a).position !== "static") { cb = a; break; } }
    if (!cb || cb === document.body && getComputedStyle(cb).position === "static") return { ...au, of: { by: "initial", box: [0, 0, innerWidth, innerHeight] } };
    const q = cb.getBoundingClientRect();
    const b = edges(q.left + scrollX + cb.clientLeft, q.top + scrollY + cb.clientTop, cb.clientWidth, cb.clientHeight);
    return { ...au, of: { by: "block", up, box: [b.x, b.y, b.w, b.h] } };
  };
  /*
   * TYPE SET WITH THE WINDOW. The font-size an element takes, as written, when
   * it names a window unit: its own rule, or, as font-size inherits, the
   * nearest ancestor's; an `em` or `%` of that is taken of the one above
   * (trumpmorty's "&", `.62em` of its row's clamp). A px, a rem or a keyword
   * anywhere on the way says the size does not follow the window: nothing.
   */
  const VIEW = /\d(?:[sld]?v(?:w|h|i|b|min|max))\b/;
  const fontOwn = new Map();
  const ownFont = (el) => {
    if (fontOwn.has(el)) return fontOwn.get(el);
    let won = null;
    for (const r of fontRules) {
      let spec = -1;
      for (const part of splitTop(r.selector)) { let hit = false; try { hit = el.matches(part); } catch { /* not a selector this browser takes */ } if (hit) spec = Math.max(spec, specOf(part)); }
      if (spec < 0) continue;
      if (!won || r.important > won.important || (r.important === won.important && (spec > won.spec || (spec === won.spec && r.order > won.order)))) won = { value: r.value, important: r.important, spec, order: r.order };
    }
    const inline = el.style?.getPropertyValue("font-size").trim();
    const v = inline && !(won?.important && el.style.getPropertyPriority("font-size") !== "important") ? inline : won?.value ?? null;
    fontOwn.set(el, v);
    return v;
  };
  const fluidFont = (el) => {
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const v = ownFont(a);
      if (!v || /^(inherit|unset|revert|revert-layer)$/.test(v)) continue;
      if (/var\(/.test(v)) return null;
      const rel = /^(-?\d*\.?\d+)(em|%)$/.exec(v);
      if (rel) {
        const up = fluidFont(a.parentElement);
        return up ? `calc(${up} * ${+(Number(rel[1]) / (rel[2] === "%" ? 100 : 1)).toFixed(4)})` : null;
      }
      return VIEW.test(v) && !/\bem\b|%/.test(v.replace(/\d*\.?\d+rem/g, "")) ? v : null;
    }
    return null;
  };
  const motionOf = (el, cs, pseudo = false) => {
    const mo = {};
    const names = splitTop(cs.animationName);
    if (names.some((n) => n && n !== "none")) {
      const at = (v, i) => { const l = splitTop(v); return l[i % l.length] ?? ""; };
      mo.animation = names.map((name, i) => ({ name, duration: at(cs.animationDuration, i), timing: at(cs.animationTimingFunction, i), delay: at(cs.animationDelay, i), iterations: at(cs.animationIterationCount, i), direction: at(cs.animationDirection, i), fill: at(cs.animationFillMode, i) })).filter((a) => a.name !== "none");
    }
    const props = splitTop(cs.transitionProperty);
    const at = (v, i) => { const l = splitTop(v); return l[i % l.length] ?? ""; };
    const trans = props.map((property, i) => ({ property, duration: at(cs.transitionDuration, i), timing: at(cs.transitionTimingFunction, i), delay: at(cs.transitionDelay, i) }))
      .filter((x) => x.property !== "none" && (parseFloat(x.duration) || parseFloat(x.delay)));
    if (trans.length) mo.transition = trans;
    for (const r of stateRules) {
      /* On a pseudo-element's own part, only the states that paint it; on an element, its own, and those of a pseudo-element of it that is no part of its own (below). */
      if (pseudo ? r.pe !== pseudo : r.pe && pseudoPart(el, r.pe)) continue;
      let hit = false;
      try { hit = el.matches(r.bare); } catch { /* a selector this browser does not take */ }
      if (!hit) continue;
      const key = r.on === "hover" || r.on === "active" ? r.on : "focus";
      if (!pseudo && r.pe) {
        /*
         * A PSEUDO-ELEMENT A STATE BRINGS. Not drawn at rest (no content, or
         * no opacity to see), so it was never a part: the element keeps it,
         * as the look it has at rest (`base`) and the look the state gives
         * it (`style`), each read whole from the browser, so the copy can
         * draw it under the state the way the page did.
         */
        const rest = getComputedStyle(el, r.pe);
        const base = Object.fromEntries(PSEUDO_LOOK.map((k) => [k, rest.getPropertyValue(k)]).filter(([k, v]) => v && (k === "content" || k === "display" || k === "opacity" || !LOOK_DEFAULT.test(v))));
        const whole = { after: null };
        const declared = declsOf(r.style, el);
        takes({ ...r, whole }, el, declared, r.pe);
        const after = whole.after ?? declared;
        const style = Object.fromEntries(Object.entries(after).filter(([k, v]) => v !== (rest.getPropertyValue(k) ?? "") && v !== undefined));
        if (!Object.keys(style).length) continue;
        (mo[key] ??= []).push({ ...(key === "focus" ? { state: r.on } : {}), selector: r.selector, self: r.self, pseudo: r.pe, base, style });
        continue;
      }
      const style = takes(r, el, declsOf(r.style, el), pseudo || null);
      if (!Object.keys(style).length) continue;
      /* A pseudo-element's own part is painted by its element's state, never its own hover: `of` says whose, the element that bears it (`host`) or one it sits in (`above`). */
      (mo[key] ??= []).push({ ...(key === "focus" ? { state: r.on } : {}), selector: r.selector, self: pseudo ? false : r.self, ...(pseudo ? { of: r.self ? "host" : "above" } : {}), style });
    }
    return Object.keys(mo).length ? mo : null;
  };
  /*
   * A BOX AS LAID OUT, THE TRANSFORM BESIDE IT. A rotated ribbon's box as the
   * browser reports it is the box round the rotation, far taller than the
   * ribbon, and its words are measured inside that. So an element's own
   * transform is lifted while it and everything in it are measured, and put
   * back after: every box is the one the layout gave, in the page's
   * untransformed space. The transform is kept twice: `tf`, the element's own
   * as computed, and `ptf`, everything that moves it — its own about its
   * origin, after its ancestors' — as one page-space matrix [a, b, c, d, e, f].
   */
  const I = new DOMMatrix();
  /* A box by its edges: the left and top rounded, and the right and bottom, so two boxes that touch still touch (the size is what is left between them). */
  const edges = (x, y, w, h) => { const x0 = round(x), y0 = round(y); return { x: x0, y: y0, w: round(x + w) - x0, h: round(y + h) - y0 }; };
  const mround = (m) => [m.a, m.b, m.c, m.d].map((v) => Math.round(v * 10000) / 10000).concat([m.e, m.f].map((v) => Math.round(v * 100) / 100));
  const isIdentity = (m) => !m || mround(m).every((v, i) => v === [1, 0, 0, 1, 0, 0][i]);
  const pageMatrix = (tf, origin, box) => {
    let m;
    try { m = tf instanceof DOMMatrix ? tf : new DOMMatrix(tf); } catch { return null; }
    const [ox, oy] = (origin ?? "").split(/\s+/).map(num);
    const o = [box.x + (ox ?? box.w / 2), box.y + (oy ?? box.h / 2)];
    return I.translate(o[0], o[1]).multiply(m).translate(-o[0], -o[1]);
  };
  /* Elements a script grows only once the page has been scrolled (a progress fill at width 0 at the top): the largest box each was seen at on the way down, by capture-route.mjs. */
  const grown = window.__sinkGrown instanceof Map ? window.__sinkGrown : null;
  /* Each side's colour, clockwise from the top, when the sides that are drawn are not all one colour; else null. */
  const sideColours = (cs, bw) => {
    const c = ["Top", "Right", "Bottom", "Left"].map((s) => cs[`border${s}Color`]);
    const drawn = c.filter((_, i) => bw[i] > 0);
    return drawn.length > 1 && drawn.some((v) => v !== drawn[0]) ? c : null;
  };
  const sides = (cs, what) => ["Top", "Right", "Bottom", "Left"].map((s) => (what === "border" ? (cs[`border${s}Style`] !== "none" ? num(cs[`border${s}Width`]) ?? 0 : 0) : num(cs[`${what}${s}`]) ?? 0));

  /*
   * Each corner as the browser rounds it, horizontal and vertical apart
   * ("28px 34px" is an ellipse: the TV screen's `28px/34px`), clockwise from
   * the top left, in px; a percentage of the box's own side. `inner` takes
   * the border off, the curve of the padding box: what a box that clips its
   * overflow cuts its children to.
   */
  const corners = (cs, w, h, bw) => {
    const names = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"];
    const across = [[3, 0], [1, 0], [1, 2], [3, 2]];
    return names.map((n, i) => {
      const [a, b = a] = String(cs[`border${n}Radius`] ?? "0px").split(/\s+/);
      const len = (v, of) => { const k = num(v) ?? 0; return /%/.test(v) ? (k / 100) * of : k; };
      const rx = len(a, w), ry = len(b, h);
      return bw ? [round(Math.max(0, rx - bw[across[i][0]])), round(Math.max(0, ry - bw[across[i][1]]))] : [round(rx), round(ry)];
    });
  };  const paints = (v) => v && v !== "rgba(0, 0, 0, 0)" && v !== "transparent";
  /*
   * A PSEUDO-ELEMENT THAT DRAWS. `::before` and `::after` have no box of their
   * own to ask for, so one placed absolute (a timeline dot, a dot pattern, a
   * drip, a gloss) is placed the way the browser placed it: at its resolved
   * left and top (and margins) inside its containing block, at its resolved
   * size. Only one that draws something — a fill, a background, an edge, a
   * shadow or words — is recorded; an empty `content: ""` is not.
   */
  /* Would the walk below make a part of this pseudo-element: there, placed, drawn and not faint (capture-to-document drops a faint one). */
  const pseudoPart = (el, which) => {
    const ps = getComputedStyle(el, which), c = ps.content;
    if (!c || c === "none" || c === "normal" || ps.display === "none" || ps.visibility === "hidden") return false;
    if (ps.position !== "absolute" && ps.position !== "fixed") return false;
    if (Number(ps.opacity) <= 0.05) return false;
    const text = (/^"([\s\S]*)"$/.exec(c)?.[1] ?? "").trim();
    return !!(paints(ps.backgroundColor) || (ps.backgroundImage && ps.backgroundImage !== "none") || sides(ps, "border").some(Boolean) || (ps.boxShadow && ps.boxShadow !== "none") || text) && num(ps.width) > 0 && num(ps.height) > 0;
  };
  const pseudoOf = (el, which, cb, acc) => {
    const ps = getComputedStyle(el, which);
    const c = ps.content;
    if (!c || c === "none" || c === "normal" || ps.display === "none" || ps.visibility === "hidden") return null;
    if (ps.position !== "absolute" && ps.position !== "fixed") return null;
    const text = (/^"([\s\S]*)"$/.exec(c)?.[1] ?? "").replace(/\\(.)/g, "$1").trim();
    const bw = sides(ps, "border");
    if (!(paints(ps.backgroundColor) || (ps.backgroundImage && ps.backgroundImage !== "none") || bw.some(Boolean) || (ps.boxShadow && ps.boxShadow !== "none") || text)) return null;
    const pad = sides(ps, "padding"), mar = sides(ps, "margin");
    const w0 = num(ps.width), h0 = num(ps.height);
    if (!(w0 > 0) || !(h0 > 0)) return null;
    const bb = ps.boxSizing === "border-box";
    const w = bb ? w0 : w0 + pad[1] + pad[3] + bw[1] + bw[3];
    const h = bb ? h0 : h0 + pad[0] + pad[2] + bw[0] + bw[2];
    const block = ps.position === "fixed" ? { x: 0, y: 0, w: innerWidth, h: innerHeight } : cb;
    const left = num(ps.left), top = num(ps.top), right = num(ps.right), bottom = num(ps.bottom);
    const x = block.x + (left !== null && ps.left !== "auto" ? left + mar[3] : block.w - (right ?? 0) - mar[1] - w);
    const y = block.y + (top !== null && ps.top !== "auto" ? top + mar[0] : block.h - (bottom ?? 0) - mar[2] - h);
    const box = { x, y, w, h };
    const e = { t: which, pseudo: true, ...edges(x, y, w, h) };
    if (paths) e.p = `${domPath(el)}${which}`;
    if (text) { e.text = text; e.color = ps.color; const fs = num(ps.fontSize); if (fs !== null) e.fs = fs; e.fw = ps.fontWeight; e.ff = family(ps.fontFamily); const lh = num(ps.lineHeight); if (lh !== null) e.lh = lh; e.ls = ps.letterSpacing; e.ta = ps.textAlign; e.tt = ps.textTransform; }
    if (paints(ps.backgroundColor)) e.bg = ps.backgroundColor;
    if (ps.backgroundImage && ps.backgroundImage !== "none") { e.bgi = ps.backgroundImage; e.bgo = [ps.backgroundSize, ps.backgroundPosition, ps.backgroundRepeat]; }
    if (ps.opacity !== "1") e.op = num(ps.opacity);
    if (ps.mixBlendMode && ps.mixBlendMode !== "normal") e.blend = ps.mixBlendMode;
    if (ps.filter && ps.filter !== "none") e.filter = ps.filter;
    /* Read at rest, as an element's is: a drip's ::before caught mid-stretch was a different look on every load. */
    const ptfRest = ps.transform && ps.transform !== "none" ? atRest(el, ["transform"], (c) => c.transform, which) : ps.transform;
    if (ptfRest && ptfRest !== "none") { e.tf = ptfRest; e.tfo = ps.transformOrigin; }
    const own = e.tf ? pageMatrix(e.tf, ps.transformOrigin, box) : null;
    const total = acc && own ? acc.multiply(own) : own ?? acc;
    if (!isIdentity(total)) e.ptf = mround(total);
    if (ps.animationName && ps.animationName !== "none") e.anim = ps.animationName;
    if (ps.pointerEvents === "none") e.inert = true;
    const mo = motionOf(el, ps, which);
    if (mo) e.motion = mo;
    if (bw[0] > 0) e.border = `${ps.borderTopWidth} ${ps.borderTopStyle} ${ps.borderTopColor}`;
    else if (bw.some(Boolean)) { const i = bw.findIndex(Boolean); const s = ["Top", "Right", "Bottom", "Left"][i]; e.border = `${ps[`border${s}Width`]} ${ps[`border${s}Style`]} ${ps[`border${s}Color`]}`; }
    if (bw.some(Boolean) && !bw.every((v) => v === bw[0])) e.bsides = bw;
    const bc = sideColours(ps, bw);
    if (bc) { e.bsides = bw; e.bcolours = bc; }
    if (ps.boxShadow && ps.boxShadow !== "none") e.shadow = ps.boxShadow;
    { const masked = maskWhole(ps, box); if (masked) { e.svgMarkup = masked; e.masked = true; } }
    const rad = [ps.borderTopLeftRadius, ps.borderTopRightRadius, ps.borderBottomRightRadius, ps.borderBottomLeftRadius].map((v) => { const n = num(v) ?? 0; return round(/%/.test(v ?? "") ? (n / 100) * Math.min(w, h) : n); });
    if (!zeroes(rad)) e.radius = rad;
    { const c = corners(ps, w, h); if (c.some(([rx, ry]) => rx !== ry)) e.rxy = c; }
    e.pos = ps.position;
    e.ins = [ps.top, ps.right, ps.bottom, ps.left];
    e.z = ps.zIndex;
    return e;
  };
  /*
   * AN SVG DRAWN THROUGH ITS <defs>. share.xyz's QR code is rects filled
   * `url(#spot)` and clipped `url(#dots)`: the modules live in a clipPath, so
   * its strokes alone draw a blank square. An svg that fills, strokes, clips,
   * masks or filters through a reference, or holds `use`, `image`, `text` or
   * a pattern, is kept whole instead: a copy with every element's computed
   * paint written on it, the outside defs it points at brought in, sized to
   * its box. The converter carries it as a picture.
   */
  const SVG_PAINT = ["fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "opacity", "clip-rule", "stop-color", "stop-opacity", "color"];
  const svgWhole = (svg, box) => {
    const all = [svg, ...Array.from(svg.querySelectorAll("*"))];
    const ref = (v) => /url\(/.test(v ?? "");
    /* A clip counts when it cuts something: not a clipPath of one shape round everything it clips (share.xyz wraps each chevron in one). */
    const cuts = (n, v) => {
      if (!v || v === "none") return false;
      const m = /url\(\s*["']?#([^"')\s]+)/.exec(v);
      if (!m) return true;
      const cp = document.getElementById(m[1]);
      if (!cp) return false;
      const shapes = Array.from(cp.children);
      if (shapes.length !== 1 || typeof n.getBBox !== "function") return true;
      try {
        const b = shapes[0].getBBox(), t = n.getBBox();
        return !(b.x <= t.x + 0.5 && b.y <= t.y + 0.5 && b.x + b.width >= t.x + t.width - 0.5 && b.y + b.height >= t.y + t.height - 0.5);
      } catch { return true; }
    };
    /*
     * PAINTED IN MORE THAN ONE COLOUR. A pixel icon of 1×1 rects, each its
     * own fill (gotchi.gg's food bowl: an outline in `currentColor`, the rice
     * #FFFFFF, the bowl #FF5CA8), kept as strokes is geometry alone and draws
     * in one colour: a silhouette. Two or more colours among its shapes, as
     * the browser computed them (`currentColor` and `var(--line)` resolved),
     * and it is kept whole, every shape in its own colour.
     */
    const colours = new Set();
    for (const n of all) {
      /* Only what is drawn: a shape inside a clip, a mask, a pattern or defs is a stencil, not a colour of the icon. */
      if (!SHAPES.has(n.tagName.toLowerCase()) || n.closest("clipPath, mask, pattern, defs, marker, symbol")) continue;
      const c = getComputedStyle(n);
      if (c.fill && c.fill !== "none" && !/^rgba\(.*,\s*0\)$/.test(c.fill) && Number(c.fillOpacity) !== 0) colours.add(c.fill);
      if (c.stroke && c.stroke !== "none" && (num(c.strokeWidth) ?? 1) > 0 && !/^rgba\(.*,\s*0\)$/.test(c.stroke)) colours.add(c.stroke);
    }
    /*
     * DRAWN AS THE BUILDER'S ICON DRAWS IT, OR KEPT WHOLE. The strokes are
     * drawn back in one colour (the converter carries it as the part's),
     * all as outlines or all as fills, level and opaque (polio's
     * vector.ts#vectorMarkup). trumpmorty.fun's pill is a rect turned
     * `rotate(-35 12 12)`, filled white and outlined in ink by a stylesheet:
     * as strokes it came back level and outlined in one colour. Any shape
     * turned (by its attribute, a group's, or CSS), outlines and fills
     * together, or a shape seen through, and the svg is kept whole, its
     * computed paint and turns written on it (check-svg-paint.mjs). A plain
     * one-colour icon stays a drawn icon, whatever its width and caps: one
     * the Builder can recolour and resize (check-capture-fixes (11),
     * check-late-art (4)).
     */
    const turned = all.some((n) => n !== svg && getComputedStyle(n).transform !== "none");
    let filled = 0, stroked = 0, faint = false;
    for (const n of all) {
      if (!SHAPES.has(n.tagName.toLowerCase()) || n.closest("clipPath, mask, pattern, defs, marker, symbol")) continue;
      const c = getComputedStyle(n);
      const fills = c.fill && c.fill !== "none" && !/^rgba\(.*,\s*0\)$/.test(c.fill) && Number(c.fillOpacity) !== 0;
      const strokes = c.stroke && c.stroke !== "none" && (num(c.strokeWidth) ?? 1) > 0 && !/^rgba\(.*,\s*0\)$/.test(c.stroke);
      if (fills) filled++;
      if (strokes) stroked++;
      if (Number(c.opacity) < 1 || (fills && Number(c.fillOpacity) < 1) || (strokes && Number(c.strokeOpacity) < 1)) faint = true;
    }
    /* Outlines and fills together (the drawn icon draws all of one), or a shape seen through. */
    const unlike = (filled > 0 && stroked > 0) || faint;
    const needs = colours.size > 1 || turned || unlike || svg.querySelector("use, image, text, foreignObject, pattern") || all.some((n) => { const c = getComputedStyle(n); return ref(c.fill) || ref(c.stroke) || cuts(n, c.clipPath) || (c.mask && c.mask !== "none") || (n !== svg && c.filter && c.filter !== "none"); });
    if (!needs) return null;
    const copy = svg.cloneNode(true);
    const copies = [copy, ...Array.from(copy.querySelectorAll("*"))];
    all.forEach((n, i) => {
      const c = getComputedStyle(n);
      /* Its own turn as the browser resolved it (attribute or CSS, its origin and box): the matrix from its parent's space to its own. */
      if (n !== svg && c.transform !== "none" && typeof n.getScreenCTM === "function" && typeof n.parentNode?.getScreenCTM === "function") {
        try {
          const m = n.parentNode.getScreenCTM().inverse().multiply(n.getScreenCTM());
          copies[i].setAttribute("transform", `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map((v) => +v.toFixed(6)).join(" ")})`);
          if (copies[i].getAttribute("style")) { copies[i].style.removeProperty("transform"); copies[i].style.removeProperty("transform-origin"); copies[i].style.removeProperty("transform-box"); }
        } catch { /* a shape with no matrix to give (display none) keeps what it had */ }
      }
      /* As an attribute, and over any inline style: `style="fill:var(--line)"` names a variable the file alone does not have, and a style beats an attribute (gotchi.gg's tombstone and device mark came out black). */
      for (const p of SVG_PAINT) { const v = c.getPropertyValue(p); if (v) { copies[i].setAttribute(p, v); if (copies[i].getAttribute("style")) copies[i].style.setProperty(p, v); } }
      for (const p of ["clip-path", "mask", "filter"]) { const v = c.getPropertyValue(p); if (v && v !== "none" && (n !== svg || p !== "filter")) copies[i].setAttribute(p, v); }
    });
    /*
     * A picture drawn from a file loads nothing from outside it and has no
     * web fonts (check-svg-whole.mjs): each <image> it holds is marked with
     * its full address for capture-route.mjs to write in, and its <text> is
     * taken out, since its words are parts of their own in the page's face.
     */
    for (const im of Array.from(copy.querySelectorAll("image"))) {
      const href = im.getAttribute("href") ?? im.getAttribute("xlink:href");
      if (!href || /^data:/.test(href)) continue;
      im.removeAttribute("xlink:href");
      im.setAttribute("href", new URL(href, location.href).href);
      im.setAttribute("data-sink-inline", "1");
    }
    for (const tx of Array.from(copy.querySelectorAll("text"))) tx.remove();
    /* Defs it points at from outside itself (a sprite sheet elsewhere on the page). */
    const inside = new Set(copies.map((n) => n.id).filter(Boolean));
    const wanted = new Set();
    for (const n of copies) for (const a of Array.from(n.attributes)) {
      for (const m of a.value.matchAll(/url\(\s*["']?#([^"')\s]+)/g)) wanted.add(m[1]);
      if ((a.name === "href" || a.name === "xlink:href") && a.value.startsWith("#")) wanted.add(a.value.slice(1));
    }
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    for (const id of wanted) if (!inside.has(id)) { const d = document.getElementById(id); if (d) defs.appendChild(d.cloneNode(true)); }
    if (defs.childNodes.length) copy.insertBefore(defs, copy.firstChild);
    copy.removeAttribute("style");
    copy.removeAttribute("class");
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    copy.setAttribute("width", String(round(box.w)));
    copy.setAttribute("height", String(round(box.h)));
    const markup = new XMLSerializer().serializeToString(copy);
    return markup.length <= 400 * 1024 ? markup : null;
  };
  /*
   * A BOX CUT BY A MASK. An icon drawn as a colour through `mask-image` (a
   * heart: `background: var(--ink)` cut by an svg of the heart, and its
   * `::after` in pink cut by the inside) is, read as a box, a solid square
   * of its colour. It is kept as a picture of itself instead: its fill cut
   * by the mask, alpha as CSS masks it, the mask laid as `mask-size` and
   * `mask-position` lay it. A mask by address is written with its address,
   * `data-sink-inline`, for capture-route.mjs to fetch and write in, since a
   * picture drawn as a file loads nothing from outside itself. Only a mask
   * over a plain fill: one over words or a picture is not a picture of it.
   */
  const maskWhole = (cs, box) => {
    const img = cs.maskImage || cs.webkitMaskImage;
    if (!img || img === "none" || !(box.w > 0 && box.h > 0)) return null;
    const layers = Array.from(img.matchAll(/url\((["']?)(.*?)\1\)/g)).map((m) => m[2]);
    if (!layers.length || !paints(cs.backgroundColor) || (cs.backgroundImage && cs.backgroundImage !== "none")) return null;
    const W = box.w, H = box.h;
    const pick = (list, i) => { const parts = (list ?? "").split(/,(?![^(]*\))/); return (parts[i] ?? parts[0] ?? "").trim(); };
    const len = (v, of) => (/%$/.test(v) ? (num(v) / 100) * of : num(v));
    const esc = (v) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const ns = "http://www.w3.org/2000/svg";
    let defs = "", i = 0;
    for (const src of layers) {
      const size = pick(cs.maskSize || cs.webkitMaskSize, i), pos = pick(cs.maskPosition || cs.webkitMaskPosition, i);
      let w = W, h = H, fit = "none";
      if (size === "contain") fit = "xMidYMid meet";
      else if (size === "cover") fit = "xMidYMid slice";
      else if (size && size !== "auto" && size !== "auto auto") { const [a, b = "auto"] = size.split(/\s+/); w = a === "auto" ? W : len(a, W) ?? W; h = b === "auto" ? (a === "auto" ? H : w) : len(b, H) ?? H; if (b === "auto" && a !== "auto") fit = "xMidYMid meet"; }
      else fit = "xMidYMid meet";
      const [px = "0%", py = "0%"] = (pos || "0% 0%").split(/\s+/);
      const x = /%$/.test(px) ? (num(px) / 100) * (W - w) : num(px) ?? 0, y = /%$/.test(py) ? (num(py) / 100) * (H - h) : num(py) ?? 0;
      const inline = /^data:/.test(src) ? "" : ` data-sink-inline="1"`;
      defs += `<image href="${esc(src)}"${inline} x="${round(x * 100) / 100}" y="${round(y * 100) / 100}" width="${round(w * 100) / 100}" height="${round(h * 100) / 100}" preserveAspectRatio="${fit}"/>`;
      i++;
    }
    const markup = `<svg xmlns="${ns}" width="${round(W)}" height="${round(H)}" viewBox="0 0 ${W} ${H}"><defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}" style="mask-type:alpha">${defs}</mask></defs><rect width="${W}" height="${H}" fill="${cs.backgroundColor}" mask="url(#m)"/></svg>`;
    return markup.length <= 400 * 1024 ? markup : null;
  };
  /*
   * ONE ROW PER ROW TYPE (the owner's rule, docs/fidelity/stonkfun-xyz.md).
   * A list of many children of one shape is the backend's data: stonkfun's
   * /rewards is ~372,000 elements of it. The list keeps its own box, the
   * rows of its first line (so a grid shows its columns), and the first
   * row of every other shape; `rows` says how many it had. A shape is the
   * tag, the classes and the tags of the row's own children.
   */
  const ROWS_MIN = 12;
  const shapeOf = (k) => `${k.tagName}.${[...k.classList].sort().join(".")}>${Array.from(k.children).map((c) => c.tagName).join(",")}`;
  const rowsOf = (el) => {
    const all = Array.from(el.children);
    if (all.length < ROWS_MIN) return null;
    const by = new Map();
    for (const k of all) { const sh = shapeOf(k); by.set(sh, [...(by.get(sh) ?? []), k]); }
    const [top, most] = [...by.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (most.length < ROWS_MIN) return null;
    const firstTop = most[0].getBoundingClientRect().top;
    const line = most.filter((k) => Math.abs(k.getBoundingClientRect().top - firstTop) < 1);
    const keep = new Set(line);
    for (const [sh, ks] of by) if (sh !== top) { if (ks.length > 1) keep.add(ks[0]); else ks.forEach((k) => keep.add(k)); }
    return { keep: all.filter((k) => keep.has(k)), of: all.length, shapes: by.size };
  };
  /*
   * What a running animation drives, read at rest: the animations whose
   * keyframes touch any of `props` are taken off, the element read, and
   * each put back where it was. A value caught mid-loop is one frame of the
   * motion, not the element's look, and a keyframe rule with no 0% or 100%
   * of its own starts from and returns to the look (check-keyframe-stops.mjs).
   */
  const atRest = (el, props, read, pe = null) => {
    const touches = (a) => { try { return a.playState !== "idle" && (a.effect?.pseudoElement ?? null) === pe && (a.effect?.getKeyframes?.() ?? []).some((k) => props.some((p) => k[p] !== undefined)); } catch { return false; } };
    /* A pseudo-element's animations are its element's, asked for with `subtree` (a drip's ::before stretching). */
    const off = (pe ? el.getAnimations?.({ subtree: true }) ?? [] : el.getAnimations?.() ?? []).filter(touches);
    if (!off.length) return read(getComputedStyle(el, pe));
    const at = off.map((a) => [a.currentTime, a.playState]);
    off.forEach((a) => a.cancel());
    try { return read(getComputedStyle(el, pe)); } finally { off.forEach((a, i) => { a.play(); a.currentTime = at[i][0]; if (at[i][1] === "paused") a.pause(); }); }
  };
  const walk = (el, ctx = { acc: null, cb: { x: 0, y: 0, w: innerWidth, h: innerHeight } }) => {
    const t = el.tagName.toLowerCase();
    if (SKIP.has(t)) return null;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return null;
    /* Inside an svg a transform is the drawing's own geometry: left as it is. */
    const inSvg = el instanceof SVGElement && t !== "svg";
    /* What the browser does not draw though it has a box: a closed details' answer, anything under `content-visibility: hidden` (check-details.mjs). A press that opens it keeps it as a state. */
    if (!inSvg && cs.display !== "contents" && typeof el.checkVisibility === "function" && !el.checkVisibility()) return null;
    /* A transform an animation drives (trumpmorty's badge, `pulse` to `scale(1.05) rotate(2deg)`) is read at rest, as the opacity is. */
    const tf = inSvg || !cs.transform || cs.transform === "none" ? cs.transform : atRest(el, ["transform"], (c) => c.transform);
    const tfo = cs.transformOrigin;
    /* Whatever moves it now, at rest or mid-loop, is lifted while it is measured. */
    const moving = cs.transform;
    /*
     * The transform properties of their own (`rotate`, `translate`, `scale`)
     * move a box as `transform` does: trumpmorty's planet spins with
     * `rotate`, and measured mid-turn its 860px came in at 1129. They are
     * lifted with it. One a running animation drives is its motion, not its
     * place, and stays out of `ptf`; one set still is part of it.
     */
    const indiv = inSvg ? {} : Object.fromEntries(["translate", "rotate", "scale"].map((p) => [p, cs.getPropertyValue(p)]).filter(([, v]) => v && v !== "none"));
    const lifted = [...(!inSvg && moving && moving !== "none" ? ["transform"] : []), ...Object.keys(indiv)];
    let undo = null;
    if (lifted.length) {
      const st = el.style;
      undo = ["transition", ...lifted].map((p) => [p, st.getPropertyValue(p), st.getPropertyPriority(p)]);
      st.setProperty("transition", "none", "important");
      for (const p of lifted) st.setProperty(p, "none", "important");
    }
    const animated = new Set();
    if (Object.keys(indiv).length) for (const a of el.getAnimations?.() ?? []) { try { for (const k of a.effect?.getKeyframes?.() ?? []) for (const p of Object.keys(indiv)) if (k[p] !== undefined) animated.add(p); } catch { /* no keyframes to read */ } }
    const still = Object.fromEntries(Object.entries(indiv).filter(([p]) => !animated.has(p)));
    try { return walkIn(el, t, cs, tf, tfo, inSvg, ctx, still); } finally {
      if (undo) {
        const st = el.style;
        for (const [p, v, pr] of undo.slice(1)) { if (v) st.setProperty(p, v, pr); else st.removeProperty(p); }
        void getComputedStyle(el).transform;
        const [, v, pr] = undo[0];
        if (v) st.setProperty("transition", v, pr); else st.removeProperty("transition");
      }
    }
  };
  /* translate, then rotate, then scale, then transform, each about the origin, as CSS composes them. */
  const ownMatrix = (tf, still, size = null) => {
    let m = new DOMMatrix();
    /* A translate in % is of the element's own box (Tailwind's `translate: 0 -50%` centring an icon): -50% of 16px is -8px, not -50px (check-search-box.mjs). */
    if (still.translate) { const [x, y] = still.translate.split(/\s+/).map((v, i) => (/%$/.test(v) && size ? (parseFloat(v) / 100) * (i === 0 ? size.w : size.h) : num(v) ?? 0)); m = m.translate(x ?? 0, y ?? 0); }
    if (still.rotate) { const d = /(-?[\d.]+)(deg|rad|turn|grad)\s*$/.exec(still.rotate); if (d) { const v = Number(d[1]); m = m.rotate(d[2] === "rad" ? (v * 180) / Math.PI : d[2] === "turn" ? v * 360 : d[2] === "grad" ? v * 0.9 : v); } }
    if (still.scale) { const [x, y] = still.scale.split(/\s+/).map(Number); m = m.scale(x, y ?? x); }
    if (tf && tf !== "none") { try { m = m.multiply(new DOMMatrix(tf)); } catch { /* not a matrix */ } }
    return m;
  };
  const walkIn = (el, t, cs, tf, tfo, inSvg, ctx, still = {}) => {
    const r = el.getBoundingClientRect();
    let box = { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
    /*
     * WORDS FOR A SCREEN READER ONLY. gotchi.gg's device says "still an egg."
     * on its screen, drawn on the canvas, and again in a 1×1 box clipped to
     * nothing for a screen reader; read as words, it was drawn above the
     * device. A box a pixel or less, clipping what it holds, or clipped to
     * nothing, is not seen, and is not kept.
     */
    if (!inSvg && t !== "svg" && ((r.width <= 1 && r.height <= 1 && (cs.overflow === "hidden" || cs.overflowX === "hidden" || cs.clip !== "auto")) || /^rect\(0px,? 0px,? 0px,? 0px\)$/.test(cs.clip) || /^inset\(50%\)$/.test(cs.clipPath))) return null;
    let wasGrown = false;
    let holder = false;
    /* A straight stroke (the upright of a "$", the lid of a trash can) has a box with no width or no height, and is still drawn. */
    if (SHAPES.has(t) ? !(r.width > 0 || r.height > 0) : !(r.width > 0 && r.height > 0)) {
      const g = grown?.get(el);
      /* A holder with no box of its own (trumpmorty's 0px-wide antenna) whose children draw: kept for them. */
      if (g) { box = g; wasGrown = true; } else if (SHAPES.has(t) || !el.children.length) return null;
      else holder = true;
    }
    const e = { t, ...edges(box.x, box.y, box.w, box.h) };
    if (paths) e.p = domPath(el);
    if (wasGrown) e.grown = true;
    if (holder) e.holder = true;
    const own0 = !inSvg && ((tf && tf !== "none") || Object.keys(still).length) ? pageMatrix(ownMatrix(tf, still, inSvg ? null : { w: el.offsetWidth ?? box.w, h: el.offsetHeight ?? box.h }), tfo, box) : null;
    const acc = ctx.acc && own0 ? ctx.acc.multiply(own0) : own0 ?? ctx.acc;
    if (!inSvg && !isIdentity(acc)) e.ptf = mround(acc);
    if (!inSvg && el.id) e.domId = el.id;
    /* Its hook, as the design record names parts (PST kit/DESIGN-RECORD.md): a capture of a built page is checked against the record by it. */
    if (!inSvg && el.getAttribute("data-hook")) e.hook = el.getAttribute("data-hook");
    const text = own(el);
    if (text) e.text = text;
    const bg = cs.backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") e.bg = bg;
    /* What an artistic page is made of, as the browser computed it: a background picture or gradient, transparency, blending, filters, the transform it sits under, and its animation. */
    if (cs.backgroundImage && cs.backgroundImage !== "none") {
      e.bgi = cs.backgroundImage;
      e.bgo = [cs.backgroundSize, cs.backgroundPosition, cs.backgroundRepeat];
      /* Painted only inside its letters (`background-clip: text` over transparent words): the gradient is the words' (check-media.mjs (3)). */
      if ((cs.backgroundClip || cs.webkitBackgroundClip) === "text" || cs.webkitBackgroundClip === "text") e.bgclip = "text";
    }
    /*
     * An opacity a running animation drives is read at rest: the animation
     * is its motion. Not only one caught near nothing (a blinking LED caught
     * dark): trumpmorty's LIVE dot, `blink 1s steps(2)` over `50% {opacity: 0}`,
     * runs 1, .5, 0, .5, and caught on a half step it came in as `opacity: .5`,
     * which a keyframe with no 0% or 100% of its own then starts from and
     * returns to, so the copy ran .5, .25, 0, .25 (check-keyframe-stops.mjs).
     */
    const op = cs.opacity === "1" ? "1" : atRest(el, ["opacity"], (c) => c.opacity);
    if (op !== "1") e.op = num(op);
    if (cs.mixBlendMode && cs.mixBlendMode !== "normal") e.blend = cs.mixBlendMode;
    if (cs.filter && cs.filter !== "none") e.filter = cs.filter;
    if (cs.backdropFilter && cs.backdropFilter !== "none") e.bfilter = cs.backdropFilter;
    if (tf && tf !== "none") { e.tf = tf; e.tfo = cs.transformOrigin; }
    /* The point it turns about, for what animates a turn with no transform at rest (a keyframe from nothing to rotate). */
    else if (cs.animationName && cs.animationName !== "none") e.tfo = cs.transformOrigin;
    const mask = cs.maskImage ?? cs.webkitMaskImage;
    if (mask && mask !== "none") e.mask = [mask, cs.maskSize ?? cs.webkitMaskSize, cs.maskPosition ?? cs.webkitMaskPosition, cs.maskRepeat ?? cs.webkitMaskRepeat];
    if (cs.animationName && cs.animationName !== "none") e.anim = cs.animationName;
    if (cs.pointerEvents === "none") e.inert = true;
    if (cs.clipPath && cs.clipPath !== "none") e.clip = cs.clipPath;
    /* Its animation with every longhand, its transitions, and the :hover / :focus rules that move it. */
    const mo = motionOf(el, cs);
    if (mo) e.motion = mo;
    /* A frame of another page (a chart, a player): what it loads and what it may do, never its insides. */
    if (t === "iframe") {
      const src = el.getAttribute("src") ? el.src : el.dataset.src ?? "";
      e.embed = { src, ...(el.getAttribute("allow") ? { allow: el.getAttribute("allow") } : {}), ...(el.hasAttribute("sandbox") ? { sandbox: el.getAttribute("sandbox") } : {}), ...(el.title ? { title: el.title } : {}), ...(el.getAttribute("loading") ? { loading: el.getAttribute("loading") } : {}) };
    }
    /* What it clips: a box whose overflow is not visible cuts what pokes out of its padding box. */
    const bw = sides(cs, "border");
    const padBox = { x: box.x + bw[3], y: box.y + bw[0], w: box.w - bw[1] - bw[3], h: box.h - bw[0] - bw[2] };
    if (!inSvg && t !== "svg" && t !== "body" && el.children.length && (cs.overflowX !== "visible" || cs.overflowY !== "visible")) {
      e.ov = { x: cs.overflowX, y: cs.overflowY, box: (({ x, y, w, h }) => [x, y, w, h])(edges(padBox.x, padBox.y, padBox.w, padBox.h)) };
      /* Rounded, it cuts to its padding box's curve, not its square: the CA bar's yellow ends, the picture in the TV's screen. */
      const inner = corners(cs, box.w, box.h, bw);
      if (inner.some(([rx, ry]) => rx > 0 && ry > 0)) e.ov.rad = inner;
    }
    /* A positioned or transformed box is the containing block of what is placed absolute inside it. */
    const kidCtx = { acc, cb: !inSvg && (cs.position !== "static" || (tf && tf !== "none")) ? padBox : ctx.cb };
    const kids = [];
    if (!inSvg) { const b = pseudoOf(el, "::before", kidCtx.cb, acc); if (b) kids.push(b); }
    /* Not inside an svg, nor the svg itself: its shapes are one drawing, and a pixel icon of a hundred 1×1 rects cut to its first row drew a dash. */
    /* A page the capture loaded with list-trim.js has had its long lists cut in place, laid out at what they kept: that is the rule, and it says what each had. The console snippet, without it, cuts here. */
    const trimmed = window.__sinkTrims?.get(el);
    const cut = inSvg || t === "svg" || window.__sinkTrims ? null : rowsOf(el);
    for (const k of cut ? cut.keep : Array.from(el.children)) { const got = walk(k, kidCtx); if (got) kids.push(got); }
    if (cut) e.rows = { of: cut.of, kept: cut.keep.length, shapes: cut.shapes };
    if (trimmed) e.rows = { of: trimmed.of, kept: trimmed.kept, trimmed: true, ...(trimmed.endless ? { endless: true } : {}), ...(trimmed.rebuilt ? { rebuilt: true } : {}) };
    if (!inSvg) { const a = pseudoOf(el, "::after", kidCtx.cb, acc); if (a) kids.push(a); }
    const leaf = !Array.from(el.children).length;
    /* Where its own words are, when it also holds elements: the box round its own text, which a button sets its words in. */
    if (text && !leaf) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const q of Array.from(rg.getClientRects())) if (q.width && q.height) { x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom); }
      }
      if (x1 > x0) { const b = edges(x0 + scrollX, y0 + scrollY, x1 - x0, y1 - y0); e.tb = [b.x, b.y, b.w, b.h]; }
      /*
       * EACH RUN OF ITS OWN WORDS, WHERE IT IS. "Match: <code>…</code> Round:
       * <b>0</b>" and a nav's "Play | Leaderboard | …" bars are words between
       * elements: joined, with one box round them all, nothing could say
       * where each goes, and they were folded in as one block or left over
       * the values. Each text node the browser draws (a space between two
       * elements too), in order: its words with their white space collapsed
       * as the browser collapses it (a space at either end kept), its box,
       * and how many lines it takes (check-script-built.mjs (4)).
       */
      const ot = [];
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType !== 3 || !n.textContent) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        const qs = Array.from(rg.getClientRects()).filter((q) => q.width > 0 && q.height > 0);
        if (!qs.length) continue;
        const [l, t, r, b] = [Math.min(...qs.map((q) => q.left)), Math.min(...qs.map((q) => q.top)), Math.max(...qs.map((q) => q.right)), Math.max(...qs.map((q) => q.bottom))];
        const bx = edges(l + scrollX, t + scrollY, r - l, b - t);
        ot.push([n.textContent.replace(/\s+/g, " "), bx.x, bx.y, bx.w, bx.h, new Set(qs.map((q) => Math.round(q.top))).size]);
      }
      if (ot.length) e.ot = ot;
    }
    if (text || leaf) {
      e.color = cs.color;
      const fs = num(cs.fontSize); if (fs !== null) e.fs = fs;
      const fsu = fluidFont(el); if (fsu) e.fsu = fsu;
      e.fw = cs.fontWeight;
      e.ff = family(cs.fontFamily);
      /* The whole stack: a glyph the first face lacks (VT323 has no ✈) is drawn by the next. */
      if (cs.fontFamily.includes(",")) e.ffs = cs.fontFamily;
      const lh = num(cs.lineHeight); if (lh !== null) e.lh = lh;
      e.ls = cs.letterSpacing;
      e.ta = cs.textAlign;
      e.tt = cs.textTransform;
      /* Its lines evened out (`text-wrap: balance`) or kept from ending on one word (`pretty`): where it wraps is part of the design (check-line-breaks.mjs). */
      { const tw = String(cs.textWrapStyle || cs.textWrap || ""); if (/balance|pretty/.test(tw)) e.tw = /balance/.test(tw) ? "balance" : "pretty"; }
      /* Outlined and offset-shadowed type: the sticker look. */
      if (cs.textShadow && cs.textShadow !== "none") e.tsh = cs.textShadow;
      const tsw = num(cs.webkitTextStrokeWidth);
      if (tsw) e.tstroke = { w: tsw, color: cs.webkitTextStrokeColor };
      if (cs.paintOrder && cs.paintOrder !== "normal") e.porder = cs.paintOrder;
    }
    if (cs.display === "flex" || cs.display === "grid" || cs.display === "inline-flex" || cs.display === "inline-grid") {
      e.disp = cs.display.replace("inline-", "");
      e.dir = cs.flexDirection;
      e.gap = cs.gap;
      /* How a grid sets each item across its cell (`place-items: center`): the words of a numbered dot. */
      if (e.disp === "grid" && cs.justifyItems && !/^(normal|legacy|stretch|start)$/.test(cs.justifyItems)) e.ji = cs.justifyItems;
      e.just = cs.justifyContent;
      e.align = cs.alignItems;
      e.wrap = cs.flexWrap;
      if (e.disp === "grid") { e.cols = cs.gridTemplateColumns; e.items = cs.justifyItems; }
    }
    if (cs.minHeight !== "0px") e.minh = cs.minHeight;
    for (const u of unitRules) { let hit = false; try { hit = el.matches(u.selector); } catch { /* a selector this browser does not take */ } if (hit) (e.vu ??= {})[u.prop === "min-height" ? "minHeight" : "height"] = u.value; }
    /* How tall it is on its own, the window's height aside: a hero `min-height: 100svh` in a short window is as tall as what it holds (trumpmorty's 808 at 1440 × 819). Measured once with the floor lifted, then put back. */
    if (e.vu?.minHeight) {
      const was = el.style.getPropertyValue("min-height"), pr = el.style.getPropertyPriority("min-height");
      el.style.setProperty("min-height", "0px", "important");
      e.vu.content = round(el.getBoundingClientRect().height);
      if (was) el.style.setProperty("min-height", was, pr); else el.style.removeProperty("min-height");
    }
    if (cs.maxWidth !== "none") e.maxw = cs.maxWidth;
    const mar = [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].map((v) => round(num(v) ?? 0));
    if (!zeroes(mar)) e.mar = mar;
    const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map((v) => round(num(v) ?? 0));
    if (!zeroes(pad)) e.pad = pad;
    if ((num(cs.borderTopWidth) ?? 0) > 0 && cs.borderTopStyle !== "none") {
      e.border = cs.border && cs.border.trim() ? cs.border : `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`;
    }
    /* An edge on some sides only (trumpmorty's COPY: a left edge; its ribbons: top and bottom): each side's width, and the first drawn side when the top has none. */
    if (bw.some(Boolean) && !bw.every((v) => v === bw[0])) {
      e.bsides = bw;
      if (!e.border) { const s = ["Top", "Right", "Bottom", "Left"][bw.findIndex(Boolean)]; e.border = `${cs[`border${s}Width`]} ${cs[`border${s}Style`]} ${cs[`border${s}Color`]}`; }
    }
    /* Sides of one width in different colours (a bevel, a four-colour frame): each side's colour, and its width, so it is drawn side by side too. */
    const bc = sideColours(cs, bw);
    if (bc) {
      e.bsides = bw;
      e.bcolours = bc;
      if (!e.border) { const s = ["Top", "Right", "Bottom", "Left"][bw.findIndex(Boolean)]; e.border = `${cs[`border${s}Width`]} ${cs[`border${s}Style`]} ${cs[`border${s}Color`]}`; }
    }
    /* A glow or a drop shadow, as the browser computed it. */
    if (cs.boxShadow && cs.boxShadow !== "none") e.shadow = cs.boxShadow;
    /* Rounded corners, clockwise from the top left, in px; a percentage is taken of the box's shorter side. */
    const rad = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((v) => {
      const n = num(v) ?? 0;
      return round(/%/.test(v ?? "") ? (n / 100) * Math.min(e.w, e.h) : n);
    });
    if (!zeroes(rad)) e.radius = rad;
    /* A corner rounded as an ellipse (28px / 34px) keeps both of its radii. */
    { const c = corners(cs, e.w, e.h); if (c.some(([rx, ry]) => rx !== ry)) e.rxy = c; }
    if (cs.position !== "static") {
      e.pos = cs.position;
      e.ins = [cs.top, cs.right, cs.bottom, cs.left];
      e.z = cs.zIndex;
      const au = placeOf(el, cs); if (au) e.au = au;
    }
    if (t === "img") e.src = el.currentSrc || el.src;
    /* A video: where it plays from and how (check-media.mjs); its poster is its picture, else capture-route.mjs keeps the frame it shows. */
    if (t === "video") {
      const abs = (u) => { try { return u ? new URL(u, location.href).href : null; } catch { return null; } };
      const src = el.currentSrc || el.getAttribute("src") || el.querySelector("source[src]")?.getAttribute("src");
      e.video = { src: abs(src), poster: abs(el.getAttribute("poster")), autoplay: el.autoplay, loop: el.loop, muted: el.muted || el.defaultMuted || el.hasAttribute("muted"), controls: el.controls, playsinline: el.playsInline, at: Array.from(document.querySelectorAll("video")).indexOf(el) };
      if (e.video.poster) e.src = e.video.poster;
    }
    /* A canvas keeps what it drew (check-canvas.mjs): its pixels as a PNG, when it is readable (not tainted) and not blank. */
    /* Pixels drawn square (pixel art scaled up): said, so its picture is not smoothed when it is drawn larger than it is. */
    if ((t === "canvas" || t === "img") && cs.imageRendering && cs.imageRendering !== "auto") e.ir = cs.imageRendering;
    /* A canvas that repainted while capture-route.mjs watched it: every picture it showed and how long each stood. */
    if (t === "canvas" && el.dataset.sinkCanvas !== undefined && window.__sinkFrames?.[el.dataset.sinkCanvas]) e.frames = window.__sinkFrames[el.dataset.sinkCanvas];
    /* A canvas world (worlds.mjs): where each character stands in each frame, and the dialog it opens, dressed in the page's own look (`css`). */
    if (t === "canvas" && el.dataset.sinkCanvas !== undefined && window.__sinkWorlds?.by?.[el.dataset.sinkCanvas]) e.world = { ...window.__sinkWorlds.by[el.dataset.sinkCanvas], css: window.__sinkWorlds.css ?? {} };
    if (t === "canvas" && el.width && el.height && el.width * el.height <= 4_000_000) {
      try {
        const px = el.getContext("2d", { willReadFrequently: true })?.getImageData(0, 0, el.width, el.height).data;
        let drawn = !px; /* a webgl canvas has no 2d context: taken as drawn */
        if (px) for (let i = 3; i < px.length; i += 4) if (px[i]) { drawn = true; break; }
        if (drawn) { const url = el.toDataURL("image/png"); if (url.length > 30 && url.length < 3_000_000) e.drawn = url; }
      } catch { /* tainted by another origin's picture: it stays a box */ }
    }
    if (t === "a" && el.getAttribute("href") !== null) e.href = el.getAttribute("href");
    const title = el.getAttribute("title") || el.getAttribute("aria-label");
    if (title && (t === "a" || t === "button")) e.title = title.trim();
    const aria = el.getAttribute("aria-label"); if (aria) e.aria = aria.trim();
    if (el.dataset.axRole) e.role = el.dataset.axRole;
    if (el.dataset.axName) e.name = el.dataset.axName;
    if (el.dataset.axState) e.state = JSON.parse(el.dataset.axState);
    if (t === "input" || t === "textarea" || t === "select") {
      e.type = t === "input" ? (el.getAttribute("type") || "text") : t;
      if (el.getAttribute("placeholder")) e.placeholder = el.getAttribute("placeholder");
      if (el.value) e.value = el.value;
      /*
       * WHAT THE FIELD SHOWS (check-search-box.mjs): its value, or when empty
       * its placeholder in the placeholder's own colour, as words of the box;
       * a one-line field sets them in the middle of its height, as the
       * browser does, whatever padding the page gave above and below.
       */
      const texty = t === "textarea" || (t === "input" && /^(text|search|email|url|tel|number|password)$/i.test(e.type));
      const shown = el.value ? (e.type === "password" ? "•".repeat(el.value.length) : el.value) : el.getAttribute("placeholder");
      if (texty && shown) {
        e.text = shown;
        e.color = el.value ? cs.color : getComputedStyle(el, "::placeholder").color || cs.color;
        if (!el.value) e.phShown = true;
        if (t === "input") {
          const bt = num(cs.borderTopWidth) ?? 0, bb = num(cs.borderBottomWidth) ?? 0;
          const line = num(cs.lineHeight) ?? (num(cs.fontSize) ?? 16) * 1.2;
          const v = Math.max(0, round((box.h - bt - bb - line) / 2));
          const pad = e.pad ?? [0, 0, 0, 0];
          e.pad = [v, pad[1], v, pad[3]];
        }
      }
    }
    if (t === "svg" && el.getAttribute("viewBox")) e.vb = el.getAttribute("viewBox");
    if (t === "svg") { const whole = svgWhole(el, box); if (whole) e.svgMarkup = whole; }
    /* Drawn on the pixel grid (gotchi.gg's X, `shape-rendering: crispEdges`): said, so a drawn icon keeps its hard edges. */
    if (t === "svg" && !e.svgMarkup && /crispEdges|optimizeSpeed/i.test(cs.shapeRendering)) e.crisp = true;
    else if (!inSvg) { const masked = maskWhole(cs, box); if (masked) { e.svgMarkup = masked; e.masked = true; } }
    /* The live values it shows, as sources-recorder.js marked them: ids into the capture's `sources.feeds`. */
    const feeds = el.getAttribute("data-sink-feeds");
    if (feeds) e.feeds = feeds.split(",");
    /* What its script does to it, as behaviours-recorder.js marked it: ids into the capture's `behaviours`. */
    const bh = el.getAttribute("data-sink-bh");
    if (bh) e.bh = bh.split(" ");
    /* A press an automatic capture holds back (held.mjs): why, what is known of it, its stable name and where it is on the live page. */
    const held = el.getAttribute("data-sink-held");
    if (held) { try { e.held = JSON.parse(held); } catch { /* not ours */ } }
    if (SHAPES.has(t)) {
      const d = pathOf(el); if (d) e.d = d;
      /* How the stroke is drawn: an outline in its stroke colour, or a filled shape. */
      e.fill = cs.fill; e.stroke = cs.stroke; const sw = num(cs.strokeWidth); if (sw !== null) e.sw = sw;
      /* How a stroke ends and turns, when not the defaults (butt, miter). */
      if (cs.strokeLinecap && cs.strokeLinecap !== "butt") e.cap = cs.strokeLinecap;
      if (cs.strokeLinejoin && cs.strokeLinejoin !== "miter") e.join = cs.strokeLinejoin;
    }
    if (holder && !kids.length) return null;
    if (kids.length) e.kids = kids;
    return e;
  };
  /*
   * THE HEAD: what a link preview and a tab are drawn from (check-head.mjs).
   * Its title, description and theme colour; every og:* and twitter:* as
   * written, the first of each, an address among them made absolute; its
   * icons, touch icon, mask icon and manifest, by absolute address.
   */
  const headOf = () => {
    const meta = {};
    const isUrl = (k) => /^(og:(url|image|image:url|image:secure_url|video|video:url|video:secure_url|audio)|twitter:(image|image:src|player))$/i.test(k);
    for (const m of Array.from(document.querySelectorAll("meta[property], meta[name]"))) {
      const key = (m.getAttribute("property") || m.getAttribute("name") || "").trim();
      const value = (m.getAttribute("content") ?? "").trim();
      if (!/^(og|twitter):/i.test(key) || !value || key in meta) continue;
      meta[key] = isUrl(key) ? abs(value, location.href) : value;
    }
    const named = (n) => document.querySelector(`meta[name="${n}"]`)?.getAttribute("content")?.trim() || undefined;
    const RELS = ["icon", "shortcut icon", "apple-touch-icon", "apple-touch-icon-precomposed", "mask-icon", "manifest"];
    const links = Array.from(document.querySelectorAll("link[rel][href]")).filter((l) => RELS.includes(l.rel.toLowerCase().trim())).map((l) => ({
      rel: l.rel.toLowerCase().trim(), href: l.href,
      ...(l.getAttribute("sizes") ? { sizes: l.getAttribute("sizes") } : {}),
      ...(l.getAttribute("type") ? { type: l.getAttribute("type") } : {}),
      ...(l.getAttribute("color") ? { color: l.getAttribute("color") } : {}),
    }));
    const head = { title: document.title, description: named("description"), themeColor: named("theme-color"), meta, links };
    return Object.fromEntries(Object.entries(head).filter(([, v]) => v !== undefined && v !== ""));
  };
  /* The page's `@font-face` rules, as siteRead.ts#FACES reads them. */
  const faces = [];
  const links = [];
  const abs = (u, base) => { try { return new URL(u, base).href; } catch { return u; } };
  const rules = (list, base, sheet) => {
    for (const r of Array.from(list)) {
      if (r instanceof CSSFontFaceRule) {
        const st = r.style;
        const fam = st.getPropertyValue("font-family").trim().replace(/^["']|["']$/g, "");
        const src = st.getPropertyValue("src");
        const sources = [];
        const re = /url\((["']?)([^)"']+)\1\)(?:\s*format\((["']?)([^)"']+)\3\))?/g;
        let m;
        while ((m = re.exec(src))) sources.push({ url: abs(m[2], base), ...(m[4] ? { format: m[4] } : {}) });
        if (fam && sources.length) {
          const weight = st.getPropertyValue("font-weight").trim();
          const style = st.getPropertyValue("font-style").trim();
          const range = st.getPropertyValue("unicode-range").trim();
          faces.push({ family: fam, ...(weight ? { weight } : {}), ...(style ? { style } : {}), sources, sheet, ...(range ? { unicodeRange: range } : {}) });
        }
      } else if (r instanceof CSSImportRule) {
        try { const inner = r.styleSheet; if (inner) rules(inner.cssRules, inner.href ?? base, inner.href ?? sheet); } catch { if (r.href) links.push({ href: abs(r.href, base), at: faces.length }); }
      } else if (r.cssRules) rules(r.cssRules, base, sheet);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    let list = null;
    /* `at`: where its faces stand among the others. The browser takes the last rule declared for a character two ranges both cover, so order is part of the face. */
    try { list = sheet.cssRules; } catch { if (sheet.href) links.push({ href: sheet.href, at: faces.length }); continue; }
    if (list) rules(list, sheet.href ?? location.href, sheet.href ?? null);
  }
  const body = getComputedStyle(document.body);
  return {
    url: location.href,
    title: document.title,
    capturedAt: new Date().toISOString(),
    viewport: [innerWidth, innerHeight],
    page: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    bodyBg: body.backgroundColor,
    bodyColor: body.color,
    font: body.fontFamily,
    faces: { faces, links },
    ...(keyframes.size ? { keyframes: [...keyframes.values()] } : {}),
    /* Every box is the one the layout gave, its transform in `tf` and `ptf` (see walk). */
    untransformed: true,
    tree: walk(document.body),
    head: headOf(),
    /* Every link on the page, also those in rows a list does not keep (`rows`): a crawl reads its patterns' ids from them. */
    links: [...new Set(Array.from(document.querySelectorAll("a[href]")).map((a) => a.href).filter((h) => /^https?:/.test(h)))],
  };
};
