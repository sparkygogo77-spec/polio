/**
 * Where a display line turns: nowhere, at its last word, or at its last
 * sentence. Pure, so the hero, the value line and the call to action share
 * one rule and a test can hold it.
 *
 * The last word used to be whatever followed the last space, and the last
 * sentence whatever followed the last full stop: a line in Chinese, Japanese
 * or Thai has no spaces, so the whole line was the accent, and a sentence
 * that ended in "!" or "?" or "。" had no end. The language's own breaks are
 * used where the runtime has them (`Intl.Segmenter`), the old rule where not.
 */

const SENTENCE_END = /[.!?。！？]/g;

/** The last word's start, by the language's own word breaks, or the last space. */
function lastWordAt(line: string): number {
  const Seg = (globalThis as { Intl?: { Segmenter?: new (locale?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ index: number; segment: string; isWordLike?: boolean }> } } }).Intl?.Segmenter;
  if (Seg) {
    let at = -1;
    for (const s of new Seg(undefined, { granularity: "word" }).segment(line)) if (s.isWordLike) at = s.index;
    if (at > 0) return at;
    if (at === 0) return -1;
  }
  const sp = line.lastIndexOf(" ");
  return sp < 0 ? -1 : sp + 1;
}

/** Where the line turns: nowhere, at the last word, or at the last sentence. */
export function splitTurn(line: string, turn: string): { head: string; tail: string | null } {
  if (turn === "none" || !line.trim()) return { head: line, tail: null };
  const trimmed = line.trimEnd();
  if (turn.startsWith("last word")) {
    const at = lastWordAt(trimmed);
    return at <= 0 ? { head: "", tail: line } : { head: line.slice(0, at), tail: line.slice(at) };
  }
  // The last sentence: everything after the sentence end before it.
  const body = trimmed.replace(/[.!?。！？]+\s*$/, "");
  let at = -1;
  for (const m of body.matchAll(SENTENCE_END)) at = m.index + m[0].length;
  if (at < 0) return { head: "", tail: line };
  const rest = line.slice(at);
  const lead = rest.length - rest.trimStart().length;
  return { head: line.slice(0, at + lead), tail: rest.slice(lead) };
}
