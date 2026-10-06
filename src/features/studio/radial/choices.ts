import { Box, Boxes, Brush, ChevronsDown, ChevronsUp, CircleDashed, ClipboardPaste, Copy, Paintbrush, Database, Ellipsis, Eraser, Eye, Flag, Gauge, Grid2x2, ImagePlus, Link2, ListTree, Orbit, Palette as PaletteIcon, Pencil, Pipette, Play, SlidersHorizontal, Sparkles, SquareDashed, Sun, Tag, Trash2, Type, Wand2, Wind } from "lucide-react";
import { type StudioNode } from "../store";
import { getFeature, MOTION_OPTION_IDS } from "../catalog";
import {
BLUE_RINGS, type Pt
} from "../menuGeometry";
import { play } from "@/core/audio/engine";
import { showCube } from "../solidRun";
import { useRadial } from "./open";

/**
 * The pull: where the line starts showing, and how far out either end is.
 *
 * Between the hole and an end it fades up. The red end unlocks *moving*, the
 * green end unlocks *turning*, and the line goes when either is reached.
 */
export const PULL_FROM = BLUE_RINGS.hole + 6;
export const PULL_LOCK = BLUE_RINGS.reach + 16;
/** How far below the wheel's edge the tray hangs. */
export const TRAY_DROP = 22;

/**
 * Where the gesture has got to.
 *
 * `pull` — on the line, fading up toward one end or the other.
 * `moving` — reached the red end: the whole menu follows the hand.
 * `turning` — reached the green end: the wheel turns under the hand.
 */
export type PullStage = "pull" | "moving" | "turning";
export interface Pull {
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

export type SlotId = "anim" | "write" | "draw" | "create" | "duplicate" | "edit" | "look" | "delete";

export interface Slot {
  id: SlotId;
  label: string;
  icon: typeof Wand2;
  hue: number;
  /** A group opens the green level; an action fires and closes; the board replaces the wheel. */
  kind: "group" | "action" | "board";
}

export const SLOTS: Record<SlotId, Slot> = {
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

export const GREEN = 148;
/** How much smaller than the level below it the green level is cut, per edge. */
export const GREEN_SHRINK = 3;
/**
 * The third level. Red, because it is the only colour left that is neither the
 * blue of the first level nor the green of the second, and because the two are
 * never on screen together — Delete is long gone by the time an editor opens.
 */
export const CRIMSON = 18;
/**
 * The three animation choices open the same three slabs, one lit for the
 * choice: which slab, counting clockwise from the green. Speed is top-right,
 * the entrance itself bottom-right, the rest bottom-left.
 */
export const ANIM_SLAB = { speed: 0, entrance: 1, extras: 2 } as const;

/** What the green level holds for each blue group. */
export interface Choice {
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
export function motionOptions(node: StudioNode) {
  return (getFeature(node.featureId)?.options ?? []).filter((o) => MOTION_OPTION_IDS.has(o.id));
}

/**
 * What the wheel can do that reaches past the part: making a cube a
 * solid needs the palette and somewhere to say what happened, which the
 * choices themselves do not carry.
 */
export interface WheelHands {
  solid: (nodeId: string) => void;
  /** The pencil's old controls are showing, under "more". */
  writeMore?: boolean;
  more?: () => void;
}

export function choicesFor(group: SlotId, node: StudioNode, hands?: WheelHands): Choice[] {
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
export const SLOTS_BG: Record<Exclude<SlotId, "edit">, Slot> = {
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
export function bgChoicesFor(group: SlotId, at: { x: number; y: number } | null): Choice[] {
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
