/**
 * A part answers a right press with the wheel, and nothing else is waiting
 * behind it.
 *
 * Twelve entries were registered as the part's right-click list: Priority,
 * Options, Links to, Open in live preview, In the frame, Align, Group,
 * Lock, Turn into idea, Delete and two more. Nobody could open it: the
 * part's own handler opens the wheel on the press and stops the contextmenu
 * event before the window listener that draws lists ever sees it. A
 * hundred lines of menu that no press reaches is not a menu; it is gone.
 *
 *   node tests/part-menu.mjs [url]
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
/** Source without its comments, so a pin never matches the sentence explaining a removal. */
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const index = bare("src/features/studio/index.ts");
check("no right-click list is registered for a part", !/scope:\s*"studio-node"/.test(index), `${(index.match(/studio-node/g) ?? []).length} mentions`);
check("and the part no longer wears the scope for one", !/ctxProps\("studio-node"/.test(["Canvas.tsx", ...readdirSync("src/features/studio/board").filter((f) => /\.tsx?$/.test(f)).map((f) => `board/${f}`)].map((f) => bare(`src/features/studio/${f}`)).join("\n")));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
const node = (id, pageId) => ({ id, pageId, featureId: "cta", label: "Join", prompt: "", content: "", x: 200, y: 200, w: 320, h: 120, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, data: "", colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "out", shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null });
const seedOnePart = async (page) => {
  await page.evaluate((mk) => {
    const doc = JSON.parse(localStorage.getItem("builder.studio") || "{}");
    const st = doc.state ?? {};
    const pageId = st.activePageId ?? st.pages?.[0]?.id ?? "page_home";
    st.nodes = [new Function("id", "pageId", `return (${mk})(id, pageId)`)("n1", pageId)];
    st.selection = [];
    doc.state = st;
    localStorage.setItem("builder.studio", JSON.stringify(doc));
  }, node.toString());
};
await seedOnePart(page);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const part = page.locator('[data-node-id="n1"]');
check("the part is on the board", (await part.count()) === 1);
await part.click({ button: "right" });
await page.waitForTimeout(700);
check("a right press on it opens the wheel", (await page.locator("[data-radial]").count()) === 1);
check("and no list beside it", (await page.locator('[role="menu"]').count()) === 0, `${await page.locator('[role="menu"]').count()} menus`);
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
