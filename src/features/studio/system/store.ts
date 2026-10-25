"use client";
/**
 * THE LIBRARY OF SYSTEMS: every System, kept once, in this browser beside the
 * builds list (`builder.systems`), and saved to the account with the shelf
 * things (`account/sync.ts` → `data/prefs.json`, merged by `mergeLibrary`).
 *
 * Many sites use one System: each names it by id (`doc.systemId`). Changing
 * a System here changes every site using it — the open one at once
 * (`api.ts#reconcile`), the others when they are drawn (`draw.ts`) or opened.
 * Nothing is ever taken out of the library by a sync: the later copy of each
 * System wins, by `editedAt` and then `rev`.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { readSystem, type System } from "./model";

export const LIBRARY_KEY = "builder.systems";

interface Library {
  byId: Record<string, System>;
  /** Keep this System (a new one, or a newer copy of one held). */
  put: (s: System) => void;
  /** Take Systems from elsewhere (the account): each kept where it is newer than the one held. Returns how many changed. */
  merge: (list: readonly unknown[]) => number;
}

/** Is `a` a later copy than `b`? */
export const newer = (a: System, b: System | undefined): boolean => !b || a.editedAt > b.editedAt || (a.editedAt === b.editedAt && a.rev > b.rev);

export const useSystems = create<Library>()(
  persist(
    (set, get) => ({
      byId: {},
      put: (s) => { if (get().byId[s.id] !== s) set((l) => ({ byId: { ...l.byId, [s.id]: s } })); },
      merge: (list) => {
        const next = { ...get().byId };
        let n = 0;
        for (const raw of list) {
          const s = readSystem(raw);
          if (s && newer(s, next[s.id])) { next[s.id] = s; n++; }
        }
        if (n) set({ byId: next });
        return n;
      },
    }),
    {
      name: LIBRARY_KEY,
      storage: createJSONStorage(() => ({
        getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
        removeItem: (k) => { try { localStorage.removeItem(k); } catch { /* nothing kept */ } },
        setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* the account keeps them, and each site keeps its own copy */ } },
      })),
      partialize: (l) => ({ byId: l.byId }) as Library,
      /* Read strictly: whatever is in storage was written by some version of this code, or by hand. */
      merge: (persisted, current) => {
        const byId: Record<string, System> = {};
        const raw = (persisted as { byId?: Record<string, unknown> } | null)?.byId ?? {};
        for (const v of Object.values(raw)) { const s = readSystem(v); if (s) byId[s.id] = s; }
        return { ...current, byId };
      },
    },
  ),
);

/** The house style: the System marked last, or null when none is. */
export function houseOf(byId: Record<string, System> = useSystems.getState().byId): System | null {
  let best: System | null = null;
  for (const s of Object.values(byId)) if (s.house && (!best || s.house > (best.house ?? 0))) best = s;
  return best;
}

/** Mark one System the house style, and only it (null: none is). Each System whose mark changes is a new copy, so the account carries it. */
export function markHouse(id: string | null, at = Date.now()): void {
  const byId = useSystems.getState().byId;
  const next = { ...byId };
  let n = 0;
  for (const s of Object.values(byId)) {
    const want = s.id === id;
    if (want === !!s.house && (!want || houseOf(byId)?.id === id)) continue;
    const { house: _h, ...rest } = s;
    void _h;
    next[s.id] = { ...rest, ...(want ? { house: at } : {}), rev: s.rev + 1, editedAt: Math.max(at, s.editedAt + 1) };
    n++;
  }
  if (n) useSystems.setState({ byId: next });
}

/** Every System held, the most recently changed first. */
export function libraryList(): System[] {
  return Object.values(useSystems.getState().byId).sort((a, b) => b.editedAt - a.editedAt);
}

/** For the account sync: what this browser has, and the account's taken in. */
export function mergeLibrary(theirs: unknown): number {
  return Array.isArray(theirs) ? useSystems.getState().merge(theirs) : 0;
}
