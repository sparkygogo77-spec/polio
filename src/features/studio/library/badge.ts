/**
 * Where the orange ! goes: the parts that still need a decision.
 *
 * Two kinds, and only these:
 *   · a clickable part with nowhere to go — a button, a link's icon, a chip —
 *     that has no link, no feature and no task written for it (`task`, not
 *     `data`: a capture writes its own description into `data`);
 *   · a live-data spot — a price, a change, a balance, a count, a time ago,
 *     a shortened address — that shows a number the capture froze, with no
 *     feature and no task on it, and whose words the owner did not type
 *     in the one box (`settled`, set by the one box when it reads words).
 *
 * One control, one !: the parts inside a clickable part defer to it (the
 * wallet chip carries it, not the hash and the "13s ago" inside), and a part
 * inside a control that already goes somewhere has nothing to decide (the
 * sidebar's icons). A capture says what held what in `from.selector`; a part
 * placed by hand is clickable when it is a button-like part.
 *
 * Builder only. The ! is drawn by the board over the part, never by the part,
 * so nothing of it can reach a published page.
 *
 * Pure: the tests run it against sink's own document.
 */

interface Part {
  id: string;
  pageId?: string;
  featureId?: string;
  content?: unknown;
  link?: unknown;
  task?: string | null;
  /** The owner typed this part's words in the one box: a live-data spot showing them is decided. */
  settled?: boolean;
  /** The owner said it goes nowhere on purpose. */
  nowhere?: boolean;
  work?: { id: string } | null;
  from?: { selector?: string | null } | null;
}

export interface Decision {
  id: string;
  /** `nowhere`: pressable and goes nowhere. `live`: shows a number that should be live. */
  why: "nowhere" | "live";
}

/** Parts that are a press by nature, when placed by hand. */
const BUTTONISH = new Set(["cta-primary", "quick-action", "follow", "magnetic-buttons"]);
/** Parts that draw no words of their own. */
const WORDLESS = new Set(["drawn-icon", "picture"]);

const LIVE = [
  /^[+\-−]?\s?\$\s?\d[\d,]*(?:\.\d+)?\s?[KMB]?$/i, // $116.59, -$3.2K
  /^[+\-−]?\d[\d,]*(?:\.\d+)?\s?%$/, // -1.94%
  /^[+\-−]?\d[\d,]*(?:\.\d+)?\s?(?:SOL|USDC?|lamports|tokens?|total|NFTs?|holders?|txs?)$/i, // +0.0000 SOL, 0 tokens
  /^\d+\s?(?:s|m|h|d|sec|secs|min|mins|hr|hrs|days?)\s+ago$/i, // 13s ago
  /^[1-9A-HJ-NP-Za-km-z]{3,6}(?:\.\.\.|…)[1-9A-HJ-NP-Za-km-z]{3,6}$/, // 3G8S...EGjn
];

function wordsOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((s) => (s && typeof s === "object" && "text" in s ? String((s as { text: unknown }).text) : "")).join("");
  return "";
}

const segs = (sel: string) => sel.split(/\s*>\s*/).filter(Boolean);
const tag = (seg: string) => /^[a-z][a-z0-9-]*/i.exec(seg)?.[0]?.toLowerCase() ?? "";

/** The selector of the nearest `a` or `button` at or above this part, if the capture recorded one. */
function controlOf(sel: string): string | null {
  const s = segs(sel);
  for (let i = s.length - 1; i >= 0; i--) {
    const t = tag(s[i]!);
    if (t === "a" || t === "button") return s.slice(0, i + 1).join(" > ");
  }
  return null;
}

export function answered(n: Part): boolean {
  return !!n.link || !!n.work || !!(n.task && n.task.trim()) || n.nowhere === true;
}

export function isLiveWords(words: string): boolean {
  const w = words.trim();
  return !!w && LIVE.some((re) => re.test(w));
}

/** Every part on these pages that still needs a decision, in document order. */
export function decisions(nodes: readonly Part[]): Decision[] {
  const bySel = new Map<string, Part>();
  for (const n of nodes) {
    const sel = n.from?.selector;
    if (sel) bySel.set(`${n.pageId ?? ""}|${segs(sel).join(" > ")}`, n);
  }
  const out: Decision[] = [];
  for (const n of nodes) {
    const sel = n.from?.selector ? segs(n.from.selector).join(" > ") : null;
    const control = sel ? controlOf(sel) : null;
    /* Inside a control that is its own part: that part decides for both. */
    if (sel && control && control !== sel && bySel.has(`${n.pageId ?? ""}|${control}`)) continue;
    if (answered(n)) continue;
    const pressable = control !== null || BUTTONISH.has(n.featureId ?? "");
    if (pressable) { out.push({ id: n.id, why: "nowhere" }); continue; }
    /* Words the owner typed are words they chose: a number written by hand is not waiting to be made live. */
    if (n.settled) continue;
    if (!WORDLESS.has(n.featureId ?? "") && isLiveWords(wordsOf(n.content))) out.push({ id: n.id, why: "live" });
  }
  return out;
}

/**
 * What the decision is, in the words the side panel lists it with: the kind
 * of thing, what is missing, and what to do about it. `kind` is the part's
 * kind in a word ("Button", "Link"), from `partNames.kindOf`.
 */
export function decisionSays(why: Decision["why"], kind: string): string {
  const k = kind.toLowerCase();
  const thing = k === "link" ? "a link" : k === "button" ? "a button" : k === "picture" ? "a pressable picture" : "a pressable part";
  return why === "live"
    ? "a number frozen when the site was captured: say where the live value comes from"
    : `${thing} that goes nowhere yet: choose where it leads`;
}
