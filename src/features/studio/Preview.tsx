"use client";
/**
 * The pinned preview.
 *
 * Desktop: the page frame, scaled down — exactly what is on the board, because
 * the board is the page. Phone: the compiler's reflow, rows stacked at phone
 * width, so you can see how the arrangement collapses.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { Eye, Maximize2, Minimize2, Monitor, Smartphone } from "lucide-react";
import { Block, themeFrom } from "./blocks";
import { toRows } from "./spec";
import { activePage, frameHeight, pageNodes, useStudio, FRAME_WIDTHS } from "./store";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";

export function SitePreview({ device, width }: { device: "desktop" | "phone"; width: number }) {
  const nodes = useStudio(useShallow(pageNodes));
  const format = useStudio((s) => s.format);
  const frameWidth = useStudio((s) => s.frameWidth);
  const t = React.useMemo(() => themeFrom(format), [format]);

  if (!nodes.length) {
    return (
      <div style={{ background: t.backdrop, backgroundSize: "16px 16px", color: t.muted }} className="flex h-40 items-center justify-center p-4 text-center text-[10px]">
        Place something in the frame and it appears here.
      </div>
    );
  }

  if (device === "desktop") {
    const fh = frameHeight(nodes);
    const scale = width / frameWidth;
    return (
      <div style={{ width, height: fh * scale, position: "relative", overflow: "hidden", background: t.backdrop, backgroundSize: "16px 16px" }}>
        <div style={{ width: frameWidth, height: fh, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}>
          {nodes.map((n) => (
            <div key={n.id} style={{ position: "absolute", left: n.x, top: n.y, width: n.w, height: n.h, overflow: "hidden" }}>
              <Block node={n} t={t} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Phone: reflow. Each row's parts stack, each at phone width, heights kept.
  const pw = FRAME_WIDTHS.phone;
  const rows = toRows(nodes);
  const gap = 12;
  const stacked: { node: typeof nodes[number]; y: number; h: number }[] = [];
  let y = gap;
  for (const row of rows) {
    for (const n of row) {
      const h = n.w > pw ? Math.round(n.h * Math.min(1, pw / n.w) * 1.15) : n.h;
      stacked.push({ node: n, y, h });
      y += h + gap;
    }
  }
  const scale = width / pw;
  return (
    <div style={{ width, height: (y + gap) * scale, position: "relative", overflow: "hidden", background: t.backdrop, backgroundSize: "16px 16px" }}>
      <div style={{ width: pw, height: y + gap, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}>
        {stacked.map(({ node, y: top, h }) => (
          <div key={node.id} style={{ position: "absolute", left: gap, top, width: pw - gap * 2, height: h, overflow: "hidden" }}>
            <Block node={node} t={t} />
          </div>
        ))}
      </div>
    </div>
  );
}

const SIZES = { s: 220, m: 300, l: 400 } as const;

export function PreviewWindow() {
  const [size, setSize] = React.useState<keyof typeof SIZES>("m");
  const [device, setDevice] = React.useState<"desktop" | "phone">("desktop");
  const [open, setOpen] = React.useState(true);
  const page = useStudio(activePage);
  const count = useStudio((s) => s.nodes.filter((n) => n.pageId === s.activePageId).length);
  const w = SIZES[size];
  const inner = w - 2;

  return (
    <div className="absolute bottom-3 right-3 z-20 flex flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-panel" style={{ width: open ? w : 148 }}>
      <header className="flex h-7 shrink-0 items-center gap-1 border-b border-border px-1.5">
        <Eye className="size-3 text-accent" />
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-fg">{open ? `${page.name} · ${count}` : "Preview"}</span>
        {open ? (
          <>
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
        <div className={cn("overflow-y-auto", size === "l" ? "max-h-[52vh]" : "max-h-[38vh]")}>
          <div style={{ width: device === "phone" ? Math.round(inner * 0.5) : inner, margin: "0 auto" }}>
            <SitePreview device={device} width={device === "phone" ? Math.round(inner * 0.5) : inner} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
