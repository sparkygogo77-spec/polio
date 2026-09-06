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
import { useLayoutEffect } from "react";
import type { NodeLink } from "./parts/types";

export type Tool = "select" | "pen" | "frame" | "arrow" | "erase" | "pan";
export type Priority = "must" | "nice" | "idea";
export type ShapeKind = "pen" | "frame" | "arrow";
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

interface Doc {
  pages: StudioPage[];
  nodes: StudioNode[];
  groups: StudioGroup[];
  shapes: StudioShape[];
  format: FormatValues;
  brief: StudioBrief;
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
  past: Doc[];
  future: Doc[];

  /* nodes */
  addNode: (featureId: string, x: number, y: number, patch?: Partial<StudioNode>) => string;
  updateNode: (id: string, patch: Partial<StudioNode>) => void;
  updateNodes: (ids: string[], patch: Partial<StudioNode>) => void;
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
  setBrief: (patch: Partial<StudioBrief>) => void;
  clearPage: (pageId: string) => void;
  resetAll: () => void;
  loadDoc: (doc: Partial<Doc>) => void;
  undo: () => void;
  redo: () => void;
  commit: () => void;
}

const HISTORY_LIMIT = 60;
export const HUES = [265, 200, 160, 30, 340, 90, 240, 15];

function snapshot(s: StudioState): Doc {
  return {
    pages: s.pages,
    nodes: s.nodes,
    groups: s.groups,
    shapes: s.shapes,
    format: s.format,
    brief: s.brief,
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
  };
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
        past: [],
        future: [],

        addNode: (featureId, x, y, patch) => {
          const feature = getFeature(featureId);
          const id = uid("n");
          push();
          set((s) => ({
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
                x: Math.round(x),
                y: Math.round(y),
                w: feature?.w ?? 132,
                h: feature?.h ?? 76,
                groupId: null,
                options: {},
                priority: "must",
                custom: featureId === "custom-idea",
                glyph: null,
                hue: null,
                locked: false,
                link: null,
                ...patch,
              },
            ],
            selection: [id],
          }));
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
        setShowAllFormat: (v) => set({ showAllFormat: v }),
        setShowWires: (v) => set({ showWires: v }),
        setBrief: (patch) => {
          push();
          set((s) => ({ brief: { ...s.brief, ...patch } }));
        },

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
          set({ ...starterDoc(), activePageId: "page_home", selection: [] });
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
      name: "polio.studio",
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StudioState>;
        return {
          ...current,
          ...p,
          nodes: (p.nodes ?? current.nodes).map((n) => ({ ...n, content: n.content ?? "", link: n.link ?? null, data: n.data ?? "" })),
          shapes: (p.shapes ?? current.shapes).map((sh) => ({ ...sh, relation: sh.relation ?? "flow" })),
        };
      },
      partialize: (s) => ({
        pages: s.pages,
        nodes: s.nodes,
        groups: s.groups,
        shapes: s.shapes,
        format: s.format,
        brief: s.brief,
        activePageId: s.activePageId,
        showAllFormat: s.showAllFormat,
        showWires: s.showWires,
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
