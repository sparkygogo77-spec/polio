"use client";
/*
 * WHILE A PART IS UNDER THE HAND.
 *
 * A drag or a resize changes the document on every move. The board itself has
 * to follow, but nothing else does: the save (`create.ts#keptOnly`) and the
 * work done from the whole document elsewhere — the style layer behind the
 * code buttons, the compiled brief, a part's motions — can wait for the drop.
 * On a 700-part import those ran on every move and held frames up to a second
 * (`tests/drag-saves-once.mjs`). The board says when a hand is on a part
 * (`holdSaves`); `useSteady` keeps the value it had when the hand went down
 * and takes the new one when it comes up.
 */
import * as React from "react";

let held = false;
const listeners = new Set<() => void>();
const onRelease = new Set<() => void>();

export function isHeld(): boolean { return held; }
/** Run once when the hand comes up (or now, if no hand is down). */
export function afterRelease(fn: () => void): void { if (held) onRelease.add(fn); else fn(); }

/** The board's hand on a part (`canvas/DesktopCanvas.tsx`): true while a drag or resize is under way. */
export function holdSaves(on: boolean): void {
  if (held === on) return;
  held = on;
  if (!on) { const fns = [...onRelease]; onRelease.clear(); for (const fn of fns) fn(); }
  for (const fn of listeners) fn();
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const snapshot = () => held;
const serverSnapshot = () => false;

/** `value`, held still while a part is under the hand. */
export function useSteady<T>(value: T): T {
  const holding = React.useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const kept = React.useRef(value);
  if (!holding) kept.current = value;
  return kept.current;
}
