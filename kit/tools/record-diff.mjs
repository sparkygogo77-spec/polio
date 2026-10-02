#!/usr/bin/env node
// Checks a build against its design record (DESIGN-RECORD.md): a look-only capture of the built page
// against design/record.json, part by part, matched by hook. No dependencies.
//
//   node tools/record-diff.mjs design/record.json built-capture.json [--page web/index.html] [--px 4]
//
// Lists each hooked part the record has that the build does not draw, and each whose size, place
// (relative to the page's first hooked part), colour, background or type size differs by more than
// the tolerance. Parts the record marks hidden, and empty ones (1px in the builder), are skipped when
// the build does not draw them.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Any record, or a bare capture route file, as `{ pages: [...] }`. */
export function readRecord(json) {
  if (json && json.tree) return { record: 1, source: 'capture', pages: [json] };
  return json;
}

/**
 * The box as drawn: a capture keeps each box before its transforms, with the page matrix it sits under in
 * `ptf` (a b c d e f); the builder's boxes are already as drawn. A turned part's drawn box holds its corners.
 */
export function drawnBox(n) {
  const m = n.ptf;
  if (!Array.isArray(m) || m.length !== 6) return { x: n.x, y: n.y, w: n.w, h: n.h };
  const [a, b, c, d, e, f] = m;
  const pts = [[n.x, n.y], [n.x + n.w, n.y], [n.x, n.y + n.h], [n.x + n.w, n.y + n.h]].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(Math.max(...xs) - x), h: Math.round(Math.max(...ys) - y) };
}

/** Every hooked part of a page, by hook, with its box as drawn. A capture names hooks as `hook` (or not at all). */
export function partsByHook(page) {
  const out = new Map();
  const walk = (n) => {
    if (!n) return;
    if (n.hook && !out.has(n.hook)) out.set(n.hook, { ...n, ...drawnBox(n) });
    for (const k of n.kids ?? []) walk(k);
  };
  walk(page.tree);
  return out;
}

const rgb = (c) => {
  if (typeof c !== 'string') return null;
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) { const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return a === 0 ? 'none' : `${r},${g},${b}`; }
  const h = c.match(/^#([0-9a-f]{6})$/i);
  if (h) return [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16)).join(',');
  return c.trim();
};

export function recordDiff(design, built, { page = null, px = 4 } = {}) {
  const d = readRecord(design);
  const b = readRecord(built);
  const pick = (r) => (page ? r.pages.find((p) => p.file === page || (p.url ?? '').endsWith(page)) : r.pages[0]);
  const dp = pick(d);
  const bp = pick(b) ?? b.pages[0];
  if (!dp) return { differ: [{ hook: '(page)', why: `the record has no page ${page}` }], same: 0, checked: 0 };
  const want = partsByHook(dp);
  const got = partsByHook(bp);
  /* Places are compared from each page's first part both have, so a frame offset is not a difference. */
  const anchor = [...want.keys()].find((h) => got.has(h));
  const o = (m, h) => (anchor ? { x: m.get(anchor).x, y: m.get(anchor).y } : { x: 0, y: 0 });
  const od = o(want), ob = o(got);
  const differ = [];
  let same = 0;
  for (const [hook, w] of want) {
    const g = got.get(hook);
    const hidden = w.states?.hidden?.hidden === true;
    /* An empty part draws nothing: the builder keeps it 1px wide or tall, a capture leaves it out. */
    const empty = Math.min(w.w, w.h) <= 1 && !w.text;
    if (!g) { if (!hidden && !empty) differ.push({ hook, why: `not drawn in the build (${w.w}×${w.h} in the record)` }); continue; }
    if (hidden) continue;
    const why = [];
    const near = (a, c) => Math.abs(a - c) <= px;
    if (!near(w.w, g.w) || !near(w.h, g.h)) why.push(`size ${w.w}×${w.h} in the record, ${g.w}×${g.h} built`);
    if (!near(w.x - od.x, g.x - ob.x) || !near(w.y - od.y, g.y - ob.y)) why.push(`place ${w.x - od.x},${w.y - od.y} in the record, ${g.x - ob.x},${g.y - ob.y} built`);
    for (const [k, say] of [['color', 'colour'], ['bg', 'background']]) if (w[k] && g[k] && rgb(w[k]) !== rgb(g[k])) why.push(`${say} ${w[k]} in the record, ${g[k]} built`);
    if (w.fs && g.fs && Math.abs(w.fs - g.fs) > 0.5) why.push(`type size ${w.fs} in the record, ${g.fs} built`);
    if (why.length) differ.push({ hook, why: why.join('; ') }); else same++;
  }
  return { differ, same, checked: want.size };
}

if (import.meta.url === new URL(`file://${resolve(process.argv[1] ?? '')}`).href) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const files = args.filter((a, i) => !a.startsWith('--') && !['--page', '--px'].includes(args[i - 1]));
  if (files.length < 2) { console.log('usage: node tools/record-diff.mjs design/record.json built-capture.json [--page <file>] [--px 4]'); process.exit(2); }
  const [design, built] = files.map((f) => JSON.parse(readFileSync(f, 'utf8')));
  const r = recordDiff(design, built, { page: opt('--page'), px: Number(opt('--px') ?? 4) });
  for (const x of r.differ) console.log(`  ✗ ${x.hook}: ${x.why}`);
  console.log(r.differ.length ? `record-diff: ${r.differ.length} of ${r.checked} parts differ from the record` : `record-diff passed: ${r.same} parts drawn as the record says (${r.checked - r.same} hidden there)`);
  process.exit(r.differ.length ? 1 : 0);
}
