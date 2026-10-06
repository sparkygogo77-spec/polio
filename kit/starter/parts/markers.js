// Duel circles: two markers (yours and theirs) placed over a chart or a field by position, plus a
// level line (a break-even or target line) across it. Positions are 0 to 100 (percent of the
// field); scripts set them as position variables (BUILDER-RULES.md, rule 9). The circles' size, the
// line's look and the colours are slots and tokens, never script values.
// States: idle (no markers), live.
import { hook, setState } from '../js/hooks.js';

const pct = (v) => `${Math.max(0, Math.min(100, v))}%`;

/** a and b: { x, y } in percent; level: the line's y in percent. */
export function placeMarkers(a, b, level) {
  const field = hook('markers');
  field.style.setProperty('--marker-a-x', pct(a.x));
  field.style.setProperty('--marker-a-y', pct(a.y));
  field.style.setProperty('--marker-b-x', pct(b.x));
  field.style.setProperty('--marker-b-y', pct(b.y));
  field.style.setProperty('--markers-level-y', pct(level));
  setState('markers', 'live');
}

export const clearMarkers = () => setState('markers', 'idle');
