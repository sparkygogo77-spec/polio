"use client";
/**
 * THE PANELS PAGE: EVERY DATA PANEL OF THE PAGE, EACH WITH ITS STATES (J, 2026-10-06).
 *
 * "Give data panels their own page, next to the main page, for designing
 * panels." The Panels shelf under the board went (it needed dragging open
 * and scrolled sideways). Opened from the Panels tab beside the page, or
 * from "See states" on any panel's right-click menu:
 *
 *   · down the left, the page's panels (`panels.ts#pagePanels`), any site's;
 *   · beside them, the picked panel's states down a side list, the lit one's
 *     samples of data (won, lost, draw) as small chips under it;
 *   · in the middle, the panel alone at real size in that state, drawing only
 *     what is visible in it (`panels.ts#panelDrawing`).
 *
 * It is the same part as on the page: pressing it picks it, so the side
 * panel edits it (same data-hook, same style layer). Escape or the page's
 * name goes back to the board.
 */
import * as React from "react";
import { ArrowLeft, Layers } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { useStudio, type StudioNode } from "./store";
import type { ScreenRead } from "./boardStates";
import { pagePanels, panelDrawing, type Panel, type PanelNode } from "./panels";
import { PartCopy } from "./live/LiveSite";
import { leadsOf } from "./parts/leadIn";
import { themeFrom } from "./blocks";
import { resolvePalette } from "./parts/theme";
import type { Placed } from "./live/reflow";

type Source = { files?: { file: string; pageId: string }[]; screens?: ScreenRead[] };
const sourceOf = (look: unknown) => (look as { styleSource?: Source } | undefined)?.styleSource;

let open = false;
let want: string | null = null;
const listeners = new Set<() => void>();
const changed = () => { for (const l of listeners) l(); };
/** Open the Panels page, on the panel holding this part when one is given. */
export function openPanelsPage(nodeId: string | null = null) { open = true; want = nodeId; play("open"); changed(); }
export function closePanelsPage() { if (!open) return; open = false; play("close"); changed(); }
export function usePanelsPageOpen() {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => { listeners.add(bump); return () => { listeners.delete(bump); }; }, []);
  return open;
}

/** The page's screens and its panels, kept while the parts and the screens are the same. */
export function usePagePanels(pageId: string): { panels: Panel[]; screens: ScreenRead[] } {
  const nodes = useStudio((s) => s.nodes);
  const source = useStudio((s) => sourceOf(s.look));
  return React.useMemo(() => {
    const file = source?.files?.find((f) => f.pageId === pageId)?.file ?? null;
    const screens = (source?.screens ?? []).filter((x) => !file || !x.page || x.page === file);
    return { panels: pagePanels(nodes as unknown as PanelNode[], pageId, screens), screens };
  }, [nodes, pageId, source]);
}

/** The panel a part is, or the innermost one round it. */
export function panelOf(nodes: readonly StudioNode[], panels: readonly Panel[], id: string): Panel | null {
  if (panels.some((p) => p.id === id)) return panels.find((p) => p.id === id)!;
  const n = nodes.find((x) => x.id === id);
  if (!n) return null;
  const sel = n.from?.selector ?? null;
  const round = panels
    .map((p) => ({ p, node: nodes.find((x) => x.id === p.id) }))
    .filter(({ node }) => node && (sel && node.from?.selector ? sel.startsWith(`${node.from.selector} `) : n.x >= node.x && n.y >= node.y && n.x + n.w <= node.x + node.w && n.y + n.h <= node.y + node.h))
    .sort((a, b) => a.node!.w * a.node!.h - b.node!.w * b.node!.h);
  return round[0]?.p ?? null;
}

export function PanelsPage() {
  const isOpen = usePanelsPageOpen();
  const pageId = useStudio((s) => s.activePageId);
  const pageName = useStudio((s) => s.pages.find((p) => p.id === s.activePageId)?.name ?? "the page");
  const nodes = useStudio((s) => s.nodes);
  const { panels } = usePagePanels(pageId);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [stateKey, setStateKey] = React.useState<string | null>(null);
  const [sampleKey, setSampleKey] = React.useState<string | null>(null);
  /* Opened on a part: the panel round it. */
  React.useEffect(() => {
    if (!isOpen || !want) return;
    const p = panelOf(nodes, panels, want);
    want = null;
    if (p) { setPicked(p.id); setStateKey(null); setSampleKey(null); useStudio.getState().setSelection([p.id]); }
  }, [isOpen, nodes, panels]);
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "Escape" && !t?.closest("input, textarea, [contenteditable]")) { e.stopImmediatePropagation(); closePanelsPage(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen]);
  const listRef = React.useRef<HTMLDivElement>(null);
  const panel = panels.find((p) => p.id === picked) ?? panels[0] ?? null;
  React.useEffect(() => { if (panel) listRef.current?.querySelector(`[data-panels-item="${CSS.escape(panel.id)}"]`)?.scrollIntoView({ block: "nearest" }); }, [panel?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!isOpen) return null;
  const state = panel ? panel.states.find((s) => s.key === stateKey) ?? panel.states[0]! : null;
  const sample = state ? state.samples.find((s) => s.key === sampleKey) ?? state.samples[0]! : null;
  const pickPanel = (id: string) => { play("tap"); setPicked(id); setStateKey(null); setSampleKey(null); useStudio.getState().setSelection([id]); };
  return (
    <div data-panels-page="" role="region" aria-label="Panels: every panel of the page and its states" className="absolute inset-0 z-20 flex min-h-0 bg-bg">
      {/* The page's panels. */}
      <div ref={listRef} data-panels-list="" className="flex w-[220px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-panel/60 p-2">
        <button type="button" data-panels-back="" onClick={() => closePanelsPage()} className="tactile mb-1 flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-plain text-fg-muted hover:bg-hover hover:text-fg" title="Back to the page (Escape)">
          <ArrowLeft className="size-3.5 shrink-0" /><span className="min-w-0 truncate">{pageName}</span>
        </button>
        <p className="px-2 pb-1 text-fine font-medium uppercase tracking-wide text-fg-faint">Panels</p>
        {panels.length ? panels.map((p) => (
          <button key={p.id} type="button" data-panels-item={p.id} aria-pressed={p.id === panel?.id} onClick={() => pickPanel(p.id)}
            className={cn("tactile flex h-7 w-full shrink-0 items-center gap-1.5 rounded-md px-2 text-left text-plain", p.id === panel?.id ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
            <Layers className={cn("size-3 shrink-0", p.id === panel?.id && "text-accent")} />
            <span className="min-w-0 flex-1 truncate">{p.hook}</span>
            <span className="num shrink-0 text-fine text-fg-faint">{p.states.length}</span>
          </button>
        )) : <p className="px-2 text-small text-fg-muted">No panel on this page changes with its data.</p>}
      </div>
      {panel && state && sample ? (
        <>
          {/* The picked panel's states, down a side list; the lit one's samples under it. */}
          <div data-panel-states={panel.id} role="group" aria-label={`States of ${panel.hook}`} className="flex w-[220px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-border p-2">
            <p className="px-2 pb-1 text-fine font-medium uppercase tracking-wide text-fg-faint">States</p>
            {panel.states.map((s) => {
              const lit = s === state;
              return (
                <div key={s.key} className={cn("flex flex-col gap-1 rounded-md", lit && "bg-accent-soft/50 pb-1.5")}>
                  <button type="button" data-panel-state={s.key} aria-pressed={lit} onClick={() => { play("tap"); setStateKey(s.key); setSampleKey(null); }}
                    className={cn("tactile flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-plain", lit ? "text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    {s.samples.length > 1 ? <span className="num shrink-0 text-fine text-fg-faint">{s.samples.length}</span> : null}
                  </button>
                  {lit && s.samples.length > 1 ? (
                    <div className="flex flex-wrap gap-1 px-2" data-panel-samples={s.key} aria-label="Samples of its data">
                      {s.samples.map((x) => (
                        <button key={x.key} type="button" data-panel-sample={x.key} aria-pressed={x === sample} title={x.screen ? x.screen.label || x.screen.name : x.label} onClick={() => { play("tap"); setSampleKey(x.key); }}
                          className={cn("tactile h-6 max-w-[180px] truncate rounded-full border px-2 text-small", x === sample ? "border-accent bg-accent text-accent-fg" : "border-border bg-panel text-fg-muted hover:border-border-strong hover:text-fg")}>
                          {x.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {/* The panel alone, at real size, in that state. */}
          <div className="flex min-w-0 flex-1 flex-col overflow-auto p-6" data-panel-stage={panel.id}>
            <p className="mb-3 text-small text-fg-muted"><span className="font-medium text-fg">{panel.hook}</span> · {state.label}{state.samples.length > 1 ? ` · ${sample.label}` : ""}. Press it to edit it.</p>
            <PanelAtSize panelId={panel.id} screen={sample.screen} />
          </div>
        </>
      ) : null}
    </div>
  );
}

/** One panel drawn alone at real size, in one sample of one state: only what is visible in it. */
export function PanelAtSize({ panelId, screen }: { panelId: string; screen: ScreenRead | null }) {
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const siteName = useStudio((s) => s.brief.name);
  const pageId = nodes.find((n) => n.id === panelId)?.pageId;
  const page = React.useMemo(() => nodes.filter((n) => n.pageId === pageId), [nodes, pageId]);
  const leads = React.useMemo(() => leadsOf(page), [page]);
  const t = React.useMemo(() => themeFrom(format, look, siteName), [format, look, siteName]);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const d = React.useMemo(() => panelDrawing(page as unknown as PanelNode[], panelId, screen), [page, panelId, screen]);
  const select = () => { play("tap"); useStudio.getState().setSelection([panelId]); };
  return (
    <div role="button" tabIndex={0} aria-label="Edit this panel" data-panel-drawing={panelId} data-panel-parts={d.placed.length} onClick={select}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } }}
      className="shrink-0 cursor-pointer self-start rounded-sm outline outline-1 outline-white/20" style={{ width: d.box.w, height: d.box.h }}>
      <PartCopy of={panelId} box={d.box} placed={d.placed as unknown as Placed[]} leads={leads} t={t} palette={palette} light={look?.light} look={look} still />
    </div>
  );
}
