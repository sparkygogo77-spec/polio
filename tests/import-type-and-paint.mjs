#!/usr/bin/env node
/**
 * SPACED LETTERS, ONE-LINE WORDS AND BLENDED BACKGROUNDS COME IN AS THE PAGE
 * HAD THEM.
 *
 * PonsStars' redesign (J, 2026-10-11) came in with its stencilled capitals
 * run together, its wood rails orange and its labels wrapped: the page
 * reader took no letter-spacing, no white-space and no
 * background-blend-mode, so the board drew every spaced title plain, every
 * multiplied wood tile at the tile's own colour, and held no label to its
 * one line. Three properties the browser already computed, read and drawn.
 *
 * A stand-in page holds a spaced title, a label the page keeps on one line
 * in a box its words would wrap in, a rail whose tile is multiplied over
 * brown, and a plain paragraph. The read is checked, then the document it
 * makes, then (given a Builder) what the Preview draws.
 *
 *   node tests/import-type-and-paint.mjs [http://127.0.0.1:3013]
 */
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { pagesToDoc } from "../src/features/studio/bring-in/pageParts.ts";
import { launch } from "./fixtures/look-sites.mjs";

const BASE = (process.argv[2] ?? "").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const TILE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23f0a050'/%3E%3C/svg%3E";
const HTML = `<!doctype html><html><head><style>
  body { margin: 0; font: 16px Georgia, serif; width: 800px; }
  [data-hook="rail"] { width: 160px; height: 120px; background: url("${TILE}") 0 0 / 8px 8px repeat, rgb(90, 58, 33); background-blend-mode: multiply, normal; }
  [data-hook="title"] { margin: 8px; font: 700 28px/1.2 Arial, sans-serif; letter-spacing: 0.2em; text-transform: uppercase; }
  [data-hook="label"] { display: block; width: 60px; margin: 8px; font: 700 12px/1.3 Arial, sans-serif; white-space: nowrap; }
  [data-hook="plain"] { margin: 8px; width: 300px; }
</style></head><body>
  <div data-hook="rail"></div>
  <h1 data-hook="title">Broadcast standards</h1>
  <span data-hook="label">MONITORING STATION 47</span>
  <p data-hook="plain">A paragraph with nothing special about it, which wraps as its box says.</p>
</body></html>`;

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.setContent(HTML);
const real = await page.evaluate(() => Object.fromEntries(["rail", "title", "label"].map((h) => { const e = document.querySelector(`[data-hook="${h}"]`); const range = document.createRange(); range.selectNodeContents(e); const r = (e.childNodes.length ? range : e).getBoundingClientRect(); return [h, [r.left, r.top, r.width, r.height].map(Math.round)]; })));
const read = await page.evaluate(PARTS, 1500);
const by = (h) => read.parts.find((p) => p.hooks?.["data-hook"] === h);

const title = by("title");
check("the title's letter-spacing is read, as a share of its size", !!title && Math.abs((title.style.spacing ?? 0) - 0.2) < 0.01, JSON.stringify(title?.style.spacing));
const label = by("label");
check("the label is read as held to one line", !!label && label.style.nowrap === true, JSON.stringify({ nowrap: label?.style.nowrap, words: label?.words }));
const plain = by("plain");
check("a plain paragraph says neither", !!plain && plain.style.spacing === undefined && plain.style.nowrap === undefined, JSON.stringify({ spacing: plain?.style.spacing, nowrap: plain?.style.nowrap }));
const rail = by("rail");
check("the rail's blend mode is read with its tile", !!rail && /multiply/.test(rail.style.imageBlend ?? "") && /url\(/.test(rail.style.image ?? ""), JSON.stringify({ blend: rail?.style.imageBlend, image: (rail?.style.image ?? "").slice(0, 30) }));

const { doc } = pagesToDoc([{ file: "index.html", read }], { byHook: true });
const node = (h) => doc.nodes.find((n) => n.hooks?.["data-hook"] === h);
check("the title's part carries the spacing in its font", Math.abs((node("title")?.font?.spacing ?? 0) - 0.2) < 0.01, JSON.stringify(node("title")?.font));
check("the label's part is told nowrap", node("label")?.text?.wrap === "nowrap", JSON.stringify(node("label")?.text));
check("the rail's part carries the blend", /multiply/.test(node("rail")?.art?.backgroundBlend ?? ""), JSON.stringify(node("rail")?.art?.backgroundBlend));
check("the plain paragraph's part carries no wrap and no spacing", !node("plain")?.text?.wrap && node("plain")?.font?.spacing === undefined, JSON.stringify({ text: node("plain")?.text, font: node("plain")?.font }));

if (BASE) {
  /* The Preview draws them: the title as wide as the page's, the label on one line in its box, the rail dark. */
  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await ui.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await ui.evaluate((doc) => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("builder.")) localStorage.removeItem(k);
    const env = (state) => JSON.stringify({ state, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Stand-in", updatedAt: Date.now() }], activeId: "s1" }));
    localStorage.setItem("builder.studio", env({ nodes: doc.nodes, pages: doc.pages, frameWidth: doc.frameWidth, look: { palette: { bg: doc.ground.bg, text: doc.ground.text } } }));
  }, doc);
  await ui.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
  await ui.waitForTimeout(1200);
  const drawn = await ui.evaluate((ids) => Object.fromEntries(ids.map((id) => {
    const e = document.querySelector(`[data-live-node="${id}"]`);
    if (!e) return [id, null];
    const words = [...e.querySelectorAll("*")].find((x) => x.childNodes.length && [...x.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) ?? e;
    const range = document.createRange(); range.selectNodeContents(words);
    const r = e.getBoundingClientRect(), wr = range.getBoundingClientRect(), cs = getComputedStyle(words);
    const box = e.querySelector("[data-part-box]") ?? e.firstElementChild ?? e;
    return [id, { w: r.width, h: r.height, wordsW: wr.width, wordsH: wr.height, spacing: cs.letterSpacing, white: cs.whiteSpace, blend: getComputedStyle(box).backgroundBlendMode, lines: Math.round(wr.height / (parseFloat(cs.lineHeight) || 1)) }];
  })), ["title", "label", "rail"].map((h) => node(h).id));
  const t = drawn[node("title").id], l = drawn[node("label").id], ra = drawn[node("rail").id];
  check("the Preview spaces the title's letters", !!t && Math.abs(parseFloat(t.spacing) - 28 * 0.2) < 0.6, JSON.stringify(t));
  check("the title is as wide as on the page, within 4px", !!t && Math.abs(t.wordsW - real.title[2]) <= 4, JSON.stringify({ drawn: t?.wordsW, page: real.title[2] }));
  check("the label stays on one line in its narrow box", !!l && l.white === "nowrap" && l.lines === 1, JSON.stringify(l));
  check("the rail is drawn with its tile multiplied over its colour", !!ra && /multiply/.test(ra.blend), JSON.stringify(ra));
  await ui.close();
}
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
