"use client";
import { closePanelsPage, openPanelsPage, usePanelsPageOpen } from "../states/ui";
import { useSceneKeys } from "../states/ui";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, Layers, Plus } from "lucide-react";
import { useBuilds } from "@/features/builds/store";
import { resolvePalette } from "../parts/theme";
import { usePicture } from "../pictures";
import { siteLogo } from "../siteMark";
import { useHeldStudio, useStudio } from "../store";
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
  /* ← → step the declared scenes; the States button that carried this is gone (J: Panels and Page state cover it, `PanelsMore.tsx`). */
  useSceneKeys(activeId);
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
      <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
      <Tooltip content="Add page">
        <Button variant="ghost" size="iconXs" aria-label="Add page" onClick={() => { const id = useStudio.getState().addPage(); useStudio.getState().want({ panel: "pages", focus: "name", id }); }}>
          <Plus />
        </Button>
      </Tooltip>
    </div>
  );
}
