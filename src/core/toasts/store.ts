"use client";
/**
 * Toasts: the transient line the app says when something happens.
 *
 * There was a notification centre here — a bell, an unread count, a panel of
 * everything that had ever been published, with read, pinned and dismissed
 * state behind it. It is gone, on his word: the tab and its panel were buggy
 * and nobody read them. What is left is the part that was doing real work:
 * a publish says one thing, for a few seconds, and then it is over. Nothing
 * is kept, so there is nothing to mark read and nothing to come back to.
 *
 * The rule that survives, because it is what stops the corner filling up:
 * PUBLISHING THE SAME THING TWICE NEVER MAKES TWO TOASTS.
 *
 *  - Same `key` while its toast is still up -> that toast is updated in
 *    place: body replaced, count++, and the diff keeps the ORIGINAL "from"
 *    so a slider dragged 1 -> 2 -> 3 reads "1% -> 3%" on one card.
 *  - Same key and identical content -> nothing happens at all.
 *  - A value that goes back to where it started while the toast is still up
 *    takes the toast with it: nothing net changed, so there is nothing to
 *    say.
 *  - Per-source rate limiting, so a runaway stream cannot flood the corner.
 */
import { create } from "zustand";
import { uid } from "@/core/lib/ids";
import { labelValue } from "@/core/lib/format";
import type { CueName, Level, ToastInput, ToastItem } from "@/core/types";
import { getSetting } from "@/core/settings/store";
import { play } from "@/core/audio/engine";

const LEVEL_CUE: Record<Level, CueName> = { info: "notify", success: "success", warn: "warn", error: "error" };
const RATE_WINDOW_MS = 1000;
const RATE_MAX = 30;
const SOUND_GAP_MS = 400;
/**
 * ONE SOUND FOR ONE BURST. An import says each step as it goes — on one card,
 * updated in place — and each update rang again, so one import was a run of
 * dings. A card rings when it first appears, and again only if it gets more
 * serious; and cards from one source arriving within this window of a ring
 * are one burst, heard once (`tests/toast-reach.mjs`).
 */
const GROUP_MS = 2500;
const RANK: Record<Level, number> = { info: 0, success: 1, warn: 2, error: 3 };
const lastRing = new Map<string, number>();

const rate = new Map<string, number[]>();
const lastSound = new Map<string, number>();

interface ToastState {
  toasts: ToastItem[];
  dropped: number;
  publish: (input: ToastInput) => string | null;
  dismissToast: (id: string) => void;
  /** "Pause feeds on hover": a toast under the pointer stays, and leaves with what was left of its time. */
  holdToast: (id: string) => void;
  releaseToast: (id: string) => void;
  sweep: () => void;
}

function rateLimited(source: string, now: number): boolean {
  const arr = (rate.get(source) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    rate.set(source, arr);
    return true;
  }
  arr.push(now);
  rate.set(source, arr);
  return false;
}

function fmtDiff(d: NonNullable<ToastInput["diff"]>, v: unknown) {
  return d.format ? d.format(v) : labelValue(v);
}

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  dropped: 0,

  publish: (input) => {
    const now = Date.now();
    const source = input.source ?? "app";
    const level = input.level ?? "info";
    if (rateLimited(source, now)) {
      set((s) => ({ dropped: s.dropped + 1 }));
      return null;
    }
    if (getSetting<boolean>("developer.logNews")) {
      console.info("[toast]", source, input.title, input.body ?? "", input.diff ?? "");
    }
    /*
     * A publish nobody asked to see is a publish that does nothing now. The
     * feed used to keep it; there is no feed. It still returns an id and
     * still costs its rate-limit slot, so a caller that publishes in a loop
     * is throttled whether or not it asked for a card.
     */
    if (!input.toast || !getSetting<boolean>("feed.toasts")) return null;

    const key = input.key ?? null;
    const coalesceMs = input.coalesceMs ?? getSetting<number>("feed.coalesceMs");
    const collapseReverts = getSetting<boolean>("feed.collapseReverts");
    const duration = (typeof input.toast === "object" && input.toast.durationMs) || getSetting<number>("feed.toastDurationMs");
    const body = input.body ?? null;

    let toasts = get().toasts;
    const existing = key ? toasts.find((t) => t.key === key) : undefined;
    let target: ToastItem;

    if (existing && now - existing.updatedAt <= coalesceMs) {
      const sameContent =
        existing.title === input.title &&
        existing.body === body &&
        (input.diff ? Object.is(existing.diff?.to, input.diff.to) : existing.diff === null);
      if (sameContent) return existing.id; // repeated verbatim: nothing to say twice.

      // Back where it started while the card is still up: no net change, no card.
      if (collapseReverts && input.diff && existing.diff && Object.is(existing.diff.from, input.diff.to)) {
        set({ toasts: toasts.filter((t) => t.id !== existing.id) });
        return null;
      }

      target = {
        ...existing,
        title: input.title,
        body,
        level,
        icon: input.icon ?? existing.icon,
        action: input.action ?? existing.action,
        href: input.href ?? existing.href,
        diff: input.diff
          ? {
              field: input.diff.field ?? existing.diff?.field ?? input.title,
              from: existing.diff ? existing.diff.from : input.diff.from,
              to: input.diff.to,
              fromLabel: existing.diff ? existing.diff.fromLabel : fmtDiff(input.diff, input.diff.from),
              toLabel: fmtDiff(input.diff, input.diff.to),
            }
          : existing.diff,
        updatedAt: now,
        expiresAt: now + duration,
        heldAt: existing.heldAt,
        count: existing.count + 1,
        rev: existing.rev + 1,
      };
      toasts = toasts.map((t) => (t.id === existing.id ? target : t));
    } else {
      target = {
        id: uid("toast"),
        key,
        title: input.title,
        body,
        level,
        icon: input.icon ?? null,
        action: input.action ?? null,
        href: input.href ?? null,
        diff: input.diff
          ? {
              field: input.diff.field ?? input.title,
              from: input.diff.from,
              to: input.diff.to,
              fromLabel: fmtDiff(input.diff, input.diff.from),
              toLabel: fmtDiff(input.diff, input.diff.to),
            }
          : null,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + duration,
        rev: 0,
        count: 1,
      };
      toasts = [...toasts, target];
      const max = getSetting<number>("feed.maxToasts");
      if (toasts.length > max) toasts = toasts.slice(toasts.length - max);
    }

    set({ toasts });

    /* A toast asks for its level's cue and the engine decides whether any of
       them can be heard; today only one can. Throttled per key either way, so
       a slider drag could not machine-gun it. */
    if (input.sound !== false) {
      const soundKey = key ?? target.id;
      const last = lastSound.get(soundKey) ?? -Infinity;
      const updated = !!existing && target.id === existing.id;
      const graver = updated && RANK[level] > RANK[existing!.level];
      const burst = now - (lastRing.get(source) ?? -Infinity) < GROUP_MS;
      if ((!updated && !burst) || (graver && now - last >= SOUND_GAP_MS)) {
        lastSound.set(soundKey, now);
        lastRing.set(source, now);
        play(input.sound ?? LEVEL_CUE[level]);
      }
    }
    return target.id;
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  holdToast: (id) => set((s) => ({ toasts: s.toasts.map((t) => (t.id === id && !t.heldAt ? { ...t, heldAt: Date.now() } : t)) })),
  releaseToast: (id) =>
    set((s) => ({
      toasts: s.toasts.map((t) => {
        if (t.id !== id || !t.heldAt) return t;
        const now = Date.now();
        // What was left when the pointer arrived, and never less than a beat.
        const left = Math.max(800, t.expiresAt - t.heldAt);
        return { ...t, heldAt: undefined, expiresAt: now + left };
      }),
    })),
  sweep: () => {
    const now = Date.now();
    const s = get();
    const toasts = s.toasts.filter((t) => t.heldAt || t.expiresAt > now);
    if (toasts.length !== s.toasts.length) set({ toasts });
  },
}));

/** Publish outside React. */
export function publish(input: ToastInput) {
  return useToasts.getState().publish(input);
}
