"use client";
/**
 * Stage one: pick what you want.
 *
 * Browse or right-click your way through the whole library and shortlist the
 * features this site needs. Nothing is arranged here and nothing is prompted —
 * the only question is "is this in or out". Stage two then shows only what you
 * picked, so the canvas is never a wall of 218 icons.
 */
import * as React from "react";
import { ArrowRight, Check, Layers, Lightbulb, Search, Sparkles, Trash2, X } from "lucide-react";
import { CATEGORIES, categoryOf, featuresByCategory, getFeature, searchFeatures, type CategoryId, type FeatureDef } from "./catalog";
import { useStudio } from "./store";
import { cn } from "@/core/lib/cn";
import { ctxProps } from "@/core/context-menu/ctx";
import { play } from "@/core/audio/engine";
import { haptic } from "@/core/feedback/haptics";
import { useActions } from "@/core/actions";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Badge } from "@/core/ui/badge";
import { Tooltip } from "@/core/ui/tooltip";
import { EmptyState } from "@/core/ui/empty-state";

function FeatureCard({ feature, picked }: { feature: FeatureDef; picked: boolean }) {
  const cat = categoryOf(feature.category);
  const Icon = feature.icon;
  const toggle = useStudio((s) => s.togglePick);
  return (
    <button
      type="button"
      {...ctxProps("studio-pick", feature.id, feature)}
      aria-pressed={picked}
      onClick={() => {
        play(picked ? "toggleOff" : "toggleOn");
        haptic();
        toggle(feature.id);
      }}
      className={cn(
        "tactile group relative flex h-full flex-col items-start gap-1.5 rounded-lg border p-2.5 text-left",
        picked ? "border-accent bg-accent-soft/40" : "border-border bg-panel hover:border-border-strong hover:bg-hover",
      )}
    >
      <span className="flex w-full items-center gap-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-md"
          style={{ background: `oklch(0.7 0.14 ${cat.hue} / 0.16)`, color: `oklch(0.8 0.15 ${cat.hue})` }}
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-fg">{feature.name}</span>
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
            picked ? "border-accent bg-accent text-accent-fg" : "border-border text-transparent group-hover:border-border-strong",
          )}
        >
          <Check className="size-2.5" />
        </span>
      </span>
      <span className="line-clamp-2 text-[11px] leading-snug text-fg-muted">{feature.blurb}</span>
    </button>
  );
}

export function PickerPage() {
  const picks = useStudio((s) => s.picks);
  const nodes = useStudio((s) => s.nodes);
  const ctx = useActions();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<CategoryId | "all" | "picked">("all");

  const searching = query.trim().length > 0;
  const results = React.useMemo(() => searchFeatures(query), [query]);
  const shown = React.useMemo(() => {
    if (category === "picked") return picks.map((id) => getFeature(id)).filter(Boolean) as FeatureDef[];
    if (searching || category === "all") return results;
    return results.filter((f) => f.category === category);
  }, [results, category, picks, searching]);

  const pickedSet = new Set(picks);
  const placed = new Set(nodes.map((n) => n.featureId));

  return (
    // Fixed height, not min-height: the card grid scrolls inside, so the tray
    // and the "Design these" button stay pinned in view instead of sitting
    // below 218 cards.
    <div className="flex h-[calc(100dvh-var(--topbar-h)-var(--statusbar-h))] flex-col overflow-hidden">
      {/* ---------------------------------------------------------- header */}
      <header className="shrink-0 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-fg">What should this site have?</h1>
            <p className="mt-0.5 max-w-2xl text-[11px] text-fg-muted">
              Pick everything you want — click a card, or right-click for more ways to add. Nothing is arranged yet.
              Next you&apos;ll place only what you picked and give each one its own prompt.
            </p>
          </div>
          <Input
            className="w-full sm:w-72"
            left={<Search />}
            placeholder="Search 218 features…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search features"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={cn(
              "tactile rounded-md px-2 py-1 text-[11px]",
              category === "all" ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-hover hover:text-fg",
            )}
          >
            Everything
          </button>
          {CATEGORIES.map((cat) => {
            const count = featuresByCategory(cat.id).filter((f) => pickedSet.has(f.id)).length;
            return (
              <button
                key={cat.id}
                type="button"
                {...ctxProps("studio-pick-category", cat.id, cat)}
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "tactile flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px]",
                  category === cat.id ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-hover hover:text-fg",
                )}
              >
                {cat.label}
                {count ? <span className="num rounded-full bg-accent px-1 text-[9px] font-bold text-accent-fg">{count}</span> : null}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setCategory("picked")}
            className={cn(
              "tactile ml-auto rounded-md px-2 py-1 text-[11px]",
              category === "picked" ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-hover hover:text-fg",
            )}
          >
            Picked only ({picks.length})
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------ grid */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
        {shown.length === 0 ? (
          <EmptyState
            icon={category === "picked" ? Sparkles : Lightbulb}
            title={category === "picked" ? "Nothing picked yet" : "Nothing matches"}
            body={
              category === "picked"
                ? "Choose from the categories above, or start with a New Idea and describe it yourself."
                : "No feature has that name. Pick “New Idea” instead and describe it in your own words."
            }
            action={
              <Button size="sm" variant="outline" onClick={() => useStudio.getState().togglePick("custom-idea")}>
                <Lightbulb />
                Add a new idea
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((f) => (
              <FeatureCard key={f.id} feature={f} picked={pickedSet.has(f.id)} />
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------ tray */}
      <footer className="shrink-0 border-t border-border bg-panel/70 px-4 py-2 sm:px-6" {...ctxProps("studio-picks", "tray", picks)}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {picks.length === 0 ? (
              <span className="text-[11px] text-fg-faint">Nothing picked yet — click any card above.</span>
            ) : (
              picks.slice(0, 24).map((id) => {
                const f = getFeature(id);
                if (!f) return null;
                const Icon = f.icon;
                const cat = categoryOf(f.category);
                return (
                  <span
                    key={id}
                    {...ctxProps("studio-pick", id, f)}
                    className={cn(
                      "group flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]",
                      placed.has(id) ? "border-up/40 text-up" : "border-border text-fg-muted",
                    )}
                    title={placed.has(id) ? `${f.name} — already on the canvas` : f.name}
                  >
                    <Icon className="size-3" style={{ color: `oklch(0.8 0.15 ${cat.hue})` }} />
                    {f.name}
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => {
                        play("close");
                        useStudio.getState().removePick(id);
                      }}
                      className="opacity-0 transition-opacity hover:text-down group-hover:opacity-100"
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                );
              })
            )}
            {picks.length > 24 ? <span className="text-[10px] text-fg-faint">+{picks.length - 24} more</span> : null}
          </div>

          {picks.length ? (
            <Tooltip content="Clear the shortlist">
              <Button
                variant="ghost"
                size="iconXs"
                aria-label="Clear picks"
                onClick={() =>
                  void ctx
                    .confirm({ title: "Clear the shortlist?", body: `${picks.length} picks. Anything already on the canvas stays.`, danger: true, confirmLabel: "Clear" })
                    .then((ok) => ok && useStudio.getState().clearPicks())
                }
              >
                <Trash2 />
              </Button>
            </Tooltip>
          ) : null}

          <Badge variant={picks.length ? "accent" : "default"} size="lg">
            {picks.length} picked
          </Badge>

          <Button variant="primary" size="lg" disabled={!picks.length} onClick={() => ctx.navigate("/studio/design")} sound="confirm">
            <Layers />
            Design these
            <ArrowRight />
          </Button>
        </div>
      </footer>
    </div>
  );
}
