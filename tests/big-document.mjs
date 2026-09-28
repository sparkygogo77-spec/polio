/**
 * THE DOCUMENT LIVES IN INDEXEDDB, AND WHAT WAS IN LOCALSTORAGE SURVIVES.
 *
 * share.xyz's three pages are an 8.5 MB document, past localStorage's
 * quota: the save threw inside the import and the board lost its pictures.
 * The document's home is IndexedDB now (docStore.ts), with localStorage
 * beside it as a mirror of what fits or a pointer for what does not.
 *
 *   1. A document already in localStorage — the owner's site, from before —
 *      is read from there, carried into IndexedDB, and still there after a
 *      reload; removing the key still starts a fresh board, as it always did.
 *   2. A document past the quota is on the board, leaves a pointer in
 *      localStorage naming its shape, and comes back whole after a reload.
 *   3. A small edit after that is mirrored whole again.
 *
 *   npx next start -p 3013
 *   node tests/big-document.mjs http://127.0.0.1:3013
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* A small document the way the Builder saved one before: this repository's own published document. */
const SMALL = JSON.parse(readFileSync("site/document.json", "utf8"));
const N0 = SMALL.nodes.length;

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

/* 1. What was in localStorage. */
await context.addInitScript((doc) => {
  /* One site in the builds list, as scripts/export-site.mjs seeds it, so the Builder opens on a board. */
  if (!localStorage.getItem("builder.builds")) localStorage.setItem("builder.builds", JSON.stringify({ state: { projects: [{ id: "s1", name: "Site 1", updatedAt: Date.now() }], activeId: "s1" }, version: 0 }));
  if (!localStorage.getItem("builder.studio")) localStorage.setItem("builder.studio", JSON.stringify({ state: doc, version: 0 }));
}, SMALL);
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.__studioPublishDoc === "function" && (window.__studioPublishDoc().nodes ?? []).length > 0, null, { timeout: 30000 }).catch(() => {});
const onBoard = await page.evaluate(() => (window.__studioPublishDoc ? window.__studioPublishDoc().nodes.length : "no board: " + document.body.innerText.slice(0, 120).replace(/\s+/g, " ")));
check("a document already in localStorage is on the board", onBoard === N0, `${onBoard} of ${N0}`);
const idb = () => page.evaluate(() => new Promise((done) => {
  const req = indexedDB.open("builder.docs", 1);
  req.onerror = () => done(null);
  req.onsuccess = () => { try { const g = req.result.transaction("docs", "readonly").objectStore("docs").get("builder.studio"); g.onsuccess = () => done(typeof g.result === "string" ? g.result : null); g.onerror = () => done(null); } catch { done(null); } };
  req.onupgradeneeded = () => { req.result.createObjectStore("docs"); };
}));
await page.waitForTimeout(800);
const carried = await idb();
check("…and carried into IndexedDB", typeof carried === "string" && JSON.parse(carried).state.nodes.length === N0, carried ? `${carried.length} chars` : "nothing");
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.__studioPublishDoc === "function" && (window.__studioPublishDoc().nodes ?? []).length > 0, null, { timeout: 30000 }).catch(() => {});
const back = await page.evaluate(() => window.__studioPublishDoc().nodes.length);
check("…and still on the board after a reload", back === N0, `${back} of ${N0}`);
const mirrored = await page.evaluate(() => localStorage.getItem("builder.studio"));
check("…mirrored whole into localStorage again, for what reads the key directly", typeof mirrored === "string" && mirrored.startsWith('{"state"') && JSON.parse(mirrored).state.nodes.length === N0, mirrored ? mirrored.slice(0, 40) : "nothing");

/* 2. A document past the quota: 6000 parts, each with a long path and a long label, about 9 MB. */
const BIG_N = 6000;
await page.evaluate(({ n, doc }) => {
  /* Each part is one of the document's own, told apart by its id, its words and a long recorded path. */
  const template = doc.nodes.find((k) => k.featureId === "prose") ?? doc.nodes[0];
  const nodes = [];
  for (let i = 0; i < n; i++) nodes.push({
    ...template, id: `n_big_${i}`, pageId: doc.pages[0].id, x: 40 + (i % 4) * 320, y: 40 + Math.floor(i / 4) * 60, w: 300, h: 40, label: `Part ${i} ${"x".repeat(400)}`, content: `Words ${i} ${"y".repeat(600)}`,
    from: { url: "https://STANDIN.example/", host: "STANDIN.example", selector: `body > div > div:nth-of-type(2) > main > section:nth-of-type(${1 + (i % 7)}) > div:nth-of-type(2) > article:nth-of-type(${1 + (i % 9)}) > div:nth-of-type(${1 + (i % 3)}) > span`, at: 1 },
  });
  window.__studioLoadDoc({ ...doc, pages: [doc.pages[0]], nodes, activePageId: doc.pages[0].id });
}, { n: BIG_N, doc: SMALL });
await page.waitForTimeout(1500);
const bigOn = await page.evaluate(() => (window.__studioPublishDoc ? window.__studioPublishDoc().nodes.length : "no board: " + document.body.innerText.slice(0, 120).replace(/\s+/g, " ")));
check("a document past localStorage's quota is on the board", bigOn === BIG_N, String(bigOn));
const pointer = await page.evaluate(() => localStorage.getItem("builder.studio"));
const p = (() => { try { return JSON.parse(pointer); } catch { return null; } })();
check("…localStorage holds a pointer naming its shape, not the document", p?.idb === true && p.parts === BIG_N && p.pages === 1 && p.bytes > 5_000_000, pointer ? pointer.slice(0, 120) : "nothing");
const bigIdb = await idb();
check("…IndexedDB holds the whole of it", typeof bigIdb === "string" && bigIdb.length > 5_000_000 && JSON.parse(bigIdb).state.nodes.length === BIG_N, bigIdb ? `${bigIdb.length} chars` : "nothing");
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction((n) => typeof window.__studioPublishDoc === "function" && (window.__studioPublishDoc().nodes ?? []).length === n, BIG_N, { timeout: 60000 }).catch(() => {});
const bigBack = await page.evaluate(() => [window.__studioPublishDoc().nodes.length, window.__studioPublishDoc().nodes[5999]?.from?.selector]);
check("…and comes back whole after a reload, paths and all", bigBack[0] === BIG_N && bigBack[1] === "body > div > div:nth-of-type(2) > main > section:nth-of-type(1) > div:nth-of-type(2) > article:nth-of-type(6) > div:nth-of-type(3) > span", JSON.stringify(bigBack));

/* 3. Small again: the mirror is whole again. */
await page.evaluate((doc) => window.__studioLoadDoc(doc), SMALL);
await page.waitForTimeout(800);
const again = await page.evaluate(() => localStorage.getItem("builder.studio"));
check("a small document after it is mirrored whole again", typeof again === "string" && again.startsWith('{"state"') && JSON.parse(again).state.nodes.length === N0, again ? again.slice(0, 40) : "nothing");
/* 4. The key removed is a fresh board, whatever IndexedDB still holds: what removing it always meant. */
/* Removed as the next load begins, so a save still settling on the open page cannot put it back first. */
await page.addInitScript(() => { localStorage.removeItem("builder.studio"); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.__studioPublishDoc === "function", null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(800);
const fresh = await page.evaluate(() => window.__studioPublishDoc().nodes.length);
check("removing the key starts a fresh board, as it always did", fresh === 0, String(fresh));
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? "FAILED" : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
