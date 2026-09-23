/**
 * Putting a sentence back together, after a capture broke it into parts.
 *
 * HIS TWO CASES. The price line on his site reads a Solana mark, "$118.35", a
 * down arrow, "-0.46%" — one sentence, several colours, inline. It arrived as
 * four or five parts that each wrapped on their own. His header reads "A Sol
 * Works project" where "Works" is a different face; it arrived as three, and
 * "A Sol" then wrapped inside a box too short to hold it.
 *
 * HIS DIAGNOSIS, AND IT IS THE RIGHT ONE: the words disconnect because of the
 * colour difference, and the boxes touching is what shortens the one before.
 * A capture splits a text node wherever its ink changes, because until now a
 * node's words were a flat string and a differently coloured run could not be
 * held inside one. It can now (`parts/spans.ts`), so the split stops here.
 *
 * WHY THIS IS A REBUILD AND NOT ONLY A READER CHANGE. His site is brought in
 * by the copy-whole door: the repository holds a document that was published
 * from an earlier capture, so the fragments are already written down. Teaching
 * the reader to emit runs would fix the next page he captures and would do
 * nothing at all for the board he is looking at. This runs over a document as
 * it is taken in, so a re-import reassembles what is already there.
 *
 * Pure — no React, no store, no DOM — so `tests/reassemble.mjs` can hold the
 * rules without a browser or a build.
 */
import { merged, type Span } from "./parts/spans.ts";

/**
 * WHICH VERSION OF THESE RULES A DOCUMENT HAS BEEN THROUGH.
 *
 * A board is swept once and then left alone, so a person opening the Builder
 * does not have their document rewritten every time. The mark is this number
 * rather than a boolean, so bumping it here is the whole of "sweep every
 * board again" — and forgetting to bump it is the whole of "leave them be".
 *
 * Bump it when a rule changes what a sweep would do.
 *
 *   1  the sentences put back together, and the wrappers fitted
 *   2  the active control's dropped tint worked out again (`repaint.ts`)
 *   3  the same box emitted twice, one copy taken out (`twins.ts`); and
 *      empty wrappers no longer removed, because they are misplaced rather
 *      than junk — a board swept at 1 or 2 may have lost one, and there is
 *      no putting that back from here, which is why the removal is gone
 *      rather than narrowed
 */
export const SWEEP = 3;

/** The parts this will consider joining: ones whose whole body is words. */
export const WORDY = new Set(["box", "prose", "value-prop", "micro-copy", "eyebrow-rule"]);

/** What this needs to know about a part. A `StudioNode` satisfies it. */
export interface Frag {
  id: string;
  pageId: string;
  featureId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  content: unknown;
  /** Palette roles this part repaints for itself. `text` is the ink; the rest paint its surface. */
  colour?: ({ text?: string; accent?: string; surface?: string; bg?: string } & Record<string, string | undefined>) | null;
  /** How the part was set up: `variant`, `size`, `shape`. */
  options?: Record<string, string> | null;
  font?: { weight?: number; face?: string; size?: number } | null;
  link?: { kind: string; target: string } | null;
  byHand?: boolean;
  /** Set when the node draws something of its own, so it is not a bare box. */
  picture?: unknown;
  cube?: unknown;
  vector?: unknown;
  mesh?: unknown;
  code?: unknown;
  outline?: unknown;
  /** Set when the box shows a surface of its own, so removing it would be seen. */
  texture?: unknown;
  aura?: unknown;
  edge?: { width?: number; style?: string } | null;
  /** What the capture recorded for its inside edges. */
  pad?: { top?: number; bottom?: number } | null;
}

export interface Reassembly {
  /** The part that stays, with the sentence in it. */
  keep: string;
  /** The parts it absorbs, which are removed. */
  drop: string[];
  /** The sentence, as runs. */
  spans: Span[];
  /** The box that holds it: the fragments' own, which is the capture's. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Absorbed parts he had moved or resized by hand, named so he can check. */
  tookByHand: string[];
}

/** Do these two share a horizontal band, so they read as one line? */
function sameLine(a: Frag, b: Frag): boolean {
  const over = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return over > Math.min(a.h, b.h) * 0.5;
}

/**
 * How far apart two pieces of one sentence may sit.
 *
 * MEASURED ON HIS PRICE LINE, which did not merge. "$ 116.59" ends at 1143
 * and "-1.94 %" starts at 1165: a gap of 22px against a limit that worked
 * out at 14.4px, or 20.7px if the capture had recorded a type size. It
 * missed by between one and eight pixels, which is no kind of rule at all —
 * the limit was derived from a font size the capture often does not write,
 * so it collapsed to its 2px floor and then multiplied that up.
 *
 * A box's own HEIGHT is the honest proxy: it is always recorded, and it
 * scales with the type the way a word space does. Two pieces of one line sit
 * closer together than that line is tall; a gap wider than the shorter box's
 * height is a layout gap between separate things, not the space inside a
 * sentence. His pair: the shorter box is 32 tall, three quarters of it is
 * 24, and 22 fits. A button 400px away on the same line still does not.
 */
function joinLimit(a: Frag, b: Frag): number {
  return Math.max(spaceAt(a) * 4, Math.min(a.h, b.h) * 0.75);
}

/**
 * A word's worth of space, in pixels, for a fragment of this size.
 *
 * THE ONE INFERENCE IN HERE, AND IT IS WORTH NAMING. The capture threw the
 * whitespace away when it split the sentence: "A Sol" and "Works" arrive as
 * two boxes with a gap between them and no space in either. So the gap has to
 * say whether a space belonged there. A space is about a quarter of the type
 * size in most faces, so half of that is the line between "these words are
 * separate" and "these characters are joined" — which is what tells
 * "A Sol" + "Works" (a real gap) from "$" + "118.35" (none).
 */
function spaceAt(f: Frag): number {
  const px = 16 * (typeof f.font?.size === "number" && f.font.size > 0 ? f.font.size : 1);
  return Math.max(2, px * 0.12);
}

/** The plain words a fragment carries, or nothing if it carries none. */
function wordsOf(f: Frag): string {
  return typeof f.content === "string" ? f.content : "";
}

/** The run this fragment contributes: only what differs from plain words. */
function runOf(f: Frag): Span {
  const s: Span = { text: wordsOf(f) };
  const ink = f.colour?.text?.trim();
  if (ink) s.colour = ink;
  if (typeof f.font?.weight === "number" && Number.isFinite(f.font.weight)) s.weight = f.font.weight;
  const face = f.font?.face?.trim();
  if (face) s.face = face;
  if (f.link && f.link.kind && f.link.target) s.link = { kind: f.link.kind as "page" | "url" | "node", target: f.link.target };
  return s;
}

/**
 * Sentences to put back together, on one page.
 *
 * A group is two or more wordy parts sitting on one line, left to right, each
 * close enough to the next to have been one sentence. Close enough is judged
 * against the type size rather than a flat number of pixels, so a heading and
 * a caption are held to the same rule at different scales.
 *
 * HIS RULING ON WHAT HE MOVED BY HAND: inside a group, everything merges. A
 * part he dragged or stretched is not untouchable here, because he made those
 * edits working around this very bug and has said twice that he wants the
 * correct result rather than his patches kept. Every one absorbed is named in
 * `tookByHand` so he can see exactly what was taken. Outside a group the
 * marker still holds and nothing he moved is touched.
 *
 * A part he dragged clean away from its line is not in the group at all,
 * because it is no longer on the line — the grouping is geometric and cannot
 * know it belonged. That is a limitation, not a decision, and it is the
 * reason the naming matters.
 */
export function sentences(frags: readonly Frag[], gapMax = 1.8): Reassembly[] {
  const out: Reassembly[] = [];
  const pages = new Set(frags.map((f) => f.pageId));
  for (const pageId of pages) {
    const here = frags
      .filter((f) => f.pageId === pageId && WORDY.has(f.featureId) && wordsOf(f).trim() && !wordsOf(f).includes("\n"))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const taken = new Set<string>();
    for (const first of here) {
      if (taken.has(first.id)) continue;
      const run: Frag[] = [first];
      taken.add(first.id);
      for (;;) {
        const last = run[run.length - 1]!;
        /* The nearest thing to the right, on the same line, near enough to
           have been part of the same sentence. */
        const next = here
          .filter((f) => !taken.has(f.id) && sameLine(last, f) && f.x >= last.x + last.w - 1)
          .sort((a, b) => a.x - b.x)[0];
        if (!next) break;
        const gap = next.x - (last.x + last.w);
        if (gap > joinLimit(last, next) * gapMax) break;
        run.push(next);
        taken.add(next.id);
      }
      if (run.length < 2) continue;
      /* The runs, with a space put back wherever the gap says one belonged. */
      const spans: Span[] = [];
      run.forEach((f, i) => {
        if (i > 0) {
          /*
           * THE SPACE THE PAGE HAD, PREFERRED OVER ANY GUESS AT IT.
           *
           * A run that carries its own edge whitespace is telling us what
           * the page actually did, and it is believed: no second space is
           * put beside one that is already there. The gap is only consulted
           * when neither side carries anything, which is what a document
           * captured before the reader kept its edges looks like.
           *
           * It is worth being plain that the gap CANNOT settle his header on
           * its own. "A Sol" + "Works" takes no space and "Works" +
           * "project" takes one, both boundaries are letter against letter,
           * and both pairs of boxes butt — so no rule reading only the text
           * or only the geometry can tell them apart. Only the page knew,
           * and now the run carries it.
           */
          const prev = run[i - 1]!;
          const already = /\s$/.test(wordsOf(prev)) || /^\s/.test(wordsOf(f));
          const gap = f.x - (prev.x + prev.w);
          if (!already && gap >= spaceAt(prev)) spans.push({ text: " " });
        }
        spans.push(runOf(f));
      });
      const x = Math.min(...run.map((f) => f.x));
      const y = Math.min(...run.map((f) => f.y));
      out.push({
        keep: run[0]!.id,
        drop: run.slice(1).map((f) => f.id),
        spans: merged(spans),
        x,
        y,
        w: Math.max(...run.map((f) => f.x + f.w)) - x,
        h: Math.max(...run.map((f) => f.y + f.h)) - y,
        tookByHand: run.filter((f) => f.byHand).map((f) => f.id),
      });
    }
  }
  return out;
}

/** One line a person can read, naming what was joined and what was taken. */
export function saysWhat(done: readonly Reassembly[]): string {
  if (!done.length) return "No sentence on this page was in pieces.";
  const parts = done.reduce((n, d) => n + d.drop.length + 1, 0);
  const hand = done.flatMap((d) => d.tookByHand);
  return `${done.length} sentence${done.length === 1 ? "" : "s"} put back together, out of ${parts} pieces.${
    hand.length ? ` ${hand.length} of them you had moved or stretched by hand and ${hand.length === 1 ? "it was" : "they were"} replaced: ${hand.join(", ")}.` : ""
  }`;
}

/* ------------------------------------------------------------------ */
/* Wrappers that hold nothing, or less than they claim                  */
/* ------------------------------------------------------------------ */

/**
 * A captured wrapper fitted to what it actually holds.
 *
 * WHAT HE CLICKED: a banner 1763x82 that looked empty, its contents sitting
 * outside it, adding height and gaps for nothing. Measured across the page
 * he screenshotted: 45 wrappers among 114 parts, five of them holding
 * nothing at all and worth 293px of height, three more claiming two children
 * and geometrically holding one.
 *
 * AND THE BANNER IS WHY "DROP THE EMPTY ONES" IS THE WRONG RULE. `n_box_75`
 * is 1763x82, claims one child and geometrically holds exactly one — the
 * 1280x49 wrapper that claims three and holds nothing. So it is a chain:
 * banner, into an empty div, into nothing. The banner is NOT empty, so a
 * rule that only dropped empties would walk straight past the part he
 * actually complained about. The footer is the same fault mirrored: 1763x73,
 * claims one, holds five.
 *
 * The claim and the geometry disagree in BOTH directions, which says they
 * come from different passes and one of them is wrong. So this trusts
 * neither claim: it asks where the boxes actually are, which is the same
 * thing every other rule in this file does.
 *
 * ONLY THE BOTTOM IS TRIMMED, and never the top. Shrinking a box can move
 * nothing; lifting one would, and lifting is the direction that puts a part
 * somewhere nobody placed it.
 */
export interface Slimming {
  id: string;
  /** The height it should have, given what it holds. */
  h: number;
  was: number;
  /** How many parts sit inside it, geometrically. Never zero: see below. */
  holds: number;
}

/**
 * A WRAPPER THAT HOLDS NOTHING IS NOT DELETED, AND THE REASON MATTERS.
 *
 * This used to remove them, on the reading that a box with nothing in it is
 * dead space a capture invented. Measured on his page, that reading is wrong
 * and the correction would have been destructive: both of the two empty
 * wrappers on his home page are REAL SURFACES THAT HAVE SLID BELOW THE
 * CONTENT THEY SHOULD CONTAIN.
 *
 *   n_box_75, the banner, 1763x65 at y 147 — and every header part is ABOVE
 *   it, from the logo at y -11 to the price line at y 65. The header runs
 *   -11..105; the banner band runs 147..212 and holds nothing.
 *
 *   n_box_46, the Your Tokens panel, 1507x172 at y 1247 — and its section is
 *   above it, the heading at 1056 and its sentences at 1160 and 1192.
 *
 * Deleting those takes his banner and his panel off the page for good. They
 * are not junk; they are misplaced, and the correction is to put them back
 * around what they own — which is a different piece, and a bigger one, since
 * a panel sitting below its contents contributes its whole height as dead
 * space and pushes everything after it down.
 *
 * So until that piece exists, an empty wrapper is REPORTED and never touched.
 * Fitting a wrapper that does hold something is unaffected and still runs:
 * that only ever gives back height nothing occupies.
 */
export function emptyWrappers(frags: readonly Frag[]): Frag[] {
  return frags.filter((w) => !w.byHand && isWrapper(w) && w.h > 0 && !frags.some((f) => within(w, f)));
}

/** Is this box wholly inside that one? On the same page: every page starts at 0,0 again. */
function within(outer: Frag, inner: Frag): boolean {
  return outer.id !== inner.id
    && outer.pageId === inner.pageId
    && inner.x >= outer.x - 1 && inner.y >= outer.y - 1
    && inner.x + inner.w <= outer.x + outer.w + 1
    && inner.y + inner.h <= outer.y + outer.h + 1;
}

/**
 * A part with no words and nothing drawn: a box that is only a box.
 *
 * AND IT MUST BE A BOX. Every one of the 75 wordless parts in his captured
 * document is a `box`, and a part of any other kind with nothing in it is
 * something else entirely: a `picture` holding no picture is a stand-in by
 * design, not a failed load, and deleting it would take a slot off the page
 * that somebody meant to fill. Caught by the chrome lane's own check, which
 * seeded exactly that and lost it.
 */
function isWrapper(f: Frag): boolean {
  if (f.featureId !== "box") return false;
  const words = typeof f.content === "string"
    ? f.content
    : Array.isArray(f.content) ? f.content.map((r) => (r as Span).text ?? "").join("") : "";
  return !words.trim() && !f.picture && !f.cube && !f.vector && !f.mesh && !f.code && !f.outline;
}

/**
 * Does this box show a surface of its own?
 *
 * REMOVING A BOX THAT SHOWS SOMETHING TAKES A BAND OFF THE PAGE. An empty
 * wrapper carrying a background, an edge, a texture or an aura is a coloured
 * strip somebody meant to be there, and it looks empty only because its
 * contents sit outside it. Fitting it is safe — that only takes away height
 * nothing occupies. Removing it is not, so one that shows anything is left
 * exactly where it is, and the report says how many were spared.
 */
function shows(f: Frag): boolean {
  const painted = f.colour && Object.values(f.colour).some((v) => typeof v === "string" && v.trim());
  const ruled = !!f.edge && (f.edge.width ?? 0) > 0 && f.edge.style !== "none";
  return !!painted || ruled || !!f.texture || !!f.aura;
}

/**
 * Wrappers that are taller than what they hold, with the height they should be.
 *
 * One holding something comes back fitted to its lowest child plus whatever
 * padding the capture recorded for its foot, so a banner stops carrying 33px
 * of nothing under its only child. One holding NOTHING is not here at all —
 * see `emptyWrappers` for why it is reported rather than removed.
 */
export function slimWrappers(frags: readonly Frag[]): Slimming[] {
  const out: Slimming[] = [];
  for (const w of frags) {
    // His hand put this box where it is, so its size is his answer, not ours.
    if (w.byHand || !isWrapper(w)) continue;
    const held = frags.filter((f) => within(w, f));
    // A box holding nothing is misplaced, not junk. Never touched here.
    if (!held.length) continue;
    const foot = Math.max(0, Math.round(w.pad?.bottom ?? 0));
    const want = Math.max(...held.map((f) => f.y + f.h)) - w.y + foot;
    /* A pixel or two is measurement, not dead space. */
    if (want > 0 && w.h - want > 2) out.push({ id: w.id, h: Math.round(want), was: w.h, holds: held.length });
  }
  return out;
}

/** One line a person can read about the boxes that were fitted, and the ones left. */
export function slimSays(done: readonly Slimming[], empty: readonly Frag[] = []): string {
  const saved = done.reduce((n, d) => n + (d.was - d.h), 0);
  const left = empty.length
    ? ` ${empty.length} box${empty.length === 1 ? "" : "es"} hold nothing and ${empty.length === 1 ? "was" : "were"} left alone: ${empty.map((e) => e.id).join(", ")}.`
    : "";
  if (!done.length) return `No box on this page was bigger than what it holds.${left}`;
  return `${done.length} box${done.length === 1 ? "" : "es"} fitted to what ${done.length === 1 ? "it holds" : "they hold"}: ${saved}px of empty box.${left}`;
}
