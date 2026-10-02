#!/usr/bin/env node
/**
 * THE HERO'S LAYERS FOLLOW THE WINDOW AS THE ORIGINAL'S DO.
 *
 * THE OWNER'S REPORT, trump-morty-trorty.vercel.app beside trumpmorty.fun:
 * the site places the hero's sky, both deserts, the big planet and the
 * ringed planet in the window's units and in shares of the hero (100svh
 * tall), so at any window or browser zoom they stay put while the content
 * scales. The export placed them in the px measured at 1440 × 900: at other
 * sizes the planet was a huge disk cut by a straight edge, the ringed planet
 * on the TV's corner, and the layout shifted.
 *
 * Through the real door (sink's trumpmorty.fun brought in, GitHub stood in
 * for as tests/captured-behaviours.mjs does), exported and served, then
 * opened at 1440 × 900, 2000 × 1100, and 2000 × 1100 at 85% and 110% page
 * zoom (a window of 2000/z CSS px at a device scale of z). For each layer
 * sink recorded in units, its box (offsetLeft/Top/Width/Height, so the
 * planet's spin does not count) is held to what its written rule gives in
 * the hero as the export draws it: `-16vw` is 0.16 of the window's width,
 * `36%` of the hero's height is 0.36 of it. No expected number is written
 * here; each is the rule's, in the window it is opened in.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/layer-units.mjs http://127.0.0.1:3013 <the capture folder>
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
const SHOTS = process.env.SHOTS ?? null;
const SITE = join(SINK, "sites", "trumpmorty-fun");
if (!existsSync(join(SITE, "site", "document.json"))) { console.error(`usage: node tests/layer-units.mjs <builder url> <capture folder>; no ${SITE}/site/document.json`); process.exit(2); }
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

/* The hero and the layers placed in it in units, from the document. */
const hero = doc.nodes.find((n) => n.vh?.minHeight && n.pageId === "page_home");
const layers = doc.nodes.filter((n) => n.units?.of?.part === hero?.id);
const name = (n) => { const u = n.units; return u.top && u.bottom ? "sky" : u.right && u.width ? "ringed planet" : u.width ? "planet" : parseFloat(u.bottom) > 0 ? "far desert" : "near desert"; };
check("sink's document carries the hero (100svh) and its layers in units", !!hero && layers.length >= 5, J({ hero: hero?.id, layers: layers.map((n) => [n.id, name(n)]) }));

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

/* A written length, in a window vw × vh, against a reference of `ref` px. */
const len = (v, ref, vw, vh) => Function(`return ${v.replace(/calc\(/g, "(").replace(/min\(/g, "Math.min(").replace(/max\(/g, "Math.max(")
  .replace(/(-?[\d.]+)%/g, (m, n) => `(${n} * ${ref} / 100)`).replace(/(-?[\d.]+)s?vw/g, (m, n) => `(${n} * ${vw} / 100)`).replace(/(-?[\d.]+)s?vh/g, (m, n) => `(${n} * ${vh} / 100)`).replace(/(-?[\d.]+)px/g, "$1")}`)();
/** Where the rule puts a layer in a hero of hx, hy, hw, hh, in a window vw × vh. */
const want = (n, H, vw, vh) => {
  const u = n.units;
  const along = (near, far, size, start, span, own) => {
    const s = size !== undefined ? len(size, span, vw, vh) : near !== undefined && far !== undefined ? span - len(near, span, vw, vh) - len(far, span, vw, vh) : own;
    const at = near !== undefined ? start + len(near, span, vw, vh) : far !== undefined ? start + span - len(far, span, vw, vh) - s : null;
    return [at, s];
  };
  const [x, w] = along(u.left, u.right, u.width, H.x, H.w, n.w);
  const ownH = (n.picture || n.featureId === "picture") && u.width !== undefined && u.height === undefined ? w * n.h / n.w : n.h;
  const [y, h] = along(u.top, u.bottom, u.height, H.y, H.h, ownH);
  return { x, y: y ?? n.y, w, h };
};

const CONDS = [["1440 × 900", 1440, 900, 1], ["2000 × 1100", 2000, 1100, 1], ["2000 × 1100 at 85%", 2000, 1100, 0.85], ["2000 × 1100 at 110%", 2000, 1100, 1.1]];
for (const [label, W, H, z] of CONDS) {
  const vw = Math.round(W / z), vh = Math.round(H / z);
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: z, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.route("https://dexscreener.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<body style='background:#111'></body>" }));
  await p.goto(SITEURL, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  const box = (ids) => p.evaluate((ids) => Object.fromEntries(ids.map((id) => { const e = document.getElementById(id); return [id, e ? { x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight } : null]; })), ids);
  const got = await box([hero.id, ...layers.map((n) => n.id)]);
  const Hb = got[hero.id];
  check(`${label}: the hero fills the window's height and width`, !!Hb && Math.abs(Hb.w - vw) <= 1 && Math.abs(Hb.h - Math.max(vh, hero.vh.px)) <= 1, J(Hb));
  for (const n of layers) {
    const g = got[n.id], e = want(n, Hb ?? { x: 0, y: 0, w: vw, h: vh }, vw, vh);
    const off = g ? Math.max(Math.abs(g.x - e.x), Math.abs(g.y - e.y), Math.abs(g.w - e.w), Math.abs(g.h - e.h)) : Infinity;
    check(`${label}: the ${name(n)} is where its rule puts it (${Object.entries(n.units).filter(([k]) => k !== "of").map(([k, v]) => `${k} ${v}`).join(", ")})`, off <= 1.5,
      `at ${g && [g.x, g.y, g.w, g.h].join(",")}, the rule says ${[e.x, e.y, e.w, e.h].map((v) => Math.round(v)).join(",")}`);
  }
  if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: join(SHOTS, `export-${W}${z !== 1 ? `-${Math.round(z * 100)}` : ""}.png`) }); }
  await ctx.close();
}
server.close();
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
