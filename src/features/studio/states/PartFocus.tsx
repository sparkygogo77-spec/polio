"use client";
/**
 * ONE PART, ALONE, AT ITS REAL SIZE, WITH ALL ITS STATES SIDE BY SIDE.
 *
 * J (2026-10-06): "Focus: open any part alone at real size with all its
 * states side by side." On the board a part's states are seen one at a time,
 * inside the page, at the board's zoom. Focus takes the part out of the page:
 * every state it goes through (`StatesTimeline.tsx#pageStates`), each drawn
 * at 1:1 with what that state draws inside it, where it draws it, and with
 * its own words (`boardStates.ts#steppedParts`), in a row to scroll along.
 * Pressing a state shows it on the board too. Escape, the close key or the
 * shade closes it.
 */
import * as React from "react";
import { X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { useStudio, type StudioNode } from "../board/store";
import { partsInside, steppedParts, type ScreenRead } from "./boardStates";
import { stateFrames, stepKey } from "./stateFrames";
import { pageStates, showStep, type Card } from "./StatesTimeline";
import { PartCopy } from "../live/LiveSite";
import { leadsOf } from "../parts/leadIn";
import { themeFrom } from "../blocks";
import { resolvePalette } from "../parts/theme";
import type { Placed } from "../live/reflow";

let focusFor: string | null = null;
const listeners = new Set<() => void>();
/** Open a part alone, with every state it goes through side by side. */
export function openPartFocus(id: string | null) { focusFor = id; play(id ? "open" : "close"); for (const l of listeners) l(); }
function useFocusFor() {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => { listeners.add(bump); return () => { listeners.delete(bump); }; }, []);
  return focusFor;
}

type Source = { files?: { file: string; pageId: string }[]; screens?: ScreenRead[] };

/** What one state of a part draws: the part's box in it and every part inside, placed and worded as that state has them. */
export function stateDrawing(nodes: readonly StudioNode[], frame: StudioNode, card: Pick<Card, "key">, source: Source | undefined): { box: { w: number; h: number }; placed: Placed[] } {
  const fileOf = (pageId: string) => source?.files?.find((f) => f.pageId === pageId)?.file ?? null;
  const st = steppedParts(nodes as never, [stepKey(frame.id, card.key ?? "open")], source?.screens, fileOf, stateFrames(nodes as never));
  const fb = st.places.get(frame.id) ?? { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
  const decided = [...st.within].filter(([, f]) => f === frame.id).map(([id]) => id);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const inner = decided.length
    ? decided.filter((id) => st.decide.get(id) === true).map((id) => byId.get(id)!).filter(Boolean)
    : partsInside(nodes as never, frame as never).filter((n) => !(n as StudioNode).state) as unknown as StudioNode[];
  const placed = [frame, ...inner].map((n) => {
    const b = n.id === frame.id ? fb : st.places.get(n.id) ?? { x: n.x, y: n.y, w: n.w, h: n.h };
    const look = st.looks.get(n.id);
    const node = { ...n, ...(look ?? {}), state: null, x: b.x, y: b.y, w: b.w, h: b.h } as StudioNode;
    return { node, x: b.x, y: b.y, w: b.w, h: b.h };
  });
  return { box: { w: fb.w, h: fb.h }, placed };
}

/** One part drawn alone at real size, in one of its states: what Focus shows. */
export function PartAtSize({ frame, card }: { frame: StudioNode; card: Pick<Card, "key"> }) {
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const siteName = useStudio((s) => s.brief.name);
  const source = (look as { styleSource?: Source } | undefined)?.styleSource;
  const page = React.useMemo(() => nodes.filter((n) => n.pageId === frame.pageId), [nodes, frame.pageId]);
  const leads = React.useMemo(() => leadsOf(page), [page]);
  const t = React.useMemo(() => themeFrom(format, look, siteName), [format, look, siteName]);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const d = React.useMemo(() => stateDrawing(nodes, frame, card, source), [nodes, frame, card.key, source]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="rounded-sm outline outline-1 outline-white/20" style={{ width: d.box.w, height: d.box.h }} data-part-at-size={frame.id}>
      <PartCopy of={frame.id} box={d.box} placed={d.placed} leads={leads} t={t} palette={palette} light={look?.light} look={look} still />
    </div>
  );
}

export function PartFocus() {
  const id = useFocusFor();
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const siteName = useStudio((s) => s.brief.name);
  const on = useStudio((s) => s.statesOn ?? []);
  const source = (look as { styleSource?: Source } | undefined)?.styleSource;
  const frame = id ? nodes.find((n) => n.id === id) ?? null : null;
  const row = React.useMemo(() => (frame ? pageStates(nodes, frame.pageId, source).rows.find((r) => r.frame.id === frame.id) ?? null : null), [nodes, frame, source]);
  const page = React.useMemo(() => (frame ? nodes.filter((n) => n.pageId === frame.pageId) : []), [nodes, frame]);
  const leads = React.useMemo(() => leadsOf(page), [page]);
  const t = React.useMemo(() => themeFrom(format, look, siteName), [format, look, siteName]);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  React.useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); openPartFocus(null); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [id]);
  if (!id || !frame) return null;
  const cards: Card[] = row?.steps ?? [{ key: null, label: "as the page opens", hook: null, parts: [] }];
  const picked = on.map((k) => /^step:(.+?)=(.+)$/.exec(k)).find((m) => m?.[1] === frame.id)?.[2] ?? null;
  const name = frame.hooks?.["data-hook"] ?? frame.label;
  return (
    <div data-part-focus={frame.id} role="dialog" aria-modal="true" aria-label={`${name}: every state, at real size`} className="fixed inset-0 z-[80] flex flex-col bg-black/70 backdrop-blur-sm" onPointerDown={(e) => { if (e.target === e.currentTarget) openPartFocus(null); }}>
      <div className="flex items-center gap-3 border-b border-border bg-panel px-4 py-2">
        <p className="text-plain font-medium text-fg">{name}</p>
        <p className="min-w-0 flex-1 truncate text-small text-fg-muted">{cards.length} {cards.length === 1 ? "state" : "states"}, each at real size. Press one to show it on the board.</p>
        <button type="button" aria-label="Close the focus" data-part-focus-close="" onClick={() => openPartFocus(null)} className="tactile flex size-7 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg"><X className="size-4" /></button>
      </div>
      <div className="flex min-h-0 flex-1 items-start gap-6 overflow-auto p-6" data-part-focus-states="">
        {cards.map((c, i) => {
          const d = stateDrawing(nodes, frame, c, source);
          const lit = (c.key ?? "open") === (picked ?? "open");
          return (
            <figure key={c.key ?? "open"} data-focus-state={c.key ?? "open"} className="flex shrink-0 flex-col gap-2">
              <button type="button" onClick={() => { play("tap"); showStep(frame.id, c.key); }} className={cn("tactile flex items-center gap-2 self-start rounded-md border px-2 py-1 text-plain", lit ? "border-accent bg-accent-soft text-fg" : "border-border bg-panel text-fg-muted hover:text-fg")}>
                <span className="num flex size-5 items-center justify-center rounded-full bg-hover text-fine font-semibold">{i + 1}</span>
                <span>{c.label}</span>
                <span className="num text-fine text-fg-faint">{d.box.w} × {d.box.h}</span>
              </button>
              <div className="rounded-sm outline outline-1 outline-white/20" style={{ width: d.box.w, height: d.box.h }}>
                <PartCopy of={frame.id} box={d.box} placed={d.placed} leads={leads} t={t} palette={palette} light={look?.light} look={look} still />
              </div>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
