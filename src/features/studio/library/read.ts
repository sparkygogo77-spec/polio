/**
 * The one box: what was typed, read as what it means.
 *
 * One box replaces the pencil menu's words, contents, links, data and
 * priority. The owner types and it applies at once, saying how it was
 * understood, with undo beside it:
 *
 *   · a web address is a link (with or without the https);
 *   · a page's name is a link to that page;
 *   · plain text is the part's words;
 *   · a library match ("sol price") attaches that feature;
 *   · anything else is a task, kept on the part for the code chat to build.
 *
 * It asks only when two readings are both fair: a page's name typed on a part
 * that already has other words (link there, or say it?), and a word that
 * fits more than one feature ("price"). Quoted, it is always the words.
 *
 * Pure: no store, no React, so the tests run it as written.
 */
import type { NodeLink } from "../parts/types.ts";
import { describeWork, inputsOf, matchWorks, type WorkManifest, type WorkUse } from "./works.ts";

export interface ReadContext {
  pages: { id: string; name: string; path?: string }[];
  works: WorkManifest[];
  /** Does the part draw words at all? An icon does not, so plain text on it is an instruction, not copy. */
  drawsWords: boolean;
  /** The words it draws now. */
  words: string;
}

export type Reading =
  | { kind: "link"; link: NodeLink; say: string }
  | { kind: "words"; text: string; say: string }
  | { kind: "work"; work: WorkUse; say: string }
  | { kind: "task"; text: string; say: string }
  | { kind: "ask"; question: string; options: Exclude<Reading, { kind: "ask" } | { kind: "nothing" }>[]; say: string }
  | { kind: "nothing"; say: string };

const QUOTED = /^\s*["“‘'](.*)["”’']\s*$/s;
const URLISH = /^(?:https?:\/\/|www\.)\S+$/i;
const DOMAIN = /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#]\S*)?$/i;
const EMAIL = /^(?:mailto:)?[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
/** Said as a place to go: "go to tokens", "link to the tokens page". */
const GO = /^(?:go(?:es)?\s+to|link(?:s)?\s+to|open(?:s)?|takes?\s+(?:you|me)\s+to|to)\s+(?:the\s+)?(.+?)(?:\s+page)?$/i;

/**
 * The first words of an instruction. Plain text that starts with one of these
 * is a task, not copy: "show the latest hashes", "connect the wallet".
 */
const DOING = new Set([
  "show", "shows", "display", "displays", "list", "lists", "fetch", "fetches", "load", "loads", "get", "gets", "pull", "pulls",
  "connect", "connects", "swap", "swaps", "buy", "sell", "send", "sends", "open", "opens", "close", "closes", "toggle", "toggles",
  "refresh", "refreshes", "reload", "update", "updates", "track", "tracks", "count", "counts", "sort", "sorts", "filter", "filters",
  "switch", "switches", "change", "changes", "copy", "copies", "share", "shares", "sign", "claim", "claims", "burn", "burns", "close",
  "make", "let", "lets", "when", "if", "on", "after", "should", "must", "needs", "need", "calculate", "calculates", "compute", "set",
  "save", "saves", "play", "plays", "pick", "choose", "select", "selects", "search", "searches", "download", "upload", "submit", "call",
]);
const CUES = /\b(should|when (?:clicked|pressed|tapped)|on (?:click|press|tap)|clicking|pressing|backend|wallet|api|live|latest|real[- ]time|every \d+|from the chain|on[- ]chain)\b/i;

const norm = (s: string) => s.toLowerCase().replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function pageNamed(text: string, pages: ReadContext["pages"]) {
  const want = norm(text);
  if (!want) return null;
  return pages.find((p) => norm(p.name) === want || (!!p.path && p.path !== "/" && norm(p.path) === want))
    ?? (want === "home" || want === "home page" ? pages[0] ?? null : null);
}

const clip = (s: string, n = 48) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function readWords(typed: string, ctx: ReadContext): Reading {
  const text = typed.trim();
  if (!text) return { kind: "nothing", say: "nothing typed" };

  const quoted = QUOTED.exec(text);
  if (quoted) {
    const t = quoted[1]!.trim();
    return { kind: "words", text: t, say: `the words “${clip(t)}”` };
  }

  if (URLISH.test(text) || (DOMAIN.test(text) && !/\s/.test(text))) {
    const target = /^https?:\/\//i.test(text) ? text : `https://${text.replace(/^\/+/, "")}`;
    return { kind: "link", link: { kind: "url", target }, say: `a link to ${clip(target.replace(/^https?:\/\//, ""))}` };
  }
  if (EMAIL.test(text)) {
    const target = text.startsWith("mailto:") ? text : `mailto:${text}`;
    return { kind: "link", link: { kind: "url", target }, say: `an email link to ${text.replace(/^mailto:/, "")}` };
  }

  const go = GO.exec(text);
  const goPage = go ? pageNamed(go[1]!, ctx.pages) : null;
  if (goPage) return { kind: "link", link: { kind: "page", target: goPage.id }, say: `a link to the ${goPage.name} page` };
  const page = pageNamed(text, ctx.pages);
  if (page) {
    const link: Reading = { kind: "link", link: { kind: "page", target: page.id }, say: `a link to the ${page.name} page` };
    const had = ctx.words.trim();
    if (ctx.drawsWords && had && norm(had) !== norm(text)) {
      return {
        kind: "ask",
        question: `“${text}” is a page. Link there, or make it the words?`,
        options: [link, { kind: "words", text, say: `the words “${clip(text)}”` }],
        say: "not sure yet",
      };
    }
    return link;
  }

  const matches = matchWorks(text, ctx.works);
  if (matches.length) {
    const best = matches[0]!;
    const tied = matches.filter((m) => m.score === best.score);
    const toReading = (m: (typeof matches)[number]): Reading & { kind: "work" } => {
      const work: WorkUse = { id: m.manifest.id, inputs: m.inputs };
      return { kind: "work", work, say: describeWork({ id: work.id, inputs: inputsOf(m.manifest, work.inputs) }) };
    };
    if (tied.length > 1 || best.score < 1) {
      return {
        kind: "ask",
        question: `Which one is “${clip(text, 24)}”?`,
        options: tied.length > 1 ? tied.map(toReading) : [toReading(best), { kind: "task", text, say: `a task: “${clip(text)}”` }],
        say: "not sure yet",
      };
    }
    return toReading(best);
  }

  const first = text.toLowerCase().split(/\s+/)[0] ?? "";
  if (DOING.has(first) || CUES.test(text) || !ctx.drawsWords) {
    return { kind: "task", text, say: `a task: “${clip(text)}”` };
  }
  return { kind: "words", text, say: `the words “${clip(text)}”` };
}
