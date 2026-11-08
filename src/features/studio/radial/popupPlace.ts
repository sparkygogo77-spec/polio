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
 * opened it, scanlines over void purple, a mono title. On the round wheel it
 * is design C, the ring (J, 2026-11-08, "build the ring too"): the same
 * controls on a void slab cut to the wheel's own curve, out past the wheel at
 * the slab's angle, its smaller pop-up further round the same ring. Which one
 * a wheel gets is `popupShape`, and nothing else decides it.
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

/** The two looks a pop-up can wear. */
export type PopupShape = "tag" | "ring";
/** The one place that decides it: the square menu wears the tag, the round wheel the ring. */
export const popupShape = (menu: "square" | "round"): PopupShape => (menu === "round" ? "ring" : "tag");

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
/* The ring (design C)                                                 */
/* ------------------------------------------------------------------ */

/** A slab of the outer ring, in window pixels and radians (screen y down). */
export interface Arc { cx: number; cy: number; rIn: number; rOut: number; a0: number; a1: number }
export type RingPlaced = Placed & { arc: Arc };

/** How far the ring's slab runs round the controls, and how far out past the wheel it starts. */
const RING_PAD = 12;
const RING_GAP = 12;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The controls' box set out at `angle`, as close in as the ring allows, and the slab of ring cut round it. */
export function ringAt(cx: number, cy: number, rIn: number, angle: number, w: number, h: number): RingPlaced {
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const near = (x: number, y: number) => Math.hypot(Math.max(x - cx, 0, cx - x - w), Math.max(y - cy, 0, cy - y - h));
  let d = rIn;
  let x = 0, y = 0;
  for (let i = 0; i < 400; i++, d += 2) {
    x = cx + ux * d - w / 2;
    y = cy + uy * d - h / 2;
    if (near(x, y) >= rIn + RING_PAD) break;
  }
  const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]] as const;
  const far = Math.max(...corners.map(([px, py]) => Math.hypot(px - cx, py - cy)));
  const turns = corners.map(([px, py]) => wrap(Math.atan2(py - cy, px - cx) - angle));
  const pad = RING_PAD / rIn;
  return {
    x, y, flipX: false, flipY: false,
    arc: { cx, cy, rIn, rOut: far + RING_PAD, a0: angle + Math.min(...turns) - pad, a1: angle + Math.max(...turns) + pad },
  };
}

/** The window box a slab of ring covers. */
export function arcBox(a: Arc): Box {
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = a.a0 + ((a.a1 - a.a0) * i) / 16;
    for (const r of [a.rIn, a.rOut]) { xs.push(a.cx + Math.cos(t) * r); ys.push(a.cy + Math.sin(t) * r); }
  }
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

const boxIn = (b: Box, winW: number, winH: number) => b.x >= MARGIN && b.y >= MARGIN && b.x + b.w <= winW - MARGIN && b.y + b.h <= winH - MARGIN;
/** Turns to try, nearest the wanted one first: 0, +s, -s, +2s … */
const tries = (step: number, n: number) => [0, ...Array.from({ length: n }, (_, i) => [(i + 1) * step, -(i + 1) * step]).flat()];

/**
 * The ring pop-up: out past the round wheel at its slab's angle. With no room
 * there it turns round the ring, nearest first, until the controls (and, when
 * it can, the whole slab) are inside the window; only then is it pushed in.
 */
export function placeRing(wheel: WheelBox, angle: number, w: number, h: number, winW: number, winH: number): RingPlaced {
  const rIn = wheel.reach + RING_GAP;
  const turns = tries(0.12, 26);
  for (const whole of [true, false]) {
    for (const t of turns) {
      const p = ringAt(wheel.cx, wheel.cy, rIn, angle + t, w, h);
      if (boxIn({ x: p.x, y: p.y, w, h }, winW, winH) && (!whole || boxIn(arcBox(p.arc), winW, winH))) {
        return { ...p, flipX: Math.sign(Math.cos(angle + t)) !== Math.sign(Math.cos(angle)) && Math.abs(Math.cos(angle)) > 0.05 };
      }
    }
  }
  const p = ringAt(wheel.cx, wheel.cy, rIn, angle, w, h);
  const x = inside(p.x, w, winW), y = inside(p.y, h, winH);
  const arc = { ...p.arc, cx: p.arc.cx + x - p.x, cy: p.arc.cy + y - p.y };
  return { x, y, flipX: false, flipY: false, arc };
}

/** The smaller ring pop-up: further round the same ring, clear of the bigger slab, the way up the screen first. */
export function placeRingBeside(parent: Arc, w: number, h: number, winW: number, winH: number): RingPlaced & { side: number } {
  const gap = RING_GAP / parent.rIn;
  const mid = (parent.a0 + parent.a1) / 2;
  /* Which way round goes up the screen from the parent. */
  const up = Math.sin(parent.a1) < Math.sin(parent.a0) ? 1 : -1;
  for (const way of [up, -up]) {
    for (let k = 0; k < 40; k++) {
      const t = (way > 0 ? parent.a1 : parent.a0) + way * (gap + k * 0.04);
      /* Grow the guess until the slab's near side clears the parent's. */
      let p = ringAt(parent.cx, parent.cy, parent.rIn, t, w, h);
      for (let i = 0; i < 30 && (way > 0 ? p.arc.a0 < parent.a1 + gap : p.arc.a1 > parent.a0 - gap); i++) {
        const c = (p.arc.a0 + p.arc.a1) / 2 + way * 0.03;
        p = ringAt(parent.cx, parent.cy, parent.rIn, c, w, h);
      }
      if (boxIn({ x: p.x, y: p.y, w, h }, winW, winH)) return { ...p, side: way === up ? 0 : 1, flipX: false, flipY: way !== up };
    }
  }
  const p = ringAt(parent.cx, parent.cy, parent.rIn, mid + Math.PI / 2, w, h);
  return { ...p, x: inside(p.x, w, winW), y: inside(p.y, h, winH), side: 2 };
}

/** The slab's outline, as an SVG path in window pixels. */
export function arcPath(a: Arc): string {
  const pt = (r: number, t: number) => `${(a.cx + Math.cos(t) * r).toFixed(1)} ${(a.cy + Math.sin(t) * r).toFixed(1)}`;
  const big = a.a1 - a.a0 > Math.PI ? 1 : 0;
  return `M ${pt(a.rIn, a.a0)} L ${pt(a.rOut, a.a0)} A ${a.rOut} ${a.rOut} 0 ${big} 1 ${pt(a.rOut, a.a1)} L ${pt(a.rIn, a.a1)} A ${a.rIn} ${a.rIn} 0 ${big} 0 ${pt(a.rIn, a.a0)} Z`;
}

/* ------------------------------------------------------------------ */
/* The frame                                                           */
/* ------------------------------------------------------------------ */

/** The green of the level that opened it, and the blue of the smaller one it opens. */
export const RIM = { main: "oklch(0.72 0.19 148)", small: "oklch(0.72 0.17 205)" } as const;
export const TITLE = { main: "oklch(0.88 0.2 148)", small: "oklch(0.85 0.14 205)" } as const;
const FACE = `repeating-linear-gradient(0deg, oklch(0 0 0 / 0.2) 0 1px, transparent 1px 3px), linear-gradient(160deg, oklch(0.25 0.09 300), oklch(0.16 0.05 288))`;

/** The ring's face: the same void purple, as SVG stops, and the scanline the tag wears. */
export const RING_FACE = { from: "oklch(0.25 0.09 300)", to: "oklch(0.16 0.05 288)", line: "oklch(0 0 0 / 0.2)" } as const;
export const ringGlow = (which: keyof typeof RIM) => `drop-shadow(0 0 7px color-mix(in oklch, ${RIM[which]} 35%, transparent)) drop-shadow(0 14px 20px oklch(0 0 0 / 0.55))`;

/** The ring's controls: no box of their own, they sit on the slab. */
export function ringStyle(which: keyof typeof RIM, w: number): React.CSSProperties {
  return { width: w, padding: which === "main" ? 4 : 2, color: VOID.text };
}

/** The tag: what a pop-up's outer box wears. */
export function frameStyle(which: keyof typeof RIM, w: number): React.CSSProperties {
  const rim = RIM[which];
  return {
    width: w, padding: which === "main" ? 12 : 10, borderRadius: 16, border: `1.5px solid ${rim}`, background: FACE, color: VOID.text,
    boxShadow: `0 0 14px color-mix(in oklch, ${rim} 35%, transparent), 0 14px 34px oklch(0 0 0 / 0.55)`,
  };
}
