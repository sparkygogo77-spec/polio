"use client";
/**
 * Persisted settings store. Definitions are registered (core + modules);
 * values are stored sparsely so defaults can change without migrations.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SettingDef, SettingGroupDef } from "@/core/types";
import { CORE_SETTINGS, CORE_SETTING_GROUPS } from "./defs";

const defs = new Map<string, SettingDef>();
const groups = new Map<string, SettingGroupDef>();

export function registerSettingDefs(list: SettingDef[] | undefined) {
  for (const d of list ?? []) defs.set(d.id, d);
}
export function registerSettingGroups(list: SettingGroupDef[] | undefined) {
  for (const g of list ?? []) groups.set(g.id, g);
}
registerSettingGroups(CORE_SETTING_GROUPS);
registerSettingDefs(CORE_SETTINGS);

export function getSettingDef(id: string): SettingDef | undefined {
  return defs.get(id);
}
export function allSettingDefs(): SettingDef[] {
  return [...defs.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
export function allSettingGroups(): SettingGroupDef[] {
  return [...groups.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

type Listener = (id: string, value: unknown, prev: unknown, def: SettingDef | undefined) => void;
const listeners = new Set<Listener>();
/** Subscribe to every setting change (used by the news + audio bridges). */
export function onSettingChange(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

interface SettingsState {
  values: Record<string, unknown>;
  advanced: boolean;
  hydrated: boolean;
  set: (id: string, value: unknown) => void;
  reset: (id: string) => void;
  resetGroup: (group: string) => void;
  resetAll: () => void;
  setAdvanced: (v: boolean) => void;
  importValues: (values: Record<string, unknown>) => void;
  markHydrated: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      values: {},
      advanced: false,
      hydrated: false,
      set: (id, value) => {
        if (value === undefined) {
          get().reset(id);
          return;
        }
        const def = defs.get(id);
        const prev = id in get().values ? get().values[id] : def?.default;
        if (Object.is(prev, value)) return;
        set((s) => ({ values: { ...s.values, [id]: value } }));
        for (const l of listeners) l(id, value, prev, def);
      },
      reset: (id) => {
        const def = defs.get(id);
        const prev = get().values[id];
        if (prev === undefined) return;
        set((s) => {
          const next = { ...s.values };
          delete next[id];
          return { values: next };
        });
        for (const l of listeners) l(id, def?.default, prev, def);
      },
      resetGroup: (group) => {
        for (const d of defs.values()) if (d.group === group) get().reset(d.id);
      },
      resetAll: () => {
        for (const d of defs.values()) get().reset(d.id);
      },
      setAdvanced: (v) => set({ advanced: v }),
      importValues: (values) => {
        for (const [id, v] of Object.entries(values)) if (defs.has(id)) get().set(id, v);
      },
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "polio.settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ values: s.values, advanced: s.advanced }),
      skipHydration: true,
    },
  ),
);

/** Read a setting outside React. */
export function getSetting<T = unknown>(id: string): T {
  const { values } = useSettings.getState();
  if (id in values) return values[id] as T;
  const def = defs.get(id);
  return (def?.default as T) ?? (undefined as T);
}

export function setSetting(id: string, value: unknown) {
  useSettings.getState().set(id, value);
}

/** Export current non-default values (for the settings drawer). */
export function exportSettings(): Record<string, unknown> {
  return { ...useSettings.getState().values };
}
