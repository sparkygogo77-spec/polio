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
 *          empty  │  Animation · pencil · More (inner) · Draw (outer)
 *        ─────────●─────────
 *         Delete  │  Duplicate · Edit (inner) · Looks (outer)
 *
 * Delete is the whole quadrant under the empty one, undivided — the same
 * outline as the quadrant opposite it, mirrored, so it reads as one slab and
 * never as a sliver you could hit by accident. The two working quadrants
 * are cut the same way: icons on the inner band, one word on the outer
 * block, so a hand that has learned one has learned the other. More is the
 * few things that are about the part but not about editing it — seeing it
 * live, its place among the others, carrying its looks — as a piece of the
 * wheel: they hung under it on a tab once, and a tab outside the wheel was
 * a bar sticking out of an object.
 *
 * Levels:
 *   1  blue     the seven above, plus the lock in the middle
 *   2  green    replaces the blue entirely, in the quadrant that was empty
 *   3  crimson  the editor the green choice needs, on the three quadrants
 *               the green is not using — three more slabs like Delete
 *   —  board    Draw skips the levels: the whole wheel becomes one dark disc
 *               to draw on (`DrawBoard.tsx`), with no hole in the middle
 *
 * Every piece is one SVG path — arc in, out along a seam, round the outside,
 * back down the next seam — so the geometry is the hit area. The outer edge is
 * cut square by default and can be swept round instead (the ◻/◯ chip on the
 * menu itself), which is the draft option to compare against.
 */
import { canRemake, openRemake } from "./RemakePicture";
import { canClearBackground, openClearBackground } from "./ClearBackground";
import * as React from "react";
/* Alphabetical by imported name, so a merge from any branch resolves the
   same way: this line conflicted three times in one night otherwise.
   Sorted is not the same as union — an icon dropped on purpose stays
   dropped, and the wheel's Edit slot is why. */
import { Box, Boxes, Brush, ChevronsDown, ChevronsUp, CircleDashed, ClipboardPaste, Copy, CopyPlus, Shuffle, Paintbrush, Database, Ellipsis, Eraser, Eye, Flag, Gauge, Grid2x2, History, ImagePlus, Link2, ListTree, Lock, Orbit, Palette as PaletteIcon, Pencil, Pipette, Play, Plus, SlidersHorizontal, Sparkles, SquareDashed, Sun, Tag, Trash2, Type, Undo2, Unlock, Wand2, Wind, X } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { AddDisc } from "./AddDisc";
import { BACKGROUND_ID, heldBackground, livePath, useStudio, type StudioNode } from "./store";
import { createSpaceAt } from "./createSpace";
import { PREVIEW } from "./colourMenu";
import { BackgroundEditor } from "./BackgroundEditors";
import { openImport } from "./ImportFlow";
import { getFeature, MOTION_OPTION_IDS } from "./catalog";
import {
  BLUE_RINGS, BOARD_R, EDGE, GREEN_RINGS, joinFor, middleOf, piece, Q_BOTTOM, Q_DELETE, Q_EMPTY, Q_TOP, QUADS, ROUND, SWELL,
  type Pt, type Shape,
} from "./menuGeometry";
import { AnimQuads, AuraQuads, BehaviourQuads, EdgeQuads, FontQuads, HueQuads, QuadrantConsole, TextureQuads, type ConsoleSpan } from "./RingEditors";
import { movedColours, movedFont, tallyColours, type Worn } from "./siteColours";
import { PlateEditor } from "./PlateEditors";
import { SayPlate } from "./SayBox";
import { DrawBoard } from "./DrawBoard";
import { CONSOLE, HoverTray, type Slab, type TrayItem } from "./RingConsole";
import { overrideTheme, resolvePalette, themeFrom } from "./parts/theme";
import { auraColour, auraStyle, lands, newLayer, parseColor, textureCss, type Palette, type RoleId, type TextureLayer } from "./look";
import { play } from "@/core/audio/engine";
import { useActions } from "@/core/actions";
import { makeSolid, showCube } from "./solidRun";
import { lookOf } from "./partLook";
import { makeAllLike, pasteLook, pasteTargets, useLookClip, useMakeAll } from "./partLookApply";
import { openRemix } from "./RemixCard";
import { hasStates, openStatesTimeline } from "./StatesTimeline";

/* ------------------------------------------------------------------ */
/* Opening it                                                          */
/* ------------------------------------------------------------------ */

/**
 * `seq` counts openings, not moves. Right-clicking somewhere else — a
 * different part, or a different corner of the same one — is a new opening and
 * puts the menu back to its first level; carrying it across the screen is not.
 */
type Open = {
  /** The part the menu is about, or null when only the drawing board is up. */
  nodeId: string | null;
  x: number;
  y: number;
  seq: number;
  /**
   * Where the hand pressed, unclamped. The menu itself is kept on screen,
   * so near an edge it sits some way from the hand; the pull that starts
   * from that same hold is measured from here, not from the menu.
   */
  hand: { x: number; y: number };
  /** Where a part drawn on a nodeless board lands, in canvas space. */
  at: { x: number; y: number } | null;
  /**
   * Open straight onto one slot rather than on the wheel.
   *
   * For "change this" from the timeline: the wheel is a way to choose what
   * to do, and that choice has already been made.
   */
  slot?: SlotId | null;
} | null;
let current: Open = null;
let opened = 0;
/** When the menu was last opened, so the context-menu event that trails the opening press can be told from a new one. */
let openedAt = 0;
const listeners = new Set<(v: Open) => void>();

/** A point on the page frame in canvas space — where the page's Add lands a part. (The console's `spotOn` is a place on a slab; this is a place on the page.) */
export function pageSpot(frame: Element, clientX: number, clientY: number): { x: number; y: number } {
  const r = frame.getBoundingClientRect();
  const zoom = useStudio.getState().zoom || 1;
  return { x: (clientX - r.left) / zoom, y: (clientY - r.top) / zoom };
}

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
  // The drawing board is the widest thing the menu can become; its rim
  // button reaches a few pixels past its edge. Below, the tray hangs under
  // the wheel or the board, so the bottom needs more room than the rest —
  // and only the bottom: pushing the menu further from every edge for a
  // thing on one edge moved a menu opened near the top away from the hand
  // that opened it, and the pull that starts from that hold lost its line.
  //
  // The square is the trap. A round menu reaches `reach` in every direction,
  // so a clamp of `reach` holds it. A square of the same half-width reaches
  // `reach` on its flats and `reach × √2` into its corners — forty per cent
  // further — and `menuSpin` can turn any corner at any edge. Sizing the
  // clamp for the circle is why a square menu opened near a side hung off it.
  // The board is round, so it only ever needs its own radius.
  const square = useStudio.getState().menuShape === "square";
  const spread = square ? GREEN_RINGS.reach * Math.SQRT2 : GREEN_RINGS.reach;
  // Touching the edge is fine; going past it is not. The pad is the rim
  // button and the edge stroke, nothing more.
  const margin = Math.max(spread + 8, BOARD_R + 16);
  const below = Math.max(margin, BOARD_R + TRAY_DROP + 28);
  return [
    Math.max(margin, Math.min(window.innerWidth - margin, x)),
    Math.max(margin, Math.min(window.innerHeight - below, y)),
  ];
}

/** Open the wheel about a part or the page. `at` is the same spot in canvas space, where the page's Add lands a part. */
export function openRadial(nodeId: string, x: number, y: number, at: { x: number; y: number } | null = null, slot: SlotId | null = null) {
  const [px, py] = keepOnScreen(x, y);
  current = { nodeId, x: px, y: py, seq: ++opened, hand: { x, y }, at, slot };
  openedAt = performance.now();
  listeners.forEach((l) => l(current));
}

/**
 * Go straight to drawing on a part that already exists.
 *
 * From the timeline: "change this" has to change *that* part, so the board
 * opens on the part the iteration made rather than on empty space — which is
 * what made going back to change something produce a second something.
 */
export function drawOnPart(nodeId: string, x: number, y: number) {
  openRadial(nodeId, x, y, null, "draw");
}

/** …and straight to writing on it, which is the other half of "change this". */
export function writeOnPart(nodeId: string, x: number, y: number) {
  openRadial(nodeId, x, y, null, "write");
}
/**
 * The drawing board on its own, for a part that does not exist yet.
 *
 * Opened from the board's own right-click menu: no wheel, no part, just the
 * disc at the pointer. `at` is the same spot in canvas space, which is where
 * the part drawn on it lands.
 */
export function openBoard(x: number, y: number, at: { x: number; y: number }) {
  const [px, py] = keepOnScreen(x, y);
  current = { nodeId: null, x: px, y: py, seq: ++opened, hand: { x, y }, at };
  openedAt = performance.now();
  listeners.forEach((l) => l(current));
}
/** Where the wheel is, for anything that has to draw around it. Null when it is shut. */
export function radialAt(): { x: number; y: number } | null {
  return current ? { x: current.x, y: current.y } : null;
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
/** How far below the wheel's edge the tray hangs. */
export const TRAY_DROP = 22;

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
  /** Where the line starts, from the menu's middle: the hand's press, which near an edge is elsewhere. */
  ox: number;
  oy: number;
}

/* ------------------------------------------------------------------ */
/* What is on it                                                       */
/* ------------------------------------------------------------------ */

type SlotId = "anim" | "write" | "draw" | "create" | "duplicate" | "edit" | "look" | "delete";

interface Slot {
  id: SlotId;
  label: string;
  icon: typeof Wand2;
  hue: number;
  /** A group opens the green level; an action fires and closes; the board replaces the wheel. */
  kind: "group" | "action" | "board";
}

const SLOTS: Record<SlotId, Slot> = {
  // One neon blue for the whole first level, so it reads as one object.
  // The pencil and the flag lean violet — far enough to find, near enough to
  // belong — and Delete is the only red thing on the screen.
  anim: { id: "anim", label: "Animation", icon: Play, hue: 205, kind: "group" },
  // The pencil: everything you *write* about a part — its prompt, what is
  // in it, where it sends people, and (a placeholder for now) its priority.
  // It was "Prompt" with the word on it; the word said less than the pencil.
  write: { id: "write", label: "Write", icon: Pencil, hue: 258, kind: "group" },
  // The outer top-right slab. It does not open a level: the whole wheel
  // becomes the drawing board, and what is drawn there reshapes the part.
  draw: { id: "draw", label: "Draw", icon: Brush, hue: 205, kind: "board" },
  duplicate: { id: "duplicate", label: "Duplicate", icon: Copy, hue: 205, kind: "action" },
  edit: { id: "edit", label: "Edit", icon: ListTree, hue: 205, kind: "group" },
  look: { id: "look", label: "Looks", icon: PaletteIcon, hue: 205, kind: "group" },
  delete: { id: "delete", label: "Delete", icon: Trash2, hue: 18, kind: "action" },
  /* Only the page's wheel draws this one — see `level1`. A part is already
     one element; setting an area aside is something you do to a page. */
  create: { id: "create", label: "Create", icon: CircleDashed, hue: 205, kind: "action" },
};

const GREEN = 148;
/** How much smaller than the level below it the green level is cut, per edge. */
const GREEN_SHRINK = 3;
/**
 * The third level. Red, because it is the only colour left that is neither the
 * blue of the first level nor the green of the second, and because the two are
 * never on screen together — Delete is long gone by the time an editor opens.
 */
const CRIMSON = 18;
/**
 * The three animation choices open the same three slabs, one lit for the
 * choice: which slab, counting clockwise from the green. Speed is top-right,
 * the entrance itself bottom-right, the rest bottom-left.
 */
const ANIM_SLAB = { speed: 0, entrance: 1, extras: 2 } as const;

/** What the green level holds for each blue group. */
interface Choice {
  id: string;
  label: string;
  icon: typeof Wand2;
  /** Fires on the spot; without one the choice opens its editor. */
  act?: () => void;
  /** Drawn dimmer: there is nothing for it to do right now. */
  dim?: boolean;
}

/** The icons the More pieces wear, by the tray item they came from. */
const TRAY_ICON: Record<string, typeof Wand2> = { preview: Eye, forward: ChevronsUp, back: ChevronsDown, copy: Pipette, paste: ClipboardPaste };

/** The options a part offers that are about motion: they sit under Animation, not Edit. */
function motionOptions(node: StudioNode) {
  return (getFeature(node.featureId)?.options ?? []).filter((o) => MOTION_OPTION_IDS.has(o.id));
}

/**
 * What the wheel can do that reaches past the part: making a cube a
 * solid needs the palette and somewhere to say what happened, which the
 * choices themselves do not carry.
 */
interface WheelHands {
  solid: (nodeId: string) => void;
  /** The pencil's old controls are showing, under "more". */
  writeMore?: boolean;
  more?: () => void;
}

function choicesFor(group: SlotId, node: StudioNode, hands?: WheelHands): Choice[] {
  switch (group) {
    case "look":
      return [
        { id: "hue", label: "Hue", icon: PaletteIcon },
        // The border's colour and width and the shadow it throws: a captured
        // part wears all three, and none of them had a control anywhere.
        { id: "edge", label: "Edge", icon: SquareDashed },
        { id: "texture", label: "Texture", icon: Grid2x2 },
        { id: "aura", label: "Aura", icon: Sparkles },
      ];
    case "anim":
      // Options, not entrances: each opens the animation slabs with its own
      // lit. Behaviour is the part's own motion options — a top bar's speed,
      // a carousel's autoplay — and is only there when the part has some.
      return [
        { id: "entrance", label: "Entrance", icon: Play },
        { id: "speed", label: "Speed", icon: Gauge },
        { id: "extras", label: "Extras", icon: SlidersHorizontal },
        ...(motionOptions(node).length ? [{ id: "behaviour", label: "Behaviour", icon: Orbit }] : []),
      ];
    case "write":
      // One box first: say what the part is, and it is (`SayBox.tsx`). Its
      // words, what is in it, where it sends people, the data it shows and
      // its priority are all things that box reads; the controls for each
      // are still here, one press away under More.
      if (!hands?.writeMore) {
        return [
          { id: "say", label: "Say it", icon: Wand2 },
          { id: "more", label: "More", icon: Ellipsis, act: () => hands?.more?.() },
        ];
      }
      return [
        { id: "say", label: "Say it", icon: Pencil },
        { id: "words", label: "Words", icon: Wand2 },
        { id: "contents", label: "Contents", icon: ListTree },
        { id: "links", label: "Links", icon: Link2 },
        { id: "data", label: "Data", icon: Database },
        // Must have, nice, idea: the panel's three, on a plate.
        { id: "priority", label: "Priority", icon: Flag },
      ];
    case "draw":
      // The board is not a list of choices; it has nothing on the green level.
      return [];
    default:
      // Edit is how the part is *built*: its name, its layout options —
      // columns, shape, density — and its own type. A cube is built one
      // step further, into a solid, behind the routing table: the piece is
      // there whenever the part is a cube, and fires the same road the
      // panel's button does, saying what it needs when it needs a token.
      return [
        { id: "name", label: "Name", icon: Tag },
        { id: "options", label: "Options", icon: SlidersHorizontal },
        { id: "font", label: "Font", icon: Type },
        // Everything else it wears, as CSS: the panel's Page look, on a plate (`LookFields.tsx`).
        { id: "look", label: "Page look", icon: Paintbrush },
        ...(node.featureId === "cube-3d" ? [{ id: "solid", label: "Make it a solid", icon: Boxes, act: () => hands?.solid(node.id) }] : []),
        ...(node.featureId === "mesh-3d" && node.cube ? [{ id: "cube-back", label: "Back to the cube", icon: Box, act: () => { play("tap"); showCube(node.id); } }] : []),
      ];
  }
}

/**
 * The background's wheel: the same seven pieces, about the page.
 *
 * Right-press the bare frame and the wheel opens with the page as its
 * subject. The pieces sit where a part's do, so a hand that has learned one
 * has learned the other: Motion and the pencil on the inner top band,
 * Picture on the outer block, Cut and Edit on the inner bottom band, Looks
 * on the outer, and Strip where Delete is — the one red thing, and it takes
 * the background bare the way ⌘X does, holding it so ⌘V puts it back.
 */
const SLOTS_BG: Record<Exclude<SlotId, "edit">, Slot> = {
  anim: { id: "anim", label: "Motion", icon: Play, hue: 205, kind: "group" },
  write: { id: "write", label: "Write", icon: Pencil, hue: 258, kind: "group" },
  /*
   * The outer top is two now: Draw and Create, side by side and neither
   * replacing the other, because that is the whole distinction — Draw makes
   * one element, Create sets an area aside for several. A person choosing
   * between them has to be able to see both at once, so they are halves of
   * one quadrant rather than a slab that changes its mind.
   */
  draw: { id: "draw", label: "Draw", icon: Brush, hue: 205, kind: "board" },
  create: { id: "create", label: "Create", icon: CircleDashed, hue: 205, kind: "action" },
  /*
   * Import took the slot Cut left. Cut and Strip were the same thing twice —
   * both take the background bare and hold it for a paste — and one of them
   * had to go, which freed the room the split above needed.
   *
   * It was called Picture, and the name was the honest description of what
   * it did: an `image/*` chooser whose only destination was a half-opaque
   * recoloured tile across the whole page. It takes a video too now, and
   * the frame you pick can land as a background or as a part, so Picture
   * has stopped being the whole of it.
   */
  duplicate: { id: "duplicate", label: "Import", icon: ImagePlus, hue: 205, kind: "action" },
  look: { id: "look", label: "Looks", icon: PaletteIcon, hue: 205, kind: "group" },
  delete: { id: "delete", label: "Strip", icon: Eraser, hue: 18, kind: "action" },
};

/**
 * What the green level holds for each blue group, when the subject is the page.
 *
 * `at` is where the press landed on the page, in canvas space — the same
 * point the wheel already hands Add. Create needs it and nothing else here
 * does, so it is passed rather than reached for: a choice that fires on the
 * spot has to know which spot.
 */
function bgChoicesFor(group: SlotId, at: { x: number; y: number } | null): Choice[] {
  switch (group) {
    case "look":
      // Color is one editor: the page's colour off the spectrum, the fill
      // and the veil beside it — three slabs, none empty. Texture is the
      // layers that land on the page.
      return [
        { id: "bg-color", label: "Color", icon: PaletteIcon },
        { id: "bg-texture", label: "Texture", icon: Grid2x2 },
        // The third: one lamp over the page, put down by pointing at the place.
        { id: "bg-light", label: "Light", icon: Sun },
      ];
    case "anim":
      /*
       * Glide: how the page's own texture moves.
       *
       * This slab opened one dead item — "Motion asset (soon)", which played
       * a tap and did nothing — so a whole quadrant of the page's wheel said
       * "not yet". The texture stack already knows how to move: `drift` on a
       * layer carries its tile a whole number of tiles along its own angle
       * per cycle, which is why the loop has no seam in it. Nothing was
       * driving it from the wheel, and the button that should was the one
       * saying "soon".
       */
      return [{ id: "bg-glide", label: "Glide", icon: Wind }];
    case "write":
      /*
       * Everything written about the page, which is three things and used to
       * be one. A slab that opens onto a single box is a slab a person
       * learns to walk past: it costs a piece of the wheel and saves nothing
       * over the box being there. Its name and its address are written about
       * the page in exactly the way its words are, and neither had anywhere
       * to be said on the wheel at all.
       */
      return [
        { id: "page-words", label: "Words", icon: Wand2 },
        { id: "page-name", label: "Name", icon: Tag },
        { id: "page-path", label: "Address", icon: Link2 },
      ];
    default:
      return [];
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
  const ctx = useActions();
  const [picked, setPicked] = React.useState<SlotId | null>(null);
  const [subPick, setSubPick] = React.useState<string | null>(null);
  // The pencil's old five, shown under "more" instead of the one box's pair.
  const [writeMore, setWriteMore] = React.useState(false);
  // The page's wheel turned into the add disc: pressed from its middle.
  const [adding, setAdding] = React.useState(false);
  // Re-renders the tray when looks are copied, so Paste lights up.
  const [, setCarried] = React.useState(0);
  /* The look Copy look holds (partLookApply.ts), here or on another board. */
  const heldLook = useLookClip((st) => st.look);
  const nodes = useStudio((s) => s.nodes);
  const shape = useStudio((s) => s.menuShape);
  const spin = useStudio((s) => s.menuSpin);
  const format = useStudio((s) => s.format);
  const look = useStudio((s) => s.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const layers = look.texture ?? [];
  // The subject: a part, or the page's background.
  const bg = open?.nodeId === BACKGROUND_ID;
  const node = open?.nodeId && !bg ? nodes.find((n) => n.id === open.nodeId) : undefined;

  /*
   * What Looks is wearing: the part's own surface, or the texture on it.
   *
   * The button that opens a part's looks may as well *be* the part's looks. It
   * is cut a shade larger than the face it sits on — negative shrink, the same
   * cutter — so the fill reaches almost the whole way out and what is left is a
   * line of the piece's own colour round it, which is what keeps it a button.
   *
   * Only for a part. The page's own menu has the whole page behind it already.
   */
  const worn = React.useMemo(() => {
    // The page wears its own ground and whatever texture lands on it; a part
    // wears its surface and whatever it has been given.
    const base = node ? overrideTheme(themeFrom(format), node.colour ?? {}, palette).surface : palette.bg;
    const own = node?.texture && node.texture !== "none" ? layers.find((l) => l.id === node.texture) : null;
    const site = node
      ? (!node.texture ? layers.filter((l) => l.on && lands(l, "surfaces")) : [])
      : layers.filter((l) => l.on && lands(l, "page"));
    const tile = own ? [{ ...own, on: true }] : site;
    return {
      // Cut out to the face's own edge — negative shrink, the same cutter — so
      // what is left round it is the piece's thin dark rim and no band of the
      // menu's colour. A button that shows you a look should not be showing you
      // a frame as well.
      d: piece(QUADS[Q_BOTTOM]![0], QUADS[Q_BOTTOM]![1], BLUE_RINGS.mid, "edge", shape, BLUE_RINGS, -ROUND),
      css: tile.length
        ? { ...textureCss(tile, palette, base), backgroundSize: "26px 26px" }
        : { background: base },
      ink: inkOn(base),
    };
  }, [node, format, palette, layers, shape]);

  const activePageId = useStudio((s) => s.activePageId);
  const pages = useStudio((s) => s.pages);
  const page = pages.find((p) => p.id === activePageId) ?? pages[0]!;
  // The background's Import piece: a picture or a video, handed to `ImportFlow`.
  const picture = React.useRef<HTMLInputElement>(null);

  const seq = open?.seq ?? 0;
  /*
   * The part's looks as the wheel found it, so the tray can offer "every part
   * with this colour / in this font": what this part moved from and to since
   * the wheel opened is what gets swapped across the site (`siteColours.ts`,
   * the same swap-all the Look panel's list uses).
   */
  const opened = React.useRef<(Worn & { at: number }) | null>(null);
  const openedId = node?.id ?? null;
  React.useEffect(() => {
    const n = openedId ? useStudio.getState().nodes.find((x) => x.id === openedId) : null;
    opened.current = n ? { id: n.id, colour: n.colour, edge: n.edge ?? null, art: n.art ?? null, content: n.content, font: n.font, aura: n.aura, at: seq } : null;
  }, [seq, openedId]);
  React.useEffect(() => {
    // …unless it was opened straight onto a slot, which is what "change this
    // part" does: the choice the wheel exists to offer has been made already.
    setPicked(open?.slot ?? null);
    // The pencil opens on the one box: that is what "write on this" means.
    setSubPick(open?.slot === "write" ? "say" : null);
    setWriteMore(false);
    setAdding(false);
  }, [seq, open?.slot]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (subPick) setSubPick(null);
      else if (picked) setPicked(null);
      else if (adding) setAdding(false);
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
      //
      // The tour is a fourth: it opens this menu on purpose and stands over
      // it to point at it, so its own presses must not be the click that
      // takes away the thing it is pointing at.
      if (document.documentElement.dataset.tourOn) return;
      if (el.closest?.("[data-radial], [data-menu-shape], [data-radix-popper-content-wrapper], [role='listbox'], [role='option']")) return;
      // A part's own element is the exception, and only a part's: carry on
      // clicking the thing you are editing and the menu stays. The page's
      // background is not that — the frame is most of the screen, so keeping
      // the wheel up over it means a click anywhere useful does nothing, and
      // the only way out is the grid at the edge. Click off it and it goes.
      if (open.nodeId !== BACKGROUND_ID && el.closest?.(`[data-node-id="${open.nodeId}"]`)) return;
      closeRadial();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, picked, subPick, adding]);

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
    // Where the pull is measured from: the hand's press. For the hold that
    // opened the menu that is where the menu was asked to open, which near
    // an edge is not where it was put; a later press is wherever it lands.
    let origin = open.hand ?? { x: open.x, y: open.y };
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
      if (e.button === 2) { held = true; origin = { x: e.clientX, y: e.clientY }; }
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

      // Turning is about the wheel's own centre; the pull is from the hand.
      const arx = e.clientX - anchor.current.x;
      const ary = e.clientY - anchor.current.y;
      const rx = e.clientX - origin.x;
      const ry = e.clientY - origin.y;
      const ox = origin.x - anchor.current.x;
      const oy = origin.y - anchor.current.y;

      if (stage === "turning") {
        const a = Math.atan2(ary, arx) / (Math.PI * 2);
        show({ dx: arx, dy: ary, grip: 1, stage, axis, ox: 0, oy: 0 });
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
        hold = { x: arx, y: ary };
        play("confirm");
        show(null);
        return;
      }
      if (along <= -PULL_LOCK) {
        // The green end: the wheel comes loose.
        stage = "turning";
        used = true;
        grabbed = Math.atan2(ary, arx) / (Math.PI * 2);
        was = useStudio.getState().menuSpin;
        play("confirm");
      }
      show({ dx, dy, grip, stage, axis, ox, oy });
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
      if (document.documentElement.dataset.tourOn) return;
      if (el.closest?.("[data-radial]")) return;
      // The context-menu event that trails the press that opened the menu
      // is that press, not a new one: opening again from here would throw
      // away what the press knew — where on the page it landed.
      if (current && performance.now() - openedAt < 500 && Math.hypot(e.clientX - current.hand.x, e.clientY - current.hand.y) < 6) return;
      const onNode = el.closest?.("[data-node-id]") as HTMLElement | null;
      const id = onNode?.getAttribute("data-node-id");
      const frame = el.closest?.("[data-frame]");
      if (id) openRadial(id, e.clientX, e.clientY);
      // The bare frame is the page's background: the wheel moves there, about the page, and Add lands a part on that spot.
      else if (frame) { useStudio.getState().selectBackground(); openRadial(BACKGROUND_ID, e.clientX, e.clientY, pageSpot(frame, e.clientX, e.clientY)); }
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

  if (!open) return null;

  const s = () => useStudio.getState();
  // Already kept on screen by `openRadial` and `moveRadial`.
  const px = open.x;
  const py = open.y;

  // Opened for a part that does not exist yet: the disc alone, with no wheel
  // under it to go back to. Back and done both put it away.
  if (open.nodeId === null) {
    return (
      <div data-radial className="pointer-events-none fixed inset-0 z-[68]" onContextMenu={(e) => e.preventDefault()}>
        <div className="absolute" style={{ left: px, top: py }}>
          <div data-radial-board="" className="pointer-events-none absolute left-0 top-0">
            <DrawBoard node={null} at={open.at} onBack={closeRadial} onDone={closeRadial} />
          </div>
        </div>
      </div>
    );
  }
  if (!node && !bg) return null;
  const slots = bg ? SLOTS_BG : SLOTS;

  const fire = (id: SlotId) => {
    if (bg) {
      /* Draw makes one element, on the spot the press landed: the same board
         a part's own Draw opens, with nothing to reshape yet. */
      if (id === "draw") {
        if (!open.at) { play("deny"); return; }
        openBoard(open.x, open.y, open.at);
        return;
      }
      /* Create sets an area aside for several (`createSpace.ts`). */
      if (id === "create") {
        if (!open.at) { play("deny"); return; }
        createSpaceAt(open.at.x, open.at.y);
        closeRadial();
        return;
      }
      // Import moved here when Cut went; Cut and Strip were one thing twice.
      if (id === "duplicate") { picture.current?.click(); return; }
      if (id === "delete") {
        const took = s().cutBackground();
        ctx.publish({
          key: "studio:background",
          // Only Strip reaches here now, so the branch that named the other one has gone with it.
          title: took ? "The background is stripped bare" : "The background is already bare",
          body: took ? "⌘V puts it back." : undefined,
          level: took ? "success" : "info",
          source: "studio",
          toast: true,
        });
        play(took ? "deny" : "tap");
        closeRadial();
      }
      return;
    }
    if (id === "duplicate") { s().duplicateNodes([node!.id]); play("confirm"); closeRadial(); }
    if (id === "delete") { s().removeNodes([node!.id]); play("deny"); closeRadial(); }
  };
  const take = (slot: Slot) => {
    if (slot.kind === "action") return fire(slot.id);
    play(slot.kind === "board" ? "open" : "select");
    setSubPick(slot.id === "write" && !bg ? "say" : null);
    setWriteMore(false);
    setPicked(slot.id);
  };

  /* ---------------------------------------------------------- level 1 */
  const [topA, topB] = QUADS[Q_TOP]!;
  const [botA, botB] = QUADS[Q_BOTTOM]!;
  const [delA, delB] = QUADS[Q_DELETE]!;
  const botMid = (botA + botB) / 2;
  const topMid = (topA + topB) / 2;

  const B = BLUE_RINGS;
  // The top quadrant's inner band carries three icons — Animation, the
  // pencil, and More — where the bottom one carries two; the outer block is
  // still one word, Draw.
  const t1 = topA + (topB - topA) / 3;
  const t2 = topA + (2 * (topB - topA)) / 3;
  void topMid;
  const level1: { slot: Slot; d: string; at: Pt; wear?: RingPiece["wear"]; glow?: string | null }[] = [
    /*
     * The inner top: two, on a part and on the page alike.
     *
     * The three-dot More has gone from both. It was never a menu of its own:
     * `choicesOf` returned `tray.map(...)` — the tray's own items, verbatim,
     * with the same handlers — and the tray is drawn under the wheel already.
     * A slab that opens a second copy of what is already on screen costs a
     * third of a band and saves nothing. The page lost it first; the part
     * kept it a while longer for no reason anybody could name.
     *
     * So Motion and the pencil take a half of the band each, and neither of
     * them is a sliver.
     */
    ...(bg
      ? [
        { slot: slots.anim, d: piece(topA, topMid, B.hole, B.mid, shape, B), at: middleOf(topA, topMid, B.hole, B.mid, shape, B) },
        { slot: slots.write, d: piece(topMid, topB, B.hole, B.mid, shape, B), at: middleOf(topMid, topB, B.hole, B.mid, shape, B) },
      ]
      : [
        { slot: slots.anim, d: piece(topA, topMid, B.hole, B.mid, shape, B), at: middleOf(topA, topMid, B.hole, B.mid, shape, B) },
        { slot: slots.write, d: piece(topMid, topB, B.hole, B.mid, shape, B), at: middleOf(topMid, topB, B.hole, B.mid, shape, B) },
      ]),
    /* One slab on a part, two on the page: Draw and Create, visible together
       so the choice between one element and several is a choice you can see
       rather than a mode you are in. */
    ...(bg
      ? [
        { slot: slots.draw, d: piece(topA, topMid, B.mid, "edge", shape, B), at: middleOf(topA, topMid, B.mid, "edge", shape, B) },
        { slot: slots.create, d: piece(topMid, topB, B.mid, "edge", shape, B), at: middleOf(topMid, topB, B.mid, "edge", shape, B) },
      ]
      : [{ slot: slots.draw, d: piece(topA, topB, B.mid, "edge", shape, B), at: middleOf(topA, topB, B.mid, "edge", shape, B) }]),
    /*
     * The inner bottom: two on a part, one on the page.
     *
     * The page's Edit has gone with the width it held — the bar and the
     * canvas menu both set that already — so Picture takes the whole band
     * rather than half of it, which is the room a thing that opens a file
     * wants anyway.
     */
    ...(bg
      ? [{ slot: slots.duplicate, d: piece(botA, botB, B.hole, B.mid, shape, B), at: middleOf(botA, botB, B.hole, B.mid, shape, B) }]
      : [
        { slot: slots.duplicate, d: piece(botA, botMid, B.hole, B.mid, shape, B), at: middleOf(botA, botMid, B.hole, B.mid, shape, B) },
        { slot: SLOTS.edit, d: piece(botMid, botB, B.hole, B.mid, shape, B), at: middleOf(botMid, botB, B.hole, B.mid, shape, B) },
      ]),
    // Looks wears the whole of what it opens: the colour or texture on its
    // face, and the aura round it, which is the one part of a look that is not
    // *on* the thing but around it.
    { slot: slots.look, d: piece(botA, botB, B.mid, "edge", shape, B), at: middleOf(botA, botB, B.mid, "edge", shape, B), wear: worn, glow: node ? auraColour(node.aura, palette) : null },
    // Delete is the whole quadrant, mirrored from the one opposite it and not
    // cut up: one slab, so it can never be hit as a sliver.
    { slot: slots.delete, d: piece(delA, delB, B.hole, "edge", shape, B), at: middleOf(delA, delB, B.hole, "edge", shape, B) },
  ];

  /* ---------------------------------------------------------- the board */
  // Draw is not a level: the wheel is gone and the disc is in its place.
  const onBoard = picked === "draw";

  /* ---------------------------------------------------------- the tray */
  // Under the wheel, whatever level it is on: the things a part's menu needs
  // that are not worth a piece of the wheel. Not while the board is up — the
  // board has a tray of its own.
  const nodeIndex = node ? nodes.indexOf(node) : -1;
  const was = node && opened.current?.id === node.id ? opened.current : null;
  const colourMoves = was && node ? movedColours(was, node, palette) : [];
  const fontMove = was && node ? movedFont(was, node) : null;
  /* Once swapped, what the part wears now is the new starting point: pressing again does nothing twice. */
  const reopen = () => {
    const n = node ? useStudio.getState().nodes.find((x) => x.id === node.id) : null;
    opened.current = n ? { id: n.id, colour: n.colour, edge: n.edge ?? null, art: n.art ?? null, content: n.content, font: n.font, aura: n.aura, at: seq } : null;
    setCarried((k) => k + 1);
  };
  const tray: TrayItem[] = bg
    ? [
        // "Here" means here: the board's own Preview, the same as `p`, not the full address the part's tray goes to.
        { id: "preview", label: "Preview here", icon: <Eye className="size-3" />, primary: true, onClick: () => { closeRadial(); s().setMode("preview"); } },
        { id: "paste", label: "Put the background back", icon: <ClipboardPaste className="size-3" />, disabled: !heldBackground(), onClick: () => { s().pasteBackground(); } },
        /* A part from one of your other sites, placed here in this site's look (RemixCard.tsx). */
        { id: "remix", label: "Bring from another site…", icon: <Shuffle className="size-3" />, onClick: () => { closeRadial(); openRemix(); } },
      ]
    : [
        { id: "preview", label: "Preview here", icon: <Eye className="size-3" />, primary: true, onClick: () => { closeRadial(); ctx.navigate(`${livePath(node!.pageId)}#${node!.id}`); } },
        { id: "forward", label: "Forward", icon: <ChevronsUp className="size-3" />, disabled: nodeIndex >= nodes.length - 1, onClick: () => s().raiseNode(node!.id) },
        { id: "back", label: "Backward", icon: <ChevronsDown className="size-3" />, disabled: nodeIndex <= 0, onClick: () => s().lowerNode(node!.id) },
        /* A part with states (the TV box: connecting, Find a match, the result), or one of them: its faces in order (StatesTimeline.tsx). */
        ...(hasStates(nodes, node!.id) ? [{ id: "states", label: "States timeline", icon: <History className="size-3" />, onClick: () => { closeRadial(); openStatesTimeline(node!.id); } }] : []),
        /* A part that holds a picture can have it remade from one prompt (RemakePicture.tsx). */
        ...(canRemake(node) ? [{ id: "remake", label: "Remake this picture…", icon: <Sparkles className="size-3" />, onClick: () => { closeRadial(); openRemake(node!.id); } }] : []),
        /* …or its background pointed at and made see-through (ClearBackground.tsx). */
        ...(canClearBackground(node) ? [{ id: "clear-bg", label: "Transparent background…", icon: <Eraser className="size-3" />, onClick: () => { closeRadial(); openClearBackground(node!.id); } }] : []),
        /* The look in full (fill, outline, shadow, light, corners, font, hover and press, motion), held across boards; Paste puts the facets chosen in the panel on this part, or every picked part it is one of, in one step (partLookApply.ts). */
        {
          id: "copy", label: "Copy look", icon: <Pipette className="size-3" />,
          onClick: () => { useLookClip.getState().copy(lookOf(node! as never)); play("copy"); setCarried((k) => k + 1); },
        },
        {
          id: "paste", label: "Paste look", icon: <ClipboardPaste className="size-3" />, disabled: !heldLook,
          onClick: () => { if (!heldLook) return; const n = pasteLook(pasteTargets(node!, heldLook), heldLook, useLookClip.getState().chosen); play(n ? "confirm" : "deny"); },
        },
        /* On a captured page there may be no bare page left to right-click: every part's tray can bring one too, landing where the person is looking. */
        { id: "remix", label: "Bring from another site…", icon: <Shuffle className="size-3" />, onClick: () => { closeRadial(); openRemix(); } },
        /* Make all like this: every part of this kind on the site wears its look, with the facets and the keep-colour choice the panel holds (MakeAllLike.tsx). */
        {
          id: "make-all", label: "All like this", icon: <CopyPlus className="size-3" />,
          onClick: () => { const p = useMakeAll.getState(); const n = makeAllLike(node!, p.chosen, { keepColour: p.keepColour }); play(n ? "confirm" : "deny"); ctx.publish({ key: `studio:make-all:${node!.id}`, title: n ? `Restyled ${n} more part${n === 1 ? "" : "s"} like this` : "Every part of this kind already looks like this", level: "info", source: "studio", toast: true }); },
        },
        {
          id: "same-colour", label: "All with this colour", icon: <Paintbrush className="size-3" />,
          disabled: !colourMoves.length,
          onClick: () => {
            let n = 0;
            for (const m of colourMoves) n += s().swapColourAll(m.from, m.to, palette, { use: m.use }).length;
            reopen();
            play(n ? "confirm" : "deny");
            ctx.publish({ key: `studio:same-colour:${node!.id}`, title: n ? `Recoloured ${n} more part${n === 1 ? "" : "s"}` : "No other part wore that colour", body: colourMoves.map((m) => `${m.from} → ${m.to}`).join(", "), level: "info", source: "studio", toast: true });
          },
        },
        {
          id: "same-font", label: "All in this font", icon: <Type className="size-3" />,
          disabled: !fontMove,
          onClick: () => {
            if (!fontMove) return;
            const n = s().swapFontAll(fontMove.from, fontMove.to, undefined, fontMove.patch).length;
            reopen();
            play(n ? "confirm" : "deny");
            ctx.publish({ key: `studio:same-font:${node!.id}`, title: n ? `Set ${n} more part${n === 1 ? "" : "s"} the same` : "No other part was in that font", body: fontMove.from || "the site's type", level: "info", source: "studio", toast: true });
          },
        },
      ];

  /*
   * The solid road from the wheel: the same call the panel's button makes,
   * with what came of it said as a toast, because the wheel is gone by the
   * time the model answers.
   */
  const solidFromWheel = (nodeId: string) => {
    play("confirm");
    closeRadial();
    void makeSolid(nodeId, palette).then((r) => {
      ctx.publish({ key: `studio:solid:${nodeId}`, title: r.ok ? "Made a solid" : "Still a cube", body: r.message, level: r.ok ? "success" : "info", source: "studio", toast: true });
      play(r.ok ? "confirm" : "deny");
    });
  };
  const showMore = () => { play("select"); setWriteMore(true); setSubPick(null); };
  const choicesOf = (g: SlotId): Choice[] =>
    bg ? bgChoicesFor(g, open.at) : choicesFor(g, node!, { solid: solidFromWheel, writeMore, more: showMore });

  /* ---------------------------------------------------------- level 2 */
  const group = picked && !onBoard ? (slots as Partial<Record<SlotId, Slot>>)[picked] ?? null : null;
  const choices = picked ? choicesOf(picked) : [];
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
    const rIn = outer ? G.mid : G.hole;
    const rOut = outer ? ("edge" as const) : G.mid;
    return {
      choice: c,
      // Cut a shade smaller than the level it sits on. It used to reach five
      // pixels past the console's slabs and that is enough to read as a
      // mistake — the two levels are the same object, one on top of the other.
      d: piece(a, b, rIn, rOut, shape, G, GREEN_SHRINK),
      at: middleOf(a, b, rIn, rOut, shape, G),
      // The same piece cut out to just inside its own face, for a choice that
      // shows what it would set rather than a picture of it.
      fill: piece(a, b, rIn, rOut, shape, G, GREEN_SHRINK - ROUND + 2),
    };
  });

  /* ---------------------------------------------------------- level 3 */
  // The editor is the three quadrants the green level is not using — two,
  // when the group is wide enough to need a second — each a slab like Delete,
  // on the green level's own rings, in the console's own red. The green stays
  // up, so you can see which choice you are inside and step sideways.
  const editing = subPick && !choicesOf(group?.id ?? "edit").find((c) => c.id === subPick)?.act ? subPick : null;
  const freeQuads: [number, number][] = [];
  for (let t = greenTo; t < greenFrom + 1 - 0.001; t += 0.25) freeQuads.push([t, t + 0.25]);
  // The plate editors want a square to sit in: the slab opposite the green
  // is cut square for them whatever the wheel's shape is. The animation
  // editor lights the slab its green choice is about.
  const onPlate = !!editing && !["hue", "texture", "aura", "font", "behaviour", "bg-color", "bg-texture", "bg-light", "bg-glide"].includes(editing) && !(editing in ANIM_SLAB);
  const consoleSpan: ConsoleSpan = {
    quads: freeQuads,
    rings: GREEN_RINGS,
    shape,
    spin,
    shapes: freeQuads.map(([f]) => (onPlate && Math.abs(((f % 1) + 1) % 1 - 0.25) < 0.001 ? "square" : shape)),
    lit: editing && editing in ANIM_SLAB ? ANIM_SLAB[editing as keyof typeof ANIM_SLAB] : undefined,
  };

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

        {!picked && !adding ? (
          <Ring spin={spin} shape={shape} pieces={level1.map((p) => ({
            id: p.slot.id,
            label: p.slot.label,
            icon: p.slot.icon,
            hue: p.slot.hue,
            d: p.d,
            at: p.at,
            wear: p.wear,
            glow: p.glow,
            // The inner band is too narrow for a word without it hanging over
            // the neighbours; an icon says it, and the word is on the tooltip.
            compact: p.slot.id !== "look" && p.slot.id !== "delete" && p.slot.id !== "draw",
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
        {adding ? null : !picked && bg ? (
          // The page has nothing to lock: its middle is Add. Press it and the
          // wheel becomes the add disc, with the parts rolling down its hole.
          // It is still the handle the wheel is carried by.
          <button
            type="button"
            aria-label="Add a part here"
            title="Add a part here · drag to move the wheel"
            data-menu-handle=""
            data-menu-add=""
            onPointerDown={carry}
            onClick={() => {
              if (dragged.current) { dragged.current = false; return; }
              play("open");
              setAdding(true);
            }}
            className={cn("pointer-events-auto absolute flex size-[30px] -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full transition-[filter] hover:brightness-110 active:cursor-grabbing")}
            style={{ background: "oklch(0.66 0.155 205)", border: "1px solid oklch(0.44 0.14 205)", color: "oklch(0.99 0 0)", boxShadow: "0 0 10px oklch(0.7 0.16 205 / 0.45), 0 2px 6px oklch(0 0 0 / 0.5)" }}
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
          </button>
        ) : !picked ? (
          <button
            type="button"
            aria-label={node!.locked ? "Unlock" : "Lock in place"}
            aria-pressed={node!.locked}
            data-menu-lock=""
            onPointerDown={carry}
            onClick={() => {
              // A drag moved the menu; it was not a press on the lock.
              if (dragged.current) { dragged.current = false; return; }
              play(node!.locked ? "confirm" : "close");
              s().updateNode(node!.id, { locked: !node!.locked });
            }}
            className={cn("pointer-events-auto absolute flex size-[30px] -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full transition-colors active:cursor-grabbing")}
            style={{
              background: node!.locked ? `oklch(0.72 0.16 60)` : CONSOLE.face,
              border: `1px solid ${node!.locked ? "oklch(0.52 0.14 60)" : CONSOLE.rim}`,
              color: node!.locked ? "oklch(0.2 0.06 60)" : CONSOLE.text,
              boxShadow: "0 2px 6px oklch(0 0 0 / 0.5)",
            }}
          >
            {node!.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
          </button>
        ) : onBoard ? null : (
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
            className={cn("pointer-events-auto absolute flex size-[30px] -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full active:cursor-grabbing")}
            style={{
              background: editing ? CONSOLE.well : `oklch(0.32 0.06 ${GREEN})`,
              border: `1px solid ${editing ? CONSOLE.rim : `oklch(0.5 0.12 ${GREEN})`}`,
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
              shape={shape}
              green
              pieces={greenPieces.map((p) => ({
                id: p.choice.id,
                label: p.choice.label,
                icon: p.choice.icon,
                hue: GREEN,
                d: p.d,
                at: p.at,
                on: p.choice.id === subPick,
                dim: p.choice.dim,
                preview:
                  bg
                    ? p.choice.id === "bg-color"
                      ? <span data-preview-badge="" className="block" style={{ width: PREVIEW.size, height: PREVIEW.size, borderRadius: PREVIEW.radius, background: palette.bg, outline: "1px solid oklch(0 0 0 / 0.45)" }} />
                      : undefined
                    : p.choice.id === "hue" ? <HueSwatch node={node!} palette={palette} />
                      // Aura shows the aura this part has, worn the way it wears
                      // it — the glow, the ring, the pulse — not a word for it.
                      : p.choice.id === "aura" ? <AuraSwatch node={node!} palette={palette} />
                        : undefined,
                // Texture wears its texture over almost the whole tile, with a
                // line of green left round it. A fingernail swatch in the middle
                // of a green square was a picture of the answer; this is it.
                wear: !bg && p.choice.id === "texture" ? textureWear(p.fill, node!, palette, layers) : null,
                glow: !bg && p.choice.id === "aura" ? auraColour(node!.aura, palette) : null,
                onPick: () => {
                  play("select");
                  // A choice that fires on the spot is not somewhere you are:
                  // nothing opens, so nothing is left to step back out of.
                  if (p.choice.act) { p.choice.act(); return; }
                  setSubPick(p.choice.id);
                },
              }))}
            />
          </div>
        ) : null}

        {/*
          The board: the whole menu, as one disc with no hole. There is no
          middle button while it is up, the middle is drawing space, so its
          way back is on its own rim. Escape steps back to the wheel as well.
        */}
        {onBoard ? (
          <div data-radial-board="" className="pointer-events-none absolute left-0 top-0">
            <DrawBoard node={node!} at={null} onBack={() => setPicked(null)} onDone={closeRadial} />
          </div>
        ) : null}

        {/* The add disc: the page's wheel as a hole the parts roll through. Back is on its rim; Escape steps back too. */}
        {adding ? (
          <div data-radial-board="add" className="pointer-events-none absolute left-0 top-0">
            <AddDisc at={open.at} onBack={() => setAdding(false)} onDone={closeRadial} />
          </div>
        ) : null}

        {group && editing ? (
          <div data-radial-editor={editing} className="pointer-events-none absolute left-0 top-0">
            <QuadrantConsole span={consoleSpan} onGrip={carry}>
              {(slabs) => (bg ? <BackgroundEditor which={editing} slabs={slabs} page={page} /> : <Editor which={editing} node={node!} slabs={slabs} onMore={showMore} />)}
            </QuadrantConsole>
          </div>
        ) : null}

        {/*
          The tray, under the wheel: a tab that opens on hover into the few
          actions that are about the part but not about editing it, seeing
          it live, its place among the others, carrying its looks. It hangs
          under whichever level is up, and steps aside for the board and the
          add disc. It was built and never drawn for a while: this comment
          stood over nothing, and the seven actions on it (Preview here,
          Forward, Backward, Copy looks, Paste looks, Put the background back)
          could not be reached from the wheel at all.
        */}
        {!onBoard && !adding ? (
          <HoverTray
            testId={bg ? "page" : "part"}
            at={[0, (picked ? GREEN_RINGS.reach : BLUE_RINGS.reach) * (shape === "square" ? Math.SQRT2 : 1) + TRAY_DROP]}
            icon={<Ellipsis className="size-3.5" />}
            label="More"
            items={tray}
          />
        ) : null}
        {/*
          The background's Import piece.

          It opened an `image/*` chooser and turned whatever it got into a
          tiled texture layer on the spot — one destination, no choice, and
          no video. It hands the file to `ImportFlow` now, which scrubs a
          video to a frame and then asks where the frame should land. The
          wheel shuts as it goes, because the flow is the next thing to look
          at and two of them open at once is one too many.
        */}
        {bg ? (
          <input
            ref={picture}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            aria-label="Import a picture or a video"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                const video = f.type.startsWith("video/");
                play("confirm");
                closeRadial();
                openImport({ url: URL.createObjectURL(f), from: video ? "video" : "picture", name: f.name });
              }
              e.target.value = "";
            }}
          />
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
    // Drawn from the hand's press, which near an edge is not the menu's middle.
    <svg width={1} height={1} className="pointer-events-none absolute overflow-visible" style={{ left: pull.ox, top: pull.oy }}>
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
    <svg width={1} height={1} className="pointer-events-none absolute overflow-visible" style={{ left: pull.ox, top: pull.oy }}>
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
  /**
   * What this piece is *wearing*: the look it would open, painted on it.
   *
   * `d` is the piece cut a shade larger than the face it is drawn on, so the
   * fill reaches almost the whole way out and leaves the piece's own colour as
   * a line round it. `ink` is the colour its icon and word are drawn in, picked
   * from the fill so they read on it whatever it is.
   */
  wear?: { d: string; css: React.CSSProperties; ink: string } | null;
  /** Nothing to do right now: drawn dimmer, still there. */
  dim?: boolean;
  onPick: () => void;
}

/** One flat colour, and a darker line round it. */
export const LIGHT_INK = "oklch(0.99 0 0)";
const DARK_INK = "oklch(0.15 0.02 0)";

/**
 * Which ink reads on a given fill.
 *
 * Not `mix-blend-mode: difference`, and not a computed complement, though both
 * were on the table: each of them lands on the fill itself at mid grey — the
 * difference of 0.5 with 0.5 is 0, and the complement of a neutral is the same
 * neutral — so on exactly the fills where legibility is hardest they vanish.
 * Lightness decides instead, which cannot fail, and a shadow the other way up
 * carries the glyph over a texture that is light in one place and dark in the
 * next.
 */
function inkOn(colour: string): string {
  const c = parseColor(colour);
  return !c || c.l > 0.62 ? DARK_INK : LIGHT_INK;
}

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
function Ring({ pieces, green, spin, shape }: { pieces: RingPiece[]; green?: boolean; spin: number; shape: Shape }) {
  const [hot, setHot] = React.useState<string | null>(null);
  const clipId = React.useId().replace(/[^a-zA-Z0-9]/g, "");
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
          /*
           * A piece wearing a look keeps its own colours under the hand.
           *
           * Every other piece answers a hover by going a brighter blue, which
           * is right for a blue button and wrong for this one: Looks *is* the
           * part's colour or texture, and a blue wash over it under the hand
           * says the button is blue after all. So the swell stays — the piece
           * still lifts toward the pointer, which is the feedback that matters
           * — and the paint underneath does not move.
           */
          const tint = p.wear ? false : lit;
          const faceW = 2 * (ROUND + (lit ? SWELL : 0));
          const n = nudge(p.at, !!lit);
          const Icon = p.icon;
          const wide = p.compact ? 30 : 96;
          return (
            <g
              key={p.id}
              style={{ transform: `translate(${n[0]}px, ${n[1]}px)`, transition: "transform 130ms ease-out", opacity: p.dim ? 0.45 : 1 }}
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
                fill={rim(p.hue, !!tint)}
                stroke={rim(p.hue, !!tint)}
                strokeWidth={faceW + EDGE * 2}
                strokeLinejoin={joinFor(shape)}
                strokeMiterlimit={2}
                strokeLinecap={joinFor(shape) === "miter" ? "butt" : "round"}
                style={{
                  transition: "stroke-width 130ms ease-out, fill 130ms ease-out, stroke 130ms ease-out, filter 130ms ease-out",
                  // The Aura piece wears the aura it would set. A worn piece
                  // under the hand catches a little more light along its edge
                  // — a brighten, not a colour — since it has given up the
                  // tint every other piece uses to say it is hovered.
                  filter: p.glow ? `drop-shadow(0 0 7px ${p.glow}) drop-shadow(0 0 2px ${p.glow})` : undefined,
                }}
              />
              <path
                d={p.d}
                className="pointer-events-none"
                fill={face(p.hue, !!tint)}
                stroke={face(p.hue, !!tint)}
                strokeWidth={faceW}
                strokeLinejoin={joinFor(shape)}
                strokeMiterlimit={2}
                strokeLinecap={joinFor(shape) === "miter" ? "butt" : "round"}
                style={{
                  transition: "stroke-width 130ms ease-out, fill 130ms ease-out, stroke 130ms ease-out, filter 130ms ease-out",
                  // A worn piece has given up the tint every other piece uses
                  // to say it is under the hand, so its edge catches a little
                  // more light instead: the same colour, brighter, which is a
                  // rim brighten and not a colour swap. The face itself is
                  // covered by what the piece is wearing, so this shows only
                  // where the piece meets the board.
                  filter: p.wear && lit ? "brightness(1.18)" : undefined,
                }}
              />
              {p.wear ? (
                <>
                  <defs>
                    <clipPath id={`${clipId}-${p.id}`}>
                      <path d={p.wear.d} />
                    </clipPath>
                  </defs>
                  {/* The look itself, cut to the shape of the piece. A texture
                      is CSS, gradients, a tiled picture, and no SVG fill
                      takes CSS, so it is an HTML box clipped to the path. */}
                  <foreignObject
                    x={-260}
                    y={-260}
                    width={520}
                    height={520}
                    clipPath={`url(#${clipId}-${p.id})`}
                    className="pointer-events-none"
                  >
                    <div data-worn={p.id} style={{ width: "100%", height: "100%", ...p.wear.css }} />
                  </foreignObject>
                </>
              ) : null}
              <foreignObject x={p.at[0] - wide / 2} y={p.at[1] - 18} width={wide} height={36} className="pointer-events-none overflow-visible">
                <div
                  className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[8.5px] font-semibold leading-tight tracking-tight"
                  title={p.label}
                  style={{
                    transform: `rotate(${(-spin * 360).toFixed(2)}deg)`,
                    transformOrigin: "center",
                    // On a piece wearing a look, the ink is picked from what it
                    // is wearing, and the shadow behind it is the other way up,
                    // so the word survives a busy texture as well as a flat
                    // colour.
                    color: p.wear ? p.wear.ink : "oklch(0.99 0 0)",
                    textShadow: p.wear
                      ? `0 1px 2px ${p.wear.ink === LIGHT_INK ? "oklch(0 0 0 / 0.75)" : "oklch(1 0 0 / 0.7)"}`
                      : `0 1px 2px oklch(0.25 0.08 ${p.hue} / 0.75)`,
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
    <span
      data-preview-badge=""
      className="flex overflow-hidden"
      style={{ height: PREVIEW.size, width: PREVIEW.wide, borderRadius: PREVIEW.radius, outline: "1px solid oklch(0 0 0 / 0.45)" }}
    >
      {roles.map((r) => <span key={r} className="flex-1" style={{ background: t[r] }} />)}
    </span>
  );
}

/**
 * A hatch, for a tile with no texture on it yet.
 *
 * A flat square of the surface colour is what the tile used to show when a part
 * follows the site and the site has no texture — which is a swatch of nothing,
 * on a button whose whole job is to say what texture this is. A fine diagonal
 * hatch says "texture, none set" in the space a fingernail has, and it cannot
 * be mistaken for a colour.
 */
const HATCH: React.CSSProperties = {
  backgroundImage: "repeating-linear-gradient(45deg, oklch(1 0 0 / 0.22) 0 1px, transparent 1px 4px)",
  backgroundSize: "6px 6px",
};

/**
 * What a Texture tile wears: the tile itself, over the whole face.
 *
 * Following the site means wearing what the site puts on its surfaces, and
 * wearing nothing at all means the hatch — a swatch of the surface colour is a
 * swatch of nothing on a button whose whole job is to say what texture this is.
 */
function textureWear(d: string, node: StudioNode, palette: Palette, layers: TextureLayer[]): RingPiece["wear"] {
  const own = node.texture && node.texture !== "none" ? layers.find((l) => l.id === node.texture) : null;
  const site = !node.texture ? layers.filter((l) => l.on && lands(l, "surfaces")) : [];
  const tile = own ? [{ ...own, on: true }] : site;
  const base = node.texture === "none" ? "oklch(0.3 0.03 148)" : palette.surface;
  return {
    d,
    css: tile.length
      ? { ...textureCss(tile, palette, base), backgroundSize: "22px 22px" }
      : { background: base, ...HATCH },
    ink: inkOn(base),
  };
}

/** The aura this part is wearing, on a block wearing it the way the part does. */
function AuraSwatch({ node, palette }: { node: StudioNode; palette: Palette }) {
  const worn = auraStyle(node.aura, palette, node.auraSize, node.auraStyle);
  return (
    <span
      data-aura-swatch=""
      data-preview-badge=""
      className="block"
      style={{ width: PREVIEW.size, height: PREVIEW.size, borderRadius: PREVIEW.radius, background: palette.surface, outline: `1px solid ${worn ? "transparent" : "oklch(1 0 0 / 0.45)"}`, ...((worn ?? {}) as React.CSSProperties) }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* The one editor a green choice asked for                             */
/* ------------------------------------------------------------------ */

/**
 * AN EDIT ON THE WHEEL IS AN EDIT TO THE SELECTION. Opened on one of several
 * picked parts, the wheel changes all of them — but only what was changed:
 * painting the words white on one card leaves the other cards' fills, borders
 * and faces as they are. Colour, edge and font are merged key by key; any
 * other field is set as it is. One undo for the lot.
 */
const MERGED = new Set(["colour", "edge", "font"]);
export function applyToSelection(node: StudioNode, patch: Partial<StudioNode>) {
  const st = useStudio.getState();
  const ids = st.selection.length > 1 && st.selection.includes(node.id) ? st.selection : [node.id];
  if (ids.length === 1) return st.updateNode(node.id, patch);
  const diff: Record<string, { set: Record<string, unknown>; drop: string[] } | { whole: unknown }> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!MERGED.has(k)) { diff[k] = { whole: v }; continue; }
    const was = ((node as unknown as Record<string, Record<string, unknown> | null>)[k] ?? {}) as Record<string, unknown>;
    const now = (v ?? {}) as Record<string, unknown>;
    const set: Record<string, unknown> = {};
    for (const [kk, vv] of Object.entries(now)) if (JSON.stringify(was[kk]) !== JSON.stringify(vv)) set[kk] = vv;
    diff[k] = { set, drop: Object.keys(was).filter((kk) => !(kk in now)) };
  }
  st.patchNodes(ids, (n) => Object.fromEntries(Object.entries(diff).map(([k, d]) => {
    if ("whole" in d) return [k, d.whole];
    const own = { ...(((n as unknown as Record<string, Record<string, unknown> | null>)[k]) ?? {}), ...d.set };
    for (const kk of d.drop) delete own[kk];
    return [k, Object.keys(own).length ? own : null];
  })) as Partial<StudioNode>);
}

function Editor({ which, node, slabs, onMore }: { which: string; node: StudioNode; slabs: Slab[]; onMore: () => void }) {
  const format = useStudio((st) => st.format);
  const look = useStudio((st) => st.look);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const update = (patch: Partial<StudioNode>) => applyToSelection(node, patch);
  const siteColours = React.useMemo(() => {
    if (which !== "edge") return [];
    const t = tallyColours(useStudio.getState().nodes, palette);
    return [...new Set([...t.byUse.border, ...t.byUse.shadow, ...t.all].map((c) => c.value))];
  }, [which, palette]);

  // The three that are about looks are drawn on the slabs themselves.
  if (which === "edge") {
    return <EdgeQuads slabs={slabs} edge={node.edge ?? null} palette={palette} siteColours={siteColours} onChange={(edge) => update({ edge })} />;
  }
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
  // The three animation choices open the same three slabs, with the chosen
  // one lit: how it comes in, how fast, and the rest.
  if (which in ANIM_SLAB) {
    return <AnimQuads slabs={slabs} node={node} focus={which as keyof typeof ANIM_SLAB} onChange={(patch) => update(patch)} />;
  }
  // The part's own motion options, one per slab.
  if (which === "behaviour") {
    return (
      <BehaviourQuads
        slabs={slabs}
        options={motionOptions(node)}
        values={node.options}
        onChange={(id, value) => update({ options: { ...node.options, [id]: value } })}
      />
    );
  }
  // Its type: the sliders together on two slabs, the families on the third.
  if (which === "font") {
    return <FontQuads slabs={slabs} font={node.font} onChange={(font) => update({ font })} />;
  }
  // Everything else is words and lists, and there is no honest way to bend a
  // text field round a curve. They go on a plate, in the slab opposite the
  // green — cut square for it whatever the wheel's shape is.
  const plate = slabs.find((s) => Math.abs(((s.from % 1) + 1) % 1 - 0.25) < 0.001) ?? slabs[0]!;
  if (which === "say") return <SayPlate node={node} plate={plate} onMore={onMore} />;
  return <PlateEditor which={which} node={node} plate={plate} spare={slabs.filter((s) => s !== plate)} />;
}
