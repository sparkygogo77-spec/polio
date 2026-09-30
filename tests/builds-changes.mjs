#!/usr/bin/env node
/**
 * AFTER UPDATE LIVE SITE: WHERE IT WENT, AND WHETHER THERE IS MORE TO SEND.
 *
 * Lane H, items 3 and 4.
 *   4. After Update live site, the top bar's "Live ✓ at <time>" has two
 *      links beside it, to the Vercel deployment and to the GitHub commit
 *      the publish just made, each opening in a new tab. Both come from
 *      what the publish answered: one push and one deploy request per press,
 *      nothing asked of Vercel or GitHub beyond them.
 *   3. The Builds page card says whether the Builder has changes not yet
 *      published: "Everything is published" straight after, and "Changes not
 *      published yet: last change <time>, last publish <time>" after one
 *      more edit; "Not published yet" for a site that never was. The card
 *      carries the same two links. The page stays light: none of this reads
 *      a document, calls a route, or draws the live preview.
 *
 * The Builder's own routes are answered in the browser (Playwright's route),
 * so nothing reaches GitHub or Vercel and no token exists.
 * Screenshots: .screenshots/lane-h/publish-links-bar.png,
 * builds-card-published.png, builds-card-changes.png.
 *
 *   npx next start -p 3013
 *   node tests/builds-changes.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SHOTS = ".screenshots/lane-h";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const COMMIT = "https://github.com/him/site/commit/abc1234def";
const INSPECT = "https://vercel.com/him/site/dpl_lane_h";
const calls = { push: 0, deploy: 0, outside: [] };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
await page.route(/https:\/\/(api\.)?(vercel|github)\.com\/.*/, (r) => { calls.outside.push(r.request().url()); return r.fulfill({ status: 404, contentType: "application/json", body: "{}" }); });
await page.route("**/api/studio/publish**", async (r) => {
  const req = r.request();
  const url = new URL(req.url());
  if (req.method() === "GET") return url.searchParams.get("tree") ? json(r, { ok: false, tree: [] }) : json(r, { github: { configured: true, token: "server", repo: null, branch: "main", missing: [] }, vercel: { hook: false } });
  calls.push++;
  return json(r, { ok: true, sha: "abc1234def", commitUrl: COMMIT, branch: "main", repo: "him/site", files: 3, deployed: false, hook: false, changed: 3, total: 3 });
});
await page.route("**/api/studio/deploy**", async (r) => {
  const req = r.request();
  const url = new URL(req.url());
  if (req.method() === "GET") {
    if (url.searchParams.get("address")) return json(r, { ok: false });
    if (url.searchParams.get("id")) return json(r, { ok: true, state: "READY", done: true, url: "https://site-live.vercel.app", inspectorUrl: INSPECT });
    return json(r, { configured: true, source: "server", repo: null, hook: false });
  }
  calls.deploy++;
  return json(r, { ok: true, id: "dpl_lane_h", project: "site", repo: "him/site", branch: "main", team: null, state: "QUEUED", url: null, inspectorUrl: INSPECT });
});

const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const words = { id: "n_words", pageId: "page_home", featureId: "prose", label: "", prompt: "", content: "Words to publish", data: "", x: 120, y: 120, w: 300, h: 60, groupId: null, options: {}, priority: "must", custom: false };
await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(({ doc, builds, never }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); localStorage.setItem("builder.doc:s2", never); }, {
  builds: env({ projects: [{ id: "s1", name: "Site One", updatedAt: Date.now(), nudged: true, repo: { owner: "him", name: "site", branch: "main" } }, { id: "s2", name: "Never Out", updatedAt: Date.now() - 60000, editedAt: Date.now() - 60000 }], activeId: "s1" }),
  doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [words] }),
  never: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [words] }),
});
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__studioHistory, null, { timeout: 20000 });
/* An edit before publishing: the site has a last change to compare. */
await page.evaluate(() => window.__studioHistory.act("updateNode", "n_words", { content: "Words to publish, edited" }));
await page.waitForTimeout(1500);

/* ------------------------------------------------ 4. the top bar after Update live site */
const bar = () => page.locator("header [data-go-live]").first();
for (let i = 0; i < 40 && (await bar().getAttribute("data-go-live-state")) === "checking"; i++) await page.waitForTimeout(250);
calls.outside.length = 0;
await bar().click();
await page.waitForTimeout(600);
for (let i = 0; i < 120 && (await bar().getAttribute("data-go-live-state")) === "busy"; i++) await page.waitForTimeout(250);
await page.waitForTimeout(600);
{
  const live = await page.evaluate(() => {
    const step = document.querySelector("header [data-go-live-step='live']");
    const a = (sel) => { const el = document.querySelector(`header ${sel}`); return el ? { href: el.getAttribute("href"), target: el.getAttribute("target"), rel: el.getAttribute("rel"), text: el.textContent.trim() } : null; };
    return { step: step?.textContent ?? null, deployment: a("[data-publish-deployment]"), commit: a("[data-publish-commit]") };
  });
  check("the bar says Live ✓ with the time", /^Live ✓ at \d/.test(live.step ?? ""), J(live.step));
  check("a link to the Vercel deployment, in a new tab", live.deployment?.href === INSPECT && live.deployment.target === "_blank" && /noopener/.test(live.deployment.rel ?? "") && /Vercel deployment/.test(live.deployment.text), J(live.deployment));
  check("a link to the GitHub commit it made, in a new tab", live.commit?.href === COMMIT && live.commit.target === "_blank" && /GitHub commit/.test(live.commit.text), J(live.commit));
  check("one push and one deploy request, nothing more", calls.push === 1 && calls.deploy === 1, J({ push: calls.push, deploy: calls.deploy }));
  check("nothing asked of Vercel or GitHub directly from the page", calls.outside.length === 0, J(calls.outside.slice(0, 3)));
  await page.screenshot({ path: `${SHOTS}/publish-links-bar.png`, clip: { x: 560, y: 0, width: 880, height: 60 } });
}
const record = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds")).state.projects.find((p) => p.id === "s1"));
check("the site keeps the commit and the deployment it made", record.published?.commitUrl === COMMIT && record.published?.sha === "abc1234def" && record.live?.inspectorUrl === INSPECT, J({ published: record.published, live: record.live }));
check("and the board's last change the push carried", typeof record.published?.editedAt === "number" && record.published.editedAt === record.editedAt, J({ carried: record.published?.editedAt, edited: record.editedAt }));

/* ------------------------------------------------ 3. the Builds cards */
const builds = async () => {
  const asked = [];
  /* The top bar's Go live asks which keys are set (a GET with no question) on every page, as it did before; anything more is this page's. */
  const note = (r) => { const u = new URL(r.url()); if (/\/api\/studio\/(publish|deploy)/.test(u.pathname) && (r.method() !== "GET" || u.search)) asked.push(`${r.method()} ${u.pathname}${u.search}`); };
  page.on("request", note);
  await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  page.off("request", note);
  const card = (name) => page.locator("[data-builds-list] > li", { hasText: name }).first();
  const read = async (name) => ({
    kind: await card(name).locator("[data-card-changes]").getAttribute("data-card-changes"),
    says: (await card(name).locator("[data-card-changes]").innerText()).trim(),
    deployment: await card(name).locator("[data-publish-deployment]").getAttribute("href").catch(() => null),
    commit: await card(name).locator("[data-publish-commit]").getAttribute("href").catch(() => null),
    targets: await card(name).locator("[data-publish-links] a").evaluateAll((as) => as.map((a) => a.getAttribute("target"))),
  });
  return { one: await read("Site One"), never: await read("Never Out"), asked, previews: await page.locator("[data-site-preview-live]").count() };
};
{
  const b = await builds();
  check("straight after publishing, the card says everything is published", b.one.kind === "current" && /^Everything is published: last publish \d/.test(b.one.says), J(b.one));
  check("the card has the same two links, each in a new tab", b.one.deployment === INSPECT && b.one.commit === COMMIT && b.one.targets.every((t) => t === "_blank"), J(b.one));
  check("a site never published says so, with its last change", b.never.kind === "never" && /^Not published yet\. Last change /.test(b.never.says) && !b.never.commit, J(b.never));
  check("the page stays light: no push, deploy or deployment lookup is made for this", b.asked.length === 0, J(b.asked));
  check("and no live preview is drawn until Preview is pressed", b.previews === 0, `${b.previews}`);
  await page.locator("[data-builds-list] > li", { hasText: "Site One" }).first().screenshot({ path: `${SHOTS}/builds-card-published.png` });
}

/* One more edit in the Builder: the card says there are changes not yet published, with both times. */
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__studioHistory, null, { timeout: 20000 });
await page.waitForTimeout(1100);
await page.evaluate(() => window.__studioHistory.act("updateNode", "n_words", { content: "Words changed after the publish" }));
await page.waitForTimeout(1500);
{
  const b = await builds();
  check("after another edit, the card says changes are not published yet, with both times", b.one.kind === "unpublished" && /^Changes not published yet: last change \d.+, last publish \d/.test(b.one.says), J(b.one));
  check("the last publish's links are still there", b.one.deployment === INSPECT && b.one.commit === COMMIT, J(b.one));
  await page.locator("[data-builds-list] > li", { hasText: "Site One" }).first().screenshot({ path: `${SHOTS}/builds-card-changes.png` });
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
