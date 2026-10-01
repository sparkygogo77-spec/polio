#!/usr/bin/env node
/**
 * WORDS ARE MEASURED AGAINST WHAT IS PAINTED RIGHT BEHIND THEM.
 *
 * THE OWNER'S REPORT: Look > Readable words said 115 of 116 parts read
 * clearly and listed TRORTY REMOTE at 1.1 to 1, offering to make it
 * readable. On the board it is yellow on the remote's dark navy panel and
 * reads perfectly. The check measured it against the yellow section behind
 * the remote: the panel is painted by a gradient, which the check never
 * looked at, and it took the smallest holder with a fill colour instead.
 *
 * The backdrop is what paints right under the words (`backdropOf`): the
 * part's own paint, else the topmost part before it in paint order that
 * covers its words and paints something (a fill, a gradient, a background
 * picture), else the page. A gradient counts by its stops and a picture by
 * cells sampled under the words, the worst of them. Held here:
 *
 *   · words on a dark panel inside a light page read (the panel, not the page);
 *   · words on a see-through box over a dark picture are read against the picture;
 *   · words that truly cannot be read are still flagged, and Make readable
 *     fixes them against the same backdrop;
 *   · a sharp, solid text shadow is an edge round every letter, as an
 *     outline is; a soft glow is not;
 *   · on sink's Trump & Morty capture, TRORTY REMOTE is not flagged.
 *
 *   node tests/readable-backdrop.mjs [path to sink's sites/trumpmorty-fun]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SINK = process.argv[2] && !/^https?:/.test(process.argv[2]) ? process.argv[2] : process.env.SINK ?? join(here, "..", "..", "sink", "sites", "trumpmorty-fun");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { wordsContrast, readableFixes, backdropOf, HARD_TO_READ, READS } = await jiti.import(join(here, "..", "src", "features", "studio", "siteColours.ts"));
const { sampleHeld } = await jiti.import(join(here, "..", "src", "features", "studio", "pictureSampler.ts"));
const { resolvePalette } = await jiti.import(join(here, "..", "src", "features", "studio", "parts", "theme.ts"));

const part = (id, x, y, w, h, extra = {}) => ({ id, pageId: "p0", featureId: "box", content: "", x, y, w, h, colour: null, font: null, ...extra });
const LIGHT_PAGE = { bg: "rgb(245, 240, 220)", text: "rgb(20, 20, 20)" };
const row = (rows, id) => rows.find((r) => r.id === id);

/* 1. A dark panel inside a light page: its words read, against the panel. */
{
  const nodes = [
    part("section", 0, 0, 1440, 800, { colour: { bg: "rgb(245, 240, 220)" } }),
    part("panel", 400, 200, 600, 400, { art: { background: "linear-gradient(170deg, rgb(58, 65, 96), rgb(41, 47, 68) 50%, rgb(26, 30, 46))" } }),
    part("label", 450, 250, 200, 40, { featureId: "prose", content: "YELLOW ON NAVY", colour: { text: "rgb(243, 212, 64)" } }),
    part("filled", 450, 350, 200, 40, { featureId: "prose", content: "on a navy fill", colour: { text: "rgb(243, 212, 64)" } }),
  ];
  nodes.splice(3, 0, part("navyFill", 420, 330, 300, 80, { colour: { bg: "rgb(30, 34, 50)" } }));
  const rows = wordsContrast(nodes, LIGHT_PAGE);
  const l = row(rows, "label"), f = row(rows, "filled");
  check("1 words on a dark gradient panel inside a light page read", l?.ratio >= READS && l?.backdrop.by === "panel" && l?.backdrop.kind === "gradient", JSON.stringify(l));
  check("1 …measured against the worst of the gradient's stops", l?.ground === "rgb(58, 65, 96)", l?.ground);
  check("1 words on a dark fill that is a sibling layered under them read too", f?.ratio >= READS && f?.backdrop.by === "navyFill", JSON.stringify(f));
}

/* 2. A see-through box over a dark picture: the picture is the backdrop. */
{
  /* A 4×2 picture, near-black: what the sampler would read off the real file. */
  const W = 64, H = 32;
  const data = { data: new Uint8ClampedArray(W * H * 4).map((_, i) => (i % 4 === 3 ? 255 : 18)) };
  const held = { data, w: W, h: H, natural: { w: 1280, h: 640 } };
  const sample = (id, under) => (id === "photo" ? sampleHeld(held, { w: 1280, h: 640 }, under) : null);
  const nodes = [
    part("section", 0, 0, 1440, 900, { colour: { bg: "rgb(250, 250, 250)" } }),
    part("photo", 80, 80, 1280, 640, { featureId: "picture", picture: { id: "pic_dark", path: "assets/pictures/dark.jpg", w: 1280, h: 640 } }),
    part("veil", 200, 200, 600, 200, { colour: { bg: "rgba(255, 255, 255, 0.1)" } }),
    part("caption", 240, 240, 400, 60, { featureId: "prose", content: "Light words on a dark photo", colour: { text: "rgb(250, 250, 250)" } }),
    part("darkCaption", 240, 320, 400, 60, { featureId: "prose", content: "Dark words on a dark photo", colour: { text: "rgb(30, 30, 30)" } }),
  ];
  const rows = wordsContrast(nodes, { bg: "rgb(250, 250, 250)" }, sample);
  const c = row(rows, "caption"), d = row(rows, "darkCaption");
  check("2 words on a see-through box over a dark picture are read against the picture", c?.backdrop.by === "photo" && c?.backdrop.kind === "picture" && c?.ratio >= READS, JSON.stringify(c));
  check("2 …so dark words there are flagged, though the page behind is white", d?.backdrop.by === "photo" && d?.ratio < HARD_TO_READ, JSON.stringify(d));
  const unread = wordsContrast(nodes, { bg: "rgb(250, 250, 250)" });
  check("2 a picture not to hand yet is not judged against something else", !row(unread, "caption") && !row(unread, "darkCaption"), unread.map((r) => r.id).join(", ") || "none judged");
  const fixes = readableFixes(nodes, { bg: "rgb(250, 250, 250)" }, sample);
  check("2 Make readable fixes them against the picture, not the page", fixes.some((f) => f.id === "darkCaption" && f.now >= READS), JSON.stringify(fixes));
}

/* 3. Truly unreadable words are still flagged, and fixed against the same backdrop. */
{
  const nodes = [
    part("section", 0, 0, 1440, 800, { colour: { bg: "rgb(240, 223, 123)" } }),
    part("pale", 100, 100, 400, 50, { featureId: "prose", content: "Pale yellow on yellow", colour: { text: "rgb(250, 240, 180)" } }),
    part("ink", 100, 200, 400, 50, { featureId: "prose", content: "Dark words", colour: { text: "rgb(26, 15, 11)" } }),
  ];
  const rows = wordsContrast(nodes, LIGHT_PAGE);
  check("3 words that cannot be read are still flagged", row(rows, "pale")?.ratio < HARD_TO_READ, JSON.stringify(row(rows, "pale")));
  const fixes = readableFixes(nodes, LIGHT_PAGE);
  check("3 …and Make readable gives them a colour the site wears that reads there", fixes.length === 1 && fixes[0].id === "pale" && fixes[0].to === "rgb(26, 15, 11)" && fixes[0].now >= READS, JSON.stringify(fixes));
}

/* 3b. A sharp solid text shadow is an edge round every letter; a soft glow is not. */
{
  const nodes = [
    part("screen", 0, 0, 600, 400, { colour: { bg: "rgb(235, 145, 66)" } }),
    part("sharp", 20, 20, 200, 40, { featureId: "prose", content: "CH 47", colour: { text: "rgb(184, 255, 106)" }, art: { textShadow: "rgba(160, 255, 90, 0.9) 0px 0px 6px, rgb(0, 0, 0) 2px 2px 0px" } }),
    part("glow", 20, 80, 200, 40, { featureId: "prose", content: "CH 48", colour: { text: "rgb(184, 255, 106)" }, art: { textShadow: "rgba(160, 255, 90, 0.9) 0px 0px 6px" } }),
  ];
  const rows = wordsContrast(nodes, LIGHT_PAGE);
  check("3b green words with a hard black shadow on orange read, by the shadow", row(rows, "sharp")?.ratio >= READS, JSON.stringify(row(rows, "sharp")));
  check("3b …the same words with only a soft glow are still flagged", row(rows, "glow")?.ratio < HARD_TO_READ, JSON.stringify(row(rows, "glow")));
}

/* 4. Trump & Morty: TRORTY REMOTE is yellow on the remote's navy panel. */
{
  const doc = JSON.parse(readFileSync(join(SINK, "site", "document.json"), "utf8"));
  const palette = resolvePalette(doc.format, doc.look);
  /* The capture's own pictures, decoded by a browser, sampled under the words as the Look tab does. */
  const { createRequire } = await import("node:module");
  const { chromium } = createRequire(import.meta.url)("playwright-core");
  const { pictureHeld } = await import("./fixtures/pictureHeld.mjs");
  const held = await pictureHeld(chromium, SINK, doc.nodes, process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium");
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const sample = (id, under) => (held.has(id) ? sampleHeld(held.get(id), byId.get(id), under) : null);
  const rows = wordsContrast(doc.nodes, palette, sample);
  check("4 the capture's pictures were read", held.size > 0, `${held.size} pictures`);
  const remote = row(rows, "n_prose_124");
  check("4 TRORTY REMOTE is not flagged", !!remote && remote.ratio >= READS, JSON.stringify(remote));
  check("4 …it is read against the remote's own navy panel", remote?.backdrop.by === "n_box_121" && remote?.backdrop.kind === "gradient", remote?.backdrop.by);
  const i = doc.nodes.findIndex((n) => n.id === "n_prose_124");
  check("4 backdropOf names the same panel", backdropOf(doc.nodes, i, palette)?.by === "n_box_121");
  const hard = rows.filter((r) => r.ratio < HARD_TO_READ);
  check("4 nothing on the board is flagged that reads on the page", hard.length === 0, hard.map((r) => `${r.id} ${r.ratio}`).join(", ") || "none");
}

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
