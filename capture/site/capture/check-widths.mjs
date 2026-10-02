#!/usr/bin/env node
/**
 * THE SITE AT A TABLET AND A PHONE.
 *
 * A stand-in site (all STANDIN data) whose stylesheet lays it out three
 * ways: two columns from 700 up, one column below it with the second column
 * first (CSS order), an aside only from 700 up, a heading 48 px wide and
 * 30 px on a phone, a wide picture cut by its frame, and a Menu button shown
 * only below 600 that opens a fixed panel of links, beside a Log in and a
 * Connect wallet; and from 600 up a "Share" that expands a popover high on
 * the page (share.xyz's "Share this event"), which is no menu. Captured at 1440, then read at 834 x 1112 and 390 x 844
 * (capture-widths.mjs) and converted. Held:
 *   (1) each width has its file, its parts placed;
 *   (2) no part outside the page at either width (the wide picture cut to
 *       its frame);
 *   (3) the reading order is the order the page reads in at each width: the
 *       two columns left to right at 834, the second first at 390;
 *   (4) the aside hidden at 390, showing at 834; the heading's type 30 px at
 *       390;
 *   (5) the phone's Menu pressed once and its panel's links kept; Log in and
 *       Connect wallet never pressed;
 *   (6) the document carries it by its own parts (`layouts.phone`,
 *       `layouts.tablet`), the menu among it;
 *   (7) and as the Builder reads it (polio docs/RESPONSIVE.md): each part's
 *       `widths.tablet` / `widths.phone` box, `hidden: true` where it is not
 *       drawn, at least half a page's parts carrying one, `capturedWidths`,
 *       and the Menu (shown on a phone only) a part of its own with a
 *       desktop box of zero size;
 *   (8) the Share at 834 is pressed as no menu: no menu recorded there.
 *
 *   node capture/site/capture/check-widths.mjs
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 600)}`}`); };
const J = (x) => JSON.stringify(x);

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>STANDIN widths</title><style>
*{box-sizing:border-box}body{margin:0;font:16px sans-serif}
header{display:flex;align-items:center;gap:16px;padding:12px 20px;border-bottom:1px solid #ccc}
header .links a{margin-right:12px}#menu{display:none}
h1{font-size:48px;margin:20px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:20px}.colA,.colB{background:#eef;padding:12px}
aside{padding:20px;background:#ffe}
.wide{overflow:hidden;margin:20px}.wide img{width:1200px;height:80px;display:block;background:#9cf}
#panel{display:none;position:fixed;top:60px;left:0;right:0;background:#fff;border:1px solid #999;padding:10px}#panel.open{display:block}
@media (max-width:699px){.grid{grid-template-columns:1fr}.colB{order:-1}aside{display:none}}
#pop{display:none;position:fixed;top:50px;right:10px;background:#fff;border:1px solid #999;padding:8px}#pop.open{display:block}
@media (max-width:599px){h1{font-size:30px}header .links{display:none}#menu{display:inline-block}#share{display:none}}
</style></head><body>
<header><b>STANDIN</b><nav class="links"><a href="/a">STANDIN about</a><a href="/b">STANDIN docs</a></nav><button type="button" id="menu" aria-expanded="false">Menu</button><button type="button" id="share" aria-expanded="false">Share</button><button type="button" id="login">Log in</button><button type="button" id="wallet">Connect wallet</button></header>
<h1>STANDIN heading</h1>
<div class="grid"><div class="colA"><p>STANDIN first column</p></div><div class="colB"><p>STANDIN second column</p></div></div>
<aside><p>STANDIN aside on wide screens</p></aside>
<div class="wide"><img alt="STANDIN banner" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div>
<div id="pop"><p>STANDIN copy the address</p></div><div id="panel"><a href="/a">STANDIN panel about</a> <a href="/b">STANDIN panel docs</a></div>
<script>
menu.onclick = () => { const open = menu.getAttribute("aria-expanded") !== "true"; menu.setAttribute("aria-expanded", String(open)); panel.classList.toggle("open", open); };
share.onclick = () => { const open = share.getAttribute("aria-expanded") !== "true"; share.setAttribute("aria-expanded", String(open)); pop.classList.toggle("open", open); };
login.onclick = () => fetch("/api/login", { method: "POST" });
wallet.onclick = () => fetch("/api/wallet", { method: "POST" });
</script></body></html>`;

const hits = [];
const server = createServer((req, res) => { if (req.url.startsWith("/api/")) hits.push(req.url); res.writeHead(200, { "content-type": req.url.startsWith("/api/") ? "application/json" : "text/html" }); res.end(req.url.startsWith("/api/") ? "{}" : PAGE); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const run = (a) => new Promise((resolve) => { const p = spawn(process.execPath, a, { stdio: ["ignore", "pipe", "pipe"], env }); let err = "", out = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", (d) => (out += d)); p.on("close", (status) => resolve({ status, err, out })); });

const work = mkdtempSync(join(tmpdir(), "capture-widths-"));
mkdirSync(join(work, "routes"), { recursive: true });
writeFileSync(join(work, "routes.json"), J({ site: origin, viewport: [1440, 900], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const desk = await run([join(here, "capture-route.mjs"), `${origin}/`, join(work, "routes", "page_home.json"), "--width", "1440", "--height", "900", "--settle", "1", "--frames", "0", "--states", "--assets", join(work, "source")]);
const wid = await run([join(here, "capture-widths.mjs"), join(work, "routes.json"), "--settle", "2"]);
const conv = await run([join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", join(work, "source")]);
server.close();
if (process.env.DEBUG) console.log(desk.err, wid.err, conv.err);
check("captured at 1440, read at 834 and 390, converted", desk.status === 0 && wid.status === 0 && conv.status === 0, (desk.err + wid.err + conv.err).trim().split("\n").slice(-4).join(" | "));

const read = (w) => { const f = join(work, "widths", `page_home.${w}.json`); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null; };
const t = read(834), ph = read(390);
check("(1) each width has its file, its parts placed", !!t && !!ph && Object.keys(t.parts).length > 5 && Object.keys(ph.parts).length > 5, J({ t: t && Object.keys(t.parts).length, ph: ph && Object.keys(ph.parts).length }));
const outside = (w) => w ? Object.entries(w.parts).filter(([, [x, , bw]]) => x < -1 || x + bw > w.width + 1).map(([p]) => p) : ["no file"];
check("(2) no part outside the page at either width (the wide picture cut to its frame)", outside(t).length === 0 && outside(ph).length === 0 && !t?.overflowX && !ph?.overflowX, J({ t: outside(t), ph: outside(ph) }));

/* The words of a path, from the desktop capture, to name the order by. */
const cap = JSON.parse(readFileSync(join(work, "routes", "page_home.json"), "utf8"));
const textOf = new Map(); (function walk(e) { if (e?.p) textOf.set(e.p, (e.text ?? "").trim()); for (const k of e?.kids ?? []) walk(k); })(cap.tree);
const said = (w) => (w?.order ?? []).map((p) => textOf.get(p)).filter(Boolean);
const before = (list, a, b) => list.indexOf(a) >= 0 && list.indexOf(b) >= 0 && list.indexOf(a) < list.indexOf(b);
check("(3) reading order: at 834 the first column then the second; at 390 the second first", before(said(t), "STANDIN first column", "STANDIN second column") && before(said(ph), "STANDIN second column", "STANDIN first column") && before(said(ph), "STANDIN heading", "STANDIN second column"), J({ t: said(t), ph: said(ph) }));

const asideP = [...textOf].find(([, w]) => w === "STANDIN aside on wide screens")?.[0];
const h1P = [...textOf].find(([, w]) => w === "STANDIN heading")?.[0];
check("(4) the aside hidden at 390 and showing at 834; the heading 30 px at 390, 48 at 834", !!asideP && ph?.hidden.includes(asideP) && !!t?.parts[asideP] && ph?.fonts[h1P]?.[0] === 30 && t?.fonts[h1P]?.[0] === 48, J({ asideP, hiddenPh: ph?.hidden.includes(asideP), t: t?.fonts[h1P], ph: ph?.fonts[h1P] }));

const menuTexts = (ph?.menu?.panel ?? []).map((x) => x.text ?? textOf.get(x.p) ?? "");
check("(5) the phone's Menu pressed once, its panel's links kept; Log in and Connect wallet never pressed", ph?.menu?.trigger?.label === "Menu" && menuTexts.some((w) => /panel about/.test(w)) && menuTexts.some((w) => /panel docs/.test(w)) && hits.length === 0 && !t?.menu?.panel?.length, J({ menu: ph?.menu && { label: ph.menu.trigger.label, panel: menuTexts }, hits, tablet: t?.menu }));

const doc = existsSync(join(work, "out", "site", "document.json")) ? JSON.parse(readFileSync(join(work, "out", "site", "document.json"), "utf8")) : {};
const L = doc.layouts ?? {};
const nodeIds = new Set((doc.nodes ?? []).map((n) => n.id));
const phone = L.phone?.pages?.page_home, tablet = L.tablet?.pages?.page_home;
check("(6) the document carries both widths by its own parts, the phone's menu among them", L.phone?.width === 390 && L.tablet?.width === 834 && !!phone && !!tablet && Object.keys(phone.place).length > 3 && Object.keys(phone.place).every((id) => nodeIds.has(id)) && phone.order.every((id) => nodeIds.has(id)) && !!phone.menu && phone.menu.panel.length >= 2, J({ keys: Object.keys(L), phone: phone && { placed: Object.keys(phone.place).length, order: phone.order.length, menu: phone.menu } }));

/* (7) As the Builder reads it: on each part. */
const pageParts = (doc.nodes ?? []).filter((n) => n.pageId === "page_home");
const has = (dev) => pageParts.filter((n) => n.widths?.[dev]).length;
const boxOk = (b) => b && ["x", "y", "w", "h"].every((k) => typeof b[k] === "number");
const asideNode = pageParts.find((n) => n.from?.selector && /aside on wide screens/.test(JSON.stringify(n.content ?? "")));
const menuNode = pageParts.find((n) => n.id.startsWith("n_ctaprimary_small_"));
check("(7) each part carries widths.tablet / widths.phone (hidden: true where not drawn), at least half the page's parts, capturedWidths, the phone's Menu a part of its own",
  has("phone") * 2 >= pageParts.length && has("tablet") * 2 >= pageParts.length && pageParts.filter((n) => n.widths).every((n) => Object.values(n.widths).every(boxOk))
  && (!asideNode || asideNode.widths?.phone?.hidden === true) && J(doc.capturedWidths) === J([1440, 834, 390])
  && !!menuNode && menuNode.w === 0 && menuNode.h === 0 && menuNode.widths?.phone?.w > 0 && menuNode.widths?.tablet?.hidden === true && L.phone.pages.page_home.menu.trigger === menuNode.id,
  J({ parts: pageParts.length, phone: has("phone"), tablet: has("tablet"), aside: asideNode?.widths, captured: doc.capturedWidths, menu: menuNode && { w: menuNode.w, widths: menuNode.widths } }));
check("(8) the Share high on the tablet's page is no menu: none recorded at 834", !t?.menu, J(t?.menu));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
