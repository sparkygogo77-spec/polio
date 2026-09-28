/**
 * A page added after a page was deleted gets a name and a route of its own.
 *
 * Measured on 4254477 in the Pages tab: Home, Add, Add is Home /, Page 2
 * /page-2, Page 3 /page-3. Delete Page 2 and Add again, and the new one was
 * "Page 3" at /page-3 — the number was the count of pages plus one, and the
 * count had gone down. Two pages on one route: the preview could only ever
 * open the first, and the export wrote page-3/index.html twice, the second
 * over the first, so a published page vanished.
 *
 * Held here through the panel: every name and every route stays distinct
 * after add, add, delete, add, add; and the export has one file per page.
 *
 *   node tests/pages-unique.mjs [url]
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(async () => { localStorage.clear(); for (const d of (await indexedDB.databases?.()) ?? []) indexedDB.deleteDatabase(d.name); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const pages = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.pages ?? []);
const says = (ps) => ps.map((p) => `${p.name} ${p.path}`).join(", ");
const side = page.locator("[data-side-panel]");
await side.locator("[role=radio]").filter({ hasText: "Pages" }).first().click();
await page.waitForTimeout(300);
const add = side.getByRole("button", { name: "Add", exact: true });
await add.click();
await add.click();
await page.waitForTimeout(300);
let ps = await pages();
check("Home, then two added pages", ps.length === 3, says(ps));

/* Delete the middle one, from its own row. */
await side.getByText(ps[1].name, { exact: true }).first().click();
await page.waitForTimeout(200);
await side.getByRole("button", { name: "Delete" }).click();
await page.getByRole("button", { name: "Delete" }).last().click();
await page.waitForTimeout(300);
ps = await pages();
check("the middle page is gone", ps.length === 2 && !ps.some((p) => p.name === "Page 2"), says(ps));

await add.click();
await add.click();
await page.waitForTimeout(300);
ps = await pages();
check("four pages after two more adds", ps.length === 4, says(ps));
check("no two pages share a name", new Set(ps.map((p) => p.name)).size === ps.length, says(ps));
check("no two pages share a route", new Set(ps.map((p) => p.path)).size === ps.length, says(ps));

const files = await page.evaluate(async () => ((await window.__studioExport?.()) ?? []).map((f) => f.path).filter((p) => p.endsWith(".html")));
check("the export writes one page file per page, none over another", files.length === ps.length && new Set(files).size === files.length, files.join(" "));
check("no page error", errors.length === 0, errors.join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
