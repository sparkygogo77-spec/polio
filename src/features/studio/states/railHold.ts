/**
 * WHAT THE PANELS RAIL CHANGED ON THE BOARD, SO LETTING GO PUTS IT BACK (J, 2026-10-11).
 *
 * J hovered "Duel circles" in the Panels rail, clicked it, clicked it again
 * to switch it off, and the chart, Level, Same again and Replay stayed over
 * the TV. Hovering had snapped the page state to the scene that draws the
 * panel (`snapToSceneShowing`) and letting go only dropped the isolate key,
 * so the snapped scene stayed. Every write the rail makes to `statesOn` goes
 * through a hold: it notes which keys the rail added and which it took away,
 * and giving it back undoes exactly those, leaving the board as it was.
 *
 * Changes made elsewhere meanwhile (a scene stepped from the Show bar, a
 * hidden part switched on at the foot of the rail) are kept: an added key
 * still on is taken off, but a key the rail took away comes back only when
 * nothing of its own kind (`screen:`, `hidden:` …) was switched on since.
 */
export type RailHold = { added: Set<string>; removed: Set<string>; wrote: string[] };

const kind = (k: string) => k.slice(0, k.indexOf(":") + 1);

/** Note a write of the rail's from `now` to `next` on the hold (a fresh one when none is open). */
export function holdWrite(hold: RailHold | null, now: readonly string[], next: readonly string[]): RailHold {
  const h: RailHold = hold ?? { added: new Set(), removed: new Set(), wrote: [] };
  const was = new Set(now), will = new Set(next);
  for (const k of will) if (!was.has(k)) { if (h.removed.has(k)) h.removed.delete(k); else h.added.add(k); }
  for (const k of was) if (!will.has(k)) { if (h.added.has(k)) h.added.delete(k); else h.removed.add(k); }
  h.wrote = [...next];
  return h;
}

/** `statesOn` with the rail's changes undone, keeping what was changed elsewhere since its last write. */
export function holdGiveBack(hold: RailHold, now: readonly string[]): string[] {
  const wrote = new Set(hold.wrote);
  const since = new Set(now.filter((k) => !wrote.has(k)).map(kind));
  const out = now.filter((k) => !hold.added.has(k));
  for (const k of hold.removed) if (!out.includes(k) && !since.has(kind(k))) out.push(k);
  return out;
}
