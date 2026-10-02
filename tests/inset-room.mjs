/**
 * A PARAGRAPH'S WORDS GET THE WHOLE WIDTH OF THEIR BOX.
 *
 * MEASURED on e5ec57e, a fresh import of sink 81aa13d: of 213 parts one line
 * tall, 64 looked narrower than their words, almost all by 2 to 2.5px. The
 * boxes were right. `parts/Text.tsx` sets every plain paragraph 2px in from
 * its left edge (`paddingLeft: max(2, padding)`, so a first glyph's side
 * bearing is not clipped), and those 2px came out of the line's room. The
 * wordmark proves it: "A Sol" + "Works" + " project" is 60 + 60 + 96 = 216px
 * of Press Start 2P in a 216px box, and it needed 218. Taken out, 60 of the 64
 * fit to within a pixel.
 *
 * On a fresh import the one-line net already holds those on one line. Where
 * it does not apply, a box the healing already grew to two lines, as on
 * his board, the words wrap in a box exactly as wide as they are. That is
 * the case this reads, alongside the guard: the words start at the box's
 * left edge, where the page set them (the inset is outside the box), and no
 * stored box changes.
 *
 * Every expected number is the fixture's or the page's.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/inset-room.mjs http://127.0.0.1:3013 [path to sink site/document.json]
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const DOC = process.argv[3] ?? "capture/versions/sink-0ee06fa/site/document.json";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const doc = JSON.parse(readFileSync(DOC, "utf8"));
const home = doc.nodes.filter((n) => n.pageId === "page_home");
/* His wordmark: the header's three runs, as the rejoin will keep them in the first. */
const mark = home.filter((n) => (n.from?.selector ?? "").startsWith("body > div > header") && ["A Sol", "Works", " project"].includes(n.content)).sort((a, b) => a.x - b.x);
check("the fixture holds the header wordmark as three runs", mark.length === 3, mark.map((n) => JSON.stringify(n.content)).join(" + "));
const markBox = mark.length ? Math.max(...mark.map((n) => n.x + n.w)) - Math.min(...mark.map((n) => n.x)) : 0;
/* A board whose healing already grew its one-line paragraphs to two lines, as his did: the one-line net no longer applies. */
const plainOne = (n) => n.featureId === "prose" && typeof n.content === "string" && !n.content.includes("\n") && !(n.pad?.left) && n.font
  && n.h < 1.5 * (n.font.size ?? 1) * 16 * (n.font.leading ?? 1.4);
const grown = { ...doc, nodes: doc.nodes.map((n) => (n.pageId === "page_home" && plainOne(n) ? { ...n, h: n.h * 2 } : n)) };

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify({ state: { ...d, activePageId: "page_home" }, version: 0 })), grown);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(4000);

const read = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio")).state;
  const z = document.querySelector("[data-frame]").getBoundingClientRect().width / s.frameWidth;
  const out = {};
  for (const n of s.nodes.filter((x) => x.pageId === s.activePageId && x.featureId === "prose")) {
    const el = document.querySelector(`[data-node-id="${n.id}"]`);
    const surface = el?.querySelector("[data-part]");
    if (!surface) continue;
    const box = el.getBoundingClientRect();
    const tops = new Set(); let left = Infinity;
    const w = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      if (!t.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(t);
      for (const q of rg.getClientRects()) if (q.width) { tops.add(Math.round(q.top / 2)); left = Math.min(left, q.left); }
    }
    const holder = surface.firstElementChild?.nextElementSibling ?? surface.lastElementChild;
    /* The words' own width on one line: the holder, cloned, unwrapped and uncapped. */
    let words = null;
    if (holder) {
      const c = holder.cloneNode(true);
      c.style.cssText += ";position:absolute;left:0;top:0;width:max-content;max-width:none;white-space:nowrap;visibility:hidden";
      holder.parentElement.appendChild(c); words = +(c.getBoundingClientRect().width / z).toFixed(1); c.remove();
    }
    out[n.id] = { x: n.x, y: n.y, w: n.w, h: n.h, pad: n.pad?.left ?? 0, align: n.text?.align ?? "none", runs: typeof n.content !== "string", lines: tops.size, fromLeft: +((left - box.left) / z).toFixed(1), room: holder ? +(holder.getBoundingClientRect().width / z).toFixed(1) : null, words, cap: holder ? parseFloat(getComputedStyle(holder).maxWidth) || Infinity : Infinity };
  }
  return out;
});

/* The site's own line length (Format, "Line length") caps a line too; that is his setting, not this, so the room asked for is the box or the cap, whichever is narrower. */
const room = (r) => Math.min(r.w, r.cap);
const fits = Object.entries(read).filter(([id, r]) => plainOne(doc.nodes.find((n) => n.id === id) ?? {}) && r.words !== null && r.words <= room(r));
const broken = fits.filter(([, r]) => r.lines !== 1);
check("every plain paragraph whose words fit its box draws them on one line, where the one-line net does not apply", fits.length > 0 && broken.length === 0,
  `${fits.length} whose words fit; ${broken.length} broken onto more lines, e.g. ${broken.slice(0, 3).map(([id, r]) => `${id} ${r.words} in ${room(r)}`).join(", ")}`);
const plain = Object.entries(read).filter(([, r]) => r.pad === 0 && r.room !== null);
/* Set from the left: a centred or right-set line keeps its surface as it was, so its centre and its right edge stay put. */
const short = plain.filter(([, r]) => (r.align === "none" || r.align === "left") && r.room < room(r) - 0.5);
check("every plain paragraph set from the left has the whole width of its box to set its words in (or the site's line length, where that is narrower)", plain.length > 0 && short.length === 0,
  `${plain.length} read; ${short.length} short, e.g. ${short.slice(0, 2).map(([id, r]) => `${id} ${r.room} of ${room(r)}`).join(", ")}`);
/*
 * Set from the left, the words start at the box's left edge: the box a capture
 * records is where the page set them. They were held 2px in, and against
 * share.xyz itself that put 70 runs 2px right of the page's; the inset now
 * sits outside the box. Centred and right-set words start where their
 * alignment puts them (tests/centred-text.mjs).
 */
/* A part whose own box centres its words across (a flex row or grid set to the middle, `applyLayout`) is not set from the left: the ledger's "No PnL data…" in its 1457px panel. */
const acrossMid = (id) => { const l = doc.nodes.find((n) => n.id === id)?.layout; const mid = (v) => v === "center" || v === "safe center"; return !!l && (l.display === "grid" ? mid(l.items) : l.display === "flex" ? (l.direction === "column" ? mid(l.align) : mid(l.justify)) : false); };
const moved = plain.filter(([id, r]) => (r.align === "none" || r.align === "left") && !acrossMid(id) && Math.abs(r.fromLeft) > 0.6);
check("…and words set from the left start at the box's left edge, where the page set them", moved.length === 0,
  moved.slice(0, 3).map(([id, r]) => `${id} at ${r.fromLeft}`).join(", ") || `all ${plain.length} at 0px`);
const byId = new Map(grown.nodes.map((n) => [n.id, n]));
/* The sentence rejoin widens the part it keeps to the whole line, on trunk too; those are left to it. */
const changed = Object.entries(read).filter(([id, r]) => { const n = byId.get(id); return n && !r.runs && (n.x !== r.x || n.w !== r.w); });
check("no paragraph's stored place or width changed", changed.length === 0, changed.slice(0, 3).map(([id]) => id).join(", "));
check("with no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
