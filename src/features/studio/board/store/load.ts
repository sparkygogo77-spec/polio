"use client";
import { persist } from "zustand/middleware";
import { useLayoutEffect } from "react";
import { PRISTINE, useStudio } from "./create";
import { migrateKey, pen, shelve } from "./history";
import { StudioNode, StudioShape } from "./model";
import { mergeDoc } from "./persist";
import type { StudioState } from "./state";


/**
 * Put a site's saved document into the store, synchronously.
 *
 * WHAT THIS REPLACES AND WHY. Switching sites used to copy the target's
 * document into the live key and call `persist.rehydrate()`. That works for
 * a site that has something saved and does nothing at all for one that does
 * not: zustand only runs `merge` when there IS persisted state, so
 * rehydrating from nothing leaves the store exactly as it was — still
 * holding the last site's work. Measured: three sites, one part each, and
 * the third site's slot came back reading `waypoint,split-screen` when
 * `split-screen` was the only part ever made on it. The board showed the
 * previous site's work, and the first edit wrote it out under the new site's
 * name. An empty slot cannot overwrite a full store.
 *
 * So the load does not go through the persister at all. It is synchronous —
 * no await anywhere in it, so nothing can observe the store mid-swap — and
 * it merges onto PRISTINE rather than onto the live state, which is the part
 * that actually matters: merging onto the live state is precisely how the
 * last site shows through wherever this document is silent.
 *
 * `raw` is the stored envelope as it sits in local storage, or null for a
 * site that has never been saved. Null is not a failure; it is the answer,
 * and the answer is a blank board.
 */
/**
 * Where a Bring began in the undo history (`historyMark`), taken by the
 * import when it lands: the space the Bring placed, the board it replaced
 * and everything the landing does are then one undo step.
 */
export let importMark: number | null = null;
export function holdImportMark(mark: number): void { importMark = mark; }
export function takeImportMark(): number | null { const m = importMark; importMark = null; return m; }


export function swapDoc(raw: string | null): void {
  pen.swapping = true;
  try {
    /* A fresh copy every time: `mergeDoc` may hand parts of the base
       straight through, and PRISTINE must stay the thing it was. */
    const blank = JSON.parse(JSON.stringify(PRISTINE)) as Partial<StudioState>;
    const base = { ...useStudio.getState(), ...blank } as StudioState;
    let doc: StudioState = base;
    if (raw) {
      try {
        const env = JSON.parse(raw) as { state?: unknown };
        doc = mergeDoc(env?.state ?? null, base);
      } catch {
        /* A slot that will not parse is a slot with nothing readable in it.
           A blank board is the honest answer; the bad text is left where it
           is rather than tidied away, so it can still be looked at. */
        doc = base;
      }
    }
    useStudio.setState({
      ...doc,
      /* Not the document, and all of it about the site being left: a
         selection of parts that no longer exist, and an undo history that
         would step this site's board back into the last one's. */
      selection: [],
      past: [],
      future: [],
    });
    /* The same two things `onRehydrateStorage` does after a read, because
       this is a read — it just did not come through the persister. */
    const now = useStudio.getState();
    shelve(now.brought ?? [], now.broughtParts ?? []);
    if (now.threads.some((t) => t.state === "running")) {
      useStudio.setState({ threads: now.threads.map((t) => (t.state === "running" ? { ...t, state: "cut" as const } : t)) });
    }
  } finally {
    pen.swapping = false;
  }
}

/* ------------------------------------------------------------------ */
/* Derived selectors                                                   */
/* ------------------------------------------------------------------ */

/**
 * These build a new array on every call, so components MUST subscribe through
 * `useShallow` — zustand v5 compares snapshots by reference, and a fresh array
 * each render is an infinite re-render loop.
 *
 *   const nodes = useStudio(useShallow(pageNodes));
 */
export const pageNodes = (s: StudioState) => s.nodes.filter((n) => n.pageId === s.activePageId);
export const pageShapes = (s: StudioState) => s.shapes.filter((sh) => sh.pageId === s.activePageId);
export const pageSpaces = (s: StudioState) => s.spaces.filter((sp) => sp.pageId === s.activePageId);
export const pageGroups = (s: StudioState) => s.groups.filter((g) => g.pageId === s.activePageId);
export const activePage = (s: StudioState) => s.pages.find((p) => p.id === s.activePageId) ?? s.pages[0]!;

export function groupBounds(nodes: StudioNode[], groupId: string) {
  const members = nodes.filter((n) => n.groupId === groupId);
  if (!members.length) return null;
  const x = Math.min(...members.map((n) => n.x));
  const y = Math.min(...members.map((n) => n.y));
  const x2 = Math.max(...members.map((n) => n.x + n.w));
  const y2 = Math.max(...members.map((n) => n.y + n.h));
  return { x, y, w: x2 - x, h: y2 - y, members };
}

export function shapeBounds(shape: StudioShape) {
  const xs = shape.points.map((p) => p[0]);
  const ys = shape.points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/* ------------------------------------------------------------------ */
/* Hydration                                                           */
/* ------------------------------------------------------------------ */

/** Two surfaces mounting must not both try the sweep on one page load. */
export let sweeping = false;

/**
 * The store skips hydration so server and first client render agree; every
 * Builder surface calls this once so the saved document comes back before the
 * board's own effects write anything. A layout effect runs before children's
 * passive effects (the board's fit-to-view), which is what makes it safe.
 *
 * AND THE SWEEP GOES HERE, for the same reason: it must see the document as
 * it was saved. His words about boxes coming out wrong were "it should be
 * done automatically properly", and a board captured before the rebuilds
 * existed sat unchanged until somebody pressed two commands on each of nine
 * pages. It runs once per document, over every page, under one undo — see
 * `sweepDocument`.
 *
 * Before the healing rather than after, and that is deliberate: the healing
 * only ever runs for the page on screen, so a sweep that waited for it would
 * judge the open page by settled heights and the other eight by captured
 * ones, and give a different answer per page for no reason a person could
 * see. Reading the document as it was saved is the same answer everywhere.
 */
export function useStudioHydration() {
  useLayoutEffect(() => {
    migrateKey("polio.studio", "builder.studio");
    if (sweeping) return;
    sweeping = true;
    const sweep = () => { useStudio.getState().sweepDocument(); };
    if (useStudio.persist.hasHydrated()) { sweep(); return; }
    /* Hydration may resolve after this surface's own effects have run, so
       what the sweep did is put in the document's state and watched for
       rather than handed back here — see `sweepNote`. */
    void Promise.resolve(useStudio.persist.rehydrate()).then(sweep);
  }, []);
}

/**
 * The live preview address for a page; the home page has no suffix. The
 * published site (/site) passes its own base, so a visitor's page link stays
 * on the site instead of landing in the Builder's preview.
 */
export function livePath(pageId?: string, base = "/builder/preview"): string {
  const s = useStudio.getState();
  const page = s.pages.find((p) => p.id === (pageId ?? s.activePageId)) ?? s.pages[0];
  const path = page?.path ?? "/";
  return base + (path === "/" ? "" : path);
}
