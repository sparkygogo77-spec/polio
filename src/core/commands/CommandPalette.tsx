"use client";
/**
 * The command palette, as a console.
 *
 * It was a grey search list like every editor's. Now it is the same object
 * the Builder's wheel is made of: a void panel with a thin lit rim, the
 * search field a screen — teal glass, scanlines, phosphor lettering — and
 * every entry an icon key in its own colour, so a page, a command and a
 * setting read as three different kinds of thing before a word is read.
 */
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

/* The void and the screen. One definition, in core, for everything that wears them. */
import { SCREEN, VOID } from "@/core/ui/void";
/** Keys in their own colours, round the wheel, white lines on them; dark on the yellows. */
const KEY_HUES = [205, 330, 62, 150, 278, 22, 100, 245, 350, 180];
function keyOf(i: number): React.CSSProperties {
  const hue = KEY_HUES[i % KEY_HUES.length]!;
  const yellow = hue >= 40 && hue <= 115;
  return { background: `oklch(${yellow ? 0.78 : 0.66} 0.17 ${hue})`, color: yellow ? "oklch(0.22 0.06 60)" : "oklch(0.99 0 0)" };
}

const itemClass =
  "group flex h-9 cursor-default select-none items-center gap-2.5 rounded-[6px] px-2 text-large transition-colors data-[selected=true]:text-[oklch(0.99_0_0)]";
const groupClass =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-fine [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em]";

/** An icon in its own coloured key. */
function Key({ i, children }: { i: number; children: React.ReactNode }) {
  return (
    <span
      className="flex size-[22px] shrink-0 items-center justify-center rounded-[5px] [&_svg]:size-3"
      style={{ ...keyOf(i), boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.18), 0 1px 2px oklch(0 0 0 / 0.5)" }}
    >
      {children}
    </span>
  );
}

export function CommandPalette() {
  const open = useUi((s) => s.panels.commands);
  const closePanel = useUi((s) => s.closePanel);
  const ctx = useActions();
  const [query, setQuery] = React.useState("");
  const values = useSettings((s) => s.values);

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  /* The field takes focus when the palette opens, and again a moment later
     if a menu that was closing just before hands focus back to the page (it
     does so after this opens, which left the field unfocused and the typing
     going nowhere). */
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const take = () => {
      const el = inputRef.current;
      if (el && document.activeElement !== el) el.focus({ preventScroll: true });
    };
    take();
    const timers = [window.setTimeout(take, 30), window.setTimeout(take, 150)];
    return () => timers.forEach(window.clearTimeout);
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
  const toggles = allSettingDefs().filter((d) => d.type === "toggle" && (!d.when || d.when()));
  const settingGroups = allSettingGroups();
  const groupList = [...groups.entries()];

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
          className="fixed left-1/2 top-[14vh] z-[76] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-[10px] animate-pop outline-none"
          style={{
            background: VOID.face,
            color: VOID.text,
            border: `1px solid ${VOID.rim}`,
            boxShadow: VOID.drop,
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <D.Title className="sr-only">Command palette</D.Title>
          <D.Description className="sr-only">Search commands, pages and settings.</D.Description>
          <Command label="Command palette" loop>
            {/* the search field is a screen */}
            <div className="p-2 pb-1">
              <div
                className="flex items-center gap-2 rounded-[6px] px-3"
                style={{
                  backgroundImage: `${SCREEN.scan}, ${SCREEN.glass}`,
                  boxShadow: `inset 0 0 0 1px ${SCREEN.line}, inset 0 2px 9px oklch(0 0 0 / 0.75), inset 0 0 24px oklch(0.55 0.12 190 / 0.16)`,
                }}
              >
                <Search className="size-4" style={{ color: SCREEN.dim }} />
                <Command.Input
                  ref={inputRef}
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Type a command, page or setting…"
                  className="h-10 flex-1 bg-transparent font-mono text-[13px] outline-none"
                  style={{ color: SCREEN.ink, textShadow: `0 0 6px ${SCREEN.ink}`, caretColor: SCREEN.ink }}
                />
                <Kbd>escape</Kbd>
              </div>
            </div>
            <Command.List className="max-h-[50vh] overflow-y-auto p-1.5 pt-0" style={{ scrollbarWidth: "thin" }}>
              <Command.Empty className="px-3 py-8 text-center font-mono text-plain" style={{ color: VOID.muted }}>
                Nothing matches.
              </Command.Empty>

              <Command.Group heading="Pages" className={groupClass} style={{ color: VOID.muted }}>
                {registry.nav.map((n, i) => {
                  const Icon = n.icon ?? ArrowRight;
                  return (
                    <Command.Item key={n.href} value={`page ${n.label} ${n.href}`} onSelect={() => run(() => ctx.navigate(n.href))} className={itemClass} style={{ color: VOID.text }}>
                      <Key i={i}><Icon /></Key>
                      <span className="flex-1">{n.label}</span>
                      <span className="font-mono text-small" style={{ color: VOID.muted }}>{n.href}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>

              {groupList.map(([g, list], gi) => (
                <Command.Group key={g} heading={g} className={groupClass} style={{ color: VOID.muted }}>
                  {list.map((c) => {
                    const Icon = c.icon ?? ArrowRight;
                    return (
                      <Command.Item key={c.id} value={`${c.label} ${c.keywords?.join(" ") ?? ""} ${c.id}`} onSelect={() => run(() => void c.run(ctx))} className={itemClass} style={{ color: VOID.text }}>
                        <Key i={gi + 1}><Icon /></Key>
                        <span className="flex-1">{c.label}</span>
                        {c.shortcut ? <Kbd>{c.shortcut}</Kbd> : null}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}

              <Command.Group heading="Settings" className={groupClass} style={{ color: VOID.muted }}>
                {toggles.map((d) => {
                  const on = (d.id in values ? values[d.id] : d.default) as boolean;
                  return (
                    <Command.Item
                      key={d.id}
                      value={`setting ${d.label} ${d.group} ${d.tags?.join(" ") ?? ""} ${d.id}`}
                      onSelect={() => ctx.setSetting(d.id, !on)}
                      className={itemClass}
                      style={{ color: VOID.text }}
                    >
                      <span
                        className="flex size-[22px] shrink-0 items-center justify-center rounded-[5px] [&_svg]:size-3"
                        style={on ? keyOf(3) : { background: "oklch(0.24 0.04 286)", color: VOID.muted, outline: `1px solid ${VOID.rim}` }}
                      >
                        {on ? <ToggleRight /> : <ToggleLeft />}
                      </span>
                      <span className="flex-1">{d.label}</span>
                      <span className={cn("font-mono text-small uppercase tracking-wider")} style={{ color: on ? SCREEN.ink : VOID.muted, textShadow: on ? `0 0 6px ${SCREEN.ink}` : undefined }}>
                        {on ? "on" : "off"}
                      </span>
                    </Command.Item>
                  );
                })}
                {settingGroups.map((g, i) => (
                  <Command.Item key={g.id} value={`settings group ${g.label} ${g.description ?? ""}`} onSelect={() => run(() => ctx.openPanel("settings"))} className={itemClass} style={{ color: VOID.text }}>
                    <Key i={i + 4}><Settings2 /></Key>
                    <span className="flex-1">Open {g.label} settings</span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
            <div className="flex items-center gap-3 px-3 py-1.5 font-mono text-small uppercase tracking-wider" style={{ color: VOID.muted, borderTop: `1px solid ${VOID.rim}` }}>
              <span className="flex items-center gap-1">
                <Kbd raw>↑↓</Kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <Kbd raw>↵</Kbd> run
              </span>
              <span className="ml-auto">{commands.length + registry.nav.length + toggles.length} entries</span>
            </div>
          </Command>
          <style>{`[cmdk-item][data-selected="true"]{background:${VOID.faceLit};box-shadow:inset 0 0 0 1px ${VOID.rim}}`}</style>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
