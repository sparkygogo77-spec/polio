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
import { LEARN_DEFAULT, type LearnState } from "./learn";
import type { StandIn } from "./standIn";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { readDoc, writeDoc, unpackFrom } from "./docStore";
import { uid } from "@/core/lib/ids";
import { getFeature, setBrought } from "./catalog";
import { Boxes } from "lucide-react";
import { takeDoc, pictureLayersOff } from "./docTake";
import type { Taken } from "./reimport";
import type { SiteHead } from "./siteHead";
import { formatDefaults, type FormatValues } from "./format";
import { swapColour, swapFont, type ColourUse, type FaceTo } from "./siteColours";
import type { Palette } from "./look";
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
import type { WorkUse } from "./library/works";
import type { NodeArt, NodeColour, NodeEdge, NodeFont, NodeLayout, NodePad, NodeText } from "./parts/theme";
import type { NodeEmbed, NodeMotion } from "./parts/capturedMotion";
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
import { activeRepo } from "@/features/builds/store";
import { boundaryIn, inheritedFrom, lockLayout, placeLocked, spaceOf, tidyBoundary } from "./space";
import { plain, type Words } from "./parts/spans";
import type { Locked, Placed, Plan, Space } from "./space";
import { emptyWrappers, saysWhat, sentences, slimSays, slimWrappers, SWEEP, type Frag, type Reassembly, type Slimming } from "./reassemble";
import { paintSays, repaintActive, type Painted } from "./repaint";
import { twins, twinSays, type Twin } from "./twins";
import { grownSays, grownTo, type Grown, type Read } from "./owns";

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
  /**
   * The words this part draws — a plain string, or a sequence of runs.
   *
   * A run carries its own colour, weight, face and link, so a sentence with
   * one green word in it is ONE part instead of three. His price line came
   * in as four or five boxes that each wrapped on their own, and his header
   * split "A Sol Works project" into three where "Works" is a different
   * face; both are the same fault, and it is this field being flat.
   *
   * A plain string stays valid for ever: `spansOf` in `parts/spans.ts` turns
   * either into runs and `plain` turns either into text, so nothing saved
   * before this needs migrating and no part needs changing to keep working.
   */
  content: Words;
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
  /** `position`: the capture placed it out of the flow (absolute or fixed), so it sizes nothing that holds it. */
  from?: { url: string; host: string; selector: string; at: number; position?: "absolute" | "fixed" | "sticky"; inset?: { top?: number; right?: number; bottom?: number; left?: number } | null } | null;
  /**
   * HIS HAND PUT THIS BOX WHERE IT IS.
   *
   * The healing in `textFit.ts` moves boxes that were written down by a
   * machine — a capture's geometry, an older tidy's heights — and it must
   * never move one he placed himself. `from` was the first answer to "whose
   * is this box", and it is the wrong one: it is set only on the From-a-site
   * door, so a part that arrived any other way looked hand-placed and was
   * left to overlap for ever, which is exactly the board he was looking at.
   *
   * The question is asked the other way round now. A part is the machine's
   * unless somebody moved it: this is set when a part is added from the
   * library, the wheel or "add here", and when a part's box is dragged,
   * resized or typed into. A node carrying it is never grown, never shifted,
   * and never pushes anything.
   *
   * Optional, because a document saved before this existed carries it on
   * nothing. Those are settled once on hydration — see `onRehydrateStorage`
   * — which is what lets an old board heal itself rather than be
   * re-imported, and re-importing is what he ruled against: it throws away
   * everything he has changed since.
   */
  byHand?: boolean;
  /**
   * What a press on the page shows (sink `behaviours.states`): this part is
   * one of the parts a press puts in place of the page's own (gotchi.gg's
   * pup, in the panel, once pup's card is pressed). Not drawn where the page
   * opens — on the board, in the Preview or on the published page — until
   * the press shows it (`Show on press`); left alone by the sweep and the
   * healing, which read the page as it opens.
   */
  state?: { group: string; option: number } | null;
  /**
   * How this box is laid out, padded, edged and set, when a page said so.
   *
   * A captured page is mostly boxes, and a box on a page has a layout (a
   * row, a column, a grid), a padding, an edge and a way its words are set.
   * None of it could be carried: 37 layouts, 29 paddings and 13 edges went
   * "nowhere" in the ledger of his page. Optional, so a saved board and the
   * shelf's preview nodes need nothing added, and absent a part draws
   * exactly as it did. `blocks.tsx` puts them round the part on every
   * surface, `placeNodes` keeps a laid-out box's children inside it when
   * the page reflows, and the blueprint writes them as one `box:` line.
   */
  layout?: NodeLayout | null;
  pad?: NodePad | null;
  edge?: NodeEdge | null;
  /** Rounded corners the page gave the box, in px; drawn by the box wrapper (parts/theme.ts#boxStyle). */
  radius?: number | null;
  /** Transparency the page gave the box (0..1); drawn by the box wrapper. */
  opacity?: number | null;
  /** The artistic properties a capture recorded (blend, filter, transform, gradient, outlined type); drawn as written by the box wrapper. */
  art?: NodeArt | null;
  /** What the part did over time on the page it was captured from: animations, transitions, hover and focus (sink `node.motion`); replayed on the preview and the published page (`parts/capturedMotion.ts`). */
  motion?: NodeMotion | null;
  /** A frame of another page the capture found here (sink `node.embed`): an iframe on the preview and the published page, a still on the board. */
  embed?: NodeEmbed | null;
  text?: NodeText | null;
  /**
   * A feature from the library, working on this part (`library/works.ts`).
   *
   * Working code with no look of its own: the part draws as designed, and
   * the published page writes the feature's output into the part's own
   * element. Optional, so nothing saved before it needs migrating.
   */
  work?: WorkUse | null;
  /**
   * What the owner said this part should do that no feature covers yet, in
   * his words, for the repo-connected code chat to build. Its own field and
   * not `data`, because a capture writes its own description into `data`
   * ("button, named …") and that is not a task anybody asked for.
   */
  task?: string | null;
  /**
   * The owner typed this part's words in the one box. A live-data spot whose
   * words were chosen that way is decided, and loses its orange !
   * (`library/badge.ts`).
   */
  settled?: boolean;
}

export interface StudioGroup {
  id: string;
  pageId: string;
  label: string;
  prompt: string;
  hue: number;
  /**
   * Held together: picked as one, framed as one, sized as one, the members'
   * arrangement carried through a resize (`groupScale.ts`). Absent on every
   * group made before it existed, and absent means exactly what a group
   * always was.
   */
  locked?: boolean;
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
  /** Where this page's link preview differs from the site's (`brief.head`): its own title, description, share picture. */
  head?: SiteHead;
}

export interface StudioBrief {
  name: string;
  gimmick: string;
  master: string;
  /** What the site says about itself to a visitor: its meta description and link preview. Published, unlike the two above. */
  description?: string;
  /** The site's link preview: what a capture recorded in its head (sink `doc.head`), as edited in Link preview. Published by `siteHead.ts`. */
  head?: SiteHead;
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
  /** The board as it was brought in (`reimport.ts`): undone with the import that recorded it. */
  taken?: Taken | null;
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
 * Parts are counted too. A capture places a part where the site had it, and
 * sink's section pages have the SOL WORKS badge at y -11: the site's own
 * header lets it hang over the top. Leaving parts out was a barrier the
 * owner did not ask for. Measured on 2bbde72: the board keeps 20px of
 * ground over the page, so at the zoom it opens at the badge fitted, and
 * zoomed in to 3.03 its top 13px sat above the board where no scroll
 * reaches; a part at y -200 was 175px out of reach at any zoom.
 * The part is not moved and the page's origin does not move either: the
 * board reaches up to it, as it does to ink. `tests/part-above-reach.mjs`.
 */
export function frameTopReach(
  also: { nodes?: StudioNode[]; shapes?: StudioShape[]; spaces?: Space[] } = {},
  margin = 24,
): number {
  let top = 0;
  for (const n of also.nodes ?? []) top = Math.min(top, n.y);
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
  /*
   * WHICH REPOSITORY THIS SITE POINTS AT is not held here.
   *
   * It was, as `siteRepo`, and that was the bug: the GitHub control wrote
   * the choice here while the Sites list, the Builds page, Publish and the
   * Brief all read `project.repo` on the builds store, which only a publish
   * wrote. A site connected and never published showed "no repository"
   * however many times it was connected. The builds store is the one place
   * now; read it with `activeRepo()` or `useSiteRepo()`, and the old value
   * a saved document still carries is copied across once, on load.
   */
  /**
   * The branch this site's edits go to while it has a repository.
   *
   * HIS DESIGN, in his words: "would editing my own website create a
   * paradox? i think it should create a branchfirst and there should be a
   * seperate merge button". Not a paradox, but editing live is dangerous, so
   * the moment a site that points at a repository is edited it takes a
   * branch, every Publish goes there, and main does not move until he
   * presses Merge himself. Null means no branch is open: the next edit opens
   * one. Saved with the document, because it is part of the site.
   */
  siteBranch: string | null;
  setSiteBranch: (b: string | null) => void;
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
  /**
   * A write that is part of an edit already in the undo history, not an
   * edit of its own: a drawing's traced body arriving after the drawing
   * landed (`reshapeRun.ts`). No checkpoint, so one undo still takes the
   * whole drawing back.
   */
  updateNodeQuiet: (id: string, patch: Partial<StudioNode>) => void;
  updateNodes: (ids: string[], patch: Partial<StudioNode>) => void;
  /**
   * Give boxes the heights their words drew at, and move what is under
   * them down by the growth. One checkpoint for the lot: it is one tidy,
   * not one per box, and the import it follows is undone as it always was.
   */
  fitToWords: (fitted: { id: string; h: number; y: number }[]) => void;
  /**
   * The same repair, kept up rather than done once, and NOT a checkpoint.
   *
   * `fitToWords` is an edit: it follows an import, it is his to undo, and it
   * pushes one. This is the board noticing that a box is drawing taller than
   * the document says it is and writing down what is already on screen —
   * restoring the invariant rather than changing the page. Pushing a
   * checkpoint for each of those would fill the undo stack with steps that
   * undo nothing a person did, and one of them would put the overlap back.
   */
  settleToWords: (fitted: { id: string; h: number; y: number }[]) => void;
  /**
   * Put the sentences a capture broke into parts back together.
   *
   * Run when a document is taken in, and offered as a command for a board
   * that is already open. Returns what it joined so the caller can say it
   * out loud — his ruling is that a part he moved by hand IS merged inside a
   * sentence, and that every one taken is named. See `reassemble.ts`.
   */
  joinSentences: () => Reassembly[];
  /**
   * Fit every captured wrapper to what it actually holds, and drop the ones
   * holding nothing. See `slimWrappers`: the claim count and the geometry
   * disagree in both directions on his page, so only the geometry is read.
   */
  fitWrappers: () => Slimming[];
  /**
   * Which version of the rebuild rules this document has been through, or
   * absent for one that has been through none. The sweep on open reads it,
   * so a board is put right once rather than rewritten every time it opens.
   */
  swept?: number | null;
  /**
   * THE BOARD AS IT WAS BROUGHT IN, as hashes (`reimport.ts#fingerprint`):
   * recorded at the end of every import, after the sweep and the palette,
   * so bringing the site in again can tell what the owner changed since
   * from what the machine wrote, and keep his. Null on a board nobody
   * brought in, or one brought in before this was kept.
   */
  taken?: Taken | null;
  /**
   * WHAT THE SWEEP ON OPEN DID, IN WORDS, UNTIL SOMEBODY HAS SAID IT.
   *
   * Nothing in this file can publish a line of news, and hydration may
   * resolve after a Builder surface's own effects have run — so the sentence
   * is put here and watched for, rather than handed back from the hook.
   * Never saved: it belongs to this visit, and a board that announced itself
   * once must not announce itself again on the next reload.
   */
  sweepNote?: string | null;
  /**
   * Put the WHOLE document right: both rebuilds, every page, one checkpoint,
   * once. `force` runs it again on a board already marked. Returns what it
   * did, or null when there was nothing to do or the board was never
   * captured. See the action for the three promises it keeps.
   */
  sweepDocument: (force?: boolean) => { joined: Reassembly[]; grew: Grown[]; fitted: Slimming[]; painted: Painted[]; empty: Frag[]; doubled: Twin[] } | null;
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
  /**
   * What the drawn shape does. `fresh`: the part was made by this drawing a
   * moment ago. Only a fresh part may be replaced by the chain a line
   * draws; a part that was on the page before is never removed by a
   * drawing (`tests/draw-line-keeps-part.mjs`).
   */
  applyDrawnKind: (nodeId: string, role: DrawnRole, said?: string, opts?: { fresh?: boolean }) => { kind: DrawnKind; did: string };
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
  /**
   * WHAT THE BOARD ASKS A PANEL TO SHOW. Two presses on a text part want
   * the Element panel open on its words with the caret in them; Add page
   * wants the Pages panel open on the new page's name. The panel that
   * answers clears it.
   */
  wanted: { panel: "inspector" | "pages" | "look" | "motion"; focus?: "words" | "name"; id?: string; at: number } | null;
  want: (w: { panel: "inspector" | "pages" | "look" | "motion"; focus?: "words" | "name"; id?: string } | null) => void;
  hold: (nodeId: string | null) => void;
  /**
   * When he last opened the timeline.
   *
   * HIS WORDS: "green ones stay until timeline is opened." A finished action's
   * bar is the only thing that says the work landed, so it is not taken away
   * the instant it lands — it waits where he can see it until he goes to the
   * place that shows what happened. Persisted, because a reload is not him
   * looking.
   *
   * Zero means he has never opened it, and the strip reads that as "since
   * this page loaded" rather than as 1970: an old board would otherwise come
   * back with every iteration it has ever run sitting green in the header.
   */
  queueSeenAt: number;
  markQueueSeen: () => void;
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
    /** The iteration this picture landed as, when it was made from the panel. */
    threadId?: string;
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
  /** `keep`: bring it in over the board keeping what the owner changed (`reimport.ts`). */
  bringRepo: { space: string; repo: string; pageId?: string; keep?: boolean } | null;
  /** Learn on click: the presses a capture held back and the ones asked for (`learn.ts`). Kept with the board, never published. */
  learn: LearnState;
  setLearn: (next: LearnState | ((was: LearnState) => LearnState)) => void;
  /** The reads a capture recorded, with their samples (`standIn.ts`): answered by a built or published site only with the Build option Stand-in server on. */
  standIn: StandIn | null;
  setBringRepo: (v: { space: string; repo: string; pageId?: string; keep?: boolean } | null) => void;
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
  /** Hold a copy of these parts for paste, leaving them where they are. */
  copyNodes: (ids: string[]) => boolean;
  pasteNodes: () => boolean;
  cut: () => boolean;
  paste: () => boolean;
  setTool: (t: Tool) => void;
  setInk: (patch: { hue?: number; width?: number }) => void;
  setDrawKind: (kind: DrawKind) => void;
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
  /**
   * An import is one undo step (tests/bring-again.mjs). `historyMark` before
   * it starts; `oneStepSince(mark)` once it has landed folds every
   * checkpoint it took into the first, so one Ctrl+Z is the board before it.
   */
  historyMark: () => number;
  oneStepSince: (mark: number) => void;
  /**
   * Swap-all (`siteColours.ts`): recolour exactly the spots that wear `from`
   * — for one use, or every use — and the page when it wore it. One undo.
   * `palette` is the resolved one, so a part naming a role is read as what
   * it shows. Returns the parts it touched.
   */
  swapColourAll: (from: string, to: string, palette: Palette, opts?: { use?: ColourUse; only?: string[] }) => string[];
  /** Swap-all for a face: every part (and run) set in `from` set in `to`. One undo. */
  swapFontAll: (from: string, to: FaceTo, only?: string[], patch?: Record<string, number>) => string[];
  /** Each of these parts patched by its own function, as one undo: an edit made to a whole selection. */
  patchNodes: (ids: string[], fn: (n: StudioNode) => Partial<StudioNode>) => void;
  addMotion: () => string;
  updateMotion: (id: string, patch: Partial<MotionAsset>) => void;
  removeMotion: (id: string) => void;
  setMotionFrame: (id: string, at: number, src: string | null) => void;
  moveMotionFrame: (id: string, at: number, delta: number) => void;
  /** Put a crate on a part, where it plays as the part's picture; null takes it off. */
  attachMotion: (id: string, part: string | null) => void;
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
  /**
   * Go back (negative) or forward (positive) this many steps at once, as one
   * change of state: the history list's press. Fifty undos in a row would be
   * fifty saves of the whole document.
   */
  travel: (steps: number) => void;
  commit: () => void;
}

const HISTORY_LIMIT = 60;
/** Writes to the same field closer together than this are one edit, and one undo. */
export const EDIT_RUN_MS = 1500;
/** The fields a person types into on a part. A write to only these is an edit; anything else is a step of its own. */
const TYPED_FIELDS = new Set(["prompt", "content", "data", "label"]);
/** A crate's settings that are typed or dragged: a run of writes to one is one edit. The rest (on or off, how it plays) is a step each. */
const MOTION_RUNS = new Set(["name", "duration", "hold", "gaps", "use"]);

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

/** The document as a step in the history holds it: what undo puts back. */
export function snapshot(s: StudioState): Doc {
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
    taken: s.taken ?? null,
  };
}

/**
 * The nodes a set of rebuilt sentences leaves behind.
 *
 * Pure and shared, because the palette command and the sweep on open must
 * never drift: one of them quietly doing something different to a document
 * is exactly the kind of thing nobody notices until a board is wrong.
 */
function withJoins(nodes: StudioNode[], done: readonly Reassembly[]): StudioNode[] {
  const dropped = new Set(done.flatMap((d) => d.drop));
  const by = new Map(done.map((d) => [d.keep, d]));
  return nodes
    .filter((n) => !dropped.has(n.id))
    .map((n) => {
      const d = by.get(n.id);
      if (!d) return n;
      /* The box is the capture's composite now, not where he dragged a piece
         of it, so it stops being marked his and the healing may lay what
         follows under it again. */
      const { byHand: _was, ...rest } = n;
      return { ...rest, content: d.spans, x: d.x, y: d.y, w: d.w, h: d.h };
    });
}

/**
 * The nodes with each adrift wrapper put back round what it owns.
 *
 * Out, never in: every one of these lifts a box or makes it bigger, and the
 * guard against a rule that could shrink is in `grownTo` rather than here,
 * because the shrinking rule is the one that strips padding from 29 wrappers
 * in 31.
 */
function withGrown(nodes: StudioNode[], done: readonly Grown[]): StudioNode[] {
  const by = new Map(done.map((g) => [g.id, g]));
  return nodes.map((n) => {
    const g = by.get(n.id);
    return g ? { ...n, x: g.x, y: g.y, w: g.w, h: g.h } : n;
  });
}

/**
 * The nodes with each duplicated box's spare copy taken out.
 *
 * SAFE FOR ONE REASON ONLY: an identical twin remains in its place, which
 * `twins` proves rather than assumes. This is deliberately NOT the
 * empty-wrapper rule and shares no code with it: an empty wrapper that has
 * slid below its contents must be repositioned and must never be removed.
 */
function withoutTwins(nodes: StudioNode[], done: readonly Twin[]): StudioNode[] {
  const going = new Set(done.map((t) => t.id));
  const staying = new Set(nodes.map((n) => n.id));
  /* The twin has to actually be here. If it is not, nothing goes. */
  if (done.some((t) => !staying.has(t.keeps) || going.has(t.keeps))) return nodes;
  /*
   * AND THE ONE THAT STAYS KEEPS WHAT THE CAPTURE SAID ABOUT THEIR BOX. Two
   * parts in one box share its placement, so a spare taken out that was out of
   * the flow (`from.position`) leaves that fact on the part that remains. His
   * SOL WORKS badge carries the flag on its wrapper, not on the image; the
   * wrapper goes as the image's twin, and without this the next sweep over the
   * saved document — or his board published and brought back — met an
   * unflagged image and grew the header round it again (`tests/twin-flag.mjs`).
   */
  const flagOf = new Map<string, "absolute" | "fixed" | "sticky">();
  for (const t of done) {
    const gone = nodes.find((n) => n.id === t.id)?.from?.position;
    if (gone) flagOf.set(t.keeps, gone);
  }
  return nodes
    .filter((n) => !going.has(n.id))
    .map((n) => {
      const flag = flagOf.get(n.id);
      return flag && n.from && !n.from.position ? { ...n, from: { ...n.from, position: flag } } : n;
    });
}

/**
 * The nodes with the active controls' dropped tint put back.
 *
 * The colour goes in `bg`, which is the role the WRAPPER fills from, so it
 * reaches the node's edge rather than stopping at the words — see the note in
 * `repaint.ts`, which measures the two routes against each other. Nothing
 * else about the node is touched: not its accent, which is still the tint's
 * own colour and its border's, and not its variant.
 */
function withPaint(nodes: StudioNode[], done: readonly Painted[]): StudioNode[] {
  const by = new Map(done.map((d) => [d.id, d]));
  return nodes.map((n) => {
    const d = by.get(n.id);
    return d ? { ...n, colour: { ...(n.colour ?? {}), bg: d.paint } } : n;
  });
}

/**
 * The nodes a set of fitted wrappers leaves behind.
 *
 * Nothing is removed. A box that holds nothing is misplaced rather than junk
 * — see `emptyWrappers` — so this only ever changes a height, and only ever
 * downward from what the capture recorded.
 */
function withFits(nodes: StudioNode[], done: readonly Slimming[]): StudioNode[] {
  const fit = new Map(done.map((d) => [d.id, d.h]));
  return nodes.map((n) => { const h = fit.get(n.id); return h === undefined ? n : { ...n, h }; });
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

/*
 * Whether a swap between sites is in flight.
 *
 * `swapDoc` replaces the whole document in one synchronous go, and while it
 * does the store passes through states that belong to neither site. Nothing
 * of that may reach the live key, because the live key is what the projects
 * store copies into a site's own slot — and one site's work landing in
 * another site's slot is the fault this exists to make impossible, not a
 * cosmetic one. So the pen is held for the length of the swap and the caller
 * writes the live key itself, once, with the document it means.
 */
let studioSwapping = false;

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

/*
 * WHEN THE BOARD WAS LAST CHANGED BY A PERSON, told to whoever asks.
 *
 * Every edit takes a checkpoint (`push`) or rides one (`pushEdit`), and undo,
 * redo and a jump in the history change the board too; each of those calls
 * this. What the board does to itself (a settle, a quiet write) does not,
 * so "changed since it was published" means a person changed it. The Builds
 * page reads the time off the site (`builds/edits.ts`), never the document.
 */
const editListeners = new Set<() => void>();
export function onBoardEdit(fn: () => void): () => void {
  editListeners.add(fn);
  return () => { editListeners.delete(fn); };
}
const edited = () => { for (const fn of editListeners) { try { fn(); } catch { /* a listener's trouble is its own */ } } };

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => {
      /** How many undo checkpoints have been taken, ever: `oneStepSince` counts from it. */
      let pushes = 0;
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
            doc: { ...snapshot(st), taken: undefined } as ThreadDoc,
            state: "done" as const,
            pieces: [],
          }, ...st.threads],
          liveThreadId: st.liveThreadId,
        }));
      };

      const push = () => {
        seed();
        run = null;
        pushes++;
        edited();
        set((s) => ({
          past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
          future: [],
          /* THE BRANCH OPENS THE MOMENT HE STARTS EDITING. An undo checkpoint
             is an edit by definition, so this is where a site with a
             repository and no open branch takes one. Named by the site and
             the day, so two sites and two days never collide. */
          ...(activeRepo() && !s.siteBranch ? { siteBranch: `edit/${(s.brief?.name || "site").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "site"}-${new Date().toISOString().slice(0, 10)}` } : {}),
        }));
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
        if (run && run.key === key && now - run.at < EDIT_RUN_MS) { run.at = now; edited(); return; }
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
        wanted: null,
        queueSeenAt: 0,
        tool: "select",
        inkHue: 265,
        inkWidth: 3,
        drawKind: "part",
        siteBranch: null,
        zoom: 1,
        fitAt: ZOOM_MIN,
        pan: { x: 0, y: 0 },
        showAllFormat: false,
        showWires: true,
        hiddenFeatures: [],
        brought: [],
        broughtParts: [],
        taken: null,
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
            /* Whose box this is. Everything added through the library, the
               wheel or "add here" is his; only a part carrying the page it
               was read off is the machine's, and only those are healed. */
            const mine = !patch?.from;
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
                ...(mine ? { byHand: true } : {}),
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

        updateNodeQuiet: (id, patch) => set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),

        updateNodes: (ids, patch) => {
          push();
          const set_ = new Set(ids);
          set((s) => ({ nodes: s.nodes.map((n) => (set_.has(n.id) ? { ...n, ...patch } : n)) }));
        },

        /*
         * The second half of "captured geometry is a starting size": the
         * boxes have already grown on screen, because the part draws at the
         * size its words need, and this writes those heights down and moves
         * the page under them so nothing overlaps.
         *
         * A convenience, NOT the guarantee. These numbers are measured
         * against whatever face resolved at the moment of the import; the
         * thing that keeps words visible afterwards is the CSS floor in
         * `parts/primitives.tsx`, which cannot go stale. Nothing downstream
         * should read a stored height as the truth about how tall a box has
         * to be.
         */
        fitToWords: (fitted) => {
          if (!fitted.length) return;
          push();
          const by = new Map(fitted.map((f) => [f.id, f]));
          set((s) => ({ nodes: s.nodes.map((n) => { const f = by.get(n.id); return f ? { ...n, h: f.h, y: f.y } : n; }) }));
        },

        settleToWords: (fitted) => {
          if (!fitted.length) return;
          const by = new Map(fitted.map((f) => [f.id, f]));
          set((s) => {
            let moved = false;
            const nodes = s.nodes.map((n) => {
              const f = by.get(n.id);
              if (!f || (f.h === n.h && f.y === n.y)) return n;
              moved = true;
              return { ...n, h: f.h, y: f.y };
            });
            // Nothing to say is said by changing nothing: a new array here
            // would re-render the board and be measured again for ever.
            return moved ? { nodes } : {};
          });
        },

        joinSentences: () => {
          const done = sentences(get().nodes as unknown as Frag[]);
          if (!done.length) return [];
          /* One checkpoint for the lot: it is one rebuild, and his to undo
             if he does not like what it did to a line he had arranged. */
          push();
          set((s) => ({ nodes: withJoins(s.nodes, done) }));
          return done;
        },

        fitWrappers: () => {
          const done = slimWrappers(get().nodes as unknown as Frag[]);
          if (!done.length) return [];
          push();
          set((s) => ({ nodes: withFits(s.nodes, done) }));
          return done;
        },

        /*
         * THE WHOLE DOCUMENT, ONCE, WHEN IT IS OPENED.
         *
         * HIS WORDS about boxes coming out wrong: "it should be done
         * automatically properly". The two rebuilds above are correct and
         * reach a stored board, but only when a person presses them — so a
         * board captured before they existed sat unchanged, and the only
         * cheap fix on offer was two commands per page across nine pages,
         * which is a chore rather than a fix.
         *
         * Three things this must be, and every one of them is a promise to
         * somebody whose document is being rewritten without being asked:
         *
         *  - EVERY PAGE, not the one on screen. That is the entire reason it
         *    is worth having; `sentences` already groups per page and
         *    `slimWrappers` already keeps containment within a page, so the
         *    work is to hand them the whole document and never a slice.
         *  - ONE CHECKPOINT for the lot. Removing parts automatically is
         *    only acceptable if a single undo puts every one of them back,
         *    so the checkpoint is taken once, before either pass, and
         *    neither pass takes its own.
         *  - ONCE PER DOCUMENT. A board already swept is left alone on every
         *    later open, marked with the version of the rules it went
         *    through (`SWEEP`), so bumping that number is the whole of
         *    "sweep them all again".
         *
         * The safeguards under it are the passes' own and are not relaxed
         * here: nothing his hand placed is touched, a wrapper showing a
         * surface of its own is never removed, and only a box's bottom moves.
         *
         * The joins run FIRST, because a join removes parts and resizes the
         * one that stays. The repaint runs last and cannot disagree with
         * either: it only ever changes paint. Nothing here fits a box to what
         * it holds any more — see the note where the fitting used to run.
         */
        sweepDocument: (force) => {
          const s0 = get();
          /*
           * AT OR PAST these rules, and it is left alone. Written as `>=`
           * rather than `===` because a document a NEWER build has swept must
           * not be swept again by an older one: an exact match reads a mark
           * it does not recognise as "never swept" and runs the whole thing
           * over a board that has already been past it.
           */
          if (!force && (s0.swept ?? 0) >= SWEEP) return null;
          /*
           * A BOARD NOBODY CAPTURED IS NOT SWEPT, and is marked so it is
           * never asked again. The same question `onRehydrateStorage` asks
           * about whose boxes these are: a repository or site brought in, or
           * a part carrying the element it was read from, its layout, its
           * padding, its edge or the way its words are set. None of those and
           * the board is his, drawn and placed, and nothing here applies.
           */
          const captured = (s0.brought?.length ?? 0) > 0
            || s0.nodes.some((n) => n.from || n.layout || n.pad || n.edge || n.text);
          if (!captured) { set({ swept: SWEEP }); return null; }

          /* The page as it opens: a part a press shows (`state`) sits where the part it stands in for does, and is neither joined, grown round, nor a twin of it. It is kept as it is. */
          const pressed = s0.nodes.filter((n) => n.state);
          const opens = pressed.length ? s0.nodes.filter((n) => !n.state) : s0.nodes;
          const joined = sentences(opens as unknown as Frag[]);
          const afterJoin = joined.length ? withJoins(opens, joined) : opens;
          /*
           * A WRAPPER PUT BACK ROUND THE PARTS IT OWNS, read off the DOM path
           * the capture recorded rather than off geometry (`owns.ts`).
           *
           * Read from the document AS SAVED, like the dedupe, because the
           * capture is the authority on what owns what. It only ever lifts
           * or grows a box, never shrinks one: a deletion may only ever be
           * justified by something the capture said, and so may a box made
           * smaller.
           */
          const grew = grownTo(opens as unknown as (Frag & Read)[])
            .filter((g) => afterJoin.some((n) => n.id === g.id));
          const afterGrow = grew.length ? withGrown(afterJoin, grew) : afterJoin;

          /*
           * AND NOTHING IS FITTED. Measured on sink's document: of the 56
           * boxes the fitting shrank, all 56 were as tall as the capture said
           * for a reason the capture records — a fixed rail's viewport height,
           * a column's min-height, a row's stretch, a sized button centring
           * its icon, a line's line-height — and not one held dead space. On
           * his board it took the sidebar rail from 1281 to the 440 of the nav
           * inside it. Shrinking a captured box undoes a measurement, the same
           * error as replacing a wrapper with its contents' box (29 of 31
           * flags there were padding). The fitting stays a command a person
           * runs on purpose; the sweep does not run it for him.
           */
          const fitted: Slimming[] = [];
          const afterFit = afterGrow;
          /* Reported, never removed: both of the empty wrappers on his home
             page are real surfaces that slid below their own contents. */
          const empty = emptyWrappers(afterFit as unknown as Frag[]);
          /*
           * AND THE SAME BOX EMITTED TWICE. A separate pass from the wrapper
           * one above, and separate on purpose: a duplicate may be removed
           * because its twin remains, which is a test; an empty wrapper may
           * not be removed at all. `offered` no longer emits the pair, which
           * reaches a new capture; this is the retrofit for a board already
           * written down.
           */
          /*
           * READ OFF THE DOCUMENT AS IT WAS SAVED, not off the result of the
           * passes above — and that is not tidiness, it is the difference
           * between safe and not. Fitting a wrapper CHANGES A HEIGHT, and two
           * boxes the capture recorded 97px apart can be left the same height
           * by it. A dedupe reading that result would see a twin the page
           * never had and delete a node on the strength of a size WE chose.
           * A box may only be removed for something the CAPTURE said, never
           * for a consequence of our own editing — the same rule that keeps
           * the wrapper pass to one pass.
           */
          const doubled = twins(opens as unknown as Frag[])
            .filter((t) => afterFit.some((n) => n.id === t.id) && afterFit.some((n) => n.id === t.keeps));
          /*
           * AND THE PAINT THE CAPTURE DROPPED. The other lane taught the
           * converter to read `oklab()`, which reaches a new capture and
           * nothing at all on a board already written down — so on his the
           * whole correction is a colour and a variant, worked out from what
           * the document still holds (`repaint.ts`).
           *
           * The page's own background goes in with it, because his docs
           * sidebar has NO painted box anywhere behind its entries — the tint
           * went straight onto the page, and without this the correction
           * would be skipped there in silence.
           */
          const painted = repaintActive(afterFit as unknown as Frag[], s0.look?.palette?.bg ?? null);
          if (!joined.length && !grew.length && !fitted.length && !painted.length && !empty.length && !doubled.length) { set({ swept: SWEEP }); return null; }

          /* The one checkpoint, taken before anything moves. */
          push();
          set({
            nodes: [...withoutTwins(painted.length ? withPaint(afterFit, painted) : afterFit, doubled), ...pressed],
            swept: SWEEP,
            /* Said out loud, because a board that quietly loses six parts
               between one visit and the next is worse than one that never
               lost them — and the line is how he knows there is an undo. */
            sweepNote: `${[joined.length ? saysWhat(joined) : "", grew.length ? grownSays(grew) : "", fitted.length || empty.length ? slimSays(fitted, empty) : "", painted.length ? paintSays(painted) : "", doubled.length ? twinSays(doubled) : ""].filter(Boolean).join(" ")} One undo takes all of it back.`,
          });
          return { joined, grew, fitted, painted, empty, doubled };
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
        want: (w) => set({ wanted: w ? { ...w, at: Date.now() } : null }),

        markQueueSeen: () => set({ queueSeenAt: Date.now() }),

        setCubeTurn: (nodeId, turn) =>
          set((s) => ({
            nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, cube: { ...(n.cube ?? emptyCube()), turn } } : n)),
          })),

        setMeshTurn: (nodeId, turn) =>
          set((s) => ({
            nodes: s.nodes.map((n) => (n.id === nodeId && n.mesh ? { ...n, mesh: { ...n.mesh, turn } } : n)),
          })),

        applyDrawnKind: (nodeId, role, said = "", opts = {}) => {
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

          if (role.kind === "connector" && !opts.fresh) {
            /* A part that was here before the line: never removed, only marked. */
            set((s) => ({ nodes: s.nodes.map((n) => (n.id === node.id ? { ...n, kind: "connector" } : n)) }));
            return { kind: "connector", did: "" };
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
            const content = plain(node.content).trim() || Array.from({ length: rows }, (_, i) => `Row ${i + 1}`).join(", ");
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
        learn: LEARN_DEFAULT,
        setLearn: (next) => set((s) => ({ learn: typeof next === "function" ? next(s.learn ?? LEARN_DEFAULT) : next })),
        standIn: null,
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
            /* The first number nothing is using, not the count plus one: the
               count goes down when a page is deleted, and Home, Page 2, Page 3
               less Page 2 then added a second Page 3 on /page-3 — one route,
               two pages, and the export wrote the second over the first. */
            const slug = (t: string) => "/" + t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            const names = new Set(s.pages.map((p) => p.name.trim().toLowerCase()));
            const paths = new Set(s.pages.map((p) => p.path));
            let n = s.pages.length + 1;
            if (!name) while (names.has(`page ${n}`) || paths.has(`/page-${n}`)) n++;
            const label = name ?? `Page ${n}`;
            let path = slug(label);
            for (let k = 2; paths.has(path); k++) path = `${slug(label)}-${k}`;
            return {
              pages: [...s.pages, { id, name: label, path, prompt: "", scroll: "inherit" }],
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
        copyNodes: (ids) => {
          const nodes = get().nodes.filter((n) => ids.includes(n.id));
          if (!nodes.length) return false;
          held = { kind: "nodes", nodes };
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
        setSiteBranch: (b) => set({ siteBranch: b?.trim() || null }),
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
        /* Every change to a crate is one undo step: a run of writes to the same
           setting (a slider dragged, a name typed) is one edit, as a part's words are. */
        updateMotion: (id, patch) => {
          const keys = Object.keys(patch);
          if (keys.length && keys.every((k) => MOTION_RUNS.has(k))) pushEdit(`motion:${id}:${keys.sort().join(",")}`);
          else push();
          set((st) => ({ motion: st.motion.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
        },
        removeMotion: (id) => {
          push();
          set((st) => ({ motion: st.motion.filter((m) => m.id !== id) }));
        },
        setMotionFrame: (id, at, src) => {
          push();
          set((st) => ({
            motion: st.motion.map((m) =>
              m.id === id ? { ...m, frames: m.frames.map((f, i) => (i === at ? src : f)) } : m,
            ),
          }));
        },
        // Sleeves swap rather than shuffle: pulling one out and putting it back
        // one place along is what reordering a crate actually is.
        moveMotionFrame: (id, at, delta) => {
          push();
          set((st) => ({
            motion: st.motion.map((m) => {
              if (m.id !== id) return m;
              const to = at + delta;
              if (to < 0 || to >= m.frames.length) return m;
              const frames = [...m.frames];
              [frames[at], frames[to]] = [frames[to]!, frames[at]!];
              return { ...m, frames };
            }),
          }));
        },
        /* A part wears one crate at a time: putting a second on it takes the first off. One undo. */
        attachMotion: (id, part) => {
          push();
          set((st) => ({
            motion: st.motion.map((m) => (m.id === id ? { ...m, part } : part && m.part === part ? { ...m, part: null } : m)),
          }));
        },
        historyMark: () => pushes,
        oneStepSince: (mark) => {
          /* Every checkpoint taken since `mark` after the first is folded into
             the first: what one undo takes back is the board before it began. */
          const extra = pushes - mark - 1;
          if (extra <= 0) return;
          pushes -= extra;
          set((s) => ({ past: s.past.slice(0, Math.max(0, s.past.length - extra)), future: [] }));
        },
        setLook: (patch) => {
          push();
          set((s) => ({ look: { ...s.look, ...patch } }));
        },
        swapColourAll: (from, to, palette, opts = {}) => {
          const s = get();
          const r = swapColour(s.nodes, palette, from, to, { use: opts.use, only: opts.only ? new Set(opts.only) : undefined });
          if (!r.changed.length) return [];
          push();
          set((st) => ({ nodes: r.nodes, ...(r.pageBg ? { look: { ...st.look, palette: { ...st.look.palette, bg: r.pageBg } } } : {}) }));
          return r.changed;
        },
        patchNodes: (ids, fn) => {
          push();
          const set_ = new Set(ids);
          set((s) => ({ nodes: s.nodes.map((n) => (set_.has(n.id) ? { ...n, ...fn(n) } : n)) }));
        },
        swapFontAll: (from, to, only, patch) => {
          const r = swapFont(get().nodes, from, to, only ? new Set(only) : undefined, patch);
          if (!r.changed.length) return [];
          push();
          set({ nodes: r.nodes });
          return r.changed;
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
                  doc: { ...snapshot(s), taken: undefined } as ThreadDoc,
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
                doc: { ...snapshot(s), taken: undefined } as ThreadDoc,
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
            edited();
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
            edited();
            run = null;
            return {
              ...next,
              past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
              future: s.future.slice(1),
              selection: [],
              activePageId: next.pages.some((p) => p.id === s.activePageId) ? s.activePageId : next.pages[0]!.id,
            };
          }),

        travel: (steps) =>
          set((s) => {
            if (!steps || (steps < 0 ? !s.past.length : !s.future.length)) return {};
            run = null;
            edited();
            const doc = snapshot(s);
            if (steps < 0) {
              const n = Math.min(-steps, s.past.length);
              if (!n) return {};
              const to = s.past[s.past.length - n]!;
              /* The documents stepped over go onto redo in order: nearest first. */
              const over = [...s.past.slice(s.past.length - n + 1), doc];
              return {
                ...to,
                past: s.past.slice(0, s.past.length - n),
                future: [...over, ...s.future].slice(0, HISTORY_LIMIT),
                selection: [],
                activePageId: to.pages.some((p) => p.id === s.activePageId) ? s.activePageId : to.pages[0]!.id,
              };
            }
            const n = Math.min(steps, s.future.length);
            if (!n) return {};
            const to = s.future[n - 1]!;
            return {
              ...to,
              past: [...s.past, doc, ...s.future.slice(0, n - 1)].slice(-HISTORY_LIMIT),
              future: s.future.slice(n),
              selection: [],
              activePageId: to.pages.some((p) => p.id === s.activePageId) ? s.activePageId : to.pages[0]!.id,
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
      /*
       * THE DOCUMENT LIVES IN INDEXEDDB (docStore.ts), with localStorage
       * beside it: a mirror of what fits, a pointer for what does not.
       * share.xyz's three pages are 8.5 MB, past localStorage's quota; the
       * save threw inside the import, which stopped before its pictures
       * were kept. A document already in localStorage is read from there
       * and carried across, so what was on the board before this stays.
       */
      storage: createJSONStorage(() => ({
        getItem: (k) => readDoc(k),
        setItem: (k, v) => { if (!studioRead || studioSwapping) return; writeDoc(k, v); },
        removeItem: (k) => { writeDoc(k, null); },
      })),
      merge: (persisted, current) => mergeDoc(persisted, current as StudioState),
      partialize: docOnly,
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
        /*
         * WHOSE BOXES ARE THESE, ON A DOCUMENT THAT PREDATES THE QUESTION.
         *
         * Nothing saved before `byHand` carries it, so without this every
         * board that already exists would be treated as the machine's and
         * healed — including one he laid out entirely by hand, where two
         * parts deliberately over each other is a design and not a fault.
         *
         * So the document is asked once whether it came off a page at all. A
         * repository or site brought into it, a part carrying the element it
         * was read from, or a box carrying a layout, a padding, an edge or a
         * way its words are set — those four are written by a capture and by
         * nothing else in the app. No sign of any of it and the board is his:
         * every part is marked and nothing will ever move.
         *
         * A board that DID come off a page heals, and its parts are left
         * unmarked even if he moved some of them before today, because
         * nothing recorded that he did. That is the one place this cannot
         * keep its promise, and it is bounded: the healing only ever moves a
         * part DOWN, to clear what is above it. It cannot put a part back
         * where the capture had it, and from now on every move he makes is
         * marked as his.
         */
        {
          const cameOffAPage = (state.brought?.length ?? 0) > 0
            || (state.nodes ?? []).some((n) => n.from || n.layout || n.pad || n.edge || n.text);
          if (!cameOffAPage) for (const n of state.nodes ?? []) if (n.byHand === undefined) n.byHand = true;
        }
        const stuck = state.threads.some((t) => t.state === "running");
        if (stuck) state.threads = state.threads.map((t) => (t.state === "running" ? { ...t, state: "cut" as const } : t));
      },
    },
  ),
);


/* ------------------------------------------------------------------ */
/* Loading a document                                                  */
/* ------------------------------------------------------------------ */

/**
 * The part of the store that IS the document.
 *
 * Named rather than inline because two things need it and they must never
 * drift: the persister, which writes it out, and `PRISTINE`, which is what a
 * site with nothing saved has to be loaded as. A key added here is saved and
 * blanked by the same edit.
 */
function docOnly(s: StudioState) {
  return {
        pages: s.pages,
        nodes: s.nodes,
        /* His drawings survive leaving the tab, which is the whole point of them. */
        draws: s.draws,
        /* When he last opened the timeline, so a finished action's green bar
           waits for him rather than for a reload. Per site, like the rest of
           the document: each site has its own timeline. */
        queueSeenAt: s.queueSeenAt,
        groups: s.groups,
        shapes: s.shapes,
        spaces: s.spaces,
        learn: s.learn,
        standIn: s.standIn ?? null,
        format: s.format,
        brief: s.brief,
        look: s.look,
        motion: s.motion,
        activePageId: s.activePageId,
        /* Saved, because "once per document" is a promise that has to
           survive the reload it is protecting against. */
        swept: s.swept,
        /* The record a later "keep my changes" import reads; part of the site, like the sweep's mark. */
        taken: s.taken ?? null,
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
        /* The open edit branch is part of the site, not part of where
           somebody is looking, so it is saved with the document. Which
           repository it belongs to is the builds store's, not this one's. */
        siteBranch: s.siteBranch,
  };
}

/**
 * A saved document, read onto a base.
 *
 * Named for the same reason. The persister hands it the live store as the
 * base; `swapDoc` hands it a pristine one, which is the difference between
 * "fill in what this document does not mention" and "let the last site's
 * work show through the gaps".
 */
function mergeDoc(persisted: unknown, current: StudioState): StudioState {
        const { siteRepo: was, ...p } = (persisted ?? {}) as Partial<StudioState> & { siteRepo?: unknown };
        /* A document saved before the builds store held the repository still
           names one. Kept aside for the builds store to copy across, and
           never spread into the state, where nothing reads it any more. */
        carried = typeof was === "string" && was.trim() ? was.trim() : null;
        return {
          ...current,
          ...p,
          nodes: (p.nodes ?? current.nodes).map((n) => ({
            ...n, content: n.content ?? "", link: n.link ?? null,
            /* A path packed for the localStorage mirror (docStore.ts) is the path it was. */
            from: n.from ? unpackFrom(n.from as { selector?: string; sel?: string } & Record<string, unknown>) as typeof n.from : n.from, data: n.data ?? "", colour: n.colour ?? null, font: n.font ?? null, anim: n.anim ?? null,
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
              // A layer a picture wears is the picture's, not the page's (`docTake.ts`).
              texture: pictureLayersOff(p.nodes ?? current.nodes, look.texture.map((l) => ({ ...l, target: l.target ?? look.target ?? "page" }))),
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
}

/**
 * The document a site with nothing saved has.
 *
 * Taken once, from the store's own initial state, before anything can have
 * hydrated — `skipHydration` is what makes that safe. Deep-copied, so a
 * later edit to the live document can never reach back and change what
 * "empty" means.
 */
const PRISTINE: ReturnType<typeof docOnly> = JSON.parse(JSON.stringify(docOnly(useStudio.getState())));

/**
 * Put a site's saved document into the store, synchronously.
 *
 * WHAT THIS REPLACES AND WHY. Switching sites used to copy the target's
 * document into the live key and call `persist.rehydrate()`. That works for
 * a site that has something saved and does nothing at all for one that does
 * not: zustand only runs `merge` when there IS persisted state, so
 * rehydrating from nothing leaves the store exactly as it was — still
 * holding the last site's work. Measured: three sites, one part each, and
 * the third site's slot came back reading `waypoint,split-screen` when
 * `split-screen` was the only part ever made on it. The board showed the
 * previous site's work, and the first edit wrote it out under the new site's
 * name. An empty slot cannot overwrite a full store.
 *
 * So the load does not go through the persister at all. It is synchronous —
 * no await anywhere in it, so nothing can observe the store mid-swap — and
 * it merges onto PRISTINE rather than onto the live state, which is the part
 * that actually matters: merging onto the live state is precisely how the
 * last site shows through wherever this document is silent.
 *
 * `raw` is the stored envelope as it sits in local storage, or null for a
 * site that has never been saved. Null is not a failure; it is the answer,
 * and the answer is a blank board.
 */
/**
 * The repository a document named for itself, before the builds store was
 * the one place for it. Set by every load, read once by the builds store's
 * copy across, and gone after that.
 */
/**
 * Where a Bring began in the undo history (`historyMark`), taken by the
 * import when it lands: the space the Bring placed, the board it replaced
 * and everything the landing does are then one undo step.
 */
let importMark: number | null = null;
export function holdImportMark(mark: number): void { importMark = mark; }
export function takeImportMark(): number | null { const m = importMark; importMark = null; return m; }

let carried: string | null = null;
export function takeCarriedRepo(): string | null {
  const it = carried;
  carried = null;
  return it;
}

export function swapDoc(raw: string | null): void {
  studioSwapping = true;
  try {
    /* A fresh copy every time: `mergeDoc` may hand parts of the base
       straight through, and PRISTINE must stay the thing it was. */
    const blank = JSON.parse(JSON.stringify(PRISTINE)) as Partial<StudioState>;
    const base = { ...useStudio.getState(), ...blank } as StudioState;
    let doc: StudioState = base;
    if (raw) {
      try {
        const env = JSON.parse(raw) as { state?: unknown };
        doc = mergeDoc(env?.state ?? null, base);
      } catch {
        /* A slot that will not parse is a slot with nothing readable in it.
           A blank board is the honest answer; the bad text is left where it
           is rather than tidied away, so it can still be looked at. */
        doc = base;
      }
    }
    useStudio.setState({
      ...doc,
      /* Not the document, and all of it about the site being left: a
         selection of parts that no longer exist, and an undo history that
         would step this site's board back into the last one's. */
      selection: [],
      past: [],
      future: [],
    });
    /* The same two things `onRehydrateStorage` does after a read, because
       this is a read — it just did not come through the persister. */
    const now = useStudio.getState();
    shelve(now.brought ?? [], now.broughtParts ?? []);
    if (now.threads.some((t) => t.state === "running")) {
      useStudio.setState({ threads: now.threads.map((t) => (t.state === "running" ? { ...t, state: "cut" as const } : t)) });
    }
  } finally {
    studioSwapping = false;
  }
}

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

/** Two surfaces mounting must not both try the sweep on one page load. */
let sweeping = false;

/**
 * The store skips hydration so server and first client render agree; every
 * Builder surface calls this once so the saved document comes back before the
 * board's own effects write anything. A layout effect runs before children's
 * passive effects (the board's fit-to-view), which is what makes it safe.
 *
 * AND THE SWEEP GOES HERE, for the same reason: it must see the document as
 * it was saved. His words about boxes coming out wrong were "it should be
 * done automatically properly", and a board captured before the rebuilds
 * existed sat unchanged until somebody pressed two commands on each of nine
 * pages. It runs once per document, over every page, under one undo — see
 * `sweepDocument`.
 *
 * Before the healing rather than after, and that is deliberate: the healing
 * only ever runs for the page on screen, so a sweep that waited for it would
 * judge the open page by settled heights and the other eight by captured
 * ones, and give a different answer per page for no reason a person could
 * see. Reading the document as it was saved is the same answer everywhere.
 */
export function useStudioHydration() {
  useLayoutEffect(() => {
    migrateKey("polio.studio", "builder.studio");
    if (sweeping) return;
    sweeping = true;
    const sweep = () => { useStudio.getState().sweepDocument(); };
    if (useStudio.persist.hasHydrated()) { sweep(); return; }
    /* Hydration may resolve after this surface's own effects have run, so
       what the sweep did is put in the document's state and watched for
       rather than handed back here — see `sweepNote`. */
    void Promise.resolve(useStudio.persist.rehydrate()).then(sweep);
  }, []);
}

/** The live preview address for a page; the home page has no suffix. */
export function livePath(pageId?: string): string {
  const s = useStudio.getState();
  const page = s.pages.find((p) => p.id === (pageId ?? s.activePageId)) ?? s.pages[0];
  const path = page?.path ?? "/";
  return "/builder/preview" + (path === "/" ? "" : path);
}
