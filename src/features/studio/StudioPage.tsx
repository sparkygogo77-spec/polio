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
import { ChevronDown, Circle, CircleDashed, Clapperboard, Eraser, Eye, FileText, History, Layers, Link, Link2, Link2Off, Monitor, MousePointer2, Palette as PaletteIcon, PanelLeft, Pencil, PlayCircle, Plus, Redo2, Scan, Search, Settings2, Smartphone, Sparkles, Square, Tablet, Undo2, ZoomIn, ZoomOut } from "lucide-react";
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
import { Timeline } from "./Timeline";
import { TimelineDetail, TimelinePanel } from "./TimelineDetail";
import { mountNebula } from "./nebulaTile";
import { LightPlacer } from "./LightPlacer";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Textarea } from "@/core/ui/textarea";
import { Tooltip } from "@/core/ui/tooltip";
import { Badge } from "@/core/ui/badge";
import { Segmented } from "@/core/ui/segmented";
import { useActions } from "@/core/actions";
import { Dropdown } from "@/core/ui/dropdown-menu";
import { PROCESS } from "./threads";

/**
 * How much of the window the bottom band keeps — the parts shelf under the
 * board, and "This update" under the timeline.
 *
 * Enough for the round buttons and a second row of them, and no more: the
 * board is the subject and the shelf is where you reach. It is a clamp rather
 * than a number because the rule is that the band is *always* there: on a
 * window dragged down to a letterbox it gives ground rather than going off
 * the bottom of the screen, and it never takes more than a third of what
 * there is.
 */
const BAND_H = "clamp(132px, 32vh, 248px)";

/**
 * Four tools, in one control.
 *
 * Six buttons became four in a dropdown that wears whichever is in your hand.
 * Two left the bar and for different reasons:
 *
 *  · **Pan.** The cursor pans. A press on the bare ground outside the page
 *    drags the view, a press on a part moves the part, and a press on empty
 *    space *inside* the page still draws a marquee — the nebula is the ground
 *    you push, the page is the surface you select on. Alt-drag and the middle
 *    button still pan anywhere, as they always did.
 *  · **Draw a region.** Worth being exact about, because it was not what it
 *    looked like: it is not a selection tool and never was. It draws a
 *    rectangle *annotation*, a `frame` shape, sibling to a pen stroke and an
 *    arrow. So marquee-plus-shift-click does not replace it — they were never
 *    doing the same job. What it is, is a third way to draw on a board that
 *    already has two, and it costs a permanent slot in the bar to get it.
 *    It is off the bar; the shape kind stays, so every frame already drawn
 *    still renders and no board loses anything.
 *
 * Selecting several at once needs neither of them and needed no change:
 * dragging a box on empty page already worked, and so did shift-clicking.
 */
const TOOLS: { id: Tool; label: string; icon: typeof MousePointer2; shortcut: string }[] = [
  { id: "select", label: "Select & move", icon: MousePointer2, shortcut: "v" },
  { id: "pen", label: "Draw freehand", icon: Pencil, shortcut: "d" },
  { id: "erase", label: "Erase", icon: Eraser, shortcut: "e" },
  { id: "arrow", label: "Connect two elements", icon: Link, shortcut: "a" },
  // The fifth. A closed line drawn with it is a space — an area of the page
  // set aside before anything is in it (`space.ts`) — so the icon is a ring
  // that has not closed. It takes no ink hue: a space is not a drawn line
  // that stays on the page, it is a boundary that becomes a part.
  { id: "space", label: "Draw a space", icon: CircleDashed, shortcut: "s" },
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
      <span data-site-build="" className="hidden max-w-[170px] truncate text-[12px] font-semibold text-fg sm:inline" title={name}>
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

  /*
   * What gives way, and in what order.
   *
   * Narrow the window and the bar used to keep "Desktop", "Tablet" and
   * "Phone" spelled out in full while the controls on the right walked off
   * the edge — the least important thing in the bar surviving at the expense
   * of the most. Nothing is cut off now. Things give way in a stated order,
   * from the first to go to the last:
   *
   *   1. the search's own words    (below xl)  — it becomes a magnifier
   *   2. the ink hues              (below lg)  — only out while drawing
   *   3. the zoom readout          (below lg)  — the minus and plus stay
   *   4. Fit and Wires             (below lg)  — both have a key, f and w
   *   5. Updates entirely          (below lg)
   *   6. the search entirely       (below md)  — mod+k still opens it
   *   7. the menu's edge switch    (below md)
   *   8. the site's name           (below sm)  — its mark stays
   *
   * It used to be ten rungs. The top two were the tool's name and the words
   * on Updates and Preview, and those are gone from the bar at every width
   * now: the icons say them, the tooltips name them, and a control that never
   * carries text never has to give one up. The ladder got shorter by fixing
   * the thing rather than by managing it.
   *
   * `Builds` keeps its word, deliberately, and it is the one exception. It is
   * the only way out of the Builder and the only wayfinding in the bar; a
   * bare stack-of-layers glyph at the far left is a guess, not a label. The
   * site's name beside it is not a control at all, it is what you have open.
   *
   * What never goes, at any width: the tool in your hand, the three devices,
   * undo and redo, zoom's minus and plus, Preview, Finish, the panel toggle
   * and the pages. Those are the ones you cannot work without, so they are
   * the ones that survive to the narrowest window.
   *
   * `menu-pass.mjs` measures the bar's scroll width against its own width at
   * eight sizes from 640 up, because a ladder that is merely written down is
   * a comment, not a guarantee.
   */
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
      <ToolPicker tool={tool} setTool={setTool} />

      {tool === "pen" || tool === "arrow" ? (
        <div data-ink-hues="" className="hidden items-center gap-1 rounded-md border border-border bg-elevated px-1 py-0.5 lg:flex">
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
      <DeviceSwitch width={frameWidth} />

      {/*
        The search for a tool, in the row of tools.
        
        It was in the window's chrome a floor above, which is where an app
        puts a search for its own pages — and this one searches the things on
        this bar. It sits where the hand already is, between the devices and
        the menu's own switch.
      */}
      <span className="flex-1 xl:hidden" />
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
          className={cn("hidden md:inline-flex", menuOpen && "ring-1 ring-accent")}
          onClick={() => { play("tap"); useStudio.getState().setMenuShape(shape === "square" ? "round" : "square"); }}
        >
          {shape === "square" ? <Square /> : <Circle />}
        </Button>
      </Tooltip>

      <Tooltip content="Fit the frame in view" shortcut="f">
        <Button variant="ghost" size="iconXs" aria-label="Fit frame" className="hidden lg:inline-flex" onClick={() => useStudio.getState().requestFit()}>
          <Scan />
        </Button>
      </Tooltip>
      <Tooltip content={showWires ? "Hide the wires between parts" : "Show the wires between parts"} shortcut="w">
        <Button variant={showWires ? "subtle" : "ghost"} size="iconXs" aria-label="Toggle wires" aria-pressed={showWires} className="hidden lg:inline-flex" onClick={() => useStudio.getState().setShowWires(!showWires)}>
          {showWires ? <Link2 /> : <Link2Off />}
        </Button>
      </Tooltip>
      {/* Back is red, forward is green — the same pair as every process
          state in the app, because undo and redo are the same question:
          is this going back or going on. Only when there is something to
          undo: a disabled control that still wears a colour is a lie. */}
      <Tooltip content="Undo" shortcut="mod+z">
        <Button
          variant="ghost" size="iconXs" aria-label="Undo" disabled={!past}
          style={past ? { color: PROCESS.open } : undefined}
          onClick={() => useStudio.getState().undo()}
        >
          <Undo2 />
        </Button>
      </Tooltip>
      <Tooltip content="Redo" shortcut="mod+shift+z">
        <Button
          variant="ghost" size="iconXs" aria-label="Redo" disabled={!future}
          style={future ? { color: PROCESS.done } : undefined}
          onClick={() => useStudio.getState().redo()}
        >
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
          className="num hidden w-10 text-center text-[10px] text-fg-muted hover:text-fg lg:block"
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

/**
 * The tool in your hand, and the four to choose from.
 *
 * A row of six flat ghost buttons said "here are some icons" and made the
 * one that was actually in your hand the quietest thing in the bar — a
 * slightly darker background among five identical siblings. This wears the
 * tool instead: one lit button showing the current icon and its name, and
 * the rest a press away.
 *
 * It takes the app's own red rather than the process pair. Red because the
 * tool is the loudest thing about what a press will do; **not** `PROCESS.open`
 * because that red means a state — unfinished, abandoned — and a tool is not
 * a state. Two reds with two meanings is one too many.
 *
 * **No word on it.** The icon is the tool and the caret is the promise of
 * more; the names live in the menu it opens and in the tooltip. A control
 * that never carries text never has to give one up, so it drops out of the
 * give-way ladder below entirely rather than being its first rung — which is
 * the better kind of narrow-window fix, since it is also the right thing at
 * full width.
 */
function ToolPicker({ tool, setTool }: { tool: Tool; setTool: (t: Tool) => void }) {
  const cur = TOOLS.find((t) => t.id === tool) ?? TOOLS[0]!;
  const Icon = cur.icon;
  return (
    <Dropdown
      id="tools"
      align="start"
      entries={TOOLS.map((t) => ({
        id: t.id,
        label: t.label,
        icon: t.icon,
        shortcut: t.shortcut,
        checked: t.id === tool,
        onSelect: () => setTool(t.id),
      }))}
    >
      <button
        type="button"
        data-tool-picker=""
        aria-label={`Tool: ${cur.label}`}
        className="tactile inline-flex h-6 shrink-0 items-center gap-0.5 rounded-md border pl-1.5 pr-1 [&_svg]:size-3.5"
        style={{
          borderColor: "oklch(0.62 0.19 25)",
          background: "linear-gradient(oklch(0.4 0.13 25), oklch(0.29 0.1 25))",
          color: "oklch(1 0 0)",
          boxShadow: "0 1px 0 oklch(0.2 0.06 25), inset 0 1px 0 oklch(0.72 0.15 25 / 0.5)",
        }}
      >
        <Icon />
        <ChevronDown className="opacity-80" />
      </button>
    </Dropdown>
  );
}

/**
 * Desktop, tablet, phone — three icons, no words, one colour each.
 *
 * Both were on offer and the choice is icons plus colour, for a reason that
 * is about this bar rather than about taste: the words were the widest thing
 * between the tools and the search, and dropping them is what lets the search
 * fill its gap. But an outline glyph at 14px is a weak signal on its own —
 * a tablet and a phone are the same rectangle at different sizes — so with
 * the label gone the colour has to carry the distinction, and the two changes
 * are really one.
 *
 * The hues are 100° apart around the **accent's own** wheel rather than three
 * colours picked by eye, so they move with the accent when it is changed and
 * can never collapse into three shades of one colour. Only the chosen one is
 * lit; the others sit muted, or three colours all shouting says nothing.
 */
const DEVICES = [
  { key: "desktop", label: "Desktop", icon: Monitor, turn: 0 },
  { key: "tablet", label: "Tablet", icon: Tablet, turn: 100 },
  { key: "phone", label: "Phone", icon: Smartphone, turn: 200 },
] as const;

function DeviceSwitch({ width }: { width: number }) {
  return (
    <div
      data-device-switch=""
      role="radiogroup"
      aria-label="Frame width"
      className="flex items-center gap-0.5 rounded-md border border-border bg-elevated p-0.5"
    >
      {DEVICES.map((d) => {
        const w = FRAME_WIDTHS[d.key];
        const on = width === w;
        const hue = `oklch(0.74 0.17 calc(var(--accent-h) + ${d.turn}))`;
        const Icon = d.icon;
        return (
          <Tooltip key={d.key} content={`${d.label} · ${w}px, positions stay put and the frame shows what fits`}>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={d.label}
              data-device={d.key}
              onClick={() => { play("select"); useStudio.getState().setFrameWidth(w); }}
              className={cn(
                "tactile inline-flex size-6 items-center justify-center rounded-sm [&_svg]:size-3.5",
                on ? "bg-panel shadow-[0_1px_0_var(--border)]" : "opacity-70 hover:opacity-100",
              )}
              style={{ color: on ? hue : undefined }}
            >
              <Icon />
            </button>
          </Tooltip>
        );
      })}
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
        /* It takes the whole gap between the devices and the menu's switch
           rather than a fixed 176px with dead bar either side, and it is a
           lit well rather than the bar's own colour: a search that matches
           its surroundings reads as a label, not as somewhere to type. The
           shortcut chip is gone — it was the widest thing in a control whose
           job is to be typed into, and the tooltip still says it. */
        className="tactile mx-1 hidden h-6 w-7 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-md border border-accent/45 text-[11px] text-fg-muted hover:border-accent/70 hover:text-fg md:flex xl:w-auto xl:flex-1 xl:justify-start xl:px-2"
        style={{ background: "color-mix(in oklch, var(--accent) 14%, var(--elevated))" }}
      >
        <Search className="size-3.5 shrink-0 text-accent" />
        <span className="hidden min-w-0 flex-1 truncate text-left xl:inline">Search tools…</span>
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
        <Button variant="ghost" size="iconXs" data-updates-toggle="" aria-label="Updates" aria-pressed={open} className="hidden lg:inline-flex" onClick={() => setOpen(true)}>
          <History />
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
        size="iconXs"
        aria-pressed={on}
        aria-label="Preview"
        data-preview-toggle=""
        onClick={() => { play("navigate"); useStudio.getState().setMode(on ? "design" : "preview"); }}
      >
        <PlayCircle />
      </Button>
    </Tooltip>
  );
}

/**
 * The side panel's tabs: one set, in one order, always all five.
 *
 * They used to appear and disappear with the selection — Element, Format and
 * Pages only while something was held — which meant the strip you were
 * reaching for was a different strip depending on what you had just clicked.
 */
const SIDE_TABS = [
  { value: "inspector", label: "Element", icon: <Sparkles /> },
  { value: "format", label: "Format", icon: <Settings2 /> },
  { value: "pages", label: "Pages", icon: <Layers /> },
  { value: "look", label: "Look", icon: <PaletteIcon /> },
  { value: "motion", label: "Motion", icon: <Clapperboard /> },
] as const;

export function StudioPage() {
  useStudioHydration();
  const [briefOpen, setBriefOpen] = React.useState(false);
  const [libraryOpen, setLibraryOpen] = React.useState(true);
  const [leftPanel, setLeftPanel] = React.useState("look");
  const mode = useStudio((s) => s.mode);
  const page = useStudio(activePage);
  const design = mode === "design";
  const book = mode === "book";
  // The two nebula tiles every construct reads, painted once for the page.
  /*
   * J's own face on every construct, once.
   *
   * The dark pair by default — the boxes are cards with words on them and
   * the bright cut is about twice the luminance. `__studioFacePair` puts
   * the other one on without a reload, which is how the two were compared.
   */
  React.useEffect(() => { mountNebula(); }, []);

  /*
   * The tab you are on is the tab you stay on.
   *
   * It used to move under you twice over. The set of tabs changed with the
   * selection — Element, Format and Pages appeared when something was picked
   * and vanished when it was not — and an effect on `selection` wrote the
   * active tab on every change, so clicking the bare background to deselect
   * threw you off Motion and back to Look mid-adjustment. Five tabs, always
   * the same five, in the same order, and nothing but a press moves them.
   *
   * That does cost the one helpful jump: picking a part no longer brings
   * Element to the front. It cannot both never swap and swap when it judges
   * you would like it to, and being thrown off a panel you were working in is
   * the worse of the two. Element is one press away and says what is picked
   * the moment you are on it; with nothing picked it is the page's own
   * prompt, which is a real thing to be looking at rather than a sign saying
   * nothing is selected.
   */
  const sideTab = leftPanel;

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
      __studioNotePass?: (line: string, on?: string) => void;
      __studioQueue?: () => { id: string; status: string; step: string | null; threadId: string | null }[];
      __studioFacePair?: (pair: "dark" | "bright") => void;
    };
    w.__studioOpenBrief = () => setBriefOpen(true);
    w.__studioToggleLibrary = () => setLibraryOpen((v) => !v);
    w.__studioSetBrief = (v) => setBriefOpen(v);
    w.__studioSetLibrary = (v) => setLibraryOpen(v);
    w.__studioSetLeftPanel = (id) => setLeftPanel(id);
    // For the formation test: an update to a finished iteration, the way the
    // second pass makes one.
    w.__studioNotePass = (line: string, on?: string) => useStudio.getState().notePass(line, on);
    /*
     * The queue, for a test that watches one job go through.
     *
     * It is not written to storage — a queue is what is happening now, not
     * what happened — so there is no other way to see from outside which
     * step a job is on and which iteration it is making.
     */
    w.__studioQueue = () => useStudio.getState().queue.map((j) => ({ id: j.id, status: j.status, step: j.step ?? null, threadId: j.threadId ?? null }));
    // Swap J's two cuts of the face on a live board, for comparing them.
    w.__studioFacePair = (pair) => mountNebula(pair);
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
    <div data-studio-root className="flex h-[calc(100dvh-var(--topbar-h))] min-w-0 flex-col overflow-hidden">
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
        {/*
          …and it never leaves for the timeline. It used to: the aside was
          the board's, so opening the timeline took away the one place a
          person reads what went into a thing. In the timeline it carries
          the card you clicked instead of the board's tabs.
        */}
        {book && libraryOpen ? (
          <aside data-side-panel="" data-side-panel-timeline="" className="hidden w-[228px] shrink-0 flex-col border-r border-border bg-panel/50 md:flex">
            <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-2 text-[10px] uppercase tracking-[0.14em] text-fg-muted">
              This card
            </div>
            <div className="no-bars min-h-0 flex-1 overflow-y-auto">
              <TimelinePanel />
            </div>
          </aside>
        ) : null}
        {design && libraryOpen ? (
          <aside data-side-panel="" className="hidden w-[228px] shrink-0 flex-col border-r border-border bg-panel/50 md:flex">
            <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-1.5">
              <Segmented
                className="min-w-0 flex-1 [&>*]:flex-1"
                size="xs"
                value={sideTab}
                onChange={setLeftPanel}
                /* Only the tab you are on says its name.
                   Five words and five icons want 347px and the column is
                   215px, so something had to give and it is the four words
                   you are not reading. The one that is left is the one doing
                   work — it says where you are — and the other four keep
                   their word for a screen reader, so nothing is lost that
                   was being said. */
                options={SIDE_TABS.map((t) => ({
                  value: t.value,
                  icon: t.icon,
                  label: <span className={sideTab === t.value ? undefined : "sr-only"}>{t.label}</span>,
                }))}
                aria-label="Side panel"
              />
              {/* The panel used to carry its own hide button here, beside the
                  bar's. Two controls for one panel, and only one of them
                  could bring it back — so the one that could only hide it is
                  gone and the bar's toggle is the whole story. */}
            </div>
            <div className="no-bars min-h-0 flex-1 overflow-y-auto">
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
          /*
           * The middle column scrolls; the panels either side do not.
           *
           * It was a pane and a band with the band always on screen and
           * nothing scrolling at all. J wants the scroll: down past the
           * design box, out of its view, and on into the categories and the
           * prompt sections under the timeline. The panels are siblings of
           * this rather than children, so they hold still while it moves —
           * which is the other half of what he asked for and comes for free
           * from where the scroll lives, not from holding them in place.
           *
           * `no-bars` is what makes it invisible. Overlay scrollbars are what
           * this container's browser draws, so nothing showed here however
           * hard it was measured; on a machine set to keep bars in view there
           * was one down the website page and another down the design
           * background.
           */
          className="no-bars flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
        >
          {/*
            The timeline is the board's twin: it fills the window less a
            strip, and what is under it, the iteration you clicked, and the
            book, is reached by carrying on scrolling, exactly as the parts
            shelf is under the board.
          */}
          <div
            /* A whole screen, always: the scroll below carries you past it
               rather than shrinking it, which is the difference between a
               scroll and a split. */
            className="relative w-full shrink-0"
            style={{ height: "100%" }}
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
