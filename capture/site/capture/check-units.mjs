/**
 * A HERO'S BACKGROUND LAYERS KEEP THE UNITS THEY WERE WRITTEN IN.
 *
 * THE OWNER'S REPORT, his published trump-morty-trorty.vercel.app against
 * trumpmorty.fun: on the live site the hero's sky, both deserts, the big
 * planet and the ringed planet are placed in the window's units and in
 * percentages of the hero, so at any window size or browser zoom they stay
 * where they belong while the content scales. The capture kept only the px
 * it measured at 1440 × 900, so at another width the planet was a huge disk
 * cut by a straight edge and the ringed planet sat on the TV's corner.
 *
 * A stand-in hero holds the site's own rules:
 *
 *   (1) a sky `inset: -6% -4%` with `background: … center/cover`;
 *   (2) a planet img `width: min(62vw, 860px); left: -16vw; top: -22vw`;
 *   (3) a ring img `width: min(22vw, 300px); right: 36%; top: 9%`;
 *   (4) a desert `left: -5%; right: -5%; bottom: 13%; height: 36%` with
 *       `background-size: auto 100%`;
 *   (5) a later, more specific rule in px wins over a vw one, as the
 *       cascade has it (the value kept is the one the browser used);
 *   (6) a rule inside a media query that does not match is not read;
 *   (7) a fixed layer in vh resolves against the window, not the hero;
 *   (8) an absolute box placed in px only (two background layers, their
 *       sizes left as the shorthand leaves them) carries no units at all.
 *
 * Each positioned element's authored left/top/right/bottom/width/height and
 * background size/position go to the capture as `au`, with the containing
 * block they resolve against; the converter writes them on the part as
 * `units`, naming that block by its selector and its part. Control: the
 * committed SOLCINERATOR captures still convert byte for byte.
 *
 *   node capture/site/capture/check-units.mjs
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
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Stand-in units</title>
<style>
  body{margin:0;font:16px/20px sans-serif;color:#111;background:#fff}
  .hero{position:relative;min-height:100vh;min-height:100svh;overflow:hidden;background:rgb(240,200,60);isolation:isolate}
  .layer{position:absolute;pointer-events:none}
  .sky{inset:-6% -4%;background:rgb(90,140,220) url(/p.png) center/cover}
  .planet{width:min(62vw,860px);height:400px;left:-16vw;top:-22vw;background:rgb(200,90,40)}
  .ring{width:min(22vw,300px);height:120px;right:36%;top:9%;background:rgb(120,60,160)}
  .far{left:-5%;right:-5%;bottom:13%;height:36%;background:rgb(210,150,70) url(/p.png) center bottom/auto 100% repeat-x}
  .hero .pinned{width:30vw}
  .hero div.pinned{width:240px;left:10%;top:40px;height:50px;background:rgb(10,200,200)}
  @media (max-width:500px){.ring{right:4%;top:14%}}
  .fixed{position:fixed;left:0;top:70vh;width:100%;height:10vh;background:rgb(30,30,30);z-index:5}
  .plain{position:absolute;left:30px;top:300px;width:90px;height:40px;background:linear-gradient(#0000,#0000),rgb(0,120,0)}
  .inner{position:relative;z-index:3;width:600px;margin:0 auto;padding-top:200px}
</style></head><body>
  <section class="hero">
    <div class="layer sky"></div>
    <div class="layer planet"></div>
    <div class="layer ring"></div>
    <div class="layer far"></div>
    <div class="layer pinned"></div>
    <div class="plain"></div>
    <div class="inner"><h1>TRUMP &amp; MORTY</h1></div>
  </section>
  <div class="fixed"></div>
  <div style="height:900px"></div>
</body></html>`;

const server = createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  if (req.url === "/p.png") { res.writeHead(200, { "content-type": "image/png" }); res.end(PNG); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const work = mkdtempSync(join(tmpdir(), "capture-units-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap0 = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "600", "--assets", assets, "--settle", "1"], { stdio: ["ignore", "pipe", "pipe"], env });
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
  p.on("close", (status) => resolve({ status, out, err }));
});
server.close();
check("the stand-in page was captured", cap0.status === 0 && existsSync(capFile), (cap0.err || cap0.out).trim().split("\n").pop());
writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [1000, 600], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the capture converts", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };
const byBg = (bg) => doc.nodes.find((n) => n.colour?.bg === bg);
const hero = doc.nodes.find((n) => /section$/.test(n.from?.selector ?? ""));
const u = (n) => n?.units ?? null;
const heroOf = (n) => !!hero && n?.units?.of?.selector === hero.from.selector && n.units.of.part === hero.id && n.units.of.by === "block"
  && JSON.stringify(n.units.of.box) === JSON.stringify([hero.x, hero.y, hero.w, hero.h]);

/* (1) */
const sky = doc.nodes.find((n) => n.picture && /div:nth-of-type\(1\)$/.test(n.from?.selector ?? ""));
check("(1) the sky keeps inset -6% -4% and its cover", u(sky)?.top === "-6%" && u(sky)?.bottom === "-6%" && u(sky)?.left === "-4%" && u(sky)?.right === "-4%" && u(sky)?.backgroundSize === "cover", JSON.stringify(u(sky)));
check("(1) …against the hero it sits in (its selector, its part, its box)", heroOf(sky), JSON.stringify([u(sky)?.of, hero && [hero.id, hero.from.selector, hero.x, hero.y, hero.w, hero.h]]));
/* (2) */
const planet = byBg("rgb(200, 90, 40)");
check("(2) the planet keeps min(62vw, 860px), -16vw and -22vw", u(planet)?.width === "min(62vw, 860px)" && u(planet)?.left === "-16vw" && u(planet)?.top === "-22vw", JSON.stringify(u(planet)));
check("(2) …and a px height is not a unit to keep", u(planet) && !("height" in u(planet)), JSON.stringify(u(planet)));
/* (3) */
const ring = byBg("rgb(120, 60, 160)");
check("(3) the ring keeps right 36%, top 9%, min(22vw, 300px)", u(ring)?.right === "36%" && u(ring)?.top === "9%" && u(ring)?.width === "min(22vw, 300px)" && heroOf(ring), JSON.stringify(u(ring)));
/* (4) */
const far = byBg("rgb(210, 150, 70)");
check("(4) the desert keeps -5% either side, bottom 13%, height 36%, and auto 100%", u(far)?.left === "-5%" && u(far)?.right === "-5%" && u(far)?.bottom === "13%" && u(far)?.height === "36%" && u(far)?.backgroundSize === "auto 100%", JSON.stringify(u(far)));
/* (5) */
const pinned = byBg("rgb(10, 200, 200)");
check("(5) the more specific px width wins over the vw one; its % left is kept", u(pinned)?.left === "10%" && !("width" in (u(pinned) ?? {})), JSON.stringify(u(pinned)));
/* (6) */
check("(6) a rule in a media query that does not match is not read (the ring is still right 36%)", u(ring)?.right === "36%" && u(ring)?.top === "9%", JSON.stringify(u(ring)));
/* (7) */
const fixed = byBg("rgb(30, 30, 30)");
check("(7) a fixed layer in vh resolves against the window", u(fixed)?.top === "70vh" && u(fixed)?.height === "10vh" && u(fixed)?.width === "100%" && u(fixed)?.of?.by === "viewport" && JSON.stringify(u(fixed)?.of?.box) === JSON.stringify([0, 0, 1000, 600]), JSON.stringify(u(fixed)));
/* (8) */
const plain = byBg("rgb(0, 120, 0)");
check("(8) a box placed in px only carries no units", !!plain && !("units" in plain), JSON.stringify(plain?.units));

/* Control */
const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
