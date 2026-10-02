#!/usr/bin/env node
/**
 * EACH RIBBON'S RUNNING WORDS IN THE MIDDLE OF THEIR BAND, AT ANY WIDTH.
 *
 * THE OWNER'S REQUEST, on his published trumpmorty.fun: the top (red)
 * ribbon's words leaned toward its top edge, the blue one's toward its
 * bottom; centre them, a little bigger if there is room, never filling the
 * band. Measured first, in each ribbon's own frame (its tilt taken off): the
 * live page leans too (red 2.7px high, navy 1.35px low; its padding is 12px
 * above and 6px below), so centring is his design, given as a control on a
 * running line: the marquee's "Centre in its band" and "Text size". And ours
 * leaned further as the window widened (red 15.5px high, navy 10.5px low at
 * 2000, by the tilted reading), which was ours alone: the words, drawn flat
 * with the ribbon's tilt about their own centre, drifted from the ribbon as
 * its middle moved with the window. They are drawn inside the ribbon now
 * (sink `art.turnsWith`, exportSite.ts).
 *
 * sink's trumpmorty.fun, whose board document sets the control on both
 * ribbons (red 36px, navy 42px), brought in through the real door:
 *   · both ribbons' words carry the marquee with "Centre in its band" on;
 *   · the Element panel shows the control, and turning it off and on again
 *     moves the published words off the middle and back;
 *   · published, at 1440 and 2000, each ribbon's words' ink is within 1px of
 *     its band's middle, in the ribbon's own frame, with at least 12px clear
 *     above and below, at the size asked; and the words are drawn inside
 *     their ribbon;
 *   · on the board (1:1) and in the Preview the words sit in the band's
 *     middle too, read along the tilt (within 2px: that reading is a pixel
 *     off on a turned line).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/ribbon-band.mjs http://127.0.0.1:3013 <the capture folder>
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3] ?? join(here, "..", "capture", "versions", "sink-0ee06fa");
const SITE = join(SINK, "sites", "trumpmorty-fun");
if (!existsSync(join(SITE, "site", "document.json"))) { console.error(`usage: node tests/ribbon-band.mjs <builder url> <capture folder>; no ${SITE}/site/document.json`); process.exit(2); }
const DOC = readFileSync(join(SITE, "site", "document.json"));
const doc = JSON.parse(DOC.toString("utf8"));
const pics = existsSync(join(SITE, "assets", "pictures")) ? readdirSync(join(SITE, "assets", "pictures")) : [];
const REPO = "/repos/sparkygogo77-spec/sink";
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
  ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
];

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);

/* The two ribbons and their words, by what the page made them from. */
const sel = (n) => n.from?.selector ?? "";
const RIBBONS = [["red", "rgb(210, 60, 52)", [250, 250, 250]], ["navy", "rgb(41, 47, 68)", [243, 212, 64]]].map(([name, bg, ink]) => {
  const row = doc.nodes.find((n) => n.colour?.bg === bg && /^body > main > div > div:nth-of-type\(\d\)$/.test(sel(n)));
  const words = row ? doc.nodes.find((n) => sel(n) === `${sel(row)} > div`) : null;
  return { name, row: row?.id, words: words?.id, ink };
});
check("sink's document has both ribbons and their words", RIBBONS.every((r) => r.row && r.words), J(RIBBONS));
const other = (r) => RIBBONS.find((q) => q !== r);

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
/* A window the board draws its 1440 page in at 1:1 (the fit is by height). */
const page = await browser.newPage({ viewport: { width: 2200, height: 1305 }, deviceScaleFactor: 1 });
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
  if (pic) return j({ encoding: "base64", content: readFileSync(join(SITE, "assets/pictures", pic[1])).toString("base64") });
  return j({ message: "no" }, 404);
});
await page.route("https://dexscreener.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<body style='background:#111'></body>" }));
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});

/* An empty site, a placeholder key, and the repository brought in. */
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
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
await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
await page.locator("[data-repo-pull]").click();
for (let i = 0; i < 90 && ((await state()).nodes?.length ?? 0) < 100; i++) await page.waitForTimeout(1000);
await page.waitForTimeout(3000);

const s0 = await state();

const reader = await browser.newPage();
await reader.setContent("<canvas></canvas>");
/** The rows of a PNG that hold a colour (within 30), as [first, last]. */
const rowsOf = (buf, ink) => reader.evaluate(async ([b64, ink]) => {
  const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
  const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data; const on = [];
  for (let y = 0; y < img.height; y++) { let n = 0; for (let x = 0; x < img.width; x++) { const i = (y * img.width + x) * 4; if (Math.max(Math.abs(d[i] - ink[0]), Math.abs(d[i + 1] - ink[1]), Math.abs(d[i + 2] - ink[2])) <= 30) n++; } if (n > 15) on.push(y); }
  return on.length ? [on[0], on[on.length - 1]] : null;
}, [buf.toString("base64"), ink]);
/** Only this ribbon (and its words) drawn: the other one, which crosses it, hidden. */
const only = (p, how, r) => p.evaluate(([how, ids]) => {
  document.getElementById("__only")?.remove();
  const st = document.createElement("style"); st.id = "__only";
  st.textContent = ids.map((id) => { const s = how === "id" ? `[id="${id}"]` : `[${how}="${id}"]`; return `${s}, ${s} * { visibility: hidden !important; }`; }).join("\n");
  document.head.append(st);
}, [how, [other(r).row, other(r).words]]);

/*
 * IN THE RIBBON'S OWN FRAME. Its tilt taken off (the words are drawn inside
 * it, so theirs goes too), the band is the ribbon's box less its 4px edges:
 * where the words' ink starts and ends in it, and how far its middle is
 * from the band's.
 */
const inFrame = async (p, r) => {
  await only(p, "id", r);
  const box = await p.evaluate((id) => {
    let t = document.getElementById(id); while (t && getComputedStyle(t).transform === "none" && t.firstElementChild) t = t.firstElementChild;
    t.dataset.was = t.style.transform; t.style.transform = "none";
    const b = t.getBoundingClientRect(); return { y: b.y, h: b.height };
  }, r.row);
  await p.waitForTimeout(150);
  const W = p.viewportSize().width;
  const ink = await rowsOf(await p.screenshot({ clip: { x: 60, y: box.y, width: W - 120, height: box.h } }), r.ink);
  await p.evaluate((id) => { let t = document.getElementById(id); while (t && t.dataset.was === undefined && t.firstElementChild) t = t.firstElementChild; t.style.transform = t.dataset.was; delete t.dataset.was; }, r.row);
  if (!ink) return null;
  return { off: +((ink[0] + ink[1]) / 2 - (box.h - 1) / 2).toFixed(2), above: ink[0] - 4, below: box.h - 1 - ink[1] - 4, ink: ink[1] - ink[0] + 1 };
};

/*
 * ALONG THE TILT, where the ribbon and its words are separate parts (the
 * board, the Preview): from the ribbon's middle, across it at each point
 * along it, where the words' ink starts and ends; the medians, against the
 * band's middle.
 */
const alongTilt = async (p, how, r) => {
  await only(p, how, r);
  const g = await p.evaluate(([how, id]) => {
    const e = how === "id" ? document.getElementById(id) : document.querySelector(`[${how}="${id}"]`); let t = e;
    while (t && getComputedStyle(t).transform === "none" && t.firstElementChild) t = t.firstElementChild;
    const b = e.getBoundingClientRect(), m = new DOMMatrix(getComputedStyle(t).transform);
    return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, th: Math.atan2(m.b, m.a), half: t.offsetHeight / 2 - 4 };
  }, [how, r.row]);
  const png = await p.screenshot();
  return reader.evaluate(async ([b64, g, ink]) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height); const x2 = c.getContext("2d"); x2.drawImage(img, 0, 0);
    const d = x2.getImageData(0, 0, img.width, img.height).data;
    const px = (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= img.width || y >= img.height) return null; const i = (y * img.width + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const near = (a) => a && Math.max(...a.map((v, i) => Math.abs(v - ink[i]))) <= 30;
    const med = (a) => [...a].sort((u, v) => u - v)[Math.floor(a.length / 2)];
    const tops = [], bots = [];
    for (let s = -img.width / 2; s <= img.width / 2; s += 3) {
      const ox = g.cx + s * Math.cos(g.th), oy = g.cy + s * Math.sin(g.th); if (ox < 60 || ox > img.width - 60) continue;
      let a = null, z = null;
      for (let t = -g.half; t <= g.half; t += 0.5) if (near(px(ox - t * Math.sin(g.th), oy + t * Math.cos(g.th)))) { a ??= t; z = t; }
      if (a !== null) { tops.push(a); bots.push(z); }
    }
    return tops.length > 20 ? { off: +((med(tops) + med(bots)) / 2).toFixed(2), cols: tops.length } : null;
  }, [png.toString("base64"), g, r.ink]);
};

const exportAt = async (W, files) => {
  const out = mkdtempSync(join(tmpdir(), "ribbon-band-"));
  for (const f of files ?? []) { mkdirSync(dirname(join(out, f.path)), { recursive: true }); writeFileSync(join(out, f.path), f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
  const types = { html: "text/html", css: "text/css", js: "text/javascript", webp: "image/webp", png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml", woff2: "font/woff2" };
  const server = http.createServer((req, res) => {
    let q = join(out, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, ""));
    if (existsSync(q) && statSync(q).isDirectory()) q = join(q, "index.html");
    if (!existsSync(q)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[q.split(".").pop()] ?? "application/octet-stream" });
    res.end(readFileSync(q));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const ctx = await browser.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.route("https://dexscreener.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<body style='background:#111'></body>" }));
  await p.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
  await p.waitForTimeout(6500);
  await p.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: "center" }), RIBBONS[0].row);
  await p.waitForTimeout(800);
  return { p, close: async () => { await ctx.close(); server.close(); } };
};
const exported = () => page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));

/* ------------------------------------------------------------------ */
/* Brought in: the control, as the document sets it.                    */
/* ------------------------------------------------------------------ */
const marqueeOf = (n) => { const all = n?.work ? [n.work, ...(n.work.also ?? [])] : []; return all.find((u) => u.id === "marquee"); };
{
  const got = RIBBONS.map((r) => marqueeOf((s0.nodes ?? []).find((n) => n.id === r.words))?.inputs ?? null);
  check("brought in: both ribbons' words run the marquee with \"Centre in its band\" on and a size of their own, the page's speed kept", got.every((i) => i?.middle === "yes" && Number(i?.size) > 0 && Number(i?.speed) > 0), J(got));
}
const SIZE = RIBBONS.map((r) => Number(marqueeOf(doc.nodes.find((n) => n.id === r.words))?.inputs?.size ?? 0));

/* ------------------------------------------------------------------ */
/* Published, at 1440 and 2000.                                         */
/* ------------------------------------------------------------------ */
const files = await exported();
check("the site exports", Array.isArray(files) && files.some((f) => f.path === "index.html"));
for (const W of [1440, 2000]) {
  const { p, close } = await exportAt(W, files);
  for (const [i, r] of RIBBONS.entries()) {
    const m = await inFrame(p, r);
    check(`export ${W}, ${r.name} ribbon: its words' ink is within 1px of the band's middle, in the ribbon's own frame`, !!m && Math.abs(m.off) <= 1, J(m));
    check(`export ${W}, ${r.name} ribbon: …with at least 12px clear above and below, never filling the band`, !!m && m.above >= 12 && m.below >= 12, J(m));
    const at = await p.evaluate(([w, row]) => { const e = document.getElementById(w); const t = e && [...e.querySelectorAll("p")][0]; return { size: t ? parseFloat(getComputedStyle(t).fontSize) : null, inside: !!e && !!document.getElementById(row)?.contains(e) }; }, [r.words, r.row]);
    check(`export ${W}, ${r.name} ribbon: …at the size asked (${SIZE[i]}px), drawn inside its ribbon`, at.size === SIZE[i] && at.inside, J(at));
  }
  await close();
}

/* ------------------------------------------------------------------ */
/* The board at 1:1, and the Preview.                                   */
/* ------------------------------------------------------------------ */
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.mouse.move(2, 2);
const zoomNow = () => page.evaluate(() => document.querySelector("[data-frame]").getBoundingClientRect().width / 1440);
for (let i = 0, z = await zoomNow(); i < 4 && Math.abs(z - 1) >= 0.002; i++, z = await zoomNow()) {
  await page.setViewportSize({ width: 2200, height: Math.round(page.viewportSize().height - (z - 1) * 900) });
  await page.waitForTimeout(900);
}
await page.evaluate((id) => document.querySelector(`[data-node-id="${id}"]`)?.scrollIntoView({ block: "center" }), RIBBONS[0].row);
await page.waitForTimeout(800);
for (const r of RIBBONS) {
  const m = await alongTilt(page, "data-node-id", r);
  check(`board (1:1), ${r.name} ribbon: its words sit in the band's middle, read along the tilt`, !!m && Math.abs(m.off) <= 2, J(m));
}

/* The control, in the Element panel: off, the published words go back to where the page set them; on again, the middle. */
{
  const red = RIBBONS[0];
  const part = page.locator(`[data-node-id="${red.words}"]`).first();
  for (const type of ["pointerdown", "pointerup"]) await part.dispatchEvent(type, { button: 0, buttons: type === "pointerdown" ? 1 : 0, isPrimary: true, pointerId: 1, bubbles: true }).catch(() => {});
  await part.dispatchEvent("click", { button: 0, bubbles: true }).catch(() => {});
  await page.evaluate(() => window.__studioSetLeftPanel?.("inspector"));
  await page.waitForTimeout(700);
  const field = page.locator(`[data-work-fields="${red.words}"] [data-work-field="marquee"]`);
  const centre = field.getByRole("radiogroup", { name: "Centre in its band" }).or(field.getByLabel("Centre in its band")).first();
  check("the Element panel's marquee shows \"Centre in its band\", on", (await field.count()) === 1 && (await centre.count()) === 1, `${await field.count()} ${await centre.count()}`);
  const pick = async (v) => { await centre.getByText(v, { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(500); };
  /* The size is under More. Cleared, the words are the page's own 32px again. */
  await field.locator('[data-work-more="marquee"] summary').click().catch(() => {});
  const size = field.getByLabel("Text size (px; blank keeps it)").first();
  const typed = async (v) => { await size.fill(v).catch(() => {}); await page.waitForTimeout(500); };
  await pick("no"); await typed("");
  const offNow = marqueeOf((await state()).nodes?.find((n) => n.id === red.words))?.inputs;
  const offFiles = await exported();
  const a = await exportAt(1440, offFiles); const mOff = await inFrame(a.p, red); await a.close();
  await pick("yes"); await typed(String(SIZE[0]));
  const onNow = marqueeOf((await state()).nodes?.find((n) => n.id === red.words))?.inputs;
  const b = await exportAt(1440, await exported()); const mOn = await inFrame(b.p, red); await b.close();
  check("…switched off with the size cleared, the published red words are where the page set them, off the middle; on again at its size, back in it", offNow?.middle === "no" && !offNow?.size && onNow?.middle === "yes" && Number(onNow?.size) === SIZE[0] && !!mOff && Math.abs(mOff.off) > 1.5 && !!mOn && Math.abs(mOn.off) <= 1, J({ offNow, onNow, off: mOff, on: mOn }));
}

await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${BASE}/builder/preview`, { waitUntil: "domcontentloaded" });
for (let i = 0; i < 40 && (await page.evaluate(() => !!document.querySelector("[data-crt]"))); i++) await page.waitForTimeout(250);
await page.waitForTimeout(5000);
await page.evaluate((id) => document.querySelector(`[data-live-node="${id}"]`)?.scrollIntoView({ block: "center" }), RIBBONS[0].row);
await page.waitForTimeout(800);
for (const r of RIBBONS) {
  const m = await alongTilt(page, "data-live-node", r);
  check(`Preview, ${r.name} ribbon: its words sit in the band's middle, read along the tilt`, !!m && Math.abs(m.off) <= 2, J(m));
}

check("no page errors", errors.length === 0, J(errors.slice(0, 3)));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
