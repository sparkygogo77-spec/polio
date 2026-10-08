"use client";
/**
 * The learned library, kept builder-wide (`learned.ts` says what is in it).
 *
 * One record under `builder.learned`, stored the way boards are stored
 * (`docStore.ts`: this browser's IndexedDB, with a mirror for a quick
 * read), not inside any board: switching boards, opening another, or
 * removing the one a site came in on leaves it as it is. Forgetting a site
 * is the person's own press, on "Learned from your sites".
 *
 * Every import is read for it: the store's `loadDoc` (the one door every
 * import, re-import and backup comes through) says a document arrived, and
 * once the import has finished landing (swept, its palette tied) the board
 * is read and its site's entry replaced. A board that was not brought in
 * from a site teaches nothing and changes nothing.
 */
import { create } from "zustand";
import { readDoc, writeDoc } from "../docStore";
import { useStudio } from "../store";
import type { SavedComponent } from "./components";
import { sitePanels, withSitePanels } from "./fromSites";
import { emptyLibrary, learnFromBoard, mergeLibraries, readLibrary, withComponent, withoutComponent, withSite, withoutSite, type LearnedLibrary, type LearnedSite } from "./learned";

export const LEARNED_KEY = "builder.learned";
/** The event `loadDoc` sends, with what the document said about its page's behaviour. */
export const DOC_LOADED = "studio:doc-loaded";

interface LearnedState {
  lib: LearnedLibrary;
  ready: boolean;
  /** The site learned last, and when, for the line that says so. */
  last: { host: string; at: number } | null;
  learn: (site: LearnedSite) => void;
  forget: (host: string) => void;
  /** A library brought in (a backup): merged, the newer learning of each site winning. */
  take: (lib: LearnedLibrary) => void;
  /** A component saved whole (`components.ts`), builder-wide, and one taken off the shelf. */
  saveComponent: (c: SavedComponent) => void;
  removeComponent: (id: string) => void;
  /** A site's hooked panels, kept for the "From your sites" shelf (`fromSites.ts`), replacing the ones kept last time. */
  keepPanels: (host: string, panels: SavedComponent[]) => void;
}

const save = (lib: LearnedLibrary) => { try { writeDoc(LEARNED_KEY, JSON.stringify(lib)); } catch { /* kept for this visit */ } };

export const useLearned = create<LearnedState>()((set, get) => ({
  lib: emptyLibrary(),
  ready: false,
  last: null,
  learn: (site) => { const lib = withSite(get().lib, site); save(lib); set({ lib, last: { host: site.host, at: site.at } }); },
  forget: (host) => { const lib = withoutSite(get().lib, host); save(lib); set({ lib }); },
  take: (incoming) => { const lib = mergeLibraries(get().lib, incoming); save(lib); set({ lib }); },
  saveComponent: (c) => { const lib = withComponent(get().lib, c); save(lib); set({ lib }); },
  removeComponent: (id) => { const lib = withoutComponent(get().lib, id); save(lib); set({ lib }); },
  keepPanels: (host, panels) => { const lib = withSitePanels(get().lib, host, panels); save(lib); set({ lib }); },
}));

/* ------------------------------------------------------------------ reading it back */
if (typeof window !== "undefined") {
  const got = (raw: string | null) => {
    let parsed: unknown = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
    /* Whatever was learned in this visit before the read came back is kept beside it. */
    const lib = mergeLibraries(readLibrary(parsed), useLearned.getState().lib);
    useLearned.setState({ lib, ready: true });
  };
  try {
    const raw = readDoc(LEARNED_KEY);
    if (raw instanceof Promise) void raw.then(got, () => got(null)); else got(raw);
  } catch { got(null); }

  /* ------------------------------------------------------------------ learning on every import */
  window.addEventListener(DOC_LOADED, (e) => {
    const behaviours = (e as CustomEvent<{ behaviours?: Record<string, unknown> | null }>).detail?.behaviours ?? null;
    /* After the import has finished landing: the sweep and the palette run in the same task as the load. */
    window.setTimeout(() => {
      const s = useStudio.getState();
      const site = learnFromBoard({ nodes: s.nodes as unknown as Record<string, unknown>[], look: s.look as never, brief: s.brief, pages: s.pages }, behaviours);
      if (site) useLearned.getState().learn(site);
      if (site) useLearned.getState().keepPanels(site.host, sitePanels({ nodes: s.nodes as unknown as Record<string, unknown>[], look: s.look as never }, site.host));
    }, 0);
  });
}

/** The library as it stands, for a backup. */
export const learnedNow = (): LearnedLibrary => useLearned.getState().lib;
