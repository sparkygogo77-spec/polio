"use client";
/**
 * THE SITE TAB: the two whole-site panels under one title.
 *
 * Format (whole-site features and the brief for a new build) and System
 * (the site's tokens and components) were two of seven tabs, both about
 * the whole site and neither about a part. They are one tab now, Site,
 * with a pair of pills at the top choosing between them. The pills set
 * the same panel ids the tabs set (`format`, `system`), so nothing that
 * asks for a panel by id changed (side-panel lane, 2026-11-08).
 */
import * as React from "react";
import { ToggleGroup } from "radix-ui";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { SITE_TABS } from "../page/side";
import { FormatPanel } from "./FormatPanel";
import { SystemPanel } from "./SystemPanel";

export function SitePanel({ tab, onTab }: { tab: string; onTab: (v: string) => void }) {
  const which = tab === "system" ? "system" : "format";
  return (
    <div data-site-panel={which} className="flex h-full min-h-0 flex-col">
      <ToggleGroup.Root
        type="single"
        value={which}
        onValueChange={(v) => { if (!v) return; play("select"); onTab(v); }}
        aria-label="Site"
        data-site-tabs=""
        className="flex shrink-0 gap-1 px-2 pt-2"
      >
        {SITE_TABS.map((t) => (
          <ToggleGroup.Item
            key={t.value}
            value={t.value}
            aria-label={t.label}
            data-site-tab={t.value}
            className={cn(
              "tactile h-6 rounded-full border border-border-strong bg-elevated px-3 text-small text-fg",
              "data-[state=on]:border-[oklch(0.76_0.18_148)] data-[state=on]:bg-[oklch(0.76_0.18_148)] data-[state=on]:font-semibold data-[state=on]:text-[oklch(0.17_0.05_148)]",
            )}
          >
            {t.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {which === "system" ? <SystemPanel /> : <FormatPanel />}
      </div>
    </div>
  );
}
