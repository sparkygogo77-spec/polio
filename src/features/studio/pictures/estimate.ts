/**
 * What a press in the drawing tool will roughly cost, said before it is
 * pressed (J, 2026-10-10: "can we get the estimated cost updated since its
 * not always 4 cents").
 *
 * Two sources, the better first:
 *
 * 1. **What his own pictures from this model cost.** Every drawing keeps the
 *    price Replicate reported for it (`draws[].cost`), so the average of
 *    those, for the same model and quality, is a real number on his key.
 * 2. **Otherwise a rough guide**, per model and quality, from the model's
 *    Replicate page where it publishes one (Hunyuan3D: "approximately
 *    $0.10"; Ideogram (Pruna): "from $0.003") and from what others measured
 *    where it does not (GPT Image is billed by tokens, so quality moves it a
 *    lot). It is a guide and says "about"; what it really cost replaces it
 *    once the picture is back.
 *
 * A sphere, cube or pyramid adds nothing: it is code. A real 3D model adds
 * the modeller's run.
 *
 * Pure. Tested by `tests/render-estimate.mjs`.
 */

/** Rough dollars per picture, by quality where the model has one ("" is its own default). */
const GUIDE: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  "google/nano-banana-2": { "": 0.04 },
  "bytedance/seedream-5-lite": { "": 0.03 },
  "openai/gpt-image-2": { "": 0.1, auto: 0.1, low: 0.01, medium: 0.05, high: 0.25 },
  "openai/gpt-image-1.5": { "": 0.08, auto: 0.08, low: 0.01, medium: 0.04, high: 0.2 },
  "prunaai/p-image-ideogram": { "": 0.005 },
};

/** The one model that makes a real solid, from its Replicate page. */
export const SOLID_GUIDE = 0.1;

/** A guide for a model the table has no row for. */
const FALLBACK = 0.05;

export interface PastDraw { model: string; quality?: string; cost?: number | null; ms?: number }

/** About what one picture from this model costs, and where the number came from. */
export function pictureEstimate(model: string, quality: string, past: readonly PastDraw[] = []): { dollars: number; from: "yours" | "guide"; count: number } {
  const same = past.filter((d) => d.model === model && (d.quality ?? "") === (quality ?? "") && typeof d.cost === "number" && d.cost > 0);
  if (same.length) return { dollars: same.reduce((a, d) => a + (d.cost as number), 0) / same.length, from: "yours", count: same.length };
  const row = GUIDE[model];
  return { dollars: row?.[quality ?? ""] ?? row?.[""] ?? FALLBACK, from: "guide", count: 0 };
}

/** A price as it is said here: cents under a dollar keep their third place when small. */
export function about(n: number): string {
  return n < 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
}

/** The whole line under Generate: the picture, plus the 3D model when one is asked for. */
export function estimateLine(model: string, quality: string, threeD: string, past: readonly PastDraw[] = []): string {
  const pic = pictureEstimate(model, quality, past);
  const picSaid = pic.from === "yours" ? `About ${about(pic.dollars)} a picture (your last ${pic.count === 1 ? "one" : pic.count} from this model)` : `About ${about(pic.dollars)} a picture`;
  if (threeD === "solid") return `${picSaid}, plus about ${about(SOLID_GUIDE)} for the 3D model: about ${about(pic.dollars + SOLID_GUIDE)} in all, on your own Replicate key.`;
  return `${picSaid}, on your own Replicate key.`;
}

/**
 * How long a picture from this model usually takes, in seconds: his own
 * pictures from it first, else a rough guide. Replicate reports no progress
 * for these models while they run, so the bar under Generate is time spent
 * against this, and it says so when a run goes past it.
 */
const SECONDS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  "google/nano-banana-2": { "": 20 },
  "bytedance/seedream-5-lite": { "": 20 },
  "openai/gpt-image-2": { "": 60, auto: 60, low: 20, medium: 40, high: 90 },
  "openai/gpt-image-1.5": { "": 50, auto: 50, low: 15, medium: 35, high: 80 },
  "prunaai/p-image-ideogram": { "": 8 },
};

/** Hunyuan3D, from its Replicate page: "Predictions typically complete within 104 seconds." */
export const SOLID_SECONDS = 104;

export function pictureSeconds(model: string, quality: string, past: readonly PastDraw[] = []): number {
  const same = past.filter((d) => d.model === model && (d.quality ?? "") === (quality ?? "") && typeof d.ms === "number" && d.ms > 0);
  if (same.length) return Math.max(1, Math.round(same.reduce((a, d) => a + (d.ms as number), 0) / same.length / 1000));
  const row = SECONDS[model];
  return row?.[quality ?? ""] ?? row?.[""] ?? 30;
}

/** Where the bar stands: never full while still running, and whether the run has gone past the usual time. */
export function progressOf(elapsedS: number, expectS: number): { fraction: number; late: boolean } {
  const late = elapsedS > expectS;
  /* Up to 90% on time; past it, the last tenth creeps so the bar still moves. */
  const fraction = late ? 0.9 + 0.09 * (1 - Math.exp(-(elapsedS - expectS) / Math.max(10, expectS))) : 0.9 * (elapsedS / Math.max(1, expectS));
  return { fraction: Math.min(0.99, Math.max(0, fraction)), late };
}
