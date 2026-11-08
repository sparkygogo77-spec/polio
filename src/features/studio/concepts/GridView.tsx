"use client";
/**
 * THE GRID VIEW: concepts across, sections down, one tick a row.
 *
 * Design C of handovers/open/concept-studio, as J picked it. Each cell is
 * that concept's section cut out of its page (the same live render Builds
 * uses, scrolled to the section and clipped), drawn as tall as the tallest
 * cell of its row so the rows line up; an empty cell where a concept has
 * no such section. A tick on a cell; one tick per row; Whole ticks a
 * column; Again this row writes one section again on every concept; Build
 * the ticked page makes a site. Right-press any part in a cell and the
 * Builder opens on that concept with the part picked (the normal wheel and
 * side panel). The pieces from designs A and B sit behind `grid.ts#SWITCHES`.
 */
import * as React from "react";
import { Check, Dices, Pencil, X } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { docOfStored, useBuilds } from "@/features/builds/store";
import { SitePreview, type PreviewDoc } from "../SitePreview";
import { conceptForKey, pageOf, partAt, rowsOf, tick, tickCounts, tickWhole, SWITCHES, type GridRow, type Ticks } from "./grid";
import type { Concept, PartLike } from "./model";
import { againRow, buildTicked, openAt, promote } from "./run";

const COLOURS = ["bg-[#e9dcc3] text-[#2a2410]", "bg-[#ff3fb4] text-white", "bg-[#e2793f] text-white", "bg-[#5ef2ff] text-[#06303a]"];
const MIN_ROW = 28;

export interface GridProps {
  group: string;
  row: { id: string; c: Concept }[];
  nameOf: (id: string) => string;
  rev: number;
  busy: string | null;
  run: (what: string, fn: () => Promise<unknown>) => Promise<void>;
  colWidth: number;
}

type Doc = PreviewDoc & { nodes: PartLike[]; system?: unknown; systemId?: string | null };

/** Every concept's stored document, read again when `rev` changes. */
function useDocs(ids: readonly string[], rev: number): Map<string, Doc> {
  const active = useBuilds((s) => s.activeId);
  const [got, setGot] = React.useState<{ key: string; docs: Map<string, Doc> }>({ key: "", docs: new Map() });
  const key = `${ids.join(",")}:${rev}`;
  React.useEffect(() => {
    let alive = true;
    void Promise.all(ids.map(async (id) => [id, (await docOfStored(id, id === active)) as Doc | null] as const)).then((pairs) => {
      if (!alive) return;
      setGot({ key, docs: new Map(pairs.filter((p): p is readonly [string, Doc] => !!p[1])) });
    });
    return () => { alive = false; };
  }, [key, ids, active]);
  return got.key === key ? got.docs : got.docs;
}

export function GridView({ group, row, nameOf, rev, busy, run, colWidth }: GridProps) {
  const ids = React.useMemo(() => row.map((x) => x.id), [row]);
  const docs = useDocs(ids, rev);
  const rows = React.useMemo<GridRow[]>(() => rowsOf([...docs].map(([id, d]) => ({ id, nodes: d.nodes ?? [], pageId: d.activePageId ?? d.pages?.[0]?.id }))), [docs]);
  const [ticks, setTicks] = React.useState<Ticks>({});
  const [focus, setFocus] = React.useState<string | null>(null);
  const [hover, setHover] = React.useState<{ row: string; id: string } | null>(null);
  const [whole, setWhole] = React.useState<string | null>(null);
  const scale = colWidth / 1440;
  const counts = tickCounts(rows, ticks);
  const page = React.useMemo(() => (SWITCHES.yourPage ? pageOf(rows, ticks, docs) : null), [rows, ticks, docs]);
  const ticked = Object.keys(ticks).filter((k) => rows.some((r) => r.key === k && r.cells[ticks[k]!])).length;

  /* B: 1, 2, 3 switch the focused row's tick. */
  React.useEffect(() => {
    if (!SWITCHES.numberKeys) return;
    const onKey = (e: KeyboardEvent) => {
      if (!focus || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const id = conceptForKey(e.key, ids);
      if (!id) return;
      const r = rows.find((x) => x.key === focus);
      if (!r || !r.cells[id]) return;
      e.preventDefault();
      setTicks((t) => ({ ...t, [focus]: id }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, ids, rows]);

  const onContext = (e: React.MouseEvent, id: string, r: GridRow) => {
    e.preventDefault();
    const d = docs.get(id);
    const cell = r.cells[id];
    if (!d || !cell) return;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - box.left) / scale;
    const y = (e.clientY - box.top) / scale + cell.section.top;
    const part = partAt(d.nodes, x, y, d.activePageId ?? d.pages?.[0]?.id);
    void run("open", () => openAt(id, part?.id ?? null));
  };

  return (
    <div data-concepts-grid="" className="flex flex-1 flex-col overflow-auto px-6 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span data-grid-ticks="" className="text-plain text-fg-muted">
          {ticked ? `Ticks: ${row.map(({ id, c }) => (counts[id] ? `${counts[id]} from ${c.name}` : null)).filter(Boolean).join(", ")}` : "Tick one cell a row. The ticked set is the page you build."}
        </span>
        <button type="button" data-grid-build="" disabled={!!busy || !ticked} onClick={() => run("build", async () => { const r = await buildTicked(group, rows, ticks); if (r.ok) window.location.assign("/builder"); return r; })} className="tactile ml-auto inline-flex items-center gap-1.5 rounded-md border border-accent bg-accent-soft px-3 py-1.5 text-plain font-medium text-fg disabled:opacity-50">
          <Check className="size-4" /> {busy === "build" ? "Building…" : "Build the ticked page"}
        </button>
      </div>

      <div className="grid gap-x-3 gap-y-2" style={{ gridTemplateColumns: `120px repeat(${row.length}, ${colWidth}px)${SWITCHES.yourPage ? ` ${colWidth}px` : ""}` }}>
        <div />
        {row.map(({ id, c }, i) => (
          <div key={id} data-grid-col={id} data-grid-col-index={i} className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-panel py-0.5 pl-1 pr-3 text-plain font-semibold text-fg">
              <span className={cn("inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold", COLOURS[i % COLOURS.length])}>{i + 1}</span>{c.name}
            </span>
            <button type="button" data-grid-whole="" disabled={!!busy} onClick={() => setTicks((t) => tickWhole(rows, t, id))} title="Tick every section of this concept" className="tactile rounded-md border border-border px-2 py-0.5 text-small text-fg">Whole</button>
            {SWITCHES.wholePage ? <button type="button" data-grid-see-whole="" disabled={!!busy} onClick={() => setWhole(id)} title="See this concept as a whole page" className="tactile rounded-md border border-border px-2 py-0.5 text-small text-fg">See whole page</button> : null}
            {SWITCHES.promoteOne ? <button type="button" data-grid-promote="" disabled={!!busy} onClick={() => run("promote", async () => { await promote(id); window.location.assign("/builder"); })} title="This concept, as it is, becomes a site and opens in the Builder" className="tactile rounded-md border border-border px-2 py-0.5 text-small text-fg">Promote</button> : null}
          </div>
        ))}
        {SWITCHES.yourPage ? <div data-grid-yourpage-head="" className="flex items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-dashed border-accent bg-panel px-3 py-0.5 text-plain font-semibold text-fg">◐ Your page</span><span className="text-small text-fg-muted">{ticked ? `${ticked} ${ticked === 1 ? "section" : "sections"}` : "as you tick"}</span></div> : null}

        {rows.map((r) => {
          const h = Math.max(MIN_ROW, Math.round(r.height * scale));
          return (
            <React.Fragment key={r.key}>
              <div data-grid-row={r.key} data-grid-row-kind={r.kind} className={cn("flex flex-col gap-1 pt-1 text-small", focus === r.key ? "text-fg" : "text-fg-muted")} onMouseEnter={() => setFocus(r.key)}>
                <span className="font-semibold">{r.name}</span>
                <button type="button" data-grid-again-row="" disabled={!!busy} onClick={() => run(`again:${r.key}`, () => againRow(group, r.name))} title="Write this section again on every concept" className="tactile inline-flex w-fit items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-small text-fg-muted"><Dices className="size-3" /> {busy === `again:${r.key}` ? "Rolling…" : "Again this row"}</button>
              </div>
              {row.map(({ id }) => {
                const cell = r.cells[id];
                const d = docs.get(id);
                const on = ticks[r.key] === id;
                if (!cell || !d) return <div key={id} data-grid-cell={`${r.key}:${id}`} data-empty="" className="rounded-md border border-dashed border-border/60" style={{ height: h }} />;
                const others = SWITCHES.hoverCards && hover?.row === r.key && hover.id === id ? row.filter((x) => x.id !== id && r.cells[x.id] && docs.get(x.id)) : [];
                return (
                  <div key={id} className="relative" onMouseEnter={() => { setFocus(r.key); setHover({ row: r.key, id }); }} onMouseLeave={() => setHover((hv) => (hv?.id === id && hv.row === r.key ? null : hv))}>
                    <div
                      data-grid-cell={`${r.key}:${id}`}
                      data-ticked={on ? "" : undefined}
                      role="button"
                      tabIndex={0}
                      aria-pressed={on}
                      aria-label={`${r.name} from ${nameOf(id)}`}
                      onClick={() => setTicks((t) => tick(t, r.key, id))}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTicks((t) => tick(t, r.key, id)); } }}
                      onContextMenu={(e) => onContext(e, id, r)}
                      onFocus={() => setFocus(r.key)}
                      className={cn("relative cursor-pointer overflow-hidden rounded-md border-2 bg-surface", on ? "border-accent shadow-[0_0_14px_var(--accent)]" : "border-border")}
                      style={{ height: h }}
                    >
                      <Crop doc={d} width={colWidth} top={cell.section.top} />
                      <span className={cn("absolute right-1 top-1 flex size-5 items-center justify-center rounded-full border text-[11px]", on ? "border-accent bg-accent text-white" : "border-border bg-panel/80 text-fg-muted")}>{on ? <Check className="size-3" /> : ""}</span>
                    </div>
                    {others.length ? (
                      <div data-grid-cards="" className="absolute left-0 top-full z-20 mt-1 flex gap-1 rounded-md border border-border bg-panel p-1 shadow-lg">
                        {others.map((o) => (
                          <button key={o.id} type="button" data-grid-card={o.id} onClick={() => setTicks((t) => ({ ...t, [r.key]: o.id }))} title={`Take ${r.name} from ${o.c.name}`} className="tactile relative overflow-hidden rounded-sm border border-border" style={{ width: Math.round(colWidth / 3), height: Math.max(20, Math.round((r.cells[o.id]!.section.bottom - r.cells[o.id]!.section.top) * (colWidth / 3 / 1440))) }}>
                            <Crop doc={docs.get(o.id)!} width={Math.round(colWidth / 3)} top={r.cells[o.id]!.section.top} />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {SWITCHES.yourPage ? <YourPageCell page={page} rows={rows} ticks={ticks} rowKey={r.key} width={colWidth} height={h} docs={docs} /> : null}
            </React.Fragment>
          );
        })}
      </div>

      {whole && SWITCHES.wholePage ? <WholePage id={whole} name={nameOf(whole)} doc={docs.get(whole) ?? null} onClose={() => setWhole(null)} onEdit={() => run("open", () => openAt(whole, null))} /> : null}
    </div>
  );
}

/** A concept's page drawn whole at `width` and scrolled so the section at `top` (page px) is at the top of the box. */
function Crop({ doc, width, top }: { doc: PreviewDoc; width: number; top: number }) {
  const scale = width / (doc.frameWidth ?? 1440);
  return (
    <div className="pointer-events-none absolute left-0 w-full" style={{ top: -Math.round(top * scale) }}>
      <SitePreview doc={doc} width={width} height={width} whole />
    </div>
  );
}

/** The Your page column: in each row, the ticked section as it sits in the built page, so the column reads as the page. */
function YourPageCell({ page, rows, ticks, rowKey, width, height, docs }: { page: ReturnType<typeof pageOf> | null; rows: GridRow[]; ticks: Ticks; rowKey: string; width: number; height: number; docs: Map<string, Doc> }) {
  const id = ticks[rowKey];
  const r = rows.find((x) => x.key === rowKey);
  const d = id ? docs.get(id) : null;
  const cell = id && r ? r.cells[id] : null;
  void page;
  if (!d || !cell) return <div data-grid-yourpage={rowKey} data-empty="" className="rounded-md border border-dashed border-accent/40" style={{ height }} />;
  return (
    <div data-grid-yourpage={rowKey} className="relative overflow-hidden rounded-md border border-accent/60 bg-surface" style={{ height }}>
      <Crop doc={d} width={width} top={cell.section.top} />
    </div>
  );
}

/** A: one concept as a whole page, over the grid, so its feel is not lost in the rows. */
function WholePage({ id, name, doc, onClose, onEdit }: { id: string; name: string; doc: PreviewDoc | null; onClose: () => void; onEdit: () => void }) {
  React.useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div data-grid-wholepage={id} role="dialog" aria-label={`${name}, whole page`} className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div className="flex max-h-full w-[min(960px,90vw)] flex-col gap-2 rounded-lg border border-border bg-panel p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="text-plain font-semibold text-fg">{name}</span>
          <button type="button" data-grid-wholepage-edit="" onClick={onEdit} className="tactile inline-flex items-center gap-1 rounded-md border border-accent bg-accent-soft px-2 py-0.5 text-small font-medium text-fg"><Pencil className="size-3" /> Edit</button>
          <button type="button" aria-label="Close" onClick={onClose} className="tactile ml-auto rounded-md border border-border p-1 text-fg-muted"><X className="size-4" /></button>
        </div>
        <div className="overflow-y-auto rounded-md border border-border [scrollbar-gutter:stable]" style={{ maxHeight: "80vh" }}>
          {doc ? <SitePreview doc={doc} width={900} height={900} whole /> : null}
        </div>
      </div>
    </div>
  );
}
