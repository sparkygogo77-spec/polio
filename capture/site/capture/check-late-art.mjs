/**
 * WHAT GOTCHI.GG SHOWED THE CAPTURE LOSING: art a page paints late, or
 * paints in more than one colour, and a face declared twice under one name.
 *
 * A stand-in page holds one of each, the way gotchi.gg has them:
 *
 *   (1) a face from a cross-origin sheet (Google's Pixelify Sans, all of
 *       Latin), then a same-origin rule for the digits alone under the same
 *       family (`unicode-range: U+30-39`) — both carried, each its own entry
 *       with its range, in the order the page declared them, so the digits
 *       rule, declared last, still draws the digits;
 *   (2) a pixel icon a script swaps in after load (a 16×16 svg of 1×1 rects,
 *       each its own fill: `currentColor`, a hex, `var(--line)`) — carried as
 *       a picture of itself, every rect in its own colour, not a one-colour
 *       drawn icon;
 *   (3) a heart drawn as a colour through `mask-image` (a data: svg), with an
 *       `::after` in pink through another, and one whose mask is an address
 *       — each a picture of its colour through its mask, the addressed mask
 *       written in, not a square of the colour;
 *   (4) controls: a one-colour line icon is still a drawn icon; a plain
 *       coloured box is still a box;
 *   (5) a 12×9 canvas scaled up square (`image-rendering: pixelated`) whose
 *       script repaints it, a pet asleep and its Z rising, as gotchi.gg's
 *       device screen does — its frames played back as one svg at its box,
 *       each drawn square; a canvas drawn once stays one PNG, marked to be
 *       drawn square;
 *   (6) a pixel icon whose rects are painted by an inline style naming a
 *       variable (`style="fill:var(--line)"`, gotchi.gg's tombstone) — its
 *       picture holds the colours, not a variable the file alone lacks;
 *   (7) a numbered dot, a 44px grid centring "1" (`place-items: center`) —
 *       the words centred across, with the padding that stands the line in
 *       the middle.
 *
 *   node capture/site/capture/check-late-art.mjs
 */
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+2000-206F";
const LATIN_FILE = Buffer.from("wOF2-stand-in-latin-".repeat(40));
const DIGITS_FILE = Buffer.from("wOF2-stand-in-digits");
const HEART = (fill) => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 7' shape-rendering='crispEdges'%3E%3Cpath d='M1 0h2v1h2V0h2v1h1v3H7v1H6v1H5v1H3V6H2V5H1V4H0V1h1z' fill='${fill}'/%3E%3C/svg%3E`;
const HEART_FILE = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 7"><path d="M1 0h2v1h2V0h2v1h1v3H7v1H6v1H5v1H3V6H2V5H1V4H0V1h1z"/></svg>`);

/* The "font host": another origin, so its sheet is unreadable from the page, as Google's is. */
const fontHost = createServer((req, res) => {
  const origin = `http://127.0.0.1:${fontHost.address().port}`;
  if (req.url.startsWith("/css2")) { res.writeHead(200, { "content-type": "text/css" }); res.end(`@font-face{font-family:'Pixelify Sans';font-style:normal;font-weight:400 700;font-display:swap;src:url(${origin}/latin.woff2) format('woff2');unicode-range:${LATIN}}`); return; }
  if (req.url === "/latin.woff2") { res.writeHead(200, { "content-type": "font/woff2", "access-control-allow-origin": "*" }); res.end(LATIN_FILE); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => fontHost.listen(0, "127.0.0.1", r));
const fontOrigin = `http://127.0.0.1:${fontHost.address().port}`;

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Stand-in late art</title>
<link rel="stylesheet" href="${fontOrigin}/css2?family=Pixelify+Sans">
<link rel="stylesheet" href="/base.css">
<style>
  :root{--line:rgb(43, 29, 46)}
  body{margin:0;font:16px/20px sans-serif;color:rgb(43, 29, 46);background:#fff}
  .brand{font-family:"Pixelify Sans",monospace;font-size:24px;padding:10px}
  .slot{display:inline-block;width:32px;height:32px;margin:10px}
  .line{margin:10px}
  .hearts{display:flex;gap:6px;padding:10px}
  .hearts i{position:relative;display:block;width:24px;height:21px;background:rgb(43, 29, 46);-webkit-mask:url("${HEART("black")}") center/100% 100% no-repeat;mask:url("${HEART("black")}") center/100% 100% no-repeat}
  .hearts i::after{content:"";position:absolute;inset:3px;background:rgb(255, 92, 168);-webkit-mask:url("${HEART("black")}") center/100% 100% no-repeat;mask:url("${HEART("black")}") center/100% 100% no-repeat}
  .hearts b{display:block;width:24px;height:21px;background:rgb(255, 181, 38);-webkit-mask:url(/heart.svg) center/contain no-repeat;mask:url(/heart.svg) center/contain no-repeat}
  .plain{width:40px;height:20px;background:rgb(9, 99, 199);margin:10px}
</style></head>
<body>
  <a class="brand" href="/">gotchi 1,000</a>
  <span class="slot" id="slot"></span>
  <svg class="line" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="6"/></svg>
  <div class="hearts"><i></i><i></i><b></b></div>
  <div class="plain"></div>
  <svg class="tomb" viewBox="0 0 4 2" width="40" height="20" shape-rendering="crispEdges"><rect x="0" y="0" width="4" height="1" style="fill:var(--line)"/><rect x="0" y="1" width="4" height="1" style="fill:#8a9a8a"/></svg>
  <span class="dot" style="display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:rgb(255, 212, 59);font:700 24px/1 sans-serif">1</span>
  <span class="sticker" style="display:flex;align-items:center;justify-content:center;text-align:center;width:90px;height:90px;background:rgb(255, 212, 59);font:700 13px/1.1 sans-serif">genesis: pets 1 to 1,000</span>
  <svg class="mono" viewBox="0 0 10 2" width="40" height="8" shape-rendering="crispEdges">${Array.from({ length: 20 }, (_, i) => `<rect x="${i % 10}" y="${Math.floor(i / 10)}" width="1" height="1" fill="currentColor"/>`).join("")}</svg>
  <canvas id="lcd" width="12" height="9" style="width:96px;height:72px;image-rendering:pixelated;background:rgb(183, 197, 149);margin:10px"></canvas>
  <canvas id="still" width="6" height="6" style="width:48px;height:48px;image-rendering:pixelated;margin:10px"></canvas>
  <script>
    const g = lcd.getContext("2d");
    let z = 0;
    const draw = () => { g.clearRect(0, 0, 12, 9); g.fillStyle = "#1f2e1b"; g.fillRect(2, 5, 6, 3); g.fillRect(8 + (z % 2), 3 - (z % 2), 2, 1); z++; };
    draw(); setInterval(draw, 400);
    const s = still.getContext("2d"); s.fillStyle = "#f6c"; s.fillRect(1, 1, 4, 4);
  </script>
  <script>
    /* Swapped in once the page has loaded, as gotchi.gg's icons.js stamps its icons. */
    setTimeout(() => {
      const rect = (x, y, fill, style) => '<rect x="' + x + '" y="' + y + '" width="1" height="1"' + (style ? ' style="fill:' + style + '"' : ' fill="' + fill + '"') + '/>';
      let r = "";
      for (let x = 3; x < 13; x++) r += rect(x, 4, "currentColor");
      for (let x = 4; x < 12; x++) r += rect(x, 5, "#FFFFFF");
      for (let x = 4; x < 12; x++) r += rect(x, 6, "#FF5CA8");
      for (let x = 5; x < 11; x++) r += rect(x, 7, null, "var(--line)");
      document.getElementById("slot").innerHTML = '<svg class="icon" viewBox="0 0 16 16" width="32" height="32" shape-rendering="crispEdges">' + r + '</svg>';
    }, 600);
  </script>
</body></html>`;

const server = createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  if (req.url === "/base.css") { res.writeHead(200, { "content-type": "text/css" }); res.end(`@font-face{font-family:"Pixelify Sans";src:url(/fonts/digits.woff2) format("woff2");font-weight:400 700;unicode-range:U+30-39}`); return; }
  if (req.url === "/fonts/digits.woff2") { res.writeHead(200, { "content-type": "font/woff2" }); res.end(DIGITS_FILE); return; }
  if (req.url === "/heart.svg") { res.writeHead(200, { "content-type": "image/svg+xml" }); res.end(HEART_FILE); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const work = mkdtempSync(join(tmpdir(), "late-art-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap0 = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "800", "--height", "600", "--assets", assets, "--settle", "2"], { stdio: ["ignore", "pipe", "pipe"], env });
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
  p.on("close", (status) => resolve({ status, out, err }));
});
server.close(); fontHost.close();
check("the stand-in page was captured", cap0.status === 0 && existsSync(capFile), (cap0.err || cap0.out).trim().split("\n").pop());
const cap = existsSync(capFile) ? JSON.parse(readFileSync(capFile, "utf8")) : { tree: { kids: [] }, faces: { faces: [] } };

writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [800, 600], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the capture converts", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [], look: {} };
const fileOf = (n) => (n?.picture ? join(work, "out", n.picture.path) : null);
const textOf = (n) => { const f = fileOf(n); return f && existsSync(f) ? readFileSync(f, "utf8") : ""; };

/* (1) One family, two rules. */
const pix = cap.faces.faces.filter((f) => f.family === "Pixelify Sans");
check("(1) the capture keeps the page's order: the linked Latin rule before the digits rule declared after it", pix.length === 2 && /latin/.test(pix[0].sources[0].url) && /digits/.test(pix[1].sources[0].url), JSON.stringify(pix.map((f) => f.sources[0].url)));
const carried = (doc.look?.fonts ?? []).filter((f) => f.family === "Pixelify Sans");
check("(1) both files are carried, the Latin one as the face's letters", carried.length === 2 && carried.every((f) => f.carried) && carried.some((f) => f.bytes === LATIN_FILE.length && f.id === "font:pixelify-sans:400-700:normal"), JSON.stringify(carried.map((f) => [f.id, f.bytes, f.carried])));
check("(1) …each with its range, the digits last", carried[0]?.unicodeRange?.startsWith("U+0-FF") || carried[0]?.unicodeRange?.startsWith("U+0000") ? /U\+30-39/i.test(carried[1]?.unicodeRange ?? "") : false, JSON.stringify(carried.map((f) => f.unicodeRange)));

/* (2) The icon swapped in after load. */
const icon = doc.nodes.find((n) => /#slot > svg|span > svg|svg\.icon/.test(n.from?.selector ?? "") || (n.featureId !== "box" && n.w === 32 && n.h === 32 && n.y < 80));
const iconSvg = textOf(icon);
check("(2) the pixel icon swapped in after load is a picture of itself", icon?.featureId === "picture" && icon.picture?.type === "image/svg+xml", JSON.stringify(icon && [icon.featureId, icon.from?.selector, icon.vector?.paths?.length]));
check("(2) …every rect in its own colour: the hex, the white, and the ink var(--line) and currentColor resolve to", /rgb\(255, 92, 168\)/.test(iconSvg) && /rgb\(255, 255, 255\)/.test(iconSvg) && /rgb\(43, 29, 46\)/.test(iconSvg), iconSvg.slice(0, 300));

/* (3) The hearts. */
const pics = doc.nodes.filter((n) => n.featureId === "picture");
const hearts = pics.filter((n) => /<mask/.test(textOf(n)));
const HEARTS = ["rgb(43, 29, 46)", "rgb(255, 92, 168)", "rgb(255, 181, 38)"];
check("(3) each heart and its ::after is a picture of its colour through its mask (5: two hearts, two insides, one by address)", hearts.length === 5, JSON.stringify(pics.map((n) => [n.from?.selector, n.w, n.h])));
check("(3) …no square of a heart's colour is left, as a box or under a picture", !doc.nodes.some((n) => HEARTS.includes(n.colour?.bg)), JSON.stringify(doc.nodes.filter((n) => HEARTS.includes(n.colour?.bg)).map((n) => [n.featureId, n.from?.selector, n.w, n.h, n.colour?.bg])));
check("(3) …the pink inside keeps its pink", hearts.some((n) => /rgb\(255, 92, 168\)/.test(textOf(n))), hearts.map((n) => textOf(n).slice(0, 120)).join(" | "));
const byAddress = hearts.find((n) => /rgb\(255, 181, 38\)/.test(textOf(n)));
check("(3) …the mask given by address is written into the picture, not left as an address it cannot load", !!byAddress && /href="data:image\/svg\+xml;base64,/.test(textOf(byAddress)) && !/heart\.svg/.test(textOf(byAddress)), textOf(byAddress).slice(0, 300));

/* (4) Controls. */
check("(4) control: a one-colour line icon is still a drawn icon", doc.nodes.some((n) => n.featureId === "drawn-icon" && /svg/.test(n.from?.selector ?? "")), JSON.stringify(doc.nodes.map((n) => [n.featureId, n.from?.selector]).filter(([, s]) => /svg/.test(s ?? ""))));
check("(4) control: a plain coloured box is still a box", doc.nodes.some((n) => n.featureId === "box" && n.colour?.bg === "rgb(9, 99, 199)"));

/* (5) The canvas that repaints, and the one that does not. */
const lcdNode = doc.nodes.find((n) => n.featureId === "picture" && n.w === 96 && n.h === 72);
const lcdSvg = textOf(lcdNode);
check("(5) the repainted canvas is its frames, played back as one svg at its box", lcdNode?.picture?.type === "image/svg+xml" && (lcdSvg.match(/<image /g) ?? []).length === 2 && /@keyframes/.test(lcdSvg) && /infinite/.test(lcdSvg), JSON.stringify(lcdNode && [lcdNode.picture, (lcdSvg.match(/<image /g) ?? []).length]));
check("(5) …each frame drawn square, at the canvas's box, not its 12×9 pixels", /image-rendering:pixelated/.test(lcdSvg) && /width="96" height="72"/.test(lcdSvg), lcdSvg.slice(0, 300));
const stillNode = doc.nodes.find((n) => n.featureId === "picture" && n.w === 48 && n.h === 48);
check("(5) control: a canvas drawn once stays one PNG, marked to be drawn square", stillNode?.picture?.type === "image/png" && stillNode.picture.pixelated === true, JSON.stringify(stillNode?.picture));

/* (6) Paint by an inline style naming a variable. */
const tomb = doc.nodes.find((n) => n.featureId === "picture" && n.w === 40 && n.h === 20);
check("(6) an icon painted through style=\"fill:var(--line)\" keeps its ink in its picture", /fill:\s*rgb\(43, 29, 46\)/.test(textOf(tomb)) && !/var\(--line\)/.test(textOf(tomb)), textOf(tomb).slice(0, 300));
/* (7) Words their own grid centres. */
const dot = doc.nodes.find((n) => (typeof n.content === "string" ? n.content : "") === "1" && n.w === 44);
check("(7) a number its grid centres is centred across, and stood in the middle by its padding", dot?.text?.align === "center" && dot?.pad?.top === 10 && dot?.pad?.bottom === 10, JSON.stringify(dot && [dot.text, dot.pad, dot.h]));

const sticker = doc.nodes.find((n) => /^genesis/.test(typeof n.content === "string" ? n.content : ""));
check("(7) control: centred words in a box of several lines get no padding that would hold them to one", !!sticker && !(sticker.pad?.top > 0), JSON.stringify(sticker && [sticker.pad, sticker.h]));

/* (8) An icon is every shape it draws: none cut to a fragment (a row of a list of rows), which draws a dash. */
const mono = doc.nodes.find((n) => n.w === 40 && n.h === 8);
check("(8) a one-colour pixel icon of 20 rects keeps all 20 shapes", mono?.featureId === "drawn-icon" && mono.vector?.paths?.length === 20, JSON.stringify(mono && [mono.featureId, mono.vector?.paths?.length]));
const svgs = []; (function walk(e) { if (e.t === "svg") svgs.push(e); (e.kids ?? []).forEach(walk); })(cap.tree);
check("(8) …and no icon in the capture has fewer shapes than the page drew (none cut to its first row)", !svgs.some((e) => e.rows), JSON.stringify(svgs.filter((e) => e.rows).map((e) => e.rows)));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
