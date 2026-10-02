// Shared helpers for the test page. The sign-in text here must match server/src/signing.ts exactly
// (a server test checks this).

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = '';
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  return '1'.repeat(zeros) + out;
}

export function base58Decode(text) {
  let zeros = 0;
  while (zeros < text.length && text[zeros] === '1') zeros++;
  let n = 0n;
  for (const ch of text) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error('not base58');
    n = n * 58n + BigInt(i);
  }
  const body = [];
  while (n > 0n) {
    body.unshift(Number(n % 256n));
    n /= 256n;
  }
  return Uint8Array.from([...new Array(zeros).fill(0), ...body]);
}

// Sign-in: the "Sign In With Solana" message (the format wallets use for solana:signIn). It names
// this site (domain), so a wallet can warn when another site asks for a PonsStars sign-in.
// Must match server/src/signing.ts exactly (a server test checks this).
export const SIGN_IN_TTL_SECS = 300;

/** The sign-in fields for the server's challenge, as this page (at `origin`) sends them. */
export function signInFields({ origin, address, chainId, statement, nonce, issuedUnix }) {
  const u = new URL(origin);
  return {
    domain: u.host,
    address,
    statement,
    uri: `${u.protocol}//${u.host}/`,
    version: '1',
    chainId,
    nonce,
    issuedAt: new Date(issuedUnix * 1000).toISOString(),
    expirationTime: new Date((issuedUnix + SIGN_IN_TTL_SECS) * 1000).toISOString(),
  };
}

export function signInText(f) {
  return (
    `${f.domain} wants you to sign in with your Solana account:\n${f.address}\n\n${f.statement}\n\n` +
    [
      `URI: ${f.uri}`,
      `Version: ${f.version}`,
      `Chain ID: ${f.chainId}`,
      `Nonce: ${f.nonce}`,
      `Issued At: ${f.issuedAt}`,
      `Expiration Time: ${f.expirationTime}`,
    ].join('\n')
  );
}

/** Lamports (string or bigint) to SOL text. */
export function sol(lamports) {
  if (lamports === null || lamports === undefined) return '-';
  const v = BigInt(lamports);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const frac = (abs % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${abs / 1_000_000_000n}${frac ? '.' + frac : ''}`;
}

/** Coin atoms (1 coin = 10^9 atoms) to coin text. */
export function coins(atoms) {
  return sol(atoms);
}

export function randomHex(bytes) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** SOL text ("0.25") to a lamport string. */
export function toLamports(text) {
  const m = /^(\d+)(?:\.(\d{1,9}))?$/.exec(String(text).trim());
  if (!m) throw new Error('amount must be a number of SOL, for example 0.5');
  return (BigInt(m[1]) * 1_000_000_000n + BigInt((m[2] ?? '').padEnd(9, '0'))).toString();
}

export function fromBase64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

// ---------- checking a transaction before the wallet signs it ----------
//
// The server builds each escrow transaction and the wallet signs its message bytes. A server that
// is buggy or compromised could slip in something else (for example a plain SOL transfer out of
// the wallet). checkEscrowTx decodes the bytes and refuses anything that is not exactly one call
// to the escrow program, paid for and signed only by this player, matching what the player asked.
//
// Instruction discriminators: first 8 bytes of sha256("global:<name>"), as in contracts/idl.
// A server test checks these against the committed IDL.
export const ESCROW_DISCRIMINATORS = {
  create_balance: [66, 93, 102, 227, 148, 66, 64, 87],
  deposit: [242, 35, 198, 137, 82, 225, 242, 182],
  withdraw: [183, 18, 70, 156, 148, 109, 161, 34],
  open_match: [208, 231, 100, 44, 102, 12, 220, 99],
  join_match: [244, 8, 47, 130, 192, 59, 179, 44],
  cancel_match: [142, 136, 247, 45, 92, 112, 180, 83],
  respond_rematch: [0, 203, 203, 115, 106, 175, 107, 34],
};

// For each action: number of accounts, where the match account sits (if any), argument bytes.
const ESCROW_SHAPES = {
  create_balance: { accounts: 3, matchAt: null, args: 0 },
  deposit: { accounts: 3, matchAt: null, args: 8 },
  withdraw: { accounts: 2, matchAt: null, args: 8 },
  open_match: { accounts: 6, matchAt: null, args: 12 },
  join_match: { accounts: 4, matchAt: 3, args: 12 },
  cancel_match: { accounts: 4, matchAt: 1, args: 0 },
  respond_rematch: { accounts: 6, matchAt: 2, args: 1 },
};

function readCompactU16(bytes, at) {
  let value = 0;
  for (let k = 0; k < 3; k++) {
    if (at.i >= bytes.length) throw new Error('transaction is cut short');
    const b = bytes[at.i++];
    value |= (b & 0x7f) << (7 * k);
    if ((b & 0x80) === 0) return value;
  }
  throw new Error('bad length field');
}

function take(bytes, at, n) {
  if (at.i + n > bytes.length) throw new Error('transaction is cut short');
  const out = bytes.subarray(at.i, at.i + n);
  at.i += n;
  return out;
}

/** Decode a legacy Solana transaction message (the bytes a wallet signs). */
export function decodeTxMessage(bytes) {
  const at = { i: 0 };
  if (bytes.length === 0 || bytes[0] & 0x80) throw new Error('only legacy transactions are accepted');
  const [requiredSignatures, readonlySigned, readonlyUnsigned] = take(bytes, at, 3);
  const keys = [];
  const nKeys = readCompactU16(bytes, at);
  for (let k = 0; k < nKeys; k++) keys.push(base58Encode(take(bytes, at, 32)));
  const recentBlockhash = base58Encode(take(bytes, at, 32));
  const instructions = [];
  const nIx = readCompactU16(bytes, at);
  for (let k = 0; k < nIx; k++) {
    const programIndex = take(bytes, at, 1)[0];
    const nAcc = readCompactU16(bytes, at);
    const accounts = [...take(bytes, at, nAcc)];
    const data = take(bytes, at, readCompactU16(bytes, at));
    instructions.push({ programIndex, accounts, data });
  }
  if (at.i !== bytes.length) throw new Error('extra bytes after the transaction');
  for (const ix of instructions) {
    if (ix.programIndex >= keys.length || ix.accounts.some((a) => a >= keys.length)) throw new Error('bad account index');
  }
  return { requiredSignatures, readonlySigned, readonlyUnsigned, keys, recentBlockhash, instructions };
}

const u64le = (b) => {
  let v = 0n;
  for (let k = 7; k >= 0; k--) v = (v << 8n) | BigInt(b[k]);
  return v;
};

/**
 * Throws with a plain reason unless `bytes` is exactly the escrow call `action` (as described by the
 * server: kind, amount, stake, matchAccount, accept) for `player` on program `programId`.
 * Returns a short description read from the bytes themselves.
 */
export function checkEscrowTx(bytes, { player, programId, action }) {
  const shape = ESCROW_SHAPES[action?.kind];
  if (!shape) throw new Error(`unexpected action ${action?.kind}`);
  const m = decodeTxMessage(bytes);
  if (m.requiredSignatures !== 1) throw new Error('the transaction asks for more than one signature');
  if (m.keys[0] !== player) throw new Error('the transaction is not paid for and signed by this wallet');
  if (m.instructions.length !== 1) throw new Error(`the transaction has ${m.instructions.length} instructions, expected 1`);
  const ix = m.instructions[0];
  if (m.keys[ix.programIndex] !== programId) throw new Error('the transaction calls a program other than the escrow');
  if (ix.accounts.length !== shape.accounts) throw new Error('the escrow call has the wrong accounts');
  if (ix.accounts[0] !== 0) throw new Error('the escrow call is not made by this wallet');
  const disc = ESCROW_DISCRIMINATORS[action.kind];
  if (ix.data.length !== 8 + shape.args || disc.some((b, k) => ix.data[k] !== b)) {
    throw new Error(`the escrow call is not ${action.kind}`);
  }
  const args = ix.data.subarray(8);
  let detail = action.kind.replace('_', ' ');
  if (action.kind === 'deposit' || action.kind === 'withdraw') {
    if (u64le(args) !== BigInt(action.amount)) throw new Error('the amount in the transaction differs');
    detail += ` ${sol(u64le(args))} SOL`;
  }
  if (action.kind === 'open_match' || action.kind === 'join_match') {
    // Both carry the stake and the match length (seconds); the contract refuses a join whose
    // expected stake or length differs from the match, so B cannot be put in another match.
    if (u64le(args) !== BigInt(action.stake)) throw new Error('the stake in the transaction differs');
    const length = args[8] | (args[9] << 8) | (args[10] << 16) | (args[11] << 24);
    if (length >>> 0 !== Number(action.lengthSecs)) throw new Error('the match length in the transaction differs');
    detail += ` with a ${sol(u64le(args))} SOL stake, ${length >>> 0} s long`;
  }
  if (action.kind === 'respond_rematch') {
    if (args[0] !== (action.accept ? 1 : 0)) throw new Error('the rematch answer in the transaction differs');
    detail += args[0] ? ' (yes)' : ' (no)';
  }
  if (shape.matchAt !== null) {
    const matchAccount = m.keys[ix.accounts[shape.matchAt]];
    if (matchAccount !== action.matchAccount) throw new Error('the match account in the transaction differs');
    detail += ` (match ${matchAccount})`;
  }
  return detail;
}

/**
 * Does the server's described action fit what the player last asked for on this page?
 * `intent` is set by the page when the player clicks: { kind: 'account', action, amount },
 * { kind: 'queue', stake }, { kind: 'leave' } or { kind: 'rematch', accept }.
 */
export function actionMatchesIntent(action, intent) {
  if (!intent || !action) return false;
  switch (intent.kind) {
    case 'account':
      if (action.kind !== intent.action) return false;
      return action.kind === 'create_balance' || String(action.amount) === String(intent.amount);
    case 'queue':
      return (
        (action.kind === 'join_match' || action.kind === 'open_match') &&
        String(action.stake) === String(intent.stake) &&
        String(action.lengthSecs) === String(intent.lengthSecs)
      );
    case 'leave':
      return action.kind === 'cancel_match';
    case 'rematch':
      return action.kind === 'respond_rematch' && action.accept === intent.accept;
    case 'transfer':
      return action.kind === 'transfer' && action.to === intent.to && String(action.amount) === String(intent.amount);
    default:
      return false;
  }
}

const STANDIN_HEADER = 'PonsStars stand-in transaction v1';

/** The development-only stand-in escrow signs a text instead of a transaction. Same checks. */
export function checkStandinTx(bytes, { player, programId, action }) {
  const lines = new TextDecoder().decode(bytes).split('\n');
  if (lines.length !== 5 || lines[0] !== STANDIN_HEADER) throw new Error('not a stand-in transaction');
  if (lines[1] !== `program: ${programId}`) throw new Error('the stand-in transaction names another program');
  if (lines[2] !== `player: ${player}`) throw new Error('the stand-in transaction is for another wallet');
  if (!/^nonce: [0-9a-f]{32}$/.test(lines[4])) throw new Error('bad stand-in nonce');
  if (!lines[3].startsWith('action: ')) throw new Error('bad stand-in action');
  const signed = JSON.parse(lines[3].slice('action: '.length));
  const fields = ['kind', 'amount', 'stake', 'matchAccount', 'accept', 'to', 'lengthSecs'];
  const same = (a, b) => (a === undefined || a === null ? '' : String(a)) === (b === undefined || b === null ? '' : String(b));
  if (Object.keys(signed).some((k) => !fields.includes(k)) || fields.some((f) => !same(signed[f], action[f]))) {
    throw new Error('the stand-in action differs from the request');
  }
  return `${action.kind.replace('_', ' ')} (stand-in escrow, no real chain)`;
}

/**
 * Check a sign request before the wallet signs it. Throws with a plain reason if it must be
 * refused. `dev` allows the stand-in text format (development mode only).
 */
export function checkSignRequest(bytes, { player, programId, action, intent, dev }) {
  if (!actionMatchesIntent(action, intent)) throw new Error('this is not what you asked for on this page');
  const head = new TextDecoder().decode(bytes.subarray(0, STANDIN_HEADER.length));
  if (head === STANDIN_HEADER) {
    if (!dev) throw new Error('stand-in transactions are only allowed in development mode');
    return checkStandinTx(bytes, { player, programId, action });
  }
  if (action?.kind === 'transfer') return checkTransferTx(bytes, { player, action });
  return checkEscrowTx(bytes, { player, programId, action });
}

const SYSTEM_PROGRAM = '11111111111111111111111111111111';

/**
 * A plain SOL transfer (used to fund a new PonsStars wallet): exactly one System Program transfer
 * of `action.amount` lamports from this wallet to `action.to`, paid for and signed by this wallet only.
 */
export function checkTransferTx(bytes, { player, action }) {
  const m = decodeTxMessage(bytes);
  if (m.requiredSignatures !== 1) throw new Error('the transaction asks for more than one signature');
  if (m.keys[0] !== player) throw new Error('the transaction is not paid for and signed by this wallet');
  if (m.instructions.length !== 1) throw new Error(`the transaction has ${m.instructions.length} instructions, expected 1`);
  const ix = m.instructions[0];
  if (m.keys[ix.programIndex] !== SYSTEM_PROGRAM) throw new Error('the transfer is not a plain SOL transfer');
  if (ix.accounts.length !== 2 || ix.accounts[0] !== 0) throw new Error('the transfer has the wrong accounts');
  const d = ix.data;
  if (d.length !== 12 || d[0] !== 2 || d[1] !== 0 || d[2] !== 0 || d[3] !== 0) throw new Error('the transfer is not a plain SOL transfer');
  const to = m.keys[ix.accounts[1]];
  if (to !== action.to) throw new Error('the transfer goes to another address');
  const amount = u64le(d.subarray(4));
  if (amount !== BigInt(action.amount)) throw new Error('the amount in the transaction differs');
  return `send ${sol(amount)} SOL to ${to}`;
}
