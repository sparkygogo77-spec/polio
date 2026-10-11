/**
 * WHERE THE DOCUMENT LIVES: IndexedDB, with localStorage beside it.
 *
 * The Builder's document was one localStorage key, `builder.studio`, and
 * localStorage holds about 5 MB: share.xyz's three pages are 8.5 MB, and
 * the save threw inside the import. The document now lives in IndexedDB
 * (`builder.docs`), which has no such ceiling, and localStorage keeps a
 * MIRROR beside it for everything that reads the key directly — the builds
 * store's shape of each site, the headless route's seed, the tests:
 *
 *   - a document that fits is mirrored whole, so every reader sees what it
 *     saw before;
 *   - one that does not fit whole is mirrored with its paths packed
 *     (`from.selector` → `from.sel`, `body > div:nth-of-type(2)` → `B/d.2`),
 *     which `mergeDoc` unpacks on the way in;
 *   - one that does not fit even packed leaves a POINTER: `{"idb":true,
 *     "bytes","pages","parts","siteRepo"}`, enough for the shape of a site.
 *
 * READING: a full document in localStorage wins and is carried into
 * IndexedDB — that is the migration of what was there before this file,
 * and it is what lets a test or the headless route seed the key as they
 * always have. Only a pointer sends the read to IndexedDB; a key with
 * nothing in it is a fresh board, as it always was.
 *
 * WRITING: the mirror at once, the IndexedDB copy a moment later (one
 * write per key per burst of edits; flushed when the tab is hidden).
 */

export const DOC_DB = "builder.docs";
const SHELF = "docs";
/** How much of a document localStorage takes, in characters: under its 5 MB with the other keys beside it. */
export const MIRROR_MAX = 2_500_000;

export interface Pointer { idb: true; bytes: number; pages: number; parts: number; siteRepo: string | null }

const ok = () => typeof indexedDB !== "undefined";
const store = (): Storage | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };

function shelf(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return new Promise((done, no) => {
    const req = indexedDB.open(DOC_DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(SHELF)) req.result.createObjectStore(SHELF); };
    req.onerror = () => no(req.error ?? new Error("No document storage in this browser."));
    req.onsuccess = () => {
      try { done(req.result.transaction(SHELF, mode).objectStore(SHELF)); } catch (err) { no(err); }
    };
  });
}
const ask = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((done, no) => { req.onsuccess = () => done(req.result); req.onerror = () => no(req.error ?? new Error("Storage refused.")); });

export async function idbGet(key: string): Promise<string | null> {
  if (!ok()) return null;
  try { const v = await ask((await shelf("readonly")).get(key)); return typeof v === "string" ? v : null; } catch { return null; }
}
export async function idbSet(key: string, value: string | null): Promise<boolean> {
  if (!ok()) return false;
  try {
    const s = await shelf("readwrite");
    if (value === null) await ask(s.delete(key)); else await ask(s.put(value, key));
    return true;
  } catch { /* storage off: the mirror is what there is */ return false; }
}

/* ------------------------------------------------------------------ */
/* Packed paths                                                          */
/* ------------------------------------------------------------------ */

/** One letter per tag the capture writes; a tag not here travels in braces. Digits are for h1..h6, so a step's own number comes after a dot. */
const TAG_CODE: Record<string, string> = {
  div: "d", span: "s", a: "a", p: "p", img: "i", svg: "v", path: "h", button: "b", ul: "u", li: "l", section: "S", header: "H", main: "M", footer: "F", nav: "N",
  article: "A", body: "B", aside: "D", form: "f", input: "I", label: "L", table: "T", tr: "r", td: "t", th: "e", tbody: "y", thead: "o", ol: "O", figure: "g",
  picture: "P", strong: "R", em: "E", small: "m", time: "w", code: "c", pre: "x", video: "V", canvas: "C", iframe: "X", br: "k", textarea: "n", blockquote: "q",
  g: "G", select: "z", option: "Z", fieldset: "j", legend: "J", figcaption: "K", sup: "Q", sub: "W", hr: "Y", h1: "1", h2: "2", h3: "3", h4: "4", h5: "5", h6: "6",
};
const CODE_TAG: Record<string, string> = Object.fromEntries(Object.entries(TAG_CODE).map(([t, c]) => [c, t]));

/** A recorded path, packed: null when it is not the shape the capture writes, so it travels as it was. */
export function packSelector(selector: string): string | null {
  const steps = selector.split(" > ");
  const out: string[] = [];
  for (const step of steps) {
    const m = /^([a-zA-Z][\w-]*)(?::nth-of-type\((\d+)\))?$/.exec(step);
    if (!m) return null;
    const tag = m[1]!;
    const code = TAG_CODE[tag] ?? `{${tag}}`;
    out.push(m[2] ? `${code}.${m[2]}` : code);
  }
  return out.join("/");
}
/** The path back, exactly; null when the packed form is not one this wrote. */
export function unpackSelector(packed: string): string | null {
  const out: string[] = [];
  for (const step of packed.split("/")) {
    const m = /^(\{[a-zA-Z][\w-]*\}|[A-Za-z0-9])(?:\.(\d+))?$/.exec(step);
    if (!m) return null;
    const code = m[1]!;
    const tag = code.startsWith("{") ? code.slice(1, -1) : CODE_TAG[code];
    if (!tag) return null;
    out.push(m[2] ? `${tag}:nth-of-type(${m[2]})` : tag);
  }
  return out.join(" > ");
}

type From = { selector?: string; sel?: string } & Record<string, unknown>;
/** A node's `from`, with its path packed (`sel` in place of `selector`) when it packs. */
export function packFrom<T extends From>(from: T): T {
  if (typeof from.selector !== "string") return from;
  const sel = packSelector(from.selector);
  if (sel === null) return from;
  /* In the key's own place, so the text round-trips exactly. */
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(from)) { if (k === "selector") out.sel = sel; else out[k] = v; }
  return out as T;
}
/** …and back: a `sel` becomes the `selector` it was. */
export function unpackFrom<T extends From>(from: T): T {
  if (typeof from.sel !== "string") return from;
  const selector = unpackSelector(from.sel);
  if (selector === null) return from;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(from)) { if (k === "sel") out.selector = selector; else out[k] = v; }
  return out as T;
}

type Envelope = { state?: { nodes?: { from?: From | null }[]; pages?: unknown[]; siteRepo?: unknown } & Record<string, unknown>; version?: number; packed?: 1 };

/** The document's text with every path packed, marked so the read unpacks it. */
export function packDocText(text: string): string | null {
  try {
    const env = JSON.parse(text) as Envelope;
    if (!env.state || !Array.isArray(env.state.nodes)) return null;
    env.state.nodes = env.state.nodes.map((n) => (n.from ? { ...n, from: packFrom(n.from) } : n));
    env.packed = 1;
    return JSON.stringify(env);
  } catch { return null; }
}
/** A packed document's text as it was; any other text as it is. */
export function unpackDocText(text: string): string {
  if (!text.startsWith("{") || !/"packed":1/.test(text)) return text;
  try {
    const env = JSON.parse(text) as Envelope;
    if (env.packed !== 1) return text;
    if (env.state && Array.isArray(env.state.nodes)) env.state.nodes = env.state.nodes.map((n) => (n.from ? { ...n, from: unpackFrom(n.from) } : n));
    delete env.packed;
    return JSON.stringify(env);
  } catch { return text; }
}

/* ------------------------------------------------------------------ */
/* The mirror and the pointer                                           */
/* ------------------------------------------------------------------ */

export function isPointer(raw: string | null | undefined): boolean {
  return typeof raw === "string" && raw.startsWith('{"idb":true');
}
export function pointerOf(raw: string | null | undefined): Pointer | null {
  if (!isPointer(raw)) return null;
  try { const p = JSON.parse(raw!) as Pointer; return p && p.idb === true ? p : null; } catch { return null; }
}
/** The shape of a site — pages, parts, the repository it names — off a full document, a packed one, or a pointer. */
export function shapeOfRaw(raw: string | null | undefined): { pages: number; parts: number; siteRepo: string | null } | null {
  if (!raw) return null;
  const p = pointerOf(raw);
  if (p) return { pages: p.pages, parts: p.parts, siteRepo: p.siteRepo };
  try {
    const env = JSON.parse(raw) as Envelope;
    const st = env.state;
    if (!st) return null;
    const was = st.siteRepo;
    return { pages: Array.isArray(st.pages) ? st.pages.length : 0, parts: Array.isArray(st.nodes) ? st.nodes.length : 0, siteRepo: typeof was === "string" && was.trim() ? was.trim() : null };
  } catch { return null; }
}
function pointerFor(value: string): string {
  const shape = shapeOfRaw(value) ?? { pages: 0, parts: 0, siteRepo: null };
  const p: Pointer = { idb: true, bytes: value.length, ...shape };
  return JSON.stringify(p);
}

/**
 * What localStorage takes for a document: the whole of it, its paths packed, or a pointer. Pure, so it can be checked.
 *
 * `kept` is how much of the document the last pack of this key kept
 * (packed length over length, as `kept` comes back). Packing is a full read
 * and write of the document; on PST's 856 parts it kept 98% of 3.2 MB, still
 * past `max`, and it ran on every letter typed and every arrow pressed only
 * to be thrown away. When the last pack says this one cannot fit either,
 * the pack is skipped (a little slack for what changed since).
 */
export function mirrorText(value: string, max = MIRROR_MAX, kept?: number): { kind: "full" | "packed" | "pointer"; text: string; kept?: number } {
  if (value.length <= max) return { kind: "full", text: value };
  if (kept && value.length * kept > max * 1.02) return { kind: "pointer", text: pointerFor(value), kept };
  const packed = packDocText(value);
  const was = packed ? packed.length / value.length : undefined;
  if (packed && packed.length <= max) return { kind: "packed", text: packed, kept: was };
  return { kind: "pointer", text: pointerFor(value), kept: was };
}
/** Per key, how much the last pack kept (`mirrorText`). */
const packKept = new Map<string, number>();

/** The mirror as localStorage holds it: a document, a packed one, a pointer, or nothing. */
export function readMirror(key: string): string | null {
  try { return store()?.getItem(key) ?? null; } catch { return null; }
}
/** True when localStorage holds the whole document (not only a pointer to it). */
function writeMirror(key: string, value: string | null): boolean {
  const ls = store();
  if (!ls) return false;
  try {
    if (value === null) { ls.removeItem(key); return true; }
    const m = mirrorText(value, MIRROR_MAX, packKept.get(key));
    if (m.kept) packKept.set(key, m.kept); else packKept.delete(key);
    try { ls.setItem(key, m.text); return m.kind !== "pointer"; } catch { /* over quota all the same: a pointer, below */ }
    if (m.kind !== "pointer") ls.setItem(key, pointerFor(value));
  } catch { /* private mode, or nothing left: IndexedDB holds it */ }
  return false;
}

/*
 * WHETHER THE WORK ON SCREEN IS KEPT, for the line in the top bar
 * (`SaveLine.tsx`). A key is "saving" from the write until IndexedDB has it,
 * then "saved" with the time, or "failed" when neither IndexedDB nor
 * localStorage would take the whole document.
 */
export interface SaveState { state: "saving" | "saved" | "failed"; at: number }
const saves = new Map<string, SaveState>();
const saveListeners = new Set<() => void>();
function said(key: string, st: SaveState): void {
  saves.set(key, st);
  for (const fn of saveListeners) { try { fn(); } catch { /* its own trouble */ } }
}
/** How the last write of this key went, or null when nothing has been written this visit. */
export function saveStateOf(key: string): SaveState | null {
  return saves.get(key) ?? null;
}
export function onSave(fn: () => void): () => void {
  saveListeners.add(fn);
  return () => { saveListeners.delete(fn); };
}

/* ------------------------------------------------------------------ */
/* Reading and writing                                                  */
/* ------------------------------------------------------------------ */

/**
 * The document under a key.
 *
 * THE KEY IN LOCALSTORAGE SAYS WHAT THERE IS. A whole document there is the
 * document (carried into IndexedDB on the way); a pointer there sends the
 * read to IndexedDB; nothing there is nothing, whatever IndexedDB still
 * holds — the way removing the key always meant a fresh board, and a
 * check that removes it to start over (tests/selected-drags.mjs) starts
 * over.
 *
 * SYNCHRONOUS WHENEVER IT CAN BE. The Builder hydrated from localStorage in
 * the same tick as the page loaded, and a hundred checks rely on that:
 * open the page, put a document in the key, open it again. A read that
 * always went to IndexedDB finished after the page had settled, and the
 * store's first write — the empty default — landed on the document the
 * check had just put there. Only a pointer makes the read a Promise.
 */
export function readDoc(key: string): string | null | Promise<string | null> {
  const raw = readMirror(key);
  if (raw === null) return null;
  if (!isPointer(raw)) {
    const text = unpackDocText(raw);
    void idbSet(key, text);
    return text;
  }
  return idbGet(key);
}

const pending = new Map<string, string | null>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let inFlight: Promise<void> = Promise.resolve();
const mirrored = new Map<string, boolean>();
function flushKey(key: string): void {
  const t = timers.get(key);
  if (t) { clearTimeout(t); timers.delete(key); }
  if (!pending.has(key)) return;
  const value = pending.get(key) ?? null;
  pending.delete(key);
  inFlight = inFlight.then(async () => {
    const kept = await idbSet(key, value);
    if (!pending.has(key)) said(key, kept || mirrored.get(key) ? { state: "saved", at: Date.now() } : { state: "failed", at: Date.now() });
  });
}
/** Every write not yet in IndexedDB, written. */
export async function flushDocs(): Promise<void> {
  for (const key of [...pending.keys()]) flushKey(key);
  await inFlight;
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flushDocs(); });
}

/** A document written: the mirror now, IndexedDB a moment later. */
export function writeDoc(key: string, value: string | null): void {
  mirrored.set(key, writeMirror(key, value));
  if (saves.get(key)?.state !== "saving") said(key, { state: "saving", at: Date.now() });
  pending.set(key, value);
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(key, setTimeout(() => flushKey(key), 120));
}
/** A document written and in IndexedDB before this returns: for moving one between keys. */
export async function writeDocNow(key: string, value: string | null): Promise<void> {
  const whole = writeMirror(key, value);
  pending.delete(key);
  const t = timers.get(key);
  if (t) { clearTimeout(t); timers.delete(key); }
  const kept = await idbSet(key, value);
  said(key, kept || whole ? { state: "saved", at: Date.now() } : { state: "failed", at: Date.now() });
}
