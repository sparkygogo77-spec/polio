/**
 * The Ctrl+K palette takes typing even straight after a menu was closed.
 *
 * Found by the site audit (and by test-health's square-console): open
 * "More tools", press Escape, press Ctrl+K, type "drop a new idea", Enter —
 * the palette opened but the field never had focus (the closing menu gave
 * focus back to the body after the palette had asked for it), so the typing
 * went nowhere, the list stayed at every entry and Enter made no part.
 *
 *   node tests/palette-after-menu.mjs [url]     # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();
const URL = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(AT && existsSync(AT) ? { executablePath: AT } : {}) });

const parts = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? []).length);

async function run(label, before) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${URL}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await before(page);
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(250);
  await page.keyboard.type("drop a new idea");
  await page.waitForTimeout(350);
  const typed = await page.evaluate(() => document.querySelector("[cmdk-input]")?.value ?? null);
  check(`${label}: the palette field has what was typed`, typed === "drop a new idea", `field = ${JSON.stringify(typed)}`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(650);
  check(`${label}: Enter makes the part`, (await parts(page)) === 1, `${await parts(page)} parts`);
  await page.close();
}

await run("fresh page", async () => {});
await run("after More tools was closed with Escape", async (page) => {
  await page.locator("[data-toolbar-more]").first().click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
});

await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
