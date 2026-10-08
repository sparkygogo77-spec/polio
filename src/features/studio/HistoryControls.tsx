"use client";
/**
 * UNDO, REDO, AND THE STEPS BEHIND THEM.
 *
 * The keys said "Undo" and "Redo" and nothing about what either would do, and
 * there was no way to see the steps or to go back more than one at a time.
 * Now each key's tooltip names its step ("Undo: move COPY CA"), and the small
 * key beside them opens the last fifty steps, newest first: a press on one
 * puts the board as it was right after that step, in one change of state
 * (`travel`), and the steps after it stay on redo until the next edit.
 *
 * Names come from the documents themselves (`historyNames.ts`), so every kind
 * of edit has one without having to say it. `tests/undo-history.mjs`.
 */
import * as React from "react";
import { ChevronDown, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";
import { Popover } from "@/core/ui/popover";
import { cn } from "@/core/lib/cn";
import { getFeature } from "./catalog";
import { FORMAT_FIELDS } from "./format";
import { stepNameKept, type NameHelp, type StepDoc } from "./historyNames";
import { PROCESS } from "./threads";
import { snapshot, useStudio } from "./board/store";

/** How many steps the list shows, newest first. */
export const HISTORY_SHOWN = 50;

const HELP: NameHelp = {
  featureName: (id) => getFeature(id)?.name,
  formatName: (key) => FORMAT_FIELDS.find((f) => f.id === key)?.label,
};

const docNow = (): StepDoc => snapshot(useStudio.getState()) as unknown as StepDoc;
const named = (a: unknown, b: unknown) => stepNameKept(a as StepDoc, b as StepDoc, HELP);

/** What the next undo takes back, or null when there is nothing to undo. */
export function undoName(): string | null {
  const { past } = useStudio.getState();
  const last = past[past.length - 1];
  return last ? named(last, docNow()) : null;
}

/** What the next redo puts back, or null. */
export function redoName(): string | null {
  const { future } = useStudio.getState();
  return future[0] ? named(docNow(), future[0]) : null;
}

/** Words for a step inside a sentence: its first letter up, the rest as named. */
const lead = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The tooltip's words for a key: "Undo: move COPY CA", or that there is nothing to take back. */
export function stepTip(which: "undo" | "redo"): string {
  const name = which === "undo" ? undoName() : redoName();
  return name ? `${which === "undo" ? "Undo" : "Redo"}: ${name}` : which === "undo" ? "Nothing to undo" : "Nothing to redo";
}

/*
 * Named when the hand or the focus arrives and after each press, never on
 * every change of the board: a drag rewrites the document every frame, and
 * nobody is reading the tooltip then.
 */
function useTip(which: "undo" | "redo"): [string, () => void] {
  const [tip, setTip] = React.useState(which === "undo" ? "Undo" : "Redo");
  const read = React.useCallback(() => setTip(stepTip(which)), [which]);
  return [tip, read];
}

export interface HistoryRow {
  /** Where a press goes: negative is back, positive is forward, 0 is where the board is. */
  steps: number;
  name: string;
  kind: "redo" | "now" | "past" | "start";
}

/** The rows of the list, newest first: steps that can be redone, the step the board is at, then the ones behind it. */
export function historyRows(limit = HISTORY_SHOWN): HistoryRow[] {
  const { past, future } = useStudio.getState();
  const now = docNow();
  const rows: HistoryRow[] = [];
  /* Redo steps, farthest first so the list reads top to bottom as time. */
  const redo: HistoryRow[] = [];
  for (let j = 0; j < future.length && j < limit; j++) redo.push({ steps: j + 1, name: named(j === 0 ? now : future[j - 1], future[j]), kind: "redo" });
  rows.push(...redo.reverse());
  const P = past.length;
  if (P) rows.push({ steps: 0, name: named(past[P - 1], now), kind: "now" });
  for (let i = P - 2; i >= 0 && rows.length - redo.length < limit; i--) rows.push({ steps: -(P - 1 - i), name: named(past[i], past[i + 1]), kind: "past" });
  if (P && rows.length - redo.length <= limit) rows.push({ steps: -P, name: "the start of this history", kind: "start" });
  return rows;
}

function HistoryList({ onGo }: { onGo: () => void }) {
  useStudio((s) => s.past.length * 1000 + s.future.length);
  const rows = historyRows();
  if (!rows.length) return <p data-history-empty="" className="px-1 py-2 text-small text-fg-muted">No steps yet. Each change you make to the board is listed here, newest first.</p>;
  return (
    <div className="flex max-h-[min(420px,60vh)] w-[280px] flex-col overflow-y-auto" role="list" aria-label="Undo history">
      <p className="px-1.5 pb-1 text-small text-fg-faint">Newest first. Press a step to put the board back as it was right after it.</p>
      {rows.map((r, i) => (
        <button
          key={`${r.kind}${r.steps}${i}`}
          type="button"
          role="listitem"
          data-history-step={r.kind}
          data-history-steps={r.steps}
          aria-current={r.kind === "now" ? "step" : undefined}
          disabled={r.kind === "now"}
          onClick={() => { useStudio.getState().travel(r.steps); onGo(); }}
          className={cn(
            "tactile flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-small",
            r.kind === "now" ? "bg-accent-soft/40 text-fg" : "hover:bg-hover",
            r.kind === "redo" ? "text-fg-faint" : r.kind === "start" ? "italic text-fg-muted" : "text-fg-muted hover:text-fg",
          )}
        >
          <span className="min-w-0 flex-1 truncate" title={lead(r.name)}>{lead(r.name)}</span>
          {r.kind === "now" ? <span className="shrink-0 text-fine text-accent">now</span> : r.kind === "redo" ? <span className="shrink-0 text-fine">undone</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * Back is red, forward is green: the same pair as every process state in the
 * app, because undo and redo are the same question, is this going back or
 * going on. Only when there is something to undo: a disabled control that
 * still wears a colour is a lie.
 */
export function HistoryControls() {
  const past = useStudio((s) => s.past.length);
  const future = useStudio((s) => s.future.length);
  const [open, setOpen] = React.useState(false);
  const inking = useStudio((s) => s.tool === "pen");
  const [undoTip, readUndo] = useTip("undo");
  const [redoTip, readRedo] = useTip("redo");
  /* For the checks: the names and the list as a person would read them, and a store action by name (`tests/undo-history.mjs`). */
  React.useEffect(() => {
    const w = window as unknown as { __studioHistory?: unknown };
    w.__studioHistory = {
      undo: undoName,
      redo: redoName,
      rows: historyRows,
      act: (name: string, ...args: unknown[]) => (useStudio.getState() as unknown as Record<string, (...a: unknown[]) => unknown>)[name]!(...args),
      /* The document as the store holds it now: a big site's is in IndexedDB, packed, so localStorage has only a pointer. */
      doc: () => { const s = useStudio.getState(); return { nodes: s.nodes, pages: s.pages, frameWidth: s.frameWidth, statesOn: s.statesOn, zoom: s.zoom, activePageId: s.activePageId, styleSource: (s.look as { styleSource?: unknown } | undefined)?.styleSource }; },
    };
    return () => { delete w.__studioHistory; };
  }, []);
  /* A tooltip left open over a key follows the step it names. */
  React.useEffect(() => { readUndo(); readRedo(); }, [past, future, readUndo, readRedo]);
  return (
    <>
      <Tooltip content={undoTip} shortcut="mod+z">
        <Button
          variant="ghost" size="iconXs" aria-label="Undo" disabled={!past}
          data-history-undo=""
          data-history-tip={undoTip}
          onPointerEnter={readUndo}
          onFocus={readUndo}
          style={past ? { color: PROCESS.open } : undefined}
          onClick={() => useStudio.getState().undo()}
        >
          <Undo2 />
        </Button>
      </Tooltip>
      <Tooltip content={redoTip} shortcut="mod+shift+z">
        <Button
          variant="ghost" size="iconXs" aria-label="Redo" disabled={!future}
          data-history-redo=""
          data-history-tip={redoTip}
          onPointerEnter={readRedo}
          onFocus={readRedo}
          style={future ? { color: PROCESS.done } : undefined}
          onClick={() => useStudio.getState().redo()}
        >
          <Redo2 />
        </Button>
      </Tooltip>
      <Popover open={open} onOpenChange={setOpen} align="end" content={open ? <HistoryList onGo={() => setOpen(false)} /> : null}>
        <Tooltip content="Undo history: the last fifty steps">
          <Button variant={open ? "subtle" : "ghost"} size="iconXs" aria-label="Undo history" aria-pressed={open} data-history-open=""
            /* A caret, not a key: narrow from md up so the bar still fits at 1024 (`tests/menu-pass.mjs`); below md every key is a finger's width. */
            /* And with the pen in hand below xl, where its ink row is out, it steps aside: undo and redo stay, the list comes back with the next tool. */
            className={cn("md:!w-3.5 md:!min-w-0", inking && "md:hidden xl:inline-flex")}
            disabled={!past && !future}>
            <ChevronDown />
          </Button>
        </Tooltip>
      </Popover>
    </>
  );
}
