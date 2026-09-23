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
 * WHAT IS LEFT TO WORK FROM, and it is enough — but not what I first thought.
 * My first predicate looked for the tint's colour in the node's ACCENT and
 * for something painted behind it, and it was wrong on both counts for the
 * second case that was measured. His "Burn Tokens" entry carries no accent at
 * all, only `colour.text`, and every box behind it paints nothing whatever.
 * It would have been skipped in silence.
 *
 * The signal that does hold, on both measured cases and on the page where
 * there is no active entry at all, is the one his sidebar makes obvious:
 *
 *   IN A SET OF CHOICES, THE ACTIVE ONE IS THE ONE WHOSE INK DIFFERS FROM
 *   THE INK THE REST AGREE ON.
 *
 * Twelve of his thirteen docs entries are the same muted grey and the
 * thirteenth is the accent; five of his six time buttons are the same dim
 * white and the sixth is the accent. It is written as "differs from what the
 * others share" and never as "equals the green", so it survives a different
 * accent and a different grey, and it does not grab text that is green by
 * design. And it predicts the page it was NOT fitted to: on his home page
 * every sidebar entry is grey, so it finds no active entry there, which is
 * what his reference shows.
 *
 * So: the tint's colour is the node's own ink, and what it was laid over is
 * the innermost containing box that paints a surface — or, when none does,
 * the page's own background, because that is what the browser composited
 * against. The fourth thing, the tint's OPACITY, is gone; see `TINT`.
 *
 * MEASURED. His "1W" carries ink `rgb(0, 255, 0)` in a card surfaced
 * `rgb(21, 25, 34)`; green at a tenth over that is `rgb(19, 48, 31)`, which
 * is the value the other lane arrived at independently by re-reading the
 * capture. Same number from the opposite direction.
 *
 * NARROWED TO CONTROLS ON PURPOSE. Only a part the library treats as a
 * control — one carrying a `variant` — is considered, which both measured
 * cases are. Without that, a column of same-sized paragraphs with one
 * coloured differently is indistinguishable from a set of choices, and
 * painting a box behind somebody's highlighted sentence is a change nobody
 * asked for. Missing an active entry is safe; inventing one is not. If a
 * `box`-shaped active entry ever turns up, this is the line to widen, and it
 * should be widened against measured data rather than in advance.
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
 * WHICH ROLE THE COLOUR GOES IN, measured rather than reasoned, because the
 * answer changed underneath this. There are two routes to a fill on a
 * control, and they are not equivalent:
 *
 *   accent + variant solid   the button paints it itself, INSIDE its padding
 *   colour.bg                the wrapper paints it, out to the node's edge
 *
 * Seeded four ways at 60x30 and read off a production build, the first fills
 * 35x15 and the second 35x18 of a 35x18 box — which is the very fault the
 * chrome lane fixed as "a box's fill reaches its edge", and `Cta.tsx` now
 * stands aside (`background: saidRole(t, "bg") ? "transparent" : fill`) so
 * the wrapper can do it. So `bg` is the role: it is what the page actually
 * had — a `background-color` on the element — and it is the one that fills
 * the box.
 *
 * THE VARIANT IS LEFT ALONE, and that is a deliberate departure from "and
 * variant solid". With `bg` set the button paints nothing either way, so the
 * variant makes no difference to either measured node; and forcing `solid`
 * WOULD change the text colour of any node that never named one, from the
 * accent to the accent's contrast — light text on a dark tint, which is the
 * wrong way round. Doing less is the safer half here.
 *
 * (The old route is also why the fault showed as nothing at all rather than a
 * faint tint: a `ghost` fills with `accent + "22"`, and an eight-digit hex
 * suffix on an `rgb(...)` string is not a colour.)
 */
export interface Painted {
  id: string;
  /** The opaque colour the browser would have drawn. */
  paint: string;
  /** The role to put it in: the one that fills the box rather than the words. */
  role: "bg";
  /** The tint's own colour, which is the node's own ink. */
  tint: string;
  /** What it was laid over, and whose box that was — or the page's own. */
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

/**
 * The ink a part was given: its own text colour, or its accent when the
 * converter wrote the colour there instead. His two measured cases differ on
 * exactly this — the time button carries both, the sidebar entry only `text`.
 */
function inkOf(f: Frag): string | null {
  const t = f.colour?.text?.trim();
  if (t) return t;
  const a = f.colour?.accent?.trim();
  return a || null;
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
 *  - it must be a CONTROL, so a coloured paragraph in a list is not mistaken
 *    for an active choice;
 *  - it must have an ink of its own, or there is no tint colour to use;
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
 *  - and there must be something to lay the tint over: a box behind it that
 *    paints, or failing that the page's own background. With neither, the
 *    answer would be invented rather than worked out.
 *
 * And his hand is exempt, as everywhere else: a colour he chose is his.
 */
export function repaintActive(frags: readonly Frag[], pageBg?: string | null): Painted[] {
  const out: Painted[] = [];
  const page = pageBg?.trim() && rgb(pageBg) ? pageBg.trim() : null;
  for (const f of frags) {
    if (f.byHand) continue;
    /* A control, and only a control: see the note at the top of this file. */
    if (typeof f.options?.variant !== "string") continue;
    if (surfaceOf(f)) continue;
    /* A choice is labelled; an icon is not. */
    if (!wordsOf(f).trim()) continue;
    const ink = inkOf(f);
    if (!ink || !rgb(ink)) continue;

    const set = frags.filter((o) => beside(f, o));
    if (!set.some((o) => wordsOf(o).trim())) continue;
    /*
     * Odd one out, and the rest agreeing. With only one other choice there is
     * nothing to be odd against: each of a pair differs from the other and
     * neither is more active, so a pair is left alone. Compared as written
     * rather than parsed, so a palette in `oklch()` — which is what his
     * inactive entries are in — is compared perfectly well without this
     * needing to understand it.
     */
    if (set.length < 2) continue;
    const rest = set.map((o) => (inkOf(o) ?? "").replace(/\s+/g, " ").trim().toLowerCase());
    if (rest.some((a) => a !== rest[0])) continue;
    if (rest[0] === ink.replace(/\s+/g, " ").trim().toLowerCase()) continue;

    /*
     * What it was laid over: the innermost box that actually paints, and the
     * PAGE when none of them does. His docs sidebar is the second case —
     * every box behind the entry has no colour at all, so the browser
     * composited the tint straight onto the page.
     */
    const behind = frags
      .filter((o) => within(o, f) && surfaceOf(o))
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
    const over_ = behind ? surfaceOf(behind)! : page;
    if (!over_) continue;
    const paint = over(ink, over_);
    if (!paint) continue;
    out.push({
      id: f.id, paint, role: "bg",
      tint: ink, over: over_, overId: behind?.id ?? "the page", among: set.length,
    });
  }
  return out;
}

/** One line a person can read about the controls that got their tint back. */
export function paintSays(done: readonly Painted[]): string {
  if (!done.length) return "No control had lost its active tint.";
  return `${done.length} active control${done.length === 1 ? "" : "s"} repainted, ${done.length === 1 ? "its" : "their"} tint laid back over what sits behind: ${done.map((d) => d.paint).join(", ")}.`;
}
