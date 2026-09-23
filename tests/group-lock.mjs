/**
 * A locked group is one thing: picked as one, framed as one, sized as one,
 * and its arrangement goes with it.
 *
 * HIS WORDS. "I should also be able to lock and group orientations and
 * relative spaces and sizes with a sizable select button." And: "Icon and
 * text should grow with it, unless that is a redundant setting. Make a
 * checkbox option for that."
 *
 * THE RULINGS. Scale-contents on (the default): positions, spacing, sizes
 * and the words all scale. Off: positions and spacing scale, and each part
 * keeps its own size and its words theirs. Text keeps the 0.6–2× clamp the
 * renderer already has, and says so when it stops. A group that is not
 * locked behaves exactly as before.
 *
 * Every step asserts the interaction happened: that the press picked the
 * whole group, that the group's frame and handle are there, and that the
 * frame's size changed, before any proportion is read. Proportions are read
 * off the saved board, which is what he keeps.
 *
 *   npx next start -p 3013
 *   node tests/group-lock.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});

/* g1, locked: an icon and a line of words under it. Bounds 200,200 200×100. */
/* g2, not locked: the control. */
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("ic", "box", "", 200, 200, 40, 40, { groupId: "g1", colour: { bg: "rgb(0, 255, 0)" } }),
    node("tx", "value-prop", "Words", 200, 260, 200, 40, { groupId: "g1", font: { size: 1 } }),
    node("u1", "value-prop", "U1", 700, 200, 160, 50, { groupId: "g2" }),
    node("u2", "value-prop", "U2", 700, 280, 160, 50, { groupId: "g2" }),
  ],
  groups: [
    { id: "g1", pageId: "p0", label: "Held", prompt: "", hue: 140, locked: true },
    { id: "g2", pageId: "p0", label: "Loose", prompt: "", hue: 40 },
  ],
  shapes: [], format: {}, brief: { name: "GROUPS", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });

const saved = (page) => page.evaluate(() => Object.fromEntries((JSON.parse(localStorage.getItem("builder.studio") ?? "{}").state?.nodes ?? []).map((n) => [n.id, { x: n.x, y: n.y, w: n.w, h: n.h, size: n.font?.size ?? null }])));
const picked = (page) => page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((n) => n.querySelector('[data-mode="live"]')).map((n) => n.getAttribute("data-node-id")).sort());
const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

const open = async () => {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
  const page = await context.newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  return page;
};
const press = async (page, id) => {
  const r = await page.locator(`[data-node-id="${id}"]`).boundingBox();
  await page.mouse.click(r.x + 6, r.y + r.height - 6);
  await page.waitForTimeout(500);
};
/* Drag the group's handle by dx, dy in board pixels, having found it on screen. */
const pull = async (page, handle, dx, dy) => {
  const h = page.locator(`[data-group-resize="${handle}"]`);
  if (!(await h.count())) return false;
  // Board → screen from a part this test never resizes (u1, 160 wide): the
  // locked group's own members change size, and measuring against them made
  // a second pull travel twice as far as it said.
  const k = (await page.locator('[data-node-id="u1"]').boundingBox()).width / 160 || 1;
  const r = await h.boundingBox();
  const from = [r.x + r.width / 2, r.y + r.height / 2];
  await page.mouse.move(...from);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(from[0] + (dx * k * i) / 10, from[1] + (dy * k * i) / 10);
  await page.mouse.up();
  await page.waitForTimeout(800);
  return true;
};
const frame = (page) => page.evaluate(() => { const f = document.querySelector('[data-group-frame="g1"]'); const r = f?.getBoundingClientRect(); return r ? [r.width, r.height] : null; });

/* ---- scale contents on (the default) ---- */
let page = await open();
await press(page, "tx");
check("pressing one member picks the whole locked group", JSON.stringify(await picked(page)) === JSON.stringify(["ic", "tx"]), (await picked(page)).join(", "));
const f0 = await frame(page);
check("the locked group draws one frame round itself", !!f0, JSON.stringify(f0));
check("…with a handle on it", (await page.locator('[data-group-resize="se"]').count()) === 1);
check("…and its members show no handles of their own", (await page.locator('[data-node-id="ic"] [data-resize], [data-node-id="tx"] [data-resize]').count()) === 0);
const pulled = await pull(page, "se", 200, 100);
const f1 = await frame(page);
check("pulling the corner resized the frame", pulled && !!f0 && !!f1 && f1[0] > f0[0] * 1.8, `${JSON.stringify(f0)} → ${JSON.stringify(f1)}`);
let s = await saved(page);
check("the icon doubled, from the group's corner", near(s.ic?.x, 200) && near(s.ic?.y, 200) && near(s.ic?.w, 80) && near(s.ic?.h, 80), JSON.stringify(s.ic));
check("the words' box doubled and kept its place in the arrangement", near(s.tx?.x, 200) && near(s.tx?.y, 320) && near(s.tx?.w, 400) && near(s.tx?.h, 80), JSON.stringify(s.tx));
check("the words grew with it: 2× the site's size", near(s.tx?.size, 2, 0.05), String(s.tx?.size));
check("nothing says the text has stopped, because it has not", (await page.locator("[data-group-ceiling]").count()) === 0);
await pull(page, "se", 200, 100);
s = await saved(page);
check("pulled again, the boxes keep scaling", near(s.tx?.w, 600, 3), JSON.stringify(s.tx));
check("…the words stop at the renderer's 2×", near(s.tx?.size, 2, 0.01), String(s.tx?.size));
const ceiling = await page.evaluate(() => document.querySelector("[data-group-ceiling]")?.textContent ?? null);
check("…and the frame says so", !!ceiling && /largest|2×/.test(ceiling), String(ceiling));

/* The unlocked group is untouched: each member keeps its own handles, and there is no group frame. */
await press(page, "u1");
check("pressing a member of an unlocked group still picks the group", JSON.stringify(await picked(page)) === JSON.stringify(["u1", "u2"]), (await picked(page)).join(", "));
check("…with each member's own handles, as before", (await page.locator('[data-node-id="u1"] [data-resize]').count()) > 0);
check("…and no group frame", (await page.locator('[data-group-frame="g2"]').count()) === 0);
await page.context().close();

/* ---- scale contents off ---- */
page = await open();
await page.locator('[data-tool-option="group-scale"] input[type="checkbox"]').click();
await page.waitForTimeout(300);
check("the checkbox is off", (await page.locator('[data-tool-option="group-scale"] input[type="checkbox"]').isChecked()) === false);
await press(page, "tx");
check("the locked group is picked", JSON.stringify(await picked(page)) === JSON.stringify(["ic", "tx"]), (await picked(page)).join(", "));
const g0 = await frame(page);
await pull(page, "se", 200, 100);
const g1 = await frame(page);
// The frame is drawn round the members, which keep their sizes here, so it
// grows by the spread of the arrangement rather than by the whole pull.
check("pulling the corner resized the frame", !!g0 && !!g1 && (g1[0] > g0[0] * 1.2 || g1[1] > g0[1] * 1.2), `${JSON.stringify(g0)} → ${JSON.stringify(g1)}`);
s = await saved(page);
check("the icon keeps its own size", near(s.ic?.w, 40) && near(s.ic?.h, 40), JSON.stringify(s.ic));
check("the words keep their size and their box", near(s.tx?.w, 200) && near(s.tx?.h, 40) && near(s.tx?.size, 1, 0.01), JSON.stringify(s.tx));
check("…and the spacing scaled: the words moved down, away from the icon", s.tx && s.ic && s.tx.y - s.ic.y > 60 + 20, `${s.ic?.y} → ${s.tx?.y}`);
await page.context().close();

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
