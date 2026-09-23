/**
 * WHAT RECORDED PARENTAGE WOULD MOVE, AND BY HOW MUCH.
 *
 * A measurement, not a change. Point it at a document and it reports every
 * wrapper that does not sit where the parts it owns are — owning read off
 * `from.selector`, the DOM path the capture recorded, rather than off
 * geometry. Nothing is written.
 *
 *   node scripts/wrappers-report.mjs <path-to-document.json>
 *
 * The document is the `state` a Builder board saves, or the `site/document.json`
 * a publish commits — either shape is accepted.
 */
import { readFileSync } from "node:fs";
import { adrift, owned, pathOf } from "../src/features/studio/owns.ts";

const file = process.argv[2];
if (!file) { console.error("usage: node scripts/wrappers-report.mjs <document.json>"); process.exit(2); }
const raw = JSON.parse(readFileSync(file, "utf8"));
const doc = raw?.state ?? raw;
const nodes = doc?.nodes ?? [];
const pages = doc?.pages ?? [];
if (!nodes.length) { console.error("no nodes in that document"); process.exit(2); }

const words = (n) => {
  const c = n.content;
  return typeof c === "string" ? c : Array.isArray(c) ? c.map((r) => r?.text ?? "").join("") : "";
};
const bare = (n) => n.featureId === "box" && !words(n).trim() && !n.picture && !n.cube && !n.vector;

console.log(`document: ${file}`);
console.log(`  ${nodes.length} parts on ${pages.length || new Set(nodes.map((n) => n.pageId)).size} page(s)`);
const withPath = nodes.filter((n) => pathOf(n));
console.log(`  ${withPath.length} carry a recorded DOM path (${Math.round((withPath.length / nodes.length) * 100)}%)`);
if (withPath.length < nodes.length) console.log(`  — ${nodes.length - withPath.length} do not, and are invisible to this: drawn or placed rather than captured`);

const moves = adrift(nodes);
console.log(`\n${moves.length} wrapper(s) do not sit where the parts they own are.`);

const up = moves.filter((m) => m.dy < 0), down = moves.filter((m) => m.dy > 0), level = moves.filter((m) => m.dy === 0);
const sum = (xs, f) => xs.reduce((n, x) => n + f(x), 0);
console.log(`  by direction: ${up.length} would move UP (total ${sum(up, (m) => -m.dy)}px), ${down.length} DOWN (total ${sum(down, (m) => m.dy)}px), ${level.length} not at all`);
const grow = moves.filter((m) => m.dh > 0), shrink = moves.filter((m) => m.dh < 0);
console.log(`  by height:    ${grow.length} would GROW (total ${sum(grow, (m) => m.dh)}px), ${shrink.length} SHRINK (total ${sum(shrink, (m) => -m.dh)}px)`);
console.log(`  of those, ${moves.filter((m) => !m.touches).length} do not overlap their own contents AT ALL today`);
console.log(`  and ${moves.filter((m) => m.geo === 0).length} hold nothing geometrically — the empty wrappers`);
console.log(`  ${moves.filter((m) => bare(nodes.find((n) => n.id === m.id))).length} of them are bare boxes; the rest carry words or a drawing`);

const byPage = {};
for (const m of moves) (byPage[m.pageId] ??= []).push(m);
console.log(`\nper page:`);
for (const [pg, ms] of Object.entries(byPage).sort()) {
  const far = ms.filter((m) => !m.touches).length;
  console.log(`  ${pg.padEnd(18)} ${String(ms.length).padStart(3)} adrift, ${String(far).padStart(3)} clear of their contents, biggest move ${Math.max(...ms.map((m) => Math.abs(m.dy)))}px`);
}

console.log(`\nthe twenty largest moves:`);
for (const m of [...moves].sort((a, b) => Math.abs(b.dy) - Math.abs(a.dy)).slice(0, 20)) {
  const n = nodes.find((x) => x.id === m.id);
  console.log(`  ${m.id.padEnd(16)} ${m.pageId.padEnd(14)} ${String(m.at.w).padStart(5)}x${String(m.at.h).padStart(4)} at y ${String(m.at.y).padStart(5)}`
    + ` → y ${String(m.hold.y).padStart(5)} h ${String(m.hold.h).padStart(4)}   dy ${String(m.dy).padStart(6)}  dh ${String(m.dh).padStart(6)}`
    + `  owns ${String(m.hold.holds).padStart(3)}  holds ${String(m.geo).padStart(3)}${m.touches ? "" : "  CLEAR"}${bare(n) ? "  bare" : ""}`);
}

/*
 * AND THE SAFER RULE, measured beside the naive one.
 *
 * "Put the wrapper where its contents are" replaces its box with theirs, and
 * that STRIPS ITS PADDING: a box with 25px of it reads as 25px adrift and
 * 50px too tall. Most of what the naive rule reports is padding, not drift.
 *
 * The rule that is actually about the fault: GROW THE WRAPPER TO INCLUDE what
 * it owns, and never shrink it. Its own box is kept, the escaped content is
 * taken in, padding survives, and the move is only ever upward or taller —
 * one direction, which is what makes it checkable.
 */
const union = [];
for (const n of nodes) {
  const kids = owned(nodes, n);
  if (!kids.length) continue;
  const y = Math.min(n.y, ...kids.map((k) => k.y));
  const b = Math.max(n.y + n.h, ...kids.map((k) => k.y + k.h));
  const x = Math.min(n.x, ...kids.map((k) => k.x));
  const r = Math.max(n.x + n.w, ...kids.map((k) => k.x + k.w));
  const dy = y - n.y, dh = (b - y) - n.h, dx = x - n.x, dw = (r - x) - n.w;
  if (!dy && !dh && !dx && !dw) continue;
  union.push({ id: n.id, pageId: n.pageId, dy, dh, dx, dw, at: n.y, h: n.h, owns: kids.length, escapes: kids.filter((k) => k.y < n.y || k.y + k.h > n.y + n.h || k.x < n.x || k.x + k.w > n.x + n.w).length });
}
console.log(`\nGROW-ONLY, the safer rule: ${union.length} wrapper(s) would change, against ${moves.length} for the naive one.`);
console.log(`  every move is UP or TALLER, never down and never shorter — so nothing loses padding.`);
console.log(`  total lift ${sum(union, (u) => -u.dy)}px, total growth ${sum(union, (u) => u.dh)}px`);
console.log(`  the largest:`);
for (const u of [...union].sort((a, b) => (Math.abs(b.dy) + b.dh) - (Math.abs(a.dy) + a.dh)).slice(0, 12)) {
  console.log(`    ${u.id.padEnd(16)} ${u.pageId.padEnd(14)} h ${String(u.h).padStart(5)} at y ${String(u.at).padStart(5)}   dy ${String(u.dy).padStart(5)}  dh ${String(u.dh).padStart(5)}  dx ${String(u.dx).padStart(5)}  dw ${String(u.dw).padStart(5)}   owns ${String(u.owns).padStart(3)}, ${u.escapes} escaping`);
}

/* The page's tallest thing, against each column-shaped box, for the "the
   sidebar stops short" question: is a tall narrow box sized to its entries? */
console.log(`\ncolumn-shaped boxes (taller than wide, at least 4 owned parts):`);
const bottom = Math.max(...nodes.map((n) => n.y + n.h));
for (const n of nodes) {
  if (n.h <= n.w || n.h < 120) continue;
  const kids = owned(nodes, n);
  if (kids.length < 4) continue;
  const hold = { y: Math.min(...kids.map((k) => k.y)), b: Math.max(...kids.map((k) => k.y + k.h)) };
  console.log(`  ${n.id.padEnd(16)} ${n.pageId.padEnd(14)} ${n.w}x${n.h} at y ${n.y}, ends ${n.y + n.h}`
    + ` | its ${kids.length} parts span ${hold.y}..${hold.b} | page ends ${bottom}`
    + ` | short of the page by ${bottom - (n.y + n.h)}px, of its parts by ${hold.b - (n.y + n.h)}px`);
}
