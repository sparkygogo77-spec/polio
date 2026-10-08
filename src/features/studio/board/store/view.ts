"use client";
import { formatDefaults } from "../../format";
import { swapColour, swapFont } from "../../siteColours";
import { newLayer, type TextureLayer } from "../../look";
import { newMotion } from "../../motion";
import { useStudio } from "./create";
import { GetStudio, MOTION_RUNS, SetStudio, shelve } from "./history";
import { FIT_MIN, ZOOM_MAX, ZOOM_MIN } from "./model";
import type { StudioState } from "./state";

/** The view actions of the studio store; spread into `useStudio` by create.ts. */
export function viewActions(set: SetStudio, get: GetStudio, push: () => void, pushEdit: (key: string) => void): Pick<StudioState, "setTool" | "setInk" | "setDrawKind" | "setSiteBranch" | "setZoom" | "setFitZoom" | "setPan" | "setFrameWidth" | "setView" | "setSmallRule" | "requestFit" | "setPositions" | "setFormat" | "resetFormat" | "addMotion" | "updateMotion" | "removeMotion" | "setMotionFrame" | "moveMotionFrame" | "attachMotion" | "setLook" | "swapColourAll" | "patchNodes" | "swapFontAll" | "addTexture" | "updateTexture" | "mergeTexture" | "removeTexture" | "moveTexture" | "setShowAllFormat" | "setShowWires" | "setStatesOn" | "setMode" | "setMenuShape" | "setPlacingLight" | "setLightCarry" | "cancelPlacingLight" | "setMenuSpin" | "rememberColour" | "setCompanion" | "hideFeature" | "restoreFeature" | "restoreAllFeatures" | "bringIn" | "sendBack"> {
  void pushEdit;
  return {
    setTool: (t) => set({ tool: t }),
    setInk: (patch) => set((s) => ({ inkHue: patch.hue ?? s.inkHue, inkWidth: patch.width ?? s.inkWidth })),
    setDrawKind: (kind) => set({ drawKind: kind }),
    setSiteBranch: (b) => set({ siteBranch: b?.trim() || null }),
    /*
     * The zoom key's floor is its own, EXCEPT that it is never above the
     * fit. Measured at 375: the fit is 0.142, `ZOOM_MIN` is 0.25, and
     * pressing zoom OUT took the page from 247 to 436 — bigger, off the
     * right edge of a 375 pane, and the button did the opposite of its
     * name. The gap is mine: `FIT_MIN` let the fit go below the floor the
     * keys clamp to, so the first press of either key jumped up to 0.25.
     *
     * A person may always zoom out as far as the page is drawn when it
     * fits, and no further; they may never be pushed larger by asking for
     * smaller.
     */
    setZoom: (z) => set((s) => ({ zoom: Math.max(Math.min(ZOOM_MIN, s.fitAt), Math.min(ZOOM_MAX, z)) })),
    /* The board's own fit, floored at `FIT_MIN` rather than the key's
       `ZOOM_MIN` — see the note on both. Nothing else may use this. It
       records what it asked for, which is the keys' floor above. */
    setFitZoom: (z) => {
      const at = Math.max(FIT_MIN, Math.min(ZOOM_MAX, z));
      set({ zoom: at, fitAt: at });
    },
    setPan: (p) => set({ pan: p }),
    setFrameWidth: (w) => set((s) => ({ frameWidth: w, fitNonce: s.fitNonce + 1 })),
    setView: (v) => set((s) => ({ view: v, fitNonce: s.fitNonce + 1 })),
    setSmallRule: (id, device, patch) => {
      push();
      set((s) => ({
        nodes: s.nodes.map((n) => {
          if (n.id !== id) return n;
          const was = n.small?.[device] ?? {};
          const next = patch === null ? null : Object.fromEntries(Object.entries({ ...was, ...patch }).filter(([, v]) => v !== undefined && v !== null));
          const small = { ...(n.small ?? {}) };
          if (next && Object.keys(next).length) small[device] = next;
          else delete small[device];
          return { ...n, small: Object.keys(small).length ? small : null };
        }),
      }));
    },
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
    /* Every change to a crate is one undo step: a run of writes to the same
       setting (a slider dragged, a name typed) is one edit, as a part's words are. */
    updateMotion: (id, patch) => {
      const keys = Object.keys(patch);
      if (keys.length && keys.every((k) => MOTION_RUNS.has(k))) pushEdit(`motion:${id}:${keys.sort().join(",")}`);
      else push();
      set((st) => ({ motion: st.motion.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
    },
    removeMotion: (id) => {
      push();
      set((st) => ({ motion: st.motion.filter((m) => m.id !== id) }));
    },
    setMotionFrame: (id, at, src) => {
      push();
      set((st) => ({
        motion: st.motion.map((m) =>
          m.id === id ? { ...m, frames: m.frames.map((f, i) => (i === at ? src : f)) } : m,
        ),
      }));
    },
    // Sleeves swap rather than shuffle: pulling one out and putting it back
    // one place along is what reordering a crate actually is.
    moveMotionFrame: (id, at, delta) => {
      push();
      set((st) => ({
        motion: st.motion.map((m) => {
          if (m.id !== id) return m;
          const to = at + delta;
          if (to < 0 || to >= m.frames.length) return m;
          const frames = [...m.frames];
          [frames[at], frames[to]] = [frames[to]!, frames[at]!];
          return { ...m, frames };
        }),
      }));
    },
    /* A part wears one crate at a time: putting a second on it takes the first off. One undo. */
    attachMotion: (id, part) => {
      push();
      set((st) => ({
        motion: st.motion.map((m) => (m.id === id ? { ...m, part } : part && m.part === part ? { ...m, part: null } : m)),
      }));
    },
    setLook: (patch) => {
      push();
      set((s) => ({ look: { ...s.look, ...patch } }));
    },
    swapColourAll: (from, to, palette, opts = {}) => {
      const s = get();
      const r = swapColour(s.nodes, palette, from, to, { use: opts.use, only: opts.only ? new Set(opts.only) : undefined });
      if (!r.changed.length) return [];
      push();
      set((st) => ({ nodes: r.nodes, ...(r.pageBg ? { look: { ...st.look, palette: { ...st.look.palette, bg: r.pageBg } } } : {}) }));
      return r.changed;
    },
    patchNodes: (ids, fn) => {
      push();
      const set_ = new Set(ids);
      set((s) => ({ nodes: s.nodes.map((n) => (set_.has(n.id) ? { ...n, ...fn(n) } : n)) }));
    },
    swapFontAll: (from, to, only, patch) => {
      const r = swapFont(get().nodes, from, to, only ? new Set(only) : undefined, patch);
      if (!r.changed.length) return [];
      push();
      set({ nodes: r.nodes });
      return r.changed;
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
    setStatesOn: (keys) => set({ statesOn: [...new Set(keys)] }),
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

    bringIn: (repo, parts) => {
      push();
      set((s) => {
        const brought = [...s.brought.filter((r) => r.id !== repo.id), repo];
        const broughtParts = [...s.broughtParts.filter((p) => p.categoryId !== repo.id), ...parts];
        shelve(brought, broughtParts);
        return { brought, broughtParts };
      });
    },

    sendBack: (repoId) => {
      push();
      set((s) => {
        const brought = s.brought.filter((r) => r.id !== repoId);
        const broughtParts = s.broughtParts.filter((p) => p.categoryId !== repoId);
        shelve(brought, broughtParts);
        return { brought, broughtParts };
      });
    },
  };
}
