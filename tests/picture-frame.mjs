#!/usr/bin/env node
/**
 * A PICTURE OF A BOX FRAMES A PART AT ANY SIZE, ITS CORNERS AS DRAWN.
 *
 * J (2026-10-08): the light-construct boxes in the timeline came from a
 * generated picture, and wearing one on a part took a code chat. Now a
 * picture is cut in nine (`frame.ts`, CSS border-image): four lines, corners
 * kept, edges stretched. It goes back to the code as tokens in the style
 * layer, keyed by the part's hook.
 *
 * Two halves:
 *   1. pure: a new frame, every side at one scale, the tokens and slots it
 *      writes, the style layer rule for a PonsStars panel (kit rules too),
 *      taking it off, and the brief's words;
 *   2. in Chromium: a light-construct style picture drawn on a canvas, the
 *      layer put on a PonsStars-like page with the same panel at two sizes,
 *      and each corner of the small one pixel for pixel the corner of the
 *      big one, and the picture's own corner at that scale.
 *
 *   node tests/picture-frame.mjs
 *
 * Covers: src/features/studio/frame.ts, src/features/studio/styleLayer.ts, src/features/studio/inspector/frameField.tsx, src/features/studio/parts/theme.ts
 */
import { createRequire } from "node:module";
import { describeFrame, frameCss, frameSides, frameStyle, newFrame, NEW_FRAME_SIDE } from "../src/features/studio/frame.ts";
import { artCss, buildLayer, changedDeclarations, lookOf, kitDeclarations } from "../src/features/studio/styleLayer.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ---------------------------------------------------------------- 1. pure */
const SRC = "data:image/png;base64,AAAA";
const f0 = newFrame(SRC, 320, 200);
check("a new frame cuts a quarter in from every side", f0.slice.join() === "25,25,25,25");
check(`and draws its thickest side at about ${NEW_FRAME_SIDE}px`, Math.abs(Math.max(...frameSides(f0)) - NEW_FRAME_SIDE) <= 1, frameSides(f0).join());
const f = { ...f0, scale: 0.4 };
const [t, r, b, l] = frameSides(f);
check("every side draws at one scale, so a corner keeps its shape", t === 20 && b === 20 && l === 32 && r === 32, `${t} ${r} ${b} ${l}`);
check("a corner drawn is the picture's corner, shrunk the same both ways", Math.abs(l / t - (0.25 * 320) / (0.25 * 200)) < 1e-9);
const css = frameCss(f);
check("it goes out as tokens", css["--frame-image"] === `url("${SRC}")` && css["--frame-slice"] === "25% 25% 25% 25%" && css["--frame-width"] === "20px 32px 20px 32px" && css["--frame-repeat"] === "stretch", JSON.stringify(css));
check("read by the border-image slots", css["border-image-source"] === "var(--frame-image)" && css["border-image-slice"] === "var(--frame-slice)" && css["border-image-width"] === "var(--frame-width)" && css["border-width"] === "var(--frame-width)");
check("the part's own colour stops inside the frame unless the middle fills", css["background-clip"] === "padding-box" && !frameCss({ ...f, fill: true })["background-clip"] && frameCss({ ...f, fill: true })["--frame-slice"].endsWith(" fill"));
check("a line never passes the middle", frameCss({ ...f, slice: [80, 25, 25, 25] })["--frame-slice"].startsWith("49%"));
const st = frameStyle(f);
check("the board wears the same, in React's spelling", st.borderImageSource === "var(--frame-image)" && st["--frame-width"] === "20px 32px 20px 32px" && st.backgroundClip === "padding-box");

/* A PonsStars panel, as brought in: a hook, its look as landed. */
const panel = { id: "p1", pageId: "play", featureId: "box", x: 40, y: 80, w: 480, h: 260, content: "", hooks: { "data-hook": "match-panel" } };
const was = lookOf(panel);
const framed = { ...panel, art: { frame: f }, source: { file: "play.html", hook: { attr: "data-hook", value: "match-panel" }, was } };
check("the part's slots carry the frame", artCss(framed)["border-image-source"] === "var(--frame-image)");
const decl = changedDeclarations(was, lookOf(framed), { dx: 0, dy: 0 });
check("the layer writes the frame for the hook, and nothing else", decl.length === Object.keys(css).length && decl.includes("--frame-width: 20px 32px 20px 32px"), decl.join("; "));
const source = { repo: "x/PST", ref: "main", dir: "web", files: [{ file: "play.html", pageId: "play", hooks: [{ attr: "data-hook", value: "match-panel", line: 3, imported: true }], vars: [] }] };
const layer = buildLayer([framed], null, source, { kit: true });
const rule = layer.rules.find((x) => x.selector === '[data-hook="match-panel"]');
check("a builder-ready repository gets it keyed by data-hook", !!rule && rule.declarations.includes("border-image-slice: var(--frame-slice)"), layer.css.slice(0, 200));
check("and nothing in it reads as a stray colour to the kit", JSON.stringify(kitDeclarations("match-panel", decl)) === JSON.stringify(decl));
const off = changedDeclarations(lookOf(framed), lookOf({ ...framed, art: null }), { dx: 0, dy: 0 });
check("taking it off writes the slots back to nothing", off.includes("border-image-source: none") && off.includes("border-style: none"), off.join("; "));
check("the brief says it in words", /cut in nine/.test(describeFrame(f)) && /20px 32px 20px 32px/.test(describeFrame(f)));

/* -------------------------------------------------------------- 2. Chromium */
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent("<!doctype html><body></body>");
  /* A light-construct box: a dark glass middle, a glowing cyan edge, and four corners that are not alike, so a stretched or swapped corner shows. */
  const picture = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 320; c.height = 200;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(10, 20, 40, 0.85)"; g.fillRect(14, 14, 292, 172);
    g.shadowColor = "#3df"; g.shadowBlur = 10; g.strokeStyle = "#7ef"; g.lineWidth = 4; g.strokeRect(14, 14, 292, 172);
    g.shadowBlur = 0;
    const mark = [["#f3a", 6, 6], ["#fd3", 274, 6], ["#3f8", 6, 154], ["#a6f", 274, 154]];
    mark.forEach(([col, x, y], i) => { g.fillStyle = col; g.fillRect(x, y, 40, 40); g.fillStyle = "#000"; g.fillRect(x + 6 + i * 5, y + 8, 10, 10 + i * 4); });
    return c.toDataURL("image/png");
  });
  const frame = { ...newFrame(picture, 320, 200), scale: 0.4 };
  const lay = buildLayer([{ ...framed, art: { frame } }], null, source, { kit: true });
  check("the layer for the drawn picture has its rule", lay.css.includes('[data-hook="match-panel"]'));
  /* The same panel twice, as PonsStars' page would carry it at two widths. */
  await page.setContent(`<!doctype html><html><head><style>
    body { margin: 0; background: #0b0f17; }
    .wrap { position: absolute; }
    [data-hook="match-panel"] { box-sizing: border-box; background: #123; color: #fff; }
    ${lay.css}
  </style></head><body>
    <div class="wrap" style="left:40px;top:40px"><section data-hook="match-panel" style="width:200px;height:120px">small</section></div>
    <div class="wrap" style="left:40px;top:240px"><section data-hook="match-panel" style="width:880px;height:520px">big</section></div>
  </body></html>`);
  const boxes = await page.$$eval('[data-hook="match-panel"]', (els) => els.map((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return { x: r.x, y: r.y, w: r.width, h: r.height, src: s.borderImageSource, bw: s.borderTopWidth + " " + s.borderLeftWidth }; }));
  check("both panels wear the picture", boxes.every((x) => x.src.startsWith('url("data:image/png')), boxes.map((x) => x.src.slice(0, 30)).join(" | "));
  check("and its frame is 20 by 32 px thick at both sizes", boxes.every((x) => x.bw === "20px 32px"), boxes.map((x) => x.bw).join(" | "));
  const [cw, ch] = [32, 20];
  const corners = (x) => [[x.x, x.y], [x.x + x.w - cw, x.y], [x.x, x.y + x.h - ch], [x.x + x.w - cw, x.y + x.h - ch]];
  const shot = (x, y) => page.screenshot({ clip: { x, y, width: cw, height: ch } });
  const small = await Promise.all(corners(boxes[0]).map(([x, y]) => shot(x, y)));
  const big = await Promise.all(corners(boxes[1]).map(([x, y]) => shot(x, y)));
  ["top left", "top right", "bottom left", "bottom right"].forEach((name, i) => check(`the ${name} corner is the same at 200×120 and 880×520`, small[i].equals(big[i])));
  /* And it is the picture's own corner, shrunk: the same patch of the picture drawn at 0.4 on a canvas. */
  const diff = await page.evaluate(async ({ shots, picture }) => {
    const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const img = await load(picture);
    const cuts = [[0, 0], [240, 0], [0, 150], [240, 150]];
    const out = [];
    for (let k = 0; k < 4; k++) {
      const a = document.createElement("canvas"); a.width = 32; a.height = 20;
      const ga = a.getContext("2d"); ga.fillStyle = "#0b0f17"; ga.fillRect(0, 0, 32, 20);
      ga.drawImage(img, cuts[k][0], cuts[k][1], 80, 50, 0, 0, 32, 20);
      const s = await load("data:image/png;base64," + shots[k]);
      const b = document.createElement("canvas"); b.width = 32; b.height = 20; b.getContext("2d").drawImage(s, 0, 0);
      const pa = ga.getImageData(0, 0, 32, 20).data, pb = b.getContext("2d").getImageData(0, 0, 32, 20).data;
      let sum = 0; for (let j = 0; j < pa.length; j += 4) sum += Math.abs(pa[j] - pb[j]) + Math.abs(pa[j + 1] - pb[j + 1]) + Math.abs(pa[j + 2] - pb[j + 2]);
      out.push(sum / (pa.length / 4) / 3);
    }
    return out;
  }, { shots: small.map((s) => s.toString("base64")), picture });
  check("each corner is the picture's own corner at that size (mean difference under 12 of 255)", diff.every((d) => d < 12), diff.map((d) => d.toFixed(1)).join(" "));
  /* The edges are what stretched: the big panel's top edge is the picture's top edge, drawn far wider. */
  check("the edges stretched to fill the bigger panel", boxes[1].w - boxes[0].w === 680 && boxes[1].h - boxes[0].h === 400);
} finally {
  await browser.close();
}

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
