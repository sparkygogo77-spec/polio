// The player card on the play page (index.html, player-card): the rank badge and the joined date.
// Plain functions (a server test imports this file).

/** Badge tiers by live wins (practice never counts as real wins): [tier, plain name, wins needed]. */
export const BADGE_TIERS = [
  ['diamond', 'Diamond', 40],
  ['gold', 'Gold', 15],
  ['silver', 'Silver', 5],
  ['bronze', 'Bronze', 1],
  ['rookie', 'Rookie', 0],
];

/**
 * The rank badge for a profile ({ stats, rank, practiceRank } as the server sends it):
 * { tier, name, rank } where rank is "#3" on the live leaderboard, "Practice #2" on the practice
 * board, or "Unranked".
 */
export function rankBadge(p) {
  const wins = Number(p?.stats?.wins ?? 0);
  const [tier, name] = BADGE_TIERS.find(([, , need]) => wins >= need);
  const rank = p?.rank ? `#${p.rank}` : p?.practiceRank ? `Practice #${p.practiceRank}` : 'Unranked';
  return { tier, name, rank };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A joined date as "2 Oct 2026" (UTC, the same in every browser), or "-" when unknown. */
export function joinedText(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '-';
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Largest picture a player may upload (the game server refuses bigger ones). */
export const MAX_PICTURE_BYTES = 2 * 1024 * 1024;
