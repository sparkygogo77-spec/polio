"use client";
/**
 * The Studio: arrange what the site should be, then say what it is.
 *
 * Left  — the feature library.
 * Middle— the canvas, with page tabs above and the master prompt below.
 * Right — whatever is selected, the site format options, or the page list.
 */
/* The learned library: every import is read for what can be used again, builder-wide (`library/learned.ts`). */
import { RemakeCard } from "../RemakePicture";
import { ClearBackgroundCard } from "../ClearBackground";
import { putComponent } from "../SavedComponents";
import { RemixCard } from "../RemixCard";
import { PanelsPage } from "../states/ui";
import { PartFocus } from "../states/ui";
import { FeatureOffers } from "../WorkShelf";
import * as React from "react";
import { Bakers } from "../Bakers";
import { Canvas } from "../Canvas";
import { rollOnto, startNewSite } from "../newSite";
import { ImportStrip } from "../bring-in/ui";
import { NewSiteOffer } from "../NewSiteOffer";
import { placeBring, takeKeptBring } from "../bringRepo";
import { Workspace } from "../Workspace";
import { useBuilds } from "@/features/builds/store";
import { ImportFlow } from "../ImportFlow";
import { PreviewWindow } from "../Preview";
import { Palette, useShelfFolded, useShelfTall } from "../shelf/screens";
import { Inspector } from "../Inspector";
import { LookPanel } from "../look/ui";
import { MotionPanel } from "../MotionPanel";
import { PicturesPanel } from "../PicturesPanel";
import { FormatPanel } from "../FormatPanel";
import { PagesPanel } from "../PagesPanel";
import { BriefDialog } from "../BriefDialog";
import { exportSite } from "../send-out/run";
import { activePage, useStudio, useStudioHydration } from "../board/store";
import { LiveStage } from "../live/LiveStage";
import { RadialMenu } from "../RadialMenu";
import { DrawQueue } from "../DrawQueue";
import { aimLight, endLightRig, rigPasses, startLightRig } from "../lightRig";
import { Timeline } from "../Timeline";
import { TimelineDetail, TimelinePanel, useDetailTab } from "../TimelineDetail";
import { mountNebula } from "../nebulaTile";
import { LightPlacer } from "../LightPlacer";
import { cn } from "@/core/lib/cn";
import { Segmented } from "@/core/ui/segmented";
import { useActions } from "@/core/actions";
import { publish, studioDoc } from "../agent";
import "../shelf/ui";
import { LearnedDialog } from "../LearnedPanel";
import { useLearned } from "../shelf/ui";
import { learnedVersions } from "../shelf";
import { putSiteVersion } from "../ShelfCards";
import { BAND_H, SHELF_OPEN_H, SHELF_STRIP_H, WORK_H, useNarrow, useViewportDevice } from "./sizes";
import { Toolbar } from "./toolbar";
import { SIDE_TABS, SHEET, useSideWidth, SideEdge, SheetHandle } from "./side";

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
  const tabWords = !narrow && sideWidth >= 440;
  const viewportDevice = useViewportDevice();
  // A sheet is asked for, never left lying over the board: on a narrow
  // window it starts closed and the toggle, the tour and a pick open it.
  React.useEffect(() => { if (narrow) setLibraryOpen(false); }, [narrow]);
  const [leftPanel, setLeftPanel] = React.useState("look");
  const mode = useStudio((s) => s.mode);
  const page = useStudio(activePage);
  const detailTab = useDetailTab();
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

  /* A site made with New site opens on a sample page in a theme of its own, once, after its board has loaded (`newSite.ts`). */
  const starterFor = useBuilds((s) => s.projects.find((p) => p.id === s.activeId && p.starter) ?? null);
  React.useEffect(() => {
    if (!starterFor) return;
    let gone = false;
    const go = () => {
      if (gone) return;
      if (useStudio.getState().nodes.length === 0) startNewSite(starterFor.name);
      useBuilds.setState((b) => ({ projects: b.projects.map((p) => (p.id === starterFor.id ? { ...p, starter: undefined } : p)) }));
    };
    if (useStudio.persist.hasHydrated()) go();
    else { const off = useStudio.persist.onFinishHydration(() => { off(); go(); }); return () => { gone = true; off(); }; }
    return () => { gone = true; };
  }, [starterFor]);

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
    /* The same site as a builder-ready repository (exportForCode.ts, kit/PIPELINE.md route 1), for tests/export-for-code.mjs. */
    (w as unknown as { __studioKitExport?: () => Promise<unknown> }).__studioKitExport = () => import("../exportForCode").then((m) => m.exportForCode());
    /* And to a design/ branch of the repository it came from, for tests/export-to-branch.mjs. */
    (w as unknown as { __studioKitBranch?: () => Promise<unknown>; __studioKitSteps?: string[] }).__studioKitBranch = () => import("../exportForCode").then((m) => { const steps: string[] = []; (w as unknown as { __studioKitSteps?: string[] }).__studioKitSteps = steps; return m.exportForCodeToBranch({ onProgress: (x) => steps.push(x) }); });
    (w as unknown as { __studioRecord?: () => Promise<unknown> }).__studioRecord = () => import("../exportForCode").then((m) => JSON.parse(m.boardRecord()));
    (w as unknown as { __studioLearned?: () => unknown }).__studioLearned = () => useLearned.getState().lib;
    (w as unknown as { __studioNodes?: () => unknown }).__studioNodes = () => useStudio.getState().nodes;
    /* A saved component placed on the open board as the shelf's Add places it: for the checks (tests/universal-effects.mjs). */
    (w as unknown as { __studioPutComponent?: (id: string, at?: { x: number; y: number }) => string[] | null }).__studioPutComponent = (id, at) => {
      const c = (useLearned.getState().lib.components ?? []).find((x) => x.id === id || x.name === id);
      return c ? putComponent(c, at) : null;
    };
    /* A learned site's version of a shelf item, put on a new part as the shelf's Add does: for the checks (tests/learned-library.mjs). */
    (w as unknown as { __studioPutLearned?: (item: string, host: string) => string | null }).__studioPutLearned = (item, host) => {
      const v = learnedVersions(useLearned.getState().lib).get(item)?.find((x) => x.host === host);
      if (!v) return null;
      let made: string | null = null;
      putSiteVersion({ item, take: v.take, label: v.label, host, parts: [], frames: v.frames } as Parameters<typeof putSiteVersion>[0], (f) => { made = useStudio.getState().addNode(f, 40, 40 + useStudio.getState().nodes.length * 60); return made; });
      return made ?? useStudio.getState().selection[0] ?? null;
    };
    w.__studioToggleLibrary = () => setLibraryOpen((v) => !v);
    w.__studioSetBrief = (v) => setBriefOpen(v);
    w.__studioSetLibrary = (v) => setLibraryOpen(v);
    w.__studioSetLeftPanel = (id) => setLeftPanel(id);
    /* For the theme checks: a roll with a known seed, and a new site's first page (`newSite.ts`). */
    (w as unknown as { __studioRollTheme?: (seed?: number) => unknown }).__studioRollTheme = (seed) => rollOnto({ seed });
    (w as unknown as { __studioStartNewSite?: (name?: string, seed?: number) => unknown }).__studioStartNewSite = (name, seed) => startNewSite(name, seed);
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
    // The board's zoom as the readout says it (0.51 is 51%), or "fit" for Fit in view (tests/board-top-edge.mjs).
    (w as unknown as { __studioZoom?: (z: number | "fit") => void }).__studioZoom = (z) => (z === "fit" ? useStudio.getState().requestFit() : useStudio.getState().setZoom(z));
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
            <div className="flex shrink-0 items-center gap-1 border-b border-border px-1.5 py-1">
              <Segmented
                /* Every tab says its name, always: six words on one row when
                   there is room for them, three to a row when there is not.
                   An icon row with one word lit was a row of pictures to
                   learn; the owner asked for the names back. */
                className={cn(
                  "min-w-0 flex-1 gap-0.5 [&>*]:min-w-0 [&>*]:justify-center [&>*]:px-1",
                  tabWords ? "[&>*]:flex-1" : "grid h-auto grid-cols-3 [&>*]:h-6",
                )}
                size="xs"
                value={sideTab}
                onChange={setLeftPanel}
                options={SIDE_TABS.map((t) => ({
                  value: t.value,
                  title: t.label,
                  /* The mark wears the panel's colour at both states: the hue
                     says which panel this is, so it never goes away. */
                  icon: (
                    <span className="contents" style={{ color: `oklch(0.82 0.15 ${t.hue})`, opacity: sideTab === t.value ? 1 : 0.72 }}>
                      {t.icon}
                    </span>
                  ),
                  label: (
                    <span data-tab-word="" className="truncate whitespace-nowrap text-small">
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
              {sideTab === "inspector" ? <Inspector />
                : sideTab === "format" ? <FormatPanel />
                : sideTab === "pages" ? <PagesPanel />
                : sideTab === "motion" ? <MotionPanel />
                : sideTab === "pictures" ? <PicturesPanel />
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
          {/* Both strips are `relative z-[1]`: as plain blocks the ground,
              positioned after them, painted over them, so a new site's offer
              was an unseen 34px band and the board slid under a line of sky
              (J, 2026-10-06, `tests/board-top-strip.mjs`). */}
          <NewSiteOffer />
          <ImportStrip />
          <Workspace />
          {/* The little live window floats over the column, not inside the
              scroll: a companion that slid away as the page went by would be
              a poor companion. `offsetParent` is this element. */}
          <PreviewWindow />
          {/* "Remake this picture…", opened from the wheel's tray or a parts-tree row. */}
          <RemakeCard />
          {/* "Transparent background…", from the wheel's tray under a picture. */}
          <ClearBackgroundCard />
          <LearnedDialog />
          <RemixCard />
          {/* The Panels page: every data panel and its states, over the board and shelf (`PanelsPage.tsx`). */}
          {design ? <PanelsPage /> : null}
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
            {design ? null : book ? (
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
          {/*
            THE BOARD STOPS ABOVE THE SHELF (J's review, d0943c6). The shelf was
            stuck to the bottom of the board's own scroller, so the site ran on
            behind it and showed below and through it. It is the pane's sibling
            now: the board scrolls in its own area, and the categories are
            always on screen under it.
          */}
          {/* A part's states are chips in the side panel next to Focus
              (`StatesTimeline.tsx#PartSamples`): the step bar docked under
              the board went (J, 2026-10-06). */}
          {/* A part alone, at real size, with every state it goes through side by side (`PartFocus.tsx`). */}
          {design ? <PartFocus /> : null}
          {design ? (
                <div
                  data-studio-band=""
                  data-band-over=""
                  /* The tallest the shelf opens to without his hand on it: the phone window stands above this, so it neither moves as a category opens nor sits over the cards (`Preview.tsx`). */
                  data-band-reach={SHELF_OPEN_H}
                  data-band-set={shelfTall == null ? undefined : "1"}
                  data-band-folded={shelfFolded ? "" : undefined}
                  className="relative z-10 w-full shrink-0 border-t border-border bg-bg"
                  /* His height if he has set one with the wheel over the
                     categories, otherwise the two the band has always had. */
                  /* ONE HEIGHT, OPEN OR SHUT (J, after #19): the board stays its size and only scrolls; opening a category never takes room from it. The band keeps its shut height and the open category's cards scroll inside it. Only his own fold or grip changes it. */
                  style={{ height: shelfFolded ? SHELF_STRIP_H : shelfTall != null ? `${shelfTall}px` : BAND_H }}
                >
                  {/* The Panels shelf went: panels and their states have their own page (`PanelsPage.tsx`, J 2026-10-06). */}
                  <Palette />
                </div>
          ) : null}
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
