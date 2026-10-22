/**
 * WORDS SET FROM A RUN OF TEXT KEEP THEIR WHOLE LINES, from thesolface.site's #lore.
 *
 * A run of an element's own words that becomes a part of its own (the words
 * beside a 60px arrow in a flex row, `inline-runs.mjs`; a nav's bars) was
 * placed at the box of its letters: the union of the text's rectangles,
 * which on each line is the letters' height, not the line's. "NO CRYSTAL
 * BALL. / JUST A BETTER PAIR OF GOGGLES." is two lines of 11px at 1.6
 * (35.2px) and came in 32 tall. The Builder draws its two whole lines, so
 * the part grew by 3 and pushed the rest of the page down by 3. Now the part
 * stands at its lines: as tall as its lines, centred where its letters were.
 *
 *   (1) the two-line run is as tall as its two lines (2 × 17.6), within 1px;
 *   (2) its middle is where its letters' middle was, within 1px;
 *   (3) control: a nav's bar (`|` between inline links) keeps its letters' box,
 *       as the links beside it do;
 *   (4) control: letters taller than their line (line-height 1) keep their own box.
 *
 *   node capture/site/capture/check-text-run-lines.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { launch } from "./tools/browser.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); c.stdout.pipe(process.stdout); });
const dir = mkdtempSync(join(tmpdir(), "check-text-run-lines-"));

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#0a0f18;color:#beffe1;padding:40px;font:11px/1.6 monospace}
  .signoff{display:flex;align-items:center;gap:18px;margin-top:34px;letter-spacing:.06em;width:612px}
  .signoff span{font:60px/1 Georgia,serif;color:#4cff83}
  nav{margin-top:60px;font:16px/2 sans-serif;width:420px}
  nav a{color:#fff}
  .tight{display:flex;align-items:center;gap:18px;margin-top:60px;font:30px/1 Georgia,serif;width:612px}
  .tight b{font:60px/1 Georgia,serif}
</style></head><body>
<div class="signoff"><span>↗</span> NO CRYSTAL BALL.<br>JUST A BETTER PAIR OF GOGGLES.</div>
<nav><a href="#a">Play</a> | <a href="#b">Leaderboard</a> | <a href="#c">Profile</a></nav>
<div class="tight"><b>↗</b> Tall letters<br>on a tight line</div>
</body></html>`;

const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

/* What the browser drew: each run's letters (the union of its rectangles). */
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
await page.goto(`http://127.0.0.1:${port}/`);
const drawn = await page.evaluate(() => {
  const letters = (el) => { const qs = []; for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { const r = document.createRange(); r.selectNodeContents(n); qs.push(...Array.from(r.getClientRects()).filter((q) => q.width && q.height)); } const t = Math.min(...qs.map((q) => q.top)), b = Math.max(...qs.map((q) => q.bottom)); return { top: t + scrollY, h: b - t }; };
  return { signoff: letters(document.querySelector(".signoff")), nav: letters(document.querySelector("nav")), tight: letters(document.querySelector(".tight")) };
});
await browser.close();

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
const box = (n) => n && { x: n.x, y: n.y, w: n.w, h: n.h, sel: n.from?.selector, c: text(n) };
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;

const words = doc.nodes.find((n) => /CRYSTAL/.test(text(n)) && /::text/.test(n.from?.selector ?? ""));
check("(1) the two-line run is as tall as its two lines", words && near(words.h, 2 * 11 * 1.6, 1), J({ part: box(words), letters: drawn.signoff, lines: 2 * 11 * 1.6 }));
check("(2) …its middle is where its letters' middle was", words && near(words.y + words.h / 2, drawn.signoff.top + drawn.signoff.h / 2, 1), J({ part: box(words), letters: drawn.signoff }));
const bar = doc.nodes.find((n) => text(n).trim() === "|" && /::text/.test(n.from?.selector ?? ""));
check("(3) control: a nav's bar keeps its letters' box, as its links do", bar && near(bar.h, drawn.nav.h, 1), J({ part: box(bar), letters: drawn.nav }));
const tight = doc.nodes.find((n) => /Tall letters/.test(text(n)));
check("(4) control: letters taller than their line keep their own box", tight && near(tight.h, drawn.tight.h, 1), J({ part: box(tight), letters: drawn.tight }));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.name}${r.ok ? "" : ` — ${String(r.detail).slice(0, 500)}`}`); }
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} ok`);
process.exit(failed ? 1 : 0);
