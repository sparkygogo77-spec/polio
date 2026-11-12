/**
 * MARK-UP AND SNAPSHOT PRESSES (✍️ MARKUP, J 2026-11-11: "id love to be able to mark for you whats missing with
 * something that you automatically register my drawn lines", and "where is my snapshot to edit button").
 *
 * The Builder sends what J drew, each stroke already registered (the elements it crossed or circled, its box),
 * with pictures as data. This keeps the words in the press row, which goes into handovers/console-presses.json
 * like every other press, and writes the pictures (and a snapshot's element map) as files under
 * handovers/open/markup/<date>/, named in the row by their path from handovers/. Nothing else is written.
 *
 * Everything is checked and cut to size here: the Builder page is not trusted to send a sane shape.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const MARKUP_KINDS = ["markup", "snapshot"] as const;
export const MAX_STROKES = 40;
export const MAX_POINTS = 240;
export const MAX_ELEMENTS = 60;
export const MAX_MAP = 1500;
/** A picture as base64, at most this long (about 1.5 MB of picture). */
export const MAX_PICTURE = 2_000_000;
/** The body a mark-up press may be: its pictures are in it. The other presses keep the helper's 1 MB. */
export const MARKUP_MAX_BODY = 12 << 20;

const PIC_TYPES: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" };

type Num = number;
const num = (v: unknown): Num | null => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\r\n?/g, "\n").replace(/\0/g, "").trim();
  return s ? s.slice(0, max) : undefined;
};
const box = (v: unknown) => {
  const b = (v ?? {}) as Record<string, unknown>;
  const x = num(b.x), y = num(b.y), w = num(b.w), h = num(b.h);
  return x === null || y === null || w === null || h === null ? undefined : { x, y, w, h };
};

/** One registered element, as the Builder describes it: words and boxes only. */
function element(v: unknown) {
  const e = (v ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, max] of [["how", 12], ["nodeId", 120], ["name", 160], ["feature", 80], ["role", 60], ["tag", 20], ["text", 200], ["attr", 160]] as const) {
    const s = str(e[k], max);
    if (s) out[k] = s;
  }
  const o = (e.owner ?? null) as Record<string, unknown> | null;
  if (o && typeof o === "object") { const attr = str(o.attr, 60), id = str(o.id, 120); if (attr && id) out.owner = { attr, id, ...(str(o.name, 120) ? { name: str(o.name, 120) } : {}) }; }
  const b = box(e.box), p = box(e.pageBox);
  if (b) out.box = b;
  if (p) out.pageBox = p;
  const hits = num(e.hits);
  if (hits !== null) out.hits = hits;
  return Object.keys(out).length ? out : null;
}

function picture(v: unknown): { ext: string; data: Buffer } | null | "bad" {
  if (v === undefined || v === null || v === "") return null;
  const p = v as { mime?: unknown; data?: unknown };
  if (typeof p !== "object" || typeof p.data !== "string" || typeof p.mime !== "string") return "bad";
  const ext = PIC_TYPES[p.mime];
  if (!ext || p.data.length > MAX_PICTURE || !/^[A-Za-z0-9+/]+=*$/.test(p.data)) return "bad";
  return { ext, data: Buffer.from(p.data, "base64") };
}

export type MarkupDone = { ok: true; extra: Record<string, unknown> } | { ok: false; status: number; error: string };

/**
 * Checks a markup or snapshot press and writes its pictures; hands back what goes in the row.
 * `handovers` is the folder console-presses.json is in.
 */
export function markupRow(handovers: string, kind: (typeof MARKUP_KINDS)[number], b: Record<string, unknown>, now: Date): MarkupDone {
  const day = now.toISOString().slice(0, 10);
  const stamp = now.toISOString().slice(11, 23).replace(/[:.]/g, "");
  const rel = `open/markup/${day}`;
  const files: { name: string; data: Buffer | string }[] = [];
  const extra: Record<string, unknown> = {};
  const note = str(b.note, 4000);
  if (note) extra.note = note;
  const view = (b.view ?? {}) as Record<string, unknown>;
  const vw = num(view.w), vh = num(view.h);
  if (vw !== null && vh !== null) extra.view = { w: vw, h: vh, ...(str(view.page, 160) ? { page: str(view.page, 160) } : {}), ...(str(view.site, 160) ? { site: str(view.site, 160) } : {}) };

  const pic = picture(b.picture);
  if (pic === "bad") return { ok: false, status: 400, error: "a picture is {mime: image/webp, png or jpeg, data: base64}, not too big" };
  if (pic) { const name = `${stamp}-${kind}.${pic.ext}`; files.push({ name, data: pic.data }); extra.picture = `${rel}/${name}`; }
  const missing = Array.isArray(b.missing) ? b.missing.map((m) => str(m, 120)).filter(Boolean).slice(0, 10) : [];
  if (missing.length) extra.missing = missing;

  if (kind === "markup") {
    if (!Array.isArray(b.strokes) || !b.strokes.length) return { ok: false, status: 400, error: "a mark-up has at least one stroke" };
    if (b.strokes.length > MAX_STROKES) return { ok: false, status: 400, error: `at most ${MAX_STROKES} strokes in one mark-up` };
    const strokes: Record<string, unknown>[] = [];
    for (const [i, raw] of (b.strokes as unknown[]).entries()) {
      const s = (raw ?? {}) as Record<string, unknown>;
      const shape = ["line", "circle", "arrow"].includes(s.shape as string) ? (s.shape as string) : null;
      const points = Array.isArray(s.points) ? (s.points as unknown[]).slice(0, MAX_POINTS).map((p) => (Array.isArray(p) ? [num(p[0]), num(p[1])] : null)).filter((p): p is [number, number] => !!p && p[0] !== null && p[1] !== null) : [];
      if (!shape || points.length < 2) return { ok: false, status: 400, error: `stroke ${i + 1} is a line, circle or arrow with at least two points` };
      const row: Record<string, unknown> = { n: i + 1, shape, points };
      const sb = box(s.box), pb = box(s.pageBox);
      if (sb) row.box = sb;
      if (pb) row.pageBox = pb;
      const sn = str(s.note, 1000);
      if (sn) row.note = sn;
      const els = Array.isArray(s.elements) ? (s.elements as unknown[]).slice(0, MAX_ELEMENTS).map(element).filter(Boolean) : [];
      row.elements = els;
      const near = Array.isArray(s.near) ? (s.near as unknown[]).slice(0, 6).map(element).filter(Boolean) : [];
      if (near.length) row.near = near;
      const sp = picture(s.picture);
      if (sp === "bad") return { ok: false, status: 400, error: `stroke ${i + 1}'s picture is not one the helper takes` };
      if (sp) { const name = `${stamp}-s${i + 1}.${sp.ext}`; files.push({ name, data: sp.data }); row.picture = `${rel}/${name}`; }
      strokes.push(row);
    }
    extra.strokes = strokes;
  } else {
    const map = Array.isArray(b.map) ? (b.map as unknown[]).slice(0, MAX_MAP).map(element).filter(Boolean) : [];
    if (!pic && !map.length) return { ok: false, status: 400, error: "a snapshot has a picture or an element map" };
    if (map.length) { const name = `${stamp}-snapshot-map.json`; files.push({ name, data: `${JSON.stringify(map, null, 1)}\n` }); extra.map = `${rel}/${name}`; extra.elements = map.length; }
  }

  try {
    const dir = join(handovers, ...rel.split("/"));
    mkdirSync(dir, { recursive: true });
    for (const f of files) writeFileSync(join(dir, f.name), f.data);
  } catch (e) { return { ok: false, status: 500, error: `couldn't write the mark-up's pictures: ${(e as Error).message}` }; }
  return { ok: true, extra };
}
