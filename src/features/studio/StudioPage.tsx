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
  Circle, Eraser, Eye, FileText, History, Link, Link2, Link2Off, PlayCircle, Frame, Hand, Layers, Monitor, MousePointer2, PanelLeft, Search,
  Palette as PaletteIcon, Pencil, Plus, Clapperboard, Redo2, Scan, Settings2, Smartphone, Sparkles, Square, Tablet, Undo2, ZoomIn, ZoomOut,
} from "lucide-react";
import { Bakers } from "./Bakers";
import { Canvas } from "./Canvas";
import { Workspace } from "./Workspace";
import { useBuilds } from "@/features/builds/store";
import { resolvePalette } from "./parts/theme";
import { PreviewWindow } from "./Preview";
import { UpdatesPanel } from "./Updates";
import { Palette } from "./Palette";
import { Inspector } from "./Inspector";
import { LookPanel } from "./LookPanel";
import { MotionPanel } from "./MotionPanel";
import { FormatPanel } from "./FormatPanel";
import { PagesPanel } from "./PagesPanel";
import { BriefDialog } from "./BriefDialog";
import { FRAME_WIDTHS, HUES, activePage, livePath, pageNodes, useStudio, useStudioHydration, type Tool } from "./store";
import { LiveStage } from "./live/LiveStage";
import { RadialMenu, useRadialOpen } from "./RadialMenu";
import { DrawQueue, ProcessCounter } from "./DrawQueue";
import { aimLight, endLightRig, rigPasses, startLightRig } from "./lightRig";
import { BACKGROUND_ID } from "./store";
import { Timeline } from "./Timeline";
import { TimelineDetail } from "./TimelineDetail";
import { LightPlacer } from "./LightPlacer";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Textarea } from "@/core/ui/textarea";
import { Tooltip } from "@/core/ui/tooltip";
import { Badge } from "@/core/ui/badge";
import { Segmented } from "@/core/ui/segmented";
import { Kbd } from "@/core/ui/kbd";
import { useActions } from "@/core/actions";

/**
 * How much of the window the bottom band keeps — the parts shelf under the
 * board, and "This iteration" under the timeline.
 *
 * Enough for the round buttons and a second row of them, and no more: the
 * board is the subject and the shelf is where you reach. It is a clamp rather
 * than a number because the rule is that the band is *always* there: on a
 * window dragged down to a letterbox it gives ground rather than going off
 * the bottom of the screen, and it never takes more than a third of what
 * there is.
 */
const BAND_H = "clamp(132px, 32vh, 248px)";

const TOOLS: { id: Tool; label: string; icon: typeof MousePointer2; shortcut: string }[] = [
  { id: "select", label: "Select & move", icon: MousePointer2, shortcut: "v" },
  { id: "pen", label: "Draw freehand", icon: Pencil, shortcut: "d" },
  { id: "frame", label: "Draw a region", icon: Frame, shortcut: "r" },
  { id: "arrow", label: "Connect two elements", icon: Link, shortcut: "a" },
  { id: "erase", label: "Erase", icon: Eraser, shortcut: "e" },
  { id: "pan", label: "Pan", icon: Hand, shortcut: "h" },
];

/**
 * Where you are, at the left of the bar: Builds, this site, its pages.
 *
 * It used to open on a Design / Preview / Book switch, which named three
 * screens of the editor and never said *which site* you had open — and
 * "Design" was a button for the screen you were already on. The bar reads as
 * a place now: out to Builds, the site's own mark and name, then its pages.
 * Design is not a button because it is the ground state; Preview and Finish
 * are on the right, and pressing either again brings you back to it.
 */
function SiteHead() {
  const router = useRouter();
  const brief = useStudio((s) => s.brief);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const projects = useBuilds((s) => s.projects);
  const activeId = useBuilds((s) => s.activeId);
  const project = projects.find((p) => p.id === activeId) ?? null;
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  // The favicon this site will ship: the wordmark's mark, which is its first
  // letter in its own accent — the same thing the brief promises.
  const name = brief.name.trim() || project?.name?.trim() || "This site";
  const initial = [...name][0]?.toUpperCase() ?? "S";
  return (
    <>
      <Tooltip content="Every site this browser is holding">
        <Button variant="ghost" size="xs" onClick={() => { play("navigate"); router.push("/builds"); }}>
          <Layers />
          Builds
        </Button>
      </Tooltip>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <span
        data-site-mark=""
        aria-hidden
        className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] text-[10px] font-bold leading-none"
        style={{ background: palette.accent, color: palette.bg }}
      >
        {initial}
      </span>
      <span data-site-build="" className="max-w-[170px] truncate text-[12px] font-semibold text-fg" title={name}>
        {name}
      </span>
    </>
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
    // One control, not a row of buttons with a stray plus after it: the pages
    // and the way to add one are the same thing, so they share an edge.
    <div data-page-strip="" className="flex min-w-0 shrink items-center rounded-md border border-border bg-elevated p-0.5">
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
      </div>
      <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
      <Tooltip content="Add page">
        <Button variant="ghost" size="iconXs" aria-label="Add page" onClick={() => useStudio.getState().addPage()}>
          <Plus />
        </Button>
      </Tooltip>
    </div>
  );
}

function Toolbar({ libraryOpen, onToggleLibrary }: { libraryOpen: boolean; onToggleLibrary: () => void }) {
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
      <div data-studio-bar="" className="flex shrink-0 items-center gap-2 border-b border-border bg-panel/60 px-2 py-1.5">
        <SiteHead />
        <span className="mx-1 h-4 w-px bg-border" />
        <PageChips />
        <span className="flex-1" />
        <Tooltip content="Open the site on its own address">
          <Button variant="ghost" size="iconXs" aria-label="Open live preview" onClick={() => { play("navigate"); router.push(livePath()); }}>
            <Eye />
          </Button>
        </Tooltip>
        <PreviewToggle />
        <ProcessCounter />
      </div>
    );
  }

  return (
    <div data-studio-bar="" className="flex shrink-0 items-center gap-1 border-b border-border bg-panel/60 px-2 py-1.5">
      <SiteHead />
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
      <Tooltip content="Page frame width, positions stay put, the frame shows what fits">
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
        The search for a tool, in the row of tools.
        
        It was in the window's chrome a floor above, which is where an app
        puts a search for its own pages — and this one searches the things on
        this bar. It sits where the hand already is, between the devices and
        the menu's own switch.
      */}
      <SearchTools />

      {/*
        The part menu's outer edge, set here rather than on the menu itself.
        A toggle that only exists while the thing it changes is open is a
        toggle you can never find again; and it lights up the moment a menu
        opens, so which setting it belongs to needs no explaining.
      */}
      <Tooltip content={shape === "square" ? "Part menu: square edge, switch to round" : "Part menu: round edge, switch to square"}>
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

      {/* The two ways out of Design, at the end of the bar and in that order:
          look at it, then finish it. */}
      <span className="mx-1 h-4 w-px bg-border" />
      <UpdatesToggle />
      <PreviewToggle />
      <ProcessCounter />
    </div>
  );
}

/** The command palette, from the bar it is about. */
function SearchTools() {
  const ctx = useActions();
  return (
    <Tooltip content="Search the tools, the parts and every command" shortcut="mod+k">
      <button
        type="button"
        data-tool-search=""
        onClick={() => ctx.togglePanel("commands")}
        className="tactile hidden h-6 w-44 shrink items-center gap-1.5 rounded-md border border-border bg-elevated px-1.5 text-[11px] text-fg-faint hover:border-border-strong hover:text-fg-muted lg:flex"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">Search tools…</span>
        <Kbd>mod+k</Kbd>
      </button>
    </Tooltip>
  );
}

/**
 * What has landed, from the bar.
 *
 * The one control the updates slide over needs. It is a slide over rather
 * than a page because knowing what changed is something you do while you are
 * working: Escape or a press outside and the board is where you left it.
 *
 * NOTE: this bar belongs to the sibling branch. This is the single addition
 * the panel requires — the button and its state — so the merge stays clean.
 */
function UpdatesToggle() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Tooltip content="What has landed, and what is new to use">
        <Button variant="ghost" size="xs" data-updates-toggle="" aria-pressed={open} onClick={() => setOpen(true)}>
          <History />
          Updates
        </Button>
      </Tooltip>
      <UpdatesPanel open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Look at the site rather than the board. Pressing it again comes back. */
function PreviewToggle() {
  const mode = useStudio((s) => s.mode);
  const on = mode === "preview";
  return (
    <Tooltip content={on ? "Back to the board" : "See the site as it will be"}>
      <Button
        variant={on ? "subtle" : "ghost"}
        size="xs"
        aria-pressed={on}
        data-preview-toggle=""
        onClick={() => { play("navigate"); useStudio.getState().setMode(on ? "design" : "preview"); }}
      >
        <PlayCircle />
        Preview
      </Button>
    </Tooltip>
  );
}

export function StudioPage() {
  useStudioHydration();
  const [briefOpen, setBriefOpen] = React.useState(false);
  const [libraryOpen, setLibraryOpen] = React.useState(true);
  const [leftPanel, setLeftPanel] = React.useState("look");
  const selection = useStudio((s) => s.selection);
  const mode = useStudio((s) => s.mode);
  const page = useStudio(activePage);
  const design = mode === "design";
  const book = mode === "book";

  /*
   * Picking something brings its own panel to the front, and letting go of it
   * hands the column back to Look — the tab you were on is remembered only
   * while there is something to be on it about.
   */
  const picked = selection.length > 0;
  React.useEffect(() => {
    // A part picks Element; the page picks Look. The background's own panel
    // is mostly a sign pointing at Look — its colour, its texture, its light
    // all live there — so selecting the page goes straight to the thing you
    // came for, with Element still a tab away.
    const page = selection.includes(BACKGROUND_ID);
    setLeftPanel(selection.length && !page ? "inspector" : "look");
  }, [selection]);
  const sideTab = picked ? leftPanel : leftPanel === "motion" ? "motion" : "look";

  React.useEffect(() => {
    // The setters beside the togglers are for anything that has to put the
    // Builder into a known state rather than flip it — the tour, which cannot
    // toggle its way to a screen it has not seen.
    const w = window as unknown as {
      __studioLightStart?: () => boolean;
      __studioLightTo?: (p: { x: number; y: number }) => void;
      __studioLightEnd?: (commit?: boolean) => void;
      __studioLightPasses?: () => number;
      __studioOpenBrief?: () => void;
      __studioToggleLibrary?: () => void;
      __studioSetBrief?: (v: boolean) => void;
      __studioSetLibrary?: (v: boolean) => void;
      __studioSetLeftPanel?: (id: string) => void;
    };
    w.__studioOpenBrief = () => setBriefOpen(true);
    w.__studioToggleLibrary = () => setLibraryOpen((v) => !v);
    w.__studioSetBrief = (v) => setBriefOpen(v);
    w.__studioSetLibrary = (v) => setLibraryOpen(v);
    w.__studioSetLeftPanel = (id) => setLeftPanel(id);
    /*
     * The lamp's drag, without a mouse.
     *
     * The sun is dragged off a wedge of the wheel, which is an SVG path inside
     * a menu that has to be opened on the page first — three gestures deep
     * before the one being measured begins. These drive the same three calls
     * the drag itself makes, so the profiler and `tests/board-speed.mjs` hold
     * the real path rather than an imitation of it.
     */
    w.__studioLightStart = () => { useStudio.getState().setPlacingLight(true); return startLightRig(); };
    w.__studioLightTo = (p) => aimLight(p);
    w.__studioLightEnd = (commit) => { endLightRig(commit ?? true); useStudio.getState().setPlacingLight(false); };
    w.__studioLightPasses = () => rigPasses();
    return () => {
      delete w.__studioOpenBrief;
      delete w.__studioToggleLibrary;
      delete w.__studioSetBrief;
      delete w.__studioSetLibrary;
      delete w.__studioSetLeftPanel;
      delete w.__studioLightStart;
      delete w.__studioLightTo;
      delete w.__studioLightEnd;
      delete w.__studioLightPasses;
    };
  }, []);

  return (
    // Fixed height, never min-height: the board must fit the viewport exactly so
    // the page behind it cannot scroll while you are drawing on it.
    <div className="flex h-[calc(100dvh-var(--topbar-h)-var(--statusbar-h))] min-w-0 flex-col overflow-hidden">
      {/* Pictures are baked into tiles from the document, not from a panel:
          a patch re-rolled on the wheel has to cook whether or not Look is
          open. Renders nothing. */}
      <Bakers />

      <Toolbar libraryOpen={libraryOpen} onToggleLibrary={() => setLibraryOpen((v) => !v)} />

      <div className="flex min-h-0 flex-1">
        {/* Colour and texture on the left; the parts library lives under the
            board now, so the board keeps the width. */}
        {/*
          One side carries everything.
          
          There were two: Look and Motion on the left, Element / Format /
          Pages on the right — and the right one was hidden below 1280px, so
          at half a monitor the panel you need when you pick something simply
          was not there, while the left one went on eating room the frame
          wanted. They are one column now, and what is in it answers what you
          have in your hand: pick something and its own tabs are there, at the
          front; pick nothing and it is Look and Motion, as before.
        */}
        {design && libraryOpen ? (
          <aside data-side-panel="" className="hidden w-[228px] shrink-0 flex-col border-r border-border bg-panel/50 md:flex">
            <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-1.5">
              <Segmented
                className="min-w-0 flex-1 [&>*]:flex-1"
                size="xs"
                value={sideTab}
                onChange={setLeftPanel}
                options={[
                  ...(picked
                    ? [
                        { value: "inspector", label: "Element", icon: <Sparkles /> },
                        { value: "format", label: "Format", icon: <Settings2 /> },
                        { value: "pages", label: "Pages", icon: <Layers /> },
                      ]
                    : []),
                  { value: "look", label: "Look", icon: <PaletteIcon /> },
                  { value: "motion", label: "Motion", icon: <Clapperboard /> },
                ]}
                aria-label="Side panel"
              />
              <button type="button" onClick={() => setLibraryOpen(false)} aria-label="Hide the side panel" className="tactile shrink-0 rounded-sm p-1 text-fg-muted hover:bg-hover hover:text-fg">
                <PanelLeft className="size-3.5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {sideTab === "inspector" ? <Inspector />
                : sideTab === "format" ? <FormatPanel />
                : sideTab === "pages" ? <PagesPanel />
                : sideTab === "motion" ? <MotionPanel />
                : <LookPanel />}
            </div>
          </aside>
        ) : null}

        {/*
          One scroller down the middle: the board, then the shelf.

          The board pane is the window's own height less a strip, so a piece of
          the shelf is always showing and the page is always whole, scrolling
          down carries you past the page into the parts, and scrolling back up
          brings the page back at exactly the size it was. Nothing here shrinks
          the board; that is the whole reason it is a scroll and not a split.
        */}
        <div
          data-studio-scroll=""
          // Neither screen scrolls as a column any more: both are a pane and a
          // band, and the band is always on screen.
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          {/*
            The timeline is the board's twin: it fills the window less a
            strip, and what is under it, the iteration you clicked, and the
            book, is reached by carrying on scrolling, exactly as the parts
            shelf is under the board.
          */}
          <div
            className={cn("relative w-full", design || book ? "min-h-0 flex-1" : "shrink-0")}
            style={design || book ? undefined : { height: "100%" }}
          >
            {/*
              One ground, for the whole app.

              The board mounted its own and the timeline mounted another, so
              pressing the green button swapped the weather as well as the
              contents — a different nebula every time, which made a button
              that means "show me the site" look like a button that means
              "go somewhere else". It is mounted once, here, behind all three
              views; each of them is transparent over it, and switching
              between them changes only what stands on it.
            */}
            <Workspace />
            {design ? (
              <Canvas />
            ) : book ? (
              <Timeline />
            ) : (
              <LiveStage device="desktop" pageId={page.id} onNavigatePage={(id) => useStudio.getState().setActivePage(id)} />
            )}
            <PreviewWindow />
          </div>
          {design ? (
            /*
              The shelf is a band, not a floor below the horizon.
              
              It used to sit under the board in one long scroll: to reach the
              parts you scrolled the workspace down past the page, and on a
              deep site that was a long way past. The frame is one screen now
              and the board never scrolls, so the shelf can simply be here —
              always in view, and always in the same place.
            */
            <div className="w-full shrink-0 border-t border-border" style={{ height: BAND_H }}>
              <Palette />
            </div>
          ) : book ? (
            <div className="w-full shrink-0 border-t border-border" style={{ height: BAND_H }}>
              <TimelineDetail />
            </div>
          ) : null}
        </div>

      </div>

      <DrawQueue />
      <RadialMenu />
      <LightPlacer />
      <BriefDialog open={briefOpen && !book} onOpenChange={setBriefOpen} />
    </div>
  );
}
