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
import { PanelLeftClose, Search, Sparkles } from "lucide-react";
import { CATEGORIES, categoryOf, getFeature, searchFeatures, type CategoryId, type FeatureDef } from "./catalog";
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

function Tile({ feature }: { feature: FeatureDef }) {
  const Icon = feature.icon;
  const cat = categoryOf(feature.category);
  return (
    <Tooltip content={feature.blurb} side="right">
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
    </Tooltip>
  );
}

export function Palette({ onClose }: { onClose?: () => void }) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<CategoryId | "all">("all");
  const searching = query.trim().length > 0;
  const results = React.useMemo(() => searchFeatures(query), [query]);
  const shown = searching || category === "all" ? results : results.filter((f) => f.category === category);

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
          {CATEGORIES.map((cat) => (
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
            Nothing by that name. Drop a <span className="text-accent">New idea</span> and describe it.
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-2">
        <div className="mb-1.5 px-0.5 text-[10px] text-fg-faint">{shown.length} parts · drag or click</div>
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
