/**
 * A captured control keeps its own clothes, and still works.
 *
 * HIS RULING. `cta-primary` hardcoded everything about how it looked: its
 * words in the accent's contrast colour, weight 700, a 2px edge in the
 * accent, and the label in the middle. That is right for a button somebody
 * drags out of the library and wrong for one that came off his page, where
 * the sidebar entries are grey at weight 400, unedged, and set left beside
 * an icon. So a captured control was either faithful and dead, or working
 * and restyled. He ruled: get both.
 *
 * The rule, in one line: **the node where the node spoke, the part's own
 * where it did not.** `Theme.said` (see `NodeSaid` in `parts/theme.ts`)
 * records which of colour, alignment and edge a node named for itself, so a
 * part can tell HIS choice from the SITE's default — `t.textAlign` reads
 * "left" whether he said left or nobody said anything, and a button reading
 * it directly would quietly un-centre every hand-placed button on a left-set
 * page. Weight and letter-spacing need no flag: `t.fontWeight` is set only
 * from a node's own font, so `?? 700` is already "his, else mine".
 *
 * Two halves, and the first one is the one that matters most:
 *
 *   · a node that says NOTHING draws exactly the literals it always drew —
 *     700, the accent, the accent's contrast colour, 2px, centred. Held here
 *     as values, and held as pixels by the before/after shot in the report:
 *     the same 29 hand-placed buttons came back byte-identical across the
 *     change;
 *   · a node that speaks is obeyed, and is still a button: it navigates.
 *
 *   npx next start -p 3013
 *   node tests/button-own.mjs http://127.0.0.1:3013
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

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});

/* His sidebar entry, as a capture measures it: grey words on the page's own
   ground, weight 400, set left, with no edge at all. */
const GREY = "rgb(138, 141, 148)";
const GROUND = "rgb(17, 18, 20)";

const doc = JSON.stringify({ state: {
  pages: [
    { id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" },
    { id: "p1", name: "About", path: "/about", prompt: "", scroll: "inherit" },
  ],
  nodes: [
    /* Says nothing. Must not move. */
    node("plain", "cta-primary", "Get started", 80, 80, 260, 56),
    /* Says everything: his sidebar entry. */
    node("caught", "cta-primary", "Portfolio", 80, 200, 260, 56, {
      colour: { bg: GROUND, text: GREY },
      font: { weight: 400 },
      text: { align: "left" },
      edge: { style: "none" },
      link: { kind: "page", target: "p1" },
    }),
    /* Says only a weight: the rest must stay the library's. Nothing here is
       all-or-nothing — each field is honoured on its own. */
    node("part-said", "cta-primary", "Half", 80, 320, 260, 56, { font: { weight: 400 } }),
    /* An edge he DID draw, rather than one he removed: a hairline. */
    node("edged", "cta-primary", "Edged", 80, 440, 260, 56, { edge: { width: 1, style: "solid", colour: GREY } }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

const read = async () => page.evaluate(() => {
  const out = {};
  for (const el of document.querySelectorAll("[data-node-id]")) {
    const b = el.querySelector("button");
    if (!b) continue;
    const c = getComputedStyle(b);
    out[el.getAttribute("data-node-id")] = {
      weight: c.fontWeight, colour: c.color, fill: c.backgroundColor,
      edge: `${c.borderTopWidth} ${c.borderTopStyle}`, edgeColour: c.borderTopColor,
      justify: c.justifyContent,
      own: b.getAttribute("data-cta-own") ?? "",
      boxEdge: (() => { const w = el.querySelector("[data-part-box]"); return w ? `${getComputedStyle(w).borderTopWidth} ${getComputedStyle(w).borderTopStyle}` : null; })(),
    };
  }
  return out;
});
const on = await read();
check("all four buttons drew", Object.keys(on).length === 4, Object.keys(on).join(", "));

/* ------------------------------------------------------------------ */
/* 1. A node that says nothing is the library's button, unchanged       */
/* ------------------------------------------------------------------ */

const plain = on.plain ?? {};
check("a hand-placed button is still weight 700", plain.weight === "700", plain.weight);
check("…still filled with the accent, not transparent", plain.fill !== "rgba(0, 0, 0, 0)" && plain.fill !== "transparent", plain.fill);
check("…still sets its words in the accent's contrast colour, not the site's text colour", plain.colour !== GREY, plain.colour);
check("…still carries its own 2px edge", plain.edge === "2px solid", plain.edge);
check("…still centres its label", plain.justify === "center", plain.justify);
check("…and is marked as having honoured nothing, because it was told nothing", plain.own === "", plain.own || "(nothing)");
check("…and gets no box wrapper at all, so nothing round it moved", plain.boxEdge === null, String(plain.boxEdge));

/* ------------------------------------------------------------------ */
/* 2. A captured control is obeyed, field by field                      */
/* ------------------------------------------------------------------ */

const caught = on.caught ?? {};
check("his weight is the weight", caught.weight === "400", caught.weight);
check("his grey is the colour of the words, not the accent's contrast colour", caught.colour === GREY, caught.colour);
check("the accent is not painted over the ground he measured", caught.fill === "rgba(0, 0, 0, 0)", caught.fill);
check("his words sit left, where his page set them", caught.justify === "flex-start", caught.justify);
check("no 2px edge of the library's inside the edge he chose", caught.edge === "0px none" || caught.edge.startsWith("0px"), caught.edge);
check("…and the box round it draws his 'none' rather than an edge he never had", caught.boxEdge === "0px none", String(caught.boxEdge));
check("and the part says which of them were his", caught.own === "weight colour fill align edge", caught.own || "(nothing)");

/* ------------------------------------------------------------------ */
/* 2b. Field by field, not all or nothing                               */
/* ------------------------------------------------------------------ */

const half = on["part-said"] ?? {};
check("a node that names only a weight gets its weight", half.weight === "400", half.weight);
check("…and keeps the library's fill, colour, edge and centring for everything it did not name",
  half.fill === plain.fill && half.colour === plain.colour && half.edge === "2px solid" && half.justify === "center",
  `${half.fill} / ${half.colour} / ${half.edge} / ${half.justify}`);
check("…and says so", half.own === "weight", half.own || "(nothing)");

const edged = on.edged ?? {};
check("an edge he drew is drawn, at his width and in his colour", edged.boxEdge === "1px solid", String(edged.boxEdge));
check("…and the button puts none of its own inside it", edged.edge.startsWith("0px"), edged.edge);

/* ------------------------------------------------------------------ */
/* 3. Faithful AND alive: it is still a button                          */
/* ------------------------------------------------------------------ */

await page.goto(`${URL_}/builder/preview/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1600);
const liveStyle = await page.evaluate(() => {
  const b = document.querySelector('[data-live-node="caught"] button');
  if (!b) return null;
  const c = getComputedStyle(b);
  return { weight: c.fontWeight, colour: c.color, justify: c.justifyContent };
});
check("the live page draws it the same way the board does", !!liveStyle && liveStyle.weight === "400" && liveStyle.colour === GREY && liveStyle.justify === "flex-start", JSON.stringify(liveStyle));
const where = await page.evaluate(() => document.querySelector("[data-live-page]")?.getAttribute("data-live-page") ?? "");
const target = await page.locator('[data-live-node="caught"] button').first().boundingBox();
if (target) {
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
  await page.waitForTimeout(1200);
}
const went = await page.evaluate(() => document.querySelector("[data-live-page]")?.getAttribute("data-live-page") ?? "");
check("and pressing it still goes where it points: kept its clothes, kept its job", went === "p1", `${where || "?"} → ${went || "nowhere"}`);

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
