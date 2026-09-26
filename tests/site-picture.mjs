/**
 * THE SITE'S PICTURE IN THE BAR IS ITS OWN LOGO, AND ITS NAME ENDS CLEANLY.
 *
 * MEASURED on trunk b2ba350, a fresh import of sink: the mark left of the
 * site's name was a green square with "S" in it, and the name beside it
 * read "SOLCINERATO", cut through the R.
 *
 * The rule (`siteMark.ts`): of the pictures on the board, the one on the
 * most pages, and of those the largest drawn. On sink that is the SolWorks
 * logo (pic_cc8659c3, 112x112 on 8 of 9 pages); the Solana mark ties on
 * pages but is 48x24, and the question mark is bigger (128x128) but only on
 * 4. A site with no pictures, or whose bytes this browser no longer has,
 * keeps the letter.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/site-picture.mjs http://127.0.0.1:3013 <path to a sink checkout>
 */
import { existsSync } from "node:fs";
import { bringSink } from "./fixtures/bring-sink.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3];
if (!SINK || !existsSync(SINK)) { console.error("usage: node tests/site-picture.mjs <url> <sink checkout>"); process.exit(2); }
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const { browser, page, state } = await bringSink(BASE, SINK);
await page.waitForTimeout(3000);
const s = await state();

/* The contract a fresh sink import holds. */
const kinds = {};
for (const n of s.nodes ?? []) kinds[n.featureId] = (kinds[n.featureId] ?? 0) + 1;
const want = { box: 243, "cta-primary": 109, "drawn-icon": 132, picture: 20, prose: 111, "value-prop": 22 };
check("sink lands whole: 637 parts", (s.nodes ?? []).length === 637 && Object.entries(want).every(([k, v]) => kinds[k] === v), `${(s.nodes ?? []).length} ${JSON.stringify(kinds)}`);

/* Every candidate, as the rule sees it. */
const by = new Map();
for (const n of s.nodes ?? []) {
  if (!n.picture) continue;
  const c = by.get(n.picture.id) ?? { id: n.picture.id, pages: new Set(), area: 0, size: "" };
  c.pages.add(n.pageId);
  if (n.w * n.h > c.area) { c.area = n.w * n.h; c.size = `${n.w}x${n.h}`; }
  by.set(n.picture.id, c);
}
console.log(`   ${s.pages.length} pages; candidates:`);
for (const c of by.values()) console.log(`   ${c.id} drawn ${c.size}, on ${c.pages.size} pages`);

const mark = page.locator("[data-site-mark]");
const img = mark.locator("img");
const shown = (await img.count())
  ? await img.evaluate((el) => ({ id: el.dataset.pictureId, w: el.naturalWidth, h: el.naturalHeight, done: el.complete }))
  : { letter: (await mark.innerText()).trim() };
check("the bar's mark is the SolWorks logo", shown.id === "pic_cc8659c3" && shown.done && shown.w === 1024 && shown.h === 1024, JSON.stringify(shown));
const box = await mark.boundingBox();
check("at the mark's own size", box && Math.round(box.width) === 18 && Math.round(box.height) === 18, box ? `${box.width}x${box.height}` : "not drawn");

/* The name beside it: whole, or ending in an ellipsis — never cut through a letter. */
const name = await page.locator("[data-site-build]").evaluate((el) => {
  const cs = getComputedStyle(el);
  return { text: el.innerText, display: cs.display, overflow: cs.overflowX, ends: cs.textOverflow, fits: el.scrollWidth <= el.clientWidth, sw: el.scrollWidth, cw: el.clientWidth, w: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right, parentRight: el.parentElement.getBoundingClientRect().right, clipped: (() => { for (let p = el.parentElement; p; p = p.parentElement) { const r = p.getBoundingClientRect(); if (getComputedStyle(p).overflowX !== "visible" && r.right < el.getBoundingClientRect().right - 0.5) return true; } return false; })() };
});
check("the site's name ends cleanly", !name.clipped && name.display !== "inline" && (name.fits || (name.overflow === "hidden" && name.ends === "ellipsis")), JSON.stringify(name));
/*
 * And its last letter is not shaved. In an Arial-metric face (Arial and
 * Helvetica are in the name's own stack; Liberation Sans is Arial's metrics
 * on this machine) a bold R's leg reaches 0.33px past the text's advance.
 * The box is sized to the advance, so nothing overflows and no ellipsis
 * comes — the clip just cuts the R. Drawn with the clip and without, the
 * name's right edge must be the same picture.
 */
const edge = async () => {
  const b = await page.locator("[data-site-build]").boundingBox();
  return page.screenshot({ clip: { x: b.x + b.width - 16, y: b.y, width: 20, height: b.height }, scale: "device" });
};
await page.locator("[data-site-build]").evaluate((el) => { el.style.fontFamily = "Liberation Sans"; });
await page.waitForTimeout(100);
const clipped = await edge();
await page.locator("[data-site-build]").evaluate((el) => { el.style.overflow = "visible"; });
await page.waitForTimeout(100);
const free = await edge();
await page.locator("[data-site-build]").evaluate((el) => { el.style.fontFamily = ""; el.style.overflow = ""; });
check("and its last letter is whole, not shaved by the clip", clipped.equals(free), clipped.equals(free) ? "same pixels with and without the clip" : "the clip cuts the R");

/* No bytes: the letter comes back. */
await page.evaluate(() => new Promise((done) => {
  const r = indexedDB.open("builder.pictures", 1);
  r.onsuccess = () => { const q = r.result.transaction("files", "readwrite").objectStore("files").delete("pic_cc8659c3"); q.onsuccess = () => done(); q.onerror = () => done(); };
  r.onerror = () => done();
}));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const after = { imgs: await mark.locator("img").count(), letter: (await mark.innerText()).trim() };
check("with the logo's bytes gone, the letter tile comes back", after.imgs === 0 && after.letter === "S", JSON.stringify(after));

await browser.close();
console.log(results.every(Boolean) ? "\nall passed" : `\n${results.filter((r) => !r).length} failed`);
process.exit(results.every(Boolean) ? 0 : 1);
