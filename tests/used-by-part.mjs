/**
 * With a part picked, the shelf shows which shelf items it uses, and every
 * "On this page" count links to the parts that use its card (owner note R14).
 *
 *   1. what a part uses is read off it: what it is (and which version),
 *      each library feature it carries, and what its page gave it (a hover
 *      that moves it, a loop that turns or travels, another page inside it);
 *      once each, never a card that is off the shelf;
 *   2. picked on the board, the shelf's top strip names exactly those, and
 *      a press opens that card at the version the part uses;
 *   3. the cards it uses wear a mark while it is picked, and nothing else does;
 *   4. a card's "On this page" count opens the list of those parts by name,
 *      and a press on one picks that part.
 *
 *   node tests/used-by-part.mjs http://localhost:3000 [the capture folder]
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { usedByPart } from "../src/features/studio/shelf/library/usedBy.ts";
import { attachCaptured } from "../src/features/studio/shelf/library/captured.ts";
import { onShelf } from "../src/features/studio/shelf/shelfPlan.ts";
import { landPalette } from "../src/features/studio/paletteFrom.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SINK = process.argv[3] ?? join(process.cwd(), "capture", "versions", "sink-0ee06fa");
const SHOTS = ".screenshots/lane-i";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------ 1 */
const faq = usedByPart({ featureId: "faq", work: { id: "reveal", inputs: {}, also: [{ id: "copy-toast", inputs: {} }, { id: "tilt", inputs: {}, off: true }] } });
check("1. a part is the card it stands under, at its version", faq[0]?.item === "accordion" && faq[0]?.version === "faq" && faq[0]?.via === "is" && faq[0]?.label === "Questions and answers", JSON.stringify(faq[0]));
check("1. and each feature it carries is the card that feature is filed under", faq.some((u) => u.item === "reveal-on-scroll" && u.version === "work:reveal" && u.via === "carries") && faq.some((u) => u.item === "copy-button" && u.via === "carries"), faq.map((u) => u.item).join(", "));
check("1. a feature switched off is not counted", !faq.some((u) => u.item === "hover-tilt"));
const frames = [{ name: "turn", frames: [{ key: "from", style: { transform: "rotate(0deg)" } }, { key: "to", style: { transform: "rotate(360deg)" } }] }];
const captured = usedByPart({ featureId: "box", motion: { hover: [{ style: { transform: "translateY(-4px)" } }], animation: [{ name: "turn" }] }, embed: { src: "https://example.com" } }, frames);
check("1. what its page gave it counts too: a hover that moves it, a loop that turns, a page inside it", ["work:hover-lift", "work:spin", "work:embed"].every((k) => captured.some((u) => u.item === k && u.via === "captured")), captured.map((u) => `${u.item}(${u.via})`).join(", "));
check("1. a part taken off the shelf names no card for what it is", usedByPart({ featureId: "waypoint" }).length === 0);

const at = join(SINK, "sites", "trumpmorty-fun", "site", "document.json");
if (!existsSync(at)) { console.log(`needs the capture folder with trumpmorty-fun (${SINK})`); process.exit(1); }
const raw = JSON.parse(readFileSync(at, "utf8"));
const home = raw.pages.find((p) => p.path === "/") ?? raw.pages[0];
const nodes = attachCaptured(raw.nodes, raw.behaviours, raw.keyframes);
const landed = landPalette(nodes, raw.look?.palette ?? {});
const all = landed.nodes.map((n) => ({ n, uses: usedByPart(n, raw.keyframes ?? []) }));
const offShelf = all.flatMap((x) => x.uses).filter((u) => !onShelf(u.item));
check("1. on a captured site every use names a card on the shelf", offShelf.length === 0, offShelf.map((u) => u.item).join(", ") || `${all.length} parts read`);
const twice = all.filter((x) => new Set(x.uses.map((u) => u.item)).size !== x.uses.length);
check("1. and no card twice for one part", twice.length === 0);

/* The part to pick: on the first screen, using the most cards. */
const pick = all.filter((x) => x.n.pageId === home.id && x.n.y < 700 && x.n.x < 1300 && x.n.w > 30 && x.n.h > 20 && x.uses.length >= 2).sort((a, b) => a.n.w * a.n.h - b.n.w * b.n.h)[0];

/* ------------------------------------------------------------ 2-4 */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.route("**/api/tweets/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false }, configured: false, source: null }) }));
/* The shelf opens folded to its "+ Add" strip (J, 2026-10-05); these checks read the open shelf. */
await page.addInitScript(() => { try { localStorage.setItem("builder.shelf.folded", "0"); } catch { /* private window */ } });
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.__studioLoadDoc === "function", null, { timeout: 60000 });
await page.evaluate((d) => window.__studioLoadDoc(d), { ...raw, pages: [home], nodes: landed.nodes.filter((n) => n.pageId === home.id), look: { ...raw.look, palette: landed.palette, paletteFrom: landed.from }, activePageId: home.id });
await page.waitForTimeout(3000);

const el = page.locator(`[data-node-id="${pick.n.id}"]`).first();
await el.scrollIntoViewIfNeeded();
const box = await el.boundingBox();
/* Which part is picked, read off the shelf's own strip (a large captured board is kept in IndexedDB, not in localStorage). */
const pickedNow = () => page.evaluate(() => document.querySelector("[data-used-by-part]")?.getAttribute("data-used-by-part") ?? null);
/* A real press on its middle: whatever is on top there is what the person picks, and that is what is checked. */
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(700);
const picked = await pickedNow();
const expect = picked === pick.n.id ? pick.uses : (all.find((x) => x.n.id === picked)?.uses ?? []);
const strip = await page.$$eval("[data-used-by-part] [data-used-item]", (els) => els.map((e) => e.getAttribute("data-used-item")));
check("2. with one part picked, the shelf names every card it uses", !!picked && strip.length === expect.length && expect.every((u) => strip.includes(u.item)), `${picked}: ${strip.join(", ")} (expected ${expect.map((u) => u.item).join(", ")})`);
await page.screenshot({ path: `${SHOTS}/used-by-part-strip.png` });
const chipFor = expect.find((u) => u.via !== "is") ?? expect[0];
await page.locator(`[data-used-by-part] [data-used-item="${chipFor.item}"]`).click();
await page.waitForTimeout(700);
const open = await page.evaluate(() => ({ item: document.querySelector("[data-part-detail]")?.getAttribute("data-item"), on: document.querySelector("[data-part-detail] [data-version][aria-pressed=true]")?.getAttribute("data-version") ?? null }));
check("2. and a press opens that card at the version the part uses", open.item === chipFor.item && (open.on === null || open.on === chipFor.version), JSON.stringify(open));
await page.screenshot({ path: `${SHOTS}/used-by-part-detail.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

/* 3 */
const categories = ["structure", "content", "motion", "forms", "data", "platform"];
let marked = [];
for (const c of categories) {
  await page.locator(`[data-category="${c}"]`).first().click();
  await page.waitForTimeout(900);
  marked.push(...await page.$$eval("[data-category-open] [data-shelf-card]", (els) => els.filter((e) => e.querySelector("[data-used-by-picked]")).map((e) => e.getAttribute("data-shelf-card"))));
}
const expectKeys = expect.map((u) => u.item);
marked = [...new Set(marked)];
const wrong = marked.filter((k) => !expectKeys.includes(k));
check("3. the cards it uses wear a mark, and no other card does", marked.length > 0 && wrong.length === 0, `marked: ${marked.join(", ")}${wrong.length ? `; wrong: ${wrong}` : ""}`);

/* 4 */
await page.locator('[data-category="motion"]').first().click();
await page.waitForTimeout(900);
const card = page.locator('[data-shelf-card="reveal-on-scroll"]');
await card.scrollIntoViewIfNeeded();
const count = Number(await card.locator("[data-used-on-page]").getAttribute("data-used-on-page"));
await card.locator("[data-used-list-toggle]").click();
await page.waitForTimeout(400);
const listed = await card.locator("[data-used-part]").evaluateAll((els) => els.map((e) => ({ id: e.getAttribute("data-used-part"), text: e.textContent.trim() })));
check("4. a card's On this page count opens the list of those parts, by name", listed.length === count && count > 1 && listed.every((x) => x.text && x.text !== x.id), `${count} counted, ${listed.length} listed: ${listed.slice(0, 3).map((x) => x.text).join(" | ")}`);
await page.screenshot({ path: `${SHOTS}/used-by-part-list.png` });
const target = listed[Math.min(2, listed.length - 1)];
await card.locator(`[data-used-part="${target.id}"]`).click();
await page.waitForTimeout(700);
const after = await pickedNow();
check("4. and a press on one picks that part", after === target.id, `${after}`);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
