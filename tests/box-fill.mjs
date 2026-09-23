/**
 * A box's fill reaches its edge.
 *
 * HIS REPORT, "the button isn't filled properly". A node that carries
 * padding or an edge is wrapped in a `[data-part-box]` that draws the
 * padding and the edge, and the node's fill was painted by the part INSIDE
 * that padding. So his wallet button (132×40, 2px green edge, 8px 16px
 * padding, green fill) drew a green edge, 16px of the page through the
 * padding, and a green block the size of its words; and his four stat cards
 * and three panels, whose box part holds no words at all, drew a fill 0px
 * tall — an outline over the page where his page has a lighter surface.
 *
 * Measured in pixels, because the elements were never the problem: the
 * edge is right, the fill element's colour is right, and what is wrong is
 * the band between them, which no element owns.
 *
 *   · 3px inside the edge of the button, across and down: the fill;
 *   · the middle of the card: the card's fill, not the page;
 *   · the page ground beside each is checked to DIFFER from the fill, or a
 *     pass would be the page showing through and prove nothing;
 *   · controls: a filled part with no box, and a hand-placed button, are
 *     filled to their edge before and after.
 *
 * On the board and on the live page. Parts are found by `[data-node-id]` /
 * `[data-live-node]`, which every part has.
 *
 *   npx next start -p 3013
 *   node tests/box-fill.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});

const GREEN = [0, 255, 0];
const CARD = [21, 25, 34];
const RED = [200, 40, 40];

const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    /* His wallet button, as captured. */
    node("wallet", "cta-primary", "kgER...9oP7", 80, 60, 132, 40, {
      options: { shape: "square", variant: "solid", size: "medium" },
      colour: { bg: "rgb(0, 255, 0)", accent: "rgb(0, 255, 0)", text: "rgb(0, 0, 0)" },
      edge: { width: 2, style: "solid", colour: "rgb(0, 255, 0)" },
      pad: { top: 8, right: 16, bottom: 8, left: 16 }, text: { align: "center", transform: "uppercase" },
    }),
    /* One of his stat cards, as captured: a box part, no words of its own. */
    node("card", "box", "", 80, 160, 365, 114, {
      colour: { bg: "rgb(21, 25, 34)" },
      edge: { width: 1, style: "solid", colour: "rgb(45, 55, 72)" },
      pad: { top: 16, right: 16, bottom: 16, left: 16 },
    }),
    /* Control: a filled box with nothing said about its box. */
    node("bare", "box", "", 520, 160, 200, 114, { colour: { bg: "rgb(200, 40, 40)" } }),
    /* Control: a hand-placed button. */
    node("plain", "cta-primary", "Get started", 520, 60, 160, 44),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "FILL", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();

const near = (a, b, tol = 8) => !!a && a.every((v, i) => Math.abs(v - b[i]) <= tol);
const show = (c) => (c ? `rgb(${c.join(", ")})` : "none");

/* Pixels off one screenshot of the whole viewport, read back in a canvas. */
const pixels = async (points) => {
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(async ({ src, points }) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    return points.map(([x, y]) => [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)]);
  }, { src: `data:image/png;base64,${png}`, points });
};

for (const [where, path, attr] of [["board", "/builder", "data-node-id"], ["live page", "/builder/preview/", "data-live-node"]]) {
  await page.goto(`${URL_}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.mouse.move(2, 2);
  const rects = await page.evaluate((attr) => Object.fromEntries([...document.querySelectorAll(`[${attr}]`)].map((n) => {
    const r = n.getBoundingClientRect();
    return [n.getAttribute(attr), { x: r.left, y: r.top, w: r.width, h: r.height }];
  })), attr);
  const all = ["wallet", "card", "bare", "plain"].every((id) => rects[id]);
  check(`${where}: all four parts drew`, all, Object.keys(rects).join(", "));
  if (!all) continue;
  // The board is zoomed: a part's drawn width over its node width is the scale.
  const k = rects.wallet.w / 132;
  const w = rects.wallet, c = rects.card, b = rects.bare, p = rects.plain;
  const [wAcross, wDown, wGround, cMid, cGround, bIn, pIn] = await pixels([
    [w.x + (2 + 3) * k, w.y + w.h / 2],          // 3px inside the 2px edge, halfway down
    [w.x + w.w / 2 + 30 * k, w.y + (2 + 3) * k], // 3px inside the top edge, clear of the words
    [w.x + w.w / 2, w.y - 12 * k],               // the page just above it
    [c.x + c.w / 2, c.y + c.h / 2],              // the card's middle
    [c.x + c.w / 2, c.y - 12 * k],               // the page just above it
    [b.x + 3 * k, b.y + b.h / 2],                // control: 3px in from a box that says nothing of its box
    [p.x + (2 + 3) * k, p.y + p.h / 2],          // control: 3px inside a hand-placed button
  ]);
  check(`${where}: the page beside the button is not green (else this proves nothing)`, !near(wGround, GREEN), show(wGround));
  check(`${where}: 3px inside the wallet button's edge, across, is its fill`, near(wAcross, GREEN), show(wAcross));
  check(`${where}: 3px inside its top edge, down, is its fill`, near(wDown, GREEN), show(wDown));
  check(`${where}: the page beside the card is not the card's colour (else this proves nothing)`, !near(cGround, CARD, 3), show(cGround));
  check(`${where}: the card's middle is the card's fill, not the page`, near(cMid, CARD, 3), show(cMid));
  check(`${where}: control — a filled box with no box of its own is filled to its edge`, near(bIn, RED), show(bIn));
  check(`${where}: control — a hand-placed button is filled to its edge`, !!pIn && !near(pIn, cGround, 3), show(pIn));
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
