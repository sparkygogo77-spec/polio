#!/usr/bin/env node
/**
 * A NEW IDEA'S PLAN BECOMES A SITE IN THE HOUSE STYLE (create system (b)).
 *
 * No browser and no Claude: the answer Claude would give is written here
 * (a stub), and the plan reader and the board builder are run on it.
 *
 *   · the plan keeps only catalogue parts that work on the published site; a
 *     part id the catalogue lacks becomes a labelled placeholder, and so
 *     does each thing the answer says is missing;
 *   · the board has the plan's sections in order, each part the catalogue
 *     part the plan named, nothing placed by Claude's numbers, nothing
 *     overlapping inside a section, nothing wider than the frame;
 *   · every part takes its style from the house style's tokens: words at a
 *     type step and a face, colours at colour tokens, buttons' corners and
 *     padding at corner and space tokens, and every link holds;
 *   · the house style is the library System marked as one, before the
 *     site's own, before one rolled from the idea's words;
 *   · with no key the plain plan still makes a linked draft.
 *
 *   node tests/idea-plan.mjs
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

let P, B, H, K, T, M;
try {
  P = await jiti.import(join(studio, "idea", "plan.ts"));
  B = await jiti.import(join(studio, "idea", "planToBoard.ts"));
  H = await jiti.import(join(studio, "idea", "houseStyle.ts"));
} catch (e) {
  check("the new-idea modules load (idea/plan.ts, idea/planToBoard.ts, idea/houseStyle.ts)", false, e.message.split("\n")[0]);
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(1);
}
K = await jiti.import(join(studio, "system", "take.ts"));
M = await jiti.import(join(studio, "system", "model.ts"));
T = await jiti.import(join(studio, "siteTheme.ts"));

/* ------------------------------------------------------------ the stubbed answer */
const STUB = {
  name: "Clay Room",
  description: "Pottery classes, a shop and a gallery in Leeds.",
  sections: [
    { name: "Header", parts: [{ kind: "part", featureId: "sticky-header", label: "Header", content: "Classes, Shop, Gallery, About", options: [] }] },
    { name: "First screen", parts: [
      { kind: "heading", level: 1, text: "Make something with your hands this week" },
      { kind: "text", text: "Small classes at the wheel, in a calm room in Leeds." },
      { kind: "button", text: "Book a class", main: true },
      { kind: "button", text: "See the shop", main: false },
    ] },
    { name: "Classes", parts: [
      { kind: "heading", level: 2, text: "Classes" },
      { kind: "part", featureId: "card-grid", label: "Class cards", content: "", options: [] },
      { kind: "placeholder", name: "Class calendar", why: "Booking a date needs a calendar that takes bookings." },
    ] },
    { name: "Gallery", parts: [
      { kind: "heading", level: 2, text: "From the kiln" },
      { kind: "part", featureId: "gallery", label: "Gallery", content: "", options: [{ id: "nope", value: "x" }] },
      { kind: "part", featureId: "made-up-part", label: "Spinning pot", content: "", options: [] },
    ] },
    { name: "Footer", parts: [{ kind: "part", featureId: "footer", label: "Footer", content: "", options: [] }] },
  ],
  missing: [{ name: "Cart", why: "A shop needs a cart and a checkout." }],
};

const plan = P.readPlan(STUB);
check("the answer reads as a plan", !!plan && plan.sections.length >= 5, J(plan?.sections.map((s) => s.name)));
const allowed = new Set(P.draftable().map((f) => f.id));
const placed = plan.sections.flatMap((s) => s.parts);
check("every part is a catalogue part that works on the published site, or a placeholder", placed.every((p) => p.kind !== "part" || allowed.has(p.featureId)));
check("…a part id the catalogue lacks became a labelled placeholder", placed.some((p) => p.kind === "placeholder" && p.name === "Spinning pot"));
check("…and so did what the answer said was missing", placed.some((p) => p.kind === "placeholder" && p.name === "Cart") && plan.missing.some((m) => m.name === "Cart"));
check("…an option the part does not offer was dropped", placed.find((p) => p.kind === "part" && p.featureId === "gallery")?.options && !("nope" in placed.find((p) => p.featureId === "gallery").options));
check("the catalogue Claude reads is the draftable parts, one a line", P.catalogueText().split("\n").length === allowed.size + 1 && !P.catalogueText().includes("\ncontact-form —"));
check("an answer with no sections is no plan", P.readPlan({ sections: [] }) === null && P.readPlan("nope") === null);

/* ------------------------------------------------------------ the house style */
const theme = T.rollTheme({ seed: 7 });
const house = { ...H.systemFromTheme(T.rollTheme({ seed: 99 }), "House style"), id: "sys_house" };
const other = { ...H.systemFromTheme(theme, "Another"), id: "sys_other", editedAt: house.editedAt + 10 };
const site = { ...H.systemFromTheme(T.rollTheme({ seed: 3 }), "Site"), id: "sys_site" };
check("the house style is the library System marked as one", H.pickStyle({ library: [other, house], site, words: "", seed: 1 }).system.id === "sys_house");
check("…a `house` mark (the time it was marked) counts too, the latest winning", H.pickStyle({ library: [{ ...other, house: 5 }, { ...house, house: 3 }], site, words: "", seed: 1 }).system.id === "sys_other");
check("…else the open site's System", H.pickStyle({ library: [other], site, words: "", seed: 1 }).from === "site");
const rolled = H.pickStyle({ library: [], site: null, words: "warm, hand-made, calm", seed: 5 });
check("…else one made from a theme rolled on the idea's words", rolled.from === "theme" && rolled.system.tokens.colour.some((c) => c.role === "accent") && rolled.system.tokens.type.steps.length >= 4 && rolled.system.tokens.space.length >= 4);
check("…and that System reads back as one", !!M.readSystem(JSON.parse(J(rolled.system))));

/* ------------------------------------------------------------ the board */
const board = B.planToBoard(plan, house, { pageId: "page_home" });
const nodes = board.nodes;
check("the board has parts, every one a draft part on the page", nodes.length > 10 && nodes.every((n) => n.id.startsWith(B.DRAFT_PREFIX) && n.pageId === "page_home"));
const ids = new Set(nodes.map((n) => n.id));
check("…every id once", ids.size === nodes.length);
const featureOf = (label) => nodes.filter((n) => n.label === label).map((n) => n.featureId);
check("the plan's catalogue parts are on it, as those parts", J(featureOf("Header")) === J(["sticky-header"]) && J(featureOf("Class cards")) === J(["card-grid"]) && J(featureOf("Gallery")) === J(["gallery"]) && J(featureOf("Footer")) === J(["footer"]));
check("…placeholders are the labelled New idea part", ["Class calendar", "Spinning pot", "Cart"].every((name) => nodes.some((n) => n.featureId === "custom-idea" && n.label === name && /Placeholder/.test(n.content))));
check("…its words are the plan's", nodes.some((n) => n.content === "Make something with your hands this week") && nodes.some((n) => n.featureId === "cta-primary" && n.content === "Book a class"));
/* Sections in order, top to bottom. */
const yOf = (pred) => Math.min(...nodes.filter(pred).map((n) => n.y));
const order = [yOf((n) => n.featureId === "sticky-header"), yOf((n) => n.content === "Make something with your hands this week"), yOf((n) => n.featureId === "card-grid"), yOf((n) => n.featureId === "gallery"), yOf((n) => n.featureId === "footer")];
check("the sections run down the page in the plan's order", order.every((v, i) => i === 0 || v > order[i - 1]), J(order));
check("nothing is wider than the frame or off it", nodes.every((n) => n.x >= 0 && n.w > 0 && n.h > 0 && n.x + n.w <= 1440));
const bands = nodes.filter((n) => n.featureId === "box");
const inBand = nodes.filter((n) => n.featureId !== "box" && !["sticky-header", "footer"].includes(n.featureId));
const overlap = [];
for (let i = 0; i < inBand.length; i++) for (let j = i + 1; j < inBand.length; j++) {
  const a = inBand[i], b = inBand[j];
  if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlap.push(`${a.id}×${b.id}`);
}
check("no two parts overlap", overlap.length === 0, overlap.slice(0, 4).join(", "));
check("every section with words has a band behind it, each inside its band", inBand.every((n) => bands.some((b) => n.y >= b.y && n.y + n.h <= b.y + b.h)));

/* ------------------------------------------------------------ linked to the house style */
const linked = (n, f) => !!n.sys && n.sys.s === "sys_house" && !!n.sys.f?.[f];
const words = nodes.filter((n) => n.featureId === "prose");
check("every line of words points at a type step, a face and a colour", words.length >= 4 && words.every((n) => linked(n, "font.px") && linked(n, "font.stack") && linked(n, "colour.text")));
const buttons = nodes.filter((n) => n.featureId === "cta-primary");
check("every button points at its fill, its words, its corners and its padding", buttons.length === 2 && buttons.every((n) => ["colour.bg", "colour.text", "radius", "pad.left", "pad.right"].every((f) => linked(n, f))));
check("…the main button is the accent", buttons.some((n) => n.sys.f["colour.bg"] === house.tokens.colour.find((c) => c.role === "accent").id));
check("every band points at the background or the surface", bands.length >= 3 && bands.every((n) => ["col_1", "col_2"].includes(n.sys?.f?.["colour.bg"])));
check("every link holds: each field holds its token's value", K.linksHold(nodes, house).length === 0, J(K.linksHold(nodes, house).slice(0, 3)));
const tok = (id) => [...house.tokens.type.steps, ...house.tokens.space, ...house.tokens.radius].find((t) => t.id === id) ?? house.tokens.colour.find((t) => t.id === id) ?? house.tokens.type.faces.find((t) => t.id === id);
const t1 = words.find((n) => n.content === "Make something with your hands this week");
check("…the title is the house style's own size and face", t1.font.px === tok(t1.sys.f["font.px"]).px && t1.font.stack === tok(t1.sys.f["font.stack"]).stack);
check("the board's palette is the house style's roles", board.palette.accent === house.tokens.colour.find((c) => c.role === "accent").value);
const contrastOf = (await jiti.import(join(studio, "look", "styleKits.ts"))).contrastOf;
const bandAt = (n) => bands.find((b) => n.y >= b.y && n.y + n.h <= b.y + b.h);
check("every line of words reads at 4.5 to 1 on its band", words.every((n) => contrastOf(n.colour.text, bandAt(n).colour.bg) >= 4.5), words.map((n) => contrastOf(n.colour.text, bandAt(n).colour.bg).toFixed(1)).join(" "));

/* ------------------------------------------------------------ on a captured System too */
const sys = H.systemFromTheme(theme, "Plain");
const plain = P.plainPlan({ text: "A booking site for a small pottery studio. Classes and a shop.", sections: ["Classes", "Shop"], ref: null }, "Clay");
const pb = B.planToBoard(plain, sys, { pageId: "page_home" });
check("with no key, the plain plan has the sections he named", ["Classes", "Shop"].every((s) => pb.nodes.some((n) => n.content === s)));
check("…every catalogue part in it is draftable", plain.sections.flatMap((s) => s.parts).every((p) => p.kind !== "part" || allowed.has(p.featureId)), J(plain.sections.flatMap((s) => s.parts).filter((p) => p.kind === "part").map((p) => p.featureId)));
check("…and it is linked too", K.linksHold(pb.nodes, sys).length === 0 && pb.nodes.filter((n) => n.featureId === "prose").every((n) => n.sys?.f?.["font.px"]));

/* ------------------------------------------------------------ the one call, stubbed */
const A = await jiti.import(join(studio, "idea", "ask.ts"));
const sent = [];
const stub = (answer, stop = "end_turn") => async (system, blocks) => { sent.push({ system, blocks }); return { text: answer, stop }; };
const idea = { text: "A booking site for a small pottery studio in Leeds.", sections: ["Classes", "Shop"], ref: "https://example.com" };
const asked = await A.askForPlan({ idea }, stub("```json\n" + J(STUB) + "\n```"));
check("a stubbed answer in a fence still reads as the plan", asked.ok && asked.plan.sections.length === plan.sections.length);
check("…one call, the catalogue first and marked for caching, the idea after it", sent.length === 1 && sent[0].blocks[0].cache === true && sent[0].blocks[0].text === P.catalogueText() && /pottery/.test(sent[0].blocks[1].text) && /Classes, Shop/.test(sent[0].blocks[1].text) && /example\.com/.test(sent[0].blocks[1].text));
check("…the latest model", A.DRAFT_MODEL === "claude-opus-5-5");
check("a refusal says so", (await A.askForPlan({ idea }, stub("", "refusal"))).reason === "refusal");
check("an answer that is not a plan says so", (await A.askForPlan({ idea }, stub("no plan here"))).reason === "unreadable");
check("an empty idea makes no call", (await A.askForPlan({ idea: { ...idea, text: " " } }, stub(J(STUB)))).reason === "empty" && sent.length === 3);

console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
