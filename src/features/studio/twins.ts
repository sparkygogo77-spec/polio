/**
 * The same box emitted twice.
 *
 * WHAT HE HAS. Across his nine pages, 24 pairs where one box contains another
 * at 88% or more of its area, and the pattern repeats per page rather than
 * scattering. Thirteen are PIXEL IDENTICAL — page_home's `n_box_31` and
 * `n_box_32`, both 270x26 at 1468,393; the main content panel of almost every
 * page, twice, exactly on top of itself. Nine differ by EXACTLY ONE PIXEL OF
 * WIDTH and nothing else, 256 against 255: the sidebar, on every page.
 *
 * WHAT IT IS NOT. Not one element read through two box models — that was the
 * standing hypothesis and the capture refutes it. His raw capture holds six
 * parent/child pairs whose rects are identical to the pixel, and they are two
 * distinct DOM elements every time: `div` inside `div`, `button` inside
 * `div`, `img` inside `div`. The page really does wrap a row in a box the
 * same size. Nothing is being measured twice.
 *
 * WHAT IT IS. `pageBlocks` dedupes correctly — one box is one block, within
 * two pixels — and `offered` throws that work away for everything the
 * wrapper-opening loop dropped: `rest` is filtered against the blocks that
 * SURVIVED and never against itself, so where neither twin survived, both are
 * emitted. That one gap predicts both shapes, because the two-pixel tolerance
 * that would have caught 256-against-255 lives inside `pageBlocks` and `rest`
 * applies none.
 *
 * WHAT THIS IS FOR. The converter fix (`offered`) stops it happening again
 * and reaches a NEW capture only. This is the retrofit: it finds the twins
 * already written into a document and takes the spare one out.
 *
 * AND IT IS NOT THE EMPTY-WRAPPER RULE, which is why it lives in its own
 * file. An empty wrapper that has slid below its contents must be
 * REPOSITIONED and must never be removed — deleting one takes his banner off
 * the page. A duplicate is safe to remove for one reason only: an identical
 * twin remains in its place. That is a test this performs (`keeps`, and the
 * check that the survivor is not itself being removed), not an assumption it
 * makes. Where it cannot prove the twin survives, it leaves both alone.
 *
 * Pure — no React, no store, no DOM — so `tests/twins.mjs` can hold the rules
 * without a browser or a build.
 */
import type { Frag } from "./reassemble.ts";

/** One spare copy, and the node that stays in its place. */
export interface Twin {
  /** The copy being removed. */
  id: string;
  /** The one that remains — checked to remain, not assumed to. */
  keeps: string;
  /** Why that one was the keeper. */
  why: "says" | "draws" | "shows" | "outermost";
  /** How many were stacked there in all. */
  of: number;
}

/**
 * How far two boxes may differ and still be the same box.
 *
 * Two pixels, which is `pageBlocks`' own tolerance and no wider. It covers
 * the thirteen identical pairs and the nine that differ by one pixel of
 * width; his other two pairs do not fit either shape and are deliberately
 * left. A rule that removed anything merely SIMILAR — his 88%-of-area
 * measure, say — would take out a genuinely smaller element sitting inside a
 * slightly larger one, which is a real part of his page.
 */
const NEAR = 2;

const same = (a: Frag, b: Frag): boolean =>
  a.pageId === b.pageId
  && Math.abs(a.x - b.x) <= NEAR && Math.abs(a.y - b.y) <= NEAR
  && Math.abs(a.w - b.w) <= NEAR && Math.abs(a.h - b.h) <= NEAR;

/** The words a part draws, whether it holds a plain string or runs. */
function wordsOf(f: Frag): string {
  const c = f.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((r) => (r as { text?: string }).text ?? "").join("");
  return "";
}

/** Does this part draw something of its own? */
const draws = (f: Frag): boolean => !!(f.picture || f.cube || f.vector || f.mesh || f.code || f.outline);

/**
 * Does it show a surface of its own: a fill or colour it names, an edge that
 * is drawn, a texture, an aura? The same test as `shows` in reassemble.ts.
 *
 * His wallet button, once it stops drawing words that are not its own, says
 * nothing and draws nothing, and is still the same box as the bare div round
 * it. It is the one wearing his dark fill and green edge; ranked only on
 * words and drawings the two tied, the first was kept, and it was the div.
 */
function shows(f: Frag): boolean {
  const painted = f.colour && Object.values(f.colour).some((v) => typeof v === "string" && v.trim());
  const ruled = !!f.edge && (f.edge.width ?? 0) > 0 && f.edge.style !== "none";
  /* A shadow is a surface too: a screen's vignette is a layer the size of the picture that is only an inset shadow (`tests/screen-filter.mjs`). */
  const shaded = !!(f.edge as { shadow?: string } | null | undefined)?.shadow?.trim();
  return !!painted || ruled || shaded || !!f.texture || !!f.aura;
}

/** What a part paints, as one comparable value: its fill and ink, edge, texture, aura, and the page's own art (a gradient, a filter, a blend). */
function paint(f: Frag): string {
  const a = (f as { art?: { background?: unknown; filter?: unknown; blend?: unknown; backdrop?: unknown } | null }).art;
  const art = a ? [a.background, a.filter, a.blend, a.backdrop].filter((v) => typeof v === "string" && v.trim()) : [];
  const drawn = draws(f) ? [JSON.stringify(f.picture ?? null), JSON.stringify(f.vector ?? null)] : [];
  return JSON.stringify([shows(f) ? [f.colour, f.edge, f.texture, f.aura] : null, art, drawn]);
}
/** Does `s` paint something `keeper` does not? Bare, or painted the same, it does not. */
function paintsMore(s: Frag, keeper: Frag): boolean {
  const mine = paint(s);
  return mine !== paint({ id: "", pageId: "", featureId: "", x: 0, y: 0, w: 0, h: 0, content: "" } as Frag) && mine !== paint(keeper);
}

/**
 * The spare copies, each with the one that stays.
 *
 * THE KEEP RULE, and the easy one would have been wrong: keep the twin that
 * SAYS or DRAWS something, then one that SHOWS a surface of its own, and
 * only failing all three the outermost. On his page
 * `n_box_92` and `n_ctaprimary_93` are the same box — a div wrapping a button
 * — and "keep the first" throws away the button and leaves a bare box, which
 * would look fine in a count and be wrong on his screen. Same for the div
 * wrapping his logo, and the div wrapping a paragraph. Only when neither says
 * anything is the outermost kept, which is `pageBlocks`' own convention.
 *
 * Nothing his hand touched is considered at all: if any of a stack is his,
 * the whole stack is left, because a copy he moved is a copy he meant.
 */
export function twins(frags: readonly Frag[]): Twin[] {
  const out: Twin[] = [];
  const done = new Set<string>();
  for (const f of frags) {
    if (done.has(f.id)) continue;
    const stack = frags.filter((o) => !done.has(o.id) && same(f, o));
    for (const s of stack) done.add(s.id);
    if (stack.length < 2) continue;
    // A copy he moved is a copy he meant.
    if (stack.some((s) => s.byHand)) continue;

    const rank = (s: Frag) => (wordsOf(s).trim() ? 4 : draws(s) ? 3 : shows(s) ? 2 : 1);
    const keeper = stack.reduce((best, s) => {
      const r = rank(s), br = rank(best);
      if (r !== br) return r > br ? s : best;
      // Neither speaks: the outermost, which is the biggest, then the first.
      return s.w * s.h > best.w * best.h ? s : best;
    }, stack[0]!);
    const why = wordsOf(keeper).trim() ? "says" : draws(keeper) ? "draws" : shows(keeper) ? "shows" : "outermost";
    /* A copy that paints something its keeper does not is an overlay, not a spare (trumpmorty.fun's TV scanlines and glare over its screen; `tests/twins-overlays.mjs`). */
    for (const s of stack) if (s.id !== keeper.id && !paintsMore(s, keeper)) out.push({ id: s.id, keeps: keeper.id, why, of: stack.length });
  }
  /*
   * AND THE PROOF, rather than the assumption. A copy is only safe to remove
   * because its twin remains, so nothing whose keeper is itself on the
   * removal list is removed. The grouping above makes that impossible by
   * construction; this is here so that if it ever becomes possible, the pass
   * drops those rather than eating both.
   */
  const going = new Set(out.map((t) => t.id));
  const here = new Set(frags.map((f) => f.id));
  return out.filter((t) => here.has(t.keeps) && !going.has(t.keeps));
}

/** One line a person can read about the copies that were taken out. */
export function twinSays(done: readonly Twin[]): string {
  if (!done.length) return "No box on this page was emitted twice.";
  return `${done.length} duplicate box${done.length === 1 ? "" : "es"} removed, each with its twin left in place: ${done.map((t) => `${t.id}→${t.keeps}`).join(", ")}.`;
}
