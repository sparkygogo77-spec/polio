/**
 * Which part a drawing changes: nearly always none.
 *
 * THE OWNER'S TRUMPMORTY.FUN. A cube drawn on the hero turned the hero into
 * the cube, 1440 wide became 1339, and the published page lost its right
 * edge. The audit (`docs/audits/drawing-and-import-sequence.md`) found the
 * same road open on every part: a closed shape on a captured strip made it a
 * cube, a line under the title deleted the title, and a reader could turn
 * the contract address into a chart. A part on the page is the owner's page;
 * a drawing made on it is a new thing put there.
 *
 * So a drawing on an existing part lands as a NEW part at the drawing, and
 * the part keeps its size, its place, its kind and its words. It changes
 * the part itself only when:
 *
 *   · the part is a blank idea, dropped to be drawn on (nothing in it yet);
 *   · the door says so: "draw it again" on the timeline, redrawing a part a
 *     drawing made (`DrawJob.reshape`);
 *   · or the words typed WITH the drawing ask for this part to change:
 *     "make this a cube", "turn it into a chart", "reshape this".
 *
 * A part's own saved description is never read as that ask, and a straight
 * line never changes a part at all: it is a line put on top.
 *
 * Pure, and tested by `tests/draw-on-captured-part.mjs`.
 */
import type { StudioNode } from "./board/store";
import { plain } from "./shelf";

type Target = Pick<StudioNode, "featureId" | "content" | "code" | "from">;

/** A blank idea: dropped to be drawn on, with nothing in it yet and nothing captured. */
export function isBlankIdea(n: Target): boolean {
  return n.featureId === "custom-idea" && !plain(n.content).trim() && !n.code && !n.from?.selector?.trim();
}

/* The verb, then the thing it is done to: "make this", "turn it", "change the hero". */
const CHANGE_THIS = /\b(make|turn|change|convert|reshape|resize|transform|replace|redo|redraw)\s+(this|it|that|the\s+(part|box|section|hero|title|heading|button|ribbon|banner|strip|card|image|picture|line|text|block))\b/i;
/* The thing, then what it becomes: "this into a cube", "it as a chart". */
const THIS_INTO = /\b(this|it|that)\s+(into|as|to be)\s+/i;

/** Do the words typed with the drawing ask for the part it was drawn on to change? */
export function asksToChange(words: string | null | undefined): boolean {
  const w = (words ?? "").trim();
  return !!w && (CHANGE_THIS.test(w) || THIS_INTO.test(w));
}

/**
 * Does this drawing change the part it was made on (true), or land as a new
 * part over it (false)? `line` is whether the drawing is one straight line,
 * which never changes a part.
 */
export function changesThePart(n: Target, o: { words: string; reshape?: boolean; line?: boolean }): boolean {
  if (o.line) return false;
  return isBlankIdea(n) || !!o.reshape || asksToChange(o.words);
}
