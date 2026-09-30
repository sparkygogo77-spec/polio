/**
 * "BRING IT IN AGAIN" BRINGS IN WHAT THIS SITE CAME FROM, AND A REPLACE CAN BE UNDONE.
 *
 * The owner's report: on a site first brought in from sink
 * (sites/trumpmorty-fun, on a branch), "Bring sparkygogo77-spec/sink in
 * again" skipped the picker, read sink main's repository root (SOLCINERATOR,
 * 689 parts on 9 pages) and, after "Replace this one", replaced the
 * trumpmorty board. Undo could not reverse it. Choosing the folder then was
 * refused because "the source differs".
 *
 * The cause: the site's source was recorded as `owner/name@branch` with the
 * folder dropped, so "again" asked for the root of the default branch, and
 * the folder was then a different source. Held here:
 *
 *   1. the source is recorded whole (repo, branch, folder), and "again"
 *      brings exactly that; a site whose record has no folder (one brought
 *      in before this) opens the picker on that repo and branch instead;
 *   2. Replace says what goes (parts, pages) and what comes (repo, folder,
 *      branch);
 *   3. one Ctrl+Z after a Replace puts the previous board back;
 *   4. another folder of the same repository replaces the board when the
 *      person confirms it, and becomes the site's source.
 *
 * GitHub is a stand-in served in the browser; the token is a placeholder.
 *
 *   node tests/bring-again.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { trumpmorty } from "./fixtures/trumpmorty.mjs";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------ the stand-in repo */
const OWNER = "sparkygogo77-spec", NAME = "sink", REPO = `/repos/${OWNER}/${NAME}`;
const BRANCH = "claude/trumpmorty";
const tm = await trumpmorty();
if (!tm) { console.log("the trumpmorty capture was not found (SINK=…/sites/trumpmorty-fun)"); process.exit(1); }
const node = (id, pageId, label) => ({ id, pageId, featureId: "prose", label, prompt: "", content: label, data: "", x: 100, y: 100, w: 300, h: 60, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null });
const small = (name, pages, parts) => ({
  pages: Array.from({ length: pages }, (_, i) => ({ id: `p${i}`, name: `${name} ${i}`, path: i ? `/p${i}` : "/", prompt: "", scroll: "inherit" })),
  nodes: Array.from({ length: parts }, (_, i) => node(`${name.toLowerCase()}_${i}`, `p${i % pages}`, `${name} part ${i}`)),
  groups: [], shapes: [], format: {}, brief: { name, gimmick: "", master: "" }, look: { palette: {}, texture: [], target: "page", light: { on: false, x: 0.5, y: 0.1, height: 0.5, strength: 0.4, lift: 10, warmth: 80, wash: 0 } },
  motion: [], activePageId: "p0", hiddenFeatures: [], frameWidth: 1440,
});
const ROOT = small("SOLCINERATOR", 9, 27);
const SHARE = small("SHARE", 2, 6);
const TM = { ...tm, look: { ...tm.look, paletteFrom: undefined } };
const blobs = { root: ROOT, tm: TM, share: SHARE };
/* What lands: the capture's parts, plus the Dust layer attaching makes at each repainted canvas (library/captured.ts; tests/behaviours-attach.mjs). */
const LANDS = TM.nodes.length + (TM.behaviours?.motion?.canvases ?? []).filter((c) => c.kind === "particles").length;
const treeFor = (ref) => [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "root", size: 100 },
  { path: "sites/share-xyz/site/document.json", type: "blob", sha: "share", size: 100 },
  ...(ref === BRANCH ? [{ path: "sites/trumpmorty-fun/site/document.json", type: "blob", sha: "tm", size: 100 }] : []),
];

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const read = [];
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  if (!u.pathname.startsWith(REPO)) return j({ message: "no" }, 404);
  const rest = decodeURIComponent(u.pathname.slice(REPO.length));
  if (!rest) return j({ default_branch: "main", homepage: "" });
  const tree = rest.match(/^\/git\/trees\/(.+)$/);
  if (tree) return j({ tree: treeFor(tree[1]) });
  const blob = rest.match(/^\/git\/blobs\/(.+)$/);
  if (blob && blobs[blob[1]]) { read.push(blob[1]); return j({ encoding: "base64", content: Buffer.from(JSON.stringify(blobs[blob[1]])).toString("base64") }); }
  return j({ message: "no" }, 404);
});
/* The menu's list and its branches and folders: the server's routes, answered here. */
await page.route("**/api/studio/repo?**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, repos: [{ name: `${OWNER}/${NAME}`, private: false, branch: "main" }] }) }));
await page.route("**/api/studio/repo", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, repos: [{ name: `${OWNER}/${NAME}`, private: false, branch: "main" }] }) }));
await page.route("**/api/studio/repo/choices**", (r) => {
  const ref = new URL(r.request().url()).searchParams.get("ref") || "main";
  const sites = treeFor(ref).map((e) => e.path.match(/^(sites\/[^/]+)\/site\/document\.json$/)?.[1]).filter(Boolean);
  return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, base: "main", ref, branches: ["main", BRANCH], sites }) });
});

const doc = () => page.evaluate(() => window.__studioPublishDoc?.() ?? {});
const project = () => page.evaluate(() => { const b = JSON.parse(localStorage.getItem("builder.builds") || "{}").state ?? {}; return b.projects?.find((p) => p.id === b.activeId) ?? null; });
const partsNow = async () => (await doc()).nodes?.length ?? 0;
const until = async (fn, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await fn()) return true; await page.waitForTimeout(500); } return false; };
const openMenu = async () => {
  for (let i = 0; i < 3 && !(await page.locator("[data-repo-menu]").count()); i++) {
    await page.locator("[data-github-button]").first().click();
    await page.waitForTimeout(1200);
  }
  await page.locator("[data-repo-pick]").first().waitFor({ timeout: 15000 }).catch(() => {});
};
const closeMenu = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(400); };

/* An empty site, and a placeholder token through the Keys panel. */
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

/* First bring: sink, branch claude/trumpmorty, folder trumpmorty-fun, through the picker. */
await openMenu();
if (!(await page.locator(`[data-repo-pick="${OWNER}/${NAME}"]`).count())) await page.screenshot({ path: ".scratch/bring-again-menu.png" });
await page.locator(`[data-repo-pick="${OWNER}/${NAME}"]`).click();
await page.waitForTimeout(600);
await page.locator("[data-repo-branch-pick]").selectOption(BRANCH);
await page.waitForTimeout(600);
await page.locator('[data-repo-folder="sites/trumpmorty-fun"]').click();
await page.locator("[data-repo-bring-chosen]").click();
const landed = await until(async () => (await partsNow()) === LANDS);
check("the first bring lands trumpmorty.fun from its folder on its branch", landed, `${await partsNow()} parts; read ${read.join(",")}`);
const src = (await project())?.source ?? null;
check("1. the site's source is recorded whole: repo, branch and folder", src?.owner === OWNER && src?.name === NAME && src?.branch === BRANCH && src?.dir === "sites/trumpmorty-fun", JSON.stringify(src));

/* His board moves on from the import: a different board, so an undo has something to put back. */
await page.evaluate((d) => window.__studioLoadDoc(d), small("MINE", 3, 7));
await page.waitForTimeout(800);
const mine = JSON.stringify((await doc()).nodes);
check("his board is his own now (7 parts on 3 pages)", (await partsNow()) === 7);

/* 1. Bring it in again: exactly the recorded source. */
read.length = 0;
await openMenu();
const again = page.locator("[data-repo-bring-own]");
/* The button names the branch; the folder is in its title and in the line above it (the full name overflowed the menu). */
check("the menu offers to bring in again what this site came from, folder included", (await again.count()) === 1 && /sites\/trumpmorty-fun/.test(await again.getAttribute("title")) && /claude\/trumpmorty/.test(await again.innerText()), `${await again.innerText().catch(() => "none")} · ${await again.getAttribute("title").catch(() => "")}`);
await again.click();
await page.waitForTimeout(500);
const ask = page.locator("[data-repo-bring-confirm]");
const says = (await ask.count()) ? (await ask.innerText()).replace(/\s+/g, " ") : "";
check("2. Replace says what goes: this board's parts and pages", /7 parts on 3 pages/.test(says), says);
check("2. …and what comes: the repo, the folder and the branch", new RegExp(`${OWNER}/${NAME}/sites/trumpmorty-fun`).test(says) && new RegExp(BRANCH.replace("/", "\\/")).test(says), says);
await page.locator("[data-repo-bring-go]").click();
const back = await until(async () => (await partsNow()) === LANDS, 60000);
check("1. \"again\" brings in trumpmorty.fun from its folder and branch, never the repo root of main", back && read.includes("tm") && !read.includes("root"), `${await partsNow()} parts; blobs read: ${read.join(",") || "none"}`);
await page.waitForTimeout(1500);

/* 3. One Ctrl+Z puts his board back. */
await page.mouse.click(10, 990);
await page.keyboard.press("Control+z");
await page.waitForTimeout(1200);
const undone = JSON.stringify((await doc()).nodes);
check("3. one Ctrl+Z after Replace puts the previous board back", undone === mine, `${await partsNow()} parts after one undo`);

/* 1b. A site whose record has no folder (brought in before this fix): the picker opens on it, nothing is brought. */
await page.evaluate(([o, n]) => {
  const raw = JSON.parse(localStorage.getItem("builder.builds"));
  raw.state.projects = raw.state.projects.map((p) => (p.id === raw.state.activeId ? { ...p, source: { owner: o, name: n, branch: "main" } } : p));
  localStorage.setItem("builder.builds", JSON.stringify(raw));
}, [OWNER, NAME]);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const before = await partsNow();
read.length = 0;
await openMenu();
await page.locator("[data-repo-bring-own]").click();
await page.waitForTimeout(1200);
check("1. with no folder on record, \"again\" opens the picker on that repo instead of bringing its root", (await page.locator(`[data-repo-choices="${OWNER}/${NAME}"]`).count()) === 1
  && (await page.locator("[data-repo-bring-confirm]").count()) === 0 && !read.includes("root") && (await partsNow()) === before, `${await partsNow()} parts; read ${read.join(",") || "nothing"}`);

/* 4. Another folder of the same repo: confirmed, it replaces the board and becomes the source. */
await page.locator('[data-repo-folder="sites/share-xyz"]').click();
await page.locator("[data-repo-bring-chosen]").click();
await page.waitForTimeout(600);
const ask2 = page.locator("[data-repo-bring-confirm]");
const says2 = (await ask2.count()) ? (await ask2.innerText()).replace(/\s+/g, " ") : "";
check("4. another folder of the same repo asks, and says it is not where this site came from", (await ask2.count()) === 1 && /came from/.test(says2) && /share-xyz/.test(says2), says2 || (await page.locator("[data-repo-picker]").innerText()).slice(0, 300));
if (await page.locator("[data-repo-bring-go]").count()) await page.locator("[data-repo-bring-go]").click();
const shared = await until(async () => (await partsNow()) === SHARE.nodes.length, 60000);
const src2 = (await project())?.source ?? null;
check("4. …and Replace takes it, and it is the site's source from then on", shared && src2?.dir === "sites/share-xyz", `${await partsNow()} parts; source ${JSON.stringify(src2)}`);

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
