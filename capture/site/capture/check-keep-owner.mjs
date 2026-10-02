/**
 * A SITE TAKEN AGAIN KEEPS WHAT ITS OWNER SET (keep-owner.mjs).
 *
 * trumpmorty.fun's document, as committed, carries the owner's ribbon
 * settings (both ribbons' words centred in their band, at 36px and 42px).
 * The converter writes no feature, so a new conversion of the site has
 * none: here that is the same document with its features, hand placements
 * and locks taken off, and one part's shadow changed as a better capture
 * would change it. Carried across:
 *
 *   · both ribbons keep "Centre in its band" and their text sizes;
 *   · a part he placed by hand keeps its box; a part drawn on the board is kept;
 *   · what the converter wrote is the new document's, untouched.
 *
 *   node capture/site/capture/check-keep-owner.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { keepOwner } from "./keep-owner.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};
const was = JSON.parse(readFileSync(join(here, "..", "..", "sites", "trumpmorty-fun", "site", "document.json"), "utf8"));
const ribbons = was.nodes.filter((n) => n.work?.id === "marquee");
check("the committed document carries the owner's two ribbon settings", ribbons.length === 2 && ribbons.every((n) => n.work.inputs.middle === "yes"), JSON.stringify(ribbons.map((n) => n.work)));

/* His board, a little more: a part placed by hand, a lock, a drawn part. */
const old = structuredClone(was);
const placed = old.nodes.find((n) => n.featureId === "picture");
placed.x += 40; placed.byHand = true;
const prompted = old.nodes.find((n) => n.featureId === "prose");
prompted.locked = true;
old.nodes.push({ id: "n_drawn_1", pageId: "page_home", featureId: "box", x: 10, y: 10, w: 50, h: 50 });

/* The new conversion: nothing of his, and a shadow the capture now reads at rest. */
const next = structuredClone(was);
for (const n of next.nodes) { delete n.work; delete n.byHand; n.locked = false; }
const sticker = next.nodes.find((n) => /7px 7px/.test(n.edge?.shadow ?? ""));
if (sticker) sticker.edge.shadow = sticker.edge.shadow.replace("7px 7px", "4px 4px");

const { doc, kept } = keepOwner(old, next);
const by = (id) => doc.nodes.find((n) => n.id === id);
check("both ribbons keep Centre in its band and their text sizes", ribbons.every((r) => by(r.id)?.work?.inputs?.middle === "yes" && by(r.id)?.work?.inputs?.size === r.work.inputs.size), JSON.stringify(ribbons.map((r) => by(r.id)?.work)));
check("the part he placed by hand keeps its box", by(placed.id)?.x === placed.x && by(placed.id)?.byHand === true, JSON.stringify([by(placed.id)?.x, placed.x]));
check("his lock is kept", by(prompted.id)?.locked === true);
check("the part drawn on the board is kept", !!by("n_drawn_1"));
check("what the converter wrote is the new document's (the resting shadow)", !sticker || by(sticker.id)?.edge?.shadow === sticker.edge.shadow, JSON.stringify(by(sticker?.id)?.edge));
check("nothing else changes: every other part is the new document's", doc.nodes.filter((n) => ![...ribbons.map((r) => r.id), placed.id, prompted.id, "n_drawn_1"].includes(n.id)).every((n) => JSON.stringify(n) === JSON.stringify(next.nodes.find((m) => m.id === n.id))));
check("and it says what it kept", kept.length === 5, JSON.stringify(kept));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
