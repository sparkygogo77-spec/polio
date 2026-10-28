"use client";
/**
 * What this browser has seen of What's new, and the run that is showing.
 *
 * Kept per browser in localStorage (`polio.whatsnew`): the ids seen, and
 * whether "Don't show again" was pressed. Every read and write is in a try:
 * with storage blocked the tips still work for the visit.
 */
import { create } from "zustand";
import { WHATS_NEW } from "./registry";

const KEY = "polio.whatsnew";
/**
 * An automated browser (a test) is not J opening the Builder: the first-open
 * tips stay out of its way unless it sets this key. Ctrl+K "What's new"
 * works everywhere.
 */
export const AUTO_KEY = "polio.whatsnew.auto";

interface Kept { seen: string[]; off: boolean }

function read(): Kept {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Kept> | null;
    return { seen: Array.isArray(v?.seen) ? v.seen.filter((s) => typeof s === "string") : [], off: v?.off === true };
  } catch {
    return { seen: [], off: false };
  }
}
function write(k: Kept) {
  try { localStorage.setItem(KEY, JSON.stringify(k)); } catch { /* kept for this visit */ }
}

/** Whether tips may start by themselves on this browser. */
export function autoAllowed(): boolean {
  if (typeof navigator !== "undefined" && navigator.webdriver) {
    try { return localStorage.getItem(AUTO_KEY) === "on"; } catch { return false; }
  }
  return true;
}

interface WhatsNew {
  /** The ids this run will show, in registry order. Empty: nothing showing. */
  queue: string[];
  /** The ids this run has shown and moved past. */
  done: string[];
  /** A replay shows everything again and remembers nothing. */
  replay: boolean;
  /** Start on whatever this browser has not seen (nothing, after Don't show again). */
  startNew: () => void;
  /** Ctrl+K "What's new": every entry again. */
  startAll: () => void;
  /** Past this one: seen. */
  next: (id: string) => void;
  /** Close for this visit; what was shown is seen. */
  dismiss: (shown: string[]) => void;
  /** Never start by itself again. */
  never: () => void;
}

export const useWhatsNew = create<WhatsNew>()((set, get) => ({
  queue: [],
  done: [],
  replay: false,
  startNew: () => {
    const k = read();
    if (k.off) return;
    const queue = WHATS_NEW.map((e) => e.id).filter((id) => !k.seen.includes(id));
    set({ queue, done: [], replay: false });
  },
  startAll: () => set({ queue: WHATS_NEW.map((e) => e.id), done: [], replay: true }),
  next: (id) => {
    const { done, replay } = get();
    if (!replay) { const k = read(); write({ ...k, seen: [...new Set([...k.seen, id])] }); }
    set({ done: [...done, id] });
  },
  dismiss: (shown) => {
    if (!get().replay) { const k = read(); write({ ...k, seen: [...new Set([...k.seen, ...shown])] }); }
    set({ queue: [], done: [], replay: false });
  },
  never: () => {
    write({ seen: WHATS_NEW.map((e) => e.id), off: true });
    set({ queue: [], done: [], replay: false });
  },
}));
