/**
 * THE COMPARISON TOOLS TELL A COPY'S FAULTS FROM THE ORIGINAL.
 *
 * Two stand-in pages, served locally: the original (a sticker resting at a
 * 4px shadow and lifting to 7px when hovered, pushed to 1px when pressed; a
 * rounded bar clipping its square COPY end; a loader switched off 1.2 s
 * after the navigation; a ribbon stepped 0.6 px a frame) and a copy with
 * each of trumpmorty.fun's three faults (resting at the hover's 7px, the
 * COPY end square, the loader 1.1 s later) and its ribbon timed at a fixed
 * 36 px a second. Each tool must say so:
 *
 *   · compare-geometry.mjs: 4 against 7 at rest, 7 hovered on both, 1 pressed,
 *     the COPY end's corners cut against square;
 *   · motion-timing.mjs: the loader going at about 1.2 s against 2.3 s, the
 *     ribbon on the frame's clock against the time's;
 *   · compare-shots.mjs: the two differ, and a page against itself does not.
 *
 *   node capture/site/capture/tools/check-tools.mjs
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 500)}`}`);
};
const page = (copy) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font:18px/24px sans-serif;background:#f3d440;color:#1a0f0b;min-height:2000px}
  .sticker{position:absolute;left:60px;top:60px;padding:10px 18px;border:4px solid #1a0f0b;border-radius:13px;background:#89cebc;
    box-shadow:${copy ? "7px 7px" : "4px 4px"} 0 #1a0f0b;transition:transform .2s,box-shadow .2s}
  .sticker:hover{box-shadow:7px 7px 0 #1a0f0b}
  .sticker:active{box-shadow:1px 1px 0 #1a0f0b}
  .ca{position:absolute;left:60px;top:200px;display:flex;width:500px;border:4px solid #1a0f0b;border-radius:16px;background:#fafafa;overflow:${copy ? "visible" : "hidden"}}
  .ca span{padding:12px 16px}.v{flex:1}.b{background:#e8433a;border-left:4px solid #1a0f0b${copy ? ";position:relative;z-index:1;margin:-4px -4px -4px 0" : ""}}
  .band{position:absolute;left:0;top:1200px;width:100%;overflow:hidden;white-space:nowrap}.t{display:inline-block;font-size:30px}
  #loader{position:fixed;inset:0;background:#000;color:#b8ff6a;display:grid;place-items:center;z-index:9;transition:opacity .5s}
  #loader.off{opacity:0}
</style></head><body>
  <div id="loader">TUNING</div>
  <a class="sticker" href="#tg">TG</a>
  <div class="ca"><span>CA</span><span class="v">STANDIN</span><span class="b">COPY</span></div>
  <div class="band"><div class="t">RIBBON RIBBON RIBBON RIBBON RIBBON RIBBON RIBBON RIBBON RIBBON RIBBON RIBBON RIBBON</div></div>
  <script>
    var t = document.querySelector(".t"), x = 0, t0 = performance.now();
    (function go() { ${copy ? "x = -((performance.now() - t0) * 0.036) % 300;" : "x -= 0.6; if (x < -300) x += 300;"} t.style.transform = "translateX(" + x + "px)"; requestAnimationFrame(go); })();
    (function off() { if (performance.now() >= ${copy ? 2300 : 1200}) { var l = document.getElementById("loader"); l.classList.add("off"); setTimeout(function () { l.remove(); }, 600); return; } requestAnimationFrame(off); })();
  </script>
</body></html>`;
const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(page(req.url.startsWith("/ours"))); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const o = `http://127.0.0.1:${server.address().port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
/* Not spawnSync: the pages are served from this process, which must keep answering while a tool runs. */
const run = (tool, argv) => new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, tool), ...argv], { env });
  let stdout = "", stderr = "";
  p.stdout.on("data", (d) => (stdout += d)); p.stderr.on("data", (d) => (stderr += d));
  p.on("close", (status) => resolve({ status, stdout, stderr }));
});
const work = mkdtempSync(join(tmpdir(), "compare-tools-"));

const geo = await run("compare-geometry.mjs", ["--live", `${o}/`, "--ours", `${o}/ours`, "--words", "TG,COPY", "--widths", "1440", "--wait", "2600", "--json", join(work, "geo.json")]);
check("compare-geometry runs", geo.status === 0, geo.stderr);
const G = geo.status === 0 ? JSON.parse(readFileSync(join(work, "geo.json"), "utf8")) : [];
const g = (side, w) => G.find((x) => x.side === side && x.words === w);
check("…the sticker at rest: 4px on the original, 7px on the copy", g("live", "TG")?.rest?.offset?.join() === "4,4" && g("ours", "TG")?.rest?.offset?.join() === "7,7", JSON.stringify([g("live", "TG")?.rest, g("ours", "TG")?.rest]));
check("…hovered, 7px on both", g("live", "TG")?.hover?.offset?.join() === "7,7" && g("ours", "TG")?.hover?.offset?.join() === "7,7", JSON.stringify([g("live", "TG")?.hover, g("ours", "TG")?.hover]));
check("…pressed, 1px on the original", g("live", "TG")?.pressed?.offset?.join() === "1,1", JSON.stringify(g("live", "TG")?.pressed));
check("…the COPY end cut to the bar's curve on the original, square on the copy", (([a, b, c, d]) => a <= 1 && b >= 3 && c >= 3 && d <= 1)(g("live", "COPY")?.corners ?? []) && (g("ours", "COPY")?.corners ?? [9]).every((k) => k <= 1), JSON.stringify([g("live", "COPY")?.corners, g("ours", "COPY")?.corners]));

const mt = await run("motion-timing.mjs", [`${o}/`, `${o}/ours`, "--runs", "1", "--json", join(work, "mt.json")]);
check("motion-timing runs", mt.status === 0, mt.stderr);
const M = mt.status === 0 ? JSON.parse(readFileSync(join(work, "mt.json"), "utf8")) : [];
const live = M.find((x) => !x.url.includes("ours")), ours = M.find((x) => x.url.includes("ours"));
check("…the original's loader starts to go about 1.2 s from the navigation", live?.cover?.off >= 1150 && live?.cover?.off <= 1500, JSON.stringify(live?.cover));
check("…the copy's about 2.3 s", ours?.cover?.off >= 2250 && ours?.cover?.off <= 2650, JSON.stringify(ours?.cover));
check("…the original's ribbon on the frame's clock at 0.6 px a frame", live?.ribbons?.[0]?.clock === "frame" && Math.abs(live.ribbons[0].fast.perFrame - 0.6) < 0.05, JSON.stringify(live?.ribbons));
check("…the copy's on the time's", ours?.ribbons?.[0]?.clock === "time", JSON.stringify(ours?.ribbons));

const sh = await run("compare-shots.mjs", ["--live", `${o}/`, "--ours", `${o}/ours`, "--out", join(work, "shots"), "--widths", "1440", "--at", "0", "--wait", "2600"]);
const same = await run("compare-shots.mjs", ["--live", `${o}/`, "--ours", `${o}/`, "--out", join(work, "same"), "--widths", "1440", "--at", "0", "--wait", "2600"]);
const pct = (dir) => { try { return JSON.parse(readFileSync(join(work, dir, "report.json"), "utf8")).report[0].differs; } catch { return null; } };
check("compare-shots: the copy differs from the original", sh.status === 0 && pct("shots") > 0.1, `${pct("shots")} ${sh.stderr}`);
check("…and the original against itself less (its ribbon runs below the window)", same.status === 0 && pct("same") !== null && pct("same") < pct("shots"), `${pct("same")}`);

server.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
