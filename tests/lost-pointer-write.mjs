/**
 * A TAB CLOSED BEFORE INDEXEDDB HAD ITS LAST SAVE IS NOT "ANOTHER TAB".
 *
 * A document too big for localStorage leaves a pointer there at once and
 * goes into IndexedDB a moment later (`docStore.ts`). A big import brought
 * in and the tab reloaded in that moment left a pointer stamped with a write
 * IndexedDB never got. The next load read the older copy, took the pointer's
 * stamp for another tab's newer work, saved nothing, and stood "This site was
 * saved in another tab" over the board, placed by the save line, so the
 * board's pixels moved with it from one open to the next (gotchi.gg and
 * share.xyz in `tests/variations.mjs`). Now:
 *
 *   1. a pointer whose write IndexedDB is still about to get is waited for:
 *      the board opens on that write, not the older copy;
 *   2. a pointer whose write never lands: the board opens on what IndexedDB
 *      holds, no "another tab" bubble, the key made to agree with itself,
 *      and the next change is saved;
 *   3. saves that keep coming faster than the wait before IndexedDB still
 *      reach it within a second, so the pointer is never far ahead;
 *   4. the mirrors never fill localStorage: past a budget a document leaves
 *      its pointer, and the small keys beside it still write.
 *
 *   npx next start -p 3013
 *   node tests/lost-pointer-write.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/docStore.ts, src/features/studio/board/store/create.ts, src/features/studio/board/store/load.ts, src/features/studio/SaveLine.tsx
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const SMALL = JSON.parse(readFileSync("site/document.json", "utf8"));
const N0 = SMALL.nodes.length;
/** The document as a tab long gone saved it: stamped as that tab's `n`th write, `drop` parts fewer so the two copies are told apart. */
const envelope = (n, drop) => JSON.stringify({ state: { ...SMALL, nodes: SMALL.nodes.slice(0, N0 - drop) }, version: 0, by: `gonetab1:${n}` });
const pointerOf = (n) => JSON.stringify({ idb: true, bytes: 9_000_000, pages: SMALL.pages.length, parts: N0, siteRepo: null, by: `gonetab1:${n}` });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const idbPut = (text) => page.evaluate((text) => new Promise((done) => {
  const req = indexedDB.open("builder.docs", 1);
  req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("docs")) req.result.createObjectStore("docs"); };
  req.onsuccess = () => { const t = req.result.transaction("docs", "readwrite"); t.objectStore("docs").put(text, "builder.studio"); t.oncomplete = () => { req.result.close(); done(true); }; };
  req.onerror = () => done(false);
}), text);
const idbStamp = () => page.evaluate(() => new Promise((done) => {
  const req = indexedDB.open("builder.docs", 1);
  req.onsuccess = () => { const g = req.result.transaction("docs", "readonly").objectStore("docs").get("builder.studio"); g.onsuccess = () => { const t = String(g.result ?? "").slice(-120); const i = t.lastIndexOf('"by":"'); req.result.close(); done(i < 0 ? null : t.slice(i + 6, t.indexOf('"', i + 6))); }; };
  req.onerror = () => done(null);
}));
const mirrorStamp = () => page.evaluate(() => { const t = (localStorage.getItem("builder.studio") ?? "").slice(-120); const i = t.lastIndexOf('"by":"'); return i < 0 ? null : t.slice(i + 6, t.indexOf('"', i + 6)); });
const onBoard = () => page.evaluate(() => (window.__studioPublishDoc ? window.__studioPublishDoc().nodes.length : -1));
const bubble = () => page.evaluate(() => document.querySelector("[data-other-tab]")?.getAttribute("data-other-tab") ?? null);
/** Seeds the key and IndexedDB before the Builder's own scripts run, as a tab long gone left them. */
const seed = async (pointerN, idbN) => {
  await page.goto(`${URL_BASE}/builds`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("builder.builds", JSON.stringify({ state: { projects: [{ id: "s1", name: "Site 1", updatedAt: Date.now() }], activeId: "s1" }, version: 0 })));
  await idbPut(envelope(idbN, idbN === pointerN ? 0 : 2));
  await page.evaluate((p) => localStorage.setItem("builder.studio", p), pointerOf(pointerN));
};

/* 1. The pointer's write lands a moment after the board starts reading. */
await seed(9, 3);
const opening = page.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });
await opening;
await page.waitForTimeout(1200);
await idbPut(envelope(9, 0));
await page.waitForFunction((n) => typeof window.__studioPublishDoc === "function" && window.__studioPublishDoc().nodes.length === n, N0, { timeout: 30000 }).catch(() => {});
check("a write IndexedDB gets a moment late is waited for: the board opens on it", (await onBoard()) === N0, `${await onBoard()} parts, ${N0} in that write, ${N0 - 2} in the older copy`);
await page.waitForTimeout(1500);
check("…and no \"another tab\" bubble", (await bubble()) === null, String(await bubble()));

/* 2. The pointer's write never lands: its tab was closed first. */
await seed(9, 3);
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.__studioPublishDoc === "function" && window.__studioPublishDoc().nodes.length > 0, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
check("a write that never landed: the board opens on what IndexedDB holds", (await onBoard()) === N0 - 2, `${await onBoard()} parts`);
check("…with no \"another tab\" bubble over it", (await bubble()) === null, String(await bubble()));
await page.mouse.click(5, 5);
await page.waitForTimeout(800);
check("…not even once the tab is looked at", (await bubble()) === null, String(await bubble()));
check("…and the key agrees with itself again", (await idbStamp()) === (await mirrorStamp()), `IndexedDB ${await idbStamp()}, localStorage ${await mirrorStamp()}`);
await page.evaluate((doc) => window.__studioLoadDoc(doc), SMALL);
await page.waitForTimeout(1200);
const after = await mirrorStamp();
check("…and the next change is saved, as this tab's", !!after && !after.startsWith("gonetab1:") && (await idbStamp()) === after, `localStorage ${after}, IndexedDB ${await idbStamp()}`);

/* 3. Saves that keep coming, faster than the wait before IndexedDB (a big import drawing its pictures), still reach it. */
const before = await idbStamp();
const landedDuring = await page.evaluate(async (doc) => {
  const stampIn = () => new Promise((done) => {
    const req = indexedDB.open("builder.docs", 1);
    req.onsuccess = () => { const g = req.result.transaction("docs", "readonly").objectStore("docs").get("builder.studio"); g.onsuccess = () => { const t = String(g.result ?? "").slice(-120); const i = t.lastIndexOf('"by":"'); req.result.close(); done(i < 0 ? null : t.slice(i + 6, t.indexOf('"', i + 6))); }; };
    req.onerror = () => done(null);
  });
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    window.__studioLoadDoc({ ...doc, nodes: doc.nodes.map((n, k) => (k === 0 ? { ...n, label: `burst ${i}` } : n)) });
    await new Promise((r) => setTimeout(r, 50));
    if (i % 10 === 9) seen.add(await stampIn());
  }
  return [...seen];
}, SMALL);
check("saves coming every 50 ms for 3 s reach IndexedDB while they keep coming", landedDuring.some((s) => s && s !== before), `before ${before}, seen during: ${landedDuring.join(", ")}`);

/* 4. Mirrors never fill localStorage: past the budget a document leaves its pointer, and the small keys beside it still write. */
/* What the other keys take is counted afresh at most every two seconds: the filler is in place longer than that, as another store's keys are. */
await page.evaluate(() => localStorage.setItem("test.filler", "z".repeat(3_950_000)));
await page.waitForTimeout(2200);
const room = await page.evaluate(async (doc) => {
  window.__studioLoadDoc({ ...doc, nodes: doc.nodes.map((n, k) => (k === 0 ? { ...n, label: "past the budget" } : n)) });
  await new Promise((r) => setTimeout(r, 400));
  const live = localStorage.getItem("builder.studio") ?? "";
  let small = true;
  try { localStorage.setItem("test.small", "x".repeat(200_000)); } catch { small = false; }
  localStorage.removeItem("test.filler"); localStorage.removeItem("test.small");
  return { pointer: live.startsWith('{"idb":true'), small };
}, SMALL);
await page.waitForTimeout(800);
check("with localStorage nearly full of other keys, the document leaves a pointer", room.pointer, JSON.stringify(room));
check("…and a small key beside it still writes", room.small, JSON.stringify(room));
check("…and the board is still whole after a reload", await (async () => { await page.reload({ waitUntil: "networkidle" }); await page.waitForFunction((n) => typeof window.__studioPublishDoc === "function" && window.__studioPublishDoc().nodes.length === n, N0, { timeout: 30000 }).catch(() => {}); return (await onBoard()) === N0; })(), `${await onBoard()} parts`);
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? "FAILED" : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
