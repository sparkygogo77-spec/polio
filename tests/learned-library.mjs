#!/usr/bin/env node
/**
 * THE BUILDER LEARNS FROM EVERY SITE IMPORTED, AND KEEPS IT BUILDER-WIDE.
 *
 * THE OWNER'S ASK: "it needs to learn and categorize from every site
 * imported." Held here on every capture in sink (Trump & Morty, Parasite,
 * gotchi, TrendTrader, stonkfun, share.xyz, and any added later):
 *
 *   PURE, each capture as an import lands it (`library/learned.ts`):
 *     · what came in, per shelf category: the site's versions of shelf
 *       items, its kits, motions, fonts and palette, and what was skipped;
 *     · no duplicates: one version per item per site, and the same effect
 *       from two sites is one item with two variations;
 *     · nothing kept that does nothing: every version's item is on the
 *       shelf, its feature exists, no setting names the site's own parts, a
 *       motion carries the keyframes it names; its badge is the shelf's own;
 *     · re-learning a site replaces it, forgetting one is a choice, a
 *       newer format is not half read.
 *   IN THE BUILDER, through the one door every import comes through:
 *     · each import is learned, into one builder-wide record;
 *     · it survives a reload and a switch to a new, empty board, where
 *       "Learned from your sites" lists every site;
 *     · every learned version, put on that scratch board as the shelf's Add
 *       puts it, is in the exported page with what makes it run (its script,
 *       its keyframes, its frame);
 *     · Download a backup carries the library, and loading the backup into
 *       a browser that lost it brings it back.
 *
 *   npx next start -p 3013
 *   node tests/learned-library.mjs http://127.0.0.1:3013 capture/versions/sink-0ee06fa
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const SINK = process.argv[3] ?? process.env.SINK_ROOT ?? join(here, "..", "capture", "versions", "sink-0ee06fa");
const SHOTS = ".screenshots/learned";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const src = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const { attachCaptured } = await src("shelf/library/captured.ts");
const L = await src("shelf/library/learned.ts");
const { getWork } = await src("shelf/library/works.ts");
const { statusOf } = await src("shelfFacts.ts");

const SITES = existsSync(join(SINK, "sites")) ? readdirSync(join(SINK, "sites")).filter((s) => existsSync(join(SINK, "sites", s, "site", "document.json"))).sort() : [];
check("sink holds captured sites to learn from", SITES.length >= 1, SITES.join(", "));

/* ------------------------------------------------------------------ pure: each capture as an import lands it */
const learned = {};
const docs = {};
for (const s of SITES) {
  const d = JSON.parse(readFileSync(join(SINK, "sites", s, "site", "document.json"), "utf8"));
  docs[s] = d;
  const kf = d.keyframes ?? d.look?.keyframes ?? [];
  const nodes = d.behaviours ? attachCaptured(d.nodes, d.behaviours, kf) : d.nodes;
  learned[s] = L.learnFromBoard({ nodes, look: { ...d.look, keyframes: kf }, brief: d.brief, pages: d.pages }, d.behaviours);
}
console.log("\n  site               name         versions by category                      kits motions fonts                     skipped");
for (const s of SITES) {
  const x = learned[s];
  if (!x) { console.log(`  ${s.padEnd(18)} (no capture records: nothing to learn)`); continue; }
  const byCat = {};
  for (const v of x.versions) byCat[v.category] = (byCat[v.category] ?? 0) + 1;
  console.log(`  ${s.padEnd(18)} ${x.name.padEnd(12)} ${JSON.stringify(byCat).padEnd(42)} ${String(x.kits.length).padStart(4)} ${String(x.motions.length).padStart(7)}  ${`${x.fonts.heading} / ${x.fonts.body}`.padEnd(25)} ${x.skipped.length}`);
}
console.log("");
const all = SITES.map((s) => learned[s]).filter(Boolean);
check("every capture with capture records is learned", all.length === SITES.filter((s) => docs[s].nodes.some((n) => n.from?.host)).length, `${all.length} of ${SITES.length}`);
check("each one brings something: shelf versions, kits or motions", all.every((x) => x.versions.length + x.kits.length + x.motions.length > 0), all.map((x) => `${x.name} ${x.versions.length}/${x.kits.length}/${x.motions.length}`).join(", "));
const dupes = all.flatMap((x) => { const seen = new Set(); return x.versions.filter((v) => (seen.has(v.item) ? true : (seen.add(v.item), false))).map((v) => `${x.name}:${v.item}`); });
check("one version per item per site, no duplicates", dupes.length === 0, dupes.join(", ") || "none");
let lib = L.emptyLibrary();
for (const x of all) lib = L.withSite(lib, x);
const byItem = L.learnedVersions(lib);
const shared = [...byItem.entries()].filter(([, list]) => list.length > 1);
check("the same effect from several sites is one shelf item with a variation per site", shared.length > 0 && shared.every(([, list]) => new Set(list.map((v) => v.host)).size === list.length), shared.map(([item, list]) => `${item}: ${list.map((v) => v.label).join(", ")}`).join(" | "));
const versions = all.flatMap((x) => x.versions.map((v) => ({ ...v, host: x.host, site: x.name })));
check("every version is filed in a shelf category", versions.every((v) => !!L.placeOf(v.item) && v.category === L.placeOf(v.item).category), versions.filter((v) => !L.placeOf(v.item)).map((v) => v.item).join(", ") || `${versions.length} versions`);
check("every feature a version runs exists in the library", versions.filter((v) => v.take.kind === "work").every((v) => !!getWork(v.take.id)));
check("no version carries a setting naming its site's own parts", versions.every((v) => !/\bn_[a-z]+_\d+\b/.test(JSON.stringify(v.take.kind === "work" ? v.take.inputs : {}))));
const motionsOk = versions.filter((v) => v.take.kind === "motion" && v.take.motion.animation?.length).every((v) => v.take.motion.animation.every((a) => (v.frames ?? []).some((k) => k.name === a.name || `cap-${k.name}` === a.name)));
check("a motion version carries the keyframes it names", motionsOk);
check("every badge is the shelf's own, and never a note", versions.every((v) => v.status !== "note" && (v.take.kind !== "work" || v.status === statusOf(`work:${v.take.id}`, getWork(v.take.id)?.manifest.needs))), [...new Set(versions.map((v) => v.status))].join(", "));
check("what was not kept says why", all.every((x) => x.skipped.every((k) => k.what && k.why.length > 20)), all.flatMap((x) => x.skipped.map((k) => `${x.name}: ${k.what}`)).slice(0, 6).join(" | ") || "nothing skipped");
const again = L.withSite(lib, { ...all[0], at: all[0].at + 1000, versions: all[0].versions.slice(0, 1) });
check("re-learning a site replaces its entry, the others untouched", Object.keys(again.sites).length === Object.keys(lib.sites).length && again.sites[all[0].host].versions.length === 1);
check("forgetting a site removes only it", Object.keys(L.withoutSite(lib, all[0].host).sites).length === Object.keys(lib.sites).length - 1);
check("a library from a newer Builder is not half read", Object.keys(L.readLibrary({ ...lib, version: 99 }).sites).length === 0 && Object.keys(L.readLibrary(JSON.parse(JSON.stringify(lib))).sites).length === Object.keys(lib.sites).length);

/* ------------------------------------------------------------------ in the Builder */
const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/tweets/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }));
const wait = (ms) => page.waitForTimeout(ms);
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__studioLoadDoc && !!window.__studioLearned, null, { timeout: 30000 });
/* The browser's own copy of what it learned, before anything is imported. */
const learnedHere = () => page.evaluate(() => window.__studioLearned());

/* Every capture, through the one door imports come through. The largest is skipped only when it will not fit a page's memory. */
const imported = [];
for (const s of SITES) {
  if (!learned[s]) continue;
  const size = readFileSync(join(SINK, "sites", s, "site", "document.json")).length;
  if (size > 30_000_000) { console.log(`  (${s}: ${Math.round(size / 1e6)}MB, read above but not loaded into a page)`); continue; }
  await page.evaluate((doc) => window.__studioLoadDoc(doc), docs[s]);
  await wait(1500);
  imported.push(s);
}
let had = await learnedHere();
check("each import is learned, into one builder-wide record", imported.every((s) => !!had.sites[learned[s].host]), `${Object.keys(had.sites).length} sites: ${Object.values(had.sites).map((x) => x.name).join(", ")}`);
check("…the same as the import's own reading", imported.every((s) => had.sites[learned[s].host].versions.length === learned[s].versions.length && had.sites[learned[s].host].kits.length === learned[s].kits.length), imported.map((s) => `${learned[s].name} ${had.sites[learned[s].host]?.versions.length}/${learned[s].versions.length}`).join(", "));

/* A switch to a new, empty board, after a reload. */
await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
await wait(1200);
// An empty board by its own button: the Builds page's New site opens on a sample page (tests/new-site-theme.mjs).
await page.getByRole("button", { name: /^Blank site$/ }).first().click();
await wait(900);
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__studioLearned, null, { timeout: 30000 });
await wait(1500);
const board = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes?.length ?? -1);
had = await learnedHere();
check("on a new, empty board after a reload, everything learned is still there", board === 0 && imported.every((s) => !!had.sites[learned[s].host]), `${board} parts on the board, ${Object.keys(had.sites).length} sites learned`);
await page.evaluate(() => window.dispatchEvent(new CustomEvent("studio:learned")));
await wait(600);
const shownSites = await page.locator("[data-learned-site]").count();
check("“Learned from your sites” lists every site", shownSites === Object.keys(had.sites).length, `${shownSites}`);
await page.screenshot({ path: `${SHOTS}/learned-panel.png` });
await page.keyboard.press("Escape");

/* Every learned version, put on the scratch board as the shelf's Add puts it, then exported. */
const put = [];
for (const [item, list] of Object.entries(Object.fromEntries([...L.learnedVersions(had)]))) {
  for (const v of list) {
    /* Nothing picked, so each goes on a part of its own, as Add does with nothing picked. */
    const id = await page.evaluate(({ item, host }) => { window.__studioHistory?.act("setSelection", []); return window.__studioPutLearned(item, host); }, { item, host: v.host });
    put.push({ item, host: v.host, label: v.label, id, take: v.take, frames: v.frames });
  }
}
await wait(800);
check("every learned version goes on the scratch board", put.length === versions.length && put.every((p) => !!p.id), `${put.filter((p) => p.id).length} of ${versions.length}`);
const files = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: typeof f.content === "string" ? f.content : "" })));
const html = files.filter((f) => f.path.endsWith(".html")).map((f) => f.content).join("\n");
const css = files.filter((f) => f.path.endsWith(".css")).map((f) => f.content).join("\n");
const paths = new Set(files.map((f) => f.path));
const runs = (p) => {
  if (p.take.kind === "work") return html.includes(`"${p.take.id}"`) && [...paths].some((x) => x.startsWith("assets/features/") && x.includes(p.take.id));
  if (p.take.kind === "embed") return /<iframe\b/.test(html);
  const names = (p.take.motion.animation ?? []).map((a) => a.name.replace(/^cap-/, ""));
  if (names.length) return names.every((n) => css.includes(n));
  return /:hover/.test(css);
};
const dead = put.filter((p) => p.id && !runs(p));
check("each one is in the exported page with what makes it run", dead.length === 0, dead.map((p) => `${p.label} ${p.item}`).join(", ") || `${put.length} run`);
await page.screenshot({ path: `${SHOTS}/scratch-board.png` });

/* Download a backup, lose the library, load the backup: it comes back. */
await page.waitForTimeout(800);
const line = page.locator("header [data-save-line]");
await line.click();
await wait(400);
const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.locator("[data-save-card] [data-backup-download]").click()]);
const file = join(tmpdir(), `learned-${Date.now()}.polio.json`);
await download.saveAs(file);
const backup = JSON.parse(readFileSync(file, "utf8"));
check("Download a backup carries the library, with its own kind and version", backup.learned?.kind === "polio-learned-library" && backup.learned?.version === 1 && Object.keys(backup.learned.sites).length === Object.keys(had.sites).length, `${Object.keys(backup.learned?.sites ?? {}).length} sites`);
const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p2 = await fresh.newPage();
await p2.route("**/api/tweets/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }));
await p2.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
await p2.waitForTimeout(1200);
const before = await p2.locator("[data-learned-open]").innerText();
const [chooser] = await Promise.all([p2.waitForEvent("filechooser"), p2.locator("[data-builds-load-backup]").click()]);
await chooser.setFiles(file);
await p2.waitForTimeout(2500);
const after = await p2.locator("[data-learned-open]").innerText();
check("loading it in a browser that never learned anything brings the library back", !/\(\d+\)/.test(before) && new RegExp(`\\(${Object.keys(had.sites).length}\\)`).test(after), `${before} → ${after}`);
await p2.locator("[data-learned-open]").click();
await p2.waitForTimeout(600);
check("…listed site by site", (await p2.locator("[data-learned-site]").count()) === Object.keys(had.sites).length);
await p2.screenshot({ path: `${SHOTS}/learned-after-backup.png` });

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
writeFileSync(join(SHOTS, "learned.json"), JSON.stringify(Object.fromEntries(all.map((x) => [x.host, { name: x.name, versions: x.versions.map((v) => `${v.category}/${v.item}`), kits: x.kits.length, motions: x.motions.length, fonts: [x.fonts.heading, x.fonts.body], skipped: x.skipped }])), null, 2));
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
