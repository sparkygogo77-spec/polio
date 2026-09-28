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

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
