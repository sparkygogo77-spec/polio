#!/usr/bin/env node
/**
 * An imported site's six colour roles are its own, say where they came from,
 * and move his parts when he moves them.
 *
 * HIS WORDS: the colours are not the ones from the site he imported; there is
 * no pink anywhere on his site and the builder showed pink; most of the roles
 * do nothing for an imported site beside the background. Measured: sink's
 * document names two roles (bg, and the body's white text nobody sees), the
 * app filled the other four from its default hue, and every part carried a
 * fixed colour, so moving a role moved nothing but the gaps between sections.
 *
 * The ruling: derive the six roles from the parts as Bring lands a document,
 * say beside every role what it came from, and write each part colour that
 * equals a role as that role's name, so the role moves it. The board must
 * draw exactly the same at import.
 *
 * Every expectation here is read off the board the import leaves, never
 * written in: which colours the parts wear, which colour the most parts wear
 * across every role, what each swatch shows, what each part names.
 *
 *   npx next start -p 3013
 *   node tests/palette-import.mjs http://127.0.0.1:3013 <the capture folder>
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3];
const OUT = process.argv[4] ?? null;
if (!SINK || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node tests/palette-import.mjs <builder url> <the capture folder>");
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
const NAMES = { bg: "Background", surface: "Surface", text: "Text", muted: "Muted text", accent: "Accent", highlight: "Highlight" };

/* OKLCH chroma and lightness of any CSS colour, computed here, not borrowed from the app. */
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
function oklchOf(s) {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(s ?? "");
  if (m) {
    const [r, g, b] = m.slice(1, 4).map((x) => lin(+x));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), ss = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * ss, A = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * ss, B = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * ss;
    return { L, C: Math.hypot(A, B) };
  }
  const o = /oklch\(\s*([\d.]+)\s+([\d.]+)/.exec(s ?? "");
  return o ? { L: +o[1], C: +o[2] } : null;
}

const board = async () => (await state()).nodes ?? [];
const palette = async () => (await state()).look?.palette ?? {};
/* Every colour a part wears, role by role, edges included; role NAMES resolved through the palette. */
function worn(nodes, pal) {
  const out = [];
  for (const n of nodes) {
    for (const r of ["bg", "surface", "text", "accent"]) { const v = n.colour?.[r]?.trim(); if (v) out.push({ id: n.id, slot: r, raw: v, value: ROLES.includes(v) ? pal[v] : v }); }
    const e = n.edge; const v = e?.colour?.trim();
    if (v && (e.width ?? 0) > 0 && e.style !== "none") out.push({ id: n.id, slot: "edge", raw: v, value: ROLES.includes(v) ? pal[v] : v });
  }
  return out;
}
const same = (a, b) => (a ?? "").replace(/\s+/g, "").toLowerCase() === (b ?? "").replace(/\s+/g, "").toLowerCase();

const nodes0 = await board();
const pal0 = await palette();
const wear = worn(nodes0, pal0);

/* ------------------------------------------------------------------ */
/* 1. The six are his, and nothing is invented                          */
/* ------------------------------------------------------------------ */

await page.locator('[aria-label="Side panel"] button', { hasText: /Look/i }).first().click({ force: true });
await page.waitForTimeout(700);
/* On a site brought in, the six colours are "Colours for new parts", shown under the theme. */
const swatches = await page.evaluate((names) => Object.fromEntries(Object.entries(names).map(([r, name]) => {
  const b = [...document.querySelectorAll("[data-look-colour] button")].find((e) => e.getAttribute("aria-label") === name);
  return [r, b ? getComputedStyle(b).backgroundColor : null];
})), NAMES);
/* The browser's own form of a colour, so a swatch and a part are compared like for like. */
const canon = (list) => page.evaluate((list) => list.map((c) => { const e = document.createElement("i"); e.style.color = c; document.body.append(e); const v = getComputedStyle(e).color; e.remove(); return v; }), list);
const wornCanon = new Set(await canon([...new Set(wear.map((w) => w.value).filter(Boolean))]));
const invented = ROLES.filter((r) => !wornCanon.has(swatches[r]));
check("every role's swatch is a colour his parts actually wear: nothing invented", invented.length === 0,
  invented.map((r) => `${NAMES[r]} ${swatches[r]}`).join("; "));

/* The accent: the colour (chroma >= 0.05) the most parts wear, counted across every role and the edges. */
const byColour = new Map();
for (const w of wear) { const o = oklchOf((await canon([w.value]))[0]); if (o && o.C >= 0.05) { const k = (await canon([w.value]))[0]; byColour.set(k, (byColour.get(k) ?? new Set()).add(w.id)); } }
const top = [...byColour.entries()].sort((a, b) => b[1].size - a[1].size)[0];
check("the accent is the colour the most of his parts wear, across every role", !!top && swatches.accent === top[0],
  top ? `${top[0]} on ${top[1].size} parts; accent shows ${swatches.accent}` : "no colour on any part");
const tx = oklchOf(swatches.text);
check("text is not white or black, which are defaults, not his choice", !!tx && tx.C >= 0.005, `${swatches.text}`);

/* ------------------------------------------------------------------ */
/* 2. Beside every role, where it came from                            */
/* ------------------------------------------------------------------ */

const sources = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-look-colour] [data-role-source]")].map((e) => [e.getAttribute("data-role-source"), e.textContent.trim()])));
/* What moves when a role moves: parts that name it in a colour, an edge, or a run of their words. */
const namesRole = (n, r) => wear.some((w) => w.id === n.id && w.raw === r) || (Array.isArray(n.content) && n.content.some((s) => (s?.colour ?? "").trim() === r));
const follows = Object.fromEntries(ROLES.map((r) => [r, nodes0.filter((n) => namesRole(n, r)).length]));
const wrongSource = ROLES.filter((r) => {
  const s = sources[r];
  if (!s) return true;
  return follows[r] ? s !== String(follows[r]) : !/not used/i.test(s);
});
check("every role says where it came from: the parts that follow it, or none on this site", wrongSource.length === 0,
  ROLES.map((r) => `${NAMES[r]} "${sources[r] ?? "—"}" (${follows[r]} parts name it)`).join("; "));

/* ------------------------------------------------------------------ */
/* 3. Linked: a part colour equal to a role names the role              */
/* ------------------------------------------------------------------ */

const loose = wear.filter((w) => !ROLES.includes(w.raw) && ROLES.some((r) => same(w.raw, pal0[r])));
check("no part keeps a fixed colour equal to a role: each names the role instead", loose.length === 0 && wear.some((w) => ROLES.includes(w.raw)),
  loose.length ? `${loose.length} still fixed, e.g. ${loose.slice(0, 3).map((w) => `${w.id}.${w.slot}=${w.raw}`).join(", ")}` : `${wear.filter((w) => ROLES.includes(w.raw)).length} slots name a role`);

/* ------------------------------------------------------------------ */
/* 4. The board draws exactly the same as with fixed colours            */
/* ------------------------------------------------------------------ */

const shot = async () => (await page.locator("[data-frame]").first().screenshot({ animations: "disabled" })).toString("base64");
const diff = (a, b) => page.evaluate(async ([a, b]) => {
  const load = async (s) => { const i = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob()); const c = new OffscreenCanvas(i.width, i.height); const x = c.getContext("2d"); x.drawImage(i, 0, 0); return { w: i.width, h: i.height, d: x.getImageData(0, 0, i.width, i.height).data }; };
  const A = await load(a), B = await load(b);
  if (A.w !== B.w || A.h !== B.h) return -1;
  let n = 0; for (let i = 0; i < A.d.length; i += 4) if (Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2]) > 12) n++;
  return n;
}, [a, b]);
/* Both pictures taken the same way, on every page: a fresh load, nothing open, the hand off the board. */
const allPages = async () => {
  const out = {};
  for (const p of doc.pages.map((x) => x.id)) {
    await page.evaluate((id) => { const raw = JSON.parse(localStorage.getItem("builder.studio")); raw.state.activePageId = id; localStorage.setItem("builder.studio", JSON.stringify(raw)); }, p);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(3500);
    await page.mouse.move(2, 2);
    /*
     * A picture is taken until two in a row agree. Measured while this was
     * written: one frame in a series can come out a quarter different with
     * nothing changed (Domains on the build before this, NFTs once on this
     * one; re-shot three times each way, 0 px). A colour change is the same
     * every time, so settling cannot hide one; a page that never settles
     * fails as unsettled rather than passing.
     */
    let last = await shot(), settled = false;
    for (let i = 0; i < 4 && !settled; i++) {
      await page.waitForTimeout(800);
      const next = await shot();
      settled = (await diff(last, next)) === 0;
      last = next;
    }
    out[p] = settled ? last : null;
  }
  return out;
};
const linked = await allPages();
/* The same board with every role name written back as the colour it resolves to. */
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("builder.studio"));
  const pal = raw.state.look?.palette ?? {};
  const R = ["bg", "surface", "text", "muted", "accent", "highlight"];
  const fix = (v) => (typeof v === "string" && R.includes(v.trim()) ? pal[v.trim()] : v);
  raw.state.nodes = raw.state.nodes.map((n) => ({
    ...n,
    colour: n.colour ? Object.fromEntries(Object.entries(n.colour).map(([k, v]) => [k, fix(v)])) : n.colour,
    edge: n.edge ? { ...n.edge, colour: fix(n.edge.colour) } : n.edge,
    content: Array.isArray(n.content) ? n.content.map((s) => ({ ...s, ...(s.colour ? { colour: fix(s.colour) } : {}) })) : n.content,
  }));
  localStorage.setItem("builder.studio", JSON.stringify(raw));
});
const fixed = await allPages();
const changed = [];
for (const p of Object.keys(linked)) {
  if (!linked[p] || !fixed[p]) { changed.push(`${p} never settled`); continue; }
  const n = await diff(linked[p], fixed[p]);
  if (n !== 0) changed.push(`${p} ${n}px`);
}
check(`linked, every page draws exactly what it drew with fixed colours (${Object.keys(linked).length} pages)`, changed.length === 0, changed.join("; ") || "0 px on every page");

/* ------------------------------------------------------------------ */
/* 5. And now the role is a control: moving Accent moves his parts      */
/* ------------------------------------------------------------------ */

/* Back to the linked board as the import left it. */
await page.evaluate((n) => { const raw = JSON.parse(localStorage.getItem("builder.studio")); raw.state.nodes = n; localStorage.setItem("builder.studio", JSON.stringify(raw)); }, nodes0);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(3000);
/* A part with words that wears the accent on them, on the page on screen. */
const onHome = new Set(nodes0.filter((n) => n.pageId === doc.pages[0].id && ["prose", "value-prop"].includes(n.featureId) && typeof n.content === "string" && n.content.trim()).map((n) => n.id));
const accentWearer = wear.find((w) => w.raw === "accent" && w.slot === "text" && onHome.has(w.id));
await page.evaluate((id) => { const raw = JSON.parse(localStorage.getItem("builder.studio")); raw.state.activePageId = id; localStorage.setItem("builder.studio", JSON.stringify(raw)); }, doc.pages[0].id);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const inkNow = () => page.evaluate((id) => { const el = document.querySelector(`[data-node-id="${id}"]`); if (!el) return null; const t = [...el.querySelectorAll("*")].find((x) => x.childNodes.length && [...x.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())); return t ? getComputedStyle(t).color : null; }, accentWearer?.id);
const before = await inkNow();
await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem("builder.studio")); raw.state.look.palette = { ...raw.state.look.palette, accent: "rgb(255, 0, 170)" }; localStorage.setItem("builder.studio", JSON.stringify(raw)); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const after = await inkNow();
check("moving Accent recolours the words that wore his accent", !!accentWearer && !!before && before !== after && after === "rgb(255, 0, 170)",
  accentWearer ? `${accentWearer.id}: ${before} → ${after}` : "no part names the accent");

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
