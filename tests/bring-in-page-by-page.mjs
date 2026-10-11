#!/usr/bin/env node
/**
 * A SITE OF ANY SIZE, ON ANY BRANCH, IS READ ONE PAGE A REQUEST.
 *
 * J, 2026-10-11: he brought sparkygogo77-spec/PST@claude/elaborate-redesign
 * in, an unmerged branch, and got "Nothing came back within 45 seconds".
 * The branch was read from GitHub fine; the zip route then read all six of
 * its pages (1,800 parts) in one request, which took 27 seconds here and
 * longer on the host, past the browser's 45-second deadline. Now the first
 * page is read alone, the route names the others, and each is a request
 * of its own with its own deadline, the strip counting them.
 *
 * Here, through the real door, with GitHub a stand-in in the browser: a
 * three-page site on a branch named with `@`, without a builder.json.
 *
 *   1. the zip route is asked once per page: three requests, each for one
 *      page, in the site's order (the first naming the other two);
 *   2. all three pages land on the board with their parts;
 *   3. the strip counted the pages as it read them;
 *   4. the branch named with `@` is the one read, and is what the board
 *      records as its source.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/bring-in-page-by-page.mjs http://127.0.0.1:3013
 *
 * Covers: src/app/api/studio/zip/route.ts, src/features/studio/bring-in/fromasite/FromASite.tsx
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`); };
const J = (x) => JSON.stringify(x);
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

const pageOf = (name, title, words) => `<!doctype html><html><head><title>${title}</title><link rel="stylesheet" href="site.css"></head><body data-hook="app-${name}">
<header data-hook="top-${name}"><h1 data-hook="title-${name}">${title}</h1><nav data-hook="nav-${name}"><a data-hook="to-index-${name}" href="index.html">Home</a> <a data-hook="to-about-${name}" href="about.html">About</a> <a data-hook="to-work-${name}" href="work.html">Work</a></nav></header>
<main data-hook="main-${name}"><p data-hook="words-${name}">${words}</p><button data-hook="go-${name}">Go</button></main></body></html>`;
const FILES = {
  "web/site.css": "body{margin:0;font:16px/1.4 sans-serif}header,main{padding:24px}h1{font-size:40px}button{padding:8px 16px}",
  "web/index.html": pageOf("index", "Blackorb", "A small studio."),
  "web/about.html": pageOf("about", "About us", "Two people and a dog."),
  "web/work.html": pageOf("work", "Our work", "Sites, mostly."),
};
const names = Object.keys(FILES);
const BRANCH = "claude/elaborate-redesign";
const SHA = "b".repeat(40);
const errors = [];
const treesAsked = [];

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: J(b) });
  if (!u.pathname.startsWith("/repos/him/branchy")) return j({ message: "no" }, 404);
  const rest = u.pathname.slice("/repos/him/branchy".length);
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) {
    const ref = decodeURIComponent(rest.slice("/git/trees/".length).split("?")[0]);
    treesAsked.push(ref);
    /* Only the branch has the site; main has nothing to read. */
    if (ref !== BRANCH) return j({ tree: [{ path: "README.md", type: "blob", sha: "r0", size: 3 }] });
    return j({ tree: names.map((n, i) => ({ path: n, type: "blob", sha: `f${i}`, size: FILES[n].length })) });
  }
  const b = /\/git\/blobs\/f(\d+)$/.exec(rest);
  if (b) return j({ encoding: "base64", content: Buffer.from(FILES[names[Number(b[1])]]).toString("base64") });
  if (rest.startsWith("/commits/")) return j({ sha: SHA });
  if (rest.startsWith("/git/ref/heads/")) return j({ object: { sha: SHA } });
  return j({ message: "no" }, 404);
});

/* Every ask of the zip route for parts: which page it was for, and whether it was for that page alone. */
const zipAsks = [];
page.on("request", (req) => {
  if (!req.url().includes("/api/studio/zip") || req.method() !== "POST") return;
  const body = req.postData() ?? "";
  const field = (k) => { const m = new RegExp(`name="${k}"\\r?\\n\\r?\\n([^\\r\\n]*)`).exec(body); return m ? m[1] : null; };
  if (field("parts") === "1") zipAsks.push({ entry: field("entry"), only: field("only"), pages: field("pages"), dir: field("dir") });
});
const strips = new Set();
const env = (s) => J({ state: s, version: 0 });
await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(({ doc, builds }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, { doc: env({ nodes: [] }), builds: env({ projects: [{ id: "s1", name: "Scratch", updatedAt: Date.now() }], activeId: "s1" }) });
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const strip = () => page.evaluate(() => document.querySelector("[data-import-strip]")?.textContent ?? "");
const until = async (fn, ms = 120000) => { for (let t = 0; t < ms; t += 400) { strips.add(await strip()); if (await fn()) return true; await page.waitForTimeout(400); } return false; };
const byHook = (s, h) => (s.nodes ?? []).find((n) => n.hooks?.["data-hook"] === h);

/* The key, a stand-in; then the branch is brought in by name. */
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click(); await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("STANDIN_GITHUB_TOKEN_placeholder");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click(); await page.waitForTimeout(1500);
await page.locator("[data-bring-repo]").first().click(); await page.waitForTimeout(600);
await page.locator("[data-repo-bring]").fill(`him/branchy@${BRANCH}`);
await page.locator("[data-repo-pull]").click();

const landed = await until(async () => { const s = await state(); return !!byHook(s, "go-index") && !!byHook(s, "go-about") && !!byHook(s, "go-work"); });
check("the three pages land, part by part", landed, J({ hooks: (await state()).nodes?.map((n) => n.hooks?.["data-hook"]).slice(0, 12), strip: await strip() }));
await page.waitForTimeout(1500);
const s = await state();

check("1. the zip route was asked once per page, each for that page alone", zipAsks.length === 3 && zipAsks.every((a) => a.only === "1"), J(zipAsks));
check("…in the site's order, the first naming no page list and the others one page each from the site's folder", zipAsks[0]?.pages === null && zipAsks[1]?.entry === "web/about.html" && zipAsks[1]?.pages === "[]" && zipAsks[1]?.dir === "web/" && zipAsks[2]?.entry === "web/work.html", J(zipAsks));
const pages = s.pages ?? [];
check("2. three pages are on the board", pages.length === 3, J(pages.map((p) => p.name ?? p.id)));
const onPage = (h) => pages.findIndex((p) => p.id === byHook(s, h)?.pageId);
check("…each page's parts are on their own page, in the site's order", onPage("title-index") === 0 && onPage("title-about") === 1 && onPage("title-work") === 2 && onPage("words-work") === 2, J({ index: onPage("title-index"), about: onPage("title-about"), work: onPage("title-work") }));
check("…with the page's words", /Two people and a dog/.test(J(byHook(s, "words-about")?.content)) && /Sites, mostly/.test(J(byHook(s, "words-work")?.content)), J({ about: byHook(s, "words-about")?.content, work: byHook(s, "words-work")?.content }));
check("3. the strip counted the pages as it read them", [...strips].some((t) => /Reading page 2 of 3 in branchy: web\/about\.html/.test(t)) && [...strips].some((t) => /Reading page 3 of 3/.test(t)), J([...strips].filter((t) => /Reading page/.test(t)).slice(0, 4)));
const said = await strip();
check("…and the line says what landed, with nothing left out", /parts from him\/branchy@claude\/elaborate-redesign landed/.test(said) && !/would not open|not read/.test(said), said.slice(0, 300));
check("4. the branch named with @ is the one read", treesAsked.length > 0 && treesAsked.every((r) => r === BRANCH), J(treesAsked));
check("…and is recorded as the board's source", s.look?.styleSource?.ref === BRANCH && s.look?.styleSource?.repo === "him/branchy", J(s.look?.styleSource && { repo: s.look.styleSource.repo, ref: s.look.styleSource.ref }));
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
