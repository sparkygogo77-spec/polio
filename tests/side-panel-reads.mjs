/**
 * The side panel reads a captured site the way a person does, not the way
 * the capture's machinery does. The pure halves, with no server:
 *
 *   · a part is named by its words, the name the browser gave it, or what
 *     it is and the heading of its section, never "div · 1 inside",
 *     "::after · 0 inside", "main · 7 inside (h)" or "n_box_63";
 *   · a captured prompt says "From trumpmorty.fun, …" and the element path
 *     stays inside the document: the panel's text has no path in it, and
 *     putting the owner's words back keeps the capture's sentence whole;
 *   · words inside a link or a button are that control's label;
 *   · a captured site's Format values are read off its parts (light page,
 *     the accent worn most, the face on the biggest words, the corners most
 *     boxes have) and the ones that change nothing on it are hidden, while a
 *     value the owner set is theirs;
 *   · close shades group round the one most parts wear, within a small
 *     OKLab distance, and far colours stay apart;
 *   · the words' contrast is measured against the fill they sit on, so
 *     near-black words on a yellow card read clearly whatever the roles say;
 *   · the re-import line is short and names nothing; the details name parts
 *     readably, and "idless" takes the sweep's id lists out.
 *
 * Every site here is made up for the test: the rules are general.
 *
 *   node tests/side-panel-reads.mjs
 */
import { capturedFrom, idless, insideControl, isMachineLabel, partName } from "../src/features/studio/partNames.ts";
import { CAPTURE_HIDES, isCaptured, readSiteFormat, siteSays } from "../src/features/studio/siteFormat.ts";
import { closeShades, oklabDistance, tallyColours, tallyFonts, wordsContrast } from "../src/features/studio/look/siteColours.ts";
import { facetSays, keptSays, keptShort } from "../src/features/studio/reimport.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (v) => JSON.stringify(v);

/* A small captured page: a yellow section with a heading, a card, a decoration, a button with words. */
const PATH = "body > main > section:nth-of-type(1) > div";
const nodes = [
  { id: "n_box_1", pageId: "p", label: "section · 4 inside", x: 0, y: 0, w: 1440, h: 900, colour: { bg: "rgb(243, 212, 64)" }, radius: 24, from: { host: "comic.example", selector: "body > main > section:nth-of-type(1)" } },
  { id: "n_box_2", pageId: "p", label: "h2 · 0 inside", content: "Meet the Crew", font: { face: "Bangers", size: 64 }, colour: { text: "rgb(20, 20, 20)" }, x: 100, y: 40, w: 700, h: 80, from: { host: "comic.example", selector: "body > main > section:nth-of-type(1) > h2" } },
  { id: "n_box_3", pageId: "p", label: "div · 1 inside", x: 100, y: 200, w: 400, h: 300, colour: { bg: "rgb(242, 226, 129)" }, radius: 24, prompt: `Captured from comic.example/ as ${PATH}. The box, the words, the colours and the type are the ones measured on the page.`, from: { host: "comic.example", selector: PATH } },
  { id: "n_box_4", pageId: "p", label: "::after · 0 inside", x: 120, y: 220, w: 40, h: 40, colour: { bg: "rgb(240, 223, 123)" }, radius: 24, from: { host: "comic.example", selector: `${PATH}::after` } },
  { id: "n_box_5", pageId: "p", label: "span", content: "Buy the comic", font: { face: "Comic Neue", size: 16 }, colour: { text: "rgb(20, 20, 20)" }, x: 600, y: 300, w: 160, h: 40, radius: 12, from: { host: "comic.example", selector: "body > main > section:nth-of-type(1) > a > span" } },
  { id: "n_box_6", pageId: "p", label: "p · 0 inside", content: "A weekly strip.", font: { face: "Comic Neue", size: 16 }, colour: { text: "rgb(20, 20, 20)" }, x: 120, y: 280, w: 300, h: 40, from: { host: "comic.example", selector: `${PATH} > p` } },
  { id: "n_box_7", pageId: "p", label: "button · 0 inside", prompt: "The browser computes it as a button, named “Open menu”.", x: 1300, y: 20, w: 40, h: 40, from: { host: "comic.example", selector: "body > header > button" } },
];

/* ------------------------------------------------ names */
check("the capture's names for its boxes are machinery", ["div · 1 inside", "::after · 0 inside", "main · 7 inside (h)", "n_box_63", "span", ""].every(isMachineLabel));
check("…and a name an owner gives is not", !isMachineLabel("Hero card") && !isMachineLabel("Buy button") && !isMachineLabel("logo mark"));
const names = Object.fromEntries(nodes.map((n) => [n.id, partName(n, nodes)]));
check("a part with words is named by them", names.n_box_2 === "Meet the Crew" && names.n_box_5 === "Buy the comic", J(names));
check("a part the browser named is named that way", names.n_box_7 === "Button “Open menu”", names.n_box_7);
check("a box that holds words is named by them", names.n_box_3 === "Box “A weekly strip.”", names.n_box_3);
check("a ::after is a decoration in its section", names.n_box_4 === "Decoration in “Meet the Crew”", names.n_box_4);
check("no name printed is machinery", Object.values(names).every((s) => !/inside|n_box|::|·/.test(s)), J(names));

/* A long page like Trump & Morty's, made up: a hero heading, then sections with their own headings, and a footer. */
const TITLES = ["The Lore", "How to buy", "Live chart", "Roadmap", "Join the crew"];
const longPage = [
  { id: "hero", pageId: "q", label: "section · 2 inside", x: 0, y: 0, w: 1440, h: 800, from: { selector: "body > main > section:nth-of-type(1)" } },
  { id: "hero-h", pageId: "q", label: "h1 · 0 inside", content: "PORTAL PALS", font: { size: 96 }, x: 100, y: 100, w: 900, h: 120, from: { selector: "body > main > section:nth-of-type(1) > h1" } },
  { id: "hero-pic", pageId: "q", label: "div · 0 inside", x: 900, y: 300, w: 400, h: 400, from: { selector: "body > main > section:nth-of-type(1) > div" } },
  ...TITLES.flatMap((t, i) => [
    { id: `s${i}`, pageId: "q", label: "section · 3 inside", x: 0, y: 900 + i * 900, w: 1440, h: 800, from: { selector: `body > main > section:nth-of-type(${i + 2})` } },
    { id: `s${i}-h`, pageId: "q", label: "h2 · 0 inside", content: t, font: { size: 48 }, x: 100, y: 960 + i * 900, w: 600, h: 60, from: { selector: `body > main > section:nth-of-type(${i + 2}) > h2` } },
    { id: `s${i}-big`, pageId: "q", label: "span · 0 inside", content: `${(i + 1) * 100}%`, font: { size: 72 }, x: 800, y: 1100 + i * 900, w: 300, h: 90, from: { selector: `body > main > section:nth-of-type(${i + 2}) > span` } },
    { id: `s${i}-card`, pageId: "q", label: "div · 0 inside", x: 100, y: 1300 + i * 900, w: 400, h: 200, from: { selector: `body > main > section:nth-of-type(${i + 2}) > div` } },
  ]),
  { id: "foot", pageId: "q", label: "footer · 2 inside", x: 0, y: 5500, w: 1440, h: 200, from: { selector: "body > footer" } },
  { id: "foot-w", pageId: "q", label: "p · 0 inside", content: "Not financial advice.", font: { size: 14 }, x: 100, y: 5560, w: 400, h: 20, from: { selector: "body > footer > p" } },
];
const sectionNames = TITLES.map((_, i) => partName(longPage.find((n) => n.id === `s${i}`), longPage));
check("each section is named by its own first heading, never the page's first", sectionNames.every((nm, i) => nm === `Section “${TITLES[i]}”`), JSON.stringify(sectionNames));
check("a part in a section takes that section's heading, not a bigger number beside it", partName(longPage.find((n) => n.id === "s3-card"), longPage) === "Box in “Roadmap”", partName(longPage.find((n) => n.id === "s3-card"), longPage));
check("a footer is named by what it holds, never \"in\" the section above it", partName(longPage.find((n) => n.id === "foot"), longPage) === "Footer “Not financial advice.”", partName(longPage.find((n) => n.id === "foot"), longPage));
check("an empty footer is just a footer", partName({ id: "f2", pageId: "q", label: "footer · 0 inside", x: 0, y: 6000, w: 1440, h: 100, from: { selector: "body > footer" } }, longPage) === "Footer");
check("a captured section says it is from its own heading", capturedFrom({ ...longPage.find((n) => n.id === "s1"), prompt: "Captured from portal.example/ as body > main > section:nth-of-type(3). The box." }, longPage)?.says === "From portal.example, the “How to buy” section");

/* ------------------------------------------------ where it came from */
const from = capturedFrom(nodes[2], nodes);
check("a captured prompt says where from, plainly", from?.says === "From comic.example, the “Meet the Crew” section", from?.says);
check("…with no element path in anything shown", !/body|>|nth-of-type/.test(`${from?.says} ${from?.rest}`), J(from));
check("…and the owner's words go back behind the capture's sentence, whole", `${from.prefix}${from.rest}` === nodes[2].prompt);
const edited = capturedFrom({ ...nodes[2], prompt: `${from.prefix}Make it wobble.` }, nodes);
check("…an edit keeps the path inside the document", edited.rest === "Make it wobble." && edited.prefix.includes(PATH));
check("a button's words are its label", insideControl(nodes[4]) && insideControl(nodes[6]) && !insideControl(nodes[5]));

/* ------------------------------------------------ format */
check("a document with captured parts is a captured site", isCaptured({ nodes }) && !isCaptured({ nodes: [{ id: "a" }] }));
const reads = readSiteFormat({ nodes }, "rgb(243, 212, 64)");
check("the theme is read off the page's colour: a yellow page is light", reads["palette.mode"]?.value === "light", J(reads["palette.mode"]));
const hue = reads["palette.accentHue"]?.value;
check("the accent hue is the yellow the site wears, not 265", typeof hue === "number" && hue > 60 && hue < 120, J(reads["palette.accentHue"]));
check("the heading font is the face on the biggest words", reads["type.headingFamily"]?.shows === "Bangers", J(reads["type.headingFamily"]));
check("the body font is the face on most of the rest", reads["type.bodyFamily"]?.shows === "Comic Neue", J(reads["type.bodyFamily"]));
check("the corner radius is the corners most boxes have", reads["layout.radius"]?.value === 24, J(reads["layout.radius"]));
check("the stack is hidden, not guessed", siteSays("build.stack", true, reads, {}, "x").kind === "hidden" && CAPTURE_HIDES.has("type.scale"));
check("a value the owner set is theirs", siteSays("layout.radius", true, reads, { "layout.radius": 4 }, 10).kind === "owner");
check("a site made here reads nothing and hides nothing", Object.keys(readSiteFormat({ nodes: [{ id: "a", content: "Hi" }] }, "#000")).length === 0 && siteSays("build.stack", false, {}, {}, "x").kind === "plain");

/* ------------------------------------------------ close shades */
const tally = tallyColours(nodes);
const fills = closeShades(tally.byUse.fill, "fill", 0.08);
check("close yellows are one group, round the one worn most", fills.length === 1 && fills[0].from.length >= 1, J(fills.map((g) => [g.to.key, g.from.map((c) => c.key)])));
check("the three shades from the walk are close in OKLab", oklabDistance("rgb(242, 226, 129)", "rgb(240, 223, 123)") < 0.02, String(oklabDistance("rgb(242, 226, 129)", "rgb(240, 223, 123)")));
check("…and yellow and near-black are not", oklabDistance("rgb(243, 212, 64)", "rgb(20, 20, 20)") > 0.5);
const tight = closeShades(tally.byUse.fill, "fill", 0.01);
check("a tighter distance merges less", tight.reduce((n, g) => n + g.from.length, 0) < fills.reduce((n, g) => n + g.from.length, 0), J(tight.map((g) => g.from.length)));

/* ------------------------------------------------ contrast on what the words sit on */
const cons = wordsContrast(nodes, { bg: "rgb(20, 20, 20)", text: "rgb(20, 20, 20)" });
check("near-black words on a yellow card read clearly, whatever the roles say", cons.length >= 2 && cons.every((c) => c.ratio >= 4.5), J(cons));

/* ------------------------------------------------ a face on many parts */
/* The walk's VT323 case, made up: 27 parts in one face, labels inside links among them, the same words on several. Every one is counted, by id, never by name. */
const pixel = Array.from({ length: 27 }, (_, i) => ({ id: `n_px_${i}`, pageId: "p", label: i % 2 ? "span" : "a · 1 inside", content: i % 4 ? `Score ${i}` : "Play", font: { face: "Pixel Mono", size: 14 }, x: 0, y: i * 30, w: 200, h: 26, from: { selector: i % 2 ? `body > a > span` : "body > div" } }));
const px = tallyFonts([...nodes, ...pixel]).find((f) => f.key === "Pixel Mono");
check("a face on 27 parts counts all 27, labels in links and repeated words among them", px?.parts === 27 && new Set(px.ids).size === 27, J(px && { parts: px.parts, ids: px.ids.length }));
check("…each one keeps a name of its own to be listed by", new Set(pixel.map((n) => n.id)).size === 27 && pixel.every((n) => partName(n, pixel) && !/inside|n_px/.test(partName(n, pixel))));

/* ------------------------------------------------ the re-import line */
const kept = { edited: [{ id: "n_box_63", label: partName(nodes[2], nodes), facets: ["x", "work/marquee/middle"] }], added: ["n_hand_1"], stayDeleted: 2, gone: 1, fresh: 3, doc: [], by: "record" };
const short = keptShort(kept);
check("the short line is short and names nothing", short.length < 120 && !/n_[a-z]+_\d|inside|·/.test(short), short);
const long = keptSays(kept);
check("the details name parts readably, facets in words", /Box “A weekly strip.” \(position, the marquee feature's middle\)/.test(long) && !/n_box/.test(long), long);
check("a facet in words", facetSays("w") === "size" && facetSays("content") === "words");
const sweep = "2 boxes hold nothing and were left alone: n_box_63, n_box_70. 1 duplicate box removed, each with its twin left in place: n_box_9→n_box_8. main · 7 inside (h) was fitted.";
check("idless takes the sweep's ids and box names out", !/n_box|inside|·/.test(idless(sweep)) && /left alone\./.test(idless(sweep)), idless(sweep));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
