/**
 * BUILD SHIPS HIS WORDS, NEVER THE BOARD'S FILLER, AND SAYS WHICH ARE MISSING.
 *
 * On the board, a part whose words nobody wrote shows sample prose ("Warm
 * harbour wide ledger…") so the layout can be read. Build rendered every
 * part in board mode and copied that markup into the site's component files,
 * so the invented sentences went out as hard-coded copy, while BUILD.md said
 * "No empty parts" and the ask told Claude the files were exact. Build now
 * renders each part as the published page does (live, published: the words
 * left out), and an unpublished live render counts the parts that say
 * "not written yet", which BUILD.md and the gaps for Claude then name.
 * Rendered with react-dom/server and the scaffold itself (no browser, no server):
 *
 *   node tests/build-no-filler.mjs
 *
 * Covers: src/features/studio/scaffoldRun.ts, src/features/studio/scaffolding/shell.ts, src/features/studio/scaffolding/types.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src", "features", "studio");
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
const { Block } = await jiti.import(join(src, "blocks.tsx"));
const { themeFrom, resolvePalette } = await jiti.import(join(src, "shelf", "parts", "theme.ts"));
const { NOT_WRITTEN } = await jiti.import(join(src, "shelf", "parts", "sample.ts"));
const { scaffold } = await jiti.import(join(src, "scaffold.ts"));
const { gapsOf } = await jiti.import(join(src, "scaffoldRun.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
/* The words sample.ts makes filler from: any of them in a shipped part is ours, not his. */
const FILLER = /\b(signal|harbour|ledger|orbit|meadow|compass|lantern|summit|canvas)\b/i;

/* 1. A paragraph nobody wrote, drawn three ways. */
const t = themeFrom({}), palette = resolvePalette({}, undefined);
const node = { id: "n_intro", pageId: "p1", featureId: "prose", label: "Intro", prompt: "", content: "", data: "", x: 0, y: 0, w: 600, h: 200, groupId: null, options: {}, priority: "must", custom: false, locked: false, link: null };
const draw = (theme, mode) => text(renderToStaticMarkup(React.createElement(Block, { node, t: theme, mode, palette, size: { w: 600, h: 200 } })));
const board = draw(t, "board");
check("on the board it reads as sample prose (the filler this is about)", FILLER.test(board), board.slice(0, 60));
const shipped = draw({ ...t, published: true }, "live");
check("rendered as Build now renders it, no filler and no marker", !FILLER.test(shipped) && !shipped.includes(NOT_WRITTEN), JSON.stringify(shipped.slice(0, 60)));
const audit = draw(t, "live");
check("the unpublished live render says the words are missing, so Build can count it", audit.includes(NOT_WRITTEN), audit.slice(0, 60));

/* 2. Build renders that way (source read: buildScaffold needs a DOM and the store). */
const run = readFileSync(join(src, "scaffoldRun.ts"), "utf8");
check("Build renders parts live and published, not in board mode", /published: true/.test(run) && /mode: "live"/.test(run) && !/mode: "board"/.test(run));
check("and counts the parts whose live render says NOT_WRITTEN", /\.includes\(NOT_WRITTEN\)/.test(run));

/* 3. The gaps for Claude name them. */
const gaps = gapsOf({ files: [], stats: { pages: 1, parts: 2, empty: 0, unwritten: 1, bodies: 0, clipped: 0, bytes: 0, ms: 1 }, unwritten: ["Intro"] });
check("the ask lists the part whose words were never written", gaps.some((g) => /never written/.test(g) && g.includes("Intro")), gaps[0]);
const none = gapsOf({ files: [], stats: { pages: 1, parts: 1, empty: 0, unwritten: 0, bodies: 0, clipped: 0, bytes: 0, ms: 1 }, unwritten: [] });
check("and asks for nothing of the kind when every word is his", !none.some((g) => /never written/.test(g)));

/* 4. So does BUILD.md, and it no longer says nothing is missing. */
const input = (unwritten) => ({
  name: "Site", frameWidth: 1440,
  pages: [{ id: "p1", name: "Home", path: "/" }],
  parts: [{ id: "n_intro", pageId: "p1", featureId: "prose", label: "Intro", prompt: "Who we are, in two lines.", x: 0, y: 0, w: 600, h: 200, html: `<div>${shipped}</div>`, unwritten }],
  palette: { bg: "#fff", text: "#111" },
  tokens: { radius: 8, fontPx: 16 },
});
const md = (u) => scaffold(input(u)).find((f) => f.path === "BUILD.md")?.content ?? "";
const told = md(true);
check("BUILD.md names the unwritten part for Claude", /\*\*Intro\*\*, words never written/.test(told) && told.includes("Who we are"), told.match(/- \*\*Intro\*\*[^\n]*/)?.[0]);
check("and does not claim there are no empty parts", !told.includes("No empty parts"));
check("a document with every word written still says so", md(false).includes("No empty parts"));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
