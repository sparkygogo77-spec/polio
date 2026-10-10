#!/usr/bin/env node
/**
 * "PICK A PART TO PUT IT ON" LOWERS THE SHELF, AND THE RING STAYS ABOVE IT.
 *
 * J (2026-10-10): "clicked 'pick part to put it on' for smooth scrolling and
 * not only does the shelf not drop but the selector bleeds through it". On
 * the saved PST board, at 1440:
 *
 *   1. Smooth scrolling's "Links glide to their place", "Pick a part to put
 *      it on": the shelf lowers to its strip and the board takes the room;
 *   2. a part that runs on past the board's foot has its ring cut at the
 *      shelf, so none of it draws over the shelf;
 *   3. Esc stops the pick and the shelf comes back up as it was.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/shelf-pick-lowers.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/cardCarry.ts, src/features/studio/ShelfCards.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard, readBoard } from "./lib/board.mjs";

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
await ui.route("https://api.github.com/**", (r) => r.abort());

const saved = readBoard("pst");
saved.local["builder.shelf.folded"] = "0";
await openBoard(ui, URL_BASE, saved);
const wait = (ms) => ui.waitForTimeout(ms);
const band = () => ui.evaluate(() => {
  const b = document.querySelector("[data-band-lowered], [data-band-reach]");
  const r = b.getBoundingClientRect();
  return { lowered: b.hasAttribute("data-band-lowered"), h: Math.round(r.height), top: r.top };
});

/* 1. */
if (!(await ui.locator('[data-category-open="motion"]').count())) await ui.locator('[data-category="motion"]').first().click();
await wait(1000);
const up = await band();
const card = ui.locator('[data-shelf-card="smooth-scroll"]').first();
await card.scrollIntoViewIfNeeded();
const at = await ui.evaluate(() => {
  const c = document.querySelector('[data-shelf-card="smooth-scroll"]');
  const r = c.getBoundingClientRect();
  for (let y = r.top + 8; y < Math.min(r.bottom, innerHeight) - 4; y += 8) {
    const e = document.elementFromPoint(r.left + r.width / 2, y);
    if (e && c.contains(e) && !e.closest("[role=switch],a,input,label")) return { x: r.left + r.width / 2, y };
  }
  return null;
});
check("Smooth scrolling is on the shelf", !!at);
await ui.mouse.click(at.x, at.y);
await wait(600);
await ui.locator("[data-part-detail]").getByRole("button", { name: "Links glide to their place" }).first().click();
await wait(300);
const put = ui.locator("[data-part-detail] [data-add-to-page]");
check("with nothing picked, the button says to pick a part", /Pick a part/.test(await put.innerText()));
await put.click();
await wait(500);
const low = await band();
check("1. pressed, the pick is armed", (await ui.locator("[data-put-on-armed]").count()) === 1);
check("…and the shelf lowers to its strip", low.lowered && low.h <= 32 && up.h > 100, `band ${up.h}px -> ${low.h}px`);

/* 2. A part that runs on under the shelf: any point in view whose own part does. */
const part = await ui.evaluate((foot) => {
  const pane = document.querySelector("[data-studio-pane]").getBoundingClientRect();
  for (const el of document.querySelectorAll("[data-node-id]")) {
    const r = el.getBoundingClientRect();
    if (r.bottom < foot + 20 || r.top > foot - 40 || r.width < 60) continue;
    for (let y = foot - 20; y > Math.max(r.top, pane.top) + 4; y -= 12) {
      for (const x of [r.left + 10, r.left + r.width / 2, r.right - 10]) {
        if (document.elementFromPoint(x, y)?.closest("[data-node-id]") === el) return { x, y, h: Math.round(r.height) };
      }
    }
  }
  return null;
}, low.top);
check("a part runs on past the board's foot", !!part, JSON.stringify(part));
if (part) {
  await ui.mouse.move(part.x, part.y);
  await wait(250);
  const seen = await ui.evaluate(() => {
    const r = document.querySelector("[data-carry-ring]");
    const b = r.getBoundingClientRect();
    /* inset(top right bottom left), which the browser may shorten as CSS does. */
    const v = (/inset\(([^)]*)\)/.exec(r.style.clipPath)?.[1] ?? "0px").split(/\s+/).map(parseFloat);
    const cutBottom = v.length >= 3 ? v[2] : v[0];
    return { shown: r.style.display === "block", bottom: b.bottom - cutBottom, ringBottom: b.bottom };
  });
  check("2. the ring shows on the part", seen.shown);
  check("…and is cut at the shelf, not drawn over it", seen.ringBottom > low.top && seen.bottom <= low.top + 1, `ring to ${Math.round(seen.ringBottom)}, shown to ${Math.round(seen.bottom)}, shelf at ${Math.round(low.top)}`);
}

/* 3. */
await ui.keyboard.press("Escape");
await wait(500);
const back = await band();
check("3. Esc stops the pick", (await ui.locator("[data-put-on-armed]").count()) === 0 && (await ui.locator("[data-carry-ring]").count()) === 0);
check("…and the shelf comes back up as it was", !back.lowered && Math.abs(back.h - up.h) <= 1, `${back.h}px, was ${up.h}px`);
check("no page errors", errors.length === 0, errors.join(" | "));

await browser.close();
const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
