/**
 * Talking to X from the server: OAuth 1.0a user context, media upload, posts.
 *
 * Four keys, all from the environment and none of them load-bearing:
 *
 *   X_API_KEY, X_API_SECRET            the app's consumer key and secret
 *   X_ACCESS_TOKEN, X_ACCESS_SECRET    the user's token and secret
 *
 * `X_MEDIA_API` picks the upload endpoint: `v2` (api.x.com/2/media/upload,
 * the default) or `v1` (upload.twitter.com/1.1/media/upload.json) for an app
 * still on the old one. Every call reports X's own words back when it fails,
 * because a guess at what X meant is worse than what X said.
 */
import { createHmac, randomBytes } from "node:crypto";

export interface XKeys {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

export function keysFromEnv(): { keys: XKeys | null; missing: string[] } {
  const names = ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"] as const;
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) return { keys: null, missing };
  return {
    keys: { apiKey: process.env.X_API_KEY!, apiSecret: process.env.X_API_SECRET!, accessToken: process.env.X_ACCESS_TOKEN!, accessSecret: process.env.X_ACCESS_SECRET! },
    missing: [],
  };
}

export const mediaApi = () => (process.env.X_MEDIA_API === "v1" ? "v1" : "v2");

/** RFC 3986 percent-encoding, which is stricter than encodeURIComponent. */
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * The Authorization header for one request. `params` are the query and, for a
 * form-encoded body, the body fields; a JSON or multipart body signs nothing
 * but the OAuth fields themselves.
 */
export function oauthHeader(keys: XKeys, method: string, url: string, params: Record<string, string> = {}): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: keys.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: keys.accessToken,
    oauth_version: "1.0",
  };
  const all = { ...params, ...oauth };
  const normalised = Object.keys(all)
    .sort()
    .map((k) => `${enc(k)}=${enc(all[k]!)}`)
    .join("&");
  const base = `${method.toUpperCase()}&${enc(url)}&${enc(normalised)}`;
  const key = `${enc(keys.apiSecret)}&${enc(keys.accessSecret)}`;
  const signature = createHmac("sha1", key).update(base).digest("base64");
  const header: Record<string, string> = { ...oauth, oauth_signature: signature };
  return `OAuth ${Object.keys(header).sort().map((k) => `${enc(k)}="${enc(header[k]!)}"`).join(", ")}`;
}

export class XError extends Error {
  status: number;
  retryable: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.retryable = status === 429 || status >= 500 || status === 0;
  }
}

/** What X said, in one line, whichever shape it came in. */
async function explain(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { detail?: string; title?: string; errors?: { message?: string; detail?: string }[]; error?: string };
    const parts = [j.title, j.detail, j.error, ...(j.errors ?? []).map((e) => e.detail ?? e.message)].filter(Boolean);
    if (parts.length) return `${res.status}: ${parts.join(" · ")}`;
  } catch {
    /* not json */
  }
  return `${res.status}: ${text.slice(0, 200) || res.statusText}`;
}

async function formPost(keys: XKeys, url: string, fields: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: oauthHeader(keys, "POST", url, fields), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
  if (!res.ok) throw new XError(await explain(res), res.status);
  return res.json().catch(() => ({}));
}

async function multipartPost(keys: XKeys, url: string, form: FormData): Promise<unknown> {
  const res = await fetch(url, { method: "POST", headers: { Authorization: oauthHeader(keys, "POST", url) }, body: form });
  if (!res.ok) throw new XError(await explain(res), res.status);
  return res.json().catch(() => ({}));
}

async function jsonPost(keys: XKeys, url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: oauthHeader(keys, "POST", url), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new XError(await explain(res), res.status);
  return res.json().catch(() => ({}));
}

async function get(keys: XKeys, url: string, query: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${url}?${qs}`, { headers: { Authorization: oauthHeader(keys, "GET", url, query) } });
  if (!res.ok) throw new XError(await explain(res), res.status);
  return res.json().catch(() => ({}));
}

const idOf = (r: unknown): string => {
  const j = r as { media_id_string?: string; media_id?: number | string; data?: { id?: string; media_key?: string } };
  return String(j.data?.id ?? j.media_id_string ?? j.media_id ?? "");
};
const processing = (r: unknown): { state?: string; check_after_secs?: number; error?: { message?: string } } | undefined =>
  (r as { processing_info?: { state?: string; check_after_secs?: number; error?: { message?: string } }; data?: { processing_info?: { state?: string; check_after_secs?: number; error?: { message?: string } } } }).processing_info ??
  (r as { data?: { processing_info?: { state?: string } } }).data?.processing_info;

/**
 * Upload one file in chunks, wait for X to finish with it, set its alt text,
 * and return the media id to attach to the post.
 */
export async function uploadMedia(keys: XKeys, file: Blob, opts: { type: string; kind: "image" | "gif" | "video"; alt?: string; onStep?: (s: string) => void }): Promise<string> {
  const v1 = mediaApi() === "v1";
  const url = v1 ? "https://upload.twitter.com/1.1/media/upload.json" : "https://api.x.com/2/media/upload";
  const category = opts.kind === "image" ? "tweet_image" : opts.kind === "gif" ? "tweet_gif" : "tweet_video";
  const bytes = Buffer.from(await file.arrayBuffer());

  opts.onStep?.("INIT");
  const init = await formPost(keys, url, { command: "INIT", total_bytes: String(bytes.length), media_type: opts.type, media_category: category });
  const id = idOf(init);
  if (!id) throw new XError("X did not give the upload an id.", 502);

  const CHUNK = 4 * 1024 * 1024;
  for (let i = 0, seg = 0; i < bytes.length; i += CHUNK, seg++) {
    opts.onStep?.(`APPEND ${seg}`);
    const form = new FormData();
    form.append("command", "APPEND");
    form.append("media_id", id);
    form.append("segment_index", String(seg));
    form.append("media", new Blob([bytes.subarray(i, i + CHUNK)], { type: "application/octet-stream" }), "chunk");
    await multipartPost(keys, url, form);
  }

  opts.onStep?.("FINALIZE");
  let fin = await formPost(keys, url, { command: "FINALIZE", media_id: id });
  // A video is processed after it lands; wait until X says it is ready.
  for (let waited = 0; waited < 120; ) {
    const p = processing(fin);
    if (!p || p.state === "succeeded" || !p.state) break;
    if (p.state === "failed") throw new XError(`X could not process the media: ${p.error?.message ?? "no reason given"}`, 422);
    const secs = Math.min(10, Math.max(1, p.check_after_secs ?? 2));
    await new Promise((r) => setTimeout(r, secs * 1000));
    waited += secs;
    fin = await get(keys, url, { command: "STATUS", media_id: id });
  }

  if (opts.alt?.trim() && opts.kind !== "video") {
    opts.onStep?.("ALT");
    try {
      if (v1) await jsonPost(keys, "https://upload.twitter.com/1.1/media/metadata/create.json", { media_id: id, alt_text: { text: opts.alt.trim().slice(0, 1000) } });
      else await jsonPost(keys, "https://api.x.com/2/media/metadata", { id, alt_text: { text: opts.alt.trim().slice(0, 1000) } });
    } catch {
      // Alt text failing is not a reason to lose the post; the caller is told the id anyway.
    }
  }
  return id;
}

export interface PostInput {
  text: string;
  mediaIds?: string[];
  replySettings?: "everyone" | "following" | "mentionedUsers" | "verified" | "subscribers";
  poll?: { options: string[]; durationMinutes: number } | null;
  quoteTweetId?: string | null;
  inReplyToTweetId?: string | null;
  sensitive?: boolean;
}

/** Create one post. Returns X's id for it. */
export async function createPost(keys: XKeys, input: PostInput): Promise<{ id: string; text: string }> {
  const body: Record<string, unknown> = { text: input.text };
  if (input.mediaIds?.length) body.media = { media_ids: input.mediaIds };
  if (input.replySettings && input.replySettings !== "everyone") body.reply_settings = input.replySettings;
  if (input.poll && input.poll.options.length >= 2) body.poll = { options: input.poll.options.slice(0, 4), duration_minutes: Math.max(5, Math.min(10080, input.poll.durationMinutes)) };
  if (input.quoteTweetId) body.quote_tweet_id = input.quoteTweetId;
  if (input.inReplyToTweetId) body.reply = { in_reply_to_tweet_id: input.inReplyToTweetId };
  if (input.sensitive) body.possibly_sensitive = true;
  const r = (await jsonPost(keys, "https://api.x.com/2/tweets", body)) as { data?: { id?: string; text?: string } };
  if (!r.data?.id) throw new XError("X accepted the post but gave no id back.", 502);
  return { id: r.data.id, text: r.data.text ?? input.text };
}
