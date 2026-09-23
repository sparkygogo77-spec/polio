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
  colour?: { text?: string } | null;
  font?: { weight?: number; face?: string; size?: number } | null;
  link?: { kind: string; target: string } | null;
  byHand?: boolean;
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
        if (gap > spaceAt(last) * gapMax * 4) break;
        run.push(next);
        taken.add(next.id);
      }
      if (run.length < 2) continue;
      /* The runs, with a space put back wherever the gap says one belonged. */
      const spans: Span[] = [];
      run.forEach((f, i) => {
        if (i > 0) {
          const prev = run[i - 1]!;
          const gap = f.x - (prev.x + prev.w);
          if (gap >= spaceAt(prev)) spans.push({ text: " " });
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
