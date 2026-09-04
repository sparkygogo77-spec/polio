"use client";
/**
 * The feature library. Drag an icon onto the canvas, or click to drop it in
 * the middle. Right-click any entry for more ways to add it.
 */
import * as React from "react";
import { Check, LayoutGrid, ListPlus, Search, Sparkles } from "lucide-react";
import { CATEGORIES, categoryOf, getFeature, searchFeatures, type FeatureDef } from "./catalog";
import { useStudio } from "./store";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { Input } from "@/core/ui/input";
import { Badge } from "@/core/ui/badge";
import { Tooltip } from "@/core/ui/tooltip";
import { useActions } from "@/core/actions";

/** Where a click-to-add lands: roughly the middle of the current viewport. */
export function dropPoint() {
  const { pan, zoom } = useStudio.getState();
  return { x: (420 - pan.x) / zoom, y: (240 - pan.y) / zoom };
}

/**
 * Click-to-add lands in the first free slot near the viewport centre, spiralling
 * outward in a grid — otherwise adding several in a row buries them in a stack.
 */
export function addFeatureToCanvas(featureId: string) {
  const state = useStudio.getState();
  const feature = getFeature(featureId);
  const w = feature?.w ?? 132;
  const h = feature?.h ?? 76;
  const start = dropPoint();
  const occupied = state.nodes.filter((n) => n.pageId === state.activePageId);
  const overlaps = (x: number, y: number) =>
    occupied.some((n) => x < n.x + n.w + 12 && x + w + 12 > n.x && y < n.y + n.h + 12 && y + h + 12 > n.y);

  let x = start.x;
  let y = start.y;
  for (let row = 0; row < 12 && overlaps(x, y); row++) {
    for (let col = 0; col < 6; col++) {
      x = start.x + col * (w + 24);
      y = start.y + row * (h + 24);
      if (!overlaps(x, y)) break;
    }
  }

  const id = state.addNode(featureId, Math.round(x), Math.round(y));
  play("confirm");
  return id;
}

function PaletteItem({ feature, placed }: { feature: FeatureDef; placed?: boolean }) {
  const Icon = feature.icon;
  const cat = categoryOf(feature.category);
  return (
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
      className="tactile group flex w-full items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-left hover:border-border hover:bg-hover"
      title={feature.blurb}
    >
      <span
        className="mt-px flex size-6 shrink-0 items-center justify-center rounded-sm"
        style={{ background: `oklch(0.7 0.14 ${cat.hue} / 0.16)`, color: `oklch(0.8 0.15 ${cat.hue})` }}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-fg">{feature.name}</span>
          {placed ? <Check className="size-3 shrink-0 text-up" /> : null}
        </span>
        <span className="block truncate text-[10px] text-fg-muted">{feature.blurb}</span>
      </span>
    </button>
  );
}

/** Lay every unplaced pick onto the current page in a tidy grid. */
export function placeAllPicks() {
  const state = useStudio.getState();
  const placed = new Set(state.nodes.filter((n) => n.pageId === state.activePageId).map((n) => n.featureId));
  const todo = state.picks.filter((id) => !placed.has(id));
  const start = dropPoint();
  todo.forEach((id, i) => {
    const f = getFeature(id);
    useStudio.getState().addNode(id, Math.round(start.x + (i % 4) * ((f?.w ?? 132) + 24)), Math.round(start.y + Math.floor(i / 4) * ((f?.h ?? 76) + 28)));
  });
  if (todo.length) play("confirm");
  return todo.length;
}

/**
 * Stage two's library. It shows YOUR PICKS by default — the whole point of the
 * pick stage is that you never face all 218 again — with the full catalogue one
 * toggle away so nothing is ever out of reach.
 */
export function Palette() {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState<string | null>("structure");
  const [full, setFull] = React.useState(false);
  const picks = useStudio((s) => s.picks);
  const nodes = useStudio((s) => s.nodes);
  const ctx = useActions();

  const results = React.useMemo(() => searchFeatures(query), [query]);
  const searching = query.trim().length > 0;
  const placedIds = React.useMemo(() => new Set(nodes.map((n) => n.featureId)), [nodes]);
  const pickedFeatures = React.useMemo(
    () => picks.map((id) => getFeature(id)).filter(Boolean) as FeatureDef[],
    [picks],
  );
  const visiblePicks = searching
    ? pickedFeatures.filter((f) => results.some((r) => r.id === f.id))
    : pickedFeatures;
  const unplaced = pickedFeatures.filter((f) => !placedIds.has(f.id)).length;
  const showLibrary = full || picks.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border bg-panel/50">
      <div className="shrink-0 border-b border-border p-2">
        <Input
          left={<Search />}
          placeholder={showLibrary ? "Search features…" : "Search your picks…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search features"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] text-fg-faint">
            {showLibrary ? `${results.length} features` : `${visiblePicks.length} picked · ${unplaced} to place`}
          </span>
          <button
            type="button"
            onClick={() => {
              play("select");
              setFull(!full);
            }}
            className="tactile shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] text-fg-muted hover:bg-hover hover:text-fg"
          >
            {showLibrary && picks.length ? "Your picks" : showLibrary ? "" : "Full library"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {showLibrary ? (
          searching ? (
            results.length ? (
              results.map((f) => <PaletteItem key={f.id} feature={f} placed={placedIds.has(f.id)} />)
            ) : (
              <div className="p-4 text-center text-[11px] text-fg-muted">
                Nothing matches. Drop a <span className="text-accent">New Idea</span> instead and describe it.
              </div>
            )
          ) : (
            CATEGORIES.map((cat) => {
              const items = results.filter((f) => f.category === cat.id);
              const isOpen = open === cat.id;
              const CatIcon = cat.icon;
              return (
                <section key={cat.id} className="mb-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      play(isOpen ? "close" : "open");
                      setOpen(isOpen ? null : cat.id);
                    }}
                    className={cn(
                      "tactile flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover",
                      isOpen && "bg-hover",
                    )}
                  >
                    <CatIcon className="size-3.5 shrink-0" style={{ color: `oklch(0.8 0.15 ${cat.hue})` }} />
                    <span className="flex-1 text-[11px] font-semibold text-fg">{cat.label}</span>
                    <Badge size="sm">{items.length}</Badge>
                  </button>
                  {isOpen ? (
                    <div className="pb-1 pl-1">
                      <p className="px-2 pb-1 text-[10px] text-fg-faint">{cat.blurb}</p>
                      {items.map((f) => (
                        <PaletteItem key={f.id} feature={f} placed={placedIds.has(f.id)} />
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })
          )
        ) : visiblePicks.length ? (
          <>
            {unplaced > 0 ? (
              <button
                type="button"
                onClick={() => placeAllPicks()}
                className="tactile mb-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-accent/40 bg-accent-soft/50 py-1.5 text-[11px] text-accent hover:bg-accent-soft"
              >
                <LayoutGrid className="size-3.5" />
                Place all {unplaced} remaining
              </button>
            ) : null}
            {visiblePicks.map((f) => (
              <PaletteItem key={f.id} feature={f} placed={placedIds.has(f.id)} />
            ))}
          </>
        ) : (
          <div className="p-4 text-center text-[11px] text-fg-muted">No pick matches that.</div>
        )}
      </div>

      <div className="shrink-0 space-y-1 border-t border-border p-2">
        <Tooltip content="Go back and shortlist more features">
          <button
            type="button"
            onClick={() => ctx.navigate("/studio")}
            className="tactile flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-[11px] text-fg-muted hover:bg-hover hover:text-fg"
          >
            <ListPlus className="size-3.5" />
            Pick more features
          </button>
        </Tooltip>
        <Tooltip content="Drops a blank element you describe yourself">
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
