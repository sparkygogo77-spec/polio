/**
 * The key with no PIN: held in this browser, and one way to be rid of it.
 *
 * The pad was a five-minute idle timer and a relock on every reload in front
 * of a key that anything on this machine could read the moment it was
 * unlocked. So there is no pad on the way in: the panel opens onto the
 * fields, what is typed is kept in localStorage across reloads *and* tabs,
 * and Forget is the whole of the ceremony. This walks that, and checks the
 * two things that would make it a lie — that it really does survive a new
 * tab, and that Forget really does empty the browser.
 *
 *   node tests/keys-plain.mjs [url]      # default http://localhost:3000
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
const SECRET = "sk-ant-plain-test-0123456789";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1500, height: 900 } });
const page = await context.newPage();
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });

const panelOf = (pg) => pg.locator("[data-keys-panel]");
const openPanel = async (pg) => {
  if ((await panelOf(pg).getAttribute("data-open")) !== "1") await pg.getByRole("button", { name: "Keys", exact: true }).click();
  await pg.waitForTimeout(400);
};

// 1. No pad anywhere on the way in.
await openPanel(page);
const panel = panelOf(page);
check("the panel opens straight onto the keys", await panel.getByText("Save to this browser").isVisible());
check("no PIN is asked for", (await panel.getByText("Choose a four-digit PIN").count()) === 0 && (await panel.getByText("Enter your PIN").count()) === 0);
check("it says how the key is kept", await panel.getByText("How this is kept").isVisible());

// 2. Save one.
await panel.locator('input[type="password"]').first().fill(SECRET);
await panel.getByRole("button", { name: "Save to this browser" }).click();
await page.waitForTimeout(500);
check("a key can be saved", await panel.getByText("saved").isVisible().catch(() => false));
/* Written, sealed (93fc078a): one entry, builder.keys, and the key readable in no store. */
check("it is written to this browser, sealed: never readable in storage", await page.evaluate((s) => {
  if (!localStorage.getItem("builder.keys") || localStorage.getItem("builder.keys.plain") !== null) return false;
  for (const st of [localStorage, sessionStorage]) for (let i = 0; i < st.length; i++) if ((st.getItem(st.key(i)) ?? "").includes(s)) return false;
  return true;
}, SECRET));

// 3. A reload keeps it, with no pad.
await page.reload({ waitUntil: "networkidle" });
await openPanel(page);
check("a reload does not lock it", await panelOf(page).getByText("Save to this browser").isVisible());
check("the key is still there after a reload", (await panelOf(page).locator('input[type="password"]').first().inputValue()) === SECRET);

// 4. And so does a new tab — the thing the tab-held key could never do.
const tab = await context.newPage();
await tab.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await openPanel(tab);
check("a new tab has it too", (await panelOf(tab).locator('input[type="password"]').first().inputValue()) === SECRET);
await tab.close();

// 5. Forget empties the browser.
await panelOf(page).getByRole("button", { name: "Forget the key" }).last().click();
await page.waitForTimeout(400);
const gone = await page.evaluate((s) => {
  for (let i = 0; i < localStorage.length; i++) if ((localStorage.getItem(localStorage.key(i)) ?? "").includes(s)) return false;
  return true;
}, SECRET);
check("Forget takes it out of storage", gone);
check("and out of the field", (await panelOf(page).locator('input[type="password"]').first().inputValue()) === "");

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
