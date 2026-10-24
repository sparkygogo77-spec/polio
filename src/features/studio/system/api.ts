"use client";
/**
 * WHAT THE SYSTEM PANEL CALLS, and the wiring that keeps the open site, its
 * copy of its System and the shared library one thing.
 *
 * Every change here is one undo step on the open site, and reaches the
 * library at once, so every other site using the System draws it too
 * (`draw.ts`), and takes it into its own document when it is next opened.
 *
 *   takeFromSite({ dry })   read the System off the open site; `dry` only
 *                           says what would be found (the "Take it" dialog)
 *   siteSystem()            the open site's System, or null
 *   setToken(id, value)     change a token: every part pointing at it, here
 *                           and on every site using the System
 *   renameToken, addToken, removeToken
 *   linkPart, unlinkPart, detachPart     one part's fields
 *   forkSite(name?)         this site gets its own copy, to diverge
 *   pointSiteAt(id)         point the open site at a System in the library
 *                           (its parts keep their values; `takeFromSite`
 *                           links them)
 *   usedBy(id)              the open site's parts pointing at a token, or
 *                           instances of a component
 *
 * The React side: `useSiteSystem()` (the open site's System, live) and
 * `useLibrary()` (every System held).
 *
 * KEEPING THEM ONE (`reconcile`). The open document holds a copy of its
 * System (`doc.system`) so that undo can take a token change back and a
 * site carries its System wherever it goes. When the two differ:
 *   · a copy this session put in the document itself (an undo or a redo
 *     brought it back) is the one wanted, and goes to the library;
 *   · otherwise (a site opened, a sync) the later of the two wins.
 * Then the document's parts are written with the tokens' values, without an
 * undo step of their own, so the word fitting and the export read what is
 * drawn.
 */
import * as React from "react";
import { useStudio, type StudioNode } from "../board/store";
import { resolvePalette } from "../shelf/run";
import { ROLES, type Palette } from "../look";
import { readSystem, type FieldPath, type System, type TokenKind } from "./model";
import { materialise, rolesOf, sameValue } from "./resolve";
import { linksHold, takeSystem, withSys, type TakeNode, type TakeReport } from "./take";
import * as L from "./link";
import { libraryList, newer, useSystems } from "./store";

/* ------------------------------------------------------------------ */
/* Keeping the document, its copy and the library one                  */
/* ------------------------------------------------------------------ */

/** Copies this session wrote into the document: one of these coming back is an undo or a redo. */
const seen = new WeakSet<System>();
let applying = 0;
const quietly = (fn: () => void) => { applying++; try { fn(); } finally { applying--; } };

/** The open site's palette with each role a token holds set to it, or the same look when each already shows it. */
function lookWith(st: ReturnType<typeof useStudio.getState>, s: System): typeof st.look {
  const shown = resolvePalette(st.format, st.look);
  const want = rolesOf(s);
  let palette = st.look.palette;
  for (const r of ROLES) {
    const v = want[r];
    if (v && !sameValue("colour", shown[r], v)) palette = { ...(palette ?? {}), [r]: v } as typeof palette;
  }
  return palette === st.look.palette ? st.look : { ...st.look, palette };
}

/** The document's parts and palette as `s` has them: what to set, or null for nothing. */
function written(st: ReturnType<typeof useStudio.getState>, s: System): Partial<ReturnType<typeof useStudio.getState>> | null {
  const m = materialise(st.nodes, s);
  const look = lookWith(st, s);
  if (!m.changed.length && look === st.look) return null;
  return { ...(m.changed.length ? { nodes: m.nodes as StudioNode[] } : {}), ...(look !== st.look ? { look } : {}) };
}

/** See the header. Safe to call at any time; does nothing when all three agree. */
export function reconcile(): void {
  if (applying) return;
  const st = useStudio.getState();
  const id = st.systemId;
  if (!id) return;
  const lib = useSystems.getState().byId[id];
  const mine = st.system && st.system.id === id ? st.system : null;
  quietly(() => {
    if (!lib && mine) { seen.add(mine); useSystems.getState().put(mine); return; }
    if (!lib) return;
    if (mine && (mine === lib || (mine.rev === lib.rev && mine.editedAt === lib.editedAt))) {
      const w = written(st, lib);
      if (w) useStudio.setState(w);
      return;
    }
    if (mine && seen.has(mine)) {
      /* Taken back by undo or brought again by redo: that copy is the System now. */
      const next: System = { ...mine, rev: Math.max(mine.rev, lib.rev) + 1, editedAt: Math.max(Date.now(), lib.editedAt + 1) };
      seen.add(next);
      useSystems.getState().put(next);
      useStudio.setState({ system: next, ...(written(st, next) ?? {}) });
      return;
    }
    const win = mine && newer(mine, lib) ? mine : lib;
    seen.add(win);
    if (win !== lib) useSystems.getState().put(win);
    /* The library's copy came in (another site changed it, or a sync did): the steps already taken carry it too, so undoing one of them never undoes that. */
    const swap = <T extends { systemId?: string | null; system?: System | null }>(list: T[]) => list.map((d) => (d.systemId === id && d.system && d.system !== win ? { ...d, system: win } : d));
    useStudio.setState({ system: win, ...(written(st, win) ?? {}), past: swap(st.past), future: swap(st.future) });
  });
}

let installed = false;
/** Once per page: the open site follows its System, and the checks get their hook. */
export function installSystem(): () => void {
  if (installed || typeof window === "undefined") return () => {};
  installed = true;
  const offStudio = useStudio.subscribe((s, p) => {
    if (applying) return;
    if (s.systemId !== p.systemId || s.system !== p.system) { reconcile(); return; }
    /* An undo or a redo brings back parts as they were: written again with what their tokens hold. */
    if (s.systemId && s.future !== p.future && s.future.length) {
      const lib = useSystems.getState().byId[s.systemId];
      const w = lib ? written(s, lib) : null;
      if (w) quietly(() => useStudio.setState(w));
    }
  });
  const offLibrary = useSystems.subscribe((l, p) => {
    const id = useStudio.getState().systemId;
    if (!applying && id && l.byId[id] !== p.byId[id]) reconcile();
  });
  reconcile();
  (window as unknown as { __polioSystem?: unknown }).__polioSystem = testHook;
  return () => { offStudio(); offLibrary(); installed = false; delete (window as unknown as { __polioSystem?: unknown }).__polioSystem; };
}

/* ------------------------------------------------------------------ */
/* One step on the open site                                           */
/* ------------------------------------------------------------------ */

/**
 * One undo step: the checkpoint first (`patchNodes` takes it), then the
 * parts, the palette and the document's System, then the library.
 */
function step(next: System, nodes: (now: readonly StudioNode[]) => readonly StudioNode[] = (n) => n, systemId = next.id): void {
  const st = useStudio.getState();
  const after = materialise(nodes(st.nodes), next).nodes as StudioNode[];
  const changed = new Set(after.filter((n, i) => n !== st.nodes[i]).map((n) => n.id));
  const byId = new Map(after.map((n) => [n.id, n]));
  quietly(() => {
    st.patchNodes([...changed], (n) => byId.get(n.id) ?? n);
    seen.add(next);
    const now = useStudio.getState();
    useStudio.setState({ systemId, system: next, look: lookWith(now, next) });
    useSystems.getState().put(next);
  });
}

/** The open site's System: the library's copy, else the document's. */
export function siteSystem(): System | null {
  const st = useStudio.getState();
  if (!st.systemId) return null;
  return useSystems.getState().byId[st.systemId] ?? (st.system?.id === st.systemId ? st.system : null);
}

function palette(): Palette {
  const st = useStudio.getState();
  return resolvePalette(st.format, st.look);
}

export interface TakeAnswer { report: TakeReport; system: System; ok: true }
export type Refused = { ok: false; says: string };

/**
 * Read the System off the open site and link its parts, moving nothing.
 * Always a new System in the library: a site whose System other sites share
 * never renumbers theirs. `dry` reports what would be found and changes
 * nothing.
 */
export function takeFromSite(o: { dry?: boolean; name?: string } = {}): TakeAnswer | Refused {
  const st = useStudio.getState();
  if (!st.nodes.length) return { ok: false, says: "There are no parts on this site to take a System from." };
  const host = st.nodes.find((n) => n.from?.host)?.from?.host ?? null;
  const name = o.name?.trim() || st.brief?.name?.trim() || host || "This site";
  const taken = takeSystem({ nodes: st.nodes as unknown as TakeNode[], palette: palette(), frameWidth: st.frameWidth, name, host });
  if (o.dry) return { ok: true, report: taken.report, system: taken.system };
  const keep = st.systemId;
  step(taken.system, (now) => now.map((n) => {
    const link = taken.links.get(n.id) ?? null;
    /* Parts pointing at the site's old System let go of it; everything else is untouched. */
    return link ? withSys(n, link) : n.sys && (n.sys.s === keep || !keep) ? withSys(n, null) : n;
  }));
  return { ok: true, report: taken.report, system: taken.system };
}

function edit(fn: (s: System) => System | null, nodes?: (now: readonly StudioNode[]) => readonly StudioNode[]): System | Refused {
  const s = siteSystem();
  if (!s) return { ok: false, says: "This site has no System yet. Take one from the site first." };
  const next = fn(s);
  if (!next) return { ok: false, says: "That is not a value this token can hold." };
  if (next !== s || nodes) step(next, nodes);
  return next;
}

export const setToken = (id: string, value: string | number, face?: string) => edit((s) => L.setTokenValue(s, id, value, face));
export const renameToken = (id: string, name: string) => edit((s) => L.renameToken(s, id, name));
export function addToken(kind: TokenKind, name: string, value: string | number, more?: Parameters<typeof L.addToken>[4]): { ok: true; id: string } | Refused {
  const s = siteSystem();
  if (!s) return { ok: false, says: "This site has no System yet. Take one from the site first." };
  const r = L.addToken(s, kind, name, value, more);
  if (!r) return { ok: false, says: "That is not a value this token can hold." };
  step(r.system);
  return { ok: true, id: r.id };
}
/** The token out of the System; this site's parts keep the value they show. Other sites' pointers to it are ignored when drawn. */
export const removeToken = (id: string) => edit((s) => L.removeToken(s, id), (now) => L.unlinkToken(now, id));

function onePart(id: string, fn: (n: StudioNode, s: System) => StudioNode | null): StudioNode | Refused {
  const s = siteSystem();
  const st = useStudio.getState();
  const n = st.nodes.find((x) => x.id === id);
  if (!s || !n) return { ok: false, says: s ? "No such part." : "This site has no System yet." };
  const next = fn(n, s);
  if (!next) return { ok: false, says: "That field cannot take that token." };
  if (next !== n) step(s, (now) => now.map((x) => (x.id === id ? next : x)));
  return next;
}
export const linkPart = (id: string, field: FieldPath, token: string) => onePart(id, (n, s) => L.linkField(n, s, field, token));
export const unlinkPart = (id: string, field: FieldPath) => onePart(id, (n) => L.unlinkField(n, field));
export const detachPart = (id: string) => onePart(id, (n) => L.detach(n));

/** This site gets a copy of its System of its own: changing it changes no other site. */
export function forkSite(name?: string): System | Refused {
  const s = siteSystem();
  if (!s) return { ok: false, says: "This site has no System yet." };
  const copy = L.fork(s, name);
  step(copy, (now) => L.onSystem(now, s.id, copy.id));
  return copy;
}

/** Point the open site at a System in the library. Its parts keep the values they have; none is linked until a take. */
export function pointSiteAt(id: string): System | Refused {
  const s = useSystems.getState().byId[id];
  if (!s) return { ok: false, says: "No such System in the library." };
  step(s);
  return s;
}

export function usedBy(id: string): string[] { return L.usedBy(useStudio.getState().nodes, id); }

/* ------------------------------------------------------------------ */
/* React                                                               */
/* ------------------------------------------------------------------ */

/** The open site's System, live, with how many of its fields point at each token. */
export function useSiteSystem(): { system: System | null; counts: Map<string, number> } {
  const id = useStudio((s) => s.systemId ?? null);
  const own = useStudio((s) => s.system ?? null);
  const nodes = useStudio((s) => s.nodes);
  const lib = useSystems((l) => (id ? l.byId[id] : undefined));
  const system = lib ?? (own && own.id === id ? own : null);
  const counts = React.useMemo(() => L.pointerCounts(nodes), [nodes]);
  return { system, counts };
}

export function useLibrary(): System[] {
  const byId = useSystems((l) => l.byId);
  return React.useMemo(() => Object.values(byId).sort((a, b) => b.editedAt - a.editedAt), [byId]);
}

/* ------------------------------------------------------------------ */
/* For the checks: window.__polioSystem                                */
/* ------------------------------------------------------------------ */

const testHook = {
  take: (o?: { dry?: boolean; name?: string }) => {
    const r = takeFromSite(o);
    return r.ok ? { ok: true, report: r.report, id: r.system.id } : r;
  },
  system: () => siteSystem(),
  doc: () => { const s = useStudio.getState(); return { systemId: s.systemId ?? null, rev: s.system?.rev ?? null }; },
  setToken, renameToken, addToken, removeToken, linkPart, unlinkPart, detachPart, forkSite, pointSiteAt, usedBy,
  /** Fields that point at a token whose value they do not hold now (should be none). */
  broken: () => { const s = siteSystem(); return s ? linksHold(useStudio.getState().nodes, s) : []; },
  library: () => libraryList().map((s) => ({ id: s.id, name: s.name, rev: s.rev })),
  read: (v: unknown) => readSystem(v),
};
