#!/usr/bin/env node
/**
 * PUBLISH TO CAN BE MOVED, AND A NEW REPO IS MADE WITH THE NAME YOU MEANT.
 *
 * The owner, on Your repos > Publish to:
 *   1. "Or move it to another of your repos": pressing a repo did nothing,
 *      and Publish to stayed on the old repo. The move asked through the
 *      browser's own confirm, which a browser that is not showing dialogs
 *      answers "no" in silence. Held here the same way: nothing answers the
 *      browser's dialogs. A site that has not published yet moves at once; one
 *      that has asks on the panel.
 *   2. "Or make a new repo for it": the name came filled in, a click into it
 *      put the caret mid-name, the typing landed in the middle, and one press
 *      of Make it made a private repo with a garbled name. And a site that
 *      already had a publish target kept it. Now the box selects itself, Make
 *      it shows the final name and asks once, and the site moves to the repo
 *      it made. Nothing is ever deleted.
 *
 *   GITHUB_API=http://127.0.0.1:4320 npx next start -p 3013
 *   node tests/publish-target.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const PORT = Number(process.env.STUB_PORT ?? 4320);
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const made = [];
const deleted = [];
const REPOS = [
  { full_name: "him/site", private: true, default_branch: "main", pushed_at: "2026-09-27T00:00:00Z" },
  { full_name: "him/trendtrader", private: true, default_branch: "main", pushed_at: "2026-09-26T00:00:00Z" },
];
const stub = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const j = (b, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(J(b)); };
  let body = "";
  req.on("data", (d) => { body += d; });
  req.on("end", () => {
    if (req.method === "DELETE") { deleted.push(u.pathname); return j({}, 204); }
    if (u.pathname === "/user") return j({ login: "him" });
    if (u.pathname === "/user/repos" && req.method === "POST") { const name = JSON.parse(body || "{}").name; made.push(name); return j({ full_name: `him/${name}`, default_branch: "main", private: true }, 201); }
    if (u.pathname === "/user/repos") return j(REPOS);
    if (/\/branches$/.test(u.pathname)) return j([{ name: "main" }]);
    return j({ message: "Not Found" }, 404);
  });
});
await new Promise((r) => stub.listen(PORT, "127.0.0.1", r));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const errors = [];
const dialogs = [];
async function site(project) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  page.on("pageerror", (e) => errors.push(e.message));
  /* Nothing answers a browser dialog: dismissed, as a tab with dialogs blocked answers them. */
  page.on("dialog", (d) => { dialogs.push(d.message()); void d.dismiss(); });
  await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate((p) => {
    localStorage.clear();
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Trend Trader Pro", updatedAt: Date.now(), ...p }], activeId: "s1" }));
    localStorage.setItem("builder.studio", env({ pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [], brief: { name: "Official Trend Trader Pro Token", gimmick: "", master: "" } }));
  }, project);
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const keys = page.locator("[data-keys-panel]");
  await page.getByRole("button", { name: "Keys", exact: true }).click(); await page.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await page.waitForTimeout(400);
  await keys.getByRole("button", { name: "Close keys" }).click(); await page.waitForTimeout(400);
  await page.locator("[data-github-button]").first().click();
  await page.waitForTimeout(1200);
  return { ctx, page, pub: page.locator('[data-repo-section="publish"]') };
}
const target = (page) => page.evaluate(() => { const p = JSON.parse(localStorage.getItem("builder.builds") || "{}").state?.projects?.[0]; return p?.repo ? `${p.repo.owner}/${p.repo.name}` : null; });
const PUBLISHED = { repo: { owner: "him", name: "site", branch: "main" }, bound: "connected", live: { url: "https://site.vercel.app", at: Date.now() } };
const safe = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, String(e).split("\n")[0]); } };

/* 1a. Not published yet: a press moves it at once. */
await safe("1a ran", async () => {
  const { ctx, page, pub } = await site({ repo: { owner: "him", name: "site", branch: "main" }, bound: "connected" });
  await pub.locator('[data-repo-publish-pick="him/trendtrader"]').click();
  await page.waitForTimeout(500);
  check("not published yet: pressing another repo moves Publish to there at once", (await target(page)) === "him/trendtrader", await target(page));
  check("…and Publish to says so", /him\/trendtrader/.test(await pub.locator("[data-repo-points]").innerText()));
  await ctx.close();
});
/* 1b. Already published: asked on the panel, and moved on yes. */
await safe("1b ran", async () => {
  const { ctx, page, pub } = await site(PUBLISHED);
  await pub.locator('[data-repo-publish-pick="him/trendtrader"]').click();
  await page.waitForTimeout(500);
  const ask = pub.locator("[data-repo-move-confirm]");
  check("already published: the move is asked on the panel, naming both repos", (await ask.count()) === 1 && /him\/site/.test(await ask.innerText()) && /him\/trendtrader/.test(await ask.innerText()), dialogs.length ? `a browser dialog instead: ${dialogs.at(-1)}` : "no ask");
  if (await ask.count()) await pub.locator("[data-repo-move-go]").click();
  await page.waitForTimeout(500);
  check("…and yes moves Publish to", (await target(page)) === "him/trendtrader", await target(page));
  await ctx.close();
});
/* 1c. Already published, and kept. */
await safe("1c ran", async () => {
  const { ctx, page, pub } = await site(PUBLISHED);
  await pub.locator('[data-repo-publish-pick="him/trendtrader"]').click();
  await page.waitForTimeout(500);
  if (await pub.locator("[data-repo-move-keep]").count()) await pub.locator("[data-repo-move-keep]").click();
  await page.waitForTimeout(300);
  check("…and Keep leaves it where it was", (await target(page)) === "him/site" && (await pub.locator("[data-repo-move-confirm]").count()) === 0, await target(page));
  await ctx.close();
});
/* 2. Make a new repo, on a site already publishing somewhere. */
await safe("2 ran", async () => {
  const { ctx, page, pub } = await site(PUBLISHED);
  const box = pub.locator("[data-repo-new]");
  const prefilled = await box.inputValue();
  const b = await box.boundingBox();
  /* A click into the middle of the filled-in name, then typing. */
  await page.mouse.click(b.x + b.width * 0.45, b.y + b.height / 2);
  await page.keyboard.type("trendtrader-pro");
  const typed = await box.inputValue();
  check("the name box comes filled in, and a click into it then typing replaces the name", prefilled.length > 0 && typed === "trendtrader-pro", `${J(prefilled)} → ${J(typed)}`);
  const n = made.length;
  await pub.locator("[data-repo-make]").click();
  await page.waitForTimeout(600);
  const ask = pub.locator("[data-repo-make-confirm]");
  check("Make it does not make anything yet: it shows the final name and asks", made.length === n && (await ask.count()) === 1 && /him\/trendtrader-pro/.test(await ask.innerText()), `${made.length - n} made; ${(await ask.count()) ? await ask.innerText() : "no ask"}`);
  if (await ask.count()) await pub.locator("[data-repo-make-go]").click();
  await page.waitForTimeout(1200);
  check("…yes makes exactly that repo, once", made.slice(n).join() === "trendtrader-pro", J(made.slice(n)));
  check("…and the site now publishes to it", (await target(page)) === "him/trendtrader-pro", await target(page));
  await ctx.close();
});
check("no repository was ever deleted", deleted.length === 0, J(deleted));
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
stub.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
