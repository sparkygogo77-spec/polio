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
 *   - words nobody typed go through `unwritten(mode, …, t.published)`:
 *     sample prose on the board, the plain fact in the live preview, and
 *     nothing at all on the page a stranger is served — fail loudly in the
 *     Builder, never on the published site
 *   - a wordmark with nothing typed for it is `t.siteName`, never "Logo"
 *   - the root element carries `data-part={id}`
 */
import type { NodeWorld } from "./World";
import type { Span } from "./spans";
import type * as React from "react";
import type { Theme } from "./theme";
import type { Picture } from "../../pictures";

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
  | { type: "cube"; turn: { x: number; y: number } }
  /** One face of a cube was pressed without being dragged: the person is pointing at it. */
  | { type: "cube-face"; side: CubeSide }
  /** …and the same for a solid, which is turned the same way. */
  | { type: "mesh"; turn: { x: number; y: number } };

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
  /** What this face is for, in the author's words: its own prompt, exactly as any part has one. */
  prompt?: string;
  /** Another part shown on this face instead of words. */
  nodeId?: string | null;
  /**
   * A surface is a page.
   *
   * Bound to a page of the site, the face stops being a card with words on
   * it and becomes that page: the page's own parts, drawn at the face's
   * size, under the site's own palette and lamp. Live, pressing the face
   * goes there, which is what a surface being a page has to mean if it
   * means anything. Unbound — the ordinary case — the face is its heading
   * and its body, exactly as it was.
   */
  pageId?: string | null;
}

/** The six faces, in the order the part turns through them. */
export const CUBE_SIDES = ["front", "right", "back", "left", "top", "bottom"] as const;
export type CubeSide = (typeof CUBE_SIDES)[number];

export interface CubeData {
  faces: CubeFace[];
  /** Where it is left standing, in degrees. The board draws this angle. */
  turn?: { x: number; y: number };
}

/**
 * A solid the board mounts and turns.
 *
 * The mesh itself rides inside the document as a `data:` URI, the way a
 * raster body does, because a generated site ships what it draws — nothing
 * is fetched at render time, because nothing may be. That is also why the
 * table asks the model for a small face count: this is bytes in a page.
 *
 * `still` is a photograph of it, and is what the board draws and what any
 * browser that will not give a WebGL context gets. A solid with no still is
 * a solid that may show nothing on a machine that cannot turn it.
 */
export interface MeshData {
  /** The solid: a GLB, as a `data:` URI. */
  glb: string;
  /** A photograph of it, for the board and for anywhere it cannot be turned. */
  still?: string;
  /** Where it is left standing, in degrees. The still is taken at this angle. */
  turn?: { x: number; y: number };
  /** Which model made it, and how many bytes it costs the document. */
  from?: string;
  bytes?: number;
}

/**
 * The resting pose, in degrees: a three-quarter view from a little above,
 * which is the angle that shows a cube is a cube. Every pose the part
 * comes to rest at is this one turned a quarter at a time.
 */
export const REST = { x: -18, y: -32 } as const;

export const emptyFace = (): CubeFace => ({ heading: "", body: "", colour: "" });
export const emptyCube = (): CubeData => ({ faces: CUBE_SIDES.map(emptyFace), turn: { ...REST } });

export interface PartProps {
  /** The catalog id, e.g. "tabs-panel". */
  id: string;
  label: string;
  /** Raw contents as typed; parts call `items(content, fallback)`. */
  content: string;
  /**
   * The same words as runs, when the node carries them as runs.
   *
   * `content` above stays the plain string and every part that has not
   * learned spans keeps reading it exactly as before — that is what makes a
   * plain string permanently valid rather than a migration waiting to
   * happen. A part that draws a sentence reads this instead, and falls back
   * to `content` when it is absent. See `parts/spans.ts`.
   */
  spans?: Span[];
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
   * The picture this part holds, and something to point at it with.
   *
   * `pic` is the reference the document keeps; `src` is a browser address
   * while the site is being built, or the published path once it has been
   * published. `src` undefined with a `pic` present means this browser no
   * longer has the bytes, and the part says so (`PictureSlot`).
   */
  picture?: { pic: Picture; src?: string } | null;
  /** A captured video (sink `node.media`): where it plays from and how. Drawn live as a <video> over its picture (`tests/video-part.mjs`). */
  media?: NodeMedia | null;
  /** A captured canvas world (sink `node.world`): its characters' press areas frame by frame, and the dialogs they open. Drawn live over the picture (`parts/World.tsx`, `tests/world-dialogs.mjs`). */
  world?: NodeWorld | null;
  /**
   * Which piece of the part is picked, when the board is pointing at one
   * piece rather than the whole: a cube's face. `colour` is the board's
   * mark for this part, the far side of its own colour, so the part draws
   * the pick the way the board draws a selection.
   */
  pick?: { id: string; colour: string } | null;
  /** The solid, for the one part that mounts one. */
  mesh?: MeshData | null;
  /**
   * The drawing this part carries, as vector.
   *
   * The icon part *is* one; a button that was given one wears it. It is
   * plain data — a viewBox and some path strings — so a generated site
   * ships it with everything else.
   */
  vector?: { viewBox: string; paths: { d: string; share: number }[] } | null;
  /**
   * A page, drawn small enough to stand on a surface.
   *
   * Handed down rather than imported, for the reason the whole folder
   * exists: a part may not reach the store or the site's renderer. What
   * comes back is already sized for the box it is given and takes no
   * pointer, so the thing it stands on can still be turned. Nothing back
   * means the page is gone, or is this page, and the face says so in
   * words instead.
   */
  surface?: (pageId: string, box: { w: number; h: number }) => React.ReactNode;
  /** A "What's new" card's steps (`tour.ts`), for the one part that has them. */
  tour?: PartTour | null;
  /**
   * Another part of this page, drawn live and scaled into a box: what a
   * "What's new" step shows on top. Handed down, like `surface`, because a
   * part may not reach the store or the renderer. Nothing back: the part
   * is not on this page any more.
   */
  partView?: (nodeId: string, box: { w: number; h: number }) => React.ReactNode;
  onNavigate?: (link: NodeLink) => void;
  emit?: (e: PartEvent) => void;
  /** The id and data-* attributes a brought-in page's code finds this part by (`StudioNode.hooks`), for a part that draws a real control to put on it. */
  hooks?: Record<string, string> | null;
}

export type Part = React.ComponentType<PartProps>;

export interface PartDef {
  component: Part;
  ids: string[];
  /** A: visual part. B: behaviour applied to the whole live site. C: platform mock. */
  tier: "A" | "B" | "C";
  /** Show "Links to" in the inspector and honour `link`. */
  linkable?: boolean;
  /**
   * The part does not read its own link, so the block makes the whole
   * part the link: a press anywhere on it, live, goes where it points. For
   * a grid or a list whose rows navigate by their own titles, the part's
   * link is where the whole thing points, and it wins.
   */
  linkWhole?: boolean;
  /**
   * Stands over the page, not in it (a "What's new" card): where it was put
   * on the board is where it is edited, and on the page its box takes no
   * room and no press; what it opens is fixed over the window.
   */
  overlay?: boolean;
}

/** One step of a "What's new" card, as `tour.ts` keeps it. */
export interface PartTourStep {
  target: string | null;
  title: string;
  lines: string;
  path: string;
  action: "scroll" | "open" | "option" | "link" | "none";
  button: string;
  option: string;
  link: { kind: "page" | "node"; target: string } | null;
}
export interface PartTour {
  when: "first" | "update" | "link";
  current: { id: number; date: string; steps: PartTourStep[] };
  past: { id: number; date: string; steps: PartTourStep[] }[];
  at?: number;
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

/** A captured video: its source, poster and how the page played it (sink `node.media`). */
export interface NodeMedia {
  kind: "video";
  src?: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  playsinline?: boolean;
  /** The video's own file, carried with the site like a picture (sink downloads it); played in place of `src`. */
  file?: Picture;
  /** Where that file is here: resolved by the part's Block, as a picture's is. */
  local?: string;
}
