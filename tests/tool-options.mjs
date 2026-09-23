/**
 * The tool options bar: each tool's own settings, in the header, where the
 * drawing colours already are.
 *
 * HIS WORDS. "Make a checkbox option for that, the checkbox should be in the
 * header where colors are chosen when drawing, where we will prepare to
 * associate different settings with each tool selected." So the bar is the
 * piece, and "Scale contents with group" is its first tenant: a select-tool
 * setting, on by default, per browser like the drawing colour and never in
 * the board.
 *
 * Every step asserts the interaction happened before it asserts the result:
 * the tool is read back off the picker's own label after each switch, and
 * the checkbox's state is read back after each press.
 *
 *   npx next start -p 3013
 *   node tests/tool-options.mjs http://127.0.0.1:3013
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

const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [{
    id: "a", pageId: "p0", featureId: "value-prop", label: "a", prompt: "", content: "Hello", data: "", x: 80, y: 80, w: 300, h: 60, groupId: null, options: {},
    priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
    anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  }],
  groups: [], shapes: [], format: {}, brief: { name: "BAR", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], tool: "select",
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const tool = () => page.evaluate(() => document.querySelector("[data-tool-picker]")?.getAttribute("aria-label") ?? "");
const bar = () => page.evaluate(() => {
  const b = document.querySelector("[data-tool-options]");
  const box = b?.querySelector('[data-tool-option="group-scale"] input[type="checkbox"]');
  const vis = (el) => !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== "hidden";
  return {
    bar: vis(b),
    scale: vis(box) ? box.checked : null,
    ink: vis(b?.querySelector("[data-draw-row]")),
  };
});
// The board as it is saved: parts and groups, the thing a preference must never change.
const board = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("builder.studio") ?? "{}").state ?? {}; return JSON.stringify({ nodes: s.nodes, groups: s.groups }); });
const setting = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.settings") ?? "{}").state?.values?.["studio.groupScaleContents"]);

check("the select tool is the tool", /Select/.test(await tool()), await tool());
let b = await bar();
check("the options bar is in the header", b.bar);
check("…carrying 'Scale contents with group', on by default", b.scale === true, String(b.scale));
check("…and not the drawing colours, which belong to the pen", b.ink === false, String(b.ink));

const before = await board();
await page.locator('[data-tool-option="group-scale"] input[type="checkbox"]').click();
await page.waitForTimeout(500);
b = await bar();
check("pressing it turns it off", b.scale === false, String(b.scale));
check("…and the setting is saved per browser", (await setting()) === false, String(await setting()));
check("…and the board is not touched", (await board()) === before);

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1800);
check("after a reload it is still off", (await bar()).scale === false, String((await bar()).scale));

await page.mouse.click(1500, 950);
await page.keyboard.press("d");
await page.waitForTimeout(500);
check("pressing d switches to the pen", /Draw/.test(await tool()), await tool());
b = await bar();
check("…and the bar shows the pen's settings, the drawing colours", b.bar && b.ink === true, JSON.stringify(b));
check("…and not the select tool's checkbox", b.scale === null, String(b.scale));

await page.keyboard.press("v");
await page.waitForTimeout(500);
check("pressing v switches back to select", /Select/.test(await tool()), await tool());
check("…and the checkbox is back, as he left it", (await bar()).scale === false, String((await bar()).scale));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
