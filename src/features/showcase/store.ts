"use client";
/**
 * The showcase's own state: which demo cards are liked, and which were
 * removed. A right-click menu is declared in the manifest and the cards are
 * drawn by the page, so the two meet here rather than through a prop.
 */
import { create } from "zustand";

interface ShowcaseState {
  liked: Record<string, boolean>;
  removed: Record<string, boolean>;
  toggleLike: (id: string) => void;
  remove: (id: string) => void;
}

export const useShowcase = create<ShowcaseState>()((set) => ({
  liked: { beta: true },
  removed: {},
  toggleLike: (id) => set((s) => ({ liked: { ...s.liked, [id]: !s.liked[id] } })),
  remove: (id) => set((s) => ({ removed: { ...s.removed, [id]: true } })),
}));
