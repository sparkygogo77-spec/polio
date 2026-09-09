"use client";
/**
 * The tweet console's document: the drafts, their queue, and the log.
 *
 * A draft is a thread — one post or several — with everything X lets you set
 * on it: media with alt text, a poll, who may reply, a post it replies to or
 * quotes, a sensitive-media flag, a time to go out. Its `status` is the whole
 * story of a send: `draft` until it is queued, `scheduled` while it waits,
 * `sending` for the seconds it is on the wire, `sent` with the ids X gave
 * back, `failed` with the last error and when it will be tried again, or
 * `missed` when the app was closed through its window and it is too late to
 * pretend otherwise.
 *
 * The log is the console's own news: one line per thing that happened to a
 * draft, newest first, so the rail reads like a feed and not a table.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/core/lib/ids";
import { useLayoutEffect } from "react";
import { deleteBlob } from "./media";

export type DraftStatus = "draft" | "scheduled" | "sending" | "sent" | "failed" | "missed";
export type ReplySetting = "everyone" | "following" | "mentionedUsers" | "verified" | "subscribers";

export interface TweetMedia {
  id: string;
  kind: "image" | "gif" | "video";
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  alt: string;
  /** A small data URL to draw in the strip. The bytes are in IndexedDB. */
  thumb: string;
}

export interface TweetPoll {
  options: string[];
  durationMinutes: number;
}

export interface Post {
  text: string;
  media: TweetMedia[];
}

export interface Draft {
  id: string;
  /** A name for the rail; the first words of the text when empty. */
  title: string;
  /** The thread. `posts[0]` is the tweet; the rest reply to it in order. */
  posts: Post[];
  replySettings: ReplySetting;
  poll: TweetPoll | null;
  /** A post this one quotes, or replies to — a URL or a bare id. */
  quoteUrl: string;
  replyToUrl: string;
  sensitive: boolean;
  tags: string[];
  scheduledAt: number | null;
  status: DraftStatus;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: number | null;
  sentIds: string[];
  sentAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface LogEntry {
  id: string;
  at: number;
  draftId: string | null;
  level: "info" | "success" | "warn" | "error";
  title: string;
  body?: string;
}

export type RailFilter = "all" | "drafts" | "scheduled" | "sent";

interface TweetsState {
  drafts: Draft[];
  log: LogEntry[];
  focusedId: string | null;
  filter: RailFilter;
  /** Something a command asked the console to do as soon as it is open. Not saved. */
  intent: "record" | "render" | "tour" | null;

  setIntent: (v: "record" | "render" | "tour" | null) => void;
  newDraft: (seed?: Partial<Draft>) => string;
  updateDraft: (id: string, patch: Partial<Draft>) => void;
  updatePost: (id: string, index: number, patch: Partial<Post>) => void;
  addPost: (id: string, afterIndex?: number, text?: string) => void;
  removePost: (id: string, index: number) => void;
  setPosts: (id: string, posts: Post[]) => void;
  addMedia: (id: string, index: number, media: TweetMedia) => void;
  updateMedia: (id: string, mediaId: string, patch: Partial<TweetMedia>) => void;
  removeMedia: (id: string, mediaId: string) => void;
  duplicateDraft: (id: string) => string;
  removeDraft: (id: string) => void;
  schedule: (id: string, at: number) => void;
  unschedule: (id: string) => void;
  markSending: (id: string) => void;
  markSent: (id: string, ids: string[]) => void;
  markFailed: (id: string, error: string, nextAttemptAt: number | null, final: boolean) => void;
  markMissed: (id: string) => void;
  focus: (id: string | null) => void;
  setFilter: (f: RailFilter) => void;
  note: (entry: Omit<LogEntry, "id" | "at">) => void;
  pruneSent: (olderThanMs: number) => void;
}

const LOG_LIMIT = 200;

export function emptyDraft(seed: Partial<Draft> = {}): Draft {
  const now = Date.now();
  return {
    id: uid("t"),
    title: "",
    posts: [{ text: "", media: [] }],
    replySettings: "everyone",
    poll: null,
    quoteUrl: "",
    replyToUrl: "",
    sensitive: false,
    tags: [],
    scheduledAt: null,
    status: "draft",
    attempts: 0,
    lastError: null,
    nextAttemptAt: null,
    sentIds: [],
    sentAt: null,
    createdAt: now,
    updatedAt: now,
    ...seed,
  };
}

/** The name shown for a draft: its title, else its first words. */
export function draftTitle(d: Draft): string {
  if (d.title.trim()) return d.title.trim();
  const text = d.posts[0]?.text.trim() ?? "";
  if (!text) return "Untitled";
  const first = text.split(/\n/)[0] ?? text;
  return first.length > 42 ? `${first.slice(0, 40)}…` : first;
}

export const useTweets = create<TweetsState>()(
  persist(
    (set, get) => {
      const touch = (id: string, fn: (d: Draft) => Draft) =>
        set((s) => ({ drafts: s.drafts.map((d) => (d.id === id ? { ...fn(d), updatedAt: Date.now() } : d)) }));
      const log = (entry: Omit<LogEntry, "id" | "at">) =>
        set((s) => ({ log: [{ id: uid("l"), at: Date.now(), ...entry }, ...s.log].slice(0, LOG_LIMIT) }));
      return {
        drafts: [],
        log: [],
        focusedId: null,
        filter: "all",
        intent: null,

        setIntent: (intent) => set({ intent }),
        newDraft: (seed) => {
          const d = emptyDraft(seed);
          set((s) => ({ drafts: [d, ...s.drafts], focusedId: d.id }));
          log({ draftId: d.id, level: "info", title: "New draft" });
          return d.id;
        },
        updateDraft: (id, patch) => touch(id, (d) => ({ ...d, ...patch })),
        updatePost: (id, index, patch) => touch(id, (d) => ({ ...d, posts: d.posts.map((p, i) => (i === index ? { ...p, ...patch } : p)) })),
        addPost: (id, afterIndex, text = "") =>
          touch(id, (d) => {
            const posts = [...d.posts];
            posts.splice((afterIndex ?? posts.length - 1) + 1, 0, { text, media: [] });
            return { ...d, posts };
          }),
        removePost: (id, index) =>
          touch(id, (d) => {
            if (d.posts.length <= 1) return d;
            const gone = d.posts[index];
            gone?.media.forEach((m) => void deleteBlob(m.id).catch(() => undefined));
            return { ...d, posts: d.posts.filter((_, i) => i !== index) };
          }),
        setPosts: (id, posts) => touch(id, (d) => ({ ...d, posts })),
        addMedia: (id, index, media) => touch(id, (d) => ({ ...d, posts: d.posts.map((p, i) => (i === index ? { ...p, media: [...p.media, media] } : p)) })),
        updateMedia: (id, mediaId, patch) =>
          touch(id, (d) => ({ ...d, posts: d.posts.map((p) => ({ ...p, media: p.media.map((m) => (m.id === mediaId ? { ...m, ...patch } : m)) })) })),
        removeMedia: (id, mediaId) => {
          void deleteBlob(mediaId).catch(() => undefined);
          touch(id, (d) => ({ ...d, posts: d.posts.map((p) => ({ ...p, media: p.media.filter((m) => m.id !== mediaId) })) }));
        },
        duplicateDraft: (id) => {
          const src = get().drafts.find((d) => d.id === id);
          const copy = emptyDraft(src ? { ...src, title: src.title ? `${src.title} (copy)` : "", posts: src.posts.map((p) => ({ text: p.text, media: [] })) } : {});
          copy.id = uid("t");
          copy.status = "draft";
          copy.scheduledAt = null;
          copy.attempts = 0;
          copy.lastError = null;
          copy.nextAttemptAt = null;
          copy.sentIds = [];
          copy.sentAt = null;
          set((s) => ({ drafts: [copy, ...s.drafts], focusedId: copy.id }));
          log({ draftId: copy.id, level: "info", title: "Duplicated a draft", body: "Pictures are not copied; attach them again." });
          return copy.id;
        },
        removeDraft: (id) => {
          const d = get().drafts.find((x) => x.id === id);
          d?.posts.forEach((p) => p.media.forEach((m) => void deleteBlob(m.id).catch(() => undefined)));
          set((s) => ({ drafts: s.drafts.filter((x) => x.id !== id), focusedId: s.focusedId === id ? null : s.focusedId }));
          log({ draftId: null, level: "info", title: `Deleted “${d ? draftTitle(d) : "a draft"}”` });
        },
        schedule: (id, at) => {
          touch(id, (d) => ({ ...d, scheduledAt: at, status: "scheduled", attempts: 0, lastError: null, nextAttemptAt: null }));
          log({ draftId: id, level: "info", title: "Scheduled", body: new Date(at).toLocaleString() });
        },
        unschedule: (id) => {
          touch(id, (d) => ({ ...d, scheduledAt: null, status: "draft", attempts: 0, lastError: null, nextAttemptAt: null }));
          log({ draftId: id, level: "info", title: "Taken off the queue" });
        },
        markSending: (id) => touch(id, (d) => ({ ...d, status: "sending" })),
        markSent: (id, ids) => {
          touch(id, (d) => ({ ...d, status: "sent", sentIds: ids, sentAt: Date.now(), lastError: null, nextAttemptAt: null }));
          log({ draftId: id, level: "success", title: "Sent", body: ids.length > 1 ? `${ids.length} posts in the thread` : `Post ${ids[0] ?? ""}` });
        },
        markFailed: (id, error, nextAttemptAt, final) => {
          touch(id, (d) => ({ ...d, status: final ? "failed" : "scheduled", attempts: d.attempts + 1, lastError: error, nextAttemptAt }));
          log({ draftId: id, level: final ? "error" : "warn", title: final ? "Gave up sending" : "Send failed, will retry", body: error });
        },
        markMissed: (id) => {
          touch(id, (d) => ({ ...d, status: "missed" }));
          log({ draftId: id, level: "warn", title: "Missed its time", body: "The console was not open when it was due. Reschedule it, or send it now." });
        },
        focus: (id) => set({ focusedId: id }),
        setFilter: (filter) => set({ filter }),
        note: log,
        pruneSent: (olderThanMs) => {
          const cut = Date.now() - olderThanMs;
          const gone = get().drafts.filter((d) => d.status === "sent" && (d.sentAt ?? 0) < cut);
          if (!gone.length) return;
          gone.forEach((d) => d.posts.forEach((p) => p.media.forEach((m) => void deleteBlob(m.id).catch(() => undefined))));
          set((s) => ({ drafts: s.drafts.filter((d) => !gone.includes(d)) }));
        },
      };
    },
    {
      name: "builder.tweets",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ drafts: s.drafts, log: s.log, focusedId: s.focusedId, filter: s.filter }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TweetsState>;
        return {
          ...current,
          ...p,
          // Anything caught mid-send when the page went away is back on the queue.
          drafts: (p.drafts ?? []).map((d) => ({ ...emptyDraft(), ...d, status: d.status === "sending" ? "scheduled" : d.status })),
          log: Array.isArray(p.log) ? p.log : [],
        };
      },
      skipHydration: true,
    },
  ),
);

/** Every console surface calls this first, so the saved drafts come back before anything writes. */
export function useTweetsHydration() {
  useLayoutEffect(() => {
    if (!useTweets.persist.hasHydrated()) void useTweets.persist.rehydrate();
  }, []);
}

export const selectQueued = (s: TweetsState) => s.drafts.filter((d) => d.status === "scheduled" || d.status === "sending");
