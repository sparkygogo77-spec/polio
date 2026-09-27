/**
 * A CAPTURED SITE, PUBLISHED FLUID. THE OWNER'S RULING.
 *
 * The export was laid out at the capture's width and scaled to the window
 * (`zoom`). Beside the original at 2000 wide it was 13% too big, and browser
 * zoom did nothing, because the page rescaled to fill whatever was left. The
 * original draws everything 1:1 and stretches: the sidebar flush left at its
 * own width, the header and footer bars the window's width with their
 * contents centred at natural size, the main column from the sidebar to the
 * right edge, the four stat cards sharing it, the panels reaching the edge.
 *
 * WHAT THE DOCUMENT HOLDS, AND WHAT IS INFERRED. Every captured part keeps
 * where it came from: its element path (`from.selector`), which says what it
 * sits inside, and `from.position` for a fixed band. Its flex or grid layout
 * (direction, justify, align, the number of grid columns) and its padding
 * are fields. What is not held: a max-width and the auto margins that centred
 * it, widths as a share, the insets of a fixed band. Those are read off the
 * geometry at the capture's width instead, and each rule says so.
 *
 * THE MODEL. Past (or short of) the capture's width W the page has D more
 * pixels. Every part moves by `kx`·D and grows by `kw`·D, the page itself
 * growing by all of it (kx 0, kw 1). A part's numbers come from its parent's:
 *   · parent does not grow: the part moves with it and does not grow;
 *   · grid parent of N columns: column i moves i/N of its growth, grows 1/N;
 *   · flex row, justify space-between: item i of n moves i/(n-1) of it;
 *     centre, half; end, all of it;
 *   · otherwise by where it stood (inferred): across the parent's inner
 *     width, it grows with it; from the left inner edge to the right edge
 *     and wider than half, it fills the rest (the main column); centred, it
 *     moves half; against the right inner edge only, it moves all of it;
 *     anything else stays with the left.
 * At W, D is 0 and every part is where the capture put it.
 *
 * FIXED BANDS. A part the capture found fixed, and every part inside it, is
 * fixed in the export too, so the header, the sidebar and the footer stay
 * put when the page scrolls, as they did. Anchored by where the band stood
 * in the capture's window (inferred from its height, the bottom of the
 * lowest fixed band): at the top, top; at the bottom, bottom (the footer is
 * pinned to the window's foot); touching neither, both (the sidebar runs
 * the window's height). Its insides keep the band's anchor.
 *
 * Only a site with captured parts is laid out this way; a part placed by
 * hand keeps its place (kx 0, kw 0), and a hand-built site is untouched.
 */

export interface FluidPart {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  selector?: string | null;
  position?: string | null;
  /** A sticky part's inset, the sides that stick it, in px. */
  inset?: { top?: number; right?: number; bottom?: number; left?: number } | null;
  layout?: { display?: string; direction?: string; justify?: string; align?: string; gap?: number; columns?: number } | null;
  pad?: { left?: number; right?: number } | null;
}

/**
 * A length at the window's width: `c` px at the capture's width W, plus `k`
 * of D (the window less W), or, where a max-width is inferred, a CSS
 * expression of its own.
 */
export interface Len { c: number; k: number; css?: string }

export interface Fluid {
  left: Len;
  width: Len;
  /** Fixed in the window, and anchored at its top, its bottom, or both. */
  fixed?: "top" | "bottom" | "both";
  /** A fixed band's height, where the page below it begins sooner than its own measured foot. */
  height?: number;
}

const E = 1.5;
const D = (W: number) => `(100% - ${W}px)`;

/** A length as CSS. */
export function css(l: Len, W: number): string {
  if (l.css) return l.css;
  return Math.abs(l.k) < 1e-9 ? `${+l.c.toFixed(3)}px` : `calc(${+l.c.toFixed(3)}px + ${D(W)} * ${+l.k.toFixed(6)})`;
}
/** a + f·b, kept linear while both are. */
function plus(a: Len, b: Len, f: number, W: number): Len {
  if (f === 0 || (!b.css && b.c === 0 && b.k === 0)) return a;
  if (!a.css && !b.css) return { c: a.c + f * b.c, k: a.k + f * b.k };
  const inner = (l: Len) => css(l, W).replace(/^calc/, "");
  return { c: a.c + f * b.c, k: a.k + f * b.k, css: `calc(${inner(a)} + ${inner(b)} * ${+f.toFixed(6)})` };
}
const px = (c: number): Len => ({ c, k: 0 });

export function isCaptured(p: { from?: { selector?: string | null } | null }): boolean {
  return !!p.from?.selector?.trim();
}

/** The path of what an element sits inside, from its own. */
const up = (sel: string) => sel.slice(0, Math.max(0, sel.lastIndexOf(" > ")));

/** Where a part a band owns goes: into the band's element, at its place within the band. */
export interface BandMove {
  /** The band (sticky or fixed) whose element takes the part in. */
  band: string;
  /** The part's top inside the band, in px: its own less the band's. */
  top: number;
  /** How far the band stands from the page's left, in px, to take off the part's own left. */
  dx: number;
}

/**
 * THE PARTS A BAND OWNS STICK WITH IT. share.xyz's header is a sticky band
 * holding the wordmark, the search field and the category row; the export
 * drew each as a part of its own beside the band, so the band stuck and its
 * contents scrolled away. A part whose recorded path continues the band's
 * (`owns.ts#under`) is the band's: it goes inside the band's element, at
 * its place within it, and sticks with it. A band inside a band takes its
 * own parts first and then goes into the outer one with them; a part out
 * of the flow (absolute, fixed) inside a band goes with it all the same,
 * since it was measured against it. A part is moved at most once, into the
 * nearest band that owns it.
 */
export function bandMoves(parts: readonly FluidPart[]): Map<string, BandMove> {
  const out = new Map<string, BandMove>();
  const bands = parts.filter((p) => p.selector && (p.position === "sticky" || p.position === "fixed"));
  /* The nearest band first: the longest path owns most closely. */
  bands.sort((a, b) => b.selector!.length - a.selector!.length);
  for (const band of bands) {
    for (const p of parts) {
      if (p === band || !p.selector || out.has(p.id)) continue;
      if (!p.selector.startsWith(`${band.selector} > `)) continue;
      out.set(p.id, { band: band.id, top: p.y - band.y, dx: band.x });
    }
  }
  return out;
}

/** Every part's left and width, for one page captured at width W. */
export function fluidParts(parts: readonly FluidPart[], W: number): Map<string, Fluid> {
  const out = new Map<string, Fluid>();
  const caught = parts.filter((p) => p.selector);
  /* What each part sits inside: the nearest captured part whose path its own begins with. */
  const parentOf = new Map<string, FluidPart | null>();
  for (const p of caught) {
    let best: FluidPart | null = null;
    for (const q of caught) {
      if (q === p || !p.selector!.startsWith(`${q.selector} > `)) continue;
      if (!best || q.selector!.length > best.selector!.length) best = q;
    }
    parentOf.set(p.id, best);
  }
  const kidsOf = new Map<string | null, FluidPart[]>();
  for (const p of caught) {
    const k = parentOf.get(p.id)?.id ?? null;
    kidsOf.set(k, [...(kidsOf.get(k) ?? []), p]);
  }
  /* The window's height at the capture (inferred): the foot of the lowest fixed band. */
  const H = captureHeight(parts);

  const page: FluidPart = { id: "", x: 0, y: 0, w: W, h: 0, selector: "body" };
  const place = (P: FluidPart, pk: Fluid, fixed: Fluid["fixed"]) => {
    const kids = (kidsOf.get(P.id || null) ?? []).slice().sort((a, b) => a.x - b.x);
    /* How much P has grown: its width now less its width at W. */
    const grow: Len = pk.width.css ? { c: 0, k: 0, css: `(${css(pk.width, W).replace(/^calc/, "")} - ${P.w}px)` } : { c: pk.width.c - P.w, k: pk.width.k };
    const still = !grow.css && Math.abs(grow.k) < 1e-9;
    const padL = P.pad?.left ?? 0, padR = P.pad?.right ?? 0;
    const inL = P.x + padL, inR = P.x + P.w - padR;
    const L = P.layout;
    const row = L?.display === "flex" && L.direction !== "column";
    const col = L?.display === "flex" && L.direction === "column";
    /* A flex row packed from the start whose items fill it: one of them grows (flex: 1), and the capture does not say which. Inferred: the widest. */
    const gapPx = L?.gap ?? 0;
    const fills = row && (!L?.justify || L.justify === "normal" || L.justify === "flex-start" || L.justify === "start")
      && kids.length > 1 && Math.abs(kids.reduce((t, c) => t + c.w, 0) + gapPx * (kids.length - 1) - (inR - inL)) <= E * kids.length;
    const grower = fills ? kids.reduce((a, b) => (b.w > a.w ? b : a)) : null;
    let pastGrower = false;
    kids.forEach((C, i) => {
      /* Where C's left is, as a share of P's growth, and how much of it C takes. */
      const at = (f: number, fw = 0): Fluid => ({ left: plus(plus(pk.left, px(C.x - P.x), 1, W), grow, f, W), width: plus(px(C.w), grow, fw, W) });
      let k: Fluid;
      const left = C.x - inL, right = inR - (C.x + C.w);
      const spans = Math.abs(left) <= E && Math.abs(right) <= E;
      /* The element C sat in is not a part (the board folded it away), so P's layout is not C's parent's: read by where C stood. */
      const lost = !!P.selector && !!C.selector && up(C.selector) !== P.selector;
      if (still) k = at(0);
      else if (!lost && L?.display === "grid" && (L.columns ?? 0) > 1) {
        const n = L.columns!;
        const colW = (inR - inL + gapPx) / n;
        const c0 = Math.max(0, Math.min(n - 1, Math.round(left / colW)));
        const across = Math.max(1, Math.min(n - c0, Math.round((C.w + gapPx) / colW)));
        k = at(c0 / n, across / n);
      } else if (!lost && fills) {
        if (C === grower) { k = at(0, 1); pastGrower = true; } else k = at(pastGrower ? 1 : 0);
      } else if (!lost && row && L?.justify === "space-between" && kids.length > 1 && !spans) k = at(i / (kids.length - 1));
      else if (!lost && row && L?.justify === "center") k = at(0.5);
      else if (!lost && row && (L?.justify === "flex-end" || L?.justify === "end")) k = at(1);
      else if (!lost && col && L?.align === "center" && !spans) k = at(0.5);
      else if (spans) k = at(0, 1);
      else if (Math.abs(right) <= E && C.w > (inR - inL) / 2) k = at(0, 1);
      else if (Math.abs(C.x + C.w / 2 - (inL + inR) / 2) <= E) {
        /* Centred, and no wider than P's inside: the capture drops a max-width, and this is what one does (the header's row is 1280 at most, 1248 in a 1280 window). */
        const inside = plus(px(inR - inL), grow, 1, W);
        const insideCss = css(inside, W).replace(/^calc/, "");
        const width = `min(${C.w}px, ${insideCss})`;
        const l0 = plus(pk.left, px(inL - P.x), 1, W);
        /* The free space shared as the capture shared it: its own rounding kept, so at W it is exactly where it was. */
        const share = inR - inL - C.w > 0 ? (C.x - inL) / (inR - inL - C.w) : 0.5;
        k = { width: { c: C.w, k: 0, css: width }, left: { c: C.x, k: 0, css: `calc(${css(l0, W).replace(/^calc/, "")} + (${insideCss} - ${width}) * ${+share.toFixed(6)})` } };
      } else if (Math.abs(right) <= E && left > E) k = at(1);
      else if (lost && C.x + C.w / 2 > (inL + inR) / 2) k = at(1);
      else k = at(0);
      let f = fixed;
      if (!f && C.position === "fixed") {
        const top = C.y <= E, bottom = H > 0 && Math.abs(C.y + C.h - H) <= E;
        f = top ? "top" : bottom ? "bottom" : "both";
      }
      if (f) k.fixed = f === "both" && C.position !== "fixed" ? "top" : f;
      /*
       * A BAND AT THE TOP ENDS WHERE THE PAGE BELOW IT BEGINS. Sink's banner
       * measured 82 tall (captured with a stand-in wallet chip, taller than
       * the real one), and the page under it is laid out for 73: the
       * sidebar's top inset and the main column's margin. Drawn at 82 it
       * hid the top 9px of the cards, their top edges with them. So a band
       * fixed at the top is as tall as the space the page left it: the top
       * of the first part not inside it that starts within it. Its insides
       * are their own parts and keep their places.
       */
      if (!fixed && C.position === "fixed" && k.fixed === "top") {
        const inside = (q: FluidPart) => !!q.selector && q.selector.startsWith(`${C.selector} > `);
        const below = caught.filter((q) => q !== C && !inside(q) && q.y > C.y + E && q.y < C.y + C.h - E && q.x < C.x + C.w && q.x + q.w > C.x);
        if (below.length) k.height = Math.min(...below.map((q) => q.y)) - C.y;
      }
      out.set(C.id, k);
      place(C, k, f === "both" ? "top" : f);
    });
  };
  place(page, { left: px(0), width: { c: W, k: 1 } }, undefined);
  return out;
}

/**
 * The part's own style, re-anchored: `left` and `width`, and for a fixed
 * band `position`, `top` and `bottom`. H is the capture's window height.
 */
export function fluidStyle(el: HTMLElement, p: FluidPart, k: Fluid, W: number, H: number): void {
  const st = el.style;
  st.left = css(k.left, W);
  if (k.width.css || Math.abs(k.width.k) > 1e-9) st.width = css(k.width, W);
  /*
   * A STICKY BAND STAYS STICKY. share.xyz's header and category row are
   * `position: sticky; top: 0`, and the export drew them once at the top
   * and scrolled them away. The frame's parts are absolute; a sticky part
   * has to be in the flow to stick, so it stands in the flow at the place
   * it was measured — its top and left as margins, and its height taken
   * back below so the frame grows by nothing — and sticks at the inset the
   * page gave it. Written after the parts that flow, it paints over them.
   */
  if (p.position === "sticky") {
    st.position = "sticky";
    st.top = `${p.inset?.top ?? 0}px`;
    st.marginTop = `${p.y}px`;
    st.marginBottom = `-${p.h}px`;
    st.marginLeft = st.left;
    st.left = "auto";
    return;
  }
  if (!k.fixed) return;
  st.position = "fixed";
  if (k.fixed === "top") { st.top = `${p.y}px`; st.bottom = ""; if (k.height) { st.height = st.minHeight = `${k.height}px`; st.overflow = "clip"; } }
  else if (k.fixed === "bottom") { st.top = "auto"; st.bottom = `${H - (p.y + p.h)}px`; }
  else { st.top = `${p.y}px`; st.bottom = `${H - (p.y + p.h)}px`; st.minHeight = "0px"; st.height = "auto"; }
}

/** The capture's window height for a page: the foot of its lowest fixed band. */
export function captureHeight(parts: readonly FluidPart[]): number {
  return Math.max(0, ...parts.filter((p) => p.selector && p.position === "fixed").map((p) => p.y + p.h));
}
