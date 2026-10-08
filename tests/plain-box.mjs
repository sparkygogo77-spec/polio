/**
 * A plain box draws nothing of its own.
 *
 * His imported page landed 126 parts, and 75 of them were the Idea part:
 * every box on the page that had no words of its own wore a dashed edge, an
 * IDEA label and a "header · 1 inside" line over his content. A box on a
 * page is a box. So there is a part that is only what the node carries — its
 * colour, its edge, its padding and the words typed into it — and nothing it
 * invents: no edge of its own, no kind word, no label.
 *
 * Measured on the board, where the labelled box would have been drawn:
 *   · a box with a colour and no words paints one colour and no text;
 *   · a box with words paints those words and nothing else;
 *   · a box with nothing paints no edge and no text at all;
 *   · the Idea part beside them still says what it is, so the difference is
 *     the part, not the theme.
 *
 *   node tests/plain-box.mjs [url]      # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { FEATURES, SUBGROUPS } from "../src/features/studio/shelf/catalog.ts";

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

/* The library holds it, and the drawer can reach it. */
const box = FEATURES.find((f) => f.id === "box");
check("the library has a part called Box, under Layout", !!box && box.category === "structure" && box.name === "Box", box ? `${box.name} in ${box.category}` : "no such part");
check("it is in a sub-group, so the drawer reaches it", Object.values(SUBGROUPS).flat().some((g) => g.ids.includes("box")));
const defs = readFileSync("src/features/studio/shelf/parts/index.ts", "utf8");
check("its registry line is its own, not the Note's", /ids: \["box"\]/.test(defs) && !/ids: \[[^\]]*"custom-idea"[^\]]*"box"/.test(defs));

/* On the board. */
const node = (id, f, label, content, colour, x, y) => ({
  id, pageId: "p0", featureId: f, label, prompt: "", content, data: "", x, y, w: 480, h: 120, groupId: null, options: {},
  priority: "must", custom: f === "custom-idea", glyph: null, hue: null, locked: false, link: null, colour, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("painted", "box", "header · 1 inside", "", { bg: "rgb(10, 14, 26)", surface: "rgb(10, 14, 26)" }, 40, 40),
    node("worded", "box", "div · 2 inside", "Burn tokens, reclaim rent", null, 40, 200),
    node("bare", "box", "div · 3 inside", "", null, 40, 360),
    node("idea", "custom-idea", "header · 1 inside", "", null, 40, 520),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "Capture", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

/** What the part itself drew: its root, its words, its edge, its background. */
const drew = (id) => page.evaluate((id) => {
  const el = document.querySelector(`[data-node-id="${id}"] [data-part]`);
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    part: el.getAttribute("data-part"),
    fallback: el.hasAttribute("data-part-fallback"),
    text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
    border: `${cs.borderTopWidth} ${cs.borderTopStyle}`,
    background: cs.backgroundColor,
    children: el.children.length,
  };
}, id);

/** The colours in the part's box, off a screenshot: one colour is a box that drew nothing on itself. */
const coloursOf = async (id) => {
  const el = page.locator(`[data-node-id="${id}"] [data-part]`).first();
  const b = await el.boundingBox();
  if (!b) return -1;
  const shot = await page.screenshot({ clip: { x: Math.round(b.x) + 2, y: Math.round(b.y) + 2, width: Math.round(b.width) - 4, height: Math.round(b.height) - 4 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = `data:image/png;base64,${b64}`; });
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const { data } = g.getImageData(0, 0, c.width, c.height);
    const tally = new Set();
    for (let i = 0; i < data.length; i += 4) tally.add(`${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`);
    return tally.size;
  }, shot.toString("base64"));
};

const painted = await drew("painted");
check("a box with a colour is a real part, not the labelled fallback", !!painted && painted.part === "box" && !painted.fallback, JSON.stringify(painted));
check("it paints its colour", painted?.background === "rgb(10, 14, 26)", painted?.background ?? "-");
check("and no words: not its label, not a kind, not a count of what is inside", painted?.text === "", JSON.stringify(painted?.text));
check("and no edge of its own", /^0px/.test(painted?.border ?? ""), painted?.border ?? "-");
const shades = await coloursOf("painted");
check("so its box is one colour, edge to edge", shades >= 1 && shades <= 2, `${shades} colours`);

const worded = await drew("worded");
check("a box with words paints those words, exactly", worded?.text === "Burn tokens, reclaim rent", JSON.stringify(worded?.text));
check("and nothing else round them", /^0px/.test(worded?.border ?? "") && !worded?.fallback, JSON.stringify(worded));

const bare = await drew("bare");
check("a box with nothing paints nothing: no edge, no words, no children", !!bare && bare.text === "" && /^0px/.test(bare.border) && bare.children === 0, JSON.stringify(bare));

const idea = await drew("idea");
check("the Idea part beside them still says what it is, so the difference is the part", !!idea && /Idea/.test(idea.text) && /header · 1 inside/.test(idea.text) && /dashed/.test(idea.border), JSON.stringify(idea));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
