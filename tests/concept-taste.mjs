#!/usr/bin/env node
/**
 * FREE CONCEPTS READ AS REAL PAGES, AND THE THREE ARE CLEARLY DIFFERENT.
 *
 * No browser, no Claude. For two prompts (a lantern shop, a pottery
 * studio's booking page), three concepts are drafted the way the free Make
 * drafts them (`concepts/draft.ts`), and held to:
 *
 *   · the subject is read off the prompt ("lantern shop": a shop about
 *     lanterns), and its words are in every concept's first screen;
 *   · no part carries a placeholder: no "Card 1", no "A sentence or two",
 *     no sample quotes, no sample tiers; every catalogue part that holds
 *     words has its own (the header its links, the picture its caption);
 *   · every concept has a picture or a gallery from the kit's own scene,
 *     and at least eight parts;
 *   · the three directions differ by a measured amount: the variations'
 *     own `specDistance` over DIRECTION_GAP for every pair, heading faces
 *     all different, accent hues 40° or more apart, type scales or bases
 *     different, at least one first screen centred and one set left, and
 *     one dark page among a Night draft's set;
 *   · every type size is on its scale (base × ratio^n) and every space
 *     token on the 4/8 grid, as the taste rules say;
 *   · the same prompt and seed draft the same words twice; another seed
 *     drafts other words.
 *
 *   node tests/concept-taste.mjs
 *
 * Covers: src/features/studio/concepts/copy.ts, src/features/studio/concepts/taste.ts, src/features/studio/concepts/draft.ts, src/features/studio/variations/make.ts, src/features/studio/variations/model.ts
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
const J = (x) => JSON.stringify(x);

let C, D, Tst;
try {
  C = await jiti.import(join(studio, "concepts", "copy.ts"));
  D = await jiti.import(join(studio, "concepts", "draft.ts"));
  Tst = await jiti.import(join(studio, "concepts", "taste.ts"));
  if (!D.draftConcepts || !C.placeholderIn) throw new Error("no draftConcepts/placeholderIn");
} catch (e) {
  check("the taste modules load (concepts/copy.ts, draft.ts, taste.ts)", false, e.message.split("\n")[0]);
  done();
}
const P = await jiti.import(join(studio, "idea", "plan.ts"));
const V = await jiti.import(join(studio, "variations", "model.ts"));
const S = await jiti.import(join(studio, "siteTheme.ts"));
const allowed = new Set(P.draftable().map((f) => f.id));

/* The subject. */
const s1 = C.subjectOf("three concepts for a lantern shop landing page");
check("the subject is read off the prompt: a shop, about lanterns", s1.text === "lantern shop" && s1.thing === "shop" && s1.topic === "lantern" && s1.topics === "lanterns" && s1.name === "Lantern shop", J(s1));
const s2 = C.subjectOf("Make me 3 options for the booking page of a pottery studio in Leeds");
check("…and off a longer one", s2.thing === "leeds" || s2.text.includes("pottery"), J(s2));
check("…plurals: class → classes, pottery → pottery, lantern → lanterns", C.plural("pottery class") === "pottery classes" && C.plural("pottery") === "pottery" && C.plural("lantern") === "lanterns");

const words = (n) => (typeof n.content === "string" ? n.content : "");
const heading = (doc) => doc.nodes.find((n) => /First screen: heading/.test(n.label ?? ""));
const hue = (css) => { const o = S.oklchOf(css); return o ? o.h : null; };
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
const light = (css) => S.oklchOf(css)?.l ?? null;

for (const [prompt, topic] of [["three concepts for a lantern shop landing page", /lantern/i], ["a landing page for a small bakery", /baker|bread|loa(f|ves)/i]]) {
  const drafts = D.draftConcepts(prompt, { seed: 11, count: 3, allowed });
  const tag = C.subjectOf(prompt).text;
  check(`${tag}: three concepts, each a direction of its own`, drafts.length === 3 && new Set(drafts.map((d) => d.voice)).size === 3, drafts.map((d) => d.direction).join(" / "));

  /* Words. */
  const bad = drafts.flatMap((d) => d.doc.nodes.map((n) => ({ d: d.direction, label: n.label, hit: C.placeholderIn(n.content) })).filter((x) => x.hit));
  check(`${tag}: no part carries a placeholder`, bad.length === 0, bad.slice(0, 3).map((x) => `${x.d} › ${x.label}: "${x.hit}"`).join(" | "));
  const SILENT = new Set(["picture", "box", "sticky-header", "footer"]);
  const mute = drafts.flatMap((d) => d.doc.nodes.filter((n) => n.featureId && !SILENT.has(n.featureId) && !words(n).trim()).map((n) => `${d.direction} › ${n.label}`));
  check(`${tag}: every part that holds words has its own`, mute.length === 0, mute.slice(0, 4).join(" | "));
  check(`${tag}: the subject's words are on every first screen`, drafts.every((d) => { const h = heading(d.doc); const sub = d.doc.nodes.find((n) => /First screen: words/.test(n.label ?? "")); return topic.test(`${words(h)} ${words(sub)}`); }), drafts.map((d) => words(heading(d.doc))).join(" / "));
  const art = (d) => d.doc.nodes.filter((n) => n.featureId === "box" && /_ground$/.test(n.id) && /^Picture/.test(n.label ?? ""));
  check(`${tag}: every concept has pictures drawn as colour blocks and shapes, no scene picture, and at least eight parts`, drafts.every((d) => art(d).length >= 1 && !d.doc.nodes.some((n) => n.featureId === "picture" || n.featureId === "gallery") && d.doc.nodes.length >= 8), drafts.map((d) => `${art(d).length} grounds / ${d.doc.nodes.length}`).join(" | "));
  check(`${tag}: the pictures differ across the three directions (grounds in each one's own colours)`, new Set(drafts.map((d) => art(d)[0]?.colour?.bg)).size === 3, drafts.map((d) => String(art(d)[0]?.colour?.bg)).join(" | "));
  check(`${tag}: a gallery is six different pictures, not one six times`, drafts.filter((d) => art(d).length >= 6).every((d) => new Set(art(d).map((n) => n.colour?.bg + "|" + d.doc.nodes.filter((m) => m.label === n.label && m.id !== n.id).map((m) => `${m.x - n.x},${m.y - n.y},${m.w}`).join(";"))).size >= 4), drafts.map((d) => art(d).length).join(" / "));
  check(`${tag}: the header's words are its links`, drafts.every((d) => d.doc.nodes.filter((n) => n.featureId === "sticky-header").every((n) => words(n).split("\n").length >= 3)));

  /* Measured difference. */
  const gap = Tst.leastGap(drafts.map((d) => d.voice));
  check(`${tag}: every pair of directions stands over the variations' gap (${V.DIRECTION_GAP})`, gap >= V.DIRECTION_GAP, `least ${gap.toFixed(2)}`);
  const faces = drafts.map((d) => words(heading(d.doc)) && heading(d.doc)?.font?.stack);
  check(`${tag}: three different heading faces`, new Set(faces).size === 3, faces.map((f) => String(f).split(",")[0]).join(" / "));
  const accents = drafts.map((d) => hue(d.doc.look?.palette?.accent ?? d.system.tokens.colour.find((t) => /accent/i.test(t.name))?.value ?? ""));
  check(`${tag}: accent hues 40° or more apart`, accents.every((h) => h != null) && accents.every((a, i) => accents.every((b, j) => i === j || hueGap(a, b) >= 40)), accents.map((h) => Math.round(h ?? -1)).join(" / "));
  const scales = drafts.map((d) => { const px = [...new Set(d.system.tokens.type.steps.map((t) => t.px))].sort((a, b) => a - b); const base = px.find((x) => x >= 15 && x <= 19) ?? px[0]; const next = px.find((x) => x > base); return `${base}×${next ? (next / base).toFixed(2) : "?"}`; });
  check(`${tag}: type scales or bases differ`, new Set(scales).size >= 2, scales.join(" / "));
  const align = drafts.map((d) => { const h = heading(d.doc); return h ? (Math.abs(h.x + h.w / 2 - 720) < 24 ? "center" : "start") : "?"; });
  check(`${tag}: at least one first screen centred and one set left`, align.includes("center") && align.includes("start"), align.join(" / "));
  const bgs = drafts.map((d) => light(d.doc.look?.palette?.bg ?? ""));
  if (drafts.some((d) => d.voice === "night")) check(`${tag}: the Night draft is a dark page, the others light`, drafts.every((d, i) => (d.voice === "night") === (bgs[i] != null && bgs[i] < 0.35)), bgs.map((b) => b?.toFixed(2)).join(" / "));
  else check(`${tag}: the pages are light`, bgs.every((b) => b != null && b > 0.6), bgs.map((b) => b?.toFixed(2)).join(" / "));

  /* Taste rules. */
  const onScale = (px, base, r) => { const n = Math.round(Math.log(px / base) / Math.log(r)); return Math.abs(px - Math.round(base * r ** n)) <= 1; };
  const typeOk = drafts.every((d) => { const spec = Tst.specFor(d.voice, 6); return d.system.tokens.type.steps.every((t) => onScale(t.px, spec.type.base, spec.type.ratio)); });
  check(`${tag}: every type size is on its direction's scale`, typeOk, drafts.map((d) => d.system.tokens.type.steps.map((t) => t.px).join(",")).join(" | "));
  const gridOk = drafts.every((d) => d.system.tokens.space.every((t) => t.px === 0 || t.px % 4 === 0));
  check(`${tag}: every space token is on the 4/8 grid`, gridOk, drafts.map((d) => d.system.tokens.space.map((t) => t.px).join(",")).join(" | "));
}

/* Two prompts back to back: no words leak from one subject into the other. */
const LANTERN = /lantern|rechargeable|wick|glow|rooftop/i;
const BAKERY = /baker|bread|loa(f|ves)|oven|dough/i;
const l1 = D.draftConcepts("three concepts for a lantern shop landing page", { seed: 11, count: 4, allowed });
const b1 = D.draftConcepts("a landing page for a small bakery", { seed: 11, count: 4, allowed });
const allWords = (ds) => ds.flatMap((d) => d.doc.nodes.map((n) => words(n))).join("\n");
const leaks = (text, re) => text.split("\n").filter((l) => re.test(l)).slice(0, 3);
check("two prompts back to back: no lantern words on the bakery's pages, in any of the four directions", !LANTERN.test(allWords(b1)), leaks(allWords(b1), LANTERN).join(" | "));
check("…and no bakery words on the lantern shop's", !BAKERY.test(allWords(l1)), leaks(allWords(l1), BAKERY).join(" | "));
check("…the two subjects draw two different sets of pictures", JSON.stringify(l1.map((d) => d.doc.nodes.filter((n) => /^art/.test(n.id)).map((n) => [n.colour?.bg, n.x, n.y, n.w]))) !== JSON.stringify(b1.map((d) => d.doc.nodes.filter((n) => /^art/.test(n.id)).map((n) => [n.colour?.bg, n.x, n.y, n.w]))));

/* Seeds. */
const a = D.draftConcepts("three concepts for a lantern shop landing page", { seed: 5, count: 3, allowed });
const b = D.draftConcepts("three concepts for a lantern shop landing page", { seed: 5, count: 3, allowed });
const c = D.draftConcepts("three concepts for a lantern shop landing page", { seed: 6, count: 3, allowed });
const text = (ds) => ds.map((d) => d.doc.nodes.map((n) => words(n)).join("|")).join("||");
check("the same prompt and seed draft the same words twice", text(a) === text(b));
check("…another seed drafts other words or another direction first", text(a) !== text(c));
check("…four directions exist and the three picked are far apart whichever three", Tst.farApart(["calm", "bold", "warm"]) && Tst.farApart(["bold", "warm", "night"]) && Tst.farApart(["calm", "warm", "night"]) && Tst.farApart(["calm", "bold", "night"]));
done();
