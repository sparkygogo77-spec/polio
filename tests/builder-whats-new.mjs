#!/usr/bin/env node
/**
 * WHAT'S NEW IS POINTED OUT ONCE, ON THE REAL CONTROLS (J, 2026-10-25).
 *
 * The first time the Builder is opened after an update that brings new
 * controls, each one on screen gets an accent outline and a small tip says
 * "New: … · 1 of N" with Next, Dismiss and Don't show again
 * (`src/features/whatsnew/`). Kept per browser.
 *
 *   1. registry: every entry has an id, a finder, words and `since`; a bad
 *      selector or a finder that throws is "not on screen", never an error;
 *   2. first open: the tip shows, outlines take no presses, the tip is clear
 *      of the picked part; Next goes on; nothing on the board moves;
 *   3. Dismiss, reload: what was shown stays dismissed; a panel that opens
 *      later (the picked part's Move up / Hover) brings its own entries;
 *   4. Don't show again, reload: nothing, even with a part picked;
 *   5. Ctrl+K "What's new" replays them all;
 *   6. with capture folders: each site brought in, the replay run through
 *      to the end, and the board identical part by part before and after.
 *
 *   npx next start -p 3141
 *   node tests/builder-whats-new.mjs http://127.0.0.1:3141 [capture/sites/<name> …]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3141").replace(/\/$/, "");
const SITES = process.argv.slice(3);
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* 1. The registry, read as it is. */
let reg = null;
try { reg = await import("../src/features/whatsnew/registry.ts"); } catch (e) { check("the registry loads", false, String(e?.message ?? e).slice(0, 120)); }
if (reg) {
  const ids = reg.WHATS_NEW.map((e) => e.id);
  check("the registry has the eight seeded entries", ["export", "variations", "idea", "system-tab", "house-style", "move", "hover", "wheel-move-hover"].every((id) => ids.includes(id)), ids.join(", "));
  check("ids are unique", new Set(ids).size === ids.length);
  check("every entry has a finder, words and since", reg.WHATS_NEW.every((e) => (typeof e.find === "string" || typeof e.find === "function") && e.text.length > 0 && e.text.length <= 110 && e.since.length > 0));
  const badRoot = { querySelector: () => { throw new SyntaxError("not a selector"); } };
  let threw = null;
  try {
    const a = reg.onScreen({ find: "[[[" }, badRoot);
    const b = reg.onScreen({ find: () => { throw new Error("gone"); } }, badRoot);
    const c = reg.onScreen({ find: "[data-nothing]" }, { querySelector: () => null });
    check("a bad selector, a finder that throws and a missing control are all just not on screen", a === null && b === null && c === null);
  } catch (e) { threw = e; }
  if (threw) check("a missing selector gives no error", false, String(threw.message));
}

/* A small site: three sections, a button with a hover. */
const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const from = (selector) => ({ from: { url: "https://x.test/", host: "x.test", selector, at: 1 } });
const S = (i) => `body > main > section:nth-of-type(${i})`;
const hover = [{ self: true, selector: ".btn:hover", style: { "background-color": "rgb(20, 20, 150)" } }];
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("main", "box", "", 0, 0, 1440, 1340, { colour: { bg: "rgb(20, 20, 30)" }, ...from("body > main") }),
    node("s1", "box", "", 0, 0, 1440, 400, { colour: { bg: "rgb(200, 60, 60)" }, ...from(S(1)) }),
    node("h1", "value-prop", "FIRST", 100, 100, 400, 60, { ...from(`${S(1)} > h2`) }),
    node("s2", "box", "", 0, 420, 1440, 300, { colour: { bg: "rgb(60, 200, 60)" }, ...from(S(2)) }),
    node("b2", "cta-primary", "Buy now", 100, 600, 220, 56, { colour: { bg: "rgb(30, 30, 200)", text: "#ffffff" }, motion: { hover, transition: [{ property: "all", duration: "0s" }] }, ...from(`${S(2)} > a.btn`) }),
    node("s3", "box", "", 0, 740, 1440, 600, { colour: { bg: "rgb(60, 60, 200)" }, ...from(S(3)) }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "WHATSNEW", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const errors = [];

/** Every part's drawn box and stored box: what "nothing moved" is measured on. */
const board = (page) => page.evaluate(() => {
  const drawn = [...document.querySelectorAll("[data-node-id]")].map((el) => { const r = el.getBoundingClientRect(); return `${el.getAttribute("data-node-id")}:${Math.round(r.x * 10)},${Math.round(r.y * 10)},${Math.round(r.width * 10)},${Math.round(r.height * 10)}`; });
  const stored = (window.__studioHistory?.doc().nodes ?? []).map((n) => `${n.id}:${n.x},${n.y},${n.w},${n.h}`);
  return { drawn, stored };
});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const diff = (a, b) => { const bs = new Set(b.drawn); const moved = a.drawn.filter((d) => !bs.has(d)); return `${moved.length} of ${a.drawn.length} drawn moved${moved.length ? `: ${moved.slice(0, 3).join(" ")}` : ""}; stored ${same(a.stored, b.stored) ? "same" : "changed"}`; };
const tip = (page) => page.evaluate(() => { const t = document.querySelector("[data-whatsnew-tip]"); if (!t) return null; const r = t.getBoundingClientRect(); return { id: t.getAttribute("data-whatsnew-tip"), text: t.querySelector("[data-whatsnew-text]")?.textContent ?? "", box: { x: r.x, y: r.y, w: r.width, h: r.height }, rings: [...document.querySelectorAll("[data-whatsnew-ring]")].map((r) => ({ id: r.getAttribute("data-whatsnew-ring"), pe: getComputedStyle(r).pointerEvents })) }; });
const waitTip = async (page, ms = 6000) => { for (let t = 0; t < ms; t += 250) { const x = await tip(page); if (x) return x; await page.waitForTimeout(250); } return null; };
const pick = async (page, id) => { await page.evaluate((id) => { window.__studioHistory.act("setSelection", [id]); window.__studioHistory.act("want", { panel: "inspector", id }); }, id); await page.waitForTimeout(1200); };
const replay = async (page) => {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press("Control+k"); await page.waitForTimeout(700);
  await page.keyboard.type("What's new"); await page.waitForTimeout(500);
  const item = page.locator("[cmdk-item]").filter({ hasText: /^What's new$/ }).first();
  if (!(await item.count())) { await page.keyboard.press("Escape"); return false; }
  await item.click(); await page.waitForTimeout(900);
  return true;
};

/* 2–5. The small site, on one browser. */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((d) => {
  localStorage.setItem("polio.whatsnew.auto", "on");
  if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); }
}, doc);
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="s3"]', { timeout: 30000 });
await page.waitForTimeout(800);
const b0 = await board(page);

const t1 = await waitTip(page);
check("first open: a tip says New: … · 1 of N", /^New: .+ · 1 of \d+$/.test(t1?.text ?? ""), t1?.text ?? "no tip");
check("each new control on screen has an outline that takes no presses", !!t1?.rings.length && t1.rings.every((r) => r.pe === "none"), JSON.stringify(t1?.rings));
const b1 = await board(page);
check("nothing on the board moved for it", same(b0, b1), diff(b0, b1));

/* With a part picked, the tip keeps clear of it; Move up and Hover come in with its panel. */
await pick(page, "b2");
let t2 = await tip(page);
for (let i = 0; i < 12 && t2 && !["move", "hover"].includes(t2.id); i++) { await page.locator("[data-whatsnew-next]").click(); await page.waitForTimeout(700); t2 = await tip(page); }
check("a panel that opens brings its new controls (Move up / Hover)", ["move", "hover"].includes(t2?.id), JSON.stringify(t2 && { id: t2.id, text: t2.text }));
const partBox = await page.evaluate(() => { const r = document.querySelector('[data-node-id="b2"]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const clear = (a, b) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
check("the tip never covers the picked part", !!t2 && clear(t2.box, partBox), JSON.stringify({ tip: t2?.box, part: partBox }));
const nBefore = Number(t2?.text.match(/(\d+) of/)?.[1]);
if (t2) { await page.locator("[data-whatsnew-next]").click(); await page.waitForTimeout(800); }
const t3 = await tip(page);
check("Next goes on to the next one, or closes after the last", t3 === null || Number(t3.text.match(/(\d+) of/)?.[1]) === nBefore + 1, t3?.text ?? "closed");
if (await tip(page)) { await page.locator("[data-whatsnew-dismiss]").click(); await page.waitForTimeout(500); }
check("Dismiss closes it", (await tip(page)) === null);
const seenAfterDismiss = await page.evaluate(() => JSON.parse(localStorage.getItem("polio.whatsnew") ?? "null"));
check("what was shown is kept as seen in this browser", (seenAfterDismiss?.seen ?? []).length >= 2, JSON.stringify(seenAfterDismiss));

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="s3"]', { timeout: 30000 });
await pick(page, "b2");
const t4 = await waitTip(page, 4000);
check("after a reload, what was dismissed stays dismissed", !t4 || !(seenAfterDismiss?.seen ?? []).includes(t4.id), JSON.stringify(t4 && { id: t4.id }));
if (t4) { await page.locator("[data-whatsnew-never]").click(); await page.waitForTimeout(400); }
else await page.evaluate(() => localStorage.setItem("polio.whatsnew", JSON.stringify({ seen: [], off: true })));
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="s3"]', { timeout: 30000 });
await pick(page, "b2");
check("Don't show again: nothing after a reload, even with a part picked", (await waitTip(page, 4000)) === null);

/* 5. Replay. */
const opened = await replay(page);
check("Ctrl+K has What's new", opened);
const r1 = await waitTip(page, 3000);
check("…and it replays them: 1 of N again", /· 1 of \d+$/.test(r1?.text ?? ""), r1?.text ?? "no tip");
const bR = await board(page);
let steps = 0;
for (; steps < 20 && (await tip(page)); steps++) { await page.locator("[data-whatsnew-next]").click(); await page.waitForTimeout(500); }
check("Next runs the replay to the end", steps > 0 && (await tip(page)) === null, `${steps} steps`);
const bR2 = await board(page);
check("…and the board is identical part by part", same(bR, bR2), diff(bR, bR2));
const keptOff = await page.evaluate(() => JSON.parse(localStorage.getItem("polio.whatsnew") ?? "null"));
check("a replay leaves Don't show again as it was", keptOff?.off === true, JSON.stringify(keptOff));
await ctx.close();

/* 6. Each capture folder brought in, as tests/bigger-row-grows.mjs brings one. */
for (const SINK of SITES) {
  const name = SINK.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
  if (!existsSync(join(SINK, "site/document.json"))) { check(`${name}: a capture folder`, false, SINK); continue; }
  const DOC = readFileSync(join(SINK, "site/document.json"));
  const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
  const REPO = "/repos/sparkygogo77-spec/sink";
  const tree = [{ path: "package.json", type: "blob", sha: "pkg", size: 10 }, { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length }, ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 }))];
  const c2 = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const p2 = await c2.newPage();
  const errs = [];
  p2.on("pageerror", (e) => errs.push(e.message));
  await p2.route("https://api.github.com/**", (r) => {
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
  await p2.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await p2.evaluate(() => { const env = (s) => JSON.stringify({ state: s, version: 0 }); localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" })); localStorage.setItem("builder.studio", env({ nodes: [] })); });
  await p2.reload({ waitUntil: "networkidle" }); await p2.waitForTimeout(1200);
  const keys = p2.locator("[data-keys-panel]");
  await p2.getByRole("button", { name: "Keys", exact: true }).click(); await p2.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await p2.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await p2.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click(); await p2.waitForTimeout(500);
  await p2.locator("[data-github-button]").first().click(); await p2.waitForTimeout(700);
  await p2.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
  await p2.locator("[data-repo-pull]").click(); await p2.waitForTimeout(300);
  if (await p2.locator("[data-repo-bring-go]").count()) await p2.locator("[data-repo-bring-go]").click();
  const count = () => p2.evaluate(() => window.__studioHistory?.doc().nodes.length ?? 0).catch(() => 0);
  for (let i = 0; i < 1500 && (await count()) < 20; i++) await p2.waitForTimeout(1000);
  /* Settled: the stored board the same twice, 3s apart. */
  let a = await board(p2);
  for (let i = 0; i < 60; i++) { await p2.waitForTimeout(3000); const b = await board(p2); if (same(a, b)) break; a = b; }
  for (let i = 0; i < 4 && (await p2.locator("[data-repo-panel], [role='dialog']").count()); i++) { await p2.keyboard.press("Escape"); await p2.waitForTimeout(300); }
  await p2.waitForTimeout(1500);
  const s0 = await board(p2);
  const ok = await replay(p2);
  const rt = await waitTip(p2, 3000);
  check(`${name}: ${s0.stored.length} parts; Ctrl+K What's new shows a tip`, ok && /· 1 of \d+$/.test(rt?.text ?? ""), rt?.text ?? "no tip");
  const s1 = await board(p2);
  check(`${name}: with the tip and outlines up, the board is identical part by part`, same(s0, s1), diff(s0, s1));
  let n = 0;
  for (; n < 20 && (await tip(p2)); n++) { await p2.locator("[data-whatsnew-next]").click(); await p2.waitForTimeout(500); }
  const s2 = await board(p2);
  check(`${name}: run to the end (${n}), the board is identical part by part`, (await tip(p2)) === null && same(s0, s2), diff(s0, s2));
  check(`${name}: no page errors`, errs.length === 0, errs.join(" | ").slice(0, 200));
  await c2.close();
}

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
