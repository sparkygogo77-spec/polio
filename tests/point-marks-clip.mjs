/**
 * THE MARKS ON THE BOARD STAY ON THE BOARD.
 *
 * J (2026-10-06): picking a colour on the Look tab outlines its parts on the
 * board, and the outlines of parts lower down drew over the shelf under the
 * board. They were clipped to the column round the board, which holds the
 * step bar and the shelf too; they are clipped to the board's pane now.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/point-marks-clip.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/SiteColours.tsx
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const URL_ = process.argv[2] ?? "http://127.0.0.1:3013";
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const node = (id, x, y, w, h) => ({
  id, pageId: "page_home", featureId: "box", label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: { bg: "rgb(200, 120, 60)" }, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
const doc = JSON.stringify({ state: {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [node("top", 100, 100, 600, 200), node("low", 100, 700, 600, 1400)], groups: [], shapes: [], format: {}, brief: { name: "MARKS", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "page_home", trail: [], swept: 999,
}, version: 0 });

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); localStorage.setItem("builder.shelf.folded", "0"); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.evaluate(() => window.dispatchEvent(new CustomEvent("studio:point-at", { detail: ["top", "low"] })));
await page.waitForTimeout(600);
const s = await page.evaluate(() => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { y: Math.round(b.top), b: Math.round(b.bottom) }; };
  const mark = document.querySelector("[data-point-mark]");
  return { marks: document.querySelectorAll("[data-point-mark]").length, clip: r(mark?.parentElement), pane: r(document.querySelector("[data-studio-pane]")), band: r(document.querySelector("[data-studio-band]")) };
});
check("the parts are outlined on the board", s.marks === 2, JSON.stringify(s));
check("the outlines are clipped to the board's pane", !!s.clip && s.clip.y >= s.pane.y && s.clip.b <= s.pane.b, JSON.stringify(s));
check("and stop above the shelf", !!s.band && s.clip.b <= s.band.y, JSON.stringify(s));
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
