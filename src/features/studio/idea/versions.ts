/**
 * SEVERAL VERSIONS OF ONE IDEA, AND THE SITE J PICKS OUT OF THEM.
 *
 * J types the idea once. One Claude call (or the free local roll, no Claude)
 * answers with three or four clearly different versions of it, each with a
 * plain name ("Calm editorial", "Bold product") and the pages it needs: Home,
 * About, Pricing, FAQ, Contact. Each page is a plan of catalogue parts, read
 * as strictly as a one-page plan is (`plan.ts#readPlan`).
 *
 * J then picks, page by page, which version each one comes from (Home from
 * version 2, Pricing from version 1). Only those pages become the site, in
 * the house style, with a row of links between them on every page.
 *
 * THE WORDS ARE OFFERED, NOT WRITTEN. Each page is laid out at the size its
 * suggested words need, then every heading, line, button and part content is
 * set to a plain stand-in and its suggestion is listed beside it. Nothing the
 * plan said lands on the site until J accepts that line.
 *
 * Pure: no React, no store, every import ends in .ts, so node tests load it.
 */
import { draftable, readPlan, type Idea, type Plan, type PlanPart, type PlanSection } from "./plan.ts";
import { DRAFT_PREFIX, planToBoard, type DraftNode } from "./planToBoard.ts";
import { rolesOf } from "../system/resolve.ts";
import type { System } from "../system/model.ts";

export interface VersionPage { name: string; sections: PlanSection[] }
export interface Version { name: string; pitch: string; pages: VersionPage[] }
export interface Versions {
  name: string;
  description: string;
  versions: Version[];
  missing: Plan["missing"];
  by: "claude" | "local";
}

export const MAX_VERSIONS = 4;
const MAX_PAGES = 8;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const words = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "page";

/** Which row of the picker a page is: pages of the same name in two versions are the same page. */
export const pageKey = (name: string): string => {
  const k = slug(name);
  return k === "home_page" || k === "index" || k === "start" ? "home" : k === "faqs" || k === "questions" ? "faq" : k;
};

/* ------------------------------------------------------------------ */
/* Reading Claude's answer                                             */
/* ------------------------------------------------------------------ */

/**
 * The answer as versions, read strictly: each page through `readPlan`, so a
 * part id the catalogue lacks is a labelled placeholder there too. A version
 * with no page to build is dropped; null when none is left.
 */
export function readVersions(raw: unknown, allowed?: ReadonlySet<string>): Versions | null {
  if (!isObj(raw) || !Array.isArray(raw.versions)) return null;
  const missing: Plan["missing"] = [];
  const seenMissing = new Set<string>();
  const note = (m: { name: string; why: string }) => { const k = m.name.toLowerCase(); if (!seenMissing.has(k)) { seenMissing.add(k); missing.push(m); } };
  if (Array.isArray(raw.missing)) for (const m of raw.missing) if (isObj(m) && words(m.name, 80)) note({ name: words(m.name, 80), why: words(m.why, 200) });

  const versions: Version[] = [];
  const names = new Set<string>();
  for (const v of raw.versions.slice(0, MAX_VERSIONS)) {
    if (!isObj(v) || !Array.isArray(v.pages)) continue;
    const pages: VersionPage[] = [];
    const keys = new Set<string>();
    for (const p of v.pages.slice(0, MAX_PAGES)) {
      if (!isObj(p)) continue;
      /* Each page alone: what the answer lists as missing is placed once, below, not on every page. */
      const plan = readPlan({ name: "", sections: p.sections, missing: [] }, allowed);
      if (!plan) continue;
      let name = words(p.name, 30) || `Page ${pages.length + 1}`;
      if (keys.has(pageKey(name))) name = `${name} ${pages.length + 1}`;
      keys.add(pageKey(name));
      for (const m of plan.missing) note(m);
      pages.push({ name, sections: plan.sections });
    }
    if (!pages.length) continue;
    /* Home first: it is the page the site opens on. */
    const home = pages.findIndex((p) => pageKey(p.name) === "home");
    if (home > 0) pages.unshift(...pages.splice(home, 1));
    else if (home < 0) pages[0] = { ...pages[0]!, name: "Home" };
    let name = words(v.name, 40) || `Version ${versions.length + 1}`;
    if (names.has(name.toLowerCase())) name = `${name} ${versions.length + 1}`;
    names.add(name.toLowerCase());
    versions.push({ name, pitch: words(v.pitch, 200), pages });
  }
  if (!versions.length) return null;
  return { name: words(raw.name, 60) || "New site", description: words(raw.description, 200), versions, missing, by: "claude" };
}

/* ------------------------------------------------------------------ */
/* With no Claude: versions rolled from the catalogue                  */
/* ------------------------------------------------------------------ */

type Recipe = { name: string; pitch: string; pages: { name: string; sections: (ctx: Ctx) => PlanSection[] }[] };
interface Ctx { first: string; rest: string; asked: string[]; site: string; part: (id: string, label: string, alt?: string) => PlanPart }

const head = (c: Ctx): PlanSection => ({ name: "Header", parts: [c.part("sticky-header", "Header")] });
const foot = (c: Ctx): PlanSection => ({ name: "Footer", parts: [c.part("footer", "Footer")] });
const say = (name: string, heading: string, text: string, ...more: PlanPart[]): PlanSection => ({ name, parts: [{ kind: "heading", text: heading, level: 2 }, { kind: "text", text }, ...more] });
const askedSections = (c: Ctx, part: (s: string) => PlanPart | null): PlanSection[] => c.asked.map((s) => say(s, s, `What ${s.toLowerCase()} says goes here.`, ...[part(s)].filter((x): x is PlanPart => !!x)));

/**
 * Four ways to make the same site, each a different kind of page set and a
 * different way of leading: the local roll picks three of them, starting
 * where the seed says, so two rolls in a row differ.
 */
const RECIPES: Recipe[] = [
  {
    name: "Calm editorial", pitch: "Few words, lots of room, one thing at a time. Reads like a magazine page.",
    pages: [
      { name: "Home", sections: (c) => [head(c), { name: "First screen", parts: [{ kind: "heading", text: c.first, level: 1 }, { kind: "text", text: c.rest }, { kind: "button", text: "Read more", main: true }] }, ...askedSections(c, () => null), say("Story", "Why it exists", `The story behind ${c.site}, in a few plain lines.`), foot(c)] },
      { name: "About", sections: (c) => [head(c), say("About", "About us", `Who is behind ${c.site}, and why.`), say("Values", "What we care about", "Three short lines, one for each thing that matters."), foot(c)] },
      { name: "Contact", sections: (c) => [head(c), say("Contact", "Say hello", "How to reach us, and when we answer.", { kind: "button", text: "Write to us", main: true }), foot(c)] },
    ],
  },
  {
    name: "Bold product", pitch: "A big promise up top, what you get in cards, prices and questions answered.",
    pages: [
      { name: "Home", sections: (c) => [head(c), { name: "First screen", parts: [{ kind: "heading", text: c.first, level: 1 }, { kind: "text", text: c.rest }, { kind: "button", text: "Get started", main: true }, { kind: "button", text: "See pricing", main: false }] }, say("What you get", "What you get", "The three things that make it worth it.", c.part("card-grid", "Cards")), ...askedSections(c, () => c.part("card-grid", "Cards")), foot(c)] },
      { name: "Pricing", sections: (c) => [head(c), say("Pricing", "Pricing", "Plain prices, no surprises.", c.part("pricing-table", "Prices", "A price table")), foot(c)] },
      { name: "FAQ", sections: (c) => [head(c), say("Questions", "Questions", "What people ask before they start.", c.part("faq", "Questions")), foot(c)] },
      { name: "Contact", sections: (c) => [head(c), say("Contact", "Talk to us", "We answer within a day.", { kind: "button", text: "Get in touch", main: true }), foot(c)] },
    ],
  },
  {
    name: "Warm and personal", pitch: "A person, a story and pictures first; the details after.",
    pages: [
      { name: "Home", sections: (c) => [head(c), { name: "First screen", parts: [{ kind: "heading", text: c.first, level: 1 }, { kind: "text", text: c.rest }, { kind: "button", text: "Come and see", main: true }] }, say("Kind words", "What people say", "A few kind words from people who came.", c.part("testimonials", "Kind words")), ...askedSections(c, () => null), foot(c)] },
      { name: "Gallery", sections: (c) => [head(c), say("Pictures", "Have a look", "A few pictures say it better.", c.part("gallery", "Pictures")), foot(c)] },
      { name: "About", sections: (c) => [head(c), say("About", "Hello", `The people who make ${c.site}.`), say("Story", "How it started", "The short story of how this began."), foot(c)] },
      { name: "Contact", sections: (c) => [head(c), say("Contact", "Find us", "Where we are and how to get in touch.", { kind: "button", text: "Send a message", main: true }), foot(c)] },
    ],
  },
  {
    name: "Simple one-pager", pitch: "Everything on one page, top to bottom, and nothing else to click.",
    pages: [
      { name: "Home", sections: (c) => [head(c), { name: "First screen", parts: [{ kind: "heading", text: c.first, level: 1 }, { kind: "text", text: c.rest }, { kind: "button", text: "Get started", main: true }] }, ...askedSections(c, () => null), say("Questions", "Questions", "The few things people ask.", c.part("faq", "Questions")), say("Contact", "Get in touch", "One way to reach us.", { kind: "button", text: "Contact", main: true }), foot(c)] },
    ],
  },
];

/** The free versions: three of the recipes, from the catalogue's parts that work, in J's own words where J gave any. */
export function localVersions(idea: Idea, o: { name?: string; seed?: number; count?: number; allowed?: ReadonlySet<string> } = {}): Versions {
  const allowed = o.allowed ?? new Set(draftable().map((f) => f.id));
  const first = idea.text.split(/(?<=[.!?])\s+/)[0]?.trim().slice(0, 140) || "Say the one thing this site is for";
  const site = o.name?.trim() || "New site";
  const ctx: Ctx = {
    first, site,
    rest: idea.text.slice(first.length).trim().slice(0, 300) || "A sentence or two that says who it is for and what they get.",
    asked: idea.sections.map((s) => s.trim()).filter(Boolean).slice(0, 6),
    /* A part the catalogue does not have (or that would not publish) is a labelled placeholder, as in a Claude plan. */
    part: (id, label, alt) => (allowed.has(id) ? { kind: "part", featureId: id, label, content: "", options: {} } : { kind: "placeholder", name: alt ?? label, why: "Nothing in the catalogue makes this yet." }),
  };
  const count = Math.max(1, Math.min(RECIPES.length, o.count ?? 3));
  const start = Math.abs(Math.floor(o.seed ?? 0)) % RECIPES.length;
  const picked = Array.from({ length: count }, (_, i) => RECIPES[(start + i) % RECIPES.length]!);
  const versions = picked.map((r) => ({ name: r.name, pitch: r.pitch, pages: r.pages.map((p) => ({ name: p.name, sections: p.sections(ctx) })) }));
  const missing: Plan["missing"] = [];
  for (const v of versions) for (const p of v.pages) for (const s of p.sections) for (const q of s.parts) if (q.kind === "placeholder" && !missing.some((m) => m.name === q.name)) missing.push({ name: q.name, why: q.why });
  return { name: site, description: first.slice(0, 200), versions, missing, by: "local" };
}

/* ------------------------------------------------------------------ */
/* The picker's rows and J's picks                                     */
/* ------------------------------------------------------------------ */

/** One row of the picker: a page name, and which versions have it (version index → page index). */
export interface PageRow { key: string; name: string; in: Map<number, number> }

/** Every page any version proposes, Home first, then in the order they first appear. */
export function pageRows(v: Versions): PageRow[] {
  const rows: PageRow[] = [];
  const width = Math.max(0, ...v.versions.map((x) => x.pages.length));
  for (let i = 0; i < width; i++) {
    v.versions.forEach((ver, vi) => {
      const p = ver.pages[i];
      if (!p) return;
      const key = pageKey(p.name);
      let row = rows.find((r) => r.key === key);
      if (!row) rows.push((row = { key, name: p.name, in: new Map() }));
      if (!row.in.has(vi)) row.in.set(vi, i);
    });
  }
  return rows;
}

/** J's picks: for each page row J ticked, the version it comes from. */
export type Picks = Record<string, number>;

/** Tick a page from a version; ticking the one already ticked takes it off again. */
export function togglePick(picks: Picks, key: string, version: number): Picks {
  const next = { ...picks };
  if (next[key] === version) delete next[key];
  else next[key] = version;
  return next;
}

/** Every page of one version, ticked from it (and nothing else ticked). */
export function wholeVersion(v: Versions, version: number): Picks {
  return Object.fromEntries((v.versions[version]?.pages ?? []).map((p) => [pageKey(p.name), version]));
}

/* ------------------------------------------------------------------ */
/* The site                                                            */
/* ------------------------------------------------------------------ */

/** One word offered for a part: what it says now, what the plan suggests. */
export interface WordOffer { id: string; nodeId: string; pageId: string; page: string; part: string; now: string; to: string }

export interface SitePage { id: string; name: string; path: string; prompt: string; scroll: string }

export interface BuiltSite {
  pages: SitePage[];
  nodes: DraftNode[];
  palette: ReturnType<typeof rolesOf>;
  /** The plan's words, line by line, not yet on the site. Empty when built with `words: "fill"`. */
  offers: WordOffer[];
}

/** The section that carries the links between pages, on every page of a site of more than one. */
export const NAV_SECTION = "Pages";

const pathOf = (name: string, i: number) => (i === 0 ? "/" : `/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `page-${i + 1}`}`);

/** What a part says until J accepts its suggestion: plain, and plainly a stand-in. */
function standIn(n: DraftNode, section: string): string {
  if (n.featureId === "cta-primary") return "Button";
  if (n.featureId === "prose") return /: heading$/.test(n.label) ? section : "Words go here.";
  return "";
}

/**
 * The pages J picked, each from the version J picked it from, laid out in
 * the house style, with links between them.
 *
 *   `words: "offer"` (the site)  every suggested word is held back as an offer;
 *   `words: "fill"` (thumbnails) the words are put in, to show the version's voice.
 */
export function buildSite(v: Versions, picks: Picks, system: System, o: { frameWidth?: number; words?: "offer" | "fill" } = {}): BuiltSite {
  const rows = pageRows(v).filter((r) => picks[r.key] != null && r.in.has(picks[r.key]!));
  const pages: SitePage[] = [];
  const used = new Set<string>();
  rows.forEach((r, i) => {
    const page = v.versions[picks[r.key]!]!.pages[r.in.get(picks[r.key]!)!]!;
    let id = i === 0 ? "page_home" : `page_${slug(page.name)}`;
    for (let k = 2; used.has(id); k++) id = `page_${slug(page.name)}_${k}`;
    used.add(id);
    pages.push({ id, name: i === 0 ? (r.key === "home" ? "Home" : page.name) : page.name, path: pathOf(page.name, i), prompt: "", scroll: "inherit" });
  });

  const nodes: DraftNode[] = [];
  const offers: WordOffer[] = [];
  rows.forEach((r, i) => {
    const vi = picks[r.key]!;
    const source = v.versions[vi]!.pages[r.in.get(vi)!]!;
    const page = pages[i]!;
    /* The row of links goes under the header (a section that is only a header part), else at the top. */
    const sections = [...source.sections];
    if (pages.length > 1) {
      const nav: PlanSection = { name: NAV_SECTION, parts: pages.map((p) => ({ kind: "button", text: p.name, main: p.id === page.id })) };
      const afterHeader = sections[0]?.parts.length && sections[0].parts.every((q) => q.kind === "part" && /header/.test(q.featureId)) ? 1 : 0;
      sections.splice(afterHeader, 0, nav);
    }
    const board = planToBoard({ name: v.name, description: v.description, sections, missing: [] }, system, { pageId: page.id, frameWidth: o.frameWidth });
    const prefix = `${DRAFT_PREFIX}${i === 0 ? "" : `${slug(page.name)}_`}`;
    const sectionOf = (label: string) => label.split(": ")[0] ?? "";
    for (const n0 of board.nodes) {
      const n = { ...n0, id: prefix + n0.id.slice(DRAFT_PREFIX.length) } as DraftNode;
      const section = sectionOf(n.label);
      if (section === NAV_SECTION && n.featureId === "cta-primary") {
        const to = pages.find((p) => p.name === n.content);
        if (to) n.link = { kind: "page", target: to.id };
      } else if (o.words !== "fill" && n.featureId !== "box" && n.featureId !== "custom-idea" && typeof n.content === "string" && n.content.trim()) {
        const now = standIn(n, section);
        offers.push({ id: `w_${n.id}`, nodeId: n.id, pageId: page.id, page: page.name, part: n.label, now, to: n.content });
        n.content = now;
      }
      nodes.push(n);
    }
  });
  return { pages, nodes, palette: rolesOf(system), offers };
}
