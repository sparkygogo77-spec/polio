/**
 * A COPY BUTTON COPIES, BY COMMON SENSE.
 *
 * J (2026-10-11, sunkcoin.fun's holders table): "copy button should also be
 * common sense". Every row's COPY carried the orange ! because nothing said
 * what it does, yet anybody looking at it knows: it copies the text beside
 * it, the wallet address or the CA. So a pressable part whose words say
 * Copy, with nothing decided for it yet (`badge.ts#answered`: no link, no
 * feature, no task, not the repo's own button code), is given the library's
 * Copy feature (`copy-toast`), set to copy what it sits beside:
 *
 *   · the page's own value for it, when the part carries one (`data-copy`,
 *     `data-clipboard-text`, `data-address` in the attributes it came with);
 *   · else the words of the nearest part on its row (or just above it), and
 *     when those are an address shortened for show (3wh3…weoq), the whole
 *     address that part's link carries (a Solscan or pump.fun link has it);
 *   · else nothing here, and the feature finds its neighbour on the page as
 *     it is drawn (`motion.ts#COPY`), the same way, by where things sit.
 *
 * It is the feature, not a special case: the Element panel shows it with
 * what it copies, the owner edits it or takes it off, and the Preview and
 * the published page run it like any other. A part the capture saw copying
 * already has it (`captured.ts`, sink `behaviours.presses`) and is left be.
 *
 * Pure: no store, no React.
 */
import { answered, controlOf, segs } from "./badge.ts";
import { withWork, type WorkUse } from "./works.ts";

interface Part {
  id: string;
  pageId?: string;
  featureId?: string;
  content?: unknown;
  link?: { kind?: string; target?: string } | null;
  task?: string | null;
  nowhere?: boolean;
  work?: WorkUse | null;
  x?: number; y?: number; w?: number; h?: number;
  state?: unknown;
  hooks?: Record<string, string> | null;
  from?: { selector?: string | null } | null;
  source?: { code?: { refs?: readonly { kind?: string }[] | null; built?: unknown } | null } | null;
}

/** "COPY", "Copy CA", "copy address", a ⧉: words that say the part copies. */
const SAYS_COPY = /^(?:copy(?:\s+(?:the\s+)?(?:ca|address|contract(?:\s+address)?|link|code|text|wallet(?:\s+address)?|mint|token(?:\s+address)?|url))?|⧉|📋)$/i;
/** A whole Solana address (base58, 32 to 44 letters) anywhere in a string: a link to Solscan, pump.fun or a wallet page carries one. */
const WHOLE = /(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{32,44}(?![1-9A-HJ-NP-Za-km-z])/;
/** An address cut down for show: "3wh3…weoq", "7xKX...gAsU". */
const SHORTENED = /^\s*([1-9A-HJ-NP-Za-km-z]{2,8})(?:…|\.\.\.)([1-9A-HJ-NP-Za-km-z]{2,8})\s*$/;
/** The attributes a page keeps the copied value in. */
const VALUE_ATTRS = ["data-copy", "data-clipboard-text", "data-clipboard", "data-address", "data-ca", "data-value"];
/** How far, in px, a neighbour may sit from the button and still be what it copies. */
const REACH = 240;

export function wordsOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((s) => (s && typeof s === "object" && "text" in s ? String((s as { text: unknown }).text) : "")).join("");
  return "";
}

export function saysCopy(words: string): boolean {
  return SAYS_COPY.test(words.replace(/\s+/g, " ").trim().replace(/[:!.]+$/, ""));
}

/** The links a part carries: its own, and the ones on its words. */
function linksOf(n: Part): string[] {
  const out: string[] = [];
  if (n.link?.target) out.push(n.link.target);
  if (Array.isArray(n.content)) for (const s of n.content) {
    const l = s && typeof s === "object" ? (s as { link?: { target?: unknown } }).link : null;
    if (l && typeof l.target === "string") out.push(l.target);
  }
  return out;
}

/**
 * The whole address behind shortened words: the one that starts and ends as
 * they do, on the part's own links first, then anywhere on its page (a
 * pump.fun or Solscan link elsewhere, the address written out in full).
 */
function wholeBehind(words: string, n: Part, nodes: readonly Part[]): string | null {
  const m = SHORTENED.exec(words);
  if (!m) return null;
  const fits = (s: string) => (s.match(new RegExp(WHOLE.source, "g")) ?? []).find((hit) => hit.startsWith(m[1]!) && hit.endsWith(m[2]!)) ?? null;
  for (const href of linksOf(n)) { const hit = fits(href); if (hit) return hit; }
  for (const o of nodes) {
    if (o.pageId !== n.pageId) continue;
    for (const s of [...linksOf(o), wordsOf(o.content)]) { const hit = fits(s); if (hit) return hit; }
  }
  return null;
}
/** Words worth copying: anything but an address cut down for show with no whole one behind it, which would paste as nonsense. */
const worth = (words: string, n: Part, nodes: readonly Part[]): string => wholeBehind(words, n, nodes) ?? (SHORTENED.test(words) ? "" : words);

/** What the button copies, worked out from the board: the value it carries, or its neighbour's words (whole). Empty when the board does not say. */
export function copiedBy(btn: Part, nodes: readonly Part[]): string {
  for (const a of VALUE_ATTRS) {
    const v = btn.hooks?.[a]?.trim();
    if (v) return v;
  }
  if (btn.x === undefined || btn.y === undefined) return "";
  const bx = btn.x, by = btn.y, bw = btn.w ?? 0, bh = btn.h ?? 0;
  let best: { words: string; n: Part; score: number } | null = null;
  for (const n of nodes) {
    if (n.id === btn.id || n.pageId !== btn.pageId || n.state || n.x === undefined || n.y === undefined) continue;
    const words = wordsOf(n.content).replace(/\s+/g, " ").trim();
    if (!words || words.length > 200 || saysCopy(words)) continue;
    const x = n.x, y = n.y, w = n.w ?? 0, h = n.h ?? 0;
    /* A box round the button (its row, its card) is not its neighbour. */
    if (x <= bx && y <= by && x + w >= bx + bw && y + h >= by + bh) continue;
    const across = Math.max(0, x - (bx + bw), bx - (x + w));
    const down = Math.max(0, y - (by + bh), by - (y + h));
    const onRow = Math.min(by + bh, y + h) - Math.max(by, y) > 0;
    const above = !onRow && y + h <= by && down <= 40 && across === 0;
    if ((!onRow && !above) || across > REACH) continue;
    /* Beside it on its row first, the one to its left before the one to its right; the line above only after. */
    const score = across + (onRow ? 0 : 1000) + (onRow && x > bx ? 50 : 0);
    if (!best || score < best.score) best = { words, n, score };
  }
  return best ? worth(best.words, best.n, nodes) : "";
}

const selOf = (n: Part) => (n.from?.selector ? segs(n.from.selector).join(" > ") : null);
/** The parts inside this one, by the element paths the capture recorded. */
const within = (n: Part, nodes: readonly Part[]): Part[] => {
  const sel = selOf(n);
  return sel ? nodes.filter((o) => o.id !== n.id && o.pageId === n.pageId && (selOf(o) ?? "").startsWith(`${sel} > `)) : [];
};
const addressy = (w: string) => WHOLE.test(w) || SHORTENED.test(w);

/**
 * The copy buttons on these pages that nothing has been decided for. A
 * button that is its own part and holds the word (sunkcoin.fun's header:
 * a `button` round "CA", the address and "COPY") is the copy button, and
 * the word inside defers to it, as it does for the orange ! (`badge.ts`).
 */
export function undecidedCopies(nodes: readonly Part[]): Part[] {
  const bySel = new Map<string, Part>();
  for (const n of nodes) { const sel = selOf(n); if (sel) bySel.set(`${n.pageId ?? ""}|${sel}`, n); }
  const out = new Map<string, Part>();
  for (const n of nodes) {
    if (n.state || !saysCopy(wordsOf(n.content))) continue;
    const sel = selOf(n), control = sel ? controlOf(sel) : null;
    const owner = sel && control && control !== sel ? bySel.get(`${n.pageId ?? ""}|${control}`) : undefined;
    const btn = owner ?? n;
    if (!answered(btn)) out.set(btn.id, btn);
  }
  return [...out.values()];
}

/** What a button holding the word copies: the address among the words inside it, else what sits beside it. */
function copiedFor(btn: Part, nodes: readonly Part[]): string {
  if (!saysCopy(wordsOf(btn.content))) {
    const inner = within(btn, nodes).find((o) => addressy(wordsOf(o.content).trim()));
    if (inner) return worth(wordsOf(inner.content).trim(), inner, nodes);
    const own = wordsOf(btn.content).match(new RegExp(WHOLE.source));
    if (own) return own[0];
  }
  return copiedBy(btn, nodes);
}

/** Every undecided copy button given the Copy feature, set to what it copies. Nothing to do, the same array back. */
export function giveCopies<N extends Part>(nodes: readonly N[]): readonly N[] {
  const todo = new Set(undecidedCopies(nodes).map((n) => n.id));
  if (!todo.size) return nodes;
  return nodes.map((n) => {
    if (!todo.has(n.id)) return n;
    const text = copiedFor(n, nodes);
    return { ...n, work: withWork(n.work, { id: "copy-toast", inputs: text ? { text } : {} }) };
  });
}
