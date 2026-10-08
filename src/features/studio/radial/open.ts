import * as React from "react";
import { useStudio } from "../board/store";
import { BOARD_R, GREEN_RINGS } from "../menuGeometry";
import { TRAY_DROP, SlotId } from "./choices";

/**
 * `seq` counts openings, not moves. Right-clicking somewhere else — a
 * different part, or a different corner of the same one — is a new opening and
 * puts the menu back to its first level; carrying it across the screen is not.
 */
export type Open = {
  /** The part the menu is about, or null when only the drawing board is up. */
  nodeId: string | null;
  x: number;
  y: number;
  seq: number;
  /**
   * Where the hand pressed, unclamped. The menu itself is kept on screen,
   * so near an edge it sits some way from the hand; the pull that starts
   * from that same hold is measured from here, not from the menu.
   */
  hand: { x: number; y: number };
  /** Where a part drawn on a nodeless board lands, in canvas space. */
  at: { x: number; y: number } | null;
  /**
   * Open straight onto one slot rather than on the wheel.
   *
   * For "change this" from the timeline: the wheel is a way to choose what
   * to do, and that choice has already been made.
   */
  slot?: SlotId | null;
} | null;
export let current: Open = null;
export let opened = 0;
/** When the menu was last opened, so the context-menu event that trails the opening press can be told from a new one. */
export let openedAt = 0;
export const listeners = new Set<(v: Open) => void>();

/** A point on the page frame in canvas space — where the page's Add lands a part. (The console's `spotOn` is a place on a slab; this is a place on the page.) */
export function pageSpot(frame: Element, clientX: number, clientY: number): { x: number; y: number } {
  const r = frame.getBoundingClientRect();
  const zoom = useStudio.getState().zoom || 1;
  return { x: (clientX - r.left) / zoom, y: (clientY - r.top) / zoom };
}

/**
 * Kept clear of the edges, so a menu opened by one has no pieces off screen.
 *
 * Clamped *here*, once, so that where the menu is drawn and where the pull is
 * measured from are the same point. They were not: the drawing clamped and the
 * gesture did not, and a menu opened near the top of the board pulled its line
 * from a point some way above its own middle.
 */
export function keepOnScreen(x: number, y: number): [number, number] {
  if (typeof window === "undefined") return [x, y];
  // The drawing board is the widest thing the menu can become; its rim
  // button reaches a few pixels past its edge. Below, the tray hangs under
  // the wheel or the board, so the bottom needs more room than the rest —
  // and only the bottom: pushing the menu further from every edge for a
  // thing on one edge moved a menu opened near the top away from the hand
  // that opened it, and the pull that starts from that hold lost its line.
  //
  // The square is the trap. A round menu reaches `reach` in every direction,
  // so a clamp of `reach` holds it. A square of the same half-width reaches
  // `reach` on its flats and `reach × √2` into its corners — forty per cent
  // further — and `menuSpin` can turn any corner at any edge. Sizing the
  // clamp for the circle is why a square menu opened near a side hung off it.
  // The board is round, so it only ever needs its own radius.
  const square = useStudio.getState().menuShape === "square";
  const spread = square ? GREEN_RINGS.reach * Math.SQRT2 : GREEN_RINGS.reach;
  // Touching the edge is fine; going past it is not. The pad is the rim
  // button and the edge stroke, nothing more.
  const margin = Math.max(spread + 8, BOARD_R + 16);
  const below = Math.max(margin, BOARD_R + TRAY_DROP + 28);
  return [
    Math.max(margin, Math.min(window.innerWidth - margin, x)),
    Math.max(margin, Math.min(window.innerHeight - below, y)),
  ];
}

/** Open the wheel about a part or the page. `at` is the same spot in canvas space, where the page's Add lands a part. */
export function openRadial(nodeId: string, x: number, y: number, at: { x: number; y: number } | null = null, slot: SlotId | null = null) {
  const [px, py] = keepOnScreen(x, y);
  current = { nodeId, x: px, y: py, seq: ++opened, hand: { x, y }, at, slot };
  openedAt = performance.now();
  listeners.forEach((l) => l(current));
}

/**
 * Go straight to drawing on a part that already exists.
 *
 * From the timeline: "change this" has to change *that* part, so the board
 * opens on the part the iteration made rather than on empty space — which is
 * what made going back to change something produce a second something.
 */
export function drawOnPart(nodeId: string, x: number, y: number) {
  openRadial(nodeId, x, y, null, "draw");
}

/** …and straight to writing on it, which is the other half of "change this". */
export function writeOnPart(nodeId: string, x: number, y: number) {
  openRadial(nodeId, x, y, null, "write");
}
/**
 * The drawing board on its own, for a part that does not exist yet.
 *
 * Opened from the board's own right-click menu: no wheel, no part, just the
 * disc at the pointer. `at` is the same spot in canvas space, which is where
 * the part drawn on it lands.
 */
export function openBoard(x: number, y: number, at: { x: number; y: number }) {
  const [px, py] = keepOnScreen(x, y);
  current = { nodeId: null, x: px, y: py, seq: ++opened, hand: { x, y }, at };
  openedAt = performance.now();
  listeners.forEach((l) => l(current));
}
/** Where the wheel is, for anything that has to draw around it. Null when it is shut. */
export function radialAt(): { x: number; y: number } | null {
  return current ? { x: current.x, y: current.y } : null;
}
export function closeRadial() {
  current = null;
  listeners.forEach((l) => l(null));
}
/** Park the menu somewhere else without closing it or losing the part. */
export function moveRadial(x: number, y: number) {
  if (!current) return;
  const [px, py] = keepOnScreen(x, y);
  current = { ...current, x: px, y: py };
  listeners.forEach((l) => l(current));
}
export function useRadial(): Open {
  const [v, setV] = React.useState<Open>(current);
  React.useEffect(() => {
    listeners.add(setV);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}

/* ------------------------------------------------------------------ */
/* The ring                                                            */
/* ------------------------------------------------------------------ */
