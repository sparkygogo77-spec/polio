"use client";
/**
 * The Studio: arrange what the site should be, then say what it is.
 *
 * Left  — the feature library.
 * Middle— the canvas, with page tabs above and the master prompt below.
 * Right — whatever is selected, the site format options, or the page list.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import {
  ArrowUpRight, Eraser, FileText, Frame, Hand, Layers, MousePointer2, Pencil, Plus, Redo2,
  Send, Settings2, Sparkles, Undo2, ZoomIn, ZoomOut,
} from "lucide-react";
import { Canvas } from "./Canvas";
import { Palette } from "./Palette";
import { Inspector } from "./Inspector";
import { FormatPanel } from "./FormatPanel";
import { PagesPanel } from "./PagesPanel";
import { BriefDialog, useCompiledBrief } from "./BriefDialog";
import { HUES, activePage, pageNodes, useStudio, type Tool } from "./store";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Textarea } from "@/core/ui/textarea";
import { Input } from "@/core/ui/input";
import { Tooltip } from "@/core/ui/tooltip";
import { Badge } from "@/core/ui/badge";
import { Segmented } from "@/core/ui/segmented";

const TOOLS: { id: Tool; label: string; icon: typeof MousePointer2; shortcut: string }[] = [
  { id: "select", label: "Select & move", icon: MousePointer2, shortcut: "v" },
  { id: "pen", label: "Draw freehand", icon: Pencil, shortcut: "d" },
  { id: "frame", label: "Draw a region", icon: Frame, shortcut: "r" },
  { id: "arrow", label: "Connect two elements", icon: ArrowUpRight, shortcut: "a" },
  { id: "erase", label: "Erase", icon: Eraser, shortcut: "e" },
  { id: "pan", label: "Pan", icon: Hand, shortcut: "h" },
];

function Toolbar() {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const zoom = useStudio((s) => s.zoom);
  const inkHue = useStudio((s) => s.inkHue);
  const past = useStudio((s) => s.past.length);
  const future = useStudio((s) => s.future.length);

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border bg-panel/60 px-2 py-1.5">
      <div className="flex items-center gap-0.5 rounded-md border border-border bg-elevated p-0.5">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <Tooltip key={t.id} content={t.label} shortcut={t.shortcut}>
              <Button
                variant={tool === t.id ? "subtle" : "ghost"}
                size="iconXs"
                aria-label={t.label}
                aria-pressed={tool === t.id}
                onClick={() => setTool(t.id)}
              >
                <Icon />
              </Button>
            </Tooltip>
          );
        })}
      </div>

      {tool === "pen" || tool === "frame" || tool === "arrow" ? (
        <div className="flex items-center gap-1 rounded-md border border-border bg-elevated px-1 py-0.5">
          {HUES.map((h) => (
            <button
              key={h}
              type="button"
              aria-label={`Ink hue ${h}`}
              onClick={() => useStudio.getState().setInk({ hue: h })}
              className={cn("tactile size-4 rounded-sm border", inkHue === h ? "border-fg" : "border-transparent")}
              style={{ background: `oklch(0.72 0.16 ${h})` }}
            />
          ))}
        </div>
      ) : null}

      <span className="flex-1" />

      <Tooltip content="Undo" shortcut="mod+z">
        <Button variant="ghost" size="iconXs" aria-label="Undo" disabled={!past} onClick={() => useStudio.getState().undo()}>
          <Undo2 />
        </Button>
      </Tooltip>
      <Tooltip content="Redo" shortcut="mod+shift+z">
        <Button variant="ghost" size="iconXs" aria-label="Redo" disabled={!future} onClick={() => useStudio.getState().redo()}>
          <Redo2 />
        </Button>
      </Tooltip>

      <div className="ml-1 flex items-center gap-0.5 rounded-md border border-border bg-elevated px-0.5">
        <Button variant="ghost" size="iconXs" aria-label="Zoom out" onClick={() => useStudio.getState().setZoom(zoom * 0.9)}>
          <ZoomOut />
        </Button>
        <button
          type="button"
          onClick={() => useStudio.getState().resetView()}
          className="num w-10 text-center text-[10px] text-fg-muted hover:text-fg"
        >
          {Math.round(zoom * 100)}%
        </button>
        <Button variant="ghost" size="iconXs" aria-label="Zoom in" onClick={() => useStudio.getState().setZoom(zoom * 1.1)}>
          <ZoomIn />
        </Button>
      </div>
    </div>
  );
}

function PageTabs() {
  const pages = useStudio((s) => s.pages);
  const activeId = useStudio((s) => s.activePageId);
  const nodes = useStudio((s) => s.nodes);
  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-2 py-1 hide-scrollbar">
      {pages.map((p) => {
        const count = nodes.filter((n) => n.pageId === p.id).length;
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            type="button"
            {...ctxProps("studio-page", p.id, p)}
            onClick={() => {
              play("navigate");
              useStudio.getState().setActivePage(p.id);
            }}
            className={cn(
              "tactile flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px]",
              active ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
            )}
          >
            <FileText className={cn("size-3", active && "text-accent")} />
            {p.name}
            {count ? <span className="num text-[9px] text-fg-faint">{count}</span> : null}
          </button>
        );
      })}
      <Tooltip content="Add page">
        <Button variant="ghost" size="iconXs" aria-label="Add page" onClick={() => useStudio.getState().addPage()}>
          <Plus />
        </Button>
      </Tooltip>
    </div>
  );
}

function PromptBar({ onOpenBrief }: { onOpenBrief: () => void }) {
  const brief = useStudio((s) => s.brief);
  const setBrief = useStudio((s) => s.setBrief);
  const spec = useCompiledBrief();
  const nodes = useStudio(useShallow(pageNodes));

  return (
    <div className="shrink-0 border-t border-border bg-panel/70 p-2" {...ctxProps("studio-brief", "brief", brief)}>
      <div className="mb-1.5 flex items-center gap-2">
        <Input
          className="w-48"
          placeholder="Site name"
          value={brief.name}
          onChange={(e) => setBrief({ name: e.target.value })}
          aria-label="Site name"
        />
        <Input
          className="min-w-0 flex-1"
          placeholder="The central gimmick — the one idea everything serves"
          value={brief.gimmick}
          onChange={(e) => setBrief({ gimmick: e.target.value })}
          aria-label="Central gimmick"
        />
        <Badge size="sm" variant={spec.stats.prompted ? "accent" : "warn"}>
          {spec.stats.elements} placed · {spec.stats.prompted} prompted
        </Badge>
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          className="min-h-[38px] flex-1"
          autoGrow
          rows={1}
          placeholder="Now say what you want it to be. Everything on the canvas is the context — this is the instruction."
          value={brief.master}
          onChange={(e) => setBrief({ master: e.target.value })}
          aria-label="Master prompt"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onOpenBrief();
            }
          }}
        />
        <Button variant="primary" size="lg" onClick={onOpenBrief} shortcut="mod+enter" disabled={!nodes.length && !brief.master.trim()}>
          <Send />
          Compile
        </Button>
      </div>
    </div>
  );
}

export function StudioPage() {
  const [briefOpen, setBriefOpen] = React.useState(false);
  const [panel, setPanel] = React.useState("inspector");
  const page = useStudio(activePage);
  const selection = useStudio((s) => s.selection);

  // Selecting something on the canvas should show it, not whatever tab you left open.
  React.useEffect(() => {
    if (selection.length) setPanel("inspector");
  }, [selection]);

  React.useEffect(() => {
    (window as unknown as { __studioOpenBrief?: () => void }).__studioOpenBrief = () => setBriefOpen(true);
    return () => {
      delete (window as unknown as { __studioOpenBrief?: () => void }).__studioOpenBrief;
    };
  }, []);

  return (
    <div className="flex h-full min-h-[calc(100dvh-var(--topbar-h)-var(--statusbar-h))] min-w-0">
      <aside className="hidden w-56 shrink-0 lg:block">
        <Palette />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar />
        <PageTabs />
        <div className="relative min-h-0 flex-1">
          <Canvas />
          <div className="pointer-events-none absolute left-2 top-2 rounded-md border border-border bg-panel/80 px-2 py-1 text-[10px] text-fg-muted backdrop-blur">
            {page.name} · <span className="font-mono">{page.path}</span>
          </div>
        </div>
        <PromptBar onOpenBrief={() => setBriefOpen(true)} />
      </div>

      <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-panel/50 xl:flex">
        <div className="shrink-0 border-b border-border p-1.5">
          <Segmented
            className="w-full [&>*]:flex-1"
            size="xs"
            value={panel}
            onChange={setPanel}
            options={[
              { value: "inspector", label: "Element", icon: <Sparkles /> },
              { value: "format", label: "Format", icon: <Settings2 /> },
              { value: "pages", label: "Pages", icon: <Layers /> },
            ]}
            aria-label="Panel"
          />
        </div>
        <div className="min-h-0 flex-1">
          {panel === "inspector" ? <Inspector /> : panel === "format" ? <FormatPanel /> : <PagesPanel />}
        </div>
      </aside>

      <BriefDialog open={briefOpen} onOpenChange={setBriefOpen} />
    </div>
  );
}
