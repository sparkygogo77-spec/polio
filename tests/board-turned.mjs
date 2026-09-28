/**
 * A PART MOVED BY ITS OWN TRANSFORM IS DRAWN WHERE IT MOVED, WHOLE, ON THE BOARD.
 *
 * THE OWNER'S REPORT, trumpmorty.fun from sink at 81d39ca: on the board the
 * roadmap's second and fourth cards lost their S01E02 / S01E04 chips and most
 * of a title, and "NEXT" / "???" were blank white bars. Those cards are the
 * site's `translateY(24px) rotate(…)` ones, and the capture hands each part
 * in them its own `art.transform` (the card's turn and a 22 to 24px drop).
 * The board draws a part inside a box that clips (`overflow-hidden`), so a
 * part moved down by its transform had its lower 22px cut away: a sliver of
 * the chip, the top edge of the button. Preview and the export draw it whole.
 *
 * Read in pixels: the chip's fill 5px above its moved foot is the chip's
 * green, not the card behind it.
 *
 *   node tests/board-turned.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const URL_ = process.argv[2] ?? "http://127.0.0.1:3013";
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, f, x, y, w, h, extra = {}) => ({
  id, pageId: "page_home", featureId: f, label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...extra,
});
const A = "body > main > section > div > article:nth-of-type(2)";
const DROP = 22;
const doc = JSON.stringify({ state: {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("card", "box", 400, 200, 276, 266, { colour: { bg: "rgb(246, 182, 143)" }, from: { selector: A }, art: { transform: "matrix(0.9997, 0.0262, -0.0262, 0.9997, 0, 24)" } }),
    node("chip", "box", 424, 228, 78, 35, { colour: { bg: "rgb(0, 200, 0)" }, from: { selector: `${A} > div` }, art: { transform: `matrix(1, 0, 0, 1, 0, ${DROP})` } }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "TURNED", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "page_home", trail: [], swept: 999,
}, version: 0 });

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await ctx.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await ctx.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.mouse.move(2, 2);
const r = await page.evaluate(() => { const e = document.querySelector('[data-node-id="chip"]'); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width }; });
check("the chip is on the board", !!r, JSON.stringify(r));
if (r) {
  const k = r.w / 78;
  const png = (await page.screenshot()).toString("base64");
  const [low, top] = await page.evaluate(async ({ src, pts }) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    return pts.map(([x, y]) => [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)]);
  }, { src: `data:image/png;base64,${png}`, pts: [[r.x + 39 * k, r.y + (35 + DROP - 5) * k], [r.x + 39 * k, r.y + (DROP + 5) * k]] });
  const green = (c) => c[1] > 150 && c[0] < 80 && c[2] < 80;
  check("5px above the chip's moved foot is the chip, not cut away to the card behind", green(low), `rgb(${low})`);
  check("control: just under its moved top is the chip too", green(top), `rgb(${top})`);
}
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
