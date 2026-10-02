#!/usr/bin/env node
/**
 * WHERE THE RIBBONS CROSS, THE RED ONE IS ON TOP: ON THE BOARD, IN PREVIEW,
 * AND ON THE PUBLISHED PAGE.
 *
 * THE OWNER'S REPORT, traced by the polish lane: on trumpmorty.fun the red
 * ribbon row (`z-index: 2` inside the tape) lies over the navy one wherever
 * they cross; his published copy had navy on top. Sink emitted the red row
 * first (a z-auto band ranked by its context's z-index, the red one by its
 * own); from sink 2521ca7 the parts come in the order the browser paints
 * them. Here: sink's trumpmorty.fun brought in through the real door, and
 * on each surface every point on a 16px grid where both rows are hit, the
 * browser's own hit-test stack (`elementsFromPoint`, with pointer events
 * turned on for the reading) is asked which is on top. The red row and its
 * words must be, at every such point.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/ribbon-order.mjs http://127.0.0.1:3013 <the capture folder>
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3] ?? join(here, "..", "capture", "versions", "sink-0ee06fa");
const SITE = join(SINK, "sites", "trumpmorty-fun");
if (!existsSync(join(SITE, "site", "document.json"))) { console.error(`usage: node tests/ribbon-order.mjs <builder url> <capture folder>; no ${SITE}/site/document.json`); process.exit(2); }
const DOC = readFileSync(join(SITE, "site", "document.json"));
const doc = JSON.parse(DOC.toString("utf8"));
const pics = existsSync(join(SITE, "assets", "pictures")) ? readdirSync(join(SITE, "assets", "pictures")) : [];
const REPO = "/repos/sparkygogo77-spec/sink";
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
  ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
];

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);

/* The two rows, and what is inside each (its track and words). */
const RED_BG = "rgb(210, 60, 52)", NAVY_BG = "rgb(41, 47, 68)";
const row = (bg) => doc.nodes.find((n) => n.colour?.bg === bg && /^body > main > div > div:nth-of-type\(\d\)$/.test(n.from?.selector ?? ""));
const red = row(RED_BG), navy = row(NAVY_BG);
const inside = (r) => doc.nodes.filter((n) => n === r || (n.from?.selector ?? "").startsWith(`${r.from.selector} > `)).map((n) => n.id);
check("sink's document has the red and the navy ribbon rows", !!red && !!navy, J([red?.id, navy?.id]));
const RED = red ? inside(red) : [], NAVY = navy ? inside(navy) : [];
check("…and the red row, with its words, comes after the navy row in the parts", RED.length > 0 && NAVY.length > 0 && Math.min(...RED.map((id) => doc.nodes.findIndex((n) => n.id === id))) > Math.max(...NAVY.map((id) => doc.nodes.findIndex((n) => n.id === id))), J({ RED, NAVY }));

/** On one surface: at each point both rows are hit, which is on top. `attr` names a part's element. */
const crossings = (p, how) => p.evaluate(({ RED, NAVY, how }) => {
  const idOf = (el) => (how === "id" ? el.closest("[id]")?.id : el.closest(`[${how}]`)?.getAttribute(how)) ?? null;
  const find = (id) => (how === "id" ? document.getElementById(id) : document.querySelector(`[${how}="${id}"]`));
  const on = document.createElement("style");
  on.textContent = "*{pointer-events:auto !important}";
  document.head.append(on);
  const a = find(RED[0])?.getBoundingClientRect(), b = find(NAVY[0])?.getBoundingClientRect();
  const out = { points: 0, red: 0, navy: 0, where: null };
  if (a && b) {
    const x0 = Math.max(a.left, b.left, 0), x1 = Math.min(a.right, b.right, innerWidth), y0 = Math.max(a.top, b.top, 0), y1 = Math.min(a.bottom, b.bottom, innerHeight);
    for (let x = x0 + 8; x < x1; x += 16) for (let y = y0 + 1; y < y1; y += 4) {
      const ids = document.elementsFromPoint(x, y).map(idOf);
      const r = ids.findIndex((i) => RED.includes(i)), n = ids.findIndex((i) => NAVY.includes(i));
      if (r < 0 || n < 0) continue;
      out.points++;
      if (r < n) out.red++; else { out.navy++; out.where ??= [Math.round(x), Math.round(y)]; }
    }
  }
  on.remove();
  return out;
}, { RED, NAVY, how });
const holds = (label, c) => check(`${label}: where the ribbons cross, the red one is on top`, c.points >= 10 && c.navy === 0, J(c));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1640, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  if (!u.pathname.startsWith(REPO)) return j({ message: "no" }, 404);
  const rest = u.pathname.slice(REPO.length);
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: DOC.toString("base64") });
  const pic = decodeURIComponent(rest).match(/^\/git\/blobs\/pic:(.+)$/);
  if (pic) return j({ encoding: "base64", content: readFileSync(join(SITE, "assets/pictures", pic[1])).toString("base64") });
  return j({ message: "no" }, 404);
});
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});

/* An empty site, a placeholder key, and the repository brought in. */
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click();
await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await page.waitForTimeout(500);
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
await page.locator("[data-repo-pull]").click();
for (let i = 0; i < 90 && ((await state()).nodes?.length ?? 0) < 100; i++) await page.waitForTimeout(1000);
await page.waitForTimeout(3000);


let files = await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
check("the site exports", Array.isArray(files) && files.some((f) => f.path === "index.html"), J((files ?? []).map((f) => f.path).slice(0, 5)));

const out = mkdtempSync(join(tmpdir(), "layer-units-"));
for (const f of files ?? []) { mkdirSync(dirname(join(out, f.path)), { recursive: true }); writeFileSync(join(out, f.path), f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
const types = { html: "text/html", css: "text/css", js: "text/javascript", webp: "image/webp", png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml", woff2: "font/woff2" };
const server = http.createServer((req, res) => {
  let p = join(out, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, ""));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[p.split(".").pop()] ?? "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const SITEURL = `http://127.0.0.1:${server.address().port}/`;

/* The board. */
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
{
  const at = await page.evaluate((id) => { const e = document.querySelector(`[data-node-id="${id}"]`); if (!e) return null; e.scrollIntoView({ block: "center" }); return true; }, RED[0]);
  await page.waitForTimeout(800);
  holds("board", at ? await crossings(page, "data-node-id") : { points: 0 });
}
/* The Preview. */
await page.goto(`${BASE}/builder/preview`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 40 && (await page.evaluate(() => !!document.querySelector("[data-crt]"))); i++) await page.waitForTimeout(250);
await page.waitForTimeout(1500);
await page.evaluate((id) => document.querySelector(`[data-live-node="${id}"]`)?.scrollIntoView({ block: "center" }), RED[0]);
await page.waitForTimeout(800);
holds("Preview", await crossings(page, "data-live-node"));
/* The published page. */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.route("https://dexscreener.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<body style='background:#111'></body>" }));
  await p.goto(SITEURL, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  await p.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: "center" }), RED[0]);
  await p.waitForTimeout(800);
  holds("export", await crossings(p, "id"));
  await ctx.close();
}
server.close();
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
