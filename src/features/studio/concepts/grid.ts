/**
 * THE GRID: columns are concepts, rows are sections, and the rows line up.
 *
 * J picked design C of handovers/open/concept-studio (2026-11-08: "great
 * way to mix and match and build a page"). Three heroes in one row, three
 * price tables in another; one tick per row; the ticked set is the page.
 *
 *   rowsOf        the rows the grid reads: one per section name any concept
 *                 has, in a known order where the name is known (Header,
 *                 First screen, Picture …), else by where it sits; a cell is
 *                 that concept's section, or empty where it lacks one. A row
 *                 has a `kind` so rows of another kind (Elements: buttons,
 *                 cards, menus, the wheel's pop-ups) can come later without
 *                 the grid changing shape;
 *   ticks         one per row: `tick`, `tickWhole` (a column), `takesOf`
 *                 (the ticks as the Mix's takes, in row order);
 *   pageOf        the ticked page as a document to draw live (the Your page
 *                 column) and to build (`run.ts#buildTicked`);
 *   partAt        the part under a point of a cell, for a right-press;
 *   SWITCHES      the pieces taken from designs A and B, each behind one
 *                 switch so J can drop any of them.
 *
 * Pure: no React, no store, no browser. `tests/concept-grid.mjs`.
 */
import { mixNodes, sectionsOf, type PartLike, type Section, type Take } from "./model.ts";

/** The pieces from the other two designs, each one switch. */
export const SWITCHES = {
  /** A: See whole page per concept, so a direction's feel is not lost in the rows. */
  wholePage: true,
  /** A: Promote one concept as it is, from its column. */
  promoteOne: true,
  /** B: hover a cell and the other concepts' versions slide out as cards. */
  hoverCards: true,
  /** B: 1, 2, 3 (and 4) switch the focused row's tick. */
  numberKeys: true,
  /** B: a live Your page column at the right, the ticked page as it builds. */
  yourPage: true,
} as const;
export type Switch = keyof typeof SWITCHES;

/** Rows of another kind come later (Elements); the grid reads `kind` and nothing else changes. */
export type RowKind = "section" | "element";

export interface Cell { section: Section; parts: number }
export interface GridRow {
  kind: RowKind;
  /** The row's key: its name, lower-cased. */
  key: string;
  name: string;
  /** By concept id; absent where the concept has no such section. */
  cells: Record<string, Cell>;
  /** The tallest cell, in page px: every cell of the row is drawn this tall, so the rows line up. */
  height: number;
}

export interface ConceptNodes { id: string; nodes: readonly PartLike[]; pageId?: string }

/**
 * The rows the grid reads, from the concepts' pages. A row's place is
 * where its section sits on average down the pages that have it (0 the
 * top, 1 the foot), so each concept's own order is kept as far as three
 * pages can agree; Header is always first and Footer last.
 */
export function rowsOf(concepts: readonly ConceptNodes[]): GridRow[] {
  const by = new Map<string, GridRow & { at: number[] }>();
  for (const c of concepts) {
    const secs = sectionsOf(c.nodes, c.pageId);
    const span = Math.max(1, ...secs.map((s) => s.bottom));
    for (const s of secs) {
      const key = s.name.trim().toLowerCase();
      if (!key) continue;
      let row = by.get(key);
      if (!row) by.set(key, (row = { kind: "section", key, name: s.name, cells: {}, height: 0, at: [] }));
      row.cells[c.id] = { section: s, parts: s.parts };
      row.height = Math.max(row.height, s.bottom - s.top);
      row.at.push((s.top + s.bottom) / 2 / span);
    }
  }
  const place = (r: { key: string; at: number[] }) => (r.key === "header" ? -1 : r.key === "footer" ? 2 : r.at.reduce((a, b) => a + b, 0) / Math.max(1, r.at.length));
  return [...by.values()].sort((a, b) => place(a) - place(b) || a.name.localeCompare(b.name)).map(({ at: _a, ...row }) => { void _a; return row; });
}

/** One tick per row: the concept the row comes from. */
export type Ticks = Record<string, string>;

/** Tick a cell; ticking the one already ticked takes it off. */
export function tick(ticks: Ticks, rowKey: string, concept: string): Ticks {
  const next = { ...ticks };
  if (next[rowKey] === concept) delete next[rowKey];
  else next[rowKey] = concept;
  return next;
}

/** Whole: every row this concept has a cell in, ticked from it; rows it lacks keep their tick. */
export function tickWhole(rows: readonly GridRow[], ticks: Ticks, concept: string): Ticks {
  const next = { ...ticks };
  for (const r of rows) if (r.cells[concept]) next[r.key] = concept;
  return next;
}

/** The ticks as takes, in row order, skipping a tick on a cell the row no longer has. */
export function takesOf(rows: readonly GridRow[], ticks: Ticks): Take[] {
  const out: Take[] = [];
  for (const r of rows) {
    const id = ticks[r.key];
    const cell = id ? r.cells[id] : null;
    if (id && cell) out.push({ from: id, section: cell.section.name });
  }
  return out;
}

/** How many ticks come from each concept, by id. */
export function tickCounts(rows: readonly GridRow[], ticks: Ticks): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) { const id = ticks[r.key]; if (id && r.cells[id]) out[id] = (out[id] ?? 0) + 1; }
  return out;
}

/** The ticked page as a document to draw: the takes stacked, the first ticked concept's look and format. */
export function pageOf<N extends PartLike>(rows: readonly GridRow[], ticks: Ticks, docs: ReadonlyMap<string, { nodes: readonly N[]; look?: unknown; format?: unknown; frameWidth?: number; system?: unknown; systemId?: string | null }>): { nodes: N[]; look?: unknown; format?: unknown; frameWidth: number; pages: { id: string; name: string; path: string }[]; activePageId: string; system?: unknown; systemId?: string | null } | null {
  const takes = takesOf(rows, ticks).filter((t) => docs.has(t.from));
  if (!takes.length) return null;
  const nodes = mixNodes(takes, new Map([...docs].map(([id, d]) => [id, d.nodes])), { pageId: "page_home" });
  const first = docs.get(takes[0]!.from)!;
  return { pages: [{ id: "page_home", name: "Home", path: "/" }], activePageId: "page_home", nodes, look: first.look, format: first.format, frameWidth: first.frameWidth ?? 1440, system: first.system, systemId: first.systemId };
}

/** The part under a page point: the smallest that holds it, the later one when two are the same size (it draws on top). */
export function partAt<N extends PartLike>(nodes: readonly N[], x: number, y: number, pageId?: string): N | null {
  let best: N | null = null;
  for (const n of nodes) {
    if (pageId && n.pageId !== pageId) continue;
    if (x < n.x || x > n.x + n.w || y < n.y || y > n.y + n.h) continue;
    if (!best || n.w * n.h <= best.w * best.h) best = n;
  }
  return best;
}

/** The row a key names: "1" the first concept, "2" the second …; null for any other key. */
export function conceptForKey(key: string, concepts: readonly string[]): string | null {
  const n = Number(key);
  return Number.isInteger(n) && n >= 1 && n <= concepts.length ? concepts[n - 1]! : null;
}
