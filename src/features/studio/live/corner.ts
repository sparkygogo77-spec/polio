/**
 * Pure: no store, no React, so the style layer and the tests run it as written.
 */

/** Whole-site behaviours that are also a thing on screen, placed on the board (`PartDef.placed` in `shelf/parts/index.ts`). */
export const PLACED: ReadonlySet<string> = new Set(["back-to-top"]);

/**
 * WHERE A PLACED BUTTON STAYS ON SCREEN (J, 2026-10-10: back to top sat too
 * close to the border; he wants to put it where it goes). Its spot on the
 * board becomes a distance from the nearest corner of the screen, so it keeps
 * that corner at any window size. The screen is the board's first 900px (or
 * the page, when shorter); a button put lower than that counts from the
 * page's foot. Never closer to an edge than `MIN_INSET`.
 */
export interface Corner { v: "top" | "bottom"; h: "left" | "right"; x: number; y: number; size: number }
export const CORNER_DEFAULT: Corner = { v: "bottom", h: "right", x: 24, y: 24, size: 44 };
export const MIN_INSET = 16;
export const SCREEN = 900;

/** A placed part as the board draws it: one the old whole-site switch left as a page-wide strip is not, and keeps the default corner. */
export function onScreenButton(n: { featureId: string; w: number; h: number }): boolean {
  return PLACED.has(n.featureId) && n.w <= 160 && n.h <= 160;
}

export function cornerOf(n: { featureId: string; x: number; y: number; w: number; h: number }, frameWidth: number, pageH = SCREEN): Corner {
  if (!onScreenButton(n)) return CORNER_DEFAULT;
  const fit = (v: number, max: number) => Math.round(Math.min(max, Math.max(MIN_INSET, v)));
  const right = n.x + n.w / 2 > frameWidth / 2;
  const screen = Math.min(SCREEN, Math.max(pageH, n.y + n.h));
  const top = n.y + n.h / 2 < screen / 2;
  const below = top ? n.y : n.y + n.h <= screen ? screen - n.y - n.h : Math.max(pageH, n.y + n.h) - n.y - n.h;
  return { v: top ? "top" : "bottom", h: right ? "right" : "left", x: fit(right ? frameWidth - n.x - n.w : n.x, frameWidth / 2), y: fit(below, SCREEN / 2), size: Math.round(Math.min(96, Math.max(28, Math.min(n.w, n.h)))) };
}
