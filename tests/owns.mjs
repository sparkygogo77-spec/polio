/**
 * Who owns what, read off the path the capture recorded.
 *
 * A MEASUREMENT AID, not a correction. Every rule in this app asks geometry —
 * is this box inside that box — and that is false for any element whose
 * children overflow it, are positioned, or sit further off than the reader's
 * reach. The document already carries the answer: every node keeps the DOM
 * path it was read from (`from.selector`, on all 126 nodes of the committed
 * capture-derived document), so a wrapper's true children are the nodes whose
 * path CONTINUES its own.
 *
 *   node tests/owns.mjs
 */
import { adrift, escaping, grown, grownSays, grownTo, owned, pathOf, under } from "../src/features/studio/owns.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const n = (id, sel, x, y, w, h) => ({ id, pageId: "p0", featureId: "box", x, y, w, h, content: "", from: { url: "u", host: "h", selector: sel, at: 1 } });

check("a path that continues another is under it", under("body > main", "body > main > div"));
check("…however deep", under("body > main", "body > main > div > div > span"));
check("a path is not under itself", !under("body > main", "body > main"));
/*
 * THE SEPARATOR IS CHECKED, not just the prefix. Without it
 * `div:nth-of-type(1)` reads as the parent of `div:nth-of-type(11)`, and a
 * wrapper silently acquires a sibling's whole subtree.
 */
/*
 * THE SEPARATOR IS CHECKED, not just the prefix — and the case is reachable,
 * not theoretical. `path()` emits a bare tag when it is the only one of its
 * kind among its siblings, and `p` is a prefix of `pre`: without the
 * separator, a paragraph would be read as the parent of everything inside a
 * `pre` beside it, and would acquire its whole subtree.
 *
 * My first fixture for this used `div:nth-of-type(1)` against
 * `div:nth-of-type(11)`, which cannot collide — the closing bracket separates
 * them — so the check passed with the guard removed and proved nothing.
 */
check("a sibling whose name merely starts the same is NOT under it",
  !under("body > p", "body > pre > code"));
check("…while a real child of it still is", under("body > p", "body > p > em"));
check("and neither is an unrelated path", !under("body > main", "body > aside > div"));
check("a part with no recorded path owns nothing and is owned by nothing",
  pathOf({ ...n("x", "", 0, 0, 10, 10), from: null }) === "" && !under("", "body > main"));

/* ------------------------------------------------------------------ */
/* His banner, as the capture left it                                  */
/* ------------------------------------------------------------------ */

/*
 * The header wrapper's own rect is 1763x82 at y 0; the logo it contains
 * overflows to y -11 and runs 112 tall. Geometry says the wrapper holds
 * nothing of the sort. The path says it holds both.
 */
const header = [
  n("banner", "body > div > header", 0, 0, 1763, 82),
  n("logo", "body > div > header > div > img", 826, -11, 112, 112),
  n("mark", "body > div > header > div > span", 40, 19, 300, 30),
  n("main", "body > div > main", 0, 150, 1763, 400),
  n("para", "body > div > main > p", 40, 170, 800, 40),
];
check("the banner owns the logo that hangs out of it, which geometry denies",
  owned(header, header[0]).map((f) => f.id).sort().join(",") === "logo,mark",
  JSON.stringify(owned(header, header[0]).map((f) => f.id)));
check("…and owns nothing belonging to the section beside it",
  !owned(header, header[0]).some((f) => f.id === "para"));

const off = adrift(header);
check("the banner is reported adrift from what it owns", off.some((a) => a.id === "banner"), JSON.stringify(off.map((a) => a.id)));
const b = off.find((a) => a.id === "banner");
check("…by 11px upward, which is exactly the logo's overhang", b?.dy === -11, String(b?.dy));
check("…and 30px short of holding it", b?.dh === 30, String(b?.dh));
check("…while still overlapping its contents, so it is drift and not a clean separation", b?.touches === true);
/*
 * AND THE SECTION IS REPORTED TOO, WHICH IS THE POINT. Its paragraph sits
 * 20px inside it — that is its PADDING, and the wide measure reads it as
 * 20px of drift and 360px of excess height. On the committed
 * capture-derived document the wide measure flags 31 wrappers and only TWO
 * have a child escaping: the other 29 are padding, and a rule built on the
 * wide measure would strip it from every one of them.
 */
check("the section that merely has padding is reported by the WIDE measure as well",
  off.some((a) => a.id === "main" && a.dy === 20 && a.dh === -360), JSON.stringify(off.find((a) => a.id === "main")));
check("…but nothing of its own ESCAPES it, so the narrow measure passes over it",
  escaping(header, header[3]).length === 0 && grown(header, header[3]) === null);
check("the banner's logo DOES escape it, which is the fault itself",
  escaping(header, header[0]).map((f) => f.id).join(",") === "logo", JSON.stringify(escaping(header, header[0]).map((f) => f.id)));
check("…and growing it to hold what it owns moves it UP and makes it TALLER, never down and never shorter",
  (() => {
    const g = grown(header, header[0]);
    return !!g && g.y === -11 && g.h === 112 && g.y < header[0].y && g.h > header[0].h;
  })(), JSON.stringify(grown(header, header[0])));
check("…and it keeps its own width, so nothing is trimmed sideways either",
  grown(header, header[0])?.w === 1763);

/* Pages do not mix, and neither do parts nobody captured. */
check("a part on another page is never owned, however the paths line up",
  owned([...header, { ...n("other", "body > div > header > div > b", 0, 0, 10, 10), pageId: "p1" }], header[0]).length === 2);
check("a part that was drawn rather than captured owns nothing",
  owned(header, { ...header[0], from: null }).length === 0);

/* ------------------------------------------------------------------ */
/* Grow-only, which is the rule that was authorised                     */
/* ------------------------------------------------------------------ */

/*
 * MEASURED BEFORE IT WAS BUILT. On his nine pages and 631 nodes: 35 wrappers,
 * 652px of lift, 1548px of growth. The naive rule — put the wrapper where its
 * contents are — flags 31 of 126 on the committed capture-derived document
 * against this rule's 2, and 29 of those 31 differ from their contents only
 * by their own PADDING. That number is the argument against ever widening
 * this, and it is why the shrink guard is a guard and not a preference.
 */
const board = [
  ...header,
  /* His Your Tokens panel, at his geometry: 1507x172 at y 1247, with its own
     heading and sentences ABOVE it. His owns nine parts and all nine escape;
     three are enough to hold the rule, and the 225px lift is his number. */
  n("panel", "body > div > section", 256, 1247, 1507, 172),
  n("head", "body > div > section > h2", 300, 1022, 400, 40),
  n("none", "body > div > section > p", 300, 1160, 900, 30),
  n("line", "body > div > section > p:nth-of-type(2)", 300, 1192, 900, 30),
];
const grew = grownTo(board);
check("the banner and the panel are both put back round what they own",
  grew.map((g) => g.id).sort().join(",") === "banner,panel", JSON.stringify(grew.map((g) => g.id)));
check("…the panel lifted by 225px, which is his number exactly",
  grew.find((g) => g.id === "panel")?.was.y - grew.find((g) => g.id === "panel")?.y === 225,
  `${grew.find((g) => g.id === "panel")?.was.y} → ${grew.find((g) => g.id === "panel")?.y}`);
check("…and every part it owns was outside it, which is the shape of his nine",
  (() => { const p = grew.find((g) => g.id === "panel"); return p?.owns === 3 && p?.escaped === 3; })(),
  JSON.stringify(grew.find((g) => g.id === "panel")));

/*
 * OUT, NEVER IN. Every one of these lifts a box or makes it bigger. That is
 * what makes it safe beside the healing, which only ever pushes DOWN to clear
 * an overlap: the two cannot fight, because the correction's whole purpose is
 * to stop the overlap existing.
 */
check("every change is a lift or a growth — nothing moves down and nothing shrinks",
  grew.every((g) => g.y <= g.was.y && g.x <= g.was.x && g.w >= g.was.w && g.h >= g.was.h),
  JSON.stringify(grew.map((g) => ({ dy: g.y - g.was.y, dh: g.h - g.was.h }))));
check("the section that merely has padding is NOT touched, which is the whole 29-in-31 point",
  !grew.some((g) => g.id === "main"), JSON.stringify(grew.map((g) => g.id)));
check("a box his hand placed is never grown, whatever it owns",
  grownTo(board.map((f) => (f.id === "panel" ? { ...f, byHand: true } : f))).every((g) => g.id !== "panel"));
check("a part that was drawn rather than captured is never grown",
  grownTo(board.map((f) => (f.id === "panel" ? { ...f, from: null } : f))).every((g) => g.id !== "panel"));
check("and the line a person reads says the lift and the growth, and that nothing went the other way",
  /px of lift/.test(grownSays(grew)) && /nothing moved down or got smaller/.test(grownSays(grew)), grownSays(grew));
check("with nothing adrift, it says that instead", /already holds/.test(grownSays([])), grownSays([]));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
