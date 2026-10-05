/**
 * WHICH PARTS ARE THE SAME KIND, for Make all like this.
 *
 * A site's buttons, its cards, its panels, its badges and its headings are
 * each a kind a person means when they say "make all the buttons like this
 * one". A part's kind is read once, here: a button, badge, panel or card by
 * the rule the style kits use (`roleOf`, styleKits.ts: pressable and button
 * sized, small, big, card sized), a heading by its words and tag
 * (`isHeadingish`), and anything else by what it is in the catalogue and in
 * a word (`kindOf`). Pure.
 */
import { roleOf, type KitNode } from "./styleKits";
import { isHeadingish, kindOf } from "./partNames";

type Part = KitNode & { pageId?: string; inert?: boolean };

/**
 * The kind a part is, as a key: "button", "card", "panel", "badge",
 * "heading", or "<featureId>:<kind word>". A kind is also the part the
 * catalogue draws it as: a box captured inside a link is not one of the
 * site's buttons, the words on a button are not a heading.
 */
export function kindKey(n: Part): string {
  const role = roleOf(n as KitNode);
  if (role === "button" && n.featureId === "cta-primary") return "button";
  if (isHeadingish(n as never) && (n.featureId === "heading" || n.featureId === "value-prop" || n.featureId === "prose")) return `heading:${n.featureId}`;
  if (role && role !== "button") return `${role}:${n.featureId}`;
  return `${n.featureId}:${kindOf(n as never)}`;
}

/** The kind in plain words: one ("button", "word part") or many ("buttons", "boxes"). */
export function kindWord(key: string, count: number): string {
  const [a, b] = key.split(":");
  const one = (["card", "panel", "badge", "heading"].includes(a!) || !b ? a! : b).toLowerCase();
  const word = one === "words" ? "word part" : one;
  if (count === 1) return word;
  if (/(x|s|sh|ch)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

/** The kind in plain words, many of them: "buttons", "cards", "headings", "pictures". */
export const kindWords = (key: string) => kindWord(key, 2);

/** Every other part of the site (every page) of `n`'s kind. A part drawn by the Builder for itself (inert: a dust layer) is not one. */
export function sameKind<T extends Part>(nodes: readonly T[], n: T): T[] {
  const key = kindKey(n);
  return nodes.filter((m) => m.id !== n.id && !m.inert && kindKey(m) === key);
}

/**
 * WHICH OF THE PART PANEL'S SECTIONS FIT A PART, by what the part is.
 *
 * A section that cannot mean anything on a part is not shown on it: a mark
 * is for a new idea drawn on the board, not a part brought in from a site
 * or the words on a control; a picture is drawn for a box, a picture or a
 * section, not for a button, a link or a line of words; a button's job is
 * said where its link is ("or say what it should do"), so it has no prompt
 * of its own. `kind` is the panel's kind word (`partNames.kindOf`). Pure.
 */
export interface PanelFacts {
  kind: string;
  /** The words on a button or a link: its label. */
  label: boolean;
  /** Brought in from a site or a repository, not drawn here. */
  brought: boolean;
  /** Its own mark, if it was given one. */
  glyph: string | null;
  /** It holds or is a picture. */
  picture: boolean;
}

const CONTROLS = new Set(["Button", "Link"]);
const WORDS = new Set(["Words", "Heading", "Text"]);

export function panelFits(f: PanelFacts): { mark: boolean; picture: boolean; prompt: boolean } {
  return {
    mark: !!f.glyph || (!f.brought && !f.label && !CONTROLS.has(f.kind)),
    picture: f.picture || (!f.label && !CONTROLS.has(f.kind) && !WORDS.has(f.kind)),
    prompt: f.kind !== "Button" && !(f.label && f.kind !== "Link"),
  };
}

/** What a part's code is known to do with it, as the import read it (`codeRefs.ts`, `sourceHooks.ts`). */
export interface PartCode {
  refs: readonly { kind: string; code: string }[];
  vars?: readonly string[] | null;
}

/** A place a script sets: a box edge, a transform, or a variable named for one (`--x-left`, `--marker-top`, `--tour-box-x`). */
const PLACED_PROP = /\b(left|top|right|bottom|inset|transform|translate|position)\b/i;
const PLACED_VAR = /^--[\w-]*?-(left|top|right|bottom|x|y|pos|position|offset|translate)$/i;

/**
 * Whether the page's own code positions the part, so its Position and size
 * would be overwritten when the code runs: a script line that styles its
 * place, or a position variable among the CSS variables it uses (the rule
 * every builder-ready site keeps: scripts set positions only as variables).
 * Pure.
 */
export function codePlaced(code: PartCode | null | undefined): boolean {
  if (!code) return false;
  if (code.refs.some((r) => r.kind === "styles" && PLACED_PROP.test(r.code))) return true;
  return !!code.vars?.some((v) => PLACED_VAR.test(v.trim()));
}

/** How many scripts touch a part: the files its code references are in. */
export function scriptCount(code: { refs: readonly { file: string }[] } | null | undefined): number {
  return code ? new Set(code.refs.map((r) => r.file)).size : 0;
}
