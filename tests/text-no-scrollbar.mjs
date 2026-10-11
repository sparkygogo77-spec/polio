#!/usr/bin/env node
/**
 * WORDS NEVER GROW A SCROLLBAR.
 *
 * sunkcoin.fun (J, 2026-10-11, "text moves and collides on this part of the
 * page"): the All-wallets table's head, "UNDERWATER FOR", sits in a 72px
 * cell over two rows. In the Preview the cell showed a scrollbar and the
 * word cut to "UNDERWATE": the text part scrolled (`overflow: auto`) where
 * this machine's font set the word a hair wider than the box the page
 * measured. The page had no bar there. A text part clips what leaves its
 * box across and grows with its words down, on the board and in the
 * Preview, so no captured cell ever shows a bar the page did not have.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/text-no-scrollbar.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/shelf/parts/Text.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { boardWith, captured, openPreview, part } from "./lib/seeded.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* A table head cell, 72 wide and two 14px lines tall, holding a word wider than the cell in a wide face. */
const font = { face: "Impact", size: 1, px: 14, stack: "Impact, 'Arial Black', sans-serif", weight: 900, leading: 1.15 };
const parts = [
  part("n_head", 300, 200, 72, 34, { featureId: "prose", content: "UNDERWATER FOR", ...captured("body > table > thead > tr > th:nth-of-type(3)"), font, colour: { text: "rgb(20, 20, 20)", bg: "rgb(250, 250, 250)" } }),
  part("n_cell", 400, 200, 60, 34, { featureId: "prose", content: "Bag", ...captured("body > table > thead > tr > th:nth-of-type(4)"), font, colour: { text: "rgb(20, 20, 20)", bg: "rgb(250, 250, 250)" } }),
  part("n_body", 100, 300, 1200, 1200, { ...captured("body > main"), colour: { bg: "rgb(240, 240, 240)" } }),
];

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, boardWith(parts));
  const read = () => ui.evaluate(() => {
    const out = {};
    for (const id of ["n_head", "n_cell"]) {
      const el = document.querySelector(`[data-live-node="${id}"]`) ?? document.querySelector(`[data-node-id="${id}"]`);
      const fill = el?.querySelector("[data-part]");
      if (!fill) { out[id] = null; continue; }
      const cs = getComputedStyle(fill);
      out[id] = { overflowX: cs.overflowX, overflowY: cs.overflowY, barX: fill.offsetHeight - fill.clientHeight, barY: fill.offsetWidth - fill.clientWidth, words: fill.textContent.trim(), wider: fill.scrollWidth > fill.clientWidth };
    }
    return out;
  });
  const board = await read();
  check("on the board, the wide word's cell scrolls nothing: no bar across or down", board.n_head && !/auto|scroll/.test(board.n_head.overflowX + board.n_head.overflowY) && board.n_head.barX === 0 && board.n_head.barY === 0, JSON.stringify(board.n_head));
  check("…the word is whole in the part (clipped by the box, never scrolled or broken)", board.n_head?.words === "UNDERWATER FOR", JSON.stringify(board.n_head));
  await openPreview(ui, URL_BASE);
  const live = await read();
  check("in the Preview, the same: no bar on the cell", live.n_head && !/auto|scroll/.test(live.n_head.overflowX + live.n_head.overflowY) && live.n_head.barX === 0 && live.n_head.barY === 0, JSON.stringify(live.n_head));
  check("…nor on the cell beside it", live.n_cell && live.n_cell.barX === 0 && live.n_cell.barY === 0, JSON.stringify(live.n_cell));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
