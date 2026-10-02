// The sample generated-chart page (chart-lab.html): draws a chart made in this browser from a seed,
// with buy and sell volume, and the stats over 10,000 seconds against J's targets.
import { $, cssVar, setText } from './dom.js';
import { CHART_PARAMS, bytesToHex, chartStats, generateChart } from './generated-chart.js';

const P = CHART_PARAMS;
const newSeed = () => bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
const sol = (x, d = 3) => `${x.toFixed(d)} SOL`;

/** Candles of `bar` seconds from simulated seconds: open, high, low, close (1 = start) and SOL bought and sold. */
function candles(prices, seconds, bar, upTo) {
  const out = [];
  for (let i = 0; i < upTo; i += bar) {
    const c = { o: Number(prices[i]) / Number(prices[0]), h: -Infinity, l: Infinity, c: 0, buy: 0, sell: 0 };
    for (let k = i; k < Math.min(i + bar, upTo); k++) {
      const s = seconds[k];
      c.h = Math.max(c.h, s.high, c.o);
      c.l = Math.min(c.l, s.low, c.o);
      c.buy += s.buySol;
      c.sell += s.sellSol;
      c.c = Number(prices[k + 1]) / Number(prices[0]);
    }
    out.push(c);
  }
  return out;
}

function draw(cs) {
  const canvas = $('lab-chart');
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, priceH = H * 0.68, volTop = priceH + 12, volH = H - volTop;
  const up = cssVar('--pons-candle-up'), down = cssVar('--pons-candle-down');
  g.fillStyle = cssVar('--pons-chart-background');
  g.fillRect(0, 0, W, H);
  const hi = Math.max(...cs.map((c) => c.h)), lo = Math.min(...cs.map((c) => c.l));
  const y = (v) => 8 + (priceH - 16) * (1 - (v - lo) / (hi - lo || 1));
  const step = W / cs.length, w = Math.max(1, step * 0.7);
  const maxVol = Math.max(...cs.map((c) => Math.max(c.buy, c.sell)), 1e-9);
  const mid = volTop + volH / 2;
  g.strokeStyle = cssVar('--pons-chart-grid');
  g.beginPath(); g.moveTo(0, mid); g.lineTo(W, mid); g.stroke();
  g.fillStyle = cssVar('--pons-chart-text');
  g.font = '12px sans-serif';
  g.fillText(`high ${(hi * 100).toFixed(2)}`, 4, 14);
  g.fillText(`low ${(lo * 100).toFixed(2)}`, 4, priceH - 4);
  cs.forEach((c, i) => {
    const x = i * step + (step - w) / 2;
    const col = c.c >= c.o ? up : down;
    g.fillStyle = col; g.strokeStyle = col;
    g.beginPath(); g.moveTo(x + w / 2, y(c.h)); g.lineTo(x + w / 2, y(c.l)); g.stroke();
    const top = y(Math.max(c.o, c.c));
    g.fillRect(x, top, w, Math.max(1, y(Math.min(c.o, c.c)) - top));
    const bh = (c.buy / maxVol) * (volH / 2 - 2), sh = (c.sell / maxVol) * (volH / 2 - 2);
    g.fillStyle = up; g.fillRect(x, mid - bh, w, bh);
    g.fillStyle = down; g.fillRect(x, mid, w, sh);
  });
}

async function run() {
  try {
    let seed = $('lab-seed-input').value.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(seed)) $('lab-seed-input').value = seed = newSeed();
    const secs = Number($('lab-secs').value), bar = Number($('lab-bar').value);
    const chart = await generateChart(seed, null, 10_000);
    draw(candles(chart.prices, chart.seconds, bar, secs));
    const st = chartStats(chart);
    setText('lab-stat-mean-value', sol(st.meanSol));
    setText('lab-stat-mean-target', `${sol(P.meanSol)}, give or take 0.03`);
    setText('lab-stat-range-value', `${sol(st.minSol)} to ${sol(st.maxSol, 2)}`);
    setText('lab-stat-range-target', `${sol(P.minSol, 2)} to ${sol(P.maxSol, 2)}`);
    setText('lab-stat-rate-value', st.tradesPerSecond.toFixed(1));
    setText('lab-stat-rate-target', `usually about ${P.baseRate}, more in bursts after big moves, never under ${P.minRate}`);
    setText('lab-stat-empty-value', `${(st.emptyShare * 100).toFixed(2)}%`);
    setText('lab-stat-flat-value', `${st.longestFlatSecs} second${st.longestFlatSecs === 1 ? '' : 's'}`);
    setText('lab-stat-volume-value', `${st.buySol.toFixed(0)} bought, ${st.sellSol.toFixed(0)} sold`);
    const again = await generateChart(seed, null, 10_000);
    setText('lab-stat-same-value', again.prices.every((p, i) => p === chart.prices[i]) ? 'identical' : 'DIFFERENT');
    setText('lab-error', '');
  } catch (err) {
    setText('lab-error', `Could not make the chart: ${err.message}`);
  }
}

$('lab-form').onsubmit = (e) => { e.preventDefault(); run(); };
$('lab-new-seed-button').onclick = () => { $('lab-seed-input').value = newSeed(); run(); };
$('lab-secs').onchange = run;
$('lab-bar').onchange = run;
$('lab-seed-input').value = new URLSearchParams(location.search).get('seed') ?? newSeed();
run();
