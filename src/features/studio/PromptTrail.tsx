"use client";
/**
 * The prompts' paper trail, drawn as a map.
 *
 * Three columns, read left to right like a bracket: what was written (the
 * site's idea, each page's prompt, each part's prompt), what Claude found
 * about it, and what stands now. A line joins each finding to the prompt it
 * was about and each accepted prompt to the finding it answers, so the whole
 * thing reads account to account — this was said, this was found, this is
 * what the site is now told — instead of a critique that sits in a box with
 * no way to act on it.
 *
 * The left column is live: it is the prompts as they are on the board this
 * second, not a copy. The other two come from the trail the store keeps.
 * A finding that carries a prompt has a Take it; pressing it writes the
 * prompt onto the part and the third column gains a bubble.
 */
import * as React from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/button";
import { Badge } from "@/core/ui/badge";
import { Segmented } from "@/core/ui/segmented";
import { Tooltip } from "@/core/ui/tooltip";
import { toRows } from "./spec";
import { useStudio, type RevisionKind, type StudioNode, type TrailEntry, type TrailTarget } from "./store";

interface Lane {
  target: TrailTarget;
  /** Where it sits: the page's name for a part, nothing for the site. */
  where: string;
  /** The prompt as it stands on the board right now. */
  current: string;
  critiques: TrailEntry[];
  finals: TrailEntry[];
}

const sameTarget = (a: TrailTarget, b: TrailTarget) => a.kind === b.kind && a.id === b.id;

const KIND_WORD: Record<RevisionKind, string> = {
  blocks: "blocks everything",
  contradiction: "contradiction",
  missing: "missing",
  fights: "will fight",
  cost: "costly",
  note: "note",
};

const KIND_TONE: Record<RevisionKind, string> = {
  blocks: "border-down/50 bg-down/10",
  contradiction: "border-warn/50 bg-warn/10",
  missing: "border-accent/50 bg-accent-soft/60",
  fights: "border-warn/40 bg-warn/8",
  cost: "border-border-strong bg-elevated",
  note: "border-border bg-elevated",
};

/** Every prompt the board carries, in reading order, with its trail beside it. */
export function useLanes(): Lane[] {
  const brief = useStudio((s) => s.brief);
  const pages = useStudio((s) => s.pages);
  const nodes = useStudio((s) => s.nodes);
  const groups = useStudio((s) => s.groups);
  const trail = useStudio((s) => s.trail);
  return React.useMemo(() => {
    const lanes: Lane[] = [];
    const push = (target: TrailTarget, where: string, current: string) =>
      lanes.push({
        target,
        where,
        current: current.trim(),
        critiques: trail.filter((e) => e.stage === "critique" && sameTarget(e.target, target)),
        finals: trail.filter((e) => e.stage === "final" && sameTarget(e.target, target)),
      });
    push({ kind: "site", id: "site", label: brief.name.trim() || "The site" }, "", [brief.gimmick.trim(), brief.master.trim()].filter(Boolean).join("\n"));
    for (const page of pages) {
      push({ kind: "page", id: page.id, label: page.name }, page.path, page.prompt);
      for (const g of groups.filter((x) => x.pageId === page.id)) push({ kind: "group", id: g.id, label: g.label }, `group on ${page.name}`, g.prompt);
      const onPage = nodes.filter((n) => n.pageId === page.id);
      const ordered: StudioNode[] = toRows(onPage).flat();
      for (const n of ordered) push({ kind: "node", id: n.id, label: n.label }, page.name, n.prompt);
    }
    // Findings about a name the board no longer has — kept, so nothing Claude said is lost.
    for (const e of trail) {
      if (e.target.kind !== "loose" || lanes.some((l) => sameTarget(l.target, e.target))) continue;
      push(e.target, "not on the board", "");
    }
    return lanes;
  }, [brief, pages, nodes, groups, trail]);
}

/** The trail in words, for copying out. */
export function trailToMarkdown(lanes: Lane[]): string {
  const L: string[] = ["# Prompt trail", ""];
  for (const lane of lanes) {
    if (!lane.current && !lane.critiques.length && !lane.finals.length) continue;
    L.push(`## ${lane.target.label}${lane.where ? `, ${lane.where}` : ""}`, "");
    L.push(`**Written:** ${lane.current || "_(no prompt)_"}`, "");
    for (const c of lane.critiques) {
      L.push(`- **Found** (${KIND_WORD[c.kind ?? "note"]}): ${c.text}`);
      if (c.prompt) L.push(`  - proposed: ${c.prompt}${c.applied ? " _(taken)_" : ""}`);
    }
    for (const f of lane.finals) L.push(`- **Now:** ${f.text}`);
    L.push("");
  }
  return L.join("\n");
}

type Filter = "all" | "findings";

export function PromptTrail() {
  const lanes = useLanes();
  const applyRevision = useStudio((s) => s.applyRevision);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [open, setOpen] = React.useState<Set<string>>(() => new Set());
  const box = React.useRef<HTMLDivElement>(null);
  const [links, setLinks] = React.useState<{ d: string; tone: string }[]>([]);

  const found = lanes.filter((l) => l.critiques.length || l.finals.length).length;
  const shown = filter === "findings" ? lanes.filter((l) => l.critiques.length || l.finals.length) : lanes;
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // The lines are drawn after layout from where the bubbles actually are, and
  // again whenever the map changes shape — a bubble opening, a lane appearing.
  const measure = React.useCallback(() => {
    const root = box.current;
    if (!root) return;
    const origin = root.getBoundingClientRect();
    const at = (id: string) => {
      const el = root.querySelector<HTMLElement>(`[data-bubble="${CSS.escape(id)}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left - origin.left + root.scrollLeft, right: r.right - origin.left + root.scrollLeft, mid: r.top - origin.top + root.scrollTop + r.height / 2 };
    };
    const curve = (a: { right: number; mid: number }, b: { left: number; mid: number }) => {
      const dx = Math.max(24, (b.left - a.right) / 2);
      return `M ${a.right} ${a.mid} C ${a.right + dx} ${a.mid}, ${b.left - dx} ${b.mid}, ${b.left} ${b.mid}`;
    };
    const out: { d: string; tone: string }[] = [];
    for (const lane of shown) {
      const author = at(`author:${lane.target.kind}:${lane.target.id}`);
      for (const c of lane.critiques) {
        const cb = at(c.id);
        if (author && cb) out.push({ d: curve(author, cb), tone: "stroke-fg-faint" });
        const f = lane.finals.find((x) => x.parentId === c.id);
        const fb = f ? at(f.id) : null;
        if (cb && fb) out.push({ d: curve(cb, fb), tone: "stroke-up" });
      }
    }
    setLinks(out);
  }, [shown]);

  React.useLayoutEffect(() => {
    measure();
    const root = box.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    root.querySelectorAll<HTMLElement>("[data-bubble]").forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [measure, open]);

  if (!lanes.some((l) => l.current) && !found) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center">
        <Sparkles className="size-4 text-fg-faint" />
        <p className="text-[11px] text-fg-muted">Nothing on the trail yet. Write a prompt on a part, then ask Claude to critique, fill or finish, every finding lands here beside the prompt it was about, with the prompt that would settle it.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented size="xs" value={filter} onChange={(v) => setFilter(v as Filter)} options={[{ value: "all", label: "Every prompt" }, { value: "findings", label: `With findings${found ? ` (${found})` : ""}` }]} aria-label="Which prompts to show" silent />
        <span className="text-[10px] text-fg-faint">Click a bubble to read all of it. Take it writes the proposed prompt onto the part.</span>
      </div>

      <div ref={box} className="relative max-h-[40vh] overflow-auto rounded-md border border-border bg-elevated/40 p-3" data-prompt-trail="">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" style={{ minHeight: "100%" }}>
          {links.map((l, i) => <path key={i} d={l.d} className={cn("fill-none", l.tone)} strokeWidth={1.25} strokeDasharray={l.tone === "stroke-up" ? undefined : "3 3"} />)}
        </svg>

        <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] gap-x-10 gap-y-2">
          <Head label="Written" hint="The prompts as they stand on the board now." />
          <Head label="Found" hint="What Claude said about each one, and the prompt it proposed." />
          <Head label="Now" hint="Proposals taken: the prompt the part carries because of a finding." />

          {shown.map((lane) => {
            const authorId = `author:${lane.target.kind}:${lane.target.id}`;
            const empty = !lane.current && !lane.critiques.length && !lane.finals.length;
            return (
              <React.Fragment key={authorId}>
                <div className="flex items-start">
                  <Bubble
                    id={authorId}
                    tone={lane.target.kind === "site" ? "border-accent/60 bg-accent-soft/70" : lane.target.kind === "page" ? "border-accent/40 bg-accent-soft/40" : lane.target.kind === "loose" ? "border-dashed border-border" : "border-border bg-panel"}
                    title={lane.target.label}
                    meta={lane.where}
                    text={lane.current || (lane.target.kind === "loose" ? "Claude named this; nothing on the board answers to it." : "no prompt yet")}
                    faint={!lane.current}
                    open={open.has(authorId)}
                    onToggle={() => toggle(authorId)}
                    className={cn(empty && "opacity-50")}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  {lane.critiques.length ? lane.critiques.map((c) => (
                    <Bubble
                      key={c.id}
                      id={c.id}
                      tone={KIND_TONE[c.kind ?? "note"]}
                      title={KIND_WORD[c.kind ?? "note"]}
                      meta={[c.mode, c.model].filter(Boolean).join(" · ")}
                      text={c.text || c.prompt || ""}
                      open={open.has(c.id)}
                      onToggle={() => toggle(c.id)}
                      footer={
                        c.prompt ? (
                          <div className="mt-1.5 flex flex-col gap-1 border-t border-border/60 pt-1.5">
                            <p className={cn("whitespace-pre-wrap text-[10.5px] leading-snug text-fg", !open.has(c.id) && "line-clamp-2")}>{c.prompt}</p>
                            <div className="flex items-center gap-1.5">
                              {c.applied ? (
                                <Badge size="sm" variant="up"><Check className="size-3" /> taken</Badge>
                              ) : (
                                <Button size="xs" variant="subtle" sound="confirm" onClick={(e) => { e.stopPropagation(); applyRevision(c.id); }}>
                                  <ArrowRight /> Take it
                                </Button>
                              )}
                            </div>
                          </div>
                        ) : null
                      }
                    />
                  )) : (
                    <span className="self-center text-[10px] text-fg-faint">{lane.current ? "nothing found" : ""}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {lane.finals.map((f) => (
                    <Bubble
                      key={f.id}
                      id={f.id}
                      tone="border-up/50 bg-up/10"
                      title="now"
                      meta={new Date(f.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      text={f.text}
                      open={open.has(f.id)}
                      onToggle={() => toggle(f.id)}
                    />
                  ))}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Head({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip content={hint}>
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-fg-faint">
        {label}
      </div>
    </Tooltip>
  );
}

function Bubble({
  id, tone, title, meta, text, faint, open, onToggle, footer, className,
}: {
  id: string; tone: string; title: string; meta?: string; text: string; faint?: boolean; open: boolean; onToggle: () => void; footer?: React.ReactNode; className?: string;
}) {
  return (
    <div
      data-bubble={id}
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      className={cn("tactile w-full cursor-pointer rounded-xl border px-2.5 py-2 text-left shadow-[0_1px_0_var(--border)] outline-none transition-colors hover:border-border-strong focus-visible:border-accent", tone, className)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] font-semibold text-fg">{title}</span>
        {meta ? <span className="shrink-0 text-[9.5px] text-fg-faint">{meta}</span> : null}
      </div>
      <p className={cn("mt-0.5 whitespace-pre-wrap text-[10.5px] leading-snug", faint ? "italic text-fg-faint" : "text-fg-muted", !open && "line-clamp-3")}>{text}</p>
      {footer}
    </div>
  );
}
