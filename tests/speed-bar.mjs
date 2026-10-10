#!/usr/bin/env node
/**
 * SPIN AND FLOAT GET A SPEED BAR; AN ICON IS PICKED WHOLE; FLOAT GLIDES.
 *
 * J (2026-10-10): "for spin once i select a part to put it on a small bar
 * should come up ... right under where i select ... a bar that shows me how
 * fast it will spin until i let go of the bar and it disappears", "i couldnt
 * choose the TV icon to the left of Ponsstars test page heading, float didnt
 * work on it either", and float "is slightly framey and should be smooth".
 *
 *   1. a press on PST's TV icon picks the icon, not the empty shape laid over it;
 *   2. Spin on the icon turns it on the board, and its shape turns with it;
 *   3. a speed bar sits right under the icon;
 *   4. dragging it speeds the turn up live, with nothing saved yet;
 *   5. let go, the speed is saved on the part and the bar is gone;
 *   6. Float runs on the compositor (replaces, not adds), so it glides.
 *
 *   npx next dev -p 3013   (or npm run build && npx next start -p 3013)
 *   node tests/speed-bar.mjs http://localhost:3013
 *
 * Covers: src/features/studio/speedBar.ts, src/features/studio/owner.ts, src/features/studio/cardCarry.ts, src/features/studio/live/runWorks.ts, src/features/studio/shelf/library/behaviourScripts/effects.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());
await openBoard(ui, URL_BASE, "pst");

const ids = await ui.evaluate(() => {
  const ns = window.__studioNodes();
  const by = (h) => ns.find((n) => n.pageId === "page_home" && n.hooks?.["data-hook"] === h)?.id;
  return { icon: by("page-title-icon"), shape: by("page-title-icon-shape") };
});
const boxOf = (id) => ui.evaluate((id) => { const r = document.querySelector(`[data-node-id="${id}"]`).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, id);

/* 1. */
const ib = await boxOf(ids.icon);
await ui.mouse.click(ib.x + ib.w / 2, ib.y + ib.h / 2);
await ui.waitForTimeout(200);
const sel = await ui.evaluate(() => window.__studioSelection());
check("1. a press on the TV icon picks the icon", sel.length === 1 && sel[0] === ids.icon, `${JSON.stringify(sel)} (icon ${ids.icon}, shape ${ids.shape})`);
await ui.keyboard.press("Escape");

/* 2. */
await ui.evaluate((id) => window.__studioGiveWork(id, "spin"), ids.icon);
await ui.waitForTimeout(700);
const turning = (id) => ui.evaluate((id) => {
  const rate = (el) => (el?.getAnimations() ?? []).filter((a) => a.effect.getKeyframes().some((k) => "rotate" in k)).map((a) => a.playbackRate);
  return { icon: rate(document.querySelector(`[data-node-id="${id}"] > [data-part-drawn]`)), riders: [...document.querySelectorAll(`[data-board-moves-of="${id}"]`)].map(rate) };
}, id);
const t0 = await turning(ids.icon);
check("2. Spin turns the icon on the board, its shape with it", t0.icon.length === 1 && t0.riders.length >= 1 && t0.riders.every((r) => r.length === 1), JSON.stringify(t0));

/* 3. */
const bar = await ui.evaluate(() => { const b = document.querySelector("[data-speed-bar]"); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, words: b.textContent }; });
const ib2 = await boxOf(ids.icon);
check("3. a speed bar sits right under the icon", !!bar && bar.y >= ib2.y + ib2.h && bar.y - (ib2.y + ib2.h) < 30 && bar.x <= ib2.x + ib2.w && bar.x + bar.w >= ib2.x, JSON.stringify({ bar, icon: ib2 }));
check("…saying how long a turn takes", /One turn takes 20 seconds/.test(bar?.words ?? ""), bar?.words);

/* 4. */
const knob = await ui.evaluate(() => { const r = document.querySelector("[data-speed-bar] [data-speed-knob]").parentElement.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
await ui.mouse.move(knob.x + knob.w * 0.3, knob.y);
await ui.mouse.down();
await ui.mouse.move(knob.x + knob.w * 0.9, knob.y, { steps: 6 });
await ui.waitForTimeout(100);
const mid = await turning(ids.icon);
const saved0 = await ui.evaluate((id) => window.__studioNodes().find((n) => n.id === id).work, ids.icon);
const fast = mid.icon[0] > 5 && mid.riders.every((r) => r[0] === mid.icon[0]);
check("4. dragging the bar speeds the turn up live, the shape too", fast, JSON.stringify(mid));
check("…with nothing saved while the hand is down", JSON.stringify(saved0).includes('"inputs":{}'), JSON.stringify(saved0));

/* 5. */
await ui.mouse.up();
await ui.waitForTimeout(500);
const after = await ui.evaluate((id) => ({ work: window.__studioNodes().find((n) => n.id === id).work, bar: !!document.querySelector("[data-speed-bar]") }), ids.icon);
const period = Number(JSON.stringify(after.work).match(/"period":"([\d.]+)"/)?.[1]);
check("5. let go, the speed is saved on the part and the bar is gone", !after.bar && period > 0 && period < 4, JSON.stringify(after));

/* 6. */
await ui.evaluate((id) => window.__studioGiveWork(id, "float"), ids.icon);
await ui.waitForTimeout(700);
const fl = await ui.evaluate((id) => (document.querySelector(`[data-node-id="${id}"] > [data-part-drawn]`)?.getAnimations() ?? []).filter((a) => a.effect.getKeyframes().some((k) => "translate" in k)).map((a) => a.effect.composite), ids.icon);
check("6. Float replaces rather than adds, so the compositor glides it", fl.length === 1 && fl[0] === "replace", JSON.stringify(fl));
check("…and the page threw nothing", errors.length === 0, errors.join(" | "));

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
