#!/usr/bin/env node
/**
 * THE SIDE PANEL, REDESIGNED, ON TRUMP & MORTY.
 *
 * THE OWNER'S ASK: the Format panel was too convoluted to use; the parts
 * should be grouped in the order they come on the page, and clicking one
 * should open a panel of its own; the panel overall should look better.
 * Checked on sink's own capture of trumpmorty.fun:
 *
 *   1  FORMAT is a short page: "This site" (heading and body fonts, base
 *      size, corners, page colour, accent), each read correctly off the
 *      parts, once, with a Change; "Whole-site features", the switches with
 *      their state; and everything a generator reads folded under one
 *      closed "Brief for a new build". No BRIEF tags, no second value.
 *   2  PARTS IN PAGE ORDER: with nothing picked the Element tab is a tree,
 *      top to bottom, sections then what is inside, folding, with readable
 *      names and kind icons. Hovering a row outlines the part on the board;
 *      pressing it picks it, brings it into view and opens its panel; a part
 *      picked on the board is lit in the tree.
 *   3  A PART'S OWN PANEL: a breadcrumb with a way back, the name and kind,
 *      then Content, Position and size, Look, Motion, then the prompt and
 *      Make a picture folded. A link's words are its label's, editable
 *      there, and so is where it leads. Sections fold and remember it. The
 *      prompt line says the name once; no jargon line under it.
 *   4  LOOKS: the panel starts about 300px wide and every tab says its
 *      name; the Motion tab lists each kind as one compact row with its
 *      icon, count and one switch, and Frame interpolation is its own folded
 *      section at the foot.
 *   5  DECISIONS (added mid-lane): the summary's counts that name parts open
 *      the list of exactly those parts, each with what the decision is and
 *      the fix inline (where it leads, or nowhere on purpose); a row, or the
 *      orange ! on the board, opens the part's own panel.
 *
 *   npx next start -p 3013
 *   node tests/side-panel-g.mjs http://127.0.0.1:3013 capture/versions/sink-0ee06fa/sites/trumpmorty-fun
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

/* ------------------------------------------------------------ the pure half */
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const src = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const { readSiteFormat, pageColourOf } = await src("siteFormat.ts");
const { partTree, visibleRows, ancestors } = await src("partTree.ts");
const { capturedFrom, kindOf } = await src("partNames.ts");
const { decisions, decisionSays, answered } = await src("library/badge.ts");

const reads = readSiteFormat(doc, doc.look?.palette?.bg);
/* Read by `paintedPalette` (shelfTheme.ts), the function the shelf's previews use too, so the two agree. */
const { paintedPalette } = await src("shelfTheme.ts");
const { parseColor } = await src("look.ts");
const behind = pageColourOf(doc.nodes, doc.look?.palette?.bg);
const bgC = parseColor(behind?.colour ?? "");
check("1 the page's colour is what covers the page (yellow), not the navy under it", !!bgC && bgC.l > 0.8 && bgC.h > 80 && bgC.h < 110, JSON.stringify(behind));
const shelf = paintedPalette(doc.nodes.filter((n) => n.pageId === "page_home"), {}, doc.look?.palette?.bg);
check("1 …the same page colour and accent the shelf's previews are drawn in", behind?.colour === shelf?.bg && reads["palette.accentHue"]?.colour === shelf?.accent, `${behind?.colour} ${reads["palette.accentHue"]?.colour} / ${shelf?.bg} ${shelf?.accent}`);
check("1 …so the site reads as light", reads["palette.mode"]?.value === "light", JSON.stringify(reads["palette.mode"]));
check("1 base size is the site's base, never '1px' (a part's size is a multiple of it)", reads["type.baseSize"]?.shows === "16px", reads["type.baseSize"]?.shows);
check("1 heading font is the face on the biggest words", reads["type.headingFamily"]?.shows === "Luckiest Guy", reads["type.headingFamily"]?.shows);
check("1 body font is the face that sets most of the words", reads["type.bodyFamily"]?.shows === "Fredoka", reads["type.bodyFamily"]?.shows);

const home = doc.nodes.filter((n) => n.pageId === "page_home");
const tree = partTree(home);
const byId = new Map(home.map((n) => [n.id, n]));
const main = tree.roots.find((id) => kindOf(byId.get(id)) === "Page body");
const sections = (tree.kids.get(main) ?? []).filter((id) => kindOf(byId.get(id)) === "Section");
check("2 the page body's sections are in page order, top to bottom", sections.every((id, i) => i === 0 || byId.get(sections[i - 1]).y <= byId.get(id).y), sections.map((id) => byId.get(id).y).join(" "));
check("2 …so THE LORE is second, not last", sections[1] === "n_box_14", sections.join(" "));
const allRows = visibleRows(tree, new Set(home.map((n) => n.id)));
check("2 every part is in the tree exactly once", allRows.length === home.length && new Set(allRows.map((r) => r.id)).size === home.length, `${allRows.length} rows, ${home.length} parts`);
check("2 the link's label sits under the link", ancestors(tree, "n_prose_184").at(-1) === "n_box_181", ancestors(tree, "n_prose_184").join(" > "));
const says = capturedFrom(byId.get("n_box_181"), home)?.says ?? "";
check("3 the prompt line names the link once, not “Link “…””", !/““|””|“[^”]*“/.test(says) && says.includes("BUY ON PUMP.FUN"), says);
check("5 the decision is said in plain words", decisionSays("nowhere", "Button") === "a button that goes nowhere yet: choose where it leads");
check("5 'goes nowhere on purpose' answers the !", answered({ id: "x", nowhere: true }) && !answered({ id: "x" }));

/* ------------------------------------------------------------ the browser half */
const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/tweets/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate((state) => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "b1", name: "Trump & Morty", updatedAt: Date.now() }], activeId: "b1" }));
  localStorage.setItem("builder.studio", env({ ...state, activePageId: "page_home" }));
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

/* 4 width and tabs */
const width = Math.round((await side.boundingBox()).width);
check("4 the panel starts about 300px wide", Math.abs(width - 300) <= 2, `${width}px`);
const tabWords = async () => side.locator("[data-tab-word]").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, cut: e.scrollWidth > e.clientWidth + 1, sr: e.classList.contains("sr-only") }; }));
let words = await tabWords();
check("4 every tab says its name at 300px, none cut", words.length === 5 && words.every((w) => w.w > 10 && !w.sr && !w.cut), JSON.stringify(words));

/* 1 Format */
await tab("Format");
const fmt = side.locator("[data-format-panel]");
const order = await fmt.locator("[data-format-section]").evaluateAll((els) => els.map((e) => e.getAttribute("data-format-section")));
check("1 Format reads: This site, Whole-site features, Brief for a new build", order.join(",") === "site,whole-site,brief", order.join(","));
const text = await fmt.innerText();
check("1 no BRIEF tags", !/\bBRIEF\b(?! FOR)/.test(text) && (await fmt.locator("[data-brief-only]").count()) === 0);
check("1 the brief is one closed section", (await fmt.locator('[data-format-section="brief"][data-open]').count()) === 0 && (await fmt.locator("[data-format-field]").count()) === 0);
const row = async (id) => (await fmt.locator(`[data-site-row="${id}"] [data-site-reads]`).innerText()).trim();
check("1 This site: heading font Luckiest Guy", (await row("type.headingFamily")) === "Luckiest Guy", await row("type.headingFamily"));
check("1 This site: body font Fredoka", (await row("type.bodyFamily")) === "Fredoka", await row("type.bodyFamily"));
check("1 This site: base size 16px", (await row("type.baseSize")) === "16px", await row("type.baseSize"));
check("1 This site: one corner radius value", /^\d+px$/.test(await row("layout.radius")) && !(await fmt.locator('[data-site-row="layout.radius"]').innerText()).includes("Use the site"), await fmt.locator('[data-site-row="layout.radius"]').innerText());
check("1 This site: the page colour is light yellow", (await row("page-colour")) === "light yellow", await row("page-colour"));
check("1 This site: an accent colour", (await row("accent")).length > 2, await row("accent"));
check("1 every row has a Change", (await fmt.locator('[data-format-section="site"] [data-site-change]').count()) === 6);
await fmt.locator('[data-site-row="type.headingFamily"] [data-site-change]').click();
await wait(300);
check("1 Change on a font opens the swap in place", (await fmt.locator('[data-site-row="type.headingFamily"]').getByLabel("New face").count()) === 1);
const sw = fmt.locator("[data-format-switch]");
const switches = await sw.evaluateAll((els) => els.map((e) => e.getAttribute("data-format-switch")));
check("1 Whole-site features are the switches, each with its state", ["build.darkLight", "build.print", "build.cookieConsent", "build.errorScreens", "build.offline"].every((k) => switches.includes(k)) && (await sw.first().innerText()).match(/On|Off/) !== null, switches.join(" "));
await fmt.locator('[data-format-switch="build.print"] [role=switch]').click();
await wait(300);
check("…and a switch writes the site's format", (await stored()).format["build.print"] === true && (await fmt.locator('[data-format-switch="build.print"]').innerText()).includes("On"));
await fmt.locator('[data-format-switch="build.print"] [role=switch]').click();
await page.screenshot({ path: `${SHOTS}/after-format.png` });
await fmt.locator("[data-brief-fold]").click();
await wait(300);
const briefIds = await fmt.locator("[data-format-field]").evaluateAll((els) => els.map((e) => e.getAttribute("data-format-field")));
check("1 opened, the brief holds the generator's options and none of This site's", briefIds.includes("concept.kind") && briefIds.includes("build.data") && !briefIds.some((id) => ["type.headingFamily", "type.baseSize", "layout.radius", "palette.mode", "build.print"].includes(id)), `${briefIds.length} options`);
await page.screenshot({ path: `${SHOTS}/after-format-brief.png` });

/* 2 the tree */
await tab("Element");
const treeRows = side.locator("[data-parts-tree] [data-tree-row]");
const topIds = await treeRows.evaluateAll((els) => els.map((e) => ({ id: e.getAttribute("data-tree-row"), d: Number(e.getAttribute("data-tree-depth")) })));
const shownSections = topIds.filter((r) => r.d === 1).map((r) => r.id).filter((id) => sections.includes(id));
check("2 the tree opens on the page body with its sections in page order", JSON.stringify(shownSections) === JSON.stringify(sections), shownSections.join(" "));
check("2 rows carry readable names and a kind icon", (await side.locator('[data-tree-row="n_box_14"] [data-tree-name]').innerText()) === "Section “THE LORE”" && (await side.locator('[data-tree-row="n_box_14"] svg').count()) >= 2);
await side.locator('[data-tree-row="n_box_14"] [data-tree-toggle]').click();
await wait(300);
const opened = await treeRows.count();
check("2 a section opens to what is inside it", opened > topIds.length, `${topIds.length} → ${opened}`);
await side.locator('[data-tree-row="n_box_14"] [data-tree-toggle]').click();
await wait(300);
check("2 …and folds again", (await treeRows.count()) === topIds.length);
await side.locator('[data-tree-row="n_box_4"] [data-element-row]').hover();
await wait(300);
check("2 hovering a row outlines that part on the board", (await page.locator('[data-point-mark="n_box_4"]').count()) === 1);
await side.locator('[data-tree-row="n_box_4"] [data-element-row]').click();
await wait(1200);
check("2 pressing it picks it and opens its panel", (await side.locator('[data-part-panel="n_box_4"]').count()) === 1 && JSON.stringify((await stored()).selection ?? null) !== "x");
const inView = await page.evaluate(() => { const r = document.querySelector('[data-studio-scroll] [data-node-id="n_box_4"]')?.getBoundingClientRect(); return !!r && r.top < innerHeight && r.bottom > 0; });
check("2 …and brings it into view on the board", inView);
await page.screenshot({ path: `${SHOTS}/after-picked-from-tree.png` });

/* 3 the part's own panel, picked on the board */
await page.locator('[data-studio-scroll]').evaluate((e) => e.scrollTo({ top: 0 }));
await wait(400);
await page.locator('[data-node-id="n_box_181"]').first().click({ position: { x: 20, y: 10 }, force: true });
await wait(900);
const panel = side.locator('[data-part-panel="n_box_181"]');
check("3 a link picked on the board opens its own panel", (await panel.count()) === 1);
const crumbs = (await panel.locator("[data-crumbs]").innerText()).replace(/\s+/g, " ");
check("3 a breadcrumb from the page to the link", /^Home\b.*Section.*Link$/.test(crumbs), crumbs);
check("3 the name and kind", (await panel.locator("[data-element-name]").innerText()) === "Link “BUY ON PUMP.FUN”" && (await panel.locator("[data-element-kind]").innerText()) === "Link");
const secs = await panel.locator("[data-part-section]").evaluateAll((els) => els.map((e) => e.getAttribute("data-part-section")));
check("3 sections: Content, Position and size, Look, Motion, Effects, Save as a component, Prompt, Make a picture", secs.join(",") === "content,place,look,motion,effects,save-component,prompt,make-picture", secs.join(","));
check("3 …the prompt and Make a picture folded", (await panel.locator('[data-part-section="prompt"][data-open]').count()) === 0 && (await panel.locator('[data-part-section="make-picture"][data-open]').count()) === 0);
const wordsBox = panel.getByLabel("Words");
check("3 the link's words are there to edit, from the label inside it", (await wordsBox.inputValue()) === "BUY ON PUMP.FUN", await wordsBox.inputValue());
check("3 …and where it leads", (await panel.locator("[data-link-field]").count()) === 1 && (await panel.getByLabel("Web address").inputValue()).startsWith("https://pump.fun/"));
check("3 no chip saying 'links to a url'", !(await panel.innerText()).includes("links to a url"));
await wordsBox.fill("BUY ON PUMP.FUN NOW");
await wait(300);
check("…editing them writes the label's own words", (await stored()).nodes.find((n) => n.id === "n_prose_184").content === "BUY ON PUMP.FUN NOW");
await page.keyboard.press("Control+z");
const num = async (l) => Number(await panel.getByLabel(l, { exact: true }).inputValue());
check("3 position and size as numbers", (await num("X")) === 100 && (await num("Y")) === 559 && (await num("Width")) === 372 && (await num("Height")) === 85, `${await num("X")},${await num("Y")},${await num("Width")},${await num("Height")}`);
check("3 Look has the part's colour, font, border and shadow", (await panel.locator('[data-part-section="look"] [data-part-font], [data-part-section="look"] [data-part-border], [data-part-section="look"] [data-part-shadow]').count()) >= 2);
check("3 no jargon line", !(await panel.innerText()).includes("Row order comes"));
await panel.locator('[data-part-section="prompt"] [data-section-head]').click();
await wait(300);
const from = await panel.locator("[data-captured-from]").innerText();
check("3 the prompt line says the link's name once", !/““|””/.test(from) && from.includes("“BUY ON PUMP.FUN”"), from);
await page.screenshot({ path: `${SHOTS}/after-element-link.png` });
await panel.locator('[data-part-section="look"] [data-section-head]').click();
await wait(200);
await page.reload({ waitUntil: "networkidle" });
await wait(2000);
await page.locator('[data-node-id="n_box_181"]').first().click({ position: { x: 20, y: 10 }, force: true });
await wait(900);
check("3 a folded section stays folded on the next part and after a reload", (await side.locator('[data-part-section="look"][data-open]').count()) === 0 && (await side.locator('[data-part-section="prompt"][data-open]').count()) === 1);
await side.locator('[data-part-section="look"] [data-section-head]').click();
await side.locator("[data-back-to-tree]").click();
await wait(700);
check("2 back to the tree, the part picked on the board is lit there", (await side.locator('[data-tree-row="n_box_181"][data-tree-picked]').count()) === 1);
await page.screenshot({ path: `${SHOTS}/after-element-tree-lit.png` });
await page.keyboard.press("Escape");
await page.keyboard.press("Escape");
await page.keyboard.press("Escape");
await wait(500);

/* 5 decisions */
if (!(await side.locator("[data-page-summary]").count())) { await page.locator("[data-frame]").first().click({ position: { x: 5, y: 5 }, force: true }); await wait(300); await page.keyboard.press("Escape"); await wait(400); }
const badges = async () => page.locator("[data-decide-for]").evaluateAll((els) => els.map((e) => e.getAttribute("data-decide-for")));
const onBoard = await badges();
const openStat = side.locator('[data-summary="open"]');
check("5 the count of parts needing a decision matches the !s on the board", Number((await openStat.innerText()).match(/\d+/)?.[0]) === onBoard.length, `${await openStat.innerText()} / ${onBoard.length} on the board`);
await openStat.click();
await wait(400);
const list = side.locator('[data-parts-behind="decide"]');
const listed = await list.locator("[data-behind-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-behind-row")));
check("5 pressing it lists exactly those parts, right there", listed.length === onBoard.length && listed.every((id) => onBoard.includes(id)), `${listed.length} listed`);
const firstSays = await list.locator("[data-behind-says]").first().innerText();
check("5 each says what the decision is", /goes nowhere yet: choose where it leads$/.test(firstSays), firstSays);
check("5 each has a readable name", !(await list.locator("[data-behind-name]").allInnerTexts()).some((t) => /inside|n_box|::/.test(t)));
await page.screenshot({ path: `${SHOTS}/after-decisions.png` });
const [a, b] = listed;
const pickOption = async (rowId, label) => {
  const sel = list.locator(`[data-behind-row="${rowId}"] [data-leads-to]`).getByLabel("Where it leads");
  const tag = await sel.evaluate((e) => e.tagName);
  if (tag === "SELECT") { const v = await sel.evaluate((e, l) => [...e.options].find((o) => o.textContent.startsWith(l))?.value, label); await sel.selectOption(v); }
  else { await sel.click(); await page.getByRole("option").filter({ hasText: label }).first().click(); }
  await wait(400);
};
await pickOption(a, "Nowhere, on purpose");
check("5 'nowhere, on purpose' answers it: its ! goes and it leaves the list", !(await badges()).includes(a) && (await stored()).nodes.find((n) => n.id === a)?.nowhere === true && (await list.locator(`[data-behind-row="${a}"]`).count()) === 0);
await pickOption(b, "Section:");
const bLink = (await stored()).nodes.find((n) => n.id === b)?.link;
check("5 choosing a section makes it lead there", bLink?.kind === "node" && !(await badges()).includes(b), JSON.stringify(bLink));
const c = listed[2];
await list.locator(`[data-behind-row="${c}"] [data-behind-go]`).click();
await wait(900);
check("5 pressing a row opens that part's own panel, with the decision at the top", (await side.locator(`[data-part-panel="${c}"] [data-part-decision="nowhere"]`).count()) === 1);
await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
await wait(400);
const d = listed[3];
await page.locator(`[data-decide-for="${d}"]`).scrollIntoViewIfNeeded();
await page.locator(`[data-decide-for="${d}"]`).click();
await wait(900);
check("5 the orange ! on the board opens the same panel", (await side.locator(`[data-part-panel="${d}"] [data-part-decision]`).count()) === 1);
await page.screenshot({ path: `${SHOTS}/after-decide-badge.png` });
await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
await wait(500);
const linksStat = side.locator('[data-summary="links"]');
if (await linksStat.count()) {
  await linksStat.click();
  await wait(400);
  const n = await side.locator('[data-parts-behind="links"] [data-behind-row]').count();
  check("5 the links count lists the links, each saying where it leads", n === Number((await linksStat.innerText()).match(/\d+/)?.[0]) && /^(leads to|scrolls to)/.test(await side.locator('[data-parts-behind="links"] [data-behind-says]').first().innerText()), `${n}`);
}

/* 4 Motion */
await tab("Motion");
const kinds = side.locator("[data-move-fold=kind]");
const kindRows = await kinds.evaluateAll((els) => els.map((e) => ({ h: e.getBoundingClientRect().height, icons: e.querySelectorAll("[data-move-open] svg").length, controls: e.querySelectorAll("button[aria-pressed], [role=slider]").length })));
check("4 each kind of motion is one compact row: its icon, count and one switch", kindRows.length > 0 && kindRows.every((k) => k.h <= 34 && k.icons >= 2 && k.controls === 1), JSON.stringify(kindRows));
await kinds.first().locator("[data-move-open]").click();
await wait(300);
check("4 …opened, the all-at-once controls are still there", (await side.locator("[data-move-kind]").first().locator("[data-move-speed-all], [data-move-bunch], [data-move-row]").count()) > 0);
const crates = side.locator("[data-motion-crates]");
const lastIsCrates = await side.locator("[data-motion-panel]").evaluate((p) => { const kids = [...p.children].filter((e) => e.tagName !== "DIALOG"); return kids.at(-1)?.hasAttribute("data-motion-crates") || kids.at(-2)?.hasAttribute("data-motion-crates"); });
check("4 Frame interpolation is its own folded section at the foot", (await crates.count()) === 1 && !(await crates.evaluate((d) => d.open)) && lastIsCrates);
await page.screenshot({ path: `${SHOTS}/after-motion.png` });

/* 4 wider: one row of names */
await page.evaluate(() => localStorage.setItem("builder.sidePanelWidth", "600"));
await page.reload({ waitUntil: "networkidle" });
await wait(1500);
words = await tabWords();
const tops = await side.locator("[data-tab-word]").evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size);
check("4 wider, the names sit on one row", words.every((w) => w.w > 10 && !w.cut) && tops === 1, `${tops} rows`);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
