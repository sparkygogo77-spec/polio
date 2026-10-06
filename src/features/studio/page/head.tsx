"use client";
import { hiddenGroups, screenKey, type ScreenRead } from "../boardStates";
import { closePanelsPage, openPanelsPage, usePanelsPageOpen } from "../PanelsPage";
import { pageScenes } from "../scenes";
import type { SceneScreen } from "../stateRules";
import { stepScene } from "../sceneStep";
import { stateFrames, type FrameNode } from "../stateFrames";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, EyeOff, FileText, Layers, Plus } from "lucide-react";
import { useBuilds } from "@/features/builds/store";
import { resolvePalette } from "../parts/theme";
import { usePicture } from "../pictures";
import { siteLogo } from "../siteMark";
import { useHeldStudio, useStudio, useSteady } from "../store";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";
import { Popover } from "@/core/ui/popover";

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
export function SiteHead() {
  const router = useRouter();
  const brief = useHeldStudio((s) => s.brief);
  const format = useHeldStudio((s) => s.format);
  const look = useHeldStudio((s) => s.look);
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
  const nodes = useHeldStudio((s) => s.nodes);
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
export function PageChips() {
  const pages = useHeldStudio((s) => s.pages);
  const activeId = useHeldStudio((s) => s.activePageId);
  const nodes = useHeldStudio((s) => s.nodes);
  const [open, setOpen] = React.useState(false);
  const panelsOpen = usePanelsPageOpen();
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
                  onClick={() => { play("navigate"); useStudio.getState().setActivePage(p.id); closePanelsPage(); setOpen(false); }}
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
          className={cn("tactile flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-plain", panelsOpen ? "text-fg-muted hover:bg-hover hover:text-fg" : "bg-accent-soft text-fg")}
        >
          <FileText className={cn("size-3 shrink-0", !panelsOpen && "text-accent")} />
          <span className="max-w-[160px] truncate">{current.name}</span>
          {here ? <span className="num text-fine text-fg-faint">{here}</span> : null}
          <ChevronDown className={cn("size-3 shrink-0 text-fg-faint transition-transform", open && "rotate-180")} />
        </button>
      </Popover>
      {/* The page's data panels and their states, on a page of their own beside this one (`PanelsPage.tsx`, J 2026-10-06). */}
      <button
        type="button"
        data-panels-tab=""
        aria-pressed={panelsOpen}
        aria-label={panelsOpen ? "Panels page is open. Back to the page" : "Panels: every data panel of this page and its states"}
        onClick={() => (panelsOpen ? closePanelsPage() : openPanelsPage(null))}
        className={cn("tactile flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-plain", panelsOpen ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}
      >
        <Layers className={cn("size-3 shrink-0", panelsOpen && "text-accent")} />
        Panels
      </button>
      <StatesChip pageId={current.id} />
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
 * THE PAGE'S HIDDEN STATES, switched on for the board (`boardStates.ts`).
 *
 * Only on a page that has some: its preview screens first, when the
 * repository it came from lists them (one shows exactly what that screen
 * shows), then each hidden group by its hook. One or more at a time; the
 * page still opens with them hidden, wherever it is published or exported.
 */
export function StatesChip({ pageId }: { pageId: string }) {
  const nodes = useSteady(useHeldStudio((s) => s.nodes));
  const on = useHeldStudio((s) => s.statesOn ?? []);
  const source = useHeldStudio((s) => (s.look as { styleSource?: { files?: { file: string; pageId: string }[]; screens?: ScreenRead[] } }).styleSource);
  const [open, setOpen] = React.useState(false);
  const groups = React.useMemo(() => hiddenGroups(nodes, pageId), [nodes, pageId]);
  /* The page's parts that go through states (the TV, the balance panel), outermost first: each opens its own timeline (`StatesTimeline.tsx`). */
  const frames = React.useMemo(() => {
    const r = stateFrames(nodes as unknown as FrameNode[]);
    return r.frames.filter((f) => f.pageId === pageId && f.steps.length > 1 && (r.inFrame.get(f.frame) ?? f.frame) === f.frame);
  }, [nodes, pageId]);
  const [more, setMore] = React.useState(false);
  const file = source?.files?.find((f) => f.pageId === pageId)?.file ?? null;
  const screens = (source?.screens ?? []).filter((x) => x.page === file);
  /* A site that follows the state rules lists its own scenes, in its order: nothing is grouped by guessing (`stateRules.ts`). */
  const declared = screens.filter((x) => (x as SceneScreen).declared) as SceneScreen[];
  /* ← and → step through them on the board (`sceneStep.ts`), when nothing is picked (the arrows move what is picked) and nothing is typed in. */
  const stepping = declared.length > 0;
  React.useEffect(() => {
    if (!stepping) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const st = useStudio.getState();
      if (st.mode !== "design" || st.selection.length || document.querySelector("[role='dialog'], [data-radial]")) return;
      e.preventDefault();
      stepScene(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepping]);
  if (!groups.length && !screens.length && !frames.length) return null;
  const scenes = declared.length ? { scenes: [], onTop: [] } : pageScenes(screens, file);
  const here = [...screens.map((x) => screenKey(x.name)), ...scenes.onTop.map((v) => v.key), ...groups.map((g) => g.group)];
  const lit = here.filter((k) => on.includes(k)).length;
  const flip = (key: string) => { play("tap"); const st = useStudio.getState(); const now = st.statesOn ?? []; st.setStatesOn(now.includes(key) ? now.filter((k) => k !== key) : [...now, key]); };
  /* One scene at a time: a scene is one capture of the whole page, so picking one puts the last away. */
  const pickScene = (key: string) => { play("tap"); const st = useStudio.getState(); const now = st.statesOn ?? []; const mine = new Set(screens.map((x) => screenKey(x.name))); st.setStatesOn(now.includes(key) ? now.filter((k) => k !== key) : [...now.filter((k) => !mine.has(k)), key]); };
  const Row = ({ k, name, note }: { k: string; name: string; note: string }) => {
    const pressed = on.includes(k);
    return (
      <button
        type="button"
        aria-pressed={pressed}
        {...(k.startsWith("screen:") ? { "data-screen-toggle": k.slice(7) } : k.startsWith("top:") ? { "data-on-top-toggle": k.slice(4) } : { "data-state-toggle": k })}
        onClick={() => (k.startsWith("screen:") ? pickScene(k) : flip(k))}
        className={cn("tactile flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-plain", pressed ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}
      >
        {pressed ? <Eye className="size-3 shrink-0 text-accent" /> : <EyeOff className="size-3 shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span className="num shrink-0 pl-2 text-fine text-fg-faint">{note}</span>
      </button>
    );
  };
  return (
    <>
      <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="start"
        className="max-h-[70vh] w-auto min-w-[240px] max-w-[340px] overflow-y-auto p-1"
        content={
          <div data-states-menu="" className="flex flex-col gap-0.5">
            <p className="px-2 py-1 text-fine text-fg-faint">Pick a part to see the states it goes through. Shown on the board only: the page still opens as its code says.</p>
            <button type="button" data-states-all="" onClick={() => { setOpen(false); openPanelsPage(null); }}
              className="tactile flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-plain font-medium text-fg hover:bg-hover">
              <Layers className="size-3 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate">Every state on this page, at a glance</span>
            </button>
            {/* Declared scenes, as the site lists them; where the live capture of one draws other parts, it says so. */}
            {declared.length ? <p className="px-2 pt-1 text-fine font-medium text-fg-muted">Scenes (← → to step)</p> : null}
            {declared.map((x) => <Row key={x.name} k={screenKey(x.name)} name={x.label ?? x.name} note={x.differs ? `live differs: ${x.differs.extra.length + x.differs.missing.length}` : x.name} />)}
            {/* J: one part, its timeline; not an endless list of every state on the page. */}
            {frames.map((f) => {
              const n = nodes.find((x) => x.id === f.frame);
              return (
                <button key={f.frame} type="button" data-states-frame={f.frame} onClick={() => { setOpen(false); useStudio.getState().setSelection([f.frame]); openPanelsPage(f.frame); }}
                  className="tactile flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-plain text-fg-muted hover:bg-hover hover:text-fg">
                  <Layers className="size-3 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{f.hook ?? n?.label ?? "A part"}</span>
                  <span className="num shrink-0 pl-2 text-fine text-fg-faint">{f.steps.length} states</span>
                </button>
              );
            })}
            {screens.length || groups.length ? (
              <button type="button" data-states-more="" aria-expanded={more} onClick={() => setMore((v) => !v)} className="tactile mt-1 flex h-7 items-center gap-1 rounded-md px-2 text-left text-fine text-fg-faint hover:bg-hover hover:text-fg">
                <ChevronDown className={cn("size-3 shrink-0 transition-transform", more && "rotate-180")} />
                {frames.length ? "More: scenes and every hidden part" : "Scenes and every hidden part"}
              </button>
            ) : null}
            {more || !frames.length ? (
              <>
                {/* The page's scenes in game order, each with its variants; then what goes on top of them (`scenes.ts`). */}
                {scenes.scenes.map((sc) => (
                  <React.Fragment key={sc.key}>
                    <p data-scene={sc.key} className="px-2 pt-1 text-fine font-medium text-fg-muted">{sc.name}</p>
                    {sc.variants.map((v) => <Row key={v.key} k={v.key} name={v.label} note={v.screen.name} />)}
                  </React.Fragment>
                ))}
                {scenes.onTop.length ? <p className="px-2 pt-1 text-fine font-medium text-fg-muted">On top</p> : null}
                {scenes.onTop.map((v) => <Row key={v.key} k={v.key} name={v.label} note={v.screen.name} />)}
                {groups.length ? <p className="px-2 pt-1 text-fine font-medium text-fg-muted">Hidden parts</p> : null}
                {groups.map((g) => <Row key={g.group} k={g.group} name={g.template ? `${g.hook} (template)` : g.hook} note={String(g.parts)} />)}
              </>
            ) : null}
            {lit ? (
              <button type="button" data-states-off="" onClick={() => { play("tap"); useStudio.getState().setStatesOn((useStudio.getState().statesOn ?? []).filter((k) => !here.includes(k))); }} className="tactile mt-1 h-7 rounded-md px-2 text-left text-plain text-fg-muted hover:bg-hover hover:text-fg">
                Hide them all again
              </button>
            ) : null}
          </div>
        }
      >
        <button
          type="button"
          data-states-button=""
          aria-label={`States: ${lit} of ${here.length} shown on the board`}
          className={cn("tactile flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-plain", lit ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}
        >
          <Layers className={cn("size-3 shrink-0", lit && "text-accent")} />
          <span>States</span>
          {lit ? <span className="num text-fine text-fg-faint">{lit}</span> : null}
        </button>
      </Popover>
    </>
  );
}
