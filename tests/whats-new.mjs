/**
 * The "What's new" card, end to end on Trump & Morty.
 *
 * The owner's ask: a card like the update cards on trading sites, put on any
 * published site from the shelf. Each step shows a feature the site really
 * has, live, scaled into the card (not a screenshot), with its words and one
 * button that does what it says; dots, Back, Next, Finish; "See previous
 * updates"; shown on a first visit, on each update, or only from a link,
 * once per update per visitor, remembered in their own browser; Escape and a
 * press outside close it; keyboard and phone friendly; never in the way if
 * it fails to load; published exactly as seen.
 *
 * A three-step tour on sink's capture of trumpmorty.fun, brought in as an
 * import brings it (`attachCaptured`), with Copy put on its address bar the
 * way the owner puts it from the shelf:
 *   1. the copy-address bar (n_box_188), its button presses the bar: copies;
 *   2. the TV, picked as the part that moves when pointed at (its set, the
 *      screen and the knobs), its button scrolls to it; a "Settings › Less
 *      motion" path with a switch that turns that site option on;
 *   3. the Buy button (n_box_181), its button goes to the How to buy section.
 * The previews move as the parts do: pointing at the TV in the card turns
 * the card's knobs, never the page's (and the page's TV turns only its
 * own), and the copy bar in the card lifts with its words, as on the page.
 * Then the owner marks a new update, and every visitor is shown it once more.
 *
 * The export is served on its own (a stand-in host; nothing reaches the
 * Builder), and every check after that runs on the published files.
 * Read-only on sink.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/whats-new.mjs http://127.0.0.1:3013 <the capture folder>
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const SINK = process.argv[3] ?? process.env.SINK ?? join(here, "..", "capture", "versions", "sink-0ee06fa");
const SHOTS = ".screenshots/lane-e";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const src = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const { attachCaptured } = await src("shelf/library/captured.ts");
const { copyMotion } = await src("shelf/parts/capturedMotion.ts");
const { tourChoices, markUpdate, newTour, siteFaces } = await src("tour.ts");
const { getFeature } = await src("shelf/catalog.ts");
const { getWork, LIBRARY } = await src("shelf/library/works.ts");
const { PUBLISH } = await src("shelf/shelfPlan.ts");
const { SHELF_GROUPS } = await src("shelf/shelfGroups.ts");

/* ------------------------------------------------------------ the site, as an import brings it */
const ADDRESS = "AezYBzTYAUw5gFN8vyzt6H9hL7gMvMv14n4VbYrqpump";
const doc = JSON.parse(readFileSync(join(SINK, "sites", "trumpmorty-fun", "site", "document.json"), "utf8"));
const home = doc.activePageId ?? doc.pages[0].id;
let nodes = attachCaptured(doc.nodes, doc.behaviours, doc.keyframes);
nodes = nodes.map((n) => (n.id === "n_box_188" ? { ...n, work: { id: "copy-toast", inputs: { text: ADDRESS, toast: "CA copied!" } } } : n));

/* ------------------------------------------------------------ the shelf and the list it picks from */
check("on the shelf: a “What's new card” under First visit help, published by its feature", getFeature("whats-new")?.name === "What's new card" && JSON.stringify(SHELF_GROUPS).includes('"whats-new"') && PUBLISH["whats-new"]?.kind === "runs" && LIBRARY.some((w) => w.manifest.id === "whats-new"));
const choices = tourChoices(nodes, { pageId: home, siteName: doc.brief?.name, featureName: (id) => getFeature(id)?.name, workName: (id) => getWork(id)?.manifest.name, workKind: (id) => getWork(id)?.manifest.category });
const pick = (id, group = "On this page") => choices.find((c) => c.id === id && c.group === group);
check("the list holds the site's real parts: the copy-address bar, the TV and the Buy button", !!pick("n_box_188") && !!pick("n_picture_196") && !!pick("n_box_181"), [pick("n_box_188"), pick("n_picture_196"), pick("n_box_181")].map((c) => c?.name).join(" · "));
check("…the features at work on them, never the page's motion", choices.some((c) => c.group === "Features" && c.id === "n_box_188") && !choices.some((c) => c.group === "Features" && /reveal/i.test(c.name)), choices.filter((c) => c.group === "Features").map((c) => `${c.name} ${c.where ?? ""}`).join(" · "));
/* The TV whose knobs turn when it is pointed at: offered as a part that moves, whole, knobs and all. */
const picture = nodes.find((n) => n.id === "n_picture_196"), knob = nodes.find((n) => n.id === "n_box_198");
const holds = (id, n) => { const b = nodes.find((x) => x.id === id); return !!b && n.x >= b.x && n.y >= b.y && n.x + n.w <= b.x + b.w && n.y + n.h <= b.y + b.h; };
const tvSet = choices.find((c) => c.group === "Features" && /^Moves when pointed at$/.test(c.name) && holds(c.id, picture) && holds(c.id, knob));
check("a part that moves when pointed at is offered whole: the TV, with its screen and knobs", !!tvSet, tvSet ? `${tvSet.id}: ${tvSet.name} ${tvSet.where ?? ""}` : choices.filter((c) => c.group === "Features").map((c) => c.name).join(" · "));
const TV = tvSet?.id ?? "n_picture_196";
const howToBuy = choices.find((c) => c.group === "Sections" && /how to buy/i.test(c.name));
check("…its sections, by their headings", !!howToBuy && choices.filter((c) => c.group === "Sections").length >= 3, choices.filter((c) => c.group === "Sections").map((c) => c.name).join(" · "));
const missing = choices.filter((c) => c.group === "Needs a backend" && c.missing);
check("…and a backend feature the site lacks says what is missing instead", missing.length >= 1 && missing.every((c) => !c.id && /this site has no .* yet/i.test(c.missing)), missing[0]?.missing ?? "");
check("a choice suggests plain words for its step", pick("n_box_188")?.button === "Copy it" && pick("n_box_188")?.action === "open");

const step = (target, title, lines, action, button, extra = {}) => ({ target, title, lines, path: "", action, button, option: "", link: null, ...extra });
const tour = {
  ...newTour(),
  when: "update",
  current: {
    id: 1, date: "2026-10-01",
    steps: [
      step("n_box_188", "Copy the address in one press", "Press the bar and the contract address is copied.\nNo selecting, no typos.", "open", "Copy it"),
      step(TV, "The TV is live", "Channel 47, all day.\nTurn the motion down if it is too much.", "scroll", "Show me the TV", { path: "Settings › Less motion", option: "calm" }),
      step("n_box_181", "Buy on pump.fun", "One button, straight to the coin.\nHow to buy walks you through it.", "link", "See how to buy", { link: { kind: "node", target: howToBuy?.id ?? "n_box_3" } }),
    ],
  },
  past: [],
  at: 0,
};
const marked = markUpdate(tour);
check("placed, the card takes the site's own faces: its big words' for titles, its running words' for lines", /Luckiest Guy/.test(siteFaces(nodes, home).titleFont ?? "") && !!siteFaces(nodes, home).bodyFont, JSON.stringify(siteFaces(nodes, home)));
check("marking a new update moves what was shown to the previous updates and counts up", marked.current.id === 2 && marked.past.length === 1 && marked.past[0].steps.length === 3);

/* A press, as a hover: a key that sinks when pressed, and its words with it, written again for its copy alone. */
const keyParts = [
  { id: "n_key_1", pageId: "p", x: 0, y: 0, w: 120, h: 40, from: { selector: "body > a" }, motion: { active: [{ selector: "a:active", self: true, style: { transform: "translateY(2px)" } }] } },
  { id: "n_word_2", pageId: "p", x: 10, y: 10, w: 60, h: 20, from: { selector: "body > a > span" }, motion: null },
];
const km = copyMotion(keyParts, "n_key_1");
check("a part's press motion is written for its copy alone: the copied key sinks, and its words with it",
  km.idOf("n_key_1") !== "n_key_1" && km.css.includes(`[data-copy-node="${km.idOf("n_key_1")}"]:active`) && km.css.includes(`.mo-${km.idOf("n_key_1")}`) && new RegExp(`:active[^{]*\\) \\[data-copy-node="${km.idOf("n_word_2")}"\\] \\{ [^}]*translateY`).test(km.css) && !/\.mo-n_key_1\b|#n_key_1\b|data-live-node/.test(km.css),
  km.css.split("\n").filter((l) => l.includes(":active")).slice(0, 2).join(" | "));

const base = nodes.find((n) => n.id === "n_box_188");
const CARD = "n_whatsnew_1";
const card = {
  ...Object.fromEntries(Object.keys(base).map((k) => [k, null])),
  id: CARD, pageId: home, featureId: "whats-new", label: "What's new card", prompt: "", content: "", data: "",
  x: 900, y: 1200, w: 440, h: 560, groupId: null, options: siteFaces(nodes, home), priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null,
  animSpeed: 1, animDelay: 0, animEase: "smooth", auraSize: 1, auraStyle: "glow", byHand: true,
  work: { id: "whats-new", inputs: {} }, tour,
};
const seeded = { ...doc, nodes: [...nodes, card], activePageId: home };

/* ------------------------------------------------------------ in the Builder */
const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const builder = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await builder.route("**/api/tweets/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }));
await builder.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false }, configured: false, source: null }) }));
const seed = async (state) => {
  await builder.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await builder.evaluate((s) => {
    const env = (x) => JSON.stringify({ state: x, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: "b1", name: "Trump & Morty", updatedAt: Date.now() }], activeId: "b1" }));
    localStorage.setItem("builder.studio", env(s));
  }, state);
  await builder.reload({ waitUntil: "networkidle" });
  await builder.waitForFunction(() => typeof window.__studioExport === "function", null, { timeout: 60000 });
  await builder.waitForTimeout(2000);
};
await seed(seeded);
await builder.locator("[data-side-panel]").getByRole("radio", { name: "Element" }).first().click({ force: true });
await builder.waitForTimeout(400);
const onBoard = builder.locator(`[data-node-id="${CARD}"]`);
/* Picked the way an owner finds it: by name in the Element list. */
await builder.locator("[data-element-search]").fill("what's new");
await builder.waitForTimeout(300);
await builder.locator(`[data-list-row="${CARD}"] [data-element-row]`).click();
await builder.waitForTimeout(1200);
check("on the board the card draws its first step with the real copy-address bar on top", (await onBoard.locator('[data-part-copy="n_box_188"] [data-copy-of="n_box_188"]').count()) === 1 && /Copy the address/.test(await onBoard.innerText()));
const editor = builder.locator(`[data-tour-editor="${CARD}"]`);
check("picked, the side panel edits its steps: three rows, when it shows, mark a new update", (await editor.count()) === 1 && (await editor.locator("[data-tour-step-row]").count()) === 3 && (await editor.locator("[data-tour-mark]").count()) === 1);
await builder.screenshot({ path: `${SHOTS}/whats-new-board.png` });
await editor.locator("[data-tour-add]").click();
await builder.waitForTimeout(300);
const picker = editor.locator("[data-tour-picker]");
const pickable = await picker.locator("[data-tour-choice]").evaluateAll((es) => es.map((e) => e.getAttribute("data-tour-choice")));
check("adding a step lists the site's own features to pick from", ["n_box_188", "n_picture_196", "n_box_181"].every((id) => pickable.includes(id)) && (await picker.locator("[data-tour-missing]").count()) >= 1, `${pickable.length} choices`);
await picker.locator("[data-tour-picker-search]").fill("lore");
await builder.waitForTimeout(200);
const found = await picker.locator("[data-tour-choice]").allInnerTexts();
check("…and finds one by its words", found.length > 0 && found.every((t) => /lore/i.test(t)), found.slice(0, 3).join(" · "));
await builder.screenshot({ path: `${SHOTS}/whats-new-picker.png` });

/* The Builder's Preview runs the same card, the same way. */
await builder.keyboard.press("Escape");
await builder.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
await builder.keyboard.press("p");
const inPreview = await builder.waitForSelector(`[data-tour-layer]:not([hidden]) [data-tour-card]`, { timeout: 15000 }).then(() => true, () => false);
const previewStep = await builder.evaluate(() => { const n = document.querySelector("[data-tour-layer]:not([hidden]) [data-tour-next]"); n?.click(); return { at: [...document.querySelectorAll("[data-tour-layer]:not([hidden]) [data-tour-step]")].findIndex((x) => !x.hidden), open: document.querySelectorAll("[data-tour-layer]:not([hidden])").length, all: document.querySelectorAll("[data-tour-layer]").length }; });
check("in the Builder's Preview the card opens and steps as published", inPreview && previewStep.at === 1, JSON.stringify(previewStep));
await builder.screenshot({ path: `${SHOTS}/whats-new-builder-preview.png` });
check("…drawn in view, over the page, not off down it", await builder.evaluate(() => { const r = document.querySelector("[data-tour-layer]:not([hidden]) [data-tour-card]")?.getBoundingClientRect(); return !!r && r.top >= 0 && r.bottom <= innerHeight && r.width > 300; }));
await builder.keyboard.press("Escape");
await builder.waitForTimeout(300);
if (await builder.locator("[data-side-panel]").count() === 0) await builder.keyboard.press("p");
await builder.waitForTimeout(800);
await builder.locator("[data-side-panel]").getByRole("radio", { name: "Element" }).first().click({ force: true });
if (!(await builder.locator(`[data-tour-editor="${CARD}"]`).count())) {
  await builder.locator("[data-element-search]").fill("what's new");
  await builder.waitForTimeout(300);
  await builder.locator(`[data-list-row="${CARD}"] [data-element-row]`).click();
  await builder.waitForTimeout(800);
}

/* ------------------------------------------------------------ published, on its own */
const exportFiles = async () => builder.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: f.encoding ? "" : f.content })));
let files = await exportFiles();
const index = files.find((f) => f.path === "index.html")?.content ?? "";
check("the export carries the card, closed, and its feature's script", /data-tour-layer="[^"]*"[^>]*hidden/.test(index) && files.some((f) => f.path === "assets/features/whats-new.js") && /"feature":"whats-new"/.test(index));
check("the card's previews are the real parts, drawn again (not pictures of them)", (index.match(/data-copy-of="n_box_188"/g) ?? []).length >= 1 && /data-copy-of="n_picture_196"/.test(index) && /data-copy-of="n_box_181"/.test(index));

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ["clipboard-read", "clipboard-write"] });
const outside = [];
const errors = [];
await ctx.route("**/*", (r) => {
  const u = new URL(r.request().url());
  if (u.host !== "published.test") { outside.push(u.host); return r.fulfill({ status: 200, contentType: "text/plain", body: "" }); }
  const p = decodeURIComponent(u.pathname).replace(/^\//, "") || "index.html";
  const f = files.find((x) => x.path === p) ?? files.find((x) => x.path === `${p}/index.html`) ?? files.find((x) => x.path === `${p}.html`);
  if (!f) return r.fulfill({ status: 404, body: "" });
  const type = p.endsWith(".css") ? "text/css" : p.endsWith(".js") ? "text/javascript" : p.endsWith(".json") ? "application/json" : "text/html";
  return r.fulfill({ status: 200, contentType: type, body: f.content });
});
const site = await ctx.newPage();
site.on("pageerror", (e) => errors.push(e.message));
const open = () => site.locator("[data-tour-layer]:not([hidden])");
const visibleStep = () => site.evaluate(() => [...document.querySelectorAll("[data-tour-step]")].findIndex((s) => !s.hidden && s.offsetParent !== null));
/* The site has its own loading screen: a visit is judged once it has gone and the card has had its moment. */
const settle = async (p) => { await p.waitForTimeout(600); await p.waitForFunction(() => !document.querySelector("[data-crt]"), null, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1200); };
const goHome = async (hash = "") => { await site.goto(`https://published.test/index.html${hash}`, { waitUntil: "load" }); await settle(site); };

await goHome();
check("a first-time visitor is shown the card as the page opens", (await open().count()) === 1 && (await visibleStep()) === 0);
check("…once the site's own loading screen has gone, not over it", await site.evaluate(() => !document.querySelector("[data-crt]")));
check("its first step plays the real copy-address bar, scaled into the card, words and all", await site.evaluate(() => {
  const c = document.querySelector('[data-tour-step="0"] [data-copy-of="n_box_188"]');
  const r = c?.getBoundingClientRect();
  const pieces = [...document.querySelectorAll('[data-tour-step="0"] [data-copy-of]')];
  const words = pieces.map((p) => p.innerText).join(" ");
  return !!c && r.width > 50 && r.height > 5 && pieces.every((p) => Number(getComputedStyle(p).opacity) > 0.9) && words.includes("AezYBzTYAUw5gFN8vyzt6H9hL7gMvMv14n4VbYrqpump") && /COPY/.test(words);
}));
check("its words read on the card: title and button stand out from what is behind them", await site.evaluate(() => {
  /* Luminance from what the browser reports: rgb(), or oklch() (its lightness, cubed, is luminance near enough for a 4.5 bar). */
  const L = (c) => {
    const o = /oklch\(([\d.]+)(%?)/.exec(c);
    if (o) { const l = o[2] ? +o[1] / 100 : +o[1]; return l ** 3; }
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(c) || []; const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * lin(+m[1]) + 0.7152 * lin(+m[2]) + 0.0722 * lin(+m[3]);
  };
  const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const card = document.querySelector("[data-tour-card]"), title = document.querySelector('[data-tour-step="0"] [data-tour-title]'), btn = document.querySelector('[data-tour-step="0"] [data-tour-action]');
  return ratio(getComputedStyle(title).color, getComputedStyle(card).backgroundColor) >= 4.5 && ratio(getComputedStyle(btn).color, getComputedStyle(btn).backgroundColor) >= 4.5;
}));
await site.screenshot({ path: `${SHOTS}/whats-new-published.png` });
/* The previews move as the parts do. */
const turned = (sel) => site.evaluate((x) => { const e = document.querySelector(x); if (!e) return null; const t = getComputedStyle(e).transform; if (!t || t === "none") return 0; const m = new DOMMatrix(t); return Math.round(Math.atan2(m.b, m.a) * 180 / Math.PI * 10) / 10; }, sel);
const moved = (sel) => site.evaluate((x) => { const e = document.querySelector(x); const t = e ? getComputedStyle(e).transform : "none"; return !!t && t !== "none" && t !== "matrix(1, 0, 0, 1, 0, 0)"; }, sel);
const pointAt = async (sel) => { const b = await site.locator(sel).first().boundingBox(); await site.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 }); await site.waitForTimeout(900); };
await pointAt('[data-tour-step="0"] [data-copy-of="n_box_188"]');
check("pointing at the copy bar in the card lifts it with its words, as on the page — and not the page's own bar",
  (await moved('[data-tour-step="0"] [data-copy-of="n_box_188"] .mo')) && (await moved('[data-tour-step="0"] [data-copy-of="n_prose_190"]')) && !(await moved("#n_prose_190")) && !(await moved("#n_box_188 .mo")));
await site.mouse.move(5, 5);

/* The preview works as the part does: a press on it copies. */
await site.locator('[data-tour-step="0"] [data-copy-of="n_box_188"]').click();
await site.waitForTimeout(500);
check("the preview is live: pressing the bar in the card copies, as the bar does", (await site.evaluate(() => navigator.clipboard.readText().catch(() => ""))) === ADDRESS && /CA copied!/.test((await site.locator("[data-feature-toast]").allInnerTexts()).join(" ")));
await site.evaluate(() => navigator.clipboard.writeText(""));
const dots = () => site.evaluate(() => [...document.querySelectorAll("[data-tour-dot]")].map((d) => d.getAttribute("aria-current") === "step"));
const shown = (sel) => site.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; }, sel);
check("three dots, the first lit; Back hidden, Next shown", JSON.stringify(await dots()) === "[true,false,false]" && !(await shown("[data-tour-back]")) && (await shown("[data-tour-next]")));
await site.locator("[data-tour-next]").click();
check("Next goes to the second step: the TV, live", (await visibleStep()) === 1 && JSON.stringify(await dots()) === "[false,true,false]" && (await site.locator('[data-tour-step="1"] [data-copy-of="n_picture_196"]').count()) === 1);
check("…and the lit dot moves with it", await site.evaluate(() => { const d = [...document.querySelectorAll("[data-tour-dot]")].map((x) => getComputedStyle(x).backgroundColor); return d[1] !== d[0] && d[0] === d[2]; }));
await site.mouse.move(5, 5);
await site.waitForTimeout(700);
const copyKnobs = ['[data-tour-step="1"] [data-copy-of="n_box_198"] .mo', '[data-tour-step="1"] [data-copy-of="n_box_200"] .mo'];
const atRest = [await turned(copyKnobs[0]), await turned(copyKnobs[1])];
await pointAt(`[data-tour-step="1"] [data-copy-of="${TV}"]`);
const copyTurn = [await turned(copyKnobs[0]), await turned(copyKnobs[1])];
const pageTurn = [await turned("#n_box_198 .mo"), await turned("#n_box_200 .mo")];
check("pointing at the TV in the card turns the card's knobs, as the page's TV turns its own", JSON.stringify(atRest) === "[0,0]" && Math.abs(copyTurn[0] - 120) < 2 && Math.abs(copyTurn[1] + 80) < 2, `at rest ${atRest}, pointed at ${copyTurn}`);
check("…and never the page's knobs", JSON.stringify(pageTurn) === "[0,0]", `page's ${pageTurn}`);
await site.screenshot({ path: `${SHOTS}/whats-new-tv-knobs.png` });
await site.mouse.move(5, 5);
await site.waitForTimeout(300);
await site.locator("[data-tour-back]").click();
check("Back goes back", (await visibleStep()) === 0);
await site.locator("[data-tour-next]").click();
await site.locator("[data-tour-next]").click();
check("the last step shows Finish in place of Next", (await visibleStep()) === 2 && (await shown("[data-tour-finish]")) && !(await shown("[data-tour-next]")));
await site.keyboard.press("ArrowLeft");
check("the arrow keys move through the steps too", (await visibleStep()) === 1);
/* The path's switch turns a site option on, for this visitor. */
await site.locator('[data-tour-step="1"] [data-tour-switch]').click();
check("the path's switch turns “Less motion” on for the site", (await site.evaluate(() => document.documentElement.getAttribute("data-site-calm"))) === "on" && (await site.locator('[data-tour-step="1"] [data-tour-switch]').getAttribute("aria-checked")) === "true");
for (let i = 0; i < 12; i++) await site.keyboard.press("Tab");
check("Tab keeps to the card while it is open", await site.evaluate(() => !!document.activeElement?.closest("[data-tour-card]")));
await site.locator("[data-tour-step]:not([hidden]) [data-tour-action]").click();
await site.waitForTimeout(900);
const inView = (id) => site.evaluate((x) => { const r = document.getElementById(x)?.getBoundingClientRect(); return !!r && r.bottom > 0 && r.top < innerHeight; }, id);
check("“Show me the TV” closes the card and scrolls to the TV", (await open().count()) === 0 && (await inView("n_picture_196")));
await site.mouse.move(5, 5);
await pointAt(`#${TV}`);
check("the page's own TV still turns its own knobs when pointed at", Math.abs((await turned("#n_box_198 .mo")) - 120) < 2, `page's knob ${await turned("#n_box_198 .mo")}`);
await site.mouse.move(5, 5);
check("the visitor's choice is remembered: what they have seen, and the option", await site.evaluate(() => {
  const seen = JSON.parse(localStorage.getItem("whats-new:n_whatsnew_1") || "null");
  return seen?.seen === 1 && JSON.parse(localStorage.getItem("site-options") || "{}").calm === true;
}));

await goHome();
check("seen once, it is not shown again on the next visit", (await open().count()) === 0);
check("and the option stays on", (await site.evaluate(() => document.documentElement.getAttribute("data-site-calm"))) === "on");

/* A "What's new" link opens it. */
await site.evaluate(() => { document.body.insertAdjacentHTML("beforeend", '<a id="news-link" href="#whats-new" style="position:fixed;left:8px;top:8px;z-index:5">What\'s new</a>'); });
await site.locator("#news-link").click();
await site.waitForTimeout(300);
check("a “What's new” link opens it again, at the first step", (await open().count()) === 1 && (await visibleStep()) === 0);
await site.keyboard.press("Escape");
await site.waitForTimeout(200);
check("Escape closes it", (await open().count()) === 0);
await site.locator("#news-link").click();
await site.waitForTimeout(300);
await site.mouse.click(12, 790);
await site.waitForTimeout(200);
check("a press outside the card closes it", (await open().count()) === 0);

/* Each button does what it says. */
await site.evaluate(() => scrollTo(0, 0));
await site.locator("#news-link").click();
await site.waitForTimeout(300);
await site.locator('[data-tour-step="0"] [data-tour-action]').click();
await site.waitForTimeout(700);
check("“Copy it” closes the card and presses the real bar: the address is copied", (await open().count()) === 0 && (await site.evaluate(() => navigator.clipboard.readText().catch(() => ""))) === ADDRESS);
await site.evaluate(() => scrollTo(0, 0));
await site.locator("#news-link").click();
await site.waitForTimeout(300);
await site.locator("[data-tour-dot='2']").click();
const buyHref = await site.locator('[data-tour-step="2"] [data-tour-action]').getAttribute("href");
await site.locator('[data-tour-step="2"] [data-tour-action]').click();
await site.waitForTimeout(900);
check("“See how to buy” is a link within the site and takes the visitor to How to buy", buyHref === `#${howToBuy?.id}` && (await open().count()) === 0 && (await inView(howToBuy?.id)), `href ${buyHref}`);
check("the Buy button in the card is the real one: it links where the page's does", /pump\.fun/.test((await site.locator('[data-tour-step="2"] [data-copy-of="n_box_181"] a[href]').first().getAttribute("href").catch(() => "")) ?? ""));
check("the published page runs on its own: nothing asked of the Builder, no errors", errors.length === 0 && !outside.some((h) => h.includes("127.0.0.1") || h.includes("localhost")), errors.slice(0, 2).join(" | ") || `outside hosts: ${[...new Set(outside)].join(", ") || "none"}`);

/* On a phone. */
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await phone.route("**/*", (r) => {
  const u = new URL(r.request().url());
  if (u.host !== "published.test") return r.fulfill({ status: 200, contentType: "text/plain", body: "" });
  const p = decodeURIComponent(u.pathname).replace(/^\//, "") || "index.html";
  const f = files.find((x) => x.path === p) ?? files.find((x) => x.path === `${p}/index.html`);
  if (!f) return r.fulfill({ status: 404, body: "" });
  return r.fulfill({ status: 200, contentType: p.endsWith(".css") ? "text/css" : p.endsWith(".js") ? "text/javascript" : "text/html", body: f.content });
});
const ph = await phone.newPage();
await ph.goto("https://published.test/index.html", { waitUntil: "load" });
await settle(ph);
const fits = await ph.evaluate(() => {
  const c = document.querySelector("[data-tour-layer]:not([hidden]) [data-tour-card]")?.getBoundingClientRect();
  const b = [...document.querySelectorAll("[data-tour-step]:not([hidden]) [data-tour-action], [data-tour-next]")].map((x) => x.getBoundingClientRect());
  /* Measured as the screen shows it: a site that keeps its desktop layout is zoomed out on a phone. */
  const v = visualViewport, k = v.scale, screen = v.width * k;
  return !!c && c.left >= v.offsetLeft - 1 && c.right <= v.offsetLeft + v.width + 1 && c.width * k >= screen - 40 && b.every((r) => r.height * k >= 40);
});
check("on a phone the card fits the screen and its buttons are big enough to press", fits);
await ph.locator("[data-tour-next]").tap();
check("…and steps by touch", await ph.evaluate(() => [...document.querySelectorAll("[data-tour-step]")].findIndex((s) => !s.hidden) === 1));
await ph.screenshot({ path: `${SHOTS}/whats-new-phone.png` });

/* ------------------------------------------------------------ a new update */
await builder.bringToFront();
await builder.locator(`[data-tour-editor="${CARD}"] [data-tour-mark]`).click();
await builder.waitForTimeout(600);
const after = await builder.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.find((n) => n.featureId === "whats-new")?.tour);
check("“Mark a new update” in the side panel makes update 2 and keeps update 1 as a previous one", after?.current.id === 2 && after?.past.length === 1);
/* The owner changes the second step's button to turn the option on. */
after.current.steps[1] = { ...after.current.steps[1], action: "option", button: "Turn it on", path: "" };
await seed({ ...JSON.parse(await builder.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("builder.studio")).state))), nodes: (await builder.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes)).map((n) => (n.id === CARD ? { ...n, tour: after } : n)) });
files = await exportFiles();
await site.evaluate(() => { localStorage.removeItem("site-options"); });
await goHome();
check("a visitor who saw update 1 is shown update 2, once", (await open().count()) === 1);
await site.locator("[data-tour-past-open]").click();
await site.waitForTimeout(200);
check("“See previous updates” lists update 1's steps", (await site.locator("[data-tour-past]:not([hidden]) [data-tour-past-update='1'] li").count()) === 3);
await site.screenshot({ path: `${SHOTS}/whats-new-previous.png` });
await site.locator("[data-tour-past-close]").click();
await site.locator("[data-tour-next]").click();
await site.locator('[data-tour-step="1"] [data-tour-action]').click();
await site.waitForTimeout(200);
check("“Turn it on” turns the option on and keeps the card open", (await site.evaluate(() => document.documentElement.getAttribute("data-site-calm"))) === "on" && (await open().count()) === 1);
await site.locator("[data-tour-next]").click();
await site.locator("[data-tour-finish]").click();
await site.waitForTimeout(200);
check("Finish closes it", (await open().count()) === 0);
await goHome();
check("and update 2 is not shown again", (await open().count()) === 0);

/* Never in the way if it fails: the card's script does not load. */
const broken = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await broken.route("**/*", (r) => {
  const u = new URL(r.request().url());
  if (u.host !== "published.test" || u.pathname.endsWith("whats-new.js")) return r.fulfill({ status: 404, body: "" });
  const p = decodeURIComponent(u.pathname).replace(/^\//, "") || "index.html";
  const f = files.find((x) => x.path === p);
  if (!f) return r.fulfill({ status: 404, body: "" });
  return r.fulfill({ status: 200, contentType: p.endsWith(".css") ? "text/css" : p.endsWith(".js") ? "text/javascript" : "text/html", body: f.content });
});
const bp = await broken.newPage();
await bp.goto("https://published.test/index.html", { waitUntil: "load" });
await settle(bp);
const blocked = await bp.evaluate(() => {
  const l = document.querySelector("[data-tour-layer]");
  const hit = document.elementFromPoint(640, 400);
  return !l || l.hidden || getComputedStyle(l).display === "none" ? (hit?.closest("[data-tour-layer]") ? "covered" : "clear") : "shown";
});
check("if its script fails to load, the page is left as it was: no card over it", blocked === "clear", blocked);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
