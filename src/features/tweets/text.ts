/**
 * Counting and cutting tweets, the way X counts them.
 *
 * X weighs characters: most Latin, Cyrillic and similar text is one each;
 * anything outside a few ranges — CJK, emoji, most symbols — is two. Every
 * link, however long, becomes a t.co link and counts as 23. The limit is
 * 280 by default, 4,000 with Premium; the limit is a setting, the weighing
 * is not.
 *
 * Pure: no React, no store. The console, the scheduler and the route all use
 * it, so a draft is counted the same way everywhere.
 */

export const TCO_LENGTH = 23;

/** Ranges that weigh one; everything else weighs two. From X's text config v3. */
const LIGHT: [number, number][] = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];

/** Something X will turn into a link: http(s) URLs and bare domains with a real TLD. */
const URL_RE = /(?:https?:\/\/[^\s<>"']+)|(?:(?<![@\w.])[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|app|dev|xyz|ai|me|tv|gg|so|sh|ly|to|info|biz|edu|gov|uk|us|de|fr|es|it|nl|ca|au|jp|br|in)(?:\/[^\s<>"']*)?(?![\w.]))/gi;

export function findUrls(text: string): { start: number; end: number; url: string }[] {
  const out: { start: number; end: number; url: string }[] = [];
  for (const m of text.matchAll(URL_RE)) {
    if (m.index === undefined) continue;
    out.push({ start: m.index, end: m.index + m[0].length, url: m[0] });
  }
  return out;
}

export function firstUrl(text: string): string | null {
  const u = findUrls(text)[0];
  if (!u) return null;
  return /^https?:\/\//i.test(u.url) ? u.url : `https://${u.url}`;
}

/** The weighed length of a tweet. */
export function weighedLength(text: string): number {
  let n = 0;
  let i = 0;
  const urls = findUrls(text);
  let u = 0;
  while (i < text.length) {
    const link = urls[u];
    if (link && i === link.start) {
      n += TCO_LENGTH;
      i = link.end;
      u++;
      continue;
    }
    const cp = text.codePointAt(i) ?? 0;
    n += LIGHT.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2;
    i += cp > 0xffff ? 2 : 1;
  }
  return n;
}

/**
 * Cut a long text into a thread, each part inside the limit.
 *
 * Breaks at paragraphs first, then sentences, then words, and never inside a
 * link. Room is kept for the numbering when there is any.
 */
export function splitThread(text: string, limit: number, numbering: "none" | "slash" | "paren" = "none"): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [""];
  if (weighedLength(clean) <= limit) return [clean];
  const reserve = numbering === "none" ? 0 : 7; // " 12/34" or " (12/34)"
  const room = Math.max(40, limit - reserve);
  const parts: string[] = [];
  let rest = clean;
  while (rest.length) {
    if (weighedLength(rest) <= room) { parts.push(rest); break; }
    // walk forward to the furthest boundary that still fits
    let cut = -1;
    const tryBoundary = (re: RegExp) => {
      let best = -1;
      for (const m of rest.matchAll(re)) {
        const at = (m.index ?? 0) + m[0].length;
        if (weighedLength(rest.slice(0, at)) <= room) best = at; else break;
      }
      return best;
    };
    cut = tryBoundary(/\n\s*\n/g);
    if (cut < 0) cut = tryBoundary(/[.!?…]["')\]]?\s+/g);
    if (cut < 0) cut = tryBoundary(/\s+/g);
    if (cut <= 0) {
      // no boundary fits: cut by weight
      let at = 0;
      while (at < rest.length && weighedLength(rest.slice(0, at + 1)) <= room) at++;
      cut = Math.max(1, at);
    }
    // never cut inside a link
    const link = findUrls(rest).find((l) => l.start < cut && l.end > cut);
    if (link && link.start > 0) cut = link.start;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return parts.filter((p) => p.length);
}

/** Add " 1/3" or " (1/3)" to each part of a thread. */
export function numberThread(parts: string[], numbering: "none" | "slash" | "paren"): string[] {
  if (numbering === "none" || parts.length < 2) return parts;
  return parts.map((p, i) => `${p} ${numbering === "slash" ? `${i + 1}/${parts.length}` : `(${i + 1}/${parts.length})`}`);
}

/** The compose page on X with the text filled in. Media cannot ride along. */
export function intentUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

/** The id at the end of a post URL, for replies and quotes. */
export function tweetIdFromUrl(url: string): string | null {
  const m = url.trim().match(/(?:x|twitter)\.com\/[^/]+\/status(?:es)?\/(\d+)/i) ?? url.trim().match(/^(\d{8,})$/);
  return m?.[1] ?? null;
}

export type Token = { kind: "text" | "mention" | "hashtag" | "url"; value: string };

/** Split a tweet into the pieces X would colour. */
export function tokenise(text: string): Token[] {
  const out: Token[] = [];
  const re = /(@[A-Za-z0-9_]{1,15})|(#[\p{L}\p{N}_]+)|(https?:\/\/[^\s<>"']+)/gu;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", value: text.slice(last, at) });
    out.push({ kind: m[1] ? "mention" : m[2] ? "hashtag" : "url", value: m[0] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

/** "in 3 h", "in 2 d", "4 min ago" — how far a time is from now. */
export function relativeTime(at: number, now = Date.now()): string {
  const d = at - now;
  const abs = Math.abs(d);
  const unit = abs < 60_000 ? [Math.round(abs / 1000), "s"] : abs < 3_600_000 ? [Math.round(abs / 60_000), "min"] : abs < 86_400_000 ? [Math.round(abs / 3_600_000), "h"] : [Math.round(abs / 86_400_000), "d"];
  return d >= 0 ? `in ${unit[0]} ${unit[1]}` : `${unit[0]} ${unit[1]} ago`;
}

/** A local datetime-input value for a timestamp. */
export function toLocalInput(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
