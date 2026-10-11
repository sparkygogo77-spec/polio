#!/usr/bin/env node
/**
 * "KEEP MY CHANGES" KEEPS THEM ON A SITE READ FROM ITS FILES, MATCHED BY data-hook.
 *
 * Dissect 2026-10-10 #1 and #3: on PonsStars (a site read from its code,
 * part by part), Refresh → "Keep my changes" said it kept what the owner
 * changed and replaced the board whole: the keep ran only for a site made
 * here. And the merge matched parts by the path of their element, so one
 * part the code added before his renumbered every later one.
 *
 * Here, through the real door, with GitHub a stand-in in the browser: a
 * small hooked page is brought in; the owner moves its button and colours
 * its heading; the code then adds a banner before his parts and rewrites a
 * heading; he presses Refresh → Keep my changes.
 *
 *   1. the first bring-in records the board as brought in;
 *   2. after the keep, the button is where he put it and the heading wears
 *      his colour, though the code moved both along the page;
 *   3. the banner the code added is on the board, and the heading the code
 *      rewrote has the code's words;
 *   4. the line says what it kept; one Ctrl+Z puts his board back.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/reimport-code-keeps.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/bring-in/fromasite/FromASite.tsx, src/features/studio/bring-in/reimport.ts, src/features/studio/CodeSiteButtons.tsx
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`); };
const J = (x) => JSON.stringify(x);
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

const page1 = (banner, what) => `<!doctype html><html><head><title>A page</title><style>body{margin:0;font:16px/1.4 sans-serif}header,main{padding:24px}h1{font-size:40px}button{padding:8px 16px}</style></head><body data-hook="app">
<header data-hook="top">${banner ? `<p data-hook="banner">Now on devnet.</p>` : ""}<h1 data-hook="title">Blackorb</h1><p data-hook="intro">A small studio. <a data-hook="about" href="/about">About</a></p><button data-hook="start">Start</button></header>
<main data-hook="main"><h2 data-hook="what">${what}</h2><p data-hook="made">Sites, mostly.</p><a data-hook="work" href="/work">Work</a></main></body></html>`;
const OLD = page1(false, "What we make"), NEW = page1(true, "What we build now");
const SHA1 = "1".repeat(40), SHA2 = "2".repeat(40);
let served = OLD;
const errors = [];

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: J(b) });
  if (!u.pathname.startsWith("/repos/him/page")) return j({ message: "no" }, 404);
  const rest = u.pathname.slice("/repos/him/page".length);
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree: [{ path: "index.html", type: "blob", sha: served === OLD ? "p1" : "p2", size: served.length }] });
  if (rest === "/git/blobs/p1") return j({ encoding: "base64", content: Buffer.from(OLD).toString("base64") });
  if (rest === "/git/blobs/p2") return j({ encoding: "base64", content: Buffer.from(NEW).toString("base64") });
  if (rest.startsWith("/commits/")) return j({ sha: served === OLD ? SHA1 : SHA2 });
  return j({ message: "no" }, 404);
});
const env = (s) => J({ state: s, version: 0 });
await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(({ doc, builds }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, { doc: env({ nodes: [] }), builds: env({ projects: [{ id: "s1", name: "Scratch", updatedAt: Date.now() }], activeId: "s1" }) });
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const until = async (fn, ms = 90000) => { for (let t = 0; t < ms; t += 500) { if (await fn()) return true; await page.waitForTimeout(500); } return false; };
const byHook = (s, h) => (s.nodes ?? []).find((n) => n.hooks?.["data-hook"] === h);

/* The key, a stand-in; then the page is brought in. */
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click(); await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("STANDIN_GITHUB_TOKEN_placeholder");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click(); await page.waitForTimeout(1500);
await page.locator("[data-bring-repo]").first().click(); await page.waitForTimeout(600);
await page.locator("[data-repo-bring]").fill("him/page");
await page.locator("[data-repo-pull]").click();
check("the page lands, part by part", await until(async () => !!byHook(await state(), "start") && !!byHook(await state(), "what")), J((await state()).nodes?.map((n) => n.hooks?.["data-hook"])));
await page.waitForTimeout(2000);
const first = await state();
check("1. the first bring-in records the board as brought in, keyed by hooks", first.taken?.v === 1 && first.taken?.keys === "hook" && Object.keys(first.taken.nodes ?? {}).some((k) => k.includes("@data-hook=start")), J(Object.keys(first.taken?.nodes ?? {}).slice(0, 4)));

/* His changes: the button moved, the heading coloured. */
const start = byHook(first, "start"), title = byHook(first, "title");
const edited = { ...first, nodes: first.nodes.map((n) => (n === start ? { ...n, x: n.x + 60, byHand: true } : n === title ? { ...n, colour: { ...(n.colour ?? {}), text: "#ff00aa" } } : n)) };
await page.evaluate((d) => window.__studioLoadDoc(d), edited);
await page.waitForTimeout(1200);
const his = await state();
check("his changes are on the board, the record still with it", byHook(his, "start")?.x === start.x + 60 && byHook(his, "title")?.colour?.text === "#ff00aa" && his.taken?.at === first.taken?.at, J({ x: byHook(his, "start")?.x, colour: byHook(his, "title")?.colour }));

/* The code adds a banner before his parts and rewrites a heading; he keeps his changes. */
served = NEW;
const btn = page.locator("header [data-code-refresh]").first();
check("Refresh is there for a site read from its code", (await btn.count()) === 1);
await btn.click(); await page.waitForTimeout(600);
const keep = page.locator("[data-code-refresh-keep]");
check("…and offers to keep his changes", (await keep.count()) === 1);
await keep.click();
const done = await until(async () => { const s = await state(); return !!s.taken && s.taken.at !== his.taken?.at; }, 120000);
check("the code as it is now is brought in over the board", done, (await page.evaluate(() => document.body.innerText)).split("\n").filter((l) => /him\/page|could not|stopped/i.test(l)).slice(0, 4).join(" | "));
await page.waitForTimeout(1500);
const now = await state();
const s2 = byHook(now, "start"), t2 = byHook(now, "title");
check("2. the button is where he put it, though the code moved it along the page", s2?.x === start.x + 60 && s2?.byHand === true && s2?.id === start.id, J({ x: s2?.x, his: start.x + 60, id: s2?.id, was: start.id }));
check("…the heading wears his colour", t2?.colour?.text === "#ff00aa", J(t2?.colour));
const banner = byHook(now, "banner");
check("3. the banner the code added is on the board, before his parts", !!banner && banner.y <= (t2?.y ?? 0), J({ banner: banner && { y: banner.y, content: banner.content }, title: t2?.y }));
check("…the heading the code rewrote has the code's words", /What we build now/.test(J(byHook(now, "what")?.content)), J(byHook(now, "what")?.content));
check("…the record is this bring-in's, by hooks", now.taken?.keys === "hook" && now.taken.at !== his.taken.at);
const said = await page.evaluate(() => document.body.innerText);
check("4. the line says what it kept", /kept your changes on 2 parts/i.test(said), (said.match(/Brought in again[^\n]*/) ?? ["nothing said"])[0]);

/* One undo puts his board back. */
await page.mouse.click(10, 890);
await page.keyboard.press("Control+z");
await page.waitForTimeout(1500);
const undone = await state();
check("one Ctrl+Z puts his board back: no banner, his button, the old heading's words", !byHook(undone, "banner") && byHook(undone, "start")?.x === start.x + 60 && /What we make/.test(J(byHook(undone, "what")?.content)), J({ banner: !!byHook(undone, "banner"), x: byHook(undone, "start")?.x, what: byHook(undone, "what")?.content }));

check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
