#!/usr/bin/env node
/**
 * VARIATIONS WITH TASTE (J, 2026-10-25): a variation a designer would call
 * better, not just different. Pure: no browser, no server, no Claude.
 *
 * For each capture given, many local rolls across every mix of aims:
 *   - AA kept: every words part that read at 4.5 to 1 on what is behind it
 *     still does, and the words colours read on the page and its surface;
 *   - its type scale is one of 1.2, 1.25 or 1.333, and every type size is
 *     base × ratio^n of it;
 *   - its spacing is on the 4/8 grid (step 4 or 8, every space token a
 *     whole number of 4), its corners too (pills and 0 aside);
 *   - its corners and shadows agree (square is flat; pills are never lifted);
 *   - locks are respected: a locked layer is the same choice and the same
 *     tokens; a locked layer with nothing to keep it from stays as the
 *     original has it; the original's document never changes;
 * and "Ask Claude for 4", with Claude's answer stubbed:
 *   - the ask carries the System, the layout tree, the aims and the locks;
 *   - 4 directions, each named in plain words, locked layers kept;
 *   - every two directions differ by more than DIRECTION_GAP, even when the
 *     answer gives two that are nearly the same;
 *   - off-grid or off-scale answers land on the grid and the scale;
 *   - word changes are suggestions only: none is put in until accepted.
 *
 *   node tests/variations-taste.mjs capture/sites/thesolface3 capture/sites/mochi3 …
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { prepare, build } from "../src/features/studio/variations/make.ts";
import { rollSpec, LAYERS, RATIOS, GRID, specDistance, DIRECTION_GAP, directionName } from "../src/features/studio/variations/model.ts";
import { tokenValues } from "../src/features/studio/variations/tokens.ts";
import { readAnswer, askText } from "../src/features/studio/better/prompt.ts";
import { askFor } from "../src/features/studio/variations/ask.ts";
import { landPalette } from "../src/features/studio/paletteFrom.ts";
import { paletteFromHue } from "../src/features/studio/look/index.ts";
import { oklchOf, rgbOf, contrastRgb } from "../src/features/studio/siteTheme.ts";

const SITES = process.argv.slice(2);
if (!SITES.length || SITES.some((s) => !existsSync(join(s, "site/document.json")))) {
  console.error("usage: node tests/variations-taste.mjs <capture folder> [more …]");
  process.exit(2);
}
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* What a visitor reads: each words part, its colour, and the opaque colour behind it. */
const rgb = (css) => { const o = typeof css === "string" ? oklchOf(css) : null; return o && o.alpha >= 0.999 ? rgbOf(o) : null; };
const words = (n) => (typeof n.content === "string" ? n.content : Array.isArray(n.content) ? n.content.map((s) => s?.text ?? "").join("") : "").trim();
function readPairs(nodes, pageBg) {
  const out = new Map();
  const filled = nodes.map((m) => ({ m, bg: rgb(m.colour?.bg) })).filter((f) => f.bg);
  for (const n of nodes) {
    const fg = rgb(n.colour?.text);
    if (!fg || !words(n)) continue;
    let bg = rgb(n.colour?.bg);
    if (!bg) {
      const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
      let best = null;
      for (const f of filled) {
        const m = f.m;
        if (m === n || m.pageId !== n.pageId || cx < m.x || cx > m.x + m.w || cy < m.y || cy > m.y + m.h) continue;
        if (!best || m.w * m.h < best.m.w * best.m.h) best = f;
      }
      bg = best ? best.bg : pageBg;
    }
    if (bg) out.set(n.id, contrastRgb(fg, bg));
  }
  return out;
}

const AIM_SETS = [[], ["cleaner"], ["modern"], ["like"], ["clearer"], ["cleaner", "clearer"], ["modern", "like"], ["cleaner", "modern", "like", "clearer"]];
const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55];
const onScale = (px, base, r) => { const n = Math.round(Math.log(px / base) / Math.log(r)); return Math.abs(px - Math.round(base * r ** n)) <= 0.5; };
const on4 = (px) => px === 0 || px % 4 === 0;

for (const SINK of SITES) {
  const TAG = SINK.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
  console.log(`\n${TAG}`);
  const doc = JSON.parse(readFileSync(join(SINK, "site/document.json"), "utf8"));
  const landed = landPalette(doc.nodes, doc.look?.palette ?? {});
  const palette = { ...paletteFromHue(265), ...landed.palette };
  const input = { ...doc, nodes: landed.nodes };
  const before = JSON.stringify(input);
  const p = prepare(input, palette, { name: TAG, at: 1 });
  const pageBg = rgb(palette.bg);
  const first = materialised(p);
  const orig = readPairs(first, pageBg);

  let rolls = 0, aaLost = [], offScale = [], offGrid = [], disagree = [], wordsLow = [];
  for (const aims of AIM_SETS) for (const seed of SEEDS) {
    const r = rollSpec({ seed, aims, shape: p.shape });
    const d = build(p, r.spec);
    rolls++;
    /* AA kept, part by part. */
    const now = readPairs(d.doc.nodes, rgb(d.doc.look?.palette?.bg) ?? pageBg);
    for (const [id, c] of orig) if (c >= 4.5 && (now.get(id) ?? 0) < 4.5) aaLost.push(`${aims.join("+") || "none"}/${seed}: ${id} ${c.toFixed(2)}→${(now.get(id) ?? 0).toFixed(2)}`);
    /* The words colours on the page and its surface. */
    const col = (role) => d.system.tokens.colour.find((t) => t.role === role)?.value;
    const was = (role) => p.system.tokens.colour.find((t) => t.role === role)?.value;
    for (const w of ["text", "muted"]) for (const on of ["bg", "surface"]) {
      const a = rgb(col(w)), b = rgb(col(on)), a0 = rgb(was(w)), b0 = rgb(was(on));
      if (a && b && a0 && b0 && contrastRgb(a0, b0) >= 4.5 && contrastRgb(a, b) < 4.5) wordsLow.push(`${seed} ${w} on ${on}: ${contrastRgb(a, b).toFixed(2)}`);
    }
    /* The type scale. */
    const t = r.spec.type;
    if (!RATIOS.includes(t.ratio)) offScale.push(`ratio ${t.ratio}`);
    for (const s of d.system.tokens.type.steps) if (!onScale(s.px, t.base, t.ratio)) offScale.push(`${s.px}px not on ${t.base}×${t.ratio}^n`);
    /* The grid. */
    const sp = r.spec.space;
    if (!GRID.includes(sp.step)) offGrid.push(`step ${sp.step}`);
    for (const s of d.system.tokens.space) if (!on4(s.px)) offGrid.push(`space ${s.px}`);
    for (const s of d.system.tokens.radius) if (!(on4(s.px) || s.px >= 500)) offGrid.push(`corner ${s.px}`);
    if (r.spec.layout && !on4(r.spec.layout.air)) offGrid.push(`air ${r.spec.layout.air}`);
    /* Corners and shadows agree. */
    if ((sp.corner === "square" && sp.depth !== "flat") || (sp.corner === "pill" && sp.depth === "lifted")) disagree.push(`${sp.corner} with ${sp.depth}`);
    if (d.system.tokens.shadow.length && sp.depth === "flat" && d.system.tokens.shadow.some((s) => s.css !== "none")) disagree.push("flat but a shadow drawn");
  }
  check(`${TAG}: every variation keeps AA contrast (${orig.size} words parts, ${[...orig.values()].filter((c) => c >= 4.5).length} reading at AA, ${rolls} rolls)`, aaLost.length === 0 && wordsLow.length === 0, [...aaLost, ...wordsLow].slice(0, 4).join("; ") || `${rolls} rolls`);
  check(`${TAG}: every type scale is 1.2, 1.25 or 1.333, every size on it`, offScale.length === 0, offScale.slice(0, 4).join("; "));
  check(`${TAG}: every spacing is on the 4/8 grid`, offGrid.length === 0, offGrid.slice(0, 4).join("; "));
  check(`${TAG}: corners and shadows agree`, disagree.length === 0, disagree.slice(0, 4).join("; "));

  /* Locks. */
  const KINDS = { colours: ["colour"], type: ["type", "face"], space: ["space", "radius", "shadow"], motion: ["duration", "easing"], layout: [], order: [] };
  const lockFails = [];
  for (const aims of [["cleaner"], ["modern", "clearer"], ["cleaner", "modern", "like", "clearer"]]) {
    const v1 = rollSpec({ seed: 7, aims, shape: p.shape });
    const T1 = tokenValues(build(p, v1.spec).system);
    for (const L of LAYERS) {
      const v2 = rollSpec({ seed: 99991, aims, shape: p.shape, prev: v1, locks: [L] });
      const d2 = build(p, v2.spec);
      if (!same(v2.spec[L], v1.spec[L])) lockFails.push(`${L} choice changed`);
      for (const k of KINDS[L]) if (!same(tokenValues(d2.system)[k], T1[k])) lockFails.push(`${L}: ${k} tokens changed`);
      /* Locked with nothing to keep it from: as the original has it. */
      const v3 = rollSpec({ seed: 3, aims, shape: p.shape, locks: [L] });
      if (v3.spec[L] !== null) lockFails.push(`${L} locked on the first roll was rolled`);
    }
  }
  check(`${TAG}: locks are respected`, lockFails.length === 0, lockFails.slice(0, 4).join("; "));
  check(`${TAG}: the original's document is not changed`, JSON.stringify(input) === before);

  /* Ask Claude for 4, stubbed. */
  const ask = askFor(p, { aims: ["cleaner", "clearer"], like: "linear.app", count: 4, locks: ["motion"] }, TAG);
  const text = askText(ask);
  check(`${TAG}: the ask carries the System, the layout tree, the aims and the locks`, /SYSTEM:/.test(text) && /LAYOUT:/.test(text) && /section 0/.test(text) && /AIMS:.*Cleaner/.test(text) && /LOCKED:.*motion/i.test(text) && /linear\.app/.test(text), text.split("\n").filter((l) => /LAYOUT|LOCKED|AIMS/.test(l)).join(" | "));
  const n = p.shape.sections;
  const part = ask.words[0]?.part ?? "nope";
  const v = (o) => ({ name: "", note: "", colours: { keep: true, hue: 0, harmony: "mono", chroma: 0.1 }, type: { keep: true, pairing: "sans-sans", ratio: 1.25, base: 16 }, space: { keep: true, step: 8, density: 1, corner: "soft", depth: "soft" }, layout: { keep: true, sections: [], air: 0 }, order: { keep: true, order: [] }, motion: { keep: false, style: "bouncy" }, words: [], ...o });
  const raw = { variants: [
    v({ name: "Calm editorial", type: { keep: false, pairing: "serif-sans", ratio: 1.25, base: 18 }, space: { keep: false, step: 8, density: 1.5, corner: "soft", depth: "soft" }, words: [{ part, to: "Start here", why: "one clear button" }] }),
    v({ name: "Bold product", colours: { keep: false, hue: 250, harmony: "complementary", chroma: 0.17 }, type: { keep: false, pairing: "grotesk-serif", ratio: 1.5, base: 17 }, space: { keep: false, step: 6, density: 1.25, corner: "square", depth: "lifted" } }),
    v({ name: "Quiet", type: { keep: false, pairing: "sans-sans", ratio: 1.2, base: 16 } }),
    v({ name: "Quiet too", type: { keep: false, pairing: "sans-sans", ratio: 1.2, base: 16 } }),
  ] };
  const got = readAnswer(raw, { words: ask.words, count: 4, locks: ["motion"] }, n, p.shape);
  check(`${TAG}: 4 Claude directions, each named in plain words`, got.length === 4 && got.every((x) => /^[A-Z][a-z]+( [a-z]+){0,3}$/.test(x.name)) && new Set(got.map((x) => x.name)).size === 4, got.map((x) => x.name).join(", "));
  check(`${TAG}: the locked layer is kept in every direction`, got.every((x) => x.spec.motion === null), got.map((x) => JSON.stringify(x.spec.motion)).join(" "));
  const gaps = [];
  for (let i = 0; i < got.length; i++) for (let j = i + 1; j < got.length; j++) gaps.push(specDistance(got[i].spec, got[j].spec));
  check(`${TAG}: every two directions differ by more than ${DIRECTION_GAP}`, gaps.every((g) => g > DIRECTION_GAP), `closest ${Math.min(...gaps).toFixed(2)}`);
  check(`${TAG}: an off-grid, off-scale answer lands on the grid and the scale`, got[1].spec.space?.step === 8 && RATIOS.includes(got[1].spec.type?.ratio) && got[1].spec.space?.depth === "flat", JSON.stringify(got[1].spec.space) + " " + got[1].spec.type?.ratio);
  const kept = build(p, got[0].spec);
  const sugg = got[0].words;
  check(`${TAG}: word changes are suggestions only`, sugg.length === (ask.words.length ? 1 : 0) && kept.doc.nodes.every((x, i) => same(x.content, p.nodes[i].content)), `${sugg.length} suggestion, none put in`);
  check(`${TAG}: local rolls are named too`, typeof directionName(rollSpec({ seed: 4, aims: ["modern"], shape: p.shape }).spec) === "string");
}

function materialised(p) {
  return build(p, { colours: null, type: null, space: null, layout: null, order: null, motion: null }).doc.nodes;
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
