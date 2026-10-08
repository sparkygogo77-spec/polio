"use client";

import * as React from "react";
import { decisions } from "../shelf";
import { partLearned } from "../learn";
import { pageNodes, useHeldStudio, useSteady } from "../board/store";
import { useShallow } from "zustand/react/shallow";

/**
 * Whether every part's orange ! is on the board, or only the picked part's.
 *
 * Every part that went nowhere wore its own !, and on an imported page that
 * is nearly every part: the nav's links, each button, the Buy and Sell
 * circles. The page was covered in them. Now the board shows the ! on the
 * picked part only, the top bar carries one count of them all, and pressing
 * the count shows them all again (`tests/decide-count.mjs`).
 *
 * Kept per browser, like the shelf's fold: it is how this person likes the
 * board, not something about the site.
 */
const KEY = "builder.decideBadges.v1";
let all: boolean | null = null;
const watchers = new Set<() => void>();

function read(): boolean {
  if (all === null) {
    try { all = window.localStorage.getItem(KEY) === "all"; } catch { all = false; }
  }
  return all;
}

export function setDecideAll(v: boolean) {
  all = v;
  try { window.localStorage.setItem(KEY, v ? "all" : "picked"); } catch { /* the board still follows it this visit */ }
  watchers.forEach((w) => w());
}

export function useDecideAll(): boolean {
  return React.useSyncExternalStore(
    (w) => { watchers.add(w); return () => { watchers.delete(w); }; },
    read,
    () => false,
  );
}

/** The parts on this page still waiting on a decision, as the board works them out: a learned part has none. */
export function useDecideCount(): number {
  const nodes = useSteady(useHeldStudio(useShallow(pageNodes)));
  const learnState = useHeldStudio((s) => s.learn);
  return React.useMemo(() => decisions(nodes).filter((d) => !learnState || !partLearned(learnState, d.id)).length, [nodes, learnState]);
}
