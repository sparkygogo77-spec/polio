#!/usr/bin/env node
/**
 * WORDS KEEP THEIR LINES WHEN THE BOX IS ITS WORDS' OWN RECTANGLE.
 *
 * thesolface.site brought in (run 39707081826, J's browser): lore landed
 * 19px long. The cause was one part: "NO CRYSTAL BALL. / JUST A BETTER PAIR
 * OF GOGGLES.", 11px DM Mono at 1.6, captured 218 x 32. Its second line
 * fills the box to a hair, and in J's fonts it wrapped to a third: 53 tall.
 * `useKeepLines` sets words a hair tighter to keep the page's lines, but it
 * was told the room was 32, the words' own rectangle, while two lines at
 * 1.6 need 35.2. Even two lines read as too tall, every step failed, the
 * spacing was put back, and three lines stayed.
 *
 * The room is the box's whole lines (`textFit.ts#linesRoom`): 32 over a
 * 17.6 pitch is 2 lines, 35.2. A wider face is stood in for by a box a few
 * pixels narrower than the line.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/keep-lines-room.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/textFit.ts, src/features/studio/shelf/parts/Text.tsx
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { linesRoom } = await jiti.import(join(here, "..", "src", "features", "studio", "textFit.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

check("the room of a 32-tall box at a 17.6 pitch is its two whole lines", Math.abs(linesRoom(32, 17.6) - 35.2) < 0.01, String(linesRoom(32, 17.6)));
check("control: a box already at its lines keeps its own room", linesRoom(67, 22) === 67 && linesRoom(22, 22) === 22);

const WORDS = "NO CRYSTAL BALL.\nJUST A BETTER PAIR OF GOGGLES.";
const part = (w) => ({ id: "n_goggles", pageId: "home", featureId: "prose", label: WORDS, prompt: "", content: WORDS, data: "", x: 100, y: 100, w, h: 32, groupId: null, options: {}, priority: "must", custom: false, locked: false, link: null, colour: { text: "rgb(20, 20, 20)" }, font: { family: "monospace", px: 11, size: 0.6875, stack: "\"Courier New\", monospace", weight: 400, spacing: 0.06, leading: 1.6 }, from: { url: "https://thesolface.site/", host: "thesolface.site", selector: "body > main > section:nth-of-type(2) > div::text(1)", at: 1 } });

const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false } }) }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
const seed = (n) => page.evaluate((n) => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "keeplines", name: "keeplines", updatedAt: Date.now() }], activeId: "keeplines" }));
  localStorage.setItem("builder.studio", env({ pages: [{ id: "home", name: "Home", path: "/", prompt: "", scroll: "inherit" }], activePageId: "home", nodes: [n], swept: 99 }));
}, n);
/* The words' element: its height, its rows, and the widest line's natural width at the spacing it draws with. */
const read = () => page.evaluate(async () => {
  await document.fonts.ready;
  const host = document.querySelector('[data-node-id="n_goggles"] [data-part]');
  const second = host ? [...host.querySelectorAll("p")].find((p) => /GOGGLES/.test(p.textContent ?? "")) : null;
  if (!second) return null;
  /* The words' block holds the two lines; its rows are its height over a line. */
  const block = second.parentElement;
  /* The board is drawn zoomed: a rectangle on screen over its layout size is the zoom. */
  const zoom = block.getBoundingClientRect().width / (block.offsetWidth || 1);
  const lh = parseFloat(getComputedStyle(second).lineHeight) || 17.6;
  /* The second line's own words, as drawn (one row when the box is wide). */
  const range = document.createRange(); range.selectNodeContents(second);
  const line = Math.max(...[...range.getClientRects()].map((r) => r.width));
  return { rows: Math.round(block.offsetHeight / lh), line: line / zoom, spacing: getComputedStyle(second).letterSpacing, node: (window.__studioNodes?.() ?? []).find((n) => n.id === "n_goggles")?.h ?? null };
});

/* First drawn wide, to read the line's natural width in this machine's face. */
await seed(part(600));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const wide = await read();
check("the part is drawn", !!wide, JSON.stringify(wide));

/* Then in a box a few pixels narrower than that line (a face a hair wider than the page's), with the page's 32. */
const w = Math.floor((wide?.line ?? 218) - 4);
await seed(part(w));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const tight = await read();
check("in a box a hair narrower than its line, the words keep two lines", tight?.rows === 2, JSON.stringify({ w, ...tight }));
check("…by setting their letters tighter than the page's own spacing", /px$/.test(tight?.spacing ?? "") && parseFloat(tight.spacing) < parseFloat(wide?.spacing ?? "0"), `${tight?.spacing} against ${wide?.spacing}`);
check("…and the part is not grown to a third line", (tight?.node ?? 99) < 40, String(tight?.node));
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
