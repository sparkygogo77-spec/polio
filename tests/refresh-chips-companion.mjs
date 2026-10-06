#!/usr/bin/env node
/**
 * REFRESH ASKS EVEN WHEN UP TO DATE, AN IMPORT'S COUNTS ARE CHIPS, AND THE
 * PHONE PREVIEW HIDES AND GOES ALL THE WAY DOWN.
 *
 * J (2026-10-06):
 *   · "if refresh button is up to date already, it should also Rebring in
 *     and pop up the message of clear or keep changes";
 *   · the import's line was a paragraph: "make symbols of what can", green,
 *     an icon and its count, short words for the rest;
 *   · the floating Phone preview "cant be dragged below a certain point on
 *     the screen and i cant seem to toggle it off".
 *
 *   npx next start -p 3013
 *   node tests/refresh-chips-companion.mjs http://127.0.0.1:3013
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
const env = (s) => JSON.stringify({ state: s, version: 0 });
const errors = [];
const PAGE = `<!doctype html><html><head><title>A page</title></head><body><header><h1>Blackorb</h1><p>A small studio. <a href="/about">About</a></p><button>Start</button></header><main><h2>What we make</h2><p>Sites, mostly.</p><a href="/work">Work</a></main></body></html>`;
const SHA = "abc1234def5678abc1234def5678abc1234def56";

async function open(doc, builds) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://api.github.com/**", (r) => {
    const u = new URL(r.request().url());
    const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: J(b) });
    if (u.pathname.startsWith("/repos/them/app/commits/")) return j({ sha: SHA });
    if (u.pathname === "/repos/him/page") return j({ default_branch: "main", homepage: "" });
    if (u.pathname.startsWith("/repos/him/page/git/trees/")) return j({ tree: [{ path: "index.html", type: "blob", sha: "p1", size: PAGE.length }] });
    if (u.pathname === "/repos/him/page/git/blobs/p1") return j({ encoding: "base64", content: Buffer.from(PAGE).toString("base64") });
    return j({ message: "no" }, 404);
  });
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ doc, builds }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, { doc, builds });
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  return page;
}

{
  /* 1. Up to date, Refresh still asks: keep my changes, or clear and bring in. */
  const node = { id: "a", pageId: "page_home", featureId: "prose", label: "", prompt: "", content: "From code", data: "", x: 80, y: 40, w: 300, h: 60, groupId: null, options: {}, priority: "must", custom: false };
  const look = { palette: {}, texture: [], target: "page", styleSource: { repo: "them/app", ref: "main", dir: "web/", files: [], commit: SHA } };
  const page = await open(
    env({ pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [node], frameWidth: 1440, look }),
    env({ projects: [{ id: "s1", name: "Code", updatedAt: Date.now(), nudged: true }], activeId: "s1" }),
  );
  const btn = page.locator("header [data-code-refresh]").first();
  for (let i = 0; i < 20 && (await btn.getAttribute("data-code-status")) === "reading"; i++) await page.waitForTimeout(250);
  check("Refresh reads as up to date", (await btn.getAttribute("data-code-status")) === "current", await btn.getAttribute("data-code-status"));
  await btn.click();
  await page.waitForTimeout(500);
  const keep = await page.locator("[data-code-refresh-keep]").count();
  const go = await page.locator("[data-code-refresh-go]").count();
  check("…and pressing it still asks: keep my changes, or clear and bring in", keep === 1 && go === 1, J({ keep, go }));
  await page.close();
}

{
  /* 2. An import's counts are green icon-and-number chips; the long account is under "details". */
  const page = await open(env({ nodes: [] }), env({ projects: [{ id: "s1", name: "Scratch", updatedAt: Date.now() }], activeId: "s1" }));
  const keys = page.locator("[data-keys-panel]");
  await page.getByRole("button", { name: "Keys", exact: true }).click(); await page.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await page.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click(); await page.waitForTimeout(1500);
  await page.locator("[data-bring-repo]").first().click(); await page.waitForTimeout(600);
  await page.locator("[data-repo-bring]").fill("him/page");
  await page.locator("[data-repo-pull]").click();
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(500); if (await page.locator("[data-import-chips]").count()) break; }
  const strip = await page.evaluate(() => {
    const s = document.querySelector("[data-import-strip]");
    if (!s) return null;
    const chips = [...s.querySelectorAll("[data-import-chip]")].map((c) => ({ k: c.getAttribute("data-import-chip"), n: c.textContent, svg: !!c.querySelector("svg"), colour: getComputedStyle(c).color }));
    const shown = [...s.querySelector("span.flex-1")?.childNodes ?? []].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("");
    return { chips, shown, details: !!s.querySelector("[data-said-details]") };
  });
  const link = strip?.chips.find((c) => c.k === "button");
  check("the counts are chips with an icon each", !!strip && strip.chips.length >= 3 && strip.chips.every((c) => c.svg), J(strip?.chips));
  check("…the buttons' chip says 1", link?.n === "1", J(link));
  check("…and they are green", !!link && /oklch\(0\.82 0\.17 150|rgb\(\d+, 2\d\d, \d+\)/.test(link.colour), link?.colour);
  check("the words beside them are one short line, the rest under details", !!strip && strip.shown.length < 160 && /landed/.test(strip.shown) && strip.details, J(strip?.shown));
  await page.close();
}

{
  /* 3. The phone preview: its eye hides it, the eye by the device switch brings it back, and it drags to the foot. */
  const page = await open(env({ nodes: [] }), env({ projects: [{ id: "s1", name: "Scratch", updatedAt: Date.now() }], activeId: "s1" }));
  const win = page.locator("[data-preview-window]");
  check("the phone preview is there", (await win.count()) === 1);
  await win.locator("[data-companion-hide]").click(); await page.waitForTimeout(300);
  check("its eye hides it", (await win.count()) === 0);
  await page.locator("[data-companion-toggle]").click(); await page.waitForTimeout(300);
  check("the eye beside the device switch brings it back", (await win.count()) === 1);
  const bar = await win.locator("header").boundingBox();
  const col = await win.evaluate((w) => { const p = w.offsetParent.getBoundingClientRect(); return { bottom: p.bottom, top: p.top }; });
  await page.mouse.move(bar.x + 20, bar.y + bar.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar.x + 20, col.top + 100, { steps: 5 });
  await page.mouse.move(bar.x + 20, col.bottom + 200, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await win.boundingBox();
  check("it drags down to the column's foot", Math.abs(col.bottom - (after.y + after.height)) <= 12, J({ foot: col.bottom, bottom: after.y + after.height }));
  await page.close();
}

check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
