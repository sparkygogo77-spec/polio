"use client";
/**
 * The timeline: every iteration, as a place rather than a list.
 *
 * Finish opens this, and it fills the screen the way the board does: the
 * same dark matter under it, nothing down either side.
 *
 * Two kinds of thing stand on it, and they do not look alike, because
 * they are not alike. A **chain prompt** — a plan, a critique, a build,
 * anything asked of the whole site — is a lantern-red box with a headline
 * and a thumbnail of what it left behind, like a news snippet. An
 * **element prompt** — a drawing made real on one part — is a small ember
 * construct piece with no headline at all: an icon, the part's name, and
 * the line that was drawn. A drawing is not a headline.
 *
 * Both are red because both were losing: the pieces were purple and purple
 * on a purple nebula is nothing at all, and an emerald box on it was the
 * same colour as the vines running between the boxes. The lanterns lead now
 * and the green vines support them.
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
/*
 * The two hues the timeline is built on.
 *
 * It was emerald for iterations and purple for element prompts, and purple
 * on purple lost the pieces in the nebula. Both are red now: a lantern red
 * for the iteration boxes — warm and deep, the colour of a lamp rather than
 * of a warning — and an ember a shade cooler for the element pieces, so the
 * two kinds still read apart at a glance. The vines between them are the
 * green (`strand.ts`), which is the other half of the same decision: the
 * boxes lead, the vines support.
 *
 * The numbers below are written out in place rather than referenced, because
 * every one of them is a different lightness and chroma of these two hues:
 * 34 is the lantern, 18 is the ember, and moving either is a search for the
 * hue and nothing else.
 */
import * as React from "react";
import { Brush, ChevronLeft, ChevronRight, Coins, Copy, Flag, GitBranch, Layers, ListChecks, MapPin, Pin, PinOff, Repeat, Scissors, Sparkles, Wand2 } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { Tooltip } from "@/core/ui/tooltip";
import { Button } from "@/core/ui/button";
import { sameView, settleEase, settleView, SETTLE_MS } from "./timelineView";
import { paintStrand, strandBounds, strandEnvelope, strandMiddle, type Point, type StrandTone, type VineEnd } from "./strand";
import { sayWhere, saySpend } from "./spend";
import { moltenClass, moltenSeed } from "@/core/ui/molten";
import { chainOf, diffDocs, PROCESS, processDone, threadTitle, type Thread, type ThreadNode } from "./threads";
import { pictureOf } from "./reshapeRun";
import { FORM, formOf, formVars, within } from "./formation";
import { useStudio } from "./store";
import { Block, themeFrom } from "./blocks";
import { resolvePalette } from "./parts/theme";

/**
 * Two shapes, because the two hold different things.
 *
 * An iteration's board carries a line of prose — a headline that has to be
 * readable without wrapping three times — so it is wide: 248 by 104, near
 * enough 2.4 to 1. A drawing's board carries a picture, and a picture wants
 * a square, so it is 168 by 148, near enough 1.15 to 1.
 *
 * The areas are within four per cent of each other on purpose. Neither is
 * the lesser thing — a drawing made real is most of what happens here — so
 * they have to read as equal weight on the screen while being different
 * shapes, and equal *area* is what does that, not equal width or height.
 */
const BOX = { w: 248, h: 104 };
const PIECE = { w: 168, h: 148 };

/** How far a card stands off the box it grew out of, for the connector to run. */
const GROW = 22;
/** How far apart the scatter puts them, before anybody drags anything. */
const DRIFT = { x: 268, y: 158 };

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
 * How far each box has formed, as shown, eased towards where it really is.
 *
 * The store holds the truth — the real progress of the job and how many
 * times the thread has been updated (`formation.ts`). This is the number the
 * timeline draws, which follows the truth at a capped rate so a milestone
 * arrives as a stage forming rather than a jump, and which starts again from
 * nothing when a thread is new to this session or its generation goes up.
 *
 * Never on a reload of something that did not change: whatever is on the
 * board when the timeline mounts is shown as it is. Only what lands or
 * changes after that forms. One rAF runs while anything is still moving and
 * none when nothing is, so a still timeline costs nothing here.
 */
function useForming(threads: Thread[]): Map<string, number> {
  const [shown, setShown] = React.useState<Map<string, number>>(() => new Map());
  const state = React.useRef({ shown: new Map<string, number>(), gen: new Map<string, number>(), mounted: false, raf: 0 });
  React.useEffect(() => {
    const st = state.current;
    const target = new Map<string, number>();
    let moving = false;
    for (const t of threads) {
      const f = formOf(t);
      target.set(t.id, f.p);
      const had = st.gen.get(t.id);
      if (had === undefined) {
        st.gen.set(t.id, f.gen);
        // First sight. At mount it is as it is; after mount it is new, and forms.
        st.shown.set(t.id, st.mounted ? 0 : f.p);
      } else if (had !== f.gen) {
        st.gen.set(t.id, f.gen);
        st.shown.set(t.id, 0);
      }
      if ((st.shown.get(t.id) ?? 1) < f.p) moving = true;
    }
    for (const id of [...st.shown.keys()]) if (!target.has(id)) { st.shown.delete(id); st.gen.delete(id); }
    st.mounted = true;
    setShown(new Map(st.shown));
    if (!moving || st.raf) return;
    /* A whole formation, from nothing to landed, takes about this long when
       the work is already done; while the work is running it can only get
       as far as the work has. */
    const WHOLE_MS = 2600;
    let last = performance.now();
    const tick = (now: number) => {
      st.raf = 0;
      const dt = Math.min(64, now - last);
      last = now;
      let still = false;
      for (const [id, to] of target) {
        const at = st.shown.get(id) ?? to;
        if (at >= to) continue;
        const next = Math.min(to, at + dt / WHOLE_MS);
        st.shown.set(id, next);
        if (next < to) still = true;
      }
      setShown(new Map(st.shown));
      if (still) st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
    return () => { if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; } };
  }, [threads]);
  return shown;
}

/** The corner the boxes are drawn with (`rounded-lg`). */
const BOX_RADIUS = 8;

/**
 * The rim of a forming box: traced round it in green, then closing in.
 *
 * Through the `rim` band the trace runs the perimeter from where the vine
 * arrived — a dash the length of how far it has got, on a rounded-rect path
 * — and through the `close` band the trace is whole and thickens inward,
 * which is the green closing in from the edges before the surface comes.
 * The colour is the one that means "finished" on the state light, because
 * this is what finishing looks like while it happens.
 */
function paintRim(c: CanvasRenderingContext2D, rim: { p: number; rect: { x: number; y: number; w: number; h: number }; start: Point }) {
  const { p, start } = rim;
  const tracing = within(p, "rim");
  const closing = within(p, "close");
  /*
   * Just outside the box, not on its edge. The canvas is under the boxes,
   * so a stroke on the edge is half hidden by the face; two and a half
   * pixels out, the whole of it shows. The closing in happens on the box
   * itself (`molten.css`), over the face, so this only has to fade as it
   * hands over.
   */
  const out = 2.5;
  const rect = { x: rim.rect.x - out, y: rim.rect.y - out, w: rim.rect.w + out * 2, h: rim.rect.h + out * 2 };
  const r = BOX_RADIUS + out;
  const quarter = (Math.PI * r) / 2;
  const top = rect.w - 2 * r, tall = rect.h - 2 * r;
  const perimeter = 2 * (top + tall) + 4 * quarter;
  /*
   * Where along the perimeter the vine arrived, so the trace starts there.
   * Measured along the path as it is drawn below — top, right, bottom,
   * left, each straight followed by its corner — so the dash begins where
   * the vine does and not a corner's worth off.
   */
  const side = (() => {
    const ex = Math.max(rect.x, Math.min(rect.x + rect.w, start.x));
    const ey = Math.max(rect.y, Math.min(rect.y + rect.h, start.y));
    const dl = Math.abs(ex - rect.x), dr = Math.abs(rect.x + rect.w - ex), dt = Math.abs(ey - rect.y), db = Math.abs(rect.y + rect.h - ey);
    const m = Math.min(dl, dr, dt, db);
    const along = (v: number, max: number) => Math.max(0, Math.min(max, v));
    if (m === dt) return along(ex - (rect.x + r), top);
    if (m === dr) return top + quarter + along(ey - (rect.y + r), tall);
    if (m === db) return top + quarter + tall + quarter + along(rect.x + rect.w - r - ex, top);
    return 2 * top + tall + 3 * quarter + along(rect.y + rect.h - r - ey, tall);
  })();
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = PROCESS.done;
  c.lineWidth = 2.6;
  // A dash as long as it has got, from where the vine arrived; whole once
  // traced, and fading as the green closes in on the box and its own rim
  // arrives underneath.
  const len = perimeter * Math.max(0.01, closing > 0 ? 1 : tracing);
  /*
   * Two laps of the path, not one. A dash does not run on past the end of
   * a closed path and round again, so a vine arriving on the left — the
   * last leg — would get a trace cut off at the top-left corner, a few
   * pixels in. Round twice, and a dash that starts anywhere on the first
   * lap has the whole of the second to run into; the pattern's gap is two
   * laps long so it is drawn once.
   */
  c.setLineDash([len, perimeter * 2]);
  c.lineDashOffset = -side;
  c.beginPath();
  c.moveTo(rect.x + r, rect.y);
  for (let lap = 0; lap < 2; lap++) {
    c.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, r);
    c.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, r);
    c.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, r);
    c.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, r);
    c.lineTo(rect.x + r, rect.y);
  }
  c.globalAlpha = 1 - closing;
  c.stroke();
  c.restore();
}

/**
 * Where the boxes sit before anyone moves them.
 *
 * One chain, down and to the right, one step per iteration, with a shove
 * either way off the thread's own id — enough that no two rows line up and
 * the eye reads it as a place rather than a column.
 *
 * The sideways step used to come from how deep in the tree a thread was,
 * which is what made the timeline read as branches. It is the index now:
 * the chain leans as it goes, and the lean is the same for everyone.
 */
function scatter(nodes: ThreadNode[]): Map<string, Point> {
  const out = new Map<string, Point>();
  nodes.forEach((n, i) => {
    const jx = seed(n.thread.id) - 0.5;
    const jy = seed(`${n.thread.id}y`) - 0.5;
    out.set(n.thread.id, {
      x: 140 + (i % 3) * DRIFT.x * 0.62 + jx * 120,
      y: 130 + i * DRIFT.y + jy * 70,
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
    case "start":
      return { icon: <Flag className="size-3.5" />, kind: "where it began" };
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
// Which shape it is: wide for prose, square for a picture.
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
  const wires = React.useRef<HTMLCanvasElement>(null);
  /** The vines' cloud: two small elements per vine, one per strand, over the canvas (`syncLights`). */
  const lights = React.useRef<HTMLDivElement>(null);
  const lightEls = React.useRef(new Map<string, HTMLDivElement>());

  const [pan, setPan] = React.useState<Point>({ x: 0, y: 0 });
  /*
   * The zoom is the store's, not this component's.
   *
   * It was `React.useState(1)` here, which is why the minus and plus in the
   * header did nothing while the timeline was showing: they were moving the
   * store's number and this surface was reading its own. One number, and the
   * one control in the bar acts on whichever surface you are looking at.
   *
   * Only the zoom moves. The pan and the settle stay exactly where they were:
   * the settle animates `viewAt` straight onto the element for the length of
   * the move and lands on one `setZoom` at the end, which now happens to
   * write to the store, and reads no differently for it.
   */
  const zoom = useStudio((s) => s.zoom);
  const setZoom = useStudio((s) => s.setZoom);
  /** The settle in flight, if there is one. Zero when the view is state's again. */
  const settling = React.useRef(0);
  const [dragging, setDragging] = React.useState<{ id: string; at: Point } | null>(null);
  const [menu, setMenu] = React.useState<{ id: string; x: number; y: number } | null>(null);
  const [loop, setLoop] = React.useState<{ from: string; to: string } | null>(null);
  /** When a drag ended, so the click it fires can be ignored. */
  const dropped = React.useRef(0);

  /*
   * The timeline is one chain in the order things landed, and nothing else.
   *
   * It used to walk the tree `parentId` makes, which put a thread under
   * whatever was being worked in and fanned the whole thing into branches —
   * boxes with several vines into them and a shape that answered a question
   * nobody was asking. `parentId` is still on the thread and the panel's
   * tree still reads it; the timeline reads the record instead.
   */
  const all = React.useMemo<ThreadNode[]>(
    () => threads.map((thread) => ({ thread, children: [], depth: 0 })),
    [threads],
  );
  const home = React.useMemo(() => scatter(all), [all]);
  const forming = useForming(threads);
  const shownOf = React.useCallback((id: string) => forming.get(id) ?? 1, [forming]);
  const spotOf = React.useCallback(
    (id: string): Point => {
      if (dragging?.id === id) return dragging.at;
      return spots[`box:${id}`] ?? home.get(id) ?? { x: 140, y: 130 };
    },
    [dragging, spots, home],
  );

  /* ------------------------------------------------------- the view */
  /*
   * Where the view is looking, and getting it back to where the boxes are.
   *
   * Boxes are dragged wherever a person wants them, so the origin stops
   * meaning anything within a minute of opening this. The view settles on
   * the middle of the boxes themselves, weighted by size, with the whole set
   * held inside a margin so nothing sits on an edge — `timelineView.ts` does
   * that arithmetic and nothing else knows about it.
   *
   * It is worked out **on demand and from the store**: when the timeline
   * opens, when a drag ends, and when somebody presses centre. Never while a
   * box is moving, never off a measured rectangle. Carrying a box is the one
   * time the view must hold still, so a hand on anything cancels a settle in
   * flight.
   */
  const homeAt = React.useRef(home);
  homeAt.current = home;
  /*
   * Where the view is *now*, which is not always what state says.
   *
   * A settle writes the plot's transform straight to the element, a frame at
   * a time, and commits to state once at the end: a render a frame here is a
   * render of every box and a restart of the strand loop, and it measured at
   * half the frame rate. So this ref is the one answer to "where is the
   * view", and everything that needs it — the strands, a hand on the ground,
   * a box picked up — reads it here rather than from state.
   */
  const viewAt = React.useRef({ pan, zoom });
  if (!settling.current) viewAt.current = { pan, zoom };
  /* The vine painter, held so the observers below can reach the current one
     without being torn down and rebuilt every time it changes. */
  const paintAt = React.useRef<() => void>(() => {});

  const stopSettle = React.useCallback(() => {
    if (!settling.current) return;
    cancelAnimationFrame(settling.current);
    settling.current = 0;
    if (plot.current) plot.current.style.willChange = "";
    // Wherever it got to is where it is: state catches up so the plot's own
    // transform, the strands and the pointer all agree again.
    setPan(viewAt.current.pan);
    setZoom(viewAt.current.zoom);
  }, []);

  const settle = React.useCallback(() => {
    const box = host.current;
    if (!box) return;
    const s = useStudio.getState();
    const scattered = homeAt.current;
    // The store's own spots, and the scatter for anything never moved.
    const boxes = s.threads.map((t) => {
      const at = s.threadSpots[`box:${t.id}`] ?? scattered.get(t.id) ?? { x: 140, y: 130 };
      const size = sizeOf(t);
      return { x: at.x, y: at.y, w: size.w, h: size.h };
    });
    const to = settleView(boxes, { w: box.clientWidth, h: box.clientHeight });
    stopSettle();
    if (!to) return;
    const from = viewAt.current;
    if (sameView(from, to)) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (still) {
      setPan(to.pan);
      setZoom(to.zoom);
      return;
    }
    const grid = plot.current;
    if (!grid) return;
    // Promoted for the length of the move, so sliding six boxes is the
    // compositor's work and not a repaint of the plot every frame.
    grid.style.willChange = "transform";
    const began = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - began) / SETTLE_MS);
      const k = settleEase(u);
      const at = {
        pan: { x: from.pan.x + (to.pan.x - from.pan.x) * k, y: from.pan.y + (to.pan.y - from.pan.y) * k },
        zoom: from.zoom + (to.zoom - from.zoom) * k,
      };
      viewAt.current = at;
      // Straight to the element: no render, and the vines are inside it, so
      // they move with it rather than being repainted a frame at a time.
      grid.style.transform = `translate(${at.pan.x}px, ${at.pan.y}px) scale(${at.zoom})`;
      if (u < 1) {
        settling.current = requestAnimationFrame(step);
        return;
      }
      // Arrived. One render, so state, the element and the pointer agree.
      settling.current = 0;
      grid.style.willChange = "";
      setPan(to.pan);
      setZoom(to.zoom);
    };
    settling.current = requestAnimationFrame(step);
  }, [stopSettle]);

  /* Opening the timeline is one of the two moments it settles. One frame
     late, so the host has a size to fit against. */
  React.useEffect(() => {
    const id = requestAnimationFrame(() => settle());
    return () => {
      cancelAnimationFrame(id);
      stopSettle();
    };
  }, [settle, stopSettle]);

  /*
   * The floor is not this component's. One ground stands behind the board,
   * the timeline and Preview alike, so moving between them never changes the
   * weather; `ground.ts` says how it is moved.
   */
  // The ground is one instance behind every view (`StudioPage`), not one per
  // view: mounting a second here is what made Preview change the weather.

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

  /*
   * Every iteration joined to the one that landed before it, and to nothing
   * else. One chain, no branches, no forks — `chainOf` is the whole rule.
   */
  const joins = React.useMemo(() => chainOf(threads), [threads]);
  const cords = React.useMemo(
    () =>
      all
        .map((n) => ({ from: joins.get(n.thread.id) ?? null, to: n.thread.id, thread: n.thread }))
        .filter((c): c is { from: string; to: string; thread: Thread } => !!c.from && byId.has(c.from))
        .map((c) => ({
          from: c.from,
          to: c.to,
          tone: (isElement(c.thread) ? "pending" : c.thread.id === liveThreadId ? "live" : "landed") as StrandTone,
          /*
           * What it joins, at each end. A vine takes its colour from the two
           * boards it runs between, so one from a green iteration to a red
           * drawing is green where it leaves and red where it arrives.
           */
          ends: [
            isElement(byId.get(c.from)!) ? "drawing" : "iteration",
            isElement(c.thread) ? "drawing" : "iteration",
          ] as [VineEnd, VineEnd],
        })),
    [all, joins, byId, liveThreadId],
  );

  const openId = openThreadId;

  /*
   * A press anywhere off the card puts it away.
   *
   * The press on the ground below does this for the timeline's own surface;
   * this is the rest of the window — the bar, the shelf, the page behind —
   * because "off the card" means off the card, not off the timeline. Not the
   * card itself, not a box (a box press opens or closes its own), not the
   * panel showing the open card's prompts, and not a menu or dialog that is
   * open over it. The ground is left to its own handler, which knows a pan
   * from a press.
   */
  React.useEffect(() => {
    if (!openThreadId) return;
    const KEEP = '[data-box], [data-card], [data-timeline-panel], [data-side-panel-timeline], [data-thread-menu], [role="dialog"], [role="menu"], [data-radial]';
    const down = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (!el || el.closest(KEEP) || el.closest("[data-timeline]")) return;
      play("close");
      useStudio.getState().openThread(null);
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, [openThreadId]);
  const openTone: StrandTone = openId && byId.get(openId) && isElement(byId.get(openId)!) ? "pending" : "live";

  /*
   * Painting the vines, and how little of it.
   *
   * A vine is a still object: its shape is a function of where its two
   * boards are and nothing else. Repainting one that has not moved writes
   * exactly the pixels already under it, so the canvas is treated as
   * something that is kept rather than something that is redrawn.
   *
   * Two things make that work.
   *
   * **The canvas lives in the plot, not on the screen.** It is a child of
   * the transformed element, sized to the boards' own coordinates, so
   * panning and zooming move it the way they move a box — by the
   * compositor, with no paint at all. A pan used to repaint every vine
   * sixty times a second for as long as the hand was down.
   *
   * **Only what moved is repainted.** Every vine remembers where it was
   * drawn and what it reached; a paint compares that against where things
   * are now, clips to the union of the rectangles that differ, and redraws
   * only the vines that touch them. Dragging a board repaints its two or
   * three vines and leaves the other twenty-seven alone. When nothing
   * differs, a paint does nothing and costs nothing.
   *
   * A full repaint happens only when the canvas itself changes: the boards
   * spread past the edge of it, or the zoom crosses into a sharper one.
   */
  /** What is on the canvas now, so the next paint can tell what changed. */
  const drawn = React.useRef(new Map<string, Vine>());
  /** The canvas's own frame: where it sits in the boards' coordinates, and how finely. */
  const sheet = React.useRef({ x: 0, y: 0, w: 0, h: 0, scale: 0 });

  const paint = React.useCallback(() => {
    const el = wires.current;
    const c = el?.getContext("2d");
    const grid = plot.current;
    if (!el || !c || !grid) return;

    /* What should be on it, and how far each one reaches. */
    const want = new Map<string, Vine>();
    for (const cord of cords) {
      const [from, to] = ends(anchorOf(cord.from), anchorOf(cord.to));
      // The first stage of forming: the vine grows from the previous card.
      const grow = Math.min(1, shownOf(cord.to) / FORM.vine[1]);
      want.set(`${cord.from}>${cord.to}`, {
        from, to, tone: cord.tone, phase: seed(cord.to), ends: cord.ends, box: strandBounds(from, to), grow,
      });
    }
    /*
     * The rim, while a box is forming: where the vine arrives the rim starts
     * and is traced round the box in green, and as the work nears its end
     * the green closes in from the edges. Painted here, on the canvas, which
     * already knows where every box is and repaints only what changed.
     */
    for (const t of threads) {
      const p = shownOf(t.id);
      if (p < FORM.rim[0] || p >= FORM.surface[0]) continue;
      const a = anchorOf(t.id);
      const size = sizeOf(t);
      const rect = { x: a.left, y: a.top, w: size.w, h: size.h };
      const into = cords.find((cd) => cd.to === t.id);
      const start = into ? ends(anchorOf(into.from), anchorOf(into.to))[1] : { x: a.left, y: a.top };
      const pad = 12;
      want.set(`rim:${t.id}`, {
        from: start, to: start, tone: "live", phase: 0, ends: ["iteration", "iteration"], grow: 1,
        box: { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 },
        rim: { p, rect, start },
      });
    }
    /*
     * The card's own connector: the same construct, from the card's edge to
     * the box's. Measured rather than assumed, because the card is as tall
     * as what is in it — and it is two rectangles a paint, not a layout
     * pass a frame.
     */
    if (openId) {
      const a = anchorOf(openId);
      const origin = grid.getBoundingClientRect();
      const z = viewAt.current.zoom;
      const end: VineEnd = openTone === "pending" ? "drawing" : "iteration";
      for (const side of ["in", "out"] as const) {
        const card = grid.querySelector<HTMLElement>(`[data-card="${side}"][data-card-of="${openId}"]`);
        if (!card) continue;
        const r = card.getBoundingClientRect();
        const from = {
          x: (r.left - origin.left) / z + r.width / z / 2,
          y: side === "in" ? (r.bottom - origin.top) / z : (r.top - origin.top) / z,
        };
        const to = { x: a.cx, y: side === "in" ? a.top : a.bottom };
        want.set(`card:${side}`, {
          from, to, tone: openTone, phase: 0.5, ends: [end, end], box: strandBounds(from, to), grow: 1,
        });
      }
    }

    /*
     * The frame the canvas covers, snapped to a coarse grid so that dragging
     * a board about does not resize it — and a resize is the one thing that
     * costs a repaint of everything.
     */
    const STEP = 256;
    let x0 = 0;
    let y0 = 0;
    let x1 = 1;
    let y1 = 1;
    let first = true;
    for (const v of want.values()) {
      if (first) { x0 = v.box.x; y0 = v.box.y; x1 = v.box.x + v.box.w; y1 = v.box.y + v.box.h; first = false; continue; }
      x0 = Math.min(x0, v.box.x); y0 = Math.min(y0, v.box.y);
      x1 = Math.max(x1, v.box.x + v.box.w); y1 = Math.max(y1, v.box.y + v.box.h);
    }
    x0 = Math.floor(x0 / STEP) * STEP;
    y0 = Math.floor(y0 / STEP) * STEP;
    x1 = Math.ceil(x1 / STEP) * STEP;
    y1 = Math.ceil(y1 / STEP) * STEP;
    const w = Math.max(STEP, x1 - x0);
    const h = Math.max(STEP, y1 - y0);
    /*
     * How many device pixels a board's pixel gets. Zoomed in past 1 the
     * bitmap would be stretched, so it is drawn finer — in half steps, so
     * the wheel does not force a repaint on every notch. Past a few million
     * pixels the sheet is drawn coarser instead of eating the memory, which
     * only happens if somebody scatters boards across a very wide field.
     */
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const near = Math.min(2, Math.max(1, Math.ceil(viewAt.current.zoom * 2) / 2));
    const scale = Math.min(dpr * near, Math.sqrt(16e6 / (w * h)));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));

    const was = sheet.current;
    const moved = was.x !== x0 || was.y !== y0 || was.w !== w || was.h !== h || was.scale !== scale;
    if (moved) {
      el.width = cw;
      el.height = ch;
      el.style.left = `${x0}px`;
      el.style.top = `${y0}px`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      sheet.current = { x: x0, y: y0, w, h, scale };
      drawn.current.clear();
    }
    // Straight into the boards' own coordinates: no pan, no zoom, because
    // the element carrying this canvas already has both.
    c.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);

    /* What differs from what is on the canvas. */
    const mark = (v: Vine) => `${v.from.x},${v.from.y},${v.to.x},${v.to.y},${v.tone},${v.phase},${v.ends[0]},${v.ends[1]},${v.grow.toFixed(3)},${v.rim ? v.rim.p.toFixed(3) : ""}`;
    const dirty: { x: number; y: number; w: number; h: number }[] = [];
    const changed = new Set<string>();
    for (const [k, v] of want) {
      const had = drawn.current.get(k);
      if (had && mark(had) === mark(v)) continue;
      changed.add(k);
      if (had) dirty.push(had.box);
      dirty.push(v.box);
    }
    for (const [k, had] of drawn.current) if (!want.has(k)) dirty.push(had.box);
    if (!dirty.length) return;
    // The cloud over each vine is laid when the vine comes to rest, and not
    // while it moves (see `syncLights`).
    if (lights.current) syncLights(lights.current, lightEls.current, want, changed, !dragging);

    const hits = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
      a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

    c.save();
    // One clip over the union of the rectangles: a vine that only clips the
    // corner of one still has to be redrawn, but only inside it.
    c.beginPath();
    for (const r of dirty) {
      c.rect(r.x, r.y, r.w, r.h);
      c.clearRect(r.x, r.y, r.w, r.h);
    }
    c.clip();
    for (const v of want.values()) {
      if (!dirty.some((r) => hits(r, v.box))) continue;
      if (v.rim) { paintRim(c, v.rim); continue; }
      paintStrand(c, v.from, v.to, { tone: v.tone, phase: v.phase, ends: v.ends, grow: v.grow });
    }
    c.restore();

    drawn.current = want;
  }, [cords, anchorOf, openId, openTone, threads, shownOf, dragging]);
  // The open card can grow without this component rendering, and that moves
  // an end; this is how the observer below reaches the current painter.
  paintAt.current = paint;

  /*
   * Painted in the same commit as the boxes, so a vine and the board it
   * hangs off land together rather than a frame apart. Not keyed on the
   * pan: the canvas is inside the plot now and goes with it for free.
   */
  React.useLayoutEffect(() => {
    paint();
  }, [paint, zoom]);

  /*
   * The one thing that moves an end without a render: the open card growing
   * when what is in it finishes loading.
   */
  React.useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !openId) return;
    const grid = plot.current;
    if (!grid) return;
    const ro = new ResizeObserver(() => paintAt.current());
    for (const side of ["in", "out"] as const) {
      const card = grid.querySelector<HTMLElement>(`[data-card="${side}"][data-card-of="${openId}"]`);
      if (card) ro.observe(card);
    }
    return () => ro.disconnect();
  }, [openId]);

  /* -------------------------------------------------------- the pointer */
  const startDrag = (id: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const grid = plot.current;
    if (!grid) return;
    e.preventDefault();
    e.stopPropagation();
    const origin = grid.getBoundingClientRect();
    const from = spotOf(id);
    const z = viewAt.current.zoom;
    const grab = { x: (e.clientX - origin.left) / z - from.x, y: (e.clientY - origin.top) / z - from.y };
    const to = (ev: PointerEvent): Point => {
      const r = grid.getBoundingClientRect();
      return { x: (ev.clientX - r.left) / z - grab.x, y: (ev.clientY - r.top) / z - grab.y };
    };
    const from0 = { x: e.clientX, y: e.clientY };
    // Carrying a box: the view holds still until it is put down.
    stopSettle();
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
        // Put down somewhere new: the view goes to where the boxes now are.
        settle();
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
    stopSettle();
    const from = { x: e.clientX - viewAt.current.pan.x, y: e.clientY - viewAt.current.pan.y };
    let moved = false;
    const move = (ev: PointerEvent) => {
      // Six, not three: a press with a mouse moves a pixel or two on its own,
      // and a trackpad more, and a press that read as a pan closed nothing.
      if (Math.abs(ev.clientX - e.clientX) > 6 || Math.abs(ev.clientY - e.clientY) > 6) moved = true;
      setPan({ x: ev.clientX - from.x, y: ev.clientY - from.y });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      /*
       * A press on the ground puts the open card away.
       *
       * A card grows out of its box and covers a good part of the timeline,
       * and the only way to close it was to find the same box again and
       * press it a second time. Pressing anywhere else is what a person
       * does to mean "done with that" — but only a press, not the end of a
       * pan, or dragging the surface would close whatever was open.
       */
      if (!moved && useStudio.getState().openThreadId) {
        play("close");
        useStudio.getState().openThread(null);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onWheel = (e: React.WheelEvent) => {
    stopSettle();
    if (!e.ctrlKey && !e.metaKey) {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      return;
    }
    /* The store's setter takes a number, not an updater, and its own clamp is
       the clamp — the timeline used to hold itself to 0.4–1.8 while the bar's
       buttons ran to 0.25–2.5, which is two answers to one question. */
    setZoom(useStudio.getState().zoom * (e.deltaY < 0 ? 1.08 : 0.93));
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
      <div
        ref={plot}
        data-timeline-plot=""
        className="absolute left-0 top-0"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", width: 1, height: 1 }}
      >
        {/* Inside the plot, in the boards' own coordinates, so a pan moves it
            the way it moves a box — and first, so the boards sit over it. */}
        <canvas ref={wires} data-timeline-vines aria-hidden className="pointer-events-none absolute" />
        {/* The vines' cloud: over the canvas, under the boards. Filled by `syncLights`. */}
        <div ref={lights} data-timeline-light aria-hidden className="pointer-events-none absolute left-0 top-0" />

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
              forming={shownOf(t.id)}
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
          <p className="max-w-sm text-center text-[12px] leading-relaxed text-[oklch(0.7_0.06_152)]">
            Nothing has happened yet, which is not the same as something being wrong. The first thing you do to the
            board makes iteration one and it appears here; after that every ask that comes back and every drawing made
            real stands here too, and the strands between them are what one iteration made of the last. Add a part, or
            ask something below.
          </p>
        </div>
      ) : null}

      {/* Where you are, and the way back to the middle. */}
      <div className="pointer-events-auto absolute bottom-2 left-2 flex items-center gap-1 rounded-md border border-[oklch(0.36_0.07_152)] bg-[oklch(0.16_0.03_158/0.75)] px-1.5 py-1 text-[10px] text-[oklch(0.76_0.07_152)] backdrop-blur-sm">
        <GitBranch className="size-3" />
        <span className="num">{threads.length}</span>
        <span className="opacity-60">iterations</span>
        <span className="mx-1 h-3 w-px bg-[oklch(0.36_0.07_152)]" />
        <button
          type="button"
          data-timeline-centre=""
          className="tactile rounded px-1 hover:text-[oklch(0.92_0.1_152)]"
          // Centre used to mean the origin, which is only where the boxes
          // were before anybody touched them.
          onClick={(e) => { e.stopPropagation(); play("tap"); settle(); }}
        >
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
/** One thing on the vine canvas: a vine, or the rim of a forming box. */
interface Vine {
  from: Point;
  to: Point;
  tone: StrandTone;
  phase: number;
  ends: [VineEnd, VineEnd];
  box: { x: number; y: number; w: number; h: number };
  /** How much of it there is yet, 0..1. A vine into a forming box grows. */
  grow: number;
  /**
   * Not a vine at all: the rim of a forming box, traced round it in green
   * and then closing in. It lives in the same map because it is painted
   * by the same canvas, repainted by the same rule, and gone the same way.
   */
  rim?: { p: number; rect: { x: number; y: number; w: number; h: number }; start: Point };
}

/**
 * The cloud over the vines, kept in step with the canvas.
 *
 * A vine is painted once and its colour still moves, the way a box's does:
 * not by repainting, but by two small elements per vine over the canvas —
 * one per strand, at that strand's temperature — each clipped to its
 * strand's near side and carrying the construct's own cloud gliding on the
 * same keyframe as every box (`.molten-vine`, `molten.css`). The green cloud
 * is on the green strand and the red on the red, and the clips never
 * overlap, so no colour is ever laid over the other. This is the whole of
 * the bookkeeping: two elements per vine that exists, placed on the vine's
 * own box, their clips rewritten only when that vine's mark changed — which
 * is the same rule the canvas repaints by — and gone when the vine is. The
 * rim traces are the canvas's alone; no cloud is laid over them.
 *
 * AT REST ONLY. Measured: restyling an element whose child carries a
 * running animation costs about two milliseconds, and a drag restyles the
 * two vines on the moving board every pointer move — fifteen milliseconds
 * a move at thirty boards, which is the drag going from smooth to not. So
 * while a board is held, the cloud on its vines is lifted (one restyle) and
 * laid again when it is let go; and a vine still growing has no cloud until
 * it has grown, which is also the order the formation asks for — the vine
 * first, the weather after. `rest` says whether anything is held.
 */
function syncLights(host: HTMLDivElement, els: Map<string, HTMLDivElement>, want: Map<string, Vine>, changed: Set<string>, rest: boolean) {
  for (const [k, el] of els) {
    const of = want.get(k.slice(0, -2));
    if (of && !of.rim && of.tone !== "cut") continue;
    el.remove();
    els.delete(k);
  }
  const period = 512;
  for (const [k, v] of want) {
    if (v.rim || v.tone === "cut") continue;
    for (const b of [0, 1] as const) {
      const key = `${k}#${b}`;
      let el = els.get(key);
      if (!el) {
        el = document.createElement("div");
        el.className = "molten-vine";
        el.dataset.laid = "0";
        el.appendChild(document.createElement("i"));
        host.appendChild(el);
        els.set(key, el);
      }
      if (!rest || v.grow < 1) {
        // Lifted while the vine moves or grows: one change, then nothing.
        if (el.dataset.laid !== "0") { el.dataset.laid = "0"; el.style.clipPath = "inset(100%)"; }
        continue;
      }
      if (el.dataset.laid === "1" && !changed.has(k)) continue;
      el.dataset.laid = "1";
      /*
       * The strand's temperature, as one attribute and not as `.molten`.
       * Measured: any style change on an element carrying the construct's
       * class costs close to two milliseconds of recalc — its face is a
       * stack of colour-mixed shadows and two pseudo-elements — against a
       * tenth of that for a plain one. The light needs the construct's
       * cloud, not its face, so it takes the tile by name and nothing else.
       */
      const heat = v.ends[b] === "drawing" ? "ember" : "verdant";
      if (el.dataset.heat !== heat) el.dataset.heat = heat;
      const { box } = v;
      el.style.left = `${box.x}px`;
      el.style.top = `${box.y}px`;
      el.style.width = `${box.w}px`;
      el.style.height = `${box.h}px`;
      // The outline in the element's own coordinates: the same path, moved
      // by the box, because a curve does not care where its ends are.
      const d = strandEnvelope(
        { x: v.from.x - box.x, y: v.from.y - box.y },
        { x: v.to.x - box.x, y: v.to.y - box.y },
        b,
        { ends: v.ends, grow: v.grow, phase: v.phase, tone: v.tone },
      );
      el.style.clipPath = d ? `path("${d}")` : "inset(100%)";
      // One weather across the board: every element shows the tile at the
      // phase its own place gives it, so the cloud is continuous from vine
      // to vine and from a vine to the box beside it.
      const tile = el.firstElementChild as HTMLElement | null;
      if (tile) tile.style.backgroundPositionX = `${-(((box.x % period) + period) % period)}px`;
    }
  }
}

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
  /** How far it has formed, as shown: 0..1. One is formed. */
  forming: number;
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
  // The one pair, from `threads.ts`, so this and the bar's Finish key cannot
  // drift into two sets of colours for one idea.
  const done = processDone(thread.state);
  return (
    <span
      data-state={done ? "done" : thread.state}
      aria-label={done ? "finished" : thread.state === "cut" ? "given up" : "still running"}
      title={done ? "finished" : thread.state === "cut" ? "given up" : "still running"}
      className="ml-auto size-2 shrink-0 rounded-full"
      style={{
        background: done ? PROCESS.done : PROCESS.open,
        boxShadow: `0 0 6px ${done ? PROCESS.doneGlow : PROCESS.openGlow}`,
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
      /*
       * A mark, not a title.
       *
       * It was a chip reading "this iteration" across the top of every box,
       * which is the widest thing on the box and so read as its heading —
       * and on an element piece it pushed the name of the part off the end
       * entirely. What the iteration made is the headline; where you are
       * working is a flag beside it, and the words live in the tooltip.
       */
      className="grid size-4 shrink-0 place-items-center rounded-sm border transition-[background,border-color]"
      style={{
        borderColor: on ? "oklch(0.78 0.17 152)" : "oklch(0.38 0.09 152)",
        background: on ? "oklch(0.6 0.17 152)" : "transparent",
        color: on ? "oklch(0.16 0.026 152)" : "oklch(0.6 0.09 152)",
      }}
    >
      <Flag className="size-2.5" />
      <span className="sr-only">this iteration</span>
    </button>
  );
}

function IterationBox({
  thread, at, forming, live, open, pinned, current, dragging, onOpen, onDragStart, onMenu,
}: {
  thread: Thread;
  at: Point;
  forming: number;
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
        /*
         * A construct of molten light, not a box with a red border and a glow
         * behind it. The stops, the veining and the five animations are the
         * shared surface in `core/ui/molten.css` — the same one the element
         * cards use, so the two are one language rather than two reds that
         * nearly match. Everything here is which one and how deep.
         */
        className={cn(
          moltenClass("verdant"),
          "flex w-full cursor-grab flex-col gap-1 rounded-lg p-2 text-left transition-[box-shadow,transform] active:cursor-grabbing",
        )}
        data-forming={forming < 1 ? "" : undefined}
        style={{
          minHeight: BOX.h,
          ...moltenSeed(thread.id),
          ...(forming < 1 ? (formVars(forming) as React.CSSProperties) : {}),
          color: "oklch(0.93 0.055 150)",
          // Depth is the shadow under it and the lift when it is picked up;
          // the light in it comes from the surface, not from here.
          // The weight under it, and the heat it throws: the construct's own
          // shadow, because paint containment clips anything inside it.
          // Weight under it and nothing thrown outward: the rim is self-lit
          // and the reference has no glow past it.
          boxShadow: open ? "0 10px 30px oklch(0 0 0 / 0.55)" : "0 6px 18px oklch(0 0 0 / 0.45)",
          filter: open ? "brightness(1.14)" : live ? "brightness(1.06)" : "none",
          transform: dragging ? "scale(1.02)" : "none",
        }}
      >
        {/* The edge, the flare and the ember, all on one node. */}
        <span data-molten="" />
        {/*
          The line above the headline is a label, and it is sized like one:
          what the iteration made is the biggest thing on the box.
        */}
        <span className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.14em] text-[oklch(0.66_0.07_152)]">
          {icon}
          {kind}
          {pinned ? <Pin className="size-2.5 fill-current" /> : null}
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
            <span data-headline="" className="line-clamp-2 block text-[13px] font-medium leading-snug text-[oklch(0.95_0.05_150)]">{headlineOf(thread)}</span>
            {/*
              No clock.
              
              The time an iteration landed answers a question nobody asks:
              the chain says what came after what, and the first box says
              where it began by being first. A timestamp on every box was one
              more thing to read that said nothing.
            */}
            <span className="mt-1 block text-[9px] text-[oklch(0.64_0.07_152)]">
              {thread.mode}
              {thread.changes.length > 1 ? ` · and ${thread.changes.length - 1} more` : ""}
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
  thread, at, forming, open, pinned, current, dragging, onOpen, onDragStart, onMenu,
}: {
  thread: Thread;
  at: Point;
  forming: number;
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
        /* The same construct at the ember temperature: `core/ui/molten.css`. */
        className={cn(
          moltenClass("ember"),
          "flex w-full cursor-grab flex-col gap-1 rounded-lg p-2 text-left transition-[box-shadow,transform] active:cursor-grabbing",
        )}
        data-forming={forming < 1 ? "" : undefined}
        style={{
          minHeight: PIECE.h,
          ...moltenSeed(thread.id),
          ...(forming < 1 ? (formVars(forming) as React.CSSProperties) : {}),
          color: "oklch(0.95 0.05 22)",
          boxShadow: open ? "0 10px 28px oklch(0 0 0 / 0.55)" : "0 5px 16px oklch(0 0 0 / 0.45)",
          filter: open ? "brightness(1.14)" : "none",
          transform: dragging ? "scale(1.03)" : "none",
        }}
      >
        <span data-molten="" />
        {/*
          The drawing is the subject.
          
          It was a thumbnail beside a line of text, which made the words the
          thing and the picture an illustration of them — and for a drawing
          that is backwards: the line he drew is what he recognises from
          across the screen, and "Bird" is only what it ended up being
          called. So the mark is large and central, and the name and the
          small line sit under it, supporting it.
        */}
        {/*
          No label. The red box used to say "drawing" across its top, and the
          drawing is right there under it — a caption for a picture you are
          already looking at. The row keeps only what does something: the
          pin, the flag and the state, hard against the right edge.
        */}
        <span className="flex items-center justify-end gap-1.5 text-[8px] text-[oklch(0.7_0.09_18)]">
          {pinned ? <Pin className="size-2.5 fill-current" /> : null}
          <CurrentButton thread={thread} on={current} />
          <StateMark thread={thread} />
        </span>
        <span className="flex min-h-0 flex-1 items-center justify-center py-0.5">
          <Drawn sketch={thread.sketch} size={62} tone="oklch(0.9 0.17 22)" />
        </span>
        <span className="block text-center">
          <span data-headline="" className="line-clamp-1 block text-[13px] font-medium leading-snug text-[oklch(0.95_0.05_22)]">{name}</span>
          <span className="mt-0.5 block text-[9px] text-[oklch(0.68_0.07_18)]">
            {thread.changes.length > 1 ? `and ${thread.changes.length - 1} more` : "made real"}
          </span>
        </span>
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

export function Drawn({ sketch, size, tone }: { sketch?: { strokes: [number, number][][] } | null; size: number; tone: string }) {
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
      <span className="grid shrink-0 place-items-center rounded" style={{ width: W, height: H, background: "oklch(0.18 0.04 152)", border: "1px solid oklch(0.3 0.078 152)" }}>
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
      style={{ background: "oklch(0.16 0.034 152)", border: "1px solid oklch(0.3 0.078 152)" }}
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
            fill={lit ? "oklch(0.72 0.17 152 / 0.6)" : "oklch(0.62 0.131 152 / 0.3)"}
            stroke={lit ? "oklch(0.9 0.17 152)" : "oklch(0.62 0.144 152 / 0.75)"}
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
 * Up from the top edge: Input — the prompt, and the drawing when there
 * was one. Down from the bottom: Output — the answer, and
 * what it changed on the board. Both joined to the box by the connector
 * the strands are made of, so it reads as the box extending rather than a
 * panel arriving.
 */
function Card({ thread, side }: { thread: Thread; side: "in" | "out" }) {
  const threads = useStudio((s) => s.threads);
  const parent = thread.parentId ? threads.find((t) => t.id === thread.parentId) ?? null : null;
  const changed = React.useMemo(() => diffDocs(parent?.doc, thread.doc), [parent, thread]);
  const element = isElement(thread);
  /*
   * The reading family, not the card family.
   *
   * These grew out of the box in the same red or green as the box, rounded
   * the same, lit the same, and read as two more cards. They are not cards:
   * they are where you read what went into one and what came out. So the
   * face is near-neutral dark with only a tint of the family, the colour
   * lives in a hairline rim and the headline, there is no lift and no glow,
   * and the corners are squarer than anything on the timeline that is a
   * thing. Same family, different member.
   */
  const skin = element
    ? { face: "oklch(0.15 0.018 18)", rim: "oklch(0.46 0.157 18 / 0.7)", text: "oklch(0.92 0.02 18)", dim: "oklch(0.72 0.106 18)" }
    : { face: "oklch(0.145 0.016 152)", rim: "oklch(0.42 0.118 152 / 0.7)", text: "oklch(0.92 0.02 152)", dim: "oklch(0.7 0.091 152)" };
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
        data-reading=""
        className="relative rounded-[4px] border p-2.5"
        /* No entrance: a card that grows on arrival is a performance, and this is
   something you open fifty times an hour. No lift either: it is a page, not
   a thing standing on the ground. */
        style={{ background: skin.face, borderColor: skin.rim, color: skin.text }}
      >
        {/*
          One word. "What went in" and "what came out" were sentences about
          the two halves; the halves are Input and Output and that is all the
          headline says. The copy control sits off the headline, in the
          corner, because a headline with a button in it is a toolbar.
        */}
        <p data-reading-head={side} className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.18em]" style={{ color: skin.dim }}>
          {side === "in" ? "Input" : "Output"}
        </p>
        <span className="absolute right-2 top-1.5">
          <CopyBit text={side === "in" ? thread.ask : thread.answer} />
        </span>
        {side === "in" ? (
          <WentIn thread={thread} skin={skin} element={element} />
        ) : (
          <div className="space-y-2">
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed">{thread.answer || "nothing came back"}</pre>
            <Bill thread={thread} skin={skin} />
            <div className="border-t pt-1.5" style={{ borderColor: skin.rim }}>
              <p className="mb-1 text-[9px] uppercase tracking-[0.16em]" style={{ color: skin.dim }}>what changed on the board</p>
              {/*
                The thing, not a description of it.
                
                "drew Diagonal divider at 297 × 66" is a receipt. What a person
                wants from a card that says what changed is to see what it
                changed into, and the part is right there on the board — so it
                is rendered, still, at the size the card has room for. The
                line of text stays underneath rather than instead: the picture
                says which one it is, the words say what was done to it.
              */}
              <Made thread={thread} skin={skin} />
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

/**
 * What this iteration cost and how long it took, on the card.
 *
 * The card named the model and stopped there, so a person drawing on the
 * deploy had no way at all to find out what a drawing costs them — the only
 * place that number existed was the bench. Claude per token and the renderer
 * per press, added, with the wait measured rather than guessed, and who was
 * paid said out loud: that last part is the only way to tell from the
 * outside whether a drawing reached the renderer at all.
 */
function Bill({ thread, skin }: { thread: Thread; skin: { rim: string; dim: string; text: string } }) {
  const u = thread.usage;
  if (!u || (!u.cost && !u.ms && !u.calls)) return null;
  const head = saySpend({ dollars: u.cost ?? 0, ms: u.ms ?? 0, calls: u.calls ?? 0 });
  const who = sayWhere({ dollars: u.cost ?? 0, ms: u.ms ?? 0, calls: u.calls ?? 0, claude: u.claude, renderer: u.renderer });
  return (
    <div data-bill={thread.id} className="border-t pt-1.5" style={{ borderColor: skin.rim }}>
      <p className="mb-0.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em]" style={{ color: skin.dim }}>
        <Coins className="size-3" /> what it cost
      </p>
      <p className="num text-[11px]" style={{ color: skin.text }}>{head}</p>
      {who ? <p className="num text-[10px]" style={{ color: skin.dim }}>{who}</p> : null}
      {/*
        And then each pass on its own line.

        A drawing lands twice — the pass that shows at once, and the model
        that refines it — and they are two charges. The total above cannot
        say which of them was expensive, and one of them routinely has no
        price at all, because Replicate publishes no rate for the models the
        second pass runs on. A line that says the cost was not reported is
        the true thing to put there.
      */}
      {u.passes?.length ? (
        <ul className="mt-1 space-y-0.5 border-t pt-1 num text-[10px]" style={{ borderColor: skin.rim, color: skin.dim }}>
          {u.passes.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      ) : null}
      {thread.model ? <p className="mt-0.5 text-[9px]" style={{ color: skin.dim }}>{thread.model}</p> : null}
    </div>
  );
}

/**
 * What went in — and, where a part was drawn on more than once, every go.
 *
 * A part that was drawn, looked at, and drawn again has a history of inputs,
 * and the card showed only the one belonging to this iteration: the others
 * were on their own boards elsewhere on the timeline, so "which drawing led
 * to this" could not be answered from the thing it led to. They are paged
 * through here instead, oldest first, one to a page — stepping back through
 * the attempts on the same part rather than stacking them or replacing one
 * with the next.
 *
 * A part drawn once has no pager, because one page is not a sequence.
 */
function WentIn({ thread, skin, element }: { thread: Thread; skin: { rim: string; dim: string; text: string }; element: boolean }) {
  const threads = useStudio((s) => s.threads);
  /*
   * The goes: every iteration that worked on the same part, in the order
   * they happened. Keyed on what each one made, which is the only thing that
   * says two drawings are about one part — the chain does not, because a go
   * can hang off anywhere.
   */
  const goes = React.useMemo(
    () => (thread.madeId ? threads.filter((t) => t.madeId === thread.madeId) : [thread]),
    [threads, thread],
  );
  const mine = Math.max(0, goes.findIndex((t) => t.id === thread.id));
  const [page, setPage] = React.useState(mine);
  // Opening a different iteration lands on that one's own go, not on
  // whichever page was last looked at.
  React.useEffect(() => setPage(mine), [mine, thread.id]);
  const at = goes[Math.min(page, goes.length - 1)] ?? thread;
  const many = goes.length > 1;
  const step = (by: number) => setPage((p) => Math.min(goes.length - 1, Math.max(0, p + by)));

  return (
    <div className="space-y-1.5">
      {many ? (
        <div data-goes={goes.length} className="flex items-center gap-1.5 text-[9px]" style={{ color: skin.dim }}>
          <button
            type="button"
            data-go-back=""
            disabled={page === 0}
            onClick={(e) => { e.stopPropagation(); play("tick"); step(-1); }}
            className="tactile grid size-4 place-items-center rounded-sm border disabled:opacity-35"
            style={{ borderColor: skin.rim }}
          >
            <ChevronLeft className="size-3" />
          </button>
          <span className="num">go {page + 1} of {goes.length}</span>
          {at.id === thread.id ? <span style={{ color: skin.text }}>· this one</span> : null}
          <button
            type="button"
            data-go-next=""
            disabled={page >= goes.length - 1}
            onClick={(e) => { e.stopPropagation(); play("tick"); step(1); }}
            className="tactile grid size-4 place-items-center rounded-sm border disabled:opacity-35"
            style={{ borderColor: skin.rim }}
          >
            <ChevronRight className="size-3" />
          </button>
        </div>
      ) : null}
      <div className="flex items-start gap-2">
        {element || at.sketch ? (
          <span className="shrink-0 rounded border p-1" style={{ borderColor: skin.rim, background: "oklch(0.15 0.04 18)" }}>
            <Drawn sketch={at.sketch} size={72} tone="oklch(0.92 0.17 18)" />
          </span>
        ) : null}
        <p className="max-h-40 min-w-0 flex-1 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed">{at.ask || "nothing was typed"}</p>
      </div>
      {many && at.id !== thread.id ? (
        <p className="text-[9px]" style={{ color: skin.dim }}>what that one led to: {at.changes[0] ?? "nothing recorded"}</p>
      ) : null}
      {element && thread.madeId ? <EditHere id={thread.madeId} skin={skin} /> : null}
    </div>
  );
}

/**
 * Edit the element from its card.
 *
 * The card showed the element and offered two roads back to the board to
 * change it. The things a person most often wants to change — what it is
 * called and what it is meant to be — need no board: they are written on
 * the part from here, at once, and "draw it again with these words" puts
 * the same drawing back on the queue with the new words beside it, so the
 * part is reshaped rather than a second one made. The size is shown, not
 * edited: a size is set by hand on the board, where the hand is.
 */
function EditHere({ id, skin }: { id: string; skin: { rim: string; dim: string; text: string } }) {
  const node = useStudio((s) => s.nodes.find((n) => n.id === id) ?? null);
  const frameWidth = useStudio((s) => s.frameWidth);
  const [label, setLabel] = React.useState(node?.label ?? "");
  const [prompt, setPrompt] = React.useState(node?.prompt ?? "");
  // Another card, or the part renamed on the board: the fields follow.
  React.useEffect(() => {
    setLabel(node?.label ?? "");
    setPrompt(node?.prompt ?? "");
  }, [node?.id, node?.label, node?.prompt]);
  if (!node) {
    return <p className="border-t pt-1.5 text-[9px]" style={{ borderColor: skin.rim, color: skin.dim }}>the part this made is no longer on the board</p>;
  }
  const commit = () => {
    const name = label.trim() || node.label;
    if (name === node.label && prompt === node.prompt) return;
    useStudio.getState().updateNode(node.id, { label: name, prompt });
  };
  const again = () => {
    commit();
    if (!node.sketch) return;
    const sketch = { ...node.sketch, words: prompt.trim() };
    play("confirm");
    useStudio.getState().enqueueDraw({
      nodeId: node.id,
      at: null,
      frameWidth,
      sketch,
      picture: pictureOf(sketch.strokes),
      label: `Reshaping ${label.trim() || node.label}`,
    });
  };
  const field = "w-full rounded-sm border bg-transparent px-1.5 py-0.5 text-[11px] leading-snug outline-none focus:ring-1";
  return (
    <div
      data-edit-here={node.id}
      className="space-y-1 border-t pt-1.5"
      style={{ borderColor: skin.rim }}
      // The card stops presses reaching the ground; the keys must not reach
      // the board's shortcuts either, or typing a name would delete a part.
      onKeyDown={(e) => e.stopPropagation()}
    >
      <p className="text-[9px] uppercase tracking-[0.16em]" style={{ color: skin.dim }}>edit it here</p>
      <input
        data-edit-label=""
        aria-label="What it is called"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className={field}
        style={{ borderColor: skin.rim, color: skin.text }}
      />
      <textarea
        data-edit-prompt=""
        aria-label="What it is meant to be"
        rows={2}
        value={prompt}
        placeholder="what it is meant to be"
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={commit}
        className={`${field} resize-none`}
        style={{ borderColor: skin.rim, color: skin.text }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-edit-again=""
          disabled={!node.sketch}
          onClick={again}
          className="tactile rounded-sm border px-2 py-0.5 text-[10px] disabled:opacity-40"
          style={{ borderColor: skin.rim, color: skin.text }}
          title={node.sketch ? "The same drawing, back on the queue, with these words beside it" : "This part was not drawn, so there is nothing to draw again"}
        >
          Draw it again with these words
        </button>
        <span className="num text-[9px]" style={{ color: skin.dim }}>{node.w} × {node.h}</span>
      </div>
    </div>
  );
}

/**
 * The part this iteration made, rendered still, at card size.
 *
 * The board's own renderer (`Block`) with `mode="board"`, scaled to fit:
 * nothing interactive, no second way of drawing a part, and it follows the
 * palette because it *is* the part. Nothing when the part has since been
 * deleted — a picture of something that is not there any more would be worse
 * than the line of text alone.
 */
function Made({ thread, skin }: { thread: Thread; skin: { rim: string; dim: string } }) {
  const nodes = useStudio((s) => s.nodes);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const node = thread.madeId ? nodes.find((n) => n.id === thread.madeId) ?? null : null;
  const theme = React.useMemo(() => themeFrom(format, look), [format, look]);
  const palette = React.useMemo(() => resolvePalette(look?.palette), [look?.palette]);
  if (!node) return null;
  const W = 380;
  const H = 96;
  // Fit, never crop: a part twice the card's width shrinks rather than
  // showing its left half, which for most parts is an empty margin.
  const scale = Math.min(W / Math.max(1, node.w), H / Math.max(1, node.h), 1);
  return (
    /*
     * Inset, on a dark surround.
     *
     * The part keeps its own page surface, because that is how it really
     * looks and a repainted preview would be a lie about it — but a pale
     * rectangle edge to edge on a dark card was the loudest thing on the
     * card. Sitting it in from the edges with the card's own ground round it
     * makes it a picture *on* the card rather than a hole through it.
     */
    <div
      className="mb-1.5 rounded-md p-1.5"
      style={{ background: "oklch(0.16 0.03 20 / 0.55)" }}
    >
      <div
        data-made-preview={node.id}
        aria-hidden
        inert
        className="grid place-items-center overflow-hidden rounded-sm border"
        style={{ height: H, borderColor: skin.rim, background: theme.surface }}
      >
        <div style={{ width: node.w, height: node.h, transform: `scale(${scale})`, transformOrigin: "center" }}>
          <Block node={node} t={theme} palette={palette} page={{ w: node.w, h: node.h }} mode="board" size={{ w: node.w, h: node.h }} />
        </div>
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
          background: on ? "oklch(0.7 0.17 152)" : "oklch(0.22 0.066 152)",
          border: `1px solid ${on ? "oklch(0.86 0.17 152)" : "oklch(0.5 0.157 152)"}`,
          color: on ? "oklch(0.16 0.026 152)" : "oklch(0.82 0.157 152)",
          boxShadow: on ? "0 0 14px oklch(0.7 0.17 152 / 0.6)" : "0 2px 8px oklch(0 0 0 / 0.5)",
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
        "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-[oklch(0.3_0.07_152)]",
        danger ? "text-[oklch(0.8_0.14_25)]" : "text-[oklch(0.9_0.04_152)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div
      data-thread-menu=""
      data-box-menu=""
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-50 w-56 rounded-lg border p-1 shadow-pop"
      style={{ left: at.x, top: at.y, background: "oklch(0.21 0.059 152)", borderColor: "oklch(0.4 0.118 152)" }}
    >
      <p className="truncate px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[oklch(0.66_0.08_152)]">{thread.mode}</p>
      {item("Open it below", <Wand2 className="size-3" />, () => useStudio.getState().openThread(thread.id))}
      {item(live ? "The board is on this" : "Stand on it", <MapPin className="size-3" />, () => useStudio.getState().standOn(thread.id))}
      {item(pinned ? "Unpin it" : "Pin it", pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />, () => useStudio.getState().togglePinnedThread(thread.id))}
      {item("Copy the prompt", <Sparkles className="size-3" />, () => void navigator.clipboard?.writeText(thread.ask))}
      {item("Copy what came back", <Sparkles className="size-3" />, () => void navigator.clipboard?.writeText(thread.answer))}
      <div className="my-1 h-px bg-[oklch(0.32_0.06_152)]" />
      {item("Prune this iteration", <Scissors className="size-3" />, () => useStudio.getState().pruneThread(thread.id), true)}
    </div>
  );
}
