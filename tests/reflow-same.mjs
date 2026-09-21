/**
 * The reflow is the one it was, until a part says how its inside is laid out.
 *
 * `placeNodes` used to stack every part into a column at any device narrower
 * than the frame, and a captured page — a header that is a row, a strip of
 * cards, each a container holding parts of its own — came out as a pile. A
 * node can now carry `layout`, and a node whose layout says flex or grid is
 * a container: the parts its box holds are placed inside its placed box,
 * squeezed with it, rather than queued under it.
 *
 * Two things are held here, pure, with no browser:
 *   · With no layout field anywhere the placement is byte for byte what the
 *     old algorithm gave. The old algorithm is written out below, as it was,
 *     and both are run over the published BLACKORB document at every device
 *     and over two hundred random boards.
 *   · With a container present the children stay inside it: a header row's
 *     logo and button keep their line at tablet width; a wrapping strip of
 *     cards wraps into lines and the strip grows to hold them; the parts
 *     under it move down by the growth.
 *
 *   node tests/reflow-same.mjs
 */
import { readFileSync } from "node:fs";
import { reflow, toRows } from "../src/features/studio/live/reflow.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* The algorithm as it stood at trunk 37d9ac3, kept as the reference    */
/* ------------------------------------------------------------------ */

const GROW_MAX = 4;
const FULL_BLEED = 0.9;
function toRowsThen(nodes) {
  const sorted = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const n of sorted) {
    const row = rows[rows.length - 1];
    if (row) {
      const bottom = Math.max(...row.map((r) => r.y + r.h));
      const top = Math.min(...row.map((r) => r.y));
      const overlap = Math.min(bottom, n.y + n.h) - Math.max(top, n.y);
      if (overlap > Math.min(n.h, bottom - top) * 0.34) {
        row.push(n);
        continue;
      }
    }
    rows.push([n]);
  }
  return rows.map((r) => [...r].sort((a, b) => a.x - b.x));
}
function frameHeightOf(nodes, min = 900) {
  const bottom = nodes.reduce((m, n) => Math.max(m, n.y + n.h), 0);
  return Math.max(min, bottom + 160);
}
function placeThen(nodes, target, frameWidth, aspectBound) {
  if (target >= frameWidth) {
    return { width: frameWidth, height: frameHeightOf(nodes), placed: nodes.map((n) => ({ node: n, x: n.x, y: n.y, w: n.w, h: n.h })), reflowed: false };
  }
  const gap = 12;
  const placed = [];
  let y = gap;
  for (const row of toRowsThen(nodes)) {
    for (const n of row) {
      const full = n.w >= frameWidth * FULL_BLEED;
      const w = full ? target : Math.min(n.w, target - gap * 2);
      const narrower = Math.min(GROW_MAX, Math.max(1, n.w / Math.max(1, w)));
      const h = aspectBound(n) ? (n.w > target ? Math.round(n.h * Math.min(1, target / n.w) * 1.15) : n.h) : Math.round(n.h * narrower);
      placed.push({ node: n, x: full ? 0 : Math.round((target - w) / 2), y: full && placed.length === 0 ? 0 : y, w, h });
      y = (full && placed.length === 1 ? 0 : y) + h + gap;
    }
  }
  return { width: target, height: Math.max(y + gap, 320), placed, reflowed: true };
}

/* ------------------------------------------------------------------ */
/* Same as it was                                                       */
/* ------------------------------------------------------------------ */

const rules = { fullBleed: FULL_BLEED, aspectBound: (n) => /^(orb-|hero-|picture|gallery|carousel)/.test(n.featureId) };
const same = (a, b) => JSON.stringify(a.placed.map((p) => [p.node.id, p.x, p.y, p.w, p.h])) === JSON.stringify(b.placed.map((p) => [p.node.id, p.x, p.y, p.w, p.h])) && a.width === b.width && a.height === b.height && a.reflowed === b.reflowed;

const DOC = JSON.parse(readFileSync("site/document.json", "utf8"));
check("toRows is the one it was", DOC.pages.every((pg) => JSON.stringify(toRows(DOC.nodes.filter((n) => n.pageId === pg.id)).map((r) => r.map((n) => n.id))) === JSON.stringify(toRowsThen(DOC.nodes.filter((n) => n.pageId === pg.id)).map((r) => r.map((n) => n.id)))));
for (const pg of DOC.pages) {
  const own = DOC.nodes.filter((n) => n.pageId === pg.id);
  for (const [device, target] of [["desktop", DOC.frameWidth], ["tablet", 834], ["phone", 390]]) {
    check(`${DOC.brief.name} · ${pg.name} at ${device}: ${own.length} parts land exactly where they did`, same(reflow(own, target, DOC.frameWidth, rules), placeThen(own, target, DOC.frameWidth, rules.aspectBound)));
  }
}

/* Random boards, deterministic. */
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const KINDS = ["prose", "value-prop", "cta-primary", "picture", "hero-split", "card-grid", "box", "custom-idea", "sticky-header"];
let differ = 0;
for (let b = 0; b < 200; b++) {
  const fw = [1440, 1763, 1280][b % 3];
  const n = 5 + Math.floor(rnd() * 16);
  const nodes = Array.from({ length: n }, (_, i) => {
    const w = 80 + Math.floor(rnd() * (fw - 80));
    return { id: `n${i}`, pageId: "p", featureId: KINDS[Math.floor(rnd() * KINDS.length)], x: Math.floor(rnd() * (fw - w)), y: Math.floor(rnd() * 3000), w, h: 24 + Math.floor(rnd() * 500) };
  });
  for (const target of [fw, 1440, 834, 390]) if (!same(reflow(nodes, target, fw, rules), placeThen(nodes, target, fw, rules.aspectBound))) differ++;
}
check("two hundred random boards, four widths each: the same placement every time", differ === 0, `${differ} differed`);

/* ------------------------------------------------------------------ */
/* Obeyed when a part says                                              */
/* ------------------------------------------------------------------ */

const at = (placed, id) => placed.find((p) => p.node.id === id);
const FW = 1763;
const header = { id: "hdr", featureId: "box", x: 0, y: 0, w: FW, h: 82, layout: { display: "flex", direction: "row", align: "center", justify: "space-between", gap: 12 }, pad: { top: 16, right: 24, bottom: 16, left: 24 } };
const logo = { id: "logo", featureId: "prose", x: 24, y: 21, w: 200, h: 40 };
const button = { id: "cta", featureId: "cta-primary", x: 1539, y: 21, w: 200, h: 40 };
const strip = { id: "cards", featureId: "box", x: 0, y: 120, w: FW, h: 232, layout: { display: "flex", direction: "row", wrap: true, gap: 16 }, pad: { top: 16, right: 24, bottom: 16, left: 24 } };
const cards = [0, 1, 2].map((i) => ({ id: `card${i}`, featureId: "custom-idea", x: 24 + i * 572, y: 136, w: 556, h: 200 }));
const after = { id: "foot", featureId: "prose", x: 24, y: 400, w: 1715, h: 60 };
const board = [header, logo, button, strip, ...cards, after];

const desk = reflow(board, FW, FW, rules);
check("at the frame's own width nothing moves, containers or not", !desk.reflowed && desk.placed.every((p) => p.x === p.node.x && p.y === p.node.y && p.w === p.node.w && p.h === p.node.h));

const tab = reflow(board, 834, FW, rules);
const th = at(tab.placed, "hdr"), tl = at(tab.placed, "logo"), tb = at(tab.placed, "cta");
check("at tablet width the header row is placed full bleed as before", !!th && th.x === 0 && th.w === 834 && th.y === 0, th ? `${th.x},${th.y} ${th.w}×${th.h}` : "not placed");
check("and its logo and button stay on its line, inside it, squeezed with it", !!tl && !!tb && tl.y === th.y + 21 && tb.y === th.y + 21 && tl.x >= th.x && tb.x + tb.w <= th.x + th.w + 1 && tb.x > tl.x + tl.w, tl && tb ? `logo ${tl.x},${tl.y} ${tl.w}×${tl.h} · button ${tb.x},${tb.y} ${tb.w}×${tb.h}` : "not placed");
check("the pile is gone: the children are not queued under the header", !!tl && !!tb && !(tl.y >= th.y + th.h) && !(tb.y >= th.y + th.h));
check("a container keeps its height rather than growing like narrowed text", !!th && th.h === 82, th ? `${th.h}` : "-");

const ts = at(tab.placed, "cards"), tc = cards.map((c) => at(tab.placed, c.id));
check("a wrapping strip of cards wraps its cards into lines at their own width: one to a line where two do not fit", tc.every(Boolean) && tc[1].y > tc[0].y && tc[2].y > tc[1].y && tc.every((c) => c.x === tc[0].x), tc.map((c) => c ? `${c.x},${c.y} ${c.w}×${c.h}` : "-").join(" · "));
check("each card keeps its own width where it fits, or the strip's", tc.every((c) => c && c.w <= 834 - 48 && c.w >= 500), tc.map((c) => c?.w).join(", "));
check("and the strip grows to hold the lines", !!ts && ts.h > 232 && tc.every((c) => c.y >= ts.y && c.y + c.h <= ts.y + ts.h), ts ? `${ts.h} tall` : "-");
const tf = at(tab.placed, "foot");
check("what comes after moves down by the growth", !!tf && !!ts && tf.y >= ts.y + ts.h, tf && ts ? `foot at ${tf.y}, strip ends ${ts.y + ts.h}` : "-");
check("and the page is as tall as its last part", tab.height >= tf.y + tf.h);

const ph = reflow(board, 390, FW, rules);
const pc = cards.map((c) => at(ph.placed, c.id));
check("at phone width the cards are one to a line, each as wide as the strip allows", pc.every((c) => c && c.w === 390 - 48) && pc[1].y > pc[0].y && pc[2].y > pc[1].y, pc.map((c) => c ? `${c.x},${c.y} ${c.w}` : "-").join(" · "));

/* A nested container: a row inside the header, squeezed with it. */
const nest = [
  header,
  { id: "links", featureId: "box", x: 600, y: 16, w: 560, h: 50, layout: { display: "flex", direction: "row", gap: 24 } },
  { id: "l1", featureId: "prose", x: 600, y: 26, w: 100, h: 30 },
  { id: "l2", featureId: "prose", x: 830, y: 26, w: 100, h: 30 },
  { id: "l3", featureId: "prose", x: 1060, y: 26, w: 100, h: 30 },
];
const nt = reflow(nest, 834, FW, rules);
const nl = at(nt.placed, "links"), n1 = at(nt.placed, "l1"), n3 = at(nt.placed, "l3");
check("a row inside the header is squeezed with it and keeps its own children on the line", !!nl && !!n1 && !!n3 && nl.y === 16 && n1.y === 26 && n3.y === 26 && n1.x >= nl.x && n3.x + n3.w <= nl.x + nl.w + 1 && n3.x > n1.x, nl && n1 && n3 ? `row ${nl.x} ${nl.w} · l1 ${n1.x} · l3 ${n3.x}` : "not placed");

/* Grid: columns squeeze in proportion. */
const grid = [
  { id: "g", featureId: "box", x: 0, y: 0, w: FW, h: 300, layout: { display: "grid", columns: 4, gap: 16 } },
  ...[0, 1, 2, 3].map((i) => ({ id: `cell${i}`, featureId: "custom-idea", x: 24 + i * 430, y: 24, w: 414, h: 252 })),
];
const gt = reflow(grid, 834, FW, rules);
const gc = [0, 1, 2, 3].map((i) => at(gt.placed, `cell${i}`));
check("a grid's cells share its line in proportion", gc.every((c) => c && c.y === 24) && gc[3].x + gc[3].w <= 834 + 1 && gc[1].x > gc[0].x + gc[0].w - 1, gc.map((c) => c ? `${c.x} ${c.w}` : "-").join(" · "));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
