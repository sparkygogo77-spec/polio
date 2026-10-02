#!/usr/bin/env node
/**
 * THE SAME BEHAVIOUR, FAR FEWER PRESSES.
 *
 * A stand-in page (all STANDIN data) with a list of twelve coin cards (every
 * third one a badge longer), each
 * with a Copy CA (copies its own mint), its ticker (goes to its own coin page
 * by script) and Details (opens a panel in the card that names its own
 * ticker), a row of tabs and a menu. Captured twice: the old way (every
 * control pressed, the page loaded again after each press: `--no-twins
 * --reload-each`) and the new way (one card's controls pressed, the other
 * eleven told; each press undone in place). Held:
 *
 *   (1) every card's ticker goes to its own address, every Copy CA copies its
 *       own mint, every Details shows its own card's panel, in both;
 *   (2) the new way says which were told, not pressed, and from which part
 *       (`behaviours.inferred`), and the old way has none;
 *   (3) the tabs and the menu are states in both;
 *   (4) the new way pressed far fewer times and loaded the page far fewer
 *       times (`pressStats`);
 *   (5) pages of one template taken once: a link to any of them goes to the
 *       page taken.
 *
 *   node capture/site/capture/check-twins.mjs
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 700)}`}`); };
const J = (x) => JSON.stringify(x);

const COINS = Array.from({ length: 12 }, (_, i) => ({ tick: `STAND${String.fromCharCode(65 + i)}`, mint: `STANDIN0MINT0ADDRESS00000000${String(i).padStart(2, "0")}` }));
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>STANDIN coins</title><style>
body{margin:0;font:15px sans-serif}.cards{display:grid;grid-template-columns:repeat(4,220px);gap:12px;padding:12px}
.card{border:1px solid #999;padding:10px;position:relative}.card .panel{display:none;position:absolute;left:0;top:100%;z-index:2;background:#eef;padding:6px}.card.open .panel{display:block}section{position:relative}#nav{position:absolute;top:100%;left:0;background:#fff}
button{margin:3px;padding:4px 8px}
</style></head><body><h1>STANDIN coins</h1>
<div id="tabs"><button type="button" role="tab" aria-selected="true" data-t="new">New</button><button type="button" role="tab" aria-selected="false" data-t="top">Top</button></div>
<p id="sort">STANDIN sorted new</p>
<section><button type="button" id="menu" aria-expanded="false">Menu</button><nav id="nav" hidden><p>STANDIN menu</p></nav></section>
<div class="cards">${COINS.map((c, i) => `<div class="card" data-mint="${c.mint}"><h3>$${c.tick}${i % 3 === 0 ? ' <span class="badge">graduated</span>' : ""}</h3><p class="mint">${c.mint}</p>
<button type="button" class="tick">$${c.tick}</button><button type="button" class="copy">Copy CA of $${c.tick}</button><button type="button" class="more">Details</button>
<div class="panel"><p>STANDIN details for $${c.tick}</p></div></div>`).join("")}</div>
<script>
tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; tabs.querySelectorAll("[data-t]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); sort.textContent = "STANDIN sorted " + b.dataset.t; });
menu.onclick = () => { const open = menu.getAttribute("aria-expanded") === "true"; menu.setAttribute("aria-expanded", String(!open)); nav.hidden = open; };
document.querySelectorAll(".card").forEach((card) => {
  card.querySelector(".tick").onclick = () => { location.href = "/coin/" + card.dataset.mint; };
  card.querySelector(".copy").onclick = () => { navigator.clipboard.writeText(card.dataset.mint).catch(() => {}); };
  card.querySelector(".more").onclick = () => { card.classList.toggle("open"); };
});
</script></body></html>`;

const server = createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  res.writeHead(200, { "content-type": "text/html" }); res.end("<p>STANDIN elsewhere</p>");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const run = (args) => new Promise((resolve) => {
  const p = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
const take = async (name, extra) => {
  const work = mkdtempSync(join(tmpdir(), `capture-twins-${name}-`));
  mkdirSync(join(work, "routes"), { recursive: true });
  const capFile = join(work, "routes", "page_home.json");
  const t0 = Date.now();
  const cap = await run([join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "700", "--assets", join(work, "source"), "--settle", "1", "--frames", "0", "--hide-gate", "--states", "--states-max", "60", "--singles-max", "60", ...extra]);
  const ms = Date.now() - t0;
  if (process.env.DEBUG) console.log(cap.err);
  writeFileSync(join(work, "routes.json"), J({ site: origin, viewport: [1000, 700], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
  /* The same, as if /coin/<first mint> had been taken as the one page of /coin/:id (its capture is the home page's, which is all the link reads). */
  writeFileSync(join(work, "routes.t.json"), J({ site: origin, viewport: [1000, 700], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }, { id: "page_coin", name: "Coin", path: `/coin/${COINS[0].mint}`, route: `/coin/${COINS[0].mint}`, pattern: "/coin/:id" }], templates: [{ pattern: "/coin/:id", representative: "page_coin", ids: COINS.map((c) => c.mint) }] }));
  const conv = await run([join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", join(work, "source")]);
  const docFile = join(work, "out", "site", "document.json");
  const raw = existsSync(capFile) ? JSON.parse(readFileSync(capFile, "utf8")) : {};
  if (existsSync(capFile)) writeFileSync(join(work, "routes", "page_coin.json"), readFileSync(capFile));
  return { work, ok: cap.status === 0 && conv.status === 0, err: cap.err + conv.err, ms, doc: existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { nodes: [] }, stats: raw.pressStats ?? null };
};
const old = await take("old", ["--no-twins", "--reload-each"]);
const now = await take("new", []);
server.close();
check("both captures were taken and converted", old.ok && now.ok, (old.err + now.err).trim().split("\n").slice(-4).join(" | "));

const words = (n) => (typeof n.content === "string" ? n.content : Array.isArray(n.content) ? n.content.map((x) => x.text ?? "").join("") : "").trim();
const read = (doc) => {
  const byWords = (w) => doc.nodes.filter((n) => words(n) === w && !n.state);
  const copies = new Map((doc.behaviours?.presses ?? []).map((c) => [c.part, c.copy]));
  const states = doc.behaviours?.states ?? [];
  return COINS.map((c) => {
    const tick = byWords(`$${c.tick}`).find((n) => n.featureId !== "heading" && n.link);
    const copy = byWords(`Copy CA of $${c.tick}`)[0];
    const more = doc.nodes.filter((n) => words(n) === "Details" && !n.state);
    const shown = states.flatMap((st) => st.shows.map((id) => doc.nodes.find((n) => n.id === id))).filter(Boolean).map(words);
    return { link: tick?.link?.target ?? null, copy: copy ? copies.get(copy.id) ?? null : null, panel: shown.includes(`STANDIN details for $${c.tick}`), details: more.length };
  });
};
const a = read(old.doc), b = read(now.doc);
const want = COINS.map((c) => ({ link: `${origin}/coin/${c.mint}`, copy: c.mint, panel: true }));
const same = (got) => got.every((g, i) => g.link === want[i].link && g.copy === want[i].copy && g.panel === want[i].panel);
check("(1) the old way: every card's link, copy and panel its own", same(a), J(a.filter((g, i) => g.link !== want[i].link || g.copy !== want[i].copy || !g.panel).slice(0, 3)));
check("(1) the new way: the same, eleven of each told from one card", same(b), J(b.map((g, i) => ({ i, ...g })).filter((g, i) => g.link !== want[i].link || g.copy !== want[i].copy || !g.panel).slice(0, 4)));
const inf = now.doc.behaviours?.inferred ?? [];
const kinds = (d) => ["link", "copy", "state"].map((k) => inf.filter((x) => x.does === k).length);
check("(2) the new way says which were told and from which part; the old way told none", J(kinds()) === J([11, 11, 11]) && inf.every((x) => x.from && now.doc.nodes.some((n) => n.id === x.from)) && !(old.doc.behaviours?.inferred ?? []).length, J({ kinds: kinds(), sample: inf.slice(0, 2) }));
const st = (d) => (d.behaviours?.states ?? []).map((s) => s.name);
check("(3) the tabs and the menu are states both ways", ["Top", "Menu"].every((n) => st(old.doc).includes(n) && st(now.doc).includes(n)), J({ old: st(old.doc), now: st(now.doc) }));
check("(4) far fewer presses and page loads", old.stats && now.stats && now.stats.presses * 4 <= old.stats.presses && now.stats.loads * 4 <= old.stats.loads, J({ old: old.stats, now: now.stats, ms: { old: old.ms, now: now.ms } }));
console.log(`\n  presses ${old.stats?.presses} → ${now.stats?.presses}, page loads ${old.stats?.loads} → ${now.stats?.loads}, ${Math.round(old.ms / 1000)}s → ${Math.round(now.ms / 1000)}s`);

/* (5) Pages of one template, taken once: a link to any of them goes to the page taken. */
{
  const rc = await run([join(here, "capture-to-document.mjs"), join(now.work, "routes.t.json"), join(now.work, "out-t"), "--assets", join(now.work, "source")]);
  const td = existsSync(join(now.work, "out-t", "site", "document.json")) ? JSON.parse(readFileSync(join(now.work, "out-t", "site", "document.json"), "utf8")) : { nodes: [] };
  const links = td.nodes.filter((n) => n.pageId === "page_home" && /^\$STAND[A-L]$/.test(words(n)) && n.link).map((n) => n.link);
  check("(5) a link to any page of a template taken once goes to that page", rc.status === 0 && links.length === 12 && links.every((l) => l.kind === "page" && l.target === "page_coin"), J({ status: rc.status, links: links.slice(0, 3), n: links.length }));
}

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
