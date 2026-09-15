"use client";
/**
 * What a four-digit PIN can and cannot do.
 *
 * Four digits is ten thousand combinations. Nothing makes that a secret. What
 * it can do is cost something per guess: the PIN is stretched through PBKDF2
 * with a high iteration count before it becomes an AES key, so one attempt
 * takes a beat rather than no time at all, and the whole space takes hours of
 * a machine's attention rather than a blink. That turns a glance over your
 * shoulder, or a minute alone with an unlocked laptop, into a real obstacle.
 * It does not turn it into a keys panel, and the panel says so in as many words.
 *
 * There is no separate check for "is the PIN right". The entries are sealed
 * with AES-GCM, which authenticates what it encrypts, so a wrong PIN fails to
 * open the box and that failure *is* the answer. Nothing about the PIN is
 * written down — not the PIN, not a hash of it — so there is nothing on disk
 * to attack offline except the box itself.
 *
 * Everything here runs in the browser through the Web Crypto API. No key
 * material is sent anywhere by this file.
 */

const ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface SealedBox {
  /** The format, so a later change can migrate rather than throw away. */
  v: 1;
  salt: string;
  iv: string;
  cipher: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (b: ArrayBuffer | Uint8Array): string => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s);
};

const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/**
 * A view whose buffer is a plain ArrayBuffer.
 *
 * Web Crypto will not take a view that might sit on a SharedArrayBuffer, and
 * TypeScript cannot tell the difference, so the bytes are copied into one it
 * can vouch for rather than silenced with a cast.
 */
const bytes = (u: Uint8Array): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(new ArrayBuffer(u.byteLength));
  out.set(u);
  return out;
};

function subtle(): SubtleCrypto {
  const c = globalThis.crypto?.subtle;
  // Web Crypto needs a secure context: https, or localhost.
  if (!c) throw new Error("This browser will not do cryptography here. A secure connection is needed.");
  return c;
}

/** The PIN, stretched into an AES key. Deliberately slow. */
async function keyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", salt: bytes(salt), iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Seal a value under a PIN. A fresh salt and nonce every time. */
export async function seal(value: unknown, pin: string): Promise<SealedBox> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await keyFromPin(pin, salt);
  const cipher = await subtle().encrypt({ name: "AES-GCM", iv: bytes(iv) }, key, enc.encode(JSON.stringify(value)));
  return { v: 1, salt: toB64(salt), iv: toB64(iv), cipher: toB64(cipher) };
}

/** Open a box. A wrong PIN throws, because AES-GCM refuses to authenticate it. */
export async function open<T>(box: SealedBox, pin: string): Promise<T> {
  const key = await keyFromPin(pin, fromB64(box.salt));
  const plain = await subtle().decrypt({ name: "AES-GCM", iv: bytes(fromB64(box.iv)) }, key, bytes(fromB64(box.cipher)));
  return JSON.parse(dec.decode(plain)) as T;
}

/** Roughly how long one guess costs on this machine, for the panel to quote honestly. */
export async function guessCostMs(): Promise<number> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const t0 = performance.now();
  await keyFromPin("0000", salt);
  return Math.round(performance.now() - t0);
}

export const isPin = (s: string): boolean => /^\d{4}$/.test(s);
