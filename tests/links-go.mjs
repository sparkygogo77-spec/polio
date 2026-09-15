/**
 * Links to goes somewhere on every part that offers it (inventory B24).
 *
 * "Links to" was offered on 30 parts (the panel, the wheel, the brief) and
 * read by 16: on card grids, article lists, product grids, the forum, the
 * recommender, the footer and the magnetic button the link was set,
 * written into the brief, and went nowhere live. And a link drawn as an
 * arrow to another part (`kind: "node"`) was set by no UI and shown by none.
 *
 *   · every part declared linkable either reads its link or is declared
 *     whole, so the block makes the whole part the link (a source read of
 *     the definitions and the part files, named as one);
 *   · live: a card grid linked to a page takes a visitor there when its
 *     body is pressed, and so does a magnetic button and a footer's mark;
 *   · the panel names a link to another part by that part's name.
 *
 *   node tests/links-go.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

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

/* 1. Every linkable part reads its link, or is declared whole. */
const defs = readFileSync("src/features/studio/parts/index.ts", "utf8");
const files = Object.fromEntries(["Layout", "Text", "Media", "Data", "Social", "Ai", "Interact", "Motion", "Commerce", "Cta", "Header", "Hero", "Forms", "Tabs", "Accordion", "SearchBox", "Power", "Platform", "Ops", "Behaviour", "Cube", "Mesh", "DrawnIcon", "Orb"].map((f) => {
  try { return [f, readFileSync(`src/features/studio/parts/${f}.tsx`, "utf8")]; } catch { return [f, ""]; }
}));
const readsLink = (component) => {
  for (const src of Object.values(files)) {
    const m = new RegExp(`export function ${component}\\(\\{([^}]*)\\}`).exec(src);
    if (m) return /\blink\b/.test(m[1]);
  }
  return false;
};
const rows = [...defs.matchAll(/\{ component: (\w+), ids: \[([^\]]*)\], tier: "[ABC]"(, linkable: true)?(, linkWhole: true)?/g)];
const linkable = rows.filter((r) => r[3]);
const silent = linkable.filter((r) => !r[4] && !readsLink(r[1]));
check(`every linkable part reads its link or is declared whole (source read): ${linkable.length} linkable`, silent.length === 0, silent.map((r) => r[1]).join(", ") || "none silent");
check("the footer and the magnetic button read it themselves", readsLink("Footer") && readsLink("MagneticButton"));

/* 2. Live. */
const node = (id, featureId, label, x, y, w, h, link = null, content = "") => ({
  id, pageId: "page_home", featureId, label, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false,
  link, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
const doc = {
  state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }, { id: "page_work", name: "Work", path: "/work", prompt: "", scroll: "inherit" }],
    nodes: [
      node("n_grid", "card-grid", "Cards", 40, 40, 900, 300, { kind: "page", target: "page_work" }, "One, Two, Three"),
      node("n_mag", "magnetic-buttons", "Go", 1000, 40, 300, 120, { kind: "page", target: "page_work" }, "Go on"),
      node("n_foot", "footer", "Foot", 0, 600, 1440, 200, { kind: "page", target: "page_work" }, "logo: ACME\nWork, About"),
      node("n_arrow", "cta-primary", "Jump", 40, 400, 300, 56, { kind: "node", target: "n_foot" }, "Jump"),
    ],
    groups: [], shapes: [], format: {}, brief: { name: "Links", gimmick: "", master: "" }, frameWidth: 1440, activePageId: "page_home",
  },
  version: 0,
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify(d)), doc);
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const active = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.activePageId);
const toHome = async () => { await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("builder.studio")); d.state.activePageId = "page_home"; localStorage.setItem("builder.studio", JSON.stringify(d)); }); await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1000); await page.keyboard.press("p"); await page.waitForTimeout(1200); };

await page.keyboard.press("p");
await page.waitForTimeout(1200);
check("the preview is up on the home page", (await page.locator("[data-live-scroller]").count()) === 1 && (await active()) === "page_home");
{
  const grid = page.locator('[data-live-node="n_grid"]');
  const b = await grid.boundingBox();
  // A press on a card whose title is no page: the part's own link is where it goes.
  await page.mouse.click(b.x + b.width * 0.2, b.y + b.height * 0.5);
  await page.waitForTimeout(900);
  check("a card grid linked to a page takes a visitor there when pressed", (await active()) === "page_work", await active());
}
await toHome();
{
  const mag = page.locator('[data-live-node="n_mag"] button').first();
  await mag.click();
  await page.waitForTimeout(900);
  check("a magnetic button linked to a page goes there rather than toasting its own name", (await active()) === "page_work", await active());
}
await toHome();
{
  const mark = page.locator('[data-live-node="n_foot"] [data-footer-mark]').first();
  check("the footer's mark is the footer's link", (await mark.count()) === 1);
  if (await mark.count()) { await mark.click(); await page.waitForTimeout(900); }
  check("and pressing it goes where the footer links", (await active()) === "page_work", await active());
}

/* 3. The panel names a link to another part. */
// Back to the board, on the home page, where the arrowed part is.
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("builder.studio")); d.state.activePageId = "page_home"; localStorage.setItem("builder.studio", JSON.stringify(d)); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.locator('[data-node-id="n_arrow"]').click({ force: true });
await page.waitForTimeout(500);
const tab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Element" }).first();
if (await tab.count()) await tab.click().catch(() => {});
await page.waitForTimeout(300);
const said = (await page.locator('[data-side-panel] [data-link-field]').innerText().catch(() => "")).replace(/\s+/g, " ");
check("a link drawn to another part is shown by that part's name", /Foot/.test(said) && /part/i.test(said), said.slice(0, 80) || "no link field said anything");

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
