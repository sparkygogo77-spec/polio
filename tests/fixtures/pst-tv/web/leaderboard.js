import { $, fill, fromTemplate, getJson, setText, short, show, sol } from './common.js';

async function load() {
  const by = $('leaderboard-by').value;
  const practice = $('leaderboard-practice').value;
  try {
    const data = await getJson(`/api/leaderboard?by=${by}&practice=${practice}&limit=100`);
    const body = $('leaderboard-rows');
    body.replaceChildren();
    for (const r of data.rows) {
      body.append(fill(fromTemplate('template-leaderboard-row'), {
        'leaderboard-rank': r.rank,
        // Names are not unique: always show the wallet too, so a look-alike name cannot pass for someone else.
        'leaderboard-player-link': { href: `/profile.html?address=${r.address}`, text: r.displayName ? `${r.displayName} (${short(r.address)})` : short(r.address) },
        'leaderboard-matches': r.matches,
        'leaderboard-wins': r.wins,
        'leaderboard-losses': r.losses,
        'leaderboard-ties': r.ties,
        'leaderboard-best': r.bestPercent === null ? '-' : `${r.bestPercent}%`,
        'leaderboard-profit': `${sol(r.profit)} SOL`,
      }));
    }
    show('leaderboard-empty', data.rows.length === 0);
    setText('leaderboard-error', '');
  } catch (err) {
    setText('leaderboard-error', `Could not load the leaderboard: ${err.message}`);
  }
}
$('leaderboard-by').onchange = load;
$('leaderboard-practice').onchange = load;
load();
