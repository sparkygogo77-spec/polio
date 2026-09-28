#!/usr/bin/env node
/**
 * THE PREVIEW OPENS AS THE WINDOW: 1:1, NO FRAME, THE HERO THE PREVIEW'S HEIGHT.
 *
 * THE OWNER, trumpmorty.fun at 2000 wide beside the Preview: the Preview drew
 * the page in a 1440 frame with a margin (about 1368 of a 2000 screen once
 * scaled), and the hero, 100svh on the site, stayed 900 tall, so the ribbons
 * sat 80% of the way down the view instead of at its foot. Now the Preview
 * opens in the window view (`live/previewWindow.ts`): the page 1:1 at the
 * Preview's own width, re-anchored as the export is, with every window unit
 * taken of the Preview's size.
 *
 * Through the real door (sink's trumpmorty.fun brought in), at 1440 × 900 and
 * 2000 × 1100:
 *   · the page is as wide as the view and drawn 1:1;
 *   · the hero is the view's height (never under the 900 it was captured at);
 *   · the ribbons stand where they stood against the hero's foot;
 *   · the planet's `-16vw` is 16% of the view's width;
 * and the device widths are still there: Desktop draws the 1440 frame.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/preview-window.mjs http://127.0.0.1:3013 <path to a sink checkout>
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3] ?? join(here, "..", "..", "sink");
const SITE = join(SINK, "sites", "trumpmorty-fun");
if (!existsSync(join(SITE, "site", "document.json"))) { console.error(`usage: node tests/layer-units.mjs <builder url> <sink checkout>; no ${SITE}/site/document.json`); process.exit(2); }
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

const hero = doc.nodes.find((n) => n.vh?.minHeight && n.pageId === "page_home");
const red = doc.nodes.find((n) => n.colour?.bg === "rgb(210, 60, 52)" && /^body > main > div > div:nth-of-type\(\d\)$/.test(n.from?.selector ?? ""));
const planet = doc.nodes.find((n) => n.units?.left === "-16vw");
check("sink's document has the hero, the red ribbon row and the planet in vw", !!hero && !!red && !!planet, J([hero?.id, red?.id, planet?.id]));

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


for (const [W, H] of [[1440, 900], [2000, 1100]]) {
  await page.setViewportSize({ width: W, height: H });
  await page.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(({ hero, red, planet }) => {
    const view = document.querySelector("[data-live-scroller]");
    const box = (id) => { const e = document.querySelector(`[data-live-node="${id}"]`); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height, ow: e.offsetWidth, ol: e.offsetLeft }; };
    const v = view.getBoundingClientRect();
    const pg = document.querySelector("[data-live-page]").getBoundingClientRect();
    return { view: { x: v.left, y: v.top, w: view.clientWidth, h: view.clientHeight }, mode: view.getAttribute("data-live-view"), page: { x: pg.left, w: pg.width }, hero: box(hero), red: box(red), planet: box(planet) };
  }, { hero: hero.id, red: red.id, planet: planet.id });
  const L = `${W} × ${H}`;
  check(`${L}: the Preview opens in the window view`, r.mode === "window", J(r.mode));
  check(`${L}: the page is as wide as the view, 1:1`, Math.abs(r.page.x - r.view.x) <= 1 && Math.abs(r.page.w - r.view.w) <= 1 && !!r.hero && Math.abs(r.hero.w - r.hero.ow) <= 1, J({ view: r.view, page: r.page, hero: r.hero && [r.hero.w, r.hero.ow] }));
  const wantH = Math.max(r.view.h, hero.vh.px);
  check(`${L}: the hero is the view's height (never under ${hero.vh.px})`, !!r.hero && Math.abs(r.hero.h - wantH) <= 1.5, `hero ${r.hero?.h}, view ${r.view.h}`);
  const was = red.y - (hero.y + hero.h), now = r.red && r.hero ? r.red.y - (r.hero.y + r.hero.h) : NaN;
  check(`${L}: the ribbons stand against the hero's foot as captured (${was}px)`, Math.abs(now - was) <= 2, `now ${now.toFixed?.(1)}`);
  check(`${L}: the planet's -16vw is 16% of the view's width`, !!r.planet && Math.abs(r.planet.ol - -0.16 * r.view.w) <= 1.5, `${r.planet?.ol} against ${(-0.16 * r.view.w).toFixed(1)}`);
}
/* The device widths are still choices. */
await page.getByRole("radio", { name: "Desktop" }).click().catch(async () => { await page.getByText("Desktop", { exact: true }).click(); });
await page.waitForTimeout(1200);
const d = await page.evaluate(() => { const v = document.querySelector("[data-live-scroller]"); const pg = document.querySelector("[data-live-page]"); return { mode: v.getAttribute("data-live-view"), w: pg.offsetWidth }; });
check("Desktop still draws the site's 1440 frame", d.mode === "desktop" && d.w === 1440, J(d));
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
