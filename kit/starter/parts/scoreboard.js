// Scoreboard: one row per player (or team), drawn from template-scoreboard-row. The leader's row
// carries data-lead; each score carries data-sign (up, down, flat) for colour by sign.
// States: idle (waiting for players), live, done (final scores).
import { fromTemplate, hook, part, setState } from '../js/hooks.js';
import { formatNumber, token } from './slots.js';

/** rows: [{ name, score }]. The highest score leads; a tie has no leader. */
export function drawScoreboard(rows) {
  const top = Math.max(...rows.map((r) => r.score));
  const leaders = rows.filter((r) => r.score === top).length;
  const copies = rows.map((r) => {
    const copy = fromTemplate('template-scoreboard-row');
    part(copy, 'scoreboard-name').textContent = r.name;
    const score = formatNumber(r.score, token('--scoreboard-format'));
    const cell = part(copy, 'scoreboard-score');
    cell.textContent = score.text;
    cell.dataset.sign = score.sign;
    copy.toggleAttribute('data-lead', leaders === 1 && r.score === top);
    return copy;
  });
  hook('scoreboard-rows').replaceChildren(...copies);
}

/** idle, live or done. */
export const scoreboardState = (state) => setState('scoreboard', state);
