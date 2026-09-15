/**
 * Priority is set from the wheel, not only from the panel.
 *
 * The wheel is the whole editor and the panel is the convenience: anything
 * the Inspector can do to a part, the wheel does too. Priority was the
 * exception: a slab on the pencil's level said "Priority (soon)" and played
 * a tap, while the Inspector set it. The slab opens a plate of three keys
 * now, Must have, Nice, Idea, the same three the panel offers.
 *
 *   node tests/priority-wheel.mjs [url]
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
/** Source without its comments, so a pin never matches the sentence explaining a removal. */
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const wheel = bare("src/features/studio/RadialMenu.tsx");
check("nothing on the part's wheel says soon", !/\(soon\)/.test(wheel), wheel.match(/"[^"]*\(soon\)"/g)?.join(", ") ?? "");

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
const priority = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes[0].priority);
check("the part starts as a must-have", (await priority()) === "must");

await page.locator('[data-node-id="n1"]').click({ button: "right" });
await page.waitForTimeout(700);
await page.locator('[data-radial] [data-shard="write"]').click({ force: true });
await page.waitForTimeout(600);
const under = await page.locator("[data-radial] [data-shard]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")).filter(Boolean));
check("the pencil's level offers Priority, without a soon on it", under.includes("Priority"), under.join(" · "));
await page.locator('[data-radial] [data-shard="priority"]').click({ force: true });
await page.waitForTimeout(600);
const ticks = page.locator("[data-radial] [data-tick]");
const labels = await ticks.evaluateAll((els) => els.map((e) => e.textContent.trim()));
check("it opens three keys, the panel's three", labels.join("|") === "Must have|Nice|Idea", labels.join(" · "));
const on = await ticks.evaluateAll((els) => els.filter((e) => e.getAttribute("aria-pressed") === "true").map((e) => e.textContent.trim()));
check("with the part's own lit", on.join() === "Must have", on.join(", "));
if (await ticks.filter({ hasText: "Idea" }).count()) { await ticks.filter({ hasText: "Idea" }).click(); await page.waitForTimeout(500); }
check("pressing Idea writes it on the part", (await priority()) === "idea", await priority());
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
