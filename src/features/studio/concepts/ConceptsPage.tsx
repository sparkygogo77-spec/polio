"use client";
/**
 * THE CONCEPT STUDIO: three live pages side by side, from one prompt.
 *
 * `/builder/concepts?g=<group>`. The prompt row at the top; under it, on one
 * wide canvas, every concept of the group as a whole page drawn live
 * (`SitePreview`, the render Builds and Compare use), each with its
 * direction's name, Edit (the Builder opens on it: the wheel and the side
 * panel work on it as on any site), Again (that one rolled again) and
 * Promote. Under each page, its sections as keys: press one and it is taken
 * into the Mix, the dashed board at the end, which is a site of its own and
 * can be promoted like the rest. Zoom sets how wide each page is drawn.
 *
 * Design A of handovers/open/concept-studio (boards on a canvas), as J
 * approved building first.
 */
import * as React from "react";
import { ArrowDown, ArrowUp, Check, Dices, Pencil, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/core/ui/empty-state";
import { cn } from "@/core/lib/cn";
import { docOfStored, useBuilds } from "@/features/builds/store";
import { SitePreview, type PreviewDoc } from "../SitePreview";
import { conceptsOf, conceptsHref, readGroup, sectionsOf, type Section, type Take } from "./model";
import { groupList, useConcepts } from "./store";
import { again, discard, edit, makeConcepts, promote, setTakes, take, untake } from "./run";
import { GridView } from "./GridView";
import { jumpTo } from "../ShelfCards";

const ZOOMS = [{ w: 300, label: "Small" }, { w: 420, label: "Medium" }, { w: 620, label: "Large" }] as const;
const COLOURS = ["bg-[#e9dcc3] text-[#2a2410]", "bg-[#ff3fb4] text-white", "bg-[#e2793f] text-white", "bg-[#5ef2ff] text-[#06303a]"];

export function ConceptsPage() {
  const projects = useBuilds((s) => s.projects);
  const byId = useConcepts((s) => s.byId);
  const groups = useConcepts((s) => s.groups);
  const lastGroup = useConcepts((s) => s.lastGroup);
  const [groupId, setGroupId] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState("");
  const [count, setCount] = React.useState(3);
  const [zoom, setZoom] = React.useState(1);
  /* The grid (design C, J's pick) is how the canvas opens; Boards is design A, kept behind the switch. */
  const [view, setView] = React.useState<"grid" | "boards">("grid");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);
  const [rev, setRev] = React.useState(0);

  React.useEffect(() => {
    void useBuilds.persist.rehydrate()?.then?.(() => useBuilds.getState().adopt());
    void useConcepts.persist.rehydrate();
    setGroupId(readGroup(window.location.search));
    /* For the checks (tests/concept-studio-site.mjs): read only. */
    const hook = {
      groups: () => useConcepts.getState().groups,
      byId: () => useConcepts.getState().byId,
      doc: (id: string) => docOfStored(id, useBuilds.getState().activeId === id),
    };
    (window as unknown as { __polioConcepts?: unknown }).__polioConcepts = hook;
    return () => { delete (window as unknown as { __polioConcepts?: unknown }).__polioConcepts; };
  }, []);
  const shownId = groupId ?? lastGroup;
  const group = (shownId && groups[shownId]) || null;
  const go = (g: string | null) => {
    setGroupId(g);
    if (g) useConcepts.getState().setLast(g);
    window.history.replaceState(null, "", conceptsHref(g));
  };
  React.useEffect(() => { if (group && prompt === "" && !busy) setPrompt(group.prompt); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [group?.id]);

  const run = async (what: string, fn: () => Promise<unknown>) => {
    setBusy(what); setSaid(null);
    try {
      const r = (await fn()) as { ok?: boolean; says?: string; plain?: string | null; group?: string } | null | undefined;
      if (r && r.ok === false) setSaid(r.says ?? "That did not work.");
      if (r && r.ok && r.plain) setSaid(r.plain);
      if (r && r.ok && r.group) go(r.group);
      setRev((x) => x + 1);
    } finally { setBusy(null); }
  };
  const make = (claude: boolean) => run(claude ? "claude" : "make", () => makeConcepts(prompt, { claude, count }));

  const present = React.useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
  const row = group ? conceptsOf(byId, group, present) : [];
  const mixId = group?.mix && present.has(group.mix) ? group.mix : null;
  const name = (id: string) => projects.find((p) => p.id === id)?.name ?? "";
  const width = ZOOMS[zoom]!.w;
  const list = groupList(groups);

  return (
    <div data-concepts="" className="flex h-[calc(100vh-3rem)] min-h-[600px] flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-6 py-3" data-concepts-prompt-row="">
        <h1 className="text-sm font-semibold uppercase tracking-[0.12em] text-fg-faint">Concepts</h1>
        <input
          data-concepts-prompt=""
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && prompt.trim() && !busy) void make(false); }}
          placeholder="three concepts for a lantern shop landing page"
          className="min-w-64 flex-1 rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-plain text-fg"
        />
        <label className="flex items-center gap-1 text-plain text-fg-muted">
          <button type="button" data-concepts-fewer="" aria-label="One fewer" disabled={count <= 1} onClick={() => setCount((c) => Math.max(1, c - 1))} className="tactile rounded-sm border border-border px-1.5 text-fg">‹</button>
          <span data-concepts-count="" className="num w-20 text-center">{count} {count === 1 ? "concept" : "concepts"}</span>
          <button type="button" data-concepts-more="" aria-label="One more" disabled={count >= 4} onClick={() => setCount((c) => Math.min(4, c + 1))} className="tactile rounded-sm border border-border px-1.5 text-fg">›</button>
        </label>
        <button type="button" data-concepts-make="" disabled={!!busy || !prompt.trim()} onClick={() => make(false)} className="tactile inline-flex items-center gap-1.5 rounded-md border border-accent bg-accent-soft px-3 py-1.5 text-plain font-medium text-fg">
          <Dices className="size-4" /> {busy === "make" ? "Making…" : "Make"}
        </button>
        <button type="button" data-concepts-claude="" disabled={!!busy || !prompt.trim()} onClick={() => make(true)} className="tactile inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-plain text-fg" title="One Claude call for all of them. It uses your Claude key.">
          <Sparkles className="size-4" /> {busy === "claude" ? "Asking Claude…" : "Ask Claude"}
        </button>
        <span className="ml-auto flex items-center gap-1 text-plain text-fg-muted">
          <button type="button" data-concepts-view="grid" aria-pressed={view === "grid"} onClick={() => setView("grid")} className={cn("tactile rounded-sm border px-1.5 py-0.5", view === "grid" ? "border-accent bg-accent-soft text-fg" : "border-border")}>Grid</button>
          <button type="button" data-concepts-view="boards" aria-pressed={view === "boards"} onClick={() => setView("boards")} className={cn("tactile mr-3 rounded-sm border px-1.5 py-0.5", view === "boards" ? "border-accent bg-accent-soft text-fg" : "border-border")}>Boards</button>
          Zoom
          {ZOOMS.map((z, i) => (
            <button key={z.label} type="button" data-concepts-zoom={i} aria-pressed={i === zoom} onClick={() => setZoom(i)} className={cn("tactile rounded-sm border px-1.5 py-0.5", i === zoom ? "border-accent bg-accent-soft text-fg" : "border-border")}>{z.label}</button>
          ))}
        </span>
        {list.length > 1 ? (
          <select aria-label="Earlier prompts" data-concepts-groups="" value={group?.id ?? ""} onChange={(e) => go(e.target.value || null)} className="rounded-md border border-border bg-bg px-2 py-1 text-plain text-fg">
            {list.map((g) => <option key={g.id} value={g.id}>{g.prompt.slice(0, 60)}</option>)}
          </select>
        ) : null}
        {said ? <p data-concepts-said="" className="w-full text-plain text-fg-muted">{said}</p> : null}
      </div>

      {group && row.length && view === "grid" ? (
        <GridView group={group.id} row={row} nameOf={name} rev={rev} busy={busy} run={run} colWidth={width} />
      ) : group && row.length ? (
        <div data-concepts-canvas="" className="flex flex-1 items-start gap-6 overflow-auto px-6 py-5">
          {row.map(({ id, c }, i) => (
            <Board key={id} id={id} index={i} title={c.name} pitch={c.pitch} siteName={name(id)} width={width} rev={rev} busy={busy}
              onEdit={() => run("edit", async () => { await edit(id); window.location.assign("/builder"); })}
              onAgain={() => run(`again:${id}`, () => again(id, { claude: c.by === "claude" }))}
              onPromote={() => run("promote", async () => { await promote(id); window.location.assign("/builder"); })}
              onDiscard={() => run("discard", () => discard(id))}
              takes={group.takes.filter((t) => t.from === id)}
              onTake={(section) => run(`take:${id}:${section}`, () => take(group.id, { from: id, section }))}
            />
          ))}
          <MixBoard group={group.id} id={mixId} takes={group.takes} width={width} rev={rev} busy={busy} nameOf={(id) => byId[id]?.name ?? name(id)}
            onUntake={(t) => run("untake", () => untake(group.id, t))}
            onMove={(takes) => run("move", () => setTakes(group.id, takes))}
            onPromote={() => mixId && run("promote", async () => { await promote(mixId); window.location.assign("/builder"); })}
          />
        </div>
      ) : (
        <EmptyState className="mt-12" icon={Sparkles} title="Say what the page is for" body="Make draws three concepts here, free, from the catalogue. Ask Claude makes three in one call. Each is a real page you can edit." />
      )}
    </div>
  );
}

/** A site's stored document, read again when `rev` changes. */
function useDoc(id: string | null, rev: number): PreviewDoc | null {
  const active = useBuilds((s) => s.activeId);
  const [got, setGot] = React.useState<{ key: string; doc: PreviewDoc | null } | null>(null);
  const key = `${id}:${rev}`;
  React.useEffect(() => {
    if (!id) return;
    let alive = true;
    void docOfStored(id, id === active).then((doc) => { if (alive) setGot({ key, doc }); });
    return () => { alive = false; };
  }, [id, active, key]);
  return id && got?.key === key ? got.doc : null;
}

function Tag({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-panel py-0.5 pl-1 pr-3 text-plain font-semibold text-fg">
      <span className={cn("inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold", COLOURS[index % COLOURS.length])}>{index + 1}</span>
      {children}
    </span>
  );
}

interface BoardProps {
  id: string; index: number; title: string; pitch: string; siteName: string; width: number; rev: number; busy: string | null;
  takes: Take[];
  onEdit: () => void; onAgain: () => void; onPromote: () => void; onDiscard: () => void; onTake: (section: string) => void;
}

function Board({ id, index, title, pitch, width, rev, busy, takes, onEdit, onAgain, onPromote, onDiscard, onTake }: BoardProps) {
  const doc = useDoc(id, rev);
  const sections = React.useMemo<Section[]>(() => (doc?.nodes ? sectionsOf(doc.nodes as unknown as Parameters<typeof sectionsOf>[0], doc.activePageId ?? doc.pages?.[0]?.id) : []), [doc]);
  const height = Math.round(width * 1.6);
  return (
    <section data-concept={id} data-concept-index={index} aria-label={title} className="flex shrink-0 flex-col gap-2" style={{ width }}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag index={index}>{title}</Tag>
        <button type="button" data-concept-edit="" disabled={!!busy} onClick={onEdit} title="Open it in the Builder: the wheel and the side panel work on it as on any site." className="tactile inline-flex items-center gap-1 rounded-md border border-accent bg-accent-soft px-2 py-0.5 text-small font-medium text-fg"><Pencil className="size-3" /> Edit</button>
        <button type="button" data-concept-again="" disabled={!!busy} onClick={onAgain} title="This one rolled again on the same prompt; the others stay." className="tactile inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-small text-fg"><Dices className="size-3" /> {busy === `again:${id}` ? "Rolling…" : "Again"}</button>
        <button type="button" data-concept-promote="" disabled={!!busy} onClick={onPromote} title="It becomes an ordinary site in Builds and opens in the Builder." className="tactile inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-small text-fg"><Check className="size-3" /> Promote</button>
        <button type="button" data-concept-discard="" disabled={!!busy} onClick={onDiscard} aria-label={`Discard ${title}`} className="tactile inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-small text-fg-muted"><Trash2 className="size-3" /></button>
      </div>
      {pitch ? <p className="truncate text-small text-fg-muted" title={pitch}>{pitch}</p> : null}
      <div data-concept-page="" className="overflow-y-auto overflow-x-hidden rounded-md border border-border bg-surface [scrollbar-gutter:stable]" style={{ height }}>
        {doc ? <SitePreview doc={doc} width={width - 2} height={width - 2} whole /> : <div className="h-full animate-pulse bg-hover" />}
      </div>
      <div data-concept-sections="" className="flex flex-wrap gap-1">
        <span className="w-full text-small text-fg-faint">Take into the Mix:</span>
        {sections.map((s) => {
          const taken = takes.some((t) => t.section === s.name);
          return (
            <button key={s.name} type="button" data-concept-take={s.name} aria-pressed={taken} disabled={!!busy || taken} onClick={() => onTake(s.name)} title={taken ? "In the Mix" : `Take "${s.name}" (${s.parts} ${s.parts === 1 ? "part" : "parts"}) into the Mix`}
              className={cn("tactile rounded-sm border px-1.5 py-0.5 text-small", taken ? "border-accent bg-accent-soft text-fg" : "border-border text-fg-muted")}>
              {taken ? "✓ " : ""}{s.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface MixProps { group: string; id: string | null; takes: Take[]; width: number; rev: number; busy: string | null; nameOf: (id: string) => string; onUntake: (t: Take) => void; onMove: (takes: Take[]) => void; onPromote: () => void }

function MixBoard({ id, takes, width, rev, busy, nameOf, onUntake, onMove, onPromote }: MixProps) {
  const doc = useDoc(id, rev);
  const height = Math.round(width * 1.6);
  const move = (at: number, by: -1 | 1) => { const out = [...takes]; const to = at + by; if (to < 0 || to >= out.length) return; [out[at], out[to]] = [out[to]!, out[at]!]; onMove(out); };
  return (
    <section data-concept-mix="" aria-label="Mix" className="flex shrink-0 flex-col gap-2" style={{ width }}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-accent bg-panel px-3 py-0.5 text-plain font-semibold text-fg">◐ Mix</span>
        <button type="button" data-mix-promote="" disabled={!!busy || !id} onClick={onPromote} title="The Mix becomes an ordinary site in Builds and opens in the Builder." className="tactile inline-flex items-center gap-1 rounded-md border border-accent bg-accent-soft px-2 py-0.5 text-small font-medium text-fg disabled:opacity-50"><Check className="size-3" /> Promote to a site</button>
      </div>
      <p className="truncate text-small text-fg-muted">{takes.length ? `${takes.length} ${takes.length === 1 ? "section" : "sections"} taken` : "Take sections from the concepts; they stack here in the order you take them."}</p>
      <div data-mix-page="" className={cn("overflow-y-auto overflow-x-hidden rounded-md border bg-surface [scrollbar-gutter:stable]", id ? "border-border" : "border-dashed border-border")} style={{ height }}>
        {id && doc ? <SitePreview doc={doc} width={width - 2} height={width - 2} whole /> : (
          <div className="flex h-full items-center justify-center p-6 text-center text-small text-fg-faint">Nothing taken yet</div>
        )}
      </div>
      {takes.length ? (
        <ol data-mix-takes="" className="flex flex-col gap-1">
          {takes.map((t, i) => (
            <li key={`${t.from}:${t.section}`} data-mix-take={`${t.from}:${t.section}`} className="flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-small text-fg">
              <span className="min-w-0 flex-1 truncate">{t.section} <span className="text-fg-muted">from {nameOf(t.from)}</span></span>
              <button type="button" aria-label="Move up" disabled={!!busy || i === 0} onClick={() => move(i, -1)} className="tactile rounded-sm border border-border p-0.5 text-fg-muted disabled:opacity-40"><ArrowUp className="size-3" /></button>
              <button type="button" aria-label="Move down" disabled={!!busy || i === takes.length - 1} onClick={() => move(i, 1)} className="tactile rounded-sm border border-border p-0.5 text-fg-muted disabled:opacity-40"><ArrowDown className="size-3" /></button>
              <button type="button" data-mix-untake="" aria-label={`Take ${t.section} out`} disabled={!!busy} onClick={() => onUntake(t)} className="tactile rounded-sm border border-border p-0.5 text-fg-muted"><X className="size-3" /></button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

/** A part to pick once the Builder has drawn it (`openAt`), kept across a double mount. */
let pendingPick: string | null = null;

/** The Builder's way back to the canvas, shown in its bar while the open site is a concept. */
export function ConceptsBack() {
  const activeId = useBuilds((s) => s.activeId);
  const byId = useConcepts((s) => s.byId);
  React.useEffect(() => { void useConcepts.persist.rehydrate(); }, []);
  /* Opened from the grid with a part named (`run.ts#openAt`): picked once the board has it, as the shelf picks a part. The id is kept outside React: a development double-mount would otherwise read a hash the first mount had already cleared. */
  React.useEffect(() => {
    const m = /#pick=([^&]+)/.exec(window.location.hash);
    if (m) { pendingPick = decodeURIComponent(m[1]!); window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`); }
    if (!pendingPick) return;
    let tries = 0;
    const t = window.setInterval(() => {
      const id = pendingPick;
      if (!id) { window.clearInterval(t); return; }
      if (document.querySelector(`[data-node-id="${CSS.escape(id)}"]`)) { pendingPick = null; window.clearInterval(t); jumpTo([id]); }
      else if (++tries > 120) { pendingPick = null; window.clearInterval(t); }
    }, 250);
    return () => window.clearInterval(t);
  }, []);
  const c = activeId ? byId[activeId] : null;
  if (!c) return null;
  return (
    <Link href={conceptsHref(c.group)} data-concepts-back="" className="tactile inline-flex items-center gap-1 rounded-md border border-accent/50 bg-accent-soft/40 px-2 py-1 text-small font-medium text-fg" title="Back to the concepts, side by side">
      ◐ Concepts
    </Link>
  );
}
