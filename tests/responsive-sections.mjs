/**
 * A CAPTURED SITE ON A PHONE: EACH SECTION WHERE THE LIVE SITE PUTS IT.
 *
 * A capture read at 1440, 834 and 390 (capture-widths.mjs) carries each
 * part's box at each width (`widths.tablet` / `widths.phone`). This opens the
 * converted document as a new site on the board, switches to Phone (or
 * Tablet), and reads where each section's part is drawn, against where the
 * live site put the same element at that window width
 * (`capture/site/capture/tools/widths-sections.mjs`). A table, and a check
 * per section: top within TOL px of the live one (and of the page's height,
 * as a share), width within TOL px.
 *
 *   npx next start -p 3021
 *   node tests/responsive-sections.mjs http://127.0.0.1:3021 <document.json> <live.json> [--device phone] [--tol 24] [--out table.md]
 *
 * Needs a capture of a site and its live read; no committed fixture holds
 * one, so the suite skips it when they are not given (exit 0, said).
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const BASE = (pos[0] ?? "http://localhost:3000").replace(/\/$/, "");
const DOC_FILE = pos[1], LIVE_FILE = pos[2];
if (!DOC_FILE || !LIVE_FILE || !existsSync(DOC_FILE) || !existsSync(LIVE_FILE)) { console.log("  skip  no capture and live read given (see the header)"); process.exit(0); }
const DEVICE = opt("--device", "phone");
const TOL = Number(opt("--tol", 24));
const doc = JSON.parse(readFileSync(DOC_FILE, "utf8"));
const live = JSON.parse(readFileSync(LIVE_FILE, "utf8"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* The section's own part: the one captured from the element the live read names by path. */
const page0 = doc.activePageId ?? doc.pages[0].id;
const nodes = doc.nodes.filter((n) => n.pageId === page0);
/* The capture's path (`body>main:1>section:3`) and the part's selector (`body > main > section:nth-of-type(3)`), in one form; a part a press shows (`state`) is not the section at rest. */
const norm = (s) => String(s ?? "").split(/\s*>\s*/).map((t) => { const m = /^([a-z0-9-]+)(?::nth-of-type\((\d+)\)|:(\d+))?$/i.exec(t); return m ? `${m[1].toLowerCase()}:${m[2] ?? m[3] ?? 1}` : t; }).join(">");
const partOf = (p) => nodes.find((n) => !n.state && norm(n.from?.selector) === norm(p)) ?? null;
const sections = Object.entries(live.sections).filter(([, s]) => s && !s.hidden).map(([sel, s]) => ({ sel, live: s, node: partOf(s.p) }));

/*
 * Brought in as a new site, the way a capture lands: a repository holding
 * the capture's folder (its document and pictures), answered here the way
 * GitHub would answer, and copied whole by Bring (tests/bring-lands.mjs).
 * The token is a placeholder the stub never reads.
 */
const SITE_DIR = dirname(dirname(resolve(DOC_FILE)));
const files = [];
const walk = (d) => { for (const f of readdirSync(join(SITE_DIR, d), { withFileTypes: true })) { const rel = d ? `${d}/${f.name}` : f.name; if (f.isDirectory()) { if (/^(site|assets)(\/pictures)?$/.test(rel) || rel === "assets") walk(rel); } else if (rel === "site/document.json" || rel.startsWith("assets/pictures/")) files.push(rel); } };
walk("");
const tree = [{ path: "package.json", type: "blob", sha: "pkg", size: 2 }, ...files.map((p, i) => ({ path: p, type: "blob", sha: `f${i}`, size: statSync(join(SITE_DIR, p)).size }))];
const REPO = "him/captured";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, headless: true, ...(process.env.CHROMIUM_ARGS ? { args: process.env.CHROMIUM_ARGS.trim().split(/\s+/) } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`${e.message} @ ${(e.stack ?? "").split("\n").slice(1, 4).join(" ")}`));
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const m = u.pathname.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
  if (!m || m[1] !== REPO) return j({ message: "Not Found" }, 404);
  const rest = m[2] ?? "";
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  if (rest === "/git/blobs/pkg") return j({ encoding: "base64", content: Buffer.from("{}").toString("base64") });
  const b = /^\/git\/blobs\/f(\d+)$/.exec(rest);
  if (b) return j({ encoding: "base64", content: readFileSync(join(SITE_DIR, files[Number(b[1])])).toString("base64") });
  return j({ message: "Not Found" }, 404);
});
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle", timeout: 120000 });
await page.evaluate(() => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Scratch", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click();
await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await page.waitForTimeout(500);
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill(REPO);
await page.locator("[data-repo-pull]").click();
await page.waitForTimeout(300);
if (await page.locator("[data-repo-bring-go]").count()) await page.locator("[data-repo-bring-go]").click();
let landed = 0;
for (let i = 0; i < 120 && landed < doc.nodes.length * 0.9; i++) { await page.waitForTimeout(1000); landed = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("builder.studio")).state.nodes.length; } catch { return 0; } }).catch(() => 0); }
check("the capture is brought in as a site, its parts on the board", landed >= doc.nodes.length * 0.9, `${landed} of ${doc.nodes.length} parts`);
await page.waitForTimeout(1500);
await page.waitForSelector("[data-device-switch]", { timeout: 60000 }).catch(async (e) => {
  await page.screenshot({ path: ".screenshots/responsive-no-switch.png" }).catch(() => {});
  console.log(` FAIL  the board opened — ${e.message.split("\n")[0]}; ${errors.slice(0, 3).join(" | ")}; ${(await page.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => ""))}`);
  process.exit(1);
});
await page.waitForTimeout(1500);
const kept = await page.evaluate((dev) => { try { const st = JSON.parse(localStorage.getItem("builder.studio")).state; return st.nodes.filter((n) => n.widths?.[dev]).length; } catch { return -1; } }, DEVICE);
check(`the board keeps each part's ${DEVICE} box`, kept === doc.nodes.filter((n) => n.widths?.[DEVICE]).length && kept > 0, `${kept} of ${doc.nodes.filter((n) => n.widths?.[DEVICE]).length}`);

await page.locator(`[data-device="${DEVICE}"]`).click();
await page.waitForSelector(`[data-small-frame="${DEVICE}"]`, { timeout: 20000 });
await page.waitForTimeout(1500);
const W = DEVICE === "phone" ? 390 : 834;
const board = await page.evaluate(([dev, W, ids]) => {
  const frame = document.querySelector(`[data-small-frame="${dev}"]`);
  const root = frame?.querySelector("[data-small-page]") ?? frame;
  if (!root) return null;
  const R = root.getBoundingClientRect();
  const k = R.width / W;
  const out = {};
  for (const id of ids) {
    const el = root.querySelector(`[data-live-node="${CSS.escape(id)}"]`);
    if (!el) { out[id] = null; continue; }
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    out[id] = { x: Math.round((r.left - R.left) / k), y: Math.round((r.top - R.top) / k), w: Math.round(r.width / k), h: Math.round(r.height / k), shown: cs.display !== "none" && r.height > 0 };
  }
  return { out, height: Math.round(R.height / k), mode: root.querySelector(".sm-root") ? "small" : "?" };
}, [DEVICE, W, sections.filter((s) => s.node).map((s) => s.node.id)]);
/*
 * A picture of each section on the board (`--shots dir`: <dir>/board-<section>.png),
 * cut from the screen where the section is drawn: the frame is zoomed, so a
 * picture of the frame element came out cut and offset.
 */
const SHOTS_DIR = opt("--shots", null);
if (SHOTS_DIR) {
  mkdirSync(SHOTS_DIR, { recursive: true });
  /* The bar above the page sticks over the section's top; it is not the page. */
  await page.addStyleTag({ content: "[data-small-bar]{visibility:hidden!important}" });
  for (const s of sections.filter((x) => x.node)) {
    const sel = `[data-small-frame="${DEVICE}"] [data-live-node="${s.node.id}"]`;
    await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: "start" })).catch(() => {});
    await page.waitForTimeout(400);
    const r = await page.locator(sel).first().boundingBox().catch(() => null);
    if (!r) continue;
    const vp = page.viewportSize();
    if (r.height + 120 > vp.height) { await page.setViewportSize({ width: vp.width, height: Math.ceil(r.height) + 160 }); await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: "start" })); await page.waitForTimeout(400); }
    const q = await page.locator(sel).first().boundingBox();
    await page.screenshot({ path: join(SHOTS_DIR, `board-${s.sel.replace(/[^a-z0-9]+/gi, "")}.png`), clip: { x: q.x, y: q.y, width: q.width, height: q.height } }).catch((e) => console.log(`  …  no picture of ${s.sel}: ${e.message.split("\n")[0]}`));
  }
}

/* The published site at the same window width: the same parts, the layout as rules under media queries (docs/RESPONSIVE.md §4). */
const exported = (await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null)).catch(() => null)) ?? [];
const byPath = new Map(exported.map((f) => [f.path.replace(/^\/+/, ""), f]));
if (opt("--export", null)) writeFileSync(opt("--export"), JSON.stringify(exported));
let pub = null;
if (byPath.get("index.html")) {
  const out = await browser.newPage({ viewport: { width: W, height: 844 } });
  await out.route("http://site.test/**", (r) => {
    const path = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/+/, "")) || "index.html";
    const f = byPath.get(path) ?? byPath.get(`${path}/index.html`.replace(/^\//, ""));
    if (!f) return r.fulfill({ status: 404, body: "" });
    const type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".png") ? "image/png" : path.endsWith(".svg") ? "image/svg+xml" : path.endsWith(".webp") ? "image/webp" : path.endsWith(".jpg") || path.endsWith(".jpeg") ? "image/jpeg" : "text/html";
    return r.fulfill({ status: 200, contentType: type, body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
  });
  await out.goto("http://site.test/index.html", { waitUntil: "load" });
  await out.waitForTimeout(1500);
  /* Scrolled through as the live read was, so what arrives on the way down has. */
  await out.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 140) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
  await out.waitForTimeout(1200);
  pub = await out.evaluate((ids) => {
    const o = {};
    for (const id of ids) { const el = document.getElementById(id); if (!el) { o[id] = null; continue; } const r = el.getBoundingClientRect(); o[id] = { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), shown: getComputedStyle(el).display !== "none" && r.height > 0 }; }
    /* What reaches below the live page's foot: the first few, by how far. */
    const foot = Math.max(...Object.values(o).filter(Boolean).map((b) => b.y + b.h));
    const below = [...document.querySelectorAll("[id]")].map((el) => { const r = el.getBoundingClientRect(); return { id: el.id, cls: String(el.className).slice(0, 40), y: Math.round(r.top + scrollY), h: Math.round(r.height), pos: getComputedStyle(el).position, disp: getComputedStyle(el).display }; }).filter((b) => b.h > 0 && b.y + b.h > foot + 20).sort((a, b) => b.y + b.h - (a.y + a.h)).slice(0, 12);
    const chain = below[0] ? (() => { const out = []; for (let e = document.getElementById(below[0].id); e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e); out.push(`${e.id || "."}${e.className ? `[${String(e.className).slice(0, 30)}]` : ""}:${c.position}/${c.display}@${Math.round(e.getBoundingClientRect().top + scrollY)}`); } return out.join(" < "); })() : "";
    return { out: o, height: document.documentElement.scrollHeight, sideways: document.documentElement.scrollWidth - innerWidth, below, chain };
  }, sections.filter((s) => s.node).map((s) => s.node.id));
  if (pub.below.length) console.log(`  …  published, below the last section's foot: ${pub.below.map((b) => `${b.id}(${b.pos}) y${b.y} h${b.h}`).join(", ")}`);
  if (pub.chain) console.log(`  …  ${pub.chain}`);
  if (opt("--pubshot", null)) await out.screenshot({ path: opt("--pubshot"), fullPage: true });
  await out.close();
}
check("the published site was written", !!pub);

const rows = [];
for (const s of sections) {
  const b = s.node ? board?.out[s.node.id] : null;
  const L = s.live;
  const dy = b ? b.y - L.y : null, dh = b ? b.h - L.h : null, dx = b ? b.x - L.x : null, dw = b ? b.w - L.w : null;
  const p = s.node && pub ? pub.out[s.node.id] : null;
  rows.push({ sel: s.sel, part: s.node?.id ?? "(no part)", live: L, board: b, pub: p, dy, dh, dx, dw });
  check(`${s.sel}: drawn at ${DEVICE}, top and width within ${TOL}px of the live site`, !!b && b.shown && Math.abs(dy) <= TOL && Math.abs(dw) <= TOL && Math.abs(dx) <= TOL, b ? `live y ${L.y} w ${L.w}, board y ${b.y} w ${b.w} (dy ${dy}, dx ${dx}, dw ${dw}, dh ${dh})` : s.node ? "not drawn" : "no part for it");
  if (pub) check(`${s.sel}: published at ${W}, top and width within ${TOL}px of the live site`, !!p && p.shown && Math.abs(p.y - L.y) <= TOL && Math.abs(p.w - L.w) <= TOL && Math.abs(p.x - L.x) <= TOL, p ? `published y ${p.y} w ${p.w} (dy ${p.y - L.y})` : "not there");
}
const fmt = (v) => (v == null ? "–" : String(v));
const table = [
  `| section | live y | board y | dy | published y | dy | live h | board h | published h | live x,w | board x,w | published x,w |`,
  `|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|`,
  ...rows.map((r) => `| ${r.sel} | ${r.live.y} | ${fmt(r.board?.y)} | ${fmt(r.dy)} | ${fmt(r.pub?.y)} | ${r.pub ? r.pub.y - r.live.y : "–"} | ${r.live.h} | ${fmt(r.board?.h)} | ${fmt(r.pub?.h)} | ${r.live.x},${r.live.w} | ${r.board ? `${r.board.x},${r.board.w}` : "–"} | ${r.pub ? `${r.pub.x},${r.pub.w}` : "–"} |`),
  ``,
  `page height: live ${live.pageHeight}, board ${board?.height ?? "–"}, published ${pub?.height ?? "–"} (sideways ${pub?.sideways ?? "–"}); ${DEVICE} at ${W}; tolerance ${TOL}px.`,
].join("\n");
console.log(`\n${table}\n`);
if (opt("--out", null)) writeFileSync(opt("--out"), table + "\n");
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
