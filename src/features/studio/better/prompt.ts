/**
 * THE CLAUDE PASS FOR VARIATIONS: what is asked, and how the answer is read.
 *
 * One call (`api/studio/better/route.ts`) with the original's pages as
 * pictures, its sections and its System in short, the aims J ticked and the
 * site he named, if he named one. Claude answers with several variant
 * specs at once, each a choice per layer from the same lists the local
 * roll picks from (`variations/model.ts`), with a line on what it is for.
 *
 * Words stay his: a variant may carry word suggestions, each one shown for
 * him to accept or not, one at a time, and only for parts whose words were
 * sent. Anything in the answer that is not one of the allowed choices is
 * dropped, never guessed at (`readSpec`).
 *
 * Pure. Shared by the route and its test.
 */
import { CORNERS, HARMONIES, MOTIONS, PAIRINGS } from "../siteTheme.ts";
import { AIM_LABEL, readSpec, type Aim, type Spec, type WordSuggestion } from "../variations/model.ts";

export interface BetterAsk {
  aims: Aim[];
  /** The site J named to be like, as he typed it. */
  like?: string | null;
  /** How many variants (1 to 6). */
  count: number;
  site: {
    name: string;
    /** Top to bottom: what each section says, shortened. */
    sections: { index: number; words: string; height: number }[];
    /** The System in short: "colour: rgb(…) ×12 …". */
    system: string;
  };
  /** Parts whose words may get a suggestion: id and the words now. */
  words: { part: string; now: string }[];
}

export interface BetterVariant { note: string; spec: Spec; words: WordSuggestion[] }

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
          note: { type: "string", description: "One plain sentence: what this variant changes and why it serves the aims." },
          colours: {
            type: "object",
            properties: { keep: { type: "boolean" }, hue: { type: "number", description: "Base hue in degrees, 0–359." }, harmony: CHOICE(HARMONIES), chroma: { type: "number", description: "OKLCH chroma of the accent, 0.04–0.2." } },
            required: ["keep", "hue", "harmony", "chroma"], additionalProperties: false,
          },
          type: {
            type: "object",
            properties: { keep: { type: "boolean" }, pairing: CHOICE(PAIRINGS.map((p) => p.id)), ratio: { type: "number", description: "Type scale ratio, 1.2–1.5." }, base: { type: "number", description: "Body size in px, 15–20." } },
            required: ["keep", "pairing", "ratio", "base"], additionalProperties: false,
          },
          space: {
            type: "object",
            properties: { keep: { type: "boolean" }, step: { type: "number", description: "Spacing step in px: 4, 6 or 8." }, density: { type: "number", description: "How many steps a gap becomes per step it was: 0.75–1.5." }, corner: CHOICE(CORNERS) },
            required: ["keep", "step", "density", "corner"], additionalProperties: false,
          },
          layout: {
            type: "object",
            properties: {
              keep: { type: "boolean" },
              sections: { type: "array", items: { type: "object", properties: { align: CHOICE(["keep", "start", "center"]), flip: { type: "boolean" } }, required: ["align", "flip"], additionalProperties: false } },
            },
            required: ["keep", "sections"], additionalProperties: false,
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
        required: ["note", "colours", "type", "space", "layout", "order", "motion", "words"],
        additionalProperties: false,
      },
    },
  },
  required: ["variants"],
  additionalProperties: false,
} as const;

export const SYSTEM = `You design better versions of an existing website. You are shown its pages as pictures, its sections top to bottom, and its design system (colours, type sizes, spacing, corners, motion) in short.

Answer with several variants at once. Each variant is a choice for six layers, and for each layer you may say keep (the site as it is) instead:
- colours: a base hue, a harmony rule and a strength. Every colour keeps its lightness, so a dark site stays dark; text is held readable for you.
- type: a font pairing from the list, a type scale ratio and a body size. Every size snaps to the scale.
- space: a spacing step, a density and a corner style. Every gap and padding snaps to the step.
- layout: per section, its column centred, set to the left, or kept, and whether its rows are turned round.
- order: the sections in a new order (every index once).
- motion: calm, bouncy or snappy.

Make the variants clearly different from each other, each a real design direction, all serving the aims. Never invent content: the words belong to the owner. Suggest a word change only where it plainly makes the page clearer for a visitor (the first screen's message, the main button), only for the parts listed under WORDS, and say why in one line.`;

/** The words of the ask, after the pictures. */
export function askText(a: BetterAsk): string {
  const lines: string[] = [];
  lines.push(`SITE: ${a.site.name}`);
  lines.push(`AIMS: ${a.aims.length ? a.aims.map((x) => AIM_LABEL[x]).join("; ") : "a better version, any direction"}`);
  if (a.like?.trim()) lines.push(`LIKE: the owner wants it to feel like ${a.like.trim()}. Use what you know of that site's design.`);
  lines.push(`VARIANTS: exactly ${a.count}.`);
  lines.push("", "SECTIONS (index, height, what it says):", ...a.site.sections.map((s) => `${s.index}. ${Math.round(s.height)}px: ${s.words || "(no words)"}`));
  lines.push("", "SYSTEM:", a.site.system);
  lines.push("", "PAIRINGS:", ...PAIRINGS.map((p) => `${p.id}: ${p.name}`));
  if (a.words.length) lines.push("", "WORDS (part id: the words now):", ...a.words.map((w) => `${w.part}: ${w.now}`));
  return lines.join("\n");
}

const KEPT = (o: unknown) => !o || typeof o !== "object" || (o as { keep?: unknown }).keep === true;

/** Claude's answer read into variants: specs read strictly, words only for parts that were sent and only where they change something. */
export function readAnswer(raw: unknown, a: Pick<BetterAsk, "words" | "count">, sections: number): BetterVariant[] {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { variants?: unknown }).variants) ? (raw as { variants: unknown[] }).variants : [];
  const sent = new Map(a.words.map((w) => [w.part, w.now]));
  return list.slice(0, Math.max(1, Math.min(6, a.count))).map((v, i) => {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const layers = Object.fromEntries(["colours", "type", "space", "layout", "order", "motion"].map((k) => [k, KEPT(o[k]) ? null : o[k]]));
    const words = (Array.isArray(o.words) ? o.words : []).flatMap((w, j): WordSuggestion[] => {
      const e = (w && typeof w === "object" ? w : {}) as Record<string, unknown>;
      const now = typeof e.part === "string" ? sent.get(e.part) : undefined;
      if (now === undefined || typeof e.to !== "string" || !e.to.trim() || e.to.trim() === now) return [];
      return [{ id: `w${i}_${j}`, part: e.part as string, now, to: e.to.trim().slice(0, 400), why: typeof e.why === "string" ? e.why.slice(0, 200) : "" }];
    });
    return { note: typeof o.note === "string" ? o.note.slice(0, 300) : "", spec: readSpec(layers, sections), words };
  });
}

/** The answer text as JSON, a fence or a stray word round it allowed. */
export function parseJson(text: string): unknown {
  const raw = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}
