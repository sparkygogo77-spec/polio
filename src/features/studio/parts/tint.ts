/**
 * A colour at a share of its strength: `tint(t.accent, 0.13)` for a wash of
 * the accent. The one way a part makes a see-through colour.
 *
 * It used to be `${t.accent}22`, two hex digits glued on, which is a colour
 * only when the colour it is glued to is written as six hex digits. The
 * palette is written as oklch(), a captured one as rgb(), a person may type
 * a name: glued onto any of those it is not a colour, the browser drops the
 * whole declaration, and the tint, the border or the background it was part
 * of silently disappears. `color-mix` with transparent works for every way a
 * colour can be written, including a var(). `tests/tint-glue.mjs` fails on
 * any part that glues digits onto a colour again.
 */
export function tint(colour: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  if (a >= 1) return colour;
  return `color-mix(in srgb, ${colour} ${Math.round(a * 1000) / 10}%, transparent)`;
}
