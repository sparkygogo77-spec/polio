"use client";
/**
 * THE BACKGROUND'S LAYERS, IN THE LOOK PANEL'S PREVIEW.
 *
 * J (2026-10-21): hide lives here, as a layer list, not as an eye in
 * Elements. With a section picked, its background's layers; with the page
 * picked, or nothing, the page's own (`layers.ts` reads both). The top layer
 * first, as a stack is read: each with a swatch, a plain name and its eye.
 * The eye shuts a layer (`hidden`: the board and the published page stop
 * drawing it); a film the stretch guard holds back shows shut and says why,
 * and opening its eye draws it anyway. A layer drags above or below another
 * (`stackNode`, one undo step); the section's fill stays at the foot.
 * Hovering a row outlines its part on the board, as the Colours preview's
 * rows do. `tests/layer-list.mjs`.
 */
import * as React from "react";
import { Eye, EyeOff, Film, GripVertical, Image as ImageIcon } from "lucide-react";
import { useHeldStudio, useStudio } from "../board/store";
import { BACKGROUND_ID } from "../board/store/model";
import { pointAt } from "../SiteColours";
import { layersOf, type Layer, type LayerPart } from "./layers";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";

export function LayerList() {
  const nodes = useHeldStudio((s) => s.nodes);
  const selection = useHeldStudio((s) => s.selection);
  const pageId = useHeldStudio((s) => s.activePageId);
  const picked = selection.length === 1 && selection[0] !== BACKGROUND_ID ? selection[0]! : null;
  const { layers, title } = React.useMemo(() => {
    const parts = nodes as unknown as LayerPart[];
    if (picked) {
      const own = layersOf(parts, picked);
      /* A part with nothing laid behind it has no stack to show: its fill is its Colour. */
      if (own.length > 1) return { layers: own, title: "This section" };
      return { layers: [] as Layer[], title: "" };
    }
    return { layers: layersOf(parts, null, pageId), title: "The page" };
  }, [nodes, picked, pageId]);
  const [drag, setDrag] = React.useState<string | null>(null);
  if (!layers.length) return null;

  const eye = (l: Layer) => {
    /* Shut: hidden. Opened: a film the guard held is opened on purpose (false); anything else simply loses the flag. */
    const film = !!l.film;
    useStudio.getState().patchNodes([l.id], () => ({ hidden: l.on ? true : film ? false : undefined }));
    play(l.on ? "close" : "open");
  };
  const drop = (onto: Layer, above: boolean) => {
    if (!drag || drag === onto.id) return;
    useStudio.getState().stackNode(drag, onto.id, above);
    play("confirm");
    setDrag(null);
  };
  const top = [...layers].reverse();

  return (
    <div data-layer-list="" className="space-y-1" onPointerLeave={() => pointAt(null)}>
      <div className="flex items-baseline justify-between">
        <span className="text-small font-semibold text-fg">Layers</span>
        <span data-layer-of="" className="truncate text-fine text-fg-muted">{title}</span>
      </div>
      <ul className="overflow-hidden rounded-md border border-border">
        {top.map((l) => (
          <li
            key={l.id}
            data-layer={l.id}
            data-on={l.on ? "" : undefined}
            draggable={!l.fixed}
            onDragStart={(e) => { if (l.fixed) return; setDrag(l.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", l.id); }}
            onDragEnd={() => setDrag(null)}
            onDragOver={(e) => { if (drag && !l.fixed) e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              /* The list reads top first: dropped on a row's upper half is above it in the stack. */
              drop(l, e.clientY < r.top + r.height / 2);
            }}
            onPointerEnter={() => pointAt([l.id])}
            title={l.why}
            className={cn("flex h-7 items-center gap-1.5 border-b border-border px-1.5 text-small last:border-b-0", drag === l.id && "opacity-50", !l.on && "text-fg-muted")}
          >
            <GripVertical aria-hidden className={cn("size-3 shrink-0", l.fixed ? "invisible" : "cursor-grab text-fg-faint")} />
            <span data-layer-swatch="" aria-hidden className="grid size-4 shrink-0 place-items-center rounded-sm border border-border" style={l.swatch ? { background: l.swatch, backgroundSize: "cover" } : undefined}>
              {l.film ? <Film className="size-2.5" /> : !l.swatch ? <ImageIcon className="size-2.5" /> : null}
            </span>
            <span data-layer-name="" className="min-w-0 flex-1 truncate">{l.name}</span>
            {l.why ? <span className="shrink-0 text-fine text-fg-faint">{l.film ? "held" : ""}</span> : null}
            <button
              type="button"
              data-layer-eye=""
              aria-pressed={l.on}
              aria-label={`${l.on ? "Hide" : "Show"} ${l.name}`}
              onClick={() => eye(l)}
              className="grid size-5 shrink-0 place-items-center rounded-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              {l.on ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
