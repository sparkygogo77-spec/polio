/**
 * WHAT THE DRAFT ROUTE ASKS CLAUDE, and how it reads the answer.
 *
 * One call per draft (J, Q8). Claude gets the catalogue of parts that work on
 * a published site (first, marked for caching: it is the same on every call),
 * then J's words, the sections J named and the site given as a reference.
 * It answers with one JSON object in the schema below, and `readPlan` keeps
 * only what the catalogue has; everything else becomes a labelled
 * placeholder.
 *
 * The call itself is handed in (`send`), so the route makes a real one and
 * the tests make none.
 *
 * Server and node: no React, no store, every import ends in .ts.
 */
import { catalogueText, readPlan, type Idea, type Plan } from "./plan.ts";
import { readVersions, type Versions } from "./versions.ts";

/** The latest Claude model. */
export const DRAFT_MODEL = "claude-opus-5-5";

export const PLAN_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "The site's name, short, as its header shows it." },
    description: { type: "string", description: "One sentence a visitor reads in a link preview." },
    sections: {
      type: "array",
      description: "The page from top to bottom: a header first, a footer last.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "What the section is, in two or three words." },
          parts: {
            type: "array",
            description: "What is in the section, top to bottom.",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["heading", "text", "button", "part", "placeholder"] },
                text: { type: "string", description: "heading, text, button: the words, as the site would say them." },
                level: { type: "integer", enum: [1, 2, 3], description: "heading: 1 for the first screen's title only, 2 for a section, 3 below that." },
                main: { type: "boolean", description: "button: true for the one thing the section wants a visitor to do." },
                featureId: { type: "string", description: "part: an id from the catalogue, exactly." },
                label: { type: "string", description: "part: a short plain name for it on this site." },
                content: { type: "string", description: "part: what it holds, for a part the catalogue says holds something (links, items, questions), comma-separated." },
                options: {
                  type: "array",
                  description: "part: option values to set, only ids and values the catalogue lists for it.",
                  items: { type: "object", properties: { id: { type: "string" }, value: { type: "string" } }, required: ["id", "value"], additionalProperties: false },
                },
                name: { type: "string", description: "placeholder: what is wanted here that no catalogue part does." },
                why: { type: "string", description: "placeholder: one line on what it would need." },
              },
              required: ["kind"],
              additionalProperties: false,
            },
          },
        },
        required: ["name", "parts"],
        additionalProperties: false,
      },
    },
    missing: {
      type: "array",
      description: "Everything asked for that no catalogue part does. Each also has a placeholder where it belongs in a section.",
      items: { type: "object", properties: { name: { type: "string" }, why: { type: "string" } }, required: ["name", "why"], additionalProperties: false },
    },
  },
  required: ["name", "description", "sections", "missing"],
  additionalProperties: false,
} as const;

export const DRAFT_SYSTEM = `You plan the first draft of a website from a short description.

You plan only what goes on the page and in what order. You never give a position, a size, a colour or a font: the site is laid out by code and drawn in its owner's house style.

Build the page only from these:
- heading, text and button: words, in the site's own voice. Write real words for this site, never "Lorem ipsum" or advice about what to write.
- part: a part from the catalogue, by its exact id. Use a part only for what it is. Set only options it lists.
- placeholder: for anything asked for that no catalogue part does (a booking calendar, a cart, a map). Name it plainly. Never pretend a catalogue part does something it does not; a labelled placeholder is better than a wrong part.

A good page: a header first (a header part from the catalogue), a first screen with the one title (heading level 1), a line under it and one or two buttons, then the sections the owner asked for in that order (or the few this kind of site needs), and a footer last (a footer part). Keep each section to what it needs: a heading, a line or two, and its parts.

List every placeholder you used under missing too.`;

export interface DraftInput { idea: Idea; name?: string }

/** The user message: the catalogue first (cached), then the idea. */
export function askFor(input: DraftInput): { text: string; cache?: true }[] {
  const { idea } = input;
  const lines = [`What the site is: ${idea.text.trim()}`];
  if (input.name?.trim()) lines.push(`Its name so far: ${input.name.trim()}`);
  if (idea.sections.length) lines.push(`The sections the owner wants, in order: ${idea.sections.join(", ")}`);
  if (idea.ref) lines.push(`A site the owner likes, for what it has on its page (do not copy its words): ${idea.ref}`);
  return [{ text: catalogueText(), cache: true }, { text: lines.join("\n") }];
}

/** What a stubbed or real call hands back. */
export interface Sent { text: string; stop: string | null; usage?: { input: number; output: number; cached: number; written: number; model: string } }

export type Drafted =
  | { ok: true; plan: Plan; usage?: Sent["usage"] }
  | { ok: false; reason: string; message: string; usage?: Sent["usage"] };

/** One call, read strictly. */
export async function askForPlan(input: DraftInput, send: (system: string, blocks: { text: string; cache?: true }[]) => Promise<Sent>): Promise<Drafted> {
  if (!input.idea.text.trim()) return { ok: false, reason: "empty", message: "Say what the site is first." };
  const sent = await send(DRAFT_SYSTEM, askFor(input));
  if (sent.stop === "refusal") return { ok: false, reason: "refusal", message: "Claude declined to plan this site.", usage: sent.usage };
  const plan = readPlan(parseJson(sent.text));
  if (!plan) {
    return sent.stop === "max_tokens"
      ? { ok: false, reason: "truncated", message: "Claude ran out of room before the plan was finished.", usage: sent.usage }
      : { ok: false, reason: "unreadable", message: "Claude's answer wasn't a page plan.", usage: sent.usage };
  }
  return { ok: true, plan, usage: sent.usage };
}

/** The answer is JSON, but a fence or a stray word round it should not lose the plan. */
export function parseJson(text: string): unknown {
  const raw = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

/* ------------------------------------------------------------------ */
/* Several versions in one call                                        */
/* ------------------------------------------------------------------ */

/** A page is a plan's sections under a name; a version is pages under a name. */
export const VERSIONS_SCHEMA = {
  type: "object",
  properties: {
    name: PLAN_SCHEMA.properties.name,
    description: PLAN_SCHEMA.properties.description,
    versions: {
      type: "array",
      description: "Three or four clearly different versions of the same site.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "A plain two- or three-word name for this version's approach, e.g. \"Calm editorial\", \"Bold product\"." },
          pitch: { type: "string", description: "One sentence on how this version differs from the others." },
          pages: {
            type: "array",
            description: "The pages this version needs, Home first. Use the usual page names (Home, About, Pricing, FAQ, Contact …) so pages can be matched across versions.",
            items: {
              type: "object",
              properties: { name: { type: "string", description: "The page's name, one or two words." }, sections: PLAN_SCHEMA.properties.sections },
              required: ["name", "sections"],
              additionalProperties: false,
            },
          },
        },
        required: ["name", "pitch", "pages"],
        additionalProperties: false,
      },
    },
    missing: PLAN_SCHEMA.properties.missing,
  },
  required: ["name", "description", "versions", "missing"],
  additionalProperties: false,
} as const;

export const VERSIONS_SYSTEM = `${DRAFT_SYSTEM}

This time, plan THREE OR FOUR CLEARLY DIFFERENT VERSIONS of the same site in one answer, so the owner can compare them and pick pages from each.
- Make the versions differ in approach, not only in words: what leads, how much is said, which pages exist, which parts carry it (for example a calm editorial version, a bold product version, a warm personal version, a one-page version).
- Give each version a plain name of two or three words and a one-line pitch.
- Each version proposes the pages it needs, Home first. Use the usual page names (Home, About, Pricing, FAQ, Contact) so the same page can be matched across versions. Each page is planned like the page above: a header first, a footer last.
- Do not add links between pages: the site adds them.`;

export type DraftedVersions =
  | { ok: true; versions: Versions; usage?: Sent["usage"] }
  | { ok: false; reason: string; message: string; usage?: Sent["usage"] };

/** One call for every version, read strictly. */
export async function askForVersions(input: DraftInput, send: (system: string, blocks: { text: string; cache?: true }[]) => Promise<Sent>): Promise<DraftedVersions> {
  if (!input.idea.text.trim()) return { ok: false, reason: "empty", message: "Say what the site is first." };
  const sent = await send(VERSIONS_SYSTEM, askFor(input));
  if (sent.stop === "refusal") return { ok: false, reason: "refusal", message: "Claude declined to plan this site.", usage: sent.usage };
  const versions = readVersions(parseJson(sent.text));
  if (!versions) {
    return sent.stop === "max_tokens"
      ? { ok: false, reason: "truncated", message: "Claude ran out of room before the versions were finished.", usage: sent.usage }
      : { ok: false, reason: "unreadable", message: "Claude's answer wasn't a set of versions.", usage: sent.usage };
  }
  return { ok: true, versions, usage: sent.usage };
}
