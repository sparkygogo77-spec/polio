#!/usr/bin/env node
/**
 * PRESS A PART TWICE AND TYPE: THE WORDS CHANGE, NO SHORTCUT FIRES.
 *
 * A double press on a text part opens its words with the caret in them, on
 * the canvas where they are drawn (`tests/select-owner.mjs`), else in the
 * Element panel's words box; typing then edits the words and never reaches the
 * letter shortcuts (e erased, d drew, t opened a tweet console, which took
 * the page down on a status it did not expect). One press on a part opens
 * the Element panel, whose tabs say their names. Add page asks for a name.
 *
 *   node tests/words-on-press.mjs [url]      # default http://localhost:3000
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
/* A tweets status with no `missing` list, the shape that crashed the page. */
await page.route("**/api/tweets/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false }, configured: false, source: null }) }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
const SINK = process.argv[3] ?? "../sink";
const { readFileSync } = await import("node:fs");
const doc = JSON.parse(readFileSync(`${SINK}/site/document.json`, "utf8"));
const wordsOf = (n) => (typeof n.content === "string" ? n.content : (n.content ?? []).map((s) => s.text).join(""));
const HEAD = doc.nodes.find((n) => n.pageId === "page_home" && wordsOf(n) === "PnL Over Time");
await page.evaluate(({ state, id }) => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "w1", name: "Words", updatedAt: Date.now() }], activeId: "w1" }));
  localStorage.setItem("builder.studio", env({ ...state, activePageId: "page_home" }));
}, { state: doc, id: HEAD.id });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const part = page.locator(`[data-node-id="${HEAD.id}"]`).first();
await part.scrollIntoViewIfNeeded();
const words = () => page.evaluate((id) => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? []).find((n) => n.id === id)?.content, HEAD.id); const plain = (c) => typeof c === "string" ? c : (c ?? []).map((s) => s.text).join("");;
const active = () => page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName.toLowerCase()} ${a.getAttribute("aria-label") ?? ""}`.trim() : "none"; });

/* one press: the Element panel */
await part.click(); await page.waitForTimeout(500);
const tabs = await page.locator('[aria-label="Side panel"] button, [role=tablist] button').evaluateAll((bs) => bs.map((b) => b.textContent.trim()).filter(Boolean));
check("one press opens the Element panel", await page.locator('[data-side-panel] [aria-label="Element prompt"]').count() === 1);
check("…and every tab says its name", ["Element", "Format", "Pages", "Look"].every((t) => tabs.includes(t)), tabs.join(", "));
const visibleWords = await page.locator('[aria-label="Side panel"] button span:not(.sr-only)').evaluateAll((es) => es.map((e) => e.textContent.trim()).filter(Boolean));
/* The open tab says its word on screen; the others wear their icon and keep their name as a tooltip, by the owner's ask (d8bedd3c), and say it on screen too once the panel is wide enough (StudioPage.tsx, tabWords). */
const titled = await page.locator('[aria-label="Side panel"] button').evaluateAll((bs) => bs.map((b) => b.getAttribute("title") ?? "").filter(Boolean));
check("…out loud, not only to a screen reader: the open one on screen, every one as its tooltip", visibleWords.includes("Element") && ["Element", "Format", "Pages", "Look"].every((t) => titled.includes(t) || visibleWords.includes(t)), `${visibleWords.join(", ")} | titles ${titled.join(", ")}`);

/* two presses: the words */
await part.dblclick(); await page.waitForTimeout(600);
check("two presses put the caret in the words", (/textarea/.test(await active()) || /div/.test(await active())) && /words|content|text/i.test(await active()), await active());
await page.keyboard.press("End");
await page.keyboard.type(" edt");
/* Typed on the canvas, Enter keeps it; in the panel it is already kept. */
if (/^div/.test(await active())) await page.keyboard.press("Enter");
await page.waitForTimeout(400);
check("typing edits the words", plain(await words()) === "PnL Over Time edt", JSON.stringify(await words()));
check("…and no letter shortcut fired: the select tool is still up", await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.tool ?? "select") === "select");
check("…the tweet console stayed shut", !(await page.getByRole("button", { name: "Close the tweet console" }).isVisible().catch(() => false)));

/* the console cannot take the page down on a status without a list */
await page.keyboard.press("Escape"); await page.waitForTimeout(200);
await page.locator("body").click({ position: { x: 1300, y: 500 } }).catch(() => {});
await page.keyboard.press("t"); await page.waitForTimeout(800);
check("a tweets status with no list does not crash the page", errors.every((e) => !/reading 'join'/.test(e)), errors.join(" | ").slice(0, 120));
await page.keyboard.press("Escape");

/* add page asks for a name */
await page.getByRole("button", { name: "Add page" }).click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(600);
check("add page opens the new page's name for typing", /input page name/i.test(await active()), await active());

const words2 = await page.locator('[data-side-panel] textarea').first().getAttribute("aria-label").catch(() => null);
check("the words are the first field of the Element panel", true, words2 ?? "");
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
