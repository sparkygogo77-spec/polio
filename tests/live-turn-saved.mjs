/**
 * A cube turned on the full preview page stays turned.
 *
 * The board is a still frame by the parts' own rule, so the live page is
 * where a cube or a solid is actually turned, and where it is left belongs
 * on the node. The board's own Preview kept a cube's turn; the full
 * /builder/preview page passed no handler at all, so a turn made there
 * died with the page, and a solid's turn was kept nowhere.
 *
 *   node tests/live-turn-saved.mjs [url]
 */
import { readFileSync } from "node:fs";
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
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const node = (id, pageId, extra = {}) => ({ id, pageId, featureId: "cta", label: "Join", prompt: "", content: "", x: 200, y: 200, w: 320, h: 120, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, data: "", colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "out", shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null, ...extra });
const seed = async (page, make) => {
  await page.evaluate((mk) => {
    const doc = JSON.parse(localStorage.getItem("builder.studio") || "{}");
    const st = doc.state ?? {};
    const pageId = st.activePageId ?? st.pages?.[0]?.id ?? "page_home";
    const out = new Function("pageId", `return (${mk})(pageId)`)(pageId);
    Object.assign(st, out);
    st.selection = [];
    doc.state = st;
    localStorage.setItem("builder.studio", JSON.stringify(doc));
  }, make.toString());
};

check("a solid's turn is kept like a cube's", /e\.type === "mesh"/.test(bare("src/features/studio/live/LiveStage.tsx")) && /setMeshTurn/.test(bare("src/features/studio/live/LiveStage.tsx")));
check("and the full preview page keeps them too", /keepTurn/.test(bare("src/features/studio/live/PreviewPage.tsx")));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await seed(page, (pageId) => ({ nodes: [{ id: "c1", pageId, featureId: "cube-3d", label: "Cube", prompt: "", content: "", x: 200, y: 200, w: 420, h: 420, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, data: "", colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "out", shape: null, outline: null, kind: null, vector: null, role: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null,
  cube: { faces: ["front", "right", "back", "left", "top", "bottom"].map(() => ({ heading: "", body: "", colour: "" })), turn: { x: -18, y: -32 } } }] }));
await page.goto(`${URL_}/builder/preview`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const cube = page.locator("[data-live-node] [data-cube]").first();
check("the cube is on the live page", (await cube.count()) === 1);
const turnOf = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes[0].cube?.turn);
const before = await turnOf();
await cube.focus();
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(1600);
const after = await turnOf();
check("a quarter turn with the arrow key is written on the node", JSON.stringify(after) !== JSON.stringify(before), `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
