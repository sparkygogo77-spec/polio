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
  ...["Burn Tokens", "Cleanup", "API"].map((t, i) => node(
    `${p}_s${i}`, p, "cta-primary", t, 16, 1716 + i * 60, 223, 56,
    { options: { shape: "square", variant: "outline", size: "medium" },
      colour: { text: i === 0 ? "rgb(0, 255, 0)" : "oklch(0.707 0.022 261.325)" } },
  )),
];
const nodes = PAGES.flatMap(parts);
const PER_PAGE = 16;

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
    h: n.h, accent: n.colour?.accent ?? null, variant: (n.options ?? {}).variant ?? null,
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
  const bad = PAGES.filter((pg) => Object.keys(after.by[pg] ?? {}).length !== 13);
  return bad.length === 0 || (console.log(`      pages not at 13 parts: ${bad.map((b) => `${b}=${Object.keys(after.by[b] ?? {}).length}`).join(", ")}`), false);
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
check("…and both empty wrappers are gone from all nine",
  PAGES.every((pg) => !after.by[pg]?.[`${pg}_76`] && !after.by[pg]?.[`${pg}_53`]));

/*
 * THE PAINT THE CAPTURE DROPPED, on every page too. A tenth of the button's
 * own green over the card behind it is `rgb(19, 48, 31)`, which is what the
 * other lane arrived at from the opposite direction by re-reading the
 * capture. And it must be told it is SOLID, because that is the branch of
 * `Cta.tsx` that draws a fill at all: `ghost` fills with `accent + "22"`,
 * which against an `rgb(...)` string is not a colour, so it drew nothing.
 */
check("the active time button got its tint back, on all nine pages",
  PAGES.every((pg) => after.by[pg]?.[`${pg}_t1`]?.accent === "rgb(19, 48, 31)"),
  PAGES.map((pg) => after.by[pg]?.[`${pg}_t1`]?.accent).join(" | "));
check("…and is solid now, so there is a fill to draw",
  PAGES.every((pg) => after.by[pg]?.[`${pg}_t1`]?.variant === "solid"),
  PAGES.map((pg) => after.by[pg]?.[`${pg}_t1`]?.variant).join(","));
check("the active sidebar entry got its tint back too, over the PAGE and with no accent to read",
  PAGES.every((pg) => after.by[pg]?.[`${pg}_s0`]?.accent === "rgb(14, 44, 23)"),
  PAGES.map((pg) => after.by[pg]?.[`${pg}_s0`]?.accent).join(" | "));
check("…and the two muted entries beside it, whose colour nothing here can even parse, are untouched",
  PAGES.every((pg) => ["s1", "s2"].every((e) => after.by[pg]?.[`${pg}_${e}`]?.accent == null && after.by[pg]?.[`${pg}_${e}`]?.variant === "outline")));
check("…while the three time buttons that were never active are untouched",
  PAGES.every((pg) => ["t0", "t2", "t3"].every((t) =>
    after.by[pg]?.[`${pg}_${t}`]?.accent === "rgb(45, 55, 72)" && after.by[pg]?.[`${pg}_${t}`]?.variant === "outline")));

/* The safeguards, on the path that runs without being asked. */
check("the box his hand placed survives on every page, untouched",
  PAGES.every((pg) => after.by[pg]?.[`${pg}_mine`]?.h === 90), "90 everywhere");
check("the empty box that shows a background survives on every page",
  PAGES.every((pg) => after.by[pg]?.[`${pg}_band`]?.h === 60), "60 everywhere");

check("the document is marked with the version of the rules it went through", after.swept === 2, String(after.swept));
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
const already = await open(doc({ swept: 2 }));
const kept = await read(already.p);
check("a board already swept at this version is not swept again",
  kept.total === PAGES.length * PER_PAGE, `${kept.total} parts`);
check("…so nothing it holds is touched a second time",
  kept.by.page_home?.page_home_75?.h === 82 && !!kept.by.page_home?.page_home_95
  && kept.by.page_home?.page_home_t1?.accent === "rgb(0, 255, 0)");
await already.ctx.close();

/* And a board marked at an OLDER version is swept again, which is what makes
   bumping `SWEEP` the whole of "put every board right again". */
const stale = await open(doc({ swept: 0 }));
const fresh = await read(stale.p);
check("a board marked at an older version IS swept again",
  fresh.total === PAGES.length * 13 && fresh.swept === 2, `${fresh.total} parts, mark ${fresh.swept}`);
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
check("…and is marked, so it is never asked again", mine.swept === 2, String(mine.swept));
await his.ctx.close();

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
