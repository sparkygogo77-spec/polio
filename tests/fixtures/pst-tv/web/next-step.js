// The "next step" box at the top of the play page: one plain sentence about where the player is,
// and one obvious button for what to do next. Also turns the server's short refusal reasons into
// plain words with the button that fixes them. Plain functions (a server test imports this file).

/**
 * What to show now. `s`: { offline, wallet, signedIn, practice, balance, minStake, queue, match,
 * botAfterSecs, rematch } where balance is the server's last balance message (or null), queue is null or the
 * last queue status ('opening', 'joining', 'waiting'), match is null, 'live' or 'result'.
 * Returns { id, text, action, label } (action null: nothing to press).
 */
export function nextStep(s) {
  const sol = (l) => formatSol(l);
  if (s.offline) {
    return { id: 'offline', text: 'The game server is waking up or offline. This page connects by itself as soon as it answers (the first visit after a quiet spell can take about a minute).', action: 'reconnect', label: 'Try again now' };
  }
  if (!s.wallet) {
    return { id: 'wallet', text: 'Start by connecting a wallet. Quickest: a test wallet made in this browser, no extension needed.', action: 'connect-test', label: 'Use a test wallet' };
  }
  if (!s.signedIn) {
    return { id: 'sign-in', text: 'Sign in with your wallet. It is only a signature: no money moves.', action: 'sign-in', label: 'Sign in' };
  }
  if (s.rematch === 'answered') {
    return { id: 'rematch-wait', text: 'You accepted the rematch. Waiting for your opponent to answer.', action: null, label: '' };
  }
  if (s.rematch) {
    return { id: 'rematch', text: 'It is a tie. A rematch is played on a new coin if both players accept in time; otherwise both stakes come back minus the 2.5% cut.', action: 'rematch-accept', label: 'Accept the rematch' };
  }
  if (s.match === 'live') {
    return { id: 'match', text: 'Your match is on. Trade with the Buy and Sell rows next to the chart.', action: 'go-to-match', label: 'Go to the match' };
  }
  if (s.match === 'result') {
    return { id: 'result', text: 'The match is over. The result and the coin you played are below.', action: 'play-again', label: 'Play again' };
  }
  if (s.queue === 'waiting') {
    const bot = s.practice && s.botAfterSecs ? ` If nobody joins within ${s.botAfterSecs} seconds, a practice bot (not a person) plays you.` : '';
    return { id: 'waiting', text: `Waiting for an opponent.${bot}`, action: 'leave-queue', label: 'Leave the queue' };
  }
  if (s.queue === 'opening' || s.queue === 'joining') {
    return { id: 'queueing', text: 'Putting you in the queue…', action: null, label: '' };
  }
  const b = s.balance;
  const available = b && b.available !== null && b.available !== undefined ? BigInt(b.available) : null;
  const enough = available !== null && available >= BigInt(s.minStake ?? 0);
  if (s.practice) {
    if (!b || !b.exists || !enough) {
      return { id: 'play-money', text: 'You need play money to play. It is free and not real money.', action: 'play-money', label: 'Get play money' };
    }
    return { id: 'ready', text: `You have ${sol(available)} SOL of play money (not real). Pick a stake and a length, then find a match.`, action: 'find-match', label: 'Find a match' };
  }
  if (!b || !b.exists) {
    return { id: 'create-balance', text: 'Create your escrow balance, then deposit test SOL into it (devnet only, not real money).', action: 'create-balance', label: 'Create balance' };
  }
  if (!enough) {
    return { id: 'deposit', text: 'Deposit test SOL into your escrow balance to cover a stake.', action: 'deposit', label: 'Deposit' };
  }
  return { id: 'ready', text: `You have ${sol(available)} SOL in your escrow balance. Pick a stake and a length, then find a match.`, action: 'find-match', label: 'Find a match' };
}

/** A queue refusal from the server, in plain words, with the one button that fixes it. */
export function explainRefusal(reason, { practice = false } = {}) {
  const r = String(reason ?? '');
  if (/create your escrow balance/.test(r)) {
    return practice
      ? { text: 'Your play money is not there yet.', action: 'play-money', label: 'Get play money' }
      : { text: 'You need an escrow balance with test SOL in it first.', action: 'create-balance', label: 'Create balance' };
  }
  if (/balance too low/.test(r)) {
    return practice
      ? { text: 'Not enough play money left for this stake.', action: 'play-money', label: 'Get play money' }
      : { text: 'Your escrow balance is too low for this stake. Deposit more or pick a smaller stake.', action: 'deposit', label: 'Deposit' };
  }
  if (/locked in a match/.test(r)) return { text: 'Your last match is still being settled. Try again in a few seconds.', action: 'find-match', label: 'Try again' };
  if (/already in a queue/.test(r)) return { text: 'You are already waiting for an opponent.', action: 'leave-queue', label: 'Leave the queue' };
  if (/already in a match/.test(r)) return { text: 'You are already in a match.', action: 'go-to-match', label: 'Go to the match' };
  if (/declined|timed out/.test(r)) return { text: 'Your wallet did not approve it in time, so nothing happened.', action: 'find-match', label: 'Try again' };
  if (/sign in/.test(r)) return { text: 'Sign in first.', action: 'sign-in', label: 'Sign in' };
  if (/no-trade rule/.test(r)) return { text: 'Tick "I understand" under the rules, then queue.', action: 'find-match', label: 'Find a match' };
  if (/not offered/.test(r)) return { text: 'That stake or length is not offered. Pick one from the lists.', action: 'find-match', label: 'Find a match' };
  return { text: `That did not work: ${r || 'unknown reason'}.`, action: 'find-match', label: 'Try again' };
}

/** A refused trade press, in plain words. */
export function explainOrderRefusal(reason) {
  const r = String(reason ?? '');
  const limit = /trade limit reached \((\d+)\)/.exec(r);
  if (limit) return `All ${limit[1]} trades are used.`;
  if (/not started/.test(r)) return 'Trading opens when the countdown ends.';
  if (/ended|over/.test(r)) return 'The match is over.';
  if (/not in a match/.test(r)) return 'You are not in a match.';
  if (/no round is running/.test(r)) return 'No round is running right now.';
  if (/no fresh price/.test(r)) return 'No fresh price came in time, so that trade did not go through and nothing was spent. Try again.';
  if (/trade buttons/.test(r)) return 'Use one of the Buy or Sell buttons.';
  if (/nothing to sell|no coins|position/.test(r)) return 'You have no coins to sell.';
  if (/no cash|nothing to buy/.test(r)) return 'You have no cash left to buy with.';
  return `That trade did not go through: ${r || 'unknown reason'}.`;
}

/** A sign-in that failed, in plain words. */
export function explainSignIn(reason) {
  const r = String(reason ?? '');
  if (/expired/.test(r)) return 'The sign-in request ran out of time. Sign in again.';
  if (/domain|site/.test(r)) return 'This site is not one the game server accepts sign-ins from.';
  return `Sign-in did not work: ${r || 'unknown reason'}.`;
}

function formatSol(lamports) {
  const v = BigInt(lamports);
  const frac = (v % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  return `${v / 1_000_000_000n}${frac ? '.' + frac : ''}`;
}
