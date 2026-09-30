#!/usr/bin/env node
/**
 * A PAGE WITH HUNDREDS OF MOVING PARTS: EACH KIND FOLDED, EVERY NAME READABLE.
 *
 * Found on the live Builder with Trump & Morty open (2c22793): the Motion
 * tab listed 274 moving parts, 178 of them as separate "Reveal on scroll /
 * Takes 800 milliseconds" rows, named "div · 2 inside", "2", "0", "↑".
 *
 * Held here, on a captured page built the same way: 180 parts revealed on
 * scroll at 800 milliseconds across three sections (each headed), under the
 * capture's own labels ("div · 2 inside", "::after · 0 inside") with words
 * like "0", "2" and "↑", plus two spinning parts:
 *
 *   · each kind is one folded line first: "Reveal on scroll", "180 parts",
 *     "800 milliseconds", and no part is listed until it is opened;
 *   · the line changes all of them at once, each as one undo step: turn all
 *     off (the export then ships no reveal), turn all on, the speed for all;
 *     undo puts all of them back;
 *   · opened, parts set alike are one bunch per section ("Reveal on scroll
 *     in “Roadmap”", 60 parts), which opens to the parts and changes its own
 *     60 and no others;
 *   · every name shown is the side panel's readable one: none is the
 *     capture's machinery ("div · 2 inside") and none is a bare "0" or "↑".
 *
 *   node tests/motion-fold.mjs [url]
 */
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
mkdirSync(".screenshots", { recursive: true });
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
const SECTIONS = ["Meet Trumpmorty", "Tokenomics", "Roadmap"];
const nodes = [];
SECTIONS.forEach((title, s) => {
  const top = s * 1200;
  nodes.push(node(`sec${s}`, `section · 61 inside`, 0, top, 1440, 1150));
  nodes.push(node(`head${s}`, "h2 · 0 inside", 100, top + 20, 800, 60, { content: title, font: { size: 40 } }));
  for (let i = 0; i < 60; i++) {
    const words = ["0", "2", "↑", "", "Buy now"][i % 5];
    nodes.push(node(`r${s}_${i}`, i % 2 ? "div · 2 inside" : "::after · 0 inside", 100 + (i % 10) * 120, top + 120 + Math.floor(i / 10) * 160, 100, 100, {
      content: words,
      work: { id: "reveal", inputs: { duration: "800" } },
    }));
  }
});
nodes.push(node("spin1", "div · 1 inside", 1300, 40, 80, 80, { content: "★", work: { id: "spin", inputs: { period: "20" } } }));
nodes.push(node("spin2", "Sun", 1300, 1240, 80, 80, { work: { id: "spin", inputs: { period: "12" } } }));
const doc = {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], format: {}, brief: { name: "FOLD", gimmick: "", master: "" }, motion: [],
  frameWidth: 1440, activePageId: "page_home", trail: [], swept: 999,
};

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false }, configured: false, source: null }) }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate((d) => { localStorage.clear(); localStorage.setItem("builder.studio", JSON.stringify({ state: d, version: 0 })); }, doc);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const wait = (ms) => page.waitForTimeout(ms);
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const reveals = async () => (await saved()).nodes.filter((n) => n.work?.id === "reveal");
const depth = () => page.evaluate(() => window.__studioUndoDepth?.() ?? -1);
const panel = page.locator("[data-motion-panel]");
await page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Motion" }).first().click();
await wait(800);

/* ------------------------------------------------------------ folded first */
const reveal = panel.locator('[data-move-kind="reveal"]');
const line = reveal.locator("[data-move-fold=kind]").first();
const lineText = (await line.innerText()).replace(/\s+/g, " ");
check("Reveal on scroll is one folded line: its name, 180 parts, 800 milliseconds", /Reveal on scroll/.test(lineText) && /180 parts/.test(lineText) && /800 milliseconds/.test(lineText), lineText);
check("…and no part is listed until it is opened", (await panel.locator("[data-move-row], [data-move-bunch]").count()) === 0, `${await panel.locator("[data-move-row], [data-move-bunch]").count()} shown`);
check("the spins are their own folded line", /2 parts/.test(await panel.locator('[data-move-kind="loop"] [data-move-fold=kind]').innerText()));
await page.screenshot({ path: ".screenshots/motion-fold.png" });

/* ------------------------------------------------------------ all at once, one step each */
let d0 = await depth();
await line.locator("button[aria-pressed]").first().click();
await wait(500);
let r = await reveals();
check("turn all off switches off all 180 reveals", r.length === 180 && r.every((n) => n.work.off === true), `${r.filter((n) => n.work.off).length} of ${r.length} off`);
check("…as one undo step", (await depth()) === d0 + 1, `${d0} → ${await depth()}`);
check("…and the line says so", /all turned off/.test(await line.innerText()));
const files = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: typeof f.content === "string" ? f.content : "" })));
const home = files.find((f) => f.path === "index.html")?.content ?? "";
check("…and the export ships no reveal", !/"feature":\s*"reveal"/.test(home) && /"feature":\s*"spin"/.test(home));
await page.locator("body").click({ position: { x: 5, y: 500 } }).catch(() => {});
await page.keyboard.press("Control+z");
await wait(600);
r = await reveals();
check("one undo turns all 180 back on", r.every((n) => !n.work.off), `${r.filter((n) => n.work.off).length} still off`);

d0 = await depth();
const all = line.locator("xpath=..").locator("[data-move-speed-all] [role=slider]").first();
await all.focus();
await page.keyboard.press("ArrowRight");
await wait(600);
r = await reveals();
check("the speed for all sets every one: 850 milliseconds", r.every((n) => n.work.inputs.duration === "850"), [...new Set(r.map((n) => n.work.inputs.duration))].join(", "));
check("…as one undo step", (await depth()) === d0 + 1, `${d0} → ${await depth()}`);
check("…and the line reads it out", /850 milliseconds/.test(await line.innerText()), (await line.innerText()).replace(/\s+/g, " "));

/* ------------------------------------------------------------ opened: bunches by section */
await line.locator("[data-move-open]").click();
await wait(500);
const bunchTitles = await reveal.locator("[data-move-bunch] [data-move-title]").allInnerTexts();
check("opened, the parts set alike are one bunch per section", bunchTitles.length === 3 && SECTIONS.every((t) => bunchTitles.some((b) => b.includes(`“${t}”`))), bunchTitles.join(" | "));
const roadmap = reveal.locator("[data-move-bunch]").filter({ hasText: "Roadmap" }).first();
check("…each of 60 parts", /60 parts/.test(await roadmap.innerText()));
d0 = await depth();
await roadmap.locator("[data-move-fold] button[aria-pressed]").first().click();
await wait(500);
r = await reveals();
const offIn = r.filter((n) => n.work.off).map((n) => n.id.slice(0, 2));
check("turning a bunch off turns off its 60, and no others", offIn.length === 60 && offIn.every((p) => p === "r2"), `${offIn.length} off`);
check("…as one undo step", (await depth()) === d0 + 1);
await roadmap.locator("[data-move-open]").first().click();
await wait(500);
const rowsShown = await roadmap.locator("[data-move-row]").count();
check("a bunch opens to its parts, drawn only where they are seen", rowsShown > 0 && rowsShown < 60, `${rowsShown} drawn of 60`);

/* ------------------------------------------------------------ readable names only */
const shownNames = await panel.locator("[data-move-go] span:first-child, [data-move-title]").allInnerTexts();
const machine = shownNames.filter((t) => /·\s*\d+\s+inside/.test(t) || /^::?[a-z-]+$/.test(t.trim()) || !/\p{L}/u.test(t));
check("no name is the capture's machinery or a bare number or arrow", shownNames.length > 10 && machine.length === 0, machine.slice(0, 5).join(" | ") || `${shownNames.length} names, e.g. ${shownNames.slice(-4).join(" | ")}`);
check("a part whose words are only “0” is named as words, in its section", shownNames.some((t) => /“0” in “Roadmap”/.test(t)), shownNames.filter((t) => /“0”/.test(t)).slice(0, 2).join(" | "));
await page.screenshot({ path: ".screenshots/motion-fold-open.png" });

check("no page error", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
