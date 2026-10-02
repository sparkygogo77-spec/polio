// "Create a new wallet for PonsStars": a standard Solana wallet made entirely in this browser.
//
// - A 12-word secret phrase (BIP39) from the browser's secure random generator.
// - The key is derived the standard way (path m/44'/501'/0'/0', the same as Phantom, Solflare,
//   Backpack and `solana-keygen`), so the phrase can be imported into any of those wallets.
// - Nothing is sent to the server: no phrase, no key. This module makes no network calls.
// Web Crypto only (works in current browsers and in Node 22 for tests).
import { WORDS } from './vendor/bip39-english.js';

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

async function sha256(bytes) {
  return new Uint8Array(await subtle().digest('SHA-256', bytes));
}

async function hmacSha512(key, data) {
  const k = await subtle().importKey('raw', key, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  return new Uint8Array(await subtle().sign('HMAC', k, data));
}

function bitsOf(bytes) {
  return [...bytes].map((b) => b.toString(2).padStart(8, '0')).join('');
}

/** A new random secret phrase (12 words = 128 bits of randomness, or 24 words = 256 bits). */
export async function generateMnemonic(words = 12) {
  if (words !== 12 && words !== 24) throw new Error('12 or 24 words');
  const entropy = globalThis.crypto.getRandomValues(new Uint8Array(words === 12 ? 16 : 32));
  try {
    return await entropyToMnemonic(entropy);
  } finally {
    entropy.fill(0); // keep the raw randomness in memory no longer than needed
  }
}

export async function entropyToMnemonic(entropy) {
  const cs = entropy.length / 4; // checksum bits
  const bits = bitsOf(entropy) + bitsOf(await sha256(entropy)).slice(0, cs);
  const out = [];
  for (let i = 0; i < bits.length; i += 11) out.push(WORDS[parseInt(bits.slice(i, i + 11), 2)]);
  return out.join(' ');
}

/** Normalise a typed phrase: lower case, single spaces. */
export function normalizeMnemonic(phrase) {
  return String(phrase).normalize('NFKD').trim().toLowerCase().split(/\s+/).join(' ');
}

/** True if every word is on the list and the built-in checksum matches. */
export async function validateMnemonic(phrase) {
  const words = normalizeMnemonic(phrase).split(' ');
  if (words.length !== 12 && words.length !== 24) return false;
  const idx = words.map((w) => WORDS.indexOf(w));
  if (idx.some((i) => i < 0)) return false;
  const bits = idx.map((i) => i.toString(2).padStart(11, '0')).join('');
  const entBits = (words.length * 11 * 32) / 33;
  const entropy = Uint8Array.from(bits.slice(0, entBits).match(/.{8}/g).map((b) => parseInt(b, 2)));
  const check = bitsOf(await sha256(entropy)).slice(0, entBits / 32);
  return check === bits.slice(entBits);
}

/** BIP39 seed: PBKDF2-HMAC-SHA512, 2048 rounds, salt "mnemonic" + optional passphrase. */
export async function mnemonicToSeed(phrase, passphrase = '') {
  const key = await subtle().importKey('raw', enc.encode(normalizeMnemonic(phrase)), 'PBKDF2', false, ['deriveBits']);
  const salt = enc.encode(('mnemonic' + passphrase).normalize('NFKD'));
  return new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-512', salt, iterations: 2048 }, key, 512));
}

/** SLIP-10 Ed25519 key for path m/44'/501'/account'/0' (all steps hardened). */
export async function deriveSolanaSeed(seed, account = 0) {
  let I = await hmacSha512(enc.encode('ed25519 seed'), seed);
  let key = I.slice(0, 32);
  let chain = I.slice(32);
  for (const index of [44, 501, account, 0]) {
    const data = new Uint8Array(37);
    data.set(key, 1);
    new DataView(data.buffer).setUint32(33, (index | 0x80000000) >>> 0, false);
    I = await hmacSha512(chain, data);
    key = I.slice(0, 32);
    chain = I.slice(32);
  }
  return key;
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes) {
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

/**
 * Turn a 32-byte Ed25519 seed into a signing key the page can use. The returned private key cannot
 * be exported again (non-extractable), so it can sign but not be read back out of the browser.
 */
export async function keypairFromSeed(seed32) {
  const pkcs8 = new Uint8Array(48);
  pkcs8.set([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
  pkcs8.set(seed32, 16);
  const tmp = await subtle().importKey('pkcs8', pkcs8, { name: 'Ed25519' }, true, ['sign']);
  const jwk = await subtle().exportKey('jwk', tmp);
  const publicKey = Uint8Array.from(atob(jwk.x.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const privateKey = await subtle().importKey('pkcs8', pkcs8, { name: 'Ed25519' }, false, ['sign']);
  pkcs8.fill(0);
  return {
    address: base58(publicKey),
    sign: async (bytes) => new Uint8Array(await subtle().sign({ name: 'Ed25519' }, privateKey, bytes)),
  };
}

/** From a secret phrase to a usable wallet (address + signer), account 0 unless told otherwise. */
export async function walletFromMnemonic(phrase, account = 0) {
  if (!(await validateMnemonic(phrase))) throw new Error('that secret phrase is not valid (check the words and their order)');
  const seed = await mnemonicToSeed(phrase);
  const key = await deriveSolanaSeed(seed, account);
  seed.fill(0);
  const kp = await keypairFromSeed(key);
  key.fill(0);
  return kp;
}
