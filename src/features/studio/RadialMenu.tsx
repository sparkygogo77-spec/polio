"use client";
/**
 * The part menu: four quadrants round the pointer.
 *
 * Right-click a part and a ring of glass opens around the point you clicked,
 * cut into quadrants. The quadrant facing the middle of the screen is left
 * **empty** — that is where your eye and your next move already are, and it is
 * where the second level will open. The pointer keeps a small circle of clear
 * space, with the lock sitting in it as a tiny toggle: the one control that is
 * neither a menu nor a page away.
 *
 * Each working quadrant is cut once more, at a middle radius: an inner band
 * near the pointer and an outer block beyond it. That is what gives six
 * buttons out of three quadrants without any of them being a sliver.
 *
 *          empty  │  Animation (inner) · Prompt (outer)
 *        ─────────●─────────
 *         Delete  │  Duplicate · Edit (inner) · Looks (outer)
 *
 * Delete is the whole quadrant under the empty one, undivided — the same
 * outline as the quadrant opposite it, mirrored, so it reads as one slab and
 * never as a sliver you could hit by accident.
 *
 * Levels:
 *   1  blue     the six above, plus the lock in the middle
 *   2  green    replaces the blue entirely, in the quadrant that was empty
 *   3  amber    the one editor the green choice needs, in the quadrant
 *               opposite the green one
 *
 * Every piece is one SVG path — arc in, out along a seam, round the outside,
 * back down the next seam — so the geometry is the hit area. The outer edge is
 * cut square by default and can be swept round instead (the ◻/◯ chip on the
 * menu itself), which is the draft option to compare against.
 */
import * as React from "react";
import {
  AlignCenter, AlignLeft, AlignRight, Copy, FileText, Grid2x2, Highlighter, Link2, ListTree, Lock,
  Move, Palette as PaletteIcon, Play, Shapes, SlidersHorizontal, Sparkles, Tag, Trash2, Unlock, Wand2, X,
} from "lucide-react";
import { getFeature } from "./catalog";
import { isLinkable } from "./parts";
import { useStudio, type StudioNode } from "./store";
import { AuraConsole, Console, HueConsole, TextureConsole } from "./MenuConsole";
import { GLYPHS, HuePicker, OptionSet } from "./Inspector";
import { resolvePalette } from "./parts/theme";
import { ROLES, ROLE_LABEL, TEXTURE_KINDS } from "./look";
import { play } from "@/core/audio/engine";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { Select } from "@/core/ui/select";
import { Segmented } from "@/core/ui/segmented";

/* ------------------------------------------------------------------ */
/* Opening it                                                          */
/* ------------------------------------------------------------------ */

type Open = { nodeId: string; x: number; y: number } | null;
let current: Open = null;
const listeners = new Set<(v: Open) => void>();

export function openRadial(nodeId: string, x: number, y: number) {
  current = { nodeId, x, y };
  listeners.forEach((l) => l(current));
}
export function closeRadial() {
  current = null;
  listeners.forEach((l) => l(null));
}
/** Park the menu somewhere else without closing it or losing the part. */
export function moveRadial(x: number, y: number) {
  if (!current) return;
  current = { ...current, x, y };
  listeners.forEach((l) => l(current));
}
function useRadial(): Open {
  const [v, setV] = React.useState<Open>(current);
  React.useEffect(() => {
    listeners.add(setV);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}

/* ------------------------------------------------------------------ */
/* The ring                                                            */
/* ------------------------------------------------------------------ */

type Pt = [number, number];
type Shape = "square" | "round";

/**
 * The three radii, and a second set for the level below.
 *
 * The hole is wide enough for the lock to sit in it with room to spare and for
 * the pull-line to leave it cleanly; the bands are thick enough to hold an
 * icon over a word without either touching an edge; and the seam between the
 * inner band and the outer block is cut wider than the seams beside it,
 * because that is the one gap you read the ring's two rings by.
 *
 * Level two gets its own, larger set: it holds more choices than level one and
 * it is the only thing on screen when it is up, so it can afford the room.
 */
interface Rings { hole: number; mid: number; reach: number }
const BLUE_RINGS: Rings = { hole: 40, mid: 82, reach: 124 };
const GREEN_RINGS: Rings = { hole: 46, mid: 96, reach: 150 };

/** Clear space kept around the pointer, and the lock that sits in it. */
const HOLE = BLUE_RINGS.hole;
/** How far the widest ring reaches, for the viewport clamp. */
const REACH = GREEN_RINGS.reach;
/**
 * Corner radius. Every piece is drawn inset by this and grown back out with a
 * round-joined stroke of its own colour, which is what curves every corner —
 * including the one where a wedge narrows to a point at the pointer, which is
 * exactly where a wedge otherwise looks sharpest and worst.
 */
const ROUND = 5;
/** Clear space along every seam, in px. No two pieces ever touch. */
const SEAM = 7;
/** The seam between the inner band and the outer block, cut wider than the rest. */
const RING_SEAM = 12;
/** How much of that seam a piece takes back when you reach for it. */
const SWELL = 2;
/**
 * The pull: where the line starts showing, and how far out it takes hold.
 *
 * Between the two it fades up. At full strength it grips, and from there the
 * wheel follows your hand.
 */
const PULL_FROM = BLUE_RINGS.hole + 6;
const PULL_LOCK = BLUE_RINGS.reach + 16;

/**
 * Where the gesture has got to.
 *
 * `pull` — coming out, fading up. `armed` — locked at full stretch, waiting to
 * be taken across to the ring opposite. `turning` — loose, following your hand.
 */
type PullStage = "pull" | "armed" | "turning";
interface Pull {
  dx: number;
  dy: number;
  grip: number;
  stage: PullStage;
  /** The angle it locked at, in turns. The ring opposite sits half a turn on. */
  armed: number | null;
}
/** The dark line round a face, in px. */
const EDGE = 1.25;

const TURN = (t: number) => t * Math.PI * 2 - Math.PI / 2;

const onCircle = (t: number, r: number): Pt => {
  const a = TURN(t);
  return [Math.cos(a) * r, Math.sin(a) * r];
};

/** How far a square of half-width `half` reaches in the direction `t`. */
const squareR = (t: number, half: number): number => {
  const a = TURN(t);
  return half / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
};

const onSquare = (t: number, half: number): Pt => onCircle(t, squareR(t, half));

/** Turning the whole wheel: the geometry is drawn straight and spun at the end. */
const spun = (p: Pt, turns: number): Pt => {
  const a = turns * Math.PI * 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};

/** Where a piece's outer edge sits in the direction `t`, and how far out. */
function outerAt(t: number, rOut: number | "edge", shape: Shape, inset: number, rg: Rings): { p: Pt; r: number } {
  if (rOut !== "edge") {
    const r = rOut - inset;
    return { p: onCircle(t, r), r };
  }
  if (shape === "round") {
    const r = rg.reach - inset;
    return { p: onCircle(t, r), r };
  }
  const r = squareR(t, rg.reach - inset);
  return { p: onCircle(t, r), r };
}

const fmt = (v: Pt) => `${v[0].toFixed(1)} ${v[1].toFixed(1)}`;

/** The four corners of the square, as turns. */
const CORNERS = [0.125, 0.375, 0.625, 0.875];

/**
 * One piece of the ring, drawn inset by `ROUND` and half a seam.
 *
 * The angular inset is worked out per radius rather than fixed, so the seam is
 * the same number of pixels wide against the pointer as it is at the outer
 * edge. A fixed angle is wrong at both ends — a hairline inside and a canyon
 * outside — and it is the reason a ring like this reads as one shape with
 * lines drawn on it instead of as separate slabs.
 */
function piece(rawFrom: number, rawTo: number, rIn: number, rOut: number | "edge", shape: Shape, rg: Rings): string {
  // The seam runs round the ring as well as along it: where an inner band
  // meets the outer block above it, both have to give half of it up. That one
  // is cut wider than the seams beside it, because it is the gap you read the
  // ring's two rings by. The two edges with no neighbour — the hole at the
  // pointer and the outside — keep their full reach.
  const inSeam = rIn > rg.hole ? RING_SEAM / 2 : 0;
  const outSeam = rOut === "edge" ? 0 : RING_SEAM / 2;
  const rA = rIn + ROUND + inSeam;
  const pad = SEAM / 2 + ROUND;
  const turnPad = (r: number) => pad / (Math.PI * 2 * Math.max(12, r));

  const gA = turnPad(rA);
  const aFrom = rawFrom + gA;
  const aTo = rawTo - gA;
  // The outer end has its own inset, taken at the radius it actually reaches —
  // which on a square is much further out toward a corner.
  const gFrom = turnPad(outerAt(rawFrom, rOut, shape, ROUND + outSeam, rg).r);
  const gTo = turnPad(outerAt(rawTo, rOut, shape, ROUND + outSeam, rg).r);
  const bFrom = rawFrom + gFrom;
  const bTo = rawTo - gTo;
  // A piece too narrow to draw would fold inside out; collapse it to a sliver
  // at its own middle instead, where it is simply invisible.
  const mid = (rawFrom + rawTo) / 2;
  const [iFrom, iTo] = aTo > aFrom ? [aFrom, aTo] : [mid - 0.0005, mid + 0.0005];
  const [oFrom, oTo] = bTo > bFrom ? [bFrom, bTo] : [mid - 0.0005, mid + 0.0005];

  let d = `M ${fmt(onCircle(iFrom, rA))}`;
  d += ` A ${rA} ${rA} 0 0 1 ${fmt(onCircle(iTo, rA))}`;
  d += ` L ${fmt(outerAt(oTo, rOut, shape, ROUND + outSeam, rg).p)}`;
  if (rOut === "edge" && shape === "square") {
    // Walk the square backwards, landing on every corner between the two ends,
    // so a piece that turns a corner turns it at a right angle instead of
    // cutting it off with a chord.
    const half = rg.reach - ROUND;
    for (const c of [...CORNERS].reverse()) if (c > oFrom && c < oTo) d += ` L ${fmt(onSquare(c, half))}`;
    d += ` L ${fmt(outerAt(oFrom, rOut, shape, ROUND, rg).p)}`;
  } else {
    const r = outerAt(oFrom, rOut, shape, ROUND + outSeam, rg).r;
    d += ` A ${r} ${r} 0 0 0 ${fmt(outerAt(oFrom, rOut, shape, ROUND + outSeam, rg).p)}`;
  }
  return `${d} Z`;
}

/** The middle of a piece, where its icon and word sit. */
function middleOf(from: number, to: number, rIn: number, rOut: number | "edge", shape: Shape, rg: Rings): Pt {
  const mid = (from + to) / 2;
  const a = onCircle(mid, rIn + ROUND + (rIn > rg.hole ? RING_SEAM / 2 : 0));
  const b = outerAt(mid, rOut, shape, ROUND + (rOut === "edge" ? 0 : RING_SEAM / 2), rg).p;
  // Not quite the middle: a band is wider the further out you go, and a word
  // pushed a little outward stops hanging over its neighbours.
  return [a[0] * 0.4 + b[0] * 0.6, a[1] * 0.4 + b[1] * 0.6];
}

/* ------------------------------------------------------------------ */
/* Which quadrant is which                                             */
/* ------------------------------------------------------------------ */

/** Quadrants as turn ranges, clockwise from straight up. */
const QUADS: [number, number][] = [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]];

/**
 * The layout never changes, and that is the point.
 *
 * It used to swing round so the empty quadrant faced the middle of the screen,
 * which meant the menu was a different shape depending on where you clicked
 * and your hand could never learn it. Delete is bottom-left. Looks is
 * bottom-right. Always. The one thing that moves it is `menuSpin` — hold the
 * right button down and drag, and the whole wheel turns to wherever you want
 * it, and stays there.
 */
const Q_TOP = 0;
const Q_BOTTOM = 1;
const Q_DELETE = 2;
const Q_EMPTY = 3;

/* ------------------------------------------------------------------ */
/* What is on it                                                       */
/* ------------------------------------------------------------------ */

type SlotId = "anim" | "prompt" | "duplicate" | "edit" | "look" | "delete";

interface Slot {
  id: SlotId;
  label: string;
  icon: typeof Wand2;
  hue: number;
  /** A group opens the green level; an action fires and closes. */
  kind: "group" | "action";
}

const SLOTS: Record<SlotId, Slot> = {
  // One neon blue for the whole first level, so it reads as one object.
  // Prompt leans violet — far enough to find, near enough to belong — and
  // Delete is the only red thing on the screen.
  anim: { id: "anim", label: "Animation", icon: Play, hue: 205, kind: "group" },
  prompt: { id: "prompt", label: "Prompt", icon: Wand2, hue: 258, kind: "group" },
  duplicate: { id: "duplicate", label: "Duplicate", icon: Copy, hue: 205, kind: "action" },
  edit: { id: "edit", label: "Edit", icon: ListTree, hue: 205, kind: "group" },
  look: { id: "look", label: "Looks", icon: PaletteIcon, hue: 205, kind: "group" },
  delete: { id: "delete", label: "Delete", icon: Trash2, hue: 18, kind: "action" },
};

const GREEN = 148;
/**
 * The choices that open a console rather than a row of controls: the ones
 * about *looks*, where picking from a drawn spectrum beats reading a list.
 */
const CONSOLES = new Set(["hue", "texture", "aura"]);
/**
 * The third level. Red, because it is the only colour left that is neither the
 * blue of the first level nor the green of the second, and because the two are
 * never on screen together — Delete is long gone by the time an editor opens.
 */
const CRIMSON = 18;

/** How a part arrives on the page. The values are CSS animation names. */
export const ENTRANCES: { value: string; label: string }[] = [
  { value: "", label: "No entrance" },
  { value: "el-fade", label: "Fade in" },
  { value: "el-rise", label: "Rise" },
  { value: "el-drop", label: "Drop" },
  { value: "el-left", label: "In from the left" },
  { value: "el-right", label: "In from the right" },
  { value: "el-grow", label: "Grow" },
  { value: "el-blur", label: "Come into focus" },
  { value: "el-flip", label: "Tip up" },
];

/** What the green level holds for each blue group. */
interface Choice {
  id: string;
  label: string;
  icon: typeof Wand2;
  /** Fires on the spot; without one the choice opens its editor in amber. */
  act?: (n: StudioNode) => void;
}

function choicesFor(group: SlotId): Choice[] {
  const s = () => useStudio.getState();
  switch (group) {
    case "look":
      return [
        { id: "hue", label: "Hue", icon: PaletteIcon },
        { id: "texture", label: "Texture", icon: Grid2x2 },
        { id: "aura", label: "Aura", icon: Sparkles },
      ];
    case "anim":
      return [
        { id: "el-fade", label: "Fade", icon: Play, act: (n) => s().updateNode(n.id, { anim: "el-fade" }) },
        { id: "el-rise", label: "Rise", icon: Play, act: (n) => s().updateNode(n.id, { anim: "el-rise" }) },
        { id: "el-grow", label: "Grow", icon: Play, act: (n) => s().updateNode(n.id, { anim: "el-grow" }) },
        { id: "entrance", label: "All of them", icon: ListTree },
      ];
    case "prompt":
      return [
        { id: "words", label: "Words", icon: Wand2 },
        { id: "priority", label: "Priority", icon: Tag },
      ];
    default:
      return [
        { id: "name", label: "Name", icon: Tag },
        { id: "contents", label: "Contents", icon: ListTree },
        // The per-part options — shape, columns, autoplay — used to live only
        // in the panel, which meant the panel was not optional.
        { id: "options", label: "Options", icon: SlidersHorizontal },
        { id: "size", label: "Size", icon: Move },
        { id: "links", label: "Links", icon: Link2 },
        { id: "data", label: "Data", icon: FileText },
        // Edit is the catch-all — everything else the app lets you change
        // about one part. The board tint and the glyph mark it on the canvas
        // rather than on the site, and they were the last two things the
        // right panel could do that the menu could not.
        { id: "tint", label: "Tint", icon: Highlighter },
        { id: "glyph", label: "Glyph", icon: Shapes },
      ];
  }
}

/* ------------------------------------------------------------------ */
/* The menu                                                            */
/* ------------------------------------------------------------------ */

/** Is a part menu open? The toolbar's shape chip lights up when it is. */
export function useRadialOpen(): boolean {
  return useRadial() !== null;
}

export function RadialMenu() {
  const open = useRadial();
  const [picked, setPicked] = React.useState<SlotId | null>(null);
  const [subPick, setSubPick] = React.useState<string | null>(null);
  const nodes = useStudio((s) => s.nodes);
  const shape = useStudio((s) => s.menuShape);
  const spin = useStudio((s) => s.menuSpin);
  const node = open ? nodes.find((n) => n.id === open.nodeId) : undefined;

  React.useEffect(() => {
    if (!open) { setPicked(null); setSubPick(null); }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (subPick) setSubPick(null);
      else if (picked) setPicked(null);
      else closeRadial();
    };
    const onDown = (e: PointerEvent) => {
      // The right button is the turning handle, not a way out.
      if (e.button === 2) return;
      const el = e.target as HTMLElement;
      // Three things outside the menu still belong to it: a select's list,
      // which opens in a portal rather than inside the menu; the toolbar's
      // shape chip, which is only worth having where it is if you can flip it
      // and watch the open menu change; and the part the menu is *about* —
      // carry on clicking your own element and the menu stays, so it can be
      // parked aside and worked against. Anything else puts it away.
      if (el.closest?.("[data-radial], [data-menu-shape], [data-radix-popper-content-wrapper], [role='listbox'], [role='option']")) return;
      if (el.closest?.(`[data-node-id="${open.nodeId}"]`)) return;
      closeRadial();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, picked, subPick]);

  /*
   * Pull it out, take it across, then turn.
   *
   * Holding the right button and dragging used to start turning the moment you
   * cleared the hole, which meant a right-click that wandered a few pixels
   * spun the menu by accident. Reaching full stretch was not enough either —
   * the pull and the turn were the same motion, so it still turned as soon as
   * you had pulled.
   *
   * So it arms in two moves, and both are drawn. Pull the green line out and
   * it fades up as it lengthens; at full stretch it **locks**, and the only
   * place it can go from there is the other side — a crimson ring appears
   * exactly opposite to say where. Take it across, through the middle and out
   * to that ring, and only then does the wheel come loose and follow your
   * hand. Nothing snaps: it stops where you let go, and it is remembered.
   */
  const anchor = React.useRef({ x: 0, y: 0 });
  if (open) anchor.current = { x: open.x, y: open.y };
  const [pull, setPull] = React.useState<Pull | null>(null);
  React.useEffect(() => {
    if (!open) return;
    let stage: PullStage = "pull";
    let armed = 0;
    // Set by a turn, cleared by the context menu it swallows.
    let turned = false;
    let grabbed = 0;
    let was = 0;
    let want = useStudio.getState().menuSpin;
    let frame = 0;
    let showing = false;
    const show = (v: Pull | null) => {
      if (!v && !showing) return;
      showing = !!v;
      setPull(v);
    };
    const angle = (e: PointerEvent) =>
      Math.atan2(e.clientY - anchor.current.y, e.clientX - anchor.current.x) / (Math.PI * 2);
    const step = () => {
      const now = useStudio.getState().menuSpin;
      let d = want - now;
      while (d > 0.5) d -= 1;
      while (d < -0.5) d += 1;
      if (Math.abs(d) < 0.0006) { useStudio.getState().setMenuSpin(want); frame = 0; return; }
      useStudio.getState().setMenuSpin(now + d * 0.2);
      frame = requestAnimationFrame(step);
    };
    const reset = () => { stage = "pull"; show(null); };
    const onMove = (e: PointerEvent) => {
      if (!(e.buttons & 2)) return reset();
      const dx = e.clientX - anchor.current.x;
      const dy = e.clientY - anchor.current.y;
      const len = Math.hypot(dx, dy);
      const a = angle(e);

      if (stage === "pull") {
        // 0 inside the hole, 1 at full stretch. That number is the line's
        // opacity, and reaching 1 is what locks it.
        const grip = Math.max(0, Math.min(1, (len - PULL_FROM) / (PULL_LOCK - PULL_FROM)));
        if (grip >= 1) { stage = "armed"; armed = a; play("select"); }
        show({ dx, dy, grip, stage, armed: stage === "pull" ? null : armed });
        return;
      }

      if (stage === "armed") {
        // The only way on is the other side: far enough out, and turned
        // most of the way round from where it locked.
        const gap = Math.abs(a - armed) % 1;
        const apart = Math.min(gap, 1 - gap);
        if (len > PULL_LOCK * 0.82 && apart > 0.4) {
          stage = "turning";
          turned = true;
          grabbed = a;
          was = useStudio.getState().menuSpin;
          play("confirm");
        }
        show({ dx, dy, grip: 1, stage, armed });
        return;
      }

      show({ dx, dy, grip: 1, stage, armed });
      want = was + (a - grabbed);
      if (!frame) frame = requestAnimationFrame(step);
    };
    const onUp = () => reset();
    /*
     * The right button lets go at the end of a turn, and the browser answers
     * with a context menu — the app's own, over the wheel you were just
     * arranging. A turn eats that one event. A right-click that did not turn
     * anything still means what it always meant: put this menu away.
     */
    const onMenu = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (turned) {
        turned = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // A right press on the menu, or on the part the menu is about, is the
      // start of a pull — not a request for another menu on top of this one.
      // Swallowing it in the capture phase is the only place that works: the
      // app's own context menu listens further down, and preventDefault alone
      // does not stop it.
      if (el.closest?.("[data-radial]") || el.closest?.(`[data-node-id="${open.nodeId}"]`)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      closeRadial();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("contextmenu", onMenu, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("contextmenu", onMenu, true);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [open]);

  /*
   * Push the menu aside without closing it.
   *
   * A menu that sits over the part you are editing is a menu you have to shut
   * to see your own work. Press the middle and drag and it moves, so it can be
   * parked wherever there is room while you keep working on the same element.
   */
  const dragged = React.useRef(false);
  const carry = (e: React.PointerEvent) => {
    if (e.button !== 0 || !open) return;
    const from = { x: e.clientX, y: e.clientY, ox: open.x, oy: open.y };
    dragged.current = false;
    const move = (m: PointerEvent) => {
      const dx = m.clientX - from.x;
      const dy = m.clientY - from.y;
      if (!dragged.current && Math.hypot(dx, dy) < 4) return;
      dragged.current = true;
      moveRadial(from.ox + dx, from.oy + dy);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  if (!open || !node) return null;

  const s = () => useStudio.getState();
  const margin = REACH + 26;
  const px = Math.max(margin, Math.min(window.innerWidth - margin, open.x));
  const py = Math.max(margin, Math.min(window.innerHeight - margin, open.y));

  const fire = (id: SlotId) => {
    if (id === "duplicate") { s().duplicateNodes([node.id]); play("confirm"); closeRadial(); }
    if (id === "delete") { s().removeNodes([node.id]); play("deny"); closeRadial(); }
  };
  const take = (slot: Slot) => {
    if (slot.kind === "action") return fire(slot.id);
    play("select");
    setSubPick(null);
    setPicked(slot.id);
  };

  /* ---------------------------------------------------------- level 1 */
  const [topA, topB] = QUADS[Q_TOP]!;
  const [botA, botB] = QUADS[Q_BOTTOM]!;
  const [delA, delB] = QUADS[Q_DELETE]!;
  const botMid = (botA + botB) / 2;

  const B = BLUE_RINGS;
  const level1: { slot: Slot; d: string; at: Pt }[] = [
    { slot: SLOTS.anim, d: piece(topA, topB, B.hole, B.mid, shape, B), at: middleOf(topA, topB, B.hole, B.mid, shape, B) },
    { slot: SLOTS.prompt, d: piece(topA, topB, B.mid, "edge", shape, B), at: middleOf(topA, topB, B.mid, "edge", shape, B) },
    { slot: SLOTS.duplicate, d: piece(botA, botMid, B.hole, B.mid, shape, B), at: middleOf(botA, botMid, B.hole, B.mid, shape, B) },
    { slot: SLOTS.edit, d: piece(botMid, botB, B.hole, B.mid, shape, B), at: middleOf(botMid, botB, B.hole, B.mid, shape, B) },
    { slot: SLOTS.look, d: piece(botA, botB, B.mid, "edge", shape, B), at: middleOf(botA, botB, B.mid, "edge", shape, B) },
    // Delete is the whole quadrant, mirrored from the one opposite it and not
    // cut up: one slab, so it can never be hit as a sliver.
    { slot: SLOTS.delete, d: piece(delA, delB, B.hole, "edge", shape, B), at: middleOf(delA, delB, B.hole, "edge", shape, B) },
  ];

  /* ---------------------------------------------------------- level 2 */
  const group = picked ? SLOTS[picked] : null;
  const choices = picked ? choicesFor(picked) : [];
  // Green fills the quadrant that was empty, cut the same way the blue ones
  // are. More than four choices will not fit there without becoming slivers,
  // so it takes the quadrant below as well — the blue level is gone by then,
  // so there is nothing down there for it to cover.
  const wide = choices.length > 4;
  const greenFrom = QUADS[Q_EMPTY]![0] - (wide ? 0.25 : 0);
  const greenTo = QUADS[Q_EMPTY]![1];
  // The outer ring is longer than the inner band at every angle — twice over
  // on a square, where it runs out to a corner — so it carries more of them.
  // Splitting down the middle made the inner pieces slivers as soon as a group
  // had more than four things in it.
  const outerCount = Math.ceil(choices.length * 0.55);
  const innerCount = choices.length - outerCount;
  const span = greenTo - greenFrom;
  const G = GREEN_RINGS;
  const greenPieces = choices.map((c, i) => {
    const outer = i >= innerCount;
    const n = outer ? outerCount : innerCount;
    const k = outer ? i - innerCount : i;
    const a = greenFrom + (span * k) / n;
    const b = greenFrom + (span * (k + 1)) / n;
    return {
      choice: c,
      d: piece(a, b, outer ? G.mid : G.hole, outer ? "edge" : G.mid, shape, G),
      at: middleOf(a, b, outer ? G.mid : G.hole, outer ? "edge" : G.mid, shape, G),
    };
  });

  /* ---------------------------------------------------------- level 3 */
  // The editor takes the green level's place rather than opening beside it:
  // the green goes away, and the same corner of the screen becomes the panel.
  const editing = subPick && !choicesFor(group?.id ?? "edit").find((c) => c.id === subPick)?.act ? subPick : null;
  const outward = spun(onCircle((greenFrom + greenTo) / 2, 1), spin);
  const backAt = spun(onSquare((greenFrom + greenTo) / 2, GREEN_RINGS.reach + 14), spin);

  return (
    // Above the top bar and the status bar, or a menu opened near an edge has
    // pieces behind the chrome, unreachable.
    <div
      data-radial
      className="pointer-events-none fixed inset-0 z-[68]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute" style={{ left: px, top: py }}>
        {pull ? <PullLines pull={pull} /> : null}

        {!picked ? (
          <Ring spin={spin} pieces={level1.map((p) => ({
            id: p.slot.id,
            label: p.slot.label,
            icon: p.slot.icon,
            hue: p.slot.hue,
            d: p.d,
            at: p.at,
            onPick: () => take(p.slot),
          }))} />
        ) : null}

        {/* the lock lives in the clear circle, at the pointer */}
        {editing ? null : <button
          type="button"
          aria-label={node.locked ? "Unlock" : "Lock in place"}
          aria-pressed={node.locked}
          data-menu-lock=""
          onPointerDown={carry}
          onClick={() => {
            // A drag moved the menu; it was not a press on the lock.
            if (dragged.current) { dragged.current = false; return; }
            play(node.locked ? "confirm" : "close");
            s().updateNode(node.id, { locked: !node.locked });
          }}
          className="pointer-events-auto absolute flex size-[30px] -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full transition-colors active:cursor-grabbing"
          style={{
            background: node.locked ? `oklch(0.72 0.16 60)` : `oklch(0.28 0.02 250)`,
            border: `1px solid oklch(${node.locked ? "0.52 0.14 60" : "0.44 0.02 250"})`,
            color: node.locked ? "oklch(0.2 0.06 60)" : "oklch(0.86 0.02 250)",
          }}
        >
          {node.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
        </button>}

        {group && !editing ? (
          <div data-radial-panel={group.id} className="pointer-events-auto absolute left-0 top-0">
            <Ring
              spin={spin}
              green
              pieces={greenPieces.map((p) => ({
                id: p.choice.id,
                label: p.choice.label,
                icon: p.choice.icon,
                hue: GREEN,
                d: p.d,
                at: p.at,
                on: p.choice.id === subPick,
                onPick: () => {
                  play("select");
                  if (p.choice.act) p.choice.act(node);
                  setSubPick(p.choice.id);
                },
              }))}
            />
            {/* back out of the green level without closing the whole thing */}
            <button
              type="button"
              aria-label="Back to the menu"
              onClick={() => { play("close"); setPicked(null); setSubPick(null); }}
              className="pointer-events-auto absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
              style={{
                left: backAt[0],
                top: backAt[1],
                background: `oklch(0.66 0.15 ${GREEN})`,
                color: "oklch(0.18 0.05 148)",
              }}
            >
              <X className="size-3" />
            </button>
          </div>
        ) : null}
      </div>

      {group && editing ? (
        <QuadrantPanel x={px} y={py} which={editing}>
          <Console
            title={choices.find((c) => c.id === editing)?.label ?? "Edit"}
            onGrip={carry}
            onBack={() => { play("close"); setSubPick(null); }}
          >
            <Editor which={editing} node={node} />
          </Console>
        </QuadrantPanel>
      ) : null}
    </div>
  );
}

/**
 * The gesture, drawn.
 *
 * Green runs to your hand and fades up as it lengthens; crimson runs the same
 * distance the other way, through the middle, because you judge an angle by
 * the far end of a bar and not by the end in your hand.
 *
 * Once it locks, a green ring marks where it locked and a crimson ring appears
 * exactly opposite — that is the only place it can go, and it is drawn so you
 * do not have to be told. Reaching that ring is what lets the wheel turn.
 */
function PullLines({ pull }: { pull: Pull }) {
  const solid = pull.stage !== "pull";
  const lockAt = pull.armed === null ? null : onCircle(((pull.armed + 0.25) % 1 + 1) % 1, PULL_LOCK);
  const cross = pull.armed === null ? null : onCircle(((pull.armed + 0.75) % 1 + 1) % 1, PULL_LOCK);
  const done = pull.stage === "turning";
  return (
    <svg width={1} height={1} className="pointer-events-none absolute left-0 top-0 overflow-visible">
      <line
        x1={0} y1={0} x2={-pull.dx} y2={-pull.dy}
        stroke={`oklch(0.62 0.22 ${CRIMSON})`}
        strokeOpacity={pull.grip * 0.85}
        strokeWidth={solid ? 4 : 3}
        strokeLinecap="round"
        strokeDasharray={solid ? undefined : "7 6"}
      />
      <line
        data-pull-line=""
        x1={0} y1={0} x2={pull.dx} y2={pull.dy}
        stroke={`oklch(0.74 0.2 ${GREEN})`}
        strokeOpacity={pull.grip}
        strokeWidth={solid ? 4 : 3}
        strokeLinecap="round"
        strokeDasharray={solid ? undefined : "7 6"}
      />
      {/* where it locked */}
      {lockAt ? (
        <circle
          cx={lockAt[0]} cy={lockAt[1]} r={9}
          fill="none"
          stroke={`oklch(0.8 0.2 ${GREEN})`}
          strokeWidth={3}
        />
      ) : null}
      {/* and the only place it can go from there */}
      {cross ? (
        <circle
          data-pull-target=""
          cx={cross[0]} cy={cross[1]} r={done ? 7 : 11}
          fill={done ? `oklch(0.7 0.22 ${CRIMSON})` : "none"}
          stroke={`oklch(0.72 0.22 ${CRIMSON})`}
          strokeWidth={3}
          strokeDasharray={done ? undefined : "5 4"}
        >
          {done ? null : (
            <animate attributeName="r" values="11;14;11" dur="1.1s" repeatCount="indefinite" />
          )}
        </circle>
      ) : null}
      <circle
        cx={pull.dx} cy={pull.dy} r={solid ? 7 : 4}
        fill={`oklch(0.78 0.2 ${done ? CRIMSON : GREEN})`}
        fillOpacity={pull.grip}
      />
    </svg>
  );
}

/**
 * The third level: the console, filling the wheel's own footprint.
 *
 * It was a box hung off one corner of the ring — a different size for every
 * editor, sitting beside the menu rather than being it, with three empty
 * quadrants left behind. Now it takes the square the wheel stood in: the same
 * middle, the same reach, covering all four quadrants at once. One frame, one
 * size, whatever is inside it. That is the whole difference between a menu
 * that turns into an editor and a menu that spawns a dialog.
 */
const CONSOLE_W = GREEN_RINGS.reach * 2;

function QuadrantPanel({ x, y, which, children }: { x: number; y: number; which: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [h, setH] = React.useState(CONSOLE_W);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setH((prev) => (Math.abs(prev - r.height) > 1 ? r.height : prev));
  });
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  // Centred on the click, then pushed back on screen if the click was near an
  // edge — the wheel is clamped the same way, so the two land together.
  const left = Math.max(10, Math.min(vw - CONSOLE_W - 10, x - CONSOLE_W / 2));
  const top = Math.max(10, Math.min(vh - h - 10, y - h / 2));
  return (
    <div
      ref={ref}
      data-radial-editor={which}
      className="pointer-events-auto fixed rounded-2xl p-3"
      style={{
        width: CONSOLE_W,
        // The drawn editors want the whole footprint; a one-line name box does
        // not, and stretching it to fill one is just a taller empty box.
        minHeight: CONSOLES.has(which) ? CONSOLE_W * 0.62 : undefined,
        left,
        top,
        // Grey, not red: the console is a slab you work on, and the red is the
        // aura round it saying which level you are on. A red panel with red
        // controls on it had nothing left to say "this one is picked".
        background: "oklch(0.29 0.02 20)",
        border: `1.5px solid oklch(0.58 0.2 ${CRIMSON})`,
        boxShadow: `0 0 0 1px oklch(0.2 0.05 ${CRIMSON}), 0 0 22px oklch(0.55 0.22 ${CRIMSON} / 0.45), 0 14px 32px oklch(0 0 0 / 0.5)`,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drawing the pieces                                                  */
/* ------------------------------------------------------------------ */

interface RingPiece {
  id: string;
  label: string;
  icon: typeof Wand2;
  hue: number;
  d: string;
  at: Pt;
  on?: boolean;
  onPick: () => void;
}

/** One flat colour, and a darker line round it. */
const face = (hue: number, lit: boolean) => `oklch(${lit ? 0.74 : 0.66} ${lit ? 0.17 : 0.155} ${hue})`;
const rim = (hue: number, lit: boolean) => `oklch(${lit ? 0.38 : 0.44} ${lit ? 0.16 : 0.14} ${hue})`;

/**
 * A slab of one colour with a darker line round it.
 *
 * It used to be a vertical gradient under a heavy drop shadow, which is a look
 * that has been dated for about fifteen years and made every piece read as a
 * lump of dark glass. One flat colour reads as one button. The old *hover*
 * colour is the resting colour now and hovering goes a step brighter again, so
 * the whole thing sits lighter on the page and reaching for something still
 * changes it.
 *
 * The rounded corners are the stroke: the path is drawn inset by `ROUND` and
 * grown back with a round-joined stroke of its own colour. That is also what
 * makes the swell work — a hovered piece just strokes wider, taking a couple
 * of pixels back out of the seam it was given, which is why the seams are cut
 * wider than they need to look.
 */
function Ring({ pieces, green, spin }: { pieces: RingPiece[]; green?: boolean; spin: number }) {
  const [hot, setHot] = React.useState<string | null>(null);
  const nudge = (at: Pt, lit: boolean): Pt => {
    if (!lit) return [0, 0];
    const len = Math.max(1, Math.hypot(at[0], at[1]));
    return [(at[0] / len) * 1.5, (at[1] / len) * 1.5];
  };
  return (
    <>
      <svg width={1} height={1} className="absolute left-0 top-0 overflow-visible">
        <g transform={`rotate(${(spin * 360).toFixed(2)})`}>
          {pieces.map((p) => {
            const lit = hot === p.id || p.on;
            const faceW = 2 * (ROUND + (lit ? SWELL : 0));
            const n = nudge(p.at, !!lit);
            return (
              <g
                key={p.id}
                style={{ transform: `translate(${n[0]}px, ${n[1]}px)`, transition: "transform 130ms ease-out" }}
              >
                <path
                  role="button"
                  tabIndex={0}
                  aria-label={p.label}
                  aria-pressed={p.on}
                  data-shard={p.id}
                  d={p.d}
                  onClick={p.onPick}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.onPick(); } }}
                  onPointerEnter={() => setHot(p.id)}
                  onPointerLeave={() => setHot((h) => (h === p.id ? null : h))}
                  className="pointer-events-auto cursor-pointer outline-none"
                  fill={rim(p.hue, !!lit)}
                  stroke={rim(p.hue, !!lit)}
                  strokeWidth={faceW + EDGE * 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  style={{ transition: "stroke-width 130ms ease-out, fill 130ms ease-out, stroke 130ms ease-out" }}
                />
                <path
                  d={p.d}
                  className="pointer-events-none"
                  fill={face(p.hue, !!lit)}
                  stroke={face(p.hue, !!lit)}
                  strokeWidth={faceW}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  style={{ transition: "stroke-width 130ms ease-out, fill 130ms ease-out, stroke 130ms ease-out" }}
                />
              </g>
            );
          })}
        </g>
      </svg>
      {pieces.map((p) => {
        const Icon = p.icon;
        const lit = hot === p.id || p.on;
        const n = nudge(p.at, !!lit);
        const at = spun([p.at[0] + n[0], p.at[1] + n[1]], spin);
        return (
          <span
            key={p.id}
            aria-hidden
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-[8.5px] font-semibold leading-tight tracking-tight"
            style={{
              left: at[0],
              top: at[1],
              color: "oklch(0.99 0 0)",
              textShadow: `0 1px 2px oklch(0.25 0.08 ${p.hue} / 0.75)`,
              transition: "left 130ms ease-out, top 130ms ease-out",
            }}
          >
            <Icon className="size-[14px]" strokeWidth={green ? 1.9 : 2.1} />
            <span className="whitespace-nowrap">{p.label}</span>
          </span>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The one editor a green choice asked for                             */
/* ------------------------------------------------------------------ */

/**
 * A labelled row inside the editor. The label is optional, because the panel
 * already has the choice's name across the top of it and printing it twice
 * reads as a mistake.
 */
function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <label className="mb-2 flex flex-col gap-1 last:mb-0">
      {label ? (
        <span className="text-[9px] uppercase tracking-wider" style={{ color: "oklch(0.94 0.06 20)" }}>{label}</span>
      ) : null}
      {children}
    </label>
  );
}

function Editor({ which, node }: { which: string; node: StudioNode }) {
  const feature = getFeature(node.featureId);
  const frameWidth = useStudio((s) => s.frameWidth);
  const pages = useStudio((s) => s.pages);
  const format = useStudio((st) => st.format);
  const look = useStudio((st) => st.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const s = () => useStudio.getState();
  const update = (patch: Partial<StudioNode>) => s().updateNode(node.id, patch);

  if (which === "hue") {
    return <HueConsole colour={node.colour} palette={palette} onChange={(colour) => update({ colour })} />;
  }
  if (which === "texture") {
    return (
      <TextureConsole
        value={node.texture}
        layers={look.texture ?? []}
        palette={palette}
        onChange={(texture) => update({ texture })}
      />
    );
  }
  if (which === "aura") {
    return <AuraConsole value={node.aura} palette={palette} onChange={(aura) => update({ aura })} />;
  }
  if (which === "tint") {
    return (
      <Row>
        <HuePicker value={node.hue} onChange={(h) => update({ hue: h })} />
      </Row>
    );
  }
  if (which === "glyph") {
    return (
      <Row>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            aria-label="No glyph"
            onClick={() => update({ glyph: null })}
            className="flex size-6 items-center justify-center rounded-sm border text-[10px]"
            style={{ borderColor: node.glyph === null ? "oklch(0.92 0.05 20)" : "oklch(0.62 0.2 18)" }}
          >
            <PaletteIcon className="size-3" />
          </button>
          {GLYPHS.map((g) => (
            <button
              key={g}
              type="button"
              aria-label={`Glyph ${g}`}
              onClick={() => update({ glyph: g })}
              className="flex size-6 items-center justify-center rounded-sm border text-xs"
              style={{ borderColor: node.glyph === g ? "oklch(0.92 0.05 20)" : "oklch(0.62 0.2 18)" }}
            >
              {g}
            </button>
          ))}
        </div>
      </Row>
    );
  }
  if (which === "options") {
    return feature?.options?.length ? (
      <div className="max-h-[280px] space-y-2 overflow-y-auto">
        {feature.options.map((opt) =>
          opt.kind === "set" ? (
            <OptionSet
              key={opt.id}
              option={opt}
              value={node.options[opt.id]}
              onChange={(v) => update({ options: { ...node.options, [opt.id]: v } })}
            />
          ) : (
            <Row key={opt.id} label={opt.label}>
              <Select
                value={node.options[opt.id] ?? opt.values[0]!}
                onChange={(v) => update({ options: { ...node.options, [opt.id]: v } })}
                options={opt.values.map((v) => ({ value: v, label: v }))}
                aria-label={opt.label}
              />
            </Row>
          ),
        )}
      </div>
    ) : (
      <p className="text-[10px]" style={{ color: "oklch(0.92 0.05 20)" }}>This part has nothing to set.</p>
    );
  }
  if (which === "entrance") {
    return (
      <Row>
        <Select
          value={node.anim ?? ""}
          onChange={(v) => update({ anim: v || null })}
          options={ENTRANCES}
          aria-label="How it arrives"
        />
      </Row>
    );
  }
  if (which === "words") {
    return (
      <Row>
        <Textarea autoGrow rows={3} value={node.prompt} aria-label="Element prompt" placeholder={feature?.hint ?? "Specific to this placement…"} onChange={(e) => update({ prompt: e.target.value })} />
      </Row>
    );
  }
  if (which === "priority") {
    return (
      <Row>
        <Segmented
          size="xs"
          value={node.priority}
          onChange={(v) => update({ priority: v as "must" })}
          options={[{ value: "must", label: "Must" }, { value: "nice", label: "Nice" }, { value: "idea", label: "Idea" }]}
          aria-label="Priority"
        />
      </Row>
    );
  }
  if (which === "name") {
    return (
      <Row>
        <Input value={node.label} aria-label="Name" onChange={(e) => update({ label: e.target.value })} />
      </Row>
    );
  }
  if (which === "contents") {
    return feature?.content ? (
      <Row label={feature.content.label}>
        <Textarea autoGrow rows={3} value={node.content} aria-label={feature.content.label} placeholder={feature.content.placeholder} onChange={(e) => update({ content: e.target.value })} />
      </Row>
    ) : (
      <p className="text-[10px] text-fg-muted">This part has nothing to list inside it.</p>
    );
  }
  if (which === "size") {
    return (
      <>
        <div className="mb-1.5 grid grid-cols-4 gap-1">
          {(["x", "y", "w", "h"] as const).map((k) => (
            <label key={k} className="flex flex-col gap-0.5">
              <span className="text-[9px] uppercase text-fg-faint">{k === "w" ? "Width" : k === "h" ? "Height" : k}</span>
              <Input
                type="number"
                inputSize="sm"
                className="px-1"
                value={String(Math.round(node[k]))}
                aria-label={k === "w" ? "Width" : k === "h" ? "Height" : k.toUpperCase()}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) update({ [k]: k === "w" ? Math.max(40, v) : k === "h" ? Math.max(24, v) : v } as Partial<StudioNode>);
                }}
              />
            </label>
          ))}
        </div>
        <div className="flex gap-1">
          <button type="button" aria-label="Flush left" onClick={() => update({ x: 0 })} className="tactile flex-1 rounded-sm border border-border py-1 text-fg-muted hover:text-fg"><AlignLeft className="mx-auto size-3" /></button>
          <button type="button" aria-label="Centre" onClick={() => update({ x: Math.round((frameWidth - node.w) / 2) })} className="tactile flex-1 rounded-sm border border-border py-1 text-fg-muted hover:text-fg"><AlignCenter className="mx-auto size-3" /></button>
          <button type="button" aria-label="Flush right" onClick={() => update({ x: frameWidth - node.w })} className="tactile flex-1 rounded-sm border border-border py-1 text-fg-muted hover:text-fg"><AlignRight className="mx-auto size-3" /></button>
          <button type="button" onClick={() => update({ x: 0, w: frameWidth })} className="tactile flex-[2] rounded-sm border border-border py-1 text-[10px] text-fg-muted hover:text-fg">Full width</button>
        </div>
      </>
    );
  }
  if (which === "links") {
    const link = node.link;
    return (
      <>
        {isLinkable(node.featureId) ? (
          <Row label="Links to">
            <Select
              value={!link ? "none" : link.kind === "page" ? `page:${link.target}` : "url"}
              onChange={(v) => update({ link: v === "none" ? null : v === "url" ? { kind: "url", target: "https://" } : { kind: "page", target: v.slice(5) } })}
              options={[{ value: "none", label: "Nowhere" }, ...pages.map((p) => ({ value: `page:${p.id}`, label: p.name })), { value: "url", label: "Web address…" }]}
              aria-label="Links to"
            />
          </Row>
        ) : (
          <p className="text-[10px] text-fg-muted">This part does not send anyone anywhere.</p>
        )}
        {link?.kind === "url" ? (
          <Row label="Web address">
            <Input value={link.target} aria-label="Web address" onChange={(e) => update({ link: { kind: "url", target: e.target.value } })} />
          </Row>
        ) : null}
      </>
    );
  }
  return (
    <Row>
      <Textarea autoGrow rows={3} value={node.data} aria-label="Data" placeholder="What it shows or does" onChange={(e) => update({ data: e.target.value })} />
    </Row>
  );
}
