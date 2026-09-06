"use client";
/**
 * The library: every element the Builder knows, as visual tiles.
 *
 * Tiles are deliberately terse — an icon and a plain name. What the element
 * does lives in the tooltip and the right-click menu, so the panel reads as a
 * set of parts rather than a list of paragraphs. Drag a tile onto the board,
 * or click it to drop it in the middle.
 */
import * as React from "react";
import { EyeOff, PanelLeftClose, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { CATEGORIES, categoryOf, getFeature, searchFeatures, type CategoryId, type FeatureDef } from "./catalog";
import { useShallow } from "zustand/react/shallow";
import { useStudio } from "./store";
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

function Tile({ feature, removed }: { feature: FeatureDef; removed?: boolean }) {
  const Icon = feature.icon;
  const cat = categoryOf(feature.category);

  if (removed) {
    return (
      <Tooltip content={`${feature.blurb} — removed from the library`} side="right">
        <button
          type="button"
          {...ctxProps("studio-palette", feature.id, feature)}
          onClick={() => {
            play("confirm");
            useStudio.getState().restoreFeature(feature.id);
          }}
          className="tactile group flex h-[68px] w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-1 text-center opacity-45 hover:opacity-100"
        >
          <span className="flex size-7 items-center justify-center rounded-md text-fg-faint">
            <RotateCcw className="size-4" />
          </span>
          <span className="line-clamp-2 w-full text-[10px] leading-tight text-fg-muted">{feature.name}</span>
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={feature.blurb} side="right">
      <div className="group relative">
      <button
        type="button"
        draggable
        {...ctxProps("studio-palette", feature.id, feature)}
        onDragStart={(e) => {
          e.dataTransfer.setData("application/x-studio-feature", feature.id);
          e.dataTransfer.effectAllowed = "copy";
          play("tap");
        }}
        onClick={() => addFeatureToCanvas(feature.id)}
        className="tactile group flex h-[68px] w-full flex-col items-center justify-center gap-1.5 rounded-md border border-transparent px-1 text-center hover:border-border hover:bg-hover"
      >
        <span
          className="flex size-7 items-center justify-center rounded-md"
          style={{ background: `oklch(0.7 0.12 ${cat.hue} / 0.14)`, color: `oklch(0.78 0.13 ${cat.hue})` }}
        >
          <Icon className="size-4" />
        </span>
        <span className="line-clamp-2 w-full text-[10px] leading-tight text-fg-muted group-hover:text-fg">{feature.name}</span>
      </button>
      <button
        type="button"
        aria-label={`Remove ${feature.name} from the library`}
        onClick={(e) => {
          e.stopPropagation();
          play("deny");
          useStudio.getState().hideFeature(feature.id);
        }}
        className="tactile absolute right-0.5 top-0.5 hidden rounded-sm p-0.5 text-fg-faint hover:bg-hover hover:text-fg group-hover:block"
      >
        <X className="size-3" />
      </button>
      </div>
    </Tooltip>
  );
}

export function Palette({ onClose }: { onClose?: () => void }) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<CategoryId | "all">("all");
  const [showRemoved, setShowRemoved] = React.useState(false);
  const hidden = useStudio(useShallow((s) => s.hiddenFeatures));
  const hiddenSet = React.useMemo(() => new Set(hidden), [hidden]);
  const searching = query.trim().length > 0;
  const results = React.useMemo(() => searchFeatures(query), [query]);
  const inCategory = searching || category === "all" ? results : results.filter((f) => f.category === category);
  const shown = inCategory.filter((f) => !hiddenSet.has(f.id));
  const removed = showRemoved ? inCategory.filter((f) => hiddenSet.has(f.id)) : [];
  // A category nobody kept anything in stops taking up space.
  const liveCategories = CATEGORIES.filter((c) => results.some((f) => f.category === c.id && !hiddenSet.has(f.id)));

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border bg-panel/50">
      <div className="shrink-0 space-y-2 border-b border-border p-2">
        <div className="flex items-center gap-1">
          <Input
            className="min-w-0 flex-1"
            left={<Search />}
            placeholder="Search parts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search parts"
          />
          {onClose ? (
            <Tooltip content="Hide library" shortcut="l">
              <button type="button" onClick={onClose} aria-label="Hide library" className="tactile rounded-md p-1.5 text-fg-muted hover:bg-hover hover:text-fg">
                <PanelLeftClose className="size-3.5" />
              </button>
            </Tooltip>
          ) : null}
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5 hide-scrollbar">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={cn("tactile shrink-0 rounded-sm px-1.5 py-0.5 text-[10px]", category === "all" && !searching ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-hover hover:text-fg")}
          >
            All
          </button>
          {liveCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                play("select");
                setCategory(cat.id);
              }}
              className={cn("tactile shrink-0 rounded-sm px-1.5 py-0.5 text-[10px]", category === cat.id && !searching ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-hover hover:text-fg")}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {shown.length ? (
          <div className="grid grid-cols-2 gap-1">
            {shown.map((f) => (
              <Tile key={f.id} feature={f} />
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-[11px] text-fg-muted">
            {hidden.length && !searching ? "Everything here is removed." : <>Nothing by that name. Drop a <span className="text-accent">New idea</span> and describe it.</>}
          </div>
        )}
        {removed.length ? (
          <>
            <div className="mt-3 mb-1 flex items-center gap-1.5 px-1 text-[10px] uppercase tracking-wider text-fg-faint">
              <RotateCcw className="size-3" />
              Removed — click one to bring it back
            </div>
            <div className="grid grid-cols-2 gap-1">
              {removed.map((f) => (
                <Tile key={f.id} feature={f} removed />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border p-2">
        <div className="mb-1.5 flex items-center gap-2 px-0.5 text-[10px] text-fg-faint">
          <span>{shown.length} parts · drag or click</span>
          {hidden.length ? (
            <button
              type="button"
              onClick={() => { play("select"); setShowRemoved((v) => !v); }}
              aria-pressed={showRemoved}
              className="tactile ml-auto flex items-center gap-1 rounded-sm px-1 py-0.5 text-fg-muted hover:bg-hover hover:text-fg"
            >
              <EyeOff className="size-3" />
              {hidden.length} removed
            </button>
          ) : null}
        </div>
        <Tooltip content="A blank part you describe yourself">
          <button
            type="button"
            onClick={() => addFeatureToCanvas("custom-idea")}
            className="tactile flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-accent/50 py-1.5 text-[11px] text-accent hover:bg-accent-soft"
          >
            <Sparkles className="size-3.5" />
            New idea
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
