/**
 * Captured boxes are fitted to what they hold, and the ones holding nothing go.
 *
 * WHAT HE CLICKED ON: a banner 1763x82 that looked empty, sitting above its
 * own contents and carrying 33px of dead space under its only child. His
 * measurement off that page: 45 wrappers among 114 parts, five holding
 * nothing at all and worth 293px of height between them.
 *
 * AND WHY "DROP THE EMPTY ONES" IS NOT THE RULE. The banner is NOT empty —
 * it holds one box, which is itself empty. A drop-empties rule takes out the
 * inner box and walks straight past the part he complained about. So this
 * reads the geometry: where the boxes actually are, which is the same thing
 * every other rule in `reassemble.ts` does.
 *
 * Two things are never removed, and both are checked here: a box HIS HAND
 * placed, and a box that shows a surface of its own — a background, an edge
 * — because that one looks empty only from the outside and removing it takes
 * a coloured band off the page.
 *
 * Against a PRODUCTION build: a development build renders different custom
 * properties, so a height read off one says nothing about the other.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/boxes-fit.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The live element a part came off. Its presence is what says this board was
   captured rather than built by hand. */
const FROM = { url: "https://solworks.dev/", host: "solworks.dev", selector: "header > div", at: 1 };

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null,
  sketch: null, from: FROM, byHand: false, ...extra,
});

/*
 * HIS CHAIN, at his sizes: the banner holds the empty div, the empty div
 * holds nothing, and a line of words sits inside the banner beside it.
 */
const nodes = [
  node("n_box_75", "box", "", 0, 0, 1763, 82),                       // the banner: 33px of nothing under its child
  node("n_box_76", "box", "", 0, 0, 1280, 49),                       // empty, inside it
  node("n_prose_9", "prose", "A Sol Works project", 40, 400, 400, 30),
  node("n_box_53", "box", "", 0, 600, 1457, 148),                    // empty, on its own
  node("mine", "box", "", 0, 900, 800, 90, { byHand: true }),        // empty, but his hand put it there
  node("band", "box", "", 0, 1100, 1763, 60, { colour: { surface: "rgb(17,17,17)" } }), // empty, but it shows
];

const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], format: {}, brief: { name: "SOLWORKS", gimmick: "", master: "" },
  frameWidth: 1763, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

/** What the document says, which is what publish and the live page will carry. */
const saved = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}")?.state ?? {};
  return Object.fromEntries((s.nodes ?? []).map((n) => [n.id, { x: n.x, y: n.y, w: n.w, h: n.h }]));
});

const before = await saved();
check("the board starts with all six parts", Object.keys(before).length === 6, Object.keys(before).join(", "));
check("…the banner among them at the height his capture recorded", before.n_box_75?.h === 82, `${before.n_box_75?.h}`);

/* Run it the way a person does, from the command palette. */
await page.keyboard.press("Control+k");
await page.waitForTimeout(340);
await page.keyboard.type("fit captured boxes");
await page.waitForTimeout(420);
const item = page.locator("[cmdk-item]", { hasText: /fit captured boxes/i }).first();
check("the palette offers it", (await item.count()) === 1);
if (await item.count()) await item.click(); else await page.keyboard.press("Escape");
await page.waitForTimeout(1200);

const after = await saved();

check("the empty box inside the banner is gone", !("n_box_76" in after), Object.keys(after).join(", "));
check("…and the empty box standing on its own is gone too", !("n_box_53" in after));
check("the banner STAYS, because it is not empty — which is what a drop-empties rule would miss",
  "n_box_75" in after);
check("…fitted to its only child, giving back exactly the 33px of dead space under it",
  after.n_box_75?.h === 49, `${before.n_box_75?.h} → ${after.n_box_75?.h}`);
check("the box his hand placed is untouched, though it holds nothing",
  after.mine?.h === 90 && after.mine?.y === 900, JSON.stringify(after.mine));
check("the empty box that shows a background is untouched, because dropping it takes a band off the page",
  after.band?.h === 60 && after.band?.y === 1100, JSON.stringify(after.band));
check("the words are untouched — this moves no part that says anything",
  after.n_prose_9?.y === before.n_prose_9?.y && after.n_prose_9?.x === before.n_prose_9?.x,
  `${JSON.stringify(before.n_prose_9)} → ${JSON.stringify(after.n_prose_9)}`);
check("nothing was LIFTED: no part's top moved at all",
  Object.keys(after).every((id) => after[id].y === before[id]?.y),
  Object.keys(after).filter((id) => after[id].y !== before[id]?.y).join(", ") || "none moved");

/* The board drew what the document says, rather than only the document changing. */
const drawn = await page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].map((el) => el.getAttribute("data-node-id")));
check("the board is drawing the four that are left, and neither of the two that went",
  drawn.length === 4 && !drawn.includes("n_box_76") && !drawn.includes("n_box_53"), drawn.join(", "));

/* And it says what it did, in words, by name where it matters. */
const said = await page.evaluate(() => document.body.innerText);
check("and it says out loud how much empty box it gave back", /px of empty box/.test(said),
  (said.match(/[^\n]*px of empty box[^\n]*/) ?? ["not said"])[0]);

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
