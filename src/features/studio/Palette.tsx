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

function Crumb({ hue, children, onClear, label }: { hue: number; children: React.ReactNode; onClear: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={`Back from ${label}`}
      onClick={() => { play("close"); onClear(); }}
      className="tactile flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      // Where you are is solid and the writing on it is black. A tinted wash
      // behind coloured text is the one combination that fails in both themes
      // at once: too faint to see on the dark one, too pale to read on the
      // light one, and never distinguishable from the places you are not.
      style={{
        background: `oklch(0.78 0.17 ${hue})`,
        color: "oklch(0.16 0.04 0)",
        boxShadow: `inset 0 1px 0 oklch(1 0 0 / 0.35), inset 0 -1px 0 oklch(0 0 0 / 0.28), 0 0 12px oklch(0.78 0.17 ${hue} / 0.35)`,
      }}
    >
      {children}
      <X className="size-3 opacity-80" />
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

  // In the order a page reads: what goes across the top, then the first
  // screen, the body, further down, the foot.
  const bands = React.useMemo(() => groupIntoBands(shown), [shown]);

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
              {React.createElement(moonFor(chosenSub.id), { size: 13 })}
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
                  className="tactile group/sub flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium"
                  style={{
                    background: `oklch(0.72 0.15 ${chosen?.hue ?? 265} / 0.16)`,
                    color: `oklch(0.86 0.12 ${chosen?.hue ?? 265})`,
                    boxShadow: `inset 0 0 0 1px oklch(0.72 0.15 ${chosen?.hue ?? 265} / 0.4)`,
                  }}
                  onPointerEnter={(e) => {
                    e.currentTarget.style.background = `oklch(0.78 0.17 ${chosen?.hue ?? 265})`;
                    e.currentTarget.style.color = "oklch(0.16 0.04 0)";
                  }}
                  onPointerLeave={(e) => {
                    e.currentTarget.style.background = `oklch(0.72 0.15 ${chosen?.hue ?? 265} / 0.16)`;
                    e.currentTarget.style.color = `oklch(0.86 0.12 ${chosen?.hue ?? 265})`;
                  }}
                >
                  {React.createElement(moonFor(g.id), { size: 13 })}
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
      <div className="relative min-h-0 flex-1" style={{ background: behind }}>
        <div ref={shelfRef} className="relative z-[1] h-full overflow-y-auto overflow-x-hidden">
        {!chosen && !searching ? (
          // Fourteen planets, all of them on screen, one per kind of part.
          <div className="relative z-[1] grid grid-cols-7 gap-2 p-4">
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
          <div className="relative z-[1] px-3 py-3">
            {bands.map(({ band, items }) => (
              <Band key={band} title={BAND_LABEL[band]}>
                {/* items-start, or a flex line makes every card as tall as the
                    tallest one in it, and the stretched-out part of a short
                    card is empty space with the fire showing through it. */}
                <div className="flex flex-wrap items-start" style={{ gap: GAP }}>
                  {items.map((f) => {
                    const { width, tall } = sizeFor(f);
                    return <Card key={f.id} feature={f} width={width} tall={tall} />;
                  })}
                </div>
              </Band>
            ))}
            {removed.length ? (
              <Band title="Removed">
                <div className="flex flex-wrap items-start" style={{ gap: GAP }}>
                  {removed.map((f) => <Card key={f.id} feature={f} width={sizeFor(f).width} tall={72} removed />)}
                </div>
              </Band>
            ) : null}
            {/* A little room past the last thing, so nothing sits on the edge. */}
            <div className="h-10" />
          </div>
        ) : (
          <div className="relative z-[1] flex h-full items-center justify-center px-6 text-center text-[11px] text-fg-muted">
            {searching
              ? <>Nothing by that name. Drop a <span className="text-accent">New idea</span> and describe it.</>
              : "Everything here is removed."}
          </div>
          )}
        </div>
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
