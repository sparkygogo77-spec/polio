/**
 * THE STEPS AN AGENT MAY SEND THE BOARD, AND THE GATE THEY PASS (`bridge.ts`).
 *
 * Pure: `tests/agents-site-bridge.mjs` imports this file straight, as
 * `agents-entry.mjs` does `context.ts`. Its one import is pure too.
 */
import { drawnPx, fontAtPx, fontInFace } from "../studio/board/drawnSize.ts";

/** More parts than this in one request: a Duplicate is made first, and Compare offered. */
export const BIG_CHANGE = 20;

/** Where a part goes in the stack (`front` to `backward`) or down the page (`earlier`, `later`). */
export const REORDERS = ["front", "back", "forward", "backward", "earlier", "later"] as const;
export type Reorder = (typeof REORDERS)[number];

/** The steps a request may carry. Each one is a store action; nothing else is reachable. */
export type SiteStep =
  | { op: "updateNode"; id: string; patch: Record<string, unknown> }
  | { op: "updatePage"; id: string; patch: Record<string, unknown> }
  | { op: "setLook"; patch: Record<string, unknown> }
  | { op: "removeNodes"; ids: string[] }
  | { op: "setToken"; id: string; value: string | number }
  /* `as` names the new part for the later steps of the same request. */
  | { op: "addNode"; featureId: string; x: number; y: number; patch?: Record<string, unknown>; page?: string; as?: string }
  | { op: "group"; ids: string[]; label?: string }
  | { op: "ungroup"; group: string }
  | { op: "reorder"; id: string; to?: Reorder; above?: string; below?: string }
  /* `px` is the size the words are drawn at; `face` replaces whatever named the old one. */
  | { op: "setFont"; id: string; px?: number; face?: string; weight?: number };

export const SITE_OPS = ["updateNode", "updatePage", "setLook", "removeNodes", "setToken", "addNode", "group", "ungroup", "reorder", "setFont"] as const;

/** What the dock sends: one of the tools, with a request id to answer under. */
type Asked = { source: "polio-dock"; kind: "site"; v: 1; id: string };
export type SiteRequest =
  | (Asked & { op: "read"; site?: string; ids?: string[] })
  | (Asked & { op: "outline"; site?: string; page?: string })
  | (Asked & { op: "picked"; site?: string })
  | (Asked & { op: "at"; site?: string; x: number; y: number })
  | (Asked & { op: "select"; site?: string; ids: string[] })
  | (Asked & { op: "shot"; site?: string; page?: string; part?: string })
  | (Asked & { op: "apply"; site: string; name: string; steps: SiteStep[]; base?: string });

/** Every field a part has (`board/store/model.ts#StudioNode`), but its ids, which no step may set. A patch naming another changes nothing, so it is refused; `tests/agent-commands.mjs` holds this to the model. */
export const PART_FIELDS: ReadonlySet<string> = new Set(["featureId", "label", "prompt", "content", "x", "y", "w", "h", "groupId", "options", "priority", "custom", "glyph", "hue", "locked", "link", "data", "colour", "font", "anim", "animSpeed", "animDelay", "animEase", "shape", "outline", "kind", "vector", "role", "cube", "mesh", "code", "aura", "auraSize", "auraStyle", "texture", "picture", "pictureVersions", "lookPicture", "sketch", "plan", "small", "widths", "hidden", "from", "byHand", "byState", "place", "handFrom", "state", "layout", "pad", "edge", "radius", "opacity", "art", "motion", "embed", "text", "work", "tour", "task", "worn", "remix", "nowhere", "settled", "hooks", "source", "sys"]);
const NUMBER_FIELDS = ["x", "y", "w", "h"];

/* ---- the slim reads ---- */

/** The first words of a part: its words may be a string or a list of runs. */
export function firstWords(content: unknown, max = 40): string {
  const all = typeof content === "string" ? content : Array.isArray(content) ? content.map((r) => (r as { text?: unknown })?.text ?? "").join("") : "";
  const flat = all.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

type Slim = { id: string; featureId: string; label?: string; x: number; y: number; w: number; h: number; content?: unknown; groupId?: string | null; hidden?: boolean };
export type SlimPart = { id: string; kind: string; box: [number, number, number, number]; words?: string; group?: string; hidden?: true };

/** A part in the outline: id, kind, box, first words, and nothing else unless it holds. */
export function slimPart(n: Slim): SlimPart {
  const words = firstWords(n.content);
  return { id: n.id, kind: n.featureId, box: [Math.round(n.x), Math.round(n.y), Math.round(n.w), Math.round(n.h)], ...(words ? { words } : {}), ...(n.groupId ? { group: n.groupId } : {}), ...(n.hidden ? { hidden: true as const } : {}) };
}

/** A part as drawn, for `underPoint`: its box on the page, its stack level, and its place among its siblings. */
export type Drawn = { id: string; x: number; y: number; w: number; h: number; z: number; at: number };

/** The ones at this point, topmost first: the higher level, then the later in the document. */
export function underPoint(parts: readonly Drawn[], x: number, y: number): Drawn[] {
  return parts.filter((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h).sort((a, b) => b.z - a.z || b.at - a.at);
}

/** Why a part's new font can't be what the step asks; null when it can. */
export function fontStepWhy(s: { px?: unknown; face?: unknown; weight?: unknown }): string | null {
  if (s.px === undefined && s.face === undefined && s.weight === undefined) return "say px, face or weight";
  if (s.px !== undefined && !(typeof s.px === "number" && Number.isFinite(s.px) && s.px >= 8 && s.px <= 200)) return `px ${JSON.stringify(s.px)} is not a size from 8 to 200`;
  if (s.face !== undefined && !(typeof s.face === "string" && s.face.trim())) return `face ${JSON.stringify(s.face)} is not a face's name`;
  if (s.weight !== undefined && !(typeof s.weight === "number" && s.weight >= 300 && s.weight <= 800 && s.weight % 100 === 0)) return `weight ${JSON.stringify(s.weight)} is not one of 300 to 800, in hundreds`;
  return null;
}

/** The font a `setFont` step leaves on a part. */
export function fontAfter(n: { featureId: string; font?: Record<string, unknown> | null; from?: unknown }, s: { px?: number; face?: string; weight?: number }, base: number): Record<string, unknown> {
  let part = n as Parameters<typeof fontAtPx>[0];
  if (s.face !== undefined) part = { ...part, font: fontInFace(part.font, s.face.trim()) };
  if (s.px !== undefined) part = { ...part, font: fontAtPx(part, s.px, base) };
  return { ...(part.font ?? {}), ...(s.weight !== undefined ? { weight: s.weight } : {}) };
}

export { drawnPx };

export type SiteReply = { source: "polio-builder"; kind: "site"; v: 1; id: string } & ({ ok: true; result: unknown } | { ok: false; says: string });

/**
 * Fields a step may never name, at any depth, and the words a key-shaped
 * value takes: keys, the Account, publishing, and anything that pairs or
 * presses (the same list `context.ts` keeps for the other direction).
 */
const FORBIDDEN_FIELDS = new Set(["token", "pairToken", "pairing", "auth", "authorization", "secret", "key", "keys", "keyring", "apiKey", "account", "publish", "published", "live", "repo", "bound", "pending", "control", "controls", "do", "press", "id", "pageId"]);
const KEY_SHAPED = /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|vc[pk]_[A-Za-z0-9]{20,}|Bearer\s+\S{10,})/;

/** The board, as much of it as a check needs. */
export interface BoardLike {
  site: string | null; nodeIds: ReadonlySet<string>; pageIds: ReadonlySet<string>; tokenIds: ReadonlySet<string>;
  /** The board's version now (`versionOf`): a request's `base` must match it. */
  version?: string;
  /** False when the System would refuse this value for this token. */
  tokenTakes?: (id: string, value: string | number) => boolean;
  /** True when a step would leave the board exactly as it is. */
  unchanged?: (step: SiteStep) => boolean;
  /** The groups on the site, for `ungroup`. */
  groupIds?: ReadonlySet<string>;
  /** False for a kind of part the Builder doesn't have. */
  hasKind?: (featureId: string) => boolean;
  /** The page a part is on. */
  pageOf?: (id: string) => string | null;
  /** A part's font, and whether it has words for one to draw. */
  fontOf?: (id: string) => { words: boolean; font: Record<string, unknown> | null } | null;
  /** Why the board can't do this step as it stands (a part with nothing to trade places with); null when it can. */
  cannot?: (step: SiteStep) => string | null;
}

/**
 * The version of a copy of the board: a hash of what it holds, so it moves
 * with any change, undo included, and comes back if the board does. A count
 * of undo steps would not: undo one step and make another, and the count is
 * the same on a different board. FNV-1a and the length; it only has to tell a
 * copy from the one before it.
 */
export function versionOf(copy: unknown): string {
  const text = JSON.stringify(copy) ?? "";
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${text.length.toString(36)}-${(h >>> 0).toString(36)}`;
}

/** Why an apply request must be refused whole; an empty list means it may run. */
export function checkApply(r: unknown, board: BoardLike): string[] {
  const out: string[] = [];
  if (!r || typeof r !== "object") return ["not a request"];
  const q = r as Record<string, unknown>;
  if (q.source !== "polio-dock" || q.kind !== "site" || q.op !== "apply") return ["not a site apply request"];
  if (typeof q.name !== "string" || !q.name.trim()) out.push("a request needs a name, such as \"calmer hero\"");
  if (!board.site || q.site !== board.site) out.push(`the request is for site ${JSON.stringify(q.site)}, but the open site is ${JSON.stringify(board.site)}`);
  /* `base` is optional, so a caller that never sends one still works. Sent, it must be the board as it is now. */
  if (q.base !== undefined && q.base !== board.version) out.push(`this was written against an older copy of the board (${JSON.stringify(q.base)}; the open board is ${JSON.stringify(board.version)}): read the site again and write it against what is there now`);
  if (!Array.isArray(q.steps) || !q.steps.length) return [...out, "a request needs at least one step"];
  const walk = (v: unknown, at: string) => {
    if (typeof v === "string") { if (KEY_SHAPED.test(v)) out.push(`${at} looks like a key`); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${at}[${i}]`)); return; }
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (FORBIDDEN_FIELDS.has(k)) out.push(`${at}.${k} can't be changed by an agent`); walk(x, `${at}.${k}`); }
  };
  /* A part an earlier step of this request adds, by its `as`, is as good as one on the board. */
  const named = new Set<string>();
  const isPart = (id: unknown) => typeof id === "string" && (board.nodeIds.has(id) || named.has(id));
  const notPart = (at: string, id: unknown) => `${at}: part ${JSON.stringify(id)} is not on the open site`;
  const partFields = (patch: Record<string, unknown>, at: string) => {
    for (const k of Object.keys(patch)) if (!PART_FIELDS.has(k) && !FORBIDDEN_FIELDS.has(k)) out.push(`${at}.${k} is not a field a part has, so it would change nothing`);
    for (const k of NUMBER_FIELDS) if (patch[k] !== undefined && !(typeof patch[k] === "number" && Number.isFinite(patch[k]))) out.push(`${at}.${k} must be a number, not ${JSON.stringify(patch[k])}`);
    walk(patch, at);
  };
  (q.steps as unknown[]).forEach((s, i) => {
    const at = `steps[${i}]`;
    if (!s || typeof s !== "object") { out.push(`${at} is not a step`); return; }
    const st = s as Record<string, unknown>;
    if (!(SITE_OPS as readonly unknown[]).includes(st.op)) { out.push(`${at}.op ${JSON.stringify(st.op)} is not a step the board takes`); return; }
    switch (st.op) {
      case "updateNode":
        if (!isPart(st.id)) out.push(notPart(at, st.id));
        if (!st.patch || typeof st.patch !== "object" || !Object.keys(st.patch as object).length) out.push(`${at}: an empty patch`);
        else {
          partFields(st.patch as Record<string, unknown>, `${at}.patch`);
          /* The two writes that "succeed" and draw nothing: the size the document shows, and a new face under the old stack. */
          const font = (st.patch as { font?: Record<string, unknown> | null }).font;
          const now = typeof st.id === "string" ? board.fontOf?.(st.id)?.font : null;
          if (font && typeof font === "object") {
            if (font.px !== undefined && font.px !== now?.px) out.push(`${at}.patch.font.px is not what is drawn: use setFont {id, px}, which is`);
            if (font.face !== undefined && font.face !== now?.face && font.stack) out.push(`${at}.patch.font.face would stay hidden under font.stack: use setFont {id, face}`);
          }
        }
        break;
      case "addNode":
        if (typeof st.featureId !== "string" || (board.hasKind && !board.hasKind(st.featureId))) out.push(`${at}: the Builder has no part of kind ${JSON.stringify(st.featureId)}`);
        for (const k of ["x", "y"]) if (typeof st[k] !== "number" || !Number.isFinite(st[k])) out.push(`${at}.${k} must be a number, not ${JSON.stringify(st[k])}`);
        if (st.page !== undefined && (typeof st.page !== "string" || !board.pageIds.has(st.page))) out.push(`${at}: page ${JSON.stringify(st.page)} is not on the open site`);
        if (st.patch !== undefined) {
          if (!st.patch || typeof st.patch !== "object" || Array.isArray(st.patch)) out.push(`${at}.patch is not a patch`);
          else partFields(st.patch as Record<string, unknown>, `${at}.patch`);
        }
        if (st.as !== undefined) {
          if (typeof st.as !== "string" || !st.as.trim()) out.push(`${at}.as is not a name`);
          else if (isPart(st.as)) out.push(`${at}.as ${JSON.stringify(st.as)} is already a part's name`);
          else named.add(st.as);
        }
        break;
      case "group": {
        if (!Array.isArray(st.ids) || st.ids.length < 2) { out.push(`${at}: a group needs at least two parts`); break; }
        for (const id of st.ids) if (!isPart(id)) out.push(notPart(at, id));
        const pages = new Set(st.ids.filter((id) => typeof id === "string" && board.nodeIds.has(id)).map((id) => board.pageOf?.(id as string)));
        if (pages.size > 1) out.push(`${at}: a group's parts must be on one page`);
        if (st.label !== undefined) { if (typeof st.label !== "string") out.push(`${at}.label is not words`); else walk(st.label, `${at}.label`); }
        break;
      }
      case "ungroup":
        if (typeof st.group !== "string" || !board.groupIds?.has(st.group)) out.push(`${at}: group ${JSON.stringify(st.group)} is not on the open site`);
        break;
      case "reorder": {
        const ways = [st.to, st.above, st.below].filter((v) => v !== undefined).length;
        if (!isPart(st.id)) out.push(notPart(at, st.id));
        if (ways !== 1) out.push(`${at}: say one of to, above or below`);
        if (st.to !== undefined && !(REORDERS as readonly unknown[]).includes(st.to)) out.push(`${at}.to ${JSON.stringify(st.to)} is not one of ${REORDERS.join(", ")}`);
        for (const k of ["above", "below"]) if (st[k] !== undefined) {
          if (!isPart(st[k])) out.push(notPart(at, st[k]));
          else if (st[k] === st.id) out.push(`${at}.${k}: a part can't move relative to itself`);
          else if (typeof st.id === "string" && board.nodeIds.has(st.id) && board.nodeIds.has(st[k] as string) && board.pageOf?.(st.id) !== board.pageOf?.(st[k] as string)) out.push(`${at}.${k}: the two parts are on different pages`);
        }
        break;
      }
      case "setFont": {
        if (!isPart(st.id)) out.push(notPart(at, st.id));
        const why = fontStepWhy(st);
        if (why) out.push(`${at}: ${why}`);
        else if (typeof st.face === "string") walk(st.face, `${at}.face`);
        const now = typeof st.id === "string" && board.nodeIds.has(st.id) ? board.fontOf?.(st.id) : null;
        if (now && !now.words && !now.font) out.push(`${at}: part ${JSON.stringify(st.id)} has no words for a font to draw`);
        break;
      }
      case "updatePage":
        if (typeof st.id !== "string" || !board.pageIds.has(st.id)) out.push(`${at}: page ${JSON.stringify(st.id)} is not on the open site`);
        if (!st.patch || typeof st.patch !== "object" || !Object.keys(st.patch as object).length) out.push(`${at}: an empty patch`);
        else walk(st.patch, `${at}.patch`);
        break;
      case "setLook":
        if (!st.patch || typeof st.patch !== "object" || !Object.keys(st.patch as object).length) out.push(`${at}: an empty patch`);
        else walk(st.patch, `${at}.patch`);
        break;
      case "removeNodes":
        if (!Array.isArray(st.ids) || !st.ids.length) out.push(`${at}: no parts to remove`);
        else for (const id of st.ids) if (!isPart(id)) out.push(notPart(at, id));
        break;
      case "setToken":
        if (typeof st.id !== "string" || !board.tokenIds.has(st.id)) out.push(`${at}: token ${JSON.stringify(st.id)} is not in the open site's System`);
        if (typeof st.value !== "string" && typeof st.value !== "number") out.push(`${at}: a token takes a string or a number`);
        else {
          walk(st.value, `${at}.value`);
          if (typeof st.id === "string" && board.tokenIds.has(st.id) && board.tokenTakes && !board.tokenTakes(st.id, st.value)) out.push(`${at}: token ${JSON.stringify(st.id)} can't hold ${JSON.stringify(st.value)}`);
        }
        break;
    }
  });
  /* Only a request that is otherwise good: what the board itself can't do now. */
  if (!out.length && board.cannot) (q.steps as SiteStep[]).forEach((s, i) => { const why = board.cannot!(s); if (why) out.push(`steps[${i}]: ${why}`); });
  /* Only a request that is otherwise good: nothing to change would still leave an empty undo step. */
  if (!out.length && board.unchanged && (q.steps as SiteStep[]).every(board.unchanged)) out.push("nothing would change: every step already matches the board");
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
