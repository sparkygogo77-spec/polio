"use client";
/**
 * A component's options as one set, in its part panel (`Inspector.tsx`).
 *
 * A button recognised from its stacked parts (`components.ts`) is shown as
 * one thing: what it is and how many layers it has; its colours by job
 * (fill, words, outline, shadow, lighting bar), each recoloured on whichever
 * part actually paints it, as one undo step; where it leads; what it does
 * under the hand and when pressed; how it moves. The layers are listed by
 * job, and pressing one opens that layer alone, for the person who wants to
 * edit a single piece.
 */
import * as React from "react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { useStudio, type StudioNode } from "./store";
import { colourOf, KIND_WORD, LAYER_WORD, recolour, type Component, type CompNode, type Slot } from "./components";
import { resolvePalette } from "./parts/theme";
import { ROLES } from "./look";

/* `says` names the swatches for a screen reader: never just "Words", which is the words box's own name. */
const SLOTS: { slot: Slot; label: string; says: string }[] = [
  { slot: "fill", label: "Fill", says: "the fill colour" },
  { slot: "words", label: "Words", says: "the text colour" },
  { slot: "outline", label: "Outline", says: "the outline colour" },
  { slot: "shadow", label: "Shadow", says: "the shadow colour" },
  { slot: "lighting", label: "Lighting bar", says: "the lighting bar colour" },
];

/** A captured state's change, in words: "moves -3, -3 and turns -2°; shadow 10px 10px". */
function stateWords(nodes: readonly StudioNode[], ids: readonly string[], key: "hover" | "active"): string {
  const parts: string[] = [];
  for (const id of ids) {
    const n = nodes.find((x) => x.id === id);
    for (const s of (n?.motion?.[key] ?? []) as { style?: Record<string, string> }[]) {
      const st = s.style ?? {};
      if (st.transform) parts.push(st.transform.replace(/translate(Y|X)?\(([^)]*)\)/, "moves $2").replace(/rotate\(([^)]*)\)/, "turns $1").replace(/scale\(([^)]*)\)/, "scales $1"));
      if (st["box-shadow"]) parts.push(`shadow ${st["box-shadow"].replace(/#[0-9a-f]+|rgba?\([^)]*\)/gi, "").trim()}`);
      if (st.background || st["background-color"]) parts.push("changes its fill");
      if (st.color) parts.push("changes its words' colour");
    }
  }
  return [...new Set(parts)].join("; ");
}

export function ComponentFields({ comp, nodes }: { comp: Component; nodes: StudioNode[] }) {
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const choices = React.useMemo(() => [...new Set(ROLES.map((r) => palette[r]).filter(Boolean))], [palette]);
  const set = (slot: Slot, colour: string) => {
    const patches = recolour(nodes as unknown as CompNode[], comp, slot, colour);
    const ids = Object.keys(patches);
    if (!ids.length) return;
    play("select");
    useStudio.getState().patchNodes(ids, (n) => patches[n.id] as Partial<StudioNode>);
  };
  const open = (id: string) => { play("select"); useStudio.getState().setSelection([id]); useStudio.getState().want({ panel: "inspector", id }); };
  const p = comp.paints;
  const has: Record<Slot, boolean> = { fill: !!p.fill, words: p.words.length > 0, outline: !!p.outline, shadow: !!p.shadow, lighting: !!p.lighting && p.lighting !== comp.id };
  const hover = stateWords(nodes, p.hover, "hover");
  const press = stateWords(nodes, p.press, "active");
  const motions = p.motion.map((id) => {
    const n = nodes.find((x) => x.id === id);
    const names = [...((n?.motion?.animation ?? []) as { name: string }[]).map((a) => a.name), ...(n?.work ? [n.work.id] : [])];
    return names.join(", ");
  }).filter(Boolean);
  const linkPart = p.link ? nodes.find((x) => x.id === p.link) : null;
  return (
    <div data-component-fields={comp.kind} className="flex flex-col gap-2">
      <div className="text-small text-fg-muted">
        One {KIND_WORD[comp.kind].toLowerCase()}, {comp.layers.length} {comp.layers.length === 1 ? "layer" : "layers"}: picked, moved, resized and recoloured as one.
      </div>
      {SLOTS.filter((s) => has[s.slot]).map(({ slot, label, says }) => {
        const now = colourOf(nodes as unknown as CompNode[], comp, slot, palette);
        return (
          <div key={slot} data-component-slot={slot} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-small text-fg-muted">
              <span className="w-20 shrink-0">{label}</span>
              <span className="size-4 shrink-0 rounded-sm border border-border" style={{ background: now ?? "transparent" }} data-component-now={now ?? ""} />
              <span className="truncate text-fine text-fg-faint">on {p[slot as "fill"] === comp.id || (slot === "words" && p.words[0] === comp.id) ? "the part itself" : "its layer"}</span>
            </div>
            <div className="flex flex-wrap gap-1 pl-[88px]">
              {choices.map((c) => (
                <button key={c} type="button" data-component-colour={c} aria-label={`Set ${says} to ${c}`} onClick={() => set(slot, c)} className="tactile size-5 rounded-sm border border-border" style={{ background: c }} />
              ))}
              <input type="color" aria-label={`Set ${says} to any colour`} className="h-5 w-6 cursor-pointer" onChange={(e) => set(slot, e.target.value)} />
            </div>
          </div>
        );
      })}
      <div className="flex flex-col gap-0.5 text-small text-fg-muted">
        <span data-component-link="">{linkPart?.link ? `Leads to ${linkPart.link.kind === "page" ? "the page " : ""}${linkPart.link.target}` : "Leads nowhere yet (set it under Content)."}</span>
        <span data-component-hover="">{hover ? `Under the hand: ${hover}.` : "Does nothing under the hand."}</span>
        {press ? <span data-component-press="">When pressed: {press}.</span> : null}
        {motions.length ? <span data-component-motion="">Moves: {motions.join("; ")}.</span> : null}
      </div>
      <div className="flex flex-col gap-0.5" data-component-layers="">
        <span className="text-small font-medium text-fg">Its layers</span>
        {comp.layers.map((l) => {
          const n = nodes.find((x) => x.id === l.id);
          const say = typeof n?.content === "string" && n.content.trim() ? n.content.trim() : n?.label ?? l.id;
          return (
            <button key={l.id} type="button" data-component-layer={l.id} data-layer-role={l.role} onClick={() => open(l.id)} title="Open this layer alone" className={cn("tactile flex items-center gap-2 rounded-sm px-1 py-0.5 text-left text-small hover:bg-hover")}>
              <span className="w-24 shrink-0 text-fg-muted">{LAYER_WORD[l.role]}</span>
              <span className="min-w-0 truncate text-fg">{say.length > 40 ? `${say.slice(0, 38)}…` : say}</span>
            </button>
          );
        })}
        {comp.children.length ? <span className="text-fine text-fg-faint">Holds {comp.children.length} more {comp.children.length === 1 ? "component" : "components"}, each its own.</span> : null}
      </div>
    </div>
  );
}
