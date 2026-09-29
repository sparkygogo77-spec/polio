#!/usr/bin/env node
/**
 * EVERY GO LIVE LEAVES A POLIO.md: WHAT THE SITE IS, AND WHAT STILL NEEDS CODE.
 *
 * A backend code chat opened on a published repository knew nothing of the
 * site: not its colours, not where a part lives, not what the capture could
 * not take. Go live now writes POLIO.md at the root, in the same push
 * (`goLive.ts` → `polioMd.ts`). Held here, without a browser:
 *   · a small fixture: its five sections, in order: Style (the palette, the
 *     faces with their file and unicode range, radii, spacing), Pages (path,
 *     file, main parts with their ids and selectors), Captured behaviour (each
 *     record and its part, Show on press, canvases, the features attached,
 *     stylesheet motion and hover), Not captured (the capture's hand-off, a
 *     button that goes nowhere, a form with no action), and Source (the
 *     repository, folder, branch and commit);
 *   · nothing secret: no email, no token, nothing key-shaped, no bytes, no script;
 *   · the same document writes the same bytes, whatever order its parts are in;
 *   · the document's route there: a capture taken in (`takeDoc`) keeps the
 *     notes POLIO.md reads, and Go live puts the file in its one push;
 *   · a real capture (trumpmorty.fun, stonk.fun, from a sink checkout): every
 *     page, and every behaviour the capture recorded, is in the file.
 *
 *   node --experimental-strip-types tests/polio-md.mjs [sink checkout] [sink ref]
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { polioMd, captureNotes, handoffFrom, sourceNote, scrub, POLIO_MD } from "../src/features/studio/polioMd.ts";
import { takeDoc } from "../src/features/studio/docTake.ts";
import { attachCaptured } from "../src/features/studio/library/captured.ts";
import { usesOf } from "../src/features/studio/library/works.ts";
import { homeFor } from "../src/features/studio/homePage.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SINK = process.argv[2] ?? join(here, "..", "..", "sink");
const REF = process.argv[3] ?? null;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const sectionOf = (md, n) => { const a = md.indexOf(`\n## ${n}.`); const b = md.indexOf("\n## ", a + 4); return a < 0 ? "" : md.slice(a, b < 0 ? undefined : b); };
/** Anything that could be a secret, or a site's own code. */
const LEAKS = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, "an email"],
  [/\b(ghp_|github_pat_|sk-|xox[abpr]-|AKIA)[A-Za-z0-9_-]{6,}/, "a token"],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./, "a web token"],
  [/data:[a-z]+\/[a-z0-9.+-]+;base64,/i, "bytes"],
  [/<script\b/i, "a script"],
  [/(?<![A-Za-z0-9/._-])(?![0-9a-f]{40}(?![A-Za-z0-9]))[A-Za-z0-9+/_-]{32,}/, "a key-shaped string"],
];
/** A page's own route and file are the site's addresses, whatever they look like (stonk.fun's token page is named by its mint): not secrets. */
const leaks = (md, pages = []) => {
  let rest = md;
  const own = pages.flatMap((p) => [p.path ?? "", homeFor(pages).file(p)]).filter((s) => s.length > 1).sort((a, b) => b.length - a.length);
  for (const s of own) rest = rest.split(s).join("");
  return LEAKS.filter(([re]) => re.test(rest)).map(([, what]) => what);
};

/* ------------------------------------------------------------ the fixture */
const REPORT = `# gotchi.gg fidelity

## What was taken

Everything.

## Functions not captured (hand-off to a backend chat)

Endpoints are the site's own (\`js/api.js\`). Ask owner@example.com; the key ghp_abcdefghijklmnopqrstuvwxyz0123456789 was never used.

### Header (every page)

- **sign in**: \`POST /api/auth/start { address }\` → \`{ nonce }\`. Attach to: the header's "sign in" \`cta-primary\`. States: signed out / signing / signed in.
- **mint**: copies 4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R to the clipboard.

## Crops

Pictures.
`;
const behaviours = {
  version: 1,
  intro: [{ part: "n_title", selector: "body > main > h1", duration: 800, easing: "ease-out" }],
  loader: { covers: true, words: [{ text: "CH 47" }] },
  loops: [{ part: "n_band", selector: "body > main > div", kind: "marquee", speed: 10, direction: "left" }],
  idle: [{ part: "n_logo", selector: "body > header > img", name: "spin", css: true, duration: 9000 }],
  states: [
    { page: "page_home", group: "page_home:g0", option: 1, name: "sign in", part: "n_signin", shows: ["n_panel"], hides: ["n_hero"] },
  ],
  motion: {
    hover: [{ part: "n_card", selector: "body > main > section > a", kind: "lift", via: "css", lift: 2 }],
    canvases: [{ part: "n_screen", selector: "body > main > section > canvas", host: "n_card", kind: "flipbook", readable: true }],
  },
};
const from = (selector) => ({ url: "https://gotchi.gg/", host: "gotchi.gg", selector, at: Date.UTC(2026, 8, 28) });
const pages = [
  { id: "page_home", name: "Home", path: "/" },
  { id: "page_shop", name: "Shop", path: "/shop" },
];
const nodes = [
  { id: "n_main", pageId: "page_home", featureId: "box", label: "main", content: "", x: 0, y: 0, w: 1440, h: 900, from: from("body > main"), pad: { top: 24, right: 16, bottom: 24, left: 16 } },
  { id: "n_title", pageId: "page_home", featureId: "prose", content: "hatch a pixel pet", x: 40, y: 40, w: 600, h: 80, from: from("body > main > h1"), font: { face: "Pixelify Sans", px: 48, weight: 700 }, colour: { text: "rgb(43, 29, 46)" } },
  { id: "n_band", pageId: "page_home", featureId: "prose", content: "LIVE LIVE LIVE", x: 0, y: 200, w: 1440, h: 40, from: from("body > main > div") },
  { id: "n_logo", pageId: "page_home", featureId: "picture", content: "", x: 10, y: 10, w: 40, h: 40, from: from("body > header > img"), motion: { animation: [{ name: "spin", duration: "9s", timing: "linear", iterations: "infinite" }] } },
  { id: "n_card", pageId: "page_home", featureId: "box", content: "", x: 40, y: 300, w: 300, h: 200, radius: 12, from: from("body > main > section > a"), colour: { bg: "rgb(255, 244, 224)" }, motion: { transition: [{ property: "transform" }], hover: [{ state: "hover", style: { transform: "translateY(-2px)" } }] } },
  { id: "n_screen", pageId: "page_home", featureId: "picture", content: "", x: 60, y: 320, w: 192, h: 144, from: from("body > main > section > canvas") },
  { id: "n_signin", pageId: "page_home", featureId: "cta-primary", content: "sign in", x: 1300, y: 10, w: 100, h: 40, from: from("body > header > button") },
  { id: "n_panel", pageId: "page_home", featureId: "box", content: "", x: 900, y: 60, w: 400, h: 300, state: { group: "page_home:g0", option: 1 }, from: from("body > dialog") },
  { id: "n_frames", pageId: "page_home", featureId: "picture", label: "canvas-frames", content: "", x: 920, y: 80, w: 192, h: 144, state: { group: "page_home:g0", option: 1 }, picture: { id: "pic_f", path: "assets/pictures/pic_f.svg", type: "image/svg+xml" }, from: from("body > dialog > canvas") },
  { id: "n_idle_frames", pageId: "page_shop", featureId: "picture", label: "canvas-frames", content: "", x: 0, y: 400, w: 64, h: 64, picture: { id: "pic_g", path: "assets/pictures/pic_g.svg", type: "image/svg+xml" } },
  { id: "n_icon", pageId: "page_shop", featureId: "picture", label: "svg-1234", content: "", x: 0, y: 500, w: 16, h: 16, picture: { id: "pic_i", path: "assets/pictures/pic_i.svg", type: "image/svg+xml" } },
  { id: "n_hero", pageId: "page_home", featureId: "box", content: "", x: 0, y: 60, w: 1440, h: 200, state: { group: "page_home:g0", option: 0 }, from: from("body > main > header") },
  { id: "n_shop_link", pageId: "page_home", featureId: "cta-primary", content: "the shop", x: 40, y: 600, w: 120, h: 40, link: { kind: "page", target: "page_shop" }, from: from("body > main > nav > a") },
  { id: "n_burn", pageId: "page_shop", featureId: "cta-primary", content: [{ text: "burn " }, { text: "it" }], x: 40, y: 40, w: 120, h: 40, radii: [0, 0, 8, 8] },
  { id: "n_mail", pageId: "page_shop", featureId: "newsletter", label: "Email signup", content: "", x: 40, y: 120, w: 400, h: 120 },
  { id: "n_ask", pageId: "page_shop", featureId: "prose", content: "price", x: 40, y: 300, w: 200, h: 40, task: "show the live price" },
];
const look = {
  palette: { bg: "rgb(255, 244, 224)", text: "rgb(43, 29, 46)" },
  fonts: [
    { id: "font:pixelify-sans:400-700:normal", family: "Pixelify Sans", weight: "400 700", style: "normal", unicodeRange: "U+0000-00FF, U+0131", from: { url: "https://gotchi.gg", sheet: "https://fonts.googleapis.com/css2?family=Pixelify+Sans" }, source: { kind: "data", src: "data:font/woff2;base64,d09GMgABAAAAAC7wABQAAAAAkdgAAC59AAEAAAAAAAAAAAAAAAAAAAAA", format: "woff2" }, licence: "open", carried: true, bytes: 12016 },
  ],
};
const SHA = "63c8a7f0b2d14e5a9c3f1e2d4b6a8c0e1f3a5b7d";
const doc = {
  pages, nodes, groups: [], shapes: [], format: { "palette.mode": "light", "layout.radius": 0 }, brief: { name: "gotchi" }, look, motion: [],
  frameWidth: 1440, keyframes: [], behaviours,
  handoff: handoffFrom(REPORT),
  source: { repo: "sparkygogo77-spec/sink", dir: "sites/gotchi-gg", branch: "claude/fervent-carson-30yt59", commit: SHA },
};

/* The document's way in: takeDoc keeps what POLIO.md reads, then drops the behaviours. */
const prev = { pages, nodes: [], groups: [], shapes: [], spaces: [], brief: {}, look: {}, motion: [], frameWidth: 1440 };
const took = takeDoc(prev, doc, { format: () => ({}), look: () => ({ palette: {}, texture: [] }) });
{
  const c = took.look.capture;
  check("a capture taken in keeps its notes on the look", !!c && Array.isArray(c.behaviours) && c.behaviours.length === 6, JSON.stringify(c?.behaviours?.map((b) => b.kind)));
  check("…its Show on press, by part", c?.presses?.length === 1 && c.presses[0].part === "n_signin" && c.presses[0].shows === 1);
  check("…its hand-off, and its source to the commit", /POST \/api\/auth\/start/.test(c?.handoff ?? "") && c?.source?.commit === SHA);
  check("a document with nothing captured gets no notes", takeDoc(prev, { ...doc, behaviours: undefined, handoff: undefined, source: undefined }, { format: () => ({}), look: () => ({}) }).look.capture === undefined);
}
check("the hand-off is the report's section, to its next heading", (() => { const h = handoffFrom(REPORT); return h.startsWith("Endpoints are") && h.includes("### Header") && !h.includes("Crops") && !h.includes("Functions not captured"); })());
check("…and nothing from a report without one", handoffFrom("# x\n\n## Other\n\ntext") === null);
check("a source that is not one is refused", sourceNote({ repo: "not a repo" }) === null && sourceNote({ repo: "a/b", commit: "HEAD" })?.commit === null);
check("scrub takes out an email, a token and a key, and keeps a commit", (() => { const s = scrub(`a@b.io ghp_${"x".repeat(36)} ${"Q".repeat(44)} ${SHA}`); return !s.includes("@") && !s.includes("ghp_") && !s.includes("Q".repeat(44)) && s.includes(SHA); })());

const site = { ...took, nodes: took.nodes, source: null };
const md = polioMd(site);
const again = polioMd({ ...site, nodes: [...site.nodes].reverse(), pages: [...site.pages] });

check("the file is POLIO.md", POLIO_MD === "POLIO.md");
check("five sections, in order", ["1. Style", "2. Pages", "3. Captured behaviour", "4. Not captured, for the backend", "5. Source"].map((h) => md.indexOf(`\n## ${h}`)).every((at, i, a) => at > 0 && (i === 0 || at > a[i - 1])));
check("the same document writes the same bytes, whatever order its parts are in", md === polioMd(site) && md === again);

const style = sectionOf(md, 1);
check("Style: the six roles, as the stylesheet names them", ["bg", "surface", "text", "muted", "accent", "highlight"].every((r) => style.includes(`\`var(--${r})\``)) && style.includes("`#fff4e0`") && style.includes("`#2b1d2e`"));
check("…every face with its file and unicode range", /\| Pixelify Sans \| 400 700 \| normal \| assets\/site\.css \(woff2, carried, 12 KB\) \| U\+0000-00FF, U\+0131 \|/.test(style));
check("…the faces setting words, at their sizes", /\| Pixelify Sans \| 1 \| 48 \| 700 \|/.test(style));
check("…radii, and spacing", style.includes("| `12px` | 1 |") && style.includes("| `0px 0px 8px 8px` | 1 |") && style.includes("`24px 16px 24px 16px`") && style.includes("1440px wide"));

const pagesMd = sectionOf(md, 2);
const home = homeFor(pages);
check("Pages: each page, its path and its file", pages.every((p) => pagesMd.includes(`### ${p.name}`) && pagesMd.includes(`Path: \`${p.path}\``) && pagesMd.includes(`File: \`${home.file(p)}\``)) && pagesMd.includes("`shop/index.html`"));
check("…its main parts, by id, with the selector each is at and where it was captured", pagesMd.includes("| `n_main` | box | main | `#n_main` | `body > main` |") && pagesMd.includes("| `n_burn` | cta-primary | burn it | `#n_burn` | — |"));

const behaviour = sectionOf(md, 3);
for (const b of took.look.capture.behaviours) check(`Captured behaviour: ${b.kind} on ${b.part}`, new RegExp(`\\| ${b.kind} \\| \`${b.part}\` \\|`).test(behaviour));
check("…the flipbook canvas, as a canvas on its part", /\| canvas \| `n_screen` \| `index\.html` `#n_screen` \| flipbook/.test(behaviour));
check("…Show on press from the site's own feature: the press part, what it shows and in place of what", /\| `n_signin` \| `index\.html` `#n_signin` \| sign in \| `page_home:g0` \| 1: `n_panel` \| 1: `n_hero` \|/.test(behaviour));
check("…a flipbook a press shows, played by that press; one on its own, by the page opening; an svg icon is no flipbook", /\| `n_frames` \| `index\.html` `#n_frames` \| `assets\/pictures\/pic_f\.svg` \| the press on `n_signin` \|/.test(behaviour) && /\| `n_idle_frames` \| `shop\/index\.html` `#n_idle_frames` \| `assets\/pictures\/pic_g\.svg` \| the page opening \|/.test(behaviour) && !sectionOf(md, 3).slice(behaviour.indexOf("### Flipbooks")).includes("n_icon"));
check("…Show on press: the press, its part, its group, what it shows and hides", /\| sign in \| `n_signin` \| `index\.html` `#n_signin` \| `page_home:g0` \| 1 \| 1 \|/.test(behaviour) && behaviour.includes("| `page_home:g0` | 1 | 1 |"));
const attached = took.nodes.flatMap((n) => usesOf(n.work).map((u) => [u.id, n.id]));
check("…every feature attached, on its part", attached.length > 0 && attached.every(([w, id]) => behaviour.includes(`| \`${w}\` | \`${id}\` |`)), JSON.stringify(attached));
check("…the stylesheet's motion and hover", /\| spin 9s linear loops \| — \| — \| 1: `n_logo` \|/.test(behaviour) && /\| — \| transform \| hover \| 1: `n_card` \|/.test(behaviour));

const not = sectionOf(md, 4);
check("Not captured: the capture's hand-off, carried under its own heading", not.includes("### Functions not captured") && not.includes("`POST /api/auth/start { address }`") && not.includes("#### Header (every page)"));
check("…a button that goes nowhere is named; one with a link or a press is not", /\| `n_burn` \| `shop\/index\.html` `#n_burn` \| burn it \|/.test(not) && !not.includes("n_shop_link") && !/\| `n_signin` \|/.test(not));
check("…a form with no action", /\| `n_mail` \| newsletter \| `shop\/index\.html` `#n_mail` \|/.test(not));
check("…the owner's asks, pointing at TASKS.md", not.includes("TASKS.md") && not.includes("| `n_ask` |"));

const source = sectionOf(md, 5);
check("Source: the repository, folder, branch and commit", source.includes("`sparkygogo77-spec/sink`") && source.includes("`sites/gotchi-gg`") && source.includes("`claude/fervent-carson-30yt59`") && source.includes(`\`${SHA}\``));
check("…and the address it was captured from, and when", source.includes("https://gotchi.gg/") && source.includes("2026-09-28"));
check("a site made here says so", sectionOf(polioMd({ pages, nodes: [], look: {} }), 5).includes("Made in the Builder"));

check("nothing secret, no bytes and no script in the file", leaks(md).length === 0, leaks(md).join(", "));

/* ------------------------------------------------------------ Go live carries it, in the one push */
{
  const src = readFileSync(join(here, "..", "src", "features", "studio", "goLive.ts"), "utf8");
  const body = src.slice(src.indexOf("export async function collectFiles"), src.indexOf("\n}\n", src.indexOf("export async function collectFiles")));
  check("Go live's file list carries POLIO.md, written from the board as pressed", /path: POLIO_MD/.test(body) && /polioMd\(\{/.test(body) && /\.\.\.\(described\.some\(\(d\) => d\.path === POLIO_MD\) \? \[\] : \[polio\]\)/.test(body));
}

/* ------------------------------------------------------------ real captures */
const readDoc = (site) => {
  const rel = `sites/${site}/site/document.json`;
  try {
    if (REF) return JSON.parse(execFileSync("git", ["-C", SINK, "show", `${REF}:${rel}`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }));
    const at = join(SINK, rel);
    return existsSync(at) ? JSON.parse(readFileSync(at, "utf8")) : null;
  } catch { return null; }
};
let real = 0;
for (const site of ["trumpmorty-fun", "stonkfun-xyz", "gotchi-gg"]) {
  const d = readDoc(site);
  if (!d?.behaviours) { console.log(`  --   ${site}: no captured document with behaviours at ${SINK}${REF ? ` ${REF}` : ""}; skipped`); continue; }
  real++;
  const t = takeDoc(prev, { ...d, source: { repo: "sparkygogo77-spec/sink", dir: `sites/${site}`, branch: REF ?? "main" } }, { format: () => ({}), look: () => ({ palette: {}, texture: [] }) });
  const out = polioMd({ ...t, brief: d.brief, format: d.format });
  const hp = homeFor(d.pages);
  const pm = sectionOf(out, 2);
  const missingPages = d.pages.filter((p) => !pm.includes(`### ${p.name}`) || !pm.includes(`File: \`${hp.file(p)}\``));
  check(`${site}: every page (${d.pages.length}) is in the file, with its file`, missingPages.length === 0, missingPages.map((p) => p.id).join(", "));
  const bm = sectionOf(out, 3);
  const recs = [];
  for (const [k, v] of Object.entries(d.behaviours)) {
    if (k === "motion") for (const [mk, mv] of Object.entries(v ?? {})) for (const r of Array.isArray(mv) ? mv : []) recs.push([mk === "canvases" ? "canvas" : mk, r.part ?? r.host ?? "@none"]);
    else if (Array.isArray(v)) for (const r of v) recs.push([k, r.part ?? r.host ?? "@none"]);
  }
  const missing = recs.filter(([k, part]) => (k === "states" ? !new RegExp(`\\| \`${part}\` \\|`).test(bm) : !bm.includes(`| ${k} | \`${part}\` |`)));
  check(`${site}: every captured behaviour (${recs.length}) is in the file, on its part`, recs.length > 0 && missing.length === 0, missing.slice(0, 5).map((m) => m.join(":")).join(", "));
  const uses = t.nodes.flatMap((n) => usesOf(n.work).map((u) => [u.id, n.id]));
  const lost = uses.filter(([w, id]) => !bm.includes(`| \`${w}\` | \`${id}\` |`) && !bm.includes(`| \`${w}\` (off) | \`${id}\` |`));
  check(`${site}: every feature attached (${uses.length}) is in the file`, lost.length === 0, lost.slice(0, 5).join(" "));
  const runs = t.nodes.filter((n) => usesOf(n.work).some((u) => u.id === "press-shows"));
  const flips = t.nodes.filter((n) => n.label === "canvas-frames" && n.picture?.type === "image/svg+xml");
  const flipMd = bm.slice(bm.indexOf("### Flipbooks"));
  const unlisted = [...runs.filter((n) => !new RegExp(`\\| \`${n.id}\`(?: \\(off\\))? \\| [^|]+ \\| [^|]* \\| \`[^\`]*\` \\| \\d+: `).test(bm)), ...flips.filter((n) => !flipMd.includes(`| \`${n.id}\` |`))];
  check(`${site}: every Show on press (${runs.length}) and flipbook (${flips.length}) the site runs is listed`, unlisted.length === 0, unlisted.slice(0, 5).map((n) => n.id).join(", "));
  check(`${site}: the same document writes the same bytes`, out === polioMd({ ...t, brief: d.brief, format: d.format, nodes: [...t.nodes].reverse() }));
  check(`${site}: nothing secret, no bytes and no script`, leaks(out, d.pages).length === 0, leaks(out, d.pages).join(", "));
}
if (!real) console.log("  --   no sink checkout with a captured document: the real-capture checks did not run (pass a sink checkout and ref)");

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
