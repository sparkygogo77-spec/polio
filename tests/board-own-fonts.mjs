#!/usr/bin/env node
/**
 * ON THE BOARD, A LINE OF WORDS IS AS WIDE AS IT DRAWS, AND A PART SET AFTER
 * A LINE'S WORDS FOLLOWS THEM.
 *
 * J (2026-10-10), PST on the board: the "PonsStars test page" title's box
 * (page-title-text, 314x45) ended well before its words, and in the Balance
 * panel "your" wrapped down and the "?" sat over "matches.". One cause: the
 * import measures the page in the builder's own headless browser, so every
 * box is as wide as the words were in THAT machine's fonts, and the board
 * draws them in his (`ui-monospace`, `system-ui` are other faces there).
 *   - a line held on one row that runs past its box gets the width it drew
 *     at, as a box that drew taller gets its height (`textFit.ts#lineWidth`);
 *   - a part read as following a line's words (`node.follows`) is placed
 *     after where they end now, as the Preview already did (`live/follow.ts`).
 *
 * Wider fonts are stood in for by letter spacing on the board's words.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-own-fonts.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/textFit.ts, src/features/studio/live/follow.ts, src/features/studio/board/DesktopCanvas.tsx, src/features/studio/board/store/nodes.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { boardDoc, openBoard, readBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const doc = boardDoc(readBoard("pst"));
const words = (n) => (Array.isArray(n.content) ? n.content.map((s) => s.text ?? "").join("") : String(n.content ?? ""));
const title = doc.nodes.find((n) => n.hooks?.["data-hook"] === "page-title-text");
const note = doc.nodes.find((n) => /^One escrow balance/.test(words(n)));
const help = doc.nodes.find((n) => n.follows?.id === note?.id);
check("1. the saved board has PST's title, the Balance note and its \"?\"", !!(title && note && help), [title, note, help].map((n) => n?.id).join());

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

const drawn = async (wider) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (wider) await page.addInitScript(() => { const put = () => { const s = document.createElement("style"); s.textContent = "[data-node-id] p, [data-node-id] span, [data-node-id] div { letter-spacing: 0.06em !important; }"; document.head.appendChild(s); }; if (document.head) put(); else document.addEventListener("DOMContentLoaded", put); });
  await openBoard(page, URL_BASE, "pst");
  await page.waitForTimeout(3000);
  const out = await page.evaluate(({ t, n, q }) => {
    const rows = (el) => {
      const out = [], r = document.createRange(), walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let x = walk.nextNode(); x; x = walk.nextNode()) { if (!(x.textContent ?? "").replace(/​/g, "").trim()) continue; r.selectNodeContents(x); for (const c of r.getClientRects()) if (c.width > 0) out.push(c); }
      return out;
    };
    const part = (id) => document.querySelector(`[data-node-id="${id}"]`);
    const tb = part(t).getBoundingClientRect(), tw = rows(part(t).querySelector("[data-part-drawn]"));
    const nr = rows(part(n).querySelector("[data-part-drawn]")), last = nr[nr.length - 1], qb = part(q).getBoundingClientRect();
    return {
      w: window.__studioNodes().find((x) => x.id === t).w,
      titleBox: Math.round(tb.right), titleWords: Math.round(Math.max(...tw.map((c) => c.right))),
      lastRow: last && { right: Math.round(last.right), top: Math.round(last.top), bottom: Math.round(last.bottom) },
      help: { left: Math.round(qb.left), mid: Math.round((qb.top + qb.bottom) / 2) },
    };
  }, { t: title.id, n: note.id, q: help.id });
  await page.close();
  return { ...out, errors };
};

/* 2. In the fonts it was read in, nothing moves. */
const same = await drawn(false);
check("2. in the fonts it was read in, the title keeps its width", same.w === title.w, `${title.w} -> ${same.w}`);
check("…and the \"?\" still sits after the note's words", same.help.left >= same.lastRow.right && same.help.left - same.lastRow.right < 12, JSON.stringify(same));

/* 3. In wider fonts: the title's box reaches its words; the "?" is after them, on their row. */
const wide = await drawn(true);
check("3. in wider fonts, the title's box ends where its words do", wide.w > title.w && Math.abs(wide.titleBox - wide.titleWords) <= 2, `w ${title.w} -> ${wide.w}; box ${wide.titleBox}, words ${wide.titleWords}`);
check("…the \"?\" is after the note's last word, not over it", wide.help.left >= wide.lastRow.right && wide.help.left - wide.lastRow.right < 12, JSON.stringify({ lastRow: wide.lastRow, help: wide.help }));
check("…and on that word's row", wide.help.mid >= wide.lastRow.top - 2 && wide.help.mid <= wide.lastRow.bottom + 2, JSON.stringify({ lastRow: wide.lastRow, help: wide.help }));
check("4. no page errors", !same.errors.length && !wide.errors.length, [...same.errors, ...wide.errors].join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
