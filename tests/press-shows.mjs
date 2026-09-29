/**
 * WHAT A PRESS SHOWS, ATTACHED.
 *
 * sink presses each option of a row of cards or buttons and keeps what it
 * changed (`behaviours.states`: the part pressed, the parts it shows, the
 * page's own parts they stand in for; the shown parts marked `state`).
 * Taking the document in attaches `Show on press` to each pressed part with
 * those lists, so the Preview and the published page play it; the board
 * lays out the page as it opens.
 *
 *   node --experimental-strip-types tests/press-shows.mjs
 */
import { attachCaptured } from "../src/features/studio/library/captured.ts";
import { BEHAVIOURS } from "../src/features/studio/library/behaviours.ts";
import * as fluidSite from "../src/features/studio/fluidSite.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${detail}`}`);
};
const part = (id, extra = {}) => ({ id, pageId: "page_home", featureId: "box", x: 0, y: 0, w: 10, h: 10, ...extra });
const nodes = [
  part("card_mochi"), part("card_pup"), part("name_mochi", { featureId: "prose", content: "mochi" }),
  part("name_pup", { featureId: "prose", content: "pup", state: { group: "page_home:g1", option: 1 } }),
  part("card_pup_on", { state: { group: "page_home:g1", option: 1 } }),
];
const behaviours = { version: 1, states: [{ page: "page_home", group: "page_home:g1", option: 1, name: "pup", part: "card_pup", shows: ["name_pup", "card_pup_on", "gone"], hides: ["name_mochi", "card_pup"] }] };
const out = attachCaptured(nodes, behaviours);
const pup = out.find((n) => n.id === "card_pup");
const use = (pup?.work?.uses ?? (pup?.work ? [pup.work] : [])).find((u) => u?.id === "press-shows") ?? null;
check("the pressed card carries Show on press", !!use, JSON.stringify(pup?.work));
check("…showing pup's parts, the ones that exist", use?.inputs?.shows === "name_pup,card_pup_on", JSON.stringify(use?.inputs));
check("…in place of the page's own", use?.inputs?.hides === "name_mochi,card_pup", JSON.stringify(use?.inputs));
check("…with its group, so the presses take turns", use?.inputs?.group === "page_home:g1", JSON.stringify(use?.inputs));
check("the shown parts keep their state mark", out.filter((n) => n.state).length === 2);
check("the feature is in the library, with a script", BEHAVIOURS.some((w) => w.manifest.id === "press-shows" && /siteFeatures\.define\("press-shows"/.test(w.script)));
{
  const open = attachCaptured(nodes, { version: 1, states: [...behaviours.states, { page: "page_home", group: "page_home:g1", option: 0, name: "mochi", part: "card_mochi", opening: true, shows: ["name_mochi"], hides: [] }] });
  const m = open.find((n) => n.id === "card_mochi");
  const mu = (m?.work?.uses ?? (m?.work ? [m.work] : [])).find((u) => u?.id === "press-shows");
  check("the card chosen as the page opens carries Show on press, marked the opening press, showing the page's own parts", mu?.inputs?.opening === "yes" && mu?.inputs?.shows === "name_mochi", JSON.stringify(m?.work));
}
check("control: a document with no states attaches nothing new", !attachCaptured(nodes, { version: 1 }).some((n) => n.work));

/* The script itself, run on a stand-in page: a press shows parts holding a PNG sprite and an animated svg. */
{
  const script = BEHAVIOURS.find((w) => w.manifest.id === "press-shows").script;
  let fn = null;
  const img = (src) => ({ src, getAttribute: () => img.last[src] ?? src, setAttribute(_, v) { img.last[src] = v; } });
  img.last = {};
  const part = (id, imgs = []) => ({ id, style: { display: "none" }, querySelectorAll: () => imgs });
  const parts = { card_on: part("card_on", [img("assets/pictures/pup.png")]), lcd_on: part("lcd_on", [img("assets/pictures/lcd.svg")]), card: part("card") };
  parts.card.style.display = "flex";
  let onClick = null;
  const root = { getElementById: (id) => parts[id] ?? null, querySelector: () => null, addEventListener: (t, f) => { if (t === "click") onClick = f; } };
  const el = { ownerDocument: root, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }) };
  globalThis.window = {}; globalThis.document = root;
  new Function("siteFeatures", script)({ define: (_id, f) => { fn = f; } });
  let threw = null;
  try { fn(el, { shows: "card_on,lcd_on", hides: "card", group: "g" }); onClick({ clientX: 50, clientY: 50, target: null }); } catch (e) { threw = e.message; }
  check("a press on the stand-in runs without an error", threw === null, threw ?? "");
  check("…shows its parts and hides the page's own", parts.card_on.style.display === "flex" && parts.lcd_on.style.display === "flex" && parts.card.style.display === "none", JSON.stringify(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.style.display]))));
  check("…and starts the shown svg's frames again (a new fragment), leaving the PNG as it is", /lcd\.svg#p\d+/.test(img.last["assets/pictures/lcd.svg"] ?? "") && !img.last["assets/pictures/pup.png"], JSON.stringify(img.last));
}

/* The opening press: mochi, chosen as the page opens, shows the page's own parts; pressed after pup, it puts back exactly the page as it opened. */
{
  const script = BEHAVIOURS.find((w) => w.manifest.id === "press-shows").script;
  let fn = null;
  const part = (id, on) => ({ id, style: { display: on ? "flex" : "none" }, querySelectorAll: () => [] });
  const parts = { panel: part("panel", true), name_mochi: part("name_mochi", true), card_mochi_on: part("card_mochi_on", true), name_pup: part("name_pup", false), card_pup_on: part("card_pup_on", false) };
  const clicks = [];
  const root = { getElementById: (id) => parts[id] ?? null, querySelector: () => null, addEventListener: (t, f) => { if (t === "click") clicks.push(f); } };
  globalThis.window = { scrollX: 0, scrollY: 0 };
  const box = (x) => ({ ownerDocument: root, style: {}, getBoundingClientRect: () => ({ left: x, top: 0, right: x + 100, bottom: 100 }) });
  globalThis.window = {}; globalThis.document = root;
  new Function("siteFeatures", script)({ define: (_id, f) => { fn = f; } });
  fn(box(0), { shows: "panel,name_mochi,card_mochi_on", hides: "", group: "g4", opening: "yes" });
  fn(box(200), { shows: "name_pup,card_pup_on", hides: "name_mochi,card_mochi_on", group: "g4" });
  const press = (x) => clicks.forEach((f) => f({ clientX: x, clientY: 50, target: null }));
  const seen = () => Object.entries(parts).filter(([, p]) => p.style.display === "flex").map(([k]) => k).sort().join(",");
  press(250);
  check("pressing pup shows pup's parts in place of mochi's", seen() === "card_pup_on,name_pup,panel", seen());
  press(50);
  check("…and pressing mochi, the opening press, puts back exactly the page as it opened", seen() === "card_mochi_on,name_mochi,panel", seen());
  /* pup's press hides mochi's own card (a copy stands in its place): a press where mochi's card stood is still mochi's. */
  const card = box(0), hidden = { on: true };
  card.getBoundingClientRect = () => (hidden.on ? { left: 0, top: 0, right: 100, bottom: 100 } : { left: 0, top: 0, right: 0, bottom: 0 });
  const before = clicks.length;
  fn(card, { shows: "panel,name_mochi,card_mochi_on", hides: "", group: "g4b", opening: "yes" });
  fn(box(200), { shows: "name_pup,card_pup_on", hides: "name_mochi,card_mochi_on", group: "g4b" });
  const pressB = (x) => clicks.slice(before).forEach((f) => f({ clientX: x, clientY: 50, target: null }));
  pressB(250); hidden.on = false;
  pressB(50);
  check("…even when pup's press hid mochi's own card: a press where it stood chooses mochi", seen() === "card_mochi_on,name_mochi,panel", seen());
}

/*
 * A PANEL A PRESS SHOWS WHOLE. gotchi.gg's starter panel is sticky (top 80)
 * inside the starter grid. Pressing boo grows the panel's own box, so boo's
 * press keeps a panel of its own at the page's panel's path, its words
 * inside. Published, boo's words went into the page's panel (the one boo's
 * press hides) and boo's panel stood empty, up over "how it works"; and every
 * panel stuck against the whole page, sliding out of its section.
 */
{
  const { bandMoves, stickyFlow } = fluidSite;
  const stickyHolds = fluidSite.stickyHolds ?? (() => new Map());
  const S = "body > main > section:nth-of-type(5) > div", P = `${S} > div:nth-of-type(2)`;
  const fp = (id, x, y, w, h, selector, extra = {}) => ({ id, x, y, w, h, selector, ...extra });
  const parts = [
    fp("header", 0, 0, 1440, 67, "body > header", { position: "sticky", inset: { top: 0 } }),
    fp("title", 146, 1797, 400, 60, `${S} > h2`),
    fp("grid", 146, 1894, 533, 578, `${S} > div:nth-of-type(1)`),
    fp("panel", 707, 1894, 587, 484, P, { position: "sticky", inset: { top: 80 } }),
    fp("name_mochi", 728, 1915, 92, 35, `${P} > div > h3`),
    fp("name_pup", 728, 1915, 60, 35, `${P} > div > h3`, { state: "g4:1" }),
    fp("panel_boo", 707, 1894, 587, 453, P, { position: "sticky", inset: { top: 80 }, state: "g4:5" }),
    fp("name_boo", 728, 1915, 60, 35, `${P} > div > h3`, { state: "g4:5" }),
    fp("footer", 0, 4000, 1440, 200, "body > footer"),
  ];
  const moves = bandMoves(parts, 1440);
  check("boo's words go into boo's own panel, not the page's (which boo's press hides)", moves.get("name_boo")?.band === "panel_boo", JSON.stringify(moves.get("name_boo")));
  check("…pup's, whose press keeps the page's panel, into the page's panel", moves.get("name_pup")?.band === "panel", JSON.stringify(moves.get("name_pup")));
  check("…and the page's own words never into a press's panel", moves.get("name_mochi")?.band === "panel", JSON.stringify(moves.get("name_mochi")));
  const holds = stickyHolds(parts, 4200);
  check("both panels stick inside the starter grid's box, as on the page, not the whole page", holds.get("panel")?.top === 1797 && holds.get("panel")?.height === 2472 - 1797 && holds.get("panel_boo")?.top === 1797, JSON.stringify([...holds]));
  check("…while the header, whose parent is the page, sticks in the page's flow as before", !holds.has("header"));
  const flow = stickyFlow(parts);
  check("unheld (the Preview), boo's panel stands at the page's panel's place, not after it", flow.get("panel_boo") === flow.get("panel") && flow.get("panel") === 1894, JSON.stringify([...flow]));
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
