/**
 * Home is the page on "/", in the export and in Preview alike, and no two
 * pages are ever written to one file.
 *
 * Measured before this: move About above Home in the Pages tab and the
 * export made About the site's index.html (home was "the first page") and
 * put Home at page_home/index.html, while Preview's "/" still opened Home.
 * Two pages typed onto one route were both written to that route's file,
 * the second over the first. THE DECISION: Home is the page whose route is
 * "/"; when no page has "/", the first page. One function says so
 * (`homePage.ts`) and the export, Preview and page links all ask it.
 *
 * Every case is a document put in storage, then the Builder's own export
 * (`window.__studioExport`) and its Preview:
 *   A. About /about, Home /, Docs /docs — index.html is Home, about/ is
 *      About, Preview "/" is Home, a link to "home" from About reaches it;
 *   B. no page on "/" — the first page is index.html and Preview's "/";
 *   C. two pages on /docs, and two on "/" — every page gets a file of its
 *      own, nothing written twice, and the "/" that is Home is index.html.
 *
 *   node tests/home-page.mjs [url]
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await context.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));

const part = (id, pageId, words, link = null) => ({
  id, pageId, featureId: "prose", label: id, prompt: "", content: words, data: "", x: 80, y: 80, w: 500, h: 40,
  groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
/** Pages as [id, name, path]; each carries one part saying "words of <id>". */
async function site(pages, links = {}) {
  const doc = {
    pages: pages.map(([id, name, path]) => ({ id, name, path, prompt: "", scroll: "inherit" })),
    nodes: pages.map(([id]) => part(`n_${id}`, id, `words of ${id}.`, links[id] ?? null)),
    groups: [], shapes: [], format: {}, brief: { name: "Site", gimmick: "", master: "" }, frameWidth: 1400, activePageId: pages[0][0], trail: [],
  };
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.evaluate(async (d) => {
    localStorage.clear();
    for (const x of (await indexedDB.databases?.()) ?? []) indexedDB.deleteDatabase(x.name);
    localStorage.setItem("builder.studio", JSON.stringify({ state: d, version: 0 }));
  }, doc);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const files = (await page.evaluate(async () => (await window.__studioExport?.()) ?? [])).filter((f) => f.path.endsWith(".html"));
  const pv = await context.newPage();
  await pv.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
  await pv.waitForTimeout(800);
  const root = await pv.locator("[data-live-page]").first().innerText().catch(() => "");
  await pv.close();
  const holder = (id) => files.filter((f) => f.content.includes(`words of ${id}.`)).map((f) => f.path);
  return { files, root, holder };
}

/* A */
let s = await site([["about", "About", "/about"], ["home", "Home", "/"], ["docs", "Docs", "/docs"]], { about: { kind: "page", target: "home" } });
check("A: Home, on /, is the site's index.html though About is listed first", JSON.stringify(s.holder("home")) === '["index.html"]', `Home in ${s.holder("home").join(", ")}; index.html holds ${s.files.find((f) => f.path === "index.html")?.content.match(/words of \w+/)?.[0]}`);
check("A: About is about/index.html", JSON.stringify(s.holder("about")) === '["about/index.html"]', s.holder("about").join(", "));
check("A: Preview's / opens Home too", /words of home/.test(s.root), s.root.slice(0, 60));
const about = s.files.find((f) => f.path === "about/index.html")?.content ?? "";
/* Pages are served at clean addresses (/about, no trailing slash: vercel.json), so "./" from /about is "/". */
const href = [...about.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1]);
check("A: a link to \"home\" from About reaches Home's address", JSON.stringify(href) === '["./"]', href.join(" ") || "no link");

/* B */
s = await site([["intro", "Intro", "/intro"], ["more", "More", "/more"]]);
check("B: no page on / — the first page is index.html", JSON.stringify(s.holder("intro")) === '["index.html"]', s.holder("intro").join(", "));
check("B: …and Preview's /", /words of intro/.test(s.root), s.root.slice(0, 60));

/* C */
s = await site([["home", "Home", "/"], ["docs", "Docs", "/docs"], ["docs2", "Docs", "/docs"], ["root2", "Also root", "/"]]);
const paths = s.files.map((f) => f.path);
check("C: four pages, four files", paths.length === 4, paths.join(" "));
check("C: no file written twice", new Set(paths).size === paths.length, paths.join(" "));
check("C: every page's words are in exactly one file", ["home", "docs", "docs2", "root2"].every((id) => s.holder(id).length === 1), ["home", "docs", "docs2", "root2"].map((id) => `${id}:${s.holder(id).join("+") || "none"}`).join(" "));
check("C: the first page on / is Home, at index.html", JSON.stringify(s.holder("home")) === '["index.html"]', s.holder("home").join(", "));
check("no page error", errors.length === 0, errors.join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
