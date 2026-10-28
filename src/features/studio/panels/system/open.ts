"use client";
/**
 * "EDIT THE COMPONENT", from anywhere: the Element panel asks for the System
 * tab opened on one component's variant. The side panel switches tabs
 * (`studio:panel`, StudioPage), and the System panel, mounting or already
 * open, takes the ask and opens its editor there.
 */
import * as React from "react";

export interface OpenAsk { component: string; variant: string | null; at: number }
let ask: OpenAsk | null = null;
const listeners = new Set<() => void>();

export function openComponent(component: string, variant: string | null = null): void {
  ask = { component, variant, at: Date.now() };
  for (const l of listeners) l();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("studio:panel", { detail: "system" }));
}

/** The latest ask, live; `taken()` clears it once the editor has opened. */
export function useOpenAsk(): { ask: OpenAsk | null; taken: () => void } {
  const now = React.useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => ask,
    () => null,
  );
  return { ask: now, taken: () => { ask = null; for (const l of listeners) l(); } };
}
