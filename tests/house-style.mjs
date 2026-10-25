#!/usr/bin/env node
/**
 * ONE HOUSE STYLE, SHARED BY EVERY SITE (J, 2026-10-24).
 *
 * The library's Systems can have one house style. A site with no System of
 * its own points at it: a new site wears it, a fresh import points at it and
 * moves nothing (it still offers Take from this site). A token changed on
 * the house style reaches every site on it, in one undo step where it was
 * made. Driven through the real doors (Builds' Blank site and New site, the
 * GitHub bring, the System tab):
 *
 *   1. site A, an import: Take from this site, then the House style toggle;
 *   2. site C, a fresh import with the house style there: it points at it,
 *      links nothing, keeps its own palette, and its board is the same part
 *      by part (and, where the board holds still, pixel for pixel) as the
 *      same import in a browser with no house style;
 *   3. site B, a New site: it points at the house style and wears its
 *      colours; the System tab says so in plain words;
 *   4. on A the house style's accent changed in its row: one undo step, and
 *      A repaints; B, opened, repaints too; C does not move;
 *   5. Own copy on B breaks away from the house style.
 *
 *   npx next start -p 3072
 *   node tests/house-style.mjs http://127.0.0.1:3072 <the capture folder> [<a second capture folder>]
 *
 * The first capture is site A; the second (default: the first) is site C,
 * best one whose untouched board holds still (mochi), so pixels can decide.
 */
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3072").replace(/\/$/, "");
const SINK_A = process.argv[3];
const SINK_C = process.argv[4] ?? SINK_A;
if (!SINK_A || !existsSync(join(SINK_A, "site/document.json")) || !existsSync(join(SINK_C, "site/document.json"))) {
  console.error("usage: node tests/house-style.mjs <builder url> <the capture folder> [<a second capture folder>]");
  process.exit(2);
}
const SHOTS = ".screenshots/house-style";
mkdirSync(SHOTS, { recursive: true });
const T0 = Date.now();
const say = (w) => console.log(`       … ${w} (${((Date.now() - T0) / 1000).toFixed(0)}s)`);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const finish = async () => {
  await browser.close();
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
};

/* ------------------------------------------------------------------ */
/* A page that can bring captures in (as tests/system-panel.mjs does)   */
/* ------------------------------------------------------------------ */
const REPO = "/repos/sparkygogo77-spec/sink";
let serving = SINK_A;
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.route("https://api.github.com/**", (r) => {
    const SINK = serving;
    const DOC = readFileSync(join(SINK, "site/document.json"));
    const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
    const tree = [
      { path: "package.json", type: "blob", sha: "pkg", size: 10 },
      { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
      ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
    ];
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
  return page;
}
const pause = (page, ms = 600) => page.waitForTimeout(ms);
const nodeCount = (page) => page.evaluate(() => window.__studioHistory?.doc().nodes.length ?? 0).catch(() => 0);
const builds = async (page) => { await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" }); await pause(page, 900); };
const toBuilder = async (page) => { await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" }); await pause(page, 2000); };
async function blankSite(page) { await builds(page); await page.locator("[data-builds-blank]").click(); await pause(page, 1500); await toBuilder(page); }
async function newSite(page) { await builds(page); await page.getByRole("button", { name: "New site" }).first().click(); await pause(page, 1500); await toBuilder(page); }
/* By id: a site brought in takes its repository's name. */
const projects = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}").state ?? {});
async function switchTo(page, id) {
  await builds(page);
  const name = (await projects(page)).projects?.find((p) => p.id === id)?.name;
  await page.getByRole("button", { name: `Switch to ${name}`, exact: true }).click();
  await pause(page, 1500);
  await toBuilder(page);
}
const siteName = async (page) => (await projects(page)).activeId ?? null;
async function bring(page, sink) {
  serving = sink;
  const keys = page.locator("[data-keys-panel]");
  if (!page.keyed) {
    await page.getByRole("button", { name: "Keys", exact: true }).click();
    await pause(page, 500);
    const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
    if (await skip.count()) { await skip.first().click(); await pause(page, 300); }
    await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
    await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
    await pause(page, 500);
    await keys.getByRole("button", { name: "Close keys" }).click();
    await pause(page, 500);
    page.keyed = true;
  }
  await page.locator("[data-github-button]").first().click();
  await pause(page, 700);
  await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
  await page.locator("[data-repo-pull]").click();
  await pause(page, 300);
  if (await page.locator("[data-repo-bring-go]").count()) await page.locator("[data-repo-bring-go]").click();
  for (let i = 0; i < 120 && (await nodeCount(page)) < 50; i++) await pause(page, 1000);
  await page.mouse.move(2, 2);
}

/* ------------------------------------------------------------------ */
/* Reading a board                                                      */
/* ------------------------------------------------------------------ */
const PROPS = ["color", "background-color", "background-image", "border-top-color", "border-top-width", "border-radius", "box-shadow", "padding", "gap", "font-size", "font-family", "font-weight", "line-height", "letter-spacing", "transition", "opacity", "transform"];
const hold = (p) => p.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 0; } catch { /* a finished one */ } } });
const boardRead = async (page) => { await hold(page); return page.evaluate((PROPS) => {
  const out = {};
  /* Boxes from the page frame's corner: what is above the board (a strip the Builder shows on a first visit) is not the site. */
  const f = document.querySelector("[data-frame]")?.getBoundingClientRect() ?? { x: 0, y: 0 };
  for (const el of document.querySelectorAll("[data-studio-scroll] [data-node-id]")) {
    const b = el.getBoundingClientRect();
    /* A part not drawn (another page, folded away) has no place, only that it is not drawn. */
    const r = b.width || b.height ? { x: b.x - f.x, y: b.y - f.y, width: b.width, height: b.height } : { x: 0, y: 0, width: 0, height: 0 };
    /* A picture's blob: address is new in every browser; the picture is the same. */
    const styles = [el, ...el.querySelectorAll("*")].slice(0, 60).map((e) => { const cs = getComputedStyle(e); return PROPS.map((p) => cs.getPropertyValue(p).replace(/blob:[^")\s]+/g, "blob:")).join("|"); });
    out[el.getAttribute("data-node-id")] = `${Math.round(r.x * 10)},${Math.round(r.y * 10)},${Math.round(r.width * 10)},${Math.round(r.height * 10)}#${styles.join(";")}`;
  }
  return out;
}, PROPS); };
const differ = (a, b) => Object.keys(a).filter((id) => a[id] !== b[id]).concat(Object.keys(b).filter((id) => !(id in a)));
/**
 * Parts of `b` unlike `a`, read again where they differ: a part that moves of
 * itself (a fade, a blink) shows both states, and is the same part when one
 * read of it matches.
 */
async function unlike(page, a, b) {
  let left = differ(a, b);
  for (let i = 0; i < 10 && left.length; i++) {
    await pause(page, 1100);
    const again = await boardRead(page);
    left = left.filter((id) => a[id] !== again[id]);
  }
  return left;
}
/** Only what a reveal moves differs on this part (opacity, and the transform that slides it in): a reveal on a timer or on view, caught at another moment. Its box is the same. */
function onlyOpacity(a, b, id) {
  if (!a[id] || !b[id]) return false;
  const skip = new Set([PROPS.indexOf("opacity"), PROPS.indexOf("transform")]);
  const strip = (v) => v.split("#")[1].split(";").map((e) => e.split("|").filter((_, j) => !skip.has(j)).join("|")).join(";");
  return a[id].split("#")[0] === b[id].split("#")[0] && strip(a[id]) === strip(b[id]);
}
/** What differs on one part: its box, or the first painted style that does (element, property, before → after). */
function why(a, b, id) {
  if (!a[id] || !b[id]) return `${id} ${a[id] ? "gone" : "new"}`;
  const [ba, sa] = a[id].split("#"), [bb, sb] = b[id].split("#");
  if (ba !== bb) return `${id} box ${ba} → ${bb}`;
  const ea = sa.split(";"), eb = sb.split(";");
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) {
    if (ea[i] === eb[i]) continue;
    const pa = (ea[i] ?? "").split("|"), pb = (eb[i] ?? "").split("|");
    const k = PROPS.findIndex((_, j) => pa[j] !== pb[j]);
    return `${id} el ${i} ${PROPS[k]} ${pa[k]} → ${pb[k]}`;
  }
  return `${id} ?`;
}
/** The board once two reads 1.5s apart agree: a large site's pictures arrive after its parts (tests/system-panel.mjs). */
async function stillBoard(page) {
  let b = await boardRead(page);
  for (let i = 0, still = 0; i < 80 && still < 2; i++) { await pause(page, 1500); const n = await boardRead(page); still = differ(b, n).length ? 0 : still + 1; b = n; }
  return b;
}
/* The page frame from its own corner, the same size every time: where the Builder puts it on screen is not the site. */
const frameClip = (page) => page.evaluate(() => { const r = document.querySelector("[data-frame]")?.getBoundingClientRect(); if (!r) return null; const x = Math.max(0, r.left), y = Math.max(0, r.top); return { x, y, width: Math.min(innerWidth, r.right) - x, height: Math.min(640, innerHeight - y) }; });
const shot = async (page) => { await hold(page); const clip = await frameClip(page); return sharp(await page.screenshot({ animations: "disabled", ...(clip ? { clip } : {}) })).raw().toBuffer({ resolveWithObject: true }); };
/** Pixels of `after` that match the same pixel in none of `befores`: what changed, beyond what the untouched board shows over time (tests/system-take.mjs). */
function unlikeAny(befores, after) {
  if (befores.some((b) => b.data.length !== after.data.length)) return Infinity;
  const ch = after.info.channels, W = after.info.width;
  let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let i = 0; i < after.data.length; i += ch) if (!befores.some((b) => b.data[i] === after.data[i] && b.data[i + 1] === after.data[i + 1] && b.data[i + 2] === after.data[i + 2])) { n++; const p = i / ch, x = p % W, y = (p - x) / W; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (n && process.env.DIAG) console.log(`       DIAG px at ${x0},${y0}..${x1},${y1}`);
  return n;
}
/** Shots of the board a moment apart: what it looks like, moving parts and all. */
async function shots(page, n = 5) { const out = []; for (let i = 0; i < n; i++) { if (i) await pause(page, 1200); out.push(await shot(page)); } return out; }
const pxDiff = (a, b) => { if (a.data.length !== b.data.length) return Infinity; let n = 0; for (let i = 0; i < a.data.length; i += a.info.channels) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++; return n; };
const doc = (page) => page.evaluate(() => window.__polioSystem.site());
/** The board's document as the import left it: every part and the look, as text (the System's fields left out: they are what is being checked). */
const siteText = (page) => page.evaluate(() => { const d = window.__studioHistory.doc(); return JSON.stringify({ nodes: d.nodes.map(({ sys: _s, ...n }) => n), look: d.look }); });
const sys = (page, fn, arg) => page.evaluate(([f, a]) => new Function("S", "a", `return (${f})(S, a);`)(window.__polioSystem, a), [fn.toString(), arg]);
const systemTab = async (page) => { await page.locator('[data-side-panel] [aria-label="Side panel"] [role=radio][aria-label="System"]').click(); await pause(page, 700); };
/** Parts of the board drawing a colour, anywhere in what they paint. */
const wearing = (page, v) => page.evaluate((v) => [...document.querySelectorAll("[data-studio-scroll] [data-node-id]")].filter((el) => [el, ...el.querySelectorAll("*")].some((e) => { const cs = getComputedStyle(e); return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.backgroundImage].some((c) => c.includes(v)); })).map((el) => el.getAttribute("data-node-id")), v);

/* ------------------------------------------------------------------ */
/* The control: site C's capture, brought in where there is no house style */
/* ------------------------------------------------------------------ */
say("the control: a fresh import with no house style");
const ctl = await newPage();
await builds(ctl);
await ctl.evaluate(() => localStorage.clear());
await blankSite(ctl);
await bring(ctl, SINK_C);
const control = await stillBoard(ctl);
const controlPx = await shots(ctl);
const controlDoc = await doc(ctl);
const controlText = await siteText(ctl);
check("the control import came in, with no System", Object.keys(control).length >= 50 && controlDoc.systemId === null, `${Object.keys(control).length} parts`);
await ctl.context().close();

/* ------------------------------------------------------------------ */
/* 1. Site A: take its System, make it the house style                  */
/* ------------------------------------------------------------------ */
const page = await newPage();
await builds(page);
await page.evaluate(() => localStorage.clear());
await blankSite(page);
const NAME_A = await siteName(page);
say(`site A (${NAME_A}): bringing in`);
await bring(page, SINK_A);
await stillBoard(page);
check("site A came in", (await nodeCount(page)) >= 50, `${await nodeCount(page)} parts`);
await systemTab(page);
const panel = page.locator("[data-system-panel]");
await panel.locator("[data-take-open]").click();
await page.locator("[data-take-report] [data-take-linked]").waitFor({ timeout: 20000 });
await page.locator("[data-take-confirm]").click();
await pause(page, 2500);
const A = await doc(page);
check("site A has a System of its own", !!A.systemId && A.linked > 0);
const toggle = panel.locator("[data-house-toggle]");
if (!(await toggle.count())) { check("the System tab has a House style toggle", false); await finish(); }
await toggle.click();
await pause(page, 800);
const HOUSE = await sys(page, (S) => S.house());
check("House style: site A's System is the house style", HOUSE === A.systemId, `${HOUSE}`);
check("…and the panel says this site uses it", (await panel.locator("[data-house-says]").count()) === 1);
const house0 = await sys(page, (S) => S.system());
const accent = house0.tokens.colour.find((t) => t.role === "accent");
check("the house style holds an accent", !!accent, accent ? `${accent.name} ${accent.value}` : "");

/* ------------------------------------------------------------------ */
/* 2. Site C: a fresh import with the house style there                 */
/* ------------------------------------------------------------------ */
await blankSite(page);
const NAME_C = await siteName(page);
say(`site C (${NAME_C}): bringing in`);
await bring(page, SINK_C);
const boardC = await stillBoard(page);
const C = await doc(page);
check("a fresh import points at the house style", C.systemId === HOUSE, `${C.systemId}`);
check("…links nothing, and takes only the palette roles it already wears", C.linked === 0 && Array.isArray(C.roles), `${C.linked} parts linked, roles ${JSON.stringify(C.roles)}`);
check("…and keeps its own palette", JSON.stringify(C.palette) === JSON.stringify(controlDoc.palette), JSON.stringify(C.palette).slice(0, 160));
const dAll = await unlike(page, control, boardC);
const reveals = dAll.filter((id) => onlyOpacity(control, boardC, id));
const dC = dAll.filter((id) => !reveals.includes(id));
check("a fresh import's document is the same as the same import with no house style", (await siteText(page)) === controlText);
check("its board is the same, part by part, as the same import with no house style", dC.length === 0 && Object.keys(boardC).length === Object.keys(control).length, `${Object.keys(control).length} parts, ${dC.length} differ ${dC.slice(0, 3).map((id) => why(control, boardC, id)).join("; ")}${reveals.length ? `; ${reveals.length} reveal caught at another moment (opacity and transform only): ${reveals.slice(0, 3).join(", ")}` : ""}`);
const pxC = await shots(page, 3);
if (process.env.DIAG) { await sharp(controlPx[0].data, { raw: controlPx[0].info }).png().toFile(`${SHOTS}/control.png`); await sharp(pxC[0].data, { raw: pxC[0].info }).png().toFile(`${SHOTS}/siteC.png`); }
/* Pixels decide only where the untouched control holds still from shot to shot (sunkcoin's sea never does): there the part-by-part read is the check. */
const controlMoves = unlikeAny(controlPx.slice(0, -1), controlPx[controlPx.length - 1]);
const nC = Math.min(...pxC.map((x) => unlikeAny(controlPx, x)));
if (controlMoves === 0) check("…and 0 px different from it", nC === 0, `${nC} px`);
else console.log(`  --   pixels not decidable here: the untouched control differs from itself by ${controlMoves} px (site C: ${nC})`);
await systemTab(page);
check("…and it still offers Take from this site", (await panel.locator("[data-take-open]").count()) === 1 && (await panel.locator("[data-house-says]").count()) === 1);

/* ------------------------------------------------------------------ */
/* 3. Site B: a New site                                                */
/* ------------------------------------------------------------------ */
await newSite(page);
const NAME_B = await siteName(page);
say(`site B (${NAME_B}): a new site`);
await pause(page, 1500);
const B = await doc(page);
check("a new site points at the house style, and takes all of it", B.systemId === HOUSE && B.roles === null && B.nodes >= 10, `${B.systemId}, roles ${JSON.stringify(B.roles)}, ${B.nodes} parts`);
check("…and wears its colours", Object.entries((await sys(page, (S) => S.system())).tokens.colour.filter((t) => t.role).reduce((o, t) => ({ ...o, [t.role]: t.value }), {})).every(([r, v]) => B.palette[r] === v), JSON.stringify(B.palette).slice(0, 200));
await systemTab(page);
check("the System tab says, in plain words, that it uses the house style", /uses the house style/.test((await panel.locator("[data-house-says]").textContent().catch(() => "")) ?? ""));

/* ------------------------------------------------------------------ */
/* 4. The accent changed on A reaches B; C does not move                */
/* ------------------------------------------------------------------ */
await switchTo(page, NAME_A);
await systemTab(page);
const MAGENTA = "rgb(255, 0, 255)";
const beforeA = (await wearing(page, MAGENTA)).length;
const depth0 = await page.evaluate(() => window.__studioUndoDepth());
const box = panel.locator(`[data-token-row="${accent.id}"] input:not([type=color])`);
const boxW = await box.evaluate((el) => el.getBoundingClientRect().width);
check("the accent's value can be read and typed in, at the panel's own width", boxW >= 100, `${Math.round(boxW)}px wide`);
await box.fill(MAGENTA);
await box.press("Enter");
await pause(page, 1500);
check("the accent changed in its row on site A: one undo step", (await page.evaluate(() => window.__studioUndoDepth())) === depth0 + 1, `${depth0} → ${await page.evaluate(() => window.__studioUndoDepth())}`);
const nowA = (await wearing(page, MAGENTA)).length;
check("…site A repaints", nowA > beforeA, `${nowA} parts wear it`);
check("…and the house style holds it, in the library", (await sys(page, (S, id) => S.system().tokens.colour.find((t) => t.id === id).value, accent.id)) === MAGENTA);

await switchTo(page, NAME_B);
await pause(page, 1500);
const B2 = await doc(page);
const wearB = await wearing(page, MAGENTA);
check("site B, opened, wears the new accent", B2.palette.accent === MAGENTA && wearB.length > 0, `accent ${B2.palette.accent}, ${wearB.length} parts wear it`);

await switchTo(page, NAME_C);
const boardC2 = await stillBoard(page);
const dAll2 = await unlike(page, boardC, boardC2);
const reveals2 = dAll2.filter((id) => onlyOpacity(boardC, boardC2, id));
const dC2 = dAll2.filter((id) => !reveals2.includes(id));
/* No pixel check here: the Builder may put the frame at another place on screen on a second visit (a strip above it on the first), and a frame drawn at another fraction of a pixel differs everywhere. Part by part, from the frame's corner, is the check. */
check("site C does not move: it never took the accent", dC2.length === 0, `${dC2.length} parts differ ${dC2.slice(0, 3).map((id) => why(boardC, boardC2, id)).join("; ")}${reveals2.length ? `; ${reveals2.length} reveal caught at another moment (opacity and transform only)` : ""}`);

/* ------------------------------------------------------------------ */
/* 5. Own copy breaks away                                              */
/* ------------------------------------------------------------------ */
await switchTo(page, NAME_B);
await systemTab(page);
await panel.locator("[data-system-fork]").click();
await pause(page, 800);
const B3 = await doc(page);
check("Own copy on site B breaks away from the house style", !!B3.systemId && B3.systemId !== HOUSE && (await sys(page, (S) => S.house())) === HOUSE && (await panel.locator("[data-house-says]").count()) === 0);

check("no page errors", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
await page.screenshot({ path: `${SHOTS}/end.png` });
await finish();
