"use client";
import * as React from "react";
import { registry } from "@/core/registry";
import { useUi } from "@/core/ui-state/store";
import { Dialog } from "@/core/ui/dialog";
import { Kbd } from "@/core/ui/kbd";

export function ShortcutsSheet() {
  const open = useUi((s) => s.panels.shortcuts);
  const closePanel = useUi((s) => s.closePanel);
  const groups = new Map<string, typeof registry.shortcuts>();
  // The same gate the key handler asks (`useShortcuts`): a shortcut that
  // would not fire here is not a shortcut here, so it is not listed here.
  for (const s of registry.shortcuts) {
    if (s.when && !s.when()) continue;
    const g = s.group ?? s.module.name;
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && closePanel("shortcuts")} title="Keyboard shortcuts" description="Chords like “g then h” are typed one key after another." size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        {[...groups.entries()].map(([g, list]) => (
          <div key={g}>
            <div className="mb-1.5 text-small font-medium uppercase tracking-wider text-fg-faint">{g}</div>
            <ul className="divide-y divide-border rounded-md border border-border">
              {list.map((s) => (
                <li key={s.keys + s.label} className="flex items-center justify-between gap-3 px-2 py-1.5">
                  <span className="text-xs text-fg">{s.label}</span>
                  <Kbd>{s.keys}</Kbd>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
