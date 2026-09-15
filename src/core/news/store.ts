"use client";
/**
 * The news / activity feed. The rule that makes it feel like a terminal and
 * not a notification centre: PUBLISHING THE SAME THING TWICE NEVER MAKES TWO
 * LINES.
 *
 *  - Same `key` inside the coalesce window -> the existing line is updated in
 *    place: body replaced, count++, diff keeps the ORIGINAL "from" so the
 *    line reads "1% → 3%" after 1→2→3, not three rows.
 *  - Same key AND identical content -> suppressed entirely.
 *  - A change that reverts to the original value before being read -> the
 *    line is removed (nothing net changed, so there is no news).
 *  - Toasts follow the same key: they update rather than stack.
 *  - Per-source rate limiting so a runaway stream can't flood the feed.
 */
import { create } from "zustand";
import { uid } from "@/core/lib/ids";
import { labelValue } from "@/core/lib/format";
import type { CueName, Level, NewsInput, NewsItem, ToastItem } from "@/core/types";
import { getSetting } from "@/core/settings/store";
import { play } from "@/core/audio/engine";

const LEVEL_CUE: Record<Level, CueName> = { info: "notify", success: "success", warn: "warn", error: "error" };
const RATE_WINDOW_MS = 1000;
const RATE_MAX = 30;
const SOUND_GAP_MS = 400;

const rate = new Map<string, number[]>();
const lastSound = new Map<string, number>();

interface NewsState {
  items: NewsItem[];
  toasts: ToastItem[];
  dropped: number;
  publish: (input: NewsInput) => string | null;
  markRead: (id: string) => void;
  markAllRead: () => void;
  togglePin: (id: string) => void;
  dismiss: (id: string) => void;
  clear: () => void;
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

function fmtDiff(d: NonNullable<NewsInput["diff"]>, v: unknown) {
  return d.format ? d.format(v) : labelValue(v);
}

export const useNews = create<NewsState>()((set, get) => ({
  items: [],
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
      console.info("[news]", source, input.title, input.body ?? "", input.diff ?? "");
    }

    const key = input.key ?? null;
    const coalesceMs = input.coalesceMs ?? getSetting<number>("feed.coalesceMs");
    const collapseReverts = getSetting<boolean>("feed.collapseReverts");
    const bump = getSetting<boolean>("feed.bumpOnUpdate");
    const maxItems = getSetting<number>("feed.maxItems");
    const body = input.body ?? null;

    let items = get().items;
    let target: NewsItem | null = null;
    let isUpdate = false;

    if (key) {
      const existing = items.find((i) => i.key === key);
      if (existing && now - existing.updatedAt <= coalesceMs) {
        const sameContent =
          existing.title === input.title &&
          existing.body === body &&
          (input.diff ? Object.is(existing.diff?.to, input.diff.to) : existing.diff === null);
        if (sameContent) return existing.id; // repeated verbatim: no news.

        // Reverted to where it started before anyone read it: no net news.
        if (collapseReverts && input.diff && existing.diff && !existing.read && Object.is(existing.diff.from, input.diff.to)) {
          set((s) => ({ items: s.items.filter((i) => i.id !== existing.id), toasts: s.toasts.filter((t) => t.key !== key) }));
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
          count: existing.count + 1,
          read: input.quiet ? existing.read : false,
          rev: existing.rev + 1,
          expiresAt: input.ttlMs ? now + input.ttlMs : existing.expiresAt,
        };
        isUpdate = true;
        items = items.filter((i) => i.id !== existing.id);
        items = bump ? [target, ...items] : insertAt(items, target, get().items.indexOf(existing));
      }
    }

    if (!target) {
      target = {
        id: uid("news"),
        key,
        title: input.title,
        body,
        level,
        source,
        icon: input.icon ?? null,
        diff: input.diff
          ? {
              field: input.diff.field ?? input.title,
              from: input.diff.from,
              to: input.diff.to,
              fromLabel: fmtDiff(input.diff, input.diff.from),
              toLabel: fmtDiff(input.diff, input.diff.to),
            }
          : null,
        action: input.action ?? null,
        href: input.href ?? null,
        createdAt: now,
        updatedAt: now,
        count: 1,
        read: Boolean(input.quiet),
        pinned: false,
        rev: 0,
        expiresAt: input.ttlMs ? now + input.ttlMs : null,
      };
      items = [target, ...items];
      if (items.length > maxItems) {
        // Drop oldest unpinned first.
        const keep: NewsItem[] = [];
        let over = items.length - maxItems;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i]!;
          if (over > 0 && !it.pinned) {
            over--;
            continue;
          }
          keep.unshift(it);
        }
        items = keep;
      }
    }

    // Toast: upsert by key so rapid changes update one card instead of stacking.
    let toasts = get().toasts;
    if (input.toast && getSetting<boolean>("feed.toasts")) {
      const duration = (typeof input.toast === "object" && input.toast.durationMs) || getSetting<number>("feed.toastDurationMs");
      const diffLabel = target.diff ? `${target.diff.fromLabel} → ${target.diff.toLabel}` : null;
      const existingToast = key ? toasts.find((t) => t.key === key) : undefined;
      if (existingToast) {
        toasts = toasts.map((t) =>
          t.id === existingToast.id
            ? { ...t, title: target!.title, body, level, icon: target!.icon, action: target!.action, diffLabel, expiresAt: now + duration, rev: t.rev + 1, count: target!.count }
            : t,
        );
      } else {
        const toast: ToastItem = {
          id: uid("toast"),
          key,
          newsId: target.id,
          title: target.title,
          body,
          level,
          icon: target.icon,
          action: target.action,
          diffLabel,
          createdAt: now,
          expiresAt: now + duration,
          rev: 0,
          count: target.count,
        };
        toasts = [...toasts, toast];
        const max = getSetting<number>("feed.maxToasts");
        if (toasts.length > max) toasts = toasts.slice(toasts.length - max);
      }
    }

    set({ items, toasts });

    // Sound: level cue, throttled per key so a slider drag doesn't machine-gun.
    if (input.sound !== false && getSetting<boolean>("feed.sound")) {
      const soundKey = key ?? target.id;
      const last = lastSound.get(soundKey) ?? -Infinity;
      if (now - last >= SOUND_GAP_MS || !isUpdate) {
        lastSound.set(soundKey, now);
        play(input.sound ?? LEVEL_CUE[level]);
      }
    }
    return target.id;
  },

  markRead: (id) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)) })),
  markAllRead: () => set((s) => ({ items: s.items.map((i) => (i.read ? i : { ...i, read: true })) })),
  togglePin: (id) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, pinned: !i.pinned } : i)) })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id), toasts: s.toasts.filter((t) => t.newsId !== id) })),
  clear: () => set((s) => ({ items: s.items.filter((i) => i.pinned), toasts: [] })),
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
    const items = s.items.filter((i) => i.expiresAt === null || i.expiresAt > now || i.pinned);
    if (toasts.length !== s.toasts.length || items.length !== s.items.length) set({ toasts, items });
  },
}));

function insertAt<T>(arr: T[], item: T, index: number): T[] {
  const i = Math.max(0, Math.min(arr.length, index));
  return [...arr.slice(0, i), item, ...arr.slice(i)];
}

/** Publish outside React. */
export function publish(input: NewsInput) {
  return useNews.getState().publish(input);
}

export const selectUnread = (s: NewsState) => s.items.reduce((n, i) => n + (i.read ? 0 : 1), 0);
