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
import { swapDoc, takeCarriedRepo, useStudio } from "@/features/studio/store";
import type { PreviewDoc } from "@/features/studio/SitePreview";

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
 * A project's document, as the Builder would have loaded it.
 *
 * Only the parts a card needs to draw the site: the pages, the parts on them,
 * the format and the look. It is the persisted shape, so anything the store's
 * hydration would have filled in is missing here — which is why everything
 * that reads it treats every field as optional.
 *
 * It is `PreviewDoc` itself rather than a second declaration of the same six
 * fields: the thing that draws a site small names what it needs, and this is
 * the name Builds calls it by.
 */
export type StudioDoc = PreviewDoc;

/**
 * What a project holds, without loading it into the Builder to find out.
 *
 * The open one is read from the live key rather than from its slot: the slot
 * only catches up when something saves, and the Builder writes the live key on
 * every edit. Neither is read through the studio store, which is not hydrated
 * anywhere but the Builder and would answer with its own empty defaults.
 */
export function docOf(id: string, active = false): StudioDoc | null {
  try {
    const raw = read(active ? LIVE : slot(id));
    if (!raw) return null;
    return (JSON.parse(raw) as { state?: StudioDoc }).state ?? null;
  } catch {
    return null;
  }
}

export function shapeOf(id: string, active = false): Shape {
  const doc = docOf(id, active);
  return { pages: doc?.pages?.length ?? 0, parts: doc?.nodes?.length ?? 0 };
}

export const useBuilds = create<Builds>()(
  persist(
    (set, get) => ({
      projects: [],
      activeId: null,

      adopt: () => {
        if (get().projects.length) { carryRepos(); return; }
        const id = uid();
        // Whatever the Builder is holding becomes the first project, so nobody
        // opens this page and finds their work replaced by an empty list.
        const held = read(LIVE);
        if (held) write(slot(id), held);
        set({ projects: [{ id, name: "First site", updatedAt: Date.now() }], activeId: id });
        carryRepos();
      },

      save: () => {
        const id = get().activeId;
        if (!id) return;
        const held = read(LIVE);
        if (held) write(slot(id), held);
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, updatedAt: Date.now() } : p)) }));
      },

      /*
       * ONE SITE'S WORK IS NEVER WRITTEN INTO ANOTHER SITE'S SLOT.
       *
       * Both of these do the same four things in the same order, and the
       * order is the guarantee:
       *
       *   1. save    the live key goes to the slot of the site being left,
       *              while `activeId` still names that site. This is the only
       *              moment a slot is written, and it is written with its own
       *              document.
       *   2. read    the target's slot, or null if it has never been saved.
       *   3. write   the live key becomes that, before `activeId` moves, so
       *              the two never name different sites.
       *   4. swap    the store takes the new document, synchronously.
       *
       * There is no `await` between any of them, so no state in which the
       * live key and `activeId` disagree is ever observable — and `swapDoc`
       * holds the persister's pen for its own duration, so nothing it does
       * on the way through reaches the live key either.
       *
       * What this is instead of: writing the live key and calling
       * `persist.rehydrate()`, which is asynchronous and, worse, does
       * nothing at all when the target has nothing saved — see `swapDoc`.
       * That is how a blank site came to adopt the last site's work.
       */
      create: (name) => {
        get().save();
        const id = uid();
        // A new site has no slot and no document: `swapDoc(null)` is what
        // makes the board actually blank rather than whatever was on it.
        write(slot(id), null);
        write(LIVE, null);
        set((s) => ({
          projects: [{ id, name: name?.trim() || `Site ${s.projects.length + 1}`, updatedAt: Date.now() }, ...s.projects],
          activeId: id,
        }));
        swapDoc(null);
        return id;
      },

      open: (id) => {
        if (get().activeId === id) return;
        get().save();
        const held = read(slot(id));
        write(LIVE, held);
        set({ activeId: id });
        // Every panel and the canvas come back on the new document without a
        // reload, and an empty site comes back empty.
        swapDoc(held);
        carryRepos();
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
        const was = get().activeId;
        write(slot(id), null);
        set((s) => {
          const left = s.projects.filter((p) => p.id !== id);
          return { projects: left, activeId: s.activeId === id ? (left[0]?.id ?? null) : s.activeId };
        });
        /* Removing the one that was open leaves the Builder on whatever is
           next, rather than on a document with nothing behind it — and by the
           same swap the other two use, because the site it lands on may well
           be one that has never been saved. Rehydrating onto that left the
           deleted site's work on the board, and the next edit wrote it into
           the surviving site's slot. */
        if (was !== id) return;
        const next = get().activeId;
        const held = next ? read(slot(next)) : null;
        write(LIVE, held);
        swapDoc(held);
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

/** `owner/name`, or null: a repository is two words with a slash between. */
export const repoFrom = (name: string, branch = "main"): Project["repo"] | undefined => {
  const [owner, repo, more] = name.trim().split("/");
  return owner && repo && !more ? { owner, name: repo, branch: branch.trim() || "main" } : undefined;
};

/** As `owner/name`, which is how every route and every label wants it. */
export const repoLabel = (repo: Project["repo"] | undefined): string | null => (repo ? `${repo.owner}/${repo.name}` : null);

/**
 * THE ONE PLACE A SITE'S REPOSITORY IS KEPT is `project.repo`, here.
 *
 * The repository the open site points at, as `owner/name`, or null when it
 * has none. Everything that needs the answer reads it here: the GitHub
 * control, the Sites list, the Builds page, Publish, and the studio store
 * when an edit decides whether to open a branch. Null means the server's
 * own repository, which is what every publish used before there was a
 * choice, and every surface says so in words rather than showing a blank.
 */
export const activeRepo = (): string | null => repoLabel(activeProject()?.repo);

/** The same, as a hook, so a control follows a connect the moment it lands. */
export function useSiteRepo(): string | null {
  return useBuilds((s) => repoLabel(s.projects.find((p) => p.id === s.activeId)?.repo));
}

/**
 * THE COPY ACROSS, once, for sites that connected before this was the place.
 *
 * The GitHub control used to write the choice into the document itself, as
 * `siteRepo`, and a site connected that way but never published has it there
 * and nowhere else. Every project without a repository is asked whether its
 * saved document names one; the open site's document may already be in the
 * studio store rather than on disk, so its answer comes from there. The
 * branch is taken as `main`, the one thing the old field never recorded; the
 * Builds page lets it be changed. Runs after every hydration and every
 * switch, and does nothing once a project holds its own.
 */
function carryRepos(): void {
  const { projects, activeId } = useBuilds.getState();
  const fromDoc = (id: string): string | null => {
    try {
      const raw = read(id === activeId ? LIVE : slot(id));
      const was = raw ? (JSON.parse(raw) as { state?: { siteRepo?: unknown } }).state?.siteRepo : null;
      return typeof was === "string" && was.trim() ? was.trim() : null;
    } catch {
      return null;
    }
  };
  const held = takeCarriedRepo();
  let changed = false;
  const next = projects.map((p) => {
    if (p.repo) return p;
    const named = (p.id === activeId ? held : null) ?? fromDoc(p.id);
    const repo = named ? repoFrom(named) : undefined;
    if (!repo) return p;
    changed = true;
    return { ...p, repo };
  });
  if (changed) useBuilds.setState({ projects: next });
}
