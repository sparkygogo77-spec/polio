#!/usr/bin/env node
/**
 * "BRING IT IN, KEEP MY CHANGES", THROUGH THE REAL DOOR.
 *
 * trumpmorty.fun from a stand-in sink (GitHub answered here): an earlier
 * conversion is brought in; on the board the owner centres both ribbons'
 * words in their band at 36px and 42px and moves a button; then sink's
 * document is replaced by a better capture (the stand-in for a retake: the
 * stickers read at rest, 4px where the old one said 7px; the loader timed
 * from the navigation; the ribbons on the frame's clock) and he brings it in
 * again from the repo menu with "Bring it in, keep my changes":
 *
 *   · the first import records the board as brought in (`taken`);
 *   · the prompt offers the button for the site's own source;
 *   · after it, both ribbons are still centred at his sizes, the button is
 *     where he put it, and they gained the new capture's step a frame;
 *   · every sticker rests at the new capture's 4px, the loader has its
 *     switch-off time;
 *   · the line says what it kept; one Ctrl+Z puts his board back.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/reimport-door.mjs http://127.0.0.1:3013 [sink checkout] [older ref]
 *   (EXPORT=<dir> also writes the site as published after the re-import there)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const SINK = process.argv[3] ?? join(here, "..", "..", "sink");
const OLD = process.argv[4] ?? "7b7ee04";
const FILE = "sites/trumpmorty-fun/site/document.json";
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};
const J = (v) => JSON.stringify(v);
if (!existsSync(join(SINK, FILE))) { console.log(`no ${FILE} in ${SINK}`); process.exit(1); }

/* The two documents: an earlier conversion, and the current one made better as a retake would make it. */
const older = JSON.parse(execFileSync("git", ["-C", SINK, "show", `${OLD}:${FILE}`], { encoding: "utf8", maxBuffer: 1 << 28 }));
const newer = JSON.parse(readFileSync(join(SINK, FILE), "utf8"));
const stickerSels = [];
for (const n of newer.nodes) { delete n.work; if (/ 7px 7px 0px/.test(n.edge?.shadow ?? "") && n.from?.selector) { n.edge.shadow = n.edge.shadow.replace(" 7px 7px", " 4px 4px"); stickerSels.push(n.from.selector); } }
newer.behaviours.loader = { ...newer.behaviours.loader, nav: { shown: 40, off: 2537, gone: 3376 } };
for (const l of newer.behaviours.loops ?? []) l.clock = "frame";
const ribbonSels = (newer.behaviours.loops ?? []).map((l) => newer.nodes.find((n) => n.id === l.part)?.from?.selector).filter(Boolean);

const OWNER = "sparkygogo77-spec", NAME = "sink", REPO = `/repos/${OWNER}/${NAME}`, BRANCH = "claude/trumpmorty";
let served = older;
/* A blob's sha is its content's: the retake is a new blob. */
const tree = () => [{ path: "package.json", type: "blob", sha: "pkg", size: 10 }, { path: FILE, type: "blob", sha: served === older ? "tm1" : "tm2", size: 100 }];

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  if (!u.pathname.startsWith(REPO)) return j({ message: "no" }, 404);
  const rest = decodeURIComponent(u.pathname.slice(REPO.length));
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (/^\/git\/trees\//.test(rest)) return j({ tree: tree() });
  const which = { "/git/blobs/tm1": older, "/git/blobs/tm2": newer }[rest];
  if (which) return j({ encoding: "base64", content: Buffer.from(JSON.stringify(which)).toString("base64") });
  if (/^\/commits\//.test(rest)) return j({ sha: "0".repeat(40) });
  return j({ message: "no" }, 404);
});
const repos = { ok: true, repos: [{ name: `${OWNER}/${NAME}`, private: false, branch: "main" }] };
await page.route("**/api/studio/repo?**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(repos) }));
await page.route("**/api/studio/repo", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(repos) }));
await page.route("**/api/studio/repo/choices**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, base: "main", ref: BRANCH, branches: ["main", BRANCH], sites: ["sites/trumpmorty-fun"] }) }));

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const until = async (fn, ms = 90000) => { for (let t = 0; t < ms; t += 500) { if (await fn()) return true; await page.waitForTimeout(500); } return false; };
const openMenu = async () => {
  for (let i = 0; i < 3 && !(await page.locator("[data-repo-menu]").count()); i++) { await page.locator("[data-github-button]").first().click(); await page.waitForTimeout(1200); }
  await page.locator("[data-repo-pick]").first().waitFor({ timeout: 15000 }).catch(() => {});
};
const bySel = (s, sel) => (s.nodes ?? []).filter((n) => n.from?.selector === sel);
const marquee = (n) => { const w = n?.work; const all = w ? [w, ...(w.also ?? [])] : []; return all.find((u) => u.id === "marquee")?.inputs ?? null; };

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Site 1", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click();
await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("STANDIN_GITHUB_TOKEN_placeholder");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await page.waitForTimeout(500);

/* The first bring: the earlier conversion. */
await openMenu();
await page.locator(`[data-repo-pick="${OWNER}/${NAME}"]`).click();
await page.waitForTimeout(600);
await page.locator("[data-repo-branch-pick]").selectOption(BRANCH).catch(() => {});
await page.waitForTimeout(600);
await page.locator('[data-repo-folder="sites/trumpmorty-fun"]').click();
await page.locator("[data-repo-bring-chosen]").click();
check("the earlier conversion lands", await until(async () => ((await state()).nodes?.length ?? 0) > 100), `${(await state()).nodes?.length} parts`);
await page.waitForTimeout(2500);
const first = await state();
check("the import recorded the board as brought in", first.taken?.v === 1 && Object.keys(first.taken.nodes ?? {}).length > 100, J(Object.keys(first.taken ?? {})));

/* His changes: the ribbons centred at his sizes, a button moved. */
const SIZES = ["36", "42"];
const moved = first.nodes.find((n) => n.featureId === "cta-primary" && n.from?.selector);
const edited = {
  ...first,
  nodes: first.nodes.map((n) => {
    const i = ribbonSels.indexOf(n.from?.selector);
    if (i >= 0) { const m = marquee(n) ?? {}; return { ...n, work: { id: "marquee", inputs: { ...m, middle: "yes", size: SIZES[i] } } }; }
    if (n === moved) return { ...n, x: n.x + 60, byHand: true };
    return n;
  }),
};
await page.evaluate((d) => window.__studioLoadDoc(d), edited);
await page.waitForTimeout(1500);
const his = await state();
check("his changes are on the board, and the record still with it", ribbonSels.every((s, i) => marquee(bySel(his, s)[0])?.size === SIZES[i]) && his.taken?.v === 1, J(ribbonSels.map((s) => marquee(bySel(his, s)[0]))));

/* The retake lands in sink; he brings it in again, keeping his changes. */
served = newer;
await openMenu();
await page.locator("[data-repo-bring-own]").click();
await page.waitForTimeout(600);
const offer = page.locator("[data-repo-bring-keepmine]");
check("the prompt offers to bring it in keeping his changes", (await offer.count()) === 1, await page.locator("[data-repo-bring-confirm]").innerText().catch(() => "no prompt"));
await offer.click();
const done = await until(async () => { const s = await state(); return !!s.taken && s.taken.at !== his.taken.at; }, 150000);
check("the new capture is brought in over the board", done, (await page.evaluate(() => document.body.innerText)).split("\n").filter((l) => /sink|could not|stopped/i.test(l)).slice(0, 4).join(" | "));
await page.waitForTimeout(1500);
const now = await state();
check("every sticker now rests at the new capture's 4px", stickerSels.length >= 2 && stickerSels.every((sel) => / 4px 4px 0px/.test(bySel(now, sel)[0]?.edge?.shadow ?? "")), J(stickerSels.map((sel) => bySel(now, sel)[0]?.edge?.shadow)));
check("both ribbons are still centred in their band at his sizes", ribbonSels.every((s, i) => marquee(bySel(now, s)[0])?.middle === "yes" && marquee(bySel(now, s)[0])?.size === SIZES[i]), J(ribbonSels.map((s) => marquee(bySel(now, s)[0]))));
check("…and gained the new capture's step a frame", ribbonSels.every((s) => marquee(bySel(now, s)[0])?.step === "0.6"), J(ribbonSels.map((s) => marquee(bySel(now, s)[0]))));
const m2 = bySel(now, moved.from.selector)[0];
check("the button he moved stays where he put it", m2?.x === moved.x + 60 && m2?.byHand === true, J({ now: m2?.x, his: moved.x + 60 }));
const crt = now.nodes.find((n) => { const w = n.work; return w && [w, ...(w.also ?? [])].some((u) => u.id === "crt-loader"); });
const crtIn = crt ? [crt.work, ...(crt.work.also ?? [])].find((u) => u.id === "crt-loader").inputs : null;
check("the loader switches off at the new capture's 2.54 s from the navigation", crtIn?.at === "2.54", J(crtIn));
const said = await page.evaluate(() => document.body.innerText);
check("the line says what it kept", /kept your changes on \d+ parts?/.test(said), (said.match(/Brought in again[^\n]*/) ?? ["nothing said"])[0]);

/* With EXPORT set, the site as published after the re-import is written there, to be measured (sink site/capture/tools). */
if (process.env.EXPORT) {
  const files = await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
  const { mkdirSync, writeFileSync } = await import("node:fs");
  for (const f of files ?? []) { mkdirSync(dirname(join(process.env.EXPORT, f.path)), { recursive: true }); writeFileSync(join(process.env.EXPORT, f.path), f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
  console.log(`exported ${files?.length ?? 0} files to ${process.env.EXPORT}`);
}

/* One undo puts his board back. */
await page.mouse.click(10, 990);
await page.keyboard.press("Control+z");
await page.waitForTimeout(1500);
const undone = await state();
const shadows = (st) => J(stickerSels.map((sel) => bySel(st, sel)[0]?.edge?.shadow));
check("one Ctrl+Z puts his board back: its record, its stickers, his ribbons", undone.taken?.at === his.taken?.at && shadows(undone) === shadows(his) && ribbonSels.every((s, i) => marquee(bySel(undone, s)[0])?.size === SIZES[i] && !marquee(bySel(undone, s)[0])?.step), `${shadows(undone)} vs ${shadows(his)}`);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
