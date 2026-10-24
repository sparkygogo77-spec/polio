/**
 * MOVE UP / MOVE DOWN IN THE SIDE PANEL TRADE A SECTION WITH ITS NEIGHBOUR.
 *
 * J (2026-10-23): the side panel gets Move up and Move down for a picked
 * section, the panel's door to Alt+↑ / Alt+↓ (`board/tradePlaces.ts`,
 * `panels/inspector/moveInFlow.tsx`). Held here, on a captured page of three
 * sections each holding a heading:
 *   · the panel of the second section shows both buttons; the first's Move up is shut;
 *   · Move up on the second puts it first, its heading with it; the first follows; the third stays;
 *   · one Ctrl+Z puts all of it back;
 *   · Move down on the first puts it below the second;
 *   · the published page shows the new order.
 *
 *   npx next start -p 3013
 *   node tests/move-buttons.mjs http://127.0.0.1:3013
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
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("main", "box", "", 0, 0, 1440, 1340, { colour: { bg: "rgb(20, 20, 30)" }, ...from("body > main") }),
    node("s1", "box", "", 0, 0, 1440, 400, { colour: { bg: "rgb(200, 60, 60)" }, ...from(S(1)) }),
    node("h1", "value-prop", "FIRST", 100, 100, 400, 60, { ...from(`${S(1)} > h2`) }),
    node("s2", "box", "", 0, 420, 1440, 300, { colour: { bg: "rgb(60, 200, 60)" }, ...from(S(2)) }),
    node("h2", "value-prop", "SECOND", 100, 480, 400, 60, { ...from(`${S(2)} > h2`) }),
    node("s3", "box", "", 0, 740, 1440, 600, { colour: { bg: "rgb(60, 60, 200)" }, ...from(S(3)) }),
    node("h3", "value-prop", "THIRD", 100, 800, 400, 60, { ...from(`${S(3)} > h2`) }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "ORDER", gimmick: "", master: "" },
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
const pick = async (id) => { await page.evaluate((id) => window.__studioHistory.act("setSelection", [id]), id); await page.waitForTimeout(200); await page.evaluate(() => document.activeElement?.blur?.()); };

const y0 = await ys();
const panelFor = async (id) => { await pick(id); await page.evaluate((id) => window.__studioHistory.act("want", { panel: "inspector", id }), id); await page.waitForSelector(`[data-part-panel="${id}"] [data-move-up]`, { timeout: 5000 }).catch(() => {}); };
await panelFor("s1");
const shut1 = await page.evaluate(() => ({ up: document.querySelector("[data-move-up]")?.disabled ?? null, down: document.querySelector("[data-move-down]")?.disabled ?? null }));
check("the first section's panel has Move up shut and Move down open", shut1.up === true && shut1.down === false, JSON.stringify(shut1));
await panelFor("s2");
const has = await page.evaluate(() => !!document.querySelector('[data-part-panel="s2"] [data-move-up]') && !!document.querySelector('[data-part-panel="s2"] [data-move-down]'));
check("the second section's panel shows Move up and Move down", has);
await page.click('[data-part-panel="s2"] [data-move-up]').catch(() => {}); await page.waitForTimeout(600);
const y1 = await ys();
check("Move up on the second section puts it first, at the first's top", y1.s2 === 0, JSON.stringify(y1));
check("…its heading with it", y1.h2 - y1.s2 === y0.h2 - y0.s2, `${y1.h2}`);
check("…the first follows it at the gap they had (20), its heading with it", y1.s1 === 320 && y1.h1 === 420, `${y1.s1}, ${y1.h1}`);
check("…and the third does not move", y1.s3 === y0.s3 && y1.h3 === y0.h3, `${y1.s3}, ${y1.h3}`);
await page.evaluate(() => document.activeElement?.blur?.());
await page.keyboard.press("Control+z"); await page.waitForTimeout(600);
const y2 = await ys();
check("one Ctrl+Z puts all of it back", JSON.stringify(y2) === JSON.stringify(y0), JSON.stringify(y2));
await panelFor("s1");
await page.click('[data-part-panel="s1"] [data-move-down]').catch(() => {}); await page.waitForTimeout(600);
const y3 = await ys();
check("Move down on the first puts it below the second", y3.s2 === 0 && y3.s1 === 320, JSON.stringify(y3));

/* The published page follows. */
const files = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path.replace(/^\/+/, ""), content: f.content, encoding: f.encoding })));
const byPath = new Map(files.map((f) => [f.path, f]));
const out = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await out.route("http://site.test/**", (r) => {
  const path = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/+/, "")) || "index.html";
  const f = byPath.get(path);
  if (!f) return r.fulfill({ status: 404, body: "" });
  return r.fulfill({ status: 200, contentType: path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html", body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
});
await out.goto("http://site.test/index.html", { waitUntil: "load" });
await out.waitForTimeout(1000);
const pub = await out.evaluate(() => Object.fromEntries(["s1", "s2", "s3", "h1", "h2"].map((id) => [id, Math.round(document.getElementById(id)?.getBoundingClientRect().top + scrollY)])));
check("the published page shows the new order: second above first, headings in their sections", pub.s2 < pub.s1 && pub.h2 < pub.s1 && pub.h1 > pub.s1 && pub.h1 < pub.s3, JSON.stringify(pub));
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
