#!/usr/bin/env node
/**
 * PLACE THE LIGHT ON PST: ONE PRESS, ONLY REAL PARTS CAST, IN THEIR OWN SHAPE.
 *
 * J (2026-10-10), placing the light on PonsStars from the Look tab:
 *   - its glow bled through the shelf under the board as soon as it was picked;
 *   - it took several presses on the page before one placed it;
 *   - once placed, every line of words had its own shadow, and the round
 *     buttons' shadows were square boxes.
 *
 *   1. picking the light rings the page only above the shelf;
 *   2. pressing a part on the page (not the bare page) places the light;
 *   3. lines of words cast nothing, a button's shadow is round, a field's
 *      follows its corner;
 *   4. pressing the button and dragging onto the page places it too.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/light-cast.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/LightPlacer.tsx, src/features/studio/lightCast.ts, src/features/studio/lightRig.ts, src/features/studio/board/NodeView.tsx, src/features/studio/look/LookPanel.tsx
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
await ui.route("https://api.github.com/**", (r) => r.abort());
await openBoard(ui, URL_BASE, "pst");
await ui.waitForTimeout(1500);
/* Unplace it first, so the press below is what turns it on. */
await ui.locator("button", { hasText: /^Look$/ }).first().click();
await ui.waitForTimeout(400);

/* What the Look tab's button says: "On the page at 70%, 12%", or off. */
const light = () => ui.evaluate(() => {
  const m = /On the page at (\d+)%, (\d+)%/.exec(document.querySelector("[data-place-light]")?.textContent ?? "");
  return m ? { on: true, x: Number(m[1]) / 100, y: Number(m[2]) / 100 } : null;
});
const nodeBy = (words, feature) => ui.evaluate(([w, f]) => {
  const n = (window.__studioNodes?.() ?? []).find((x) => x.featureId === f && JSON.stringify(x.content ?? "").includes(w));
  return n?.id ?? null;
}, [words, feature]);
const shadowOf = (id) => ui.evaluate((i) => {
  const el = document.querySelector(`[data-node-id="${CSS.escape(i)}"] > [data-mode]`);
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { shadow: cs.boxShadow, radius: cs.borderTopLeftRadius, h: el.getBoundingClientRect().height };
}, id);

/* Open Look and pick the light up with a plain press. */
await ui.locator("button", { hasText: /^Look$/ }).first().click();
await ui.waitForTimeout(500);
const place = ui.locator("[data-place-light]").first();
await place.scrollIntoViewIfNeeded();
await place.click();
await ui.waitForTimeout(500);

/* 1. */
const ring = await ui.evaluate(() => {
  const dim = document.querySelector("[data-light-dim] > div")?.getBoundingClientRect();
  const shelf = document.querySelector("[data-studio-scroll] [data-drawer]")?.getBoundingClientRect();
  return dim && shelf ? { bottom: Math.round(dim.bottom), shelf: Math.round(shelf.top) } : null;
});
check("1. the page's ring stops at the shelf", !!ring && ring.bottom <= ring.shelf + 1, JSON.stringify(ring));

/* 2. Press a button on the page, as J did: a part, not the bare page. */
const btn = await nodeBy("Forget test wallet", "cta-primary");
const box = await ui.locator(`[data-node-id="${btn}"]`).first().boundingBox();
await ui.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await ui.waitForTimeout(700);
const lit = await light();
check("2. one press on a part places the light", !!lit?.on && (await ui.locator("[data-light-dim]").count()) === 0, lit ? `${Math.round(lit.x * 100)}%, ${Math.round(lit.y * 100)}%` : "no light");

/* 3. */
const words = await nodeBy("Signed in", "prose");
const field = (await ui.evaluate(() => (window.__studioNodes?.() ?? []).find((x) => x.featureId === "field" && x.radius > 0)?.id)) ?? null;
const [w, b, f] = [await shadowOf(words), await shadowOf(btn), await shadowOf(field)];
check("3. a line of words casts no shadow", w?.shadow === "none", w?.shadow);
check("…a button casts one, round like the button", !!b && b.shadow !== "none" && parseFloat(b.radius) >= b.h / 2 - 1, b && `${b.radius} on ${Math.round(b.h)}px`);
check("…a field casts one with its own corner", !!f && f.shadow !== "none" && parseFloat(f.radius) > 0, f && f.radius);

/* 4. Press the button and drag onto the page. */
await place.scrollIntoViewIfNeeded();
const pb = await place.boundingBox();
const frame = await ui.evaluate(() => { const r = document.querySelector("[data-frame]").getBoundingClientRect(); const s = document.querySelector("[data-studio-scroll]").getBoundingClientRect(); return { x: r.x, y: Math.max(r.y, s.y), w: r.width }; });
const to = { x: frame.x + frame.w * 0.7, y: frame.y + 120 };
await ui.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
await ui.mouse.down();
await ui.mouse.move(to.x, to.y, { steps: 12 });
await ui.mouse.up();
await ui.waitForTimeout(700);
const dragged = await light();
check("4. press, drag and let go on the page places it there", !!dragged?.on && Math.abs(dragged.x - 0.7) < 0.03 && (await ui.locator("[data-light-dim]").count()) === 0, dragged && `${Math.round(dragged.x * 100)}%`);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
