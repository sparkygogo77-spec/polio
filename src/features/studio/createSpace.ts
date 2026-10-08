"use client";
/**
 * Create: a new space from the menu, where the hand pressed.
 *
 * The right-click menu on the background gains a Create entry, and this is
 * what it does. It is to a new shape what the Draw button is to an existing
 * element: instead of reshaping something that exists, it makes a new shape
 * with space in it, and the space becomes whatever the prompt finalises it
 * as after designing. With no line drawn, the shape is a ring the size of a
 * part, kept inside the page, and it arrives as a placeholder: the same two
 * keys a drawn line gets, so a space from the menu and a space from the
 * hand are the same thing decided the same way.
 *
 * The menu file is hypatia's, so the entry is handed over and this is the
 * action it calls: `createSpaceAt(x, y)` in canvas pixels, the point the
 * menu already hands `addNode`.
 */
import { roundBoundary } from "./space";
import { useStudio } from "./board/store";

/** A space made from the menu is this far across: a part's own size, near enough. */
export const CREATE_R = 120;

/**
 * A placeholder ring about the point, inside the page. Returns its id.
 *
 * Kept a ring's width from the page's edges, the way a part is placed
 * inside the frame: a space half off the page would be a space nobody can
 * finish drawing in.
 */
export function createSpaceAt(x: number, y: number, r = CREATE_R): string {
  const s = useStudio.getState();
  const cx = Math.max(r + 8, Math.min(s.frameWidth - r - 8, x));
  const cy = Math.max(r + 8, y);
  return s.addSpace({ pageId: s.activePageId, boundary: roundBoundary(cx, cy, r), prompt: "", label: "" });
}
