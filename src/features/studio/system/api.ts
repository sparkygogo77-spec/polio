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
 *   newSystem(name?)        a new, empty System for the open site
 *   setHouse(id | null)     the house style: what a site with no System uses
 *   setVariantState, addVariant, makeComponent    a component's variants
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
import { ROLES, type Palette, type RoleId } from "../look";
import { componentsOf, KIND_WORD, type CompNode } from "../components";
import { emptySystem, readSystem, type FieldPath, type LookSlot, type StateLook, type StateName, type System, type TokenKind } from "./model";
import { LOOK_SLOTS, holdOwn, instanceOf, overridesOf, rebind, resetInstance, slotFields, slotKind } from "./bind";
import { materialise, rolesOf, sameValue } from "./resolve";
import { linksHold, takeSystem, withSys, type TakeNode, type TakeReport } from "./take";
import * as L from "./link";
import { houseOf, libraryList, markHouse, newer, useSystems } from "./store";

/* ------------------------------------------------------------------ */
/* Keeping the document, its copy and the library one                  */
/* ------------------------------------------------------------------ */

/** Copies this session wrote into the document: one of these coming back is an undo or a redo. */
const seen = new WeakSet<System>();
let applying = 0;
const quietly = (fn: () => void) => { applying++; try { fn(); } finally { applying--; } };

/** The open site's palette with each role a token holds set to it (of the roles the site takes, `systemRoles`), or the same look when each already shows it. */
function lookWith(st: ReturnType<typeof useStudio.getState>, s: System): typeof st.look {
  const shown = resolvePalette(st.format, st.look);
  const want = rolesOf(s);
  const takes = st.systemRoles ?? ROLES;
  let palette = st.look.palette;
  for (const r of takes) {
    const v = want[r];
    if (v && !sameValue("colour", shown[r], v)) palette = { ...(palette ?? {}), [r]: v } as typeof palette;
  }
  return palette === st.look.palette ? st.look : { ...st.look, palette };
}

/**
 * The document's parts and palette as `s` has them: what to set, or null for
 * nothing. With `before`, the copy of the System the document held, its
 * instances first follow every variant slot that changed since (`bind.ts`):
 * how an edit to a component made on another site reaches this one.
 */
function written(st: ReturnType<typeof useStudio.getState>, s: System, before?: System | null): Partial<ReturnType<typeof useStudio.getState>> | null {
  const nodes = before ? rebind(st.nodes, before, s, resolvePalette(st.format, st.look)).nodes : st.nodes;
  const m = materialise(nodes, s);
  const moved = m.nodes !== st.nodes;
  const look = lookWith(st, s);
  if (!moved && look === st.look) return null;
  return { ...(moved ? { nodes: m.nodes as StudioNode[] } : {}), ...(look !== st.look ? { look } : {}) };
}

/**
 * THE HOUSE STYLE BY DEFAULT (J, 2026-10-24: one house style all his sites
 * share). A site with no System points at the house style, without an undo
 * step of its own. A blank site wears it whole. A site with parts on it (an
 * import, a site made before) takes from it only the palette roles it
 * already wears and links nothing, so pointing moves nothing; "Take from
 * this site" still gives it a System of its own.
 */
function pointAtHouse(st: ReturnType<typeof useStudio.getState>, house: System): void {
  const blank = st.nodes.length === 0;
  const shown = resolvePalette(st.format, st.look);
  const want = rolesOf(house);
  const roles = blank ? null : ROLES.filter((r) => !!want[r] && sameValue("colour", shown[r], want[r]));
  seen.add(house);
  const at = { ...st, systemId: house.id, system: house, systemRoles: roles };
  useStudio.setState({ systemId: house.id, system: house, systemRoles: roles, ...(written(at, house) ?? {}) });
}

/** On the house style the way `pointAtHouse` left it: nothing linked to it, so a document put on the board in its place is pointed afresh. */
function onHouseOnly(st: ReturnType<typeof useStudio.getState>): boolean {
  const h = houseOf();
  return !!h && st.systemId === h.id && !st.nodes.some((n) => n.sys?.s === h.id);
}

/** See the header. Safe to call at any time; does nothing when all three agree. */
export function reconcile(from: "doc" | "opened" | "library" = "doc"): void {
  if (applying) return;
  const st = useStudio.getState();
  const id = st.systemId;
  if (!id) {
    const house = houseOf();
    if (house) quietly(() => pointAtHouse(st, house));
    return;
  }
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
    /*
     * Only an undo or a redo can bring back a copy this session wrote: when
     * the library moved (another site, a sync), or another site was opened
     * (its copy may be one this session wrote earlier, before the System
     * changed on a site opened since), the later copy wins.
     */
    if (from === "doc" && mine && seen.has(mine)) {
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
    useStudio.setState({ system: win, ...(written(st, win, win === lib ? mine : null) ?? {}), past: swap(st.past), future: swap(st.future) });
  });
}

let installed = false;
/** Once per page: the open site follows its System, and the checks get their hook. */
export function installSystem(): () => void {
  if (installed || typeof window === "undefined") return () => {};
  installed = true;
  const offStudio = useStudio.subscribe((s, p) => {
    if (applying) return;
    if (s.systemId !== p.systemId || s.system !== p.system) {
      /* An undo moves one step onto the future, a redo one off it; opening a site empties both. */
      const stepped = s.future.length === p.future.length + 1 || (s.future.length === p.future.length - 1 && s.past.length > 0);
      reconcile(stepped ? "doc" : "opened");
      return;
    }
    /* An undo or a redo brings back parts as they were: written again with what their tokens hold. */
    if (s.systemId && s.future !== p.future && s.future.length) {
      const lib = useSystems.getState().byId[s.systemId];
      const w = lib ? written(s, lib) : null;
      if (w) quietly(() => useStudio.setState(w));
    }
  });
  const offLibrary = useSystems.subscribe((l, p) => {
    const id = useStudio.getState().systemId;
    if (!applying && (id ? l.byId[id] !== p.byId[id] : houseOf(l.byId) !== houseOf(p.byId))) reconcile("library");
  });
  /* Every import ends here (`loadDoc`): a site on the house style only by default takes it afresh, as the document it now holds. */
  const onLoaded = () => {
    const st = useStudio.getState();
    if (applying || !onHouseOnly(st)) return;
    quietly(() => pointAtHouse(st, houseOf()!));
  };
  window.addEventListener("studio:doc-loaded", onLoaded);
  reconcile();
  (window as unknown as { __polioSystem?: unknown }).__polioSystem = testHook;
  return () => { offStudio(); offLibrary(); window.removeEventListener("studio:doc-loaded", onLoaded); installed = false; delete (window as unknown as { __polioSystem?: unknown }).__polioSystem; };
}

/* ------------------------------------------------------------------ */
/* One step on the open site                                           */
/* ------------------------------------------------------------------ */

/**
 * One undo step: the checkpoint first (`patchNodes` takes it), then the
 * parts, the palette and the document's System, then the library.
 */
function step(next: System, nodes: (now: readonly StudioNode[]) => readonly StudioNode[] = (n) => n, systemId = next.id, roles?: RoleId[] | null): void {
  const st = useStudio.getState();
  const after = materialise(nodes(st.nodes), next).nodes as StudioNode[];
  const changed = new Set(after.filter((n, i) => n !== st.nodes[i]).map((n) => n.id));
  const byId = new Map(after.map((n) => [n.id, n]));
  quietly(() => {
    /* `patchNodes` merges, so a key the new part no longer has (its `sys`, taken off by a detach or a last link let go) is set to undefined, or the old one would stay. */
    st.patchNodes([...changed], (n) => {
      const next = byId.get(n.id) ?? n;
      const patch: Partial<StudioNode> = { ...next };
      for (const k of Object.keys(n) as (keyof StudioNode)[]) if (!(k in next)) (patch as Record<string, unknown>)[k] = undefined;
      return patch;
    });
    seen.add(next);
    /* `roles` undefined keeps the roles the site takes; null, for a site that chose this System, takes all of them. */
    const now = roles === undefined ? useStudio.getState() : { ...useStudio.getState(), systemRoles: roles };
    useStudio.setState({ systemId, system: next, ...(roles === undefined ? {} : { systemRoles: roles }), look: lookWith(now, next) });
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
  }), taken.system.id, null);
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
  step(s, undefined, s.id, null);
  return s;
}

export function usedBy(id: string): string[] { return L.usedBy(useStudio.getState().nodes, id); }

/** A new, empty System for the open site (the panel's New). Its parts keep the values they have; they let go of the old System's tokens. */
export function newSystem(name?: string): System {
  const st = useStudio.getState();
  const s = emptySystem(name?.trim() || st.brief?.name?.trim() || "New system", "theme");
  const keep = st.systemId;
  step(s, (now) => (keep ? now.map((n) => (n.sys?.s === keep ? withSys(n, null) : n)) : now), s.id, null);
  return s;
}

/* Components: one undo step each, in the System, with its instances following in the same step (`bind.ts`). */

/**
 * "Edit the component": a variant's slot pointed at a token, or given a value
 * (a value a token holds points at that token). Every instance of the
 * variant, here and on each site sharing the System, follows; a field changed
 * by hand on one instance keeps its value. One undo step.
 */
export function setVariantSlot(component: string, variant: string, slot: LookSlot, to: { token: string } | { value: string | number }): System | Refused {
  const s = siteSystem();
  if (!s) return { ok: false, says: "This site has no System yet." };
  const was = s.components.find((c) => c.id === component)?.variants.find((v) => v.id === variant)?.look[slot];
  const next = L.setVariantSlot(s, component, variant, slot, to, slotKind(slot, "token" in to ? to : was));
  if (!next) return { ok: false, says: "That is not a value this slot can hold." };
  if (next !== s) step(next, (now) => rebind(now, s, next, palette()).nodes);
  return next;
}

/** "Reset to the component": the picked instance wears its variant again and holds nothing of its own. One undo step; nothing when it already does. */
export const resetPart = (id: string) => onePartSet(id, (now, s) => resetInstance(now, s, id, palette()).nodes);
/** "Change just this one", on a whole instance: component edits pass it by until Reset, and its own fields change only it. */
export const holdOwnPart = (id: string) => onePartSet(id, (now, s) => {
  const it = instanceOf(now, s, id, palette());
  return it ? now.map((n) => (n.id === it.host ? holdOwn(n, s) : n)) : now;
});
/** The slots where the picked instance shows something of its own. */
export function overridesOfPart(id: string): LookSlot[] {
  const s = siteSystem();
  return s ? overridesOf(useStudio.getState().nodes, s, id, palette()) : [];
}

function onePartSet(id: string, fn: (now: readonly StudioNode[], s: System) => readonly StudioNode[]): { ok: true; changed: boolean } | Refused {
  const s = siteSystem();
  const st = useStudio.getState();
  if (!s) return { ok: false, says: "This site has no System yet." };
  if (!instanceOf(st.nodes, s, id, palette())) return { ok: false, says: "That part is no component's." };
  const after = fn(st.nodes, s);
  if (after === st.nodes || after.every((n, i) => n === st.nodes[i])) return { ok: true, changed: false };
  step(s, () => after);
  return { ok: true, changed: true };
}

export const setVariantState = (component: string, variant: string, state: Exclude<StateName, "rest">, look: StateLook | null) =>
  edit((s) => L.setVariantState(s, component, variant, state, look));
export function addVariant(component: string, from: string, name = ""): { ok: true; id: string } | Refused {
  const s = siteSystem();
  if (!s) return { ok: false, says: "This site has no System yet." };
  const r = L.addVariant(s, component, from, name);
  if (!r) return { ok: false, says: "No such component." };
  step(r.system);
  return { ok: true, id: r.id };
}
/** A component made from the picked part (the panel's "make a component from the picked part"): the kind the Builder reads it as, else a card. */
export function makeComponent(partId: string, name?: string): { ok: true; id: string } | Refused {
  const s = siteSystem();
  const st = useStudio.getState();
  const n = st.nodes.find((x) => x.id === partId);
  if (!s || !n) return { ok: false, says: s ? "No such part." : "This site has no System yet." };
  const read = componentsOf(st.nodes as unknown as readonly CompNode[], palette() as Record<string, string>).list.find((c) => c.id === partId || c.parts.includes(partId));
  const kind = read?.kind ?? "card";
  const r = L.componentFromPart(s, n, kind, name ?? KIND_WORD[kind]);
  if (!r) return { ok: false, says: "That part cannot be a component." };
  step(r.system, (now) => now.map((x) => (x.id === partId ? r.node : x)));
  return { ok: true, id: r.id };
}

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

/** Make a library System the house style, or (null) none: every site with no System of its own then uses it. Not an undo step: the library is not one site's. */
export function setHouse(id: string | null): void { markHouse(id); }

/** A new site's theme was just rolled (`newSite.ts`): a site on the house style wears its roles over it. */
export function wearSystem(): void {
  const st = useStudio.getState();
  const s = siteSystem();
  if (!s) return;
  const look = lookWith(st, s);
  if (look !== st.look) quietly(() => useStudio.setState({ look }));
}

/** The house style, live, and whether the open site uses it. */
export function useHouse(): { house: System | null; mine: boolean } {
  const house = useSystems((l) => houseOf(l.byId));
  const id = useStudio((s) => s.systemId ?? null);
  return { house, mine: !!house && house.id === id };
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
  newSystem, setVariantState, addVariant, makeComponent, setHouse,
  setVariantSlot, resetPart, holdOwnPart, overridesOfPart,
  /** A part's instance: its component, variant, parts, and the fields each slot paints. */
  instance: (id: string) => {
    const s = siteSystem();
    const nodes = useStudio.getState().nodes;
    const it = s ? instanceOf(nodes, s, id, palette()) : null;
    if (!it) return null;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return {
      host: it.host, component: it.component.id, variant: it.variant.id, name: `${it.component.name} / ${it.variant.name}`, parts: it.comp?.parts ?? [it.host],
      fields: it.comp ? Object.fromEntries(LOOK_SLOTS.map((slot) => [slot, slotFields(byId, it.comp!, slot)])) : {},
    };
  },
  house: () => houseOf()?.id ?? null,
  /** The open site as the System sees it: which System, which palette roles it takes, the palette, how many parts are linked. */
  site: () => { const s = useStudio.getState(); return { systemId: s.systemId ?? null, roles: s.systemRoles ?? null, palette: s.look.palette ?? {}, linked: s.nodes.filter((n) => n.sys).length, nodes: s.nodes.length }; },
  /** Fields that point at a token whose value they do not hold now (should be none). */
  broken: () => { const s = siteSystem(); return s ? linksHold(useStudio.getState().nodes, s) : []; },
  library: () => libraryList().map((s) => ({ id: s.id, name: s.name, rev: s.rev })),
  read: (v: unknown) => readSystem(v),
};
