"use client";
/**
 * A page's worth of boxes arriving one after another, not all in one frame.
 *
 * HIS RULE, already written down for the timeline and quoted in AGENTS.md:
 * "everything not seen yet is all loaded in sequentially but each box starts
 * maybe .2 seconds apart, not once the previous is finished". A captured
 * page is the other place boxes arrive in a crowd — `FromASite` lands every
 * block it read in one synchronous loop — and there they all appeared at
 * once, which reads as a picture being pasted rather than as a page being
 * built.
 *
 * So the same number, `STAGGER_MS`, imported rather than written again.
 *
 * WHAT THIS DOES NOT DO IS DELAY THE PARTS THEMSELVES. Every node is added
 * in the same synchronous run it always was, and only the PAINTING of each
 * box waits its turn. That is not a detail of taste: a part that arrives on
 * a timer is a part that takes its undo checkpoint on a timer, and "one undo
 * brings the old board back" after an import is a promise that was proved by
 * hand. A board that is half arrived when undo is pressed would break it
 * quietly, and quiet is the expensive kind.
 *
 * Opacity, and nothing else. The box holds its place in the layout the whole
 * time, so nothing anywhere measures a different page while a run is
 * arriving.
 *
 * THE HOLD IS CLAIMED AT MOUNT, NOT MARKED AFTER IT. `addNode` flushes React
 * synchronously, so a part has already mounted by the time the call returns
 * and a mark set afterwards arrives too late to be read — the mistake
 * `markArriving` in `ImportFlow.tsx` records having made, where a box
 * measured 647px in flight and 647px at rest and no animation ran at all. So
 * the hold is opened BEFORE the run, the boxes claim their turn in the order
 * they mount, and the claim is idempotent per id so a second render takes
 * the turn it already has.
 */
import * as React from "react";
import { STAGGER_MS } from "./timelineView";

/** How long one box takes to come up, once its turn arrives. */
export const BOX_ENTRY_MS = 260;

/** How many boxes of the open run are still to claim a turn. */
let waiting = 0;
/** How many have claimed one, which is what sets the next delay. */
let taken = 0;
/** The turn each box was given, so a re-render reads the same one. */
const turns = new Map<string, number>();

/**
 * The next `n` boxes to mount arrive in turn rather than together.
 *
 * Called immediately before the run that adds them. The hold closes itself
 * on the next microtask, because the run that opens it is synchronous: a
 * hold left standing would catch the next part somebody dropped by hand,
 * which would be a part fading in for no reason anybody could explain.
 */
export function holdIncoming(n: number) {
  if (n <= 1) return;
  waiting = n;
  taken = 0;
  queueMicrotask(() => { waiting = 0; });
}

/** This box's turn, in ms from the moment the run landed, or null if it has none. */
function claimTurn(id: string): number | null {
  const had = turns.get(id);
  if (had !== undefined) return had;
  if (waiting <= 0) return null;
  waiting--;
  const at = taken++ * STAGGER_MS;
  turns.set(id, at);
  return at;
}

/**
 * Whether this box is still waiting to be painted, and the fade when it is
 * not.
 *
 * Both halves live here so the board's own component carries three lines
 * about a box arriving rather than a mechanism. The fade is run on the
 * element, once, the way the import's own settle already is; a box with no
 * turn never waits and never animates, which is every box that was not part
 * of a run.
 */
export function useBoxEntry(id: string, el: React.RefObject<HTMLElement | null>): boolean {
  const turn = React.useRef<number | null | undefined>(undefined);
  if (turn.current === undefined) turn.current = claimTurn(id);
  const [held, setHeld] = React.useState(turn.current !== null);
  const wasHeld = React.useRef(held);

  React.useEffect(() => {
    if (turn.current === null) return;
    const t = setTimeout(() => { turns.delete(id); setHeld(false); }, turn.current ?? 0);
    return () => clearTimeout(t);
  }, [id]);

  React.useEffect(() => {
    if (held || !wasHeld.current) return;
    wasHeld.current = false;
    const node = el.current;
    if (!node) return;
    const run = node.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: BOX_ENTRY_MS, easing: "cubic-bezier(0.2, 0.9, 0.2, 1)", fill: "none" },
    );
    return () => run.cancel();
  }, [held, el]);

  return held;
}
