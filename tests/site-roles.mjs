/**
 * "On this site" colours, by role (Lane I, owner request on Trump & Morty).
 *
 * HIS WORDS: too much for a site; a few near-whites need not be separate;
 * not every fill or button colour needs showing; he could not find the brown
 * shadow buttons, the 85 borders and outlines or the 76 shadows; the
 * background and pictures should not be counted, except colours like the TV
 * and every element on top of the background.
 *
 *   1. on three captured boards the short palette stays within the role cap,
 *      no two swatches of a role are closer than the merge distance, and no
 *      colour worn by one or two parts is in it;
 *   2. the counts say what they are ("outline, 3 to 5 px, on 78 parts",
 *      "drop shadow on 69 parts");
 *   3. a background layer's colour and a background picture are left out,
 *      a picture part on top adds its few main colours (a fixture: a large
 *      background picture, a band with parts on it, and a picture on top);
 *   4. near-whites become one swatch marked with its shades;
 *   5. in the Builder: the panel shows the short palette, pressing the
 *      default black line (Trump & Morty's outlines, shadows and words)
 *      outlines every part wearing it on the board and lists them, and
 *      Recolour all changes the board and the export;
 *   6. near-black and near-white are the site's plain ink: never a role,
 *      one quiet line each that counts every part wearing them; and words
 *      drawn inside a picture are never counted as words.
 *
 *   node tests/site-roles.mjs http://localhost:3000 [path to a sink checkout]
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { siteRoles, mainColours, colourName, inkOf, MERGE_SHADES, ROLE_CAP, FEW } from "../src/features/studio/siteRoles.ts";
import { oklabDistance, tallyColours, colourKey, spotsOf } from "../src/features/studio/siteColours.ts";
import { landPalette } from "../src/features/studio/paletteFrom.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SINK = process.argv[3] ?? join(process.cwd(), "..", "sink");
const SHOTS = ".screenshots/lane-i";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const landed = (site) => {
  const at = join(SINK, "sites", site, "site", "document.json");
  if (!existsSync(at)) return null;
  const doc = JSON.parse(readFileSync(at, "utf8"));
  const l = landPalette(doc.nodes, doc.look?.palette ?? {});
  return { ...doc, nodes: l.nodes, look: { ...doc.look, palette: l.palette, paletteFrom: l.from } };
};

/* ------------------------------------------------------------ 1, 2 */
const BOARDS = ["trumpmorty-fun", "parasiteonsol-fun", "gotchi-gg"];
const counts = [];
for (const site of BOARDS) {
  const doc = landed(site);
  if (!doc) { check(`${site} is in the sink checkout`, false, SINK); continue; }
  const r = siteRoles(doc.nodes, doc.look.palette, doc.frameWidth ?? 1440);
  const before = tallyColours(doc.nodes, doc.look.palette);
  const beforeN = Object.values(before.byUse).reduce((n, x) => n + x.length, 0);
  const visible = r.short.flatMap((x) => x.swatches);
  counts.push({ site, before: beforeN, beforeBy: Object.fromEntries(Object.entries(before.byUse).map(([k, v]) => [k, v.length])), roles: r.short.length, swatches: visible.length, more: r.more.length });
  check(`1. ${site}: the short palette is within the role cap`, r.short.length <= ROLE_CAP && r.short.every((x) => x.swatches.length <= 2), `${r.short.length} roles, ${visible.length} swatches (was ${beforeN} swatches in five groups)`);
  const close = [];
  for (const row of r.short) for (const a of row.swatches) for (const b of row.swatches) if (a !== b && oklabDistance(a.value, b.value) < MERGE_SHADES) close.push(`${a.value}~${b.value}`);
  const allRole = [...visible, ...r.more];
  for (const role of new Set(allRole.map((s) => s.role))) {
    const list = allRole.filter((s) => s.role === role);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (oklabDistance(list[i].value, list[j].value) < MERGE_SHADES) close.push(`${role}: ${list[i].value}~${list[j].value}`);
  }
  check(`1. ${site}: no two swatches of a role are closer than the merge distance (${MERGE_SHADES} in OKLab)`, close.length === 0, close.slice(0, 3).join(", "));
  check(`1. ${site}: nothing worn by only one or two parts is in the short palette`, visible.every((s) => s.parts > FEW));
  check(`2. ${site}: every swatch says what it is and on how many parts`, visible.every((s) => /\b\d+ (parts?|buttons?|pictures?)\b/.test(s.says) && /^[A-Z]/.test(s.says)), visible.map((s) => s.says).join(" | "));
}
const tm = landed("trumpmorty-fun");
if (tm) {
  const r = siteRoles(tm.nodes, tm.look.palette, 1440);
  const says = r.short.flatMap((x) => x.swatches).map((s) => s.says);
  const black = r.ink.find((x) => x.id === "ink|black");
  check("2. Trump & Morty's black outlines and shadows are its default black, said as such", !!black && /^Default black: words, fills, outlines and shadows on \d+ parts/.test(black.says), black?.says);
  check("2. and its real colours take the roles", says.some((x) => /^Lime /.test(x)) && says.some((x) => /^Red /.test(x)), says.join(" | "));
}

/* ------------------------------------------------------------ 3 */
const P = (id, extra) => ({ id, pageId: "p", x: 0, y: 0, w: 100, h: 50, featureId: "box", content: "", ...extra });
const fixture = [
  /* A full-width picture behind everything, and a full-width yellow band with parts on it: scenery. */
  P("bgpic", { w: 1440, h: 900, picture: { id: "pic_bg", path: "x.webp" } }),
  P("band", { y: 900, w: 1440, h: 600, colour: { bg: "rgb(243, 212, 64)" } }),
  /* On top: a picture part (the television), cards, words, buttons. */
  P("tv", { x: 800, y: 100, w: 398, h: 398, picture: { id: "pic_tv", path: "tv.webp" } }),
  ...[0, 1, 2].map((i) => P(`card${i}`, { x: 100 + i * 300, y: 1000, w: 260, h: 200, colour: { bg: "rgb(137, 206, 188)", text: "rgb(250, 250, 250)" }, content: "A card" })),
  P("note1", { x: 100, y: 1300, colour: { text: "rgb(253, 251, 245)" }, content: "words" }),
  P("note2", { x: 300, y: 1300, colour: { text: "rgb(255, 248, 236)" }, content: "words" }),
  ...[0, 1, 2].map((i) => P(`btn${i}`, { featureId: "cta-primary", x: 100 + i * 200, y: 200, colour: { bg: "rgb(210, 60, 52)" }, content: "Buy" })),
];
const pics = new Map([["bgpic", ["rgb(10, 20, 80)", "rgb(200, 30, 200)"]], ["tv", ["rgb(237, 165, 124)", "rgb(20, 20, 20)", "rgb(240, 223, 123)", "rgb(1, 2, 3)"]]]);
const fr = siteRoles(fixture, { bg: "rgb(29, 34, 51)" }, 1440, pics);
const every = [...fr.short.flatMap((x) => x.swatches), ...fr.more];
const keys = new Set(every.flatMap((s) => s.shades));
check("3. the page's own colour is left out", !keys.has(colourKey("rgb(29, 34, 51)")));
check("3. a background band's fill is left out", !keys.has(colourKey("rgb(243, 212, 64)")) && fr.left.backgroundLayers.includes("band"), fr.left.backgroundLayers.join(", "));
check("3. a background picture's colours are left out", !keys.has(colourKey("rgb(10, 20, 80)")) && !keys.has(colourKey("rgb(200, 30, 200)")) && fr.left.backgroundPictures === 1);
const tvs = every.filter((s) => s.role === "pictures");
check("3. a picture on top adds its few main colours, three at most", tvs.length > 0 && tvs.length <= 3 && tvs.every((s) => s.spots.every((x) => x.id === "tv")), tvs.map((s) => s.value).join(", "));
check("3. the parts on top are all counted: cards, words, buttons", ["panels", "main"].some((r) => every.some((s) => s.role === r && s.value === "rgb(137, 206, 188)")) && every.some((s) => s.role === "buttons" && s.parts === 3));

/* ------------------------------------------------------------ 4 */
/* Near-whites and creams are the site's plain white now: one quiet line, its shades listed. */
const whiteLine = fr.ink.find((x) => x.id === "ink|white");
check("4. near-whites and creams are one line, marked with its shades", !!whiteLine && whiteLine.shades.length === 3 && /\(3 shades\)/.test(whiteLine.says) && !every.some((x) => colourName(x.value) === "Near-white"), whiteLine?.says);
const px = new Uint8ClampedArray(32 * 32 * 4);
for (let i = 0; i < 32 * 32; i++) { const orange = i < 600; px.set(orange ? [237, 165, 124, 255] : i < 900 ? [20, 20, 20, 255] : [0, 0, 0, 0], i * 4); }
const mc = mainColours(px);
check("3. a picture's main colours are read off its pixels, transparent ones ignored", mc.length === 2 && /237, 165, 124/.test(mc[0]), mc.join(", "));

/* ------------------------------------------------------------ 6 */
for (const site of BOARDS) {
  const doc = landed(site);
  if (!doc) continue;
  const r = siteRoles(doc.nodes, doc.look.palette, doc.frameWidth ?? 1440);
  const shown = [...r.short.flatMap((x) => x.swatches), ...r.more];
  const plain = shown.filter((x) => inkOf(x.value));
  check(`6. ${site}: no near-black or near-white swatch is shown as a role`, plain.length === 0 && r.short.every((row) => row.swatches.every((x) => !inkOf(x.value))), plain.slice(0, 3).map((x) => x.says).join(" | "));
  const pics = new Set(doc.nodes.filter((n) => n.picture).map((n) => n.id));
  const wordsFromPictures = shown.filter((x) => x.role === "words").flatMap((x) => x.spots).filter((x) => pics.has(x.id));
  check(`6. ${site}: a picture is never counted as words`, wordsFromPictures.length === 0, `${r.left.pictureWords} pictures' words left out`);
  /* The default lines count every part whose words, fills, outlines or shadows are plain ink, counted here again on their own. */
  const back = new Set(r.left.backgroundLayers);
  for (const which of ["black", "white"]) {
    const ids = new Set();
    for (const n of doc.nodes) for (const w of spotsOf(n, doc.look.palette)) {
      const v = w.spot.role ? doc.look.palette[w.spot.role] : w.raw;
      if (!v || inkOf(v) !== which) continue;
      const alpha = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(colourKey(v));
      if (alpha && Number(alpha[1]) < 0.5) continue;
      if (w.spot.use === "text" && n.picture) continue;
      if (w.spot.use === "fill" && back.has(n.id)) continue;
      ids.add(n.id);
    }
    const line = r.ink.find((x) => x.id === `ink|${which}`);
    check(`6. ${site}: the default ${which} line counts every part wearing it`, (line?.parts ?? 0) === ids.size && (!ids.size || new RegExp(`on ${ids.size} parts?`).test(line.says)), `${line?.says ?? "no line"} (counted ${ids.size})`);
  }
}

/* ------------------------------------------------------------ 5 */
if (tm) {
  const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
  const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__studioLoadDoc === "function", null, { timeout: 60000 });
  await page.evaluate((d) => window.__studioLoadDoc(d), tm);
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__studioSetLeftPanel?.("look"));
  await page.waitForTimeout(1200);
  const rows = await page.$$eval("[data-role-palette] > [data-role-row]", (els) => els.map((e) => ({ role: e.getAttribute("data-role-row"), swatches: e.querySelectorAll("[data-role-swatch]").length })));
  check("5. the panel shows the short palette, within the cap", rows.length > 0 && rows.length <= ROLE_CAP && rows.every((r) => r.swatches <= 2), rows.map((r) => `${r.role} ${r.swatches}`).join(", "));
  const byUseShown = await page.$$eval("[data-site-colours] [data-site-group]", (els) => els.length);
  check("5. the unmerged list by use is folded under More", byUseShown === 0, `${byUseShown} groups showing`);
  await page.locator("[data-site-colours]").screenshot({ path: `${SHOTS}/site-colours-after.png` });

  /* Trump & Morty's outlines are its default black now: the line that holds them is what a person presses to find them. */
  const outline = page.locator('[data-ink-lines] [data-role-swatch="ink|black"]').first();
  const outlineId = await outline.getAttribute("data-role-swatch");
  await outline.click();
  await page.waitForTimeout(1500);
  const r = siteRoles(tm.nodes, tm.look.palette, 1440);
  const sw = [...r.short.flatMap((x) => x.swatches), ...r.more, ...r.ink].find((s) => s.id === outlineId);
  const want = new Set(sw.spots.map((s) => s.id));
  const marked = new Set(await page.$$eval("[data-point-mark]", (els) => els.map((e) => e.getAttribute("data-point-mark"))));
  /* Past a hundred rows the list draws only what is in view: scrolled through, every row is met. */
  const listed = new Set(await page.evaluate(async (id) => {
    const box = document.querySelector(`[data-role-detail="${id}"]`);
    const seen = new Set();
    const read = () => box.querySelectorAll("[data-site-part]").forEach((e) => seen.add(e.getAttribute("data-site-part")));
    read();
    const scroller = [...box.querySelectorAll("*")].find((e) => e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== "visible");
    if (scroller) for (let top = 0; top <= scroller.scrollHeight; top += 60) { scroller.scrollTop = top; await new Promise((r) => setTimeout(r, 40)); read(); }
    return [...seen];
  }, outlineId));
  check("5. pressing the default black line (its outlines among them) outlines every part wearing it on the board", want.size > 0 && [...want].every((id) => marked.has(id)), `${marked.size} outlined of ${want.size}`);
  check("5. and lists every one of them by name", [...want].every((id) => listed.has(id)), `${listed.size} listed`);
  const first = [...want][0];
  const inView = await page.evaluate((id) => {
    const el = document.querySelector(`[data-node-id="${id}"]`); const pane = el?.closest("[data-studio-pane]") ?? el?.closest("[data-studio-scroll]");
    if (!el || !pane) return false; const r = el.getBoundingClientRect(), p = pane.getBoundingClientRect();
    return r.bottom > p.top && r.top < p.bottom;
  }, sw.spots[0].id);
  check("5. and brings the first of them into view", inView, first);
  await page.screenshot({ path: `${SHOTS}/site-colours-outline-pressed.png` });

  /* Recolour all: the board and the export. */
  await page.locator(`[data-role-detail="${outlineId}"] input[aria-label="New colour, as hex"]`).fill("#00cc88");
  await page.locator(`[data-role-detail="${outlineId}"] [data-role-recolour]`).click();
  await page.waitForTimeout(1200);
  const doc = await page.evaluate(() => window.__studioPublishDoc());
  const edged = doc.nodes.filter((n) => want.has(n.id) && n.edge && (n.edge.width ?? 1) > 0 && n.edge.style !== "none");
  const recoloured = edged.filter((n) => colourKey(n.edge.colour) === "rgb(0, 204, 136)");
  check("5. Recolour all changes every outline it names", edged.length > 0 && recoloured.length === edged.length, `${recoloured.length} of ${edged.length} edges`);
  /* The new colour as the document writes it (an oklch() the panel makes), and as the browser paints it, compared as colours. */
  const written = edged[0]?.edge.colour ?? "";
  const borders = await page.evaluate((id) => {
    const el = document.querySelector(`[data-node-id="${id}"]`);
    return (el ? [el, ...el.querySelectorAll("*")] : []).map((e) => getComputedStyle(e).borderTopColor);
  }, edged[0]?.id);
  check("5. and the board draws it", borders.some((b) => colourKey(b) === "rgb(0, 204, 136)"), `${written}; board: ${[...new Set(borders)].slice(0, 3).join(", ")}`);
  const files = await page.evaluate(async () => (await window.__studioExport()).filter((f) => !f.encoding).map((f) => f.content).join("\n"));
  const inExport = [...files.matchAll(/border[^;"]*?((?:oklch|rgb)\([^)]*\)|#[0-9a-f]{6})/gi)].map((m) => m[1]);
  check("5. and the export carries it", inExport.some((c) => colourKey(c) === "rgb(0, 204, 136)"), `${inExport.filter((c) => colourKey(c) === "rgb(0, 204, 136)").length} borders in the new colour`);
  await browser.close();
}

console.log("\n  board | before: swatches (text, fill, border, shadow, accent) | after: roles, swatches, under More");
for (const c of counts) console.log(`  ${c.site} | ${c.before} (${Object.values(c.beforeBy).join(", ")}) | ${c.roles}, ${c.swatches}, ${c.more}`);
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
