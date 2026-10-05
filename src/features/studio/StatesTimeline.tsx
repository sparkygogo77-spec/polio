"use client";
/**
 * THE PAGE'S STATES, AND EACH PART'S, IN ONE PLACE.
 *
 * J (2026-10-03): a part's states in order, from the first through each step
 * to the end; pressing one shows it on the board. J (2026-10-05): "i cant see
 * which panels in which state", the thumbnails were shrunk past reading, and
 * picking some steps changed the whole site. So:
 *
 *   · the board is the picture: a step bar on the board (`StepBar`) clicks a
 *     part through 1 to N and Finish, swapping it in the Builder itself;
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
import { ChevronLeft, ChevronRight, ChevronDown, Layers, X, Flag } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { useStudio, type StudioNode } from "./store";
import { partSteps, screenKey, type ScreenRead } from "./boardStates";
import { frameFor, readStepKey, stateFrames, stepData, stepKey } from "./stateFrames";

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
function followsPage(row: Row, screen: ScreenRead | null): number {
  if (!screen) return 0;
  const at = row.steps.findIndex((c) => c.screen === screen.name);
  if (at > 0) return at;
  const shows = new Set(screen.shows);
  const face = row.steps.findIndex((c, i) => i > 0 && !c.screen && !!c.hook && shows.has(c.hook));
  return face > 0 ? face : 0;
}
/** The step a part is in now, by its place in the row, and whether the page put it there. */
function stepNow(row: Row, on: readonly string[], screen: ScreenRead | null): { at: number; byPage: boolean } {
  const k = pickedOf(on, row.frame.id);
  if (k) { const at = row.steps.findIndex((c) => c.key === k); if (at >= 0) return { at, byPage: false }; }
  const at = followsPage(row, screen);
  return { at, byPage: at > 0 };
}
const nameOf = (row: Row) => row.frame.hooks?.["data-hook"] ?? row.frame.label;

function pick(row: Row, at: number) {
  const c = row.steps[at];
  if (!c) return;
  showStep(row.frame.id, c.key);
  useStudio.getState().setSelection([row.frame.id]);
}

/**
 * THE STEP BAR, ON THE BOARD. The part picked (or the part round the one
 * picked), and any part stepped away from how the page opens: its name, a
 * key for each step, back and next, and Finish at the end, which puts it
 * back as the page opens. Pinned to the foot of the board, so a tall
 * panel's bar is never below the fold.
 */
export function StepBar() {
  const pageId = useStudio((s) => s.activePageId);
  const selection = useStudio((s) => s.selection);
  const on = useStudio((s) => s.statesOn ?? []);
  const { screens, rows } = usePageStates(pageId);
  if (!rows.length) return null;
  const byFrame = new Map(rows.map((r) => [r.frame.id, r]));
  /* The picked part's own row, else the innermost row round it. */
  const r = stateFrames(useStudio.getState().nodes as never);
  const rowOf = (id: string): Row | null => {
    for (let at: string | undefined = id, i = 0; at && i < 12; i++) {
      const row = byFrame.get(at);
      if (row) return row;
      const up: string | undefined = r.inFrame.get(at);
      at = up && up !== at ? up : undefined;
    }
    return null;
  };
  const show: Row[] = [];
  const sel = selection.length === 1 ? rowOf(selection[0]!) : null;
  if (sel) show.push(sel);
  for (const row of rows) if (!show.includes(row) && pickedOf(on, row.frame.id)) show.push(row);
  if (!show.length) return null;
  const screen = litScreenOf(on, screens);
  return (
    <div data-step-bars="" className="pointer-events-none sticky bottom-3 z-30 flex h-0 w-full justify-center overflow-visible">
      <div className="absolute bottom-0 flex flex-col items-center gap-1.5">
        {show.slice(0, 3).map((row) => <Bar key={row.frame.id} row={row} now={stepNow(row, on, screen)} />)}
      </div>
    </div>
  );
}

function Bar({ row, now }: { row: Row; now: { at: number; byPage: boolean } }) {
  const n = row.steps.length, at = now.at, last = at === n - 1;
  const go = (i: number) => { play("tap"); pick(row, i); };
  return (
    <div
      data-step-bar={row.frame.id}
      role="toolbar"
      aria-label={`States of ${nameOf(row)}: ${at + 1} of ${n}`}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border-strong bg-panel/95 p-1 shadow-panel backdrop-blur"
    >
      <span className="flex items-center gap-1.5 pl-1.5 pr-1 text-plain font-medium text-fg">
        <Layers className="size-3.5 shrink-0 text-accent" />
        <span className="max-w-[160px] truncate">{nameOf(row)}</span>
      </span>
      <button type="button" data-step-back="" aria-label="The step before" disabled={at === 0} onClick={() => go(at - 1)} className="tactile flex size-7 items-center justify-center rounded-md text-fg-muted enabled:hover:bg-hover enabled:hover:text-fg disabled:opacity-30">
        <ChevronLeft className="size-4" />
      </button>
      {row.steps.map((c, i) => (
        <button
          key={c.key ?? "open"}
          type="button"
          data-step-key={c.key ?? "open"}
          aria-pressed={i === at}
          aria-label={`Step ${i + 1}: ${c.label}`}
          title={`${i + 1}. ${c.label}`}
          onClick={() => go(i)}
          className={cn("tactile num flex size-7 items-center justify-center rounded-md text-plain font-semibold", i === at ? (now.byPage ? "bg-accent-soft text-fg outline-dashed outline-1 outline-accent" : "bg-accent text-accent-fg") : "text-fg-muted hover:bg-hover hover:text-fg")}
        >
          {i + 1}
        </button>
      ))}
      {last ? (
        <button type="button" data-step-finish="" onClick={() => go(0)} className="tactile flex h-7 items-center gap-1 rounded-md px-2 text-plain font-medium text-fg hover:bg-hover">
          <Flag className="size-3.5 text-accent" /> Finish
        </button>
      ) : (
        <button type="button" data-step-next="" aria-label="The next step" onClick={() => go(at + 1)} className="tactile flex size-7 items-center justify-center rounded-md text-fg hover:bg-hover">
          <ChevronRight className="size-4" />
        </button>
      )}
      <span data-step-label="" className="max-w-[260px] truncate border-l border-border pl-2 pr-1.5 text-plain text-fg-muted">
        {now.byPage ? "as the page has it: " : ""}{row.steps[at]?.label}
      </span>
      <button type="button" data-step-all="" onClick={() => { play("tap"); openStatesTimeline(row.frame.id); }} className="tactile h-7 rounded-md px-2 text-small text-fg-muted hover:bg-hover hover:text-fg">
        All states
      </button>
    </div>
  );
}

/** A step as a card: plain, its number and name, lit when it is the one; its words, values and settings on hover. */
function StepCard({ row, card, at, lit, byPage, onPick }: { row: Row; card: Card; at: number; lit: boolean; byPage: boolean; onPick: () => void }) {
  const nodes = useStudio.getState().nodes;
  const data = stepData(nodes as never, { key: card.key ?? "open", label: card.label, hook: card.hook, parts: card.parts });
  const said = [data.words.length ? `Words: ${data.words.slice(0, 4).join(" · ")}` : "", data.values.length ? `Values: ${data.values.slice(0, 4).join(" · ")}` : "", data.settings.length ? `Settings: ${data.settings.slice(0, 3).join(" · ")}` : ""].filter(Boolean).join("\n");
  return (
    <button
      type="button"
      data-state-step={card.key ?? "open"}
      {...(card.screen ? { "data-state-screen": card.screen } : {})}
      data-state-data={said}
      aria-pressed={lit}
      aria-label={`State ${at + 1}: ${card.label}`}
      title={`${at + 1}. ${card.label}${card.screen ? " (a screen, kept to this part)" : ""}${said ? `\n${said}` : ""}`}
      onClick={() => { play("tap"); onPick(); }}
      className={cn(
        "tactile flex h-8 max-w-[220px] shrink-0 items-center gap-1.5 rounded-md border px-2 text-left text-plain",
        lit ? (byPage ? "border-dashed border-accent bg-accent-soft text-fg" : "border-accent bg-accent-soft text-fg ring-1 ring-accent") : "border-border bg-panel text-fg-muted hover:border-border-strong hover:text-fg",
      )}
    >
      <span className={cn("num flex size-5 shrink-0 items-center justify-center rounded-full text-fine font-semibold", lit ? "bg-accent text-accent-fg" : "bg-hover text-fg-muted")}>{at + 1}</span>
      <span className="min-w-0 truncate">{card.label}</span>
      <span className="sr-only">{row.frame.label}</span>
    </button>
  );
}

/**
 * In the shelf, where the categories are (J, 2026-10-04): the page's states
 * at a glance. Closing it gives the categories back.
 */
export function StatesTimeline() {
  const id = useOpenFor();
  const pageId = useStudio((s) => s.activePageId);
  const on = useStudio((s) => s.statesOn ?? []);
  const { screens, rows } = usePageStates(pageId);
  const [opened, setOpened] = React.useState<Set<string>>(() => new Set());
  React.useEffect(() => {
    if (id === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); close(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [id]);
  /* The part it was opened on: its own row, and every row round it open. */
  const nodes = useStudio((s) => s.nodes);
  const focus = React.useMemo(() => {
    if (!id) return null;
    const fr = frameFor(nodes, id);
    if (!fr) return null;
    const r = stateFrames(nodes as never);
    for (let at: string | undefined = fr.frame, i = 0; at && i < 12; i++) {
      if (rows.some((row) => row.frame.id === at)) return at;
      const up: string | undefined = r.inFrame.get(at);
      at = up && up !== at ? up : undefined;
    }
    return null;
  }, [id, nodes, rows]);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (focus) ref.current?.querySelector(`[data-state-row="${focus}"]`)?.scrollIntoView({ block: "nearest" }); }, [focus]);
  if (id === null) return null;
  const byFrame = new Map(rows.map((r) => [r.frame.id, r]));
  const chainOpen = (row: Row) => { for (let p = row.parent; p; p = byFrame.get(p)?.parent ?? null) if (!opened.has(p) && !isAbove(p)) return false; return true; };
  const isAbove = (frame: string) => { for (let at = focus ? byFrame.get(focus) : undefined; at; at = at.parent ? byFrame.get(at.parent) : undefined) if (at.parent === frame) return true; return false; };
  const inside = (frame: string) => rows.filter((r) => r.parent === frame).length;
  const screen = litScreenOf(on, screens);
  const anyOn = !!screen || rows.some((r) => pickedOf(on, r.frame.id));
  const pickScreen = (name: string | null) => {
    play("tap");
    const st = useStudio.getState();
    const mineScreens = new Set(screens.map((x) => screenKey(x.name)));
    const mineFrames = new Set(rows.map((r) => r.frame.id));
    /* The page as a whole: its parts follow it, so their own picks go. */
    const rest = (st.statesOn ?? []).filter((k) => !mineScreens.has(k) && !mineFrames.has(readStepKey(k)?.frame ?? ""));
    st.setStatesOn(name ? [...rest, screenKey(name)] : rest);
  };
  const reset = () => { play("tap"); pickScreen(null); };
  return (
    <div ref={ref} data-states-timeline="" role="region" aria-label="States: the page's and each part's" className="flex h-full w-full flex-col gap-2 overflow-y-auto bg-panel/50 p-3">
      <div className="flex items-center gap-2">
        <p className="text-plain font-medium text-fg">States</p>
        <p className="min-w-0 flex-1 truncate text-small text-fg-muted">Pick one to see it on the board. A part's states change only what is inside it; the page's change the page.</p>
        {anyOn ? (
          <button type="button" data-state-step-off="" onClick={reset} className="tactile h-6 rounded-md px-2 text-small text-fg-muted hover:bg-hover hover:text-fg">All as the page opens</button>
        ) : null}
        <button type="button" aria-label="Close the states" onClick={close} className="tactile flex size-6 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg"><X className="size-3.5" /></button>
      </div>

      {screens.length ? (
        <div data-page-states="" className="flex items-center gap-2">
          <p className="w-[150px] shrink-0 truncate text-small font-medium text-fg">The whole page</p>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
            {[null, ...screens].map((x, i) => {
              const lit = x ? screen?.name === x.name : !screen;
              return (
                <button
                  key={x?.name ?? "open"}
                  type="button"
                  data-page-state={x?.name ?? "open"}
                  aria-pressed={lit}
                  title={x ? `${x.label || x.name} (${x.name})` : "The page as it opens"}
                  onClick={() => pickScreen(x?.name ?? null)}
                  className={cn("tactile flex h-8 max-w-[220px] shrink-0 items-center gap-1.5 rounded-md border px-2 text-plain", lit ? "border-accent bg-accent-soft text-fg ring-1 ring-accent" : "border-border bg-panel text-fg-muted hover:border-border-strong hover:text-fg")}
                >
                  <span className={cn("num flex size-5 shrink-0 items-center justify-center rounded-full text-fine font-semibold", lit ? "bg-accent text-accent-fg" : "bg-hover text-fg-muted")}>{i + 1}</span>
                  <span className="min-w-0 truncate">{x ? (x.label || x.name).replace(/^[^:]{1,40}:\s*/, "") : "as it opens"}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {rows.length ? <p className="pt-1 text-fine text-fg-faint">Parts with states of their own. Pick a part on the board to step it through there.</p> : null}
      <div className="flex flex-col gap-1.5" data-state-rows="">
        {rows.filter(chainOpen).map((row) => {
          const now = stepNow(row, on, screen);
          const n = inside(row.frame.id), open = opened.has(row.frame.id) || isAbove(row.frame.id);
          return (
            <div key={row.frame.id} data-state-row={row.frame.id} className={cn("flex items-center gap-2 rounded-md", focus === row.frame.id && "bg-accent-soft/40")} style={{ paddingLeft: row.depth * 16 }}>
              <div className="flex w-[150px] shrink-0 items-center gap-1" style={{ width: 150 - row.depth * 16 }}>
                {n ? (
                  <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} the ${n} inside`} onClick={() => setOpened((s) => { const t = new Set(s); if (t.has(row.frame.id)) t.delete(row.frame.id); else t.add(row.frame.id); return t; })} className="tactile flex size-5 shrink-0 items-center justify-center rounded text-fg-faint hover:bg-hover hover:text-fg">
                    <ChevronDown className={cn("size-3 transition-transform", !open && "-rotate-90")} />
                  </button>
                ) : <span className="size-5 shrink-0" />}
                <button type="button" data-state-part={row.frame.id} onClick={() => { play("tap"); useStudio.getState().setSelection([row.frame.id]); }} className="tactile min-w-0 truncate rounded px-1 text-left text-small font-medium text-fg hover:bg-hover" title={`${nameOf(row)}: pick it on the board${n ? ` (${n} inside)` : ""}`}>
                  {nameOf(row)}
                </button>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5" data-state-steps="">
                {row.steps.map((c, i) => (
                  <StepCard key={c.key ?? "open"} row={row} card={c} at={i} lit={i === now.at} byPage={now.byPage} onPick={() => pick(row, i)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
