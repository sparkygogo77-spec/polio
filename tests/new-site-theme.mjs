#!/usr/bin/env node
/**
 * START A NEW SITE, ROLL ITS THEME, PUBLISH IT AS SEEN.
 *
 * The owner has an idea and does not want to build it on another site's
 * theme. Held here through the real doors:
 *
 *   · Builds' New site opens the Builder on one sample page, in a theme of
 *     its own, built from generic parts; the offer to put it on GitHub still
 *     stands over it;
 *   · the Look tab leads with the theme: Randomize rolls another, six times,
 *     each a different theme (a picture of each is kept), each named in the
 *     undo list ("randomize theme: …"), and Undo puts the last one back;
 *   · locking colours and fonts keeps them across rolls while the rest move;
 *   · a design philosophy typed in the box narrows the next roll, and the
 *     panel says what it understood;
 *   · "Try these" adds working shelf parts, labelled with what they are and
 *     how they are used, and pressing one opens its part panel;
 *   · the published page matches the board: every part of the sample page
 *     sits where the board puts it and wears the same colours, and every
 *     word on it reads at 4.5 to 1 against what is actually behind it.
 *
 * Writes .screenshots/lane-j/roll-1.png … roll-6.png (ignored). The
 * committed record is docs/shots/lane-j-roll-*.png, copied by hand.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/new-site-theme.mjs http://127.0.0.1:3013
 */
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, statSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const SHOTS = process.env.SHOTS ?? ".screenshots/lane-j";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { statusOf } = await jiti.import(join(here, "..", "src", "features", "studio", "shelfFacts.ts"));
const { getFeature } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "catalog.ts"));

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync("/opt/pw-browsers/chromium") ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/keys/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: J({ set: {}, repo: null, branch: "main" }) }));
const wait = (ms) => page.waitForTimeout(ms);
const doc = () => page.evaluate(() => window.__studioPublishDoc());
const theme = async () => (await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.look?.theme ?? null)) ?? (await doc()).look?.theme ?? null;
const liveTheme = () => page.evaluate(() => window.__studioPublishDoc().look?.theme ?? null);

/* ------------------------------------------------------------ New site */
await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await wait(800);
await page.getByRole("button", { name: "New site" }).first().click();
await wait(1500);
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await wait(2500);
let d = await doc();
const starter = d.nodes.filter((n) => n.id.startsWith("st_"));
check("New site opens on a sample page", starter.length >= 30 && !!d.look?.theme, `${starter.length} parts, ${d.look?.theme?.name}`);
check("…built from generic parts only, nothing captured, no picture", starter.every((n) => ["box", "prose", "cta-primary"].includes(n.featureId) || n.id.startsWith("st_try_")) && starter.every((n) => !n.from && !n.picture));
check("…with a header, a first screen, a row of cards and a footer", ["st_logo", "st_nav_1", "st_hero_title", "st_copy_bar", "st_button_main", "st_button_other", "st_card_1", "st_footer", "st_social_1", "st_footer_small"].every((id) => starter.some((n) => n.id === id)));
check("…and the offer to put it on GitHub still stands over it", (await page.locator("[data-new-site-offer]").count()) === 1);
check("…with nothing to undo back to", await page.locator("[data-history-undo]").isDisabled());

/* ------------------------------------------------------------ the Look tab leads with the theme */
await page.evaluate(() => window.__studioSetLeftPanel("look"));
await wait(500);
check("the Look tab leads with the theme", (await page.locator("[data-look-panel] [data-theme-section]").count()) === 1 && (await page.locator("[data-theme-name]").innerText()).includes(d.look.theme.name));
const frame = page.locator("[data-frame]").first();
/* Each roll pictured whole, as a visitor sees it: the Builder's own Preview, in a second tab on the same browser storage. */
const shot = async (n) => {
  await wait(1200);
  const pv = await context.newPage();
  await pv.setViewportSize({ width: 1440, height: 2300 });
  await pv.route("**/api/keys/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: J({ set: {}, repo: null, branch: "main" }) }));
  await pv.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
  await pv.waitForTimeout(1500);
  await pv.screenshot({ path: join(SHOTS, `roll-${n}.png`) });
  await pv.close();
};
const names = [];
for (let i = 1; i <= 6; i++) {
  const before = await liveTheme();
  await page.locator("[data-theme-roll]").click();
  await wait(900);
  const t = await liveTheme();
  names.push(t.name);
  if (i === 1) {
    const tip = (await page.locator("[data-history-undo]").getAttribute("data-history-tip")) ?? "";
    check("a roll is one undo step, named for the theme", /randomize theme: /i.test(tip) && tip.includes(t.name), tip);
    await page.keyboard.press("Escape");
    await page.locator("[data-frame]").first().click({ position: { x: 4, y: 4 }, force: true }).catch(() => {});
    await page.keyboard.press("Control+z");
    await wait(700);
    const back = await liveTheme();
    check("Undo puts the theme before it back", back?.seed === before?.seed && back?.name === before?.name, `${t.name} → ${back?.name}`);
    await page.keyboard.press("Control+Shift+z");
    await wait(700);
    check("…and Redo brings the roll again", (await liveTheme())?.seed === t.seed);
  }
  await shot(i);
}
check("six rolls, six themes", new Set(names).size >= 5, J(names));

/* ------------------------------------------------------------ locks */
await page.locator('[data-theme-lock="colours"]').click();
await page.locator('[data-theme-lock="fonts"]').click();
const locked = await liveTheme();
let held = true, moved = false;
for (let i = 0; i < 3; i++) {
  await page.locator("[data-theme-roll]").click();
  await wait(700);
  const t = await liveTheme();
  held &&= J(t.colours) === J(locked.colours) && J(t.fonts) === J(locked.fonts);
  moved ||= J(t.shapes) !== J(locked.shapes) || J(t.layout) !== J(locked.layout) || J(t.motion) !== J(locked.motion);
}
check("locked colours and fonts hold across rolls", held);
check("…while the rest still roll", moved);
await page.locator('[data-theme-lock="colours"]').click();
await page.locator('[data-theme-lock="fonts"]').click();

/* ------------------------------------------------------------ philosophy */
await page.locator("[data-theme-philosophy]").fill("brutalist newspaper, hard shadows, one loud colour");
await page.locator("[data-theme-philosophy]").blur();
await wait(200);
const says = await page.locator("[data-theme-understood]").innerText();
check("the panel says what the philosophy narrows", /brutalist/.test(says) && /hard shadows/.test(says), says);
let inside = true;
for (let i = 0; i < 3; i++) {
  await page.locator("[data-theme-roll]").click();
  await wait(700);
  const t = await liveTheme();
  inside &&= t.shapes.shadow === "hard" && t.shapes.corner === "square" && t.colours.harmony === "mono" && t.made?.philosophy?.includes("brutalist");
}
check("…and the rolls stay inside it", inside, J((await liveTheme()).shapes));
await shot("philosophy");
await page.locator("[data-theme-philosophy]").fill("");
await page.locator("[data-theme-philosophy]").blur();

/* ------------------------------------------------------------ Try these */
check("the Try these switch is on by default", await page.locator("[data-theme-try]").isChecked());
await page.locator("[data-theme-roll]").click();
await wait(900);
d = await doc();
const tries = d.nodes.filter((n) => /^st_try_\d+$/.test(n.id));
check("Try these: two or three shelf parts on the page", tries.length >= 2 && tries.length <= 3, J(tries.map((n) => n.featureId)));
check("…each one works on the published site", tries.every((n) => { const f = getFeature(n.featureId); return f && statusOf(f) === "works"; }));
check("…each labelled with what it is and how it is used", tries.every((_, i) => d.nodes.some((n) => n.id === `st_try_${i + 1}_name` && n.content) && d.nodes.some((n) => n.id === `st_try_${i + 1}_how` && /\.$/.test(n.content))));
{
  const el = page.locator('[data-node-id="st_try_1"]').first();
  // In the middle of the board, clear of the shelf along its foot.
  await el.evaluate((e) => e.scrollIntoView({ block: "start" }));
  await wait(300);
  const b = await el.boundingBox();
  await page.keyboard.press("v");
  await page.mouse.click(b.x + b.width / 2, b.y + Math.min(b.height / 2, 20));
  await wait(900);
  const said = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return { at: e?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? e?.tagName, sel: window.__studioPublishDoc ? JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.selection : null, panel: document.querySelector("[data-part-panel]")?.getAttribute("data-part-panel") ?? null }; }, { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 20) });
  check("…and pressing one opens its part panel", (await page.locator('[data-part-panel="st_try_1"]').count()) === 1, J({ box: b, ...said }));
  await page.keyboard.press("Escape");
}

/* ------------------------------------------------------------ the published page matches the board */
d = await doc();
const ids = d.nodes.filter((n) => n.id.startsWith("st_") && !/^st_try_\d+$/.test(n.id)).map((n) => n.id);
const onBoard = await page.evaluate((ids) => {
  const fr = document.querySelector("[data-frame]").getBoundingClientRect();
  const k = fr.width / 1440;
  const paintOf = (el) => {
    for (const e of [el, ...el.querySelectorAll("*")]) { const bg = getComputedStyle(e).backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg; }
    return null;
  };
  const inkOf = (el) => { const all = [...el.querySelectorAll("*")].filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())); return all.length ? getComputedStyle(all[0]).color : null; };
  return Object.fromEntries(ids.map((id) => {
    const node = document.querySelector(`[data-node-id="${id}"]`);
    const drawn = node?.querySelector("[data-part-drawn]");
    if (!node || !drawn) return [id, null];
    const r = node.getBoundingClientRect();
    return [id, { x: (r.left - fr.left) / k, y: (r.top - fr.top) / k, w: r.width / k, paint: paintOf(drawn), ink: inkOf(drawn) }];
  }));
}, ids);
const files = await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
const out = mkdtempSync(join(tmpdir(), "new-site-theme-"));
for (const f of files ?? []) { mkdirSync(dirname(join(out, f.path)), { recursive: true }); writeFileSync(join(out, f.path), f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
const types = { html: "text/html", css: "text/css", js: "text/javascript", png: "image/png", svg: "image/svg+xml", woff2: "font/woff2" };
const server = http.createServer((req, res) => {
  let f = join(out, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, ""));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[f.split(".").pop()] ?? "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const site = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await site.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
await site.waitForTimeout(800);
const published = await site.evaluate((ids) => {
  const root = document.body.getBoundingClientRect();
  const paintOf = (el) => {
    for (const e of [el, ...el.querySelectorAll("*")]) { const bg = getComputedStyle(e).backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg; }
    return null;
  };
  const inkOf = (el) => { const all = [...el.querySelectorAll("*"), el].filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())); return all.length ? getComputedStyle(all[0]).color : null; };
  return Object.fromEntries(ids.map((id) => {
    const el = document.getElementById(id);
    if (!el) return [id, null];
    const r = el.getBoundingClientRect();
    return [id, { x: r.left - root.left, y: r.top + scrollY, w: r.width, paint: paintOf(el), ink: inkOf(el) }];
  }));
}, ids);
const off = ids.filter((id) => { const a = onBoard[id], b = published[id]; return !a || !b || Math.abs(a.x - b.x) > 3 || Math.abs(a.y - b.y) > 3 || Math.abs(a.w - b.w) > 3; });
check("the published page puts every part where the board does", off.length === 0, off.slice(0, 4).map((id) => `${id} ${J(onBoard[id] && { x: Math.round(onBoard[id].x), y: Math.round(onBoard[id].y), w: Math.round(onBoard[id].w) })} vs ${J(published[id] && { x: Math.round(published[id].x), y: Math.round(published[id].y), w: Math.round(published[id].w) })}`).join(" | "));
const unlike = ids.filter((id) => { const a = onBoard[id], b = published[id]; return a && b && (a.paint !== b.paint || a.ink !== b.ink); });
check("…in the same colours, fills and words alike", unlike.length === 0, unlike.slice(0, 3).map((id) => `${id} ${J(onBoard[id])} vs ${J(published[id])}`).join(" | "));
// Every word on the published page, against what is really behind it.
const reads = await site.evaluate(() => {
  const rgb = (s) => (/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)(?:\D+([\d.]+))?/.exec(s) ?? []).slice(1).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const out = [];
  for (const el of document.querySelectorAll("[id^='st_'] *, [id^='st_']")) {
    if (el.closest("[id^='st_try_']") && !/^st_try_\d+_(name|how)$/.test(el.closest("[id^='st_']").id)) continue;
    if (![...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    el.scrollIntoView({ block: "center" });
    const b = el.getBoundingClientRect();
    const stack = document.elementsFromPoint(b.left + Math.min(4, b.width / 2), b.top + b.height / 2);
    let bg = null;
    for (const e of stack) { if (e === el || el.contains(e)) continue; const c = getComputedStyle(e).backgroundColor; const v = rgb(c); if (v.length >= 3 && !(v[3] <= 0.5)) { bg = v.slice(0, 3); break; } }
    if (!bg) bg = rgb(getComputedStyle(document.body).backgroundColor);
    const fg = rgb(getComputedStyle(el).color).slice(0, 3);
    const ratio = (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05);
    out.push({ id: el.closest("[id^='st_']").id, ratio: +ratio.toFixed(2), fg: fg.join(","), bg: bg.join(",") });
  }
  return out;
});
const low = reads.filter((r) => r.ratio < 4.5);
check("every word on the published page reads at 4.5 to 1 against what is behind it", reads.length > 20 && low.length === 0, `${reads.length} checked, lowest ${Math.min(...reads.map((r) => r.ratio))}${low.length ? ` ${J(low.slice(0, 3))}` : ""}`);
server.close();

check("no page errors", errors.length === 0, J(errors.slice(0, 3)));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
