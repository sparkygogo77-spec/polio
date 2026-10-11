// TV screen: a frame round anything that plays (a chart, a video, a feed), with a glow, static
// while it loads, and two knobs. The volume knob turns the page's sound (sound.js) through
// off, half and full; the channel knob calls onChannel.
// States: idle (nothing on), loading (static), live, error.
import { hook, setState } from '../js/hooks.js';
import { setVolume, volume } from './sound.js';

export function setUpScreen(onChannel = () => {}) {
  const knob = hook('screen-knob-volume');
  const show = () => { knob.dataset.level = volume() === 0 ? 'off' : volume() < 1 ? 'half' : 'full'; };
  knob.addEventListener('click', () => { setVolume(volume() === 0 ? 0.5 : volume() < 1 ? 1 : 0); show(); });
  hook('screen-knob-channel').addEventListener('click', () => onChannel());
  show();
}

/** idle, loading, live or error; message is the line idle and error show. */
export function screenState(state, message) {
  if (message !== undefined) hook('screen-message').textContent = message;
  setState('screen', state);
}
