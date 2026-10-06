/**
 * A PART CUT TO A SHAPE FILLS ITS BOX.
 *
 * J (2026-10-06): PonsStars' duel circles, brought in, drew as two flat
 * lines everywhere in the builder. Each is a circle part with no words, a
 * fill and a 3px edge (60x60 as the page draws it). The cut to the shape
 * (`blocks.tsx`, `data-shape`) was `height: 100%` inside a part that has
 * only a minimum height in a flex column, so the percentage resolved to the
 * content: no words, so as tall as its edge, a 6px line.
 *
 *   · the cut is as tall as the part, for a circle and an ellipse with no
 *     words, on the board and on the live page;
 *   · the circle's middle is its fill, not the page;
 *   · a circle with words, cut only as tall as its words before, fills too.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/shape-fills.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/blocks.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: "box", label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const BLUE = [37, 99, 235];
const ring = (colour) => ({ colour: { bg: `rgb(${colour.join(", ")})` }, edge: { width: 3, style: "solid", colour: `rgb(${colour.join(", ")})` }, pad: { top: 0, right: 0, bottom: 0, left: 0 } });

const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    /* PST's duel circle, as brought in. */
    node("me", "", 120, 120, 120, 120, { shape: "circle", hooks: { "data-hook": "duel-circle-me" }, ...ring(BLUE) }),
    node("oval", "", 320, 120, 200, 100, { shape: "ellipse", ...ring([234, 179, 8]) }),
    /* A circle with words: cut as tall as its words before. */
    node("said", "Go", 600, 120, 120, 120, { shape: "circle", ...ring([200, 40, 40]) }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "SHAPES", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
const near = (a, b, tol = 10) => !!a && a.every((v, i) => Math.abs(v - b[i]) <= tol);

for (const [where, path, attr] of [["board", "/builder", "data-node-id"], ["live page", "/builder/preview/", "data-live-node"]]) {
  await page.goto(`${URL_}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.mouse.move(2, 2);
  const read = await page.evaluate((attr) => Object.fromEntries(["me", "oval", "said"].map((id) => {
    const n = document.querySelector(`[${attr}="${id}"]`);
    const cut = n?.querySelector("[data-shape]");
    if (!n || !cut) return [id, null];
    const a = n.getBoundingClientRect(), c = cut.getBoundingClientRect();
    return [id, { x: a.left, y: a.top, w: a.width, h: a.height, cw: c.width, ch: c.height }];
  })), attr);
  for (const id of ["me", "oval", "said"]) {
    const r = read[id];
    check(`${where}: ${id === "said" ? "the circle with words" : `the ${id === "me" ? "duel circle" : "ellipse"}`} is cut as tall as its part`, !!r && r.ch >= r.h - 2 && r.cw >= r.w - 2, JSON.stringify(r));
  }
  const m = read.me;
  if (m) {
    const png = (await page.screenshot()).toString("base64");
    const px = await page.evaluate(async ({ src, x, y }) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const g = c.getContext("2d"); g.drawImage(img, 0, 0);
      return [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)];
    }, { src: `data:image/png;base64,${png}`, x: m.x + m.w / 2, y: m.y + m.h / 2 });
    check(`${where}: the duel circle's middle is its fill, not the page`, near(px, BLUE), JSON.stringify(px));
  }
}

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
