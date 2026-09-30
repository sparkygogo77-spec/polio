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
import { ArrowRight, ChevronDown, Merge, Undo2 } from "lucide-react";
import { createPortal } from "react-dom";
import { css, parseColor, toHex, type Oklch, type Palette } from "./look";
import { CLOSE_SHADES, COLOUR_USES, PAGE_ID, SITE_TYPE, USE_LABEL, closeShades, tallyColours, tallyFonts, wordsContrast, type ColourUse, type FaceTo, type SiteColour } from "./siteColours";
import { partName } from "./partNames";
import { getFeature } from "./catalog";
import { Slider } from "@/core/ui/slider";
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

/**
 * A name for a part a person can read: its own name, its words, the name the
 * browser gave it, or what it is and the section it is in (`partNames.ts`),
 * never the capture's "div · 1 inside".
 */
function nameOf(n: Parameters<typeof partName>[0] | undefined, id: string, all: Parameters<typeof partName>[1] = []): string {
  if (id === PAGE_ID) return "The page";
  if (!n) return "A part no longer on the board";
  return partName(n, all, (f) => getFeature(f)?.name);
}

/* ------------------------------------------------------------------ */
/* Pointing at a part on the board                                     */
/* ------------------------------------------------------------------ */

/**
 * Hover a part in a list here and it is outlined on the board, so "which one
 * is that" is answered without picking it and losing what is picked. Nothing
 * in the document changes: the outline is drawn over the board from the
 * part's own box on screen, and goes when the hand leaves the row.
 */
const POINT = "studio:point-at";
export function pointAt(ids: string[] | null) {
  window.dispatchEvent(new CustomEvent(POINT, { detail: ids }));
}

export function PointMarks() {
  const [ids, setIds] = React.useState<string[] | null>(null);
  const [boxes, setBoxes] = React.useState<{ id: string; x: number; y: number; w: number; h: number }[]>([]);
  /* The board's own window: the outline is clipped to it, never drawn over the parts drawer or the panel. */
  const [clip, setClip] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  React.useEffect(() => {
    const on = (e: Event) => setIds((e as CustomEvent<string[] | null>).detail);
    window.addEventListener(POINT, on);
    return () => window.removeEventListener(POINT, on);
  }, []);
  React.useEffect(() => {
    if (!ids?.length) { setBoxes([]); return; }
    let raf = 0;
    const measure = () => {
      const out: typeof boxes = [];
      for (const id of ids) {
        const el = document.querySelector(`[data-studio-scroll] [data-node-id="${CSS.escape(id)}"]`) ?? document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
        const r = el?.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) out.push({ id, x: r.left, y: r.top, w: r.width, h: r.height });
      }
      setBoxes((was) => (JSON.stringify(was) === JSON.stringify(out) ? was : out));
      const sc = document.querySelector("[data-studio-scroll]")?.getBoundingClientRect();
      const c = sc ? { x: sc.left, y: sc.top, w: sc.width, h: sc.height } : null;
      setClip((was) => (JSON.stringify(was) === JSON.stringify(c) ? was : c));
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [ids]);
  if (!boxes.length) return null;
  return createPortal(
    <div aria-hidden className="pointer-events-none fixed z-[60] overflow-hidden" style={clip ? { left: clip.x, top: clip.y, width: clip.w, height: clip.h } : { inset: 0 }}>
      {boxes.map((b) => (
        <div
          key={b.id}
          data-point-mark={b.id}
          className="absolute rounded-[3px]"
          style={{ left: b.x - 3 - (clip?.x ?? 0), top: b.y - 3 - (clip?.y ?? 0), width: b.w + 6, height: b.h + 6, outline: "2px solid white", boxShadow: "0 0 0 4px rgb(0 0 0 / 0.55), 0 0 18px 4px rgb(255 255 255 / 0.35)" }}
        />
      ))}
    </div>,
    document.body,
  );
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
  React.useEffect(() => () => pointAt(null), []);
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
      onMouseEnter={() => pointAt([r.id])}
      onMouseLeave={() => pointAt(null)}
      onFocus={() => pointAt([r.id])}
      onBlur={() => pointAt(null)}
      className="tactile flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left hover:bg-hover"
    >
      <span className="min-w-0 flex-1 truncate text-small text-fg">{nameOf(byId.get(r.id), r.id, nodes)}</span>
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
      <PointMarks />
      <div>
        <h3 data-look-heading className="text-plain font-semibold text-fg">On this site</h3>
        <p className="text-small leading-snug text-fg-muted">
          Every colour the parts wear, by what it is used for. The number is how many parts. Press one to see them and recolour just those; hover a part&rsquo;s name to see it on the board.
        </p>
      </div>
      <WordsReadable />
      {COLOUR_USES.map((u) => {
        const list = tally.byUse[u];
        if (!list.length) return null;
        return (
          <div key={u} data-site-group={u}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-small">
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
            <MergeShades use={u} list={list} palette={palette} />
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

/* ------------------------------------------------------------------ */
/* Merge close shades                                                  */
/* ------------------------------------------------------------------ */

/**
 * MERGE CLOSE SHADES, per use. A captured site wears dozens of near-copies
 * of a colour (39 fills and 26 accents on trumpmorty.fun, three of them
 * 243,212,64 / 242,226,129 / 240,223,123), each on a part or two, so
 * changing "the yellow" meant changing a dozen swatches. This groups the
 * shades within a small distance round the one most parts wear, shows what
 * would become what before anything moves, and merges them in one undo step.
 */
function MergeShades({ use, list, palette }: { use: ColourUse; list: SiteColour[]; palette: Palette }) {
  const [open, setOpen] = React.useState(false);
  const [within, setWithin] = React.useState(CLOSE_SHADES);
  const [done, setDone] = React.useState<number | null>(null);
  const groups = React.useMemo(() => closeShades(list, use, within), [list, use, within]);
  const anyAtAll = React.useMemo(() => closeShades(list, use, 0.08).length > 0, [list, use]);
  if (!anyAtAll && done === null) return null;
  const shades = groups.reduce((n, g) => n + g.from.length, 0);
  const apply = () => {
    const st = useStudio.getState();
    const mark = st.historyMark();
    let changed = 0;
    for (const g of groups) for (const c of g.from) changed += st.swapColourAll(c.value, g.to.value, palette, { use }).length;
    useStudio.getState().oneStepSince(mark);
    play(changed ? "confirm" : "deny");
    setDone(changed);
    setOpen(false);
  };
  return (
    <div data-merge-shades={use} className="mt-1.5">
      {!open ? (
        <button
          type="button"
          data-merge-open=""
          onClick={() => { play("open"); setDone(null); setOpen(true); }}
          className="tactile inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-small text-fg-muted hover:text-fg"
        >
          <Merge className="size-3" /> Merge close shades
        </button>
      ) : (
        <div data-merge-preview="" className="space-y-2 rounded-md border border-border bg-elevated p-2">
          <div className="space-y-1">
            <div className="flex items-baseline justify-between text-small">
              <span className="text-fg">How close counts as the same</span>
              <span className="text-fg-faint">{within <= 0.02 ? "nearly identical" : within <= 0.045 ? "close" : "loosely alike"}</span>
            </div>
            <Slider value={[Math.round(within * 1000)]} min={10} max={80} step={5} onValueChange={(v) => setWithin((v[0] ?? 35) / 1000)} aria-label="How close counts as the same" />
          </div>
          {groups.length ? (
            <>
              <p className="text-small text-fg-muted">
                {shades} shade{shades === 1 ? "" : "s"} would become {groups.length} colour{groups.length === 1 ? "" : "s"}, on {groups.reduce((n, g) => n + g.parts, 0)} part{groups.reduce((n, g) => n + g.parts, 0) === 1 ? "" : "s"}. Each group takes the shade most parts already wear.
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {groups.map((g) => (
                  <li key={g.to.key} data-merge-group={g.to.key} className="flex items-center gap-1">
                    <span className="flex min-w-0 flex-1 flex-wrap gap-0.5">
                      {g.from.map((c) => (
                        <Tooltip key={c.key} content={c.value}>
                          <span className="size-4 rounded-sm border border-border" style={{ background: c.value }} />
                        </Tooltip>
                      ))}
                    </span>
                    <ArrowRight className="size-3 shrink-0 text-fg-faint" />
                    <Tooltip content={`${g.to.value}, worn by ${g.to.by[use]} part${g.to.by[use] === 1 ? "" : "s"}`}>
                      <span className="size-5 shrink-0 rounded-sm border border-border" style={{ background: g.to.value }} />
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-small text-fg-muted">No two shades are that close. Loosen it to find more.</p>
          )}
          <div className="flex items-center gap-1">
            <Button data-merge-apply="" size="xs" variant="outline" className="flex-1" disabled={!groups.length} onClick={apply}>
              Merge {shades} into {groups.length}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => { play("close"); setOpen(false); }}>Close</Button>
          </div>
        </div>
      )}
      {done !== null ? (
        <p data-merge-done="" className="mt-1 flex items-center gap-2 text-small text-fg-muted">
          {done ? `Merged: ${done} part${done === 1 ? "" : "s"} changed, in one step.` : "Nothing wore those shades any more."}
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

/* ------------------------------------------------------------------ */
/* Words against their fill                                            */
/* ------------------------------------------------------------------ */

/**
 * Whether the words can be read, measured on what they sit on. The mixer's
 * badges compare two roles, and on a site brought in those two are often
 * never worn together: a "text 1.2" on a site whose words all read clearly
 * is an alarm about nothing. So a captured site gets this instead: how many
 * parts' words stand out from their own fill, and which do not, by name.
 */
function WordsReadable() {
  const { nodes, palette, look } = useSite();
  const rows = React.useMemo(() => (look.paletteFrom || nodes.some((n) => n.from) ? wordsContrast(nodes, palette) : []), [nodes, palette, look.paletteFrom]);
  const [open, setOpen] = React.useState(false);
  if (!rows.length) return null;
  const hard = rows.filter((r) => r.ratio < 3).sort((a, b) => a.ratio - b.ratio);
  const small = rows.filter((r) => r.ratio >= 3 && r.ratio < 4.5).length;
  return (
    <div data-words-readable="" className="rounded-md border border-border p-2 text-small">
      <p className="text-fg-muted">
        <span className="text-fg">Readable words:</span>{" "}
        {rows.length - hard.length - small} of {rows.length} parts&rsquo; words stand out clearly from the fill behind them
        {small ? `, ${small} only at a large size` : ""}
        {hard.length ? `, and ${hard.length} ${hard.length === 1 ? "is" : "are"} hard to read` : ""}.
        {" "}Contrast is the difference in lightness; 4.5 to 1 reads at any size.
      </p>
      {hard.length ? (
        <>
          <button type="button" aria-expanded={open} onClick={() => { play(open ? "close" : "open"); setOpen((v) => !v); }} className="mt-1 inline-flex items-center gap-1 text-fg hover:underline">
            <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} /> Which ones
          </button>
          {open ? <div className="mt-1"><PartsList spots={hard.map((r) => ({ id: r.id, where: `${r.ratio} to 1` }))} /></div> : null}
        </>
      ) : null}
    </div>
  );
}
