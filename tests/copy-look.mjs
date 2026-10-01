#!/usr/bin/env node
/**
 * COPY LOOK, PASTE LOOK: one part's style on others, chosen facet by facet,
 * in one undo step.
 *
 * On Trump & Morty, Parasite and gotchi, each loaded whole from sink: a
 * button with a look of its own is picked and its look copied from the part
 * panel; two other buttons are picked together; one facet the look has is
 * switched off (Motion, else Hover and press, else Light), and Paste look
 * puts the rest on both:
 *
 *   · every chosen facet of each target is now the source's (partLook.ts
 *     reads them the same way the paste writes them);
 *   · the facet switched off is the target's own still, and so is
 *     everything a look does not own: place, size, words, link, page;
 *   · it is one undo step, and one Undo puts both back exactly;
 *   · on the board and in the export served on its own, each target paints
 *     its box and words as the source does.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/copy-look.mjs http://127.0.0.1:3013 <path to a sink checkout>
 */
import { createJiti } from "jiti";
import { SITES, sinkRoot, launch, openSite, PAINT } from "./fixtures/look-sites.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const ROOT = sinkRoot(process.argv[3]);
const jiti = createJiti(import.meta.url);
const { lookOf, lookHas, lookDiffers, FACETS } = await jiti.import("../src/features/studio/partLook.ts");

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);
const KEEP = ["x", "y", "w", "h", "content", "label", "link", "pageId", "featureId", "picture"];

/** A source button with a look of its own and two other buttons it would change, among those drawn on the first page. */
function choose(doc, drawn) {
  const page = doc.pages[0].id;
  const top = doc.nodes.filter((n) => n.pageId === page && n.featureId === "cta-primary" && drawn.has(n.id) && n.w > 30 && n.h > 18 && !n.inert);
  const rich = [...top].sort((a, b) => lookHas(lookOf(b)).length - lookHas(lookOf(a)).length);
  for (const src of rich) {
    const look = lookOf(src);
    const others = top.filter((n) => n.id !== src.id && lookDiffers(n, look, ["fill", "outline", "font", "corners", "shadow"]).length)
      .sort((a, b) => lookDiffers(b, look).length - lookDiffers(a, look).length);
    if (others.length >= 2) return { src, targets: others.slice(0, 2) };
  }
  return null;
}

const browser = await launch();
for (const site of SITES) {
  console.log(`\n${site}`);
  const s = await openSite(browser, BASE, ROOT, site);
  const { page } = s;
  const drawn = new Set(await page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(e).visibility !== "hidden"; }).map((e) => e.getAttribute("data-node-id"))));
  const pick = choose(await s.doc(), drawn);
  check(`${site}: a button with a look of its own, and two buttons that look otherwise`, !!pick, pick ? `${pick.src.id} → ${pick.targets.map((t) => t.id).join(", ")}` : "none");
  if (!pick) { await s.close(); continue; }
  const [t1, t2] = pick.targets;

  /* Copy, from the part panel. */
  await s.pick(pick.src.id);
  const copyBtn = page.locator("[data-look-copy-button]").first();
  await copyBtn.scrollIntoViewIfNeeded();
  await copyBtn.click();
  await page.waitForTimeout(300);
  const src = await s.node(pick.src.id);
  const look = lookOf(src);
  const has = lookHas(look);
  const off = ["motion", "hover", "light"].find((f) => has.includes(f)) ?? null;

  /* Two targets, picked together; one facet switched off; Paste. */
  await s.pick(t1.id);
  await s.pick(t2.id, true);
  const before = { [t1.id]: await s.node(t1.id), [t2.id]: await s.node(t2.id) };
  const keys = await page.locator("[data-look-copy] [data-look-facet]").evaluateAll((els) => els.map((e) => e.getAttribute("data-look-facet")));
  check(`${site}: the panel for the two offers a key for each facet the look has`, J(keys) === J(has), `${J(keys)} against ${J(has)}`);
  if (off) { await page.locator(`[data-look-copy] [data-look-facet="${off}"]`).click(); await page.waitForTimeout(200); }
  const chosen = has.filter((f) => f !== off);
  const depth0 = await s.undoDepth();
  const paste = page.locator("[data-look-copy] [data-look-paste-button]");
  check(`${site}: Paste look says it reaches both`, /on 2/.test(await paste.innerText()), await paste.innerText());
  await paste.click();
  await page.waitForTimeout(500);
  check(`${site}: …one undo step`, (await s.undoDepth()) === depth0 + 1, `${depth0} → ${await s.undoDepth()}`);
  check(`${site}: …and it says so`, /Restyled 2 parts, in one step/.test(await page.locator("[data-look-said]").innerText().catch(() => "")));

  for (const t of [t1, t2]) {
    const now = await s.node(t.id);
    const was = before[t.id];
    const wear = lookOf(now);
    const wrong = chosen.filter((f) => f !== "light" || (src.worn && now.worn)).filter((f) => J(wear.facets[f]) !== J(look.facets[f]));
    check(`${site} ${t.id}: wears the source's ${chosen.join(", ")}`, wrong.length === 0, wrong.map((f) => `${f}: ${J(wear.facets[f]).slice(0, 120)} against ${J(look.facets[f]).slice(0, 120)}`).join(" | "));
    if (off) check(`${site} ${t.id}: …and keeps its own ${off}`, J(wear.facets[off]) === J(lookOf(was).facets[off]));
    const moved = KEEP.filter((k) => J(now[k]) !== J(was[k]));
    check(`${site} ${t.id}: …its place, size, words, link and page untouched`, moved.length === 0, moved.join(", "));
  }

  /* Board: the targets paint as the source. */
  const paint = (id) => page.evaluate(PAINT, `[data-node-id="${id}"] [data-part-box]`);
  const ps = await paint(pick.src.id);
  for (const t of [t1, t2]) {
    const pt = await paint(t.id);
    check(`${site} ${t.id}: on the board, its box and words paint as the source's`, J(pt?.box) === J(ps?.box) && (!chosen.includes("font") || J({ ...pt?.words, colour: 0 }) === J({ ...ps?.words, colour: 0 })), `${J(pt)} against ${J(ps)}`);
  }

  /* Export: the same. */
  const url = await s.served();
  const site_ = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  await site_.goto(url, { waitUntil: "load" });
  await site_.waitForTimeout(1500);
  const es = await site_.evaluate(PAINT, `#${pick.src.id} > *`);
  for (const t of [t1, t2]) {
    const et = await site_.evaluate(PAINT, `#${t.id} > *`);
    check(`${site} ${t.id}: in the export, its box and words paint as the source's`, !!et && J(et.box) === J(es?.box) && (!chosen.includes("font") || J({ ...et.words, colour: 0 }) === J({ ...es?.words, colour: 0 })), `${J(et)} against ${J(es)}`);
  }
  await site_.close();

  /* One Undo puts both back exactly. */
  await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(500);
  const back = [t1, t2];
  const after = { [t1.id]: await s.node(t1.id), [t2.id]: await s.node(t2.id) };
  check(`${site}: one Undo puts both back exactly`, back.every((t) => J(after[t.id]) === J(before[t.id])), back.map((t) => t.id).join(", "));
  check(`${site}: no page errors`, s.errors.length === 0, s.errors.slice(0, 2).join(" | "));
  await s.close();
}
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
