/**
 * The copy a prompt names outright, and whether the page shows it.
 *
 * HIS FAULT, MEASURED. The published home page carried a part's plain text
 * and nothing else. The prompt on that part asked for an eyebrow reading
 * "BUILT FOR THE NEXT BLOCK", a CONNECT WALLET pill and a meta row reading
 * CHAIN 4663 / COMMUNITY OWNED / ZERO TAX. None of it reached the page, and
 * nothing anywhere said a word about that: the brief promised, the board
 * dropped it, and the site went out quietly short.
 *
 * A prompt is mostly description — how a thing should look, feel, behave —
 * and none of that is text anybody reads. But a prompt that puts words in
 * quotes, or writes them in capitals, is naming copy: those exact words are
 * meant to be on the page. That is the only part of a prompt this reads, so
 * a prompt about nothing but style is never accused of going missing.
 */

/** Words a prompt names outright: anything quoted, and any run of capitals. */
export function namedCopy(prompt: string): string[] {
  const out: string[] = [];
  for (const m of prompt.matchAll(/["“”'‘’]([^"“”'‘’\n]{2,60})["“”'‘’]/g)) out.push(m[1] ?? "");
  for (const m of prompt.matchAll(/\b[A-Z][A-Z0-9]{1,}(?:[ \t]+[A-Z0-9]{2,}){0,6}\b/g)) out.push(m[0] ?? "");
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of out) {
    const s = raw.trim().replace(/\s+/g, " ");
    // Two characters is an initial or a unit, not copy anyone would miss.
    if (s.length < 3) continue;
    const key = fold(s);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(s);
  }
  return kept;
}

/** Case, punctuation and spacing all forgiven: only the words have to match. */
export function fold(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Which of the words a prompt names are nowhere in what the part shows.
 *
 * `shown` is whatever the part actually put on the page — its rendered text
 * on a published page, its contents and options where only the document is
 * to hand. Empty means the prompt was carried out, or named no copy at all.
 */
export function missingCopy(prompt: string, shown: string): string[] {
  const named = namedCopy(prompt);
  if (!named.length) return [];
  const have = fold(shown);
  return named.filter((c) => !have.includes(fold(c)));
}
