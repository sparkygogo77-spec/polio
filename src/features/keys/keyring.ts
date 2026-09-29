"use client";
/**
 * How a key is written down when there is no PIN, and exactly what that buys.
 *
 * It used to be written down in the clear: `builder.keys.plain`, a JSON line
 * in localStorage with `sk-ant-…` sitting in it, readable by anything that
 * could read the browser's storage — a copied profile, a synced backup, a
 * glance at the Application tab, a one-line snippet, a screen share. That is
 * the thing this replaces. There is now one representation of a key and it is
 * never the key itself.
 *
 * THE MECHANISM. On first use this browser generates an AES-GCM key marked
 * **non-extractable** and keeps it in IndexedDB. Non-extractable is the whole
 * point and it is enforced by the browser, not by us: the page can hand that
 * key to `encrypt` and `decrypt`, and there is no call, ours or anyone's,
 * that will hand back its bytes. The API keys are sealed with it and only the
 * sealed box is written to localStorage.
 *
 * WHAT IT STOPS. Anything that reads storage without running code on this
 * page. Copying the profile directory, restoring a backup, reading the
 * Application tab over someone's shoulder, a snippet that dumps localStorage,
 * an extension that reads storage rather than injecting into the page: all of
 * those now get a box they cannot open, because the key that opens it is not
 * in what they took.
 *
 * WHAT IT DOES NOT STOP, said plainly so nobody is told otherwise. Code
 * running on this origin. An injected script, an extension with page access,
 * or the person's own console can call `unwrap` exactly as the app does, for
 * as long as this browser holds the IndexedDB key. It is not a safe, it is
 * not protection from the machine's owner, and it is not a substitute for the
 * key living on a server. The only thing that keeps a key from code on the
 * page is a secret that is not stored at all, which is what the PIN
 * (`crypto.ts`) is for, and only while it is locked.
 *
 * So: encrypted at rest against anything that reads the disk, open to
 * anything that runs here. That is the honest sentence, and it is the one the
 * panel says.
 */

const DB = "builder.keyring";
const SHELF = "k";
const ID = "browser";
const IV_BYTES = 12;

/** The one representation: a sealed box wearing its format. */
export interface WrappedBox {
  v: 2;
  iv: string;
  cipher: string;
}

export const isWrapped = (v: unknown): v is WrappedBox => {
  const b = v as WrappedBox | null;
  return !!b && b.v === 2 && typeof b.iv === "string" && typeof b.cipher === "string";
};

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (b: ArrayBuffer | Uint8Array): string => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (const byte of u) s += String.fromCharCode(byte);
  return btoa(s);
};

const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Web Crypto will not take a view that might sit on a SharedArrayBuffer. */
const bytes = (u: Uint8Array): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(new ArrayBuffer(u.byteLength));
  out.set(u);
  return out;
};

/** Both halves have to be there: the cryptography and somewhere to keep the key. */
export function canWrap(): boolean {
  return typeof indexedDB !== "undefined" && !!globalThis.crypto?.subtle;
}

function shelf(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return new Promise((ok, no) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(SHELF)) req.result.createObjectStore(SHELF); };
    req.onerror = () => no(req.error ?? new Error("No IndexedDB here."));
    req.onsuccess = () => {
      try {
        ok(req.result.transaction(SHELF, mode).objectStore(SHELF));
      } catch (err) {
        no(err);
      }
    };
  });
}

const ask = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((ok, no) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => no(req.error ?? new Error("IndexedDB refused."));
  });

/**
 * This browser's wrapping key, made once and kept.
 *
 * `extractable: false` is the line that matters: the browser will not export
 * it, so it cannot be copied out of here by us or by anything else. It is
 * cached for the page so a reload is one IndexedDB read rather than one per
 * key.
 */
let cached: Promise<CryptoKey> | null = null;

export function browserKey(): Promise<CryptoKey> {
  if (cached) return cached;
  cached = (async () => {
    const held = await ask<CryptoKey | undefined>((await shelf("readonly")).get(ID));
    if (held) return held;
    const made = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await ask((await shelf("readwrite")).put(made, ID));
    return made;
  })().catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}

/** Seal a value with this browser's key. A fresh nonce every time. */
export async function wrap(value: unknown): Promise<WrappedBox> {
  const key = await browserKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: bytes(iv) }, key, enc.encode(JSON.stringify(value)));
  return { v: 2, iv: toB64(iv), cipher: toB64(cipher) };
}

/** Open one. Null rather than a throw: a box this browser cannot open is a box it does not have. */
export async function unwrap<T>(box: WrappedBox): Promise<T | null> {
  try {
    const key = await browserKey();
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(fromB64(box.iv)) }, key, bytes(fromB64(box.cipher)));
    return JSON.parse(dec.decode(plain)) as T;
  } catch {
    return null;
  }
}

/** Throw the wrapping key away, so every box it sealed becomes unopenable. */
export async function shred(): Promise<void> {
  cached = null;
  try {
    await ask((await shelf("readwrite")).delete(ID));
  } catch {
    /* there was nothing to throw away */
  }
}
