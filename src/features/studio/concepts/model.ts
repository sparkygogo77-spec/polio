/**
 * CONCEPTS: WHAT ONE IS, AND THE SUMS THE STUDIO DOES ON THEM.
 *
 * J (next-lanes-options.md, option B): ask for "three concepts for a lantern
 * shop landing page" and get three live, full-size pages side by side, each
 * made of real Builder parts, each editable with the normal tools, with Mix
 * (the first screen from one, the prices from another) and Promote to a site.
 *
 * A concept is an ordinary site in Builds: its own document in its own slot,
 * drawn through idea-versions (`idea/versions.ts#buildSite`) in a System of
 * its own. This file only says which sites are concepts, which prompt made
 * them together (a GROUP), and how a Mix is cut out of them:
 *
 *   · a SECTION is the run of parts whose label starts with the same
 *     "Section: " (that is how `planToBoard` names every part it lays out),
 *     in page order, top to bottom;
 *   · a TAKE is one section of one concept; the Mix is a list of takes;
 *   · `mixNodes` stacks the taken sections in the order J took them, each
 *     moved down as a block so nothing overlaps, ids prefixed per take so two
 *     takes from one concept never collide.
 *
 * Pure: no React, no store, no browser. Every import ends in .ts, so node
 * tests load it (`tests/concept-studio.mjs`).
 */

export const CONCEPT_HREF = "/builder/concepts";

/** One concept: a site in Builds, and how it was made. */
export interface Concept {
  /** The group (one prompt) it belongs to. */
  group: string;
  /** Its direction, in plain words ("Calm editorial"). */
  name: string;
  pitch: string;
  /** Its place in the row, 0 first. */
  index: number;
  made: number;
  by: "claude" | "local";
  /** The System it is drawn in (in the library). */
  systemId: string | null;
  /** The Mix of its group, when this site is that Mix. */
  mix?: boolean;
}

/** One section of one concept, taken into the Mix. */
export interface Take { from: string; section: string }

/** One prompt and what it made. */
export interface Group {
  id: string;
  prompt: string;
  made: number;
  /** The concepts, in row order. */
  ids: string[];
  /** The Mix site of this group, once a section has been taken. */
  mix: string | null;
  takes: Take[];
}

/** The link that opens a group's canvas. */
export const conceptsHref = (group?: string | null): string => (group ? `${CONCEPT_HREF}?g=${encodeURIComponent(group)}` : CONCEPT_HREF);

/** The group named in a query string, or none. */
export const readGroup = (search: string): string | null => new URLSearchParams(search).get("g") || null;

/** A site's name from the prompt's site name and the direction. */
export const conceptName = (site: string, direction: string): string => `${site}: ${direction}`;

/** The Mix's name. */
export const mixName = (site: string): string => `${site}: Mix`;

/** The concepts of one group, in row order, only those still in Builds. */
export function conceptsOf(byId: Record<string, Concept>, group: Group, present: ReadonlySet<string>): { id: string; c: Concept }[] {
  return group.ids.filter((id) => present.has(id) && byId[id] && !byId[id]!.mix).map((id) => ({ id, c: byId[id]! }));
}

/** A part as much as a cut needs: its box, its page and its label. */
export interface PartLike { id: string; pageId: string; label?: string; x: number; y: number; w: number; h: number; link?: unknown }

/**
 * The section a part belongs to: the words before ": " in its label, as
 * `planToBoard` names them ("First screen: heading"). A section's own band
 * is labelled "Section: First screen", so there the section is what follows.
 */
export function sectionOfPart(label: string | undefined): string {
  const l = label ?? "";
  const at = l.indexOf(": ");
  if (at < 0) return l.trim();
  const head = l.slice(0, at).trim();
  return head === "Section" ? l.slice(at + 2).trim() : head;
}

export interface Section { name: string; top: number; bottom: number; parts: number }

/** The sections of a page, top to bottom: each name once, with the block of page it covers. */
export function sectionsOf(nodes: readonly PartLike[], pageId?: string): Section[] {
  const page = pageId ?? nodes[0]?.pageId;
  const by = new Map<string, Section>();
  for (const n of nodes) {
    if (page && n.pageId !== page) continue;
    const name = sectionOfPart(n.label);
    if (!name) continue;
    const s = by.get(name);
    if (!s) by.set(name, { name, top: n.y, bottom: n.y + n.h, parts: 1 });
    else { s.top = Math.min(s.top, n.y); s.bottom = Math.max(s.bottom, n.y + n.h); s.parts++; }
  }
  return [...by.values()].sort((a, b) => a.top - b.top);
}

/** The parts of one section of a page. */
export function partsOfSection<N extends PartLike>(nodes: readonly N[], section: string, pageId?: string): N[] {
  const page = pageId ?? nodes[0]?.pageId;
  return nodes.filter((n) => (!page || n.pageId === page) && sectionOfPart(n.label) === section);
}

/** Add a take (the same section of the same concept is not taken twice). */
export function withTake(takes: readonly Take[], t: Take): Take[] {
  return takes.some((x) => x.from === t.from && x.section === t.section) ? [...takes] : [...takes, t];
}

/** Take one out. */
export function withoutTake(takes: readonly Take[], t: Take): Take[] {
  return takes.filter((x) => !(x.from === t.from && x.section === t.section));
}

/** Move a take up (-1) or down (+1) the stack. */
export function moveTake(takes: readonly Take[], at: number, by: -1 | 1): Take[] {
  const to = at + by;
  if (at < 0 || at >= takes.length || to < 0 || to >= takes.length) return [...takes];
  const out = [...takes];
  [out[at], out[to]] = [out[to]!, out[at]!];
  return out;
}

/**
 * The Mix's parts: every take's section, in take order, each moved down as a
 * block to sit under the one before, on one page. A link to a page is let
 * go (the Mix has one page). The parts' own colours, fonts and System links
 * travel with them, so a section keeps the look of the concept it came from.
 */
export function mixNodes<N extends PartLike>(takes: readonly Take[], docs: ReadonlyMap<string, readonly N[]>, o: { pageId: string; gap?: number } = { pageId: "page_home" }): N[] {
  const gap = o.gap ?? 0;
  const out: N[] = [];
  let cursor = 0;
  takes.forEach((t, i) => {
    const all = docs.get(t.from);
    if (!all) return;
    const parts = partsOfSection(all, t.section);
    if (!parts.length) return;
    const top = Math.min(...parts.map((p) => p.y));
    const bottom = Math.max(...parts.map((p) => p.y + p.h));
    const shift = cursor - top;
    for (const p of parts) {
      const q = { ...p, id: `mx${i}_${p.id}`, pageId: o.pageId, y: p.y + shift } as N & { groupId?: string | null; link?: { kind?: string } | null };
      if (q.link && typeof q.link === "object" && (q.link as { kind?: string }).kind === "page") q.link = null;
      if ("groupId" in q) q.groupId = null;
      out.push(q);
    }
    cursor += bottom - top + gap;
  });
  return out;
}

/** The height a stack of takes needs. */
export function mixHeight(nodes: readonly PartLike[]): number {
  return nodes.length ? Math.max(...nodes.map((n) => n.y + n.h)) : 0;
}
