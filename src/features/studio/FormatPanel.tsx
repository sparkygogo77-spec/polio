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
import { resolvePalette } from "./parts/theme";
import { isCaptured, readSiteFormat, siteSays, type Reading } from "./siteFormat";
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

/** The captured site's readings, for this panel and Settings > This site alike. */
export function useSiteFormat() {
  const nodes = useStudio((s) => s.nodes);
  const look = useStudio((s) => s.look);
  const format = useStudio((s) => s.format);
  const bg = React.useMemo(() => resolvePalette(format, look).bg, [format, look]);
  const captured = React.useMemo(() => isCaptured({ nodes, look }), [nodes, look]);
  const readings = React.useMemo(() => (captured ? readSiteFormat({ nodes, look }, bg) : {}), [captured, nodes, look, bg]);
  return { captured, readings, format };
}

/** A value the site says, shown as the site's, with a way to choose another. */
function ReadValue({ reading, onChange }: { reading: Reading; onChange: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span data-site-reads="" className="max-w-40 truncate rounded-sm border border-border px-1.5 py-0.5 text-small text-fg">{reading.shows}</span>
      <Button size="xs" variant="ghost" onClick={onChange}>Change</Button>
    </div>
  );
}

export function FormatPanel() {
  const showAll = useStudio((s) => s.showAllFormat);
  const setShowAll = useStudio((s) => s.setShowAllFormat);
  const format = useStudio((s) => s.format);
  const resetFormat = useStudio((s) => s.resetFormat);
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();
  const { captured, readings } = useSiteFormat();
  /* Fields the owner asked to change on a captured site: the control shows in place of the reading. */
  const [editing, setEditing] = React.useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = React.useState(false);
  const says = (x: FormatField) => siteSays(x.id, captured, readings, format, x.default);

  const hiddenBySite = FORMAT_FIELDS.filter((x) => says(x).kind === "hidden");
  const visible = FORMAT_FIELDS.filter((x) => {
    const matches = !query || `${x.label} ${x.id} ${(x.options ?? []).join(" ")}`.toLowerCase().includes(query);
    if (says(x).kind === "hidden" && !showHidden) return false;
    return matches && (showAll || !x.advanced || Boolean(query));
  });
  const changed = FORMAT_FIELDS.filter((x) => format[x.id] !== undefined && format[x.id] !== x.default).length;
  const hidden = FORMAT_FIELDS.filter((x) => x.advanced).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-border p-2">
        <Input left={<Search />} placeholder="Search options…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search format options" />
        <div className="flex items-center justify-between">
          <span className="text-small text-fg-faint">{changed ? `${changed} changed` : "all defaults"}</span>
          <div className="flex items-center gap-2">
            <Tooltip content={`${hidden} advanced options`}>
              <label className="flex cursor-pointer items-center gap-1.5 text-small text-fg-muted">
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
                  <div className="text-plain font-semibold text-fg">{group.label}</div>
                  <div className="text-small text-fg-faint">{group.blurb}</div>
                </div>
              </header>
              <ul>
                {fields.map((field) => {
                  const isChanged = format[field.id] !== undefined && format[field.id] !== field.default;
                  const said = says(field);
                  const reading = said.kind === "read" && !editing.has(field.id) ? said.reading : null;
                  const siteHas = readings[field.id];
                  /* Wraps rather than squeezes: in a narrow panel the control goes
                     under the words, and the words keep a readable width, never
                     one word to a line. */
                  return (
                    <li key={field.id} data-format-field={field.id} data-format-from={reading ? "site" : undefined} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-1.5 hover:bg-hover/40">
                      <div className="min-w-[9rem] flex-1">
                        <div className="flex items-center gap-1.5">
                          {isChanged ? <span className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
                          <span className="truncate text-plain text-fg">{field.label}</span>
                          {field.advanced ? (
                            <span className="rounded-xs border border-border px-1 text-fine uppercase text-fg-faint">advanced</span>
                          ) : null}
                          {/* A field the preview does not draw says so, rather than
                              letting a person watch the site not change. It still
                              reaches the blueprint, which is where it matters. */}
                          {!field.live ? (
                            <span data-brief-only="" title="Reaches the blueprint; the preview does not draw it." className="rounded-xs border border-border px-1 text-fine uppercase text-fg-faint">brief</span>
                          ) : null}
                        </div>
                        {reading ? (
                          <div className="text-small text-fg-muted">From the site: {reading.from}.</div>
                        ) : field.hint ? <div className="text-small text-fg-muted">{field.hint}</div> : null}
                        {!reading && captured && siteHas && (isChanged || editing.has(field.id)) ? (
                          <button
                            type="button"
                            data-format-use-site=""
                            className="text-small text-fg-muted underline-offset-2 hover:text-fg hover:underline"
                            onClick={() => { useStudio.getState().setFormat(field.id, field.default); setEditing((e) => { const n = new Set(e); n.delete(field.id); return n; }); }}
                          >
                            Use the site&apos;s: {siteHas.shows}
                          </button>
                        ) : null}
                      </div>
                      <div className="shrink-0">
                        {reading ? <ReadValue reading={reading} onChange={() => setEditing((e) => new Set(e).add(field.id))} /> : <Control field={field} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {hiddenBySite.length ? (
          <p data-format-hidden="" className="px-3 pt-3 text-small leading-snug text-fg-muted">
            {showHidden
              ? `${hiddenBySite.length} options are shown that change nothing on a captured site: its parts carry their own measured type, borders, shadows and spacing.`
              : `${hiddenBySite.length} options are hidden: this site was captured, its parts carry their own measured type, borders, shadows and spacing, so these would change nothing.`}{" "}
            <button type="button" className="text-fg underline-offset-2 hover:underline" onClick={() => setShowHidden((v) => !v)}>
              {showHidden ? "Hide them" : "Show them anyway"}
            </button>
          </p>
        ) : null}
        <p className={cn("p-3 text-small text-fg-faint")}>
          {captured
            ? "Values marked as the site's are read from the captured page. Only what you change is written into the brief as your choice."
            : "Only options you change are written into the brief, so defaults stay out of the builder\u2019s way."}
        </p>
      </div>
    </div>
  );
}
