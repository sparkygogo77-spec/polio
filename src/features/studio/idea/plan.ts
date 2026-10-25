/**
 * A PAGE PLAN: what a new idea's first draft is made of.
 *
 * J describes the site in a sentence or more, names the sections wanted if
 * J likes, and may give a site whose look J likes. One Claude call
 * (`api/studio/draft`) answers with a plan, and the plan is made only of
 * Polio's catalogue parts (J, 2026-10-23, Q6: "catalogue parts only, with
 * labelled placeholders"). Where nothing in the catalogue fits, the plan says
 * so, and the board places a labelled placeholder for it (DESIGN.md rule 6).
 *
 * A plan never holds a position or a size: code lays it out
 * (`planToBoard.ts`), in the house style's tokens.
 *
 * Pure: no React, no store, every import ends in .ts, so node tests load it.
 */
import { FEATURES, getFeature, type FeatureDef } from "../shelf/index.ts";
import { statusOf } from "../shelfFacts.ts";

/** What J typed in the dialog. */
export interface Idea {
  text: string;
  /** The sections J named, in order; none lets Claude choose. */
  sections: string[];
  /** A site J likes, as typed. Named to Claude; never fetched. */
  ref: string | null;
}

/** One thing in a section. The words are the site's own; the look is the house style's. */
export type PlanPart =
  | { kind: "heading"; text: string; level: 1 | 2 | 3 }
  | { kind: "text"; text: string }
  | { kind: "button"; text: string; main: boolean }
  | { kind: "part"; featureId: string; label: string; content: string; options: Record<string, string> }
  /** Nothing in the catalogue fits: a labelled placeholder stands in. */
  | { kind: "placeholder"; name: string; why: string };

export interface PlanSection { name: string; parts: PlanPart[] }

export interface Plan {
  /** The site's name, for the header and the Builds list. */
  name: string;
  /** One line a visitor reads in a link preview. */
  description: string;
  sections: PlanSection[];
  /** What was asked for that no catalogue part does: each one is a placeholder somewhere in `sections`. */
  missing: { name: string; why: string }[];
}

/* ------------------------------------------------------------------ */
/* The catalogue Claude may use                                        */
/* ------------------------------------------------------------------ */

/**
 * The parts a draft may use: those that work on the published site. A part
 * that needs a build, a service or a key first would publish as a promise,
 * so it is left out and Claude names it as missing instead, which gives it a
 * labelled placeholder J can see.
 */
export function draftable(): FeatureDef[] {
  return FEATURES.filter((f) => !f.basedOn && statusOf(f) === "works");
}

/** The catalogue as Claude reads it: one line a part, the same on every call so it is cached. */
export function catalogueText(list: readonly FeatureDef[] = draftable()): string {
  const lines = list.map((f) => {
    const opts = (f.options ?? []).filter((o) => o.kind !== "range").map((o) => `${o.id}=${o.values.join("|")}`).join("; ");
    return `${f.id} — ${f.name} · ${f.category} · ${f.blurb}${f.content ? ` · holds: ${f.content.label}` : ""}${opts ? ` · options: ${opts}` : ""}`;
  });
  return ["THE CATALOGUE (id — name · kind · what it is · what it holds · options):", ...lines].join("\n");
}

/* ------------------------------------------------------------------ */
/* Reading an answer strictly                                          */
/* ------------------------------------------------------------------ */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const words = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const MAX_SECTIONS = 12;
const MAX_PARTS = 10;

/** The options a part offers, kept; anything else dropped. */
function optionsFor(f: FeatureDef, raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const list = Array.isArray(raw) ? raw : isObj(raw) ? Object.entries(raw).map(([id, value]) => ({ id, value })) : [];
  for (const item of list) {
    if (!isObj(item) || typeof item.id !== "string" || typeof item.value !== "string") continue;
    const o = f.options?.find((x) => x.id === item.id);
    if (!o) continue;
    if (o.kind === "set") {
      const picked = item.value.split(",").map((s) => s.trim()).filter((v) => o.values.includes(v));
      if (picked.length) out[o.id] = picked.join(",");
    } else if (o.kind === "range") {
      const n = Number(item.value);
      if (o.range && Number.isFinite(n)) out[o.id] = String(Math.max(o.range.min, Math.min(o.range.max, n)));
    } else if (o.values.includes(item.value)) out[o.id] = item.value;
  }
  return out;
}

/**
 * Claude's answer as a plan, read strictly. A part id the draftable
 * catalogue does not hold is never placed: it becomes a placeholder named
 * for what was asked, and is listed as missing. Null when there is no
 * section at all to build.
 */
export function readPlan(raw: unknown, allowed: ReadonlySet<string> = new Set(draftable().map((f) => f.id))): Plan | null {
  if (!isObj(raw) || !Array.isArray(raw.sections)) return null;
  const missing: Plan["missing"] = [];
  const seen = new Set<string>();
  const miss = (name: string, why: string) => {
    const key = name.toLowerCase();
    if (!seen.has(key)) { seen.add(key); missing.push({ name, why }); }
    return { kind: "placeholder" as const, name, why };
  };
  if (Array.isArray(raw.missing)) for (const m of raw.missing) if (isObj(m) && words(m.name, 80)) miss(words(m.name, 80), words(m.why, 200));
  const sections: PlanSection[] = [];
  for (const s of raw.sections.slice(0, MAX_SECTIONS)) {
    if (!isObj(s) || !Array.isArray(s.parts)) continue;
    const parts: PlanPart[] = [];
    for (const p of s.parts.slice(0, MAX_PARTS)) {
      if (!isObj(p)) continue;
      const text = words(p.text, 400);
      if (p.kind === "heading" && text) parts.push({ kind: "heading", text: text.slice(0, 140), level: p.level === 1 || p.level === 3 ? p.level : 2 });
      else if (p.kind === "text" && text) parts.push({ kind: "text", text });
      else if (p.kind === "button" && text) parts.push({ kind: "button", text: text.slice(0, 40), main: p.main !== false });
      else if (p.kind === "placeholder") { const name = words(p.name, 80); if (name) parts.push(miss(name, words(p.why, 200))); }
      else if (p.kind === "part" && typeof p.featureId === "string") {
        const f = getFeature(p.featureId);
        if (!f || !allowed.has(f.id)) { parts.push(miss(words(p.label, 80) || words(p.featureId, 80), "Not a part the catalogue has.")); continue; }
        parts.push({ kind: "part", featureId: f.id, label: words(p.label, 80) || f.name, content: f.content ? words(p.content, 600) : "", options: optionsFor(f, p.options) });
      }
    }
    if (parts.length) sections.push({ name: words(s.name, 60) || `Section ${sections.length + 1}`, parts });
  }
  /* Missing things only said in the list still get their place: a section of their own at the end, before nothing is lost. */
  const placed = new Set(sections.flatMap((s) => s.parts.filter((p) => p.kind === "placeholder").map((p) => (p as { name: string }).name.toLowerCase())));
  const unplaced = missing.filter((m) => !placed.has(m.name.toLowerCase()));
  if (unplaced.length && sections.length < MAX_SECTIONS) sections.push({ name: "Still to make", parts: unplaced.map((m) => ({ kind: "placeholder", name: m.name, why: m.why })) });
  if (!sections.length) return null;
  return { name: words(raw.name, 60) || "New site", description: words(raw.description, 200), sections, missing };
}

/* ------------------------------------------------------------------ */
/* With no Claude                                                      */
/* ------------------------------------------------------------------ */

/**
 * The plan with no key: the sections J named (or a header, a first screen,
 * three cards and a footer), each a heading and a line in J's own words, so
 * "Make a draft" still makes a site in the house style and says why it is
 * plain (DESIGN.md rule 8).
 */
export function plainPlan(idea: Idea, name = ""): Plan {
  const first = idea.text.split(/(?<=[.!?])\s+/)[0]?.trim() || "Say the one thing this site is for";
  const site = name.trim() || "New site";
  const asked = idea.sections.map((s) => s.trim()).filter(Boolean);
  const middle: PlanSection[] = asked.length
    ? asked.map((s) => ({ name: s, parts: [{ kind: "heading", text: s, level: 2 }, { kind: "text", text: `What ${s.toLowerCase()} says goes here.` }] }))
    : [{ name: "What it does", parts: [{ kind: "heading", text: "What it does", level: 2 }, { kind: "part", featureId: "card-grid", label: "Cards", content: "", options: {} }] }];
  return {
    name: site,
    description: first.slice(0, 200),
    sections: [
      { name: "Header", parts: [{ kind: "part", featureId: "sticky-header", label: "Header", content: "", options: {} }] },
      { name: "First screen", parts: [{ kind: "heading", text: first.slice(0, 140), level: 1 }, { kind: "text", text: idea.text.slice(first.length).trim() || "A sentence or two that says who it is for and what they get." }, { kind: "button", text: "Get started", main: true }] },
      ...middle,
      { name: "Footer", parts: [{ kind: "part", featureId: "footer", label: "Footer", content: "", options: {} }] },
    ],
    missing: [],
  };
}
