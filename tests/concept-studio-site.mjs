#!/usr/bin/env node
/**
 * THE CONCEPT STUDIO, THROUGH THE REAL DOORS.
 *
 * No Claude call: Make draws the free local concepts. Held here:
 *
 *   1. /builder/concepts: one prompt and Make show three concepts in the
 *      grid, each a whole page of real parts, each a site of its own in
 *      Builds named "<site>: <direction>", none the open site;
 *   2. the grid (Merges 71 replaced the side-by-side take keys): one tick a
 *      row, ticking the first screen of one concept and a section of
 *      another; a tick pressed again comes off; the ticks line and the Your
 *      page column say what is ticked;
 *   3. Again (Boards view) rolls one concept and leaves the other two byte
 *      for byte;
 *   4. Edit opens the Builder on that concept with its parts on the board
 *      and the bar's way back to the canvas; back, the three are still there;
 *   5. Build the ticked page: a new site, the open one, its Mix record gone,
 *      the Builder showing the ticked sections stacked in row order;
 *   6. with capture folders: each is seeded as the open site, concepts are
 *      made, and the capture's stored document is byte for byte the same.
 *
 *   npm run build && npx next start -p 3531
 *   node tests/concept-studio-site.mjs http://127.0.0.1:3531 [capture/sites/<name> …]
 *   SHOTS=<dir>  also saves live-canvas.png, live-mix.png, live-edit.png there.
 *
 * Covers: src/features/studio/concepts/model.ts, src/features/studio/concepts/run.ts, src/features/studio/concepts/store.ts, src/features/studio/concepts/ConceptsPage.tsx, src/features/builds/index.ts, src/features/builds/StartRow.tsx
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.argv[2] ?? "http://127.0.0.1:3531").replace(/\/$/, "");
const SITES = process.argv.slice(3);
const SHOTS = process.env.SHOTS || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
/* The section a part belongs to, as model.ts reads it: the words before ": ", or what follows "Section: " on a section's own band. */
const sectionOf = (label) => { const l = label ?? ""; const at = l.indexOf(": "); if (at < 0) return l.trim(); const head = l.slice(0, at).trim(); return head === "Section" ? l.slice(at + 2).trim() : head; };
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox", ...(process.env.CHROMIUM_ARGS ?? "").split(/\s+/).filter(Boolean)], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const finish = async () => { await browser.close(); const failed = results.filter((r) => !r).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0); };

const PROMPT = "three concepts for a lantern shop landing page";
const env = (s) => JSON.stringify({ state: s, version: 0 });
const hook = (p, what, ...args) => p.evaluate(([w, a]) => { const h = window.__polioConcepts; if (!h) return null; const r = h[w](...a); return r; }, [what, args]);
const builds = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}").state ?? {});
const waitFor = async (p, fn, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await p.waitForTimeout(250); } return false; };
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: join(SHOTS, name) }); };

async function freshPage(ctx) {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.route("https://api.github.com/**", (r) => r.abort());
  return p;
}
const errors = [];

/* A board with nothing on it, one site in Builds. */
async function blank(p) {
  await p.goto(`${BASE}/api/version`, { waitUntil: "load" });
  await p.evaluate(() => {
    const e = (s) => JSON.stringify({ state: s, version: 0 });
    for (const k of Object.keys(localStorage)) if (k.startsWith("builder.")) localStorage.removeItem(k);
    localStorage.setItem("builder.builds", e({ projects: [{ id: "s1", name: "Site 1", updatedAt: Date.now() }], activeId: "s1" }));
    localStorage.setItem("builder.studio", e({ nodes: [], pages: [{ id: "page_home", name: "Home", path: "/" }] }));
  });
}

async function make(p) {
  await p.goto(`${BASE}/builder/concepts`, { waitUntil: "networkidle" });
  await p.waitForSelector("[data-concepts-prompt]");
  /* Typed after React has taken the page: a fill before hydration sets the box and not the state. */
  for (let i = 0; i < 20; i++) {
    await p.fill("[data-concepts-prompt]", "");
    await p.locator("[data-concepts-prompt]").pressSequentially(PROMPT, { delay: 2 });
    if (await p.locator("[data-concepts-make]:not([disabled])").count()) break;
    await p.waitForTimeout(500);
  }
  await p.click("[data-concepts-make]");
  const drew = await waitFor(p, async () => (await p.locator("[data-grid-cell]:not([data-empty]) *").count()) > 0 && (await p.locator("[data-grid-col]").count()) === 3, 60000);
  await p.waitForTimeout(800);
  return drew;
}

const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await freshPage(ctx);
await blank(page);

/* 1. */
const drew = await make(page);
const groups = (await hook(page, "groups")) ?? {};
const g = Object.values(groups)[0];
check("1. one prompt and Make show three concepts in the grid", drew && g && g.ids.length === 3 && g.prompt === PROMPT, J({ drew, ids: g?.ids?.length }));
const byId = (await hook(page, "byId")) ?? {};
const names = (g?.ids ?? []).map((id) => byId[id]?.name);
check("…each with a direction of its own", new Set(names).size === 3 && names.every(Boolean), names.join(" / "));
const docs = {};
for (const id of g?.ids ?? []) docs[id] = await hook(page, "doc", id);
check("…each a whole page of real parts, words in", (g?.ids ?? []).every((id) => (docs[id]?.nodes?.length ?? 0) >= 6 && docs[id].nodes.some((n) => typeof n.content === "string" && n.content.length > 12)), (g?.ids ?? []).map((id) => docs[id]?.nodes?.length).join(" / "));
let b = await builds(page);
check("…each a site of its own in Builds, named site: direction, and none is the open site", (g?.ids ?? []).every((id) => b.projects.some((p) => p.id === id && /^.+: .+$/.test(p.name))) && b.activeId === "s1" && b.projects.length === 4, J({ active: b.activeId, names: b.projects.map((p) => p.name) }));
const live = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.length);
check("…the open board was not touched", live === 0, `${live} parts on the open board`);
const filled = await page.locator("[data-grid-cell]:not([data-empty])").count();
check("…every concept's sections are offered as cells of the grid", (await page.locator("[data-grid-col]").count()) === 3 && filled >= 9, `${filled} cells`);
await shot(page, "live-canvas.png");

/* 2. The grid: one tick a row. */
const rowKeys = await page.locator("[data-grid-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-grid-row")));
const cellOf = (key, col) => page.locator(`[data-grid-cell="${key}:${g.ids[col]}"]:not([data-empty])`);
const has = async (key, col) => (await cellOf(key, col).count()) === 1;
const t1 = rowKeys.find((k) => /first screen/i.test(k)) ?? rowKeys[1];
let t2 = null;
for (const k of rowKeys) if (k !== t1 && !/header|footer|pages/i.test(k) && (await has(k, 0))) { t2 = k; break; }
let t3 = null;
for (const k of rowKeys) if (k !== t1 && k !== t2 && (await has(k, 2))) { t3 = k; break; }
const tickAll = async () => { await cellOf(t1, 1).click(); await cellOf(t2, 0).click(); await page.waitForTimeout(300); };
await tickAll();
await cellOf(t3, 2).click();
await cellOf(t3, 2).click();
await page.waitForTimeout(400);
const ticked = await page.locator("[data-grid-cell][data-ticked]").evaluateAll((els) => els.map((e) => e.getAttribute("data-grid-cell")));
check("2. one tick a row: the first screen of concept 2 and a section of concept 1", ticked.length === 2 && ticked.includes(`${t1}:${g.ids[1]}`) && ticked.includes(`${t2}:${g.ids[0]}`), J({ t1, t2, ticked }));
check("…a tick pressed again comes off", (await cellOf(t3, 2).getAttribute("aria-pressed")) === "false", t3);
const line = (await page.locator("[data-grid-ticks]").textContent()) ?? "";
check("…the ticks line counts one from each", /Ticks: 1 from .+, 1 from /.test(line), line);
check("…the Your page column shows the two ticked rows and nothing else", (await page.locator("[data-grid-yourpage]:not([data-empty]):not([data-grid-yourpage-head])").count()) === 2, `${await page.locator("[data-grid-yourpage]:not([data-empty])").count()} filled`);
await shot(page, "live-mix.png");
await page.locator('[data-concepts-view="boards"]').click();
await waitFor(page, async () => (await page.locator("[data-concept]").count()) === 3, 20000);
await page.waitForTimeout(600);

/* 3. */
const before = { 0: J(docs[g.ids[0]]), 1: J(docs[g.ids[1]]) };
await page.locator(`[data-concept-index="2"] [data-concept-again]`).click();
await waitFor(page, async () => J(await hook(page, "doc", g.ids[2])) !== J(docs[g.ids[2]]), 30000);
await page.waitForTimeout(600);
const after2 = await hook(page, "doc", g.ids[2]);
check("3. Again rolls that concept", J(after2) !== J(docs[g.ids[2]]) && (after2?.nodes?.length ?? 0) >= 6, `${after2?.nodes?.length} parts now`);
check("…and leaves the other two byte for byte", J(await hook(page, "doc", g.ids[0])) === before[0] && J(await hook(page, "doc", g.ids[1])) === before[1]);
check("…three concepts still on the canvas", (await page.locator("[data-concept]").count()) === 3);

/* 4. */
await page.locator(`[data-concept-index="0"] [data-concept-edit]`).click();
await page.waitForURL(/\/builder(\?|$)/, { timeout: 30000 });
await waitFor(page, async () => (await page.evaluate(() => window.__studioHistory?.doc()?.nodes?.length ?? 0)) > 0, 30000);
await page.waitForTimeout(1000);
const onBoard = await page.evaluate(() => window.__studioHistory?.doc()?.nodes?.length ?? 0);
b = await builds(page);
check("4. Edit opens the Builder on that concept with its parts on the board", b.activeId === g.ids[0] && onBoard === docs[g.ids[0]].nodes.length && (await page.locator("[data-node-id]").count()) > 0, J({ active: b.activeId === g.ids[0], onBoard, drawn: await page.locator("[data-node-id]").count() }));
const back = page.locator("[data-concepts-back]");
check("…the bar has the way back to the canvas", (await back.count()) === 1 && (await back.getAttribute("href")) === `/builder/concepts?g=${encodeURIComponent(g.id)}`, await back.getAttribute("href"));
await shot(page, "live-edit.png");
await back.click();
await page.waitForURL(/\/builder\/concepts/, { timeout: 30000 });
await page.waitForTimeout(800);
await waitFor(page, async () => (await page.locator("[data-grid-col]").count()) === 3, 30000);
check("…back on the canvas, the three are still there", (await page.locator("[data-grid-col]").count()) === 3);

/* 5. Build the ticked page (the ticks are the page's own state: tick again after coming back). */
const src = {};
for (const id of g.ids) src[id] = await hook(page, "doc", id);
const inRow = (doc, key) => (doc?.nodes ?? []).filter((n) => sectionOf(n.label).trim().toLowerCase() === key);
const srcA = inRow(src[g.ids[1]], t1);
const srcB = inRow(src[g.ids[0]], t2);
const order = rowKeys.indexOf(t1) < rowKeys.indexOf(t2) ? [srcA, srcB] : [srcB, srcA];
await tickAll();
await page.locator("[data-grid-build]").click();
await page.waitForURL(/\/builder(\?|#|$)/, { timeout: 30000 });
await waitFor(page, async () => (await page.evaluate(() => window.__studioHistory?.doc()?.nodes?.length ?? 0)) > 0, 30000);
await page.waitForTimeout(800);
b = await builds(page);
const byId2 = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.concepts") ?? "{}").state ?? {});
const built = await page.evaluate(() => window.__studioHistory?.doc()?.nodes ?? []);
const blockA = built.filter((n) => n.id.startsWith("mx0_"));
const blockB = built.filter((n) => n.id.startsWith("mx1_"));
const bottom = (ns) => Math.max(...ns.map((n) => n.y + n.h));
const top = (ns) => Math.min(...ns.map((n) => n.y));
check("5. Build the ticked page: a new site, the open one, its Mix record gone", !!b.activeId && !g.ids.includes(b.activeId) && b.activeId !== "s1" && !byId2.byId?.[b.activeId] && byId2.groups?.[g.id]?.mix === null, J({ active: b.activeId, record: !!byId2.byId?.[b.activeId], mix: byId2.groups?.[g.id]?.mix }));
check("…the Builder shows the ticked sections, stacked in row order", srcA.length > 0 && srcB.length > 0 && built.length === srcA.length + srcB.length && blockA.length === order[0].length && blockB.length === order[1].length && top(blockA) === 0 && top(blockB) >= bottom(blockA), J({ built: built.length, a: [blockA.length, order[0].length], b: [blockB.length, order[1].length] }));
check("…no way back shows on a promoted site", (await page.locator("[data-concepts-back]").count()) === 0);
check("…the Start row offers Concepts", await (async () => { await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" }); return (await page.locator('[data-start="concepts"]').count()) === 1; })());
await ctx.close();

/* 6. */
for (const SINK of SITES) {
  const name = SINK.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
  const file = join(SINK, "site/document.json");
  if (!existsSync(file)) { check(`${name}: a capture folder`, false, SINK); continue; }
  const raw = readFileSync(file, "utf8");
  const doc = JSON.parse(raw);
  const c2 = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const p2 = await freshPage(c2);
  await p2.goto(`${BASE}/api/version`, { waitUntil: "load" });
  /* Seeded as the open site: in the mirror when it fits, else in IndexedDB with the mirror's pointer, as the Builder keeps a big site. */
  const seeded = await p2.evaluate(async ({ text, parts, pages }) => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("builder.") && !/^builder\.(keys|keyring)/.test(k)) localStorage.removeItem(k);
    localStorage.setItem("builder.builds", JSON.stringify({ state: { projects: [{ id: "cap", name: "Captured", updatedAt: Date.now() }], activeId: "cap" }, version: 0 }));
    const ask = (req) => new Promise((done, no) => { req.onsuccess = () => done(req.result); req.onerror = () => no(req.error); req.onblocked = () => done(null); });
    await ask(indexedDB.deleteDatabase("builder.docs"));
    const open = indexedDB.open("builder.docs", 1);
    open.onupgradeneeded = () => { open.result.createObjectStore("docs"); };
    const db = await ask(open);
    const tx = db.transaction("docs", "readwrite");
    tx.objectStore("docs").put(text, "builder.studio");
    await new Promise((done, no) => { tx.oncomplete = done; tx.onerror = () => no(tx.error); });
    db.close();
    if (text.length < 2_400_000) localStorage.setItem("builder.studio", text);
    else localStorage.setItem("builder.studio", JSON.stringify({ idb: true, bytes: text.length, pages, parts, siteRepo: null }));
    return true;
  }, { text: env(doc), parts: doc.nodes.length, pages: doc.pages.length });
  const drew2 = seeded && (await make(p2));
  const stored = await p2.evaluate(async () => {
    const ask = (req) => new Promise((done, no) => { req.onsuccess = () => done(req.result); req.onerror = () => no(req.error); });
    const db = await ask(indexedDB.open("builder.docs"));
    const v = await ask(db.transaction("docs").objectStore("docs").get("builder.studio"));
    db.close();
    const m = localStorage.getItem("builder.studio");
    return { idb: typeof v === "string" ? v : null, mirror: m && !m.startsWith('{"idb"') ? m : null };
  });
  const same = (stored.mirror ?? stored.idb) === env(doc);
  const b2 = await builds(p2);
  check(`${name}: ${doc.nodes.length} parts; three concepts made beside it, the capture still the open site`, drew2 && b2.activeId === "cap" && b2.projects.length === 4, J({ drew: drew2, active: b2.activeId, sites: b2.projects.length }));
  check(`${name}: the capture's stored document is byte for byte the same`, same, same ? "" : `mirror ${stored.mirror?.length ?? "none"} / idb ${stored.idb?.length ?? "none"} vs ${env(doc).length}`);
  await c2.close();
}

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
await finish();
