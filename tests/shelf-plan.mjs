/**
 * The shelf, item by item: worth having, no duplicate, honest about what a
 * published page does, editable, and a captured site's effects filed under
 * the item they are a version of (Lane I).
 *
 *   1. every catalogue id is a card, a version of one, or taken off with a
 *      reason; none is in two places, and every id says what the published
 *      page does with it;
 *   2. the duplicates he named are one item each: moderation by people and
 *      by artificial intelligence; the built-in whole-site motions and the
 *      library's features that do the same to one part; the ticker in Text
 *      and the loop in Motion; and no group name repeats across categories;
 *   3. every library feature is placed: a card of its own or a version;
 *   4. a card that says "Works when published" is drawn complete or has a
 *      script the export ships, and one that waits on a key or a backend
 *      says so; the whole-site features are switches;
 *   5. every item offers editable options as data, a merged one its
 *      versions, and each field's change is a patch the node takes;
 *   6. a captured site's effects become versions of the item that does the
 *      same, one per item and site, from the settings measured there.
 *
 *   node tests/shelf-plan.mjs [path to a sink checkout]
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES, FEATURES } from "../src/features/studio/catalog.ts";
import { SHELF_GROUPS, isWorkKey, workIdOf } from "../src/features/studio/shelfGroups.ts";
import { PUBLISH, REMOVED, VARIANTS, VARIANT_OF, itemOf, onShelf, placedWorks, publishOf } from "../src/features/studio/shelfPlan.ts";
import { statusOf, switchOf, needsOf } from "../src/features/studio/shelfFacts.ts";
import { LIBRARY } from "../src/features/studio/library/works.ts";
import { PART_KINDS, PART_KEYFRAMES } from "../src/features/studio/library/siteMotion.ts";
import { editablesOf, readField, writeField } from "../src/features/studio/partOptions.ts";
import { attachCaptured } from "../src/features/studio/library/captured.ts";
import { siteVersions } from "../src/features/studio/library/siteVersions.ts";

const SINK = process.argv[2] ?? join(process.cwd(), "..", "sink");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const ids = FEATURES.map((f) => f.id);
const byId = new Map(FEATURES.map((f) => [f.id, f]));
const cards = Object.values(SHELF_GROUPS).flatMap((gs) => gs.flatMap((g) => g.items));

/* ------------------------------------------------------------------ 1 */
const lost = ids.filter((id) => !onShelf(id) && !VARIANT_OF.has(id) && !REMOVED[id]);
check("1. every catalogue id is a card, a version of one, or taken off with a reason", lost.length === 0, lost.join(", ") || `${ids.length} ids`);
const twice = cards.filter((k, i) => cards.indexOf(k) !== i);
check("1. no card is in two groups", twice.length === 0, twice.join(", "));
const versionAndCard = [...VARIANT_OF.keys()].filter((k) => onShelf(k));
check("1. nothing is both a card and a version of another", versionAndCard.length === 0, versionAndCard.join(", "));
const allVersions = Object.values(VARIANTS).flatMap((v) => v.more.map((m) => m.key));
const versionTwice = allVersions.filter((k, i) => allVersions.indexOf(k) !== i);
check("1. no version belongs to two items", versionTwice.length === 0, versionTwice.join(", "));
const removedShown = Object.keys(REMOVED).filter((id) => onShelf(id) || VARIANT_OF.has(id));
check("1. what was taken off is not on the shelf in any form", removedShown.length === 0, removedShown.join(", "));
const noLine = ids.filter((id) => !PUBLISH[id]);
check("1. every catalogue id says what the published page does with it", noLine.length === 0, noLine.join(", "));
const wrongPlace = Object.entries(SHELF_GROUPS).flatMap(([cat, gs]) => gs.flatMap((g) => g.items.filter((k) => !isWorkKey(k) && byId.get(k)?.category !== cat).map((k) => `${k} in ${cat}`)));
check("1. every card sits in its own category", wrongPlace.length === 0, wrongPlace.join(", "));
const missingItem = cards.filter((k) => (isWorkKey(k) ? !LIBRARY.some((w) => w.manifest.id === workIdOf(k)) : !byId.has(k)));
check("1. every card names something that exists", missingItem.length === 0, missingItem.join(", "));
const catsWithGroups = CATEGORIES.filter((c) => (SHELF_GROUPS[c.id] ?? []).length);
check("1. every category has its groups", catsWithGroups.length === CATEGORIES.length, `${catsWithGroups.length} of ${CATEGORIES.length}`);

/* ------------------------------------------------------------------ 2 */
check("2. moderation is one item: by people, and screened by artificial intelligence first", onShelf("moderation") && itemOf("ai-moderation") === "moderation" && !onShelf("ai-moderation"));
const labels = Object.values(SHELF_GROUPS).flatMap((gs) => gs.map((g) => g.label));
check("2. no group name is used twice", labels.length === new Set(labels).size, labels.filter((l, i) => labels.indexOf(l) !== i).join(", "));
const pairs = [["work:reveal", "reveal-on-scroll"], ["work:tilt", "hover-tilt"], ["work:marquee", "marquee"], ["work:copy-toast", "copy-button"], ["work:scroll-header", "sticky-header"], ["work:crt-loader", "page-load"], ["work:scroll-grow", "scroll-progress"], ["work:glide", "smooth-scroll"], ["work:follow-pointer", "parallax"]];
const apart = pairs.filter(([w, item]) => itemOf(w) !== item);
check("2. a built-in effect and the library feature that does the same are one item", apart.length === 0, apart.map(([w]) => w).join(", ") || pairs.map(([w, i]) => `${w.slice(5)} → ${i}`).join(", "));
const heroes = FEATURES.filter((f) => f.id.startsWith("hero-") && f.id !== "hero-scroll-cue");
check("2. the six opening banners are one item with six versions", heroes.every((f) => itemOf(f.id) === "hero-split"), heroes.map((f) => f.id).join(", "));
const sameThing = [["faq", "accordion"], ["drawer", "modal"], ["guestbook", "comments"], ["realtime-stream", "live-feed"], ["orb-webgl", "orb-css"], ["search-autocomplete", "search-nav"]];
check("2. near-copies drawn by one part are versions of one item", sameThing.every(([v, i]) => itemOf(v) === i), sameThing.map(([v, i]) => `${v} → ${i}`).join(", "));

/* ------------------------------------------------------------------ 3 */
const unplaced = LIBRARY.map((w) => w.manifest.id).filter((id) => !placedWorks().includes(id));
check("3. every library feature is placed, as a card or as a version", unplaced.length === 0, unplaced.join(", "));

/* ------------------------------------------------------------------ 4 */
const shown = [...new Set([...cards, ...allVersions])];
const lies = shown.filter((k) => {
  const need = isWorkKey(k) ? LIBRARY.find((w) => w.manifest.id === workIdOf(k))?.manifest.needs : undefined;
  const st = statusOf(k, need);
  const p = publishOf(k);
  return st === "works" && !(p.kind === "draws" || p.kind === "runs");
});
check("4. every item that says it works is drawn complete or has a script that ships", lies.length === 0, lies.join(", "));
const runners = shown.filter((k) => publishOf(k).kind === "runs");
const noScript = runners.filter((k) => {
  const p = publishOf(k);
  if (p.by === "parts") return !PART_KINDS[k];
  if (p.by === "work") return !LIBRARY.some((w) => w.manifest.id === workIdOf(k));
  if (p.by === "keyframes") return !readFileSync("src/features/studio/parts/Text.tsx", "utf8").match(new RegExp(Object.keys(PART_KEYFRAMES).join("|")));
  if (p.by === "site-motion") return !["scroll-progress", "back-to-top", "reveal-on-scroll", "parallax", "smooth-scroll", "scroll-snap", "page-load", "cursor-effects", "hover-tilt"].includes(k);
  return false;
});
check("4. every script it names exists", noScript.length === 0, noScript.join(", ") || `${runners.length} run by a script`);
const service = shown.filter((k) => !isWorkKey(k) && needsOf({ id: k }).length);
check("4. everything that waits on a key or a backend says so", service.every((k) => statusOf(k) === "service"), service.filter((k) => statusOf(k) !== "service").join(", "));
const counts = { works: 0, build: 0, service: 0, note: 0 };
for (const k of cards) counts[statusOf(k, isWorkKey(k) ? LIBRARY.find((w) => w.manifest.id === workIdOf(k))?.manifest.needs : undefined)]++;
check("4. the cards' badges, counted", true, `works when published ${counts.works}, needs a build ${counts.build}, needs a key or backend ${counts.service}, for the builder ${counts.note}`);
const switches = cards.filter((k) => !isWorkKey(k) && switchOf(k));
check("4. the whole-site features are switches", switches.length >= 20, `${switches.length}: ${switches.join(", ")}`);
const notesPublished = shown.filter((k) => publishOf(k).kind === "note" && statusOf(k) !== "note");
check("4. notes for the builder say so and are never published", notesPublished.length === 0, notesPublished.join(", "));

/* ------------------------------------------------------------------ 5 */
const node = (featureId, extra = {}) => ({ featureId, options: {}, content: "", link: null, colour: null, anim: null, animSpeed: 1, work: null, w: 400, h: 120, ...extra });
const noFields = cards.filter((k) => !isWorkKey(k)).filter((k) => editablesOf(node(k)).length < 3);
check("5. every item offers options as data", noFields.length === 0, noFields.join(", ") || `${cards.filter((k) => !isWorkKey(k)).length} items`);
const merged = Object.keys(VARIANTS).filter((k) => !isWorkKey(k) && VARIANTS[k].more.some((m) => !isWorkKey(m.key)));
const noVersion = merged.filter((k) => !editablesOf(node(k)).some((f) => f.id === "version"));
check("5. a merged item offers its versions", noVersion.length === 0, noVersion.join(", ") || `${merged.length} merged items`);
const hero = node("hero-split");
const version = editablesOf(hero).find((f) => f.id === "version");
const toWash = writeField(hero, version, "Over a colour wash");
check("5. switching the version swaps the part that draws", toWash?.featureId === "hero-gradient", JSON.stringify(toWash));
check("5. and reads back as the version it is", readField({ ...hero, featureId: "hero-gradient" }, version) === "Over a colour wash");
const tabs = node("tabs-panel");
const style = editablesOf(tabs).find((f) => f.id === "option:style");
check("5. an option's change is a patch of the node's options", JSON.stringify(writeField(tabs, style, "pill")) === JSON.stringify({ options: { style: "pill" } }));
check("5. a value an option does not take is refused", writeField(tabs, style, "sideways") === null);
const colour = editablesOf(tabs).find((f) => f.id === "colour:text");
check("5. colours are editable, as a role or a colour", JSON.stringify(writeField(tabs, colour, "accent")) === JSON.stringify({ colour: { text: "accent" } }));
const carrying = node("prose", { work: { id: "marquee", inputs: {} } });
const speed = editablesOf(carrying).find((f) => f.id === "work:marquee:speed");
check("5. a feature a part carries shows its inputs", !!speed && speed.section === "motion", speed ? `${speed.label} in ${speed.section}` : "none");
check("5. and writing one changes that input only", writeField(carrying, speed, "80")?.work?.inputs?.speed === "80");
const link = editablesOf(node("cta-primary"), { linkable: true }).find((f) => f.id === "link");
check("5. a part that can link offers where it links to", !!link && JSON.stringify(writeField(node("cta-primary"), link, "page:page_about")) === JSON.stringify({ link: { kind: "page", target: "page_about" } }));

/* ------------------------------------------------------------------ 6 */
const sites = ["trumpmorty-fun", "gotchi-gg", "stonkfun-xyz"].map((s) => join(SINK, "sites", s, "site", "document.json")).filter((p) => existsSync(p));
if (!sites.length) console.log("  (no sink checkout: the captured half is skipped)");
for (const at of sites) {
  const doc = JSON.parse(readFileSync(at, "utf8"));
  const nodes = doc.behaviours ? attachCaptured(doc.nodes, doc.behaviours, doc.keyframes) : doc.nodes;
  const v = siteVersions(nodes, doc.keyframes ?? [], doc.brief?.name);
  const host = at.split("/sites/")[1].split("/")[0];
  const off = v.filter((x) => !onShelf(x.item));
  check(`6. ${host}: every effect it brought is a version of a shelf item`, v.length > 0 && off.length === 0, off.map((x) => x.item).join(", ") || v.map((x) => `${x.item} (${x.parts.length})`).join(", "));
  const keys = v.map((x) => `${x.item}|${x.host}`);
  check(`6. ${host}: one version per item and site`, keys.length === new Set(keys).size);
  const measured = v.filter((x) => x.take.kind === "work");
  check(`6. ${host}: a feature's version carries the settings measured there`, measured.every((x) => x.take.inputs && typeof x.take.inputs === "object") && measured.every((x) => x.label === `As on ${x.host}`));
}

/* ------------------------------------------------------------------ counts */
const before = { categories: CATEGORIES.length, items: FEATURES.length + LIBRARY.length };
const after = { categories: CATEGORIES.length, items: cards.length };
console.log(`\n  before: ${before.categories} categories, ${FEATURES.length} catalogue cards and ${LIBRARY.length} library cards (${before.items})`);
console.log(`  after:  ${after.categories} categories, ${after.items} cards, ${allVersions.length} versions folded in, ${Object.keys(REMOVED).length} taken off`);

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
