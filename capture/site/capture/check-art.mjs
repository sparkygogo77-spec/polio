/**
 * An artistic page keeps its clothes: its web fonts from a cross-origin
 * stylesheet, its background pictures and gradients, its transparency,
 * blending and filters, its outlined and shadowed type, its rotations, and
 * a picture that is not a PNG.
 *
 * A stand-in page is served on two hostnames of one local server, so its
 * font stylesheet is cross-origin the way Google Fonts is. It is captured
 * the way every page is (`capture-route.mjs`) and converted; then the
 * capture must hold the face with its file, the background picture's
 * address, the artistic properties, and the converter must decode the
 * WebP, carry the background picture, and keep the film-grain sheet as a fixed part that takes no clicks.
 *
 *   node capture/site/capture/check-art.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
const run = (args, stdio) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); if (stdio) c.stdout.pipe(process.stdout); });
import { imageSize } from "./image-size.mjs";
import { assetFile } from "./asset-name.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const dir = mkdtempSync(join(tmpdir(), "check-art-"));
/* A 1×1 PNG, a 1×1 lossless WebP, and a font file of stand-in bytes (the rule is what is read; the bytes are only fetched). */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");
const FONT = Buffer.from("wOF2-stand-in");
const files = {
  "/": ["text/html", `<!doctype html><html><head><link rel="stylesheet" href="http://localhost:PORT/fonts.css"><style>
    body{margin:0}
    .hero{position:relative;height:600px;background:url(/bg.png) center/cover, linear-gradient(#fff,#000);clip-path:polygon(0 0,100% 0,100% 90%,0 100%)}
    .behind{position:absolute;inset:0;z-index:-1;background:#f00}
    .lifted{position:relative;z-index:3}
    .planet{position:absolute;left:0;top:0;width:400px;height:400px;background:#fa0}
    .grain{position:fixed;inset:0;opacity:.05;mix-blend-mode:multiply;pointer-events:none;background:url(/bg.png)}
    .title{font-family:StandIn;font-size:80px;-webkit-text-stroke:4px #000;paint-order:stroke fill;text-shadow:6px 6px 0 #000;transform:rotate(-3deg);opacity:.9;filter:saturate(1.2)}
    .loader{position:fixed;inset:0;background:#000;animation:zoom 1s linear forwards}
    @keyframes zoom{from{transform:scale(1)}to{transform:scale(1.05)}}
    .reveal{opacity:0;transform:translateY(40px);transition:opacity .2s}
    .reveal.in{opacity:1;transform:none}
  </style></head><body>
    <div class="grain"></div>
    <div class="loader" id="loader"></div>
    <section class="hero"><div class="behind"></div><div class="lifted"><h1 class="title">Stand in</h1></div><div class="planet"></div><img src="/pic.webp" width="1" height="1" alt=""></section>
    <div style="height:1400px"></div>
    <p class="reveal" id="late">Late words</p>
    <script>
      setTimeout(() => document.getElementById("loader").remove(), 1500);
      new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in"))).observe(document.getElementById("late"));
    </script></body></html>`],
  "/fonts.css": ["text/css", `@font-face { font-family: 'StandIn'; font-style: normal; font-weight: 400; src: url(/standin.woff2) format('woff2'); }`],
  "/bg.png": ["image/png", PNG],
  "/pic.webp": ["image/webp", WEBP],
  "/standin.woff2": ["font/woff2", FONT],
};
const server = createServer((req, res) => {
  const [type, body] = files[req.url] ?? ["text/plain", ""];
  res.writeHead(files[req.url] ? 200 : 404, { "content-type": type, "access-control-allow-origin": "*" });
  res.end(typeof body === "string" ? body.replaceAll("PORT", String(server.address().port)) : body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1200, 800], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1200", "--height", "800", "--assets", assets, "--settle", "6"], true);
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets], false);
server.close();

const cap = JSON.parse(readFileSync(capture, "utf8"));
const els = []; (function g(e) { els.push(e); (e.kids ?? []).forEach(g); })(cap.tree);
const doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8"));
const fails = [];
const must = (ok, what) => { if (!ok) fails.push(what); };

/* (1) The cross-origin face, with its file fetched. */
const face = cap.faces.faces.find((f) => f.family === "StandIn");
must(face && face.sources.some((s) => /standin\.woff2$/.test(s.url)), "the cross-origin @font-face is read with its source");
/* Kept under the name of its address (asset-name.mjs). */
const fontFile = face && assetFile(assets, face.sources.find((s) => /standin\.woff2$/.test(s.url))?.url ?? "");
must(!!fontFile && readFileSync(fontFile).equals(FONT), "the font file is fetched into --assets");
/* (2) The background picture and gradient, and the file. */
const hero = els.find((e) => e.t === "section");
must(hero?.bgi && /bg\.png/.test(hero.bgi) && /linear-gradient/.test(hero.bgi), "background-image with its picture and gradient is recorded");
const bgFile = assetFile(assets, `http://127.0.0.1:${port}/bg.png`);
must(!!bgFile && imageSize(readFileSync(bgFile))?.w === 1, "the background picture is fetched into --assets");
must(doc.nodes.some((n) => n.picture && /\.png$/.test(n.picture.path) && /section$/.test(n.from?.selector ?? "")), "the converter carries the background picture as the box's picture");
/* (3) WebP decoded. */
must(imageSize(WEBP)?.type === "image/webp" && imageSize(WEBP).w === 1, "imageSize reads a WebP");
must(doc.nodes.some((n) => n.picture && /\.webp$/.test(n.picture.path) && n.picture.type === "image/webp"), "the converter carries a WebP picture");
/* (4) Opacity, blend, filter. */
const title = els.find((e) => e.t === "h1");
must(title?.op === 0.9 && title?.filter?.includes("saturate"), "opacity and filter are recorded");
const grainEl = els.find((e) => e.op === 0.05 && e.blend === "multiply");
must(grainEl, "mix-blend-mode is recorded");
/* The owner's ruling at 2000px: the grain is the page's texture. Kept as a fixed part with its picture that takes no clicks, so nothing is pinned under it (check-capture-2000.mjs (6)). */
const grainPart = doc.nodes.find((n) => n.from?.selector === "body > div:nth-of-type(1)" && n.from?.position === "fixed");
must(grainPart && grainPart.inert === true && grainPart.picture && grainPart.opacity === 0.05, "the 5% grain sheet is a fixed part with its picture that takes no clicks, so nothing is pinned under it");
/* (5) Text stroke, paint order, text shadow, transform. */
must(title?.tstroke?.w === 4 && /^stroke/.test(title?.porder ?? "") && /6px 6px/.test(title?.tsh ?? "") && /matrix/.test(title?.tf ?? ""), "text-stroke, paint-order, text-shadow and transform are recorded");
must(doc.nodes.some((n) => n.art?.textStroke && n.art?.transform), "the converter carries them as node.art");
/* (7) Clip-path recorded; a band behind the flow is written before it. */
must(/polygon/.test(hero?.clip ?? ""), "clip-path is recorded");
const behind = doc.nodes.findIndex((n) => /div:nth-of-type\(1\)$/.test(n.from?.selector ?? "") && n.from?.position === "absolute");
const titleAt = doc.nodes.findIndex((n) => /h1$/.test(n.from?.selector ?? ""));
must(behind >= 0 && titleAt >= 0 && behind < titleAt, "a negative z-index band is written before the flow it sits behind");
const planetAt = doc.nodes.findIndex((n) => /div:nth-of-type\(3\)$/.test(n.from?.selector ?? "") && n.from?.position === "absolute");
must(planetAt >= 0 && titleAt > planetAt, "a title under a `z-index: 3` ancestor is written after a z-auto band that comes later in the page (the planet behind the hero title)");
/* (6) Settled: the loader gone, the late section revealed. */
must(!els.some((e) => e.pos === "fixed" && e.bg === "rgb(0, 0, 0)" && e.w >= 1200), "the loader is gone before the dump");
const late = els.find((e) => e.text === "Late words");
must(late && late.op === undefined, "the reveal-on-scroll section was revealed before the dump");
/* (8) The page's own ids: thesolface's sections are `#top`, `#lore`, `#community`, and one with no heading is named by it. */
must(late?.domId === "late", "the element's id is recorded");
must(doc.nodes.some((n) => n.from?.id === "late" && /Late words/.test(String(n.content ?? ""))), "the converter keeps it on the part's `from`");

if (fails.length) { console.error("FAIL\n  " + fails.join("\n  ")); process.exit(1); }
console.log("ok: an artistic page keeps its clothes");
