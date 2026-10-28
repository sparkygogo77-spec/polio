"use client";
/**
 * Whether the dock is open, which part and action it was opened for, and
 * whether the helper answered. Nothing here is kept: the dock's own state
 * (lanes, the pairing token) lives in the frame, on the helper.
 */
import { create } from "zustand";
import { DOCK_URL, type PartAction } from "./context";

export type Reach = "checking" | "up" | "down";

interface AgentsState {
  open: boolean;
  action: PartAction | null;
  /** The part the dock was opened about; null opens it about the picked part, if any. */
  partId: string | null;
  reach: Reach;
  /** The five-action chooser, open at a spot on screen for a part. */
  ask: { partId: string; x: number; y: number } | null;
  /** Bumped on every open, so the frame is handed its context again even when it already shows. */
  seq: number;
  /** A big agent change made a Duplicate first (`bridge.ts`): the before, to Compare with. */
  compare: { href: string; name: string } | null;
}

export const useAgents = create<AgentsState>(() => ({ open: false, action: null, partId: null, reach: "checking", ask: null, seq: 0, compare: null }));

export function openDock(action: PartAction | null = null, partId: string | null = null) {
  useAgents.setState((s) => ({ open: true, action, partId, ask: null, seq: s.seq + 1 }));
  void reachHelper();
}

export function closeDock() {
  useAgents.setState({ open: false, action: null, partId: null });
}

export function openAsk(partId: string, x: number, y: number) {
  useAgents.setState({ ask: { partId, x, y } });
}

export function closeAsk() {
  useAgents.setState({ ask: null });
}

/**
 * Is the helper there? An opaque answer (`no-cors`) is enough: it says
 * something listens, and reads nothing. A refused connection or a wait past
 * 2.5s is "down", and the dock shows how to start it.
 */
export async function reachHelper(): Promise<Reach> {
  useAgents.setState({ reach: "checking" });
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 2500);
  let reach: Reach = "down";
  try {
    await fetch(DOCK_URL, { mode: "no-cors", cache: "no-store", signal: stop.signal });
    reach = "up";
  } catch { /* not running, not installed, or Chrome's local-network prompt was refused */ }
  clearTimeout(timer);
  useAgents.setState({ reach });
  return reach;
}
