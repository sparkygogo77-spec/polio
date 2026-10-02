// First-time intro tour (owner decision): a short step-by-step overlay shown when a player first
// arrives (and at Find a match only if it never showed), with Next, Back and Skip buttons and dots;
// closing it any way is remembered.
// The "How it works" link reopens it any time. The steps are written from the rules settings the
// server sends in its hello message (`rules`, built from the same settings the server plays by),
// so the numbers in them never go out of date. Shown once per stage per player: remembered in the
// browser (localStorage) and on the player's profile (the `intro_seen` message).
//
// tourSteps() and the seen-helpers are plain functions (a server test imports this file); Tour is
// the overlay itself and needs a page.

/** The two showings, as the server names them. */
export const INTRO_STAGES = ['arrival', 'first_match'];
export const STORAGE_KEY = 'ponsstars.introSeen';

const LAMPORTS_PER_SOL = 1_000_000_000n;

/** Lamports (string or bigint) as SOL text without trailing zeros: "250000000" -> "0.25". */
function solText(lamports) {
  const v = BigInt(lamports);
  const frac = (v % LAMPORTS_PER_SOL).toString().padStart(9, '0').replace(/0+$/, '');
  return `${v / LAMPORTS_PER_SOL}${frac ? '.' + frac : ''}`;
}

/** ["a", "b", "c"] -> "a, b or c". */
function orList(items) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`;
}

/** Basis points as a percentage: 250 -> "2.5%". */
function percentText(bps) {
  return `${Number(bps) / 100}%`;
}

/** Match lengths in plain words: [60000, 150000, 300000] -> "1, 2.5 or 5 minutes". */
function lengthsText(lengthsMs) {
  const mins = lengthsMs.map((ms) => ms / 60_000);
  if (mins.every((m) => m < 1)) return `${orList(lengthsMs.map((ms) => String(ms / 1000)))} seconds`;
  return `${orList(mins.map(String))} minute${mins.length === 1 && mins[0] === 1 ? '' : 's'}`;
}

/**
 * The tour's steps, worked out from the server's rules settings. `rules` is hello.rules
 * ({ stakes, lengthsMs, maxTrades, tradePercents, cutBps, startCountdownMs, budget, ... });
 * `extra` may add the contract's windows from hello ({ rematchWindowSecs, joinTimeoutSecs }).
 * Each step: { id, title, text, target } where target is the data-hook of the part of the page it
 * describes, or null when there is nothing on the page to point at.
 */
export function tourSteps(rules, extra = {}) {
  const stakes = rules.stakes.map((s) => solText(s));
  const cut = percentText(rules.cutBps);
  const countdownSecs = Math.round(rules.startCountdownMs / 1000);
  const shares = orList(rules.tradePercents.map((p) => `${p}%`));
  const budget = rules.budget === 'pot' ? 'the pot (scored, not spent)' : `${solText(rules.budget)} SOL (scored, not real money)`;
  // Worked example on the smallest stake: pot, cut and what the winner receives.
  const stake = BigInt(rules.stakes[0]);
  const pot = stake * 2n;
  const cutLamports = (pot * BigInt(rules.cutBps)) / 10_000n;
  const rematch = extra.rematchWindowSecs ? ` within ${extra.rematchWindowSecs} seconds` : '';
  const join = extra.joinTimeoutSecs ? ` If nobody joins within ${extra.joinTimeoutSecs} seconds, your stake comes back in full.` : '';
  return [
    {
      id: 'welcome',
      title: 'How PonsStars works',
      text: 'Two players trade the same coin for a few minutes. The bigger percentage gain wins the pot. Here is how a match goes, in a few short steps.',
      target: null,
    },
    {
      id: 'wallet',
      title: 'Connect a wallet',
      text: 'Connect a Solana wallet (or make a new one here). You sign in with it; nothing moves without your approval.',
      target: 'wallet-panel',
    },
    {
      id: 'deposit',
      title: 'Deposit once, play many matches',
      text: 'Deposit SOL into your PonsStars balance. One balance is kept across matches: stakes come out of it, winnings go back into it, and you can withdraw whatever is not in a match.',
      target: 'balance-panel',
    },
    {
      id: 'queue',
      title: 'Pick a stake and a length',
      text: `Stakes are ${orList(stakes)} SOL each, and a match lasts ${lengthsText(rules.lengthsMs)}. You play someone who picked the same.${join}`,
      target: 'queue-panel',
    },
    {
      id: 'coin',
      title: 'The same hidden coin for both',
      text: `Both players get the same coin. It stays hidden until the end, so nobody can look it up: its price is shown as an index from 100 (101 means 1% higher). Trading opens after a ${countdownSecs}-second countdown.`,
      target: 'chart-area',
    },
    {
      id: 'trade',
      title: 'Trade with the Buy and Sell rows',
      text: `Buy ${shares} spends that share of your remaining cash; Sell sells that share of your coins. Each press is one trade, at most ${rules.maxTrades} per match, and fills at once at the latest price.`,
      target: 'trade-panel',
    },
    {
      id: 'winning',
      title: 'Highest percent gain wins',
      text: `You each trade a budget of ${budget}. Whoever ends with the higher percentage gain wins: the scoreboard shows both, and your circle grows or shrinks with yours. Anything you still hold is sold at the bell, at the closing price. Making no trades counts as a loss.`,
      target: 'scoreboard',
    },
    {
      id: 'refunds',
      title: 'When stakes come back',
      text: `If neither player trades, or it is a tie and you do not both accept a rematch${rematch}, both stakes come back minus the ${cut} cut. If the server cannot run the match fairly (for example the price feed fails), the match is void and both stakes come back in full, no cut.`,
      target: null,
    },
    {
      id: 'payout',
      title: 'Winner takes the pot',
      text: `The winner gets both stakes minus ${cut}: with ${solText(stake)} SOL each, that is ${solText(pot - cutLamports)} SOL. The contract pays it into your balance within seconds of the end.`,
      target: null,
    },
    {
      id: 'disconnect',
      title: 'If you lose connection',
      text: 'The match carries on and your position stays open. Come back to keep trading; anything still open is sold at the bell like everyone else\'s.',
      target: null,
    },
  ];
}

/** The stages this browser has seen. Storage can be missing or blocked: then nothing is seen. */
export function seenStages(storage) {
  try {
    const v = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((s) => INTRO_STAGES.includes(s)) : [];
  } catch {
    return [];
  }
}

/** Remember in this browser that `stages` were seen. */
export function rememberSeen(storage, stages) {
  const next = [...new Set([...seenStages(storage), ...stages.filter((s) => INTRO_STAGES.includes(s))])];
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the profile still remembers it once signed in */
  }
  return next;
}

/** Should the tour show at `stage`? Not if this browser or the player's profile has seen it. */
export function shouldShow(stage, { local = [], profile = [] } = {}) {
  return INTRO_STAGES.includes(stage) && !local.includes(stage) && !profile.includes(stage);
}

/**
 * The overlay. `root` is the element with data-hook="tour"; `find(hook)` returns the page element
 * with that hook. Callbacks: onClose({ stage, completed }) after Done, Skip or Escape;
 * onStep({ index, step }) on every step shown (also as the "pons:tour" event on the root).
 */
export class Tour {
  constructor({ root, find, onClose = () => {}, onStep = () => {} }) {
    this.root = root;
    this.find = find;
    this.onClose = onClose;
    this.onStep = onStep;
    this.steps = [];
    this.index = 0;
    this.stage = null;
    this.doneLabel = 'Done';
    this.returnFocus = null;
    this.el = (hook) => root.querySelector(`[data-hook="${hook}"]`);
    this.el('tour-next').onclick = () => this.next();
    this.el('tour-back').onclick = () => this.back();
    this.el('tour-skip').onclick = () => this.close(false);
    this.onKey = (e) => this.key(e);
    this.onMove = () => this.placeHighlight();
  }

  get isOpen() {
    return !this.root.hidden;
  }

  /** Open at the first step. `stage` is 'arrival', 'first_match' or null (opened from the link). */
  open(steps, { stage = null, doneLabel = 'Done' } = {}) {
    this.steps = steps;
    this.stage = stage;
    this.doneLabel = doneLabel;
    this.returnFocus = document.activeElement;
    // One dot per step, in the page's markup (tour-dot-<step id>).
    steps.forEach((s, i) => {
      const b = this.el(`tour-dot-${s.id}`); // hooks: tour-dot-{welcome,wallet,deposit,queue,coin,trade,winning,refunds,payout,disconnect}
      if (!b) return;
      b.dataset.step = s.id;
      b.setAttribute('aria-label', `Step ${i + 1}: ${s.title}`);
      b.onclick = () => this.show(i);
    });
    this.root.dataset.stage = stage ?? 'link';
    this.root.hidden = false;
    document.addEventListener('keydown', this.onKey, true);
    window.addEventListener('resize', this.onMove);
    window.addEventListener('scroll', this.onMove, true);
    this.emit('open', { stage: this.root.dataset.stage, steps: steps.map((s) => s.id) });
    this.show(0);
  }

  show(i) {
    this.index = Math.max(0, Math.min(i, this.steps.length - 1));
    const step = this.steps[this.index];
    const last = this.index === this.steps.length - 1;
    this.root.dataset.step = step.id;
    this.el('tour-title').textContent = step.title;
    this.el('tour-text').textContent = step.text;
    this.el('tour-progress').textContent = `Step ${this.index + 1} of ${this.steps.length}`;
    this.el('tour-back').disabled = this.index === 0;
    this.el('tour-next').textContent = last ? this.doneLabel : 'Next';
    this.el('tour-next').dataset.last = String(last);
    for (const s of this.steps) {
      const d = this.el(`tour-dot-${s.id}`); // hooks: tour-dot-{welcome,wallet,deposit,queue,coin,trade,winning,refunds,payout,disconnect}
      if (!d) continue;
      const current = s.id === step.id;
      d.dataset.current = String(current);
      if (current) d.setAttribute('aria-current', 'step');
      else d.removeAttribute('aria-current');
    }
    const target = this.targetElement(step);
    if (target) target.scrollIntoView({ block: 'center', inline: 'nearest' });
    this.placeHighlight();
    this.el('tour-next').focus();
    this.onStep({ index: this.index, step });
    this.emit('step', { index: this.index, id: step.id, target: target ? step.target : null });
  }

  next() {
    if (this.index < this.steps.length - 1) this.show(this.index + 1);
    else this.close(true);
  }

  back() {
    if (this.index > 0) this.show(this.index - 1);
  }

  /** Close the tour. `completed` is true after the last step's button, false after Skip or Escape. */
  close(completed) {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.el('tour-highlight').hidden = true;
    document.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('resize', this.onMove);
    window.removeEventListener('scroll', this.onMove, true);
    const stage = this.stage;
    this.emit('close', { stage: stage ?? 'link', completed });
    this.returnFocus?.focus?.();
    this.onClose({ stage, completed });
  }

  /** Arrows move between steps, Escape skips; Tab stays inside the tour. */
  key(e) {
    if (!this.isOpen) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.back();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.close(false);
    } else if (e.key === 'Tab') {
      const focusable = [...this.el('tour-card').querySelectorAll('button:not([disabled])')];
      const i = focusable.indexOf(document.activeElement);
      if (i === -1 || (e.shiftKey && i === 0) || (!e.shiftKey && i === focusable.length - 1)) {
        e.preventDefault();
        (e.shiftKey ? focusable.at(-1) : focusable[0])?.focus();
      }
    }
  }

  /** The page part a step points at, if it is on screen (shown, with a size). */
  targetElement(step) {
    if (!step?.target) return null;
    const t = this.find(step.target); // hooks: wallet-panel, balance-panel, queue-panel, chart-area, trade-panel, scoreboard
    if (!t || t.closest('[hidden]') || t.getClientRects().length === 0) return null;
    const r = t.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? t : null;
  }

  /** Draw the highlight box over the target and put the card where it does not cover it. */
  placeHighlight() {
    if (!this.isOpen) return;
    const box = this.el('tour-highlight');
    const card = this.el('tour-card');
    const step = this.steps[this.index];
    const t = this.targetElement(step);
    this.root.dataset.highlight = t ? step.target : '';
    if (!t) {
      box.hidden = true;
      card.dataset.place = 'center';
      return;
    }
    const r = t.getBoundingClientRect();
    const pad = 6;
    box.style.setProperty('--pons-tour-box-top', `${r.top - pad}px`);
    box.style.setProperty('--pons-tour-box-left', `${r.left - pad}px`);
    box.style.setProperty('--pons-tour-box-width', `${r.width + 2 * pad}px`);
    box.style.setProperty('--pons-tour-box-height', `${r.height + 2 * pad}px`);
    box.dataset.target = step.target;
    box.hidden = false;
    // Card at the bottom unless the target's middle is in the lower half of the window.
    card.dataset.place = r.top + r.height / 2 > window.innerHeight / 2 ? 'top' : 'bottom';
  }

  emit(name, detail) {
    this.root.dispatchEvent(new CustomEvent('pons:tour', { detail: { name, ...detail } }));
  }
}
