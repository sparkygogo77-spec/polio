"use client";
/**
 * THE BOARD AS IT WAS BROUGHT IN, KEPT, SO REFRESH CAN PUT IT BACK.
 *
 * J (2026-10-09): "i use the refresh button and clear and bring in too often
 * which does the whole process again ... considering there are no actual
 * changes via a code chat that i really need to bring in, within this
 * refresh button should be another option to properly reset back to the
 * most recent bring in which clears but doesnt necessarily bring anything
 * NEW in".
 *
 * So every bring-in keeps a copy of the board as it landed (`keepLastBring`,
 * called by both landings in `FromASite.tsx`), per site, in IndexedDB beside
 * the document (`docStore.ts`). The pictures and screens a bring-in reads in
 * the background land after it; until the first edit of his own, the copy
 * follows them, so it is the board as the bring-in finished. Refresh's
 * "Reset to last bring-in" puts the copy back as one undo step, with nothing
 * read from GitHub.
 *
 * WHICH BUILDER READ IT (J, 2026-10-11): "the refresh to last bring in ...
 * decides to read the exact same code that came in during the previous
 * update instead of choosing to re read the same code with the new update".
 * The copy is what the builder of that day made of the code, so after a
 * builder fix Reset put the old reading back and only Clear and bring in
 * showed the fix. Each copy says which build made it (`builder`, the
 * build's `BUILD_TIME`); one made by another build is stale (`olderBuilder`),
 * and Refresh reads the same code again with this build instead of putting
 * it back (`CodeSiteButtons.tsx`).
 */
import * as React from "react";
import { activeProject } from "@/features/builds/store";
import { useStudio } from "./board/store";
import { snapshot } from "./board/store/history";
import type { Doc } from "./board/store/model";
import { idbGet, idbSet } from "./docStore";

export interface LastBring { at: number; repo: string | null; doc: Doc; frameWidth: number; builder?: string | null }

/** This build of the Builder: frozen into the bundle at build (`next.config.ts`), so any builder update is another one. */
export const BUILDER: string | null = process.env.BUILD_TIME ?? null;
/** A copy another build of the Builder read (or one kept before copies said): putting it back would bring back that build's reading. */
export const olderBuilder = (copy: LastBring): boolean => !!BUILDER && copy.builder !== BUILDER;

const KEY = "builder.lastBring";
const keyOf = (site: string | null | undefined) => `${KEY}:${site || "site"}`;
const siteNow = () => activeProject()?.id ?? null;

/* What is known this visit, by key: the copy, or null for none. */
const known = new Map<string, LastBring | null>();
const listeners = new Set<() => void>();
const told = () => { for (const fn of listeners) { try { fn(); } catch { /* its own trouble */ } } };

function copyNow(): LastBring {
  const s = useStudio.getState();
  const repo = (s.look as { styleSource?: { repo?: string } }).styleSource?.repo ?? null;
  /* Through JSON: what is kept is what is stored, and later edits never reach it. */
  return JSON.parse(JSON.stringify({ at: Date.now(), repo, doc: snapshot(s), frameWidth: s.frameWidth, builder: BUILDER })) as LastBring;
}
function store(key: string, copy: LastBring): void {
  known.set(key, copy);
  told();
  void idbSet(key, JSON.stringify(copy));
}

/* Until his first edit, what lands in the background (pictures, screens) joins the copy. */
let follow: (() => void) | null = null;
let followTimer: ReturnType<typeof setTimeout> | null = null;

/** The board as it just landed, kept as this site's last bring-in. */
export function keepLastBring(): void {
  const key = keyOf(siteNow());
  store(key, copyNow());
  follow?.();
  if (followTimer) { clearTimeout(followTimer); followTimer = null; }
  const mark = useStudio.getState().historyMark();
  const stop = useStudio.subscribe((s, was) => {
    if (s.historyMark() !== mark || keyOf(siteNow()) !== key) { stop(); if (follow === stop) follow = null; return; }
    if (s.nodes === was.nodes && s.look === was.look && s.pages === was.pages) return;
    if (followTimer) clearTimeout(followTimer);
    followTimer = setTimeout(() => { followTimer = null; if (follow === stop) store(key, copyNow()); }, 300);
  });
  follow = stop;
}

/** This site's last bring-in, read from storage when not yet known. */
export async function readLastBring(site: string | null = siteNow()): Promise<LastBring | null> {
  const key = keyOf(site);
  if (known.has(key)) return known.get(key) ?? null;
  const raw = await idbGet(key);
  let copy: LastBring | null = null;
  try { copy = raw ? (JSON.parse(raw) as LastBring) : null; } catch { copy = null; }
  if (!copy?.doc?.pages?.length) copy = null;
  known.set(key, copy);
  told();
  return copy;
}

/** Put the last bring-in back on the board, one undo step. False when this site has none kept. */
export async function resetToLastBring(): Promise<LastBring | null> {
  const copy = await readLastBring();
  if (!copy) return null;
  const doc = JSON.parse(JSON.stringify(copy.doc)) as Doc;
  /* The copy is the board as it came in: what follows the next bring-in starts from here. */
  follow?.(); follow = null;
  useStudio.getState().restoreDoc(doc);
  if (copy.frameWidth > 0) useStudio.setState({ frameWidth: copy.frameWidth });
  return copy;
}

/** This site's last bring-in for a control: null while there is none (or it is still being read). */
export function useLastBring(): LastBring | null {
  const site = siteNow();
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    listeners.add(tick);
    void readLastBring(site);
    return () => { listeners.delete(tick); };
  }, [site]);
  return known.get(keyOf(site)) ?? null;
}

if (typeof window !== "undefined") {
  /* For the checks (tests/reset-last-bring.mjs): keep the board as it stands as its last bring-in, as a landing does. */
  (window as unknown as { __studioKeepLastBring?: () => void }).__studioKeepLastBring = keepLastBring;
  /* And mark this site's copy as read by an older build, as one kept before a builder update is (tests/reread-latest-builder.mjs). */
  (window as unknown as { __studioAgeLastBring?: () => Promise<boolean> }).__studioAgeLastBring = async () => {
    const copy = await readLastBring();
    if (!copy) return false;
    store(keyOf(siteNow()), { ...copy, builder: "an older build" });
    return true;
  };
}
