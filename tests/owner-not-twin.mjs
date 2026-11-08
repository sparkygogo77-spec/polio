/**
 * A PRESS NEVER PICKS A PART THE PAGE SHOWS ONLY ON A PRESS, UNLESS THAT STATE IS ON.
 *
 * A captured button that changes under a press comes in twice: the button as
 * the page opens, and its twin as the press shows it (`StudioNode.state`),
 * both at the same element path. One press on the words of such a button
 * picks the control that owns them (`owner.ts#ownerOf`): the smallest owner
 * holding the words by path, and the hidden twin holds them too, so where it
 * was the smaller (stonkfun's revenue tabs, share's event filters, parasite's
 * dev buttons) the twin was picked. Picking a hidden part switches its state
 * on so it can be seen (`history.ts#pickedStates`), and nothing switched it
 * off: from then on the pressed look stayed on the board (EDIT-ISSUES #66,
 * the import checkup's "press states that stick").
 *
 * An owner, and the holder Escape climbs to, is a part in the same state as
 * the pressed one: a part drawn as the page opens is owned by one drawn as
 * the page opens; a part of a pressed twin is owned by that twin.
 *
 * Held here on a made board, and, given captures, on each: no part drawn as
 * the page opens has a hidden twin for its one-press owner.
 *
 *   node tests/owner-not-twin.mjs
 *   node tests/owner-not-twin.mjs capture/sites/stonkfun-xyz capture/sites/share-xyz
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { ownerOf, parentOf } = await jiti.import(join(here, "..", "src", "features", "studio", "owner.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const node = (id, f, content, x, y, w, h, selector, extra = {}) => ({ id, pageId: "p0", featureId: f, content, data: "", x, y, w, h, link: null, from: { url: "https://x.test/", host: "x.test", selector, at: 1 }, ...extra });
const nodes = [
  node("sec", "box", "", 0, 0, 1440, 400, "body > main > section"),
  /* The tab as the page opens, its words, and the tab as a press shows it (narrower, the words bolder) with its own words. */
  node("tab", "box", "", 100, 100, 160, 40, "body > main > section > nav > button:nth-of-type(1)", { data: "button" }),
  node("tab_words", "prose", "Revenue", 120, 110, 120, 20, "body > main > section > nav > button:nth-of-type(1) > span"),
  node("tab_on", "box", "", 100, 100, 150, 40, "body > main > section > nav > button:nth-of-type(1)", { data: "button", state: { group: "g0", option: 0 } }),
  node("tab_on_words", "prose", "Revenue", 118, 110, 114, 20, "body > main > section > nav > button:nth-of-type(1) > span", { state: { group: "g0", option: 0 } }),
];
const by = (id) => nodes.find((n) => n.id === id);
check("one press on the tab's words, as the page opens, picks the tab, not its pressed twin", ownerOf(nodes, by("tab_words"), null)?.id === "tab", `${ownerOf(nodes, by("tab_words"), null)?.id}`);
check("one press on the pressed twin's words picks the twin", ownerOf(nodes, by("tab_on_words"), null)?.id === "tab_on", `${ownerOf(nodes, by("tab_on_words"), null)?.id}`);
check("Escape from the tab's words climbs to the tab, not the twin", parentOf(nodes, by("tab_words"))?.id === "tab", `${parentOf(nodes, by("tab_words"))?.id}`);
check("Escape from the twin's words climbs to the twin", parentOf(nodes, by("tab_on_words"))?.id === "tab_on", `${parentOf(nodes, by("tab_on_words"))?.id}`);

for (const SINK of process.argv.slice(2)) {
  const file = join(SINK, "site/document.json");
  if (!existsSync(file)) { console.log(`  (no capture at ${SINK})`); continue; }
  const d = JSON.parse(readFileSync(file, "utf8"));
  const bad = [];
  for (const n of d.nodes) {
    if (n.state) continue;
    const o = ownerOf(d.nodes, n, null);
    if (o?.state) bad.push(`${n.id} → ${o.id}`);
  }
  check(`${SINK.split(/[\\/]/).filter(Boolean).pop()}: no part drawn as the page opens has a hidden twin for its owner (${d.nodes.filter((n) => n.state).length} twins)`, bad.length === 0, `${bad.length}: ${bad.slice(0, 4).join(", ")}`);
}

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
