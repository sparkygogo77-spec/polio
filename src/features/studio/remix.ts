/**
 * REMIX: A PART FROM ONE SITE, PLACED ON ANOTHER, IN THAT SITE'S LOOK.
 *
 * A button, a card, a heading, or a component (a part with everything drawn
 * inside it, or its whole group), taken from another site's board and put on
 * the open one. It restyles itself to the site it lands on:
 *
 *   · a part of a kind that site has a style for (its buttons, cards,
 *     panels, badges: styleKits.ts) wears that style (kitLook.ts): fill,
 *     outline, shadow, light, corners, face, hover and press;
 *   · any other part follows the site: its colours are the site's (no own
 *     colours), and its words are set in the face that site sets that kind
 *     of part in, at their own size and weight.
 *
 * Or, with Keep the original look, it wears the look it had, and the faces
 * it is set in come with it (`fontsFor`). Which it wears can be switched
 * later: the part keeps where it came from and its original look
 * (`StudioNode.remix`).
 *
 * Pure: no store, no DOM.
 */
import type { StudioNode } from "./board/store";
import type { CarriedFont } from "./fonts";
import type { StyleKit, KitNode } from "./styleKits";
import { roleOf } from "./styleKits";
import { kindKey } from "./partKind";
import { lookOfKit } from "./kitLook";
import { FACETS, lookOf, lookPatch, type Facet, type PartLook } from "./partLook";
import { membersOf } from "./library/components";

/** Where a remixed part came from, the look it wore there, and whether it keeps it. */
export interface Remixed {
  site: string;
  part: string;
  original: PartLook;
  kept: boolean;
}

/** What a site looks like, for parts landing on it: its styles, and the face it sets each kind of part in. */
export interface SiteLook {
  kits: StyleKit[];
  /** Kind key (partKind.ts) → the face and stack most of that kind's parts are set in. */
  faces: Record<string, { face?: string; stack?: string; family?: string }>;
  /** The face most of its words are set in. */
  face: { face?: string; stack?: string; family?: string } | null;
}

/** What a kit carries onto a part (as the panel's Styles row): all but motion. */
const KIT_FACETS: Facet[] = ["fill", "outline", "shadow", "light", "corners", "font", "hover"];

type Part = StudioNode;
const typeOf = (f: StudioNode["font"]) => (f && (f.face || f.stack || f.family) ? { ...(f.face ? { face: f.face } : {}), ...(f.stack ? { stack: f.stack } : {}), ...(f.family ? { family: f.family } : {}) } : null);
const sig = (t: ReturnType<typeof typeOf>) => JSON.stringify(t);

/** A site's look, read off its parts and styles. */
export function siteLookOf(nodes: readonly Part[], kits: StyleKit[]): SiteLook {
  const byKind = new Map<string, Map<string, number>>();
  const all = new Map<string, number>();
  for (const n of nodes) {
    const t = typeOf(n.font);
    if (!t) continue;
    const k = kindKey(n as never);
    const m = byKind.get(k) ?? new Map<string, number>();
    m.set(sig(t), (m.get(sig(t)) ?? 0) + 1);
    byKind.set(k, m);
    all.set(sig(t), (all.get(sig(t)) ?? 0) + 1);
  }
  const most = (m: Map<string, number>) => JSON.parse([...m].sort((a, b) => b[1] - a[1])[0]![0]);
  return {
    kits: [...kits].sort((a, b) => b.count - a.count),
    faces: Object.fromEntries([...byKind].map(([k, m]) => [k, most(m)])),
    face: all.size ? most(all) : null,
  };
}

/**
 * The part and what goes with it: what it holds, read as the saved
 * components read it (`membersOf`, library/components.ts: the part tree of
 * its page), and the rest of its group. `members`: a grouping handed in,
 * which wins (Lane J's components, one button with its layers, plug in
 * here and nowhere else).
 */
export function componentOf(nodes: readonly Part[], part: Part, whole = true, members?: readonly string[]): Part[] {
  if (!whole) return [part];
  const held = membersOf(nodes as never, part.id, members) as unknown as Part[];
  const ids = new Set(held.map((n) => n.id));
  const group = part.groupId ? nodes.filter((m) => m.groupId === part.groupId && !ids.has(m.id)) : [];
  const rest = [...held.slice(1), ...group].filter((m) => !(m as { inert?: boolean }).inert);
  /* In the order the board draws them, so what was on top stays on top. */
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  return [part, ...rest.sort((a, b) => order.get(a.id)! - order.get(b.id)!)];
}

/** The change a part takes to wear the site it lands on. */
export function restyleFor(n: Part, site: SiteLook): Partial<StudioNode> {
  const role = roleOf(n as unknown as KitNode);
  const kit = role ? site.kits.find((k) => k.role === role) : undefined;
  if (kit) return lookPatch(n as never, lookOfKit(kit, { button: n.featureId === "cta-primary" }), KIT_FACETS);
  /* No style for its kind: it follows the site, its colours the site's own, its words in the face the site sets that kind in. */
  const face = site.faces[kindKey(n as never)] ?? site.face;
  const font = n.font ? { ...n.font, face: undefined, stack: undefined, family: undefined, ...(face ?? {}) } : face ? { ...face } : null;
  if (font) for (const k of Object.keys(font) as (keyof typeof font)[]) if (font[k] === undefined) delete font[k];
  return { colour: null, hue: null, font: font as StudioNode["font"] };
}

/** The faces a set of parts is set in, of the fonts a site carries. */
export function fontsFor(parts: readonly Part[], fonts: readonly CarriedFont[] | undefined): CarriedFont[] {
  const names = new Set<string>();
  for (const p of parts) for (const v of [p.font?.face, ...(p.font?.stack ?? "").split(",")]) { const s = (v ?? "").trim().replace(/^["']|["']$/g, ""); if (s) names.add(s.toLowerCase()); }
  return (fonts ?? []).filter((f) => names.has(f.family.trim().replace(/^["']|["']$/g, "").toLowerCase()));
}

/**
 * The parts as they land: moved together so the first stands at `at` (its
 * top left, kept on the page), each marked with where it came from and its
 * original look, and restyled to `site` unless `kept`. Ids are the store's
 * to give (`placeNodes`).
 */
export function remixParts(parts: readonly Part[], from: { site: string }, site: SiteLook, kept: boolean, at: { x: number; y: number }, frameWidth: number): Part[] {
  if (!parts.length) return [];
  const lead = parts[0]!;
  const minX = Math.min(...parts.map((p) => p.x));
  const maxR = Math.max(...parts.map((p) => p.x + p.w));
  const dx = Math.round(Math.max(-minX, Math.min(frameWidth - maxR, at.x - lead.x)));
  const dy = Math.round(at.y - lead.y);
  return parts.map((p) => {
    const remix: Remixed = { site: from.site, part: p.id, original: lookOf(p as never, FACETS), kept };
    const moved: Part = { ...p, x: p.x + dx, y: p.y + dy, byHand: true, locked: false, remix } as Part;
    return kept ? moved : ({ ...moved, ...restyleFor(moved, site) } as Part);
  });
}

/** Switch a remixed part between its original look and the site's. */
export function remixPatch(n: Part, site: SiteLook, kept: boolean): Partial<StudioNode> | null {
  if (!n.remix) return null;
  const look = kept ? lookPatch(n as never, n.remix.original, FACETS) : restyleFor(n, site);
  return { ...look, remix: { ...n.remix, kept } };
}
