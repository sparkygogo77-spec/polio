/**
 * WHAT THE BUILDER HANDS THE AGENTS DOCK: CONTEXT, NEVER CONTROL.
 *
 * The dock is a frame the helper serves (`http://127.0.0.1:47821/dock`), and
 * the pairing token lives inside it, not on this page. The Builder draws
 * captured sites, so any script on it could read what it holds; that is why
 * the token is not here, and why nothing here can press Start, Approve,
 * Pause or Stop (AGENTS-PANEL-PROPOSAL.md, Safety: "Builder scripts can't
 * drive it either").
 *
 * So the one message this page ever sends the frame is `context`: the picked
 * part, its page, where on the board to take a picture of, the part's System
 * tokens, and which of the five part actions was chosen. `checkContext` is
 * the gate every message goes through before `postMessage`.
 *
 * Pure, no imports: `tests/agents-entry.mjs` imports it straight.
 *
 * The action and chip shapes mirror `helper/contract.ts` (agents-contract,
 * contract v1). They are copied rather than imported because the helper is
 * not part of the Next build.
 */

/** Where the helper listens. Loopback only; the helper checks Host and Origin. */
export const HELPER_ORIGIN = "http://127.0.0.1:47821";
export const DOCK_URL = `${HELPER_ORIGIN}/dock`;
/** The link Windows hands to the helper: it can start it or bring up its window, nothing else. */
export const START_LINK = "polio-helper://start";

/** Right-click a part, Ask agents, then one of these (J, Q9). Same order as the contract. */
export const PART_ACTIONS = ["change", "features", "security", "backend", "explain"] as const;
export type PartAction = (typeof PART_ACTIONS)[number];

export const ACTION_WORDS: Record<PartAction, string> = {
  change: "Change this",
  features: "Suggest features",
  security: "Security check",
  backend: "Build its backend",
  explain: "Explain",
};

/** The contract's chips (`helper/contract.ts#Chip`). */
export type Chip =
  | { kind: "part"; id: string; name?: string }
  | { kind: "page"; id: string }
  | { kind: "shot"; ref: string };

/** One of the part's fields that points at a System token, with the token's name and value now. */
export interface PartToken { field: string; tokenId: string; name: string; value: string }

export interface AgentsContext {
  source: "polio-builder";
  kind: "context";
  v: 1;
  action: PartAction | null;
  chips: Chip[];
  part: { id: string; kind: string; name: string; box: { x: number; y: number; w: number; h: number } } | null;
  page: { id: string; name: string; path: string } | null;
  /**
   * Where to take the board's picture: the page at the frame's width, and the
   * part's box on it. A reference, not pixels: the helper shoots it.
   */
  shot: { ref: string; width: number } | null;
  systemTokens: PartToken[];
}

/* What the board knows, in only the fields read here, so this file needs nothing from the store. */
export interface PartLike {
  id: string; featureId: string; label: string; pageId: string;
  x: number; y: number; w: number; h: number;
  sys?: { s?: string; f?: Record<string, string> } | null;
}
export interface PageLike { id: string; name: string; path: string }
type AnyToken = { id: string; name: string; value?: string; px?: number; css?: string; stack?: string };
export interface SystemLike { id: string; tokens: Record<string, unknown> }

/** Every token in a System by id, whichever list it sits in. */
export function tokenIndex(system: SystemLike | null): Map<string, AnyToken> {
  const out = new Map<string, AnyToken>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) for (const t of v) { if (t && typeof t === "object" && typeof (t as AnyToken).id === "string") out.set((t as AnyToken).id, t as AnyToken); }
    else if (v && typeof v === "object") for (const x of Object.values(v)) walk(x);
  };
  if (system) walk(system.tokens);
  return out;
}

const valueOf = (t: AnyToken) => t.value ?? (t.px !== undefined ? `${t.px}px` : t.css ?? t.stack ?? "");

export function contextFor(action: PartAction | null, part: PartLike | null, page: PageLike | null, frameWidth: number, system: SystemLike | null): AgentsContext {
  const index = tokenIndex(system);
  const systemTokens: PartToken[] = [];
  for (const [field, token] of Object.entries(part?.sys?.f ?? {})) {
    const t = index.get(token);
    if (t) systemTokens.push({ field, tokenId: token, name: t.name, value: valueOf(t) });
  }
  const shotRef = page ? `board:${page.id}@${frameWidth}${part ? `#${part.id}` : ""}` : null;
  const chips: Chip[] = [
    ...(part ? [{ kind: "part" as const, id: part.id, name: part.label }] : []),
    ...(page ? [{ kind: "page" as const, id: page.id }] : []),
    ...(shotRef ? [{ kind: "shot" as const, ref: shotRef }] : []),
  ];
  return {
    source: "polio-builder", kind: "context", v: 1, action, chips,
    part: part ? { id: part.id, kind: part.featureId, name: part.label, box: { x: part.x, y: part.y, w: part.w, h: part.h } } : null,
    page: page ? { id: page.id, name: page.name, path: page.path } : null,
    shot: shotRef ? { ref: shotRef, width: frameWidth } : null,
    systemTokens,
  };
}

/** Keys a message to the dock may never carry, at any depth: anything that pairs, authorises or presses. */
const FORBIDDEN_KEYS = new Set(["token", "pairToken", "pairing", "auth", "authorization", "secret", "key", "apiKey", "control", "controls", "do", "press"]);
/** Values shaped like a key (GitHub, Anthropic, OpenAI, Vercel, a bearer header). */
const KEY_SHAPED = /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|vc[pk]_[A-Za-z0-9]{20,}|Bearer\s+\S{10,})/;

/** Why a message must not go to the frame; an empty list means it may. */
export function checkContext(m: unknown): string[] {
  const out: string[] = [];
  if (!m || typeof m !== "object") return ["not an object"];
  const c = m as Record<string, unknown>;
  if (c.source !== "polio-builder" || c.kind !== "context") out.push(`only context goes to the dock, not ${JSON.stringify(c.kind)}`);
  if (c.action !== null && !(PART_ACTIONS as readonly unknown[]).includes(c.action)) out.push(`unknown part action ${JSON.stringify(c.action)}`);
  const walk = (v: unknown, at: string) => {
    if (typeof v === "string") { if (KEY_SHAPED.test(v)) out.push(`${at} looks like a key`); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${at}[${i}]`)); return; }
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (FORBIDDEN_KEYS.has(k)) out.push(`${at}.${k} is not context`); walk(x, `${at}.${k}`); }
  };
  walk(m, "message");
  return out;
}
