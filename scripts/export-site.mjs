#!/usr/bin/env node
/**
 * Write the site out as HTML and CSS, into a folder you can open.
 *
 * Brings sink in through the real door (as scripts/import-measure.mjs does),
 * asks the Builder for the export (`window.__studioExport`, exportSite.ts),
 * and writes every file under <out dir>: an index.html per page, one
 * stylesheet, the pictures. Open <out dir>/index.html straight from disk;
 * nothing it needs is anywhere else. Nothing is published and nothing leaves
 * the machine.
 *
 *   npm run build && npx next start -p 3013
 *   node scripts/export-site.mjs http://127.0.0.1:3013 <path to a sink checkout> <out dir>
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3];
const OUT = process.argv[4];
if (!SINK || !OUT || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node scripts/export-site.mjs <builder url> <path to a sink checkout> <out dir>");
  process.exit(2);
}
const DOC = readFileSync(join(SINK, "site/document.json"));
const doc = JSON.parse(DOC.toString("utf8"));
const byId = new Map(doc.nodes.map((n) => [n.id, n]));
const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
const REPO = "/repos/sparkygogo77-spec/sink";
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
  ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
];

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
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
  if (pic) return j({ encoding: "base64", content: readFileSync(join(SINK, "assets/pictures", pic[1])).toString("base64") });
  return j({ message: "no" }, 404);
});

/* The saved document: the localStorage mirror when it holds one, else (a pointer: the document lives in IndexedDB) the board's own. */
const state = () => page.evaluate(() => {
  const env = JSON.parse(localStorage.getItem("builder.studio") || "{}");
  if (env.state) return env.state;
  if (env.idb && window.__studioPublishDoc) return window.__studioPublishDoc();
  return {};
});
/** Every part's [page, y, h] as saved. */
const positions = async () => Object.fromEntries(((await state()).nodes ?? []).map((n) => [n.id, [n.pageId, n.y, n.h]]));

/* An empty site, opened first. */
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/* A placeholder token, through the Keys panel, the way his goes in. */
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

/* The door. */
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
await page.locator("[data-repo-pull]").click();
for (let i = 0; i < 90 && ((await state()).nodes?.length ?? 0) < 100; i++) await page.waitForTimeout(1000);
await page.waitForTimeout(3000);

const files = await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
await browser.close();
if (!files?.length) { console.error("The Builder gave no export."); process.exit(1); }
const { mkdirSync } = await import("node:fs");
const { dirname: dir } = await import("node:path");
for (const f of files) {
  const at = join(OUT, f.path);
  mkdirSync(dir(at), { recursive: true });
  writeFileSync(at, f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content);
}
console.log(`${files.length} files written under ${OUT}:`);
for (const f of files) console.log(`  ${f.path}  ${Math.round((f.encoding === "base64" ? Buffer.from(f.content, "base64").length : Buffer.byteLength(f.content)) / 1024)} KB`);
console.log(`Open ${join(OUT, "index.html")} in a browser. Page errors while exporting: ${errors.length}`);
