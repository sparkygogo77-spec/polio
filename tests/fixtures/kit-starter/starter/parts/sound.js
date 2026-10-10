// Plays a sound slot (see slots.js). One volume for the whole page, which a volume knob can turn.
import { parseSound, token } from './slots.js';

let master = 1;
let audio = null;

/** The page's volume, 0 to 1: every sound slot plays at its own volume times this. */
export function setVolume(v) { master = Math.max(0, Math.min(1, v)); }
export const volume = () => master;

/** Plays the sound a slot token names, if any. Browsers allow sound only after a click or key. */
export function play(name) {
  const s = parseSound(token(name));
  if (!s || s.kind === 'none' || master === 0 || document.documentElement.hasAttribute('data-still')) return;
  if (s.kind === 'file') {
    const a = new Audio(s.src);
    a.volume = s.volume * master;
    a.play().catch(() => {});
    return;
  }
  audio ??= new AudioContext();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = s.hz;
  gain.gain.setValueAtTime(s.volume * master * 0.3, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.12);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.12);
}
