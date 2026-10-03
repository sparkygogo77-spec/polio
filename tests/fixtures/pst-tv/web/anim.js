// Animation hooks for the match chart and duel view (owner decision: leave room for animations).
// The page calls emit() at each moment worth animating. Nothing is animated yet. A designer can:
// - replace any function in chartHooks (also reachable as window.PonsChartHooks), or
// - listen for the "pons:chart" event on the chart area (data-hook="chart-area"); event.detail
//   holds { name, ...details }, or
// - style on the data attributes the page keeps up to date: data-phase on the chart area
//   ("countdown", "trading", "ended"), data-state on the duel view ("winning", "losing", "level"),
//   data-last-trade on the chart area ("mine" or "opponent").
// See web/HOOKS.md for the list of moments and what each carries.

export const chartHooks = {
  /** The chart appeared; the countdown runs. { startAt, endAt } */
  chartShown() {},
  /** Each whole second of the countdown. { secondsLeft } */
  countdown() {},
  /** Trading opened. { startAt } */
  tradingStart() {},
  /** A new price reading. { index, bar, phase } */
  tick() {},
  /** A trade filled. { mine, side, index, barTime } */
  trade() {},
  /** The duel circles changed. { me, opponent, text, state } (see duelView in overlay.js) */
  duel() {},
  /** The lead changed hands or became level. { state, previous } */
  leadChange() {},
  /** Trading closed. { closingIndex } */
  roundEnd() {},
  /** The match is over and the coin is revealed. { coins } */
  reveal() {},
};

if (typeof window !== 'undefined') window.PonsChartHooks = chartHooks;

/** Call the hook and send the matching DOM event. An error in a hook never breaks the game page. */
export function emit(root, name, detail = {}) {
  try {
    chartHooks[name]?.(detail);
  } catch (err) {
    console.warn(`animation hook ${name} failed`, err);
  }
  try {
    root?.dispatchEvent(new CustomEvent('pons:chart', { detail: { name, ...detail }, bubbles: true }));
  } catch {
    // no DOM (tests)
  }
}
