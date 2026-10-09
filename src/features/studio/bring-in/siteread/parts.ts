

import type { PartRun, PartStyle, PartControl, PagePart, PageRead } from "./faces.ts";

/**
 * What runs inside the page being read.
 *
 * Two functions, both serialised into the page by the element route and
 * run in its own context, so everything they hand back is the browser's
 * own answer: `getComputedStyle`'s string for a colour, its number for a
 * size, `getBoundingClientRect`'s box. Nothing here describes anything in
 * words for a model to read back — which library part a reading becomes is
 * decided from these numbers in `recreate.ts`.
 *
 * They live here rather than in the route so that they can be run against
 * any page by anything that has a browser: `tests/site-read.mjs` runs them
 * against a fixture served locally, which the route itself will rightly
 * not open, because the bounds allow public https pages only.
 *
 * Pure in the sense that matters: no imports, no closure over anything.
 * A function serialised into another browser context can carry nothing
 * with it, so every helper either lives inside it or is passed in.
 */

/**
 * THE PAGE, ELEMENT BY ELEMENT.
 *
 * `CANDIDATES` names the few big blocks a person would point at, and
 * `MEASURE` reads one block as a whole; a plain page read that way came in
 * as seven bands of words (PST's test page: every heading, paragraph,
 * button and field of a section folded into one part, its hidden panels
 * read as tall blank boxes). This reads the other way round: each heading,
 * paragraph, line, button, link, field, checkbox and picture is a part of
 * its own, under the section it sits in, with the id and data-* attributes
 * the page's code finds it by.
 *
 * What the browser computed is what is kept, so a page with no styles of
 * its own keeps the browser's defaults: an h1 at 32px bold, a button's
 * grey face and edge, a list's bullets, the margins between blocks.
 *
 * Hidden blocks (the hidden attribute, display none) take no room where
 * the page opens, so they are read where they stand without being shown
 * there: each is revealed in place for a moment, read, and hidden again,
 * and its parts carry what hid them. A template is read the same way, from
 * a copy of its contents put beside it and taken away again.
 *
 * Serialised into the page like the two above: no imports, no closure.
 */
export const PARTS = (cap: number): PageRead => {
  const parts: PagePart[] = [];
  let truncated = false;
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "META", "LINK", "HEAD", "TITLE", "BASE", "WBR"]);
  const MEDIA = new Set(["IMG", "SVG", "VIDEO", "CANVAS", "PICTURE", "IFRAME", "AUDIO"]);
  /* An SVG element's tag name is lower case ("svg", "circle"): compared as written, an inline svg was taken for inline words with none and dropped, its circles' hooks with it (PST's duel). */
  const isMedia = (e: Element) => MEDIA.has(e.tagName.toUpperCase());
  const SECTIONING = new Set(["SECTION", "ARTICLE", "ASIDE", "HEADER", "FOOTER", "MAIN", "NAV", "FORM", "FIELDSET", "DETAILS", "DIALOG", "UL", "OL", "DL", "TABLE", "FIGURE"]);
  const SEPARATORS = /^[\s|·•/\\,;:–—\-]*$/;
  const css = (e: Element) => getComputedStyle(e);
  const shown = (e: Element) => css(e).display !== "none";
  /* What a closed <details> holds past its summary: the page does not show it, whatever its display says. */
  const folded = (e: Element) => { const d = e.parentElement; return !!d && d.tagName === "DETAILS" && !(d as HTMLDetailsElement).open && e.tagName !== "SUMMARY"; };
  const inlineish = (e: Element) => { const d = css(e).display; return d.startsWith("inline") || d === "contents"; };
  const isCheck = (e: Element) => e.tagName === "INPUT" && /^(checkbox|radio)$/i.test((e as HTMLInputElement).type);
  const isControl = (e: Element) => {
    const t = e.tagName;
    if (t === "BUTTON" || t === "TEXTAREA" || t === "SELECT") return true;
    if (t === "INPUT") return (e as HTMLInputElement).type !== "hidden";
    return e.getAttribute("role") === "button";
  };
  const checkLabel = (e: Element) => e.tagName === "LABEL" && !!Array.from(e.querySelectorAll("input")).find(isCheck) && !Array.from(e.querySelectorAll("input, select, textarea, button")).some((c) => !isCheck(c) && isControl(c));
  const box = (r: DOMRect) => ({ x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) });
  /* A path the element can be found again by: every step from the body, the same walk `CANDIDATES` makes. Never the id alone: what a section holds is read off its path continuing the section's (`partTree.ts`). */
  const path = (el: Element): string => {
    const bits: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body && bits.length < 40) {
      const parent: Element | null = node.parentElement;
      const tag = node.tagName.toLowerCase();
      if (!parent) { bits.unshift(tag); break; }
      const same = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      bits.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(node) + 1})` : tag);
      node = parent;
    }
    return node === document.body && !bits.length ? "body" : `body > ${bits.join(" > ")}`;
  };
  const hooksOf = (e: Element): Record<string, string> => {
    const h: Record<string, string> = {};
    for (const a of Array.from(e.attributes)) {
      if (a.name === "id" || a.name.startsWith("data-") || a.name.startsWith("aria-") || ((a.name === "name" || a.name === "role") && isControl(e))) h[a.name] = a.value;
    }
    return h;
  };
  const hooked = (e: Element) => e.hasAttribute("id") || Array.from(e.attributes).some((a) => a.name.startsWith("data-"));
  const seeThrough = (c: string) => !c || c === "transparent" || /rgba\([^)]*,\s*0(\.0+)?\s*\)$/.test(c);
  /* A line height of "normal" is the face's own, 18px for 16px Times and not 1.2 of the size: measured once per face and size. Read as 1.2, two lines of a paragraph looked like less than two lines on the board, which sets those on one unbroken line past the page's edge. */
  const normals = new Map<string, number>();
  const normalLine = (s: CSSStyleDeclaration, px: number): number => {
    const key = `${s.fontFamily}|${px}|${s.fontWeight}|${s.fontStyle}`;
    const had = normals.get(key);
    if (had) return had;
    const probe = document.createElement("div");
    probe.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;white-space:nowrap;line-height:normal;font-family:${s.fontFamily};font-size:${px}px;font-weight:${s.fontWeight};font-style:${s.fontStyle}`;
    probe.textContent = "Hxg";
    document.body.appendChild(probe);
    const h = probe.getBoundingClientRect().height || px * 1.2;
    probe.remove();
    normals.set(key, h);
    return h;
  };
  const styleOf = (e: Element, which?: "::before" | "::after"): PartStyle => {
    const s = which ? getComputedStyle(e, which) : css(e);
    const px = parseFloat(s.fontSize) || 16;
    const bw = parseFloat(s.borderTopWidth) || 0;
    return {
      px: Math.round(px * 100) / 100,
      weight: Number(s.fontWeight) || 400,
      family: s.fontFamily,
      italic: s.fontStyle === "italic",
      colour: s.color,
      bg: seeThrough(s.backgroundColor) ? null : s.backgroundColor,
      border: bw > 0 && s.borderTopStyle !== "none" && s.borderTopStyle !== "hidden" ? { w: Math.round(bw * 100) / 100, style: s.borderTopStyle, colour: s.borderTopColor } : null,
      radius: Math.round(parseFloat(s.borderTopLeftRadius) || 0),
      pad: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map((v) => Math.round((parseFloat(v) || 0) * 100) / 100) as [number, number, number, number],
      align: s.textAlign,
      leading: Math.round((parseFloat(s.lineHeight) || normalLine(s, px)) * 100) / 100,
      transform: s.textTransform,
      ...(!which && (s.overflowX !== "visible" || s.overflowY !== "visible") ? { clips: true } : {}),
      /* Its max-width in pixels, where it has one: the export lets it grow with the window up to this and no further (`fluidSite.ts`, node.maxw). */
      ...(!which && /^[\d.]+px$/.test(s.maxWidth) ? { maxw: Math.round(parseFloat(s.maxWidth)) } : {}),
      ...(!which && /^(inline-)?(flex|grid)$/.test(s.display) ? { layout: {
        display: s.display.endsWith("grid") ? "grid" as const : "flex" as const,
        ...(s.display.endsWith("flex") ? { direction: s.flexDirection.startsWith("column") ? "column" as const : "row" as const, ...(s.flexWrap === "wrap" ? { wrap: true } : {}) } : { columns: s.gridTemplateColumns.split(/\s+(?![^(]*\))/).filter(Boolean).length }),
        align: s.alignItems, justify: s.justifyContent,
        ...(parseFloat(s.columnGap) > 0 ? { gap: Math.round(parseFloat(s.columnGap) * 100) / 100 } : {}),
      } } : {}),
    };
  };
  /* Does the page underline this link? Most sites' nav and buttons do not, and the board underlined every link it drew. */
  const underlined = (a: Element) => /underline/.test(css(a).textDecorationLine);
  const paints = (e: Element) => { const s = styleOf(e); return !!s.bg || !!s.border || !!paintOf(css(e)).image; };
  /*
   * WHAT PAINTS IT BESIDES ONE COLOUR. PST's TV body is a linear gradient
   * built from tokens over no background colour, with an offset ink shadow:
   * read for its colour alone it came in as no fill at all, and the board
   * drew it white inside its outline. The background image is kept as the
   * browser computed it (the tokens already resolved), when it is paint the
   * board can draw by itself: gradients, and pictures written into the CSS
   * as data:. A picture at an address of the page's own would be a broken
   * link on the board, and is left out as before.
   */
  type Paint = Pick<PartStyle, "image" | "imageOptions" | "imageClip" | "shadow" | "filter" | "mask" | "maskOptions" | "blend" | "backdrop" | "clipPath" | "textShadow" | "textStroke" | "paintOrder" | "radii" | "animation" | "accent">;
  function paintOf(s: CSSStyleDeclaration): Paint {
    const out: Paint = {};
    const r = s as unknown as Record<string, string>;
    /* A picture at one of the page's own addresses is kept too: whoever opened the page (the zip route) puts its bytes in as data: before it reaches the board (`inlineOwnPictures`). */
    const bi = s.backgroundImage;
    if (bi && bi !== "none") {
      out.image = bi;
      out.imageOptions = [s.backgroundSize, s.backgroundPosition, s.backgroundRepeat];
      const clip = r.webkitBackgroundClip || s.backgroundClip;
      if (clip === "text") out.imageClip = "text";
    }
    /* A mask it is painted through: PST's icons are one colour (background: currentColor) seen through an svg (web/assets/tv). */
    const mk = s.maskImage || r.webkitMaskImage;
    if (mk && mk !== "none") {
      out.mask = mk;
      out.maskOptions = [s.maskSize || r.webkitMaskSize || "auto", s.maskPosition || r.webkitMaskPosition || "0% 0%", s.maskRepeat || r.webkitMaskRepeat || "repeat"];
    }
    if (s.boxShadow && s.boxShadow !== "none") out.shadow = s.boxShadow;
    if (s.filter && s.filter !== "none") out.filter = s.filter;
    if (s.accentColor && s.accentColor !== "auto") out.accent = s.accentColor;
    /* What the builder has no field for yet: kept as computed, as a capture keeps it. */
    if (s.mixBlendMode && s.mixBlendMode !== "normal") out.blend = s.mixBlendMode;
    const bd = s.backdropFilter || r.webkitBackdropFilter;
    if (bd && bd !== "none") out.backdrop = bd;
    if (s.clipPath && s.clipPath !== "none") out.clipPath = s.clipPath;
    if (s.textShadow && s.textShadow !== "none") out.textShadow = s.textShadow;
    const sw = parseFloat(r.webkitTextStrokeWidth || "0") || 0;
    if (sw > 0) out.textStroke = { w: Math.round(sw * 100) / 100, color: r.webkitTextStrokeColor || s.color };
    if (s.paintOrder && s.paintOrder !== "normal") out.paintOrder = s.paintOrder;
    const corners = [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius];
    if (corners.every((c) => /^[\d.]+px$/.test(c ?? "")) && new Set(corners).size > 1) out.radii = corners.map((c) => Math.round(parseFloat(c!) * 100) / 100);
    const anim = animOf(s);
    if (anim) out.animation = anim;
    return out;
  }

  /*
   * A TURNED BOX, MEASURED AS LAID OUT. PST's antenna rods are 6x90 bars
   * leaning -32deg and 28deg (and swaying): the box the browser reports for
   * one is the box round the lean, 51x81, and filled with the rod's ink the
   * two drew as one dark block. So before anything is read, every element
   * turned, scaled or skewed (its transform, or rotate and scale of their
   * own) is read at rest (its animation lifted for the read), then has its
   * turn taken off while the page is measured: every box is the one the
   * layout gave. Each part then carries what turns it, its own and what
   * holds it, as one matrix about its own centre (`turn`), and the board
   * turns it back. A move alone (translate(-50%, -50%) centring a box) stays
   * in the box, as it always was. Put back when the read is done.
   */
  /* Its running animations, from the longhands as computed (or as they were before a turned box's were lifted for the read). */
  type Moving = Pick<CSSStyleDeclaration, "animationName" | "animationDuration" | "animationTimingFunction" | "animationDelay" | "animationIterationCount" | "animationDirection" | "animationFillMode" | "transitionProperty" | "transitionDuration" | "transitionTimingFunction" | "transitionDelay">;
  function animOf(s: Moving): PartStyle["animation"] {
    const names = (s.animationName || "none").split(",").map((v) => v.trim());
    if (!names.some((n) => n && n !== "none")) return undefined;
    const at = (v: string, i: number) => { const l = (v || "").split(/,(?![^(]*\))/).map((x) => x.trim()); return l[i % Math.max(1, l.length)] ?? ""; };
    return names.flatMap((name, i) => (name && name !== "none" ? [{ name, duration: at(s.animationDuration, i), timing: at(s.animationTimingFunction, i), delay: at(s.animationDelay, i), iterations: at(s.animationIterationCount, i), direction: at(s.animationDirection, i), fill: at(s.animationFillMode, i) }] : []));
  }
  const keep = (s: CSSStyleDeclaration): Moving => ({ animationName: s.animationName, animationDuration: s.animationDuration, animationTimingFunction: s.animationTimingFunction, animationDelay: s.animationDelay, animationIterationCount: s.animationIterationCount, animationDirection: s.animationDirection, animationFillMode: s.animationFillMode, transitionProperty: s.transitionProperty, transitionDuration: s.transitionDuration, transitionTimingFunction: s.transitionTimingFunction, transitionDelay: s.transitionDelay });
  /* What a turned box ran before its animation and easing were lifted for the read: the antennas' sway. */
  const moving = new Map<Element, Moving>();
  const restTurn = new Map<Element, { transform: string; origin: string }>();
  const I = new DOMMatrix();
  const flat = (m: DOMMatrix) => Math.abs(m.a - 1) < 1e-4 && Math.abs(m.b) < 1e-4 && Math.abs(m.c) < 1e-4 && Math.abs(m.d - 1) < 1e-4;
  /* translate, then rotate, then scale, then transform, as CSS composes them; a % of translate is of the box's own size. */
  const ownMatrix = (r: { tf: string; translate: string; rotate: string; scale: string }, w: number, h: number): DOMMatrix => {
    let m = new DOMMatrix();
    const set = (v: string) => !!v && v !== "none";
    if (set(r.translate)) { const [x, y] = r.translate.split(/\s+/).map((v, i) => (/%$/.test(v) ? (parseFloat(v) / 100) * (i ? h : w) : parseFloat(v) || 0)); m = m.translate(x ?? 0, y ?? 0); }
    if (set(r.rotate)) { const d = /(-?[\d.]+)(deg|rad|turn|grad)\s*$/.exec(r.rotate); if (d) { const v = Number(d[1]); m = m.rotate(d[2] === "rad" ? (v * 180) / Math.PI : d[2] === "turn" ? v * 360 : d[2] === "grad" ? v * 0.9 : v); } }
    if (set(r.scale)) { const [x, y] = r.scale.split(/\s+/).map(Number); if (Number.isFinite(x)) m = m.scale(x!, Number.isFinite(y) ? y! : x!); }
    if (set(r.tf)) { try { m = m.multiply(new DOMMatrix(r.tf)); } catch { /* not a matrix this browser reads */ } }
    return m;
  };
  /* A matrix in the page's space, about a point: what turns a box about its own origin. */
  const about = (m: DOMMatrix, ox: number, oy: number) => I.translate(ox, oy).multiply(m).translate(-ox, -oy);
  const originAt = (origin: string, x: number, y: number, w: number, h: number): [number, number] => {
    const [a, b] = origin.split(/\s+/).map(parseFloat);
    return [x + (Number.isFinite(a) ? a! : w / 2), y + (Number.isFinite(b) ? b! : h / 2)];
  };
  const turns = new Map<Element, DOMMatrix>();
  const lifted: { el: HTMLElement; had: string | null }[] = [];
  /*
   * Run on the page as it opens, and again on each hidden block once it is
   * revealed for its read (and each template's copy): a box hidden as the
   * page opens has no layout then, so its turn was never lifted. PST's
   * player card antennas, in a panel shown only once a player is picked,
   * came in as the box round each lean, upright, 19x31 (J, 2026-10-06).
   */
  const liftTurns = (root: Element) => {
    const turning: { el: HTMLElement; m: DOMMatrix; origin: string }[] = [];
    for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]) {
      if (!(el instanceof HTMLElement) || (root === document.body && el === root) || SKIP.has(el.tagName) || turns.has(el) || !el.getClientRects().length) continue;
      const s = css(el);
      const moved = (v: string) => !!v && v !== "none";
      if (!moved(s.transform) && !moved(s.getPropertyValue("rotate")) && !moved(s.getPropertyValue("scale"))) continue;
      /* At rest: the swaying rods read where they lean, not mid-swing. */
      const animated = (el.getAnimations?.() ?? []).length > 0;
      const before = el.getAttribute("style");
      if (animated) el.style.setProperty("animation", "none", "important");
      const r = css(el);
      const rest = { tf: r.transform, translate: r.getPropertyValue("translate"), rotate: r.getPropertyValue("rotate"), scale: r.getPropertyValue("scale"), origin: r.transformOrigin, position: r.position };
      if (animated) { if (before === null) el.removeAttribute("style"); else el.setAttribute("style", before); }
      const m = ownMatrix(rest, el.offsetWidth, el.offsetHeight);
      if (flat(m)) continue;
      lifted.push({ el, had: before });
      moving.set(el, keep(css(el)));
      if (animated) restTurn.set(el, { transform: m.toString(), origin: rest.origin });
      if (animated) el.style.setProperty("animation", "none", "important");
      for (const p of ["transform", "translate", "rotate", "scale", "transition"]) el.style.setProperty(p, "none", "important");
      /* A transform holds what is placed absolutely inside it; lifted, a static box must still hold them. */
      if (rest.position === "static") el.style.setProperty("position", "relative", "important");
      turning.push({ el, m, origin: rest.origin });
    }
    /* Origins read off the boxes as laid out, every turn lifted. */
    for (const t of turning) {
      const r = t.el.getBoundingClientRect();
      const [ox, oy] = originAt(t.origin, r.left + scrollX, r.top + scrollY, r.width, r.height);
      turns.set(t.el, about(t.m, ox, oy));
    }
  };
  liftTurns(document.body);
  /* Everything that turns it, in the page's space: what holds it first, its own last. */
  const turnOf = (el: Element | null, own: DOMMatrix | null = null): DOMMatrix | null => {
    let m = own;
    for (let up: Element | null = el; up && up !== document.documentElement; up = up.parentElement) {
      const t = turns.get(up);
      if (t) m = m ? t.multiply(m) : t;
    }
    return m;
  };
  /* The same, about a box's own centre, as CSS writes it on a box whose origin is its centre. */
  const turnSaid = (m: DOMMatrix | null, b: { x: number; y: number; w: number; h: number }): string | null => {
    if (!m || (flat(m) && Math.abs(m.e) < 0.5 && Math.abs(m.f) < 0.5)) return null;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const tx = m.a * cx + m.c * cy + m.e - cx, ty = m.b * cx + m.d * cy + m.f - cy;
    const k = (v: number) => Math.round(v * 10000) / 10000, q = (v: number) => Math.round(v * 100) / 100;
    return `matrix(${k(m.a)}, ${k(m.b)}, ${k(m.c)}, ${k(m.d)}, ${q(tx)}, ${q(ty)})`;
  };

  /*
   * A ::before OR ::after THAT DRAWS. PST's antenna balls are each rod's
   * ::after: a red disc with an ink edge on the rod's tip, with no element
   * of its own, so nothing read it and the rods came in bare. One placed
   * absolutely and drawing something (a fill, a gradient, an edge, a shadow
   * or words) is a part of its own, at the place the browser put it inside
   * its containing block, at its size, under the section its element is in,
   * turned with its element.
   */
  const pseudoParts = (el: Element, parent: number, hidden: string | null, host = -1) => {
    if (el instanceof SVGElement) return;
    for (const which of ["::before", "::after"] as const) {
      if (truncated) return;
      const ps = getComputedStyle(el, which);
      const c = ps.content;
      if (!c || c === "none" || c === "normal" || ps.display === "none" || ps.visibility === "hidden") continue;
      if (Number(ps.opacity) <= 0.05) continue;
      /*
       * ONE IN THE FLOW (PST's panel titles: an icon before the words, a
       * flex item 22px square painted through a mask). It has no box to
       * ask for and no left or top to place it by, so a stand-in is put
       * where it is, wearing every property it computes to, while it stops
       * drawing for the moment; the stand-in's box is its box.
       */
      if (ps.position !== "absolute" && ps.position !== "fixed") {
        const paint0 = paintOf(ps);
        const words0 = (/^"([\s\S]*)"$/.exec(c)?.[1] ?? "").replace(/\\(.)/g, "$1").trim();
        if (!(!seeThrough(ps.backgroundColor) || paint0.image || paint0.mask || paint0.shadow || words0)) continue;
        const stand = document.createElement("span");
        for (let k = 0; k < ps.length; k++) { const prop = ps[k]!; if (prop !== "content") stand.style.setProperty(prop, ps.getPropertyValue(prop)); }
        if (words0) stand.textContent = words0;
        const mark = `polio-pseudo-${parts.length}`;
        el.setAttribute("data-polio-pseudo", mark);
        const hush = document.createElement("style");
        hush.textContent = `[data-polio-pseudo="${mark}"]${which} { content: none !important; display: none !important; }`;
        document.head.appendChild(hush);
        if (which === "::before") el.insertBefore(stand, el.firstChild); else el.appendChild(stand);
        const rr = stand.getBoundingClientRect();
        /* The host's own words start past it: their part keeps that start as its padding, or the words are drawn over the icon. */
        const hostPart = host >= 0 ? parts[host] : undefined;
        if (which === "::before" && hostPart && hostPart.words && hostPart.style.pad) {
          const range = document.createRange();
          let first: Text | null = null;
          for (const t of Array.from(el.childNodes)) if (t.nodeType === 3 && t.textContent!.trim()) { first = t as Text; break; }
          if (first) {
            range.selectNodeContents(first);
            const tr = Array.from(range.getClientRects())[0];
            const hr = el.getBoundingClientRect();
            const start = tr ? Math.round((tr.left - hr.left - (parseFloat(css(el).borderLeftWidth) || 0)) * 100) / 100 : 0;
            if (start > hostPart.style.pad[3]) hostPart.style.pad[3] = start;
          }
        }
        stand.remove(); hush.remove(); el.removeAttribute("data-polio-pseudo");
        if (!(rr.width > 0 && rr.height > 0)) continue;
        const b0 = box(rr);
        const st0 = { ...styleOf(el, which), ...paint0 };
        if (/%$/.test(ps.borderTopLeftRadius)) st0.radius = Math.round((parseFloat(ps.borderTopLeftRadius) / 100) * Math.min(b0.w, b0.h));
        const turn0 = turnSaid(turnOf(el), b0);
        push({ kind: "shape", tag: which, parent, box: b0, words: words0, hooks: {}, hidden, selector: `${path(el)}${which}`, style: st0, pseudo: { which, host: hooksOf(el) }, ...(turn0 ? { turn: turn0 } : {}) });
        continue;
      }
      const n = (v: string) => parseFloat(v) || 0;
      const SIDES = ["Top", "Right", "Bottom", "Left"] as const;
      const bw = SIDES.map((k) => (ps.getPropertyValue(`border-${k.toLowerCase()}-style`) === "none" ? 0 : n(ps.getPropertyValue(`border-${k.toLowerCase()}-width`))));
      const pad = SIDES.map((k) => n(ps.getPropertyValue(`padding-${k.toLowerCase()}`)));
      const mar = SIDES.map((k) => n(ps.getPropertyValue(`margin-${k.toLowerCase()}`)));
      const text = (/^"([\s\S]*)"$/.exec(c)?.[1] ?? "").replace(/\\(.)/g, "$1").trim();
      const paint = paintOf(ps);
      if (!(!seeThrough(ps.backgroundColor) || paint.image || paint.mask || paint.shadow || bw.some(Boolean) || text)) continue;
      const w0 = n(ps.width), h0 = n(ps.height);
      if (!(w0 > 0 && h0 > 0)) continue;
      const bb = ps.boxSizing === "border-box";
      const w = bb ? w0 : w0 + pad[1]! + pad[3]! + bw[1]! + bw[3]!;
      const h = bb ? h0 : h0 + pad[0]! + pad[2]! + bw[0]! + bw[2]!;
      /* Its containing block: the padding box of the nearest positioned box, its own element first. */
      let block = { x: 0, y: 0, w: innerWidth, h: innerHeight };
      if (ps.position === "fixed") block = { x: scrollX, y: scrollY, w: innerWidth, h: innerHeight };
      else {
        let cb: Element | null = el;
        while (cb && cb !== document.body && css(cb).position === "static") cb = cb.parentElement;
        if (cb) {
          const r = cb.getBoundingClientRect(), cs = css(cb);
          const bl = n(cs.borderLeftWidth), bt = n(cs.borderTopWidth);
          block = { x: r.left + scrollX + bl, y: r.top + scrollY + bt, w: r.width - bl - n(cs.borderRightWidth), h: r.height - bt - n(cs.borderBottomWidth) };
        }
      }
      const x = block.x + (ps.left !== "auto" ? n(ps.left) + mar[3]! : block.w - n(ps.right) - mar[1]! - w);
      const y = block.y + (ps.top !== "auto" ? n(ps.top) + mar[0]! : block.h - n(ps.bottom) - mar[2]! - h);
      const b = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
      const own = ps.transform && ps.transform !== "none" ? about(ownMatrix({ tf: ps.transform, translate: ps.getPropertyValue("translate"), rotate: ps.getPropertyValue("rotate"), scale: ps.getPropertyValue("scale") }, w, h), ...originAt(ps.transformOrigin, x, y, w, h)) : null;
      const style = { ...styleOf(el, which), ...paint };
      /* Rounding written as a share of the box (border-radius: 50%) is a share of this box: a disc stays a disc. */
      if (/%$/.test(ps.borderTopLeftRadius)) style.radius = Math.round((parseFloat(ps.borderTopLeftRadius) / 100) * Math.min(b.w, b.h));
      /* A move alone is its place, as an element's is; a turn is carried. */
      const total = turnOf(el, own);
      if (total && flat(total)) { b.x = Math.round(b.x + total.e); b.y = Math.round(b.y + total.f); }
      const turn = total && !flat(total) ? turnSaid(total, b) : null;
      push({ kind: "shape", tag: which, parent, box: b, words: text, hooks: {}, hidden, selector: `${path(el)}${which}`, style, pseudo: { which, host: hooksOf(el) }, ...(turn ? { turn } : {}) });
    }
  };
  /* The page's own rules, once: a linked sheet by the address its link wrote, a style block by its place among the page's style blocks. */
  let pageRules: { sheet: string | null; block: number; selector: string }[] | null = null;
  /*
   * HOVER, PRESS AND FOCUS. Every `:hover`, `:active` and `:focus` rule of
   * the page, read once; for a part, the ones whose selector reaches it with
   * the state taken off, their declarations as written with the page's
   * tokens resolved where the part is (a rule copied to the board has no
   * `--pons-…` to read). PST's TV button sinks when pressed, its fields ring
   * when focused.
   */
  let stateRules: { selector: string; state: string; decl: [string, string][] }[] | null = null;
  const STATE = /:(hover|active|focus-visible|focus-within|focus)(?![\w-])/;
  const statesOf = (e: Element, was?: Moving): Pick<PartStyle, "states" | "transition"> => {
    if (!stateRules) {
      stateRules = [];
      const walk = (list: CSSRuleList) => {
        for (const r of Array.from(list)) {
          if (stateRules!.length > 400) return;
          if (r instanceof CSSStyleRule) {
            const decl = r.style.cssText.split(/;(?![^(]*\))/).map((d) => { const i = d.indexOf(":"); return [d.slice(0, i).trim(), d.slice(i + 1).trim()] as [string, string]; }).filter(([k, v]) => k && v);
            for (const one of r.selectorText.split(/,(?![^(]*\))/)) {
              const s = one.trim(), m = STATE.exec(s);
              if (m && !/::?(before|after)/.test(s) && decl.length) stateRules!.push({ selector: s, state: m[1]!, decl });
            }
          } else if ("cssRules" in r && (r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules);
        }
      };
      for (const sh of Array.from(document.styleSheets)) {
        const owner = sh.ownerNode as Element | null;
        if (!owner || owner.hasAttribute("data-polio-template")) continue;
        try { walk(sh.cssRules); } catch { /* another origin's sheet */ }
      }
    }
    const cs = css(e);
    const resolve = (v: string) => { for (let i = 0; i < 6 && v.includes("var("); i++) v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (_, name: string, fb?: string) => cs.getPropertyValue(name).trim() || (fb ?? "").trim()); return v; };
    const out: NonNullable<PartStyle["states"]> = {};
    let n = 0;
    for (const r of stateRules) {
      if (n >= 8) break;
      const bare = r.selector.replace(new RegExp(STATE.source, "g"), "").trim();
      if (!bare) continue;
      try { if (!e.matches(bare)) continue; } catch { continue; }
      const self = STATE.test(r.selector.replace(/\[[^\]]*\]|\([^)]*\)/g, "").trim().split(/[\s>+~]+/).pop() ?? "");
      const kind = r.state === "hover" ? "hover" : r.state === "active" ? "active" : "focus";
      (out[kind] ??= []).push({ selector: r.selector, self, state: r.state, style: Object.fromEntries(r.decl.map(([k, v]) => [k, resolve(v)])) });
      n++;
    }
    const ts = was ?? cs;
    const tp = (ts.transitionProperty || "").split(",").map((v) => v.trim());
    const at = (v: string, i: number) => { const l = (v || "").split(/,(?![^(]*\))/).map((x) => x.trim()); return l[i % Math.max(1, l.length)] ?? ""; };
    const transition = tp.map((property, i) => ({ property, duration: at(ts.transitionDuration, i), timing: at(ts.transitionTimingFunction, i), delay: at(ts.transitionDelay, i) })).filter((t) => t.property && t.property !== "none" && parseFloat(t.duration) > 0);
    return { ...(n ? { states: out } : {}), ...(transition.length ? { transition } : {}) };
  };
  const rulesFor = (e: Element) => {
    if (!pageRules) {
      pageRules = [];
      const blocks = Array.from(document.querySelectorAll("style"));
      const walk = (list: CSSRuleList, sheet: string | null, block: number) => {
        for (const r of Array.from(list)) {
          if (pageRules!.length > 3000) return;
          if (r instanceof CSSStyleRule) pageRules!.push({ sheet, block, selector: r.selectorText });
          else if ("cssRules" in r && (r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules, sheet, block);
        }
      };
      for (const sh of Array.from(document.styleSheets)) {
        const owner = sh.ownerNode as Element | null;
        if (!owner || owner.hasAttribute("data-polio-template")) continue;
        try { walk(sh.cssRules, owner.tagName === "LINK" ? owner.getAttribute("href") : null, owner.tagName === "STYLE" ? blocks.indexOf(owner as HTMLStyleElement) : -1); } catch { /* another origin's sheet */ }
      }
    }
    const out: { sheet: string | null; block: number; selector: string }[] = [];
    /* And a rule naming it by its hook, id or class that does not reach it as the page opens: its other states (PST's score in [data-sign="gain"] green). */
    const hook = e.getAttribute("data-hook");
    const names = [hook ? `[data-hook="${hook}"]` : null, e.id ? `#${e.id}` : null, ...Array.from(e.classList).map((c) => `.${c}`)].filter((x): x is string => !!x);
    const names_ = (sel: string) => names.some((n) => { const i = sel.indexOf(n); return i >= 0 && !/[\w-]/.test(sel[i + n.length] ?? ""); });
    for (const r of pageRules) {
      if (out.length >= 12) break;
      try { if (e.matches(r.selector) || names_(r.selector)) out.push(r); } catch { /* a selector this browser cannot test */ }
    }
    return out;
  };
  /* `turnFrom`: the element whose turn it takes, when it is not `el` (a line of words takes its holder's). */
  const push = (p: PagePart, el?: Element, turnFrom: Element | null = el ?? null): number => {
    if (parts.length >= cap) { truncated = true; return -1; }
    /*
     * ONE LINE OF INLINE WORDS IS AS TALL AS ITS LINE. An inline element's
     * box is its letters' (PST's "Amount (SOL)" label: 19 tall in a 22.4
     * line), and the board sets words in their line: drawn 22 tall, the part
     * grew by 3 and pushed everything under it down (the money column by 6).
     * So it is read as the line holds it, centred where its letters are.
     */
    const held = p.kind === "check" ? el?.closest("label") ?? null : el ?? turnFrom ?? null;
    if (held && (p.words || (held.textContent ?? "").trim()) && !(held instanceof SVGElement) && (css(held).display === "inline" || (p.kind === "text" && !!p.words))) {
      const lh = parseFloat(css(held).lineHeight);
      if (lh > p.box.h + 0.5 && p.box.h < lh * 1.5) { const grow = Math.round(lh) - p.box.h; if (grow > 0) p.box = { ...p.box, y: p.box.y - Math.floor(grow / 2), h: p.box.h + grow }; }
    }
    if (el) {
      /* Pinned to the window (PST's tour and its card): kept on the part, so the board keeps it on the page and shades the page with it (`boardStates.ts#keepOverlaysOnPage`). */
      if (css(el).position === "fixed") p.position = "fixed";
      const rules = rulesFor(el);
      if (rules.length) p.rules = rules;
      const classes = Array.from(el.classList).filter((c) => /^[A-Za-z_][\w-]*$/.test(c)).slice(0, 8);
      if (classes.length) p.classes = classes;
      if (!(el instanceof SVGElement && el.tagName.toLowerCase() !== "svg")) Object.assign(p.style, paintOf(css(el)));
      /* Seen through as the page shows it: its own see-through times every box round it (PST's legend at 0.8 fades its words too, a part of their own on the board). */
      let seen = 1;
      for (let a: Element | null = el; a && a !== document.documentElement; a = a.parentElement) seen *= Number(css(a).opacity) || 0;
      if (seen < 0.999) p.style.opacity = Math.round(seen * 1000) / 1000; else delete p.style.opacity;
      /* A turned box's own animation and easing, as they were before the read lifted them. */
      const was = moving.get(el);
      if (was) {
        const a = animOf(was);
        if (a) p.style.animation = a;
        /* Turned by itself alone, and swaying: its own turn about its own point, which its keyframes turn about too. */
        let held = false;
        for (let up = el.parentElement; up; up = up.parentElement) if (turns.has(up)) { held = true; break; }
        const own = restTurn.get(el);
        if (a && own && !held) p.style.ownTurn = own;
      }
      if (!p.pseudo) Object.assign(p.style, statesOf(el, was));
    }
    if (turnFrom && !p.turn) { const t = turnSaid(turnOf(turnFrom), p.box); if (t) p.turn = t; }
    parts.push(p);
    const at = parts.length - 1;
    if (el && !p.pseudo) pseudoParts(el, p.kind === "section" ? at : p.parent, p.hidden, at);
    return at;
  };

  /* Hidden blocks wait until the page as it opens has been read. */
  const later: { el: Element; parent: number; template?: boolean }[] = [];
  const queue = (el: Element, parent: number) => { later.push({ el, parent, ...(el.tagName === "TEMPLATE" ? { template: true } : {}) }); };

  /* Words of a run of inline nodes, with what each stretch wore. A hidden element met on the way is kept for later. */
  const runsOf = (nodes: Node[], root: Element, pre: boolean, parent: number): PartRun[] => {
    const out: PartRun[] = [];
    /* A run says only how it differs from the block it is set in: a heading's own bold is the heading's. */
    const rs = css(root);
    const rootWeight = Number(rs.fontWeight) || 400;
    const mono = (f: string) => /mono|courier|consolas|menlo/i.test(f);
    const add = (text: string, from: Element) => {
      const s = css(from);
      const a = from.closest("a[href]");
      const run: PartRun = { text };
      const w = Number(s.fontWeight) || 400;
      if (w !== rootWeight) run.weight = w;
      if (s.fontStyle === "italic" && rs.fontStyle !== "italic") run.italic = true;
      if (mono(s.fontFamily) && !mono(rs.fontFamily)) run.mono = true;
      if (a && root.contains(a) && a !== root) { run.href = a.getAttribute("href") ?? ""; if (!underlined(a)) run.bare = true; }
      if (s.color !== rs.color) run.colour = s.color;
      /* A chip: the nearest element inside the run that paints a fill of its own. */
      for (let up: Element | null = from; up && up !== root; up = up.parentElement) {
        const u = css(up);
        if (!seeThrough(u.backgroundColor)) {
          run.bg = u.backgroundColor;
          const px = (v: string) => Math.round((parseFloat(v) || 0) * 100) / 100;
          const pad = [px(u.paddingTop), px(u.paddingRight), px(u.paddingBottom), px(u.paddingLeft)];
          if (pad.some((v) => v > 0)) run.pad = pad;
          if (px(u.borderTopLeftRadius) > 0) run.radius = px(u.borderTopLeftRadius);
          break;
        }
      }
      /* Room beside it in the line: the nearest element inside the run with a side margin. */
      for (let up: Element | null = from; up && up !== root; up = up.parentElement) {
        const u = css(up), l = Math.round((parseFloat(u.marginLeft) || 0) * 100) / 100, r = Math.round((parseFloat(u.marginRight) || 0) * 100) / 100;
        if (l || r) { run.space = [l, r]; break; }
      }
      /* The nearest element inside the run carrying an id or a data-* attribute: a live value the page's code writes into. */
      for (let up: Element | null = from; up && up !== root; up = up.parentElement) {
        if (hooked(up)) { run.hooks = hooksOf(up); break; }
      }
      const last = out[out.length - 1];
      const same = last && last.weight === run.weight && last.italic === run.italic && last.mono === run.mono && last.href === run.href && last.bare === run.bare && last.colour === run.colour && last.bg === run.bg && String(last.space) === String(run.space) && JSON.stringify(last.hooks ?? null) === JSON.stringify(run.hooks ?? null);
      if (same) last!.text += text; else out.push(run);
    };
    const visit = (n: Node, holder: Element) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const raw = n.textContent ?? "";
        const text = pre ? raw : raw.replace(/\s+/g, " ");
        if (text) add(text, holder);
        return;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const e = n as Element;
      if (SKIP.has(e.tagName)) return;
      if (e.tagName === "BR") { add("\n", holder); return; }
      if (e.tagName === "TEMPLATE" || !shown(e) || folded(e)) { queue(e, parent); return; }
      /* An empty element with a hook is a place the page's code fills: it is kept, as a run with no words, so the hook travels. */
      if (hooked(e) && !(e.textContent ?? "").trim()) out.push({ text: "", hooks: hooksOf(e) });
      for (const c of Array.from(e.childNodes)) visit(c, e);
    };
    for (const n of nodes) visit(n, n.nodeType === Node.ELEMENT_NODE ? (n as Element) : (n.parentElement ?? root));
    /* One space where the page draws one, none at either end. */
    if (!pre) {
      for (let i = 0; i < out.length; i++) {
        if (i > 0 && /\s$/.test(out[i - 1]!.text) && out[i]!.text.startsWith(" ")) out[i]!.text = out[i]!.text.slice(1);
        out[i]!.text = out[i]!.text.replace(/ ?\n ?/g, "\n");
      }
      const first = out.find((r) => r.text);
      if (first) first.text = first.text.replace(/^\s+/, "");
      const lastRun = [...out].reverse().find((r) => r.text);
      if (lastRun) lastRun.text = lastRun.text.replace(/\s+$/, "");
    }
    return out.filter((r) => r.text || r.hooks);
  };
  const wordsOf = (runs: PartRun[]) => runs.map((r) => r.text).join("");
  const plainRuns = (runs: PartRun[]) => runs.every((r) => r.weight === undefined && !r.italic && !r.mono && !r.href && !r.bare && !r.hooks && !r.colour && !r.bg && !r.space);

  /* A link stands on its own when what is beside it is only separators: a bar of links, not a sentence with one in it. */
  const loneLinks = new Map<Element, boolean>();
  const linksStandAlone = (c: Element): boolean => {
    const had = loneLinks.get(c);
    if (had !== undefined) return had;
    const links = Array.from(c.querySelectorAll("a[href]"));
    let rest = "";
    const walk = (n: Node) => {
      if (n.nodeType === Node.TEXT_NODE) { rest += n.textContent ?? ""; return; }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const e = n as Element;
      if (SKIP.has(e.tagName) || links.includes(e)) return;
      for (const k of Array.from(e.childNodes)) walk(k);
    };
    walk(c);
    const alone = links.length > 0 && SEPARATORS.test(rest);
    loneLinks.set(c, alone);
    return alone;
  };
  /* Does this element hold anything that is a part of its own: a block, a control, a picture, a link standing alone? */
  const holdsParts = (el: Element): boolean => {
    if (el.tagName === "PRE") return false;
    if (linksStandAlone(el)) return true;
    for (const d of Array.from(el.querySelectorAll("*"))) {
      if (SKIP.has(d.tagName) || d.tagName === "BR") continue;
      if (isControl(d) || isMedia(d) || d.tagName === "TEMPLATE") return true;
      if (shown(d) && !inlineish(d)) return true;
    }
    return false;
  };

  const marker = (li: Element): string => {
    const t = css(li).listStyleType;
    if (!t || t === "none") return "";
    if (li.parentElement?.tagName === "OL") {
      const start = Number(li.parentElement.getAttribute("start")) || 1;
      return `${start + Array.from(li.parentElement.children).filter((c) => c.tagName === "LI").indexOf(li)}. `;
    }
    return t === "circle" ? "◦ " : t === "square" ? "▪ " : "• ";
  };

  const labelFor = (control: Element): string => {
    const wrap = control.closest("label");
    const from = wrap ?? (control.id ? document.querySelector(`label[for="${CSS.escape(control.id)}"]`) : null);
    if (!from) return control.getAttribute("aria-label") ?? "";
    const copy = from.cloneNode(true) as Element;
    copy.querySelectorAll("input, select, textarea, button").forEach((x) => x.remove());
    return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
  };

  /* One control: a button, a field, a checkbox. */
  const control = (el: Element, parent: number, hidden: string | null) => {
    const tag = el.tagName;
    const r = el.getBoundingClientRect();
    /* What is hooked inside a control: a picture is a part of its own over it (PST's avatar buttons), anything else (a list's options, a button's words) is carried by the control. */
    const insideHooked = Array.from(el.querySelectorAll("[data-hook], [id]"));
    const inner = insideHooked.filter((d) => !isMedia(d) && !d.closest("svg")).map(hooksOf);
    const base = { tag: tag.toLowerCase(), parent, box: box(r), hooks: hooksOf(el), hidden, selector: path(el), style: styleOf(el), ...(inner.length ? { inner } : {}) };
    const after = () => { for (const d of insideHooked) if (isMedia(d) && !d.parentElement?.closest("svg")) picture(d, parent, hidden); };
    if (tag === "BUTTON" || el.getAttribute("role") === "button" || (tag === "INPUT" && /^(submit|button|reset|image)$/i.test((el as HTMLInputElement).type))) {
      const words = (tag === "INPUT" ? (el as HTMLInputElement).value : el.textContent ?? "").replace(/\s+/g, " ").trim();
      push({ ...base, kind: "button", words, control: { type: (el as HTMLButtonElement).type || "button", ...((el as HTMLButtonElement).disabled ? { disabled: true } : {}) } }, el);
      after();
      return;
    }
    if (isCheck(el)) {
      const i = el as HTMLInputElement;
      push({ ...base, kind: "check", words: labelFor(el), label: labelFor(el), control: { type: i.type, checked: i.checked, ...(i.disabled ? { disabled: true } : {}) } }, el);
      after();
      return;
    }
    const c: PartControl = { type: tag === "INPUT" ? (el as HTMLInputElement).type : tag.toLowerCase() };
    const f = el as HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement;
    if (tag === "SELECT") {
      c.options = Array.from(f.options).map((o) => ({ text: o.text.replace(/\s+/g, " ").trim(), value: o.value, selected: o.selected, ...(o.getAttribute("data-hook") ? { hook: o.getAttribute("data-hook")! } : {}) }));
      if (f.multiple) c.multiple = true;
      c.value = f.value;
    } else if (c.type !== "file" && c.type !== "password") c.value = f.value;
    if (f.placeholder) c.placeholder = f.placeholder;
    if (f.disabled) c.disabled = true;
    if (tag === "TEXTAREA") c.rows = f.rows;
    const words = tag === "SELECT" ? (c.options?.find((o) => o.selected)?.text ?? "") : (c.value || c.placeholder || "");
    push({ ...base, kind: "field", words, label: labelFor(el), control: c }, el);
    after();
  };

  /* A label holding a checkbox is one part: the box and the words beside it. */
  const checkPart = (label: Element, parent: number, hidden: string | null) => {
    const input = Array.from(label.querySelectorAll("input")).find(isCheck) as HTMLInputElement;
    const words = labelFor(input);
    /* A label with a hook of its own (the kit's `newwallet-ack-label`) is a box round the checkbox, so both hooks are on the board. */
    let at = parent;
    if (hooked(label)) { const i = push({ kind: "section", tag: "label", parent, box: box(label.getBoundingClientRect()), words: "", hooks: hooksOf(label), hidden, selector: path(label), style: styleOf(label) }, label); if (i >= 0) at = i; }
    push({ kind: "check", tag: "label", parent: at, box: box(label.getBoundingClientRect()), words, label: words, control: { type: input.type, checked: input.checked, ...(input.disabled ? { disabled: true } : {}) }, hooks: hooked(label) ? hooksOf(input) : { ...hooksOf(label), ...hooksOf(input) }, hidden, selector: path(input), style: styleOf(label) }, input);
  };

  const picture = (el: Element, parent: number, hidden: string | null) => {
    const im = el as HTMLImageElement;
    const b = box(el.getBoundingClientRect());
    /* A picture with no file yet (its script sets one) draws as its alt text, 96x18 for a 96x96 avatar: the size it was given is its size. */
    const aw = Number(el.getAttribute("width")), ah = Number(el.getAttribute("height"));
    if (el.tagName === "IMG" && !im.naturalWidth && aw > 0 && ah > 0) { b.w = Math.round(aw); b.h = Math.round(ah); }
    const style = styleOf(el);
    /* Rounding written as a share of the box (border-radius: 50%) is a share of this box: a circle stays a circle. */
    const r = css(el).borderTopLeftRadius;
    if (/%$/.test(r)) style.radius = Math.round((parseFloat(r) / 100) * Math.min(b.w, b.h));
    /*
     * A CANVAS IS WHAT ITS CODE DREW. Read without its scripts, PST's chart
     * canvas is blank: as a picture with no file it drew the library's stand-in
     * landscape over the TV's screen, its still and its static. Blank, it is a
     * box with nothing of its own to paint; drawn, its pixels are its picture.
     */
    let drawn = "";
    if (el.tagName === "CANVAS") {
      try { const cv = el as HTMLCanvasElement, blank = document.createElement("canvas"); blank.width = cv.width; blank.height = cv.height; const u = cv.toDataURL(); if (u !== blank.toDataURL()) drawn = u; } catch { /* a canvas another origin drew into is not readable: blank to us */ }
      if (!drawn) { push({ kind: "shape", tag: "canvas", parent, box: b, words: "", hooks: hooksOf(el), hidden, selector: path(el), style }, el); return; }
    }
    /*
     * AN INLINE SVG IS ITS OWN PICTURE. PST's title icons are inline svgs
     * filled with currentColor: with no file to point at, each came in as a
     * picture with nothing in it, drawn as the stand-in (71px tall, its alt
     * words over the heading) with its path as a solid block on top. Drawn
     * here as the browser drew it: a copy of the svg with every colour it
     * takes from the page (currentColor, the stylesheet's fill and stroke)
     * written on, as a data: picture of its own size.
     */
    const inline = el.tagName.toLowerCase() === "svg";
    const kept = new Set<Element>();
    if (inline && !drawn) {
      try {
        const copy = el.cloneNode(true) as SVGSVGElement;
        const from = [el, ...Array.from(el.querySelectorAll("*"))], to = [copy, ...Array.from(copy.querySelectorAll("*"))];
        from.forEach((s, i) => {
          const c = to[i] as SVGElement | undefined;
          if (!c || !/^(svg|g|path|circle|ellipse|rect|polygon|polyline|line|text|tspan|use)$/i.test(s.tagName)) return;
          const sc = css(s);
          /* A circle, an ellipse or a box with a hook is a part of its own (below), drawn there: not twice. */
          if (/^(circle|ellipse|rect)$/i.test(s.tagName) && (s.hasAttribute("data-hook") || s.hasAttribute("id"))) { kept.add(s); c.setAttribute("visibility", "hidden"); return; }
          c.setAttribute("style", `fill:${sc.fill};fill-opacity:${sc.fillOpacity};fill-rule:${sc.fillRule};stroke:${sc.stroke};stroke-width:${sc.strokeWidth};stroke-opacity:${sc.strokeOpacity};stroke-linecap:${sc.strokeLinecap};stroke-linejoin:${sc.strokeLinejoin};opacity:${sc.opacity};color:${sc.color}`);
        });
        copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        copy.setAttribute("width", String(b.w));
        copy.setAttribute("height", String(b.h));
        drawn = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
      } catch { /* drawn as it was */ }
    }
    /*
     * A PICTURE ITS SCRIPT DREW IS KEPT. PonsStars' avatars and profile
     * picture are <img>s whose src its script writes (a data: SVG, or a file
     * of its own); read for their src attribute alone they came in as grey
     * stand-ins with their hook for words. A loaded <img> is kept as what it
     * shows: its data: address as it is, else read through a canvas (one
     * from another origin cannot be read, and stays a stand-in).
     */
    let shown: string | null = null;
    if (!inline && !drawn && el.tagName === "IMG" && im.complete && im.naturalWidth > 0) {
      const src = im.currentSrc || im.src || "";
      if (src.startsWith("data:")) shown = src;
      else {
        try {
          const k = Math.min(1, 256 / Math.max(im.naturalWidth, im.naturalHeight));
          const cv = document.createElement("canvas");
          cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
          cv.getContext("2d")?.drawImage(im, 0, 0, cv.width, cv.height);
          shown = cv.toDataURL("image/webp", 0.85);
        } catch { /* another origin's picture: not readable here */ }
      }
    }
    const fit = css(el).objectFit;
    if (shown) {
      push({ kind: "shape", tag: "img", parent, box: b, words: "", hooks: hooksOf(el), hidden, selector: path(el), style: { ...style, image: `url("${shown}")`, imageOptions: [fit === "cover" ? "cover" : fit === "contain" || fit === "scale-down" ? "contain" : "100% 100%", css(el).objectPosition || "50% 50%", "no-repeat"] } }, el);
      return;
    }
    /* Painted as the box's own picture, as a data: background is: no file to carry, nothing to stand in for. */
    const at = inline && drawn
      ? push({ kind: "shape", tag: "svg", parent, box: b, words: "", hooks: hooksOf(el), hidden, selector: path(el), style: { ...style, image: `url("${drawn}")`, imageOptions: ["100% 100%", "0% 0%", "no-repeat"] } }, el)
      : push({ kind: "picture", tag: el.tagName.toLowerCase(), parent, box: b, words: "", hooks: hooksOf(el), hidden, selector: path(el), src: drawn || im.currentSrc || im.getAttribute?.("src") || "", alt: im.getAttribute?.("alt") ?? el.getAttribute("aria-label") ?? "", style }, el);
    /*
     * AN INLINE SVG KEEPS ITS SHAPES' HOOKS. PST's duel is an svg holding two
     * circles its script resizes (duel-circle-me, duel-circle-opponent): each
     * shape inside that carries a hook is a part of its own under the picture,
     * at its own box, with its fill and its stroke, so the hook is on the
     * board and the style layer can recolour it.
     */
    if (el.tagName.toLowerCase() === "svg" && at >= 0) {
      for (const s of Array.from(el.querySelectorAll("[data-hook], [id]"))) {
        if (truncated) break;
        const sc = css(s);
        const sb = box(s.getBoundingClientRect());
        /* A path, a line or words inside a drawn svg are in its picture: the part keeps the hook and paints nothing over it. */
        const own = !drawn || kept.has(s);
        /* Its fill-opacity and stroke-opacity go into the colour: PST's duel circles are filled at 0.4, so the one under shows through the one over. */
        const faded = (c: string, by: string) => {
          const k = Math.min(1, Math.max(0, parseFloat(by)));
          const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)/i.exec(c);
          if (!m || !Number.isFinite(k) || k >= 1) return c;
          const a = Math.round((m[4] === undefined ? 1 : Number(m[4])) * k * 1000) / 1000;
          return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${a})`;
        };
        const fill = own && sc.fill && sc.fill !== "none" && !seeThrough(sc.fill) ? faded(sc.fill, sc.fillOpacity) : null;
        const stroke = own && sc.stroke && sc.stroke !== "none" && !seeThrough(sc.stroke) ? faded(sc.stroke, sc.strokeOpacity) : null;
        const sw = parseFloat(sc.strokeWidth) || 0;
        const base = styleOf(s);
        push({
          kind: "shape", tag: s.tagName.toLowerCase(), parent: at, box: sb, words: (s.tagName.toLowerCase() === "text" ? s.textContent ?? "" : "").trim(), hooks: hooksOf(s), hidden, selector: path(s),
          style: { ...base, bg: fill, border: stroke && sw > 0 ? { w: Math.round(sw * 100) / 100, style: "solid", colour: stroke } : null, radius: /^(circle|ellipse)$/i.test(s.tagName) ? Math.round(Math.min(sb.w, sb.h) / 2) : 0, pad: [0, 0, 0, 0] },
        }, s);
      }
    }
  };

  const link = (a: Element, parent: number, hidden: string | null) => {
    const said = (a.textContent ?? "").replace(/\s+/g, " ").trim() || a.getAttribute("aria-label") || a.getAttribute("title") || "";
    push({ kind: "link", tag: "a", parent, box: box(a.getBoundingClientRect()), words: said, href: a.getAttribute("href") ?? "", ...(underlined(a) ? {} : { bare: true as const }), hooks: hooksOf(a), hidden, selector: path(a), style: styleOf(a) }, a);
  };

  /* A run of inline words between the parts of a mixed block: one line of its own. */
  let lineNo = 0;
  const line = (nodes: Node[], holder: Element, parent: number, hidden: string | null) => {
    const runs = runsOf(nodes, holder, false, parent);
    const words = wordsOf(runs);
    const hooks = runs.find((r) => r.hooks)?.hooks;
    if (!words.trim() && !hooks) return;
    if (!hooks && SEPARATORS.test(words)) return;
    /*
     * The line's own nodes, not the stretch between its first and last: what
     * was taken out of the run sits in that stretch too, and a closed
     * <details>' folded text still has boxes there. PST's "?" help (its
     * summary, then the folded paragraph) read as 236x234 over the lines
     * under it (J, 2026-10-06).
     */
    const range = document.createRange();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const rows: { top: number; bottom: number }[] = [];
    for (const n of nodes) {
      if (n.nodeType === Node.TEXT_NODE && !(n.textContent ?? "").trim()) continue;
      range.selectNode(n);
      for (const q of Array.from(range.getClientRects())) {
        if (q.width <= 0 || q.height <= 0) continue;
        x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom);
        if (!rows.some((w) => q.top < w.bottom - 2 && q.bottom > w.top + 2)) rows.push({ top: q.top, bottom: q.bottom });
      }
    }
    if (x0 === Infinity) { range.setStartBefore(nodes[0]!); range.setEndAfter(nodes[nodes.length - 1]!); const a = range.getBoundingClientRect(); x0 = a.left; y0 = a.top; x1 = a.right; y1 = a.bottom; }
    /*
     * WORDS THE PAGE WRAPPED ARE WRAPPED. An inline paragraph's boxes are its
     * glyphs' height, not its lines': PST's Balance note ("One escrow balance
     * for all your / matches.", a `display: inline` p before its "?") was two
     * 21px rows, 42 in all, under two of its 22.4px lines, so it was drawn on
     * one line and ran out of the panel (J, 2026-10-09). Two rows or more are
     * said to wrap, and wrap where the page did: at the right of what holds
     * them, not at the end of their longest row.
     */
    const wrapped = rows.length > 1;
    if (wrapped) {
      const hs = css(holder), hr = holder.getBoundingClientRect();
      x1 = Math.max(x1, hr.right - (parseFloat(hs.paddingRight) || 0) - (parseFloat(hs.borderRightWidth) || 0));
      /* Its lines' height, not its glyphs': half the leading above the first row and below the last, so the box is as tall as the room the page gave it and nothing under it moves. */
      const first = nodes.find((n) => n.nodeType === Node.ELEMENT_NODE || (n.textContent ?? "").trim());
      const at = first ? (first.nodeType === Node.ELEMENT_NODE ? (first as Element) : first.parentElement) : null;
      const lh = at ? parseFloat(css(at).lineHeight) : NaN;
      const lead = Number.isFinite(lh) ? (lh - (rows[0]!.bottom - rows[0]!.top)) / 2 : 0;
      if (lead > 0 && lead < lh / 2) { y0 -= lead; y1 += lead; }
    }
    /* Whole pixels, rounded up: a row 300.4 wide stored as 300 would wrap its last word where the page did not (the same note at 390, on one row there). */
    x1 = x0 + Math.ceil(x1 - x0 - 0.01);
    const r = { left: x0, top: y0, width: x1 - x0, height: y1 - y0, right: x1, bottom: y1, x: x0, y: y0 } as DOMRect;
    /* Only empty places the code writes into: one empty place, with their hook. */
    if (!words.trim()) { push({ kind: "slot", tag: "span", parent, box: box(r), words: "", hooks: hooks!, hidden, selector: `${path(holder)} ::line(${++lineNo})`, style: styleOf(holder) }, undefined, holder); return; }
    /*
     * The line wears its holder's words, never its box: the holder is a part
     * of its own when it paints, and drew its fill, outline and padding there.
     * Worn twice, PST's Balance note came in as a second panel outline round
     * "One escrow balance for all your matches." (J, 2026-10-06).
     */
    const worn = styleOf(holder);
    delete worn.layout; delete worn.clips; delete worn.maxw;
    push({ kind: "text", tag: "line", parent, box: box(r), words, ...(plainRuns(runs) ? {} : { runs }), ...(wrapped ? { wraps: true as const } : {}), hooks: {}, hidden, selector: `${path(holder)} ::line(${++lineNo})`, style: { ...worn, bg: null, border: null, radius: 0, pad: [0, 0, 0, 0] } }, undefined, holder);
  };

  /* Inline content, with the parts among it taken out as they come. */
  const flow = (container: Element, parent: number, hidden: string | null) => {
    let buffer: Node[] = [];
    const flush = () => { if (buffer.length) line(buffer, container, parent, hidden); buffer = []; };
    const lone = linksStandAlone(container);
    for (const n of Array.from(container.childNodes)) {
      if (truncated) return;
      if (n.nodeType === Node.TEXT_NODE) { buffer.push(n); continue; }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      const e = n as Element;
      if (SKIP.has(e.tagName)) continue;
      if (e.tagName === "BR") { buffer.push(e); continue; }
      if (e.tagName === "TEMPLATE" || !shown(e) || folded(e)) { queue(e, parent); continue; }
      if (isMedia(e)) { flush(); picture(e, parent, hidden); continue; }
      if (checkLabel(e)) { flush(); checkPart(e, parent, hidden); continue; }
      if (isControl(e)) { flush(); control(e, parent, hidden); continue; }
      if (e.tagName === "A" && e.hasAttribute("href") && lone) { flush(); link(e, parent, hidden); continue; }
      /* A <details>' own "?" that paints (PST's round yellow help button) is a part with its own look where the page draws it, not a stretch of the line's words. */
      if (e.tagName === "SUMMARY" && paints(e)) { flush(); block(e, parent, hidden); continue; }
      if (inlineish(e)) {
        if (!holdsParts(e) || e.tagName === "A") { buffer.push(e); continue; }
        /* An inline holder of parts (a label round a field): its words are a line, its controls parts; with a hook of its own, it is a box round them. */
        flush();
        let at = parent;
        if (hooked(e)) { const i = push({ kind: "section", tag: e.tagName.toLowerCase(), parent, box: box(e.getBoundingClientRect()), words: "", hooks: hooksOf(e), hidden, selector: path(e), style: styleOf(e) }, e); if (i >= 0) at = i; }
        flow(e, at, hidden);
        continue;
      }
      flush();
      block(e, parent, hidden);
    }
    flush();
  };

  /* A block: a part of its own when it is only words, else a section (or a plain wrapper) holding its parts. */
  const block = (el: Element, parent: number, hidden: string | null) => {
    if (truncated) return;
    const tag = el.tagName;
    if (!holdsParts(el)) {
      const pre = tag === "PRE" || /^pre/.test(css(el).whiteSpace);
      const runs = runsOf(Array.from(el.childNodes), el, pre, parent);
      const mark = tag === "LI" ? marker(el) : "";
      if (mark && runs.length) runs.unshift({ text: mark });
      const words = wordsOf(runs);
      if (!words.trim() && !hooked(el) && !runs.some((r) => r.hooks) && !paints(el)) return;
      /* Nothing in it yet: an empty place the page's code fills (a log, a message line, a list it builds), kept as an empty box with its hook. */
      const kind: PagePart["kind"] = !words.trim() ? "slot" : /^H[1-6]$/.test(tag) ? "heading" : tag === "PRE" ? "code" : "text";
      push({ kind, tag: tag.toLowerCase(), parent, box: box(el.getBoundingClientRect()), words, ...(plainRuns(runs) ? {} : { runs }), hooks: hooksOf(el), hidden, selector: path(el), style: styleOf(el) }, el);
      return;
    }
    const section = SECTIONING.has(tag) || hooked(el) || paints(el);
    let at = parent;
    if (section) {
      const i = push({ kind: "section", tag: tag.toLowerCase(), parent, box: box(el.getBoundingClientRect()), words: "", hooks: hooksOf(el), hidden, selector: path(el), style: styleOf(el) }, el);
      if (i >= 0) at = i;
    }
    flow(el, at, hidden);
  };

  /* A page whose body carries a hook (the kit's `page-contact`, PST's `app`) has it as the box everything sits in. */
  let top = -1;
  if (hooked(document.body)) top = push({ kind: "section", tag: "body", parent: -1, box: box(document.body.getBoundingClientRect()), words: "", hooks: hooksOf(document.body), hidden: null, selector: "body", style: styleOf(document.body) }, document.body);
  flow(document.body, top, null);

  /* Then what was hidden, each revealed where it stands, read, and hidden again. */
  let hiddenBlocks = 0;
  let templates = 0;
  for (let i = 0; i < later.length && !truncated && i < 400; i++) {
    const { el, parent, template } = later[i]!;
    const key = el.getAttribute("data-hook") || el.id || path(el);
    if (template) {
      templates++;
      const holder = document.createElement("div");
      holder.setAttribute("data-polio-template", "");
      holder.appendChild((el as HTMLTemplateElement).content.cloneNode(true));
      el.parentElement?.insertBefore(holder, el);
      if (shown(holder)) {
        liftTurns(holder);
        /* The template itself, by its hook (the kit's `template-history-row`): the box its copy stands in, at the copy's path, so what is in it is owned by it. */
        let at = parent;
        if (hooked(el)) { const i = push({ kind: "section", tag: "template", parent, box: box(holder.getBoundingClientRect()), words: "", hooks: hooksOf(el), hidden: `template:${key}`, selector: path(holder), style: styleOf(holder) }); if (i >= 0) at = i; }
        flow(holder, at, `template:${key}`);
      }
      holder.remove();
      continue;
    }
    hiddenBlocks++;
    /* Revealed with whatever above it is hidden too, and every change put back. */
    const undo: (() => void)[] = [];
    for (let up: Element | null = el; up && up !== document.documentElement; up = up.parentElement) {
      const h = up as HTMLElement;
      if (h.tagName === "DETAILS" && !(h as HTMLDetailsElement).open && up !== el) { (h as HTMLDetailsElement).open = true; undo.push(() => { (h as HTMLDetailsElement).open = false; }); }
      if (shown(up)) continue;
      const hadHidden = h.hasAttribute("hidden");
      const hadStyle = h.getAttribute("style");
      if (hadHidden) h.removeAttribute("hidden");
      if (!shown(h)) h.style.setProperty("display", h.tagName === "TR" ? "table-row" : h.tagName === "TD" || h.tagName === "TH" ? "table-cell" : "block", "important");
      undo.push(() => { if (hadHidden) h.setAttribute("hidden", ""); if (hadStyle === null) h.removeAttribute("style"); else h.setAttribute("style", hadStyle); });
    }
    try {
      liftTurns(el);
      if (isMedia(el)) picture(el, parent, key);
      else if (checkLabel(el)) checkPart(el, parent, key);
      else if (isControl(el)) control(el, parent, key);
      else if (el.tagName === "A" && el.hasAttribute("href") && el.parentElement && linksStandAlone(el.parentElement)) link(el, parent, key);
      else block(el, parent, key);
    } finally {
      for (const u of undo.reverse()) u();
    }
  }

  /* How much of it the page's own styles reach: none, and the browser's defaults are its whole look. */
  const reached = new Set<Element>();
  let rules = 0;
  const reach = (list: CSSRuleList) => {
    for (const r of Array.from(list)) {
      if (rules > 2000) return;
      if (r instanceof CSSStyleRule) {
        rules++;
        try { document.querySelectorAll(r.selectorText).forEach((e) => reached.add(e)); } catch { /* a selector this browser cannot run */ }
      } else if ("cssRules" in r && (r as CSSGroupingRule).cssRules) reach((r as CSSGroupingRule).cssRules);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) { try { reach(sheet.cssRules); } catch { /* another origin's sheet */ } }
  document.querySelectorAll("[style]").forEach((e) => reached.add(e));
  const styledParts = parts.filter((p) => { try { const e = document.querySelector(p.selector.replace(/ ::line\(\d+\)$/, "").replace(/::(before|after)$/, "")); return !!e && reached.has(e); } catch { return false; } }).length;

  const bs = css(document.body);
  const hs = css(document.documentElement);
  const ground = !seeThrough(bs.backgroundColor) ? bs.backgroundColor : !seeThrough(hs.backgroundColor) ? hs.backgroundColor : "rgb(255, 255, 255)";
  let lowest = 0;
  for (const p of parts) if (!p.hidden) lowest = Math.max(lowest, p.box.y + p.box.h);
  /* The @keyframes the parts' animations name, each frame's declarations as the sheet wrote them. */
  const named = new Set(parts.flatMap((p) => (p.style.animation ?? []).map((a) => a.name)));
  const tokensOut = (v: string) => { for (let i = 0; i < 6 && v.includes("var("); i++) v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (_, name: string, fb?: string) => hs.getPropertyValue(name).trim() || (fb ?? "").trim()); return v; };
  const keyframes: NonNullable<PageRead["keyframes"]> = [];
  const frameRules = (list: CSSRuleList) => {
    for (const r of Array.from(list)) {
      if (r instanceof CSSKeyframesRule) {
        if (!named.has(r.name) || keyframes.some((k) => k.name === r.name) || keyframes.length >= 40) continue;
        /* With the page's tokens resolved: a board has no `--pons-tv-antenna-swing` to read, and a frame it cannot read turns the rod to nothing. */
        keyframes.push({ name: r.name, frames: Array.from(r.cssRules).slice(0, 40).map((f) => { const kf = f as CSSKeyframeRule; const style: Record<string, string> = {}; for (let i = 0; i < kf.style.length; i++) { const prop = kf.style[i]!; style[prop] = tokensOut(kf.style.getPropertyValue(prop)); } return { key: kf.keyText, style }; }) });
      } else if ("cssRules" in r && (r as CSSGroupingRule).cssRules) frameRules((r as CSSGroupingRule).cssRules);
    }
  };
  if (named.size) for (const sh of Array.from(document.styleSheets)) { try { frameRules(sh.cssRules); } catch { /* another origin's sheet */ } }
  /* Every turn put back as it was. */
  for (const { el, had } of lifted.reverse()) { if (had === null) el.removeAttribute("style"); else el.setAttribute("style", had); }
  return {
    title: document.title.trim(),
    width: innerWidth,
    height: Math.max(document.documentElement.scrollHeight, lowest),
    bg: ground,
    colour: bs.color,
    family: bs.fontFamily,
    px: parseFloat(bs.fontSize) || 16,
    styledParts,
    hiddenBlocks,
    templates,
    truncated,
    parts,
    ...(keyframes.length ? { keyframes } : {}),
  };
};
