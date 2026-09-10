/**
 * Checking what Claude answered from the drawing board.
 *
 * The reshape route hands back one object — a kind, a name, a size, contents,
 * options, a prompt — and every field of it is a suggestion until it has been
 * held against the catalog, the page frame and the drawing itself. This is
 * that check, in one place: an id that is not in the library is dropped, an
 * option the part does not offer is dropped, a value it does not offer is
 * dropped, a size is clamped to the frame, and a size that ignores the one
 * thing every drawing says — its proportion — is brought back to it when
 * there are no words to say otherwise.
 *
 * Pure: no React, no store, no browser, no catalog import (the catalog
 * carries icons). The board passes a lookup; `tests/reshape-answer.mjs`
 * passes a small one of its own and holds this to its rules.
 */
import type { Sketch } from "./sketch";

/** What the reshape route answers with, before it is checked. */
export interface ReshapePatch {
  featureId?: string;
  label?: string;
  w?: number;
  h?: number;
  content?: string;
  prompt?: string;
  /** The route folds Claude's list of pairs into a record; either shape is taken in case. */
  options?: Record<string, string> | { id: string; value: string }[];
  note?: string;
}

export interface OptionAllowed {
  id: string;
  values: string[];
  kind?: "one" | "set";
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
  frameWidth: number;
  kind: (id: string) => KindInfo | null | undefined;
}

export interface Checked {
  featureId: string;
  label: string;
  w: number;
  h: number;
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
}

/** The kind everything falls back to: a part that is only a description. */
export const IDEA_ID = "custom-idea";

/** How far off the drawing's proportion an answer may be before it is corrected: a third either way. */
export const PROPORTION_HOLD = 1.35;

const MIN_W = 40;
const MIN_H = 24;
const MAX_H = 1600;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Claude's answer, held to the catalog, the frame and the drawing. */
export function checkAnswer({ patch, node, drawn, aspect, frameWidth, kind }: CheckInput): Checked {
  const words = drawn.words.trim();
  const isNew = !node;

  // The kind: an id from the library, or the one the part has, or an idea.
  const proposedKind = typeof patch.featureId === "string" && kind(patch.featureId) ? patch.featureId : null;
  const currentKind = node && kind(node.featureId) ? node.featureId : null;
  const featureId = proposedKind ?? currentKind ?? IDEA_ID;
  const info = kind(featureId) ?? null;
  const kindChanged = !!node && featureId !== node.featureId;
  const custom = featureId === IDEA_ID;

  // The size: what was answered, else what the part has, else the kind's own.
  let w = clamp(Math.round(num(patch.w, node?.w ?? info?.w ?? 132)), MIN_W, Math.max(MIN_W, frameWidth));
  let h = clamp(Math.round(num(patch.h, node?.h ?? info?.h ?? 76)), MIN_H, MAX_H);

  // The proportion: the one thing a drawing always says. An answer a third or
  // more off it, with no words that could have asked for that, is a reply
  // that did not read the drawing; give it the drawing's proportion at the
  // area it answered with, so the shape drawn is the shape made.
  let reproportioned = false;
  const answered = w / h;
  const off = Math.max(answered / aspect, aspect / answered);
  if (!words && Number.isFinite(off) && off > PROPORTION_HOLD) {
    const area = w * h;
    let nw = Math.sqrt(area * aspect);
    let nh = Math.sqrt(area / aspect);
    if (nw > frameWidth) {
      nw = frameWidth;
      nh = nw / aspect;
    }
    w = clamp(Math.round(nw), MIN_W, Math.max(MIN_W, frameWidth));
    h = clamp(Math.round(nh), MIN_H, MAX_H);
    reproportioned = true;
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

  return { featureId, label, w, h, content, prompt, options, custom, kindChanged, reproportioned };
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
    if (opt.kind === "set") {
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
