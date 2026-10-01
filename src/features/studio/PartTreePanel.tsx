"use client";
/**
 * THE ELEMENT TAB'S WAY IN: THE PAGE'S PARTS AS A TREE, AND WHAT STILL NEEDS DECIDING.
 *
 * With nothing picked the tab lists the page's parts in the order they come
 * on the page, top to bottom, each section holding what is inside it
 * (`partTree.ts`). Hovering a row outlines the part on the board
 * (`pointAt`); pressing it picks the part, brings it into view and opens its
 * own panel. A part picked on the board is lit in the tree, and the tree
 * opens down to it.
 *
 * The summary's counts that name parts (parts that need a decision, links on
 * this page) open the list of exactly those parts here, each with its
 * readable name, what the decision is, and the fix where it can be made in
 * one line: where a link leads (a page, a section of this page, a web
 * address), or that it goes nowhere on purpose.
 *
 * The sections of a part's own panel (`PanelSection`) fold, and remember
 * being folded in this browser.
 */
import { canRemake, openRemake } from "./RemakePicture";
import * as React from "react";
import {
  AppWindow, ChevronLeft, ChevronRight, CircleAlert, FileText, Film, Heading, Image as ImageIcon, Link2, List, Menu,
  MousePointerClick, PanelBottom, PanelTop, PenTool, Sparkle, Square, TextCursorInput, Type, LayoutPanelTop, Copy, Shapes,
} from "lucide-react";
import { getFeature } from "./catalog";
import { useStudio, type StudioNode } from "./store";
import { ancestors, partTree, visibleRows, type PartTree } from "./partTree";
import { filterRows, partList, type ListPart, type ListRow } from "./partList";
import { Switch } from "@/core/ui/switch";
import { kindOf, partName } from "./partNames";
import { decisions, decisionSays, type Decision } from "./library/badge";
import { pointAt, PointMarks } from "./SiteColours";
import { partLearned } from "./learn";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Select } from "@/core/ui/select";
import { VirtualList } from "@/core/ui/virtual-list";

const featureName = (id: string) => getFeature(id)?.name;
export const nameOf = (n: StudioNode, all: readonly StudioNode[]) => partName(n, all, featureName);
export const kindWord = (n: StudioNode) => kindOf(n, featureName);

/** A small mark for each kind of part, so a tree of sixty rows can be read by shape as well as by name. */
const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Section: LayoutPanelTop, Header: PanelTop, Footer: PanelBottom, Menu, Link: Link2, Button: MousePointerClick,
  Picture: ImageIcon, Words: Type, Heading, Decoration: Sparkle, Drawing: PenTool, Video: Film, List, "List item": List,
  Field: TextCursorInput, Form: TextCursorInput, "Page body": FileText, "Embedded page": AppWindow,
};
export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = KIND_ICON[kind] ?? Square;
  return <Icon className={className ?? "size-3.5"} />;
}

/** Pick a part, bring it into view on the board, and open its panel. */
export function goToPart(id: string) {
  const s = useStudio.getState();
  if (s.mode !== "design") s.setMode("design");
  s.setSelection([id]);
  s.want({ panel: "inspector" });
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-studio-scroll] [data-node-id="${CSS.escape(id)}"]`) ?? document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  });
}

/** The tree for these nodes, worked out once per change of the page. */
export function usePartTree(nodes: StudioNode[]): PartTree {
  return React.useMemo(() => partTree(nodes), [nodes]);
}

/* ------------------------------------------------------------------ */
/* The tree                                                            */
/* ------------------------------------------------------------------ */

export function PartsTree({ nodes, picked, className }: { nodes: StudioNode[]; picked?: string | null; className?: string }) {
  const tree = usePartTree(nodes);
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const names = React.useMemo(() => new Map(nodes.map((n) => [n.id, nameOf(n, nodes)])), [nodes]);
  /* The top level starts open: a page is usually one body holding its sections, and a tree that opens on one row says nothing. */
  const [open, setOpen] = React.useState<Set<string>>(() => new Set(tree.roots));
  /* Picked on the board: open the tree down to it. */
  React.useEffect(() => {
    if (!picked || !byId.has(picked)) return;
    const up = ancestors(tree, picked);
    setOpen((was) => (up.every((a) => was.has(a)) ? was : new Set([...was, ...up])));
  }, [picked, tree, byId]);
  const rows = React.useMemo(() => visibleRows(tree, open), [tree, open]);
  const toggle = (id: string) => setOpen((was) => { const n = new Set(was); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  /* Bring the picked row into view once the tree has opened down to it. */
  const box = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!picked) return;
    const t = window.setTimeout(() => box.current?.querySelector(`[data-tree-row="${CSS.escape(picked)}"]`)?.scrollIntoView({ block: "nearest" }), 60);
    return () => window.clearTimeout(t);
  }, [picked, rows]);
  React.useEffect(() => () => pointAt(null), []);
  if (!nodes.length) {
    return (
      <p className="px-3 py-4 text-center text-plain text-fg-muted">
        Nothing on this page yet. Open the parts drawer under the board, place a part, then pick it to say what it should be.
      </p>
    );
  }
  return (
    <div ref={box} data-parts-tree="" className={cn("min-h-0", className)} onPointerLeave={() => pointAt(null)}>
      <PointMarks />
      <VirtualList
        items={rows}
        getKey={(r) => r.id}
        estimateSize={28}
        className="h-full py-1"
        renderItem={(r) => {
          const n = byId.get(r.id)!;
          const kind = kindWord(n);
          const on = picked === r.id;
          const isOpen = open.has(r.id);
          return (
            <div
              data-tree-row={r.id}
              data-tree-depth={r.depth}
              data-tree-picked={on ? "" : undefined}
              className={cn("group flex h-7 items-center gap-1 rounded-sm pr-1.5 text-plain", on ? "bg-accent-soft text-fg shadow-[inset_2px_0_0_var(--accent)]" : "hover:bg-hover")}
              style={{ paddingLeft: 4 + r.depth * 12 }}
              onPointerEnter={() => pointAt([r.id])}
              /* A right-click on a picture's row opens "Remake this picture…", the same card as the wheel's tray (RemakePicture.tsx). */
              onContextMenu={canRemake(n) ? (e) => { e.preventDefault(); e.stopPropagation(); openRemake(r.id); } : undefined}
              data-tree-picture={canRemake(n) ? "" : undefined}
            >
              {r.kids ? (
                <button
                  type="button"
                  data-tree-toggle=""
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? "Close" : "Open"} ${names.get(r.id)}`}
                  onClick={() => { play("tap"); toggle(r.id); }}
                  className="tactile flex size-5 shrink-0 items-center justify-center rounded-sm text-fg-faint hover:text-fg"
                >
                  <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
                </button>
              ) : <span className="size-5 shrink-0" />}
              <button
                type="button"
                data-element-row=""
                title={`${names.get(r.id)} (${kind.toLowerCase()})`}
                onClick={() => { play("select"); goToPart(r.id); }}
                className="tactile flex min-w-0 flex-1 items-center gap-1.5 text-left"
              >
                <span className={cn("shrink-0", on ? "text-accent" : "text-fg-faint group-hover:text-fg-muted")}><KindIcon kind={kind} /></span>
                <span data-tree-name="" className="min-w-0 flex-1 truncate">{names.get(r.id)}</span>
                {r.kids ? <span className="num shrink-0 text-fine text-fg-faint">{r.kids}</span> : null}
              </button>
            </div>
          );
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The flat list                                                       */
/* ------------------------------------------------------------------ */

/*
 * THE ELEMENT TAB'S LIST: every element on the page, one row each, in the
 * order a visitor sees them (`partList.ts`). The owner found the tree hard to
 * read: nested rows, names that repeated the site's title, and the same
 * "CA copied!" four times. Each row is a small icon, a plain name from its
 * words or role and where it sits; a state that only a press shows sits once
 * under the control that shows it. Hovering a row outlines its part on the
 * board, pressing it picks it and brings it into view, and the search box
 * keeps the rows whose name or place match. "Show nesting" is the tree, for
 * people who want it; the choice is remembered in this browser.
 */
const NESTING_KEY = "builder.elementsNesting";
const LIST_ICON: Record<string, React.ComponentType<{ className?: string }>> = { "Copy bar": Copy, Shape: Shapes };

export function ElementList({ nodes, picked, className }: { nodes: StudioNode[]; picked?: string | null; className?: string }) {
  const siteName = useStudio((s) => s.brief.name);
  const [nesting, setNesting] = React.useState(() => {
    try { return typeof window !== "undefined" && window.localStorage.getItem(NESTING_KEY) === "1"; } catch { return false; }
  });
  const [query, setQuery] = React.useState("");
  const rows = React.useMemo(() => partList(nodes as unknown as ListPart[], { siteName, featureName }), [nodes, siteName]);
  const shown = React.useMemo(() => filterRows(rows, query), [rows, query]);
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const box = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!picked || nesting) return;
    const t = window.setTimeout(() => box.current?.querySelector(`[data-list-ids~="${CSS.escape(picked)}"]`)?.scrollIntoView({ block: "nearest" }), 60);
    return () => window.clearTimeout(t);
  }, [picked, nesting, shown]);
  React.useEffect(() => () => pointAt(null), []);
  const setNest = (on: boolean) => {
    setNesting(on);
    try { window.localStorage.setItem(NESTING_KEY, on ? "1" : "0"); } catch { /* a private window keeps it for the visit */ }
  };
  const go = (r: ListRow) => {
    play("select");
    goToPart(r.id);
    /* One row standing for several parts (the same state shown by several presses) picks them all. */
    if (r.ids.length > 1) useStudio.getState().setSelection(r.ids);
  };
  return (
    <div data-element-list={nesting ? "tree" : "flat"} className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex shrink-0 items-center gap-2 border-b border-border p-1.5">
        <Input
          inputSize="sm"
          data-element-search=""
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find an element by its words or place"
          aria-label="Find an element"
          className="min-w-0 flex-1"
          disabled={nesting}
        />
        <label className="flex shrink-0 items-center gap-1.5 text-fine text-fg-muted">
          <Switch size="sm" data-show-nesting="" checked={nesting} onCheckedChange={setNest} aria-label="Show nesting" />
          Show nesting
        </label>
      </div>
      {nesting ? <PartsTree nodes={nodes} picked={picked} className="min-h-0 flex-1" /> : !nodes.length ? (
        <p className="px-3 py-4 text-center text-plain text-fg-muted">
          Nothing on this page yet. Open the parts drawer under the board, place a part, then pick it to say what it should be.
        </p>
      ) : (
        <div ref={box} data-parts-list="" className="min-h-0 flex-1" onPointerLeave={() => pointAt(null)}>
          <PointMarks />
          {shown.length ? (
            <VirtualList
              items={shown}
              getKey={(r) => r.id}
              estimateSize={28}
              className="h-full py-1"
              renderItem={(r) => {
                const on = !!picked && r.ids.includes(picked);
                const Icon = LIST_ICON[r.kind];
                return (
                  <div
                    data-list-row={r.id}
                    data-list-ids={r.ids.join(" ")}
                    data-list-after={r.after ? "" : undefined}
                    data-list-picked={on ? "" : undefined}
                    className={cn("group flex h-7 items-center gap-1.5 rounded-sm pr-1.5 text-plain", on ? "bg-accent-soft text-fg shadow-[inset_2px_0_0_var(--accent)]" : "hover:bg-hover")}
                    style={{ paddingLeft: r.depth ? 26 : 8 }}
                    onPointerEnter={() => pointAt(r.ids)}
                    /* A right-click on a picture's row opens "Remake this picture…", as the tree's does (RemakePicture.tsx). */
                    onContextMenu={canRemake(byId.get(r.id)) ? (e) => { e.preventDefault(); e.stopPropagation(); openRemake(r.id); } : undefined}
                    data-list-picture={canRemake(byId.get(r.id)) ? "" : undefined}
                  >
                    <button
                      type="button"
                      data-element-row=""
                      title={`${r.name}${r.where ? `, ${r.where}` : ""}${r.after ? ", shows after a press" : ""}${r.ids.length > 1 ? ` (${r.ids.length} parts)` : ""}`}
                      onClick={() => go(r)}
                      className="tactile flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      <span className={cn("shrink-0", on ? "text-accent" : "text-fg-faint group-hover:text-fg-muted")}>
                        {Icon ? <Icon className="size-3.5" /> : <KindIcon kind={r.kind} />}
                      </span>
                      <span data-list-name="" className="min-w-0 truncate">{r.name}</span>
                      {r.where ? <span data-list-where="" className="min-w-0 shrink truncate text-fine text-fg-faint">{r.where}</span> : null}
                      {r.after ? <span data-list-press="" className="shrink-0 rounded-xs border border-border px-1 text-fine text-fg-muted">shows after press</span> : null}
                      {r.ids.length > 1 ? <span className="num shrink-0 text-fine text-fg-faint">×{r.ids.length}</span> : null}
                    </button>
                  </div>
                );
              }}
            />
          ) : <p className="px-3 py-4 text-center text-small text-fg-muted">Nothing here matches “{query}”.</p>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Decisions                                                            */
/* ------------------------------------------------------------------ */

/** The parts wearing an orange ! on the board, read the way the board reads them (`Canvas.tsx`). */
export function useDecisions(nodes: readonly StudioNode[]): Decision[] {
  const learn = useStudio((s) => s.learn);
  return React.useMemo(() => decisions(nodes).filter((d) => !learn || !partLearned(learn, d.id)), [nodes, learn]);
}

/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */

/** Sections of this page a link can lead to: the parts that are sections, by their heading. */
function sectionsOf(nodes: readonly StudioNode[]): { id: string; name: string }[] {
  return nodes.filter((n) => kindWord(n) === "Section").sort((a, b) => a.y - b.y).map((n) => ({ id: n.id, name: nameOf(n, nodes).replace(/^Section\s+/, "") }));
}

/**
 * The fix for a part that goes nowhere, in one line: where it leads (a page,
 * a section of this page, a web address), or that it goes nowhere on purpose.
 */
export function LeadsTo({ node, nodes, compact }: { node: StudioNode; nodes: readonly StudioNode[]; compact?: boolean }) {
  const pages = useStudio((s) => s.pages);
  const [choice, setChoice] = React.useState("");
  const [address, setAddress] = React.useState("https://");
  const sections = React.useMemo(() => sectionsOf(nodes).filter((s) => s.id !== node.id), [nodes, node.id]);
  const set = (patch: Partial<StudioNode>) => { play("confirm"); useStudio.getState().updateNode(node.id, patch); };
  const pick = (v: string) => {
    setChoice(v);
    if (v.startsWith("page:")) set({ link: { kind: "page", target: v.slice(5) }, nowhere: false });
    else if (v.startsWith("node:")) set({ link: { kind: "node", target: v.slice(5) }, nowhere: false });
    else if (v === "nowhere") set({ nowhere: true });
  };
  const url = address.trim();
  const goodUrl = /^(https?:\/\/[^\s/]+\.[^\s]+|mailto:\S+@\S+)$/i.test(url);
  return (
    <div data-leads-to={node.id} className={cn("space-y-1.5", compact ? "" : "")}>
      <Select
        value={choice}
        placeholder="Choose where it leads…"
        aria-label="Where it leads"
        onChange={pick}
        options={[
          ...pages.map((p) => ({ value: `page:${p.id}`, label: `Page: ${p.name}` })),
          ...sections.map((s) => ({ value: `node:${s.id}`, label: `Section: ${s.name}` })),
          { value: "url", label: "A web address…" },
          { value: "nowhere", label: "Nowhere, on purpose" },
        ]}
      />
      {choice === "url" ? (
        <div className="flex items-center gap-1">
          <Input inputSize="sm" className="min-w-0 flex-1" aria-label="Web address" value={address} onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && goodUrl) set({ link: { kind: "url", target: url }, nowhere: false }); }} />
          <Button size="xs" variant="primary" disabled={!goodUrl} onClick={() => set({ link: { kind: "url", target: url }, nowhere: false })}>Use it</Button>
        </div>
      ) : null}
    </div>
  );
}

/** What one listed part is waiting on, in a line. */
function decisionLine(d: Decision, n: StudioNode): string {
  return decisionSays(d.why, kindWord(n));
}

/** Where a link leads, said plainly. */
export function leadsSays(n: StudioNode, all: readonly StudioNode[], pages: readonly { id: string; name: string }[]): string {
  const l = n.link;
  if (!l) return n.nowhere ? "goes nowhere, on purpose" : "goes nowhere yet";
  if (l.kind === "page") return `leads to the page ${pages.find((p) => p.id === l.target)?.name ?? "that was removed"}`;
  if (l.kind === "node") { const t = all.find((m) => m.id === l.target); return `scrolls to ${t ? nameOf(t, all) : "a part no longer on the page"}`; }
  return `leads to ${l.target.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
}

/**
 * The parts behind one of the summary's counts, listed where the count is.
 * `decide` lists what needs a decision, with the fix inline; `links` lists
 * the links and where each leads.
 */
export function PartsBehind({ which, nodes, onClose }: { which: "decide" | "links"; nodes: StudioNode[]; onClose: () => void }) {
  const pages = useStudio((s) => s.pages);
  const tree = usePartTree(nodes);
  const order = React.useMemo(() => { const at = new Map<string, number>(); let i = 0; const walk = (ids: string[]) => { for (const id of ids) { at.set(id, i++); walk(tree.kids.get(id) ?? []); } }; walk(tree.roots); return at; }, [tree]);
  const open = useDecisions(nodes);
  const list = React.useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const rows = which === "decide"
      ? open.map((d) => ({ node: byId.get(d.id)!, d })).filter((r) => r.node)
      : nodes.filter((n) => !!n.link).map((node) => ({ node, d: null as Decision | null }));
    return rows.sort((a, b) => (order.get(a.node.id) ?? 0) - (order.get(b.node.id) ?? 0));
  }, [which, nodes, order, open]);
  React.useEffect(() => () => pointAt(null), []);
  return (
    <div data-parts-behind={which} className="space-y-1 rounded-md border border-border bg-elevated/40 p-1.5" onPointerLeave={() => pointAt(null)}>
      <PointMarks />
      <div className="flex items-center justify-between px-0.5">
        <span className="text-small font-medium text-fg">{which === "decide" ? "Parts that need a decision" : "Links on this page"}</span>
        <Button size="xs" variant="ghost" onClick={onClose}>Close</Button>
      </div>
      {!list.length ? <p className="px-1 text-small text-fg-muted">{which === "decide" ? "Nothing is waiting on a decision." : "No part on this page links anywhere."}</p> : null}
      {list.map(({ node, d }) => {
        const kind = kindWord(node);
        return (
          <div key={node.id} data-behind-row={node.id} className="space-y-1 rounded-sm border border-border/70 bg-panel/60 p-1.5" onPointerEnter={() => pointAt([node.id])}>
            <button type="button" data-behind-go="" onClick={() => { play("select"); goToPart(node.id); }} className="tactile flex w-full min-w-0 items-start gap-1.5 text-left">
              <span className={cn("mt-0.5 shrink-0", d ? "text-[oklch(0.74_0.18_55)]" : "text-fg-faint")}>{d ? <CircleAlert className="size-3.5" /> : <KindIcon kind={kind} />}</span>
              <span className="min-w-0 flex-1">
                <span data-behind-name="" className="block truncate text-plain text-fg">{nameOf(node, nodes)}</span>
                <span data-behind-says="" className="block text-small leading-snug text-fg-muted">{d ? decisionLine(d, node) : leadsSays(node, nodes, pages)}</span>
              </span>
            </button>
            {d?.why === "nowhere" ? <LeadsTo node={node} nodes={nodes} compact /> : null}
            {d?.why === "live" ? (
              <Button size="xs" variant="outline" className="w-full" onClick={() => { play("open"); goToPart(node.id); }}>Open it to say where the number comes from</Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A part's panel: the way back, and its sections                       */
/* ------------------------------------------------------------------ */

/** Page > Section > … > this part, with a way back to the tree. Each step picks that part. */
export function Crumbs({ node, nodes, pageName, onBack }: { node: StudioNode; nodes: StudioNode[]; pageName: string; onBack: () => void }) {
  const tree = usePartTree(nodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  /* The steps worth naming: the page, each holder that is a place (a section, a header, a card), and the part. */
  const up = ancestors(tree, node.id).map((id) => byId.get(id)!).filter((n) => n && kindWord(n) !== "Page body");
  const steps = up.length > 2 ? [up[0]!, null, up[up.length - 1]!] : up;
  return (
    <nav data-crumbs="" aria-label="Where this part is" className="flex min-w-0 items-center gap-0.5 text-small text-fg-muted">
      <button type="button" data-back-to-tree="" aria-label="Back to all parts" title="Back to all parts" onClick={() => { play("close"); onBack(); }}
        className="tactile -ml-1 flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg">
        <ChevronLeft className="size-4" />
      </button>
      <button type="button" data-crumb="page" onClick={() => { play("close"); onBack(); }} className="tactile shrink-0 truncate hover:text-fg">{pageName}</button>
      {steps.map((n, i) => (
        <React.Fragment key={n?.id ?? `gap${i}`}>
          <ChevronRight className="size-3 shrink-0 text-fg-faint" />
          {n ? (
            <button type="button" data-crumb={n.id} title={nameOf(n, nodes)} onClick={() => { play("select"); goToPart(n.id); }} className="tactile min-w-0 max-w-[6rem] truncate hover:text-fg">
              {kindWord(n)}
            </button>
          ) : <span className="shrink-0 text-fg-faint">…</span>}
        </React.Fragment>
      ))}
      <ChevronRight className="size-3 shrink-0 text-fg-faint" />
      <span data-crumb="self" className="min-w-0 shrink truncate text-fg">{kindWord(node)}</span>
    </nav>
  );
}

const SECTIONS_KEY = "builder.partSections";
const OPEN_SECTION = "studio:open-section";
/** Open one section of the part's panel and bring it into view: "Draw one" opens Make a picture. */
export function openSection(id: string) {
  window.dispatchEvent(new CustomEvent(OPEN_SECTION, { detail: id }));
}
function readFolds(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? "{}") as Record<string, boolean>; } catch { return {}; }
}

/**
 * One section of a part's panel. The same head on every one: an icon, the
 * title, a short note at the right, a chevron. Folded or open is kept in
 * this browser, so a person who closes Motion once has it closed on every
 * part after.
 */
export function PanelSection({ id, title, icon, note, defaultOpen = true, children }: {
  id: string; title: string; icon?: React.ReactNode; note?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  React.useEffect(() => { const kept = readFolds()[id]; if (typeof kept === "boolean") setOpen(kept); }, [id]);
  const box = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) return;
      setOpen(true);
      play("open");
      window.setTimeout(() => box.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
    };
    window.addEventListener(OPEN_SECTION, on);
    return () => window.removeEventListener(OPEN_SECTION, on);
  }, [id]);
  const toggle = () => {
    const now = !open;
    play(now ? "open" : "close");
    setOpen(now);
    try { localStorage.setItem(SECTIONS_KEY, JSON.stringify({ ...readFolds(), [id]: now })); } catch { /* kept for this visit */ }
  };
  return (
    <section ref={box} data-part-section={id} data-open={open ? "" : undefined} className="border-b border-border">
      <button type="button" aria-expanded={open} data-section-head="" onClick={toggle}
        className="tactile flex h-8 w-full items-center gap-2 px-3 text-left hover:bg-hover/50">
        {icon ? <span className="flex size-4 shrink-0 items-center justify-center text-fg-muted [&_svg]:size-3.5">{icon}</span> : null}
        <span className="min-w-0 flex-1 truncate text-small font-semibold uppercase tracking-[0.08em] text-fg">{title}</span>
        {note ? <span className="shrink-0 truncate text-fine text-fg-faint">{note}</span> : null}
        <ChevronRight className={cn("size-3.5 shrink-0 text-fg-faint transition-transform", open && "rotate-90")} />
      </button>
      {open ? <div className="space-y-3 px-3 pb-3 pt-1">{children}</div> : null}
    </section>
  );
}
