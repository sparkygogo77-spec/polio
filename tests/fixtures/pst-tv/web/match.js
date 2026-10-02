import { $, drop, fill, fromTemplate, getJson, ppmToPercent, serverUrl, setText, short, show, sol } from './common.js';
import { verifyMatch } from './verify.js';
import { verifyGeneratedRound } from './generated-chart.js';
import { referenceEmbedUrl, referenceLabel } from './reference.js';

function drawPrices(canvas, r) {
  const pts = [...r.history.map((c) => [c.t, Number(c.c)]), ...r.ticks.filter((t) => t.priceE18 !== null).map((t) => [t.t, Number(BigInt(t.priceE18)) / 1e18])];
  const ctx = canvas.getContext('2d');
  if (pts.length < 2) return;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  let [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  if (y0 === y1) { y0 *= 0.99; y1 *= 1.01; }
  const X = (x) => ((x - x0) / (x1 - x0 || 1)) * (canvas.width - 10) + 5;
  const Y = (y) => canvas.height - 5 - ((y - y0) / (y1 - y0)) * (canvas.height - 10);
  // The line takes the canvas's own text colour, so the design colours it with `color`.
  ctx.strokeStyle = getComputedStyle(canvas).color;
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
  ctx.stroke();
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(X(r.startAt), 0);
  ctx.lineTo(X(r.startAt), canvas.height);
  ctx.stroke();
}

async function load(id) {
  let pub;
  try {
    pub = await getJson(`/matches/${encodeURIComponent(id)}.json`);
  } catch (err) {
    return setText('mr-error', `Could not load match ${id}: ${err.message}`);
  }
  const rec = pub.record;
  show('mr-summary', true);
  show('mr-practice', rec.practice !== false);
  setText('mr-market', rec.marketData ?? 'unknown');
  setText('mr-match-account', rec.matchAccount);
  setText('mr-match-id', rec.matchId);
  const names = {};
  for (const [seat, hook] of [['A', 'mr-player-a'], ['B', 'mr-player-b']]) {
    const addr = rec.players[seat];
    names[seat] = short(addr);
    try { names[seat] = (await getJson(`/api/profiles/${addr}`)).displayName ?? short(addr); } catch { /* keep short */ }
    const a = $(hook); // hooks: mr-player-a, mr-player-b
    a.href = `/profile.html?address=${addr}`;
    a.textContent = `${names[seat]} (${addr})`;
  }
  setText('mr-stake', sol(rec.stake));
  setText('mr-length', `${rec.lengthMs / 60_000} minute${rec.lengthMs === 60_000 ? '' : 's'}`);
  const f = rec.final;
  setText('mr-outcome', f.kind === 'win' ? `${names[f.winner]} won (${f.reason.replaceAll('_', ' ')}).`
    : f.kind === 'void' ? `Void: ${rec.voidReason}. Both stakes refunded in full by the contract.`
    : `No winner (${f.reason.replaceAll('_', ' ')}). Both refunded minus the house cut.`);
  setText('mr-pay-a', sol(f.payout.toA));
  setText('mr-pay-b', sol(f.payout.toB));
  setText('mr-pay-house', sol(f.payout.toTreasury));
  setText('mr-result-key', rec.resultKey);
  try { setText('mr-server-key', (await getJson('/result-key')).resultKey); } catch { setText('mr-server-key', 'unavailable'); }
  setText('mr-txs', [rec.chainTxs.open, rec.chainTxs.join, ...(pub.settlement?.txs ?? [])].join(', '));
  $('mr-raw-link').href = serverUrl(`/matches/${rec.matchAccount}.json`);

  // Rounds: coin, scores, the signed result, the trade log and the prices.
  const box = $('mr-rounds');
  box.replaceChildren();
  for (const r of rec.rounds) {
    const sec = fromTemplate('template-mr-round');
    const g = r.coin.generated;
    // The coin was hidden from both players during the match; they saw prices as an index.
    const base = Number(BigInt(r.indexBase)) / 1e18;
    fill(sec, {
      'mr-round-title': g ? `Round ${r.chainRound}: generated chart, play money` : `Round ${r.chainRound}: ${r.coin.symbol} (${r.coin.mint})`,
      'mr-round-index': `During the match the players saw an index instead of this coin: 100 = ${base.toPrecision(8)} SOL per coin. ` +
        `The chart appeared ${((r.startAt - r.chartAt) / 1000).toFixed(1)} s before trading opened; ` +
        `each fill used the server's latest price reading, at most ${r.fillMaxAgeMs} ms old. Scored budget ${sol(r.budget)} SOL.`,
      'mr-ticks': `${r.ticks.length} price ticks, each with every source's reading (in the raw record).`,
    });
    if (g) generatedSection(sec, r);
    else drop(sec, 'mr-generated');
    // Optional reference after the match: DexScreener's own chart of the pool (not the fill prices).
    const refUrl = referenceEmbedUrl({ revealed: true, coin: r.coin });
    if (refUrl) referenceSection(sec, refUrl, rec.practice !== false);
    else drop(sec, 'mr-reference');
    if (r.outcome) {
      fill(sec, {
        'mr-round-scores': `Scores: ${names.A} ${ppmToPercent(r.outcome.A.scorePpm)}% (${r.outcome.A.filledTrades} trades), ` +
          `${names.B} ${ppmToPercent(r.outcome.B.scorePpm)}% (${r.outcome.B.filledTrades} trades). ` +
          `Closing price ${(Number(BigInt(r.outcome.closingPriceE18)) / 1e18).toPrecision(8)} SOL per coin.`,
      });
    } else drop(sec, 'mr-round-scores');
    if (r.result) fill(sec, { 'mr-round-result': `Signed outcome ${r.result.outcome}; signature ${r.result.signature}` });
    else drop(sec, 'mr-round-result');
    const rows = $('mr-trades-rows', sec);
    for (const o of [...r.orders].sort((x, y) => x.id - y.id)) {
      rows?.append(fill(fromTemplate('template-mr-trade-row'), {
        'mr-trade-id': o.id,
        'mr-trade-player': names[o.seat],
        'mr-trade-side': o.side,
        'mr-trade-percent': `${o.percent}%`,
        'mr-trade-arrived': `${((o.receivedAt - r.startAt) / 1000).toFixed(2)} s`,
        'mr-trade-status': o.status + (o.reason ? ` (${o.reason})` : ''),
        'mr-trade-tick': o.fillTick ?? '-',
        'mr-trade-price': o.fillPriceE18 ? (Number(BigInt(o.fillPriceE18)) / 1e18).toPrecision(8) : '-',
        'mr-trade-index': o.fillPriceE18 ? ((Number(BigInt(o.fillPriceE18)) / Number(BigInt(r.indexBase))) * 100).toFixed(3) : '-',
        'mr-trade-sol': o.lamports ? sol(o.lamports) : '-',
      }));
    }
    box.append(sec);
    const canvas = $('mr-round-chart', sec);
    if (canvas) drawPrices(canvas, r);
  }

  // Verify in the browser.
  show('mr-verify', true);
  const report = await verifyMatch(pub, undefined, { fetchPool });
  setText('mr-verdict', report.ok ? 'every check passed' : `${report.problems.length} check(s) FAILED`);
  $('mr-verify').dataset.ok = String(report.ok);
  const list = $('mr-checks');
  list.replaceChildren();
  for (const c of report.checks) {
    const li = fill(fromTemplate('template-mr-check'), { 'mr-check': `${c.pass ? 'pass' : 'FAIL'}: ${c.label}` });
    li.dataset.pass = String(c.pass);
    list.append(li);
  }
}

/** The move pool a generated chart was stitched from, from the game server (null if it is not there). */
async function fetchPool(poolId) {
  return poolId ? getJson(`/api/charts/pools/${poolId}`) : null;
}

/** DexScreener's chart of the coin's pool, behind a button (the frame gets its address only when asked). */
function referenceSection(sec, refUrl, practice) {
  fill(sec, { 'mr-reference-label': referenceLabel({ practice }) });
  const toggle = $('mr-reference-toggle', sec);
  const frame = $('mr-reference-frame', sec);
  if (!toggle || !frame) return;
  toggle.onclick = () => {
    frame.hidden = !frame.hidden;
    if (frame.hidden) frame.removeAttribute('src');
    else frame.src = refUrl;
    toggle.textContent = frame.hidden ? 'Show the DexScreener reference chart' : 'Hide the reference chart';
  };
}

/**
 * A generated practice chart: the hash shown when it appeared, the seed revealed now, and a button
 * that regenerates the whole chart from the seed in this browser and compares every price.
 */
function generatedSection(sec, r) {
  const g = r.coin.generated;
  fill(sec, {
    'mr-generated-what': g.model === 'trades'
      ? 'Generated chart: the server made this chart for the match by simulating trades one by one (realistic sizes, a constant-product pool), driven by a secret seed.'
      : g.model === 'stitched'
      ? 'Generated chart, play money: the server made this chart for the match by stitching runs of real recorded one-second price moves together in a random order chosen by a secret seed.'
      : 'Generated chart, play money: the server made this chart for the match from a simple random model driven by a secret seed.',
    'mr-generated-commit-value': g.commit,
    'mr-generated-seed-value': g.seed,
  });
  if (g.poolId) fill(sec, { 'mr-generated-pool-value': g.poolId, 'mr-generated-pool-link': { href: serverUrl(`/api/charts/pools/${g.poolId}`) } });
  else drop(sec, 'mr-generated-pool');
  const button = $('mr-generated-verify', sec);
  const out = $('mr-generated-result', sec);
  if (!button || !out) return;
  button.onclick = async () => {
    out.textContent = 'Regenerating...';
    try {
      const pool = !g.poolId ? null : await fetchPool(g.poolId).catch(() => null);
      const v = await verifyGeneratedRound(r, pool);
      out.dataset.ok = String(v.seedMatches && v.poolMatches && v.pricesMatch);
      out.textContent = [
        `Seed matches the hash shown at the start: ${v.seedMatches ? 'yes' : 'NO'}.`,
        !g.poolId ? '' : `Move pool is the one named: ${pool ? (v.poolMatches ? 'yes' : 'NO') : 'could not be fetched from the game server'}.`,
        `Regenerated chart: ${v.pricesMatch ? `all ${v.compared} prices match` : `prices do NOT match (${v.compared} compared)`}.`,
      ].filter(Boolean).join(' ');
    } catch (err) {
      out.dataset.ok = 'false';
      out.textContent = `Could not regenerate: ${err.message}`;
    }
  };
}

const id = new URLSearchParams(location.search).get('id');
if (id) load(id);
else setText('mr-error', 'No match given. Open this page from a profile, the leaderboard or a result.');
