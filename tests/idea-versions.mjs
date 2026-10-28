#!/usr/bin/env node
/**
 * SEVERAL VERSIONS OF ONE IDEA, AND THE SITE PICKED OUT OF THEM.
 *
 * No browser and no Claude: the answer Claude would give is written here (a
 * stub), and the reader, the local roll and the site builder are run on it.
 *
 *   · a stubbed answer with 3 versions reads as 3 named versions, each with
 *     its pages, Home first, from ONE call for all of them;
 *   · the free local roll makes 3 clearly different versions from the
 *     catalogue, with no call at all;
 *   · the picker's rows are every page any version proposes, matched by name;
 *   · picking Home from version 2 and Pricing from version 1 builds exactly
 *     those two pages, from those versions, with links between them;
 *   · no suggested word is on the site: each is an offer, line by line;
 *   · everything is linked to the house style, and every link holds.
 *
 *   node tests/idea-versions.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": src } });
const studio = join(src, "features", "studio");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

let V, A, H, T, K;
try {
  V = await jiti.import(join(studio, "idea", "versions.ts"));
  A = await jiti.import(join(studio, "idea", "ask.ts"));
  if (!A.askForVersions) throw new Error("no askForVersions in idea/ask.ts");
} catch (e) {
  check("the versions modules load (idea/versions.ts, askForVersions)", false, e.message.split("\n")[0]);
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(1);
}
H = await jiti.import(join(studio, "idea", "houseStyle.ts"));
T = await jiti.import(join(studio, "siteTheme.ts"));
K = await jiti.import(join(studio, "system", "take.ts"));

const header = { name: "Header", parts: [{ kind: "part", featureId: "sticky-header", label: "Header", content: "", options: [] }] };
const footer = { name: "Footer", parts: [{ kind: "part", featureId: "footer", label: "Footer", content: "", options: [] }] };
const STUB = {
  name: "Clay Room",
  description: "Pottery classes in Leeds.",
  versions: [
    { name: "Calm editorial", pitch: "Quiet and roomy.", pages: [
      { name: "Home", sections: [header, { name: "First screen", parts: [{ kind: "heading", level: 1, text: "Slow hands, good clay" }, { kind: "text", text: "A quiet room for learning the wheel." }] }, footer] },
      { name: "Pricing", sections: [header, { name: "Prices", parts: [{ kind: "heading", level: 2, text: "Calm prices" }, { kind: "part", featureId: "pricing-table", label: "Prices", content: "Taster, Course, Studio", options: [] }] }, footer] },
      { name: "About", sections: [header, { name: "About", parts: [{ kind: "heading", level: 2, text: "Who we are" }] }, footer] },
    ] },
    { name: "Bold product", pitch: "A big promise.", pages: [
      { name: "Pricing", sections: [header, { name: "Prices", parts: [{ kind: "heading", level: 2, text: "Bold prices" }] }, footer] },
      { name: "Home", sections: [header, { name: "First screen", parts: [{ kind: "heading", level: 1, text: "Make a pot this week" }, { kind: "button", text: "Book a class", main: true }] }, { name: "Classes", parts: [{ kind: "part", featureId: "made-up-kiln", label: "Kiln cam", content: "", options: [] }] }, footer] },
      { name: "FAQ", sections: [header, { name: "Questions", parts: [{ kind: "part", featureId: "faq", label: "Questions", content: "Do I bring clay?", options: [] }] }, footer] },
    ] },
    { name: "Warm and personal", pitch: "A person first.", pages: [
      { name: "Home", sections: [header, { name: "First screen", parts: [{ kind: "heading", level: 1, text: "Hello, I'm Ann" }] }, footer] },
      { name: "Contact", sections: [header, { name: "Contact", parts: [{ kind: "heading", level: 2, text: "Find me" }] }, footer] },
    ] },
  ],
  missing: [{ name: "Booking calendar", why: "Needs bookings." }],
};

/* ------------------------------------------------------------ one call, stubbed */
const sent = [];
const stub = (answer, stop = "end_turn") => async (system, blocks) => { sent.push({ system, blocks }); return { text: answer, stop }; };
const idea = { text: "Pottery classes in Leeds. Calm, hand-made.", sections: [], ref: null };
const got = await A.askForVersions({ idea }, stub(J(STUB)));
check("a stubbed plan with 3 versions reads as 3 versions", got.ok && got.versions.versions.length === 3, J(got.ok ? got.versions.versions.map((v) => v.name) : got));
const vs = got.versions;
check("…each with its plain name", J(vs.versions.map((v) => v.name)) === J(["Calm editorial", "Bold product", "Warm and personal"]));
check("…all from one call, the catalogue cached first, asking for several versions", sent.length === 1 && sent[0].blocks[0].cache === true && /THREE OR FOUR CLEARLY DIFFERENT VERSIONS/.test(sent[0].system));
check("…Home first in every version", vs.versions.every((v) => v.pages[0].name === "Home"), J(vs.versions.map((v) => v.pages.map((p) => p.name))));
check("…a part the catalogue lacks is a labelled placeholder", vs.versions[1].pages[0].sections.flatMap((s) => s.parts).some((p) => p.kind === "placeholder" && p.name === "Kiln cam"));
check("…and the missing list keeps both", ["Booking calendar", "Kiln cam"].every((n) => vs.missing.some((m) => m.name === n)));
check("an answer with no versions is none", (await A.askForVersions({ idea }, stub(J({ versions: [] })))).reason === "unreadable" && V.readVersions({}) === null);
check("an empty idea makes no call", (await A.askForVersions({ idea: { ...idea, text: "" } }, stub(J(STUB)))).reason === "empty" && sent.length === 2);
const five = { ...STUB, versions: [...STUB.versions, ...STUB.versions] };
check("no more than four versions are kept", V.readVersions(five).versions.length === 4);

/* ------------------------------------------------------------ the free local roll */
const allowed = new Set((await jiti.import(join(studio, "idea", "plan.ts"))).draftable().map((f) => f.id));
const local = V.localVersions({ text: "A bakery in York. Bread and cakes, early mornings.", sections: ["Bread", "Cakes"], ref: null }, { name: "Crumb", seed: 0 });
check("the local roll makes 3 versions with no call", local.by === "local" && local.versions.length === 3 && sent.length === 2);
check("…each a different name and a different set of pages", new Set(local.versions.map((v) => v.name)).size === 3 && new Set(local.versions.map((v) => v.pages.map((p) => p.name).join())).size === 3, J(local.versions.map((v) => [v.name, v.pages.map((p) => p.name)])));
check("…using only parts the catalogue publishes", local.versions.flatMap((v) => v.pages.flatMap((p) => p.sections.flatMap((s) => s.parts))).every((p) => p.kind !== "part" || allowed.has(p.featureId)));
check("…J's sections on the Home pages", local.versions.every((v) => ["Bread", "Cakes"].every((s) => v.pages[0].sections.some((x) => x.name === s))));
check("…and another seed starts elsewhere", V.localVersions(idea, { seed: 1 }).versions[0].name !== V.localVersions(idea, { seed: 0 }).versions[0].name);

/* ------------------------------------------------------------ the picker's rows */
const rows = V.pageRows(vs);
check("the rows are every page any version proposes, Home first", J(rows.map((r) => r.key)) === J(["home", "pricing", "faq", "contact", "about"]) || (rows[0].key === "home" && J(rows.map((r) => r.key).sort()) === J(["about", "contact", "faq", "home", "pricing"])), J(rows.map((r) => r.key)));
check("…Pricing is in versions 1 and 2, Contact only in 3", J([...rows.find((r) => r.key === "pricing").in.keys()].sort()) === J([0, 1]) && J([...rows.find((r) => r.key === "contact").in.keys()]) === J([2]));
let picks = {};
picks = V.togglePick(picks, "home", 1);
picks = V.togglePick(picks, "pricing", 0);
picks = V.togglePick(picks, "faq", 1);
picks = V.togglePick(picks, "faq", 1);
check("ticking twice takes a page off again", J(picks) === J({ home: 1, pricing: 0 }));
check("a whole version ticks all its pages", J(V.wholeVersion(vs, 2)) === J({ home: 2, contact: 2 }));

/* ------------------------------------------------------------ the site */
const house = { ...H.systemFromTheme(T.rollTheme({ seed: 99 }), "House style"), id: "sys_house" };
const site = V.buildSite(vs, picks, house);
check("picking Home from version 2 and Pricing from version 1 builds exactly those two pages", J(site.pages.map((p) => p.name)) === J(["Home", "Pricing"]) && site.pages[0].path === "/" && site.pages[1].path === "/pricing");
const onPage = (id) => site.nodes.filter((n) => n.pageId === id);
const [home, pricing] = site.pages;
const offerOf = (pageId) => site.offers.filter((o) => o.pageId === pageId).map((o) => o.to);
check("…Home is version 2's Home", offerOf(home.id).includes("Make a pot this week") && !offerOf(home.id).includes("Slow hands, good clay") && onPage(home.id).some((n) => n.label === "Kiln cam"));
check("…Pricing is version 1's Pricing", offerOf(pricing.id).includes("Calm prices") && onPage(pricing.id).some((n) => n.featureId === "pricing-table"));
check("…nothing from a page not picked", !site.offers.some((o) => /Who we are|Do I bring clay|Hello, I'm Ann/.test(o.to)) && site.nodes.every((n) => n.pageId === home.id || n.pageId === pricing.id));
const nav = (pageId) => onPage(pageId).filter((n) => n.link?.kind === "page");
check("every page has a link to every page", [home, pricing].every((p) => J(nav(p.id).map((n) => n.link.target).sort()) === J([home.id, pricing.id].sort())), J(nav(home.id).map((n) => [n.content, n.link])));
check("…named for the page it goes to", nav(home.id).every((n) => site.pages.find((p) => p.id === n.link.target).name === n.content));
check("…and sits under the header", (() => { const h = onPage(home.id).find((n) => n.featureId === "sticky-header"); return nav(home.id).every((n) => n.y >= h.y + h.h); })());
check("every id once", new Set(site.nodes.map((n) => n.id)).size === site.nodes.length);

const suggested = site.offers.map((o) => o.to);
check("no suggested word is on the site before it is accepted", site.nodes.every((n) => typeof n.content !== "string" || !suggested.includes(n.content) || nav(n.pageId).includes(n)), J(site.nodes.filter((n) => suggested.includes(n.content)).map((n) => n.id)));
check("…each one is offered, line by line, for its own part", site.offers.length >= 4 && site.offers.every((o) => site.nodes.find((n) => n.id === o.nodeId)?.content === o.now) && new Set(site.offers.map((o) => o.nodeId)).size === site.offers.length);
check("…a catalogue part's content is offered too", site.offers.some((o) => o.to === "Taster, Course, Studio"));
check("the site is in the house style, and every link holds", site.nodes.filter((n) => n.featureId === "prose").every((n) => n.sys?.s === "sys_house") && K.linksHold(site.nodes, house).length === 0);
const filled = V.buildSite(vs, V.wholeVersion(vs, 0), house, { words: "fill" });
check("the thumbnails' build puts the words in and offers none", filled.offers.length === 0 && filled.nodes.some((n) => n.content === "Slow hands, good clay") && filled.pages.length === 3);
check("a single page has no row of links", V.buildSite(vs, { home: 0 }, house).nodes.every((n) => !n.link));

console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
