"use client";
/**
 * Where a picture's bytes live, which is nowhere near the document.
 *
 * THE RULE. The document holds a path and nothing else. The bytes live in
 * this browser's file storage while the site is being built, and in the
 * repository once it is published. They never go into `builder.studio`.
 *
 * Three reasons, all of them costs somebody pays:
 *
 *  - localStorage is small and unforgiving, and the document shares it with
 *    his builds, his keys and his look settings. One photograph inlined can
 *    fill it, and when it goes it takes the whole board with it, not just
 *    the picture.
 *  - A deployment keeps a copy of everything it was given, and is charged by
 *    how much and for how long. Bytes in the document are bytes in every
 *    publish, for ever, whether or not the picture changed.
 *  - A file in a repository changes only when the picture changes, and git
 *    keeps one copy of it however many commits go past.
 *
 * SO: `put` takes a file and gives back a record — an id, the path the
 * published site will use, the size it really is. The part keeps that
 * record. `urlFor` hands back something an `<img>` can point at while the
 * work is happening, and `bytesFor` hands the file itself to the publish.
 *
 * AND WHEN IT IS NOT THERE. A browser can lose this storage — cleared site
 * data, a private window, another machine. A part whose picture is gone
 * says so, in as many words, rather than drawing a hole: the same rule as
 * everywhere else, that a thing which cannot be shown says it cannot be
 * shown.
 */

const DB = "builder.pictures";
const SHELF = "files";

/** What the document keeps: a reference, never the thing itself. */
export interface Picture {
  /** The file's own name in storage and in the repository. */
  id: string;
  /** Where it will be in the published site, relative to its root. */
  path: string;
  /** What it is, so the publish can name it and a browser can read it. */
  type: string;
  /** Its own size, so a part can keep its shape before the bytes arrive. */
  w: number;
  h: number;
  /** Bytes, for saying what a publish will carry. */
  bytes: number;
  /** What it shows, for anyone who cannot see it. */
  alt: string;
  /** Where it came from: chosen from a machine, or drawn to order. */
  from: "upload" | "drawn";
  /** The commit that carried it up, when one has. Absent means this browser only. */
  published?: string;
}

const ok = () => typeof indexedDB !== "undefined";

function shelf(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return new Promise((done, no) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(SHELF)) req.result.createObjectStore(SHELF); };
    req.onerror = () => no(req.error ?? new Error("No file storage in this browser."));
    req.onsuccess = () => {
      try { done(req.result.transaction(SHELF, mode).objectStore(SHELF)); } catch (err) { no(err); }
    };
  });
}

const ask = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((done, no) => { req.onsuccess = () => done(req.result); req.onerror = () => no(req.error ?? new Error("Storage refused.")); });

/** The extension a type wears, so a published file is named the way a file is. */
const endsWith = (type: string): string => {
  const t = type.toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  if (t.includes("svg")) return "svg";
  if (t.includes("avif")) return "avif";
  return "bin";
};

/** How big it really is, so a part can hold its shape before anything loads. */
function sizeOf(blob: Blob): Promise<{ w: number; h: number }> {
  return new Promise((done) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { done({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 }); URL.revokeObjectURL(url); };
    img.onerror = () => { done({ w: 0, h: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/** Keep a picture, and hand back the reference the document will hold. */
export async function put(blob: Blob, opts: { alt?: string; from?: Picture["from"]; name?: string } = {}): Promise<Picture> {
  if (!ok()) throw new Error("This browser has no file storage, so a picture cannot be kept here.");
  const id = `pic_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const type = blob.type || "image/png";
  const { w, h } = await sizeOf(blob);
  await ask((await shelf("readwrite")).put(blob, id));
  arrived(id);
  return { id, path: `assets/pictures/${id}.${endsWith(type)}`, type, w, h, bytes: blob.size, alt: opts.alt ?? opts.name ?? "", from: opts.from ?? "upload" };
}

/**
 * Keep a picture under the id a document already names.
 *
 * A site copied from its repository brings its document whole, and every
 * part in it points at a picture by id and path. The bytes are in the
 * repository at that path; put here under that same id, the part finds
 * them exactly as it did in the browser that published it. `put` makes a
 * new id, which would be a new picture nothing points at.
 */
export async function keep(pic: Picture, blob: Blob): Promise<void> {
  if (!ok()) throw new Error("This browser has no file storage, so a picture cannot be kept here.");
  await ask((await shelf("readwrite")).put(blob, pic.id));
  arrived(pic.id);
}

/** The file itself, for the publish to carry. Null when this browser no longer has it. */
export async function bytesFor(pic: Picture): Promise<Blob | null> {
  if (!ok()) return null;
  try {
    return (await ask<Blob | undefined>((await shelf("readonly")).get(pic.id))) ?? null;
  } catch {
    return null;
  }
}

/**
 * Something an `<img>` can point at, while the work is happening.
 *
 * One address per picture for as long as the page lives, because a new one
 * every render is a leak and a flicker. Undefined means this browser does
 * not have the bytes: the caller must say so rather than draw nothing.
 */
const addresses = new Map<string, string>();
const asked = new Set<string>();

/*
 * BYTES THAT ARRIVE AFTER THE PART IS DRAWN. A site brought in from its
 * repository lands on the board first and has its pictures kept a moment
 * later, one by one. Measured on a fresh import of sink: the board looked
 * for the Solana mark 2ms before its bytes were kept, found nothing, and
 * said it was lost until a reload. So a look that finds nothing is not the
 * last word: keeping a picture forgets that miss and tells whoever is
 * drawing it to look again.
 */
const waiting = new Map<string, Set<() => void>>();

function arrived(id: string): void {
  asked.delete(id);
  for (const again of waiting.get(id) ?? []) again();
}

/** Be told when a picture's bytes are kept here. Returns the way to stop. */
function onArrive(id: string, again: () => void): () => void {
  const set = waiting.get(id) ?? new Set<() => void>();
  set.add(again);
  waiting.set(id, set);
  return () => { set.delete(again); if (!set.size) waiting.delete(id); };
}

export function urlFor(pic: Picture): string | undefined {
  return addresses.get(pic.id);
}

/*
 * A look in flight, by id. Two readers of one picture — the bar's mark and
 * the logo part on the board — asked together, and the second was told
 * "nothing" while the first was still reading, said lost, and was never
 * drawn again (tests/picture-arrives.mjs). The second waits for the first.
 */
const looking = new Map<string, Promise<string | null>>();

/** Fetch it into an address, once, and tell the caller when it is there. */
export async function reach(pic: Picture): Promise<string | null> {
  const had = addresses.get(pic.id);
  if (had) return had;
  const going = looking.get(pic.id);
  if (going) return going;
  if (asked.has(pic.id)) return null;
  asked.add(pic.id);
  const look = (async () => {
    const blob = await bytesFor(pic);
    if (!blob) return null;
    /* Two parts showing one picture can both be looking; one address serves both. */
    const also = addresses.get(pic.id);
    if (also) return also;
    const url = URL.createObjectURL(blob);
    addresses.set(pic.id, url);
    return url;
  })().finally(() => looking.delete(pic.id));
  looking.set(pic.id, look);
  return look;
}

/** Throw one away: the part has let go of it, or it has been replaced. */
export async function drop(pic: Picture): Promise<void> {
  const url = addresses.get(pic.id);
  if (url) { URL.revokeObjectURL(url); addresses.delete(pic.id); }
  asked.delete(pic.id);
  if (!ok()) return;
  try { await ask((await shelf("readwrite")).delete(pic.id)); } catch { /* it was already gone */ }
}

/** Every picture this browser still holds, by id: what a publish can actually carry. */
export async function held(): Promise<Set<string>> {
  if (!ok()) return new Set();
  try {
    return new Set(await ask<IDBValidKey[]>((await shelf("readonly")).getAllKeys()) as string[]);
  } catch {
    return new Set();
  }
}

/** Base64, which is how a file reaches a repository. */
export function base64(blob: Blob): Promise<string> {
  return new Promise((done, no) => {
    const r = new FileReader();
    r.onload = () => done(String(r.result).split(",")[1] ?? "");
    r.onerror = () => no(r.error ?? new Error("Could not read the file."));
    r.readAsDataURL(blob);
  });
}

/* ------------------------------------------------------------------ */
/* Reaching one from a component                                        */
/* ------------------------------------------------------------------ */

import * as React from "react";

/**
 * Something to point an `<img>` at, and whether the looking is over.
 *
 * `src` undefined with `looked` true means this browser does not have the
 * bytes, which is a thing to say and not a thing to hide. The address is
 * kept for the life of the page, so a re-render is not a re-read and not a
 * flicker.
 */
export function usePicture(pic: Picture | null | undefined): { src?: string; looked: boolean } {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  const id = pic?.id;
  const known = pic ? urlFor(pic) : undefined;
  const [looked, setLooked] = React.useState(!!known);
  React.useEffect(() => {
    if (!pic || known) return;
    let alive = true;
    const look = () => { void reach(pic).then(() => { if (alive) { setLooked(true); bump(); } }); };
    look();
    /* Not here yet is not gone: look again the moment the bytes are kept. */
    const stop = onArrive(pic.id, look);
    return () => { alive = false; stop(); };
    // The picture is the dependency, and its id is what identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return { src: known, looked: looked || !pic };
}
