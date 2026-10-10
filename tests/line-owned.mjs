#!/usr/bin/env node
/**
 * A LINE OF WORDS READ OFF A PANEL STAYS IN THE PANEL, AND WORDS THE PAGE
 * WRAPPED STILL WRAP.
 *
 * J (2026-10-10), PST's Balance panel on the board: "One escrow balance for
 * all your matches." dropped onto "In your wallet", under its "?", and
 * "Escrow balance (available to stake or withdraw)" ran out past the
 * panel's edge. Two causes, both in the builder:
 *
 *   - the note is read as a line straight off its section
 *     (`section ::line(5)`), and `owns.ts#under` did not count that as the
 *     section's, so the settle (`textFit.ts#fitTree`) placed the note as a
 *     part of the page standing under the whole panel: any words growing
 *     inside the panel pushed the note down, and the lines under it stayed;
 *   - a paragraph is held to one line by its height against two lines of
 *     the board's type (`parts/Text.tsx`); a size, leading or padding that
 *     differs from the page's put the two-row escrow line under that mark.
 *     What the page drew (`source.was`) now says it wraps (`blocks.tsx`).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/line-owned.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/owns.ts, src/features/studio/textFit.ts, src/features/studio/blocks.tsx
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";
import { boardDoc, openBoard, readBoard } from "./lib/board.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { under } = await jiti.import(join(here, "..", "src", "features", "studio", "owns.ts"));
const { fitRows } = await jiti.import(join(here, "..", "src", "features", "studio", "textFit.ts"));

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* 1. Pure. */
check("1. a line read off a section is the section's", under("aside > section", "aside > section ::line(5)") && !under("aside > sec", "aside > section ::line(5)") && !under("aside > section", "aside > section ::line(x)"));
check("…and children and pseudo-elements still are", under("a", "a > b") && under("a", "a::before") && !under("div:nth-of-type(1)", "div:nth-of-type(11) > p"));

/* 2. The settle, on the saved board's Balance panel: the escrow line grows a row. */
const doc = boardDoc(readBoard("pst"));
const words = (n) => (Array.isArray(n.content) ? n.content.map((s) => s.text ?? "").join("") : String(n.content ?? ""));
const find = (re) => doc.nodes.find((n) => re.test(words(n)));
const note = find(/^One escrow balance/), wallet = find(/^In your wallet/), escrow = find(/^Escrow balance \(/), match = find(/^In a match/);
const panel = doc.nodes.find((n) => n.from?.selector === note?.from?.selector.replace(/ ::line\(\d+\)$/, ""));
check("2. the saved board has the Balance panel's note, lines and panel", !!(note && wallet && escrow && match && panel), [note, wallet, escrow, match, panel].map((n) => n?.id).join());
const boxes = doc.nodes.filter((n) => n.pageId === note.pageId && n.from?.selector && !n.state).map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, drew: n.id === escrow.id ? n.h + 22 : n.h, path: n.from.selector.trim(), words: !!words(n).trim() }));
const fitted = new Map(fitRows(boxes, () => true, doc.frameWidth).map((f) => [f.id, f]));
check("…a line growing in the panel leaves the note above it where it was", !fitted.has(note.id), JSON.stringify(fitted.get(note.id)));
check("…and moves what is under it", fitted.get(match.id)?.y === match.y + 22, JSON.stringify(fitted.get(match.id)));

/* 3. On the board, with the words set wider than they were read, and the escrow line's type a size up. */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => { const put = () => { const s = document.createElement("style"); s.textContent = "[data-node-id] p, [data-node-id] span { letter-spacing: 0.05em !important; }"; document.head.appendChild(s); }; if (document.head) put(); else document.addEventListener("DOMContentLoaded", put); });
await openBoard(page, URL_BASE, "pst");
const bigger = { ...doc, nodes: doc.nodes.map((n) => (n.id === escrow.id ? { ...n, font: { ...n.font, px: 17 } } : n)) };
await page.evaluate((d) => window.__studioLoadDoc(d), bigger);
await page.waitForTimeout(3000);

const drawn = await page.evaluate(({ ids, panelId }) => {
  const rows = (id) => {
    const el = document.querySelector(`[data-node-id="${id}"] [data-part]`);
    if (!el) return [];
    const out = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) {
      if (!(t.textContent ?? "").replace(/​/g, "").trim()) continue;
      const r = document.createRange(); r.selectNodeContents(t);
      for (const q of r.getClientRects()) if (q.width > 0) out.push({ l: q.left, r: q.right, t: q.top, b: q.bottom });
    }
    return out;
  };
  const p = document.querySelector(`[data-node-id="${panelId}"]`)?.getBoundingClientRect();
  const nodes = window.__studioNodes();
  return { panelRight: p?.right ?? 0, words: Object.fromEntries(ids.map((id) => [id, rows(id)])), y: Object.fromEntries(ids.map((id) => [id, nodes.find((n) => n.id === id)?.y])) };
}, { ids: [note.id, wallet.id, escrow.id, match.id], panelId: panel.id });
const hit = (a, b) => a.some((x) => b.some((y) => x.r > y.l + 1 && x.l < y.r - 1 && x.b > y.t + 1 && x.t < y.b - 1));
check("3. on the board the note stays where the page put it", drawn.y[note.id] === note.y, `${drawn.y[note.id]} vs ${note.y}`);
check("…its words cross no line's words under it", !hit(drawn.words[note.id], drawn.words[wallet.id]) && !hit(drawn.words[wallet.id], drawn.words[escrow.id]) && !hit(drawn.words[escrow.id], drawn.words[match.id]));
const overrun = Math.max(...[note, wallet, escrow, match].flatMap((n) => drawn.words[n.id].map((q) => q.r))) - drawn.panelRight;
check("…and every line's words stay inside the panel, the escrow line wrapped at a size up", overrun < 0 && new Set(drawn.words[escrow.id].map((q) => Math.round(q.t))).size >= 2, `overrun ${Math.round(overrun)}`);
check("with no page error on the way", errors.length === 0, errors.join(" / "));
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
