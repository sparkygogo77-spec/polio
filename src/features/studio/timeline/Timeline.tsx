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
import { MapPin } from "lucide-react";
import { play } from "@/core/audio/engine";
import { columnHolds, hold, sameView, settleEase, settleView, zoomCeiling, SETTLE_MARGIN, SETTLE_MIN_ZOOM, SETTLE_MS, type View } from "../timelineView";
import { Lanes } from "../Lanes";
import { laneRects } from "../lanes";
import { paintStrand, strandBounds, type Point, type StrandTone, type VineEnd } from "../strand";
import { REST, letGo, pickUp, still, step, type Rope } from "../tugSpring";
import { chainOf, type Thread, type ThreadNode } from "../threads";
import { FORM } from "../formation";
import { useStudio } from "../store";
import { BOX, GAP, seed, useForming, paintRim, scatter, isElement, sizeOf } from "./layout";
import { Vine, syncLights, ends } from "./vines";
import { Standing } from "./IterationBox";
import { VineCut, BoxMenu } from "./cards";

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
/**
 * The view a person put the timeline in, kept across a close and reopen.
 *
 * Not state — state dies with the mount, and the mount is exactly what
 * Finish tears down. Not the store either: this is where somebody is
 * looking, not part of the site, and it has no business in the saved
 * document. Cleared by pressing centre, which is how a person asks for the
 * fit back.
 */
export let ownView: View | null = null;
/** Whether they have taken hold of it at all. */
export let owns = false;
/**
 * The zoom the fit last chose, kept beside the view it belongs to.
 *
 * It is how the door tells a pan from a zoom. A view that has lost the
 * column was either panned away — same zoom as the fit, nothing in it worth
 * keeping, so the fit takes it back — or zoomed into on purpose, which is a
 * thing a person does and must survive the trip. Guessing from whether the
 * column still fits got that wrong: eight updates zoomed to 0.688 fit
 * perfectly well and came back as 0.372.
 */
export let fitZoom = 0;

export function Timeline() {
  const threads = useStudio((s) => s.threads);
  const liveThreadId = useStudio((s) => s.liveThreadId);
  const openThreadId = useStudio((s) => s.openThreadId);
  const spots = useStudio((s) => s.threadSpots);
  const pinned = useStudio((s) => s.pinnedThreads);

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
  /*
   * The board's shape, so the chain wraps to the board rather than to a
   * guess. Read once a frame after mount like everything else here; before
   * that there is nothing to measure and 2 is close enough to a board.
   */
  const [aspect, setAspect] = React.useState(2);
  const home = React.useMemo(() => scatter(all, aspect, BOX), [all, aspect]);
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
  /*
   * Once it is theirs, it stays theirs, at wherever it has got to — but not
   * before the view has been put back.
   *
   * The zoom is the store's and the store is shared with the board, so on the
   * first render after Finish this ref holds *the board's* zoom, not the
   * timeline's. Writing that into the held view is what made a reopened
   * timeline come back at 0.58 — the board's number — instead of either the
   * fit or the person's own. So nothing is kept until the effect below has
   * restored or settled.
   */
  const settled = React.useRef(false);
  if (owns && settled.current) ownView = viewAt.current;
  /* The vine painter, held so the observers below can reach the current one
     without being torn down and rebuilt every time it changes. */
  const paintAt = React.useRef<() => void>(() => {});

  /*
   * What the pointer is doing to a vine, and what a press did to one.
   *
   * HIS WORDS: "the line in the middle of the vines is hoverable ... i
   * would rather no line, the vine maybe pulls a little when you hover ...
   * when click vanishes and fades away and disintegrates from the middle."
   *
   * Both live in refs and neither is state. A vine reacting to the pointer
   * and a vine coming apart are things the canvas does at the frame rate;
   * putting them in state would re-render every box on the timeline to
   * move one ribbon. The painter reads them, and both are named by the
   * *later* of the two boards a vine joins, which is how every vine is
   * keyed here.
   */
  /*
   * Whether something is in hand.
   *
   * A box being carried holds the view still — that is the rule the board
   * keeps and the suite measures — and the fit runs from two places that
   * do not know about the drag: the run finishing its arrival, and the
   * room changing size. Either one landing mid-carry moves the board out
   * from under the hand. A ref rather than the state, so reading it costs
   * no dependency and no re-render.
   */
  const inHand = React.useRef(false);
  inHand.current = !!dragging;

  /*
   * THE ROPES, one per vine a hand has touched, and the loop that swings them.
   *
   * It was `tugAt: string | null` — the one vine under the pointer — and the
   * painter read it as 1 or 0. That is a second resting position, which is
   * exactly what he did not want: "the animation just makes it immediately
   * flex … the hover should make it almost like kind of pulse and almost
   * like a rope being picked up on hover then dropped back down."
   *
   * So a vine is a mass on a spring (`tugSpring.ts`) and hovering is an
   * event that kicks it. A map rather than one name, because a vine let go
   * is still swinging while the hand is on the next one, and both have to
   * be drawn. A rope that has gone quiet is deleted from the map, so at
   * rest this is empty and the loop is not running.
   */
  const ropes = React.useRef(new Map<string, Rope>());
  const swinging = React.useRef(0);
  const lastFrame = React.useRef(0);

  /**
   * The loop: step every rope, repaint once, stop when they are all quiet.
   *
   * One frame for all of them, not one per vine — the painter draws the
   * whole canvas anyway, so a second rope costs arithmetic and no drawing.
   * `dt` is real elapsed time rather than a fixed step so the motion takes
   * the same wall-clock time on a 60Hz screen and a 120Hz one, and
   * `tugSpring.step` caps it so a backgrounded tab cannot integrate one
   * enormous frame and throw a vine off the board.
   */
  const swing = React.useCallback(() => {
    if (swinging.current) return;
    lastFrame.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastFrame.current) / 1000;
      lastFrame.current = now;
      for (const [id, r] of ropes.current) {
        const next = step(r, dt);
        if (still(next)) ropes.current.delete(id);
        else ropes.current.set(id, next);
      }
      paintAt.current();
      swinging.current = ropes.current.size ? requestAnimationFrame(tick) : 0;
    };
    swinging.current = requestAnimationFrame(tick);
  }, []);
  React.useEffect(() => () => { if (swinging.current) cancelAnimationFrame(swinging.current); }, []);

  /**
   * A hand arrives on a vine, or leaves it.
   *
   * Neither sets a position. The kick goes into whatever velocity the rope
   * already has, so a vine picked up while it is still swinging carries on
   * from where it actually is — his second consequence, "the second pick-up
   * starts from wherever the rope actually is" — and there is no way for
   * two hovers in a row to stack or to jerk.
   */
  const tug = React.useCallback((id: string, held: boolean) => {
    const was = ropes.current.get(id) ?? REST;
    ropes.current.set(id, held ? pickUp(was) : letGo(was));
    swing();
  }, [swing]);

  /** The deferred question the door asks once the boxes are there. */
  const rescue = React.useRef<{ cancel: () => void } | null>(null);

  const cutAt = React.useRef<{ id: string | null; p: number }>({ id: null, p: 0 });
  const cutting = React.useRef(0);

  /**
   * Cut one, and watch it go.
   *
   * The break opens from the middle over `CUT_MS`, the two ends draw back
   * crumbling, and the iteration goes when there is nothing left of the
   * vine — not before, or the box would vanish while its own vine was
   * still coming apart, which is two things happening where he asked for
   * one.
   */
  const CUT_MS = 460;
  const cutVine = React.useCallback((id: string) => {
    if (cutting.current) return;
    play("deny");
    ropes.current.delete(id);
    cutAt.current = { id, p: 0 };
    const began = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - began) / CUT_MS);
      cutAt.current = { id, p };
      paintAt.current();
      if (p < 1) { cutting.current = requestAnimationFrame(tick); return; }
      cutting.current = 0;
      cutAt.current = { id: null, p: 0 };
      useStudio.getState().pruneThread(id);
    };
    cutting.current = requestAnimationFrame(tick);
  }, []);
  React.useEffect(() => () => { if (cutting.current) cancelAnimationFrame(cutting.current); }, []);

  /*
   * The view becomes the person's the moment they move it.
   *
   * A flag rather than a snapshot: taking the snapshot here would take it
   * *before* the move — `viewAt` is synced from state, and the state this
   * handler is about to set has not rendered yet — so what got kept was the
   * view they were leaving. The sync below keeps it current instead.
   */
  const claim = React.useCallback(() => { owns = true; }, []);

  /**
   * WHERE THE COLUMN STANDS, in the boards' own coordinates.
   *
   * The store's own spots, and the scatter for anything never moved — at
   * the height each box REALLY stands, not the height the catalogue says.
   *
   * A box is as tall as what it holds. The fit used the nominal size for
   * every box and the measured one for the last, which the fan hangs off;
   * measured, the difference is about 20px a box (126 against 106), so a
   * column of three was fitted 60px shorter than it is and the top of it
   * went over the frame's own top edge. He measured exactly that on the
   * deploy: the first card 5px above the frame. Anything not on screen yet
   * — a box still waiting its turn to arrive — has no height to read and
   * keeps the nominal one, which is what it will stand at.
   *
   * Its own callback because two things ask it now: the fit, and the door
   * back in, which has to know whether the view it is about to hand back
   * still has the column on the screen.
   */
  const columnOf = React.useCallback((box: HTMLElement) => {
    const s = useStudio.getState();
    const scattered = homeAt.current;
    return s.threads.map((t) => {
      const at = s.threadSpots[`box:${t.id}`] ?? scattered.get(t.id) ?? { x: 140, y: 130 };
      const size = sizeOf(t);
      const real = box.querySelector<HTMLElement>(`[data-box="${t.id}"]`)?.offsetHeight;
      return { x: at.x, y: at.y, w: size.w, h: real && real > 8 ? real : size.h };
    });
  }, []);

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
    /*
     * The middle is the middle of what you can SEE.
     *
     * The pane the timeline stands in has travel of its own, by design, so
     * that carrying on scrolling past the last update reaches the prompt
     * section under it. The fit never knew: it measures the room from the
     * timeline's own top, and with the pane at its foot that top is the
     * band's height above the window — measured at 1440x900 with six
     * updates, the set was cut off 192px above the screen with 423px of
     * nothing below it, and pressing centre put it back in exactly the
     * same place. That is his "stuff is toward the top".
     *
     * So a settle puts the pane back too. It is only ever the answer to
     * "show me everything" — opening the timeline, putting a box down,
     * asking for the middle — and a fit inside a box that is half off the
     * screen is not an answer to that.
     */
    const pane = box.closest("[data-studio-pane]");
    if (pane instanceof HTMLElement && pane.scrollTop > 0) {
      const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      pane.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
    }
    const s = useStudio.getState();
    const boxes = columnOf(box);
    /* The column, before the fan: what the middle is the middle of. */
    const cards = boxes.slice();
    /* The lanes hang off the end and are part of what the view must hold. */
    const lastT = s.threads.at(-1);
    /* As tall as the last box really stands, the way the lanes measure it, so the fit holds the same fan the screen shows. */
    const lastH = lastT ? box.querySelector<HTMLElement>(`[data-box="${lastT.id}"]`)?.offsetHeight : undefined;
    boxes.push(...laneRects(lastT ? { ...(s.threadSpots[`box:${lastT.id}`] ?? homeAt.current.get(lastT.id) ?? { x: 140, y: 130 }), ...sizeOf(lastT), ...(lastH ? { h: lastH } : {}) } : null, BOX, GAP));
    /* The ceiling is a reading of the card against the board, not a fixed 1:
       three updates used to stop at 1 and cover a quarter of the floor. */
    const widest = Math.max(BOX.w, ...boxes.map((b) => b.w));
    /*
     * The band along the foot of the pane (the detail under the timeline)
     * stands over the pane's bottom, so the room the set has is the pane
     * less the band: fitted to the whole pane, the lowest lane sat under
     * the band by 190px at 1500 wide and 19px at every width below 900.
     * The room is read off the band itself, so a taller band on a phone
     * is a shorter room, and the lanes are pinned above it when the set
     * is too tall to fit at the zoom floor: the chain's start may then go
     * off the top, which a pan reaches, and the lanes never sit under
     * the band.
     */
    /*
     * Only a band that STANDS OVER the pane takes room away from the fit.
     *
     * The shelf under the board is stuck to the fold, so the set has to keep
     * clear of it. The timeline's own strip is not: it is a block below, in
     * the same travel, as tall as what it holds — so subtracting its height
     * shrank the room by a band that was never covering anything, and the set
     * came to rest against the top edge, 28px above it and 136 below.
     */
    const band = box.parentElement?.querySelector<HTMLElement>("[data-studio-band][data-band-over]")?.offsetHeight ?? 0;
    const room = Math.max(120, box.clientHeight - band);
    /*
     * With the band taking its share, a long chain and the fan can be
     * taller than the room allows at the floor, and the floor's fallback
     * is to centre the set, which put a box 5px from the pane's top edge.
     * Under the band only, the fit may pull out past the floor as far as
     * the set needs to keep its margin, and no further than 0.28: a box
     * pulled out is still a box; a box on the edge is a box half seen.
     */
    const spanH = Math.max(...boxes.map((b) => b.y + b.h)) - Math.min(...boxes.map((b) => b.y));
    const spanW = Math.max(...boxes.map((b) => b.x + b.w)) - Math.min(...boxes.map((b) => b.x));
    const needed = Math.min((room - SETTLE_MARGIN * 2) / Math.max(1, spanH), (box.clientWidth - SETTLE_MARGIN * 2) / Math.max(1, spanW));
    const min = band ? Math.max(0.28, Math.min(SETTLE_MIN_ZOOM, needed)) : SETTLE_MIN_ZOOM;
    /*
     * The column is what gets centred; the fan hangs off it.
     *
     * His ruling. The first attempt weighed the cards for BOTH axes and
     * put 178px of the lowest lane under the band, because the fan gives
     * sideways and must not give downward. `weigh` now decides the middle
     * and the hold across only — the fan still decides the zoom and is
     * still held above the band.
     */
    const to = settleView(boxes, { w: box.clientWidth, h: room }, {
      min,
      max: zoomCeiling(box.clientWidth, widest),
      weigh: cards,
    });
    stopSettle();
    if (!to) return;
    fitZoom = to.zoom;
    /*
     * The fan, kept off the band.
     *
     * The lanes stand as tall as the box they hang off, measured, which
     * the nominal boxes above undercount; the whole margin covers the
     * difference. Left as it is deliberately, and the record of why: I
     * suspected this of being his "stuff is toward the top" — it is a
     * one-way shove upward with no ceiling — and capped it at the margin
     * to find out. Two measurements settled it. At 1546x1278 with four
     * updates it was not firing at all, so the cap changed nothing there;
     * at the width `tests/lanes.mjs` checks, capping it put 178px of the
     * lowest lane back under the band, which is the fault this line was
     * written to fix. It is not the cause, and it is load-bearing.
     */
    const lanesBottom = Math.max(...boxes.slice(-3).map((b) => (b.y + b.h) * to.zoom + to.pan.y));
    if (lanesBottom > room - SETTLE_MARGIN) to.pan.y -= lanesBottom - (room - SETTLE_MARGIN);
    /*
     * …and the shove is not allowed to strand what it is making room for.
     *
     * The fan is furniture and gives; the column never does. Now that the
     * column decides the zoom, the fan is usually bigger than the room and
     * this shove is correspondingly larger, so an unbounded upward push
     * would take the top of the chain off the frame to keep a lane off a
     * band — the ruling exactly backwards. So the column is held in its
     * own room afterwards, by the same rule the fit used to place it:
     * whatever the shove would cost the column, it gives back.
     */
    const colTop = Math.min(...cards.map((b) => b.y));
    const colBottom = Math.max(...cards.map((b) => b.y + b.h));
    to.pan.y = hold(to.pan.y, colTop * to.zoom, colBottom * to.zoom, room, SETTLE_MARGIN);
    /*
     * AND THE LANES AS DRAWN, once the view has landed.
     *
     * Everything above reasons about the lanes' nominal rects, and a lane as
     * drawn can stand lower than its rect says (it hangs off the box as the
     * box is really drawn). Measured with eight updates at 1600x1000 under
     * the backend's band: the red lane's foot 14px under the band's top edge
     * with the column wholly clear (`tests/column-inside.mjs`). So the drawn
     * lanes are read back and the view lifted by what still overhangs, never
     * further than the column's top can go without leaving the frame: the
     * column never gives.
     */
    const clearLanes = () => {
      const frame = box.getBoundingClientRect();
      const bandEl = box.parentElement?.querySelector<HTMLElement>("[data-studio-band][data-band-over]");
      const bandTop = bandEl ? bandEl.getBoundingClientRect().top : frame.bottom;
      const floor = Math.min(frame.bottom, bandTop > frame.top ? bandTop : frame.bottom) - 4;
      const lanes = [...box.querySelectorAll<HTMLElement>("[data-lane-box]")].map((e) => e.getBoundingClientRect().bottom);
      const tops = [...box.querySelectorAll<HTMLElement>("[data-box]")].map((e) => e.getBoundingClientRect().top);
      if (!lanes.length || !tops.length) return;
      const over = Math.max(...lanes) - floor;
      const up = Math.min(over, Math.min(...tops) - (frame.top + 8));
      if (!(up >= 1)) return;
      const v = viewAt.current;
      const pan = { x: v.pan.x, y: v.pan.y - up };
      viewAt.current = { ...v, pan };
      setPan(pan);
    };
    const from = viewAt.current;
    if (sameView(from, to)) { requestAnimationFrame(clearLanes); return; }
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (still) {
      setPan(to.pan);
      setZoom(to.zoom);
      requestAnimationFrame(() => requestAnimationFrame(clearLanes));
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
      requestAnimationFrame(() => requestAnimationFrame(clearLanes));
    };
    settling.current = requestAnimationFrame(step);
  }, [stopSettle]);

  /**
   * The fit, once there is something to measure.
   *
   * What the fit reads is the boxes' real heights, and a fit taken in the
   * same tick as the decision to take it reads the nominal ones instead:
   * measured, that is the difference between the column landing 5px off the
   * room's centre and 141px off it.
   *
   * WAITING FOR THE BOXES RATHER THAN FOR A NUMBER OF FRAMES. Two frames
   * was enough on a quiet machine and not on a busy one — the same check
   * came back 5px off centre run alone and 141px off it run in a suite,
   * which is a race, not a result. So it asks the DOM each frame whether
   * every box is there with a height on it, and fits on the frame that says
   * yes. Bounded at thirty frames: if they are still not there half a
   * second later the fit runs anyway, because a fit on nominal heights is
   * wrong and no fit at all is the silence this whole evening has been
   * about.
   */
  const whenMeasurable = React.useCallback((run: () => void) => {
    const pane = plot.current?.closest<HTMLElement>("[data-timeline]") ?? null;
    let left = 30;
    let id = 0;
    const there = () => {
      const ids = useStudio.getState().threads.map((t) => t.id);
      if (!pane || !ids.length) return true;
      return ids.every((i) => (pane.querySelector<HTMLElement>(`[data-box="${i}"]`)?.offsetHeight ?? 0) > 8);
    };
    const look = () => {
      if (left-- <= 0 || there()) { run(); return; }
      id = requestAnimationFrame(look);
    };
    id = requestAnimationFrame(look);
    return { cancel: () => cancelAnimationFrame(id) };
  }, []);

  const settleSoon = React.useCallback(() => whenMeasurable(() => settle()), [whenMeasurable, settle]);


  /*
   * Opening the timeline settles it — the first time, and only then.
   *
   * Finish is the only door into this view and it is a toggle, so every trip
   * to the board and back mounted this again and refitted, which threw away
   * whatever the person had been looking at. Measured before the fix: zoom
   * 1.85 back to 1 with three updates, 0.77 back to 0.41 with eight, every
   * time Finish was pressed.
   *
   * So a view a person has moved is theirs and is put back. It is a module
   * variable rather than state, because state dies with the mount and that
   * is the whole problem; and rather than the store, because it is where
   * somebody is looking and not part of the site — it should not be written
   * into the saved document or carried into a new session.
   */
  React.useEffect(() => {
    const box = host.current;
    if (!box) return;
    let raf = 0;
    let was = { w: 0, h: 0 };
    let pending = false;
    /** The room the set really has: the frame, less the band over its foot. */
    const roomOf = () => {
      const band = box.parentElement?.querySelector<HTMLElement>("[data-studio-band][data-band-over]")?.offsetHeight ?? 0;
      return { w: box.clientWidth, h: Math.max(0, box.clientHeight - band) };
    };
    const go = () => {
      raf = 0;
      const now = roomOf();
      /*
       * Nothing to fit into yet, so nothing is decided yet.
       *
       * This used to be one attempt in one frame after mount, and if the
       * pane had not laid out by then it gave up in silence: the pan is
       * this component's own state and starts at zero, while the zoom is
       * the store's and survives, so what was left was the board's scale
       * with no translation at all — `matrix(0.683, 0, 0, 0.683, 0, 0)`,
       * which is what he read off the deploy, with the updates pinned to
       * the frame's top-left corner and part of the timeline outside the
       * frame entirely. Reproduced by opening the timeline in a 420x240
       * window and then giving it the room: scale 0.28, 126px of it above
       * the frame's own top edge, and it stayed there.
       */
      if (!(now.w > 1 && now.h > 1)) return;
      setAspect(box.clientHeight > 1 ? box.clientWidth / box.clientHeight : 2);
      const moved = Math.abs(now.w - was.w) > 2 || Math.abs(now.h - was.h) > 2;
      was = now;
      if (!settled.current) {
        /*
         * The view he left, if he has one AND it still has the column on
         * the screen — or the fit.
         *
         * His ruling, and it outranks the hand: "NO PART OF THE COLUMN IS
         * EVER OUTSIDE THE FRAME. Clipping the thing he is reading is
         * worse than any amount of the fan hanging off." What stood here
         * handed his view back whatever had become of it. Wheel the board
         * sideways, leave by Finish and come back through it, and the
         * timeline returned 1887px off the left edge with every card off
         * the screen and nothing said — which is the same silence as the
         * fit that used to give up in one frame.
         *
         * Asked in board coordinates, not of the DOM: at this moment the
         * boxes have not arrived, so there is nothing to measure. And
         * asked with no margin, because a view of his own sitting a few
         * pixels off the edge is still a view — this is a floor to catch
         * what has fallen through, not a tidier.
         *
         * THE WHOLE PANE, NOT THE PANE LESS THE BAND. His words are
         * "outside the FRAME", and the band along the foot is inside it.
         * The fit keeps the set clear of the band, which is right for a
         * fit; measuring against it here fought the hand instead —
         * zooming in eight notches by hand puts 161px of the column
         * behind the band with nothing off the frame at all, and this
         * threw that view away and refitted, which is the zoom resetting
         * on every Finish that `tests/updates-view` exists to stop.
         *
         * AND ASKED WHEN THERE IS SOMETHING TO MEASURE, which is not now.
         * A box not yet in the DOM has no height to read and keeps the
         * nominal one, and nominal is 208 against about 133 — three of
         * them is 225 board pixels of column that is not there. Asked at
         * this moment it condemned a perfectly good view: zoomed in by
         * hand to 0.884 with nothing off the frame, the phantom column
         * hung off the bottom and the view was thrown away and refitted
         * to 0.592. So his view is handed back first, and the question is
         * put a few frames later when the boxes have arrived; if it fails
         * then, the fit takes it.
         */
        const mine = owns ? ownView : null;
        if (mine) {
          /*
           * A VIEW HE MOVED COMES BACK EXACTLY AS HE LEFT IT.
           *
           * HIS RULING, relayed: rule 1 — no part of the column is ever
           * outside the frame — binds the FIT, not the hand. He made it when
           * the fit was pushing the column out of the frame on its own, and
           * he separately said the builder must stop overruling what he does
           * by hand, which is the complaint he made about lanes being
           * disregarded during centring. Read together they do not collide.
           *
           * What stood here measured his view against a tolerance after
           * handing it back — and with the SET centred the column sits to one
           * side by design, so one wheel notch put 32px of it past the edge,
           * the tolerance was 24, and the builder put his board back and undid
           * the notch. Widening the tolerance only buys until the next notch.
           * The fault was asking the question at all.
           *
           * So: his pan, his zoom, and nothing that second-guesses either. What
           * stops that being a trap is `lost` below — whenever the column is
           * off the screen, the way back is ON the screen.
           */
          setPan(mine.pan);
          setZoom(mine.zoom);
          settled.current = true;
          return;
        }
        /* Nobody owns a view that lost the column. Asking for the middle is
           asking for the fit, which is the other half of the ruling. */
        if (owns) { owns = false; ownView = null; }
        settle();
        /*
         * …and again once there is something to measure.
         *
         * The arrival's own re-fit cannot cover this one: coming back in,
         * every box has already been watched arrive, so `everyoneHere` is
         * true on the first render — which is BEFORE this line runs and
         * drops the ownership, so that effect reads `owns` as still true,
         * returns, and never runs again because nothing it watches
         * changed. Two traps of the same shape, one inside the other.
         */
        rescue.current = settleSoon();
        settled.current = true;
        return;
      }
      /*
       * Wait for the room to stop moving before fitting to it.
       *
       * A window resize arrives as a run of observations, and the band
       * along the foot is a second element resizing on its own schedule.
       * Fitting on the first of them fits to a room that is still
       * changing: measured, `tests/lanes.mjs` put 178px of the lowest lane
       * under the band, because the room was read before the band had
       * finished growing. So a change only arms the fit, and the fit
       * happens on the first frame where nothing moved.
       */
      if (moved) {
        pending = true;
        raf = requestAnimationFrame(go);
        return;
      }
      if (!pending) return;
      pending = false;
      /*
       * A view nobody has claimed is the fit's, and the fit is out of
       * date, so it runs again.
       *
       * A view somebody moved is theirs and is left where they left it —
       * unless the room moving has put part of it off the edge, which is
       * not a view any more. Asked of the DOM rather than recomputed,
       * because what is being asked is exactly "can he still see them".
       */
      const stranded = () => {
        const cards = [...box.querySelectorAll<HTMLElement>("[data-box]")];
        if (!cards.length) return false;
        const frame = box.getBoundingClientRect();
        const bandH = box.parentElement?.querySelector<HTMLElement>("[data-studio-band][data-band-over]")?.offsetHeight ?? 0;
        return cards.some((el) => {
          const r = el.getBoundingClientRect();
          return r.top < frame.top || r.left < frame.left || r.right > frame.right || r.bottom > frame.bottom - bandH;
        });
      };
      if (inHand.current) return;
      if (!owns || stranded()) settle();
    };
    raf = requestAnimationFrame(go);
    const ro = new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(go); });
    ro.observe(box);
    /*
     * A BAND THAT ARRIVES LATER IS STILL A BAND.
     *
     * This looked the band up once, at mount, and watched whatever it found.
     * On the iteration tab there is none to find — the strip below the
     * timeline is an ordinary block in the same travel — so nothing was
     * watched at all; and when the backend tab is opened afterwards it
     * mounts a band that stands OVER the pane, which takes better than half
     * the room without changing the pane's own height by a pixel. So no
     * observation fired, `go` never ran, and the room quietly halved under a
     * board that had already fitted to the whole of it.
     *
     * MEASURED, finishing and then opening the backend: 512px of the set and
     * 401px of the COLUMN under the band at 1600x1000 with eight updates,
     * and it stayed there. His rule is that furniture may overhang but may
     * never disappear, because something hidden under an opaque band reads
     * as absent and absent is a lie about the board — and that outranks any
     * zoom number, so the column sitting under it in silence is the worst
     * version of it.
     *
     * Nothing below this needed changing to fix it. `roomOf` already reads
     * the band live and `stranded` already measures against its top edge;
     * the only thing missing was anything at all telling them to look. So
     * the band is re-found whenever one arrives or leaves, and the fit is
     * armed the same way a window resize arms it — which also means it goes
     * through the same guard, and a view he moved himself is still left
     * exactly where he left it unless the band has taken the column off the
     * screen, which is the one case his rule 1 puts above his hand.
     */
    let watched: Element | null = null;
    const bindBand = () => {
      const now = box.parentElement?.querySelector("[data-studio-band][data-band-over]") ?? null;
      if (now === watched) return;
      if (watched) ro.unobserve(watched);
      watched = now;
      if (now) ro.observe(now);
      /* The room has changed shape even if nothing has resized, so say so
         the way a resize would and let `go` settle on the new one. */
      if (!raf) raf = requestAnimationFrame(go);
    };
    bindBand();
    /* Watched on the pane's parent, which is what the band is mounted into
       and out of. `data-band-over` is in the filter because the timeline's
       own strip is the same element with and without it: a tab change can
       turn a band into a block rather than removing anything. */
    const mo = typeof MutationObserver === "undefined" ? null : new MutationObserver(bindBand);
    if (box.parentElement) mo?.observe(box.parentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-band-over", "data-studio-band"] });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      rescue.current?.cancel();
      rescue.current = null;
      ro.disconnect();
      mo?.disconnect();
      stopSettle();
    };
    // `settle` and `stopSettle` are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * And once everybody has arrived, the fit runs again.
   *
   * The boxes come in when the timeline is opened, .2s apart, so the fit
   * at mount is a fit to a board that is still filling: the lane fan is
   * measured off the last box, and that box is not in the DOM yet, so the
   * fan is fitted at its nominal height. Measured by `tests/lanes.mjs`,
   * that left 178px of the lowest lane under the band along the foot of
   * the pane — the exact thing the fan's own clearance is there to stop.
   *
   * So the fit is taken again when the run is over, on a board that is
   * all there. Once: `everyoneHere` goes true and stays true. And not
   * over a view somebody has already moved, which is theirs.
   */
  const everyoneHere = threads.length > 0 && threads.every((t) => shownOf(t.id) >= 0);
  React.useEffect(() => {
    if (!everyoneHere || owns || inHand.current) return;
    /*
     * Two frames, and not `settled.current`.
     *
     * Coming back in through Finish a second time, every box has already
     * been watched arrive, so `everyoneHere` is true on the very first
     * render — before this component has committed, let alone laid out. It
     * used to be guarded on the mount fit having run, so on re-entry it
     * returned early and then never ran again, because `everyoneHere` had
     * not *changed*: the fit was left as it landed on a board with nothing
     * measurable on it, and the column came back 142px off centre where
     * the first entry put it within 5. One frame for React's commit and
     * one for the layout, and then the heights are real.
     */
    const f = settleSoon();
    return () => f.cancel();
  }, [everyoneHere, settleSoon]);

  /*
   * ANY CHANGE TO WHAT IS ON THE BOARD RE-FITS THE BOARD.
   *
   * His words, after deleting a box: "the lanes went to the green as they
   * should but it didnt recenter again automatically", and then, having
   * pressed the key himself: "pressing the button worked, just had to
   * manually do it". So the fit was never wrong; it simply was not asked.
   *
   * Arrival had its own trigger and a drag had one, and between them they
   * covered adding and moving. Deleting changes the set as much as either
   * and had nothing. This watches the set itself — the ids, in order — so
   * it covers a box going, a box arriving out of band, and a re-parent that
   * changes the chain, rather than naming the three doors one at a time and
   * waiting for him to find a fourth.
   *
   * Not on the first pass: the mount has just fitted, and re-fitting a view
   * that was made a frame ago is a jump for nothing.
   */
  const onBoard = threads.map((t) => t.id).join(",");
  const wasOnBoard = React.useRef<string | null>(null);
  React.useEffect(() => {
    const first = wasOnBoard.current === null;
    const changed = wasOnBoard.current !== onBoard;
    wasOnBoard.current = onBoard;
    if (first || !changed || !settled.current || inHand.current) return;
    /* A view somebody moved is theirs — but a board that has lost a box is
       not the board they moved, and the column may now be anywhere. The
       same reckoning the door makes, made here. */
    const f = settleSoon();
    return () => f.cancel();
  }, [onBoard, settleSoon]);

  /*
   * The bar's readout is the way back here as well.
   *
   * `requestFit` is one signal in one store and the zoom it shows is one
   * number in one store, so the percentage in the bar was already this
   * surface's percentage — it just had nothing to press for. Now the board
   * answers it with a fit and the timeline answers it with a settle, which
   * is why the "fit in view" button beside it and the "centre" button down
   * in the corner could both go: three controls doing one job.
   *
   * `owns` is dropped first, because asking for the middle is asking for
   * the middle and not for wherever the view was last left.
   */
  /*
   * Is the column off the screen? Then the way back has to be on it.
   *
   * Measured against the live pan and zoom by the same `columnOf` the fit
   * reads, with NO tolerance: off is off. Unconditional on whose view it is
   * — the fit is held to rule 1 separately and should never put it there,
   * but if anything ever does, he is not left looking at an empty board
   * with a control he would have to know about.
   */
  const [lost, setLost] = React.useState(false);
  React.useEffect(() => {
    const box = host.current;
    if (!box) return;
    const col = columnOf(box);
    const frame = { w: box.clientWidth, h: box.clientHeight };
    const holds = columnHolds({ pan, zoom }, col, frame);
    setLost((was) => (was === !holds ? was : !holds));
  }, [pan, zoom, columnOf, all.length]);

  const fitNonce = useStudio((s) => s.fitNonce);
  /*
   * Skipped on mount, but by VALUE rather than a boolean flag.
   *
   * A `useRef(true)` "have I run yet" flag reads right once, but dev's
   * double-invoke of effects on mount runs this effect twice against the
   * same ref: the first pass flips the flag, and the second — still the
   * same mount, not a real second trigger — finds it already flipped and
   * fires for real, wiping the view he just claimed before the restore
   * effect above ever gets to read it. `wasOnBoard` just above this one
   * dodges the same trap by comparing the seen value rather than asking
   * whether it has been seen at all, so a re-run against an unchanged
   * value is a no-op instead of an edge. This does the same.
   */
  const seenFitNonce = React.useRef(fitNonce);
  React.useEffect(() => {
    if (seenFitNonce.current === fitNonce) return;
    seenFitNonce.current = fitNonce;
    owns = false;
    ownView = null;
    settle();
  }, [fitNonce, settle]);

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
        /*
         * NO VINE EXISTS WITHOUT A BOX AT BOTH ENDS.
         *
         * His rule, after a deleted box left its vine behind: "line still
         * exists", and then "pieces are just floating" — a curve and two
         * shards out in empty space with nothing at either end. A vine that
         * ends in mid air is the picture of the bug in every case he has
         * raised, the unlanded connection included.
         *
         * Only the START was checked here. The end was assumed present
         * because it comes from the list being walked, which is true right
         * up until the list and the map disagree for a frame — and when they
         * do, `anchorOf` has no box to ask and falls back to a default spot,
         * which is how a vine ends up drawn far from anything it belongs to.
         *
         * Both ends, every frame. It is one term, it cannot cost anything,
         * and it makes the invariant true by construction rather than by
         * everything upstream remembering to keep it.
         */
        .filter((c): c is { from: string; to: string; thread: Thread } => !!c.from && byId.has(c.from) && byId.has(c.to))
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

  /*
   * An opened card comes into view if it is not already in it.
   *
   * A card opens beside its box, so a box near an edge puts its card over
   * the edge — and the more the board is zoomed in, the further out the card
   * lands. That went unnoticed while the fit stopped at 1: raising the
   * ceiling so three updates fill the floor rather than a quarter of it is
   * what made a card open half off the window, and the card is where a
   * person edits, so half of it is no card at all.
   *
   * The pan moves, never the zoom: a card sliding into view is one thing
   * moving, and the board jumping out a step to fit a panel is another.
   */
  React.useEffect(() => {
    if (!openThreadId) return;
    const id = requestAnimationFrame(() => {
      const box = host.current;
      const grid = plot.current;
      if (!box || !grid) return;
      const card = grid.querySelector<HTMLElement>(`[data-card][data-card-of="${openThreadId}"]`);
      if (!card) return;
      const c = card.getBoundingClientRect();
      const v = box.getBoundingClientRect();
      const pad = 12;
      const dx = c.left < v.left + pad ? v.left + pad - c.left : c.right > v.right - pad ? v.right - pad - c.right : 0;
      const dy = c.top < v.top + pad ? v.top + pad - c.top : c.bottom > v.bottom - pad ? v.bottom - pad - c.bottom : 0;
      if (!dx && !dy) return;
      claim();
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    });
    return () => cancelAnimationFrame(id);
  }, [openThreadId, claim]);
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
      const grow = Math.min(1, Math.max(0, shownOf(cord.to)) / FORM.vine[1]);
      want.set(`${cord.from}>${cord.to}`, {
        from, to, tone: cord.tone, phase: seed(cord.to), ends: cord.ends, box: strandBounds(from, to), grow,
        /* Pulled while the pointer is on its seam, and parting while it
           is being cut. Read off refs rather than state: both change at
           the frame rate and neither belongs in a render. */
        tug: ropes.current.get(cord.to)?.x ?? 0,
        cut: cutAt.current.id === cord.to ? cutAt.current.p : 0,
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
     *
     * **And it follows the zoom downward too, which it did not.** The floor
     * was one board pixel per device pixel however far out the view was, so
     * at the zoom a timeline of twelve boards settles on — about 0.46 — the
     * sheet was drawn at a little over twice the size it is shown and the
     * compositor filtered it down again on every frame that anything on the
     * page moved. A quarter of the texels, sampled once instead of averaged
     * four to one, and it measured a tenth of the timeline's dropped frames
     * at twelve boards. The floor is half rather than nothing, so a little
     * supersampling survives for the vines' diagonals; below that the lines
     * would start to crawl.
     */
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const near = Math.min(2, Math.max(0.5, Math.ceil(viewAt.current.zoom * 4) / 4));
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
    const mark = (v: Vine) => `${v.from.x},${v.from.y},${v.to.x},${v.to.y},${v.tone},${v.phase},${v.ends[0]},${v.ends[1]},${v.grow.toFixed(3)},${(v.tug ?? 0).toFixed(2)},${(v.cut ?? 0).toFixed(3)},${v.rim ? v.rim.p.toFixed(3) : ""}`;
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
    /*
     * Every shadow, then every body.
     *
     * A vine painting itself whole lays its own shadow over whatever is
     * already on the board, and the shadow is nearly black \u2014 so a vine that
     * happens to be drawn second smears a dark band across one drawn first,
     * and a pile of crossings comes out darker than any vine in it. Two
     * passes and a shadow falls on the ground, where it belongs.
     */
    const show = [...want.values()].filter((v) => dirty.some((r) => hits(r, v.box)));
    for (const v of show) {
      if (v.rim) continue;
      paintStrand(c, v.from, v.to, { tone: v.tone, ends: v.ends, grow: v.grow, tug: v.tug, cut: v.cut, pass: "shadow" });
    }
    for (const v of show) {
      if (v.rim) { paintRim(c, v.rim); continue; }
      paintStrand(c, v.from, v.to, { tone: v.tone, ends: v.ends, grow: v.grow, tug: v.tug, cut: v.cut, pass: "body" });
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
    /* Where the box is, as of the last move: a cancelled drag puts it down there, not at the cancel event's own point, which is nowhere. */
    let last: Point = from;
    /*
     * Letting go lets go, every time. Once a drag has begun the pointer is
     * captured by the box that was pressed, so the release reaches it
     * wherever the mouse is, outside the window included; and a drag the
     * browser cancels midway ends the same way as a release, where before
     * it left the box stuck to the mouse until the next click. He hit that
     * by hand. Captured once it moves and not on the press: a captured
     * pointer sends its click to the captor, and a press on a key inside
     * the box would never reach the key.
     */
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - from0.x, ev.clientY - from0.y) < 4) return;
      if (!moved) { try { target.setPointerCapture(pointerId); } catch { /* a pointer that is already gone */ } }
      moved = true;
      last = to(ev);
      setDragging({ id, at: last });
    };
    let done = false;
    const up = (ev: PointerEvent) => {
      if (done) return;
      done = true;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      target.removeEventListener("lostpointercapture", up as EventListener);
      try { if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId); } catch { /* already released */ }
      // A box that was carried somewhere is not a box that was clicked: the
      // click that follows a drag would otherwise open whatever was moved.
      if (moved) {
        const at = ev.type === "pointerup" ? to(ev) : last;
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
    window.addEventListener("pointercancel", up);
    target.addEventListener("lostpointercapture", up as EventListener);
  };

  /** Dragging the ground pans the whole surface, as far as you like. */
  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setMenu(null);
    stopSettle();
    const from = { x: e.clientX - viewAt.current.pan.x, y: e.clientY - viewAt.current.pan.y };
    let moved = false;
    /* The same rule as a box: captured by the ground once the pan has begun, and a cancel ends it as a release does. */
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    const move = (ev: PointerEvent) => {
      // Six, not three: a press with a mouse moves a pixel or two on its own,
      // and a trackpad more, and a press that read as a pan closed nothing.
      if (!moved && (Math.abs(ev.clientX - e.clientX) > 6 || Math.abs(ev.clientY - e.clientY) > 6)) {
        moved = true;
        try { target.setPointerCapture(pointerId); } catch { /* a pointer that is already gone */ }
      }
      claim();
      setPan({ x: ev.clientX - from.x, y: ev.clientY - from.y });
    };
    let done = false;
    const up = () => {
      if (done) return;
      done = true;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      target.removeEventListener("lostpointercapture", up as EventListener);
      try { if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId); } catch { /* already released */ }
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
    window.addEventListener("pointercancel", up);
    target.addEventListener("lostpointercapture", up as EventListener);
  };

  /*
   * How far the updates go, in the window, right now.
   *
   * The plot is a 1×1 anchor with everything absolutely placed in it, so its
   * own box says nothing. The boxes say it, and reading them off the screen
   * is the same measurement at any zoom and any pan.
   */
  const spread = () => {
    const h = host.current?.getBoundingClientRect();
    if (!h) return null;
    let top = Infinity;
    let bottom = -Infinity;
    for (const el of host.current!.querySelectorAll("[data-box]")) {
      const r = el.getBoundingClientRect();
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
    }
    return Number.isFinite(top) ? { top, bottom, view: h } : null;
  };

  const onWheel = (e: WheelEvent) => {
    stopSettle();
    claim();
    if (!e.ctrlKey && !e.metaKey) {
      /*
       * The updates pan until they run out, then the pane takes over.
       *
       * Both of them wanted the same gesture: the field panned *and* the
       * pane scrolled, so eight notches ran the updates 1848px off the top
       * while the detail band came up underneath — two surfaces moving at
       * once under one hand. The rule is the board's rule: this consumes
       * the wheel while it still has updates to bring into view, and lets
       * go when it has not, so carrying on scrolling reaches the prompt
       * section under the timeline and scrolling back up brings the
       * updates back before the field moves again.
       */
      const s = spread();
      const pane = host.current?.closest("[data-studio-pane]");
      const down = e.deltaY > 0;
      /* No updates at all is nothing to pan for: the gesture is the pane's
         from the first notch, so the prompt section under an empty timeline
         is still one scroll away. */
      const spent = s ? (down ? s.bottom <= s.view.bottom + 1 : s.top >= s.view.top - 1) : true;
      const paneHasRoom = pane instanceof HTMLElement
        && (down ? pane.scrollTop < pane.scrollHeight - pane.clientHeight - 1 : pane.scrollTop > 0);
      /* Coming back up, the pane unwinds first: it is what moved last. */
      if (!down && paneHasRoom) return;
      if (spent && paneHasRoom) return;
      e.preventDefault();
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      return;
    }
    /* The store's setter takes a number, not an updater, and its own clamp is
       the clamp — the timeline used to hold itself to 0.4–1.8 while the bar's
       buttons ran to 0.25–2.5, which is two answers to one question. */
    setZoom(useStudio.getState().zoom * (e.deltaY < 0 ? 1.08 : 0.93));
  };

  /*
   * The wheel is bound by hand, because React's is passive.
   *
   * React attaches `wheel` to the root as a passive listener, so
   * `preventDefault` inside an `onWheel` prop is quietly a no-op. That was
   * harmless while nothing round the timeline could scroll — the pane had
   * no travel, so the browser's own scroll had nowhere to go and the pan
   * looked like it had the gesture to itself. With the detail band in the
   * pane it has somewhere to go, and eight notches moved both surfaces at
   * once. A listener of our own, not passive, is what actually lets this
   * decide. (`Canvas` binds its wheel the same way, for the same reason.)
   */
  const wheelRef = React.useRef(onWheel);
  wheelRef.current = onWheel;
  React.useEffect(() => {
    const el = host.current;
    if (!el) return;
    const fn = (e: WheelEvent) => wheelRef.current(e);
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, []);

  const nothing = !threads.length;
  /*
   * Where the lanes hang: one slot past the last real box, wherever it
   * stands now — and only once that box is on the board.
   *
   * The lanes are as tall as the box they hang off, measured off it
   * (`Lanes`), and that measurement happens in an effect keyed on the
   * box's id. With the arrival staggered, the last box is not in the DOM
   * when the timeline first paints, so the measurement found nothing, the
   * effect never ran again, and the fan stood 106px tall beside a 126px
   * box for the rest of the session — 10px out of level, which is exactly
   * the sort of thing he spots. So the fan waits for its box, which is
   * also the truer thing: a fan hanging off a box that is not there yet
   * is a fan hanging off nothing.
   */
  const lastThread = all.at(-1)?.thread;
  const lastHere = lastThread && shownOf(lastThread.id) >= 0 ? lastThread : undefined;
  const lanesFrom = lastHere ? { ...spotOf(lastHere.id), ...sizeOf(lastHere) } : null;

  return (
    <div
      ref={host}
      data-timeline=""
      className="relative h-full w-full shrink-0 overflow-hidden"
      onPointerDown={startPan}
      onContextMenu={(e) => e.preventDefault()}
    >
      {lost ? (
        <button
          type="button"
          data-timeline-lost=""
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => { play("confirm"); useStudio.getState().requestFit(); }}
          className="tactile absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-plain font-medium shadow-panel"
          style={{ background: "oklch(0.16 0.03 152 / 0.94)", borderColor: "oklch(0.66 0.17 152 / 0.6)", color: "oklch(0.92 0.06 152)" }}
        >
          <MapPin className="size-3.5" />
          The updates are off the screen — bring them back
        </button>
      ) : null}
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
          // Waiting its turn to arrive: not on the board yet, and not a box
          // standing empty either.
          if (shownOf(t.id) < 0) return null;
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

        {/*
          THE LANES, PAST THE END.

          Three offers of what could come next, hanging one slot past the
          last real box and moving along with it. Not threads, not placed
          by hand, not part of the history: what a lane carries out lands
          as an iteration through the same door as everything else and
          stands in the chain in blue.
        */}
        <Lanes from={lanesFrom} fromId={lastHere?.id ?? null} size={BOX} gap={GAP} fromEnd={lastHere && isElement(lastHere) ? "drawing" : "iteration"} />

        {/*
          The cut line down each vine, and nothing else on a vine.

          There was a small green node at the middle of every strand that
          opened the pair below. J did not know what it was, and it did not
          earn the room: pressing either box already opens it. What a vine
          is *for* is this — one line down its middle, and cutting it takes
          the iteration out. So the line is the only thing on a vine, and
          this is the press: an element clipped to the line itself, lifted
          while anything is being dragged because the vine under it is
          moving and a press then would be a press on the wrong one.
        */}
        {dragging ? null : cords.map((cord) => (
          <VineCut
            key={`${cord.from}->${cord.to}`}
            of={byId.get(cord.to)}
            at={ends(anchorOf(cord.from), anchorOf(cord.to))}
            ends={cord.ends}
            onTug={tug}
            onCut={cutVine}
          />
        ))}
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
          <p className="max-w-sm text-center text-large leading-relaxed text-[oklch(0.7_0.06_152)]">
            Nothing has happened yet, which is not the same as something being wrong. The first thing you do to the
            board makes iteration one and it appears here; after that every ask that comes back and every drawing made
            real stands here too, and the strands between them are what one iteration made of the last. Add a part, or
            ask something below.
          </p>
        </div>
      ) : null}

      {/*
        The little box that used to sit down here — the update count, a
        "centre" button and the zoom percentage — is gone on his ruling:
        "remove the little centre and updates amount box in the bottom left
        of the timeline box, then remove the button at the top to 'fit in
        view' when the zoom percentage number should be the button doing
        that for both since they do the same thing now."

        And they do: the timeline's zoom IS the board's zoom, one number in
        one store, so the readout in the bar was already showing this
        surface. It is now the one press that puts either of them back —
        `requestFit`, watched below — and three controls that did one job
        are one control.

        It was also the thing that made the fault he reported: a button at
        the very bottom of a pane with travel in it scrolls that pane to
        itself when it takes focus, which put the timeline 248px off the
        top of the window.
      */}
    </div>
  );
}

