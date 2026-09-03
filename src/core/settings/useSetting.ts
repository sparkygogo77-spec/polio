"use client";
import { useCallback } from "react";
import { useSettings, getSettingDef } from "./store";

/** `const [value, set] = useSetting<boolean>("audio.enabled")` */
export function useSetting<T = unknown>(id: string): [T, (v: T) => void] {
  const value = useSettings((s) => (id in s.values ? (s.values[id] as T) : (getSettingDef(id)?.default as T)));
  const setter = useSettings((s) => s.set);
  const set = useCallback((v: T) => setter(id, v), [id, setter]);
  return [value, set];
}

export function useSettingValue<T = unknown>(id: string): T {
  return useSettings((s) => (id in s.values ? (s.values[id] as T) : (getSettingDef(id)?.default as T)));
}
