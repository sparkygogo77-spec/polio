"use client";
/**
 * THE PAGE'S STATES, AND EACH PART'S, IN ONE PLACE.
 *
 * J (2026-10-03): a part's states in order, from the first through each step
 * to the end; pressing one shows it on the board. J (2026-10-05): "i cant see
 * which panels in which state", the thumbnails were shrunk past reading, and
 * picking some steps changed the whole site. So:
 *
 *   · the board is the picture: a picked part's states are chips in the side
 *     panel next to Focus (`PartSamples`), swapping it in the Builder itself
 *     (2026-10-06: the step bar under the board went);
 *   · the shelf shows the page at a glance (`StatesTimeline`): the page's
 *     own states (its preview screens, which change the page as a whole) in
 *     one strip, and under it one row per part that goes through states,
 *     each step a plain card, the one it is in lit;
 *   · a part's step is kept to that part: only what is inside it changes,
 *     the rest of the page stays as it is (`boardStates.ts#steppedParts`).
 *
 * A pick is a board-only switch (`step:<frame>=<step>`, `screen:<name>` in
 * `statesOn`): the page still opens as its code says.
 */
import * as React from "react";
import { Layers, X, Maximize2 } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { useStudio, type StudioNode } from "./store";
import { partSteps, screenKey, type ScreenRead } from "./boardStates";
import { frameFor, readStepKey, stateFrames, stepData, stepKey } from "./stateFrames";
import { pageScenes } from "./scenes";
import { openPartFocus, PartAtSize } from "./PartFocus";

let openFor: string | null = null;
const listeners = new Set<() => void>();
const changed = () => { for (const l of listeners) l(); };
/** Open the states in the shelf, on a part (a frame, or any of its states), or on the page alone. */
export function openStatesTimeline(nodeId: string | null) { openFor = nodeId ?? ""; play("open"); changed(); }
function useOpenFor() {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => { listeners.add(bump); return () => { listeners.delete(bump); }; }, []);
  return openFor;
}
const close = () => { openFor = null; play("close"); changed(); };
/** Whether the states are open in the shelf (a part's id, "" for the page alone, null when shut): they show in place of the categories while they are. */
export const useStatesTimelineOpen = useOpenFor;

/** Does this part have states to step through? */
export function hasStates(nodes: readonly StudioNode[], id: string): boolean {
  return !!frameFor(nodes, id);
}

/** Show one step of a part on the board, in place of its others: null shows it as the page opens. */
export function showStep(frame: string, step: string | null) {
  const st = useStudio.getState();
  const rest = (st.statesOn ?? []).filter((k) => readStepKey(k)?.frame !== frame);
  st.setStatesOn(step ? [...rest, stepKey(frame, step)] : rest);
}

type Source = { files?: { file: string; pageId: string }[]; screens?: ScreenRead[] };
const sourceOf = (look: unknown) => (look as { styleSource?: Source } | undefined)?.styleSource;

/** One step of a part: `key` null is as the page opens. */
export interface Card { key: string | null; label: string; hook: string | null; parts: string[]; screen?: string }
/** A part that goes through states, with the parts round it. */
export interface Row { frame: StudioNode; depth: number; parent: string | null; steps: Card[] }

/**
 * The page's states: its screens, and each part that goes through states,
 * outermost first and each inside the one round it. A part's steps are what
 * it opens with, its own hidden faces, then the screens that change it; a
 * screen already a step of the part round it is that part's, not listed
 * twice.
 */
export function pageStates(nodes: readonly StudioNode[], pageId: string, source: Source | undefined): { screens: ScreenRead[]; rows: Row[] } {
  const file = source?.files?.find((f) => f.pageId === pageId)?.file ?? null;
  const screens = (source?.screens ?? []).filter((x) => !file || x.page === file);
  const r = stateFrames(nodes as never);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const mine = r.frames.filter((f) => f.pageId === pageId && byId.has(f.frame));
  const parentOf = (id: string) => { const p = r.inFrame.get(id); return p && p !== id && r.byFrame.has(p) ? p : null; };
  const kids = new Map<string | null, string[]>();
  for (const f of mine) { const p = parentOf(f.frame); kids.set(p, [...(kids.get(p) ?? []), f.frame]); }
  const rows: Row[] = [];
  const walk = (id: string, depth: number, parent: string | null, above: Set<string>) => {
    const fr = r.byFrame.get(id)!, frame = byId.get(id)!;
    const all = partSteps(nodes as never, frame as never, fr.steps, screens, file);
    const open = all.find((s) => s.key === "open");
    const steps: Card[] = [
      { key: null, label: open?.label ?? "as it opens", hook: open?.hook ?? null, parts: open?.parts ?? [] },
      ...all.filter((s) => s.key !== "open" && !(s.screen && above.has(s.screen))).map((s) => ({ key: s.key, label: s.label, hook: s.hook, parts: s.parts, screen: s.screen })),
    ];
    const here = new Set([...above, ...all.filter((s) => s.screen).map((s) => s.screen!)]);
    if (steps.length > 1) rows.push({ frame, depth, parent, steps });
    for (const k of kids.get(id) ?? []) walk(k, steps.length > 1 ? depth + 1 : depth, steps.length > 1 ? id : parent, here);
  };
  for (const id of kids.get(null) ?? []) walk(id, 0, null, new Set());
  return { screens, rows };
}

/** The page's states, kept while the parts and the page's screens are the same. */
function usePageStates(pageId: string) {
  const nodes = useStudio((s) => s.nodes);
  const source = useStudio((s) => sourceOf(s.look));
  return React.useMemo(() => pageStates(nodes, pageId, source), [nodes, pageId, source]);
}

/** Which step a part is in: the one picked for it, else (null) as the page has it. */
const pickedOf = (on: readonly string[], frame: string): string | null => on.map(readStepKey).find((k) => k?.frame === frame)?.step ?? null;
/** The page screen lit on the board, if one is. */
const litScreenOf = (on: readonly string[], screens: readonly ScreenRead[]) => screens.find((x) => on.includes(screenKey(x.name))) ?? null;
/** With no step picked, the step a lit page screen puts the part in: what that screen draws inside it. */
export function followsPage(row: Row, screen: ScreenRead | null, screens: readonly ScreenRead[] = []): number {
  if (!screen) return 0;
  const at = row.steps.findIndex((c) => c.screen === screen.name);
  if (at > 0) return at;
  /*
   * A part's steps keep one screen per step of the site's flow, and a step
   * that draws the part as the step before it is not listed again: the lobby
   * scene's chart row is its "between matches" step even when that step was
   * read off "TV: between matches". So the part is in the last of its steps
   * that comes no later in the flow than the scene's own.
   */
  if (screen.step) {
    const order = (step: string | null | undefined) => (step ? screens.findIndex((s) => s.step === step) : -1);
    const want = order(screen.step);
    let best = 0;
    if (want >= 0) row.steps.forEach((c, i) => {
      if (i === 0 || !c.screen) return;
      const o = order(screens.find((s) => s.name === c.screen)?.step);
      if (o >= 0 && o <= want) best = i;
    });
    if (best > 0) return best;
  }
  const shows = new Set(screen.shows);
  const face = row.steps.findIndex((c, i) => i > 0 && !c.screen && !!c.hook && shows.has(c.hook));
  return face > 0 ? face : 0;
}
/** The step a part is in now, by its place in the row, and whether the page put it there. */
function stepNow(row: Row, on: readonly string[], screen: ScreenRead | null, screens: readonly ScreenRead[] = []): { at: number; byPage: boolean } {
  const k = pickedOf(on, row.frame.id);
  if (k) { const at = row.steps.findIndex((c) => c.key === k); if (at >= 0) return { at, byPage: false }; }
  const at = followsPage(row, screen, screens);
  return { at, byPage: at > 0 };
}
const nameOf = (row: Row) => row.frame.hooks?.["data-hook"] ?? row.frame.label;

function pick(row: Row, at: number) {
  const c = row.steps[at];
  if (!c) return;
  showStep(row.frame.id, c.key);
  useStudio.getState().setSelection([row.frame.id]);
  snapTo(row.frame.id);
}

/**
 * The board goes to the part a step changes (J, 2026-10-06: "i cant tell
 * where this one leads"): scrolled to it when it is not already on screen,
 * and outlined for a moment either way. The pane is scrolled by hand, as
 * `ShelfCards.tsx#jumpTo` does, so the shelf stays where it is.
 */
export function snapTo(id: string) {
  if (typeof window === "undefined") return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = document.querySelector(`[data-studio-pane] [data-node-id="${CSS.escape(id)}"]`);
    const pane = el?.closest("[data-studio-pane]");
    if (!(el instanceof HTMLElement) || !(pane instanceof HTMLElement)) return;
    const r = el.getBoundingClientRect(), p = pane.getBoundingClientRect();
    const seen = r.top >= p.top && r.top < p.bottom - Math.min(r.height, p.height / 3);
    if (!seen) pane.scrollTo({ top: pane.scrollTop + (r.top - p.top) - Math.max(24, (p.height - r.height) / 2), behavior: "smooth" });
    el.setAttribute("data-just-shown", "");
    el.animate(
      [{ outline: "3px solid var(--accent)", outlineOffset: "3px" }, { outline: "3px solid transparent", outlineOffset: "12px" }],
      { duration: 1200, easing: "ease-out" },
    ).onfinish = () => el.removeAttribute("data-just-shown");
  }));
}

/** The row of the part picked, or of the innermost part round it that goes through states. */
function rowFor(rows: readonly Row[], nodes: readonly StudioNode[], id: string): Row | null {
  const byFrame = new Map(rows.map((r) => [r.frame.id, r]));
  const r = stateFrames(nodes as never);
  for (let at: string | undefined = id, i = 0; at && i < 12; i++) {
    const row = byFrame.get(at);
    if (row) return row;
    const up: string | undefined = r.inFrame.get(at);
    at = up && up !== at ? up : undefined;
  }
  return null;
}

/**
 * A PICKED PART'S SAMPLES OF DATA, IN THE SIDE PANEL, NEXT TO FOCUS (J,
 * 2026-10-06). The floating step bar under the board is gone: the part's
 * states (what it says when won, lost, waiting) are chips here, the one on
 * the board lit; pressing one swaps the part into it on the board.
 */
export function PartSamples({ nodeId }: { nodeId: string }) {
  const pageId = useStudio((s) => s.activePageId);
  const nodes = useStudio((s) => s.nodes);
  const on = useStudio((s) => s.statesOn ?? []);
  const { screens, rows } = usePageStates(pageId);
  const row = rowFor(rows, nodes, nodeId);
  if (!row) return null;
  const now = stepNow(row, on, litScreenOf(on, screens), screens);
  return (
    <div data-part-samples={row.frame.id} className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-small text-fg-muted" title={nameOf(row)}>{row.frame.id === nodeId ? "Samples of its data" : `Samples of ${nameOf(row)}`}</span>
        <button type="button" data-step-focus="" aria-label={`Focus on ${nameOf(row)}: every state at real size`} title="Focus: this part alone, every state at real size" onClick={() => openPartFocus(row.frame.id)} className="tactile flex h-6 items-center gap-1 rounded-md px-1.5 text-small text-fg-muted hover:bg-hover hover:text-fg">
          <Maximize2 className="size-3" /> Focus
        </button>
      </div>
      <Samples row={row} at={now.at} byPage={now.byPage} />
    </div>
  );
}

/** A part's samples as chips: the one on the board lit (dashed when the scene put it there). */
function Samples({ row, at, byPage }: { row: Row; at: number; byPage: boolean }) {
  return (
    <div className="flex max-w-[480px] flex-wrap gap-1" role="group" aria-label={`Samples of ${nameOf(row)}`}>
      {row.steps.map((c, i) => (
        <button
          key={c.key ?? "open"}
          type="button"
          data-state-step={c.key ?? "open"}
          {...(c.screen ? { "data-state-screen": c.screen } : {})}
          aria-pressed={i === at}
          title={[`${i + 1}. ${c.label}`, saidOf(c)].filter(Boolean).join("\n")}
          onClick={() => { play("tap"); pick(row, i); }}
          className={cn("tactile h-6 max-w-[160px] truncate rounded-full border px-2 text-small", i === at ? (byPage ? "border-dashed border-accent bg-accent-soft text-fg" : "border-accent bg-accent text-accent-fg") : "border-border bg-panel text-fg-muted hover:border-border-strong hover:text-fg")}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** A step's words, values and settings, for a cell's hover. */
function saidOf(card: Card | undefined): string {
  if (!card) return "";
  const data = stepData(useStudio.getState().nodes as never, { key: card.key ?? "open", label: card.label, hook: card.hook, parts: card.parts });
  return [data.words.length ? `Words: ${data.words.slice(0, 4).join(" · ")}` : "", data.values.length ? `Values: ${data.values.slice(0, 4).join(" · ")}` : "", data.settings.length ? `Settings: ${data.settings.slice(0, 3).join(" · ")}` : ""].filter(Boolean).join("\n");
}

/** Show one scene of the page (a variant's `screen:<name>`), or none: the page's parts follow it, so their own swaps go. Overlays on top stay. */
export function showScene(screens: readonly ScreenRead[], rows: readonly Row[], key: string | null) {
  const st = useStudio.getState();
  const mineScreens = new Set(screens.map((x) => screenKey(x.name)));
  const mineFrames = new Set(rows.map((r) => r.frame.id));
  const rest = (st.statesOn ?? []).filter((k) => !mineScreens.has(k) && !mineFrames.has(readStepKey(k)?.frame ?? ""));
  st.setStatesOn(key ? [...rest, key] : rest);
}
/** Switch an overlay on over the scene, or off. */
export function flipOnTop(key: string) {
  const st = useStudio.getState();
  const now = st.statesOn ?? [];
  st.setStatesOn(now.includes(key) ? now.filter((k) => k !== key) : [...now, key]);
}

/**
 * THE PAGE'S STATES AND ITS PANELS, IN THE SHELF (J, 2026-10-06).
 *
 * "different data within the same frame doesnt classify a different state
 * … i should be able to see these panels somewhere regardless for editing."
 * So the shelf holds two things:
 *
 *   · the states strip: as the page opens, then each real layout of the
 *     page in game order (`scenes.ts`: screens with the same parts at the
 *     same places are one state), the lit one's samples of data (won, lost,
 *     draw) as small chips, and a toggle for each overlay (the tour, the
 *     phone menu);
 *   · the Panels library: every part that goes through states (the
 *     scoreboard, the trades panel, the result panel, the balance panel…)
 *     drawn alone at real size, whichever state it lives in, with its
 *     samples as chips. It is the same part as on the page: pressing it
 *     picks it, so the side panel edits it, same data-hook, same style layer.
 */
export function StatesTimeline() {
  const id = useOpenFor();
  const pageId = useStudio((s) => s.activePageId);
  const on = useStudio((s) => s.statesOn ?? []);
  const nodes = useStudio((s) => s.nodes);
  const source = useStudio((s) => sourceOf(s.look));
  const { screens, rows } = usePageStates(pageId);
  const file = source?.files?.find((f) => f.pageId === pageId)?.file ?? null;
  const scenes = React.useMemo(() => pageScenes(screens, file), [screens, file]);
  React.useEffect(() => {
    if (id === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); close(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [id]);
  /* Opened on a part: its panel in the library, scrolled to. */
  const focus = React.useMemo(() => (id ? rowFor(rows, nodes, id)?.frame.id ?? null : null), [id, rows, nodes]);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (focus) ref.current?.querySelector(`[data-panel="${CSS.escape(focus)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [focus]);
  if (id === null) return null;
  const screen = litScreenOf(on, screens);
  const litScene = screen ? scenes.scenes.find((sc) => sc.variants.some((v) => v.screen.name === screen.name || v.same.includes(screen.name))) ?? null : null;
  const anyOn = !!screen || rows.some((r) => pickedOf(on, r.frame.id)) || scenes.onTop.some((v) => on.includes(v.key));
  const pickScene = (key: string | null) => { play("tap"); showScene(screens, rows, key); };
  const opening = () => { play("tap"); const st = useStudio.getState(); st.setStatesOn((st.statesOn ?? []).filter((k) => !k.startsWith("top:"))); showScene(screens, rows, null); };
  const pill = (lit: boolean) => cn("tactile flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-plain", lit ? "border-accent bg-accent-soft text-fg ring-1 ring-accent" : "border-border bg-panel text-fg-muted hover:border-border-strong hover:text-fg");
  return (
    <div ref={ref} data-states-timeline="" role="region" aria-label="The page's states and its panels" className="flex h-full w-full flex-col gap-2 overflow-y-auto bg-panel/50 p-3">
      {/* The states strip: a state only where the layout changes. */}
      <div className="flex flex-wrap items-center gap-1.5" data-states-strip="">
        <p className="mr-1 text-plain font-medium text-fg">States</p>
        <button type="button" data-page-state="open" data-state-step-off="" aria-pressed={!anyOn} title="The page as it opens: every state, sample and overlay off" onClick={opening} className={pill(!anyOn)}>As it opens</button>
        {scenes.scenes.map((sc) => {
          const lit = sc === litScene;
          const first = sc.variants[0]!;
          return (
            <button key={sc.key} type="button" data-scene-state={sc.key} data-page-state={first.screen.name} aria-pressed={lit}
              title={`${sc.name}: ${sc.variants.length} ${sc.variants.length === 1 ? "sample" : "samples of data"} (${sc.variants.map((v) => v.label).join(", ")})`}
              onClick={() => { if (!lit) pickScene(first.key); }} className={pill(lit)}>
              <span className="min-w-0 max-w-[180px] truncate">{sc.name}</span>
              {sc.variants.length > 1 ? <span className="num text-fine text-fg-faint">{sc.variants.length}</span> : null}
            </button>
          );
        })}
        {scenes.onTop.length ? <span className="mx-0.5 h-4 w-px shrink-0 bg-border" /> : null}
        {scenes.onTop.map((v) => {
          const lit = on.includes(v.key);
          return (
            <button key={v.key} type="button" data-on-top-toggle={v.screen.name} aria-pressed={lit} title={`${v.screen.label || v.screen.name}: drawn over the state that is on`} onClick={() => { play("tap"); flipOnTop(v.key); }}
              className={cn("tactile flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-plain", lit ? "border-accent bg-accent-soft text-fg" : "border-dashed border-border text-fg-muted hover:text-fg")}>
              <Layers className={cn("size-3", lit && "text-accent")} />{v.label}
            </button>
          );
        })}
        <span className="flex-1" />
        <button type="button" aria-label="Close the states" onClick={close} className="tactile flex size-6 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg"><X className="size-3.5" /></button>
      </div>
      {/* The lit state's samples of data: same layout, other words. */}
      {litScene && litScene.variants.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1" data-scene-samples={litScene.key}>
          <span className="pr-1 text-small text-fg-muted">Samples of data</span>
          {litScene.variants.map((v) => {
            const lit = v.screen.name === screen!.name || v.same.includes(screen!.name);
            return (
              <button key={v.key} type="button" data-sample={v.screen.name} aria-pressed={lit} title={`${v.screen.label || v.screen.name}${v.same.length ? ` (also ${v.same.join(", ")})` : ""}`} onClick={() => { if (!lit) pickScene(v.key); }}
                className={cn("tactile h-6 max-w-[180px] truncate rounded-full border px-2 text-small", lit ? "border-accent bg-accent text-accent-fg" : "border-border bg-panel text-fg-muted hover:border-border-strong hover:text-fg")}>
                {v.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <PanelsLibrary rows={rows} screens={screens} on={on} focus={focus} />
    </div>
  );
}

/** Every panel that shows data, alone at real size, whichever state it lives in, each with its samples as chips. */
function PanelsLibrary({ rows, screens, on, focus }: { rows: readonly Row[]; screens: readonly ScreenRead[]; on: readonly string[]; focus: string | null }) {
  if (!rows.length) return null;
  const screen = litScreenOf(on, screens);
  return (
    <div data-panels-library="" className="flex flex-col gap-1.5 border-t border-border pt-2">
      <p className="text-small text-fg-muted"><span className="font-medium text-fg">Panels</span> · every part that shows data, at real size, whatever state it lives in. Press one to edit it.</p>
      <div className="flex items-start gap-4 overflow-x-auto pb-2">
        {rows.map((row) => {
          const now = stepNow(row, on, screen, screens);
          const card = row.steps[now.at] ?? row.steps[0]!;
          const select = () => { play("tap"); useStudio.getState().setSelection([row.frame.id]); snapTo(row.frame.id); };
          return (
            <figure key={row.frame.id} data-panel={row.frame.id} data-state-row={row.frame.id} className={cn("flex shrink-0 flex-col gap-1.5 rounded-md p-1.5", focus === row.frame.id && "bg-accent-soft/40")}>
              <div className="flex items-center gap-1">
                <button type="button" data-state-part={row.frame.id} onClick={select} className="tactile min-w-0 truncate rounded px-1 text-left text-small font-medium text-fg hover:bg-hover" title={`${nameOf(row)}: pick it to edit`}>{nameOf(row)}</button>
                <button type="button" data-state-focus={row.frame.id} aria-label={`Focus on ${nameOf(row)}: every state at real size`} title="Focus: this part alone, every state at real size" onClick={() => openPartFocus(row.frame.id)} className="tactile flex size-6 shrink-0 items-center justify-center rounded text-fg-faint hover:bg-hover hover:text-fg">
                  <Maximize2 className="size-3" />
                </button>
              </div>
              <Samples row={row} at={now.at} byPage={now.byPage} />
              <div role="button" tabIndex={0} data-panel-drawing={row.frame.id} aria-label={`Edit ${nameOf(row)}`} onClick={select} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } }} className="cursor-pointer self-start">
                <PartAtSize frame={row.frame} card={card} />
              </div>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
