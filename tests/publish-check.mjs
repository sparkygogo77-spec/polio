#!/usr/bin/env node
/**
 * UPDATE LIVE SITE SHOWS ONE SHORT LIST OF WHAT IS WRONG FIRST, AND STILL PUBLISHES.
 *
 * Lane H, item D. Pressing Update live site reads the board first
 * (`studio/publishCheck.ts`, `PublishCheck.tsx`):
 *   1. The rules, read directly: pump.fun and DEX Screener's own pages
 *      allowed; one contract address on DEX Screener, an X profile and a
 *      site no rule names refused; a share link flagged for a choice; a
 *      picture this browser lacks, words hard to read, a part off the page at
 *      phone width and a button that does nothing each named.
 *   2. In the Builder: the list opens instead of the publish, grouped, each
 *      line with Fix or Show. Fix takes the line off (the link is gone from
 *      the part); Keep it on a share link keeps the link and the line goes;
 *      Show closes the list and picks the part on its page.
 *   3. Publish anyway publishes, one push. A clean board publishes straight
 *      away with no list.
 *
 * The Builder's own publish routes are answered in the browser; nothing
 * reaches GitHub or Vercel. Screenshot: .screenshots/lane-h/publish-check.png.
 *
 *   npx next start -p 3013
 *   node tests/publish-check.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const { createJiti } = require("jiti");
const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SHOTS = ".screenshots/lane-h";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const node = (id, featureId, content, x, y, w, h, extra = {}) => ({ id, pageId: "page_home", featureId, label: "", prompt: "", content, data: "", x, y, w, h, groupId: null, options: {}, priority: "must", custom: false, ...extra });
const url = (target) => ({ link: { kind: "url", target } });
const nodes = [
  node("n_pump", "prose", "On pump", 80, 40, 300, 60, url("https://pump.fun/coin/abc123")),
  node("n_dexok", "prose", "Chart page", 80, 120, 300, 60, url("https://dexscreener.com/solana")),
  node("n_dexca", "prose", "The pair", 80, 200, 300, 60, url("https://dexscreener.com/solana/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")),
  node("n_xprof", "prose", "Our X", 80, 280, 300, 60, url("https://x.com/someone")),
  node("n_else", "prose", "Elsewhere", 80, 360, 300, 60, url("https://example.org/page")),
  node("n_share", "prose", "Share it", 80, 440, 300, 60, url("https://x.com/intent/tweet?text=look")),
  node("n_pic", "picture", "", 80, 520, 200, 200, { picture: { id: "pic_not_here", path: "assets/pictures/pic_not_here.png", type: "image/png", w: 2, h: 2, bytes: 70, alt: "Gone", from: "upload" } }),
  node("n_faint", "prose", "Faint words", 420, 40, 300, 60, { colour: { text: "#222222", bg: "#1e1e1e" } }),
  node("n_buy", "cta-primary", "Nowhere button", 420, 120, 260, 60),
];

/* ------------------------------------------------ 1. the rules, read directly */
{
  const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
  const M = await jiti.import(join(here, "..", "src", "features", "studio", "publishCheck.ts"));
  const wide = (pageId, device) => ({ width: device === "phone" ? 390 : 834, placed: [{ id: "n_faint", x: 420, w: 300 }] });
  const got = M.checkBoard({ nodes, pages: [{ id: "page_home", name: "Home" }], held: new Set(), palette: {}, layout: wide });
  const of = (id) => got.filter((p) => p.id === id).map((p) => p.kind);
  check("pump.fun is allowed", of("n_pump").length === 0, J(of("n_pump")));
  check("DEX Screener is allowed when it is not one contract address", of("n_dexok").length === 0, J(of("n_dexok")));
  check("one contract address on DEX Screener is refused", of("n_dexca").includes("link"), J(of("n_dexca")));
  check("an X profile is refused, and says so", of("n_xprof").includes("link") && /X profiles are not allowed/.test(got.find((p) => p.id === "n_xprof").says));
  check("a site no rule names is refused", of("n_else").includes("link"));
  check("a share link is flagged for a choice, with Keep it", of("n_share").includes("share") && got.find((p) => p.id === "n_share").keep === "Keep it");
  check("a picture this browser lacks is named", of("n_pic").includes("picture"));
  check("words hard to read are named", of("n_faint").includes("words"));
  check("a part off the page at phone width is named, with how far", got.some((p) => p.kind === "fit" && /330 pixels off the page at phone width/.test(p.says)), J(got.filter((p) => p.kind === "fit").map((p) => p.says)));
  check("a button that does nothing is named", of("n_buy").includes("nowhere"));
  const kept = M.checkBoard({ nodes: nodes.map((n) => (n.id === "n_share" ? { ...n, shareChecked: n.link.target } : n)), pages: [{ id: "page_home" }], held: new Set(["pic_not_here"]), palette: {} });
  check("a share link kept, and a picture held, are not named again", !kept.some((p) => p.id === "n_share" || p.id === "n_pic"), J(kept.map((p) => p.id)));
}

/* ------------------------------------------------ 2–3. in the Builder */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const errors = [];
const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const json = (r, body) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

async function builder(docNodes) {
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
    doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: docNodes, frameWidth: 1440 }),
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
const lines = (page) => page.locator("[data-check-line]").evaluateAll((ls) => ls.map((l) => ({ kind: l.getAttribute("data-check-line"), id: l.getAttribute("data-check-part") })));
const doc = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes);

{
  const { ctx, page, calls } = await builder(nodes);
  await press(page);
  const list = page.locator("[data-publish-check]");
  check("Update live site opens the list instead of publishing", (await list.count()) === 1 && calls.push === 0, `${calls.push} pushes`);
  const first = await lines(page);
  const kinds = [...new Set(first.map((l) => l.kind))];
  check("the list is grouped: links, share, pictures, words, buttons", ["link", "share", "picture", "words", "nowhere"].every((k) => kinds.includes(k)), J(kinds));
  check("every line has Show, and Fix where there is one", (await page.locator("[data-check-line]").count()) === (await page.locator("[data-check-show]").count()), "");
  await page.screenshot({ path: `${SHOTS}/publish-check.png` });
  /* Fix a link that leaves the site. */
  await page.locator('[data-check-part="n_xprof"] [data-check-fix]').click();
  await page.waitForTimeout(800);
  check("Fix takes the line off the list", !(await lines(page)).some((l) => l.id === "n_xprof"));
  check("and the link off the part", (await doc(page)).find((n) => n.id === "n_xprof")?.link == null);
  /* Keep a share link. */
  await page.locator('[data-check-part="n_share"] [data-check-keep]').click();
  await page.waitForTimeout(800);
  const share = (await doc(page)).find((n) => n.id === "n_share");
  check("Keep it keeps the share link, and the line goes", share?.link?.target?.includes("intent/tweet") && !(await lines(page)).some((l) => l.id === "n_share"), J(share?.link));
  /* Make words readable. */
  await page.locator('[data-check-part="n_faint"] [data-check-fix]').click();
  await page.waitForTimeout(800);
  check("Make it readable fixes the words, or says it cannot", !(await lines(page)).some((l) => l.id === "n_faint") || /None of the site's own colours|as readable as the site's own colours allow/.test(await page.locator("[data-publish-check]").innerText()));
  /* Leave a button doing nothing. */
  await page.locator('[data-check-part="n_buy"] [data-check-fix]').click();
  await page.waitForTimeout(800);
  check("Leave it doing nothing answers the button", (await doc(page)).find((n) => n.id === "n_buy")?.nowhere === true && !(await lines(page)).some((l) => l.id === "n_buy"));
  /* Show a part. */
  await page.locator('[data-check-part="n_else"] [data-check-show]').click();
  await page.waitForTimeout(900);
  const picked = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.selection ?? null);
  const listGone = (await page.locator("[data-publish-check]").count()) === 0;
  const shown = await page.locator('[data-node-id="n_else"]').first().evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }).catch(() => false);
  check("Show closes the list and puts the part in view, picked", listGone && shown, J({ listGone, shown, picked }));
  /* Publish anyway. */
  await press(page);
  check("pressed again, the list holds only what is left", (await lines(page)).length >= 2, J(await lines(page)));
  await page.locator("[data-publish-anyway]").click();
  for (let i = 0; i < 80 && calls.push === 0; i++) await page.waitForTimeout(250);
  check("Publish anyway publishes: one push", calls.push === 1, `${calls.push} pushes`);
  await ctx.close();
}
{
  const clean = [node("c_head", "prose", "All good", 80, 40, 300, 60), node("c_pump", "prose", "Buy on pump", 80, 120, 300, 60, url("https://pump.fun/coin/abc"))];
  const { ctx, page, calls } = await builder(clean);
  await press(page);
  for (let i = 0; i < 40 && calls.push === 0; i++) await page.waitForTimeout(250);
  check("a clean board publishes straight away, no list", (await page.locator("[data-publish-check]").count()) === 0 && calls.push === 1, `${calls.push} pushes`);
  await ctx.close();
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
