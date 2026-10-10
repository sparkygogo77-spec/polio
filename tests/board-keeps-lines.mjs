#!/usr/bin/env node
/**
 * ON THE BOARD, WORDS KEEP THE NUMBER OF LINES THE SITE SET THEM ON.
 *
 * J (2026-10-10), PST on the board: wrapped words take a line more than on
 * the site. The import measures in the builder's own browser, so a box is
 * as wide as its words were in THOSE fonts; a viewer whose `system-ui` runs
 * wider gets a word too many on a row and one more line.
 *   - words over several lines are set a hair tighter (letter spacing, at
 *     most 0.05em) while they draw taller than their box
 *     (`textFit.ts#useKeepLines`), so the box keeps its height and nothing
 *     under it moves;
 *   - a checkbox one line tall holds its words on one line, and the board
 *     widens it to them (`PageControls.tsx#Checkbox`, `textFit.ts#lineWidth`):
 *     "Approve automatically with the test wallet" (339x22 on the page)
 *     wrapped "wallet" and grew to 45 even in the import's own fonts.
 *
 * The saved board was stored after that growth, so its parts are put back to
 * the boxes the import read (`source.was.box`) first, as a fresh import has them.
 * Wider fonts are stood in for by word spacing.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-keeps-lines.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/textFit.ts, src/features/studio/shelf/parts/Text.tsx, src/features/studio/shelf/parts/PageControls.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { boardDoc, openBoard, readBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* The board as a fresh import leaves it: every part at the box the import read. */
const board = readBoard("pst");
const doc = boardDoc(board);
for (const n of doc.nodes) { const b = n.source?.was?.box; if (b && n.y === b.y && n.x === b.x) { n.w = b.w; n.h = b.h; } }
const put = (raw) => { const j = JSON.parse(raw); j.state = doc; return JSON.stringify(j); };
if (JSON.parse(board.local["builder.studio"] ?? "null")?.state?.nodes) board.local["builder.studio"] = put(board.local["builder.studio"]);
for (const r of board.idb["builder.docs"]?.stores?.docs ?? []) if (r.key === "builder.studio") r.value = put(r.value);

const note = doc.nodes.find((n) => n.hooks?.["data-hook"] === "chart-note");
const box = doc.nodes.find((n) => n.hooks?.["data-hook"] === "sign-auto");
check("1. the saved board has PST's chart note (3 lines) and the sign-auto checkbox (1 line)", note?.h === 67 && box?.h === 22, `${note?.w}x${note?.h}, ${box?.w}x${box?.h}`);

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

const drawn = async (wider) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (wider) await page.addInitScript(() => { const put = () => { const s = document.createElement("style"); s.textContent = "[data-node-id] p, [data-node-id] span { word-spacing: 4px !important; }"; document.head.appendChild(s); }; if (document.head) put(); else document.addEventListener("DOMContentLoaded", put); });
  await openBoard(page, URL_BASE, board);
  await page.waitForTimeout(3000);
  const out = await page.evaluate(({ n, c }) => {
    const board = document.querySelector("[data-board-zoom]"); if (board) board.style.zoom = "1";
    const rows = (el) => {
      const tops = [], r = document.createRange(), walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let x = walk.nextNode(); x; x = walk.nextNode()) { if (!(x.textContent ?? "").trim()) continue; r.selectNodeContents(x); for (const q of r.getClientRects()) if (q.width > 0 && !tops.some((t) => Math.abs(t - q.top) < 4)) tops.push(q.top); }
      return tops.length;
    };
    const part = (id) => document.querySelector(`[data-node-id="${id}"]`);
    const node = (id) => window.__studioNodes().find((x) => x.id === id);
    const words = part(n).querySelector("[data-part] > div");
    const label = part(c).querySelector("label");
    const ink = (el) => { const r = document.createRange(); r.selectNodeContents(el); return Math.ceil(r.getBoundingClientRect().right); };
    return {
      note: { rows: rows(part(n).querySelector("[data-part]")), h: node(n).h, spacing: getComputedStyle(words).letterSpacing },
      box: { rows: rows(part(c).querySelector("[data-part]")), h: node(c).h, w: node(c).w, right: Math.round(part(c).getBoundingClientRect().right), ink: ink(label) },
    };
  }, { n: note.id, c: box.id });
  await page.close();
  return { ...out, errors };
};

/* 2. In the fonts it was read in: as the page set it, nothing tightened. */
const same = await drawn(false);
check("2. in the import's fonts, the chart note is 3 lines, 67 tall, letters as set", same.note.rows === 3 && same.note.h === 67 && same.note.spacing === "normal", JSON.stringify(same.note));
check("…and the checkbox's words are one line, 22 tall", same.box.rows === 1 && same.box.h === 22, JSON.stringify(same.box));

/* 3. In wider fonts: still 3 lines in the same box, set a little tighter; the checkbox on one line, its box out to its words. */
const wide = await drawn(true);
check("3. in wider fonts, the chart note keeps 3 lines and its 67", wide.note.rows === 3 && wide.note.h === 67, JSON.stringify(wide.note));
check("…by setting its letters tighter, by no more than 0.05em", /px$/.test(wide.note.spacing) && parseFloat(wide.note.spacing) < 0 && parseFloat(wide.note.spacing) >= -0.8, wide.note.spacing);
check("…the checkbox keeps one line and 22", wide.box.rows === 1 && wide.box.h === 22, JSON.stringify(wide.box));
check("…and its box reaches its words", wide.box.right >= wide.box.ink - 2, JSON.stringify(wide.box));
check("4. no page errors", !same.errors.length && !wide.errors.length, [...same.errors, ...wide.errors].join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
