/**
 * A HOLDER WHOSE WORDS BECAME A PART OF THEIR OWN IS A BOX, from thesolface.site.
 *
 * thesolface's lore sign-off is a flex row, a 60px arrow beside two lines of
 * words. The words become a part of their own (`inline-runs.mjs`, split),
 * and the row was left a words part with no words: `prose`, content "", its
 * label still the words it no longer held. The Builder filled a words part
 * with no words with its sample prose, so J's board showed "Plain thread
 * soft thread open signal…" over the real words (the board half is
 * tests/captured-no-filler.mjs). The "100%" stat's ring was the same.
 *
 * A holder with no words of its own left is what it now is, a box: it keeps
 * its look and its place, and it is named by what it is, not by words it
 * gave away.
 *
 *   (1) the sign-off row is a box with no words;
 *   (2) …and its label is not the words it gave away;
 *   (3) a nav whose bars became parts of their own is a box too;
 *   (4) control: the words are still a part, with both lines.
 *
 *   node capture/site/capture/check-split-holder-box.mjs
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
const dir = mkdtempSync(join(tmpdir(), "check-split-holder-box-"));

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#0a0f18;color:#beffe1;padding:40px;font:11px/1.6 monospace}
  .signoff{display:flex;align-items:center;gap:18px;margin-top:34px;letter-spacing:.06em;width:612px}
  .signoff span{font:60px/1 Georgia,serif;color:#4cff83}
  nav{margin-top:60px;font:16px/2 sans-serif;width:420px}
  nav a{color:#fff}
</style></head><body>
<div class="signoff"><span>↗</span> NO CRYSTAL BALL.<br>JUST A BETTER PAIR OF GOGGLES.</div>
<nav><a href="#a">Play</a> | <a href="#b">Leaderboard</a> | <a href="#c">Profile</a></nav>
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
const sel = (n) => n.from?.selector ?? "";
const brief = (n) => n && { id: n.id, featureId: n.featureId, label: n.label, content: n.content, sel: sel(n) };

const row = doc.nodes.find((n) => sel(n) === "body > div:nth-of-type(1)" || sel(n) === "body > div");
check("(1) the sign-off row is a box with no words", row && row.featureId === "box" && !text(row).trim(), J(brief(row)));
check("(2) …and its label is not the words it gave away", row && !/CRYSTAL/.test(row.label ?? ""), J(brief(row)));
const nav = doc.nodes.find((n) => sel(n) === "body > nav");
check("(3) a nav whose bars became parts of their own is a box too", nav && (nav.featureId === "box" || text(nav).trim()), J(brief(nav)));
const words = doc.nodes.find((n) => /CRYSTAL/.test(text(n)));
check("(4) control: the words are still a part, with both lines", words && /GOGGLES/.test(text(words)) && words.id !== row?.id, J(brief(words)));

let failed = 0;
for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.name}${r.ok ? "" : ` — ${String(r.detail).slice(0, 500)}`}`); }
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} ok`);
process.exit(failed ? 1 : 0);
