"use client";
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { getFeature } from "../catalog";
import { useStudio, type StudioNode } from "../board/store";
import { plain } from "../parts/spans";
import { play } from "@/core/audio/engine";
import { partName } from "../partNames";
import { setShelfTall } from "./shelf";

/**
 * Drag the shelf's top edge to make it taller or shorter, up to most of the
 * canvas (`gripMax`), remembered. The wheel over the shelf grows it only to
 * a third, then scrolls the cards.
 * Inside the shelf's own edge, never over the board: a part's resize handle
 * at the shelf's edge is the part's (`tests/hand-steady.mjs`).
 */
export function ShelfGrip() {
  const start = React.useRef<{ y: number; h: number } | null>(null);
  return (
    <div
      data-shelf-grip=""
      role="separator"
      aria-orientation="horizontal"
      aria-label="Drag to make the shelf taller or shorter"
      className="absolute inset-x-0 top-0 z-[3] h-1.5 cursor-row-resize touch-none hover:bg-accent/30"
      onPointerDown={(e) => {
        const band = (e.currentTarget.closest("[data-studio-band]") as HTMLElement | null) ?? e.currentTarget.parentElement;
        if (!band) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { y: e.clientY, h: band.getBoundingClientRect().height };
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        setShelfTall(s.h - (e.clientY - s.y), "grip");
      }}
      onPointerUp={() => { start.current = null; }}
      onPointerCancel={() => { start.current = null; }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Search: what is on this page first                                   */
/* ------------------------------------------------------------------ */

/**
 * The parts of this page that answer a search, best first.
 *
 * "Search parts" searched the catalogue alone, so typing "copy" with a COPY
 * button on the page found nothing on the page. A part answers by its
 * words, its name or its kind; words that start with what was typed come
 * before words that merely contain it.
 */
export function onThisPage(nodes: readonly StudioNode[], query: string): StudioNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { n: StudioNode; score: number }[] = [];
  for (const n of nodes) {
    const words = plain(n.content).toLowerCase();
    const name = partName(n, nodes, (id) => getFeature(id)?.name).toLowerCase();
    const kind = `${getFeature(n.featureId)?.name ?? ""} ${n.featureId}`.toLowerCase();
    const at = (text: string) => { const i = text.indexOf(q); return i < 0 ? -1 : i === 0 || /\W/.test(text[i - 1]!) ? 0 : 1; };
    const w = at(words), l = at(name), k = at(kind);
    const score = w === 0 ? 0 : l === 0 ? 1 : w === 1 ? 2 : l === 1 ? 3 : k >= 0 ? 4 : -1;
    if (score >= 0) scored.push({ n, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.n.y - b.n.y || a.n.x - b.n.x).map((x) => x.n);
}

/** Pick a part and bring it into view on the board. */
export function goToPart(id: string) {
  const s = useStudio.getState();
  s.setSelection([id]);
  s.want({ panel: "inspector", id });
  play("select");
  const el = document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
  const pane = document.querySelector<HTMLElement>("[data-studio-pane]");
  if (!el || !pane) return;
  const r = el.getBoundingClientRect();
  const p = pane.getBoundingClientRect();
  const band = document.querySelector<HTMLElement>("[data-studio-band]")?.getBoundingClientRect();
  const seen = band && band.top > p.top ? band.top - p.top : p.height;
  /* Its top a third of the way down what is not under the shelf. */
  pane.scrollTop += r.top - p.top - Math.max(24, Math.min(seen / 3, seen - r.height - 24));
  /* Across is the board's pan. */
  if (r.right < p.left || r.left > p.right) {
    const { pan } = useStudio.getState();
    useStudio.getState().setPan({ x: pan.x + (p.left + p.width / 2) - (r.left + r.width / 2), y: pan.y });
  }
}

const ON_PAGE_MAX = 40;

export function OnThisPage({ hits }: { hits: StudioNode[] }) {
  const shown = hits.slice(0, ON_PAGE_MAX);
  /* Each part by the side panel's readable name (`partNames.ts`). */
  const all = useStudio(useShallow((s) => s.nodes.filter((n) => n.pageId === s.activePageId)));
  const names = React.useMemo(() => new Map(shown.map((n) => [n.id, partName(n, all, (id) => getFeature(id)?.name)])), [shown, all]);
  return (
    <section data-page-results="" className="mb-4">
      <div className="mb-2 text-small font-medium text-fg-muted">On this page</div>
      <div className="flex flex-col gap-0.5">
        {shown.map((n) => {
          const words = plain(n.content).replace(/\s+/g, " ").trim();
          const kind = getFeature(n.featureId)?.name ?? "Part";
          return (
            <button
              key={n.id}
              type="button"
              data-page-hit={n.id}
              onClick={() => goToPart(n.id)}
              className="tactile flex min-w-0 items-center gap-2 rounded-sm px-2 py-1 text-left text-small hover:bg-hover"
            >
              <span className="shrink-0 rounded-xs border border-border px-1 text-fine text-fg-faint">{kind}</span>
              <span className="shrink-0 font-medium text-fg">{names.get(n.id)}</span>
              {words && words !== names.get(n.id) ? <span className="min-w-0 truncate text-fg-muted">{words}</span> : null}
            </button>
          );
        })}
      </div>
      {hits.length > shown.length ? (
        <div className="mt-1 px-2 text-fine text-fg-faint">and {hits.length - shown.length} more; type more to narrow it</div>
      ) : null}
    </section>
  );
}