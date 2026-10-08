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
 *     and the panel stands alone where it sits, on the page's own ground, in
 *     that state, so it is seen with its real contrast and edited in place.
 *     When the pick moves off it (Escape, a press on the empty board) the
 *     board comes back as it was;
 *   · for a declared panel, an edit goes to the state on show unless "All
 *     states" is on (`stateEdits.ts`);
 *   · hovering a panel in the rail snaps the page state at once to a scene
 *     that shows it and spotlights it on the board (everything else dimmed,
 *     other panels too), so he knows where it is; a panel no page state
 *     draws (a pop-up) pops up alone in the middle instead
 *     before he clicks; clicking centres it on a lone page, clear of the
 *     rail (J, 2026-10-06).
 */
import * as React from "react";
import { ChevronLeft, ChevronRight, Layers, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { useHeldStudio, useStudio, type StudioNode } from "../store";
import type { ScreenRead } from "./boardStates";
import type { Panel, PanelNode } from "./panels";
import { panelsOfPage, ISOLATE, isolateKey, readIsolateKey } from "./panelsOf";
import { isolatedOnBoard } from "../canvas/helpers";
import { labelsOf, readDeclared, statesOfPart, type DeclaredScene, type Samples } from "./stateRules";
import { checkIn, checkOut, stateEditKey, type CheckedOut } from "./stateEdits";
import { scenesOnPage } from "./sceneStep";
import { screenKey } from "./boardStates";
import { spotlight } from "./panelSpotlight";
import { MoreStates } from "./PanelsMore";
import { StructureView } from "./StructureView";

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
  const nodes = useHeldStudio((s) => s.nodes);
  const source = useHeldStudio((s) => sourceOf(s.look));
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

/** The page state snapped, with no slide, to the first scene that draws this hook, unless the one on show (or the page as it opens) already does. Says whether it is drawn now: false for a panel no scene draws (a pop-up such as the sign panel). */
export function snapToSceneShowing(hook: string, openShows: boolean): boolean {
  const st = useStudio.getState();
  const { scenes, at } = scenesOnPage(st);
  if (!scenes.length) return openShows;
  if (at >= 0 ? scenes[at]!.shows.includes(hook) : openShows) return true;
  const to = scenes.findIndex((x) => x.shows.includes(hook));
  if (to < 0) return false;
  const keys = scenes.map((x) => screenKey(x.name));
  st.setStatesOn([...(st.statesOn ?? []).filter((k) => !keys.includes(k) && !k.startsWith("panel:") && !k.startsWith("isolate:")), keys[to]!]);
  return true;
}

/** Scroll the board so a part sits in the middle of what the rail leaves visible (always, or only when it is not already in view). */
function bringToView(id: string, always: boolean) {
  const el = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
  const pane = el?.closest("[data-studio-pane]");
  if (!(el instanceof HTMLElement) || !(pane instanceof HTMLElement)) return;
  const r = el.getBoundingClientRect(), p = pane.getBoundingClientRect();
  const rail = document.querySelector("[data-panels-page]")?.getBoundingClientRect();
  const right = rail && rail.left > p.left ? Math.min(p.right, rail.left) : p.right;
  if (!always && r.left >= p.left && r.right <= right && r.top >= p.top && r.bottom <= p.bottom) return;
  pane.scrollTo({ left: pane.scrollLeft + (r.left + r.width / 2) - (p.left + right) / 2, top: pane.scrollTop + (r.top + r.height / 2) - (p.top + p.bottom) / 2, behavior: "smooth" });
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
  const pageId = useHeldStudio((s) => s.activePageId);
  const nodes = useHeldStudio((s) => s.nodes);
  const selection = useHeldStudio((s) => s.selection);
  const on = useHeldStudio((s) => s.statesOn ?? []);
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
    window.setTimeout(() => bringToView(id, true), 60);
  }, [panels]);
  /* Hovered in the rail: snapped to a scene that shows it, and lit on the board until the pointer leaves or he clicks. */
  const hovered = React.useRef<{ id: string; stop: (() => void) | null } | null>(null);
  /* A panel no page state draws (a pop-up) is shown on hover as it pops up: alone, in the middle, the rest dimmed (J, 2026-10-06). */
  const previewing = React.useRef(false);
  const unhover = React.useCallback(() => {
    hovered.current?.stop?.();
    hovered.current = null;
    if (!previewing.current) return;
    previewing.current = false;
    const store = useStudio.getState();
    store.setStatesOn((store.statesOn ?? []).filter((k) => !k.startsWith(ISOLATE)));
  }, []);
  const hover = React.useCallback((p: Panel) => {
    if (hovered.current?.id === p.id) return;
    unhover();
    if (useStudio.getState().statesOn?.some((k) => k.startsWith(ISOLATE))) return;
    hovered.current = { id: p.id, stop: null };
    const drawn = snapToSceneShowing(p.hook, !useStudio.getState().nodes.find((n) => n.id === p.id)?.state);
    const s0 = p.states[0];
    if (!drawn && s0) {
      previewing.current = true;
      const store = useStudio.getState();
      store.setStatesOn([...(store.statesOn ?? []).filter((k) => !k.startsWith(ISOLATE)), isolateKey(p.id, s0.key, s0.samples[0]?.key ?? "")]);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (hovered.current?.id !== p.id) return;
      hovered.current.stop = spotlight(p.id);
      bringToView(p.id, !drawn);
    }));
  }, [unhover]);
  React.useEffect(() => { if (!isOpen) unhover(); }, [isOpen, unhover]);
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
    if (!iso || previewing.current) return;
    /* Its own parts only: what it sits in is drawn round it, and picking that lets go. */
    const inside = new Set(isolatedOnBoard(useStudio.getState())?.places.keys() ?? []);
    if (!selection.length || !selection.some((id) => id === iso.panelId || inside.has(id))) letGo();
  }, [selection, iso?.panelId]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Picked on the board while the rail is open: the panel round it, isolated, as if picked in the rail (J, 2026-10-06: he clicked the tour to edit it and the board stayed as it was). Only on a new pick, so letting go in the rail stays let go. */
  const lastPick = React.useRef(selection);
  React.useEffect(() => {
    if (lastPick.current === selection) return;
    lastPick.current = selection;
    if (!isOpen || previewing.current || selection.length !== 1) return;
    const id = selection[0]!;
    if (iso && (id === iso.panelId || isolatedOnBoard(useStudio.getState())?.places.has(id))) return;
    const p = panelOf(nodes, panels, id);
    if (p && p.id !== iso?.panelId) isolate(p.id, null, null);
  }, [selection]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const editKey = isOpen && iso && iso.panelId === panel?.id && declared && panel && state && !allStates ? stateEditKey(panel.hook, state.key) : null;
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
    if (!n) return null;
    const said = statesOfPart(d, n.id);
    const l = labelsOf(n as unknown as PanelNode);
    const bits = [
      said ? `shows in: ${said.states.join(", ") || "no state"}` : null,
      l.kind ? `its text is ${l.kind}` : null,
      l.list ? `a list of rows (${l.list})` : null,
      l.group ? `edited with its group "${l.group}"` : null,
    ].filter(Boolean);
    return bits.length ? `${l.label ?? n.hooks?.["data-hook"] ?? n.label}: ${bits.join("; ")}` : null;
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
      {/* The page's layout, edited once for every state (`StructureView.tsx`, J 2026-10-08). */}
      <StructureView pageId={pageId} />
      {/* A site that does not follow the state rules keeps today's reading, and says why; one that does says what kit:check would find. */}
      {notes.length ? (
        <div data-state-rules-note={declared ? "problems" : "not-followed"} className="mb-1 rounded-md border border-border bg-bg px-2 py-1.5 text-small text-fg-muted">
          <p className="font-medium text-fg">{declared ? "State rules: fix these" : "Doesn't follow state rules"}</p>
          <ul className="mt-0.5 list-disc pl-4">{notes.slice(0, 6).map((x) => <li key={x}>{x}</li>)}</ul>
          {notes.length > 6 ? <p>and {notes.length - 6} more.</p> : null}
        </div>
      ) : null}
      {panels.length ? panels.map((p) => {
        const lit = p.id === panel?.id && !!iso && !previewing.current;
        return (
          <div key={p.id} className={cn("flex flex-col gap-1 rounded-md", lit && "bg-accent-soft/50 pb-1.5")}>
            <button type="button" data-panels-item={p.id} aria-pressed={lit} onPointerEnter={() => hover(p)} onPointerLeave={unhover} onFocus={() => hover(p)} onBlur={unhover} onClick={() => { play("tap"); unhover(); if (lit) letGo(); else isolate(p.id, null, null); }}
              className={cn("tactile flex h-7 w-full shrink-0 items-center gap-1.5 rounded-md px-2 text-left text-plain", lit ? "text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
              <Layers className={cn("size-3 shrink-0", lit && "text-accent")} />
              <span className="min-w-0 flex-1 truncate" title={p.hook}>{p.label ?? p.hook}</span>
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
      <MoreStates pageId={pageId} />
    </div>
  );
}
