/**
 * Components: a button, its outline, its shadow, its light, its motion and
 * its words, recognised as ONE thing.
 *
 * THE OWNER: "make sure the builder properly understands and associates a
 * button, its outline, its shadow, its animations and the text within it all
 * as one thing, so it is not just stacked parts in capture order."
 *
 * A captured page arrives as parts stacked in capture order: trumpmorty's
 * BUY $TRORTY is a box (its fill, border, shadow, link and hover), a
 * `::before` gloss over it, and the words on top; parasite's buttons are a
 * box and their words; gotchi's tabs a box, a dot and a label. Each part is
 * placed right, and nothing said they were one. This reads them back as a
 * component: a HOST (the part that paints the element and carries its link
 * and states) and its LAYERS (everything the host holds, each with the job
 * it does: words, lighting, shadow, outline, fill, icon, decoration).
 *
 * Kinds, from the same signals the style kits read (`styleKits.ts`):
 *
 *   · tab: a part the capture recorded as a tab;
 *   · ticker: the band a running marquee is drawn in;
 *   · copy-address bar: a dressed control-sized part holding an address;
 *   · loading bar: a thin painted track holding a thinner painted bar that
 *     starts at its edge, the bar's length the level (J, 2026-10-11, on
 *     sunkcoin's ranked list: its orange and blue bars "are all the same
 *     thing", a loading bar, whatever colour each is);
 *   · button, badge, card, panel: a dressed part (a fill or a border) in the
 *     kits' sizes and roles (`roleOf`).
 *
 * Containment is read as everywhere else in the Builder: the page path the
 * capture recorded when both parts have one, else the box. The innermost
 * component holding a part owns it; a component inside another (a button in
 * a card) is the bigger one's CHILD, not its layer.
 *
 * Nothing is written: the document, and so the published page, is exactly
 * what it was. Lane G's learned library and Lane I's colour roles read the
 * same answer through `componentsOf` (every component, cached per nodes
 * list), `componentOf` (the component a part belongs to) and `countAsOne`
 * (a list of parts counted with each component once).
 *
 * Pure: no React, no store.
 */
import { lookOf, luminanceOf, parseRgba, parseShadows, roleOf, type KitNode } from "./look/index.ts";

export type ComponentKind = "button" | "tab" | "copy-bar" | "progress" | "badge" | "card" | "panel" | "ticker";
export const KIND_WORD: Record<ComponentKind, string> = { button: "Button", tab: "Tab", "copy-bar": "Copy-address bar", progress: "Loading bar", badge: "Badge", card: "Card", panel: "Panel", ticker: "Ticker" };

export type LayerRole = "words" | "lighting" | "shadow" | "outline" | "fill" | "icon" | "decoration";
export const LAYER_WORD: Record<LayerRole, string> = { words: "Words", lighting: "Lighting bar", shadow: "Shadow", outline: "Outline", fill: "Fill", icon: "Icon", decoration: "Decoration" };

/** A part as recognition reads it. */
export interface CompNode extends KitNode {
  pageId?: string;
  data?: string;
  link?: { kind: string; target: string } | null;
  work?: { id: string; also?: { id: string }[] } | null;
  from?: { selector?: string; copy?: string } | null;
  vector?: unknown;
  /** Taken out of its component by hand: a part of its own again. */
  loose?: boolean;
}

/** Which part does each of the element's jobs: the host itself, a layer, or nobody. */
export interface Paints {
  fill: string | null;
  outline: string | null;
  shadow: string | null;
  lighting: string | null;
  words: string[];
  link: string | null;
  hover: string[];
  press: string[];
  motion: string[];
}

export interface Component {
  /** The host's id: a component is named by the part that paints it. */
  id: string;
  kind: ComponentKind;
  pageId: string;
  /** Plain: `Button “BUY $TRORTY”`. */
  name: string;
  layers: { id: string; role: LayerRole }[];
  /** Components inside this one (a button in a card): each its own thing, carried with it. */
  children: string[];
  parent: string | null;
  paints: Paints;
  /** The host and every layer: what one selection moves, resizes and counts once. */
  parts: string[];
}

export interface Components {
  list: Component[];
  byId: Map<string, Component>;
  /** Every part in a component (host or layer) to its innermost component's id. */
  of: Map<string, string>;
}

/* ------------------------------------------------------------------ */
/* Reading                                                              */
/* ------------------------------------------------------------------ */

const wordsOf = (c: unknown): string => (typeof c === "string" ? c : Array.isArray(c) ? c.map((r) => (r && typeof r === "object" && typeof (r as { text?: unknown }).text === "string" ? (r as { text: string }).text : "")).join("") : "");
const pathOf = (n: CompNode) => (n.from?.selector ?? "").trim().replace(/\s*>\s*/g, " > ");
const area = (n: CompNode) => Math.max(0, n.w) * Math.max(0, n.h);
const ADDRESS = /[1-9A-HJ-NP-Za-km-z]{30,}|0x[0-9a-fA-F]{30,}/;
const usesMarquee = (n: CompNode) => !!n.work && (n.work.id === "marquee" || (n.work.also ?? []).some((u) => u.id === "marquee"));
const isPseudo = (n: CompNode) => /^::(before|after)\b/.test((n.label ?? "").trim());

/** Does `o` hold `i`: by the recorded page path when both have one (a pseudo-element is its element's) and it is drawn on or beside it, else wholly inside its box and smaller. */
export function holdsPart(o: CompNode, i: CompNode): boolean {
  if (o.id === i.id || (o.pageId && i.pageId && o.pageId !== i.pageId)) return false;
  const a = pathOf(o), b = pathOf(i);
  if (a && b) {
    /* A copy holds only its own (`owner.ts#sameCopy`). */
    if ((o.from?.copy ?? "") !== (i.from?.copy ?? "")) return false;
    const under = b.startsWith(`${a} > `) || b.startsWith(`${a}::`) || (b === a && isPseudo(i) && !isPseudo(o));
    /* Under it on the page, and drawn on it or just beside it (a shadow layer cast a little outside): a dropdown drawn far away is not one of its layers. */
    const m = 40;
    return under && i.x < o.x + o.w + m && i.x + i.w > o.x - m && i.y < o.y + o.h + m && i.y + i.h > o.y - m;
  }
  const s = 1;
  return i.x >= o.x - s && i.y >= o.y - s && i.x + i.w <= o.x + o.w + s && i.y + i.h <= o.y + o.h + s && area(i) < area(o);
}

/** A bar is this thick or less, and four times as long as thick or more, lying or standing. */
export const BAR_THICK = 16;
const isBar = (n: CompNode) => { const t = Math.min(n.w, n.h), l = Math.max(n.w, n.h); return t > 0 && t <= BAR_THICK && l >= 4 * t; };
const paints = (n: CompNode, palette: Record<string, string | undefined> | null | undefined) => {
  const v = n.colour?.bg ?? n.colour?.surface;
  const c = parseRgba(v && (palette?.[v] ?? v));
  return (!!c && c.a > 0.05) || /gradient\(/.test((n as { art?: { background?: string } | null }).art?.background ?? "");
};

/**
 * The level bar of a loading bar, when `track` is one: a painted bar it holds
 * that starts at its start edge (left, or the foot of a standing one), runs
 * the same way and is no longer than it. Null when it holds none.
 */
export function levelIn(track: CompNode, held: readonly CompNode[], palette?: Record<string, string | undefined> | null): CompNode | null {
  if (track.loose || !isBar(track) || !paints(track, palette)) return null;
  const lying = track.w >= track.h;
  return held.find((m) => m.id !== track.id && !m.loose && isBar(m) && paints(m, palette) && (m.w >= m.h) === lying
    && (lying ? Math.abs(m.x - track.x) <= 3 && m.w <= track.w + 1 : Math.abs(m.y + m.h - (track.y + track.h)) <= 3 && m.h <= track.h + 1)
    && holdsPart(track, m)) ?? null;
}

/** What kind of component a part is the host of, before its layers are read; null when it is none. */
function hostKind(n: CompNode, palette: Record<string, string | undefined> | null | undefined, marqueeIn: boolean): ComponentKind | null {
  if (n.loose) return null;
  if (/^tab\b/i.test((n.label ?? "").trim())) return "tab";
  const look = lookOf(n, palette);
  if (marqueeIn && look) return "ticker";
  const role = roleOf(n);
  if (!role || !look) return null;
  return role;
}

/** The job a layer does for its host. */
function layerRole(l: CompNode, host: CompNode, palette: Record<string, string | undefined> | null | undefined): LayerRole {
  if (wordsOf(l.content).trim()) return "words";
  if (l.featureId === "picture" || l.featureId === "drawn-icon" || l.picture || l.vector) return "icon";
  const bg = parseRgba((l.colour?.bg ?? l.colour?.surface) && (palette?.[l.colour!.bg ?? l.colour!.surface!] ?? (l.colour!.bg ?? l.colour!.surface)));
  const hasBg = !!bg && bg.a > 0.05;
  const hasEdge = (l.edge?.width ?? 0) > 0 && l.edge?.style !== "none";
  const outer = parseShadows(l.edge?.shadow).filter((s) => !s.inset && s.colour.a > 0.02);
  if (hasBg && bg!.a < 0.8 && luminanceOf(bg!) > 0.62 && l.w >= host.w * 0.4 && l.h <= host.h * 0.5) return "lighting";
  const sameSize = Math.abs(l.w - host.w) <= host.w * 0.2 && Math.abs(l.h - host.h) <= host.h * 0.2;
  const shifted = l.x !== host.x || l.y !== host.y;
  if (sameSize && shifted && hasBg && luminanceOf(bg!) < 0.12) return "shadow";
  if (!hasBg && outer.length && !hasEdge) return "shadow";
  if (hasEdge && !hasBg) return "outline";
  if (hasBg && area(l) >= area(host) * 0.6) return "fill";
  return "decoration";
}

/** Who does each job: the host when it paints it itself, else the first layer that does. */
function paintsOf(host: CompNode, layers: { node: CompNode; role: LayerRole }[], palette: Record<string, string | undefined> | null | undefined): Paints {
  const look = lookOf(host, palette);
  const first = (role: LayerRole) => layers.find((l) => l.role === role)?.node.id ?? null;
  const hostShadow = parseShadows(host.edge?.shadow);
  const all = [host, ...layers.map((l) => l.node)];
  return {
    fill: look && look.fill.kind !== "none" ? host.id : first("fill"),
    outline: look?.border ? host.id : first("outline"),
    shadow: hostShadow.some((s) => !s.inset && s.colour.a > 0.02) ? host.id : first("shadow"),
    lighting: look?.bar ? host.id : first("lighting"),
    words: [...(wordsOf(host.content).trim() ? [host.id] : []), ...layers.filter((l) => l.role === "words").map((l) => l.node.id)],
    link: host.link ? host.id : (layers.find((l) => l.node.link)?.node.id ?? null),
    hover: all.filter((n) => n.motion?.hover?.length).map((n) => n.id),
    press: all.filter((n) => n.motion?.active?.length).map((n) => n.id),
    motion: all.filter((n) => n.motion?.animation?.length || n.work).map((n) => n.id),
  };
}

/** The words a component says: its own, else its biggest words, cut short. */
function nameOf(kind: ComponentKind, host: CompNode, layers: { node: CompNode; role: LayerRole }[]): string {
  const quoted = /“([^”]+)”/.exec(host.label ?? "")?.[1];
  const words = wordsOf(host.content).trim() || layers.filter((l) => l.role === "words").sort((a, b) => area(b.node) - area(a.node))[0]?.node.content;
  const say = (quoted ?? (typeof words === "string" ? words : wordsOf(words))).replace(/\s+/g, " ").trim();
  const short = say.length > 32 ? `${say.slice(0, 30)}…` : say;
  return short ? `${KIND_WORD[kind]} “${short}”` : KIND_WORD[kind];
}

/**
 * Every component on every page. Hosts are claimed smallest first, so a part
 * belongs to the innermost component that holds it.
 */
export function readComponents(nodes: readonly CompNode[], palette?: Record<string, string | undefined> | null): Components {
  const list: Component[] = [];
  const byId = new Map<string, Component>();
  const of = new Map<string, string>();
  const pages = new Map<string, CompNode[]>();
  /* A part a press shows (`state`) is read with the others that press shows, never with the page as it opens: the same tab can be both. */
  const stateKey = (n: CompNode) => { const st = (n as { state?: { group?: string; option?: number } | null }).state; return st ? `${st.group}#${st.option}` : ""; };
  for (const n of nodes) { const p = `${n.pageId ?? ""}\u0000${stateKey(n)}`; (pages.get(p) ?? pages.set(p, []).get(p)!).push(n); }
  for (const [key, here] of pages) {
    const pageId = key.split("\u0000")[0]!;
    const sorted = [...here].sort((a, b) => a.y - b.y);
    const ys = sorted.map((n) => n.y);
    const lowerBound = (v: number) => { let lo = 0, hi = ys.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ys[m]! < v) lo = m + 1; else hi = m; } return lo; };
    /* Parts near a host: by box, with room for a shadow layer cast a little outside it. */
    const near = (h: CompNode) => { const out: CompNode[] = []; for (let i = lowerBound(h.y - 40); i < sorted.length && sorted[i]!.y <= h.y + h.h + 40; i++) out.push(sorted[i]!); return out; };
    const marquees = here.filter(usesMarquee);
    const hosts: { node: CompNode; kind: ComponentKind }[] = [];
    /* Loading bars first: the track is the host, its level bar a layer of it, never a badge of its own. */
    const levels = new Map<string, string>();
    for (const n of here) { const lv = levelIn(n, near(n), palette); if (lv && !levels.has(n.id)) levels.set(lv.id, n.id); }
    const tracks = new Set(levels.values());
    for (const n of here) {
      if (levels.has(n.id) && !tracks.has(n.id)) continue;
      if (tracks.has(n.id)) { hosts.push({ node: n, kind: "progress" }); continue; }
      const marqueeIn = marquees.some((m) => m === n || holdsPart(n, m));
      let kind = hostKind(n, palette, marqueeIn);
      if (!kind) continue;
      if ((kind === "button" || kind === "badge" || kind === "card") && n.h <= 140) {
        const words = [wordsOf(n.content), ...near(n).filter((m) => holdsPart(n, m)).map((m) => wordsOf(m.content))].join(" ");
        if (ADDRESS.test(words)) kind = "copy-bar";
      }
      hosts.push({ node: n, kind });
    }
    hosts.sort((a, b) => area(a.node) - area(b.node));
    const hostIds = new Set(hosts.map((h) => h.node.id));
    /*
     * Who a part goes to when more than one component could hold it: the
     * smallest whose box it sits in, else the smallest that holds it by its
     * page path. Two copies of one element (a tab, and the same tab as a
     * press shows it) share a path; the words belong to the copy they are on.
     */
    const inBox = (o: CompNode, i: CompNode) => i.x >= o.x - 1 && i.y >= o.y - 1 && i.x + i.w <= o.x + o.w + 1 && i.y + i.h <= o.y + o.h + 1;
    const best = new Map<string, CompNode>();
    for (const h of hosts) for (const m of near(h.node)) {
      if (m.id === h.node.id || m.loose || hostIds.has(m.id) || !holdsPart(h.node, m)) continue;
      /* A captured component's layers are what was captured with it: a shape drawn on top of it by hand is a thing of its own. */
      if (h.node.from?.selector && !m.from?.selector) continue;
      const had = best.get(m.id);
      if (!had || (inBox(h.node, m) && !inBox(had, m))) best.set(m.id, h.node);
    }
    const claimed = new Map<string, string>();
    for (const h of hosts) {
      const layers: { node: CompNode; role: LayerRole }[] = [];
      const children: string[] = [];
      for (const m of near(h.node)) {
        if (m.id === h.node.id || m.loose || !holdsPart(h.node, m)) continue;
        if (hostIds.has(m.id)) {
          // A component inside this one: its child, unless a smaller one already took it.
          if (!byId.get(m.id)?.parent) children.push(m.id);
          continue;
        }
        if (claimed.has(m.id) || best.get(m.id) !== h.node) continue;
        claimed.set(m.id, h.node.id);
        layers.push({ node: m, role: h.kind === "progress" && levels.get(m.id) === h.node.id ? "fill" : layerRole(m, h.node, palette) });
      }
      const c: Component = {
        id: h.node.id, kind: h.kind, pageId, name: nameOf(h.kind, h.node, layers),
        layers: layers.map((l) => ({ id: l.node.id, role: l.role })), children, parent: null,
        paints: paintsOf(h.node, layers, palette),
        parts: [h.node.id, ...layers.map((l) => l.node.id)],
      };
      for (const k of children) { const kid = byId.get(k); if (kid && !kid.parent) kid.parent = c.id; }
      c.children = children.filter((k) => byId.get(k)?.parent === c.id);
      list.push(c);
      byId.set(c.id, c);
      for (const p of c.parts) of.set(p, c.id);
    }
  }
  return { list, byId, of };
}

/* ------------------------------------------------------------------ */
/* What other lanes call                                                */
/* ------------------------------------------------------------------ */

const cache = new WeakMap<readonly CompNode[], { palette: unknown; read: Components }>();
let last: { sig: string; palette: unknown; read: Components } | null = null;
let generation = 0;

/** What recognition depends on besides where things are: which parts exist, on which page, and which were taken out. */
function structureOf(nodes: readonly CompNode[]): string {
  let s = `${generation}|${nodes.length}|`;
  for (const n of nodes) s += `${n.id}:${n.pageId ?? ""}${n.loose ? "!" : ""};`;
  return s;
}

/**
 * Read the board again on the next call, whatever its structure: after a drag
 * or a resize has ended, when a part may have been put into another.
 */
export function rereadComponents(): void { generation++; }

/**
 * Every component on a board. Read once per structure: a part being dragged
 * does not re-read it on every frame (a component moves as one, so what it
 * holds does not change while it moves); the board calls `rereadComponents`
 * when a drag ends. Lane G's learned library: `componentsOf(nodes).list`,
 * each with its kind, its layers by role and who paints what. Lane I's
 * colour roles: count with `countAsOne`.
 */
export function componentsOf(nodes: readonly CompNode[], palette?: Record<string, string | undefined> | null): Components {
  const key = JSON.stringify(palette ?? null);
  const had = cache.get(nodes);
  if (had && had.palette === key) return had.read;
  const sig = structureOf(nodes);
  const read = last && last.sig === sig && last.palette === key ? last.read : readComponents(nodes, palette);
  last = { sig, palette: key, read };
  cache.set(nodes, { palette: key, read });
  return read;
}

/** Kinds a press grabs whole, like a control: the small things a visitor reads as one. Panels and tickers stay drawn across, as any big holder is. */
export const GRABBED: ReadonlySet<ComponentKind> = new Set(["button", "tab", "copy-bar", "progress", "badge", "card"]);

/** The innermost component a part belongs to, host or layer; null for a part on its own. */
export function componentOf(nodes: readonly CompNode[], partId: string, palette?: Record<string, string | undefined> | null): Component | null {
  const all = componentsOf(nodes, palette);
  const id = all.of.get(partId);
  return id ? all.byId.get(id) ?? null : null;
}

/** Everything a component carries when it is moved: its parts, and its children's, all the way down. */
export function carriedBy(comps: Components, id: string): string[] {
  const c = comps.byId.get(id);
  if (!c) return [];
  return [...c.parts, ...c.children.flatMap((k) => carriedBy(comps, k))];
}

/**
 * A list of parts counted the way a person counts them: every component once
 * (by its host), every part on its own once. For a colour's "used by" list.
 */
export function countAsOne(nodes: readonly CompNode[], partIds: readonly string[], palette?: Record<string, string | undefined> | null): { count: number; components: string[]; loose: string[] } {
  const all = componentsOf(nodes, palette);
  const components = new Set<string>(), loose = new Set<string>();
  for (const id of partIds) {
    const c = all.of.get(id);
    if (c) components.add(c); else loose.add(id);
  }
  return { count: components.size + loose.size, components: [...components], loose: [...loose] };
}

/* ------------------------------------------------------------------ */
/* Editing it as one                                                    */
/* ------------------------------------------------------------------ */

export type Slot = "fill" | "words" | "outline" | "shadow" | "lighting";

/** A colour's alpha kept while its colour changes: a lighting bar stays translucent. */
function withAlpha(colour: string, alphaFrom: string | undefined): string {
  const c = parseRgba(colour), a = parseRgba(alphaFrom ?? "");
  if (!c) return colour;
  const alpha = a && a.a < 1 ? a.a : c.a;
  return alpha < 1 ? `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${+alpha.toFixed(3)})` : `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
}

/** Every colour in a box-shadow value replaced, the outer ones only (an inset light stays light). */
function recolourShadow(css: string, colour: string): string {
  return css.split(/,(?![^(]*\))/).map((one) => (/\binset\b/.test(one) ? one : one.replace(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/gi, (m) => withAlpha(colour, m)))).join(",");
}

/**
 * The change recolouring one of a component's jobs makes, as patches by part
 * id: the fill on whichever part paints the fill, the words on every words
 * layer, the outline on the part that draws the edge, the shadow's outer
 * colours, the lighting bar's colour with its own transparency kept.
 */
export function recolour(nodes: readonly CompNode[], comp: Component, slot: Slot, colour: string): Record<string, Partial<CompNode>> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Record<string, Partial<CompNode>> = {};
  const p = comp.paints;
  if (slot === "fill" && p.fill) {
    const n = byId.get(p.fill)!;
    const gradient = /gradient\(/.test(n.art?.background ?? "");
    out[n.id] = { colour: { ...(n.colour ?? {}), bg: colour, surface: colour }, ...(gradient ? { art: { ...n.art, background: undefined } } : {}) };
  }
  if (slot === "words") for (const id of p.words) { const n = byId.get(id)!; out[id] = { colour: { ...(n.colour ?? {}), text: colour } }; }
  if (slot === "outline" && p.outline) { const n = byId.get(p.outline)!; out[n.id] = { edge: { ...(n.edge ?? {}), colour } }; }
  if (slot === "shadow" && p.shadow) {
    const n = byId.get(p.shadow)!;
    out[n.id] = n.id === comp.id || n.edge?.shadow ? { edge: { ...(n.edge ?? {}), shadow: recolourShadow(n.edge?.shadow ?? "", colour) } } : { colour: { ...(n.colour ?? {}), bg: colour, surface: colour } };
  }
  if (slot === "lighting" && p.lighting && p.lighting !== comp.id) {
    const n = byId.get(p.lighting)!;
    const was = n.colour?.bg ?? n.colour?.surface;
    out[n.id] = { colour: { ...(n.colour ?? {}), bg: withAlpha(colour, was), surface: withAlpha(colour, was) } };
  }
  return out;
}

/** The colour a job is painted in now, for the panel's swatch. */
export function colourOf(nodes: readonly CompNode[], comp: Component, slot: Slot, palette?: Record<string, string | undefined> | null): string | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const role = (v: string | undefined) => (v ? palette?.[v] ?? v : null);
  const p = comp.paints;
  if (slot === "fill" && p.fill) return role(byId.get(p.fill)?.colour?.bg ?? byId.get(p.fill)?.colour?.surface);
  if (slot === "words" && p.words[0]) return role(byId.get(p.words[0])?.colour?.text);
  if (slot === "outline" && p.outline) return role(byId.get(p.outline)?.edge?.colour);
  if (slot === "shadow" && p.shadow) { const n = byId.get(p.shadow); const s = parseShadows(n?.edge?.shadow).find((x) => !x.inset); return s ? `rgb(${s.colour.r}, ${s.colour.g}, ${s.colour.b})` : role(n?.colour?.bg); }
  if (slot === "lighting" && p.lighting && p.lighting !== comp.id) return role(byId.get(p.lighting)?.colour?.bg);
  return null;
}

/**
 * Where each part of a component goes when its host is resized from `from`
 * to `to`: every layer keeps its place and size as a share of the host's
 * box, so the outline, the shadow layer, the light and the words stay where
 * they were on it.
 */
export function resizedWith(from: { x: number; y: number; w: number; h: number }, to: { x: number; y: number; w: number; h: number }, layer: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } {
  const kx = to.w / Math.max(1, from.w), ky = to.h / Math.max(1, from.h);
  return { x: Math.round(to.x + (layer.x - from.x) * kx), y: Math.round(to.y + (layer.y - from.y) * ky), w: Math.max(1, Math.round(layer.w * kx)), h: Math.max(1, Math.round(layer.h * ky)) };
}

/* ------------------------------------------------------------------ */
/* As data, for a library                                               */
/* ------------------------------------------------------------------ */

/** A component written out as plain data: what a learned library keeps of it. */
export interface ComponentSpec {
  kind: ComponentKind;
  name: string;
  size: { w: number; h: number };
  /** Each layer by job, its box as shares of the host's (0..1), so it can be laid on any size. */
  layers: { role: LayerRole; x: number; y: number; w: number; h: number; words?: string }[];
  fill: string | null;
  words: string | null;
  outline: { width: number; colour: string | null; style: string | null } | null;
  shadow: string | null;
  lighting: string | null;
  radius: number | null;
  link: { kind: string; target: string } | null;
  hover: Record<string, string>[];
  press: Record<string, string>[];
  motion: string[];
}

/**
 * One component as data (Lane G's learned library): its kind, its layers by
 * job with their boxes relative to the host, and every job's value read off
 * the part that does it, colour roles resolved through `palette`.
 */
export function componentSpec(nodes: readonly CompNode[], comp: Component, palette?: Record<string, string | undefined> | null): ComponentSpec {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const host = byId.get(comp.id)!;
  const rel = (n: CompNode) => ({ x: +((n.x - host.x) / Math.max(1, host.w)).toFixed(3), y: +((n.y - host.y) / Math.max(1, host.h)).toFixed(3), w: +(n.w / Math.max(1, host.w)).toFixed(3), h: +(n.h / Math.max(1, host.h)).toFixed(3) });
  const p = comp.paints;
  const outlinePart = p.outline ? byId.get(p.outline) : null;
  const states = (ids: string[], key: "hover" | "active") => ids.flatMap((id) => (byId.get(id)?.motion?.[key] ?? []).map((s) => ({ ...(s.style ?? {}) })));
  return {
    kind: comp.kind, name: comp.name, size: { w: host.w, h: host.h },
    layers: comp.layers.map((l) => { const n = byId.get(l.id)!; const w = wordsOf(n.content).trim(); return { role: l.role, ...rel(n), ...(w ? { words: w } : {}) }; }),
    fill: colourOf(nodes, comp, "fill", palette),
    words: colourOf(nodes, comp, "words", palette),
    outline: outlinePart ? { width: outlinePart.edge?.width ?? 0, colour: colourOf(nodes, comp, "outline", palette), style: outlinePart.edge?.style ?? null } : null,
    shadow: p.shadow ? (byId.get(p.shadow)?.edge?.shadow ?? colourOf(nodes, comp, "shadow", palette)) : null,
    lighting: p.lighting ? (p.lighting === comp.id ? "inset" : colourOf(nodes, comp, "lighting", palette)) : null,
    radius: typeof host.radius === "number" ? host.radius : null,
    link: p.link ? byId.get(p.link)?.link ?? null : null,
    hover: states(p.hover, "hover"),
    press: states(p.press, "active"),
    motion: p.motion.flatMap((id) => { const n = byId.get(id)!; return [...(n.motion?.animation ?? []).map((a) => a.name), ...(n.work ? [n.work.id] : [])]; }),
  };
}
