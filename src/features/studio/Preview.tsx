"use client";
/**
 * The pinned preview: the live site, small. It is the same `LiveSite` the
 * full-size route renders, scaled down and fully clickable — tabs switch,
 * links move between pages — so you never have to leave the board to check.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, ExternalLink, Maximize2, Minimize2, Monitor, Smartphone } from "lucide-react";
import { livePath, useStudio } from "./store";
import { placeNodes, DEVICE_WIDTH, type Device } from "./live/layout";
import { LiveSite } from "./live/LiveSite";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";

const SIZES = { s: 220, m: 300, l: 400 } as const;

export function PreviewWindow() {
  const [size, setSize] = React.useState<keyof typeof SIZES>("m");
  const [device, setDevice] = React.useState<Device>("desktop");
  const [open, setOpen] = React.useState(true);
  const router = useRouter();

  const pages = useStudio((s) => s.pages);
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const frameWidth = useStudio((s) => s.frameWidth);
  const activeId = useStudio((s) => s.activePageId);

  // Follows the board's page, but links inside the preview can wander off it.
  const [pageId, setPageId] = React.useState(activeId);
  React.useEffect(() => setPageId(activeId), [activeId]);
  const page = pages.find((p) => p.id === pageId) ?? pages[0]!;
  const pageNodes = React.useMemo(() => nodes.filter((n) => n.pageId === page.id), [nodes, page.id]);

  const w = SIZES[size];
  const inner = w - 2;
  const boxW = device === "phone" ? Math.round(inner * 0.5) : inner;
  const width = device === "desktop" ? frameWidth : DEVICE_WIDTH.phone;
  const { height } = React.useMemo(() => placeNodes(pageNodes, device, frameWidth), [pageNodes, device, frameWidth]);
  const scale = boxW / width;

  return (
    <div className="absolute bottom-3 right-3 z-20 flex flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-panel" style={{ width: open ? w : 148 }}>
      <header className="flex h-7 shrink-0 items-center gap-1 border-b border-border px-1.5">
        <Eye className="size-3 text-accent" />
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-fg">{open ? `${page.name} · ${pageNodes.length}` : "Preview"}</span>
        {open ? (
          <>
            <Tooltip content="Open full size" shortcut="p">
              <Button variant="ghost" size="iconXs" aria-label="Open live preview" onClick={() => { play("navigate"); router.push(livePath(page.id)); }}>
                <ExternalLink />
              </Button>
            </Tooltip>
            <Tooltip content={device === "desktop" ? "Phone reflow" : "Desktop frame"}>
              <Button variant="ghost" size="iconXs" aria-label="Toggle device width" onClick={() => setDevice(device === "desktop" ? "phone" : "desktop")}>
                {device === "desktop" ? <Smartphone /> : <Monitor />}
              </Button>
            </Tooltip>
            <Tooltip content="Size">
              <button type="button" aria-label="Preview size" onClick={() => { play("select"); setSize(size === "s" ? "m" : size === "m" ? "l" : "s"); }} className="tactile rounded-sm px-1 text-[10px] uppercase text-fg-muted hover:bg-hover hover:text-fg">
                {size}
              </button>
            </Tooltip>
          </>
        ) : null}
        <Tooltip content={open ? "Collapse" : "Expand"}>
          <Button variant="ghost" size="iconXs" aria-label="Toggle preview" onClick={() => setOpen(!open)}>
            {open ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </Tooltip>
      </header>
      {open ? (
        <div className={cn("overflow-y-auto", size === "l" ? "max-h-[52vh]" : "max-h-[38vh]")} {...ctxProps("studio-live", page.id, { pageId: page.id, device })}>
          {pageNodes.length ? (
            <div style={{ width: boxW, height: Math.round(height * scale), margin: "0 auto", position: "relative", overflow: "hidden" }}>
              <div style={{ width, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
                <LiveSite pages={pages} nodes={nodes} pageId={page.id} device={device} frameWidth={frameWidth} format={format} onNavigatePage={setPageId} />
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center p-4 text-center text-[10px] text-fg-muted">Place something in the frame and it appears here.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
