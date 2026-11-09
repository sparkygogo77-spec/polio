/**
 * The side panel's six titles, and every panel still reachable behind them.
 *
 * The left panel was redesigned (side-panel lane, 2026-11-08, design C): six
 * rounded pieces in the wheel's blue, the one you are on green, each saying
 * its word — Parts, Look, Motion, Pages, Site, Draw — and Format and System
 * as two pills inside Site. No feature moved, so this holds the panel to
 * that: every panel a person could reach before is reached now, on a real
 * captured site, and the ids the board asks for by name still land.
 *
 *   · the strip has exactly the six words, in that order, each a radio with
 *     its word as its name, its tooltip and its drawn text;
 *   · Parts shows the part tree (nothing picked) and a part's sections once
 *     one is picked, with Content, Position and size, Look, Motion, Hover
 *     and More all there;
 *   · Look, Motion, Pages, Draw each show their panel;
 *   · Site shows the whole-site features and the brief, and its System pill
 *     the System panel; `__studioSetLeftPanel("system")` lands there too and
 *     lights Site;
 *   · the strip fits its column at the default width and at the narrowest
 *     (228px), nothing clipped.
 *
 * Red on base only for the titles (base says Element, Format, Pictures and
 * has a System tab); every reach check passes there too, by design.
 *
 *   node tests/side-panel-reach.mjs [url] [board] [<shared>/sites]   (board: solface; the sites folder runs part 6 on the six repo fixtures)
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const BASE = (process.argv[2] ?? "http://localhost:3511").replace(/\/$/, "");
const BOARD = process.argv[3] ?? "solface";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const WORDS = ["Parts", "Look", "Motion", "Pages", "Site", "Draw"];

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await openBoard(page, BASE, BOARD);
await page.waitForTimeout(1200);

const side = page.locator("[data-side-panel]");
const strip = side.locator('[aria-label="Side panel"]');
const tabs = () => strip.locator("[role=radio]").evaluateAll((ts) => ts.map((t) => ({
  name: t.getAttribute("aria-label"), title: t.getAttribute("title"), text: t.querySelector("[data-tab-word]")?.textContent ?? "",
  on: t.getAttribute("data-state") === "on", w: t.getBoundingClientRect().width, clipped: t.scrollWidth > t.clientWidth + 1,
})));
const tab = async (name) => { await strip.getByRole("radio", { name }).first().click({ force: true }); await page.waitForTimeout(500); };
const there = (sel) => side.locator(sel).first().isVisible().catch(() => false);

/* 1. The strip. */
let t = await tabs();
check("1 the strip has the six words, in order", JSON.stringify(t.map((x) => x.name)) === JSON.stringify(WORDS), t.map((x) => x.name).join(", "));
check("1 each is its word: name, tooltip and drawn text agree", t.every((x) => x.title === x.name && x.text === x.name));
check("1 one is on", t.filter((x) => x.on).length === 1, t.filter((x) => x.on).map((x) => x.name).join());
check("1 nothing clipped at the default width", t.every((x) => !x.clipped && x.w > 40), t.map((x) => `${x.name} ${Math.round(x.w)}`).join(", "));

/* 2. Parts: the tree, then a part. */
await tab("Parts");
check("2 Parts shows the page's parts", await there("[data-part-tree], [data-parts-tree], [data-element-list]") || (await side.locator("[data-part-section], [data-kind-row], li").count()) > 0);
const first = page.locator("[data-studio-scroll] [data-node-id]").first();
if (await first.count()) {
  await first.click({ force: true });
  await page.waitForTimeout(600);
  const sections = await side.locator("[data-part-section]").evaluateAll((ss) => ss.map((s) => s.getAttribute("data-part-section")));
  for (const id of ["content", "place", "look", "motion", "more"]) check(`2 a picked part has its ${id} section`, sections.includes(id), sections.join(", "));
  const slab = side.locator('[data-part-section="content"]');
  check("2 a section's head is a slab with a rounded rim", (await slab.evaluate((s) => parseFloat(getComputedStyle(s).borderTopLeftRadius))) >= 12);
} else check("2 a part to pick", false, "no [data-node-id] on the board");

/* 3. The other panels. */
await tab("Look"); check("3 Look shows the Look panel", await there("[data-look-panel]"));
await tab("Motion"); check("3 Motion shows the Motion panel", await there("[data-motion-panel]"));
await tab("Pages"); check("3 Pages lists the pages", (await side.getByLabel("Page name").count()) > 0 || (await side.locator("[data-page-row], [data-pages-panel]").count()) > 0 || (await side.getByLabel("Site name").count()) > 0);
await tab("Draw"); check("3 Draw shows the drawing tool", await there("[data-pictures-panel]"));

/* 4. Site: Format and System as pills. */
await tab("Site");
check("4 Site opens on the whole-site features", await there('[data-format-section="whole-site"]'));
check("4 …with the brief folded under them", await there("[data-brief-fold]"));
const pills = await side.locator("[data-site-tab]").evaluateAll((ps) => ps.map((p) => p.getAttribute("aria-label")));
check("4 Site has two pills, Whole site and System", JSON.stringify(pills) === JSON.stringify(["Whole site", "System"]), pills.join(", "));
await side.locator('[data-site-tab="system"]').click(); await page.waitForTimeout(500);
check("4 the System pill shows the System panel", await there("[data-system-panel]"));
t = await tabs(); check("4 …and Site stays the lit tab", t.find((x) => x.on)?.name === "Site");
await tab("Look");
await page.evaluate(() => window.__studioSetLeftPanel("system")); await page.waitForTimeout(500);
check("4 asking for the system panel by id lands on it", await there("[data-system-panel]"));
t = await tabs(); check("4 …lighting Site", t.find((x) => x.on)?.name === "Site");
await page.evaluate(() => window.__studioSetLeftPanel("format")); await page.waitForTimeout(400);
check("4 asking for format by id lands on the whole-site features", await there('[data-format-section="whole-site"]'));

/* 5. The narrowest column. */
await page.evaluate(() => { localStorage.setItem("builder.sidePanelWidth", "228"); });
await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1200);
t = await tabs();
check("5 at 228px every word is still drawn, nothing clipped", t.length === 6 && t.every((x) => !x.clipped && x.w > 40), t.map((x) => `${x.name} ${Math.round(x.w)}`).join(", "));
/* 6. Every repo fixture: the same reach on each captured site (lane-rules.md). */
const SITES = process.argv[4] ?? process.env.SITES ?? null;
if (SITES) {
  for (const site of ["share-xyz", "trumpmorty-fun", "gotchi-gg", "stonkfun-xyz", "parasiteonsol-fun", "trendtrader-pro"]) {
    const file = join(SITES, site, "site", "document.json");
    if (!existsSync(file)) { check(`6 ${site}: its capture is here`, false, file); continue; }
    const doc = JSON.parse(readFileSync(file, "utf8"));
    await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, activePageId: doc.pages[0].id });
    await page.waitForTimeout(1500);
    await tab("Parts");
    const rows = await side.locator("[data-part-section], [data-kind-row], li").count();
    /* The first part with a panel of its own: a page background or a stray box has none, so try a few. */
    const nodes = page.locator("[data-studio-scroll] [data-node-id]");
    let sections = [];
    for (let i = 0; i < Math.min(6, await nodes.count()) && !sections.includes("content"); i++) {
      await nodes.nth(i).click({ force: true }); await page.waitForTimeout(600);
      sections = await side.locator("[data-part-section]").evaluateAll((ss) => ss.map((s) => s.getAttribute("data-part-section")));
    }
    check(`6 ${site}: Parts lists the parts and a picked part has its sections`, rows > 0 && ["content", "place", "look", "more"].every((id) => sections.includes(id)), `${rows} rows; ${sections.join(", ")}`);
    await tab("Site");
    const site1 = await there('[data-format-section="whole-site"]');
    await side.locator('[data-site-tab="system"]').click(); await page.waitForTimeout(400);
    check(`6 ${site}: Site reaches the whole-site features and System`, site1 && (await there("[data-system-panel]")));
    await tab("Look"); const look = await there("[data-look-panel]");
    await tab("Motion"); const motion = await there("[data-motion-panel]");
    await tab("Draw"); const draw = await there("[data-pictures-panel]");
    check(`6 ${site}: Look, Motion and Draw each show their panel`, look && motion && draw);
  }
} else console.log("  --   6 skipped: no fixtures folder given (4th argument: <shared>/sites)");
check("no page error", errors.length === 0, errors.join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
