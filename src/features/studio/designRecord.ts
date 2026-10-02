/**
 * THE DESIGN RECORD, as the Builder writes it (`design/record.json`).
 *
 * One format the capturer and the Builder both write and code chats build
 * from: PST's `kit/DESIGN-RECORD.md`, the capture record (`capture/site/
 * capture/dump.mjs`) with what the Builder knows added to each part: its
 * hook and name, the part it sits in, its states (a hidden group), which of
 * its values are tokens, its animation and its assets. The Builder writes it
 * on every Export for code to a branch and Send the design back, beside the
 * pages, so a code chat builds the parts from it and checks the build with a
 * look-only capture and `kit:record-diff`.
 *
 * The board has one width, so `breakpoints` holds that one and no part has
 * an `at`. Pure: `tests/design-record.mjs` holds it.
 */
import { groupHook } from "./boardStates.ts";

export interface RecordNode {
  id?: string;
  pageId: string;
  featureId?: string;
  kind?: string | null;
  label?: string | null;
  content?: string | null;
  x: number; y: number; w: number; h: number;
  hooks?: Record<string, string> | null;
  colour?: Record<string, string> | null;
  font?: { px?: number; stack?: string; face?: string; weight?: number; fluid?: string } | null;
  anim?: string | null;
  state?: { group: string; option: number } | null;
  vector?: { svg?: string } | null;
  source?: { file?: string } | null;
}

export interface RecordPart {
  t: string;
  x: number; y: number; w: number; h: number;
  hook?: string;
  label?: string;
  parent?: string;
  text?: string;
  color?: string;
  bg?: string;
  fs?: number;
  fsu?: string;
  fw?: string;
  ffs?: string;
  anim?: string;
  states?: Record<string, { hidden?: boolean; group?: string; style?: Record<string, string> }>;
  tokens?: Record<string, string>;
  assets?: { svg?: string; img?: string };
  kids?: RecordPart[];
}

export interface DesignRecord {
  record: 1;
  source: "builder" | "capture";
  site: string;
  madeAt: string;
  tokens: Record<string, string>;
  breakpoints: { name: string; width: number }[];
  pages: { file: string; name: string; viewport: [number, number]; page: [number, number]; tree: RecordPart }[];
}

const isColour = (v: string) => /^(#|rgb|hsl|oklch|oklab|lab|lch|color\()/i.test(v.trim());
/** A colour as a key for matching it to a token: `#16a34a` and `rgb(22, 163, 74)` meet. */
export function colourKey(v: string): string {
  const s = v.trim().toLowerCase();
  const h = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (h) { const x = h[1]!.length === 3 ? h[1]!.split("").map((c) => c + c).join("") : h[1]!; return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)).join(","); }
  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) { const p = m[1]!.split(/[ ,/]+/).filter(Boolean); return (p.length === 4 && Number(p[3]) === 1 ? p.slice(0, 3) : p).join(","); }
  return s.replace(/\s+/g, "");
}

/**
 * The record of a board. `palette` resolves a colour named by its role;
 * `tokens` are the site's design tokens, the owner's settings already over
 * them; `parents` names the part each hook sits in (hooks.json `parent`).
 */
export function designRecord(
  nodes: readonly RecordNode[],
  pages: readonly { id: string; name: string; path?: string }[],
  opts: { site: string; width: number; palette?: Record<string, string>; tokens?: Record<string, string>; parents?: Record<string, string | null | undefined>; pageFile?: (pageId: string) => string | null; when?: string; fresh?: Record<string, string> },
): DesignRecord {
  const tokens = opts.tokens ?? {};
  const byColour = new Map<string, string>();
  const byValue = new Map<string, string>();
  for (const [name, value] of Object.entries(tokens)) {
    if (isColour(value) && !byColour.has(colourKey(value))) byColour.set(colourKey(value), name);
    else if (!byValue.has(value.trim())) byValue.set(value.trim(), name);
  }
  const colourOf = (v: string | undefined) => (!v ? undefined : isColour(v) ? v : opts.palette?.[v] && isColour(opts.palette[v]!) ? opts.palette[v] : undefined);
  const out: DesignRecord["pages"] = [];
  for (const pg of pages) {
    const here = nodes.filter((n) => n.pageId === pg.id);
    if (!here.length) continue;
    const parts = new Map<string, RecordPart>();
    const list: { part: RecordPart; parent?: string }[] = [];
    for (const n of here) {
      /* A part made here has the hook the export names it by (`kitExport.ts`, fresh). */
      const hook = n.hooks?.["data-hook"] ?? (n.id ? opts.fresh?.[n.id] : undefined);
      const p: RecordPart = { t: n.kind ?? n.featureId ?? "div", x: Math.round(n.x), y: Math.round(n.y), w: Math.round(n.w), h: Math.round(n.h) };
      if (hook) p.hook = hook;
      if (n.label) p.label = n.label;
      const parent = hook ? opts.parents?.[hook] ?? undefined : undefined;
      if (n.content && n.content.length <= 400) p.text = n.content;
      const color = colourOf(n.colour?.text);
      const bg = colourOf(n.colour?.bg);
      if (color) p.color = color;
      if (bg) p.bg = bg;
      if (n.font?.px) p.fs = n.font.px;
      if (n.font?.fluid) p.fsu = n.font.fluid;
      if (n.font?.weight) p.fw = String(n.font.weight);
      if (n.font?.stack) p.ffs = n.font.stack;
      if (n.anim) p.anim = n.anim;
      if (n.state?.group?.startsWith("hidden:")) p.states = { hidden: { hidden: true, group: groupHook(n.state.group) } };
      const tk: Record<string, string> = {};
      for (const k of ["color", "bg"] as const) { const v = p[k]; const t = v ? byColour.get(colourKey(v)) : undefined; if (t) tk[k] = t; }
      if (p.fsu && byValue.has(p.fsu)) tk.fsu = byValue.get(p.fsu)!;
      if (p.ffs && byValue.has(p.ffs)) tk.ffs = byValue.get(p.ffs)!;
      if (Object.keys(tk).length) p.tokens = tk;
      if (n.vector?.svg) p.assets = { svg: n.vector.svg };
      if (hook && !parts.has(hook)) parts.set(hook, p);
      list.push({ part: p, parent });
    }
    /* The part each sits in: up its map's parents to the first that is a part on this page (the export's own wrappers are not). */
    const onPage = new Set(parts.keys());
    for (const x of list) {
      let up = x.parent;
      for (let i = 0; up && !onPage.has(up) && i < 50; i++) up = opts.parents?.[up] ?? undefined;
      x.parent = up && up !== x.part.hook ? up : undefined;
      /* No map says: the smallest hooked part on the page whose box holds it, as the board draws them. */
      if (!x.parent) {
        const b = x.part;
        let best: RecordPart | undefined;
        for (const [h, q] of parts) {
          if (h === b.hook || q === b) continue;
          const holds = q.x <= b.x && q.y <= b.y && q.x + q.w >= b.x + b.w && q.y + q.h >= b.y + b.h && q.w * q.h > b.w * b.h;
          if (holds && (!best || q.w * q.h < best.w * best.h)) best = q;
        }
        x.parent = best?.hook;
      }
    }
    /* Never a loop: a part whose chain comes back to itself sits on the page. */
    const parentOf = new Map(list.filter((x) => x.part.hook).map((x) => [x.part.hook!, x.parent]));
    for (const x of list) {
      const seen = new Set<string>();
      for (let up = x.parent; up; up = parentOf.get(up)) { if (up === x.part.hook || seen.has(up)) { x.parent = undefined; if (x.part.hook) parentOf.set(x.part.hook, undefined); break; } seen.add(up); }
      if (x.parent) x.part.parent = x.parent;
    }
    const right = Math.max(opts.width, ...list.map((x) => x.part.x + x.part.w));
    const bottom = Math.max(...list.map((x) => x.part.y + x.part.h));
    const root: RecordPart = { t: "body", x: 0, y: 0, w: right, h: bottom, kids: [] };
    for (const { part, parent } of list) {
      const host = parent ? parts.get(parent) : undefined;
      if (host && host !== part) (host.kids ??= []).push(part);
      else root.kids!.push(part);
    }
    out.push({ file: opts.pageFile?.(pg.id) ?? here.find((n) => n.source?.file)?.source?.file ?? pg.path ?? pg.id, name: pg.name, viewport: [opts.width, Math.min(bottom, 900)], page: [right, bottom], tree: root });
  }
  return { record: 1, source: "builder", site: opts.site, madeAt: opts.when ?? new Date().toISOString(), tokens, breakpoints: [{ name: "desktop", width: opts.width }], pages: out };
}
