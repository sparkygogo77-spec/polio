/**
 * A locked group, resized as one thing.
 *
 * HIS WORDS: "lock and group orientations and relative spaces and sizes with
 * a sizable select button", and "Icon and text should grow with it … Make a
 * checkbox option for that." The arrangement is what the lock holds, so a
 * resize always carries it: every member's place in the group moves with the
 * group's box. The checkbox ("Scale contents with group", on by default) is
 * about the icon and the words only:
 *
 *   · on  — each member's box scales with the group, from the group's own
 *           corner, and its words' size with it;
 *   · off — each member keeps its own size and its words theirs, and its
 *           centre moves with the group, so the spacing still scales.
 *
 * Words scale by the smaller of the two stretches, so they still fit a box
 * that grew more one way than the other. They stop at the 0.6–2× of the
 * site's size that `applyFont` (parts/theme.ts) has always clamped to, and
 * say so: `ceiling` is set when a resize wanted more (or less) than that.
 * No field is added for it — a new one would change the published page.
 */

/** The renderer's clamp on a part's own text size, `applyFont` in parts/theme.ts. */
export const TEXT_SCALE_MIN = 0.6;
export const TEXT_SCALE_MAX = 2;

export interface Box { x: number; y: number; w: number; h: number }
/** A member as it was when the hand went down; `size` is its `font.size`, null when it never set one. */
export interface Held extends Box { id: string; size: number | null }
export interface Scaled extends Box { id: string; size?: number }

/** The group's box after a handle moved by (dx, dy), the opposite side held still. */
export function pulledBox(from: Box, handle: string, dx: number, dy: number, min = 24): Box {
  let { x, y, w, h } = from;
  if (handle.includes("e")) w = Math.max(min, from.w + dx);
  if (handle.includes("s")) h = Math.max(min, from.h + dy);
  if (handle.includes("w")) { w = Math.max(min, from.w - dx); x = from.x + from.w - w; }
  if (handle.includes("n")) { h = Math.max(min, from.h - dy); y = from.y + from.h - h; }
  return { x, y, w, h };
}

export function scaleHeld(members: readonly Held[], from: Box, to: Box, contents: boolean): { next: Scaled[]; ceiling: "largest" | "smallest" | null } {
  const sx = to.w / Math.max(1, from.w);
  const sy = to.h / Math.max(1, from.h);
  const words = Math.min(sx, sy);
  let ceiling: "largest" | "smallest" | null = null;
  const next = members.map((m): Scaled => {
    if (!contents) {
      const cx = to.x + (m.x + m.w / 2 - from.x) * sx;
      const cy = to.y + (m.y + m.h / 2 - from.y) * sy;
      return { id: m.id, x: Math.round(cx - m.w / 2), y: Math.round(cy - m.h / 2), w: m.w, h: m.h };
    }
    const wanted = (m.size ?? 1) * words;
    const size = Math.round(Math.max(TEXT_SCALE_MIN, Math.min(TEXT_SCALE_MAX, wanted)) * 100) / 100;
    if (wanted > TEXT_SCALE_MAX + 1e-6) ceiling = "largest";
    else if (wanted < TEXT_SCALE_MIN - 1e-6) ceiling = "smallest";
    return {
      id: m.id,
      x: Math.round(to.x + (m.x - from.x) * sx),
      y: Math.round(to.y + (m.y - from.y) * sy),
      w: Math.max(1, Math.round(m.w * sx)),
      h: Math.max(1, Math.round(m.h * sy)),
      size,
    };
  });
  return { next, ceiling };
}
