// The one setting for where the game server is.
// Empty: the game server is this same site (it serves these pages itself, as in development).
// When these pages are hosted somewhere else (Vercel), this is the game server's address, for
// example 'https://ponsstars-game-server.onrender.com'. On Vercel the build writes this file from
// the GAME_SERVER_URL setting (scripts/write-web-config.mjs), so it is changed there, not here.
export const GAME_SERVER_URL = '';
