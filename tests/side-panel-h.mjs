#!/usr/bin/env node
/**
 * THE SIDE PANEL'S FOLLOW-UPS, APPROVED BY THE OWNER, ON TRUMP & MORTY.
 *
 *   1  PICTURES IS ONE PLACE, ON A TAB OF ITS OWN. The drawing tool went into
 *      each part's "Make a picture", at the foot of Element, where with
 *      nothing picked it could not be found; his words: "give the ai image
 *      generator its own section/display panel option". It is the Pictures
 *      tab now, there with nothing picked, a picture's "Draw one" opens it,
 *      it draws for the part that is picked, and what it draws is put on that
 *      part in one press. There is still one drawing tool, not two.
 *   2  PAGES SHOWS THE SHARED LINK. Under the site's name and description,
 *      the card a pasted link draws (picture, address, title, the line under
 *      it), from exactly what those boxes say, and a character guide on both.
 *   4  FONTS IN PAGE ORDER. "Fonts on this site" lists the faces as a person
 *      meets them scrolling the site: by where each is first used, the first
 *      page first, top to bottom; each keeps its count and says where it
 *      first appears. The Format swap and the part panel's face list follow
 *      the same order.
 *
 * Nothing leaves the machine: the picture model is answered here.
 *
 *   npx next start -p 3013
 *   node tests/side-panel-h.mjs http://127.0.0.1:3013 capture/versions/sink-0ee06fa/sites/trumpmorty-fun
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const SINK = process.argv[3] ?? process.env.SINK ?? join(here, "..", "capture", "versions", "sink-0ee06fa", "sites", "trumpmorty-fun");
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
  /* The Element tab leads with a flat list now; this checks the tree, which "Show nesting" brings back. */
  localStorage.setItem("builder.elementsNesting", "1");
}, doc);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const wait = (ms) => page.waitForTimeout(ms);
const side = page.locator("[data-side-panel]");
const tab = async (name) => { await side.getByRole("radio", { name }).first().click({ force: true }); await wait(600); };
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state);

/* 1 Generate */
const names = await side.locator("[role=radio]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? e.textContent.trim()));
check("1 there is a Pictures tab, and no Generate tab", names.length === 6 && names.includes("Pictures") && !names.includes("Generate"), names.join(", "));
await tab("Pictures");
check("1 with nothing picked, the Pictures tab has the drawing tool", (await side.locator("[data-pictures-panel] [data-render-panel]").count()) === 1 && (await side.locator("[data-render-put]").count()) === 0);
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
{ const more = panel.locator('[data-part-section="more"]:not([data-open]) > [data-section-head]'); if (await more.count()) { await more.first().click(); await new Promise((r) => setTimeout(r, 300)); } } /* Name, prompt, saving and Make a picture sit under More. */
check("1 …with Make a picture closed", (await panel.locator('[data-part-section="make-picture"]').getAttribute("data-open")) === null);
await panel.locator("[data-draw-one]").click();
await wait(600);
const forPart = await side.locator("[data-pictures-for]").getAttribute("data-pictures-for").catch(() => null);
check("1 the picture's “Draw one” opens the Pictures tab, drawing for that part", (await side.locator("[data-pictures-panel] [data-render-panel]").count()) === 1 && forPart === PIC, `for ${forPart}`);
check("1 …and there is one drawing tool, not two", (await side.locator("[data-render-panel]").count()) === 1 && (await side.getByPlaceholder("what the picture should be").count()) === 0);
const tool = side.locator("[data-pictures-panel] [data-render-panel]");
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

/* 4 Fonts on this site, in page order */
/*
 * Worked out here from the capture itself, not from the panel's function:
 * each face's first part is the one highest on the first page it is used on
 * (runs set in another face count their part too), and the rows must come in
 * that order, each keeping its count of parts.
 */
const faceOfNode = (n) => (n.font?.face?.trim().replace(/['"]/g, "") || n.font?.family || "");
const hasWords = (n) => (typeof n.content === "string" ? n.content.trim().length > 0 : Array.isArray(n.content) && n.content.length > 0);
const pageRank = new Map(doc.pages.map((p, i) => [p.id, i]));
const firstOf = new Map();
const countOf = new Map();
for (const n of doc.nodes) {
  if (!hasWords(n) && !n.font) continue;
  const faces = new Set([faceOfNode(n), ...(Array.isArray(n.content) ? n.content.filter((r) => r?.face).map((r) => r.face.replace(/['"]/g, "")) : [])]);
  for (const f of faces) {
    countOf.set(f, (countOf.get(f) ?? 0) + 1);
    const at = [pageRank.get(n.pageId) ?? 99, n.y, n.x];
    const was = firstOf.get(f);
    if (!was || at[0] < was[0] || (at[0] === was[0] && (at[1] < was[1] || (at[1] === was[1] && at[2] < was[2])))) firstOf.set(f, at);
  }
}
const expected = [...firstOf.entries()].sort((a, b) => a[1][0] - b[1][0] || a[1][1] - b[1][1] || a[1][2] - b[1][2]).map(([f]) => f || "site");
/* A brought-in board edits its fonts from the preview (J, 2026-10-09): its Look tab carries no "Fonts on this site" list (`{captured ? null : <SiteFontsSection />}`).
   So the list is checked where it still shows, for a board that is not a capture, by the function that orders it. */
await tab("Look");
check("4 a brought-in board's Look tab has no Fonts list (its fonts are edited from the preview)", (await side.locator("[data-site-fonts]").count()) === 0);
const { fontsInPageOrder } = await src("look/siteColours.ts");
const ordered = fontsInPageOrder(doc.nodes, doc.pages.map((p) => p.id));
const shown = ordered.map((f) => f.key || "site");
check("4 Fonts on this site run top of the site to the bottom, by where each is first used", JSON.stringify(shown) === JSON.stringify(expected), `${shown.join(" > ")} (expected ${expected.join(" > ")}; by count it would be ${[...countOf.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f || "site").join(" > ")})`);
check("4 …each row keeps how many parts use it", ordered.every((f) => f.parts === countOf.get(f.key)), ordered.map((f) => `${f.key || "site"} ${f.parts}`).join(", "));
check("4 …and says where it first appears", ordered.every((f) => !!f.first) && new Set(ordered.map((f) => JSON.stringify(f.first))).size === ordered.length);
await page.screenshot({ path: `${SHOTS}/after-fonts-order.png` });

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
