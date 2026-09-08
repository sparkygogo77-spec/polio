"use client";
/**
 * The Studio: arrange what the site should be, then say what it is.
 *
 * Left  — the feature library.
 * Middle— the canvas, with page tabs above and the master prompt below.
 * Right — whatever is selected, the site format options, or the page list.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import {
  ArrowUpRight, Circle, Eraser, Eye, FileText, Link2, Link2Off, Pencil as PencilIcon, PlayCircle, Frame, Hand, Layers, Monitor, MousePointer2, PanelLeft,
  Palette as PaletteIcon, Pencil, Plus, Clapperboard, Redo2, Scan, Send, Settings2, Smartphone, Sparkles, Square, Tablet, Undo2, ZoomIn, ZoomOut,
} from "lucide-react";
import { Canvas } from "./Canvas";
import { PreviewWindow } from "./Preview";
import { Palette } from "./Palette";
import { Inspector } from "./Inspector";
import { LookPanel } from "./LookPanel";
import { MotionPanel } from "./MotionPanel";
import { FormatPanel } from "./FormatPanel";
import { PagesPanel } from "./PagesPanel";
import { BriefDialog, useCompiledBrief } from "./BriefDialog";
import { FRAME_WIDTHS, HUES, activePage, livePath, pageNodes, useStudio, useStudioHydration, type Tool } from "./store";
import { LiveStage } from "./live/LiveStage";
import { RadialMenu, useRadialOpen } from "./RadialMenu";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Textarea } from "@/core/ui/textarea";
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

/** Design or Preview, in the same place on screen. */
function ModeSwitch() {
  const mode = useStudio((s) => s.mode);
  return (
    <Segmented
      size="xs"
      value={mode}
      onChange={(v) => useStudio.getState().setMode(v as "design")}
      options={[
        { value: "design", label: "Design", icon: <PencilIcon /> },
        { value: "preview", label: "Preview", icon: <PlayCircle /> },
      ]}
      aria-label="Design or preview"
    />
  );
}

/**
 * The way out of the Builder: one round button on the end of the toolbar.
 *
 * It was a text field stretched across a row of its own, then a large orb
 * floating over the board — which put it in front of the thing you were
 * working on, which is the one place a door should not be. It is a chip on
 * the end of the bar now, the same height as everything else on it, and the
 * row it used to need is board again.
 */
function FinishButton({ onOpenBrief }: { onOpenBrief: () => void }) {
  const spec = useCompiledBrief();
  return (
    <Tooltip content={`Finish — ${spec.stats.elements} placed · ${spec.stats.prompted} prompted`} shortcut="mod+enter">
      <button
        type="button"
        aria-label="Finish"
        data-finish=""
        onClick={() => { play("confirm"); onOpenBrief(); }}
        className="finish-orb ml-1 flex size-7 shrink-0 items-center justify-center rounded-full text-white"
      >
        <Send className="size-3.5 translate-x-[-1px] translate-y-[0.5px]" strokeWidth={2.2} />
      </button>
    </Tooltip>
  );
}

/**
 * The pages, on the toolbar rather than on a row of their own.
 *
 * One page is the normal case and four is a lot, so a full-width strip for
 * them was a band of empty chrome across the whole window. They scroll here
 * if they ever need to.
 */
function PageChips() {
  const pages = useStudio((s) => s.pages);
  const activeId = useStudio((s) => s.activePageId);
  const nodes = useStudio((s) => s.nodes);
  return (
    <div className="hide-scrollbar flex min-w-0 shrink items-center gap-0.5 overflow-x-auto">
      {pages.map((p) => {
        const count = nodes.filter((n) => n.pageId === p.id).length;
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            type="button"
            {...ctxProps("studio-page", p.id, p)}
            onClick={() => { play("navigate"); useStudio.getState().setActivePage(p.id); }}
            className={cn(
              "tactile flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px]",
              active ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
            )}
          >
            <FileText className={cn("size-3 shrink-0", active && "text-accent")} />
            <span className="max-w-[110px] truncate">{p.name}</span>
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

function Toolbar({ libraryOpen, onToggleLibrary, onOpenBrief }: { libraryOpen: boolean; onToggleLibrary: () => void; onOpenBrief: () => void }) {
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const zoom = useStudio((s) => s.zoom);
  const inkHue = useStudio((s) => s.inkHue);
  const frameWidth = useStudio((s) => s.frameWidth);
  const showWires = useStudio((s) => s.showWires);
  const past = useStudio((s) => s.past.length);
  const future = useStudio((s) => s.future.length);
  const shape = useStudio((s) => s.menuShape);
  const menuOpen = useRadialOpen();
  const router = useRouter();
  const mode = useStudio((s) => s.mode);

  // In Preview the board is the site, so the drawing tools have nothing to act on.
  if (mode === "preview") {
    return (
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-panel/60 px-2 py-1.5">
        <ModeSwitch />
        <span className="mx-1 h-4 w-px bg-border" />
        <PageChips />
        <span className="flex-1" />
        <Tooltip content="Open the site on its own address">
          <Button variant="ghost" size="iconXs" aria-label="Open live preview" onClick={() => { play("navigate"); router.push(livePath()); }}>
            <Eye />
          </Button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border bg-panel/60 px-2 py-1.5">
      <ModeSwitch />
      <span className="mx-1 h-4 w-px bg-border" />
      <PageChips />
      <span className="mx-1 h-4 w-px bg-border" />
      <Tooltip content={libraryOpen ? "Hide colour & texture" : "Show colour & texture"} shortcut="l">
        <Button variant={libraryOpen ? "subtle" : "ghost"} size="iconXs" aria-label="Toggle look" aria-pressed={libraryOpen} onClick={onToggleLibrary}>
          <PanelLeft />
        </Button>
      </Tooltip>
      <span className="mx-1 h-4 w-px bg-border" />
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

      <span className="mx-1 h-4 w-px bg-border" />
      <Tooltip content="Page frame width — positions stay put, the frame shows what fits">
        <div>
          <Segmented
            size="xs"
            value={String(frameWidth)}
            onChange={(v) => useStudio.getState().setFrameWidth(Number(v))}
            options={[
              { value: String(FRAME_WIDTHS.desktop), label: "Desktop", icon: <Monitor /> },
              { value: String(FRAME_WIDTHS.tablet), label: "Tablet", icon: <Tablet /> },
              { value: String(FRAME_WIDTHS.phone), label: "Phone", icon: <Smartphone /> },
            ]}
            aria-label="Frame width"
          />
        </div>
      </Tooltip>

      <span className="flex-1" />

      {/*
        The part menu's outer edge, set here rather than on the menu itself.
        A toggle that only exists while the thing it changes is open is a
        toggle you can never find again; and it lights up the moment a menu
        opens, so which setting it belongs to needs no explaining.
      */}
      <Tooltip content={shape === "square" ? "Part menu: square edge — switch to round" : "Part menu: round edge — switch to square"}>
        <Button
          variant={menuOpen ? "subtle" : "ghost"}
          size="iconXs"
          aria-label={shape === "square" ? "Round the part menu" : "Square off the part menu"}
          aria-pressed={shape === "round"}
          data-menu-shape={shape}
          className={cn(menuOpen && "ring-1 ring-accent")}
          onClick={() => { play("tap"); useStudio.getState().setMenuShape(shape === "square" ? "round" : "square"); }}
        >
          {shape === "square" ? <Square /> : <Circle />}
        </Button>
      </Tooltip>

      <Tooltip content="Fit the frame in view" shortcut="f">
        <Button variant="ghost" size="iconXs" aria-label="Fit frame" onClick={() => useStudio.getState().requestFit()}>
          <Scan />
        </Button>
      </Tooltip>
      <Tooltip content={showWires ? "Hide the wires between parts" : "Show the wires between parts"} shortcut="w">
        <Button variant={showWires ? "subtle" : "ghost"} size="iconXs" aria-label="Toggle wires" aria-pressed={showWires} onClick={() => useStudio.getState().setShowWires(!showWires)}>
          {showWires ? <Link2 /> : <Link2Off />}
        </Button>
      </Tooltip>
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
          onClick={() => useStudio.getState().requestFit()}
          className="num w-10 text-center text-[10px] text-fg-muted hover:text-fg"
        >
          {Math.round(zoom * 100)}%
        </button>
        <Button variant="ghost" size="iconXs" aria-label="Zoom in" onClick={() => useStudio.getState().setZoom(zoom * 1.1)}>
          <ZoomIn />
        </Button>
      </div>

      <FinishButton onOpenBrief={onOpenBrief} />
    </div>
  );
}

export function StudioPage() {
  useStudioHydration();
  const [briefOpen, setBriefOpen] = React.useState(false);
  const [libraryOpen, setLibraryOpen] = React.useState(true);
  const [panel, setPanel] = React.useState("inspector");
  const [leftPanel, setLeftPanel] = React.useState("look");
  const selection = useStudio((s) => s.selection);
  const mode = useStudio((s) => s.mode);
  const page = useStudio(activePage);
  const design = mode === "design";

  // Selecting something on the canvas should show it, not whatever tab you left open.
  React.useEffect(() => {
    if (selection.length) setPanel("inspector");
  }, [selection]);

  React.useEffect(() => {
    const w = window as unknown as { __studioOpenBrief?: () => void; __studioToggleLibrary?: () => void };
    w.__studioOpenBrief = () => setBriefOpen(true);
    w.__studioToggleLibrary = () => setLibraryOpen((v) => !v);
    return () => {
      delete w.__studioOpenBrief;
      delete w.__studioToggleLibrary;
    };
  }, []);

  return (
    // Fixed height, never min-height: the board must fit the viewport exactly so
    // the page behind it cannot scroll while you are drawing on it.
    <div className="flex h-[calc(100dvh-var(--topbar-h)-var(--statusbar-h))] min-w-0 flex-col overflow-hidden">
      <Toolbar libraryOpen={libraryOpen} onToggleLibrary={() => setLibraryOpen((v) => !v)} onOpenBrief={() => setBriefOpen(true)} />

      <div className="flex min-h-0 flex-1">
        {/* Colour and texture on the left; the parts library lives under the
            board now, so the board keeps the width. */}
        {design && libraryOpen ? (
          <aside className="hidden w-[228px] shrink-0 flex-col border-r border-border bg-panel/50 lg:flex">
            <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-1.5">
              <Segmented
                className="min-w-0 flex-1 [&>*]:flex-1"
                size="xs"
                value={leftPanel}
                onChange={setLeftPanel}
                options={[
                  { value: "look", label: "Look", icon: <PaletteIcon /> },
                  { value: "motion", label: "Motion", icon: <Clapperboard /> },
                ]}
                aria-label="Left panel"
              />
              <button type="button" onClick={() => setLibraryOpen(false)} aria-label="Hide look" className="tactile shrink-0 rounded-sm p-1 text-fg-muted hover:bg-hover hover:text-fg">
                <PanelLeft className="size-3.5" />
              </button>
            </div>
            {leftPanel === "look" ? <LookPanel /> : <MotionPanel />}
          </aside>
        ) : null}

        {/*
          One scroller down the middle: the board, then the shelf.

          The board pane is the window's own height less a strip, so a piece of
          the shelf is always showing and the page is always whole — scrolling
          down carries you past the page into the parts, and scrolling back up
          brings the page back at exactly the size it was. Nothing here shrinks
          the board; that is the whole reason it is a scroll and not a split.
        */}
        <div
          data-studio-scroll=""
          className={cn("flex min-h-0 min-w-0 flex-1 flex-col", design ? "overflow-y-auto overflow-x-hidden" : "overflow-hidden")}
        >
          <div
            className="relative w-full shrink-0"
            style={design ? { height: "calc(100% - 108px)" } : { height: "100%" }}
          >
            {design ? (
              <Canvas />
            ) : (
              <LiveStage device="desktop" pageId={page.id} onNavigatePage={(id) => useStudio.getState().setActivePage(id)} />
            )}
            <PreviewWindow />
          </div>
          {design ? (
            <div className="w-full shrink-0" style={{ height: "100%" }}>
              <Palette />
            </div>
          ) : null}
        </div>

        {design ? (
          <aside className="hidden w-[260px] shrink-0 flex-col border-l border-border bg-panel/50 xl:flex">
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
        ) : null}
      </div>

      <RadialMenu />
      <BriefDialog open={briefOpen} onOpenChange={setBriefOpen} />
    </div>
  );
}
