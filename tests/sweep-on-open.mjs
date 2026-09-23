/**
 * A CAPTURED BOARD IS PUT RIGHT WHEN IT OPENS — every page, once, one undo.
 *
 * WHY THIS EXISTS. Three fixes landed, merged and deployed, and his board did
 * not move by a byte: the rebuilds were correct and reached a stored document,
 * but only when a person pressed a command. The cheap answer — press the two
 * commands — turned out to be eighteen steps across nine pages, which is a
 * chore rather than a fix. His words about boxes coming out wrong were "it
 * should be done automatically properly".
 *
 * So the sweep runs on open, and this holds the three promises it makes to
 * somebody whose document is being rewritten without being asked:
 *
 *  - EVERY PAGE, not the one on screen. Nine pages here, and the check is
 *    that the eight he is not looking at change too.
 *  - ONE CHECKPOINT. Automatic removal is only acceptable if a single undo
 *    puts every part back — so undo is pressed, and the whole document must
 *    come back, every page of it.
 *  - ONCE PER DOCUMENT. Reload and nothing further happens, and a board
 *    already marked is left alone.
 *
 * And the safeguards are re-checked here rather than trusted from the pure
 * tests, because this is the path that runs without being asked: nothing his
 * hand placed is touched, and a wrapper showing a surface of its own stays.
 *
 * Against a PRODUCTION build: dev and production render different custom
 * properties, so a height read off one says nothing about the other.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/sweep-on-open.mjs http://127.0.0.1:3013
 */
import { SWEEP } from "../src/features/studio/reassemble.ts";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const FROM = { url: "https://solworks.dev/", host: "solworks.dev", selector: "header > div", at: 1 };
const node = (id, pageId, f, content, x, y, w, h, extra = {}) => ({
  id, pageId, featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null,
  sketch: null, from: FROM, byHand: false, ...extra,
});

/* His nine pages, each carrying the same faults at his own numbers. */
const PAGES = ["page_home", "page_docs", "page_about", "page_feed", "page_burn", "page_stats", "page_faq", "page_terms", "page_contact"];
const parts = (p) => [
  /* The price pair: two parts, 22px apart, that should be one sentence. */
  node(`${p}_92`, p, "prose", "$ 116.59", 1084, 65, 59, 40),
  node(`${p}_95`, p, "prose", "-1.94 %", 1165, 65, 43, 32, { colour: { text: "rgb(239,68,68)" } }),
  /* The banner over its empty div: 33px of dead space under its only child. */
  node(`${p}_75`, p, "box", "", 0, 200, 1763, 82),
  node(`${p}_76`, p, "box", "", 0, 200, 1280, 49),
  /* An empty wrapper of its own. */
  node(`${p}_53`, p, "box", "", 0, 600, 1457, 148),
  /* And the two that must survive it, on every page. */
  node(`${p}_mine`, p, "box", "", 0, 900, 800, 90, { byHand: true }),
  node(`${p}_band`, p, "box", "", 0, 1100, 1763, 60, { colour: { surface: "rgb(17,17,17)" } }),
  /*
   * HIS ROW OF TIME BUTTONS, on the card they sit on. The active one lost its
   * translucent tint to a capture that could not read `oklab()`, so it
   * arrived carrying a border colour and nothing at all to draw.
   */
  node(`${p}_card`, p, "box", "", 256, 1300, 1507, 350, { colour: { bg: "rgb(21, 25, 34)", surface: "rgb(21, 25, 34)" } }),
  ...["1D", "1W", "1M", "3M"].map((t, i) => node(
    `${p}_t${i}`, p, "cta-primary", t, 1475 + i * 44, 1320, 39, 26,
    t === "1W"
      ? { options: { shape: "square", variant: "ghost", size: "medium" }, colour: { text: "rgb(0, 255, 0)", accent: "rgb(0, 255, 0)" } }
      : { options: { shape: "square", variant: "outline", size: "medium" }, colour: { text: "rgb(255, 255, 255)", accent: "rgb(45, 55, 72)" } },
  )),
  /*
   * AND HIS DOCS SIDEBAR, which is the same fault with none of the same
   * handholds: no accent field anywhere — the ink is in `colour.text` — and
   * not one painted box behind the entries, so the tint went straight onto
   * the page. Three of these, so there is a majority to be odd against.
   */
  node(`${p}_shelf`, p, "box", "", 0, 1700, 255, 200),
  /*
   * THE SAME BOX EMITTED TWICE, in both of his shapes: the content panel
   * pixel-identical to itself, and the sidebar pair one pixel apart in width.
   * Plus the pair that DISAGREES on height, which must survive whole.
   */
  node(`${p}_d1`, p, "box", "", 1468, 393, 270, 26),
  node(`${p}_d2`, p, "box", "", 1468, 393, 270, 26),
  node(`${p}_rail1`, p, "box", "", 0, 2000, 256, 440),
  node(`${p}_rail2`, p, "box", "", 0, 2000, 255, 440),
  node(`${p}_tall1`, p, "box", "", 0, 2500, 256, 528),
  node(`${p}_tall2`, p, "box", "", 0, 2500, 255, 431),
  ...["Burn Tokens", "Cleanup", "API"].map((t, i) => node(
    `${p}_s${i}`, p, "cta-primary", t, 16, 1716 + i * 60, 223, 56,
    { options: { shape: "square", variant: "outline", size: "medium" },
      colour: { text: i === 0 ? "rgb(0, 255, 0)" : "oklch(0.707 0.022 261.325)" } },
  )),
];
const nodes = PAGES.flatMap(parts);
const PER_PAGE = 22;

const doc = (extra = {}) => JSON.stringify({ state: {
  pages: PAGES.map((id, i) => ({ id, name: id.slice(5), path: i ? `/${id.slice(5)}` : "/", prompt: "", scroll: "inherit" })),
  nodes, groups: [], shapes: [], format: {}, brief: { name: "SOLWORKS", gimmick: "", master: "" },
  frameWidth: 1763, activePageId: "page_home", trail: [],
  /* The page's own background: what the browser composited the tint against
     where no box behind it paints anything. */
  look: { palette: { bg: "rgb(16, 21, 26)", text: "rgb(255, 255, 255)" }, texture: [], target: "page" },
  ...extra,
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });

/** Open the Builder on a document and hand back the page, still open. */
async function open(d) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  await ctx.addInitScript((x) => localStorage.setItem("builder.studio", x), d);
  const p = await ctx.newPage();
  await p.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(3000);
  return { ctx, p };
}
const read = (p) => p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}")?.state ?? {};
  const by = {};
  for (const n of s.nodes ?? []) (by[n.pageId] ??= {})[n.id] = {
    h: n.h, bg: n.colour?.bg ?? null, accent: n.colour?.accent ?? null, variant: (n.options ?? {}).variant ?? null,
    words: typeof n.content === "string" ? n.content : (n.content ?? []).map((r) => r.text).join(""),
  };
  return { total: (s.nodes ?? []).length, by, swept: s.swept ?? null };
});

/* ------------------------------------------------------------------ */
/* 1. Nine pages, opened once, nothing pressed                         */
/* ------------------------------------------------------------------ */

const { ctx, p } = await open(doc());
const after = await read(p);

check("every page was swept, not only the one on screen", (() => {
  const bad = PAGES.filter((pg) => Object.keys(after.by[pg] ?? {}).length !== 19);
  return bad.length === 0 || (console.log(`      pages not at 19 parts: ${bad.map((b) => `${b}=${Object.keys(after.by[b] ?? {}).length}`).join(", ")}`), false);
})(), `${after.total} parts, was ${PAGES.length * PER_PAGE}`);
check("…the price pair is one part on ALL NINE, not just the open one",
  PAGES.every((pg) => !!after.by[pg]?.[`${pg}_92`] && !after.by[pg]?.[`${pg}_95`]),
  PAGES.filter((pg) => after.by[pg]?.[`${pg}_95`]).join(", ") || "merged on all nine");
check("…reading as his page does, with the space the gap says belongs there",
  PAGES.every((pg) => after.by[pg]?.[`${pg}_92`]?.words === "$ 116.59 -1.94 %"),
  JSON.stringify(after.by.page_contact?.page_contact_92?.words));
check("…the banner is fitted on all nine, giving back its 33px",
  PAGES.every((pg) => after.by[pg]?.[`${pg}_75`]?.h === 49),
  PAGES.map((pg) => after.by[pg]?.[`${pg}_75`]?.h).join(","));
/*
 * AND NOTHING IS DELETED. Both empty wrappers on his home page turned out to
 * be real surfaces that had slid below the content they own — the banner with
 * its whole header above it, the Your Tokens panel with its heading above it.
 * Deleting those takes them off the page for good, so an empty wrapper is now
 * reported and left exactly where it is.
 */
check("the two empty wrappers are STILL THERE, on every page, untouched",
  PAGES.every((pg) => after.by[pg]?.[`${pg}_76`]?.h === 49 && after.by[pg]?.[`${pg}_53`]?.h === 148),
  `${after.by.page_home?.page_home_76?.h} and ${after.by.page_home?.page_home_53?.h}`);
check("…and the sweep said so, rather than leaving him to notice",
  /hold nothing and were left alone/.test(await p.evaluate(() => document.body.innerText)));

/*
 * THE PAINT THE CAPTURE DROPPED, on every page too. A tenth of the button's
 * own green over the card behind it is `rgb(19, 48, 31)`, which is what the
 * other lane arrived at from the opposite direction by re-reading the
 * capture. And it must be told it is SOLID, because that is the branch of
 * `Cta.tsx` that draws a fill at all: `ghost` fills with `accent + "22"`,
 * which against an `rgb(...)` string is not a colour, so it drew nothing.
 */
check("the active time button got its tint back, on all nine pages",
  PAGES.every((pg) => after.by[pg]?.[`${pg}_t1`]?.bg === "rgb(19, 48, 31)"),
  PAGES.map((pg) => after.by[pg]?.[`${pg}_t1`]?.bg).join(" | "));
check("…in the role that fills the box to its edge, leaving its variant and its own colour alone",
  PAGES.every((pg) => after.by[pg]?.[`${pg}_t1`]?.variant === "ghost" && after.by[pg]?.[`${pg}_t1`]?.accent === "rgb(0, 255, 0)"),
  `${after.by.page_home?.page_home_t1?.variant} accent ${after.by.page_home?.page_home_t1?.accent}`);
check("the active sidebar entry got its tint back too, over the PAGE and with no accent to read",
  PAGES.every((pg) => after.by[pg]?.[`${pg}_s0`]?.bg === "rgb(14, 44, 23)"),
  PAGES.map((pg) => after.by[pg]?.[`${pg}_s0`]?.bg).join(" | "));
check("…and the two muted entries beside it, whose colour nothing here can even parse, are untouched",
  PAGES.every((pg) => ["s1", "s2"].every((e) => after.by[pg]?.[`${pg}_${e}`]?.bg == null && after.by[pg]?.[`${pg}_${e}`]?.variant === "outline")));

/*
 * AND IT ACTUALLY PAINTS, which is the only claim that matters. A colour
 * written into a role nothing reads looks exactly like doing nothing, and the
 * role that fills a control changed underneath this work when the chrome lane
 * moved a node's fill out to the wrapper. So the board is asked what colour
 * is really there, and the inactive button beside it is asked too — a check
 * that only looked at the active one would pass just as well if every button
 * on the page had been painted.
 */
const drawn = await p.evaluate(() => {
  const res = {};
  for (const el of document.querySelectorAll("[data-node-id]")) {
    const id = el.getAttribute("data-node-id");
    /*
     * The part's OWN body, and nothing else inside the node. A selected part
     * on the board carries a label plate of its own, painted in the Builder's
     * chrome colour — reading "the first painted thing in here" finds that on
     * every part and reports a fill where there is none.
     */
    for (const e of [el.querySelector("[data-part-box]"), el.querySelector("[data-part]"), el.querySelector("button")].filter(Boolean)) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") { res[id] = c; break; }
    }
  }
  return res;
});
check("the active time button DRAWS the tint on the board, not just carries it",
  drawn.page_home_t1 === "rgb(19, 48, 31)", String(drawn.page_home_t1));
check("…and the inactive one beside it draws nothing, so this painted one button and not the row",
  drawn.page_home_t0 == null, String(drawn.page_home_t0));
check("the active sidebar entry draws its own, over the page",
  drawn.page_home_s0 === "rgb(14, 44, 23)", String(drawn.page_home_s0));
check("…and the muted entries beside it draw nothing",
  drawn.page_home_s1 == null && drawn.page_home_s2 == null, `${drawn.page_home_s1} ${drawn.page_home_s2}`);

check("…while the three time buttons that were never active are untouched",
  PAGES.every((pg) => ["t0", "t2", "t3"].every((t) =>
    after.by[pg]?.[`${pg}_${t}`]?.bg == null && after.by[pg]?.[`${pg}_${t}`]?.variant === "outline")));

/*
 * THE SAME BOX EMITTED TWICE, taken out on every page — a separate pass from
 * the wrapper one, and safe for one reason only: an identical twin remains.
 */
check("the pixel-identical pair loses one copy on all nine pages",
  PAGES.every((pg) => !!after.by[pg]?.[`${pg}_d1`] !== !!after.by[pg]?.[`${pg}_d2`]),
  PAGES.map((pg) => `${!!after.by[pg]?.[`${pg}_d1`]}/${!!after.by[pg]?.[`${pg}_d2`]}`).join(" "));
check("…and the sidebar pair, one pixel apart in width, loses one too",
  PAGES.every((pg) => !!after.by[pg]?.[`${pg}_rail1`] !== !!after.by[pg]?.[`${pg}_rail2`]));
/*
 * AND THE PAIR THAT DISAGREES ON HEIGHT KEEPS BOTH — which is not free, and
 * is the sharpest thing this check holds. The taller of the two CONTAINS the
 * shorter, so the wrapper pass fits it from 528 down to 431 — and at that
 * point the two are the same box, and a dedupe reading the result would
 * delete one on the strength of a height THIS CODE chose rather than one the
 * page had. So the dedupe reads the document as it was saved. A box may only
 * be removed for something the capture said.
 */
/*
 * AND THE PAIR THAT DISAGREES ON HEIGHT KEEPS BOTH — which is not free, and
 * is the sharpest thing this check holds. The taller of the two CONTAINS the
 * shorter, so the wrapper pass fits it from 528 down to 431 — and at that
 * moment the two ARE the same box, and a dedupe reading the result deletes
 * one on the strength of a height THIS CODE chose rather than one the page
 * had. That is what it did until this check caught it. So the dedupe reads
 * the document as it was SAVED: a box may only be removed for something the
 * capture said.
 */
check("…but the pair that DISAGREES on height keeps BOTH, because removing one would choose a height",
  PAGES.every((pg) => !!after.by[pg]?.[`${pg}_tall1`] && !!after.by[pg]?.[`${pg}_tall2`]),
  `${after.by.page_home?.page_home_tall1?.h} and ${after.by.page_home?.page_home_tall2?.h}`);
check("…and it said which copy went and which twin it left",
  /twin left in place/.test(await p.evaluate(() => document.body.innerText)));

/* The safeguards, on the path that runs without being asked. */
/*
 * AND THE ONE THAT MATTERS MOST: the dedupe must never reach an empty wrapper
 * that has slid below its contents. Losing his banner by a second route would
 * be the same mistake twice, so it is asserted rather than left to luck.
 */
check("the two empty wrappers are untouched by the dedupe as well as by the fitting",
  PAGES.every((pg) => !!after.by[pg]?.[`${pg}_76`] && !!after.by[pg]?.[`${pg}_53`]));

check("the box his hand placed survives on every page, untouched",
  PAGES.every((pg) => after.by[pg]?.[`${pg}_mine`]?.h === 90), "90 everywhere");
check("the empty box that shows a background survives on every page",
  PAGES.every((pg) => after.by[pg]?.[`${pg}_band`]?.h === 60), "60 everywhere");

check("the document is marked with the version of the rules it went through", after.swept === SWEEP, String(after.swept));
const said = await p.evaluate(() => document.body.innerText);
check("and it said so out loud rather than changing his board in silence",
  /put right when it opened/i.test(said) && /undo/i.test(said),
  (said.match(/[^\n]*put right when it opened[^\n]*/) ?? ["not said"])[0]);

/* ------------------------------------------------------------------ */
/* 2. ONE undo puts the whole document back                            */
/* ------------------------------------------------------------------ */

await p.keyboard.press("Control+z");
await p.waitForTimeout(1200);
const undone = await read(p);
check("one undo brings back every part the sweep removed, on every page",
  undone.total === PAGES.length * PER_PAGE, `${undone.total} parts, was ${PAGES.length * PER_PAGE}`);
check("…including the pages he was not looking at",
  PAGES.slice(1).every((pg) => !!undone.by[pg]?.[`${pg}_95`] && !!undone.by[pg]?.[`${pg}_76`]));
check("…and the banner is back at the height his capture recorded",
  PAGES.every((pg) => undone.by[pg]?.[`${pg}_75`]?.h === 82));
await ctx.close();

/* ------------------------------------------------------------------ */
/* 3. Once per document                                                */
/* ------------------------------------------------------------------ */

/* A board already marked at this version is left exactly as it is, even
   though it is full of things a sweep would change. */
const already = await open(doc({ swept: SWEEP }));
const kept = await read(already.p);
check("a board already swept at this version is not swept again",
  kept.total === PAGES.length * PER_PAGE, `${kept.total} parts`);
check("…so nothing it holds is touched a second time",
  kept.by.page_home?.page_home_75?.h === 82 && !!kept.by.page_home?.page_home_95
  && kept.by.page_home?.page_home_t1?.bg == null);
await already.ctx.close();

/* And a board marked at an OLDER version is swept again, which is what makes
   bumping `SWEEP` the whole of "put every board right again". */
const stale = await open(doc({ swept: SWEEP - 1 }));
const fresh = await read(stale.p);
check("a board marked at an older version IS swept again",
  fresh.total === PAGES.length * 19 && fresh.swept === SWEEP, `${fresh.total} parts, mark ${fresh.swept}`);
await stale.ctx.close();

/* ------------------------------------------------------------------ */
/* 4. A board nobody captured is never touched                         */
/* ------------------------------------------------------------------ */

/*
 * The same question `onRehydrateStorage` asks about whose boxes these are.
 * No repository, no part carrying the element it came off, no layout,
 * padding, edge or text setting — the board is his, drawn and placed, and
 * two parts deliberately over each other is a design and not a fault.
 */
const hand = JSON.stringify({ state: {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: parts("page_home").map(({ from: _f, ...n }) => ({ ...n, byHand: undefined })),
  groups: [], shapes: [], format: {}, brief: { name: "MINE", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "page_home", trail: [],
}, version: 0 });
const his = await open(hand);
const mine = await read(his.p);
check("a board nobody captured is not swept at all", mine.total === PER_PAGE, `${mine.total} parts`);
check("…and is marked, so it is never asked again", mine.swept === SWEEP, String(mine.swept));
await his.ctx.close();

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
