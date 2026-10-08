"use client";
/*
 * THE STORE AS THE SIDE PANELS SEE IT: STILL WHILE A PART IS UNDER THE HAND.
 *
 * A drag writes the parts to the store on every move, and every panel that
 * reads the parts drew itself again each time: the Element panel (its trail,
 * colours, link, effects, "make all like this"), the page bar, the preview.
 * Measured on a 300-part page, that cost as much as moving the part itself
 * (J, 2026-10-06: "dragging elements around is still laggy").
 *
 * `useHeldStudio` is `useStudio` for those panels. While the board holds a
 * part (`hold.ts#holdSaves`) it hands back the store as it was when the hand
 * went down and tells nobody about the moves; when the hand comes up, every
 * panel reads the store once, as it is. The board itself keeps `useStudio`:
 * it has to follow the hand.
 */
import { useStore, type StoreApi } from "zustand";
import type { StudioState } from "./state";
import { useStudio } from "./create";
import { isHeld, onHold } from "./hold";

let kept: StudioState | null = null;
onHold(() => { kept = isHeld() ? useStudio.getState() : null; });

const held: StoreApi<StudioState> = {
  getState: () => kept ?? useStudio.getState(),
  getInitialState: () => useStudio.getInitialState(),
  setState: useStudio.setState,
  subscribe: (fn) => {
    const moves = useStudio.subscribe((s, was) => { if (!kept) fn(s, was); });
    const hand = onHold(() => { if (!kept) { const s = useStudio.getState(); fn(s, s); } });
    return () => { moves(); hand(); };
  },
};

/** `useStudio(selector)`, held still while a part is under the hand. */
export function useHeldStudio<T>(selector: (s: StudioState) => T): T {
  return useStore(held, selector);
}
