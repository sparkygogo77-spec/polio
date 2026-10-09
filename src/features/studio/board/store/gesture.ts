"use client";
/*
 * A HAND ON A SLIDER OR A COLOUR PICKER: PREVIEW LIVE, SAVE ON RELEASE.
 *
 * The colour picker wrote the whole site on every move of the hand: each move
 * swapped the colour on every part that wore it, took an undo checkpoint,
 * saved the document and had the Colours panel count the site's surfaces
 * again. On the PonsStars board (about 800 parts) that is what made dragging
 * across the spectrum lag (J, 2026-10-09). Sliders in the side panel did the
 * same, a little less.
 *
 * While a hand is on one (`gestureFrame` from its first move to `endGesture`
 * on release):
 *   - the change is applied at most once a frame, the latest one winning;
 *   - saves are held and the side panels stand still (`hold.ts`, the same
 *     hold a part dragged on the board uses), so one save lands on release;
 *   - only the first undo checkpoint is taken (`create.ts#beginGesture`), so
 *     the whole drag is one undo step.
 * `gestureBase` is the site as the hand found it: a colour swap redone from it
 * each frame never swallows a colour it passed through on the way.
 *
 * Test: tests/colour-drag-smooth.mjs.
 */
import { useStudio } from "./create";
import { holdSaves } from "./hold";
import type { StudioState } from "./state";

let on = false;
let base: Pick<StudioState, "nodes" | "look"> | null = null;
let next: (() => void) | null = null;
let frame = 0;

const runFrame = () => { frame = 0; const fn = next; next = null; fn?.(); };

/** A hand is on a slider or picker. */
export function inGesture(): boolean { return on; }

/** The hand goes down: hold saves, freeze the panels, one undo step from here. */
export function startGesture(): void {
  if (on) return;
  on = true;
  const s = useStudio.getState();
  base = { nodes: s.nodes, look: s.look };
  s.beginGesture();
  holdSaves(true);
}

/** Apply `fn` on the next frame; a later call before then replaces it. */
export function gestureFrame(fn: () => void): void {
  startGesture();
  next = fn;
  if (!frame) frame = requestAnimationFrame(runFrame);
}

/** The hand comes up: the last change lands now, then one save, and the panels catch up. */
export function endGesture(): void {
  if (frame) cancelAnimationFrame(frame);
  runFrame();
  if (!on) return;
  on = false;
  base = null;
  useStudio.getState().endGesture();
  holdSaves(false);
}

/** The site's parts and look as they were when the hand went down. */
export function gestureBase(): Pick<StudioState, "nodes" | "look"> | null { return base; }
