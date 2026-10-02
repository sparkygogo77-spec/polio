// Play page. Plain JavaScript, no build step. Elements are found only by data-hook (see HOOKS.md).
import { base58Encode, checkSignRequest, fromBase64, randomHex, signInFields, signInText, sol, toLamports } from './protocol.js';
import { connectStandardWallet, discoverWallets } from './wallets.js';
import { generateMnemonic, walletFromMnemonic } from './newwallet.js';
import { CandlestickSeries, createChart, createSeriesMarkers } from './vendor/lightweight-charts/lightweight-charts.standalone.production.mjs';
import { candleColorsFrom, chartLayoutFrom, countdownText, duelSettingsFrom, duelView, markerLabel, overlayText, positionText, startBars, toChartBar, tradeColorsFrom, tradeMarkers } from './overlay.js';
import { emit } from './anim.js';
import { buttonStates, TRADE_BUTTONS, TRADE_PERCENTS } from './trade.js';
import { referenceEmbedUrl, referenceLabel } from './reference.js';
import { rememberSeen, seenStages, shouldShow, Tour, tourSteps } from './tour.js';
import { OFFLINE_NOTE, serverUrl, websocketUrl } from './server-url.js';
import { DEFAULT_RULES } from './rules.js';
import { seedCommit } from './generated-chart.js';
import { AVATAR_PRESETS, avatarUrl, pictureMarkers, presetAvatar } from './avatars.js';
import { keepDrawingInBackground, remeasure } from './background-frames.js';
import { $, cssNumber, cssVar, fill, fromTemplate, setText, show } from './dom.js';
import { ATTRACT_FIRST, attractBars, channelText, CONNECTED_HOLD_MS, GIVE_UP_MS, loadingView, stepMarks, tvState } from './tv.js';

import { explainOrderRefusal, explainRefusal, explainSignIn, nextStep } from './next-step.js';


// Design preview (web/preview.html): with ?preview=<screen> this page replays recorded sample
// messages through the same handlers as live ones, with the clock stopped. It opens no connection,
// sends nothing and stores nothing (web/preview-data.js says which messages make which screen).
const PREVIEW = new URLSearchParams(location.search).get('preview');
if (PREVIEW) keepDrawingInBackground(); // the preview may build this page in a background tab
/** House cut in basis points, from the server's rules settings (2.5% until the hello arrives). */
const cutBps = () => BigInt(state.hello?.rules?.cutBps ?? 250);

const state = {
  ws: null,
  hello: null,
  clockOffset: 0, // server time minus local time
  wallet: null, // { kind, name, address, sign(bytes), signTx(messageBytes) }
  signedIn: false,
  nonce: null, // current one-time sign-in challenge
  issuedUnix: null,
  match: null,
  queueTimeoutAt: null,
  pendingSign: null,
  intent: null, // what the player last asked for (every sign request is checked against it)
  balance: null,
  standardWallets: [],
  newWallet: null, // { address, sign } of a wallet created or restored in this tab
  profileIntro: null, // intro tour stages the signed-in player's profile has seen
  offline: false, // true while no game server can be reached
  frozenNow: null, // the design preview's stopped clock (milliseconds); null: the real clock
  queueStatus: null, // 'opening', 'joining' or 'waiting' while queued
  problem: null, // a refusal to explain in the next-step box: { text, action, label }
  connectFailures: 0,
  connectStartedAt: null, // when this run of connection attempts began (the TV's loading bar)
  connectedAt: null, // when the connection last opened
  serverUnusable: false, // the game server address set for the site cannot be used
};

function log(text) {
  const el = $('log');
  el.textContent = `${new Date().toLocaleTimeString()} ${text}\n` + el.textContent.slice(0, 20_000);
}

// ---------- intro tour ----------
// Shown on a player's first visit and again right before their first match; "How it works" reopens
// it. The steps come from the server's rules settings (hello.rules). Seen stages are remembered in
// this browser and, once signed in, on the player's profile.

const storage = PREVIEW ? null : (() => { try { return window.localStorage; } catch { return null; } })();
let afterTour = null;
const tour = new Tour({ root: $('tour'), find: (hook) => $(hook), onClose: tourClosed }); // hooks: tour, wallet-panel, balance-panel, queue-panel, chart-area, trade-panel, scoreboard

function introSeenBy() {
  return { local: seenStages(storage), profile: state.profileIntro ?? [] };
}

/** Open the tour (unless it is open, or the rules are not known yet). `stage` null: opened from the link. */
function openTour(stage, opts = {}) {
  if (tour.isOpen) return false;
  // The server's live settings; while no game server can be reached, the settings it ships with.
  const rules = state.hello?.rules ?? (state.offline ? DEFAULT_RULES : null);
  if (!rules) return false;
  const steps = tourSteps(rules, { rematchWindowSecs: state.hello?.rematchWindowSecs, joinTimeoutSecs: state.hello?.joinTimeoutSecs });
  tour.open(steps, { stage, ...opts });
  return true;
}

function tourClosed({ stage }) {
  // Closed any way (Skip, Escape or Done) when it opened by itself: remembered for this browser and
  // the profile, so it does not open by itself again, not even before the first match. "How it
  // works" still opens it on request.
  if (stage) for (const s of ['arrival', 'first_match']) markIntroSeen(s);
  if (location.hash === '#how-it-works') history.replaceState(null, '', location.pathname + location.search);
  const then = afterTour;
  afterTour = null;
  then?.();
}

function markIntroSeen(stage) {
  rememberSeen(storage, [stage]);
  if (state.signedIn && !(state.profileIntro ?? []).includes(stage)) send({ type: 'intro_seen', stage });
}

/** After sign-in: what either side has seen counts for both. */
function syncIntroSeen(profileSeen) {
  state.profileIntro = profileSeen ?? [];
  rememberSeen(storage, state.profileIntro);
  for (const stage of seenStages(storage)) if (!state.profileIntro.includes(stage)) send({ type: 'intro_seen', stage });
}

/** The first visit: the tour opens once the rules arrive (or whenever the page is opened at #how-it-works). */
function arrivalTour() {
  if (PREVIEW) return; // the preview opens the tour only on its tour screen
  const first = shouldShow('arrival', introSeenBy());
  if (first || location.hash === '#how-it-works') openTour(first ? 'arrival' : null);
}

/** "Find a match": before the player's first match the tour shows once more, then the queue goes on. */
function findMatch() {
  // Only for a player who has never had the tour (one who closed it on arrival has seen it).
  const seen = introSeenBy();
  if (shouldShow('first_match', seen) && shouldShow('arrival', seen) && openTour('first_match', { doneLabel: 'Continue to the match' })) {
    afterTour = openWarning;
    return;
  }
  openWarning();
}

// ---------- next step ----------
// One plain sentence about where the player is and one obvious button (web/next-step.js).

const LAST_WALLET_KEY = 'ponsstars.lastWallet';

function refreshNextStep() {
  const minStake = (state.hello?.rules?.stakes ?? state.hello?.stakes ?? ['0']).reduce((a, b) => (BigInt(b) < BigInt(a) ? b : a));
  const step = state.problem && !state.offline && state.signedIn && !state.match
    ? { id: 'problem', ...state.problem }
    : nextStep({
      offline: state.offline,
      wallet: !!state.wallet,
      signedIn: state.signedIn,
      practice: !!state.hello?.practice,
      botAfterSecs: state.hello?.practice ? Math.round(state.hello.practice.botJoinAfterMs / 1000) : null,
      balance: state.balance,
      minStake,
      queue: state.queueStatus,
      match: !state.match ? null : document.body.dataset.state === 'result' ? 'result' : 'live',
      rematch: state.rematchOpen,
    });
  $('next-step').dataset.step = step.id;
  setText('next-step-text', step.text);
  const button = $('next-step-button');
  button.hidden = !step.action;
  button.textContent = step.label || '';
  button.dataset.action = step.action ?? '';
  refreshTv();
}

function runNextStep(action) {
  state.problem = null;
  const go = (el) => el.scrollIntoView({ block: 'center' });
  switch (action) {
    case 'reconnect':
      if (!state.ws || state.ws.readyState === WebSocket.CLOSED) connect();
      break;
    case 'connect-test':
      void useWallet(testWallet);
      break;
    case 'sign-in':
      void signIn();
      break;
    case 'play-money':
      send({ type: 'play_money' });
      break;
    case 'create-balance':
      go($('balance-panel'));
      $('balance-create').click();
      break;
    case 'deposit':
      go($('deposit-panel'));
      $('deposit-amount').focus();
      break;
    case 'find-match':
      go($('queue-panel'));
      findMatch();
      break;
    case 'rematch-accept':
      $('rematch-accept').click();
      break;
    case 'leave-queue':
      $('queue-leave').click();
      break;
    case 'go-to-match':
      go($('chart-area'));
      break;
    case 'play-again':
      $('result-close').click();
      go($('queue-panel'));
      findMatch();
      break;
  }
  refreshNextStep();
}

// ---------- connection ----------

function connect() {
  if (PREVIEW) {
    void startPreview();
    return;
  }
  const url = websocketUrl();
  state.connectStartedAt ??= Date.now();
  if (!url) {
    state.serverUnusable = true;
    setOffline(true, 'Game server offline: the game server address set for this site (GAME_SERVER_URL) is not a usable http(s) address.');
    return;
  }
  let opened = false;
  let ws;
  try {
    ws = new WebSocket(url);
  } catch {
    setOffline(true);
    setTimeout(connect, 15_000);
    return;
  }
  state.ws = ws;
  setText('connection-status', state.offline ? 'offline, trying again' : 'connecting');
  ws.onopen = () => {
    opened = true;
    state.connectFailures = 0;
    state.connectStartedAt = null;
    state.connectedAt = Date.now();
    setOffline(false);
    setText('connection-status', 'connected');
    setTimeout(refreshTv, CONNECTED_HOLD_MS + 50); // "Connected" shows a moment, then the sample chart
  };
  ws.onclose = () => {
    state.signedIn = false;
    setText('wallet-signed-in', 'no');
    // A connection that worked and dropped: try again at once. One that never opened: the game
    // server is offline; say so plainly and keep trying, a little less often each time (up to 15 s).
    state.connectFailures = opened ? 0 : (state.connectFailures ?? 0) + 1;
    if (opened) {
      state.connectStartedAt = Date.now();
      state.connectedAt = null;
      refreshTv();
    }
    if (state.connectFailures > 0) setOffline(true);
    else setText('connection-status', 'disconnected, retrying');
    setTimeout(connect, Math.min(15_000, 2_000 * 2 ** Math.max(0, state.connectFailures - 1)));
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type !== 'tick') log(`<- ${ev.data.slice(0, 300)}`);
    handle(msg);
  };
}

/** Show or clear the "game server offline" note. The page keeps working for what needs no server. */
function setOffline(on, text = OFFLINE_NOTE) {
  const was = !!state.offline;
  state.offline = on;
  document.body.dataset.server = on ? 'offline' : 'online';
  setText('server-offline-text', text);
  show('server-offline', on);
  $('queue-join').disabled = on;
  if (on) setText('connection-status', 'offline, trying again');
  if (on && !was) arrivalTour(); // the intro tour works without a server, from the built-in settings
  refreshNextStep();
}

function send(msg) {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(msg));
    log(`-> ${JSON.stringify(msg).slice(0, 300)}`);
  }
}

const serverNow = () => (state.frozenNow ?? Date.now()) + state.clockOffset;

// ---------- wallets ----------

async function testWallet() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('ponsstars-test-wallet') || 'null'); } catch { /* none */ }
  let privateKey;
  let publicRaw;
  if (stored) {
    const pkcs8 = Uint8Array.from(atob(stored.pkcs8), (c) => c.charCodeAt(0));
    privateKey = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, true, ['sign']);
    publicRaw = Uint8Array.from(atob(stored.pub), (c) => c.charCodeAt(0));
  } else {
    const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    privateKey = kp.privateKey;
    publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
    try {
      localStorage.setItem('ponsstars-test-wallet', JSON.stringify({
        pkcs8: btoa(String.fromCharCode(...pkcs8)),
        pub: btoa(String.fromCharCode(...publicRaw)),
      }));
    } catch { /* storage blocked: wallet lasts for this page only */ }
  }
  const sign = async (bytes) => new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, bytes));
  // A Solana transaction signature is an Ed25519 signature over the message bytes.
  return { kind: 'test', name: 'test wallet', address: base58Encode(publicRaw), sign, signTx: sign };
}

function fromKeypair(kp, name) {
  return { kind: 'phrase', name, address: kp.address, sign: kp.sign, signTx: kp.sign };
}

function lastWasTestWallet() {
  try { return localStorage.getItem(LAST_WALLET_KEY) === 'test' && !!localStorage.getItem('ponsstars-test-wallet'); } catch { return false; }
}

async function useWallet(make) {
  try {
    if (!state.hello) throw new Error('not connected to the server yet');
    state.wallet = await make();
    try { localStorage.setItem(LAST_WALLET_KEY, make === testWallet ? 'test' : 'other'); } catch { /* storage blocked */ }
    setText('wallet-address', state.wallet.address);
    setText('wallet-name', `(${state.wallet.name})`);
    setText('wallet-message', '');
    await signIn();
  } catch (err) {
    setText('wallet-message', `Wallet: ${err.message}`);
    log(`wallet error: ${err.message}`);
  }
}

/**
 * Sign the server's one-time challenge with the wallet (proves ownership; cannot move funds).
 * The text names this site, the network and an expiry time ("Sign In With Solana" format).
 */
async function signIn() {
  if (!state.wallet || !state.nonce || !state.hello?.signIn) return;
  const fields = signInFields({
    origin: location.origin,
    address: state.wallet.address,
    chainId: state.hello.signIn.chainId,
    statement: state.hello.signIn.statement,
    nonce: state.nonce,
    issuedUnix: state.issuedUnix,
  });
  let message;
  let sig;
  if (state.wallet.signIn) {
    ({ message, signature: sig } = await state.wallet.signIn(fields));
  } else {
    message = signInText(fields);
    sig = await state.wallet.sign(new TextEncoder().encode(message));
  }
  send({ type: 'auth', player: state.wallet.address, message, signature: base58Encode(sig) });
}

function renderWalletList(list) {
  state.standardWallets = list;
  const box = $('wallet-list');
  box.replaceChildren();
  for (const w of list) {
    const b = fill(fromTemplate('template-wallet-option'), { 'wallet-option': `Connect ${w.name}` });
    b.dataset.walletName = w.name;
    b.onclick = () => useWallet(() => connectStandardWallet(w, state.hello.network));
    box.append(b);
  }
  show('wallet-none-found', list.length === 0);
}

// ---------- new wallet (made in this browser; nothing sent to the server) ----------

let shownPhrase = null;

/** Take the secret phrase off the page and drop the page's reference to it. */
function forgetShownPhrase() {
  setText('newwallet-phrase', '');
  shownPhrase = null;
  show('newwallet-step-phrase', false);
}

async function createNewWallet() {
  try {
    forgetShownPhrase();
    shownPhrase = await generateMnemonic(12);
    state.newWallet = fromKeypair(await walletFromMnemonic(shownPhrase), 'new PonsStars wallet');
    setText('newwallet-phrase', shownPhrase);
    show('newwallet-step-warn', false);
    show('newwallet-step-phrase', true);
  } catch (err) {
    setText('newwallet-message', err.message);
  }
}

function phraseWrittenDown() {
  // The phrase is shown once: clear it from the page and from memory.
  forgetShownPhrase();
  show('newwallet-step-ready', true);
  setText('newwallet-address', state.newWallet.address);
  setText('newwallet-message', 'The phrase is hidden now and was never sent anywhere. Fund the wallet, then switch to it.');
}

async function restoreFromPhrase() {
  const input = $('newwallet-restore-phrase');
  try {
    state.newWallet = fromKeypair(await walletFromMnemonic(input.value), 'PonsStars wallet (from phrase)');
    input.value = '';
    show('newwallet-step-warn', false);
    show('newwallet-step-ready', true);
    setText('newwallet-address', state.newWallet.address);
    setText('newwallet-message', 'Wallet restored in this tab only.');
  } catch (err) {
    setText('newwallet-message', err.message);
  }
}

function fundNewWallet() {
  if (!state.newWallet) return;
  if (!state.signedIn || state.wallet?.address === state.newWallet.address) {
    return setText('newwallet-message', 'Sign in with your main wallet first, then send.');
  }
  let amount;
  try { amount = toLamports($('newwallet-fund-amount').value); } catch (err) { return setText('newwallet-message', err.message); }
  setText('newwallet-message', `Sending ${sol(amount)} SOL from ${state.wallet.address}... approve in your wallet.`);
  state.intent = { kind: 'transfer', to: state.newWallet.address, amount };
  send({ type: 'account', action: 'transfer', to: state.newWallet.address, amount, id: 'fund-new-wallet' });
}

// ---------- profile ----------

function renderProfile(p) {
  if (!p) return;
  show('profile-panel', true);
  if (document.activeElement !== $('profile-name')) $('profile-name').value = p.displayName ?? '';
  const img = $('profile-picture-preview');
  img.hidden = false;
  img.src = avatarUrl({ address: p.address, pictureUrl: p.pictureUrl, avatarPreset: p.avatarPreset }, serverUrl);
  for (const id of AVATAR_PRESETS) $(`profile-avatar-${id}`)?.setAttribute('aria-pressed', String(p.avatarPreset === id && !p.pictureUrl)); // hooks: profile-avatar-{sun,moon,star,bolt,leaf,wave,gem,rocket}
  $('profile-avatar-generated').setAttribute('aria-pressed', String(!p.avatarPreset && !p.pictureUrl));
  const s = p.stats;
  setText('profile-stat-matches', s.matches);
  setText('profile-stat-wins', s.wins);
  setText('profile-stat-losses', s.losses);
  setText('profile-stat-ties', s.ties);
  setText('profile-stat-nocontest', s.noContest);
  setText('profile-stat-best', s.bestPercent ?? '-');
  setText('profile-stat-profit', sol(s.profit));
  const ps = p.practiceStats;
  setText('profile-stat-practice', ps ? `${ps.matches} played, ${ps.wins} won (not counted as real wins)` : '-');
  $('profile-link').href = `/profile.html?address=${p.address}`;
  $('nav-profile').href = `/profile.html?address=${p.address}`;
}

/** Read a picture file; shrink it to at most 128 pixels so it stays small (it is shown at 24 to 96 pixels). */
function pictureDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 128 / Math.max(img.width, img.height));
      const c = $('picture-canvas'); // hidden; resizing it clears it
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('that file is not a picture this browser can read'));
    img.src = URL.createObjectURL(file);
  });
}

async function saveProfile() {
  const change = { type: 'profile_update', displayName: $('profile-name').value };
  const file = $('profile-picture').files[0];
  try {
    if (file) change.picture = await pictureDataUrl(file);
  } catch (err) {
    return setText('profile-message', err.message);
  }
  send(change);
}

// ---------- balance, deposit, withdraw ----------

function renderBalance(b) {
  state.balance = b;
  setText('balance-available', b.available === null ? `unavailable (${b.reason})` : sol(b.available));
  setText('balance-wallet', b.wallet === null || b.wallet === undefined ? '-' : sol(b.wallet));
  setText('balance-account', b.exists === false ? 'not created yet' : 'created');
  setText('balance-in-match', b.inMatch ? sol(b.inMatch.stake) : '0');
  setText('balance-active-match', b.inMatch ? `${b.inMatch.matchAccount} (${b.inMatch.state})` : '');
  setText('balance-pending', b.pending?.length
    ? b.pending.map((p) => `${p.kind.replace('_', ' ')}${p.amount ? ` ${sol(p.amount)} SOL` : ''} (${p.stage.replace('_', ' ')})`).join('; ')
    : 'none');
  show('balance-create', b.exists === false && !b.playMoney);
  show('balance-play-money', b.playMoney === true);
}

/** The deposit and withdrawal forms' parts. */
const BALANCE_FORMS = {
  deposit: { amount: 'deposit-amount', summary: 'deposit-summary', confirm: 'deposit-confirm', panel: 'deposit-confirm-panel' },
  withdraw: { amount: 'withdraw-amount', summary: 'withdraw-summary', confirm: 'withdraw-confirm', panel: 'withdraw-confirm-panel' },
};

function review(kind) {
  const b = state.balance;
  let amount;
  const form = BALANCE_FORMS[kind];
  try { amount = BigInt(toLamports($(form.amount).value)); } // hooks: deposit-amount, withdraw-amount
  catch (err) { return setText('balance-message', err.message); }
  if (amount <= 0n) return setText('balance-message', 'Amount must be more than zero.');
  const available = BigInt(b?.available ?? '0');
  const wallet = b?.wallet ? BigInt(b.wallet) : null;
  const lines = [];
  if (kind === 'deposit') {
    if (wallet !== null && amount > wallet) return setText('balance-message', `Your wallet has only ${sol(wallet)} SOL.`);
    lines.push(`Deposit ${sol(amount)} SOL from your wallet into the escrow.`);
    lines.push(`Escrow balance after: ${sol(available + amount)} SOL.`);
  } else {
    if (b?.inMatch) return setText('balance-message', 'You cannot withdraw while you are in a match (the contract refuses).');
    if (amount > available) return setText('balance-message', `You can withdraw at most ${sol(available)} SOL.`);
    lines.push(`Withdraw ${sol(amount)} SOL from the escrow back to your wallet.`);
    lines.push(`Escrow balance after: ${sol(available - amount)} SOL.`);
  }
  lines.push('No house cut on deposits or withdrawals; your wallet pays a small network fee (about 0.000005 SOL).');
  lines.push('Your escrow balance stays between matches: deposit once and play as many matches as it covers.');
  lines.push('Payouts land in this balance the moment a match is settled.');
  lines.push('The 2.5% house cut is only ever taken from a match pot, for example:');
  for (const s of state.hello.stakes) {
    const pot = BigInt(s) * 2n;
    lines.push(`  stake ${sol(s)} each: pot ${sol(pot)}, cut ${sol((pot * cutBps()) / 10_000n)}, winner receives ${sol(pot - (pot * cutBps()) / 10_000n)} SOL`);
  }
  setText(form.summary, lines.join('\n')); // hooks: deposit-summary, withdraw-summary
  $(form.confirm).dataset.amount = amount.toString(); // hooks: deposit-confirm, withdraw-confirm
  show(form.panel, true); // hooks: deposit-confirm-panel, withdraw-confirm-panel
}

function confirm(kind) {
  const form = BALANCE_FORMS[kind];
  show(form.panel, false); // hooks: deposit-confirm-panel, withdraw-confirm-panel
  setText('balance-message', 'Waiting for your wallet...');
  const amount = $(form.confirm).dataset.amount; // hooks: deposit-confirm, withdraw-confirm
  state.intent = { kind: 'account', action: kind, amount };
  send({ type: 'account', action: kind, amount });
}

// ---------- queue ----------

/** One choice in a queue list, copied from its template. */
function option(template, text, value) {
  const o = fromTemplate(template); // hooks: template-queue-chart-option, template-queue-stake-option, template-queue-length-option
  o.textContent = text;
  o.value = String(value);
  return o;
}

function fillQueueOptions(hello) {
  // Practice: Generated chart (the default) or Recorded; real-stake matches always use live prices.
  const modes = hello.chartModes ?? [];
  const chart = $('queue-chart');
  chart.replaceChildren();
  for (const m of modes) chart.append(option('template-queue-chart-option', m.label, m.id));
  show('queue-chart-label', modes.length > 0);
  const note = () => {
    const m = modes.find((x) => x.id === chart.value);
    setText('queue-chart-note', m?.note ?? '');
    show('queue-chart-note', !!m);
  };
  chart.onchange = note;
  note();
  const stake = $('queue-stake');
  stake.replaceChildren();
  for (const s of hello.stakes) stake.append(option('template-queue-stake-option', `${sol(s)} SOL`, s));
  const len = $('queue-length');
  len.replaceChildren();
  for (const ms of hello.lengthsMs) len.append(option('template-queue-length-option', `${ms / 60_000} minute${ms === 60_000 ? '' : 's'}`, ms));
  updateQueueNumbers();
}

function updateQueueNumbers() {
  const stake = BigInt($('queue-stake').value || '0');
  const pot = stake * 2n;
  setText('queue-pot', sol(pot));
  setText('queue-cut', sol((pot * cutBps()) / 10_000n));
  // The scored trading budget is a server setting: a fixed amount (owner: 1 SOL) or the pot.
  const budget = state.hello?.rules?.budget;
  setText('queue-budget', budget === undefined ? '-' : budget === 'pot' ? sol(pot) : sol(budget));
}

/** The contract's time limits for a match of `lengthMs`, in plain words (from the server's hello). */
function timeWindows(lengthMs) {
  const h = state.hello ?? {};
  const secs = (n) => (n >= 120 ? `${Math.round(n / 6) / 10} minutes` : `${n} seconds`);
  const out = [];
  if (h.joinTimeoutSecs) out.push(`Waiting for an opponent: up to ${secs(h.joinTimeoutSecs)}; nobody joins, your stake comes back in full.`);
  if (h.settleMarginSecs) {
    out.push(`If the server stopped answering, anyone can return both stakes in full ${secs(Math.ceil(lengthMs / 1000) + h.settleMarginSecs)} after the match starts.`);
  }
  if (h.rematchWindowSecs) out.push(`After a tie: ${secs(h.rematchWindowSecs)} to accept a rematch.`);
  return out;
}

function openWarning() {
  if (!state.signedIn) return setText('queue-status', 'Connect a wallet and sign in first.');
  const stake = BigInt($('queue-stake').value);
  const pot = stake * 2n;
  const cut = (pot * cutBps()) / 10_000n;
  setText('queue-confirm-summary', [
    `Stake: ${sol(stake)} SOL (moves from your escrow balance into the match).`,
    `Pot: ${sol(pot)} SOL. House cut 2.5%: ${sol(cut)} SOL. Winner receives ${sol(pot - cut)} SOL.`,
    `If neither of you trades, or a tie is not replayed: each gets ${sol(stake - cut / 2n)} SOL back (stake minus half the cut).`,
    'If the server cannot run or finish the match: both stakes back in full, no cut, as soon as the server says so.',
    `Length: ${Number($('queue-length').value) / 60_000} minute${Number($('queue-length').value) === 60_000 ? '' : 's'}.`,
    $('queue-chart-label').hidden ? '' : `Chart: ${$('queue-chart').selectedOptions[0]?.textContent ?? ''}.`,
    ...timeWindows(Number($('queue-length').value)),
    'The house pays the small match-account deposit; your balance only moves by your stake and your payout.',
    state.hello.market?.practice ? 'Practice: prices are not live.' : '',
  ].filter(Boolean).join('\n'));
  $('no-trade-ack').checked = false;
  $('no-trade-confirm').disabled = true;
  show('no-trade-warning', true);
}

function confirmQueue() {
  show('no-trade-warning', false);
  state.intent = { kind: 'queue', stake: $('queue-stake').value, lengthSecs: Math.ceil(Number($('queue-length').value) / 1000) };
  const chart = $('queue-chart-label').hidden ? undefined : $('queue-chart').value;
  send({ type: 'queue_join', stake: $('queue-stake').value, lengthMs: Number($('queue-length').value), ackNoTradeRule: true, chart });
}

// ---------- wallet approvals ----------

function describeAction(a) {
  const amount = a.amount ? ` ${sol(a.amount)} SOL` : '';
  const stake = a.stake ? ` with a ${sol(a.stake)} SOL stake` : '';
  const to = a.to ? ` to ${a.to}` : '';
  return `${a.kind.replace('_', ' ')}${amount}${stake}${to}${a.accept === undefined ? '' : a.accept ? ' (yes)' : ' (no)'}`;
}

// An intent covers one approval, except a queue request, which may need two (a join that fails,
// then an open). It is cleared when the queue answer arrives.
function useUpIntent() {
  if (state.intent && state.intent.kind !== 'queue') state.intent = null;
}

async function approveSign() {
  const req = state.pendingSign;
  if (!req) return;
  state.pendingSign = null;
  useUpIntent();
  show('sign-panel', false);
  try {
    const bytes = fromBase64(req.message);
    // Real transactions are signed as transactions; the stand-in escrow's text is signed as a message.
    const sig = req.format === 'transaction' ? await state.wallet.signTx(bytes) : await state.wallet.sign(bytes);
    send({ type: 'signed', requestId: req.requestId, signature: base58Encode(sig) });
    setText('sign-status', `Signed: ${req.purpose}. Sending...`);
  } catch (err) {
    send({ type: 'sign_declined', requestId: req.requestId });
    setText('sign-status', `Not signed: ${err.message}`);
  }
}

function declineSign() {
  const req = state.pendingSign;
  if (!req) return;
  state.pendingSign = null;
  useUpIntent();
  show('sign-panel', false);
  send({ type: 'sign_declined', requestId: req.requestId });
  setText('sign-status', `Declined: ${req.purpose}`);
}

function onSignRequest(msg) {
  // Never sign bytes we have not checked: decode them and refuse anything other than the one action
  // the player asked for on this page (checkSignRequest in protocol.js).
  let checked;
  try {
    checked = checkSignRequest(fromBase64(msg.message), {
      player: state.wallet?.address,
      programId: state.hello?.escrowProgram,
      action: msg.action,
      intent: state.intent,
      dev: !!state.hello?.dev,
    });
  } catch (err) {
    send({ type: 'sign_declined', requestId: msg.requestId });
    setText('sign-status', `Refused to sign: ${err.message}`);
    log(`refused sign request: ${err.message}`);
    return;
  }
  state.pendingSign = msg;
  setText('sign-purpose', msg.purpose);
  setText('sign-details', checked);
  const local = state.wallet?.kind === 'test' || state.wallet?.kind === 'phrase';
  if (local && $('sign-auto').checked) return approveSign();
  // Browser wallets show their own approval window when asked to sign.
  if (state.wallet?.kind === 'standard') return approveSign();
  show('sign-panel', true);
}

// ---------- match view ----------
// The coin is hidden during the match: the server sends no name, address or real price, only an
// index (100 when the chart appeared). The page only shows what the server worked out.

function newMatchView(info) {
  state.match = {
    id: info.matchId, seat: info.seat, opponent: info.opponent, stake: info.stake,
    orders: new Map(), trades: [], budget: null, startAt: null, endAt: null, maxTrades: 10,
    scores: null, scoresPpm: null, lead: 'level', countdownShown: null, tradingStarted: false,
    avatars: info.avatars ?? null,
  };
  setText('match-id', info.matchId);
  setText('opponent-address', info.opponent);
  show('opponent-bot', info.opponentBot === true);
  setText('opponent-trades', '0');
  setText('opponent-connection', 'connected');
  setText('match-status', info.state ?? 'starting');
  hideReference();
  show('result-coin', false);
  show('match-practice', info.practice !== false);
  $('order-list').replaceChildren();
  show('match-panel', true);
  show('result-panel', false);
  document.body.dataset.state = 'in-match';
}

/** The chart appears (with the countdown to the start), or is redrawn after a reload. */
function startRound(msg) {
  const m = state.match;
  m.chartCommit = msg.generatedChart?.commit ?? null;
  show('chart-generated', !!msg.generatedChart);
  setText('chart-seed-hash', msg.generatedChart?.commit ?? '-');
  Object.assign(m, {
    round: msg.round, budget: msg.budget, chartAt: msg.chartAt, startAt: msg.startAt, endAt: msg.endAt,
    maxTrades: msg.maxTrades, scores: msg.scores ?? null, scoresPpm: msg.scoresPpm ?? null,
    tradesUsed: msg.tradesUsed ?? 0, trades: msg.trades ?? [], countdownShown: null,
    tradingStarted: serverNow() >= msg.startAt, lead: 'level', roundOver: false,
  });
  m.orders = new Map();
  $('order-list').replaceChildren();
  for (const o of msg.orders ?? []) upsertOrder(o);
  setText('match-round', msg.round);
  setText('match-status', serverNow() < msg.startAt ? 'chart shown, trading starts soon' : 'live');
  setText('budget-amount', sol(msg.budget));
  setText('trades-max', msg.maxTrades);
  setText('trades-used', m.tradesUsed);
  if (msg.practice !== undefined) show('match-practice', msg.practice);
  show('result-panel', false);
  // Before the first fresh price: all cash, no coins.
  renderPosition(msg.position ?? { cash: msg.budget, positionValue: '0', value: msg.budget, pnl: '0', pnlPercent: '0.0000', canBuy: TRADE_PERCENTS, canSell: [] });
  chartStart(msg);
  refreshTrades();
  refreshDuel();
  emit($('chart-area'), 'chartShown', { startAt: msg.startAt, endAt: msg.endAt });
}

function upsertOrder(o) {
  const m = state.match;
  m.orders.set(o.id, o);
  let li = $('order-list').querySelector(`[data-order-id="${o.id}"]`);
  if (!li) {
    li = fromTemplate('template-order-item');
    li.dataset.orderId = o.id;
    $('order-list').prepend(li);
  }
  li.dataset.status = o.status;
  li.textContent = `${o.side} ${o.percent}% - ${o.status}` + (o.fillIndex ? ` at index ${o.fillIndex}` : '') + (o.lamports ? ` (${sol(o.lamports)} SOL)` : '') + (o.reason ? ` - ${o.reason}` : '');
}

/** Your own position as the server sent it (size, cash, value, profit or loss). */
function renderPosition(p) {
  if (state.match && Array.isArray(p?.canBuy)) {
    state.match.canBuy = p.canBuy;
    state.match.canSell = p.canSell ?? [];
  }
  const t = positionText(p);
  setText('position-size', t.size);
  setText('position-cash', t.cash);
  setText('position-value', t.value);
  setText('position-pnl', t.pnl);
  setText('position-pnl-pct', t.pnlPercent);
  const pnl = p?.pnl === null || p?.pnl === undefined ? 0n : BigInt(p.pnl);
  $('position').dataset.pnl = pnl > 0n ? 'profit' : pnl < 0n ? 'loss' : 'flat';
  refreshTradeButtons();
}

// ---------- the match chart (TradingView Lightweight Charts, fed only by the server's candles) ----------

const chart = { api: null, series: null, markers: null, pictures: null };

function ensureChart() {
  if (chart.api) return;
  // Some systems report a locale the browser's number formatting refuses (for example "en-US@posix");
  // fall back to en-US rather than letting the chart fail on every redraw.
  const locale = (() => {
    try {
      new Intl.DateTimeFormat(navigator.language);
      return navigator.language;
    } catch {
      return 'en-US';
    }
  })();
  const box = $('chart');
  chart.api = createChart(box, {
    // Sized by the page, not by the chart library: always exactly the TV screen (fitChartToScreen).
    autoSize: false,
    localization: { locale },
    layout: { attributionLogo: true }, // TradingView's logo and link: keep it (licence)
    // Candles never grow wider than 14 pixels, even when only a few exist yet.
    timeScale: { timeVisible: true, secondsVisible: true, maxBarSpacing: 14, rightOffset: 4 },
  });
  chart.series = chart.api.addSeries(CandlestickSeries, {
    // index values (100 = start), three decimals
    priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
  });
  chart.markers = createSeriesMarkers(chart.series, []);
  applyChartTheme();
  // Picture markers: each trade shows its player's picture in a ring (you blue, opponent yellow),
  // in the layer over the chart (in the page's markup) that follows the chart's own coordinates.
  // The chart draws its own parts into the same box; the layer stays above them (web/base.css).
  chart.pictures = $('trade-pictures');
  box.append(chart.pictures);
  chart.api.timeScale().subscribeVisibleLogicalRangeChange(() => placePictures());
  // The chart draws only inside the TV screen: whenever the screen changes size (any width, phone
  // included), the chart is made exactly the screen's size again; the screen also clips it.
  fitChartToScreen();
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { fitChartToScreen(); placePictures(); }).observe($('chart-tv-screen'));
  else addEventListener('resize', () => { fitChartToScreen(); placePictures(); });
}

/** Make the chart exactly the size of the TV screen it sits in. */
function fitChartToScreen() {
  const screen = $('chart-tv-screen');
  if (!chart.api || !screen) return;
  const w = Math.floor(screen.clientWidth);
  const h = Math.floor(screen.clientHeight);
  if (w > 0 && h > 0) chart.api.resize(w, h);
}

/**
 * The chart's own look and the candle colours, from the page's CSS variables (web/base.css; the
 * style layer may change them). Applied when the chart is made and again at each round start.
 */
function applyChartTheme() {
  const layout = chartLayoutFrom(cssVar);
  chart.api.applyOptions({ ...layout, layout: { ...layout.layout, attributionLogo: true } });
  const c = candleColorsFrom(cssVar);
  chart.series.applyOptions({ upColor: c.up, downColor: c.down, borderUpColor: c.up, borderDownColor: c.down, wickUpColor: c.up, wickDownColor: c.down });
}

/** Put each trade's picture at its candle and price (redone whenever the chart moves or resizes). */
function placePictures() {
  const m = state.match;
  if (!chart.pictures) return;
  const bars = new Map((chart.series?.data() ?? []).map((b) => [b.time, b]));
  // Pictures stay inside the chart's drawing area (a trade near the top or bottom would push one out).
  const pane = chart.api.paneSize?.() ?? { width: chart.pictures.clientWidth, height: chart.pictures.clientHeight };
  // Marker size and the room kept for its label: CSS variables, so the design can change them.
  const size = cssNumber('--pons-marker-size', 24);
  const labelWidth = cssNumber('--pons-marker-label-width', 90);
  const spots = !m ? [] : pictureMarkers(
    m.trades,
    m.seat,
    (t) => chart.api.timeScale().timeToCoordinate(t),
    (index) => chart.series.priceToCoordinate(index),
    size,
    // Past the arrow marker: below the candle's low for a buy, above its high for a sell.
    (t, side) => {
      const b = bars.get(t);
      return b ? chart.series.priceToCoordinate(side === 'buy' ? b.low : b.high) : null;
    },
    { width: pane.width, height: pane.height },
    labelWidth,
  );
  const keep = new Set(spots.map((p) => p.id));
  for (const el of [...chart.pictures.children]) if (!keep.has(el.dataset.id)) el.remove();
  const byId = new Map(m ? m.trades.map((t) => [`pic-${t.seat}-${t.orderId}`, t]) : []);
  for (const p of spots) {
    // One marker: the player's picture in its ring, and its label ("You buy") on a light background.
    // This layer is above the chart's canvas, so no candle can hide the label.
    // Its look (size, ring, label colours and place) is in CSS, keyed by the data attributes set here.
    let box = chart.pictures.querySelector(`[data-id="${p.id}"]`);
    if (!box) {
      box = fill(fromTemplate('template-trade-marker'), { 'trade-marker-label': markerLabel(byId.get(p.id) ?? { seat: p.seat, side: p.side }, m.seat) });
      box.dataset.id = p.id;
      box.dataset.side = p.side;
      box.dataset.mine = String(p.mine);
      const img = $('trade-picture', box);
      if (img) {
        img.dataset.id = p.id;
        img.dataset.seat = p.seat;
        img.dataset.side = p.side;
        img.dataset.mine = String(p.mine);
        img.src = avatarUrl(m.avatars?.[p.seat] ?? { address: p.seat === m.seat ? state.wallet?.address : m.opponent }, serverUrl);
      }
      chart.pictures.append(box);
    }
    box.dataset.labelSide = p.labelSide;
    box.style.setProperty('--pons-marker-left', `${p.left}px`);
    box.style.setProperty('--pons-marker-top', `${p.top}px`);
  }
}

/** Reset the chart for a round: the same short history for both players, then live candles. */
function chartStart(msg) {
  ensureChart();
  stopAttract();
  const m = state.match;
  m.barMs = msg.chart?.barMs ?? 5_000;
  m.origin = Math.floor(msg.chartAt / 1000) * 1000;
  applyChartTheme();
  chart.series.setData(startBars(msg.chart?.history, msg.bars ?? [], m.origin));
  chart.markers.setMarkers([]);
  chart.pictures.replaceChildren();
  // With history, show it all; a generated chart starts empty, so keep normal candle widths instead.
  const ts = chart.api.timeScale();
  ts.applyOptions({ barSpacing: 8 });
  if (msg.chart?.history?.length) ts.fitContent();
  else ts.scrollToRealTime();
  refreshOverlay();
}

// ---------- the chart TV: the chart's permanent home, near the top of the page ----------
// Its screen is always there: static and a loading bar while the game server is offline or waking,
// a sample chart between matches, the live chart (trade markers and duel circles inside) in a
// match, then the result. web/tv.js works out the state; each state is a hooked overlay.

const attract = { bars: null, loading: null, timer: null, shown: 0, on: false };

/** The clock the TV reads: the preview's stopped clock, or the real one. */
const tvNow = () => state.frozenNow ?? Date.now();

function refreshTv() {
  const tv = $('chart-tv');
  if (!tv) return;
  const now = tvNow();
  const open = state.ws?.readyState === WebSocket.OPEN && !state.offline;
  const s = tvState({
    connected: open && !!state.hello,
    connectedAt: PREVIEW ? null : state.connectedAt,
    now,
    match: !!state.match,
    result: !!state.match && document.body.dataset.state === 'result',
  });
  tv.dataset.state = s;
  setText('chart-tv-channel-state', channelText(s));
  show('chart-tv-loading', s === 'offline');
  show('chart-tv-idle', s === 'idle');
  show('chart-tv-match', s === 'match');
  show('chart-tv-result', s === 'result');
  // The match's own parts: the scoreboard, the trade buttons and the duel circles in the screen.
  for (const hook of ['scoreboard', 'trade-panel', 'duel']) show(hook, !!state.match); // hooks: scoreboard, trade-panel, duel
  if (s === 'offline') {
    // Connected once the connection has opened (the preview's pretend connection counts once its hello is in).
    const v = loadingView({ connected: open && (state.connectedAt !== null || !!state.hello), startedAt: state.connectStartedAt, now, unusable: state.serverUnusable });
    const box = $('chart-tv-loading');
    box.dataset.step = v.step;
    $('chart-tv-loading-fill').style.setProperty('--pons-tv-progress', v.progress.toFixed(3));
    $('chart-tv-loading-bar').setAttribute('aria-valuenow', String(Math.round(v.progress * 100)));
    setText('chart-tv-loading-text', v.text);
    const marks = stepMarks(v.step);
    for (const step of ['contacting', 'waking', 'connected']) {
      const li = $(`chart-tv-step-${step}`); // hooks: chart-tv-step-{contacting,waking,connected}
      li.dataset.done = String(marks[step].done);
      li.dataset.current = String(marks[step].current);
    }
  }
  if (s === 'idle') {
    // The screen's button does what the next-step box's button does.
    const next = $('next-step-button');
    const button = $('chart-tv-idle-button');
    button.hidden = next.hidden;
    button.textContent = next.textContent;
    button.dataset.action = next.dataset.action ?? '';
    state.attractReady = startAttract();
  } else {
    stopAttract();
  }
}

/** Start the sample chart (the same generated chart every time) playing on the screen. */
function startAttract() {
  if (attract.on) return attract.loading;
  attract.on = true;
  ensureChart();
  attract.loading = (attract.loading ?? attractBars().then((bars) => { attract.bars = bars; }).catch((err) => {
    attract.bars = [];
    log(`could not make the sample chart: ${err.message}`);
  })).then(() => {
    if (!attract.on || !attract.bars.length) return;
    applyChartTheme();
    chart.markers.setMarkers([]);
    chart.pictures.replaceChildren();
    chart.api.timeScale().applyOptions({ barSpacing: 8 });
    // The preview shows one still moment; the page plays it, a candle at a time, round and round.
    attract.shown = PREVIEW ? Math.min(attract.bars.length, ATTRACT_FIRST * 2) : ATTRACT_FIRST;
    chart.series.setData(attract.bars.slice(0, attract.shown));
    chart.api.timeScale().scrollToRealTime();
    if (PREVIEW) return;
    clearInterval(attract.timer);
    attract.timer = setInterval(() => {
      if (!attract.on) return;
      if (attract.shown >= attract.bars.length) {
        attract.shown = ATTRACT_FIRST;
        chart.series.setData(attract.bars.slice(0, attract.shown));
        chart.api.timeScale().scrollToRealTime();
      } else {
        chart.series.update(attract.bars[attract.shown++]);
      }
    }, Math.max(100, cssNumber('--pons-tv-attract-step', 700)));
  });
  return attract.loading;
}

function stopAttract() {
  attract.on = false;
  clearInterval(attract.timer);
  attract.timer = null;
}

/** Trade markers for both players: yours blue, your opponent's yellow. */
function refreshTrades() {
  const m = state.match;
  if (!chart.series || !m) return;
  chart.markers.setMarkers(tradeMarkers(m.trades, m.seat, tradeColorsFrom(cssVar)));
  placePictures();
}

/**
 * The scoreboard's duel circles and labels (from the server's live scores): two circles with the
 * same centre that grow with gains and shrink with losses (exaggerated), the bigger one behind;
 * "You +1.45%", "Them +2.93%" and the lead ("Behind by 1.48 points"). Radius changes animate in CSS.
 */
function refreshDuel() {
  const m = state.match;
  if (!m) return;
  // Exaggeration and radii are CSS variables (units of the 200 x 200 duel picture).
  const d = duelView(m.scoresPpm, m.seat, duelSettingsFrom(cssVar));
  const circles = { me: $('duel-circle-me'), opponent: $('duel-circle-opponent') };
  for (const who of ['me', 'opponent']) circles[who].style.setProperty('--pons-duel-r', `${d[who].r.toFixed(2)}px`);
  // The bigger circle goes behind, so it visibly swallows the smaller (moved only when it changes).
  const back = circles[d.drawOrder[0]];
  if (back.parentNode.firstElementChild !== back) back.parentNode.insertBefore(back, back.parentNode.firstElementChild);
  setText('score-you-pct', d.me.label.replace(/^You /, ''));
  setText('score-them-pct', d.opponent.label.replace(/^Them /, ''));
  $('score-you').dataset.sign = d.me.sign;
  $('score-them').dataset.sign = d.opponent.sign;
  setText('score-lead', d.leadText);
  $('score-lead').dataset.state = d.state;
  $('scoreboard').dataset.state = d.state;
  $('duel').dataset.state = d.state;
  emit($('chart-area'), 'duel', { me: d.me, opponent: d.opponent, text: d.leadText, state: d.state });
  if (d.state !== m.lead) {
    emit($('chart-area'), 'leadChange', { state: d.state, previous: m.lead });
    m.lead = d.state;
  }
}

function refreshOverlay() {
  const m = state.match;
  if (!m) return;
  const now = serverNow();
  const o = overlayText({ scores: m.scores, seat: m.seat, tradesUsed: m.tradesUsed ?? 0, maxTrades: m.maxTrades, startAt: m.startAt, endAt: m.endAt, now });
  setText('score-trades-left', o.tradesLeft);
  refreshTradeButtons();
  setText('score-time-left', o.timeLeft);
  setText('timer', o.timeLeft);
  $('chart-area').dataset.phase = o.phase;
  const cd = countdownText({ startAt: m.startAt, now });
  setText('start-countdown', cd ?? '');
  if (cd) {
    const secondsLeft = Math.ceil((m.startAt - now) / 1000);
    if (secondsLeft !== m.countdownShown) {
      m.countdownShown = secondsLeft;
      emit($('chart-area'), 'countdown', { secondsLeft });
    }
  } else if (o.phase === 'trading' && !m.tradingStarted) {
    m.tradingStarted = true;
    setText('match-status', 'live');
    emit($('chart-area'), 'tradingStart', { startAt: m.startAt });
  }
}

// ---------- reference panel (DexScreener, not the fill price): only after the match, on the result ----------

function showReference(coin, practice) {
  const url = referenceEmbedUrl({ revealed: true, coin });
  state.referenceUrl = url;
  setText('reference-label', referenceLabel({ practice: practice !== false }));
  show('reference-panel', true);
  show('reference-unavailable', !url);
  $('reference-toggle').disabled = !url;
  applyReferenceToggle();
}

function applyReferenceToggle() {
  const frame = $('reference-frame');
  const on = !!state.referenceUrl && $('reference-toggle').checked;
  if (on && frame.src !== state.referenceUrl) frame.src = state.referenceUrl;
  if (!on) frame.removeAttribute('src');
  frame.hidden = !on;
}

function hideReference() {
  state.referenceUrl = null;
  $('reference-frame').removeAttribute('src');
  $('reference-frame').hidden = true;
  show('reference-panel', false);
}

/** The match is over: show the coin it was played on, and the optional reference chart. */
function revealCoin(coins, practice) {
  const c = coins?.[coins.length - 1];
  if (!c) return;
  show('result-generated', !!c.generated);
  if (c.generated) {
    // The seed is revealed now: check it against the hash this page was shown at the start.
    const seen = state.match?.chartCommit;
    setText('result-seed', c.generated.seed);
    setText('result-seed-check', 'Checking the seed...');
    seedCommit(c.generated.seed).then((h) => {
      $('result-seed-check').dataset.ok = String(!seen || h === seen);
      setText('result-seed-check', !seen
        ? `Its SHA-256 is ${h} (this page did not see the start, so compare it with the hash shown then).`
        : h === seen
          ? 'Its SHA-256 matches the seed hash you were shown at the start: the chart was fixed before you traded.'
          : `WARNING: its SHA-256 (${h}) does NOT match the hash shown at the start (${seen}).`);
    }, (err) => setText('result-seed-check', `Could not check the seed: ${err.message}`));
  }
  setText('result-coin-symbol', c.symbol);
  setText('result-coin-name', c.name);
  setText('result-coin-mint', c.mint);
  setText('result-coin-base', c.indexBase ?? '-');
  show('result-coin', true);
  showReference(c, practice);
  emit($('chart-area'), 'reveal', { coins });
}

/** A trade button press: the page sends only which button; the server works out the amount. */
function pressTrade(button) {
  if ($(`trade-${button}`).disabled) return; // hooks: trade-{buy,sell}-{10,25,50,100}
  send({ type: 'order', button, clientOrderId: randomHex(4) });
}

/** Enable or disable the eight trade buttons, with a short reason, and show the trades left. */
function refreshTradeButtons() {
  const m = state.match;
  const now = serverNow();
  const phase = !m || !m.startAt ? 'waiting'
    : m.roundOver || (m.endAt && now >= m.endAt) ? 'ended'
    : now < m.startAt ? 'countdown' : 'trading';
  const s = buttonStates({
    phase,
    secondsToStart: m?.startAt ? Math.ceil((m.startAt - now) / 1000) : undefined,
    tradesUsed: m?.tradesUsed ?? 0,
    maxTrades: m?.maxTrades ?? 10,
    canBuy: m?.canBuy ?? [],
    canSell: m?.canSell ?? [],
  });
  for (const id of TRADE_BUTTONS) {
    const b = $(`trade-${id}`); // hooks: trade-{buy,sell}-{10,25,50,100}
    const st = s.buttons[id];
    b.disabled = !st.enabled;
    b.title = st.reason ?? '';
    b.dataset.reason = st.reason ?? '';
  }
  for (const side of ['buy', 'sell']) {
    const reasons = TRADE_PERCENTS.map((p) => s.buttons[`${side}-${p}`].reason).filter(Boolean);
    setText(side === 'buy' ? 'trade-buy-reason' : 'trade-sell-reason', reasons[0] ?? '');
  }
  setText('trade-trades-left', m ? String(s.tradesLeft) : '-');
}

function showResult(msg) {
  const m = state.match;
  const mine = m?.seat ?? (msg.players.A === state.wallet?.address ? 'A' : 'B');
  const other = mine === 'A' ? 'B' : 'A';
  const headline = {
    win: msg.winner === state.wallet?.address ? 'You won.' : 'You lost.',
    refund_minus_cut: msg.reason === 'both_no_trades'
      ? 'Neither player traded. Both stakes refunded minus the house cut.'
      : 'Tie and no rematch. Both stakes refunded minus the house cut.',
    void: `Match cancelled, full refund: ${msg.voidReason ?? ''}` +
      (msg.refundAfterUnix ? ` The contract releases it after ${new Date(msg.refundAfterUnix * 1000).toLocaleTimeString()}.` : ''),
  }[msg.kind];
  setText('result-headline', headline);
  setText('chart-tv-result-headline', headline);
  setText('chart-tv-result-scores', '');
  setText('result-my-payout', sol(msg.payout[mine]));
  setText('result-house', sol(msg.payout.house));
  show('result-practice', msg.practice !== false);
  const record = $('result-record-link');
  record.href = serverUrl(msg.recordUrl);
  record.textContent = record.href;
  const page = $('result-page-link');
  page.href = msg.resultPage;
  page.textContent = msg.resultPage;
  setText('result-signature', msg.signature ?? 'none (nothing to sign)');
  // The result is always shown, even if revealing the coin fails for some reason.
  try {
    revealCoin(msg.coins, msg.practice);
  } catch (err) {
    log(`could not show the coin: ${err.message}`);
  }
  setText('result-settlement', 'waiting');
  show('rematch-panel', false);
  show('result-panel', true);
  setText('match-status', 'finished');
  document.body.dataset.state = 'result';
  if (m) m.roundOver = true;
  refreshTradeButtons();
  const end = state.lastRoundEnd;
  if (end) {
    setText('result-my-score', end[mine].scorePercent);
    setText('result-opponent-score', end[other].scorePercent);
    setText('chart-tv-result-scores', `You ${end[mine].scorePercent}%, them ${end[other].scorePercent}%`);
  }
}

// ---------- incoming messages ----------

/** Every server message: handle it, then bring the next-step box up to date. */
function handle(msg) {
  handleMessage(msg);
  refreshNextStep();
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'hello':
      state.hello = msg;
      state.nonce = msg.nonce;
      state.issuedUnix = msg.issuedUnix;
      state.clockOffset = msg.serverTime - Date.now();
      setText('result-key', msg.resultKey);
      setText('escrow-program', msg.escrowProgram);
      setText('network', msg.network ?? 'unknown');
      // The devnet banner: a public test network, so players see at once that it is test SOL only.
      show('network-banner', msg.network === 'devnet' || msg.network === 'testnet');
      setText('network-banner-text', `${msg.network === 'testnet' ? 'Testnet' : 'Devnet'}: test SOL only, not real money.`);
      setText('market-source', msg.market?.description ?? 'unknown');
      show('market-practice', !!msg.market?.practice);
      show('balance-faucet', !!msg.dev);
      fillQueueOptions(msg);
      arrivalTour();
      if (state.wallet) signIn();
      else if (!PREVIEW && lastWasTestWallet()) void useWallet(testWallet); // back after a reload: sign straight in
      refreshNextStep();
      break;
    case 'auth_result':
      state.signedIn = msg.ok;
      setText('wallet-signed-in', msg.ok ? 'yes' : `no: ${explainSignIn(msg.reason)}`);
      document.body.dataset.state = msg.ok ? 'signed-in' : 'signed-out';
      if (msg.nextNonce) { state.nonce = msg.nextNonce; state.issuedUnix = msg.nextIssuedUnix; }
      // A challenge that ran out while the wallet was open: ask once more with the fresh one.
      if (!msg.ok && /expired/.test(msg.reason ?? '') && !state.signInRetried && state.wallet) {
        state.signInRetried = true;
        signIn().catch((err) => setText('wallet-message', `Wallet: ${err.message}`));
      }
      if (msg.ok) { state.signInRetried = false; renderProfile(msg.profile); syncIntroSeen(msg.profile?.introSeen); askForResult(); }
      break;
    case 'intro_seen_result':
      if (msg.ok) state.profileIntro = msg.introSeen;
      break;
    case 'profile_result':
      setText('profile-message', msg.ok ? 'Saved.' : `Not saved: ${msg.reason}`);
      if (msg.ok) { $('profile-picture').value = ''; renderProfile(msg.profile); }
      break;
    case 'balance':
      renderBalance(msg);
      break;
    case 'sign_request':
      onSignRequest(msg);
      break;
    case 'tx_result':
      setText('sign-status', msg.ok ? `Done: ${describeAction(msg.action)} (transaction ${msg.tx})` : `Failed: ${msg.reason}`);
      break;
    case 'account_result':
      if (msg.replyTo === 'fund-new-wallet') setText('newwallet-message', msg.ok ? `Sent (transaction ${msg.tx}). Now switch to the new wallet.` : `Not sent: ${msg.reason}`);
      else setText('balance-message', msg.ok ? `Done (transaction ${msg.tx})` : `Failed: ${msg.reason}`);
      break;
    case 'play_money':
      setText('balance-message', `${sol(msg.lamports)} SOL of play money added (practice, not real money).`);
      state.problem = null;
      break;
    case 'play_money_result':
      if (!msg.ok) setText('balance-message', msg.reason);
      break;
    case 'faucet_result':
      setText('balance-message', msg.ok ? `${sol(msg.lamports)} test SOL added to your wallet. Now create the balance account and deposit.` : msg.reason);
      break;
    case 'queue_join_result':
      if (state.intent?.kind === 'queue') state.intent = null;
      if (!msg.ok) {
        state.problem = explainRefusal(msg.reason, { practice: !!state.hello?.practice });
        setText('queue-status', state.problem.text);
      }
      break;
    case 'queue_status':
      state.queueStatus = ['opening', 'joining', 'waiting'].includes(msg.status) ? msg.status : null;
      if (state.queueStatus) state.problem = null;
      setText('queue-status', {
        opening: 'opening a match on chain (approve in your wallet)',
        joining: 'joining a waiting match on chain (approve in your wallet)',
        waiting: state.hello?.practice
          ? `waiting for an opponent (a practice bot joins after ${Math.round(state.hello.practice.botJoinAfterMs / 1000)} s if no one else does)`
          : 'waiting for an opponent',
      }[msg.status] ?? msg.message ?? msg.status);
      state.queueTimeoutAt = msg.status === 'waiting' && msg.joinDeadlineUnix ? msg.joinDeadlineUnix * 1000 : null;
      show('queue-leave', msg.status === 'waiting');
      show('queue-join', msg.status !== 'waiting');
      document.body.dataset.state = msg.status === 'waiting' ? 'queued' : 'signed-in';
      break;
    case 'queue_leave_result':
      if (msg.ok) {
        state.queueStatus = null;
        state.queueTimeoutAt = null;
        setText('queue-status', 'not queued');
        show('queue-leave', false);
        show('queue-join', true);
        document.body.dataset.state = 'signed-in';
      }
      break;
    case 'match_found':
      state.queueTimeoutAt = null;
      state.queueStatus = null;
      setText('queue-status', 'match found');
      show('queue-leave', false);
      show('queue-join', true);
      newMatchView(msg);
      break;
    case 'round_start':
      startRound(msg);
      break;
    case 'match_state':
      newMatchView(msg);
      if (msg.chart) startRound(msg);
      if (msg.coins) revealCoin(msg.coins, msg.practice);
      setText('opponent-trades', msg.opponentTrades ?? 0);
      setText('match-status', msg.state);
      break;
    case 'tick':
      if (!state.match) break;
      if (msg.index !== null) state.match.lastIndex = msg.index;
      setText('price-current', state.match.lastIndex ?? '-');
      setText('price-fresh', msg.fresh ? '' : '(price feed paused: new orders wait up to 1 second for a fresh price)');
      if (msg.bar && chart.series) {
        chart.series.update(toChartBar(msg.bar));
        placePictures(); // a new candle can move the scale
      }
      if (msg.scores) state.match.scores = msg.scores;
      if (msg.scoresPpm) state.match.scoresPpm = msg.scoresPpm;
      refreshOverlay();
      refreshDuel();
      emit($('chart-area'), 'tick', { index: msg.index, bar: msg.bar, phase: msg.phase });
      break;
    case 'trade':
      if (!state.match) break;
      state.match.trades.push(msg.trade);
      refreshTrades();
      $('chart-area').dataset.lastTrade = msg.trade.seat === state.match.seat ? 'mine' : 'opponent';
      emit($('chart-area'), 'trade', { mine: msg.trade.seat === state.match.seat, side: msg.trade.side, index: msg.trade.index, barTime: msg.trade.barTime });
      break;
    case 'position':
      renderPosition(msg);
      break;
    case 'order_result':
      setText('trade-message', msg.ok
        ? (msg.order?.status === 'filled' ? 'Filled.' : 'Order received: it fills at the next fresh price (within 1 second) or not at all.')
        : explainOrderRefusal(msg.reason));
      break;
    case 'order_update':
      upsertOrder(msg.order);
      state.match.tradesUsed = msg.tradesUsed;
      setText('trades-used', msg.tradesUsed);
      if (msg.position) renderPosition(msg.position);
      refreshOverlay();
      break;
    case 'opponent':
      setText('opponent-trades', msg.trades);
      break;
    case 'opponent_connection':
      setText('opponent-connection', msg.connected ? 'connected' : 'disconnected (their position stays open)');
      break;
    case 'round_end':
      state.lastRoundEnd = msg;
      if (state.match) state.match.roundOver = true;
      refreshTradeButtons();
      setText('match-status', 'round over');
      setText('result-closing-price', msg.closingIndex);
      emit($('chart-area'), 'roundEnd', { closingIndex: msg.closingIndex });
      if (msg.decision.kind === 'tie') {
        const mine = state.match.seat;
        setText('result-headline', 'Tie.');
        setText('result-my-score', msg[mine].scorePercent);
        setText('result-opponent-score', msg[mine === 'A' ? 'B' : 'A'].scorePercent);
      }
      break;
    case 'result_on_chain':
      setText('result-settlement', `result for round ${msg.round} accepted by the contract (transaction ${msg.tx})`);
      break;
    case 'rematch_offer':
      state.rematchOpen = true;
      show('result-panel', true);
      show('rematch-panel', true);
      setText('rematch-deadline', new Date(msg.deadlineUnix * 1000).toLocaleTimeString());
      setText('rematch-status', '');
      break;
    case 'rematch_answer':
      if (msg.seat === state.match?.seat && state.rematchOpen) state.rematchOpen = msg.accept ? 'answered' : false;
      setText('rematch-status', `${msg.seat === state.match?.seat ? 'You' : 'Opponent'} ${msg.accept ? 'accepted' : 'declined'}.`);
      break;
    case 'rematch_start':
      state.rematchOpen = false;
      show('rematch-panel', false);
      setText('match-status', 'rematch: picking a new hidden coin');
      break;
    case 'match_result':
      if (state.match && msg.matchId && msg.matchId !== state.match.id) break; // an older match's result
      state.rematchOpen = false;
      showResult(msg);
      break;
    case 'match_result_missing':
      // The game server no longer knows the match (it restarted and its memory was wiped).
      if (state.match && msg.matchId === state.match.id) {
        hideReference();
        show('match-panel', false);
        show('result-panel', false);
        state.match = null;
        document.body.dataset.state = state.signedIn ? 'signed-in' : 'signed-out';
        state.problem = { text: 'The game server restarted and lost that match, so there is no result to show. Practice balances start again with play money.', action: 'find-match', label: 'Find a match' };
      }
      break;
    case 'settled':
      setText('result-settlement', `paid out by the contract (transactions: ${msg.txs.join(', ') || 'none'})`);
      send({ type: 'balance' });
      send({ type: 'profile_get' });
      break;
    case 'error':
      log(`server error: ${msg.reason}`);
      break;
  }
}

// ---------- timers ----------

/**
 * Ask the server for the result of the match on screen when it may have been missed: after a
 * reconnect, or when the bell rang a while ago and no result came (for example the connection
 * dropped and came back just as the match ended). The server answers with the result if it has one.
 */
function askForResult() {
  const m = state.match;
  if (!m || !state.signedIn || document.body.dataset.state === 'result') return;
  m.resultAskedAt = Date.now();
  send({ type: 'match_result_get', matchId: m.id });
}

setInterval(() => {
  const now = serverNow();
  const m = state.match;
  if (m?.endAt && document.body.dataset.state === 'in-match') refreshOverlay();
  if (m?.endAt && now > m.endAt + 15_000 && Date.now() - (m.resultAskedAt ?? 0) > 10_000) askForResult();
  if ($('chart-tv').dataset.state === 'offline') refreshTv(); // the loading bar moves on
  if (state.queueTimeoutAt) setText('queue-countdown', `(stake returned if nobody joins in ${Math.max(0, Math.ceil((state.queueTimeoutAt - now) / 1000))} s)`);
  else setText('queue-countdown', '');
}, 250);

// Keep the balance live while signed in.
setInterval(() => { if (state.signedIn) send({ type: 'balance' }); }, 10_000);

// ---------- controls ----------

$('wallet-connect-test').onclick = () => useWallet(testWallet);
$('next-step-button').onclick = () => runNextStep($('next-step-button').dataset.action);
$('chart-tv-idle-button').onclick = () => runNextStep($('chart-tv-idle-button').dataset.action);
$('wallet-forget-test').onclick = () => {
  try { localStorage.removeItem('ponsstars-test-wallet'); } catch { /* ignore */ }
  setText('wallet-message', 'Test wallet forgotten; reload to start fresh.');
};
$('wallet-disconnect').onclick = async () => {
  await state.wallet?.disconnect?.().catch(() => {});
  state.wallet = null;
  try { localStorage.removeItem(LAST_WALLET_KEY); } catch { /* storage blocked */ }
  state.signedIn = false;
  setText('wallet-address', 'not connected');
  setText('wallet-name', '');
  setText('wallet-signed-in', 'no');
  show('profile-panel', false);
  state.ws?.close(); // a fresh connection drops the server session
};
$('wallet-new').onclick = () => {
  forgetShownPhrase(); // starting over never leaves an earlier phrase in the page
  show('newwallet-panel', true);
  show('newwallet-step-warn', true);
  show('newwallet-step-phrase', false);
  show('newwallet-step-ready', !!state.newWallet);
};
$('newwallet-ack').onchange = (e) => { $('newwallet-create').disabled = !e.target.checked; };
$('newwallet-create').onclick = createNewWallet;
$('newwallet-cancel').onclick = () => {
  // Closing the panel by any route hides the phrase for good (it is never shown twice).
  forgetShownPhrase();
  $('newwallet-restore-phrase').value = '';
  show('newwallet-panel', false);
};
// Leaving or hiding the page also clears it, so it is not left on screen or in a restored tab.
addEventListener('pagehide', () => {
  forgetShownPhrase();
  $('newwallet-restore-phrase').value = '';
});
$('newwallet-phrase-done').onclick = phraseWrittenDown;
$('newwallet-restore').onclick = restoreFromPhrase;
$('newwallet-fund').onclick = fundNewWallet;
$('newwallet-use').onclick = () => state.newWallet && useWallet(async () => state.newWallet);
$('profile-save').onclick = saveProfile;
$('profile-remove-picture').onclick = () => send({ type: 'profile_update', picture: null });
// Preset avatars: one button each (in the page's markup); picking one replaces an uploaded picture.
for (const id of AVATAR_PRESETS) {
  const b = $(`profile-avatar-${id}`); // hooks: profile-avatar-{sun,moon,star,bolt,leaf,wave,gem,rocket}
  if (!b) continue;
  const i = $(`profile-avatar-${id}-picture`); // hooks: profile-avatar-{sun,moon,star,bolt,leaf,wave,gem,rocket}-picture
  if (i) i.src = presetAvatar(id);
  b.onclick = () => send({ type: 'profile_update', avatarPreset: id });
}
$('profile-avatar-generated').onclick = () => send({ type: 'profile_update', avatarPreset: null, picture: null });
$('balance-refresh').onclick = () => send({ type: 'balance' });
$('balance-faucet').onclick = () => send({ type: 'dev_faucet' });
$('balance-create').onclick = () => {
  setText('balance-message', 'Waiting for your wallet...');
  state.intent = { kind: 'account', action: 'create_balance' };
  send({ type: 'account', action: 'create_balance' });
};
$('deposit-review').onclick = () => review('deposit');
$('deposit-confirm').onclick = () => confirm('deposit');
$('deposit-cancel').onclick = () => show('deposit-confirm-panel', false);
$('withdraw-review').onclick = () => review('withdraw');
$('withdraw-confirm').onclick = () => confirm('withdraw');
$('withdraw-cancel').onclick = () => show('withdraw-confirm-panel', false);
$('withdraw-max').onclick = () => { $('withdraw-amount').value = sol(state.balance?.available ?? '0'); };
$('sign-approve').onclick = approveSign;
$('sign-decline').onclick = declineSign;
$('queue-stake').onchange = updateQueueNumbers;
$('queue-join').onclick = findMatch;
$('tour-open').onclick = (e) => { e.preventDefault(); openTour(shouldShow('arrival', introSeenBy()) ? 'arrival' : null); };
window.addEventListener('hashchange', () => { if (location.hash === '#how-it-works') openTour(null); });
$('queue-leave').onclick = () => {
  state.intent = { kind: 'leave' };
  send({ type: 'queue_leave' });
};
$('no-trade-ack').onchange = (e) => { $('no-trade-confirm').disabled = !e.target.checked; };
$('no-trade-confirm').onclick = confirmQueue;
$('no-trade-cancel').onclick = () => show('no-trade-warning', false);
for (const id of TRADE_BUTTONS) $(`trade-${id}`).onclick = () => pressTrade(id); // hooks: trade-{buy,sell}-{10,25,50,100}
$('rematch-accept').onclick = () => {
  state.intent = { kind: 'rematch', accept: true };
  send({ type: 'rematch_answer', accept: true });
};
$('rematch-decline').onclick = () => {
  state.intent = { kind: 'rematch', accept: false };
  send({ type: 'rematch_answer', accept: false });
};
$('reference-toggle').onchange = applyReferenceToggle;
$('result-close').onclick = () => {
  hideReference();
  show('result-panel', false);
  show('match-panel', false);
  state.match = null;
  document.body.dataset.state = state.signedIn ? 'signed-in' : 'signed-out';
  refreshNextStep();
};

// ---------- design preview ----------

/** Rebuild one screen from the recorded sample messages (see PREVIEW above). */
async function startPreview() {
  state.ws = { readyState: WebSocket.OPEN, send() {}, close() {} }; // a pretend connection: nothing is sent
  const { previewScreen } = await import('./preview-data.js');
  const plan = await previewScreen(PREVIEW);
  renderWalletList(plan.wallets.map((name) => ({ name })));
  state.frozenNow = plan.now;
  for (const step of plan.steps) {
    if (step.wallet) {
      state.wallet = { kind: 'sample', name: 'sample wallet', address: step.wallet };
      setText('wallet-address', step.wallet);
      setText('wallet-name', '(sample wallet)');
      continue;
    }
    handle(step.msg);
    if (step.msg.type === 'hello') {
      state.clockOffset = 0;
      setText('connection-status', 'connected (sample data)');
    }
  }
  if (plan.then === 'warning') openWarning();
  if (plan.then === 'offline') {
    state.connectStartedAt = plan.now - GIVE_UP_MS - 5_000; // tried for a long while
    setOffline(true);
  }
  if (plan.then === 'waking') state.connectStartedAt = plan.now - (plan.wakingFor ?? 0); // the TV's loading bar part-way
  if (plan.then === 'new-wallet') $('wallet-new').click();
  if (plan.then === 'menu') $('nav-menu').click();
  if (plan.then === 'tour') {
    openTour('arrival');
    const at = tour.steps.findIndex((x) => x.id === plan.tourStep);
    if (at > 0) tour.show(at);
  }
  refreshOverlay();
  refreshDuel();
  refreshTrades();
  refreshNextStep();
  await state.attractReady; // the sample chart, on screens between matches
  // Let the chart size itself and draw (by timers in a background tab, see background-frames.js),
  // let the pictures settle, then tell the preview page this screen is ready.
  remeasure();
  await new Promise((r) => setTimeout(r, 300));
  fitChartToScreen();
  placePictures();
  window.__ponsPreviewReady = true;
}

if (!PREVIEW) discoverWallets(renderWalletList); // the preview shows sample wallets instead
connect();
