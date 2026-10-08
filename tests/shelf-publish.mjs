/**
 * Every shelf item that says "Works when published" works when published
 * (Lane I, 4).
 *
 * A scratch board is made with one of each: every card and every version
 * whose badge is Works when published, the part versions as parts and the
 * library features on a line of text each. It is exported through the real
 * door (`__studioExport`, what Publish sends), and then:
 *
 *   · the exported page carries what each needs to run: the part itself,
 *     drawn and not empty; the whole-site motion's settings and
 *     `assets/site-motion.js`; the part's entry in `#site-parts` and
 *     `assets/parts.js`; the keyframes its style names; the browser's fade
 *     between pages; a library feature's binding and its script;
 *   · served, it does it: folding rows fold, tabs switch, Copy says so, the
 *     scroll bar fills, Back to top comes, parts below the fold arrive, the
 *     ticker's keyframes are there; and nothing throws;
 *   · nothing that is not meant for a visitor is published: no note for the
 *     builder, no "described, not simulated" line, no frozen opening wipe.
 *
 *   node tests/shelf-publish.mjs http://localhost:3000
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { FEATURES } from "../src/features/studio/shelf/catalog.ts";
import { SHELF_GROUPS, isWorkKey, workIdOf } from "../src/features/studio/shelf/shelfGroups.ts";
import { VARIANTS, publishOf } from "../src/features/studio/shelf/shelfPlan.ts";
import { statusOf, isExample } from "../src/features/studio/shelfFacts.ts";
import { LIBRARY, inputsOf } from "../src/features/studio/shelf/library/works.ts";
import { PART_KINDS } from "../src/features/studio/shelf/library/siteMotion.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SHOTS = ".screenshots/lane-i";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const rows = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------ what works */
const byId = new Map(FEATURES.map((f) => [f.id, f]));
const workOf = (k) => LIBRARY.find((w) => w.manifest.id === workIdOf(k));
const statusOfKey = (k) => (isWorkKey(k) ? statusOf(k, workOf(k)?.manifest.needs) : statusOf(k));
const keys = [...new Set(Object.values(SHELF_GROUPS).flatMap((gs) => gs.flatMap((g) => g.items)).flatMap((k) => [k, ...(VARIANTS[k]?.more.map((m) => m.key) ?? [])]))];
const works = keys.filter((k) => statusOfKey(k) === "works");
const notes = keys.filter((k) => statusOfKey(k) === "note");

/* A value for inputs a feature cannot run without, never a secret: a public address and a public page. */
/* A whole brief, as the Builder keeps one: the sample site's, renamed. */
const SAMPLE = JSON.parse(readFileSync(new URL("../site/document.json", import.meta.url), "utf8"));
const REQUIRED = { mint: "So11111111111111111111111111111111111111112", url: "https://example.com/" };

let y = 0;
const nodes = [];
const idOf = new Map();
const base = (id, featureId, extra = {}) => ({
  id, pageId: "p_home", featureId, label: byId.get(featureId)?.name ?? featureId, prompt: "", content: "", data: "", x: 0, y: 0, w: 900, h: 160,
  groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, cube: null, mesh: null, vector: null,
  role: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...extra,
});
/* The Opening banner first: it is the part the side panel check picks, and the board draws what is near the top. */
for (const k of [...works.filter((k) => k === "hero-split"), ...works.filter((k) => k !== "hero-split"), ...notes]) {
  const id = `n_${k.replace(/[^a-z0-9]/gi, "_")}`;
  idOf.set(k, id);
  if (isWorkKey(k)) {
    const w = workOf(k);
    const inputs = inputsOf(w.manifest, Object.fromEntries(w.manifest.inputs.filter((i) => i.required).map((i) => [i.id, REQUIRED[i.id] ?? "x"])));
    nodes.push(base(id, "prose", { content: w.manifest.look.sample || "A line of text", work: { id: w.manifest.id, inputs }, y, w: 600, h: 60 }));
    y += 100;
    continue;
  }
  const f = byId.get(k);
  const ph = f.content?.placeholder ?? "";
  const w = Math.min(1440, f.w ?? 600);
  const h = Math.min(520, Math.max(48, f.h ?? 120));
  nodes.push(base(id, k, { content: ph && isExample(ph) ? ph : f.content ? "First, Second, Third" : "", label: f.name, y, w, h }));
  y += h + 40;
}
/* A second page, so the fade between pages has somewhere to go. */
const doc = {
  pages: [{ id: "p_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }, { id: "p_two", name: "Two", path: "/two", prompt: "", scroll: "inherit" }],
  nodes: [...nodes, base("n_two_text", "prose", { pageId: "p_two", content: "The second page." })],
  groups: [], shapes: [], format: { "pages.transition": "fade" }, brief: { ...SAMPLE.brief, name: "Scratch" }, look: {}, frameWidth: 1440,
};

/* ------------------------------------------------------------ export */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route("**/api/tweets/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false }, configured: false, source: null }) }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(({ state }) => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "b1", name: "Scratch", updatedAt: Date.now() }], activeId: "b1" }));
  localStorage.setItem("builder.studio", env({ ...state, activePageId: "p_home" }));
}, { state: doc });
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.__studioExport === "function", null, { timeout: 60000 });
await page.waitForTimeout(1500);
const files = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: f.encoding ? "" : f.content })));
const file = (p) => files.find((f) => f.path === p)?.content ?? "";
const home = file("index.html");
const css = file("assets/site.css");
check("the scratch board exported", home.length > 0 && css.length > 0, `${files.length} files, ${works.length} items that say they work`);

const json = (id) => { const m = new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)</script>`).exec(home); return m ? JSON.parse(m[1]) : null; };
const motion = json("site-motion");
const parts = json("site-parts") ?? [];
const bindings = json("site-features") ?? [];

/* ------------------------------------------------------------ serve it */
const site = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
site.on("pageerror", (e) => errors.push(e.message));
await site.route("http://published.test/**", (r) => {
  const p = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\//, "") || "index.html";
  const f = files.find((x) => x.path === p) ?? files.find((x) => x.path === `${p}/index.html`) ?? files.find((x) => x.path === `${p}.html`);
  if (!f) return r.fulfill({ status: 404, body: "" });
  const type = p.endsWith(".css") ? "text/css" : p.endsWith(".js") ? "text/javascript" : p.endsWith(".json") ? "application/json" : "text/html";
  return r.fulfill({ status: 200, contentType: type, body: f.content });
});
await site.route(/^https?:\/\/(?!published\.test)/, (r) => r.fulfill({ status: 200, contentType: "text/plain", body: "" }));
await site.goto("http://published.test/index.html", { waitUntil: "load" });
await site.waitForTimeout(1200);
await site.screenshot({ path: `${SHOTS}/publish-top.png` });

/* ------------------------------------------------------------ each item */
const drawn = await site.evaluate((ids) => Object.fromEntries(ids.map((id) => {
  const el = document.getElementById(id);
  if (!el) return [id, { there: false }];
  const r = el.getBoundingClientRect();
  const ink = (el.textContent ?? "").trim().length + el.querySelectorAll("img, svg, canvas, video, iframe, [style*='background']").length;
  return [id, { there: true, h: Math.round(r.height), ink }];
})), [...idOf.values()]);

for (const k of works) {
  const id = idOf.get(k);
  const p = publishOf(k);
  const d = drawn[id] ?? { there: false };
  let ok = false;
  let what = "";
  if (p.kind === "draws") { ok = d.there && d.h > 0 && d.ink > 0; what = `drawn, ${d.h}px tall, ${d.ink} things on it`; }
  else if (p.by === "site-motion") {
    const flag = { "scroll-progress": "progress", "back-to-top": "backToTop", "reveal-on-scroll": "reveal", parallax: "parallax", "smooth-scroll": "smooth", "scroll-snap": "snap", "page-load": "intro", "cursor-effects": "cursor", "hover-tilt": "tilt" }[k];
    ok = !!motion?.[flag] && !!file("assets/site-motion.js");
    what = `#site-motion ${flag} = ${JSON.stringify(motion?.[flag])}`;
  } else if (p.by === "parts") {
    ok = parts.some((x) => x.part === id && x.kind === PART_KINDS[k]) && !!file("assets/parts.js") && d.there && d.ink > 0;
    what = `#site-parts ${PART_KINDS[k]}`;
  } else if (p.by === "keyframes") {
    ok = /@keyframes marquee-scroll/.test(css) && d.there && d.ink > 0;
    what = "keyframes in site.css";
  } else if (p.by === "view-transition") {
    ok = /@view-transition\s*{\s*navigation:\s*auto/.test(css);
    what = "the browser's fade in site.css";
  } else if (p.by === "work") {
    const wid = workIdOf(k);
    ok = bindings.some((b) => b.part === id && b.feature === wid) && !!file(`assets/features/${wid}.js`) && /siteFeatures\.define/.test(file(`assets/features/${wid}.js`));
    what = `binding and assets/features/${wid}.js`;
  }
  rows.push({ item: k, how: p.kind === "runs" ? `runs (${p.by})` : p.kind, ok });
  check(`${k} works published`, ok, what);
}

/* ------------------------------------------------------------ does it */
const folds = FEATURES.filter((f) => PART_KINDS[f.id] === "fold" && idOf.has(f.id));
for (const f of folds) {
  const id = idOf.get(f.id);
  const r = await site.evaluate(async (id) => {
    const root = document.getElementById(id);
    const heads = [...root.querySelectorAll("button[aria-expanded]")];
    if (heads.length < 2) return { heads: heads.length };
    heads[1].click();
    await new Promise((r) => setTimeout(r, 50));
    const body = document.getElementById(heads[1].getAttribute("aria-controls"));
    return { heads: heads.length, open: heads[1].getAttribute("aria-expanded"), shown: body ? !body.hidden : false, firstShut: heads[0].getAttribute("aria-expanded") };
  }, id);
  check(`${f.id}: a press opens a row and shuts the other`, r.open === "true" && r.shown && r.firstShut === "false", JSON.stringify(r));
}
if (idOf.has("tabs-panel")) {
  const r = await site.evaluate(async (id) => {
    const root = document.getElementById(id);
    const tabs = [...root.querySelectorAll("[role=tab]")];
    tabs[1].click();
    await new Promise((r) => setTimeout(r, 50));
    const panels = [...root.querySelectorAll("[role=tabpanel]")];
    return { tabs: tabs.length, picked: tabs[1].getAttribute("aria-selected"), shown: panels.map((p) => !p.hidden) };
  }, idOf.get("tabs-panel"));
  check("tabs: a press shows the second panel and hides the first", r.picked === "true" && r.shown[1] === true && r.shown[0] === false, JSON.stringify(r));
}
for (const k of ["copy-button", "code-block"].filter((k) => idOf.has(k))) {
  const said = await site.evaluate(async (id) => {
    const b = document.getElementById(id).querySelector("button");
    b.click();
    await new Promise((r) => setTimeout(r, 150));
    return b.textContent;
  }, idOf.get(k));
  check(`${k}: Copy copies and says so`, /Copied/.test(said ?? ""), said);
}
if (motion?.progress) {
  const before = await site.evaluate(() => document.querySelector("[role=progressbar][aria-label='Reading progress']")?.getAttribute("aria-valuenow"));
  /* Instantly: the page may glide (smooth scrolling is on the board too), and the bar is read where the scroll ends. */
  await site.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await site.waitForTimeout(400);
  const after = await site.evaluate(() => ({
    bar: document.querySelector("[role=progressbar][aria-label='Reading progress']")?.getAttribute("aria-valuenow"),
    back: getComputedStyle(document.querySelector("button[aria-label='Back to top']") ?? document.body).display,
  }));
  check("scroll progress: the bar fills as the page scrolls", Number(after.bar) > 90 && Number(before ?? 0) < 10, `${before} → ${after.bar}`);
  check("back to top: the button comes once scrolled", after.back === "block", after.back);
  await site.screenshot({ path: `${SHOTS}/publish-scrolled.png` });
}
if (motion?.reveal) {
  const r = await site.evaluate(async () => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const parts = JSON.parse(document.getElementById("site-motion").textContent).parts.map((id) => document.getElementById(id)).filter(Boolean);
    const low = parts.find((p) => p.getBoundingClientRect().top > window.innerHeight * 3);
    return low ? low.id : null;
  });
  const shown = r ? await site.evaluate(async (id) => {
    const el = document.getElementById(id);
    el.scrollIntoView({ behavior: "instant" });
    await new Promise((r) => setTimeout(r, 1500));
    return getComputedStyle(el).opacity;
  }, r) : null;
  check("appear on scroll: a part below the fold arrives as it is reached", shown === "1", `${r}: opacity ${shown}`);
}
if (idOf.has("marquee")) {
  const r = await site.evaluate((id) => {
    const moving = [...document.getElementById(id).querySelectorAll("*")].find((e) => getComputedStyle(e).animationName === "marquee-scroll");
    const rule = [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((c) => c.name === "marquee-scroll"); } catch { return false; } });
    return { moving: !!moving, rule };
  }, idOf.get("marquee"));
  check("the ticker runs on keyframes the page has", r.moving && r.rule, JSON.stringify(r));
}
check("nothing throws on the published page", errors.length === 0, errors.slice(0, 3).join(" | "));

/* ------------------------------------------------------------ not for visitors */
const noteWords = notes.map((k) => byId.get(k)?.name).filter(Boolean);
const leaked = await site.evaluate((ids) => ids.filter((id) => { const el = document.getElementById(id); return el && (el.textContent ?? "").trim().length > 0; }), notes.map((k) => idOf.get(k)));
check("a note for the builder is never on the published page", leaked.length === 0, leaked.join(", ") || noteWords.join(", "));
check("no line about how the preview works is published", !/Described, not simulated/.test(home));
check("no opening wipe is frozen into the markup", !/mo-wipe/.test(home));

/* ------------------------------------------------------------ editing a version */
/*
 * The side panel reads a part's fields from data (`partOptions.ts`): pick the
 * Opening banner on the board, choose another version in its panel, and the
 * board and the export both change with it.
 */
{
  const id = idOf.get("hero-split");
  const part = page.locator(`[data-node-id="${id}"]`).first();
  await part.scrollIntoViewIfNeeded();
  await part.click({ force: true });
  await page.waitForTimeout(800);
  const chip = page.locator('[data-part-fields] [data-field="version"] [data-value="Over a colour wash"]').first();
  const offered = await chip.count();
  check("the side panel offers the picked part's versions", offered === 1);
  if (offered) {
    await chip.click();
    await page.waitForTimeout(800);
    const now = await page.evaluate((id) => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? []).find((n) => n.id === id)?.featureId, id);
    check("choosing one changes the part on the board", now === "hero-gradient", now);
    const drawnAs = await page.locator(`[data-node-id="${id}"] [data-part]`).first().getAttribute("data-part").catch(() => null);
    check("and the board draws the new version", drawnAs === "hero-gradient", drawnAs ?? "none");
    const again = await page.evaluate(async () => (await window.__studioExport()).find((f) => f.path === "index.html")?.content ?? "");
    const at = again.indexOf(`id="${id}"`);
    const next = again.indexOf(' id="n_', at + 5);
    const own = at >= 0 ? again.slice(at, next > at ? next : undefined) : "";
    check("and the export carries it", /radial-gradient/.test(own), `${own.length} characters of its markup`);
    await page.screenshot({ path: `${SHOTS}/publish-version-picked.png` });
  }
}

console.log("\n  item | published | result");
for (const r of rows) console.log(`  ${r.item} | ${r.how} | ${r.ok ? "ok" : "FAIL"}`);
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
