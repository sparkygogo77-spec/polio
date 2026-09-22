"use client";
/**
 * A module's own controls, shown inside that module's own panel.
 *
 * HIS TEST FOR A SETTING: does it change the site he is building, or only the
 * Builder around it? A third kind kept failing both readings — a knob that
 * belongs to one console and does nothing anywhere else. Twelve of them, for
 * the tweet console, sat in a drawer across the app, and the console's own
 * settings button closed the console to go and find them.
 *
 * So a setting can name the panel that owns it. The drawer skips those; this
 * shows them, in the same rows and with the same reset behaviour, beside the
 * thing they act on.
 */
import * as React from "react";
import { RotateCcw } from "lucide-react";
import { allSettingDefs, useSettings } from "./store";
import { Control } from "./SettingsDrawer";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";

export function OwnSettings({ panel, advanced = false }: { panel: string; advanced?: boolean }) {
  const values = useSettings((s) => s.values);
  const set = useSettings((s) => s.set);
  const reset = useSettings((s) => s.reset);
  const [showAdv, setShowAdv] = React.useState(advanced);

  const mine = allSettingDefs()
    .filter((d) => d.panel === panel && (!d.when || d.when()))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const list = mine.filter((d) => showAdv || !d.advanced);
  const tucked = mine.length - list.length;

  if (!mine.length) return null;

  return (
    <div data-own-settings={panel} className="flex min-h-0 flex-col">
      <ul>
        {list.map((d) => {
          const v = d.id in values ? values[d.id] : d.default;
          const isMod = d.id in values;
          return (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-hover/40">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {isMod ? (
                    <Tooltip content="Changed. Click to reset.">
                      <button type="button" aria-label="Reset" onClick={() => reset(d.id)} className="size-1.5 rounded-full bg-accent" />
                    </Tooltip>
                  ) : null}
                  <span className="truncate text-xs text-fg">{d.label}</span>
                  {d.advanced ? <span className="rounded-xs border border-border px-1 text-fine uppercase tracking-wider text-fg-faint">adv</span> : null}
                </div>
                {d.description ? <div className="text-small text-fg-muted">{d.description}</div> : null}
              </div>
              <div className="shrink-0">
                <Control def={d} value={v} onChange={(nv) => set(d.id, nv)} />
              </div>
            </li>
          );
        })}
      </ul>
      {tucked ? (
        <button
          type="button"
          data-own-settings-more={tucked}
          onClick={() => setShowAdv(true)}
          className="tactile mx-3 my-2 rounded-sm border border-border px-2 py-1 text-small text-fg-muted hover:bg-hover"
        >
          <RotateCcw className="mr-1 inline size-3" />
          {tucked} more, for tuning
        </button>
      ) : null}
    </div>
  );
}
