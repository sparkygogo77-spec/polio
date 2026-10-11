/**
 * WHERE ONE STEP THROUGH A KIND'S PARTS LANDS (`SiteColours.tsx#tourStep`).
 *
 * The next part in reading order (or the one before), passing parts that
 * cannot be glided to (hidden in a state) and parts the board already shows,
 * or will once it gets where it is going: J (2026-10-11) scrolled five times
 * to pass one card's five fields, all on screen together. When every part
 * left is already in view, it steps to the plain next one, so a step never
 * does nothing.
 *
 * Pure: `tests/tour-stop.mjs`.
 */
export function nextStop(count: number, at: number, dir: 1 | -1, hidden: (i: number) => boolean, shown: (i: number) => boolean): number {
  const step = (i: number) => (((i + dir) % count) + count) % count;
  let plain = -1;
  for (let k = 0, i = at; k < count; k++) {
    i = step(i);
    if (hidden(i)) continue;
    if (plain < 0) plain = i;
    if (shown(i)) continue;
    return i;
  }
  return plain >= 0 ? plain : step(at);
}
