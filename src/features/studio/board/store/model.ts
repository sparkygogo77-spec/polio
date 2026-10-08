"use client";
import type { Taken } from "../../reimport";
import type { SiteHead } from "../../siteHead";
import { type FormatValues } from "../../format";
import { type AnimEase, type AuraStyle, type Look } from "../../look";
import { type MotionAsset } from "../../motion";
import type { NodeLink } from "../../parts/types";
import type { WorkUse } from "../../library/works";
import type { NodeArt, NodeColour, NodeEdge, NodeFont, NodeLayout, NodePad, NodeText } from "../../parts/theme";
import type { NodeEmbed, NodeMotion } from "../../parts/capturedMotion";
import { type OutlineClip, type Sketch } from "../../sketch";
import type { LookPicture } from "../../partPicture";
import type { Worn } from "../../wornShape";
import type { Remixed } from "../../remix";
import type { DrawnKind } from "../../shapeKind";
import type { DrawnVector, VectorRole } from "../../vector";
import { type CubeData } from "../../parts/cubeFaces";
import type { MeshData } from "../../parts/types";
import type { PartCode } from "../../snippet";
import type { Picture } from "../../pictures";
import { type Words } from "../../parts/spans";
import type { Plan, Space } from "../../space";
import { type Tour } from "../../tour";

/**
 * The page's background is a thing you can pick: click the bare frame and
 * it is selected, like a part. This is the id that stands for it in
 * `selection`; nothing else ever has it.
 */
export const BACKGROUND_ID = "background";

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
   * Every picture this part has worn since its first was remade from a
   * prompt (`RemakePicture.tsx`), the original first: the part panel's strip
   * of versions to switch between. References only, like `picture`; the
   * one in `picture` is one of these. Absent until a picture is remade.
   */
  pictureVersions?: Picture[] | null;
  /**
   * A picture he wants this part to LOOK like, dropped on its Contents plate
   * (`partPicture.ts`). Not shown in the part: it rides with "Send the
   * design back" for the code to apply under the same hook. A reference only.
   */
  lookPicture?: LookPicture | null;
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
  /**
   * ON A TABLET AND ON A PHONE (`live/small.ts`, docs/RESPONSIVE.md).
   *
   * `small` is what the person asked of this part at each width: show or
   * hide, full width, its place in the order, its size. A rule at one width
   * changes nothing at the other or on the desktop. `widths` is where the
   * site itself put the part at that width, when a capture recorded it.
   */
  small?: Partial<Record<"tablet" | "phone", import("../../live/small").DeviceRule>> | null;
  widths?: Partial<Record<"tablet" | "phone", import("../../live/small").SizedBox>> | null;
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
  /** What one state of a panel changes of its look, by `<panel>=<state>` (`stateEdits.ts`); the style layer writes each keyed `[data-panel][data-state]`. */
  byState?: Record<string, Record<string, unknown>> | null;
  /** Its place in its region, set in the Structure view and the same in every state (`structure.ts`); the style layer writes it as `order` by hook. `region`: the `data-region` it was moved into, queued in polio/NEXT.md for the code. */
  place?: { order?: number; region?: string } | null;
  /**
   * Where the box was, as the board had it, the moment he first moved or
   * resized it by hand: what Export for code to a branch says his move is
   * against (`designBranch.ts`), so the board's own tidying before then
   * (words grown, what follows laid under them) is not counted as his.
   */
  handFrom?: { x: number; y: number; w: number; h: number };
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
   * A "What's new" card's steps, when it shows and its older updates
   * (`tour.ts`). Only that part carries it; absent everywhere else.
   */
  tour?: Tour | null;
  /**
   * What the owner said this part should do that no feature covers yet, in
   * his words, for the repo-connected code chat to build. Its own field and
   * not `data`, because a capture writes its own description into `data`
   * ("button, named …") and that is not a task anybody asked for.
   */
  task?: string | null;
  /**
   * A shape drawn with the space tool while a style kit was picked
   * (`wornShape.ts`): its outline, the kit it wears (a copy, so the page
   * draws the same when the board it came from is gone), its colour, its
   * lighting bar, the motion it took from a board and what it is for.
   * Drawn by `WornShape.tsx` in place of the part. Optional: absent on every
   * part that was not drawn this way.
   */
  worn?: Worn | null;
  /**
   * Taken from another site's board (Remix, `remix.ts`): the site and part it
   * came from, the look it wore there, and whether it keeps that look
   * (`kept`) or wears this site's. Optional: absent on every other part.
   */
  remix?: Remixed | null;
  /**
   * The owner said this pressable part goes nowhere on purpose (a label drawn
   * as a button, a decoration shaped like a link). It answers the orange !
   * (`library/badge.ts`), and the blueprint builds it as a thing that is not
   * a link rather than a placeholder waiting for one.
   */
  nowhere?: boolean;
  /**
   * The owner typed this part's words in the one box. A live-data spot whose
   * words were chosen that way is decided, and loses its orange !
   * (`library/badge.ts`).
   */
  settled?: boolean;
  /**
   * The id and data-* attributes the element had on the page it was brought
   * in from (`pageParts.ts`): the names that page's code finds it by. Written
   * on the published page where the part is drawn — on a field's or a
   * checkbox's own input, else on the part's box — so `[data-hook="…"]`
   * still finds it. Optional: absent on every part that came from nowhere.
   */
  hooks?: Record<string, string> | null;
  /** Where it is in the code repository it was brought in from, and how it looked then (`styleLayer.ts`): the part panel's code link, and what the style layer compares against. */
  source?: import("../../styleLayer").NodeSource | null;
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

export interface Doc {
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
