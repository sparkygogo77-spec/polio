#!/usr/bin/env node
/**
 * DRAW A SPACE CAN BE FOUND: A COMMAND AND A BUTTON WITH ITS NAME ON IT.
 *
 * The audit (B): the space — the box a closed line becomes, and its panel on
 * the right — was reached by the S key and a menu inside the tool picker, and
 * the owner had only met it through the repository import. Search commands
 * (Ctrl K) had nothing for it.
 *
 *   node tests/space-command.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const tool = () => page.locator("[data-tool-picker]").getAttribute("aria-label");

/* Ctrl K, "draw a space". */
await page.keyboard.press("Control+k"); await page.waitForTimeout(400);
await page.keyboard.type("draw a space"); await page.waitForTimeout(500);
const listed = await page.evaluate(() => [...document.querySelectorAll("[cmdk-item], [role=option]")].map((e) => e.textContent.replace(/\s+/g, " ").trim()));
check("Search commands lists Draw a space", listed.some((t) => /Draw a space/i.test(t)), listed.slice(0, 5).join(" | "));
await page.keyboard.press("Enter"); await page.waitForTimeout(400);
check("…and choosing it takes up the space tool", /Draw a space/.test(await tool() ?? ""), await tool());
await page.keyboard.press("v"); await page.waitForTimeout(200);

/* The button on the bar, with its name on it. */
const btn = page.locator("[data-draw-space-button]");
const box = await btn.boundingBox().catch(() => null);
check("a button on the bar reads \"Draw a space\"", (await btn.count()) === 1 && /Draw a space/.test(await btn.innerText()) && !!box && box.y < 120, box ? `at ${Math.round(box.x)},${Math.round(box.y)}` : "none");
if (await btn.count()) { await btn.click(); await page.waitForTimeout(300); }
check("…pressing it takes up the space tool", /Draw a space/.test(await tool() ?? ""), await tool());
const fr = await page.locator("[data-frame]").boundingBox();
const cx = fr.x + fr.width * 0.5, cy = fr.y + 300;
await page.mouse.move(cx - 150, cy - 100); await page.mouse.down();
for (const [dx, dy] of [[150, -100], [150, 100], [-150, 100], [-150, -100]]) await page.mouse.move(cx + dx, cy + dy, { steps: 10 });
await page.mouse.up(); await page.waitForTimeout(900);
check("…and a closed shape drawn opens the space's panel on the right", (await page.locator("[data-space-panel]").count()) === 1);
await page.screenshot({ path: process.env.SHOT ?? "/tmp/space-command.png" });
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
