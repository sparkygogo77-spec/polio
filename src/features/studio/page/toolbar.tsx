"use client";
import * as React from "react";
import { Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Ellipsis, Eye, History, Link2, Link2Off, Monitor, PanelLeft, PlayCircle, Search, Smartphone, Square, Tablet, TriangleDashed, ZoomIn, ZoomOut } from "lucide-react";
import { HistoryControls } from "../HistoryControls";
import { CaptureSiteDoor } from "../CaptureSiteDialog";
import { UpdatesPanel } from "../Updates";
import { FRAME_WIDTHS, livePath, useStudio, type Tool } from "../store";
import { useRadialOpen } from "../RadialMenu";
import { ProcessCounter } from "../DrawQueue";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";
import { Popover } from "@/core/ui/popover";
import { ToolOptions } from "../toolOptions";
import { setDecideAll, useDecideAll, useDecideCount } from "../decideShown";
import { useActions } from "@/core/actions";
import { Dropdown } from "@/core/ui/dropdown-menu";
import { TOOLS, useMedia, FOLDING } from "./sizes";
import { SiteHead, PageChips } from "./head";
import { scenesOnPage, showScene, stepScene } from "../sceneStep";

export function Toolbar({ libraryOpen, onToggleLibrary }: { libraryOpen: boolean; onToggleLibrary: () => void }) {
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
  const shape = useStudio((s) => s.menuShape);
  const menuOpen = useRadialOpen();
  const mode = useStudio((s) => s.mode);

  // In Preview the board is the site, so the drawing tools have nothing to act on.
  if (mode === "preview") {
    return (
      <div data-studio-bar="" className="no-bars overflow-x-auto overflow-y-visible flex shrink-0 items-center gap-2 border-b border-border bg-panel/60 px-2 py-1.5">
        <SiteHead />
        <span className="mx-1 h-4 w-px bg-border" />
        <PageChips />
        <span className="flex-1" />
        {/* A new tab, with no way back into this one (`noopener`): the Builder stays where it was. It replaced this tab, and the board with it. */}
        <Tooltip content="Open the site on its own address, in a new tab">
          <Button asChild variant="ghost" size="iconXs">
            <a data-open-site="" href={livePath()} target="_blank" rel="noopener noreferrer" aria-label="Open the site in a new tab">
              <Eye />
            </a>
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
   *   5. the search entirely       (below lg)  — mod+k still opens it,
   *                                              and More carries it there
   *   7. the page chips            (below md)  — Pages is a panel tab, and
   *                                              the panel's toggle is in
   *                                              this bar at every width
   *   8. the site's name           (below sm)  — its mark stays
   *
   * Rungs 3, 4 and 6 (Wires, Updates, the menu's edge) left the row at every
   * width: they are rarely pressed, so they live in More with Capture a site.
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
      <span className="mx-1 hidden h-4 w-px bg-border md:block" />
      <PageChips />
      <span className="mx-1 hidden h-4 w-px bg-border md:block" />
      <Tooltip content={libraryOpen ? "Hide the side panel" : "Show the side panel"} shortcut="l">
        <Button variant={libraryOpen ? "subtle" : "ghost"} size="iconXs" aria-label="Toggle the side panel" aria-pressed={libraryOpen} onClick={onToggleLibrary}>
          <PanelLeft />
        </Button>
      </Tooltip>
      <span className="mx-1 hidden h-4 w-px bg-border md:block" />
      <ToolPicker tool={tool} setTool={setTool} />
      {/* Draw a space, with its name on it: the one tool the owner could not find again once an import stopped opening it (`tests/space-command.mjs`). */}
      <button
        type="button"
        data-draw-space-button=""
        aria-label="Draw a space"
        aria-pressed={tool === "space"}
        title="Draw a space (S): draw a closed shape on the page, and its panel opens on the right"
        onClick={() => setTool(tool === "space" ? "select" : "space")}
        className={cn("tactile ml-1 hidden h-6 shrink-0 items-center gap-1 rounded-md border px-1.5 md:inline-flex text-small [&_svg]:size-3.5", tool === "space" ? "border-[oklch(0.62_0.19_25)] text-fg" : "border-border text-fg-muted hover:text-fg")}
      >
        <TriangleDashed />
        {/* Below 768 the button is not in the bar at all: the tool picker
            holds Draw a space too, and S takes it; on a phone-wide bar the
            button cost Preview and Finish a third row
            (`tests/phone-way-out.mjs`). And while the pen's row is out, the
            word waits for a wide bar: at 1281 the row and the word left the
            search no room for its own words (`tests/menu-pass.mjs`). */}
        <span className={tool === "pen" || tool === "arrow" ? "hidden 2xl:inline" : "inline"}>Draw a space</span>
      </button>

      {/* The tool in hand, and its own settings: the pen's colour, the select tool's checkbox. See `toolOptions.tsx`. */}
      <ToolOptions tool={tool} />

      <span className="mx-1 hidden h-4 w-px bg-border md:block" />
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

      {/* The part menu's edge and the wires are in More now, with the other
          controls that are rarely pressed: the bar had about twenty small
          icons and these were the least used (`tests/decide-count.mjs`). */}
      {/* Undo and redo, each naming its step, and the list of steps behind them (`HistoryControls.tsx`). */}
      <HistoryControls />

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
      <span className="mx-1 hidden h-4 w-px bg-border md:block" />
      <DecideCount />
      <MoreTools folding={folding} shape={shape} menuOpen={menuOpen} showWires={showWires} zoom={zoom} tool={tool} inkHue={inkHue} onUpdates={() => setUpdatesOpen(true)} />
      {/* THE WAY IN, and it lives in the bar because a row above the board
          would move the board — which is the one thing the Builder promises
          not to do, and it moved a drawn space out from under a suite that
          draws by coordinate. He made a fresh site, went looking for a way
          to pull a repository into it, searched the palette for "import"
          and for "site", and there was none: the Builds page's field only
          binds where Publish pushes, and the GitHub control draws nothing
          at all until a site already has a repository or a token. */}
      {/* On a phone-wide bar Capture sits behind More tools: in the bar it
          helped push Preview and Finish onto a third row
          (`tests/phone-way-out.mjs`). Bring stays, being the way in on a
          phone too (`tests/bring-repo-door.mjs`). The capture dialog stays
          mounted either way; it is drawn in a portal, and More opens it. */}
      <CaptureSiteDoor hidden />
      <UpdatesToggle open={updatesOpen} onOpenChange={setUpdatesOpen} />
      <PreviewToggle />
      <ProcessCounter />
    </div>
  );
}

/**
 * The bar's More key: the controls that are rarely pressed.
 *
 * The bar had about twenty small icons. The part menu's edge, the wires,
 * Capture a site and Updates are pressed least, so they live here at every
 * width, each with its name beside it. On a narrow window (`folding`) the
 * controls the bar folds away join them: Fit, the tool's own settings and
 * the search.
 */
export function MoreTools({ folding, shape, menuOpen, showWires, zoom, tool, inkHue, onUpdates }: { folding: boolean; shape: "square" | "round"; menuOpen: boolean; showWires: boolean; zoom: number; tool: string; inkHue: number; onUpdates: () => void }) {
  const [open, setOpen] = React.useState(false);
  const row = "flex items-center gap-1.5 text-plain text-fg";
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      content={
        <div data-toolbar-more-menu="" className="flex w-[220px] flex-col gap-1.5">
          {folding ? (
            <div className={row}>
              <span className="flex-1">Fit in view</span>
              <button type="button" aria-label="Fit in view" data-fit-readout="" className="num text-small text-fg-muted hover:text-fg" onClick={() => { useStudio.getState().requestFit(); setOpen(false); }}>{Math.round(zoom * 100)}%</button>
            </div>
          ) : null}
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
          {folding ? <ToolOptions tool={tool as Tool} compact /> : null}
          <div className={row}>
            <Button variant="ghost" size="iconXs" data-capture-site="" aria-label="Capture a site" onClick={() => { setOpen(false); window.dispatchEvent(new Event("studio:capture-site")); }}><Camera /></Button>
            <span className="flex-1">Capture a site</span>
          </div>
          <div className={row}>
            <Button variant="ghost" size="iconXs" data-updates-toggle="" aria-label="Updates" onClick={() => { setOpen(false); onUpdates(); }}>
              <History />
            </Button>
            <span className="flex-1">Updates</span>
          </div>
          {folding ? <div className={row}><SearchTools always /></div> : null}
        </div>
      }
    >
      <Button variant={open ? "subtle" : "ghost"} size="iconXs" data-toolbar-more="" aria-label="More tools" aria-pressed={open} className={cn(menuOpen && "ring-1 ring-accent")}>
        <Ellipsis />
      </Button>
    </Popover>
  );
}

/**
 * One count of the parts still waiting on a decision, in place of an orange
 * ! on each of them (`decideShown.ts`). The board shows the picked part's !;
 * pressing the count shows them all, and pressing it again hides them.
 */
export function DecideCount() {
  const count = useDecideCount();
  const all = useDecideAll();
  if (!count) return null;
  const say = all ? `${count} parts need a decision: hide their ! marks` : `${count} parts need a decision: show their ! marks`;
  return (
    <Tooltip content={say}>
      <button
        type="button"
        data-decide-count={count}
        aria-label={say}
        aria-pressed={all}
        onClick={() => { play("tap"); setDecideAll(!all); }}
        className={cn("tactile inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-1.5 text-small font-bold", all ? "border-[oklch(0.74_0.18_55)] text-fg" : "border-border text-fg-muted hover:text-fg")}
      >
        <span className="flex size-3.5 items-center justify-center rounded-full text-[10px] leading-none" style={{ background: "oklch(0.74 0.18 55)", color: "oklch(0.2 0.05 50)" }}>!</span>
        <span className="num">{count}</span>
      </button>
    </Tooltip>
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
export function ToolPicker({ tool, setTool }: { tool: Tool; setTool: (t: Tool) => void }) {
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
export const DEVICES = [
  { key: "desktop", label: "Desktop", icon: Monitor, turn: 0 },
  { key: "tablet", label: "Tablet", icon: Tablet, turn: 100 },
  { key: "phone", label: "Phone", icon: Smartphone, turn: 200 },
] as const;

export function DeviceSwitch({ width }: { width: number }) {
  /* The view, not the width the page is designed at: Tablet and Phone show the page as those are served it (`SmallBoard.tsx`). */
  const view = useStudio((s) => s.view);
  void width;
  return (
    <div
      data-device-switch=""
      role="radiogroup"
      aria-label="Frame width"
      className="flex items-center gap-0.5 rounded-md border border-border bg-elevated p-0.5"
    >
      {DEVICES.map((d) => {
        const w = FRAME_WIDTHS[d.key];
        const on = view === d.key;
        const hue = `oklch(0.74 0.17 calc(var(--accent-h) + ${d.turn}))`;
        const Icon = d.icon;
        return (
          <Tooltip key={d.key} content={d.key === "desktop" ? `${d.label}: the page as designed` : `${d.label} · ${w}px: the page as a ${d.key} is served it, with its own settings for each part`}>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={d.label}
              data-device={d.key}
              onClick={() => {
                play("select");
                const s = useStudio.getState();
                /* A page left at a tablet's or phone's width by the old switch is put back to the desktop's. */
                if (d.key === "desktop" && (s.frameWidth === FRAME_WIDTHS.tablet || s.frameWidth === FRAME_WIDTHS.phone)) s.setFrameWidth(FRAME_WIDTHS.desktop);
                s.setView(d.key);
              }}
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
export function SearchTools({ always = false }: { always?: boolean } = {}) {
  const ctx = useActions();
  return (
    <>
    <SceneArrows />
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
        className={cn("tactile mx-1 h-6 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-md border border-accent/45 text-plain text-fg-muted hover:border-accent/70 hover:text-fg", always ? "flex w-auto flex-1 justify-start px-2" : "hidden w-7 lg:flex xl:w-auto xl:min-w-[6.5rem] xl:flex-1 xl:justify-start xl:px-2")}
        style={{ background: "color-mix(in oklch, var(--accent) 14%, var(--elevated))" }}
      >
        <Search className="size-3.5 shrink-0 text-accent" />
        {/* From 1280 up its words are the rung (`tests/menu-pass.mjs`): kept at
            least a word wide, so a full bar takes the room from what can
            truncate rather than squeezing the search to its icon. */}
        <span className={cn("min-w-0 flex-1 truncate text-left", always ? "inline" : "hidden xl:inline xl:min-w-[4.5rem]")}>Search commands…</span>
      </button>
    </Tooltip>
    </>
  );
}

/**
 * ‹ SCENE › BY THE SEARCH BAR (J, 2026-10-06): a site that lists its scenes
 * (`stateRules.ts`) steps through its whole-page layouts here, the board
 * sliding one out and the next in (`sceneStep.ts`). Nothing for a site
 * without them.
 */
export function SceneArrows() {
  const activePageId = useStudio((s) => s.activePageId);
  const look = useStudio((s) => s.look);
  const statesOn = useStudio((s) => s.statesOn);
  const { scenes, at } = React.useMemo(() => scenesOnPage({ activePageId, look, statesOn }), [activePageId, look, statesOn]);
  const [open, setOpen] = React.useState(false);
  if (!scenes.length) return null;
  const now = at >= 0 ? scenes[at]! : null;
  const pick = (i: number) => { setOpen(false); showScene(i, i >= at ? 1 : -1); };
  /* J could not find it as bare arrows: it says what it is, and the middle opens the whole list. */
  return (
    <div data-scene-arrows="" className="flex h-6 shrink-0 items-center rounded-md border border-accent/60 bg-accent-soft/40">
      <button type="button" data-scene-prev="" aria-label="Previous page state" title="Previous page state (←)" onClick={() => stepScene(-1)} className="tactile flex size-6 items-center justify-center text-fg-muted hover:text-fg"><ChevronLeft className="size-3.5" /></button>
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="start"
        className="max-h-[70vh] w-auto min-w-[220px] max-w-[320px] overflow-y-auto p-1"
        content={
          <div data-scene-list="" className="flex flex-col gap-0.5">
            <p className="px-2 py-1 text-fine text-fg-faint">The whole page in each of its states, as the site lists them. ← → step through them on the board.</p>
            {[{ name: "", label: "As it opens" }, ...scenes].map((x, j) => {
              const i = j - 1, lit = i === at;
              return (
                <button key={x.name || "-"} type="button" data-scene-pick={x.name} aria-pressed={lit} onClick={() => pick(i)}
                  className={cn("tactile flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-plain", lit ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
                  <span className="num w-6 shrink-0 text-fine text-fg-faint">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{x.label ?? x.name}</span>
                  {lit ? <Check className="size-3 shrink-0 text-accent" /> : null}
                </button>
              );
            })}
          </div>
        }
      >
        <button type="button" data-scene-now={now?.name ?? ""} title="Page states: pick one, or step with ← →" className="tactile flex h-6 max-w-[14rem] items-center gap-1 truncate px-1 text-small text-fg">
          <span className="shrink-0 font-medium">Page state</span>
          <span className="num text-fg-faint">{at + 1}/{scenes.length}</span>
          <span className="hidden truncate text-fg-muted lg:inline">{now?.label ?? "as it opens"}</span>
        </button>
      </Popover>
      <button type="button" data-scene-next="" aria-label="Next page state" title="Next page state (→)" onClick={() => stepScene(1)} className="tactile flex size-6 items-center justify-center text-fg-muted hover:text-fg"><ChevronRight className="size-3.5" /></button>
    </div>
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
export function UpdatesToggle({ open, onOpenChange: setOpen }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <>
      {/* Its key is in More (`MoreTools`); the panel stays the bar's own. */}
      <UpdatesPanel open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Look at the site rather than the board. Pressing it again comes back. */
export function PreviewToggle() {
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
