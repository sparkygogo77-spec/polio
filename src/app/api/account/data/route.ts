import { NO_STORE } from "../backend";
import { dataPath, historyPath, PUT_MAX, typeFor } from "../core";
import { answer, guard, noStore, said } from "../guard";
import { cleanSvg } from "../svg";

/**
 * The account's saved work, for any key that opens it.
 *
 *   GET                 what is saved: paths, sizes, versions (etags)
 *   GET  ?path=data/…   one item
 *   PUT  ?path=data/…   save one item (up to 4 MB; bigger ones use /upload)
 *
 * There is no DELETE: nothing a browser saved is erased from here.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = said(async (request: Request) => {
  const g = await guard(request, "any");
  if (g instanceof Response) return g;
  if (!g.store) return noStore();
  const raw = new URL(request.url).searchParams.get("path");
  if (raw === null) return answer({ ok: true, items: await g.store.list("data/") });
  const path = dataPath(raw);
  if (!path) return answer({ ok: false, says: "Not a place saved work is kept." }, 400);
  const got = await g.store.stream(path);
  if (!got) return answer({ ok: false, says: "Nothing saved there." }, 404);
  const type = typeFor(path, got.type) ?? "application/octet-stream";
  /* An SVG may style itself but nothing else: no script, no fetching, and sandboxed if opened directly. */
  const svg = type === "image/svg+xml" ? { "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {};
  return new Response(got.body, {
    headers: { ...NO_STORE, ...svg, "content-type": type, etag: got.etag, ...(got.size !== null ? { "content-length": String(got.size) } : {}) },
  });
});

export const PUT = said(async (request: Request) => {
  const g = await guard(request, "any");
  if (g instanceof Response) return g;
  if (!g.store) return noStore();
  const path = dataPath(new URL(request.url).searchParams.get("path"));
  if (!path) return answer({ ok: false, says: "Not a place saved work is kept." }, 400);
  const type = typeFor(path, request.headers.get("content-type"));
  if (!type) return answer({ ok: false, says: "Only pictures (PNG, JPEG, GIF, WebP, AVIF, SVG), videos (MP4, WebM) and the Builder's own JSON are kept." }, 415);
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > PUT_MAX) return answer({ ok: false, says: "Too big for one plain save." }, 413);
  let bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > PUT_MAX) return answer({ ok: false, says: "Too big for one plain save." }, 413);
  if (type === "image/svg+xml") {
    const c = cleanSvg(bytes);
    if (!c.ok) return answer({ ok: false, says: c.says }, c.says.includes("over 4 MB") ? 413 : 415);
    bytes = new TextEncoder().encode(c.text);
  }
  if (type === "application/json") {
    try { JSON.parse(new TextDecoder().decode(bytes)); } catch { return answer({ ok: false, says: "That is not JSON." }, 400); }
  }
  /* Nothing a browser saved is erased: a picture is written once, and a site's copy it replaces is kept under history/. */
  if (path.startsWith("data/pictures/") && (await g.store.list(path)).some((i) => i.path === path)) return answer({ ok: false, code: "exists", says: "That picture is saved already." }, 409);
  const keep = g.store.kind === "github" ? null : historyPath(path);
  if (keep) {
    const before = await g.store.read(path);
    if (before) await g.store.write(keep, before.bytes, before.type);
  }
  const { etag } = await g.store.write(path, bytes, type);
  return answer({ ok: true, path, etag });
});
