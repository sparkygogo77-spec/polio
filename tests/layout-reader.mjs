#!/usr/bin/env node
/**
 * THE LAYOUT READER SAYS A BOARD AS ROWS, COLUMNS AND GRIDS, AND THE FLOW PUTS EVERY PART BACK WHERE IT WAS.
 *
 * Every part on a board is placed at an x and a y. The new export (Next.js
 * and Tailwind) and the layout tidy need the same parts said as flow
 * (docs: handovers/CREATE-SYSTEM-PROPOSAL.md, "Layout reading" and "(d)
 * Export"). `src/features/studio/layout/read.ts` reads that from the boxes
 * alone; `draw.ts` draws the tree with flex and grid and nothing else
 * placed; this test draws it in a real browser and measures how far each
 * part lands from its board box.
 *
 *   1. a made-up board, read exactly: two sections under the page body; a
 *      centred column with one gap of 24; three buttons with no box of
 *      their own read as a row with a gap of 24; six cards read as a grid
 *      of three columns, 40 apart both ways; the picture behind the hero
 *      and the part fixed to the window kept placed, each with its reason;
 *      grouped + placed is every part;
 *   2. drawn with flex and grid, every part of it lands within half a pixel;
 *   3. a captured site (share-xyz, the newest fixtures in capture/): most parts grouped, most
 *      within 2px, the counts add up, and each placed part says why.
 *      More capture folders can be given in LAYOUT_SITES (comma separated);
 *      each prints its share grouped and its px error, and is held to the
 *      same floors.
 *
 * No server:
 *
 *   node tests/layout-reader.mjs
 *   LAYOUT_SITES=capture/sites/thesolface3,capture/sites/mochi3 node tests/layout-reader.mjs
 *   LAYOUT_DUMP=out/ node tests/layout-reader.mjs     # also write each site's tree as text
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src", "features", "studio");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { readLayout } = await jiti.import(join(src, "layout", "read.ts"));
const { drawLayout } = await jiti.import(join(src, "layout", "draw.ts"));
const { dumpLayout } = await jiti.import(join(src, "layout", "dump.ts"));

/* ------------------------------------------------------------ 1. a made-up board */
const P = "page_home";
const part = (id, x, y, w, h, selector, more = {}) => ({ id, pageId: P, x, y, w, h, from: { selector }, ...more });
const S1 = "body > main > section:nth-of-type(1)", S2 = "body > main > section:nth-of-type(2)";
const board = [
  part("n_main", 0, 0, 1440, 1400, "body > main"),
  part("n_hero", 0, 0, 1440, 600, S1),
  part("n_bg", 0, 0, 1440, 600, `${S1} > img`),
  part("n_h1", 320, 80, 800, 60, `${S1} > h1`),
  part("n_p", 420, 164, 600, 48, `${S1} > p`),
  part("n_b1", 456, 236, 160, 48, `${S1} > a:nth-of-type(1)`),
  part("n_b2", 640, 236, 160, 48, `${S1} > a:nth-of-type(2)`),
  part("n_b3", 824, 236, 160, 48, `${S1} > a:nth-of-type(3)`),
  part("n_fixed", 1340, 20, 80, 40, `${S1} > button`, { from: { selector: `${S1} > button`, position: "fixed" } }),
  part("n_cards", 0, 600, 1440, 800, S2),
];
for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
  const x = 140 + c * 400, y = 680 + r * 340, i = r * 3 + c + 1;
  board.push(part(`n_card${i}`, x, y, 360, 300, `${S2} > div:nth-of-type(${i})`));
  board.push(part(`n_title${i}`, x + 24, y + 24, 312, 32, `${S2} > div:nth-of-type(${i}) > h3`));
}

const t = readLayout(board, { pageId: P, width: 1440 });
const find = (flow, id) => {
  for (const it of flow.items) { if (it.id === id) return it; const f = it.flow && find(it.flow, id); if (f) return f; }
  for (const p of flow.placed) { if (p.id === id) return p; const f = p.flow && find(p.flow, id); if (f) return f; }
  return null;
};
check("1 two sections under the page body", t.sections.map((s) => s.id).join(" ") === "n_hero n_cards", t.sections.map((s) => s.id).join(" "));
const hero = find(t.root, "n_hero")?.flow;
check("1 the hero is a centred column with one gap of 24", hero?.direction === "column" && hero?.align === "center" && Math.abs((hero?.gap ?? 0) - 24) < 0.01 && hero.items.every((i) => !i.before), JSON.stringify({ d: hero?.direction, a: hero?.align, g: hero?.gap }));
const row = hero?.items.find((i) => i.part == null)?.flow;
check("1 the three buttons with no box of their own are a row, 24 apart", row?.direction === "row" && Math.abs((row?.gap ?? 0) - 24) < 0.01 && row.items.map((i) => i.id).join(" ") === "n_b1 n_b2 n_b3", JSON.stringify({ d: row?.direction, g: row?.gap, ids: row?.items.map((i) => i.id) }));
check("1 every width is a max-width", hero?.items.find((i) => i.id === "n_h1")?.maxWidth === 800);
const cards = find(t.root, "n_cards")?.flow;
check("1 six cards are a grid of three columns, 40 apart both ways", cards?.display === "grid" && cards.columns?.join(",") === "360,360,360" && cards.gap === 40 && cards.rowGap === 40 && cards.items.length === 6, JSON.stringify({ d: cards?.display, c: cards?.columns, g: cards?.gap, r: cards?.rowGap }));
const why = Object.fromEntries(t.placed.map((p) => [p.id, p.why]));
check("1 the picture behind the hero is kept placed, saying what it is over", /^over n_h1/.test(why.n_bg ?? ""), why.n_bg);
check("1 the part fixed to the window is kept placed, and says so", why.n_fixed === "fixed to the window", why.n_fixed);
check("1 only those two are placed, and grouped + placed is every part", t.counts.placed === 2 && t.counts.grouped + t.counts.placed === board.length, JSON.stringify(t.counts));
check("1 each section counts what it holds", t.sections[0].placed === 2 && t.sections[0].grouped === 6 && t.sections[1].grouped === 13 && t.sections[1].placed === 0, JSON.stringify(t.sections));
check("1 the dump says it in words", /grid 3 columns \[360 360 360\] gap 40 row gap 40/.test(dumpLayout(t)) && /placed n_fixed .* — fixed to the window/.test(dumpLayout(t)));

/* ------------------------------------------------------------ the browser half */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

/** Draw the tree with flex and grid, and measure each part against its board box. */
async function relayout(nodes, pageId, width) {
  const tree = readLayout(nodes, { pageId, width });
  await page.setContent(drawLayout(tree), { waitUntil: "load" });
  const got = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-part]")].map((e) => {
    const r = e.getBoundingClientRect();
    return [e.getAttribute("data-part"), [r.x + scrollX, r.y + scrollY, r.width, r.height]];
  })));
  const placed = new Set(tree.placed.map((p) => p.id)), states = new Set(tree.states);
  const errs = nodes.filter((n) => n.pageId === pageId && !states.has(n.id)).map((n) => {
    const g = got[n.id];
    const e = g ? Math.max(Math.abs(g[0] - n.x), Math.abs(g[1] - n.y), Math.abs(g[2] - Math.max(0, n.w)), Math.abs(g[3] - Math.max(0, n.h))) : Infinity;
    return { id: n.id, e, placed: placed.has(n.id) };
  });
  return { tree, errs };
}
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const r1 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : v);

/* 2 */
const made = await relayout(board, P, 1440);
const worst = made.errs.reduce((a, b) => (b.e > a.e ? b : a));
check("2 drawn with flex and grid, every part of the made-up board lands within half a pixel", worst.e <= 0.5, `worst ${worst.id} ${r1(worst.e)}px`);

/* 3 */
const SINK = process.env.LAYOUT_SINK ?? join(here, "..", "capture");
const sites = [join(SINK, "sites", "share-xyz"), ...(process.env.LAYOUT_SITES ?? "").split(",").map((s) => s.trim()).filter(Boolean).map((s) => resolve(s))];
const DUMP = process.env.LAYOUT_DUMP;
if (DUMP) mkdirSync(DUMP, { recursive: true });
for (const dir of sites) {
  const file = join(dir, "site", "document.json");
  if (!existsSync(file)) { check(`3 ${basename(dir)}: its capture is here`, false, `${file} missing (npm run capture:fixtures)`); continue; }
  const doc = JSON.parse(readFileSync(file, "utf8"));
  const pageId = doc.nodes.some((n) => n.pageId === "page_home") ? "page_home" : doc.nodes[0]?.pageId;
  const width = doc.frameWidth ?? 1440;
  const { tree, errs } = await relayout(doc.nodes, pageId, width);
  const c = tree.counts, name = basename(dir);
  const share = c.grouped / c.parts;
  const all = errs.map((e) => e.e), grouped = errs.filter((e) => !e.placed).map((e) => e.e);
  const within = (xs, d) => xs.filter((e) => e <= d).length / Math.max(1, xs.length);
  const bad = errs.filter((e) => e.e > 2).sort((a, b) => b.e - a.e);
  console.log(`       ${name} at ${width}: ${c.parts} parts, ${c.grouped} grouped (${r1(share * 100)}%), ${c.placed} placed, ${c.states} shown only on a press (not counted); ` +
    `within 2px ${r1(within(all, 2) * 100)}% (grouped ${r1(within(grouped, 2) * 100)}%), within 4px ${r1(within(all, 4) * 100)}%; ` +
    `error median ${r1(q(all, 0.5))}px, p95 ${r1(q(all, 0.95))}px, max ${r1(Math.max(...all))}px`);
  if (bad.length) console.log(`       ${name} worst: ${bad.slice(0, 8).map((b) => `${b.id}${b.placed ? " (placed)" : ""} ${r1(b.e)}px`).join(", ")}`);
  /* How clean the flow is: what an export would write beyond gap, padding and align. */
  const k = { flows: 0, grids: 0, rows: 0, made: 0, oneGap: 0, items: 0, before: 0, offset: 0, self: 0, minHeight: 0 };
  const walk = (f) => {
    if (!f) return;
    k.flows++; if (f.display === "grid") k.grids++; else if (f.direction === "row") k.rows++;
    if (f.items.length > 1 && f.items.every((i, n) => n === 0 || !i.before)) k.oneGap++;
    if (f.minHeight != null) k.minHeight++;
    for (const i of f.items) { k.items++; if (!i.part) k.made++; if (i.before) k.before++; if (i.offset > 0.5) k.offset++; if (i.self) k.self++; walk(i.flow); }
    for (const p of f.placed) walk(p.flow);
  };
  walk(tree.root);
  console.log(`       ${name} flow: ${k.flows} flows (${k.rows} rows, ${k.grids} grids, ${k.made} made-up groups), ${k.oneGap} said with one gap; of ${k.items} items ${k.before} say their own space before, ${k.offset} an offset, ${k.self} their own align; ${k.minHeight} rows need a min-height`);
  const whys = {};
  for (const p of tree.placed) { const k = p.why.replace(/^over .*/, "over another part"); whys[k] = (whys[k] ?? 0) + 1; }
  console.log(`       ${name} placed because: ${Object.entries(whys).map(([k, v]) => `${v} ${k}`).join("; ") || "none"}`);
  if (DUMP) writeFileSync(join(DUMP, `${name}.txt`), dumpLayout(tree, (id) => doc.nodes.find((n) => n.id === id)?.label ?? "") +
    `\n\nERRORS over 2px\n${bad.map((b) => `${b.id}${b.placed ? " (placed)" : ""} ${r1(b.e)}px`).join("\n")}\n`);
  check(`3 ${name}: grouped + placed is every part, and each placed part says why`, c.grouped + c.placed === c.parts && tree.placed.every((p) => p.why), JSON.stringify(c));
  check(`3 ${name}: most parts are grouped (at least 80%)`, share >= 0.8, `${r1(share * 100)}%`);
  check(`3 ${name}: most parts land within 2px of their board box (at least 90%)`, within(all, 2) >= 0.9, `${r1(within(all, 2) * 100)}%`);
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
