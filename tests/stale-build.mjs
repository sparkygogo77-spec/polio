/**
 * A PAGE RUNNING AN OLDER BUILD THAN THE SERVER SAYS SO, AND STOPS.
 *
 * Driven by hand: a deploy went out while a tab stayed open, and from then
 * on pressing Bring it did nothing. The tab held the code it had loaded;
 * whatever that code loaded on demand no longer existed on the server, and
 * the press failed inside itself, in silence.
 *
 * The page knows the build it came from and asks the server which build it
 * is serving. When they differ, or the browser reports a chunk it could not
 * load, a banner says so with Reload as the one thing to press, and Bring
 * it refuses with the same sentence rather than running quietly.
 *
 *   node tests/stale-build.mjs [url]
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

/* 1. The build the page came from matches the server: no banner. */
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const real = await (await fetch(`${URL_BASE}/api/version`)).json();
check("the server says when it was built", typeof real.builtAt === "string" && real.builtAt.length > 10, String(real.builtAt));
check("on a page from that same build there is no banner", (await page.locator("[data-stale-build]").count()) === 0);

/* 2. The server is a newer build than the page: said, with Reload. */
await page.route("**/api/version", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...real, builtAt: "2030-01-01T00:00:00.000Z" }) }));
await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await page.evaluate(() => window.dispatchEvent(new Event("focus")));
await page.waitForTimeout(1500);
const banner = await page.evaluate(() => { const b = document.querySelector("[data-stale-build]"); return b ? { why: b.getAttribute("data-stale-build"), text: b.textContent, reload: !!b.querySelector("[data-stale-reload]") } : null; });
check("when the server is a newer build than the page, a banner says so in words", !!banner && banner.why === "server" && /running an older build than the server: this page was built/.test(banner.text ?? "") && /the server has a newer one/.test(banner.text ?? ""), banner?.text ?? "no banner");
check("and the banner is a row of its own, not over the bar: the GitHub button is still there to press", await page.locator("[data-github-button]").first().isVisible());
check("with Reload as the one thing to press", !!banner?.reload);
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill("him/anything");
await page.locator("[data-repo-pull]").click();
await page.waitForTimeout(600);
const said = await page.evaluate(() => document.querySelector("[data-repo-said]")?.textContent ?? "");
check("and Bring it refuses with the same sentence rather than running quietly", /older build than the server/.test(said) && /Reload the page/.test(said), said.slice(0, 160));
const spaces = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem("builder.studio")).state.spaces ?? []).length; } catch { return -1; } });
check("with nothing started", spaces <= 0, spaces < 0 ? "no document saved yet, so nothing" : `${spaces} spaces`);
await page.keyboard.press("Escape");
await page.unroute("**/api/version");

/* 3. A chunk the browser could not load, on a fresh page: the banner too. */
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
check("a fresh page from the current build starts clean", (await page.locator("[data-stale-build]").count()) === 0);
await page.evaluate(() => window.dispatchEvent(new ErrorEvent("error", { message: "ChunkLoadError: Loading chunk 4242 failed." })));
await page.waitForTimeout(400);
const chunk = await page.evaluate(() => document.querySelector("[data-stale-build]")?.textContent ?? null);
check("a chunk that could not be loaded is the same banner, naming what happened", !!chunk && /out of date since the last deploy/.test(chunk) && /Reload the page/.test(chunk), chunk ?? "no banner");

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
