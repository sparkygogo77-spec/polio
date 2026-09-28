/**
 * A BORDER ON THE BOARD IS DRAWN EVEN, AT ANY ZOOM.
 *
 * THE OWNER'S REPORT, his trumpmorty.fun from sink: on the board the TG / X
 * pills, BUY ON PUMP.FUN and DEX had uneven, stair-stepped edges and a
 * broken outline. They are plain boxes (a 4px border, radius 20, a 7px hard
 * shadow, no transform) and the exported page draws them cleanly, so the
 * fault was the board: it drew its page at 1:1 and shrank the picture with
 * `transform: scale(zoom)`. At 0.79 a 4px border is 3.16 device pixels
 * starting part-way into a pixel, so each side smeared differently over
 * three or four pixels, some sides solid and some grey.
 *
 * Read in pixels. A box with a 4px border and radius 20 is laid on the page;
 * the window is sized so the board fits at an applied zoom of about 0.79,
 * then 0.83 (the owner's range). Along two lines through each side, each
 * pixel is scored for how much of the border's ink it holds, against the
 * colours either side of it. Every side must be the same width in whole
 * ink pixels, and no pixel may be half ink: an edge that is half ink is the
 * smear he saw.
 *
 *   node tests/board-crisp.mjs http://127.0.0.1:3013
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

const INK = [26, 15, 11];
const FILL = [166, 216, 111];
const node = (id, x, y, w, h, extra = {}) => ({
  id, pageId: "page_home", featureId: "box", label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: { bg: `rgb(${FILL})`, surface: `rgb(${FILL})`, accent: `rgb(${FILL})` },
  font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  radius: 20, edge: { width: 4, style: "solid", colour: `rgb(${INK})` }, ...extra,
});
/* Off whole pixels on purpose: 301.3 × 0.79 is not a pixel, and neither is its width. */
const doc = JSON.stringify({ state: {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [node("pill", 301.3, 203.7, 264, 84), node("buy", 657, 417, 227, 71)],
  groups: [], shapes: [], format: {}, brief: { name: "CRISP", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "page_home", trail: [], swept: 999,
}, version: 0 });

/** How much of the border's ink a pixel holds, between the ink and `other`: 0 none, 1 all. */
const inkOf = (px, other) => {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const span = d(other, INK);
  return Math.max(0, Math.min(1, 1 - d(px, INK) / span));
};
/**
 * One line across one side, outside to inside: the pixels of ink, and the
 * ones that are neither ink nor not (0.2 to 0.8 of it). The outer half is
 * scored against the page behind, the inner half against the fill.
 */
const across = (row) => {
  const outside = row[0];
  const first = row.findIndex((p) => inkOf(p, outside) > 0.2);
  if (first < 0) return { width: 0, soft: 0 };
  let solid = 0, soft = 0;
  for (let i = first; i < row.length; i++) {
    const k = Math.min(inkOf(row[i], outside), inkOf(row[i], FILL));
    if (inkOf(row[i], FILL) < 0.2) break; /* into the fill */
    if (k > 0.8) solid++; else soft++;
  }
  return { width: solid, soft };
};

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
for (const [target, h] of [[0.79, 1082], [0.83, 1118]]) {
  const ctx = await browser.newContext({ viewport: { width: 1800, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
  const page = await ctx.newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.mouse.move(2, 2);
  const zoom = await page.evaluate(() => document.querySelector("[data-frame]").getBoundingClientRect().width / 1440);
  check(`the board fits at about ${target}`, Math.abs(zoom - target) < 0.012, `applied ${zoom.toFixed(4)}`);
  const png = (await page.screenshot()).toString("base64");
  for (const id of ["pill", "buy"]) {
    const r = await page.evaluate((i) => { const e = document.querySelector(`[data-node-id="${i}"]`); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }, id);
    if (!r) { check(`${id} is on the board at ${target}`, false); continue; }
    const lines = await page.evaluate(async ({ src, r }) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const g = c.getContext("2d"); g.drawImage(img, 0, 0);
      const at = (x, y) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)];
      const run = (x0, y0, dx, dy, n) => Array.from({ length: n }, (_, i) => at(x0 + dx * i, y0 + dy * i));
      const L = Math.floor(r.x) - 4, T = Math.floor(r.y) - 4, R = Math.ceil(r.x + r.w) + 3, B = Math.ceil(r.y + r.h) + 3;
      const out = {};
      for (const f of [0.4, 0.6]) {
        const y = Math.round(r.y + r.h * f), x = Math.round(r.x + r.w * f);
        out[`left@${f}`] = run(L, y, 1, 0, 16);
        out[`right@${f}`] = run(R, y, -1, 0, 16);
        out[`top@${f}`] = run(x, T, 0, 1, 16);
        out[`bottom@${f}`] = run(x, B, 0, -1, 16);
      }
      return out;
    }, { src: `data:image/png;base64,${png}`, r });
    const seen = Object.fromEntries(Object.entries(lines).map(([k, row]) => [k, across(row)]));
    const widths = Object.values(seen).map((s) => s.width);
    const soft = Object.entries(seen).filter(([, s]) => s.soft).map(([k, s]) => `${k} ${s.soft}`);
    const said = Object.entries(seen).map(([k, s]) => `${k}:${s.width}${s.soft ? `+${s.soft}~` : ""}`).join(" ");
    check(`${id} at ${target}: all four sides the same width`, widths.every((w) => w === widths[0]) && widths[0] >= 2, said);
    check(`${id} at ${target}: no side smeared (no half-ink pixel)`, soft.length === 0, soft.join(", ") || "every pixel ink or not");
  }
  await ctx.close();
}
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
