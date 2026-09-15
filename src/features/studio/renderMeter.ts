/**
 * What the renderer's first pass cost and how long it took, off the
 * prediction itself.
 *
 * The first pass used to write a constant on its answer and call it the
 * cost: a number copied by hand into four places and never measured
 * (inventory B2). The prediction carries what was measured: `predict_time`
 * and `total_time` always, and a cost only when the vendor reports one,
 * which today it does not. So the seconds are measured (the longer of the
 * model's own time and the wall the person waited), and the cost is the
 * reported figure when there is one and the model's published rate when
 * there is not, with the answer saying which. Pure, and tested by
 * `tests/render-cost.mjs`.
 */
import { RENDER_COST, type RenderKind } from "./renderer.ts";
import { fromMetrics } from "./spend.ts";

export interface FirstMeter {
  /** The longer of the model's own time and the wall, in milliseconds. */
  ms: number;
  /** What it cost, in dollars. */
  cost: number;
  /** Where the number came from: the prediction, or the model's published rate card. */
  priced: "reported" | "card";
}

export function meterFirst(kind: RenderKind, metrics: Record<string, unknown> | null | undefined, wall: number): FirstMeter {
  const m = fromMetrics(metrics, wall);
  return m.dollars === null
    ? { ms: m.ms, cost: RENDER_COST[kind], priced: "card" }
    : { ms: m.ms, cost: m.dollars, priced: "reported" };
}

/** The rate card in a sentence, for the places that used to repeat the numbers. */
export function rateCardSays(): string {
  const m = (n: number) => `$${n.toFixed(2)}`;
  return `${m(RENDER_COST.vector)} a vector or a trace, ${m(RENDER_COST.raster)} a raster, the models' published rates`;
}
