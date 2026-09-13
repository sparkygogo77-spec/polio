/**
 * Recreating one element from a live site: what it becomes.
 *
 * The claim being held here is the one J made the constraint: the
 * recreation is **editable and promptable**, which means it has to arrive
 * as a real part of the library with the real words in it, the real
 * colours, the real type — not as a picture with fields bolted on. So
 * every check below asks what a person would then see in the Inspector and
 * on the board: which part it is, what is written in it, what colour it is
 * painted, what face it is set in, and that nothing was invented where
 * nothing was measured.
 *
 * The readings are what the browser reports, in the shapes it reports them
 * in: `rgb(…)` strings, CSS pixels, a font stack.
 *
 *   node tests/recreate.mjs
 */
import { readFileSync } from "node:fs";
import {
  FAMILIES, RECREATABLE, SURE_ENOUGH, bare, chroma, colourFrom, familyOf, fontFrom, headline, lines,
  picturesIn, recreateFrom,
} from "../src/features/studio/recreate.ts";
import { FEATURES } from "../src/features/studio/catalog.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* A reading, with the parts a particular element cares about filled in. */
const reading = (o = {}) => ({
  from: { url: "https://acme.example/", host: "www.acme.example", selector: "header", at: 1 },
  box: { x: 0, y: 0, w: 1280, h: 72 },
  down: 0,
  tag: "div",
  role: null,
  text: [],
  links: [],
  buttons: [],
  images: [],
  paint: { bg: "rgb(12, 14, 22)", text: "rgb(240, 240, 245)", border: null, radius: 0, shadow: false },
  type: { family: "Inter, Helvetica, sans-serif", px: 16, weight: 400, spacing: 0, leading: 24 },
  layout: { flow: "row", columns: 1, gap: 24 },
  children: [],
  ...o,
});
const run = (words, px, weight = 400, y = 0) => ({ words, px, weight, y });

/* ------------------------------------------------------------------ */
/* 1. The measurements underneath                                      */
/* ------------------------------------------------------------------ */

check("a colour the browser reported is read", chroma("rgb(230, 40, 40)") > 0.5 && chroma("rgb(128,128,128)") === 0);
check("a see-through background is nothing painted", bare("rgba(0, 0, 0, 0)") && !bare("rgb(0,0,0)"));
check("the biggest run of words is the headline, whatever it was tagged",
  headline(reading({ text: [run("A small label", 12), run("The big line", 54), run("A sentence under it", 18)] }))?.words === "The big line");
check("a font stack is named as one of this app's own, not copied",
  familyOf("Inter, Helvetica, sans-serif") === "grotesque sans" && familyOf("Georgia, serif") === "serif" && familyOf("ui-monospace, Menlo") === "monospace");
check("…and an unknown stack is left for the site to decide", familyOf("Fraktur Nonesuch") === undefined);
/* The faces are named here and defined in `parts/theme.ts`, which this file
   cannot import without dragging the whole render chain into a pure module.
   So the two lists are held together from outside, and a face added there
   and not here fails this rather than silently never being named. */
const theme = readFileSync("src/features/studio/parts/theme.ts", "utf8");
const block = theme.slice(theme.indexOf("export const FAMILY"));
const declared = [...block.slice(0, block.indexOf("\n};")).matchAll(/^\s*"?([a-z ]+)"?:/gm)].map((m) => m[1].trim());
check("every face this can name is a face the app has", FAMILIES.every((f) => declared.includes(f)) && declared.every((f) => FAMILIES.includes(f)),
  `${FAMILIES.length} named, ${declared.length} declared`);
check("and every face it names is one of them", FAMILIES.includes(familyOf("Inter, sans-serif")));
check("contents split on lines, because the real words hold commas",
  lines(["for the builders, believers, and bold thinkers", "1,000,000,000"]) === "for the builders, believers, and bold thinkers\n1,000,000,000");

const type = fontFrom(reading({ type: { family: "Georgia, serif", px: 19, weight: 600, spacing: 0.02, leading: 28 } }));
check("the type is measured and kept relative to the site's", type.family === "serif" && type.size === 1.19 && type.weight === 600, JSON.stringify(type));
check("a size is never copied as a pixel count", typeof type.size === "number" && type.size < 3);

const paint = colourFrom(reading({ paint: { bg: "rgb(12, 14, 22)", text: "rgb(240, 240, 245)", border: "rgb(220, 40, 90)", radius: 0, shadow: false } }));
check("the colours measured are the ones written", paint.bg === "rgb(12, 14, 22)" && paint.text === "rgb(240, 240, 245)");
check("the most coloured thing in it becomes the accent", paint.accent === "rgb(220, 40, 90)");
const nothing = colourFrom(reading({ paint: { bg: "rgba(0,0,0,0)", text: "rgb(20,20,20)", border: null, radius: 0, shadow: false } }));
check("a role nobody measured is left alone, so the part follows the project it lands in",
  nothing.bg === undefined && Object.keys(nothing).length === 1, JSON.stringify(nothing));

/* ------------------------------------------------------------------ */
/* 2. Which part it becomes                                            */
/* ------------------------------------------------------------------ */

const BAR = reading({
  tag: "header", role: "banner", down: 0,
  box: { x: 0, y: 0, w: 1280, h: 72 },
  text: [run("Acme", 20, 700)],
  links: [{ words: "Acme", href: "/" }, { words: "Product", href: "/p" }, { words: "Pricing", href: "/pricing" }, { words: "Docs", href: "/docs" }],
  buttons: ["Sign up"],
});
const bar = recreateFrom(BAR);
check("a wide bar at the top of the page becomes the top bar", bar.patch.featureId === "sticky-header", `${bar.id}, ${bar.sure}`);
check("with the site's own name as its logo, not the word Logo", bar.patch.content.split("\n")[0] === "logo: Acme", bar.patch.content.split("\n")[0]);
check("its real links, in order", bar.patch.content.includes("Product\nPricing\nDocs"));
check("and its real button, by name", bar.patch.content.includes("button: Sign up"));
check("at the size it really was", bar.patch.w === 1280 && bar.patch.h === 72);

const HERO = reading({
  down: 0.1, box: { x: 0, y: 90, w: 1280, h: 520 },
  text: [run("Ship the thing", 64, 700), run("A sentence about shipping the thing.", 20)],
  buttons: ["Start now"],
  images: [{ src: "https://acme.example/hero.jpg", w: 900, h: 600, alt: "a workshop" }],
});
const hero = recreateFrom(HERO);
check("a tall band with one much bigger line becomes the first screen", hero.patch.featureId === "hero-split", hero.id);
check("carrying the real headline and the real sentence", hero.patch.content.startsWith("Ship the thing\nA sentence about"), hero.patch.content.slice(0, 40));

const CARDS = reading({
  down: 0.5, box: { x: 0, y: 900, w: 1200, h: 380 },
  layout: { flow: "grid", columns: 3, gap: 24 },
  children: [{ x: 0, y: 0, w: 380, h: 340 }, { x: 404, y: 0, w: 380, h: 340 }, { x: 808, y: 0, w: 380, h: 340 }],
  text: [run("Fast", 22, 600), run("Cheap", 22, 600), run("Good", 22, 600)],
});
const cards = recreateFrom(CARDS);
check("three boxes of the same size become a card grid", cards.patch.featureId === "card-grid", cards.id);
check("in the number of columns they really were", cards.patch.options?.columns === "3", JSON.stringify(cards.patch.options));
check("with the real card titles in it", cards.patch.content === "Fast\nCheap\nGood", cards.patch.content);

const BUTTON = reading({
  down: 0.3, tag: "a", box: { x: 0, y: 400, w: 168, h: 48 },
  text: [run("Get started", 16, 600)],
  links: [{ words: "Get started", href: "https://acme.example/signup" }],
  paint: { bg: "rgb(220, 40, 90)", text: "rgb(255,255,255)", border: null, radius: 24, shadow: true },
});
const button = recreateFrom(BUTTON);
check("a small painted box with one line in it becomes the main button", button.patch.featureId === "cta-primary", button.id);
check("saying what it really said", button.patch.content === "Get started");
check("going where it really went", button.patch.link?.target === "https://acme.example/signup" && button.patch.link?.kind === "url");
check("and rounded, because it really was", button.patch.shape === "rounded", String(button.patch.shape));

const FOOT = reading({
  tag: "footer", role: "contentinfo", down: 0.94, box: { x: 0, y: 3200, w: 1280, h: 240 },
  links: [{ words: "Terms", href: "/t" }, { words: "Privacy", href: "/p" }, { words: "Contact", href: "/c" }, { words: "Jobs", href: "/j" }],
});
check("the foot of the page becomes a footer", recreateFrom(FOOT).patch.featureId === "footer");
check("naming the site at the foot the way the top does", recreateFrom(FOOT).patch.content.startsWith("logo: acme.example"), recreateFrom(FOOT).patch.content.split("\n")[0]);

const ODD = reading({ down: 0.4, box: { x: 0, y: 1400, w: 640, h: 200 }, text: [run("Something else entirely", 24)] });
const odd = recreateFrom(ODD);
check("an element that is none of those still lands a real part, never nothing", !!odd.patch.featureId && odd.patch.content.includes("Something else entirely"), odd.id);

/* ------------------------------------------------------------------ */
/* 3. Editable and promptable, which is the whole point                */
/* ------------------------------------------------------------------ */

const ids = new Set(FEATURES.map((f) => f.id));
check("every part the catalogue can become is really in the library",
  RECREATABLE.every((c) => ids.has(c.featureId)), RECREATABLE.map((c) => c.featureId).join(", "));
for (const made of [bar, hero, cards, button]) {
  if (!ids.has(made.patch.featureId)) check(`${made.id} lands a real part`, false, made.patch.featureId);
}
check("a recreation is never a picture with fields on it: it is a library part every time",
  [bar, hero, cards, button, odd].every((m) => ids.has(m.patch.featureId) && !m.patch.code && !m.patch.vector));
check("its words are in `content`, where the Inspector edits them and the board draws them",
  [bar, hero, cards, button].every((m) => typeof m.patch.content === "string" && m.patch.content.length > 0));
check("it arrives with a prompt rather than blank, so it can be steered at once",
  [bar, hero, cards].every((m) => m.patch.prompt.includes("acme.example") && m.patch.prompt.length > 40));
check("and it says whose it was, so the panel can say so and read it again",
  bar.patch.from?.host === "www.acme.example" && bar.patch.from?.selector === "header");
check("it is named for what it is and where it came from", bar.patch.label === "Top bar from acme.example", bar.patch.label);
check("nothing is marked custom: these are catalogue parts, not new ideas", [bar, hero, cards, button].every((m) => m.patch.custom === false));

/* ------------------------------------------------------------------ */
/* 4. What measurement cannot give                                     */
/* ------------------------------------------------------------------ */

check("a band with a real photograph in it wants the grounded step", hero.wantsPicture === true);
check("a bar with no pictures does not", bar.wantsPicture === false);
check("an icon-sized image is not a photograph and does not want one",
  picturesIn(reading({ images: [{ src: "i.svg", w: 24, h: 24, alt: "" }] })).length === 0);
check("the threshold is one number, said once", typeof SURE_ENOUGH === "number" && SURE_ENOUGH > 0 && SURE_ENOUGH <= 1);

/* ------------------------------------------------------------------ */

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
