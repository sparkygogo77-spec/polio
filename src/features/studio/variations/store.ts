"use client";
/**
 * Which sites are variations, of what, and how each was made: its seeds,
 * its spec, its aims and locks, Claude's note and word suggestions. Kept in
 * this browser beside the Builds list (`builder.variations`), outside any
 * document, so the original's document is never written to keep track.
 *
 * A variation is a site in Builds like any other (with `versionOf` naming
 * its original); this only says how to make it again.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Layer, Variation } from "./model";

interface VariationsState {
  /** By the variation's own site id. */
  byId: Record<string, Variation>;
  /** The layers locked on the variations page, per original. */
  locks: Record<string, Layer[]>;
  put: (id: string, v: Variation) => void;
  drop: (id: string) => void;
  setLocks: (of: string, locks: Layer[]) => void;
}

export const useVariations = create<VariationsState>()(
  persist(
    (set) => ({
      byId: {},
      locks: {},
      put: (id, v) => set((s) => ({ byId: { ...s.byId, [id]: v } })),
      drop: (id) => set((s) => { const { [id]: _gone, ...rest } = s.byId; void _gone; return { byId: rest }; }),
      setLocks: (of, locks) => set((s) => ({ locks: { ...s.locks, [of]: locks } })),
    }),
    { name: "builder.variations", storage: createJSONStorage(() => ({
      getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
      removeItem: (k) => { try { localStorage.removeItem(k); } catch { /* nothing kept */ } },
      /* A full localStorage refuses it: the variations are still sites in Builds, only how to make each again is not kept. */
      setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* see above */ } },
    })), partialize: (s) => ({ byId: s.byId, locks: s.locks }) as VariationsState, skipHydration: true },
  ),
);

/** The variations of one site, newest first. */
export function variationsOf(byId: Record<string, Variation>, of: string): { id: string; v: Variation }[] {
  return Object.entries(byId).filter(([, v]) => v.of === of).map(([id, v]) => ({ id, v })).sort((a, b) => b.v.made - a.v.made);
}
