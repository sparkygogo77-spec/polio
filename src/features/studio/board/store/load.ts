"use client";
import { persist } from "zustand/middleware";
import { useLayoutEffect } from "react";
import { behind, holdStamp, idbGet, isPointer, movedIn, readMirror, stampOf, tookFromOtherTab, unpackDocText, whenOtherTabWrites } from "../../docStore";
import { PRISTINE, dropHere, onKeptBack, tookHere, unsavedHere, useStudio, writeHere } from "./create";
import { migrateKey, pen, shelve } from "./history";
import { StudioNode, StudioShape } from "./model";
import { mergeDoc } from "./persist";
import { wearAgain } from "../../states";
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


export function swapDoc(raw: string | null, live = false): void {
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
      /* A state worn on the board is worn on this one's parts, or on none: never taken off one site against another's look (`states/stateEdits.ts#wearAgain`). */
      nodes: wearAgain(doc.nodes),
      /* Not the document, and all of it about the site being left: a
         selection of parts that no longer exist, and an undo history that
         would step this site's board back into the last one's. */
      selection: [],
      past: [],
      future: [],
    });
    /* The same two things `onRehydrateStorage` does after a read, because
       this is a read — it just did not come through the persister. A
       document another tab is still working on (`live`) keeps its running
       threads: they are running there. */
    const now = useStudio.getState();
    shelve(now.brought ?? [], now.broughtParts ?? []);
    if (!live && now.threads.some((t) => t.state === "running")) {
      useStudio.setState({ threads: now.threads.map((t) => (t.state === "running" ? { ...t, state: "cut" as const } : t)) });
    }
  } finally {
    pen.swapping = false;
  }
  /* A site opened in this tab is the one it holds now: nothing from another tab is pending over it, and what was kept back belonged to the site it left. */
  if (!live) { dropHere(); setOther(null); heard = false; }
}

/* ------------------------------------------------------------------ */
/* Another tab                                                         */
/* ------------------------------------------------------------------ */

/*
 * ANOTHER TAB SAVED THIS SITE.
 *
 * Every tab in this browser holds the same key, and a tab stops writing the
 * moment another has saved since it read (`create.ts#keptOnly`). Then:
 *
 *   - with nothing of its own unsaved, it takes the newer document: when it is
 *     looked at again (shown, focused, pressed) or, while it is on screen,
 *     once the other tab has been quiet a moment. A tab left open since the
 *     morning shows the newer work when he comes back to it, and a preview
 *     open beside the board follows it. One that is out of sight takes it
 *     when it comes back, rather than drawing the board again on every
 *     letter typed in the other.
 *   - with a change of its own that could not be saved: "newer". Nothing is
 *     written until he picks the newer work or this tab's (`SaveLine.tsx`).
 *   - when the other tab opened a different site: "moved". Nothing is
 *     written, the site list included; reloading puts this tab on that site,
 *     and so does a site action here before it does anything else
 *     (`builds/store.ts#caughtUp`).
 */
export type OtherTab = null | "newer" | "moved";
const LIVE = "builder.studio";
/** How long the other tab is quiet before a tab on screen takes its work: once a burst of edits, not once a letter. */
const QUIET_MS = 400;
let other: OtherTab = null;
/** Another tab has written since this one last caught up: a look at this tab is worth a check of the key. */
let heard = false;
let quiet: ReturnType<typeof setTimeout> | null = null;
let tries = 0;
const otherListeners = new Set<() => void>();
function setOther(v: OtherTab): void {
  if (other === v) return;
  other = v;
  for (const fn of otherListeners) { try { fn(); } catch { /* its own trouble */ } }
}
/** What another tab has done that this tab must wait on him for: nothing, newer work over unsaved changes here, or another site. */
export const otherTab = (): OtherTab => other;
export function onOtherTab(fn: () => void): () => void {
  otherListeners.add(fn);
  return () => { otherListeners.delete(fn); };
}

const hiddenNow = () => typeof document !== "undefined" && document.hidden === true;
/** The key now holds a site this tab did not open: moved in by another tab, or emptied for a new one. */
function movedNow(): boolean {
  const raw = readMirror(LIVE);
  return raw === null || movedIn(stampOf(raw));
}

/** Take the newer document when there is one and nothing of this tab's would be lost by it. */
function catchUp(): void {
  if (quiet) { clearTimeout(quiet); quiet = null; }
  if (!heard || other || pen.visitor || !pen.read) return;
  if (!behind(LIVE)) { heard = false; return; }
  if (movedNow()) { setOther("moved"); return; }
  if (unsavedHere()) { setOther("newer"); return; }
  const raw = readMirror(LIVE)!;
  if (!isPointer(raw)) { take(unpackDocText(raw)); return; }
  /* Too big for the mirror: IndexedDB has it once the other tab's write lands there, a moment after its pointer. */
  void idbGet(LIVE).then((text) => {
    if (text !== null && stampOf(text) === stampOf(readMirror(LIVE))) { tries = 0; take(text); return; }
    if (++tries < 40) quiet = setTimeout(catchUp, 250);
  });
}
function take(text: string): void {
  if (other || !behind(LIVE)) return;
  if (unsavedHere()) { setOther("newer"); return; }
  swapDoc(text, true);
  tookHere();
  tookFromOtherTab(LIVE, text);
  heard = false;
}

/** Another tab wrote the key. */
function otherWrote(): void {
  if (pen.visitor || !pen.read || !behind(LIVE)) return;
  heard = true;
  if (movedNow()) { setOther("moved"); return; }
  if (unsavedHere()) { setOther("newer"); return; }
  if (quiet) clearTimeout(quiet);
  quiet = hiddenNow() ? null : setTimeout(catchUp, QUIET_MS);
}

let watching = false;
/** From the first hydration on: hear the other tabs, and catch up when this one is looked at. */
export function watchOtherTabs(): void {
  if (!watching && typeof window !== "undefined") {
    watching = true;
    whenOtherTabWrites(LIVE, otherWrote);
    /* A change refused here while behind is the moment to say so, not the next look. */
    onKeptBack(() => { if (behind(LIVE)) setOther(movedNow() ? "moved" : "newer"); });
    const look = () => { if (!hiddenNow()) catchUp(); };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", look);
    window.addEventListener("focus", look);
    window.addEventListener("pointerdown", look, true);
    window.addEventListener("keydown", look, true);
  }
  /* A write that landed while this tab was reading is newer than what it read. */
  if (pen.read && behind(LIVE)) otherWrote();
}

/** His pick: the newer work from the other tab; what was changed here and not saved is let go. */
export function loadNewer(): void {
  dropHere();
  setOther(null);
  heard = true;
  catchUp();
}
/**
 * A site action in a tab another tab moved to a different site
 * (`builds/store.ts#caughtUp`): it takes the site the key holds now, as a
 * reload would, but with that tab's running updates still running there.
 */
export function takeOpenSite(raw: string | null): void {
  swapDoc(raw, true);
  tookHere();
  holdStamp(LIVE, raw);
  setOther(null);
  heard = false;
}
/** His pick: this tab's document, saved over what the other tab saved. */
export function keepThisTab(): void {
  if (other === "moved") return;
  /* What is there now is what this tab writes over, knowingly. */
  holdStamp(LIVE, readMirror(LIVE));
  setOther(null);
  heard = false;
  writeHere();
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
    /* …and from then on the other tabs on this browser are heard (`watchOtherTabs`). */
    const sweep = () => { useStudio.getState().sweepDocument(); watchOtherTabs(); };
    if (useStudio.persist.hasHydrated()) { sweep(); return; }
    /* Hydration may resolve after this surface's own effects have run, so
       what the sweep did is put in the document's state and watched for
       rather than handed back here — see `sweepNote`. */
    void Promise.resolve(useStudio.persist.rehydrate()).then(sweep);
  }, []);
}

/**
 * A Preview that opened in a tab of its own looks and never writes.
 *
 * "Open the site in a new tab" gives a second tab with its own copy of the
 * document, read once as it opened, while he goes on editing in the Builder
 * tab. That copy never showed his later edits, and turning a cube in it
 * wrote the older copy back over the newer one. So a tab that opened on the
 * Preview holds `pen.lookingOnly`, reads the document again whenever the
 * Builder saves (the `storage` event) or he comes back to the tab, and on
 * leaving for the Builder in that same tab reads it once more before it may
 * write. A Preview reached inside the Builder's own tab shares its document
 * and keeps saving, as before.
 *
 * Call it before `useStudioHydration`: whether the tab opened here is
 * whether nothing has read the document yet.
 */
export function useLookingOnly() {
  useLayoutEffect(() => {
    if (pen.lookingOnly || useStudio.persist.hasHydrated()) return;
    pen.lookingOnly = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    /* A moment late: the Builder's write reaches IndexedDB a little after the mirror. */
    const again = () => { clearTimeout(timer); timer = setTimeout(() => { void useStudio.persist.rehydrate(); }, 300); };
    const onStorage = (e: StorageEvent) => { if (e.key === useStudio.persist.getOptions().name) again(); };
    const onShow = () => { if (document.visibilityState === "visible") again(); };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onShow);
      void Promise.resolve(useStudio.persist.rehydrate()).finally(() => { pen.lookingOnly = false; });
    };
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
