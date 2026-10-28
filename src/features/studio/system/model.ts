/**
 * THE SYSTEM: a site's named values (tokens) and named kinds of part
 * (components), kept once in a shared library and pointed at by every site
 * that uses it (J, 2026-10-22, Q5: "sites share one library").
 *
 * Words, as the proposal uses them (handovers/CREATE-SYSTEM-PROPOSAL.md):
 *
 *   · TOKEN: a named value, like "accent" or "space 4". A part's field that
 *     points at a token draws the token's value, so changing the token
 *     changes every part pointing at it, on every site using the System.
 *   · COMPONENT: a named kind of part (button, card, tab) with VARIANTS
 *     (primary, ghost) and STATES (rest, hover, pressed, focus, disabled).
 *   · INSTANCE: one part on the board linked to a component's variant.
 *
 * Where things live:
 *
 *   · the library (`store.ts`, `builder.systems`): every System, once; saved
 *     to the account with the shelf things (`data/prefs.json`, `sync.ts`);
 *   · the document: `doc.systemId` names the one this site uses, and
 *     `doc.system` keeps this site's copy of it, so a backup, a published
 *     document and a browser without the library still carry it, and undo
 *     can take a token change back (`api.ts#reconcile`);
 *   · each part: `node.sys` — which System, which of its fields point at
 *     which token, and which component and variant it is an instance of.
 *     A field with no ref keeps its own value, exactly as today.
 *
 * Pure: no React, no store, every import ends in .ts, so node tests load it.
 */
import type { RoleId } from "../look/index.ts";
import type { ComponentKind, LayerRole } from "../components.ts";

export const SYSTEM_KIND = "polio-system";
export const SYSTEM_VERSION = 1;

/** What a token holds. Each field a part can point with is one of these. */
export type TokenKind = "colour" | "type" | "face" | "space" | "radius" | "shadow" | "duration" | "easing";
export const TOKEN_KINDS: readonly TokenKind[] = ["colour", "type", "face", "space", "radius", "shadow", "duration", "easing"];
/** The prefix every token id of a kind carries, so an id says what it is. */
export const ID_PREFIX: Record<TokenKind, string> = { colour: "col", type: "typ", face: "fac", space: "spc", radius: "rad", shadow: "shd", duration: "dur", easing: "eas" };

/** A colour token. `role` ties it to one of the six palette roles (the site's `look.palette`); `swatch` groups close shades (`siteRoles.ts`), led by the one with `lead`. */
export interface ColourToken {
  id: string;
  name: string;
  /** The colour exactly as captured (`rgb(26, 15, 11)`), never rounded. */
  value: string;
  role?: RoleId;
  /** What it is for, in a person's words ("Buttons", "Outline"), from `siteRoles`/`themeKinds`. */
  use?: string;
  swatch?: string;
  lead?: boolean;
}
/** A size, in px: a type step, a space step, a corner. */
export interface SizeToken { id: string; name: string; px: number }
/** A CSS value kept as written: a shadow, a duration (`0.3s`), an easing (`ease-out`). */
export interface CssToken { id: string; name: string; css: string }
/** A face: the name the page used and the whole stack it wrote. */
export interface FaceToken { id: string; name: string; face?: string; stack: string }

export interface SystemTokens {
  colour: ColourToken[];
  type: {
    faces: FaceToken[];
    /** The nearest even scale to the steps: offered, never forced (`take.ts#scaleOf`). Null when there are too few steps to say. */
    scale: { ratio: number; base: number } | null;
    steps: SizeToken[];
  };
  space: SizeToken[];
  radius: SizeToken[];
  shadow: CssToken[];
  motion: { durations: CssToken[]; easings: CssToken[] };
}

/** A component field: a token's id, or a value of its own (a one-off). */
export type LookRef = { token: string } | { value: string | number };
/** The fields a component holds: the eight facets of a part look, as far as a captured part has them. */
export type LookSlot = "fill" | "words" | "outline" | "shadow" | "radius" | "face" | "size";
export type LookRefs = Partial<Record<LookSlot, LookRef>>;
export const LOOK_SLOT_NAMES: readonly LookSlot[] = ["fill", "words", "outline", "shadow", "radius", "face", "size"];
/** What a state changes under the hand, as captured (`styleKits.ts#KitState`), with its shadow as CSS. */
export interface StateLook { dx: number; dy: number; rotate: number; scale: number; shadow: string | null }
export type StateName = "rest" | "hover" | "pressed" | "focus" | "disabled";
export const STATE_NAMES: readonly StateName[] = ["rest", "hover", "pressed", "focus", "disabled"];

export interface Variant {
  id: string;
  name: string;
  look: LookRefs;
  /** `rest` is the look itself; the others are what the page did, or null where it did nothing (focus and disabled are not captured as looks yet). */
  states: { hover: StateLook | null; pressed: StateLook | null; focus: StateLook | null; disabled: StateLook | null };
  /** Instances on the site it was taken from, when it was taken. */
  count: number;
}

export interface SystemComponent {
  id: string;
  name: string;
  kind: ComponentKind;
  /** The most-used variant's look: what a new instance wears. */
  base: LookRefs;
  variants: Variant[];
  /** The layered parts an instance is made of, by job, boxes as shares of the host (`components.ts#componentSpec`). */
  parts: { role: LayerRole; x: number; y: number; w: number; h: number }[];
}

export interface System {
  kind: typeof SYSTEM_KIND;
  version: typeof SYSTEM_VERSION;
  id: string;
  name: string;
  from: "captured" | "theme" | "brief" | "copied";
  /** The System this one was forked from, when it was. */
  forkOf?: string | null;
  /** The site it was taken from: its name and host. */
  taken?: { site: string; host: string | null } | null;
  /** Bumped by every change: what draws and caches key on. */
  rev: number;
  /** When it last changed: the account keeps the later of two copies (`sync.ts`). */
  editedAt: number;
  /**
   * When it was made the house style: the one System every site uses unless
   * it takes its own (J, 2026-10-24). One at a time; where two copies both
   * say so (two browsers), the later mark is the house style (`store.ts#houseOf`).
   */
  house?: number;
  tokens: SystemTokens;
  components: SystemComponent[];
}

/* ------------------------------------------------------------------ */
/* On each part                                                        */
/* ------------------------------------------------------------------ */

/**
 * The fields of a part that can point at a token, and the kind of token each
 * takes. Every one is a field the part already has and draws; pointing it at
 * a token adds nothing to how it is drawn, only where the value comes from.
 */
export const FIELD_KIND = {
  "colour.bg": "colour",
  "colour.surface": "colour",
  "colour.text": "colour",
  "colour.muted": "colour",
  "colour.accent": "colour",
  "colour.highlight": "colour",
  "edge.colour": "colour",
  "edge.shadow": "shadow",
  radius: "radius",
  "pad.top": "space",
  "pad.right": "space",
  "pad.bottom": "space",
  "pad.left": "space",
  "layout.gap": "space",
  "font.px": "type",
  "font.stack": "face",
} as const satisfies Record<string, TokenKind>;
export type FixedField = keyof typeof FIELD_KIND;
/** A captured transition's duration and easing, by its place in `motion.transition`. */
export type MotionField = `motion.transition.${number}.duration` | `motion.transition.${number}.timing`;
export type FieldPath = FixedField | MotionField;
export const FIXED_FIELDS = Object.keys(FIELD_KIND) as FixedField[];

export function kindOfField(f: string): TokenKind | null {
  if (f in FIELD_KIND) return FIELD_KIND[f as FixedField];
  const m = /^motion\.transition\.\d+\.(duration|timing)$/.exec(f);
  return m ? (m[1] === "duration" ? "duration" : "easing") : null;
}

/** A part's place in a System. Optional on every part: absent, it draws exactly as it always did. */
export interface NodeSys {
  /** The System's id. */
  s: string;
  /** Field → token id. */
  f?: Partial<Record<FieldPath, string>>;
  /**
   * What each linked field held when it was last written from its token.
   * A field holding something else now was set apart from the System, by a
   * hand (an override: "change just this one") or by whatever draws it (a
   * row's words inset past what stands before them, `leadIn.ts`), and its
   * token does not draw over it. A token change writes both again.
   */
  v?: Partial<Record<FieldPath, string | number>>;
  /**
   * An instance of this component's variant. `own` names the slots it holds
   * as its own ("Change just this one" on the whole part): a change to the
   * variant passes them by until "Reset to the component" (`bind.ts`).
   */
  c?: { component: string; variant: string; own?: LookSlot[] } | null;
}

/* ------------------------------------------------------------------ */
/* Making and reading                                                  */
/* ------------------------------------------------------------------ */

export const emptyTokens = (): SystemTokens => ({
  colour: [], type: { faces: [], scale: null, steps: [] }, space: [], radius: [], shadow: [], motion: { durations: [], easings: [] },
});

export function newSystemId(): string {
  const bytes = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(6)) : Uint8Array.from({ length: 6 }, () => Math.floor(Math.random() * 256));
  return `sys_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function emptySystem(name: string, from: System["from"] = "theme", id = newSystemId(), at = Date.now()): System {
  return { kind: SYSTEM_KIND, version: SYSTEM_VERSION, id, name, from, rev: 1, editedAt: at, tokens: emptyTokens(), components: [] };
}

/** Every token of a System, flat, each with its kind. */
export function allTokens(s: System): { kind: TokenKind; token: ColourToken | SizeToken | CssToken | FaceToken }[] {
  const t = s.tokens;
  return [
    ...t.colour.map((token) => ({ kind: "colour" as const, token })),
    ...t.type.steps.map((token) => ({ kind: "type" as const, token })),
    ...t.type.faces.map((token) => ({ kind: "face" as const, token })),
    ...t.space.map((token) => ({ kind: "space" as const, token })),
    ...t.radius.map((token) => ({ kind: "radius" as const, token })),
    ...t.shadow.map((token) => ({ kind: "shadow" as const, token })),
    ...t.motion.durations.map((token) => ({ kind: "duration" as const, token })),
    ...t.motion.easings.map((token) => ({ kind: "easing" as const, token })),
  ];
}

export function kindOfToken(id: string): TokenKind | null {
  const pre = id.split("_")[0];
  return (Object.keys(ID_PREFIX) as TokenKind[]).find((k) => ID_PREFIX[k] === pre) ?? null;
}

/** A token's value as a part's field holds it: a string for colours, shadows, faces and motion, px for sizes. */
export type TokenValue = string | number;
export function valueOf(token: ColourToken | SizeToken | CssToken | FaceToken): TokenValue {
  if ("px" in token) return token.px;
  if ("css" in token) return token.css;
  if ("stack" in token) return token.stack;
  return token.value;
}

/** The token with this id, by its kind's list. */
export function tokenById(s: System, id: string): ColourToken | SizeToken | CssToken | FaceToken | null {
  const t = s.tokens;
  const kind = kindOfToken(id);
  const list: readonly { id: string }[] =
    kind === "colour" ? t.colour : kind === "type" ? t.type.steps : kind === "face" ? t.type.faces : kind === "space" ? t.space
      : kind === "radius" ? t.radius : kind === "shadow" ? t.shadow : kind === "duration" ? t.motion.durations : kind === "easing" ? t.motion.easings : [];
  return (list.find((x) => x.id === id) as ColourToken | SizeToken | CssToken | FaceToken | undefined) ?? null;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const ID = /^[A-Za-z0-9_-]{1,80}$/;

/**
 * A System read from somewhere that is not this code (the account, a backup,
 * localStorage), strictly: anything that is not what this file says a System
 * is, is dropped, and a System with no id is no System.
 */
export function readSystem(v: unknown): System | null {
  if (!isObj(v) || v.kind !== SYSTEM_KIND || !str(v.id) || !ID.test(v.id)) return null;
  const t = isObj(v.tokens) ? v.tokens : {};
  const list = <T>(x: unknown, ok: (e: Record<string, unknown>) => boolean): T[] => (Array.isArray(x) ? (x.filter((e) => isObj(e) && str(e.id) && ID.test(e.id) && str(e.name) && ok(e)) as T[]) : []);
  const type = isObj(t.type) ? t.type : {};
  const motion = isObj(t.motion) ? t.motion : {};
  const scale = isObj(type.scale) && num(type.scale.ratio) && num(type.scale.base) ? { ratio: type.scale.ratio, base: type.scale.base } : null;
  return {
    kind: SYSTEM_KIND, version: SYSTEM_VERSION, id: v.id,
    name: str(v.name) ? v.name.slice(0, 120) : "A system",
    from: v.from === "captured" || v.from === "brief" || v.from === "copied" ? v.from : "theme",
    forkOf: str(v.forkOf) ? v.forkOf : null,
    taken: isObj(v.taken) && str(v.taken.site) ? { site: v.taken.site, host: str(v.taken.host) ? v.taken.host : null } : null,
    rev: num(v.rev) ? v.rev : 1,
    editedAt: num(v.editedAt) ? v.editedAt : 0,
    ...(num(v.house) && v.house > 0 ? { house: v.house } : {}),
    tokens: {
      colour: list<ColourToken>(t.colour, (e) => str(e.value)),
      type: { faces: list<FaceToken>(type.faces, (e) => str(e.stack)), scale, steps: list<SizeToken>(type.steps, (e) => num(e.px)) },
      space: list<SizeToken>(t.space, (e) => num(e.px)),
      radius: list<SizeToken>(t.radius, (e) => num(e.px)),
      shadow: list<CssToken>(t.shadow, (e) => str(e.css)),
      motion: { durations: list<CssToken>(motion.durations, (e) => str(e.css)), easings: list<CssToken>(motion.easings, (e) => str(e.css)) },
    },
    components: Array.isArray(v.components) ? (v.components.filter((c) => isObj(c) && str(c.id) && str(c.name) && str(c.kind) && Array.isArray(c.variants)) as unknown as SystemComponent[]) : [],
  };
}

/** A node's System link, read strictly; null for anything else. */
export function readNodeSys(v: unknown): NodeSys | null {
  if (!isObj(v) || !str(v.s)) return null;
  const f: Record<string, string> = {};
  if (isObj(v.f)) for (const [k, id] of Object.entries(v.f)) if (str(id) && kindOfField(k)) f[k] = id;
  const own = isObj(v.c) && Array.isArray(v.c.own) ? (v.c.own.filter((x) => (LOOK_SLOT_NAMES as readonly unknown[]).includes(x)) as LookSlot[]) : [];
  const c = isObj(v.c) && str(v.c.component) && str(v.c.variant) ? { component: v.c.component, variant: v.c.variant, ...(own.length ? { own } : {}) } : null;
  const held: Record<string, string | number> = {};
  if (isObj(v.v)) for (const [k, x] of Object.entries(v.v)) if ((str(x) || num(x)) && f[k]) held[k] = x;
  return { s: v.s, ...(Object.keys(f).length ? { f } : {}), ...(Object.keys(held).length ? { v: held } : {}), ...(c ? { c } : {}) };
}
