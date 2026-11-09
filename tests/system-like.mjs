#!/usr/bin/env node
/**
 * "LIKE ONE OF MY SITES": THE SYSTEM OF ANOTHER BOARD, WORN BY THIS ONE, THEN
 * TIDY OFFERED (handovers/audits/tidy-and-picker.md §4, J 2026-11-08: 4a;
 * the code is src/features/studio/system/api.ts#takeFromBoard and
 * panels/system/like.tsx).
 *
 *   1. pure, on the capture's own document: the System taken from it, worn
 *      back by the same parts through `linkHeld`: every field whose value a
 *      token holds points at that token (at least as many as the take
 *      linked), every linked field holds its token's value, and drawing the
 *      parts from the System hands back the very same parts (nothing moves);
 *      a blank document links nothing and is refused nothing;
 *   2. in the Builder: the capture brought in as one site; Builds → Blank
 *      site opens a blank second one; its System bar has Take from this
 *      site, Tidy right beside it, Like one of my sites and New; the picker
 *      lists the first site as a picture with its name and part count;
 *      pressing it reads its System (the dialog's counts are the hook's dry
 *      read) and says the blank site will wear it whole; Cancel leaves the
 *      site without a System; "Take it" gives it the System, new in the
 *      library and named for the board, in one undo step, and the dialog
 *      then offers Tidy; "Tidy it" opens the Tidy dialog with the plan's
 *      counts, and colours are not among the kinds it folds; one undo takes
 *      the System away again; back on the first site, the picker lists the
 *      blank one and refuses it in words ("has nothing on it yet").
 *
 *   npx next start -p 3491
 *   node tests/system-like.mjs http://127.0.0.1:3491 <the capture folder>
 *
 * PURE=1 runs part 1 only (no server). Run on sol face and mochi
 * (capture/sites/thesolface3, mochi3) and the six repo fixtures.
 */
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { takeSystem, linkHeld, linksHold } from "../src/features/studio/system/take.ts";
import { materialise } from "../src/features/studio/system/resolve.ts";
import { landPalette } from "../src/features/studio/paletteFrom.ts";
import { paletteFromHue } from "../src/features/studio/look/index.ts";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3491").replace(/\/$/, "");
const SINK = process.argv[3];
if (!SINK || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node tests/system-like.mjs <builder url> <the capture folder>");
  process.exit(2);
}
const TAG = SINK.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
const SHOTS = ".screenshots/system-like";
mkdirSync(SHOTS, { recursive: true });

const T0 = Date.now();
let phase = "starting";
const say = (w) => { phase = w; console.log(`       … ${w} (${((Date.now() - T0) / 1000).toFixed(0)}s)`); };
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const finish = async (browser) => {
  await browser?.close();
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
};
const J = (v) => JSON.stringify(v)?.slice(0, 200);

/* ------------------------------------------------------------------ */
/* 1. Pure                                                              */
/* ------------------------------------------------------------------ */
const DOC = readFileSync(join(SINK, "site/document.json"));
const doc = JSON.parse(DOC.toString("utf8"));
{
  const landed = landPalette(doc.nodes, doc.look?.palette ?? {});
  const palette = { ...paletteFromHue(265), ...landed.palette };
  const t = takeSystem({ nodes: landed.nodes, palette, frameWidth: 1440, name: TAG });
  const s = t.system;
  const worn = linkHeld(landed.nodes, s);
  /* The take's own field links (its `linked` count also holds colours naming a palette role, which follow the role tokens and are not fields to link). */
  const takeFields = [...t.links.values()].reduce((a, l) => a + Object.keys(l.f ?? {}).length, 0);
  console.log(`       ${TAG}: the take linked ${takeFields} fields; worn back, ${worn.linked} values point at tokens, ${worn.oneOffs} keep their own`);
  check("pure: worn back by its own parts, at least every field the take linked points at a token", worn.linked >= takeFields, `${worn.linked} vs ${takeFields}`);
  check("pure: every linked field holds its token's value", linksHold(worn.nodes, s).length === 0, J(linksHold(worn.nodes, s).slice(0, 3)));
  const m = materialise(worn.nodes, s);
  check("pure: drawing the parts from the System moves nothing", m.changed.length === 0 && m.nodes.every((n, i) => n === worn.nodes[i]), `${m.changed.length} changed`);
  const onlyLinked = worn.nodes.every((n) => !n.sys || (n.sys.s === s.id && Object.keys(n.sys.f ?? {}).length > 0));
  check("pure: a part points at this System or at nothing", onlyLinked);
  const blank = linkHeld([], s);
  check("pure: a blank document links nothing", blank.nodes.length === 0 && blank.linked === 0 && blank.oneOffs === 0);
}
if (process.env.PURE) await finish(null);

/* ------------------------------------------------------------------ */
/* 2. In the Builder                                                    */
/* ------------------------------------------------------------------ */
const { chromium } = await import("playwright-core");
const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
const REPO = "/repos/sparkygogo77-spec/sink";
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
  ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
];
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`[${((Date.now() - T0) / 1000).toFixed(0)}s, ${phase}] ${e.message}`));
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

const nodeCount = () => page.evaluate(() => window.__studioHistory?.doc().nodes.length ?? 0).catch(() => 0);
const sys = (fn, arg) => page.evaluate(([f, a]) => { const fn = new Function("S", "a", `return (${f})(S, a);`); return fn(window.__polioSystem, a); }, [fn.toString(), arg]);
const docSys = () => page.evaluate(() => window.__polioSystem.doc());
const pause = (ms = 600) => page.waitForTimeout(ms);

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "first", name: "First site", updatedAt: Date.now() }], activeId: "first" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
  localStorage.removeItem("builder.systems");
});
await page.reload({ waitUntil: "networkidle" });
await pause(1200);
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click();
await pause(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await pause(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await pause(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await pause(500);
await page.locator("[data-github-button]").first().click();
await pause(700);
await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
await page.locator("[data-repo-pull]").click();
await pause(300);
if (await page.locator("[data-repo-bring-go]").count()) await page.locator("[data-repo-bring-go]").click();
say("bringing in");
for (let i = 0; i < 120 && (await nodeCount()) < 50; i++) await pause(1000);
await page.mouse.move(2, 2);
await pause(Number(process.env.SETTLE ?? 5000));
const partsFirst = await nodeCount();
check("the first site came in", partsFirst >= 50, `${partsFirst} parts`);
const builds = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}").state);
/* The bring-in names the site after what it brought in; the picker and the System it gives carry that name. */
await pause(1500);
const firstName = (await builds()).projects.find((p) => p.id === "first")?.name ?? "First site";

/* The System the first site would give, read off the live document for the counts below. */
const wantFirst = await sys((S) => S.take({ dry: true }));

/* ------------------------------------------------------------------ */
/* A blank second site, as J makes one: Builds → Blank site → Open   */
/* ------------------------------------------------------------------ */
say("a blank second site");
await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
await pause(1500);
await page.locator("[data-builds-blank]").click();
for (let i = 0; i < 40 && ((await builds())?.projects?.length ?? 0) < 2; i++) await pause(500);
await pause(1500);
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await pause(2500);
const b1 = await builds();
check("Builds → Blank site opens a blank second site in the Builder", b1.projects.length === 2 && b1.activeId !== "first" && (await nodeCount()) === 0, `${b1.projects.length} sites, ${await nodeCount()} parts`);
/* The first site's document is in its slot: the picker reads it from there. */
const slotHeld = await page.evaluate(() => { const raw = localStorage.getItem("builder.doc:first"); return raw ? raw.length : 0; });
const boards = await sys((S) => S.boards());
check("the hook lists the first site as a board to take from, and not the open one", boards.length === 1 && boards[0].id === "first" && boards[0].name === firstName, J(boards));

const side = page.locator("[data-side-panel]");
/* System is a pill inside the Site tab (side-panel lane, 2026-11-08): press Site, then System, as tests/system-panel.mjs does. */
const tab = { click: async () => { await side.locator('[aria-label="Side panel"] [role=radio][aria-label="Site"]').click(); await pause(300); await side.locator('[data-site-tab="system"]').click(); } };
await tab.click();
await pause(800);
const panel = page.locator("[data-system-panel]");
const bar = panel.locator("[data-system-bar]");
const order = await bar.locator("button").evaluateAll((bs) => bs.map((b) => b.textContent.trim()));
check("the System bar reads Take from this site, Tidy, Like one of my sites, New", order.slice(0, 4).join(" | ") === "Take from this site | Tidy | Like one of my sites | New", order.join(" | "));
check("Tidy is beside Take from this site", order.indexOf("Tidy") === order.indexOf("Take from this site") + 1);
const likeOpen = bar.locator("[data-like-open]");
check("Like one of my sites can be pressed: there is another site", (await likeOpen.count()) === 1 && (await likeOpen.isEnabled()));
if (!(await likeOpen.count())) await finish(browser);

/* ------------------------------------------------------------------ */
/* The picker                                                           */
/* ------------------------------------------------------------------ */
say("the picker");
await likeOpen.click();
await pause(800);
const dlg = page.getByRole("dialog").filter({ hasText: "Like one of my sites" });
check("the picker opens", (await dlg.count()) === 1);
const tiles = dlg.locator("[data-like-board]");
check("it lists the first site as a picture with its name and part count, and not the open one", (await tiles.count()) === 1 && (await tiles.first().getAttribute("data-like-board")) === "first" && (await tiles.first().textContent()).includes(firstName) && new RegExp(`${partsFirst.toLocaleString()} parts`).test(await tiles.first().textContent()), (await tiles.first().textContent())?.trim());
check("before a pick, Take it is off", !(await dlg.locator("[data-like-confirm]").isEnabled()));
const tDry = Date.now();
const wantDry = await sys((S) => S.takeBoard("first", { dry: true }));
check("the hook's dry read of the board finds what a take of the first site finds", wantDry.ok === true && J(wantDry.report.found) === J(wantFirst.report.found), `${((Date.now() - tDry) / 1000).toFixed(1)}s; ${J(wantDry.report?.found)} vs ${J(wantFirst.report?.found)}`);
await tiles.first().click();
const tRead = Date.now();
/* A large site (parasiteonsol, 18,701 parts) is read out of IndexedDB and taken; up to 90 s for it. */
await dlg.locator("[data-like-linked]").waitFor({ timeout: 90000 });
say(`the dialog read the board in ${((Date.now() - tRead) / 1000).toFixed(1)}s`);
check("pressing it marks it picked", (await tiles.first().getAttribute("data-like-picked")) !== null);
const report = dlg.locator("[data-like-report]");
const text = (await report.textContent()) ?? "";
const f = wantDry.report.found;
check("…and the dialog says what was found, the hook's counts", text.includes(`${f.colours.toLocaleString()} colour`) && text.includes(`${f.sizes.toLocaleString()} text size`) && text.includes(`${f.space.toLocaleString()} space step`), text.slice(0, 160));
check("…that this blank site will wear it whole", /wear the System whole/.test(text) && (await dlg.locator("[data-like-linked]").getAttribute("data-like-linked")) === "0");
check("…and that nothing on the board moves", /Nothing on the board moves/.test(text));
check("Take it is now on", await dlg.locator("[data-like-confirm]").isEnabled());
await page.screenshot({ path: `${SHOTS}/${TAG}-picker.png` });
check("the dialog changed nothing", (await docSys()).systemId === null && (await sys((S) => S.library().length)) === 0 && (await nodeCount()) === 0);
await dlg.getByRole("button", { name: "Cancel" }).click();
await pause(500);
check("Cancel leaves the site without a System", (await docSys()).systemId === null && (await sys((S) => S.library().length)) === 0);

/* ------------------------------------------------------------------ */
/* Take it, then Tidy offered                                           */
/* ------------------------------------------------------------------ */
say("Take it");
const depth0 = await page.evaluate(() => window.__studioUndoDepth());
await likeOpen.click();
await pause(600);
await page.getByRole("dialog").locator("[data-like-board]").first().click();
await page.getByRole("dialog").locator("[data-like-confirm]").waitFor();
for (let i = 0; i < 180 && !(await page.getByRole("dialog").locator("[data-like-confirm]").isEnabled()); i++) await pause(500);
await page.getByRole("dialog").locator("[data-like-confirm]").click();
await page.locator("[data-like-taken]").waitFor({ timeout: 90000 });
await pause(500);
const d1 = await docSys();
const lib = await sys((S) => S.library());
const s1 = await sys((S) => S.system());
check("Take it: the site wears a System, new in the library", !!d1.systemId && lib.length === 1 && lib[0].id === d1.systemId, J(lib));
check("…named for the board it came from", s1?.name === firstName, `${s1?.name} vs ${firstName}`);
check("…with the tokens the first site gives", s1 && s1.tokens.colour.length === f.colours && s1.tokens.type.steps.length === f.sizes && s1.tokens.space.length === f.space && s1.tokens.radius.length === f.corners, s1 && J({ c: s1.tokens.colour.length, t: s1.tokens.type.steps.length, s: s1.tokens.space.length, r: s1.tokens.radius.length }));
check("…in one undo step", (await page.evaluate(() => window.__studioUndoDepth())) === depth0 + 1, `${depth0} → ${await page.evaluate(() => window.__studioUndoDepth())}`);
check("…and nothing was put on the board", (await nodeCount()) === 0 && (await sys((S) => S.broken().length)) === 0);
const takenDlg = page.getByRole("dialog");
const takenText = (await takenDlg.textContent()) ?? "";
check("the dialog then says the site wears the System, and offers Tidy", takenText.includes(`now wears the System of “${firstName}”`) && (await takenDlg.locator("[data-like-tidy]").count()) === 1 && /Colours stay exactly as they are/.test(takenText), takenText.slice(0, 160));
const foldable = s1 && (s1.tokens.type.steps.length > 1 || s1.tokens.space.length > 1 || s1.tokens.radius.length > 1);
check("Tidy it is on when there are sizes to fold", (await takenDlg.locator("[data-like-tidy]").isEnabled()) === !!foldable);
await page.screenshot({ path: `${SHOTS}/${TAG}-taken.png` });
const plan = await sys((S) => S.tidyPlan());
await takenDlg.locator("[data-like-tidy]").click();
await page.locator("[data-tidy-plan] [data-tidy-fields]").waitFor({ timeout: 60000 });
await pause(300);
const tidyDlg = page.getByRole("dialog").filter({ hasText: "Tidy the System" });
check("Tidy it opens the Tidy dialog", (await tidyDlg.count()) === 1 && (await page.locator("[data-like-taken]").count()) === 0);
const kinds = await tidyDlg.locator("[data-tidy-kind]").evaluateAll((els) => els.map((e) => ({ kind: e.dataset.tidyKind, before: Number(e.dataset.tidyBefore), after: Number(e.dataset.tidyAfter) })));
check("…with the plan's counts per kind", J(kinds) === J(plan.kinds.map((k) => ({ kind: k.kind, before: k.before, after: k.after }))), `${J(kinds)} vs ${J(plan.kinds.map((k) => ({ kind: k.kind, before: k.before, after: k.after })))}`);
check("…and colours are not among the kinds it folds", kinds.length > 0 && kinds.every((k) => ["type", "space", "radius"].includes(k.kind)), J(kinds.map((k) => k.kind)));
check("…on a blank site no part moves", (await tidyDlg.locator("[data-tidy-fields]").getAttribute("data-tidy-parts")) === "0");
await page.screenshot({ path: `${SHOTS}/${TAG}-tidy.png` });
const coloursBefore = J(s1.tokens.colour);
if (await tidyDlg.locator("[data-tidy-confirm]").isEnabled()) {
  await tidyDlg.locator("[data-tidy-confirm]").click();
  await pause(1000);
  const s2 = await sys((S) => S.system());
  check("Tidy it folds the sizes and leaves every colour token exactly as it was", !!s2.tidied && J(s2.tokens.colour) === coloursBefore && s2.tokens.type.steps.length <= s1.tokens.type.steps.length, `${s1.tokens.type.steps.length} → ${s2.tokens.type.steps.length} text sizes`);
  await page.evaluate(() => window.__studioHistory.act("undo"));
  await pause(800);
} else {
  await tidyDlg.getByRole("button", { name: "Cancel" }).click();
  await pause(400);
  console.log("  --   nothing to fold on this System: Tidy it was off");
}
await page.evaluate(() => window.__studioHistory.act("undo"));
await pause(1000);
const d0 = await docSys();
check("one undo takes the System away again", d0.systemId === null, J(d0));

/* ------------------------------------------------------------------ */
/* Back on the first site: the blank one is refused in words            */
/* ------------------------------------------------------------------ */
say("back on the first site");
await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
await pause(1500);
await page.locator('[data-build-id="first"]').getByRole("button", { name: "Switch", exact: true }).click();
for (let i = 0; i < 40 && (await builds())?.activeId !== "first"; i++) await pause(500);
await pause(1500);
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
for (let i = 0; i < 60 && (await nodeCount()) < 50; i++) await pause(1000);
await pause(2500);
check("the first site is back on the board", (await nodeCount()) === partsFirst, `${await nodeCount()} of ${partsFirst}`);
if (!(await panel.count())) { await tab.click(); await pause(800); }
await bar.locator("[data-like-open]").click();
await pause(600);
const dlg2 = page.getByRole("dialog");
const tiles2 = dlg2.locator("[data-like-board]");
check("the picker lists the blank site, and not this one", (await tiles2.count()) === 1 && (await tiles2.first().getAttribute("data-like-board")) !== "first" && /empty/.test(await tiles2.first().textContent()), (await tiles2.first().textContent())?.trim());
await tiles2.first().click();
await pause(1500);
const said = (await dlg2.locator("[data-like-report]").textContent()) ?? "";
check("…and refuses it in words: it has nothing on it yet", /has nothing on it yet/.test(said) && !(await dlg2.locator("[data-like-confirm]").isEnabled()), said.slice(0, 120));
await dlg2.getByRole("button", { name: "Cancel" }).click();
await pause(400);
check("the first site still has no System and its parts are all there", (await docSys()).systemId === null && (await nodeCount()) === partsFirst);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await page.screenshot({ path: `${SHOTS}/${TAG}-end.png` });
void slotHeld;
await finish(browser);
