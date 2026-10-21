/**
 * A FLEX ROW OF A BIG GLYPH AND TWO LINES, from thesolface.site's #lore.
 *
 * `<div class="lore-signoff"><span>↗</span> NO CRYSTAL BALL.<br>JUST A BETTER
 * PAIR OF GOGGLES.</div>` is a flex row (gap 18px, items centred): the 60 px
 * arrow is one item, the two lines of words the other. Folded into one
 * sentence, the arrow became a 60 px run at the head of the words, the lines
 * wrapped around it and the part drew 133 px tall against the 60 captured.
 *
 *   (1) the arrow is not a run of the words' part, and stays a part of its own
 *       at its own box (about 60 px tall);
 *   (2) the two lines of words are one part, with both lines, to the right of
 *       the arrow, no taller than their two lines (under 50 px);
 *   (3) a flex row whose words stay on ONE line (mochi's "Live · is up ▼86.7%",
 *       check-flex-gap-runs.mjs) still folds into runs.
 *
 *   node capture/site/capture/check-flex-wrap-fold.mjs
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
const dir = mkdtempSync(join(tmpdir(), "check-flex-wrap-fold-"));

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#0a0f18;color:#beffe1;padding:40px;font:11px/1.6 monospace}
  .signoff{display:flex;align-items:center;gap:18px;margin-top:34px;letter-spacing:.06em;width:612px}
  .signoff span{font:60px/1 Georgia,serif;color:#4cff83}
  .live{display:flex;gap:8px;margin-top:60px;font:16px/1.4 sans-serif;color:#fff;width:420px}
  .live b{color:#4cff83}
</style></head><body>
<div class="signoff"><span>↗</span> NO CRYSTAL BALL.<br>JUST A BETTER PAIR OF GOGGLES.</div>
<div class="live">Live <b>MochiMan</b> is up <b>86.7%</b> this week</div>
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
const holds = (re) => doc.nodes.filter((n) => re.test(text(n)));

const arrowRunInWords = holds(/CRYSTAL/).some((n) => /↗/.test(text(n)));
const arrow = doc.nodes.find((n) => text(n).trim() === "↗");
check("(1) the arrow is not a run of the words' part", !arrowRunInWords, J(holds(/CRYSTAL/).map((n) => n.content)));
check("(1) …it is a part of its own, about 60 px tall", arrow && arrow.h >= 50 && arrow.h <= 70, J(arrow && { x: arrow.x, y: arrow.y, w: arrow.w, h: arrow.h }));
const words = holds(/CRYSTAL/)[0];
check("(2) both lines are one part, right of the arrow, under 50 px tall", words && /GOGGLES/.test(text(words)) && /\n/.test(text(words)) && words.h < 50 && arrow && words.x >= arrow.x + arrow.w - 1, J(words && { x: words.x, y: words.y, w: words.w, h: words.h, c: text(words) }));
const live = holds(/MochiMan/)[0];
check("(3) a one-line flex row still folds into runs", live && Array.isArray(live.content) && live.content.some((r) => /MochiMan/.test(r.text)) && live.content.length > 2, J(live && live.content));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.name}${r.ok ? "" : ` — ${String(r.detail).slice(0, 500)}`}`); }
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} ok`);
process.exit(failed ? 1 : 0);
