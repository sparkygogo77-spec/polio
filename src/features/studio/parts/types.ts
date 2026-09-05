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
  | { type: "theme"; light?: boolean; hue?: number };

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
