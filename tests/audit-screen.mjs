#!/usr/bin/env node
/**
 * THE AUDIT SCREEN: THE LINE DRAWS, THE METER READS, APPLY AND SKIP TICK, MAKE THE PIECE WRITES A BRIEF (queue 75).
 *
 * `/builder/audit` (`features/audit`) shows Polio's features on one dated
 * line with the findings of the last audit hung on the feature that brought
 * each in, a meter against 500 MB, Apply/Skip per finding, and Make the
 * piece, which writes a lane brief and never code. On each of the six repo
 * fixtures on the board (share-xyz, trumpmorty-fun, gotchi-gg, stonkfun-xyz,
 * parasiteonsol-fun, trendtrader-pro; the page is about Polio, so the board
 * must not change what it shows):
 *
 *   1. The line draws: every feature of the receipt with findings is a lit
 *      row, in date order, the quiet ones folded; the meter says the total
 *      and the size with the ticked cuts.
 *   2. Each finding card says What, Why, before → after, and Apply or Skip;
 *      cuts start ticked, the shortcut starts on Later; pressing swaps the
 *      lit (red) one, the meter follows, and the tick survives a reload.
 *   3. Make the piece shows the brief whole, then Write it puts one markdown
 *      file in AUDIT_BRIEFS with only the ticked findings and no branch
 *      name; the checkout's code is untouched.
 *   4. The book under the timeline has the door; the command palette too.
 *
 * The receipt is the real one from base 17bf627's build
 * (`tests/fixtures/audit-receipt.json`), served by the route from
 * AUDIT_RECEIPT. Red on base: no route, no page. Screenshot for J:
 * .screenshots/audit-screen/line.png.
 *
 *   AUDIT_RECEIPT=tests/fixtures/audit-receipt.json AUDIT_BRIEFS=.screenshots/audit-briefs npx next start -p 3521
 *   node tests/audit-screen.mjs http://127.0.0.1:3521
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openBoard } from "./lib/board.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "..");
const BASE = process.argv[2] ?? "http://127.0.0.1:3521";
const SHOTS = join(REPO, ".screenshots", "audit-screen");
const BRIEFS = resolve(REPO, process.env.AUDIT_BRIEFS ?? ".screenshots/audit-briefs");
mkdirSync(SHOTS, { recursive: true });
mkdirSync(BRIEFS, { recursive: true });

const results = [];
const notRun = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${detail}`}`); };

const receipt = JSON.parse(readFileSync(join(REPO, "tests", "fixtures", "audit-receipt.json"), "utf8"));
const lit = receipt.features.filter((f) => f.found);
const cuts = receipt.findings.filter((f) => f.kind === "cut");
const MB = 1048576;
const mb = (b) => `${(b / MB).toFixed(b >= 100 * MB ? 0 : 1)} MB`;

/* The six repo fixtures: each site's document as sink captured it. */
const FIXTURES = ["share-xyz", "trumpmorty-fun", "gotchi-gg", "stonkfun-xyz", "parasiteonsol-fun", "trendtrader-pro"];
const SITES = [process.env.SITES, resolve(REPO, "..", "shared", "sites"), resolve(REPO, "capture", "versions", "sink-0ee06fa", "sites")].filter(Boolean);
const docOf = (name) => { for (const d of SITES) { const at = join(d, name, "site", "document.json"); if (existsSync(at)) return JSON.parse(readFileSync(at, "utf8")); } return null; };
/* As docStore.ts keeps a board: whole in localStorage when it fits, else a pointer there and the document in IndexedDB. */
const boardOf = (doc) => {
  const text = JSON.stringify({ state: doc, version: 0 });
  if (text.length < 2_000_000) return { local: { "builder.studio": text }, idb: {} };
  const pointer = JSON.stringify({ idb: true, bytes: text.length, pages: doc.pages?.length ?? 0, parts: doc.nodes?.length ?? 0, siteRepo: null });
  return { local: { "builder.studio": pointer }, idb: { "builder.docs": { version: 1, stores: { docs: [{ key: "builder.studio", value: text }] } } } };
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox", ...(process.env.CHROMIUM_ARGS ?? "").split(" ").filter(Boolean)], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const before = execFileSync("git", ["status", "--porcelain", "--", "src", "scripts", "kit", "next.config.ts"], { cwd: REPO, encoding: "utf8" });

/* A dev server compiles a page on its first visit and can hand the first browser a half-built chunk: warm the two pages once, then measure. */
{
  const warm = await browser.newPage();
  for (const path of ["/builder", "/builder/audit", "/builder"]) { await warm.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120_000 }).catch(() => {}); await warm.waitForTimeout(1500); }
  await warm.close();
}

let shot = false;
let shotBook = false;
for (const name of FIXTURES) {
  const doc = docOf(name);
  if (!doc) { notRun.push(`${name} (no site/document.json under ${SITES.join(" or ")})`); continue; }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openBoard(page, BASE, boardOf(doc));
  const parts = await page.evaluate(() => document.querySelectorAll("[data-node-id]").length);

  /* 4. The door in the book. */
  await page.goto(`${BASE}/builder/audit`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-audit-line]", { timeout: 20_000 }).catch(() => {});

  /* 1. The line and the meter. */
  const rows = await page.$$eval("[data-audit-feature]", (els) => els.map((e) => ({ name: e.dataset.auditFeature, found: Number(e.dataset.found) })));
  check(`${name}: the board has parts and the line draws every lit feature in date order`, parts > 0 && rows.filter((r) => r.found).map((r) => r.name).join("|") === lit.map((f) => f.name).join("|"), `${parts} parts; ${JSON.stringify(rows)}`);
  const quiet = await page.$$eval("[data-audit-quiet]", (els) => els.reduce((s, e) => s + Number(e.dataset.auditQuiet), 0));
  check(`${name}: the quiet features fold, none lost`, quiet + lit.length === receipt.features.length, `${quiet} folded + ${lit.length} lit vs ${receipt.features.length}`);
  const meter = await page.$eval("[data-audit-meter]", (e) => ({ total: Number(e.dataset.total), after: Number(e.dataset.after), text: e.textContent }));
  const afterCuts = receipt.before.total - cuts.reduce((s, f) => s + (f.bytes.before - f.bytes.after), 0);
  check(`${name}: the meter says the total and the size with the ticked cuts`, meter.total === receipt.before.total && meter.after === afterCuts && meter.text.includes(mb(receipt.before.total)) && meter.text.includes("over the limit"), JSON.stringify(meter));

  if (!shot) {
    await page.screenshot({ path: join(SHOTS, "line.png"), fullPage: true });
    /* The phone picture from a page of its own at phone size: one column, nothing side by side. */
    const phone = await ctx.newPage();
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.goto(`${BASE}/builder/audit`, { waitUntil: "networkidle" });
    await phone.waitForSelector("[data-audit-line]", { timeout: 20_000 }).catch(() => {});
    /* The page itself, not the shell around it: the Builder's side panels have their own width at phone size. */
    const wide = await phone.evaluate(() => { const p = document.querySelector("[data-audit-page]"); return p ? p.scrollWidth > window.innerWidth + 1 : true; });
    check(`${name}: at phone width the page is one column with no sideways scroll of its own`, !wide);
    await phone.screenshot({ path: join(SHOTS, "line-phone.png"), fullPage: true });
    await phone.close();
    shot = true;
  }

  /* 2. The cards. */
  const cards = await page.$$eval("[data-audit-finding]", (els) => els.map((e) => ({ id: e.dataset.auditFinding, kind: e.dataset.kind, tick: e.dataset.tick, text: e.textContent })));
  check(`${name}: every finding is a card with What, Why, before → after, Apply and Skip`, cards.length === receipt.findings.length && cards.every((c) => /Why/.test(c.text) && /→/.test(c.text) && /Apply/.test(c.text) && /(Skip|Later)/.test(c.text)), JSON.stringify(cards.map((c) => c.id)));
  check(`${name}: cuts start ticked, the shortcut starts on Later`, cards.every((c) => (c.kind === "cut") === (c.tick === "apply")), JSON.stringify(cards.map((c) => `${c.kind}:${c.tick}`)));
  const shortcut = receipt.findings.find((f) => f.kind === "shortcut");
  if (shortcut) {
    await page.click(`[data-audit-finding="${shortcut.id}"] [data-audit-apply]`);
    await page.waitForTimeout(150);
    const now = await page.$eval(`[data-audit-finding="${shortcut.id}"]`, (e) => e.dataset.tick);
    const after2 = await page.$eval("[data-audit-meter]", (e) => Number(e.dataset.after));
    check(`${name}: Apply on the shortcut lights it and the meter follows`, now === "apply" && after2 === afterCuts - (shortcut.bytes.before - shortcut.bytes.after), `${now} ${after2}`);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("[data-audit-line]", { timeout: 20_000 }).catch(() => {});
    check(`${name}: the tick survives a reload`, (await page.$eval(`[data-audit-finding="${shortcut.id}"]`, (e) => e.dataset.tick)) === "apply");
    await page.click(`[data-audit-finding="${shortcut.id}"] [data-audit-skip]`);
    await page.waitForTimeout(150);
  }
  /* Skip the first cut: the brief must leave it out. */
  await page.click(`[data-audit-finding="${cuts[0].id}"] [data-audit-skip]`);
  await page.waitForTimeout(150);

  /* 3. Make the piece. */
  for (const f of readdirSync(BRIEFS)) rmSync(join(BRIEFS, f), { force: true });
  await page.click("[data-audit-piece]");
  await page.waitForSelector("[data-audit-brief]", { timeout: 5000 });
  const preview = await page.$eval("[data-audit-brief] pre", (e) => e.textContent);
  check(`${name}: the brief is shown whole before it is written, with only the ticked findings`, preview.includes(cuts[1]?.what ?? cuts[0].what) && !preview.includes(`## ${cuts[0].what}`) && /Left for later/.test(preview), preview.slice(0, 200));
  await page.click("[data-audit-write]");
  await page.waitForSelector("[data-audit-written]", { timeout: 10_000 }).catch(() => {});
  const files = readdirSync(BRIEFS).filter((f) => f.endsWith(".md"));
  const text = files.length ? readFileSync(join(BRIEFS, files[0]), "utf8") : "";
  check(`${name}: Write it puts one brief in the handovers folder, the same words, no branch names`, files.length === 1 && /^audit-piece-\d{4}-\d{2}-\d{2}\.md$/.test(files[0]) && text === preview && !/claude\//.test(text) && /Done looks like/.test(text), files.join(","));
  check(`${name}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | "));

  /* 4. Where it lives: the green Finish key opens the timeline section; Audit and optimize is its fourth tab; Fill the screen is the deep state and Back returns to the tab. */
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-finish]", { timeout: 20_000 });
  check(`${name}: the Builder's top bar has no separate Audit door`, !(await page.$("[data-audit-door]")));
  await page.click("[data-finish]");
  await page.waitForSelector("[data-detail-tab-audit]", { timeout: 20_000 });
  await page.click("[data-detail-tab-audit]");
  await page.waitForSelector("[data-audit-line]", { timeout: 20_000 }).catch(() => {});
  const inBand = await page.evaluate(() => Boolean(document.querySelector("[data-timeline-detail] [data-audit-line]")) && !document.querySelector("[data-audit-full]"));
  check(`${name}: the green Finish key's section shows the audit as one more tab, beside the iterations, under the timeline`, inBand);
  if (!shotBook) {
    /* The green key lit at the top right, the timeline's boxes above, the Audit tab and its line below. */
    await page.evaluate(() => { const pane = document.querySelector("[data-studio-pane]"); const band = document.querySelector("[data-timeline-detail]"); if (pane && band) pane.scrollTop += band.getBoundingClientRect().top - 330; });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, "book.png"), fullPage: false });

    shotBook = true;
  }
  await page.click("[data-audit-deep]");
  await page.waitForSelector("[data-audit-full] [data-audit-line]", { timeout: 20_000 }).catch(() => {});
  check(`${name}: Fill the screen goes deep: the same view takes the screen at /builder/audit`, page.url().endsWith("/builder/audit") && Boolean(await page.$("[data-audit-full] [data-audit-line]")));
  await page.click("[data-audit-back]");
  await page.waitForSelector("[data-timeline-detail] [data-audit-line]", { timeout: 20_000 }).catch(() => {});
  const backHome = await page.evaluate(() => Boolean(document.querySelector("[data-timeline-detail] [data-audit-line]")) && Boolean(document.querySelector("[data-detail-tab-audit][aria-pressed=\"true\"]")));
  check(`${name}: Back to the timeline returns to the section with the Audit tab still open`, page.url().endsWith("/builder") && backHome, page.url());
  await ctx.close();
}
await browser.close();

const after = execFileSync("git", ["status", "--porcelain", "--", "src", "scripts", "kit", "next.config.ts"], { cwd: REPO, encoding: "utf8" });
check("the screen changed no code in the checkout", before === after, after);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}${notRun.length ? `; not run: ${notRun.join("; ")}` : ""}`);
process.exit(bad ? 1 : 0);
