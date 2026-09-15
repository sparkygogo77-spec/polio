"use client";
/**
 * The parts shelf, under the board.
 *
 * You walk in from the top: a row of planets, one per category. Pick one and
 * it becomes a crumb with its sub-groups beside it, each with its own moon in
 * the same line-art; pick one of those and the list gets out of the way,
 * leaving the parts themselves.
 *
 * The parts are laid out the way a page reads, top to bottom: what goes across
 * the top first, then the first screen, the body, further down, the foot. A
 * part takes as much of the shelf's width as it would take of a page's —
 * something full-width gets the whole row on its own, and the rest sit side by
 * side with a thin gap. That is the only way you can see what one contains.
 *
 * Nothing is in a box and nothing shows a page background: a preview is the
 * *surface* alone, floating on one dim field, each lit by its own fire —
 * red at rest, blue the moment you reach for it.
 *
 * Nothing here is interactive — every preview is `inert` — so a part only
 * comes alive once it is on the board. Drag it straight out, or click it.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { EyeOff, RotateCcw, Search, Sparkles, X } from "lucide-react";
import {
  CATEGORIES, SUBGROUPS, getFeature, searchFeatures,
  type CategoryId, type FeatureDef,
} from "./catalog";
import { useStudio } from "./store";
import { PartPreview, previewHeight } from "./PartPreview";
import { PLANET } from "./planets";
import { moonFor } from "./moons";
import { BAND_LABEL, groupIntoBands, spanOf } from "./showcase";
import { css, parseColor } from "./look";
import { resolvePalette } from "./parts/theme";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { SCREEN, screenFace } from "@/core/ui/void";
import { cn } from "@/core/lib/cn";
import { Tooltip } from "@/core/ui/tooltip";

/** Where a right-click "add here" lands when no cursor is involved. */
export function dropPoint() {
  const { pan, zoom } = useStudio.getState();
  return { x: (420 - pan.x) / zoom, y: (240 - pan.y) / zoom };
}

/**
 * Click-to-add places the part inside the frame the way a page grows: full-width
 * parts span the frame, everything else is centred, and it lands just below
 * whatever is lowest so the page stacks downward.
 */
export function addFeatureToCanvas(featureId: string) {
  const state = useStudio.getState();
  const feature = getFeature(featureId);
  const fw = state.frameWidth;
  const w = Math.min(feature?.w ?? 420, fw);
  const h = feature?.h ?? 88;
  const onPage = state.nodes.filter((n) => n.pageId === state.activePageId);
  const bottom = onPage.reduce((m, n) => Math.max(m, n.y + n.h), 0);
  const x = w >= fw ? 0 : Math.round((fw - w) / 2);
  const y = onPage.length ? bottom + 24 : 0;
  const id = state.addNode(featureId, x, y, { w, h });
  play("confirm");
  return id;
}

/* ------------------------------------------------------------------ */
/* One part                                                            */
/* ------------------------------------------------------------------ */

function Card({ feature, width: slot, tall, removed }: { feature: FeatureDef; width: number; tall: number; removed?: boolean }) {
  const [dragging, setDragging] = React.useState(false);
  // Fit the whole card, not the preview inside it. A part taller than the cap
  // is drawn narrower rather than letterboxed, so the box is always exactly
  // the picture — no transparent margin for the fire to come through.
  const natural = previewHeight(feature, slot);
  const shrink = Math.min(1, tall / Math.max(1, natural));
  const width = Math.max(120, Math.round(slot * shrink));
  const height = Math.max(44, Math.round(natural * shrink));

  if (removed) {
    return (
      <Tooltip content={`${feature.explain ?? feature.blurb}, removed`} side="top">
        <button
          type="button"
          {...ctxProps("studio-palette", feature.id, feature)}
          onClick={() => { play("confirm"); useStudio.getState().restoreFeature(feature.id); }}
          style={{ width, height }}
          className="tactile flex shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border p-2 opacity-40 hover:opacity-100"
        >
          <RotateCcw className="size-3.5 text-fg-faint" />
          <span className="line-clamp-1 text-center text-[10px] text-fg-muted">{feature.name}</span>
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={feature.explain ?? feature.blurb} side="top">
      <div className="ember group relative" style={{ width }} data-hot={dragging ? "1" : undefined}>
        {/* The fire this one part sits in: a rim that just clears its edges,
            and tongues that climb out of the bottom of it. */}
        <span aria-hidden className="ember-rim" />
        <span aria-hidden className="ember-light">
          <i className="ember-base" />
          <i className="ember-lick-a" />
          <i className="ember-lick-b" />
          <i className="ember-hot" />
        </span>
        <div
          role="button"
          tabIndex={0}
          draggable
          {...ctxProps("studio-palette", feature.id, feature)}
          onDragStart={(e) => {
            e.dataTransfer.setData("application/x-studio-feature", feature.id);
            e.dataTransfer.effectAllowed = "copy";
            setDragging(true);
            play("tap");
          }}
          onDragEnd={() => setDragging(false)}
          onClick={() => addFeatureToCanvas(feature.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              addFeatureToCanvas(feature.id);
            }
          }}
          className="flex cursor-grab flex-col gap-1 outline-none active:cursor-grabbing"
        >
          <PartPreview feature={feature} width={width} height={height} />
          <span className="line-clamp-1 text-[10px] leading-tight text-fg-muted group-hover:text-fg">{feature.name}</span>
        </div>
        <button
          type="button"
          aria-label={`Remove ${feature.name} from the library`}
          onClick={(e) => { e.stopPropagation(); play("deny"); useStudio.getState().hideFeature(feature.id); }}
          className="tactile absolute right-0.5 top-0.5 hidden rounded-sm bg-panel/80 p-0.5 text-fg-faint hover:text-fg group-hover:block"
        >
          <X className="size-3" />
        </button>
      </div>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/* The crumbs                                                          */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* The shelf                                                           */
/**
 * How many categories may be open at once.
 *
 * Two, so you can hold a hero next to a text block and choose between them,
 * and not three, because the shelf is a 248px band and a third turns it from
 * something you read into something you scroll.
 */
const OPEN_AT_MOST = 2;

/* ------------------------------------------------------------------ */

/*
 * Whether any category is open, for the band the shelf stands in.
 *
 * The shelf is a 209px strip inside a 248px band, and it was that whether
 * or not there was anything in it. Opening one category puts 1745px of
 * cards in it — a twelve-span element is given the whole shelf width by
 * `sizeFor`, so a card is 1820 across and 208 down, and one of them fills
 * the strip end to end. 1536 of travel inside 209 of box, and a person
 * looking at one tile at a time.
 *
 * The band cannot ask the shelf how tall it would like to be — it is the
 * parent — so the shelf says when it has something open, on the same
 * pattern as the timeline's tab, and the band answers with a height.
 */
let shelfOpen = false;
const shelfWatchers = new Set<() => void>();
function setShelfOpen(v: boolean) {
  if (shelfOpen === v) return;
  shelfOpen = v;
  shelfWatchers.forEach((w) => w());
}
/** True while at least one category is open on the parts shelf. */
export function useShelfOpen(): boolean {
  return React.useSyncExternalStore(
    (w) => { shelfWatchers.add(w); return () => { shelfWatchers.delete(w); }; },
    () => shelfOpen,
    () => false,
  );
}

export function Palette() {
  const [query, setQuery] = React.useState("");
  /*
   * Which categories are open, and never more than two.
   *
   * It used to be one `cat`, and choosing it took the whole shelf: the row of
   * planets vanished and was replaced by that category's parts, so comparing
   * a hero against a text block meant going back and starting again. They are
   * merged now — the planets stay where they are and a category opens
   * *underneath* them, in the flow, with a second one stacking below the
   * first. A third pushes the oldest out, because three open categories in a
   * 248px band is a list you scroll rather than a shelf you read.
   */
  const [open, setOpen] = React.useState<CategoryId[]>([]);
  /* The band outside needs to know, and a state set during render is not a
     thing to notify from — so it is told after the paint that follows. */
  React.useEffect(() => { setShelfOpen(open.length > 0); }, [open]);
  React.useEffect(() => () => setShelfOpen(false), []);
  const [showRemoved, setShowRemoved] = React.useState(false);
  const toggleCat = React.useCallback((id: CategoryId) => {
    play("select");
    setOpen((was) => (was.includes(id) ? was.filter((c) => c !== id) : [...was, id].slice(-OPEN_AT_MOST)));
  }, []);

  const hidden = useStudio(useShallow((s) => s.hiddenFeatures));
  const hiddenSet = React.useMemo(() => new Set(hidden), [hidden]);
  const searching = query.trim().length > 0;

  const all = React.useMemo(() => searchFeatures(query), [query]);
  const live = React.useMemo(() => all.filter((f) => !hiddenSet.has(f.id)), [all, hiddenSet]);

  const categories = React.useMemo(
    () => CATEGORIES.filter((c) => live.some((f) => f.category === c.id)),
    [live],
  );
  const removed = showRemoved ? all.filter((f) => hiddenSet.has(f.id)) : [];

  /* Searching is the one view that is not the accordion: a name typed in
     crosses every category, so the results are one flat list of bands. */
  const found = React.useMemo(() => (searching ? groupIntoBands(live) : []), [searching, live]);

  // One measurement for the shelf: previews are real components, so they need
  // a pixel width, and three columns of it is what a page's middle looks like.
  const shelfRef = React.useRef<HTMLDivElement>(null);
  const [shelfW, setShelfW] = React.useState(900);
  React.useEffect(() => {
    const el = shelfRef.current;
    if (!el) return;
    const measure = () => setShelfW(Math.max(320, el.clientWidth - 24));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // How wide a part is drawn: as much of the shelf as it would take of a page.
  // Full-width parts get the row to themselves; the rest sit two, three or
  // four across with a thin gap, because a preview you cannot read is not a
  // preview. The height cap follows, so a wide part is also a tall one.
  const GAP = 10;
  const sizeFor = React.useCallback((f: FeatureDef) => {
    const span = spanOf(f);
    const per = span >= 12 ? 1 : span >= 6 ? 2 : span >= 4 ? 3 : 4;
    const width = Math.max(150, Math.floor((shelfW - GAP * (per - 1)) / per));
    const wide = (f.w ?? 420) / (f.h ?? 88) >= 5;
    return { width, tall: per === 1 ? (wide ? 118 : 208) : per === 2 ? 208 : 168 };
  }, [shelfW]);

  // The field the previews float on: the surface's complement, dimmed, so a
  // surface-coloured part separates from it without needing a border.
  const format = useStudio((st) => st.format);
  const look = useStudio((st) => st.look);
  const behind = React.useMemo(() => {
    const surface = parseColor(resolvePalette(format, look).surface);
    if (!surface) return "oklch(0.14 0.01 260)";
    return css({ l: Math.max(0.11, surface.l * 0.62), c: Math.min(0.07, surface.c + 0.03), h: (surface.h + 180) % 360 });
  }, [format, look]);

  return (
    <div data-drawer="" className="relative flex h-full flex-col border-t border-border bg-panel/50">
      {/*
        The search, across the whole shelf and on a screen of its own.
        
        It was a hundred and sixty pixels of dark box at the end of a dark
        row, which is how you build a search field nobody can find. Anywhere
        words are typed in this app is a screen — teal glass, scanlines,
        phosphor lettering, the same as the command palette's field — so this
        is the one colour on the shelf that is not the shelf, and it is as
        wide as the thing it searches.
      */}
      <div data-parts-search="" className="shrink-0 px-2 pt-2">
        <div className="relative flex items-center gap-2 rounded-md px-2.5 py-1.5" style={{ ...screenFace, color: SCREEN.ink }}>
          <Search className="size-4 shrink-0" style={{ color: SCREEN.dim }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search parts"
            placeholder="Search parts…"
            className="min-w-0 flex-1 bg-transparent font-mono text-[12px] tracking-tight outline-none placeholder:opacity-45"
            style={{ color: SCREEN.ink }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear the search"
              className="tactile shrink-0 rounded-sm p-0.5"
              style={{ color: SCREEN.dim }}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* --------------------------------------- only what is not a category */}
      <div className={cn("flex shrink-0 items-center gap-2 px-3", hidden.length ? "border-b border-border py-1.5" : "h-0 overflow-hidden")}>
        <span className="ml-auto" />
        {hidden.length ? (
          <button
            type="button"
            onClick={() => { play("select"); setShowRemoved((v) => !v); }}
            aria-pressed={showRemoved}
            className="tactile flex shrink-0 items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] text-fg-muted hover:bg-hover hover:text-fg"
          >
            <EyeOff className="size-3" />
            {hidden.length} removed
          </button>
        ) : null}
      </div>

      {/* ------------------------------------------------ the parts */}
      <div className="relative min-h-0 flex-1" style={{ background: behind }}>
        {/*
          One scroller for the whole shelf, and nothing inside it scrolls.

          Not a correction of a nested scroller — there never was one, and an
          earlier version of this comment said there was. What there was: a
          fixed crumb row with a 173px box of cards scrolling beneath it, so
          the elements moved while the header sat still and the thing read as
          a box scrolling inside a box. The planets, the open categories and
          their parts are all in this one flow now, and a section's header
          pins with `sticky` rather than being a separate fixed row, so one
          wheel moves everything and the pointer never has to be anywhere in
          particular.
        */}
        <div ref={shelfRef} data-shelf=""
          /* `overscroll-y-contain` so the wheel stops here. Without it the
             gesture chained: eight notches over an open category took the
             shelf to its end and then carried the site up behind it, the
             pane going 261 to 635 under a pointer that never left the
             shelf. Two scroll regions that never push each other is the
             rule; this is the half of it the shelf owns. */
          className="no-bars relative z-[1] h-full overflow-y-auto overflow-x-hidden overscroll-y-contain">
        {searching ? (
          found.length ? (
            <div className="relative z-[1] px-3 py-3">
              {found.map(({ band, items }) => (
                <Band key={band} title={BAND_LABEL[band]}>
                  <div className="flex flex-wrap items-start" style={{ gap: GAP }}>
                    {items.map((f) => {
                      const { width, tall } = sizeFor(f);
                      return <Card key={f.id} feature={f} width={width} tall={tall} />;
                    })}
                  </div>
                </Band>
              ))}
              <div className="h-10" />
            </div>
          ) : (
            <div className="relative z-[1] flex h-full items-center justify-center px-6 text-center text-[11px] text-fg-muted">
              Nothing by that name. Drop a <span className="text-accent">&nbsp;New idea&nbsp;</span> and describe it.
            </div>
          )
        ) : (
          <>
            {/*
              The planets stay put.

              Choosing one used to remove them all, which is what made this a
              drill-down rather than a shelf. They are the way in and they are
              also the way to the *second* thing you want to look at, so they
              do not go anywhere; the one you have open is simply lit.
            */}
            <div className="relative z-[1] flex flex-wrap justify-center gap-x-3 gap-y-2 px-4 py-3">
              {[...categories].map((c) => {
                const isOpen = open.includes(c.id);
                return (
                  <Tooltip key={c.id} content={c.blurb} side="top">
                    <button
                      type="button"
                      data-category={c.id}
                      aria-expanded={isOpen}
                      onClick={() => toggleCat(c.id)}
                      className="group/cat tactile flex w-[86px] shrink-0 flex-col items-center gap-1"
                      style={{ color: `oklch(0.84 0.13 ${c.hue})` }}
                    >
                      <span
                        className="flex size-[52px] items-center justify-center rounded-full transition-[box-shadow,transform] duration-150 group-hover/cat:-translate-y-0.5 group-hover/cat:shadow-[var(--lit)]"
                        style={{
                          // The disc carries the colour, so it has to have
                          // some: at a chroma of 0.045 every one of these was
                          // black with a rumour of a hue in it, and the row
                          // read as thirteen identical circles.
                          background: `oklch(0.22 0.1 ${c.hue} / ${isOpen ? 0.85 : 0.6})`,
                          // Under the hand it lifts and its rim brightens; open,
                          // it stays lit. It does not change colour: the colour
                          // is what says which kind of part this is.
                          boxShadow: isOpen
                            ? `inset 0 0 0 1.5px oklch(0.8 0.17 ${c.hue}), 0 3px 12px oklch(0.5 0.14 ${c.hue} / 0.4)`
                            : `inset 0 0 0 1px oklch(0.62 0.14 ${c.hue} / 0.42), 0 1px 0 oklch(0 0 0 / 0.5)`,
                          "--lit": `inset 0 0 0 1.5px oklch(0.78 0.16 ${c.hue} / 0.85), 0 3px 12px oklch(0.5 0.14 ${c.hue} / 0.35)`,
                        } as React.CSSProperties}
                      >
                        {React.createElement(PLANET[c.id], { size: 38 })}
                      </span>
                      <span className="text-center text-[10px] leading-tight">{c.label}</span>
                      <span className="num text-[9px] text-fg-faint">{live.filter((f) => f.category === c.id).length}</span>
                    </button>
                  </Tooltip>
                );
              })}
              {/*
                And one that is not a kind of part: something the library does
                not have, which you describe yourself. Same shape as the rest,
                drawn in a dashed rim so it reads as an opening rather than a
                thing.
              */}
              <Tooltip content="Something the library has not got: describe it and place it" side="top">
                <button
                  type="button"
                  data-category="custom-idea"
                  onClick={() => addFeatureToCanvas("custom-idea")}
                  className="group/cat tactile flex w-[86px] shrink-0 flex-col items-center gap-1 text-accent"
                >
                  <span
                    className="flex size-[52px] items-center justify-center rounded-full border border-dashed border-accent/55 transition-[box-shadow,transform] duration-150 group-hover/cat:-translate-y-0.5 group-hover/cat:shadow-[0_3px_12px_var(--accent-soft)]"
                    style={{ background: "oklch(0.2 0.04 265 / 0.45)" }}
                  >
                    <Sparkles className="size-[30px]" />
                  </span>
                  <span className="text-center text-[10px] leading-tight">New idea</span>
                  <span className="num text-[9px] text-fg-faint">yours</span>
                </button>
              </Tooltip>
            </div>

            {/* The open ones, stacked, in the catalogue's order so that
                opening a second never shuffles the first out from under the
                pointer. */}
            {CATEGORIES.filter((c) => open.includes(c.id)).map((c) => (
              <CategorySection
                key={c.id}
                category={c}
                live={live}
                sizeFor={sizeFor}
                gap={GAP}
                onClose={() => toggleCat(c.id)}
              />
            ))}

            {removed.length ? (
              <div className="relative z-[1] px-3 pb-3">
                <Band title="Removed">
                  <div className="flex flex-wrap items-start" style={{ gap: GAP }}>
                    {removed.map((f) => <Card key={f.id} feature={f} width={sizeFor(f).width} tall={72} removed />)}
                  </div>
                </Band>
              </div>
            ) : null}

            {open.length || removed.length ? <div className="h-10" /> : null}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

/**
 * One open category, stacked under the planets.
 *
 * Its own header so you can tell where one ends and the next begins, its
 * sub-groups as a filter rather than a second drill level, and its parts in
 * the flow — no scroller of its own, so the shelf's single scroller is the
 * only thing the wheel talks to.
 */
function CategorySection({
  category, live, sizeFor, gap, onClose,
}: {
  category: (typeof CATEGORIES)[number];
  live: FeatureDef[];
  sizeFor: (f: FeatureDef) => { width: number; tall: number };
  gap: number;
  onClose: () => void;
}) {
  const [sub, setSub] = React.useState<string | null>(null);
  /* Opening one brings it into view.
     The planets fill the shelf's own box on their own, so a section that
     opens underneath them opens off the bottom of it, and pressing a planet
     looked like pressing a dead button. It mounts when it opens, so mounting
     is exactly the moment to scroll — and only the new one moves, because
     the one already open never remounts.

     The SHELF is scrolled, by hand, and not `scrollIntoView`. That scrolls
     every scrollable ancestor, so opening a category took the pane with it:
     measured at 2048×1152, the pane went from 0 to 261 and the site jumped
     upward on its own the moment a planet was pressed. Two scroll regions
     that never push each other is the rule, and this was the shelf pushing
     the site. */
  const box = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const el = box.current;
    const shelf = el?.closest("[data-shelf]");
    if (!el || !(shelf instanceof HTMLElement)) return;
    const to = el.getBoundingClientRect().top - shelf.getBoundingClientRect().top + shelf.scrollTop;
    shelf.scrollTo({ top: Math.max(0, Math.round(to)), behavior: "smooth" });
  }, []);
  const subs = React.useMemo(
    () => (SUBGROUPS[category.id] ?? []).filter((g) => g.ids.some((id) => live.some((f) => f.id === id))),
    [category.id, live],
  );
  const shown = React.useMemo(() => {
    const group = subs.find((g) => g.id === sub);
    const ids = group ? group.ids : subs.flatMap((g) => g.ids);
    return ids.map((id) => live.find((f) => f.id === id)).filter((f): f is FeatureDef => !!f);
  }, [live, sub, subs]);
  const bands = React.useMemo(() => groupIntoBands(shown), [shown]);

  return (
    <section ref={box} data-category-open={category.id} className="relative z-[1] border-t border-border/70">
      <div
        className="sticky top-0 z-[2] flex items-center gap-2 px-3 py-1.5 backdrop-blur-sm"
        style={{ background: `oklch(0.16 0.03 ${category.hue} / 0.9)` }}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: `oklch(0.86 0.12 ${category.hue})` }}>
          {React.createElement(PLANET[category.id], { size: 14 })}
          {category.label}
        </span>
        <div className="hide-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {subs.map((g) => {
            const on = sub === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => { play("select"); setSub(on ? null : g.id); }}
                aria-pressed={on}
                className="tactile flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: on ? `oklch(0.78 0.17 ${category.hue})` : `oklch(0.72 0.15 ${category.hue} / 0.16)`,
                  color: on ? "oklch(0.16 0.04 0)" : `oklch(0.86 0.12 ${category.hue})`,
                  boxShadow: `inset 0 0 0 1px oklch(0.72 0.15 ${category.hue} / 0.4)`,
                }}
              >
                {React.createElement(moonFor(g.id), { size: 12 })}
                <span className="whitespace-nowrap">{g.label}</span>
                <span className="num text-[9px] opacity-60">{g.ids.filter((id) => live.some((f) => f.id === id)).length}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${category.label}`}
          className="tactile shrink-0 rounded-sm p-0.5 text-fg-muted hover:bg-hover hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="px-3 py-2">
        {bands.map(({ band, items }) => (
          <Band key={band} title={BAND_LABEL[band]}>
            {/* items-start, or a flex line makes every card as tall as the
                tallest one in it, and the stretched-out part of a short
                card is empty space with the fire showing through it. */}
            <div className="flex flex-wrap items-start" style={{ gap }}>
              {items.map((f) => {
                const { width, tall } = sizeFor(f);
                return <Card key={f.id} feature={f} width={width} tall={tall} />;
              })}
            </div>
          </Band>
        ))}
      </div>
    </section>
  );
}

function Band({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 last:mb-0">
      <div className="mb-2 flex items-center gap-2">
        <span className="shrink-0 text-[9px] uppercase tracking-wider text-fg-faint">{title}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  );
}
