/**
 * Synthesised audio cues via the Web Audio API.
 *
 * No asset files: every cue is a few oscillators and a noise burst, which
 * makes them instant, tiny, and easy to tune. Add a cue by adding an entry to
 * CUES and to the CueName union in core/types.ts.
 */
import type { CueCategory, CueName } from "@/core/types";
import { isBrowser } from "@/core/lib/env";

export interface AudioConfig {
  enabled: boolean;
  /** 0..1 */
  master: number;
  categories: Record<CueCategory, boolean>;
  hover: boolean;
}

let configSource: () => AudioConfig = () => ({
  enabled: true,
  master: 0.35,
  categories: { ui: true, feedback: true, alerts: true, feed: true },
  hover: false,
});

/** The settings layer injects the live config so this file has no store deps. */
export function setAudioConfigSource(fn: () => AudioConfig) {
  configSource = fn;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
const lastPlayed = new Map<string, number>();

function ensureContext(): AudioContext | null {
  if (!isBrowser) return null;
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 20;
  comp.ratio.value = 6;
  comp.attack.value = 0.002;
  comp.release.value = 0.08;
  master = ctx.createGain();
  master.connect(comp);
  comp.connect(ctx.destination);
  return ctx;
}

/** Browsers require a user gesture before audio can start. Call once early. */
export function installAudioUnlock() {
  if (!isBrowser) return () => {};
  const unlock = () => {
    const c = ensureContext();
    if (c && c.state === "suspended") void c.resume();
  };
  window.addEventListener("pointerdown", unlock, { capture: true, passive: true });
  window.addEventListener("keydown", unlock, { capture: true, passive: true });
  return () => {
    window.removeEventListener("pointerdown", unlock, { capture: true });
    window.removeEventListener("keydown", unlock, { capture: true });
  };
}

/* ------------------------------------------------------------------ */
/* Synth helpers                                                       */
/* ------------------------------------------------------------------ */

interface ToneOpts {
  freq: number;
  to?: number;
  type?: OscillatorType;
  dur: number;
  gain?: number;
  attack?: number;
  delay?: number;
}

function tone(c: AudioContext, out: AudioNode, t0: number, o: ToneOpts) {
  const osc = c.createOscillator();
  const g = c.createGain();
  const start = t0 + (o.delay ?? 0);
  const end = start + o.dur;
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, start);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, end);
  const peak = Math.max(0.0002, o.gain ?? 0.2);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + (o.attack ?? 0.003));
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(g);
  g.connect(out);
  osc.start(start);
  osc.stop(end + 0.02);
}

interface NoiseOpts {
  dur: number;
  gain?: number;
  filter?: number;
  to?: number;
  q?: number;
  type?: BiquadFilterType;
  delay?: number;
}

function noise(c: AudioContext, out: AudioNode, t0: number, o: NoiseOpts) {
  if (!noiseBuffer) {
    const len = Math.floor(c.sampleRate * 0.5);
    noiseBuffer = c.createBuffer(1, len, c.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const start = t0 + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const f = c.createBiquadFilter();
  f.type = o.type ?? "bandpass";
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.filter ?? 2000, start);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, start + o.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(Math.max(0.0002, o.gain ?? 0.2), start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.start(start, 0, o.dur + 0.02);
}

/* ------------------------------------------------------------------ */
/* Cue library                                                         */
/* ------------------------------------------------------------------ */

interface CueSpec {
  category: CueCategory;
  /** Minimum ms between two plays of this cue. */
  minGap?: number;
  render: (c: AudioContext, out: AudioNode, t: number) => void;
}

export const CUES: Record<CueName, CueSpec> = {
  tap: {
    category: "ui",
    render: (c, o, t) => {
      noise(c, o, t, { dur: 0.018, filter: 3500, q: 0.8, gain: 0.35 });
      tone(c, o, t, { freq: 1400, to: 900, dur: 0.03, gain: 0.12 });
    },
  },
  tick: { category: "ui", minGap: 30, render: (c, o, t) => tone(c, o, t, { freq: 2200, dur: 0.012, gain: 0.12 }) },
  hover: { category: "ui", minGap: 60, render: (c, o, t) => tone(c, o, t, { freq: 3400, dur: 0.008, gain: 0.05 }) },
  toggleOn: { category: "ui", render: (c, o, t) => tone(c, o, t, { freq: 620, to: 940, dur: 0.05, gain: 0.2 }) },
  toggleOff: { category: "ui", render: (c, o, t) => tone(c, o, t, { freq: 940, to: 620, dur: 0.05, gain: 0.2 }) },
  select: { category: "ui", render: (c, o, t) => tone(c, o, t, { freq: 1000, dur: 0.025, gain: 0.15 }) },
  navigate: { category: "ui", render: (c, o, t) => tone(c, o, t, { freq: 700, to: 1050, type: "triangle", dur: 0.045, gain: 0.15 }) },
  open: {
    category: "ui",
    render: (c, o, t) => {
      noise(c, o, t, { dur: 0.09, filter: 600, to: 3000, gain: 0.2 });
      tone(c, o, t, { freq: 500, to: 900, dur: 0.06, gain: 0.06 });
    },
  },
  close: {
    category: "ui",
    render: (c, o, t) => {
      noise(c, o, t, { dur: 0.08, filter: 3000, to: 500, gain: 0.18 });
      tone(c, o, t, { freq: 900, to: 500, dur: 0.06, gain: 0.06 });
    },
  },
  copy: {
    category: "feedback",
    render: (c, o, t) => {
      tone(c, o, t, { freq: 1600, dur: 0.02, gain: 0.15 });
      tone(c, o, t, { freq: 2100, dur: 0.02, gain: 0.15, delay: 0.04 });
    },
  },
  confirm: {
    category: "feedback",
    render: (c, o, t) => {
      tone(c, o, t, { freq: 880, type: "triangle", dur: 0.05, gain: 0.2 });
      tone(c, o, t, { freq: 1108, type: "triangle", dur: 0.07, gain: 0.2, delay: 0.05 });
    },
  },
  deny: { category: "feedback", render: (c, o, t) => tone(c, o, t, { freq: 320, to: 200, dur: 0.1, gain: 0.2 }) },
  success: {
    category: "feedback",
    render: (c, o, t) => {
      tone(c, o, t, { freq: 660, type: "triangle", dur: 0.06, gain: 0.2 });
      tone(c, o, t, { freq: 880, type: "triangle", dur: 0.06, gain: 0.2, delay: 0.06 });
      tone(c, o, t, { freq: 1320, type: "triangle", dur: 0.12, gain: 0.18, delay: 0.12 });
    },
  },
  error: {
    category: "feedback",
    render: (c, o, t) => {
      tone(c, o, t, { freq: 220, type: "square", dur: 0.14, gain: 0.12 });
      tone(c, o, t, { freq: 233, type: "square", dur: 0.14, gain: 0.1 });
    },
  },
  warn: {
    category: "alerts",
    render: (c, o, t) => {
      tone(c, o, t, { freq: 520, type: "triangle", dur: 0.06, gain: 0.2 });
      tone(c, o, t, { freq: 520, type: "triangle", dur: 0.06, gain: 0.2, delay: 0.1 });
    },
  },
  alert: {
    category: "alerts",
    render: (c, o, t) => {
      tone(c, o, t, { freq: 1760, dur: 0.3, gain: 0.25 });
      tone(c, o, t, { freq: 1760, dur: 0.25, gain: 0.08, delay: 0.18 });
    },
  },
  notify: {
    category: "alerts",
    render: (c, o, t) => {
      tone(c, o, t, { freq: 1046, dur: 0.18, gain: 0.18 });
      tone(c, o, t, { freq: 1318, dur: 0.26, gain: 0.16, delay: 0.06 });
    },
  },
  newRow: {
    category: "feed",
    minGap: 80,
    render: (c, o, t) => {
      tone(c, o, t, { freq: 1500, dur: 0.025, gain: 0.1 });
      tone(c, o, t, { freq: 2000, dur: 0.03, gain: 0.08, delay: 0.03 });
    },
  },
  priceUp: { category: "feed", minGap: 120, render: (c, o, t) => tone(c, o, t, { freq: 900, to: 1300, dur: 0.05, gain: 0.1 }) },
  priceDown: { category: "feed", minGap: 120, render: (c, o, t) => tone(c, o, t, { freq: 1300, to: 900, dur: 0.05, gain: 0.1 }) },
};

export const CUE_NAMES = Object.keys(CUES) as CueName[];

export function cueCategory(name: CueName): CueCategory {
  return CUES[name].category;
}

/**
 * The one sound left.
 *
 * HIS RULE: sound goes, except a ping when something is waiting on him. A
 * click that clicks and a slider that ticks are not information; a job that
 * has stopped and needs him is. So the cues stay defined \u2014 they are a few
 * oscillators each and cost nothing unheard \u2014 and exactly one of them can be
 * heard. There is nothing to mute, so there is no mute, and nothing in the
 * settings panel about volume.
 *
 * `force` is still honoured, for the one page whose whole purpose is to play
 * a cue so somebody can hear what it sounds like.
 */
const STILL_RINGS = new Set<CueName>(["notify"]);

/** Play a cue. Safe to call anywhere on the client; silently no-ops on the server. */
export function play(name: CueName, opts: { volume?: number; force?: boolean } = {}) {
  const cfg = configSource();
  const spec = CUES[name];
  if (!spec) return;
  if (!opts.force && !STILL_RINGS.has(name)) return;
  const c = ensureContext();
  if (!c || !master) return;
  const now = performance.now();
  const gap = spec.minGap ?? 25;
  const last = lastPlayed.get(name) ?? -Infinity;
  if (now - last < gap) return;
  lastPlayed.set(name, now);

  const schedule = () => {
    if (!c || !master) return;
    master.gain.setValueAtTime(Math.max(0, Math.min(1, (opts.volume ?? 1) * cfg.master)), c.currentTime);
    spec.render(c, master, c.currentTime + 0.001);
  };
  if (c.state === "running") schedule();
  else void c.resume().then(schedule).catch(() => {});
}
