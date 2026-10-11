/**
 * A BROUGHT-IN PAGE IS DRAWN AS THE BROWSER DREW IT, EDGE TO EDGE.
 *
 * J (2026-10-10): make the import of PonsStars match the live site 1:1.
 * Swept page by page at 1440, 1920, tablet and phone (scripts/pst-sweep.mjs),
 * the parts were right and what lay round them was not:
 *
 *   1. a page's own ground: PST's Leaderboard, Profile and Match pages are
 *      white on the site, and came in white only under their parts, in the
 *      Play page's cream round them (`pageGround.ts`); and the page is at
 *      least the window's height, as a browser paints its body's ground to
 *      the window's foot (`exportSite.ts#fluid`, `smallCss.ts` on a phone);
 *   2. a control the browser paints itself (a plain <button>, a field) is
 *      read as painted: a 1px grey edge round 3px corners, not the 2px black
 *      outset its computed style says (`siteread/parts.ts#styleOf`); and a
 *      file field keeps its "Choose File" button, in light colours;
 *   3. a <summary>'s triangle is a part of its own, before its words, and
 *      the words start past it (`siteread/parts.ts#pseudoParts`);
 *   4. the site sets its type in its own forms, not the Builder's tabular
 *      figures and alternates (globals.css), so its words are as wide as
 *      the page's; and the closed Keys panel casts no shadow on the page.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/page-ground.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/pageGround.ts, src/features/studio/live/LiveSite.tsx, src/features/studio/send-out/exportSite.ts, src/features/studio/bring-in/siteread/parts.ts, src/features/studio/shelf/parts/PageControls.tsx, src/features/keys/KeysPanel.tsx
 */
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { pagesToDoc } from "../src/features/studio/bring-in/pageParts.ts";
import { launch } from "./fixtures/look-sites.mjs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const HOME = `<!doctype html><html><head><style>
body { margin: 8px; font: 16px/1.4 system-ui, sans-serif; color: #1a0f0b; background: #fdf3e6; }
section { padding: 12px; border: 3px solid #1a0f0b; border-radius: 12px; width: 600px; }
summary { font: 16px/1.4 ui-monospace, monospace; }
</style></head><body data-hook="app">
<h1 data-hook="title">Play</h1>
<section data-hook="log"><details data-hook="log-more"><summary data-hook="log-toggle">Details (message log)</summary><p data-hook="log-text">Nothing yet.</p></details></section>
</body></html>`;
const OTHER = `<!doctype html><html><head><style>
body { margin: 8px; font: 16px/1.4 system-ui, sans-serif; color: #111; background: #fff; }
</style></head><body data-hook="board-page">
<h1 data-hook="board-title">Leaderboard</h1>
<p data-hook="board-line">Key <input data-hook="board-key" type="text"> <button data-hook="board-go">Show</button></p>
<p data-hook="board-file-line">Import a file <input data-hook="board-file" type="file"></p>
</body></html>`;

const browser = await launch();
const site = await browser.newPage({ viewport: { width: 1000, height: 700 } });
await site.setContent(HOME);
const readHome = await site.evaluate(PARTS, 1500);
const summaryText = await site.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('[data-hook="log-toggle"]').firstChild); return Math.round(r.getBoundingClientRect().left); });
await site.setContent(OTHER);
const readOther = await site.evaluate(PARTS, 1500);
await site.close();

/* 2 and 3, as read */
const partsOf = (r) => r.parts ?? r;
const go = partsOf(readOther).find((p) => p.hooks?.["data-hook"] === "board-go");
check("2. a plain button is read as the browser paints it: a 1px grey edge, 3px corners", go?.style?.border?.w === 1 && /118, 118, 118/.test(go.style.border.colour) && go.style.radius === 3, JSON.stringify(go?.style?.border) + ` r${go?.style?.radius}`);
const key = partsOf(readOther).find((p) => p.hooks?.["data-hook"] === "board-key");
check("…and a plain field: a 1px grey edge, not the 2px inset", key?.style?.border?.w === 1 && /118, 118, 118/.test(key.style.border.colour), JSON.stringify(key?.style?.border));
const marker = partsOf(readHome).find((p) => p.tag === "::marker");
check("3. the summary's triangle is a part of its own, before its words", !!marker && marker.words === "▶" && marker.box.x + marker.box.w <= summaryText + 1, JSON.stringify(marker ? { words: marker.words, box: marker.box, text: summaryText } : null));

const { doc } = pagesToDoc([{ file: "site/index.html", read: readHome }, { file: "site/leaderboard.html", read: readOther }], { at: 1 });
const other = doc.pages.find((p) => p.path !== "/");
const home = doc.pages.find((p) => p.path === "/") ?? doc.pages[0];
const toggle = doc.nodes.find((n) => n.hooks?.["data-hook"] === "log-toggle");
check("…and the summary's words keep their start past it", (toggle?.pad?.left ?? 0) >= 12, JSON.stringify(toggle?.pad));

/* 1 and 4, drawn */
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false } }) }));
await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "ground", name: "ground", updatedAt: Date.now() }], activeId: "ground" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, activePageId: home.id });
await page.waitForTimeout(2500);
const keysShadow = await page.evaluate(() => { const k = document.querySelector("[data-keys-panel]"); return k ? getComputedStyle(k).boxShadow : "none"; });
check("4. the closed Keys panel casts no shadow over the page", keysShadow === "none", keysShadow);

await page.goto(`${BASE}/builder/preview/${other.path.replace(/^\/+/, "")}`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const drawn = await page.evaluate(() => {
  const root = document.querySelector("[data-live-root]"), sc = document.querySelector("[data-live-scroller]");
  const cs = getComputedStyle(root);
  const file = document.querySelector("input[type=file]");
  return { bg: cs.backgroundColor, h: root.getBoundingClientRect().height, room: sc?.clientHeight ?? 0, features: cs.fontFeatureSettings, scheme: cs.colorScheme, fileButton: file ? getComputedStyle(file, "::file-selector-button").backgroundColor : null };
});
check("1. a page whose body is white is white edge to edge, not the look's cream", drawn.bg === "rgb(255, 255, 255)", drawn.bg);
check("…and at least as tall as the window it is seen in", drawn.h >= drawn.room - 1, `${drawn.h} in ${drawn.room}`);
check("4. the site's type is set in its own forms, its controls in light colours", drawn.features === "normal" && drawn.scheme === "light", `${drawn.features} · ${drawn.scheme}`);
check("2. the file field keeps a light button", !!drawn.fileButton && drawn.fileButton !== "rgba(0, 0, 0, 0)" && parseInt(drawn.fileButton.slice(4)) > 200, String(drawn.fileButton));

await page.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const homeBg = await page.evaluate(() => getComputedStyle(document.querySelector("[data-live-root]")).backgroundColor);
check("…while a page in the look's own ground keeps it", homeBg === "rgb(253, 243, 230)", homeBg);
check("with no page error on the way", errors.length === 0, errors.join(" / "));
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
