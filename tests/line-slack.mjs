#!/usr/bin/env node
/**
 * A LINE AS WIDE AS ITS BOX STAYS ONE LINE, ON THE BOARD AND ON THE PUBLISHED PAGE.
 *
 * thesolface.site's footer wordmark is "THE SOL" and "FACE." on two lines,
 * with a break between them. On the page its box is 600.0625 wide, and the
 * capture records 600; "THE SOL" is exactly 600.0625 wide. Drawn in a box
 * 600 wide, "THE SOL" wrapped. On the board the keep-lines pass set the
 * letters a hair tighter, so it held two lines, 248 tall. The published page
 * has no such pass, so it drew three lines, 371 tall (the hand-edit pass,
 * 2026-10-22). Words the page read as wrapped already had a pixel of room
 * for the box's rounding; a line ended by a break did not.
 *
 * Here, a captured part whose box is its first line's width rounded down
 * (a fraction short, as the capture's rounding leaves it):
 *   1. the board keeps its box, 128 tall;
 *   2. the published page at 1440 draws it on two lines, at the board's
 *      height to the pixel, with no tightening of its own.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/line-slack.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/shelf/parts/Text.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { boardWith, captured, part } from "./lib/seeded.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  /* The first line's width in this browser, and a line of the same face that is a fraction over a whole pixel. */
  const probe = await browser.newPage();
  const FACE = "Arial";
  let first = null, wide = 0;
  for (const words of ["WIDE WORDS", "THE SOL", "WIDE WORD", "BIG TYPE", "SEE GREEN", "TOP LINE"]) {
    const w = await probe.evaluate(([words, face]) => { const s = document.createElement("span"); s.textContent = words; s.style.cssText = `position:absolute;white-space:nowrap;font-family:${face};font-size:64px;font-weight:700`; document.body.appendChild(s); const w = s.getBoundingClientRect().width; s.remove(); return w; }, [words, FACE]);
    if (w - Math.floor(w) > 0.02) { first = words; wide = w; break; }
  }
  await probe.close();
  check("a first line a fraction past a whole pixel is found", !!first, `${first}: ${wide}`);
  if (!first) throw new Error("no fractional line");
  const W = Math.floor(wide);
  const parts = [
    part("n_main", 0, 0, 1440, 900, { ...captured("body > footer"), colour: { bg: "rgb(10, 16, 26)" } }),
    part("n_mark", 50, 200, W, 128, {
      featureId: "prose", content: [{ text: `${first}\n` }, { text: "FACE." }],
      font: { face: FACE, stack: `${FACE}, sans-serif`, px: 64, size: 4, weight: 700, leading: 1 },
      colour: { text: "rgb(246, 245, 239)" }, ...captured("body > footer > a"),
    }),
  ];
  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, boardWith(parts));
  await ui.waitForTimeout(2000);
  const rows = (el) => { const tops = []; const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let t = tw.nextNode(); t; t = tw.nextNode()) { if (!t.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(t); for (const q of r.getClientRects()) if (q.width > 0 && !tops.some((x) => Math.abs(x - q.top) < q.height / 2)) tops.push(q.top); } return tops.length; };
  const onBoard = await ui.evaluate(([rowsSrc]) => { const rows = eval(rowsSrc); const el = document.querySelector('[data-node-id="n_mark"]'); const s = el.getBoundingClientRect().height / el.offsetHeight; return { rows: rows(el), h: Math.round(el.offsetHeight), s }; }, [rows.toString()]);
  /* The board draws at its zoom, where layout rounds otherwise; its box is what the published page must match. */
check("1. the board keeps the mark's box at 128px", onBoard.h === 128, JSON.stringify(onBoard));

  const files = await ui.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path.replace(/^\/+/, ""), content: f.content, encoding: f.encoding })));
  const byPath = new Map(files.map((f) => [f.path, f]));
  const out = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await out.route("http://site.test/**", (r) => {
    const path = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/+/, "")) || "index.html";
    const f = byPath.get(path);
    if (!f) return r.fulfill({ status: 404, body: "" });
    const type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html";
    return r.fulfill({ status: 200, contentType: type, body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
  });
  await out.goto("http://site.test/index.html", { waitUntil: "load" });
  await out.waitForTimeout(1500);
  const pub = await out.evaluate(([rowsSrc]) => { const rows = eval(rowsSrc); const el = document.getElementById("n_mark"); const r = el.getBoundingClientRect(); return { rows: rows(el), h: Math.round(r.height), w: Math.round(r.width) }; }, [rows.toString()]);
  check("2. the published page draws it on two lines too, as tall as on the board (0px)", pub.rows === 2 && pub.h === onBoard.h, `${JSON.stringify(pub)} against the board's ${onBoard.h}`);
  check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
} finally {
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
process.exit(results.every(Boolean) ? 0 : 1);
