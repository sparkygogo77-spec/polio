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
