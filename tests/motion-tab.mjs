#!/usr/bin/env node
/**
 * THE MOTION TAB LISTS EVERY MOVING PART, AND A CRATE PLAYS ON A PART.
 *
 * Found walking the live Builder: the Motion tab held only "Frame
 * interpolation / Crate"; a crate could not be put on anything ("No part of
 * the page plays it yet", "Used as" a line of free text); its controls were
 * 16 × 16 px in 36 px sleeves inside the 228 px panel.
 *
 * Held here, in the real Builder, on a page of four parts: one revealed on
 * scroll that also spins, one captured with an animation of its own, one
 * wearing a crate of three keyframes in sleeves 1, 3 and 5, and a plain box.
 *
 *   · the tab lists them by kind, under plain names, with play, off and on,
 *     and how fast where the kind has it;
 *   · pressing a row selects the part and brings it into view on the board;
 *   · turning one off, and changing how fast, are one undo step each, and
 *     undo puts them back; the export follows (a captured part turned off
 *     has no rule in the stylesheet; the reveal turned off ships no binding);
 *   · the crate plays as the part's picture on the board, in the preview and
 *     on the published page (its strip a file of its own, one CSS rule);
 *   · its editor is a wide pop-out, every control in it at least 24 px, the
 *     gaps named by their sleeves (1 → 3, 3 → 5, 5 → 1), one name for how it
 *     plays; three frames play, loop and blend in OKLab (the middle of red to
 *     green is the OKLab middle, not the dull RGB one);
 *   · Pick on the board puts it on the next part pressed.
 *
 * Screenshots go to .screenshots/.
 *
 *   node --experimental-strip-types tests/motion-tab.mjs [url]
 */
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fromOklab, toOklab } from "../src/features/studio/oklab.ts";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const SHOTS = ".screenshots";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, label, x, y, w, h, extra = {}) => ({
  id, pageId: "page_home", featureId: "box", label, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...extra,
});

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false }, configured: false, source: null }) }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });

/* Three solid keyframes the size of the editor's frame: red, green, blue. */
const frames = await page.evaluate(() => ["#ff0000", "#00ff00", "#0000ff"].map((c) => {
  const cv = document.createElement("canvas"); cv.width = 264; cv.height = 148;
  const x = cv.getContext("2d"); x.fillStyle = c; x.fillRect(0, 0, 264, 148);
  return cv.toDataURL("image/png");
}));
const crate = {
  id: "mo_walk", name: "Walk", frames: [frames[0], null, frames[1], null, frames[2]],
  duration: 1.5, fps: 30, loop: "wrap", hold: 0, gaps: [1, 1, 1, 1, 1], ease: "linear", use: "background layer", part: "picture",
};
const doc = {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("title", "Hero title", 100, 80, 600, 120, { content: "Hello", work: { id: "reveal", inputs: { duration: "700" }, also: [{ id: "spin", inputs: { period: "20" } }] } }),
    node("badge", "Spinning badge", 800, 80, 200, 200, { colour: { bg: "rgb(40, 120, 200)" }, motion: { animation: [{ name: "wobble", duration: "2s", timing: "linear", iterations: "infinite" }] } }),
    node("picture", "Hero picture", 100, 1400, 480, 270),
    node("plain", "Plain box", 700, 1400, 300, 200),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "MOTION", gimmick: "", master: "" }, motion: [crate],
  look: { keyframes: [{ name: "wobble", frames: [{ key: "0%", style: { rotate: "0deg" } }, { key: "100%", style: { rotate: "10deg" } }] }] },
  frameWidth: 1440, activePageId: "page_home", trail: [], swept: 999,
};
await page.evaluate((d) => { localStorage.clear(); localStorage.setItem("builder.studio", JSON.stringify({ state: d, version: 0 })); }, doc);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const nodeOf = async (id) => (await saved()).nodes?.find((n) => n.id === id);
const depth = () => page.evaluate(() => window.__studioUndoDepth?.() ?? -1);
const wait = (ms) => page.waitForTimeout(ms);
const panel = page.locator("[data-motion-panel]");
await page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Motion" }).first().click();
await wait(600);

/* ------------------------------------------------------------ the list: each kind folded first, then opened */
check("each kind starts as one folded line, its parts not yet listed", (await panel.locator("[data-move-fold=kind]").count()) === 3 && (await panel.locator("[data-move-row]").count()) === 0, `${await panel.locator("[data-move-fold=kind]").count()} kinds, ${await panel.locator("[data-move-row]").count()} rows`);
for (const b of await panel.locator("[data-move-fold=kind] [data-move-open]").all()) { await b.click(); await wait(150); }
const kinds = await panel.locator("[data-move-kind]").evaluateAll((els) => els.map((e) => e.getAttribute("data-move-kind")));
check("the tab lists moving parts by kind: reveal, loops, crates", ["reveal", "loop", "crate"].every((k) => kinds.includes(k)), kinds.join(", "));
const rowKeys = await panel.locator("[data-move-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-move-row")));
check("…one row for each movement: the reveal, the spin, the captured animation, the crate", ["title:work:reveal", "title:work:spin", "badge:captured", "picture:crate:mo_walk"].every((k) => rowKeys.includes(k)) && rowKeys.length === 4, rowKeys.join(", "));
const names = await panel.locator("[data-move-go]").allInnerTexts();
check("…under the parts' plain names", ["Hero title", "Spinning badge", "Hero picture"].every((n) => names.some((t) => t.includes(n))), names.map((t) => t.split("\n")[0]).join(" | "));
check("…with play and off buttons on every row", (await panel.locator("[data-move-row] button[aria-label^='Play']").count()) === 4 && (await panel.locator("[data-move-row] button[aria-pressed]").count()) === 4);
const speeds = await panel.locator("[data-move-row]").evaluateAll((els) => els.filter((e) => e.querySelector("[data-move-speed]")).map((e) => e.getAttribute("data-move-row")));
check("…and how fast where the kind has it (reveal, spin, captured animation, crate)", speeds.length === 4, speeds.join(", "));
await page.screenshot({ path: `${SHOTS}/motion-tab.png` });

/* ------------------------------------------------------------ selects and scrolls */
const pictureRow = panel.locator('[data-move-row="picture:crate:mo_walk"]');
await pictureRow.locator("[data-move-go]").click();
await wait(900);
const inView = await page.evaluate(() => {
  const r = document.querySelector('[data-node-id="picture"]')?.getBoundingClientRect();
  return r ? r.top < innerHeight && r.bottom > 0 : false;
});
check("pressing a row selects the part", (await pictureRow.getAttribute("data-move-selected")) === "");
check("…and brings it into view on the board, however far down it is", inView);

/* ------------------------------------------------------------ the crate on the part */
const boardCrate = page.locator('[data-node-id="picture"] .crate-play');
await boardCrate.first().waitFor({ timeout: 8000 }).catch(() => {});
const boardStyle = await boardCrate.first().evaluate((e) => ({ bg: e.style.backgroundImage, anim: getComputedStyle(e).animationName, steps: e.style.animation })).catch(() => null);
check("the crate plays as the part's picture on the board: a strip, stepped by one animation", !!boardStyle && /url\(/.test(boardStyle.bg) && boardStyle.anim === "crate-run" && /steps\(45/.test(boardStyle.steps), JSON.stringify(boardStyle));
await page.screenshot({ path: `${SHOTS}/crate-on-part-board.png` });

/* ------------------------------------------------------------ off, and undo */
const titleRow = panel.locator('[data-move-row="title:work:reveal"]');
let d0 = await depth();
await titleRow.locator("button[aria-pressed]").click();
await wait(400);
let t = await nodeOf("title");
check("turning the reveal off switches it off on the part, its settings kept", t?.work?.off === true && t?.work?.inputs?.duration === "700", JSON.stringify(t?.work));
check("…as one undo step", (await depth()) === d0 + 1, `${d0} → ${await depth()}`);
let files = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: typeof f.content === "string" ? f.content : "" })));
let home = files.find((f) => f.path === "index.html")?.content ?? "";
check("…and the export ships no reveal for it", !/"feature":\s*"reveal"/.test(home) && /"feature":\s*"spin"/.test(home), (/<script[^>]*site-features[^>]*>([\s\S]*?)<\/script>/.exec(home)?.[1] ?? "no binding list").slice(0, 200));
await page.locator("body").click({ position: { x: 5, y: 500 } }).catch(() => {});
await page.keyboard.press("Control+z");
await wait(500);
t = await nodeOf("title");
check("undo turns it back on", !t?.work?.off, JSON.stringify(t?.work));

/* ------------------------------------------------------------ how fast, one step */
d0 = await depth();
const spinSlider = panel.locator('[data-move-row="title:work:spin"] [role=slider]');
await spinSlider.focus();
await page.keyboard.press("ArrowRight");
await wait(400);
t = await nodeOf("title");
check("how fast writes the spin's own setting: one turn in 20.5 seconds", t?.work?.also?.[0]?.inputs?.period === "20.5", JSON.stringify(t?.work?.also));
check("…as one undo step", (await depth()) === d0 + 1, `${d0} → ${await depth()}`);
const readout = await panel.locator('[data-move-row="title:work:spin"] [data-move-speed]').innerText();
check("…and reads out in words, the unit spelled out", /20\.5 seconds/.test(readout), readout.replace(/\s+/g, " "));

/* ------------------------------------------------------------ a captured part, off, reaches the export */
const badgeRow = panel.locator('[data-move-row="badge:captured"]');
files = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: typeof f.content === "string" ? f.content : "" })));
/* A page's parts move in its own sheet (assets/motion/<page>.css) beside site.css: every stylesheet is read. */
const allCss = (fs) => fs.filter((f) => f.path.endsWith(".css")).map((f) => f.content).join("\n");
const cssOn = allCss(files);
await badgeRow.locator("button[aria-pressed]").click();
await wait(400);
files = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: typeof f.content === "string" ? f.content : "" })));
const cssOff = allCss(files);
check("a captured animation turned off leaves the published stylesheet", /animation:[^;}]*cap-wobble/.test(cssOn) && !/animation:[^;}]*cap-wobble/.test(cssOff), `played ${/animation:[^;}]*cap-wobble/.test(cssOn)} on, ${/animation:[^;}]*cap-wobble/.test(cssOff)} off`);
await badgeRow.locator("button[aria-pressed]").click();
await wait(300);

/* ------------------------------------------------------------ the published crate */
const all = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: typeof f.content === "string" ? f.content.slice(0, 200000) : "", encoding: f.encoding ?? null })));
const strip = all.find((f) => /^assets\/crates\/mo_walk\.(webp|png)$/.test(f.path));
home = all.find((f) => f.path === "index.html")?.content ?? "";
const css = all.find((f) => f.path === "assets/site.css")?.content ?? "";
check("the export carries the crate's strip as a file of its own", !!strip && strip.encoding === "base64" && strip.content.length > 100, strip?.path ?? all.map((f) => f.path).join(", "));
check("…the part on the page plays it, pointing at that file", new RegExp(`class="crate-play"[^>]*assets/crates/mo_walk\\.`).test(home) || new RegExp(`assets/crates/mo_walk\\.[^"]*"[^>]*class="crate-play"`).test(home) || (/crate-play/.test(home) && /assets\/crates\/mo_walk\./.test(home)), (/<div[^>]*crate-play[^>]*>/.exec(home)?.[0] ?? "no crate element").slice(0, 240));
check("…and the stylesheet holds the one rule that steps it, still for a visitor asking for less motion", /@keyframes crate-run/.test(css) && /prefers-reduced-motion: reduce\)\s*\{\s*\.crate-play/.test(css));
check("…with no Builder address left in the page", !/blob:|data-crate/.test(home));

/* ------------------------------------------------------------ in the preview */
await page.keyboard.press("Escape");
await page.evaluate(() => document.activeElement?.blur?.());
await page.keyboard.press("p");
await wait(1500);
const previewCrate = await page.locator('[data-live-node="picture"] .crate-play').count();
check("in Preview the part plays it too", previewCrate >= 1, `${previewCrate}`);
await page.screenshot({ path: `${SHOTS}/crate-in-preview.png` });
await page.keyboard.press("p");
await wait(800);

/* ------------------------------------------------------------ the wide editor */
await page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Motion" }).first().click().catch(() => {});
await wait(300);
await panel.locator('[data-crate-card="mo_walk"]').getByRole("button", { name: /Open editor/ }).click();
await wait(700);
const editor = page.locator('[data-crate-editor="mo_walk"]');
const eb = await editor.boundingBox();
check("the crate opens in a wide editor of its own, wider than the 228 px panel", !!eb && eb.width >= 560, eb ? `${Math.round(eb.width)} px wide` : "no editor");
const small = await editor.evaluate((root) => [...root.querySelectorAll("button, [role=slider], [role=radio], [role=combobox], input:not([type=file])")]
  .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24) && el.getAttribute("role") !== "slider"; })
  .map((el) => `${el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 20)} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`));
check("every button and choice in it is at least 24 px", small.length === 0, small.join(" | "));
const sleeveButtons = await editor.locator('[data-sleeve="3"] button').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return `${Math.round(r.width)}×${Math.round(r.height)}`; }));
check("…the sleeves' own buttons included", sleeveButtons.length >= 2 && sleeveButtons.every((s) => s.split("×").every((n) => Number(n) >= 24)), sleeveButtons.join(", "));
const gapLabels = await editor.locator("[data-crate-gaps] span.text-small").allInnerTexts();
check("the gaps are named by their sleeves: 1 → 3, 3 → 5, 5 → 1", ["Sleeve 1 → 3", "Sleeve 3 → 5", "Sleeve 5 → 1"].every((g) => gapLabels.includes(g)), gapLabels.join(", "));
const plays = editor.getByRole("combobox", { name: "Plays" });
const playsText = (await plays.innerText().catch(() => "")).trim();
const loopNamed = await editor.locator('[aria-label="Loop"]').count();
const wrapShown = await editor.getByText(/^Wrap$/).count();
check("how it plays has one name: the control is Plays and shows Round and round", playsText === "Round and round" && loopNamed === 0 && wrapShown === 0, `shows "${playsText}", ${loopNamed} named Loop, ${wrapShown} showing Wrap`);
check("the editor says which part wears it", /Hero picture/.test(await editor.locator("[data-crate-worn]").innerText()));

/* Three frames: 45 of them; the middle of the first gap is the OKLab middle of red and green. */
const counter = editor.locator("[data-crate-counter]");
check("three keyframes in sleeves 1, 3 and 5 play 45 frames", /\/45$/.test((await counter.innerText()).trim()), await counter.innerText());
const scrub = editor.locator("[data-crate-scrub] [role=slider]");
await scrub.focus();
await page.keyboard.press("Home");
for (let i = 0; i < 7; i++) await page.keyboard.press("ArrowRight");
await wait(200);
const where = await editor.locator("[data-crate-where]").innerText();
const pixel = await page.evaluate(() => { const c = document.querySelector("[data-crate-editor] [data-motion-canvas]"); return [...c.getContext("2d").getImageData(132, 74, 1, 1).data]; });
const a = toOklab(255, 0, 0), b = toOklab(0, 255, 0);
const want = fromOklab((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
check("frame 8 is halfway from sleeve 1 to sleeve 3", /Between sleeves 1 and 3, 50% across/.test(where), where);
check("…and is the OKLab middle of red and green, not the dull RGB one", want.every((v, i) => Math.abs(v - pixel[i]) <= 2) && !(Math.abs(pixel[0] - 128) < 4 && Math.abs(pixel[1] - 128) < 4), `${pixel.slice(0, 3)} (OKLab middle ${want}, RGB middle 128,128,0)`);
await page.screenshot({ path: `${SHOTS}/crate-editor.png` });
/* It loops: played past its end it comes round to the start again. */
await editor.getByRole("button", { name: "Play the sequence" }).click();
let wrapped = false, last = 0;
const t0 = Date.now();
while (Date.now() - t0 < 2600) {
  const n = Number((await counter.innerText()).split("/")[0]);
  if (n < last) wrapped = true;
  last = n;
  await wait(60);
}
await editor.getByRole("button", { name: "Pause" }).click();
check("…and it loops, round and round", wrapped);

/* ------------------------------------------------------------ pick on the board */
d0 = await depth();
await editor.getByRole("button", { name: /Pick on the board/ }).click();
await wait(600);
check("Pick on the board steps the editor aside and says what to do", (await page.locator("[data-crate-editor]").count()) === 0 && (await panel.locator("[data-crate-picking]").count()) === 1);
const plain = page.locator('[data-node-id="plain"]');
await plain.scrollIntoViewIfNeeded();
const pb = await plain.boundingBox();
await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
await wait(900);
const worn = (await saved()).motion?.find((m) => m.id === "mo_walk")?.part;
check("…the part pressed next wears the crate", worn === "plain", String(worn));
check("…in one undo step", (await depth()) === d0 + 1, `${d0} → ${await depth()}`);
check("…and the editor comes back", (await page.locator('[data-crate-editor="mo_walk"]').count()) === 1);
await page.keyboard.press("Escape");
await wait(400);
const moved = await page.locator('[data-node-id="plain"] .crate-play').count() === 1 && await page.locator('[data-node-id="picture"] .crate-play').count() === 0;
check("…and it plays there now, and not on the part it left", moved);

check("no page error", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
