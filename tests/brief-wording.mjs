/**
 * The brief says what it means.
 *
 * Its wording was rewritten from what Claude got wrong reading it (see
 * docs/DESIGN.md, "The brief says what it means"). Each check here is one of
 * those misreadings, held shut: a default that was invisible, a height that
 * read as a box, a region that fell out of the reading order, a link that got
 * invented, a name that never reached the wordmark. And the Trail view, which
 * is where a finding is read and taken.
 *
 *   node tests/brief-wording.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

// A small document: a name, a nav bar, a button that links nowhere, a drawn
// region with words and nothing inside it, and a critique on the trail.
const doc = {
  state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "One long scroll.", scroll: "inherit" }],
    nodes: [
      { id: "n_nav", pageId: "page_home", featureId: "sticky-header", label: "Top bar", prompt: "Stays put.", content: "Work, About", data: "", x: 0, y: 0, w: 1440, h: 64, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null },
      { id: "n_cta", pageId: "page_home", featureId: "cta-primary", label: "Join", prompt: "", content: "", data: "", x: 560, y: 120, w: 320, h: 56, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null },
    ],
    groups: [],
    shapes: [{ id: "s_region", pageId: "page_home", kind: "frame", points: [[120, 240], [1320, 520]], hue: 265, width: 2, label: "The coordinates", prompt: "A two-column ledger of contract, network and supply.", relation: "flow", fromNodeId: null, toNodeId: null }],
    format: {},
    brief: { name: "BLACKORB", gimmick: "Power in the dark. A community token site.", master: "" },
    frameWidth: 1440,
    activePageId: "page_home",
    trail: [
      { id: "t1", at: 1, stage: "author", target: { kind: "node", id: "n_nav", label: "Top bar" }, text: "Stays put.", parentId: null },
      { id: "t2", at: 2, stage: "critique", target: { kind: "node", id: "n_nav", label: "Top bar" }, text: "Anchor targets will hide under the bar.", parentId: "t1", kind: "contradiction", mode: "critique", model: "test", prompt: "Stays put. Anchor targets clear it and it marks the current section.", applied: false },
    ],
  },
  version: 0,
};

// PLAYWRIGHT_CHROMIUM points at a browser when the installed Playwright has none of its own.
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), JSON.stringify(doc));
const page = await context.newPage();
await page.goto(`${URL}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.evaluate(() => window.__studioOpenBrief?.());
await page.waitForTimeout(800);

const brief = await page.locator("pre").first().innerText();
const has = (re) => re.test(brief);

check("the name reaches the wordmark and the title", has(/reads "BLACKORB", never "Logo"/) && has(/Browser title: "BLACKORB"/));
check("format defaults are in the brief, resolved", has(/Body font: system sans/) && has(/Theme: dark/) && has(/Every value here is binding/));
check("a height is a minimum, never a box", has(/at least 64px tall/) && !/about \d+px tall/.test(brief) && !/do not reflow/.test(brief));
check("the frame is the desktop layout and rows stack when narrower", has(/frame 1440px wide/) && has(/stacks top to bottom in reading order/));
check("an empty prompted region is a section at its row", has(/\*\*The coordinates\*\*, a section of its own/) && !/nothing yet/.test(brief));
check("a part with nowhere to send people says so", has(/links to: nowhere yet, a visible placeholder/));
check("the category no longer leaks into the element line", !/\(Navigation\)/.test(brief) && has(/\*\*Top bar\*\*, Sticky top bar · must/));
check("hairlines, anchors and reduced motion are stated once", has(/Text role at 12% opacity/) && has(/scroll-margin-top/) && has(/prefers-reduced-motion/));
check("all-must gets the no-cut-list line", has(/no cut list/) === false, "only two elements, so the line stays off");

// The trail: written → found → now, and Take it writes the prompt.
//
// The Trail tab is the thread tree now (ThreadTree.tsx); a finding from
// before threads were kept — which is what this fixture seeds, with no
// threads of its own — sits under a collapsed "N findings from before
// threads were kept" <details>, so it exists in the DOM before it is opened
// but is not visible or clickable until it is.
await page.getByRole("radio", { name: /^Trail/ }).click();
await page.waitForTimeout(600);
// The Trail is a tree of threads now, and a finding kept before threads
// existed sits behind a disclosure. The behaviour under it is the same, so
// this opens it rather than dropping the check.
const older = page.locator("summary", { hasText: /from before threads were kept/ });
if (await older.count()) {
  await older.first().click();
  await page.waitForTimeout(400);
}
const map = page.locator("[data-prompt-trail]");
check("the Trail view lists the written prompt and the finding", (await map.locator('[data-bubble="author:node:n_nav"]').count()) === 1 && (await map.locator('[data-bubble="t2"]').count()) === 1);
check("a line joins the finding to the prompt it is about", (await map.locator("svg path").count()) >= 1);
await map.locator('[data-bubble="t2"]').getByRole("button", { name: /Take it/ }).click();
await page.waitForTimeout(500);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state);
check("Take it writes the proposed prompt onto the part", after.nodes.find((n) => n.id === "n_nav").prompt === "Stays put. Anchor targets clear it and it marks the current section.");
check("and the trail gains a final entry pointing at the finding", after.trail.some((e) => e.stage === "final" && e.parentId === "t2") && after.trail.find((e) => e.id === "t2").applied === true);
check("the Now column shows it", (await map.locator('[data-bubble]').filter({ hasText: /^now/ }).count()) >= 1);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
