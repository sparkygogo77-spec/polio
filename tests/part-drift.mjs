/**
 * A part wearing a drifting texture drifts.
 *
 * A part can wear one of the page's texture layers. Its paint names an
 * animation, `tex-drift-<hash of that one layer>`, and the only keyframes
 * on the page were the site stack's, hashed over every layer that is on.
 * The two agreed only when the stack was exactly that one layer; with two
 * layers on the page, a part's drift was a name with nothing behind it,
 * and the part stood still while the page moved. Each worn layer writes
 * its own keyframes beside the part now.
 *
 *   node tests/part-drift.mjs [url]
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
/* Two layers on the page, one drifting; the part wears the drifting one. */
const layer = (id, drift) => ({ id, kind: "dots", role: "accent", scale: 48, angle: 0, opacity: 0.2, contrast: 0.3, blend: "overlay", hue: 0, target: "page", on: true, drift });
await seed(page, (pageId) => ({
  nodes: [{ id: "n1", pageId, featureId: "card-grid", label: "Cards", prompt: "", content: "", x: 0, y: 0, w: 1440, h: 420, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, data: "", colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "out", shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: "tx_move", sketch: null, plan: null }],
}));
await page.evaluate((layers) => {
  const doc = JSON.parse(localStorage.getItem("builder.studio"));
  doc.state.look = { ...(doc.state.look ?? {}), texture: layers };
  localStorage.setItem("builder.studio", JSON.stringify(doc));
}, [layer("tx_move", 0.5), layer("tx_still", 0)]);
await page.goto(`${URL_}/builder/preview`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

const found = await page.evaluate(() => {
  const root = document.querySelector('[data-live-node="n1"]');
  if (!root) return { root: false };
  const els = [root, ...root.querySelectorAll("*")];
  const wearing = els.map((e) => getComputedStyle(e).animationName).find((n) => n && n.startsWith("tex-drift-")) ?? null;
  const names = new Set();
  for (const ss of document.styleSheets) { try { for (const r of ss.cssRules) if (r instanceof CSSKeyframesRule) names.add(r.name); } catch {} }
  return { root: true, wearing, defined: wearing ? names.has(wearing) : false, keyframes: [...names].filter((n) => n.startsWith("tex-drift-")) };
});
check("the part is on the live page", found.root);
check("and wears a drift animation of its own", !!found.wearing, String(found.wearing));
check("whose keyframes exist on the page", found.defined, `${found.wearing} among ${found.keyframes.join(", ") || "none"}`);
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
