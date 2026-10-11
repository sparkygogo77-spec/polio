/**
 * EDITS THAT APPLY TO ONE STATE OF A PANEL (J, 2026-10-06).
 *
 * On the Panels page an edit applies to the state on show, unless "All
 * states" is on. A part keeps its own look as the look of every state, and
 * what one state changes of it in `byState`, keyed `<panel>=<state>`
 * (`StudioNode.byState`). The style layer writes each as a rule keyed
 * `[data-panel=id][data-state=s]` (`styleLayer.ts#buildLayer`), so it goes
 * back to the site without touching a script.
 *
 * While a state is being edited its parts wear that state's look on the
 * board itself (checked out), so every panel, slider and readout shows and
 * edits it as usual; when the state changes or the page closes, what
 * changed is written back into `byState` and the parts wear their own look
 * again (checked in). Only the look moves: words, place and size are the
 * part's in every state (data is not a state; a place is the code's).
 *
 * Pure: `tests/state-rules.mjs`, `tests/state-only-checked-in.mjs`.
 */

/** What a part keeps the same in every state. */
const NOT_LOOK = new Set(["id", "pageId", "featureId", "label", "prompt", "content", "x", "y", "w", "h", "groupId", "options", "priority", "custom", "glyph", "locked", "link", "data", "hooks", "source", "state", "from", "byState", "place", "byHand", "handFrom", "parentId", "children"]);
const lookKeys = (n: Record<string, unknown>) => Object.keys(n).filter((k) => !NOT_LOOK.has(k));
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const stateEditKey = (panel: string, state: string) => `${panel}=${state}`;
export const readStateEditKey = (k: string): { panel: string; state: string } | null => { const i = k.lastIndexOf("="); return i > 0 ? { panel: k.slice(0, i), state: k.slice(i + 1) } : null; };

type EditNode = { id: string; byState?: Record<string, Record<string, unknown>> | null } & Record<string, unknown>;
/** Each checked-out part's own look, to put back. */
export type CheckedOut = { key: string; base: Map<string, Record<string, unknown>> };

/** The parts wearing one state's look: each picked part with that state's changes on. */
export function checkOut<T extends EditNode>(nodes: readonly T[], key: string, ids: readonly string[]): { nodes: T[]; out: CheckedOut } {
  const want = new Set(ids);
  const base = new Map<string, Record<string, unknown>>();
  const next = nodes.map((n) => {
    if (!want.has(n.id)) return n;
    const patch = n.byState?.[key] ?? {};
    base.set(n.id, Object.fromEntries([...new Set([...lookKeys(n), ...Object.keys(patch)])].map((k) => [k, n[k]])));
    return Object.keys(patch).length ? ({ ...n, ...patch } as T) : n;
  });
  return { nodes: next, out: { key, base } };
}

/** The parts back in their own look, what the state changed of each kept in `byState` (nothing changed: the state keeps nothing). */
export function checkIn<T extends EditNode>(nodes: readonly T[], out: CheckedOut): T[] {
  return nodes.map((n) => {
    const was = out.base.get(n.id);
    if (!was) return n;
    const diff: Record<string, unknown> = {};
    for (const k of new Set([...lookKeys(n), ...Object.keys(was)])) if (!same(n[k], was[k])) diff[k] = n[k] ?? null;
    const back: Record<string, unknown> = { ...n };
    for (const k of new Set([...lookKeys(n), ...Object.keys(was)])) { if (was[k] === undefined) delete back[k]; else back[k] = was[k]; }
    const byState = { ...(n.byState ?? {}) };
    if (Object.keys(diff).length) byState[out.key] = diff;
    else delete byState[out.key];
    back.byState = Object.keys(byState).length ? byState : null;
    return back as T;
  });
}

/*
 * WHAT THE BOARD WEARS NOW (builder audit, 2026-10-11). A state worn on the
 * board (Show's "This state only", the Panels page's state on show) is a way
 * of editing that state, not the document. With one worn, Publish sent the
 * TV's live look as its look in every state, and an undo past the moment it
 * went on put back parts that wore nothing, so taking it off deleted the
 * state's saved edits. So what is worn is kept here, by who wears it:
 * whatever keeps or sends the document (the undo history, the save, Publish)
 * reads the parts checked in (`checkedIn`), and a document put back while a
 * state is worn wears it again (`wearAgain`), its own look read afresh.
 */
type Part = { id: string };
const asEdit = (nodes: readonly Part[]) => nodes as unknown as EditNode[];
const worn = new Map<string, CheckedOut[]>();
/** Moved on by every change to what is worn, so `checkedIn` answers again. */
let wornAt = 0;

/** Whether `who` (the Show switch, the Panels page) wears a state now. */
export const wears = (who: string): boolean => worn.has(who);

/** `who` puts these states on the parts, each look to put back kept here; what it wore before comes off first. */
export function wearStates<T extends Part>(who: string, nodes: readonly T[], looks: readonly { key: string; ids: readonly string[] }[]): T[] {
  let next = asEdit(takeOffStates(who, nodes));
  const outs: CheckedOut[] = [];
  for (const g of looks) { const got = checkOut(next, g.key, g.ids); next = got.nodes; outs.push(got.out); }
  if (outs.length) { worn.set(who, outs); wornAt++; }
  return next as unknown as T[];
}

/** `who` takes its states off: its parts back in their own look, what each state changed kept in `byState`. */
export function takeOffStates<T extends Part>(who: string, nodes: readonly T[]): T[] {
  const outs = worn.get(who);
  if (!outs) return nodes as T[];
  worn.delete(who);
  wornAt++;
  return outs.reduceRight((ns, out) => checkIn(ns, out), asEdit(nodes)) as unknown as T[];
}

const answered = new WeakMap<readonly Part[], { at: number; back: Part[] }>();
/** The document under the board: every worn state checked back in, none taken off. The same parts when nothing is worn, and the same answer for the same parts, so the save, which compares by reference, writes nothing new (`create.ts#keptOnly`). */
export function checkedIn<T extends Part>(nodes: readonly T[]): T[] {
  if (!worn.size) return nodes as T[];
  const had = answered.get(nodes);
  if (had?.at === wornAt) return had.back as T[];
  let back = asEdit(nodes);
  for (const outs of [...worn.values()].reverse()) back = outs.reduceRight((ns, out) => checkIn(ns, out), back);
  answered.set(nodes, { at: wornAt, back: back as unknown as Part[] });
  return back as unknown as T[];
}

/** A document put back while states are worn (an undo, a redo, a step in the history, a thread stood on): the same states worn on it. */
export function wearAgain<T extends Part>(nodes: readonly T[]): T[] {
  if (!worn.size) return nodes as T[];
  let next = asEdit(nodes);
  for (const [who, outs] of worn) worn.set(who, outs.map((out) => { const got = checkOut(next, out.key, [...out.base.keys()]); next = got.nodes; return got.out; }));
  wornAt++;
  return next as unknown as T[];
}

/** What a part is given on its own, never its group's: a shelf effect (`work`) and its animation. */
const MINE_ONLY = new Set(["work", "anim", "animSpeed", "animDelay", "animEase"]);

/**
 * A STYLE GROUP IS EDITED ONCE (BUILDER-RULES.md rule 24): the look an edit
 * gives one part of a `data-group` goes to every part of that group, so all
 * the panel titles change together. Only the look: place, size and words are
 * each part's own. The ids to patch, with the patch each gets.
 *
 * An effect is the part's own too (`MINE_ONLY`): J put Appear on scroll on the
 * Find a match box alone and all 14 white panels of its group took it.
 */
export function groupTwins(nodes: readonly { id: string; hooks?: Record<string, string> | null }[], id: string, patch: Record<string, unknown>): { ids: string[]; patch: Record<string, unknown> } | null {
  const me = nodes.find((n) => n.id === id);
  const group = me?.hooks?.["data-group"];
  if (!group) return null;
  const look = Object.fromEntries(Object.entries(patch).filter(([k]) => !NOT_LOOK.has(k) && !MINE_ONLY.has(k)));
  if (!Object.keys(look).length) return null;
  const ids = nodes.filter((n) => n.id !== id && n.hooks?.["data-group"] === group).map((n) => n.id);
  return ids.length ? { ids, patch: look } : null;
}
