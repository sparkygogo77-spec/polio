#!/usr/bin/env node
/**
 * THE TWEET CONSOLE IS A DRAWER, AND THE SITE IN ITS TOUR IS THE REAL SITE, SMALLER.
 *
 * Lane H, tweet console items 1 and 2, and the owner's note on Open site.
 *   1. At 1440 by 900 the console is a drawer on the right, one column wide
 *      (Post, Preview and Tour as tabs), with no backdrop: the board beside
 *      it still takes a press. At 1920 there is room, and the post sits
 *      beside its preview or tour.
 *   2. The site in the Tour box is drawn at the device's real width
 *      (Desktop 1440, Tablet 834, Phone 390) and the whole page scaled down
 *      to fit: every part of it is where the same page puts it in a browser
 *      window of that size, within two pixels, and its pictures (a TV and the
 *      screen set into it) are drawn, at the same place and size.
 *   3. Every way to the live or published site opens a new tab with
 *      rel="noopener": the Preview bar's Open the site, the live address
 *      beside Update live site, the Builds card's Live, the publish links.
 *      Pressing one leaves the Builder's own tab where it was.
 *
 * Screenshots: .screenshots/lane-h/console-*.png.
 *
 *   npx next start -p 3013
 *   node tests/tweet-console.mjs http://127.0.0.1:3013
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
const node = (id, featureId, content, x, y, w, h, extra = {}) => ({ id, pageId: "page_home", featureId, label: "", prompt: "", content, data: "", x, y, w, h, groupId: null, options: {}, priority: "must", custom: false, ...extra });
/* Two pictures: a TV, and the screen set into it. */
const pic = (id, w, h, bytes) => ({ id, path: `assets/pictures/${id}.png`, type: "image/png", w, h, bytes, alt: id === "pic_tv" ? "A television" : "Its screen", from: "upload" });
const TV = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEJMDIgBQAABgQB/1UzpsIAAAAASUVORK5CYII=";
const SCREEN = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const nodes = [
  node("n_head", "big-headline", "THE REAL SITE", 80, 40, 1280, 160),
  node("n_tv", "picture", "", 160, 240, 640, 480, { picture: pic("pic_tv", 2, 2, 75) }),
  node("n_screen", "picture", "", 240, 300, 420, 300, { picture: pic("pic_screen", 1, 1, 70) }),
  node("n_tabs", "tabs-panel", "Overview, Roadmap, Team", 860, 260, 520, 260),
  node("n_words", "prose", "Words further down the page.", 80, 820, 900, 120),
];
const put = (page) => page.evaluate(async (list) => {
  await new Promise((done, no) => {
    const req = indexedDB.open("builder.pictures", 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("files")) req.result.createObjectStore("files"); };
    req.onerror = () => no(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction("files", "readwrite");
      for (const [id, b64] of list) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); tx.objectStore("files").put(new Blob([u], { type: "image/png" }), id); }
      tx.oncomplete = () => done(); tx.onerror = () => no(tx.error);
    };
  });
}, [["pic_tv", TV], ["pic_screen", SCREEN]]);
const seed = async (page, extra = {}) => {
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ doc, builds }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, {
    builds: env({ projects: [{ id: "c1", name: "Console site", updatedAt: Date.now(), nudged: true, ...extra }], activeId: "c1" }),
    doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes, frameWidth: 1440 }),
  });
  await put(page);
};
const fresh = async (w, h) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/https:\/\/(api\.)?(vercel|github|x|twitter)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  return { ctx, page };
};

/* Every part's box in the scrolled page, and every picture, from inside a document. */
const layoutIn = () => {
  const s = document.querySelector("[data-live-scroller]");
  const sr = s.getBoundingClientRect();
  const box = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left - sr.left), Math.round(r.top - sr.top + s.scrollTop), Math.round(r.width), Math.round(r.height)]; };
  return {
    width: s.clientWidth,
    nodes: Object.fromEntries([...document.querySelectorAll("[data-live-node]")].map((n) => [n.getAttribute("data-live-node"), box(n)])),
    pictures: [...document.querySelectorAll("[data-live-node] img")].map((i) => ({ node: i.closest("[data-live-node]").getAttribute("data-live-node"), ok: i.complete && i.naturalWidth > 0, box: box(i) })),
  };
};
const CHROME = "[data-app-topbar], [data-app-sidebar], [data-live-bar] { display: none !important; } [data-live-column] { height: 100dvh !important; }";

/* ------------------------------------------------ 1. a drawer, and the board beside it */
{
  const { ctx, page } = await fresh(1440, 900);
  await seed(page);
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.mouse.click(5, 300);
  await page.keyboard.press("t");
  await page.waitForTimeout(700);
  const con = page.locator("[data-tweet-console]");
  const box = await con.boundingBox();
  check("at 1440 the console is a drawer on the right, one column", (await con.getAttribute("data-layout")) === "narrow" && box && box.width <= 540 && box.x + box.width >= 1420, J(box));
  check("leaving most of the board beside it", box && box.x >= 880, `${Math.round(box?.x ?? 0)} px of board`);
  const free = await page.evaluate(() => { const el = document.elementFromPoint(300, 500); return !el?.closest("[data-tweet-console]") && !!el?.closest("[data-studio-bar], main"); });
  check("no backdrop: a press on the board reaches the board", free);
  const tabs = await con.getByRole("radio").allInnerTexts();
  check("Post, Preview and Tour are tabs in the one column", ["Post", "Preview", "Tour"].every((t) => tabs.some((x) => x.includes(t))), J(tabs));
  check("side by side is off: the window leaves the board no room for it", await con.locator("[data-console-width]").isDisabled());
  await page.screenshot({ path: `${SHOTS}/console-drawer-1440.png` });
  await ctx.close();
}
{
  const { ctx, page } = await fresh(1920, 1080);
  await seed(page);
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.mouse.click(5, 300);
  await page.keyboard.press("t");
  await page.waitForTimeout(700);
  const con = page.locator("[data-tweet-console]");
  const box = await con.boundingBox();
  check("at 1920 there is room: the post beside its preview or tour", (await con.getAttribute("data-layout")) === "wide" && (await con.locator("[data-console-post]").isVisible()) && box.x >= 420, J(box));
  await con.getByRole("radio", { name: "Tour" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/console-side-by-side-1920.png` });
  await con.locator("[data-console-width]").click();
  await page.waitForTimeout(400);
  check("and it folds to one column on a press", (await con.getAttribute("data-layout")) === "narrow");
  await ctx.close();
}

/* ------------------------------------------------ 2. the site in the Tour box is the real site, smaller */
const SIZES = { Desktop: [1440, 900], Tablet: [834, 1112], Phone: [390, 844] };
for (const [device, [w, h]] of Object.entries(SIZES)) {
  /* The real page, in a browser window of the device's size. */
  const real = await fresh(w, h);
  await seed(real.page);
  await real.page.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
  await real.page.addStyleTag({ content: CHROME });
  await real.page.evaluate(() => window.__studioLiveDevice?.("window"));
  await real.page.waitForTimeout(1500);
  const want = await real.page.evaluate(layoutIn);
  await real.page.screenshot({ path: `${SHOTS}/console-real-${device.toLowerCase()}.png` });
  await real.ctx.close();

  /* The same page in the Tour box. */
  const { ctx, page } = await fresh(1920, 1080);
  await seed(page);
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.mouse.click(5, 300);
  await page.keyboard.press("t");
  await page.waitForTimeout(700);
  const con = page.locator("[data-tweet-console]");
  await con.getByRole("radio", { name: "Tour" }).click();
  await con.getByRole("radio", { name: device }).click();
  await page.waitForTimeout(500);
  await page.waitForFunction(() => !!document.querySelector("[data-tour-iframe]")?.contentDocument?.querySelector("[data-live-scroller] [data-live-node] img"), null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  const frame = page.frames().find((f) => f.url().includes("/builder/preview"));
  const got = await frame.evaluate(layoutIn);
  const sizes = await page.evaluate(() => { const f = document.querySelector("[data-tour-iframe]"); const b = document.querySelector("[data-tour-box]"); return { w: f.offsetWidth, h: f.offsetHeight, shown: b.getBoundingClientRect().width, scale: Number(b.getAttribute("data-tour-scale")) }; });
  check(`${device}: the frame is the device's real size, ${w} by ${h}`, sizes.w === w && sizes.h === h, J(sizes));
  check(`${device}: and the whole page is scaled down to fit the box`, sizes.scale < 1 && Math.abs(sizes.shown - w * sizes.scale) <= 1, J(sizes));
  const off = Object.entries(want.nodes).filter(([id, r]) => !got.nodes[id] || r.some((v, i) => Math.abs(v - got.nodes[id][i]) > 2)).map(([id, r]) => `${id} ${r} vs ${got.nodes[id]}`);
  check(`${device}: every part sits where the real page puts it, within 2 pixels`, Object.keys(want.nodes).length >= 5 && off.length === 0, off.slice(0, 3).join(" | ") || `${Object.keys(want.nodes).length} parts`);
  const tv = got.pictures.filter((p) => p.node === "n_tv" || p.node === "n_screen");
  check(`${device}: the TV and its screen are drawn`, tv.length === 2 && tv.every((p) => p.ok), J(tv));
  const picOff = got.pictures.filter((p) => { const r = want.pictures.find((q) => q.node === p.node); return !r || p.box.some((v, i) => Math.abs(v - r.box[i]) > 2); });
  check(`${device}: and at the same place and size as on the real page`, picOff.length === 0, J(picOff.slice(0, 2)));
  await page.locator("[data-tour-frame]").screenshot({ path: `${SHOTS}/console-tour-${device.toLowerCase()}.png` });
  await ctx.close();
}

/* ------------------------------------------------ 3. the live site opens in a new tab */
{
  const { ctx, page } = await fresh(1440, 900);
  await page.route("https://site-live.example/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>live</title>live" }));
  await page.route("https://vercel.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "deploy" }));
  await page.route("https://github.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "commit" }));
  await seed(page, { repo: { owner: "him", name: "site", branch: "main" }, live: { url: "https://site-live.example", at: Date.now(), inspectorUrl: "https://vercel.com/him/site/dpl_1" }, published: { at: Date.now(), repo: "him/site", branch: "main", commitUrl: "https://github.com/him/site/commit/abc" } });
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const attrs = (sel) => page.locator(sel).first().evaluate((a) => ({ href: a.getAttribute("href"), target: a.getAttribute("target"), rel: a.getAttribute("rel") }));
  const newTab = (a) => a.target === "_blank" && /\bnoopener\b/.test(a.rel ?? "");
  const pressOpens = async (sel) => {
    const was = page.url();
    const [popup] = await Promise.all([ctx.waitForEvent("page", { timeout: 8000 }).catch(() => null), page.locator(sel).first().click()]);
    await page.waitForTimeout(300);
    const opener = popup ? await popup.evaluate(() => window.opener === null).catch(() => null) : null;
    if (popup) await popup.close();
    return { popup: !!popup, stayed: page.url() === was, noOpener: opener };
  };
  const addr = await attrs("[data-go-live-address]");
  check("beside Update live site, the live address opens a new tab with rel=noopener", newTab(addr) && addr.href === "https://site-live.example", J(addr));
  const pressed = await pressOpens("[data-go-live-address]");
  check("and pressing it leaves the Builder's tab where it was", pressed.popup && pressed.stayed && pressed.noOpener === true, J(pressed));
  /* Preview mode: the bar's Open the site. */
  await page.keyboard.press("p");
  await page.waitForTimeout(800);
  const open = await attrs("[data-open-site]");
  check("in Preview, Open the site is a new tab with rel=noopener", newTab(open) && /\/builder\/preview/.test(open.href ?? ""), J(open));
  const pressed2 = await pressOpens("[data-open-site]");
  check("and pressing it leaves the Builder's tab where it was", pressed2.popup && pressed2.stayed, J(pressed2));
  /* Builds: the card's Live and the last publish's links. */
  await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const card = await attrs("[data-card-live]");
  check("on Builds, the card's Live opens a new tab with rel=noopener", newTab(card) && card.href === "https://site-live.example", J(card));
  check("and it is not inside the card's own button", await page.locator("[data-card-live]").first().evaluate((a) => !a.closest("button")));
  const pressed3 = await pressOpens("[data-card-live]");
  check("pressing it opens the site and leaves Builds where it was", pressed3.popup && pressed3.stayed, J(pressed3));
  const links = await page.locator("[data-publish-links] a").evaluateAll((as) => as.map((a) => ({ target: a.getAttribute("target"), rel: a.getAttribute("rel") })));
  check("the publish links (deployment and commit) open new tabs with rel=noopener", links.length === 2 && links.every(newTab), J(links));
  /* Nothing in the app opens a site in this tab: every target=_blank link carries noopener. */
  const loose = await page.evaluate(() => [...document.querySelectorAll('a[target="_blank"]')].filter((a) => !/\bnoopener\b/.test(a.rel)).map((a) => a.outerHTML.slice(0, 80)));
  check("no link that opens a new tab on Builds lacks rel=noopener", loose.length === 0, J(loose));
  await ctx.close();
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
