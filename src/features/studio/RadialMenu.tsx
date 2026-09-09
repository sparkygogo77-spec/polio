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
 *   3  crimson  the editor the green choice needs, on the three quadrants
 *               the green is not using — three more slabs like Delete
 *
 * Every piece is one SVG path — arc in, out along a seam, round the outside,
 * back down the next seam — so the geometry is the hit area. The outer edge is
 * cut square by default and can be swept round instead (the ◻/◯ chip on the
 * menu itself), which is the draft option to compare against.
 */
import * as React from "react";
import {
  AlignCenter, AlignLeft, AlignRight, Copy, FileText, Grid2x2, Highlighter, Link2, ListTree, Lock,
  Move, Palette as PaletteIcon, Play, Shapes, SlidersHorizontal, Sparkles, Tag, Trash2, Undo2, Unlock, Wand2, X,
} from "lucide-react";
import { getFeature } from "./catalog";
import { isLinkable } from "./parts";
import { useStudio, type StudioNode } from "./store";
import {
  BLUE_RINGS, EDGE, GREEN_RINGS, middleOf, piece, Q_BOTTOM, Q_DELETE, Q_EMPTY, Q_TOP, QUADS, ROUND, SWELL,
  type Pt,
} from "./menuGeometry";
import { AuraQuads, HueQuads, PlateQuad, QuadrantConsole, TextureQuads, type ConsoleSpan } from "./RingEditors";
import { CONSOLE, type Slab } from "./RingConsole";
import { GLYPHS, HuePicker, OptionSet } from "./Inspector";
import { overrideTheme, resolvePalette, themeFrom } from "./parts/theme";
import { auraColour, textureCss, type Palette, type RoleId, type TextureLayer } from "./look";
import { play } from "@/core/audio/engine";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { Select } from "@/core/ui/select";
import { Segmented } from "@/core/ui/segmented";

/* ------------------------------------------------------------------ */
/* Opening it                                                          */
/* ------------------------------------------------------------------ */

/**
 * `seq` counts openings, not moves. Right-clicking somewhere else — a
 * different part, or a different corner of the same one — is a new opening and
 * puts the menu back to its first level; carrying it across the screen is not.
 */
type Open = { nodeId: string; x: number; y: number; seq: number } | null;
let current: Open = null;
let opened = 0;
const listeners = new Set<(v: Open) => void>();

/**
 * Kept clear of the edges, so a menu opened by one has no pieces off screen.
 *
 * Clamped *here*, once, so that where the menu is drawn and where the pull is
 * measured from are the same point. They were not: the drawing clamped and the
 * gesture did not, and a menu opened near the top of the board pulled its line
 * from a point some way above its own middle.
 */
function keepOnScreen(x: number, y: number): [number, number] {
  if (typeof window === "undefined") return [x, y];
  const margin = GREEN_RINGS.reach + 26;
  return [
    Math.max(margin, Math.min(window.innerWidth - margin, x)),
    Math.max(margin, Math.min(window.innerHeight - margin, y)),
  ];
}

export function openRadial(nodeId: string, x: number, y: number) {
  const [px, py] = keepOnScreen(x, y);
  current = { nodeId, x: px, y: py, seq: ++opened };
  listeners.forEach((l) => l(current));
}
export function closeRadial() {
  current = null;
  listeners.forEach((l) => l(null));
}
/** Park the menu somewhere else without closing it or losing the part. */
export function moveRadial(x: number, y: number) {
  if (!current) return;
  const [px, py] = keepOnScreen(x, y);
  current = { ...current, x: px, y: py };
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

/**
 * The pull: where the line starts showing, and how far out either end is.
 *
 * Between the hole and an end it fades up. The red end unlocks *moving*, the
 * green end unlocks *turning*, and the line goes when either is reached.
 */
const PULL_FROM = BLUE_RINGS.hole + 6;
const PULL_LOCK = BLUE_RINGS.reach + 16;

/**
 * Where the gesture has got to.
 *
 * `pull` — on the line, fading up toward one end or the other.
 * `moving` — reached the red end: the whole menu follows the hand.
 * `turning` — reached the green end: the wheel turns under the hand.
 */
type PullStage = "pull" | "moving" | "turning";
interface Pull {
  /** Where the handle is, already projected onto the line. */
  dx: number;
  dy: number;
  grip: number;
  stage: PullStage;
  /** The line itself, as a unit vector, once the first move has set it. */
  axis: Pt | null;
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
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const layers = look.texture ?? [];
  const node = open ? nodes.find((n) => n.id === open.nodeId) : undefined;

  const seq = open?.seq ?? 0;
  React.useEffect(() => {
    setPicked(null);
    setSubPick(null);
  }, [seq]);

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
   * The line: one line, two ends, two things.
   *
   * Hold the right button and move, and the first real movement fixes a line
   * through the pointer. From there the handle is *on* that line whatever your
   * hand does — sliding, never steering. Both ends are drawn: a red ring at
   * the end you pulled toward, a green ring at the other. Reach the **red**
   * one and the whole menu comes loose and follows your hand. Run back along
   * the line to the **green** one and the wheel turns under your hand instead.
   * Either way the line goes the moment it has done its job; the green ring
   * stays while you turn, so you can see what you are turning about.
   *
   * The menu opens on the press, so the hold that opened it is the hold that
   * pulls. The angle is chased a fifth of the way per frame rather than
   * pinned, which is the difference between a dial and a twitch; nothing snaps.
   */
  const anchor = React.useRef({ x: 0, y: 0 });
  if (open) anchor.current = { x: open.x, y: open.y };
  const [pull, setPull] = React.useState<Pull | null>(null);
  React.useEffect(() => {
    if (!open) return;
    let stage: PullStage = "pull";
    let axis: Pt | null = null;
    // Set once the line has been used, cleared by the context menu it swallows
    // — or by the next press, on a Mac, where that event comes on the press
    // and there is none on the release to swallow.
    let used = false;
    // Whether the right button is down, kept by hand as well as read off
    // `buttons`: a pen or a trackpad does not always report it.
    let held = false;
    let grabbed = 0;
    let was = 0;
    let want = useStudio.getState().menuSpin;
    let frame = 0;
    let hold = { x: 0, y: 0 };
    let showing = false;
    const show = (v: Pull | null) => {
      if (!v && !showing) return;
      showing = !!v;
      setPull(v);
    };
    const step = () => {
      const now = useStudio.getState().menuSpin;
      let d = want - now;
      while (d > 0.5) d -= 1;
      while (d < -0.5) d += 1;
      if (Math.abs(d) < 0.0006) { useStudio.getState().setMenuSpin(want); frame = 0; return; }
      useStudio.getState().setMenuSpin(now + d * 0.2);
      frame = requestAnimationFrame(step);
    };
    const reset = () => { stage = "pull"; axis = null; held = false; show(null); };
    const onDown = (e: PointerEvent) => {
      if (e.button === 2) held = true;
      // Whatever the last gesture was, this press is not its release.
      used = false;
    };
    const onMove = (e: PointerEvent) => {
      if (!(e.buttons & 2) && !held) return reset();

      if (stage === "moving") {
        // Loose: the menu is under your hand, holding the offset it had when
        // it came loose so it does not jump.
        moveRadial(e.clientX - hold.x, e.clientY - hold.y);
        return;
      }

      const rx = e.clientX - anchor.current.x;
      const ry = e.clientY - anchor.current.y;

      if (stage === "turning") {
        const a = Math.atan2(ry, rx) / (Math.PI * 2);
        show({ dx: rx, dy: ry, grip: 1, stage, axis });
        want = was + (a - grabbed);
        if (!frame) frame = requestAnimationFrame(step);
        return;
      }

      // The first real movement sets the line; after that the handle is on it.
      const raw = Math.hypot(rx, ry);
      if (!axis) {
        if (raw < PULL_FROM) return;
        axis = [rx / raw, ry / raw];
      }
      const along = rx * axis[0] + ry * axis[1];
      const dx = axis[0] * along;
      const dy = axis[1] * along;
      // 0 in the hole, 1 at either end. That number is the line's opacity.
      const grip = Math.max(0, Math.min(1, (Math.abs(along) - PULL_FROM) / (PULL_LOCK - PULL_FROM)));

      if (along >= PULL_LOCK) {
        // The red end: the menu comes loose.
        stage = "moving";
        used = true;
        hold = { x: e.clientX - anchor.current.x, y: e.clientY - anchor.current.y };
        play("confirm");
        show(null);
        return;
      }
      if (along <= -PULL_LOCK) {
        // The green end: the wheel comes loose.
        stage = "turning";
        used = true;
        grabbed = Math.atan2(ry, rx) / (Math.PI * 2);
        was = useStudio.getState().menuSpin;
        play("confirm");
      }
      show({ dx, dy, grip, stage, axis });
    };
    const onUp = (e: PointerEvent) => {
      if (e.type === "pointercancel" || e.button === 2 || !(e.buttons & 2)) reset();
    };
    /*
     * While the menu is open, the right button belongs to it.
     *
     * Swallowing the event in the capture phase is the only place that works —
     * the app's own context menu listens further down and `preventDefault`
     * alone does not stop it — and once it is swallowed, this decides. After a
     * pull that was used, nothing: that release is the end of a move or a
     * turn. On the menu itself, nothing: that press is the start of a pull. On
     * any part, including a different corner of the same one, the menu
     * **moves there** and starts again at its first level. On anything that is
     * not a part, it closes. Those are the only things a right-click can mean.
     */
    const onMenu = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      e.preventDefault();
      e.stopPropagation();
      if (used) { used = false; return; }
      if (el.closest?.("[data-radial]")) return;
      const onNode = el.closest?.("[data-node-id]") as HTMLElement | null;
      const id = onNode?.getAttribute("data-node-id");
      if (id) openRadial(id, e.clientX, e.clientY);
      else closeRadial();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("contextmenu", onMenu, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("contextmenu", onMenu, true);
      if (frame) cancelAnimationFrame(frame);
    };
    // A fresh opening starts the gesture over; the menu being carried does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.seq]);

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
  // Already kept on screen by `openRadial` and `moveRadial`.
  const px = open.x;
  const py = open.y;

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
  // The editor is the three quadrants the green level is not using — two,
  // when the group is wide enough to need a second — each a slab like Delete,
  // on the green level's own rings, in the console's own red. The green stays
  // up, so you can see which choice you are inside and step sideways.
  const editing = subPick && !choicesFor(group?.id ?? "edit").find((c) => c.id === subPick)?.act ? subPick : null;
  const freeQuads: [number, number][] = [];
  for (let t = greenTo; t < greenFrom + 1 - 0.001; t += 0.25) freeQuads.push([t, t + 0.25]);
  const consoleSpan: ConsoleSpan = { quads: freeQuads, rings: GREEN_RINGS, shape, spin };

  return (
    // Above the top bar and the status bar, or a menu opened near an edge has
    // pieces behind the chrome, unreachable.
    <div
      data-radial
      className="pointer-events-none fixed inset-0 z-[68]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute" style={{ left: px, top: py }}>
        {pull ? <PullLine pull={pull} /> : null}

        {!picked ? (
          <Ring spin={spin} pieces={level1.map((p) => ({
            id: p.slot.id,
            label: p.slot.label,
            icon: p.slot.icon,
            hue: p.slot.hue,
            d: p.d,
            at: p.at,
            // The inner band is too narrow for a word without it hanging over
            // the neighbours; an icon says it, and the word is on the tooltip.
            compact: p.slot.id === "anim" || p.slot.id === "duplicate" || p.slot.id === "edit",
            onPick: () => take(p.slot),
          }))} />
        ) : null}

        {/*
          The middle: the lock on the first level, and past it the one way
          back. There used to be a green X for leaving the green level and a
          red one for leaving an editor, each somewhere on the rim; one button
          where the pointer already is, that takes you to the start, is the
          same thing with nothing to find. Escape still steps back one level.
          Either way the middle is also the handle the menu is carried by.
        */}
        {!picked ? (
          <button
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
          </button>
        ) : (
          <button
            type="button"
            aria-label="Back to the start"
            data-menu-home=""
            onPointerDown={carry}
            onClick={() => {
              if (dragged.current) { dragged.current = false; return; }
              play("close");
              setPicked(null);
              setSubPick(null);
            }}
            className="pointer-events-auto absolute flex size-[30px] -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
            style={{
              background: editing ? CONSOLE.well : `oklch(0.32 0.06 ${GREEN})`,
              border: `1px solid ${editing ? "oklch(0.5 0.01 260)" : `oklch(0.5 0.12 ${GREEN})`}`,
              color: editing ? CONSOLE.text : "oklch(0.9 0.05 148)",
              boxShadow: "0 2px 6px oklch(0 0 0 / 0.5)",
            }}
          >
            <Undo2 className="size-3.5" />
          </button>
        )}

        {group ? (
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
                preview:
                  p.choice.id === "hue" ? <HueSwatch node={node} palette={palette} />
                  : p.choice.id === "texture" ? <TextureSwatch node={node} palette={palette} layers={layers} />
                  : undefined,
                glow: p.choice.id === "aura" ? auraColour(node.aura, palette) : null,
                onPick: () => {
                  play("select");
                  if (p.choice.act) p.choice.act(node);
                  setSubPick(p.choice.id);
                },
              }))}
            />
          </div>
        ) : null}

        {group && editing ? (
          <div data-radial-editor={editing} className="pointer-events-none absolute left-0 top-0">
            <QuadrantConsole span={consoleSpan} onGrip={carry}>
              {(slabs) => <Editor which={editing} node={node} slabs={slabs} />}
            </QuadrantConsole>
          </div>
        ) : null}

        {pull ? <PullEnds pull={pull} /> : null}
      </div>
    </div>
  );
}

/**
 * The line of the gesture, drawn *under* the wheel so it runs beneath the
 * pieces rather than across their faces.
 *
 * The handle runs to your hand, red on the red side of the middle and green
 * on the green, fading up as it lengthens. Reaching either end takes it away.
 */
function PullLine({ pull }: { pull: Pull }) {
  const ax = pull.axis;
  if (!ax || pull.stage !== "pull") return null;
  const red: Pt = [ax[0] * PULL_LOCK, ax[1] * PULL_LOCK];
  const green: Pt = [-ax[0] * PULL_LOCK, -ax[1] * PULL_LOCK];
  const toGreen = pull.dx * ax[0] + pull.dy * ax[1] < 0;
  const hue = toGreen ? GREEN : CRIMSON;
  return (
    <svg width={1} height={1} className="pointer-events-none absolute left-0 top-0 overflow-visible">
      {/* the track, end to end */}
      <line
        x1={red[0]} y1={red[1]} x2={green[0]} y2={green[1]}
        stroke="oklch(0.72 0.02 260)"
        strokeOpacity={0.3}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="3 7"
      />
      <line
        data-pull-line=""
        x1={0} y1={0} x2={pull.dx} y2={pull.dy}
        stroke={`oklch(0.74 0.2 ${hue})`}
        strokeOpacity={Math.max(0.08, pull.grip)}
        strokeWidth={3 + pull.grip}
        strokeLinecap="round"
        strokeDasharray={pull.grip >= 1 ? undefined : "7 6"}
      />
      <circle cx={pull.dx} cy={pull.dy} r={4 + pull.grip * 3} fill={`oklch(0.8 0.2 ${hue})`} fillOpacity={Math.max(0.2, pull.grip)} />
    </svg>
  );
}

/**
 * The two ends of the line, drawn *over* the wheel: the line can run under a
 * piece, but the ring you are reaching for cannot, or you would be reaching
 * for something you cannot see. The red ring is at the end you pulled toward
 * and the green ring at the other. The green one stays while you turn, so you
 * can see what you are turning about; the red one goes with the line.
 */
function PullEnds({ pull }: { pull: Pull }) {
  const ax = pull.axis;
  if (!ax || pull.stage === "moving") return null;
  const turning = pull.stage === "turning";
  const red: Pt = [ax[0] * PULL_LOCK, ax[1] * PULL_LOCK];
  const green: Pt = [-ax[0] * PULL_LOCK, -ax[1] * PULL_LOCK];
  return (
    <svg width={1} height={1} className="pointer-events-none absolute left-0 top-0 overflow-visible">
      {turning ? null : (
        <circle
          data-pull-move=""
          cx={red[0]} cy={red[1]} r={10}
          fill="none"
          stroke={`oklch(0.7 0.22 ${CRIMSON})`}
          strokeWidth={3}
          strokeDasharray="5 4"
        />
      )}
      <circle
        data-pull-target=""
        cx={green[0]} cy={green[1]} r={turning ? 8 : 10}
        fill={turning ? `oklch(0.78 0.2 ${GREEN})` : "none"}
        stroke={`oklch(0.78 0.2 ${GREEN})`}
        strokeWidth={3}
        strokeDasharray={turning ? undefined : "5 4"}
        style={{ filter: turning ? `drop-shadow(0 0 5px oklch(0.78 0.2 ${GREEN}))` : undefined }}
      >
        {turning ? null : <animate attributeName="r" values="10;13;10" dur="1.1s" repeatCount="indefinite" />}
      </circle>
    </svg>
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
  /** A band too narrow for a word: icon only, the word on the tooltip. */
  compact?: boolean;
  /** Something small that shows what the piece is *about*, instead of its icon. */
  preview?: React.ReactNode;
  /** A colour to glow in — the piece wears the aura it would set. */
  glow?: string | null;
  onPick: () => void;
}

/** One flat colour, and a darker line round it. */
const face = (hue: number, lit: boolean) => `oklch(${lit ? 0.74 : 0.66} ${lit ? 0.17 : 0.155} ${hue})`;
const rim = (hue: number, lit: boolean) => `oklch(${lit ? 0.38 : 0.44} ${lit ? 0.16 : 0.14} ${hue})`;

/**
 * A slab of one colour with a darker line round it.
 *
 * The rounded corners are the stroke: the path is drawn inset by `ROUND` and
 * grown back with a round-joined stroke of its own colour. That is also what
 * makes the swell work — a hovered piece just strokes wider, taking a couple
 * of pixels back out of the seam it was given.
 *
 * The word is a `foreignObject` inside the same rotated group as the slab,
 * turned back upright. It used to be positioned HTML with a transition on
 * `left`/`top`, which is why every word trailed its button round a turn — it
 * was chasing a number the slab had already reached. Now it *is* part of the
 * slab, and the only thing that eases is the hover nudge.
 */
function Ring({ pieces, green, spin }: { pieces: RingPiece[]; green?: boolean; spin: number }) {
  const [hot, setHot] = React.useState<string | null>(null);
  const nudge = (at: Pt, lit: boolean): Pt => {
    if (!lit) return [0, 0];
    const len = Math.max(1, Math.hypot(at[0], at[1]));
    return [(at[0] / len) * 1.5, (at[1] / len) * 1.5];
  };
  return (
    // The svg itself takes no presses: its one-pixel box sits exactly on the
    // middle of the wheel, and it was the one pixel the middle button could
    // not be pressed on.
    <svg width={1} height={1} className="pointer-events-none absolute left-0 top-0 overflow-visible">
      <g transform={`rotate(${(spin * 360).toFixed(2)})`}>
        {pieces.map((p) => {
          const lit = hot === p.id || p.on;
          const faceW = 2 * (ROUND + (lit ? SWELL : 0));
          const n = nudge(p.at, !!lit);
          const Icon = p.icon;
          const wide = p.compact ? 30 : 96;
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
                style={{
                  transition: "stroke-width 130ms ease-out, fill 130ms ease-out, stroke 130ms ease-out",
                  // The Aura piece wears the aura it would set.
                  filter: p.glow ? `drop-shadow(0 0 7px ${p.glow}) drop-shadow(0 0 2px ${p.glow})` : undefined,
                }}
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
              <foreignObject x={p.at[0] - wide / 2} y={p.at[1] - 18} width={wide} height={36} className="pointer-events-none overflow-visible">
                <div
                  className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[8.5px] font-semibold leading-tight tracking-tight"
                  title={p.label}
                  style={{
                    transform: `rotate(${(-spin * 360).toFixed(2)}deg)`,
                    transformOrigin: "center",
                    color: "oklch(0.99 0 0)",
                    textShadow: `0 1px 2px oklch(0.25 0.08 ${p.hue} / 0.75)`,
                  }}
                >
                  {p.preview ?? <Icon className={p.compact ? "size-[17px]" : "size-[14px]"} strokeWidth={green ? 1.9 : 2.1} />}
                  {p.compact ? null : <span className="whitespace-nowrap">{p.label}</span>}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* What the Looks pieces show                                          */
/* ------------------------------------------------------------------ */

/**
 * The green Looks pieces show what they would change, not a symbol for it.
 *
 * Hue is a strip of the part's own six roles as it is painted right now;
 * Texture is the tile it is wearing (or a plain square when it follows the
 * site); Aura is left to the piece itself, which glows in the colour it has.
 * Small — they have to be — but a swatch the size of a fingernail says more
 * than a palette icon ever did.
 */
function HueSwatch({ node, palette }: { node: StudioNode; palette: Palette }) {
  const t = overrideTheme(themeFrom(useStudio.getState().format), node.colour ?? {}, palette);
  const roles: RoleId[] = ["bg", "surface", "accent", "highlight", "text"];
  return (
    <span className="flex h-[14px] w-[34px] overflow-hidden rounded-[3px]" style={{ outline: "1px solid oklch(0 0 0 / 0.45)" }}>
      {roles.map((r) => <span key={r} className="flex-1" style={{ background: t[r] }} />)}
    </span>
  );
}

function TextureSwatch({ node, palette, layers }: { node: StudioNode; palette: Palette; layers: TextureLayer[] }) {
  const layer = node.texture && node.texture !== "none" ? layers.find((l) => l.id === node.texture) : null;
  const style: React.CSSProperties = layer
    ? { ...textureCss([{ ...layer, on: true }], palette, palette.surface), backgroundSize: "18px 18px" }
    : node.texture === "none"
      ? { background: "oklch(0.3 0.03 148)" }
      : { background: palette.surface };
  return (
    <span className="block size-[18px] rounded-[4px]" style={{ ...style, outline: "1px solid oklch(0 0 0 / 0.45)" }}>
      {node.texture === "none" ? <X className="m-[3px] size-3" /> : null}
    </span>
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
        <span className="text-[9px] uppercase tracking-wider" style={{ color: CONSOLE.text }}>{label}</span>
      ) : null}
      {children}
    </label>
  );
}

function Editor({ which, node, slabs }: { which: string; node: StudioNode; slabs: Slab[] }) {
  const format = useStudio((st) => st.format);
  const look = useStudio((st) => st.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const s = () => useStudio.getState();
  const update = (patch: Partial<StudioNode>) => s().updateNode(node.id, patch);

  // The three that are about looks are drawn on the slabs themselves.
  if (which === "hue") {
    return <HueQuads slabs={slabs} colour={node.colour} palette={palette} onChange={(colour) => update({ colour })} />;
  }
  if (which === "texture") {
    return (
      <TextureQuads
        slabs={slabs}
        value={node.texture}
        layers={look.texture ?? []}
        palette={palette}
        onChange={(texture) => update({ texture })}
      />
    );
  }
  if (which === "aura") {
    return <AuraQuads slabs={slabs} node={node} palette={palette} onChange={(patch) => update(patch)} />;
  }
  // Everything else is words and numbers, and there is no honest way to bend a
  // text field round a curve. They go on a plate inscribed in the first slab —
  // the one rectangle, and it is inside a quadrant rather than beside one.
  return (
    <PlateQuad slabs={slabs}>
      <PlainEditor which={which} node={node} />
    </PlateQuad>
  );
}

function PlainEditor({ which, node }: { which: string; node: StudioNode }) {
  const feature = getFeature(node.featureId);
  const frameWidth = useStudio((s) => s.frameWidth);
  const pages = useStudio((s) => s.pages);
  const s = () => useStudio.getState();
  const update = (patch: Partial<StudioNode>) => s().updateNode(node.id, patch);

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
            style={{ borderColor: node.glyph === null ? CONSOLE.on : "oklch(0.52 0.01 260)" }}
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
              style={{ borderColor: node.glyph === g ? CONSOLE.on : "oklch(0.52 0.01 260)" }}
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
      <p className="text-[10px]" style={{ color: CONSOLE.text }}>This part has nothing to set.</p>
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
