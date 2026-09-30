/**
 * THE COLOUR PALETTE ON A CAPTURED SITE THAT DOES NOT USE ONE.
 *
 * trumpmorty.fun (sink sites/trumpmorty-fun), landed as Bring lands it. The
 * owner's words: it does not use a consistent colour set, some colours never
 * made it into the palette, and the six swatches said "1, 10, 135, none, 20,
 * 13" and nothing else. What is held here (docs/audit/palette-captured.md):
 *
 *   · the colours are grouped by what they are used for — text, fills,
 *     borders & outlines, shadows & glows, accents — each with its count;
 *   · every colour the parts wear is listed, the rest under "Also on this site";
 *   · a swatch says which parts use it, and recolours exactly those;
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
const C = await jiti.import(join(here, "..", "src", "features", "studio", "siteColours.ts"));

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate((d) => window.__studioLoadDoc(d), doc);
await page.waitForTimeout(1500);
await page.evaluate(() => window.__studioSetLeftPanel?.("look"));
await page.waitForTimeout(800);
const state = () => page.evaluate(() => window.__studioPublishDoc());
const press = (sel) => page.locator(sel).first().evaluate((b) => b.click());

/* ------------------------------------------------------------------ */
/* 1. Grouped by use, each with its count                              */
/* ------------------------------------------------------------------ */

const groups = await page.evaluate(() => [...document.querySelectorAll("[data-site-colours] [data-site-group]")].map((g) => ({
  use: g.getAttribute("data-site-group"),
  swatches: [...g.querySelectorAll("[data-site-swatch]")].map((s) => ({ key: s.getAttribute("data-site-swatch"), n: Number(s.textContent.trim()) })),
})));
const uses = groups.map((g) => g.use);
check("the site's colours are grouped: text, fills, borders & outlines, shadows & glows, accents",
  ["text", "fill", "border", "shadow", "accent"].every((u) => uses.includes(u)), uses.join(", "));
const s0 = await state();
const pal = { ...s0.look.palette };
const T = C.tallyColours(s0.nodes, pal);
const wrong = groups.filter((g) => g.use !== "also").flatMap((g) => g.swatches.filter((s) => T.byUse[g.use].find((c) => c.key === s.key)?.by[g.use] !== s.n).map((s) => `${g.use} ${s.key} shows ${s.n}`));
check("each swatch's number is how many parts use it that way", wrong.length === 0 && groups.some((g) => g.swatches.length), wrong.slice(0, 4).join("; ") || `${groups.reduce((n, g) => n + g.swatches.length, 0)} swatches`);

/* ------------------------------------------------------------------ */
/* 2. Every colour listed                                              */
/* ------------------------------------------------------------------ */

await press('[data-site-group="also"] button[aria-expanded]');
await page.waitForTimeout(400);
const listed = new Set(await page.evaluate(() => [...document.querySelectorAll("[data-site-colours] [data-site-swatch]")].map((s) => s.getAttribute("data-site-swatch"))));
const worn = T.all.filter((c) => c.spots.some((s) => s.id !== C.PAGE_ID));
const unlisted = worn.filter((c) => !listed.has(c.key));
check(`every colour the parts wear is listed (${worn.length})`, unlisted.length === 0, unlisted.slice(0, 5).map((c) => c.key).join("; ") || `${listed.size} swatches`);
check("the ones past each group's first eight are under \"Also on this site\"", (await page.locator('[data-site-group="also"]').count()) === 1 && /Also on this site/.test(await page.locator('[data-site-group="also"]').innerText()));
check("pictures are said, not silently left out", /are pictures/.test(await page.locator("[data-site-colours]").innerText()));

/* ------------------------------------------------------------------ */
/* 3. A swatch: who wears it, and recolour exactly them                */
/* ------------------------------------------------------------------ */

const SUN = "rgb(243, 212, 64)";
await press(`[data-site-group="text"] [data-site-swatch="${SUN}"]`);
await page.waitForTimeout(400);
const wearers = [...new Set(C.whoWears(s0.nodes, pal, SUN, "text").map((x) => x.id))];
const shown = await page.evaluate(() => [...document.querySelectorAll("[data-site-colour-detail] [data-site-part]")].map((e) => e.getAttribute("data-site-part")));
check("pressing the yellow Text swatch lists exactly the parts whose words are yellow", shown.length === wearers.length && wearers.every((id) => shown.includes(id)), `${shown.length} listed, ${wearers.length} wear it`);
check("…and says how many", new RegExp(`^${wearers.length} parts? wear it on the words`).test((await page.locator("[data-site-colour-says]").innerText()).trim()), await page.locator("[data-site-colour-says]").innerText());
await page.locator('[data-site-colour-detail] input[aria-label="New colour, as hex"]').fill("#00ffcc");
await press("[data-site-swap]");
await page.waitForTimeout(500);
const s1 = await state();
const moved = s1.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(s0.nodes[i])).map((n) => n.id);
check("Recolour changes exactly those parts and no other", moved.length === wearers.length && moved.every((id) => wearers.includes(id)), `${moved.length} changed`);
const stillSun = s1.nodes.filter((n) => wearers.includes(n.id)).filter((n) => C.spotsOf(n, pal).some((w) => w.spot.use === "text" && w.key === SUN));
check("…and none of them has yellow words left", stillSun.length === 0);
const otherUses = C.whoWears(s0.nodes, pal, SUN).filter((x) => x.use !== "text").length;
check("…while the yellow's other uses (fills, shadows) are where they were", C.whoWears(s1.nodes, pal, SUN).filter((x) => x.use !== "text").length === otherUses, `${otherUses} other uses`);
await press("[data-site-swapped] button");
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
