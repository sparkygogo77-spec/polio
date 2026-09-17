/**
 * THE ONE RULE ABOUT WORDS, IN ONE PLACE.
 *
 * The website in its entirety never mentions him, me, the chats, the models,
 * or how the work is made. Only the changes to the website itself.
 *
 * It is absolute, so it lives as something a check can run rather than
 * something a person has to remember. Two readers use it:
 *
 * - `npm run passes`, which writes what has landed out of the history. A
 *   commit subject that is about the making — a merge, a running note, a
 *   regenerated record — is not a change to the website and never reaches
 *   the panel. What it drops is counted, never swallowed.
 * - `tests/nothing-said.mjs`, which reads the panel's own lines and the
 *   published page's own text back and fails on any of it.
 *
 * The families are deliberately narrow. A word is here because it can only
 * be the making talking, never the site: "merge" is always a merge, but
 * "brief" is the Builder's own noun and "AI" is a shelf of parts a person
 * can place. The one thing that names a service out loud is the key panel,
 * because a person cannot be asked for a key without being told what it
 * unlocks, and that is the tool working rather than the website talking.
 */

/** One family of words, and the name a person would give it. */
export interface NotOurs {
  /** What it is — the words the rule itself uses. */
  of: string;
  saw: RegExp;
  /**
   * Whether it is wrong anywhere on the website, or only on the record.
   *
   * Four of the five can only ever be the making talking. The fifth cannot:
   * "merge" is a git merge in a line about a run of work and the Builder's
   * own verb for two layers on the Layers panel, and "branch" and "deploy"
   * are the same kind of word. So the making's vocabulary is the full rule
   * on the record, where every one of them is unambiguous, and only its
   * unambiguous half is held against the rest of the website.
   */
  everywhere: boolean;
}

export const NOT_OURS: NotOurs[] = [
  { of: "him", saw: /\b(he|him|his|himself|she|her|hers)\b/i, everywhere: true },
  { of: "me", saw: /(\bI\b|\b(me|my|mine|myself|we|us|our|ours)\b)/, everywhere: true },
  { of: "the chats", saw: /\b(chat|chats|chatted|conversation|transcript|instruction|ruling|handover)\b/i, everywhere: true },
  { of: "the models", saw: /\b(claude|anthropic|openai|chatgpt|gpt-\d|llm|language model)\b/i, everywhere: true },
  {
    of: "how it was made",
    saw: /\b(commit|commits|committed|sha|rebase|repo|repository|git|pull request|changelog|typecheck)\b/i,
    everywhere: true,
  },
  {
    of: "how the work is made",
    saw: /\b(merge|merged|merges|branch|branches|passes record|regenerate the passes|lint|refactor|the deploy|deployed|container|running note|inventory pass)\b/i,
    everywhere: false,
  },
];

/**
 * Which family a line breaks, or null when it is only about the website.
 *
 * Returns the name rather than a boolean so a check can say what it caught
 * instead of only that it caught something. This is the full rule, for the
 * record of what changed; `saidAnywhere` is the half of it that is held
 * against every other word on the website.
 */
export function saidPlainly(line: string): string | null {
  for (const f of NOT_OURS) if (f.saw.test(line)) return f.of;
  return null;
}

/** The same, for words anywhere on the website that are not the record. */
export function saidAnywhere(line: string): string | null {
  for (const f of NOT_OURS) if (f.everywhere && f.saw.test(line)) return f.of;
  return null;
}

/** True when a line says nothing but what changed about the website. */
export function aboutTheSite(line: string): boolean {
  return saidPlainly(line) === null;
}
