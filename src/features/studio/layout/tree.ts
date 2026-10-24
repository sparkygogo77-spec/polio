/**
 * THE LAYOUT TREE: A BOARD'S PLACED PARTS, READ AS ROWS, COLUMNS AND GRIDS.
 *
 * Every part on the board is placed by hand at an x and a y. Clean code (the
 * new export, docs CREATE-SYSTEM-PROPOSAL "(d) Export") and a layout tidy
 * ("better version") both need the same parts said as flow: "these four are
 * a row with 24 between them, centred, at most 1200 wide". `read.ts` works
 * that out from the boxes alone and returns this tree. Nothing on the board
 * moves: the tree sits beside the parts.
 *
 * What it cannot group with certainty (a part over another, a part fixed to
 * the window, a part sticking out of the box that holds it) stays "placed":
 * kept at its own x and y inside the box that holds it, and counted, with
 * the reason, so an export can say "still placed by hand" and never hide it.
 */

export interface Box { x: number; y: number; w: number; h: number }

/** Where an item sits across its holder's main direction. */
export type Align = "start" | "center" | "end" | "stretch";

/** A part kept at its own place inside its holder, and why. */
export interface Placed {
  /** The board part's id. */
  id: string;
  /** Where the board has it. */
  box: Box;
  /** Its place from the holder's top-left corner (what `position: absolute` writes). */
  left: number;
  top: number;
  /** Why it was not grouped, in plain words. */
  why: string;
  /** What it holds, read as flow inside it, when it holds anything. */
  flow: Flow | null;
}

/** One thing in a flow: a board part, or a group the reader made up. */
export interface LayoutItem {
  /** A part's id, or `g:<first part's id>` for a group the reader made up. */
  id: string;
  /** The board part this item is, or null for a made-up group (a band of parts with no box of their own). */
  part: string | null;
  /** Where the board has it. */
  box: Box;
  /** Its width, as a max-width: it may get narrower, never wider. */
  maxWidth: number;
  /** It spans its holder's content box across (a column's full width). */
  fill: boolean;
  /** A fixed height: a part with nothing in flow inside it. Null when what it holds sizes it. */
  height: number | null;
  /** Space before it along the holder's direction, when the holder's gap does not say it. */
  before: number;
  /** Its own alignment across, when it differs from the holder's `align`. */
  self: Align | null;
  /** Space from the holder's content edge across, for an item set at "start" that is not at the edge. */
  offset: number;
  /** What it holds, as flow. Null for a part that holds nothing. */
  flow: Flow | null;
}

export interface Pad { top: number; right: number; bottom: number; left: number }

export interface Flow {
  display: "flex" | "grid";
  /** flex: the main direction. grid: always "row" (cells fill left to right). */
  direction: "row" | "column";
  /** The space between items when it is the same throughout (within a pixel); null when each item says its own `before`. */
  gap: number | null;
  /** grid only: the space between rows. */
  rowGap: number | null;
  /** grid only: each column's width. */
  columns: number[] | null;
  /** How most items sit across. */
  align: Align;
  pad: Pad;
  /** A row no single item spans top to bottom: the holder's height, border box. Null when the items size it. */
  minHeight: number | null;
  items: LayoutItem[];
  /** Parts inside this holder kept at their own place. */
  placed: Placed[];
}

export interface LayoutSection {
  /** The section's item id (a part id, or a made-up group's). */
  id: string;
  part: string | null;
  box: Box;
  /** Parts inside it laid out by flow, the section itself included when it is a part. */
  grouped: number;
  /** Parts inside it still placed by hand. */
  placed: number;
}

export interface LayoutTree {
  pageId: string | null;
  /** The board width the tree was read at. */
  width: number;
  /** The whole page, as a column of what it holds. */
  root: Flow;
  /** The page's sections, top to bottom: the first level with more than one band. */
  sections: LayoutSection[];
  /** Every placed part on the page, with its section. */
  placed: (Placed & { section: string | null })[];
  /** Parts a press shows (`node.state`): not on the page as it opens, so not laid out here, and not in `parts`. */
  states: string[];
  counts: { parts: number; grouped: number; placed: number; states: number };
}
