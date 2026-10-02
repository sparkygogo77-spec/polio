/**
 * A PICTURE WHOSE BYTES ARRIVE AFTER ITS PART IS DRAWN APPEARS, WITHOUT A RELOAD.
 *
 * MEASURED on trunk 3e14749, a fresh import of sink through the GitHub door:
 * the import puts the document on the board first and keeps the pictures'
 * bytes afterwards, one by one (`FromASite.tsx`). `usePicture` looked once,
 * on first draw; a picture whose bytes were not yet kept came back empty,
 * its id was marked "asked", and nothing looked again. n_picture_90 (the
 * Solana mark by the price) said "This picture is not in this browser any
 * more" until a reload, with pic_ebf39fa1 sitting in IndexedDB the whole time.
 *
 * The check: after the import, and with no reload, every picture part on
 * the page on screen whose bytes are in this browser's storage draws an
 * <img>, and none says it is lost.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/picture-arrives.mjs http://127.0.0.1:3013 <the capture folder>
 */
import { existsSync } from "node:fs";
import { bringSink } from "./fixtures/bring-sink.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3];
if (!SINK || !existsSync(SINK)) { console.error("usage: node tests/picture-arrives.mjs <url> <capture folder>"); process.exit(2); }
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const { browser, page, state } = await bringSink(BASE, SINK);
await page.waitForTimeout(3000);
const s = await state();
const on = (s.nodes ?? []).filter((n) => n.pageId === s.activePageId && n.featureId === "picture" && n.picture);
const shelf = await page.evaluate(() => new Promise((done) => {
  const r = indexedDB.open("builder.pictures", 1);
  r.onsuccess = () => { const q = r.result.transaction("files", "readonly").objectStore("files").getAllKeys(); q.onsuccess = () => done(q.result); };
  r.onerror = () => done([]);
}));
const drawn = await page.evaluate((ids) => Object.fromEntries(ids.map((id) => {
  const el = document.querySelector(`[data-node-id="${id}"]`);
  if (!el) return [id, "not on screen"];
  if (el.querySelector("[data-picture-lost]")) return [id, "says lost"];
  const img = el.querySelector("img");
  return [id, img && img.complete && img.naturalWidth ? `img ${img.src.slice(0, 5)} ${img.naturalWidth}x${img.naturalHeight}` : "no image"];
})), on.map((n) => n.id));
for (const n of on) console.log(`   ${n.id} ${n.picture.id} in storage: ${shelf.includes(n.picture.id)}; drawn: ${drawn[n.id]}`);
check("the page on screen has picture parts whose bytes are in storage", on.length > 0 && on.every((n) => shelf.includes(n.picture.id)), `${on.length} on ${s.activePageId}`);
check("every one draws its picture, with no reload", on.every((n) => String(drawn[n.id]).startsWith("img")), on.map((n) => `${n.id}: ${drawn[n.id]}`).join("; "));
check("none says it is lost", on.every((n) => drawn[n.id] !== "says lost"));
await browser.close();
console.log(results.every(Boolean) ? "\nall passed" : `\n${results.filter((r) => !r).length} failed`);
process.exit(results.every(Boolean) ? 0 : 1);
