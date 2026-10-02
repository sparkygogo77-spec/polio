/**
 * A TAG IS NOT A PIECE OF THE SENTENCE IT SITS IN.
 *
 * A `<span role="img">` with words (a "Save 71×" badge, a venue tab's chip)
 * is a thing beside the words, not words of the sentence: the join arbiter
 * never respaces it (its box holds an icon, so its words never fill it), and
 * the hole arbiter never folds it back into the title it sits in.
 *
 * A stand-in page has a card title with such a badge inside it, and a tab
 * with a chip. Captured the way every page is and converted, the title's
 * words must stay its own string, the badge its own part, and the tab's
 * words unchanged.
 *
 *   node capture/site/capture/check-tags.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";

const here = new URL(".", import.meta.url).pathname;
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args, out) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); if (out) c.stdout.pipe(process.stdout); });
const dir = mkdtempSync(join(tmpdir(), "check-tags-"));
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font:16px/1.4 sans-serif;width:1000px}
  .card{width:340px;padding:16px;margin:40px}
  h3{font-size:16px;line-height:20px;margin:0 0 12px;white-space:nowrap}
  .badge{display:inline-flex;align-items:center;gap:4px;padding:0 8px 0 6px;height:20px;border-radius:10px;background:#dff;font-size:12px;vertical-align:top;margin-left:8px}
  .badge i{display:inline-block;width:12px;height:12px;background:#0aa;border-radius:6px}
  .tab{display:inline-flex;align-items:center;gap:6px;padding:0 12px;height:32px;border:1px solid #ccc;border-radius:16px;margin:0 8px 40px}
  .tab i{display:inline-block;width:16px;height:16px;background:#888;border-radius:8px}
</style></head><body>
  <div class="card"><h3>Cardinals vs Giants <span class="badge" role="img" aria-label="Save 71× in fees on the other venue"><i></i>Save 71×</span></h3><p>Sunday 1:00 PM</p><p class="line">Cardinals vs <span role="img" aria-label="Giants, the away team">Giants</span></p></div>
  <button class="tab"><span role="img" aria-label="globe"><i></i></span>Unified</button>
</body></html>`;
const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1000, 600], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1000", "--height", "600", "--settle", "2"], true);
await run([join(here, "capture-to-document.mjs"), routes, dir], false);
server.close();

const doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const title = doc.nodes.find((n) => /h3$/.test(n.from?.selector ?? ""));
const badge = doc.nodes.find((n) => /h3 > span$/.test(n.from?.selector ?? ""));
const tab = doc.nodes.find((n) => /button$/.test(n.from?.selector ?? ""));
const line = doc.nodes.find((n) => /p:nth-of-type\(2\)$/.test(n.from?.selector ?? ""));
const chip = doc.nodes.find((n) => /p:nth-of-type\(2\) > span$/.test(n.from?.selector ?? ""));
check("the title keeps its own words as one string", typeof title?.content === "string" && title.content.trim() === "Cardinals vs Giants", JSON.stringify(title?.content));
check("the badge stays its own part, with its words as captured", !!badge && badge.content === "Save 71×", JSON.stringify(badge?.content ?? null));
check("a sentence with a role=img chip inside it keeps its own words: the chip is not folded back in", typeof line?.content === "string" && line.content.trim() === "Cardinals vs", JSON.stringify(line?.content));
check("…and the chip stays its own part", !!chip && chip.content === "Giants", JSON.stringify(chip?.content ?? null));
check("the tab's words are as captured", !!tab && /^Unified$/.test(typeof tab.content === "string" ? tab.content : ""), JSON.stringify(tab?.content ?? null));
const ok = results.every(Boolean);
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(ok ? 0 : 1);
