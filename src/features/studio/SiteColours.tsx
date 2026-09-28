"use client";
/**
 * ON THIS SITE: every colour and face the parts use, and swap-all.
 *
 * The six roles above this are how a site made here is painted. A site
 * brought in was not painted that way — trumpmorty.fun wears one near-black
 * on its words, outlines, hard shadows and eight fills, a dozen pastels one
 * card each, and three faces — so under the roles the panel lists what the
 * parts actually wear, grouped by what it is used for, each with how many
 * parts use it that way (`siteColours.ts`, docs/audit/palette-captured.md).
 *
 * Press a swatch and it says which parts wear it and for what (press one to
 * pick it on the board), and offers one thing: recolour exactly those parts.
 * Nothing moves until that button is pressed, and it is one undo. The same
 * for faces. The wheel's "every part like it" is the same call.
 */
import * as React from "react";
import { ChevronDown, Undo2 } from "lucide-react";
import { css, parseColor, toHex, type Oklch, type Palette } from "./look";
import { COLOUR_USES, PAGE_ID, SITE_TYPE, USE_LABEL, tallyColours, tallyFonts, type ColourUse, type FaceTo, type SiteColour } from "./siteColours";
import { FAMILY, resolvePalette } from "./parts/theme";
import { useStudio } from "./store";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Select } from "@/core/ui/select";
import { Tooltip } from "@/core/ui/tooltip";
import { VirtualList } from "@/core/ui/virtual-list";

/** How many swatches a group shows before the rest go under "Also on this site". */
const SHOWN = 8;

const USE_SAYS: Record<ColourUse, string> = {
  text: "on the words",
  fill: "as a fill",
  border: "as a border or outline",
  shadow: "in a shadow or glow",
  accent: "anywhere (it is one of the site's colours, not a grey)",
};

function useSite() {
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  return { nodes, palette, look };
}

/** A name for a part a person can read: its label, else its words. */
function nameOf(n: { label?: string; content?: unknown } | undefined, id: string): string {
  if (id === PAGE_ID) return "The page";
  if (!n) return id;
  const words = typeof n.content === "string" ? n.content : Array.isArray(n.content) ? (n.content as { text?: string }[]).map((s) => s?.text ?? "").join("") : "";
  return (n.label || words || id).slice(0, 60);
}

/** Pick these on the board, on the page the first of them is on. */
function pickOnBoard(ids: string[]) {
  const s = useStudio.getState();
  const real = ids.filter((id) => id !== PAGE_ID);
  const first = s.nodes.find((n) => n.id === real[0]);
  if (!first) return;
  if (first.pageId !== s.activePageId) s.setActivePage(first.pageId);
  s.setSelection(real.filter((id) => s.nodes.find((n) => n.id === id)?.pageId === first.pageId));
  play("select");
}

function PartsList({ spots }: { spots: { id: string; where: string }[] }) {
  const nodes = useStudio((s) => s.nodes);
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const rows = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of spots) m.set(s.id, [...new Set([...(m.get(s.id) ?? []), s.where])]);
    return [...m.entries()].map(([id, where]) => ({ id, where: where.join(", ") }));
  }, [spots]);
  const row = (r: { id: string; where: string }) => (
    <button
      type="button"
      data-site-part={r.id}
      onClick={() => pickOnBoard([r.id])}
      className="tactile flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left hover:bg-hover"
    >
      <span className="min-w-0 flex-1 truncate text-small text-fg">{nameOf(byId.get(r.id), r.id)}</span>
      <span className="shrink-0 text-fine text-fg-faint">{r.where}</span>
    </button>
  );
  return rows.length > 12 ? (
    <VirtualList items={rows} getKey={(r) => r.id} renderItem={row} estimateSize={26} className="h-40 rounded-md border border-border" />
  ) : (
    <div className="rounded-md border border-border">{rows.map((r) => <React.Fragment key={r.id}>{row(r)}</React.Fragment>)}</div>
  );
}

/** One colour, opened: who wears it, and recolour exactly them. */
function ColourDetail({ colour, use, palette, onDone }: { colour: SiteColour; use: ColourUse | null; palette: Palette; onDone: () => void }) {
  const spots = use && use !== "accent" ? colour.spots.filter((s) => s.use === use) : colour.spots;
  const parts = new Set(spots.map((s) => s.id));
  const [to, setTo] = React.useState<Oklch>(parseColor(colour.value) ?? { l: 0.7, c: 0.15, h: 265 });
  const [hex, setHex] = React.useState(toHex(to));
  const [done, setDone] = React.useState<number | null>(null);
  const swap = () => {
    const changed = useStudio.getState().swapColourAll(colour.value, css(to), palette, { use: use ?? undefined });
    play(changed.length ? "confirm" : "deny");
    setDone(changed.length);
  };
  const scope = use && use !== "accent" ? USE_SAYS[use] : "wherever it is worn";
  return (
    <div data-site-colour-detail={colour.key} className="mt-2 space-y-2 rounded-md border border-border bg-elevated p-2">
      <div className="flex items-center gap-2">
        <span className="size-6 shrink-0 rounded border border-border" style={{ background: colour.value }} />
        <span className="min-w-0 flex-1 text-small text-fg">
          <span className="num">{colour.value}</span>
          <span className="block text-fg-muted" data-site-colour-says="">
            {parts.size} part{parts.size === 1 ? "" : "s"} wear it {scope}
          </span>
        </span>
        <Button variant="ghost" size="xs" onClick={() => pickOnBoard([...parts])}>Pick them</Button>
      </div>
      <PartsList spots={spots} />
      <div className="flex items-center gap-1">
        <span className="size-6 shrink-0 rounded border border-border" style={{ background: css(to) }} aria-hidden />
        <input
          type="color"
          aria-label="New colour"
          value={toHex(to).slice(0, 7)}
          onChange={(e) => { const c = parseColor(e.target.value); if (c) { setTo(c); setHex(toHex(c)); } }}
          className="h-6 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
        />
        <Input
          inputSize="sm"
          className="min-w-0 flex-1"
          value={hex}
          aria-label="New colour, as hex"
          onChange={(e) => { setHex(e.target.value); const c = parseColor(e.target.value); if (c) setTo(c); }}
        />
      </div>
      <div className="flex items-center gap-1">
        <Button data-site-swap="" size="xs" variant="outline" className="flex-1" onClick={swap}>
          Recolour {parts.size === 1 ? "this part" : `these ${parts.size} parts`}
        </Button>
        <Button size="xs" variant="ghost" onClick={onDone}>Close</Button>
      </div>
      {done !== null ? (
        <p data-site-swapped="" className="flex items-center gap-2 text-small text-fg-muted">
          {done ? `Recoloured ${done} part${done === 1 ? "" : "s"}.` : "Nothing wore it any more."}
          {done ? (
            <button type="button" className="inline-flex items-center gap-1 text-fg hover:underline" onClick={() => { useStudio.getState().undo(); setDone(null); play("close"); }}>
              <Undo2 className="size-3" /> Undo
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function Swatch({ c, count, on, onClick, label }: { c: SiteColour; count: number; on: boolean; onClick: () => void; label: string }) {
  return (
    <Tooltip content={`${c.value} · ${label}`}>
      <button
        type="button"
        data-site-swatch={c.key}
        aria-label={`${c.value}, ${label}`}
        aria-pressed={on}
        onClick={onClick}
        className="flex flex-col items-stretch gap-0.5"
      >
        <span className={cn("h-7 rounded-md border-2 transition-colors", on ? "border-accent" : "border-border hover:border-border-strong")} style={{ background: c.value }} />
        <span className="num text-center text-fine text-fg-faint">{count}</span>
      </button>
    </Tooltip>
  );
}

export function SiteColoursSection() {
  const { nodes, palette } = useSite();
  const tally = React.useMemo(() => tallyColours(nodes, palette), [nodes, palette]);
  const [open, setOpen] = React.useState<{ use: ColourUse | null; key: string } | null>(null);
  const [more, setMore] = React.useState(false);
  const worn = tally.all.filter((c) => c.spots.some((s) => s.id !== PAGE_ID));
  if (!worn.length) return null;
  const shownKeys = new Set(COLOUR_USES.flatMap((u) => tally.byUse[u].slice(0, SHOWN).map((c) => c.key)));
  const rest = tally.all.filter((c) => !shownKeys.has(c.key));
  const detail = (use: ColourUse | null) => {
    if (!open || open.use !== use) return null;
    const c = tally.all.find((x) => x.key === open.key);
    return c ? <ColourDetail key={`${use}:${c.key}`} colour={c} use={use} palette={palette} onDone={() => setOpen(null)} /> : null;
  };
  const toggle = (use: ColourUse | null, key: string) => { play("select"); setOpen((o) => (o && o.use === use && o.key === key ? null : { use, key })); };

  return (
    <section data-site-colours="" className="space-y-3 border-b border-border p-3">
      <div>
        <h3 data-look-heading className="text-plain font-semibold text-fg">On this site</h3>
        <p className="text-small leading-snug text-fg-muted">
          Every colour the parts wear, by what it is used for. The number is how many parts. Press one to see them and recolour just those.
        </p>
      </div>
      {COLOUR_USES.map((u) => {
        const list = tally.byUse[u];
        if (!list.length) return null;
        return (
          <div key={u} data-site-group={u}>
            <div className="mb-1 flex items-baseline justify-between text-small">
              <span className="font-medium text-fg">{USE_LABEL[u]}</span>
              <span className="text-fg-faint">{list.length} colour{list.length === 1 ? "" : "s"}</span>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {list.slice(0, SHOWN).map((c) => (
                <Swatch key={c.key} c={c} count={c.by[u]} on={open?.use === u && open.key === c.key}
                  label={`${c.by[u]} part${c.by[u] === 1 ? "" : "s"} ${USE_SAYS[u]}`} onClick={() => toggle(u, c.key)} />
              ))}
            </div>
            {detail(u)}
          </div>
        );
      })}
      {rest.length ? (
        <div data-site-group="also">
          <button type="button" aria-expanded={more} onClick={() => { play(more ? "close" : "open"); setMore((v) => !v); }}
            className="flex w-full items-center gap-1 text-small font-medium text-fg">
            <ChevronDown className={cn("size-3 transition-transform", more && "rotate-180")} />
            Also on this site
            <span className="ml-auto font-normal text-fg-faint">{rest.length} more</span>
          </button>
          {more ? (
            <div className="mt-1 grid grid-cols-8 gap-1">
              {rest.map((c) => (
                <Swatch key={c.key} c={c} count={c.parts} on={open?.use === null && open.key === c.key}
                  label={`${c.parts} part${c.parts === 1 ? "" : "s"}, ${COLOUR_USES.filter((u) => c.by[u] && u !== "accent").map((u) => USE_LABEL[u].toLowerCase()).join(", ")}`}
                  onClick={() => toggle(null, c.key)} />
              ))}
            </div>
          ) : null}
          {detail(null)}
        </div>
      ) : null}
      {tally.pictures ? (
        <p className="text-small leading-snug text-fg-faint">
          {tally.pictures} part{tally.pictures === 1 ? " is a picture" : "s are pictures"}: {tally.pictures === 1 ? "its" : "their"} colours are in the picture itself, so they are not listed here.
        </p>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Fonts                                                               */
/* ------------------------------------------------------------------ */

const faceStyle = (key: string): React.CSSProperties =>
  key === SITE_TYPE ? {} : FAMILY[key] ? { fontFamily: FAMILY[key] } : { fontFamily: `"${key}"` };

export function SiteFontsSection() {
  const nodes = useStudio((s) => s.nodes);
  const carried = useStudio((s) => s.look.fonts);
  const fonts = React.useMemo(() => tallyFonts(nodes), [nodes]);
  const [open, setOpen] = React.useState<string | null>(null);
  const [to, setTo] = React.useState<string>("");
  const [done, setDone] = React.useState<number | null>(null);
  if (!fonts.length || (fonts.length === 1 && fonts[0]!.key === SITE_TYPE)) return null;
  const faces = [...new Set([...(carried ?? []).map((f) => f.family), ...fonts.map((f) => f.key).filter((k) => k && !FAMILY[k])])];
  const targets: { id: string; label: string; to: FaceTo }[] = [
    { id: "site", label: "The site's type", to: { site: true } },
    ...faces.map((f) => ({ id: `face:${f}`, label: f, to: { face: f } as FaceTo })),
    ...Object.keys(FAMILY).map((k) => ({ id: `family:${k}`, label: k, to: { family: k } as FaceTo })),
  ];
  const openFont = fonts.find((f) => f.key === open);
  return (
    <section data-site-fonts="" className="space-y-2 border-b border-border p-3">
      <div>
        <h3 data-look-heading className="text-plain font-semibold text-fg">Fonts on this site</h3>
        <p className="text-small leading-snug text-fg-muted">Each face the words are set in, and how many parts use it. Press one to swap it everywhere it is used.</p>
      </div>
      <div className="space-y-1">
        {fonts.map((f) => (
          <button
            key={f.key || "site"}
            type="button"
            data-site-font={f.key || "site"}
            aria-pressed={open === f.key}
            onClick={() => { play("select"); setDone(null); setTo(""); setOpen((o) => (o === f.key ? null : f.key)); }}
            className={cn("tactile flex w-full items-baseline gap-2 rounded-md border px-2 py-1.5 text-left", open === f.key ? "border-accent" : "border-border hover:bg-hover")}
          >
            <span className="min-w-0 flex-1 truncate text-plain text-fg" style={faceStyle(f.key)}>{f.key || "The site's type"}</span>
            <span className="num shrink-0 text-small text-fg-muted">{f.parts} part{f.parts === 1 ? "" : "s"}</span>
          </button>
        ))}
      </div>
      {openFont ? (
        <div data-site-font-detail={openFont.key || "site"} className="space-y-2 rounded-md border border-border bg-elevated p-2">
          <PartsList spots={openFont.ids.map((id) => ({ id, where: "words" }))} />
          <label className="flex items-center gap-2 text-small text-fg-muted">
            Set them in
            <Select
              className="min-w-0 flex-1"
              aria-label="New face"
              value={to}
              placeholder="choose a face…"
              onChange={setTo}
              options={targets.filter((t) => t.id !== `face:${openFont.key}` && t.id !== `family:${openFont.key}` && !(openFont.key === SITE_TYPE && t.id === "site")).map((t) => ({ value: t.id, label: t.label }))}
            />
          </label>
          <Button
            data-site-font-swap=""
            size="xs"
            variant="outline"
            className="w-full"
            disabled={!to}
            onClick={() => {
              const t = targets.find((x) => x.id === to);
              if (!t) return;
              const changed = useStudio.getState().swapFontAll(openFont.key, t.to);
              play(changed.length ? "confirm" : "deny");
              setDone(changed.length);
              setOpen(null);
            }}
          >
            Swap {openFont.parts === 1 ? "this part" : `all ${openFont.parts} parts`}
          </Button>
        </div>
      ) : null}
      {done !== null ? (
        <p data-site-font-swapped="" className="flex items-center gap-2 text-small text-fg-muted">
          Set {done} part{done === 1 ? "" : "s"} in the new face.
          <button type="button" className="inline-flex items-center gap-1 text-fg hover:underline" onClick={() => { useStudio.getState().undo(); setDone(null); play("close"); }}>
            <Undo2 className="size-3" /> Undo
          </button>
        </p>
      ) : null}
    </section>
  );
}
