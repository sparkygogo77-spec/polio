#!/usr/bin/env node
/**
 * TRY BEFORE YOU APPLY: pointing at a style, a colour, an effect or a copied
 * look dresses the picked part in it on the board, at once; pointing away
 * takes it off; a click puts it on.
 *
 * On Trump & Morty, Parasite and gotchi, each loaded whole from sink, with
 * one of the site's buttons picked:
 *
 *   · one of the site's own styles (the part panel's Styles), pointed at:
 *     the part paints in it on the board; nothing is written (the saved
 *     document and the undo history are as they were); pointing away
 *     paints it as it was, exactly;
 *   · clicked: written, as one undo step, and the board paints it as the
 *     try did; the export paints it as the board does;
 *   · a colour swatch of the part's Colour, pointed at and left: the same;
 *   · a shelf effect (Spin) pointed at: it plays on the part; left: it
 *     stops; nothing written;
 *   · Paste look, pointed at with another button's look held: the part
 *     wears it, and is itself again when left.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/try-look.mjs http://127.0.0.1:3013 <the capture folder>
 */
import { SITES, sinkRoot, launch, openSite, PAINT } from "./fixtures/look-sites.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const ROOT = sinkRoot(process.argv[3]);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);
/* What a part paints with, lengths left out: the board draws at its zoom, the export at 1:1. */
const colours = (p) => p && { box: p.box && { bg: p.box.bg, bgi: p.box.bgi, border: p.box.border.replace(/^[\d.]+px /, ""), shadow: p.box.shadow.replace(/-?[\d.]+px/g, "L") }, words: p.words && { family: p.words.family, weight: p.words.weight, colour: p.words.colour } };

const browser = await launch();
for (const site of SITES) {
  console.log(`\n${site}`);
  const s = await openSite(browser, BASE, ROOT, site);
  const { page } = s;
  const doc0 = await s.doc();
  const drawn = new Set(await page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; }).map((e) => e.getAttribute("data-node-id"))));
  const buttons = doc0.nodes.filter((n) => n.pageId === doc0.pages[0].id && n.featureId === "cta-primary" && drawn.has(n.id) && n.w > 30 && n.h > 18);
  const part = buttons[0], other = buttons.find((b) => J(b.edge ?? null) !== J(part?.edge ?? null) || J(b.colour ?? null) !== J(part?.colour ?? null));
  check(`${site}: a button to try things on`, !!part, part?.id ?? "none");
  if (!part) { await s.close(); continue; }
  const paint = () => page.evaluate(PAINT, `[data-node-id="${part.id}"] [data-part-box]`);
  const saved = async () => J((await s.doc()).nodes.find((n) => n.id === part.id));

  await s.pick(part.id);
  const before = await paint(), was = await saved(), depth0 = await s.undoDepth();

  /* A style of the site's own. */
  const swatches = page.locator("[data-kit-styles] [data-kit-style]");
  await swatches.first().scrollIntoViewIfNeeded().catch(() => {});
  let tried = null, which = null;
  for (let i = 0; i < Math.min(8, await swatches.count()); i++) {
    await swatches.nth(i).hover();
    await page.waitForTimeout(250);
    const p = await paint();
    if (J(p) !== J(before)) { tried = p; which = await swatches.nth(i).getAttribute("data-kit-style"); break; }
  }
  check(`${site}: pointing at one of the site's styles paints the part in it on the board`, !!tried, which ?? `${await swatches.count()} styles, none changed it`);
  { const now = JSON.parse(await saved()), w0 = JSON.parse(was); const diff = Object.keys({ ...now, ...w0 }).filter((k) => J(now[k]) !== J(w0[k])); check(`${site}: …and writes nothing: the saved part and the undo history are as they were`, diff.length === 0 && (await s.undoDepth()) === depth0, `${diff.map((k) => `${k}: ${J(w0[k])} → ${J(now[k])}`).join("; ")} depth ${depth0} → ${await s.undoDepth()}`); }
  await page.mouse.move(3, 300);
  await page.waitForTimeout(250);
  check(`${site}: pointing away paints it as it was, exactly`, J(await paint()) === J(before), J(await paint()));
  if (which) {
    await page.locator(`[data-kit-style="${which}"]`).hover();
    await page.waitForTimeout(200);
    await page.locator(`[data-kit-style="${which}"]`).click();
    await page.waitForTimeout(500);
    await page.mouse.move(3, 300);
    await page.waitForTimeout(250);
    check(`${site}: clicked, it is written, as one undo step`, (await saved()) !== was && (await s.undoDepth()) === depth0 + 1, `${depth0} → ${await s.undoDepth()}`);
    const put = await paint();
    check(`${site}: …and the board paints it as the try did`, J(put) === J(tried), `${J(put)} against ${J(tried)}`);
    const url = await s.served();
    const out = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    await out.goto(url, { waitUntil: "load" });
    await out.waitForTimeout(1200);
    const exp = await out.evaluate(PAINT, `#${part.id} > *`);
    check(`${site}: …and the export paints it as the board does`, J(colours(exp)) === J(colours(put)), `${J(colours(exp))} against ${J(colours(put))}`);
    await out.close();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(400);
    await s.pick(part.id);
  }

  /* A colour of the part's Colour. */
  const base = await paint(), was2 = await saved();
  const use = page.locator('[data-part-panel] button[aria-label^="Use "]');
  let changed = false;
  for (let i = 0; i < Math.min(5, await use.count()); i++) {
    await use.nth(i).hover();
    await page.waitForTimeout(200);
    if (J(await paint()) !== J(base)) { changed = true; break; }
  }
  check(`${site}: pointing at a colour paints the part in it, writing nothing`, changed && (await saved()) === was2, `${await use.count()} colours`);
  await page.mouse.move(3, 300);
  await page.waitForTimeout(250);
  check(`${site}: …and pointing away puts it back`, J(await paint()) === J(base));

  /* An effect on the shelf. */
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("studio:shelf", { detail: "motion" })));
  await page.waitForTimeout(1200);
  const spin = page.locator('[data-work-card="spin"]').first();
  if (await spin.count()) {
    await spin.scrollIntoViewIfNeeded().catch(() => {});
    await spin.hover();
    await page.waitForTimeout(500);
    const playing = await page.evaluate((id) => { const d = document.querySelector(`[data-node-id="${id}"] > [data-part-drawn]`); return d ? d.getAnimations().length : -1; }, part.id);
    check(`${site}: pointing at Spin on the shelf plays it on the part`, playing > 0, `${playing} animations`);
    check(`${site}: …writing nothing`, (await saved()) === was2);
    await page.mouse.move(3, 300);
    await page.waitForTimeout(400);
    const still = await page.evaluate((id) => { const d = document.querySelector(`[data-node-id="${id}"] > [data-part-drawn]`); return d ? d.getAnimations().filter((a) => !a.animationName).length : -1; }, part.id);
    check(`${site}: …and leaving it stops it`, still === 0, `${still} left playing`);
  } else check(`${site}: the shelf shows Spin`, false, "no Spin card");
  await page.keyboard.press("Escape");

  /* Paste look, pointed at. */
  if (other) {
    await s.pick(other.id);
    await page.locator("[data-look-copy-button]").first().scrollIntoViewIfNeeded();
    await page.locator("[data-look-copy-button]").first().click();
    await s.pick(part.id);
    const b3 = await paint(), w3 = await saved();
    const pb = page.locator("[data-look-copy] [data-look-paste-button]").first();
    await pb.scrollIntoViewIfNeeded();
    await pb.hover();
    await page.waitForTimeout(300);
    const wearing = await paint();
    const theirs = await page.evaluate(PAINT, `[data-node-id="${other.id}"] [data-part-box]`);
    check(`${site}: pointing at Paste look dresses the part in the copied look`, J(wearing) !== J(b3) && J(colours(wearing)?.box) === J(colours(theirs)?.box), `${J(colours(wearing))} against ${J(colours(theirs))}`);
    await page.mouse.move(3, 300);
    await page.waitForTimeout(250);
    check(`${site}: …and left, it is itself again, nothing written`, J(await paint()) === J(b3) && (await saved()) === w3);
  }
  check(`${site}: no page errors`, s.errors.length === 0, s.errors.slice(0, 2).join(" | "));
  await s.close();
}
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
