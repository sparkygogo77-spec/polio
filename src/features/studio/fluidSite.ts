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
  /** Its border's width (sink `node.edge.width`): its inside starts inside it, so a child against the border is against the edge (`tests/fluid-edges.mjs`). */
  edge?: number | null;
  /** The px max-width the page gave it (sink `node.maxw`): it grows with the window no further (`tests/fluid-maxwidth.mjs`). */
  maxw?: number | null;
  /** The press that shows it (sink `behaviours.states`, `group:option`), or none: the page as it opens. */
  state?: string | null;
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

/** The path of what an element sits inside, from its own; a `::before` / `::after` sits inside its element. */
const up = (sel: string) => (/::(before|after)$/.test(sel) ? sel.replace(/::(before|after)$/, "") : sel.slice(0, Math.max(0, sel.lastIndexOf(" > "))));
/**
 * Is `sel` inside `of`: a descendant, or one of its `::before` / `::after`.
 * A pseudo-element was a part of the page's own at the page's level, and a
 * screen's vignette (`X::after`, placed absolutely) moved as a free
 * decoration while its screen stayed (`tests/screen-filter.mjs`).
 */
const within = (sel: string, of: string) => sel.startsWith(`${of} > `) || sel.startsWith(`${of}::`);

/** Where a part a band owns goes: into the band's element, at its place within the band. */
export interface BandMove {
  /** The sticky band whose element takes the part in. */
  band: string;
  /** The part's top inside the band, in px: its own less the band's. */
  top: number;
  /** How far the band stands from the page's left, in px, to take off the part's own left. */
  dx: number;
  /**
   * The part's left and width inside the band, when the band is narrower
   * than the page: a share of the page (`calc(100% …)`) would be a share of
   * the band once inside it, so the measured px stand instead. Null for a
   * band as wide as the page, where the part's own fluid left and width
   * mean the same inside it (sink's sidebar band at 1507 put its parts at 1).
   */
  inside: { left: string; width: string } | null;
}

/**
 * THE PARTS A BAND OWNS STICK WITH IT. share.xyz's header is a sticky band
 * holding the wordmark, the search field and the category row; the export
 * drew each as a part of its own beside the band, so the band stuck and its
 * contents scrolled away. A part whose recorded path continues the band's
 * (`owns.ts#under`) is the band's: it goes inside the band's element, at
 * its place within it, and sticks with it. A part is moved at most once,
 * into the nearest band that owns it. A band inside a band stays where it
 * is: a fixed part is placed against the window whatever holds it, so
 * moving it in and taking the outer band's top off it (sink's header
 * inside its wrapper, both fixed at 73) put it at 0 and everything it
 * held with it; it keeps its own place and takes its own parts in.
 */
export function bandMoves(parts: readonly FluidPart[], W = 0): Map<string, BandMove> {
  const out = new Map<string, BandMove>();
  /* Sticky bands only: a fixed band's parts are already fixed with it (`fluidParts` hands fixedness down), and a part inside a fixed band stays so. */
  const fixed = parts.filter((p) => p.selector && p.position === "fixed").map((p) => p.selector!);
  const inFixed = (p: FluidPart) => p.position === "fixed" || fixed.some((f) => within(p.selector!, f));
  const bands = parts.filter((p) => p.selector && p.position === "sticky");
  /*
   * WHICH BAND, WHEN A PRESS SHOWS ONE. gotchi.gg's starter panel is sticky;
   * pressing boo changes the panel's own height, so the capture keeps boo's
   * panel as a band of its own at the same path as the page's. Every part
   * under that path went into the page's panel, the one boo's press hides,
   * and boo's panel was an empty box. A part goes into a band of its own
   * press first; else into one of the page as it opens (pup's press keeps
   * the page's panel and changes what is in it); never into another
   * press's band, and a part of the page as it opens never into a press's.
   */
  const key = (p: FluidPart) => p.state ?? null;
  for (const p of parts) {
    if (!p.selector || p.position === "sticky" || inFixed(p)) continue;
    const own = bands.filter((b) => b !== p && within(p.selector!, b.selector!) && (key(b) === key(p) || key(b) === null));
    if (!own.length) continue;
    /* Its own press's band first, then the nearest: the longest path owns most closely. */
    own.sort((a, b) => Number(key(b) === key(p)) - Number(key(a) === key(p)) || b.selector!.length - a.selector!.length);
    const band = own[0]!;
    const full = band.x === 0 && (W <= 0 || Math.abs(band.w - W) <= 1);
    out.set(p.id, { band: band.id, top: p.y - band.y, dx: band.x, inside: full ? null : { left: `${p.x - band.x}px`, width: `${p.w}px` } });
  }
  return out;
}

/**
 * WHAT A STICKY BAND STICKS INSIDE. On the page a sticky element sticks
 * within its parent: gotchi.gg's starter panel within the starter grid, so
 * it travels at most the grid's height and stops at its foot. In the export
 * the band stands in the frame's flow, so it stuck against the whole page:
 * scrolled down, it slid out of its section and over the next ones. A band
 * whose parent is less than the page is held in a box of its own standing
 * where the parent stood (its top and height: the parent's part, or else
 * the parts inside the parent), and sticks inside that. So is a band a
 * press shows, and the page's own band of the same path, so that each
 * stands at its own place whichever of them is showing, not after the other.
 * `pageH` is the page's height; the result is each held band's box.
 */
export function stickyHolds(parts: readonly FluidPart[], pageH: number): Map<string, { top: number; height: number }> {
  const out = new Map<string, { top: number; height: number }>();
  const bands = parts.filter((p) => p.selector && p.position === "sticky");
  const pressed = new Set(bands.filter((b) => b.state).map((b) => b.selector!));
  for (const band of bands) {
    const parent = up(band.selector!);
    const same = (q: FluidPart) => !q.state || q.state === band.state;
    const inParent = parts.filter((q) => q.selector && same(q) && (q.selector === parent || within(q.selector, parent)));
    const top = inParent.length && parent ? Math.min(...inParent.map((q) => q.y)) : 0;
    const foot = inParent.length && parent ? Math.max(...inParent.map((q) => q.y + q.h)) : pageH;
    const whole = top <= E && foot >= pageH - E;
    if (whole && !band.state && !pressed.has(band.selector!)) continue;
    out.set(band.id, { top, height: Math.max(band.h, foot - top) });
  }
  return out;
}

/**
 * The top margin of each sticky band, in the order they stand in the frame.
 *
 * A sticky band is in the flow among absolute parts (`fluidStyle`): it
 * stands at its top by a margin and takes its height back below, so the
 * flow's cursor is at its top once it has passed. The next band's margin
 * is measured from there, not from the frame's top: sink's docs page has
 * two sticky bands at 63, and the second, given 63 again, stood at 126.
 */
export function stickyFlow(inOrder: readonly FluidPart[]): Map<string, number> {
  const out = new Map<string, number>();
  let cursor = 0;
  /* Where the flow stood before the page's own band of each path: a band a press shows in its place stands from there, and moves nothing after it. */
  const before = new Map<string, number>();
  for (const p of inOrder) {
    if (p.position !== "sticky") continue;
    if (p.state) { out.set(p.id, p.y - (before.get(p.selector ?? "") ?? cursor)); continue; }
    if (p.selector) before.set(p.selector, cursor);
    out.set(p.id, p.y - cursor);
    cursor = p.y;
  }
  return out;
}

/** Every part's left and width, for one page captured at width W. */
/**
 * A grid's columns as its children stand in them, when they are not all one
 * width: each child's span, joined where they overlap, one column each, and
 * only when that makes exactly `n`. The widest (to 1.5px) grow; the rest keep
 * their width. Null when the columns are equal or cannot be told apart, and
 * the grid is shared evenly as before.
 */
export function gridTracks(kids: readonly FluidPart[], n: number, inL: number, inR: number): { x0: number; x1: number; grows: boolean }[] | null {
  const spans = kids.map((k) => [k.x, k.x + k.w] as [number, number]).sort((a, b) => a[0] - b[0]);
  const joined: [number, number][] = [];
  for (const [a, b] of spans) {
    const last = joined[joined.length - 1];
    if (last && a < last[1] - E) last[1] = Math.max(last[1], b);
    else joined.push([a, b]);
  }
  if (joined.length !== n || inR <= inL) return null;
  const widths = joined.map(([a, b]) => b - a);
  const widest = Math.max(...widths);
  if (widths.every((w) => Math.abs(w - widest) <= E)) return null;
  return joined.map(([a, b], i) => ({ x0: a, x1: b, grows: Math.abs(widths[i]! - widest) <= E }));
}

export function fluidParts(parts: readonly FluidPart[], W: number): Map<string, Fluid> {
  const out = new Map<string, Fluid>();
  const caught = parts.filter((p) => p.selector);
  /* What each part sits inside: the nearest captured part whose path its own begins with. */
  const parentOf = new Map<string, FluidPart | null>();
  for (const p of caught) {
    let best: FluidPart | null = null;
    for (const q of caught) {
      if (q === p || !within(p.selector!, q.selector!)) continue;
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
    const border = Math.max(0, P.edge ?? 0);
    const padL = (P.pad?.left ?? 0) + border, padR = (P.pad?.right ?? 0) + border;
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
      /*
       * A MAX-WIDTH CONTAINER (stonkfun.xyz's `max-width: 1440px; margin: 0
       * auto`): it grows with what holds it up to its max-width and no
       * further; centred at the capture (as much room either side), it stays
       * centred. What is inside it follows it; a full-bleed band beside it
       * still stretches.
       */
      else if (C.maxw && C.maxw > 0 && C.w <= C.maxw + E && (spans || (C.w >= C.maxw - E && Math.abs(left - right) <= E))) {
        const inside = css(plus(px(inR - inL), grow, 1, W), W).replace(/^calc/, "");
        const grown = css(plus(px(C.w), grow, 1, W), W).replace(/^calc/, "");
        const width = `min(${C.maxw}px, ${grown})`;
        const l0 = css(plus(pk.left, px(inL - P.x), 1, W), W).replace(/^calc/, "");
        const centred = Math.abs(left - right) <= E;
        /* The free space shared as the capture shared it: the browser's own rounding kept (SOLCINERATOR's 1280 row at 242, not 241.5, in 1763), so at W it is exactly where it was. */
        const share = inR - inL - C.w > 0 ? (C.x - inL) / (inR - inL - C.w) : 0.5;
        k = { width: { c: C.w, k: 0, css: width }, left: { c: C.x, k: 0, css: centred ? `calc(${l0} + (${inside} - ${width}) * ${+share.toFixed(6)})` : `calc(${l0} + ${left}px)` } };
      }
      else if (!lost && L?.display === "grid" && (L.columns ?? 0) > 1) {
        const n = L.columns!;
        const tracks = gridTracks(kids, n, inL, inR);
        if (tracks) {
          /*
           * COLUMNS OF THEIR OWN WIDTHS (parasiteonsol.fun's hero: an 82px
           * sidebar beside a 1251px stage, `grid-template-columns: auto 1fr`):
           * read off where the children stand, the widest columns take the
           * growth between them and a narrow one keeps its width, so the
           * sidebar stays at the left at its size (`tests/fluid-edges.mjs`).
           */
          const i0 = tracks.findIndex((t) => C.x + C.w / 2 >= t.x0 - E && C.x + C.w / 2 <= t.x1 + E);
          const c0 = i0 < 0 ? 0 : i0;
          const growers = tracks.filter((t) => t.grows).length || 1;
          const before = tracks.slice(0, c0).filter((t) => t.grows).length;
          const endAt = tracks.findIndex((t) => C.x + C.w <= t.x1 + E);
          const last = endAt < 0 ? tracks.length - 1 : Math.max(c0, endAt);
          const inside = tracks.slice(c0, last + 1).filter((t) => t.grows).length;
          k = at(before / growers, inside / growers);
        } else {
          const colW = (inR - inL + gapPx) / n;
          const c0 = Math.max(0, Math.min(n - 1, Math.round(left / colW)));
          const across = Math.max(1, Math.min(n - c0, Math.round((C.w + gapPx) / colW)));
          k = at(c0 / n, across / n);
        }
      } else if (!lost && fills) {
        if (C === grower) { k = at(0, 1); pastGrower = true; } else k = at(pastGrower ? 1 : 0);
      } else if (!lost && row && L?.justify === "space-between" && kids.length > 1 && !spans) k = at(i / (kids.length - 1));
      else if (!lost && row && L?.justify === "center") k = at(0.5);
      else if (!lost && row && (L?.justify === "flex-end" || L?.justify === "end")) k = at(1);
      else if (!lost && col && L?.align === "center" && !spans) k = at(0.5);
      else if (spans) k = at(0, 1);
      else if (Math.abs(right) <= E && C.w > (inR - inL) / 2) k = at(0, 1);
      /* Past both inner edges (trumpmorty.fun's turned ribbons, 1586 at -73 in 1440): it overhangs, and keeps its overhang as P grows (`tests/fluid-overhang.mjs`). */
      else if (left < -E && right < -E) k = at(0, 1);
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
      /* Placed absolutely (a decoration: trumpmorty.fun's ringed planet, the site's `right: 36%`): it moves by where its centre stood across what holds it, so it stays by what it sits over (`tests/fluid-wide.mjs`). */
      else if (C.position === "absolute" && inR - inL > 0) k = at(Math.max(0, Math.min(1, (C.x + C.w / 2 - inL) / (inR - inL))));
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
        const inside = (q: FluidPart) => !!q.selector && within(q.selector, C.selector!);
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
    /* Above the parts that flow past it; the parts it owns are inside it (bandMoves), so nothing of its own is covered. */
    st.zIndex = "2";
    return;
  }
  if (!k.fixed) return;
  st.position = "fixed";
  if (k.fixed === "top") { st.top = `${p.y}px`; st.bottom = ""; if (k.height) { st.height = st.minHeight = `${k.height}px`; st.overflow = "clip"; } }
  else if (k.fixed === "bottom") { st.top = "auto"; st.bottom = `${H - (p.y + p.h)}px`; }
  else { st.top = `${p.y}px`; st.bottom = `${H - (p.y + p.h)}px`; st.minHeight = "0px"; st.height = "auto"; }
}

/**
 * A PART STANDS ON A WHOLE PIXEL. A place that follows the window lands on
 * half a pixel where the window's width is odd (trumpmorty.fun's CA bar at
 * 1763: 748.5). The browser snaps a box's fill and border to the pixel grid
 * but cuts by a part's `clip-path` where it really is, so a part clipped to
 * the rounded inside of the box it sits in (the CA and COPY ends) stopped
 * half a pixel short of the box's border, and the box's own white fill
 * showed in that gap: a fringe along the ends. On the page the ends were
 * inside the box and snapped with it. Here each part is its own element, so
 * each is placed on a whole pixel, and all of them the same way: the box
 * and what is in it keep the offsets they were captured at.
 *
 * `round()` is newer than the rest of the page's CSS, so the published page
 * keeps the exact place as `--at-x` / `--at-y` and rounds it only where the
 * browser can (`SNAP_CSS`); the Preview runs in the Builder's own browser
 * and rounds inline when it can. A place already in whole px is left as it
 * is. `tests/part-whole-pixel.mjs`.
 */
export const SNAP_CSS = `@supports (left: round(1px, 1px)) { [style*="--at-x:"] { left: round(var(--at-x), 1px) !important; top: round(var(--at-y), 1px) !important; } }`;
const WHOLE = /^-?\d+px$/;
export function snapPlace(el: HTMLElement, inline: boolean): boolean {
  const st = el.style;
  if (st.position !== "absolute" || !st.left || !st.top || (WHOLE.test(st.left) && WHOLE.test(st.top))) return false;
  /* Already placed so (the Preview lays the page out again after a render that left this part alone). */
  if (st.left.startsWith("round(") || st.left === "var(--at-x)") return false;
  if (inline) {
    if (typeof CSS === "undefined" || !CSS.supports?.("left", "round(1px, 1px)")) return false;
    st.left = `round(${st.left}, 1px)`; st.top = `round(${st.top}, 1px)`;
    return true;
  }
  st.setProperty("--at-x", st.left); st.setProperty("--at-y", st.top);
  st.left = "var(--at-x)"; st.top = "var(--at-y)";
  return true;
}

/**
 * A CUT WINDOW AS WIDE AS THE PAGE. The capture cuts a part to the box it
 * hangs out of as an `inset()` in px in the part's own frame (trumpmorty.fun's
 * marquee tracks, cut to their ribbons). Where the window's right edge falls on
 * the page's right edge at the capture's width (the part's x, less its right
 * inset, moved by its transform's x), it moves with that edge as the window
 * grows or shrinks; any other cut is left as captured (null). The page is
 * never narrower than 1280, as `frameCss` has it. `tests/fluid-wide.mjs`.
 */
export function fluidClip(clip: string, p: { x: number; w: number }, tx: number, W: number): string | null {
  /* Its rounded corners, when the box that cut it was rounded, ride along as written. */
  const m = /^inset\(\s*(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(\s+round\s[^)]*)?\s*\)$/.exec(clip.trim());
  if (!m) return null;
  const [t, r, b, l] = m.slice(1, 5).map(Number) as [number, number, number, number];
  const edge = p.x + p.w - r + tx;
  if (Math.abs(edge - W) > 4) return null;
  return `inset(${t}px max(0px, calc(${r}px - (max(100vw, ${Math.min(W, 1280)}px) - ${W}px))) ${b}px ${l}px${m[5] ?? ""})`;
}

/**
 * A HERO THAT FILLS THE WINDOW. Sink records a box the page sized in the
 * window's height (`node.vh`: trumpmorty.fun's hero, min-height 100svh, 900 at
 * the capture). In a taller window it is that much taller, never shorter, and
 * what stands under it moves down by the difference; what stands in it moves
 * by its centre's share of the hero's height (its column is centred, its hills
 * sit on the foot). Above the hero's top, nothing (null). `tests/sink-fields.mjs`.
 */
export function vhShift(p: { y: number; h: number }, hero: { y: number; h: number }, px: number, group: { y: number; h: number } = p, height = `max(100svh, ${px}px)`): string | null {
  const grow = `(${height} - ${px}px)`;
  if (p.y >= hero.y + hero.h - 0.5) return `calc(${p.y}px + ${grow})`;
  if (p.y < hero.y) return null;
  /* By the share of the group it stands in (the hero's child that holds it), so a TV and its antenna move as one. */
  const share = Math.max(0, Math.min(1, (group.y + group.h / 2 - hero.y) / Math.max(1, hero.h)));
  return `calc(${p.y}px + ${grow} * ${+share.toFixed(6)})`;
}

/**
 * WHAT FILLS THE HERO GROWS WITH IT. parasiteonsol.fun's slide is
 * `clamp(520px, calc(100svh - 168px), 900px)`: 732 at the capture's 900
 * window, 842 at 1010. Its world (a grid row of `1fr`) and the canvas that
 * fills the world (`inset: 0; height: 100%`) are as much taller: 816 and 813
 * at 1010 where they were 706 and 702. A part inside the hero that reaches
 * from its upper part down to its foot (to within its padding and border:
 * `edge` px) and takes at least half its height is one of those: it keeps
 * its top and grows by what the hero grew. Null for any other part, which
 * `vhShift` moves instead. `tests/world-height.mjs`.
 */
export function vhStretch(p: { y: number; h: number }, hero: { y: number; h: number }, px: number, height = `max(100svh, ${px}px)`, edge = 40): string | null {
  const foot = hero.y + hero.h, bottom = p.y + p.h;
  if (p.y < hero.y - 0.5 || bottom > foot + 0.5 || foot - bottom > edge || p.h < hero.h * 0.5) return null;
  return `calc(${p.h}px + (${height} - ${px}px))`;
}

/**
 * HOW TALL A WINDOW-HEIGHT HERO IS: as the page wrote it (`vh.height`:
 * parasiteonsol.fun's `clamp(520px, -168px + 100svh, 900px)`, 732 at 900;
 * `vh.minHeight`: trumpmorty's 100svh). Where the page wrote a minimum it is
 * never under what it holds (`vh.content`, else the px captured), plus what
 * its type grew by. `tests/hero-height.mjs`.
 */
export function heroHeight(vh: { height?: string; minHeight?: string; px?: number; content?: number }, grow: string | null = null, measured = 0): string {
  const written = vh.height ?? vh.minHeight ?? "100svh";
  /* Taller than its minimum at the capture (stonkfun.xyz's page wrapper, min-height 100vh, 1995 tall at 900): its content made it so, and that is its floor. */
  const floor = !vh.height && measured > (vh.px ?? 0) + 1 ? measured : vh.content ?? (vh.height ? null : vh.px ?? null);
  if (floor === null) return grow ? `calc(${written} + ${grow})` : written;
  return grow ? `max(${written}, calc(${floor}px + ${grow}))` : `max(${written}, ${floor}px)`;
}

/** The capture's window height for a page: the foot of its lowest fixed band. */
export function captureHeight(parts: readonly FluidPart[]): number {
  return Math.max(0, ...parts.filter((p) => p.selector && p.position === "fixed").map((p) => p.y + p.h));
}

/** A part's type set with the window (`node.font.fluid`, sink 3c98763), beside the px it measured. */
export interface TypePart extends FluidPart { fluid?: string | null; px?: number | null }

/**
 * TYPE THAT GROWS WITH THE WINDOW MOVES WHAT IS AROUND IT. trumpmorty.fun's
 * title is `clamp(58px, 8.6vw, 132px)`: 123.84px at the capture's 1440, 132
 * at 2000, and 14px taller there; the CA line under it in the same column is
 * 14px lower, and the column, centred in the hero, 7px higher. The export
 * stands every part on the page, so what the browser does by flowing is said
 * here as a shift in CSS, from the parts' recorded paths and layouts:
 *   · a part set in window units grows by its height times the size's
 *     change (`fluid` × h/px − h), as words do when nothing re-wraps;
 *   · in a block or a column, a part moves down by what grew above it among
 *     its siblings in the flow, and its parent grows by all of it;
 *   · in a row or a grid, the parent grows by its tallest child's growth,
 *     and a child centred across it moves by half the difference (the end,
 *     all of it);
 *   · a box sized in the window's height (the hero, 100svh) takes its
 *     content's growth into its own height (`heroGrow`), and a child it
 *     centres moves up by half its own growth.
 * Parts placed absolutely, fixed or sticky neither grow a flow nor are moved
 * by one; they move with the part they sit in. Nothing grows on a page with
 * no type set in window units. `tests/fluid-type.mjs`.
 */
export function typeShifts(parts: readonly TypePart[], heroId: string | null = null): { shift: Map<string, string>; heroGrow: string | null; pageGrow: string | null } {
  const shift = new Map<string, string>();
  if (!parts.some((p) => p.fluid && p.px)) return { shift, heroGrow: null, pageGrow: null };
  const caught = parts.filter((p) => p.selector);
  const parentOf = new Map<string, TypePart | null>();
  for (const p of caught) {
    let best: TypePart | null = null;
    for (const q of caught) if (q !== p && within(p.selector!, q.selector!) && (!best || q.selector!.length > best.selector!.length)) best = q;
    parentOf.set(p.id, best);
  }
  const kidsOf = new Map<string | null, TypePart[]>();
  for (const p of caught) { const k = parentOf.get(p.id)?.id ?? null; kidsOf.set(k, [...(kidsOf.get(k) ?? []), p]); }
  const placed = (p: TypePart) => p.position === "absolute" || p.position === "fixed" || p.position === "sticky";
  const sum = (xs: string[]) => (xs.length ? `(${xs.join(" + ")})` : null);
  const across = (P: TypePart | null) => !!P?.layout && (P.layout.display === "grid" || (P.layout.display === "flex" && P.layout.direction !== "column"));
  const grew = new Map<string, string | null>();
  let heroGrow: string | null = null;
  /* What each part grows by, inside out. */
  const growOf = (P: TypePart | null): string | null => {
    const key = P?.id ?? "";
    if (grew.has(key)) return grew.get(key)!;
    const own = P?.fluid && P.px && P.px > 0 ? `(${P.fluid} * ${+(P.h / P.px).toFixed(6)} - ${P.h}px)` : null;
    const flow = (kidsOf.get(P?.id ?? null) ?? []).filter((k) => !placed(k));
    const gs = flow.map(growOf).filter((g): g is string => !!g);
    const kids = !gs.length ? null : across(P) ? `max(0px, ${gs.join(", ")})` : sum(gs);
    let g = own && kids ? `(${own} + ${kids})` : own ?? kids;
    /* The hero holds its growth in its own height: nothing beside it is moved by it here. */
    if (P && P.id === heroId) { heroGrow = kids; g = null; }
    grew.set(key, g);
    return g;
  };
  const pageGrow = growOf(null);
  /* Where each part moves: its parent's move, and its own place in the parent. */
  const place = (P: TypePart | null, at: string | null) => {
    const kids = (kidsOf.get(P?.id ?? null) ?? []).slice().sort((a, b) => a.y - b.y);
    const flow = kids.filter((k) => !placed(k));
    const G = growOf(P) ?? (P && P.id === heroId ? heroGrow : null);
    const align = P?.layout?.align;
    for (const C of kids) {
      let mine: string | null = null;
      if (!placed(C)) {
        const g = growOf(C);
        if (P && P.id === heroId && across(P)) mine = g && align === "center" ? `(${g} * -0.5)` : g && (align === "flex-end" || align === "end") ? `(${g} * -1)` : null;
        else if (across(P)) mine = !G ? null : align === "center" ? `((${G} - ${g ?? "0px"}) * 0.5)` : align === "flex-end" || align === "end" ? `(${G} - ${g ?? "0px"})` : null;
        else mine = sum(flow.filter((s) => s !== C && s.y + s.h <= C.y + 1.5).map(growOf).filter((x): x is string => !!x));
      }
      const total = at && mine ? `(${at} + ${mine})` : at ?? mine;
      if (total) shift.set(C.id, total);
      place(C, total);
    }
  };
  place(null, null);
  return { shift, heroGrow, pageGrow };
}
