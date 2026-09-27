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
import { isPointer, readDoc, readMirror, shapeOfRaw, unpackDocText, writeDocNow } from "@/features/studio/docStore";
import type { PreviewDoc } from "@/features/studio/SitePreview";

/** A hydration settled the list (`settle`), and storage does not have it yet. */
let unsettled = false;

/** Where the Builder reads and writes the document it is editing. */
const LIVE = "builder.studio";
/** Where a project that is not open keeps its own. */
const slot = (id: string) => `builder.doc:${id}`;

export interface Project {
  id: string;
  name: string;
  updatedAt: number;
  /**
   * WHERE IT PUBLISHES TO, and only that. Unset until someone says, or
   * until the first Publish makes it a repository of its own.
   */
  repo?: { owner: string; name: string; branch: string };
  /**
   * How the site came to that publish target, which is the lock: made for
   * it, or connected to it. Bound, it publishes there and nowhere else.
   *
   * "import" is only ever read, from a browser that saved before the
   * source was its own field: it meant `repo` was where the site was
   * brought in from, and `settle` turns it into `source`.
   */
  bound?: "import" | "made" | "connected";
  /**
   * WHERE IT WAS BROUGHT IN FROM. Read-only: what Bring reads, and never
   * where Publish writes. The owner's ruling: polio never writes to a
   * capture repository, so a site publishes to a repository of its own
   * and never back into the one it came from. `repo` and `source` are
   * never the same repository, and no board publishes into any board's
   * source (`settle`, `setRepo`, and the publish route all hold that).
   */
  source?: { owner: string; name: string; branch: string };
  /** The new-site offer was answered: nothing to offer again. */
  offered?: boolean;
  /** Where it went live, the last time it did. */
  live?: { url: string; at: number };
  /**
   * A deployment Go live started and has not seen end. Kept here, not in
   * the page, so a reload or a closed tab does not lose it: the Builder
   * picks it up when it opens again and records the address once it is
   * READY (`BriefDialog.tsx`, `tests/live-resume.mjs`).
   */
  pending?: { id: string; team: string | null; at: number };
}

/** What a project's document says about itself, for the row that lists it. */
export interface Shape {
  pages: number;
  parts: number;
}

interface Builds {
  projects: Project[];
  activeId: string | null;
  /**
   * The last write to this browser's storage failed, so what is on screen
   * is not what a reload brings back. A full quota is the usual cause: the
   * documents and pictures of every site share it. Said on the Builds page
   * rather than swallowed, because a setting that looks kept and is not is
   * the worst kind of lost.
   */
  saveFailed: boolean;
  /** First run: take whatever is already in the Builder rather than lose it. */
  adopt: () => void;
  create: (name?: string) => string;
  open: (id: string) => Promise<void>;
  rename: (id: string, name: string) => void;
  duplicate: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /**
   * Where a site publishes to. False, and nothing changed, when that is a
   * repository a board was brought in from. "import" sets the source
   * instead, for any caller still saying it that way.
   */
  setRepo: (id: string, repo: Project["repo"], bound?: Project["bound"]) => boolean;
  /** Where a site was brought in from. A publish target that is the same repository goes. */
  setSource: (id: string, source: Project["source"]) => void;
  /** The new site's offer was taken or declined. */
  setOffered: (id: string) => void;
  setLive: (id: string, url: string) => void;
  /** The deployment being waited on, or none. */
  setPending: (id: string, pending: Project["pending"]) => void;
  /** Write the open document back to its own slot. */
  save: () => Promise<void>;
}

/*
 * A document is read and written through docStore.ts: IndexedDB, with the
 * localStorage mirror beside it. Moving one between the live key and a slot
 * waits for IndexedDB, so a site too big for localStorage (a pointer in the
 * mirror) comes back whole when it is opened again.
 */
const read = (key: string): Promise<string | null> => Promise.resolve(readDoc(key));
const write = (key: string, value: string | null): Promise<void> => writeDocNow(key, value);

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
    const raw = readMirror(active ? LIVE : slot(id));
    /* A site too big for the mirror leaves a pointer: its shape is there (`shapeOf`), its document is not. */
    if (!raw || isPointer(raw)) return null;
    return (JSON.parse(unpackDocText(raw)) as { state?: StudioDoc }).state ?? null;
  } catch {
    return null;
  }
}

export function shapeOf(id: string, active = false): Shape {
  const shape = shapeOfRaw(readMirror(active ? LIVE : slot(id)));
  return { pages: shape?.pages ?? 0, parts: shape?.parts ?? 0 };
}

export const useBuilds = create<Builds>()(
  persist(
    (set, get) => ({
      projects: [],
      activeId: null,
      saveFailed: false,

      adopt: () => {
        if (get().projects.length) { carryRepos(); return; }
        const id = uid();
        // Whatever the Builder is holding becomes the first project, so nobody
        // opens this page and finds their work replaced by an empty list.
        set({ projects: [{ id, name: "First site", updatedAt: Date.now() }], activeId: id });
        void read(LIVE).then((held) => { if (held) return write(slot(id), held); }).then(carryRepos);
      },

      save: async () => {
        const id = get().activeId;
        if (!id) return;
        const held = await read(LIVE);
        if (held) await write(slot(id), held);
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
        const id = uid();
        /* The site being left is saved first, then the new one begins blank:
           `swapDoc(null)` is what makes the board actually blank rather than
           whatever was on it. The save is a read of IndexedDB, so the rest
           follows it. */
        void get().save().then(async () => {
          await write(slot(id), null);
          await write(LIVE, null);
          set((s) => ({
            projects: [{ id, name: name?.trim() || `Site ${s.projects.length + 1}`, updatedAt: Date.now() }, ...s.projects],
            activeId: id,
          }));
          swapDoc(null);
        });
        return id;
      },

      open: async (id) => {
        if (get().activeId === id) return;
        await get().save();
        const held = await read(slot(id));
        await write(LIVE, held);
        set({ activeId: id });
        // Every panel and the canvas come back on the new document without a
        // reload, and an empty site comes back empty.
        swapDoc(held);
        carryRepos();
      },

      rename: (id, name) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)) })),

      duplicate: async (id) => {
        await get().save();
        const from = get().projects.find((p) => p.id === id);
        if (!from) return;
        const copy = uid();
        await write(slot(copy), await read(slot(id)));
        set((s) => ({
          projects: [{ ...from, id: copy, name: `${from.name} copy`, updatedAt: Date.now(), live: undefined, pending: undefined }, ...s.projects],
        }));
      },

      remove: async (id) => {
        const was = get().activeId;
        await write(slot(id), null);
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
        const held = next ? await read(slot(next)) : null;
        await write(LIVE, held);
        swapDoc(held);
      },

      setRepo: (id, repo, bound) => {
        if (bound === "import") { get().setSource(id, repo); return true; }
        if (repo && sourceOf(repoLabel(repo)!)) return false;
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, repo, bound: repo ? (bound ?? (p.bound === "import" ? undefined : p.bound) ?? "connected") : undefined } : p)) }));
        return true;
      },

      setSource: (id, source) =>
        set((s) => ({ projects: settle(s.projects.map((p) => (p.id === id ? { ...p, source } : p))) })),

      setOffered: (id) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, offered: true } : p)) })),

      setLive: (id, url) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, live: { url, at: Date.now() } } : p)) })),

      setPending: (id, pending) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, pending } : p)) })),
    }),
    {
      name: "builder.builds",
      /* The same storage, but a write that fails is said rather than lost:
         the persister swallows the throw, and a list that reads as kept
         and comes back as before on reload was the report from the field.
         Only a change of outcome sets state, so a failing write does not
         set, persist, fail and set again without end. */
      storage: createJSONStorage(() => ({
        getItem: (k) => localStorage.getItem(k),
        removeItem: (k) => localStorage.removeItem(k),
        setItem: (k, v) => {
          let failed = false;
          try { localStorage.setItem(k, v); } catch { failed = true; }
          if (useBuilds.getState().saveFailed !== failed) useBuilds.setState({ saveFailed: failed });
        },
      })),
      partialize: (s) => ({ projects: s.projects, activeId: s.activeId }) as Builds,
      /* The source a site was brought in from is its own field. A browser
         that saved before that has sites whose `repo` is where they came
         from, and they are read as brought in from it, on every hydration.
         Not a version bump: an older build reading a list saved by this one
         would drop a list with a version it does not know, and with it
         every site's name; read by an older build, a settled site simply
         has no repository yet. */
      merge: (persisted, current) => {
        const was = (persisted ?? {}) as Partial<Builds>;
        const list = Array.isArray(was.projects) ? was.projects : current.projects;
        const projects = settle(list);
        /* Written back by `carryRepos`, which runs after every hydration. */
        if (projects.some((p, i) => p !== list[i])) unsettled = true;
        return { ...current, ...was, projects };
      },
      skipHydration: true,
    },
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

const sameRepo = (a: Project["repo"] | undefined, b: Project["repo"] | undefined) =>
  !!a && !!b && repoLabel(a)!.toLowerCase() === repoLabel(b)!.toLowerCase();

/**
 * THE ONE RULE, APPLIED TO A LIST OF SITES.
 *
 *   1. A site bound by "import" was brought in from its `repo`: that is its
 *      source, and it has no publish target until its first Publish makes
 *      one. This is how a board saved before the split reads after it.
 *   2. No site keeps a publish target that is any site's source, its own
 *      included. It is taken off, and the next Publish makes one of its own.
 *
 * Run on every hydration (`merge`, and `carryRepos` after it) and on every
 * source written, so there is no state in which a board is aimed at a
 * repository a board came from.
 */
export function settle(projects: Project[]): Project[] {
  const read = projects.map((p) =>
    p.bound === "import" ? { ...p, source: p.source ?? p.repo, repo: undefined, bound: undefined } : p,
  );
  const sources = read.map((p) => p.source).filter(Boolean);
  return read.map((p) => (p.repo && sources.some((s) => sameRepo(s, p.repo)) ? { ...p, repo: undefined, bound: undefined } : p));
}

/**
 * The site a repository was brought in from, if any, its own included. No
 * site may publish there: that is the capture, and polio never writes to it.
 */
export const sourceOf = (name: string): Project | null => {
  const want = name.trim().toLowerCase();
  return useBuilds.getState().projects.find((p) => p.source && repoLabel(p.source)!.toLowerCase() === want) ?? null;
};

/** Every repository a site in this browser was brought in from, as `owner/name`. The publish route refuses each. */
export const allSources = (): string[] =>
  [...new Set(useBuilds.getState().projects.map((p) => repoLabel(p.source)).filter((r): r is string => !!r))];

/** Where the open site was brought in from, as `owner/name`, or null. What Bring reads. */
export const activeSource = (): string | null => repoLabel(activeProject()?.source);

/**
 * THE ONE PLACE A SITE'S PUBLISH TARGET IS KEPT is `project.repo`, here.
 *
 * The repository the open site publishes to, as `owner/name`, or null when
 * it has none yet. Everything that needs the answer reads it here: the
 * GitHub control, the Sites list, the Builds page, Publish, and the studio
 * store when an edit decides whether to open a branch. Null means the first
 * Publish makes it a repository of its own, and every surface says so in
 * words rather than showing a blank. Where it was brought in from is
 * `project.source`, which nothing publishes to.
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
      return shapeOfRaw(readMirror(id === activeId ? LIVE : slot(id)))?.siteRepo ?? null;
    } catch {
      return null;
    }
  };
  const held = takeCarriedRepo();
  let changed = false;
  const carried = projects.map((p) => {
    if (p.repo) return p;
    const named = (p.id === activeId ? held : null) ?? fromDoc(p.id);
    const repo = named ? repoFrom(named) : undefined;
    if (!repo) return p;
    changed = true;
    return { ...p, repo };
  });
  /* Nothing carried, and nothing already held, may aim a site at a
     repository a site was brought in from. */
  const next = settle(carried);
  if (changed || unsettled || next.some((p, i) => p !== carried[i])) { unsettled = false; useBuilds.setState({ projects: next }); }
}
