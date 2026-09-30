"use client";
/**
 * The Studio: arrange what the site should be, then say what it is.
 *
 * Left  — the feature library.
 * Middle— the canvas, with page tabs above and the master prompt below.
 * Right — whatever is selected, the site format options, or the page list.
 */
import { FeatureOffers } from "./WorkShelf";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { ChevronDown, Circle, CircleDashed, Clapperboard, Ellipsis, Image as ImageIcon, Eraser, Eye, FileText, History, Layers, Link, Link2, Link2Off, Monitor, MousePointer2, Palette as PaletteIcon, PanelLeft, Pencil, PlayCircle, Plus, Redo2, Search, Settings2, Smartphone, Sparkles, Square, Tablet, TriangleDashed, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { Bakers } from "./Bakers";
import { Canvas } from "./Canvas";
import { ImportStrip } from "./FromASite";
import { BringRepoDoor } from "./RepoPicker";
import { CaptureSiteDoor } from "./CaptureSiteDialog";
import { NewSiteOffer } from "./NewSiteOffer";
import { placeBring, takeKeptBring } from "./bringRepo";
import { Workspace } from "./Workspace";
import { useBuilds } from "@/features/builds/store";
import { resolvePalette } from "./parts/theme";
import { usePicture } from "./pictures";
import { siteLogo } from "./siteMark";
import { ImportFlow } from "./ImportFlow";
import { PreviewWindow } from "./Preview";
import { UpdatesPanel } from "./Updates";
import { Palette, useShelfFolded, useShelfOpen, useShelfTall } from "./Palette";
import { Inspector } from "./Inspector";
import { LookPanel } from "./LookPanel";
import { RenderPanel } from "./RenderPanel";
import { MotionPanel } from "./MotionPanel";
import { FormatPanel } from "./FormatPanel";
import { PagesPanel } from "./PagesPanel";
import { BriefDialog } from "./BriefDialog";
import { exportSite } from "./exportSite";
import { DRAW_KINDS, FRAME_WIDTHS, HUES, activePage, livePath, pageNodes, useStudio, useStudioHydration, type Tool } from "./store";
import { LiveStage } from "./live/LiveStage";
import { RadialMenu, useRadialOpen } from "./RadialMenu";
import { DrawQueue, ProcessCounter } from "./DrawQueue";
import { aimLight, endLightRig, rigPasses, startLightRig } from "./lightRig";
import { Timeline } from "./Timeline";
import { TimelineDetail, TimelinePanel, useDetailTab } from "./TimelineDetail";
import { mountNebula } from "./nebulaTile";
import { LightPlacer } from "./LightPlacer";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import type { Device } from "./live/layout";
import { Textarea } from "@/core/ui/textarea";
import { Tooltip } from "@/core/ui/tooltip";
import { Popover } from "@/core/ui/popover";
import { ToolOptions } from "./toolOptions";
import { Badge } from "@/core/ui/badge";
import { Segmented } from "@/core/ui/segmented";
import { useActions } from "@/core/actions";
import { Dropdown } from "@/core/ui/dropdown-menu";
import { PROCESS } from "./threads";
import { publish, studioDoc } from "./agent";

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
/*
 * And the band when a category is open, which is a different job.
 *
 * Shut, the band is a row of planets to pick from and 248 is plenty. Open,
 * it is a list to read: 1745px of cards in a 209px strip, with a twelve-span
 * element drawn the whole shelf's width, so exactly one tile is on screen at
 * a time. The same shape as the backend's `WORK_H` and for the same reason —
 * a surface you work at rather than a strip you glance at.
 *
 * It takes the room from the site's *visible* height and none from the
 * site: the board is as tall as the page either way and the pane scrolls
 * over it, so nothing is lost, only moved behind the fold. The preview
 * window is a sibling of the pane rather than a child, so it does not move
 * when this changes — which is checked rather than assumed.
 */
/*
 * Now about a third of the canvas: an open category that took half of it
 * (54% of the window) left the page being built as the smaller thing on
 * screen. The canvas is the window less the bar; the grip and the wheel
 * stop at the same share (`SHELF_SHARE` in `Palette.tsx`).
 */
const SHELF_OPEN_H = "max(200px, calc((100vh - 88px) * 0.34))";
/** The shelf folded down to its strip (`Palette.tsx`, `useShelfFolded`). */
const SHELF_STRIP_H = "30px";
/** The band when the backend is up: room for a transcript worth reading. */
const WORK_H = "clamp(320px, 54vh, 640px)";

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
  /*
   * The fifth. A closed line drawn with it is a space — an area of the page
   * set aside before anything is in it (`space.ts`). It takes no ink hue: a
   * space is not a drawn line that stays on the page, it is a boundary that
   * becomes a part.
   *
   * HIS WORDS: "the circle button shouldnt just open a circle like 'draw'
   * does it should allow me to create the shape, make it a triangle with
   * dashes lines." The mark was a dashed RING, and a ring is a picture of
   * the thing it makes — so it read as a button that drops a circle rather
   * than one you draw a shape with. A dashed triangle is a shape nothing
   * here makes on its own, which is the point: the outline is the idea, and
   * what it ends up as is whatever his hand draws.
   */
  { id: "space", label: "Draw a space", icon: TriangleDashed, shortcut: "s" },
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
  // Its own logo when it has one (`siteMark.ts`), the letter when it has no
  // pictures or this browser no longer holds the bytes.
  const nodes = useStudio((s) => s.nodes);
  /* The icon the head names, when it names one: that is what the published site ships (`siteHead.ts`). */
  const headIcon = brief.head?.icons?.find((i) => i.rel === "icon" || i.rel === "shortcut icon")?.picture ?? brief.head?.icons?.[0]?.picture ?? null;
  const logo = React.useMemo(() => headIcon ?? siteLogo(nodes), [nodes, headIcon]);
  const { src: logoSrc } = usePicture(logo);
  return (
    <>
      <Tooltip content="Every site this browser is holding">
        <Button variant="ghost" size="xs" onClick={() => { play("navigate"); router.push("/builds"); }}>
          <Layers />
          Builds
        </Button>
      </Tooltip>
      <span className="mx-0.5 hidden h-4 w-px bg-border md:block" />
      <span
        data-site-mark=""
        aria-hidden
        /*
         * Out of the bar below md, and it is the one thing here that is not
         * a control. The ladder's own words: "The site's name beside it is
         * not a control at all, it is what you have open." Its mark is the
         * same sentence in one letter, and `Builds` is immediately left of
         * it doing the wayfinding.
         *
         * It costs 18 plus a separator and two gaps — about 24 — and the
         * first line was missing the three device keys by two pixels. This
         * is what makes the bar two lines rather than three, and it is worth
         * more than a decoration.
         */
        className="hidden size-[18px] shrink-0 items-center justify-center rounded-[5px] text-small font-bold leading-none md:flex"
        style={logo && logoSrc ? undefined : { background: palette.accent, color: palette.bg }}
      >
        {logo && logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt="" data-picture-id={logo.id} className="size-full rounded-[5px] object-contain" />
        ) : initial}
      </span>
      {/*
       * `pr-0.5`: sized to its words, the box ends where the last letter's
       * advance does, and a bold R's leg reaches a third of a pixel past it
       * in Arial and Helvetica — so the clip cut through the R with no
       * ellipsis to say so ("SOLCINERATO"). Two pixels hold the ink; a name
       * too long still ends in an ellipsis (tests/site-picture.mjs).
       */}
      <span data-site-build="" className="hidden max-w-[170px] truncate pr-0.5 text-large font-semibold text-fg sm:inline" title={name}>
        {name}
      </span>
    </>
  );
}

/**
 * The pages, on the toolbar as one control rather than a row of tabs.
 *
 * A tab per page cost the tools their room as the site grew. At a 1753px
 * window sink's nine tabs took 820px of the bar: "Search commands…" was cut
 * to nothing, the site's name to a sliver, and "Documentation 69" sat
 * scrolled out of sight. Each page added took another 60 to 120px. So the
 * bar carries the page you are on, with its part count, and the rest are a
 * press away; the room the control takes no longer grows with the pages.
 *
 * What a tab did, an entry still does: a press opens the page, a right-press
 * gives the page's own menu, and the count beside each name is the one the
 * board has (`tests/pages-dropdown.mjs`). Add page stays on the same edge.
 */
function PageChips() {
  const pages = useStudio((s) => s.pages);
  const activeId = useStudio((s) => s.activePageId);
  const nodes = useStudio((s) => s.nodes);
  const [open, setOpen] = React.useState(false);
  const count = (id: string) => nodes.filter((n) => n.pageId === id).length;
  const current = pages.find((p) => p.id === activeId) ?? pages[0];
  if (!current) return null;
  const here = count(current.id);
  return (
    // One control, not a row of buttons with a stray plus after it: the pages
    // and the way to add one are the same thing, so they share an edge.
    <div
      data-page-strip=""
      /*
       * Out of the bar below md, and this is the duplicate that pays for the
       * third row.
       *
       * Not a copy of the site chrome — the header holds News, sound, theme,
       * Keys, GitHub and Settings and the bar shares none of them, so there
       * was nothing to drop there. It is a copy of the PANEL: Pages is one
       * of the side panel's five tabs, and the panel's own toggle is two
       * controls along in this bar. So switching pages and adding one are
       * both reachable at 375 without it, through a control that is on
       * screen.
       */
      className="hidden shrink-0 items-center rounded-md border border-border bg-elevated p-0.5 md:flex">
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="start"
        className="w-auto min-w-[200px] max-w-[320px] p-1"
        content={
          <div data-page-menu="" className="flex flex-col gap-0.5">
            {pages.map((p) => {
              const n = count(p.id);
              const active = p.id === current.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  {...ctxProps("studio-page", p.id, p)}
                  aria-current={active ? "page" : undefined}
                  onClick={() => { play("navigate"); useStudio.getState().setActivePage(p.id); setOpen(false); }}
                  className={cn(
                    "tactile flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-plain",
                    active ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
                  )}
                >
                  <FileText className={cn("size-3 shrink-0", active && "text-accent")} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {n ? <span className="num shrink-0 pl-2 text-fine text-fg-faint">{n}</span> : null}
                </button>
              );
            })}
          </div>
        }
      >
        <button
          type="button"
          data-page-current=""
          {...ctxProps("studio-page", current.id, current)}
          aria-label={`Page: ${current.name}${here ? `, ${here} parts` : ""}. Choose another page`}
          className="tactile flex h-6 shrink-0 items-center gap-1 rounded-md bg-accent-soft px-1.5 text-plain text-fg"
        >
          <FileText className="size-3 shrink-0 text-accent" />
          <span className="max-w-[160px] truncate">{current.name}</span>
          {here ? <span className="num text-fine text-fg-faint">{here}</span> : null}
          <ChevronDown className={cn("size-3 shrink-0 text-fg-faint transition-transform", open && "rotate-180")} />
        </button>
      </Popover>
      <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
      <Tooltip content="Add page">
        <Button variant="ghost" size="iconXs" aria-label="Add page" onClick={() => { const id = useStudio.getState().addPage(); useStudio.getState().want({ panel: "pages", focus: "name", id }); }}>
          <Plus />
        </Button>
      </Tooltip>
    </div>
  );
}

/**
 * Is the window narrower than the panel column can share it with?
 *
 * Below 768 px the Builder used to hide its whole side panel and seven of
 * the bar's controls with nothing in their place (inventory A21). The
 * width is read here once, off the same breakpoint the classes use, so
 * what the panel becomes and what the bar folds away agree with the CSS.
 */
export const NARROW = "(max-width: 767px)";

/** Does the window match a media query? False until it is read, and read on the client only. */
export function useMedia(query: string): boolean {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const read = () => setOn(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, [query]);
  return on;
}

export const useNarrow = () => useMedia(NARROW);

/** Below the desktop breakpoint the bar folds Fit, Wires, the readout, Search and Updates away. */
export const FOLDING = "(max-width: 1023px)";

/**
 * The device the board's own Preview shows: the one the window is.
 *
 * It was hard-coded to desktop, so a phone-wide window showed a 1440 px
 * site in a 390 px pane. A window under 768 is a phone, under 1024 a
 * tablet, and the right-click menu's Device entries still change it after.
 */
export function useViewportDevice(): Device {
  const [device, setDevice] = React.useState<Device>("desktop");
  React.useEffect(() => {
    const phone = window.matchMedia(NARROW);
    const tablet = window.matchMedia("(max-width: 1023px)");
    const read = () => setDevice(phone.matches ? "phone" : tablet.matches ? "tablet" : "desktop");
    read();
    phone.addEventListener("change", read);
    tablet.addEventListener("change", read);
    return () => { phone.removeEventListener("change", read); tablet.removeEventListener("change", read); };
  }, []);
  return device;
}

function Toolbar({ libraryOpen, onToggleLibrary }: { libraryOpen: boolean; onToggleLibrary: () => void }) {
  // The More key exists only while the bar is folding controls away: on a
  // wide bar it is not drawn at all, because a hidden control is a control.
  const folding = useMedia(FOLDING);
  // The Updates panel is the bar's own, opened from its key or from More:
  // one panel, one state, whichever key was pressed.
  const [updatesOpen, setUpdatesOpen] = React.useState(false);
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
      <div data-studio-bar="" className="no-bars overflow-x-auto overflow-y-visible flex shrink-0 items-center gap-2 border-b border-border bg-panel/60 px-2 py-1.5">
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
   *   3. Wires                     (below lg)  — it has a key, w
   *   4. Updates entirely          (below lg)
   *   5. the search entirely       (below md)  — mod+k still opens it
   *   6. the menu's edge switch    (below md)
   *   7. the page chips            (below md)  — Pages is a panel tab, and
   *                                              the panel's toggle is in
   *                                              this bar at every width
   *   8. the site's name           (below sm)  — its mark stays
   *
   * Two things left this ladder rather than moving down it. The zoom
   * readout no longer gives way at any width: it is the one press that
   * returns either surface to the size that fits, and a way back has to be
   * on screen to be one. And "Fit in view" is gone from the bar entirely —
   * it and the readout did the same thing, so the readout does it, on the
   * board and on the timeline alike.
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
   * undo and redo, zoom's minus, its readout and its plus, Preview, Finish
   * and the panel toggle. Those are the ones you cannot work without, so
   * they are the ones that survive to the narrowest window.
   *
   * `menu-pass.mjs` measures the bar's scroll width against its own width at
   * eight sizes from 640 up, because a ladder that is merely written down is
   * a comment, not a guarantee.
   */
  return (
    <div
      data-studio-bar=""
      /*
       * It WRAPS below md, and the comment above needs that to stay true.
       *
       * "Nothing is cut off now" was written for a bar that fits, and at a
       * 375 window it does not: measured, the bar wants 542 in 375 and hangs
       * 167 off the right. What was off it was not the least important thing
       * — it was the zoom cluster's plus key, More tools, Preview and Finish.
       * A row that scrolls sideways is not an answer on a phone: nothing
       * says it scrolls, so the controls past the edge are gone as far as
       * anyone can tell.
       *
       * Two rows cost about 34px of the pane's height at that width and give
       * back every control the ladder below promises never goes. The ladder
       * is unchanged above md, where one row still fits.
       */
      className={cn(
        /* `gap-0.5` below md. Four pixels between controls is right when they
           are 24 across and there is room; at 44 across on a 375 window the
           second line was ending one to five pixels short of Finish, over
           and over, and six gaps at two pixels each is the twelve that
           settles it. The keys are 44 wide, so two of them are never
           confusable at two pixels apart. */
        "no-bars flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border bg-panel/60 px-2 py-1.5 md:flex-nowrap md:gap-1 md:overflow-x-auto md:overflow-y-visible",
        /* A real target below md. 24×24 is what these are at every width and
           it is half of what a finger needs; 44 is the size both platforms
           ask for. Above md the pointer is a mouse and the bar is one row, so
           nothing changes there. */
        "[&_button]:min-h-9 [&_button]:min-w-9 md:[&_button]:min-h-0 md:[&_button]:min-w-0",
      )}
    >
      <SiteHead />
      <span className="mx-1 h-4 w-px bg-border" />
      <PageChips />
      <span className="mx-1 h-4 w-px bg-border" />
      <Tooltip content={libraryOpen ? "Hide the side panel" : "Show the side panel"} shortcut="l">
        <Button variant={libraryOpen ? "subtle" : "ghost"} size="iconXs" aria-label="Toggle the side panel" aria-pressed={libraryOpen} onClick={onToggleLibrary}>
          <PanelLeft />
        </Button>
      </Tooltip>
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolPicker tool={tool} setTool={setTool} />
      {/* Draw a space, with its name on it: the one tool the owner could not find again once an import stopped opening it (`tests/space-command.mjs`). */}
      <button
        type="button"
        data-draw-space-button=""
        aria-pressed={tool === "space"}
        title="Draw a space (S): draw a closed shape on the page, and its panel opens on the right"
        onClick={() => setTool(tool === "space" ? "select" : "space")}
        className={cn("tactile ml-1 inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-1.5 text-small [&_svg]:size-3.5", tool === "space" ? "border-[oklch(0.62_0.19_25)] text-fg" : "border-border text-fg-muted hover:text-fg")}
      >
        <TriangleDashed />
        <span>Draw a space</span>
      </button>

      {/* The tool in hand, and its own settings: the pen's colour, the select tool's checkbox. See `toolOptions.tsx`. */}
      <ToolOptions tool={tool} />

      <span className="mx-1 h-4 w-px bg-border" />
      <DeviceSwitch width={frameWidth} />

      {/*
        The search for a tool, in the row of tools.

        It was in the window's chrome a floor above, which is where an app
        puts a search for its own pages — and this one searches the things on
        this bar. It sits where the hand already is, between the devices and
        the menu's own switch.
      */}
      {/*
        The spacer that pushes the search to the right — and, on a wrapping
        bar, the thing that made a third row.
        `flex-1` on a zero-width span takes every pixel left on its line, so
        everything after it breaks. Measured at 375: the bar was 109px in
        three rows, with Finish alone on the last one, while its content came
        to about 583 — a comfortable two rows of 371. It was not full; it was
        being pushed. Below md there is no room to push anything anyway, so
        the spacer only exists from md up, where the bar is one row again.
      */}
      <span className="hidden flex-1 md:block xl:hidden" />
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

      {/* The "fit in view" button used to stand here. It and the zoom
          readout two controls along did the same thing, so on his ruling
          the readout is the one that does it: "remove the button at the top
          to 'fit in view' when the zoom percentage number should be the
          button doing that for both since they do the same thing now." */}
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

      {/* `shrink-0` so the three are one thing. Cut in half is the worst of
          the three states: at 375 the minus was on screen and the plus was
          not, which is a control that can only make the page smaller. */}
      <div className="ml-1 flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-elevated px-0.5">
        <Button variant="ghost" size="iconXs" aria-label="Zoom out" onClick={() => useStudio.getState().setZoom(zoom * 0.9)}>
          <ZoomOut />
        </Button>
        <button
          type="button"
          aria-label="Fit in view"
          title="Fit in view"
          data-fit-readout=""
          onClick={() => useStudio.getState().requestFit()}
          /* Rung 3 of the ladder above said this goes below lg and the minus
             and plus stay. It stays at every width now, and the ladder says
             so: it is not only a readout, it is the one press that puts the
             page back where it fits, and a way back that is not on screen is
             not a way back. Forty pixels, and the row wraps to hold them.

             It is the only one now. The Fit button beside it is gone, and so
             is the timeline's own "centre" in the corner: the zoom it shows
             is the same number on both surfaces, so one press fits the board
             or settles the timeline, whichever is in front. */
          className="num block w-10 text-center text-small text-fg-muted hover:text-fg"
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
      {folding ? <MoreTools shape={shape} menuOpen={menuOpen} showWires={showWires} zoom={zoom} tool={tool} inkHue={inkHue} onUpdates={() => setUpdatesOpen(true)} /> : null}
      {/* THE WAY IN, and it lives in the bar because a row above the board
          would move the board — which is the one thing the Builder promises
          not to do, and it moved a drawn space out from under a suite that
          draws by coordinate. He made a fresh site, went looking for a way
          to pull a repository into it, searched the palette for "import"
          and for "site", and there was none: the Builds page's field only
          binds where Publish pushes, and the GitHub control draws nothing
          at all until a site already has a repository or a token. */}
      <BringRepoDoor />
      <CaptureSiteDoor />
      <UpdatesToggle open={updatesOpen} onOpenChange={setUpdatesOpen} />
      <PreviewToggle />
      <ProcessCounter />
    </div>
  );
}

/**
 * The bar's folded controls, on a narrow window.
 *
 * Fit, Wires, the menu's edge, the zoom readout, Search, Updates and the
 * ink hues fold away below the desktop breakpoints, and used to fold into
 * nothing: seven controls a phone could never reach. They are behind one
 * More key now, drawn only while the bar is folding them; on a wide bar
 * the key is not there, because they are.
 */
function MoreTools({ shape, menuOpen, showWires, zoom, tool, inkHue, onUpdates }: { shape: "square" | "round"; menuOpen: boolean; showWires: boolean; zoom: number; tool: string; inkHue: number; onUpdates: () => void }) {
  const [open, setOpen] = React.useState(false);
  const row = "flex items-center gap-1.5 text-plain text-fg";
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      content={
        <div data-toolbar-more-menu="" className="flex w-[220px] flex-col gap-1.5">
          <div className={row}>
            <span className="flex-1">Fit in view</span>
            <button type="button" aria-label="Fit in view" data-fit-readout="" className="num text-small text-fg-muted hover:text-fg" onClick={() => { useStudio.getState().requestFit(); setOpen(false); }}>{Math.round(zoom * 100)}%</button>
          </div>
          <div className={row}>
            <Button variant={showWires ? "subtle" : "ghost"} size="iconXs" aria-label="Toggle wires" aria-pressed={showWires} onClick={() => useStudio.getState().setShowWires(!showWires)}>{showWires ? <Link2 /> : <Link2Off />}</Button>
            <span className="flex-1">{showWires ? "Hide the wires" : "Show the wires"}</span>
          </div>
          <div className={row}>
            <Button
              variant={menuOpen ? "subtle" : "ghost"} size="iconXs"
              aria-label={shape === "square" ? "Round the part menu" : "Square off the part menu"} aria-pressed={shape === "round"}
              data-menu-shape={shape}
              onClick={() => { play("tap"); useStudio.getState().setMenuShape(shape === "square" ? "round" : "square"); }}
            >
              {shape === "square" ? <Square /> : <Circle />}
            </Button>
            <span className="flex-1">{shape === "square" ? "Part menu: square edge" : "Part menu: round edge"}</span>
          </div>
          <ToolOptions tool={tool as Tool} compact />
          <div className={row}>
            <SearchTools always />
            <Tooltip content="What has landed, and what is new to use">
              <Button variant="ghost" size="iconXs" data-updates-toggle="" aria-label="Updates" onClick={() => { setOpen(false); onUpdates(); }}>
                <History />
              </Button>
            </Tooltip>
          </div>
        </div>
      }
    >
      <Button variant={open ? "subtle" : "ghost"} size="iconXs" data-toolbar-more="" aria-label="More tools" aria-pressed={open}>

        <Ellipsis />
      </Button>
    </Popover>
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
function SearchTools({ always = false }: { always?: boolean } = {}) {
  const ctx = useActions();
  return (
    <Tooltip content="Search every command and setting" shortcut="mod+k">
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
        className={cn("tactile mx-1 h-6 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-md border border-accent/45 text-plain text-fg-muted hover:border-accent/70 hover:text-fg", always ? "flex w-auto flex-1 justify-start px-2" : "hidden w-7 md:flex xl:w-auto xl:flex-1 xl:justify-start xl:px-2")}
        style={{ background: "color-mix(in oklch, var(--accent) 14%, var(--elevated))" }}
      >
        <Search className="size-3.5 shrink-0 text-accent" />
        <span className={cn("min-w-0 flex-1 truncate text-left", always ? "inline" : "hidden xl:inline")}>Search commands…</span>
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
function UpdatesToggle({ open, onOpenChange: setOpen }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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
/*
 * A HUE EACH, because a strip of six identical marks is a strip of no marks.
 *
 * Measured on the deploy: all six read at chroma 0.016 or 0.008 on hue 288 —
 * the void the panels are built from — so the icon was doing no work and the
 * one visible label was carrying the whole strip. That is the same fault the
 * settings groups had, and it takes the same fix: the mark says which panel
 * this is.
 *
 * The hues are not invented where the app already has one. Motion is 170,
 * which is the Motion category's own hue in the parts catalogue; Pages sits
 * beside Navigation at 230. Element, Format, Look and Draw take the rest of
 * the wheel, none closer than 30 degrees to a neighbour — the spacing rule
 * the twelve categories were re-cut to obey, because below about 20 the
 * difference is not one a person can see.
 */
const SIDE_TABS = [
  { value: "inspector", label: "Element", icon: <Sparkles />, hue: 265 },
  { value: "format", label: "Format", icon: <Settings2 />, hue: 200 },
  { value: "pages", label: "Pages", icon: <Layers />, hue: 230 },
  { value: "look", label: "Look", icon: <PaletteIcon />, hue: 320 },
  { value: "motion", label: "Motion", icon: <Clapperboard />, hue: 170 },
  /* Replicate, in the product. His words: "provide a panel tab where i can use
     replicate models exactly as i do on their site" \u2014 so he never has to
     leave it to draw something. */
  /* HIS WORD: "change it from 'Draw' to Generate". Draw is what the pen does
     on the board; this tab asks a model for a picture, and the two being
     called the same thing is one name doing two jobs. */
  { value: "render", label: "Generate", icon: <ImageIcon />, hue: 60 },
] as const;

/*
 * One side, two shapes.
 *
 * Wide, the panel is the column it always was. Below 768 px it is a sheet
 * over the foot of the board, because a phone has no room for a column
 * and used to get nothing at all: no Element, no Look, no Pages. Same
 * element, same tabs, same hooks; only where it stands changes.
 */
const SHEET = "relative flex flex-col border-border bg-panel/95 fixed inset-x-0 bottom-0 z-40 max-h-[62dvh] border-t shadow-pop md:relative md:inset-auto md:z-auto md:max-h-none md:w-[228px] md:shrink-0 md:border-t-0 md:border-r md:bg-panel/50 md:shadow-none";

/*
 * THE PANEL'S WIDTH IS THE PERSON'S.
 *
 * It was 228px on every screen: on a 1992px monitor a column of squeezed
 * words beside a board with room to spare. Its edge drags now, from 228 to
 * about half the window, and the width is kept in this browser (it is how
 * this person likes their screen, not something about the site). The
 * content reflows: every panel in it is a flex column, and at a width with
 * room the tabs say all their names.
 */
export const SIDE_MIN = 228;
const SIDE_KEY = "builder.sidePanelWidth";
const sideMax = () => Math.max(SIDE_MIN, Math.round((typeof window === "undefined" ? 1440 : window.innerWidth) * 0.5));
const clampSide = (w: number) => Math.round(Math.min(sideMax(), Math.max(SIDE_MIN, w)));

function useSideWidth(): [number, (w: number) => void] {
  const [w, setW] = React.useState(SIDE_MIN);
  React.useEffect(() => {
    try {
      const kept = Number(localStorage.getItem(SIDE_KEY));
      if (Number.isFinite(kept) && kept > 0) setW(clampSide(kept));
    } catch { /* storage refused: the default stands */ }
    const fit = () => setW((was) => clampSide(was));
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const set = React.useCallback((next: number) => {
    const v = clampSide(next);
    setW(v);
    try { localStorage.setItem(SIDE_KEY, String(v)); } catch { /* kept for this visit only */ }
  }, []);
  return [w, set];
}

/** The panel's edge, to drag. Arrow keys move it too; a double press puts it back to the narrowest. */
function SideEdge({ width, onWidth }: { width: number; onWidth: (w: number) => void }) {
  const [dragging, setDragging] = React.useState(false);
  const start = React.useRef<{ x: number; w: number } | null>(null);
  const frame = React.useRef(0);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Side panel width"
      aria-valuenow={width}
      aria-valuemin={SIDE_MIN}
      aria-valuemax={sideMax()}
      tabIndex={0}
      data-side-edge=""
      title="Drag to widen the panel. Double press to put it back."
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, w: width };
        setDragging(true);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        /* One width per frame, however fast the hand moves: the board refits behind it. */
        const next = start.current.w + e.clientX - start.current.x;
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => onWidth(next));
      }}
      onPointerUp={(e) => {
        start.current = null;
        setDragging(false);
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* already let go */ }
      }}
      onDoubleClick={() => onWidth(SIDE_MIN)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          onWidth(width + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 64 : 16));
        }
      }}
      className={cn(
        "absolute inset-y-0 -right-1 z-20 hidden w-2 cursor-col-resize touch-none md:block",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:transition-colors hover:after:bg-accent focus-visible:after:bg-accent focus-visible:outline-none",
        dragging && "after:bg-accent",
      )}
    />
  );
}

/** The sheet's own way out, drawn only while it is a sheet. */
function SheetHandle({ narrow, onClose }: { narrow: boolean; onClose: () => void }) {
  if (!narrow) return null;
  return (
    <div className="flex h-7 shrink-0 items-center justify-between border-b border-border px-2">
      <span className="h-1 w-8 rounded-full bg-border" aria-hidden />
      <Button variant="ghost" size="xs" data-side-sheet-close="" aria-label="Close the side panel" onClick={onClose}>Close</Button>
    </div>
  );
}

export function StudioPage() {
  useStudioHydration();
  /* A repository named on another page's top bar waits for this board.
     Placed once the document has loaded, so the space lands in the site
     that is open rather than in a document about to be replaced. */
  React.useEffect(() => {
    const place = () => { const kept = takeKeptBring(); if (kept) placeBring(kept); };
    if (useStudio.persist.hasHydrated()) { place(); return; }
    return useStudio.persist.onFinishHydration(place);
  }, []);
  const [briefOpen, setBriefOpen] = React.useState(false);
  const [libraryOpen, setLibraryOpen] = React.useState(true);
  const narrow = useNarrow();
  const [sideWidth, setSideWidth] = useSideWidth();
  const sideStyle = narrow ? undefined : { width: sideWidth };
  /* Room for every tab's name, not only the open one's. */
  const tabWords = !narrow && sideWidth >= 420;
  const viewportDevice = useViewportDevice();
  // A sheet is asked for, never left lying over the board: on a narrow
  // window it starts closed and the toggle, the tour and a pick open it.
  React.useEffect(() => { if (narrow) setLibraryOpen(false); }, [narrow]);
  const [leftPanel, setLeftPanel] = React.useState("look");
  const mode = useStudio((s) => s.mode);
  const page = useStudio(activePage);
  const detailTab = useDetailTab();
  const shelfOpen = useShelfOpen();
  const shelfTall = useShelfTall();
  const shelfFolded = useShelfFolded();
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
   * A DOCUMENT PUT RIGHT ON OPEN SAYS SO.
   *
   * The sweep runs down in the store, before anything else writes, and
   * nothing there can publish. It leaves what it did behind and this says it
   * — because a board that quietly loses six parts between one visit and the
   * next is worse than one that never lost them. One undo takes the whole
   * sweep back, and the line is how he knows there is something to undo.
   */
  const news = useActions();
  const sweepNote = useStudio((s) => s.sweepNote);
  React.useEffect(() => {
    if (!sweepNote) return;
    news.publish({
      key: "studio:sweep",
      title: "This board was put right when it opened",
      body: sweepNote,
      level: "info", source: "studio", toast: { durationMs: 12000 },
    });
    useStudio.setState({ sweepNote: null });
  }, [sweepNote, news]);

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
  /* WHAT THE BOARD ASKS FOR. One press on a part asks for its Element
     panel (Canvas.tsx), two for its words, Add page for the page's name,
     a picture just laid for the Look panel. The tabs were icons nobody had
     found; the thing just done is what you want to see. */
  const wanted = useStudio((s) => s.wanted);
  React.useEffect(() => {
    if (!wanted) return;
    setLeftPanel(wanted.panel);
    setLibraryOpen(true);
    /* Answered, when nothing in the panel is waiting to take the caret. */
    if (!wanted.focus) useStudio.getState().want(null);
  }, [wanted]);

  /* A panel asking to be opened — the background's way of handing you to
     Looks, where its controls now live. */
  React.useEffect(() => {
    const go = (e: Event) => {
      const which = (e as CustomEvent<string>).detail;
      if (typeof which === "string") { setLeftPanel(which); setLibraryOpen(true); }
    };
    window.addEventListener("studio:panel", go);
    return () => window.removeEventListener("studio:panel", go);
  }, []);

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
      __studioUndoDepth?: () => number;
      __studioPublishDoc?: () => Record<string, unknown>;
      __studioQueue?: () => { id: string; status: string; step: string | null; threadId: string | null; nodeId: string | null; madeId: string | null; note: string | null; label: string }[];
      __studioFacePair?: (pair: "dark" | "bright") => void;
    };
    /*
     * Compile the blueprint has four doors (⌘⏎, the command, the canvas
     * menu, the brief menu) and all of them come through here. In the book
     * mode the dialog is not drawn — the book is a tab under the timeline —
     * so setting it open showed nothing until the mode changed, when it
     * popped up on its own. In that mode the door opens the tab instead.
     */
    w.__studioOpenBrief = () => {
      if (useStudio.getState().mode === "book") {
        setLibraryOpen(true);
        window.dispatchEvent(new CustomEvent("studio:book"));
        return;
      }
      setBriefOpen(true);
    };
    /* The site as HTML and CSS, for the checks and scripts/export-site.mjs:
       what Publish and Go live send (exportSite.ts). */
    (w as unknown as { __studioExport?: (only?: string[]) => Promise<unknown> }).__studioExport = (only) => exportSite(only);
    w.__studioToggleLibrary = () => setLibraryOpen((v) => !v);
    w.__studioSetBrief = (v) => setBriefOpen(v);
    w.__studioSetLibrary = (v) => setLibraryOpen(v);
    w.__studioSetLeftPanel = (id) => setLeftPanel(id);
    // For the formation test: an update to a finished iteration, the way the
    // second pass makes one.
    w.__studioNotePass = (line: string, on?: string) => useStudio.getState().notePass(line, on);
    // How deep the undo history is. It is never persisted, so a check that
    // read it out of storage read an empty list and could not see a scrub
    // writing a hundred entries. This is the only honest way to ask.
    w.__studioUndoDepth = () => useStudio.getState().past.length;
    // The document exactly as Publish sends it, for checks that say "what publish sends" and used to read storage instead.
    w.__studioPublishDoc = () => studioDoc();
    // The push itself, with files a check hands it, the way Go live sends them (tests/publish-big-picture.mjs: a picture bigger than one request).
    (w as unknown as { __studioPublish?: typeof publish }).__studioPublish = (input) => publish(input);
    // A document put on the board whole, the way an import does (tests/big-document.mjs: one past localStorage's quota).
    (w as unknown as { __studioLoadDoc?: (doc: Record<string, unknown>) => void }).__studioLoadDoc = (doc) => useStudio.getState().loadDoc(doc as Parameters<ReturnType<typeof useStudio.getState>["loadDoc"]>[0]);
    // A drawing put on the queue the way the draw board puts one (DrawBoard.tsx#makeReal), for a check that draws on a given part (tests/draw-on-section.mjs).
    (w as unknown as { __studioDraw?: (job: Parameters<ReturnType<typeof useStudio.getState>["enqueueDraw"]>[0]) => string }).__studioDraw = (job) => useStudio.getState().enqueueDraw(job);
    /*
     * The queue, for a test that watches one job go through.
     *
     * It is not written to storage — a queue is what is happening now, not
     * what happened — so there is no other way to see from outside which
     * step a job is on and which iteration it is making.
     */
    w.__studioQueue = () => useStudio.getState().queue.map((j) => ({
      id: j.id, status: j.status, step: j.step ?? null, threadId: j.threadId ?? null,
      // Which part it was drawn on and which it made: two drawings queued
      // together have to keep their own, and that is what a test has to see.
      nodeId: j.nodeId ?? null, madeId: j.madeId ?? null, note: j.note ?? null, label: j.label,
    }));
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
      delete w.__studioUndoDepth;
      delete w.__studioPublishDoc;
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
          <aside data-side-panel="" data-side-panel-timeline="" data-side-sheet={narrow ? "" : undefined} className={SHEET} style={sideStyle}>
            <SheetHandle narrow={narrow} onClose={() => setLibraryOpen(false)} />
            {narrow ? null : <SideEdge width={sideWidth} onWidth={setSideWidth} />}
            <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-2 text-small uppercase tracking-[0.14em] text-fg-muted">
              This card
            </div>
            <div className="no-bars min-h-0 flex-1 overflow-y-auto">
              <TimelinePanel />
            </div>
          </aside>
        ) : null}
        {design && libraryOpen ? (
          <aside data-side-panel="" data-side-sheet={narrow ? "" : undefined} className={SHEET} style={sideStyle}>
            <SheetHandle narrow={narrow} onClose={() => setLibraryOpen(false)} />
            {narrow ? null : <SideEdge width={sideWidth} onWidth={setSideWidth} />}
            <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-1.5">
              <Segmented
                className="min-w-0 flex-1 gap-0 [&>*]:min-w-0 [&>*]:flex-none [&>*]:justify-center [&>*]:px-1.5 [&>[data-state=on]]:flex-1"
                size="xs"
                value={sideTab}
                onChange={setLeftPanel}
                /* An icon on every tab, and the word on the one you are on.
                   73e2549 took the icons off so that six words would fit the
                   215px column, and six 9px words read as a row of small print
                   with nothing to find a panel by at a glance. HIS ASK: the
                   icons back, and the active tab says its word. The other five
                   keep theirs as a tooltip and as the name a screen reader
                   reads, so every tab is still named by its word; only the
                   four you are not reading stop printing it. */
                options={SIDE_TABS.map((t) => ({
                  value: t.value,
                  title: t.label,
                  /* The mark wears the panel's colour at both states.
                     Dimmed when you are not on it rather than drained to
                     grey: the hue is what says which panel this is, so it
                     never goes away, it only stands back. */
                  icon: (
                    <span className="contents" style={{ color: `oklch(0.82 0.15 ${t.hue})`, opacity: sideTab === t.value ? 1 : 0.72 }}>
                      {t.icon}
                    </span>
                  ),
                  label: (
                    <span data-tab-word="" className={sideTab === t.value || tabWords ? "whitespace-nowrap text-small" : "sr-only"}>
                      {t.label}
                    </span>
                  ),
                }))}
                aria-label="Side panel"
              />
              {/* The panel used to carry its own hide button here, beside the
                  bar's. Two controls for one panel, and only one of them
                  could bring it back — so the one that could only hide it is
                  gone and the bar's toggle is the whole story. */}
            </div>
            <div className="no-bars min-h-0 flex-1 overflow-y-auto">
              {sideTab === "render" ? <RenderPanel />
                : sideTab === "inspector" ? <Inspector />
                : sideTab === "format" ? <FormatPanel />
                : sideTab === "pages" ? <PagesPanel />
                : sideTab === "motion" ? <MotionPanel />
                : <LookPanel />}
            </div>
          </aside>
        ) : null}

        {/*
          One scroller down the middle: the board, then the shelf.

          Nothing here shrinks the board and nothing here is a window on it.
          Scrolling down carries you through the whole page and on into the
          parts; scrolling back up brings the page back at exactly the size
          it was, because the zoom is a fit of the *width* and the width has
          not changed.
        */}
        <div
          data-studio-scroll=""
          /*
           * The column: a ground that holds still, and one pane that moves.
           *
           * Three arrangements have now been tried for the same complaint,
           * and two of them were the same mistake wearing different clothes.
           * First the frame was a fixed viewport with the site sliding
           * behind its edge. Then the frame was the whole site, but the
           * board it stood on was `size-full` and the wheel panned it — a
           * scrollbox with the bar turned off, measured at 943px of root
           * holding 1841px of page, which is 898px no gesture could reach.
           *
           * Both were a thing moving *inside* a box. The arrangement now is
           * that there is no box: the board is as tall as the site (see
           * `Canvas`), the pane below is what scrolls, and the shelf is in
           * that same pane under the board, so one gesture runs the length
           * of the page and on into the categories.
           *
           * The ground is out here rather than in the pane, so a long page
           * passes in front of the sky instead of running off the end of it.
           * The panels either side are siblings of this, so they hold still
           * on their own.
           */
          className="no-bars relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          {/*
            One ground, for the whole app, and it holds still.

            The board mounted its own and the timeline mounted another, so
            pressing the green button swapped the weather as well as the
            contents — a different nebula every time, which made a button
            that means "show me the site" look like a button that means "go
            somewhere else". It is mounted once, here, behind all three
            views; each of them is transparent over it.

            It sits *outside* the scrolling pane rather than inside it. A
            ground inside a scroller is a picture of a ground: it is the
            pane's own size, anchored at the top of the scroll, so scrolling
            down a long site runs off the end of the sky. Out here it is the
            column's size, which does not move, and the whole length of the
            page passes in front of it.
          */}
          {/* The latest import's line, across the top of the board, where
              no panel's clipping and no toast setting can hide it. */}
          <NewSiteOffer />
          <ImportStrip />
          <Workspace />
          {/* The little live window floats over the column, not inside the
              scroll: a companion that slid away as the page went by would be
              a poor companion. `offsetParent` is this element. */}
          <PreviewWindow />
          {/*
            The one scroller: the site, then the categories under it.

            The board inside is as tall as the site it is showing, so this
            pane's travel is the whole page and the band below it — one
            gesture from the head of the site to the search box, and the
            panels either side, being siblings of this, never move while it
            happens. The timeline is the board's twin here: what is under it,
            the update you clicked and the book, is reached the same way.
          */}
          <div
            data-studio-pane=""
            /* The pane the site stands in, and the only thing that scrolls.
               `no-bars` because a bar down the design background is the
               thing J does not want to see. */
            /* `overflow-anchor:none` because the band under the site changes
               height. Opening a category grows it by 374, and the browser
               anchored the view to what was on screen and scrolled the pane
               261px to compensate — the site jumping upward on its own the
               moment a category was pressed. Where the site sits is the
               person's, not the browser's. */
            className="no-bars relative flex min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden [overflow-anchor:none]"
          >
            {design ? (
              <Canvas />
            ) : book ? (
              <Timeline />
            ) : (
              <LiveStage device={viewportDevice} pageId={page.id} onNavigatePage={(id) => useStudio.getState().setActivePage(id)} />
            )}
            {/*
              The categories, in the same scroller as the site.

              This is the half of J's measurement that the board's height
              alone does not give: "one continuous wheel gesture runs from
              the top of the site, through all of it, and on into the
              categories." A band beside the pane can be reached by a second
              gesture on a second surface; a band below the board in the same
              pane is reached by carrying on.

              `mt-auto` so a page shorter than the pane leaves its ground
              between the board and the categories rather than below them:
              the shelf stays on the bottom edge where it has always been.

              And `sticky bottom-0`, which is the answer to the one rule of
              J's that the rest of this could not keep: he must never load in
              unable to see the categories. His screen is a 1440p 27 inch at
              125% browser zoom — 2048×1152 — and there the arithmetic has no
              room in it. The bar takes 87, leaving a 1065 pane; the site
              fitted to the pane's width is 1692 across and 1058 down, so the
              board is 1078 before the band is counted at all. It is 13px
              taller than the pane on its own. No band height fixes that, and
              shrinking the site to fit the fold is the height-fit that was
              taken out for good reason: a long page fitted by its height is
              a ribbon.

              So the band stops scrolling away instead. Stuck to the pane's
              bottom it is on screen from the first frame at every size, and
              the site still runs up behind it: the travel is unchanged at
              261 there, and at the end of it the board's bottom lands at 817
              from the pane's top, which is exactly the band's top. The site
              bottoms out at the categories, which is his own wording for it,
              and the shelf's bottom is on the fold at every width rather
              than only at the widths where the sums happened to work.

              When the page is shorter than the pane there is nothing to
              stick to and `mt-auto` alone puts it where it always was.

              `bg-bg` because the ground is behind the whole column now, and
              the shelf is a `bg-panel/50` — without a backing of the app's
              own surface it would read as a wash over the nebula instead of
              the panel it has always been.
            */}
            {design ? (
              <div
                data-studio-band=""
                data-band-over=""
                data-band-set={shelfTall == null ? undefined : "1"}
                data-band-folded={shelfFolded ? "" : undefined}
                className="sticky bottom-0 z-10 mt-auto w-full shrink-0 border-t border-border bg-bg"
                /* His height if he has set one with the wheel over the
                   categories, otherwise the two the band has always had. */
                style={{ height: shelfFolded ? SHELF_STRIP_H : shelfTall != null ? `${shelfTall}px` : shelfOpen ? SHELF_OPEN_H : BAND_H }}
              >
                <Palette />
              </div>
            ) : book ? (
              /* Taller for the backend, which is a surface you work at
                 rather than a page of text: at the strip's height its
                 transcript was 80px and the prompt box was below the fold. */
              /*
                THE TIMELINE'S STRIP IS NOT A BAND.

                The shelf below the board is stuck to the fold and given a
                fixed height for a reason of his — he must never load in
                unable to see the categories — and that reason is about the
                categories, not about this. Here the same shape was the fault:
                "the box stays small and i have to scroll for every specific
                point." So under the timeline it is an ordinary block, as tall
                as what it holds, and the pane's own wheel travels it.

                The backend keeps a height of its own: it is a live surface
                with a transcript rather than a page of text, and standing it
                at its full height would put the prompt box a screen away.
              */
              detailTab === "backend" ? (
                <div data-studio-band="" data-band-over="" className="sticky bottom-0 z-10 mt-auto w-full shrink-0 border-t border-border bg-bg" style={{ height: WORK_H }}>
                  <TimelineDetail />
                </div>
              ) : (
                <div data-studio-band="" className="mt-auto w-full shrink-0 border-t border-border bg-bg">
                  <TimelineDetail />
                </div>
              )
            ) : null}
          </div>
        </div>

      </div>

      <DrawQueue />
      {/* Import's own surface: the scrubber, and where the frame lands. It
          floats over everything because the board behind it is the preview. */}
      <ImportFlow />
      <RadialMenu />
      {/* What came back from the site's repository, to review (`WorkShelf.tsx`). */}
      <FeatureOffers />
      <LightPlacer />
      <BriefDialog open={briefOpen && !book} onOpenChange={setBriefOpen} />
    </div>
  );
}
