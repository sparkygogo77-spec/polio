/**
 * ONE PART, ON EVERY PAGE (J, 2026-10-11, on the PonsStars redesign): Colours
 * counted the Departments rail and its buttons once per page, "Panels: Pending
 * review, 20", when they are one rail. A part that repeats across pages is one
 * thing in every count and every name:
 *
 *   1. the same data-hook on several pages is one part; rows sharing a hook on one page stay rows;
 *   2. with no hook, the same part in the same place with the same words and paint is one part;
 *   3. a kind worn only by one rail drawn on seven pages is not a kind of three or more;
 *   4. a kind's count and name read the rail once, not once per page.
 *
 *   node tests/repeats.mjs
 */
import { repeatsAcrossPages, thingsIn } from "../src/features/studio/repeats.ts";
import { siteKinds } from "../src/features/studio/themeKinds.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const INK = "rgb(26, 15, 11)", CREAM = "rgb(255, 248, 236)", WOOD = "rgb(110, 50, 20)";
const PAGES = ["home", "play", "board", "profiles", "how", "admin", "charts"];

/* 1–2 */
const a = [
  { id: "h1", pageId: "home", x: 0, y: 0, w: 200, h: 40, hooks: { "data-hook": "rail-play" } },
  { id: "h2", pageId: "play", x: 0, y: 30, w: 200, h: 40, hooks: { "data-hook": "rail-play" } },
  { id: "r1", pageId: "board", x: 0, y: 100, w: 400, h: 30, hooks: { "data-hook": "row" } },
  { id: "r2", pageId: "board", x: 0, y: 140, w: 400, h: 30, hooks: { "data-hook": "row" } },
  { id: "r3", pageId: "home", x: 0, y: 100, w: 400, h: 30, hooks: { "data-hook": "row" } },
  { id: "f1", pageId: "home", x: 0, y: 900, w: 1200, h: 80, featureId: "box", content: "Test networks only", colour: { bg: INK } },
  { id: "f2", pageId: "play", x: 1, y: 901, w: 1200, h: 80, featureId: "box", content: "Test networks only", colour: { bg: INK } },
  { id: "f3", pageId: "play", x: 0, y: 500, w: 1200, h: 80, featureId: "box", content: "Something else", colour: { bg: INK } },
];
const once = repeatsAcrossPages(a);
check("1. one hook on two pages is one part", once.get("h2") === once.get("h1"));
check("…rows sharing a hook on one page stay two rows, and the page with the most of them sets the count", thingsIn(["r1", "r2", "r3"], once) === 2, JSON.stringify([...once]));
check("2. no hook: the same footer in the same place is one part", once.get("f2") === once.get("f1"));
check("…and a different part on that page is not", once.get("f3") === "f3");

/* 3–4: a wooden rail with a cream label and two cream tabs on seven pages, and three real cream cards on one page. */
const nodes = [];
for (const p of PAGES) {
  nodes.push({ id: `rail-${p}`, pageId: p, featureId: "box", x: 0, y: 0, w: 160, h: 1400, colour: { bg: WOOD }, hooks: { "data-hook": "departments" } });
  nodes.push({ id: `tag-${p}`, pageId: p, featureId: "box", x: 10, y: 260, w: 100, h: 60, content: "Pending review", colour: { text: INK, bg: CREAM }, hooks: { "data-hook": "departments-tag" } });
  nodes.push({ id: `tab1-${p}`, pageId: p, featureId: "box", x: 10, y: 340, w: 120, h: 60, content: "Play", colour: { text: INK, bg: CREAM }, hooks: { "data-hook": "departments-play" } });
  nodes.push({ id: `tab2-${p}`, pageId: p, featureId: "box", x: 10, y: 420, w: 120, h: 60, content: "Leaderboard", colour: { text: INK, bg: CREAM }, hooks: { "data-hook": "departments-board" } });
}
/* Two of the cards say "Rules": the site's own label, said by two parts; the rail's, by one part drawn seven times. */
for (let i = 0; i < 3; i++) nodes.push({ id: `card${i}`, pageId: "home", featureId: "box", x: 300 + i * 320, y: 100, w: 300, h: 400, content: ["Rules", "Rules", "Stakes"][i], colour: { text: INK, bg: CREAM }, hooks: { "data-hook": `card-${i}` } });
const r = siteKinds(nodes, { bg: "rgb(240, 220, 180)" });
const cream = r.kinds.find((k) => k.fill === CREAM);
check("3. a rail drawn on seven pages is one part, not a kind of seven", !r.kinds.some((k) => k.fill === WOOD), r.kinds.map((k) => `${k.name}:${k.parts}`).join(", "));
check("4. the cream kind counts the rail's three parts once and the three cards: six, not 24", cream?.parts === 6, `${cream?.name}: ${cream?.parts}`);
check("…but still carries every copy, so one edit reaches every page", cream?.ids.length === 24);
check("…and says what most of its parts say, the rail's words read once, not once per page", cream?.sample === "Rules", `${cream?.name} / ${cream?.sample}`);

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
