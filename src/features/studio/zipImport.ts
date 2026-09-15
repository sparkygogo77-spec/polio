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

export type ZipRefusal = "not-a-zip" | "zip64" | "too-big" | "too-many" | "bad-path" | "no-page" | "unread-method";

export const ZIP_REFUSAL_SAYS: Record<ZipRefusal, string> = {
  "not-a-zip": "That is not a zip file. It wants to be a .zip with a page in it.",
  "zip64": "That zip is written as Zip64, which this reader does not read. A page's zip is far smaller than Zip64 is for; export it again without it.",
  "unread-method": "The page in that zip is packed a way this reader cannot unpack (bzip2, LZMA or encrypted). Only stored and deflated entries are read; export it again as an ordinary zip.",
  "too-big": `That zip is too big to be one page. Up to ${Math.round(MAX_ZIP_BYTES / 1_000_000)} MB packed and ${Math.round(MAX_UNPACKED_BYTES / 1_000_000)} MB unpacked.`,
  "too-many": `That zip has too many files in it to be one page. Up to ${MAX_FILES}.`,
  "bad-path": "A file in that zip has a path that climbs out of it, so none of it is opened.",
  "no-page": "There is no page in that zip. It wants an index.html, or one .html file.",
};

/** A file as it sits in the zip: its path, how big it unpacks to, and how it is packed. */
export interface ZipEntry {
  name: string;
  size: number;
  /** 0 stored, 8 deflated; anything else the reader cannot unpack. Unknown when not said. */
  method?: number;
  encrypted?: boolean;
}

/** Can the reader unpack this entry? Unsaid counts as yes, for a caller that only knows names. */
export function readable(e: ZipEntry): boolean {
  return !e.encrypted && (e.method === undefined || e.method === 0 || e.method === 8);
}

export interface ZipOk {
  ok: true;
  /** The page that will be opened, as a path in the zip. */
  entry: string;
  /** The folder the page lives in, with a trailing slash, or "" at the root. */
  dir: string;
  /** Files in the zip the reader cannot unpack, which the page will ask for and not get. */
  unread: string[];
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
  // The page itself has to be readable; anything else unreadable is named, and answered as missing.
  if (!readable(files.find((e) => e.name === entry)!)) return no("unread-method");
  const cut = entry.lastIndexOf("/");
  return { ok: true, entry, dir: cut >= 0 ? entry.slice(0, cut + 1) : "", unread: files.filter((e) => !readable(e)).map((e) => e.name) };
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
  /**
   * When the block is a run of small boxes read as one band: every one of
   * them, in order, to be measured and merged. A page whose sections have
   * no box of their own (floated children, a height that collapsed to
   * nothing) lists its paragraphs as top-level boxes, and a paragraph a
   * part each is not a page.
   */
  members?: string[];
}

const holds = (outer: Box, inner: Box): boolean =>
  inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.w <= outer.x + outer.w + 1 && inner.y + inner.h <= outer.y + outer.h + 1;

/** How many blocks may make up one page. Past this a page is a document, and a document is prose. */
export const MAX_BLOCKS = 16;

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
  /*
   * One box is one block. A real page lists the same box under several
   * selectors (a `header`, the `div` that wraps it, the `h1` that fills
   * it), and three parts landed on top of one another from three names
   * for one thing. The first name for a box is kept, which is the outer
   * one, since candidates come biggest first.
   */
  const same = (a: Box, b: Box) => Math.abs(a.x - b.x) <= 2 && Math.abs(a.y - b.y) <= 2 && Math.abs(a.w - b.w) <= 2 && Math.abs(a.h - b.h) <= 2;
  let pool: Block[] = [];
  for (const c of candidates) {
    if (c.box.w <= 0 || c.box.h <= 0) continue;
    if (!pool.some((p) => same(p.box, c.box))) pool.push(c);
  }
  /*
   * Wrappers are opened. A block whose contents are bands stacked down it,
   * one under the next and together most of its height, is not a band of
   * the page but the column the bands are in: a `main` holding its
   * sections came through as one band of every word on the page. It is
   * replaced by what it holds, until no outermost block is such a column.
   * A first screen holding words beside a picture is not one: those sit
   * side by side, and it stays whole.
   */
  for (let guard = 0; guard < 8; guard++) {
    const outer = pool.filter((c) => !pool.some((o) => o !== c && holds(o.box, c.box) && (o.box.w * o.box.h > c.box.w * c.box.h)));
    const wrap = outer.find((c) => stacked(c.box, pool.filter((k) => k !== c && holds(c.box, k.box))));
    if (!wrap) return finish(outer);
    pool = pool.filter((c) => c !== wrap);
  }
  return finish(pool);
}

/** How tall a band of a page is, at least. A paragraph is not a band; a section is. */
export const MIN_BAND = 120;

/** Do these, the outermost of them, run down the box one under the next and fill most of it? */
function stacked(box: Box, inside: readonly Block[]): boolean {
  // The bands of a column are as wide as it, near enough, and tall enough
  // to be sections: a sidebar down one side is not a band and does not
  // stop it being a column, and a section is not opened into its
  // paragraphs, which came out as twelve parts of one page.
  const wide = (c: Block) => c.box.w >= box.w * 0.6;
  const outer = inside.filter((c) => wide(c) && !inside.some((o) => o !== c && holds(o.box, c.box) && o.box.w * o.box.h > c.box.w * c.box.h));
  /*
   * Two bands over one another are a band and the one under it whose box
   * was stretched up over the first band's floats: a section whose
   * children float has a box that ends above them, and the column after it
   * begins beside them. Where the larger holds nothing wide of its own in
   * the overlap, everything there being the smaller's, the larger begins
   * where the smaller ends (or ends where it begins). Where it does hold
   * something of its own there, the two are laid over one another and are
   * not one under the next.
   */
  const spans = outer.map((c) => ({ c, y: c.box.y, end: c.box.y + c.box.h }));
  for (const a of spans) {
    for (const b of spans) {
      if (b === a || b.c.box.h >= a.c.box.h) continue;
      const top = Math.max(a.y, b.y), bottom = Math.min(a.end, b.end);
      if (bottom - top <= 2) continue;
      const lap: Box = { x: box.x, y: top, w: box.w, h: bottom - top };
      const own = inside.some((k) => k !== a.c && k !== b.c && wide(k) && overlapY(k.box, lap) > 2 && !holds(b.c.box, k.box));
      if (own) continue;
      if (b.y <= a.y) a.y = Math.max(a.y, b.end);
      else a.end = Math.min(a.end, b.y);
    }
  }
  const bands = spans.filter((s) => s.end - s.y > 2).sort((p, q) => p.y - q.y);
  // A column has at least two sections in it: things a person would name,
  // a band or a screen, not boxes of words. A section of tall paragraphs
  // is not a column, and a bar and a footer count toward a column's height
  // but do not make it one.
  const section = (c: Block) => c.what !== "a box on the page" && c.what !== "a paragraph" && c.what !== "a heading";
  if (bands.filter((s) => s.end - s.y >= MIN_BAND && section(s.c)).length < 2) return false;
  let covered = 0;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i]!;
    covered += b.end - b.y;
    if (i === 0) continue;
    const p = bands[i - 1]!;
    // One under the next: an overlap of a margin's worth, never half a band.
    if (b.y < p.end - Math.max(24, Math.min(p.end - p.y, b.end - b.y) * 0.5)) return false;
  }
  return covered >= box.h * 0.5;
}

function finish(blocks: Block[]): Block[] {
  /* A small box that spills out of a bigger block it mostly sits in, a
     heading whose section's box ends above its foot, is that block's, and
     the block's words already hold it. */
  const kept = blocks.filter((b) => b.box.h >= MIN_BAND || !blocks.some((o) => o !== b && o.box.h > b.box.h && overlapY(o.box, b.box) >= b.box.h * 0.4 && b.box.x >= o.box.x - 2 && b.box.x + b.box.w <= o.box.x + o.box.w + 2));
  return runs(kept.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)).slice(0, MAX_BLOCKS);
}

const overlapY = (a: Box, b: Box): number => Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** How far apart two small boxes may sit and still be one band. */
const RUN_GAP = 60;

/**
 * Runs of small boxes down one column are one band.
 *
 * Small is under `MIN_BAND` tall; one column is the same left edge and
 * near the same width; a run is one under the next with no more than a
 * margin between. The band's box is the union, and it remembers its
 * members so each can be measured and the readings merged into one part.
 */
function runs(sorted: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of sorted) {
    // The band this continues, if any: the one in its column whose foot it
    // sits just under. Looked for rather than taken as the last emitted,
    // because a sidebar beside the column sorts in between its paragraphs.
    const i = b.box.h < MIN_BAND
      ? out.findIndex((last) => (last.members ? true : last.box.h < MIN_BAND)
        && Math.abs(b.box.x - last.box.x) <= 8 && Math.abs(b.box.w - last.box.w) <= Math.max(16, last.box.w * 0.1)
        && b.box.y >= last.box.y + last.box.h - 4 && b.box.y <= last.box.y + last.box.h + RUN_GAP)
      : -1;
    if (i >= 0) {
      const last = out[i]!;
      const members = last.members ?? [last.selector];
      const x = Math.min(last.box.x, b.box.x), y = last.box.y;
      const w = Math.max(last.box.x + last.box.w, b.box.x + b.box.w) - x;
      const h = b.box.y + b.box.h - y;
      out[i] = { ...last, box: { x, y, w, h }, words: `${last.words} ${b.words}`.trim(), members: [...members, b.selector] };
      continue;
    }
    out.push(b);
  }
  return out.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
}

/** The selectors a block is measured by: itself, or every member of a run. */
export const selectorsOf = (b: Block): string[] => b.members ?? [b.selector];

/**
 * Several readings as one: the run's boxes united, its words in order, its
 * links, buttons and pictures gathered, the paint and type of the first.
 * The children are the members, so the band's layout is a column of them.
 */
export function mergeReadings<R extends { box: Box; text: unknown[]; links: unknown[]; buttons: unknown[]; images: unknown[]; children: Box[]; layout: { flow: string; columns: number; gap: number } }>(readings: readonly R[]): R {
  const first = readings[0]!;
  if (readings.length === 1) return first;
  const x = Math.min(...readings.map((r) => r.box.x)), y = Math.min(...readings.map((r) => r.box.y));
  const w = Math.max(...readings.map((r) => r.box.x + r.box.w)) - x;
  const h = Math.max(...readings.map((r) => r.box.y + r.box.h)) - y;
  return {
    ...first,
    box: { x, y, w, h },
    text: readings.flatMap((r) => r.text),
    links: readings.flatMap((r) => r.links),
    buttons: readings.flatMap((r) => r.buttons),
    images: readings.flatMap((r) => r.images),
    children: readings.map((r) => ({ x: r.box.x - x, y: r.box.y - y, w: r.box.w, h: r.box.h })),
    layout: { flow: "column", columns: 1, gap: 0 },
  };
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
  /*
   * To a hundredth of a pixel, not a whole one. Placed on whole pixels, a
   * 60px bar on a 3077px page landed 31px tall on a 1573px surface: a
   * share of 0.0197 against the page's 0.0195, and 16 of 36 locked shares
   * split at the third decimal that way. A hundredth is a thousandth of
   * a share on the smallest surface anyone draws, and nothing on the board
   * can see it.
   */
  const h = Math.max(surface.h, fine(bottom * scale));
  const places = blocks.map((b) => ({
    x: fine(surface.x + b.x * scale),
    y: fine(surface.y + b.y * scale),
    w: Math.max(24, fine(b.w * scale)),
    h: Math.max(16, fine(b.h * scale)),
  }));
  return { surface: { x: surface.x, y: surface.y, w: surface.w, h }, places, scale };
}

/** A board length to the hundredth of a pixel: as fine as the layout needs, as plain as a number can stay. */
export const fine = (v: number): number => Math.round(v * 100) / 100;

/**
 * The type, scaled as the box was.
 *
 * A part's `size` is a multiple of the site's base, and the reading sets
 * it from the page's own pixels. Laid on a surface half the page's width,
 * a first screen kept its 48px headline in a box half as tall and the
 * words were cut off at the top. The words are scaled by the same number
 * as the box, so a 60px line in a 600px band lands near 30px in a 300px
 * one. The theme floors `size` at 0.6, so a surface drawn narrower than
 * six tenths of the page still lands its words a shade larger than the
 * page had them; that is the theme's floor, named here rather than moved.
 */
export function scaledType<F extends { size?: number }>(font: F | null | undefined, scale: number): F {
  const had = (font ?? {}) as F;
  const size = (typeof had.size === "number" && Number.isFinite(had.size) ? had.size : 1) * scale;
  return { ...had, size: Math.round(size * 100) / 100 };
}

/**
 * What the panel offers to press, in order: the page's own blocks first,
 * top to bottom, then everything else biggest first.
 *
 * The list was the biggest 24 of 60, and the bar across the top of a real
 * page is short, so it was the 38th thing and not on the list at all: the
 * one thing a person points at first could only be had by taking the
 * whole page. The blocks are what a person means by the page; the rest is
 * what is inside them.
 */
export function offered(candidates: readonly Block[], cap = 24): Block[] {
  const blocks = pageBlocks(candidates);
  const same = (a: Box, b: Box) => Math.abs(a.x - b.x) <= 2 && Math.abs(a.y - b.y) <= 2 && Math.abs(a.w - b.w) <= 2 && Math.abs(a.h - b.h) <= 2;
  const rest = candidates.filter((c) => !blocks.some((b) => same(b.box, c.box) || (b.members ?? []).includes(c.selector)));
  return [...blocks, ...rest].slice(0, cap);
}

/* ------------------------------------------------------------------ */
/* What reached the bar, said plainly                                   */
/* ------------------------------------------------------------------ */

/** What `recreateFrom` said about one block, as this file needs it. */
export interface Landed {
  id: string;
  sure: number;
  wantsPicture: boolean;
  /** The family the page named, and whether it drew where the page was read. */
  face?: { name: string; drew: boolean } | null;
}

/** How sure a match had to be for the catalogue to claim it. Held to `recreate.ts` by the test. */
export const SURE = 0.5;

const NAMES: Record<string, string> = {
  "top-bar": "a top bar",
  hero: "a first screen",
  cards: "cards",
  button: "a button",
  footer: "a footer",
  links: "a list of links",
};

/**
 * Which blocks arrived as real parts, and which as something less.
 *
 * Said in one line, because the difference is the whole point and must
 * not go unmentioned. A block the catalogue claimed is a real part of the
 * library with the page's own words, paint and type in it, movable and
 * promptable like anything drawn. A block it did not claim is a band of
 * words: the words and the paint are real, the shape is not its own. A
 * picture inside any of them stays a placeholder, and the line says so
 * rather than promising a step: a landed part has no picture of its own
 * to show, and the grounded step (`recreate`) runs on drawings only,
 * from the first drawing a queue job made. Putting it in a landed part's
 * order and pressing Make it again runs nothing.
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
  if (pictures) bits.push(`${pictures} hold${pictures === 1 ? "s" : ""} a picture that stays a placeholder: a landed part has no picture of its own to show, and the grounded step runs on drawings only.`);
  // A web font the page loads from the network comes on neither door. The
  // name travels with the part; what shows is the nearest face this
  // machine has until the real one is on it.
  const missing = landed.filter((l) => l.face && !l.face.drew);
  if (missing.length) {
    const names = [...new Set(missing.map((l) => l.face!.name))];
    bits.push(`${missing.length} ${missing.length === 1 ? "is" : "are"} set in a face that did not travel with the page (${names.slice(0, 3).join(", ")}${names.length > 3 ? ", and more" : ""}): the name is on the part, and it shows in the nearest face this machine has.`);
  }
  if (scriptsDropped) bits.push("The page brought scripts, which were not run: whatever they would have drawn is not here.");
  return bits.join(" ");
}
