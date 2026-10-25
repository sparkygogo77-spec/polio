/**
 * A ONE-ROW PART MADE BIGGER GROWS AS TALL AS ITS ROW.
 *
 * EDIT-ISSUES #31 (the hand-edit pass, 2026-10-23): share.xyz's "Share" and
 * gotchi's labels made bigger in the panel widened to their words but kept
 * their height, so the row ran 4 to 6px under the box's foot. Mochi's hero
 * heading ran 18px under. `growToWords.ts#heldRowsGrow` now makes one row as
 * tall as it is drawn, and the settle moves what is below.
 *
 *   1. the label 1.5 times bigger: its row lies inside its box, to 1px;
 *   2. the part under it is moved clear of it;
 *   3. one Ctrl+Z takes back the size, width and height together;
 *   4. control: a heading set tighter than its letters (leading 0.98, the
 *      page's own, EDIT-ISSUES #24) is grown no more than its row needs.
 *
 * With a capture folder (share-xyz), the same through the panel's "Size in
 * pixels" on its "Share" label and a 13px label (n_prose_19, n_prose_145).
 *
 *   node tests/bigger-row-grows.mjs http://127.0.0.1:3061 [capture/sites/share-xyz]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const from = (selector) => ({ from: { url: "https://x.test/", host: "x.test", selector, at: 1 } });
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("sec", "box", "", 0, 300, 1440, 500, { colour: { bg: "rgb(20, 20, 30)" }, ...from("body > main > section") }),
    /* share.xyz's "Share": one word, one row, its box as tall as its line. */
    node("label", "prose", "Share", 100, 360, 64, 28, { font: { face: "Arial", stack: "Arial, sans-serif", size: 1, px: 23, weight: 500, leading: 1.23 }, colour: { text: "rgb(240, 240, 240)" }, ...from("body > main > section > div > p") }),
    node("under", "prose", "Under it", 100, 396, 200, 24, { font: { face: "Arial", stack: "Arial, sans-serif", size: 1, px: 16, weight: 400, leading: 1.4 }, colour: { text: "rgb(200, 200, 200)" }, ...from("body > main > section > div > span") }),
    /* A heading set tighter than its letters, as the page sets it. */
    node("tight", "value-prop", "BIG", 700, 360, 140, 59, { font: { face: "Arial", stack: "Arial, sans-serif", size: 1, px: 60, weight: 800, leading: 0.98 }, colour: { text: "rgb(240, 240, 240)" }, ...from("body > main > section > h2") }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "ROW", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="label"]', { timeout: 20000 });
await page.waitForTimeout(2500);
const nodeOf = async (id) => (await page.evaluate(() => window.__studioHistory?.doc().nodes ?? [])).find((n) => n.id === id);
/** How far its row runs under the box's foot and over its top, in page px. */
const under = (id) => page.evaluate((id) => {
  const el = document.querySelector(`[data-node-id="${id}"]`); const b = el.getBoundingClientRect(); const k = document.querySelector("[data-frame]").getBoundingClientRect().width / 1440;
  let top = Infinity, foot = -Infinity;
  const tw = document.createTreeWalker(el.querySelector("[data-part-drawn]") ?? el, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) { if (!t.textContent.trim()) continue; const g = document.createRange(); g.selectNodeContents(t); for (const q of g.getClientRects()) if (q.width) { top = Math.min(top, q.top); foot = Math.max(foot, q.bottom); } }
  return { foot: Math.round((foot - b.bottom) / k), top: Math.round((b.top - top) / k) };
}, id);
const bigger = async (id) => { const n = await nodeOf(id); await page.evaluate(({ id, font }) => window.__studioHistory.act("updateNode", id, { font }), { id, font: { ...n.font, size: n.font.size * 1.5 } }); await page.waitForTimeout(2000); };

const l0 = await nodeOf("label"), u0 = await nodeOf("under");
check("the label's row fits its box before", (await under("label")).foot <= 1);
await bigger("label");
const l1 = await nodeOf("label"), u1 = await nodeOf("under"), r1 = await under("label");
check("the label 1.5 times bigger: its row lies inside its box, to 1px", r1.foot <= 1 && r1.top <= 1, `${JSON.stringify(r1)}; h ${l0.h} → ${l1.h}, w ${l0.w} → ${l1.w}`);
check("…the part under it is moved clear of it", u1.y >= l1.y + l1.h, `under at ${u1.y}, label ends ${l1.y + l1.h} (was ${u0.y})`);
await page.evaluate(() => document.activeElement?.blur?.());
await page.keyboard.press("Control+z"); await page.waitForTimeout(800);
const l2 = await nodeOf("label"), u2 = await nodeOf("under");
check("one Ctrl+Z takes back size, width and height, and what is under it", l2.font.size === l0.font.size && l2.w === l0.w && l2.h === l0.h && u2.y === u0.y, `${l2.font.size} ${l2.w}x${l2.h}, under ${u2.y}`);

const t0 = await nodeOf("tight"), o0 = await under("tight");
await bigger("tight");
const t1 = await nodeOf("tight"), o1 = await under("tight");
/* Its line box at 1.5 times: 90 × 0.98 = 88; the letters' own overhang over a tight line is the page's, and not grown for. */
check("control: the tight heading grows no more than its row needs (line 88px)", t1.h <= Math.ceil(t0.font.px * 1.5 * 0.98) + 2, `h ${t0.h} → ${t1.h}; overhang before ${JSON.stringify(o0)}, after ${JSON.stringify(o1)}`);

/* The captured site, through the panel. */
const SINK = process.argv[3];
if (SINK && existsSync(join(SINK, "site/document.json"))) {
  const DOC = readFileSync(join(SINK, "site/document.json"));
  const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
  const REPO = "/repos/sparkygogo77-spec/sink";
  const tree = [{ path: "package.json", type: "blob", sha: "pkg", size: 10 }, { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length }, ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 }))];
  const ctx2 = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const p2 = await ctx2.newPage();
  p2.on("pageerror", (e) => errors.push(e.message));
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
  for (let i = 0; i < 180 && (await count()) < 50; i++) await p2.waitForTimeout(1000);
  await p2.waitForTimeout(10000);
  const of = async (id) => (await p2.evaluate(() => window.__studioHistory.doc().nodes)).find((n) => n.id === id);
  for (const id of (process.env.ROW_IDS ?? "n_prose_19,n_prose_145").split(",")) {
    if (!(await of(id))) { check(`${id} is on the board`, false); continue; }
    await p2.evaluate((id) => { const el = document.querySelector(`[data-node-id="${id}"]`); const pane = document.querySelector("[data-studio-pane]"); pane.scrollTop += el.getBoundingClientRect().top - pane.getBoundingClientRect().top - 200; }, id);
    await p2.evaluate((id) => { window.__studioHistory.act("setSelection", [id]); window.__studioHistory.act("want", { panel: "inspector", id }); }, id);
    await p2.waitForTimeout(800);
    const n0 = await of(id);
    const f = p2.locator("[data-side-panel]").first().getByLabel("Size in pixels", { exact: true }).first();
    const px = Number(await f.inputValue());
    await f.click({ clickCount: 3 }); await f.fill(String(Math.round(px * 1.5))); await f.press("Enter");
    await p2.waitForTimeout(2500);
    const n1 = await of(id);
    const r = await p2.evaluate((id) => {
      const el = document.querySelector(`[data-node-id="${id}"]`); const b = el.getBoundingClientRect(); const k = document.querySelector("[data-frame]").getBoundingClientRect().width / 1440;
      let top = Infinity, foot = -Infinity; const rows = [];
      const tw = document.createTreeWalker(el.querySelector("[data-part-drawn]") ?? el, NodeFilter.SHOW_TEXT);
      for (let t = tw.nextNode(); t; t = tw.nextNode()) { if (!t.textContent.trim()) continue; const g = document.createRange(); g.selectNodeContents(t); for (const q of g.getClientRects()) if (q.width) { top = Math.min(top, q.top); foot = Math.max(foot, q.bottom); if (!rows.some((y) => Math.abs(y - q.top) < q.height / 2)) rows.push(q.top); } }
      return { foot: Math.round((foot - b.bottom) / k), top: Math.round((b.top - top) / k), rows: rows.length };
    }, id);
    check(`${id} ${px}px → ${Math.round(px * 1.5)}px in the panel: one row, inside its box to 1px`, r.rows === 1 && r.foot <= 1 && r.top <= 1, `${JSON.stringify(r)}; ${n0.w}x${n0.h} → ${n1.w}x${n1.h}`);
    await p2.evaluate(() => document.activeElement?.blur?.());
    await p2.keyboard.press("Control+z"); await p2.waitForTimeout(900);
    const n2 = await of(id);
    check(`${id}: one Ctrl+Z puts its box back`, n2.w === n0.w && n2.h === n0.h, `${n2.w}x${n2.h}`);
  }
  await ctx2.close();
}

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
