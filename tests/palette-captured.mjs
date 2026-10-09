/**
 * THE COLOUR PALETTE ON A CAPTURED SITE THAT DOES NOT USE ONE.
 *
 * trumpmorty.fun (sink sites/trumpmorty-fun), landed as Bring lands it. The
 * owner's words: it does not use a consistent colour set, some colours never
 * made it into the palette, and the six swatches said "1, 10, 135, none, 20,
 * 13" and nothing else. What is held here (docs/audit/palette-captured.md):
 *
 *   · only the theme is listed: colours worn by three parts or more, by role
 *     (J, 2026-10-09; one-off colours are changed on the part itself);
 *   · Build palette on an imported site asks first, and can be undone;
 *   · no bare "none";
 *   · every face, with its count, and swap-all.
 *
 *   node tests/palette-captured.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { trumpmorty } from "./fixtures/trumpmorty.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)("playwright-core");
const URL_ = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const doc = await trumpmorty();
if (!doc) {
  console.log("the trumpmorty capture was not found (SINK=…/sites/trumpmorty-fun); nothing ran");
  process.exit(1);
}
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const C = await jiti.import(join(here, "..", "src", "features", "studio", "look", "siteColours.ts"));

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.__studioLoadDoc === "function" && typeof window.__studioPublishDoc === "function", null, { timeout: 60000 });
await page.evaluate((d) => window.__studioLoadDoc(d), doc);
await page.waitForTimeout(1500);
await page.evaluate(() => window.__studioSetLeftPanel?.("look"));
await page.waitForTimeout(800);
const state = async () => { await page.waitForFunction(() => typeof window.__studioPublishDoc === "function", null, { timeout: 60000 }); return page.evaluate(() => window.__studioPublishDoc()); };
const press = (sel) => page.locator(sel).first().evaluate((b) => b.click());

/* ------------------------------------------------------------------ */
/* 1-3. Only the theme (J, 2026-10-09)                                 */
/* ------------------------------------------------------------------ */

/* The unmerged list by use and the "More colours" fold are gone: a colour on
   one or two parts is changed on the part itself. The theme (role rows,
   three parts or more) is what the panel lists; tests/site-roles.mjs holds
   pressing one and Recolour all. */
const s0 = await state();
const pal = { ...s0.look.palette };
check("no More colours fold, no colour-by-use list", (await page.locator("[data-role-more], [data-site-group]").count()) === 0);
const counts = await page.evaluate(() => [...document.querySelectorAll("[data-role-row] [data-role-swatch]")].map((e) => e.textContent));
check("every theme swatch is worn by three parts or more", counts.length > 0 && counts.every((t) => !/\bon [12] parts?\b|: [12] buttons?\b/.test(t)), counts.slice(0, 4).join(" | "));
check("pictures are said, not silently left out", /Left out:[\s\S]*picture/.test(await page.locator("[data-site-left-out]").innerText()));
await page.locator("[data-site-colours]").screenshot({ path: ".screenshots/look-theme-before.png" });
/* Randomize theme: every theme swatch moves, words stay readable on the main fill, one undo takes it all back. */
await press("[data-randomize-theme] button");
await page.waitForTimeout(800);
const rolled = await state();
const movedParts = rolled.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(s0.nodes[i])).length;
check("Randomize theme repaints the site's parts", movedParts >= 20, `${movedParts} parts`);
await page.locator("[data-site-colours]").screenshot({ path: ".screenshots/look-theme-rolled.png" });
await page.screenshot({ path: ".screenshots/look-theme-rolled-board.png" });
await press("[data-theme-rolled] button");
await page.waitForTimeout(500);
check("…and one Undo puts every one back", JSON.stringify((await state()).nodes) === JSON.stringify(s0.nodes));

/* ------------------------------------------------------------------ */
/* 4. Words a person understands; counts that are current              */
/* ------------------------------------------------------------------ */

const roleLabels = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-look-colour] [data-role-source]")].map((e) => [e.getAttribute("data-role-source"), e.textContent.trim()])));
check("no role says a bare \"none\"", !Object.values(roleLabels).some((t) => /^none$/i.test(t)), JSON.stringify(roleLabels));
check("a role the site gave nothing says \"not used\"", roleLabels.muted === "not used", roleLabels.muted);
await press('[data-look-colour] button[aria-label="Muted text"]');
await page.waitForTimeout(300);
check("…and why, in words", /not used on this site, so it shows the text colour/.test(await page.locator("[data-role-says]").innerText()), await page.locator("[data-role-says]").innerText());
await press('[data-look-colour] button[aria-label="Text"]');
await page.waitForTimeout(300);
check("moving a role on this site says it repaints the parts that follow it", /Changing it repaints those \d+/.test(await page.locator("[data-role-says]").innerText()), await page.locator("[data-role-says]").innerText());

/* ------------------------------------------------------------------ */
/* 5. Build palette asks first, and can be undone                      */
/* ------------------------------------------------------------------ */

const build = page.locator("[data-look-colour] button", { hasText: "Build palette" }).first();
await build.evaluate((b) => b.click());
await page.waitForTimeout(400);
check("Build palette on an imported site asks before it repaints", (await page.locator("[data-build-ask]").count()) === 1 && /repaints the \d+ parts?/.test(await page.locator("[data-build-ask]").innerText()));
check("…and asking changed nothing", JSON.stringify((await state()).look.palette) === JSON.stringify(pal));
await press("[data-build-confirm]");
await page.waitForTimeout(500);
const built = (await state()).look.palette;
check("confirmed, it builds", JSON.stringify(built) !== JSON.stringify(pal));
await press("[data-build-done] button");
await page.waitForTimeout(500);
check("…and its Undo puts the site's colours back", JSON.stringify((await state()).look.palette) === JSON.stringify(pal) && JSON.stringify((await state()).nodes) === JSON.stringify(s0.nodes));

/* ------------------------------------------------------------------ */
/* 6. Fonts                                                            */
/* ------------------------------------------------------------------ */

const F = C.tallyFonts(s0.nodes);
const rows = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-site-fonts] [data-site-font]")].map((e) => [e.getAttribute("data-site-font"), e.textContent.trim()])));
const fontsWrong = F.filter((f) => !new RegExp(`${f.parts} parts?$`).test(rows[f.key || "site"] ?? ""));
check("every face is listed with how many parts use it", fontsWrong.length === 0 && ["Luckiest Guy", "Fredoka", "VT323"].every((k) => rows[k]), JSON.stringify(rows));
await press('[data-site-font="VT323"]');
await page.waitForTimeout(300);
const vt = F.find((f) => f.key === "VT323");
check("pressing one lists its parts", (await page.locator("[data-site-font-detail] [data-site-part]").count()) === vt.parts, `${await page.locator("[data-site-font-detail] [data-site-part]").count()} of ${vt.parts}`);
await page.locator('[data-site-font-detail] [aria-label="New face"]').click();
await page.waitForTimeout(300);
await page.getByRole("option", { name: "Fredoka", exact: true }).click();
await page.waitForTimeout(200);
await press("[data-site-font-swap]");
await page.waitForTimeout(500);
const s2 = await state();
check("swap-all moves every VT323 part to Fredoka, and nothing else", C.tallyFonts(s2.nodes).every((f) => f.key !== "VT323")
  && s2.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(s0.nodes[i])).length === vt.parts);
await press("[data-site-font-swapped] button");
await page.waitForTimeout(500);
check("…and Undo puts them back", JSON.stringify((await state()).nodes) === JSON.stringify(s0.nodes));

await page.locator("[data-look-panel]").screenshot({ path: process.env.SHOT ?? join(here, "..", ".scratch", "look-after.png") }).catch(() => {});
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
