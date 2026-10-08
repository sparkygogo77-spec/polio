/**
 * Faces come through one to one, or say why they did not.
 *
 * HIS RULING: fonts must come through as they are, because size and ratios
 * have to stay true. The name of a face travelled and the file did not, so
 * his headings wrapped in a wider face and nothing said so.
 *
 * Three halves, each held to the real thing:
 *   · pure: `carryFaces` decides what happens to each face — a system face
 *     is named and moved on, a Latin subset is kept and a Cyrillic one is
 *     not, a licensed host's file is not fetched and the reason is written,
 *     a file past the cap or behind a dead address is kept by its address
 *     with the reason, and the strip's sentence says all of it;
 *   · the page: `FACES` reads a page's @font-face rules off its sheets,
 *     with addresses made absolute against the sheet that declared them;
 *   · the Builder: a document carrying a real file draws its words in that
 *     face, measurably; with the face taken off the part the words draw in
 *     another, so a carried face is named, never welded; a face behind a
 *     dead address is said as a toast; a site with no faces renders nothing.
 *
 *   node tests/fonts-carried.mjs [url]      # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { carryFaces, facesSays, fontFaceCss, fontLinks, forbids, genericsOf, genericSays, isLatin, licenceOf, FONT_FILE_MAX } from "../src/features/studio/look/fonts.ts";
import { FACES } from "../src/features/studio/bring-in/siteRead.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();
const http = req("node:http");

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* A real face, under a made-up name. */
const TTF = readFileSync("/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf");

/* ------------------------------------------------------------------ */
/* Pure                                                                 */
/* ------------------------------------------------------------------ */

check("no unicode-range is Latin, a Latin subset is Latin, a Cyrillic subset is not", isLatin(undefined) && isLatin("U+0000-00FF, U+0131") && isLatin("u+00??,u+0131") && isLatin("U+0-FF") && !isLatin("U+0460-052F, U+1C80-1C88") && !isLatin("U+460-52F"));
check("a Typekit host forbids carrying and says so; Google Fonts is open; a page's own file is the page's", !!forbids("https://use.typekit.net/af/abc.woff2") && !forbids("https://fonts.gstatic.com/s/x.woff2") && /open/.test(licenceOf("https://fonts.gstatic.com/s/x.woff2")) && /page's own file/.test(licenceOf("https://ccc-woad.vercel.app/_next/static/media/a.woff2")));

const read = {
  faces: [
    { family: "Harbour Serif", weight: "400", style: "normal", sources: [{ url: "https://site.example/fonts/harbour.woff2", format: "woff2" }], sheet: "https://site.example/style.css" },
    { family: "Harbour Serif", weight: "400", style: "normal", sources: [{ url: "https://site.example/fonts/harbour-cyr.woff2", format: "woff2" }], sheet: "https://site.example/style.css", unicodeRange: "U+0400-045F" },
    { family: "Harbour Serif", weight: "700", sources: [{ url: "https://site.example/fonts/harbour-bold.woff2", format: "woff2" }], sheet: null },
    { family: "Licensed Grotesk", sources: [{ url: "https://use.typekit.net/af/lic.woff2", format: "woff2" }], sheet: "https://use.typekit.net/abc.css" },
    { family: "Heavy Display", sources: [{ url: "https://site.example/fonts/heavy.woff2", format: "woff2" }], sheet: null },
    { family: "Gone Sans", sources: [{ url: "https://site.example/fonts/gone.woff2", format: "woff2" }], sheet: null },
    { family: "Unused Mono", sources: [{ url: "https://site.example/fonts/unused.woff2", format: "woff2" }], sheet: null },
  ],
  links: [{ href: "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" }],
};
const fetched = [];
const fetchBytes = async (url) => {
  fetched.push(url);
  if (/gone/.test(url)) return { error: "it answered 404" };
  if (/heavy/.test(url)) return { bytes: new Uint8Array(FONT_FILE_MAX + 1) };
  return { bytes: new Uint8Array([0, 1, 2, 3]) };
};
const carried = await carryFaces(read, ["Harbour Serif", "Licensed Grotesk", "Heavy Display", "Gone Sans", "Press Start 2P", "Arial"], "https://site.example/", fetchBytes);
const by = (name) => carried.fonts.filter((f) => f.family === name);
check("the face the page is set in is carried as bytes, regular and bold, with the Cyrillic subset left out", by("Harbour Serif").length === 2 && by("Harbour Serif").every((f) => f.carried && f.source.kind === "data" && /^data:font\/woff2;base64,/.test(f.source.src)) && !fetched.some((u) => /cyr/.test(u)), JSON.stringify(by("Harbour Serif").map((f) => [f.weight, f.carried, f.source.kind])));
check("and remembers where it came from: the page and the sheet", by("Harbour Serif")[0]?.from.url === "https://site.example/" && by("Harbour Serif")[0]?.from.sheet === "https://site.example/style.css");
check("a licensed host's file is not fetched; its sheet is kept as a link and the reason is written", by("Licensed Grotesk").length === 1 && !by("Licensed Grotesk")[0].carried && by("Licensed Grotesk")[0].source.kind === "link" && /licence forbids/.test(by("Licensed Grotesk")[0].says) && !fetched.some((u) => /typekit/.test(u)), by("Licensed Grotesk")[0]?.says);
check("a file past the cap is kept by its address with the reason", by("Heavy Display").length === 1 && !by("Heavy Display")[0].carried && by("Heavy Display")[0].source.kind === "url" && /KB, past the/.test(by("Heavy Display")[0].says), by("Heavy Display")[0]?.says);
check("a dead address is kept with what it answered", by("Gone Sans").length === 1 && !by("Gone Sans")[0].carried && /could not be fetched .* 404/.test(by("Gone Sans")[0].says), by("Gone Sans")[0]?.says);
check("a face named only by a Google Fonts sheet is carried as that link", by("Press Start 2P").length === 1 && by("Press Start 2P")[0].carried && by("Press Start 2P")[0].source.kind === "link" && /open/.test(by("Press Start 2P")[0].licence));
check("a system face is named and moved on; a face the page loads but never uses is not carried", carried.named.length === 1 && carried.named[0] === "Arial" && !by("Unused Mono").length, JSON.stringify(carried.named));
const says = facesSays(carried);
check("the strip's sentence says what came, what could not and why, and what needed nothing", /Harbour Serif and Press Start 2P came with the page, one to one/.test(says) && /Licensed Grotesk could not be carried/.test(says) && /Heavy Display could not be carried/.test(says) && /Gone Sans could not be fetched/.test(says) && /nearest face this machine has/.test(says) && /Arial is a system face/.test(says), says);
const generics = genericsOf(['ui-monospace, "SF Mono", Menlo, monospace', '"Press Start 2P", monospace', "ui-monospace, Menlo", "system-ui, sans-serif"]);
check("text set in a generic keyword is the machine's own face, said as such: his headings fit his monospace and wrapped in this one's", JSON.stringify(generics) === JSON.stringify(["ui-monospace", "system-ui"]) && /ui-monospace and system-ui/.test(genericSays(generics)) && /different faces on a different machine/.test(genericSays(generics)) && genericSays([]) === "", genericSays(generics));
const css = fontFaceCss(carried.fonts);
check("the rules name the family, weight and style, and the bytes; links are separate", /@font-face\{font-family:"Harbour Serif";font-weight:400;font-style:normal;font-display:block;src:url\(data:font\/woff2;base64,/.test(css) && /font-weight:700/.test(css) && /url\(https:\/\/site\.example\/fonts\/gone\.woff2\)/.test(css) && !/typekit/.test(css) && JSON.stringify(fontLinks(carried.fonts)) === JSON.stringify(["https://use.typekit.net/abc.css", "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"]), fontLinks(carried.fonts).join(" "));

/* ------------------------------------------------------------------ */
/* The page                                                             */
/* ------------------------------------------------------------------ */

const served = http.createServer((rq, res) => {
  if (rq.url === "/style.css") { res.writeHead(200, { "content-type": "text/css" }); res.end(`@font-face{font-family:"Harbour Serif";src:url(fonts/harbour.ttf) format("truetype")}\n.hero{font-family:"Harbour Serif",Georgia,serif}`); return; }
  if (rq.url === "/fonts/harbour.ttf") { res.writeHead(200, { "content-type": "font/ttf" }); res.end(TTF); return; }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html><head><link rel="stylesheet" href="/style.css"><style>@font-face{font-family:"Inline Sans";font-weight:700;src:url(/fonts/inline.woff2) format("woff2"),url(/fonts/inline.woff) format("woff");unicode-range:U+0000-00FF}</style></head><body><h1 class="hero">Everything arrives somewhere</h1></body></html>`);
});
const FIX = await new Promise((go) => served.listen(0, "127.0.0.1", () => go(`http://localhost:${served.address().port}`)));

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const reader = await browser.newPage();
await reader.goto(`${FIX}/`, { waitUntil: "load" });
await reader.waitForTimeout(300);
const found = await reader.evaluate(FACES);
const harbour = found.faces.find((f) => f.family === "Harbour Serif");
const inline = found.faces.find((f) => f.family === "Inline Sans");
check("the page's faces are read off its sheets, the address made absolute against the sheet that declared it", !!harbour && harbour.sources[0]?.url === `${FIX}/fonts/harbour.ttf` && harbour.sources[0]?.format === "truetype" && harbour.sheet === `${FIX}/style.css`, JSON.stringify(harbour));
check("a rule in a style on the page: every source in order, weight and range, and no sheet", !!inline && inline.sources.length === 2 && inline.sources[1]?.format === "woff" && inline.weight === "700" && /^U\+0(000)?-(00)?FF$/i.test(inline.unicodeRange ?? "") && inline.sheet === null, JSON.stringify(inline));
await reader.close();

/* ------------------------------------------------------------------ */
/* The Builder                                                          */
/* ------------------------------------------------------------------ */

const DATA = `data:font/ttf;base64,${TTF.toString("base64")}`;
const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const docWith = (fonts, face) => JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [node("words", "prose", "Everything arrives somewhere", 40, 40, 900, 60, { font: face ? { face, size: 1.5 } : { family: "geometric sans", size: 1.5 } })],
  groups: [], shapes: [], format: {}, brief: { name: "Harbour", gimmick: "", master: "" },
  look: { palette: {}, texture: [], target: "page", light: { on: false, x: 0.5, y: 0.2, strength: 0.6, height: 0.5 }, ...(fonts ? { fonts } : {}) },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });
const HELD = { id: "font:harbour-serif:400:normal", family: "Harbour Serif", weight: "400", style: "normal", source: { kind: "data", src: DATA, format: "truetype" }, from: { url: `${FIX}/`, sheet: `${FIX}/style.css` }, licence: "the page's own file, carried as the page serves it; its licence is the page's", carried: true, bytes: TTF.length };
const DEAD = { id: "font:gone-sans:400:normal", family: "Gone Sans", source: { kind: "url", url: `${FIX}/fonts/gone.woff2`, format: "woff2" }, from: { url: `${FIX}/`, sheet: null }, licence: "the page's own file", carried: false, says: `Gone Sans could not be fetched from ${FIX}/fonts/gone.woff2: it answered 404` };

const open = async (doc) => {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
  const page = await context.newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  return { context, page };
};
/** Does a line set in the face measure differently from the fallback alone? The reading's own test. */
const drewIn = (page, name) => page.evaluate((name) => {
  const c = document.createElement("canvas").getContext("2d");
  const line = "mmmmmmmmmmlli WWW 0123 The quick fox";
  return ["monospace", "serif", "sans-serif"].some((fb) => {
    c.font = `32px ${fb}`;
    const alone = c.measureText(line).width;
    c.font = `32px "${name}", ${fb}`;
    return Math.abs(c.measureText(line).width - alone) > 0.5;
  });
}, name);
const wordsFont = (page) => page.evaluate(() => {
  const el = [...document.querySelectorAll('[data-node-id="words"] [data-part] *')].find((e) => e.children.length === 0 && /Everything arrives/.test(e.textContent ?? ""));
  return el ? getComputedStyle(el).fontFamily : null;
});

const a = await open(docWith([HELD, DEAD], "Harbour Serif"));
const styleCount = await a.page.locator("style[data-carried-fonts]").count();
check("a document carrying a face puts its rule on the page", styleCount >= 1, `${styleCount} style elements`);
check("and the face is loaded, so a line set in it measures differently from the fallback: the file drew", await drewIn(a.page, "Harbour Serif"));
const inFace = await wordsFont(a.page);
check("the part set in it names it first", !!inFace && /^"?Harbour Serif"?/.test(inFace), inFace ?? "-");
await a.page.waitForTimeout(2500);
const toast = await a.page.evaluate(() => document.body.innerText);
check("a face behind a dead address is said as a toast, with why, rather than falling back in silence", /Gone Sans is not drawing/.test(toast) && /answered 404/.test(toast) && /nearest face this machine has/.test(toast), toast.match(/Gone Sans[^\n]*/)?.[0] ?? "no toast");
check("the carried face is in the wheel's family readout is the store's, not welded on: the look holds it", await a.page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") ?? "{}").state?.look?.fonts?.length) === 2);
await a.context.close();

const b = await open(docWith([HELD, DEAD], null));
const swapped = await wordsFont(b.page);
check("with the face taken off the part, the same words draw in another face: a carried face is named, never welded", !!swapped && !/Harbour Serif/.test(swapped), swapped ?? "-");
await b.context.close();

const c = await open(docWith(null, null));
const none = await c.page.locator("style[data-carried-fonts], link[data-carried-font-link]").count();
check("a site carrying no faces renders nothing for them, so nothing already built changes", none === 0, `${none} elements`);
await c.context.close();

await browser.close();
served.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
