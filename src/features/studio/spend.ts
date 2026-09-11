/**
 * What a call cost and how long it took, in one place.
 *
 * A drawing reaches two paid services on the way to being a part — Claude,
 * which charges per token, and Replicate, which charges per press — and
 * until now neither number was shown anywhere a person looks. The bench knew
 * what a drawing cost; the person paying for it did not. So both are counted
 * here, in the same shape, and every iteration carries the total.
 *
 * The prices are written down rather than guessed at call sites, because a
 * number that lives in four files is four numbers. `RENDER_PRICE` is
 * Replicate's, per press. `TOKEN_PRICE` is Anthropic's list price for the
 * Opus tier, per million tokens; a cache read is a tenth of an input token
 * and a cache write is a quarter more than one. If a rate changes, it
 * changes here and nowhere else.
 *
 * Wall time is measured, not estimated: `timed()` wraps the call, and what
 * it reports is the time the person actually waited, retries included.
 */
import { RENDER_COST, type RenderKind } from "./renderer.ts";

/** Replicate, per press. The renderer's own list, kept where it was. */
export const RENDER_PRICE = RENDER_COST;

/**
 * Anthropic's list price for the Opus tier, in dollars per million tokens.
 *
 * Change these here when the rate card changes. Nothing else prices a token.
 */
export const TOKEN_PRICE = {
  input: 15,
  output: 75,
  /** A cache read is a tenth of an input token. */
  cached: 1.5,
  /** A cache write is a quarter more than an input token. */
  written: 18.75,
} as const;

/** What one Claude call reports back about itself. */
export interface TokenUse {
  input?: number;
  output?: number;
  cached?: number;
  written?: number;
}

/**
 * Money and time and how many calls it took, for one call or for a whole run.
 *
 * Split by who was paid, because "did that drawing go anywhere near
 * Replicate" is a question about a drawing that nothing could answer — the
 * two roads through the drawing path look identical once the part is on the
 * board, and only the bill can tell them apart.
 */
export interface Spend {
  dollars: number;
  ms: number;
  calls: number;
  /** Of the dollars, what went to Claude, per token. */
  claude?: number;
  /** …and what went to the renderer, per press. */
  renderer?: number;
}

export const NOTHING: Spend = { dollars: 0, ms: 0, calls: 0 };

/** Two spends are one spend. Nothing here is averaged; it is all added. */
export function add(a: Spend | undefined, b: Spend | undefined): Spend {
  const claude = (a?.claude ?? 0) + (b?.claude ?? 0);
  const renderer = (a?.renderer ?? 0) + (b?.renderer ?? 0);
  return {
    dollars: (a?.dollars ?? 0) + (b?.dollars ?? 0),
    ms: (a?.ms ?? 0) + (b?.ms ?? 0),
    calls: (a?.calls ?? 0) + (b?.calls ?? 0),
    ...(claude ? { claude } : {}),
    ...(renderer ? { renderer } : {}),
  };
}

/** What one Claude call cost and how long it took. */
export function claudeSpend(u: TokenUse | undefined, ms: number): Spend {
  const dollars = priceTokens(u);
  return { dollars, ms, calls: 1, ...(dollars ? { claude: dollars } : {}) };
}

/** What one renderer press cost and how long it took. */
export function renderSpend(kind: RenderKind, ms: number, calls = 1): Spend {
  const dollars = priceRender(kind, calls);
  return { dollars, ms, calls, ...(dollars ? { renderer: dollars } : {}) };
}

/** What a Claude call cost, from the tokens it says it used. */
export function priceTokens(u: TokenUse | undefined): number {
  if (!u) return 0;
  const per = (n: number | undefined, rate: number) => ((n ?? 0) * rate) / 1_000_000;
  return per(u.input, TOKEN_PRICE.input)
    + per(u.output, TOKEN_PRICE.output)
    + per(u.cached, TOKEN_PRICE.cached)
    + per(u.written, TOKEN_PRICE.written);
}

/** What a renderer press cost. */
export function priceRender(kind: RenderKind, calls = 1): number {
  return RENDER_PRICE[kind] * calls;
}

/**
 * A price, at the size the price actually is.
 *
 * Two decimals turn a real four-tenths-of-a-cent call into "$0.00", which
 * reads as free and is not. Under a cent it is written to the digit that
 * makes it a number rather than a rounding.
 */
export function spent(dollars: number): string {
  if (!(dollars > 0)) return "free";
  if (dollars < 0.001) return "<$0.001";
  if (dollars < 0.01) return `$${dollars.toFixed(3)}`;
  return `$${dollars.toFixed(2)}`;
}

/** How long it took, at the size the wait actually was. */
export function took(ms: number): string {
  if (!(ms > 0)) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  return `${m}m ${Math.round((ms - m * 60_000) / 1000)}s`;
}

/**
 * The one line an iteration says about what it cost.
 *
 * "$0.12 · 8.4s · 3 calls". A run that spent nothing still took time and
 * says so, because free and instant are different claims.
 */
export function saySpend(s: Spend | undefined): string {
  if (!s || (!s.dollars && !s.ms && !s.calls)) return "";
  return [
    spent(s.dollars),
    took(s.ms),
    s.calls > 1 ? `${s.calls} calls` : s.calls === 1 ? "1 call" : "",
  ].filter(Boolean).join(" · ");
}

/**
 * Who was paid, when more than nothing was.
 *
 * "Claude $0.03, renderer $0.08" — which is the only place a person can find
 * out whether a drawing reached Replicate at all, because by the time the
 * part is on the board the two roads look the same.
 */
export function sayWhere(s: Spend | undefined): string {
  if (!s) return "";
  return [
    s.claude ? `Claude ${spent(s.claude)}` : "",
    s.renderer ? `renderer ${spent(s.renderer)}` : "",
  ].filter(Boolean).join(", ");
}

/** The whole line an iteration carries: what it cost, how long, and to whom. */
export function sayBill(s: Spend | undefined): string {
  const head = saySpend(s);
  const who = sayWhere(s);
  if (!head) return "";
  return who ? `${head} · ${who}` : `${head} · nothing was paid for`;
}

/** Run it and say how long the wait was. The value comes back untouched. */
export async function timed<T>(run: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const from = Date.now();
  try {
    return { value: await run(), ms: Date.now() - from };
  } catch (err) {
    // A call that failed still took the time it took; the caller may want it.
    (err as { ms?: number }).ms = Date.now() - from;
    throw err;
  }
}
