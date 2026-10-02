// Tunable numbers for generated practice charts (web/generated-chart.js, model "trades"). Every
// generated chart is a trade-by-trade simulation: trades arrive one after another, each buys or
// sells some SOL through a constant-product pool, and the price is whatever the pool says after
// each trade. The defaults are J's targets for a coin of about 500,000 US dollars market cap.
//
// A chart's record keeps the numbers it was made with, so changing a default here never breaks the
// check of an older chart. Change a number, open /chart-lab.html and look at the sample and stats.

export const CHART_PARAMS = {
  // ---- The pool (prices come only from trades through it) ----
  /** Market cap the chart imitates, in US dollars. */
  marketCapUsd: 500_000,
  /** SOL price in US dollars, to turn the market cap into SOL. */
  solUsd: 150,
  /**
   * SOL in the pool as a share of the market cap. Pool SOL reserve R = marketCapUsd / solUsd x
   * liquidityRatio (defaults: 500,000 / 150 x 0.12 = 400 SOL). A buy of d SOL multiplies the
   * price by ((R + d) / R)^2; a sell of d SOL by ((R - d) / R)^2. Smaller ratio = bigger moves.
   */
  liquidityRatio: 0.12,

  // ---- Trade sizes in SOL: a lognormal cut to [minSol, maxSol] ----
  /** Average trade (J: about 0.3 SOL). The lognormal's centre is fitted so the cut average is this. */
  meanSol: 0.3,
  /** Smallest trade (J: lows around 0.05). Draws outside the range are drawn again. */
  minSol: 0.05,
  /** Biggest trade (J: highs around 3). */
  maxSol: 3,
  /** Spread of sizes (standard deviation of the size's logarithm). Higher = more small and big trades. */
  sizeSpread: 0.9,

  // ---- How often trades arrive: a Poisson process whose rate drifts and bursts ----
  /** Usual trades per second. */
  baseRate: 6,
  /**
   * The rate never drops below this. An empty second has chance e^(-rate), so 4.6 a second keeps
   * that under 1%; on top of that every second is given at least one trade (minTradesPerSecond).
   */
  minRate: 4.6,
  /** Upper limit on trades per second, even in a burst. */
  maxRate: 60,
  /** Every second has at least this many trades, so no second is empty and the price always moves. */
  minTradesPerSecond: 1,
  /** Slow drift of the usual rate: how much of the drift stays each second (0 to 1) ... */
  rateDriftKeep: 0.98,
  /** ... and its random step each second (in the rate's logarithm). */
  rateDriftStep: 0.08,
  /** Bursts (self-exciting): extra trades per second added for each 1% the price moved last second ... */
  burstPerPercentMove: 0.4,
  /** ... and for each SOL traded above 1 SOL in one trade ... */
  burstPerBigTradeSol: 0.4,
  /** ... and how much of the burst is left after each second (0 to 1). */
  burstKeep: 0.8,

  // ---- Buyers against sellers: momentum regimes ----
  /**
   * Market moods. Each second a mood may end (on average after `meanSecs`); the next mood is drawn
   * by `weight`. `buyShare` is the chance a trade is a buy. Pumps and dumps have more trades
   * (`rateBoost`) and bigger buys or sells (`buySizeBoost`, `sellSizeBoost`).
   */
  regimes: {
    chop: { buyShare: 0.5, meanSecs: 40, weight: 50, rateBoost: 1, buySizeBoost: 1, sellSizeBoost: 1 },
    up: { buyShare: 0.54, meanSecs: 30, weight: 21, rateBoost: 1.2, buySizeBoost: 1, sellSizeBoost: 1 },
    down: { buyShare: 0.46, meanSecs: 30, weight: 21, rateBoost: 1.1, buySizeBoost: 1, sellSizeBoost: 1 },
    pump: { buyShare: 0.72, meanSecs: 8, weight: 4, rateBoost: 2.2, buySizeBoost: 1.4, sellSizeBoost: 1 },
    dump: { buyShare: 0.24, meanSecs: 8, weight: 4, rateBoost: 2.5, buySizeBoost: 1, sellSizeBoost: 1.5 },
  },
  /** Momentum: the buy chance moves by this times the price change over the last `momentumSecs` (0.1 = 10%). */
  momentumGain: 0.5,
  momentumSecs: 10,
  /** Momentum adds or takes away at most this much buy chance. */
  maxMomentum: 0.06,
  /**
   * A gentle pull back towards the starting price over long stretches, so a chart cannot run away:
   * the buy chance moves by minus this times the natural logarithm of (price / start price).
   */
  anchorGain: 0.1,
  /** The buy chance always stays between these. */
  minBuyShare: 0.1,
  maxBuyShare: 0.9,
};
