/**
 * A ROUNDED BOX CUTS TO ITS CURVE; WHAT ANIMATES A TURN TURNS ABOUT ITS OWN
 * POINT, AND WHAT IT HOLDS TURNS WITH IT; A GRID THAT CENTRES ITS WORDS SAYS SO.
 *
 * THE OWNER'S REPORT, trumpmorty.fun against its copy:
 *   · the TV's picture stuck out past the screen's rounded corners, and the
 *     CA bar's yellow ends were square past the bar's rounding. The screen
 *     is `border-radius: 28px/34px; overflow: hidden` and the picture in it
 *     `scale(1.02)`; the bar is `border-radius: 16px; overflow: hidden`. The
 *     converter cut a child to the square of the box that clips it, and read
 *     one radius off an elliptical corner;
 *   · the antenna's rods swung through each other and the red balls stayed
 *     still, off the tips. Each rod is `transform-origin: bottom center`
 *     with keyframes `rotate(-24deg)`, and the ball is its `::after`. The
 *     transform was written about the rod's centre and the ball had no
 *     animation;
 *   · the emoji in each HOW TO BUY circle sat up and left: the circle is
 *     `display: grid; place-items: center` and `justify-items` was not read.
 *
 * A stand-in page with the site's own rules:
 *   (1) the square in the rounded screen is cut to the screen's inner curve,
 *       elliptical, in its own frame (23/1.02 across, 29/1.02 down);
 *   (2) the screen keeps both radii of its corners, and says it clips;
 *   (3) the bar's end cells are cut to the bar's inner curve;
 *   (4) control: the middle cell, clear of every corner, is not cut;
 *   (5) the rod is written about its own point (its foot), and says so;
 *   (6) the ball runs the rod's animation about the rod's foot;
 *   (7) control: a still child of a still box takes no animation;
 *   (8) the icon's grid says it centres across (`layout.items`);
 *   (9) a ribbon's words, a track slid inside a turned row, say they turn
 *       with the row and keep their own slide apart (`art.turnsWith`): drawn
 *       flat about their own centre they drifted off the band's middle as
 *       the window widened (the owner's ribbons, 12px at 2000);
 *   (10) control: what animates, what moves with it, and a part whose
 *       holder is not turned, say nothing of it;
 *   (11) control: the committed SOLCINERATOR captures convert byte for byte.
 *
 *   node capture/site/capture/check-clips-turns.mjs
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

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Stand-in TV</title>
<style>
  body{margin:0;font:16px/20px sans-serif;color:#111;background:rgb(240,200,60)}
  .tv{position:relative;margin:120px 0 0 100px;width:420px}
  .antenna{position:absolute;left:50%;top:-58px;width:0;height:60px}
  .antenna i{position:absolute;bottom:0;left:0;width:6px;height:90px;background:rgb(26,15,11);border-radius:4px;transform-origin:bottom center;transform:rotate(-32deg);animation:ant 3s ease-in-out infinite}
  .antenna i::after{content:"";position:absolute;top:-10px;left:-5px;width:16px;height:16px;border-radius:50%;background:rgb(210,60,52);border:3px solid rgb(26,15,11)}
  @keyframes ant{50%{transform:rotate(-24deg)}}
  .screen{position:relative;width:400px;height:400px;border:5px solid rgb(26,15,11);border-radius:28px/34px;overflow:hidden;background:rgb(0,0,0)}
  .pic{width:100%;height:100%;background:rgb(0,120,200);transform:scale(1.02)}
  .still{position:absolute;left:20px;top:20px;width:40px;height:40px;background:rgb(90,90,90)}
  .ca{display:flex;margin:40px 0 0 100px;width:552px;background:rgb(250,250,250);border:4px solid rgb(26,15,11);border-radius:16px;overflow:hidden}
  .ca span{padding:12px 14px 8px;font-size:20px}
  .ca .l{background:rgb(41,47,68);color:rgb(243,212,64)}
  .ca .v{flex:1}
  .ca .b{background:rgb(243,212,64)}
  .ico{width:68px;height:68px;display:grid;place-items:center;font-size:36px;background:rgb(250,250,250);border:4px solid rgb(26,15,11);border-radius:50%;margin:40px 0 0 100px}
  .tape{position:relative;height:150px;overflow:hidden;margin-top:40px}
  .row{position:absolute;left:-5%;right:-5%;top:28px;transform:rotate(-2.5deg);overflow:hidden;white-space:nowrap;background:rgb(200,40,40)}
  .track{display:inline-block;transform:translateX(-40px);font-size:30px;padding:12px 0 6px;color:rgb(255,255,255)}
  .foot{height:400px}
</style></head><body>
  <div class="tv"><div class="antenna"><i></i></div><div class="screen"><div class="pic"></div><div class="still"></div></div></div>
  <div class="ca"><span class="l">CA</span><span class="v">AezYBzTYAUw5gFN8</span><span class="b">COPY</span></div>
  <div class="ico">👛</div>
  <div class="tape"><div class="row"><div class="track">$TRORTY ✦ EYES WIDE OPEN ✦ $TRORTY ✦ EYES WIDE OPEN ✦ $TRORTY</div></div></div>
  <div class="foot"></div>
</body></html>`;

const server = createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const work = mkdtempSync(join(tmpdir(), "capture-clips-"));
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
const bg = (c) => doc.nodes.find((n) => n.colour?.bg === c);
const words = (n) => (typeof n?.content === "string" ? n.content : (n?.content ?? []).map((s) => s.text ?? "").join("")).trim();
const J = (x) => JSON.stringify(x);
/* inset(t r b l round a b c d / e f g h), as numbers. */
const cut = (s) => {
  const m = /^inset\(([^)]*?)(?:\s+round\s+([^/]+)\/([^)]+))?\)$/.exec(s ?? "");
  if (!m) return null;
  const nums = (x) => (x ?? "").trim().split(/\s+/).filter(Boolean).map(parseFloat);
  return { inset: nums(m[1]), rx: m[2] ? nums(m[2]) : null, ry: m[3] ? nums(m[3]) : null };
};
const near = (a, b, d = 0.6) => Math.abs(a - b) <= d;

const pic = bg("rgb(0, 120, 200)"), screen = bg("rgb(0, 0, 0)");
const c1 = cut(pic?.art?.clipPath);
check("(1) the square in the rounded screen is cut to the screen's inner curve, in its own frame (23/1.02 × 29/1.02)", !!c1?.rx && c1.rx.every((r) => near(r, 23 / 1.02)) && c1.ry.every((r) => near(r, 29 / 1.02)) && c1.inset.every((v) => near(v, 4, 0.5)), J(pic?.art));
check("(2) the screen keeps both radii of its elliptical corners, and says it clips", J(screen?.radii) === J([28, 28, 28, 28]) && J(screen?.radiiY) === J([34, 34, 34, 34]) && screen?.art?.overflow === "hidden", J({ radius: screen?.radius, radii: screen?.radii, radiiY: screen?.radiiY, art: screen?.art }));

const label = bg("rgb(41, 47, 68)"), btn = bg("rgb(243, 212, 64)"), value = doc.nodes.find((n) => words(n) === "AezYBzTYAUw5gFN8");
const cl = cut(label?.art?.clipPath), cb = cut(btn?.art?.clipPath);
check("(3) the bar's end cells are cut to the bar's inner curve (16 − 4 = 12)", !!cl?.rx && cl.rx.every((r) => near(r, 12)) && !!cb?.rx && cb.rx.every((r) => near(r, 12)) && cl.inset[0] <= 0.5 && cb.inset[0] <= 0.5, J({ label: label?.art, btn: btn?.art }));
check("(4) control: the middle cell, clear of every corner, is not cut", !!value && !value.art?.clipPath, J(value?.art));

const rod = doc.nodes.find((n) => /> i$/.test(n.from?.selector ?? "")), ball = doc.nodes.find((n) => /> i::after$/.test(n.from?.selector ?? ""));
const m = /^matrix\(([^)]*)\)$/.exec(rod?.art?.transform ?? "")?.[1].split(",").map(Number);
check("(5) the rod is written about its own point, its foot (3px 90px): a pure turn (caught between -32° and -24°), nothing slid", rod?.art?.origin === "3px 90px" && !!m && near(m[4], 0, 0.5) && near(m[5], 0, 0.5) && Math.atan2(m[1], m[0]) * 180 / Math.PI >= -33 && Math.atan2(m[1], m[0]) * 180 / Math.PI <= -23, J(rod?.art));
const [ox, oy] = (ball?.art?.origin ?? "").split(" ").map(parseFloat);
check("(6) the ball runs the rod's animation, about the rod's foot measured from its own box", ball?.motion?.animation?.[0]?.name === "ant" && ball?.art?.animation === "ant" && near(ball.x + ox, rod.x + 3) && near(ball.y + oy, rod.y + 90), J({ rod: [rod?.x, rod?.y], ball: [ball?.x, ball?.y], art: ball?.art, motion: ball?.motion }));
const still = bg("rgb(90, 90, 90)");
check("(7) control: a still child of a still box takes no animation", !!still && !still.motion?.animation && !still.art?.animation && !still.art?.origin, J({ art: still?.art, motion: still?.motion }));

const ico = doc.nodes.find((n) => words(n) === "👛");
check("(8) the icon's grid says it centres across as well as down", ico?.layout?.display === "grid" && ico.layout.items === "center" && ico.layout.align === "center", J(ico?.layout));

const row = bg("rgb(200, 40, 40)"), track = doc.nodes.find((n) => /EYES WIDE OPEN/.test(words(n)));
check("(9) the ribbon's words turn with their row, their own slide kept apart", !!row && track?.art?.turnsWith?.selector === row.from?.selector && /^matrix\(1, 0, 0, 1, -40, 0\)$/.test(track.art.turnsWith.own ?? ""), J({ row: row?.from?.selector, turnsWith: track?.art?.turnsWith }));
check("(10) control: the rod, its ball and the picture in the still screen say nothing of it", !rod?.art?.turnsWith && !ball?.art?.turnsWith && !pic?.art?.turnsWith, J([rod?.art?.turnsWith, ball?.art?.turnsWith, pic?.art?.turnsWith]));

/* Control */
const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("(11) control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
