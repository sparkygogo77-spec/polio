#!/usr/bin/env node
/**
 * A BUTTON ON ITS OWN, AND WHAT A PRESS DOES BESIDES CHANGING THE PAGE.
 *
 * Across the owner's six sites every orange "goes nowhere" mark the Builder
 * showed was a button the capture never learned about: the presses pass only
 * pressed rows of two to twelve, dropped a press that went to another page,
 * and read the page 100 ms after a press. On a stand-in page (all STANDIN
 * data), each alone:
 *
 *   (1) a button whose script loads another page is a link to it, and the
 *       browser never left (the load answered 204, nothing reached the server);
 *   (2) a button whose router moves the address by pushState is a link to it;
 *   (3) a button that opens a window off the site is a link there, no window
 *       opened;
 *   (4) a button that copies is kept as its copy (`behaviours.presses`);
 *   (5) a button whose panel arrives most of a second later is a state that
 *       shows it;
 *   (6) words that spend or write are never pressed; a press that tries to
 *       write is stopped and held;
 *   (7) a row of tabs is still a row of states;
 *   (8) a button whose press brings up a wallet's dialog is held for a wallet,
 *       not kept as a state;
 *   (9) a menu that also locks the page's scroll as it opens is a state that
 *       shows the menu, not "the whole page changed"; and a capture taken
 *       before that fix, which said the change was at <body>, converts to
 *       the same state;
 *  (11) a button that opens a panel and keeps it in the address (the same
 *       page, `?rewards=1`) is a state, not a link, and is gone back from;
 *       and a Log In beside it is never pressed, only held;
 *  (10) under a terms gate hidden (never agreed to) whose page locks the
 *       pointer again when a search palette closes, the palette and the
 *       presses after it are all states.
 *
 *   node capture/site/capture/check-presses.mjs
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 600)}`}`); };
const J = (x) => JSON.stringify(x);

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>STANDIN buttons</title><style>
body{margin:0;font:15px sans-serif}button{margin:6px;padding:6px 10px}#panel{display:none;padding:20px;background:#eef}
</style></head><body><h1>STANDIN buttons</h1>
<div id="tabs"><button type="button" role="tab" aria-selected="true" data-t="1H">1H</button><button type="button" role="tab" aria-selected="false" data-t="6H">6H</button></div>
<p id="range">STANDIN 1H</p>
<section><button type="button" id="next">Next</button></section>
<section><button type="button" id="docs">Docs</button></section>
<section><button type="button" id="chart">Chart</button></section>
<section><button type="button" id="copy">Copy CA</button></section>
<section><button type="button" id="res">Resources</button><div id="panel">STANDIN resources panel</div></section>
<section><button type="button" id="refresh">Refresh prices</button></section>
<section><button type="button" id="buy">Buy $STANDA</button><button type="button" id="save" style="margin-left:40px">Save</button></section>
<section><button type="button" id="port">Portfolio</button></section>
<section><button type="button" id="menu">Menu</button></section>
<section><button type="button" id="signin">Rewards</button><button type="button" id="login">Log In</button><div id="modal" hidden><p>STANDIN rewards panel</p></div></section>
<main id="view">STANDIN home</main>
<script>
tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; tabs.querySelectorAll("[data-t]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); range.textContent = "STANDIN " + b.dataset.t; });
next.onclick = () => { location.href = "/page2"; };
docs.onclick = () => { history.pushState({}, "", "/docs"); view.textContent = "STANDIN docs"; };
chart.onclick = () => { window.open("https://chart.standin.example/STANDIN0MINT01", "_blank"); };
copy.onclick = () => { navigator.clipboard.writeText("STANDIN0MINT0ADDRESS0000000001").catch(() => {}); };
res.onclick = () => { setTimeout(() => { panel.style.display = "block"; }, 900); };
refresh.onclick = () => { fetch("/api/refresh", { method: "POST", body: "{}" }); };
buy.onclick = () => { fetch("/api/buy", { method: "POST", body: "{}" }); };
signin.onclick = () => { history.pushState({}, "", "?rewards=1"); modal.hidden = false; };
login.onclick = () => { document.title = "STANDIN pressed log in"; history.pushState({}, "", "?sign-in=1"); };
addEventListener("popstate", () => { if (!location.search.includes("rewards")) modal.hidden = true; });
menu.onclick = () => { document.body.style.overflow = "hidden"; document.body.classList.add("menu-open"); const m = document.createElement("nav"); m.innerHTML = "<p>STANDIN menu item one</p><p>STANDIN menu item two</p>"; menu.parentElement.append(m); };
port.onclick = () => { const d = document.createElement("div"); d.setAttribute("role", "dialog"); d.innerHTML = "<h2>Connect a wallet</h2><p>Phantom</p>"; document.body.append(d); };
save.onclick = () => { fetch("/api/save", { method: "POST", body: "{}" }); };
</script></body></html>`;

/* A page under a terms gate, as a modal library keeps one: the pointer locked on <body> while it is open, and locked again whenever another modal (a search palette) closes. */
const GATED = `<!doctype html><html><head><meta charset="utf-8"><title>STANDIN gated</title><style>
body{margin:0;font:15px sans-serif}button{margin:6px;padding:6px 10px}.veil{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:10}
.gate{background:#fff;padding:20px;width:320px;pointer-events:auto}.pal{position:fixed;top:60px;left:30%;background:#fff;border:1px solid #333;padding:12px;z-index:20;pointer-events:auto}
</style></head><body><header><button type="button" id="search">Search</button><button type="button" id="help">Help</button></header>
<div id="sort"><button type="button" aria-pressed="true" data-s="cap">Market cap</button><button type="button" aria-pressed="false" data-s="new">Newest</button></div>
<ol id="list"><li>STANDIN a</li><li>STANDIN b</li><li>STANDIN c</li></ol>
<main>${Array.from({ length: 24 }, (_, i) => `<section><h3>STANDIN section ${i}</h3><p>STANDIN words ${i}</p></section>`).join("")}</main>
<div class="veil" id="veil"><div class="gate" role="dialog" aria-modal="true"><p>Read the terms and conditions.</p><button type="button" id="agree">I agree</button></div></div>
<script>
let gateOpen = true;
const lock = () => { document.body.style.pointerEvents = gateOpen ? "none" : ""; };
lock();
agree.onclick = () => { fetch("/api/agree", { method: "POST" }); gateOpen = false; veil.remove(); lock(); };
search.onclick = () => { const p = document.createElement("div"); p.className = "pal"; p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "true"); p.innerHTML = "<p>STANDIN search palette</p>"; document.body.append(p); document.body.style.pointerEvents = "none";
  const esc = (e) => { if (e.key === "Escape") { p.remove(); removeEventListener("keydown", esc); lock(); } }; addEventListener("keydown", esc); };
help.onclick = () => { const h = document.createElement("p"); h.id = "helptext"; h.textContent = "STANDIN help text"; h.style.cssText = "position:absolute;top:40px;left:10px;margin:0;background:#ffe"; document.querySelector("header").after(h); };
sort.addEventListener("click", (e) => { const b = e.target.closest("[data-s]"); if (!b) return; sort.querySelectorAll("[data-s]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); const items = [...list.children].sort((a, c) => (b.dataset.s === "new" ? -1 : 1) * a.textContent.localeCompare(c.textContent)); list.append(...items); });
</script></body></html>`;

const got = [];
const server = createServer((req, res) => {
  got.push(`${req.method} ${req.url}`);
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  if (req.url === "/gated") { res.writeHead(200, { "content-type": "text/html" }); return res.end(GATED); }
  if (req.url.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); return res.end("{}"); }
  res.writeHead(200, { "content-type": "text/html" }); res.end("<p>STANDIN elsewhere</p>");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const work = mkdtempSync(join(tmpdir(), "capture-presses-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const run = (args) => new Promise((resolve) => {
  const p = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
const cap = await run([join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "700", "--assets", join(work, "source"), "--settle", "1", "--frames", "0", "--hide-gate", "--states", "--network"]);
if (process.env.DEBUG) console.log(cap.err);
check("the stand-in page was captured", cap.status === 0 && existsSync(capFile), cap.err.trim().split("\n").slice(-6).join(" | "));
writeFileSync(join(work, "routes.json"), J({ site: origin, viewport: [1000, 700], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = await run([join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", join(work, "source")]);
check("the capture converts", conv.status === 0, conv.err.trim().split("\n").pop());
/* (10) Under a gate hidden, never agreed to: a palette that locks the pointer again as it closes does not stop the presses after it. */
const gatedFile = join(work, "routes", "page_gated.json");
const gc = await run([join(here, "capture-route.mjs"), `${origin}/gated`, gatedFile, "--width", "1000", "--height", "700", "--assets", join(work, "source"), "--settle", "1", "--frames", "0", "--hide-gate", "--states"]);
if (process.env.DEBUG) console.log(gc.err);
const gcap = existsSync(gatedFile) ? JSON.parse(readFileSync(gatedFile, "utf8")) : {};
server.close();
const doc = existsSync(join(work, "out", "site", "document.json")) ? JSON.parse(readFileSync(join(work, "out", "site", "document.json"), "utf8")) : { nodes: [] };
const words = (n) => (typeof n.content === "string" ? n.content : Array.isArray(n.content) ? n.content.map((x) => x.text ?? "").join("") : "").trim();
const part = (w) => doc.nodes.find((n) => words(n) === w);
const linkOf = (w) => part(w)?.link ?? null;

check("(1) a script that loads another page: the button is a link to it", linkOf("Next")?.target === `${origin}/page2`, J(linkOf("Next")));
check("(1) …and the browser never went: nothing asked the server for it", !got.includes("GET /page2"), J(got.filter((g) => !/^GET \/$/.test(g))));
check("(2) a router's pushState: the button is a link to that address", linkOf("Docs")?.target === `${origin}/docs`, J(linkOf("Docs")));
check("(3) a window off the site: a link there, and no window was opened", linkOf("Chart")?.target === "https://chart.standin.example/STANDIN0MINT01", J(linkOf("Chart")));
const copies = doc.behaviours?.presses ?? [];
check("(4) a copy button is kept as its copy, on its part", copies.some((c) => c.does === "copy" && c.copy === "STANDIN0MINT0ADDRESS0000000001" && c.part === part("Copy CA")?.id), J(copies));
const states = doc.behaviours?.states ?? [];
check("(5) a panel that arrives 0.9 s after the press is a state that shows it", states.some((st) => st.part === part("Resources")?.id && st.shows.some((id) => words(doc.nodes.find((n) => n.id === id) ?? {}) === "STANDIN resources panel")), J(states.map((s) => [s.name, s.part, s.shows.length])));
const held = doc.held ?? [];
check("(6) words that spend or write were never pressed", !got.some((g) => /\/api\/(buy|save)/.test(g)) && held.some((h) => h.label === "Buy $STANDA" && h.held === "wallet") && held.some((h) => h.label === "Save" && h.held === "server-call"), J(held.map((h) => [h.label, h.held])));
check("(6) a press that tried to write was stopped before it left, and held", !got.some((g) => /\/api\/refresh/.test(g)) && held.some((h) => h.label === "Refresh prices" && h.held === "server-call" && /POST .*\/api\/refresh/.test(h.hook ?? "")), J(held.find((h) => h.label === "Refresh prices")));
check("(7) a row of tabs is still a row of states", states.some((st) => st.name === "6H"), J(states.map((s) => s.name)));

check("(8) a press that brought up a wallet's dialog is held, not a state", held.some((h) => h.label === "Portfolio" && h.held === "wallet") && !states.some((st) => st.name === "Portfolio"), J({ held: held.map((h) => [h.label, h.held]), states: states.map((s) => s.name) }));

const shows = (st, w) => st?.shows.some((id) => words(doc.nodes.find((n) => n.id === id) ?? {}) === w);
check("(9) a menu that locks the page's scroll as it opens: a state showing the menu", shows(states.find((st) => st.part === part("Menu")?.id), "STANDIN menu item one"), J(states.map((s) => [s.name, s.shows.length])));
{
  /* The same press as an older capture wrote it: the whole page after it, at <body>. */
  const raw = JSON.parse(readFileSync(capFile, "utf8"));
  const st = raw.states.find((x) => x.name === "Menu");
  const after = structuredClone(raw.tree);
  const byP = new Map(); (function go(e) { byP.set(e.p, e); (e.kids ?? []).forEach(go); })(after);
  for (const c of st?.changes ?? []) if (c.el && byP.get(c.parent)) byP.get(c.parent).kids.push(c.el);
  raw.states = [{ ...st, changes: [{ at: "body", el: after }] }];
  mkdirSync(join(work, "old", "routes"), { recursive: true });
  writeFileSync(join(work, "old", "routes", "page_home.json"), J(raw));
  writeFileSync(join(work, "old", "routes.json"), J({ site: origin, viewport: [1000, 700], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
  const oc = await run([join(here, "capture-to-document.mjs"), join(work, "old", "routes.json"), join(work, "old", "out"), "--assets", join(work, "source")]);
  const od = existsSync(join(work, "old", "out", "site", "document.json")) ? JSON.parse(readFileSync(join(work, "old", "out", "site", "document.json"), "utf8")) : { nodes: [] };
  const ost = (od.behaviours?.states ?? [])[0];
  check("(9) …and an older capture that said <body> changed converts to that state", oc.status === 0 && !!st && ost?.shows.some((id) => words(od.nodes.find((n) => n.id === id) ?? {}) === "STANDIN menu item one"), J({ status: oc.status, st: !!st, ost }));
}

check("(11) a panel kept in the address (?rewards=1) is a state, not a link", states.some((st) => st.part === part("Rewards")?.id && shows(st, "STANDIN rewards panel")) && !linkOf("Rewards"), J({ link: linkOf("Rewards"), states: states.map((s) => s.name) }));
check("(11) …and the Log In beside it was never pressed, only held", !states.some((st) => st.part === part("Log In")?.id) && !linkOf("Log In") && (doc.held ?? []).some((h) => h.label === "Log In" && h.held === "server-call"), J({ held: (doc.held ?? []).map((h) => h.label), link: linkOf("Log In") }));
const gnames = (gcap.states ?? []).map((st) => st.name);
check("(10) under a hidden gate, the palette is a state and so are the presses after it", gc.status === 0 && gnames.includes("Search") && gnames.includes("Newest") && gnames.includes("Help"), J({ status: gc.status, states: gnames, err: gc.err.trim().split("\n").filter((l) => /not back|states:|presses:/.test(l)).slice(0, 6) }));
check("(10) …and the gate was never agreed to", !got.includes("POST /api/agree"));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
