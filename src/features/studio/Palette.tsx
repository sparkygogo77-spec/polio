"use client";
/**
 * The parts shelf, under the board.
 *
 * You walk in from the top: a row of planets, one per category. Pick one and
 * it becomes a crumb with its sub-groups beside it; pick one of those and the
 * list gets out of the way entirely, leaving the parts themselves.
 *
 * The parts are laid out the way a page is. Anything that spans the page —
 * headers, footers, hero bands — is stacked in rows across the top. Everything
 * else goes into three columns underneath, spaced apart so nothing touches.
 * Nothing is in a box: each preview is lit by a blue flame rising from below
 * it, which is what separates it from the shelf without drawing a border.
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
import { spanOf } from "./showcase";
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

function Card({ feature, width, tall = 96, removed }: { feature: FeatureDef; width: number; tall?: number; removed?: boolean }) {
  const [dragging, setDragging] = React.useState(false);
  const height = Math.max(36, Math.min(tall, previewHeight(feature, width)));

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
        {/* The flame: a steady bed and two tongues, fed brighter when reached for. */}
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

function Crumb({ hue, children, onClear, label }: { hue: number; children: React.ReactNode; onClear: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={`Back from ${label}`}
      onClick={() => { play("close"); onClear(); }}
      className="tactile flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
      style={{ borderColor: `oklch(0.72 0.16 ${hue} / 0.6)`, background: `oklch(0.72 0.16 ${hue} / 0.14)`, color: `oklch(0.84 0.13 ${hue})` }}
    >
      {children}
      <X className="size-3 opacity-70" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* The shelf                                                           */
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
  const chosenSub = subs.find((g) => g.id === sub) ?? null;

  // Across the page means wide *and* short — a header, a footer, a ticker. A
  // part that is as tall as a page is page-shaped, so it goes in the columns
  // where its proportions still read.
  const isBand = (f: FeatureDef) => spanOf(f) >= 12 && (f.w ?? 420) / (f.h ?? 88) >= 5;
  const across = React.useMemo(() => shown.filter(isBand), [shown]);
  const columns = React.useMemo(() => shown.filter((f) => !isBand(f)), [shown]);

  // One measurement for the shelf: previews are real components, so they need
  // a pixel width, and three columns of it is what a page's middle looks like.
  const shelfRef = React.useRef<HTMLDivElement>(null);
  const [shelfW, setShelfW] = React.useState(900);
  React.useEffect(() => {
    const el = shelfRef.current;
    if (!el) return;
    const measure = () => setShelfW(Math.max(320, el.clientWidth - 32));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const GAP = 16;
  const columnWidth = Math.round((shelfW - GAP * 2) / 3);

  return (
    <div data-drawer="" className="relative flex h-[264px] shrink-0 flex-col border-t border-border bg-panel/50">
      {/* ------------------------------------------------ where you are */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
        {chosen ? (
          <Crumb hue={chosen.hue} label={chosen.label} onClear={() => { setCat(null); setSub(null); }}>
            {React.createElement(PLANET[chosen.id], { size: 14 })}
            {chosen.label}
          </Crumb>
        ) : null}
        {chosenSub ? (
          <>
            <span aria-hidden className="shrink-0 text-fg-faint">›</span>
            <Crumb hue={chosen?.hue ?? 265} label={chosenSub.label} onClear={() => setSub(null)}>
              {chosenSub.label}
            </Crumb>
          </>
        ) : null}

        <div className="hide-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {chosen && !chosenSub
            ? subs.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { play("select"); setSub(g.id); }}
                  className="tactile flex shrink-0 items-center gap-1 rounded-full border border-transparent px-2 py-1 text-[11px] text-fg-muted hover:border-border hover:text-fg"
                >
                  <span className="whitespace-nowrap">{g.label}</span>
                  <span className="num text-[9px] opacity-60">{g.ids.filter((id) => live.some((f) => f.id === id)).length}</span>
                </button>
              ))
            : null}
        </div>

        <div className="w-40 shrink-0">
          <Input
            inputSize="sm"
            left={<Search />}
            placeholder="Search parts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search parts"
          />
        </div>
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
        <button
          type="button"
          onClick={() => addFeatureToCanvas("custom-idea")}
          className="tactile flex shrink-0 items-center gap-1 rounded-sm border border-dashed border-accent/50 px-1.5 py-0.5 text-[10px] text-accent hover:bg-accent-soft"
        >
          <Sparkles className="size-3" />
          New idea
        </button>
      </div>

      {/* ------------------------------------------------ the parts */}
      <div ref={shelfRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {!chosen && !searching ? (
          // Fourteen planets, all of them on screen, one per kind of part.
          <div className="grid grid-cols-7 gap-2 p-4">
            {categories.map((c) => (
              <Tooltip key={c.id} content={c.blurb} side="top">
                <button
                  type="button"
                  onClick={() => { play("select"); setCat(c.id); setSub(null); }}
                  className="tactile flex flex-col items-center gap-1.5 rounded-lg border border-transparent px-2 py-3 hover:border-border hover:bg-hover"
                  style={{ color: `oklch(0.82 0.13 ${c.hue})` }}
                >
                  {React.createElement(PLANET[c.id], { size: 26 })}
                  <span className="text-center text-[10px] leading-tight">{c.label}</span>
                  <span className="num text-[9px] text-fg-faint">{live.filter((f) => f.category === c.id).length}</span>
                </button>
              </Tooltip>
            ))}
          </div>
        ) : shown.length || removed.length ? (
          <div className="px-4 py-3">
            {across.length ? (
              <Band title="Across the page">
                <div className="flex flex-col gap-3">
                  {across.map((f) => <Card key={f.id} feature={f} width={shelfW} tall={58} />)}
                </div>
              </Band>
            ) : null}
            {columns.length ? (
              <Band title="In the middle">
                <div className="flex flex-wrap justify-center gap-4">
                  {columns.map((f) => <Card key={f.id} feature={f} width={columnWidth} />)}
                </div>
              </Band>
            ) : null}
            {removed.length ? (
              <Band title="Removed">
                <div className="flex flex-wrap justify-center gap-4">
                  {removed.map((f) => <Card key={f.id} feature={f} width={columnWidth} removed />)}
                </div>
              </Band>
            ) : null}
            {/* A little room past the last thing, so nothing sits on the edge. */}
            <div className="h-6" />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-[11px] text-fg-muted">
            {searching
              ? <>Nothing by that name. Drop a <span className="text-accent">New idea</span> and describe it.</>
              : "Everything here is removed."}
          </div>
        )}
      </div>
    </div>
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
