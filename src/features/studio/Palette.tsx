"use client";
/**
 * The parts drawer, under the board.
 *
 * Three steps, never more: a vertical list of categories, each with its own
 * colour and emoji → pick one and the rest slide away while it rises to the top
 * → its sub-groups appear beside it → the parts appear on a shelf laid out the
 * way a page is: navigation across the top, the search box centred under it,
 * grids filling the body, the footer last. Clicking the category or the
 * sub-group chip walks back.
 *
 * The shelf can be dragged taller by its top edge when you want to browse, and
 * pushed back down when you want the board. Each preview is lit rather than boxed. A low, blotchy red ember sits under it
 * and never quite settles; reaching for one flares it blue and letting go takes
 * 0.7s to cool. Nothing here is interactive — every preview is `inert` — so a
 * part only comes alive once it is on the board.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { EyeOff, RotateCcw, Search, Sparkles, X } from "lucide-react";
import {
  CATEGORIES, CATEGORY_EMOJI, SUBGROUPS, categoryOf, getFeature, searchFeatures,
  type CategoryId, type FeatureDef,
} from "./catalog";
import { useStudio } from "./store";
import { PartPreview, previewHeight } from "./PartPreview";
import { BAND_LABEL, groupIntoBands, spanOf } from "./showcase";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { Input } from "@/core/ui/input";
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

function Card({ feature, width, removed }: { feature: FeatureDef; width: number; removed?: boolean }) {
  const [dragging, setDragging] = React.useState(false);
  // The preview keeps the part's own proportions and is fitted, not cropped.
  const height = Math.max(44, Math.min(96, previewHeight(feature, width - 8)));

  if (removed) {
    return (
      <Tooltip content={`${feature.explain ?? feature.blurb} — removed`} side="top">
        <button
          type="button"
          {...ctxProps("studio-palette", feature.id, feature)}
          onClick={() => { play("confirm"); useStudio.getState().restoreFeature(feature.id); }}
          style={{ width }}
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
        {/* The lighting. Two coals on different clocks, and the blue it flares to. */}
        <span aria-hidden className="ember-light">
          <i className="ember-coal-a" />
          <i className="ember-coal-b" />
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
          className="tactile flex cursor-pointer flex-col gap-1 rounded-md p-1 outline-none"
        >
          <PartPreview feature={feature} width={width - 8} height={height} />
          <span className="line-clamp-1 px-0.5 text-[10px] leading-tight text-fg-muted group-hover:text-fg">{feature.name}</span>
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
/* The drawer                                                          */
/* ------------------------------------------------------------------ */

export function Palette() {
  const [query, setQuery] = React.useState("");
  const [cat, setCat] = React.useState<CategoryId | null>(null);
  const [sub, setSub] = React.useState<string | null>(null);
  const [showRemoved, setShowRemoved] = React.useState(false);

  const hidden = useStudio(useShallow((s) => s.hiddenFeatures));
  const hiddenSet = React.useMemo(() => new Set(hidden), [hidden]);
  const searching = query.trim().length > 0;

  const all = React.useMemo(() => searchFeatures(query), [query]);
  const live = React.useMemo(() => all.filter((f) => !hiddenSet.has(f.id)), [all, hiddenSet]);

  const categories = React.useMemo(
    () => CATEGORIES.filter((c) => live.some((f) => f.category === c.id)),
    [live],
  );
  const subs = React.useMemo(() => {
    if (!cat) return [];
    return (SUBGROUPS[cat] ?? []).filter((g) => g.ids.some((id) => live.some((f) => f.id === id)));
  }, [cat, live]);

  const shown = React.useMemo(() => {
    if (searching) return live;
    if (!cat) return [];
    const group = subs.find((g) => g.id === sub);
    const ids = group ? group.ids : subs.flatMap((g) => g.ids);
    return ids.map((id) => live.find((f) => f.id === id)).filter((f): f is FeatureDef => !!f);
  }, [searching, live, cat, sub, subs]);

  const removed = showRemoved ? all.filter((f) => hiddenSet.has(f.id)) : [];
  const chosen = cat ? CATEGORIES.find((c) => c.id === cat) : null;

  const pickCat = (id: CategoryId) => {
    play("select");
    setCat(id);
    setSub(null);
  };

  // One measurement for the whole shelf: the previews are real components, so
  // they need a pixel width, and twelve columns of it is the page's own grid.
  const shelfRef = React.useRef<HTMLDivElement>(null);
  const [shelfW, setShelfW] = React.useState(880);
  React.useEffect(() => {
    const el = shelfRef.current;
    if (!el) return;
    const measure = () => setShelfW(Math.max(320, el.clientWidth - 24));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The shelf borrows height from the board, so it gives it back on request.
  const [height, setHeight] = React.useState(232);
  const dragFrom = React.useRef<{ y: number; h: number } | null>(null);
  React.useEffect(() => {
    const move = (e: PointerEvent) => {
      const from = dragFrom.current;
      if (!from) return;
      setHeight(Math.max(140, Math.min(520, from.h + (from.y - e.clientY))));
    };
    const up = () => { dragFrom.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  const GAP = 8;
  const column = (shelfW - GAP * 11) / 12;
  const cardWidth = (span: number) => Math.max(104, Math.round(column * span + GAP * (span - 1)));

  const bands = React.useMemo(() => groupIntoBands(shown), [shown]);

  return (
    <div data-drawer="" style={{ height }} className="relative flex shrink-0 border-t border-border bg-panel/50">
      {/* Drag the top edge to trade board for shelf. */}
      <div
        role="separator"
        aria-label="Shelf height"
        aria-orientation="horizontal"
        aria-valuenow={height}
        tabIndex={0}
        onPointerDown={(e) => { dragFrom.current = { y: e.clientY, h: height }; }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") setHeight((v) => Math.min(520, v + 24));
          if (e.key === "ArrowDown") setHeight((v) => Math.max(140, v - 24));
        }}
        className="absolute inset-x-0 -top-1 z-10 h-2 cursor-ns-resize"
      />
      {/* ------------------------------------------------ categories */}
      <div className="flex w-[168px] shrink-0 flex-col border-r border-border">
        <div className="shrink-0 p-2">
          <Input
            inputSize="sm"
            left={<Search />}
            placeholder="Search parts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search parts"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {chosen ? (
            // The chosen one rises to the top; clicking it walks back.
            <button
              type="button"
              onClick={() => { play("close"); setCat(null); setSub(null); }}
              aria-label={`Back from ${chosen.label}`}
              className="tactile flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left"
              style={{ borderColor: `oklch(0.72 0.14 ${chosen.hue} / 0.55)`, background: `oklch(0.72 0.14 ${chosen.hue} / 0.14)` }}
            >
              <span className="text-base leading-none">{CATEGORY_EMOJI[chosen.id]}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-fg">{chosen.label}</span>
              <X className="size-3 shrink-0 text-fg-muted" />
            </button>
          ) : (
            <div className="space-y-0.5">
              {categories.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickCat(c.id)}
                  className="tactile flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-hover"
                  style={{ animation: `slide-up var(--motion-base) ease-out both`, animationDelay: `${i * 14}ms` }}
                >
                  <span className="text-base leading-none">{CATEGORY_EMOJI[c.id]}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">{c.label}</span>
                  <span className="num text-[9px] text-fg-faint">{live.filter((f) => f.category === c.id).length}</span>
                </button>
              ))}
            </div>
          )}

          {/* sub-groups, beside the chosen category */}
          {chosen ? (
            <div className="mt-1.5 space-y-0.5 border-l border-border pl-1.5">
              {subs.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { play("select"); setSub(sub === g.id ? null : g.id); }}
                  aria-pressed={sub === g.id}
                  className={cn(
                    "tactile flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[10px]",
                    sub === g.id ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
                  )}
                  style={{ animation: "slide-in-right var(--motion-base) ease-out both", animationDelay: `${i * 20}ms` }}
                >
                  <span className="text-[13px] leading-none">{g.emoji}</span>
                  <span className="min-w-0 flex-1 truncate">{g.label}</span>
                  <span className="num text-[9px] text-fg-faint">{g.ids.filter((id) => live.some((f) => f.id === id)).length}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* ------------------------------------------------ the parts */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-[10px] text-fg-faint">
          <span className="min-w-0 flex-1 truncate">
            {searching
              ? `${live.length} match${live.length === 1 ? "" : "es"}`
              : chosen
                ? `${chosen.label}${sub ? ` · ${subs.find((g) => g.id === sub)?.label}` : ""} — ${shown.length} part${shown.length === 1 ? "" : "s"}`
                : "Pick a category to see what is in it"}
          </span>
          {hidden.length ? (
            <button
              type="button"
              onClick={() => { play("select"); setShowRemoved((v) => !v); }}
              aria-pressed={showRemoved}
              className="tactile flex items-center gap-1 rounded-sm px-1 py-0.5 text-fg-muted hover:bg-hover hover:text-fg"
            >
              <EyeOff className="size-3" />
              {hidden.length} removed
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => addFeatureToCanvas("custom-idea")}
            className="tactile flex items-center gap-1 rounded-sm border border-dashed border-accent/50 px-1.5 py-0.5 text-accent hover:bg-accent-soft"
          >
            <Sparkles className="size-3" />
            New idea
          </button>
        </div>

        <div ref={shelfRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {shown.length || removed.length ? (
            <div className="space-y-2 px-3 py-2">
              {bands.map(({ band, items }) => (
                <section key={band}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="shrink-0 text-[9px] uppercase tracking-wider text-fg-faint">{BAND_LABEL[band]}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {items.map((f) => <Card key={f.id} feature={f} width={cardWidth(spanOf(f))} />)}
                  </div>
                </section>
              ))}
              {removed.length ? (
                <section>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="shrink-0 text-[9px] uppercase tracking-wider text-fg-faint">Removed</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {removed.map((f) => <Card key={f.id} feature={f} width={cardWidth(3)} removed />)}
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-[11px] text-fg-muted">
              {searching
                ? <>Nothing by that name. Drop a <span className="text-accent">New idea</span> and describe it.</>
                : chosen
                  ? "Everything here is removed."
                  : "Fourteen categories on the left. Pick one and its parts appear here."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
