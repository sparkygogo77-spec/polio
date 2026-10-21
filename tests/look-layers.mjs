/**
 * A SECTION'S BACKGROUND, AND THE PAGE'S, READ AS A STACK OF LAYERS.
 *
 * J (2026-10-21): hide lives in a layer list in the Look panel, as the
 * background's layers. thesolface.site's hero background is already a stack
 * of parts (the coordinator's reading of a fresh import, c562f58), bottom to
 * top: the section's fill, the frog picture, a vertical fade (`::after`),
 * masked grid lines, the green glows; and over them the hero's film. Page-wide,
 * pinned to the window: a progress bar, an SVG grain, the cursor glow, and a
 * film of the body.
 *
 * `layersOf` reads that stack off the parts: a section's own fill first, then
 * each wordless part placed out of the flow straight in it (or a ::before /
 * ::after of one), in paint order, then the films laid on it or on them. The
 * page's: each wordless part pinned straight to the body, then the films on
 * it. Each layer has a plain name and whether its eye is open. A film the
 * stretch guard holds back reads closed until its eye is opened, and opening
 * it (`hidden: false`) draws it after all.
 *
 *   node tests/look-layers.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
const { layersOf } = await jiti.import(join(here, "..", "src", "features", "studio", "look", "layers.ts"));
const { filmPic } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "primitives.tsx"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const H = "body > main > section:nth-of-type(1)";
const part = (id, featureId, selector, x, y, w, h, extra = {}) => ({ id, pageId: "home", featureId, label: id, content: "", x, y, w, h, from: { selector, ...(extra.position ? { position: extra.position } : {}) }, ...extra });
const pic = (w, h, moving) => ({ id: `pic_${w}x${h}`, path: "assets/pictures/p.webp", type: "image/webp", w, h, bytes: 0, alt: "", from: "upload", ...(moving ? { moving: { kind: moving } } : {}) });
/* thesolface as the import leaves it, in the order the parts stand in the document. */
const nodes = [
  part("art", "box", `${H} > div:nth-of-type(1)`, 0, -1, 1440, 991, { position: "absolute", picture: pic(1560, 878) }),
  part("fade", "box", `${H} > div:nth-of-type(1)::after`, 0, -1, 1440, 991, { position: "absolute", art: { background: "linear-gradient(0deg, rgb(8, 11, 19) 0%, rgba(0, 0, 0, 0) 28%)" } }),
  part("grid", "box", `${H} > div:nth-of-type(2)`, 0, -1, 1440, 991, { position: "absolute", art: { background: "linear-gradient(rgba(86, 235, 218, 0.094) 1px, rgba(0, 0, 0, 0) 1px), linear-gradient(90deg, rgba(86, 235, 218, 0.094) 1px, rgba(0, 0, 0, 0) 1px)", mask: "radial-gradient(black, transparent)" } }),
  part("glows", "box", `${H} > div:nth-of-type(3)`, 0, -1, 1440, 991, { position: "absolute", art: { background: "radial-gradient(33% 45% at 80% 54%, rgba(85, 255, 129, 0.26), rgba(0, 0, 0, 0)), radial-gradient(circle at 20% 30%, rgba(23, 234, 166, 0.2), rgba(0, 0, 0, 0))" } }),
  part("hero", "box", H, 0, 0, 1440, 997, { colour: { bg: "rgb(9, 13, 27)" } }),
  part("wrap", "box", `${H} > div:nth-of-type(4)`, 50, 109, 1340, 881, { position: "relative" }),
  part("frog", "picture", `${H} > div:nth-of-type(4) > div:nth-of-type(2) > img:nth-of-type(1)`, 1049, 145, 690, 863, { position: "absolute", picture: pic(1122, 1402) }),
  part("badge", "box", `${H} > div:nth-of-type(4) > div:nth-of-type(2) > div:nth-of-type(3)`, 1295, 685, 120, 120, { position: "absolute", content: "VISION MODE ON." }),
  part("strip", "box", `${H} > div:nth-of-type(5)`, 720, 953, 1340, 12, { position: "absolute" }),
  part("stripWords", "prose", `${H} > div:nth-of-type(5) > span:nth-of-type(1)`, 720, 953, 168, 12, { content: "CONTRACT WITH THE CULTURE" }),
  part("cursorGlow", "box", "body > div:nth-of-type(3)", 327, 320, 450, 450, { position: "fixed", art: { background: "radial-gradient(circle, rgba(53, 255, 138, 0.075), rgba(0, 0, 0, 0) 70%)", blend: "screen" } }),
  part("grain", "box", "body > div:nth-of-type(2)", 0, 0, 1440, 900, { position: "fixed", art: { background: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise'/%3E%3C/filter%3E%3C/svg%3E\")" } }),
  part("bar", "box", "body > div:nth-of-type(1)", 0, 0, 1440, 3, { position: "fixed", colour: { bg: "rgb(27, 32, 49)" } }),
  part("skip", "cta-primary", "body > a", 12, -90, 148, 53, { position: "fixed", content: "Skip to content" }),
  part("heroFilm", "picture", `${H}::frames`, 0, 0, 1440, 991, { picture: pic(512, 320, "pointer"), label: "Moving picture of section · 5 inside" }),
  part("glowFilm", "picture", "body > div:nth-of-type(3)::frames", -97, 293, 450, 450, { position: "fixed", picture: pic(353, 341, "live"), label: "Moving picture of div" }),
  part("bodyFilm", "picture", "body::frames", 32, 1880, 656, 112, { position: "absolute", picture: pic(512, 87, "once"), label: "Moving picture of the page" }),
];

/* A copy of a layer that only a press shows (`state`) is not drawn as the page opens: it is not a layer (J's board read Fade 2 and Picture 2 from them). */
nodes.push({ ...nodes[0], id: "artPressed", state: { group: "page_home:g0", option: 0 } }, { ...nodes[1], id: "fadePressed", state: { group: "page_home:g0", option: 0 } });
const hero = layersOf(nodes, "hero");
const names = (ls) => ls.map((l) => l.name).join(" | ");
check("the hero's stack, bottom to top: Fill, Picture, Fade, Lines, Glow, Moving picture", names(hero) === "Fill | Picture | Fade | Lines | Glow | Moving picture", names(hero));
check("…each layer the part that draws it", hero.map((l) => l.id).join(",") === "hero,art,fade,grid,glows,heroFilm", hero.map((l) => l.id).join(","));
check("not the frog picture or the VISION badge inside the hero's content, nor the strip holding words", !hero.some((l) => ["frog", "badge", "strip", "wrap"].includes(l.id)));
check("nor a copy that only a press shows", !hero.some((l) => ["artPressed", "fadePressed"].includes(l.id)), hero.map((l) => l.id).join(","));
check("the fill stays at the foot: it is not one that moves", hero[0].fixed === true && hero.slice(1).every((l) => !l.fixed));
check("every eye is open, except the film the stretch guard holds back (2.81×)", hero.filter((l) => !l.on).map((l) => l.id).join(",") === "heroFilm", JSON.stringify(hero.map((l) => [l.id, l.on])));
check("…and that one says why", /blur|stretch/i.test(hero.find((l) => l.id === "heroFilm").why ?? ""), hero.find((l) => l.id === "heroFilm").why);
check("a swatch for each: the fill's colour, a gradient as it paints", hero[0].swatch === "rgb(9, 13, 27)" && /radial-gradient/.test(hero.find((l) => l.id === "glows").swatch));

const pg = layersOf(nodes, null);
check("the page's stack, bottom to top: the glow, grain and bar pinned to the window, then its films, a repeated name numbered", names(pg) === "Glow | Grain | Bar | Moving picture | Moving picture 2", names(pg));
check("…in paint order, and not the skip link (it holds words)", pg.map((l) => l.id).join(",") === "cursorGlow,grain,bar,glowFilm,bodyFilm", pg.map((l) => l.id).join(","));
check("the cursor glow's film reads closed: its part is pinned to the window", pg.find((l) => l.id === "glowFilm")?.on === false);
check("the grain says it could be the site's texture", pg.find((l) => l.id === "grain")?.texture === true);

/* An eye shut, and a held film's eye opened. */
const shut = layersOf(nodes.map((n) => (n.id === "fade" ? { ...n, hidden: true } : n)), "hero");
check("a part set hidden reads with its eye shut", shut.find((l) => l.id === "fade").on === false);
const opened = nodes.map((n) => (n.id === "heroFilm" ? { ...n, hidden: false } : n));
check("a held film whose eye is opened (hidden: false) reads open", layersOf(opened, "hero").find((l) => l.id === "heroFilm").on === true);
check("…and is drawn: its picture is no longer marked held", !filmPic(opened.find((n) => n.id === "heroFilm")).moving.pinned && filmPic(opened.find((n) => n.id === "heroFilm")).moving.shown === true);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
