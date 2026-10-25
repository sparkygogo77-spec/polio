/**
 * Counts what each lane spent, the same way for every way of paying, so
 * J's test (plan runs against paid runs) can be read side by side.
 *
 * - Tokens and seconds for every lane.
 * - A plan run: its share of J's plan window. Anthropic doesn't publish the
 *   window in tokens, so J sets `planWindowTokens` from what he sees; the
 *   share is that lane's tokens over it. It also keeps the dollars the run
 *   would cost at API prices, from Claude Code's own estimate.
 * - An API run: dollars, from the same estimate (`total_cost_usd`, which the
 *   docs say is an estimate, not the bill).
 * - A cloud session: its tokens can't be read (see agents-runner.md), so it
 *   is left out of the spend line until they can, rather than shown as 0.
 *
 * Caps: dollars per day for API runs, tokens per day for plan runs. Over
 * either, the runner pauses every lane (by "runner", reason "spend-cap").
 */
import { CONTRACT_VERSION, type LaneSpend, type Pays, type Spend, type Tokens } from "../contract.ts";

type Entry = { requestId: string; lane: string; pays: Pays; tokens: Tokens; usd: number; ms: number; since: number | null; known: boolean };

export type Caps = { usdPerDay?: number; planTokensPerDay?: number };

export class SpendBook {
  private lanes = new Map<string, Entry>();
  readonly opts: { planWindowTokens: number; caps?: Caps; now?: () => number };
  constructor(opts: SpendBook["opts"]) { this.opts = opts; }
  private now() { return (this.opts.now ?? Date.now)(); }

  open(requestId: string, lane: string, pays: Pays, known = true) {
    if (!this.lanes.has(lane)) this.lanes.set(lane, { requestId, lane, pays, tokens: { in: 0, out: 0 }, usd: 0, ms: 0, since: null, known });
  }
  /** The lane's clock runs only while its agent does (not while paused or queued). */
  running(lane: string, on: boolean) {
    const e = this.lanes.get(lane);
    if (!e) return;
    if (on && e.since === null) e.since = this.now();
    if (!on && e.since !== null) { e.ms += this.now() - e.since; e.since = null; }
  }
  add(lane: string, tokens: Tokens, usd: number | null) {
    const e = this.lanes.get(lane);
    if (!e) return;
    e.tokens = { in: e.tokens.in + tokens.in, out: e.tokens.out + tokens.out };
    if (usd) e.usd += usd;
  }

  laneSpend(e: Entry): LaneSpend {
    const seconds = Math.round((e.ms + (e.since === null ? 0 : this.now() - e.since)) / 1000);
    const total = e.tokens.in + e.tokens.out;
    const usd = Math.round(e.usd * 10000) / 10000;
    if (e.pays === "plan") {
      return { lane: e.lane, pays: e.pays, tokens: { ...e.tokens }, seconds,
        planShare: Math.min(1, total / Math.max(1, this.opts.planWindowTokens)), usd };
    }
    return { lane: e.lane, pays: e.pays, tokens: { ...e.tokens }, seconds, planShare: null, usd };
  }

  /** The contract's spend line for one request: its lanes, and their sum. */
  message(requestId: string): Spend {
    const lanes = [...this.lanes.values()].filter((e) => e.requestId === requestId && e.known).map((e) => this.laneSpend(e));
    const tokens = lanes.reduce((t, l) => ({ in: t.in + l.tokens.in, out: t.out + l.tokens.out }), { in: 0, out: 0 });
    return { v: CONTRACT_VERSION, kind: "spend", requestId, lanes, tokens };
  }

  /** Today's totals across every request, split by how they are paid. */
  totals() {
    let usd = 0, planTokens = 0;
    for (const e of this.lanes.values()) {
      if (e.pays === "plan") planTokens += e.tokens.in + e.tokens.out;
      else usd += e.usd;
    }
    return { usd, planTokens };
  }

  overCap(): string | null {
    const caps = this.opts.caps ?? {};
    const t = this.totals();
    if (caps.usdPerDay !== undefined && t.usd >= caps.usdPerDay) return `spend reached the cap of $${caps.usdPerDay} today`;
    if (caps.planTokensPerDay !== undefined && t.planTokens >= caps.planTokensPerDay) return `plan use reached the cap of ${caps.planTokensPerDay} tokens today`;
    return null;
  }
}
