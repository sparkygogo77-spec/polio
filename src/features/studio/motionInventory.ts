/**
 * Every moving part on a page, by kind: what the Motion tab lists.
 *
 * A page moves in four ways, kept in four places, and the Motion tab used to
 * show none of them:
 *
 *   · a feature from the library on a part (`node.work`): a reveal, a tilt,
 *     a spin, a marquee, the dust (`library/behaviours.ts`);
 *   · what a captured part did on the page it came from (`node.motion`): its
 *     animations, and how it moved under the pointer (`parts/capturedMotion.ts`);
 *   · a part that is itself a movement: a scrolling ticker, a slideshow that
 *     turns on its own, and the page-wide behaviours (appear on scroll, depth
 *     scrolling, a custom cursor, `live/behaviours.ts`);
 *   · a crate of frames put on a part (`motion.ts`, `crateLayer.tsx`).
 *
 * This reads all four into one list of rows, each with the part's plain name,
 * what it does, whether it is on, and the one number that says how fast, where
 * the kind has one. Writing back is `motionWrite.ts`'s: each row says which
 * of the four it came from, so the change lands where the renderer reads it.
 */
import { getFeature } from "./catalog";
import { getWork, usesOf } from "./library/works";
import { filled, type MotionAsset } from "./motion";
import type { StudioNode } from "./store";

export type MoveKind = "reveal" | "follow" | "tilt" | "hover" | "press" | "loop" | "ribbon" | "canvas" | "crate" | "page";

/** The kinds, in the order the tab shows them, with their plain names. */
export const MOVE_KINDS: { id: MoveKind; name: string }[] = [
  { id: "reveal", name: "Reveal on scroll" },
  { id: "follow", name: "Follow the pointer" },
  { id: "tilt", name: "Tilt" },
  { id: "hover", name: "On hover" },
  { id: "press", name: "On press" },
  { id: "loop", name: "Loops and blinks" },
  { id: "ribbon", name: "Ribbons and tickers" },
  { id: "canvas", name: "Canvas effects" },
  { id: "crate", name: "Frame sequences (crates)" },
  { id: "page", name: "The whole page" },
];

/** How fast a row goes, when its kind has a number for it. */
export interface MoveSpeed {
  label: string;
  /** "ms" and "s" are times, "px/s" a speed, "×" a multiple; "pick" is a choice from `choices`. */
  unit: "ms" | "s" | "px/s" | "px/frame" | "×" | "pick";
  value: number | string;
  min?: number;
  max?: number;
  step?: number;
  choices?: string[];
}

export interface MoveRow {
  /** Stable across renders: which part, which of the four, which feature. */
  key: string;
  nodeId: string;
  kind: MoveKind;
  /** The part's own name, as the owner reads it. */
  name: string;
  /** What it does, in words. */
  what: string;
  source: "work" | "captured" | "part" | "crate";
  /** The library feature, for `work` rows. */
  workId?: string;
  /** The crate, for `crate` rows. */
  crateId?: string;
  off: boolean;
  speed?: MoveSpeed;
}

/* ------------------------------------------------------------------ */
/* Features from the library                                           */
/* ------------------------------------------------------------------ */

const WORK_KIND: Record<string, MoveKind> = {
  reveal: "reveal", "scroll-grow": "reveal", "scroll-header": "reveal",
  "follow-pointer": "follow",
  tilt: "tilt",
  "hover-lift": "hover",
  "press-shows": "press", glide: "press",
  blink: "loop", spin: "loop", float: "loop",
  marquee: "ribbon",
  "dust-canvas": "canvas", "crt-loader": "canvas",
};

interface SpeedOf { input: string; label: string; unit: MoveSpeed["unit"]; min: number; max: number; step: number }
const WORK_SPEED: Record<string, SpeedOf> = {
  reveal: { input: "duration", label: "Takes", unit: "ms", min: 100, max: 3000, step: 50 },
  "scroll-header": { input: "duration", label: "Takes", unit: "ms", min: 50, max: 2000, step: 50 },
  tilt: { input: "pace", label: "Follows in", unit: "ms", min: 0, max: 1000, step: 10 },
  "hover-lift": { input: "pace", label: "Takes", unit: "ms", min: 0, max: 1000, step: 10 },
  glide: { input: "base", label: "Takes", unit: "ms", min: 100, max: 3000, step: 50 },
  blink: { input: "every", label: "Every", unit: "s", min: 0.2, max: 5, step: 0.1 },
  spin: { input: "period", label: "One turn", unit: "s", min: 1, max: 60, step: 0.5 },
  float: { input: "period", label: "Out and back", unit: "s", min: 1, max: 20, step: 0.5 },
  marquee: { input: "speed", label: "Speed", unit: "px/s", min: 5, max: 400, step: 5 },
  "dust-canvas": { input: "speed", label: "Speed", unit: "×", min: 0.1, max: 5, step: 0.1 },
  "crt-loader": { input: "hold", label: "Shown for", unit: "s", min: 0.5, max: 10, step: 0.1 },
};
/** A marquee told how far to move each frame uses that instead of its speed, so that is the number to show. */
const MARQUEE_STEP: SpeedOf = { input: "step", label: "Moves", unit: "px/frame", min: 0.1, max: 5, step: 0.1 };

/** The input a row's speed writes, for a feature: what `motionWrite.ts` needs to put a new value back. */
export function workSpeedInput(workId: string, inputs: Record<string, string>): string | null {
  if (workId === "marquee" && String(inputs.step ?? "").trim() !== "") return MARQUEE_STEP.input;
  return WORK_SPEED[workId]?.input ?? null;
}

function workSpeed(workId: string, inputs: Record<string, string>): MoveSpeed | undefined {
  const s = workId === "marquee" && String(inputs.step ?? "").trim() !== "" ? MARQUEE_STEP : WORK_SPEED[workId];
  if (!s) return undefined;
  const def = getWork(workId)?.manifest.inputs.find((i) => i.id === s.input)?.default ?? "";
  const raw = Number(inputs[s.input] !== undefined && inputs[s.input] !== "" ? inputs[s.input] : def);
  return { label: s.label, unit: s.unit, value: Number.isFinite(raw) ? raw : s.min, min: s.min, max: s.max, step: s.step };
}

/* ------------------------------------------------------------------ */
/* Parts that are movements                                            */
/* ------------------------------------------------------------------ */

const PART_KIND: Record<string, MoveKind> = {
  "reveal-on-scroll": "reveal", "page-load": "reveal",
  "cursor-effects": "follow",
  parallax: "tilt", "hover-tilt": "tilt",
  confetti: "canvas",
  marquee: "ribbon",
  carousel: "loop",
  "scroll-snap": "page", "smooth-scroll": "page", "scroll-progress": "page", "back-to-top": "page",
  "sticky-story": "page", "horizontal-scroll": "page", "scroll-video": "page", "infinite-scroll": "page",
  "morph-transition": "page", physics: "page", "page-transitions": "page",
};

/** Whether a part that is a movement is switched off, by the option it already has where it has one. */
export function partOff(n: Pick<StudioNode, "featureId" | "options">): boolean {
  const o = n.options ?? {};
  if (n.featureId === "marquee") return o.speed === "still";
  if (n.featureId === "carousel") return o.autoplay !== "yes";
  return o.off === "yes";
}

/* ------------------------------------------------------------------ */
/* What a captured part did                                            */
/* ------------------------------------------------------------------ */

/** Seconds, from a captured duration ("0.6s", "600ms", "1s, 2s"): the first. */
export function seconds(v: string | undefined): number | null {
  const m = /(-?[\d.]+)\s*(ms|s)\b/.exec(v ?? "");
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? (m[2] === "ms" ? n / 1000 : n) : null;
}

/* ------------------------------------------------------------------ */
/* The list                                                            */
/* ------------------------------------------------------------------ */

/** A part's plain name: what the owner called it, else what it is. */
export function partName(n: Pick<StudioNode, "label" | "featureId">): string {
  return n.label?.trim() || getFeature(n.featureId)?.name || n.featureId;
}

export function movingParts(nodes: readonly StudioNode[], crates: readonly MotionAsset[], pageId: string): MoveRow[] {
  const rows: MoveRow[] = [];
  for (const n of nodes) {
    if (n.pageId !== pageId) continue;
    const name = partName(n);
    for (const u of usesOf(n.work)) {
      const kind = WORK_KIND[u.id];
      if (!kind) continue;
      rows.push({
        key: `${n.id}:work:${u.id}`, nodeId: n.id, kind, name,
        what: getWork(u.id)?.manifest.name ?? u.id,
        source: "work", workId: u.id, off: !!u.off,
        speed: workSpeed(u.id, u.inputs ?? {}),
      });
    }
    const m = n.motion;
    if (m && (m.animation?.length || m.hover?.length || m.active?.length || m.focus?.length || m.transition?.length)) {
      const kind: MoveKind = m.animation?.length ? "loop" : m.active?.length && !m.hover?.length ? "press" : "hover";
      const first = seconds(m.animation?.[0]?.duration);
      rows.push({
        key: `${n.id}:captured`, nodeId: n.id, kind, name,
        what: m.animation?.length
          ? `Its own animation, as captured${m.animation.length > 1 ? ` (${m.animation.length} of them)` : ""}`
          : "How it moved under the pointer, as captured",
        source: "captured", off: !!m.off,
        ...(first !== null && first > 0 ? { speed: { label: "Takes", unit: "s" as const, value: first, min: 0.1, max: 30, step: 0.1 } } : {}),
      });
    }
    const pk = PART_KIND[n.featureId];
    if (pk) {
      rows.push({
        key: `${n.id}:part`, nodeId: n.id, kind: pk, name,
        what: getFeature(n.featureId)?.name ?? n.featureId,
        source: "part", off: partOff(n),
        ...(n.featureId === "marquee"
          ? { speed: { label: "Speed", unit: "pick" as const, value: n.options?.speed === "still" ? "medium" : n.options?.speed ?? "medium", choices: ["slow", "medium", "fast"] } }
          : {}),
      });
    }
    for (const c of crates) {
      if (c.part !== n.id || filled(c).length < 2) continue;
      rows.push({
        key: `${n.id}:crate:${c.id}`, nodeId: n.id, kind: "crate", name,
        what: `${c.name}, as its picture`,
        source: "crate", crateId: c.id, off: !!c.off,
        speed: { label: "Length", unit: "s", value: c.duration, min: 0.4, max: 6, step: 0.1 },
      });
    }
  }
  return rows;
}

/** The rows by kind, in the tab's order, the empty kinds left out. */
export function byKind(rows: readonly MoveRow[]): { kind: MoveKind; name: string; rows: MoveRow[] }[] {
  return MOVE_KINDS.map((k) => ({ kind: k.id, name: k.name, rows: rows.filter((r) => r.kind === k.id) })).filter((g) => g.rows.length);
}
