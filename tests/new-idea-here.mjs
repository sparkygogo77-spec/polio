/**
 * A NEW IDEA LANDS WHERE YOU ARE LOOKING, AND A REFUSED SPACE SAYS SO WHOLE.
 *
 * On a long page, pressing New idea on the shelf made one more part (259 ->
 * 260 on a captured site) and nothing changed on screen: it went to the foot
 * of the page, screens away. Now it lands in the middle of what is visible,
 * picked, so its outline says where it went.
 *
 * And a line drawn with Draw a space that does not close says why beside the
 * pointer that let go, whole, never cut off at the window's right edge ("A
 * space is a closed line. Come back to st…").
 *
 *   npx next start -p 3013
 *   node tests/new-idea-here.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
mkdirSync(".screenshots", { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
/* A long page: forty rows of words, six thousand pixels of it. */
const rows = Array.from({ length: 40 }, (_, i) => node(`row${i}`, "value-prop", `Row ${i + 1}`, 120, 60 + i * 150, 600, 90));
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: rows, groups: [], shapes: [], format: {}, brief: { name: "LONG", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); localStorage.setItem("builder.shelf.folded", "0"); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="row0"]', { timeout: 20000 });
await page.waitForTimeout(1500);

const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const count = async () => ((await saved()).nodes ?? []).length;

/* Somewhere down the page, not at its top and not at its foot. */
await page.evaluate(() => { const p = document.querySelector("[data-studio-pane]"); p.scrollTop = Math.round(p.scrollHeight * 0.35); });
await page.waitForTimeout(400);
const n0 = await count();
await page.locator('[data-category="custom-idea"]').click();
await page.waitForTimeout(600);
const all = (await saved()).nodes ?? [];
check("New idea adds one part", all.length === n0 + 1, `${n0} -> ${all.length}`);
const made = all.find((n) => n.featureId === "custom-idea");
const seen = made ? await page.evaluate((id) => {
  const el = document.querySelector(`[data-node-id="${id}"]`);
  const pane = document.querySelector("[data-studio-pane]").getBoundingClientRect();
  const band = document.querySelector("[data-studio-band]")?.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const foot = band && band.top > pane.top ? band.top : pane.bottom;
  return { r: [r.left, r.top, r.right, r.bottom], pane: [pane.left, pane.top, pane.right, foot], picked: !!el.querySelector(":scope > [data-resize]") };
}, made.id) : null;
const inside = seen && seen.r[0] >= seen.pane[0] && seen.r[1] >= seen.pane[1] && seen.r[2] <= seen.pane[2] && seen.r[3] <= seen.pane[3];
check("…and it lands wholly inside the part of the canvas on screen", !!inside, JSON.stringify(seen));
const mid = seen ? [(seen.r[1] + seen.r[3]) / 2, (seen.pane[1] + seen.pane[3]) / 2] : [0, 999];
check("…centred on it, give or take", Math.abs(mid[0] - mid[1]) < 40, `${mid[0]} vs ${mid[1]}`);
check("…picked, so its outline shows", !!seen?.picked);
await page.screenshot({ path: ".screenshots/new-idea-here.png" });

/* The refusal beside the hand, whole, even near the right edge */
await page.mouse.click(1420, 880);
await page.keyboard.press("s");
await page.waitForTimeout(200);
const pane = await page.locator("[data-studio-pane]").boundingBox();
const y = pane.y + 200;
const x0 = pane.x + pane.width - 160;
await page.mouse.move(x0, y);
await page.mouse.down();
for (let i = 1; i <= 12; i++) await page.mouse.move(x0 + i * 10, y + i * 6);
await page.mouse.up();
await page.waitForTimeout(300);
const note = await page.locator("[data-space-refused]").first().boundingBox().catch(() => null);
const vw = 1440;
check("an open line with Draw a space says why", !!note);
check("…whole, inside the window", !!note && note.x >= 0 && note.x + note.width <= vw && note.y >= 0 && note.y + note.height <= 900, JSON.stringify(note));
const hand = { x: x0 + 120, y: y + 72 };
check("…beside the pointer that let go", !!note && Math.min(Math.abs(note.x - hand.x), Math.abs(note.x + note.width - hand.x)) < 40 && Math.min(Math.abs(note.y - hand.y), Math.abs(note.y + note.height - hand.y)) < 40, JSON.stringify({ note, hand }));
check("…and reads in full", (await page.locator("[data-space-refused]").first().innerText()) === "A space is a closed line. Come back to where you started.");
await page.screenshot({ path: ".screenshots/space-refused-beside-pointer.png" });
await page.keyboard.press("Escape");

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
