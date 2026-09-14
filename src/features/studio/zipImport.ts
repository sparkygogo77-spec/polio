/**
 * A zip arrives, and its page becomes parts.
 *
 * The final test, in J's words: something he did not make in this tool
 * arrives and becomes editable in the same way as something he drew. A
 * zip is the right first proof of the measure-first idea because it is
 * local. It never leaves the machine, so nothing here needs egress, and
 * the bounds are about what is in the zip rather than where it came from.
 *
 * The page inside it is opened by the same browser that reads a live site
 * (`api/studio/zip`), and every request the page makes is answered out of
 * the zip or refused, so a page from a zip cannot ask the network for
 * anything. What the browser measures goes through the very same
 * `CANDIDATES` and `MEASURE` as a live page, and the same `recreateFrom`
 * decides which real part each block becomes. This file is the part that
 * is the zip's own: what may be in it, which file is the page, what a
 * request from that page may be answered with, which blocks make up the
 * page, and how they are placed on a surface so the layout he was handed
 * is the layout he gets.
 *
 * Pure: no fetch, no browser, no zip parsing (that is `zipFile.ts`, on
 * the server, because it wants `node:zlib`). `tests/zip-import.mjs` holds
 * it.
 */
import type { Box } from "./space.ts";

/* ------------------------------------------------------------------ */
/* Bounds                                                               */
/* ------------------------------------------------------------------ */

/** How big a zip may be. A site export is a few megabytes; past this it is a backup, not a design. */
export const MAX_ZIP_BYTES = 30_000_000;
/** How many files a page may bring. */
export const MAX_FILES = 600;
/** How big any one file may be once unpacked. */
export const MAX_FILE_BYTES = 12_000_000;
/** And all of them together. A zip is small and unpacks big, which is the classic way to fill a disk. */
export const MAX_UNPACKED_BYTES = 80_000_000;
/** How long the read may take on the server, inside the route's own `maxDuration`. */
export const ZIP_BUDGET_MS = 25_000;

export type ZipRefusal = "not-a-zip" | "too-big" | "too-many" | "bad-path" | "no-page";

export const ZIP_REFUSAL_SAYS: Record<ZipRefusal, string> = {
  "not-a-zip": "That is not a zip file. It wants to be a .zip with a page in it.",
  "too-big": `That zip is too big to be one page. Up to ${Math.round(MAX_ZIP_BYTES / 1_000_000)} MB packed and ${Math.round(MAX_UNPACKED_BYTES / 1_000_000)} MB unpacked.`,
  "too-many": `That zip has too many files in it to be one page. Up to ${MAX_FILES}.`,
  "bad-path": "A file in that zip has a path that climbs out of it, so none of it is opened.",
  "no-page": "There is no page in that zip. It wants an index.html, or one .html file.",
};

/** A file as it sits in the zip: its path and how big it unpacks to. */
export interface ZipEntry {
  name: string;
  size: number;
}

export interface ZipOk {
  ok: true;
  /** The page that will be opened, as a path in the zip. */
  entry: string;
  /** The folder the page lives in, with a trailing slash, or "" at the root. */
  dir: string;
}
export interface ZipNo {
  ok: false;
  why: ZipRefusal;
  says: string;
}

/**
 * A path that stays inside the zip.
 *
 * Nothing absolute, nothing that climbs, nothing with a drive letter or a
 * backslash in it, because the names are used to answer the page's own
 * requests and a name that could mean somewhere else must not exist.
 */
export function insideZip(name: string): boolean {
  if (!name || name.length > 512) return false;
  if (name.startsWith("/") || name.includes("\\") || /^[a-z]:/i.test(name)) return false;
  if (name.includes("\0")) return false;
  return !name.split("/").some((bit) => bit === "..");
}

/**
 * Which file is the page.
 *
 * `index.html` nearest the root; failing that, `index.htm`; failing that,
 * the one .html there is, or the nearest to the root and first by name.
 * One page: a zip holding a whole site is opened at its front door and
 * nowhere else, the same rule as a live address.
 */
export function pageEntry(names: readonly string[]): string | null {
  const html = names.filter((n) => /\.html?$/i.test(n) && !n.endsWith("/"));
  if (!html.length) return null;
  const depth = (n: string) => n.split("/").length;
  const byPlace = (a: string, b: string) => depth(a) - depth(b) || a.localeCompare(b);
  const named = (base: RegExp) => html.filter((n) => base.test(n.split("/").pop() ?? "")).sort(byPlace)[0];
  return named(/^index\.html$/i) ?? named(/^index\.htm$/i) ?? [...html].sort(byPlace)[0] ?? null;
}

/** May this zip be opened, and at which file? The one place that decides. */
export function checkZip(entries: readonly ZipEntry[], packedBytes: number): ZipOk | ZipNo {
  const no = (why: ZipRefusal): ZipNo => ({ ok: false, why, says: ZIP_REFUSAL_SAYS[why] });
  if (packedBytes > MAX_ZIP_BYTES) return no("too-big");
  const files = entries.filter((e) => !e.name.endsWith("/"));
  if (files.length > MAX_FILES) return no("too-many");
  if (files.some((e) => !insideZip(e.name))) return no("bad-path");
  if (files.some((e) => e.size > MAX_FILE_BYTES)) return no("too-big");
  if (files.reduce((n, e) => n + e.size, 0) > MAX_UNPACKED_BYTES) return no("too-big");
  const entry = pageEntry(files.map((e) => e.name));
  if (!entry) return no("no-page");
  const cut = entry.lastIndexOf("/");
  return { ok: true, entry, dir: cut >= 0 ? entry.slice(0, cut + 1) : "" };
}

/* ------------------------------------------------------------------ */
/* Answering the page                                                   */
/* ------------------------------------------------------------------ */

/** What a file in the zip is served as. Anything not here is refused to the page. */
export function contentType(name: string): string | null {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const known: Record<string, string> = {
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    json: "application/json",
    txt: "text/plain; charset=utf-8",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  return known[ext] ?? null;
}

/**
 * The file in the zip a request from the page means.
 *
 * The page is opened at `https://<zip>/<entry>`, so a relative address
 * resolves to a path in the zip as it is. A root-relative one (`/css/a.css`)
 * was written against the folder the page is in, so that folder is tried
 * too. A folder means the index in it. Nothing else is answered.
 */
export function fileFor(path: string, names: ReadonlySet<string>, dir: string): string | null {
  const clean = decodeURIComponent(path.replace(/^\/+/, "").split(/[?#]/)[0] ?? "");
  if (!clean || !insideZip(clean)) return null;
  for (const c of [clean, `${dir}${clean}`, `${clean.replace(/\/?$/, "/")}index.html`, `${dir}${clean.replace(/\/?$/, "/")}index.html`]) {
    if (names.has(c)) return c;
  }
  return null;
}

/**
 * The page with no script in it.
 *
 * The browser on the server opens the zip's page with its scripts taken
 * out: every `<script>`, and every `on…=` handler. Measuring is done on
 * what the HTML and the CSS say, which is what an exported site is. A page
 * that draws itself with JavaScript arrives as whatever its HTML holds,
 * and the panel says so rather than letting it pass as the whole page.
 */
export function sansScripts(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

/** Did the page bring scripts? Said on the panel, because what they would have drawn is not here. */
export function hadScripts(html: string): boolean {
  return /<script\b/i.test(html);
}

/* ------------------------------------------------------------------ */
/* The whole page, as blocks                                            */
/* ------------------------------------------------------------------ */

/** What `CANDIDATES` hands back, as this file needs it. */
export interface Block {
  selector: string;
  what: string;
  box: Box;
  words: string;
}

const holds = (outer: Box, inner: Box): boolean =>
  inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.w <= outer.x + outer.w + 1 && inner.y + inner.h <= outer.y + outer.h + 1;

/** How many blocks may make up one page. Past this a page is a document, and a document is prose. */
export const MAX_BLOCKS = 12;

/**
 * The blocks that make up the page: the outermost ones, top to bottom.
 *
 * `CANDIDATES` lists everything worth pointing at, nested and all. A page
 * taken whole is its top-level bands: the ones no other candidate holds,
 * once the wrapper that holds everything (a `main`, a `.page`) is set
 * aside. That wrapper is a candidate that holds two or more others and
 * covers most of what is listed; it is not a band, it is the page, and the
 * surface is the page here.
 */
export function pageBlocks(candidates: readonly Block[]): Block[] {
  let pool = candidates.filter((c) => c.box.w > 0 && c.box.h > 0);
  for (let guard = 0; guard < 6; guard++) {
    const outer = pool.filter((c) => !pool.some((o) => o !== c && holds(o.box, c.box) && (o.box.w * o.box.h > c.box.w * c.box.h)));
    if (outer.length !== 1) return finish(outer);
    // One outermost block holding others is the page's wrapper: open it.
    const wrap = outer[0]!;
    const inside = pool.filter((c) => c !== wrap && holds(wrap.box, c.box));
    if (inside.length < 2) return finish(outer);
    pool = inside;
  }
  return finish(pool);
}

function finish(blocks: Block[]): Block[] {
  return [...blocks].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x).slice(0, MAX_BLOCKS);
}

/* ------------------------------------------------------------------ */
/* Onto the surface                                                     */
/* ------------------------------------------------------------------ */

export interface Fitted {
  /** The surface, grown to the page's proportion at the width it was drawn. */
  surface: Box;
  /** Where each block lands on the board, in the blocks' order. */
  places: Box[];
  /** The page's width over the surface's: how much smaller it is drawn. */
  scale: number;
}

/**
 * The page laid onto the surface, in the proportion it had.
 *
 * The width is the one he drew; the height follows the page, so a tall
 * page makes a tall surface rather than a squashed one. Every block keeps
 * its place and its size as a share of the page, which is what the
 * surface then locks: the layout he was handed is the specification.
 */
export function fitToSurface(surface: Box, pageW: number, blocks: readonly Box[]): Fitted {
  const w = Math.max(1, pageW);
  const scale = surface.w / w;
  const bottom = blocks.reduce((m, b) => Math.max(m, b.y + b.h), 0);
  const h = Math.max(surface.h, Math.round(bottom * scale));
  const places = blocks.map((b) => ({
    x: Math.round(surface.x + b.x * scale),
    y: Math.round(surface.y + b.y * scale),
    w: Math.max(24, Math.round(b.w * scale)),
    h: Math.max(16, Math.round(b.h * scale)),
  }));
  return { surface: { x: surface.x, y: surface.y, w: surface.w, h }, places, scale };
}

/* ------------------------------------------------------------------ */
/* What reached the bar, said plainly                                   */
/* ------------------------------------------------------------------ */

/** What `recreateFrom` said about one block, as this file needs it. */
export interface Landed {
  id: string;
  sure: number;
  wantsPicture: boolean;
}

/** How sure a match had to be for the catalogue to claim it. Held to `recreate.ts` by the test. */
export const SURE = 0.5;

const NAMES: Record<string, string> = {
  "top-bar": "a top bar",
  hero: "a first screen",
  cards: "cards",
  button: "a button",
  footer: "a footer",
};

/**
 * Which blocks arrived as real parts, and which as something less.
 *
 * Said in one line, because the difference is the whole point and must
 * not go unmentioned. A block the catalogue claimed is a real part of the
 * library with the page's own words, paint and type in it, movable and
 * promptable like anything drawn. A block it did not claim is a band of
 * words: the words and the paint are real, the shape is not its own. A
 * picture inside any of them is not measured, it is the grounded step's.
 */
export function saidOf(landed: readonly Landed[], from: string, scriptsDropped = false): string {
  const n = landed.length;
  if (!n) return `Nothing on the page in ${from} could be made into a part.`;
  const real = landed.filter((l) => l.id !== "prose");
  const less = n - real.length;
  const kinds = [...new Set(real.map((l) => NAMES[l.id] ?? l.id))];
  const bits: string[] = [];
  bits.push(`${real.length} of ${n} block${n === 1 ? "" : "s"} from ${from} ${real.length === 1 ? "is a real part" : "are real parts"} of the library${kinds.length ? ` (${kinds.join(", ")})` : ""}: move, resize and prompt ${real.length === 1 ? "it" : "them"} like anything drawn.`);
  if (less) bits.push(`${less} arrived as a band of words: the words and the paint are real, the shape is not its own.`);
  const pictures = landed.filter((l) => l.wantsPicture).length;
  if (pictures) bits.push(`${pictures} hold${pictures === 1 ? "s" : ""} a picture that only the grounded step can make.`);
  if (scriptsDropped) bits.push("The page brought scripts, which were not run: whatever they would have drawn is not here.");
  return bits.join(" ");
}
