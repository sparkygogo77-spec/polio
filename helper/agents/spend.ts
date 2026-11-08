/**
 * Counts what each lane used of J's plan, in tokens. There are no dollars
 * anywhere (J, 2026-10-25: "no api, only plan usage and tokens").
 *
 * - A PC lane: tokens from its stream, and seconds while its agent runs.
 * - A cloud lane: its tokens can't be read, so they are null ("on your
 *   plan, not measured"), never 0.
 * - The plan-limit reading: the latest `rate_limit_event` Claude Code sent
 *   (how much of J's limit is used, for the whole account), or null.
 *
 * Caps are in tokens: per day (local day, every request) and per request.
 * Over either, or when Claude Code says the plan limit is reached, the
 * runner pauses the lanes it covers (by "runner", reason "spend-cap").
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CONTRACT_VERSION, type LaneSpend, type Pays, type PlanUse, type Spend, type Tokens } from "../contract.ts";

type Entry = { requestId: string; lane: string; pays: Pays; tokens: Tokens; ms: number; since: number | null; measured: boolean };

export type Caps = { tokensPerDay?: number; tokensPerRequest?: number };

/**
 * An installed helper is never uncapped (audit helper-install.md, risk 3).
 * 2,000,000 counted tokens a day is about 80 small lanes at the 25,000 a tiny
 * lane used on 2026-10-29, and well under one 5-hour window of the plan. The
 * installer writes it to helper.json, the tray passes it as
 * --tokens-per-day, and the dock shows and changes it (GET/POST /caps). A
 * change from the dock is kept in <state>/caps.json and wins at the next start.
 */
export const DEFAULT_TOKENS_PER_DAY = 2_000_000;
export const MIN_CAP = 10_000;
export const MAX_CAP = 1_000_000_000;

/** A cap as J may set it: a whole number of tokens from 10,000 to 1,000,000,000. */
export function goodCap(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= MIN_CAP && n <= MAX_CAP;
}

/** The caps kept by the dock's last change, or {} when there are none (or the file is bad). */
export function readCapsFile(file: string): Caps {
  try {
    const x = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    const out: Caps = {};
    if (goodCap(x.tokensPerDay)) out.tokensPerDay = x.tokensPerDay;
    if (goodCap(x.tokensPerRequest)) out.tokensPerRequest = x.tokensPerRequest;
    return out;
  } catch { return {}; }
}

export function writeCapsFile(file: string, caps: Caps) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ ...caps, at: new Date().toISOString() }, null, 2));
}

export type Over = { scope: "day" | "request" | "plan"; requestId?: string; why: string };

const sum = (t: Tokens) => t.in + t.out;
const dayOf = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

export class SpendBook {
  private lanes = new Map<string, Entry>();
  private days = new Map<string, number>();
  plan: PlanUse | null = null;
  readonly opts: { caps?: Caps; now?: () => number };
  constructor(opts: SpendBook["opts"] = {}) { this.opts = opts; }
  private now() { return (this.opts.now ?? Date.now)(); }

  open(requestId: string, lane: string, pays: Pays, measured = true) {
    if (!this.lanes.has(lane)) this.lanes.set(lane, { requestId, lane, pays, tokens: { in: 0, out: 0, cached: 0 }, ms: 0, since: null, measured });
  }
  /** The lane's clock runs only while its agent does (not while paused or queued). */
  running(lane: string, on: boolean) {
    const e = this.lanes.get(lane);
    if (!e) return;
    if (on && e.since === null) e.since = this.now();
    if (!on && e.since !== null) { e.ms += this.now() - e.since; e.since = null; }
  }
  add(lane: string, tokens: Tokens) {
    const e = this.lanes.get(lane);
    if (!e || !e.measured) return;
    // Cache reads are kept for the dock but never count toward a cap (contract.ts, Tokens).
    e.tokens = { in: e.tokens.in + tokens.in, out: e.tokens.out + tokens.out, cached: (e.tokens.cached ?? 0) + (tokens.cached ?? 0) };
    const day = dayOf(this.now());
    this.days.set(day, (this.days.get(day) ?? 0) + sum(tokens));
  }
  /** Claude Code's latest plan-limit reading. */
  setPlan(p: PlanUse) { this.plan = p; }

  private laneSpend(e: Entry): LaneSpend {
    const seconds = Math.round((e.ms + (e.since === null ? 0 : this.now() - e.since)) / 1000);
    return { lane: e.lane, pays: e.pays, tokens: e.measured ? { ...e.tokens } : null, seconds };
  }

  /** The contract's spend line for one request: its lanes, their sum, the plan reading. */
  message(requestId: string): Spend {
    const lanes = [...this.lanes.values()].filter((e) => e.requestId === requestId).map((e) => this.laneSpend(e));
    const tokens = lanes.reduce((t, l) => (l.tokens ? { in: t.in + l.tokens.in, out: t.out + l.tokens.out, cached: t.cached + (l.tokens.cached ?? 0) } : t), { in: 0, out: 0, cached: 0 });
    return { v: CONTRACT_VERSION, kind: "spend", requestId, lanes, tokens, plan: this.plan ? { ...this.plan } : null };
  }

  today() { return this.days.get(dayOf(this.now())) ?? 0; }
  requestTokens(requestId: string) { return sum(this.message(requestId).tokens); }

  /** What is over its cap now, the widest first. */
  over(): Over[] {
    const caps = this.opts.caps ?? {};
    const out: Over[] = [];
    if (this.plan?.status === "rejected") out.push({ scope: "plan", why: "your plan's limit is reached" });
    if (caps.tokensPerDay !== undefined && this.today() >= caps.tokensPerDay) out.push({ scope: "day", why: `today's tokens reached the cap of ${caps.tokensPerDay}` });
    if (caps.tokensPerRequest !== undefined) {
      for (const id of new Set([...this.lanes.values()].map((e) => e.requestId))) {
        if (this.requestTokens(id) >= caps.tokensPerRequest) out.push({ scope: "request", requestId: id, why: `this request reached the cap of ${caps.tokensPerRequest} tokens` });
      }
    }
    return out;
  }
}
