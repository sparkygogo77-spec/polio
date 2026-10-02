import { $, fill, fromTemplate, getJson, ppmToPercent, serverUrl, setText, short, show, sol } from './common.js';
import { avatarUrl } from './avatars.js';

async function load(address) {
  setText('profile-error', '');
  try {
    const [p, h] = await Promise.all([getJson(`/api/profiles/${address}`), getJson(`/api/profiles/${address}/matches`)]);
    show('profile-card', true);
    setText('profile-card-name', p.displayName ?? short(p.address));
    setText('profile-card-address', p.address);
    const img = $('profile-card-picture');
    img.hidden = false;
    img.src = avatarUrl({ address: p.address, pictureUrl: p.pictureUrl, avatarPreset: p.avatarPreset, bot: p.bot === true }, serverUrl);
    const ps = p.practiceStats;
    setText('stat-matches', ps.matches);
    setText('stat-wins', ps.wins);
    setText('stat-losses', ps.losses);
    setText('stat-ties', ps.ties);
    setText('stat-profit', sol(ps.profit));
    const ls = p.stats;
    setText('live-stat-matches', ls.matches);
    setText('live-stat-wins', ls.wins);
    setText('live-stat-losses', ls.losses);
    setText('live-stat-ties', ls.ties);
    setText('live-stat-profit', sol(ls.profit));
    setText('stat-nocontest', p.practiceStats.noContest);
    setText('stat-best', p.practiceStats.bestPercent ?? '-');
    const body = $('history-rows');
    body.replaceChildren();
    for (const e of h.matches) {
      body.append(fill(fromTemplate('template-history-row'), {
        'history-when': e.at ? new Date(e.at).toLocaleString() : '-',
        'history-result': e.result.replace('_', ' '),
        'history-why': e.reason.replaceAll('_', ' '),
        'history-opponent-link': { href: `/profile.html?address=${e.opponent}`, text: short(e.opponent) },
        'history-stake': `${sol(e.stake)} SOL`,
        'history-best': e.bestPpm === null ? '-' : `${ppmToPercent(e.bestPpm)}%`,
        'history-profit': `${sol(e.profit)} SOL`,
        'history-practice': e.practice ? 'practice' : 'live',
        'history-link': { href: `/match.html?id=${e.matchAccount}` },
      }));
    }
    show('history-empty', h.matches.length === 0);
  } catch (err) {
    show('profile-card', false);
    setText('profile-error', `Could not load that profile: ${err.message}`);
  }
}

$('profile-lookup').onsubmit = (e) => {
  e.preventDefault();
  const a = $('profile-lookup-address').value.trim();
  history.replaceState(null, '', `?address=${encodeURIComponent(a)}`);
  load(a);
};
const start = new URLSearchParams(location.search).get('address');
if (start) {
  $('profile-lookup-address').value = start;
  load(start);
}
