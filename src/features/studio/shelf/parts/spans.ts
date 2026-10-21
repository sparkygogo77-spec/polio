/**
 * A node's words, as a sequence of runs rather than a flat string.
 *
 * HIS PAGE, AND WHY THIS EXISTS. One line on his site reads a Solana mark,
 * then "$118.35", then a down arrow, then "-0.46%" — one sentence, several
 * colours, inline. On the board it arrived as four or five parts: "$" and
 * "116.59" stacked on one side, "-1.94" and "%" on the other, the arrow
 * adrift between them. His header reads "A Sol Works project" on one line,
 * where "Works" is a different face; the board split it into "A Sol",
 * "Works" and "project", and "A Sol" then wrapped inside a box too short to
 * hold it.
 *
 * His own diagnosis, and it is the right one: the words disconnect because
 * of the colour difference, and the boxes touching are what makes "A Sol"
 * short — "Works" being a different font makes it a different box and
 * shortens the one before it. The cause is that a node's text has only ever
 * been a flat string, so a run of differently coloured or differently faced
 * words inside a sentence cannot be held at all, and the only way to keep it
 * was to break the sentence apart. Growing those boxes sideways would stop
 * "A Sol" wrapping and would still leave four fragments pretending to be a
 * line: centring is a property of a line, and there is no line.
 *
 * So a node's words become a sequence of spans, and a sentence stays one
 * part.
 *
 * A PLAIN STRING STAYS VALID, PERMANENTLY. Every document ever saved holds
 * `content` as a string, twenty-odd parts read it, and `items` splits it.
 * This is a union plus one normaliser, so there is no migration and nothing
 * already on a board can be broken by it. A part that has not learned spans
 * calls `plain()` and behaves exactly as it did. That is not a transition
 * state to be tidied away later — it is the design.
 */
import type { NodeLink } from "./types";
import type { MotionAnimation } from "./capturedMotion";

/**
 * A stretch of a node's words that carries its own look.
 *
 * Everything but `text` is optional, and absent means "whatever the part
 * would have drawn anyway". A span never carries a size, a family or a
 * line-height: those belong to the node (`NodeFont`), because a sentence is
 * set in one face at one size and it is the ink inside it that varies.
 */
export interface Span {
  /** The words. Never empty — a span with no words is not emitted. */
  text: string;
  /**
   * A colour literal as a browser reports it (`rgb(…)` / `rgba(…)`), or the
   * name of one of the six palette roles. Resolved exactly as
   * `NodeEdge.colour` is: a role name follows the site, a literal does not.
   */
  colour?: string;
  /** 300..800, and only when it differs from the run around it. */
  weight?: number;
  italic?: boolean;
  /** The real name of the face this run is set in, when it differs. */
  face?: string;
  /** Where these words go. The same link every other part uses. */
  link?: NodeLink;
  /*
   * THE ONE EXCEPTION TO "A SPAN NEVER CARRIES A SIZE": a title a page split
   * into letters (sink folds trumpmorty.fun's "TRUMP & MORTY" back into one
   * part) keeps, per letter, what that letter wore apart from the rest: its
   * size (px, as measured) and text effects where they differ, and its own
   * transform and animation, which is what made the letters wobble on their
   * own. A capture writes these; and since words can be styled where they
   * are typed (`WordsInPlace.tsx`, the bar over highlighted words), a size
   * in px is the one of them a person sets too, like a word made bigger in
   * a document.
   */
  size?: number;
  textShadow?: string;
  textStroke?: { w: number; color: string };
  paintOrder?: string;
  /**
   * Words painted with an image clipped to their letters (a gradient set with
   * `background-clip: text`) over transparent ink: `image` is the computed
   * background-image as the browser reported it. Only a capture writes it;
   * the outline twin of it is `textStroke` (`tests/run-fill.mjs`).
   */
  fill?: { image: string; clip: "text" };
  /** The letter's transform when measured, as the browser computed it. */
  transform?: string;
  /** The letter's own animation (`parts/capturedMotion.ts`), replayed live. */
  motion?: { animation?: MotionAnimation[] } | null;
  /** A chip in the sentence (parasiteonsol.fun's dark "HOST" tag): its fill, padding (top right bottom left, px) and rounding. Only a capture writes these. */
  bg?: string;
  pad?: number[];
  radius?: number;
  /** Room the page left beside it in the line, left and right px. Only a capture writes it. */
  space?: number[];
  /** A link the page drew without an underline (a nav pill): drawn without one here too. Only a capture writes it. */
  bare?: boolean;
  /** The id and data-* attributes of the element these words sat in on a brought-in page (`pageParts.ts`): a value its code writes into. Written on the run's own element on the live page. */
  hooks?: Record<string, string>;
}

/** Are these a captured title's letters, each moving on its own (a transform or an animation per run)? */
export function hasLetters(w: Words | null | undefined): boolean {
  return Array.isArray(w) && w.some((s) => !!s && ((!!s.transform && s.transform !== "none") || !!s.motion?.animation?.length));
}

/** What a node's words are. A plain string is one unstyled span. */
export type Words = string | Span[];

/** Is this a span sequence rather than a plain string? */
export function isSpans(w: Words | null | undefined): w is Span[] {
  return Array.isArray(w);
}

/**
 * The words, as spans, whatever they were stored as.
 *
 * The ONE place that reads `content` raw. A string becomes a single span
 * carrying nothing, so a part written for spans needs no branch for the
 * string case and a document from before this existed needs no migration.
 */
export function spansOf(w: Words | null | undefined): Span[] {
  if (w == null) return [];
  if (typeof w === "string") return w ? [{ text: w }] : [];
  const out: Span[] = [];
  for (const s of w) {
    if (!s || typeof s.text !== "string" || !s.text) continue;
    out.push(s);
  }
  return out;
}

/**
 * The words as one string, exactly as they read.
 *
 * Joined with nothing between them, because a span carries its own spacing:
 * `plain(spansOf(x))` reconstructs the sentence character for character, and
 * anything that trims on the way in breaks that.
 */
export function plain(w: Words | null | undefined): string {
  if (w == null) return "";
  if (typeof w === "string") return w;
  return spansOf(w).map((s) => s.text).join("");
}

/**
 * A typed change, landed in the runs rather than over them.
 *
 * The word editors show a part's words as one plain string, and wrote that
 * string back over the runs: every stretch then took the part's own ink. His
 * wordmark reads "A Sol" green, "Works" white, " project" green; one space
 * typed in the Contents panel and "Works" came back green. So the edit is
 * found by what did not change, the same start and the same end, and only
 * the middle is replaced: the characters before and after keep the run they
 * were in, and what is typed takes the ink of the run it is typed into (the
 * one before the caret, or the first when typing at the very start). Words
 * that were a plain string stay a plain string.
 */
export function reword(was: Words | null | undefined, next: string): Words {
  if (!Array.isArray(was) || !was.length) return next;
  const old = plain(was);
  if (old === next) return was;
  const owner: number[] = [];
  was.forEach((s, i) => { for (let k = 0; k < s.text.length; k++) owner.push(i); });
  let head = 0;
  while (head < old.length && head < next.length && old[head] === next[head]) head++;
  let tail = 0;
  while (tail < old.length - head && tail < next.length - head && old[old.length - 1 - tail] === next[next.length - 1 - tail]) tail++;
  const typedInto = head > 0 ? owner[head - 1]! : owner[0] ?? 0;
  const runOf: number[] = [
    ...owner.slice(0, head),
    ...Array.from({ length: next.length - head - tail }, () => typedInto),
    ...owner.slice(old.length - tail),
  ];
  const out: Span[] = [];
  for (let k = 0; k < next.length; k++) {
    const last = out[out.length - 1];
    if (last && runOf[k - 1] === runOf[k]) last.text += next[k];
    else out.push({ ...was[runOf[k]!]!, text: next[k]! });
  }
  return out.length ? out : "";
}

/** Do these two runs read the same to a reader, so they are one run? */
export function alike(a: Span, b: Span): boolean {
  return a.colour === b.colour
    && a.weight === b.weight
    && !!a.italic === !!b.italic
    && a.face === b.face
    && a.size === b.size
    && a.bg === b.bg
    && linkAlike(a.link, b.link)
    /* A value a brought-in page's code writes into is its own run, however it looks: folded into its neighbour, its hook would name the whole sentence. */
    && JSON.stringify(a.hooks ?? null) === JSON.stringify(b.hooks ?? null);
}

function linkAlike(a: NodeLink | undefined, b: NodeLink | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && a.target === b.target;
}

/**
 * Runs that say nothing of their own, folded into the run beside them.
 *
 * A rule of the contract, and it is not tidiness. A capture that emits one
 * span per text node turns "for the builders, believers, and bold thinkers"
 * into eleven spans that are all the same ink, and every one of them is a
 * chance for a renderer to break the line somewhere a browser would not.
 * A sentence with one green word in it is two or three spans, never eleven.
 */
export function merged(spans: readonly Span[]): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    if (!s.text) continue;
    const last = out[out.length - 1];
    if (last && alike(last, s)) out[out.length - 1] = { ...last, text: last.text + s.text };
    else out.push({ ...s });
  }
  return out;
}

/**
 * The words cut into lines, each line still a sequence of runs.
 *
 * THE OTHER RULE OF THE CONTRACT: a span must never straddle a newline.
 * `items` splits a node's content on newlines (and on commas when there are
 * no newlines), and a span boundary is not a line boundary — a span that
 * crosses one would put half of a differently coloured word on each of two
 * lines, or, worse, make a part that splits its own content lose the ink on
 * everything after the first line. So the cut happens here, inside the run,
 * and every line comes out as its own list of runs.
 *
 * Splitting on lines only. Commas are a part's own business: prose splits on
 * lines, a details table on lines and then on commas, and a paragraph that
 * happens to contain commas is one paragraph. A part that wants the comma
 * rule applies it to `plain()` of each line.
 */
export function lines(w: Words | null | undefined): Span[][] {
  const out: Span[][] = [];
  let line: Span[] = [];
  for (const s of spansOf(w)) {
    const pieces = s.text.split("\n");
    pieces.forEach((piece, i) => {
      if (i > 0) { out.push(merged(line)); line = []; }
      if (piece) line.push({ ...s, text: piece });
    });
  }
  out.push(merged(line));
  return out.filter((l, i) => l.length > 0 || i === 0);
}

/**
 * The look a person can give a stretch of words: what the bar over
 * highlighted words sets (`WordsInPlace.tsx`). `null` takes that one back,
 * so the words follow the part again; absent leaves it as it is.
 */
export interface RunLook {
  face?: string | null;
  /** In px. */
  size?: number | null;
  colour?: string | null;
  weight?: number | null;
  italic?: boolean | null;
}
const LOOK_KEYS = ["face", "size", "colour", "weight", "italic"] as const;

/**
 * The words between two offsets of the plain text restyled, the rest kept.
 *
 * LIKE A DOCUMENT, NOT LIKE BOXES. J's ask (2026-10-11): highlight the words
 * inside a sentence and change just those into another font, the way any
 * document editor does, instead of one text box per face laid beside the
 * next and overlapping it. So a run is cut where the highlight starts and
 * ends, the cut-out stretch takes the look, and the runs either side keep
 * theirs: a plain string becomes runs the first time a word in it is
 * styled. Runs that come out alike are folded back into one, so styling and
 * then unstyling a word leaves the sentence exactly as it was.
 */
export function restyle(was: Words | null | undefined, from: number, to: number, look: RunLook): Words {
  const spans = spansOf(was);
  const text = plain(spans);
  const a = Math.max(0, Math.min(from, to)), b = Math.min(text.length, Math.max(from, to));
  if (b <= a || !spans.length) return was ?? "";
  const out: Span[] = [];
  let at = 0;
  for (const s of spans) {
    const start = at, end = at + s.text.length;
    at = end;
    const cut = (x: number, y: number, styled: boolean) => {
      if (y <= x) return;
      const piece: Span = { ...s, text: s.text.slice(x - start, y - start) };
      if (styled) {
        for (const k of LOOK_KEYS) {
          const v = look[k];
          if (v === undefined) continue;
          const bag = piece as unknown as Record<string, unknown>;
          if (v === null || v === false || v === "") delete bag[k];
          else bag[k] = v;
        }
      }
      out.push(piece);
    };
    cut(start, Math.min(end, a), false);
    cut(Math.max(start, a), Math.min(end, b), true);
    cut(Math.max(start, b), end, false);
  }
  const folded = merged(out);
  /* Nothing left that says anything: a plain string again, as it was before any word was styled. */
  return folded.length === 1 && Object.keys(folded[0]!).length === 1 ? folded[0]!.text : folded;
}

/**
 * What the words between two offsets have in common, so the bar can show
 * it: a value every run in the stretch shares, else undefined. An empty
 * stretch reads the run the caret is in.
 */
export function lookIn(was: Words | null | undefined, from: number, to: number): RunLook {
  const spans = spansOf(was);
  const a = Math.min(from, to), b = Math.max(from, to);
  const hit: Span[] = [];
  let at = 0;
  for (const s of spans) {
    const start = at, end = at + s.text.length;
    at = end;
    if (b === a ? (a > start && a <= end) || (a === 0 && start === 0) : start < b && end > a) hit.push(s);
  }
  const out: RunLook = {};
  if (!hit.length) return out;
  for (const k of LOOK_KEYS) {
    const first = hit[0]![k];
    if (hit.every((s) => s[k] === first)) (out as Record<string, unknown>)[k] = first ?? null;
  }
  return out;
}
