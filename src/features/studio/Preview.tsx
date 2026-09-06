"use client";
/**
 * The companion: the same page as a phone or tablet, parked wherever you want.
 *
 * The board is the desktop view, so this window never shows desktop — its job
 * is to tell you what the narrow version of what you are building looks like,
 * at the same time, without taking the board away. Drag it by its bar so it is
 * never over the part you are working on, and tap a part inside it to select
 * that part on the board.
 */
import * as React from "react";
import { Eye, GripHorizontal, Maximize2, Minimize2, Smartphone, Tablet } from "lucide-react";
import { activePage, useStudio } from "./store";
import { DEVICE_WIDTH, placeNodes } from "./live/layout";
import { LiveSite } from "./live/LiveSite";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";

const SIZES = { s: 200, m: 260, l: 330 } as const;

export function PreviewWindow() {
  const [size, setSize] = React.useState<keyof typeof SIZES>("m");
  const [drag, setDrag] = React.useState<{ dx: number; dy: number } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  const pages = useStudio((s) => s.pages);
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const frameWidth = useStudio((s) => s.frameWidth);
  const activeId = useStudio((s) => s.activePageId);
  const page = useStudio(activePage);
  const { device, x, y, open } = useStudio((s) => s.companion);
  const set = useStudio((s) => s.setCompanion);

  const pageNodes = React.useMemo(() => nodes.filter((n) => n.pageId === activeId), [nodes, activeId]);
  const width = DEVICE_WIDTH[device];
  const { height } = React.useMemo(() => placeNodes(pageNodes, device, frameWidth), [pageNodes, device, frameWidth]);
  const boxW = SIZES[size];
  const scale = boxW / width;

  /* ------------------------------------------------------------- dragging */
  React.useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const parent = ref.current?.offsetParent as HTMLElement | null;
      if (!parent) return;
      const box = ref.current!.getBoundingClientRect();
      const p = parent.getBoundingClientRect();
      // Store the offset from whichever edges it is nearest, so it stays put on resize.
      const left = e.clientX - drag.dx - p.left;
      const top = e.clientY - drag.dy - p.top;
      set({
        x: Math.round(Math.max(-p.width + 60, Math.min(-8, left - p.width + box.width))),
        y: Math.round(Math.max(-p.height + 60, Math.min(-8, top - p.height + box.height))),
      });
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, set]);

  /* Tapping a part in the companion selects it on the board. */
  const onPick = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest?.("[data-live-node]") as HTMLElement | null;
    const id = el?.dataset.liveNode;
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    play("select");
    useStudio.getState().setSelection([id]);
  };

  return (
    <div
      ref={ref}
      className="absolute z-20 flex flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-panel"
      style={{ right: -x, bottom: -y, width: open ? boxW : 132 }}
    >
      <header
        className="flex h-7 shrink-0 cursor-grab items-center gap-1 border-b border-border px-1.5 active:cursor-grabbing"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          const box = ref.current!.getBoundingClientRect();
          setDrag({ dx: e.clientX - box.left, dy: e.clientY - box.top });
        }}
      >
        <GripHorizontal className="size-3 shrink-0 text-fg-faint" />
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-fg">
          {open ? `${device === "phone" ? "Phone" : "Tablet"} · ${page.name}` : "Phone"}
        </span>
        {open ? (
          <>
            <Tooltip content={device === "phone" ? "Show as a tablet" : "Show as a phone"}>
              <Button variant="ghost" size="iconXs" aria-label="Companion device" onClick={() => { play("select"); set({ device: device === "phone" ? "tablet" : "phone" }); }}>
                {device === "phone" ? <Tablet /> : <Smartphone />}
              </Button>
            </Tooltip>
            <Tooltip content="Size">
              <button type="button" aria-label="Companion size" onClick={() => { play("select"); setSize(size === "s" ? "m" : size === "m" ? "l" : "s"); }} className="tactile rounded-sm px-1 text-[10px] uppercase text-fg-muted hover:bg-hover hover:text-fg">
                {size}
              </button>
            </Tooltip>
          </>
        ) : (
          <Eye className="size-3 text-accent" />
        )}
        <Tooltip content={open ? "Collapse" : "Expand"}>
          <Button variant="ghost" size="iconXs" aria-label="Toggle companion" onClick={() => set({ open: !open })}>
            {open ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </Tooltip>
      </header>

      {open ? (
        <div className={cn("overflow-y-auto", size === "l" ? "max-h-[54vh]" : "max-h-[40vh]")} onClickCapture={onPick}>
          {pageNodes.length ? (
            <div style={{ width: boxW, height: Math.round(height * scale), position: "relative", overflow: "hidden" }}>
              <div style={{ width, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
                <LiveSite pages={pages} nodes={nodes} pageId={activeId} device={device} frameWidth={frameWidth} format={format} />
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-[10px] text-fg-muted">The narrow version of this page appears here.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
