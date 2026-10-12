/**
 * What the Pictures panel has running, kept outside the panel.
 *
 * J (2026-10-12): "when i click on anything that swiches the side panel to an
 * element or off the looks panel my generated pictures progress disappears it
 * should never abandon". The work itself was never stopped (its promises run
 * on, and pictures land in the document), but the rows that showed it, the
 * line under Generate and the count of runs lived in the panel and went with
 * it. They live here now, for as long as the page does, so a panel that comes
 * back shows every job still going and the last thing said.
 */
import { create } from "zustand";

export interface Job { id: string; label: string; expect: number; at: number; before?: number }

type Next<T> = T | ((was: T) => T);
const apply = <T,>(next: Next<T>, was: T): T => (typeof next === "function" ? (next as (w: T) => T)(was) : next);

interface Running {
  jobs: Job[];
  running: number;
  said: string | null;
  madeThreeD: string | null;
  setJobs: (next: Next<Job[]>) => void;
  setRunning: (next: Next<number>) => void;
  setSaid: (next: Next<string | null>) => void;
  setMadeThreeD: (next: Next<string | null>) => void;
}

export const usePictureJobs = create<Running>((set) => ({
  jobs: [],
  running: 0,
  said: null,
  madeThreeD: null,
  setJobs: (next) => set((s) => ({ jobs: apply(next, s.jobs) })),
  setRunning: (next) => set((s) => ({ running: apply(next, s.running) })),
  setSaid: (next) => set((s) => ({ said: apply(next, s.said) })),
  setMadeThreeD: (next) => set((s) => ({ madeThreeD: apply(next, s.madeThreeD) })),
}));
