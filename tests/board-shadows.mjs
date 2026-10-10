#!/usr/bin/env node
/**
 * A PART'S SHADOW IS DRAWN WHOLE ON THE BOARD, AS THE SITE DRAWS IT.
 *
 * J (2026-10-10): PonsStars' panels and yellow buttons wear a hard offset
 * ink shadow (`6px 6px 0` on a panel, `3px 3px 0` on a pill). On the board
 * the box each part is drawn in cut off everything past it, shadow included,
 * so only the wedge between a rounded corner and the square box was left: a
 * dark notch at a panel's corner, a ragged rim along a pill.
 *
 *   1. every part with an outer shadow is cut that much further out
 *      (`overflow: clip` + `overflow-clip-margin`), and none other is;
 *   2. under a PST panel, past its right edge halfway down, the board paints
 *      the shadow's ink, as the site does;
 *   3. and past its rounded corner, outside the shadow's own round corner,
 *      it paints the page, not a square notch.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-shadows.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/NodeView.tsx, src/features/studio/board/helpers.ts
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
await ui.route("https://api.github.com/**", (r) => r.abort());
await openBoard(ui, URL_BASE, "pst");
await ui.waitForTimeout(1000);

/* 1. */
const cut = await ui.evaluate(() => {
  const wrong = [];
  let shaded = 0;
  for (const n of document.querySelectorAll("[data-node-id]")) {
    const wrap = n.querySelector(":scope > [data-part-drawn]");
    const box = wrap?.querySelector("[data-part-box]");
    if (!wrap || !box || wrap.getBoundingClientRect().width === 0) continue;
    const cs = getComputedStyle(wrap);
    if (cs.overflow === "visible") continue;
    /* An outer shadow that is seen: not inset, not see-through, thrown or blurred past the box. */
    const outer = getComputedStyle(box).boxShadow.split(/,(?![^(]*\))/).some((one) => !/inset/.test(one) && !/rgba\([^)]*,\s*0\)/.test(one) && /\s-?[1-9][\d.]*px/.test(one.replace(/\([^)]*\)/g, "")));
    const margin = parseFloat(cs.overflowClipMargin) || 0;
    if (outer) shaded++;
    if (outer ? !(cs.overflow === "clip" && margin > 0) : margin > 0) wrong.push(`${n.getAttribute("data-node-id")}: ${cs.overflow} +${margin}`);
  }
  return { shaded, wrong };
});
check("1. every shadowed part is cut past its shadow, and only those", cut.shaded >= 10 && cut.wrong.length === 0, `${cut.shaded} shadowed; ${cut.wrong.slice(0, 4).join(" | ")}`);

/* The tallest panel with a 6px ink shadow: PST's wallet or balance panel. */
const panel = await ui.evaluate(() => {
  let best = null;
  for (const n of document.querySelectorAll("[data-node-id]")) {
    const box = n.querySelector(":scope > [data-part-drawn] [data-part-box]");
    if (!box || !/6px 6px 0px/.test(getComputedStyle(box).boxShadow)) continue;
    const r = box.getBoundingClientRect();
    if (r.top < 60 || r.bottom > 880 || r.width < 100) continue;
    if (!best || r.height > best.h) best = { id: n.getAttribute("data-node-id"), x: r.left, y: r.top, w: r.width, h: r.height, z: r.width / box.offsetWidth };
  }
  return best;
});
const shot = panel && await ui.screenshot({ clip: { x: Math.floor(panel.x + panel.w - 30), y: Math.floor(panel.y + panel.h - 30), width: 50, height: 50 } });
const at = async (dx, dy) => {
  /* A pixel of the picture, read back in the page: offset from the panel's bottom-right corner, in board px. */
  return ui.evaluate(async ({ png, x, y }) => {
    const img = new Image(); img.src = `data:image/png;base64,${png}`; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const [r, gg, b] = g.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    return (r + gg + b) / 3;
  }, { png: shot.toString("base64"), x: panel.x + panel.w + dx * panel.z - Math.floor(panel.x + panel.w - 30), y: panel.y + panel.h + dy * panel.z - Math.floor(panel.y + panel.h - 30) });
};

/* 2. */
const side = panel ? await at(3, -20) : null;
check("2. past a panel's right edge, the board paints its ink shadow", side !== null && side < 80, JSON.stringify({ panel: panel?.id, brightness: side }));

/* 3. The shadow's own corner is rounded (radius 18): its far corner, 5px in from the shadow box's corner, is page. */
const corner = panel ? await at(5, 5) : null;
check("3. past its rounded corner, page, not a square notch", corner !== null && corner > 150, JSON.stringify({ brightness: corner }));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
