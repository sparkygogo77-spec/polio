/**
 * Every word on every shelf card's preview can be read, on captured sites
 * (Lane I, 7).
 *
 * HIS SCREENSHOT: the Text category on a pink and yellow site, every
 * preview a dark box with near-invisible dark words, because the previews
 * drew with the site's declared palette. This loads captured sites the way
 * Bring lands them (`landPalette`), opens every category, and for every
 * card's preview measures each piece of text against what is actually
 * behind it (its own background, the ones under it, a gradient's worst
 * stop, its opacity): at least 4.5 to 1, the Web Content Accessibility
 * Guidelines (WCAG) floor for body text, or the check fails and names it.
 *
 * The first half is pure: the painted palette on each site, and the pair
 * the shelf draws with.
 *
 *   node tests/shelf-readable.mjs http://localhost:3000 [the capture folder]
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { landPalette } from "../src/features/studio/paletteFrom.ts";
import { paintedPalette, readableTheme, READABLE } from "../src/features/studio/shelfTheme.ts";
import { contrast, parseColor } from "../src/features/studio/look/index.ts";
import { CATEGORIES } from "../src/features/studio/catalog.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SINK = process.argv[3] ?? join(process.cwd(), "capture", "versions", "sink-0ee06fa");
const SHOTS = ".screenshots/lane-i";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const SITES = ["trumpmorty-fun", "gotchi-gg", "stonkfun-xyz", "trendtrader-pro"].map((s) => ({ name: s, at: join(SINK, "sites", s, "site", "document.json") })).filter((s) => existsSync(s.at));
if (SITES.length < 3) {
  console.log(`needs three captured sites in the capture folder (${SINK}); found ${SITES.length}`);
  process.exit(1);
}

/** A captured site as Bring lands it, cut to its home page (the page the shelf reads). */
function landed(at) {
  const doc = JSON.parse(readFileSync(at, "utf8"));
  const home = doc.pages.find((p) => p.path === "/") ?? doc.pages[0];
  const l = landPalette(doc.nodes, doc.look?.palette ?? {});
  return { ...doc, pages: [home], nodes: l.nodes.filter((n) => n.pageId === home.id), look: { ...doc.look, palette: l.palette, paletteFrom: l.from }, activePageId: home.id };
}

/* ------------------------------------------------------------ pure */
const ratio = (a, b) => contrast(parseColor(a), parseColor(b));
for (const s of SITES) {
  const doc = landed(s.at);
  const declared = ratio(doc.look.palette.bg, doc.look.palette.text);
  const p = paintedPalette(doc.nodes, doc.look.palette, doc.look.palette.bg);
  const t = readableTheme({ ...p, accentText: "#ffffff", line: "#888888", light: false }, p.fills.map((f) => f.colour));
  const pairs = [[t.text, t.bg], [t.muted, t.bg], [t.text, t.surface], [t.muted, t.surface], [t.accent, t.bg], [t.accentText, t.accent]];
  check(`${s.name}: the painted page colour covers most of the page`, p.fills[0].share >= 0.3, `${p.bg} over ${Math.round(p.fills[0].share * 100)}% (declared pair read ${declared.toFixed(2)} to 1)`);
  check(`${s.name}: every pair the shelf draws words with reads`, pairs.every(([a, b]) => ratio(a, b) >= READABLE), pairs.map(([a, b]) => ratio(a, b).toFixed(1)).join(", ") + (t.mended.length ? `; mended: ${t.mended.join(", ")}` : ""));
}

/* ------------------------------------------------------------ in the shelf */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.route("**/api/tweets/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false }, configured: false, source: null }) }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.__studioLoadDoc === "function", null, { timeout: 60000 });

/** Every text in the open category's previews that reads under the floor. */
const MEASURE = ({ floor }) => {
  const parse = (v) => {
    const m = /rgba?\(([^)]+)\)/.exec(v);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const probe = document.createElement("i");
  document.body.appendChild(probe);
  const rgb = (v) => { probe.style.color = ""; probe.style.color = v; return parse(getComputedStyle(probe).color); };
  /* The grounds behind an element: solid colours composited from the top down, each gradient's every stop. */
  const grounds = (el) => {
    const chain = [];
    for (let e = el; e && e !== document.body; e = e.parentElement) chain.push(e);
    let base = [{ r: 0, g: 0, b: 0, a: 1 }];
    let unknown = false;
    for (const e of chain.reverse()) {
      const cs = getComputedStyle(e);
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) base = base.map((u) => over(bg, u));
      const img = cs.backgroundImage;
      if (img && img !== "none") {
        if (/url\(/.test(img)) unknown = true;
        const stops = [...img.matchAll(/(rgba?\([^)]+\)|oklch\([^)]+\)|#[0-9a-f]{3,8})/gi)].map((m) => rgb(m[1])).filter(Boolean);
        if (stops.length) base = base.flatMap((u) => stops.map((s) => over(s, u)));
      }
    }
    return { base, unknown };
  };
  const out = [];
  const cards = [...document.querySelectorAll("[data-category-open] [data-shelf-card]")];
  for (const card of cards) {
    const pic = card.querySelector("[data-tile], button");
    if (!pic) continue;
    const walker = document.createTreeWalker(pic, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent.trim();
      if (!text || !/[\p{L}\p{N}]/u.test(text)) continue;
      const el = n.parentElement;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      let op = 1;
      let hidden = false;
      for (let e = el; e && e !== card; e = e.parentElement) { const s = getComputedStyle(e); op *= Number(s.opacity); if (s.display === "none" || e.hidden) hidden = true; }
      const r = el.getBoundingClientRect();
      if (hidden || op < 0.1 || r.width < 1 || r.height < 1) continue;
      const colour = parse(el.closest("svg") ? cs.fill : cs.color) ?? parse(cs.color);
      if (!colour) continue;
      const { base, unknown } = grounds(el);
      if (unknown) continue;
      const worst = Math.min(...base.map((g) => ratio(over({ ...colour, a: colour.a * op }, g), g)));
      if (worst < floor) out.push({ card: card.getAttribute("data-shelf-card"), text: text.slice(0, 40), ratio: Math.round(worst * 100) / 100, colour: cs.color });
    }
  }
  probe.remove();
  return { cards: cards.length, low: out };
};

for (const s of SITES) {
  const doc = landed(s.at);
  await page.evaluate((d) => window.__studioLoadDoc(d), doc);
  await page.waitForTimeout(2500);
  /* Every preview laid out, not only the ones on screen. */
  await page.addStyleTag({ content: "[data-shelf-card] *{content-visibility:visible!important}" });
  let cards = 0;
  const low = [];
  for (const c of CATEGORIES) {
    const planet = page.locator(`[data-category="${c.id}"]`).first();
    if (!(await planet.count())) continue;
    await planet.click();
    await page.waitForTimeout(900);
    const r = await page.evaluate(MEASURE, { floor: READABLE });
    cards += r.cards;
    low.push(...r.low.map((x) => ({ ...x, category: c.id })));
    if (c.id === "content" || c.id === "hero") await page.screenshot({ path: `${SHOTS}/readable-${s.name}-${c.id}.png` });
    await planet.click();
    await page.waitForTimeout(300);
  }
  const worst = [...low].sort((a, b) => a.ratio - b.ratio).slice(0, 6).map((x) => `${x.card} "${x.text}" ${x.ratio}`).join("; ");
  check(`${s.name}: every word on every card preview reads at ${READABLE} to 1 or better`, cards > 100 && low.length === 0, `${cards} cards, ${low.length} low${low.length ? `: ${worst}` : ""}`);
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
