#!/usr/bin/env node
/**
 * WORDS BETWEEN PARTS ARE NUMBERED WITHIN THEIR OWN BOX.
 *
 * The tablet and phone boxes are matched to desktop parts by kind and
 * selector (the zip route's `kind|selector#n`), and a line's selector is
 * its holder's path and a number. Counted across the whole page, one line
 * a media query drops anywhere above moved every later line's number, so
 * at phone width they took another line's words or came back hidden:
 * PonsStars' redesign Play matched 0 of 17 lines at 390 (J, 2026-10-11).
 * Numbered within their box, a later block's lines still find their own.
 *
 *   node tests/lines-per-holder.mjs
 */
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { launch } from "./fixtures/look-sites.mjs";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.setContent(`<!doctype html><html><head><style>
  body { margin: 0; font: 16px Arial; }
  @media (max-width: 600px) { .extra { display: none; } }
</style></head><body>
<div class="extra">Lead words <b>x</b><p>block</p></div>
<section class="later">Words before the block <b>bold</b><p>A block child</p>more words after it</section>
</body></html>`);
const wide = await page.evaluate(PARTS, 1500);
await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(150);
const narrow = await page.evaluate(PARTS, { cap: 1500, lean: true });
await browser.close();

/* The route's key (zip/route.ts, `atWidths`): kind and selector, and which of that pair it is. */
const keyed = (parts) => {
  const seen = new Map();
  return new Map(parts.map((p) => { const k = `${p.kind}|${p.selector}`; const i = seen.get(k) ?? 0; seen.set(k, i + 1); return [`${k}#${i}`, p]; }));
};
const isLine = (p) => / ::line\(/.test(p.selector ?? "");
const small = keyed(narrow.parts);
const later = [...keyed(wide.parts)].filter(([, p]) => isLine(p) && !p.hidden && /Words before|words after/.test(p.words ?? ""));
check("the later block has its two lines at 1440", later.length === 2, JSON.stringify(later.map(([k, p]) => [k, p.words])));
for (const [k, p] of later) {
  const q = small.get(k);
  check(`"${p.words}" finds its own line at 390`, !!q && !q.hidden && q.words === p.words, JSON.stringify({ key: k, got: q && { words: q.words, hidden: q.hidden } }));
}
const once = (read) => { const s = read.parts.filter(isLine).map((p) => p.selector); return s.length === new Set(s).size; };
check("no line selector repeats at 1440", once(wide), JSON.stringify(wide.parts.filter(isLine).map((p) => p.selector)));
check("no line selector repeats at 390", once(narrow), JSON.stringify(narrow.parts.filter(isLine).map((p) => p.selector)));
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
