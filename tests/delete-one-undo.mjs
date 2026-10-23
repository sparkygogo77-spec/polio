/**
 * ONE UNDO BRINGS BACK WHAT DELETE TOOK.
 *
 * Found in the hand-edit pass on fresh imports (sol face, mochi): a part
 * picked and deleted with Backspace stayed gone after Ctrl+Z, and came back
 * only on the second. Delete took two steps of undo: it removed the parts
 * (one checkpoint) and then the drawings among the picked ids (a second
 * checkpoint, though there were none), so the first undo put back a board
 * that was already without the part.
 *
 * Held here, for any part and for a drawing:
 *   · Backspace deletes the picked part;
 *   · one Ctrl+Z brings it back, where it was;
 *   · an action that changes nothing (removing a drawing that is not
 *     there) takes no step of undo, so it never swallows the next undo.
 *
 * The document is made here: a heading and a picture.
 *
 *   npx next start -p 3013
 *   node tests/delete-one-undo.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
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
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("title", "value-prop", "DELETE ME", 200, 200, 420, 80),
    node("card", "box", "", 200, 400, 320, 200, { colour: { bg: "#2f7de1" } }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "UNDO", gimmick: "", master: "" },
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
await page.waitForSelector('[data-node-id="title"]', { timeout: 20000 });
await page.waitForTimeout(1500);

const nodes = async () => (await page.evaluate(() => window.__studioHistory?.doc().nodes ?? [])) ?? [];
const nodeOf = async (id) => (await nodes()).find((n) => n.id === id);
const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(350); };
const centre = async (id) => { const b = await page.locator(`[data-node-id="${id}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

for (const id of ["title", "card"]) {
  const before = await nodeOf(id);
  const c = await centre(id);
  await page.mouse.click(1420, 880);
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(300);
  await press("Backspace");
  check(`Backspace deletes the picked ${id}`, !(await nodeOf(id)));
  await press("Control+z");
  const back = await nodeOf(id);
  check(`…and ONE Ctrl+Z brings the ${id} back, where it was`, !!back && back.x === before.x && back.y === before.y && back.w === before.w && back.h === before.h, back ? `${back.x},${back.y},${back.w},${back.h}` : "still gone");
  if (!back) await press("Control+z");
}

/* A store action that removes nothing takes no step of undo. */
await page.mouse.click(1420, 880);
const cc = await centre("card");
await page.mouse.click(cc.x, cc.y);
await page.waitForTimeout(300);
await press("Backspace");
await page.evaluate(() => { const h = window.__studioHistory; h.act("removeShapes", ["no-such-drawing"]); h.act("removeNodes", ["no-such-part"]); });
await page.waitForTimeout(300);
await press("Control+z");
check("removing a drawing or a part that is not there takes no step: the next undo still brings the card back", !!(await nodeOf("card")), "the undo went to an empty step");

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
