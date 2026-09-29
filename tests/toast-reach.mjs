#!/usr/bin/env node
/**
 * A TOAST'S WHOLE MESSAGE CAN BE OPENED, NOTHING IN THE CORNER IS COVERED,
 * AND ONE IMPORT RINGS ONCE.
 *
 * The owner: the toast's close button covered the expand button, so a long
 * message (the import's report) could not be opened. The body was a single
 * truncated line and Dismiss was the card's only control, and the toasts sat
 * over the phone preview's own Expand in the bottom-right corner. And an
 * import said each step on its card, each update ringing again.
 *
 *   node tests/toast-reach.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
/* Every sound started, timed: starts within 150ms of each other are one ring. */
await page.addInitScript(() => {
  window.__starts = [];
  const s = AudioScheduledSourceNode.prototype.start;
  AudioScheduledSourceNode.prototype.start = function (...a) { window.__starts.push(performance.now()); return s.apply(this, a); };
});
const rings = (from) => page.evaluate((t) => { let n = 0, last = -1e9; for (const at of window.__starts) { if (at < t) continue; if (at - last > 150) n++; last = at; } return n; }, from);
const PAGE = `<!doctype html><html><head><title>A page</title></head><body><header style="padding:40px;background:#123;color:#fff"><h1>Blackorb</h1><p>A small studio.</p></header><main style="padding:40px"><h2>What we make</h2><p>Sites, mostly.</p></main></body></html>`;
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: J(b) });
  if (u.pathname === "/repos/him/page") return j({ default_branch: "main", homepage: "" });
  if (u.pathname.startsWith("/repos/him/page/git/trees/")) return j({ tree: [{ path: "index.html", type: "blob", sha: "p1", size: PAGE.length }] });
  if (u.pathname === "/repos/him/page/git/blobs/p1") return j({ encoding: "base64", content: Buffer.from(PAGE).toString("base64") });
  return j({ message: "no" }, 404);
});
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => { localStorage.clear(); const env = (s) => JSON.stringify({ state: s, version: 0 }); localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Scratch", updatedAt: Date.now() }], activeId: "s1" })); localStorage.setItem("builder.studio", env({ nodes: [] })); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/* 1. A long message: Go live pressed with no keys says why, at length. */
await page.locator("header [data-go-live]").click({ force: true });
await page.waitForTimeout(600);
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
const kc = page.getByRole("button", { name: "Close keys" }); if (await kc.count()) { await kc.click().catch(() => {}); await page.waitForTimeout(300); }
const card = page.locator(".animate-toast-in").filter({ hasText: "Go live" }).first();
check("the long message is on a card", (await card.count()) === 1);
const boxes = await card.evaluate((c) => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
  const x = c.querySelector('[aria-label="Dismiss"]'), o = c.querySelector("[data-toast-expand]");
  const hit = (e) => { const b = e?.getBoundingClientRect(); return b ? e.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)) : false; };
  return { dismiss: r(x), open: r(o), dismissHit: hit(x), openHit: hit(o) };
});
const apart = (a, b) => !!a && !!b && (a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
check("it has an Open button of its own", !!boxes.open, J(boxes));
check("…not under Dismiss, and both can be pressed", apart(boxes.dismiss, boxes.open) && boxes.dismissHit && boxes.openHit, J(boxes));
if (boxes.open) await card.locator("[data-toast-expand]").click();
await page.waitForTimeout(400);
const body = await card.evaluate((c) => { const b = c.querySelector("[data-toast-body]"); return b ? { state: b.getAttribute("data-toast-body"), whole: b.scrollWidth <= b.clientWidth + 1, text: b.textContent } : null; });
check("Open shows the whole message", body?.state === "open" && body.whole && /Ctrl\+Shift\+K/.test(body.text ?? ""), J(body));
await page.waitForTimeout(8500);
check("…and an opened card stays until it is closed", (await card.count()) === 1);
const corner = await page.evaluate(() => {
  const t = document.querySelector('[data-preview-window] [aria-label="Toggle companion"]');
  if (!t) return null;
  const b = t.getBoundingClientRect();
  return t.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
});
check("the phone preview's own Expand is not under a toast", corner === true, String(corner));
await card.locator('[aria-label="Dismiss"]').click().catch(() => {});

/* 2. One import, one ring. */
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click(); await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click(); await page.waitForTimeout(3000);
const from = await page.evaluate(() => performance.now());
await page.locator("[data-bring-repo]").first().click(); await page.waitForTimeout(600);
await page.locator("[data-repo-bring]").fill("him/page");
await page.locator("[data-repo-pull]").click();
for (let i = 0; i < 60; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => document.body.innerText.includes("landed on the board"))) break; }
await page.waitForTimeout(1500);
const heard = await rings(from);
check("an import's steps ring once, not once a step", heard === 1, `${heard} rings`);
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
