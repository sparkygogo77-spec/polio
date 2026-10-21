"use client";
/**
 * THE ELEMENT TAB'S WAY IN: THE PAGE'S PARTS AS A TREE, AND WHAT STILL NEEDS DECIDING.
 *
 * With nothing picked the tab lists the page's parts in the order they come
 * on the page, each holding what is inside it (`partTree.ts`); under "Show
 * nesting" every open holder is a box round what it holds, boxes inside
 * boxes, starting from the outermost container. Hovering a row outlines the part on the board
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
import { canRemake, openRemake } from "../RemakePicture";
import * as React from "react";
import {
  AppWindow, ChevronLeft, ChevronRight, CircleAlert, FileText, Film, Heading, Image as ImageIcon, Link2, List, Menu,
  MousePointerClick, PanelBottom, PanelTop, PenTool, Sparkle, Square, TextCursorInput, Type, LayoutPanelTop, Copy, Shapes,
} from "lucide-react";
import { getFeature } from "../shelf";
import { useHeldStudio, useStudio, type StudioNode } from "../board/store";
import { ancestors, partTree, visibleRows, type PartTree, type TreeRow } from "../partTree";
import { componentsOf, KIND_WORD, LAYER_WORD, type CompNode, type Components } from "../components";
import { resolvePalette } from "../shelf/run";
import { filterRows, foldComponentRows, partList, type ComponentRow, type ListPart } from "../partList";
import { Switch } from "@/core/ui/switch";
import { kindOf, partName } from "../partNames";
import { decisions, decisionSays, type Decision } from "../shelf";
import { pointAt } from "../SiteColours";
import { partLearned } from "../learn";
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

/**
 * The tree of a page's parts, exactly as they hold each other on the page,
 * worked out once per change of the page. Components are not folded here: a
 * ticker read round a whole page pulled its header and body up beside each
 * other (J, 2026-10-21), so a component's host says what it is on its row
 * and its layers stay wherever the page has them.
 */
export function usePartTree(nodes: StudioNode[]): PartTree {
  return React.useMemo(() => partTree(nodes), [nodes]);
}

/** Open a holder, and any wrapper that is all it holds (a div round a div round the header), so a press shows something to read. */
function openDown(tree: PartTree, open: Set<string>, id: string) {
  for (let at: string | undefined = id; at; ) {
    open.add(at);
    const k: string[] = tree.kids.get(at) ?? [];
    at = k.length === 1 && tree.kids.get(k[0]!)?.length ? k[0] : undefined;
  }
}

/* Each open holder is drawn as a box round what it holds, boxes inside boxes, as J sketched it. */
const INDENT = 12;
/** How far in a box at this depth stands from the right edge: each level a little inside the one round it. */
const insetRight = (k: number) => 2 + k * 3;

/** The boxes behind one row: the sides of each holder it is in, the top of its own when open, and the bottom of each that closes after it. */
function Boxes({ r, open }: { r: TreeRow; open: boolean }) {
  const own = open && r.kids > 0;
  const levels = own ? r.depth + 1 : r.depth;
  if (!levels) return null;
  const out: React.ReactNode[] = [];
  for (let k = 0; k < levels; k++) {
    const top = own && k === r.depth;
    /* The innermost `ends` holders close here, each a little above the one round it. */
    const closing = !top && k >= r.depth - r.ends;
    const lift = closing ? 2 + (r.depth - 1 - k) * 2 : 0;
    out.push(
      <span
        key={k}
        aria-hidden
        data-tree-box={k}
        data-tree-box-edge={top ? "top" : closing ? "bottom" : undefined}
        className={cn(
          "pointer-events-none absolute border-x border-border bg-fg/[0.03]",
          top && "rounded-t-md border-t",
          closing && "rounded-b-md border-b",
        )}
        style={{ left: 1 + k * INDENT, right: insetRight(k), top: top ? 2 : 0, bottom: lift }}
      />,
    );
  }
  return <>{out}</>;
}

/** The components among these parts, read with the site's own colour roles. */
export function usePageComponents(nodes: StudioNode[]): Components {
  const format = useHeldStudio((s) => s.format);
  const look = useHeldStudio((s) => s.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  return React.useMemo(() => componentsOf(nodes as unknown as CompNode[], palette), [nodes, palette]);
}

/* ------------------------------------------------------------------ */
/* The tree                                                            */
/* ------------------------------------------------------------------ */

export function PartsTree({ nodes, picked, className }: { nodes: StudioNode[]; picked?: string | null; className?: string }) {
  const tree = usePartTree(nodes);
  const comps = usePageComponents(nodes);
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  /* A component keeps its own name and says what it is beside it ("Button · 3 layers"); a layer sitting in it reads as the job it does there ("Words: BUY $TRORTY"). A component with no layers is just the part. */
  const roleOfLayer = React.useMemo(() => new Map(comps.list.flatMap((c) => c.layers.filter((l) => ancestors(tree, l.id).includes(c.id)).map((l) => [l.id, l.role] as const))), [comps, tree]);
  const stacked = React.useMemo(() => new Map(comps.list.filter((c) => c.layers.length).map((c) => [c.id, c])), [comps]);
  const names = React.useMemo(() => new Map(nodes.map((n) => {
    const role = roleOfLayer.get(n.id);
    return [n.id, role ? `${LAYER_WORD[role]}: ${nameOf(n, nodes)}` : nameOf(n, nodes)];
  })), [nodes, roleOfLayer]);
  /* The top level starts open: a page is usually one body holding its sections, and a tree that opens on one row says nothing. */
  const [open, setOpen] = React.useState<Set<string>>(() => { const n = new Set<string>(); for (const id of tree.roots) openDown(tree, n, id); return n; });
  /* Picked on the board: open the tree down to it. */
  React.useEffect(() => {
    if (!picked || !byId.has(picked)) return;
    const up = ancestors(tree, picked);
    setOpen((was) => (up.every((a) => was.has(a)) ? was : new Set([...was, ...up])));
  }, [picked, tree, byId]);
  const rows = React.useMemo(() => visibleRows(tree, open), [tree, open]);
  const toggle = (id: string) => setOpen((was) => { const n = new Set(was); if (n.has(id)) n.delete(id); else openDown(tree, n, id); return n; });
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
              data-tree-open={r.kids ? String(isOpen) : undefined}
              className="group relative h-7"
              style={{ paddingLeft: 4 + r.depth * INDENT, paddingRight: insetRight(isOpen && r.kids ? r.depth : Math.max(0, r.depth - 1)) + 4 }}
              onPointerEnter={() => pointAt([r.id])}
              /* A right-click on a picture's row opens "Remake this picture…", the same card as the wheel's tray (RemakePicture.tsx). */
              onContextMenu={canRemake(n) ? (e) => { e.preventDefault(); e.stopPropagation(); openRemake(r.id); } : undefined}
              data-tree-picture={canRemake(n) ? "" : undefined}
            >
              <Boxes r={r} open={isOpen} />
              <div className={cn("relative flex h-full items-center gap-1 rounded-sm pl-0.5 pr-1 text-plain", on ? "bg-accent-soft text-fg shadow-[inset_2px_0_0_var(--accent)]" : "hover:bg-hover")}>
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
                {stacked.get(r.id) ? (
                  <span data-tree-component={stacked.get(r.id)!.kind} className="shrink-0 rounded-sm bg-hover px-1 text-fine text-fg-muted" title="Recognised as one thing: its layers move, resize and recolour with it.">
                    {KIND_WORD[stacked.get(r.id)!.kind]} · {stacked.get(r.id)!.layers.length} {stacked.get(r.id)!.layers.length === 1 ? "layer" : "layers"}
                  </span>
                ) : roleOfLayer.get(r.id) ? <span data-tree-layer={roleOfLayer.get(r.id)} className="sr-only">layer</span> : r.kids ? <span className="num shrink-0 text-fine text-fg-faint">{r.kids}</span> : null}
              </button>
              </div>
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
/** A row's height in the flat list (h-7). */
const ROW_PX = 28;
const LIST_ICON: Record<string, React.ComponentType<{ className?: string }>> = { "Copy bar": Copy, Shape: Shapes };

/** A part's name in the code, in plain words: data-hook "chart-tv-knob-volume" is "chart tv knob volume". */
const hookWords = (n: StudioNode | undefined) => {
  const h = (n as { hooks?: Record<string, unknown> | null } | undefined)?.hooks?.["data-hook"];
  return typeof h === "string" && h.trim() ? h.trim().replace(/[-_]+/g, " ") : undefined;
};

export function ElementList({ nodes, picked, className, onRows }: { nodes: StudioNode[]; picked?: string | null; className?: string; onRows?: (count: number) => void }) {
  const siteName = useHeldStudio((s) => s.brief.name);
  const [nesting, setNesting] = React.useState(() => {
    try { return typeof window !== "undefined" && window.localStorage.getItem(NESTING_KEY) === "1"; } catch { return false; }
  });
  const [query, setQuery] = React.useState("");
  const comps = usePageComponents(nodes);
  /* A component (a button and its stacked layers) is one row, as it is one group under Show nesting. */
  const rows = React.useMemo(
    () => foldComponentRows(partList(nodes as unknown as ListPart[], { siteName, featureName }), comps.list.filter((c) => c.layers.length).map((c) => ({ id: c.id, kindWord: KIND_WORD[c.kind], name: c.name, parts: c.parts, hookName: hookWords(nodes.find((n) => n.id === c.id)) }))),
    [nodes, siteName, comps],
  );
  /* The heading's count is the rows here, not the parts behind them (510 parts on PST's Play page are 211 rows). */
  React.useEffect(() => { onRows?.(rows.length); }, [rows.length, onRows]);
  const shown = React.useMemo(() => filterRows(rows, query), [rows, query]);
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const box = React.useRef<HTMLDivElement>(null);
  const scroller = React.useRef<HTMLDivElement | null>(null);
  const keepScroller = React.useCallback((n: HTMLDivElement | null) => { scroller.current = n; }, []);
  React.useEffect(() => {
    if (!picked || nesting) return;
    const t = window.setTimeout(() => {
      const el = box.current?.querySelector(`[data-list-ids~="${CSS.escape(picked)}"]`);
      if (el) { el.scrollIntoView({ block: "nearest" }); return; }
      /* The list draws only the rows in view: a row further down is reached by where it stands in the list. */
      const at = shown.findIndex((r) => r.ids.includes(picked));
      const sc = scroller.current;
      if (at >= 0 && sc) sc.scrollTop = Math.max(0, at * ROW_PX - sc.clientHeight / 2);
    }, 60);
    return () => window.clearTimeout(t);
  }, [picked, nesting, shown]);
  React.useEffect(() => () => pointAt(null), []);
  const setNest = (on: boolean) => {
    setNesting(on);
    try { window.localStorage.setItem(NESTING_KEY, on ? "1" : "0"); } catch { /* a private window keeps it for the visit */ }
  };
  const go = (r: ComponentRow) => {
    play("select");
    goToPart(r.id);
    /* One row standing for several parts (the same state shown by several presses) picks them all; a component's row picks its host, which carries its layers. */
    if (r.ids.length > 1 && !r.component) useStudio.getState().setSelection(r.ids);
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
          {shown.length ? (
            <VirtualList
              items={shown}
              getKey={(r) => r.id}
              estimateSize={ROW_PX}
              scrollRef={keepScroller}
              className="h-full py-1"
              renderItem={(r) => {
                const on = !!picked && r.ids.includes(picked);
                const Icon = LIST_ICON[r.kind];
                return (
                  <div
                    data-list-row={r.id}
                    data-list-ids={r.ids.join(" ")}
                    data-list-component={r.component ? comps.byId.get(r.component)?.kind : undefined}
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
                      {r.component ? (
                        <span data-list-layers="" className="shrink-0 rounded-sm bg-hover px-1 text-fine text-fg-muted" title="Recognised as one thing: its layers move, resize and recolour with it.">
                          {r.ids.length - 1} {r.ids.length - 1 === 1 ? "layer" : "layers"}
                        </span>
                      ) : r.ids.length > 1 ? <span className="num shrink-0 text-fine text-fg-faint">×{r.ids.length}</span> : null}
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
  const learn = useHeldStudio((s) => s.learn);
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
  const pages = useHeldStudio((s) => s.pages);
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
  const pages = useHeldStudio((s) => s.pages);
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
export const OPEN_SECTION = "studio:open-section";
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
export function PanelSection({ id, title, icon, note, defaultOpen = true, holds, inside, children }: {
  id: string; title: string; icon?: React.ReactNode; note?: string; defaultOpen?: boolean;
  /** The sections folded inside this one (More): asking for one of them opens this first, then it. */
  holds?: string[];
  /** A section inside another (More's rows): a quieter head, no line under the last one. */
  inside?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  React.useEffect(() => { const kept = readFolds()[id]; if (typeof kept === "boolean") setOpen(kept); }, [id]);
  const box = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const on = (e: Event) => {
      const want = (e as CustomEvent<string>).detail;
      if (want !== id && !holds?.includes(want)) return;
      if (want !== id) {
        /* Its row mounts once this opens: ask again for it on the next tick. */
        if (!open) window.setTimeout(() => openSection(want), 0);
        setOpen(true);
        return;
      }
      setOpen(true);
      play("open");
      window.setTimeout(() => box.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
    };
    window.addEventListener(OPEN_SECTION, on);
    return () => window.removeEventListener(OPEN_SECTION, on);
  }, [id, holds, open]);
  const toggle = () => {
    const now = !open;
    play(now ? "open" : "close");
    setOpen(now);
    try { localStorage.setItem(SECTIONS_KEY, JSON.stringify({ ...readFolds(), [id]: now })); } catch { /* kept for this visit */ }
  };
  return (
    <section ref={box} data-part-section={id} data-open={open ? "" : undefined} data-inside={inside ? "" : undefined} className={inside ? "-mx-3 border-t border-border first:border-t-0" : "border-b border-border"}>
      <button type="button" aria-expanded={open} data-section-head="" onClick={toggle}
        className={cn("tactile flex w-full items-center gap-2 px-3 text-left hover:bg-hover/50", inside ? "h-7" : "h-8")}>
        {icon ? <span className="flex size-4 shrink-0 items-center justify-center text-fg-muted [&_svg]:size-3.5">{icon}</span> : null}
        <span className={cn("min-w-0 flex-1 truncate text-small text-fg", inside ? "font-medium" : "font-semibold uppercase tracking-[0.08em]")}>{title}</span>
        {note ? <span className="shrink-0 truncate text-fine text-fg-faint">{note}</span> : null}
        <ChevronRight className={cn("size-3.5 shrink-0 text-fg-faint transition-transform", open && "rotate-90")} />
      </button>
      {open ? <div className="space-y-3 px-3 pb-3 pt-1">{children}</div> : null}
    </section>
  );
}
