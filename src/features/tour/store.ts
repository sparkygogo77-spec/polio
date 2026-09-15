"use client";
/**
 * Where the tour is up to.
 *
 * Deliberately small and deliberately not persisted: a tour is something you
 * are in the middle of, not something the app remembers about you. The one
 * thing kept across visits is whether it has been offered, and that lives on
 * the Builds page, not here.
 */
import { create } from "zustand";
import { STEPS } from "./steps";

interface Tour {
  open: boolean;
  /** Index into STEPS. */
  step: number;
  start: (at?: number) => void;
  go: (to: number) => void;
  next: () => void;
  back: () => void;
  stop: () => void;
}

export const useTour = create<Tour>()((set, get) => ({
  open: false,
  step: 0,

  start: (at = 0) => set({ open: true, step: Math.max(0, Math.min(STEPS.length - 1, at)) }),

  go: (to) => {
    if (to < 0 || to >= STEPS.length) return get().stop();
    // Whatever the last step opened is put away by the overlay before this
    // lands, so a step never inherits the screen the one before it left.
    set({ step: to });
  },

  next: () => get().go(get().step + 1),
  back: () => get().go(get().step - 1),

  stop: () => set({ open: false, step: 0 }),
}));
