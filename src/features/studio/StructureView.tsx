"use client";
/**
 * THE STRUCTURE VIEW, AT THE TOP OF THE PANELS RAIL (J, 2026-10-08).
 *
 * The page's outline (`structure.ts`): its regions and what each holds, by
 * hook. Drag a row onto another in its region, or use its arrows, and the
 * part moves there once, for every state: its `order` goes into the style
 * layer by hook, and the board restacks the region so every scene shows it.
 * Drop it on another region (a site's `data-region`, kit rule 32) and it
 * moves there on the board, and the move is ticked for polio/NEXT.md: the
 * markup changes, so the next code chat makes it.
 */
import * as React from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Layers, Square } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { useHeldStudio, useStudio } from "./store";
import { findItem, moveToRegion, regionKey, regionList, reorder, restack, structureOf, type StructureItem, type StructureNode } from "./structure";
import { fixLoopOf, setFixLoop } from "./useFixLoop";
import { spotlight } from "./panelSpotlight";

/** Move one part within its region: `order` for every part of the region, and the board restacked. */
function moveInRegion(pageId: string, id: string, to: number) {
  const st = useStudio.getState();
  const nodes = st.nodes as unknown as StructureNode[];
  const items = structureOf(nodes, pageId);
  const got = findItem(items, id);
  if (!got) return;
  const region = got.parent ? got.parent.children : items;
  const order = reorder(region, region.findIndex((x) => x.id === id), to);
  if (!order.size) return;
  const moves = restack(nodes, region, got.parent?.axis ?? "down", order);
  play("tap");
  st.patchNodes([...new Set([...order.keys(), ...moves.keys()])], (n) => ({
    ...(order.has(n.id) ? { place: { ...(n.place ?? {}), order: order.get(n.id)! } } : {}),
    ...(moves.get(n.id) ?? {}),
  }));
}

/** Move one part into another region: the board shows it there, and the move is ticked for polio/NEXT.md. */
function moveIntoRegion(pageId: string, id: string, region: string) {
  const st = useStudio.getState();
  const nodes = st.nodes as unknown as StructureNode[];
  const hook = nodes.find((n) => n.id === id)?.hooks?.["data-hook"];
  const moves = moveToRegion(nodes, pageId, id, region);
  if (!hook || !moves.size) return;
  play("tap");
  st.patchNodes([...new Set([id, ...moves.keys()])], (n) => ({
    ...(n.id === id ? { place: { region } } : {}),
    ...(moves.get(n.id) ?? {}),
  }));
  const loop = fixLoopOf(useStudio.getState().look);
  const key = regionKey(hook, region);
  if (!loop.ticked.includes(key)) setFixLoop({ ...loop, ticked: [...loop.ticked, key] });
}

function Row({ it, at, of, depth, axis, pageId, dragging, setDragging, movable }: { movable: boolean; it: StructureItem; at: number; of: StructureItem[]; depth: number; axis: "down" | "across"; pageId: string; dragging: string | null; setDragging: (id: string | null) => void }) {
  const [shut, setShut] = React.useState(false);
  const stop = React.useRef<(() => void) | null>(null);
  const sameRegion = !!dragging && of.some((x) => x.id === dragging) && dragging !== it.id;
  const intoRegion = !!dragging && !!it.region && dragging !== it.id && !it.children.some((x) => x.id === dragging);
  const Back = axis === "down" ? "Up" : "Left", On = axis === "down" ? "Down" : "Right";
  return (
    <li data-structure-item={it.hook} data-structure-axis={it.children.length ? it.axis : undefined}>
      <div
        draggable={of.length > 1 || movable}
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", it.id); setDragging(it.id); }}
        onDragEnd={() => setDragging(null)}
        onDragOver={(e) => { if (sameRegion || intoRegion) e.preventDefault(); }}
        onDrop={(e) => {
          if (!dragging || !(sameRegion || intoRegion)) return;
          e.preventDefault();
          if (intoRegion) moveIntoRegion(pageId, dragging, it.region!); else moveInRegion(pageId, dragging, at);
          setDragging(null);
        }}
        onPointerEnter={() => { stop.current?.(); stop.current = spotlight(it.id); }}
        onPointerLeave={() => { stop.current?.(); stop.current = null; }}
        style={{ paddingLeft: 4 + depth * 10 }}
        className={cn("group flex h-6 items-center gap-1 rounded-md pr-1 text-small", sameRegion || intoRegion ? "outline outline-1 outline-accent/60" : "", dragging === it.id ? "opacity-50" : "text-fg-muted hover:bg-hover hover:text-fg", (of.length > 1 || movable) && "cursor-grab")}>
        {it.children.length ? (
          <button type="button" aria-label={shut ? "Open" : "Fold"} onClick={() => setShut((v) => !v)} className="tactile flex size-4 shrink-0 items-center justify-center text-fg-faint">
            {shut ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        ) : it.panel ? <Layers className="size-3 shrink-0 text-accent" /> : <Square className="size-3 shrink-0 text-fg-faint" />}
        <button type="button" onClick={() => { play("tap"); useStudio.getState().setSelection([it.id]); }} className="min-w-0 flex-1 truncate text-left" title={`${it.hook}${it.region ? ` (region ${it.region})` : ""}${it.children.length ? (it.axis === "across" ? ": columns side by side" : ": one under another") : ""}`}>{it.label}</button>
        {of.length > 1 ? (
          <span className="hidden shrink-0 items-center group-hover:flex group-focus-within:flex">
            <button type="button" data-structure-back="" aria-label={`Move ${it.label} ${Back.toLowerCase()}`} disabled={at === 0} onClick={() => moveInRegion(pageId, it.id, at - 1)} className="tactile flex size-5 items-center justify-center rounded text-fg-muted hover:text-fg disabled:opacity-30"><ArrowUp className={cn("size-3", axis === "across" && "-rotate-90")} /></button>
            <button type="button" data-structure-on="" aria-label={`Move ${it.label} ${On.toLowerCase()}`} disabled={at === of.length - 1} onClick={() => moveInRegion(pageId, it.id, at + 1)} className="tactile flex size-5 items-center justify-center rounded text-fg-muted hover:text-fg disabled:opacity-30"><ArrowDown className={cn("size-3", axis === "across" && "-rotate-90")} /></button>
          </span>
        ) : null}
      </div>
      {it.children.length && !shut ? (
        <ul>{it.children.map((c, i) => <Row key={c.id} it={c} at={i} of={it.children} depth={depth + 1} axis={it.axis} pageId={pageId} dragging={dragging} setDragging={setDragging} movable={movable && !!it.region} />)}</ul>
      ) : null}
    </li>
  );
}

export function StructureView({ pageId }: { pageId: string }) {
  const nodes = useHeldStudio((s) => s.nodes);
  const items = React.useMemo(() => structureOf(nodes as unknown as StructureNode[], pageId), [nodes, pageId]);
  const [open, setOpen] = React.useState(true);
  const [dragging, setDragging] = React.useState<string | null>(null);
  const regions = React.useMemo(() => regionList(items).length > 1, [items]);
  if (!items.length) return null;
  return (
    <section data-structure-view="" aria-label="Structure: the page's layout, the same in every state" className="mb-2 flex flex-col gap-0.5 border-b border-border pb-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="tactile flex items-center gap-1 px-2 text-left text-fine font-medium uppercase tracking-wide text-fg-faint">
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />} Structure
      </button>
      {open ? (
        <>
          <p className="px-2 text-fine text-fg-faint">{regions ? "Drag a part within its region, or onto another region. It moves in every state; a move to another region goes to the next code chat." : "Drag a part within its region. It moves in every state."}</p>
          <ul>{items.map((it, i) => <Row key={it.id} it={it} at={i} of={items} depth={0} axis="down" pageId={pageId} dragging={dragging} setDragging={setDragging} movable={regions} />)}</ul>
        </>
      ) : null}
    </section>
  );
}
