#!/usr/bin/env node
/**
 * THE STICKY TOP BAR DOES WHAT ITS "ON SCROLL" SAYS.
 *
 * The part's option (shrink, hide-then-show, blur; `catalog.ts`) was read
 * nowhere, and the bar never stuck: every live part is placed absolutely,
 * so it scrolled away with the page (shelf audit, item 3). Held here, for
 * each of the three:
 *
 *   · on the board, the bar's drawn layer rides the board's scroll and wears
 *     the effect, while its box stays where it was drawn (`runWorks.ts`,
 *     board; `ON_BOARD`);
 *   · in Preview, the bar's box is sticky at the top of the Preview's window
 *     and the effect comes on once the page has gone past it, and
 *     hide-then-show comes back on the first move up (`LiveSite.tsx`,
 *     `behaviourScripts/effects.ts#STICKY_BAR`);
 *   · the published page carries the script and the binding, the bar is
 *     sticky there too, and scrolled it shrinks (`exportSite.ts`,
 *     `fluidSite.ts#fluidStyle`);
 *   · "static" carries nothing.
 *
 * Covers: src/features/studio/shelf/library/behaviourScripts/effects.ts, src/features/studio/shelf/library/works.ts
 *
 *   npm run build && npx next start -p 3013
 *   node tests/sticky-bar.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();
const URL_ = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const node = (id, f, label, x, y, w, h, extra = {}) => ({ id, pageId: "p0", featureId: f, label, x, y, w, h, content: "", prompt: "", options: {}, ...extra });
const docFor = (on) => JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("bar", "sticky-header", "Top bar", 0, 0, 1440, 64, { options: { onScroll: on }, content: "logo: BLACKORB, Vision, Token, button: Join" }),
    node("hero", "hero-split", "Hero", 0, 120, 1440, 600),
    node("words", "prose", "Words", 120, 800, 1200, 900, { content: "Long words here." }),
    node("more", "stat-tiles", "Numbers", 120, 1800, 1200, 400),
    node("end", "footer", "Footer", 0, 2400, 1440, 200),
  ], groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? process.env.CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(req("node:fs").existsSync(AT) ? { executablePath: AT } : {}) });

for (const on of ["shrink", "hide-then-show", "blur", "static"]) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  await ctx.addInitScript((d) => { localStorage.setItem("builder.studio", d); localStorage.setItem("builder.shelf.folded", "1"); }, docFor(on));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false } }) }));
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  /* ---------------------------------------------------------- the board */
  const board = () => page.evaluate(() => {
    const box = document.querySelector('[data-node-id="bar"]');
    const d = box?.querySelector(":scope > [data-part-drawn]");
    const bar = d?.querySelector("[data-part]");
    const pane = document.querySelector("[data-studio-pane]");
    return { moves: d?.getAttribute("data-board-moves") ?? null, scrolled: d?.getAttribute("data-scrolled") ?? null, hidden: !!d?.hasAttribute("data-bar-hidden"),
      boxTop: Math.round(box?.getBoundingClientRect().top ?? -1), layerTop: Math.round(d?.getBoundingClientRect().top ?? -1), barTop: Math.round(bar?.getBoundingClientRect().top ?? -1), paneTop: Math.round(pane.getBoundingClientRect().top),
      height: bar?.style.height ?? "", filter: bar?.style.backdropFilter ?? "", translate: bar?.style.translate ?? "" };
  });
  const scrollBoard = async (to) => { await page.evaluate((y) => { document.querySelector("[data-studio-pane]").scrollTop = y; }, to); await page.waitForTimeout(500); };
  const b0 = await board();
  if (on === "static") {
    check("static: the board plays nothing on the bar", b0.moves === null, b0.moves ?? "nothing");
  } else {
    check(`${on}: the board plays it on the bar's drawn layer`, b0.moves === "sticky-bar", b0.moves ?? "nothing");
    check(`${on}: at the top the bar is as drawn`, b0.scrolled === null && b0.barTop > b0.paneTop, `bar at ${b0.barTop}, pane at ${b0.paneTop}`);
    await scrollBoard(400);
    const b1 = await board();
    /* The drawn layer is what rides; hide-then-show then moves the bar up out of it. */
    check(`${on}: scrolled, the drawn layer rides along the pane's top edge`, Math.abs(b1.layerTop - b1.paneTop) <= 2, `layer at ${b1.layerTop}, pane at ${b1.paneTop}`);
    check(`${on}: …while its box has gone up with the page`, b1.boxTop < b1.paneTop - 100, `box at ${b1.boxTop}`);
    if (on === "shrink") check("shrink: the bar is shorter", /px$/.test(b1.height) && parseFloat(b1.height) < 60, b1.height || "no height set");
    if (on === "blur") check("blur: the bar is glass", /blur/.test(b1.filter), b1.filter || "no filter");
    if (on === "hide-then-show") check("hide-then-show: scrolling down hides it", b1.hidden && /-\d+px/.test(b1.translate), b1.translate || "not moved");
    await scrollBoard(300);
    const b2 = await board();
    if (on === "hide-then-show") check("hide-then-show: the first move up shows it", !b2.hidden && !/-\d+px/.test(b2.translate), b2.translate);
    await scrollBoard(0);
    const b3 = await board();
    check(`${on}: back at the top it is as drawn again`, b3.scrolled === null && b3.barTop === b0.barTop && (on !== "shrink" || b3.height === b0.height), `bar at ${b3.barTop}, height ${JSON.stringify(b3.height)}`);
  }

  /* -------------------------------------------------------- the Preview */
  await page.mouse.move(700, 400);
  await page.keyboard.press("p");
  await page.waitForTimeout(1500);
  const live = () => page.evaluate(() => {
    const sc = document.querySelector("[data-live-scroller]");
    const w = document.querySelector('[data-live-node="bar"]');
    const bar = w?.querySelector("[data-part]");
    return { scroller: !!sc, position: w ? getComputedStyle(w).position : "", wrapTop: Math.round(w?.getBoundingClientRect().top ?? -1), scTop: Math.round(sc?.getBoundingClientRect().top ?? -1),
      scrolled: w?.getAttribute("data-scrolled") ?? null, hidden: !!w?.hasAttribute("data-bar-hidden"), height: bar?.style.height ?? "", filter: bar?.style.backdropFilter ?? "", translate: bar?.style.translate ?? "", bg: bar?.style.background ?? "",
      frame: getComputedStyle(document.querySelector("[data-live-page]")).overflow };
  });
  const scrollLive = async (to) => { await page.evaluate((y) => { document.querySelector("[data-live-scroller]").scrollTop = y; }, to); await page.waitForTimeout(600); };
  const l0 = await live();
  check(`${on}: in Preview the bar's box is sticky`, l0.scroller && l0.position === "sticky", l0.position || "no bar");
  check(`${on}: …inside a frame that clips without scrolling, so it can stick to the Preview's window`, l0.frame === "clip", l0.frame);
  await scrollLive(500);
  const l1 = await live();
  check(`${on}: scrolled, the bar stays at the top of the window`, Math.abs(l1.wrapTop - l1.scTop) <= 1, `bar at ${l1.wrapTop}, window at ${l1.scTop}`);
  if (on === "static") check("static: nothing changes about it", l1.scrolled === null && l1.height === l0.height && !l1.filter, `${l1.scrolled} ${l1.height} ${l1.filter}`);
  if (on === "shrink") check("shrink: scrolled, the bar is shorter", l1.scrolled === "shrink" && /px$/.test(l1.height) && parseFloat(l1.height) < 60, `${l1.height}`);
  if (on === "blur") check("blur: scrolled, the bar is glass over the page", l1.scrolled === "blur" && /blur/.test(l1.filter) && /color-mix|transparent/.test(l1.bg), `${l1.filter} / ${l1.bg.slice(0, 40)}`);
  if (on === "hide-then-show") check("hide-then-show: scrolled down, the bar has gone up out of the window", l1.hidden && /-\d+px/.test(l1.translate), l1.translate || "not moved");
  await scrollLive(420);
  const l2 = await live();
  if (on === "hide-then-show") check("hide-then-show: one move up brings it back", !l2.hidden && !/-\d+px/.test(l2.translate), l2.translate);
  await scrollLive(0);
  const l3 = await live();
  if (on !== "static") check(`${on}: back at the top it is as it was`, l3.scrolled === null && l3.height === l0.height && l3.filter === l0.filter, `${l3.scrolled} ${l3.height} ${l3.filter}`);
  await page.keyboard.press("p");
  await page.waitForTimeout(600);

  /* ------------------------------------------------------- published */
  await page.waitForFunction(() => typeof window.__studioExport === "function", null, { timeout: 60000 });
  const files = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: f.encoding ? "" : f.content })));
  const index = files.find((f) => f.path === "index.html")?.content ?? "";
  const barTag = (index.match(/<[^>]*\bid="bar"[^>]*>/) ?? [""])[0];
  if (on === "static") {
    check("static: the published page carries no script for it", !/"feature":"sticky-bar"/.test(index) && !files.some((f) => f.path === "assets/features/sticky-bar.js"));
  } else {
    check(`${on}: the published page carries the script and binds it to the bar with the option`, files.some((f) => f.path === "assets/features/sticky-bar.js") && new RegExp(`"part":"bar","feature":"sticky-bar","inputs":\\{[^}]*"on":"${on}"`).test(index), (index.match(/"feature":"sticky-bar"[^}]*\}/) ?? ["no binding"])[0].slice(0, 120));
  }
  check(`${on}: …and the bar is sticky on it`, /position:\s*sticky/.test(barTag), barTag.slice(0, 160) || "no bar");
  if (on === "shrink") {
    const ctx2 = await browser.newContext({ viewport: { width: 1400, height: 800 } });
    await ctx2.route("**/*", (r) => {
      const u = new URL(r.request().url());
      if (u.host !== "published.test") return r.fulfill({ status: 200, contentType: "text/plain", body: "" });
      const p = decodeURIComponent(u.pathname).replace(/^\//, "") || "index.html";
      const f = files.find((x) => x.path === p);
      if (!f) return r.fulfill({ status: 404, body: "" });
      const type = p.endsWith(".css") ? "text/css" : p.endsWith(".js") ? "text/javascript" : p.endsWith(".json") ? "application/json" : "text/html";
      return r.fulfill({ status: 200, contentType: type, body: f.content });
    });
    const site = await ctx2.newPage();
    const siteErrors = [];
    site.on("pageerror", (e) => siteErrors.push(String(e).slice(0, 200)));
    await site.goto("https://published.test/index.html", { waitUntil: "load" });
    await site.waitForTimeout(1500);
    const pub = () => site.evaluate(() => { const w = document.getElementById("bar"); const bar = w?.firstElementChild; return { top: Math.round(w?.getBoundingClientRect().top ?? -1), scrolled: w?.getAttribute("data-scrolled") ?? null, height: bar?.style.height ?? "", y: window.scrollY }; });
    const p0 = await pub();
    await site.evaluate(() => window.scrollTo(0, 500));
    await site.waitForTimeout(700);
    const p1 = await pub();
    check("shrink, published: scrolled 500, the bar is still at the top of the window", p1.y === 500 && p1.top === 0, `bar at ${p1.top}`);
    check("shrink, published: …and shorter", p1.scrolled === "shrink" && /px$/.test(p1.height) && parseFloat(p1.height) < 60, p1.height || "no height set");
    await site.evaluate(() => window.scrollTo(0, 0));
    await site.waitForTimeout(700);
    const p2 = await pub();
    check("shrink, published: back at the top it is as it was", p2.scrolled === null && p2.height === p0.height, `${p2.height}`);
    check("shrink, published: no page errors", siteErrors.length === 0, siteErrors.join(" | "));
    await ctx2.close();
  }
  check(`${on}: no page errors in the Builder`, errors.length === 0, errors.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
