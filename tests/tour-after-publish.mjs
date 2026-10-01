#!/usr/bin/env node
/**
 * A TOUR CLIP AFTER EACH PUBLISH, READY AS A DRAFT POST.
 *
 * Lane H, item E. With "Make a tour clip after each publish" on (the Tour
 * panel's switch, or the console's settings):
 *   1. Update live site asks to record this tab once, in the press, before
 *      anything is pushed (a browser lets a page ask only then).
 *   2. When the site is live, a new draft "<site> is live: <address>" is
 *      made, the tour is recorded for the clip length set on the Tour, and
 *      the clip is on the draft's first post, within a second of that length.
 *   3. A publish that does not go live makes no draft, lets the recording go,
 *      and says so in the console's log.
 *   4. With the switch off, a publish asks for nothing and makes no draft.
 *
 * Recording is a stand-in (the tab capture is a canvas stream; the browser's
 * own MediaRecorder is kept). The Builder's publish routes are answered in
 * the browser: nothing reaches GitHub or Vercel.
 * Screenshot: .screenshots/lane-h/tour-after-publish.png.
 *
 *   npx next start -p 3013
 *   node tests/tour-after-publish.mjs http://127.0.0.1:3013
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
const errors = [];
const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const node = (id, featureId, content, x, y, w, h) => ({ id, pageId: "page_home", featureId, label: "", prompt: "", content, data: "", x, y, w, h, groupId: null, options: {}, priority: "must", custom: false });
const nodes = [node("n_head", "big-headline", "LIVE NOW", 80, 40, 1280, 160), node("n_tabs", "tabs-panel", "One, Two, Three", 80, 260, 900, 280), node("n_tail", "prose", "The end.", 80, 1400, 900, 120)];
const json = (r, body) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  window.__asked = [];
  navigator.mediaDevices.getDisplayMedia = async () => {
    window.__asked.push(Date.now());
    const c = document.createElement("canvas"); c.width = 640; c.height = 400;
    const g = c.getContext("2d"); let f = 0;
    setInterval(() => { f++; g.fillStyle = `hsl(${(f * 9) % 360} 70% 50%)`; g.fillRect(0, 0, 640, 400); }, 40);
    return c.captureStream(25);
  };
});
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const plan = { live: true, pushedAt: [] };
await page.route(/https:\/\/(api\.)?(vercel|github)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
await page.route("**/api/studio/publish**", (r) => {
  const u = new URL(r.request().url());
  if (r.request().method() === "GET") return u.searchParams.get("tree") ? json(r, { ok: false, tree: [] }) : json(r, { github: { configured: true, token: "server", repo: null, branch: "main", missing: [] }, vercel: { hook: false } });
  plan.pushedAt.push(Date.now());
  return json(r, { ok: true, sha: "abc1234", commitUrl: "https://github.com/him/site/commit/abc1234", branch: "main", repo: "him/site", files: 3, deployed: false, hook: false, changed: 3, total: 3 });
});
await page.route("**/api/studio/deploy**", (r) => {
  const u = new URL(r.request().url());
  if (r.request().method() === "GET") {
    if (u.searchParams.get("address")) return json(r, { ok: false });
    if (u.searchParams.get("id")) return json(r, plan.live ? { ok: true, state: "READY", done: true, url: "https://live-now.vercel.app", inspectorUrl: null } : { ok: true, state: "ERROR", done: true, url: null, inspectorUrl: null, message: "the build failed" });
    return json(r, { configured: true, source: "server", repo: null, hook: false });
  }
  return json(r, { ok: true, id: "dpl_1", project: "site", repo: "him/site", branch: "main", team: null, state: "QUEUED", url: null, inspectorUrl: null });
});
await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(({ doc, builds }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, {
  builds: env({ projects: [{ id: "s1", name: "Live Now", updatedAt: Date.now(), nudged: true, repo: { owner: "him", name: "site", branch: "main" } }], activeId: "s1" }),
  doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes, frameWidth: 1440, brief: { name: "Live Now", gimmick: "", master: "" } }),
});
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

/* Turn it on in the Tour panel, and set a 4 second clip. */
const con = page.locator("[data-tweet-console]");
await page.mouse.click(5, 300);
await page.keyboard.press("t");
await page.waitForTimeout(600);
await con.getByRole("radio", { name: "Tour" }).click();
await page.waitForTimeout(500);
await con.locator("[data-clip-after-publish]").click();
await con.locator("[data-tour-seconds]").fill("4");
await con.locator("[data-tour-seconds]").blur();
await page.waitForTimeout(300);
check("the switch is on, and says what it will do", (await con.locator("[data-clip-after-publish]").getAttribute("aria-checked")) === "true" && /asks once to record this tab/.test(await con.innerText()));
await con.getByRole("button", { name: "Close the tweet console" }).click();
await page.waitForTimeout(400);

const drafts = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.tweets") ?? "{}").state?.drafts ?? []);
const press = async () => {
  const bar = page.locator("header [data-go-live]").first();
  for (let i = 0; i < 40 && (await bar.getAttribute("data-go-live-state")) === "checking"; i++) await page.waitForTimeout(250);
  await bar.click();
};

/* ------------------------------------------------ 1–2. a publish that goes live */
{
  await press();
  await page.waitForTimeout(1500);
  const asked = await page.evaluate(() => window.__asked.slice());
  check("the press asked to record this tab, once, before anything was pushed", asked.length === 1 && plan.pushedAt.length >= 1 && asked[0] <= plan.pushedAt[0], J({ asked, pushed: plan.pushedAt }));
  let draft = null;
  for (let i = 0; i < 160 && !draft; i++) {
    await page.waitForTimeout(250);
    draft = (await drafts()).find((d) => d.title === "Live: Live Now" && d.posts[0]?.media?.length);
  }
  await page.screenshot({ path: `${SHOTS}/tour-after-publish.png` });
  check("once live, a new draft says the site is live, with its address", !!draft && draft.posts[0].text === "Live Now is live: https://live-now.vercel.app", J(draft?.posts?.[0]?.text));
  check("and the tour clip is on its first post", !!draft && /^tour\.(mp4|gif)$/.test(draft.posts[0].media[0].name) && draft.posts[0].media[0].size > 0, J(draft?.posts?.[0]?.media));
  const log = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.tweets")).state.log.find((l) => l.title === "Tour clip attached to the new draft")?.body ?? "");
  const secs = Number(/([\d.]+) s$/.exec(log)?.[1]);
  check("the clip is the length set on the Tour, within a second", Math.abs(secs - 4) <= 1, J(log));
  check("the console opened on that draft", (await con.getAttribute("data-open")) === "1");
  await con.getByRole("button", { name: "Close the tweet console" }).click().catch(() => undefined);
  await page.waitForTimeout(400);
}

/* ------------------------------------------------ 3. a publish that does not go live */
{
  plan.live = false;
  const before = (await drafts()).length;
  const asked0 = (await page.evaluate(() => window.__asked.length));
  await press();
  await page.waitForTimeout(6000);
  check("asked once more, in the press", (await page.evaluate(() => window.__asked.length)) === asked0 + 1);
  check("no draft when the site did not go live", (await drafts()).length === before, `${(await drafts()).length} vs ${before}`);
  const said = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.tweets")).state.log.some((l) => l.title === "No tour clip this time" && /did not go live/.test(l.body ?? "")));
  check("and the log says no clip was made, and why", said);
}

/* ------------------------------------------------ 4. switched off */
{
  plan.live = true;
  await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /settings/.test(x)); return k; });
  await page.keyboard.press("t");
  await page.waitForTimeout(600);
  await con.getByRole("radio", { name: "Tour" }).click();
  await con.locator("[data-clip-after-publish]").click();
  await page.waitForTimeout(200);
  await con.getByRole("button", { name: "Close the tweet console" }).click();
  await page.waitForTimeout(300);
  const before = (await drafts()).length;
  const asked0 = await page.evaluate(() => window.__asked.length);
  await press();
  await page.waitForTimeout(6000);
  check("switched off, a publish asks for nothing and makes no draft", (await page.evaluate(() => window.__asked.length)) === asked0 && (await drafts()).length === before);
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
