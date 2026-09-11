/**
 * The contract every part speaks.
 *
 * A part is a self-contained React component: props in, nothing out but
 * callbacks. It never imports the store, Radix, or anything from `@/core`,
 * because the whole `parts/` folder is what a generated site ships with —
 * the board, the live preview and the finished website all render the same
 * component. Keep that true and codegen stays a copy, not a rewrite.
 *
 * Rules for a part:
 *   - fill the box you are given (`w` × `h`) — the board decided the size
 *   - draw `content` exactly (tab labels, links, fields), fall back to sensible
 *     defaults only when nothing was typed
 *   - read `options` with `opt()`; the first value in the catalog is the default
 *   - in "board" mode render the initial state and never start timers; in
 *     "live" mode be fully interactive
 *   - no portals (the live preview is inside a scaled transform), no Radix;
 *     hand-roll ARIA (`role="tablist"`, `aria-expanded`, `role="dialog"`)
 *   - pointer maths as rect ratios so it works at any scale
 *   - every random-looking number comes from `sample.ts`, seeded by content
 *   - the root element carries `data-part={id}`
 */
import type * as React from "react";
import type { Theme } from "./theme";

export type PartMode = "board" | "live";

/** Where a part sends you. `page` targets a page id, path or name; `node` a part id. */
export interface NodeLink {
  kind: "page" | "url" | "node";
  target: string;
}

export type PartEvent =
  | { type: "toast"; text: string; level?: "info" | "success" | "error" }
  | { type: "success" }
  | { type: "cart"; delta: number; item: string }
  | { type: "auth"; signedIn: boolean; name?: string }
  | { type: "theme"; light?: boolean; hue?: number }
  /** A cube has been turned and has settled: this is where it was left. */
  | { type: "cube"; turn: { x: number; y: number } };

/**
 * One side of a cube, and what is written on it.
 *
 * Six of these live on the node rather than in the part, because they are
 * the author's words: they are edited after the cube exists, they go in the
 * document, and they survive publish and Build. The part is handed them and
 * draws them; it invents nothing.
 */
export interface CubeFace {
  /** The big line on the face. Empty means the face is blank, not filled in for you. */
  heading: string;
  /** A line or two under it. */
  body: string;
  /** A palette role, or a colour of its own, or empty to follow the site. */
  colour: string;
  /** Another part shown on this face instead of words. */
  nodeId?: string | null;
}

/** The six faces, in the order the part turns through them. */
export const CUBE_SIDES = ["front", "right", "back", "left", "top", "bottom"] as const;
export type CubeSide = (typeof CUBE_SIDES)[number];

export interface CubeData {
  faces: CubeFace[];
  /** Where it is left standing, in degrees. The board draws this angle. */
  turn?: { x: number; y: number };
}

export const emptyFace = (): CubeFace => ({ heading: "", body: "", colour: "" });
export const emptyCube = (): CubeData => ({ faces: CUBE_SIDES.map(emptyFace), turn: { x: -18, y: -32 } });

export interface PartProps {
  /** The catalog id, e.g. "tabs-panel". */
  id: string;
  label: string;
  /** Raw contents as typed; parts call `items(content, fallback)`. */
  content: string;
  options: Record<string, string>;
  /** The box to fill, in frame pixels. */
  w: number;
  h: number;
  link?: NodeLink | null;
  theme: Theme;
  mode: PartMode;
  /** The six faces, for the one part that has them. */
  cube?: CubeData | null;
  /**
   * The drawing this part carries, as vector.
   *
   * The icon part *is* one; a button that was given one wears it. It is
   * plain data — a viewBox and some path strings — so a generated site
   * ships it with everything else.
   */
  vector?: { viewBox: string; paths: { d: string; share: number }[] } | null;
  onNavigate?: (link: NodeLink) => void;
  emit?: (e: PartEvent) => void;
}

export type Part = React.ComponentType<PartProps>;

export interface PartDef {
  component: Part;
  ids: string[];
  /** A: visual part. B: behaviour applied to the whole live site. C: platform mock. */
  tier: "A" | "B" | "C";
  /** Show "Links to" in the inspector and honour `link`. */
  linkable?: boolean;
}

/** Read an option with its default. */
export function opt(options: Record<string, string>, id: string, def: string): string {
  const v = options[id];
  return v && v.trim() ? v : def;
}

/**
 * A range option: a number on a slider, stored as a string like every other
 * option. Anything that is not a number falls back to the default, so a part
 * is never handed NaN, and the ends clamp what a bad value can do.
 */
export function num(options: Record<string, string>, id: string, def: number, min = -Infinity, max = Infinity): number {
  const v = Number.parseFloat(options[id] ?? "");
  if (!Number.isFinite(v)) return def;
  return Math.max(min, Math.min(max, v));
}

/**
 * A "set" option: any number of presets at once, stored as one comma-separated
 * string so the document stays flat. An empty string is a real answer — it
 * means the reader turned them all off — so only a missing key falls back.
 */
export function set(options: Record<string, string>, id: string, def: string[]): string[] {
  const v = options[id];
  if (v === undefined) return def;
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}
