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
import { getFeature } from "./catalog";
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
import { useLayoutEffect } from "react";
import type { NodeLink } from "./parts/types";
import type { NodeColour, NodeFont } from "./parts/theme";
import { normaliseSketch, type Sketch } from "./sketch";

export type Tool = "select" | "pen" | "frame" | "arrow" | "erase" | "pan";
export type Priority = "must" | "nice" | "idea";
export type ShapeKind = "pen" | "frame" | "arrow";
/** The board shows either the design surface or the site it describes. */
export type BoardMode = "design" | "preview";
export type ShapeRelation = "flow" | "data";

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
  /** A colour round its edge — a palette role, or a colour of its own — or null for none. */
  aura: string | null;
  /** How far the aura reaches, as a multiple of the usual. */
  auraSize: number;
  /** Soft glow, hard ring, or a glow that pulses. */
  auraStyle: AuraStyle;
  /** A texture layer id this part wears on its own surface, or null. */
  texture: string | null;
  /**
   * What was drawn for it on the drawing board, and the words beside it.
   * Kept so the board reopens with the drawing still on it, the blueprint
   * can say what was drawn, and "make real" can be run again later.
   */
  sketch: Sketch | null;
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
}

interface Doc {
  pages: StudioPage[];
  nodes: StudioNode[];
  groups: StudioGroup[];
  shapes: StudioShape[];
  format: FormatValues;
  brief: StudioBrief;
  /** Colour roles and the texture stack. */
  look: Look;
  /** Keyframe sets waiting to be interpolated. See `motion.ts`. */
  motion: MotionAsset[];
}

/** Height of the frame: at least a screen, and always past the lowest part. */
export function frameHeight(nodes: StudioNode[], min = 900): number {
  const bottom = nodes.reduce((m, n) => Math.max(m, n.y + n.h), 0);
  return Math.max(min, bottom + 160);
}

/** Page widths the frame can take. Positions are absolute; the frame just shows what fits. */
export const FRAME_WIDTHS = { desktop: 1440, tablet: 834, phone: 390 } as const;
export type FrameKind = keyof typeof FRAME_WIDTHS;

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
  zoom: number;
  pan: { x: number; y: number };
  showAllFormat: boolean;
  /** Wires between parts can be hidden so the board reads as the page. */
  showWires: boolean;
  /** Parts removed from the library. Nothing is deleted; they can come back. */
  hiddenFeatures: string[];
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
  past: Doc[];
  future: Doc[];

  /* nodes */
  addNode: (featureId: string, x: number, y: number, patch?: Partial<StudioNode>) => string;
  updateNode: (id: string, patch: Partial<StudioNode>) => void;
  updateNodes: (ids: string[], patch: Partial<StudioNode>) => void;
  /** Parts draw in list order, so later is on top: one place along is one step forward or back. */
  raiseNode: (id: string, toTop?: boolean) => void;
  lowerNode: (id: string, toBottom?: boolean) => void;
  moveNodes: (ids: string[], dx: number, dy: number) => void;
  removeNodes: (ids: string[]) => void;
  duplicateNodes: (ids: string[]) => void;

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
  setZoom: (z: number) => void;
  setPan: (p: { x: number; y: number }) => void;
  resetView: () => void;
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
  /** Take a critique's proposed prompt as the prompt, and note that it was taken. */
  applyRevision: (entryId: string) => void;
  clearTrail: () => void;
  resetAll: () => void;
  loadDoc: (doc: Partial<Doc>) => void;
  undo: () => void;
  redo: () => void;
  commit: () => void;
}

const HISTORY_LIMIT = 60;
export const HUES = [265, 200, 160, 30, 340, 90, 240, 15];

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
  return {
    x: Math.round(w >= frameWidth ? 0 : Math.min(Math.max(0, x), frameWidth - w)),
    y: Math.round(Math.max(0, y)),
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

function snapshot(s: StudioState): Doc {
  return {
    pages: s.pages,
    nodes: s.nodes,
    groups: s.groups,
    shapes: s.shapes,
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

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => {
      /** Push the pre-mutation document onto the undo stack. */
      const push = () =>
        set((s) => ({ past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT), future: [] }));

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
        tool: "select",
        inkHue: 265,
        inkWidth: 3,
        zoom: 1,
        pan: { x: 0, y: 0 },
        showAllFormat: false,
        showWires: true,
        hiddenFeatures: [],
        mode: "design",
        companion: { device: "phone", x: -18, y: -18, open: false },
        trail: [],
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
                aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
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
              },
            ],
            selection: [id],
          });
          });
          return id;
        },

        updateNode: (id, patch) => {
          push();
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

        // No history push: drags call commit() once at pointer-up instead.
        moveNodes: (ids, dx, dy) => {
          const set_ = new Set(ids);
          set((s) => ({
            nodes: s.nodes.map((n) => (set_.has(n.id) && !n.locked ? { ...n, x: n.x + dx, y: n.y + dy } : n)),
          }));
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
          set((s) => ({ shapes: [...s.shapes, { ...shape, id }] }));
          return id;
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

        setSelection: (ids) => set({ selection: ids }),
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
        setZoom: (z) => set({ zoom: Math.max(0.25, Math.min(2.5, z)) }),
        setPan: (p) => set({ pan: p }),
        resetView: () => set((s) => ({ fitNonce: s.fitNonce + 1 })),
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
                kind: r.kind, mode, model, parentId: author.id, applied: false,
              });
            }
            return { trail: entries.slice(-TRAIL_LIMIT) };
          });
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
            };
          });
        },

        clearTrail: () => set({ trail: [] }),

        clearPage: (pageId) => {
          push();
          set((s) => ({
            nodes: s.nodes.filter((n) => n.pageId !== pageId),
            groups: s.groups.filter((g) => g.pageId !== pageId),
            shapes: s.shapes.filter((sh) => sh.pageId !== pageId),
            selection: [],
          }));
        },

        resetAll: () => {
          push();
          set({ ...starterDoc(), activePageId: "page_home", selection: [], trail: [] });
        },

        loadDoc: (doc) => {
          push();
          set((s) => {
            const pages = doc.pages?.length ? doc.pages : s.pages;
            return {
              pages,
              nodes: doc.nodes ?? s.nodes,
              groups: doc.groups ?? s.groups,
              shapes: doc.shapes ?? s.shapes,
              format: { ...formatDefaults(), ...(doc.format ?? {}) },
              brief: { ...s.brief, ...(doc.brief ?? {}) },
              activePageId: pages[0]!.id,
              selection: [],
            };
          });
        },

        undo: () =>
          set((s) => {
            const prev = s.past[s.past.length - 1];
            if (!prev) return {};
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
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StudioState>;
        return {
          ...current,
          ...p,
          nodes: (p.nodes ?? current.nodes).map((n) => ({
            ...n, content: n.content ?? "", link: n.link ?? null, data: n.data ?? "", colour: n.colour ?? null, font: n.font ?? null, anim: n.anim ?? null,
            // Speed and delay were words once; a saved board still has them.
            animSpeed: speedK(n.animSpeed as number | string | undefined), animDelay: delayMs(n.animDelay as number | string | undefined), animEase: n.animEase ?? "smooth",
            aura: n.aura ?? null, auraSize: Number.isFinite(n.auraSize) ? n.auraSize : 1, auraStyle: n.auraStyle ?? "glow", texture: n.texture ?? null,
            sketch: normaliseSketch(n.sketch),
          })),
          recentColours: Array.isArray(p.recentColours) ? p.recentColours : [],
          shapes: (p.shapes ?? current.shapes).map((sh) => ({ ...sh, relation: sh.relation ?? "flow" })),
          hiddenFeatures: p.hiddenFeatures ?? [],
          trail: Array.isArray(p.trail) ? p.trail : [],
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
        groups: s.groups,
        shapes: s.shapes,
        format: s.format,
        brief: s.brief,
        look: s.look,
        motion: s.motion,
        activePageId: s.activePageId,
        showAllFormat: s.showAllFormat,
        showWires: s.showWires,
        hiddenFeatures: s.hiddenFeatures,
        trail: s.trail,
        companion: s.companion,
        menuShape: s.menuShape,
        menuSpin: s.menuSpin,
        recentColours: s.recentColours,
        frameWidth: s.frameWidth,
      }),
      skipHydration: true,
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
