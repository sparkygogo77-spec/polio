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
import { MoreHint } from "@/core/ui/more-hint";
import { ArrowRight, ChevronDown, Merge, Undo2 } from "lucide-react";
import { createPortal } from "react-dom";
import { ROLES, css, parseColor, toHex, type Oklch, type Palette } from "./look";
import { CLOSE_SHADES, COLOUR_USES, PAGE_ID, SITE_TYPE, USE_LABEL, closeShades, tallyColours, firstSays, fontsInPageOrder, type ColourUse, type FaceTo, type SiteColour } from "./look";
import { partName } from "./partNames";
import { ROLE_LABEL, ROLE_USE, siteRoles, mainColours, type RoleSwatch, type SiteRoles } from "./siteRoles";
import { componentsOf, type CompNode } from "./components";
import type { CountedAs } from "./siteRoles";
import { bytesFor, type Picture } from "./pictures";
import { getFeature } from "./shelf";
import { Slider } from "@/core/ui/slider";
import { FAMILY, resolvePalette } from "./shelf/run";
import { useStudio } from "./board/store";
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
  /* The board's own pane: the outline is clipped to it, never drawn over the shelf, the step bar or the panel. */
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
      /* The pane the board scrolls in, not the column round it: the column holds the step bar and the shelf too, and the marks drew over them (J, 2026-10-06). */
      const sc = (document.querySelector("[data-studio-pane]") ?? document.querySelector("[data-studio-scroll]"))?.getBoundingClientRect();
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

function PartsList({ spots, rest = null }: { spots: { id: string; where: string }[]; rest?: string[] | null }) {
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
      onMouseLeave={() => pointAt(rest)}
      onFocus={() => pointAt([r.id])}
      onBlur={() => pointAt(rest)}
      className="tactile flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left hover:bg-hover"
    >
      <span className="min-w-0 flex-1 truncate text-small text-fg">{nameOf(byId.get(r.id), r.id, nodes)}</span>
      <span className="shrink-0 text-fine text-fg-faint">{r.where}</span>
    </button>
  );
  /* Every part that wears it is in the list, not only the ones a virtual
     window happened to draw: a face on 27 parts listed 16. Virtual only
     past a hundred rows (AGENTS.md), where drawing them all would cost. */
  return rows.length > 100 ? (
    <VirtualList items={rows} getKey={(r) => r.id} renderItem={row} estimateSize={26} className="h-40 rounded-md border border-border" />
  ) : (
    <div data-site-parts="" className={cn("rounded-md border border-border", rows.length > 6 && "max-h-40 overflow-y-auto")}>{rows.map((r) => <React.Fragment key={r.id}>{row(r)}</React.Fragment>)}</div>
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

/* ------------------------------------------------------------------ */
/* The short palette, by role (siteRoles.ts)                           */
/* ------------------------------------------------------------------ */

/** A picture's main colours, sampled once in this browser and kept for the session. */
const pictureCache = new Map<string, string[] | "loading">();
const pictureWatchers = new Set<() => void>();
async function samplePicture(pic: Picture): Promise<void> {
  if (pictureCache.has(pic.id)) return;
  pictureCache.set(pic.id, "loading");
  try {
    const blob = await bytesFor(pic);
    if (!blob) { pictureCache.set(pic.id, []); return; }
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = 32; c.height = 32;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) { pictureCache.set(pic.id, []); return; }
    g.drawImage(bmp, 0, 0, 32, 32);
    pictureCache.set(pic.id, mainColours(g.getImageData(0, 0, 32, 32).data));
  } catch {
    pictureCache.set(pic.id, []);
  }
  pictureWatchers.forEach((w) => w());
}

/** Each picture part's main colours, by part id, as they are sampled. */
function usePictureColours(nodes: readonly { id: string; picture?: unknown }[]): Map<string, string[]> {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => { pictureWatchers.add(bump); return () => { pictureWatchers.delete(bump); }; }, []);
  React.useEffect(() => {
    for (const n of nodes) {
      const pic = (n.picture as { pic?: Picture } | null)?.pic ?? (n.picture as Picture | null);
      if (pic && typeof pic === "object" && "id" in pic && "path" in pic) void samplePicture(pic as Picture);
    }
  }, [nodes]);
  const out = new Map<string, string[]>();
  for (const n of nodes) {
    const pic = (n.picture as { pic?: Picture } | null)?.pic ?? (n.picture as Picture | null);
    const got = pic && typeof pic === "object" && "id" in pic ? pictureCache.get((pic as Picture).id) : undefined;
    if (Array.isArray(got) && got.length) out.set(n.id, got);
  }
  return out;
}

/** Bring the first of these parts into view on the board, without picking anything. */
function showOnBoard(ids: string[]) {
  const s = useStudio.getState();
  const first = s.nodes.find((n) => n.id === ids[0]);
  if (!first) return;
  if (first.pageId !== s.activePageId) s.setActivePage(first.pageId);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = document.querySelector(`[data-studio-scroll] [data-node-id="${CSS.escape(first.id)}"]`) ?? document.querySelector(`[data-node-id="${CSS.escape(first.id)}"]`);
    const pane = el?.closest("[data-studio-pane]") ?? el?.closest("[data-studio-scroll]");
    if (el instanceof HTMLElement && pane instanceof HTMLElement) {
      const r = el.getBoundingClientRect();
      const p = pane.getBoundingClientRect();
      pane.scrollTo({ top: pane.scrollTop + (r.top - p.top) - Math.max(24, (p.height - r.height) / 2), behavior: "smooth" });
    }
  }));
}

/**
 * One role's colour, opened: every part wearing it is outlined on the board
 * for as long as this is open, the first is brought into view, they are
 * listed by name, and Recolour all changes every shade of it on exactly
 * those parts, as one undo step.
 */
function RoleDetail({ swatch, palette, onDone }: { swatch: RoleSwatch; palette: Palette; onDone: () => void }) {
  const active = useStudio((s) => s.activePageId);
  const pageOf = useStudio((s) => s.nodes);
  const ids = React.useMemo(() => [...new Set(swatch.spots.map((x) => x.id))], [swatch]);
  const here = React.useMemo(() => ids.filter((id) => pageOf.find((n) => n.id === id)?.pageId === active), [ids, pageOf, active]);
  const elsewhere = ids.length - here.length;
  const recolourable = swatch.spots.filter((x) => x.where !== "in its picture");
  const [to, setTo] = React.useState<Oklch>(parseColor(swatch.value) ?? { l: 0.7, c: 0.15, h: 265 });
  const [hex, setHex] = React.useState(toHex(to));
  const [done, setDone] = React.useState<number | null>(null);
  React.useEffect(() => { pointAt(here); return () => pointAt(null); }, [here]);
  React.useEffect(() => { if (ids.length) showOnBoard(here.length ? here : ids); }, [swatch.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const only = [...new Set(recolourable.map((x) => x.id))];
  const recolour = (into: string, shades: string[]) => {
    const st = useStudio.getState();
    const mark = st.historyMark();
    const changed = new Set<string>();
    for (const shade of shades) for (const id of st.swapColourAll(shade, into, palette, { use: ROLE_USE[swatch.role], only })) changed.add(id);
    useStudio.getState().oneStepSince(mark);
    play(changed.size ? "confirm" : "deny");
    setDone(changed.size);
  };
  return (
    <div data-role-detail={swatch.id} className="mt-2 space-y-2 rounded-md border border-border bg-elevated p-2">
      <div className="flex items-center gap-2">
        <span className="size-6 shrink-0 rounded border border-border" style={{ background: swatch.value }} />
        <span className="min-w-0 flex-1 text-small text-fg">
          <span data-role-says="">{swatch.says}</span>
          <span className="block text-fg-muted">
            {here.length ? `Outlined on the board: ${here.length} on this page` : "None on this page"}{elsewhere ? `, ${elsewhere} on other pages` : ""}.
          </span>
        </span>
        <Button variant="ghost" size="xs" onClick={() => pickOnBoard(here.length ? here : ids)}>Pick them</Button>
      </div>
      {swatch.shades.length > 1 ? (
        <div data-role-shades={swatch.shades.length} className="flex flex-wrap items-center gap-1 text-fine text-fg-muted">
          {swatch.shades.length} shades:
          {swatch.shades.map((k) => <Tooltip key={k} content={k}><span className="size-4 rounded-sm border border-border" style={{ background: k }} /></Tooltip>)}
          <button type="button" data-role-one-shade="" onClick={() => recolour(swatch.value, swatch.shades.slice(1))} className="tactile ml-1 rounded-sm px-1 text-fg hover:underline">Make them one colour</button>
        </div>
      ) : null}
      <PartsList spots={swatch.spots} rest={here} />
      {swatch.fromPictures ? <MoreHint className="text-fine text-fg-faint" text="Colours inside a picture are the picture’s own. They are shown here, and recolouring leaves them as they are." /> : null}
      {only.length ? (
        <>
          <div className="flex items-center gap-1">
            <span className="size-6 shrink-0 rounded border border-border" style={{ background: css(to) }} aria-hidden />
            <input type="color" aria-label="New colour" value={toHex(to).slice(0, 7)}
              onChange={(e) => { const c = parseColor(e.target.value); if (c) { setTo(c); setHex(toHex(c)); } }}
              className="h-6 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent" />
            <Input inputSize="sm" className="min-w-0 flex-1" value={hex} aria-label="New colour, as hex"
              onChange={(e) => { setHex(e.target.value); const c = parseColor(e.target.value); if (c) setTo(c); }} />
          </div>
          <div className="flex items-center gap-1">
            <Button data-role-recolour="" size="xs" variant="outline" className="flex-1" onClick={() => recolour(css(to), swatch.shades)}>
              Recolour all {only.length} part{only.length === 1 ? "" : "s"}
            </Button>
            <Button size="xs" variant="ghost" onClick={onDone}>Close</Button>
          </div>
        </>
      ) : <Button size="xs" variant="ghost" onClick={onDone}>Close</Button>}
      {done !== null ? (
        <p data-role-recoloured="" className="flex items-center gap-2 text-small text-fg-muted">
          {done ? `Recoloured ${done} part${done === 1 ? "" : "s"}, in one step.` : "Nothing wore it any more."}
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

/** One swatch of a role: the colour and its plain sentence, which says "(3 shades)" when it stands for several; pressed, the shades are listed. */
function RoleChip({ s, on, onClick }: { s: RoleSwatch; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-role-swatch={s.id}
      data-role={s.role}
      aria-pressed={on}
      onClick={onClick}
      className={cn("tactile flex w-full items-center gap-2 rounded-md border px-1.5 py-1 text-left", on ? "border-accent bg-hover" : "border-transparent hover:bg-hover")}
    >
      <span className="size-6 shrink-0 rounded-md border border-border" style={{ background: s.value }} />
      <span className="min-w-0 flex-1 text-small leading-snug text-fg">{s.says}</span>
    </button>
  );
}

/** The short palette and, folded, everything else. */
function RolePalette({ roles, palette, children, forNewParts = null }: { roles: SiteRoles; palette: Palette; children: React.ReactNode; forNewParts?: React.ReactNode }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const [more, setMore] = React.useState(false);
  const all = [...roles.short.flatMap((r) => r.swatches), ...roles.more, ...roles.ink];
  const opened = all.find((s) => s.id === open) ?? null;
  const toggle = (id: string) => { play("select"); setOpen((o) => (o === id ? null : id)); };
  const detail = (s: RoleSwatch) => (opened?.id === s.id ? <RoleDetail key={s.id} swatch={s} palette={palette} onDone={() => setOpen(null)} /> : null);
  return (
    <div data-role-palette="" className="space-y-2">
      {roles.short.map((r) => (
        <div key={r.role} data-role-row={r.role}>
          <div className="mb-0.5 text-fine font-medium uppercase tracking-wider text-fg-faint">{ROLE_LABEL[r.role]}</div>
          {r.swatches.map((s) => (
            <React.Fragment key={s.id}>
              <RoleChip s={s} on={open === s.id} onClick={() => toggle(s.id)} />
              {detail(s)}
            </React.Fragment>
          ))}
        </div>
      ))}
      {roles.ink.length ? (
        <div data-ink-lines="" className="rounded-md border border-border/60 p-1 opacity-90">
          <div className="mb-0.5 px-1 text-fine text-fg-faint">The site&rsquo;s plain ink, not one of its colours</div>
          {roles.ink.map((s) => (
            <React.Fragment key={s.id}>
              <RoleChip s={s} on={open === s.id} onClick={() => toggle(s.id)} />
              {detail(s)}
            </React.Fragment>
          ))}
        </div>
      ) : null}
      <div data-role-more="">
        <button type="button" aria-expanded={more} onClick={() => { play(more ? "close" : "open"); setMore((v) => !v); }}
          className="flex w-full items-center gap-1 text-small font-medium text-fg">
          <ChevronDown className={cn("size-3 transition-transform", more && "rotate-180")} />
          More colours
          <span className="ml-auto font-normal text-fg-faint">{roles.more.length ? `${roles.more.length} more colour${roles.more.length === 1 ? "" : "s"}` : "and the full list"}</span>
        </button>
        {more ? (
          <div className="mt-1 space-y-2">
            <MoreHint className="text-fine text-fg-faint" text="Every other colour on parts on top of the page, by role. A colour worn by one or two parts is here too." />
            {roles.more.map((s) => (
              <React.Fragment key={s.id}>
                <RoleChip s={s} on={open === s.id} onClick={() => toggle(s.id)} />
                {detail(s)}
              </React.Fragment>
            ))}
            {forNewParts ? (
              <div data-for-new-parts="" className="space-y-1 border-t border-border pt-2">
                <p className="text-fine font-medium uppercase tracking-wider text-fg-faint">Colours for new parts</p>
                {forNewParts}
              </div>
            ) : null}
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SiteColoursSection({ captured = true, paletteRoles = null }: { captured?: boolean; paletteRoles?: React.ReactNode } = {}) {
  const { nodes, palette, look } = useSite();
  const frameWidth = useStudio((s) => s.frameWidth);
  const tally = React.useMemo(() => tallyColours(nodes, palette), [nodes, palette]);
  const pictureColours = usePictureColours(nodes);
  const pictureKey = [...pictureColours.entries()].map(([k, v]) => `${k}:${v.join("")}`).join("|");
  /* A button painted by stacked parts is one button in every count (`components.ts`). */
  const counted = React.useMemo<CountedAs>(() => {
    const c = componentsOf(nodes as unknown as CompNode[], palette as Record<string, string>);
    return { countAs: (id) => c.of.get(id) ?? id, kindOf: (id) => { const host = c.of.get(id); return host ? c.byId.get(host)?.kind ?? null : null; } };
  }, [nodes, palette]);
  const roles = React.useMemo(() => siteRoles(nodes, palette, frameWidth || 1440, pictureColours, undefined, counted), [nodes, palette, frameWidth, pictureKey, counted]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = React.useState<{ use: ColourUse | null; key: string } | null>(null);
  const [more, setMore] = React.useState(false);

  const shownKeys = new Set(COLOUR_USES.flatMap((u) => tally.byUse[u].slice(0, SHOWN).map((c) => c.key)));
  const rest = tally.all.filter((c) => !shownKeys.has(c.key));
  const detail = (use: ColourUse | null) => {
    if (!open || open.use !== use) return null;
    const c = tally.all.find((x) => x.key === open.key);
    return c ? <ColourDetail key={`${use}:${c.key}`} colour={c} use={use} palette={palette} onDone={() => setOpen(null)} /> : null;
  };
  const toggle = (use: ColourUse | null, key: string) => { play("select"); setOpen((o) => (o && o.use === use && o.key === key ? null : { use, key })); };
  const left = roles.left.backgroundLayers.length;

  return (
    <section data-site-colours="" className="space-y-3 border-b border-border p-3">
      <PointMarks />
      <div>
        <div className="flex items-center justify-between">
          <h3 data-look-heading className="text-plain font-semibold text-fg">Colours</h3>
          {look.palette && Object.keys(look.palette).length ? (
            <button
              type="button"
              data-colours-reset=""
              /* Back to what the site gave, on a site brought in; the app's own otherwise. */
              onClick={() => { play("close"); const from = look.paletteFrom; useStudio.getState().setLook({ palette: from ? Object.fromEntries(ROLES.flatMap((r) => (from[r] ? [[r, from[r]!.colour]] : []))) : {} }); }}
              className="text-small text-fg-muted hover:text-fg"
            >
              Reset
            </button>
          ) : null}
        </div>
        <MoreHint
          className="text-small leading-snug text-fg-muted"
          text={captured
            ? "The colours of the parts on top of the page, by what they are for. Close shades are one swatch. Press one to see its parts outlined on the board, pick them, and change the colour."
            : "The site's colours. Press one to change it; every part that follows it changes with it."}
        />
      </div>
      {captured ? null : paletteRoles}
      <RolePalette roles={roles} palette={palette} forNewParts={captured ? paletteRoles : null}>
        <div data-site-by-use="" className="space-y-3 border-t border-border pt-2">
          <p className="text-fine font-medium uppercase tracking-wider text-fg-faint">Every colour, by use, unmerged</p>
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
        </div>
      </RolePalette>
      <MoreHint
        data-site-left-out=""
        className="text-small leading-snug text-fg-faint"
        text={`Left out: the page’s own colour${left ? `, and ${left} background layer${left === 1 ? "" : "s"} (as wide as the page, with parts on top)` : ""}${roles.left.backgroundPictures ? `, ${roles.left.backgroundPictures} of them pictures` : ""}${roles.left.pictureWords ? `; words drawn inside ${roles.left.pictureWords} picture${roles.left.pictureWords === 1 ? "" : "s"} are not counted as words` : ""}. A picture standing on the page adds its few main colours under Pictures on top.`}
      />
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
  const pages = useStudio((s) => s.pages);
  /* In page order: by where each face is first used, top of the site to the bottom (`fontsInPageOrder`). */
  const fonts = React.useMemo(() => fontsInPageOrder(nodes, pages.map((p) => p.id)), [nodes, pages]);
  const [open, setOpen] = React.useState<string | null>(null);
  const [to, setTo] = React.useState<string>("");
  const [done, setDone] = React.useState<number | null>(null);
  if (!fonts.length || (fonts.length === 1 && fonts[0]!.key === SITE_TYPE)) return null;
  const faces = [...new Set([...fonts.map((f) => f.key).filter((k) => k && !FAMILY[k]), ...(carried ?? []).map((f) => f.family)])];
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
        <MoreHint className="text-small leading-snug text-fg-muted" text="Each face the words are set in, top of the site to the bottom, and how many parts use it. Press one to swap it everywhere it is used." />
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
            <span className="min-w-0 flex-1">
              <span className="block truncate text-plain text-fg" style={faceStyle(f.key)}>{f.key || "The site's type"}</span>
              {f.first ? (
                <span data-site-font-first="" className="block truncate text-fine text-fg-faint">
                  {firstSays(f.first)}{pages.length > 1 && f.first.pageId !== pages[0]?.id ? `, on ${pages.find((p) => p.id === f.first!.pageId)?.name ?? "another page"}` : ""}
                </span>
              ) : null}
            </span>
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

