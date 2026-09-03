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

function Control({ def, value, onChange }: { def: SettingDef; value: unknown; onChange: (v: unknown) => void }) {
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
          <span className="num w-7 text-right text-[10px] text-fg-muted">{Number(value)}°</span>
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
  const defs = allSettingDefs();
  const query = q.trim().toLowerCase();
  const matches = (d: SettingDef) =>
    !query || [d.label, d.description ?? "", d.id, ...(d.tags ?? [])].some((s) => s.toLowerCase().includes(query));
  const visible = defs.filter((d) => (advanced || !d.advanced || query) && matches(d) && (group === "all" || d.group === group));
  const byGroup = new Map<string, SettingDef[]>();
  for (const d of visible) byGroup.set(d.group, [...(byGroup.get(d.group) ?? []), d]);
  const modified = Object.keys(values).length;
  const hiddenCount = defs.filter((d) => d.advanced).length;

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
            <button type="button" onClick={() => setGroup("all")} className={cn("tactile shrink-0 rounded-sm px-1.5 py-0.5 text-[10px]", group === "all" ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-hover")}>
              All
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroup(g.id)}
                className={cn("tactile shrink-0 rounded-sm px-1.5 py-0.5 text-[10px]", group === g.id ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-hover")}
              >
                {g.label}
              </button>
            ))}
          </div>
          <Tooltip content={`${hiddenCount} advanced options`}>
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[10px] text-fg-muted">
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
                  {GIcon ? <GIcon className="size-3.5 text-accent" /> : null}
                  <div className="flex-1 leading-tight">
                    <div className="text-[11px] font-semibold text-fg">{g.label}</div>
                    {g.description ? <div className="text-[10px] text-fg-faint">{g.description}</div> : null}
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
                            {d.advanced ? <span className="rounded-xs border border-border px-1 text-[9px] uppercase tracking-wider text-fg-faint">adv</span> : null}
                          </div>
                          {d.description ? <div className="text-[10px] text-fg-muted">{d.description}</div> : null}
                        </div>
                        <div className="shrink-0">
                          <Control def={d} value={v} onChange={(nv) => set(d.id, nv)} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        <div className="p-3 text-[10px] text-fg-faint">
          Settings persist in this browser. Right-click anywhere for quick toggles.
        </div>
      </ScrollArea>
    </SlideOver>
  );
}
