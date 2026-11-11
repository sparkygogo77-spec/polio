"use client";
/**
 * WHAT THE BUILDER KNOWS FROM THE HELPER, WITH THE DOCK OPEN OR SHUT
 * (Orbs 2, pieces A and B).
 *
 *   · the helper's state: paired and answering, answering but not paired,
 *     or not answering (stopped, or the PC asleep), with when it was last
 *     heard from. Asked every 3 s, so a stop shows within a few seconds
 *     without a reload. It never uses the `polio-helper://` link.
 *   · the lanes feed (the chats and the questions), read every 5 s while the
 *     board shows and every 15 s otherwise, so the Agents button can count
 *     the questions waiting on J with the dock shut.
 *
 * With the dock shut, nothing is asked of 127.0.0.1 until this browser has
 * once reached the helper (`polio.helper.seen`): a Builder that never set the
 * helper up never trips Chrome's local-network prompt on load.
 */
import { create } from "zustand";
import { DOCK_URL, HELPER_ORIGIN } from "./context";
import { PRIVATE_KEY, readPrivate } from "./privacy";
import { HELPER_POLL_MS, POLL_MS, helperStateOf, readFeed, withBeats, type HelperState, type LaneBeat, type LanesFeed } from "./lanes";
import { readCost, type PcCost } from "./manager";

const WAIT_MS = 2500;
const SEEN_KEY = "polio.helper.seen";
const HEARD_KEY = "polio.helper.heard";
const KEEP_KEY = "polio.lanes.last";
const SLOW_MS = 15_000;

export interface HelperNow { state: HelperState; paired: boolean | null; lastHeard: number | null; askedAt: number }
export type Feed = { feed: LanesFeed | null; reached: boolean; base: string; readAt: number };
/** What each chat costs the PC (the manager's piece E). `asked`: the helper was asked; `pc` null then means it is off, or older than this Builder. */
export interface Cost { pc: PcCost | null; asked: boolean }
interface Live { helper: HelperNow; lanes: Feed; cost: Cost }

const store = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window: this page still has it */ } };

export const useLive = create<Live>(() => ({
  helper: { state: "checking", paired: null, lastHeard: null, askedAt: 0 },
  lanes: { feed: null, reached: false, base: "/api/lanes/file", readAt: 0 },
  cost: { pc: null, asked: false },
}));

async function get(url: string, init: RequestInit = {}): Promise<Response | null> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), WAIT_MS);
  try { return await fetch(url, { cache: "no-store", signal: stop.signal, ...init }); } catch { return null; } finally { clearTimeout(timer); }
}

/** One read of the helper. `/health` answers the live Builder with whether a dock is paired; any other Builder gets a refusal, which still says something listens. */
export async function readHelper(): Promise<HelperNow> {
  const r = await get(`${HELPER_ORIGIN}/health`);
  let health: { paired?: unknown } | null = null;
  if (r?.ok) health = (await r.json().catch(() => null)) as { paired?: unknown } | null;
  const answered = !!r || !!(await get(DOCK_URL, { mode: "no-cors" }));
  const state = helperStateOf({ health, answered });
  const now = Date.now();
  const lastHeard = state === "off" ? Number(store(HEARD_KEY)) || useLive.getState().helper.lastHeard : now;
  if (state !== "off") { put(HEARD_KEY, String(now)); put(SEEN_KEY, "1"); }
  const helper: HelperNow = { state, paired: health ? health.paired === true : null, lastHeard: lastHeard || null, askedAt: now };
  useLive.setState({ helper });
  return helper;
}

type Kept = { raw: { feed: unknown; beats?: LaneBeat[]; now?: number }; base: string; readAt: number };
let kept: Kept | null = null;
function keep(k: Kept) { kept = k; put(KEEP_KEY, JSON.stringify(k)); }
function keptRead(): Kept | null {
  if (kept) return kept;
  try { const k = JSON.parse(store(KEEP_KEY) ?? "null") as Kept | null; if (k && readFeed(k.raw?.feed)) kept = k; } catch { /* nothing kept */ }
  return kept;
}
const feedOf = (k: Kept): Feed => ({ feed: withBeats(readFeed(k.raw.feed)!, k.raw.beats ?? [], k.raw.now ?? k.readAt), reached: true, base: k.base, readAt: k.readAt });

async function json(url: string): Promise<{ feed: unknown; beats?: LaneBeat[]; now?: number } | null> {
  const r = await get(url);
  return r?.ok ? ((await r.json().catch(() => null)) as { feed: unknown } | null) : null;
}
let viaHelper = false;
/** One read of the feed: the Builder's own route on this PC, else the helper. A failed read keeps the last good feed. */
export async function readLanes(): Promise<void> {
  let got = viaHelper ? null : await json("/api/lanes");
  if (!got?.feed) { const h = await json(`${HELPER_ORIGIN}/lanes`); if (h) { got = h; viaHelper = true; } }
  if (got && readFeed(got.feed)) {
    const k: Kept = { raw: got, base: viaHelper ? `${HELPER_ORIGIN}/lanes/file` : "/api/lanes/file", readAt: Date.now() };
    keep(k);
    useLive.setState({ lanes: feedOf(k) });
  } else useLive.setState((s) => (s.lanes.feed ? s : { lanes: { ...s.lanes, feed: null, reached: !!got } }));
}

/* Who wants it, and how fast: the board asks for the feed every 5 s; the button and the dock's top line are content with the slow pace. */
let boards = 0, docks = 0, started = false;
let helperTimer: ReturnType<typeof setTimeout> | null = null, lanesTimer: ReturnType<typeof setTimeout> | null = null;
const allowed = () => docks > 0 || boards > 0 || store(SEEN_KEY) === "1";
const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

function tickHelper() {
  helperTimer = setTimeout(async () => { if (allowed() && !hidden()) await readHelper(); tickHelper(); }, HELPER_POLL_MS);
}
function tickLanes() {
  lanesTimer = setTimeout(async () => { if (allowed() && !hidden()) await readLanes(); tickLanes(); }, boards > 0 ? POLL_MS : SLOW_MS);
}
/** Start asking (once per page, from the Agents host); the first read goes out at once. */
export function startLive() {
  if (started || typeof window === "undefined") return;
  started = true;
  const was = keptRead();
  if (was) useLive.setState({ lanes: feedOf(was) });
  const heard = Number(store(HEARD_KEY));
  if (heard) useLive.setState((s) => ({ helper: { ...s.helper, lastHeard: heard } }));
  if (allowed()) { void readHelper(); void readLanes(); }
  tickHelper(); tickLanes();
  document.addEventListener("visibilitychange", () => { if (!hidden() && allowed()) { void readHelper(); } });
}
/** The dock opened: the helper is asked at once, whether or not this browser has met it. */
export function dockShown(): () => void {
  docks++; startLive(); void readHelper();
  return () => { docks--; };
}
/** The board shows: the feed is read at once, then every 5 s. */
export function boardShown(): () => void {
  boards++; startLive(); void readLanes();
  if (lanesTimer) { clearTimeout(lanesTimer); tickLanes(); }
  return () => { boards--; };
}

/**
 * One read of what each chat costs the PC: the helper's `GET /lanes/pc`, sums
 * and kinds only. It stays in this store, on this page: nothing reads it into
 * a site, an export or a request (tests/agents-manager.mjs).
 */
export async function readCostNow(): Promise<void> {
  const r = await get(`${HELPER_ORIGIN}/lanes/pc`);
  const pc = r?.ok ? readCost(await r.json().catch(() => null)) : null;
  useLive.setState({ cost: { pc, asked: true } });
}
let managers = 0, costTimer: ReturnType<typeof setTimeout> | null = null;
function tickCost() {
  costTimer = setTimeout(async () => { if (managers > 0) { if (!hidden()) await readCostNow(); tickCost(); } else costTimer = null; }, POLL_MS);
}
/** The manager shows: the cost is read at once, then every 5 s, and not at all once it is shut. */
export function managerShown(): () => void {
  managers++; void readCostNow();
  if (!costTimer) tickCost();
  return () => { managers--; };
}

/** The privacy switch (privacy-rules.md §3): on by default, kept per browser. */
export const usePrivate = create<{ on: boolean }>(() => ({ on: typeof window === "undefined" ? true : readPrivate(store(PRIVATE_KEY)) }));
export function setPrivate(on: boolean) { put(PRIVATE_KEY, on ? "on" : "off"); usePrivate.setState({ on }); }
