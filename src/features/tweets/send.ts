"use client";
/**
 * Getting a draft out of the door.
 *
 * Three ways, because X can be iffy and a draft should never be stuck behind
 * one of them: through the API when the server has keys (`/api/tweets/send`,
 * media and threads and polls and all), through X's own compose page with
 * the text filled in (no media rides along; the console says so), or onto
 * the clipboard. The scheduler only ever uses the first; the other two are
 * what a person reaches for when the first will not go.
 *
 * `preflight` is the list of reasons a draft cannot go yet, in words, so the
 * console can show them beside the button rather than after it.
 */
import { getBlob, LIMITS } from "./media";
import { intentUrl, numberThread, tweetIdFromUrl, weighedLength } from "./text";
import type { Draft, Post } from "./store";

export type SendMode = "api" | "intent" | "copy";

export type SendResult =
  | { ok: true; ids: string[]; note?: string }
  | { ok: false; error: string; retryable: boolean; reason?: string; sentIds?: string[] };

export interface ApiStatus {
  configured: boolean;
  missing: string[];
  mediaApi: string;
  handle?: string | null;
}

let statusCache: { at: number; value: ApiStatus } | null = null;

/** Does the server have keys? Asked once a minute at most. */
export async function apiStatus(force = false): Promise<ApiStatus> {
  if (!force && statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value;
  try {
    const res = await fetch("/api/tweets/status", { cache: "no-store" });
    const value = (await res.json()) as ApiStatus;
    statusCache = { at: Date.now(), value };
    return value;
  } catch {
    const value: ApiStatus = { configured: false, missing: ["unreachable"], mediaApi: "v2" };
    statusCache = { at: Date.now(), value };
    return value;
  }
}

/** The thread as it will be sent: numbered when asked. */
export function preparePosts(draft: Draft, numbering: "none" | "slash" | "paren"): Post[] {
  const texts = numberThread(draft.posts.map((p) => p.text.trim()), numbering);
  return draft.posts.map((p, i) => ({ ...p, text: texts[i] ?? p.text }));
}

/** Everything that stops this draft going, in words. Empty means it can go. */
export function preflight(draft: Draft, opts: { limit: number; altRequired: boolean; numbering: "none" | "slash" | "paren" }): string[] {
  const out: string[] = [];
  const posts = preparePosts(draft, opts.numbering);
  posts.forEach((p, i) => {
    const where = posts.length > 1 ? `Post ${i + 1}` : "The post";
    if (!p.text.trim() && !p.media.length) out.push(`${where} is empty.`);
    const n = weighedLength(p.text);
    if (n > opts.limit) out.push(`${where} is ${n - opts.limit} over the ${opts.limit} limit.`);
    const images = p.media.filter((m) => m.kind === "image").length;
    const others = p.media.filter((m) => m.kind !== "image").length;
    if (images > LIMITS.perPost.images) out.push(`${where} has ${images} pictures; X takes four.`);
    if (others > 1 || (others === 1 && images > 0)) out.push(`${where} mixes a video or GIF with other media; X takes one video or GIF on its own.`);
    if (opts.altRequired) p.media.forEach((m) => { if (m.kind !== "video" && !m.alt.trim()) out.push(`${where}: “${m.name}” has no alt text.`); });
    if (i === 0 && draft.poll) {
      if (p.media.length) out.push("A poll cannot go with media.");
      const options = draft.poll.options.map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) out.push("A poll needs at least two choices.");
      if (options.some((o) => o.length > 25)) out.push("A poll choice is over 25 characters.");
    }
  });
  if (draft.quoteUrl.trim() && !tweetIdFromUrl(draft.quoteUrl)) out.push("The quoted post is not a post URL or id.");
  if (draft.replyToUrl.trim() && !tweetIdFromUrl(draft.replyToUrl)) out.push("The post to reply to is not a post URL or id.");
  return out;
}

export interface SendOptions {
  mode: SendMode;
  numbering: "none" | "slash" | "paren";
  onProgress?: (msg: string) => void;
  copy?: (text: string, label?: string) => Promise<void>;
}

async function sendOne(post: Post, extra: Record<string, unknown>, onProgress?: (m: string) => void): Promise<{ ok: true; id: string } | { ok: false; error: string; retryable: boolean; reason?: string }> {
  const form = new FormData();
  const media: { name: string; type: string; alt: string; kind: string; field: string }[] = [];
  for (let k = 0; k < post.media.length; k++) {
    const m = post.media[k]!;
    const blob = await getBlob(m.id);
    if (!blob) return { ok: false, error: `The file for “${m.name}” is gone from this browser.`, retryable: false, reason: "media-missing" };
    const field = `media_${k}`;
    form.append(field, blob, m.name);
    media.push({ name: m.name, type: m.type, alt: m.alt, kind: m.kind, field });
  }
  form.append("payload", JSON.stringify({ text: post.text, media, ...extra }));
  onProgress?.(post.media.length ? "Uploading media…" : "Posting…");
  let res: Response;
  try {
    res = await fetch("/api/tweets/send", { method: "POST", body: form });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The request did not get out.", retryable: true, reason: "network" };
  }
  let data: { ok: boolean; id?: string; message?: string; retryable?: boolean; reason?: string };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { ok: false, error: `The server answered ${res.status} with no detail.`, retryable: res.status >= 500, reason: "bad-response" };
  }
  if (data.ok && data.id) return { ok: true, id: data.id };
  return { ok: false, error: data.message ?? `The server answered ${res.status}.`, retryable: data.retryable ?? (res.status >= 500 || res.status === 429), reason: data.reason };
}

/** Send a draft the way asked. The API way sends the whole thread, one post after another. */
export async function sendDraft(draft: Draft, opts: SendOptions): Promise<SendResult> {
  const posts = preparePosts(draft, opts.numbering);
  const first = posts[0];
  if (!first) return { ok: false, error: "Nothing to send.", retryable: false };

  if (opts.mode === "intent") {
    const url = intentUrl(first.text);
    window.open(url, "_blank", "noopener");
    return { ok: true, ids: [], note: first.media.length ? "Opened X with the words. Pictures do not travel this way, add them there." : "Opened X with the words." };
  }
  if (opts.mode === "copy") {
    await opts.copy?.(posts.map((p) => p.text).join("\n\n"), "the draft");
    return { ok: true, ids: [], note: "Copied. Paste it wherever X is open." };
  }

  const ids: string[] = [];
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]!;
    const extra: Record<string, unknown> = {
      sensitive: draft.sensitive,
      inReplyToTweetId: i === 0 ? tweetIdFromUrl(draft.replyToUrl) : ids[i - 1] ?? null,
    };
    if (i === 0) {
      extra.replySettings = draft.replySettings;
      extra.quoteTweetId = tweetIdFromUrl(draft.quoteUrl);
      if (draft.poll) extra.poll = { options: draft.poll.options.map((o) => o.trim()).filter(Boolean), durationMinutes: draft.poll.durationMinutes };
    }
    opts.onProgress?.(posts.length > 1 ? `Post ${i + 1} of ${posts.length}…` : "Sending…");
    const r = await sendOne(post, extra, opts.onProgress);
    if (!r.ok) {
      if (ids.length) {
        // Part of the thread is up. Retrying would post those again, so this is final.
        return { ok: false, error: `${ids.length} of ${posts.length} posts went out, then: ${r.error}`, retryable: false, reason: r.reason, sentIds: ids };
      }
      return { ok: false, error: r.error, retryable: r.retryable, reason: r.reason };
    }
    ids.push(r.id);
  }
  return { ok: true, ids };
}
