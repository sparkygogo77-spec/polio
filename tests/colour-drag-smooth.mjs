#!/usr/bin/env node
/**
 * DRAGGING THROUGH A COLOUR ON THE PONSSTARS BOARD STAYS SMOOTH.
 *
 * J (2026-10-09): "Colour picker lags while dragging". Every move of the hand
 * in the picker swapped the colour on every part that wore it, took an undo
 * checkpoint, saved the whole document and had the Colours panel count the
 * site again. Now (`board/store/gesture.ts`) the board takes the colour at
 * most once a frame, nothing is saved and the side panel stands still until
 * the picker is closed; then one save, and the whole drag is one undo step.
 *
 * PST is opened from its saved board (tests/fixtures/boards/pst.json.gz).
 * The biggest surface in Colours is opened and its Fill picker is driven
 * across the whole spectrum, faster than frames come (the browser's own
 * picker sends one `input` a move and one `change` when it closes).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/colour-drag-smooth.mjs http://127.0.0.1:3013
 *
 * Also: only the swatch opens the picker, and the code box is as wide as its code.
 *
 * Covers: src/features/studio/board/store/gesture.ts, src/features/studio/HandSlider.tsx, src/features/studio/SiteColours.tsx, src/features/studio/board/store/create.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.addInitScript(() => {
  window.__writes = 0;
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (this === window.localStorage && k === "builder.studio") { window.__writes++; if (String(v).startsWith('{"state"')) window.__docs = (window.__docs ?? 0) + 1; } return set.call(this, k, v); };
  /* PST's board is too big for localStorage whole: the document goes to IndexedDB, and localStorage keeps a pointer that a save may leave as it was (docStore.ts). */
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (v, k) { if (this.transaction.db.name === "builder.docs" && k === "builder.studio") { window.__writes++; window.__docs = (window.__docs ?? 0) + 1; } return put.call(this, v, k); };
});
/* PST from the saved board (tests/lib/board.mjs): no import. */
const st = await openBoard(ui, URL_BASE, "pst");
await ui.waitForTimeout(1000);
check("PST came in", st.nodes.length > 20, `${st.nodes.length} parts on ${st.pages?.length} pages`);


/* ------------------------------------------------- the Colours panel */
await ui.evaluate(() => window.__studioSetLeftPanel?.("look"));
await ui.waitForTimeout(1500);
const kinds = await ui.evaluate(() => [...document.querySelectorAll('[data-theme-preview] [data-preview-part="surface"]')].map((e) => ({ kind: e.dataset.previewKind, parts: Number(e.querySelector("[data-preview-count]")?.textContent ?? 0) })));
const big = kinds.sort((a, b) => b.parts - a.parts)[0];
check("the Colours preview lists PST's surfaces, each with its count", kinds.length > 0 && !!big && big.parts > 0, kinds.map((k) => k.parts).join(" | "));

/* The count is just a number on the corner: no box behind it, an outline so it reads anywhere. */
const badge = await ui.evaluate(() => { const e = document.querySelector("[data-theme-preview] [data-preview-count]"); const s = getComputedStyle(e); return { bg: s.backgroundColor, shadow: s.textShadow, pad: s.paddingTop }; });
check("a count has no box behind it", /rgba\(0, 0, 0, 0\)|transparent/.test(badge.bg) && badge.pad === "0px", JSON.stringify(badge));
check("…and an outline so it reads on light and dark", badge.shadow !== "none" && badge.shadow.length > 0, badge.shadow);

await ui.locator(`[data-theme-preview] [data-preview-part="surface"][data-preview-kind="${big.kind}"]`).first().evaluate((e) => e.click());
await ui.waitForTimeout(800);
const picker = ui.locator('[data-kind-editor] [data-kind-colour="fill"] input[type="color"]').first();
check("its editor opens with a Fill picker", (await picker.count()) === 1);
await picker.evaluate((e) => { e.dataset.underHand = "1"; window.__pickerClicks = 0; e.addEventListener("click", () => window.__pickerClicks++); });

/* Only the swatch opens the picker: a press on the name or beside it does not (J, 2026-10-09). */
const row = ui.locator('[data-kind-editor] [data-kind-colour="fill"]').first();
const rb = await row.boundingBox();
await row.locator("span").first().click();
await ui.mouse.click(rb.x + rb.width * 0.6, rb.y + rb.height - 2);
check("pressing the colour's name or the space beside it does not open the picker", (await ui.evaluate(() => window.__pickerClicks)) === 0, `${await ui.evaluate(() => window.__pickerClicks)} opens`);
await ui.keyboard.press("Escape");
const hexBox = await row.locator('input[aria-label$="as hex"]').evaluate((e) => ({ box: e.parentElement.getBoundingClientRect().width, fits: e.scrollWidth <= e.clientWidth, text: e.value }));
check("the colour code box is as wide as its code", hexBox.fits && hexBox.box < 96, `${Math.round(hexBox.box)}px for ${hexBox.text}`);

const before = await ui.evaluate(() => ({ nodes: JSON.stringify(window.__studioNodes()), undo: window.__studioUndoDepth() }));
await ui.evaluate(() => {
  window.__writes = 0;
  window.__docs = 0;
  window.__outside = [];
  const pane = document.querySelector("[data-studio-pane]");
  /* Left out: Undo and Redo, which the drag's one checkpoint turns on when the board was opened with no history; and the save line's
     time, which is the last edit's (an import had just set it to this minute; a saved board's is the minute it was saved). */
  window.__watch = new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (!el || (pane && pane.contains(el)) || el.closest?.("[data-studio-pane]") || el.dataset?.underHand || el.closest?.("[data-history-tip]") || el.closest?.('[aria-label^="Undo"], [aria-label^="Redo"], [data-save-line]')) continue;
      window.__outside.push(`${el.getAttribute("aria-label") ?? ""} ${m.attributeName ?? m.type} ${el.outerHTML.slice(0, 300)}`);
    }
  });
  window.__watch.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
});

/* Across the spectrum: 180 colours, one every 4ms, faster than frames come. */
const run = await ui.evaluate(() => new Promise((done) => {
  const el = document.querySelector('[data-under-hand="1"]');
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  const hex = (h) => { const f = (n) => { const k = (n + h / 30) % 12; const v = 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * v).toString(16).padStart(2, "0"); }; return `#${f(0)}${f(8)}${f(4)}`; };
  const gaps = [];
  let last = performance.now(), on = true, script = 0;
  const tick = () => { const t = performance.now(); gaps.push(t - last); last = t; if (on) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  let i = 0;
  const step = () => {
    const t0 = performance.now();
    setValue.call(el, hex(i * 2));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    script += performance.now() - t0;
    if (++i < 180) setTimeout(step, 4);
    else setTimeout(() => { on = false; done({ gaps, script, last: hex((i - 1) * 2) }); }, 200);
  };
  step();
}));
const during = await ui.evaluate(() => ({ writes: window.__writes, outside: window.__outside.length, first: window.__outside[0] ?? "", nodes: JSON.stringify(window.__studioNodes()), undo: window.__studioUndoDepth() }));
const slow = run.gaps.filter((g) => g > 50).length;
const worst = Math.round(Math.max(...run.gaps));
check("the board takes the colour while the hand is in the picker", during.nodes !== before.nodes && during.nodes.toLowerCase().includes(run.last.toLowerCase()), `last colour ${run.last}`);
check("dragging across the spectrum stays smooth", slow <= 3 && worst < 250, `${run.gaps.length} frames, ${slow} over 50ms, worst ${worst}ms; ${Math.round(run.script)}ms of script for 180 moves`);
check("nothing is saved while the hand is in the picker", during.writes === 0, `${during.writes} writes of the document over 180 moves`);
check("the side panel stands still while the hand is in the picker", during.outside === 0, `${during.outside} changes${during.first ? `, first: ${during.first}` : ""}`);

/* Letting go: the picker closes. */
await ui.evaluate(() => document.querySelector('[data-under-hand="1"]').dispatchEvent(new Event("change", { bubbles: true })));
await ui.waitForTimeout(1200);
const after = await ui.evaluate(() => ({ writes: window.__writes, docs: window.__docs, outside: window.__outside.length, undo: window.__studioUndoDepth(), nodes: JSON.stringify(window.__studioNodes()) }));
/* One save is the document beside IndexedDB, then the pointer to it once it has landed there (docStore.ts). */
check("letting go saves once", after.docs === 1, `${after.docs} saves of the document (${after.writes} writes)`);
check("…and the side panel catches up", after.outside > 0, `${after.outside} changes`);
check("the whole drag is exactly one undo step", after.undo === before.undo + 1, `${before.undo} -> ${after.undo}`);
await ui.evaluate(() => window.__watch.disconnect());
await ui.keyboard.press("Escape");
await ui.evaluate(() => document.activeElement?.blur?.());
await ui.keyboard.press("Control+z");
await ui.waitForTimeout(800);
const undone = await ui.evaluate(() => JSON.stringify(window.__studioNodes()));
/* Read as data: the same parts, whatever order their fields were written in. A picture is
   kept beside the document and comes back with any undo, so it is not compared here. */
const same = (x, y) => { const sort = (v) => (Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).filter((k) => k !== "picture").sort().map((k) => [k, sort(v[k])])) : v); return JSON.stringify(sort(JSON.parse(x))) === JSON.stringify(sort(JSON.parse(y))); };
check("one Undo puts every part back as it was before the drag", same(undone, before.nodes), same(undone, before.nodes) ? "" : `parts differ; undo depth ${await ui.evaluate(() => window.__studioUndoDepth())}`);

/* ------------------------------------- a slider in the side panel: the same */
const thumb = ui.locator('[data-kind-corners] [role="slider"]').first();
if (await thumb.count()) {
  await thumb.scrollIntoViewIfNeeded();
  const tb = await thumb.boundingBox();
  const u0 = await ui.evaluate(() => { window.__writes = 0; return window.__studioUndoDepth(); });
  await ui.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await ui.mouse.down();
  /* Toward whichever end has room: a kind with a small copy has a short Corners slider. */
  const dir = await thumb.evaluate((e) => (Number(e.getAttribute("aria-valuenow")) > Number(e.getAttribute("aria-valuemin")) ? -1 : 1));
  for (let i = 1; i <= 25; i++) await ui.mouse.move(tb.x + tb.width / 2 + dir * i * 6, tb.y + tb.height / 2);
  await ui.waitForTimeout(200);
  const mid = await ui.evaluate(() => ({ writes: window.__writes, now: document.querySelector('[data-kind-corners] [role="slider"]').getAttribute("aria-valuenow") }));
  await ui.mouse.up();
  await ui.waitForTimeout(1000);
  const end = await ui.evaluate(() => ({ writes: window.__writes, undo: window.__studioUndoDepth() }));
  check("a side-panel slider follows the hand with nothing saved until it is let go", mid.writes === 0 && end.writes >= 1, `${mid.writes} writes while held (thumb at ${mid.now}), ${end.writes} after`);
  check("…and the slide is one undo step", end.undo === u0 + 1, `${u0} -> ${end.undo}`);
} else check("the surface's editor shows its Corners slider", false);

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
