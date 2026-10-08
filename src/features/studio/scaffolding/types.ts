import { type AnimDelay, type AnimEase, type AnimSpeed, type AuraStyle } from "../look/index.ts";
import { type StandIn } from "../standIn.ts";

export interface ScaffoldFile {
  path: string;
  content: string;
}

export interface ScaffoldPage {
  id: string;
  name: string;
  path: string;
  prompt?: string;
  /** The page's behaviours, derived the way the live page derives them (`deriveBehaviours`). */
  behaviours?: ExportBehaviours;
  /** The page at tablet and phone, placed the way the live page places it (`placeNodes`); the desktop placement is on the parts. */
  layouts?: { tablet?: ExportLayout; phone?: ExportLayout };
}

/** One device's layout of a page: its size, and where each part sits in it. */
export interface ExportLayout {
  width: number;
  height: number;
  placed: { id: string; x: number; y: number; w: number; h: number }[];
}

/** The switches a page's tier-B parts set. The same shape as the live page's `Behaviours`, kept here so the scaffold stays pure. */
export interface ExportBehaviours {
  progress: boolean;
  backToTop: boolean;
  reveal: boolean;
  parallax: number;
  smooth: boolean;
  snap: "vertical" | "horizontal" | null;
  intro: boolean;
  cursor: string | null;
  tilt: boolean;
  confetti: boolean;
  described: { id: string; label: string }[];
  any: boolean;
}

export interface ScaffoldPart {
  id: string;
  pageId: string;
  /** The catalog id, for the comment at the top of the component. */
  featureId: string;
  label: string;
  prompt?: string;
  /** Where and how big, at the frame's own width. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The markup the part actually rendered, as HTML. */
  html: string;
  /** The exact edge it is cut to, when it has one. */
  outline?: { cut: string; closed: boolean } | null;
  /** A written body, when it has one: rendered in a frame with no permissions. */
  code?: { html: string; note?: string } | null;
  /**
   * The six faces, when it is a cube.
   *
   * The one part whose markup is not the answer: a snapshot of a cube is a
   * picture of one angle of it. This is data and behaviour, so it is
   * written out as a component that turns.
   */
  cube?: { faces: { heading: string; body: string; colour: string }[]; turn?: { x: number; y: number } } | null;
  /** True when nothing has been written for it yet: this is what Claude is for. */
  empty?: boolean;
  /** What it reads, when the board says it reads something. */
  data?: string;
  /** Its entrance on the live page, as the wheel's Animation shard set it. */
  anim?: string | null;
  animSpeed?: number | AnimSpeed;
  animDelay?: number | AnimDelay;
  animEase?: AnimEase;
  /** The colour round its edge, when it wears one. */
  aura?: string | null;
  auraSize?: number;
  auraStyle?: AuraStyle;
  /** Where a click on it goes: a page by id, path or name; a part on the page by id; a URL. */
  link?: { kind: "page" | "node" | "url"; target: string } | null;
  /** The solid, when it is one: written as a component that turns, the still as its fallback. */
  mesh?: { glb: string; still?: string; turn?: { x: number; y: number }; from?: string } | null;
}

export interface ScaffoldInput {
  name: string;
  gimmick?: string;
  master?: string;
  frameWidth: number;
  pages: ScaffoldPage[];
  parts: ScaffoldPart[];
  /** The six roles, resolved to colours. */
  palette: Record<string, string>;
  /** Fonts, radius, and the rest of the format, already resolved. */
  tokens: Record<string, string | number>;
  /** The page's own background, texture included, as CSS. */
  pageCss?: Record<string, string>;
  /** The keyframes the page's own paint names (`driftKeyframes`), written into the stylesheet. */
  keyframes?: string[];
  /** The `@font-face` rules for the faces the site carries (`fontFaceCss`), written into the stylesheet so the built site draws in the real files. */
  fontCss?: string;
  /** The wash over the page, when a texture lands over everything. */
  overlayCss?: Record<string, string>;
  /** The veil over the page, as a colour, when the look has one. */
  veil?: string;
  /** The backdrop chosen with no texture: a gradient, a grid, or the page colour. */
  backdrop?: string;
  /** The recorded reads and their samples, when the Build option Stand-in server is on (`standIn.ts`). */
  standIn?: StandIn | null;
}

/**
 * The keyframes the live page's stylesheet carries and an exported site
 * has to carry too: the entrances a part can make, and the aura's pulse.
 * Copied from `app/globals.css`, where the Builder's own live page reads
 * them; the export used to name them and define none.
 */
export const EXPORT_KEYFRAMES = `/* Entrances, as the Builder's live page plays them. */
@keyframes el-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes el-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes el-drop { from { opacity: 0; transform: translateY(-18px); } to { opacity: 1; transform: none; } }
@keyframes el-left { from { opacity: 0; transform: translateX(-26px); } to { opacity: 1; transform: none; } }
@keyframes el-right { from { opacity: 0; transform: translateX(26px); } to { opacity: 1; transform: none; } }
@keyframes el-grow { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: none; } }
@keyframes el-blur { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0); } }
@keyframes el-flip { from { opacity: 0; transform: perspective(700px) rotateX(-24deg); } to { opacity: 1; transform: none; } }
/* An aura that pulses. */
@keyframes aura-pulse {
  0%, 100% { box-shadow: 0 0 0 1px var(--aura), 0 0 calc(12px * var(--aura-k)) calc(1px * var(--aura-k)) var(--aura); }
  50% { box-shadow: 0 0 0 1px var(--aura), 0 0 calc(30px * var(--aura-k)) calc(7px * var(--aura-k)) var(--aura); }
}
@keyframes aura-pulse-shape {
  0%, 100% { filter: drop-shadow(0 0 1px var(--aura)) drop-shadow(0 0 calc(6px * var(--aura-k)) var(--aura)); }
  50% { filter: drop-shadow(0 0 1px var(--aura)) drop-shadow(0 0 calc(15px * var(--aura-k)) var(--aura)); }
}
`;
