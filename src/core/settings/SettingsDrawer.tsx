"use client";
import * as React from "react";
import { Download, RotateCcw, Search, Settings, SlidersHorizontal, Upload } from "lucide-react";
import { allSettingDefs, allSettingGroups, exportSettings, useSettings } from "./store";
import { useUi } from "@/core/ui-state/store";
import { useActions } from "@/core/actions";
import { cn } from "@/core/lib/cn";
import { labelValue } from "@/core/lib/format";
import { SlideOver } from "@/core/shell/SlideOver";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Switch } from "@/core/ui/switch";
import { Slider } from "@/core/ui/slider";
import { Segmented } from "@/core/ui/segmented";
import { Select } from "@/core/ui/select";
import { Tooltip } from "@/core/ui/tooltip";
import { ScrollArea } from "@/core/ui/scroll-area";
import type { SettingDef } from "@/core/types";

export function Control({ def, value, onChange }: { def: SettingDef; value: unknown; onChange: (v: unknown) => void }) {
  switch (def.type) {
    case "toggle":
      return <Switch checked={Boolean(value)} onCheckedChange={onChange} silent aria-label={def.label} />;
    case "segmented":
      return <Segmented size="xs" value={String(value)} onChange={onChange} options={(def.options ?? []).map((o) => ({ value: o.value, label: o.label }))} silent aria-label={def.label} />;
    case "select":
      return <Select value={String(value)} onChange={onChange} options={def.options ?? []} className="w-40" aria-label={def.label} />;
    case "slider":
      return (
        <Slider
          className="w-48"
          value={[Number(value)]}
          min={def.min}
          max={def.max}
          step={def.step}
          onValueChange={(v) => onChange(v[0])}
          readout={(n) => (def.format ? (def.format as (v: unknown) => string)(n) : labelValue(n))}
          silent
          aria-label={def.label}
        />
      );
    case "hue":
      return (
        <div className="flex w-48 items-center gap-2">
          <div className="relative h-5 flex-1">
            <div
              className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
              style={{ background: "linear-gradient(90deg, oklch(0.75 0.17 0), oklch(0.75 0.17 60), oklch(0.75 0.17 120), oklch(0.75 0.17 180), oklch(0.75 0.17 240), oklch(0.75 0.17 300), oklch(0.75 0.17 360))" }}
            />
            <Slider className="absolute inset-0 [&_[data-orientation]]:bg-transparent [&_span[data-orientation]>span]:bg-transparent" value={[Number(value)]} min={0} max={360} step={1} onValueChange={(v) => onChange(v[0])} silent aria-label={def.label} />
          </div>
          <span className="size-4 shrink-0 rounded-sm border border-border" style={{ background: `oklch(0.75 0.17 ${Number(value)})` }} />
          <span className="num w-7 text-right text-small text-fg-muted">{Number(value)}°</span>
        </div>
      );
    case "number":
      return <Input type="number" className="w-24" value={String(value)} min={def.min} max={def.max} step={def.step} onChange={(e) => onChange(Number(e.target.value))} aria-label={def.label} />;
    case "text":
    case "color":
    default:
      return <Input className="w-40" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} aria-label={def.label} />;
  }
}

/**
 * One row of the drawer.
 *
 * Its own component for one reason: a setting that owns its truth elsewhere
 * (`read`/`write`/`subscribe` on the definition — the site's own options, not
 * the Builder's) has to re-render when *that* store moves, and a hook cannot
 * be called inside a `.map` in the parent. `useSyncExternalStore` is handed
 * the definition's own subscribe, so a change made anywhere else — the Format
 * panel, the part menu, opening a different site — repaints this row.
 *
 * A setting with no `read` behaves exactly as it always did.
 */
function Row({ def, stored, isStored, onSet, onReset }: {
  def: SettingDef;
  stored: unknown;
  isStored: boolean;
  onSet: (v: unknown) => void;
  onReset: () => void;
}) {
  const owned = Boolean(def.read && def.write && def.subscribe);
  const external = React.useSyncExternalStore(
    React.useCallback((fn: () => void) => (def.subscribe ? def.subscribe(fn) : () => {}), [def]),
    () => (def.read ? def.read() : undefined),
    () => (def.read ? def.read() : undefined),
  );
  const value = owned ? external : stored;
  /* A value read from the thing itself (a captured site's own face), shown as that rather than as a default. */
  const readKey = React.useSyncExternalStore(
    React.useCallback((fn: () => void) => (def.subscribe ? def.subscribe(fn) : () => {}), [def]),
    () => { const r = def.readout?.(); return r ? `${r.shows}\u0000${r.from}` : ""; },
    () => "",
  );
  const [changing, setChanging] = React.useState(false);
  const readout = readKey && !changing ? { shows: readKey.split("\u0000")[0]!, from: readKey.split("\u0000")[1]! } : null;
  /* "Changed" for an owned setting is measured against its declared default,
     because there is no entry in the settings store to look for. */
  const changed = owned ? !Object.is(value, def.default) : isStored;
  const set = (v: unknown) => (owned ? def.write!(v) : onSet(v));
  const reset = () => (owned ? def.write!(def.default) : onReset());

  return (
    <li data-setting={def.id} data-setting-from={readout ? "site" : undefined} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 hover:bg-hover/40">
      <div className="min-w-[9rem] flex-1">
        <div className="flex items-center gap-1.5">
          {changed ? (
            <Tooltip content="Changed. Click to reset.">
              <button type="button" aria-label="Reset" onClick={reset} className="size-1.5 rounded-full bg-accent" />
            </Tooltip>
          ) : null}
          <span className="truncate text-xs text-fg">{def.label}</span>
          {def.advanced ? <span className="rounded-xs border border-border px-1 text-fine uppercase tracking-wider text-fg-faint">adv</span> : null}
        </div>
        {readout ? <div className="text-small text-fg-muted">From the site: {readout.from}.</div>
          : def.description ? <div className="text-small text-fg-muted">{def.description}</div> : null}
      </div>
      <div className="shrink-0">
        {readout ? (
          <div className="flex items-center gap-1.5">
            <span data-setting-reads="" className="max-w-40 truncate rounded-sm border border-border px-1.5 py-0.5 text-small text-fg">{readout.shows}</span>
            <button type="button" className="tactile rounded-sm px-1.5 py-0.5 text-small text-fg-muted hover:text-fg" onClick={() => setChanging(true)}>Change</button>
          </div>
        ) : <Control def={def} value={value} onChange={set} />}
      </div>
    </li>
  );
}

export function SettingsDrawer() {
  const open = useUi((s) => s.panels.settings);
  const closePanel = useUi((s) => s.closePanel);
  const values = useSettings((s) => s.values);
  const set = useSettings((s) => s.set);
  const reset = useSettings((s) => s.reset);
  const resetGroup = useSettings((s) => s.resetGroup);
  const resetAll = useSettings((s) => s.resetAll);
  const advanced = useSettings((s) => s.advanced);
  const setAdvanced = useSettings((s) => s.setAdvanced);
  const importValues = useSettings((s) => s.importValues);
  const ctx = useActions();
  const [q, setQ] = React.useState("");
  const [group, setGroup] = React.useState<string>("all");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const groups = allSettingGroups();
  /* A control a module keeps in its own console is not the drawer's to show. */
  const defs = allSettingDefs().filter((d) => !d.panel);
  const query = q.trim().toLowerCase();
  const matches = (d: SettingDef) =>
    !query || [d.label, d.description ?? "", d.id, ...(d.tags ?? [])].some((s) => s.toLowerCase().includes(query));
  const visible = defs.filter((d) => (!d.when || d.when()) && (advanced || !d.advanced || query) && matches(d) && (group === "all" || d.group === group));
  const byGroup = new Map<string, SettingDef[]>();
  for (const d of visible) byGroup.set(d.group, [...(byGroup.get(d.group) ?? []), d]);
  const modified = Object.keys(values).length;
  const hiddenCount = defs.filter((d) => d.advanced).length;
  /*
   * A tab that leads nowhere is not offered.
   *
   * TWO OF THEM READ EMPTY ON HIS BOARD. Every option in Developer and in
   * Keys was marked advanced, and the strip listed every group whether or not
   * it had anything to show at the level being looked at \u2014 so the tab was
   * there, he pressed it, and it said "No options match". What can be reached
   * from here is worked out the same way the list below is, from what is
   * actually visible, so the two can never disagree again.
   */
  const reachable = defs.filter((d) => (!d.when || d.when()) && (advanced || !d.advanced || query) && matches(d));
  const offered = groups.filter((g) => reachable.some((d) => d.group === g.id));

  const doExport = () => {
    const json = JSON.stringify(exportSettings(), null, 2);
    void ctx.copy(json, "settings JSON");
  };
  const doImport = (file: File) => {
    void file.text().then((t) => {
      try {
        const parsed = JSON.parse(t) as Record<string, unknown>;
        importValues(parsed);
        ctx.publish({ key: "settings:import", title: "Settings imported", body: `${Object.keys(parsed).length} values`, level: "success", source: "settings", toast: true });
      } catch {
        ctx.publish({ key: "settings:import", title: "Import failed", body: "Not valid JSON", level: "error", source: "settings", toast: true });
      }
    });
  };

  return (
    <SlideOver
      open={open}
      onClose={() => closePanel("settings")}
      title="Settings"
      subtitle={modified ? `${modified} changed from default` : "Everything at defaults"}
      icon={Settings}
      actions={
        <>
          <Tooltip content="Copy settings as JSON">
            <Button variant="ghost" size="iconXs" aria-label="Export" onClick={doExport}>
              <Download />
            </Button>
          </Tooltip>
          <Tooltip content="Import JSON">
            <Button variant="ghost" size="iconXs" aria-label="Import" onClick={() => fileRef.current?.click()}>
              <Upload />
            </Button>
          </Tooltip>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          <Tooltip content="Reset everything">
            <Button
              variant="ghost"
              size="iconXs"
              aria-label="Reset all"
              disabled={!modified}
              onClick={() => void ctx.confirm({ title: "Reset all settings?", body: "Every option returns to its default.", danger: true, confirmLabel: "Reset" }).then((ok) => ok && resetAll())}
            >
              <RotateCcw />
            </Button>
          </Tooltip>
        </>
      }
    >
      <div className="flex flex-col gap-2 border-b border-border p-2">
        <Input left={<Search />} placeholder="Search options…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1 overflow-x-auto hide-scrollbar">
            <button type="button" onClick={() => setGroup("all")} className={cn("tactile shrink-0 rounded-sm px-1.5 py-0.5 text-small", group === "all" ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-hover")}>
              All
            </button>
            {/* The tab carries the group's colour too, or picking a category
                and then looking at its heading would be two different
                colours for one thing. Off, it is dimmed rather than greyed:
                the hue is what says which category this is, so it never
                goes away entirely. */}
            {offered.map((g) => {
              const on = group === g.id;
              const GIcon = g.icon;
              const tint = g.hue == null ? undefined : `oklch(0.82 0.15 ${g.hue})`;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroup(g.id)}
                  className={cn("tactile flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-small", !tint && (on ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-hover"))}
                  style={tint ? { color: tint, background: on ? `oklch(0.82 0.15 ${g.hue} / 0.16)` : undefined, opacity: on ? 1 : 0.7 } : undefined}
                >
                  {GIcon ? <GIcon className="size-3" /> : null}
                  {g.label}
                </button>
              );
            })}
          </div>
          <Tooltip content={`${hiddenCount} advanced options`}>
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-small text-fg-muted">
              <SlidersHorizontal className="size-3" />
              Advanced
              <Switch size="sm" checked={advanced} onCheckedChange={setAdvanced} />
            </label>
          </Tooltip>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {byGroup.size === 0 ? <div className="p-6 text-center text-xs text-fg-muted">No options match.</div> : null}
        {groups
          .filter((g) => byGroup.has(g.id))
          .map((g) => {
            const list = byGroup.get(g.id)!;
            const GIcon = g.icon;
            const groupModified = list.some((d) => d.id in values);
            return (
              <section key={g.id} className="border-b border-border">
                <header className="sticky top-0 z-10 flex items-center gap-2 bg-panel/90 px-3 py-1.5 backdrop-blur">
                  {GIcon ? <GIcon className="size-3.5" style={g.hue == null ? undefined : { color: `oklch(0.82 0.15 ${g.hue})` }} /> : null}
                  <div className="flex-1 leading-tight">
                    <div className="text-plain font-semibold text-fg">{g.label}</div>
                    {g.description ? <div className="text-small text-fg-faint">{g.description}</div> : null}
                  </div>
                  {groupModified ? (
                    <Tooltip content="Reset this group">
                      <Button variant="ghost" size="iconXs" aria-label={`Reset ${g.label}`} onClick={() => resetGroup(g.id)}>
                        <RotateCcw />
                      </Button>
                    </Tooltip>
                  ) : null}
                </header>
                <ul>
                  {list.map((d) => (
                    <Row
                      key={d.id}
                      def={d}
                      stored={d.id in values ? values[d.id] : d.default}
                      isStored={d.id in values}
                      onSet={(nv) => set(d.id, nv)}
                      onReset={() => reset(d.id)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        <div className="p-3 text-small text-fg-faint">
          Settings persist in this browser. Right-click anywhere for quick toggles.
        </div>
      </ScrollArea>
    </SlideOver>
  );
}
