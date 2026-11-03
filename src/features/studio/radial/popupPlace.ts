/**
 * A WHEEL POP-UP'S FRAME AND PLACE, IN ONE SMALL MODULE.
 *
 * Everything about where a pop-up stands and what its frame looks like is
 * here, so a change to either (J's placement drawing, a ring-shaped frame for
 * the round wheel) touches this file and not the controls in `WheelPopup.tsx`.
 * Placement is pure, so the checks can hold it without a page.
 *
 * Where (J, 2026-11-03): "the panes to the left of the right click menu need
 * to stay at least on the same y axis as the original green menu". A pop-up
 * goes to the side of the wheel its slab leans to (left when it points
 * straight up or down), clear of the wheel, with its top level with the top
 * of the green menu it came from (`levelTop`), wherever the wheel is turned. With no room on that side it flips to the other; only then is
 * it pushed back inside the window. Its smaller pop-up stands further out on
 * the same side, top level with it, then under it, then wherever there is room.
 *
 * Look: J's pick A, the tag: rounded, a lit border in the colour of what
 * opened it, scanlines over void purple, a mono title.
 */
import type * as React from "react";
import { VOID } from "@/core/ui/void";
import { TURN } from "../menuGeometry";

export interface Box { x: number; y: number; w: number; h: number }
export interface Placed { x: number; y: number; flipX: boolean; flipY: boolean }
/** The wheel as a pop-up sees it: its middle, how far it runs out on each side, and the top of the menu the pop-up came from. */
export interface WheelBox { cx: number; cy: number; reach: number; top: number }

const MARGIN = 8;
const GAP = 10;

const inside = (v: number, size: number, win: number) => Math.max(MARGIN, Math.min(win - size - MARGIN, v));

/** The pop-up's corner, for a slab at `angle` (radians, screen y down). */
export function placePopup(wheel: WheelBox, angle: number, w: number, h: number, winW: number, winH: number): Placed {
  const { cx, reach, top } = wheel;
  const c = Math.cos(angle);
  const left = c <= 0.05;
  const x = (toLeft: boolean) => (toLeft ? cx - reach - GAP - w : cx + reach + GAP);
  const fits = (v: number) => v >= MARGIN && v + w <= winW - MARGIN;
  const flipX = !fits(x(left)) && fits(x(!left));
  return { x: inside(x(flipX ? !left : left), w, winW), y: inside(top, h, winH), flipX, flipY: false };
}

/**
 * The top of a menu cut from `from` to `to` turns (the wheel's own turns, `TURN`:
 * 0 pointing up, clockwise) between radii `hole` and `reach`, turned by `spin`
 * turns: what a pop-up beside it is held level with.
 */
export function levelTop(cy: number, from: number, to: number, hole: number, reach: number, square: boolean, spin: number): number {
  let top = Infinity;
  for (let i = 0; i <= 24; i++) {
    const t = from + ((to - from) * i) / 24;
    const flat = square ? reach / Math.max(Math.abs(Math.cos(TURN(t))), Math.abs(Math.sin(TURN(t)))) : reach;
    const a = TURN(t + spin);
    top = Math.min(top, cy + Math.sin(a) * flat, cy + Math.sin(a) * hole);
  }
  return top;
}

/** The smaller pop-up beside `parent`: further out on the same side, then under it, then the rest. */
export function placeBeside(parent: Box, wheel: WheelBox, w: number, h: number, winW: number, winH: number): Placed & { side: number } {
  const out = parent.x + parent.w / 2 < wheel.cx ? -1 : 1;
  const sides = [
    { x: out < 0 ? parent.x - w - GAP : parent.x + parent.w + GAP, y: parent.y },
    { x: parent.x, y: parent.y + parent.h + GAP },
    { x: parent.x, y: parent.y - h - GAP },
    { x: out < 0 ? parent.x + parent.w + GAP : parent.x - w - GAP, y: parent.y },
  ];
  const fits = (p: { x: number; y: number }) => p.x >= MARGIN && p.y >= MARGIN && p.x + w <= winW - MARGIN && p.y + h <= winH - MARGIN;
  const side = Math.max(0, sides.findIndex(fits));
  const p = sides[side]!;
  return { x: inside(p.x, w, winW), y: inside(p.y, h, winH), flipX: side === 3, flipY: side === 2, side };
}

/* ------------------------------------------------------------------ */
/* The frame                                                           */
/* ------------------------------------------------------------------ */

/** The green of the level that opened it, and the blue of the smaller one it opens. */
export const RIM = { main: "oklch(0.72 0.19 148)", small: "oklch(0.72 0.17 205)" } as const;
export const TITLE = { main: "oklch(0.88 0.2 148)", small: "oklch(0.85 0.14 205)" } as const;
const FACE = `repeating-linear-gradient(0deg, oklch(0 0 0 / 0.2) 0 1px, transparent 1px 3px), linear-gradient(160deg, oklch(0.25 0.09 300), oklch(0.16 0.05 288))`;

/** The tag: what a pop-up's outer box wears. */
export function frameStyle(which: keyof typeof RIM, w: number): React.CSSProperties {
  const rim = RIM[which];
  return {
    width: w, padding: which === "main" ? 12 : 10, borderRadius: 16, border: `1.5px solid ${rim}`, background: FACE, color: VOID.text,
    boxShadow: `0 0 14px color-mix(in oklch, ${rim} 35%, transparent), 0 14px 34px oklch(0 0 0 / 0.55)`,
  };
}
