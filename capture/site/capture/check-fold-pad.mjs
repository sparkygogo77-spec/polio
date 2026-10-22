/**
 * WORDS FOLDED WITH THE ICON BESIDE THEM KEEP ONLY THEIR OWN PADDING, from mochi.trade.
 *
 * mochi's leaderboard score "▼ 91.7%" is a flex row (baseline, gap 4px): a
 * small ▼ and the words. Before the fold, the converter set the words where
 * the page drew them beside the ▼, as padding: 15 on the left, 1 above, 2
 * below (`tb`, the letters' box). Then the ▼ was folded into the words as a
 * run (`inline-runs.mjs`), and the padding stayed: the ▼ drew 15px right of
 * where the page put it, and the 21px line no longer fit the 18 inside, so the
 * part grew 3 and moved its section down by 3 (MEASURED on a fresh import).
 *
 * Once folded, the icon is one of the words' runs, and the room the page left
 * round the words alone is not theirs. The element's own padding stays.
 *
 *   (1) the folded score holds the ▼ as a run;
 *   (2) …and carries no padding the element did not have;
 *   (3) control: a folded row with padding of its own keeps it.
 *
 *   node capture/site/capture/check-fold-pad.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); c.stdout.pipe(process.stdout); });
const dir = mkdtempSync(join(tmpdir(), "check-fold-pad-"));

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#09090a;color:#f4f5f6;padding:40px;font:14px/1.5 sans-serif}
  .score{display:flex;align-items:baseline;gap:4px;font-weight:600;color:#ff4d6a;width:56px;margin-bottom:40px}
  .score i{font-style:normal;font-size:10.92px;line-height:1}
  .chip{display:flex;align-items:baseline;gap:4px;padding:6px 10px;font-weight:600;color:#2fd67b;width:90px}
  .chip i{font-style:normal;font-size:10.92px;line-height:1}
</style></head><body>
<span class="score"><i>▼</i>91.7%</span>
<span class="chip"><i>▲</i>12.5%</span>
</body></html>`;

const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1000, 700], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1000", "--height", "700", "--assets", assets, "--settle", "2"]).catch(() => {});
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* the converter failed */ }
const J = (x) => JSON.stringify(x);
const text = (n) => (Array.isArray(n.content) ? n.content.map((r) => r.text).join("") : String(n.content ?? ""));
const padded = (n) => Object.values(n?.pad ?? {}).some((v) => v > 0);
const brief = (n) => n && { content: n.content, pad: n.pad, h: n.h };

const score = doc.nodes.find((n) => /91\.7%/.test(text(n)));
check("(1) the folded score holds the ▼ as a run", score && Array.isArray(score.content) && score.content.some((r) => r.text === "▼"), J(brief(score)));
check("(2) …and carries no padding the element did not have", score && !padded(score), J(brief(score)));
const chip = doc.nodes.find((n) => /12\.5%/.test(text(n)));
check("(3) control: a folded row with padding of its own keeps it", chip && chip.pad?.top === 6 && chip.pad?.left === 10 && chip.pad?.right === 10, J(brief(chip)));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.name}${r.ok ? "" : ` — ${String(r.detail).slice(0, 500)}`}`); }
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} ok`);
process.exit(failed ? 1 : 0);
