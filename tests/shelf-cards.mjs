/**
 * The shelf's category cards say what they offer and what each one does.
 *
 * HIS WALK-THROUGH of the twelve categories, one check per finding:
 *   1. an open category keeps every category's name on the row;
 *   2. the sub-group names are plain purpose words, and none repeats;
 *   3. an open category is grouped by purpose, footprint is a small tag;
 *   4. every card says Works now or Idea, needs building, and what it needs;
 *   5. a preview shows the thing on the site's own page, a motion moving;
 *   6. every card has a one-line "what it does", and previews use the site's
 *      words, never invented filler;
 *   7. a click opens a detail card and adds nothing; Add to page there adds
 *      it, picks it and outlines it;
 *   8. whole-site features are switches with their state;
 *   9. a card used on the page says so and jumps to those parts;
 *  10. the Motion category and the Motion tab point at each other.
 * The first half reads the catalogue and `shelfFacts.ts` as written; the
 * second walks the Builder with a site seeded, and photographs it.
 *
 *   node tests/shelf-cards.mjs http://localhost:3000
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { CATEGORIES, FEATURES, SUBGROUPS } from "../src/features/studio/catalog.ts";
import { FORMAT_FIELDS } from "../src/features/studio/format.ts";
import {
  PICTURE_ONLY, RUN_MOTIONS, NAMED_MOTIONS, doesOf, exampleContent, needsOf, siteWordsOf, statusOf, switchOf, switchStatus,
} from "../src/features/studio/shelfFacts.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------ the words */
const OLD = ["Page shape", "Switchers", "Junction", "Region", "Moments", "Arrangements", "Reach", "Running it", "Talking out", "Orbs", "Solids", "Keeping order"];
const labels = Object.values(SUBGROUPS).flat().map((g) => g.label);
const names = FEATURES.map((f) => f.name);
const vague = OLD.filter((w) => labels.includes(w) || names.includes(w));
check("2. no sub-group or part is called by the vague names he read out", vague.length === 0, vague.join(", ") || `${labels.length} sub-groups`);
const twice = labels.filter((l, i) => labels.indexOf(l) !== i);
check("2. and no sub-group name is used in two categories", twice.length === 0, twice.join(", "));

/* Every abbreviation spelled out on first use: in a part's words, or its category's name. */
const ABBR = /\b(?:[A-Z]{2,}|\d+D)\b/g;
const loose = [];
for (const f of FEATURES) {
  const cat = CATEGORIES.find((c) => c.id === f.category)?.label ?? "";
  for (const text of [f.name, f.blurb, f.explain ?? ""]) {
    for (const a of text.match(ABBR) ?? []) {
      if (!new RegExp(`\\(${a}\\)`).test(`${cat} ${text}`)) loose.push(`${f.id}: ${a}`);
    }
  }
}
for (const c of CATEGORIES) for (const a of `${c.label}`.match(ABBR) ?? []) if (!c.label.includes(`(${a})`)) loose.push(`category ${c.id}: ${a}`);
for (const l of labels) for (const a of l.match(ABBR) ?? []) loose.push(`sub-group ${l}: ${a}`);
check("no abbreviation a card shows is left unexplained", loose.length === 0, loose.slice(0, 8).join(", ") || "none");

/* ------------------------------------------------------------ the facts */
const noDoes = FEATURES.filter((f) => !/^.{8,}[.!?]$/.test(doesOf(f)));
check("6. every part has a one-line what it does", noDoes.length === 0, noDoes.map((f) => f.id).join(", ") || `${FEATURES.length} parts`);

const parts = readFileSync(new URL("../src/features/studio/parts/index.ts", import.meta.url), "utf8");
const tierC = [...parts.matchAll(/ids: \[([^\]]*)\], tier: "C"/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
const missC = tierC.filter((id) => !PICTURE_ONLY.has(id));
const extraC = [...PICTURE_ONLY].filter((id) => !tierC.includes(id));
check("4. the picture-only list is the registry's own stand-ins, no more and no fewer", missC.length === 0 && extraC.length === 0, `${tierC.length} stand-ins${missC.length ? `, missing ${missC}` : ""}${extraC.length ? `, extra ${extraC}` : ""}`);
const live = readFileSync(new URL("../src/features/studio/live/behaviours.ts", import.meta.url), "utf8");
const runs = [...live.slice(live.indexOf("export function deriveBehaviours")).matchAll(/case "([a-z-]+)": b\./g)].map((m) => m[1]);
check("4. the motions called Works now are the ones the live page runs", runs.length === RUN_MOTIONS.size && runs.every((id) => RUN_MOTIONS.has(id)), runs.join(", "));
const described = /DESCRIBE_ONLY = new Set\(\[([^\]]*)\]/.exec(live)?.[1] ?? "";
const namedOnly = [...described.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((id) => id !== "page-transitions");
check("4. and the ones it only names are ideas", namedOnly.every((id) => NAMED_MOTIONS.has(id) && statusOf({ id }) === "idea"), namedOnly.join(", "));

const paid = ["checkout", "subscription", "ai-chat", "ai-summarize", "auth", "email", "analytics"];
const unpaid = paid.filter((id) => !needsOf({ id }).includes("money"));
check("4. Stripe, accounts, emails, analytics and every model call say they cost money", unpaid.length === 0, unpaid.join(", ") || paid.join(", "));
check("4. and anything that needs something is an idea until it is built", FEATURES.filter((f) => needsOf(f).length && statusOf(f) !== "idea").length === 0);
check("4. a tab strip, a footer and a gallery work now and need nothing", ["tabs-panel", "footer", "gallery"].every((id) => statusOf({ id }) === "works" && needsOf({ id }).length === 0));

const WHOLE = ["scroll-snap", "smooth-scroll", "cursor-effects", "page-transitions", "dark-mode", "print", "i18n", "cookie-consent", "analytics", "testing", "error-handling", "pwa"];
const notSwitch = WHOLE.filter((id) => !switchOf(id));
check("8. the whole-site features he listed are switches", notSwitch.length === 0, notSwitch.join(", ") || `${WHOLE.length} switches`);
const keys = new Set(FORMAT_FIELDS.map((f) => f.id));
const noField = WHOLE.map((id) => switchOf(id)).filter((s) => s?.kind === "format" && !keys.has(s.key));
check("8. and every switch kept in Format has its field there, so the brief carries it", noField.length === 0, noField.map((s) => s.key).join(", "));
check("8. a switch the live page runs is Works now; one only the brief carries is an idea", switchStatus("scroll-snap") === "works" && switchStatus("page-transitions") === "works" && switchStatus("analytics") === "idea");

/* The site's own words, never filler. */
const FILLER = /\b(warm|summit|quick|canvas|signal|bright|orbit|ledger|harbour|meadow|lantern)\b/i;
const words = siteWordsOf("BLACKORB", [
  { featureId: "value-prop", content: "Power in the dark." },
  { featureId: "eyebrow-rule", content: "Built for the next block" },
  { featureId: "value-prop", content: "The thesis" },
  { featureId: "prose", content: "BLACKORB is a community-powered token built for the builders. More follows." },
  { featureId: "cta-primary", content: "Buy $BORB" },
], ["Home", "Lab"]);
check("6. the site's words are read off its parts", words.headings.includes("Power in the dark.") && words.lines[0]?.startsWith("BLACKORB is") && words.buttons[0] === "Buy $BORB" && words.pages[0] === "Lab",
  JSON.stringify(words).slice(0, 160));
const drawn = FEATURES.map((f) => [f.id, exampleContent(f, words)]).filter(([, c]) => c);
const filler = drawn.filter(([, c]) => FILLER.test(c));
check("6. previews are given the site's words, never invented filler", drawn.length > 40 && filler.length === 0, `${drawn.length} parts given words${filler.length ? `, filler in ${filler.map(([id]) => id)}` : ""}`);
const hero = exampleContent(FEATURES.find((f) => f.id === "hero-split"), words) ?? "";
check("6. a banner's headline is the site's own", hero.startsWith("Power in the dark"), hero);
const empty = siteWordsOf("", [], []);
const noWords = FEATURES.map((f) => exampleContent(f, empty) ?? "").filter((c) => /^(optional|type |one )/i.test(c));
check("6. with no words of its own a site gets examples, never instructions", noWords.length === 0, noWords.slice(0, 3).join(" | "));

/* ------------------------------------------------------------ in the Builder */
const URL_ = process.argv[2];
if (!URL_) {
  console.log("\n(no url: the Builder half is skipped)");
} else {
  const req = createRequire(import.meta.url);
  const { chromium } = (() => {
    for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
      try { return req(c); } catch { /* next */ }
    }
    throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
  })();
  mkdirSync(".screenshots/lane-e", { recursive: true });
  const shot = (page, n) => page.screenshot({ path: `.screenshots/lane-e/shelf-cards-${n}.png` });

  const doc = JSON.parse(readFileSync(new URL("../site/document.json", import.meta.url), "utf8"));
  /* Reveal on scroll carried by some of its parts, the way a captured site carries it. */
  doc.nodes = doc.nodes.map((n) => (["value-prop", "prose"].includes(n.featureId) ? { ...n, work: { id: "reveal", inputs: {} } } : n));
  const revealed = doc.nodes.filter((n) => n.work && n.pageId === doc.activePageId).map((n) => n.id).sort();
  const seeded = JSON.stringify({ state: { ...doc, trail: [] }, version: 0 });

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, seeded);
  const page = await context.newPage();
  await page.route("**/api/studio/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-category]", { timeout: 30000 });
  await page.waitForTimeout(2500);
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
  const open = async (id) => {
    if (await page.locator(`[data-category-open="${id}"]`).count()) return;
    await page.locator(`[data-category="${id}"]`).first().click();
    await page.waitForTimeout(1200);
  };

  /* 1 */
  await open("structure");
  const rail = await page.$$eval("[data-category]:not([data-category=custom-idea])", (els) => els.map((e) => {
    const n = e.querySelector("[data-category-name]");
    const r = n?.getBoundingClientRect();
    return { id: e.getAttribute("data-category"), text: n?.textContent?.trim() ?? "", seen: !!r && r.width > 10 && r.height > 6 };
  }));
  check("1. with a category open, every category still shows its name", rail.length >= 12 && rail.every((c) => c.seen && c.text.length > 1), rail.filter((c) => !c.seen).map((c) => c.id).join(", ") || `${rail.length} names`);

  /* 3 */
  const groups = await page.$$eval("[data-category-open] [data-shelf-group]", (els) => els.map((e) => e.getAttribute("data-shelf-group")));
  const layoutLabels = SUBGROUPS.structure.map((g) => g.label);
  check("3. an open category is grouped by purpose, under its sub-groups' names", groups.length >= 3 && groups.every((g) => layoutLabels.includes(g)), groups.join(", "));
  const footprint = groups.filter((g) => /width|quarter|third|shallow/i.test(g));
  check("3. and not by footprint", footprint.length === 0, footprint.join(", "));
  const tags = await page.$$eval("[data-category-open] [data-shelf-card] [data-footprint]", (els) => els.map((e) => e.textContent));
  check("3. footprint is a small tag on each card instead", tags.length > 5 && tags.every(Boolean), tags.slice(0, 4).join(", "));

  /* 4, 6 */
  const cards = await page.$$eval("[data-shelf-card]", (els) => els.map((e) => ({
    id: e.getAttribute("data-shelf-card"),
    does: e.querySelector("[data-card-does]")?.textContent?.trim() ?? "",
    badge: e.querySelector("[data-status-badge]")?.textContent?.trim() ?? "",
  })));
  check("6. every card on the open category says what it does, under its name", cards.length > 10 && cards.every((c) => c.does.length > 8), cards.filter((c) => c.does.length <= 8).map((c) => c.id).join(", ") || `${cards.length} cards`);
  check("4. and wears Works now or Idea, needs building", cards.every((c) => c.badge === "Works now" || c.badge === "Idea, needs building"));
  const layoutText = await page.locator("[data-category-open]").innerText();
  check("6. no filler words on the open category", !FILLER.test(layoutText), (layoutText.match(FILLER) ?? [""])[0]);
  const ember = await page.$$eval("[data-category-open] .ember", (els) => els.length);
  check("5. no red glow round the cards", ember === 0, `${ember} lit`);
  await shot(page, "layout");

  /* 7 */
  const before = (await state()).nodes.length;
  const tile = page.locator('[data-tile="card-grid"]');
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await page.waitForTimeout(700);
  const dialog = page.locator('[data-part-detail="card-grid"]');
  check("7. a click opens the detail card", await dialog.isVisible());
  check("7. and adds nothing to the page", (await state()).nodes.length === before, `${before} parts`);
  const detailText = await dialog.innerText();
  check("7. the detail card says what it does, whether it works, what it needs and where it goes",
    /What it does/i.test(detailText) && /Works now/.test(detailText) && /What it needs/i.test(detailText) && /Added at the foot of/.test(detailText));
  await shot(page, "detail");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check("7. Escape closes it", !(await dialog.count()));
  await tile.click();
  await page.waitForTimeout(500);
  await page.locator('[data-add-to-page="card-grid"]').click();
  await page.waitForTimeout(900);
  const after = await state();
  const added = after.nodes[after.nodes.length - 1];
  check("7. Add to page adds it", after.nodes.length === before + 1 && added?.featureId === "card-grid", `${before} then ${after.nodes.length}`);
  const picked = await page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((n) => n.hasAttribute("data-just-shown")).map((n) => n.getAttribute("data-node-id")));
  check("7. and outlines it on the board", picked.includes(added?.id), picked.join(", "));
  const onScreen = await page.evaluate((id) => {
    const el = document.querySelector(`[data-node-id="${id}"]`); const pane = el?.closest("[data-studio-pane]");
    if (!el || !pane) return false;
    const r = el.getBoundingClientRect(); const p = pane.getBoundingClientRect();
    return r.bottom > p.top && r.top < p.bottom;
  }, added?.id);
  check("7. and scrolls the board to it", onScreen);
  await shot(page, "added");

  /* 8 */
  await open("motion");
  const sw = page.locator('[data-site-switch="scroll-snap"]').first();
  await sw.scrollIntoViewIfNeeded();
  check("8. snap scrolling is a switch, off to start with", (await sw.getAttribute("data-on")) === "0" && /Turn on for this site/.test(await sw.innerText()));
  const pagesN = (await state()).pages.length;
  await sw.click();
  await page.waitForTimeout(600);
  const snapNodes = (await state()).nodes.filter((n) => n.featureId === "scroll-snap");
  check("8. turned on, every page carries it", (await sw.getAttribute("data-on")) === "1" && new Set(snapNodes.map((n) => n.pageId)).size === pagesN, `${snapNodes.length} on ${pagesN} pages`);
  await sw.click();
  await page.waitForTimeout(600);
  check("8. and turned off, it is gone", (await state()).nodes.every((n) => n.featureId !== "scroll-snap"));
  const demos = await page.$$eval("[data-category-open] [data-motion-demo]", (els) => els.map((e) => e.textContent.trim().length));
  check("5. motion cards show a page of the site moving, never an empty box", demos.length >= 10 && demos.every((n) => n > 5), `${demos.length} demos, ${demos.filter((n) => n <= 5).length} without words`);

  /* 9 */
  const reveal = page.locator('[data-shelf-card="work:reveal"] [data-used-on-page]');
  const said = Number(await reveal.getAttribute("data-used-on-page"));
  check("9. a card used on the page says how many parts use it", said === revealed.length, `${said} said, ${revealed.length} carry it`);
  await reveal.click();
  await page.waitForTimeout(500);
  const sel = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.selection ?? null);
  const onBoard = await page.evaluate(() => [...document.querySelectorAll("[data-just-shown]")].map((n) => n.getAttribute("data-node-id")).sort());
  check("9. and pressing it shows those parts", (sel ? [...sel].sort().join() === revealed.join() : true) && onBoard.join() === revealed.join(), onBoard.join(", "));
  await shot(page, "motion");

  /* 10 */
  await page.locator("[data-category-open] [data-see-motion-tab]").first().click();
  await page.waitForTimeout(700);
  check("10. the Motion category's See on this page opens the Motion tab", await page.locator("[data-motion-panel]").isVisible());
  await page.locator('[data-category="motion"]').first().click();
  await page.waitForTimeout(500);
  await page.locator('[data-see-on-shelf="motion"]').click();
  await page.waitForTimeout(700);
  check("10. and the Motion tab's link opens the shelf's Motion category", await page.locator('[data-category-open="motion"]').count() === 1);

  /* 8, a Format switch */
  await open("platform");
  const an = page.locator('[data-site-switch="analytics"]').first();
  await an.scrollIntoViewIfNeeded();
  await an.click();
  await page.waitForTimeout(500);
  check("8. analytics is a switch kept in the brief's Format", (await state()).format?.["build.analytics"] === true && (await an.getAttribute("data-on")) === "1");
  await shot(page, "engine");

  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
