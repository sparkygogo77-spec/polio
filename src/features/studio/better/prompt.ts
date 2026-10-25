/**
 * THE CLAUDE PASS FOR VARIATIONS: what is asked, and how the answer is read.
 *
 * One call (`api/studio/better/route.ts`) with the original's pages as
 * pictures, its sections, its layout tree and its System in short, the aims
 * J ticked, the layers he locked and the site he named, if he named one.
 * Claude answers with four directions at once, each named in plain words
 * ("Calm editorial", "Bold product"), each a choice per layer from the same
 * rules the local roll follows (`variations/model.ts`), with a line on what
 * it is for.
 *
 * Words stay his: a direction may carry word suggestions, each one shown for
 * him to accept or not, one at a time, and only for parts whose words were
 * sent. Nothing is applied by the answer itself.
 *
 * The answer is read strictly (`readAnswer`): a choice that is not one of
 * the rules is dropped or landed on the nearest rule (`readSpec`); a locked
 * layer is left as the variation it was locked on has it; two directions
 * closer than `DIRECTION_GAP` are pushed apart, so four come back that are
 * four.
 *
 * Pure. Shared by the route and its test.
 */
import { CORNERS, HARMONIES, MOTIONS, PAIRINGS } from "../siteTheme.ts";
import { AIM_LABEL, AIRS, DENSITIES, DEPTHS, DIRECTION_GAP, GRID, LAYER_LABEL, LAYERS, RATIOS, TASTE_PAIRINGS, directionName, emptySpec, readSpec, rollLayer, specDistance, type Aim, type Layer, type SiteShape, type Spec, type WordSuggestion } from "../variations/model.ts";

export interface BetterAsk {
  aims: Aim[];
  /** The site J named to be like, as he typed it. */
  like?: string | null;
  /** How many directions (1 to 6). */
  count: number;
  /** Layers Claude must leave alone. */
  locks?: Layer[];
  site: {
    name: string;
    /** Top to bottom: what each section says, shortened. */
    sections: { index: number; words: string; height: number }[];
    /** The System in short: "colour: rgb(…) ×12 …". */
    system: string;
    /** The layout tree in plain lines (`variations/ask.ts#layoutLines`). */
    layout?: string;
  };
  /** Parts whose words may get a suggestion: id and the words now. */
  words: { part: string; now: string }[];
}

export interface BetterVariant { name: string; note: string; spec: Spec; words: WordSuggestion[] }

const CHOICE = (list: readonly string[]) => ({ type: "string", enum: [...list] });

/** The answer's shape. Structured output: every object closed. */
export const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    variants: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "The direction in two or three plain words, like a designer would name it: \"Calm editorial\", \"Bold product\", \"Quiet grid\"." },
          note: { type: "string", description: "One plain sentence: what this direction changes and why it serves the aims." },
          colours: {
            type: "object",
            properties: { keep: { type: "boolean" }, hue: { type: "number", description: "Base hue in degrees, 0–359. Stay near the site's own hue unless the aims ask for a new family." }, harmony: CHOICE(HARMONIES), chroma: { type: "number", description: "OKLCH chroma of the accent, 0.06–0.18." } },
            required: ["keep", "hue", "harmony", "chroma"], additionalProperties: false,
          },
          type: {
            type: "object",
            properties: { keep: { type: "boolean" }, pairing: CHOICE(PAIRINGS.map((p) => p.id)), ratio: { type: "number", description: "Type scale ratio: 1.2, 1.25 or 1.333." }, base: { type: "number", description: "Body size in px, 16–18." } },
            required: ["keep", "pairing", "ratio", "base"], additionalProperties: false,
          },
          space: {
            type: "object",
            properties: { keep: { type: "boolean" }, step: { type: "number", description: "Spacing step in px: 4 or 8." }, density: { type: "number", description: "How many steps a gap becomes per step it was: 1, 1.25 or 1.5." }, corner: CHOICE(CORNERS), depth: CHOICE(DEPTHS) },
            required: ["keep", "step", "density", "corner", "depth"], additionalProperties: false,
          },
          layout: {
            type: "object",
            properties: {
              keep: { type: "boolean" },
              sections: { type: "array", items: { type: "object", properties: { align: CHOICE(["keep", "start", "center"]), flip: { type: "boolean" } }, required: ["align", "flip"], additionalProperties: false } },
              air: { type: "number", description: "More space above every section after the first, px: 0, 16, 32 or 48." },
            },
            required: ["keep", "sections", "air"], additionalProperties: false,
          },
          order: {
            type: "object",
            properties: { keep: { type: "boolean" }, order: { type: "array", items: { type: "number" }, description: "Every section index exactly once, in the new order." } },
            required: ["keep", "order"], additionalProperties: false,
          },
          motion: { type: "object", properties: { keep: { type: "boolean" }, style: CHOICE(MOTIONS) }, required: ["keep", "style"], additionalProperties: false },
          words: {
            type: "array",
            description: "Word changes to suggest, only for the parts listed under WORDS. Empty when the words already work.",
            items: { type: "object", properties: { part: { type: "string" }, to: { type: "string" }, why: { type: "string" } }, required: ["part", "to", "why"], additionalProperties: false },
          },
        },
        required: ["name", "note", "colours", "type", "space", "layout", "order", "motion", "words"],
        additionalProperties: false,
      },
    },
  },
  required: ["variants"],
  additionalProperties: false,
} as const;

export const SYSTEM = `You are a senior web designer making better versions of an existing website: better, not merely different. You are shown its pages as pictures, its sections top to bottom with their words, its layout tree (how the parts sit in rows, columns and grids, with their gaps), and its design system (colours, type sizes and faces, spacing, corners, shadows, motion) in short.

Answer with the number of DIRECTIONS asked for. Each is a distinct, coherent design direction a designer would name in two or three plain words ("Calm editorial", "Bold product", "Quiet grid", "Warm friendly"). Four directions must read as four different ideas, not four shades of one.

Each direction is a choice for six layers; for any layer you may say keep (leave the site as it is) instead. Follow these rules, which are the rules of good work, not options:
- colours: a base hue, a harmony rule and a strength. Keep to the site's own hue family (a turn of 0–30 degrees) unless the aims ask for a new feel; use tinted neutrals (mono), analogous or complementary harmonies. Every colour keeps its lightness, so a dark site stays dark; words are held at AA for you.
- type: a font pairing from PAIRINGS whose heading and body suit each other, a real type scale (1.2 minor third, 1.25 major third, 1.333 perfect fourth), a body of 16–18px. One scale across the page.
- space: a step on the 4/8 grid (8 unless the site is dense), a density that is never tighter than the original (1, 1.25 or 1.5), a corner family and a depth that agree: square corners are flat; soft corners take soft shadows; round corners may be soft or lifted; pills stay low.
- layout: read from the layout tree. One alignment for the whole body so the columns line up down the page, rows turned round for rhythm only where a row has two items, and air above sections so the page breathes. For "clearer", the first screen centred on its one message and its one main button.
- order: one pair of neighbouring middle sections swapped at most; the first screen and the foot stay. Keep it unless a section plainly belongs earlier.
- motion: calm, bouncy or snappy; calm for editorial, snappy for product.

A layer under LOCKED must say keep. Never invent content: the words belong to the owner, and nothing you say is applied by itself. Suggest a word change only where it plainly makes the page clearer for a visitor (the first screen's message, the main button), only for the parts listed under WORDS, and say why in one line.`;

/** The words of the ask, after the pictures. */
export function askText(a: BetterAsk): string {
  const lines: string[] = [];
  lines.push(`SITE: ${a.site.name}`);
  lines.push(`AIMS: ${a.aims.length ? a.aims.map((x) => AIM_LABEL[x]).join("; ") : "a better version, any direction"}`);
  if (a.like?.trim()) lines.push(`LIKE: the owner wants it to feel like ${a.like.trim()}. Use what you know of that site's design: its type, its spacing, its restraint or its boldness.`);
  if (a.locks?.length) lines.push(`LOCKED: say keep for ${a.locks.map((l) => `${l} (${LAYER_LABEL[l].toLowerCase()})`).join(", ")}.`);
  lines.push(`DIRECTIONS: exactly ${a.count}, each clearly different from the others.`);
  lines.push("", "SECTIONS (index, height, what it says):", ...a.site.sections.map((s) => `${s.index}. ${Math.round(s.height)}px: ${s.words || "(no words)"}`));
  if (a.site.layout) lines.push("", "LAYOUT:", a.site.layout);
  lines.push("", "SYSTEM:", a.site.system);
  lines.push("", "PAIRINGS (heading over body):", ...PAIRINGS.map((p) => `${p.id}: ${p.name}${TASTE_PAIRINGS.includes(p.id) ? "" : " (novelty: only when the aims ask for it)"}`));
  lines.push("", `RULES: ratio in ${RATIOS.join(", ")}; step in ${GRID.join(", ")}; density in ${DENSITIES.join(", ")}; air in ${AIRS.join(", ")}.`);
  if (a.words.length) lines.push("", "WORDS (part id: the words now):", ...a.words.map((w) => `${w.part}: ${w.now}`));
  return lines.join("\n");
}

const KEPT = (o: unknown) => !o || typeof o !== "object" || (o as { keep?: unknown }).keep === true;

/** The name from the answer when it is plain words; else one from what the direction does. */
function nameOf(v: unknown, spec: Spec): string {
  const raw = typeof v === "string" ? v.trim().replace(/[.!"]+$/g, "") : "";
  if (/^[A-Za-z][A-Za-z-]*( [A-Za-z-]+){0,3}$/.test(raw) && raw.length <= 32) return raw[0]!.toUpperCase() + raw.slice(1).toLowerCase();
  return directionName(spec);
}

/**
 * Two directions closer than DIRECTION_GAP are the same direction: the
 * later one's unlocked layers are re-rolled from a seed of its index until
 * it stands apart from every earlier one (a few tries, deterministic).
 */
export function apart(specs: Spec[], locks: readonly Layer[], aims: readonly Aim[], shape: SiteShape | null): Spec[] {
  const out: Spec[] = [];
  const free = LAYERS.filter((l) => !locks.includes(l));
  for (let i = 0; i < specs.length; i++) {
    let s = specs[i]!;
    const close = () => out.some((o) => specDistance(o, s) <= DIRECTION_GAP);
    for (let k = 0; k < 12 && close() && shape && free.length; k++) {
      const l = free[(i + k) % free.length]!;
      s = { ...s, [l]: rollLayer(l, 7919 * (i + 1) + 104729 * k, aims, shape) };
    }
    out.push(s);
  }
  return out;
}

/** Claude's answer read into directions: specs read strictly, locks kept, directions apart, words only for parts that were sent and only where they change something. */
export function readAnswer(raw: unknown, a: Pick<BetterAsk, "words" | "count"> & { locks?: readonly Layer[]; aims?: readonly Aim[] }, sections: number, shape: SiteShape | null = null): BetterVariant[] {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { variants?: unknown }).variants) ? (raw as { variants: unknown[] }).variants : [];
  const sent = new Map(a.words.map((w) => [w.part, w.now]));
  const locks = a.locks ?? [];
  const read = list.slice(0, Math.max(1, Math.min(6, a.count))).map((v, i) => {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const layers = Object.fromEntries(LAYERS.map((k) => [k, KEPT(o[k]) || locks.includes(k) ? null : o[k]]));
    const words = (Array.isArray(o.words) ? o.words : []).flatMap((w, j): WordSuggestion[] => {
      const e = (w && typeof w === "object" ? w : {}) as Record<string, unknown>;
      const now = typeof e.part === "string" ? sent.get(e.part) : undefined;
      if (now === undefined || typeof e.to !== "string" || !e.to.trim() || e.to.trim() === now) return [];
      return [{ id: `w${i}_${j}`, part: e.part as string, now, to: e.to.trim().slice(0, 400), why: typeof e.why === "string" ? e.why.slice(0, 200) : "" }];
    });
    return { nameRaw: o.name, note: typeof o.note === "string" ? o.note.slice(0, 300) : "", spec: { ...emptySpec(), ...readSpec(layers, sections) }, words };
  });
  const specs = apart(read.map((r) => r.spec), locks, a.aims ?? [], shape);
  const names = new Set<string>();
  return read.map((r, i) => {
    const spec = specs[i]!;
    let name = nameOf(r.nameRaw, spec);
    if (names.has(name)) name = directionName(spec);
    for (let k = 2; names.has(name); k++) name = `${nameOf(r.nameRaw, spec)} ${["two", "three", "four", "five", "six"][k - 2] ?? k}`;
    names.add(name);
    return { name, note: r.note, spec, words: r.words };
  });
}

/** The answer text as JSON, a fence or a stray word round it allowed. */
export function parseJson(text: string): unknown {
  const raw = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}
