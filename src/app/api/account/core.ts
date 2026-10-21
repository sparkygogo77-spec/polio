/**
 * ACCOUNT KEYS: WHO IS ASKING, AND WHAT THEY MAY TOUCH.
 *
 * One account, the owner's. Two kinds of key open it:
 *
 * - **The owner key** lives only as the `POLIO_OWNER_KEY` setting on the
 *   server (Vercel's environment). It is never in the code, never written
 *   to the store and never sent back. It alone makes and cancels keys.
 * - **Made keys** (`polio_` and 43 random characters) are made on the
 *   Account page, shown once, and kept only as their SHA-256 hash: the
 *   record sits at `keys/<hash>.json`, so a key is looked up by hashing
 *   what was offered and nothing in the store can be turned back into a
 *   key. A made key reads and writes the account's saved work; it cannot
 *   see, make or cancel keys. Cancelling deletes the record, so the key
 *   stops working on its next request.
 *
 * The saved work is under `data/`: `prefs.json` (saved textures, what the
 * shelf learned, the library), `sites/<id>.json` (each site as a backup
 * without its picture bytes) and `pictures/<id>`. There is no delete for
 * saved work: nothing here erases anything a browser sent.
 *
 * **The owner's GitHub key** opens it too (J, 2026-10-21): the token already
 * in Keys for capture and publish is the one key to carry between browsers.
 * GitHub is asked whose token it is (`GET /user`), and the account opens
 * as the owner only when that login is one of `POLIO_GITHUB_OWNERS`
 * (comma list), else the owner of the repository this deployment is built
 * from (`VERCEL_GIT_REPO_OWNER`, which Vercel sets itself). The token is
 * never written to the store; only its hash is remembered, in memory, for
 * five minutes, so a sync's many requests ask GitHub once.
 *
 * Published sites never pass through here and never need a key.
 *
 * This file has no framework imports so a test can drive it with an
 * in-memory store (`tests/account-keys.mjs`).
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export interface Item { path: string; size: number; at: string; etag: string }
export interface Got { bytes: Uint8Array; type: string; etag: string }
export interface Streamed { body: ReadableStream<Uint8Array>; type: string; size: number | null; etag: string }

/** Where the account is kept: Vercel Blob, a private GitHub repository for a GitHub sign-in (`github.ts`), a folder in a local run, a Map in a test. */
export interface Backend {
  kind: "blob" | "folder" | "memory" | "github";
  read(path: string): Promise<Got | null>;
  stream(path: string): Promise<Streamed | null>;
  write(path: string, bytes: Uint8Array, type: string): Promise<{ etag: string }>;
  list(prefix: string): Promise<Item[]>;
  remove(path: string): Promise<void>;
}

export type Who = { role: "owner"; name: string; github?: string } | { role: "key"; id: string; name: string };

export interface KeyRecord { id: string; name: string; createdAt: string; hash: string }
export type KeyShown = Omit<KeyRecord, "hash">;

/** The shortest owner key the server will accept. A shorter setting is treated as unset. */
export const OWNER_MIN = 24;
export const KEY_RE = /^polio_[A-Za-z0-9_-]{43}$/;
/** The largest item one plain write takes; bigger ones go straight to the store (`upload`). */
export const PUT_MAX = 4 * 1024 * 1024;
/** The largest item anything takes. */
export const ITEM_MAX = 60 * 1024 * 1024;

const sha = (s: string): Buffer => createHash("sha256").update(s, "utf8").digest();
export const hashKey = (key: string): string => sha(key).toString("hex");

export function ownerKey(env: Record<string, string | undefined>): string | null {
  const k = env.POLIO_OWNER_KEY?.trim();
  return k && k.length >= OWNER_MIN ? k : null;
}

/** The key a request offers: `Authorization: Bearer <key>`, nothing else. */
export function offered(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S{1,512})\s*$/i.exec(header ?? "");
  return m?.[1] ?? null;
}

const keyPath = (hash: string) => `keys/${hash}.json`;

/** A GitHub token's shape: classic (`ghp_`, `gho_`, …) or fine-grained (`github_pat_`). */
export const GITHUB_RE = /^(gh[pousr]_[A-Za-z0-9]{20,251}|github_pat_[A-Za-z0-9_]{20,251})$/;

/** The GitHub logins whose token opens the account as the owner. Empty: a GitHub token opens nothing. */
export function githubOwners(env: Record<string, string | undefined>): string[] {
  const list = (env.POLIO_GITHUB_OWNERS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (list.length) return list;
  const repoOwner = env.VERCEL_GIT_REPO_OWNER?.trim().toLowerCase();
  return repoOwner ? [repoOwner] : [];
}

/** GitHub did not answer: says nothing about the token, so it is neither counted nor refused. */
export class GithubDown extends Error {}

const GITHUB_KEEP_MS = 5 * 60_000;
const githubSeen = new Map<string, { login: string | null; at: number }>();

/** Whose token this is, by GitHub's own word: the login, or null when GitHub does not know it. */
export async function githubLogin(token: string, o: { fetch?: typeof fetch; now?: number } = {}): Promise<string | null> {
  const now = o.now ?? Date.now();
  const h = hashKey(token);
  const seen = githubSeen.get(h);
  if (seen && now - seen.at < (seen.login ? GITHUB_KEEP_MS : 60_000)) return seen.login;
  let res: Response;
  try {
    res = await (o.fetch ?? fetch)("https://api.github.com/user", { headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "polio-account" }, cache: "no-store" } as RequestInit);
  } catch {
    throw new GithubDown("GitHub could not be reached.");
  }
  let login: string | null = null;
  if (res.ok) {
    const b = (await res.json().catch(() => ({}))) as { login?: unknown };
    login = typeof b.login === "string" && b.login ? b.login : null;
  } else if (res.status !== 401 && res.status !== 403) {
    throw new GithubDown(`GitHub answered ${res.status}.`);
  }
  if (githubSeen.size > 500) githubSeen.clear();
  githubSeen.set(h, { login, at: now });
  return login;
}

export async function identify(backend: Backend | null, env: Record<string, string | undefined>, header: string | null | undefined, o: { fetch?: typeof fetch; now?: number } = {}): Promise<Who | null> {
  const given = offered(header);
  if (!given) return null;
  const owner = ownerKey(env);
  /* Compared as equal-length digests, so the time taken says nothing about the owner key. */
  if (owner && timingSafeEqual(sha(given), sha(owner))) return { role: "owner", name: "Owner" };
  if (GITHUB_RE.test(given)) {
    const owners = githubOwners(env);
    if (!owners.length) return null;
    const login = await githubLogin(given, o);
    return login && owners.includes(login.toLowerCase()) ? { role: "owner", name: login, github: login } : null;
  }
  if (!backend || !KEY_RE.test(given)) return null;
  const hash = hashKey(given);
  const got = await backend.read(keyPath(hash));
  if (!got) return null;
  try {
    const r = JSON.parse(new TextDecoder().decode(got.bytes)) as KeyRecord;
    if (r.hash !== hash || typeof r.id !== "string") return null;
    return { role: "key", id: r.id, name: typeof r.name === "string" ? r.name : "Key" };
  } catch {
    return null;
  }
}

export function cleanName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const n = name.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  return n || null;
}

/** A new key. The key itself is returned once, here, and never kept. */
export async function makeKey(backend: Backend, name: string, now = new Date()): Promise<{ key: string; record: KeyShown }> {
  const key = `polio_${randomBytes(32).toString("base64url")}`;
  const record: KeyRecord = { id: randomBytes(8).toString("hex"), name, createdAt: now.toISOString(), hash: hashKey(key) };
  await backend.write(keyPath(record.hash), new TextEncoder().encode(JSON.stringify(record)), "application/json");
  const { hash: _drop, ...shown } = record;
  void _drop;
  return { key, record: shown };
}

async function records(backend: Backend): Promise<{ path: string; record: KeyRecord }[]> {
  const out: { path: string; record: KeyRecord }[] = [];
  for (const it of await backend.list("keys/")) {
    const got = await backend.read(it.path);
    if (!got) continue;
    try {
      const r = JSON.parse(new TextDecoder().decode(got.bytes)) as KeyRecord;
      if (typeof r.id === "string") out.push({ path: it.path, record: r });
    } catch { /* a record that does not read opens nothing either */ }
  }
  return out;
}

/** Every key's name and date, never its hash. */
export async function listKeys(backend: Backend): Promise<KeyShown[]> {
  return (await records(backend))
    .map(({ record: { id, name, createdAt } }) => ({ id, name, createdAt }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function cancelKey(backend: Backend, id: string): Promise<boolean> {
  const hit = (await records(backend)).find((r) => r.record.id === id);
  if (!hit) return false;
  await backend.remove(hit.path);
  return true;
}

/** The only places saved work may go. Anything else, `keys/` above all, is refused. */
export function dataPath(path: unknown): string | null {
  if (typeof path !== "string" || path.length > 200 || path.includes("..") || path.endsWith(".type")) return null;
  return /^data\/(prefs\.json|sites\/[A-Za-z0-9_-]{1,80}\.json|pictures\/[A-Za-z0-9_][A-Za-z0-9_.-]{0,159})$/.test(path) ? path : null;
}

/** Where the copy a site save replaces is kept, so a save never erases the one before it. */
export const historyPath = (path: string, at = new Date()): string | null => {
  const m = /^data\/sites\/([A-Za-z0-9_-]{1,80})\.json$/.exec(path);
  return m ? `history/sites/${m[1]}/${at.toISOString().replace(/[:.]/g, "-")}.json` : null;
};

/** What a saved item is served as. Pictures are images or videos; everything else is JSON. Never HTML. An SVG only after `svg.ts` cleaned it. */
export function typeFor(path: string, given: string | null | undefined): string | null {
  if (path.endsWith(".json") && !path.startsWith("data/pictures/")) return "application/json";
  const t = (given ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (/^(image\/(png|jpeg|gif|webp|avif|svg\+xml)|video\/(mp4|webm))$/.test(t)) return t;
  return null;
}

/**
 * Too many wrong keys from one address: wait. Best effort, since each server
 * instance counts its own, but it turns a guessing run into a crawl, and a
 * made key has 256 bits to guess anyway.
 */
export class Throttle {
  private seen = new Map<string, { n: number; since: number }>();
  private max: number;
  private windowMs: number;
  constructor(max = 10, windowMs = 10 * 60_000) { this.max = max; this.windowMs = windowMs; }
  blocked(ip: string, now = Date.now()): boolean {
    const s = this.seen.get(ip);
    if (!s) return false;
    if (now - s.since > this.windowMs) { this.seen.delete(ip); return false; }
    return s.n >= this.max;
  }
  failed(ip: string, now = Date.now()): void {
    const s = this.seen.get(ip);
    if (!s || now - s.since > this.windowMs) this.seen.set(ip, { n: 1, since: now });
    else s.n++;
    if (this.seen.size > 5000) this.seen.clear();
  }
}

/** An in-memory store, for tests. */
export function memoryBackend(): Backend & { items: Map<string, Got> } {
  const items = new Map<string, Got>();
  let n = 0;
  return {
    kind: "memory",
    items,
    async read(path) { return items.get(path) ?? null; },
    async stream(path) {
      const g = items.get(path);
      if (!g) return null;
      return { body: new Blob([g.bytes as Uint8Array<ArrayBuffer>]).stream(), type: g.type, size: g.bytes.byteLength, etag: g.etag };
    },
    async write(path, bytes, type) { const etag = `"m${++n}"`; items.set(path, { bytes, type, etag }); return { etag }; },
    async list(prefix) { return [...items].filter(([p]) => p.startsWith(prefix)).map(([path, g]) => ({ path, size: g.bytes.byteLength, at: "", etag: g.etag })); },
    async remove(path) { items.delete(path); },
  };
}
