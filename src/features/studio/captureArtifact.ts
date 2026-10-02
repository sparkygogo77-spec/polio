/**
 * A CAPTURE IS A RUN'S ARTIFACT, NOT A COMMIT.
 *
 * polio's own "Capture a site" workflow (`.github/workflows/capture.yml`)
 * captures into `capture/sites/<name>/` on the runner and hands the folder
 * back as the run's artifact, `capture-<name>`. Nothing is committed: a
 * capture is a site document, and site documents are not kept in git. The
 * Builder brings the artifact in, and from then on the site is in the
 * Builder's own store like any other brought in.
 *
 * A site read this way is named with the run as its ref:
 * `owner/polio/sites/<name>@run:<id>`, so the one importer door
 * (`bringRepoIn`, `readRepoSite`), Bring in again and Replace work on it
 * unchanged. `sites/<name>` is where the folder sat on the runner; in the
 * artifact the same files sit at its root.
 *
 * WHY THROUGH OUR ROUTE. GitHub answers an artifact's download with a
 * redirect to storage that sends no CORS headers, so a browser cannot read
 * it, exactly as with a zipball. `api/studio/capture-artifact` follows the
 * redirect for one byte range at a time, with the token riding in the
 * call's header as the publish and repo routes take it, and keeps nothing.
 * One range at a time, because a function's answer is held under 4.5 MB.
 *
 * WHY RANGES. A capture's artifact can be a hundred megabytes of pictures
 * and fonts it took; the Builder wants the document and the pictures the
 * document names. The zip's directory is read from its end, and only what
 * is wanted is fetched, neighbours in one range.
 *
 * Pure apart from the pipes it is handed: `fetch` reaches GitHub and our
 * route, so a check stands both in (`tests/capture-artifact.mjs`).
 */

const API = "https://api.github.com";
/** Our route that reads a range of an artifact (`src/app/api/studio/capture-artifact/route.ts`). */
export const ROUTE = "/api/studio/capture-artifact";
/** The most one call to the route answers with: under a function's 4.5 MB. */
export const MOST_PER_CALL = 3_500_000;
/** Ranges closer than this are read as one. */
const GAP = 256 * 1024;

export interface CaptureRepo { owner: string; name: string }

/** The ref a site read from a capture run carries. */
export const runRef = (runId: number | string): string => `run:${runId}`;
/** The run a ref names, or null when it names a branch, a tag or a commit. */
export function runOf(ref: string | null | undefined): number | null {
  const m = /^run:(\d{1,20})$/.exec(String(ref ?? "").trim());
  return m ? Number(m[1]) : null;
}
/** The artifact a capture named `name` is handed back as. */
export const artifactName = (name: string): string => `capture-${name}`;

export interface Artifact { id: number; name: string; size: number; expired: boolean }

const headers = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

/** The capture a run handed back: the one named for `name` when given, else its only `capture-*`. Null when it handed none. */
export async function findArtifact(o: { repo: CaptureRepo; token: string; runId: number; name?: string | null; fetch?: typeof fetch }): Promise<Artifact | null> {
  const f = o.fetch ?? fetch;
  const r = await f(`${API}/repos/${o.repo.owner}/${o.repo.name}/actions/runs/${o.runId}/artifacts?per_page=100`, { headers: headers(o.token), cache: "no-store" } as RequestInit);
  if (!r.ok) return null;
  const list = ((await r.json()) as { artifacts?: { id: number; name: string; size_in_bytes?: number; expired?: boolean }[] }).artifacts ?? [];
  const captures = list.filter((a) => /^capture-/.test(a.name));
  const it = (o.name ? captures.find((a) => a.name === artifactName(o.name!)) : null) ?? (captures.length === 1 ? captures[0] : null);
  return it ? { id: it.id, name: it.name, size: it.size_in_bytes ?? 0, expired: !!it.expired } : null;
}

/** One range of the artifact's zip, through our route. `from`/`to` inclusive; `last` instead reads the zip's final bytes. */
export type RangeRead = (r: { from: number; to: number } | { last: number }) => Promise<{ bytes: Uint8Array; total: number }>;

export class ArtifactRefused extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/** A range reader for one artifact, through the route at `base` (the page's own origin when empty). */
export function rangeReader(o: { repo: CaptureRepo; token: string; artifactId: number; base?: string; fetch?: typeof fetch }): RangeRead {
  const f = o.fetch ?? fetch;
  return async (r) => {
    const q = new URLSearchParams({ repo: `${o.repo.owner}/${o.repo.name}`, id: String(o.artifactId) });
    if ("last" in r) q.set("last", String(r.last)); else { q.set("from", String(r.from)); q.set("to", String(r.to)); }
    const res = await f(`${o.base ?? ""}${ROUTE}?${q}`, { headers: { "x-github-token": o.token }, cache: "no-store" } as RequestInit);
    if (!res.ok) {
      let says = "";
      try { says = String(((await res.json()) as { message?: string }).message ?? ""); } catch { /* not JSON */ }
      throw new ArtifactRefused(res.status, says || `The capture could not be read (${res.status}).`);
    }
    const total = Number(/\/(\d+)\s*$/.exec(res.headers.get("content-range") ?? "")?.[1] ?? res.headers.get("x-artifact-size") ?? 0);
    return { bytes: new Uint8Array(await res.arrayBuffer()), total };
  };
}

/* ------------------------------------------------------------------ */
/* The zip, read from its end                                          */
/* ------------------------------------------------------------------ */

export interface ZipEntry { path: string; method: number; csize: number; size: number; offset: number }

const u16 = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u32 = (b: Uint8Array, i: number) => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
const u64 = (b: Uint8Array, i: number) => u32(b, i) + u32(b, i + 4) * 2 ** 32;

/** Where the central directory is, from the zip's last bytes (`tail`, which ends at byte `total`). Zip64 read too. */
export function directoryAt(tail: Uint8Array, total: number): { offset: number; size: number; count: number } | null {
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tail, i) !== 0x06054b50) continue;
    let count = u16(tail, i + 10), size = u32(tail, i + 12), offset = u32(tail, i + 16);
    if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) {
      const loc = i - 20;
      if (loc < 0 || u32(tail, loc) !== 0x07064b50) return null;
      const z64 = u64(tail, loc + 8) - (total - tail.length);
      if (z64 < 0 || u32(tail, z64) !== 0x06064b50) return null;
      count = u64(tail, z64 + 32); size = u64(tail, z64 + 40); offset = u64(tail, z64 + 48);
    }
    return { offset, size, count };
  }
  return null;
}

/** The entries of a central directory: each file's path, how it is packed, and where its local header is. */
export function entriesOf(dir: Uint8Array): ZipEntry[] {
  const out: ZipEntry[] = [];
  const dec = new TextDecoder();
  let i = 0;
  while (i + 46 <= dir.length && u32(dir, i) === 0x02014b50) {
    const method = u16(dir, i + 10);
    let csize = u32(dir, i + 20), size = u32(dir, i + 24);
    const n = u16(dir, i + 28), e = u16(dir, i + 30), c = u16(dir, i + 32);
    let offset = u32(dir, i + 42);
    const path = dec.decode(dir.subarray(i + 46, i + 46 + n));
    /* Zip64 sizes and offset, in the order the spec gives, for those set to all ones. */
    for (let x = i + 46 + n; x + 4 <= i + 46 + n + e;) {
      const id = u16(dir, x), len = u16(dir, x + 2);
      if (id === 0x0001) {
        let k = x + 4;
        if (size === 0xffffffff) { size = u64(dir, k); k += 8; }
        if (csize === 0xffffffff) { csize = u64(dir, k); k += 8; }
        if (offset === 0xffffffff) { offset = u64(dir, k); }
      }
      x += 4 + len;
    }
    if (!path.endsWith("/")) out.push({ path: path.replace(/^\.?\//, ""), method, csize, size, offset });
    i += 46 + n + e + c;
  }
  return out;
}

/** A file's bytes out of its local record (which starts at `rec[0]`), unpacked. */
export async function unpack(rec: Uint8Array, e: ZipEntry): Promise<Uint8Array | null> {
  if (u32(rec, 0) !== 0x04034b50) return null;
  const start = 30 + u16(rec, 26) + u16(rec, 28);
  const packed = rec.subarray(start, start + e.csize);
  if (packed.length < e.csize) return null;
  if (e.method === 0) return packed.slice();
  if (e.method !== 8) return null;
  const stream = new Blob([packed as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Room past a file's packed bytes for its local header's name and extra field, which can differ from the directory's. */
const HEADROOM = 30 + 1024;

/**
 * The artifact as files: its directory read once, then each file read by
 * range when asked, neighbours fetched together when `prefetch` names them.
 * `prefix` is where the files sat in the repository (`sites/<name>`), so
 * the importer reads them at the paths it would read a folder's.
 */
export async function artifactFiles(read: RangeRead, prefix: string, say: (line: string) => void = () => {}): Promise<{
  list: { path: string; size: number }[];
  read: (path: string) => Promise<Uint8Array | null>;
  prefetch: (paths: string[]) => Promise<void>;
  total: number;
}> {
  const head = await read({ last: 65_557 });
  const total = head.total || head.bytes.length;
  const at = directoryAt(head.bytes, total);
  if (!at) throw new ArtifactRefused(422, "The capture's artifact is not a zip this can read.");
  const tailStart = total - head.bytes.length;
  const dir = at.offset >= tailStart ? head.bytes.subarray(at.offset - tailStart, at.offset - tailStart + at.size) : (await span(read, at.offset, at.offset + at.size - 1)).slice();
  const entries = entriesOf(dir);
  const pre = prefix.replace(/^\/+|\/+$/g, "");
  const full = (p: string) => (pre ? `${pre}/${p}` : p);
  const byPath = new Map(entries.map((e) => [full(e.path), e]));
  /* The next entry's offset bounds this one's record; the directory bounds the last. */
  const offsets = [...new Set(entries.map((e) => e.offset))].sort((a, b) => a - b);
  const endOf = (e: ZipEntry) => {
    const next = offsets.find((o) => o > e.offset);
    return Math.min(next ?? at.offset, e.offset + HEADROOM + e.csize) - 1;
  };
  const held = new Map<string, Uint8Array>();
  const take = async (path: string, rec: Uint8Array) => { const e = byPath.get(path)!; const got = await unpack(rec, e); if (got) held.set(path, got); };
  return {
    total,
    list: [...byPath].map(([path, e]) => ({ path, size: e.size })),
    async read(path) {
      if (held.has(path)) { const got = held.get(path)!; held.delete(path); return got; }
      const e = byPath.get(path);
      if (!e) return null;
      if (e.csize > 8 * MOST_PER_CALL) say(`Fetching ${path.split("/").pop()} (${Math.round(e.csize / 1e6)} MB)…`);
      return unpack(await span(read, e.offset, endOf(e)), e);
    },
    async prefetch(paths) {
      const want = paths.map((p) => [p, byPath.get(p)] as const).filter((x): x is readonly [string, ZipEntry] => !!x[1] && !held.has(x[0])).sort((a, b) => a[1].offset - b[1].offset);
      let i = 0;
      while (i < want.length) {
        const from = want[i]![1].offset;
        let j = i, to = endOf(want[i]![1]);
        while (j + 1 < want.length && endOf(want[j + 1]![1]) - from < MOST_PER_CALL && want[j + 1]![1].offset - to < GAP) { j++; to = endOf(want[j]![1]); }
        const bytes = await span(read, from, to);
        for (let k = i; k <= j; k++) await take(want[k]![0], bytes.subarray(want[k]![1].offset - from));
        i = j + 1;
      }
    },
  };
}

/** Bytes `from`..`to` inclusive, in calls the route can answer. */
async function span(read: RangeRead, from: number, to: number): Promise<Uint8Array> {
  const out = new Uint8Array(to - from + 1);
  for (let at = from; at <= to; at += MOST_PER_CALL) {
    const end = Math.min(to, at + MOST_PER_CALL - 1);
    const got = await read({ from: at, to: end });
    out.set(got.bytes.subarray(0, end - at + 1), at - from);
  }
  return out;
}

/** What a run's artifact refusal means, in words. */
export function artifactSays(e: unknown, runId: number): string {
  if (e instanceof ArtifactRefused) {
    if (e.status === 410) return `The capture from run ${runId} has expired: GitHub keeps a run's artifact for 30 days. Capture the site again.`;
    if (e.status === 401 || e.status === 403) return `${e.message} The GitHub key needs Actions: Read on the repository the capture ran in.`;
    return e.message;
  }
  return `The capture from run ${runId} could not be read: ${e instanceof Error ? e.message : String(e)}`;
}

/** What a capture recorded about itself (`capture/run.json`), out of its artifact, or null. */
export async function recordOf(o: { repo: CaptureRepo; token: string; runId: number; name?: string | null; fetch?: typeof fetch; base?: string }): Promise<{ url?: string; name?: string; pages?: string[] } | null> {
  try {
    const art = await findArtifact(o);
    if (!art || art.expired) return null;
    const files = await artifactFiles(rangeReader({ repo: o.repo, token: o.token, artifactId: art.id, fetch: o.fetch, base: o.base }), "");
    const got = await files.read("capture/run.json");
    if (!got) return null;
    const rec = JSON.parse(new TextDecoder().decode(got)) as Record<string, unknown>;
    return { url: typeof rec.url === "string" ? rec.url : undefined, name: typeof rec.name === "string" ? rec.name : undefined, pages: Array.isArray(rec.pages) ? rec.pages.filter((p): p is string => typeof p === "string") : undefined };
  } catch {
    return null;
  }
}
