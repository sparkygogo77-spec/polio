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
 *   · the panel keeps the fields no renderer reads under one closed "Brief
 *     for a new build", and shows only live ones under This site.
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
  "src/features/studio/shelf/parts/theme.ts",
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
/*
 * THE OWNER'S LATER RULING: no BRIEF tag on each field. The panel is This
 * site (what the preview draws), Whole-site features, and one closed "Brief
 * for a new build" holding the rest (tests/side-panel-g.mjs). So what was a
 * tag per field is now where the field sits.
 */
const siteRows = await page.locator("[data-format-section=site] [data-site-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-site-row")));
const siteFields = siteRows.map((id) => (id === "accent" ? "palette.accentHue" : id)).filter((id) => ids.has(id));
check("every field This site shows is one the preview draws", siteFields.length >= 4 && siteFields.every((id) => read.has(id)), siteFields.join(", "));
await page.locator("[data-brief-fold]").click();
await page.waitForTimeout(300);
check("no field carries a BRIEF tag, even with the brief open", (await page.locator("[data-brief-only]").count()) === 0 && (await page.locator("[data-format-field]").count()) > 20);
const briefRow = page.locator("[data-format-field=\"type.dropCap\"]");
check("a field the preview does not draw sits in the brief, which says what that means", (await briefRow.count()) === 1 && /builder is told/i.test(await page.locator("[data-brief-fold]").innerText()));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
