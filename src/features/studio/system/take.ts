/**
 * TAKE THE SYSTEM FROM THIS SITE.
 *
 * Reads what the Builder already works out about a captured site and turns
 * it into stored tokens and components, then points each part's fields at
 * them. NOTHING MOVES: every token is a value the site itself wears, exactly
 * as captured, and a field points at a token only when its own value is that
 * token's value. Tidying (snapping sizes to a scale, merging close shades)
 * is a separate step that "Make a better version" asks for; it is not here.
 *
 *   · colours: the six roles (`paletteFrom.ts`, already the site's
 *     `look.palette`), then every colour two parts or more wear, named by
 *     what it is for: the site's own kinds of surface (`themeKinds.ts`:
 *     "Main fill", "Panels"), else its role as a person thinks of it
 *     (`siteRoles.ts`: "Buttons", "Outline"), else its colour's name. Close
 *     shades keep their own tokens and are grouped (`swatch`, `lead`), so a
 *     part never changes colour by being linked;
 *   · type: the sizes and faces two parts or more wear, each a step or a
 *     face; the nearest even scale is worked out and offered, never applied;
 *   · space: the paddings and gaps two parts or more wear;
 *   · corners and shadows: the radii and box-shadows two parts or more wear;
 *   · motion: the transition durations and easings two parts or more wear;
 *   · components: every component `components.ts` reads (button, card, tab,
 *     badge, …), one System component per kind, its variants the distinct
 *     looks its instances wear, named after the style kits (`styleKits.ts`)
 *     where a kit was read off the same parts, with the hover and press the
 *     kits read from captured motion.
 *
 * A value worn once is a one-off: it keeps its own value and no pointer.
 *
 * Pure: no React, no store. `tests/system-take.mjs`.
 */
import { colourKey, kitsFromDoc, parseShadows, ROLES, ROLE_LABEL, type KitDoc, type KitShadow, type KitState, type Palette, type RoleId, type StyleKit } from "../look/index.ts";
import { componentSpec, componentsOf, KIND_WORD, type CompNode, type ComponentKind } from "../components.ts";
import { siteRoles, colourName, ROLE_LABEL as USE_LABEL, type Part } from "../siteRoles.ts";
import { siteKinds } from "../themeKinds.ts";
import {
  emptyTokens, FIXED_FIELDS, ID_PREFIX, kindOfField, newSystemId, SYSTEM_KIND, SYSTEM_VERSION,
  type ColourToken, type CssToken, type FaceToken, type FieldPath, type LookRef, type LookRefs, type NodeSys, type SizeToken, type StateLook, type System, type SystemComponent, type TokenKind, type Variant,
} from "./model.ts";
import { fieldValue, sameValue, type SysNode } from "./resolve.ts";

/** A part as taking reads it: what the colour, kit and component readers take, and the fields tokens point at. */
export type TakeNode = SysNode & Part & CompNode & { pageId?: string };

export interface TakeInput {
  nodes: readonly TakeNode[];
  /** The site's six roles, resolved (`resolvePalette`): what a part naming a role draws. */
  palette: Palette;
  frameWidth?: number;
  name?: string | null;
  host?: string | null;
  /** Kept when taking again, so the site's System keeps its id and every site using it follows. */
  id?: string;
  at?: number;
}

export interface TakeReport {
  found: { colours: number; sizes: number; faces: number; space: number; corners: number; shadows: number; durations: number; easings: number; components: number; variants: number };
  /** Values that now point at a token: fields linked, and colours already naming a palette role (which follow the role tokens). */
  linked: number;
  /** Values that keep their own, worn by one part only or not a token's value. */
  oneOffs: number;
  /** Parts linked to a component's variant. */
  instances: number;
}

export interface Taken { system: System; links: Map<string, NodeSys>; report: TakeReport }

/** Worn by this many parts or more, a value is a token. One part is a one-off. */
export const TOKEN_MIN = 2;

const isRoleName = (v: unknown): v is RoleId => typeof v === "string" && (ROLES as readonly string[]).includes(v);

/** A field worth a token: it holds a value of its kind (a drawn edge for an edge colour; no `none` shadow; no zero spacing). */
function linkable(n: TakeNode, f: string, kind: TokenKind): boolean {
  const v = fieldValue(n, f);
  if (v === undefined || v === "") return false;
  if (kind === "colour") {
    if (isRoleName(v) || typeof v !== "string" || !colourKey(v)) return false;
    if (f === "edge.colour") return (n.edge?.width ?? 1) > 0 && n.edge?.style !== "none";
    return true;
  }
  if (kind === "shadow" || kind === "duration" || kind === "easing") return typeof v === "string" && !!v.trim() && v.trim() !== "none";
  if (kind === "face") return typeof v === "string" && !!v.trim();
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/** Every field of a part that could point at a token. */
function fieldsOf(n: TakeNode): FieldPath[] {
  const out: FieldPath[] = [...FIXED_FIELDS];
  (n.motion?.transition ?? []).forEach((_, i) => { out.push(`motion.transition.${i}.duration`, `motion.transition.${i}.timing`); });
  return out;
}

/** The key two values of a kind share when they are one value. */
function keyOf(kind: TokenKind, v: string | number, n?: TakeNode): string {
  if (kind === "colour") return colourKey(String(v));
  if (kind === "face") return `${String(v).trim().replace(/\s+/g, " ")}|${n?.font?.face ?? ""}`;
  if (typeof v === "number") return String(v);
  return v.trim().replace(/\s+/g, " ");
}

interface Tally { value: string | number; face?: string; parts: Set<string>; uses: Set<string> }

const ms = (v: string) => { const m = /^([\d.]+)(ms|s)$/.exec(v.trim().split(/[\s,]/)[0] ?? ""); return m ? Number(m[1]) * (m[2] === "s" ? 1000 : 1) : NaN; };
const blurOf = (css: string) => parseShadows(css).reduce((a, s) => Math.max(a, s.blur + Math.abs(s.dy)), 0);

/** Names that are each the site's own, never twice. */
function namer() {
  const used = new Set<string>();
  return (want: string, or?: string) => {
    let name = want.trim() || "Token";
    if (or && used.has(name.toLowerCase())) name = `${name}, ${or}`;
    for (let k = 2; used.has(name.toLowerCase()); k++) name = `${want} ${k}`;
    used.add(name.toLowerCase());
    return name;
  };
}

/** The nearest even scale to a list of sizes: their middle step, from the body size. */
export function scaleOf(steps: readonly number[], base: number): { ratio: number; base: number } | null {
  const up = [...new Set(steps.filter((s) => s >= base))].sort((a, b) => a - b);
  if (up.length < 3) return null;
  const ratios = up.slice(1).map((s, i) => s / up[i]!).sort((a, b) => a - b);
  const mid = ratios[Math.floor(ratios.length / 2)]!;
  const EVEN = [1.067, 1.125, 1.2, 1.25, 1.333, 1.414, 1.5, 1.618];
  const ratio = EVEN.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a));
  return { ratio, base };
}

const shadowCss = (s: readonly KitShadow[] | null | undefined): string | null =>
  s?.length ? s.map((x) => `${x.dx}px ${x.dy}px ${x.blur}px ${x.spread}px ${x.colour}`).join(", ") : null;
const stateOf = (k: KitState | null | undefined): StateLook | null =>
  k ? { dx: k.dx, dy: k.dy, rotate: k.rotate, scale: k.scale, shadow: shadowCss(k.shadows) } : null;

export function takeSystem(input: TakeInput): Taken {
  const { nodes, palette } = input;
  const at = input.at ?? Date.now();
  const tokens = emptyTokens();
  const counters: Record<TokenKind, number> = { colour: 0, type: 0, face: 0, space: 0, radius: 0, shadow: 0, duration: 0, easing: 0 };
  const nextId = (k: TokenKind) => `${ID_PREFIX[k]}_${++counters[k]}`;

  /* 1. Tally every value each field of each part holds, by kind. */
  const tallies: Record<TokenKind, Map<string, Tally>> = { colour: new Map(), type: new Map(), face: new Map(), space: new Map(), radius: new Map(), shadow: new Map(), duration: new Map(), easing: new Map() };
  let roleValues = 0;
  for (const n of nodes) {
    for (const f of fieldsOf(n)) {
      const kind = kindOfField(f)!;
      const v = fieldValue(n, f);
      if (kind === "colour" && isRoleName(v)) { roleValues++; continue; }
      if (!linkable(n, f, kind)) continue;
      const k = keyOf(kind, v!, n);
      const t = tallies[kind].get(k) ?? { value: v!, ...(kind === "face" && n.font?.face ? { face: n.font.face } : {}), parts: new Set<string>(), uses: new Set<string>() };
      t.parts.add(n.id);
      t.uses.add(f);
      tallies[kind].set(k, t);
    }
  }
  const worn = (kind: TokenKind) => [...tallies[kind].entries()].filter(([, t]) => t.parts.size >= TOKEN_MIN);

  /* 2. Colours: the six roles first, then the site's own, named by what they are for. */
  const colourName_ = namer();
  const byKey = new Map<string, ColourToken>();
  for (const role of ROLES) {
    const v = palette[role];
    if (!v || !colourKey(v)) continue;
    const t: ColourToken = { id: nextId("colour"), name: colourName_(ROLE_LABEL[role] ?? role), value: v, role };
    tokens.colour.push(t);
    if (!byKey.has(colourKey(v))) byKey.set(colourKey(v), t);
  }
  const roles = siteRoles(nodes as readonly Part[], palette, input.frameWidth || 1440);
  const swatchOf = new Map<string, { id: string; use: string; lead: boolean }>();
  for (const sw of [...roles.short.flatMap((r) => r.swatches), ...roles.more]) {
    sw.shades.forEach((shade, i) => { if (!swatchOf.has(shade)) swatchOf.set(shade, { id: sw.id, use: USE_LABEL[sw.role] ?? sw.role, lead: i === 0 }); });
  }
  const kinds = siteKinds(nodes as never, palette, new Set(roles.left.backgroundLayers));
  const kindOf = new Map<string, string>();
  for (const k of kinds.kinds) for (const shade of [k.fill, ...k.shades]) if (!kindOf.has(colourKey(shade))) kindOf.set(colourKey(shade), k.name);
  const colours = worn("colour").sort((a, b) => b[1].parts.size - a[1].parts.size);
  for (const [k, t] of colours) {
    if (byKey.has(k)) continue;
    const sw = swatchOf.get(k);
    const use = kindOf.get(k) ?? sw?.use;
    const tok: ColourToken = {
      id: nextId("colour"),
      name: use ? colourName_(use, colourName(String(t.value)).toLowerCase()) : colourName_(colourName(String(t.value))),
      value: String(t.value),
      ...(use ? { use } : {}),
      ...(sw ? { swatch: sw.id, lead: sw.lead } : {}),
    };
    tokens.colour.push(tok);
    byKey.set(k, tok);
  }

  /* 3. Type: steps largest first, named round the size most parts wear; faces by name. */
  const sizes = worn("type").map(([, t]) => ({ px: Number(t.value), parts: t.parts.size })).sort((a, b) => b.px - a.px);
  const body = [...sizes].sort((a, b) => b.parts - a.parts)[0]?.px ?? 16;
  const above = sizes.filter((s) => s.px > body), below = sizes.filter((s) => s.px < body).sort((a, b) => b.px - a.px);
  const typeName = namer();
  /* The largest is the display size, the next three the headings, any others between them and the body "Large". */
  for (const [i, s] of above.entries()) tokens.type.steps.push({ id: nextId("type"), name: typeName(i === 0 ? "Display" : i <= 3 ? `Heading ${i}` : `Large ${i - 3}`), px: s.px });
  if (sizes.some((s) => s.px === body)) tokens.type.steps.push({ id: nextId("type"), name: typeName("Body"), px: body });
  for (const [i, s] of below.entries()) tokens.type.steps.push({ id: nextId("type"), name: typeName(i === 0 ? "Small" : `Small ${i + 1}`), px: s.px });
  tokens.type.scale = scaleOf(sizes.map((s) => s.px), body);
  const faceName = namer();
  for (const [, t] of worn("face").sort((a, b) => b[1].parts.size - a[1].parts.size)) {
    const stack = String(t.value);
    const first = stack.split(",")[0]!.trim().replace(/^["']|["']$/g, "");
    tokens.type.faces.push({ id: nextId("face"), name: faceName(t.face || first || "Face"), ...(t.face ? { face: t.face } : {}), stack });
  }

  /* 4. Space, corners, shadows: smallest first. */
  for (const [i, [, t]] of worn("space").sort((a, b) => Number(a[1].value) - Number(b[1].value)).entries()) tokens.space.push({ id: nextId("space"), name: `Space ${i + 1}`, px: Number(t.value) });
  const CORNER = ["Small", "Medium", "Large", "Larger", "Largest"];
  const radii = worn("radius").map(([, t]) => Number(t.value)).sort((a, b) => a - b);
  const cornerName = namer();
  radii.forEach((px, i) => tokens.radius.push({ id: nextId("radius"), name: cornerName(px >= 999 ? "Round" : CORNER[i] ?? `Corner ${i + 1}`), px }));
  const SHADOW = ["Low", "Medium", "High", "Higher", "Highest"];
  const shadows = worn("shadow").map(([, t]) => String(t.value)).sort((a, b) => blurOf(a) - blurOf(b));
  shadows.forEach((css, i) => tokens.shadow.push({ id: nextId("shadow"), name: SHADOW[i] ?? `Shadow ${i + 1}`, css }));
  const SPEED = ["Quick", "Normal", "Slow", "Slower", "Slowest"];
  worn("duration").map(([, t]) => String(t.value)).sort((a, b) => (ms(a) || 0) - (ms(b) || 0)).forEach((css, i) => tokens.motion.durations.push({ id: nextId("duration"), name: SPEED[i] ?? `Duration ${i + 1}`, css }));
  const easeName = namer();
  worn("easing").sort((a, b) => b[1].parts.size - a[1].parts.size).forEach(([, t], i) => {
    const css = String(t.value);
    tokens.motion.easings.push({ id: nextId("easing"), name: easeName(/^[a-z-]+$/.test(css.trim()) ? css.trim() : `Easing ${i + 1}`), css });
  });

  /* 5. Point each part's fields at the tokens that hold their values, exactly. */
  const index: Record<TokenKind, Map<string, string>> = {
    colour: new Map([...byKey].map(([k, t]) => [k, t.id])),
    type: new Map(tokens.type.steps.map((t) => [keyOf("type", t.px), t.id])),
    face: new Map(tokens.type.faces.map((t) => [`${t.stack.trim().replace(/\s+/g, " ")}|${t.face ?? ""}`, t.id])),
    space: new Map(tokens.space.map((t) => [keyOf("space", t.px), t.id])),
    radius: new Map(tokens.radius.map((t) => [keyOf("radius", t.px), t.id])),
    shadow: new Map(tokens.shadow.map((t) => [keyOf("shadow", t.css), t.id])),
    duration: new Map(tokens.motion.durations.map((t) => [keyOf("duration", t.css), t.id])),
    easing: new Map(tokens.motion.easings.map((t) => [keyOf("easing", t.css), t.id])),
  };
  const id = input.id ?? newSystemId();
  const links = new Map<string, NodeSys>();
  let linked = roleValues, oneOffs = 0;
  for (const n of nodes) {
    const f: Partial<Record<FieldPath, string>> = {};
    const held: Partial<Record<FieldPath, string | number>> = {};
    for (const field of fieldsOf(n)) {
      const kind = kindOfField(field)!;
      if (!linkable(n, field, kind)) continue;
      const tid = index[kind].get(keyOf(kind, fieldValue(n, field)!, n));
      if (tid) { f[field] = tid; held[field] = fieldValue(n, field)!; linked++; } else oneOffs++;
    }
    if (Object.keys(f).length) links.set(n.id, { s: id, f, v: held });
  }

  /* 6. Components: one per kind, a variant per look its instances wear. */
  const comps = componentsOf(nodes as readonly CompNode[], palette as Record<string, string>);
  const kitDoc: KitDoc = { nodes: nodes as unknown as KitDoc["nodes"], palette, name: input.name ?? null, host: input.host ?? null };
  const kits: StyleKit[] = kitsFromDoc(kitDoc);
  const kitOf = new Map<string, StyleKit>();
  for (const k of kits) for (const pid of k.from) if (!kitOf.has(pid)) kitOf.set(pid, k);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ref = (kind: TokenKind, v: string | number | null | undefined): LookRef | undefined => {
    if (v === null || v === undefined || v === "") return undefined;
    const tid = index[kind].get(keyOf(kind, v));
    return tid ? { token: tid } : { value: v };
  };
  const components: SystemComponent[] = [];
  let instances = 0, variantCount = 0;
  const groups = new Map<ComponentKind, typeof comps.list>();
  for (const c of comps.list) groups.set(c.kind, [...(groups.get(c.kind) ?? []), c]);
  for (const [kind, list] of groups) {
    const variants: (Variant & { sig: string; hosts: string[]; layers: SystemComponent["parts"] })[] = [];
    for (const c of list) {
      const spec = componentSpec(nodes as readonly CompNode[], c, palette as Record<string, string>);
      const wordsNode = c.paints.words[0] ? byId.get(c.paints.words[0]) : undefined;
      const face = wordsNode?.font?.stack;
      const size = wordsNode?.font?.px;
      const look: LookRefs = {};
      const put = (slot: keyof LookRefs, r: LookRef | undefined) => { if (r) look[slot] = r; };
      put("fill", ref("colour", spec.fill));
      put("words", ref("colour", spec.words));
      put("outline", ref("colour", spec.outline?.colour ?? null));
      put("shadow", spec.shadow && !/^rgba?\(|^#/.test(spec.shadow) ? ref("shadow", spec.shadow) : ref("colour", spec.shadow));
      put("radius", ref("radius", spec.radius && spec.radius > 0 ? spec.radius : null));
      put("face", face ? (() => { const tid = index.face.get(`${face.trim().replace(/\s+/g, " ")}|${wordsNode?.font?.face ?? ""}`); return tid ? { token: tid } : { value: face }; })() : undefined);
      put("size", ref("type", typeof size === "number" ? size : null));
      const sig = JSON.stringify(look);
      let v = variants.find((x) => x.sig === sig);
      if (!v) {
        const kit = [c.id, ...c.parts].map((p) => kitOf.get(p)).find(Boolean);
        v = {
          id: `var_${variants.length + 1}`, name: "", look, sig, hosts: [], count: 0,
          states: { hover: stateOf(kit?.hover), pressed: stateOf(kit?.press), focus: null, disabled: null },
          layers: spec.layers.map(({ role, x, y, w, h }) => ({ role, x, y, w, h })),
        };
        (v as { kitName?: string }).kitName = kit?.name;
        variants.push(v);
      }
      v.count++;
      v.hosts.push(c.id);
    }
    variants.sort((a, b) => b.count - a.count);
    const vName = namer();
    variants.forEach((v, i) => {
      v.id = `var_${i + 1}`;
      /* A kit's name less its site ("trorty button, green border" → "Green border"); the first kit of a role is the role's own look. */
      const kitName = (v as { kitName?: string }).kitName;
      const said = kitName?.includes(", ") ? kitName.slice(kitName.indexOf(", ") + 2) : null;
      const word = said ? said.charAt(0).toUpperCase() + said.slice(1) : i === 0 ? "Main" : `${KIND_WORD[kind]} ${i + 1}`;
      v.name = vName(word);
    });
    const cid = `cmp_${kind}`;
    for (const v of variants) for (const h of v.hosts) {
      const had = links.get(h);
      links.set(h, { ...(had ?? { s: id }), c: { component: cid, variant: v.id } });
      instances++;
    }
    variantCount += variants.length;
    components.push({
      id: cid, name: KIND_WORD[kind], kind, base: variants[0]?.look ?? {},
      variants: variants.map(({ sig: _s, hosts: _h, layers: _l, ...v }) => { void _s; void _h; void _l; const { kitName: _k, ...rest } = v as typeof v & { kitName?: string }; void _k; return rest; }),
      parts: variants[0]?.layers ?? [],
    });
  }

  const system: System = {
    kind: SYSTEM_KIND, version: SYSTEM_VERSION, id,
    name: input.name?.trim() || input.host || "This site",
    from: "captured", forkOf: null,
    taken: { site: input.name?.trim() || "", host: input.host ?? null },
    rev: 1, editedAt: at, tokens, components,
  };
  return {
    system, links,
    report: {
      found: {
        colours: tokens.colour.length, sizes: tokens.type.steps.length, faces: tokens.type.faces.length, space: tokens.space.length,
        corners: tokens.radius.length, shadows: tokens.shadow.length, durations: tokens.motion.durations.length, easings: tokens.motion.easings.length,
        components: components.length, variants: variantCount,
      },
      linked, oneOffs, instances,
    },
  };
}

/** The part with its System link set (or taken off, for null); the same part when it already is. */
export function withSys<N extends { sys?: NodeSys | null }>(n: N, sys: NodeSys | null | undefined): N {
  if (!sys) { if (!n.sys) return n; const { sys: _s, ...rest } = n; void _s; return rest as N; }
  return JSON.stringify(n.sys ?? null) === JSON.stringify(sys) ? n : { ...n, sys };
}

/** Check: every linked field holds its token's value now. A take that broke this would move a part. */
export function linksHold(nodes: readonly SysNode[], s: System): { field: string; node: string }[] {
  const bad: { field: string; node: string }[] = [];
  const tokenValue = (tid: string) => {
    const t = [...s.tokens.colour, ...s.tokens.type.steps, ...s.tokens.type.faces, ...s.tokens.space, ...s.tokens.radius, ...s.tokens.shadow, ...s.tokens.motion.durations, ...s.tokens.motion.easings].find((x) => x.id === tid) as ColourToken | SizeToken | CssToken | FaceToken | undefined;
    return t ? ("px" in t ? t.px : "css" in t ? t.css : "stack" in t ? t.stack : t.value) : undefined;
  };
  for (const n of nodes) for (const [f, tid] of Object.entries(n.sys?.f ?? {})) {
    const kind = kindOfField(f);
    if (!kind || !tid || !sameValue(kind, fieldValue(n, f), tokenValue(tid))) bad.push({ field: f, node: n.id });
  }
  return bad;
}
