"use client";
/**
 * The parts drawer, under the board.
 *
 * Three steps, never more: a vertical list of categories, each with its own
 * colour and emoji → pick one and the rest slide away while it rises to the top
 * → its sub-groups appear beside it → the parts themselves scroll across as
 * live previews, each on a contrasting disc so you can see where the part ends
 * and the panel begins. Clicking the category or the sub-group chip walks back.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { EyeOff, RotateCcw, Search, Sparkles, X } from "lucide-react";
import {
  CATEGORIES, CATEGORY_EMOJI, SUBGROUPS, categoryOf, getFeature, searchFeatures,
  type CategoryId, type FeatureDef,
} from "./catalog";
import { useStudio } from "./store";
import { PartPreview } from "./PartPreview";
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

function Card({ feature, removed }: { feature: FeatureDef; removed?: boolean }) {
  const cat = categoryOf(feature.category);
  const ring = `oklch(0.72 0.14 ${cat.hue})`;

  if (removed) {
    return (
      <Tooltip content={`${feature.explain ?? feature.blurb} — removed`} side="top">
        <button
          type="button"
          {...ctxProps("studio-palette", feature.id, feature)}
          onClick={() => { play("confirm"); useStudio.getState().restoreFeature(feature.id); }}
          className="tactile flex w-[132px] shrink-0 flex-col items-center gap-1 rounded-lg border border-dashed border-border p-2 opacity-45 hover:opacity-100"
        >
          <span className="flex size-[92px] items-center justify-center rounded-full border border-border text-fg-faint">
            <RotateCcw className="size-4" />
          </span>
          <span className="line-clamp-2 min-h-[24px] text-center text-[10px] leading-tight text-fg-muted">{feature.name}</span>
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={feature.explain ?? feature.blurb} side="top">
      <div className="group relative w-[132px] shrink-0">
        <div
          role="button"
          tabIndex={0}
          draggable
          {...ctxProps("studio-palette", feature.id, feature)}
          onDragStart={(e) => {
            e.dataTransfer.setData("application/x-studio-feature", feature.id);
            e.dataTransfer.effectAllowed = "copy";
            play("tap");
          }}
          onClick={() => addFeatureToCanvas(feature.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              addFeatureToCanvas(feature.id);
            }
          }}
          className="tactile flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-transparent p-2 hover:border-border hover:bg-hover"
        >
          {/* A disc in the category's own colour, so the part reads as an object
              sitting on something rather than a rectangle on a rectangle. */}
          <span
            className="flex size-[92px] items-center justify-center rounded-full p-2.5"
            style={{ background: `oklch(0.72 0.14 ${cat.hue} / 0.16)`, boxShadow: `inset 0 0 0 1px oklch(0.72 0.14 ${cat.hue} / 0.4)` }}
          >
            <PartPreview feature={feature} width={70} height={70} round />
          </span>
          <span className="line-clamp-2 min-h-[24px] text-center text-[10px] leading-tight text-fg-muted group-hover:text-fg">{feature.name}</span>
        </div>
        <button
          type="button"
          aria-label={`Remove ${feature.name} from the library`}
          onClick={(e) => { e.stopPropagation(); play("deny"); useStudio.getState().hideFeature(feature.id); }}
          className="tactile absolute right-1 top-1 hidden rounded-sm p-0.5 text-fg-faint hover:bg-hover hover:text-fg group-hover:block"
          style={{ color: ring }}
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

  return (
    <div data-drawer="" className="flex h-[212px] shrink-0 border-t border-border bg-panel/50">
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

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          {shown.length || removed.length ? (
            <div className="flex h-full items-start gap-1 p-2">
              {shown.map((f) => <Card key={f.id} feature={f} />)}
              {removed.map((f) => <Card key={f.id} feature={f} removed />)}
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
