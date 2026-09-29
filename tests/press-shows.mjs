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

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
