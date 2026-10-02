/**
 * TYPING INTO A PART KEEPS ITS INK, AND A ONE-LINE BOX GROWS TO HOLD ITS WORDS.
 *
 * His case, exactly: he added a single space to "A SolWorks project" in the
 * Contents panel and had to drag the box wider by hand; and "Works", which
 * the page draws in white, came back green. Both are the same write: the
 * editor shows the words as one plain string and wrote that string back over
 * the part's runs, so every stretch took the part's own ink, and nothing
 * asked whether the new words still fit.
 *
 * So: the edit lands in the runs (the stretches either side keep theirs),
 * and a part one line tall whose words no longer fit its box on that line
 * grows wide enough to hold them. Grow only, never shrink, only the part
 * being edited; nothing imported moves.
 *
 * Driven the way he does it: a right press on the wordmark, Write, Contents,
 * the caret after "A Sol", one space typed. Every expected figure is read off
 * the board before the edit.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/edit-widen.mjs http://127.0.0.1:3013 [path to sink site/document.json]
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const DOC = process.argv[3] ?? "capture/versions/sink-0ee06fa/site/document.json";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const doc = JSON.parse(readFileSync(DOC, "utf8"));
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify({ state: { ...d, activePageId: "page_home" }, version: 0 })), doc);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(4000);

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state);
const words = (c) => (typeof c === "string" ? c : (c ?? []).map((s) => s.text ?? "").join(""));
const before = await state();
/* The header wordmark, as the sentence rejoin keeps it: one part, three runs. */
const mark = before.nodes.find((n) => n.pageId === "page_home" && Array.isArray(n.content) && words(n.content) === "A SolWorks project" && (n.from?.selector ?? "").startsWith("body > div > header"));
check("the board holds his header wordmark as one part of runs", !!mark, mark ? `${mark.id}: ${JSON.stringify(mark.content.map((s) => [s.text, s.colour ?? "(the part's)"]))}` : "not found");
if (!mark) { await browser.close(); process.exit(1); }
const inkOf = (content, text) => content.find((s) => s.text.includes(text))?.colour ?? null;
const worksInk = inkOf(mark.content, "Works");
check("…and \"Works\" carries an ink of its own, not the part's", !!worksInk && worksInk !== mark.colour?.text, `Works ${worksInk}, the part ${mark.colour?.text}`);

const lines = () => page.evaluate((id) => {
  const s = document.querySelector(`[data-node-id="${id}"] [data-part]`); const tops = new Set();
  const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) { if (!t.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(t); for (const q of rg.getClientRects()) if (q.width) tops.add(Math.round(q.top / 2)); }
  return tops.size;
}, mark.id);
check("before the edit it draws on one line", (await lines()) === 1);

/* His way in: a right press on the part, Write, Contents. */
const box = await page.locator(`[data-node-id="${mark.id}"]`).boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
await page.waitForTimeout(650);
await page.locator('[data-radial] [data-shard="write"]').first().click({ force: true });
await page.waitForTimeout(500);
/* Write leads with one box (Say it) now; Contents is one press away under More (RadialMenu.tsx, `writeMore`). */
if (!(await page.locator('[data-radial] [data-shard="contents"]').count())) {
  await page.locator('[data-radial] [data-shard="more"]').first().click({ force: true });
  await page.waitForTimeout(500);
}
await page.locator('[data-radial] [data-shard="contents"]').first().click({ force: true });
await page.waitForTimeout(600);
const field = page.locator("textarea").filter({ hasText: "" }).last();
const value = await field.inputValue().catch(() => null);
check("the Contents panel opens on his words", value === words(mark.content), JSON.stringify(value));
await field.evaluate((el) => { el.focus(); el.setSelectionRange(5, 5); });
await page.keyboard.type(" ");
await page.waitForTimeout(1500);
await page.keyboard.press("Escape"); await page.waitForTimeout(200); await page.keyboard.press("Escape");
await page.waitForTimeout(1500);

const after = await state();
const now = after.nodes.find((n) => n.id === mark.id);
check("his words now read with the space he typed", words(now.content) === "A Sol Works project", JSON.stringify(words(now.content)));
check("\"Works\" keeps its own ink", Array.isArray(now.content) && inkOf(now.content, "Works") === worksInk,
  Array.isArray(now.content) ? `Works ${inkOf(now.content, "Works")}` : `content is a plain string now: ${JSON.stringify(now.content)}`);
check("…and every run keeps the ink it had", Array.isArray(now.content) && mark.content.every((s) => inkOf(now.content, s.text.trim()) === (s.colour ?? null)));
check("the box grew wider on its own, and nothing else about it changed", now.w > mark.w && now.x === mark.x && now.y === mark.y && now.h === mark.h,
  `w ${mark.w} → ${now.w}, x ${now.x}, y ${now.y}, h ${mark.h} → ${now.h}`);
check("…wide enough that the words draw on one line", (await lines()) === 1, `${await lines()} lines`);
const others = before.nodes.filter((n) => n.id !== mark.id);
const moved = others.filter((n) => { const m = after.nodes.find((x) => x.id === n.id); return !m || m.x !== n.x || m.y !== n.y || m.w !== n.w || m.h !== n.h || JSON.stringify(m.content) !== JSON.stringify(n.content); });
check("no other part moved, resized or changed its words", moved.length === 0, moved.slice(0, 3).map((n) => n.id).join(", "));
check("with no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
