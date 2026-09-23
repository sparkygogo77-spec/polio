/**
 * A captured button that carries no edge gets no border at all.
 *
 * HIS REPORT. A button off his page with nothing said about an edge was
 * being given `2px solid transparent` by the part: invisible, but it takes
 * 2px off every side of the inside, so a 223px entry had 219px of room and
 * its words sat 2px in from where his page put them. The transparent edge
 * is the library's, and it is there so a solid and an outline button of
 * the same size are the same size. A node that says what it wears (its
 * colours, where its words sit, its padding) is not the library's button,
 * and it has no edge unless it names one.
 *
 * Held both ways:
 *   · a node that speaks and names no edge: 0px, whatever the variant, and
 *     the button's inside is the whole of its box;
 *   · a node that says nothing, or only a weight: the library's 2px, as
 *     `button-own.mjs` holds, byte for byte.
 *
 * Measured on the board and on the live page, from the button's own
 * computed style and its clientWidth, never from `[data-part-box]`, which
 * most of these nodes do not have.
 *
 *   npx next start -p 3013
 *   node tests/button-no-edge.mjs http://127.0.0.1:3013
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

const GREY = "rgb(160, 174, 192)";
const GROUND = "rgb(10, 14, 26)";

const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    /* Says nothing: the library's button, edge and all. */
    node("plain", "cta-primary", "Get started", 80, 60, 223, 44),
    /* Says only a weight: still the library's edge (button-own.mjs). */
    node("weight-only", "cta-primary", "Half", 80, 130, 223, 44, { font: { weight: 400 } }),
    /* Captured, solid, painted, no edge named. */
    node("solid-unedged", "cta-primary", "Cleanup", 80, 200, 223, 44, {
      options: { variant: "solid" }, colour: { bg: GROUND, text: GREY }, text: { align: "left" },
    }),
    /* Captured, outline (the converter's answer to a fill it could not read), no edge named. */
    node("outline-unedged", "cta-primary", "Tokens", 80, 270, 223, 44, {
      options: { variant: "outline" }, colour: { text: GREY }, text: { align: "left" },
    }),
    /* Captured with padding and nothing else about its clothes. */
    node("padded-unedged", "cta-primary", "NFTs", 80, 340, 223, 44, {
      pad: { top: 12, right: 16, bottom: 12, left: 16 },
    }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "EDGES", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();

const read = (attr) => page.evaluate((attr) => {
  const out = {};
  for (const el of document.querySelectorAll(`[${attr}]`)) {
    const b = el.querySelector("[data-part] button");
    if (!b) continue;
    const c = getComputedStyle(b);
    out[el.getAttribute(attr)] = {
      edge: `${c.borderTopWidth} ${c.borderTopStyle}`,
      widths: [c.borderTopWidth, c.borderRightWidth, c.borderBottomWidth, c.borderLeftWidth].join(" "),
      // The room inside: clientWidth excludes the border, offsetWidth includes it.
      lost: b.offsetWidth - b.clientWidth,
    };
  }
  return out;
}, attr);

for (const [where, path, attr] of [["board", "/builder", "data-node-id"], ["live page", "/builder/preview/", "data-live-node"]]) {
  await page.goto(`${URL_}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const on = await read(attr);
  check(`${where}: all five buttons drew`, Object.keys(on).length === 5, Object.keys(on).join(", "));
  for (const id of ["solid-unedged", "outline-unedged", "padded-unedged"]) {
    const b = on[id] ?? {};
    check(`${where}: ${id} has no border of its own`, b.widths === "0px 0px 0px 0px", b.widths);
    check(`${where}: …and loses no width to one`, b.lost === 0, `${b.lost}px`);
  }
  for (const id of ["plain", "weight-only"]) {
    const b = on[id] ?? {};
    check(`${where}: ${id} keeps the library's 2px edge`, b.edge === "2px solid", b.edge);
  }
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
