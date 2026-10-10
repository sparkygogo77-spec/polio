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
 * Pure: `tests/state-rules.mjs`.
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
