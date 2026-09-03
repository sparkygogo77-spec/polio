"use client";
/**
 * Simulated launch stream. Replace with a websocket in your own module; the
 * store API (ingest / update / move) is what the UI depends on, not this file.
 */
import { create } from "zustand";
import { play } from "@/core/audio/engine";
import { getSetting } from "@/core/settings/store";
import { publish } from "@/core/news/store";

export type Stage = "new" | "final" | "migrated";

export interface Token {
  address: string;
  ticker: string;
  name: string;
  createdAt: number;
  /** When the row entered its current column (drives the insert flash). */
  insertedAt: number;
  stage: Stage;
  mc: number;
  liq: number;
  vol: number;
  txB: number;
  txS: number;
  holders: number;
  devPct: number;
  top10Pct: number;
  sniperPct: number;
  progress: number;
  socials: { x: boolean; tg: boolean; web: boolean };
  paid: boolean;
  hist: number[];
  creator: string;
}

const ADJ = ["Turbo", "Moon", "Giga", "Based", "Pepe", "Wojak", "Chad", "Ghost", "Neon", "Quantum", "Sigma", "Doge", "Cyber", "Retro", "Hyper", "Pixel", "Lunar", "Solar", "Frog", "Cat"];
const NOUN = ["Cat", "Inu", "Rocket", "Coin", "Frog", "Punk", "Wizard", "Ape", "Bot", "Dragon", "Whale", "Goblin", "Knight", "Ninja", "Pizza", "Duck", "Bear", "Bull", "Toad", "Alien"];

const GRADUATION_ETH = 4.2;
const ETH_USD = 3200;

function hex(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

function makeToken(now: number): Token {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)]!;
  const b = NOUN[Math.floor(Math.random() * NOUN.length)]!;
  const liq = 0.2 + Math.random() * 0.8;
  const mc = liq * ETH_USD * (4 + Math.random() * 6);
  return {
    address: "0x" + hex(40),
    ticker: (a.slice(0, 3) + b.slice(0, 3)).toUpperCase(),
    name: `${a} ${b}`,
    createdAt: now,
    insertedAt: now,
    stage: "new",
    mc,
    liq,
    vol: mc * 0.05,
    txB: 1 + Math.floor(Math.random() * 3),
    txS: 0,
    holders: 2 + Math.floor(Math.random() * 6),
    devPct: Math.round(2 + Math.random() * 20),
    top10Pct: Math.round(20 + Math.random() * 50),
    sniperPct: Math.round(Math.random() * 30),
    progress: liq / GRADUATION_ETH,
    socials: { x: Math.random() > 0.35, tg: Math.random() > 0.5, web: Math.random() > 0.6 },
    paid: Math.random() > 0.85,
    hist: [mc],
    creator: "0x" + hex(40),
  };
}

function step(t: Token): Token {
  const drift = t.stage === "migrated" ? 0.5 : 1;
  const r = (Math.random() - 0.47) * 0.08 * drift;
  const mc = Math.max(500, t.mc * (1 + r));
  const liqDelta = Math.random() < 0.55 ? Math.random() * 0.12 : -Math.random() * 0.04;
  const liq = Math.max(0.05, t.liq + liqDelta);
  const buy = Math.random() < 0.6;
  return {
    ...t,
    mc,
    liq,
    vol: t.vol + mc * Math.random() * 0.02,
    txB: t.txB + (buy ? 1 : 0),
    txS: t.txS + (buy ? 0 : 1),
    holders: t.holders + (Math.random() < 0.5 ? 1 : 0),
    devPct: Math.max(0, t.devPct - (Math.random() < 0.05 ? 1 : 0)),
    progress: t.stage === "migrated" ? 1 : Math.min(1, liq / GRADUATION_ETH),
    hist: [...t.hist.slice(-23), mc],
  };
}

export interface PulseState {
  columns: Record<Stage, Token[]>;
  queue: Record<Stage, Token[]>;
  paused: Record<Stage, boolean>;
  running: boolean;
  hidden: Set<string>;
  watch: Set<string>;
  blacklist: Set<string>;
  preset: 1 | 2 | 3;
  filters: { minLiq: number; minMc: number; requireSocials: boolean; maxDev: number };
  rate: number;
  tick: (now: number) => void;
  spawn: (now: number) => void;
  setPaused: (col: Stage, v: boolean) => void;
  flush: (col: Stage) => void;
  setRunning: (v: boolean) => void;
  setPreset: (p: 1 | 2 | 3) => void;
  setFilters: (f: Partial<PulseState["filters"]>) => void;
  hide: (address: string) => void;
  toggleWatch: (address: string) => void;
  blacklistDev: (creator: string) => void;
  clear: () => void;
  buy: (t: Token, eth: number) => void;
  sell: (t: Token, pct: number) => void;
  positions: Record<string, { eth: number; entryMc: number }>;
}

export const PRESETS: Record<1 | 2 | 3, number> = { 1: 0.1, 2: 0.5, 3: 1 };

const STAGE_LABEL: Record<Stage, string> = { new: "New pairs", final: "Final stretch", migrated: "Migrated" };

function onPulsePage() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/pulse");
}

export const usePulse = create<PulseState>()((set, get) => ({
  columns: { new: [], final: [], migrated: [] },
  queue: { new: [], final: [], migrated: [] },
  paused: { new: false, final: false, migrated: false },
  running: true,
  hidden: new Set(),
  watch: new Set(),
  blacklist: new Set(),
  preset: 2,
  filters: { minLiq: 0, minMc: 0, requireSocials: false, maxDev: 100 },
  rate: 0,
  positions: {},

  spawn: (now) => {
    const s = get();
    if (!s.running) return;
    const t = makeToken(now);
    if (s.blacklist.has(t.creator)) return;
    const max = getSetting<number>("pulse.maxRows");
    if (s.paused.new) set({ queue: { ...s.queue, new: [t, ...s.queue.new].slice(0, max) } });
    else set({ columns: { ...s.columns, new: [t, ...s.columns.new].slice(0, max) } });
    if (onPulsePage() && getSetting<boolean>("pulse.soundNewRow")) play("newRow");
  },

  tick: (now) => {
    const s = get();
    if (!s.running) return;
    const max = getSetting<number>("pulse.maxRows");
    const cols: Record<Stage, Token[]> = { new: [], final: [], migrated: [] };
    const queue: Record<Stage, Token[]> = { ...s.queue };
    const moved: Token[] = [];
    for (const stage of ["new", "final", "migrated"] as Stage[]) {
      for (const t0 of s.columns[stage]) {
        const t = Math.random() < 0.35 ? step(t0) : t0;
        let next: Stage = t.stage;
        if (stage !== "migrated") next = t.progress >= 1 ? "migrated" : t.progress >= 0.5 ? "final" : "new";
        if (next !== stage && !s.paused[stage]) {
          const mt = { ...t, stage: next, insertedAt: now };
          if (s.paused[next]) queue[next] = [mt, ...queue[next]].slice(0, max);
          else cols[next].push(mt);
          moved.push(mt);
        } else {
          cols[stage].push(next !== stage ? { ...t, stage: next } : t);
        }
      }
    }
    for (const stage of ["new", "final", "migrated"] as Stage[]) {
      cols[stage].sort((a, b) => b.insertedAt - a.insertedAt);
      cols[stage] = cols[stage].slice(0, max);
    }
    set({ columns: cols, queue });
    for (const m of moved) {
      if (m.stage === "migrated") {
        publish({
          key: `pulse:migrated:${m.address}`,
          title: `${m.ticker} graduated`,
          body: `${m.name} crossed ${GRADUATION_ETH} ETH paired`,
          level: "success",
          source: "pulse",
          href: "/pulse",
          sound: onPulsePage() && getSetting<boolean>("pulse.soundMigrate") ? "alert" : false,
          toast: onPulsePage(),
          ttlMs: 120_000,
        });
      }
    }
  },

  setPaused: (col, v) => {
    if (!getSetting<boolean>("behaviour.pauseOnHover") && v) return;
    const s = get();
    if (s.paused[col] === v) return;
    set({ paused: { ...s.paused, [col]: v } });
    if (!v) get().flush(col);
  },

  flush: (col) => {
    const s = get();
    const max = getSetting<number>("pulse.maxRows");
    const incoming = s.queue[col].map((t) => ({ ...t, insertedAt: Date.now() }));
    const kept = s.columns[col].filter((t) => t.stage === col);
    set({
      columns: { ...s.columns, [col]: [...incoming, ...kept].slice(0, max) },
      queue: { ...s.queue, [col]: [] },
    });
  },

  setRunning: (v) => {
    set({ running: v });
    publish({ key: "pulse:running", title: v ? "Stream resumed" : "Stream paused", level: "info", source: "pulse", toast: true, sound: v ? "confirm" : "deny" });
  },
  setPreset: (p) => {
    const prev = get().preset;
    if (prev === p) return;
    set({ preset: p });
    publish({ key: "pulse:preset", title: "Quick-buy preset", diff: { from: `P${prev} · ${PRESETS[prev]} ETH`, to: `P${p} · ${PRESETS[p]} ETH` }, level: "info", source: "pulse", toast: true, sound: "select" });
  },
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  hide: (address) => set((s) => ({ hidden: new Set(s.hidden).add(address) })),
  toggleWatch: (address) =>
    set((s) => {
      const next = new Set(s.watch);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return { watch: next };
    }),
  blacklistDev: (creator) =>
    set((s) => {
      const blacklist = new Set(s.blacklist).add(creator);
      const strip = (list: Token[]) => list.filter((t) => t.creator !== creator);
      return { blacklist, columns: { new: strip(s.columns.new), final: strip(s.columns.final), migrated: strip(s.columns.migrated) } };
    }),
  clear: () => set({ columns: { new: [], final: [], migrated: [] }, queue: { new: [], final: [], migrated: [] } }),

  buy: (t, eth) => {
    const s = get();
    const pos = s.positions[t.address];
    set({ positions: { ...s.positions, [t.address]: { eth: (pos?.eth ?? 0) + eth, entryMc: pos ? (pos.entryMc * pos.eth + t.mc * eth) / (pos.eth + eth) : t.mc } } });
    publish({
      key: `pulse:buy:${t.address}`,
      title: `Bought ${t.ticker}`,
      body: `${eth} ETH at ${Math.round(t.mc / 1000)}K MC · ${STAGE_LABEL[t.stage]}`,
      level: "success",
      source: "pulse",
      toast: true,
      sound: "confirm",
    });
  },
  sell: (t, pct) => {
    const s = get();
    const pos = s.positions[t.address];
    if (!pos) return;
    const remaining = pos.eth * (1 - pct / 100);
    const positions = { ...s.positions };
    if (remaining <= 0.0001) delete positions[t.address];
    else positions[t.address] = { ...pos, eth: remaining };
    set({ positions });
    const pnl = ((t.mc - pos.entryMc) / pos.entryMc) * 100;
    publish({
      key: `pulse:sell:${t.address}`,
      title: `Sold ${pct}% ${t.ticker}`,
      body: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}% vs entry`,
      level: pnl >= 0 ? "success" : "warn",
      source: "pulse",
      toast: true,
      sound: pnl >= 0 ? "success" : "deny",
    });
  },
}));

/** Start the simulated stream. Returns a stop function. Used by the module's onMount. */
export function startSimulation(): () => void {
  let spawnTimer = 0;
  let count = 0;
  const speed = () => getSetting<number>("pulse.speed");
  const scheduleSpawn = () => {
    spawnTimer = window.setTimeout(() => {
      usePulse.getState().spawn(Date.now());
      count++;
      scheduleSpawn();
    }, (500 + Math.random() * 900) / speed());
  };
  scheduleSpawn();
  const tick = window.setInterval(() => usePulse.getState().tick(Date.now()), 220);
  const rate = window.setInterval(() => {
    usePulse.setState({ rate: count });
    count = 0;
  }, 1000);
  // Seed so the page isn't empty on first paint.
  const now = Date.now();
  const seed: Token[] = Array.from({ length: 14 }, (_, i) => {
    const t = makeToken(now - i * 9000);
    const liq = 0.3 + Math.random() * 4.5;
    const stage: Stage = liq >= 4.2 ? "migrated" : liq >= 2.1 ? "final" : "new";
    return { ...t, liq, progress: Math.min(1, liq / 4.2), stage, insertedAt: now - i * 9000 - 5000, mc: liq * 3200 * (4 + Math.random() * 8) };
  });
  usePulse.setState({
    columns: {
      new: seed.filter((t) => t.stage === "new"),
      final: seed.filter((t) => t.stage === "final"),
      migrated: seed.filter((t) => t.stage === "migrated"),
    },
  });
  return () => {
    window.clearTimeout(spawnTimer);
    window.clearInterval(tick);
    window.clearInterval(rate);
  };
}

export { GRADUATION_ETH, STAGE_LABEL };
