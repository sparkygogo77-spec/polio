/**
 * The paint a capture dropped, put back on a board that already exists.
 *
 * WHAT WENT WRONG, and it is the converter's rather than the page's. A
 * control that is the ACTIVE one of a set is usually picked out by a
 * translucent tint of its own colour laid over whatever is behind it —
 * `oklab(0.86644 -0.233888 0.179499 / 0.1)` on his time buttons. The capture
 * could not read `oklab()`, so the tint was dropped, and the node arrived
 * with its border colour and no surface at all: an outline where the page
 * had a solid. The other lane fixed the reading. That fix is in the
 * converter, so it reaches a NEW capture and nothing whatever on a board
 * that is already written down — which is where his is.
 *
 * WHAT IS LEFT TO WORK FROM, and it is enough. Three of the four things the
 * browser used are still in the document:
 *
 *   - the TINT'S COLOUR, as the node's own accent, because the tint and the
 *     border are the same colour on a control picked out this way;
 *   - WHAT IS BEHIND IT, as the surface of the innermost box that contains
 *     it and paints one;
 *   - WHICH node it is, because the dropped tint left a fingerprint: in a row
 *     of controls that are choices, the active one is the one painted
 *     differently from the rest, and it is the only one with nothing to
 *     paint.
 *
 * The fourth, the tint's OPACITY, is gone — see `TINT`. It is the one number
 * here that is assumed rather than read, and it is named so it can be argued
 * with rather than buried.
 *
 * MEASURED, on the one case there is data for: his "1W" button carries accent
 * `rgb(0, 255, 0)` and sits in a box whose surface is `rgb(21, 25, 34)`.
 * Green at a tenth over that is `rgb(19, 48, 31)` — which is the value the
 * other lane arrived at independently by re-reading the capture. Same number
 * from the opposite direction.
 *
 * Pure — no React, no store, no DOM — so `tests/repaint.mjs` can hold the
 * rules without a browser or a build.
 */
import type { Frag } from "./reassemble.ts";

/**
 * HOW MUCH OF THE TINT IS THE TINT: the one thing not in the document.
 *
 * His capture recorded `/ 0.1`, and a tenth is what a design system reaches
 * for when it wants "this one is on" without shouting. It is a constant and
 * not a guess per node, because a guess that varies is a guess nobody can
 * check; this one reproduces the measured value exactly and is wrong in one
 * place only if his site uses a different alpha somewhere, in which case
 * that node comes out slightly too dark or too light and never wrong in kind.
 */
export const TINT = 0.1;

/**
 * A control whose dropped tint has been worked out again.
 *
 * WHICH ROLE THE COLOUR GOES IN is the part's business, not ours, and the two
 * kinds differ. A control fills from its ACCENT — `Cta.tsx` is one line,
 * `outline ? transparent : ghost ? accent+"22" : accent` — so putting the
 * blend there and setting the variant to solid is the whole correction. (And
 * that `accent+"22"` is why the fault showed as nothing at all rather than as
 * a faint tint: an eight-digit hex suffix on an `rgb(...)` string is not a
 * colour, so the ghost drew no fill whatsoever.) A plain box has no variant
 * and fills from its SURFACE, which the converter writes alongside `bg`.
 */
export interface Painted {
  id: string;
  /** The opaque colour the browser would have drawn. */
  paint: string;
  /** The role to put it in: what this kind of part actually fills from. */
  role: "accent" | "surface";
  /** Whether the part also needs telling it is solid now. */
  solid: boolean;
  /** The tint's own colour, which is the node's accent. */
  tint: string;
  /** What it was laid over, and whose box that was. */
  over: string;
  overId: string;
  /** How many other choices it sits among: what made it the odd one out. */
  among: number;
}

const rgb = (raw: string | undefined | null): [number, number, number] | null => {
  if (!raw) return null;
  const s = raw.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const h = hex[1]!;
    const at = (i: number) => parseInt(h.length === 3 ? h[i]!.repeat(2) : h.slice(i * 2, i * 2 + 2), 16);
    return [at(0), at(1), at(2)];
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (!m) return null;
  const v = [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
  return v.every((n) => Number.isFinite(n)) ? v : null;
};

/**
 * A tint laid over what is behind it, the way a browser does it: straight
 * over in sRGB, which is what `background-color` compositing is.
 */
export function over(tint: string, behind: string, alpha = TINT): string | null {
  const a = rgb(tint), b = rgb(behind);
  if (!a || !b) return null;
  const mix = (i: number) => Math.round(alpha * a[i]! + (1 - alpha) * b[i]!);
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
}

/** Does this box paint a surface of its own, and which colour? */
function surfaceOf(f: Frag): string | null {
  const c = f.colour;
  if (!c) return null;
  const s = (c.surface ?? c.bg ?? "").trim();
  return s && rgb(s) ? s : null;
}

/** Is this box wholly inside that one, on the same page? */
function within(outer: Frag, inner: Frag): boolean {
  return outer.id !== inner.id
    && outer.pageId === inner.pageId
    && inner.x >= outer.x - 1 && inner.y >= outer.y - 1
    && inner.x + inner.w <= outer.x + outer.w + 1
    && inner.y + inner.h <= outer.y + outer.h + 1;
}

/** The words a part draws, whether it holds a plain string or runs. */
function wordsOf(f: Frag): string {
  const c = f.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((r) => (r as { text?: string }).text ?? "").join("");
  return "";
}

/** Two controls are one set of choices when they line up and match in size. */
function beside(a: Frag, b: Frag): boolean {
  if (a.id === b.id || a.pageId !== b.pageId || a.featureId !== b.featureId) return false;
  if (Math.abs(a.h - b.h) > 2) return false;
  const row = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > Math.min(a.h, b.h) * 0.5;
  const column = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > Math.min(a.w, b.w) * 0.5;
  /* A row of tabs or a column of sidebar entries: both are sets of choices,
     and the fault reads the same way in either. */
  return row || column;
}

/**
 * The controls whose active tint the capture dropped, with the colour it
 * should have been.
 *
 * Every condition here is a way of NOT painting something that was never
 * tinted, because painting a control that was meant to be bare is a visible
 * change nobody asked for:
 *
 *  - it must have an accent of its own, or there is no tint colour to use;
 *  - it must have NO surface of its own, or nothing was dropped;
 *  - it must SAY something, and so must something else in its set. A choice
 *    a person can pick is labelled; this is what tells a row of tabs from a
 *    row of icons, and it is the condition that stops two 20x20 `svg` marks
 *    in his own document — accent green, no surface, sitting beside each
 *    other — from being given a green square they never had;
 *  - it must be one of a SET of choices, because "active" is only a thing
 *    among alternatives;
 *  - it must be the ODD ONE OUT of a set where the REST AGREE. Two choices
 *    painted differently are ambiguous — each is the odd one out of the other
 *    — so nothing is done to a pair, and a set is at least three. With three
 *    or more all agreeing but one, the one that differs is the active one;
 *  - and something behind it must paint a surface, or there is nothing to
 *    lay the tint over and the answer would be invented rather than worked
 *    out.
 *
 * And his hand is exempt, as everywhere else: a colour he chose is his.
 */
export function repaintActive(frags: readonly Frag[]): Painted[] {
  const out: Painted[] = [];
  for (const f of frags) {
    if (f.byHand) continue;
    const tint = f.colour?.accent?.trim();
    if (!tint || !rgb(tint)) continue;
    if (surfaceOf(f)) continue;
    /* A choice is labelled; an icon is not. */
    if (!wordsOf(f).trim()) continue;
    const set = frags.filter((o) => beside(f, o));
    if (!set.some((o) => wordsOf(o).trim())) continue;
    /*
     * Odd one out, and the rest agreeing. With only one other choice there is
     * nothing to be odd against: each of a pair differs from the other and
     * neither is more active than the other, so a pair is left alone.
     */
    if (set.length < 2) continue;
    const rest = set.map((o) => (o.colour?.accent ?? "").trim().toLowerCase());
    if (rest.some((a) => a !== rest[0])) continue;
    if (rest[0] === tint.toLowerCase()) continue;
    const behind = frags
      .filter((o) => within(o, f) && surfaceOf(o))
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
    if (!behind) continue;
    const paint = over(tint, surfaceOf(behind)!);
    if (!paint) continue;
    const control = typeof f.options?.variant === "string";
    out.push({
      id: f.id, paint, role: control ? "accent" : "surface", solid: control,
      tint, over: surfaceOf(behind)!, overId: behind.id, among: set.length,
    });
  }
  return out;
}

/** One line a person can read about the controls that got their tint back. */
export function paintSays(done: readonly Painted[]): string {
  if (!done.length) return "No control had lost its active tint.";
  return `${done.length} active control${done.length === 1 ? "" : "s"} repainted, ${done.length === 1 ? "its" : "their"} tint laid back over what sits behind: ${done.map((d) => d.paint).join(", ")}.`;
}
