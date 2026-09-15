/**
 * A zip arrives, and its page becomes parts a person can move and prompt.
 *
 * J's final test: something he did not make in this tool arrives and
 * becomes editable in the same way as something he drew. So the bar here
 * is not that the zip parses. It is that what lands in the space is a
 * real part with a plan, laid where the page had it, that he can move,
 * resize and prompt exactly like a part he drew himself, and that the
 * panel says plainly which blocks reached that bar and which did not.
 *
 * Three halves: what may be in a zip and which file is its page (pure);
 * the route, which unpacks it and measures its page with every request
 * answered from the zip; and the flow by hand in the Builder, from a
 * drawn space to parts on the board.
 *
 * The zips are written here, by a writer of a few lines, so that the
 * reader is held to real zip bytes and not to itself.
 *
 *   node tests/zip-import.mjs [builder url]
 *   SHOTS=1 node tests/zip-import.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { crc32, deflateRawSync } from "node:zlib";
import {
  checkZip, contentType, fileFor, fitToSurface, hadScripts, insideZip, MAX_FILES, mergeReadings, pageBlocks, pageEntry, saidOf, sansScripts, SURE, ZIP_REFUSAL_SAYS,
} from "../src/features/studio/zipImport.ts";
import { readZip } from "../src/features/studio/zipFile.ts";
import { SURE_ENOUGH } from "../src/features/studio/recreate.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const BUILDER = process.argv[2] ?? "http://localhost:3000";
const SHOTS = !!process.env.SHOTS;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* A zip writer of a few lines: stored or deflated, no zip64             */
/* ------------------------------------------------------------------ */

function zip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const dir = [];
  let at = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
    const packed = f.deflate ? deflateRawSync(data) : data;
    const method = f.deflate ? 8 : 0;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10); central.writeUInt16LE(0, 12); central.writeUInt16LE(0, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38); central.writeUInt32LE(at, 42);
    parts.push(local, Buffer.from(name), Buffer.from(packed));
    dir.push(central, Buffer.from(name));
    at += 30 + name.length + packed.length;
  }
  const dirBytes = Buffer.concat(dir);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10); end.writeUInt32LE(dirBytes.length, 12); end.writeUInt32LE(at, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, dirBytes, end]);
}

/* ------------------------------------------------------------------ */
/* The page in the zip: a site export, the way one arrives               */
/* ------------------------------------------------------------------ */

/* Its styles in their own file and its picture in another, because that
   is what an export is, and the page must find both inside the zip. One
   picture points at the network on purpose: it must get nothing and the
   read must not wait for it. A script is in it on purpose too: it must be
   taken out, and the panel must say so. */
const CSS = `
  *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,sans-serif;background:#fff url(img/quay.svg) no-repeat 0 -400px;color:#111}
  .side{position:absolute;right:32px;top:600px;width:220px;padding:16px;border:1px solid #e3e3e6}
  .side h4{margin:0 0 8px;font-size:14px} .side a{display:block;font-size:14px;padding:4px 0;color:#225}
  header{display:flex;align-items:center;gap:24px;height:72px;padding:0 32px;background:rgb(17,19,31);color:#fff}
  .name{font-size:22px;font-weight:600;letter-spacing:-0.01em}
  header nav{display:flex;gap:20px;margin-left:auto}
  header nav a{color:#fff;text-decoration:none;font-size:14px}
  header button{font-size:14px;padding:8px 14px;border:0;border-radius:4px;background:#fff;color:#111}
  .hero{font-family:Georgia,serif;display:flex;align-items:center;gap:40px;padding:64px 32px}
  .hero h1{font-size:48px;line-height:1.1;margin:0 0 16px}
  .hero p{font-size:18px;margin:0;color:#444}
  .hero img{width:640px;height:360px;display:block}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:0 32px 64px}
  .cards article{padding:24px;border:1px solid #e3e3e6;border-radius:8px}
  .cards h2{font-size:20px;margin:0 0 8px}
  .terms{padding:0 32px} .terms h3{margin:0;font-size:20px;line-height:30px}
  .terms p{float:left;width:100%;height:130px;margin:0;font-size:15px;line-height:1.5}
  footer{clear:both;padding:32px;background:#f4f4f6;font-size:13px;color:#555}
`;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#9fb6c8"/><rect y="240" width="640" height="120" fill="#31506b"/><circle cx="520" cy="90" r="44" fill="#f3e2c0"/></svg>';
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Harbour</title><link rel="stylesheet" href="css/style.css"><script src="js/app.js"></script></head><body>
  <header><span class="name">Harbour</span><nav><a href="/product">Product</a><a href="/pricing">Pricing</a><a href="/docs">Docs</a></nav><button onclick="alert(1)">Start free</button></header>
  <section class="hero" role="banner">
    <div><h1>Everything <abbr title="gets there">arrives</abbr> somewhere</h1><p>Freight, tracked from the quay to the door, in one place.</p></div>
    <img width="640" height="360" alt="A harbour at first light" src="img/quay.svg">
  </section>
  <section class="cards">
    <article><h2>Quiet</h2><p>Nothing moves without a reason.</p></article>
    <article><h2>Fast</h2><p>Every hop measured, nothing guessed.</p></article>
    <article><h2>Yours</h2><p>Your keys, your data, your account.</p></article>
  </section>
  <section class="terms"><h3>Terms of carriage</h3>
    <p>Where possible, cargo is booked to the door and not to the quay, so that one bill covers the whole way.</p>
    <p>Luckily, most freight is dry and boxed, and a box that is measured once is measured for good.</p>
    <p>We ask that every consignment carry its own papers, and that the papers say what the box says.</p>
    <p>This is a shared undertaking as well as a service, and the terms are the same for every customer.</p>
  </section>
  <aside class="side"><h4>Resources</h4><a href="/docs/start">Getting started</a><a href="/docs/api">The API</a><a href="/docs/faq">Questions</a><a href="/status">Status</a></aside>
  <footer>Harbour Freight Ltd. Built on the quay. <img alt="" width="1" height="1" src="https://example.invalid/beacon.png"></footer>
  <script>document.body.innerHTML = "";</script>
</body></html>`;
const HARBOUR = zip([
  { name: "harbour/", data: "" },
  { name: "harbour/index.html", data: HTML, deflate: true },
  { name: "harbour/css/style.css", data: CSS, deflate: true },
  { name: "harbour/img/quay.svg", data: SVG },
  { name: "harbour/js/app.js", data: "document.body.innerHTML = ''", deflate: true },
]);

/* ------------------------------------------------------------------ */
/* 1. What may be in a zip, and which file is its page                   */
/* ------------------------------------------------------------------ */

const files = readZip(new Uint8Array(HARBOUR));
check("a zip written by hand is read back, every file by name", !!files && files.map((f) => f.name).join(",") === "harbour/,harbour/index.html,harbour/css/style.css,harbour/img/quay.svg,harbour/js/app.js", files?.map((f) => f.name).join(","));
check("a deflated file unpacks to what was put in", !!files && new TextDecoder().decode(files[1].bytes()) === HTML);
check("and a stored one too", !!files && new TextDecoder().decode(files[3].bytes()) === SVG);
check("bytes that are not a zip are not a zip", readZip(new TextEncoder().encode("<!doctype html><p>hi")) === null);

const gate = checkZip(files, HARBOUR.length);
check("the page is the index.html, in the folder it is in", gate.ok && gate.entry === "harbour/index.html" && gate.dir === "harbour/", JSON.stringify(gate));
check("a zip with no page in it is refused, and says what it wants", (() => { const g = checkZip([{ name: "a.css", size: 10 }], 100); return !g.ok && g.why === "no-page" && /index\.html/.test(g.says); })());
check("a file that climbs out of the zip refuses the whole zip", (() => { const g = checkZip([{ name: "index.html", size: 10 }, { name: "../etc/passwd", size: 10 }], 100); return !g.ok && g.why === "bad-path"; })());
check("so does an absolute path", !insideZip("/etc/passwd") && !insideZip("C:\\x") && insideZip("a/b/c.css"));
check("too many files is not one page", (() => { const g = checkZip(Array.from({ length: MAX_FILES + 1 }, (_, i) => ({ name: `f${i}.html`, size: 1 })), 100); return !g.ok && g.why === "too-many"; })());
check("and a zip that unpacks to a disk is refused before it does", (() => { const g = checkZip([{ name: "index.html", size: 90_000_000 }], 1000); return !g.ok && g.why === "too-big"; })());
check("every refusal has words a person can act on", Object.values(ZIP_REFUSAL_SAYS).every((s) => s.length > 20 && !/—/.test(s)));
check("index.html nearest the root wins over one deeper", pageEntry(["site/deep/index.html", "site/index.html", "site/about.html"]) === "site/index.html");
check("with no index, the one page there is", pageEntry(["out/about.html"]) === "out/about.html");

const names = new Set(files.map((f) => f.name));
check("a request from the page finds its stylesheet next to it", fileFor("harbour/css/style.css", names, "harbour/") === "harbour/css/style.css");
check("a root-relative request is read against the page's folder", fileFor("/img/quay.svg", names, "harbour/") === "harbour/img/quay.svg");
check("a request for something not in the zip gets nothing", fileFor("/img/other.svg", names, "harbour/") === null && fileFor("../../etc/passwd", names, "harbour/") === null);
check("and a request with a query still finds the file", fileFor("css/style.css?v=3", names, "harbour/") === "harbour/css/style.css");
check("what is served is served as what it is, and the unknown is not served", contentType("a/b.css")?.startsWith("text/css") && contentType("x.svg") === "image/svg+xml" && contentType("run.exe") === null);
const quiet = sansScripts(HTML);
check("the page is opened with its scripts taken out, every one", !/<script/i.test(quiet) && !/onclick/i.test(quiet) && hadScripts(HTML) && !hadScripts(quiet));
check("and everything else left as it was", /<h1>Everything <abbr title="gets there">arrives<\/abbr> somewhere<\/h1>/.test(quiet) && /Start free/.test(quiet));

/* The whole page as blocks: the outermost bands, top to bottom, the
   wrapper that holds them all set aside. */
const listed = [
  { selector: "main", what: "a box on the page", box: { x: 0, y: 0, w: 1280, h: 1400 }, words: "all" },
  { selector: "header", what: "the bar across the top", box: { x: 0, y: 0, w: 1280, h: 72 }, words: "Harbour" },
  { selector: ".hero", what: "a first screen", box: { x: 0, y: 72, w: 1280, h: 488 }, words: "Everything" },
  { selector: ".hero h1", what: "a box on the page", box: { x: 32, y: 136, w: 500, h: 100 }, words: "Everything" },
  { selector: ".cards", what: "a band across the page", box: { x: 0, y: 560, w: 1280, h: 200 }, words: "Quiet" },
  { selector: "footer", what: "the foot of the page", box: { x: 0, y: 760, w: 1280, h: 90 }, words: "Harbour Freight" },
];
const blocks = pageBlocks(listed);
check("a page taken whole is its bands top to bottom, not its wrapper and not what is inside a band",
  blocks.map((b) => b.selector).join(",") === "header,.hero,.cards,footer", blocks.map((b) => b.selector).join(","));
/* A real page, as CSS Zen Garden listed: the same box under three names,
   and the main column holding its sections beside the header. */
const zen = [
  { selector: "#container", what: "the top of the page", box: { x: 0, y: 0, w: 1280, h: 3000 }, words: "all" },
  { selector: "main", what: "a first screen", box: { x: 0, y: 320, w: 1280, h: 2600 }, words: "So what" },
  { selector: "header", what: "the top of the page", box: { x: 0, y: 0, w: 1280, h: 310 }, words: "CSS Zen Garden" },
  { selector: "header > div", what: "the top of the page", box: { x: 0, y: 0, w: 1280, h: 310 }, words: "CSS Zen Garden" },
  { selector: "h1", what: "the top of the page", box: { x: 0, y: 1, w: 1279, h: 309 }, words: "CSS Zen Garden" },
  { selector: "#zen-preamble", what: "a first screen", box: { x: 0, y: 320, w: 1280, h: 700 }, words: "So what" },
  { selector: "#zen-supporting", what: "a band across the page", box: { x: 0, y: 1040, w: 1280, h: 1800 }, words: "Participation" },
  { selector: "footer", what: "the foot of the page", box: { x: 0, y: 2860, w: 1280, h: 140 }, words: "By Dave Shea" },
];
/* And a section is not opened into its paragraphs. */
zen.push(
  { selector: "#zen-preamble h3", what: "a box on the page", box: { x: 0, y: 330, w: 1280, h: 24 }, words: "So what" },
  { selector: "#zen-preamble p:nth-of-type(1)", what: "a box on the page", box: { x: 0, y: 360, w: 1280, h: 90 }, words: "There is" },
  { selector: "#zen-preamble p:nth-of-type(2)", what: "a box on the page", box: { x: 0, y: 460, w: 1280, h: 90 }, words: "The Zen" },
  { selector: "#zen-preamble p:nth-of-type(3)", what: "a box on the page", box: { x: 0, y: 560, w: 1280, h: 90 }, words: "Littering" },
);
/* And where a page's sections have no box of their own, so its paragraphs
   are top-level boxes, a run of them down one column is one band. */
const loose = [
  { selector: "header", what: "the top of the page", box: { x: 0, y: 0, w: 1280, h: 310 }, words: "CSS Zen Garden" },
  { selector: "h3.a", what: "a box on the page", box: { x: 100, y: 330, w: 360, h: 18 }, words: "So What" },
  { selector: "p.a1", what: "a box on the page", box: { x: 100, y: 360, w: 360, h: 70 }, words: "There is" },
  { selector: "p.a2", what: "a box on the page", box: { x: 100, y: 440, w: 360, h: 88 }, words: "allows" },
  { selector: "aside", what: "a first screen", box: { x: 600, y: 330, w: 235, h: 423 }, words: "Mid Century" },
  { selector: "h3.b", what: "a box on the page", box: { x: 100, y: 700, w: 360, h: 18 }, words: "The Road" },
  { selector: "p.b1", what: "a box on the page", box: { x: 100, y: 730, w: 360, h: 88 }, words: "Littering" },
  { selector: "footer", what: "the foot of the page", box: { x: 0, y: 900, w: 1280, h: 44 }, words: "By Dave" },
];
const looseBlocks = pageBlocks(loose);
check("paragraphs with no section box of their own are one band per run, each member remembered",
  looseBlocks.map((b) => (b.members ? `[${b.members.join("+")}]` : b.selector)).join(",") === "header,[h3.a+p.a1+p.a2],aside,[h3.b+p.b1],footer",
  looseBlocks.map((b) => (b.members ? `[${b.members.join("+")}]` : b.selector)).join(","));
const merged = mergeReadings([
  { box: { x: 100, y: 330, w: 360, h: 18 }, text: [{ words: "So What", px: 29, weight: 400, y: 0 }], links: [], buttons: [], images: [], children: [], layout: { flow: "row", columns: 1, gap: 0 }, paint: { bg: "rgba(0, 0, 0, 0)" } },
  { box: { x: 100, y: 360, w: 360, h: 70 }, text: [{ words: "There is", px: 16, weight: 400, y: 0 }], links: [{ words: "CSS", href: "https://x" }], buttons: [], images: [], children: [], layout: { flow: "row", columns: 1, gap: 0 }, paint: { bg: "rgb(1, 2, 3)" } },
]);
check("and a run's readings merge into one: the boxes united, the words in order, the first's paint",
  merged.box.y === 330 && merged.box.h === 100 && merged.text.map((t) => t.words).join("|") === "So What|There is" && merged.links.length === 1 && merged.paint.bg === "rgba(0, 0, 0, 0)" && merged.children.length === 2, JSON.stringify(merged.box));
const zenBlocks = pageBlocks(zen).map((b) => b.selector).join(",");
check("one box under three names is one block, and a column holding its sections is opened into them",
  zenBlocks === "header,#zen-preamble,#zen-supporting,footer", zenBlocks);
/* The same page as it is really laid out: the intro's summary and preamble
   float, so the column after it begins beside them, 310 down, and its box
   is stretched up over the intro's. The Requirements section's paragraphs
   are tall, and its box is grown to hold them. Read whole, the page is
   its sections, one under the next, and Requirements is one of them. */
const laid = [
  { selector: "body > div", what: "the top of the page", box: { x: 0, y: 0, w: 1280, h: 3299 }, words: "all" },
  { selector: "#zen-supporting", what: "a first screen", box: { x: 0, y: 310, w: 1280, h: 2989 }, words: "So What" },
  { selector: "#zen-requirements", what: "a band across the page", box: { x: 0, y: 2002, w: 1280, h: 1121 }, words: "Requirements" },
  { selector: "#zen-intro", what: "the top of the page", box: { x: 0, y: 0, w: 1280, h: 823 }, words: "CSS Zen Garden" },
  { selector: "#zen-participation", what: "a band across the page", box: { x: 0, y: 1248, w: 1280, h: 501 }, words: "Participation" },
  { selector: "header", what: "the top of the page", box: { x: 0, y: 0, w: 1280, h: 310 }, words: "CSS Zen Garden" },
  { selector: "#zen-explanation", what: "a first screen", box: { x: 0, y: 823, w: 845, h: 425 }, words: "So What" },
  { selector: "#design-selection", what: "a first screen", box: { x: 854, y: 360, w: 426, h: 769 }, words: "Select a Design" },
  { selector: "#zen-benefits", what: "a band across the page", box: { x: 0, y: 1749, w: 1280, h: 253 }, words: "Benefits" },
  { selector: "#zen-preamble", what: "a first screen", box: { x: 0, y: 498, w: 845, h: 325 }, words: "The Road" },
  { selector: "footer", what: "the foot of the page", box: { x: 0, y: 3123, w: 1280, h: 176 }, words: "HTML CSS" },
  { selector: "#zen-requirements p:nth-of-type(2)", what: "a paragraph", box: { x: 0, y: 2243, w: 845, h: 240 }, words: "Luckily" },
  { selector: "#zen-requirements p:nth-of-type(4)", what: "a paragraph", box: { x: 0, y: 2595, w: 845, h: 208 }, words: "This is a learning" },
  { selector: "#zen-requirements p:nth-of-type(5)", what: "a paragraph", box: { x: 0, y: 2803, w: 1280, h: 320 }, words: "By Dave Shea" },
  { selector: "#zen-summary", what: "a band across the page", box: { x: 0, y: 310, w: 845, h: 188 }, words: "A demonstration" },
  { selector: "#zen-requirements p:nth-of-type(1)", what: "a paragraph", box: { x: 0, y: 2099, w: 845, h: 144 }, words: "Where possible" },
  { selector: "#zen-requirements p:nth-of-type(3)", what: "a paragraph", box: { x: 0, y: 2483, w: 845, h: 112 }, words: "We ask" },
  { selector: "#zen-requirements h3", what: "a heading", box: { x: 0, y: 2066, w: 845, h: 33 }, words: "Requirements" },
];
const laidBlocks = pageBlocks(laid).map((b) => b.selector).join(",");
check("a column stretched up beside the floats of the section before it is still opened into its sections",
  /^header,#zen-summary,#design-selection,#zen-preamble,#zen-explanation,#zen-participation,#zen-benefits,#zen-requirements,footer$/.test(laidBlocks), laidBlocks);
check("and a section of tall paragraphs is one band, not a heading and its paragraphs", !/p:nth-of-type|h3/.test(laidBlocks) && /#zen-requirements/.test(laidBlocks), laidBlocks);
const fit = fitToSurface({ x: 100, y: 200, w: 640, h: 300 }, 1280, blocks.map((b) => b.box));
check("laid on the surface at the width it was drawn, the surface grows to the page's proportion", fit.surface.w === 640 && fit.surface.h === 425 && fit.scale === 0.5, JSON.stringify(fit.surface));
check("and every block keeps its place and size as a share of the page", fit.places[0].h === 36 && fit.places[1].y === 236 && fit.places[3].y === 580 && fit.places[3].h === 45, JSON.stringify(fit.places));
check("what reached the bar is said plainly, and so is what did not",
  /3 of 4 blocks from harbour\.zip are real parts of the library \(a top bar, a first screen, cards\)/.test(saidOf([{ id: "top-bar", sure: 1, wantsPicture: false }, { id: "hero", sure: 0.8, wantsPicture: true }, { id: "cards", sure: 1, wantsPicture: false }, { id: "prose", sure: 0.5, wantsPicture: false }], "harbour.zip", true))
  && /1 arrived as a band of words/.test(saidOf([{ id: "prose", sure: 0.5, wantsPicture: false }, { id: "button", sure: 1, wantsPicture: false }], "x.zip"))
  && /1 holds a picture that stays a placeholder/.test(saidOf([{ id: "hero", sure: 0.8, wantsPicture: true }], "x.zip"))
  && !/grounded step can make|put .* in the order/.test(saidOf([{ id: "hero", sure: 0.8, wantsPicture: true }], "x.zip"))
  && /scripts, which were not run/.test(saidOf([{ id: "hero", sure: 0.8, wantsPicture: false }], "x.zip", true)));
check("the bar the catalogue sets is the one this reads", SURE === SURE_ENOUGH);

/* ------------------------------------------------------------------ */
/* 2. The route: the page opened with every request answered from the zip */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const own = await browser.newPage();
await own.goto(`${BUILDER}/builder`, { waitUntil: "domcontentloaded" });
const post = (bytes, name, extra = {}) => own.evaluate(async ([url, b64, name, extra]) => {
  try {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.set("zip", new File([bin], name, { type: "application/zip" }), name);
    for (const [k, v] of Object.entries(extra)) form.set(k, v);
    const r = await fetch(`${url}/api/studio/zip`, { method: "POST", body: form });
    return await r.json();
  } catch (e) { return { ok: false, message: String(e) }; }
}, [BUILDER, bytes.toString("base64"), name, extra]);

const listing = await post(HARBOUR, "harbour.zip");
check("the route opens the page in the zip and lists what is worth pointing at", listing.ok === true && Array.isArray(listing.candidates) && listing.candidates.length >= 4, listing.ok ? `${listing.candidates.length} candidates in ${listing.took}s` : listing.message);
check("naming the file it opened", listing.entry === "harbour/index.html", listing.entry);
/* A first screen marked up as a header, the way page builders do, is named
   a first screen, so the name agrees with the part it becomes. */
check("a tall banner is named a first screen, not the bar across the top", listing.candidates.some((c) => /^Everything arrives/.test(c.words) && c.what === "a first screen" && c.box.h > 300) && listing.candidates.some((c) => c.what === "the bar across the top" && c.box.h === 72),
  listing.candidates.filter((c) => /^Everything arrives|^Harbour/.test(c.words)).map((c) => `${c.what} ${c.box.h}`).join(" | "));
/* A section whose paragraphs float has a box that collapses to its heading,
   30px tall over four paragraphs of 130. It is read where its words are. */
const terms = listing.candidates.find((c) => c.selector === ".terms" || /^Terms of carriage/.test(c.words));
check("a section whose paragraphs float is read where its words are, not at the box that collapsed to its heading", !!terms && terms.box.h >= 30 + 4 * 130 && terms.box.h < 30 + 4 * 130 + 40, terms ? `${terms.box.h} tall` : "not listed");
check("and its paragraphs are named paragraphs, so a person reading the list knows them for what they are", listing.candidates.filter((c) => /^(Where possible|Luckily|We ask|This is a shared)/.test(c.words)).every((c) => c.what === "a paragraph"), listing.candidates.filter((c) => /^(Where possible|Luckily)/.test(c.words)).map((c) => c.what).join(" | "));
check("with a picture of the page as it looks", typeof listing.page?.shot === "string" && listing.page.shot.length > 1000);
check("and it says the page brought scripts, which were not run", listing.scripts === true);
check("the picture pointing at the network did not hold the read up", Number(listing.took) < 15, `${listing.took}s`);
const measured = await post(HARBOUR, "harbour.zip", { selectors: JSON.stringify(["header", ".hero", ".cards", ".side"]) });
check("several blocks are measured in one go", measured.ok === true && measured.readings?.length === 4, measured.ok ? "" : measured.message);
/* What is behind a block is read too: the body's colour and the body's picture. */
const cardsRead = measured.readings?.[2];
check("a block that paints nothing of its own is read with the page's colour behind it", cardsRead?.paint?.behind === "rgb(255, 255, 255)", cardsRead?.paint?.behind);
check("and the page's own picture behind it, marked as behind", cardsRead?.images?.some((im) => im.behind && im.ground && /quay\.svg$/.test(im.src)), JSON.stringify(cardsRead?.images?.map((i) => [i.src.split("/").pop(), !!i.behind])));
const bar = measured.readings?.[0];
check("the bar is painted the colour its own stylesheet says, so the stylesheet was found in the zip", bar?.paint?.bg === "rgb(17, 19, 31)", bar?.paint?.bg);
check("and the picture inside the first screen was found there too", measured.readings?.[1]?.images?.some((im) => im.w === 640), JSON.stringify(measured.readings?.[1]?.images?.map((i) => [i.w, i.h])));
check("the script that would have emptied the page did not run", bar?.text?.some((t) => t.words === "Harbour"));
check("every block says whose it was, by the zip's name", measured.readings.every((r) => r.from?.host === "harbour.zip" && r.from.url.startsWith("zip:")));
const notZip = await post(Buffer.from("<!doctype html><p>hi"), "page.html");
check("a file that is not a zip is refused in words", notZip.ok === false && notZip.reason === "not-a-zip", notZip.message);
const climbs = await post(zip([{ name: "index.html", data: "<p>hi" }, { name: "../up.html", data: "<p>up" }]), "climb.zip");
check("a zip that climbs out of itself is refused before it is opened", climbs.ok === false && climbs.reason === "bad-path", climbs.message);
const noPage = await post(zip([{ name: "a.css", data: "body{}" }]), "styles.zip");
check("a zip with no page is refused, and says what it wants", noPage.ok === false && noPage.reason === "no-page", noPage.message);

/* ------------------------------------------------------------------ */
/* 3. By hand: from a drawn space to parts he can move and prompt        */
/* ------------------------------------------------------------------ */

const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${BUILDER}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
if (SHOTS) mkdirSync("docs/shots", { recursive: true });
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `docs/shots/zip-${n}.png` }); };
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});

const PANE = await page.locator("[data-ctx='studio-canvas']").first().boundingBox();
const draw = async (pts, step = 12) => {
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts) { await page.mouse.move(x, y); await page.waitForTimeout(step); }
  await page.mouse.up();
  await page.waitForTimeout(450);
};
const box = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
const B = { x: PANE.x + 300, y: PANE.y + 90, w: 520, h: 200 };
await page.mouse.move(PANE.x + PANE.width / 2, PANE.y + PANE.height / 2);
await page.keyboard.press("s");
await page.waitForTimeout(300);
await draw(box(B.x, B.y, B.w, B.h));
await page.keyboard.press("v");
await page.waitForTimeout(1900);
await page.locator("[data-space-fill]").first().click({ force: true });
await page.waitForTimeout(400);
const panel = page.locator("[data-space-panel]");
check("the space's panel has a well for a zip beside the address", (await panel.locator("[data-zip-file]").count()) === 1);
await panel.locator("[data-zip-file]").setInputFiles({ name: "harbour.zip", mimeType: "application/zip", buffer: HARBOUR });
const takeAll = panel.locator("[data-site-take-all]");
await takeAll.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
check("the zip is opened and the page shown, with the whole page on offer", (await takeAll.count()) === 1 && (await panel.locator("[data-site-shot]").count()) === 1, (await panel.locator("[data-site-said]").innerText().catch(() => "")).slice(0, 120));
check("and it says how many blocks the page is", /Take the whole page, [3-6] blocks/.test(await takeAll.innerText()), await takeAll.innerText());
await shot("offered");

const before = await state();
await takeAll.click();
const said = panel.locator("[data-site-said]");
await said.waitFor({ state: "visible", timeout: 45_000 }).catch(() => undefined);
const line = await said.innerText().catch(() => "");
check("the page lands, and the panel says which blocks are real parts and which are less", /of \d blocks from harbour\.zip are real parts of the library/.test(line), line);
check("naming them", /a top bar/.test(line) && /a first screen/.test(line) && /cards/.test(line) && /a list of links/.test(line), line);
check("a sidebar of links is a list of links, every link a line", (await state()).nodes.some((n) => n.featureId === "scrollspy-nav" && n.content === "Getting started\nThe API\nQuestions\nStatus"),
  JSON.stringify((await state()).nodes.filter((n) => n.featureId === "scrollspy-nav").map((n) => n.content)));
check("and that the page's scripts were not run", /scripts, which were not run/.test(line));
const termsParts = (await state()).nodes.filter((n) => /Where possible|Luckily|We ask|This is a shared/.test(n.content ?? ""));
/* One part, its heading first and its paragraphs after it in order. The
   band-of-words entry keeps three lines under the heading, so the fourth
   paragraph is the catalogue's to lose, not the reading's. */
check("a section whose paragraphs float lands as one part, its heading and its paragraphs in it, not a heading and four parts",
  termsParts.length === 1 && /^Terms of carriage\nWhere possible[^]*\nLuckily[^]*\nWe ask/.test(termsParts[0].content), `${termsParts.length} parts: ${JSON.stringify(termsParts.map((n) => [n.featureId, n.content]))}`);
const after = await state();
const space = after.spaces[0];
const parts = after.nodes.filter((n) => !before.nodes.some((b) => b.id === n.id));
check("every block is a part on the board", parts.length >= 5, `${parts.length} parts`);
check("each a real part of the library, not a picture with fields on it", parts.every((n) => !n.custom && !n.code && typeof n.content === "string" && n.content.length > 0), parts.map((n) => n.featureId).join(", "));
check("named for what it is and whose it was", parts.some((n) => n.label === "Top bar from harbour.zip") && parts.some((n) => n.label === "First screen from harbour.zip"), parts.map((n) => n.label).join(" | "));
check("with the page's own words in it, a line whole whatever is marked up inside it", parts.some((n) => /Product\nPricing\nDocs/.test(n.content)) && parts.some((n) => /^Everything arrives somewhere\n/.test(n.content)), parts.map((n) => n.content.split("\n")[0]).join(" | "));
check("and a prompt of its own, ready to steer", parts.every((n) => /Recreated from harbour\.zip/.test(n.prompt)));
const bb = space.boundary;
const bx = Math.min(...bb.map((p) => p[0])), by = Math.min(...bb.map((p) => p[1]));
const bw = Math.max(...bb.map((p) => p[0])) - bx, bh = Math.max(...bb.map((p) => p[1])) - by;
check("the surface took the page's proportion at the width it was drawn", bh > bw * 0.55 && Math.abs(bw - (before.spaces[0] ? Math.max(...before.spaces[0].boundary.map((p) => p[0])) - Math.min(...before.spaces[0].boundary.map((p) => p[0])) : bw)) < 3, `${Math.round(bw)}×${Math.round(bh)}`);
const topBar = parts.find((n) => n.label === "Top bar from harbour.zip");
check("the top bar is at the top of the surface, the full width, as it was on the page", !!topBar && topBar.y - by < 6 && Math.abs(topBar.w - bw) < 6, topBar ? `at ${Math.round(topBar.y - by)} down, ${topBar.w} of ${Math.round(bw)} wide` : "no top bar");
check("and the layout is locked as the page had it", Array.isArray(space.locked) && space.locked.length === parts.length && space.form?.p === 1, `${space.locked?.length ?? 0} locked, form ${space.form?.p}`);
check("every part is inside the surface, so the space's plan reaches it", parts.every((n) => n.x + n.w / 2 > bx && n.x + n.w / 2 < bx + bw && n.y + n.h / 2 > by && n.y + n.h / 2 < by + bh));
await shot("landed");

/* Now the bar itself: what he did not make, handled like what he drew. */
const barEl = page.locator(`[data-node-id="${topBar?.id}"]`);
const barBox = await barEl.boundingBox();
check("the top bar is on the board where the surface put it", !!barBox && barBox.width > 100, barBox ? `${Math.round(barBox.width)} wide on screen` : "not on screen");
await page.mouse.click(barBox.x + barBox.width / 2, barBox.y + barBox.height / 2);
await page.waitForTimeout(400);
const own2 = page.locator(`[data-space-panel="${topBar?.id}"]`);
check("picked, it has the same panel a drawn part in a space has", (await own2.count()) === 1);
check("which says what it is and where it came from", (await own2.locator("[data-space-what]").inputValue()) === "Top bar from harbour.zip" && /harbour\.zip/.test(await own2.locator("[data-space-asked]").inputValue()));
check("with a model and steps, because it has a plan like anything drawn", !/^No model/.test((await own2.locator("[data-space-model]").innerText()).trim()) && (await own2.locator("[data-space-step]").count()) >= 3);
await own2.locator("[data-space-asked]").fill("Make it the bar for a bakery, warm and low");
await page.waitForTimeout(300);
check("and he can prompt it, in its own words", (await state()).nodes.find((n) => n.id === topBar.id)?.prompt === "Make it the bar for a bakery, warm and low");
await page.mouse.move(barBox.x + barBox.width / 2, barBox.y + barBox.height / 2);
await page.mouse.down();
await page.mouse.move(barBox.x + barBox.width / 2 + 40, barBox.y + barBox.height / 2 + 30, { steps: 8 });
await page.mouse.move(barBox.x + barBox.width / 2 + 80, barBox.y + barBox.height / 2 + 60, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(400);
const moved = (await state()).nodes.find((n) => n.id === topBar.id);
check("and move it, like anything drawn", !!moved && (moved.x !== topBar.x || moved.y !== topBar.y), moved ? `from ${topBar.x},${topBar.y} to ${moved.x},${moved.y}` : "gone");
await shot("prompted");
/* The space itself is a press away again: a made space has no fill and no
   key, so taking hold of its surface picks it, and its panel is back with
   Make it again on it. */
const grip = page.locator(`[data-space-grip="${space.id}"]`);
const gripBox = await grip.boundingBox();
if (gripBox) { await page.mouse.click(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2); await page.waitForTimeout(400); }
check("taking hold of the made surface picks the space again, and its panel is back with Make it again on it",
  !!gripBox && (await page.locator(`[data-space-panel="${space.id}"]`).count()) === 1 && /Make it again/.test(await page.locator("[data-space-generate]").innerText().catch(() => "")),
  gripBox ? `panel ${await page.locator(`[data-space-panel="${space.id}"]`).count()}, button "${(await page.locator("[data-space-generate]").innerText().catch(() => "none")).trim()}"` : "no grip on the surface");
const line2 = await page.locator("[data-space-panel] [data-site-said]").innerText().catch(() => "");
check("and the line about pictures says they stay placeholders, promising no step", !/grounded step can make|put .* in the order/.test(line) && /stays a placeholder/.test(line), line.slice(0, 200) + (line2 ? "" : ""));

/* ------------------------------------------------------------------ */
/* 4. One element, taken alone, fits the space it lands in               */
/* ------------------------------------------------------------------ */

/* A list of sixteen links measured 841 tall landed at its own size in a
   space 380 tall, was clamped to the top of the page, and fell outside
   the line: no space, no plan, no panel. One element taken alone is
   fitted to the space and lands inside it. */
const one = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await one.goto(`${BUILDER}/builder`, { waitUntil: "networkidle" });
await one.waitForTimeout(1200);
const onePane = await one.locator("[data-ctx='studio-canvas']").first().boundingBox();
const oneDraw = async (pts, step = 12) => {
  await one.mouse.move(pts[0][0], pts[0][1]);
  await one.mouse.down();
  for (const [x, y] of pts) { await one.mouse.move(x, y); await one.waitForTimeout(step); }
  await one.mouse.up();
  await one.waitForTimeout(450);
};
const S1 = { x: onePane.x + 300, y: onePane.y + 90, w: 360, h: 140 };
await one.mouse.move(onePane.x + onePane.width / 2, onePane.y + onePane.height / 2);
await one.keyboard.press("s");
await one.waitForTimeout(300);
await oneDraw(box(S1.x, S1.y, S1.w, S1.h));
await one.keyboard.press("v");
await one.waitForTimeout(1900);
await one.locator("[data-space-fill]").first().click({ force: true });
await one.waitForTimeout(400);
const onePanel = one.locator("[data-space-panel]");
await onePanel.locator("[data-zip-file]").setInputFiles({ name: "harbour.zip", mimeType: "application/zip", buffer: HARBOUR });
await onePanel.locator("[data-site-take-all]").waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
/* The first screen: 488 tall on the page, far taller than this space. */
const heroTake = onePanel.locator("[data-site-take]").filter({ hasText: "a first screen" }).first();
await heroTake.click();
await onePanel.locator("[data-site-said]").waitFor({ state: "visible", timeout: 45_000 }).catch(() => undefined);
const oneState = () => one.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const st1 = await oneState();
const landed1 = st1.nodes[0];
const sb1 = st1.spaces[0].boundary;
const sx0 = Math.min(...sb1.map((p) => p[0])), sy0 = Math.min(...sb1.map((p) => p[1]));
const sw = Math.max(...sb1.map((p) => p[0])) - sx0, sh = Math.max(...sb1.map((p) => p[1])) - sy0;
check("one element taken alone lands inside the space, fitted to it, keeping its proportion",
  !!landed1 && landed1.x + landed1.w / 2 > sx0 && landed1.x + landed1.w / 2 < sx0 + sw && landed1.y + landed1.h / 2 > sy0 && landed1.y + landed1.h / 2 < sy0 + sh && landed1.w <= sw && landed1.h <= sh && Math.abs(landed1.w / landed1.h - 1280 / 488) < 0.4,
  landed1 ? `${landed1.w}×${landed1.h} in a space ${Math.round(sw)}×${Math.round(sh)}` : "nothing landed");
const lb = await one.locator(`[data-node-id="${landed1?.id}"]`).boundingBox();
await one.mouse.click(lb.x + lb.width / 2, lb.y + lb.height / 2);
await one.waitForTimeout(400);
check("and so it has the space's panel, with a plan on it", (await one.locator(`[data-space-panel="${landed1?.id}"] [data-space-step]`).count()) >= 3);
await one.close();

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
