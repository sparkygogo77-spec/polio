#!/usr/bin/env node
/**
 * EACH GREEN CHIP ON AN IMPORT'S STRIP SAYS WHAT IT COUNTS ON HOVER.
 *
 * J (2026-10-06): "some of these icons make sense based on the icon ...
 * but i would like to hover them and see what each of them mean." Hovering
 * a chip opens a label with the chip's name and what that kind of part is,
 * and running along the row opens every chip's label in turn.
 *
 *   npx next start -p 3013
 *   node tests/import-chip-labels.mjs http://127.0.0.1:3013
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
  /* An import from a small page, then a hover over each chip. */
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
  const chips = page.locator("[data-import-chip]");
  const n = await chips.count();
  check("the import drew chips", n >= 3, String(n));
  const said = [];
  for (let i = 0; i < n; i++) {
    const c = chips.nth(i);
    /* From chip to chip, as a person runs along the row. */
    const box = await c.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await page.waitForTimeout(700);
    /* The open label is the one the chip points at while hovered. */
    const tip = await c.evaluate((el) => { const id = el.getAttribute("aria-describedby"); return id ? document.getElementById(id)?.textContent ?? null : null; });
    said.push({ k: await c.getAttribute("data-import-chip"), tip });
  }
  check("hovering each chip shows a label", said.every((s) => s.tip && s.tip.length > 8), J(said));
  const btn = said.find((s) => s.k === "button");
  check("…the buttons' label names them and says what they are", /^Buttons: 1 button, things a person presses/.test(btn?.tip ?? ""), J(btn));
  const sec = said.find((s) => s.k === "section");
  check("…the sections' label says they hold other parts", /^Sections: \d+ sections?, boxes that hold other parts/.test(sec?.tip ?? ""), J(sec));
  await page.close();
}

check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
