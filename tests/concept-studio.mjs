#!/usr/bin/env node
/**
 * CONCEPTS: THREE WHOLE PAGES FROM ONE PROMPT, AND A MIX CUT OUT OF THEM.
 *
 * No browser and no Claude: the free local roll stands in for Claude's
 * answer, and the sums are run straight.
 *
 *   · one prompt gives three versions, each with a Home page, and each
 *     version draws as a whole page of real parts (words in, not stand-ins),
 *     with sections named as `planToBoard` names them;
 *   · the three differ: different direction names, different part counts
 *     or sections, each in a System of its own;
 *   · `sectionsOf` reads a page's sections top to bottom, each once;
 *   · a take adds once, a second take of the same section does not double,
 *     an untake removes, and moving a take swaps the order;
 *   · `mixNodes` stacks the taken sections in take order with no overlap,
 *     every part on one page, ids distinct, and links to pages let go;
 *   · the Mix keeps each part's own look (colour, font, System links).
 *
 *   node tests/concept-studio.mjs
 *
 * Covers: src/features/studio/concepts/model.ts, src/features/studio/idea/versions.ts, src/features/studio/idea/planToBoard.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/* SRC=<another checkout>/src runs the same checks against that checkout (red on base). */
const src = process.env.SRC ?? join(here, "..", "src");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": src } });
const studio = join(src, "features", "studio");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const done = () => { const failed = results.filter((r) => !r).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0); };

let M;
try {
  M = await jiti.import(join(studio, "concepts", "model.ts"));
  if (!M.mixNodes || !M.sectionsOf) throw new Error("no mixNodes/sectionsOf in concepts/model.ts");
} catch (e) {
  check("the concepts model loads (concepts/model.ts)", false, e.message.split("\n")[0]);
  done();
}
const V = await jiti.import(join(studio, "idea", "versions.ts"));
const H = await jiti.import(join(studio, "idea", "houseStyle.ts"));
const T = await jiti.import(join(studio, "siteTheme.ts"));

const idea = { text: "three concepts for a lantern shop landing page", sections: [], ref: null };
const v = V.localVersions(idea, { name: "Lantern shop", seed: 7 });
check("one prompt gives three versions, each with Home first", v.versions.length === 3 && v.versions.every((x) => x.pages[0].name === "Home"), v.versions.map((x) => x.name).join(" / "));
check("…their directions are named differently", new Set(v.versions.map((x) => x.name.toLowerCase())).size === 3);

/* Each in a System of its own, rolled on the prompt plus its direction, as run.ts does. */
const systems = v.versions.map((x, i) => H.pickStyle({ library: [], site: null, words: `${idea.text} ${x.name}. ${x.pitch}`, seed: 100 + i, name: `${v.name}: ${x.name}` }).system);
check("…each concept gets a System of its own", new Set(systems.map((s) => s.id)).size === 3 && systems.every((s) => s.tokens.colour.length > 0));

const pages = v.versions.map((_, i) => V.buildSite(v, V.wholeVersion(v, i), systems[i], { frameWidth: 1440, words: "fill" }));
check("each version draws as a whole page of real parts", pages.every((p) => p.nodes.length >= 6 && p.pages.length >= 1), pages.map((p) => p.nodes.length).join(" / "));
check("…words in, no stand-ins and nothing offered", pages.every((p) => p.offers.length === 0 && !p.nodes.some((n) => n.content === "Words go here." || n.content === "Button")));
const home = (p) => p.nodes.filter((n) => n.pageId === p.pages[0].id);
check("…every part on the Home page has a section in its label", pages.every((p) => home(p).every((n) => M.sectionOfPart(n.label))), home(pages[0]).slice(0, 3).map((n) => n.label).join(" | "));
check("…the three differ in what is on them", new Set(pages.map((p) => home(p).map((n) => M.sectionOfPart(n.label)).join(","))).size >= 2);

const secs = pages.map((p) => M.sectionsOf(home(p)));
check("sectionsOf reads the sections top to bottom, each once", secs.every((s) => s.length >= 3 && s.every((x, i) => i === 0 || x.top >= s[i - 1].top) && new Set(s.map((x) => x.name)).size === s.length), secs[0].map((s) => s.name).join(" > "));
check("…every section covers its parts", secs.every((s, i) => s.every((x) => x.parts === M.partsOfSection(home(pages[i]), x.name).length && x.bottom > x.top)));

/* The takes: the first screen from 2, a middle section from 1, the foot from 3. */
const ids = ["c1", "c2", "c3"];
const first = (i) => secs[i].find((s) => /first screen/i.test(s.name)) ?? secs[i][1];
const foot = (i) => secs[i][secs[i].length - 1];
let takes = [];
takes = M.withTake(takes, { from: ids[1], section: first(1).name });
takes = M.withTake(takes, { from: ids[1], section: first(1).name });
takes = M.withTake(takes, { from: ids[0], section: secs[0][1].name });
takes = M.withTake(takes, { from: ids[2], section: foot(2).name });
check("a take adds once and the same take again does not double", takes.length === 3 && takes[0].from === "c2");
check("…untake removes it", M.withoutTake(takes, takes[1]).length === 2 && M.withoutTake(takes, { from: "x", section: "y" }).length === 3);
check("…moving a take swaps the order and stays in range", M.moveTake(takes, 0, 1)[1].from === "c2" && M.moveTake(takes, 0, -1)[0].from === "c2" && M.moveTake(takes, 2, 1)[2].from === "c3");

const docs = new Map(ids.map((id, i) => [id, home(pages[i])]));
const mixed = M.mixNodes(takes, docs, { pageId: "page_home" });
const want = takes.reduce((n, t) => n + M.partsOfSection(docs.get(t.from), t.section).length, 0);
check("mixNodes carries every taken part, each once, all on one page", mixed.length === want && mixed.every((n) => n.pageId === "page_home") && new Set(mixed.map((n) => n.id)).size === mixed.length, `${mixed.length} parts`);
const blocks = takes.map((t, i) => mixed.filter((n) => n.id.startsWith(`mx${i}_`)));
const range = (b) => [Math.min(...b.map((n) => n.y)), Math.max(...b.map((n) => n.y + n.h))];
check("…the sections stack in take order with no overlap", blocks[0].length && range(blocks[0])[0] === 0 && range(blocks[1])[0] >= range(blocks[0])[1] && range(blocks[2])[0] >= range(blocks[1])[1], blocks.map((b) => range(b).join("-")).join(" ; "));
check("…the stack's height is the last block's bottom", M.mixHeight(mixed) === range(blocks[2])[1]);
check("…a link to a page is let go, nothing else is", mixed.every((n) => !(n.link && n.link.kind === "page")));
const src1 = M.partsOfSection(docs.get("c2"), first(1).name);
check("…each part keeps its own look: colour, font and System links travel", blocks[0].every((n, i) => JSON.stringify(n.colour) === JSON.stringify(src1[i].colour) && JSON.stringify(n.font) === JSON.stringify(src1[i].font) && JSON.stringify(n.sys) === JSON.stringify(src1[i].sys) && n.x === src1[i].x && n.w === src1[i].w));
check("…a take of a section no concept has adds nothing", M.mixNodes([{ from: "c1", section: "Nowhere" }], docs, { pageId: "p" }).length === 0);

check("the links: a group's canvas, and the group read back", M.conceptsHref("g1") === "/builder/concepts?g=g1" && M.readGroup("?g=g1") === "g1" && M.readGroup("") === null && M.conceptsHref() === "/builder/concepts");
check("…names: the site and its direction, and the Mix", M.conceptName("Lantern shop", "Calm editorial") === "Lantern shop: Calm editorial" && M.mixName("Lantern shop") === "Lantern shop: Mix");
const byId = { a: { group: "g", name: "A", index: 0, mix: false }, b: { group: "g", name: "B", index: 1 }, m: { group: "g", name: "Mix", index: 99, mix: true } };
check("…conceptsOf lists the row in order, only sites still there, never the Mix", M.conceptsOf(byId, { id: "g", ids: ["a", "gone", "b", "m"], takes: [], mix: "m" }, new Set(["a", "b", "m"])).map((x) => x.id).join() === "a,b");
done();
