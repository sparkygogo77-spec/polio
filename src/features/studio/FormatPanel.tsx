"use client";
/**
 * Site format options, rendered generically from `format.ts`. Most fields are
 * behind "all options" so the default view stays short — the same rule the
 * settings drawer follows.
 */
import * as React from "react";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { FORMAT_FIELDS, FORMAT_GROUPS, type FormatField } from "./format";
import { useStudio } from "./store";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Select } from "@/core/ui/select";
import { Slider } from "@/core/ui/slider";
import { Switch } from "@/core/ui/switch";
import { Tooltip } from "@/core/ui/tooltip";
import { ctxProps } from "@/core/context-menu/ctx";

function Control({ field }: { field: FormatField }) {
  const value = useStudio((s) => s.format[field.id] ?? field.default);
  const setFormat = useStudio((s) => s.setFormat);
  switch (field.type) {
    case "toggle":
      return <Switch size="sm" checked={Boolean(value)} onCheckedChange={(v) => setFormat(field.id, v)} silent aria-label={field.label} />;
    case "slider":
      return (
        <Slider
          className="w-36"
          value={[Number(value)]}
          min={field.min}
          max={field.max}
          step={field.step}
          onValueChange={(v) => setFormat(field.id, v[0] ?? 0)}
          readout={(n) => `${n}${field.unit ?? ""}`}
          silent
          aria-label={field.label}
        />
      );
    case "text":
      return (
        <Input
          className="w-44"
          value={String(value)}
          placeholder={field.placeholder}
          onChange={(e) => setFormat(field.id, e.target.value)}
          aria-label={field.label}
        />
      );
    default:
      return (
        <Select
          className="w-44"
          value={String(value)}
          onChange={(v) => setFormat(field.id, v)}
          options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
          aria-label={field.label}
        />
      );
  }
}

export function FormatPanel() {
  const showAll = useStudio((s) => s.showAllFormat);
  const setShowAll = useStudio((s) => s.setShowAllFormat);
  const format = useStudio((s) => s.format);
  const resetFormat = useStudio((s) => s.resetFormat);
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();

  const visible = FORMAT_FIELDS.filter((x) => {
    const matches = !query || `${x.label} ${x.id} ${(x.options ?? []).join(" ")}`.toLowerCase().includes(query);
    return matches && (showAll || !x.advanced || Boolean(query));
  });
  const changed = FORMAT_FIELDS.filter((x) => format[x.id] !== undefined && format[x.id] !== x.default).length;
  const hidden = FORMAT_FIELDS.filter((x) => x.advanced).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-border p-2">
        <Input left={<Search />} placeholder="Search options…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search format options" />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-fg-faint">{changed ? `${changed} changed` : "all defaults"}</span>
          <div className="flex items-center gap-2">
            <Tooltip content={`${hidden} advanced options`}>
              <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-fg-muted">
                <SlidersHorizontal className="size-3" />
                All options
                <Switch size="sm" checked={showAll} onCheckedChange={setShowAll} />
              </label>
            </Tooltip>
            <Tooltip content="Reset format">
              <Button variant="ghost" size="iconXs" aria-label="Reset format" disabled={!changed} onClick={resetFormat}>
                <RotateCcw />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {FORMAT_GROUPS.map((group) => {
          const fields = visible.filter((x) => x.group === group.id);
          if (!fields.length) return null;
          const GroupIcon = group.icon;
          return (
            <section key={group.id} {...ctxProps("studio-format-group", group.id, group)} className="border-b border-border">
              <header className="sticky top-0 z-10 flex items-center gap-2 bg-panel/90 px-3 py-1.5 backdrop-blur">
                <GroupIcon className="size-3.5 text-accent" />
                <div className="flex-1 leading-tight">
                  <div className="text-[11px] font-semibold text-fg">{group.label}</div>
                  <div className="text-[10px] text-fg-faint">{group.blurb}</div>
                </div>
              </header>
              <ul>
                {fields.map((field) => {
                  const isChanged = format[field.id] !== undefined && format[field.id] !== field.default;
                  return (
                    <li key={field.id} className="flex items-center justify-between gap-3 px-3 py-1.5 hover:bg-hover/40">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {isChanged ? <span className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
                          <span className="truncate text-[11px] text-fg">{field.label}</span>
                          {field.advanced ? (
                            <span className="rounded-xs border border-border px-1 text-[9px] uppercase text-fg-faint">adv</span>
                          ) : null}
                        </div>
                        {field.hint ? <div className="text-[10px] text-fg-muted">{field.hint}</div> : null}
                      </div>
                      <div className="shrink-0">
                        <Control field={field} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        <p className={cn("p-3 text-[10px] text-fg-faint")}>
          Only options you change are written into the brief, so defaults stay out of the builder&apos;s way.
        </p>
      </div>
    </div>
  );
}
