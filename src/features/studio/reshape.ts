/**
 * Checking what Claude answered from the drawing board.
 *
 * The reshape route hands back one object — a kind, a name, a size, contents,
 * options, a prompt — and every field of it is a suggestion until it has been
 * held against the catalog, the page frame and the drawing itself. This is
 * that check, in one place: an id that is not in the library is dropped, an
 * option the part does not offer is dropped, a value it does not offer is
 * dropped, a size is clamped to the frame, a size that ignores the one
 * thing every drawing says — its proportion — is brought back to it when
 * there are no words to say otherwise, and the shape the outline was drawn
 * as is the shape the part is cut to.
 *
 * Pure: no React, no store, no browser, no catalog import (the catalog
 * carries icons). The board passes a lookup; `tests/reshape-answer.mjs`
 * passes a small one of its own and holds this to its rules.
 */
import type { Sketch } from "./sketch";

/** What a part is cut to. The same four the store keeps. */
export type Shape = "circle" | "ellipse" | "rounded" | "box";
const SHAPES: Shape[] = ["circle", "ellipse", "rounded", "box"];

/** What the reshape route answers with, before it is checked. */
export interface ReshapePatch {
  featureId?: string;
  label?: string;
  w?: number;
  h?: number;
  shape?: string;
  content?: string;
  prompt?: string;
  /** The route folds Claude's list of pairs into a record; either shape is taken in case. */
  options?: Record<string, string> | { id: string; value: string }[];
  note?: string;
}

export interface OptionAllowed {
  id: string;
  values: string[];
  kind?: "one" | "set" | "range";
  /** For a range: the ends the answer is held to. */
  range?: { min: number; max: number };
}

/** What the check needs to know about a kind of part: the catalog entry, without the icon. */
export interface KindInfo {
  id: string;
  name: string;
  w: number;
  h: number;
  options?: OptionAllowed[];
}

/** The part as it is, or null when the board is drawing a new one. */
export interface CurrentPart {
  featureId: string;
  label: string;
  prompt: string;
  w: number;
  h: number;
  options: Record<string, string>;
}

export interface CheckInput {
  patch: ReshapePatch;
  node: CurrentPart | null;
  drawn: Sketch;
  /** Width over height of the drawing, as `readSketch` measures it. */
  aspect: number;
  /**
   * What the outline was measured as (`readBoundary`). The drawing settles
   * the shape: the reader may name one, but a circle that was drawn is a
   * circle whatever comes back, and with no key at all the shape still
   * reaches the part.
   */
  outline?: string;
  frameWidth: number;
  kind: (id: string) => KindInfo | null | undefined;
  /**
   * How big the drawing was on the board, when the board knows.
   *
   * A drawing says its shape and, once its strokes are fractions of their
   * own box, nothing at all about its size — so a stroke eighty pixels wide
   * came out across the whole frame. When the size is known it is the
   * answer, and a reader's numbers do not overrule it.
   */
  drawnSize?: { w: number; h: number } | null;
}

export interface Checked {
  featureId: string;
  label: string;
  w: number;
  h: number;
  /** What the part is cut to, or null to leave it a box. */
  shape: Shape | null;
  /** Null means leave what the part has. */
  content: string | null;
  prompt: string | null;
  options: Record<string, string>;
  /** True for a part that is a custom idea, the way `addNode` sets it. */
  custom: boolean;
  /** The part became a different kind. */
  kindChanged: boolean;
  /** The size answered ignored the drawing's proportion and was brought back to it. */
  reproportioned: boolean;
  /** The part was put back to the size it was drawn at. */
  keptSize: boolean;
}

/** The kind everything falls back to: a part that is only a description. */
export const IDEA_ID = "custom-idea";

/** How far off the drawing's proportion an answer may be before it is corrected: a third either way. */
export const PROPORTION_HOLD = 1.35;

/**
 * What counts as genuinely full width.
 *
 * Nine tenths of the frame: a person who drew across the page meant across
 * the page, and a kind whose own library width is that wide — a corner glow,
 * a hero — is full bleed whatever size it was sketched at.
 */
export const FULL_BLEED = 0.9;

const MIN_W = 40;
const MIN_H = 24;
const MAX_H = 1600;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Claude's answer, held to the catalog, the frame and the drawing. */
export function checkAnswer({ patch, node, drawn, aspect, outline, frameWidth, kind, drawnSize }: CheckInput): Checked {
  const words = drawn.words.trim();
  const isNew = !node;

  // The kind: an id from the library, or the one the part has, or an idea.
  const proposedKind = typeof patch.featureId === "string" && kind(patch.featureId) ? patch.featureId : null;
  const currentKind = node && kind(node.featureId) ? node.featureId : null;
  const featureId = proposedKind ?? currentKind ?? IDEA_ID;
  const info = kind(featureId) ?? null;
  const kindChanged = !!node && featureId !== node.featureId;
  const custom = featureId === IDEA_ID;

  /*
   * The shape: what the outline was, unless the reader named another one.
   *
   * The measurement is the stronger of the two, because it is the drawing:
   * a circle drawn round a part came back as a 380×351 box while the
   * boundary rule was fitting the box round the outline and dropping the
   * outline itself. A reader that says nothing gets the drawn shape; a
   * reader that says something is taken at its word, since the words beside
   * a drawing win over the drawing.
   */
  const drawnShape: Shape | null = outline === "circle" ? "circle" : outline === "ellipse" ? "ellipse" : outline === "rounded box" ? "rounded" : outline === "box" ? "box" : null;
  const asked = typeof patch.shape === "string" ? patch.shape.trim().toLowerCase() : "";
  const said = SHAPES.find((x) => x === asked) ?? null;
  const shape = said ?? drawnShape;

  // The size: what was answered, else what the part has, else the kind's own.
  let w = clamp(Math.round(num(patch.w, node?.w ?? info?.w ?? 132)), MIN_W, Math.max(MIN_W, frameWidth));
  let h = clamp(Math.round(num(patch.h, node?.h ?? info?.h ?? 76)), MIN_H, MAX_H);

  /*
   * The proportion: the one thing a drawing always says.
   *
   * Except that it did not, from the board. `aspect` is measured off the
   * strokes, and strokes that arrive as fractions of their own box are
   * always about as wide as they are tall — so a diagonal drawn wide and
   * shallow was measured as square and every ink part came out square, 760
   * by 760. When the board measured the drawing itself, that box is the
   * proportion and the strokes are not asked.
   */
  const drewSized = !!drawnSize && drawnSize.w > 0 && drawnSize.h > 0;
  const trueAspect = drewSized ? drawnSize!.w / drawnSize!.h : aspect;

  // An answer a third or more off it, with no words that could have asked
  // for that, is a reply that did not read the drawing; give it the
  // drawing's proportion at the area it answered with, so the shape drawn is
  // the shape made.
  let reproportioned = false;
  const answered = w / h;
  const off = Math.max(answered / trueAspect, trueAspect / answered);
  if (shape !== "circle" && !words && Number.isFinite(off) && off > PROPORTION_HOLD) {
    const area = w * h;
    let nw = Math.sqrt(area * trueAspect);
    let nh = Math.sqrt(area / trueAspect);
    if (nw > frameWidth) {
      nw = frameWidth;
      nh = nw / trueAspect;
    }
    w = clamp(Math.round(nw), MIN_W, Math.max(MIN_W, frameWidth));
    h = clamp(Math.round(nh), MIN_H, MAX_H);
    reproportioned = true;
  }

  // A circle is as tall as it is wide. Answering 380×351 for one is the
  // shape being dropped a second time, in the numbers.
  if (shape === "circle") {
    const side = clamp(Math.round(Math.sqrt(Math.max(MIN_W * MIN_H, w * h))), MIN_W, Math.max(MIN_W, Math.min(frameWidth, MAX_H)));
    if (Math.abs(w - h) > 1) reproportioned = true;
    w = side;
    h = side;
  }

  /*
   * The size it was drawn at wins.
   *
   * A stroke drawn eighty pixels wide came back as a band across the whole
   * page: the strokes are fractions of their own box by the time they get
   * here, so nothing downstream knew how big the drawing had been, and the
   * reader's own numbers — which are a guess about a part it has never seen
   * on a page — filled the frame instead.
   *
   * Two things are genuinely full width and keep the answer: a drawing a
   * person actually drew across the page, and a kind that is full bleed by
   * nature, a corner glow or a hero, which the library says by its own
   * width. Everything else lands where it was drawn, at the size it was.
   */
  let keptSize = false;
  if (drewSized) {
    const drewWide = drawnSize!.w >= frameWidth * FULL_BLEED;
    const kindIsWide = (info?.w ?? 0) >= frameWidth * FULL_BLEED;
    if (!drewWide && !kindIsWide) {
      const nw = clamp(Math.round(drawnSize!.w), MIN_W, Math.max(MIN_W, frameWidth));
      const nh = shape === "circle" ? nw : clamp(Math.round(drawnSize!.h), MIN_H, MAX_H);
      keptSize = nw !== w || nh !== h;
      w = nw;
      h = nh;
    }
  }

  // The name: what was answered; else what the part is called; for a new
  // idea, the words; else the kind's name.
  const label = text(patch.label, 60) || node?.label || (isNew && custom ? text(words, 40) : "") || info?.name || "Part";

  // Contents and prompt are only written when there is something to write. A
  // new part with no prompt from the reader still gets the author's words,
  // so they are not lost between the board and the blueprint.
  const content = text(patch.content, 2000) || null;
  const prompt = text(patch.prompt, 2000) || (isNew ? text(words, 2000) : "") || null;

  const options = allowedOptions(patch.options, info?.options ?? [], kindChanged ? {} : node?.options ?? {});

  return { featureId, label, w, h, shape, content, prompt, options, custom, kindChanged, reproportioned, keptSize };
}

/** Only options the part actually has, with values it actually offers, over the ones already set. */
export function allowedOptions(proposed: unknown, allowed: OptionAllowed[], current: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) if (allowed.some((o) => o.id === k)) next[k] = v;
  if (!proposed || typeof proposed !== "object") return next;
  const entries: [string, unknown][] = Array.isArray(proposed)
    ? proposed.flatMap((p) => (p && typeof p === "object" && typeof (p as { id?: unknown }).id === "string" ? [[(p as { id: string }).id, (p as { value?: unknown }).value] as [string, unknown]] : []))
    : Object.entries(proposed as Record<string, unknown>);
  for (const [k, v] of entries) {
    const opt = allowed.find((o) => o.id === k);
    if (!opt || typeof v !== "string") continue;
    if (opt.kind === "range") {
      // A range is a number, not a name: anything that parses is allowed,
      // clamped to the slider's own ends, and anything else is dropped.
      const n = Number.parseFloat(v);
      if (!Number.isFinite(n)) continue;
      const r = opt.range ?? { min: -Infinity, max: Infinity };
      next[k] = String(Math.round(Math.max(r.min, Math.min(r.max, n)) * 100) / 100);
    } else if (opt.kind === "set") {
      const picked = v.split(",").map((x) => x.trim()).filter((x) => opt.values.includes(x));
      if (picked.length) next[k] = picked.join(", ");
    } else {
      const value = v.trim();
      const match = opt.values.find((x) => x === value) ?? opt.values.find((x) => x.toLowerCase() === value.toLowerCase());
      if (match) next[k] = match;
    }
  }
  return next;
}
