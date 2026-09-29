#!/usr/bin/env node
/**
 * UPDATE LIVE SITE NEVER SAYS A HELD KEY IS MISSING, AND A PRESS RIGHT AFTER
 * A RELOAD PUBLISHES.
 *
 * The owner: right after a reload the button showed "needs GitHub + Vercel"
 * for a moment with both keys held in this browser, and a press in that
 * moment opened the Keys panel instead of publishing. Opening the held keys
 * is asynchronous (IndexedDB and a decrypt) and the key check ran before it
 * finished. Held here with the decrypt slowed to 1.5s, so the moment is long
 * enough to see and to press in.
 *
 *   node tests/go-live-keys-ready.mjs http://127.0.0.1:3013
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
/* Nothing reaches GitHub or Vercel from here: the publish itself is answered in the browser and recorded. */
await page.route(/https:\/\/api\.(github|vercel)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
const pushes = [];
await page.route("**/api/studio/publish", (r) => {
  if (r.request().method() !== "POST") return r.continue();
  pushes.push(Date.now());
  return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, message: "stood in: nothing was pushed" }) });
});
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.clear();
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Held Keys", updatedAt: Date.now() }], activeId: "s1" }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click(); await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("ghp_placeholder_not_a_token_000000000000");
await keys.locator('[data-service="vercel"] input[type="password"]').first().fill("vercel_placeholder_not_a_token_0000");
await keys.getByRole("button", { name: /Save to this browser/ }).first().click(); await page.waitForTimeout(600);
await keys.getByRole("button", { name: "Close keys" }).click(); await page.waitForTimeout(1500);
const bar = page.locator("header [data-go-live]");
check("with both keys held, the button is ready before the reload", (await bar.getAttribute("data-go-live-state")) === "ready", await bar.getAttribute("data-go-live-state"));

/* The reload, with this browser's decrypt slowed so the keys take 1.5s to open. */
await page.addInitScript(() => {
  const d = crypto.subtle.decrypt.bind(crypto.subtle);
  crypto.subtle.decrypt = (...a) => new Promise((ok) => setTimeout(ok, 1500)).then(() => d(...a));
});
await page.reload({ waitUntil: "domcontentloaded" });
const seen = new Set();
let hint = false;
const t0 = Date.now();
for (let i = 0; i < 60; i++) {
  const s = await page.evaluate(() => {
    const b = document.querySelector("header [data-go-live]");
    return b ? { state: b.getAttribute("data-go-live-state"), why: document.querySelector("header [data-go-live-why]")?.textContent ?? null } : null;
  });
  if (s) { seen.add(s.state); if (s.why) hint = s.why; }
  if (s?.state === "ready") break;
  await page.waitForTimeout(50);
}
check("after the reload it never says a held key is missing", !hint, `hint ${JSON.stringify(hint)}, states ${[...seen].join(" → ")}, ${Date.now() - t0}ms`);
check("…and it ends ready", seen.has("ready"), [...seen].join(" → "));

/* Pressed at once after another reload, while the keys are still being opened. */
await page.reload({ waitUntil: "domcontentloaded" });
for (let i = 0; i < 100 && !(await bar.count()); i++) await page.waitForTimeout(30);
const pressedIn = await bar.getAttribute("data-go-live-state");
const n = pushes.length;
await bar.click({ force: true });
await page.waitForTimeout(4000);
const panel = await page.evaluate(() => { const e = document.querySelector("[data-keys-panel]"); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), vis: getComputedStyle(e).visibility, text: e.textContent.slice(0, 60) }; });
check("a press in that moment does not open the Keys panel", !panel || panel.w === 0 || panel.x >= 1440, `pressed while ${pressedIn}; panel ${JSON.stringify(panel)}`);
check("…it waits for the keys and publishes", pushes.length > n, `${pushes.length - n} push(es), pressed while ${pressedIn}`);
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
