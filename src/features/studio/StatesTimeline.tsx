"use client";
/**
 * THE STATES TIMELINE: A PART'S FACES, IN ORDER.
 *
 * J (2026-10-03): a small popup on the part's right-click menu that shows
 * the part's states in order, from the first (connecting) through each
 * step to the end, each with a thumbnail and the data it holds; pressing a
 * step shows that state on the board. The steps are the frame's faces
 * (`stateFrames.ts`): what it opens with, then each hidden face in the
 * page's order. The look is the timeline's: each step a molten card
 * (`core/ui/molten`), joined to the next by a green strand. A picked step
 * is a board-only switch (`step:<frame>=<step>` in `statesOn`): the page
 * still opens as its code says.
 */
import * as React from "react";
import { X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { moltenClass, moltenSeed } from "@/core/ui/molten";
import { useStudio, type StudioNode } from "./store";
import { frameFor, readStepKey, stepData, stepKey, type StateFrame, type StateStep } from "./stateFrames";

let openFor: string | null = null;
const listeners = new Set<() => void>();
const changed = () => { for (const l of listeners) l(); };
/** Open the timeline for a part: a frame, or any of its states. */
export function openStatesTimeline(nodeId: string) { openFor = nodeId; play("open"); changed(); }
function useOpenFor() {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => { listeners.add(bump); return () => { listeners.delete(bump); }; }, []);
  return openFor;
}
const close = () => { openFor = null; play("close"); changed(); };

/** Does this part have a timeline to open? */
export function hasStates(nodes: readonly StudioNode[], id: string): boolean {
  return !!frameFor(nodes, id);
}

/** Show one face on the board, in place of the frame's others: null shows it as the page opens. */
export function showStep(frame: string, step: string | null) {
  const st = useStudio.getState();
  const rest = (st.statesOn ?? []).filter((k) => readStepKey(k)?.frame !== frame);
  st.setStatesOn(step ? [...rest, stepKey(frame, step)] : rest);
}

const THUMB = { w: 168, h: 92 };

/** The face, drawn small: each of its parts as a box of its colour, with its words. */
function Thumb({ nodes, frame, step }: { nodes: readonly StudioNode[]; frame: StudioNode; step: StateStep }) {
  const k = Math.min(THUMB.w / Math.max(1, frame.w), THUMB.h / Math.max(1, frame.h));
  const parts = step.parts.map((id) => nodes.find((n) => n.id === id)).filter((n): n is StudioNode => !!n);
  const fill = (n: StudioNode) => n.colour?.bg ?? (n.art?.background ? undefined : "transparent");
  return (
    <div
      data-state-thumb=""
      className="relative overflow-hidden rounded-[4px]"
      style={{ width: Math.round(frame.w * k), height: Math.round(frame.h * k), background: frame.colour?.bg ?? "oklch(0.16 0.02 150 / 0.85)", backgroundImage: frame.art?.background }}
    >
      {parts.map((n) => {
        const said = typeof n.content === "string" ? n.content : Array.isArray(n.content) ? n.content.map((s) => (s as { text?: string }).text ?? "").join("") : "";
        return (
          <div
            key={n.id}
            className="absolute overflow-hidden whitespace-nowrap leading-none"
            style={{
              left: (n.x - frame.x) * k, top: (n.y - frame.y) * k, width: Math.max(1, n.w * k), height: Math.max(1, n.h * k),
              background: fill(n), backgroundImage: n.art?.background,
              borderRadius: (n.radius ?? 0) * k,
              outline: n.edge?.width ? `${Math.max(0.5, n.edge.width * k)}px solid ${n.edge.colour ?? "currentColor"}` : undefined,
              color: n.colour?.text, fontSize: Math.max(4, (n.font?.px ?? 16) * k), fontWeight: n.font?.weight,
            }}
          >
            {said.trim()}
          </div>
        );
      })}
    </div>
  );
}

function Step({ nodes, frame, step, at, lit }: { nodes: readonly StudioNode[]; frame: StudioNode; step: StateStep; at: number; lit: boolean }) {
  const data = stepData(nodes, step);
  const line = (name: string, list: string[]) => (list.length ? <p className="truncate" title={list.join(" · ")}><span className="opacity-70">{name}</span> {list.slice(0, 3).join(" · ")}</p> : null);
  return (
    <button
      type="button"
      data-state-step={step.key}
      aria-pressed={lit}
      aria-label={`State ${at + 1}: ${step.label}`}
      onClick={() => { play("tap"); showStep(frame.id, step.key); useStudio.getState().setSelection([frame.id]); }}
      className={cn(moltenClass("verdant"), "tactile flex w-[184px] shrink-0 flex-col gap-1 rounded-lg p-2 text-left text-small leading-snug transition-[filter,transform]")}
      style={{ ...moltenSeed(`${frame.id}:${step.key}`), color: "oklch(0.93 0.055 150)", textShadow: "0 1px 2px oklch(0 0 0 / 0.7)", filter: lit ? "brightness(1.18)" : "none", transform: lit ? "translateY(-2px)" : "none", boxShadow: lit ? "0 0 0 2px oklch(0.85 0.15 150), 0 6px 16px oklch(0 0 0 / 0.5)" : "0 3px 6px oklch(0 0 0 / 0.5)" }}
    >
      <span className="flex items-center gap-1.5">
        <span className="num flex size-4 items-center justify-center rounded-full bg-[oklch(0.2_0.05_150/0.8)] text-fine">{at + 1}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{step.label}</span>
      </span>
      <Thumb nodes={nodes} frame={frame} step={step} />
      <span className="flex flex-col gap-0.5 text-fine" data-state-data="">
        {line("Words", data.words)}
        {line("Values", data.values)}
        {line("Settings", data.settings)}
      </span>
    </button>
  );
}

export function StatesTimeline() {
  const id = useOpenFor();
  const nodes = useStudio((s) => s.nodes);
  const on = useStudio((s) => s.statesOn ?? []);
  React.useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); close(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [id]);
  if (!id) return null;
  const fr: StateFrame | null = frameFor(nodes, id);
  const frame = fr ? nodes.find((n) => n.id === fr.frame) : null;
  if (!fr || !frame) return null;
  const picked = on.map(readStepKey).find((k) => k?.frame === fr.frame)?.step ?? null;
  return (
    <div data-states-timeline="" role="dialog" aria-label={`States timeline: ${fr.hook ?? frame.label}`} className="fixed bottom-24 left-1/2 z-[70] flex w-[min(820px,94vw)] -translate-x-1/2 flex-col gap-2 rounded-lg border border-border bg-panel p-3 shadow-2xl">
      <div className="flex items-center gap-2">
        <p className="text-plain font-medium text-fg">States timeline</p>
        <p className="min-w-0 flex-1 truncate text-small text-fg-muted">{fr.hook ?? frame.label} · {fr.steps.length} states, in order. Pick one to see it on the board.</p>
        {picked ? (
          <button type="button" data-state-step-off="" onClick={() => { play("tap"); showStep(fr.frame, null); }} className="tactile h-6 rounded-md px-2 text-small text-fg-muted hover:bg-hover hover:text-fg">As the page opens</button>
        ) : null}
        <button type="button" aria-label="Close the states timeline" onClick={close} className="tactile flex size-6 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg"><X className="size-3.5" /></button>
      </div>
      <div className="flex items-center overflow-x-auto pb-1" data-state-steps="">
        {fr.steps.map((s, i) => (
          <React.Fragment key={s.key}>
            {i ? <span aria-hidden className="h-1 w-6 shrink-0 rounded-full" style={{ background: "linear-gradient(90deg, oklch(0.55 0.14 150), oklch(0.72 0.17 150), oklch(0.55 0.14 150))", boxShadow: "0 0 6px oklch(0.7 0.16 150 / 0.6)" }} /> : null}
            <Step nodes={nodes} frame={frame} step={s} at={i} lit={picked === s.key} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
