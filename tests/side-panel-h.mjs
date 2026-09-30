#!/usr/bin/env node
/**
 * THE SIDE PANEL'S FOLLOW-UPS, APPROVED BY THE OWNER, ON TRUMP & MORTY.
 *
 *   1  GENERATE IS ONE PLACE. The Generate tab was nearly empty and did what
 *      a part's "Make a picture" does. The tab is gone; the drawing tool is
 *      inside "Make a picture", a picture's "Draw one" opens it, and what it
 *      draws is put on the part in one press.
 *   2  PAGES SHOWS THE SHARED LINK. Under the site's name and description,
 *      the card a pasted link draws (picture, address, title, the line under
 *      it), from exactly what those boxes say, and a character guide on both.
 *   3  LOOK MAKES WORDS READABLE. The parts whose words are hard to read get
 *      one press that gives each the site's own word colour that reads on
 *      what it sits on, as one undo step. Outlined lettering is measured by
 *      its outline, so the site's white-edged-in-black headings are not
 *      "fixed" into plain dark ones.
 *
 * Nothing leaves the machine: the picture model is answered here.
 *
 *   npx next start -p 3013
 *   node tests/side-panel-h.mjs http://127.0.0.1:3013 ../sink/sites/trumpmorty-fun
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const SINK = process.argv[3] ?? process.env.SINK ?? join(here, "..", "..", "sink", "sites", "trumpmorty-fun");
const SHOTS = ".screenshots/side-panel-g";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const doc = JSON.parse(readFileSync(join(SINK, "site", "document.json"), "utf8"));
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/* ------------------------------------------------------------ the pure half */
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const src = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const { wordsContrast, readableFixes, tallyColours, HARD_TO_READ, READS } = await src("siteColours.ts");
const { resolvePalette } = await src("parts/theme.ts");
const palette = resolvePalette(doc.format, doc.look);
const rows = wordsContrast(doc.nodes, palette);
const ratio = (id) => rows.find((r) => r.id === id)?.ratio ?? 0;
check("3 outlined lettering reads by its outline: the white “HOW TO BUY” edged in near-black is readable", ratio("n_valueprop_43") >= READS, `${ratio("n_valueprop_43")} to 1`);
const hard = rows.filter((r) => r.ratio < HARD_TO_READ);
const fixes = readableFixes(doc.nodes, palette);
check("3 every hard-to-read part gets a fix", hard.length > 0 && fixes.length === hard.length, `${hard.length} hard, ${fixes.length} fixes`);
const worn = new Set([...tallyColours(doc.nodes, palette).byUse.text, ...tallyColours(doc.nodes, palette).byUse.fill].map((c) => c.value));
check("3 …each in a colour the site already wears", fixes.every((f) => worn.has(f.to)), fixes.map((f) => f.to).join(" "));
check("3 …that reads at any size", fixes.every((f) => f.now >= READS && f.now > f.was), fixes.map((f) => `${f.was}→${f.now}`).join(" "));

/* ------------------------------------------------------------ the browser half */
const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let drawn = 0;
await page.route("**/api/tweets/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }));
await page.route("**/api/studio/image", (r) => { drawn += 1; return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, image: `data:image/png;base64,${PNG}`, cost: 0.04 }) }); });
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate((state) => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "b1", name: "Trump & Morty", updatedAt: Date.now() }], activeId: "b1" }));
  /* As an import lands it (`docTake.ts`): the capture's head on the brief, its description typed in. */
  const brief = { ...state.brief, ...(state.head ? { head: state.head, description: state.brief?.description || state.head.description } : {}) };
  localStorage.setItem("builder.studio", env({ ...state, brief, activePageId: "page_home" }));
  localStorage.removeItem("builder.sidePanelWidth");
  localStorage.removeItem("builder.partSections");
}, doc);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const wait = (ms) => page.waitForTimeout(ms);
const side = page.locator("[data-side-panel]");
const tab = async (name) => { await side.getByRole("radio", { name }).first().click({ force: true }); await wait(600); };
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state);

/* 1 Generate */
const names = await side.locator("[role=radio]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? e.textContent.trim()));
check("1 there is no Generate tab", names.length === 5 && !names.includes("Generate"), names.join(", "));
await tab("Element");
/* A picture part, picked the way the tree offers it: its holders opened in turn, then its row. */
const { partTree, ancestors } = await src("partTree.ts");
const home = doc.nodes.filter((n) => n.pageId === "page_home");
const PIC = home.find((n) => n.featureId === "picture" && n.w > 200)?.id;
const tree = partTree(home);
for (const id of ancestors(tree, PIC)) {
  const t = side.locator(`[data-tree-row="${id}"] [data-tree-toggle]`);
  if ((await t.getAttribute("aria-expanded")) !== "true") { await t.click(); await wait(250); }
}
await side.locator(`[data-tree-row="${PIC}"] [data-element-row]`).click();
await wait(900);
const panel = side.locator(`[data-part-panel="${PIC}"]`);
check("1 a picture part's panel opens", (await panel.count()) === 1, PIC);
check("1 …with Make a picture closed", (await panel.locator('[data-part-section="make-picture"]').getAttribute("data-open")) === null);
await panel.locator("[data-draw-one]").click();
await wait(600);
check("1 the picture's “Draw one” opens Make a picture, where the drawing tool is", (await panel.locator('[data-part-section="make-picture"]').getAttribute("data-open")) === "" && (await panel.locator('[data-part-section="make-picture"] [data-render-panel]').count()) === 1);
check("1 …and there is one drawing tool, not two", (await side.locator("[data-render-panel]").count()) === 1 && (await panel.getByPlaceholder("what the picture should be").count()) === 0);
const tool = panel.locator("[data-render-panel]");
await tool.locator("[data-render-tweak]").fill("a green television, flat colours");
await tool.locator("[data-render-go]").click();
await wait(1500);
check("1 it draws (answered here, nothing spent)", drawn === 1 && (await tool.locator("[data-render-iteration]").count()) >= 1, `${drawn} call(s)`);
const was = (await stored()).nodes.find((n) => n.id === PIC)?.picture?.id ?? null;
await tool.locator("[data-render-put]").first().click();
await wait(1200);
const now = (await stored()).nodes.find((n) => n.id === PIC)?.picture ?? null;
check("1 “Put it on this part” puts the drawing on the part", !!now && now.id !== was && now.from === "drawn", JSON.stringify(now)?.slice(0, 100));
await page.screenshot({ path: `${SHOTS}/after-make-picture.png` });
await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");

/* 2 Pages */
await tab("Pages");
const card = side.locator("[data-shared-card]");
check("2 the shared link is drawn as a card", (await card.count()) === 1);
const cardTitle = (await card.locator("[data-card-title]").innerText()).trim();
check("2 …titled as the head says", cardTitle === doc.head.title, cardTitle);
check("2 …as the large card, since the capture's share picture is 1200 by 630", (await card.getAttribute("data-shared-card")) === "large", `${await card.getAttribute("data-shared-card")}`);
check("2 …with the site's description under it", (await card.locator("[data-card-description]").innerText()).trim() === doc.head.description.trim(), await card.locator("[data-card-description]").innerText().catch(() => "none"));
await side.getByLabel("Description", { exact: true }).fill("Live from the yellow dimension.");
await wait(300);
check("2 typing the description shows on the card as typed", (await card.locator("[data-card-description]").innerText()).trim() === "Live from the yellow dimension.", await card.locator("[data-card-description]").innerText().catch(() => "none"));
const dGuide = side.locator('[data-char-guide="description"]');
check("2 the description has a character guide", /31 \/ 160/.test(await dGuide.innerText()) && /short/i.test(await dGuide.innerText()), (await dGuide.innerText()).replace(/\s+/g, " "));
await side.getByLabel("Site name", { exact: true }).fill("Trump & Morty, live from the yellow dimension, a Solana coin with a TV show");
await wait(300);
const nGuide = side.locator('[data-char-guide="name"]');
check("2 a name past 60 characters is said to be cut, and by how much", (await nGuide.getAttribute("data-over")) === "" && /over/.test(await nGuide.innerText()), (await nGuide.innerText()).replace(/\s+/g, " "));
await page.screenshot({ path: `${SHOTS}/after-pages-card.png` });
await page.keyboard.press("Control+z");

/* 3 Look */
await tab("Look");
const readable = side.locator("[data-words-readable]");
check("3 Look says how many are hard to read", new RegExp(`${hard.length} (is|are) hard to read`).test(await readable.innerText()), (await readable.innerText()).replace(/\s+/g, " ").slice(0, 160));
const d0 = await page.evaluate(() => window.__studioUndoDepth());
await readable.locator("[data-make-readable]").click();
await wait(500);
const after = await stored();
check("3 one press makes them readable, in the site's own colours", fixes.every((f) => after.nodes.find((n) => n.id === f.id)?.colour?.text === f.to));
check("3 …as one undo step", (await page.evaluate(() => window.__studioUndoDepth())) === d0 + 1);
check("3 …and none is hard to read now", !/hard to read/.test(await readable.innerText()), (await readable.innerText()).replace(/\s+/g, " ").slice(0, 160));
await page.screenshot({ path: `${SHOTS}/after-make-readable.png` });
await readable.locator("[data-made-readable] button").click();
await wait(500);
const back = await stored();
check("3 Undo puts every one back", fixes.every((f) => back.nodes.find((n) => n.id === f.id)?.colour?.text === f.from));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
