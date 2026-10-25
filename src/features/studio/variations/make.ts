/**
 * ONE VARIATION'S DOCUMENT, OUT OF THE ORIGINAL'S AND A SPEC.
 *
 *   1. the System is taken from the original's parts (`system/take.ts`):
 *      a new System, its own id, so nothing the original or any other site
 *      points at is ever changed;
 *   2. its tokens are moved onto the spec's choices (`tokens.ts`), and the
 *      parts are written with their tokens' values (`resolve.ts#materialise`),
 *      the palette roles with the role tokens';
 *   3. its layout, gaps and section order are laid back out (`relayout.ts`);
 *   4. the word changes J accepted are put in, and no others.
 *
 * The original's document is read, never written: everything here makes new
 * objects. `prepare` does the take once for a batch; `build` is cheap.
 *
 * Pure: no store, no browser.
 */
import { takeSystem, withSys, type TakeNode } from "../system/take.ts";
import { materialise, paletteWith } from "../system/resolve.ts";
import { newSystemId, type System } from "../system/model.ts";
import type { Palette } from "../look/index.ts";
import { accentHue, systemFor, type FaceRoles } from "./tokens.ts";
import { relayout, sectionCount, type RelayNode } from "./relayout.ts";
import type { SiteShape, Spec, WordSuggestion } from "./model.ts";

/** The part of a stored document a variation reads and writes. Everything else is carried as it is. */
export interface VarDoc {
  nodes: (TakeNode & RelayNode & { content?: unknown })[];
  look?: { palette?: Partial<Palette> | null; [k: string]: unknown } | null;
  pages?: { id: string; name?: string }[];
  activePageId?: string;
  frameWidth?: number;
  systemId?: string | null;
  system?: System | null;
  [k: string]: unknown;
}

export interface Prepared {
  doc: VarDoc;
  /** The parts, linked to `system`. */
  nodes: VarDoc["nodes"];
  system: System;
  faceRoles: FaceRoles;
  shape: SiteShape;
  width: number;
  pageIds: string[];
}

/** The face tokens' jobs: the one worn at the largest size heads the page; the rest are body. */
export function faceRolesOf(nodes: readonly { sys?: { f?: Partial<Record<string, string>> } | null; font?: { px?: number | null } | null }[]): FaceRoles {
  const most = new Map<string, number>();
  for (const n of nodes) {
    const id = n.sys?.f?.["font.stack"];
    if (id) most.set(id, Math.max(most.get(id) ?? 0, n.font?.px ?? 0));
  }
  const out: FaceRoles = new Map();
  const ranked = [...most.entries()].sort((a, b) => b[1] - a[1]);
  ranked.forEach(([id], i) => out.set(id, i === 0 && ranked.length > 1 ? "heading" : "body"));
  return out;
}

/** Take the System off the original once, for every variation of a batch. */
export function prepare(doc: VarDoc, palette: Palette, o: { name?: string; at?: number } = {}): Prepared {
  const width = doc.frameWidth || 1440;
  const host = doc.nodes.find((n) => (n as { from?: { host?: string } | null }).from?.host)?.from as { host?: string } | undefined;
  const taken = takeSystem({ nodes: doc.nodes, palette, frameWidth: width, name: o.name ?? host?.host ?? "This site", host: host?.host ?? null, at: o.at });
  const nodes = doc.nodes.map((n) => withSys(n, taken.links.get(n.id) ?? null));
  const pageIds = doc.pages?.length ? doc.pages.map((p) => p.id) : [...new Set(nodes.map((n) => n.pageId ?? ""))];
  const first = doc.activePageId && pageIds.includes(doc.activePageId) ? doc.activePageId : pageIds[0] ?? null;
  return {
    doc, nodes, system: taken.system, faceRoles: faceRolesOf(nodes), width, pageIds,
    shape: { sections: sectionCount(nodes, first, width), hue: accentHue(taken.system) },
  };
}

/** A word change put in: only where the part still says exactly what the suggestion read. */
export function withWords<N extends { id: string; content?: unknown }>(nodes: readonly N[], words: readonly WordSuggestion[]): N[] {
  const by = new Map(words.map((w) => [w.part, w]));
  return nodes.map((n) => {
    const w = by.get(n.id);
    return w && typeof n.content === "string" && n.content === w.now ? { ...n, content: w.to } : n;
  });
}

/** The variation's document. */
export function build(p: Prepared, spec: Spec, o: { name?: string; words?: readonly WordSuggestion[]; id?: string } = {}): { doc: VarDoc; system: System; moved: number } {
  const base = systemFor(p.system, spec, p.faceRoles);
  /* Its own System, never the one another site points at. */
  const system: System = { ...base, id: o.id ?? newSystemId(), name: o.name ?? `${p.system.name}, a variation`, from: "copied" };
  /* The parts point at the variation's System, and draw its values. */
  const pointed = p.nodes.map((n) => (n.sys ? { ...n, sys: { ...n.sys, s: system.id } } : n));
  const drawn = materialise(pointed, system).nodes as VarDoc["nodes"];
  const laid = relayout(drawn, { space: spec.space, layout: spec.layout, order: spec.order, width: p.width, pageIds: p.pageIds });
  const nodes = o.words?.length ? withWords(laid.nodes, o.words) : laid.nodes;
  const look = { ...(p.doc.look ?? {}), palette: paletteWith(p.doc.look?.palette ?? undefined, system) ?? null };
  return { doc: { ...p.doc, nodes, look, systemId: system.id, system }, system, moved: laid.moved };
}
