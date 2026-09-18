"use client";
/**
 * The Studio document: what the site should be, expressed as icons, drawings
 * and per-element prompts on a canvas.
 *
 * Shape of the model:
 *   Page      an artboard / route. "Number of pages" is just this list.
 *   Node      a feature icon placed on a page, with its OWN prompt.
 *   Group     a named set of nodes, with its own prompt covering the set.
 *   Shape     freehand ink, a region frame, or an arrow linking two nodes.
 *   Format    site-wide options (see format.ts).
 *   Brief     the central gimmick and the master prompt.
 *
 * Position is meaningful: the compiler reads x/y to infer reading order,
 * containment and adjacency, so where you put something is part of the spec.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/core/lib/ids";
import { getFeature, setBrought } from "./catalog";
import { Boxes } from "lucide-react";
import { takeDoc } from "./docTake";
import { formatDefaults, type FormatValues } from "./format";
import { defaultLight, delayMs, emptyLook, lands, newLayer, speedK, type AnimEase, type AuraStyle, type Light, type Look, type TextureLayer } from "./look";

/**
 * The page's background is a thing you can pick: click the bare frame and
 * it is selected, like a part. This is the id that stands for it in
 * `selection`; nothing else ever has it.
 */
export const BACKGROUND_ID = "background";

/**
 * What was cut last, held until it is put back — parts, or the background.
 * A module variable, not store state: a hand holding something, not a thing
 * the site remembers, and never written to disk.
 */
type Held =
  | { kind: "nodes"; nodes: StudioNode[] }
  | { kind: "background"; layerIds: string[]; fill: string; veil: number };
let held: Held | null = null;
export const heldBackground = () => (held?.kind === "background" ? held : null);
export const heldNodes = () => (held?.kind === "nodes" ? held : null);
import { newMotion, SLEEVES, type MotionAsset } from "./motion";
import type { Spend } from "./spend";
import { useLayoutEffect } from "react";
import type { NodeLink } from "./parts/types";
import type { NodeColour, NodeFont } from "./parts/theme";
import { normaliseSketch, type OutlineClip, type Sketch } from "./sketch";
import type { DrawnKind, DrawnRole } from "./shapeKind";
import type { DrawKind } from "./drawKinds";
import type { DrawnVector, VectorRole } from "./vector";
import { emptyCube, type CubeData, type CubeFace, type CubeSide } from "./parts/cubeFaces";
import type { MeshData } from "./parts/types";
import type { PartCode } from "./snippet";
import type { Picture } from "./pictures";
import { liveAfterPrune, pruneThread as cutThread, THREAD_LIMIT, type Thread, type ThreadDoc } from "./threads";
import { QUEUED } from "./formation";
import { trimQueue, type DrawJob } from "./queue";
import { boundaryIn, inheritedFrom, lockLayout, placeLocked, spaceOf, tidyBoundary } from "./space";
import type { Locked, Placed, Plan, Space } from "./space";

/**
 * What is in your hand. Four, not six.
 *
 * `pan` is gone because the cursor pans — a press on the bare ground outside
 * the page drags the view. `frame` is gone from the *bar*, but it stays in
 * `ShapeKind` below: it drew a rectangle annotation, and every one already
 * drawn still renders. Not persisted, so nothing has to be migrated.
 *
 * `space` is the fifth, and the second thing a closed line can become: with
 * it in hand a closed boundary on the page is a placeholder, not ink
 * (`space.ts`).
 */
export type Tool = "select" | "pen" | "arrow" | "erase" | "space";
export type Priority = "must" | "nice" | "idea";
export type ShapeKind = "pen" | "frame" | "arrow";
/** The board shows either the design surface or the site it describes. */
/** The board, the site as it runs, or the iteration book: brief, JSON and every thread. */
/**
 * What 100% means on the board.
 *
 * The readout is the *nominal* zoom — the number in the bar, and the number
 * the clamp below is measured in — and the preview is drawn at that times
 * this. They were the same thing until J pointed out that the size he
 * actually works at is two presses of the plus above a fitted board: 1.1
 * twice over, which is 121%. That size is the size, so it is called 100 and
 * everything else is measured from it.
 *
 * Only the preview takes it. The timeline is not a preview of anything and
 * fits itself to its own boxes, so it draws at the nominal zoom.
 */
export const BASE_ZOOM = 1.21;

/** The clamp, in nominal terms: a quarter of the base to two and a half times it. */
export const ZOOM_MIN = 0.25;
/**
 * How small the *fit* may go, which is not how small a person may zoom.
 *
 * Two floors for two jobs, and conflating them put the page off the edge of
 * a phone. `ZOOM_MIN` is the zoom-out key's stop, a product choice, and
 * `tests/one-zoom.mjs` holds it at 25%. The fit is not a choice: the page's
 * two side edges must be on screen, and at a 400px pane a desktop frame
 * needs 0.156 to manage it. Floored at 0.25 it asked for a 436px page in a
 * 400px pane and got one — 36 off the right at 400 and 61 at 375, with the
 * pane clipping and no way to reach it.
 *
 * So the fit has its own floor, low enough never to be the reason the width
 * rule is broken. A person still cannot zoom out past 25% by hand.
 */
export const FIT_MIN = 0.05;
export const ZOOM_MAX = 2.5;

export type BoardMode = "design" | "preview" | "book";
export type ShapeRelation = "flow" | "data";

/** What a part is cut to: a box unless something says otherwise. */
export type NodeShape = "circle" | "ellipse" | "rounded" | "box";
export const NODE_SHAPES: NodeShape[] = ["box", "rounded", "circle", "ellipse"];

export interface StudioNode {
  id: string;
  pageId: string;
  featureId: string;
  label: string;
  /** The element's own prompt — specific to this placement. */
  prompt: string;
  /** What it contains: tab labels, links, placeholder text. The board draws this. */
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  groupId: string | null;
  options: Record<string, string>;
  priority: Priority;
  /** True for "New Idea" nodes the user invents rather than picks. */
  custom: boolean;
  /** Optional emoji shown instead of the feature icon (custom ideas). */
  glyph: string | null;
  hue: number | null;
  locked: boolean;
  /** Where this part sends you (a page, a web address, another part). */
  link: NodeLink | null;
  /** What it shows or does — the values and actions the backend must provide. */
  data: string;
  /** Roles this part repaints for itself. Empty or null means it follows the site. */
  colour: NodeColour | null;
  /** This part's own type — family, size, weight, spacing, leading — or null to follow the site. */
  font: NodeFont | null;
  /** How it arrives on the page — one of `ENTRANCES`, or null for no entrance. */
  anim: string | null;
  /** How quickly, how long after the page, and with what easing. */
  /** A multiplier on the usual entrance length (`ENTRANCE_MS`): 1.8 is slow, 0.14 instant. */
  animSpeed: number;
  /** Milliseconds before the entrance starts. */
  animDelay: number;
  animEase: AnimEase;
  /**
   * The shape the part is cut to, or null for the box every part is by
   * default. A circle drawn round something on the drawing board sets this;
   * without it the drawing's outline was measured for its size and its
   * shape thrown away, so a circle came back as a rectangle.
   */
  shape: NodeShape | null;
  /**
   * The exact edge the part is cut to, when a line was drawn that no bucket
   * fits: a helix, a star, a scrawl. `shape` names the five shapes worth
   * naming; this keeps the line itself, in the part's own box, and the part
   * is cropped to it. Null when the drawing said nothing a box does not.
   */
  outline: OutlineClip | null;
  /**
   * What the drawn shape means the part *does*, when a drawing made it.
   *
   * `outline` is the edge and this is the behaviour: a closed shape is a
   * surface that holds content, a ring is a container that owns what falls
   * inside it, parallel strokes are a list, a straight line is a connector
   * between the parts at its ends (`shapeKind.ts`). Null for every part
   * that was placed rather than drawn.
   */
  kind: DrawnKind | null;
  /**
   * The drawing itself, as vector, before anything decided what it is for.
   *
   * His lines, traced, kept whole: the same shape can be an icon on a
   * button, the frame of something that holds content, or a path another
   * part moves along. `role` says which, and is never guessed.
   */
  vector: DrawnVector | null;
  /** What the drawing is being used as. Null means nobody has said yet. */
  role: VectorRole | null;
  /**
   * The six faces, when this part is a cube.
   *
   * On the node rather than in the part, because they are the author's
   * words: edited long after the cube exists, carried into the document,
   * and so through publish, Build and the live page. The part is handed
   * them and draws them.
   */
  cube: CubeData | null;
  /**
   * The solid, when this part is one.
   *
   * A GLB as a `data:` URI, on the node for the same reason the faces are:
   * the document carries what it draws, so publish, Build and the live page
   * all ship the same bytes and nothing is fetched when the part renders.
   * It is the largest thing a node can hold, which is why the model is
   * asked for a small face count rather than the best mesh it can make.
   */
  mesh: MeshData | null;
  /**
   * A body written for this part, when the drawing asked for something no
   * part in the library is: a helix of sentences, a spiral of names. SVG or
   * HTML with inline styles, rendered in a frame with no permissions
   * (`snippet.ts`), cropped by `outline` like everything else. It lives in
   * the document, so it survives publish and goes to Build with the rest.
   */
  code: PartCode | null;
  /** A colour round its edge — a palette role, or a colour of its own — or null for none. */
  aura: string | null;
  /** How far the aura reaches, as a multiple of the usual. */
  auraSize: number;
  /** Soft glow, hard ring, or a glow that pulses. */
  auraStyle: AuraStyle;
  /** A texture layer id this part wears on its own surface, or null. */
  texture: string | null;
  /**
   * The picture this part holds, as a reference and never as bytes.
   *
   * The document keeps a path, a size and what it shows; the bytes live in
   * this browser's file storage until a publish puts them in the repository
   * (`pictures.ts`). A photograph inlined here would share localStorage with
   * the board, the builds and the keys, and take all of them with it when it
   * overflowed — and would be carried again by every publish for ever,
   * whether or not the picture had changed.
   */
  picture?: Picture | null;
  /**
   * What was drawn for it on the drawing board, and the words beside it.
   * Kept so the board reopens with the drawing still on it, the blueprint
   * can say what was drawn, and "make real" can be run again later.
   */
  sketch: Sketch | null;
  /**
   * How this one part is to be made, when a person has said: the model and
   * the order of the steps, set from its own panel inside a space
   * (`space.ts`). Null or absent means the route decides, as it always did.
   * Optional, so a saved board from before this existed, and the shelf's
   * own preview nodes, need nothing added.
   */
  plan?: Plan | null;
  /**
   * The live element this was recreated from, when one was (`recreate.ts`).
   *
   * Kept so the panel can say whose it was and read it again, and so the
   * blueprint can say a part is a recreation rather than an invention.
   * Absent on every part that was drawn or placed.
   */
  from?: { url: string; host: string; selector: string; at: number } | null;
}

export interface StudioGroup {
  id: string;
  pageId: string;
  label: string;
  prompt: string;
  hue: number;
}

export interface StudioShape {
  id: string;
  pageId: string;
  kind: ShapeKind;
  /** Canvas-space points. Frames and arrows use two points. */
  points: [number, number][];
  hue: number;
  width: number;
  label: string;
  prompt: string;
  /** Arrows can bind two nodes into an explicit relation. */
  fromNodeId?: string | null;
  toNodeId?: string | null;
  /** "flow" is a plain relationship; "data" means the target reads from the source. */
  relation?: ShapeRelation;
  /**
   * When the stroke went down. Ink from before this existed has none, and
   * `inkGroups` groups that by space alone rather than pretending.
   */
  at?: number;
  /**
   * Which drawing this stroke is in, when a person has said.
   *
   * Absent is the normal case: the grouping is guessed from time and space.
   * Set, it is a decision and the guess does not overrule it.
   */
  group?: string | null;
}

export interface StudioPage {
  id: string;
  name: string;
  path: string;
  prompt: string;
  /** Overrides the site-wide scroll mode when set. */
  scroll: string;
}

export interface StudioBrief {
  name: string;
  gimmick: string;
  master: string;
}

/**
 * A repository whose website has been brought onto the board, and the
 * shelf category its elements live in.
 *
 * In the document, not in the catalogue file: these change while the app
 * is running and they belong to this site, so they are saved with it and
 * come back with it. `page` is which file in the repository was opened,
 * because "1:1 with what?" is the first question anybody asks afterwards.
 */
export interface BroughtRepo {
  id: string;
  label: string;
  hue: number;
  /** owner/name, as it was typed, with the ref when one was named. */
  from: string;
  page: string;
  at: number;
}

/**
 * One element a repository brought in: a preset of a real library part.
 *
 * It sits in the shelf under the repository's own category and drops as an
 * ordinary node — the words, colours, type and layout measured off the
 * page, on a component this app already has. Editable and promptable from
 * that moment, which is the whole point of measuring rather than
 * screenshotting.
 */
export interface BroughtPart {
  id: string;
  categoryId: string;
  label: string;
  /** The real library part that draws it. */
  basedOn: string;
  blurb: string;
  w: number;
  h: number;
  content: string;
  options: Record<string, string>;
  colour: NodeColour | null;
  font: NodeFont | null;
  prompt: string;
}

/* ------------------------------------------------------------------ */
/* The prompts' paper trail                                            */
/* ------------------------------------------------------------------ */

/** What Claude found wrong, or missing, about one target — and the words that would fix it. */
export type RevisionKind = "blocks" | "contradiction" | "missing" | "fights" | "cost" | "note";
export interface Revision {
  /** "site", "page: Home", or an element's name as the brief printed it. */
  target: string;
  kind: RevisionKind;
  finding: string;
  /** The revised prompt for that target, complete, or empty when the fix is not a prompt. */
  prompt: string;
}

export type TrailStage = "author" | "critique" | "final";
export type TrailTargetKind = "site" | "page" | "node" | "group" | "loose";
export interface TrailTarget { kind: TrailTargetKind; id: string; label: string }
/**
 * One step in a prompt's life: what the author wrote (`author`), what Claude
 * said about it (`critique`, carrying the prompt it proposed), and what the
 * author accepted (`final`). Each step points at the one it answers, so the
 * trail reads account to account: this was said, this was found, this is
 * what stands now.
 */
export interface TrailEntry {
  id: string;
  at: number;
  stage: TrailStage;
  target: TrailTarget;
  text: string;
  parentId: string | null;
  /** critique only: the prompt Claude proposed. */
  prompt?: string;
  kind?: RevisionKind;
  mode?: string;
  model?: string;
  /** critique only: whether its prompt was applied. */
  applied?: boolean;
  /** The thread this came out of, when it came out of one. */
  threadId?: string;
}

interface Doc {
  pages: StudioPage[];
  nodes: StudioNode[];
  groups: StudioGroup[];
  shapes: StudioShape[];
  /** Closed lines that are placeholders, construct boxes or black holes. See `space.ts`. */
  spaces: Space[];
  format: FormatValues;
  brief: StudioBrief;
  /** Colour roles and the texture stack. */
  look: Look;
  /** Keyframe sets waiting to be interpolated. See `motion.ts`. */
  motion: MotionAsset[];
}

/**
 * Height of the frame: at least a screen, and always past the lowest thing
 * on the page — whatever kind of thing that is.
 *
 * It counted parts and nothing else, and that is a clip with a person's
 * name on it. The window the page stands in is sized from this, so a
 * stroke of ink, an arrow, or a drawn space below the last part is drawn
 * inside a window that does not know it is there: the window's
 * `scrollHeight` runs past its `clientHeight` and the difference is
 * unreachable by any gesture. Measured with one pen stroke a hundred
 * pixels under a stock page: 138px of it hidden, and no bar, no wheel and
 * no drag could bring it back.
 *
 * It is the first thing a person does — pick up the pencil and draw on the
 * ground below the page — so it is the first thing that has to be counted.
 * Anything the page renders is passed here; `reach` is what each kind
 * reaches down to.
 */
export function frameHeight(
  nodes: StudioNode[],
  min = 900,
  also: { shapes?: StudioShape[]; spaces?: Space[] } = {},
): number {
  /*
   * A PART'S FOOT IS THE FOOT OF THE PAGE. INK BELOW IT IS NOT.
   *
   * This used to add 160px under whatever was lowest, of any kind, which
   * meant the end of the page was always a margin past the last thing on it
   * — so putting a part near the bottom moved the bottom, and putting it at
   * the new bottom moved it again. Measured: a part dropped at the foot of an
   * 837px page came to rest at y 838 and the page went to 1054. There was
   * nothing to snap to because the end of the page ran away from whatever was
   * put near it.
   *
   * So a part sets the page's foot exactly, and the page settles. Ink, arrows
   * and drawn spaces keep their margin, because those are drawn on the ground
   * below the page rather than placed on it, and the window they live in has
   * to know they are there or the last of them is unreachable.
   */
  const placed = nodes.reduce((m, n) => Math.max(m, n.y + n.h), 0);
  let scratch = 0;
  for (const sh of also.shapes ?? []) {
    for (const [, y] of sh.points) scratch = Math.max(scratch, y);
  }
  for (const sp of also.spaces ?? []) {
    for (const [, y] of sp.boundary) scratch = Math.max(scratch, y);
  }
  return Math.max(min, placed, scratch ? scratch + 160 : 0);
}

/**
 * How far the highest thing on the page reaches ABOVE its origin.
 *
 * Zero almost always, because y=0 is the site's top and that is where
 * things are put. It is not zero when somebody draws above the page, which
 * is an ordinary thing to do on a surface whose space outside the frame is
 * scratch — and the page must not grow to meet it, because moving the
 * origin would renumber every coordinate in the document. The *board*
 * grows instead: this is how much room it needs above the page, so what is
 * drawn up there is on the surface rather than off the top of it.
 *
 * Parts are not counted. A part above the origin is a part with a negative
 * position in the site's own coordinates, which is a different problem and
 * not one a drawing surface should paper over. Ink and drawn spaces are
 * scratch by nature and are.
 */
export function frameTopReach(
  also: { shapes?: StudioShape[]; spaces?: Space[] } = {},
  margin = 24,
): number {
  let top = 0;
  for (const sh of also.shapes ?? []) {
    for (const [, y] of sh.points) top = Math.min(top, y);
  }
  for (const sp of also.spaces ?? []) {
    for (const [, y] of sp.boundary) top = Math.min(top, y);
  }
  return top < 0 ? Math.round(-top) + margin : 0;
}

/** Page widths the frame can take. Positions are absolute; the frame just shows what fits. */
export const FRAME_WIDTHS = { desktop: 1440, tablet: 834, phone: 390 } as const;

interface StudioState extends Doc {
  /** Width of the page frame drawn on the board. */
  frameWidth: number;
  /** Bumped to ask the board to fit the frame into view. */
  fitNonce: number;
  activePageId: string;
  selection: string[];
  tool: Tool;
  inkHue: number;
  inkWidth: number;
  /**
   * WHAT HE IS DRAWING, chosen BEFORE he draws it.
   *
   * His words: "when i click the color i can adjust it and beside it the
   * buttons become preselect options for 'button' 'surface' 'icon' or
   * whatever options i can draw". The saying-what-it-is moves earlier; it
   * does not disappear, which is what `part` is for — the one that still
   * works it out from the drawing, the way everything did before this.
   *
   * Every one of these is wired to something real. A chip that fell through
   * to the model would be a preselect that does not preselect, which is the
   * same disease as a dead control.
   */
  drawKind: DrawKind;
  /**
   * WHICH REPOSITORY THIS SITE POINTS AT, as `owner/name`.
   *
   * His words: "how do i create a new repo from the site, it should be
   * apparent to connect repo, this should be what the github icon does".
   * Connecting was supported on the wire the whole time — `publish` takes a
   * repo from the browser and the server decides whether it may go there —
   * and nothing on screen let him name one, so the choice had nowhere to
   * live. Here it is. Null means the server's own `GITHUB_REPO`, which is
   * what every publish used before there was a choice.
   */
  siteRepo: string | null;
  zoom: number;
  pan: { x: number; y: number };
  /**
   * How far the *site* is scrolled inside its frame.
   *
   * The frame is one screen of the website now, not the whole of it: the page
   * scrolls inside it the way it will in a browser, so what you are looking
   * at is what a visitor sees, at the size they see it. The board's own pan
   * moves the frame about the workspace; this moves the page behind the
   * frame's edge. Never persisted — where you had scrolled to is not part of
   * the site.
   */
  showAllFormat: boolean;
  /** Wires between parts can be hidden so the board reads as the page. */
  showWires: boolean;
  /** Parts removed from the library. Nothing is deleted; they can come back. */
  hiddenFeatures: string[];
  /** The repositories brought onto this board, and the shelf categories they own. */
  brought: BroughtRepo[];
  /** Their elements: presets of real parts, droppable like anything else in the shelf. */
  broughtParts: BroughtPart[];
  /**
   * Keep what a repository's page was made of, as a category of its own.
   *
   * Bringing the same repository in again replaces what it left rather
   * than piling a second copy beside it, so reading a site twice gives one
   * category and not two.
   */
  bringIn: (repo: BroughtRepo, parts: BroughtPart[]) => void;
  /** Let a repository go: its category and its elements leave the shelf. Parts already on the board stay. */
  sendBack: (repoId: string) => void;
  /** Design surface, or the live site in the same place on screen. */
  mode: BoardMode;
  /**
   * The part menu's outer edge: cut to a square, or swept round like its
   * inner edge. A draft toggle sits on the menu itself so the two can be
   * compared live.
   */
  menuShape: "square" | "round";
  /**
   * Placing the page's lamp by hand: the board dims everywhere but the page,
   * the pointer becomes the light, and the next press puts it down.
   *
   * A moment, not a setting, so it is not written down and does not come back
   * with the site. `placedLight` is what the lamp was before the moment
   * started, so a press outside the page can put it back.
   */
  placingLight: boolean;
  placedLight: Light | null;
  /** Where the light is while it is being carried out of the menu, or nothing. */
  lightCarry: { x: number; y: number } | null;
  /**
   * How far the part menu is turned, in turns (0..1).
   *
   * The menu used to face the middle of the screen, which meant it was a
   * different shape every time you opened it and your hand never learned
   * where anything was. It is locked now — Delete is always bottom-left,
   * Looks always bottom-right — and this is the one way it moves: hold the
   * right button and drag to turn the whole wheel to wherever suits you. It
   * is remembered, because a menu you rearranged once should stay that way.
   */
  menuSpin: number;
  /**
   * The colours picked off a spectrum lately, newest first.
   *
   * The aura's chips offer them, so a colour chosen for one part's background
   * is one press away for another part's glow. Kept short: past a dozen it is
   * a palette nobody chose.
   */
  recentColours: string[];
  /** The phone/tablet companion: which device, where it sits, whether it is open.
   * Closed to start: it floats over the board, and a panel that covers a resize
   * handle you cannot see is worse than one click to open it. */
  companion: { device: "phone" | "tablet"; x: number; y: number; open: boolean };
  /** Every prompt as written, critiqued and revised. Not part of undo: it is the record of the document, not the document. */
  trail: TrailEntry[];
  /**
   * Every prompt that reached Claude and landed, as a tree. A thread is an
   * iteration, not an update: it holds what was asked, what came back, what
   * it put on the board, and the board as it stood when it landed.
   */
  threads: Thread[];
  /** The thread the board is standing on. */
  liveThreadId: string | null;
  /**
   * Threads pinned to stay in view in the iteration book.
   *
   * A thread scrolls away the moment the trail grows past it, and the one
   * you are working against is the one you need on screen while you ask the
   * next thing. Pinned, it and its answer sit at the top of the book until
   * they are unpinned.
   */
  pinnedThreads: string[];
  /** The book is held open beside the board as a panel, rather than being a dialog you dismiss. */
  bookPinned: boolean;
  /**
   * The iteration open in the timeline's section below it.
   *
   * Not the live thread: standing on a thread puts the board back to it,
   * and reading one is not standing on it. One at a time, on purpose —
   * everything at once is the wall the timeline replaced.
   */
  openThreadId: string | null;
  /** The iteration being worked in: the flag, kept across reloads. */
  currentThreadId: string | null;
  /**
   * Drawings waiting to be made real, and the ones that have been.
   *
   * Not persisted: a job in flight when the tab closed was never going to
   * finish, and a queue that comes back full of jobs nobody is running is
   * worse than an empty one.
   */
  queue: DrawJob[];
  /**
   * Where a thread or a piece has been dragged to on the trail, when it has
   * been. Anything not in here sits where the staircase puts it.
   */
  threadSpots: Record<string, { x: number; y: number }>;
  /**
   * The pieces vined to the next call: what will be sent with it, beside the
   * brief. Empty means the whole blueprint goes, the way it always did.
   */
  draftPieces: string[];
  /**
   * What has already gone up this thread, piece by piece, as the fingerprint
   * it had when it went. A piece whose fingerprint has not moved is not
   * resent: the model has it from the turn before.
   */
  sentPieces: Record<string, string>;
  past: Doc[];
  future: Doc[];

  /* nodes */
  addNode: (featureId: string, x: number, y: number, patch?: Partial<StudioNode>) => string;
  updateNode: (id: string, patch: Partial<StudioNode>) => void;
  updateNodes: (ids: string[], patch: Partial<StudioNode>) => void;
  /** Parts draw in list order, so later is on top: one place along is one step forward or back. */
  raiseNode: (id: string, toTop?: boolean) => void;
  lowerNode: (id: string, toBottom?: boolean) => void;
  removeNodes: (ids: string[]) => void;
  duplicateNodes: (ids: string[]) => void;

  /**
   * Give a drawn part the behaviour its shape asks for.
   *
   * The clip is already on it and is not touched. This is the second half:
   * a ring adopts what falls inside it, a list is given one row per stroke,
   * a connector becomes a chain between the two parts at its ends and stops
   * being a part at all, and a surface is marked as one so the blueprint
   * and Build know it holds what is placed on it.
   */
  applyDrawnKind: (nodeId: string, role: DrawnRole, said?: string) => { kind: DrawnKind; did: string };
  /**
   * Change one face of a cube: its words, its colour, or clear it.
   *
   * Editable means editable after it exists. Everything a face is lives on
   * the node, so this is the whole of it: no re-run, no model, and the
   * board, the live page and the published site all change together.
   */
  setCubeFace: (nodeId: string, index: number, patch: Partial<CubeFace> | null) => void;
  /** Where a cube is left standing, so the board draws the angle it was turned to. */
  setCubeTurn: (nodeId: string, turn: { x: number; y: number }) => void;
  /**
   * The face of a cube the person is pointing at, or none.
   *
   * A face is picked the way a part is: pressed on the board, or named in
   * the panel, and then the panel and the wheel edit that face's words.
   * It is transient, exactly as the selection is, and lets go when the
   * selection moves off the cube.
   */
  pickedFace: { nodeId: string; side: CubeSide } | null;
  pickFace: (nodeId: string, side: CubeSide | null) => void;
  /**
   * The one part that has been OPENED, or none.
   *
   * HIS WORDS: "also once i selected something i have to click off and then
   * clicck and hold to drag."
   *
   * Two parts on the board are handled rather than looked at — the cube and
   * the mesh — and they used to take the pointer the moment they were
   * selected, so the press that would have moved them turned them instead.
   * Selecting a part is now only selecting it: it drags like every other
   * part on the board. Taking hold of one is a second, deliberate press, and
   * this is the part that press opened. Transient like the selection, and
   * let go of the moment the selection moves off it.
   */
  handling: string | null;
  hold: (nodeId: string | null) => void;
  /** …and the same for a solid, which is turned the same way. */
  setMeshTurn: (nodeId: string, turn: { x: number; y: number }) => void;

  /* groups */
  groupSelection: (label?: string) => void;
  ungroup: (groupId: string) => void;
  updateGroup: (id: string, patch: Partial<StudioGroup>) => void;

  /* shapes */
  addShape: (shape: Omit<StudioShape, "id">) => string;
  updateShape: (id: string, patch: Partial<StudioShape>) => void;
  /** Marking a wire as a data link fills the target part's data box. */
  setShapeRelation: (id: string, relation: ShapeRelation) => void;
  removeShapes: (ids: string[]) => void;

  /* spaces */
  /** A closed line becomes a space, and starts consuming its area at once. Returns its id. */
  addSpace: (space: Omit<Space, "id" | "at" | "since"> & Partial<Pick<Space, "since">>) => string;
  /**
   * A repository somebody asked for from the GitHub control, and the surface
   * it is to land on.
   *
   * The importer lives on a space's own panel, so the only way to reach it
   * was to draw a space first. This is how the control on the top bar hands
   * one over: it makes the surface, names the repository, and the panel that
   * opens on that surface picks it up and starts. Not persisted \u2014 it is a
   * handover, not a setting, and a reload should not re-import anything.
   */
  /**
   * Everything the Draw panel has made, newest first.
   *
   * HIS WORDS: "stepping out of the tab resets the tab completely while below
   * i would want my previous works to continue as well as the option for a
   * new image", and "tweakable iterations and save each iteration". So the
   * panel keeps nothing of its own \u2014 the work lives here, is persisted, and
   * the panel is a view of it. Leaving the tab and coming back shows what was
   * there.
   */
  draws: {
    id: string;
    /** Exactly what he typed. Nothing is added to it. */
    prompt: string;
    model: string;
    ratio?: string;
    quality?: string;
    effort?: string;
    format?: string;
    /** The picture it was drawn from, when there was one. */
    reference?: string;
    image: string;
    cost: number | null;
    at: number;
  }[];
  addDraw: (d: Omit<StudioState["draws"][number], "id" | "at">) => void;
  removeDraw: (id: string) => void;
  bringRepo: { space: string; repo: string } | null;
  setBringRepo: (v: { space: string; repo: string } | null) => void;
  /**
   * Make the surface: lock every element in it where it was drawn, and set
   * it forming. The layout is the specification, so this is where it stops
   * being a set of coordinates and becomes a proportion.
   */
  lockSpace: (id: string, placed: readonly Placed[]) => Locked[];
  /** How far a surface has formed, on the timeline's own driver. */
  formSpace: (id: string, p: number) => void;
  /** Move or resize a surface: its boundary and everything locked in it go together. */
  resizeSpace: (id: string, box: { x: number; y: number; w: number; h: number }) => void;
  updateSpace: (id: string, patch: Partial<Space>) => void;
  removeSpaces: (ids: string[]) => void;
  /** The model and step order for one part, or null to let the route decide. */
  setPlan: (nodeId: string, plan: Plan | null) => void;

  /* pages */
  addPage: (name?: string) => string;
  removePage: (id: string) => void;
  updatePage: (id: string, patch: Partial<StudioPage>) => void;
  setActivePage: (id: string) => void;
  movePage: (id: string, delta: number) => void;

  /* selection + view */
  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  /** The page's background: picked like a part, cut, and put back. */
  selectBackground: () => void;
  cutBackground: () => boolean;
  pasteBackground: () => boolean;
  /** Cut takes what is selected — parts or the background — and paste puts back whatever was cut last. */
  cutNodes: (ids: string[]) => boolean;
  pasteNodes: () => boolean;
  cut: () => boolean;
  paste: () => boolean;
  setTool: (t: Tool) => void;
  setInk: (patch: { hue?: number; width?: number }) => void;
  setDrawKind: (kind: DrawKind) => void;
  setSiteRepo: (repo: string | null) => void;
  setZoom: (z: number) => void;
  /** Set by the board's fit only: floored at `FIT_MIN`, not `ZOOM_MIN`. */
  setFitZoom: (z: number) => void;
  /** What the board's fit last asked for. The zoom keys never go above it. */
  fitAt: number;
  setPan: (p: { x: number; y: number }) => void;
  setFrameWidth: (w: number) => void;
  requestFit: () => void;
  /** Absolute positions during a drag; no history entry (commit() first). */
  setPositions: (positions: Record<string, { x: number; y: number }>) => void;

  /* document */
  setFormat: (id: string, value: string | number | boolean) => void;
  resetFormat: () => void;
  setShowAllFormat: (v: boolean) => void;
  setShowWires: (v: boolean) => void;
  setMode: (m: BoardMode) => void;
  setMenuShape: (v: "square" | "round") => void;
  /** Start placing the lamp, or stop: `true` remembers the lamp to fall back to. */
  setPlacingLight: (v: boolean) => void;
  /** Give up on placing it and put the lamp back where it was. */
  cancelPlacingLight: () => void;
  /** The light, mid-air between the menu and the page. */
  setLightCarry: (at: { x: number; y: number } | null) => void;
  setMenuSpin: (turns: number) => void;
  rememberColour: (colour: string) => void;
  setCompanion: (patch: Partial<StudioState["companion"]>) => void;
  hideFeature: (id: string) => void;
  restoreFeature: (id: string) => void;
  restoreAllFeatures: () => void;
  setBrief: (patch: Partial<StudioBrief>) => void;
  setLook: (patch: Partial<Look>) => void;
  addMotion: () => string;
  updateMotion: (id: string, patch: Partial<MotionAsset>) => void;
  removeMotion: (id: string) => void;
  setMotionFrame: (id: string, at: number, src: string | null) => void;
  moveMotionFrame: (id: string, at: number, delta: number) => void;
  addTexture: (layer: TextureLayer) => void;
  updateTexture: (id: string, patch: Partial<TextureLayer>) => void;
  removeTexture: (id: string) => void;
  moveTexture: (id: string, delta: number) => void;
  mergeTexture: (id: string, src: string) => void;
  clearPage: (pageId: string) => void;
  /** Keep what Claude found, each finding beside the prompt it was about. */
  recordAsk: (input: { mode: string; model?: string; revisions: Revision[] }) => void;
  /** An API call came back: hang a thread off the live one and stand on it. */
  landThread: (input: { mode: string; model?: string; ask: string; answer: string; changes?: string[]; sketch?: { strokes: [number, number][][]; words: string }; state?: "running" | "done" | "cut"; madeId?: string; id?: string }) => string;
  /** Say which part an iteration made, once it is known. */
  noteMade: (threadId: string, madeId: string) => void;
  /** How the process behind one iteration ended: still going, done, or given up on. */
  markThread: (id: string, state: "running" | "done" | "cut") => void;
  /**
   * The iteration being worked in.
   *
   * Distinct from the live one, which is whatever landed last, and from the
   * open one, which is whatever is being read below. This is the one the
   * person has put their flag in: the section follows it, the next ask
   * hangs off it, and it survives a reload, because "where was I" is the
   * question a timeline exists to answer.
   */
  setCurrentThread: (id: string | null) => void;
  /** Cut one thread; its children re-hang from its parent and the board goes to whatever is live after. */
  pruneThread: (id: string) => void;
  /** Put the board back on a thread. */
  standOn: (id: string) => void;
  /** Keep a thread and its answer in view at the top of the book, or let it go. */
  togglePinnedThread: (id: string) => void;
  /** Hold the book open as a panel beside the board, or let it be a dialog again. */
  setBookPinned: (v: boolean) => void;
  /** Open one iteration in the section under the timeline, or close it. */
  openThread: (id: string | null) => void;
  /** Put a drawing on the make-real queue. The board closes; the queue works. */
  enqueueDraw: (job: Omit<DrawJob, "id" | "status" | "queued">) => string;
  /** How a job is getting on. */
  updateJob: (id: string, patch: Partial<DrawJob>) => void;
  /** The person's answer to the one question a job asked; the job goes back on the queue with it. */
  answerJob: (id: string, answer: string) => void;
  /** Forget the jobs that are over. */
  clearFinishedJobs: () => void;
  /**
   * Add to what the live thread did.
   *
   * A thread lands with what Claude changed, but the work an answer leads to
   * — the files pushed, the site built on Vercel — happens after it. That is
   * still what this iteration did, so it is written on the same card.
   */
  /** Lines onto an iteration's card. `on` when the answer may outlive the live one. */
  noteThread: (lines: string[], on?: string) => void;
  /**
   * Add to what this iteration spent at the renderer.
   *
   * Token counts are an estimate of a bill; a renderer call is the bill. It
   * accumulates, because one drawing can reach the renderer more than once.
   */
  /**
   * Add what a call cost, how long it took and who was paid.
   *
   * Every paid call goes through here — Claude per token and the renderer
   * per press — so an iteration carries one honest bill rather than a
   * number the bench knew and nobody else did.
   */
  /** What a call cost, onto an iteration. `on` when the answer may outlive the live one. */
  noteSpend: (spend: Spend, on?: string) => void;
  /** One pass's own line on the bill: what ran, how long, what it cost. */
  notePass: (line: string, on?: string) => void;
  /** The real progress of the work behind an iteration, 0..1. Only ever climbs. */
  noteProgress: (threadId: string | null | undefined, p: number | null) => void;
  /** Move one thread or piece on the trail. Only that one moves. */
  moveThread: (id: string, x: number, y: number) => void;
  /** Vine a piece to the next call, or cut it loose. */
  toggleDraftPiece: (id: string) => void;
  /** Nothing is vined to the next call. */
  clearDraft: () => void;
  /** These strokes are one drawing, whatever the guess says. */
  joinInk: (ids: string[]) => void;
  /** These strokes are each their own drawing again. */
  splitInk: (ids: string[]) => void;
  /** After a call: what went, and what it cost. */
  recordSent: (threadId: string, sent: Record<string, string>, usage: { sent: number; skipped: number; cached?: number; input?: number }) => void;
  /** Put the trail back on its staircase. */
  resetThreadSpots: () => void;
  /** Take a critique's proposed prompt as the prompt, and note that it was taken. */
  applyRevision: (entryId: string) => void;
  resetAll: () => void;
  loadDoc: (doc: Partial<Doc> & { frameWidth?: number }) => void;
  undo: () => void;
  redo: () => void;
  commit: () => void;
}

const HISTORY_LIMIT = 60;
/** Writes to the same field closer together than this are one edit, and one undo. */
export const EDIT_RUN_MS = 1500;
/** The fields a person types into on a part. A write to only these is an edit; anything else is a step of its own. */
const TYPED_FIELDS = new Set(["prompt", "content", "data", "label"]);

/**
 * An updated thread forms again.
 *
 * Only a finished one: a thread still being worked on is already forming
 * and its updates are its progress. Once it has landed, any change to it —
 * a pass, a cost, a line — bumps the generation and the box plays its
 * formation from nothing to where it stands. See `formation.ts`.
 */
function reformed(t: { state?: string; form?: { p: number; gen: number } }): { p: number; gen: number } {
  const had = t.form ?? { p: 1, gen: 0 };
  if ((t.state ?? "done") === "running") return had;
  return { p: 1, gen: had.gen + 1 };
}
export const HUES = [265, 200, 160, 30, 340, 90, 240, 15];

/* The kinds a drawing can be declared as: `drawKinds.ts`, which has no
   imports so a check can read it without the app's aliases. */
export { DRAW_KINDS, type DrawKind } from "./drawKinds";

/**
 * Where a new part may land: inside the page, always.
 *
 * Every way a part comes into being funnels through `addNode`, and none of
 * them used to check this — a part added near an edge simply kept the
 * coordinate it was handed and sat half off the page. Dragging one out
 * afterwards is still allowed, because that is someone saying where they
 * want it; arriving outside is nobody saying anything.
 *
 * A part wider than the page lines up with its left edge rather than being
 * centred, because centring something too big hangs it off both sides at
 * once.
 */
export function placeInFrame(x: number, y: number, w: number, frameWidth: number): { x: number; y: number } {
  // To a hundredth of a pixel: a part laid at a share of a page keeps the
  // share it was laid at, and a hundredth is nothing the board can show.
  const fine = (v: number) => Math.round(v * 100) / 100;
  return {
    x: fine(w >= frameWidth ? 0 : Math.min(Math.max(0, x), frameWidth - w)),
    y: fine(Math.max(0, y)),
  };
}

const TRAIL_LIMIT = 400;

/** Which prompt a revision is about, from the name the brief printed for it. */
function resolveTarget(s: Pick<StudioState, "brief" | "pages" | "nodes" | "groups">, target: string): TrailTarget {
  const t = target.trim();
  const low = t.toLowerCase();
  if (!t || low === "site" || low === "the site" || low === "master" || low === "the idea") return { kind: "site", id: "site", label: s.brief.name.trim() || "The site" };
  const pm = /^page\s*[:—–-]\s*(.+)$/i.exec(t);
  if (pm) {
    const want = pm[1]!.trim().toLowerCase();
    const page = s.pages.find((p) => p.name.trim().toLowerCase() === want || p.path.toLowerCase() === want);
    if (page) return { kind: "page", id: page.id, label: page.name };
  }
  const exact = (label: string) => label.trim().toLowerCase() === low;
  const node = s.nodes.find((n) => exact(n.label)) ?? s.nodes.find((n) => n.label.trim().length > 2 && low.includes(n.label.trim().toLowerCase()));
  if (node) return { kind: "node", id: node.id, label: node.label };
  const group = s.groups.find((g) => exact(g.label));
  if (group) return { kind: "group", id: group.id, label: group.label };
  const page = s.pages.find((p) => exact(p.name));
  if (page) return { kind: "page", id: page.id, label: page.name };
  return { kind: "loose", id: `loose:${low}`, label: t };
}

/** The prompt that target carries right now. */
function promptOf(s: Pick<StudioState, "brief" | "pages" | "nodes" | "groups">, t: TrailTarget): string {
  switch (t.kind) {
    case "site": return s.brief.master.trim();
    case "page": return s.pages.find((p) => p.id === t.id)?.prompt.trim() ?? "";
    case "node": return s.nodes.find((n) => n.id === t.id)?.prompt.trim() ?? "";
    case "group": return s.groups.find((g) => g.id === t.id)?.prompt.trim() ?? "";
    default: return "";
  }
}

/**
 * The document out of a thread, and nothing else.
 *
 * A thread's `doc` is a snapshot, but one that has been through
 * localStorage — a published document carries keys a snapshot does not
 * (`companion`, `activePageId`, `hiddenFeatures`) — and spreading whatever
 * it happens to hold straight into the state sets fields nobody meant to
 * set. `companion: null` arriving that way took the pinned preview down
 * with it. Only the document's own eight fields are applied, the way
 * `loadDoc` applies them.
 */
function docPatch(doc: ThreadDoc | undefined): Partial<StudioState> {
  if (!doc) return {};
  const d = doc as Partial<Doc>;
  const patch: Partial<StudioState> = {};
  if (Array.isArray(d.pages) && d.pages.length) patch.pages = d.pages;
  if (Array.isArray(d.nodes)) patch.nodes = d.nodes;
  if (Array.isArray(d.groups)) patch.groups = d.groups;
  if (Array.isArray(d.shapes)) patch.shapes = d.shapes;
  if (Array.isArray(d.spaces)) patch.spaces = d.spaces;
  if (d.format) patch.format = { ...formatDefaults(), ...d.format };
  if (d.brief) patch.brief = d.brief;
  if (d.look) patch.look = { ...emptyLook(), ...d.look };
  if (Array.isArray(d.motion)) patch.motion = d.motion;
  if (patch.pages && !patch.pages.some((p) => p.id === undefined)) {
    // Standing on a thread whose pages no longer include the open one.
    patch.activePageId = patch.pages[0]!.id;
  }
  return patch;
}

/**
 * What a part inherits from the open space it is landing in, if it is.
 *
 * The space's plan and, when the part has nothing to say for itself, the
 * space's prompt. Nothing when it lands on bare page, which is every part
 * placed before any of this existed.
 */
function inherit(
  s: { spaces: Space[]; activePageId: string },
  at: { x: number; y: number },
  w: number,
  h: number,
  patch?: Partial<StudioNode>,
): Partial<StudioNode> {
  if (!s.spaces.length) return {};
  const space = spaceOf(s.spaces, { ...at, w, h, pageId: patch?.pageId ?? s.activePageId }, Date.now());
  const had = inheritedFrom(space);
  return {
    ...(had.plan && !patch?.plan ? { plan: had.plan } : {}),
    ...(had.prompt && !patch?.prompt?.trim() ? { prompt: had.prompt } : {}),
  };
}

function snapshot(s: StudioState): Doc {
  return {
    pages: s.pages,
    nodes: s.nodes,
    groups: s.groups,
    shapes: s.shapes,
    spaces: s.spaces,
    format: s.format,
    brief: s.brief,
    look: s.look,
    motion: s.motion,
  };
}

function firstPage(): StudioPage {
  return { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
}

function starterDoc(): Doc {
  return {
    pages: [firstPage()],
    nodes: [],
    groups: [],
    shapes: [],
    spaces: [],
    format: formatDefaults(),
    brief: { name: "", gimmick: "", master: "" },
    look: emptyLook(),
    motion: [],
  };
}

/** Storage moved from the old name; carry a saved document across once. */
function migrateKey(from: string, to: string) {
  if (typeof localStorage === "undefined") return;
  try {
    if (!localStorage.getItem(to) && localStorage.getItem(from)) {
      localStorage.setItem(to, localStorage.getItem(from)!);
    }
  } catch {
    /* private mode */
  }
}

/*
 * Whether the saved document has been read yet. Until it has, the store is
 * holding nothing but its defaults and must not write them out — see the
 * note on `storage` below.
 */
let studioRead = false;

/**
 * Hand the catalogue what the connected repositories brought.
 *
 * The document is the truth and the catalogue is the reader, so this runs
 * on every change and on hydration, and nothing anywhere keeps a second
 * copy. A brought part is a preset — `basedOn` names the real library part
 * that draws it — so the shelf, the wheel, the search box and "add here"
 * all work on it without knowing where it came from.
 */
function shelve(repos: BroughtRepo[], parts: BroughtPart[]): void {
  setBrought(
    repos.map((r) => ({ id: r.id, label: r.label, icon: Boxes, blurb: `Brought in from ${r.from}.`, hue: r.hue })),
    parts.map((p) => ({
      id: p.id,
      name: p.label,
      category: p.categoryId,
      icon: Boxes,
      blurb: p.blurb,
      w: p.w,
      h: p.h,
      basedOn: p.basedOn,
      from: repos.find((r) => r.id === p.categoryId)?.from,
      tags: ["repo", "imported"],
      preset: { content: p.content, options: p.options, colour: p.colour, font: p.font, prompt: p.prompt, label: p.label },
    })),
  );
}

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => {
      /** Push the pre-mutation document onto the undo stack. */
      /**
       * The first thing anyone does makes iteration one.
       *
       * Nothing seeded the timeline. Threads were landed by an ask coming
       * back and by a drawing being made real, and nothing else, so a
       * person who had spent an hour laying out a board opened the
       * timeline and found it empty — which reads as broken rather than as
       * "nothing has happened yet", because plenty had.
       *
       * The honest fix is not to invent history. It is to mark the
       * beginning: the first real change to the document lands one
       * iteration holding the board as it was before that change, so there
       * is a place to stand and something to hang the next one off. Every
       * iteration after it is what it always was, an ask or a drawing.
       *
       * It hangs off `push`, which is the undo checkpoint every genuine
       * mutation already takes, so "a real action" needs no second
       * definition and no action has to remember to do this.
       */
      const seed = () => {
        const s = get();
        if (s.threads.length) return;
        const parts = s.nodes.length;
        const pages = s.pages.length;
        set((st) => ({
          threads: [{
            id: uid("th"),
            parentId: null,
            at: Date.now(),
            mode: "start",
            ask: "",
            answer: parts
              ? `${parts} part${parts === 1 ? "" : "s"} on ${pages} page${pages === 1 ? "" : "s"}, before the first change`
              : "an empty site",
            /* A green card *is* the site now — the preview as that update left
               it — so the line under it says where the site was, not what the
               board was called. It used to read "the board as you started it"
               beside a silhouette of grey rectangles. */
            changes: ["the site before the first change"],
            doc: snapshot(st) as ThreadDoc,
            state: "done" as const,
            pieces: [],
          }, ...st.threads],
          liveThreadId: st.liveThreadId,
        }));
      };

      const push = () => {
        seed();
        run = null;
        set((s) => ({ past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT), future: [] }));
      };
      /*
       * One undo takes back an edit, not a letter.
       *
       * Typing writes the document a keystroke at a time, and each write
       * used to push its own undo entry, so taking back a word was eleven
       * presses. A run of writes to the same field within `EDIT_RUN_MS` of
       * each other is one edit: the first write pushes, the rest ride on
       * it, and anything else that pushes (a move, a different field, an
       * undo) ends the run. The snapshot kept is the one from before the
       * first letter, which is what "before this edit" means.
       */
      let run: { key: string; at: number } | null = null;
      const pushEdit = (key: string) => {
        const now = Date.now();
        if (run && run.key === key && now - run.at < EDIT_RUN_MS) { run.at = now; return; }
        push();
        run = { key, at: now };
      };

      return {
        ...starterDoc(),
        frameWidth: FRAME_WIDTHS.desktop,
        menuShape: "square",
        placingLight: false,
        placedLight: null,
        lightCarry: null,
        menuSpin: 0,
        recentColours: [],
        fitNonce: 0,
        activePageId: "page_home",
        selection: [],
        pickedFace: null,
        handling: null,
        tool: "select",
        inkHue: 265,
        inkWidth: 3,
        drawKind: "part",
        siteRepo: null,
        zoom: 1,
        fitAt: ZOOM_MIN,
        pan: { x: 0, y: 0 },
        showAllFormat: false,
        showWires: true,
        hiddenFeatures: [],
        brought: [],
        broughtParts: [],
        mode: "design",
        companion: { device: "phone", x: -18, y: -18, open: false },
        trail: [],
        threads: [],
        liveThreadId: null,
        pinnedThreads: [],
        bookPinned: false,
        openThreadId: null,
        currentThreadId: null,
        queue: [],
        threadSpots: {},
        draftPieces: [],
        sentPieces: {},
        past: [],
        future: [],

        /**
         * Every way a part comes into being goes through here — the library,
         * the add disc, paste, the drawing board, "drop an idea here" — so
         * this is the one place that has to keep a new part inside the page.
         *
         * It did not, and nothing else did either: the coordinates were
         * rounded and stored as given, so a part added near an edge sat half
         * off the page and every later path inherited the same habit. A part
         * may still be *dragged* out afterwards, because dragging is someone
         * saying where they want it; arriving outside the page is nobody
         * saying anything.
         */
        addNode: (featureId, x, y, patch) => {
          const feature = getFeature(featureId);
          /*
           * A part brought in from a repository is a preset of a real one:
           * it names the part that draws in `basedOn` and carries what was
           * measured off the page in `preset`. Unfolded here, once, so
           * every door into the board — the shelf, the wheel, search,
           * "add here" — puts down an ordinary node and nothing else in
           * the app had to learn what a brought part is.
           */
          const real = feature?.basedOn ?? featureId;
          const pre = feature?.preset;
          if (pre) {
            patch = {
              label: pre.label ?? feature?.name,
              content: pre.content ?? "",
              options: pre.options ?? {},
              prompt: pre.prompt ?? "",
              ...(pre.colour ? { colour: pre.colour as StudioNode["colour"] } : {}),
              ...(pre.font ? { font: pre.font as StudioNode["font"] } : {}),
              ...patch,
            };
          }
          featureId = real;
          const id = uid("n");
          push();
          set((s) => {
            const w = patch?.w ?? feature?.w ?? 132;
            const h = patch?.h ?? feature?.h ?? 76;
            const home = placeInFrame(x, y, w, s.frameWidth);
            return ({
            nodes: [
              ...s.nodes,
              {
                id,
                pageId: s.activePageId,
                featureId,
                label: feature?.name ?? "Element",
                prompt: "",
                content: "",
                data: "",
                colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth",
                shape: null, outline: null, kind: null, cube: null, mesh: null, vector: null, role: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null,
                w,
                h,
                groupId: null,
                options: {},
                priority: "must",
                custom: featureId === "custom-idea",
                glyph: null,
                hue: null,
                locked: false,
                link: null,
                ...patch,
                // A patch may carry its own size, but never a place outside
                // the page: the clamp above is computed from the final size.
                ...(patch?.x != null || patch?.y != null
                  ? placeInFrame(patch.x ?? home.x, patch.y ?? home.y, w, s.frameWidth)
                  : home),
                /*
                 * A part that lands inside an open black hole is made the
                 * way that space is made.
                 *
                 * Decided here rather than at each door, and by geometry
                 * rather than by a pointer, so it holds however the part
                 * arrived: a drawing made real inside the space, a part
                 * dropped from the shelf, a paste. A person who has steered
                 * a space should not have to say the same thing again for
                 * every element they put in it. Anything the part carries
                 * of its own wins, because it is the more particular.
                 */
                ...inherit(s, patch?.x != null || patch?.y != null
                  ? placeInFrame(patch.x ?? home.x, patch.y ?? home.y, w, s.frameWidth)
                  : home, w, h, patch),
              },
            ],
            selection: [id],
          });
          });
          return id;
        },

        updateNode: (id, patch) => {
          // Words typed into a part's own fields are one edit per run of
          // typing; anything else is its own step, as it always was.
          const keys = Object.keys(patch);
          if (keys.length && keys.every((k) => TYPED_FIELDS.has(k))) pushEdit(`node:${id}:${keys.join(",")}`);
          else push();
          set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
        },

        updateNodes: (ids, patch) => {
          push();
          const set_ = new Set(ids);
          set((s) => ({ nodes: s.nodes.map((n) => (set_.has(n.id) ? { ...n, ...patch } : n)) }));
        },

        raiseNode: (id, toTop) => {
          push();
          set((s) => {
            const i = s.nodes.findIndex((n) => n.id === id);
            if (i < 0 || i === s.nodes.length - 1) return {};
            const nodes = [...s.nodes];
            const [n] = nodes.splice(i, 1);
            nodes.splice(toTop ? nodes.length : i + 1, 0, n!);
            return { nodes };
          });
        },
        lowerNode: (id, toBottom) => {
          push();
          set((s) => {
            const i = s.nodes.findIndex((n) => n.id === id);
            if (i <= 0) return {};
            const nodes = [...s.nodes];
            const [n] = nodes.splice(i, 1);
            nodes.splice(toBottom ? 0 : i - 1, 0, n!);
            return { nodes };
          });
        },

        removeNodes: (ids) => {
          push();
          const set_ = new Set(ids);
          set((s) => {
            const nodes = s.nodes.filter((n) => !set_.has(n.id));
            const liveGroups = new Set(nodes.map((n) => n.groupId).filter(Boolean) as string[]);
            return {
              nodes,
              groups: s.groups.filter((g) => liveGroups.has(g.id)),
              shapes: s.shapes.map((sh) =>
                set_.has(sh.fromNodeId ?? "") || set_.has(sh.toNodeId ?? "")
                  ? { ...sh, fromNodeId: set_.has(sh.fromNodeId ?? "") ? null : sh.fromNodeId, toNodeId: set_.has(sh.toNodeId ?? "") ? null : sh.toNodeId }
                  : sh,
              ),
              selection: s.selection.filter((id) => !set_.has(id)),
            };
          });
        },

        duplicateNodes: (ids) => {
          push();
          set((s) => {
            const set_ = new Set(ids);
            const copies = s.nodes
              .filter((n) => set_.has(n.id))
              .map((n) => ({ ...n, id: uid("n"), x: n.x + 24, y: n.y + 24, groupId: null }));
            return { nodes: [...s.nodes, ...copies], selection: copies.map((c) => c.id) };
          });
        },

        setCubeFace: (nodeId, index, patch) => {
          // Words on a face are the document, so they are undone like words
          // anywhere else on it: one edit per run of typing on one field.
          if (patch === null) push();
          else pushEdit(`face:${nodeId}:${index}:${Object.keys(patch).join(",")}`);
          set((s) => ({
            nodes: s.nodes.map((n) => {
              if (n.id !== nodeId || index < 0 || index > 5) return n;
              const cube = n.cube ?? emptyCube();
              const faces = cube.faces.map((f, i) =>
                i !== index ? f : patch === null ? { heading: "", body: "", colour: "" } : { ...f, ...patch },
              );
              return { ...n, cube: { ...cube, faces } };
            }),
          }));
        },

        pickFace: (nodeId, side) => set({ pickedFace: side ? { nodeId, side } : null }),

        hold: (nodeId) => set({ handling: nodeId }),

        setCubeTurn: (nodeId, turn) =>
          set((s) => ({
            nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, cube: { ...(n.cube ?? emptyCube()), turn } } : n)),
          })),

        setMeshTurn: (nodeId, turn) =>
          set((s) => ({
            nodes: s.nodes.map((n) => (n.id === nodeId && n.mesh ? { ...n, mesh: { ...n.mesh, turn } } : n)),
          })),

        applyDrawnKind: (nodeId, role, said = "") => {
          const s0 = get();
          const node = s0.nodes.find((n) => n.id === nodeId);
          if (!node) return { kind: role.kind, did: "" };
          const inside = (n: StudioNode) =>
            n.id !== node.id && n.pageId === node.pageId &&
            n.x >= node.x - 4 && n.y >= node.y - 4 && n.x + n.w <= node.x + node.w + 4 && n.y + n.h <= node.y + node.h + 4;

          if (role.kind === "container") {
            const held = s0.nodes.filter(inside);
            if (held.length) {
              const gid = uid("g");
              set((s) => ({
                groups: [...s.groups, { id: gid, pageId: node.pageId, label: node.label, prompt: "", hue: HUES[s.groups.length % HUES.length]! }],
                nodes: s.nodes.map((n) => (n.id === node.id || held.some((h) => h.id === n.id) ? { ...n, kind: n.id === node.id ? "container" : n.kind, groupId: gid } : n)),
              }));
              return { kind: "container", did: `a container holding ${held.length} part${held.length === 1 ? "" : "s"}` };
            }
            set((s) => ({ nodes: s.nodes.map((n) => (n.id === node.id ? { ...n, kind: "container" } : n)) }));
            return { kind: "container", did: "a container, with nothing in it yet" };
          }

          if (role.kind === "connector") {
            // The two parts nearest each end. The drawing's box is the
            // part's box, so the ends are two corners of it, and which two
            // depends on which way the line runs.
            const flat = node.w >= node.h;
            const mid = { x: node.x + node.w / 2, y: node.y + node.h / 2 };
            const others = s0.nodes.filter((n) => n.id !== node.id && n.pageId === node.pageId);
            const near = (before: boolean) =>
              others
                .map((n) => ({ n, cx: n.x + n.w / 2, cy: n.y + n.h / 2 }))
                .filter((o) => (flat ? (before ? o.cx < mid.x : o.cx > mid.x) : before ? o.cy < mid.y : o.cy > mid.y))
                .sort((a, b) => Math.hypot(a.cx - mid.x, a.cy - mid.y) - Math.hypot(b.cx - mid.x, b.cy - mid.y))[0]?.n ?? null;
            const from = near(true);
            const to = near(false);
            if (from && to && from.id !== to.id) {
              const sid = uid("sh");
              set((s) => ({
                shapes: [
                  ...s.shapes,
                  {
                    id: sid, pageId: node.pageId, kind: "arrow" as ShapeKind,
                    points: [[from.x + from.w / 2, from.y + from.h / 2], [to.x + to.w / 2, to.y + to.h / 2]] as [number, number][],
                    hue: HUES[0]!, width: 2, label: "", prompt: "", fromNodeId: from.id, toNodeId: to.id, relation: "flow" as ShapeRelation,
                  },
                ],
                // The line was the join, not a thing on the page.
                nodes: s.nodes.filter((n) => n.id !== node.id),
                selection: s.selection.filter((id) => id !== node.id),
              }));
              return { kind: "connector", did: `a chain from ${from.label} to ${to.label}` };
            }
            set((s) => ({ nodes: s.nodes.map((n) => (n.id === node.id ? { ...n, kind: "connector" } : n)) }));
            return { kind: "connector", did: "a connector with nothing at its ends yet" };
          }

          if (role.kind === "list") {
            const rows = Math.max(2, Math.min(12, role.rows ?? 3));
            const content = node.content.trim() || Array.from({ length: rows }, (_, i) => `Row ${i + 1}`).join(", ");
            set((s) => ({ nodes: s.nodes.map((n) => (n.id === node.id ? { ...n, kind: "list", content } : n)) }));
            return { kind: "list", did: `a list of ${rows} rows` };
          }

          set((s) => ({ nodes: s.nodes.map((n) => (n.id === node.id ? { ...n, kind: role.kind } : n)) }));
          return { kind: role.kind, did: role.kind === "surface" ? "a surface that holds what is placed on it" : "" };
        },

        groupSelection: (label) => {
          const s0 = get();
          const ids = s0.selection.filter((id) => s0.nodes.some((n) => n.id === id));
          if (ids.length < 2) return;
          push();
          const gid = uid("g");
          set((s) => ({
            groups: [
              ...s.groups,
              {
                id: gid,
                pageId: s.activePageId,
                label: label ?? `Group ${s.groups.length + 1}`,
                prompt: "",
                hue: HUES[s.groups.length % HUES.length]!,
              },
            ],
            nodes: s.nodes.map((n) => (ids.includes(n.id) ? { ...n, groupId: gid } : n)),
          }));
        },

        ungroup: (groupId) => {
          push();
          set((s) => ({
            groups: s.groups.filter((g) => g.id !== groupId),
            nodes: s.nodes.map((n) => (n.groupId === groupId ? { ...n, groupId: null } : n)),
          }));
        },

        updateGroup: (id, patch) => {
          push();
          set((s) => ({ groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
        },

        addShape: (shape) => {
          const id = uid("s");
          push();
          // When it went down is half of what says which drawing it is in:
          // stamped here so no caller can forget to.
          set((s) => ({ shapes: [...s.shapes, { at: Date.now(), ...shape, id }] }));
          return id;
        },

        /*
         * Grouping is a guess, so a person has to be able to overrule it.
         *
         * Both of these write the decision onto the strokes themselves
         * rather than into a list of groups somewhere: a stroke that is
         * deleted takes its half of the decision with it, and there is no
         * second place for the two to disagree.
         */
        joinInk: (ids) => {
          if (ids.length < 2) return;
          const key = ids[0]!;
          const set_ = new Set(ids);
          push();
          set((s) => ({ shapes: s.shapes.map((sh) => (set_.has(sh.id) ? { ...sh, group: key } : sh)) }));
        },

        splitInk: (ids) => {
          if (!ids.length) return;
          const set_ = new Set(ids);
          push();
          set((s) => ({ shapes: s.shapes.map((sh) => (set_.has(sh.id) ? { ...sh, group: sh.id } : sh)) }));
        },

        updateShape: (id, patch) => {
          push();
          set((s) => ({ shapes: s.shapes.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh)) }));
        },

        setShapeRelation: (id, relation) => {
          push();
          set((s) => {
            const shape = s.shapes.find((x) => x.id === id);
            if (!shape) return {};
            const shapes = s.shapes.map((x) => (x.id === id ? { ...x, relation } : x));
            // A data wire says the target reads from the source, so write that
            // into the target's data box — that is the sentence the backend needs.
            if (relation !== "data" || !shape.fromNodeId || !shape.toNodeId) return { shapes };
            const from = s.nodes.find((n) => n.id === shape.fromNodeId);
            const to = s.nodes.find((n) => n.id === shape.toNodeId);
            if (!from || !to) return { shapes };
            const line = `from ${from.label}`;
            if (to.data.toLowerCase().includes(line.toLowerCase())) return { shapes };
            const data = to.data.trim() ? `${to.data.trim()}, ${line}` : line;
            return { shapes, nodes: s.nodes.map((n) => (n.id === to.id ? { ...n, data } : n)) };
          });
        },

        removeShapes: (ids) => {
          push();
          const set_ = new Set(ids);
          set((s) => ({ shapes: s.shapes.filter((sh) => !set_.has(sh.id)), selection: s.selection.filter((id) => !set_.has(id)) }));
        },

        draws: [],
        addDraw: (d) => set((st) => ({ draws: [{ ...d, id: `dw_${Math.random().toString(36).slice(2, 10)}`, at: Date.now() }, ...st.draws].slice(0, 40) })),
        removeDraw: (id) => set((st) => ({ draws: st.draws.filter((d) => d.id !== id) })),
        bringRepo: null,
        setBringRepo: (v) => set({ bringRepo: v }),
        addSpace: (space) => {
          const id = uid("sp");
          push();
          /*
           * It starts consuming the moment it is drawn.
           *
           * There were two keys here, Construct and Black hole, and the
           * choice is gone: create and draw differ by how many elements
           * come out, not by what kind of object is made, so a boundary
           * drawn is a black hole from that instant. The boundary is
           * thinned here rather than at each door, so a space is the same
           * record whether a hand drew it or the menu made it.
           */
          set((s) => ({ spaces: [...s.spaces, { since: Date.now(), ...space, boundary: tidyBoundary(space.boundary), id, at: Date.now() }] }));
          return id;
        },
        lockSpace: (id, placed) => {
          const space = get().spaces.find((sp) => sp.id === id);
          if (!space) return [];
          const locked = lockLayout(space, placed);
          push();
          set((s) => ({ spaces: s.spaces.map((sp) => (sp.id === id ? { ...sp, locked, form: { p: QUEUED, gen: (sp.form?.gen ?? 0) + 1 } } : sp)) }));
          return locked;
        },
        formSpace: (id, p) =>
          set((s) => ({
            spaces: s.spaces.map((sp) => {
              if (sp.id !== id) return sp;
              // Only ever climbs, like a thread's: a later step that maps
              // lower is the work taking a step, not going backwards.
              const had = sp.form ?? { p: 0, gen: 1 };
              const next = Math.max(had.p, Math.min(1, p));
              return next === had.p ? sp : { ...sp, form: { ...had, p: next } };
            }),
          })),
        resizeSpace: (id, box) => {
          const space = get().spaces.find((sp) => sp.id === id);
          if (!space) return;
          const moved = placeLocked(space, box);
          const at = new Map(moved.map((m) => [m.nodeId, m]));
          push();
          set((s) => ({
            spaces: s.spaces.map((sp) => (sp.id === id ? { ...sp, boundary: boundaryIn(space, box) } : sp)),
            // The contents go with it: that is what locked means.
            nodes: s.nodes.map((n) => {
              const to = at.get(n.id);
              return to ? { ...n, x: to.x, y: to.y, w: to.w, h: to.h } : n;
            }),
          }));
        },
        updateSpace: (id, patch) => set((s) => ({ spaces: s.spaces.map((sp) => (sp.id === id ? { ...sp, ...patch } : sp)) })),
        removeSpaces: (ids) => {
          const set_ = new Set(ids);
          push();
          set((s) => ({ spaces: s.spaces.filter((sp) => !set_.has(sp.id)), selection: s.selection.filter((sid) => !set_.has(sid)) }));
        },
        setPlan: (nodeId, plan) => set((s) => ({ nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, plan } : n)) })),

        addPage: (name) => {
          const id = uid("page");
          push();
          set((s) => {
            const n = s.pages.length + 1;
            const label = name ?? `Page ${n}`;
            return {
              pages: [...s.pages, { id, name: label, path: "/" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), prompt: "", scroll: "inherit" }],
              activePageId: id,
              selection: [],
            };
          });
          return id;
        },

        removePage: (id) => {
          const s0 = get();
          if (s0.pages.length <= 1) return;
          push();
          set((s) => {
            const pages = s.pages.filter((p) => p.id !== id);
            return {
              pages,
              nodes: s.nodes.filter((n) => n.pageId !== id),
              groups: s.groups.filter((g) => g.pageId !== id),
              shapes: s.shapes.filter((sh) => sh.pageId !== id),
              spaces: s.spaces.filter((sp) => sp.pageId !== id),
              activePageId: s.activePageId === id ? pages[0]!.id : s.activePageId,
              selection: [],
            };
          });
        },

        updatePage: (id, patch) => {
          push();
          set((s) => ({ pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
        },

        setActivePage: (id) => set({ activePageId: id, selection: [] }),

        movePage: (id, delta) => {
          push();
          set((s) => {
            const i = s.pages.findIndex((p) => p.id === id);
            const j = i + delta;
            if (i < 0 || j < 0 || j >= s.pages.length) return {};
            const pages = [...s.pages];
            const [moved] = pages.splice(i, 1);
            pages.splice(j, 0, moved!);
            return { pages };
          });
        },

        setSelection: (ids) =>
          set((s) => ({
            selection: ids,
            pickedFace: s.pickedFace && ids.length === 1 && ids[0] === s.pickedFace.nodeId ? s.pickedFace : null,
            // A part you were handling is let go of the moment it stops being
            // the only selected one, so the ground closes it as it always did.
            handling: s.handling && ids.length === 1 && ids[0] === s.handling ? s.handling : null,
          })),
        toggleSelection: (id) =>
          set((s) => ({ selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id] })),
        selectAll: () =>
          set((s) => ({
            selection: [
              ...s.nodes.filter((n) => n.pageId === s.activePageId).map((n) => n.id),
              ...s.shapes.filter((sh) => sh.pageId === s.activePageId).map((sh) => sh.id),
            ],
          })),
        clearSelection: () => set({ selection: [] }),

        selectBackground: () => set({ selection: [BACKGROUND_ID] }),
        // Cutting the background strips the page bare: every texture layer
        // that lands on the page goes off, and the fill goes flat. What went
        // is held, so paste puts exactly it back.
        cutBackground: () => {
          const s = get();
          const layers = s.look.texture ?? [];
          const onPage = layers.filter((l) => l.on && lands(l, "page"));
          const fill = String(s.format["palette.background"] ?? "flat");
          const veil = s.look.veil ?? 0;
          if (!onPage.length && fill === "flat" && veil < 0.005) return false;
          push();
          held = { kind: "background", layerIds: onPage.map((l) => l.id), fill, veil };
          set({
            look: { ...s.look, veil: 0, texture: layers.map((l) => (onPage.some((p) => p.id === l.id) ? { ...l, on: false } : l)) },
            format: { ...s.format, "palette.background": "flat" },
            selection: [BACKGROUND_ID],
          });
          return true;
        },
        pasteBackground: () => {
          if (held?.kind !== "background") return false;
          const h = held;
          const s = get();
          push();
          set({
            look: { ...s.look, veil: h.veil, texture: (s.look.texture ?? []).map((l) => (h.layerIds.includes(l.id) ? { ...l, on: true } : l)) },
            format: { ...s.format, "palette.background": h.fill },
            selection: [BACKGROUND_ID],
          });
          return true;
        },
        cutNodes: (ids) => {
          const s = get();
          const nodes = s.nodes.filter((n) => ids.includes(n.id));
          if (!nodes.length) return false;
          held = { kind: "nodes", nodes };
          s.removeNodes(nodes.map((n) => n.id));
          return true;
        },
        pasteNodes: () => {
          if (held?.kind !== "nodes") return false;
          const h = held;
          push();
          set((s) => {
            const copies = h.nodes.map((n) => ({ ...n, id: uid("n"), pageId: s.activePageId, x: n.x + 24, y: n.y + 24, groupId: null }));
            return { nodes: [...s.nodes, ...copies], selection: copies.map((c) => c.id) };
          });
          return true;
        },
        cut: () => {
          const s = get();
          return s.selection.includes(BACKGROUND_ID) ? s.cutBackground() : s.cutNodes(s.selection);
        },
        paste: () => {
          const s = get();
          return held?.kind === "nodes" ? s.pasteNodes() : s.pasteBackground();
        },
        setTool: (t) => set({ tool: t }),
        setInk: (patch) => set((s) => ({ inkHue: patch.hue ?? s.inkHue, inkWidth: patch.width ?? s.inkWidth })),
        setDrawKind: (kind) => set({ drawKind: kind }),
        setSiteRepo: (repo) => set({ siteRepo: repo?.trim() || null }),
        /*
         * The zoom key's floor is its own, EXCEPT that it is never above the
         * fit. Measured at 375: the fit is 0.142, `ZOOM_MIN` is 0.25, and
         * pressing zoom OUT took the page from 247 to 436 — bigger, off the
         * right edge of a 375 pane, and the button did the opposite of its
         * name. The gap is mine: `FIT_MIN` let the fit go below the floor the
         * keys clamp to, so the first press of either key jumped up to 0.25.
         *
         * A person may always zoom out as far as the page is drawn when it
         * fits, and no further; they may never be pushed larger by asking for
         * smaller.
         */
        setZoom: (z) => set((s) => ({ zoom: Math.max(Math.min(ZOOM_MIN, s.fitAt), Math.min(ZOOM_MAX, z)) })),
        /* The board's own fit, floored at `FIT_MIN` rather than the key's
           `ZOOM_MIN` — see the note on both. Nothing else may use this. It
           records what it asked for, which is the keys' floor above. */
        setFitZoom: (z) => {
          const at = Math.max(FIT_MIN, Math.min(ZOOM_MAX, z));
          set({ zoom: at, fitAt: at });
        },
        setPan: (p) => set({ pan: p }),
        setFrameWidth: (w) => set((s) => ({ frameWidth: w, fitNonce: s.fitNonce + 1 })),
        requestFit: () => set((s) => ({ fitNonce: s.fitNonce + 1 })),
        setPositions: (positions) =>
          set((s) => ({ nodes: s.nodes.map((n) => (positions[n.id] && !n.locked ? { ...n, ...positions[n.id]! } : n)) })),

        setFormat: (id, value) => {
          push();
          set((s) => ({ format: { ...s.format, [id]: value } }));
        },
        resetFormat: () => {
          push();
          set({ format: formatDefaults() });
        },
        addMotion: () => {
          push();
          const asset = newMotion(`Motion ${useStudio.getState().motion.length + 1}`);
          set((st) => ({ motion: [...st.motion, asset] }));
          return asset.id;
        },
        updateMotion: (id, patch) =>
          set((st) => ({ motion: st.motion.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
        removeMotion: (id) => {
          push();
          set((st) => ({ motion: st.motion.filter((m) => m.id !== id) }));
        },
        setMotionFrame: (id, at, src) =>
          set((st) => ({
            motion: st.motion.map((m) =>
              m.id === id ? { ...m, frames: m.frames.map((f, i) => (i === at ? src : f)) } : m,
            ),
          })),
        // Sleeves swap rather than shuffle: pulling one out and putting it back
        // one place along is what reordering a crate actually is.
        moveMotionFrame: (id, at, delta) =>
          set((st) => ({
            motion: st.motion.map((m) => {
              if (m.id !== id) return m;
              const to = at + delta;
              if (to < 0 || to >= m.frames.length) return m;
              const frames = [...m.frames];
              [frames[at], frames[to]] = [frames[to]!, frames[at]!];
              return { ...m, frames };
            }),
          })),
        setLook: (patch) => {
          push();
          set((s) => ({ look: { ...s.look, ...patch } }));
        },
        // A new layer goes on top, where every other layers panel puts one —
        // index 0 is the front of the stack.
        addTexture: (layer) => {
          push();
          set((s) => ({ look: { ...s.look, texture: [layer, ...s.look.texture] } }));
        },
        updateTexture: (id, patch) =>
          set((s) => ({ look: { ...s.look, texture: s.look.texture.map((l) => (l.id === id ? { ...l, ...patch } : l)) } })),
        // A layer and the one under it become one baked picture, in that order.
        mergeTexture: (id, src) => {
          push();
          set((st) => {
            const i = st.look.texture.findIndex((l) => l.id === id);
            if (i < 0 || i + 1 >= st.look.texture.length) return {};
            const top = st.look.texture[i]!;
            const merged: TextureLayer = {
              ...newLayer("image"),
              id: `tx_${Math.random().toString(36).slice(2, 8)}`,
              src,
              baked: src,
              pattern: false,
              cutout: false,
              weave: 0,
              scale: 200,
              opacity: 1,
              angle: 0,
              target: top.target ?? "page",
              blend: "normal",
              on: true,
            };
            const next = [...st.look.texture];
            next.splice(i, 2, merged);
            return { look: { ...st.look, texture: next } };
          });
        },
        removeTexture: (id) => {
          push();
          set((s) => ({ look: { ...s.look, texture: s.look.texture.filter((l) => l.id !== id) } }));
        },
        moveTexture: (id, delta) => {
          push();
          set((s) => {
            const i = s.look.texture.findIndex((l) => l.id === id);
            const j = i + delta;
            if (i < 0 || j < 0 || j >= s.look.texture.length) return {};
            const next = [...s.look.texture];
            const [item] = next.splice(i, 1);
            next.splice(j, 0, item!);
            return { look: { ...s.look, texture: next } };
          });
        },
        setShowAllFormat: (v) => set({ showAllFormat: v }),
        setShowWires: (v) => set({ showWires: v }),
        setMode: (m) => set({ mode: m, selection: m === "preview" ? [] : get().selection }),
        setMenuShape: (v) => set({ menuShape: v }),
        setPlacingLight: (v) => set({ placingLight: v, placedLight: v ? get().look.light : null, lightCarry: null }),
        setLightCarry: (at) => set({ lightCarry: at }),
        cancelPlacingLight: () => {
          const was = get().placedLight;
          set({ placingLight: false, placedLight: null, lightCarry: null, ...(was ? { look: { ...get().look, light: was } } : {}) });
        },
        setMenuSpin: (turns) => set({ menuSpin: ((turns % 1) + 1) % 1 }),
        rememberColour: (colour) => set((s) => ({ recentColours: [colour, ...s.recentColours.filter((c) => c !== colour)].slice(0, 12) })),
        setCompanion: (patch) => set((s) => ({ companion: { ...s.companion, ...patch } })),
        hideFeature: (id) => set((s) => (s.hiddenFeatures.includes(id) ? {} : { hiddenFeatures: [...s.hiddenFeatures, id] })),
        restoreFeature: (id) => set((s) => ({ hiddenFeatures: s.hiddenFeatures.filter((x) => x !== id) })),
        restoreAllFeatures: () => set({ hiddenFeatures: [] }),

        bringIn: (repo, parts) => {
          push();
          set((s) => {
            const brought = [...s.brought.filter((r) => r.id !== repo.id), repo];
            const broughtParts = [...s.broughtParts.filter((p) => p.categoryId !== repo.id), ...parts];
            shelve(brought, broughtParts);
            return { brought, broughtParts };
          });
        },

        sendBack: (repoId) => {
          push();
          set((s) => {
            const brought = s.brought.filter((r) => r.id !== repoId);
            const broughtParts = s.broughtParts.filter((p) => p.categoryId !== repoId);
            shelve(brought, broughtParts);
            return { brought, broughtParts };
          });
        },
        setBrief: (patch) => {
          push();
          set((s) => ({ brief: { ...s.brief, ...patch } }));
        },

        recordAsk: ({ mode, model, revisions }) => {
          if (!revisions.length) return;
          set((s) => {
            const now = Date.now();
            const entries = [...s.trail];
            for (const r of revisions) {
              const target = resolveTarget(s, r.target);
              const text = promptOf(s, target);
              // The prompt as it stood when it was sent, kept once; a later ask
              // on the same unchanged words joins the same account.
              let author = [...entries].reverse().find((e) => e.stage !== "critique" && e.target.kind === target.kind && e.target.id === target.id && e.text === text);
              if (!author) {
                author = { id: uid("t"), at: now, stage: "author", target, text, parentId: null };
                entries.push(author);
              }
              entries.push({
                id: uid("t"), at: now, stage: "critique", target, text: r.finding.trim(), prompt: r.prompt.trim(),
                kind: r.kind, mode, model, parentId: author.id, applied: false, threadId: s.liveThreadId ?? undefined,
              });
            }
            return { trail: entries.slice(-TRAIL_LIMIT) };
          });
        },

        noteSpend: (spend, on) =>
          set((s) => {
            // Named when it was fired, not when it came back: a second pass
            // that takes ten seconds must charge the iteration that asked
            // for it, not whichever one is live when it lands.
            const id = on ?? s.liveThreadId;
            if (!id) return {};
            if (!spend.dollars && !spend.ms && !spend.calls) return {};
            return {
              threads: s.threads.map((t) => {
                if (t.id !== id) return t;
                const had = t.usage;
                // Kept to the tenth of a cent, not the cent: a four-tenths
                // call rounded to two places reads as free and is not.
                const money = (a = 0, b = 0) => Math.round((a + b) * 10000) / 10000;
                const claude = money(had?.claude, spend.claude);
                const renderer = money(had?.renderer, spend.renderer);
                return {
                  ...t,
                  form: reformed(t),
                  usage: {
                    sent: 0,
                    skipped: 0,
                    ...(had ?? {}),
                    cost: money(had?.cost, spend.dollars),
                    ms: (had?.ms ?? 0) + spend.ms,
                    calls: (had?.calls ?? 0) + spend.calls,
                    ...(claude ? { claude } : {}),
                    ...(renderer ? { renderer } : {}),
                  },
                };
              }),
            };
          }),
        noteProgress: (threadId, p) =>
          set((s) => {
            if (!threadId || p === null) return {};
            return {
              threads: s.threads.map((t) => {
                if (t.id !== threadId) return t;
                const had = t.form ?? { p: t.state === "running" ? 0.15 : 1, gen: 0 };
                // Only ever climbs: a later step that maps lower is a step the
                // work took after a higher one, not the work going backwards.
                const next = Math.max(had.p, Math.min(1, p));
                return next === had.p ? t : { ...t, form: { ...had, p: next } };
              }),
            };
          }),

        notePass: (line, on) =>
          set((s) => {
            // Named when the pass was fired, not when it answered: a second
            // pass that takes ten seconds belongs to the iteration that
            // asked for it.
            const id = on ?? s.liveThreadId;
            const said = line.trim();
            if (!id || !said) return {};
            return {
              threads: s.threads.map((t) => {
                if (t.id !== id) return t;
                const had = t.usage?.passes ?? [];
                if (had.includes(said)) return t;
                return { ...t, usage: { sent: 0, skipped: 0, ...(t.usage ?? {}), passes: [...had, said] }, form: reformed(t) };
              }),
            };
          }),

        markThread: (id, state) =>
          set((s) => ({
            threads: s.threads.map((t) => {
              if (t.id !== id) return t;
              // Landed: it has finished forming, whatever step it was on.
              const form = state === "done" ? { ...(t.form ?? { p: 0, gen: 0 }), p: 1 } : t.form;
              return { ...t, state, ...(form ? { form } : {}) };
            }),
          })),

        noteMade: (threadId, madeId) =>
          set((s) => ({ threads: s.threads.map((t) => (t.id === threadId ? { ...t, madeId } : t)) })),

        setCurrentThread: (id) =>
          set((s) => (s.threads.some((t) => t.id === id) || id === null ? { currentThreadId: id, openThreadId: id } : {})),

        landThread: ({ mode, model, ask, answer, changes, sketch, state, madeId, id: fill }) => {
          /*
           * Filling one in rather than making a second.
           *
           * A drawing's iteration is landed the moment it is queued, so that
           * the box exists while the work happens rather than after it. When
           * the work comes back it fills that one in — keeping when it began,
           * what it hangs off, and how far it has formed — and only a thread
           * with no id of its own is a new one.
           */
          if (fill && get().threads.some((t) => t.id === fill)) {
            set((s) => ({
              threads: s.threads.map((t) => (t.id === fill
                ? {
                  ...t,
                  mode, model, state: state ?? "done",
                  ask: ask.trim(), answer: answer.trim(), changes: changes ?? t.changes,
                  ...(sketch ? { sketch } : {}),
                  ...(madeId ? { madeId } : {}),
                  doc: snapshot(s) as ThreadDoc,
                  form: (state ?? "done") === "done" ? { ...(t.form ?? { p: 0, gen: 1 }), p: 1 } : t.form,
                }
                : t)),
              liveThreadId: fill,
            }));
            return fill;
          }
          const id = uid("th");
          set((s) => ({
            threads: [
              ...s.threads,
              {
                /*
                 * It hangs off the one being worked in when there is one,
                 * off whatever landed last when there is not, and failing
                 * both off the newest thread there is — because there is
                 * always something it was founded on unless it is the first
                 * thing that ever happened. A thread with no parent is a
                 * piece floating loose on the timeline.
                 */
                id,
                parentId: s.currentThreadId ?? s.liveThreadId ?? (s.threads.length ? s.threads[s.threads.length - 1]!.id : null),
                at: Date.now(), mode, model, state: state ?? "done",
                // A thread landing still running has been read and is forming
                // from there; one landing done formed as it arrived.
                form: { p: (state ?? "done") === "running" ? 0.15 : 1, gen: 1 },
                ask: ask.trim(), answer: answer.trim(), changes: changes ?? [],
                ...(sketch ? { sketch } : {}),
                ...(madeId ? { madeId } : {}),
                doc: snapshot(s) as ThreadDoc,
                // What was vined to the call is what the thread was about.
                pieces: [...s.draftPieces],
              },
            ].slice(-THREAD_LIMIT),
            liveThreadId: id,
          }));
          /*
           * Dropping the oldest threads orphans whoever hung off them, so
           * the survivors are re-hung on the oldest thread that is left
           * rather than pointing at something that is gone.
           */
          set((s) => {
            const here = new Set(s.threads.map((t) => t.id));
            const eldest = s.threads[0]?.id ?? null;
            if (s.threads.every((t) => !t.parentId || here.has(t.parentId))) return {};
            return {
              threads: s.threads.map((t, i) =>
                t.parentId && !here.has(t.parentId) ? { ...t, parentId: i > 0 ? eldest : null } : t,
              ),
            };
          });
          return id;
        },

        /**
         * Cut one thread. Its children re-hang from its parent — they
         * happened, and removing the step underneath them does not unhappen
         * them — and the board goes back to whatever is live after the cut.
         */
        pruneThread: (id) => {
          const s = get();
          if (!s.threads.some((t) => t.id === id)) return;
          const threads = cutThread(s.threads, id);
          const live = liveAfterPrune(s.threads, id, s.liveThreadId);
          const stand = threads.find((t) => t.id === live);
          push();
          const spots = { ...s.threadSpots };
          delete spots[id];
          set(() => ({
            threads,
            liveThreadId: live,
            pinnedThreads: s.pinnedThreads.filter((x) => x !== id),
            openThreadId: s.openThreadId === id ? null : s.openThreadId,
            currentThreadId: s.currentThreadId === id ? null : s.currentThreadId,
            threadSpots: spots,
            trail: s.trail.filter((e) => e.threadId !== id),
            ...docPatch(stand?.doc),
            selection: [],
          }));
        },

        moveThread: (id, x, y) => set((s) => ({ threadSpots: { ...s.threadSpots, [id]: { x: Math.round(x), y: Math.round(y) } } })),

        toggleDraftPiece: (id) =>
          set((s) => ({ draftPieces: s.draftPieces.includes(id) ? s.draftPieces.filter((x) => x !== id) : [...s.draftPieces, id] })),

        clearDraft: () => set({ draftPieces: [] }),

        recordSent: (threadId, sent, usage) =>
          set((s) => ({
            sentPieces: { ...s.sentPieces, ...sent },
            // Merged, not replaced: the money and the wait were already
            // noted against this thread and a call that also sent pieces
            // must not wipe its own bill.
            threads: s.threads.map((t) => (t.id === threadId ? { ...t, usage: { ...(t.usage ?? {}), ...usage } } : t)),
          })),

        resetThreadSpots: () => set({ threadSpots: {} }),

        togglePinnedThread: (id) =>
          set((s) => ({
            pinnedThreads: s.pinnedThreads.includes(id) ? s.pinnedThreads.filter((x) => x !== id) : [...s.pinnedThreads, id],
          })),

        setBookPinned: (v) => set({ bookPinned: v }),

        openThread: (id) => set({ openThreadId: id }),

        enqueueDraw: (job) => {
          const id = uid("job");
          /*
           * The iteration begins here, not when the read comes back.
           *
           * A box lands on the timeline at the press of Make real, running
           * and formed from nothing, and the job carries its id so every
           * step of the work climbs *this* box. It reaches complete when the
           * job does. Before this the thread was made when Claude answered,
           * which is why a box appeared already finished and then played its
           * formation afterwards.
           */
          const threadId = get().landThread({
            mode: "drawing",
            state: "running",
            ask: job.sketch.words.trim(),
            answer: "",
            changes: [],
            sketch: { strokes: job.sketch.strokes as [number, number][][], words: job.sketch.words },
            ...(job.nodeId ? { madeId: job.nodeId } : {}),
          });
          // Queued is the very start of the vine: begun, and nothing more.
          set((s) => ({ threads: s.threads.map((t) => (t.id === threadId ? { ...t, form: { p: QUEUED, gen: 1 } } : t)) }));
          set((s) => ({ queue: trimQueue([...s.queue, { ...job, id, threadId, status: "waiting" as const, queued: Date.now() }]) }));
          return id;
        },

        updateJob: (id, patch) => set((s) => ({ queue: s.queue.map((j) => (j.id === id ? { ...j, ...patch } : j)) })),

        answerJob: (id, answer) =>
          set((s) => ({
            queue: s.queue.map((j) => (j.id === id && j.question ? { ...j, status: "waiting" as const, question: { ...j.question, answer } } : j)),
          })),

        clearFinishedJobs: () => set((s) => ({ queue: s.queue.filter((j) => j.status === "waiting" || j.status === "running") })),

        noteThread: (lines, on) =>
          set((s) => {
            const id = on ?? s.liveThreadId;
            const add = lines.map((l) => l.trim()).filter(Boolean);
            if (!id || !add.length) return {};
            return {
              threads: s.threads.map((t) =>
                t.id === id ? { ...t, changes: [...t.changes, ...add.filter((l) => !t.changes.includes(l))], form: reformed(t) } : t,
              ),
            };
          }),

        standOn: (id) => {
          const s = get();
          const t = s.threads.find((x) => x.id === id);
          if (!t?.doc) return;
          push();
          set({ ...docPatch(t.doc), liveThreadId: id, selection: [] });
        },

        applyRevision: (entryId) => {
          const s = get();
          const e = s.trail.find((x) => x.id === entryId);
          if (!e || e.stage !== "critique" || !e.prompt || e.applied) return;
          const t = e.target;
          const prompt = e.prompt;
          push();
          set((st) => {
            const patch: Partial<StudioState> =
              t.kind === "site" ? { brief: { ...st.brief, master: prompt } }
              : t.kind === "page" ? { pages: st.pages.map((p) => (p.id === t.id ? { ...p, prompt } : p)) }
              : t.kind === "node" ? { nodes: st.nodes.map((n) => (n.id === t.id ? { ...n, prompt } : n)) }
              : t.kind === "group" ? { groups: st.groups.map((g) => (g.id === t.id ? { ...g, prompt } : g)) }
              : {};
            return {
              ...patch,
              trail: [
                ...st.trail.map((x) => (x.id === entryId ? { ...x, applied: true } : x)),
                { id: uid("t"), at: Date.now(), stage: "final" as const, target: t, text: prompt, parentId: entryId },
              ].slice(-TRAIL_LIMIT),
              // Taking a finding is the thread doing something, so the thread
              // says so and keeps the board it produced.
              threads: st.threads.map((x) =>
                x.id === (e.threadId ?? st.liveThreadId)
                  ? { ...x, changes: [...x.changes, `took the prompt for ${t.label}`], doc: { ...(x.doc ?? {}), ...patch, nodes: (patch.nodes ?? st.nodes), pages: (patch.pages ?? st.pages), brief: (patch.brief ?? st.brief) } as ThreadDoc }
                  : x,
              ),
            };
          });
        },


        clearPage: (pageId) => {
          push();
          set((s) => ({
            nodes: s.nodes.filter((n) => n.pageId !== pageId),
            groups: s.groups.filter((g) => g.pageId !== pageId),
            shapes: s.shapes.filter((sh) => sh.pageId !== pageId),
            spaces: s.spaces.filter((sp) => sp.pageId !== pageId),
            selection: [],
          }));
        },

        resetAll: () => {
          push();
          set({ ...starterDoc(), activePageId: "page_home", selection: [], trail: [], threads: [], liveThreadId: null, pinnedThreads: [], threadSpots: {}, draftPieces: [], sentPieces: {} });
        },

        loadDoc: (doc) => {
          push();
          // What the document brings, the width included: see `docTake.ts`.
          set((s) => takeDoc(s, doc, { format: formatDefaults, look: emptyLook }) as unknown as Partial<StudioState>);
        },

        undo: () =>
          set((s) => {
            const prev = s.past[s.past.length - 1];
            if (!prev) return {};
            // Whatever was being typed is over: the next letter is a new edit.
            run = null;
            return {
              ...prev,
              past: s.past.slice(0, -1),
              future: [snapshot(s), ...s.future].slice(0, HISTORY_LIMIT),
              selection: [],
              activePageId: prev.pages.some((p) => p.id === s.activePageId) ? s.activePageId : prev.pages[0]!.id,
            };
          }),

        redo: () =>
          set((s) => {
            const next = s.future[0];
            if (!next) return {};
            run = null;
            return {
              ...next,
              past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
              future: s.future.slice(1),
              selection: [],
              activePageId: next.pages.some((p) => p.id === s.activePageId) ? s.activePageId : next.pages[0]!.id,
            };
          }),

        /** Checkpoint the current document — used at the end of a drag. */
        commit: () => push(),
      };
    },
    {
      name: "builder.studio",
      /*
       * Nothing is written until something has been read.
       *
       * `skipHydration` below means the saved document is only fetched when a
       * Builder surface asks for it. What it does not stop is the writing:
       * the middleware subscribes at once, so the FIRST change of state after
       * the store is built — any change, because the whole partialized shape
       * goes out on every one — saves the empty default over whatever was
       * there. And something does change state that early.
       *
       * Measured rather than reasoned about, because it sounds too big to be
       * true: a trace of every `builder.studio` read and write on a load of
       * the Builder, with the stored document seeded to five parts, came back
       *
       *   +343ms  SET nodes=0
       *   +343ms  SET nodes=0
       *   +343ms  get  nodes=0
       *
       * — written twice before it was read once. And the same thing with no
       * test rig at all: set the frame to Tablet on the bar, which is
       * persisted, and reload. 834 before, 1440 after. Nothing a person did
       * in the Builder survived a reload, on any surface, and had not for as
       * long as `skipHydration` has been here.
       *
       * So the store holds the pen until it has read. Every write before
       * hydration is a write of the defaults by definition — there is nothing
       * else in the store yet — so refusing them loses nothing and saves the
       * document.
       */
      storage: createJSONStorage(() => ({
        getItem: (k) => localStorage.getItem(k),
        setItem: (k, v) => { if (studioRead) localStorage.setItem(k, v); },
        removeItem: (k) => localStorage.removeItem(k),
      })),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StudioState>;
        return {
          ...current,
          ...p,
          nodes: (p.nodes ?? current.nodes).map((n) => ({
            ...n, content: n.content ?? "", link: n.link ?? null, data: n.data ?? "", colour: n.colour ?? null, font: n.font ?? null, anim: n.anim ?? null,
            // Speed and delay were words once; a saved board still has them.
            animSpeed: speedK(n.animSpeed as number | string | undefined), animDelay: delayMs(n.animDelay as number | string | undefined), animEase: n.animEase ?? "smooth",
            shape: n.shape ?? null,
            outline: n.outline && typeof n.outline === "object" && typeof (n.outline as OutlineClip).cut === "string" ? (n.outline as OutlineClip) : null,
            code: n.code && typeof n.code === "object" && typeof (n.code as PartCode).html === "string" ? (n.code as PartCode) : null,
            aura: n.aura ?? null, auraSize: Number.isFinite(n.auraSize) ? n.auraSize : 1, auraStyle: n.auraStyle ?? "glow", texture: n.texture ?? null,
            sketch: normaliseSketch(n.sketch),
            /* A reference, checked rather than trusted: a picture whose
               record is half a record cannot be looked for or published,
               and a part that thinks it has one draws a hole. */
            picture: n.picture && typeof n.picture === "object" && typeof (n.picture as Picture).id === "string" && typeof (n.picture as Picture).path === "string"
              ? (n.picture as Picture)
              : null,
          })),
          recentColours: Array.isArray(p.recentColours) ? p.recentColours : [],
          shapes: (p.shapes ?? current.shapes).map((sh) => ({ ...sh, relation: sh.relation ?? "flow" })),
          // A board saved before spaces existed has none; a broken entry is dropped rather than drawn.
          /* A board saved before spaces existed has none; a broken entry is
             dropped rather than drawn. One saved while spaces still had a
             kind comes across as what it always was underneath: a hole,
             consuming from when it was drawn. */
          spaces: Array.isArray(p.spaces)
            ? p.spaces
                .filter((sp) => sp && Array.isArray(sp.boundary) && sp.boundary.length >= 4)
                .map((sp) => ({ ...sp, since: sp.since ?? sp.at ?? Date.now() }))
            : [],
          hiddenFeatures: p.hiddenFeatures ?? [],
          trail: Array.isArray(p.trail) ? p.trail : [],
          threads: Array.isArray(p.threads) ? p.threads : [],
          liveThreadId: typeof p.liveThreadId === "string" ? p.liveThreadId : null,
          pinnedThreads: Array.isArray(p.pinnedThreads) ? p.pinnedThreads : [],
          openThreadId: typeof p.openThreadId === "string" ? p.openThreadId : null,
          bookPinned: !!p.bookPinned,
          threadSpots: p.threadSpots && typeof p.threadSpots === "object" ? (p.threadSpots as Record<string, { x: number; y: number }>) : {},
          draftPieces: Array.isArray(p.draftPieces) ? p.draftPieces : [],
          sentPieces: p.sentPieces && typeof p.sentPieces === "object" ? (p.sentPieces as Record<string, string>) : {},
          look: (() => {
            const look = { ...emptyLook(), ...(p.look ?? {}) };
            // The target used to be one switch for the whole stack; each layer
            // owns it now, so anything saved before inherits what was set.
            return {
              ...look,
              light: { ...defaultLight(), ...(look.light ?? {}) },
              texture: look.texture.map((l) => ({ ...l, target: l.target ?? look.target ?? "page" })),
            };
          })(),
          companion: { ...current.companion, ...(p.companion ?? {}) },
          menuSpin: Number.isFinite(p.menuSpin) ? (p.menuSpin as number) : 0,
          // A crate saved before a setting existed still has to open.
          motion: (p.motion ?? []).map((m) => ({
            ...newMotion(m.name),
            ...m,
            frames: Array.from({ length: SLEEVES }, (_, i) => m.frames?.[i] ?? null),
          })),
        };
      },
      partialize: (s) => ({
        pages: s.pages,
        nodes: s.nodes,
        /* His drawings survive leaving the tab, which is the whole point of them. */
        draws: s.draws,
        groups: s.groups,
        shapes: s.shapes,
        spaces: s.spaces,
        format: s.format,
        brief: s.brief,
        look: s.look,
        motion: s.motion,
        activePageId: s.activePageId,
        showAllFormat: s.showAllFormat,
        showWires: s.showWires,
        hiddenFeatures: s.hiddenFeatures,
        brought: s.brought,
        broughtParts: s.broughtParts,
        trail: s.trail,
        threads: s.threads,
        liveThreadId: s.liveThreadId,
        pinnedThreads: s.pinnedThreads,
        bookPinned: s.bookPinned,
        openThreadId: s.openThreadId,
        currentThreadId: s.currentThreadId,
        threadSpots: s.threadSpots,
        draftPieces: s.draftPieces,
        sentPieces: s.sentPieces,
        companion: s.companion,
        menuShape: s.menuShape,
        menuSpin: s.menuSpin,
        recentColours: s.recentColours,
        frameWidth: s.frameWidth,
        /* Which repository this site points at is part of the site, not part
           of where somebody is looking, so it is saved with the document. */
        siteRepo: s.siteRepo,
      }),
      skipHydration: true,
      /*
       * A thread left running is a thread whose process is gone.
       *
       * Nothing survives a reload except the document, so anything still
       * marked running when the store comes back was abandoned: the tab
       * closed, the job died, the run was stopped. Both of those read red,
       * which is what makes one mark enough for two states.
       */
      onRehydrateStorage: () => (state) => {
        /* Read at last, whether or not there was anything there: a first-ever
           visit has nothing saved and must still be allowed to save. */
        studioRead = true;
        if (!state) return;
        /* A saved document may already carry repositories: put their
           elements back on the shelf before anything reads it. A document
           from before this existed has neither, hence the defaults. */
        state.brought ??= [];
        state.broughtParts ??= [];
        shelve(state.brought, state.broughtParts);
        const stuck = state.threads.some((t) => t.state === "running");
        if (stuck) state.threads = state.threads.map((t) => (t.state === "running" ? { ...t, state: "cut" as const } : t));
      },
    },
  ),
);

/* ------------------------------------------------------------------ */
/* Derived selectors                                                   */
/* ------------------------------------------------------------------ */

/**
 * These build a new array on every call, so components MUST subscribe through
 * `useShallow` — zustand v5 compares snapshots by reference, and a fresh array
 * each render is an infinite re-render loop.
 *
 *   const nodes = useStudio(useShallow(pageNodes));
 */
export const pageNodes = (s: StudioState) => s.nodes.filter((n) => n.pageId === s.activePageId);
export const pageShapes = (s: StudioState) => s.shapes.filter((sh) => sh.pageId === s.activePageId);
export const pageSpaces = (s: StudioState) => s.spaces.filter((sp) => sp.pageId === s.activePageId);
export const pageGroups = (s: StudioState) => s.groups.filter((g) => g.pageId === s.activePageId);
export const activePage = (s: StudioState) => s.pages.find((p) => p.id === s.activePageId) ?? s.pages[0]!;

export function groupBounds(nodes: StudioNode[], groupId: string) {
  const members = nodes.filter((n) => n.groupId === groupId);
  if (!members.length) return null;
  const x = Math.min(...members.map((n) => n.x));
  const y = Math.min(...members.map((n) => n.y));
  const x2 = Math.max(...members.map((n) => n.x + n.w));
  const y2 = Math.max(...members.map((n) => n.y + n.h));
  return { x, y, w: x2 - x, h: y2 - y, members };
}

export function shapeBounds(shape: StudioShape) {
  const xs = shape.points.map((p) => p[0]);
  const ys = shape.points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/* ------------------------------------------------------------------ */
/* Hydration                                                           */
/* ------------------------------------------------------------------ */

/**
 * The store skips hydration so server and first client render agree; every
 * Builder surface calls this once so the saved document comes back before the
 * board's own effects write anything. A layout effect runs before children's
 * passive effects (the board's fit-to-view), which is what makes it safe.
 */
export function useStudioHydration() {
  useLayoutEffect(() => {
    migrateKey("polio.studio", "builder.studio");
    if (!useStudio.persist.hasHydrated()) void useStudio.persist.rehydrate();
  }, []);
}

/** The live preview address for a page; the home page has no suffix. */
export function livePath(pageId?: string): string {
  const s = useStudio.getState();
  const page = s.pages.find((p) => p.id === (pageId ?? s.activePageId)) ?? s.pages[0];
  const path = page?.path ?? "/";
  return "/builder/preview" + (path === "/" ? "" : path);
}
