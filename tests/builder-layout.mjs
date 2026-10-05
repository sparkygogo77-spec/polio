/**
 * THE BUILDER'S LAYOUT GIVES THE BOARD BACK (J, 2026-10-05).
 *
 *   · the thirteen category icons fold into one "+ Add" button: someone who
 *     has never opened the shelf sees the button, not the row, and one press
 *     opens the categories;
 *   · a site still on its stand-in name ("Site 10") shows the name of the
 *     site it was brought in from;
 *   · a name someone typed is never touched.
 *
 * The state steppers docked above the board are held by tests/state-frames.mjs.
 *
 *   npx next start -p 3013
 *   node tests/builder-layout.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const now = Date.now();
const builds = JSON.stringify({ state: {
  projects: [
    { id: "a", name: "Site 10", updatedAt: now, source: { owner: "someone", name: "PST", branch: "main" } },
    { id: "b", name: "Site 2", updatedAt: now - 1, source: { owner: "someone", name: "sink", branch: "main", dir: "sites/bakery" } },
    { id: "c", name: "My shop", updatedAt: now - 2, source: { owner: "someone", name: "shop", branch: "main" } },
    { id: "d", name: "Site 4", updatedAt: now - 3 },
  ],
  activeId: "a",
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((b) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.builds", b); localStorage.removeItem("builder.shelf.folded"); sessionStorage.setItem("seeded", "1"); } }, builds);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-studio-band]", { timeout: 20000 });
await page.waitForTimeout(1500);

/* + Add */
check("a first visit shows one + Add button, not the category row", (await page.locator("[data-shelf-add]").count()) === 1 && (await page.locator("[data-planets] [data-category]").count()) === 0);
check("…in a thin strip", await page.evaluate(() => document.querySelector("[data-studio-band]").getBoundingClientRect().height <= 40));
await page.locator("[data-shelf-add]").click();
await page.waitForTimeout(400);
check("one press opens the categories", (await page.locator("[data-planets] [data-category]").count()) > 1);

/* names */
const names = await page.evaluate(() => Object.fromEntries((JSON.parse(localStorage.getItem("builder.builds")).state.projects).map((p) => [p.id, p.name])));
check("'Site 10' brought in from PST is called PST", names.a === "PST", names.a);
check("a site from a folder of a repository takes the folder's name", names.b === "bakery", names.b);
check("a typed name stays", names.c === "My shop", names.c);
check("a blank site with nowhere it came from keeps its stand-in", names.d === "Site 4", names.d);
check("the switch button shows the real name", (await page.locator("[data-builds-switch]").first().innerText()).includes("PST"));

check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
