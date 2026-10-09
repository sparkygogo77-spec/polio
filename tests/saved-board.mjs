#!/usr/bin/env node
/**
 * A SAVED BOARD OPENS AS THE IMPORT LEFT IT, WITHOUT IMPORTING.
 *
 * J (2026-10-09): builder threads brought PonsStars in for every small
 * check (archive PST, run the import in a browser, take pictures), and that
 * was where the usage went. A saved board (tests/lib/board.mjs, refreshed by
 * `npm run board -- refresh pst`) is what the browser held once PST had
 * landed; a test or a thread puts it back and opens the Builder on it.
 *
 *   1. the saved board says where it came from and carries no key;
 *   2. opened, every part it was saved with is on the board, on every page,
 *      in seconds, and nothing was fetched from GitHub;
 *   3. the pictures came back too: the chart's still is drawn on the board;
 *   4. Preview runs from it: the page's words and its still are there.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/saved-board.mjs http://127.0.0.1:3013
 *
 * Covers: tests/lib/board.mjs, scripts/board.mjs, tests/fixtures/boards/pst.json.gz, src/features/studio/docStore.ts, src/features/studio/pictures/pictures.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { boardDoc, openBoard, readBoard, PRIVATE } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* 1. */
const saved = readBoard("pst");
const doc = boardDoc(saved);
check("1. the saved board names its site, branch and commit", saved.from?.repo === "sparkygogo77-spec/PST" && /^[0-9a-f]{40}$/.test(saved.from?.commit ?? "") && saved.from.parts === doc.nodes.length, JSON.stringify(saved.from));
const keyish = [...Object.keys(saved.local), ...Object.keys(saved.idb)].filter((k) => PRIVATE.test(k));
check("…and carries no key of anyone's", keyish.length === 0 && !/ghp_|github_pat_|sk-ant-/.test(JSON.stringify(saved.local)), keyish.join());

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
/* The board asks GitHub whether its repository moved on (answered "no" here); bringing in would read its tree and files. */
let fetched = 0;
await ui.route("https://api.github.com/**", (r) => { if (/\/git\/(trees|blobs)\/|\/contents\//.test(r.request().url())) fetched++; return r.abort(); });

/* 2. */
const t0 = Date.now();
const st = await openBoard(ui, URL_BASE, saved);
const took = Date.now() - t0;
const live = await ui.evaluate(() => window.__studioNodes?.() ?? []);
const pages = new Set(live.map((n) => n.pageId));
check("2. every saved part is on the board, on all its pages", live.length === saved.from.parts && st.pages?.length >= 6 && st.pages.every((p) => pages.has(p.id)), `${live.length} of ${saved.from.parts} parts, ${pages.size} of ${st.pages?.length} pages`);
check("…in seconds, with nothing fetched from GitHub", took < 30_000 && fetched === 0, `${(took / 1000).toFixed(1)}s, ${fetched} files fetched`);
const drawn = await ui.evaluate(() => ({ parts: document.querySelectorAll("[data-node-id]").length, words: document.querySelector("[data-studio-pane]")?.innerText ?? "" }));
check("…and drawn: PST's Play page, its heading in words", drawn.parts > 100 && /PonsStars test page/.test(drawn.words), `${drawn.parts} drawn`);

/* 3. */
const chart = live.find((n) => n.hooks?.["data-hook"] === "chart");
/* A picture is drawn as the part's background, from the browser's file storage (a blob: address): it loads, at its own size. */
const pictureIn = (root) => ui.evaluate(async (root) => {
  for (let i = 0; i < 20; i++) {
    const urls = [...document.querySelectorAll(root)].flatMap((r) => [r, ...r.querySelectorAll("*")]).map((e) => /url\("?(blob:[^")]+)/.exec(getComputedStyle(e).backgroundImage)?.[1] ?? (e.tagName === "IMG" && e.src.startsWith("blob:") ? e.src : null)).filter(Boolean);
    for (const u of urls) {
      const size = await new Promise((done) => { const img = new Image(); img.onload = () => done({ w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => done(null); img.src = u; });
      if (size?.w) return size;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}, root);
const still = chart && await pictureIn(`[data-node-id="${chart.id}"]`);
check("3. the chart's still came back with the board and is drawn", !!still, JSON.stringify(still));

/* 4. */
await ui.locator('[aria-label="Preview"]').first().click();
await ui.waitForTimeout(2500);
const words = await ui.evaluate(() => /PonsStars test page/.test(document.querySelector("[data-live-shell]")?.textContent ?? ""));
const shown = await pictureIn("[data-live-shell]");
check("4. Preview runs from the saved board: its words and its still", words && !!shown, JSON.stringify({ words, still: shown }));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
