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
  source?: { owner: string; name: string; branch: string; dir?: string | null };
  /**
   * Made with New site and not yet opened: the Builder builds its sample page
   * in a theme of its own the first time it opens it (`newSite.ts`), and
   * clears this. The Builds page cannot: the board is not loaded there.
   */
  starter?: boolean;
  /** The new-site offer was answered: nothing to offer again. */
  offered?: boolean;
  /**
   * Where it went live, the last time it did, and Vercel's own page for
   * that deployment when the publish brought one back (`inspectorUrl`).
   */
  live?: { url: string; at: number; inspectorUrl?: string | null };
  /**
   * When a person last changed the board (`builds/edits.ts`): an edit, an
   * undo, a redo. Kept here, beside the name, so the Builds page can say
   * whether there are changes not yet published without reading the
   * document. Absent on a site nobody has changed since this was kept.
   */
  editedAt?: number;
  /** When this site was last downloaded as a backup file (`studio/backup.ts`). */
  backedUpAt?: number;
  /** The one reminder to back it up or publish it has been shown. */
  nudged?: boolean;
  /**
   * A deployment Go live started and has not seen end. Kept here, not in
   * the page, so a reload or a closed tab does not lose it: the Builder
   * picks it up when it opens again and records the address once it is
   * READY (`BriefDialog.tsx`, `tests/live-resume.mjs`).
   */
  pending?: { id: string; team: string | null; at: number };
  /**
   * The last push that went through from this site: where, and when. It is
   * what decides which site keeps a publish target two sites name
   * (`sharedTarget`); `live.at` stands in for a site that published before
   * this was kept.
   */
  published?: {
    at: number; repo: string; branch: string;
    /** The commit the push made, and its page on GitHub: what the publish itself answered, nothing asked again. */
    sha?: string; commitUrl?: string;
    /** The board's `editedAt` when its pages were written for this push: a later edit is not in it. */
    editedAt?: number;
  };
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
  /** A new site. `starter`: it opens on a sample page in a theme of its own (`newSite.ts`), as the Builds page's New site does. */
  create: (name?: string, opts?: { starter?: boolean }) => string;
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
  setLive: (id: string, url: string, inspectorUrl?: string | null) => void;
  /** A person changed the open board at this time. */
  setEdited: (id: string, at: number) => void;
  /** It was downloaded as a backup just now. */
  setBackedUp: (id: string) => void;
  /** The reminder to back it up has been shown, and is not shown again. */
  setNudged: (id: string) => void;
  /** A site read out of a backup file, as a new site beside the rest (`studio/backup.ts`). Its id. */
  restore: (p: Omit<Project, "id">, raw: string) => Promise<string>;
  /** The deployment being waited on, or none. */
  setPending: (id: string, pending: Project["pending"]) => void;
  /** A push from this site went through, to this repository and branch. */
  setPublished: (id: string, repo: string, branch: string, more?: { sha?: string; commitUrl?: string; editedAt?: number }) => void;
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

/**
 * The document of a site too big for the mirror, out of IndexedDB where it
 * lives. `docOf` answers null for those (the mirror holds only a pointer),
 * and the Builds card read that null as "nothing in it yet": StonkFun,
 * gotchi and parasiteonsol.fun, thousands of parts each
 * (`tests/builds-publish-state.mjs`). Null when there is nothing to read.
 */
export async function docOfStored(id: string, active = false): Promise<StudioDoc | null> {
  try {
    const raw = await readDoc(active ? LIVE : slot(id));
    if (!raw) return null;
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
      create: (name, opts) => {
        const id = uid();
        /* The site being left is saved first, then the new one begins blank:
           `swapDoc(null)` is what makes the board actually blank rather than
           whatever was on it. The save is a read of IndexedDB, so the rest
           follows it. */
        void get().save().then(async () => {
          await write(slot(id), null);
          await write(LIVE, null);
          set((s) => ({
            projects: [{ id, name: name?.trim() || `Site ${s.projects.length + 1}`, updatedAt: Date.now(), ...(opts?.starter ? { starter: true } : {}) }, ...s.projects],
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
          /* A copy never shares its original's publish target: two sites on
             one repository and branch replace each other's live site. Its
             first publish makes a repository of its own (`sharedTarget`). */
          projects: [{ ...from, id: copy, name: `${from.name} copy`, updatedAt: Date.now(), live: undefined, pending: undefined, published: undefined, repo: undefined, bound: undefined, backedUpAt: undefined, nudged: undefined }, ...s.projects],
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
        /* Never a target another site already publishes to: one press would replace that site's live site. */
        if (repo && targetTakenBy(id, repo)) return false;
        set((s) => ({ projects: settle(s.projects.map((p) => (p.id === id ? { ...p, repo, bound: repo ? (bound ?? (p.bound === "import" ? undefined : p.bound) ?? "connected") : undefined } : p))) }));
        return true;
      },

      setSource: (id, source) =>
        set((s) => ({ projects: settle(s.projects.map((p) => (p.id === id ? { ...p, source } : p))) })),

      setOffered: (id) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, offered: true } : p)) })),

      setLive: (id, url, inspectorUrl) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, live: { url, at: Date.now(), ...(inspectorUrl ? { inspectorUrl } : {}) } } : p)) })),

      setEdited: (id, at) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, editedAt: at } : p)) })),

      setBackedUp: (id) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, backedUpAt: Date.now() } : p)) })),

      setNudged: (id) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, nudged: true } : p)) })),

      /* Beside the others, never over one: a backup loaded is a new site, and the one open stays as it is. */
      restore: async (p, raw) => {
        const id = uid();
        await write(slot(id), raw);
        set((s) => ({ projects: [{ ...p, id, updatedAt: Date.now() }, ...s.projects] }));
        return id;
      },

      setPending: (id, pending) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, pending } : p)) })),

      setPublished: (id, repo, branch, more) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, published: { at: Date.now(), repo, branch, ...(more ?? {}) } } : p)) })),
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
export const repoLabel = (repo: (Project["repo"] & { dir?: string | null }) | undefined): string | null => (repo ? `${repo.owner}/${repo.name}${repo.dir ? `/${repo.dir}` : ""}` : null);

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
  return read
    .map((p) => (p.repo && sources.some((s) => sameRepo(s, p.repo)) ? { ...p, repo: undefined, bound: undefined } : p))
    .map((p) => {
      /* A site still on its stand-in name ("Site 10") takes the name of the
         site it was brought in from, or else the repository it publishes to.
         A name someone typed is never touched. */
      const real = defaultName(p.name) ? realName(p) : null;
      return real ? { ...p, name: real } : p;
    });
}

/** The name `create` gives a site nobody named: "Site 3". */
export const defaultName = (name: string): boolean => /^Site \d+$/.test(name.trim());

/** What a site is really called: the folder or repository it came from, or the one it publishes to. */
export const realName = (p: Pick<Project, "source" | "repo">): string | null => {
  const dir = p.source?.dir?.split("/").filter(Boolean).pop();
  return dir || p.source?.name || p.repo?.name || null;
};

/**
 * The site a repository was brought in from, if any, its own included. No
 * site may publish there: that is the capture, and polio never writes to it.
 */
/*
 * By the REPOSITORY, not the label. A site brought in from a folder of a
 * repo (`owner/sink/sites/name`) has that whole repo as its capture, and its
 * label with the folder on it matched neither `owner/sink` here nor the
 * publish route's `owner/name` check, so the repo it came from could be
 * picked as a publish target (`tests/repo-menu.mjs`).
 */
const repoOnly = (label: string): string => label.trim().replace(/@.*$/, "").split("/").slice(0, 2).join("/").toLowerCase();
export const sourceOf = (name: string): Project | null => {
  const want = repoOnly(name);
  return useBuilds.getState().projects.find((p) => p.source && `${p.source.owner}/${p.source.name}`.toLowerCase() === want) ?? null;
};

/** Every repository a site in this browser was brought in from, as `owner/name` (never with its folder). The publish route refuses each. */
export const allSources = (): string[] =>
  [...new Set(useBuilds.getState().projects.flatMap((p) => (p.source ? [`${p.source.owner}/${p.source.name}`] : [])))];

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

/*
 * TWO SITES NEVER SHARE A PUBLISH TARGET.
 *
 * A target is a repository and a branch. Two sites naming the same one
 * replace each other's live site with every press: SOLCINERATOR and
 * Trump & Morty both named sparkygogo77-spec/trump-morty-trorty on main, so
 * one press on SOLCINERATOR would have put it up in place of Trump & Morty.
 *
 * The site that last published there keeps it (its `published`, or `live`
 * for a site that published before that was kept) and every other site
 * naming it is held back, with the name of the one that keeps it. When none
 * of them has published there, none may until one of them is given another
 * target: there is no fair way to pick. Nothing here changes a site's
 * stored target; the owner chooses.
 */

/** A target as one comparable string: `owner/name@branch`, lower case. */
export const targetKey = (repo: Project["repo"] | undefined): string | null =>
  repo ? `${repo.owner}/${repo.name}@${repo.branch || "main"}`.toLowerCase() : null;

/** When a site last published to its current target, or 0. */
export function lastPublishedTo(p: Project): number {
  const key = targetKey(p.repo);
  if (!key) return 0;
  if (p.published && `${p.published.repo}@${p.published.branch}`.toLowerCase() === key) return p.published.at;
  if (p.published) return 0;
  return p.live?.at ?? 0;
}

export interface SharedTarget {
  /** `owner/name`, and the branch, as the words say them. */
  repo: string;
  branch: string;
  /** The site that keeps the target, or null when none of them has published there. */
  keeper: Project | null;
  /** Every other site naming the same target. */
  others: Project[];
}

/** The target `id` shares with another site, or null when it is its own. */
export function sharedTarget(projects: Project[], id: string | null | undefined): SharedTarget | null {
  const me = projects.find((p) => p.id === id);
  const key = targetKey(me?.repo);
  if (!me || !key) return null;
  const all = projects.filter((p) => targetKey(p.repo) === key);
  if (all.length < 2) return null;
  const ranked = [...all].sort((a, b) => lastPublishedTo(b) - lastPublishedTo(a));
  const top = ranked[0]!;
  const keeper = lastPublishedTo(top) > 0 && lastPublishedTo(top) !== lastPublishedTo(ranked[1]!) ? top : null;
  return { repo: `${me.repo!.owner}/${me.repo!.name}`, branch: me.repo!.branch || "main", keeper, others: all.filter((p) => p.id !== me.id) };
}

/** Why this site may not publish to its target, in plain words, or null when it may. */
export function sharedTargetSays(projects: Project[], id: string | null | undefined): string | null {
  const shared = sharedTarget(projects, id);
  if (!shared || shared.keeper?.id === id) return null;
  const where = `${shared.repo} on ${shared.branch}`;
  const how = "Choose another repository or branch for this site in the repository menu (the GitHub button) or on Builds, Repos";
  if (shared.keeper) return `${shared.keeper.name} already publishes to ${where}, so Update live site is off for this site: it would replace ${shared.keeper.name}'s live site. ${how}.`;
  const list = [projects.find((p) => p.id === id)?.name, ...shared.others.map((p) => p.name)].filter(Boolean) as string[];
  return `${list.join(" and ")} ${list.length === 2 ? "both" : "all"} publish to ${where}, and none has published there yet, so Update live site is off for each until one of them has another target. ${how}.`;
}

/** The site that already publishes to this target, when it is not `id`. */
export function targetTakenBy(id: string, repo: Project["repo"]): Project | null {
  const key = targetKey(repo);
  return useBuilds.getState().projects.find((p) => p.id !== id && targetKey(p.repo) === key) ?? null;
}

/** The same, as a hook: why the open site may not publish, or null. */
export function useSharedTargetSays(id?: string | null): string | null {
  return useBuilds((s) => sharedTargetSays(s.projects, id === undefined ? s.activeId : id));
}

/*
 * THE WORDS FOR WHERE A SITE GOES, IN ONE PLACE. The repository menu and
 * Builds, Repos said it two ways ("Publish pushes this site to…", a big name
 * with "on main" under it); both read these now.
 */
export function targetWords(p: Project | null | undefined): string {
  if (!p?.repo) return "No repository of its own yet. The first Update live site makes a private one named after this site.";
  return `Update live site writes to ${p.repo.owner}/${p.repo.name} on ${p.repo.branch || "main"}.`;
}

/** Where it was brought in from, and that nothing is written back there. */
export function sourceWords(p: Project | null | undefined): string | null {
  return p?.source ? `Brought in from ${repoLabel(p.source)}; Update live site never writes to it.` : null;
}
