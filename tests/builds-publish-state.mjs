#!/usr/bin/env node
/**
 * WHAT THE BUILDER SAYS ABOUT A SITE IS ABOUT THAT SITE, AND TRUE.
 *
 * The coordinator's report:
 *   1. Parasite's refused Go live ("…pic_017b184d.png is 5.1 MB even
 *      packed…") stayed red in the top bar while gotchi published, and after
 *      switching sites. A refusal now names its site, shows only on it, and
 *      ends with the next push that goes through or a switch to another site.
 *   2. On Builds, StonkFun, gotchi and Parasite said "nothing in it yet" over
 *      thousands of parts: a site too big for localStorage keeps only a
 *      pointer there, and the card read only localStorage's document. Held
 *      with a 3000-part site stored the way a big one is (pointer + IndexedDB).
 *   3. An import's toast read "×179": the steps of one progress card
 *      ("Fetching its pictures… 12 of 179") counted as repeats. Not a loop;
 *      ×N now counts only the same message said again.
 *
 *   node tests/builds-publish-state.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const errors = [];
const fresh = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/https:\/\/api\.vercel\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  return { ctx, page };
};
const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const keysIn = async (page, fill) => {
  const keys = page.locator("[data-keys-panel]");
  await page.getByRole("button", { name: "Keys", exact: true }).click(); await page.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
  for (const [s, v] of fill) await keys.locator(`[data-service="${s}"] input[type="password"]`).first().fill(v);
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await page.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click(); await page.waitForTimeout(800);
};

/* ---------------------------------------------- 2. the Builds cards */
{
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/builds`, { waitUntil: "domcontentloaded" });
  const nodes = Array.from({ length: 3000 }, (_, i) => ({ id: `n${i}`, pageId: i % 2 ? "page_home" : "page_two", featureId: "prose", label: `words ${i}`, prompt: "", content: `Line ${i}`, data: "", x: 40 + (i % 10) * 130, y: 40 + Math.floor(i / 10) * 60, w: 120, h: 40, groupId: null, options: {}, priority: "must", custom: false }));
  const big = env({ pages: [page1, { ...page1, id: "page_two", name: "Two", path: "/two" }], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes });
  await page.evaluate(async ({ big, small }) => {
    localStorage.clear();
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Small", updatedAt: Date.now() }, { id: "s2", name: "Parasite", updatedAt: Date.now() - 60000 }], activeId: "s1" }));
    localStorage.setItem("builder.studio", small);
    /* The way a site too big for the mirror is kept: its document in IndexedDB, a pointer with its counts in localStorage. */
    await new Promise((ok, no) => {
      const req = indexedDB.open("builder.docs", 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("docs")) req.result.createObjectStore("docs"); };
      req.onerror = () => no(req.error);
      req.onsuccess = () => { const tx = req.result.transaction("docs", "readwrite"); tx.objectStore("docs").put(big, "builder.doc:s2"); tx.oncomplete = () => ok(); tx.onerror = () => no(tx.error); };
    });
    localStorage.setItem("builder.doc:s2", JSON.stringify({ idb: true, bytes: big.length, pages: 2, parts: 3000, siteRepo: null }));
  }, { big, small: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [] }) });
  await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const card = page.locator("li").filter({ hasText: "Parasite" }).first();
  const text = (await card.innerText().catch(() => "")).replace(/\s+/g, " ");
  check("a big site's card counts its pages and parts, not \"nothing in it yet\"", /2 pages · 3000 parts/.test(text) && !/nothing in it yet/.test(text), text.slice(0, 120));
  /* The card's picture is one image now, made from the site off screen (tests/builds-thumbs.mjs). */
  let drawn = 0;
  for (let i = 0; i < 40 && !drawn; i++) { drawn = await card.evaluate((c) => { const i = c.querySelector("img[data-site-thumb]"); return i && i.naturalWidth ? i.naturalWidth : 0; }).catch(() => 0); if (!drawn) await page.waitForTimeout(250); }
  check("…and draws the site in its picture", drawn > 0, `picture ${drawn} px wide`);
  const small = (await page.locator("li").filter({ hasText: "Small" }).first().innerText()).replace(/\s+/g, " ");
  check("a small site's card is as it was", /1 page · 0 parts/.test(small), small.slice(0, 80));
  await ctx.close();
}

/* ---------------------------------------------- 1. a refusal belongs to its site */
{
  const { ctx, page } = await fresh();
  let fail = true;
  await page.route("**/api/studio/deploy**", (r) => r.request().method() === "GET"
    ? r.fulfill({ status: 200, contentType: "application/json", body: J(new URL(r.request().url()).searchParams.get("address") ? { ok: false } : { configured: true, source: "browser", repo: null, hook: false }) })
    : r.fulfill({ status: 200, contentType: "application/json", body: J({ ok: false, message: "stood in" }) }));
  await page.route("**/api/studio/publish", (r) => {
    if (r.request().method() !== "POST") return r.continue();
    return r.fulfill({ status: 200, contentType: "application/json", body: J(fail
      ? { ok: false, reason: "too-big", message: "“assets/pictures/pic_017b184d.png” is 5.1 MB even packed, more than one request to the Builder carries." }
      : { ok: true, repo: "him/parasite", branch: "main", files: 3, commitUrl: "https://github.example/c1", sha: "c1", deployed: false, hook: false }) });
  });
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ doc }) => {
    localStorage.clear();
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: "p", name: "Parasite", updatedAt: Date.now(), repo: { owner: "him", name: "parasite", branch: "main" } }, { id: "g", name: "Gotchi", updatedAt: Date.now() - 1000 }], activeId: "p" }));
    localStorage.setItem("builder.studio", doc);
    localStorage.setItem("builder.doc:g", doc);
  }, { doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [] }) });
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await keysIn(page, [["github", "ghp_placeholder_not_a_token_000000000000"], ["vercel", "vercel_placeholder_not_a_token_0000"]]);
  const said = () => page.evaluate(() => document.querySelector("[data-go-live-said]")?.textContent ?? null);
  await page.locator("header [data-go-live]").click({ force: true });
  let line = null;
  for (let i = 0; i < 40 && !line; i++) { await page.waitForTimeout(250); line = await said(); }
  check("a refused Go live is said beside the button, naming its site", /^Parasite: Nothing was saved: .*5\.1 MB even packed/.test(line ?? ""), J(line));
  /* A push that goes through, from another door. */
  fail = false;
  await page.evaluate(() => window.__studioPublish?.({ files: [{ path: "index.html", content: "<p>ok" }], message: "ok", deploy: false, repo: "him/parasite", branch: "main" }));
  await page.waitForTimeout(600);
  check("the next push that goes through clears it", (await said()) === null, J(await said()));
  /* Refused again, then a switch to another site. */
  fail = true;
  await page.locator("header [data-go-live]").click({ force: true });
  line = null;
  for (let i = 0; i < 40 && !line; i++) { await page.waitForTimeout(250); line = await said(); }
  await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Switch to Gotchi" }).click();
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const active = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds")).state.activeId);
  check("…and a switch to another site does not carry it there", !!line && active === "g" && (await said()) === null, `refused ${J(line)}, on ${active}, top bar ${J(await said())}`);
  await ctx.close();
}

/* ---------------------------------------------- 3. ×N counts repeats, not steps */
{
  const { ctx, page } = await fresh();
  const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const N = 12;
  const pics = Array.from({ length: N }, (_, i) => ({ id: `pic_t${i}`, path: `assets/pictures/pic_t${i}.png` }));
  const DOC = { pages: [page1], activePageId: "page_home", brief: { name: "Many Pictures", gimmick: "", master: "" }, nodes: pics.map((p, i) => ({ id: `n${i}`, pageId: "page_home", featureId: "picture", label: `p${i}`, prompt: "", content: "", data: "", x: 20, y: 20 + i * 90, w: 80, h: 80, groupId: null, options: {}, priority: "must", custom: false, picture: { ...p, type: "image/png", w: 1, h: 1, bytes: 70, alt: "", from: "upload" } })) };
  await page.route("https://api.github.com/**", (r) => {
    const u = new URL(r.request().url());
    const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: J(b) });
    if (u.pathname === "/repos/him/many") return j({ default_branch: "main", homepage: "" });
    if (u.pathname.startsWith("/repos/him/many/git/trees/")) return j({ tree: [{ path: "package.json", type: "blob", sha: "k", size: 10 }, { path: "site/document.json", type: "blob", sha: "d", size: 1000 }, ...pics.map((p, i) => ({ path: p.path, type: "blob", sha: `b${i}`, size: 70 }))] });
    if (u.pathname === "/repos/him/many/git/blobs/d") return j({ encoding: "base64", content: Buffer.from(J(DOC)).toString("base64") });
    if (/^\/repos\/him\/many\/git\/blobs\/b\d+$/.test(u.pathname)) return j({ encoding: "base64", content: PNG });
    return j({ message: "no" }, 404);
  });
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { localStorage.clear(); const env = (s) => JSON.stringify({ state: s, version: 0 }); localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Scratch", updatedAt: Date.now() }], activeId: "s1" })); localStorage.setItem("builder.studio", env({ nodes: [] })); });
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await keysIn(page, [["github", "not-a-token-placeholder-xxxx"]]);
  await page.evaluate(() => { window.__badges = []; new MutationObserver(() => { for (const e of document.querySelectorAll(".animate-toast-in")) { const b = [...e.querySelectorAll("span")].map((s) => s.textContent).find((t) => /^×\d+$/.test(t ?? "")); if (b) window.__badges.push(`${e.textContent.slice(0, 40)} ${b}`); } }).observe(document.body, { subtree: true, childList: true, characterData: true }); });
  await page.locator("[data-bring-repo]").first().click(); await page.waitForTimeout(600);
  await page.locator("[data-repo-bring]").fill("him/many");
  await page.locator("[data-repo-pull]").click();
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => /copied whole|Many Pictures/.test(document.body.innerText))) break; }
  await page.waitForTimeout(1000);
  const badges = await page.evaluate(() => window.__badges);
  check(`an import's ${N} picture steps on one card are not counted as repeats`, badges.length === 0, J([...new Set(badges)].slice(-3)));
  await ctx.close();
}
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
