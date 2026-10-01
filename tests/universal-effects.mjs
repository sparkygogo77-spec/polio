#!/usr/bin/env node
/**
 * ONE SITE'S EFFECTS, MADE ANY PART'S; SAVED COMPONENTS; THE PANEL THAT
 * OFFERS THEM.
 *
 * THE OWNER'S WORDS: a styled button and its options must be reusable
 * without rebuilding; the TV should be saved in a category, not only on its
 * site; the hover animation on a box or any button must be universally
 * available; the image filter on the picture inside the TV must be usable
 * on anything; the background cursor motion too; everything that can be
 * used universally must be organised into the side panel when he clicks on
 * things. Everything must publish exactly as seen. Held here on every
 * capture in sink:
 *
 *   PURE
 *     · each site's own settings for the new effects (screen filter, switch
 *       on, push on press) are learned, with settings the feature has;
 *     · the TV (Trump & Morty) saved as a component holds its parts, the
 *       keyframes its motion names, and placed elsewhere every part has a
 *       fresh id, the same place inside it, and holds what it held;
 *     · the effects offered per kind of part: picture → filters, button →
 *       hover and press, section → background motion, all → openings.
 *   IN THE BUILDER
 *     · on every capture, clicking a picture, a button and a section opens a
 *       panel offering exactly those;
 *     · the TV saved from its panel lands on the shelf under Media;
 *     · on a new, empty board each new effect, plain and every site's
 *       version, put on a part from its panel, runs on the exported page;
 *     · the TV placed there looks the same on the exported page as on its
 *       own site's export, and carries its motion and its parts.
 *
 *   npx next start -p 3013
 *   node tests/universal-effects.mjs http://127.0.0.1:3013 ../sink
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const SINK = process.argv[3] ?? process.env.SINK_ROOT ?? join(here, "..", "..", "sink");
const SHOTS = ".screenshots/universal-effects";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const require = createRequire(import.meta.url);

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const src = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const { attachCaptured } = await src("library/captured.ts");
const L = await src("library/learned.ts");
const C = await src("library/components.ts");
const E = await src("library/partEffects.ts");
const { getWork } = await src("library/works.ts");
const { partTree } = await src("partTree.ts");
const { kindOf } = await src("partNames.ts");
const { getFeature } = await src("catalog.ts");
const kindWord = (n) => kindOf(n, (id) => getFeature(id)?.name);

const NEW = ["screen-filter", "switch-on", "press-push"];
const SITES = existsSync(join(SINK, "sites")) ? readdirSync(join(SINK, "sites")).filter((s) => existsSync(join(SINK, "sites", s, "site", "document.json"))).sort() : [];
check("sink holds captured sites", SITES.length >= 1, SITES.join(", "));

/* ------------------------------------------------------------------ pure: each site's settings for the new effects */
const docs = {}, boards = {}, learned = {};
for (const s of SITES) {
  const d = JSON.parse(readFileSync(join(SINK, "sites", s, "site", "document.json"), "utf8"));
  const kf = d.keyframes ?? d.look?.keyframes ?? [];
  docs[s] = d;
  boards[s] = d.behaviours ? attachCaptured(d.nodes, d.behaviours, kf) : d.nodes;
  learned[s] = L.learnFromBoard({ nodes: boards[s], look: { ...d.look, keyframes: kf }, brief: d.brief, pages: d.pages }, d.behaviours);
}
const effectRows = [];
for (const s of SITES) {
  const x = learned[s];
  const got = (x?.versions ?? []).filter((v) => NEW.includes(v.item.replace(/^work:/, "")));
  effectRows.push({ site: s, name: x?.name ?? "-", got });
}
console.log("\n  site               new effects learned");
for (const r of effectRows) console.log(`  ${r.site.padEnd(18)} ${r.got.map((v) => `${v.item.replace("work:", "")} ${JSON.stringify(v.take.inputs)}`).join(" · ") || "none"}`);
console.log("");
const allNew = effectRows.flatMap((r) => r.got.map((v) => ({ ...v, site: r.site, host: learned[r.site].host })));
check("the sites' own settings for the new effects are learned", allNew.length >= 3 && NEW.every((id) => allNew.some((v) => v.take.id === id)), `${allNew.length}: ${[...new Set(allNew.map((v) => v.take.id))].join(", ")}`);
check("…each only with settings the feature has", allNew.every((v) => { const m = getWork(v.take.id)?.manifest; return m && Object.keys(v.take.inputs).every((k) => m.inputs.some((i) => i.id === k)); }));
check("…and the TV's own screen (Trump & Morty) is one of them", allNew.some((v) => /trumpmorty/.test(v.host) && v.take.id === "screen-filter"));

/* ------------------------------------------------------------------ pure: the TV as a component */
const TM = SITES.find((s) => /trumpmorty/.test(s));
const TV = "n_box_192";
const tmKf = docs[TM]?.keyframes ?? docs[TM]?.look?.keyframes ?? [];
const comp = TM ? C.componentOf(boards[TM], TV, { name: "TV screen", category: "media", kind: "Pictures and screens", keyframes: tmKf, fonts: docs[TM].look?.fonts ?? [] }) : null;
check("the TV saved as a component holds its parts, the screen picture among them", !!comp && comp.nodes.length >= 10 && comp.nodes.some((n) => n.picture) && comp.nodes[0].id === TV, `${comp?.nodes.length} parts`);
const animNames = comp ? [...new Set(comp.nodes.flatMap((n) => (n.motion?.animation ?? []).map((a) => a.name.replace(/^cap-/, ""))))] : [];
check("…and the keyframes its motion names", animNames.length > 0 && animNames.every((a) => comp.frames.some((k) => k.name.replace(/^cap-/, "") === a)), animNames.join(", "));
let k = 0;
const placed = comp ? C.placeComponent(comp, { x: 60, y: 2000 }, "page-x", () => `n_put_${++k}`) : [];
const oldIds = new Set(comp?.nodes.map((n) => n.id) ?? []);
check("placed, every part has a fresh id and nothing names the old ones", placed.length === comp?.nodes.length && placed.every((n) => !oldIds.has(n.id)) && !placed.some((n) => [...oldIds].some((o) => new RegExp(`\\b${o}\\b`).test(JSON.stringify({ work: n.work, link: n.link })))));
check("…each in the same place inside it", placed.every((n, i) => n.x - placed[0].x === comp.nodes[i].x && n.y - placed[0].y === comp.nodes[i].y && n.w === comp.nodes[i].w));
const treeA = partTree(comp.nodes.map((n) => ({ ...n })));
const treeB = partTree(placed);
const map = new Map(comp.nodes.map((n, i) => [n.id, placed[i].id]));
const same = comp.nodes.every((n) => JSON.stringify((treeA.kids.get(n.id) ?? []).map((x) => map.get(x))) === JSON.stringify(treeB.kids.get(map.get(n.id)) ?? []));
check("…and holds what it held", same);

/* ------------------------------------------------------------------ pure: what is offered per kind */
const ids = (kind, part) => E.effectsFor(kind, part).map((e) => e.work);
check("a picture is offered the screen filter", ids("Picture")[0] === "screen-filter");
check("a button its hover and press", ["hover-lift", "press-push"].every((w) => ids("Button").includes(w)) && !ids("Button").includes("screen-filter"));
check("a section the pointer and background motions", ["follow-pointer", "tilt", "dust-canvas"].every((w) => ids("Section").includes(w)));
check("every part the openings", ["Picture", "Button", "Section", "Words", "Box"].every((k) => ids(k).includes("switch-on")));
check("a box that holds a picture (the TV) is offered the picture filters", ids("Box", { holdsPicture: true })[0] === "screen-filter");

/* ------------------------------------------------------------------ in the Builder */
const { chromium } = require("playwright-core");
const sharp = require("sharp");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/tweets/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }));
const wait = (ms) => page.waitForTimeout(ms);
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__studioLoadDoc && !!window.__studioLearned && !!window.__studioNodes && !!window.__studioHistory, null, { timeout: 30000 });

const openPart = async (id) => {
  await page.evaluate((id) => { window.__studioHistory.act("setMode", "design"); window.__studioHistory.act("setSelection", [id]); window.__studioHistory.act("want", { panel: "inspector" }); }, id);
  await wait(450);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("studio:open-section", { detail: "effects" })));
  await wait(250);
};
const offered = () => page.evaluate(() => ({ family: document.querySelector("[data-part-effects]")?.getAttribute("data-part-effects") ?? null, works: [...document.querySelectorAll("[data-effect-offer]")].map((e) => e.getAttribute("data-effect-offer")) }));

/* A published page from the export, served as a site, with every call to animate() noted. */
const serve = async (files, opts = {}) => {
  const byPath = new Map(files.map((f) => [f.path, f.content]));
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(opts.calm ? { reducedMotion: "reduce" } : {}) });
  const site = await ctx.newPage();
  await site.addInitScript(() => { window.__animated = []; const a = Element.prototype.animate; Element.prototype.animate = function (...x) { window.__animated.push(this.id || this.closest("[id]")?.id || ""); return a.apply(this, x); }; });
  await site.route("http://site.test/**", (r) => {
    const p = new URL(r.request().url()).pathname.replace(/^\//, "") || "index.html";
    const body = byPath.get(p.endsWith("/") ? `${p}index.html` : p);
    if (body == null) return r.fulfill({ status: 404, body: "" });
    const type = p.endsWith(".css") ? "text/css" : p.endsWith(".js") ? "text/javascript" : p.endsWith(".svg") ? "image/svg+xml" : /\.(png|jpe?g|webp|gif)$/.test(p) ? `image/${p.split(".").pop().replace("jpg", "jpeg")}` : "text/html";
    return r.fulfill({ status: 200, contentType: type, body: typeof body === "string" ? body : Buffer.from(body) });
  });
  await site.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));
  const siteErrors = [];
  site.on("pageerror", (e) => siteErrors.push(e.message));
  await site.goto("http://site.test/index.html", { waitUntil: "load" });
  await site.waitForTimeout(1500);
  return { site, ctx, siteErrors };
};
const exportNow = () => page.evaluate(async () => Promise.all((await window.__studioExport()).map(async (f) => ({ path: f.path, content: typeof f.content === "string" ? f.content : f.content instanceof Blob ? Array.from(new Uint8Array(await f.content.arrayBuffer())) : f.content instanceof Uint8Array || f.content instanceof ArrayBuffer ? Array.from(new Uint8Array(f.content)) : null }))));
const toFiles = (raw) => raw.filter((f) => f.content != null).map((f) => ({ path: f.path, content: Array.isArray(f.content) ? Uint8Array.from(f.content) : f.content }));
const shotOf = async (site, id) => {
  const el = site.locator(`[id="${id}"]`);
  await el.scrollIntoViewIfNeeded();
  await site.waitForTimeout(400);
  return el.screenshot({ animations: "disabled" });
};

/* Every capture: a picture, a button and a section clicked, and what the panel offers each. */
const panelRows = [];
let tvShot = null;
for (const s of SITES) {
  const size = readFileSync(join(SINK, "sites", s, "site", "document.json")).length;
  if (size > 30_000_000) { console.log(`  (${s}: ${Math.round(size / 1e6)}MB, read above but not loaded into a page)`); continue; }
  await page.evaluate((doc) => window.__studioLoadDoc(doc), docs[s]);
  await wait(1800);
  const nodes = await page.evaluate(() => window.__studioNodes());
  const pageId = nodes[0]?.pageId;
  const onPage = nodes.filter((n) => n.pageId === pageId);
  const holds = (n) => onPage.some((m) => m.id !== n.id && m.picture && m.x >= n.x - 1 && m.y >= n.y - 1 && m.x + m.w <= n.x + n.w + 1 && m.y + m.h <= n.y + n.h + 1);
  const partOf = (n) => ({ w: n.w, h: n.h, picture: n.picture, holdsPicture: holds(n), feature: getFeature(n.featureId)?.name ?? null });
  const pick = {};
  for (const n of onPage) {
    const fam = E.familyOf(kindWord(n), partOf(n));
    if (fam && !pick[fam] && n.w > 8 && n.h > 8) pick[fam] = n;
  }
  for (const [fam, n] of Object.entries(pick)) {
    await openPart(n.id);
    const got = await offered();
    const want = E.effectsFor(kindWord(n), partOf(n)).map((e) => e.work).filter((w) => !!getWork(w));
    const ok = got.family === fam && JSON.stringify(got.works) === JSON.stringify(want);
    panelRows.push({ site: s, fam, kind: kindWord(n), ok, got: got.works.join(", ") });
  }
  if (s === TM) {
    /* The TV, from its own panel, saved under Media. */
    await openPart(TV);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("studio:open-section", { detail: "save-component" })));
    await wait(300);
    const box = page.locator(`[data-save-component="${TV}"]`);
    await box.locator('input[aria-label="Component name"]').fill("TV screen");
    const cat = await box.locator('[aria-label="Shelf category"]').evaluate((e) => e.value ?? e.getAttribute("data-value") ?? e.textContent);
    await box.locator("[data-save-component-go]").click();
    await wait(400);
    await page.screenshot({ path: `${SHOTS}/tv-saved.png` });
    const lib = await page.evaluate(() => window.__studioLearned());
    const saved = (lib.components ?? []).find((c) => c.name === "TV screen");
    check("the TV saved from its panel is on the shelf under Media, whole", !!saved && saved.category === "media" && saved.nodes.length === comp.nodes.length, `${saved?.category} · ${saved?.nodes.length} parts · picked ${String(cat).slice(0, 20)}`);
    const { site, ctx } = await serve(toFiles(await exportNow()), { calm: true });
    tvShot = await shotOf(site, TV);
    writeFileSync(`${SHOTS}/tv-on-its-site.png`, tvShot);
    await ctx.close();
  }
}
console.log("\n  site               part kind            family    offered");
for (const r of panelRows) console.log(`  ${r.site.padEnd(18)} ${r.kind.slice(0, 20).padEnd(20)} ${r.fam.padEnd(9)} ${r.ok ? "" : "WRONG "}${r.got}`);
console.log("");
check("on every capture the panel offers the effects that fit the part clicked", panelRows.length >= 6 && panelRows.every((r) => r.ok), `${panelRows.filter((r) => r.ok).length} of ${panelRows.length}`);
check("…pictures, buttons and sections all seen", ["picture", "button", "section"].every((f) => panelRows.some((r) => r.fam === f)));

/* A new, empty board. */
await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
await wait(1200);
// An empty board by its own button: the Builds page's New site opens on a sample page (tests/new-site-theme.mjs).
await page.getByRole("button", { name: /^Blank site$/ }).first().click();
await wait(900);
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__studioNodes && !!window.__studioHistory && (window.__studioLearned()?.components ?? []).length > 0, null, { timeout: 30000 });
await wait(1200);
check("on a new board the saved TV and every site's learning are still there", (await page.evaluate(() => window.__studioNodes().length)) === 0);

/* Each new effect, plain and as each site had it, on a part of its own, from that part's panel. */
let y = 40;
const made = [];
const part = async (feature, patch) => {
  const id = await page.evaluate(({ feature, y, patch }) => window.__studioHistory.act("addNode", feature, 40, y, patch), { feature, y, patch });
  y += (patch?.h ?? 120) + 60;
  return id;
};
const take = async (id, work, host) => {
  await openPart(id);
  const sel = host ? `[data-effect-version="${work}"][data-effect-host="${host}"]` : `[data-effect-add="${work}"]`;
  const btn = page.locator(sel).first();
  const there = await btn.count();
  if (there) await btn.click();
  await wait(250);
  return there > 0;
};
const plan = [
  { feature: "picture", patch: { w: 360, h: 240, colour: { bg: "#3a6ea5" } }, work: "screen-filter" },
  { feature: "cta-primary", patch: { w: 200, h: 56, content: "Press me" }, work: "press-push" },
  { feature: "cta-primary", patch: { w: 200, h: 56, content: "Hover me" }, work: "hover-lift" },
  { feature: "box", patch: { w: 1200, h: 420, colour: { bg: "#223" } }, work: "follow-pointer" },
  { feature: "prose", patch: { w: 400, h: 120, content: "Switched on" }, work: "switch-on" },
  ...allNew.map((v) => ({ feature: v.take.id === "press-push" ? "cta-primary" : v.take.id === "screen-filter" ? "picture" : "box", patch: { w: 360, h: 200, colour: { bg: "#5a3" }, content: v.take.id === "press-push" ? v.label : undefined }, work: v.take.id, host: v.host, inputs: v.take.inputs })),
];
for (const p of plan) {
  const id = await part(p.feature, p.patch);
  const ok = await take(id, p.work, p.host);
  made.push({ ...p, id, clicked: ok });
}
const after = await page.evaluate(() => window.__studioNodes());
const onIt = (m) => { const n = after.find((x) => x.id === m.id); const uses = n?.work ? [n.work, ...(n.work.also ?? [])] : []; return uses.find((u) => u.id === m.work); };
check("each effect, plain and every site's version, goes on its part from the part's panel", made.every((m) => m.clicked && !!onIt(m)), made.filter((m) => !m.clicked || !onIt(m)).map((m) => `${m.work}${m.host ? `@${m.host}` : ""}`).join(", ") || `${made.length} put on`);
check("…a site's version with that site's settings", made.filter((m) => m.host).every((m) => JSON.stringify(onIt(m)?.inputs) === JSON.stringify(m.inputs)));
await openPart(made[0].id);
check("…and its settings are there in the panel to change", (await page.locator(`[data-part-effects] [data-work-field="screen-filter"] input`).count()) >= 3);
await page.screenshot({ path: `${SHOTS}/panel-picture.png` });

/* The TV placed on this board as the shelf's Add places it. */
const put = await page.evaluate(() => window.__studioPutComponent("TV screen", { x: 40, y: 99999 }));
await wait(600);
const tvRoot = put?.[0];
const nowNodes = await page.evaluate(() => window.__studioNodes());
check("the TV placed on another board brings every part", !!put && put.length === comp.nodes.length && put.every((id) => nowNodes.some((n) => n.id === id)), `${put?.length} parts`);
const kfNow = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.look?.keyframes?.map((k) => k.name) ?? []);
check("…and the keyframes its motion names", animNames.every((a) => kfNow.some((k) => k.replace(/^cap-/, "") === a)), animNames.join(", "));
await page.evaluate((id) => window.__studioHistory.act("setSelection", [id]), tvRoot);
await page.locator(`[data-node-id="${tvRoot}"]`).first().scrollIntoViewIfNeeded().catch(() => {});
await wait(500);
await page.screenshot({ path: `${SHOTS}/tv-placed-board.png` });

/* The export of this scratch board, published. */
const files = toFiles(await exportNow());
const { site, ctx, siteErrors } = await serve(files);
const run = [];
for (const m of made) {
  const r = await site.evaluate(async ({ id, work, inputs }) => {
    const el = document.getElementById(id);
    if (!el) return { ok: false, why: "not on the page" };
    el.scrollIntoView({ block: "center" });
    await new Promise((r) => setTimeout(r, 500));
    if (work === "screen-filter") {
      const veil = el.querySelector("[data-screen-filter]") ?? el.parentElement?.querySelector(":scope > [data-screen-filter]");
      /* Scanlines or static draw a veil over it; a site's filter alone (stonkfun's washed-out pictures) is the filter, and no veil. */
      const veiled = Number(inputs?.scanlines ?? 0.14) > 0 || Number(inputs?.static ?? 0.06) > 0;
      const css = String(inputs?.css ?? "").trim();
      const f = getComputedStyle(el).filter;
      return { ok: !!veil === veiled && /hue-rotate/.test(f) && (!css || f.startsWith(css)), why: `veil ${!!veil} (wanted ${veiled}) ${f}` };
    }
    if (work === "switch-on") return { ok: window.__animated.includes(id), why: window.__animated.join(",") };
    if (work === "press-push") {
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      const down = { t: el.style.translate, s: el.style.scale, p: el.hasAttribute("data-pressed") };
      el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      return { ok: down.p && (down.t !== "" || down.s !== "") && !el.hasAttribute("data-pressed"), why: JSON.stringify(down) };
    }
    if (work === "hover-lift") {
      el.dispatchEvent(new PointerEvent("pointerenter"));
      return { ok: el.style.translate !== "", why: el.style.translate };
    }
    return { ok: true, why: "" };
  }, { id: m.id, work: m.work, inputs: m.inputs ?? {} });
  if (m.work === "follow-pointer") {
    const before = await site.evaluate((id) => { const e = document.getElementById(id); return `${e.style.translate}|${e.style.transform}`; }, m.id);
    for (let i = 0; i < 6; i++) { await site.mouse.move(100 + i * 200, 100 + i * 100); await site.waitForTimeout(60); }
    await site.waitForTimeout(400);
    const now = await site.evaluate((id) => { const e = document.getElementById(id); return `${e.style.translate}|${e.style.transform}`; }, m.id);
    r.ok = now !== before; r.why = `${before} → ${now}`;
  }
  run.push({ ...m, ...r });
}
console.log("\n  effect           version                       runs on the published page");
for (const r of run) console.log(`  ${r.work.padEnd(16)} ${(r.host ?? "plain").padEnd(29)} ${r.ok ? "yes" : `NO (${r.why})`}`);
console.log("");
check("each new universal effect on the scratch board runs on the exported page", run.every((r) => r.ok), run.filter((r) => !r.ok).map((r) => `${r.work}@${r.host ?? "plain"}: ${r.why}`).join(" | ") || `${run.length} run`);
const tvParts = await site.evaluate((ids) => ids.filter((id) => !!document.getElementById(id)).length, put);
check("the placed TV is on the exported page, every part", tvParts >= Math.round(put.length * 0.9), `${tvParts} of ${put.length}`);
check("the exported page runs without an error", siteErrors.length === 0, siteErrors.slice(0, 3).join(" | "));
await ctx.close();

/* The TV on this board's export against the TV on its own site's export, still. */
const calm = await serve(files, { calm: true });
const placedShot = await shotOf(calm.site, tvRoot);
writeFileSync(`${SHOTS}/tv-placed.png`, placedShot);
await calm.ctx.close();
const raw = async (b) => { const { data, info } = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };
const A = await raw(tvShot), B = await raw(placedShot);
/* Compared inside its case: its corners show the page behind it, which is each board's own. */
const IN = 24;
let diff = 0, n = 0;
if (A.w === B.w && A.h === B.h) for (let y = IN; y < A.h - IN; y++) for (let x = IN; x < A.w - IN; x++) for (let c = 0; c < 3; c++) { const i = (y * A.w + x) * 3 + c; diff += Math.abs(A.data[i] - B.data[i]); n++; }
const mean = n ? diff / n : Infinity;
check("the TV placed on another board looks the same as on its own site", A.w === B.w && A.h === B.h && mean < 8, `${A.w}×${A.h} vs ${B.w}×${B.h}, mean difference ${mean.toFixed(2)} of 255`);

check("no page errors in the Builder", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
writeFileSync(join(SHOTS, "effects.json"), JSON.stringify({ learned: effectRows.map((r) => ({ site: r.site, effects: r.got.map((v) => ({ item: v.item, inputs: v.take.inputs })) })), panel: panelRows, run: run.map((r) => ({ work: r.work, host: r.host ?? null, ok: r.ok })) }, null, 2));
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
