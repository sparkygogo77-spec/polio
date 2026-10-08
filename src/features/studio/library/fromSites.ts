/**
 * FROM YOUR SITES: the panels a real site was built from, kept on the shelf.
 *
 * The audit (2026-10-08, item 10): the shelf's generic parts are not how a
 * real site is made. PonsStars was made of hooked panels (a TV box, a player
 * card, a step bar), each with its states and its look, and none of them was
 * on the shelf. So every import keeps its site's panels as saved components
 * (`components.ts`), builder-wide: open another board and the TV box is on
 * the shelf, placed whole, every part, hook, state face and keyframe with it.
 *
 * A panel is a part the site's code names (`data-hook`) that holds at least
 * two parts of its own, and is not the page itself: a wrapper holding most of
 * its page is a layout, not a piece. A hook seen on several screens (a page's
 * states) is kept once, from the screen where it holds the most.
 *
 * Kept components are marked `auto`, so bringing the site in again replaces
 * them and forgetting the site removes them; ones the person saved by hand
 * are never touched.
 *
 * Pure: no store, no React. `tests/shelf-from-sites.mjs` holds it.
 */
import { componentOf, membersOf, type SavedComponent } from "./components.ts";
import type { PictureFrame } from "../frame.ts";

type PictureFrameLike = PictureFrame;

type Frames = SavedComponent["frames"][number];
type Node = Record<string, unknown> & { id: string; x: number; y: number; w: number; h: number; pageId?: string };

/** The shelf category kept panels are filed under: their own shelf, not one of the twelve. */
export const SITES_CATEGORY = "sites";
/** At most this many panels from one site, the ones holding the most first. */
export const MAX_PANELS = 40;
/** A panel heavier than this (a captured picture in it, say) stays on its site. */
export const MAX_PANEL_BYTES = 250_000;

/** The name a page's code finds a part by. */
export const hookOf = (n: Record<string, unknown>): string | null => {
  const h = (n.hooks as Record<string, string> | null | undefined)?.["data-hook"];
  return typeof h === "string" && h.trim() ? h.trim() : null;
};

/** "player-card" reads "Player card". */
export const panelName = (hook: string) => {
  const words = hook.replace(/^(template|panel)-/, "").replace(/[-_]+/g, " ").trim() || hook;
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The site's hooked panels, as components ready for the shelf. */
export function sitePanels(
  board: { nodes: readonly Record<string, unknown>[]; look?: { keyframes?: readonly Frames[]; fonts?: readonly { family: string; id?: string }[] } | null },
  host: string,
  now = Date.now(),
): SavedComponent[] {
  const nodes = board.nodes as readonly Node[];
  const perPage = new Map<string, number>();
  for (const n of nodes) perPage.set(n.pageId ?? "", (perPage.get(n.pageId ?? "") ?? 0) + 1);
  const best = new Map<string, { id: string; size: number }>();
  for (const n of nodes) {
    const hook = hookOf(n);
    if (!hook) continue;
    const size = membersOf(nodes, n.id).length;
    if (size < 3 || size > Math.max(3, (perPage.get(n.pageId ?? "") ?? 0) * 0.5)) continue;
    const had = best.get(hook);
    if (!had || size > had.size) best.set(hook, { id: n.id, size });
  }
  const out: SavedComponent[] = [];
  for (const [hook, { id }] of [...best.entries()].sort((a, b) => b[1].size - a[1].size)) {
    if (out.length >= MAX_PANELS) break;
    const c = componentOf(nodes, id, {
      id: `site_${host}_${hook}`.replace(/[^a-z0-9_]+/gi, "_"),
      name: panelName(hook), category: SITES_CATEGORY, kind: "Panel", site: host, at: now,
      keyframes: board.look?.keyframes ?? [], fonts: board.look?.fonts ?? [],
    });
    if (!c || JSON.stringify(c).length > MAX_PANEL_BYTES) continue;
    out.push({ ...c, auto: true });
  }
  return out;
}

/** The library's components with one site's kept panels replaced by these. Hand-saved ones stay. */
export function withSitePanels<L extends { components?: SavedComponent[] }>(lib: L, host: string, panels: readonly SavedComponent[]): L {
  const keep = (lib.components ?? []).filter((c) => !(c.auto && c.site === host));
  const components = [...keep, ...panels];
  return { ...lib, components };
}

/** The components the "From your sites" shelf shows, by site: each site's panels, then what the person saved by hand. */
export function fromYourSites(components: readonly SavedComponent[]): { site: string | null; items: SavedComponent[] }[] {
  const bySite = new Map<string | null, SavedComponent[]>();
  for (const c of components) {
    const key = c.site ?? null;
    bySite.set(key, [...(bySite.get(key) ?? []), c]);
  }
  return [...bySite.entries()]
    .sort((a, b) => (a[0] === null ? 1 : b[0] === null ? -1 : a[0].localeCompare(b[0])))
    .map(([site, items]) => ({ site, items: items.sort((a, b) => b.nodes.length - a.nodes.length || a.name.localeCompare(b.name)) }));
}

/* ------------------------------------------------------------------ picture frames */

/** What a frame kept on the shelf is called (`frame.ts`, polio #98). */
export const FRAME_KIND = "Picture frame";

/** A framed part kept as a one-part component: placed from "From your sites", or worn by another part from its Frame field. */
export function frameComponent(node: Node, frame: PictureFrame, name: string, now = Date.now()): SavedComponent {
  const copy = JSON.parse(JSON.stringify(node)) as Node;
  copy.x = 0; copy.y = 0;
  copy.art = { ...((copy.art as Record<string, unknown> | null) ?? {}), frame };
  delete copy.hooks;
  return {
    id: `frame_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name, category: "structure", kind: FRAME_KIND, site: null, at: now,
    w: node.w, h: node.h, nodes: [copy], frames: [], fonts: [],
  };
}

/** The frames on the shelf, newest first, ready to put on a part. */
export function savedFrames(components: readonly SavedComponent[]): { id: string; name: string; frame: PictureFrameLike }[] {
  return components
    .filter((c) => c.kind === FRAME_KIND)
    .sort((a, b) => b.at - a.at)
    .flatMap((c) => {
      const frame = (c.nodes[0]?.art as { frame?: PictureFrameLike } | null | undefined)?.frame;
      return frame ? [{ id: c.id, name: c.name, frame }] : [];
    });
}
