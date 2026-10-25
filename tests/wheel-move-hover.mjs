/**
 * MOVE UP, MOVE DOWN AND HOVER ARE ON THE WHEEL.
 *
 * DESIGN.md: "the wheel is the whole editor; the panel is the convenience".
 * Move up / Move down (`board/tradePlaces.ts`) and a part's Hover
 * (`hoverLook.ts`) were in the side panel only, Move also as Alt+↑/↓. J
 * approved them for the wheel on 2026-10-24: they hang in its tray.
 *
 *   1. a section's tray has Move up and Move down; Move up trades it with the
 *      one above, its heading with it, in one step of undo;
 *   2. the first section's Move up is shut, its Move down open;
 *   3. a button with a hover says what its hover does in the tray, and the
 *      item opens its Hover editor; a part with none has no Hover item.
 *
 *   node tests/wheel-move-hover.mjs http://127.0.0.1:3061
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
const from = (selector) => ({ from: { url: "https://x.test/", host: "x.test", selector, at: 1 } });
const S = (i) => `body > main > section:nth-of-type(${i})`;
const hover = [{ self: true, selector: ".btn:hover", style: { "background-color": "rgb(20, 20, 150)", transform: "translateY(-2px)" } }];
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("main", "box", "", 0, 0, 1440, 1340, { colour: { bg: "rgb(20, 20, 30)" }, ...from("body > main") }),
    node("s1", "box", "", 0, 0, 1440, 400, { colour: { bg: "rgb(200, 60, 60)" }, ...from(S(1)) }),
    node("h1", "value-prop", "FIRST", 100, 100, 400, 60, { ...from(`${S(1)} > h2`) }),
    node("s2", "box", "", 0, 420, 1440, 300, { colour: { bg: "rgb(60, 200, 60)" }, ...from(S(2)) }),
    node("h2", "value-prop", "SECOND", 100, 480, 400, 60, { ...from(`${S(2)} > h2`) }),
    node("b2", "cta-primary", "Buy now", 100, 600, 220, 56, { colour: { bg: "rgb(30, 30, 200)", text: "#ffffff" }, motion: { hover, transition: [{ property: "all", duration: "0s" }] }, ...from(`${S(2)} > a.btn`) }),
    node("s3", "box", "", 0, 740, 1440, 600, { colour: { bg: "rgb(60, 60, 200)" }, ...from(S(3)) }),
    node("h3", "value-prop", "THIRD", 100, 800, 400, 60, { ...from(`${S(3)} > h2`) }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "WHEEL", gimmick: "", master: "" },
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
await page.waitForSelector('[data-node-id="s3"]', { timeout: 20000 });
await page.waitForTimeout(2000);
const ys = async () => Object.fromEntries((await page.evaluate(() => window.__studioHistory?.doc().nodes ?? [])).map((n) => [n.id, n.y]));

const close = async () => { for (let i = 0; i < 4 && (await page.locator("[data-radial]").count()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(250); } };
/** The wheel on a part, pressed at a spot of it (fractions of its box), and its tray opened. */
const trayOn = async (id, fx = 0.5, fy = 0.5) => {
  await close();
  const b = await page.locator(`[data-node-id="${id}"]`).first().boundingBox();
  const x = b.x + b.width * fx, y = Math.max(70, Math.min(880, b.y + b.height * fy));
  await page.mouse.click(x, y, { button: "right" });
  await page.waitForTimeout(700);
  const tray = page.locator('[data-tray="part"]').first();
  if (!(await tray.count())) return null;
  await tray.hover();
  await page.waitForTimeout(400);
  return page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-tray="part"] [data-tray-item]')].map((b) => [b.dataset.trayItem, { disabled: b.disabled || b.getAttribute("aria-disabled") === "true", label: b.getAttribute("aria-label") || b.textContent.trim() }])));
};
const press = async (item) => { await page.locator(`[data-tray="part"] [data-tray-item="${item}"]`).first().click(); await page.waitForTimeout(600); };

const y0 = await ys();
/* The second section, pressed on its own ground (right of its heading and button). */
const t2 = await trayOn("s2", 0.8, 0.5);
check("the second section's wheel has a tray", !!t2, JSON.stringify(t2 && Object.keys(t2)));
check("its tray has Move up and Move down, both open", !!t2?.["move-up"] && !!t2?.["move-down"] && !t2["move-up"].disabled && !t2["move-down"].disabled, JSON.stringify({ up: t2?.["move-up"], down: t2?.["move-down"] }));
if (t2?.["move-up"]) await press("move-up");
const y1 = await ys();
check("Move up puts the second section first, at the first's top", y1.s2 === 0, JSON.stringify(y1));
check("…its heading and button with it", y1.h2 - y1.s2 === y0.h2 - y0.s2 && y1.b2 - y1.s2 === y0.b2 - y0.s2, `${y1.h2}, ${y1.b2}`);
check("…and the first follows it at the gap they had, the third unmoved", y1.s1 === 320 && y1.h1 === 420 && y1.s3 === y0.s3, `${y1.s1}, ${y1.h1}, ${y1.s3}`);
await close();
await page.evaluate(() => document.activeElement?.blur?.());
await page.keyboard.press("Control+z"); await page.waitForTimeout(600);
check("one Ctrl+Z puts all of it back", JSON.stringify(await ys()) === JSON.stringify(y0), JSON.stringify(await ys()));

const t1 = await trayOn("s1", 0.8, 0.5);
check("the first section's Move up is shut and its Move down open", t1?.["move-up"]?.disabled === true && t1?.["move-down"]?.disabled === false, JSON.stringify({ up: t1?.["move-up"], down: t1?.["move-down"] }));
if (t1?.["move-down"]) await press("move-down");
const y2 = await ys();
check("Move down on the first puts it below the second", y2.s2 === 0 && y2.s1 === 320, JSON.stringify(y2));
await close();
await page.keyboard.press("Control+z"); await page.waitForTimeout(600);

const tb = await trayOn("b2");
check("a button with a hover has a Hover item that says what it does", /^Hover: .*fill.*lifts 2px/.test(tb?.hover?.label ?? ""), tb?.hover?.label ?? JSON.stringify(tb && Object.keys(tb)));
if (tb?.hover) await press("hover");
await page.waitForTimeout(600);
const editor = await page.evaluate(() => { const f = document.querySelector('[data-part-panel="b2"] [data-hover-field]'); if (!f) return null; const r = f.getBoundingClientRect(); return { inView: r.top < innerHeight && r.bottom > 0 }; });
check("…and opens its Hover editor in the side panel, in view", !!editor?.inView, JSON.stringify(editor));
const th = await trayOn("h3");
check("a part with no hover of its own has no Hover item", !!th && !th.hover, JSON.stringify(th && Object.keys(th)));
await close();

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
