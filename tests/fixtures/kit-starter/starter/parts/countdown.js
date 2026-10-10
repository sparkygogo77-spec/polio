// Countdown: minutes and seconds to zero. In the last seconds (the warn-at slot) it turns to its
// warning state and ticks (the tick sound slot); at zero it is done and calls onDone.
// States: idle (not started), live, warning, done.
import { hook, setState } from '../js/hooks.js';
import { token } from './slots.js';
import { play } from './sound.js';

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Shows a time without running (for a still page or a preview). */
export function showCountdown(seconds, state) {
  hook('countdown-time').textContent = clock(Math.max(0, Math.ceil(seconds)));
  setState('countdown', state);
}

/** Counts down from seconds; returns a stop function. */
export function startCountdown(seconds, onDone = () => {}) {
  const warnAt = Number(token('--countdown-warn-at')) || 10;
  const end = Date.now() + seconds * 1000;
  let shown = -1;
  const step = () => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    if (left === shown) return;
    shown = left;
    const state = left === 0 ? 'done' : left <= warnAt ? 'warning' : 'live';
    showCountdown(left, state);
    if (state === 'warning') play('--countdown-tick-sound');
    if (state === 'done') { clearInterval(timer); onDone(); }
  };
  const timer = setInterval(step, 200);
  step();
  return () => clearInterval(timer);
}
