"use client";
/**
 * The threads, as a growing thing.
 *
 * Every prompt that reached Claude and landed is a thread, and threads hang
 * off one another, so the history of a site is a tree rather than a list.
 * This draws that tree: a card for each thread — collapsed, one line saying
 * what was asked and what it put on the board; opened, the prompt, the
 * answer and what changed — and the cords between them drawn as vines.
 *
 * The vines are the point of the drawing and they are not a diagram. Three
 * strands per cord, braided round each other, each one a sine wave with its
 * own phase running along the path; the whole tree breathes on a slow clock
 * and a brighter pulse climbs the line the board is standing on. They are
 * painted on a canvas under the cards rather than as an SVG, because a
 * static picture of a history is the thing this replaces: what is alive
 * should look alive, and what has been cut should stop moving.
 *
 * Everything about the drawing is measured off the real cards after layout,
 * so opening a thread makes the vine to it grow rather than the picture
 * disagreeing with the page.
 */
import * as React from "react";
import { ChevronRight, Circle, GitBranch, GripVertical, MapPin, Scissors } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Badge } from "@/core/ui/badge";
import { Tooltip } from "@/core/ui/tooltip";
import { useStudio } from "./store";
import { diffDocs, flatten, threadTitle, threadTree, type Thread, type ThreadNode } from "./threads";
import { PromptTrail } from "./PromptTrail";

/** The green a live thread glows. Dark ground, one colour, nothing else. */
const VINE = { core: "oklch(0.92 0.2 145)", body: "oklch(0.72 0.22 148)", dim: "oklch(0.42 0.1 150)", dead: "oklch(0.3 0.02 150)" };

const CARD_W = 320;
/**
 * How far right a generation steps, and how far down each thread does. The
 * step is wider than a card on purpose: the vine between two threads has to
 * be seen, and at a step narrower than the card it runs behind the next one.
 */
const COL_STEP = 384;
const ROW_STEP = 132;
const PAD = 16;

interface Spot { x: number; y: number }

/**
 * Where the threads sit before anyone moves them: a trail that reads left to
 * right and staircases down. Every thread is one step lower than the one
 * before it, and a child is one step further right than its parent, so the
 * line of descent runs down and across the page the way a trail does — and a
 * fork simply carries on down, at its own depth.
 */
function staircase(roots: ThreadNode[]): Map<string, Spot> {
  const spots = new Map<string, Spot>();
  let row = 0;
  const walk = (n: ThreadNode) => {
    spots.set(n.thread.id, { x: PAD + n.depth * COL_STEP, y: PAD + row * ROW_STEP });
    row++;
    for (const c of n.children) walk(c);
  };
  for (const r of roots) walk(r);
  return spots;
}

export function ThreadTree() {
  const threads = useStudio((s) => s.threads);
  const liveThreadId = useStudio((s) => s.liveThreadId);
  const trail = useStudio((s) => s.trail);
  const spotsSaved = useStudio((s) => s.threadSpots);
  const prune = useStudio((s) => s.pruneThread);
  const standOn = useStudio((s) => s.standOn);
  const moveThread = useStudio((s) => s.moveThread);
  const resetSpots = useStudio((s) => s.resetThreadSpots);

  const [open, setOpen] = React.useState<Set<string>>(() => new Set());
  const box = React.useRef<HTMLDivElement>(null);
  const grid = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const [size, setSize] = React.useState({ w: 900, h: 400 });

  const roots = React.useMemo(() => threadTree(threads), [threads]);
  const all = React.useMemo(() => flatten(roots), [roots]);
  const byId = React.useMemo(() => new Map(threads.map((t) => [t.id, t])), [threads]);
  const loose = trail.filter((e) => !e.threadId && e.stage === "critique");

  // Where each thread is: the staircase, unless it has been dragged. A thread
  // that has been moved stays where it was put and nothing else shifts —
  // moving one is not a re-layout.
  const stairs = React.useMemo(() => staircase(roots), [roots]);
  const [dragging, setDragging] = React.useState<{ id: string; at: Spot } | null>(null);
  const spotOf = React.useCallback(
    (id: string): Spot => (dragging?.id === id ? dragging.at : spotsSaved[id] ?? stairs.get(id) ?? { x: PAD, y: PAD }),
    [dragging, spotsSaved, stairs],
  );
  const moved = Object.keys(spotsSaved).length;

  /** The line from a root down to the thread the board is standing on. */
  const liveLine = React.useMemo(() => {
    const on = new Set<string>();
    let at = liveThreadId;
    while (at) {
      on.add(at);
      at = byId.get(at)?.parentId ?? null;
    }
    return on;
  }, [liveThreadId, byId]);

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      play("select");
      return n;
    });

  /** Dragging one card. The rest of the trail does not move. */
  const startDrag = (id: string, e: React.PointerEvent) => {
    const plot = grid.current;
    if (!plot || e.button !== 0) return;
    const origin = plot.getBoundingClientRect();
    const from = spotOf(id);
    const grab = { x: e.clientX - origin.left - from.x, y: e.clientY - origin.top - from.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const r = plot.getBoundingClientRect();
      setDragging({ id, at: { x: Math.max(0, ev.clientX - r.left - grab.x), y: Math.max(0, ev.clientY - r.top - grab.y) } });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const r = plot.getBoundingClientRect();
      moveThread(id, Math.max(0, ev.clientX - r.left - grab.x), Math.max(0, ev.clientY - r.top - grab.y));
      setDragging(null);
      play("tap");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ------------------------------------------------------- the vines */
  // Where each card actually is, read off the page after every change of
  // shape. Measured against the grid of cards, never against the scroller:
  // the canvas lives inside the scroller, so sizing it from `scrollHeight`
  // makes it push out the very number it was measured from.
  const anchors = React.useRef(new Map<string, { left: number; right: number; top: number; bottom: number; mid: number }>());
  const measure = React.useCallback(() => {
    const plot = grid.current;
    if (!plot) return;
    const origin = plot.getBoundingClientRect();
    const next = new Map<string, { left: number; right: number; top: number; bottom: number; mid: number }>();
    let w = 0;
    let h = 0;
    for (const el of plot.querySelectorAll<HTMLElement>("[data-thread]")) {
      const r = el.getBoundingClientRect();
      const a = {
        left: r.left - origin.left,
        right: r.right - origin.left,
        top: r.top - origin.top,
        bottom: r.bottom - origin.top,
        mid: r.top - origin.top + Math.min(r.height / 2, 34),
      };
      next.set(el.dataset.thread!, a);
      w = Math.max(w, a.right);
      h = Math.max(h, a.bottom);
    }
    anchors.current = next;
    const width = Math.max(360, Math.round(w + PAD));
    const height = Math.max(220, Math.round(h + PAD));
    setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
  }, []);

  React.useLayoutEffect(measure, [measure, threads, open, spotsSaved, dragging]);
  React.useEffect(() => {
    const plot = grid.current;
    if (!plot) return;
    const ro = new ResizeObserver(measure);
    ro.observe(plot);
    for (const el of plot.querySelectorAll("[data-thread]")) ro.observe(el);
    return () => ro.disconnect();
  }, [measure, threads, open]);

  React.useEffect(() => {
    const el = canvas.current;
    const c = el?.getContext("2d");
    if (!el || !c) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let raf = 0;
    let last = 0;
    const born = performance.now();

    const paint = (now: number) => {
      raf = requestAnimationFrame(paint);
      // Vines are slow; thirty frames a second is plenty and leaves the
      // dialog's own scrolling alone.
      if (now - last < 33) return;
      last = now;
      const t = (now - born) / 1000;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (el.width !== size.w * dpr || el.height !== size.h * dpr) {
        el.width = Math.max(1, size.w * dpr);
        el.height = Math.max(1, size.h * dpr);
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, size.w, size.h);
      for (const n of all) {
        const child = anchors.current.get(n.thread.id);
        if (!child) continue;
        const parent = n.thread.parentId ? anchors.current.get(n.thread.parentId) : null;
        // The trail runs left to right: out of the parent's right side, into
        // the child's left. A child dragged back behind its parent is joined
        // the other way round rather than through the card.
        const backwards = parent ? child.left < parent.left : false;
        const from = parent
          ? { x: backwards ? parent.left : parent.right, y: parent.mid }
          : { x: Math.max(0, child.left - 22), y: child.mid };
        const to = { x: backwards ? child.right : child.left, y: child.mid };
        vine(c, from, to, still ? 0 : t, liveLine.has(n.thread.id), n.depth);
      }
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [all, liveLine, size.w, size.h]);

  if (!threads.length) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-elevated p-6 text-center">
          <GitBranch className="mx-auto mb-2 size-5 text-fg-faint" />
          <p className="text-sm text-fg">No threads yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-fg-muted">
            Every prompt that reaches Claude and comes back lands as a thread: what was asked, what came back, and what
            it put on the board. Threads hang off one another, so this becomes the tree of how the site was reasoned
            about. Ask for a plan or a critique, or make a drawing real, and the first one appears here.
          </p>
        </div>
        {loose.length ? <PromptTrail /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        ref={box}
        data-thread-tree=""
        className="relative overflow-auto rounded-lg border border-border bg-[oklch(0.13_0.012_150)]"
        style={{ minHeight: 280, maxHeight: "62vh" }}
      >
        <div ref={grid} className="relative" style={{ width: size.w, height: size.h }}>
          {/* The vines are drawn under the cards, in the trail's own frame. */}
          <canvas
            ref={canvas}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0"
            style={{ width: size.w, height: size.h }}
          />
          {all.map((n) => {
            const at = spotOf(n.thread.id);
            return (
              <ThreadCard
                key={n.thread.id}
                node={n}
                parent={n.thread.parentId ? byId.get(n.thread.parentId) ?? null : null}
                live={n.thread.id === liveThreadId}
                onLine={liveLine.has(n.thread.id)}
                open={open.has(n.thread.id)}
                dragging={dragging?.id === n.thread.id}
                onToggle={() => toggle(n.thread.id)}
                onPrune={() => { play("close"); prune(n.thread.id); }}
                onStand={() => { play("confirm"); standOn(n.thread.id); }}
                onDragStart={(e) => startDrag(n.thread.id, e)}
                style={{ position: "absolute", left: at.x, top: at.y, width: CARD_W }}
              />
            );
          })}
        </div>
      </div>
      <p className="flex items-center justify-between text-[10px] text-fg-faint">
        <span>Drag a thread to move it. Only that one moves.</span>
        {moved ? (
          <Button variant="ghost" size="xs" onClick={() => { play("close"); resetSpots(); }}>
            Put the trail back on its staircase
          </Button>
        ) : null}
      </p>
      {loose.length ? (
        <details className="rounded-lg border border-border bg-elevated p-3">
          <summary className="cursor-pointer text-xs text-fg-muted">
            {loose.length} finding{loose.length === 1 ? "" : "s"} from before threads were kept
          </summary>
          <div className="pt-3">
            <PromptTrail />
          </div>
        </details>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One thread                                                          */
/* ------------------------------------------------------------------ */

function ThreadCard({
  node, parent, live, onLine, open, dragging, onToggle, onPrune, onStand, onDragStart, style,
}: {
  node: ThreadNode;
  parent: Thread | null;
  live: boolean;
  onLine: boolean;
  open: boolean;
  dragging: boolean;
  onToggle: () => void;
  onPrune: () => void;
  onStand: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  style?: React.CSSProperties;
}) {
  const t = node.thread;
  const trail = useStudio((s) => s.trail);
  const applyRevision = useStudio((s) => s.applyRevision);
  const findings = trail.filter((e) => e.threadId === t.id && e.stage === "critique");
  const changed = React.useMemo(() => diffDocs(parent?.doc, t.doc), [parent, t]);

  return (
    <div
      data-thread={t.id}
      style={style}
      className={cn(
        "z-10 rounded-lg border p-3 transition-colors",
        dragging && "z-20 cursor-grabbing shadow-[0_10px_30px_oklch(0_0_0/0.5)]",
        live
          ? "border-[oklch(0.72_0.22_148)] bg-[oklch(0.17_0.03_150)] shadow-[0_0_22px_oklch(0.72_0.22_148/0.18)]"
          : onLine
            ? "border-[oklch(0.42_0.1_150)] bg-[oklch(0.15_0.02_150)]"
            : "border-border bg-elevated",
      )}
    >
      <div className="flex items-start gap-2">
        {/* The grip: the one place a drag starts, so opening and pruning still work. */}
        <button
          type="button"
          onPointerDown={onDragStart}
          aria-label="Move this thread"
          title="Drag to move this thread. Nothing else moves."
          className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-fg-faint hover:text-fg active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="mt-0.5 shrink-0 rounded p-0.5 text-fg-muted transition-transform hover:text-fg"
          style={{ transform: open ? "rotate(90deg)" : "none" }}
          aria-label={open ? "Close this thread" : "Open this thread"}
        >
          <ChevronRight className="size-3.5" />
        </button>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <p className="text-[12px] leading-snug text-fg">{threadTitle(t)}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-fg-faint">
            <Badge size="sm" variant="outline">{t.mode}</Badge>
            <span className="num">{new Date(t.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {t.model ? <span className="truncate">{t.model}</span> : null}
            {live ? <span className="text-[oklch(0.8_0.2_148)]">live</span> : null}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {!live && t.doc ? (
            <Tooltip content="Put the board back on this thread">
              <Button variant="ghost" size="xs" onClick={onStand} aria-label="Stand on this thread">
                <MapPin className="size-3" />
              </Button>
            </Tooltip>
          ) : null}
          <Tooltip content="Cut this thread. Its children re-hang from its parent; the board goes to whatever is live after.">
            <Button variant="ghost" size="xs" onClick={onPrune} aria-label="Prune this thread">
              <Scissors className="size-3" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {open ? (
        <div className="mt-3 max-h-[320px] space-y-3 overflow-auto border-t border-border pt-3">
          <Section label="Asked">
            <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-fg-muted">{t.ask || "—"}</p>
          </Section>
          <Section label="Answer">
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-panel p-2 font-mono text-[10px] leading-relaxed text-fg-muted">
              {t.answer || "—"}
            </pre>
          </Section>
          <Section label={`What changed${changed.length ? ` (${changed.length})` : ""}`}>
            {changed.length ? (
              <ul className="space-y-0.5">
                {changed.map((line, i) => (
                  <li key={i} className="font-mono text-[10px] text-fg-muted">{line}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] text-fg-faint">Nothing on the board changed with this thread.</p>
            )}
          </Section>
          {findings.length ? (
            <Section label={`Findings (${findings.length})`}>
              <ul className="space-y-1.5">
                {findings.map((f) => (
                  <li key={f.id} className="rounded border border-border bg-panel p-2">
                    <p className="text-[11px] text-fg">{f.target.label}: {f.text}</p>
                    {f.prompt ? (
                      <div className="mt-1 flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-[10px] italic text-fg-muted">{f.prompt}</p>
                        <Button variant="outline" size="xs" disabled={f.applied} onClick={() => applyRevision(f.id)}>
                          {f.applied ? "Taken" : "Take it"}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] text-fg-faint">
        <Circle className="size-1.5 fill-current" /> {label}
      </p>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The drawing                                                         */
/* ------------------------------------------------------------------ */

/**
 * One cord, braided: three strands round a common path, each swinging on its
 * own phase, and on a live cord a brighter node climbing it. The strands are
 * sampled rather than curved by the canvas, because the twist has to be a
 * function of how far along the strand is, which a bezier cannot say.
 */
function vine(
  c: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
  alive: boolean,
  depth: number,
) {
  const steps = 56;
  const span = Math.hypot(to.x - from.x, to.y - from.y);
  const amp = Math.max(3, Math.min(14, span * 0.09));
  const seed = (from.x * 0.013 + to.y * 0.007 + depth * 1.7) % (Math.PI * 2);

  // The trail runs left to right and steps down, so the spine leaves the
  // parent sideways and enters the child sideways: the cord makes the tread
  // and the riser of the stair rather than cutting the corner between them.
  const bend = Math.max(30, Math.abs(to.x - from.x) * 0.55, Math.abs(to.y - from.y) * 0.3);
  const dir = to.x >= from.x ? 1 : -1;
  const at = (u: number) => {
    const v = 1 - u;
    return {
      x: v * v * v * from.x + 3 * v * v * u * (from.x + bend * dir) + 3 * v * u * u * (to.x - bend * dir) + u * u * u * to.x,
      y: v * v * v * from.y + 3 * v * v * u * from.y + 3 * v * u * u * to.y + u * u * u * to.y,
    };
  };
  /** A point on a strand: the spine, pushed sideways by its own winding. */
  const on = (u: number, phase: number, wind: number) => {
    const p = at(u);
    const q = at(Math.min(1, u + 0.02));
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    // Tight where it grips the cards, widest in the middle: a braid, not a ladder.
    const grip = Math.sin(u * Math.PI) ** 0.7;
    const swing = Math.sin(u * wind + phase + t * (alive ? 0.9 : 0.2)) * amp * grip;
    return { x: p.x + (-dy / len) * swing, y: p.y + (dx / len) * swing, nx: -dy / len, ny: dx / len };
  };

  const strands = [
    { phase: 0, wind: 6.5, w: 2, tone: alive ? VINE.core : VINE.dead, a: alive ? 0.95 : 0.5, glow: 12 },
    { phase: 2.1, wind: 6.5, w: 1.4, tone: alive ? VINE.body : VINE.dead, a: alive ? 0.7 : 0.4, glow: 7 },
    { phase: 4.2, wind: 6.5, w: 1.1, tone: alive ? VINE.body : VINE.dead, a: alive ? 0.5 : 0.3, glow: 5 },
    { phase: 1.1, wind: 10.5, w: 0.8, tone: alive ? VINE.dim : VINE.dead, a: alive ? 0.45 : 0.25, glow: 3 },
  ];
  for (const st of strands) {
    c.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const p = on(u, seed + st.phase, st.wind);
      if (i === 0) c.moveTo(p.x, p.y);
      else c.lineTo(p.x, p.y);
    }
    c.strokeStyle = st.tone;
    c.lineWidth = st.w;
    c.globalAlpha = st.a;
    c.lineCap = "round";
    if (alive) {
      c.shadowColor = VINE.body;
      c.shadowBlur = st.glow;
    } else {
      c.shadowBlur = 0;
    }
    c.stroke();
    c.shadowBlur = 0;
    c.globalAlpha = 1;
  }

  // Tendrils: short curls off the braid, so it reads as grown rather than routed.
  const curls = Math.max(1, Math.round(span / 90));
  for (let k = 0; k < curls; k++) {
    const u = 0.22 + (k + 0.5) / (curls + 0.6) * 0.6;
    const p = on(u, seed, 6.5);
    const side = k % 2 ? 1 : -1;
    const reach = (7 + Math.sin(t * 0.6 + k + seed) * 3) * side;
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.quadraticCurveTo(p.x + p.nx * reach, p.y + p.ny * reach - 5, p.x + p.nx * reach * 1.4, p.y + p.ny * reach * 1.4 + 4);
    c.strokeStyle = alive ? VINE.dim : VINE.dead;
    c.globalAlpha = alive ? 0.6 : 0.25;
    c.lineWidth = 1;
    c.stroke();
    c.globalAlpha = 1;
  }

  // Where it grips: a knot at each end, so the cord meets the card rather than stopping near it.
  for (const p of [at(0), at(1)]) {
    c.beginPath();
    c.arc(p.x, p.y, alive ? 2.6 : 2, 0, Math.PI * 2);
    c.fillStyle = alive ? VINE.core : VINE.dead;
    c.globalAlpha = alive ? 0.9 : 0.5;
    c.fill();
    c.globalAlpha = 1;
  }

  // What is alive has something climbing it.
  if (alive) {
    const u = (t * 0.2 + seed * 0.1) % 1;
    const p = on(u, seed, 6.5);
    const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 11);
    g.addColorStop(0, "oklch(0.96 0.2 145 / 0.85)");
    g.addColorStop(1, "oklch(0.96 0.2 145 / 0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(p.x, p.y, 11, 0, Math.PI * 2);
    c.fill();
  }
}
