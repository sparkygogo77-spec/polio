/**
 * EVERY FILE A PUBLISHED PAGE POINTS AT IS IN THE PUBLISHED SITE.
 *
 * The live check of 30 September found pages pointing at files that were
 * never published: the Builder's own `public/` files (`/construct/face-*.png`
 * and `rim-*.png`, which a part drawn in the Builder's own material paints
 * with, and `/placeholder/scene.svg`, the crop an empty picture part shows),
 * served by the Builder and so never noticed until the site was live
 * somewhere else. TrendTrader had one such hole and BLACKORB nine.
 *
 * So before anything goes up, every page and stylesheet is read for what it
 * references (`src`, `srcset`, `poster`, a stylesheet's or icon's `href`, a
 * share picture's `content`, and every `url(…)` in a style or a sheet), each
 * reference is resolved against the file it is in, and:
 *
 *   · one already among the files going up is fine;
 *   · one the Builder itself serves as a plain file (its `public/` folder) is
 *     copied in at the same path, so the reference works unchanged, from any
 *     page, on the published site's own address;
 *   · anything else is missing, and publish refuses with the list, in plain
 *     words, rather than putting up a site with holes in it.
 *
 * Links between pages (`<a href>`) are addresses, not files, and are not
 * held to this; nor is anything on another site, a `data:` picture or an
 * anchor. Pure apart from the `fetchOwn` it is handed, so
 * `tests/site-refs.mjs` runs it without a browser.
 */

export interface RefFile { path: string; content: string; encoding?: string }

export interface Missing {
  /** The site path nothing provides, as a person would type it after the address. */
  path: string;
  /** The files that point at it. */
  from: string[];
}

/** What the Builder serves at a path, as bytes, or null. Given `construct/face-green.png`, fetches `/construct/face-green.png` from the Builder. */
export type FetchOwn = (path: string) => Promise<{ base64: string; bytes: number } | null>;

const OFFSITE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;
/** The Builder's own machinery is never copied into a site, even if it answers. */
const NEVER_COPIED = /^(?:api|_next|builder|builds)(?:\/|$)/;
/** A file copied in from the Builder is small, or something is wrong. */
const MOST = 5_000_000;

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** The references in one text file, as written. */
export function referencesIn(file: RefFile): string[] {
  if (file.encoding === "base64") return [];
  const out: string[] = [];
  const text = file.content;
  const isHtml = /\.html?$/i.test(file.path);
  const isCss = /\.css$/i.test(file.path);
  if (!isHtml && !isCss) return out;
  /* url(…) in a sheet, or in an inline style (whose quotes an HTML writer turns into &quot;). */
  const body = isHtml ? decode(text) : text;
  for (const m of body.matchAll(/url\(\s*(['"]?)([^'")]+?)\1\s*\)/g)) out.push(m[2]!.trim());
  if (isHtml) {
    for (const m of text.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
      const tag = m[1]!.toLowerCase();
      const attrs = m[2]!;
      const attr = (name: string) => new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(attrs);
      for (const name of ["src", "poster", "data-src"]) {
        const a = attr(name);
        if (a) out.push(decode(a[2] ?? a[3] ?? ""));
      }
      const set = attr("srcset");
      if (set) for (const part of decode(set[2] ?? set[3] ?? "").split(",")) out.push(part.trim().split(/\s+/)[0] ?? "");
      /* A stylesheet, an icon or a preload is a file; an <a>, a canonical or an alternate is an address. */
      if (tag === "link" && /\srel\s*=\s*["'][^"']*\b(stylesheet|icon|apple-touch-icon|preload|manifest|mask-icon)\b/i.test(attrs)) { const h = attr("href"); if (h) out.push(decode(h[2] ?? h[3] ?? "")); }
      if (tag === "meta" && /\s(property|name)\s*=\s*["'](og:image|twitter:image)["']/i.test(attrs)) {
        const c = attr("content");
        if (c) out.push(decode(c[2] ?? c[3] ?? ""));
      }
    }
  }
  return out.filter(Boolean);
}

/** A reference as a site path (no leading slash), resolved against the file it is in; null when it is not a file of this site. */
export function resolveRef(ref: string, fromPath: string, liveAddress?: string | null): string | null {
  let r = ref.trim();
  if (!r) return null;
  if (liveAddress && r.startsWith(liveAddress.replace(/\/+$/, "") + "/")) r = r.slice(liveAddress.replace(/\/+$/, "").length);
  if (OFFSITE.test(r)) return null;
  let path: string;
  try {
    path = new URL(r, `https://site.invalid/${fromPath}`).pathname;
  } catch {
    return null;
  }
  try { path = decodeURIComponent(path); } catch { /* as written */ }
  path = path.replace(/^\/+/, "");
  if (!path || path.endsWith("/")) return null;
  return path;
}

/**
 * Every reference made good, or named. `files` is everything that is about
 * to go up; what comes back is what to add, and what is still missing.
 */
export async function completeSite(files: RefFile[], o: { fetchOwn: FetchOwn; liveAddress?: string | null }): Promise<{ added: RefFile[]; missing: Missing[] }> {
  const have = new Set(files.map((f) => f.path.replace(/^\/+/, "")));
  const wanted = new Map<string, Set<string>>();
  for (const f of files) {
    for (const ref of referencesIn(f)) {
      const path = resolveRef(ref, f.path, o.liveAddress);
      if (!path || have.has(path)) continue;
      if (!wanted.has(path)) wanted.set(path, new Set());
      wanted.get(path)!.add(f.path);
    }
  }
  const added: RefFile[] = [];
  const missing: Missing[] = [];
  for (const [path, from] of wanted) {
    const got = NEVER_COPIED.test(path) ? null : await o.fetchOwn(path).catch(() => null);
    if (got && got.bytes > 0 && got.bytes <= MOST) added.push({ path, content: got.base64, encoding: "base64" });
    else missing.push({ path, from: [...from].sort() });
  }
  missing.sort((a, b) => a.path.localeCompare(b.path));
  return { added, missing };
}

/** The Builder's own plain files, fetched from where it is running: a page or an error is not a file. */
export const fetchOwnFromBuilder: FetchOwn = async (path) => {
  const res = await fetch(`/${path.split("/").map(encodeURIComponent).join("/")}`, { cache: "force-cache" });
  if (!res.ok) return null;
  if (/text\/html/i.test(res.headers.get("content-type") ?? "")) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { base64: btoa(bin), bytes: buf.length };
};

/** The refusal, in plain words: what is missing, where it is used, and what to do. */
export function missingSays(missing: Missing[], pageName: (file: string) => string = (f) => f): string {
  const one = missing.length === 1;
  const list = missing.slice(0, 12).map((m) => `${m.path} (used on ${[...new Set(m.from.map(pageName))].join(", ")})`).join("; ");
  const more = missing.length > 12 ? `; and ${missing.length - 12} more` : "";
  const pictures = missing.some((m) => /^assets\/pictures\//.test(m.path));
  return `Not published: ${missing.length} file${one ? "" : "s"} the pages point at ${one ? "is" : "are"} not in the site, so ${one ? "it" : "they"} would be missing on the live site: ${list}${more}. ${pictures ? "Add the missing pictures again on the board, or remove the parts that show them" : "Remove the parts that use them"}, then press Update live site again.`;
}

export class SiteIncomplete extends Error {
  readonly missing: Missing[];
  readonly says: string;
  constructor(missing: Missing[], says: string) { super(says); this.name = "SiteIncomplete"; this.missing = missing; this.says = says; }
}
