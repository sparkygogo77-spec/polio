/**
 * A FREE CONCEPT, DRAFTED: words from the subject, drawn in its direction's
 * theme, moved onto its direction's spec by the variations' own build.
 *
 *   conceptVersions   the pages, every part with its words (`copy.ts`)
 *   themeFor          the direction's System (`taste.ts`)
 *   systemFor         the variations' taste pass over that System
 *                     (`variations/tokens.ts`): colours on the spec's hue,
 *                     type on its ratio and pairing, space on the grid,
 *                     motion; done BEFORE the page is drawn, so every box is
 *                     measured at the size its words really are
 *   buildSite         the page as real parts in that System (`idea/versions.ts`)
 *   alignFirstScreen  the first screen centred where the direction says
 *
 * No Claude, no store, no browser: `run.ts` writes what this answers, and
 * `tests/concept-taste.mjs` measures it.
 */
import { buildSite, wholeVersion, type Versions } from "../idea/versions.ts";
import { formatOf } from "../starterPage.ts";
import { themeColours } from "../siteTheme.ts";
import { systemFor, type FaceRoles } from "../variations/tokens.ts";
import type { System } from "../system/model.ts";
import { planToBoard } from "../idea/planToBoard.ts";
import type { PlanPart } from "../idea/plan.ts";
import { DIRECTIONS, conceptVersions, directionOf, linesFor, pageFor, subjectOf, type Voice } from "./copy.ts";
import { partsOfSection, sectionOfPart, type PartLike } from "./model.ts";
import { rolesOf } from "../system/resolve.ts";
import { picker } from "./copy.ts";
import { specFor, themeFor } from "./taste.ts";
import { conceptName } from "./model.ts";

export const FRAME = 1440;

/** A small hash of some words, so a subject turns the seeds it draws with. */
export function hashOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export interface Drafted {
  name: string;
  direction: string;
  pitch: string;
  voice: Voice;
  doc: Record<string, unknown> & { nodes: unknown[]; pages: unknown[]; system?: System | null; systemId?: string | null };
  system: System;
}

/** One version of `v` drawn whole in `system`, as a site document. */
export function docOf(v: Versions, i: number, system: System, theme: ReturnType<typeof themeFor>["theme"] | null, name: string): Drafted["doc"] {
  const site = buildSite(v, wholeVersion(v, i), system, { frameWidth: FRAME, words: "fill" });
  return {
    pages: site.pages,
    nodes: site.nodes,
    groups: [],
    look: { palette: site.palette },
    ...(theme ? { format: formatOf(theme, themeColours(theme)) } : {}),
    brief: { name, description: v.versions[i]?.pitch ?? v.description },
    systemId: system.id,
    system,
    activePageId: (site.pages[0] as { id?: string } | undefined)?.id,
    frameWidth: FRAME,
  };
}

/**
 * A picture or a gallery with corners is drawn inside a box wrapper whose
 * height is "auto", and a part that fills its box ends 8 px tall (seen on
 * the canvas: a thin bar where the picture should be). Until that wrapper
 * is fixed, a drafted picture keeps square corners: its radius and the
 * link to the radius token come off.
 */
export function squarePictures<N extends { featureId?: string; radius?: unknown; sys?: { f?: Record<string, string>; v?: Record<string, unknown>; s?: string } | null }>(nodes: readonly N[]): N[] {
  return nodes.map((n) => {
    if (n.featureId !== "picture" && n.featureId !== "gallery") return n;
    const f = { ...(n.sys?.f ?? {}) }; delete f.radius;
    const v = { ...(n.sys?.v ?? {}) }; delete v.radius;
    return { ...n, radius: null, sys: n.sys ? { ...n.sys, f, v } : n.sys };
  });
}

/* ------------------------------------------------------------------ */
/* Pictures as colour blocks and shapes                                 */
/* ------------------------------------------------------------------ */

type ArtNode = PartLike & { featureId?: string; label?: string; radius?: unknown; art?: { background?: string } | null; colour?: { bg?: string | null } | null; shape?: string | null; sys?: unknown };
type Box = { x: number; y: number; w: number; h: number };

/** The direction's colours for a picture: a ground, a second ground, a mark, a line. */
function paints(system: System, voice: Voice): { a: string; b: string; mark: string; line: string } {
  const r = rolesOf(system) as Record<string, string | undefined>;
  const bg = r.bg ?? "#f4f4f4", surface = r.surface ?? bg, accent = r.accent ?? "#888", muted = r.muted ?? "#999", text = r.text ?? "#222";
  switch (voice) {
    case "calm": return { a: muted, b: surface, mark: muted, line: muted };
    case "bold": return { a: accent, b: surface, mark: accent, line: accent };
    case "warm": return { a: accent, b: surface, mark: accent, line: muted };
    case "night": return { a: surface, b: bg, mark: accent, line: accent };
  }
}

/** A colour as numbers: rgb(...), rgba(...) or #hex; null for anything else. */
function rgbOf(css: string): [number, number, number] | null {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(css) ?? /^rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)/.exec(css);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  const h = /^#([0-9a-f]{6})$/i.exec(css.trim());
  if (h) return [parseInt(h[1]!.slice(0, 2), 16), parseInt(h[1]!.slice(2, 4), 16), parseInt(h[1]!.slice(4, 6), 16)];
  const h3 = /^#([0-9a-f]{3})$/i.exec(css.trim());
  if (h3) return [parseInt(h3[1]![0]! + h3[1]![0]!, 16), parseInt(h3[1]![1]! + h3[1]![1]!, 16), parseInt(h3[1]![2]! + h3[1]![2]!, 16)];
  return null;
}

/** `a` moved `t` of the way to `b` (0 a, 1 b); `a` as given when either cannot be read. */
export function mix(a: string, b: string, t: number): string {
  const x = rgbOf(a), y = rgbOf(b);
  if (!x || !y) return a;
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(x[0] + (y[0] - x[0]) * k)}, ${Math.round(x[1] + (y[1] - x[1]) * k)}, ${Math.round(x[2] + (y[2] - x[2]) * k)})`;
}

/**
 * One picture's worth of boxes in a rectangle: a tinted ground (the
 * direction's colour moved most of the way to its surface), a second block
 * on it, and one or two shapes, placed by seed. Solid fills only: a box
 * paints its `colour.bg` everywhere, and nothing else is needed.
 */
function artIn<N extends ArtNode>(like: N, box: Box, voice: Voice, p: ReturnType<typeof paints>, seed: number, label: string, tag: string): N[] {
  const r = picker(seed);
  const groundOf = voice === "night" ? mix(p.a, p.mark, r([0.1, 0.16, 0.22])) : mix(p.b, p.a, r([0.22, 0.3, 0.38]));
  const blockOf = voice === "night" ? mix(p.a, p.mark, r([0.3, 0.4])) : mix(p.b, p.a, r([0.5, 0.62]));
  const base = (id: string, b: Box, more: Record<string, unknown>): N => ({
    ...like, id: `${tag}_${id}`, featureId: "box", label, content: "", data: "", sys: null, radius: like.radius ?? null, colour: { ...((like.colour as object | null) ?? {}), bg: groundOf }, art: null, shape: "box", options: {}, ...b, ...more,
  } as N);
  const out: N[] = [base("ground", box, {})];
  const s = Math.round(Math.min(box.w, box.h) * r([0.28, 0.36, 0.44]));
  const mx = box.x + Math.round((box.w - s) * r([0.12, 0.3, 0.6, 0.78]));
  const my = box.y + Math.round((box.h - s) * r([0.15, 0.4, 0.7]));
  /* A second block: a band across the lower part, or a tall block to one side, so the ground is not one flat field. */
  const tall = r([true, false]);
  out.push(base("block", tall
    ? { x: box.x + (r([true, false]) ? 0 : Math.round(box.w * 0.55)), y: box.y, w: Math.round(box.w * 0.45), h: box.h }
    : { x: box.x, y: box.y + Math.round(box.h * r([0.55, 0.66])), w: box.w, h: Math.round(box.h * r([0.34, 0.45])) }, { colour: { bg: blockOf }, radius: 0 }));
  if (voice === "calm") {
    const ly = box.y + Math.round(box.h * r([0.62, 0.7]));
    out.push(base("line", { x: box.x + Math.round(box.w * 0.08), y: ly, w: Math.round(box.w * 0.84), h: 2 }, { colour: { bg: p.line }, radius: 0 }));
    const d = Math.round(s * 0.55);
    out.push(base("disc", { x: mx, y: Math.max(box.y + 8, ly - d - 10), w: d, h: d }, { colour: { bg: p.mark }, shape: "circle", radius: 999 }));
  } else if (voice === "bold") {
    out.push(base("mark", { x: mx, y: my, w: s, h: Math.round(s * 0.62) }, { colour: { bg: p.a }, radius: like.radius ?? 0 }));
    out.push(base("bar", { x: box.x, y: box.y + box.h - Math.round(box.h * 0.1), w: Math.round(box.w * 0.6), h: Math.round(box.h * 0.1) }, { colour: { bg: p.line }, radius: 0 }));
  } else if (voice === "warm") {
    out.push(base("disc", { x: mx, y: my, w: s, h: s }, { colour: { bg: p.a }, shape: "circle", radius: 999 }));
    out.push(base("pill", { x: box.x + Math.round(box.w * r([0.08, 0.5])), y: box.y + box.h - Math.round(s * 0.5) - 16, w: Math.round(s * 0.9), h: Math.round(s * 0.3) }, { colour: { bg: p.line }, shape: "rounded", radius: 999 }));
  } else {
    out.push(base("glow", { x: mx, y: my, w: s, h: s }, { colour: { bg: p.mark }, shape: "circle", radius: 999 }));
    out.push(base("rule", { x: box.x + Math.round(box.w * 0.06), y: box.y + Math.round(box.h * r([0.2, 0.8])), w: Math.round(box.w * 0.3), h: 3 }, { colour: { bg: p.line }, radius: 0 }));
  }
  return out;
}

/**
 * PICTURES AS COLOUR BLOCKS AND SHAPES. The kit has one scene picture, and
 * every drafted page wore the same sky, six times in a gallery: a template
 * again. So a planned `picture` becomes a gradient ground in the
 * direction's colours with one or two shapes on it, and a planned
 * `gallery` a 3 x 2 of those, each placed by its own seed; the seed comes
 * from the subject, so two prompts draw two sets. Labels keep the section.
 */
export function paintPictures<N extends ArtNode>(nodes: readonly N[], voice: Voice, system: System, seed: number): N[] {
  const p = paints(system, voice);
  const out: N[] = [];
  let k = 0;
  for (const n of nodes) {
    if (n.featureId === "picture") {
      out.push(...artIn(n, { x: n.x, y: n.y, w: n.w, h: n.h }, voice, p, seed + k * 331, n.label ?? "Picture: picture", `art${k}`));
      k++;
    } else if (n.featureId === "gallery") {
      const cols = 3, rows = 2, gap = 16;
      const w = Math.floor((n.w - gap * (cols - 1)) / cols), h = Math.floor((n.h - gap * (rows - 1)) / rows);
      for (let i = 0; i < cols * rows; i++) {
        const box = { x: n.x + (i % cols) * (w + gap), y: n.y + Math.floor(i / cols) * (h + gap), w, h };
        out.push(...artIn(n, box, voice, p, seed + k * 331 + i * 97, `${sectionOfPart(n.label)}: picture ${i + 1}`, `art${k}_${i}`));
      }
      k++;
    } else out.push(n);
  }
  return out;
}

/** Where each direction's first screen sits: centred on its one message, or set left. */
export const FIRST_SCREEN_ALIGN: Record<Voice, "start" | "center"> = { calm: "start", bold: "center", warm: "center", night: "start" };

/**
 * The first screen's parts centred (or left as laid): the heading and words
 * centred on the frame with their text centred, the buttons' row centred as
 * one. A drafted page has no layout tree yet, so `relayout` cannot do this.
 */
export function alignFirstScreen<N extends { label?: string; featureId?: string; x: number; y: number; w: number; text?: unknown }>(nodes: readonly N[], align: "start" | "center", width = FRAME): N[] {
  if (align !== "center") return [...nodes];
  const mine = nodes.filter((n) => /^First screen: /.test(n.label ?? ""));
  const buttons = mine.filter((n) => n.featureId === "cta-primary");
  const row = buttons.length ? { left: Math.min(...buttons.map((b) => b.x)), right: Math.max(...buttons.map((b) => b.x + b.w)) } : null;
  const shift = row ? Math.round((width - (row.right - row.left)) / 2 - row.left) : 0;
  return nodes.map((n) => {
    if (!mine.includes(n)) return n;
    if (n.featureId === "cta-primary") return { ...n, x: n.x + shift };
    return { ...n, x: Math.round((width - n.w) / 2), text: { ...((n.text as Record<string, unknown> | undefined) ?? {}), align: "center" } };
  });
}

/** Each face token's job, by its name: the theme names its heading face "Headings". */
export function faceRolesOf(system: System): FaceRoles {
  const out: FaceRoles = new Map();
  for (const f of system.tokens.type.faces) out.set(f.id, /head|title|display/i.test(f.name) ? "heading" : "body");
  return out;
}

/** The variations' taste pass over the direction's System: its spec's colours, type, space and motion, before anything is drawn. */
export function tastedSystem(system: System, voice: Voice): System {
  return systemFor(system, specFor(voice, 6), faceRolesOf(system));
}

/** Three (or `count`) concepts of the prompt, free, each drafted whole. */
export function draftConcepts(prompt: string, o: { seed: number; count?: number; allowed: ReadonlySet<string>; siteName?: string }): Drafted[] {
  const v = conceptVersions(prompt, { seed: o.seed, count: o.count, allowed: o.allowed });
  return v.versions.map((ver, i) => draftOne(v, i, o.seed + i * 104729, o.siteName));
}

/** One version of `v` drafted in its direction. */
export function draftOne(v: Versions, i: number, seed: number, siteName?: string): Drafted {
  const ver = v.versions[i]!;
  const voice: Voice = directionOf(ver.name)?.id ?? DIRECTIONS[i % DIRECTIONS.length]!.id;
  const d = DIRECTIONS.find((x) => x.id === voice)!;
  const name = conceptName(siteName ?? v.name, ver.name);
  const { theme, system: themed } = themeFor(voice, d.philosophy, seed, `${name} System`);
  const system = tastedSystem(themed, voice);
  const drawn = docOf(v, i, system, theme, name);
  /* The pictures turn with the subject as well as the seed: two prompts draw two sets. */
  drawn.nodes = paintPictures(alignFirstScreen(drawn.nodes as ArtNode[], FIRST_SCREEN_ALIGN[voice]), voice, system, (seed ^ hashOf(v.name)) >>> 0);
  return { name, direction: ver.name, pitch: ver.pitch, voice, doc: drawn, system };
}

/* ------------------------------------------------------------------ */
/* One section again                                                    */
/* ------------------------------------------------------------------ */

export interface Redrafted<N> { nodes: N[]; height: { was: number; now: number } }

/**
 * ONE SECTION OF A DRAFTED PAGE WRITTEN AGAIN (the grid's "Again this row"):
 * the same direction, new words from a new seed, laid out in the page's own
 * System, put where the old section was; what sat under it moves by the
 * difference in height. Null when the direction has no section of that
 * name (a page Claude drew, say): nothing is changed then.
 */
export function redraftSection<N extends PartLike & { pageId: string }>(doc: { nodes: readonly N[]; system?: System | null; frameWidth?: number; activePageId?: string; pages?: { id: string }[]; brief?: { name?: string } }, voice: Voice, prompt: string, section: string, seed: number, allowed: ReadonlySet<string>): Redrafted<N> | null {
  const system = doc.system;
  if (!system) return null;
  const pageId = doc.activePageId ?? doc.pages?.[0]?.id ?? doc.nodes[0]?.pageId ?? "page_home";
  const old = partsOfSection(doc.nodes, section, pageId);
  if (!old.length) return null;
  const s = subjectOf(prompt);
  const L = linesFor(s, voice, seed);
  const part = (id: string, label: string, content: string, options: Record<string, string> = {}): PlanPart => (allowed.has(id) ? { kind: "part", featureId: id, label, content, options } : { kind: "text", text: content.split("\n")[0] ?? label });
  const fresh = pageFor(voice, L, part, doc.brief?.name?.split(":")[0] ?? s.name).find((x) => x.name.toLowerCase() === section.toLowerCase());
  if (!fresh) return null;
  const board = planToBoard({ name: s.name, description: "", sections: [fresh], missing: [] }, system, { pageId, frameWidth: doc.frameWidth ?? FRAME });
  const top = Math.min(...old.map((n) => n.y));
  const bottom = Math.max(...old.map((n) => n.y + n.h));
  const was = bottom - top;
  const now = board.height;
  const tag = `r${(seed >>> 0).toString(36)}_`;
  const made = paintPictures(board.nodes.map((n) => ({ ...n, id: tag + n.id, y: n.y + top })) as unknown as ArtNode[], voice, system, seed) as unknown as N[];
  const kept = doc.nodes.filter((n) => !old.includes(n)).map((n) => (n.pageId === pageId && n.y >= bottom ? { ...n, y: n.y + (now - was) } : n));
  /* The band of the section before stays over nothing; the new one goes in its place in the list, so it still draws under its parts. */
  const at = doc.nodes.indexOf(old[0]!);
  const before = kept.filter((n) => doc.nodes.indexOf(n) < at || (n.pageId === pageId && n.y < top));
  const after = kept.filter((n) => !before.includes(n));
  void sectionOfPart;
  return { nodes: [...before, ...made, ...after], height: { was, now } };
}
