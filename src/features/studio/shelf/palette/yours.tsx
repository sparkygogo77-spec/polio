"use client";
/**
 * FROM YOUR SITES: the shelf's first stop. Every hooked panel a site was
 * built from (kept on import, `library/fromSites.ts`) and every component the
 * person saved by hand, by site, placed whole on any board.
 */
import * as React from "react";
import { Building2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { useLearned } from "../library/useLearned";
import { fromYourSites } from "../library/fromSites";
import { putComponent } from "../../SavedComponents";
import { jumpTo } from "../../ShelfCards";
import { Band } from "./cards";

/** Its key in the shelf's open list, beside the categories'. */
export const YOURS = "your-sites";
const HUE = 45;

/** The disc on the planets row that opens it. Not a `data-category`: it is not a kind of part. */
export function YoursPlanet({ open, cell, disc, mark, compact, onToggle }: { open: boolean; cell: number; disc: number; mark: number; compact: boolean; onToggle: () => void }) {
  const count = useLearned((s) => (s.lib.components ?? []).length);
  return (
    <Tooltip content="The panels your sites were built from, and what you saved, ready for any board" side="top">
      <button
        type="button"
        data-shelf-yours=""
        aria-expanded={open}
        aria-label="From your sites"
        onClick={onToggle}
        className="group/cat tactile flex shrink-0 flex-col items-center gap-1 transition-[width] duration-200"
        style={{ color: `oklch(0.84 0.13 ${HUE})`, minWidth: cell, maxWidth: 104 }}
      >
        <span
          className="flex items-center justify-center rounded-full transition-[box-shadow,transform,width,height] duration-200 group-hover/cat:-translate-y-0.5"
          style={{
            width: disc, height: disc,
            background: `oklch(0.22 0.1 ${HUE} / ${open ? 0.85 : 0.6})`,
            boxShadow: open ? `inset 0 0 0 1.5px oklch(0.8 0.17 ${HUE})` : `inset 0 0 0 1px oklch(0.62 0.14 ${HUE} / 0.42)`,
          }}
        >
          <Building2 style={{ width: mark * 0.85, height: mark * 0.85 }} />
        </span>
        <span className={cn("text-center leading-tight", compact ? "text-fine" : "text-small")}>From your sites</span>
        {compact ? null : <span className="num text-fine text-fg-faint">{count}</span>}
      </button>
    </Tooltip>
  );
}

/** The open shelf of it: one band per site, its panels as cards. */
export function FromYourSites({ onClose }: { onClose: () => void }) {
  const all = useLearned((s) => s.lib.components);
  const bands = React.useMemo(() => fromYourSites(all ?? []), [all]);
  return (
    <section data-category-yours="" className="relative z-[1] flex-[1_0_auto] border-t border-border/70 pb-6">
      <div className="sticky top-0 z-[2] flex items-center gap-2 px-3 py-1.5 backdrop-blur-sm" style={{ background: `oklch(0.16 0.03 ${HUE} / 0.9)` }}>
        <span className="flex items-center gap-1.5 text-plain font-medium" style={{ color: `oklch(0.86 0.12 ${HUE})` }}>
          <Building2 className="size-3.5" />From your sites
        </span>
        <button type="button" onClick={onClose} aria-label="Close From your sites" className="tactile shrink-0 rounded-sm p-0.5 text-fg-muted hover:bg-hover hover:text-fg">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="px-3 py-2">
        {bands.length ? bands.map(({ site, items }) => (
          <Band key={site ?? "saved"} title={site ? `From ${site}` : "Saved by you"} hue={HUE}>
            <div className="flex flex-wrap gap-2">
              {items.map((c) => {
                const states = new Set(c.nodes.map((n) => (n.state as { group?: string; option?: number } | null | undefined)).filter((x) => x?.group).map((x) => `${x!.group}:${x!.option}`)).size;
                const hooks = c.nodes.filter((n) => (n.hooks as Record<string, string> | null | undefined)?.["data-hook"]).length;
                return (
                  <div key={c.id} data-yours-card={c.id} className="flex w-[200px] flex-col gap-1 rounded-md border border-border bg-surface p-2">
                    <span className="truncate text-small font-medium text-fg">{c.name}</span>
                    <span className="truncate text-fine text-fg-faint">
                      {c.kind} · {c.nodes.length} {c.nodes.length === 1 ? "part" : "parts"}{hooks ? ` · ${hooks} hooked` : ""}{states ? ` · ${states} states` : ""}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button size="xs" variant="outline" data-yours-add={c.id} onClick={() => jumpTo(putComponent(c).slice(0, 1))}>
                        <Plus className="mr-1 size-3" />Add
                      </Button>
                      <Button size="xs" variant="ghost" aria-label={`Take ${c.name} off the shelf`} onClick={() => { play("deny"); useLearned.getState().removeComponent(c.id); }}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Band>
        )) : (
          <p className="text-small text-fg-muted">Bring a site in and the panels it was built from land here, hooks, states and look kept, ready for any board.</p>
        )}
      </div>
    </section>
  );
}
