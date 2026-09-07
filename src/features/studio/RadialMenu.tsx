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
  AlignCenter, AlignLeft, AlignRight, Copy, FileText, Grid2x2, Link2, ListTree, Lock,
  Move, Palette as PaletteIcon, Play, Sparkles, Tag, Trash2, Unlock, Wand2, X,
} from "lucide-react";
import { getFeature } from "./catalog";
import { isLinkable } from "./parts";
import { useStudio, type StudioNode } from "./store";
import { ColourOverride } from "./ColourOverride";
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
const HOLE = 36;
/** Where a quadrant is cut in two: inner band inside this, outer block beyond. */
const MID = 78;
/** How far the ring reaches — half a square's width, or a circle's radius. */
const REACH = 116;

const TURN = (t: number) => t * Math.PI * 2 - Math.PI / 2;

const onCircle = (t: number, r: number): Pt => {
  const a = TURN(t);
  return [Math.cos(a) * r, Math.sin(a) * r];
};

/** The point on a square of half-width `half` in the direction `t`. */
const onSquare = (t: number, half: number): Pt => {
  const a = TURN(t);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c * half * (1 / Math.max(Math.abs(c), Math.abs(s))), s * half * (1 / Math.max(Math.abs(c), Math.abs(s)))];
};

const outerAt = (t: number, shape: Shape): Pt => (shape === "round" ? onCircle(t, REACH) : onSquare(t, REACH));

const fmt = (v: Pt) => `${v[0].toFixed(1)} ${v[1].toFixed(1)}`;

/**
 * One piece of the ring: the wedge between two turns, from `rIn` out to
 * either a radius or the outside edge.
 *
 * The inner edge is always an arc bowed away from the pointer. The outer edge
 * is an arc too when the ring is round; when it is square it is sampled along
 * the square, so a piece that turns a corner actually turns it.
 */
function piece(rawFrom: number, rawTo: number, rIn: number, rOut: number | "edge", shape: Shape): string {
  // Pull every piece a hair off its neighbours: touching edges read as one
  // shape with lines drawn on it, a gap reads as separate slabs.
  const gap = 0.009;
  const from = rawFrom + gap;
  const to = rawTo - gap;
  const out = (t: number): Pt => (rOut === "edge" ? outerAt(t, shape) : onCircle(t, rOut));
  let d = `M ${fmt(onCircle(from, rIn))}`;
  d += ` A ${rIn} ${rIn} 0 0 1 ${fmt(onCircle(to, rIn))}`;
  d += ` L ${fmt(out(to))}`;
  if (rOut === "edge" && shape === "square") {
    // Walk back along the square so corners are kept.
    for (let i = 1; i <= 6; i++) d += ` L ${fmt(out(to + ((from - to) * i) / 6))}`;
  } else {
    const r = rOut === "edge" ? REACH : rOut;
    d += ` A ${r} ${r} 0 0 0 ${fmt(out(from))}`;
  }
  return `${d} Z`;
}

/** The middle of a piece, where its icon and word sit. */
function middleOf(from: number, to: number, rIn: number, rOut: number | "edge", shape: Shape): Pt {
  const mid = (from + to) / 2;
  const a = onCircle(mid, rIn);
  const b = rOut === "edge" ? outerAt(mid, shape) : onCircle(mid, rOut);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/* ------------------------------------------------------------------ */
/* Which quadrant is which                                             */
/* ------------------------------------------------------------------ */

/** Quadrants as turn ranges, clockwise from straight up. */
const QUADS: [number, number][] = [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]];

/**
 * The quadrant left empty is the one pointing at the middle of the screen —
 * where you are already looking, and where the second level opens. Delete
 * takes the quadrant vertically beside it, which keeps the most destructive
 * button on the inner side, nearest the middle, wherever you clicked.
 */
function quadrants(x: number, y: number): { empty: number; del: number; top: number; bottom: number } {
  const dx = (typeof window === "undefined" ? 1280 : window.innerWidth) / 2 - x;
  const dy = (typeof window === "undefined" ? 800 : window.innerHeight) / 2 - y;
  // Turn of the direction to the middle, biased a hair anticlockwise so a
  // dead-level click resolves upward rather than flickering.
  const t = ((Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI * 2) + 1.0002) % 1;
  const empty = QUADS.findIndex(([a, b]) => t >= a && t < b);
  const e = empty < 0 ? 3 : empty;
  // Vertical mirror: NE↔SE, SW↔NW.
  const del = [1, 0, 3, 2][e]!;
  const rest = [0, 1, 2, 3].filter((q) => q !== e && q !== del);
  // Of the two left, the upper one takes Animation and Prompt.
  const upper = rest.filter((q) => q === 0 || q === 3);
  const top = upper[0] ?? rest[0]!;
  const bottom = rest.find((q) => q !== top)!;
  return { empty: e, del, top, bottom };
}

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
const AMBER = 72;

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
        { id: "size", label: "Size", icon: Move },
        { id: "links", label: "Links", icon: Link2 },
        { id: "data", label: "Data", icon: FileText },
      ];
  }
}

/* ------------------------------------------------------------------ */
/* The menu                                                            */
/* ------------------------------------------------------------------ */

export function RadialMenu() {
  const open = useRadial();
  const [picked, setPicked] = React.useState<SlotId | null>(null);
  const [subPick, setSubPick] = React.useState<string | null>(null);
  const nodes = useStudio((s) => s.nodes);
  const shape = useStudio((s) => s.menuShape);
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
      const el = e.target as HTMLElement;
      // A select inside an editor opens its list in a portal, which is not a
      // descendant of the menu — closing on it would shut the menu the moment
      // you picked an option.
      if (el.closest?.("[data-radial], [data-radix-popper-content-wrapper], [role='listbox'], [role='option']")) return;
      closeRadial();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, picked, subPick]);

  if (!open || !node) return null;

  const s = () => useStudio.getState();
  const margin = REACH + 28;
  const px = Math.max(margin, Math.min(window.innerWidth - margin, open.x));
  const py = Math.max(margin, Math.min(window.innerHeight - margin, open.y));
  const q = quadrants(px, py);

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
  const [topA, topB] = QUADS[q.top]!;
  const [botA, botB] = QUADS[q.bottom]!;
  const [delA, delB] = QUADS[q.del]!;
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
  const [emptyA, emptyB] = QUADS[q.empty]!;
  // Green fills the quadrant that was empty, cut the same way the blue ones
  // are: a band near the pointer, a block beyond it.
  const innerCount = Math.ceil(choices.length / 2);
  const outerCount = choices.length - innerCount;
  const span = emptyB - emptyA;
  const greenPieces = choices.map((c, i) => {
    const outer = i >= innerCount;
    const n = outer ? outerCount : innerCount;
    const k = outer ? i - innerCount : i;
    const a = emptyA + (span * k) / n;
    const b = emptyA + (span * (k + 1)) / n;
    return {
      choice: c,
      d: piece(a, b, outer ? MID : HOLE, outer ? "edge" : MID, shape),
      at: middleOf(a, b, outer ? MID : HOLE, outer ? "edge" : MID, shape),
    };
  });

  /* ---------------------------------------------------------- level 3 */
  // The editor opens in the quadrant opposite the green one, and reaches
  // outward from it — a wedge is a fine frame and a poor text box.
  const editorTurn = ((emptyA + emptyB) / 2 + 0.5) % 1;
  const corner = onSquare(editorTurn, REACH + 10);
  const toRight = corner[0] >= 0;
  const toBottom = corner[1] >= 0;
  const EDITOR_W = 228;
  // Grow away from the ring, then keep the whole panel on screen.
  const rawLeft = toRight ? corner[0] : corner[0] - EDITOR_W;
  const editorLeft = Math.max(12 - px, Math.min(window.innerWidth - px - EDITOR_W - 12, rawLeft));
  const editorTop = Math.max(12 - py, Math.min(window.innerHeight - py - 190, corner[1] - (toBottom ? 0 : 8)));

  return (
    // Above the top bar and the status bar, or a menu opened near an edge has
    // pieces behind the chrome, unreachable.
    <div data-radial className="pointer-events-none fixed inset-0 z-[68]">
      <div className="absolute" style={{ left: px, top: py }}>
        {!picked ? (
          <>
            <Ring pieces={level1.map((p) => ({
              id: p.slot.id,
              label: p.slot.id === "delete" ? "Delete" : p.slot.label,
              icon: p.slot.icon,
              hue: p.slot.hue,
              d: p.d,
              at: p.at,
              onPick: () => take(p.slot),
            }))} />
            {/* the draft toggle: cut square, or swept round like the inside */}
            <button
              type="button"
              data-menu-shape={shape}
              aria-label={shape === "square" ? "Round the outer edge" : "Cut the outer edge square"}
              onClick={() => { play("tap"); s().setMenuShape(shape === "square" ? "round" : "square"); }}
              className="pointer-events-auto absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[3px] text-[9px] text-fg-muted hover:text-fg"
              style={{
                left: onCircle((emptyA + emptyB) / 2, (HOLE + REACH) / 2)[0],
                top: onCircle((emptyA + emptyB) / 2, (HOLE + REACH) / 2)[1],
                background: "oklch(0.16 0.01 265 / 0.9)",
                border: "1px solid oklch(0.42 0.02 265)",
              }}
            >
              {shape === "square" ? "◻" : "◯"}
            </button>
          </>
        ) : null}

        {/* the lock lives in the clear circle, at the pointer */}
        <button
          type="button"
          aria-label={node.locked ? "Unlock" : "Lock in place"}
          aria-pressed={node.locked}
          data-menu-lock=""
          onClick={() => { play(node.locked ? "confirm" : "close"); s().updateNode(node.id, { locked: !node.locked }); }}
          className="pointer-events-auto absolute flex size-[26px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
          style={{
            background: node.locked ? "oklch(0.5 0.16 60 / 0.28)" : "oklch(0.16 0.01 265 / 0.9)",
            border: `1px solid oklch(${node.locked ? "0.82 0.17 60" : "0.5 0.02 265"})`,
            color: node.locked ? "oklch(0.9 0.16 60)" : "oklch(0.75 0.02 265)",
          }}
        >
          {node.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
        </button>

        {group ? (
          <div data-radial-panel={group.id} className="pointer-events-auto absolute left-0 top-0">
            <Ring
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
                  if (p.choice.act) { p.choice.act(node); setSubPick(p.choice.id); }
                  else setSubPick(p.choice.id);
                },
              }))}
            />
            {/* back out of the green level without closing the whole thing */}
            <button
              type="button"
              aria-label="Back to the menu"
              onClick={() => { play("close"); setPicked(null); setSubPick(null); }}
              className="pointer-events-auto absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[3px]"
              style={{
                left: onSquare((emptyA + emptyB) / 2, REACH + 12)[0],
                top: onSquare((emptyA + emptyB) / 2, REACH + 12)[1],
                background: "oklch(0.16 0.02 148 / 0.92)",
                border: `1px solid oklch(0.6 0.16 ${GREEN})`,
                color: `oklch(0.88 0.16 ${GREEN})`,
              }}
            >
              <X className="size-3" />
            </button>

            {subPick && !choicesFor(group.id).find((c) => c.id === subPick)?.act ? (
              <div
                data-radial-editor={subPick}
                className="pointer-events-auto absolute rounded-md p-2"
                style={{
                  width: EDITOR_W,
                  left: editorLeft,
                  top: editorTop,
                  background: "oklch(0.15 0.03 72 / 0.95)",
                  border: `1px solid oklch(0.78 0.16 ${AMBER})`,
                  boxShadow: `0 0 16px oklch(0.7 0.17 ${AMBER} / 0.25), 0 12px 34px oklch(0 0 0 / 0.55)`,
                }}
              >
                <Editor which={subPick} node={node} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
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

/**
 * A lit surface with a darker edge.
 *
 * The face is a gradient — brighter along the top, falling away below — so
 * each piece reads as something with a thickness rather than a flat fill, and
 * the line round it is always darker than the face it encloses. Reaching for
 * one lifts it: the face brightens, the edge deepens, and the whole piece
 * rises a pixel with its shadow growing under it.
 */
function Ring({ pieces, green }: { pieces: RingPiece[]; green?: boolean }) {
  const [hot, setHot] = React.useState<string | null>(null);
  return (
    <>
      <svg width={1} height={1} className="absolute left-0 top-0 overflow-visible">
        <defs>
          {pieces.map((p) => {
            const lit = hot === p.id || p.on;
            return (
              <linearGradient key={p.id} id={`face-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`oklch(${lit ? 0.62 : 0.46} ${green ? 0.13 : 0.11} ${p.hue})`} />
                <stop offset="100%" stopColor={`oklch(${lit ? 0.44 : 0.32} ${green ? 0.1 : 0.08} ${p.hue})`} />
              </linearGradient>
            );
          })}
        </defs>
        {pieces.map((p) => {
          const lit = hot === p.id || p.on;
          return (
            <path
              key={p.id}
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
              fill={`url(#face-${p.id})`}
              // The edge is always darker than the face, and darker still
              // when the face lights up — that is what keeps the neon reading
              // as a surface and not as a glow.
              stroke={`oklch(${lit ? 0.14 : 0.2} 0.06 ${p.hue})`}
              strokeWidth={lit ? 2.4 : 1.6}
              strokeLinejoin="round"
              style={{
                transform: lit ? "translateY(-1px)" : undefined,
                transition: "transform 120ms ease-out",
                filter: lit
                  ? `drop-shadow(0 3px 6px oklch(0 0 0 / 0.55)) drop-shadow(0 0 9px oklch(0.7 0.18 ${p.hue} / 0.5))`
                  : "drop-shadow(0 2px 3px oklch(0 0 0 / 0.45))",
              }}
            />
          );
        })}
      </svg>
      {pieces.map((p) => {
        const Icon = p.icon;
        const lit = hot === p.id || p.on;
        return (
          <span
            key={p.id}
            aria-hidden
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-[9px] font-medium leading-tight"
            style={{
              left: p.at[0],
              top: p.at[1] - (lit ? 1 : 0),
              color: green ? "oklch(0.99 0 0)" : `oklch(${lit ? 0.99 : 0.93} 0.02 ${p.hue})`,
              textShadow: "0 1px 2px oklch(0 0 0 / 0.8)",
              transition: "top 120ms ease-out",
            }}
          >
            <Icon className="size-[15px]" strokeWidth={green ? 1.6 : 2} />
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2 flex flex-col gap-1 last:mb-0">
      <span className="text-[9px] uppercase tracking-wider" style={{ color: `oklch(0.82 0.13 ${AMBER})` }}>{label}</span>
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
      <Row label="Hue">
        <ColourOverride colour={node.colour} palette={palette} onChange={(colour) => update({ colour })} />
      </Row>
    );
  }
  if (which === "texture") {
    return (
      <Row label="Texture">
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
      <Row label="Border accent / aura">
        <Select
          value={node.aura ?? ""}
          onChange={(v) => update({ aura: v || null })}
          options={[{ value: "", label: "None" }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]}
          aria-label="Aura colour"
        />
      </Row>
    );
  }
  if (which === "entrance") {
    return (
      <Row label="How it arrives">
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
      <Row label="Prompt for this element">
        <Textarea autoGrow rows={3} value={node.prompt} aria-label="Element prompt" placeholder={feature?.hint ?? "Specific to this placement…"} onChange={(e) => update({ prompt: e.target.value })} />
      </Row>
    );
  }
  if (which === "priority") {
    return (
      <Row label="Priority">
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
      <Row label="Name">
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
    <Row label="Data">
      <Textarea autoGrow rows={3} value={node.data} aria-label="Data" placeholder="What it shows or does" onChange={(e) => update({ data: e.target.value })} />
    </Row>
  );
}
