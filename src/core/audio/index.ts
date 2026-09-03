"use client";
import { useCallback } from "react";
import type { CueName } from "@/core/types";
import { play } from "./engine";

export { play, CUES, CUE_NAMES, cueCategory, installAudioUnlock, setAudioConfigSource } from "./engine";
export type { AudioConfig } from "./engine";

/** Stable `play` for components. */
export function useSound() {
  return useCallback((cue: CueName, opts?: { volume?: number; force?: boolean }) => play(cue, opts), []);
}
