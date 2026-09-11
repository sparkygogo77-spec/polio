"use client";
/**
 * The timeline: every iteration, as a place rather than a list.
 *
 * Finish opens this, and it fills the screen the way the board does: the
 * same dark matter under it, nothing down either side.
 *
 * Two kinds of thing stand on it, and they do not look alike, because
 * they are not alike. A **chain prompt** — a plan, a critique, a build,
 * anything asked of the whole site — is an emerald box with a headline
 * and a thumbnail of what it left behind, like a news snippet. An
 * **element prompt** — a drawing made real on one part — is a small
 * purple construct piece with no headline at all: an icon, the part's
 * name, and the line that was drawn. A drawing is not a headline.
 *
 * Nothing is aligned and nothing is grouped. Boxes are scattered where
 * they landed, dragged anywhere, and the whole surface pans out past the
 * edges, because a history that snaps to a grid is a table with extra
 * steps. Where a box is put is kept (`threadSpots`).
 *
 * Between them run **strands** (`strand.ts`): tight lines with light
 * moving inside them, following the boxes as they are dragged. On the
 * strand between two iterations sits the **loop starter** — examine,
 * critique, iterate — because the interesting thing about two iterations
 * is what happened between them.
 *
 * Clicking one opens it *in place*: a card grows out of the box itself,
 * the input from the top edge (what was asked, and the drawing if it was
 * an element prompt) and the output from the bottom (what came back, what
 * changed), each joined to it by the same construct the strands are made
 * of. The section under the timeline keeps the prompt, pinned and large,
 * and what this generation can be turned into.
 */
import * as React from "react";
import { Brush, Copy, Flag, GitBranch, Layers, ListChecks, MapPin, Pin, PinOff, Repeat, Scissors, Sparkles, Wand2 } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { Tooltip } from "@/core/ui/tooltip";
import { Button } from "@/core/ui/button";
import { useGround } from "./ground";
import { paintConnector, paintStrand, strandMiddle, type Point, type StrandTone } from "./strand";
import { diffDocs, flatten, threadTitle, threadTree, type Thread, type ThreadNode } from "./threads";
import { useStudio } from "./store";

/** A chain prompt's box. Small: it says little until it is opened. */
const BOX = { w: 248, h: 104 };
/** An element prompt's piece: a chip, not a card. */
const PIECE = { w: 150, h: 44 };
/** How far a card stands off the box it grew out of, for the connector to run. */
const GROW = 22;
/** How far apart the scatter puts them, before anybody drags anything. */
const DRIFT = { x: 268, y: 158 };
/** How far back the ground sits here. The boxes have to be the brightest thing. */
const GROUND_DIM = 0.55;

/** A number from a string: the same box lands in the same place every time. */
function seed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Where the boxes sit before anyone moves them.
 *
 * Down and to the right, one step per iteration, with a shove either way
 * off the thread's own id — enough that no two rows line up and the eye
 * reads it as a place rather than a column.
 */
function scatter(nodes: ThreadNode[]): Map<string, Point> {
  const out = new Map<string, Point>();
  nodes.forEach((n, i) => {
    const jx = seed(n.thread.id) - 0.5;
    const jy = seed(`${n.thread.id}y`) - 0.5;
    out.set(n.thread.id, {
      x: 140 + n.depth * DRIFT.x + jx * 150,
      y: 130 + i * DRIFT.y + jy * 90,
    });
  });
  return out;
}

/** An element prompt is a drawing made real on one part; everything else is a chain prompt. */
export const isElement = (t: Thread) => t.mode === "drawing";

/** What kind of iteration this is, in one word and one mark. */
function kindOf(t: Thread): { icon: React.ReactNode; kind: string } {
  switch (t.mode) {
    case "drawing":
      return { icon: <Brush className="size-3.5" />, kind: "element prompt" };
    case "build":
      return { icon: <Layers className="size-3.5" />, kind: "chain prompt" };
    case "critique":
    case "finish":
      return { icon: <ListChecks className="size-3.5" />, kind: "chain prompt" };
    default:
      return { icon: <Sparkles className="size-3.5" />, kind: "chain prompt" };
  }
}

/** The size of whatever stands for this iteration. */
const sizeOf = (t: Thread) => (isElement(t) ? PIECE : BOX);

/** The main update of an iteration: what it actually did, in a few words. */
export function headlineOf(t: Thread): string {
  if (t.changes.length) return t.changes[0]!;
  const title = threadTitle(t);
  const arrow = title.indexOf("→");
  return arrow > 0 ? title.slice(0, arrow).trim() : title;
}

export function Timeline() {
  const threads = useStudio((s) => s.threads);
  const liveThreadId = useStudio((s) => s.liveThreadId);
  const openThreadId = useStudio((s) => s.openThreadId);
  const spots = useStudio((s) => s.threadSpots);
  const pinned = useStudio((s) => s.pinnedThreads);
  const currentId = useStudio((s) => s.currentThreadId);

  const host = React.useRef<HTMLDivElement>(null);
  const plot = React.useRef<HTMLDivElement>(null);
  const ground = React.useRef<HTMLCanvasElement>(null);
  const wires = React.useRef<HTMLCanvasElement>(null);

  const [pan, setPan] = React.useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [dragging, setDragging] = React.useState<{ id: string; at: Point } | null>(null);
  const [menu, setMenu] = React.useState<{ id: string; x: number; y: number } | null>(null);
  const [loop, setLoop] = React.useState<{ from: string; to: string } | null>(null);
  /** When a drag ended, so the click it fires can be ignored. */
  const dropped = React.useRef(0);

  const roots = React.useMemo(() => threadTree(threads), [threads]);
  const all = React.useMemo(() => flatten(roots), [roots]);
  const home = React.useMemo(() => scatter(all), [all]);
  const spotOf = React.useCallback(
    (id: string): Point => {
      if (dragging?.id === id) return dragging.at;
      return spots[`box:${id}`] ?? home.get(id) ?? { x: 140, y: 130 };
    },
    [dragging, spots, home],
  );

  /*
   * The floor is the same weather the workspace stands on, painted the same
   * way: two layers, one animation frame's clock, the clouds small and rare.
   * It used to repaint everything thirty times a second here, which measured
   * at 23fps flat — smooth, because it was uniformly slow, and a great deal
   * of main thread for a sky.
   */
  const clouds = React.useRef<HTMLCanvasElement>(null);
  useGround(host, clouds, ground, GROUND_DIM);

  /* ----------------------------------------------------------- strands */
  /*
   * Where a strand starts and ends is worked out from where the box *is*,
   * not by measuring the box: the canvas and the loop starters then agree
   * to the pixel, a starter can be placed on the first frame rather than
   * the second, and dragging one box moves its strands in the same frame
   * as the box itself.
   */
  const byId = React.useMemo(() => new Map(threads.map((t) => [t.id, t])), [threads]);
  const anchorOf = React.useCallback(
    (id: string) => {
      const at = spotOf(id);
      const t = byId.get(id);
      const size = t ? sizeOf(t) : BOX;
      return { left: at.x, right: at.x + size.w, mid: at.y + size.h / 2, top: at.y, bottom: at.y + size.h, cx: at.x + size.w / 2 };
    },
    [spotOf, byId],
  );

  const cords = React.useMemo(
    () =>
      all
        .filter((n) => n.thread.parentId)
        .map((n) => ({
          from: n.thread.parentId!,
          to: n.thread.id,
          // An element prompt's strand wears the piece's own purple; a chain
          // prompt's is emerald, and brighter on the line the board stands on.
          tone: (isElement(n.thread) ? "pending" : n.thread.id === liveThreadId ? "live" : "landed") as StrandTone,
        })),
    [all, liveThreadId],
  );

  const openId = openThreadId;
  const openTone: StrandTone = openId && byId.get(openId) && isElement(byId.get(openId)!) ? "pending" : "live";

  React.useEffect(() => {
    const el = wires.current;
    const box = host.current;
    const c = el?.getContext("2d");
    if (!el || !c || !box) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const paint = (now: number) => {
      raf = requestAnimationFrame(paint);
      if (now - last < 33) return;
      last = now;
      const w = Math.max(1, Math.round(box.clientWidth));
      const h = Math.max(1, Math.round(box.clientHeight));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (el.width !== w * dpr || el.height !== h * dpr) {
        el.width = w * dpr;
        el.height = h * dpr;
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const t = still ? 0 : (now - start) / 1000;
      // The strands live in the plot's frame; the plot is panned and scaled.
      c.save();
      c.translate(pan.x, pan.y);
      c.scale(zoom, zoom);
      for (const cord of cords) {
        const [from, to] = ends(anchorOf(cord.from), anchorOf(cord.to));
        paintStrand(c, from, to, { t, tone: cord.tone, phase: seed(cord.to) });
      }
      /*
       * The card's own connector: the same construct, from the card's edge
       * to the box's. Measured rather than assumed, because the card is as
       * tall as what is in it — and it is two rectangles a frame, not a
       * layout pass.
       */
      const grid = plot.current;
      if (openId && grid) {
        const a = anchorOf(openId);
        const origin = grid.getBoundingClientRect();
        const tone: StrandTone = openTone;
        for (const side of ["in", "out"] as const) {
          const card = grid.querySelector<HTMLElement>(`[data-card="${side}"][data-card-of="${openId}"]`);
          if (!card) continue;
          const r = card.getBoundingClientRect();
          const cx = (r.left - origin.left) / zoom + r.width / zoom / 2;
          const edge = side === "in" ? (r.bottom - origin.top) / zoom : (r.top - origin.top) / zoom;
          paintConnector(c, { x: cx, y: edge }, { x: a.cx, y: side === "in" ? a.top : a.bottom }, { t, tone });
        }
      }
      c.restore();
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [cords, anchorOf, pan, zoom, openId, openTone]);

  /* -------------------------------------------------------- the pointer */
  const startDrag = (id: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const grid = plot.current;
    if (!grid) return;
    e.preventDefault();
    e.stopPropagation();
    const origin = grid.getBoundingClientRect();
    const from = spotOf(id);
    const grab = { x: (e.clientX - origin.left) / zoom - from.x, y: (e.clientY - origin.top) / zoom - from.y };
    const to = (ev: PointerEvent): Point => {
      const r = grid.getBoundingClientRect();
      return { x: (ev.clientX - r.left) / zoom - grab.x, y: (ev.clientY - r.top) / zoom - grab.y };
    };
    const from0 = { x: e.clientX, y: e.clientY };
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - from0.x, ev.clientY - from0.y) < 4) return;
      moved = true;
      setDragging({ id, at: to(ev) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      // A box that was carried somewhere is not a box that was clicked: the
      // click that follows a drag would otherwise open whatever was moved.
      if (moved) {
        const at = to(ev);
        useStudio.getState().moveThread(`box:${id}`, at.x, at.y);
        dropped.current = Date.now();
        play("tap");
      }
      setDragging(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /** Dragging the ground pans the whole surface, as far as you like. */
  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setMenu(null);
    const from = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    const move = (ev: PointerEvent) => setPan({ x: ev.clientX - from.x, y: ev.clientY - from.y });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      return;
    }
    setZoom((z) => Math.max(0.4, Math.min(1.8, z * (e.deltaY < 0 ? 1.08 : 0.93))));
  };

  const nothing = !threads.length;

  return (
    <div
      ref={host}
      data-timeline=""
      className="relative h-full w-full overflow-hidden"
      onPointerDown={startPan}
      onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={clouds} data-ground-clouds="" aria-hidden className="pointer-events-none absolute left-0 top-0" />
      <canvas ref={ground} data-ground-sparks="" aria-hidden className="pointer-events-none absolute left-0 top-0" />
      <canvas ref={wires} aria-hidden className="pointer-events-none absolute left-0 top-0" />

      <div
        ref={plot}
        className="absolute left-0 top-0"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", width: 1, height: 1 }}
      >
        {all.map((n) => {
          const t = n.thread;
          const at = spotOf(t.id);
          const live = t.id === liveThreadId;
          const open = t.id === openThreadId;
          return (
            <Standing
              key={t.id}
              thread={t}
              at={at}
              live={live}
              open={open}
              pinned={pinned.includes(t.id)}
              current={currentId === t.id}
              dragging={dragging?.id === t.id}
              onOpen={() => {
                if (Date.now() - dropped.current < 250) return;
                play("select");
                useStudio.getState().openThread(open ? null : t.id);
              }}
              onDragStart={(e) => startDrag(t.id, e)}
              onMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                play("open");
                setMenu({ id: t.id, x: e.clientX, y: e.clientY });
              }}
            />
          );
        })}

        {/* The loop starter, on the strand between two iterations. */}
        {cords.map((cord) => {
          const [from, to] = ends(anchorOf(cord.from), anchorOf(cord.to));
          const mid = strandMiddle(from, to);
          return (
            <LoopStarter
              key={`${cord.from}->${cord.to}`}
              at={mid}
              from={byId.get(cord.from)}
              to={byId.get(cord.to)}
              on={loop?.from === cord.from && loop?.to === cord.to}
              onClick={() => {
                play("confirm");
                setLoop({ from: cord.from, to: cord.to });
                useStudio.getState().openThread(cord.to);
                window.dispatchEvent(new CustomEvent("studio:loop", { detail: { from: cord.from, to: cord.to } }));
              }}
            />
          );
        })}
      </div>

      {menu ? (
        <BoxMenu
          at={menu}
          thread={byId.get(menu.id)!}
          onClose={() => setMenu(null)}
        />
      ) : null}

      {nothing ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="max-w-sm text-center text-[12px] leading-relaxed text-[oklch(0.7_0.06_158)]">
            Nothing has landed yet. Every ask that comes back stands here as an iteration, a chain prompt about the whole
            site, or an element prompt from a drawing, and the strands between them are what one iteration made of the
            last. Ask something below to start.
          </p>
        </div>
      ) : null}

      {/* Where you are, and the way back to the middle. */}
      <div className="pointer-events-auto absolute bottom-2 left-2 flex items-center gap-1 rounded-md border border-[oklch(0.36_0.07_158)] bg-[oklch(0.16_0.03_158/0.75)] px-1.5 py-1 text-[10px] text-[oklch(0.76_0.07_158)] backdrop-blur-sm">
        <GitBranch className="size-3" />
        <span className="num">{threads.length}</span>
        <span className="opacity-60">iterations</span>
        <span className="mx-1 h-3 w-px bg-[oklch(0.36_0.07_158)]" />
        <button type="button" className="tactile rounded px-1 hover:text-[oklch(0.92_0.1_158)]" onClick={(e) => { e.stopPropagation(); play("tap"); setPan({ x: 0, y: 0 }); setZoom(1); }}>
          centre
        </button>
        <span className="num opacity-60">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}

/**
 * Which sides two boxes face each other with: out of one, into the other,
 * and the other way round when the child ended up to the left of its
 * parent — which it will, the moment anything is dragged.
 */
function ends(a: { left: number; right: number; mid: number }, b: { left: number; right: number; mid: number }): [Point, Point] {
  const backwards = b.left < a.left;
  return [
    { x: backwards ? a.left : a.right, y: a.mid },
    { x: backwards ? b.right : b.left, y: b.mid },
  ];
}

/* ------------------------------------------------------------------ */
/* One box                                                             */
/* ------------------------------------------------------------------ */

/** A chain prompt is a box; an element prompt is a piece. Both open the same card. */
function Standing(props: {
  thread: Thread;
  at: Point;
  live: boolean;
  open: boolean;
  pinned: boolean;
  current: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onMenu: (e: React.MouseEvent) => void;
}) {
  return isElement(props.thread) ? <ElementPiece {...props} /> : <IterationBox {...props} />;
}

/**
 * A chain prompt: a box with a headline and a thumbnail of what it left.
 *
 * The thumbnail is the point of it. "3 findings" is a receipt; the shape
 * of the page the iteration produced is the thing you recognise from
 * across the screen, which is what a timeline is for.
 */
/**
 * Red or green, and nothing else.
 *
 * The only question a box has to answer from across the screen is whether
 * the work behind it finished. Red while a process is still going or gave
 * up, green the moment it is done. Two colours, no shades between them,
 * and no other state allowed in here: a third colour would make it a
 * legend rather than a glance.
 */
function StateMark({ thread }: { thread: Thread }) {
  const done = (thread.state ?? "done") === "done";
  return (
    <span
      data-state={done ? "done" : thread.state}
      aria-label={done ? "finished" : thread.state === "cut" ? "given up" : "still running"}
      title={done ? "finished" : thread.state === "cut" ? "given up" : "still running"}
      className="ml-auto size-2 shrink-0 rounded-full"
      style={{
        background: done ? "oklch(0.72 0.2 150)" : "oklch(0.62 0.23 27)",
        boxShadow: `0 0 6px ${done ? "oklch(0.72 0.2 150 / 0.7)" : "oklch(0.62 0.23 27 / 0.7)"}`,
      }}
    />
  );
}

/**
 * The flag: this is the one I am working in.
 *
 * One per timeline, on the box rather than beside it, and pressing it
 * moves it here. What follows it is the section below, the prompt area in
 * it, and where the next ask hangs from; it stays put across a reload,
 * because the whole point of marking a place is coming back to it.
 */
function CurrentButton({ thread, on }: { thread: Thread; on: boolean }) {
  return (
    <button
      type="button"
      data-current={on ? "1" : "0"}
      data-current-for={thread.id}
      aria-pressed={on}
      title={on ? "The iteration you are working in" : "Work in this iteration"}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        play(on ? "close" : "confirm");
        useStudio.getState().setCurrentThread(on ? null : thread.id);
      }}
      className="flex shrink-0 items-center gap-1 rounded-sm border px-1 py-px text-[8px] uppercase tracking-[0.12em] transition-[background,border-color]"
      style={{
        borderColor: on ? "oklch(0.78 0.18 158)" : "oklch(0.42 0.08 158)",
        background: on ? "oklch(0.5 0.15 158)" : "transparent",
        color: on ? "oklch(0.14 0.02 158)" : "oklch(0.66 0.08 158)",
      }}
    >
      <Flag className="size-2.5" />
      this iteration
    </button>
  );
}

function IterationBox({
  thread, at, live, open, pinned, current, dragging, onOpen, onDragStart, onMenu,
}: {
  thread: Thread;
  at: Point;
  live: boolean;
  open: boolean;
  pinned: boolean;
  current: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onMenu: (e: React.MouseEvent) => void;
}) {
  const { icon, kind } = kindOf(thread);
  return (
    <div className="absolute" style={{ left: at.x, top: at.y, width: BOX.w, zIndex: open ? 40 : dragging ? 30 : 10 }}>
      {open ? <Card thread={thread} side="in" /> : null}
      <button
        type="button"
        data-box={thread.id}
        data-open={open ? "1" : "0"}
        onPointerDown={onDragStart}
        onClick={onOpen}
        onContextMenu={onMenu}
        className="flex w-full cursor-grab flex-col gap-1 rounded-lg border p-2 text-left transition-[box-shadow,border-color,transform] active:cursor-grabbing"
        style={{
          minHeight: BOX.h,
          // Emerald, and not shouting: the ground behind is nebula, and a box
          // that fights it makes the whole screen a poster.
          background: open ? "oklch(0.26 0.07 158)" : "oklch(0.21 0.05 158 / 0.92)",
          borderColor: open ? "oklch(0.66 0.16 158)" : live ? "oklch(0.5 0.12 158)" : "oklch(0.36 0.07 158)",
          color: "oklch(0.9 0.05 158)",
          boxShadow: open
            ? "0 0 0 1px oklch(0.66 0.16 158 / 0.5), 0 8px 26px oklch(0 0 0 / 0.5)"
            : "0 6px 18px oklch(0 0 0 / 0.45)",
          transform: dragging ? "scale(1.02)" : "none",
        }}
      >
        <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-[oklch(0.68_0.09_158)]">
          {icon}
          {kind}
          {pinned ? <Pin className="size-3 fill-current" /> : null}
          {/* The flag, then the state, hard against the right edge. */}
          <span className="ml-auto flex items-center gap-1.5">
            <CurrentButton thread={thread} on={current} />
            <StateMark thread={thread} />
          </span>
        </span>
        <div className="flex items-start gap-2">
          {/* What it produced, at a glance: the page it left behind. */}
          <Snippet thread={thread} />
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-[12px] font-medium leading-snug text-[oklch(0.93_0.04_158)]">{headlineOf(thread)}</span>
            <span className="num mt-1 block text-[9px] text-[oklch(0.62_0.06_158)]">
              {new Date(thread.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {thread.mode}
              {thread.changes.length > 1 ? ` · +${thread.changes.length - 1}` : ""}
            </span>
          </span>
        </div>
      </button>
      {open ? <Card thread={thread} side="out" /> : null}
    </div>
  );
}

/**
 * An element prompt: the drawing, small, in purple.
 *
 * No headline. A drawing made real on one part is not news about the
 * site, it is a piece of it, and the line that was drawn says more than
 * any sentence about the line would.
 */
function ElementPiece({
  thread, at, open, current, dragging, onOpen, onDragStart, onMenu,
}: {
  thread: Thread;
  at: Point;
  live: boolean;
  open: boolean;
  pinned: boolean;
  current: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onMenu: (e: React.MouseEvent) => void;
}) {
  const name = (thread.changes[0] ?? thread.ask ?? "a drawing").replace(/^(drew|reshaped)\s+/i, "").split(" at ")[0]!.slice(0, 28);
  return (
    <div className="absolute" style={{ left: at.x, top: at.y, width: PIECE.w, zIndex: open ? 40 : dragging ? 30 : 12 }}>
      {open ? <Card thread={thread} side="in" /> : null}
      <button
        type="button"
        data-box={thread.id}
        data-piece=""
        data-open={open ? "1" : "0"}
        onPointerDown={onDragStart}
        onClick={onOpen}
        onContextMenu={onMenu}
        className="flex w-full cursor-grab items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-2.5 text-left transition-[box-shadow,border-color,transform] active:cursor-grabbing"
        style={{
          minHeight: PIECE.h,
          background: open ? "oklch(0.3 0.1 300)" : "oklch(0.24 0.07 300 / 0.92)",
          borderColor: open ? "oklch(0.8 0.17 300)" : "oklch(0.48 0.13 300)",
          color: "oklch(0.93 0.05 300)",
          boxShadow: open ? "0 0 0 1px oklch(0.8 0.17 300 / 0.45), 0 8px 24px oklch(0 0 0 / 0.5)" : "0 4px 14px oklch(0 0 0 / 0.45)",
          transform: dragging ? "scale(1.03)" : "none",
        }}
      >
        <Drawn sketch={thread.sketch} size={30} tone="oklch(0.9 0.14 300)" />
        <span className="min-w-0 flex-1 truncate text-[11px] leading-tight">{name}</span>
        <CurrentButton thread={thread} on={current} />
        <StateMark thread={thread} />
      </button>
      {open ? <Card thread={thread} side="out" /> : null}
    </div>
  );
}

/**
 * The line that was drawn, as a mark.
 *
 * Straight off the strokes the board kept, so a piece carries the actual
 * drawing rather than an icon standing in for one.
 */
/**
 * Enough points to be the line, at a thumbnail's size.
 *
 * A helix is two hundred points and every other one is plenty. A box is
 * five, and every other one is a diagonal: dropping points from a short
 * stroke does not simplify it, it draws something else. So the step is
 * worked out from the length, and the last point is always kept, because
 * that is the one that closes the shape.
 */
function thin(stroke: [number, number][], most = 64): [number, number][] {
  if (stroke.length <= most) return stroke;
  const step = Math.ceil(stroke.length / most);
  const out = stroke.filter((_, k) => k % step === 0);
  const last = stroke[stroke.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

function Drawn({ sketch, size, tone }: { sketch?: { strokes: [number, number][][] } | null; size: number; tone: string }) {
  if (!sketch?.strokes?.length) return <Brush className="size-3.5 shrink-0 opacity-70" />;
  return (
    <svg width={size} height={size} viewBox="0 0 1 1" aria-hidden className="shrink-0">
      {sketch.strokes.slice(0, 12).map((stroke, i) => (
        <polyline
          key={i}
          points={thin(stroke).map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" ")}
          fill="none"
          stroke={tone}
          strokeWidth={0.04}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/**
 * The thumbnail on a chain prompt's box: the page that iteration left.
 *
 * Every part as a rectangle where it stood, the ones this iteration
 * changed lit. It is a silhouette, not a screenshot — but it is *this*
 * iteration's silhouette, and two iterations apart are two different
 * shapes, which is the whole job.
 */
function Snippet({ thread }: { thread: Thread }) {
  const threads = useStudio((s) => s.threads);
  const parent = thread.parentId ? threads.find((t) => t.id === thread.parentId) ?? null : null;
  const nodes = (thread.doc?.nodes ?? []).filter((n) => typeof n.x === "number" && typeof n.y === "number");
  const changed = React.useMemo(() => new Set(diffDocs(parent?.doc, thread.doc).map((l) => l.replace(/^[+~-]\s*/, "").split(":")[0]!.trim())), [parent, thread]);
  const W = 56;
  const H = 44;
  if (!nodes.length) {
    return (
      <span className="grid shrink-0 place-items-center rounded" style={{ width: W, height: H, background: "oklch(0.16 0.03 158)", border: "1px solid oklch(0.3 0.06 158)" }}>
        <Sparkles className="size-4 opacity-50" />
      </span>
    );
  }
  const right = Math.max(...nodes.map((n) => (n.x ?? 0) + (n.w ?? 0)), 1);
  const bottom = Math.max(...nodes.map((n) => (n.y ?? 0) + (n.h ?? 0)), 1);
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${right} ${bottom}`}
      preserveAspectRatio="xMidYMin slice"
      aria-hidden
      className="shrink-0 rounded"
      style={{ background: "oklch(0.14 0.025 158)", border: "1px solid oklch(0.3 0.06 158)" }}
    >
      {nodes.slice(0, 60).map((n) => {
        const lit = changed.has(n.label);
        return (
          <rect
            key={n.id}
            x={n.x}
            y={n.y}
            width={Math.max(4, n.w ?? 0)}
            height={Math.max(4, n.h ?? 0)}
            rx={6}
            fill={lit ? "oklch(0.72 0.19 158 / 0.6)" : "oklch(0.62 0.1 158 / 0.3)"}
            stroke={lit ? "oklch(0.9 0.2 158)" : "oklch(0.62 0.11 158 / 0.75)"}
            strokeWidth={lit ? 8 : 4}
          />
        );
      })}
    </svg>
  );
}

/**
 * The card that grows out of the box.
 *
 * Up from the top edge: what went in — the prompt, and the drawing when
 * there was one. Down from the bottom: what came out — the answer, and
 * what it changed on the board. Both joined to the box by the connector
 * the strands are made of, so it reads as the box extending rather than a
 * panel arriving.
 */
function Card({ thread, side }: { thread: Thread; side: "in" | "out" }) {
  const threads = useStudio((s) => s.threads);
  const parent = thread.parentId ? threads.find((t) => t.id === thread.parentId) ?? null : null;
  const changed = React.useMemo(() => diffDocs(parent?.doc, thread.doc), [parent, thread]);
  const element = isElement(thread);
  const skin = element
    ? { face: "oklch(0.19 0.055 300)", rim: "oklch(0.46 0.12 300)", text: "oklch(0.92 0.04 300)", dim: "oklch(0.72 0.08 300)" }
    : { face: "oklch(0.17 0.04 158)", rim: "oklch(0.42 0.09 158)", text: "oklch(0.92 0.04 158)", dim: "oklch(0.7 0.07 158)" };
  return (
    <div
      data-card={side}
      data-card-of={thread.id}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute w-[min(420px,86vw)]"
      style={{
        left: "50%",
        transform: "translateX(-50%)",
        ...(side === "in" ? { bottom: `calc(100% + ${GROW}px)` } : { top: `calc(100% + ${GROW}px)` }),
      }}
    >
      <div
        className="rounded-lg border p-2.5 shadow-pop"
        style={{ background: skin.face, borderColor: skin.rim, color: skin.text, animation: "el-grow 180ms ease-out" }}
      >
        <p className="mb-1.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em]" style={{ color: skin.dim }}>
          {side === "in" ? <><Sparkles className="size-3" /> what went in</> : <><Wand2 className="size-3" /> what came out</>}
          <span className="flex-1" />
          <CopyBit text={side === "in" ? thread.ask : thread.answer} />
        </p>
        {side === "in" ? (
          <div className="flex items-start gap-2">
            {element ? (
              <span className="shrink-0 rounded border p-1" style={{ borderColor: skin.rim, background: "oklch(0.13 0.03 300)" }}>
                <Drawn sketch={thread.sketch} size={72} tone="oklch(0.92 0.14 300)" />
              </span>
            ) : null}
            <p className="max-h-40 min-w-0 flex-1 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed">{thread.ask || "nothing was typed"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed">{thread.answer || "nothing came back"}</pre>
            <div className="border-t pt-1.5" style={{ borderColor: skin.rim }}>
              <p className="mb-1 text-[9px] uppercase tracking-[0.16em]" style={{ color: skin.dim }}>what changed on the board</p>
              {changed.length ? (
                <ul className="max-h-24 space-y-0.5 overflow-auto font-mono text-[10px]">{changed.map((l, i) => <li key={i}>{l}</li>)}</ul>
              ) : thread.changes.length ? (
                <ul className="space-y-0.5 text-[10px]">{thread.changes.map((cx, i) => <li key={i}>{cx}</li>)}</ul>
              ) : (
                <p className="text-[10px]" style={{ color: skin.dim }}>nothing on the board changed with this one</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CopyBit({ text }: { text: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      className="tactile flex items-center gap-1 rounded px-1 text-[9px] uppercase tracking-[0.12em] opacity-80 hover:opacity-100"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        play("tap");
        setDone(true);
        window.setTimeout(() => setDone(false), 1200);
      }}
    >
      <Copy className="size-3" /> {done ? "copied" : "copy"}
    </button>
  );
}

/** The loop starter: what happened between these two, and what to do about it. */
function LoopStarter({ at, from, to, on, onClick }: { at: Point; from?: Thread; to?: Thread; on: boolean; onClick: () => void }) {
  if (!from || !to) return null;
  return (
    <Tooltip content={`Examine, critique, iterate, from "${headlineOf(from)}" to "${headlineOf(to)}"`}>
      <button
        type="button"
        data-loop-starter=""
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        aria-label="Start a loop between these two iterations"
        className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-transform hover:scale-110"
        style={{
          left: at.x,
          top: at.y,
          background: on ? "oklch(0.7 0.18 158)" : "oklch(0.2 0.05 158)",
          border: `1px solid ${on ? "oklch(0.86 0.18 158)" : "oklch(0.5 0.12 158)"}`,
          color: on ? "oklch(0.14 0.02 158)" : "oklch(0.82 0.12 158)",
          boxShadow: on ? "0 0 14px oklch(0.7 0.2 158 / 0.6)" : "0 2px 8px oklch(0 0 0 / 0.5)",
        }}
      >
        <Repeat className="size-3" />
      </button>
    </Tooltip>
  );
}

/** Right-press on a box: what can be done with this iteration. */
function BoxMenu({ at, thread, onClose }: { at: { x: number; y: number }; thread: Thread; onClose: () => void }) {
  const pinned = useStudio((s) => s.pinnedThreads.includes(thread.id));
  const live = useStudio((s) => s.liveThreadId === thread.id);
  React.useEffect(() => {
    const shut = () => onClose();
    window.addEventListener("pointerdown", shut);
    window.addEventListener("keydown", shut);
    return () => {
      window.removeEventListener("pointerdown", shut);
      window.removeEventListener("keydown", shut);
    };
  }, [onClose]);
  const item = (label: string, icon: React.ReactNode, run: () => void, danger = false) => (
    <button
      type="button"
      onClick={() => { run(); onClose(); }}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-[oklch(0.3_0.07_158)]",
        danger ? "text-[oklch(0.8_0.14_25)]" : "text-[oklch(0.9_0.04_158)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div
      data-box-menu=""
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-50 w-56 rounded-lg border p-1 shadow-pop"
      style={{ left: at.x, top: at.y, background: "oklch(0.19 0.045 158)", borderColor: "oklch(0.4 0.09 158)" }}
    >
      <p className="truncate px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[oklch(0.66_0.08_158)]">{thread.mode} · {new Date(thread.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      {item("Open it below", <Wand2 className="size-3" />, () => useStudio.getState().openThread(thread.id))}
      {item(live ? "The board is on this" : "Stand on it", <MapPin className="size-3" />, () => useStudio.getState().standOn(thread.id))}
      {item(pinned ? "Unpin it" : "Pin it", pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />, () => useStudio.getState().togglePinnedThread(thread.id))}
      {item("Copy the prompt", <Sparkles className="size-3" />, () => void navigator.clipboard?.writeText(thread.ask))}
      {item("Copy what came back", <Sparkles className="size-3" />, () => void navigator.clipboard?.writeText(thread.answer))}
      <div className="my-1 h-px bg-[oklch(0.32_0.06_158)]" />
      {item("Prune this iteration", <Scissors className="size-3" />, () => useStudio.getState().pruneThread(thread.id), true)}
    </div>
  );
}
