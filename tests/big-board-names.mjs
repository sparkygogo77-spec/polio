#!/usr/bin/env node
/**
 * A BIG CAPTURE IS NAMED IN A MOMENT, AND NAMED THE SAME.
 *
 * J (2026-10-10), sunkcoin.fun brought in: "Page Unresponsive". Its home
 * page is 2,300 parts, and the board named every one of them by asking,
 * for each part, what every other part holds and which heading sits in
 * each holder: billions of comparisons, twenty seconds of a frozen Builder.
 * `partNames.ts` now reads a list once (each page's parts, what each box
 * holds, its first heading) and keeps that beside the list.
 *
 *   1. every part of the saved PST board is named exactly as the reading
 *      part by part names it (the code before, kept below as `slow`);
 *   2. so is every part of a 2,400-part board built from it;
 *   3. and naming all 2,400 takes under a second, half the time or
 *      less of naming them part by part.
 *
 *   node tests/big-board-names.mjs
 *
 * Covers: src/features/studio/partNames.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { boardDoc, readBoard } from "./lib/board.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { partName, isHeadingish, wordsOf, kindOf, isMachineLabel, computedAs } = await jiti.import(join(here, "..", "src", "features", "studio", "partNames.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* ---------------------------------------- the reading part by part, as it was */
const clip = (s, max = 40) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const contains = (a, b) => (a.x ?? 0) <= (b.x ?? 0) + 1 && (a.y ?? 0) <= (b.y ?? 0) + 1 && (a.x ?? 0) + (a.w ?? 0) >= (b.x ?? 0) + (b.w ?? 0) - 1 && (a.y ?? 0) + (a.h ?? 0) >= (b.y ?? 0) + (b.h ?? 0) - 1;
const within = (box, all) => all.filter((m) => m.id !== box.id && (!box.pageId || m.pageId === box.pageId) && contains(box, m) && (m.w ?? 0) * (m.h ?? 0) < (box.w ?? 0) * (box.h ?? 0)).sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
const firstHeading = (box, all) => { const h = within(box, all).find(isHeadingish); return h ? clip(wordsOf(h)) : null; };
const ownTitle = (box, all) => { const inside = within(box, all); if (!inside.length) return null; const h = inside.find(isHeadingish) ?? inside.find((m) => !!wordsOf(m)); return h ? clip(wordsOf(h)) : null; };
const LANDMARKS = new Set(["Section", "Header", "Footer", "Menu", "Page body", "Form", "List"]);
function sectionOf(n, all) {
  const page = all.filter((m) => m.id !== n.id && (!n.pageId || m.pageId === n.pageId));
  if (!page.some(isHeadingish)) return null;
  const holders = page.filter((m) => contains(m, n) && (m.w ?? 0) * (m.h ?? 0) > (n.w ?? 0) * (n.h ?? 0)).sort((a, b) => (a.w * a.h) - (b.w * b.h));
  for (const box of holders) { const h = firstHeading(box, all); if (h) return h; }
  const above = page.filter((h) => isHeadingish(h) && (h.y ?? 0) <= (n.y ?? 0)).sort((a, b) => (b.y ?? 0) - (a.y ?? 0));
  return above.length ? clip(wordsOf(above[0])) : null;
}
function slow(n, all) {
  if (!isMachineLabel(n.label)) return clip(n.label.trim(), 60);
  const words = wordsOf(n);
  if (words) return clip(words);
  const as = computedAs(n.prompt);
  const kind = kindOf(n);
  if (as?.name) return clip(`${kind} “${as.name}”`);
  const alt = n.picture?.alt?.trim();
  if (alt) return clip(`${kind} “${alt}”`);
  const title = ownTitle(n, all);
  if (title) return clip(`${kind} “${title}”`, 60);
  if (LANDMARKS.has(kind)) return kind;
  const section = sectionOf(n, all);
  return section ? clip(`${kind} in “${section}”`, 60) : kind;
}

/* ---------------------------------------- 1. the saved PST board */
const doc = boardDoc(readBoard("pst"));
const pst = doc.nodes;
const diff = pst.filter((n) => partName(n, pst) !== slow(n, pst));
check(`every one of PST's ${pst.length} parts is named as before`, diff.length === 0, diff.slice(0, 3).map((n) => `${n.id}: ${partName(n, pst)} ≠ ${slow(n, pst)}`).join("; "));
const page = pst.filter((n) => n.pageId === pst[0].pageId);
const diffPage = page.filter((n) => partName(n, page) !== slow(n, page));
check("…and as before when handed one page's parts", diffPage.length === 0, `${diffPage.length} differ`);

/* ---------------------------------------- 2 and 3. a board as big as sunkcoin.fun's */
const home = pst.filter((n) => n.pageId === pst[0].pageId && !n.state);
const height = Math.max(...home.map((n) => (n.y ?? 0) + (n.h ?? 0))) + 40;
const big = [];
/* Named as a capture names its boxes ("div · 1 inside"), so each is named by what it holds or the section it sits in: the slow road. */
for (let k = 0; big.length < 2400; k++) for (const n of home) big.push({ ...n, id: `${n.id}_${k}`, y: (n.y ?? 0) + k * height, ...(wordsOf(n) ? {} : { label: "div · 1 inside", picture: null, prompt: "" }) });
big.length = 2400;
const t0 = performance.now();
const names = big.map((n) => partName(n, big));
const took = performance.now() - t0;
const t1 = performance.now();
const before = big.map((n) => slow(n, big));
const slowTook = performance.now() - t1;
check(`naming all ${big.length} parts of a big board takes under 1 s, half the time part by part or less`, took < 1000 && took * 2 < slowTook, `${took.toFixed(0)} ms, part by part ${slowTook.toFixed(0)} ms`);
check("…and names every one as before", names.every((s, i) => s === before[i]), `${names.filter((s, i) => s !== before[i]).length} differ`);
check("…every one of them a name", names.every((s) => typeof s === "string" && s.length > 0));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? "FAILED" : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
