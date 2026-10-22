#!/usr/bin/env node
/**
 * THE BUILDER'S CLOSED OVERLAYS LOAD AFTER THE PAGE, NOT WITH IT.
 *
 * The shell mounts the command palette, the shortcuts sheet, the post
 * console and the tour on every Builder page, closed. They were in the
 * script the page waits for before it can draw (the scripts its HTML
 * names); now they load once the page is up (`AppShell.tsx`).
 *
 *   1. the scripts `/builder`'s HTML names hold neither the post console nor
 *      the command palette (each found by a string only it holds), and add
 *      up to under 3,960 KB (4,016 before, 3,916 after);
 *   2. both still load, after the page;
 *   3. the palette still opens on its key, and no page errors.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/shell-overlays-lazy.mjs http://127.0.0.1:3013
 *
 * Covers: src/core/shell/AppShell.tsx
 */
import { chromium } from "playwright-core";

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const BUDGET_KB = 3960;
const MARKS = { "post console": "Copy the whole thread", "command palette": "Type a command, page or setting" };

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"], ...(AT ? { executablePath: AT } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
/* A script the HTML names (the parser asked for it) is one the page waits for; one a script asks for comes after. */
const named = new Set();
cdp.on("Network.requestWillBeSent", (e) => { if (e.type === "Script" && e.initiator?.type === "parser") named.add(e.request.url); });
const scripts = [];
page.on("response", (r) => { if (r.request().resourceType() === "script" && r.url().startsWith(URL_BASE)) scripts.push({ url: r.url(), text: r.text().catch(() => "") }); });

await page.goto(URL_BASE + "/builder", { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(1500);
const all = await Promise.all(scripts.map(async (s) => ({ url: s.url, text: await s.text })));
const first = all.filter((s) => named.has(s.url));
const kb = Math.round(first.reduce((t, s) => t + Buffer.byteLength(s.text), 0) / 1024);
for (const [what, mark] of Object.entries(MARKS)) {
  check(`the page waits for none of the ${what}`, !first.some((s) => s.text.includes(mark)));
  check(`the ${what} still loads, after the page`, all.some((s) => s.text.includes(mark)));
}
check(`the scripts the page waits for are under ${BUDGET_KB} KB`, kb < BUDGET_KB, `${kb} KB in ${first.length} files`);

await page.locator("body").click({ position: { x: 5, y: 790 } }).catch(() => {});
await page.keyboard.press("Control+k");
const palette = await page.getByPlaceholder(/Type a command, page or setting/).isVisible({ timeout: 5000 }).catch(() => false);
check("the palette opens on its key", palette);
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
