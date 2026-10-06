"use client";
import { LEARN_DEFAULT } from "../learn";
import { uid } from "@/core/lib/ids";
import { lands } from "../look";
import { QUEUED } from "../formation";
import { boundaryIn, lockLayout, placeLocked, tidyBoundary } from "../space";
import { GetStudio, HUES, SetStudio, inherit, pickedStates } from "./history";
import { BACKGROUND_ID, StudioNode } from "./model";
import type { StudioState } from "./state";

/**
 * What was cut last, held until it is put back — parts, or the background.
 * A module variable, not store state: a hand holding something, not a thing
 * the site remembers, and never written to disk.
 */
export type Held =
  | { kind: "nodes"; nodes: StudioNode[] }
  | { kind: "background"; layerIds: string[]; fill: string; veil: number };
export let held: Held | null = null;
export const heldBackground = () => (held?.kind === "background" ? held : null);
export const heldNodes = () => (held?.kind === "nodes" ? held : null);

/** The board actions of the studio store; spread into `useStudio` by create.ts. */
export function boardActions(set: SetStudio, get: GetStudio, push: () => void, pushEdit: (key: string) => void): Pick<StudioState, "addShape" | "joinInk" | "splitInk" | "updateShape" | "setShapeRelation" | "removeShapes" | "draws" | "addDraw" | "removeDraw" | "bringRepo" | "learn" | "setLearn" | "standIn" | "setBringRepo" | "addSpace" | "lockSpace" | "formSpace" | "resizeSpace" | "updateSpace" | "removeSpaces" | "setPlan" | "addPage" | "removePage" | "updatePage" | "setActivePage" | "movePage" | "setSelection" | "toggleSelection" | "selectAll" | "clearSelection" | "selectBackground" | "cutBackground" | "pasteBackground" | "cutNodes" | "copyNodes" | "placeNodes" | "pasteNodes" | "cut" | "paste"> {
  void pushEdit;
  return {
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
        /* A part picked while its state is off (from the part list, a search) is shown where it is, so the board pans to it and not to empty space. */
        ...pickedStates(s, ids),
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
    placeNodes: (given, opts = {}) => {
      if (!given.length) return [];
      push();
      const ids: string[] = [];
      set((s) => {
        const gid = opts.group && given.length > 1 ? uid("g") : null;
        const copies = given.map((n) => { const id = uid("n"); ids.push(id); return { ...n, id, pageId: s.activePageId, groupId: gid }; });
        const groups = gid ? [...s.groups, { id: gid, pageId: s.activePageId, label: opts.group!, prompt: "", hue: HUES[s.groups.length % HUES.length]!, locked: true }] : s.groups;
        const have = new Set((s.look.fonts ?? []).map((f) => f.id));
        const fonts = (opts.fonts ?? []).filter((f) => !have.has(f.id));
        /* The keyframes their motion names, so they move here as they did (a saved component carries them). */
        const hadK = new Set(((s.look as { keyframes?: { name: string }[] }).keyframes ?? []).map((k) => k.name));
        const keyframes = (opts.keyframes ?? []).filter((k) => !hadK.has(k.name));
        const look = fonts.length || keyframes.length ? { look: { ...s.look, ...(fonts.length ? { fonts: [...(s.look.fonts ?? []), ...fonts] } : {}), ...(keyframes.length ? { keyframes: [...(((s.look as { keyframes?: unknown[] }).keyframes) ?? []), ...keyframes] } : {}) } as typeof s.look } : {};
        return { nodes: [...s.nodes, ...copies], groups, selection: ids, ...look };
      });
      return ids;
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
  };
}
