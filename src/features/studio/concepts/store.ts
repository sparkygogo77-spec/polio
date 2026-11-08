"use client";
/**
 * Which sites are concepts, which prompt made them together, and what the
 * group's Mix is made of. Kept in this browser beside the Builds list
 * (`builder.concepts`), outside any document: a concept's document is an
 * ordinary site's and is never written to keep track.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Concept, Group, Take } from "./model";

interface ConceptsState {
  /** By the concept's own site id. */
  byId: Record<string, Concept>;
  /** By group id. */
  groups: Record<string, Group>;
  /** The group last made or opened: what the canvas shows with no `?g=`. */
  lastGroup: string | null;
  put: (id: string, c: Concept) => void;
  drop: (id: string) => void;
  putGroup: (g: Group) => void;
  setTakes: (group: string, takes: Take[], mix: string | null) => void;
  setLast: (group: string | null) => void;
}

export const useConcepts = create<ConceptsState>()(
  persist(
    (set) => ({
      byId: {},
      groups: {},
      lastGroup: null,
      put: (id, c) => set((s) => ({ byId: { ...s.byId, [id]: c } })),
      drop: (id) => set((s) => {
        const { [id]: _gone, ...rest } = s.byId;
        void _gone;
        const groups = Object.fromEntries(Object.entries(s.groups).map(([k, g]) => [k, { ...g, ids: g.ids.filter((x) => x !== id), mix: g.mix === id ? null : g.mix, takes: g.takes.filter((t) => t.from !== id) }]));
        return { byId: rest, groups };
      }),
      putGroup: (g) => set((s) => ({ groups: { ...s.groups, [g.id]: g }, lastGroup: g.id })),
      setTakes: (group, takes, mix) => set((s) => (s.groups[group] ? { groups: { ...s.groups, [group]: { ...s.groups[group]!, takes, mix } } } : {})),
      setLast: (group) => set({ lastGroup: group }),
    }),
    {
      name: "builder.concepts",
      storage: createJSONStorage(() => ({
        getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
        removeItem: (k) => { try { localStorage.removeItem(k); } catch { /* nothing kept */ } },
        /* A full localStorage refuses it: the concepts are still sites in Builds, only that they belong together is not kept. */
        setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* see above */ } },
      })),
      partialize: (s) => ({ byId: s.byId, groups: s.groups, lastGroup: s.lastGroup }) as ConceptsState,
      skipHydration: true,
    },
  ),
);

/** The groups, newest first. */
export function groupList(groups: Record<string, Group>): Group[] {
  return Object.values(groups).sort((a, b) => b.made - a.made);
}
