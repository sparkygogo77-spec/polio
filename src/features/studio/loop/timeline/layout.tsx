"use client";
import * as React from "react";
import { Brush, Image as ImageIcon, Flag, GitBranch, Layers, ListChecks, Sparkles } from "lucide-react";
import { acrossFor, STAGGER_MS } from "../../timelineView";
import { LANE_MODE } from "../lanesModel";
import { type Point } from "../strand";
import { PROCESS, threadTitle, type Thread, type ThreadNode } from "../threads";
import { formOf, within } from "../../formation";
import { GENERATION } from "../threads";

/*
 * A green card is the site, so it is the size of a thing you can read a site
 * on: two and a half times the width it was and twice the height, which is
 * the size J drew on the screenshot. The red cards are steps against it.
 */
export const BOX = { w: 620, h: 208 };
export const PIECE = { w: 168, h: 148 };

/** How far a card stands off the box it grew out of, for the connector to run. */
export const GROW = 22;
/**
 * The gap the scatter leaves between two cards, before anybody drags one.
 *
 * A gap, not a step: the step is this plus the card, so a card drawn wider
 * pushes its neighbours out rather than growing into them. `DRIFT` used to be
 * the whole step — 268 by 158 against a card 248 by 104 — which meant a card
 * two and a half times wider would have overlapped the one beside it.
 */
export const GAP = { x: 20, y: 54 };

/** A number from a string: the same box lands in the same place every time. */
export function seed(s: string): number {
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
 * WHAT HE ASKED FOR, in his words: "if you are in the design preview and
 * havent seen the timeline yet dont have the elements add until you open
 * the timeline where everything not seen yet is all loaded in sequentially
 * but each box starts maybe .2 seconds apart, not once the previous is
 * finished."
 *
 * So an update is not a thing that happened somewhere he was not looking.
 * Work on the board makes updates and their boxes wait; the moment he
 * opens the timeline every box he has not watched arrive forms — in order,
 * each starting `STAGGER_MS` after the one before it and not after it
 * finishes, so a run of six reads as a sequence rather than as a queue.
 *
 * "Haven't seen the timeline yet" includes a session that has only just
 * started, which is what changed here: the rule used to be that whatever
 * was on the board when the timeline first mounted was shown as it stood,
 * on the reasoning that a reload should not replay history. His reading is
 * the better one — an update you have never watched arrive is an update
 * you have not seen, whether it landed a minute ago or before the tab was
 * opened — and the first sight of the timeline in a session is now the
 * whole run, arriving.
 *
 * `watched` is a module variable, like the held view further down and for
 * the same reason: it is about where somebody has been looking, not about
 * the site, so it belongs to the session and never to the document. It
 * also has to outlive the component, which unmounts every time he goes
 * back to the board — kept on the instance, going back and returning
 * would replay everything.
 *
 * One rAF runs while anything is still moving and none when nothing is, so
 * a still timeline costs nothing here.
 */
/** Every thread whose arrival has been watched, this session. */
export const watched = new Set<string>();

export function useForming(threads: Thread[]): Map<string, number> {
  const [shown, setShown] = React.useState<Map<string, number>>(() => new Map());
  const state = React.useRef({ shown: new Map<string, number>(), gen: new Map<string, number>(), wait: new Map<string, number>(), raf: 0 });
  React.useEffect(() => {
    const st = state.current;
    const target = new Map<string, number>();
    let moving = false;
    /*
     * How many arrivals are already queued ahead of this one on this pass.
     * Counted over the run rather than off the thread's index, so six that
     * have waited start 0, 200, 400… apart and a seventh landing while
     * they play does not wait behind all of them.
     */
    let queued = 0;
    for (const t of threads) {
      const f = formOf(t);
      target.set(t.id, f.p);
      const had = st.gen.get(t.id);
      if (had === undefined) {
        st.gen.set(t.id, f.gen);
        if (watched.has(t.id)) {
          // Watched it arrive already: the timeline was closed and reopened.
          st.shown.set(t.id, f.p);
        } else {
          /* Below nothing, on purpose: a box whose turn has not come is not
             drawn at all. "Don't have the elements add until you open the
             timeline" — a box sitting at zero for a second is a box that is
             already there and empty, which is not an arrival. */
          st.shown.set(t.id, -1);
          st.wait.set(t.id, queued++ * STAGGER_MS);
        }
      } else if (had !== f.gen) {
        st.gen.set(t.id, f.gen);
        st.shown.set(t.id, -1);
        st.wait.set(t.id, queued++ * STAGGER_MS);
      }
      if ((st.shown.get(t.id) ?? 1) < f.p) moving = true;
    }
    for (const id of [...st.shown.keys()]) if (!target.has(id)) { st.shown.delete(id); st.gen.delete(id); st.wait.delete(id); }
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
        /* Its turn has not come round yet: it holds at nothing, and the
           clock runs anyway, so six waiting boxes begin 200ms apart
           rather than one after another finishing. */
        const held = st.wait.get(id) ?? 0;
        if (held > 0) {
          st.wait.set(id, held - dt);
          still = true;
          continue;
        }
        // The moment it begins is the moment it counts as watched: leaving
        // and coming back does not make it arrive twice.
        watched.add(id);
        // Its turn: it starts from nothing, not from the sentinel.
        const next = Math.min(to, Math.max(0, at) + dt / WHOLE_MS);
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

/**
 * A card whose middle is not its own face.
 *
 * The cloud runs in a band at the top of a card and one at the bottom, and
 * not through the middle — because the middle of a card is not the card. A
 * green one is the site preview from its second row to its last but one; a
 * red one is the element. Both are opaque and both are over the cloud, so
 * cloud in the middle is paint nobody sees, composited on every frame that
 * anything on the page moves.
 *
 * It is half a construct's animated area, and animated area is what the
 * timeline pays for: at twelve boards, dropping it took 38% of frames lost
 * while idle to 14%.
 *
 * The band is asked for rather than assumed, and only the green cards ask.
 * A construct whose middle *is* its face gets a bare stripe through it, and
 * two kinds here are like that: a box on the Updates panel, which is nothing
 * but words on this material, and a red card, whose element is line and
 * glass rather than a plate. The red ones are also where there is least to
 * win — a fifth of a green card's area each.
 */

/** The corner the boxes are drawn with (`rounded-lg`). */
export const BOX_RADIUS = 8;

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
export function paintRim(c: CanvasRenderingContext2D, rim: { p: number; rect: { x: number; y: number; w: number; h: number }; start: Point }) {
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
 * One chain, left to right and wrapping, with a shove either way off the
 * thread's own id — enough that no two rows line up and the eye reads it as
 * a place rather than a grid.
 *
 * The sideways step used to come from how deep in the tree a thread was,
 * which is what made the timeline read as branches. It is the index now:
 * the chain runs in reading order, and the run is the same for everyone.
 */
export function scatter(nodes: ThreadNode[], aspect = 2, size: { w: number; h: number } = BOX): Map<string, Point> {
  const out = new Map<string, Point>();
  const step = { x: size.w + GAP.x, y: size.h + GAP.y };
  const across = acrossFor(nodes.length, aspect, step);
  nodes.forEach((n, i) => {
    const jx = seed(n.thread.id) - 0.5;
    const jy = seed(`${n.thread.id}y`) - 0.5;
    // The lean is kept: a row that started exactly under the one above read
    // as a table of results rather than a chain of them.
    const row = Math.floor(i / across);
    out.set(n.thread.id, {
      x: 140 + (i % across) * step.x + row * step.x * 0.16 + jx * 40,
      y: 130 + row * step.y + jy * 26,
    });
  });
  return out;
}

/** An element prompt is a drawing made real on one part; everything else is a chain prompt. */
export const isElement = (t: Thread) => t.mode === "drawing";

/** Orange, in the same oklch the rest of the board's hues are named in. */
export const GENERATION_HUE = 62;

/** What kind of iteration this is, in one word and one mark. */
export function kindOf(t: Thread): { icon: React.ReactNode; kind: string } {
  switch (t.mode) {
    case GENERATION:
      return { icon: <ImageIcon className="size-3.5" />, kind: "a picture generated" };
    case "drawing":
      return { icon: <Brush className="size-3.5" />, kind: "element prompt" };
    case "start":
      return { icon: <Flag className="size-3.5" />, kind: "where it began" };
    case LANE_MODE:
      return { icon: <GitBranch className="size-3.5" />, kind: "a lane, carried out" };
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
export const sizeOf = (t: Thread) => (isElement(t) ? PIECE : BOX);

/** The main update of an iteration: what it actually did, in a few words. */
export function headlineOf(t: Thread): string {
  if (t.changes.length) return t.changes[0]!;
  const title = threadTitle(t);
  const arrow = title.indexOf("→");
  return arrow > 0 ? title.slice(0, arrow).trim() : title;
}
