/**
 * WHAT TRUMPMORTY.FUN AND SHARE.XYZ SHOWED THE CAPTURE DROPPING, once the
 * Builder side was fixed as far as it could be.
 *
 * A stand-in page holds one of each, the way the two sites have them:
 *
 *   (1) a button of three differently styled spans (trumpmorty's `.ca`:
 *       "CA" on yellow, the address on dark, "COPY" on yellow) — each span
 *       stays its own part in its own colours; a button of two alike spans
 *       and a button of an icon and one span still fold, as before;
 *   (2) a remote key `<a><small>00</small>HOME</a>`, and one whose small
 *       holds an icon (💊) — the small is its own line, the key keeps HOME
 *       where the page drew it;
 *   (3) pseudo-elements that draw: a timeline dot (`.ep::before`), a dot
 *       pattern (`::before` with a radial-gradient), an animated drip
 *       (`::after`) — each a part; a `::before` that draws nothing is none;
 *   (4) a progress fill a script grows only once the page is scrolled
 *       (width 0 at the top) — kept, at the width it grew to;
 *   (5) nav links to `#lore` — in-page anchors to the part that is
 *       `#lore`, not links to the home page;
 *   (6) a tilted ribbon (rotate(-2.5deg)) — its box is the untransformed
 *       one and the rotation travels, so its words sit on it; a fixed toast
 *       its transform holds below the window stays out, as before;
 *   (7) two pictures served from one path with different queries
 *       (`/_next/image?url=…`) and two from different paths with one file
 *       name — four pictures, four different files;
 *   (8) a carousel wider than its `overflow: hidden` track — a card past
 *       the edge is not drawn, one across it is clipped; and a headline in
 *       a `relative` box after an `absolute` backdrop paints over it;
 *   (9) one face file declared for two weights — carried once;
 *  (10) a stylesheet and a picture whose first transfer is cut mid-way (as
 *       the proxy cut share.xyz's) — asked for again before the dump, so
 *       the page is measured in its own clothes;
 *  (11) a QR code drawn by an svg through its <defs> (share.xyz's: rects
 *       filled `url(#spot)` and clipped `url(#dots)`) — carried whole as
 *       an svg picture, since its strokes alone draw a blank square;
 *  (12) a button whose first line is folded into it and whose other lines
 *       are parts of their own (share.xyz's "Download the App" card) — its
 *       words set where that first line was, not centred over the others.
 *
 * Captured with `capture-route.mjs` and converted with
 * `capture-to-document.mjs`, as every page is. Control: the committed
 * SOLCINERATOR captures still convert to the committed document byte for
 * byte.
 *
 *   node capture/site/capture/check-capture-fixes.mjs
 */
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

const svg = (w, h, fill) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`);
const PICS = {
  "/_next/image?url=%2Fa.png&w=64": svg(30, 30, "#f00"),
  "/_next/image?url=%2Fb.png&w=64": svg(40, 40, "#0f0"),
  "/a/logo.svg": svg(50, 50, "#00f"),
  "/b/logo.svg": svg(60, 60, "#ff0"),
  "/backdrop.svg": svg(600, 200, "#063"),
};
const FONT = Buffer.from("wOF2-stand-in-variable");

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Stand-in fixes</title>
<link rel="stylesheet" href="/cut.css">
<style>
  @font-face{font-family:"Blob";src:url(/blob.woff2) format("woff2");font-weight:400}
  @font-face{font-family:"Blob";src:url(/blob.woff2) format("woff2");font-weight:700}
  @keyframes drip{0%,100%{height:10px}50%{height:20px}}
  body{margin:0;font:16px/20px sans-serif;color:#111;background:#fff}
  header{height:50px;display:flex;gap:10px;align-items:center;padding:0 10px}
  header a{color:#111}
  .ca{display:flex;align-items:center;gap:0;border:4px solid #111;background:#fff;padding:0;width:420px;overflow:hidden;font:inherit}
  .ca__label{padding:12px 14px 8px;background:rgb(243,212,64);color:rgb(26,15,11);font-size:20px}
  .ca__value{padding:8px 14px;color:rgb(41,47,68);font-family:monospace;font-size:18px;flex:1}
  .ca__btn{padding:12px 16px 8px;background:rgb(137,206,188);color:rgb(26,15,11);font-size:18px;border-left:4px solid #111}
  .two{background:#222;color:#fff;border:0;padding:8px 12px;font:inherit}
  .icon{display:flex;gap:8px;align-items:center;background:#eee;border:0;padding:6px 10px;font:inherit}
  .keys{display:flex;gap:12px;margin:20px 0}
  .key{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:160px;height:100px;background:rgb(243,212,64);color:rgb(26,15,11);text-decoration:none;font:22px/1.05 serif;border:4px solid #111;border-radius:22px;position:relative;overflow:hidden}
  .key small{font-family:monospace;font-size:26px;line-height:1;color:rgb(200,20,20)}
  .key::before{content:"";position:absolute;left:8px;right:8px;top:6px;height:28%;border-radius:14px;background:rgba(255,255,255,.35);pointer-events:none}
  .eps{display:flex;gap:40px;padding-top:60px;position:relative}
  .line{position:absolute;left:0;right:0;top:0;height:14px;border:3px solid #111;overflow:hidden}
  .line i{display:block;height:100%;width:0;background:rgb(120,200,60)}
  .ep{position:relative;width:200px;height:100px;background:#fec;border:4px solid #111}
  .ep::before{content:"";position:absolute;top:-47px;left:50%;width:22px;height:22px;margin-left:-11px;border-radius:50%;background:rgb(243,212,64);border:4px solid rgb(26,15,11)}
  .ep::after{content:"";position:absolute;top:0;left:0}
  .dots{position:relative;height:120px;background:rgb(234,130,154)}
  .dots::before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(199,74,62,.35) 2px,transparent 2.5px);background-size:26px 26px;pointer-events:none}
  .drip{position:relative;display:inline-block;padding:10px 20px;background:rgb(137,206,188);font-size:30px}
  .drip::after{content:"";position:absolute;top:100%;left:40%;width:14px;height:14px;background:rgb(120,200,60);border:3px solid #111;border-top:0;animation:drip 2.8s ease-in-out infinite}
  .tape{position:relative;height:150px;overflow:hidden;margin-top:40px}
  .tape__row{position:absolute;left:-5%;right:-5%;top:50px;background:rgb(210,60,52);border-block:4px solid #111;transform:rotate(-2.5deg);white-space:nowrap;overflow:hidden}
  .tape__track{display:inline-block;font-size:32px;line-height:40px;padding:12px 0 6px;color:#fff;transform:translateX(-300px)}
  .pics img{display:inline-block;margin-right:10px}
  .car{width:300px;overflow:hidden;display:flex;gap:20px;margin-top:20px}
  .card{flex:none;width:200px;height:80px;background:rgb(30,90,160);color:#fff}
  .hero{position:relative;height:200px;width:600px;margin-top:20px;background:rgb(7,39,35)}
  .hero img{position:absolute;inset:0;width:600px;height:200px}
  .hero .copy{position:relative;padding:60px 20px}
  .hero h1{margin:0;font-size:40px;color:color(srgb 1 1 1 / 0.9)}
  .w4{font-family:"Blob",sans-serif;font-weight:400}
  .w7{font-family:"Blob",sans-serif;font-weight:700}
  .toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,220px) rotate(-2deg);background:rgb(1,2,3);color:#fff;padding:10px;pointer-events:none}
  .app{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:316px;padding:0;border:0;background:rgb(4,210,79);color:#fff;font:13px/16px sans-serif}
  .app__big{font-size:17px;line-height:20px;font-weight:700;display:flex;flex-direction:column}
  .tall{height:1400px}
  section{min-height:60px}
</style></head>
<body>
  <header><a href="#lore">Lore</a><a href="#buy">How to buy</a><a href="#">Top</a><a href="/elsewhere">Else</a></header>
  <button class="ca"><span class="ca__label">CA</span><span class="ca__value">AezYBzTYAUw5pump</span><span class="ca__btn">COPY</span></button>
  <button class="two"><span>Buy</span> <span>now</span></button>
  <button class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="6"/></svg><span>Save</span></button>
  <div class="keys"><a class="key" href="/home"><small>00</small>HOME</a><a class="key" href="/pill"><small>💊</small>PILL</a></div>
  <section id="lore"><div class="eps"><div class="line"><i id="fill"></i></div><article class="ep">One</article><article class="ep">Two</article></div></section>
  <div class="dots"></div>
  <div class="drip">SLIME</div>
  <div class="tape"><div class="tape__row"><div class="tape__track">$TRORTY ✦ EYES WIDE OPEN ✦ TRUMP ✦ $TRORTY ✦ EYES WIDE OPEN ✦ TRUMP ✦ $TRORTY ✦ EYES WIDE OPEN ✦ TRUMP ✦ $TRORTY ✦ EYES WIDE OPEN ✦ TRUMP</div></div></div>
  <div class="pics"><img src="/_next/image?url=%2Fa.png&w=64" alt="a"><img src="/_next/image?url=%2Fb.png&w=64" alt="b"><img src="/a/logo.svg" alt="c"><img src="/b/logo.svg" alt="d"></div>
  <div class="car"><div class="card">One</div><div class="card">Two</div><div class="card">Three</div></div>
  <div class="hero"><img src="/backdrop.svg" alt=""><div class="copy"><h1>Make Predictions</h1></div></div>
  <section id="buy"><p class="w4">Light words</p><p class="w7">Bold words</p></section>
  <div class="tall"></div>
  <div class="toast">Copied</div>
  <div class="cutbox"></div><img class="cutimg" src="/cut.svg" alt="cut">
  <svg class="qr" width="98" height="98" viewBox="0 0 100 100"><defs><clipPath id="dots"><rect x="10" y="10" width="10" height="10"/><rect x="40" y="20" width="10" height="10"/><rect x="70" y="60" width="10" height="10"/></clipPath><linearGradient id="spot"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#333"/></linearGradient></defs><rect width="100" height="100" fill="#fff"/><rect width="100" height="100" clip-path="url(#dots)" fill="url(#spot)"/></svg>
  <svg class="chev" width="16" height="16" viewBox="0 0 64 64"><defs><clipPath id="whole"><path d="M0 0h64v64H0z"/></clipPath></defs><g clip-path="url(#whole)"><path d="m25 14 20 19-20 20" stroke="#333" stroke-width="4" fill="none"/></g></svg>
  <button class="app"><span class="app__eyebrow">Download the App</span><span class="app__big"><span>Markets Move Fast.</span><span>So Should You.</span></span></button>
  <script>
    /* The fill grows with the scroll, as trumpmorty's roadmap line does: nothing at the top. */
    const fill = document.getElementById("fill");
    addEventListener("scroll", () => { fill.style.width = Math.min(100, Math.max(0, (scrollY - 100) / 4)) + "%"; }, { passive: true });
  </script>
</body></html>`;

/* The first transfer of each of these is cut mid-body, as the proxy cut share.xyz's. */
const CUT = { "/cut.css": ["text/css", Buffer.from(".cutbox{width:77px;height:33px;background:rgb(9,99,199)}")], "/cut.svg": ["image/svg+xml", svg(45, 45, "#abc")] };
const cutOnce = new Set();
const server = createServer((req, res) => {
  if (CUT[req.url]) {
    const [type, body] = CUT[req.url];
    if (!cutOnce.has(req.url)) { cutOnce.add(req.url); res.writeHead(200, { "content-type": type, "content-length": String(body.length + 500), "cache-control": "no-store" }); res.write(body.subarray(0, 10)); setTimeout(() => res.socket.destroy(), 50); return; }
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" }); res.end(body); return;
  }
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  if (req.url === "/blob.woff2") { res.writeHead(200, { "content-type": "font/woff2" }); res.end(FONT); return; }
  const pic = PICS[req.url];
  if (pic) { res.writeHead(200, { "content-type": "image/svg+xml" }); res.end(pic); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const work = mkdtempSync(join(tmpdir(), "capture-fixes-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap0 = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "600", "--assets", assets, "--settle", "2"], { stdio: ["ignore", "pipe", "pipe"], env });
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
  p.on("close", (status) => resolve({ status, out, err }));
});
server.close();
check("the stand-in page was captured", cap0.status === 0 && existsSync(capFile), (cap0.err || cap0.out).trim().split("\n").pop());
const cap = existsSync(capFile) ? JSON.parse(readFileSync(capFile, "utf8")) : { tree: { kids: [] } };

writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [1000, 600], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the capture converts", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };

const all = [];
(function walk(e, parent) { e.parent = parent; all.push(e); (e.kids ?? []).forEach((k) => walk(k, e)); })(cap.tree, null);
const words = (n) => (typeof n?.content === "string" ? n.content : (n?.content ?? []).map((s) => s.text ?? "").join("")).trim();
const nodeOf = (re) => doc.nodes.find((n) => re.test(words(n)));
const nodesOf = (re) => doc.nodes.filter((n) => re.test(words(n)));
const bySel = (re) => doc.nodes.filter((n) => re.test(n.from?.selector ?? ""));

/* (1) Styled children stay apart; alike ones still fold. */
const caLabel = nodesOf(/^CA$/), caValue = nodesOf(/^AezYBzTYAUw5pump$/), caBtn = nodesOf(/^COPY$/);
check("(1) the .ca button is not one run: no part reads all three spans", !doc.nodes.some((n) => /CA.*Aez.*COPY/.test(words(n))), JSON.stringify(doc.nodes.filter((n) => /COPY/.test(words(n))).map((n) => words(n))));
check("(1) …\"CA\" is its own part, dark on yellow, at its own box", caLabel.length === 1 && caLabel[0].colour?.bg === "rgb(243, 212, 64)" && caLabel[0].colour?.text === "rgb(26, 15, 11)" && caLabel[0].w > 0 && caLabel[0].w < 100, JSON.stringify(caLabel.map((n) => [n.colour, n.x, n.w])));
check("(1) …the address is its own part in its own ink", caValue.length === 1 && caValue[0].colour?.text === "rgb(41, 47, 68)" && caValue[0].x > caLabel[0]?.x, JSON.stringify(caValue.map((n) => [n.colour, n.x])));
check("(1) …\"COPY\" is its own part on its own teal, with its left edge alone (an inset line, the one side polio can draw)", caBtn.length === 1 && caBtn[0].colour?.bg === "rgb(137, 206, 188)" && caBtn[0].edge?.width === 0 && /^inset 4px 0 0 0 rgb\(17, 17, 17\)$/.test(caBtn[0].edge?.shadow ?? "") && caBtn[0].pad?.left === 20, JSON.stringify(caBtn.map((n) => [n.colour, n.edge, n.pad])));
const caBox = bySel(/button(:nth-of-type\(1\))?$/).find((n) => n.w === 420);
check("(1) …and the button keeps its white fill and edge, drawing no words over them", !!caBox && !words(caBox) && caBox.colour?.bg === "rgb(255, 255, 255)" && caBox.edge?.width === 4, JSON.stringify(caBox && [caBox.featureId, caBox.content, caBox.colour, caBox.edge]));
const two = nodeOf(/^Buy\s*now$/);
check("(1) control: a button of two alike spans still folds into one part reading their words", two?.featureId === "cta-primary" && !nodesOf(/^Buy$/).length, JSON.stringify(two && [two.featureId, two.content]));
const save = nodeOf(/^Save$/);
check("(1) control: a button of an icon and one span still folds the span", save?.featureId === "cta-primary" && doc.nodes.some((n) => n.featureId === "drawn-icon"), JSON.stringify(save && [save.featureId, save.content]));

/* (2) The small line is kept. */
const home = nodeOf(/^HOME$/), zero = nodeOf(/^00$/), pill = nodeOf(/^💊$/);
check("(2) the key's <small>00</small> is its own part", !!zero && zero.colour?.text === "rgb(200, 20, 20)" && /small$/.test(zero.from?.selector ?? ""), JSON.stringify(zero && [zero.content, zero.colour, zero.from?.selector]));
check("(2) …the icon in a small (💊) too", !!pill && /small$/.test(pill.from?.selector ?? ""), JSON.stringify(pill && [pill.content, pill.from?.selector]));
check("(2) …and the key keeps HOME, set where the page drew it: below the small, not centred over it", home?.featureId === "cta-primary" && !!zero && home.y + (home.pad?.top ?? 0) >= zero.y + zero.h - 2, JSON.stringify(home && [home.y, home.pad, zero?.y, zero?.h]));

/* (3) Pseudo-elements that draw. */
const dots = bySel(/::before$/).filter((n) => /ep/.test(n.from?.selector ?? "") || n.w === 22 + 8);
const epDots = bySel(/article(:nth-of-type\(\d\))?::before$/);
check("(3) each roadmap card's ::before dot is a part: 30×30, round, yellow, edged", epDots.length === 2 && epDots.every((n) => n.w === 30 && n.h === 30 && n.colour?.bg === "rgb(243, 212, 64)" && n.edge?.width === 4 && n.radius >= 15), JSON.stringify(epDots.map((n) => [n.x, n.y, n.w, n.h, n.colour, n.edge, n.radius])) || JSON.stringify(dots));
const epCards = bySel(/article(:nth-of-type\(\d\))?$/);
/* Where the browser puts it: top -47px and left 50% of the card's padding box (inside its 4px edge), less its 11px margin. */
check("(3) …standing 47px above its card, at left 50% less its margin", epDots.length === 2 && epDots.every((d, i) => d.y === epCards[i]?.y + 4 - 47 && d.x === epCards[i].x + 4 + (epCards[i].w - 8) / 2 - 11), JSON.stringify([epDots.map((n) => [n.x, n.y]), epCards.map((n) => [n.x, n.y, n.w])]));
const pattern = bySel(/div(:nth-of-type\(\d+\))?::before$/).find((n) => /radial-gradient/.test(n.art?.background ?? ""));
check("(3) the section's dot pattern (::before, radial-gradient) is a part with its gradient", !!pattern && pattern.art.backgroundOptions?.[0] === "26px 26px", JSON.stringify(pattern?.art));
const drip = bySel(/::after$/).find((n) => n.colour?.bg === "rgb(120, 200, 60)");
check("(3) the drip (::after) is a part with its animation", !!drip && drip.motion?.animation?.[0]?.name === "drip", JSON.stringify(drip && [drip.from.selector, drip.motion]));
check("(3) control: a ::after that draws nothing is no part", !bySel(/article(:nth-of-type\(\d\))?::after$/).length, JSON.stringify(bySel(/::after$/).map((n) => n.from.selector)));
check("(3) control: the key's gloss (::before, translucent white) is a part too", bySel(/a(:nth-of-type\(\d\))?::before$/).length === 2);

/* (4) The fill a script grows. */
const fill = all.find((e) => e.t === "i");
const fillNode = bySel(/ > i$/)[0];
check("(4) the progress fill (width 0 at the top, grown by the scroll) is captured", !!fill && fill.w > 0, JSON.stringify(fill && { w: fill.w, grown: fill.grown }));
check("(4) …and is a part with its green", !!fillNode && fillNode.w > 0 && fillNode.colour?.bg === "rgb(120, 200, 60)", JSON.stringify(fillNode && [fillNode.w, fillNode.colour]));

/* (5) In-page anchors. */
const lore = doc.nodes.find((n) => words(n) === "Lore");
const loreSection = bySel(/section(:nth-of-type\(1\))?$/)[0];
check("(5) the nav's #lore link goes to the part that is #lore, on this page", lore?.link?.kind === "node" && lore.link.target === loreSection?.id, JSON.stringify([lore?.link, loreSection?.id]));
const buy = doc.nodes.find((n) => words(n) === "How to buy");
check("(5) …#buy too", buy?.link?.kind === "node" && doc.nodes.find((n) => n.id === buy.link.target)?.from?.selector?.endsWith("section:nth-of-type(2)"), JSON.stringify(buy?.link));
check("(5) control: a bare # still goes nowhere, and /elsewhere stays an address", doc.nodes.find((n) => words(n) === "Top")?.link == null && doc.nodes.find((n) => words(n) === "Else")?.link?.kind === "url", JSON.stringify([doc.nodes.find((n) => words(n) === "Top")?.link, doc.nodes.find((n) => words(n) === "Else")?.link]));

/* (6) The tilted ribbon. */
const tape = bySel(/div(:nth-of-type\(\d+\))? > div$/).find((n) => n.colour?.bg === "rgb(210, 60, 52)");
const tapeBox = doc.nodes.find((n) => tape && n.from.selector === tape.from.selector.split(" > ").slice(0, -1).join(" > "));
const track = nodeOf(/TRORTY/);
check("(6) the ribbon's box is its own, not the box round its rotation: about 64px tall, 50px down its tape", !!tape && !!tapeBox && tape.h >= 60 && tape.h <= 70 && tape.y === tapeBox.y + 50, JSON.stringify(tape && [tape.y, tape.h, tapeBox?.y]));
check("(6) …and the rotation travels with it", /matrix\(0\.99/.test(tape?.art?.transform ?? ""), JSON.stringify(tape?.art));
check("(6) …its words sit on it: the track's box is inside the ribbon's and turns with it", !!track && !!tape && track.y >= tape.y && track.y + track.h <= tape.y + tape.h && /matrix\(0\.99/.test(track.art?.transform ?? ""), JSON.stringify(track && [track.y, track.h, track.art]));

/* The track is slid 300px left by its marquee: the window the page shows (the tape's 0–1000, inside the ribbon) is its local 300–1300 from a box that starts at -50, so about 350px in from its left edge, before the ribbon turns it. */
const cutAt = /^inset\(0px (\d+)px 0px (\d+)px\)$/.exec(track?.art?.clipPath ?? "");
check("(6) the marquee track's clip is worked out after its own slide: the window starts ~350px into its box, not 50", !!cutAt && Number(cutAt[2]) >= 335 && Number(cutAt[2]) <= 355 && track.w - Number(cutAt[1]) - Number(cutAt[2]) >= 990 && track.w - Number(cutAt[1]) - Number(cutAt[2]) <= 1030, JSON.stringify(track && [track.x, track.w, track.art?.clipPath]));
check("(6) control: a fixed toast its transform holds below the window is still no part, its box now untransformed", !doc.nodes.some((n) => n.colour?.bg === "rgb(1, 2, 3)"), JSON.stringify(doc.nodes.filter((n) => n.colour?.bg === "rgb(1, 2, 3)").map((n) => [n.x, n.y, n.art])));

/* (7) Pictures from one path. */
const pics = doc.nodes.filter((n) => n.featureId === "picture" && /img(:nth-of-type\(\d+\))?$/.test(n.from?.selector ?? "") && n.w <= 60 && n.picture?.w !== 45);
const sums = pics.map((n) => { const f = join(work, "out", n.picture.path); return existsSync(f) ? createHash("sha1").update(readFileSync(f)).digest("hex") : null; });
check("(7) four pictures from /_next/image?… and */logo.svg are four different files", pics.length === 4 && new Set(sums).size === 4 && sums.every(Boolean), JSON.stringify(pics.map((n, i) => [n.w, n.picture?.path, sums[i]?.slice(0, 8)])));
check("(7) …each the size it was served at", JSON.stringify(pics.map((n) => n.picture?.w).sort()) === JSON.stringify([30, 40, 50, 60]), JSON.stringify(pics.map((n) => n.picture?.w)));

/* (8) Clipping, and the headline over its backdrop. */
const cards = ["One", "Two", "Three"].map((w) => doc.nodes.find((n) => words(n) === w && n.colour?.bg === "rgb(30, 90, 160)"));
check("(8) the card wholly past the track's edge is not drawn", cards[0] && !cards[2], JSON.stringify(cards.map((c) => c && [c.x, c.w])));
check("(8) …the card across the edge is clipped at it", /^inset\(0px 120px 0px 0px\)$/.test(cards[1]?.art?.clipPath ?? ""), JSON.stringify(cards[1]?.art));
check("(8) …and the one inside it is not clipped", !cards[0]?.art?.clipPath, JSON.stringify(cards[0]?.art));
const headline = nodeOf(/^Make Predictions$/);
const backdrop = doc.nodes.find((n) => n.featureId === "picture" && n.w === 600);
check("(8) the headline paints over its absolute backdrop (after it in the stack)", !!headline && !!backdrop && doc.nodes.indexOf(headline) > doc.nodes.indexOf(backdrop), JSON.stringify([doc.nodes.indexOf(headline), doc.nodes.indexOf(backdrop)]));
check("(8) …in its own white, read from color(srgb 1 1 1 / 0.9) over the hero's green", headline?.colour?.text === "rgb(230, 233, 233)", JSON.stringify(headline?.colour));

/* (9) One face file, carried once. */
const blob = (doc.look?.fonts ?? []).filter((f) => f.family === "Blob");
check("(9) the face declared for two weights from one file is carried once", blob.length === 1 && blob[0].carried && blob[0].source?.kind === "data", JSON.stringify(blob.map((f) => [f.id, f.weight, f.source?.kind])));
check("(9) …covering both weights", blob[0]?.weight === "400 700", JSON.stringify(blob[0]?.weight));

/* (10) Cut on the way in, asked for again. */
const cutBox = doc.nodes.find((n) => n.colour?.bg === "rgb(9, 99, 199)");
check("(10) the stylesheet cut on its first transfer was fetched again: its box is there in its own size and fill", cutBox?.w === 77 && cutBox?.h === 33, JSON.stringify(cutBox && [cutBox.w, cutBox.h]) || `none; missing: ${JSON.stringify(cap.missing)}`);
const cutPic = doc.nodes.find((n) => n.featureId === "picture" && n.picture?.w === 45);
check("(10) …and the picture cut on its first transfer too, drawn at the size it loaded at", cutPic?.w === 45 && cutPic?.h === 45, JSON.stringify(cutPic && [cutPic.w, cutPic.h]));
check("(10) …so nothing is left missing", !cap.missing, JSON.stringify(cap.missing));

/* (11) An svg drawn through its <defs>. */
const qr = doc.nodes.find((n) => /svg(:nth-of-type\(\d+\))?$/.test(n.from?.selector ?? "") && n.w === 98);
const qrFile = qr?.picture && join(work, "out", qr.picture.path);
check("(11) the QR drawn through its <defs> is a picture of the svg itself", qr?.featureId === "picture" && qr.picture?.type === "image/svg+xml", JSON.stringify(qr && [qr.featureId, qr.picture]));
check("(11) …holding its clip-path and gradient, so its modules are drawn", !!qrFile && existsSync(qrFile) && /<clipPath id="dots"/.test(readFileSync(qrFile, "utf8")) && /url\(#spot\)|url\(&quot;#spot|url\("#spot/.test(readFileSync(qrFile, "utf8")), qrFile && existsSync(qrFile) ? readFileSync(qrFile, "utf8").slice(0, 300) : "no file");
check("(11) control: a plain line icon is still a drawn icon", doc.nodes.some((n) => n.featureId === "drawn-icon"));
const chev = doc.nodes.find((n) => /svg(:nth-of-type\(\d+\))?$/.test(n.from?.selector ?? "") && n.w === 16 && n.y > 1000);
check("(11) control: an icon inside a clip-path that covers all of it (share.xyz's chevrons) is still a drawn icon", chev?.featureId === "drawn-icon", JSON.stringify(chev && [chev.featureId, chev.from.selector]));

/* (12) A button's folded first line, beside lines of their own. */
const app = doc.nodes.find((n) => words(n) === "Download the App");
const big = nodeOf(/^Markets Move Fast\.$/);
check("(12) the app card's words are set where its first line was: above the lines of their own, not centred over them", app?.featureId === "cta-primary" && !!big && app.y + (app.pad?.top ?? 0) + (app.h - (app.pad?.top ?? 0) - (app.pad?.bottom ?? 0)) <= big.y + 1, JSON.stringify(app && [app.y, app.h, app.pad, big?.y]));

/* Control: the committed SOLCINERATOR captures, untouched. */
const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
