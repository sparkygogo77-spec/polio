/**
 * A PART'S HOVER COLOUR FOLLOWS ITS FILL.
 *
 * J (2026-10-23): when a part's fill changes, its hover colour follows, a
 * lighter or darker version of the new fill in the same relation the captured
 * hover had to the old one; a hover colour set by hand in the Hover section is
 * kept (`hoverLook.ts#hoverAfterFill`, `board/store/nodes.ts`). Held here, a
 * captured button (fill rgb(30, 30, 200), hover a darker rgb(20, 20, 150)):
 *   · a red fill gives a darker red hover: red, darker than the new fill by what the old hover was;
 *   · one Ctrl+Z puts fill and hover back together;
 *   · a hover colour set by hand stays when the fill changes again;
 *   · the published page's hover draws the followed colour.
 *
 *   npx next start -p 3013
 *   node tests/hover-follows-fill.mjs http://127.0.0.1:3013
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
const hover = [{ self: true, selector: ".btn:hover", style: { "background-color": "rgb(20, 20, 150)", transform: "translateY(-2px)" } }];
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("main", "box", "", 0, 0, 1440, 900, { colour: { bg: "rgb(240, 240, 240)" }, ...from("body > main") }),
    node("b1", "cta-primary", "Buy now", 200, 200, 220, 56, { colour: { bg: "rgb(30, 30, 200)", text: "#ffffff" }, motion: { hover, transition: [{ property: "all", duration: "0s" }] }, ...from("body > main > a.btn") }),
    node("t1", "value-prop", "No hover here", 200, 400, 500, 60, { ...from("body > main > h2") }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "HOVER", gimmick: "", master: "" },
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
await page.waitForSelector('[data-node-id="b1"]', { timeout: 20000 });
await page.waitForTimeout(2000);

const motionOf = async (id) => page.evaluate((id) => window.__studioHistory.doc().nodes.find((n) => n.id === id)?.motion ?? null, id);
const pick = async (id) => {
  await page.evaluate((id) => { window.__studioHistory.act("setSelection", [id]); window.__studioHistory.act("want", { panel: "inspector", id }); }, id);
  await page.waitForSelector(`[data-part-panel="${id}"]`, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
};
const setInput = async (sel, value) => page.evaluate(([sel, value]) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(value));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}, [sel, value]);
const undo = async () => { await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(200); await page.keyboard.press("Control+z"); await page.waitForTimeout(500); };

const nodeOf = async (id) => page.evaluate((id) => window.__studioHistory.doc().nodes.find((n) => n.id === id), id);
const fill = async (id, bg) => { await page.evaluate(([id, bg]) => { const n = window.__studioHistory.doc().nodes.find((x) => x.id === id); window.__studioHistory.act("updateNode", id, { colour: { ...(n.colour ?? {}), bg } }); }, [id, bg]); await page.waitForTimeout(400); };
const rgb = (s) => (/^#([0-9a-f]{6})/i.exec(s ?? "") ? [0, 2, 4].map((i) => parseInt(s.slice(1 + i, 3 + i), 16)) : null);
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

await fill("b1", "#cc2222");
const a = await nodeOf("b1");
const h = rgb(a.motion.hover[0].style["background-color"]);
check("a red fill gives a red hover", !!h && h[0] > 2 * h[1] && h[0] > 2 * h[2], a.motion.hover[0].style["background-color"]);
check("…darker than the new fill, as the captured hover was darker than the old", !!h && lum(h) < lum([0xcc, 0x22, 0x22]) && lum(h) > lum([0xcc, 0x22, 0x22]) * 0.4, JSON.stringify(h));
check("…the rest of the hover (its lift) kept", a.motion.hover[0].style.transform === "translateY(-2px)", JSON.stringify(a.motion.hover[0].style));
await undo();
const b = await nodeOf("b1");
check("one Ctrl+Z puts the fill and the hover back together", b.colour.bg === "rgb(30, 30, 200)" && b.motion.hover[0].style["background-color"] === "rgb(20, 20, 150)", JSON.stringify([b.colour.bg, b.motion.hover[0].style]));

await fill("b1", "#cc2222");
const followed = await page.evaluate(() => { const v = window.__studioHistory.doc().nodes.find((n) => n.id === "b1").motion.hover[0].style["background-color"]; const d = document.createElement("div"); d.style.color = v; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
await pick("b1");
await setInput('[data-hover-colour="fill"]', "#00ff00"); await page.waitForTimeout(400);
await fill("b1", "#2244ff");
const c = await nodeOf("b1");
check("a hover colour set by hand stays when the fill changes again", c.colour.bg === "#2244ff" && c.motion.hover[0].style["background-color"] === "#00ff00", JSON.stringify([c.colour.bg, c.motion.hover[0]]));
await undo(); await undo();
const d = await nodeOf("b1");
check("…two Ctrl+Z later the followed red hover is back", d.colour.bg === "#cc2222" && !d.motion.hover[0].hand, JSON.stringify([d.colour.bg, d.motion.hover[0]]));
await page.evaluate(() => window.__studioHistory.act("setSelection", []));

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
const target = await out.evaluate(() => { const el = document.querySelector(".mo-b1"); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
if (target) { await out.mouse.move(target.x, target.y); await out.waitForTimeout(600); }
const onPage = await out.evaluate(() => { const el = document.querySelector(".mo-b1"); if (!el) return null; const s = getComputedStyle(el); return { bg: s.backgroundColor, t: s.transform }; });
check("the published page's hover draws the followed colour", onPage?.bg === followed && followed !== "rgb(20, 20, 150)", JSON.stringify(onPage) + " vs " + followed);
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`
${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
