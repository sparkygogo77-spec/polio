/**
 * A SAVED BOARD: a site already brought in, opened without bringing it in.
 *
 * Bringing PonsStars in (the GitHub control against a stand-in GitHub, the
 * import, its stills) took a test or a thread a minute or more of browser
 * every time, for a board that was the same each time. A saved board is
 * what the browser held once the import had landed: every `builder.*`
 * localStorage key (no keys) and every IndexedDB store (the document in
 * `builder.docs`, the pictures and stills in `builder.pictures`), written to
 * tests/fixtures/boards/<name>.json by `npm run board -- refresh <name>`.
 *
 *   import { openBoard } from "./lib/board.mjs";
 *   const st = await openBoard(page, URL_BASE, "pst");   // the Builder, with PST on the board
 *
 * Any site can be saved the same way (see scripts/board.mjs). Refresh a
 * board only when its site changed; its `from` says which commit it is.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BOARDS = resolve(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "boards");

/** Keys a saved board never carries: what a person keeps to themselves. */
export const PRIVATE = /^builder\.(keys|keyring)/;

/** The saved board by name (or a path to one), as written by `dumpBoard`. */
export function readBoard(name) {
  const file = name.includes("/") ? name : join(BOARDS, `${name}.json.gz`);
  const raw = readFileSync(file);
  return JSON.parse((file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8"));
}

/** What this page's browser holds for the Builder: localStorage and IndexedDB, Blobs as base64. */
export async function dumpBoard(page) {
  return page.evaluate(async (privateSrc) => {
    const PRIVATE = new RegExp(privateSrc);
    const local = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("builder.") && !PRIVATE.test(k)) local[k] = localStorage.getItem(k); }
    const ask = (req) => new Promise((done, no) => { req.onsuccess = () => done(req.result); req.onerror = () => no(req.error); });
    const b64 = async (blob) => { const u = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
    const idb = {};
    for (const { name, version } of await indexedDB.databases()) {
      if (!name?.startsWith("builder.") || PRIVATE.test(name)) continue;
      const db = await ask(indexedDB.open(name, version));
      const stores = {};
      for (const store of db.objectStoreNames) {
        const s = db.transaction(store, "readonly").objectStore(store);
        const [keys, values] = await Promise.all([ask(s.getAllKeys()), ask(s.getAll())]);
        stores[store] = await Promise.all(keys.map(async (key, i) => {
          const v = values[i];
          return v instanceof Blob ? { key, blob: await b64(v), type: v.type } : { key, value: v };
        }));
      }
      db.close();
      idb[name] = { version, stores };
    }
    return { local, idb };
  }, PRIVATE.source);
}

/** Put a saved board into this origin's storage, over whatever was there. The page must be on the Builder's origin. */
export async function seedBoard(page, board) {
  await page.evaluate(async ({ local, idb }) => {
    const ask = (req) => new Promise((done, no) => { req.onsuccess = () => done(req.result); req.onerror = () => no(req.error); req.onblocked = () => done(null); });
    for (const k of Object.keys(localStorage)) if (k.startsWith("builder.") && !/^builder\.(keys|keyring)/.test(k)) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
    for (const [name, { version, stores }] of Object.entries(idb)) {
      await ask(indexedDB.deleteDatabase(name));
      const open = indexedDB.open(name, version);
      open.onupgradeneeded = () => { for (const s of Object.keys(stores)) open.result.createObjectStore(s); };
      const db = await ask(open);
      for (const [store, rows] of Object.entries(stores)) {
        if (!rows.length) continue;
        const tx = db.transaction(store, "readwrite");
        const s = tx.objectStore(store);
        for (const r of rows) s.put("blob" in r ? new Blob([Uint8Array.from(atob(r.blob), (c) => c.charCodeAt(0))], { type: r.type }) : r.value, r.key);
        await new Promise((done, no) => { tx.oncomplete = done; tx.onerror = () => no(tx.error); });
      }
      db.close();
    }
  }, board);
}

/**
 * Open the Builder with a saved board on it, no import. Answers the board's
 * document (`builder.studio`'s state) once its parts are drawn.
 */
export async function openBoard(page, base, name, { path = "/builder" } = {}) {
  const board = typeof name === "string" ? readBoard(name) : name;
  /* Any page of the same origin will do to reach its storage; the version route is the lightest. */
  await page.goto(`${base}/api/version`, { waitUntil: "load" });
  await seedBoard(page, board);
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate(() => (window.__studioNodes?.()?.length ?? 0) > 0 && document.querySelectorAll("[data-node-id]").length > 0)) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(500);
  return boardDoc(board);
}

/** The board's document (`builder.studio`'s state): the localStorage mirror when it is whole, else the IndexedDB copy it points at. */
export function boardDoc(board) {
  const read = (raw) => { try { return JSON.parse(raw ?? "null")?.state ?? null; } catch { return null; } };
  const mirror = read(board.local["builder.studio"]);
  if (mirror?.nodes) return mirror;
  return read(board.idb["builder.docs"]?.stores?.docs?.find((r) => r.key === "builder.studio")?.value) ?? { nodes: [] };
}
