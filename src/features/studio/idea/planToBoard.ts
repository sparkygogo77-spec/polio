/**
 * A PLAN BECOMES A BOARD, IN THE HOUSE STYLE.
 *
 * Code lays the plan out, never Claude's numbers ("plans that don't fit the
 * frame", CREATE-SYSTEM-PROPOSAL.md (b)): sections stacked down the page, each
 * a band in the background or the surface colour, and inside each one its
 * parts in rows: headings and lines of words across, buttons side by side,
 * catalogue parts at their own footprint, packed up to three a row or across
 * the band when they are wide.
 *
 * EVERY PART IS LINKED FROM THE START. Each field a part takes from the
 * style points at the System's token (`link.ts#linkField`): words at a type
 * step and a face, colours at the colour tokens, corners and padding at the
 * corner and space tokens. So changing the accent or the body size in the
 * System panel changes the whole draft, and a draft is an ordinary site the
 * variations lane's lock-and-randomize works on as it does on any other.
 *
 * Pure: no React, no store, every import ends in .ts, so node tests load it.
 */
import { getFeature } from "../shelf/index.ts";
import { contrastOf } from "../look/styleKits.ts";
import { linkField } from "../system/link.ts";
import { rolesOf, type SysNode } from "../system/resolve.ts";
import type { FieldPath, SizeToken, System } from "../system/model.ts";
import type { StarterNode } from "../starterPage.ts";
import type { Plan, PlanPart } from "./plan.ts";

/** The prefix every draft part's id carries: not the sample page's `st_`, which a theme roll rebuilds. */
export const DRAFT_PREFIX = "dr_";

export type DraftNode = StarterNode & SysNode & { featureId: string };

export interface Board {
  nodes: DraftNode[];
  /** The six roles the System holds, for `look.palette`. */
  palette: ReturnType<typeof rolesOf>;
  height: number;
}

/* ------------------------------------------------------------------ */
/* Choosing tokens from any System                                     */
/* ------------------------------------------------------------------ */

/** The token of a list nearest a size: a captured System has many, a theme's a few. */
export function nearest(list: readonly SizeToken[], px: number): SizeToken | null {
  let best: SizeToken | null = null;
  for (const t of list) if (!best || Math.abs(t.px - px) < Math.abs(best.px - px)) best = t;
  return best;
}

interface Style {
  s: System;
  colour: (role: "bg" | "surface" | "text" | "muted" | "accent") => { id: string; value: string } | null;
  /** The colour token that reads best on this one. */
  inkOn: (fill: string, prefer?: string) => { id: string; value: string } | null;
  size: (px: number) => SizeToken | null;
  space: (px: number) => number;
  spaceId: (px: number) => string | null;
  radius: (px: number) => SizeToken | null;
  heading: { id: string; stack: string } | null;
  body: { id: string; stack: string } | null;
}

function styleOf(s: System): Style {
  const cols = s.tokens.colour;
  const byRole = (r: string) => cols.find((c) => c.role === r) ?? null;
  const colour: Style["colour"] = (r) => {
    const t = byRole(r) ?? (r === "surface" ? byRole("bg") : r === "muted" ? byRole("text") : null) ?? cols[0] ?? null;
    return t ? { id: t.id, value: t.value } : null;
  };
  const inkOn: Style["inkOn"] = (fill, prefer) => {
    const own = prefer ? cols.find((c) => c.id === prefer) : null;
    if (own && contrastOf(own.value, fill) >= 4.5) return { id: own.id, value: own.value };
    let best: (typeof cols)[number] | null = null, bestC = 0;
    for (const c of cols) { const k = contrastOf(c.value, fill); if (k > bestC) { best = c; bestC = k; } }
    return best ? { id: best.id, value: best.value } : null;
  };
  const faces = s.tokens.type.faces;
  return {
    s, colour, inkOn,
    size: (px) => nearest(s.tokens.type.steps, px),
    space: (px) => nearest(s.tokens.space, px)?.px ?? px,
    spaceId: (px) => nearest(s.tokens.space, px)?.id ?? null,
    radius: (px) => nearest(s.tokens.radius, px),
    heading: faces[0] ? { id: faces[0].id, stack: faces[0].stack } : null,
    body: faces[1] ?? faces[0] ? { id: (faces[1] ?? faces[0])!.id, stack: (faces[1] ?? faces[0])!.stack } : null,
  };
}

/* ------------------------------------------------------------------ */
/* The board                                                           */
/* ------------------------------------------------------------------ */

const W_FRAME = 1440;
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
/** How wide words come out, read generously, as the sample page reads them (`starterPage.ts`). */
const measure = (text: string, px: number, weight = 400) => Math.ceil(text.length * px * 0.62 * (weight >= 700 ? 1.1 : 1));
const linesOf = (text: string, px: number, w: number, weight = 400) => Math.max(1, Math.ceil((measure(text, px, weight) * 1.08) / Math.max(1, w)));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "part";

/** What a section's band looks like: a catalogue part across the whole page (a header, a footer) needs no band round it. */
const bare = (parts: readonly PlanPart[]) => parts.every((p) => p.kind === "part" && (getFeature(p.featureId)?.w ?? 0) >= W_FRAME);

export function planToBoard(plan: Plan, system: System, o: { pageId: string; frameWidth?: number }): Board {
  const W = o.frameWidth ?? W_FRAME;
  const st = styleOf(system);
  const side = st.space(80);
  const gap = st.space(24);
  const tight = st.space(16);
  const band = st.space(96);
  const contentW = W - side * 2;
  const nodes: DraftNode[] = [];
  const used = new Set<string>();

  const idFor = (section: string, what: string) => {
    let id = `${DRAFT_PREFIX}${slug(section)}_${slug(what)}`;
    for (let i = 2; used.has(id); i++) id = `${DRAFT_PREFIX}${slug(section)}_${slug(what)}_${i}`;
    used.add(id);
    return id;
  };
  /** A part with every field the store's parts have, then its links to the System, each writing the token's value. */
  const add = (n: Partial<DraftNode> & { id: string; featureId: string; x: number; y: number; w: number; h: number }, links: [FieldPath, string | null | undefined][]) => {
    let node = {
      pageId: o.pageId, label: n.id.slice(DRAFT_PREFIX.length).replace(/_/g, " "), prompt: "", content: "", data: "",
      groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null,
      colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth",
      shape: null, outline: null, kind: null, cube: null, mesh: null, vector: null, role: null, code: null,
      aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null, byHand: true,
      ...n,
      x: Math.round(n.x), y: Math.round(n.y), w: Math.round(n.w), h: Math.round(n.h),
    } as DraftNode;
    for (const [field, token] of links) {
      if (!token) continue;
      node = linkField(node, system, field, token) ?? node;
    }
    nodes.push(node);
    return node;
  };

  let y = 0;
  let shade = 0;
  for (const section of plan.sections) {
    const isBare = bare(section.parts);
    const top = y;
    const role = shade % 2 ? "surface" as const : "bg" as const;
    if (!isBare) shade++;
    const fill = isBare ? null : st.colour(role);
    const fillValue = fill?.value ?? "#ffffff";
    const bandId = isBare ? null : idFor(section.name, "band");
    /* The band goes first, so everything in it draws over it. Its height is set once its parts are laid. */
    const bandNode = bandId ? add({ id: bandId, featureId: "box", label: `Section: ${section.name}`, x: 0, y: top, w: W, h: 1 }, [["colour.bg", fill?.id]]) : null;
    let cy = top + (isBare ? 0 : band);
    const ink = st.inkOn(fillValue, st.colour("text")?.id);
    const soft = st.inkOn(fillValue, st.colour("muted")?.id);

    const parts = section.parts;
    for (let i = 0; i < parts.length; ) {
      const p = parts[i]!;
      if (p.kind === "heading") {
        const want = p.level === 1 ? 56 : p.level === 2 ? 36 : 24;
        const w = p.level === 1 ? Math.min(contentW, 880) : contentW;
        let tok = st.size(want);
        /* A first-screen title as large as it can be in three lines. */
        while (tok && tok.px > 28 && linesOf(p.text, tok.px, w, 700) > 3) {
          const smaller = [...system.tokens.type.steps].filter((x) => x.px < tok!.px).sort((a, b) => b.px - a.px)[0];
          if (!smaller) break;
          tok = smaller;
        }
        const px = tok?.px ?? want;
        const h = Math.round(px * 1.2 * linesOf(p.text, px, w, 700));
        add({ id: idFor(section.name, p.level === 1 ? "title" : "heading"), featureId: "prose", label: `${section.name}: heading`, content: p.text, x: side, y: cy, w, h, font: { stack: st.heading?.stack ?? SANS, px, weight: 700, leading: 1.15 }, text: { align: "left" } }, [["font.px", tok?.id], ["font.stack", st.heading?.id], ["colour.text", ink?.id]]);
        cy += h + tight;
        i++;
      } else if (p.kind === "text") {
        const tok = st.size(18);
        const px = tok?.px ?? 18;
        const w = Math.min(contentW, 720);
        const h = Math.round(px * 1.5 * linesOf(p.text, px, w));
        add({ id: idFor(section.name, "text"), featureId: "prose", label: `${section.name}: words`, content: p.text, x: side, y: cy, w, h, font: { stack: st.body?.stack ?? SANS, px, weight: 400, leading: 1.5 }, text: { align: "left" } }, [["font.px", tok?.id], ["font.stack", st.body?.id], ["colour.text", soft?.id]]);
        cy += h + gap;
        i++;
      } else if (p.kind === "button") {
        /* Buttons one after another sit in one row. */
        const row: Extract<PlanPart, { kind: "button" }>[] = [];
        while (i < parts.length && parts[i]!.kind === "button") row.push(parts[i++] as Extract<PlanPart, { kind: "button" }>);
        const tok = st.size(16);
        const px = tok?.px ?? 16;
        const h = Math.max(40, st.space(48));
        const padX = st.space(24);
        const rad = st.radius(8);
        let bx = side;
        for (const b of row) {
          const w = Math.max(st.space(120), measure(b.text, px, 700) + padX * 2 + 8);
          const main = b.main;
          const back = main ? st.colour("accent") : st.colour(isBare ? "bg" : role);
          const words = main ? st.inkOn(back?.value ?? fillValue) : ink;
          add({
            id: idFor(section.name, b.text), featureId: "cta-primary", label: `${section.name}: ${b.text}`, content: b.text,
            x: bx, y: cy, w, h, options: { variant: "solid", shape: "square", size: "medium" },
            layout: { display: "flex", direction: "row", align: "center", justify: "center", gap: 0 }, text: { align: "center" },
            font: { stack: st.body?.stack ?? SANS, px, weight: 700, leading: 1.2 },
            ...(main ? {} : { edge: { width: 1, style: "solid" as const } }),
          }, [["colour.bg", back?.id], ["colour.accent", back?.id], ["colour.text", words?.id], ["font.px", tok?.id], ["font.stack", st.body?.id], ["radius", rad?.id], ["pad.left", st.spaceId(24)], ["pad.right", st.spaceId(24)], ...(main ? [] : [["edge.colour", ink?.id] as [FieldPath, string | undefined]])]);
          bx += w + tight;
        }
        cy += h + gap;
      } else {
        /* Catalogue parts and placeholders: across the band when wide, else packed up to three a row at their own footprint. */
        const row: PlanPart[] = [];
        const footprint = (q: PlanPart) => { const f = getFeature(q.kind === "part" ? q.featureId : "custom-idea"); return { w: f?.w ?? 480, h: f?.h ?? 200 }; };
        const wide = (q: PlanPart) => footprint(q).w >= contentW * 0.8;
        if (wide(p)) row.push(parts[i++]!);
        else while (i < parts.length && row.length < 3 && (parts[i]!.kind === "part" || parts[i]!.kind === "placeholder") && !wide(parts[i]!)) row.push(parts[i++]!);
        const full = row.length === 1 && footprint(row[0]!).w >= W;
        const each = full ? W : row.length === 1 && wide(row[0]!) ? contentW : Math.floor((contentW - gap * (row.length - 1)) / row.length);
        const rowH = Math.max(...row.map((q) => { const f = footprint(q); return Math.round(Math.min(640, Math.max(f.h, row.length > 1 || wide(q) ? f.h : (f.h * each) / Math.max(1, f.w)))); }));
        const rad = st.radius(12);
        row.forEach((q, k) => {
          const x = full ? 0 : side + k * (each + gap);
          if (q.kind === "placeholder") {
            add({ id: idFor(section.name, q.name), featureId: "custom-idea", label: q.name, content: `Placeholder: nothing in the catalogue makes this yet.${q.why ? ` ${q.why}` : ""}`, prompt: q.why, x, y: cy, w: each, h: rowH }, [["radius", rad?.id]]);
          } else if (q.kind === "part") {
            add({ id: idFor(section.name, q.label), featureId: q.featureId, label: q.label, content: q.content, options: q.options, x, y: cy, w: each, h: rowH }, full ? [] : [["radius", rad?.id]]);
          }
        });
        cy += rowH + gap;
      }
    }
    const bottom = isBare ? cy - gap : cy - gap + band;
    if (bandNode) bandNode.h = Math.round(bottom - top);
    y = Math.max(bottom, top + 1);
  }
  return { nodes, palette: rolesOf(system), height: y };
}
