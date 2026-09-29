#!/usr/bin/env node
/**
 * A CANVAS WORLD IS AS TALL AS THE WINDOW MAKES IT, AS LIVE'S IS.
 *
 * parasiteonsol.fun's hero is a slide `height: clamp(520px, calc(100svh -
 * 64px - 18px - 86px), 900px)` (the owner's style.css): a grid whose `1fr`
 * row holds the world, and the world's canvas is `inset: 0; height: 100%`.
 * So at a 2000 × 1010 window live's canvas is 1119 × 813, where at the
 * capture's 900 it was 702. Ours kept 702 at any height: the parts inside
 * the slide were moved as it grew, never stretched.
 *
 * Held here on sink's own parasiteonsol.fun document (capture-consolidated),
 * loaded and published the way the Builder publishes it (`__studioExport`),
 * opened at 2000 wide and two window heights, 900 and 1010:
 *   · the slide is 732 and 842 tall (its clamp);
 *   · the world box and its canvas grow by the same 110: 706 → 816, 702 → 812,
 *     their tops and widths unchanged;
 *   · a part in the slide that does not fill it (the world's words) keeps
 *     its height;
 *   · and `vhStretch` says so alone: a part from the top to the foot grows, a
 *     short one or one outside the hero does not.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/world-height.mjs http://127.0.0.1:3013 [sink checkout]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const SINK = process.argv[3] ?? join(here, "..", "..", "sink");
const REF = process.env.SINK_REF ?? "origin/claude/capture-consolidated";
const FILE = "sites/parasiteonsol-fun/site/document.json";
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};
const J = (v) => JSON.stringify(v);
const near = (a, b, t = 3) => Number.isFinite(a) && Math.abs(a - b) <= t;

/* The rule alone. */
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { vhStretch } = await jiti.import(join(here, "..", "src", "features", "studio", "fluidSite.ts"));
const hero = { y: 82, h: 732 }, H = "clamp(520px, -168px + 100svh, 900px)";
check("vhStretch: the world (95 to 801 in a slide 82 to 814) grows with the slide", vhStretch({ y: 95, h: 706 }, hero, 732, H) === `calc(706px + (${H} - 732px))`, vhStretch({ y: 95, h: 706 }, hero, 732, H));
check("…a short part in it does not (the world's words, 382 tall)", vhStretch({ y: 97, h: 382 }, hero, 732, H) === null);
check("…nor one that stops well above its foot, nor one below it", vhStretch({ y: 95, h: 600 }, hero, 732, H) === null && vhStretch({ y: 900, h: 400 }, hero, 732, H) === null);

/* The document, as sink holds it. */
let raw;
try { raw = execFileSync("git", ["-C", SINK, "show", `${REF}:${FILE}`], { encoding: "utf8", maxBuffer: 1 << 30 }); } catch { raw = existsSync(join(SINK, FILE)) ? readFileSync(join(SINK, FILE), "utf8") : null; }
if (!raw) { console.log(`no ${FILE} in ${SINK}`); process.exit(1); }
const doc = JSON.parse(raw);
const home = doc.pages[0].id;
const heroNode = doc.nodes.find((n) => n.pageId === home && n.vh?.px);
const sel = heroNode?.from?.selector ?? "";
const kid = (rest) => doc.nodes.find((n) => n.pageId === home && n.from?.selector === `${sel}${rest}`);
const worldBox = kid(" > div:nth-of-type(2)"), canvas = kid(" > div:nth-of-type(2) > canvas"), words = kid(" > div:nth-of-type(2) > div:nth-of-type(2)");
check("sink's document has the slide, its world, the world's canvas and its words", !!(heroNode && worldBox && canvas && words), J([heroNode?.id, worldBox?.id, canvas?.id, words?.id]));

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const builder = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await builder.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await builder.evaluate(() => { localStorage.clear(); });
await builder.reload({ waitUntil: "networkidle" });
await builder.waitForTimeout(1000);
await builder.evaluate((d) => window.__studioLoadDoc(d), { ...doc, pages: [doc.pages[0]], nodes: doc.nodes.filter((n) => n.pageId === home) });
await builder.waitForTimeout(1500);
const files = await builder.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
check("the page publishes", Array.isArray(files) && files.some((f) => f.path === "index.html"), J(files?.map?.((f) => f.path)?.slice(0, 5)));
const out = mkdtempSync(join(tmpdir(), "world-height-"));
for (const f of files ?? []) { mkdirSync(dirname(join(out, f.path)), { recursive: true }); writeFileSync(join(out, f.path), f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
const server = http.createServer((req, res) => {
  let q = join(out, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, ""));
  if (existsSync(q) && statSync(q).isDirectory()) q = join(q, "index.html");
  if (!existsSync(q)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": q.endsWith(".html") ? "text/html" : q.endsWith(".css") ? "text/css" : q.endsWith(".js") ? "text/javascript" : "application/octet-stream" });
  res.end(readFileSync(q));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));

const measure = async (w, h) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await p.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  const box = (id) => p.evaluate((id) => { const el = document.getElementById(id); if (!el) return null; const r = el.getBoundingClientRect(); return [r.left, r.top + scrollY, r.width, r.height].map((v) => Math.round(v * 10) / 10); }, id);
  const cv = await p.evaluate((id) => { const c = document.getElementById(id)?.querySelector("[data-world-canvas]"); if (!c) return null; const r = c.getBoundingClientRect(); return [r.left, r.top + scrollY, r.width, r.height].map((v) => Math.round(v * 10) / 10); }, canvas.id);
  const got = { hero: await box(heroNode.id), world: await box(worldBox.id), canvas: await box(canvas.id), drawn: cv, words: await box(words.id) };
  await ctx.close();
  return got;
};
const a = await measure(2000, 900), b = await measure(2000, 1010);
console.log(`       at 2000 × 900: ${J(a)}\n       at 2000 × 1010: ${J(b)}`);
check("the slide is 732 tall in a 900 window and 842 in a 1010 one (its clamp)", near(a.hero?.[3], 732) && near(b.hero?.[3], 842), J([a.hero, b.hero]));
check("the world box grows with it: 706 → 816", near(a.world?.[3], 706) && near(b.world?.[3], 816), J([a.world, b.world]));
check("its canvas part too: 702 → 812", near(a.canvas?.[3], 702) && near(b.canvas?.[3], 812), J([a.canvas, b.canvas]));
check("…and the world drawn in it fills it", !!a.drawn && !!b.drawn && near(b.drawn[3], b.canvas[3], 2) && near(a.drawn[3], a.canvas[3], 2), J([a.drawn, b.drawn]));
check("their tops, lefts and widths stay as they were", ["world", "canvas"].every((k) => a[k] && b[k] && near(a[k][0], b[k][0], 1) && near(a[k][1], b[k][1], 1) && near(a[k][2], b[k][2], 1)), J({ a900: [a.world, a.canvas], b1010: [b.world, b.canvas] }));
check("a part in the slide that does not fill it keeps its height", near(a.words?.[3], b.words?.[3], 1), J([a.words, b.words]));

await browser.close();
server.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
