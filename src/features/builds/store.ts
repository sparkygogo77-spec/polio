"use client";
/**
 * More than one site in one browser.
 *
 * The Builder keeps its document in local storage under one key, which is a
 * fine answer to "where does my work go" and no answer at all to "where is the
 * other thing I was making". So the document key becomes the *active* slot and
 * every project keeps its own copy beside it; swapping is a copy in, a copy
 * out, and a rehydrate.
 *
 * Nothing about a project lives on a server. A project is a document in this
 * browser, the repository it publishes to, and the address it went live at —
 * three facts, all of them the owner's.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/core/lib/ids";
import { useStudio } from "@/features/studio/store";

/** Where the Builder reads and writes the document it is editing. */
const LIVE = "builder.studio";
/** Where a project that is not open keeps its own. */
const slot = (id: string) => `builder.doc:${id}`;

export interface Project {
  id: string;
  name: string;
  updatedAt: number;
  /** Where it publishes to. Unset until someone says. */
  repo?: { owner: string; name: string; branch: string };
  /** Where it went live, the last time it did. */
  live?: { url: string; at: number };
}

/** What a project's document says about itself, for the row that lists it. */
export interface Shape {
  pages: number;
  parts: number;
}

interface Builds {
  projects: Project[];
  activeId: string | null;
  /** First run: take whatever is already in the Builder rather than lose it. */
  adopt: () => void;
  create: (name?: string) => string;
  open: (id: string) => void;
  rename: (id: string, name: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  setRepo: (id: string, repo: Project["repo"]) => void;
  setLive: (id: string, url: string) => void;
  /** Write the open document back to its own slot. */
  save: () => void;
}

const read = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const write = (key: string, value: string | null) => {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private mode */ }
};

/**
 * How much is in a project, without loading it into the Builder to find out.
 *
 * The open one is read from the live key rather than from its slot: the slot
 * only catches up when something saves, and the Builder writes the live key on
 * every edit. Neither is read through the studio store, which is not hydrated
 * anywhere but the Builder and would answer with its own empty defaults.
 */
export function shapeOf(id: string, active = false): Shape {
  try {
    const raw = read(active ? LIVE : slot(id));
    if (!raw) return { pages: 0, parts: 0 };
    const doc = JSON.parse(raw) as { state?: { pages?: unknown[]; nodes?: unknown[] } };
    return { pages: doc.state?.pages?.length ?? 0, parts: doc.state?.nodes?.length ?? 0 };
  } catch {
    return { pages: 0, parts: 0 };
  }
}

export const useBuilds = create<Builds>()(
  persist(
    (set, get) => ({
      projects: [],
      activeId: null,

      adopt: () => {
        if (get().projects.length) return;
        const id = uid();
        // Whatever the Builder is holding becomes the first project, so nobody
        // opens this page and finds their work replaced by an empty list.
        const held = read(LIVE);
        if (held) write(slot(id), held);
        set({ projects: [{ id, name: "First site", updatedAt: Date.now() }], activeId: id });
      },

      save: () => {
        const id = get().activeId;
        if (!id) return;
        const held = read(LIVE);
        if (held) write(slot(id), held);
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, updatedAt: Date.now() } : p)) }));
      },

      create: (name) => {
        get().save();
        const id = uid();
        // A new project starts empty: no slot, so opening it gives the Builder
        // nothing to hydrate from and it falls back to its own defaults.
        write(slot(id), null);
        set((s) => ({
          projects: [{ id, name: name?.trim() || `Site ${s.projects.length + 1}`, updatedAt: Date.now() }, ...s.projects],
          activeId: id,
        }));
        write(LIVE, null);
        void useStudio.persist.rehydrate();
        return id;
      },

      open: (id) => {
        if (get().activeId === id) return;
        get().save();
        write(LIVE, read(slot(id)));
        set({ activeId: id });
        // The Builder re-reads the key it was already watching, so every panel
        // and the canvas come back on the new document without a reload.
        void useStudio.persist.rehydrate();
      },

      rename: (id, name) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)) })),

      duplicate: (id) => {
        get().save();
        const from = get().projects.find((p) => p.id === id);
        if (!from) return;
        const copy = uid();
        write(slot(copy), read(slot(id)));
        set((s) => ({
          projects: [{ ...from, id: copy, name: `${from.name} copy`, updatedAt: Date.now(), live: undefined }, ...s.projects],
        }));
      },

      remove: (id) => {
        write(slot(id), null);
        set((s) => {
          const left = s.projects.filter((p) => p.id !== id);
          return { projects: left, activeId: s.activeId === id ? (left[0]?.id ?? null) : s.activeId };
        });
        // Removing the one that was open leaves the Builder on whatever is
        // next, rather than on a document with nothing behind it.
        const next = get().activeId;
        if (next) { write(LIVE, read(slot(next))); void useStudio.persist.rehydrate(); }
      },

      setRepo: (id, repo) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, repo } : p)) })),

      setLive: (id, url) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, live: { url, at: Date.now() } } : p)) })),
    }),
    { name: "builder.builds", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

/** The project the Builder is on, when there is one. */
export const activeProject = (): Project | null => {
  const { projects, activeId } = useBuilds.getState();
  return projects.find((p) => p.id === activeId) ?? null;
};
