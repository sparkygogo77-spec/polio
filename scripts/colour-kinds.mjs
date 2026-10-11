#!/usr/bin/env node
/**
 * WHAT COLOURS MAKES OF A SAVED BOARD, without a browser: the kinds of
 * surface Colours shows for a site (Main fill, Panels, Buttons, Labels...),
 * how big each one is, which parts wear it, and what the preview draws for
 * it (a box, a tab, a button, a small swatch, the loading-bar chip, or
 * nothing). So a fix to the kinds is checked on the site J is actually
 * styling, a board saved with `npm run board -- refresh <name>`.
 *
 *   node scripts/colour-kinds.mjs redesign          # one line per kind
 *   node scripts/colour-kinds.mjs pst --json        # the same, as JSON
 *
 * The kinds are computed exactly as SiteColours.tsx asks for them: siteRoles
 * (frame width, parts counted as Colours counts them) for the background
 * layers, then siteKinds(nodes, palette, background). Picture colours are
 * sampled in the browser, so here none are given: that only moves roles,
 * never which parts a kind holds.
 */
import { readBoard } from "../tests/lib/board.mjs";
import { fileURLToPath } from "node:url";
import { previewPlan, siteKinds } from "../src/features/studio/themeKinds.ts";
import { siteRoles } from "../src/features/studio/siteRoles.ts";
import { componentsOf } from "../src/features/studio/components.ts";
import { repeatsAcrossPages } from "../src/features/studio/repeats.ts";
import { paletteFromHue } from "../src/features/studio/look/index.ts";

/** The saved board's document, and the kinds Colours makes of it, as SiteColours.tsx asks for them. Tests use it too (tests/colour-kinds-redesign.mjs). */
export function boardKinds(name) {

  /* The document as the Builder keeps it: builder.studio in the builder.docs store. */
  const board = readBoard(name);
  const row = board.idb["builder.docs"]?.stores?.docs?.find((r) => r.key === "builder.studio");
  if (!row) throw new Error(`No document on the ${name} board.`);
  const state = JSON.parse(typeof row.value === "string" ? row.value : JSON.stringify(row.value)).state;
  const nodes = state.nodes;
  /* resolvePalette (shelf/parts/theme.ts), which plain node cannot import: the hue's palette, then the site's own roles over it. */
  const format = state.format ?? {};
  const mode = String(format["palette.mode"] ?? "dark");
  const palette = { ...paletteFromHue(Number(format["palette.accentHue"] ?? 265), mode === "light" || mode === "both"), ...Object.fromEntries(Object.entries(state.look?.palette ?? {}).filter(([, v]) => typeof v === "string" && v.trim())) };

  /* As SiteColoursSection counts parts: a button of stacked parts is one, a part on every page is one. */
  const c = componentsOf(nodes, palette);
  const once = repeatsAcrossPages(nodes);
  const counted = { countAs: (id) => { const host = c.of.get(id) ?? id; return once.get(host) ?? host; }, kindOf: (id) => { const host = c.of.get(id); return host ? c.byId.get(host)?.kind ?? null : null; } };
  const frameWidth = state.frameWidth || 1440;
  const roles = siteRoles(nodes, palette, frameWidth, new Map(), undefined, counted);
  const background = new Set(roles.left.backgroundLayers);
  const site = siteKinds(nodes, palette, background);
  return { board, state, nodes, background, frameWidth, site };
}
export const boardSite = (name) => boardKinds(name).site;

/** What the preview draws for each kind: `previewPlan`, the very choice ThemePreview makes, and the box each small accent sits on (its `inside` chain). */
function drawnAs(site) {
  const K = site.kinds, at = (k) => K.indexOf(k);
  const { tabs, surfaces, buttons, accents, strips, bars } = previewPlan(site);
  const boxed = new Set(surfaces.map(at));
  const home = (k) => { for (let i = k.inside, n = 0; i >= 0 && n < 8; i = K[i]?.inside ?? -1, n++) if (boxed.has(i)) return i; return -1; };
  const out = K.map(() => "not shown");
  for (const k of tabs) out[at(k)] = "label bar";
  for (const k of surfaces) out[at(k)] = k.piece ? "box (piece)" : "box";
  for (const k of buttons) out[at(k)] = boxed.has(k.inside) ? `button in box #${k.inside}` : "button (loose)";
  for (const k of bars) out[at(k)] = `loading-bar chip dot (${k.progress})`;
  for (const k of strips) out[at(k)] = "strip bar";
  for (const k of accents) out[at(k)] = home(k) >= 0 ? `small swatch on box #${home(k)}` : "small swatch (loose, named)";
  return out;
}

/* Run as a script (not imported by a test): print the table. */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const name = args.find((a) => !a.startsWith("--"));
  if (!name) { console.log("usage: node scripts/colour-kinds.mjs <board> [--json]"); process.exit(1); }
  const { board, state, nodes, background, frameWidth, site } = boardKinds(name);
  const pages = new Map((state.pages ?? []).map((p) => [p.id, p.name]));
  const drawn = drawnAs(site);
  /* The site's area, for the share: every part's own box added up (nested parts too, so shares are small; compare them with each other). */
  const siteArea = nodes.reduce((a, n) => a + Math.max(0, n.w ?? 0) * Math.max(0, n.h ?? 0), 0);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const who = (id) => { const n = byId.get(id); if (!n) return id; const h = n.hooks?.["data-hook"] || n.hooks?.id || n.label || n.id; return `${h}@${pages.get(n.pageId) ?? n.pageId} ${Math.round(n.w ?? 0)}x${Math.round(n.h ?? 0)}`; };
  const rows = site.kinds.map((k, i) => ({
    i, name: k.name, parts: k.parts, cover: Math.round(k.cover), share: siteArea ? +(k.cover / siteArea * 100).toFixed(2) : 0,
    wh: `${Math.round(k.w)}x${Math.round(k.h)}`, shape: k.shape, accent: k.accent, tab: k.tab, piece: k.piece, button: k.button, strip: k.strip,
    progress: k.progress, inside: k.inside, fill: k.fill, words: k.words, sample: k.sample, drawn: drawn[i], members: k.ids.slice(0, 6).map(who), ids: k.ids.length,
  }));

  if (json) { console.log(JSON.stringify({ board: board.from, frameWidth, page: site.page, siteArea, kinds: rows }, null, 2)); process.exit(0); }
  const yes = (b, s) => (b ? s : "-");
  console.log(`${name}: ${board.from.repo}@${board.from.ref} ${String(board.from.commit).slice(0, 7)} saved ${board.from.saved}, ${nodes.length} parts, frame ${frameWidth}, site area ${siteArea} px2`);
  console.log(`page: fill ${site.page.fill} words ${site.page.words}; background layers ${background.size}`);
  for (const r of rows) {
    console.log(`#${r.i} ${r.name} | parts ${r.parts} | cover ${r.cover} (${r.share}%) | ${r.wh} | shape ${r.shape ?? "-"} | ${[yes(r.accent, "accent"), yes(r.tab, "tab"), yes(r.piece, "piece"), yes(r.button, "button"), yes(r.strip, "strip"), r.progress ? `progress:${r.progress}` : "-"].join(" ")} | inside ${r.inside} | fill ${r.fill} | words ${r.words ?? "-"} | sample ${JSON.stringify(r.sample)} | DRAWN: ${r.drawn}`);
    console.log(`    ${r.members.join(", ")}${r.ids > 6 ? `, +${r.ids - 6} more` : ""}`);
  }
}
