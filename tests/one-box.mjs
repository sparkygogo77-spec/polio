#!/usr/bin/env node
/**
 * THE ORANGE !, THE ONE BOX, THE SHELF'S WORKING FEATURES, AND WHAT PUBLISHES.
 *
 * THE OWNER'S GOAL: the easiest way to program a site on top of designing
 * it. On Solcinerator every clickable part with nowhere to go, and every
 * live-data spot, wears an orange ! in the Builder; pressing it opens one box
 * that reads what is typed and applies it at once, saying how it understood
 * it, with undo. A feature from the library takes the part's own style, and
 * publishing ships a tiny runtime and that feature's script.
 *
 * Held, on sink's own document, in a real browser, with nothing leaving the
 * machine (the price source is a stand-in; no GitHub, no Vercel, no token):
 *   · a ! on exactly the parts `library/badge.ts` names, outside each part's
 *     own box, and on no part at all in the live preview or the export;
 *   · pressing one opens the one box on that part; "sol price" attaches
 *     Live SOL price, says so, and the ! goes; undo puts it back;
 *   · a web address typed on a time-range button becomes its link; words
 *     that say what to do become a task; a page's name on a part with other
 *     words asks, and applies what was picked;
 *   · the old controls are under "more": words, contents, links, data, priority;
 *   · the Data category of the shelf holds the features, each with its look;
 *   · the export carries the runtime and the script, and the published page,
 *     opened with a stand-in price source, shows the live price in the part's
 *     own element and style.
 *
 *   npm run build && npx next start -p 3013
 *   node --experimental-strip-types tests/one-box.mjs http://127.0.0.1:3013 <path to a sink checkout> [screenshot dir]
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { decisions } from "../src/features/studio/library/badge.ts";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const SINK = process.argv[3] ?? "../sink";
const SHOTS = process.argv[4] ?? null;
if (!existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node --experimental-strip-types tests/one-box.mjs <builder url> <path to a sink checkout> [screenshot dir]");
  process.exit(2);
}
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const doc = JSON.parse(readFileSync(join(SINK, "site/document.json"), "utf8"));
const homeNodes = doc.nodes.filter((n) => n.pageId === "page_home");
const expected = decisions(homeNodes);
const words = (n) => (typeof n.content === "string" ? n.content : (n.content ?? []).map((s) => s.text).join(""));
const PRICE = homeNodes.find((n) => words(n) === "$116.59");
const ONE_D = homeNodes.find((n) => words(n) === "1D");
const WALLET = homeNodes.find((n) => words(n) === "kgER...9oP7");
const STAT = homeNodes.find((n) => words(n) === "0.0000 SOL");

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
/* Nothing leaves the machine: the Builder's own API answers "not configured", everything else off-site is refused. */
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false } }) }));
await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate((state) => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Solcinerator", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ ...state, activePageId: "page_home" }));
}, doc);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const node = (id) => page.evaluate((id) => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? []).find((n) => n.id === id) ?? null, id);
const fit = page.getByRole("button", { name: /^Fit/ }).first();
if (await fit.count()) await fit.click().catch(() => {});
await page.keyboard.press("f").catch(() => {});
await page.waitForTimeout(800);

/* ------------------------------------------------------------ the ! */
const badges = await page.evaluate(() => [...document.querySelectorAll("[data-decide-for]")].map((b) => {
  const part = document.querySelector(`[data-node-id="${b.getAttribute("data-decide-for")}"]`);
  const r = b.getBoundingClientRect();
  const p = part?.getBoundingClientRect();
  const colour = getComputedStyle(b).backgroundColor;
  return { id: b.getAttribute("data-decide-for"), why: b.getAttribute("data-decide"), text: b.textContent, colour, outside: !!p && (r.bottom <= p.top + 1 || r.left >= p.right - 1) };
}));
const want = new Set(expected.map((d) => d.id));
const got = new Set(badges.map((b) => b.id));
check("a ! on every part that needs a decision on Creator Hub", expected.every((d) => got.has(d.id)), `${badges.length} drawn, ${expected.length} expected`);
check("…and on no other part", badges.every((b) => want.has(b.id)), badges.filter((b) => !want.has(b.id)).map((b) => b.id).join(", "));
check("…orange, and it says !", badges.length > 0 && badges.every((b) => b.text === "!" && /rgb\(2[0-9]{2}, 1[0-9]{2}, [0-9]{1,2}\)|oklch/.test(b.colour)), badges[0]?.colour);
check("…sitting outside the part it is about, never over it", badges.every((b) => b.outside), badges.filter((b) => !b.outside).map((b) => b.id).join(", "));
if (SHOTS) {
  await page.locator(`[data-decide-for="${PRICE.id}"]`).scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, "1-badges.png") });
}

/* ------------------------------------------------------- the one box */
async function pressBang(id) {
  const b = page.locator(`[data-decide-for="${id}"]`);
  if (!(await b.count())) return false;
  await b.scrollIntoViewIfNeeded();
  await b.click();
  await page.waitForTimeout(700);
  return true;
}
async function say(text) {
  const box = page.locator("[data-say-input]").first();
  if (!(await box.count())) return;
  await box.fill(text);
  await box.press("Enter");
  await page.waitForTimeout(500);
}

await pressBang(PRICE.id);
check("pressing a ! opens the one box on that part", await page.locator(`[data-say-box="${PRICE.id}"]`).count() === 1);
await say("sol price");
let n = await node(PRICE.id);
check("“sol price” attaches Live SOL price to it", n?.work?.id === "sol-price", JSON.stringify(n?.work));
const understood = await page.locator("[data-understood]").first().getAttribute("data-understood").catch(() => null);
check("…applied at once, and it says how it understood it", /Live SOL price/.test(understood ?? ""), understood);
check("…the part keeps the words it was designed with", words(n) === "$116.59", words(n));
check("…and its ! is gone", await page.locator(`[data-decide-for="${PRICE.id}"]`).count() === 0);
if (SHOTS) {
  const b = await page.locator("[data-say-box]").first().boundingBox();
  if (b) await page.screenshot({ path: join(SHOTS, "2-one-box-sol-price.png"), clip: { x: Math.max(0, b.x - 260), y: Math.max(0, b.y - 200), width: 520, height: 400 } });
}
await page.locator("[data-say-undo]").first().click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(400);
n = await node(PRICE.id);
check("undo takes it off again", !n?.work, JSON.stringify(n?.work));
check("…and the ! comes back", await page.locator(`[data-decide-for="${PRICE.id}"]`).count() === 1);
await say("sol price every 15 seconds");
n = await node(PRICE.id);
check("said again with a refresh, it keeps the refresh", n?.work?.id === "sol-price" && n?.work?.inputs?.every === "15", JSON.stringify(n?.work));
await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
await page.waitForTimeout(300);

await pressBang(ONE_D.id);
await say("x.com/solworks");
n = await node(ONE_D.id);
check("a web address typed on the 1D button becomes its link", n?.link?.kind === "url" && n.link.target === "https://x.com/solworks", JSON.stringify(n?.link));
check("…and says so", /x\.com\/solworks/.test(await page.locator("[data-understood]").first().getAttribute("data-understood").catch(() => "") ?? ""));
await say("Tokens");
check("a page's name on a part with other words asks first", await page.locator("[data-say-ask]").count() === 1);
n = await node(ONE_D.id);
check("…and changes nothing until it is answered", n?.link?.kind === "url", JSON.stringify(n?.link));
await page.locator("[data-say-ask] [data-tick]").first().click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(400);
n = await node(ONE_D.id);
check("…then applies the reading picked", n?.link?.kind === "page" && n.link.target === "page_tokens", JSON.stringify(n?.link));
await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
await page.waitForTimeout(300);

await pressBang(WALLET.id);
await say("show the latest transaction hashes from the connected wallet");
n = await node(WALLET.id);
check("words that say what it should do become a task on the part", /latest transaction hashes/.test(n?.task ?? ""), n?.task);
check("…not its words", words(n) === "kgER...9oP7", words(n));
check("…and the ! is answered", await page.locator(`[data-decide-for="${WALLET.id}"]`).count() === 0);

/* The old controls, under "more". */
await page.locator('[data-rail-button="more"]').first().click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(500);
const five = await page.evaluate(() => [...document.querySelectorAll("[data-radial-panel='write'] [aria-label], [data-radial-panel='write'] title, [data-radial-panel='write'] text")].map((e) => e.getAttribute?.("aria-label") || e.textContent).join("|"));
const olds = ["Words", "Contents", "Links", "Data", "Priority"];
check("the old controls are one press away under “more”", olds.every((w) => five.includes(w)), olds.filter((w) => !five.includes(w)).join(", ") || "all five");
if (SHOTS) await page.screenshot({ path: join(SHOTS, "3-more.png") });
await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
await page.waitForTimeout(300);

/* Plain words, on a stat. */
await pressBang(STAT.id);
await say("“12.5000 SOL”");
n = await node(STAT.id);
check("quoted, it is the part's words", words(n) === "12.5000 SOL", words(n));
check("…and words typed on a live-data spot answer its !", await page.locator(`[data-decide-for="${STAT.id}"]`).count() === 0);
await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");

/* -------------------------------------------------------- the shelf */
const planet = page.locator('[data-category-open="data"]');
if (!(await planet.count())) {
  const open = page.getByRole("button", { name: /^Data$/ }).first();
  if (await open.count()) await open.click().catch(() => {});
  else await page.locator('[aria-label*="Data"]').first().click().catch(() => {});
  await page.waitForTimeout(700);
}
const cards = await page.evaluate(() => [...document.querySelectorAll("[data-work-card]")].map((c) => ({ id: c.getAttribute("data-work-card"), text: c.textContent })));
check("the shelf's Data category holds the working features", ["sol-price", "token-price"].every((id) => cards.some((c) => c.id === id)), cards.map((c) => c.id).join(", "));
check("…each with a look of what a part carrying it shows", cards.some((c) => /\$142\.37/.test(c.text ?? "")) && cards.some((c) => /Live token price/.test(c.text ?? "")), cards.map((c) => c.text).join(" | "));
if (SHOTS && cards.length) {
  await page.locator("[data-work-card]").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SHOTS, "4-shelf.png") });
}

/* ------------------------------------------------ the live preview */
await page.keyboard.press("p");
await page.waitForTimeout(1200);
check("no ! in the live preview", await page.locator("[data-decide-for]").count() === 0);
await page.keyboard.press("p");
await page.waitForTimeout(800);

/* ----------------------------------------------------- the export */
const files = await page.evaluate(async () => {
  const out = await window.__studioExport();
  return out.filter((f) => typeof f.content === "string").map((f) => ({ path: f.path, content: f.content }));
});
const byPath = new Map(files.map((f) => [f.path, f.content]));
check("the export carries the runtime", byPath.has("assets/features/runtime.js"));
check("…and Live SOL price's script, and no feature nobody used", byPath.has("assets/features/sol-price.js") && !byPath.has("assets/features/token-price.js"), [...byPath.keys()].filter((p) => p.includes("features")).join(", "));
const home = byPath.get("index.html") ?? "";
check("the home page says which part takes which feature", home.includes(`"part":"${PRICE.id}"`) && home.includes('"feature":"sol-price"'));
check("…and loads the scripts, without a framework", /assets\/features\/runtime\.js/.test(home) && /assets\/features\/sol-price\.js/.test(home) && !/react|next/i.test(byPath.get("assets/features/runtime.js") ?? ""));
check("no page of the export carries a !", files.filter((f) => f.path.endsWith(".html")).every((f) => !f.content.includes("data-decide")));
const other = [...byPath.entries()].find(([p]) => p.endsWith(".html") && p !== "index.html");
check("a page that uses no feature loads none", !!other && !other[1].includes("site-features"), other?.[0]);

/* The published page, opened with a stand-in price source. */
const site = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
let asked = 0;
await site.route("http://site.test/**", (r) => {
  const p = new URL(r.request().url()).pathname.replace(/^\//, "") || "index.html";
  const body = byPath.get(p.endsWith("/") ? `${p}index.html` : p);
  if (body == null) return r.fulfill({ status: 404, body: "" });
  const type = p.endsWith(".css") ? "text/css" : p.endsWith(".js") ? "text/javascript" : "text/html";
  return r.fulfill({ status: 200, contentType: type, body });
});
await site.route(/api\.coingecko\.com/, (r) => { asked++; return r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ solana: { usd: 142.3719, usd_24h_change: 2.5 } }) }); });
await site.route(/^https:\/\/(?!fonts\.)(?!api\.coingecko)/, (r) => r.fulfill({ status: 404, body: "" }));
const siteErrors = [];
site.on("pageerror", (e) => siteErrors.push(e.message));
await site.goto("http://site.test/index.html", { waitUntil: "load" });
await site.waitForTimeout(1200);
const live = await site.evaluate((id) => {
  const el = document.getElementById(id);
  const leaf = el?.querySelector("span, div, p") ?? el;
  const cs = leaf ? getComputedStyle(leaf) : null;
  return { text: el?.textContent?.trim() ?? null, colour: cs?.color, size: cs?.fontSize };
}, PRICE.id);
check("on the published page the part shows the live price", live.text === "$142.37", JSON.stringify(live));
check("…asked of the price source", asked > 0, `${asked}`);
check("…in the part's own style (its colour and size, as designed)", !!live.colour && !!live.size && live.size !== "16px", `${live.colour} ${live.size}`);
check("the published page runs without an error", siteErrors.length === 0, siteErrors.join(" | "));
if (SHOTS) await site.screenshot({ path: join(SHOTS, "5-published-live-price.png"), clip: { x: 900, y: 0, width: 863, height: 90 } });

check("the Builder raised no error", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
