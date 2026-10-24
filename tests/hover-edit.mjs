/**
 * A PART'S HOVER IS EDITED IN THE SIDE PANEL: FILL AND LIFT.
 *
 * J (2026-10-23): a part with a captured or set hover (`motion.hover[n].style`)
 * gets a Hover section in its side panel, its colour and its lift edited in
 * place, one undo step per change, drawn on the board's hover and on the
 * published page (`hoverLook.ts`, `panels/inspector/hoverField.tsx`). Held here,
 * a captured button whose hover darkens its fill and lifts it 2px:
 *   · its panel shows Hover with the captured fill and "2 px up"; a part with no hover has none;
 *   · a new fill is written to the hover rule, marked as set by hand; one Ctrl+Z puts it back;
 *   · Lift 6 makes the hover's transform translateY(-6px); one Ctrl+Z puts it back;
 *   · the board's hover draws the new fill and lift; so does the published page.
 *
 *   npx next start -p 3013
 *   node tests/hover-edit.mjs http://127.0.0.1:3013
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

await pick("t1");
check("a part with no hover has no Hover section", !(await page.$('[data-part-panel="t1"] [data-hover-field]')));
await pick("b1");
const shown = await page.evaluate(() => ({ field: !!document.querySelector('[data-part-panel="b1"] [data-hover-field]'), fill: document.querySelector('[data-hover-colour="fill"]')?.value, lift: document.querySelector("[data-hover-lift-says]")?.textContent }));
check("the button's panel shows Hover with the captured fill and lift", shown.field && shown.fill === "#141496" && shown.lift === "2 px up", JSON.stringify(shown));

await setInput('[data-hover-colour="fill"]', "#ff0000"); await page.waitForTimeout(500);
const m1 = await motionOf("b1");
check("a new hover fill is written to the hover rule, set by hand", m1?.hover?.[0]?.style?.["background-color"] === "#ff0000" && m1.hover[0].hand === true, JSON.stringify(m1?.hover));
check("…and the part's own fill is untouched", (await page.evaluate(() => window.__studioHistory.doc().nodes.find((n) => n.id === "b1").colour.bg)) === "rgb(30, 30, 200)");
await undo();
const m2 = await motionOf("b1");
check("one Ctrl+Z puts the captured hover fill back", m2?.hover?.[0]?.style?.["background-color"] === "rgb(20, 20, 150)" && !m2.hover[0].hand, JSON.stringify(m2?.hover));

await pick("b1");
await setInput('[data-hover-colour="fill"]', "#ff0000"); await page.waitForTimeout(400);
await setInput("[data-hover-lift]", 6); await page.waitForTimeout(500);
const m3 = await motionOf("b1");
check("Lift 6 makes the hover lift 6px", m3?.hover?.[0]?.style?.transform === "translateY(-6px)", JSON.stringify(m3?.hover));
await undo();
const m4 = await motionOf("b1");
check("one Ctrl+Z puts the 2px lift back, the new fill kept", m4?.hover?.[0]?.style?.transform === "translateY(-2px)" && m4.hover[0].style["background-color"] === "#ff0000", JSON.stringify(m4?.hover));
await pick("b1");
await setInput("[data-hover-lift]", 6); await page.waitForTimeout(500);

/* The board's hover draws it. */
await page.evaluate(() => window.__studioHistory.act("setSelection", []));
await page.waitForTimeout(300);
const box = await page.$('[data-node-id="b1"]');
const bb = await box.boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(600);
const onBoard = await page.evaluate(() => { const el = document.querySelector(".mo-b1"); if (!el) return null; const s = getComputedStyle(el); return { bg: s.backgroundColor, t: s.transform }; });
check("the board's hover draws the new fill and lift", onBoard?.bg === "rgb(255, 0, 0)" && /, -6\)$/.test(onBoard?.t ?? ""), JSON.stringify(onBoard));
await page.mouse.move(5, 5);

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
check("the published page's hover draws the new fill and lift", onPage?.bg === "rgb(255, 0, 0)" && /, -6\)$/.test(onPage?.t ?? ""), JSON.stringify(onPage));
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`
${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
