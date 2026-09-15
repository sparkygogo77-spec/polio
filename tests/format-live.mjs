/**
 * The Format fields no renderer reads say so (inventory B25).
 *
 * The Format panel offers 71 fields and every one of them was promised to
 * shape the site. The renderers read 14. The other 57 reach the blueprint,
 * which is where they matter, and nothing said so: a person turning
 * "drop cap" on watched the preview not change and had no way to know
 * that was the design. This holds the panel to the code:
 *
 *   · which fields the live renderers read is derived from their source,
 *     not from a list somebody keeps (a source read, named as one);
 *   · every field carries `live` exactly when a renderer reads it;
 *   · the panel marks every field that is brief only, and none that is live.
 *
 *   node tests/format-live.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { FORMAT_FIELDS } from "../src/features/studio/format.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* 1. What the renderers read, off their own source. */
const RENDERERS = [
  ...readdirSync("src/features/studio/live").filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => `src/features/studio/live/${f}`),
  "src/features/studio/parts/theme.ts",
  "src/features/studio/blocks.tsx",
];
const read = new Set();
for (const file of RENDERERS) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/(?:format|f|values|fmt)\["([a-z]+\.[A-Za-z]+)"\]/g)) read.add(m[1]);
}
const ids = new Set(FORMAT_FIELDS.map((f) => f.id));
const unknown = [...read].filter((id) => !ids.has(id));
check(`the renderers read ${read.size} fields, all of them fields the panel offers (source read)`, read.size >= 10 && unknown.length === 0, unknown.join(", ") || [...read].sort().join(", "));

/* 2. Every field says which it is. */
const wrong = FORMAT_FIELDS.filter((f) => Boolean(f.live) !== read.has(f.id));
check("every field carries `live` exactly when a renderer reads it", wrong.length === 0, wrong.map((f) => `${f.id}${f.live ? " (says live, unread)" : " (read, unmarked)"}`).join(", ") || "all agree");
const briefOnly = FORMAT_FIELDS.filter((f) => !f.live);
check(`and the rest, ${briefOnly.length} of ${FORMAT_FIELDS.length}, are brief only`, briefOnly.length === FORMAT_FIELDS.length - read.size, `${briefOnly.length}`);

/* 3. The panel says so. */
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const tab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Format" }).first();
if (await tab.count()) await tab.click().catch(() => {});
await page.waitForTimeout(400);
const all = page.locator("[data-side-panel] input[type=checkbox], [data-side-panel] [role=switch]").filter({ hasText: "" });
const allToggle = page.getByLabel(/all options|advanced/i).first();
if (await allToggle.count()) { await allToggle.click({ force: true }).catch(() => {}); await page.waitForTimeout(400); }
const chips = await page.locator("[data-brief-only]").count();
check("the panel marks every brief-only field, and no other", chips === briefOnly.length, `${chips} marked, ${briefOnly.length} brief only`);
const liveRow = page.locator("[data-format-field=\"type.baseSize\"]");
check("a field the preview draws carries no such mark", (await liveRow.count()) === 1 && (await liveRow.locator("[data-brief-only]").count()) === 0);
const briefRow = page.locator("[data-format-field=\"type.dropCap\"]");
check("and one it does not is marked, with a hint saying what that means", (await briefRow.locator("[data-brief-only]").count()) === 1 && /blueprint/i.test((await briefRow.locator("[data-brief-only]").getAttribute("title")) ?? ""));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
