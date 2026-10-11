/**
 * THE PREVIEW IS THE SITE'S OWN SURFACES (J, 2026-10-09, on PonsStars): the
 * first preview drew one made-up card twice, put the lime words on yellow,
 * and showed yellow cards where only the buttons are yellow. `siteKinds`
 * reads the kinds of surface off the parts. On a PonsStars-like fixture:
 *
 *   1. the dark tabs are a kind, and the lime words are on them, nowhere else;
 *   2. the cream card is a kind with its outline, hard shadow and corners;
 *   3. the yellow gradient buttons are a button kind, standing in the cream card;
 *   4. a white field and a cream card are two kinds, not one;
 *   5. a colour on one or two parts is not a kind; words on nothing stand on the page;
 *   6. kinds are named by what they are for ("Panels", "Fields"), never their colour, never the vague "Main fill";
 *   7. a gradient button is one kind with its stops; 8. a kind carries its parts and the words on it;
 *  12. buttons and surfaces never share a kind (J: the grey "Menu" buttons' Fill showed only on the TV body);
 *  13. a big gradient-painted piece is a kind of its own, named after itself, edited as one gradient.
 *
 *   node tests/theme-kinds.mjs
 */
import { siteKinds } from "../src/features/studio/themeKinds.ts";
import { resizeGlow } from "../src/features/studio/look/siteColours.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const INK = "rgb(26, 15, 11)", CREAM = "rgb(255, 248, 236)", LIME = "rgb(184, 255, 106)", WHITE = "rgb(255, 255, 255)";
const nodes = [];
const add = (n) => nodes.push({ pageId: "p", featureId: "box", ...n });
for (let i = 0; i < 3; i++) {
  const x = i * 400;
  add({ id: `card${i}`, x, y: 0, w: 300, h: 400, radius: 18, colour: { text: INK, bg: CREAM }, edge: { width: 3, style: "solid", colour: INK, shadow: `${INK} 6px 6px 0px 0px` } });
  add({ id: `tab${i}`, featureId: "prose", x: x + 10, y: -10, w: 80, h: 20, radius: 10, content: "LIVE", colour: { text: LIME, bg: INK } });
  add({ id: `btn${i}`, featureId: "cta-primary", x: x + 20, y: 100, w: 200, h: 40, radius: 999, colour: { text: INK }, edge: { width: 3, style: "solid", colour: INK }, art: { background: "radial-gradient(circle at 30% 25%, rgb(255, 243, 176), rgb(243, 212, 64) 60%)" } });
  add({ id: `field${i}`, featureId: "field", x: x + 20, y: 200, w: 200, h: 30, radius: 10, colour: { text: INK, bg: WHITE }, edge: { width: 2, style: "solid", colour: INK } });
  add({ id: `words${i}`, featureId: "prose", x: x + 20, y: 300, w: 200, h: 30, colour: { text: INK } });
}
for (let i = 0; i < 3; i++) add({ id: `ball${i}`, x: 5000 + i * 100, y: 0, w: 22, h: 22, radius: 11, colour: { bg: "rgb(50, 32, 31)" } });
add({ id: "oneoff", x: 2000, y: 0, w: 100, h: 100, colour: { text: INK, bg: "rgb(30, 90, 200)" } });
add({ id: "loose", featureId: "prose", x: 3000, y: 0, w: 100, h: 20, colour: { text: "rgb(17, 17, 17)" } });

const r = siteKinds(nodes, { bg: "rgb(253, 240, 220)" });
const by = (fill) => r.kinds.find((k) => k.fill === fill);
const tabs = by(INK), card = by(CREAM), field = by(WHITE), buttons = r.kinds.find((k) => k.button);
check("1. the dark tabs are a kind with the lime words on them", tabs?.words === LIME, JSON.stringify(tabs));
check("…and no other kind carries lime words", r.kinds.filter((k) => k.words === LIME).length === 1);
check("2. the cream card has its outline, hard shadow and corners", card?.outline?.colour === INK && card.outline.width === 3 && /6px 6px 0px/.test(card.shadow ?? "") && card.radius === 18, JSON.stringify(card));
check("…and its words are the ink, not lime", card?.words === INK);
check("3. the yellow gradient buttons are a button kind", buttons?.fill === "rgb(243, 212, 64)" && buttons.name === "Buttons", JSON.stringify(buttons));
check("…painted with the site's gradient, not flat yellow", /radial-gradient\(.*rgb\(255, 243, 176\).*rgb\(243, 212, 64\)/.test(buttons?.paint ?? ""), buttons?.paint);
check("…and a flat kind paints its fill", card?.paint === CREAM, card?.paint);
check("…standing in the cream card", buttons && r.kinds[buttons.inside] === card);
check("4. a white field and the cream card are two kinds", !!field && field !== card && field.name === "Fields", field?.name);
/* No "Main fill" any more: it told J nothing (2026-10-11); the cards are what they are. */
check("6. names say what a kind is for, never its colour, and none is the vague Main fill", card?.name === "Panels" && tabs?.name === "Labels" && !r.kinds.some((k) => k.name === "Main fill"), r.kinds.map((k) => k.name).join(", "));
check("7. a gradient button is one kind, its stops light first", r.kinds.filter((k) => k.button).length === 1 && JSON.stringify(buttons?.stops) === JSON.stringify(["rgb(255, 243, 176)", "rgb(243, 212, 64)"]), JSON.stringify(buttons?.stops));
check("8. a kind carries every part it is on, and the words on it, so one edit reaches them all", JSON.stringify(card?.ids) === JSON.stringify(["card0", "card1", "card2"]) && ["words0", "words1", "words2"].every((id) => card.wordsIds.includes(id)) && tabs.wordsIds.length === 3, JSON.stringify(card?.wordsIds));
/* Specks are kept as small accents now, a small swatch with no count (J, 2026-10-11: the screws "so all of them can be changed at once"), never a panel. */
const specks = r.kinds.find((k) => k.fill === "rgb(50, 32, 31)");
check("9. a surface of specks (a TV's antenna balls) is a small accent, not a panel", !specks || (specks.accent && !specks.tab && !specks.strip && !specks.piece), r.kinds.map((k) => `${k.name}${k.accent ? "·accent" : ""}`).join(", "));
check("10. a short strip is a tab, drawn over a panel's top; a card or a field is not", tabs?.tab === true && card?.tab === false && field?.tab === false && buttons?.tab === false);
check("5. a one-off colour is not a kind", !r.kinds.some((k) => k.fill === "rgb(30, 90, 200)"));
check("…and words on nothing stand on the page", r.page.words === "rgb(17, 17, 17)", JSON.stringify(r.page));

/* 11. The glow on a kind's words resizes, or comes off, leaving a hard drop shadow under it as it was (J: the WALLET tab's glow smudged its words). */
const TV = "rgba(160, 255, 90, 0.9) 0px 0px 6px, rgb(0, 0, 0) 2px 2px 0px";
check("11. a glow resizes, the drop shadow under it untouched", resizeGlow(TV, "rgba(160, 255, 90, 0.9)", 2) === "rgba(160, 255, 90, 0.9) 0px 0px 2px, rgb(0, 0, 0) 2px 2px 0px", resizeGlow(TV, "rgba(160, 255, 90, 0.9)", 2));
check("…and comes off whole", resizeGlow(TV, "rgba(160, 255, 90, 0.9)", null) === "rgb(0, 0, 0) 2px 2px 0px" && resizeGlow("rgba(160, 255, 90, 0.7) 0px 0px 5px", "rgba(160, 255, 90, 0.7)", null) === undefined);

/* 12–13. PonsStars' plain grey buttons (hidden in menus and tours) and its TV body, repainted a grey-white gradient. */
const GREY = "rgb(239, 239, 239)";
const tv = [];
for (let i = 0; i < 4; i++) tv.push({ id: `grey${i}`, pageId: "p", featureId: "cta-primary", x: i * 80, y: 0, w: 49, h: 21, state: { group: "hidden:menu" }, colour: { text: "rgb(0, 0, 0)", bg: GREY }, edge: { width: 2, style: "solid", colour: "rgb(118, 118, 118)" } });
tv.push({ id: "body", label: "chart-tv-body", pageId: "p", featureId: "box", x: 0, y: 200, w: 844, h: 544, art: { background: `linear-gradient(160deg, rgb(255, 255, 255), ${GREY})` } });
const t = siteKinds(tv, { bg: "rgb(20, 40, 20)" });
const greys = t.kinds.find((k) => k.button), body = t.kinds.find((k) => k.ids.includes("body"));
check("12. buttons and surfaces never share a kind, however close their fills", greys?.ids.length === 4 && !greys.ids.includes("body"), t.kinds.map((k) => `${k.name}:${k.ids}`).join(" "));
check("13. a big gradient piece is a kind of its own, named after itself, as one gradient", body?.name === "Chart TV body" && body.piece === true && body.stops.length === 2 && !body.words && !body.outline, JSON.stringify(body));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
