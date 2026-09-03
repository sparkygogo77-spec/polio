"use client";
import * as React from "react";
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { ArrowRight, Search, Settings2, ToggleLeft, ToggleRight } from "lucide-react";
import { registry } from "@/core/registry";
import { useActions } from "@/core/actions";
import { useUi } from "@/core/ui-state/store";
import { play } from "@/core/audio/engine";
import { allSettingDefs, allSettingGroups, useSettings } from "@/core/settings/store";
import { Kbd } from "@/core/ui/kbd";
import { cn } from "@/core/lib/cn";

const itemClass =
  "flex h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 text-xs text-fg-muted data-[selected=true]:bg-hover data-[selected=true]:text-fg [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fg-faint data-[selected=true]:[&_svg]:text-fg";
const groupClass =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-faint";

export function CommandPalette() {
  const open = useUi((s) => s.panels.commands);
  const closePanel = useUi((s) => s.closePanel);
  const ctx = useActions();
  const [query, setQuery] = React.useState("");
  const values = useSettings((s) => s.values);

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const run = (fn: () => void) => {
    play("confirm");
    closePanel("commands");
    window.setTimeout(fn, 0);
  };

  const commands = registry.commands.filter((c) => !c.when || c.when());
  const groups = new Map<string, typeof commands>();
  for (const c of commands) {
    const g = c.group ?? c.module.name;
    groups.set(g, [...(groups.get(g) ?? []), c]);
  }
  const toggles = allSettingDefs().filter((d) => d.type === "toggle");
  const settingGroups = allSettingGroups();

  return (
    <D.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          play("close");
          closePanel("commands");
        }
      }}
    >
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[75] bg-overlay animate-fade-in" />
        <D.Content
          className="fixed left-1/2 top-[14vh] z-[76] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-border glass shadow-panel animate-pop outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <D.Title className="sr-only">Command palette</D.Title>
          <D.Description className="sr-only">Search commands, pages and settings.</D.Description>
          <Command label="Command palette" loop>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 text-fg-muted" />
              <Command.Input autoFocus value={query} onValueChange={setQuery} placeholder="Type a command, page or setting…" className="h-11 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-faint" />
              <Kbd>escape</Kbd>
            </div>
            <Command.List className="max-h-[50vh] overflow-y-auto p-1">
              <Command.Empty className="px-3 py-8 text-center text-xs text-fg-muted">Nothing matches.</Command.Empty>

              <Command.Group heading="Pages" className={groupClass}>
                {registry.nav.map((n) => {
                  const Icon = n.icon ?? ArrowRight;
                  return (
                    <Command.Item key={n.href} value={`page ${n.label} ${n.href}`} onSelect={() => run(() => ctx.navigate(n.href))} className={itemClass}>
                      <Icon />
                      <span className="flex-1">{n.label}</span>
                      <span className="text-[10px] text-fg-faint">{n.href}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>

              {[...groups.entries()].map(([g, list]) => (
                <Command.Group key={g} heading={g} className={groupClass}>
                  {list.map((c) => {
                    const Icon = c.icon ?? ArrowRight;
                    return (
                      <Command.Item key={c.id} value={`${c.label} ${c.keywords?.join(" ") ?? ""} ${c.id}`} onSelect={() => run(() => void c.run(ctx))} className={itemClass}>
                        <Icon />
                        <span className="flex-1">{c.label}</span>
                        {c.shortcut ? <Kbd>{c.shortcut}</Kbd> : null}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}

              <Command.Group heading="Settings" className={groupClass}>
                {toggles.map((d) => {
                  const on = (d.id in values ? values[d.id] : d.default) as boolean;
                  return (
                    <Command.Item
                      key={d.id}
                      value={`setting ${d.label} ${d.group} ${d.tags?.join(" ") ?? ""} ${d.id}`}
                      onSelect={() => ctx.setSetting(d.id, !on)}
                      className={itemClass}
                    >
                      {on ? <ToggleRight className="text-accent!" /> : <ToggleLeft />}
                      <span className="flex-1">{d.label}</span>
                      <span className={cn("text-[10px]", on ? "text-accent" : "text-fg-faint")}>{on ? "on" : "off"}</span>
                    </Command.Item>
                  );
                })}
                {settingGroups.map((g) => (
                  <Command.Item key={g.id} value={`settings group ${g.label} ${g.description ?? ""}`} onSelect={() => run(() => ctx.openPanel("settings"))} className={itemClass}>
                    <Settings2 />
                    <span className="flex-1">Open {g.label} settings</span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
            <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[10px] text-fg-faint">
              <span className="flex items-center gap-1">
                <Kbd raw>↑↓</Kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <Kbd raw>↵</Kbd> run
              </span>
              <span className="ml-auto">{commands.length + registry.nav.length + toggles.length} entries</span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
