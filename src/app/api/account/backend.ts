import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { del, get, list, put } from "@vercel/blob";
import { Throttle, type Backend } from "./core";

/**
 * Where the account is kept.
 *
 * On Vercel: the private Blob store connected to the project, which sets
 * `BLOB_READ_WRITE_TOKEN`. Every read skips the cache, so a cancelled key
 * stops working on the very next request and a save is read back as saved.
 *
 * In a local run with no store, `POLIO_ACCOUNT_DIR` names a folder to keep
 * it in instead, so the Account page can be tried and tested without
 * Vercel. That folder is never used on Vercel, whatever is set.
 */

const blobBackend = (): Backend => ({
  kind: "blob",
  async read(path) {
    const r = await get(path, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return { bytes: new Uint8Array(await new Response(r.stream).arrayBuffer()), type: r.blob.contentType, etag: r.blob.etag };
  },
  async stream(path) {
    const r = await get(path, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return { body: r.stream, type: r.blob.contentType, size: r.blob.size, etag: r.blob.etag };
  },
  async write(path, bytes, type) {
    const r = await put(path, Buffer.from(bytes), { access: "private", contentType: type, allowOverwrite: true, addRandomSuffix: false, cacheControlMaxAge: 60 });
    return { etag: r.etag };
  },
  async list(prefix) {
    const out: { path: string; size: number; at: string; etag: string }[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      for (const b of page.blobs) out.push({ path: b.pathname, size: b.size, at: new Date(b.uploadedAt).toISOString(), etag: b.etag });
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  },
  async remove(path) { await del(path); },
});

function folderBackend(root: string): Backend {
  const base = resolve(root);
  const inside = (path: string): string => {
    const p = resolve(base, path);
    if (p !== base && !p.startsWith(base + sep)) throw new Error("outside the account folder");
    return p;
  };
  const etagOf = (b: Uint8Array) => `"${createHash("sha1").update(b).digest("hex")}"`;
  const typeFile = (p: string) => `${p}.type`;
  return {
    kind: "folder",
    async read(path) {
      try {
        const p = inside(path);
        const bytes = new Uint8Array(await readFile(p));
        const type = await readFile(typeFile(p), "utf8").catch(() => "application/octet-stream");
        return { bytes, type, etag: etagOf(bytes) };
      } catch { return null; }
    },
    async stream(path) {
      const g = await this.read(path);
      return g ? { body: new Blob([g.bytes as Uint8Array<ArrayBuffer>]).stream(), type: g.type, size: g.bytes.byteLength, etag: g.etag } : null;
    },
    async write(path, bytes, type) {
      const p = inside(path);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, bytes);
      await writeFile(typeFile(p), type);
      return { etag: etagOf(bytes) };
    },
    async list(prefix) {
      const out: { path: string; size: number; at: string; etag: string }[] = [];
      const walk = async (dir: string) => {
        for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
          const full = join(dir, e.name);
          if (e.isDirectory()) { await walk(full); continue; }
          if (e.name.endsWith(".type")) continue;
          const path = relative(base, full).split(sep).join("/");
          if (!path.startsWith(prefix)) continue;
          const bytes = new Uint8Array(await readFile(full));
          out.push({ path, size: bytes.byteLength, at: (await stat(full)).mtime.toISOString(), etag: etagOf(bytes) });
        }
      };
      await walk(base);
      return out;
    },
    async remove(path) {
      const p = inside(path);
      await rm(p, { force: true });
      await rm(typeFile(p), { force: true });
    },
  };
}

let chosen: Backend | null | undefined;

export function backend(): Backend | null {
  if (chosen !== undefined) return chosen;
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) chosen = blobBackend();
  else if (process.env.POLIO_ACCOUNT_DIR?.trim() && !process.env.VERCEL) chosen = folderBackend(process.env.POLIO_ACCOUNT_DIR.trim());
  else chosen = null;
  return chosen;
}

/** One per server instance: wrong keys counted by address. */
export const throttle = new Throttle();

export function addressOf(request: Request): string {
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/** Every answer from these routes: never cached, never sniffed, never run as a page. */
export const NO_STORE = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; sandbox",
} as const;
