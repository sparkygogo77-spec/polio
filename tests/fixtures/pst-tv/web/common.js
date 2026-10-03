// Small helpers shared by the profile, match and leaderboard pages.
import { OFFLINE_NOTE, serverUrl } from './server-url.js';
import { $, setText } from './dom.js';

export { serverUrl };
export { $, drop, fill, fromTemplate, setText, show } from './dom.js';

// Design preview (web/preview.html): ?preview=<variant> reads sample answers instead (web/preview-data.js).
const PREVIEW = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('preview') : null;

/** Show the page's "game server offline" note (every page has one). */
export function showOffline(text = OFFLINE_NOTE) {
  const el = $('server-offline');
  if (!el) return;
  setText('server-offline-text', text);
  el.hidden = false;
  document.body.dataset.server = 'offline';
}

/**
 * JSON from the game server (`path` like "/api/leaderboard"). When no game server answers, or what
 * answers is not the game server (a static host's own "not found" page), the offline note is shown
 * and the error says "game server offline".
 */
export async function getJson(path) {
  // Design preview (web/preview.html, ?preview in the address): sample data, no game server.
  if (PREVIEW === 'offline') {
    showOffline();
    throw new Error('game server offline');
  }
  if (PREVIEW === 'missing') throw new Error('404 Not Found');
  if (PREVIEW) return (await import('./preview-data.js')).sampleJson(path, PREVIEW);
  const url = serverUrl(path);
  let res;
  try {
    if (url === null) throw new Error('unusable game server address');
    res = await fetch(url);
  } catch {
    showOffline();
    throw new Error('game server offline');
  }
  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  if (!isJson) {
    showOffline();
    throw new Error('game server offline');
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/** Lamports (string or bigint) to SOL text, with a sign. */
export function sol(lamports) {
  if (lamports === null || lamports === undefined) return '-';
  const v = BigInt(lamports);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const frac = (abs % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${abs / 1_000_000_000n}${frac ? '.' + frac : ''}`;
}

export const short = (addr) => (addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '-');

export const ppmToPercent = (ppm) => {
  if (ppm === null || ppm === undefined) return '-';
  const v = BigInt(ppm);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  return `${neg ? '-' : ''}${abs / 10_000n}.${(abs % 10_000n).toString().padStart(4, '0')}`;
};

/** Find the signed-in player's address from the page address (?address=) or the play page's test wallet. */
export function addressFromPage() {
  return new URLSearchParams(location.search).get('address');
}
