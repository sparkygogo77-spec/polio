/**
 * THE ACCOUNT KEPT IN A PRIVATE GITHUB REPOSITORY.
 *
 * J (2026-10-21): the Vercel Blob store was suspended for going over its
 * free limits, so a sign-in with the GitHub key keeps the account in a
 * private repository of the owner's own instead: `<login>/polio-saves`
 * (or `POLIO_SAVES_REPO`), made private by the key on the first save. Every
 * request carries the key, so the server holds nothing between them.
 *
 * Each item is a file at its own path (`data/sites/<id>.json`,
 * `data/pictures/<id>`), and its version (etag) is the git blob sha, which
 * the tree lists and the bytes give back, so a sync's comparisons need one
 * call for the whole manifest. Git keeps every earlier copy of a site, so no
 * `history/` copies are written here.
 *
 * Pure apart from the `fetch` it is handed, so a test can stand GitHub in.
 */
import { createHash } from "node:crypto";
import type { Backend, Got, Item } from "./core";
import { Explained } from "./explain.ts";

const API = "https://api.github.com";

/** The repository the account is kept in, for this login. */
export function savesRepo(env: Record<string, string | undefined>, login: string): string {
  const set = env.POLIO_SAVES_REPO?.trim();
  return set && /^[\w.-]+\/[\w.-]+$/.test(set) ? set : `${login}/polio-saves`;
}

/** Git's own name for these bytes: what the tree lists, so a read and a list agree. */
export function blobSha(bytes: Uint8Array): string {
  return createHash("sha1").update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex");
}

/** What a picture or video is, from its first bytes; anything kept that is not, is JSON. */
export function sniff(path: string, b: Uint8Array): string {
  const at = (i: number, s: string) => [...s].every((c, j) => b[i + j] === c.charCodeAt(0));
  if (!path.startsWith("data/pictures/")) return "application/json";
  if (b[0] === 0x89 && at(1, "PNG")) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (at(0, "GIF8")) return "image/gif";
  if (at(0, "RIFF") && at(8, "WEBP")) return "image/webp";
  if (at(4, "ftyp")) return at(8, "avif") || at(8, "avis") ? "image/avif" : "video/mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  /* An SVG is kept only after `svg.ts` cleaned it, so it starts at its root. */
  if (/^\s*<svg[\s>]/.test(new TextDecoder().decode(b.subarray(0, 64)))) return "image/svg+xml";
  return "application/octet-stream";
}

const base64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

export function githubBackend(o: { token: string; repo: string; fetch?: typeof fetch }): Backend {
  const f = o.fetch ?? fetch;
  const [owner, name] = o.repo.split("/") as [string, string];
  const base = `${API}/repos/${owner}/${name}`;
  const headers = (accept = "application/vnd.github+json") => ({ authorization: `Bearer ${o.token}`, accept, "x-github-api-version": "2022-11-28", "user-agent": "polio-account" });
  const call = (url: string, init: RequestInit = {}, accept?: string) =>
    f(url, { ...init, cache: "no-store", headers: { ...headers(accept), ...(init.body ? { "content-type": "application/json" } : {}) } } as RequestInit);
  const fail = async (res: Response, doing: string) => {
    const limited = res.status === 429 || (res.status === 403 && (res.headers.get("x-ratelimit-remaining") === "0" || res.headers.has("retry-after")));
    if (limited) return new Explained({ status: 429, code: "github-rate-limit", says: "GitHub says this key has made too many requests for now.", todo: "Wait a few minutes and save again." });
    if (res.status === 401) return new Explained({ status: 401, code: "github-key", says: "GitHub does not know this key: it is expired, revoked or pasted wrong.", todo: "Put a fresh GitHub key in Keys." });
    if (res.status === 403 || res.status === 404) return new Explained({ status: 403, code: "github-permission", says: `Your GitHub key cannot ${doing} ${o.repo}.`, todo: "Give the key Contents: Read and write on that repository (and Administration: Read and write, so it can make it the first time)." });
    if (res.status === 413 || res.status === 422) return new Explained({ status: 413, code: "github-too-big", says: `GitHub would not take this item for ${o.repo}.`, todo: "Pictures and videos over 25 MB cannot be kept there." });
    return new Explained({ status: 502, code: "github-down", says: `GitHub could not ${doing} ${o.repo} just now (it answered ${res.status}).`, todo: "Try again in a moment." });
  };

  /* The branch, found once per request; the repository is made the first time it is missing. */
  let branch: Promise<string> | null = null;
  const ensure = (make: boolean): Promise<string> => {
    branch ??= (async () => {
      const res = await call(base);
      if (res.ok) return ((await res.json()) as { default_branch?: string }).default_branch ?? "main";
      if (res.status !== 404 || !make) { branch = null; if (res.status === 404) return ""; throw await fail(res, "read"); }
      const made = await call(`${API}/user/repos`, { method: "POST", body: JSON.stringify({ name, private: true, auto_init: true, description: "Polio Builder: saved sites, textures and capture runs. Kept by the Builder; private." }) });
      if (!made.ok && made.status !== 422) { branch = null; throw await fail(made, "make the private repository"); }
      return ((await made.json().catch(() => ({}))) as { default_branch?: string }).default_branch ?? "main";
    })();
    return branch;
  };

  const shaOf = async (path: string, ref: string): Promise<string | null> => {
    const res = await call(`${base}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw await fail(res, "read");
    const b = (await res.json()) as { sha?: string };
    return typeof b.sha === "string" ? b.sha : null;
  };

  const read = async (path: string): Promise<Got | null> => {
    const ref = await ensure(false);
    if (!ref) return null;
    const res = await call(`${base}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`, {}, "application/vnd.github.raw");
    if (res.status === 404) return null;
    if (!res.ok) throw await fail(res, "read");
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, type: sniff(path, bytes), etag: `"${blobSha(bytes)}"` };
  };

  return {
    kind: "github",
    read,
    async stream(path) {
      const g = await read(path);
      return g ? { body: new Blob([g.bytes as Uint8Array<ArrayBuffer>]).stream(), type: g.type, size: g.bytes.byteLength, etag: g.etag } : null;
    },
    async write(path, bytes) {
      const ref = await ensure(true);
      for (let attempt = 0; ; attempt++) {
        const sha = await shaOf(path, ref);
        const res = await call(`${base}/contents/${encodePath(path)}`, {
          method: "PUT",
          body: JSON.stringify({ message: `Save ${path}`, content: base64(bytes), branch: ref, ...(sha ? { sha } : {}) }),
        });
        /* Two saves at once: the second learns the new version and goes again. */
        /* A repository made a moment ago can also answer 409 until its first commit settles. */
        if ((res.status === 409 || res.status === 422) && attempt < 3) { await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); continue; }
        if (!res.ok) throw await fail(res, "save to");
        const b = (await res.json()) as { content?: { sha?: string } };
        return { etag: `"${b.content?.sha ?? blobSha(bytes)}"` };
      }
    },
    async list(prefix): Promise<Item[]> {
      const ref = await ensure(false);
      if (!ref) return [];
      const res = await call(`${base}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
      if (res.status === 404 || res.status === 409) return [];
      if (!res.ok) throw await fail(res, "read");
      const tree = ((await res.json()) as { tree?: { path: string; type: string; sha: string; size?: number }[] }).tree ?? [];
      return tree.filter((t) => t.type === "blob" && t.path.startsWith(prefix)).map((t) => ({ path: t.path, size: t.size ?? 0, at: "", etag: `"${t.sha}"` }));
    },
    async remove(path) {
      const ref = await ensure(false);
      if (!ref) return;
      const sha = await shaOf(path, ref);
      if (!sha) return;
      const res = await call(`${base}/contents/${encodePath(path)}`, { method: "DELETE", body: JSON.stringify({ message: `Remove ${path}`, sha, branch: ref }) });
      if (!res.ok && res.status !== 404) throw await fail(res, "remove from");
    },
  };
}
