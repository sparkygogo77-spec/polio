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
import { ColourOverride } from "./ColourOverride";
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

/** Clear space kept around the pointer, and the lock that sits in it. */
const HOLE = 32;
/** Where a quadrant is cut in two: inner band inside this, outer block beyond. */
const MID = 66;
/** How far the ring reaches — half a square's width, or a circle's radius. */
const REACH = 100;
/**
 * Corner radius. Every piece is drawn inset by this and grown back out with a
 * round-joined stroke of its own colour, which is what curves every corner —
 * including the one where a wedge narrows to a point at the pointer, which is
 * exactly where a wedge otherwise looks sharpest and worst.
 */
const ROUND = 5;
/** Clear space along every seam, in px. No two pieces ever touch. */
const SEAM = 7;
/** How much of that seam a piece takes back when you reach for it. */
const SWELL = 2;
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
function outerAt(t: number, rOut: number | "edge", shape: Shape, inset: number): { p: Pt; r: number } {
  if (rOut !== "edge") {
    const r = rOut - inset;
    return { p: onCircle(t, r), r };
  }
  if (shape === "round") {
    const r = REACH - inset;
    return { p: onCircle(t, r), r };
  }
  const r = squareR(t, REACH - inset);
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
function piece(rawFrom: number, rawTo: number, rIn: number, rOut: number | "edge", shape: Shape): string {
  // The seam runs round the ring as well as along it: where an inner band
  // meets the outer block above it, both have to give half of it up. The two
  // edges with no neighbour — the hole at the pointer and the outside — keep
  // their full reach.
  const inSeam = rIn > HOLE ? SEAM / 2 : 0;
  const outSeam = rOut === "edge" ? 0 : SEAM / 2;
  const rA = rIn + ROUND + inSeam;
  const pad = SEAM / 2 + ROUND;
  const turnPad = (r: number) => pad / (Math.PI * 2 * Math.max(12, r));

  const gA = turnPad(rA);
  const aFrom = rawFrom + gA;
  const aTo = rawTo - gA;
  // The outer end has its own inset, taken at the radius it actually reaches —
  // which on a square is much further out toward a corner.
  const gFrom = turnPad(outerAt(rawFrom, rOut, shape, ROUND + outSeam).r);
  const gTo = turnPad(outerAt(rawTo, rOut, shape, ROUND + outSeam).r);
  const bFrom = rawFrom + gFrom;
  const bTo = rawTo - gTo;
  // A piece too narrow to draw would fold inside out; collapse it to a sliver
  // at its own middle instead, where it is simply invisible.
  const mid = (rawFrom + rawTo) / 2;
  const [iFrom, iTo] = aTo > aFrom ? [aFrom, aTo] : [mid - 0.0005, mid + 0.0005];
  const [oFrom, oTo] = bTo > bFrom ? [bFrom, bTo] : [mid - 0.0005, mid + 0.0005];

  let d = `M ${fmt(onCircle(iFrom, rA))}`;
  d += ` A ${rA} ${rA} 0 0 1 ${fmt(onCircle(iTo, rA))}`;
  d += ` L ${fmt(outerAt(oTo, rOut, shape, ROUND + outSeam).p)}`;
  if (rOut === "edge" && shape === "square") {
    // Walk the square backwards, landing on every corner between the two ends,
    // so a piece that turns a corner turns it at a right angle instead of
    // cutting it off with a chord.
    const half = REACH - ROUND;
    for (const c of [...CORNERS].reverse()) if (c > oFrom && c < oTo) d += ` L ${fmt(onSquare(c, half))}`;
    d += ` L ${fmt(outerAt(oFrom, rOut, shape, ROUND).p)}`;
  } else {
    const r = outerAt(oFrom, rOut, shape, ROUND + outSeam).r;
    d += ` A ${r} ${r} 0 0 0 ${fmt(outerAt(oFrom, rOut, shape, ROUND + outSeam).p)}`;
  }
  return `${d} Z`;
}

/** The middle of a piece, where its icon and word sit. */
function middleOf(from: number, to: number, rIn: number, rOut: number | "edge", shape: Shape): Pt {
  const mid = (from + to) / 2;
  const a = onCircle(mid, rIn + ROUND + (rIn > HOLE ? SEAM / 2 : 0));
  const b = outerAt(mid, rOut, shape, ROUND + (rOut === "edge" ? 0 : SEAM / 2)).p;
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
      // Two things outside the menu still belong to it: a select's list, which
      // opens in a portal rather than inside the menu, and the toolbar's shape
      // chip, which is only worth having where it is if you can flip it and
      // watch the open menu change.
      if (el.closest?.("[data-radial], [data-menu-shape], [data-radix-popper-content-wrapper], [role='listbox'], [role='option']")) return;
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
   * Hold the right button and drag to turn the wheel.
   *
   * The menu comes up under a right button that is usually still held down, so
   * carrying on into a drag turns it without a second gesture. The angle is
   * chased rather than pinned to the pointer — a fifth of the way there each
   * frame — which is the difference between a dial and a twitch. Nothing snaps:
   * it stops where you let go, and it is remembered.
   */
  const anchor = React.useRef({ x: 0, y: 0 });
  if (open) anchor.current = { x: open.x, y: open.y };
  React.useEffect(() => {
    if (!open) return;
    let turning = false;
    // Set by a turn, cleared by the context menu it swallows.
    let turned = false;
    let grabbed = 0;
    let was = 0;
    let want = useStudio.getState().menuSpin;
    let frame = 0;
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
    const onMove = (e: PointerEvent) => {
      if (!(e.buttons & 2)) { turning = false; return; }
      // Turning starts once you are clear of the hole, so a right-click that
      // wobbles a pixel does not spin the menu.
      const far = Math.hypot(e.clientX - anchor.current.x, e.clientY - anchor.current.y) > HOLE + 6;
      if (!turning) {
        if (!far) return;
        turning = true;
        turned = true;
        grabbed = angle(e);
        was = useStudio.getState().menuSpin;
      }
      want = was + (angle(e) - grabbed);
      if (!frame) frame = requestAnimationFrame(step);
    };
    const onUp = () => { turning = false; };
    /*
     * The right button lets go at the end of a turn, and the browser answers
     * with a context menu — the app's own, over the wheel you were just
     * arranging. A turn eats that one event. A right-click that did not turn
     * anything still means what it always meant: put this menu away.
     */
    const onMenu = (e: MouseEvent) => {
      if (turned) {
        turned = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!(e.target as HTMLElement).closest?.("[data-radial]")) closeRadial();
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

  const level1: { slot: Slot; d: string; at: Pt }[] = [
    { slot: SLOTS.anim, d: piece(topA, topB, HOLE, MID, shape), at: middleOf(topA, topB, HOLE, MID, shape) },
    { slot: SLOTS.prompt, d: piece(topA, topB, MID, "edge", shape), at: middleOf(topA, topB, MID, "edge", shape) },
    { slot: SLOTS.duplicate, d: piece(botA, botMid, HOLE, MID, shape), at: middleOf(botA, botMid, HOLE, MID, shape) },
    { slot: SLOTS.edit, d: piece(botMid, botB, HOLE, MID, shape), at: middleOf(botMid, botB, HOLE, MID, shape) },
    { slot: SLOTS.look, d: piece(botA, botB, MID, "edge", shape), at: middleOf(botA, botB, MID, "edge", shape) },
    // Delete is the whole quadrant, mirrored from the one opposite it and not
    // cut up: one slab, so it can never be hit as a sliver.
    { slot: SLOTS.delete, d: piece(delA, delB, HOLE, "edge", shape), at: middleOf(delA, delB, HOLE, "edge", shape) },
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
  const greenPieces = choices.map((c, i) => {
    const outer = i >= innerCount;
    const n = outer ? outerCount : innerCount;
    const k = outer ? i - innerCount : i;
    const a = greenFrom + (span * k) / n;
    const b = greenFrom + (span * (k + 1)) / n;
    return {
      choice: c,
      d: piece(a, b, outer ? MID : HOLE, outer ? "edge" : MID, shape),
      at: middleOf(a, b, outer ? MID : HOLE, outer ? "edge" : MID, shape),
    };
  });

  /* ---------------------------------------------------------- level 3 */
  // The editor takes the green level's place rather than opening beside it:
  // the green goes away, and the same corner of the screen becomes the panel.
  const editing = subPick && !choicesFor(group?.id ?? "edit").find((c) => c.id === subPick)?.act ? subPick : null;
  const outward = spun(onCircle((greenFrom + greenTo) / 2, 1), spin);
  const backAt = spun(onSquare((greenFrom + greenTo) / 2, REACH + 13), spin);

  return (
    // Above the top bar and the status bar, or a menu opened near an edge has
    // pieces behind the chrome, unreachable.
    <div
      data-radial
      className="pointer-events-none fixed inset-0 z-[68]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute" style={{ left: px, top: py }}>
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
          onClick={() => { play(node.locked ? "confirm" : "close"); s().updateNode(node.id, { locked: !node.locked }); }}
          className="pointer-events-auto absolute flex size-[26px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
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
        <QuadrantPanel
          x={px}
          y={py}
          outward={outward}
          title={choices.find((c) => c.id === editing)?.label ?? "Edit"}
          which={editing}
          onBack={() => { play("close"); setSubPick(null); }}
        >
          <Editor which={editing} node={node} />
        </QuadrantPanel>
      ) : null}
    </div>
  );
}

/**
 * The third level: the editor, standing where the green quadrant stood.
 *
 * It used to be a small box parked off to one side of the ring, which read as
 * a tooltip rather than as the next step, and left the green level sitting
 * behind it doing nothing. Now the green goes away and this takes the same
 * corner — same anchor, same direction, a different colour — so the menu is
 * only ever one thing at a time.
 */
function QuadrantPanel({
  x, y, outward, title, which, onBack, children,
}: {
  x: number; y: number; outward: Pt; title: string; which: string;
  onBack: () => void; children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [h, setH] = React.useState(150);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setH((prev) => (Math.abs(prev - r.height) > 1 ? r.height : prev));
  });
  const W = 200;
  // Clear of the pointer rather than over it, so the panel reads as standing
  // where the quadrant stood instead of sitting on the click.
  const rawLeft = x + (outward[0] >= 0 ? 8 : -8 - W);
  const rawTop = y + (outward[1] >= 0 ? 8 : -8 - h);
  const left = Math.max(10, Math.min((typeof window === "undefined" ? 1280 : window.innerWidth) - W - 10, rawLeft));
  const top = Math.max(10, Math.min((typeof window === "undefined" ? 800 : window.innerHeight) - h - 10, rawTop));
  return (
    <div
      ref={ref}
      data-radial-editor={which}
      className="pointer-events-auto fixed rounded-xl p-2.5"
      style={{
        width: W,
        left,
        top,
        background: `oklch(0.42 0.16 ${CRIMSON})`,
        border: `1.5px solid oklch(0.62 0.2 ${CRIMSON})`,
        boxShadow: "0 10px 26px oklch(0 0 0 / 0.4)",
      }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "oklch(0.96 0.05 20)" }}>
          {title}
        </span>
        <button
          type="button"
          aria-label="Back to the menu"
          onClick={onBack}
          className="flex size-5 items-center justify-center rounded-full"
          style={{ background: `oklch(0.62 0.2 ${CRIMSON})`, color: "oklch(0.99 0.02 20)" }}
        >
          <X className="size-3" />
        </button>
      </div>
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
    return (
      <Row>
        <ColourOverride colour={node.colour} palette={palette} onChange={(colour) => update({ colour })} />
      </Row>
    );
  }
  if (which === "texture") {
    return (
      <Row>
        <Select
          value={node.texture ?? "site"}
          onChange={(v) => update({ texture: v === "site" ? null : v })}
          options={[
            { value: "site", label: "Follow the site" },
            { value: "none", label: "No texture" },
            ...(look.texture ?? []).map((l, i) => ({
              value: l.id,
              label: `${TEXTURE_KINDS.find((k) => k.id === l.kind)?.label ?? l.kind} (layer ${i + 1})`,
            })),
          ]}
          aria-label="Texture on this part"
        />
      </Row>
    );
  }
  if (which === "aura") {
    return (
      <Row>
        <Select
          value={node.aura ?? ""}
          onChange={(v) => update({ aura: v || null })}
          options={[{ value: "", label: "None" }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]}
          aria-label="Aura colour"
        />
      </Row>
    );
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
