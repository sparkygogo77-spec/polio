"use client";
/**
 * THE PANELS RAIL: EVERY PANEL OF THE PAGE, EACH WITH ITS STATES, ISOLATED ON THE BOARD (J, 2026-10-06).
 *
 * "When I select a single panel it should replace everything on the board,
 * only while it is selected", "over the background, so it can be edited",
 * "centred in the middle of the background", "a right panel that lets me use
 * the same 1/# arrow to scroll along a panel's states". So, opened from the
 * Panels tab beside the page or from "Edit on Panels page" on a panel's
 * right-click menu, a rail down the right of the board:
 *
 *   · the page's panels (`panelsOf.ts`): declared ones for a site that
 *     follows the state rules, else read from captures, with a note why;
 *   · the picked panel's states, stepped with ‹ 1/N › (or ↑ ↓), its samples
 *     of data as chips;
 *   · picking a panel or a state isolates it on the board itself
 *     (`canvas/helpers.ts#isolatedOnBoard`): the rest of the page steps away
 *     and the panel stands alone on the page's own background, centred, in
 *     that state, so it is seen with its real contrast and edited in place.
 *     When the pick moves off it (Escape, a press on the empty board) the
 *     board comes back as it was;
 *   · for a declared panel, an edit goes to the state on show unless "All
 *     states" is on (`stateEdits.ts`).
 */
import * as React from "react";
import { ChevronLeft, ChevronRight, Layers, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { useStudio, type StudioNode } from "./store";
import type { ScreenRead } from "./boardStates";
import type { Panel, PanelNode } from "./panels";
import { panelsOfPage, ISOLATE, isolateKey, readIsolateKey } from "./panelsOf";
import { isolatedOnBoard } from "./canvas/helpers";
import { readDeclared, statesOfPart, type DeclaredScene, type Samples } from "./stateRules";
import { checkIn, checkOut, stateEditKey, type CheckedOut } from "./stateEdits";

type Source = { files?: { file: string; pageId: string }[]; screens?: ScreenRead[]; scenes?: DeclaredScene[] | null; samples?: Samples | null };
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

/**
 * The page's screens and its panels, kept while the parts and the screens
 * are the same. A site that follows the state rules has its panels and
 * states declared (`stateRules.ts`); any other keeps the captured reading,
 * with notes on why.
 */
export function usePagePanels(pageId: string): { panels: Panel[]; screens: ScreenRead[]; declared: boolean; notes: string[] } {
  const nodes = useStudio((s) => s.nodes);
  const source = useStudio((s) => sourceOf(s.look));
  return React.useMemo(() => panelsOfPage(nodes as unknown as PanelNode[], source, pageId), [nodes, pageId, source]);
}

/*
 * The state being edited, checked out on the board's parts (`stateEdits.ts`):
 * its parts wear its look, so every panel edits it as usual.
 */
let checkedOut: CheckedOut | null = null;
function endStateEdit() {
  if (!checkedOut) return;
  const out = checkedOut;
  checkedOut = null;
  useStudio.setState((s) => ({ nodes: checkIn(s.nodes as never, out) as never }));
}
function beginStateEdit(key: string, ids: string[]) {
  endStateEdit();
  if (!ids.length) return;
  const got = checkOut(useStudio.getState().nodes as never, key, ids);
  checkedOut = got.out;
  useStudio.setState({ nodes: got.nodes as never });
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
  const nodes = useStudio((s) => s.nodes);
  const selection = useStudio((s) => s.selection);
  const on = useStudio((s) => s.statesOn ?? []);
  const { panels, declared, notes } = usePagePanels(pageId);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [stateKey, setStateKey] = React.useState<string | null>(null);
  const [sampleKey, setSampleKey] = React.useState<string | null>(null);
  const [allStates, setAllStates] = React.useState(false);
  const iso = on.map(readIsolateKey).find((x) => !!x) ?? null;
  const panel = panels.find((p) => p.id === picked) ?? null;
  const state = panel ? panel.states.find((x) => x.key === stateKey) ?? panel.states[0] ?? null : null;
  const sample = state ? state.samples.find((x) => x.key === sampleKey) ?? state.samples[0] ?? null : null;
  /* Isolate a panel on the board, in a state and sample, and pick it. */
  const isolate = React.useCallback((id: string, st: string | null, sm: string | null) => {
    const store = useStudio.getState();
    const p = panels.find((x) => x.id === id);
    const s0 = p?.states.find((x) => x.key === st) ?? p?.states[0];
    const m0 = s0?.samples.find((x) => x.key === sm) ?? s0?.samples[0];
    if (!p || !s0) return;
    setPicked(id); setStateKey(s0.key); setSampleKey(m0?.key ?? null);
    store.setStatesOn([...(store.statesOn ?? []).filter((k) => !k.startsWith(ISOLATE)), isolateKey(id, s0.key, m0?.key ?? "")]);
    if (!store.selection.includes(id)) store.setSelection([id]);
    window.setTimeout(() => document.querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }), 60);
  }, [panels]);
  const letGo = React.useCallback(() => {
    const store = useStudio.getState();
    const now = store.statesOn ?? [];
    if (now.some((k) => k.startsWith(ISOLATE))) store.setStatesOn(now.filter((k) => !k.startsWith(ISOLATE)));
  }, []);
  /* Opened on a part: the panel round it, isolated. */
  React.useEffect(() => {
    if (!isOpen || !want) return;
    const p = panelOf(nodes, panels, want);
    want = null;
    if (p) isolate(p.id, null, null);
  }, [isOpen, nodes, panels, isolate]);
  /* Only while it is picked: when the pick moves off the panel and everything in it, the board comes back. */
  React.useEffect(() => {
    if (!iso) return;
    const inside = new Set(isolatedOnBoard(useStudio.getState())?.shows ?? []);
    if (!selection.length || !selection.some((id) => id === iso.panelId || inside.has(id))) letGo();
  }, [selection, iso?.panelId]); // eslint-disable-line react-hooks/exhaustive-deps
  /* The rail closed: the board as it was. */
  React.useEffect(() => { if (!isOpen) letGo(); }, [isOpen, letGo]);
  /* ↑ ↓ step the picked panel's states. */
  const stepRef = React.useRef<(by: number) => void>(() => {});
  stepRef.current = (by) => {
    if (!panel || !state || panel.states.length < 2) return;
    const at = panel.states.indexOf(state);
    const next = panel.states[(at + by + panel.states.length) % panel.states.length]!;
    play("tap");
    isolate(panel.id, next.key, null);
  };
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (!t?.closest("[data-panels-page]") && !useStudio.getState().statesOn?.some((k) => k.startsWith(ISOLATE))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      stepRef.current(e.key === "ArrowDown" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen]);
  /* A declared panel's state on show is the one edited, unless "All states" is on (`stateEdits.ts`). */
  const editKey = isOpen && iso && declared && panel && state && !allStates ? stateEditKey(panel.hook, state.key) : null;
  const editIds = React.useMemo(() => {
    if (!editKey || !panel) return "";
    const d = readDeclared(nodes as unknown as PanelNode[]);
    const roots = new Set(d.panels.get(panel.hook)?.roots ?? []);
    return nodes.filter((n) => roots.has(n.id) || (d.up.get(n.id) ?? []).some((a) => roots.has(a.id))).map((n) => n.id).join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editKey, panel?.hook, nodes.length]);
  React.useEffect(() => {
    if (!editKey) return;
    beginStateEdit(editKey, editIds ? editIds.split(" ") : []);
    return () => endStateEdit();
  }, [editKey, editIds]);
  /* The picked part's states, said under the list (declared panels). */
  const partSays = React.useMemo(() => {
    if (!declared || selection.length !== 1) return null;
    const d = readDeclared(nodes as unknown as PanelNode[]);
    const n = nodes.find((x) => x.id === selection[0]);
    const said = n ? statesOfPart(d, n.id) : null;
    return said && n ? `${n.hooks?.["data-hook"] ?? n.label} shows in: ${said.states.join(", ") || "no state"}` : null;
  }, [declared, selection, nodes]);
  if (!isOpen) return null;
  const at = panel && state ? panel.states.indexOf(state) : -1;
  return (
    <div data-panels-page="" role="region" aria-label="Panels: every panel of the page and its states" className="absolute bottom-0 right-0 top-0 z-20 flex w-[240px] min-h-0 flex-col gap-0.5 overflow-y-auto border-l border-border bg-panel/95 p-2 backdrop-blur">
      <div className="mb-1 flex items-center gap-1">
        <p className="min-w-0 flex-1 px-2 text-fine font-medium uppercase tracking-wide text-fg-faint">Panels</p>
        <button type="button" data-panels-back="" onClick={() => closePanelsPage()} className="tactile flex size-6 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg" title="Close the panels">
          <X className="size-3.5" />
        </button>
      </div>
      {/* A site that does not follow the state rules keeps today's reading, and says why; one that does says what kit:check would find. */}
      {notes.length ? (
        <div data-state-rules-note={declared ? "problems" : "not-followed"} className="mb-1 rounded-md border border-border bg-bg px-2 py-1.5 text-small text-fg-muted">
          <p className="font-medium text-fg">{declared ? "State rules: fix these" : "Doesn't follow state rules"}</p>
          <ul className="mt-0.5 list-disc pl-4">{notes.slice(0, 6).map((x) => <li key={x}>{x}</li>)}</ul>
          {notes.length > 6 ? <p>and {notes.length - 6} more.</p> : null}
        </div>
      ) : null}
      {panels.length ? panels.map((p) => {
        const lit = p.id === panel?.id && !!iso;
        return (
          <div key={p.id} className={cn("flex flex-col gap-1 rounded-md", lit && "bg-accent-soft/50 pb-1.5")}>
            <button type="button" data-panels-item={p.id} aria-pressed={lit} onClick={() => { play("tap"); if (lit) letGo(); else isolate(p.id, null, null); }}
              className={cn("tactile flex h-7 w-full shrink-0 items-center gap-1.5 rounded-md px-2 text-left text-plain", lit ? "text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
              <Layers className={cn("size-3 shrink-0", lit && "text-accent")} />
              <span className="min-w-0 flex-1 truncate">{p.hook}</span>
              <span className="num shrink-0 text-fine text-fg-faint">{p.states.length}</span>
            </button>
            {lit && state ? (
              <div data-panel-states={p.id} role="group" aria-label={`States of ${p.hook}`} className="flex flex-col gap-1 px-1">
                {/* ‹ 1/N ›: the same arrow through its states, each isolated on the board. */}
                <div className="flex items-center gap-1">
                  <button type="button" data-panel-state-prev="" aria-label="Previous state" onClick={() => stepRef.current(-1)} disabled={p.states.length < 2} className="tactile flex size-6 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
                  <span data-panel-state-at="" className="min-w-0 flex-1 truncate text-center text-small text-fg"><span className="num text-fg-faint">{at + 1}/{p.states.length}</span> {state.label}</span>
                  <button type="button" data-panel-state-next="" aria-label="Next state" onClick={() => stepRef.current(1)} disabled={p.states.length < 2} className="tactile flex size-6 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
                </div>
                {p.states.map((x) => (
                  <button key={x.key} type="button" data-panel-state={x.key} aria-pressed={x === state} onClick={() => { play("tap"); isolate(p.id, x.key, null); }}
                    className={cn("tactile flex h-6 w-full items-center gap-1.5 rounded-md px-2 text-left text-small", x === state ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
                    <span className="min-w-0 flex-1 truncate">{x.label}</span>
                    {x.samples.length > 1 ? <span className="num shrink-0 text-fine text-fg-faint">{x.samples.length}</span> : null}
                  </button>
                ))}
                {state.samples.length > 1 && sample ? (
                  <div className="flex flex-wrap gap-1 px-1" data-panel-samples={state.key} aria-label="Samples of its data">
                    {state.samples.map((x) => (
                      <button key={x.key} type="button" data-panel-sample={x.key} aria-pressed={x === sample} title={x.screen ? x.screen.label || x.screen.name : x.label} onClick={() => { play("tap"); isolate(p.id, state.key, x.key); }}
                        className={cn("tactile h-6 max-w-[200px] truncate rounded-full border px-2 text-small", x === sample ? "border-accent bg-accent text-accent-fg" : "border-border bg-panel text-fg-muted hover:border-border-strong hover:text-fg")}>
                        {x.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {declared ? (
                  <button type="button" data-panel-all-states="" aria-pressed={allStates} onClick={() => { play("tap"); setAllStates((v) => !v); }} title="Off: an edit changes only the state on show. On: it changes the part in every state."
                    className={cn("tactile h-6 rounded-md border px-2 text-small", allStates ? "border-accent bg-accent text-accent-fg" : "border-border bg-panel text-fg-muted hover:text-fg")}>
                    {allStates ? "Edits: all states" : `Edits: ${state.label} only`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      }) : <p className="px-2 text-small text-fg-muted">No panel on this page changes with its data.</p>}
      {partSays ? <p data-panel-part-states="" className="mt-1 px-2 text-fine text-fg-faint">{partSays}</p> : null}
    </div>
  );
}
