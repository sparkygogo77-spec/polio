#!/usr/bin/env node
/**
 * MAKE ALL LIKE THIS: every part of the picked part's kind on the site
 * restyled to its look, counted first, in one undo step, with the choice to
 * keep each part's own colour.
 *
 * On Trump & Morty, Parasite and gotchi, each loaded whole from sink, a
 * button with a look of its own is picked, and the part panel's Make all
 * like this:
 *
 *   · counts, before anything changes, exactly the parts of its kind on the
 *     site that the look would change (partKind.ts and partLook.ts, read
 *     here on the same document);
 *   · applied, is one undo step; every one of them wears the chosen facets
 *     (motion stays each part's own, as the keys start), at its own place,
 *     size and words; no part of another kind changes;
 *   · one Undo puts the whole site back as it was;
 *   · with Keep each part's own colour on, each keeps its fill and outline
 *     colour and takes the rest: outline width, corners, font;
 *   · in the export served on its own, the reached buttons paint their box
 *     and words as the source does.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/make-all-like.mjs http://127.0.0.1:3013 <path to a sink checkout>
 */
import { createJiti } from "jiti";
import { SITES, sinkRoot, launch, openSite, PAINT } from "./fixtures/look-sites.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const ROOT = sinkRoot(process.argv[3]);
const jiti = createJiti(import.meta.url);
const { lookOf, lookHas, lookDiffers } = await jiti.import("../src/features/studio/partLook.ts");
const { sameKind, kindKey } = await jiti.import("../src/features/studio/partKind.ts");

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);
/* What a look never touches. A part's place and size may move: a new font that needs more room grows its part and the board heals round it, in the same step. */
const KEEP = ["content", "label", "link", "pageId", "featureId", "picture"];
const LOOKS = ["colour", "hue", "texture", "opacity", "edge", "aura", "auraSize", "auraStyle", "radius", "shape", "font", "text", "art", "motion", "anim", "work", "worn"];

const browser = await launch();
for (const site of SITES) {
  console.log(`\n${site}`);
  const s = await openSite(browser, BASE, ROOT, site);
  const { page } = s;
  const doc0 = await s.doc();
  const drawn = new Set(await page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; }).map((e) => e.getAttribute("data-node-id"))));
  /* The button with the most look of its own that would change at least two others. */
  const buttons = doc0.nodes.filter((n) => n.pageId === doc0.pages[0].id && drawn.has(n.id) && kindKey(n) === "button");
  const ranked = buttons.map((n) => ({ n, look: lookOf(n) })).map((x) => ({ ...x, has: lookHas(x.look) })).sort((a, b) => b.has.length - a.has.length);
  const src = ranked.find((x) => sameKind(doc0.nodes, x.n).filter((m) => lookDiffers(m, x.look, x.has.filter((f) => f !== "motion")).length).length >= 2);
  check(`${site}: a button with a look of its own that two or more of its kind do not wear`, !!src, src ? `${src.n.id}, ${src.has.join(", ")}` : "none");
  if (!src) { await s.close(); continue; }
  const chosen = src.has.filter((f) => f !== "motion");
  const want = sameKind(doc0.nodes, src.n).filter((m) => lookDiffers(m, src.look, chosen).length).map((m) => m.id);

  await s.pick(src.n.id);
  const btn = page.locator("[data-make-all-button]");
  await btn.scrollIntoViewIfNeeded();
  const count = Number(await btn.getAttribute("data-make-all-count"));
  check(`${site}: it counts the ${want.length} parts of its kind the look would change, before changing any`, count === want.length, `${count} against ${want.length}: ${await btn.innerText()}`);
  const keys = await page.locator("[data-make-all] [data-make-all-facet]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-make-all-facet"), e.getAttribute("aria-pressed")]));
  check(`${site}: …a key for each facet the look has, all on but motion`, J(keys.map((k) => k[0])) === J(src.has) && keys.every(([f, p]) => (p === "true") === (f !== "motion")), J(keys));
  await btn.hover();
  await page.waitForTimeout(300);
  await page.mouse.move(5, 5);

  const depth0 = await s.undoDepth();
  await btn.click();
  await page.waitForTimeout(600);
  check(`${site}: applied, it is one undo step`, (await s.undoDepth()) === depth0 + 1, `${depth0} → ${await s.undoDepth()}`);
  check(`${site}: …and says how many it restyled`, new RegExp(`Restyled ${want.length} button`).test(await page.locator("[data-make-all-said]").innerText().catch(() => "")), await page.locator("[data-make-all-said]").innerText().catch(() => "nothing"));
  const doc1 = await s.doc();
  const by1 = new Map(doc1.nodes.map((n) => [n.id, n])), by0 = new Map(doc0.nodes.map((n) => [n.id, n]));
  const wrong = want.filter((id) => chosen.some((f) => f !== "light" && J(lookOf(by1.get(id)).facets[f]) !== J(src.look.facets[f])));
  check(`${site}: every one of them wears the source's ${chosen.join(", ")}`, wrong.length === 0, wrong.slice(0, 4).join(", "));
  const ownMotion = want.filter((id) => J(lookOf(by1.get(id)).facets.motion) !== J(lookOf(by0.get(id)).facets.motion));
  check(`${site}: …each keeps its own motion`, ownMotion.length === 0, ownMotion.join(", "));
  const moved = want.filter((id) => KEEP.some((k) => J(by1.get(id)[k]) !== J(by0.get(id)[k])));
  check(`${site}: …with its own words, link and page`, moved.length === 0, moved.join(", "));
  const others = doc0.nodes.filter((n) => n.id !== src.n.id && !want.includes(n.id) && LOOKS.some((k) => J(n[k] ?? null) !== J(by1.get(n.id)?.[k] ?? null)));
  check(`${site}: no part of another kind changes its look`, others.length === 0, others.slice(0, 4).map((n) => n.id).join(", "));

  /* Export: the reached buttons paint as the source. */
  const url = await s.served();
  const out = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  await out.goto(url, { waitUntil: "load" });
  await out.waitForTimeout(1500);
  const es = await out.evaluate(PAINT, `#${src.n.id} > *`);
  const unlike = [];
  for (const id of want.slice(0, 6)) {
    const et = await out.evaluate(PAINT, `#${id} > *`);
    if (!et || J(et.box) !== J(es?.box) || (chosen.includes("font") && J({ ...et.words, colour: 0 }) !== J({ ...es?.words, colour: 0 }))) unlike.push(`${id}: ${J(et)}`);
  }
  check(`${site}: in the export, the reached buttons paint their box and words as the source`, unlike.length === 0, unlike.slice(0, 2).join(" | ") + (unlike.length ? ` against ${J(es)}` : ""));
  await out.close();

  /* One Undo: the whole site as it was. */
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(600);
  const doc2 = await s.doc();
  check(`${site}: one Undo puts the whole site back`, J(doc2.nodes) === J(doc0.nodes));

  /* Keep each part's own colour. */
  await s.pick(src.n.id);
  await page.locator("[data-make-all-keep-colour]").click();
  await page.waitForTimeout(300);
  const btn2 = page.locator("[data-make-all-button]");
  if (Number(await btn2.getAttribute("data-make-all-count")) > 0) {
    await btn2.click();
    await page.waitForTimeout(600);
    const doc3 = await s.doc();
    const by3 = new Map(doc3.nodes.map((n) => [n.id, n]));
    const reached = want.filter((id) => J(by3.get(id)) !== J(by0.get(id)));
    const lostColour = reached.filter((id) => J(by3.get(id).colour ?? null) !== J(by0.get(id).colour ?? null) || (by0.get(id).edge?.colour && by3.get(id).edge?.colour !== by0.get(id).edge.colour));
    check(`${site}: with Keep each part's own colour, each keeps its fill and outline colour`, reached.length > 0 && lostColour.length === 0, `${reached.length} reached; ${lostColour.slice(0, 3).join(", ")}`);
    const rest = reached.filter((id) => (chosen.includes("outline") && (by3.get(id).edge?.width ?? null) !== (src.n.edge?.width ?? null)) || (chosen.includes("corners") && (by3.get(id).radius ?? null) !== (src.n.radius ?? null)) || (chosen.includes("font") && J(by3.get(id).font ?? null) !== J(src.n.font ?? null)));
    check(`${site}: …and takes the rest: outline width, corners, font`, rest.length === 0, rest.slice(0, 3).join(", "));
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(400);
  } else check(`${site}: with Keep each part's own colour, the look still reaches its kind`, false, "nothing to change");
  await page.evaluate(() => { const v = JSON.parse(localStorage.getItem("builder.makeAll") || "{}"); if (v.state) { v.state.keepColour = false; localStorage.setItem("builder.makeAll", JSON.stringify(v)); } });
  check(`${site}: no page errors`, s.errors.length === 0, s.errors.slice(0, 2).join(" | "));
  await s.close();
}
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
