"use client";
/**
 * Whether the dock is open, which part and action it was opened for, and
 * whether the helper answered. Nothing here is kept: the dock's own state
 * (lanes, the pairing token) lives in the frame, on the helper.
 */
import { create } from "zustand";
import { DOCK_URL, type PartAction } from "./context";

export type Reach = "checking" | "up" | "down";
export type DockTab = "chats" | "helper";

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
  /** The dock's first tab is the lanes board; the helper's own page is the second. */
  tab: DockTab;
  /** The question last opened from an orb, a moon or a slice of the pie (Orbs 2, pieces B and H): brought into view, open and lit. */
  lit: { id: string; at: number } | null;
  /** The full-screen Agents manager (J's columns, 2026-11-11): a toggle from the dock; while it shows, a question opens over its column there. */
  manager: boolean;
}

export const useAgents = create<AgentsState>(() => ({ open: false, action: null, partId: null, reach: "checking", ask: null, seq: 0, compare: null, tab: "chats", lit: null, manager: false }));

/** Open one question: the dock on the chats, that question open and lit (a slice of the pie, an orb, a moon). */
export function openQuestion(id: string) {
  const s = useAgents.getState();
  /* With the manager up, the question opens over its coordinator's column there, not in the dock under it. */
  if (s.manager) { useAgents.setState({ lit: { id, at: Date.now() } }); return; }
  if (!s.open) { openDock(); }
  useAgents.setState({ tab: "chats", lit: { id, at: Date.now() } });
}

/** The Agents button opens on the chats; a request about a part goes to the helper, which is what takes it. */
export function openDock(action: PartAction | null = null, partId: string | null = null) {
  useAgents.setState((s) => ({ open: true, action, partId, ask: null, seq: s.seq + 1, tab: action ? "helper" : "chats" }));
  void reachHelper();
}

export function setDockTab(tab: DockTab) {
  useAgents.setState({ tab });
}

export function closeDock() {
  useAgents.setState({ open: false, action: null, partId: null, manager: false });
}

/** The manager takes the whole screen; the dock stays loaded under it (the site bridge lives in its frame). */
export function openManager() {
  if (!useAgents.getState().open) openDock();
  useAgents.setState({ manager: true, tab: "chats" });
}
export function closeManager() {
  useAgents.setState({ manager: false });
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
