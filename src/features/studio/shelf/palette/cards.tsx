"use client";
import { SavedComponentsBand } from "../../SavedComponents";
import * as React from "react";
import { X } from "lucide-react";
import { getFeature, type CategoryDef, type FeatureDef } from "../catalog";
import { WorkShelf } from "../../WorkShelf";
import { planetOf } from "../../planets";
import { moonFor } from "../../moons";
import { type SiteWords } from "../../shelfFacts";
import { SeeMotionTab, ShelfCard, WorkShelfCard, versionsOf } from "../../ShelfCards";
import { isWorkKey, workIdOf } from "../shelfGroups";
import { getWork } from "../library/works";
import type { SiteVersion } from "../library/siteVersions";
import { play } from "@/core/audio/engine";

/**
 * One open category, stacked under the planets.
 *
 * Its own header so you can tell where one ends and the next begins, its
 * sub-groups as a filter rather than a second drill level, and its parts in
 * the flow — no scroller of its own, so the shelf's single scroller is the
 * only thing the wheel talks to.
 */
export function CategorySection({
  category, groups: all, site, widthOf, cardWidth, words, onRemove, gap, onClose, sketches = 0, onShowSketches,
}: {
  category: CategoryDef;
  /** The category's groups as the shelf shows them, each with the items the search left in it. */
  groups: { id: string; label: string; keys: string[] }[];
  site: Map<string, SiteVersion[]>;
  widthOf: (f: FeatureDef) => number;
  cardWidth: number;
  words: SiteWords;
  onRemove: (id: string) => void;
  gap: number;
  onClose: () => void;
  /** Cards here held back as sketches (`shelfPlan.ts#isFinished`), and the press that shows them. */
  sketches?: number;
  onShowSketches?: () => void;
}) {
  const [sub, setSub] = React.useState<string | null>(null);
  /*
   * PRESSING A CATEGORY DOES NOT SCROLL ANYTHING. It opens the category.
   *
   * With one category open at a time the planets shrink to a rail
   * (`PLANET_DISC` in this file), which frees enough of the strip that the
   * section's header is on screen the moment it opens. So there is nothing
   * to scroll to, and nothing scrolls. The shelf moves when it is pushed,
   * never on its own.
   *
   * GROUPED BY PURPOSE, the most useful first (`shelfGroups.ts`): what the
   * parts are for, never their footprint, which is a small tag on each card.
   * A category a repository brought has no plan: its parts are whatever
   * that page was made of, in the order the page had them.
   */
  const planned = all.length > 1 || (all[0] && all[0].id !== category.id);
  const subs = planned ? all : [];
  const groups = React.useMemo(() => all.filter((g) => !sub || g.id === sub), [all, sub]);

  return (
    /* As tall as the shelf leaves it, never shorter than its cards: an open
       category is the shelf's body, and a short one sat as a small box in a
       tall shelf (`tests/shelf-strip.mjs`). */
    <section data-category-open={category.id} className="relative z-[1] flex-[1_0_auto] border-t border-border/70 pb-10">
      <div
        className="sticky top-0 z-[2] flex items-center gap-2 px-3 py-1.5 backdrop-blur-sm"
        style={{ background: `oklch(0.16 0.03 ${category.hue} / 0.9)` }}
      >
        <span className="flex items-center gap-1.5 text-plain font-medium" style={{ color: `oklch(0.86 0.12 ${category.hue})` }}>
          {React.createElement(planetOf(category.id), { size: 14 })}
          {category.label}
        </span>
        {/* Beside the name it closes, not at the far end of the row. */}
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${category.label}`}
          className="tactile shrink-0 rounded-sm p-0.5 text-fg-muted hover:bg-hover hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
        <div className="hide-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {subs.map((g) => {
            const on = sub === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => { play("select"); setSub(on ? null : g.id); }}
                aria-pressed={on}
                className="tactile flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-small font-medium"
                style={{
                  background: on ? `oklch(0.78 0.17 ${category.hue})` : `oklch(0.72 0.15 ${category.hue} / 0.16)`,
                  color: on ? "oklch(0.16 0.04 0)" : `oklch(0.86 0.12 ${category.hue})`,
                  boxShadow: `inset 0 0 0 1px oklch(0.72 0.15 ${category.hue} / 0.4)`,
                }}
              >
                {React.createElement(moonFor(g.id), { size: 12 })}
                <span className="whitespace-nowrap">{g.label}</span>
                <span className="num text-fine opacity-60">{g.keys.length}</span>
              </button>
            );
          })}
        </div>
        {category.id === "motion" ? <SeeMotionTab className="shrink-0 text-fine" /> : null}
      </div>
      <div className="px-3 py-2">
        {sketches && onShowSketches ? (
          <p data-sketches-here={sketches} className="mb-2 text-small text-fg-muted">
            {sketches} {sketches === 1 ? "sketch" : "sketches"} hidden here: {sketches === 1 ? "a part" : "parts"} the published page cannot run yet.{" "}
            <button type="button" onClick={onShowSketches} className="tactile rounded-sm px-1 text-accent hover:bg-hover">Show sketches</button>
          </p>
        ) : null}
        <SavedComponentsBand category={category.id} hue={category.hue} />
        <WorkShelf category={category} width={cardWidth} words={words} gap={gap} />
        {groups.map((g) => (
          <Band key={g.id} title={g.label || category.label} hue={category.hue} mark={subs.length ? moonFor(g.id) : undefined}>
            {/* Stretched to the row, so every card in a row ends on one line. */}
            <div className="flex flex-wrap items-stretch" style={{ gap }}>
              {g.keys.map((k) => <EntryCard key={k} entry={k} widthOf={widthOf} cardWidth={cardWidth} words={words} onRemove={onRemove} site={site} />)}
            </div>
          </Band>
        ))}
      </div>
    </section>
  );
}

/** One shelf item's card: a catalogue part or a library feature, with its versions and the open site's. */
export function EntryCard({ entry, widthOf, cardWidth, words, onRemove, site }: {
  entry: string; widthOf: (f: FeatureDef) => number; cardWidth: number; words: SiteWords; onRemove: (id: string) => void; site: Map<string, SiteVersion[]>;
}) {
  const versions = versionsOf(entry, site);
  const plan = versions.filter((v) => !v.site).length;
  const hosts = [...new Set(versions.flatMap((v) => (v.site ? [v.site.host] : [])))];
  if (isWorkKey(entry)) {
    const w = getWork(workIdOf(entry));
    return w ? <WorkShelfCard work={w} width={cardWidth} words={words} versions={plan} hosts={hosts} /> : null;
  }
  const f = getFeature(entry);
  return f ? <ShelfCard feature={f} width={widthOf(f)} words={words} onRemove={() => onRemove(f.id)} versions={plan} hosts={hosts} /> : null;
}

export function Band({ title, children, hue, mark }: { title: string; children: React.ReactNode; hue?: number; mark?: (p: { size?: number }) => React.ReactNode }) {
  return (
    <section data-shelf-group={title} className="mb-4 last:mb-0">
      <div className="mb-2 flex items-center gap-2">
        {mark ? <span className="shrink-0" style={{ color: hue != null ? `oklch(0.84 0.13 ${hue})` : undefined }}>{React.createElement(mark, { size: 14 })}</span> : null}
        <span className="shrink-0 text-small font-medium" style={{ color: hue != null ? `oklch(0.86 0.1 ${hue})` : undefined }}>{title}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The grip on the shelf's top edge                                     */
/* ------------------------------------------------------------------ */
