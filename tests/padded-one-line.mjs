/**
 * A LINK'S WORDS INSIDE ITS OWN PADDING ARE ONE LINE, AND ARE NOT CUT.
 *
 * gotchi.gg's nav: each link 15px words in a box padded 9px above and below
 * and 10px either side ("my pets" 81×33). The part read its height whole —
 * 33 is past two 15px lines — so it set the words as a paragraph: free to
 * wrap and clipped at its box. Wherever the glyphs came out a hair wider
 * than on the machine that measured them (another face, another rasteriser,
 * the board's zoom), "my pets" broke onto two lines and "adopt", "park",
 * "graveyard" lost their last letters. The height inside the padding is one
 * line, so they are set on one line and drawn whole.
 *
 * The fixture's words are set in a face this machine does not have, so the
 * fallback is wider than the box, as it was on the owner's.
 *
 *   npx next dev -p 3013   (or a build: npx next start -p 3013)
 *   node tests/padded-one-line.mjs http://127.0.0.1:3013
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const base = JSON.parse(readFileSync(new URL("./fixtures/sink-pages.json", import.meta.url), "utf8"));
const template = base.nodes.find((n) => n.id === "n_prose_92");
const NAV = [["my pets", 294, 81], ["adopt", 377, 66], ["park", 445, 57], ["graveyard", 649, 100]];
const nodes = NAV.map(([words, x, w], i) => ({
  ...template,
  id: `n_nav_${i}`,
  pageId: "page_home",
  content: words,
  x, y: 16, w, h: 33,
  pad: { top: 9, right: 10, bottom: 9, left: 10 },
  font: { family: "system sans", face: "Not A Face On This Machine", size: 0.9375, px: 15, stack: "\"Not A Face On This Machine\", ui-monospace, monospace", weight: 600, leading: 1 },
  groupId: null,
}));
const doc = { ...base, nodes, groups: [] };

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1763, height: 1000 } });
/* Seeded before the Builder first reads its store: it writes its own back on the way out. */
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), JSON.stringify({ state: { ...doc, activePageId: "page_home" }, version: 0 }));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });

const read = await page.evaluate((ids) => ids.map((id) => {
  const el = document.querySelector(`[data-node-id="${id}"]`);
  const surface = el?.querySelector("[data-part]");
  if (!surface) return { id, missing: true };
  const tops = new Set();
  let right = -Infinity;
  const w = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    if (!t.textContent.trim()) continue;
    const rg = document.createRange(); rg.selectNodeContents(t);
    for (const q of rg.getClientRects()) if (q.width) { tops.add(Math.round(q.top / 2)); right = Math.max(right, q.right); }
  }
  const cs = getComputedStyle(surface);
  const box = surface.getBoundingClientRect();
  /* Cut: what reaches past the surface's box while the surface clips. */
  const clips = cs.overflowX !== "visible";
  return { id, lines: tops.size, overflow: cs.overflowX, cut: clips && right > box.right + 0.5, over: Math.round((right - box.right) * 10) / 10 };
}), nodes.map((n) => n.id));

for (const [i, r] of read.entries()) {
  const words = NAV[i][0];
  check(`"${words}" is drawn on one line`, r.lines === 1, JSON.stringify(r));
  check(`…and not cut at its box, even set wider than the page measured it`, !r.missing && !r.cut, JSON.stringify(r));
}
check("with no page error on the way", errors.length === 0, errors.join(" / "));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
