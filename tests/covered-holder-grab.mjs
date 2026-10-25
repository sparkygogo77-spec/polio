/**
 * A PICKED HOLDER ITS PARTS COVER WHOLE IS GRABBED ANYWHERE ON IT.
 *
 * EDIT-ISSUES #17 (the hand-edit pass, 2026-10-22): sol face's header button
 * group is all buttons. Every press on it picked a button, so once the group
 * was picked (Escape from a button, or the list) it could be dragged only by
 * its edge, where its resize bars are.
 *
 *   1. the group picked, a drag that starts on one of its buttons moves the
 *      group, both buttons with it, and keeps the group picked;
 *   2. the group picked, two presses on a button pick the button (going in);
 *   3. control: nothing picked, a drag on a button moves that button alone;
 *   4. control: a picked section its heading does not cover: a press on the
 *      heading picks the heading, as before.
 *
 *   node tests/covered-holder-grab.mjs http://127.0.0.1:3061
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
const G = "body > header > div.actions";
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("main", "box", "", 0, 0, 1440, 1000, { colour: { bg: "rgb(20, 20, 30)" }, ...from("body > main") }),
    node("grp", "box", "", 900, 200, 300, 50, { colour: { bg: "rgb(90, 90, 90)" }, ...from(G) }),
    node("b1", "cta-primary", "Join", 900, 200, 150, 50, { colour: { bg: "rgb(30, 160, 60)", text: "#ffffff" }, ...from(`${G} > a:nth-of-type(1)`) }),
    node("b2", "cta-primary", "Buy", 1050, 200, 150, 50, { colour: { bg: "rgb(30, 60, 200)", text: "#ffffff" }, ...from(`${G} > a:nth-of-type(2)`) }),
    node("sec", "box", "", 0, 400, 1440, 400, { colour: { bg: "rgb(60, 20, 20)" }, ...from("body > main > section") }),
    node("head", "value-prop", "A heading", 100, 450, 400, 60, { ...from("body > main > section > h2") }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "GRAB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="b2"]', { timeout: 20000 });
await page.waitForTimeout(2000);
const st = () => page.evaluate(() => { const d = window.__studioHistory.doc(); return { ys: Object.fromEntries(d.nodes.map((n) => [n.id, n.y])), sel: [...document.querySelectorAll("[data-picked]")].map((e) => e.getAttribute("data-node-id")) }; });
const pick = async (id) => { await page.evaluate((id) => window.__studioHistory.act("setSelection", [id]), id); await page.waitForTimeout(300); };
const mid = async (id) => { const b = await page.locator(`[data-node-id="${id}"]`).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const drag = async (id, dy) => { const m = await mid(id); await page.mouse.move(m.x, m.y); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(m.x, m.y + (dy * i) / 8); await page.mouse.up(); await page.waitForTimeout(600); };
const undo = async () => { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press("Control+z"); await page.waitForTimeout(500); };
const k = await page.evaluate(() => { const f = document.querySelector("[data-frame]"); return f.getBoundingClientRect().width / 1440; });

const s0 = await st();
await pick("grp");
await drag("b1", 100 * k);
const s1 = await st();
/* About 100px: the drag may snap a few px to a neighbour's edge. */
const dg = s1.ys.grp - s0.ys.grp;
check("the group picked, a drag that starts on its button moves the group", Math.abs(dg - 100) <= 8, `grp ${s0.ys.grp} → ${s1.ys.grp}`);
check("…both buttons with it, by the same", s1.ys.b1 - s0.ys.b1 === dg && s1.ys.b2 - s0.ys.b2 === dg, `b1 ${s1.ys.b1}, b2 ${s1.ys.b2}`);
check("…and the group stays picked", JSON.stringify(s1.sel) === '["grp"]', JSON.stringify(s1.sel));
await undo();
check("one Ctrl+Z puts them back", JSON.stringify((await st()).ys) === JSON.stringify(s0.ys));

await pick("grp");
const m2 = await mid("b2");
await page.mouse.click(m2.x, m2.y); await page.waitForTimeout(120); await page.mouse.click(m2.x, m2.y); await page.waitForTimeout(600);
const s2 = await st();
check("the group picked, two presses on a button pick the button", JSON.stringify(s2.sel) === '["b2"]', JSON.stringify(s2.sel));
await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.waitForTimeout(300);

await pick("main"); await page.keyboard.press("Escape"); await page.evaluate(() => window.__studioHistory.act("setSelection", [])); await page.waitForTimeout(300);
await drag("b1", 60 * k);
const s3 = await st();
check("control: nothing picked, a drag on a button moves the button alone", Math.abs(s3.ys.b1 - s0.ys.b1 - 60) <= 8 && s3.ys.grp === s0.ys.grp && s3.ys.b2 === s0.ys.b2, `b1 ${s3.ys.b1}, grp ${s3.ys.grp}, b2 ${s3.ys.b2}`);
await undo();

await pick("sec");
const mh = await mid("head");
await page.mouse.click(mh.x, mh.y); await page.waitForTimeout(600);
const s4 = await st();
check("control: a picked section its heading does not cover, a press on the heading picks the heading", JSON.stringify(s4.sel) === '["head"]', JSON.stringify(s4.sel));

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
