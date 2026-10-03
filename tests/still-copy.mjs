#!/usr/bin/env node
/**
 * A SITE FROM A CODE REPOSITORY GOES LIVE ONLY AS A STILL COPY, AND ONLY ON A YES.
 *
 * A site brought in from a code repository (`look.styleSource.repo`) is drawn
 * on the board from its rendered pages; Go live publishes that drawing without
 * the repository's scripts (`studio/stillCopy.ts`, `goLive.ts`):
 *   1. The words, read directly: the repository named, "still copy", "without
 *      the repository's scripts", and Send the design back pointed to. A site
 *      made on the board has no question.
 *   2. In the Builder: Update live site on a site from code asks first and
 *      pushes nothing. Back pushes nothing; Send the design back opens the repo
 *      menu and pushes nothing; Publish the still copy pushes once.
 *   3. A site made on the board publishes straight away, no question.
 *
 * The Builder's own publish routes are answered in the browser; nothing
 * reaches GitHub or Vercel.
 *
 *   npx next start -p 3013
 *   node tests/still-copy.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const { createJiti } = require("jiti");
const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

/* ------------------------------------------------ 1. the words, read directly */
{
  const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
  const M = await jiti.import(join(here, "..", "src", "features", "studio", "stillCopy.ts"));
  check("a site from code names its repository", M.codeSourceOf({ styleSource: { repo: "them/app" } }) === "them/app");
  check("a site made on the board has none", M.codeSourceOf({ styleSource: null }) === null && M.codeSourceOf({}) === null && M.codeSourceOf({ styleSource: { repo: "  " } }) === null);
  const says = M.stillCopyWords("them/app");
  check("the words say still copy, no scripts, and Send the design back", /them\/app/.test(says) && /still copy/.test(says) && /without the repository's scripts/.test(says) && /Send the design back/.test(says) && /repo menu/.test(says), says);
}

/* ------------------------------------------------ 2–3. in the Builder */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const errors = [];
const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const json = (r, body) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

async function builder(docNodes, look) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const calls = { push: 0 };
  await page.route(/https:\/\/(api\.)?(vercel|github)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  await page.route("**/api/studio/publish**", (r) => {
    const u = new URL(r.request().url());
    if (r.request().method() === "GET") return u.searchParams.get("tree") ? json(r, { ok: false, tree: [] }) : json(r, { github: { configured: true, token: "server", repo: null, branch: "main", missing: [] }, vercel: { hook: false } });
    calls.push++;
    return json(r, { ok: true, sha: "abc1234", commitUrl: "https://github.com/him/site/commit/abc1234", branch: "main", repo: "him/site", files: 3, deployed: false, hook: false, changed: 3, total: 3 });
  });
  await page.route("**/api/studio/deploy**", (r) => {
    const u = new URL(r.request().url());
    if (r.request().method() === "GET") {
      if (u.searchParams.get("address")) return json(r, { ok: false });
      if (u.searchParams.get("id")) return json(r, { ok: true, state: "READY", done: true, url: "https://site-live.vercel.app", inspectorUrl: null });
      return json(r, { configured: true, source: "server", repo: null, hook: false });
    }
    return json(r, { ok: true, id: "dpl_1", project: "site", repo: "him/site", branch: "main", team: null, state: "QUEUED", url: null, inspectorUrl: null });
  });
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ doc, builds }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, {
    builds: env({ projects: [{ id: "s1", name: "Checked", updatedAt: Date.now(), nudged: true, repo: { owner: "him", name: "site", branch: "main" } }], activeId: "s1" }),
    doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: docNodes, frameWidth: 1440, ...(look ? { look } : {}) }),
  });
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  return { ctx, page, calls };
}
const press = async (page) => {
  const bar = page.locator("header [data-go-live]").first();
  for (let i = 0; i < 40 && (await bar.getAttribute("data-go-live-state")) === "checking"; i++) await page.waitForTimeout(250);
  await bar.click();
  await page.waitForTimeout(1200);
};
const node = (id, content) => ({ id, pageId: "page_home", featureId: "prose", label: "", prompt: "", content, data: "", x: 80, y: 40, w: 300, h: 60, groupId: null, options: {}, priority: "must", custom: false });
const fromCode = { palette: {}, texture: [], target: "page", styleSource: { repo: "them/app", ref: "main", dir: "web/", files: [] } };
const waitPush = async (page, calls, n) => { for (let i = 0; i < 80 && calls.push < n; i++) await page.waitForTimeout(250); };

{
  const { ctx, page, calls } = await builder([node("a", "From code")], fromCode);
  await press(page);
  const ask = page.locator("[data-still-copy]");
  check("Update live site on a site from code asks first, and pushes nothing", (await ask.count()) === 1 && calls.push === 0, `${calls.push} pushes`);
  check("the question names the repository and Send the design back", /them\/app/.test(await ask.innerText()) && (await page.locator("[data-still-send-back]").count()) === 1);
  await page.getByRole("button", { name: "Back to the board" }).click();
  await page.waitForTimeout(800);
  check("Back to the board pushes nothing", calls.push === 0 && (await ask.count()) === 0, `${calls.push} pushes`);
  await press(page);
  let opened = false;
  await page.exposeFunction("__repoMenu", () => { opened = true; });
  await page.evaluate(() => window.addEventListener("studio:bring-repo", () => window.__repoMenu()));
  await page.locator("[data-still-send-back]").click();
  await page.waitForTimeout(800);
  check("Send the design back opens the repo menu and pushes nothing", opened && calls.push === 0, J({ opened, push: calls.push }));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await press(page);
  await page.locator("[data-still-publish]").click();
  await waitPush(page, calls, 1);
  await page.waitForTimeout(800);
  check("Publish the still copy publishes: one push", calls.push === 1, `${calls.push} pushes`);
  await ctx.close();
}
{
  const { ctx, page, calls } = await builder([node("b", "Made here")], null);
  await press(page);
  await waitPush(page, calls, 1);
  check("a site made on the board publishes straight away, no question", (await page.locator("[data-still-copy]").count()) === 0 && calls.push === 1, `${calls.push} pushes`);
  await ctx.close();
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
