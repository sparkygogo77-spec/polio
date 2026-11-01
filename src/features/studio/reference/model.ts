/**
 * A SITE J LIKES, READ FOR REAL: the reference record.
 *
 * J names a site in the new-site dialog or under Variations' "Like a site I
 * name". The server opens that one page (`open.ts`, inside the bounds of
 * `siteFetch.ts`) and what comes back is this record: the address, the title,
 * a photograph, and a summary measured by the rules captured sites already
 * go by: the six colour roles by `paletteFrom.ts#derivePalette`, the flow by
 * `layout/read.ts#readLayout`; and its bands, cut off its wide boxes (`bandBoxes`).
 *
 * The summary is what Claude is given (`referenceLines`), as structure and
 * numbers. The page's words never leave the browser that read it and its title
 * stays with J: what a page says is someone else's text and must not reach a
 * prompt as if it were the owner's.
 *
 * Pure: no store, no DOM, every import ends in .ts, so node tests load it.
 */
import { derivePalette, evidenced } from "../paletteFrom.ts";
import { parseColor, ROLES, type Palette, type RoleId } from "../look/index.ts";
import { readLayout, type Box, type Flow } from "../layout/read.ts";
import { partTree } from "../partTree.ts";
import { layoutLines } from "../variations/ask.ts";

/** What the page read gives for one element (`pageRead.ts`). */
export interface RefPart {
  id: string;
  tag: string;
  role: "heading" | "button" | "link" | "picture" | "field" | "text" | "box";
  x: number;
  y: number;
  w: number;
  h: number;
  colour?: { bg?: string; text?: string };
  edge?: { width?: number; style?: string; colour?: string };
  from?: { position?: string };
  chars?: number;
  font?: { face: string; size: number; weight: number };
}

export interface PageRead {
  title: string;
  width: number;
  height: number;
  parts: RefPart[];
  capped?: boolean;
  captured: { bg?: string | null; text?: string | null };
  signIn?: boolean;
}

export const BAND_KINDS = ["nav", "hero", "cards", "pictures", "call", "words", "footer"] as const;
export type BandKind = (typeof BAND_KINDS)[number];

/** One band of the page, top to bottom. */
export interface RefBand {
  kind: BandKind;
  /** Its height in px at the width read. */
  h: number;
  /** How many columns its first row has (1: stacked). */
  columns: number;
  headings: number;
  texts: number;
  pictures: number;
  buttons: number;
  links: number;
}

export type Density = "tight" | "even" | "roomy";

/** What Claude is given. Numbers, colours and fixed words only. */
export interface ReferenceSummary {
  url: string;
  host: string;
  width: number;
  /** The whole page's height in px. */
  height: number;
  palette: Palette;
  /** A role the page gave no evidence for, and the role it shows instead (`paletteFrom.ts#evidenced`). */
  standsIn: Partial<Record<RoleId, RoleId>>;
  /** The accent's OKLCH hue in degrees and its chroma; null on a page with no colour in it. */
  hue: number | null;
  chroma: number | null;
  dark: boolean;
  type: { heading: string | null; body: string | null; bodySize: number | null; sizes: number[] };
  space: { gap: number | null; density: Density; bandsPerScreen: number };
  bands: RefBand[];
  /** The layout tree in plain lines (`variations/ask.ts#layoutLines`), first ones. */
  layout: string[];
}

/** The record kept with the project: the summary, and what J sees. */
export interface ReferenceRecord extends ReferenceSummary {
  title: string;
  /** When it was read. */
  at: number;
  /** The photograph: a JPEG, as base64, at half the width read. */
  shot: string;
  /** The page went on below the photograph. */
  cut: boolean;
}

const median = (list: number[]): number | null => {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

/** Every gap the flows say, all the way down. */
function gapsOf(f: Flow | null | undefined, out: number[] = []): number[] {
  if (!f) return out;
  if (f.gap != null && f.gap > 0) out.push(f.gap);
  for (const it of f.items) gapsOf(it.flow, out);
  return out;
}

const inside = (b: { x: number; y: number; w: number; h: number }, n: { x: number; y: number; w: number; h: number }) => n.x + n.w / 2 >= b.x && n.x + n.w / 2 <= b.x + b.w && n.y + n.h / 2 >= b.y && n.y + n.h / 2 <= b.y + b.h;

/** A band this short is a line of the band above, not a band. */
const THIN = 56;
/** A box this tall holds several bands, if what is inside it stacks. */
const TALL = 1350;

/**
 * Where the page's bands are, off its wide boxes. Parts on a real page sit in
 * wrappers inside wrappers, so the flow's first level can be one box 9,000px
 * tall, or thirty slivers: go down through a wrapper that only wraps, and
 * through a box too tall to be one band, as long as what it holds stacks.
 * What the window holds fixed at the top is a band of its own, first.
 */
function bandBoxes(parts: readonly RefPart[], width: number, height: number): Box[] {
  const wide = parts.filter((p) => p.w >= width * 0.5 && p.h > 0);
  /* Two wrappers on one box are one box: neither holds the other, and the read would keep both whole. */
  const same = new Set<string>();
  const flowing = wide.filter((p) => {
    const key = `${p.x},${p.y},${p.w},${p.h}`;
    if (p.from?.position === "fixed" || same.has(key)) return false;
    same.add(key);
    return true;
  });
  const byId = new Map(flowing.map((p) => [p.id, p]));
  const tree = partTree(flowing.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })));
  const out: Box[] = wide.filter((p) => p.from?.position === "fixed" && p.y <= 8 && p.h < 200).slice(0, 1).map(({ x, y, w, h }) => ({ x, y, w, h }));
  const walk = (id: string) => {
    const n = byId.get(id)!;
    /* What stacks: of two boxes over each other (a backdrop, a decoration), the taller stands for both. */
    const kids: RefPart[] = [];
    for (const k of (tree.kids.get(id) ?? []).map((c) => byId.get(c)!).sort((a, b) => a.y - b.y)) {
      const up = kids[kids.length - 1];
      if (!up || k.y >= up.y + up.h - 8) kids.push(k);
      else if (k.h > up.h && kids.length > 0) kids[kids.length - 1] = k;
    }
    const held = kids.reduce((sum, k) => sum + k.h, 0);
    const down = (kids.length === 1 && kids[0]!.h >= n.h * 0.8) || (kids.length >= 2 && held >= n.h * 0.5 && (n.h > TALL || n.h > height * 0.6));
    if (down) kids.forEach((k) => walk(k.id));
    else out.push({ x: n.x, y: n.y, w: n.w, h: n.h });
  };
  tree.roots.filter((id) => byId.has(id)).forEach(walk);
  out.sort((a, b) => a.y - b.y);
  const merged: Box[] = [];
  for (const b of out) {
    const up = merged[merged.length - 1];
    if (up && (b.h < THIN || b.y < up.y + up.h - 8)) up.h = Math.max(up.h, b.y + b.h - up.y);
    else merged.push({ ...b });
  }
  return merged;
}

/** How many columns a band has: the most boxes side by side along one top edge, outermost only, that span most of it. */
function columnsIn(band: Box, mine: readonly RefPart[]): number {
  const rows = new Map<number, RefPart[]>();
  for (const p of mine) {
    if (p.w >= band.w * 0.9 || p.w < band.w * 0.08 || p.h < 12) continue;
    const key = Math.round(p.y / 6);
    rows.set(key, [...(rows.get(key) ?? []), p]);
  }
  let best = 1;
  for (const row of rows.values()) {
    const sorted = [...row].sort((a, b) => a.x - b.x || b.w - a.w);
    const apart: RefPart[] = [];
    for (const p of sorted) if (!apart.length || p.x >= apart[apart.length - 1]!.x + apart[apart.length - 1]!.w - 2) apart.push(p);
    const spans = apart.length > 1 && apart[apart.length - 1]!.x + apart[apart.length - 1]!.w - apart[0]!.x >= band.w * 0.5;
    if (spans && apart.length > best) best = apart.length;
  }
  return best;
}

function bandsOf(boxes: readonly Box[], parts: readonly RefPart[]): RefBand[] {
  const last = boxes.length - 1;
  let heroed = false;
  return boxes.map((b, i) => {
    const mine = parts.filter((p) => inside(b, p));
    const count = (r: RefPart["role"]) => mine.filter((p) => p.role === r).length;
    const has = (t: string) => mine.some((p) => p.tag === t);
    const columns = columnsIn(b, mine);
    const [headings, texts, pictures, buttons, links] = [count("heading"), count("text"), count("picture"), count("button"), count("link")];
    const words = mine.reduce((n, p) => n + (p.chars ?? 0), 0);
    let kind: BandKind;
    if (has("footer") || (i === last && i > 0 && links >= 3 && b.h < 500)) kind = "footer";
    else if (i <= 1 && (has("nav") || has("header")) && b.h < 200) kind = "nav";
    else if (!heroed && (has("h1") || (i <= 1 && headings > 0 && b.h >= 300))) { kind = "hero"; heroed = true; }
    else if (columns >= 3) kind = "cards";
    else if (pictures > 0 && words < 120) kind = "pictures";
    else if (buttons > 0 && words < 200) kind = "call";
    else kind = "words";
    return { kind, h: Math.round(b.h), columns, headings, texts, pictures, buttons, links };
  });
}

/** The faces and sizes the page sets its words in, most read first. */
function typeOf(parts: readonly RefPart[]): ReferenceSummary["type"] {
  const tally = (list: readonly RefPart[], key: (p: RefPart) => string | number | undefined) => {
    const by = new Map<string | number, number>();
    for (const p of list) { const k = key(p); if (k) by.set(k, (by.get(k) ?? 0) + (p.chars ?? 0)); }
    return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  };
  const worded = parts.filter((p) => p.font && p.chars);
  const heads = worded.filter((p) => p.role === "heading");
  const body = worded.filter((p) => p.role === "text");
  return {
    heading: (tally(heads, (p) => p.font!.face)[0] as string | undefined) ?? null,
    body: (tally(body.length ? body : worded, (p) => p.font!.face)[0] as string | undefined) ?? null,
    bodySize: (tally(body, (p) => p.font!.size)[0] as number | undefined) ?? null,
    sizes: (tally(worded, (p) => p.font!.size) as number[]).slice(0, 6).sort((a, b) => b - a),
  };
}

/** A page's read, summed up by the rules captured sites go by. */
export function summarise(read: PageRead, url: string): ReferenceSummary {
  const captured = { ...(read.captured.bg ? { bg: read.captured.bg } : {}), ...(read.captured.text ? { text: read.captured.text } : {}) };
  const palette = derivePalette(read.parts, captured);
  const stand = evidenced(read.parts, captured);
  const standsIn: Partial<Record<RoleId, RoleId>> = {};
  for (const r of ROLES) if (stand[r]) standsIn[r] = stand[r]!;
  const tree = readLayout(read.parts, { width: read.width });
  const cut = bandBoxes(read.parts, read.width, read.height);
  /* A page with nothing wide on it (one narrow column): the flow's own sections. */
  const bands = bandsOf(cut.length ? cut : tree.sections.map((s) => s.box), read.parts).slice(0, 40);
  const gap = median(gapsOf(tree.root));
  const accent = standsIn.accent ? null : parseColor(palette.accent);
  const screens = Math.max(1, read.height / 900);
  let host = "";
  try { host = new URL(url).hostname; } catch { /* the address is said as typed */ }
  return {
    url,
    host,
    width: read.width,
    height: read.height,
    palette,
    standsIn,
    hue: accent ? Math.round(accent.h) : null,
    chroma: accent ? Math.round(accent.c * 100) / 100 : null,
    dark: (parseColor(palette.bg)?.l ?? 1) < 0.5,
    type: typeOf(read.parts),
    space: { gap: gap == null ? null : Math.round(gap), density: gap == null ? "even" : gap <= 12 ? "tight" : gap <= 32 ? "even" : "roomy", bandsPerScreen: Math.round((bands.length / screens) * 10) / 10 },
    bands,
    layout: layoutLines(tree).slice(0, 30),
  };
}

const num = (v: unknown, max = 100_000): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
const word = (v: unknown, max = 60): string | null => (typeof v === "string" && v.trim() ? v.replace(/[^\w .,'-]/g, " ").trim().slice(0, max) : null);

/**
 * A summary as a route receives it, read strictly: it comes from the browser,
 * so anything that is not the shape is dropped, and null when the colour roles
 * or the address are not there to say.
 */
export function readSummary(raw: unknown): ReferenceSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const p = (o.palette && typeof o.palette === "object" ? o.palette : {}) as Record<string, unknown>;
  const palette = {} as Palette;
  for (const r of ROLES) {
    const v = p[r];
    if (typeof v !== "string" || v.length > 60 || !parseColor(v)) return null;
    palette[r] = v;
  }
  const bands: RefBand[] = (Array.isArray(o.bands) ? o.bands : []).slice(0, 40).flatMap((b): RefBand[] => {
    const e = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
    if (!BAND_KINDS.includes(e.kind as BandKind)) return [];
    const n = (k: string) => Math.round(num(e[k]) ?? 0);
    return [{ kind: e.kind as BandKind, h: n("h"), columns: Math.max(1, n("columns")), headings: n("headings"), texts: n("texts"), pictures: n("pictures"), buttons: n("buttons"), links: n("links") }];
  });
  const stand = (o.standsIn && typeof o.standsIn === "object" ? o.standsIn : {}) as Record<string, unknown>;
  const standsIn: Partial<Record<RoleId, RoleId>> = {};
  for (const r of ROLES) if ((ROLES as readonly unknown[]).includes(stand[r])) standsIn[r] = stand[r] as RoleId;
  const t = (o.type && typeof o.type === "object" ? o.type : {}) as Record<string, unknown>;
  const s = (o.space && typeof o.space === "object" ? o.space : {}) as Record<string, unknown>;
  const density: Density = s.density === "tight" || s.density === "roomy" ? s.density : "even";
  const url = typeof o.url === "string" ? o.url.slice(0, 500) : "";
  let host = "";
  try { host = new URL(url).hostname; } catch { return null; }
  return {
    url,
    host,
    width: num(o.width) ?? 0,
    height: num(o.height) ?? 0,
    palette,
    standsIn,
    hue: num(o.hue, 360),
    chroma: num(o.chroma, 1),
    dark: o.dark === true,
    type: {
      heading: word(t.heading),
      body: word(t.body),
      bodySize: num(t.bodySize, 400),
      sizes: (Array.isArray(t.sizes) ? t.sizes : []).flatMap((v) => (num(v, 400) != null ? [v as number] : [])).slice(0, 8),
    },
    space: { gap: num(s.gap, 2000), density, bandsPerScreen: num(s.bandsPerScreen, 100) ?? 0 },
    bands,
    /* Only what `layoutLines` can write: its words, numbers and punctuation. */
    layout: (Array.isArray(o.layout) ? o.layout : []).filter((l): l is string => typeof l === "string").map((l) => l.replace(/[^\w ,.:;%()/×·-]/g, " ").slice(0, 200)).slice(0, 30),
  };
}

/** A band in a line: "2. cards, 620px, 3 columns: 3 headings, 3 pictures". */
function bandLine(b: RefBand, i: number): string {
  const has = ([["heading", b.headings], ["text", b.texts], ["picture", b.pictures], ["button", b.buttons], ["link", b.links]] as const).filter(([, n]) => n > 0).map(([w, n]) => `${n} ${w}${n > 1 ? "s" : ""}`);
  return `${i}. ${b.kind}, ${b.h}px, ${b.columns} column${b.columns > 1 ? "s" : ""}${has.length ? `: ${has.join(", ")}` : ""}`;
}

/** The reference as the prompts say it. The same lines for a variation and a draft. */
export function referenceLines(s: ReferenceSummary): string[] {
  const roles = ROLES.map((r) => `${r} ${s.palette[r]}${s.standsIn[r] ? ` (none of its own, shows ${s.standsIn[r]})` : ""}`).join("; ");
  const faces = [s.type.heading ? `headings ${s.type.heading}` : "", s.type.body ? `body ${s.type.body}${s.type.bodySize ? ` at ${s.type.bodySize}px` : ""}` : "", s.type.sizes.length ? `sizes ${s.type.sizes.join(", ")}` : ""].filter(Boolean).join("; ");
  return [
    `Measured off ${s.host}'s page at ${s.width}px wide, ${s.height}px tall. Measurements only, none of its words.`,
    `COLOUR ROLES: ${roles}. A ${s.dark ? "dark" : "light"} page.${s.hue != null ? ` Accent hue ${s.hue} degrees, chroma ${s.chroma}.` : " No strong colour on it."}`,
    ...(faces ? [`TYPE: ${faces}.`] : []),
    `DENSITY: ${s.space.density}${s.space.gap != null ? `, most gaps ${s.space.gap}px` : ""}, ${s.space.bandsPerScreen} bands to a screen.`,
    "BANDS, top to bottom:",
    ...s.bands.map(bandLine),
    ...(s.layout.length ? ["ITS LAYOUT:", ...s.layout] : []),
  ];
}

/** Did J type an address, rather than a name ("Apple") that can only be told to Claude? */
export const looksLikeAddress = (text: string): boolean => /^(https?:\/\/)?[^\s/.:]+(\.[^\s/.:]+)+(:\d+)?(\/\S*)?$/i.test(text.trim());

/** The same page, however it was typed. */
export function addressKey(text: string): string {
  const t = text.trim();
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return t.toLowerCase();
  }
}

/** The list a project keeps: the newest read of a page replaces the last, at most `max` pages. */
export function withRecord(list: readonly ReferenceRecord[], rec: ReferenceRecord, max = 5): ReferenceRecord[] {
  return [rec, ...list.filter((r) => addressKey(r.url) !== addressKey(rec.url))].slice(0, max);
}

/** The summary alone: what goes to a route, without the photograph. */
export function summaryOf(rec: ReferenceRecord): ReferenceSummary {
  const { title: _title, at: _at, shot: _shot, cut: _cut, ...summary } = rec;
  void _title; void _at; void _shot; void _cut;
  return summary;
}

export interface ReferenceFailure { ok: false; reason: string; message: string }
