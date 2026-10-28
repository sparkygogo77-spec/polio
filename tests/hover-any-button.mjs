/**
 * ANY BUTTON OR LINK HAS A HOVER SECTION, NOT ONLY ONE THE PAGE GAVE A HOVER.
 *
 * The Hover section (J, 2026-10-23) showed only for a part with a hover of
 * its own, so a button made in the Builder, or a captured one whose page
 * never styled its hover (sol face's "View victory artwork", PST's "Find a
 * match"), had no way to be given one (the hand-edit audit, 2026-10-25). Now
 * every button or link shows Hover, reading "none" until a fill or a lift is
 * set; words and pictures still have none.
 *
 * Held here, on a plain button and a heading:
 *   · the button's panel shows Hover with fill "none" and lift "none";
 *   · a fill picked there is written as the button's own hover rule, set by hand;
 *   · the board's hover draws it, and one Ctrl+Z takes it away;
 *   · the heading has no Hover section.
 *
 *   npx next start -p 3013
 *   node tests/hover-any-button.mjs http://127.0.0.1:3013
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
const seed = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("b1", "cta-primary", "Buy now", 200, 200, 220, 56, { colour: { bg: "rgb(30, 30, 200)", text: "#ffffff" } }),
    node("t1", "value-prop", "No hover here", 200, 400, 500, 60),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "HOVER", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, seed);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="b1"]', { timeout: 20000 });
await page.waitForTimeout(1500);

const motion = (id) => page.evaluate((id) => window.__studioHistory.doc().nodes.find((n) => n.id === id)?.motion ?? null, id);
const pick = async (id) => { await page.evaluate((id) => { window.__studioHistory.act("clearSelection"); window.__studioHistory.act("setSelection", [id]); window.__studioHistory.act("want", { panel: "inspector", id }); }, id); await page.waitForTimeout(600); };
const setInput = async (sel, value) => { await page.evaluate(([sel, value]) => { const el = document.querySelector(sel); const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(value)); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, [sel, value]); };

await pick("b1");
const shown = await page.evaluate(() => ({ field: !!document.querySelector("[data-hover-field]"), fill: document.querySelector("[data-hover-row='fill'] .num")?.textContent, lift: document.querySelector("[data-hover-lift-says]")?.textContent }));
check("a plain button's panel shows Hover", shown.field, JSON.stringify(shown));
check("…reading fill none and lift none", shown.fill === "none" && shown.lift === "none", JSON.stringify(shown));

if (shown.field) {
  await setInput('[data-hover-colour="fill"]', "#ff0000"); await page.waitForTimeout(500);
  const m1 = await motion("b1");
  check("a fill picked there is written as the button's own hover rule, set by hand", m1?.hover?.length === 1 && m1.hover[0].self === true && m1.hover[0].style?.["background-color"] === "#ff0000" && m1.hover[0].hand === true, JSON.stringify(m1));
  /* The board's hover draws it. */
  await page.mouse.move(5, 5); await page.waitForTimeout(200);
  const bb = await page.locator('[data-node-id="b1"]').boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(600);
  const onBoard = await page.evaluate(() => { const el = document.querySelector(".mo-b1"); return el ? getComputedStyle(el).backgroundColor : null; });
  check("the board's hover draws the new fill", onBoard === "rgb(255, 0, 0)", JSON.stringify(onBoard));
  await page.mouse.move(5, 5); await page.waitForTimeout(200);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press("Control+z"); await page.waitForTimeout(500);
  const m2 = await motion("b1");
  check("one Ctrl+Z takes the hover away", !(m2?.hover ?? []).some((r) => r.style?.["background-color"]), JSON.stringify(m2));
}

await pick("t1");
check("a heading has no Hover section", !(await page.$("[data-hover-field]")));

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
