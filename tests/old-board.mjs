/**
 * WHAT A FIX REACHES ON A BOARD THAT ALREADY EXISTS.
 *
 * His board did not move when three fixes landed. Every number identical:
 * 685 nodes, seventeen headlines still reading "A SolWorksproject", the price
 * pair still two nodes, 45 wrappers, the same five empties, the same 293px,
 * the banner still 1763x82 over an empty 1280x49. Green suite, clean merge,
 * confirmed deploy, unchanged page — which is the exact shape of a fix that
 * works on the path it tests and never reaches the user's data.
 *
 * Every other check in this family seeds a board and then PRESSES something.
 * That proves the command reaches old data and proves nothing whatever about
 * what happens when he simply opens the Builder. This one presses NOTHING,
 * so the answer is a measurement rather than a belief about the code.
 *
 * WHEN IT WAS WRITTEN it said, correctly, that a load did nothing at all —
 * and that was the finding. The sweep on open exists because of it, so the
 * assertions are now its mirror: opening the board is enough. It is kept as a
 * separate check from `sweep-on-open.mjs` because it holds HIS numbers on one
 * page — the 293px, the banner's 33px — and because of the last section,
 * which is the one thing no amount of sweeping can reach.
 *
 * The board here is HIS, at his shapes: a headline already merged into one
 * node with three spaceless runs, the price pair still two nodes with no runs
 * at all, the banner over its empty div, and five empty wrappers totalling
 * the 293px he measured.
 *
 * Against a PRODUCTION build: dev and production render different custom
 * properties, so a height read off one says nothing about the other.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/old-board.mjs http://127.0.0.1:3013
 */
import { SWEEP } from "../src/features/studio/reassemble.ts";
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

/* The live element a part came off: what says this board was captured. */
const FROM = { url: "https://solworks.dev/", host: "solworks.dev", selector: "header > div", at: 1 };

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null,
  sketch: null, from: FROM, byHand: false, ...extra,
});

const nodes = [
  /* The headline as the OLD code left it: one node, three runs, no space
     anywhere between them, because the reader trimmed it at capture. */
  node("n_prose_11", "prose", [{ text: "A Sol" }, { text: "Works", colour: "rgb(34,197,94)" }, { text: "project" }], 40, 300, 240, 30),
  /* The price pair, still two nodes with no runs, at his real coordinates. */
  node("n_prose_92", "prose", "$ 116.59", 1084, 65, 59, 40),
  node("n_prose_95", "prose", "-1.94 %", 1165, 65, 43, 32, { colour: { text: "rgb(239,68,68)" } }),
  /* The banner over its empty div. */
  node("n_box_75", "box", "", 0, 0, 1763, 82),
  node("n_box_76", "box", "", 0, 0, 1280, 49),
  /* And the five empty wrappers, totalling his 293px. */
  node("n_box_53", "box", "", 0, 600, 1457, 148),
  node("n_box_76b", "box", "", 0, 800, 1280, 49),
  node("n_box_80", "box", "", 0, 900, 216, 16),
  node("n_box_110", "box", "", 0, 1000, 1280, 40),
  node("n_box_111", "box", "", 0, 1100, 96, 40),
];
const EMPTIES = ["n_box_53", "n_box_76b", "n_box_80", "n_box_110", "n_box_111"];

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
/* Long enough for the healing and every settle to have had their say. */
await page.waitForTimeout(3000);

const saved = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}")?.state ?? {};
  return Object.fromEntries((s.nodes ?? []).map((n) => [n.id, {
    h: n.h, y: n.y,
    words: typeof n.content === "string" ? n.content : (n.content ?? []).map((r) => r.text).join(""),
  }]));
});
const press = async (typed, label) => {
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(340);
  await page.keyboard.type(typed);
  await page.waitForTimeout(420);
  const item = page.locator("[cmdk-item]", { hasText: label }).first();
  const there = (await item.count()) === 1;
  if (there) await item.click(); else await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);
  return there;
};

/* ------------------------------------------------------------------ */
/* 1. OPENING THE BUILDER, AND PRESSING NOTHING                        */
/* ------------------------------------------------------------------ */

const load = await saved();
/*
 * THIS IS THE CHECK THAT WAS MISSING, and it was missing in both directions.
 * Written against the old behaviour it said "a load does nothing", which was
 * true and was the whole finding. It now says the opposite, and if any of
 * these ever stops being true a board he opens quietly stops being put right.
 */
check("opening the board joins the price pair, with nothing pressed",
  "n_prose_92" in load && !("n_prose_95" in load), Object.keys(load).join(", "));
check("…reading as his page does", load.n_prose_92?.words === "$ 116.59 -1.94 %", JSON.stringify(load.n_prose_92?.words));
check("opening the board fits the banner, giving back the 33px under its only child",
  load.n_box_75?.h === 49, `82 → ${load.n_box_75?.h}`);
/*
 * AND IT REMOVES NOTHING. Both empty wrappers on his home page turned out to
 * be real surfaces sitting below the content they own, so an empty wrapper is
 * reported and left where it is. The 293px stays on the page until a rule
 * exists that puts those boxes back round what they own.
 */
check("opening the board removes NO empty wrapper, because they are misplaced and not junk",
  EMPTIES.every((id) => id in load), EMPTIES.filter((id) => !(id in load)).join(", ") || "all five still there");
check("…still totalling the 293px he measured",
  EMPTIES.reduce((n, id) => n + (load[id]?.h ?? 0), 0) === 293,
  `${EMPTIES.reduce((n, id) => n + (load[id]?.h ?? 0), 0)}px`);
check("and it left a mark, so opening it again will not do this a second time",
  (await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}")?.state?.swept ?? null)) === SWEEP);

/* ------------------------------------------------------------------ */
/* 2. AND A PRESS AFTERWARDS HAS NOTHING LEFT TO DO                    */
/* ------------------------------------------------------------------ */

check("the palette still offers the rebuild", await press("broken sentences", /broken sentences/i));
const joined = await saved();
check("pressing the rebuild again finds nothing left to join",
  JSON.stringify(joined) === JSON.stringify(load), JSON.stringify(Object.keys(joined)));

/*
 * AND A SECOND PRESS CHANGES NOTHING EITHER, because nothing is deleted now
 * — so the chain that used to empty the banner and then remove it on a later
 * press cannot happen at all. Fitting only ever gives back height nothing
 * occupies, and it converges on the first pass.
 */
check("the palette still offers the fitting", await press("fit captured boxes", /fit captured boxes/i));
const fitted = await saved();
check("pressing the fitting again changes nothing, and removes nothing",
  JSON.stringify(fitted) === JSON.stringify(load), Object.keys(fitted).join(", "));
check("…the banner still there, fitted to what it holds rather than gone",
  fitted.n_box_75?.h === 49);

check("neither the sweep nor any command recovers the headline's space, because it is not in the document at all",
  fitted.n_prose_11?.words === "A SolWorksproject", JSON.stringify(fitted.n_prose_11?.words));

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
