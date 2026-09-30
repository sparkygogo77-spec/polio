#!/usr/bin/env node
/**
 * THE TOP BAR SAYS WHETHER THE WORK IS SAVED, AND A SITE GOES TO A FILE AND BACK.
 *
 * Lane H, item 2. Boards live only in this browser; clearing it lost them and
 * nothing said whether work was kept. Now:
 *   1. A quiet line in the top bar reads "Saved in this browser, <time>"
 *      once the board is written, on the Builder only.
 *   2. Its card has Download a backup: one versioned file
 *      (kind "polio-board-backup", version 1) holding the document as the
 *      Builder stores it, the site's name, and every picture's bytes. No key
 *      from the Keys panel is in it.
 *   3. With the browser's storage wiped, Load a backup on Builds brings the
 *      site back as a new site, pictures included, and opening it shows its
 *      part and its picture again.
 *   4. A backup from a newer format is refused in words, and so is a file
 *      that is not a backup.
 *   5. A site never backed up or published gets one gentle reminder after
 *      ten edits, once: not again that visit, and not after a reload. It
 *      is a bubble that takes no focus, so typing is never interrupted.
 *
 * Screenshots: .screenshots/lane-h/save-line.png, save-card.png,
 * save-reminder.png, builds-backup-loaded.png.
 *
 *   npx next start -p 3013
 *   node tests/board-backup.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SHOTS = ".screenshots/lane-h";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const errors = [];
const fresh = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/https:\/\/api\.(vercel|github)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  return { ctx, page };
};
const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
/* A 2×2 red PNG. */
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEJMDIgBQAABgQB/1UzpsIAAAAASUVORK5CYII=";
const PIC = { id: "pic_lanehtest", path: "assets/pictures/pic_lanehtest.png", type: "image/png", w: 2, h: 2, bytes: 75, alt: "A red square", from: "upload" };
const nodes = [
  { id: "n_words", pageId: "page_home", featureId: "prose", label: "", prompt: "", content: "Backed up words", data: "", x: 120, y: 120, w: 300, h: 60, groupId: null, options: {}, priority: "must", custom: false },
  { id: "n_pic", pageId: "page_home", featureId: "picture", label: "", prompt: "", content: "", data: "", x: 120, y: 260, w: 200, h: 200, groupId: null, options: {}, priority: "must", custom: false, picture: PIC },
];
const putPicture = (page) => page.evaluate(async ({ PNG, id }) => {
  const bin = atob(PNG); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "image/png" });
  await new Promise((done, no) => {
    const req = indexedDB.open("builder.pictures", 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("files")) req.result.createObjectStore("files"); };
    req.onerror = () => no(req.error);
    req.onsuccess = () => { const tx = req.result.transaction("files", "readwrite"); tx.objectStore("files").put(blob, id); tx.oncomplete = () => done(); tx.onerror = () => no(tx.error); };
  });
}, { PNG, id: PIC.id });
const pictureHeld = (page) => page.evaluate(async (id) => new Promise((done) => {
  const req = indexedDB.open("builder.pictures", 1);
  req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("files")) req.result.createObjectStore("files"); };
  req.onerror = () => done(null);
  req.onsuccess = () => { try { const g = req.result.transaction("files", "readonly").objectStore("files").get(id); g.onsuccess = () => done(g.result ? g.result.size : null); g.onerror = () => done(null); } catch { done(null); } };
}), PIC.id);

let file = null;
/* ------------------------------------------------ 1–2. the line, the card, the download */
{
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ doc, builds }) => {
    localStorage.clear();
    localStorage.setItem("builder.builds", builds);
    localStorage.setItem("builder.studio", doc);
    /* A stand-in for a key held in the Keys panel: it must never reach a backup. */
    localStorage.setItem("builder.keys", JSON.stringify({ sealed: "STANDIN_KEY_NOT_A_SECRET" }));
  }, {
    builds: env({ projects: [{ id: "s1", name: "Backed Site", updatedAt: Date.now(), nudged: true }], activeId: "s1" }),
    doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes }),
  });
  await putPicture(page);
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__studioHistory, null, { timeout: 20000 });
  await page.evaluate(() => window.__studioHistory.act("updateNode", "n_words", { content: "Backed up words, kept" }));
  await page.waitForTimeout(900);
  const line = page.locator("header [data-save-line]");
  const words = (await line.getAttribute("aria-label")) ?? "";
  check("the top bar says the board is saved in this browser, with a time", /^Saved in this browser, \d{1,2}[:.]\d{2}/.test(words), J(words));
  check("the line is the saved state, not a spinner", (await line.getAttribute("data-save-line")) === "saved", await line.getAttribute("data-save-line"));
  await page.screenshot({ path: `${SHOTS}/save-line.png`, clip: { x: 700, y: 0, width: 740, height: 90 } });
  await line.click();
  await page.waitForTimeout(400);
  const card = page.locator("[data-save-card]");
  check("pressing it opens what it means, and the two backups", (await card.count()) === 1 && /only/.test(await card.innerText()), (await card.innerText().catch(() => "")).slice(0, 160));
  await page.screenshot({ path: `${SHOTS}/save-card.png`, clip: { x: 900, y: 0, width: 540, height: 320 } });
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), card.locator("[data-backup-download]").click()]);
  const path = join(tmpdir(), `lane-h-${Date.now()}-${download.suggestedFilename()}`);
  await download.saveAs(path);
  file = readFileSync(path, "utf8");
  const b = JSON.parse(file);
  check("the file is named for the site and the day", /^backed-site-backup-\d{4}-\d{2}-\d{2}\.polio\.json$/.test(download.suggestedFilename()), download.suggestedFilename());
  check("the file says what it is and its format version", b.kind === "polio-board-backup" && b.version === 1 && typeof b.savedAt === "string", J({ kind: b.kind, version: b.version }));
  check("it holds the document as the Builder stores it", Array.isArray(b.document?.state?.nodes) && b.document.state.nodes.some((n) => n.content === "Backed up words, kept"), J(b.document?.state?.nodes?.map((n) => n.id)));
  check("it holds the picture's bytes", b.pictures?.length === 1 && b.pictures[0].id === PIC.id && b.pictures[0].data === PNG, J(b.pictures?.map((p) => ({ id: p.id, len: p.data?.length }))));
  check("it holds the site's name", b.site?.name === "Backed Site", J(b.site));
  check("no key from the Keys panel is in it", !file.includes("STANDIN_KEY") && !file.includes("builder.keys"), "");
  await page.waitForTimeout(300);
  const said = await page.locator("[data-backup-said]").innerText().catch(() => "");
  check("the card says what was downloaded", /Downloaded backed-site-backup/.test(said) && /1 picture/.test(said), J(said));
  const backedUp = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds")).state.projects[0].backedUpAt);
  check("the site remembers when it was backed up", typeof backedUp === "number", J(backedUp));
  await ctx.close();
}

/* ------------------------------------------------ 3. a wiped browser, and the file brings it back */
{
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/builds`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    localStorage.clear();
    for (const name of ["builder.docs", "builder.pictures", "builder.thumbs"]) await new Promise((d) => { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = () => d(); });
  });
  await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const before = await page.locator("[data-builds-list] > li").count();
  const tmp = join(tmpdir(), `lane-h-load-${Date.now()}.polio.json`);
  writeFileSync(tmp, file);
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator("[data-builds-load-backup]").click()]);
  await chooser.setFiles(tmp);
  await page.waitForTimeout(1500);
  const said = await page.locator("[data-builds-loaded]").innerText().catch(() => "");
  check("Load a backup says the site is back, as a new site, with its picture", /Backed Site is back, as a new site/.test(said) && /1 picture/.test(said), J(said));
  const names = await page.locator("[data-builds-list] > li").allInnerTexts();
  check("the site is on the list beside the others", names.some((t) => t.includes("Backed Site")) && names.length === before + 1, J(names.map((t) => t.split("\n")[0])));
  check("its picture's bytes are back in this browser", (await pictureHeld(page)) === atob(PNG).length, J(await pictureHeld(page)));
  await page.screenshot({ path: `${SHOTS}/builds-backup-loaded.png`, fullPage: false });
  /* Open it: its words are on the board. */
  const card = page.locator("[data-builds-list] > li", { hasText: "Backed Site" }).first();
  const switcher = card.getByRole("button", { name: "Switch", exact: true });
  if (await switcher.count()) await switcher.click();
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const onBoard = await page.locator('[data-node-id="n_words"]').innerText().catch(() => "");
  check("opened, the board is the site that was backed up", /Backed up words, kept/.test(onBoard), J(onBoard));
  const img = await page.evaluate(() => [...document.querySelectorAll('[data-node-id="n_pic"] img')].map((i) => i.getAttribute("src") ?? "").filter((s) => s.startsWith("blob:")).length);
  check("and its picture is drawn from the restored bytes", img >= 1, `${img} pictures from this browser's files`);

  /* 4. The wrong files are refused in words. */
  await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const newer = JSON.parse(file); newer.version = 99;
  writeFileSync(tmp, JSON.stringify(newer));
  let [c2] = await Promise.all([page.waitForEvent("filechooser"), page.locator("[data-builds-load-backup]").click()]);
  await c2.setFiles(tmp);
  await page.waitForTimeout(800);
  const refused = await page.locator("[data-builds-loaded]").innerText().catch(() => "");
  check("a backup from a newer format is refused in words", /newer Builder/.test(refused) && /format 99/.test(refused), J(refused));
  writeFileSync(tmp, JSON.stringify({ hello: "world" }));
  [c2] = await Promise.all([page.waitForEvent("filechooser"), page.locator("[data-builds-load-backup]").click()]);
  await c2.setFiles(tmp);
  await page.waitForTimeout(800);
  const notOne = await page.locator("[data-builds-loaded]").innerText().catch(() => "");
  check("a file that is not a backup is refused in words", /not a backup/.test(notOne), J(notOne));
  await ctx.close();
}

/* ------------------------------------------------ 5. the one reminder */
{
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ doc, builds }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, {
    builds: env({ projects: [{ id: "r1", name: "Never Kept", updatedAt: Date.now() }], activeId: "r1" }),
    doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [nodes[0]] }),
  });
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__studioHistory, null, { timeout: 20000 });
  const edit = async (n) => { for (let i = 0; i < n; i++) { await page.evaluate((i) => window.__studioHistory.act("setFormat", "pages.nav", i % 2 ? "sidebar" : "top bar"), i); } await page.waitForTimeout(500); };
  await edit(9);
  check("no reminder before the tenth edit", (await page.locator("[data-save-reminder]").count()) === 0, "");
  /* Something being typed in: the reminder must not take the keys from it. */
  await page.evaluate(() => { const i = document.createElement("input"); i.id = "lane-h-typing"; document.body.appendChild(i); i.focus(); });
  await edit(1);
  const reminder = page.locator("[data-save-reminder]");
  check("the reminder takes no focus: what was being typed in keeps it", await page.evaluate(() => document.activeElement?.id === "lane-h-typing"), await page.evaluate(() => document.activeElement?.outerHTML?.slice(0, 80)));
  check("after ten edits, one gentle reminder to back it up", (await reminder.count()) === 1 && /never been backed up or published/.test(await reminder.innerText()), await reminder.innerText().catch(() => ""));
  await page.screenshot({ path: `${SHOTS}/save-reminder.png`, clip: { x: 900, y: 0, width: 540, height: 320 } });
  await page.getByRole("button", { name: "Not now" }).click();
  await page.waitForTimeout(300);
  await edit(15);
  check("not again this visit", (await page.locator("[data-save-reminder]").count()) === 0, "");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__studioHistory, null, { timeout: 20000 });
  await edit(12);
  check("not again after a reload", (await page.locator("[data-save-reminder]").count()) === 0, "");
  await ctx.close();
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
