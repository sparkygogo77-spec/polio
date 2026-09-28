/**
 * A PART A PRESS SHOWS MOVES WITH THE PAGE.
 *
 * The board's healing moves what sits under a part that grew (`textFit.ts`),
 * and reads the page as it opens: a part a press shows (`state`) is not drawn
 * there and was not moved. On gotchi.gg the starter row was pushed down 9px;
 * pressing pup then showed pup's chosen card at the row's old place and kit's
 * card 9px below it. A pressed part follows the move of the part it stands
 * in for: the one read from the same element, else from its nearest holder.
 *
 *   node --experimental-strip-types tests/pressed-follow.mjs
 */
import { withPressed } from "../src/features/studio/pressed.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${detail}`}`);
};
const ROW = "body > main > div > section:nth-of-type(5) > div > div:nth-of-type(1)";
const n = (id, sel, y, h, state) => ({ id, pageId: "page_home", x: 0, y, w: 100, h, from: { selector: sel }, ...(state ? { state: { group: "g", option: 1 } } : {}) });
const nodes = [
  n("pup_card", `${ROW} > button:nth-of-type(2)`, 1894, 172),
  n("kit_card", `${ROW} > button:nth-of-type(3)`, 1894, 172),
  n("pup_card_on", `${ROW} > button:nth-of-type(2)`, 1894, 172, true),
  n("pup_badge_on", `${ROW} > button:nth-of-type(2) > span`, 1903, 8, true),
  n("elsewhere_on", "body > footer > p", 4000, 20, true),
];
const fitted = [{ id: "pup_card", y: 1903, h: 173 }, { id: "kit_card", y: 1903, h: 173 }];
const out = withPressed(fitted, nodes);
const at = (id) => out.find((f) => f.id === id);
check("the chosen card a press shows moves with the card it stands in for", at("pup_card_on")?.y === 1903, JSON.stringify(at("pup_card_on")));
check("…and a part inside it with its holder", at("pup_badge_on")?.y === 1912, JSON.stringify(at("pup_badge_on")));
check("…its height is its own", at("pup_card_on")?.h === 172, JSON.stringify(at("pup_card_on")));
check("a pressed part under nothing that moved is left where it is", !at("elsewhere_on"), JSON.stringify(out));
check("the page's own moves are kept as they were", at("kit_card")?.y === 1903 && at("pup_card")?.h === 173);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
