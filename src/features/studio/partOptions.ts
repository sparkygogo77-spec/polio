/**
 * What can be changed on a part, as data the side panel reads.
 *
 * HIS ASK (Lane I, 5): every item defines its editable options as data
 * (versions, colours, sizes, speed, words, link destination and so on) that
 * the part panel reads, so after adding an item the side panel shows its
 * options and changing them updates the canvas and the export.
 *
 * One list per part, `editablesOf(node)`, built from what the library
 * already says about it and never kept anywhere else:
 *
 *   · its VERSION, when the shelf item it is stands for near-copies
 *     (`shelfPlan.ts#VARIANTS`): switching it swaps the part that draws;
 *   · its WORDS, when the catalogue gives it a contents field;
 *   · where it LINKS TO, when the part can be a link;
 *   · its own OPTIONS (`catalog.ts`), each a pick, a set or a slider;
 *   · its COLOURS: fill, words, accent, as the site's roles or its own;
 *   · its SPEED, when it has an entrance;
 *   · the INPUTS of every library feature it carries (`node.work`).
 *
 * Each field says which of the part panel's sections it belongs in
 * (Content, Position and size, Look, Motion), how it reads its value off
 * the node, and what change it makes. The change is a plain patch for
 * `updateNode`, so the board, the preview and the export all follow it: the
 * same document is what each of them draws.
 *
 * Pure: no store, no React. `tests/part-options.mjs` walks every shelf item.
 */
import { MOTION_OPTION_IDS, getFeature, type FeatureOption } from "./catalog.ts";
import { VARIANTS, itemOf } from "./shelfPlan.ts";
import { isWorkKey } from "./shelfGroups.ts";
import { getWork, onUsesOf, withInput, type WorkUse } from "./library/works.ts";

/** The side panel's sections for a part. */
export type Section = "content" | "position" | "look" | "motion";

export type EditKind = "one" | "set" | "range" | "text" | "link" | "colour";

/** The part as far as its options go. */
export interface Editable {
  featureId: string;
  options?: Record<string, string>;
  content?: unknown;
  link?: { kind: string; target: string } | null;
  colour?: Record<string, unknown> | null;
  anim?: string | null;
  animSpeed?: number;
  work?: WorkUse | null;
  w?: number;
  h?: number;
}

export interface Field {
  /** Stable within a part: `version`, `words`, `link`, `option:<id>`, `colour:<slot>`, `speed`, `work:<feature>:<input>`, `size:w`. */
  id: string;
  label: string;
  section: Section;
  kind: EditKind;
  /** For a pick or a set: what can be chosen, as the words shown. */
  values?: string[];
  range?: { min: number; max: number; step: number; unit?: string };
  placeholder?: string;
  /** Where it comes from, for the checks and for the panel's grouping. */
  source: "version" | "content" | "link" | "option" | "colour" | "speed" | "work" | "size";
}

/** The site's colour roles a part's colour can follow, and its own colour in their place. */
export const COLOUR_ROLES = ["bg", "surface", "text", "muted", "accent", "highlight"] as const;
const COLOUR_SLOTS: { slot: string; label: string }[] = [
  { slot: "bg", label: "Fill" },
  { slot: "text", label: "Words" },
  { slot: "accent", label: "Accent" },
];

const optionSection = (o: FeatureOption): Section => (MOTION_OPTION_IDS.has(o.id) ? "motion" : "look");

/** The versions a part can switch between: the parts of its shelf item. Library features are put on a part, not swapped in. */
export function versionsFor(featureId: string): { key: string; label: string }[] {
  const item = itemOf(featureId);
  if (!item || isWorkKey(item)) return [];
  const v = VARIANTS[item];
  if (!v) return [];
  return [{ key: item, label: v.self }, ...v.more.filter((m) => !isWorkKey(m.key)).map((m) => ({ key: m.key, label: m.label }))];
}

/** Every field a part offers, in the order the panel shows them. */
export function editablesOf(node: Editable, opts: { linkable?: boolean } = {}): Field[] {
  const f = getFeature(node.featureId);
  const out: Field[] = [];
  const versions = versionsFor(node.featureId);
  if (versions.length > 1) out.push({ id: "version", label: "Version", section: "content", kind: "one", values: versions.map((v) => v.label), source: "version" });
  if (f?.content) out.push({ id: "words", label: f.content.label, section: "content", kind: "text", placeholder: f.content.placeholder, source: "content" });
  if (opts.linkable) out.push({ id: "link", label: "Links to", section: "content", kind: "link", source: "link" });
  out.push({ id: "size:w", label: "Width", section: "position", kind: "range", range: { min: 24, max: 1920, step: 1, unit: "px" }, source: "size" });
  out.push({ id: "size:h", label: "Height", section: "position", kind: "range", range: { min: 16, max: 4000, step: 1, unit: "px" }, source: "size" });
  for (const o of f?.options ?? []) {
    out.push({
      id: `option:${o.id}`, label: o.label, section: optionSection(o),
      kind: o.kind === "set" ? "set" : o.kind === "range" ? "range" : "one",
      values: o.kind === "range" ? undefined : o.values,
      range: o.range ? { min: o.range.min, max: o.range.max, step: o.range.step ?? 1, unit: o.range.unit } : undefined,
      source: "option",
    });
  }
  for (const c of COLOUR_SLOTS) out.push({ id: `colour:${c.slot}`, label: c.label, section: "look", kind: "colour", values: [...COLOUR_ROLES], source: "colour" });
  if (node.anim) out.push({ id: "speed", label: "Speed", section: "motion", kind: "range", range: { min: 0.25, max: 3, step: 0.05, unit: "×" }, source: "speed" });
  for (const u of onUsesOf(node.work)) {
    const w = getWork(u.id);
    if (!w) continue;
    const section: Section = w.manifest.category === "motion" ? "motion" : "content";
    for (const i of w.manifest.inputs) {
      out.push({
        id: `work:${u.id}:${i.id}`, label: `${w.manifest.name}: ${i.label}`, section,
        kind: i.kind === "one" ? "one" : "text", values: i.values, placeholder: i.placeholder, source: "work",
      });
    }
  }
  return out;
}

/** A field's value on the node, as the words the panel shows. */
export function readField(node: Editable, field: Field): string {
  const f = getFeature(node.featureId);
  switch (field.source) {
    case "version": return versionsFor(node.featureId).find((v) => v.key === node.featureId)?.label ?? "";
    case "content": return typeof node.content === "string" ? node.content : "";
    /* `page:<id>`, `url:<address>` or `node:<id>`, as `NodeLink` keeps it. */
    case "link": return node.link ? `${node.link.kind}:${node.link.target}` : "";
    case "size": return String(field.id === "size:w" ? node.w ?? f?.w ?? 0 : node.h ?? f?.h ?? 0);
    case "option": {
      const id = field.id.slice(7);
      const o = f?.options?.find((x) => x.id === id);
      return node.options?.[id] ?? (o?.kind === "set" ? o.preset ?? "" : o?.values[0] ?? "");
    }
    case "colour": {
      const v = node.colour?.[field.id.slice(7)];
      return typeof v === "string" ? v : "";
    }
    case "speed": return String(node.animSpeed ?? 1);
    case "work": {
      const [, id, input] = field.id.split(":");
      const u = onUsesOf(node.work).find((x) => x.id === id);
      const def = getWork(id)?.manifest.inputs.find((i) => i.id === input);
      return u?.inputs[input!] ?? def?.default ?? "";
    }
  }
}

/** The change a new value makes: a patch for `updateNode`. Null when the value is not one the field takes. */
export function writeField(node: Editable, field: Field, value: string): Partial<Editable> | null {
  switch (field.source) {
    case "version": {
      const v = versionsFor(node.featureId).find((x) => x.label === value || x.key === value);
      return v ? { featureId: v.key } : null;
    }
    case "content": return { content: value };
    case "link": {
      const v = value.trim();
      if (!v) return { link: null };
      const m = /^(page|url|node):(.+)$/.exec(v);
      if (m) return { link: { kind: m[1]!, target: m[2]! } };
      return /^(https?:|mailto:)/.test(v) ? { link: { kind: "url", target: v } } : null;
    }
    case "size": {
      const n = Math.round(Number(value));
      if (!Number.isFinite(n) || n <= 0) return null;
      return field.id === "size:w" ? { w: n } : { h: n };
    }
    case "option": {
      if (field.kind === "one" && field.values && !field.values.includes(value)) return null;
      if (field.kind === "range" && !Number.isFinite(Number(value))) return null;
      return { options: { ...(node.options ?? {}), [field.id.slice(7)]: value } };
    }
    case "colour": {
      const slot = field.id.slice(7);
      const colour = { ...(node.colour ?? {}) } as Record<string, unknown>;
      if (value) colour[slot] = value; else delete colour[slot];
      return { colour };
    }
    case "speed": {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? { animSpeed: n } : null;
    }
    case "work": {
      const [, id, input] = field.id.split(":");
      return { work: withInput(node.work, id!, input!, value) };
    }
  }
}
