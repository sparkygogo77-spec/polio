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

export type Tool = "select" | "pen" | "frame" | "arrow" | "erase" | "pan";
export type Priority = "must" | "nice" | "idea";
export type ShapeKind = "pen" | "frame" | "arrow";

export interface StudioNode {
  id: string;
  pageId: string;
  featureId: string;
  label: string;
  /** The element's own prompt — specific to this placement. */
  prompt: string;
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
  /**
   * Feature ids shortlisted in the Pick stage. The design stage shows these
   * instead of the whole 218-item library, so you only ever arrange things you
   * already decided you want.
   */
  picks: string[];
}

interface StudioState extends Doc {
  activePageId: string;
  selection: string[];
  tool: Tool;
  inkHue: number;
  inkWidth: number;
  zoom: number;
  pan: { x: number; y: number };
  showAllFormat: boolean;
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

  /* document */
  togglePick: (featureId: string) => void;
  addPicks: (featureIds: string[]) => void;
  removePick: (featureId: string) => void;
  clearPicks: () => void;
  setFormat: (id: string, value: string | number | boolean) => void;
  resetFormat: () => void;
  setShowAllFormat: (v: boolean) => void;
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
    picks: s.picks,
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
    picks: [],
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
        activePageId: "page_home",
        selection: [],
        tool: "select",
        inkHue: 265,
        inkWidth: 3,
        zoom: 1,
        pan: { x: 0, y: 0 },
        showAllFormat: false,
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
        resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),

        togglePick: (featureId) => {
          push();
          set((s) => ({
            picks: s.picks.includes(featureId) ? s.picks.filter((x) => x !== featureId) : [...s.picks, featureId],
          }));
        },
        addPicks: (featureIds) => {
          push();
          set((s) => ({ picks: [...s.picks, ...featureIds.filter((id) => !s.picks.includes(id))] }));
        },
        removePick: (featureId) => {
          push();
          set((s) => ({ picks: s.picks.filter((x) => x !== featureId) }));
        },
        clearPicks: () => {
          push();
          set({ picks: [] });
        },

        setFormat: (id, value) => {
          push();
          set((s) => ({ format: { ...s.format, [id]: value } }));
        },
        resetFormat: () => {
          push();
          set({ format: formatDefaults() });
        },
        setShowAllFormat: (v) => set({ showAllFormat: v }),
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
              picks: doc.picks ?? s.picks,
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
      partialize: (s) => ({
        pages: s.pages,
        nodes: s.nodes,
        groups: s.groups,
        shapes: s.shapes,
        format: s.format,
        brief: s.brief,
        picks: s.picks,
        activePageId: s.activePageId,
        showAllFormat: s.showAllFormat,
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

/** Picks that have not been put on any page yet. */
export const unplacedPicks = (s: StudioState) =>
  s.picks.filter((id) => !s.nodes.some((n) => n.featureId === id));

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
