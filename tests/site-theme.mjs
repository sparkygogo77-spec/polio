#!/usr/bin/env node
/**
 * A NEW SITE'S THEME, ROLLED: COHERENT EVERY TIME, ORIGINAL WHEN ASKED.
 *
 * The owner has an idea and does not want to build it on another site's
 * theme. A new site opens on a sample page in a theme of its own
 * (`siteTheme.ts`, `starterPage.ts`), and Randomize rolls another. Held
 * here without a browser:
 *
 *   · 50 rolls, across the slider and a few philosophies: every word on the
 *     sample page reads at 4.5 to 1 or better against what it sits on, every
 *     strong colour is from one accent family, every radius from one family,
 *     every shadow falls one way, every space is on one scale;
 *   · Original rolls keep the minimum distance from every kit captured on
 *     sink's trumpmorty.fun, parasiteonsol.fun and gotchi.gg; Familiar rolls
 *     start from those kits and land close to one;
 *   · locked groups do not move across 20 rolls, and the unlocked ones do;
 *   · "brutalist newspaper, hard shadows, one loud colour" narrows every
 *     roll to square corners, bold borders, hard shadows, one loud colour and
 *     the faces both words allow; a word no rule knows is said back;
 *   · a re-roll keeps the words a person typed and the parts they deleted;
 *   · the sample page is generic: no picture, nothing captured, a header with
 *     links to its own sections, a first screen with a working Copy and two
 *     buttons, a row of cards, a footer with links, socials and small print;
 *   · "Try these" picks two or three shelf items from different categories,
 *     only ones that work on the published site;
 *   · and how many themes there are, by group.
 *
 *   node --experimental-strip-types tests/site-theme.mjs [the capture folder]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { coherence, contrastRgb, GROUPS, kitDistance, ORIGINAL_DISTANCE, readPhilosophy, rollTheme, rollName, themeCounts, READABLE } from "../src/features/studio/siteTheme.ts";
import { buildStarter } from "../src/features/studio/starterPage.ts";
import { kitsFromDoc } from "../src/features/studio/look/styleKits.ts";

const here = dirname(fileURLToPath(import.meta.url));
let SINK = process.argv[2] ?? process.env.SINK ?? join(here, "..", "capture", "versions", "sink-0ee06fa");
if (!existsSync(join(SINK, "sites")) && existsSync(join(SINK, "..", "..", "sites"))) SINK = join(SINK, "..", "..");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const kitsOf = (site) => {
  const at = join(SINK, "sites", site, "site", "document.json");
  if (!existsSync(at)) return [];
  const d = JSON.parse(readFileSync(at, "utf8"));
  return kitsFromDoc({ nodes: d.nodes, palette: d.look?.palette, name: d.brief?.name, host: d.head?.url ? new URL(d.head.url).host : null });
};
const KITS = ["trumpmorty-fun", "parasiteonsol-fun", "gotchi-gg"].flatMap(kitsOf);
check("kits from three captured boards to measure against", KITS.length >= 30, `${KITS.length} kits`);

/* ------------------------------------------------------------ 50 rolls, coherent */
const PHILOSOPHIES = ["", "", "", "calm pastel", "brutalist newspaper, hard shadows, one loud colour", "dark neon", "playful round"];
let failures = [], minContrast = 99, seen = new Set();
for (let i = 0; i < 50; i++) {
  const phil = readPhilosophy(PHILOSOPHIES[i % PHILOSOPHIES.length]);
  const t = rollTheme({ seed: 1000 + i * 7919, originality: (i % 5) / 4, kits: KITS, ranges: phil.ranges });
  seen.add(t.name);
  const page = buildStarter(t, { pageId: "page_home" });
  const f = coherence(t, page.parts);
  if (f.length) failures.push(`${t.name}: ${f[0]}`);
  for (const p of page.parts) if (p.words) minContrast = Math.min(minContrast, contrastRgb(p.words.colour, p.words.on));
}
check("50 rolls: every rule holds (contrast, one accent family, one radius family, one shadow direction, one spacing scale)", failures.length === 0, failures.slice(0, 3).join(" | "));
check("…the lowest contrast of any words on any roll is at least 4.5 to 1", minContrast >= READABLE, minContrast.toFixed(2));
check("…and they are different themes", seen.size >= 30, `${seen.size} names over 50 rolls`);

/* ------------------------------------------------------------ Familiar and Original */
const originals = Array.from({ length: 30 }, (_, i) => rollTheme({ seed: 77 + i * 104729, originality: 1, kits: KITS }));
const far = originals.map((t) => kitDistance(t, KITS).distance);
check(`Original: every roll is at least ${ORIGINAL_DISTANCE} from every captured kit`, far.every((d) => d >= ORIGINAL_DISTANCE), `nearest ${Math.min(...far).toFixed(3)}`);
const familiar = Array.from({ length: 30 }, (_, i) => rollTheme({ seed: 31 + i * 15485863, originality: 0, kits: KITS }));
const near = familiar.map((t) => kitDistance(t, KITS).distance);
check("Familiar: rolls start from a captured kit and land closer to one than Original ever does", familiar.every((t) => t.made?.from) && near.reduce((a, b) => a + b, 0) / near.length < ORIGINAL_DISTANCE, `mean ${(near.reduce((a, b) => a + b, 0) / near.length).toFixed(3)}, from e.g. ${familiar[0].made?.from}`);

/* ------------------------------------------------------------ locks */
{
  let prev = rollTheme({ seed: 5 });
  const first = prev;
  let colourHeld = true, fontHeld = true, shapesMoved = false, layoutMoved = false;
  for (let i = 0; i < 20; i++) {
    const t = rollTheme({ seed: 900 + i * 31337, prev, locks: ["colours", "fonts"] });
    colourHeld &&= J(t.colours) === J(first.colours);
    fontHeld &&= J(t.fonts) === J(first.fonts);
    shapesMoved ||= J(t.shapes) !== J(first.shapes);
    layoutMoved ||= J(t.layout) !== J(first.layout);
    prev = t;
  }
  check("locked colours and fonts hold across 20 rolls", colourHeld && fontHeld);
  check("…while the unlocked shapes and layout move", shapesMoved && layoutMoved);
  const all = rollTheme({ seed: 4242, prev: first, locks: [...GROUPS] });
  check("…and with every group locked a roll changes nothing but the seed", J({ ...all, seed: 0, name: "", made: null }) === J({ ...first, seed: 0, name: "", made: null }));
}

/* ------------------------------------------------------------ philosophy */
{
  const p = readPhilosophy("brutalist newspaper, hard shadows, one loud colour, zorblax");
  const rolls = Array.from({ length: 30 }, (_, i) => rollTheme({ seed: 11 + i * 2654435761, ranges: p.ranges, originality: 0.5 }));
  check("philosophy: every roll inside it (square, bold border, hard shadows, one loud colour, heavy faces)", rolls.every((t) => t.shapes.corner === "square" && t.shapes.border === "bold" && t.shapes.shadow === "hard" && t.colours.harmony === "mono" && t.colours.chroma === 0.19 && ["grotesk-serif", "condensed-sans"].includes(t.fonts.pairing)), J(rolls.slice(0, 2).map((t) => [t.shapes, t.colours.harmony, t.fonts.pairing])));
  check("…it says what it understood, and the word no rule knows", p.understood.length >= 3 && J(p.unknown) === J(["zorblax"]), J({ understood: p.understood, unknown: p.unknown }));
  const free = Array.from({ length: 30 }, (_, i) => rollTheme({ seed: 11 + i * 2654435761 }));
  check("…where unnarrowed rolls range wider", new Set(free.map((t) => t.shapes.shadow)).size >= 3 && new Set(free.map((t) => t.shapes.corner)).size >= 3);
  const warm = readPhilosophy("warm calm");
  check("colour words narrow the hue: warm stays warm", Array.from({ length: 20 }, (_, i) => rollTheme({ seed: i + 1, ranges: warm.ranges, originality: 0.5 })).every((t) => t.colours.hue >= 330 || t.colours.hue <= 85));
}

/* ------------------------------------------------------------ names */
{
  const t = rollTheme({ seed: 99 });
  check("every roll has a readable name for the undo list", /^Randomize theme: [a-z ,-]+$/.test(rollName(t)) && !/undefined|NaN/.test(rollName(t)), rollName(t));
}

/* ------------------------------------------------------------ the sample page */
{
  const t = rollTheme({ seed: 2024 });
  const page = buildStarter(t, { pageId: "page_home", siteName: "Lumen" });
  const ids = new Set(page.nodes.map((n) => n.id));
  const has = (...xs) => xs.every((x) => ids.has(x));
  check("the sample page: header with the name and links, first screen, copy bar, two buttons, cards, footer", has("st_header", "st_logo", "st_nav_1", "st_nav_2", "st_nav_3", "st_hero_title", "st_hero_line", "st_copy_bar", "st_copy_text", "st_copy_button", "st_button_main", "st_button_other", "st_cards", "st_card_1", "st_card_3", "st_footer", "st_footer_link_1", "st_social_1", "st_footer_small"), [...ids].join(" "));
  check("…generic parts only: nothing captured, no picture", page.nodes.every((n) => !n.from && !n.picture && ["box", "prose", "cta-primary"].includes(n.featureId)));
  check("…the header's links lead to the page's own sections", page.nodes.filter((n) => n.id.startsWith("st_nav_")).every((n) => n.link?.kind === "node" && ids.has(n.link.target)));
  check("…the Copy works on the published page (the library's copy feature, with the address)", page.nodes.find((n) => n.id === "st_copy_button")?.work?.id === "copy-toast");
  check("…the six roles go to the palette and the theme drives Format", page.palette.accent.startsWith("rgb(") && page.format["palette.accentHue"] === t.colours.hue && page.format["layout.shadow"] === t.shapes.shadow);
  // A re-roll keeps what a person wrote and what they deleted.
  const edited = page.nodes.map((n) => (n.id === "st_hero_title" ? { ...n, content: "Lumen makes light" } : n)).filter((n) => n.id !== "st_card_2_line");
  const t2 = rollTheme({ seed: 2025, prev: t });
  const again = buildStarter(t2, { pageId: "page_home", prev: edited, deleted: new Set(["st_card_2_line"]) });
  check("a re-roll keeps the words he typed", again.nodes.find((n) => n.id === "st_hero_title")?.content === "Lumen makes light");
  check("…and a part he deleted stays deleted", !again.nodes.some((n) => n.id === "st_card_2_line"));
}

/* ------------------------------------------------------------ Try these: only working items */
{
  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
  const { pickTryThese, tryable } = await jiti.import(join(here, "..", "src", "features", "studio", "tryThese.ts"));
  const { statusOf, switchOf } = await jiti.import(join(here, "..", "src", "features", "studio", "shelfFacts.ts"));
  const { getFeature } = await jiti.import(join(here, "..", "src", "features", "studio", "catalog.ts"));
  const pool = [...tryable().values()].flat();
  let bad = [], cats = true, sizes = true;
  for (let s = 1; s <= 40; s++) {
    const picks = pickTryThese(s * 7919, 2 + (s % 2));
    sizes &&= picks.length === 2 + (s % 2);
    cats &&= new Set(picks.map((p) => p.category)).size === picks.length;
    for (const p of picks) { const f = getFeature(p.featureId); if (!f || statusOf(f) !== "works" || switchOf(p.featureId) || p.featureId.startsWith("work:")) bad.push(p.featureId); }
  }
  check(`Try these: only items that work on the published site (${pool.length} to choose from)`, bad.length === 0 && pool.length > 10, J(bad));
  check("…two or three, each from a different category", cats && sizes);
  check("…each says what it is and how it is used", pickTryThese(3).every((p) => p.name && /\.$/.test(p.does)));
}

/* ------------------------------------------------------------ reach */
const counts = themeCounts();
console.log(`  note  themes by group: colours ${counts.colours}, fonts ${counts.fonts}, shapes ${counts.shapes}, layout ${counts.layout}, motion ${counts.motion}; in all ${counts.total.toExponential(2)}`);
check("the generator's reach is counted by group", counts.total > 1e12);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
