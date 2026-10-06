// Buy and sell grid: two rows of amount buttons (buy, sell; or any two opposite actions). Each
// button has a shortcut key, a key slot the builder edits, shown in its own -key child. A press
// or a click calls onAction({ action, amount }) while the grid is live, and plays the click sound.
// States: idle (buttons wait), live, done.
import { hook, setState, stateOf } from '../js/hooks.js';
import { parseKey, token } from './slots.js';
import { play } from './sound.js';

// Button hook -> its key slot token. kit-check reads these names, so they stay written out.
const KEYS = {
  'buy-10-button': '--key-buy-10', 'buy-25-button': '--key-buy-25', 'buy-50-button': '--key-buy-50', 'buy-100-button': '--key-buy-100',
  'sell-10-button': '--key-sell-10', 'sell-25-button': '--key-sell-25', 'sell-50-button': '--key-sell-50', 'sell-100-button': '--key-sell-100',
};

export function setUpActionGrid(onAction) {
  const byKey = new Map();
  for (const [name, slot] of Object.entries(KEYS)) {
    const button = hook(name); // hooks: {buy,sell}-{10,25,50,100}-button
    const key = parseKey(token(slot)) ?? '';
    hook(`${name.replace(/-button$/, '')}-key`).textContent = key; // hooks: {buy,sell}-{10,25,50,100}-key
    if (key) byKey.set(key.toLowerCase(), button);
    button.addEventListener('click', () => fire(button));
  }
  function fire(button) {
    if (stateOf('action-grid') !== 'live') return;
    play('--action-grid-sound');
    onAction({ action: button.dataset.action, amount: Number(button.dataset.amount) });
  }
  document.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || /^(input|textarea|select)$/i.test(e.target.tagName)) return;
    const button = byKey.get(e.key.toLowerCase());
    if (button) { e.preventDefault(); fire(button); }
  });
}

/** idle, live or done: only a live grid takes presses. */
export function actionGridState(state) {
  setState('action-grid', state);
  for (const name of Object.keys(KEYS)) hook(name).disabled = state !== 'live'; // hooks: {buy,sell}-{10,25,50,100}-button
}
