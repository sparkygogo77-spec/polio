/**
 * A CLOSED QUESTION SHOWS ITS QUESTION; ITS ANSWER IS WHAT A PRESS OPENS.
 *
 * trendtrader.pro/ttp's "Clear from the start": seven `<details>`, closed.
 * The browser draws only each `<summary>`, but the answer's `<p>` still
 * reports a box (below its question, 120px tall), and the capture kept it:
 * the export drew every answer over the questions under it. What the
 * browser does not draw (a closed details' content, anything under
 * `content-visibility: hidden`) is not the page as it opens; each question
 * is a press, and the answer it opens is what that press shows.
 *
 * A link inside an answer to a place on the page (`#questions`) goes to the
 * part that place became, as the page's own links do (parasiteonsol.fun's
 * header, shown by a press, linked `##inoculate`).
 *
 * A stand-in page, 1000 × 700: three closed questions, then a footer.
 *
 *   node capture/site/capture/check-details.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26, timeout: 600000 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); });
const dir = mkdtempSync(join(tmpdir(), "check-details-"));

const Q = [["What is it?", "It is the answer to the first question, long enough to wrap onto a second line of words. <a href=\"#questions\">Back to the questions</a>"], ["When does it start?", "It starts when the second answer says so."], ["How do I check?", "Read the third answer."]];
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font:16px/24px sans-serif;background:#0b0f19;color:#eee}
  header{height:200px}
  .faq{width:600px;margin:0 0 0 100px}
  details{border-bottom:1px solid #334}
  summary{display:flex;justify-content:space-between;height:60px;align-items:center;cursor:pointer;list-style:none}
  details p{margin:0 0 20px}
  footer{height:200px;background:#223;margin-top:40px}
</style></head><body><header id="questions"><h1 style="margin:0">Questions</h1></header>
<div class="faq">${Q.map(([q, a]) => `<details><summary><span>${q}</span><span>+</span></summary><p>${a}</p></details>`).join("")}</div>
<footer><b>THE FOOTER</b></footer></body></html>`;

const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1000, 700], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1000", "--height", "700", "--assets", assets, "--settle", "1", "--states"]).catch((e) => console.error(String(e).slice(0, 300)));
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });
const J = (x) => JSON.stringify(x);
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* the converter failed */ }
const says = (n, s) => (typeof n.content === "string" ? n.content : J(n.content ?? "")).includes(s);
const opening = doc.nodes.filter((n) => !n.state);
check("the page as it opens has its three questions", Q.every(([q]) => opening.some((n) => says(n, q))), J(opening.map((n) => n.content).filter(Boolean)));
check("…and none of the answers (the browser draws none of them)", !Q.some(([, a]) => opening.some((n) => says(n, a.slice(0, 20)))), J(opening.filter((n) => Q.some(([, a]) => says(n, a.slice(0, 20)))).map((n) => [n.content, n.y])));
const foot = doc.nodes.find((n) => says(n, "THE FOOTER"));
check("the footer stands where it does with every question closed (200 + 3 × 61 + 40)", foot && Math.abs(foot.y - (200 + 3 * 61 + 40)) <= 3, J(foot && [foot.y]));
const states = doc.behaviours?.states ?? [];
for (const [i, [q, a]] of Q.entries()) {
  const st = states.find((s) => says(doc.nodes.find((n) => n.id === s.part) ?? {}, q) || (s.name ?? "").includes(q));
  const shown = (st?.shows ?? []).map((id) => doc.nodes.find((n) => n.id === id)).filter(Boolean);
  check(`pressing "${q}" is a press that shows its answer`, st && shown.some((n) => n.state && says(n, a.slice(0, 20))), J(st ?? states.map((s) => s.name)));
  if (i === 0) check("…the answer set under its question", st && shown.some((n) => says(n, a.slice(0, 20)) && n.y >= 200 + 60 && n.y <= 200 + 60 + 4), J(shown.map((n) => [n.content, n.y])));
}

const back = doc.nodes.find((n) => n.state && n.link && /Back to the questions/.test(J(n.content ?? "") + (n.label ?? "")));
const head = doc.nodes.find((n) => /header$/.test(n.from?.selector ?? ""));
check("a link inside an answer to #questions goes to the part the header became", back && back.link.kind === "node" && back.link.target === head?.id, J(back && back.link) + " header " + head?.id);

for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 400)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
