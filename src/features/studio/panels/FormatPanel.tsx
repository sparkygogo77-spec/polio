"use client";
/**
 * THE FORMAT TAB: A SHORT PAGE, IN TWO PARTS.
 *
 *   (This site, the fonts, base size, corners, page colour and accent,
 *    moved to Look: each is pressed in the site's preview, J 2026-10-09.)
 *   Whole-site features   the switches the shelf shows for the whole site
 *                         (dark and light versions, print, cookie consent,
 *                         error screens, offline, …), each with its state.
 *   Brief for a new build everything else, closed: what kind of site, who
 *                         for, the tone, routing, scroll, data, accounts.
 *                         Those are a generator's brief, and do nothing to a
 *                         site that is already drawn, so they are folded
 *                         away in one place rather than tagged one by one.
 *
 * It was one column of about seventy options, each tagged BRIEF, with the
 * site's own values mixed in and some of them read wrong. `tests/side-panel-g.mjs`.
 */
import * as React from "react";
import { ChevronRight, RotateCcw, Search } from "lucide-react";
import { FORMAT_FIELDS, FORMAT_GROUPS, type FormatField } from "../format";
import { useHeldStudio, useStudio } from "../board/store";
import { resolvePalette } from "../shelf/run";
import { isCaptured, readSiteFormat } from "../siteFormat";
import { formatSwitchKeys, formatSwitches, formatSwitchOn } from "../shelfFacts";
import { parseColor, toHex } from "../look";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Select } from "@/core/ui/select";
import { Slider } from "../HandSlider";
import { Switch } from "@/core/ui/switch";
import { ctxProps } from "@/core/context-menu/ctx";

const FIELD = new Map(FORMAT_FIELDS.map((f) => [f.id, f]));
/** What "This site" shows, in this order. `look.bg` is the page's colour, which is the Look's, not a Format field. */
const SITE_ROWS = ["type.headingFamily", "type.bodyFamily", "type.baseSize", "layout.radius", "look.bg", "palette.accentHue"] as const;
const SWITCH_KEYS = formatSwitchKeys();

function Control({ field }: { field: FormatField }) {
  const value = useHeldStudio((s) => s.format[field.id] ?? field.default);
  const setFormat = useHeldStudio((s) => s.setFormat);
  switch (field.type) {
    case "toggle":
      return <Switch size="sm" checked={Boolean(value)} onCheckedChange={(v) => setFormat(field.id, v)} silent aria-label={field.label} />;
    case "slider":
      return (
        <Slider className="w-36" value={[Number(value)]} min={field.min} max={field.max} step={field.step}
          onValueChange={(v) => setFormat(field.id, v[0] ?? 0)} readout={(n) => `${n}${field.unit ?? ""}`} silent aria-label={field.label} />
      );
    case "text":
      return <Input className="w-44" value={String(value)} placeholder={field.placeholder} onChange={(e) => setFormat(field.id, e.target.value)} aria-label={field.label} />;
    default:
      return (
        <Select className="w-44" value={String(value)} onChange={(v) => setFormat(field.id, v)}
          options={(field.options ?? []).map((o) => ({ value: o, label: o }))} aria-label={field.label} />
      );
  }
}

/** The captured site's readings, for this panel and Settings > This site alike. */
export function useSiteFormat() {
  const nodes = useHeldStudio((s) => s.nodes);
  const look = useHeldStudio((s) => s.look);
  const format = useHeldStudio((s) => s.format);
  const bg = React.useMemo(() => resolvePalette(format, look).bg, [format, look]);
  const captured = React.useMemo(() => isCaptured({ nodes, look }), [nodes, look]);
  const readings = React.useMemo(() => (captured ? readSiteFormat({ nodes, look, format }, bg) : {}), [captured, nodes, look, format, bg]);
  return { captured, readings, format, bg };
}

/** A colour said the way a person would: light yellow, dark blue. */
export function colourWords(v: string | null | undefined): string {
  const c = parseColor(v ?? "");
  if (!c) return "not set";
  const tone = c.l >= 0.8 ? "light " : c.l < 0.4 ? "dark " : "";
  if (c.c < 0.03) return c.l >= 0.95 ? "white" : c.l < 0.2 ? "black" : `${tone}grey`;
  const h = ((c.h % 360) + 360) % 360;
  const name = h < 20 ? "pink" : h < 45 ? "red" : h < 70 ? "orange" : h < 110 ? "yellow" : h < 160 ? "green" : h < 200 ? "teal" : h < 250 ? "blue" : h < 300 ? "purple" : h < 345 ? "magenta" : "pink";
  return `${tone}${name}`;
}
const hexOf = (v: string | null | undefined) => { const c = parseColor(v ?? ""); return c ? toHex(c) : "#000000"; };

function Head({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <header className="px-3 pb-1 pt-3">
      <h3 className="text-small font-semibold uppercase tracking-[0.08em] text-fg">{title}</h3>
      {blurb ? <p className="text-small leading-snug text-fg-muted">{blurb}</p> : null}
    </header>
  );
}

function WholeSite() {
  const format = useHeldStudio((s) => s.format);
  const setFormat = useHeldStudio((s) => s.setFormat);
  /* Page transitions are dropped onto the page from the Motion shelf, not switched here (J, 2026-10-09). */
  const fields = formatSwitches().filter((sw) => sw.key !== "pages.transition").map((sw) => ({ sw, f: FIELD.get(sw.key) })).filter((x): x is { sw: (typeof x)["sw"]; f: FormatField } => !!x.f);
  return (
    <section data-format-section="whole-site" className="border-b border-border pb-1.5">
      <Head title="Whole-site features" blurb="Switched on for every page, and written into the brief." />
      <ul>
        {fields.map(({ sw, f }) => {
          /* On and off as the shelf reads them: a choice (page transitions, the accessibility bar) has its own two values. */
          const v = format[f.id] ?? f.default;
          const on = formatSwitchOn(sw, v);
          return (
            <li key={f.id} data-format-switch={f.id} data-on={on ? "" : undefined} className="flex items-center gap-2 px-3 py-1">
              <span className="min-w-0 flex-1 truncate text-plain text-fg" title={f.hint}>{f.label}</span>
              <span className={cn("text-small", on ? "text-accent" : "text-fg-faint")}>{on ? "On" : "Off"}</span>
              <Switch size="sm" checked={on} silent aria-label={f.label}
                onCheckedChange={(next) => setFormat(f.id, next ? sw.on : sw.off)} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Everything else, closed: the brief a generator reads when it builds a new site. */
function BriefFold() {
  const format = useHeldStudio((s) => s.format);
  const resetFormat = useHeldStudio((s) => s.resetFormat);
  const { captured } = useSiteFormat();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();
  const taken = new Set<string>([...SITE_ROWS, ...SWITCH_KEYS]);
  /* On a captured site light or dark is the page's colour above, never a second value down here. */
  if (captured) taken.add("palette.mode");
  const fields = FORMAT_FIELDS.filter((f) => !taken.has(f.id) && (!query || `${f.label} ${f.id} ${(f.options ?? []).join(" ")}`.toLowerCase().includes(query)));
  const changed = FORMAT_FIELDS.filter((x) => !taken.has(x.id) && format[x.id] !== undefined && format[x.id] !== x.default).length;
  return (
    <section data-format-section="brief" data-open={open ? "" : undefined}>
      <button type="button" data-brief-fold="" aria-expanded={open} onClick={() => { play(open ? "close" : "open"); setOpen((v) => !v); }}
        className="tactile flex w-full items-start gap-2 px-3 pb-2 pt-3 text-left hover:bg-hover/40">
        <ChevronRight className={cn("mt-0.5 size-3.5 shrink-0 text-fg-faint transition-transform", open && "rotate-90")} />
        <span className="min-w-0 flex-1">
          <span className="block text-small font-semibold uppercase tracking-[0.08em] text-fg">Brief for a new build</span>
          <span className="block text-small leading-snug text-fg-muted">
            What a builder is told when it makes a new site from this: kind of site, audience, tone, pages, scroll, data.{captured ? " None of it changes the captured page." : ""}
          </span>
        </span>
        <span className="shrink-0 text-fine text-fg-faint">{changed ? `${changed} set` : `${fields.length}`}</span>
      </button>
      {open ? (
        <div className="pb-3">
          <div className="flex items-center gap-1.5 px-3 pb-2">
            <Input left={<Search />} placeholder="Search the brief…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search format options" className="min-w-0 flex-1" />
            <Button variant="ghost" size="iconXs" aria-label="Reset format" title="Put every option back" disabled={!changed} onClick={resetFormat}><RotateCcw /></Button>
          </div>
          {FORMAT_GROUPS.map((group) => {
            const list = fields.filter((x) => x.group === group.id);
            if (!list.length) return null;
            return (
              <div key={group.id} {...ctxProps("studio-format-group", group.id, group)} className="pb-1">
                <div className="px-3 pb-0.5 pt-2 text-fine font-semibold uppercase tracking-[0.08em] text-fg-faint">{group.label}</div>
                <ul>
                  {list.map((field) => {
                    const isChanged = format[field.id] !== undefined && format[field.id] !== field.default;
                    return (
                      <li key={field.id} data-format-field={field.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-1 hover:bg-hover/40">
                        <div className="min-w-[8rem] flex-1">
                          <div className="flex items-center gap-1.5">
                            {isChanged ? <span className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
                            <span className="truncate text-plain text-fg">{field.label}</span>
                          </div>
                          {field.hint ? <div className="text-small leading-snug text-fg-muted">{field.hint}</div> : null}
                        </div>
                        <div className="shrink-0"><Control field={field} /></div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function FormatPanel() {
  return (
    <div data-format-panel="" className="flex h-full min-h-0 flex-col overflow-y-auto">
      {/* The site's fonts, size, corners and colours are edited in Look, by pressing them in its preview (J, 2026-10-09). */}
      <WholeSite />
      <BriefFold />
    </div>
  );
}
