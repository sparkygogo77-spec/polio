"use client";
/**
 * The trail: the threads, the pieces that feed them, and the vines between.
 *
 * The timeline is a staircase running from the upper left down to the
 * right, one step per thread in the order they landed, and the threads hang
 * off it. Every element on the board that carries a prompt floats near the
 * thread that last touched it as a *piece*; a piece vined to the next call
 * is what that call will actually send.
 *
 * Two colours, and they mean two different things. **Green** is landed: a
 * thread that came back, the spine between them, and the pieces those
 * threads worked on. **Purple** is pending: the pieces vined to the call
 * that has not fired yet. So the drawing says, before anything is sent,
 * exactly what is about to go up.
 *
 * The vines are not a diagram. Four strands per cord braided round a spine,
 * each on its own phase, tendrils curling off them, a knot where a cord
 * grips a card, and a light climbing the line the board is standing on.
 * They are painted on a canvas under the cards, because a history drawn as
 * a static picture is the thing this replaces: what is alive should look
 * alive, and what has been cut should stop moving.
 *
 * Everything is measured off the real cards after layout, so opening a
 * thread or dragging one makes the vines follow rather than the picture
 * disagreeing with the page. Dragging moves one thing: no re-layout.
 */
import * as React from "react";
import { Check, ChevronRight, Circle, Copy, GitBranch, GripVertical, MapPin, Pin, PinOff, Scissors, Sparkles } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Badge } from "@/core/ui/badge";
import { Tooltip } from "@/core/ui/tooltip";
import { useActions } from "@/core/actions";
import { screenFace, SCREEN } from "@/core/ui/void";
import { toRows } from "./spec";
import { useStudio } from "./store";
import { diffDocs, flatten, pieceOwners, piecesFrom, threadTitle, threadTree, type Piece, type Thread, type ThreadNode } from "./threads";
import { PromptTrail } from "./PromptTrail";

/** Landed: the green a thread and its spine are drawn in. */
const VINE = { core: "oklch(0.92 0.2 145)", body: "oklch(0.72 0.22 148)", dim: "oklch(0.42 0.1 150)", dead: "oklch(0.3 0.02 150)" };
/** Pending: the purple a piece is drawn in while it is only vined to the next call. */
const PENDING = { core: "oklch(0.88 0.2 305)", body: "oklch(0.7 0.25 300)", dim: "oklch(0.5 0.16 300)", dead: "oklch(0.32 0.06 300)" };

const CARD_W = 320;
/**
 * How far right a generation steps, and how far down each thread does. The
 * step is wider than a card on purpose: the vine between two threads has to
 * be seen, and at a step narrower than the card it runs behind the next one.
 */
const COL_STEP = 384;
const ROW_STEP = 136;
const PAD = 16;
/**
 * Empty space above the first step.
 *
 * An open thread puts its prompt above the card and its answer below it, and
 * the first step is otherwise sixteen pixels from the top with nowhere for
 * the prompt to go. This is that room, kept whether or not anything is open,
 * so opening one never moves the trail underneath it.
 */
const HEAD = 236;
/** How far off its step on the timeline a thread hangs. */
const HANG = { x: 34, y: 18 };

interface Spot { x: number; y: number }

/**
 * Where the threads sit before anyone moves them: a trail that reads left to
 * right and staircases down. Every thread is one step lower than the one
 * before it, and a child is one step further right than its parent, so the
 * line of descent runs down and across the page the way a trail does — and a
 * fork simply carries on down, at its own depth.
 */
function staircase(roots: ThreadNode[], head: number): Map<string, Spot> {
  const spots = new Map<string, Spot>();
  let row = 0;
  const walk = (n: ThreadNode) => {
    spots.set(n.thread.id, { x: PAD + n.depth * COL_STEP, y: head + row * ROW_STEP });
    row++;
    for (const c of n.children) walk(c);
  };
  for (const r of roots) walk(r);
  return spots;
}

/** Deterministic, so a piece does not jump about between renders. */
function seedOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

/** A chip's own size, for laying them out without stacking them on each other. */
const CHIP = { w: 176, h: 27 };

/**
 * Where a piece floats.
 *
 * A piece a thread has worked on sits just left of that thread's step, in a
 * short column, so you can see at a glance what that thread was about. A
 * piece no thread has touched yet joins the shelf under the trail — the
 * pool the next call is composed from — laid out in rows rather than on an
 * arc, because a pool of two dozen prompts on an arc is a pile.
 */
function ownedSpot(at: Spot, index: number): Spot {
  const column = Math.floor(index / 4);
  const row = index % 4;
  // Left of the step where there is room for them, and out past the card
  // where there is not — the first step has nothing to its left.
  const left = at.x - 20 - (column + 1) * (CHIP.w + 8);
  const x = left > 6 ? left : at.x + CARD_W + HANG.x + 24 + column * (CHIP.w + 8);
  return { x, y: Math.max(2, at.y - 10 + row * CHIP.h) };
}

function shelfSpot(top: number, index: number, perRow: number): Spot {
  return { x: PAD + (index % perRow) * (CHIP.w + 10), y: top + Math.floor(index / perRow) * CHIP.h };
}

/** Everything on the board that carries a prompt, in reading order. */
export function usePieces(): Piece[] {
  const brief = useStudio((s) => s.brief);
  const pages = useStudio((s) => s.pages);
  const groups = useStudio((s) => s.groups);
  const nodes = useStudio((s) => s.nodes);
  return React.useMemo(() => {
    // Reading order, page by page, so a piece's neighbours are the parts
    // that actually sit either side of it.
    const ordered = pages.flatMap((page) => toRows(nodes.filter((n) => n.pageId === page.id)).flat());
    return piecesFrom({ brief, pages, groups, nodes: ordered });
  }, [brief, pages, groups, nodes]);
}

export function ThreadTree() {
  const threads = useStudio((s) => s.threads);
  const liveThreadId = useStudio((s) => s.liveThreadId);
  const trail = useStudio((s) => s.trail);
  const spotsSaved = useStudio((s) => s.threadSpots);
  const draftPieces = useStudio((s) => s.draftPieces);
  const sentPieces = useStudio((s) => s.sentPieces);
  const prune = useStudio((s) => s.pruneThread);
  const standOn = useStudio((s) => s.standOn);
  const moveThread = useStudio((s) => s.moveThread);
  const resetSpots = useStudio((s) => s.resetThreadSpots);
  const toggleDraft = useStudio((s) => s.toggleDraftPiece);
  const clearDraft = useStudio((s) => s.clearDraft);
  const pieces = usePieces();

  const [open, setOpen] = React.useState<Set<string>>(() => new Set());
  const box = React.useRef<HTMLDivElement>(null);
  const grid = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const [size, setSize] = React.useState({ w: 900, h: 400 });

  const roots = React.useMemo(() => threadTree(threads), [threads]);
  const all = React.useMemo(() => flatten(roots), [roots]);
  const byId = React.useMemo(() => new Map(threads.map((t) => [t.id, t])), [threads]);
  const loose = trail.filter((e) => !e.threadId && e.stage === "critique");

  /* The timeline: one step per thread, in the order they landed, and the
   * draft on the step after the last of them. */
  /*
   * The room above the first step, kept only while a thread is open. Closed,
   * an empty band at the top of the trail is nothing but a hole in the map;
   * open, the prompt has to have somewhere to go. Threads that have been
   * dragged keep their own spot, so nothing a person placed ever moves.
   */
  const head = (open.size ? HEAD : 0) + PAD;
  const stairs = React.useMemo(() => staircase(roots, head), [roots, head]);
  const draftStair = React.useMemo(() => {
    let last: Spot | null = null;
    let depth = 0;
    for (const n of all) {
      const at = stairs.get(n.thread.id);
      if (at && (!last || at.y > last.y)) { last = at; depth = n.depth; }
    }
    return last ? { x: PAD + Math.min(depth + 1, 4) * COL_STEP, y: last.y + ROW_STEP } : { x: PAD, y: head };
  }, [all, stairs, head]);

  /** The shelf: under the last step, as wide as the trail is deep. */
  const perRow = 6;
  const shelfTop = draftStair.y + 118;
  const [dragging, setDragging] = React.useState<{ id: string; at: Spot } | null>(null);
  /**
   * How far the trail is scaled to fit its box. A trail outgrows any dialog
   * after a few threads, and a picture you have to scroll in two directions
   * to read is not a picture of anything; fitted is the default, and 1:1 is
   * one press away when a prompt has to be read.
   */
  const [fit, setFit] = React.useState(true);
  const [zoom, setZoom] = React.useState(1);
  const hung = React.useCallback((at: Spot): Spot => ({ x: at.x + HANG.x, y: at.y + HANG.y }), []);
  const spotOf = React.useCallback(
    (key: string, fallback: Spot): Spot => (dragging?.id === key ? dragging.at : spotsSaved[key] ?? fallback),
    [dragging, spotsSaved],
  );
  const moved = Object.keys(spotsSaved).length;

  /** Which thread each piece belongs beside; the rest gather at the draft. */
  const owners = React.useMemo(() => pieceOwners(pieces, threads), [pieces, threads]);
  const grouped = React.useMemo(() => {
    const by = new Map<string, Piece[]>();
    for (const piece of pieces) {
      const key = owners.get(piece.id) ?? "draft";
      const list = by.get(key) ?? [];
      list.push(piece);
      by.set(key, list);
    }
    return by;
  }, [pieces, owners]);

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

  /** Dragging one card or one piece. Nothing else on the trail moves. */
  const startDrag = (key: string, from: Spot, e: React.PointerEvent) => {
    const plot = grid.current;
    if (!plot || e.button !== 0) return;
    const origin = plot.getBoundingClientRect();
    const grab = { x: (e.clientX - origin.left) / zoom - from.x, y: (e.clientY - origin.top) / zoom - from.y };
    e.preventDefault();
    const to = (ev: PointerEvent): Spot => {
      const r = plot.getBoundingClientRect();
      // The plot may be scaled to fit, and the pointer is not.
      return { x: Math.max(0, (ev.clientX - r.left) / zoom - grab.x), y: Math.max(0, (ev.clientY - r.top) / zoom - grab.y) };
    };
    const move = (ev: PointerEvent) => setDragging({ id: key, at: to(ev) });
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const at = to(ev);
      moveThread(key, at.x, at.y);
      setDragging(null);
      play("tap");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ------------------------------------------------------- the vines */
  /*
   * Where everything actually is, read off the page after each change of
   * shape. Measured against the plot, never against the scroller: the
   * canvas lives inside the scroller, so sizing it from `scrollHeight`
   * makes it push out the very number it was measured from.
   */
  const anchors = React.useRef(new Map<string, { left: number; right: number; top: number; bottom: number; mid: number }>());
  const measure = React.useCallback(() => {
    const plot = grid.current;
    if (!plot) return;
    const origin = plot.getBoundingClientRect();
    const next = new Map<string, { left: number; right: number; top: number; bottom: number; mid: number }>();
    let w = 0;
    let h = 0;
    // Screen pixels come back scaled; the drawing is done in the trail's own.
    const z = plot.getBoundingClientRect().width / Math.max(1, plot.offsetWidth) || 1;
    for (const el of plot.querySelectorAll<HTMLElement>("[data-trail-item]")) {
      const r = el.getBoundingClientRect();
      const a = {
        left: (r.left - origin.left) / z,
        right: (r.right - origin.left) / z,
        top: (r.top - origin.top) / z,
        bottom: (r.bottom - origin.top) / z,
        mid: (r.top - origin.top) / z + Math.min(r.height / z / 2, 34),
      };
      next.set(el.dataset.trailItem!, a);
      w = Math.max(w, a.right);
      h = Math.max(h, a.bottom);
    }
    // What is open hangs off a card without being part of it, so it is not
    // an anchor for a vine but the plot still has to be tall enough for it.
    for (const el of plot.querySelectorAll<HTMLElement>("[data-trail-extent]")) {
      const r = el.getBoundingClientRect();
      w = Math.max(w, (r.right - origin.left) / z);
      h = Math.max(h, (r.bottom - origin.top) / z);
    }
    anchors.current = next;
    const width = Math.max(420, Math.round(w + PAD * 2));
    const height = Math.max(260, Math.round(h + PAD * 2));
    setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
    const room = box.current?.clientWidth ?? width;
    setZoom(fit ? Math.max(0.42, Math.min(1, (room - 8) / width)) : 1);
  }, [fit]);

  React.useLayoutEffect(measure, [measure, threads, pieces, draftPieces, open, spotsSaved, dragging]);
  React.useEffect(() => {
    const plot = grid.current;
    if (!plot) return;
    const ro = new ResizeObserver(measure);
    ro.observe(plot);
    for (const el of plot.querySelectorAll("[data-trail-item]")) ro.observe(el);
    return () => ro.disconnect();
  }, [measure, threads, pieces, open]);

  // What the canvas draws, rebuilt whenever the shape of the trail changes.
  const cords = React.useMemo(() => {
    const out: { from: string; to: string; tone: "live" | "landed" | "pending"; depth: number; side: boolean }[] = [];
    // The timeline itself: step to step, in the order they landed.
    const steps = all.map((n) => n.thread.id);
    for (let i = 1; i < steps.length; i++) out.push({ from: `step:${steps[i - 1]}`, to: `step:${steps[i]}`, tone: "landed", depth: 0, side: false });
    if (steps.length) out.push({ from: `step:${steps[steps.length - 1]}`, to: "step:draft", tone: "pending", depth: 0, side: false });
    // Each thread hangs off its step.
    for (const n of all) out.push({ from: `step:${n.thread.id}`, to: `thread:${n.thread.id}`, tone: liveLine.has(n.thread.id) ? "live" : "landed", depth: n.depth, side: true });
    out.push({ from: "step:draft", to: "thread:draft", tone: "pending", depth: 0, side: true });
    // And every piece feeds the thread it belongs to, or the draft it is vined to.
    for (const piece of pieces) {
      const owner = owners.get(piece.id);
      const vined = draftPieces.includes(piece.id);
      if (vined) out.push({ from: `piece:${piece.id}`, to: "thread:draft", tone: "pending", depth: 2, side: true });
      else if (owner) out.push({ from: `piece:${piece.id}`, to: `thread:${owner}`, tone: "landed", depth: 2, side: true });
    }
    return out;
  }, [all, pieces, owners, draftPieces, liveLine]);

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
      for (const cord of cords) {
        const a = anchors.current.get(cord.from);
        const b = anchors.current.get(cord.to);
        if (!a || !b) continue;
        // Left to right along the trail: out of one side, into the other.
        const backwards = b.left < a.left;
        const from = { x: backwards ? a.left : a.right, y: a.mid };
        const to = { x: backwards ? b.right : b.left, y: b.mid };
        vine(c, from, to, still ? 0 : t, cord.tone, cord.depth);
      }
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [cords, size.w, size.h]);

  // No threads yet is not an empty page: the pieces and the next call are
  // what a first ask is composed from, so the trail draws them and only
  // says its piece about what a thread is.
  const nothingYet = !threads.length;

  return (
    <div className="space-y-3">
      <div
        ref={box}
        data-thread-tree=""
        className="relative overflow-auto rounded-lg border border-border bg-[oklch(0.13_0.012_150)]"
        style={{ minHeight: 300, maxHeight: "64vh" }}
      >
        {/* The scaled plot still has to be scrollable to its own corners. */}
        <div aria-hidden style={{ width: size.w * zoom, height: size.h * zoom, position: "absolute", pointerEvents: "none" }} />
        <div
          ref={grid}
          className="relative"
          style={{ width: size.w, height: size.h, transform: `scale(${zoom})`, transformOrigin: "0 0" }}
        >
          {/* The vines are drawn under everything, in the trail's own frame. */}
          <canvas
            ref={canvas}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0"
            style={{ width: size.w, height: size.h }}
          />

          {/* The timeline: one step per thread, and the step the next call will take. */}
          {all.map((n) => {
            const at = stairs.get(n.thread.id) ?? { x: PAD, y: head };
            return <Step key={`step-${n.thread.id}`} id={`step:${n.thread.id}`} at={at} live={liveLine.has(n.thread.id)} />;
          })}
          <Step id="step:draft" at={draftStair} live={false} pending />

          {/* The threads, hanging off their step. */}
          {all.map((n) => {
            const at = spotOf(`thread:${n.thread.id}`, hung(stairs.get(n.thread.id) ?? { x: PAD, y: head }));
            return (
              <ThreadCard
                key={n.thread.id}
                node={n}
                parent={n.thread.parentId ? byId.get(n.thread.parentId) ?? null : null}
                live={n.thread.id === liveThreadId}
                onLine={liveLine.has(n.thread.id)}
                open={open.has(n.thread.id)}
                dragging={dragging?.id === `thread:${n.thread.id}`}
                onToggle={() => toggle(n.thread.id)}
                onPrune={() => { play("close"); prune(n.thread.id); }}
                onStand={() => { play("confirm"); standOn(n.thread.id); }}
                onDragStart={(e) => startDrag(`thread:${n.thread.id}`, at, e)}
                style={{ position: "absolute", left: at.x, top: at.y, width: CARD_W }}
              />
            );
          })}

          {/* The next call: what is vined to it is what it will send. */}
          <DraftCard
            at={spotOf("thread:draft", hung(draftStair))}
            pieces={pieces.filter((x) => draftPieces.includes(x.id))}
            sent={sentPieces}
            dragging={dragging?.id === "thread:draft"}
            onDragStart={(e) => startDrag("thread:draft", spotOf("thread:draft", hung(draftStair)), e)}
            onClear={() => { play("close"); clearDraft(); }}
          />

          {/* Every prompt on the board: by its thread, or on the shelf the next call draws from. */}
          {[...grouped.entries()].flatMap(([key, list]) =>
            list.map((piece, i) => {
              const home = stairs.get(key);
              const at = spotOf(`piece:${piece.id}`, home ? ownedSpot(home, i) : shelfSpot(shelfTop, i, perRow));
              return (
                <PieceChip
                  key={piece.id}
                  piece={piece}
                  at={at}
                  vined={draftPieces.includes(piece.id)}
                  landed={key !== "draft"}
                  fresh={sentPieces[piece.id] !== undefined && sentPieces[piece.id] !== piece.fingerprint}
                  dragging={dragging?.id === `piece:${piece.id}`}
                  onToggle={() => { play("select"); toggleDraft(piece.id); }}
                  onDragStart={(e) => startDrag(`piece:${piece.id}`, at, e)}
                />
              );
            }),
          )}
        </div>
      </div>
      {nothingYet ? (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-elevated p-3 text-[11px] text-fg-muted">
          <GitBranch className="mt-0.5 size-3.5 shrink-0 text-fg-faint" />
          <span>
            Nothing has landed yet. Every prompt that reaches Claude and comes back lands as a thread here — what was
            asked, what came back, and what it put on the board — and threads hang off one another, so this becomes the
            tree of how the site was reasoned about. Click the pieces this first question is about, then ask.
          </span>
        </p>
      ) : null}
      <p className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-fg-faint">
        <span>
          Drag a thread or a piece to move it — only that one moves. Click a piece to vine it to the next call:
          <span className="text-[oklch(0.7_0.25_300)]"> purple is about to be sent</span>,
          <span className="text-[oklch(0.72_0.22_148)]"> green has landed</span>.
        </span>
        <span className="flex items-center gap-2">
          <Button variant="ghost" size="xs" onClick={() => { play("select"); setFit((v) => !v); }}>
            {fit ? `Fit · ${Math.round(zoom * 100)}%` : "1:1"}
          </Button>
          {moved ? (
            <Button variant="ghost" size="xs" onClick={() => { play("close"); resetSpots(); }}>
              Put the trail back on its staircase
            </Button>
          ) : null}
        </span>
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
/* The timeline, the draft, and one piece                              */
/* ------------------------------------------------------------------ */

/** One step of the staircase: a small knot the thread hangs off. */
function Step({ id, at, live, pending }: { id: string; at: Spot; live: boolean; pending?: boolean }) {
  const tone = pending ? PENDING.body : live ? VINE.core : VINE.dim;
  return (
    <span
      data-trail-item={id}
      aria-hidden
      className="absolute rounded-full"
      style={{
        left: at.x, top: at.y, width: 11, height: 11,
        background: tone,
        boxShadow: `0 0 12px ${tone}`,
        opacity: pending ? 0.75 : live ? 1 : 0.55,
      }}
    />
  );
}

/** A prompt on the board, floating by the thread it belongs to. */
function PieceChip({
  piece, at, vined, landed, fresh, dragging, onToggle, onDragStart,
}: {
  piece: Piece;
  at: Spot;
  vined: boolean;
  landed: boolean;
  fresh: boolean;
  dragging: boolean;
  onToggle: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}) {
  const tone = vined ? PENDING : VINE;
  return (
    <Tooltip content={`${piece.prompt.slice(0, 200)}${piece.prompt.length > 200 ? "…" : ""}`}>
      <button
        type="button"
        data-trail-item={`piece:${piece.id}`}
        data-piece={piece.id}
        onClick={onToggle}
        onPointerDown={(e) => { if (e.shiftKey || e.button === 1) onDragStart(e); }}
        aria-pressed={vined}
        className={cn(
          "absolute z-10 flex max-w-[190px] items-center gap-1.5 rounded-full border px-2 py-1 text-left text-[10px] transition-colors",
          dragging && "z-30 cursor-grabbing",
        )}
        style={{
          left: at.x, top: at.y,
          borderColor: vined ? tone.body : landed ? "oklch(0.32 0.04 150)" : "oklch(0.3 0.01 260)",
          background: vined ? "oklch(0.19 0.06 300)" : "oklch(0.16 0.015 260)",
          color: vined ? "oklch(0.92 0.08 305)" : landed ? "oklch(0.78 0.04 150)" : "oklch(0.68 0.01 260)",
          boxShadow: vined ? `0 0 14px oklch(0.7 0.25 300 / 0.35)` : undefined,
        }}
        title="Click to vine this to the next call. Shift-drag to move it."
      >
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: vined ? PENDING.core : landed ? VINE.body : "oklch(0.5 0.01 260)" }} />
        <span className="truncate">{piece.label}</span>
        {fresh ? <span className="shrink-0 text-[9px] opacity-80">changed</span> : null}
      </button>
    </Tooltip>
  );
}

/** The call that has not fired: what is vined to it is what it will send. */
function DraftCard({
  at, pieces, sent, dragging, onDragStart, onClear,
}: {
  at: Spot;
  pieces: Piece[];
  sent: Record<string, string>;
  dragging: boolean;
  onDragStart: (e: React.PointerEvent) => void;
  onClear: () => void;
}) {
  const unchanged = pieces.filter((p) => sent[p.id] === p.fingerprint).length;
  return (
    <div
      data-trail-item="thread:draft"
      data-draft=""
      className={cn(
        "absolute z-10 rounded-lg border border-dashed p-3",
        dragging && "z-30 shadow-[0_10px_30px_oklch(0_0_0/0.5)]",
      )}
      style={{
        left: at.x, top: at.y, width: CARD_W,
        borderColor: pieces.length ? PENDING.body : "oklch(0.3 0.02 300)",
        background: pieces.length ? "oklch(0.16 0.04 300)" : "oklch(0.145 0.012 290)",
      }}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onPointerDown={onDragStart}
          aria-label="Move the next call"
          className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-fg-faint hover:text-fg active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[12px]" style={{ color: PENDING.core }}>
            <Sparkles className="size-3" /> The next call
          </p>
          <p className="mt-1 text-[10px] text-fg-muted">
            {pieces.length
              ? `${pieces.length} piece${pieces.length === 1 ? "" : "s"} vined${unchanged ? `, ${unchanged} unchanged and not resent` : ""}. The brief goes in front of them, from the cache.`
              : "Nothing vined. Click a piece to send it with the next ask; with none, the whole blueprint goes."}
          </p>
          {pieces.length ? (
            <ul className="mt-2 space-y-0.5">
              {pieces.slice(0, 6).map((p) => (
                <li key={p.id} className="truncate text-[10px]" style={{ color: sent[p.id] === p.fingerprint ? "oklch(0.55 0.03 300)" : "oklch(0.86 0.1 305)" }}>
                  {sent[p.id] === p.fingerprint ? "· " : "+ "}{p.label}
                </li>
              ))}
              {pieces.length > 6 ? <li className="text-[10px] text-fg-faint">and {pieces.length - 6} more</li> : null}
            </ul>
          ) : null}
        </div>
        {pieces.length ? (
          <Button variant="ghost" size="xs" onClick={onClear} aria-label="Unvine everything">Clear</Button>
        ) : null}
      </div>
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
  const pinned = useStudio((s) => s.pinnedThreads.includes(t.id));
  const togglePin = useStudio((s) => s.togglePinnedThread);
  const findings = trail.filter((e) => e.threadId === t.id && e.stage === "critique");
  const changed = React.useMemo(() => diffDocs(parent?.doc, t.doc), [parent, t]);

  return (
    <div
      data-thread={t.id}
      data-trail-item={`thread:${t.id}`}
      style={style}
      className={cn(
        "z-10 rounded-lg border p-2.5 shadow-pop transition-colors",
        dragging && "z-20 cursor-grabbing shadow-[0_10px_30px_oklch(0_0_0/0.5)]",
        open && "z-30",
        live
          ? "border-[oklch(0.72_0.22_148)] bg-[oklch(0.17_0.03_150)] shadow-[0_0_22px_oklch(0.72_0.22_148/0.18)]"
          : onLine
            ? "border-[oklch(0.42_0.1_150)] bg-[oklch(0.15_0.02_150)]"
            : "border-border bg-panel/95",
      )}
    >
      {/* The prompt grows upward out of the card, the answer downward: the
          ask is what came before this thread and the answer is what came
          after it, and reading down the column is reading it in order. */}
      {open ? (
        <Pane
          label="The prompt, as it was asked"
          text={t.ask || "—"}
          className="absolute bottom-full left-0 mb-2 w-full"
          bodyClassName="max-h-[196px]"
        />
      ) : null}

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
          <p className="text-[12px] font-semibold leading-snug text-fg">{threadTitle(t)}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-fg-faint">
            <Badge size="sm" variant="outline">{t.mode}</Badge>
            <span className="num">{new Date(t.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {t.model ? <span className="truncate">{t.model}</span> : null}
            {live ? <span className="text-[oklch(0.8_0.2_148)]">live</span> : null}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip content={pinned ? "Unpin it" : "Pin this thread and its answer to the top of the book"}>
            <Button variant="ghost" size="xs" onClick={() => { play(pinned ? "close" : "confirm"); togglePin(t.id); }} aria-label={pinned ? "Unpin this thread" : "Pin this thread"} aria-pressed={pinned}>
              <Pin className={cn("size-3", pinned && "fill-current text-accent")} />
            </Button>
          </Tooltip>
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

      {/*
        What this iteration did, on the face of the card.
        Finish and Build lead to work that happens after the answer — files
        pushed, a build on Vercel — and that is written on here as it
        happens, so the card says what was made of it, not only what was
        said.
      */}
      {t.changes.length ? (
        <ul className="mt-1.5 space-y-0.5 border-t border-border/60 pt-1.5">
          {t.changes.map((c, i) => (
            <li key={i} className="flex items-start gap-1 text-[10px] leading-snug text-fg-muted">
              <Check className="mt-px size-2.5 shrink-0 text-[oklch(0.72_0.22_148)]" /> {c}
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div data-trail-extent="" className="absolute left-0 top-full mt-2 w-full space-y-2">
          <Pane label="What came back" text={t.answer || "—"} bodyClassName="max-h-[260px]" mono />
          <div className="rounded-lg border border-border bg-panel/95 p-2.5 shadow-pop">
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
              <div className="mt-2">
                <Section label={`Findings (${findings.length})`}>
                  <ul className="space-y-1.5">
                    {findings.map((f) => (
                      <li key={f.id} className="rounded border border-border bg-elevated p-2">
                        <p className="text-[11px] leading-snug text-fg">{f.target.label}: {f.text}</p>
                        {f.prompt ? (
                          <div className="mt-1 flex items-start gap-2">
                            <p className="min-w-0 flex-1 text-[10px] italic leading-snug text-fg-muted">{f.prompt}</p>
                            <Button variant="outline" size="xs" disabled={f.applied} onClick={() => applyRevision(f.id)}>
                              {f.applied ? "Taken" : "Take it"}
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One box of text off a thread — the prompt or the answer — in the same
 * language as the cards the tour writes on: a rule, a small capital label,
 * and the words underneath in a box you can take away whole.
 */
function Pane({
  label, text, className, bodyClassName, mono,
}: { label: string; text: string; className?: string; bodyClassName?: string; mono?: boolean }) {
  const ctx = useActions();
  return (
    <div className={cn("rounded-lg border border-border bg-panel/95 p-2.5 shadow-pop", className)}>
      <div className="mb-1 flex items-center gap-1.5">
        <p className="flex flex-1 items-center gap-1 text-[9px] uppercase tracking-[0.16em] text-fg-faint">
          <Circle className="size-1.5 fill-current" /> {label}
        </p>
        <Button variant="ghost" size="xs" onClick={() => void ctx.copy(text, label.toLowerCase())} aria-label={`Copy ${label}`}>
          <Copy className="size-3" /> Copy
        </Button>
      </div>
      <div
        // A screen, like every other box of words in the Builder.
        className={cn("overflow-auto whitespace-pre-wrap break-words rounded p-2 text-[11px] leading-relaxed", mono && "font-mono text-[10px]", bodyClassName)}
        style={{ ...screenFace, color: SCREEN.ink }}
      >
        {text}
      </div>
    </div>
  );
}

/**
 * The threads someone pinned, and their answers, at the top of the book.
 *
 * The trail is a map and a map scrolls away; the thread you are working
 * against has to stay where you can read it while you write the next ask.
 */
export function PinnedThreads() {
  const threads = useStudio((s) => s.threads);
  const pinned = useStudio((s) => s.pinnedThreads);
  const togglePin = useStudio((s) => s.togglePinnedThread);
  const standOn = useStudio((s) => s.standOn);
  const liveThreadId = useStudio((s) => s.liveThreadId);
  const kept = pinned.map((id) => threads.find((t) => t.id === id)).filter((t): t is Thread => !!t);
  if (!kept.length) return null;
  return (
    <div className="space-y-2">
      {kept.map((t) => (
        <div key={t.id} className="rounded-lg border border-accent/40 bg-elevated/60 p-2.5 shadow-pop">
          <div className="flex items-start gap-2">
            <Pin className="mt-0.5 size-3 shrink-0 fill-current text-accent" />
            <p className="min-w-0 flex-1 text-[12px] font-semibold leading-snug text-fg">{threadTitle(t)}</p>
            {t.id !== liveThreadId && t.doc ? (
              <Button variant="ghost" size="xs" onClick={() => { play("confirm"); standOn(t.id); }}>
                <MapPin className="size-3" /> Stand on it
              </Button>
            ) : null}
            <Button variant="ghost" size="xs" onClick={() => { play("close"); togglePin(t.id); }} aria-label="Unpin this thread">
              <PinOff className="size-3" />
            </Button>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <Pane label="The prompt, as it was asked" text={t.ask || "—"} bodyClassName="max-h-40" />
            <Pane label="What came back" text={t.answer || "—"} bodyClassName="max-h-40" mono />
          </div>
          {t.changes.length ? (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
              {t.changes.map((c, i) => (
                <li key={i} className="flex items-center gap-1 text-[10px] text-fg-muted">
                  <Check className="size-2.5 text-[oklch(0.72_0.22_148)]" /> {c}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
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
/**
 * One cord, braided: four strands round a common spine, each swinging on
 * its own phase, tendrils curling off them, a knot at each end, and — on a
 * cord that is live or pending — a light travelling along it.
 *
 * `tone` is the whole meaning of the drawing. **live** is the line the
 * board is standing on; **landed** is a thread that came back, or a piece
 * one worked on; **pending** is what the next call will send and has not
 * sent yet. Purple only ever means pending.
 */
type Tone = "live" | "landed" | "pending";

function vine(
  c: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
  tone: Tone,
  depth: number,
) {
  const palette = tone === "pending" ? PENDING : VINE;
  const moving = tone !== "landed";
  const bright = tone === "live" ? 1 : tone === "pending" ? 0.9 : 0.5;
  const steps = 56;
  const span = Math.hypot(to.x - from.x, to.y - from.y);
  const amp = Math.max(3, Math.min(13, span * 0.085));
  const seed = (from.x * 0.013 + to.y * 0.007 + depth * 1.7) % (Math.PI * 2);

  // The trail runs left to right and steps down, so the spine leaves the
  // one sideways and enters the other sideways: the cord makes the tread
  // and the riser of the stair rather than cutting the corner between them.
  const bend = Math.max(26, Math.abs(to.x - from.x) * 0.55, Math.abs(to.y - from.y) * 0.28);
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
    // Tight where it grips, widest in the middle: a braid, not a ladder.
    const grip = Math.sin(u * Math.PI) ** 0.7;
    const swing = Math.sin(u * wind + phase + t * (moving ? 0.9 : 0.2)) * amp * grip;
    return { x: p.x + (-dy / len) * swing, y: p.y + (dx / len) * swing, nx: -dy / len, ny: dx / len };
  };

  const strands = [
    { phase: 0, wind: 6.5, w: 1.9, tone: palette.core, a: 0.95 * bright, glow: 12 },
    { phase: 2.1, wind: 6.5, w: 1.35, tone: palette.body, a: 0.7 * bright, glow: 7 },
    { phase: 4.2, wind: 6.5, w: 1.05, tone: palette.body, a: 0.5 * bright, glow: 5 },
    { phase: 1.1, wind: 10.5, w: 0.8, tone: palette.dim, a: 0.45 * bright, glow: 3 },
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
    c.shadowColor = palette.body;
    c.shadowBlur = tone === "landed" ? 0 : st.glow;
    c.stroke();
    c.shadowBlur = 0;
    c.globalAlpha = 1;
  }

  // Tendrils: short curls off the braid, so it reads as grown, not routed.
  const curls = Math.max(1, Math.round(span / 90));
  for (let k = 0; k < curls; k++) {
    const u = 0.22 + ((k + 0.5) / (curls + 0.6)) * 0.6;
    const p = on(u, seed, 6.5);
    const side = k % 2 ? 1 : -1;
    const reach = (7 + Math.sin(t * 0.6 + k + seed) * 3) * side;
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.quadraticCurveTo(p.x + p.nx * reach, p.y + p.ny * reach - 5, p.x + p.nx * reach * 1.4, p.y + p.ny * reach * 1.4 + 4);
    c.strokeStyle = palette.dim;
    c.globalAlpha = 0.6 * bright;
    c.lineWidth = 1;
    c.stroke();
    c.globalAlpha = 1;
  }

  // Where it grips: a knot at each end, so a cord meets its card.
  for (const p of [at(0), at(1)]) {
    c.beginPath();
    c.arc(p.x, p.y, tone === "landed" ? 2 : 2.6, 0, Math.PI * 2);
    c.fillStyle = palette.core;
    c.globalAlpha = 0.9 * bright;
    c.fill();
    c.globalAlpha = 1;
  }

  // What is live or pending has something travelling along it.
  if (moving) {
    const u = (t * 0.2 + seed * 0.1) % 1;
    const p = on(u, seed, 6.5);
    const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 11);
    g.addColorStop(0, tone === "pending" ? "oklch(0.9 0.22 305 / 0.85)" : "oklch(0.96 0.2 145 / 0.85)");
    g.addColorStop(1, "oklch(0.96 0.2 145 / 0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(p.x, p.y, 11, 0, Math.PI * 2);
    c.fill();
  }
}
