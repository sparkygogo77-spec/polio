/**
 * WHAT THE PONSSTARS DESIGN PREVIEW SHOWED THE CAPTURE DROPPING
 * (https://pst-server-beige.vercel.app/preview.html?still=1, the owner's own
 * test site), on stand-in pages served here:
 *
 *   (1) a page its script builds after load, one screen after another with a
 *       status line saying "Building …": the capture waits until the page
 *       stops changing (no change to the tree and no change of height for
 *       1.5 s, the network idle, at most 30 s) and says how long it waited
 *       (`cap.built`), so the page is read whole, not at its first screen;
 *   (2) a price chart drawn as TradingView Lightweight Charts draws one:
 *       several canvases stacked in the cells of a table (candles, then the
 *       crosshair over them; the price axis in the next cell), an HTML label
 *       over them — each canvas a picture at its drawn size and place, in
 *       the order they are stacked, the label over them;
 *   (3) the same chart as the preview copies it: each canvas swapped for an
 *       `<img>` of what it drew, a `data:` address — each a picture too
 *       (they were fetched as addresses, failed, and dropped);
 *   (4) words on one line beside elements: "Match: <code>…</code> Round:
 *       <span>0</span> Status: <span>live</span>" reads in that order with
 *       its spaces, as one sentence, not "Match: Round: Status:" over its
 *       values; and a nav "Play | Leaderboard | My profile | How it works",
 *       whose bars are its own words between links, keeps each bar between
 *       its links (not "| | |" at the end);
 *   (5) pages that differ only by their query (?screen=lobby, ?screen=tour)
 *       stay separate pages.
 *
 * Control: the committed SOLCINERATOR captures still convert to the
 * committed document byte for byte.
 *
 *   node capture/site/capture/check-script-built.mjs
 */
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { plan } from "./capture-site.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 500)}`}`);
};

const HEAD = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font:16px/20px sans-serif;color:#111;background:#fff}</style>`;

/* (1) Ten screens of 900px, one every 700 ms after load (seven seconds), as the preview builds its thirteen. */
const BUILT = `${HEAD}<title>Built</title></head><body>
  <header><h1>Design preview</h1><p>Every screen. <span id="status">Building the screens...</span></p></header>
  <main id="screens"></main>
  <script>
    const names = ["Lobby", "Queue", "Mid match", "Last seconds", "Win", "Loss", "Tie", "Tour", "Leaderboard", "Profile"];
    let i = 0;
    const next = () => {
      if (i === names.length) { document.getElementById("status").textContent = names.length + " screens."; return; }
      document.getElementById("status").textContent = "Building " + names[i] + "...";
      const s = document.createElement("section");
      s.style.cssText = "height:900px;border:1px solid #ccc;background:#eef";
      s.innerHTML = "<h2>" + names[i] + "</h2>";
      document.getElementById("screens").append(s);
      i++;
      setTimeout(next, 700);
    };
    addEventListener("load", () => setTimeout(next, 300));
  </script>
</body></html>`;

/*
 * (2) A chart laid out as Lightweight Charts lays it out: a table, a cell per
 * pane, in each a relative box holding canvases stacked absolute (the
 * candles at z-index 1, the crosshair at 2); the price axis in its own cell.
 */
const CHART_BODY = `
  <div id="chart" style="position:relative;width:640px;height:300px;margin:40px">
    <div class="tv-lightweight-charts" style="overflow:hidden;direction:ltr;width:640px;height:300px;user-select:none">
      <table cellspacing="0" style="height:300px;width:640px;border-spacing:0">
        <tr style="height:300px">
          <td style="padding:0;width:580px;height:300px">
            <div style="width:100%;height:100%;position:relative;overflow:hidden">
              <canvas id="candles" width="580" height="300" style="display:block;position:absolute;user-select:none;width:580px;height:300px;z-index:1;left:0;top:0"></canvas>
              <canvas id="cross" width="580" height="300" style="display:block;position:absolute;user-select:none;width:580px;height:300px;z-index:2;left:0;top:0"></canvas>
            </div>
          </td>
          <td style="padding:0;width:60px;height:300px">
            <div style="width:60px;height:300px;position:relative;overflow:hidden">
              <canvas id="axis" width="60" height="300" style="display:block;position:absolute;user-select:none;width:60px;height:300px;z-index:1;left:0;top:0"></canvas>
            </div>
          </td>
        </tr>
      </table>
    </div>
    <div id="marker" style="position:absolute;left:200px;top:120px;z-index:5;background:#16a34a;color:#fff;font:12px/16px sans-serif;padding:2px 6px">BUY 1.00</div>
  </div>`;
const DRAW = `
  const draw = () => {
    const c = document.getElementById("candles").getContext("2d");
    c.fillStyle = "#0b1220"; c.fillRect(0, 0, 580, 300);
    for (let i = 0; i < 20; i++) { c.fillStyle = i % 3 ? "#22c55e" : "#ef4444"; c.fillRect(20 + i * 27, 80 + (i * 37) % 120, 14, 40 + (i * 13) % 60); }
    const x = document.getElementById("cross").getContext("2d");
    x.strokeStyle = "#e5e7eb"; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(0, 150.5); x.lineTo(580, 150.5); x.moveTo(300.5, 0); x.lineTo(300.5, 300); x.stroke();
    const a = document.getElementById("axis").getContext("2d");
    a.fillStyle = "#111827"; a.fillRect(0, 0, 60, 300); a.fillStyle = "#e5e7eb"; a.font = "11px sans-serif";
    for (let i = 0; i < 6; i++) a.fillText((100 + i * 5).toFixed(2), 8, 290 - i * 50);
  };`;
const CHART = `${HEAD}<title>Chart</title></head><body>${CHART_BODY}<script>${DRAW} requestAnimationFrame(draw);</script></body></html>`;
/* (3) The preview's copy: each canvas swapped for an <img> of what it drew, with the canvas's own style. */
const COPIED = `${HEAD}<title>Copied</title></head><body>${CHART_BODY}<script>${DRAW}
  draw();
  for (const c of document.querySelectorAll("canvas")) {
    const img = document.createElement("img");
    img.src = c.toDataURL("image/png"); img.alt = "";
    img.setAttribute("style", c.getAttribute("style"));
    c.replaceWith(img);
  }
</script></body></html>`;

/* (4) Words beside elements on one line. */
const INLINE = `${HEAD}<title>Inline</title>
  <style>nav a{color:#2563eb;text-decoration:none} .meta code{font:14px/20px monospace;background:#eee} .meta b{color:#b91c1c}</style></head><body>
  <nav style="padding:12px 16px"><a href="/play">Play</a> | <a href="/leaderboard">Leaderboard</a> | <a href="/profile">My profile</a> | <a href="/how">How it works</a></nav>
  <p class="meta" style="margin:16px">Match: <code>m_7f3a9c</code> Round: <b>0</b> Status: <b>live</b></p>
  <p style="margin:16px">A plain sentence with nothing inside it.</p>
</body></html>`;

const PAGES = { "/built": BUILT, "/chart": CHART, "/copied": COPIED, "/inline": INLINE };
const server = createServer((req, res) => {
  const body = PAGES[req.url.split("?")[0]];
  if (body) { res.writeHead(200, { "content-type": "text/html" }); res.end(body); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const work = mkdtempSync(join(tmpdir(), "script-built-"));
mkdirSync(join(work, "routes"), { recursive: true });
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const take = (path, id) => new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}${path}`, join(work, "routes", `${id}.json`), "--width", "1000", "--height", "700", "--assets", assets, "--settle", "2"], { stdio: ["ignore", "pipe", "pipe"], env });
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
  p.on("close", (status) => resolve({ status, out, err }));
});
const ids = { "/built": "page_built", "/chart": "page_chart", "/copied": "page_copied", "/inline": "page_inline" };
const runs = {};
for (const [path, id] of Object.entries(ids)) {
  runs[id] = await take(path, id);
  check(`the stand-in ${path} was captured`, runs[id].status === 0, (runs[id].err || runs[id].out).trim().split("\n").pop());
}
server.close();
const capOf = (id) => { const f = join(work, "routes", `${id}.json`); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : { tree: { kids: [] }, page: [0, 0] }; };

writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [1000, 700], pages: Object.entries(ids).map(([path, id]) => ({ id, name: id, path, route: path })) }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the captures convert", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] };
const words = (n) => (typeof n?.content === "string" ? n.content : (n?.content ?? []).map((s) => s.text ?? "").join("")).trim();
const onPage = (id) => doc.nodes.filter((n) => n.pageId === id);

/* (1) Built after load. */
const built = capOf("page_built");
check("(1) the page built after load is read whole: all ten screens (page over 9,000px tall)", built.page[1] >= 10 * 900, JSON.stringify(built.page));
check("(1) …its status line reads as it ends, not \"Building …\"", onPage("page_built").some((n) => /10 screens\./.test(words(n))) && !onPage("page_built").some((n) => /Building/.test(words(n))), JSON.stringify(onPage("page_built").map(words).filter(Boolean)));
check("(1) …and the capture says how long it waited for the page to stop changing", built.built?.waited >= 5000 && built.built.settled === true, JSON.stringify(built.built));
check("(1) …said in the report too", /built: waited [\d.]+ s/.test(runs.page_built.err), runs.page_built.err.split("\n").filter((l) => /built/.test(l)).join(" | "));

/* (2) Stacked canvases. */
const pics = (id) => onPage(id).filter((n) => n.featureId === "picture" && n.picture);
const sizes = (id) => pics(id).map((n) => `${n.w}x${n.h}@${n.x},${n.y}`).sort();
const want = ["580x300@40,40", "580x300@40,40", "60x300@620,40"].sort();
check("(2) each canvas of the chart is a picture at its drawn size and place", JSON.stringify(sizes("page_chart")) === JSON.stringify(want), JSON.stringify(sizes("page_chart")));
const order = (id) => {
  const ps = pics(id).filter((n) => n.w === 580), marker = onPage(id).find((n) => /BUY 1\.00/.test(words(n)));
  const ix = (n) => doc.nodes.indexOf(n);
  return { ps: ps.map(ix), marker: marker ? ix(marker) : -1, sel: ps.map((n) => n.from?.selector) };
};
const o2 = order("page_chart");
check("(2) …stacked as the page stacks them: the candles under the crosshair, the trade label over both", o2.ps.length === 2 && /canvas(:nth-of-type\(1\))?$/.test(pics("page_chart").find((n) => doc.nodes.indexOf(n) === Math.min(...o2.ps))?.from?.selector ?? "") && o2.marker > Math.max(...o2.ps), JSON.stringify(o2));
const crossPic = pics("page_chart").find((n) => doc.nodes.indexOf(n) === Math.max(...o2.ps));
check("(2) …the crosshair's picture keeps its see-through (a PNG over the candles, not a filled box)", !!crossPic && !crossPic.colour?.bg && crossPic.picture?.type === "image/png", JSON.stringify(crossPic && [crossPic.colour, crossPic.picture]));

/* (3) The chart as the preview copies it: data: pictures. */
check("(3) each copied canvas (an <img> of a data: address) is a picture at its size and place", JSON.stringify(sizes("page_copied")) === JSON.stringify(want), JSON.stringify(sizes("page_copied")));
const o3 = order("page_copied");
check("(3) …in the same stacking, the label over them", o3.ps.length === 2 && o3.marker > Math.max(...o3.ps), JSON.stringify(o3));
check("(3) …nothing was asked of the network for them", !/could not fetch data:/.test(runs.page_copied.err), runs.page_copied.err.split("\n").filter((l) => /data:/.test(l)).join(" | ").slice(0, 200));

/* (4) Inline runs. */
const inl = onPage("page_inline");
const meta = inl.filter((n) => /Match:|Round:|Status:|m_7f3a9c|^live$|^0$/.test(words(n)));
check("(4) \"Match: m_7f3a9c Round: 0 Status: live\" reads in order with its spaces, as one sentence", meta.length === 1 && words(meta[0]) === "Match: m_7f3a9c Round: 0 Status: live", JSON.stringify(meta.map((n) => [n.featureId, words(n), n.x, n.w])));
check("(4) …its values keep their own look as runs (the code's grey chip at 14px, the bold red)", Array.isArray(meta[0]?.content) && meta[0].content.some((r) => r.text === "live" && r.colour === "rgb(185, 28, 28)" && r.weight === 700) && meta[0].content.some((r) => r.text === "m_7f3a9c" && r.bg === "rgb(238, 238, 238)" && r.size === 14), JSON.stringify(meta[0]?.content));
const navWords = inl.filter((n) => /^(Play|Leaderboard|My profile|How it works|\|)$/.test(words(n)) || /\|/.test(words(n)));
const reading = [...navWords].sort((a, b) => a.y - b.y || a.x - b.x).map(words).join(" ");
check("(4) the nav reads \"Play | Leaderboard | My profile | How it works\" left to right, each bar between its links", reading === "Play | Leaderboard | My profile | How it works", reading);
const bars = navWords.filter((n) => words(n) === "|");
const link = (w) => navWords.find((n) => words(n) === w);
check("(4) …each bar a part of its own at the place the page drew it, between its two links", bars.length === 3 && bars.every((b, i) => { const [l, r] = [["Play", "Leaderboard"], ["Leaderboard", "My profile"], ["My profile", "How it works"]][i].map(link); return l && r && b.x >= l.x + l.w && b.x + b.w <= r.x; }), JSON.stringify(navWords.map((n) => [words(n), n.x, n.w])));
check("(4) …and the links stay links", ["Play", "Leaderboard", "My profile", "How it works"].every((w) => link(w)?.link), JSON.stringify(navWords.map((n) => [words(n), n.link])));
check("(4) control: a plain sentence is one part, as before", inl.filter((n) => words(n) === "A plain sentence with nothing inside it.").length === 1);

/* (5) Pages that differ only by their query. */
const screens = ["first-visit", "lobby", "before-queue", "queue-waiting", "mid-match", "last-seconds", "result-win", "result-loss", "tie-rematch", "tour", "leaderboard", "profile", "public-result"];
const pl = plan({ url: "https://example.test/", name: "q-test", pages: screens.map((s) => `/preview.html?still=1&screen=${s}`).join(", "), root: work });
check("(5) thirteen pages that differ only by ?screen= stay thirteen pages", pl.routes.pages.length === 13 && new Set(pl.routes.pages.map((p) => p.id)).size === 13 && !pl.routes.templates, JSON.stringify({ n: pl.routes.pages.length, templates: pl.routes.templates }));
check("(5) …each captured at its own address, query and all", pl.captures.every((c, i) => c.args[1] === `https://example.test/preview.html?still=1&screen=${screens[i]}`), JSON.stringify(pl.captures.map((c) => c.args[1]).slice(0, 3)));

/* Control: the committed SOLCINERATOR captures, untouched. */
const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
