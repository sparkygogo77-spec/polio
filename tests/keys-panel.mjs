/**
 * The keys panel: the PIN holds, and nothing is written down in the clear.
 *
 * The last check is the one that matters. A keys panel that unlocks nicely but
 * leaves the key readable in storage is worse than no keys panel, because it looks
 * like protection. This walks the whole round trip — set a PIN, save a key,
 * lock, refuse a wrong PIN, accept the right one, find the key again — and
 * then reads the browser's own storage to confirm the key is not in it.
 *
 *   node tests/keys-keys panel.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const SECRET = "sk-ant-test-do-not-use-0123456789";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
// The PIN is off by default now: this test is about the keys panel that is still
// there behind the setting, so it turns it on before the app loads.
const PIN_ON = { state: { values: { "keys.pin": true }, advanced: true }, version: 0 };
await page.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate((v) => localStorage.setItem("builder.settings", JSON.stringify(v)), PIN_ON);
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });

const panel = page.locator("[data-keys-panel]");
const openPanel = async () => {
  if ((await panel.getAttribute("data-open")) !== "1") await page.getByRole("button", { name: "Keys", exact: true }).click();
  await page.waitForTimeout(400);
};
const typePin = async (pin) => {
  for (const d of pin) { await page.getByRole("button", { name: d, exact: true }).click(); await page.waitForTimeout(70); }
  await page.waitForTimeout(1200); // PBKDF2 is deliberately slow
};

// 1. Both buttons are in the top bar.
check("a key button sits in the top bar", (await page.locator("header").getByRole("button", { name: "Keys", exact: true }).count()) === 1);
const gh = page.locator("header").getByRole("button", { name: /GitHub/ });
check("a GitHub button sits in the top bar", (await gh.count()) === 1, await gh.first().getAttribute("aria-label"));

// 2. First open asks for a new PIN.
await openPanel();
check("the panel opens", (await panel.getAttribute("data-open")) === "1");
check("it asks for a new PIN first", await panel.getByText("Choose a four-digit PIN").isVisible());

// 3. Set it, twice.
await typePin("1234");
check("it asks for the PIN a second time", await panel.getByText("Type it once more").isVisible().catch(() => false));
await typePin("1234");
check("the keys panel opens once the two agree", await panel.getByText("Save to this browser").isVisible());

// 4. Save a key.
const field = panel.locator('input[type="password"]').first();
await field.fill(SECRET);
await panel.getByRole("button", { name: "Save to this browser" }).click();
await page.waitForTimeout(900);
check("a key can be saved", await panel.getByText("saved").isVisible().catch(() => false));

// 5. The important one: storage holds no plaintext.
const stored = await page.evaluate(() => localStorage.getItem("builder.keys") ?? "");
check("something was written down", stored.length > 40, `${stored.length} bytes`);
check("the key is NOT in storage in the clear", !stored.includes(SECRET));
check("the whole of storage holds no plaintext key", await page.evaluate((s) => {
  for (let i = 0; i < localStorage.length; i++) if ((localStorage.getItem(localStorage.key(i)) ?? "").includes(s)) return false;
  return true;
}, SECRET));

// 6. Lock, then refuse a wrong PIN.
await panel.getByRole("button", { name: "Lock", exact: true }).click();
await page.waitForTimeout(400);
check("locking hides the keys", await panel.getByText("Enter your PIN").isVisible());
await typePin("9999");
check("a wrong PIN is refused", await panel.getByText("That is not the PIN").isVisible().catch(() => false));

// 7. The right one brings the key back.
await typePin("1234");
check("the right PIN opens it again", await panel.getByText("Save to this browser").isVisible().catch(() => false));
check("the key survived the round trip", (await panel.locator('input[type="password"]').first().inputValue()) === SECRET);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
