/**
 * THE STEPS AN AGENT MAY SEND THE BOARD, AND THE GATE THEY PASS (`bridge.ts`).
 *
 * Pure, no imports: `tests/agents-site-bridge.mjs` imports this file straight,
 * as `agents-entry.mjs` does `context.ts`.
 */

/** More parts than this in one request: a Duplicate is made first, and Compare offered. */
export const BIG_CHANGE = 20;

/** The steps a request may carry. Each one is a store action; nothing else is reachable. */
export type SiteStep =
  | { op: "updateNode"; id: string; patch: Record<string, unknown> }
  | { op: "updatePage"; id: string; patch: Record<string, unknown> }
  | { op: "setLook"; patch: Record<string, unknown> }
  | { op: "removeNodes"; ids: string[] }
  | { op: "setToken"; id: string; value: string | number };

export const SITE_OPS = ["updateNode", "updatePage", "setLook", "removeNodes", "setToken"] as const;

/** What the dock sends: one of the three tools, with a request id to answer under. */
export type SiteRequest =
  | { source: "polio-dock"; kind: "site"; v: 1; id: string; op: "read"; site?: string }
  | { source: "polio-dock"; kind: "site"; v: 1; id: string; op: "shot"; site?: string; page?: string; part?: string }
  | { source: "polio-dock"; kind: "site"; v: 1; id: string; op: "apply"; site: string; name: string; steps: SiteStep[] };

export type SiteReply = { source: "polio-builder"; kind: "site"; v: 1; id: string } & ({ ok: true; result: unknown } | { ok: false; says: string });

/**
 * Fields a step may never name, at any depth, and the words a key-shaped
 * value takes: keys, the Account, publishing, and anything that pairs or
 * presses (the same list `context.ts` keeps for the other direction).
 */
const FORBIDDEN_FIELDS = new Set(["token", "pairToken", "pairing", "auth", "authorization", "secret", "key", "keys", "keyring", "apiKey", "account", "publish", "published", "live", "repo", "bound", "pending", "control", "controls", "do", "press", "id", "pageId"]);
const KEY_SHAPED = /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|vc[pk]_[A-Za-z0-9]{20,}|Bearer\s+\S{10,})/;

/** The board, as much of it as a check needs. */
export interface BoardLike { site: string | null; nodeIds: ReadonlySet<string>; pageIds: ReadonlySet<string>; tokenIds: ReadonlySet<string> }

/** Why an apply request must be refused whole; an empty list means it may run. */
export function checkApply(r: unknown, board: BoardLike): string[] {
  const out: string[] = [];
  if (!r || typeof r !== "object") return ["not a request"];
  const q = r as Record<string, unknown>;
  if (q.source !== "polio-dock" || q.kind !== "site" || q.op !== "apply") return ["not a site apply request"];
  if (typeof q.name !== "string" || !q.name.trim()) out.push("a request needs a name, such as \"calmer hero\"");
  if (!board.site || q.site !== board.site) out.push(`the request is for site ${JSON.stringify(q.site)}, but the open site is ${JSON.stringify(board.site)}`);
  if (!Array.isArray(q.steps) || !q.steps.length) return [...out, "a request needs at least one step"];
  const walk = (v: unknown, at: string) => {
    if (typeof v === "string") { if (KEY_SHAPED.test(v)) out.push(`${at} looks like a key`); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${at}[${i}]`)); return; }
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (FORBIDDEN_FIELDS.has(k)) out.push(`${at}.${k} can't be changed by an agent`); walk(x, `${at}.${k}`); }
  };
  (q.steps as unknown[]).forEach((s, i) => {
    const at = `steps[${i}]`;
    if (!s || typeof s !== "object") { out.push(`${at} is not a step`); return; }
    const st = s as Record<string, unknown>;
    if (!(SITE_OPS as readonly unknown[]).includes(st.op)) { out.push(`${at}.op ${JSON.stringify(st.op)} is not a step the board takes`); return; }
    switch (st.op) {
      case "updateNode":
        if (typeof st.id !== "string" || !board.nodeIds.has(st.id)) out.push(`${at}: part ${JSON.stringify(st.id)} is not on the open site`);
        if (!st.patch || typeof st.patch !== "object" || !Object.keys(st.patch as object).length) out.push(`${at}: an empty patch`);
        else walk(st.patch, `${at}.patch`);
        break;
      case "updatePage":
        if (typeof st.id !== "string" || !board.pageIds.has(st.id)) out.push(`${at}: page ${JSON.stringify(st.id)} is not on the open site`);
        if (!st.patch || typeof st.patch !== "object") out.push(`${at}: no patch`);
        else walk(st.patch, `${at}.patch`);
        break;
      case "setLook":
        if (!st.patch || typeof st.patch !== "object") out.push(`${at}: no patch`);
        else walk(st.patch, `${at}.patch`);
        break;
      case "removeNodes":
        if (!Array.isArray(st.ids) || !st.ids.length) out.push(`${at}: no parts to remove`);
        else for (const id of st.ids) if (typeof id !== "string" || !board.nodeIds.has(id)) out.push(`${at}: part ${JSON.stringify(id)} is not on the open site`);
        break;
      case "setToken":
        if (typeof st.id !== "string" || !board.tokenIds.has(st.id)) out.push(`${at}: token ${JSON.stringify(st.id)} is not in the open site's System`);
        if (typeof st.value !== "string" && typeof st.value !== "number") out.push(`${at}: a token takes a string or a number`);
        else walk(st.value, `${at}.value`);
        break;
    }
  });
  return out;
}

/** How many parts a request touches, counted once each; a look or token change counts the parts it reaches. */
export function partsTouched(steps: SiteStep[], reach: (step: SiteStep) => string[]): number {
  const ids = new Set<string>();
  for (const s of steps) for (const id of reach(s)) ids.add(id);
  return ids.size;
}

/** The request's size, and whether it is big enough to want a Duplicate first. */
export function planApply(steps: SiteStep[], reach: (step: SiteStep) => string[], big = BIG_CHANGE): { touched: number; big: boolean } {
  const touched = partsTouched(steps, reach);
  return { touched, big: touched > big };
}
