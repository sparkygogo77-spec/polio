/**
 * TRY BEFORE YOU APPLY.
 *
 * Pointing at an effect, a kit or a style (on the shelf, in the part panel)
 * dresses the picked part in it on the board, at once; pointing away takes
 * it off; a click puts it on for good. What is tried is never written to the
 * site: the board draws the part through `tryOn`, which lays the tried
 * change over it, so nothing reaches the undo history, the saved document or
 * the export until the click.
 *
 * Anything that offers a look plugs in with `tryProps(make, apply)`: `make`
 * says what pointing would show (or null, for nothing to try), `apply` does
 * the click. An effect that moves (blink, spin, float) is played on the part
 * while it is tried, as the Motion tab plays one (`runWorks`, only).
 */
import { create } from "zustand";
import { useStudio, type StudioNode } from "./store";
import { runWorks } from "./live/runWorks";

export interface Trying {
  /** What each tried part would take: one part, or every part a paste or Make all would reach. */
  patches: Record<string, Partial<StudioNode>>;
  /** An effect played on one part while it is tried. */
  play?: { part: string; feature: string; inputs: Record<string, string> };
  /** What is being tried, in words, for the line under the board. */
  what?: string;
}

export const useTryLook = create<{ trying: Trying | null }>(() => ({ trying: null }));

let stop: (() => void) | null = null;

/** Dress the parts in what is tried, and play the effect, if any. */
export function startTry(t: Trying | null) {
  stop?.(); stop = null;
  useTryLook.setState({ trying: t && (Object.keys(t.patches).length || t.play) ? t : null });
  if (t?.play && typeof document !== "undefined") {
    const { part, feature, inputs } = t.play;
    /* After the board has drawn the part as tried. */
    const id = window.setTimeout(() => {
      stop = runWorks(document.body, [{ id: part, work: { id: feature, inputs } }], { board: true, only: { part, feature } });
    }, 30);
    stop = () => window.clearTimeout(id);
  }
}

export function endTry() { startTry(null); }

/** A part as the board draws it: with what is being tried laid over it. */
export function tryOn<T extends { id: string }>(n: T, trying: Trying | null): T {
  const p = trying?.patches[n.id];
  return p ? ({ ...n, ...p } as T) : n;
}

/** The one picked part, if exactly one is picked. */
export function pickedPart(): StudioNode | null {
  const st = useStudio.getState();
  return st.selection.length === 1 ? st.nodes.find((n) => n.id === st.selection[0]) ?? null : null;
}

/**
 * The props that make anything a try-on: point or focus to try, leave or
 * blur to take it off, click to apply (what is tried is taken off first, so
 * the click's own change is the one undo step).
 */
export function tryProps(make: () => Trying | null, apply?: () => void) {
  return {
    "data-try": "",
    onPointerEnter: () => startTry(make()),
    onPointerLeave: () => endTry(),
    onFocus: () => startTry(make()),
    onBlur: () => endTry(),
    ...(apply ? { onClick: () => { endTry(); apply(); } } : {}),
  };
}

/* Picking something else takes off whatever was being tried: a try never outlives the part it was shown on. */
if (typeof window !== "undefined") {
  let last = useStudio.getState().selection;
  useStudio.subscribe((s) => {
    if (s.selection === last) return;
    last = s.selection;
    if (useTryLook.getState().trying) endTry();
  });
}
