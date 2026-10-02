/**
 * WHAT TRUMPMORTY.FUN AT 2000PX SHOWED THE CAPTURE STILL LOSING, found by
 * the polio lane once polio drew everything the document said.
 *
 * A stand-in page holds one of each, the way the site has them:
 *
 *   (1) words 30px: the size kept exactly, in px (a rem rounded to two
 *       places made 30px 29.95 and "Renewed for S2" stopped wrapping);
 *   (2) two boxes touching at a fractional edge: the edges rounded, not the
 *       sizes, so one ends where the next begins (no 1px line between);
 *   (3) a planet spinning with the `rotate` property: its layout size, not
 *       the box round it mid-turn;
 *   (4) a hero `min-height: 100vh`: the unit kept, not only its 900px;
 *   (5) a 0px-wide antenna holding two rods (turned −32° / +28°) with red
 *       ::after tips: the rods and tips kept though their holder has no box;
 *   (6) a fixed grain sheet (a picture, opacity .05, multiply, no clicks):
 *       a fixed part, not dropped;
 *   (7) a header a script gives `.scrolled` past 40px: the rules the class
 *       brings, with their declarations;
 *   (8) a key's gloss `::before` in rgba(255,255,255,.35): its alpha kept;
 *       and a button's gloss (`z-index: -1` inside an isolated button) drawn
 *       straight after the button, not under it;
 *   (9) a LIVE badge `<i></i> LIVE…`: its words start after the dot and the
 *       gap, where the page drew them;
 *  (10) a timeline fill a script grows with the scroll: the width it had
 *       with its section in view, not the largest ever seen;
 *  (11) a blinking LED (its animation holds opacity 0): kept; and the whole
 *       font stack, not only its first face;
 *  (12) a box with corners 48 48 70 70: all four kept; and a ribbon clipped
 *       by its tape keeps its drop shadow below it.
 *
 * Captured with `capture-route.mjs --behaviours` and converted. Control: the
 * committed SOLCINERATOR captures still convert byte for byte.
 *
 *   node capture/site/capture/check-capture-2000.mjs
 */
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Stand-in 2000</title>
<style>
  @keyframes spin{to{rotate:360deg}}
  @keyframes off{from,to{opacity:0}}
  body{margin:0;font:16px/20px sans-serif;color:#111;background:#fff}
  .hdr{position:fixed;top:0;left:0;right:0;height:40px;padding:14px 0;z-index:50}
  .hdr.scrolled{background:rgb(243,212,64);box-shadow:0 4px 0 rgb(26,15,11);padding-top:8px;padding-bottom:8px}
  .hero{min-height:100vh;background:rgb(240,200,60);position:relative}
  .big{font-size:30px;line-height:34px;margin:0;padding-top:80px}
  .planet{position:absolute;left:600px;top:120px;width:200px;height:100px;background:rgb(200,90,40);animation:spin 20s linear infinite;animation-delay:-2.5s}
  .antenna{position:absolute;left:400px;top:260px;width:0;height:60px}
  .antenna i{position:absolute;bottom:0;left:0;width:6px;height:90px;background:rgb(26,15,11);transform-origin:bottom center}
  .antenna i:first-child{transform:rotate(-32deg)}
  .antenna i:last-child{transform:rotate(28deg)}
  .antenna i::after{content:"";position:absolute;top:-10px;left:-5px;width:16px;height:16px;border-radius:50%;background:rgb(210,60,52);border:3px solid rgb(26,15,11)}
  .grain{position:fixed;inset:0;pointer-events:none;z-index:900;background:url(/grain.png);opacity:.05;mix-blend-mode:multiply}
  .a{position:absolute;left:0;width:300px;background:rgb(30,40,70)}
  .a1{top:700.3px;height:100.4px}
  .a2{top:800.7px;height:50px;background:rgb(200,200,200)}
  .keys{position:absolute;top:900px;left:0;display:flex;gap:20px}
  .key{position:relative;width:160px;height:100px;background:rgb(243,212,64);overflow:hidden}
  .key::before{content:"";position:absolute;left:8px;right:8px;top:6px;height:28%;background:rgba(255,255,255,.35);pointer-events:none}
  .btn{position:relative;isolation:isolate;display:inline-block;padding:16px 28px;background:rgb(166,216,111);font-size:22px}
  .btn::before{content:"";position:absolute;inset:6px 10px auto 10px;height:30%;background:rgba(255,255,255,.4);z-index:-1}
  .onair{position:absolute;top:1040px;left:0;display:inline-flex;align-items:center;gap:10px;padding:4px 14px 2px;background:rgb(26,15,11);color:rgb(184,255,106);font-family:monospace;font-size:24px}
  .onair i{width:12px;height:12px;border-radius:50%;background:rgb(255,75,62)}
  .eps{position:absolute;top:1400px;left:0;width:800px;height:400px}
  .line{position:absolute;left:0;right:0;top:0;height:14px;overflow:hidden}
  .line i{display:block;height:100%;width:0;background:rgb(120,200,60)}
  .led{position:absolute;top:1100px;left:0;width:16px;height:16px;border-radius:50%;background:rgb(255,75,62);animation:off 1.4s infinite}
  .mono{position:absolute;top:1130px;left:0;font-family:"VT323","Courier New",monospace;font-size:26px}
  .remote{position:absolute;top:1200px;left:0;width:300px;height:150px;background:rgb(41,47,68);border-radius:48px 48px 70px 70px}
  .tape{position:absolute;top:1900px;left:0;width:1000px;height:150px;overflow:hidden}
  .row{position:absolute;left:-5%;right:-5%;top:28px;height:50px;background:rgb(210,60,52);box-shadow:0 6px 0 rgba(0,0,0,.25);transform:rotate(-2deg)}
  .tall{position:absolute;top:2100px;height:1400px;width:10px}
</style></head>
<body>
  <header class="hdr"><span>Top</span></header>
  <section class="hero">
    <h3 class="big">Renewed for S2</h3>
    <div class="planet"></div>
    <div class="antenna"><i></i><i></i></div>
  </section>
  <div class="a a1"></div><div class="a a2"></div>
  <div class="keys"><a class="key" href="/k">KEY</a><a class="btn" href="/b"><span>BUY</span></a></div>
  <div class="onair"><i></i> LIVE FROM THE YELLOW DIMENSION</div>
  <span class="led"></span>
  <div class="mono">✈ TELEGRAM</div>
  <div class="remote"></div>
  <div class="eps" id="eps"><div class="line"><i id="fill"></i></div></div>
  <div class="tape"><div class="row">$TRORTY</div></div>
  <div class="tall"></div>
  <div class="grain"></div>
  <script>
    const hdr = document.querySelector(".hdr"), eps = document.getElementById("eps"), fill = document.getElementById("fill");
    const frame = () => {
      hdr.classList.toggle("scrolled", scrollY > 40);
      const r = eps.getBoundingClientRect(), vh = innerHeight;
      fill.style.width = Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (r.height + vh * 0.3))) * 100 + "%";
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  </script>
</body></html>`;

const server = createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  if (req.url === "/grain.png") { res.writeHead(200, { "content-type": "image/png" }); res.end(PNG); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const work = mkdtempSync(join(tmpdir(), "capture-2000-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap0 = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "600", "--assets", assets, "--settle", "2", "--behaviours"], { stdio: ["ignore", "pipe", "pipe"], env });
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
const words = (n) => (typeof n?.content === "string" ? n.content : (n?.content ?? []).map((s) => s.text ?? "").join("")).trim();
const byBg = (bg) => doc.nodes.filter((n) => n.colour?.bg === bg);
const bySel = (re) => doc.nodes.filter((n) => re.test(n.from?.selector ?? ""));

/* (1) */
const big = doc.nodes.find((n) => words(n) === "Renewed for S2");
check("(1) a 30px heading keeps 30px exactly: font.px 30, and a size that multiplies back to 30 without rounding", big?.font?.px === 30 && Math.abs(big.font.size * 16 * 1.6 - 30) < 1e-9, JSON.stringify(big?.font));
/* (2) */
const [a1] = byBg("rgb(30, 40, 70)"), [a2] = byBg("rgb(200, 200, 200)");
check("(2) two boxes that touch still touch: the first ends where the second begins", !!a1 && !!a2 && a1.y + a1.h === a2.y, JSON.stringify([a1 && [a1.y, a1.h], a2 && [a2.y, a2.h]]));
/* (3) */
const [planet] = byBg("rgb(200, 90, 40)");
check("(3) the spinning planet is its layout size, 200×100, not the box round it mid-turn", planet?.w === 200 && planet?.h === 100, JSON.stringify(planet && [planet.w, planet.h]));
/* (4) */
const hero = doc.nodes.find((n) => /section$/.test(n.from?.selector ?? ""));
check("(4) the hero's min-height is kept as 100vh, with the px it measured", hero?.vh?.minHeight === "100vh" && hero.vh.px === 600, JSON.stringify(hero?.vh));
/* (5) */
const rods = byBg("rgb(26, 15, 11)").filter((n) => n.w === 6 && n.h === 90);
check("(5) the antenna's two rods are parts though their holder is 0px wide", rods.length === 2 && rods.every((r) => /matrix/.test(r.art?.transform ?? "")), JSON.stringify(rods.map((r) => r.art)));
const tips = byBg("rgb(210, 60, 52)").filter((n) => /i(:nth-of-type\(\d\))?::after$/.test(n.from.selector));
check("(5) …with their red tips", tips.length === 2, JSON.stringify(tips.map((t) => t.from.selector)));
/* (6) */
const grain = doc.nodes.find((n) => n.picture && n.from?.position === "fixed");
check("(6) the grain sheet is a fixed part with its picture, opacity .05, multiply, taking no clicks", !!grain && grain.opacity === 0.05 && grain.art?.blend === "multiply" && grain.inert === true, JSON.stringify(grain && [grain.opacity, grain.art, grain.inert]));
/* (7) */
const sc = (doc.behaviours?.scrollClass ?? []).find((s) => s.class === "scrolled");
const rule = sc?.rules?.find((r) => /\.hdr\.scrolled/.test(r.selector));
check("(7) the scrolled header's class brings its rules: .hdr.scrolled with its background, shadow and padding", rule?.style?.background === "rgb(243, 212, 64)" && /0px 4px 0px/.test(rule?.style?.["box-shadow"] ?? "") && rule?.style?.["padding-top"] === "8px", JSON.stringify(sc?.rules ?? sc));
/* (8) */
const gloss = bySel(/a(:nth-of-type\(1\))?::before$/)[0];
check("(8) the key's gloss keeps its alpha: rgba(255, 255, 255, 0.35)", gloss?.colour?.bg === "rgba(255, 255, 255, 0.35)", JSON.stringify(gloss?.colour));
const btn = bySel(/a:nth-of-type\(2\)$/)[0];
const btnGloss = bySel(/a:nth-of-type\(2\)::before$/)[0];
check("(8) the button's gloss (z-index -1 inside an isolated button) is drawn straight after the button, not under it", !!btn && !!btnGloss && doc.nodes.indexOf(btnGloss) === doc.nodes.indexOf(btn) + 1, JSON.stringify([doc.nodes.indexOf(btn), doc.nodes.indexOf(btnGloss)]));
/* (9) */
const onair = doc.nodes.find((n) => /^LIVE FROM/.test(words(n)));
check("(9) the LIVE badge's words start after its dot and gap: pad.left 36 (14 + 12 + 10)", onair?.pad?.left === 36, JSON.stringify(onair?.pad));
/* (10) */
const fill = byBg("rgb(120, 200, 60)")[0];
check("(10) the timeline fill keeps the width it had with its section in view (not all 800px)", !!fill && fill.w > 200 && fill.w < 760, JSON.stringify(fill && fill.w));
/* (11) */
const led = byBg("rgb(255, 75, 62)").find((n) => n.w === 16);
check("(11) the LED whose animation holds it at opacity 0 is kept, at its own opacity", !!led && (led.opacity === undefined || led.opacity === 1), JSON.stringify(led && [led.w, led.opacity]));
const mono = doc.nodes.find((n) => /TELEGRAM/.test(words(n)));
check("(11) the whole font stack is kept: VT323, then Courier New, then monospace", /VT323.*Courier New.*monospace/.test(mono?.font?.stack ?? ""), JSON.stringify(mono?.font));
/* (12) */
const [remote] = byBg("rgb(41, 47, 68)");
check("(12) the remote keeps all four corners, 48 48 70 70", JSON.stringify(remote?.radii) === JSON.stringify([48, 48, 70, 70]), JSON.stringify(remote && [remote.radius, remote.radii]));
const [row] = byBg("rgb(210, 60, 52)").filter((n) => n.h === 50);
const bottom = Number(/^inset\(\S+ \S+ (-?[\d.]+)px/.exec(row?.art?.clipPath ?? "")?.[1]);
check("(12) the ribbon's clip leaves room for its drop shadow below it (a negative bottom inset)", !!row && bottom <= -6, JSON.stringify(row?.art));

/* Control */
const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
