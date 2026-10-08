/**
 * An imported site's six colour roles, read off its own parts, and its parts
 * tied to them.
 *
 * HIS WORDS: the colours are not the ones from the site he imported; there
 * is no pink anywhere on his site and the builder showed pink; most of the
 * roles do nothing for an imported site beside the background. Measured on
 * sink: the document named two roles (the page, and the body's white text
 * that nothing on the page is drawn in), the app filled the other four from
 * its default hue — the pink is that hue turned 62 degrees — and every part
 * carried a fixed colour, so a role moved only the gaps between sections.
 *
 * TWO THINGS, both as Bring lands a document and never afterwards:
 *
 *   DERIVE. Tally every part's colours by role (its fill, surface, words,
 *   accent, and its edge) and pick each role by a rule, never by a count
 *   alone. Neutrals — chroma under 0.005, which is exactly white and black —
 *   never compete for a text role: they are defaults and inherited values,
 *   not his choices. A "colour" is chroma of 0.05 or more.
 *     bg         the page's own colour as captured
 *     surface    the most worn fill that is not the page and not a colour
 *     text       the most worn words that are neither neutral nor a colour
 *     muted      the next such words, quieter against the page than text
 *     accent     the colour the MOST PARTS wear, counted across every role
 *                and the edges: on sink the green, which is not the most
 *                worn text colour (the grey is, 171 to 103) and would never
 *                surface if each role were counted alone
 *     highlight  the second such colour
 *   A role with no evidence says so and shows another role's colour — the
 *   surface shows the page, muted shows the text, the accent shows the text,
 *   the highlight shows the accent — and never a colour the site does not
 *   have. Inventing one is the pink.
 *
 *   LINK. A part colour that is exactly a role's colour is written as the
 *   role's NAME, which `overrideTheme` and `inkOf` already resolve against
 *   the palette. The board draws the same at import (tests/palette-import.mjs
 *   photographs every page both ways), and from then on moving a role moves
 *   every part that wore it. A colour that is not exactly a role — his white
 *   and black words, a one-off tint — keeps its own value and does not move.
 *
 * Pure: no store, no DOM, so the rule can be read and held on its own.
 */
import { parseColor, ROLES, type Palette, type RoleId } from "./look/index.ts";

/** What a role on an imported site came from. */
export interface RoleSource {
  /** The colour the rule picked, or the one it shows for want of evidence. */
  colour: string;
  /** How many parts name this role after linking: what moves when it moves. */
  parts: number;
  /** Set when the site gave no evidence for this role: the role it shows instead. */
  shows?: RoleId;
}
export type PaletteFrom = Record<RoleId, RoleSource>;

interface Coloured {
  id: string;
  colour?: Partial<Record<string, string>> | null;
  edge?: { width?: number; style?: string; colour?: string } | null;
  content?: unknown;
}

const key = (v: string | undefined | null) => (v ?? "").replace(/\s+/g, "").toLowerCase();
const chroma = (v: string) => parseColor(v)?.c ?? 0;
const light = (v: string) => parseColor(v)?.l ?? 0;
const NEUTRAL = 0.005;
const COLOUR = 0.05;

/** Every colour each part wears, by where it wears it. Edges only when drawn. */
function wornBy(n: Coloured): { slot: string; value: string }[] {
  const out: { slot: string; value: string }[] = [];
  for (const slot of ["bg", "surface", "text", "accent"]) {
    const v = n.colour?.[slot]?.trim();
    if (v && parseColor(v)) out.push({ slot, value: v });
  }
  const e = n.edge;
  const v = e?.colour?.trim();
  if (v && (e?.width ?? 0) > 0 && e?.style !== "none" && parseColor(v)) out.push({ slot: "edge", value: v });
  return out;
}

/** Colours by how many PARTS wear them, most first; ties keep the order they were met. */
function ranked(entries: { id: string; value: string }[]): { value: string; parts: number }[] {
  const by = new Map<string, { value: string; ids: Set<string> }>();
  for (const e of entries) {
    const k = key(e.value);
    const hit = by.get(k) ?? { value: e.value, ids: new Set<string>() };
    hit.ids.add(e.id);
    by.set(k, hit);
  }
  return [...by.values()].map((h) => ({ value: h.value, parts: h.ids.size })).sort((a, b) => b.parts - a.parts);
}

/** The six roles, picked from the parts. `captured` is what the document itself named (its page colour, its body text). */
export function derivePalette(nodes: readonly Coloured[], captured: Partial<Palette> = {}): Palette {
  const worn = nodes.flatMap((n) => wornBy(n).map((w) => ({ id: n.id, ...w })));
  const of = (...slots: string[]) => worn.filter((w) => slots.includes(w.slot));

  const fills = ranked(of("bg"));
  const bg = captured.bg && parseColor(captured.bg) ? captured.bg : fills[0]?.value;
  const surface = ranked(of("bg", "surface")).find((c) => key(c.value) !== key(bg) && chroma(c.value) < COLOUR)?.value;
  const words = ranked(of("text")).filter((c) => chroma(c.value) >= NEUTRAL && chroma(c.value) < COLOUR);
  const text = words[0]?.value;
  const quiet = (v: string) => Math.abs(light(v) - light(bg ?? "")) < Math.abs(light(text ?? "") - light(bg ?? ""));
  const muted = text ? words.slice(1).find((c) => quiet(c.value))?.value : undefined;
  const colours = ranked(worn.filter((w) => chroma(w.value) >= COLOUR));
  const accent = colours[0]?.value;
  const highlight = colours[1]?.value;

  /* No evidence: another role's colour, said, never an invented one. The
     text falls back to what the document itself named for its body. */
  const textOr = text ?? (captured.text && parseColor(captured.text) ? captured.text : undefined) ?? bg ?? "";
  return {
    bg: bg ?? "",
    surface: surface ?? bg ?? "",
    text: textOr,
    muted: muted ?? textOr,
    accent: accent ?? textOr,
    highlight: highlight ?? accent ?? textOr,
  };
}

/** Which roles the rule found evidence for, so the panel can say "none on this site" for the rest. */
export function evidenced(nodes: readonly Coloured[], captured: Partial<Palette> = {}): Record<RoleId, RoleId | null> {
  const p = derivePalette(nodes, captured);
  const worn = new Set(nodes.flatMap((n) => wornBy(n).map((w) => key(w.value))));
  const shows = (r: RoleId, fallback: RoleId): RoleId | null => {
    if (r === "bg") return null;
    /* Evidence means a part wears it AND it is not simply another role's colour standing in. */
    const standIn = key(p[r]) === key(p[fallback]);
    return worn.has(key(p[r])) && !standIn ? null : fallback;
  };
  return {
    bg: null,
    surface: shows("surface", "bg"),
    text: worn.has(key(p.text)) && chroma(p.text) >= NEUTRAL ? null : "bg",
    muted: shows("muted", "text"),
    accent: shows("accent", "text"),
    highlight: shows("highlight", "accent"),
  };
}

/** When two roles are one colour, the part keeps the role its own slot names, else the first of these. */
const PREFER: readonly RoleId[] = ["accent", "highlight", "text", "muted", "surface", "bg"];

/**
 * Every part colour that is exactly a role's colour, written as that role's
 * name: fills, words, accents, edges, and the colour of each run of words.
 * Returns the nodes and, per role, how many parts now follow it.
 */
export function linkToRoles<N extends Coloured>(nodes: readonly N[], palette: Palette, only: readonly RoleId[] = ROLES): { nodes: N[]; parts: Record<RoleId, number> } {
  const roleFor = (v: string | undefined, slot?: string): RoleId | null => {
    const k = key(v);
    if (!k || (ROLES as readonly string[]).includes(k)) return null;
    const hits = only.filter((r) => key(palette[r]) === k);
    if (!hits.length) return null;
    return (hits.find((r) => r === slot) ?? PREFER.find((r) => hits.includes(r))) ?? null;
  };
  const follow = Object.fromEntries(ROLES.map((r) => [r, new Set<string>()])) as Record<RoleId, Set<string>>;
  const out = nodes.map((n) => {
    let next: N = n;
    if (n.colour) {
      const colour: Record<string, string> = {};
      let moved = false;
      for (const [slot, v] of Object.entries(n.colour)) {
        const r = typeof v === "string" ? roleFor(v, slot) : null;
        if (r) { colour[slot] = r; follow[r].add(n.id); moved = true; } else if (typeof v === "string") colour[slot] = v;
      }
      if (moved) next = { ...next, colour };
    }
    const e = n.edge;
    const er = e && (e.width ?? 0) > 0 && e.style !== "none" ? roleFor(e.colour) : null;
    if (e && er) { next = { ...next, edge: { ...e, colour: er } }; follow[er].add(n.id); }
    if (Array.isArray(n.content)) {
      let moved = false;
      const runs = (n.content as { colour?: string }[]).map((s) => {
        const r = s && typeof s.colour === "string" ? roleFor(s.colour, "text") : null;
        if (!r) return s;
        moved = true;
        follow[r].add(n.id);
        return { ...s, colour: r };
      });
      if (moved) next = { ...next, content: runs };
    }
    return next;
  });
  /* A role also counts the parts that already named it. */
  for (const n of out) {
    for (const v of Object.values(n.colour ?? {})) if (typeof v === "string" && (ROLES as readonly string[]).includes(v)) follow[v as RoleId].add(n.id);
    const ev = n.edge?.colour;
    if (typeof ev === "string" && (ROLES as readonly string[]).includes(ev)) follow[ev as RoleId].add(n.id);
  }
  return { nodes: out, parts: Object.fromEntries(ROLES.map((r) => [r, follow[r].size])) as Record<RoleId, number> };
}

/**
 * Both, for a document that has just landed: the palette the site gave, its
 * parts tied to it, and beside every role what it came from.
 */
export function landPalette<N extends Coloured>(nodes: readonly N[], captured: Partial<Palette> = {}): { nodes: N[]; palette: Palette; from: PaletteFrom } {
  const palette = derivePalette(nodes, captured);
  const standIn = evidenced(nodes, captured);
  /* A role standing in for another is not linked to: a part wearing the
     text's grey follows Text, not a Muted that only shows the text. */
  const real = ROLES.filter((r) => !standIn[r]);
  const { nodes: linked, parts } = linkToRoles(nodes, palette, real);
  const from = Object.fromEntries(ROLES.map((r) => [r, {
    colour: palette[r],
    parts: standIn[r] ? 0 : parts[r],
    ...(standIn[r] ? { shows: standIn[r]! } : {}),
  }])) as PaletteFrom;
  return { nodes: linked, palette, from };
}
