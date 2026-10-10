#!/usr/bin/env node
/**
 * LEAVING PREVIEW IS INSTANT.
 *
 * J (2026-10-10): "stepping out of the preview also isnt instantaneous as it
 * should be". The board was unmounted for Preview and built again from
 * nothing on the way back: on the saved PST board that took 3.7 seconds.
 * It is kept under Preview now, hidden, and coming back only shows it.
 *
 *   1. under Preview the board is still there, but nobody sees it, reaches
 *      it or scrolls through it, and the side panel is gone from the row;
 *   2. pressing Preview again shows the board in well under a second, the
 *      same parts at the same width (zoom) it had before;
 *   3. it is the same board, not one built again (a mark left on it stays).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/preview-exit-instant.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/page/StudioPage.tsx, src/features/studio/board/DesktopCanvas.tsx
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
await openBoard(ui, URL_BASE, readBoard("pst"));
await ui.waitForTimeout(2500);

const before = await ui.evaluate(() => {
  const board = document.querySelector("[data-node-id]")?.closest("[data-board-tool]");
  if (board) board.setAttribute("data-test-mark", "1");
  return { parts: document.querySelectorAll("[data-node-id]").length, width: board?.getBoundingClientRect().width ?? 0 };
});

/* 1. */
await ui.locator('[aria-label="Preview"]').first().click();
await ui.waitForTimeout(2000);
const under = await ui.evaluate(() => {
  const kept = document.querySelector("[data-board-kept]");
  const pane = document.querySelector("[data-studio-pane]");
  return {
    kept: !!kept && !!kept.querySelector("[data-test-mark]"),
    invisible: !!kept && getComputedStyle(kept).visibility === "hidden" && kept.getBoundingClientRect().height === 0,
    inert: !!kept && kept.inert === true && kept.getAttribute("aria-hidden") === "true",
    /* The site scrolls in its own scroller; the hidden board adds nothing to the pane's travel. */
    scroll: pane ? pane.scrollHeight - pane.clientHeight : null,
    side: [...document.querySelectorAll("aside:not([inert])")].filter((a) => a.getClientRects().length > 0).length,
  };
});
check("1. under Preview the board is kept, hidden and out of reach", under.kept && under.invisible && under.inert, JSON.stringify(under));
check("…the pane scrolls only the site, and no side panel stands beside it", under.scroll != null && under.scroll <= 1 && under.side === 0, `pane scrolls ${under.scroll}px, ${under.side} side panels shown`);

/* 2. */
const back = await ui.evaluate(() => new Promise((done) => {
  const t0 = performance.now();
  document.querySelector('[aria-label="Preview"]').click();
  const tick = () => {
    if (!document.querySelector("[data-board-kept]") && document.querySelectorAll("[data-node-id]").length > 100) requestAnimationFrame(() => done(performance.now() - t0));
    else if (performance.now() - t0 > 10_000) done(-1);
    else requestAnimationFrame(tick);
  };
  tick();
}));
const after = await ui.evaluate(() => {
  const board = document.querySelector("[data-node-id]")?.closest("[data-board-tool]");
  return { parts: document.querySelectorAll("[data-node-id]").length, width: board?.getBoundingClientRect().width ?? 0, mark: !!document.querySelector("[data-test-mark]"), visible: board ? getComputedStyle(board).visibility === "visible" : false };
});
check("2. pressing Preview again shows the board in well under a second", back > 0 && back < 1000, `${Math.round(back)}ms (was 3.7s)`);
check("…every part, at the zoom and width it had", after.visible && after.parts === before.parts && Math.abs(after.width - before.width) < 1, JSON.stringify({ before, after }));

/* 3. */
check("3. it is the same board, not one built again", after.mark);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
