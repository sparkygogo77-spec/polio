// Where the game server is, worked out from the one setting in config.js. Shared by every page.
import { GAME_SERVER_URL } from './config.js';

/**
 * The game server's base address ("https://host[:port]", no trailing slash), or null when the
 * setting is not a usable http(s) address. Empty setting: the page's own site.
 */
export function serverBase(configured = GAME_SERVER_URL, pageOrigin = globalThis.location?.origin ?? '') {
  const value = String(configured ?? '').trim();
  if (!value) return pageOrigin.replace(/\/+$/, '');
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

/** A path on the game server ("/api/leaderboard") as a full address; null if the setting is unusable. */
export function serverUrl(path, base = serverBase()) {
  return base === null ? null : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** The game server's live connection (websocket) address; null if the setting is unusable. */
export function websocketUrl(base = serverBase()) {
  return base === null ? null : `${base.replace(/^http/, 'ws')}/ws`;
}

/** True when the game server is a different site from this page (hosted apart, e.g. on Vercel). */
export function serverIsElsewhere(base = serverBase(), pageOrigin = globalThis.location?.origin ?? '') {
  return base !== null && base !== pageOrigin.replace(/\/+$/, '');
}

export const OFFLINE_NOTE =
  'Game server offline: it cannot be reached right now. You can still read how it works; signing in, ' +
  'balances and matches come back as soon as the game server is running again.';
