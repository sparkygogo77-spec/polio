#!/usr/bin/env node
/**
 * THE BEHAVIOUR FEATURES, IN THE BUILDER ITSELF.
 *
 * `features-behaviours.mjs` holds the scripts as published. This holds the
 * way to them, in the real Builder, on Solcinerator:
 *   · each of the eight is on the shelf, in its own category;
 *   · pressed with a part picked, it goes on that part, and a second one
 *     joins the first rather than replacing it;
 *   · the Element panel shows each feature the part carries, with its
 *     inputs, and editing one writes that input; each can be taken off;
 *   · the wheel's Say plate attaches them from plain words, and edits them;
 *   · the export ships both, and on the published page both work on the
 *     one part.
 *
 *   node tests/behaviours-in-builder.mjs [base url] [path to a sink checkout]
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SINK = process.argv[3] ?? "../sink";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/tweets/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false }, configured: false, source: null }) }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });

const doc = JSON.parse(readFileSync(`${SINK}/site/document.json`, "utf8"));
const wordsOf = (n) => (typeof n.content === "string" ? n.content : (n.content ?? []).map((s) => s.text).join(""));
const HEAD = doc.nodes.find((n) => n.pageId === "page_home" && wordsOf(n) === "PnL Over Time");
const OTHER = doc.nodes.find((n) => n.pageId === "page_home" && wordsOf(n) === "Total PnL");
await page.evaluate(({ state }) => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "b1", name: "Behaviours", updatedAt: Date.now() }], activeId: "b1" }));
  localStorage.setItem("builder.studio", env({ ...state, activePageId: "page_home" }));
}, { state: doc });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const node = (id) => page.evaluate((id) => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? []).find((n) => n.id === id) ?? null, id);
const ids = (w) => (w ? [w.id, ...(w.also ?? []).map((u) => u.id)] : []);
const wait = (ms) => page.waitForTimeout(ms);

/* ------------------------------------------------------------ the shelf */
const part = page.locator(`[data-node-id="${HEAD.id}"]`).first();
await part.scrollIntoViewIfNeeded();
await part.click();
await wait(500);
const WHERE = { reveal: "motion", tilt: "motion", marquee: "motion", "dust-canvas": "motion", "copy-toast": "interact", "follow-pointer": "interact", embed: "media", "crt-loader": "hero" };
const onShelf = {};
for (const cat of ["hero", "media", "motion", "interact"]) {
  await page.locator(`[data-category="${cat}"]`).first().click();
  await wait(500);
  onShelf[cat] = await page.evaluate(() => [...document.querySelectorAll("[data-work-card]")].map((c) => c.getAttribute("data-work-card")));
}
for (const [id, cat] of Object.entries(WHERE)) check(`${id} is on the shelf, under ${cat}`, (onShelf[cat] ?? []).includes(id), (onShelf[cat] ?? []).join(", "));

/* ------------------------------------------------ attaching, stacking */
await page.locator(`[data-category="motion"]`).first().click();
await wait(400);
/* A card opens its detail card; the part picked on the board is offered there (\`ShelfCards.tsx\`). */
await page.locator('[data-work-card="reveal"]').click();
await wait(400);
await page.locator('[data-work-put="reveal"]').click();
await wait(400);
check("pressed with a part picked, Reveal on scroll goes on that part", ids((await node(HEAD.id))?.work).join() === "reveal", JSON.stringify((await node(HEAD.id))?.work));
await page.locator(`[data-category="interact"]`).first().click();
await wait(400);
/* A card opens its detail card; the part picked on the board is offered there (\`ShelfCards.tsx\`). */
await page.locator('[data-work-card="copy-toast"]').click();
await wait(400);
await page.locator('[data-work-put="copy-toast"]').click();
await wait(400);
check("…and Copy with toast joins it, not replacing it", ids((await node(HEAD.id))?.work).join() === "reveal,copy-toast", JSON.stringify((await node(HEAD.id))?.work));
const chip = await page.locator(`[data-node-id="${HEAD.id}"] [data-work-chip], [data-work-chip]`).evaluateAll((cs) => cs.map((c) => c.textContent));
check("the board's chip names both", chip.some((t) => /Reveal on scroll/.test(t) && /Copy with toast/.test(t)), chip.join(" | "));

/* ------------------------------------------------ the Element panel */
await part.click();
await wait(400);
const fields = await page.evaluate(() => [...document.querySelectorAll("[data-work-field]")].map((f) => f.getAttribute("data-work-field")));
check("the Element panel shows each feature the part carries", fields.join() === "reveal,copy-toast", fields.join());
await page.locator('[data-work-field="reveal"] input[aria-label="Distance (px)"]').fill("48");
await wait(300);
await page.locator('[data-work-field="reveal"] [aria-label="Only the first time"] button', { hasText: "no" }).first().click().catch(() => {});
await page.locator('[data-work-field="copy-toast"] input[aria-label="Toast says"]').fill("Address copied");
await wait(400);
let w = (await node(HEAD.id))?.work;
check("…and editing an input writes it on that feature", w?.inputs?.distance === "48" && w?.also?.[0]?.inputs?.toast === "Address copied", JSON.stringify(w));
check("…one of a set, too", w?.inputs?.once === "no", JSON.stringify(w?.inputs));

/* ------------------------------------------------------- the one box */
const other = page.locator(`[data-node-id="${OTHER.id}"]`).first();
await other.scrollIntoViewIfNeeded();
const ob = await other.boundingBox();
await page.mouse.click(ob.x + ob.width / 2, ob.y + ob.height / 2, { button: "right" });
await wait(650);
await page.locator('[data-radial] [data-shard="write"]').first().click({ force: true });
await wait(500);
const box = page.locator("[data-say-input]").first();
check("the wheel's pencil opens the one box", await box.count() === 1);
const say = async (text) => { await box.fill(text); await box.press("Enter"); await wait(500); };
await say("marquee");
check("“marquee” attaches Marquee loop", ids((await node(OTHER.id))?.work).join() === "marquee", JSON.stringify((await node(OTHER.id))?.work));
await say("tilt toward the mouse");
check("“tilt toward the mouse” joins it as Tilt", ids((await node(OTHER.id))?.work).join() === "marquee,tilt", JSON.stringify((await node(OTHER.id))?.work));
check("…and the plate shows both, to edit", await page.locator('[data-say-work="marquee"]').count() === 1 && await page.locator('[data-say-work="tilt"]').count() === 1);
await page.locator('[data-say-work="marquee"] [data-tick]', { hasText: "right" }).first().click().catch(() => {});
await wait(300);
check("…and an input set there is written", (await node(OTHER.id))?.work?.inputs?.direction === "right", JSON.stringify((await node(OTHER.id))?.work?.inputs));
await page.locator('[data-say-work="tilt"] [data-tick]', { hasText: /take Tilt off/ }).first().click().catch(() => {});
await wait(300);
check("…and one can be taken off, the other kept", ids((await node(OTHER.id))?.work).join() === "marquee", JSON.stringify((await node(OTHER.id))?.work));
await page.keyboard.press("Escape"); await page.keyboard.press("Escape");

/* ----------------------------------------------------- the export */
const files = await page.evaluate(async () => (await window.__studioExport()).filter((f) => typeof f.content === "string").map((f) => ({ path: f.path, content: f.content })));
const byPath = new Map(files.map((f) => [f.path, f.content]));
check("the export ships both scripts beside the runtime", ["runtime", "reveal", "copy-toast", "marquee"].every((id) => byPath.has(`assets/features/${id}.js`)), [...byPath.keys()].filter((p) => p.includes("features/")).join(", "));
const home = byPath.get("index.html") ?? "";
const list = JSON.parse(/<script id="site-features" type="application\/json">([\s\S]*?)<\/script>/.exec(home)?.[1] ?? "[]");
check("…and the page binds both to the one part", list.filter((b) => b.part === HEAD.id).map((b) => b.feature).join() === "reveal,copy-toast", JSON.stringify(list));

const site = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
await site.addInitScript(() => {
  window.__copied = [];
  Object.defineProperty(navigator, "clipboard", { value: { writeText: (t) => { window.__copied.push(String(t)); return Promise.resolve(); } }, configurable: true });
});
await site.route("http://site.test/**", (r) => {
  const p = new URL(r.request().url()).pathname.replace(/^\//, "") || "index.html";
  const body = byPath.get(p.endsWith("/") ? `${p}index.html` : p);
  if (body == null) return r.fulfill({ status: 404, body: "" });
  return r.fulfill({ status: 200, contentType: p.endsWith(".css") ? "text/css" : p.endsWith(".js") ? "text/javascript" : "text/html", body });
});
await site.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));
const siteErrors = [];
site.on("pageerror", (e) => siteErrors.push(e.message));
await site.goto("http://site.test/index.html", { waitUntil: "load" });
await site.waitForTimeout(1500);
const shown = await site.evaluate((id) => { const el = document.getElementById(id); el?.scrollIntoView({ block: "center" }); return !!el; }, HEAD.id);
await site.waitForTimeout(1200);
const after = await site.evaluate((id) => { const el = document.getElementById(id); const cs = getComputedStyle(el); return { opacity: cs.opacity, revealed: el.style.translate === "" || el.style.translate === "0px", cursor: cs.cursor }; }, HEAD.id);
check("on the published page the part reveals as it comes into view", shown && after.opacity === "1" && after.revealed, JSON.stringify(after));
await site.locator(`#${HEAD.id}`).click({ force: true });
await site.waitForTimeout(200);
const copied = await site.evaluate(() => ({ copied: window.__copied, toast: document.querySelector("[data-feature-toast]")?.textContent ?? null }));
check("…and the same part copies its words with the toast it was given", copied.copied.at(-1) === "PnL Over Time" && copied.toast === "Address copied", JSON.stringify(copied));
const loop = await site.evaluate((id) => { const el = document.getElementById(id); return { copies: el.querySelectorAll("[aria-hidden=true]").length, overflow: getComputedStyle(el).overflow }; }, OTHER.id);
check("…and the other part runs its marquee", loop.copies >= 1 && loop.overflow === "hidden", JSON.stringify(loop));
check("the published page runs without an error", siteErrors.length === 0, siteErrors.join(" | "));
check("the Builder raised no error", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
