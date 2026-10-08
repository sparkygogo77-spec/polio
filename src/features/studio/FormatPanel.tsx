"use client";
/**
 * THE FORMAT TAB: A SHORT PAGE, IN THREE PARTS.
 *
 *   This site             the six things a person reads a site by: the
 *                         heading and body fonts, the base size, the
 *                         corners, the page's colour and the accent. On a
 *                         captured site each is read off its parts
 *                         (`siteFormat.ts`), shown once, with a Change that
 *                         changes it where the site has it.
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
import { ChevronRight, RotateCcw, Search, Undo2 } from "lucide-react";
import { FORMAT_FIELDS, FORMAT_GROUPS, type FormatField } from "./format";
import { useStudio } from "./board/store";
import { FAMILY, resolvePalette } from "./parts/theme";
import { isCaptured, readSiteFormat, type Reading } from "./siteFormat";
import { fontsInPageOrder, type FaceTo } from "./siteColours";
import { formatSwitchKeys, formatSwitches, formatSwitchOn } from "./shelfFacts";
import { parseColor, toHex } from "./look";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Select } from "@/core/ui/select";
import { Slider } from "@/core/ui/slider";
import { Switch } from "@/core/ui/switch";
import { ctxProps } from "@/core/context-menu/ctx";

const FIELD = new Map(FORMAT_FIELDS.map((f) => [f.id, f]));
/** What "This site" shows, in this order. `look.bg` is the page's colour, which is the Look's, not a Format field. */
const SITE_ROWS = ["type.headingFamily", "type.bodyFamily", "type.baseSize", "layout.radius", "look.bg", "palette.accentHue"] as const;
const SWITCH_KEYS = formatSwitchKeys();

function Control({ field }: { field: FormatField }) {
  const value = useStudio((s) => s.format[field.id] ?? field.default);
  const setFormat = useStudio((s) => s.setFormat);
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
  const nodes = useStudio((s) => s.nodes);
  const look = useStudio((s) => s.look);
  const format = useStudio((s) => s.format);
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

/** One row of "This site": its name, the one value, and a Change that opens the control in place. */
function SiteRow({ id, label, shows, from, swatch, face, children, open, onOpen }: {
  id: string; label: string; shows: string; from?: string; swatch?: string; face?: string;
  children: React.ReactNode; open: boolean; onOpen: () => void;
}) {
  return (
    <li data-site-row={id} className="px-3 py-1.5">
      <div className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-plain text-fg-muted">{label}</span>
        <span data-site-reads="" className="flex min-w-0 flex-1 items-center gap-1.5 text-plain text-fg" title={from ? `From the site: ${from}` : undefined}>
          {swatch ? <span className="size-3.5 shrink-0 rounded-sm border border-border" style={{ background: swatch }} /> : null}
          <span className="truncate" style={face ? { fontFamily: FAMILY[face] ?? `"${face}"` } : undefined}>{shows}</span>
        </span>
        <Button size="xs" variant={open ? "outline" : "ghost"} aria-expanded={open} data-site-change="" onClick={() => { play(open ? "close" : "open"); onOpen(); }}>
          {open ? "Done" : "Change"}
        </Button>
      </div>
      {from && !open ? <div className="pl-[6.5rem] text-fine leading-snug text-fg-faint">{from}</div> : null}
      {open ? <div className="mt-1.5 space-y-1.5 rounded-md border border-border bg-elevated/40 p-2">{children}</div> : null}
    </li>
  );
}

/** Every part set in one face, set in another: the Look panel's swap-all, from here. */
function FaceSwap({ from }: { from: string }) {
  const nodes = useStudio((s) => s.nodes);
  const carried = useStudio((s) => s.look.fonts);
  const [to, setTo] = React.useState("");
  const [done, setDone] = React.useState<number | null>(null);
  const pages = useStudio((s) => s.pages);
  /* The site's faces in page order, then any it carries that no part uses (`fontsInPageOrder`). */
  const fonts = React.useMemo(() => fontsInPageOrder(nodes, pages.map((p) => p.id)), [nodes, pages]);
  const parts = fonts.find((f) => f.key === from)?.parts ?? 0;
  const faces = [...new Set([...fonts.map((f) => f.key).filter((k) => k && !FAMILY[k]), ...(carried ?? []).map((f) => f.family)])].filter((f) => f !== from);
  const targets: { id: string; label: string; to: FaceTo }[] = [
    ...faces.map((f) => ({ id: `face:${f}`, label: f, to: { face: f } as FaceTo })),
    ...Object.keys(FAMILY).filter((k) => k !== from).map((k) => ({ id: `family:${k}`, label: k, to: { family: k } as FaceTo })),
  ];
  return (
    <>
      <div className="flex items-center gap-1.5">
        <Select className="min-w-0 flex-1" aria-label="New face" value={to} placeholder="choose a face…" onChange={setTo} options={targets.map((t) => ({ value: t.id, label: t.label }))} />
        <Button size="xs" variant="primary" disabled={!to} onClick={() => {
          const t = targets.find((x) => x.id === to);
          if (!t) return;
          const changed = useStudio.getState().swapFontAll(from, t.to);
          play(changed.length ? "confirm" : "deny");
          setDone(changed.length);
          setTo("");
        }}>Set {parts === 1 ? "it" : `all ${parts}`}</Button>
      </div>
      {done !== null ? (
        <p className="flex items-center gap-2 text-small text-fg-muted">
          {done} part{done === 1 ? "" : "s"} changed.
          <button type="button" className="inline-flex items-center gap-1 text-fg hover:underline" onClick={() => { useStudio.getState().undo(); setDone(null); play("close"); }}><Undo2 className="size-3" /> Undo</button>
        </p>
      ) : <p className="text-fine leading-snug text-fg-faint">Every part set in {from} changes, in one step you can undo.</p>}
    </>
  );
}

/** Every part wearing one colour, wearing another. */
function ColourSwap({ from }: { from: string }) {
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const [to, setTo] = React.useState(hexOf(from));
  const [done, setDone] = React.useState<number | null>(null);
  return (
    <>
      <div className="flex items-center gap-1.5">
        <input type="color" aria-label="New colour" value={to} onChange={(e) => setTo(e.target.value)} className="h-7 w-10 shrink-0 cursor-pointer rounded-sm border border-border bg-transparent" />
        <span className="min-w-0 flex-1 truncate text-small text-fg-muted">{colourWords(to)}</span>
        <Button size="xs" variant="primary" disabled={to.toLowerCase() === hexOf(from).toLowerCase()} onClick={() => {
          const changed = useStudio.getState().swapColourAll(from, to, resolvePalette(format, look));
          play(changed.length ? "confirm" : "deny");
          setDone(changed.length);
        }}>Use it</Button>
      </div>
      {done !== null ? (
        <p className="flex items-center gap-2 text-small text-fg-muted">
          {done} part{done === 1 ? "" : "s"} changed.
          <button type="button" className="inline-flex items-center gap-1 text-fg hover:underline" onClick={() => { useStudio.getState().undo(); setDone(null); play("close"); }}><Undo2 className="size-3" /> Undo</button>
        </p>
      ) : <p className="text-fine leading-snug text-fg-faint">Every part wearing this colour changes, in one step you can undo.</p>}
    </>
  );
}

function ThisSite() {
  const { captured, readings, format, bg } = useSiteFormat();
  const [open, setOpen] = React.useState<string | null>(null);
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  const val = (id: string) => format[id] ?? FIELD.get(id)?.default;
  const read = (id: string): Reading | undefined => (captured ? readings[id] : undefined);
  const rows = SITE_ROWS.map((id) => {
    if (id === "look.bg") {
      const r = read("palette.mode");
      const colour = r?.colour ?? bg;
      return (
        <SiteRow key={id} id="page-colour" label="Page colour" shows={colourWords(colour)} swatch={colour}
          from={r ? `${r.from}, ${hexOf(colour)}` : hexOf(colour)} open={open === id} onOpen={() => toggle(id)}>
          {captured ? <ColourSwap from={colour} /> : (
            <Button size="xs" variant="outline" className="w-full" onClick={() => window.dispatchEvent(new CustomEvent("studio:panel", { detail: "look" }))}>Open the Look tab to set it</Button>
          )}
        </SiteRow>
      );
    }
    const field = FIELD.get(id)!;
    const r = read(id);
    if (id === "palette.accentHue") {
      const colour = r?.colour ?? resolvePalette(format, useStudio.getState().look).accent;
      return (
        <SiteRow key={id} id="accent" label="Accent" shows={colourWords(colour)} swatch={colour} from={r ? `${r.from.replace(/ \(\d+ parts?\)$/, "")}, ${hexOf(colour)}` : hexOf(colour)} open={open === id} onOpen={() => toggle(id)}>
          {captured && r?.colour ? <ColourSwap from={r.colour} /> : <Control field={field} />}
        </SiteRow>
      );
    }
    const isFace = id === "type.headingFamily" || id === "type.bodyFamily";
    const shows = r ? r.shows : `${val(id)}${field.unit ?? ""}`;
    return (
      <SiteRow key={id} id={id} label={field.label} shows={shows} face={isFace && r ? r.shows : undefined} from={r?.from} open={open === id} onOpen={() => toggle(id)}>
        {captured && isFace && r ? <FaceSwap from={r.shows} /> : (
          <>
            <Control field={field} />
            {captured && id === "layout.radius" ? <p className="text-fine leading-snug text-fg-faint">Boxes the site rounded keep their own corners; this sets the rest.</p> : null}
            {captured && id === "type.baseSize" ? <p className="text-fine leading-snug text-fg-faint">Every word on the site is sized from this, so they all grow or shrink together.</p> : null}
          </>
        )}
      </SiteRow>
    );
  });
  return (
    <section data-format-section="site" className="border-b border-border pb-1.5">
      <Head title="This site" blurb={captured ? "Read from the parts of the captured page." : "The type, corners and colours every part starts from."} />
      <ul>{rows}</ul>
    </section>
  );
}

function Head({ title, blurb }: { title: string; blurb?: string }) {
  return (
    <header className="px-3 pb-1 pt-3">
      <h3 className="text-small font-semibold uppercase tracking-[0.08em] text-fg">{title}</h3>
      {blurb ? <p className="text-small leading-snug text-fg-muted">{blurb}</p> : null}
    </header>
  );
}

function WholeSite() {
  const format = useStudio((s) => s.format);
  const setFormat = useStudio((s) => s.setFormat);
  const fields = formatSwitches().map((sw) => ({ sw, f: FIELD.get(sw.key) })).filter((x): x is { sw: (typeof x)["sw"]; f: FormatField } => !!x.f);
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
  const format = useStudio((s) => s.format);
  const resetFormat = useStudio((s) => s.resetFormat);
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
      <ThisSite />
      <WholeSite />
      <BriefFold />
    </div>
  );
}
