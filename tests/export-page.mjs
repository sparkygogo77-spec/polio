#!/usr/bin/env node
/**
 * One page of the site as HTML and CSS, against the board's own drawing of it.
 *
 * HIS RULING: output HTML and CSS first. One width, the width the site was
 * captured at, and nothing invented for any other.
 *
 * The page is exported, served on its own (no app, no app stylesheet), and
 * held to the preview of the same page, which is the board's drawing without
 * the editor round it and at 100% rather than the board's zoom. Every
 * expectation is read off the preview or the document, never written in:
 *   · every part stands where the preview stood it, at its size (the price
 *     box among them);
 *   · every run of words keeps its text, its order, its colour, its face,
 *     its size and whether it is a link (the wordmark's three runs, "Works"
 *     white, among them);
 *   · the carried faces are declared, without where they came from;
 *   · the six roles are custom properties on :root, equal to the board's
 *     palette, and the page refers to them;
 *   · nothing in the exported files is the capture or his working;
 *   · and the pixels: both pictures settled (two in a row agreeing), then
 *     compared, with where the difference is worst. The bar is 1% of the
 *     page's pixels, a CONVENTION: nothing measured says 1% is right.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/export-page.mjs http://127.0.0.1:3013 <path to a sink checkout> [page id]
 *   EXPORTER=publish …   the same checks on what Publish sends today
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { gunzipSync } from "node:zlib";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3];
const OUT = process.argv[4] ?? null;
if (!SINK || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node tests/export-page.mjs <builder url> <path to a sink checkout> [page id]");
  process.exit(2);
}
const DOC = readFileSync(join(SINK, "site/document.json"));
const doc = JSON.parse(DOC.toString("utf8"));
const byId = new Map(doc.nodes.map((n) => [n.id, n]));
const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
const REPO = "/repos/sparkygogo77-spec/sink";
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
  ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
];

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  if (!u.pathname.startsWith(REPO)) return j({ message: "no" }, 404);
  const rest = u.pathname.slice(REPO.length);
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: DOC.toString("base64") });
  const pic = decodeURIComponent(rest).match(/^\/git\/blobs\/pic:(.+)$/);
  if (pic) return j({ encoding: "base64", content: readFileSync(join(SINK, "assets/pictures", pic[1])).toString("base64") });
  return j({ message: "no" }, 404);
});

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
/** Every part's [page, y, h] as saved. */
const positions = async () => Object.fromEntries(((await state()).nodes ?? []).map((n) => [n.id, [n.pageId, n.y, n.h]]));

/* An empty site, opened first. */
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/* A placeholder token, through the Keys panel, the way his goes in. */
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

/* The door. */
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
await page.locator("[data-repo-pull]").click();
for (let i = 0; i < 90 && ((await state()).nodes?.length ?? 0) < 100; i++) await page.waitForTimeout(1000);
await page.waitForTimeout(3000);

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const ROLES = ["bg", "surface", "text", "muted", "accent", "highlight"];
const s = await state();
const PAGE = process.argv[4] || s.pages[0].id;
const home = s.pages[0].id;
const onPage = s.nodes.filter((n) => n.pageId === PAGE);
console.log(`  page ${PAGE}: ${onPage.length} parts; frame ${s.frameWidth}px`);

/* ------------------------------------------------------------------ */
/* The export                                                          */
/* ------------------------------------------------------------------ */

let files = null;
if (process.env.EXPORTER === "publish") {
  let pushed = null;
  await page.route("**/api/studio/publish", async (r) => {
    if (r.request().method() === "POST") { pushed = JSON.parse(r.request().postData() ?? "{}");
    /* Text goes packed (`publish()` in agent.ts): read what the route will commit. */
    pushed.files = (pushed.files ?? []).map((f) => (f.encoding === "gzip" ? { path: f.path, content: gunzipSync(Buffer.from(f.content, "base64")).toString("utf8") } : f)); return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, sha: "0", commitUrl: "https://example.invalid/c", branch: "main", repo: "someone/site", files: 0, deployed: false, hook: false }) }); }
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: true, token: "browser", repo: "someone/site", branch: "main", missing: [], allow: null }, vercel: { hook: false } }) });
  });
  await page.evaluate(() => window.__studioOpenBrief?.());
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Push to GitHub/ }).first().click({ timeout: 15000 }).catch(() => {});
  for (let i = 0; i < 120 && !pushed; i++) await page.waitForTimeout(500);
  files = pushed?.files ?? null;
  await page.keyboard.press("Escape");
} else {
  files = await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
}
check("the exporter gave files", Array.isArray(files) && files.length > 0, files ? `${files.length} files: ${files.map((f) => f.path).join(", ").slice(0, 200)}` : "no exporter");
files = files ?? [];
if (!files.length) {
  /* Nothing to open: every check below fails, said once, rather than a crash standing in for a red. */
  check("the exported page, its parts, its runs, its faces, its palette and its pixels", false, "there is no export to hold to anything");
  await browser.close();
  console.log(`\n${results.filter((r) => !r).length} FAILED — ${results.filter((r) => r).length}/${results.length}`);
  process.exit(1);
}
const pageFile = files.find((f) => f.path === (PAGE === home ? "index.html" : `${(s.pages.find((p) => p.id === PAGE).path || PAGE).replace(/^\/+|\/+$/g, "").toLowerCase().replace(/[^a-z0-9/_-]+/g, "-")}/index.html`));
const css = files.filter((f) => f.path.endsWith(".css")).map((f) => f.content).join("\n");
const text = files.filter((f) => f.encoding !== "base64").map((f) => f.content).join("\n");

/* ------------------------------------------------------------------ */
/* The reference: the preview of the same page, at 100%                 */
/* ------------------------------------------------------------------ */

await page.setViewportSize({ width: s.frameWidth + 200, height: 1000 });
await page.evaluate((id) => { const raw = JSON.parse(localStorage.getItem("builder.studio")); raw.state.activePageId = id; localStorage.setItem("builder.studio", JSON.stringify(raw)); }, PAGE);
const pagePath = PAGE === home ? "" : (s.pages.find((p) => p.id === PAGE).path || "");
await page.goto(`${BASE}/builder/preview${pagePath === "/" ? "" : pagePath}`, { waitUntil: "networkidle" });
/* At the width the site was captured at: the Desktop frame, not the window view the Preview opens in (`live/previewWindow.ts`). */
await page.evaluate(() => window.__studioLiveDevice?.("desktop"));
await page.waitForTimeout(600);
await page.waitForTimeout(2500);

/*
 * What a page draws, read the same way from either: every part's box, and every run of words in order.
 *
 * WHETHER WORDS ARE A LINK is read differently on each side, on purpose. In
 * the export only a real `<a href>` counts: a span with a role is not a link
 * a person can follow, and counting one is how the export shipped 83 dead
 * links with this check green. In the preview a link is pressed by React, so
 * there it is what the document says: words inside a run link or a
 * link-whole wrapper, or words of a part that carries a link (inside its
 * button, where it has one). tests/export-links.mjs holds the links whole.
 */
const READ = ({ rootSel, partSel, linked = null }) => {
  const root = document.querySelector(rootSel);
  if (!root) return null;
  const R = root.getBoundingClientRect();
  const parts = {};
  for (const el of root.querySelectorAll(partSel)) {
    const id = el.getAttribute("data-live-node") ?? el.id;
    const r = el.getBoundingClientRect();
    const runs = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const words = t.textContent.replace(/\s+/g, " ").trim();
      if (!words) continue;
      const cs = getComputedStyle(t.parentElement);
      const at = t.parentElement;
      const link = linked
        ? !!at.closest("[data-run-link], [data-link-whole]") || (linked.includes(id) && (!el.querySelector("button") || !!at.closest("button")))
        : !!at.closest("a[href]");
      runs.push({ words, color: cs.color, face: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(), size: cs.fontSize, link });
    }
    parts[id] = { x: Math.round(r.left - R.left), y: Math.round(r.top - R.top), w: Math.round(r.width), h: Math.round(r.height), runs };
  }
  return { w: Math.round(R.width), h: Math.round(R.height), parts };
};
const scale = await page.evaluate(() => { const r = document.querySelector("[data-live-page]")?.getBoundingClientRect(); const w = document.querySelector("[data-live-page]")?.offsetWidth; return r && w ? r.width / w : 0; });
check("the reference is the preview at 100%", Math.abs(scale - 1) < 0.001, `scale ${scale}`);
let ref = await page.evaluate(READ, { rootSel: "[data-live-page]", partSel: "[data-live-node]", linked: s.nodes.filter((n) => n.link?.target).map((n) => n.id) });
/* Taller than the page, so neither picture is cut by a window or a scrolling panel. */
const TALL = Math.max(1000, (ref?.h ?? 0) + 400);
await page.setViewportSize({ width: s.frameWidth + 200, height: TALL });
await page.waitForTimeout(1500);
ref = await page.evaluate(READ, { rootSel: "[data-live-page]", partSel: "[data-live-node]", linked: s.nodes.filter((n) => n.link?.target).map((n) => n.id) });

/* ------------------------------------------------------------------ */
/* The export, served on its own                                        */
/* ------------------------------------------------------------------ */

/* At the capture's own width, where a captured site draws 1:1 as captured
   (tests/fluid-site.mjs). And at the capture's window height when the page
   has bands the capture found fixed: they are pinned to the window, as the
   original's were, so that is the window they stand as captured in
   (the foot of the lowest one). Read there, then pinned to the page where
   they stood, so the tall picture below holds them in the same place. */
const bandFoot = Math.max(0, ...onPage.filter((n) => n.from?.position === "fixed").map((n) => (n.y ?? 0) + n.h));
const out = await browser.newPage({ viewport: { width: s.frameWidth, height: bandFoot || TALL } });
const outErrors = [];
out.on("pageerror", (e) => outErrors.push(e.message));
const asked = [];
await out.route("http://export.local/**", (r) => {
  const p = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, "") || "index.html";
  const f = files.find((x) => x.path === p);
  if (!f) { asked.push(p); return r.fulfill({ status: 404, body: "" }); }
  const type = p.endsWith(".html") ? "text/html" : p.endsWith(".css") ? "text/css" : p.endsWith(".png") ? "image/png" : p.endsWith(".jpg") || p.endsWith(".jpeg") ? "image/jpeg" : p.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
  return r.fulfill({ status: 200, contentType: type, body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
});
/* Anything else the exported page asks for is outside the tree, and is refused and counted. */
const outside = [];
await out.route(/^(?!http:\/\/export\.local\/).*/, (r) => { outside.push(r.request().url().slice(0, 80)); return r.fulfill({ status: 404, body: "" }); });
await out.goto(`http://export.local/${pageFile?.path ?? "index.html"}`, { waitUntil: "networkidle" }).catch(() => {});
await out.evaluate(() => document.fonts?.ready);
await out.waitForTimeout(1500);
if (bandFoot) {
  await out.evaluate(() => {
    const root = document.querySelector("[data-page]") ?? document.body;
    const R = root.getBoundingClientRect();
    const fixed = [...document.querySelectorAll("*")].filter((e) => getComputedStyle(e).position === "fixed");
    const at = fixed.map((e) => { const r = e.getBoundingClientRect(); return [e, r.left - R.left, r.top - R.top, r.height]; });
    for (const [e, x, y, h] of at) Object.assign(e.style, { position: "absolute", left: `${x}px`, top: `${y}px`, bottom: "auto", height: `${h}px`, minHeight: `${h}px` });
  });
  /* A page that fitted the capture's window is published the window's height, without the preview's room below its last part (tests/fluid-site.mjs): for the picture it is given the preview's height back, which is bare page in both. */
  await out.evaluate((h) => { const pg = document.querySelector("[data-page]"); if (pg && pg.style.height.startsWith("max(100vh")) pg.style.height = `${h}px`; }, ref?.h ?? 0);
  await out.setViewportSize({ width: s.frameWidth, height: TALL });
  await out.waitForTimeout(300);
}
/* The exported page's root and parts: this exporter's own marks, or the preview's where an export kept those. */
const marks = await out.evaluate(() => (document.querySelector("[data-page]") ? { rootSel: "[data-page]", partSel: "[data-page] [id]", shotSel: "[data-page]" } : { rootSel: "[data-live-page]", partSel: "[data-live-node]", shotSel: "[data-live-page]" }));
const got = await out.evaluate(READ, marks);
check("the exported page opens on its own and asks for nothing outside the tree", !!got && outside.length === 0 && asked.length === 0 && outErrors.length === 0,
  `${got ? "" : "no page root; "}${outside.length} outside (${outside.slice(0, 2).join(", ")}), ${asked.length} missing (${asked.slice(0, 3).join(", ")}), ${outErrors.length} errors`);

/* ------------------------------------------------------------------ */
/* 1. Every part where the board stood it                               */
/* ------------------------------------------------------------------ */

const ids = Object.keys(ref?.parts ?? {});
/* A band fixed at the top is published as tall as the space the page leaves it (tests/fluid-site.mjs): the top of the first part not inside it that starts within it. */
const clipTo = new Map(onPage.filter((n) => n.from?.position === "fixed" && (n.y ?? 0) <= 1.5).map((n) => {
  const inside = (q) => q.from?.selector?.startsWith(`${n.from.selector} > `);
  const below = onPage.filter((q) => q !== n && q.from?.selector && !inside(q) && q.y > n.y + 1.5 && q.y < n.y + n.h - 1.5 && q.x < n.x + n.w && q.x + q.w > n.x);
  return [n.id, below.length ? Math.min(...below.map((q) => q.y)) - n.y : null];
}).filter(([, h]) => h !== null));
const moved = ids.filter((id) => { const a = ref.parts[id], b = got?.parts?.[id]; const h = clipTo.get(id) ?? a.h; return !b || Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1 || Math.abs(a.w - b.w) > 1 || Math.abs(h - b.h) > 1; });
check(`every part stands where the preview stands it, at its size (${ids.length} parts)`, ids.length > 0 && moved.length === 0,
  moved.slice(0, 4).map((id) => { const a = ref.parts[id], b = got?.parts?.[id]; return `${id} ${a.x},${a.y} ${a.w}×${a.h} → ${b ? `${b.x},${b.y} ${b.w}×${b.h}` : "missing"}`; }).join("; ") + (moved.length > 4 ? ` …and ${moved.length - 4} more` : ""));
const priceBox = onPage.find((n) => /\$\s*\d/.test(typeof n.content === "string" ? n.content : (n.content ?? []).map((x) => x.text).join("")));
if (priceBox) check(`the price box keeps its recorded width (${priceBox.id}, ${priceBox.w}px)`, got?.parts?.[priceBox.id]?.w === ref.parts[priceBox.id]?.w, `${ref.parts[priceBox.id]?.w} → ${got?.parts?.[priceBox.id]?.w}`);

/* ------------------------------------------------------------------ */
/* 2. Every run of words, in order, in its colour, face and size        */
/* ------------------------------------------------------------------ */

const runKey = (r) => `${r.words}|${r.color}|${r.face}|${r.size}|${r.link ? "link" : ""}`;
const wrongRuns = ids.filter((id) => (ref.parts[id].runs.map(runKey).join(" ¦ ")) !== ((got?.parts?.[id]?.runs ?? []).map(runKey).join(" ¦ ")));
const nRuns = ids.reduce((a, id) => a + ref.parts[id].runs.length, 0);
check(`every run of words keeps its text, order, colour, face, size and link (${nRuns} runs)`, nRuns > 0 && wrongRuns.length === 0,
  wrongRuns.slice(0, 2).map((id) => `${id}: ${ref.parts[id].runs.map(runKey).join(" ¦ ")} → ${(got?.parts?.[id]?.runs ?? []).map(runKey).join(" ¦ ")}`).join(" || ").slice(0, 400));
const mark = onPage.find((n) => Array.isArray(n.content) && n.content.map((x) => x.text.trim()).filter(Boolean).join("|") === "A Sol|Works|project");
if (mark) {
  const r = got?.parts?.[mark.id]?.runs ?? [];
  check("the wordmark is three runs with \"Works\" white", r.length === 3 && r[1]?.words === "Works" && r[1]?.color === "rgb(255, 255, 255)", r.map((x) => `${x.words} ${x.color}`).join(" / "));
}

/* ------------------------------------------------------------------ */
/* 3. The faces, and the palette                                        */
/* ------------------------------------------------------------------ */

const faces = (s.look?.fonts ?? []).map((f) => f.family);
const declared = faces.filter((f) => new RegExp(`@font-face\\s*{[^}]*font-family:\\s*["']?${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(css));
check(`the carried faces are declared (${faces.join(", ") || "none"})`, declared.length === faces.length, `${declared.length} of ${faces.length}`);
const loaded = await out.evaluate((faces) => faces.filter((f) => document.fonts.check(`16px "${f}"`)), faces);
check("…and loaded in the exported page", loaded.length === faces.length, `${loaded.length} of ${faces.length}`);
const rootVars = await out.evaluate((R) => Object.fromEntries(R.map((r) => [r, getComputedStyle(document.documentElement).getPropertyValue(`--${r}`).trim()])), ROLES);
const canon = (list) => out.evaluate((list) => list.map((c) => { const e = document.createElement("i"); e.style.color = c; document.body.append(e); const v = getComputedStyle(e).color; e.remove(); return v; }), list);
const want = await canon(ROLES.map((r) => s.look.palette[r]));
const have = await canon(ROLES.map((r) => rootVars[r] || "transparent"));
const offRoles = ROLES.filter((r, i) => want[i] !== have[i]);
check("the six roles are custom properties on :root, equal to the board's palette", offRoles.length === 0, offRoles.map((r) => `--${r} "${rootVars[r]}"`).join("; "));
const followed = ROLES.filter((r) => (s.look?.paletteFrom?.[r]?.parts ?? 0) > 0);
const unused = followed.filter((r) => !new RegExp(`var\\(--${r}\\b`).test(text));
check("…and the page refers to every role his parts follow", followed.length > 0 && unused.length === 0, unused.length ? `never referred to: ${unused.join(", ")}` : `${followed.length} roles referred to`);

/* ------------------------------------------------------------------ */
/* 4. Nothing of the capture or his working                             */
/* ------------------------------------------------------------------ */

const secrets = [];
for (const n of s.nodes) for (const v of [n.prompt, n.data, n.from?.url, n.from?.selector]) if (typeof v === "string" && v.trim().length >= 16) secrets.push(v.trim());
for (const p of s.pages) if ((p.prompt ?? "").trim().length >= 16) secrets.push(p.prompt.trim());
const hosts = [...new Set(s.nodes.map((n) => n.from?.host).filter(Boolean))];
const leaks = [...secrets.filter((v) => text.includes(v)).map((v) => v.slice(0, 40)), ...(/Captured from/.test(text) ? ["Captured from"] : []), ...hosts.filter((h) => text.includes(h)), ...(/body > (div|header|main|aside|footer)\b/.test(text) ? ["an element path"] : [])];
check("nothing in the exported files is the capture or his working", leaks.length === 0, leaks.slice(0, 3).join("; "));

/* ------------------------------------------------------------------ */
/* 4b. Every letter where the preview puts it                           */
/* ------------------------------------------------------------------ */

/*
 * Boxes are compared to the pixel and runs by their style; this holds the
 * letters themselves, each to a thousandth of a pixel, so a layout that
 * drifted by less than a pixel cannot hide inside "the letter edges differ".
 */
const GLYPHS = ([rootSel, partAttr, ids]) => {
  const root = document.querySelector(rootSel); if (!root) return {};
  const R = root.getBoundingClientRect(); const out = {};
  for (const id of ids) {
    const el = root.querySelector(`[${partAttr}="${CSS.escape(id)}"]`); if (!el) continue;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let i = 0;
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      if (!t.textContent.trim()) continue;
      const range = document.createRange();
      for (let k = 0; k < t.textContent.length; k++) { range.setStart(t, k); range.setEnd(t, k + 1); const r = range.getBoundingClientRect(); if (r.width) out[`${id}#${i}#${k}`] = [r.left - R.left, r.top - R.top, r.width, r.height]; }
      i++;
    }
  }
  return out;
};
const gA = await page.evaluate(GLYPHS, ["[data-live-page]", "data-live-node", ids]);
const gB = await out.evaluate(GLYPHS, [marks.rootSel, marks.rootSel === "[data-page]" ? "id" : "data-live-node", ids]);
const gKeys = Object.keys(gA);
const gOff = gKeys.filter((k) => !gB[k] || gA[k].some((v, i) => Math.abs(v - gB[k][i]) > 0.001));
check(`every letter stands where the preview stands it, to 0.001px (${gKeys.length} letters)`, gKeys.length > 0 && gOff.length === 0 && Object.keys(gB).length === gKeys.length,
  gOff.slice(0, 3).map((k) => `${k}: ${gA[k].map((v) => v.toFixed(3)).join(",")} → ${gB[k] ? gB[k].map((v) => v.toFixed(3)).join(",") : "missing"}`).join("; "));

/* ------------------------------------------------------------------ */
/* 5. The pixels                                                        */
/* ------------------------------------------------------------------ */

const settled = async (p, sel) => {
  const shot = async () => (await p.locator(sel).first().screenshot({ animations: "disabled" })).toString("base64");
  let last = await shot();
  for (let i = 0; i < 5; i++) { await p.waitForTimeout(700); const next = await shot(); if (next === last) return last; last = next; }
  return null;
};
await page.mouse.move(1, 1); await out.mouse.move(1, 1);
const A = await settled(page, "[data-live-page]");
const B = got ? await settled(out, marks.shotSel) : null;
const cmp = A && B ? await out.evaluate(async ([a, b]) => {
  const load = async (s) => { const i = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob()); const c = new OffscreenCanvas(i.width, i.height); const x = c.getContext("2d"); x.drawImage(i, 0, 0); return { w: i.width, h: i.height, d: x.getImageData(0, 0, i.width, i.height).data }; };
  const P = await load(a), Q = await load(b);
  const w = Math.min(P.w, Q.w), h = Math.min(P.h, Q.h);
  const cells = new Map(); let n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * P.w + x) * 4, j = (y * Q.w + x) * 4;
    if (Math.abs(P.d[i] - Q.d[j]) + Math.abs(P.d[i + 1] - Q.d[j + 1]) + Math.abs(P.d[i + 2] - Q.d[j + 2]) > 12) {
      n++; const k = `${Math.floor(x / 100) * 100},${Math.floor(y / 100) * 100}`; cells.set(k, (cells.get(k) ?? 0) + 1);
    }
  }
  return { size: `${P.w}×${P.h} vs ${Q.w}×${Q.h}`, n, share: 100 * n / (Math.max(P.w, Q.w) * Math.max(P.h, Q.h)), worst: [...cells].sort((a, b) => b[1] - a[1]).slice(0, 6) };
}, [A, B]) : null;
if (cmp) {
  console.log(`  pixels: ${cmp.size}; ${cmp.n} differ (${cmp.share.toFixed(2)}% of the page)`);
  console.log(`  worst 100px cells (x,y: px differing of 10000): ${cmp.worst.map(([k, v]) => `${k}: ${v}`).join("; ")}`);
  if (process.env.SHOTS) { const fs = await import("node:fs"); fs.writeFileSync(`${process.env.SHOTS}/ref-${PAGE}.png`, Buffer.from(A, "base64")); fs.writeFileSync(`${process.env.SHOTS}/out-${PAGE}.png`, Buffer.from(B, "base64")); }
}
/*
 * THE CONVENTION THE BAR IS MEASURED UNDER, accepted by the coordinator once
 * it was diagnosed rather than tuned to: the preview draws its page inside a
 * composited layer and Chromium rasterises words differently there, so the
 * exported page is lifted onto a layer of its own FOR THE PICTURE ONLY
 * (never in the export). Measured across all nine sink pages, the
 * difference without it was 37 to 47 px per letter on every page, the same
 * rate whatever the page, with every letter in the same place to 0.001px
 * (checked above): a rate that scales with how much text a page has, not a
 * fault in any page. Both numbers are printed.
 */
let layered = null;
if (A && B) {
  await out.evaluate(() => { const r = document.querySelector("[data-page], [data-live-page]"); if (r) r.style.willChange = "transform"; });
  await out.waitForTimeout(500);
  const B2 = await settled(out, marks.shotSel);
  await out.evaluate(() => { const r = document.querySelector("[data-page], [data-live-page]"); if (r) r.style.willChange = ""; });
  layered = B2 ? await out.evaluate(async ([a, b]) => {
    const load = async (s) => { const i = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob()); const c = new OffscreenCanvas(i.width, i.height); const x = c.getContext("2d"); x.drawImage(i, 0, 0); return { w: i.width, h: i.height, d: x.getImageData(0, 0, i.width, i.height).data }; };
    const P = await load(a), Q = await load(b); if (P.w !== Q.w || P.h !== Q.h) return { n: -1, share: 100, worst: [] }; let n = 0; const cells = new Map();
    for (let i = 0; i < P.d.length; i += 4) if (Math.abs(P.d[i] - Q.d[i]) + Math.abs(P.d[i + 1] - Q.d[i + 1]) + Math.abs(P.d[i + 2] - Q.d[i + 2]) > 12) { n++; const x = (i / 4) % P.w, y = Math.floor(i / 4 / P.w); const k = `${Math.floor(x / 100) * 100},${Math.floor(y / 100) * 100}`; cells.set(k, (cells.get(k) ?? 0) + 1); }
    return { n, share: 100 * n / (P.w * P.h), worst: [...cells].sort((a, b) => b[1] - a[1]).slice(0, 6) };
  }, [A, B2]) : null;
  const letters = gKeys.length;
  console.log(`  as exported: ${cmp?.n} px (${cmp?.share.toFixed(2)}%), ${letters ? (cmp.n / letters).toFixed(1) : "-"} px per letter`);
  console.log(`  on its own layer, as the preview's page is: ${layered?.n} px (${layered?.share.toFixed(2)}%); worst ${(layered?.worst ?? []).map(([k, v]) => `${k}: ${v}`).join("; ")}`);
  if (process.env.SHOTS && B2) { const fs = await import("node:fs"); fs.writeFileSync(`${process.env.SHOTS}/out-layer-${PAGE}.png`, Buffer.from(B2, "base64")); }
}
check("both pictures settled", !!A && !!B, `${A ? "" : "the preview never settled; "}${B ? "" : "the export never settled or has no page"}`);
check("the export draws within 1% of the preview's pixels, lifted onto a layer of its own as the preview's page is (a convention, not a measured bar)",
  !!cmp && cmp.size.split(" vs ")[0] === cmp.size.split(" vs ")[1] && !!layered && layered.n >= 0 && layered.share <= 1,
  layered ? `${layered.share.toFixed(2)}% on its own layer, ${cmp.share.toFixed(2)}% as exported, ${cmp.size}` : "");

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
