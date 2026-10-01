#!/usr/bin/env node
/**
 * REMIX FROM THE LEARNED LIBRARY: every site you imported, not only your
 * other boards, offers its styles and motions, and the components you saved
 * can be brought too.
 *
 * Each of Trump & Morty, Parasite and gotchi is opened after another site
 * was imported first (Trump & Morty after gotchi, Parasite after Trump &
 * Morty, gotchi after Parasite), so that site is in the learned library
 * (library/learned.ts) but is no board here:
 *
 *   · Bring from another site offers it, marked learned, with its style
 *     kits as the rows of each kind, and its motions;
 *   · a learned button kit, placed with Keep the original look on, is a new
 *     button wearing exactly that kit (kitLook.ts), as one undo step; the
 *     export paints it as the board does;
 *   · placed without, it wears this site's look (remix.ts), not the kit's;
 *   · a learned motion is put on the picked part, as one undo step;
 *   · the part panel's Styles row offers the learned site's styles too:
 *     pointed at, the part wears one and nothing is written; clicked, it is
 *     written as one undo step;
 *   · a part saved as a component comes back through the same window,
 *     placed whole as one undo step.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/remix-learned.mjs http://127.0.0.1:3013 <path to a sink checkout>
 */
import { createJiti } from "jiti";
import { sinkRoot, siteDoc, launch, openSite, PAINT } from "./fixtures/look-sites.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const ROOT = sinkRoot(process.argv[3]);
const jiti = createJiti(import.meta.url);
const { lookOf, lookPatch } = await jiti.import("../src/features/studio/partLook.ts");
const { lookOfKit } = await jiti.import("../src/features/studio/kitLook.ts");

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);
const KIT_FACETS = ["fill", "outline", "shadow", "light", "corners", "font", "hover"];
const colours = (p) => p && { box: p.box && { bg: p.box.bg, border: p.box.border.replace(/^[\d.]+px /, "") }, words: p.words && { family: p.words.family, colour: p.words.colour } };

const PAIRS = [["trumpmorty-fun", "gotchi-gg"], ["parasiteonsol-fun", "trumpmorty-fun"], ["gotchi-gg", "parasiteonsol-fun"]];
const browser = await launch();
for (const [site, from] of PAIRS) {
  console.log(`\n${site}, after importing ${from}`);
  const s = await openSite(browser, BASE, ROOT, site);
  const { page } = s;
  /* Import the other site first (it is learned), then this one again: the board is this site, the library holds both. */
  const other = siteDoc(ROOT, from);
  await page.evaluate((d) => window.__studioLoadDoc(d), { ...other, activePageId: other.pages[0].id });
  await page.waitForTimeout(2500);
  const mine = siteDoc(ROOT, site);
  await page.evaluate((d) => window.__studioLoadDoc(d), { ...mine, activePageId: mine.pages[0].id });
  await page.waitForTimeout(3000);
  const here = await s.doc();
  const button = here.nodes.find((n) => n.pageId === here.activePageId && n.featureId === "cta-primary");

  const openRemix = async () => {
    await s.pick(button.id);
    const at = await page.evaluate((id) => { const r = document.querySelector(`[data-node-id="${id}"]`)?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; }, button.id);
    await page.mouse.click(at.x, at.y, { button: "right" });
    await page.waitForTimeout(600);
    await page.locator("[data-tray]").first().hover().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator('[data-tray-item="remix"]').first().click();
    await page.waitForTimeout(500);
  };
  await openRemix();
  const card = page.locator("[data-remix-card]");
  const learnedSrc = card.locator('[data-remix-source="learned"]');
  const hosts = await learnedSrc.evaluateAll((els) => els.map((e) => e.getAttribute("data-remix-site")));
  check(`${site}: Bring from another site offers ${from}, learned on import, though it is no board here`, hosts.length >= 1, J(hosts));
  if (!hosts.length) { await s.close(); continue; }
  const host = hosts.find((h) => other.nodes.some((n) => n.from?.host === h)) ?? hosts[0];
  await card.locator(`[data-remix-source="learned"][data-remix-site="${host}"]`).click();
  await page.waitForTimeout(400);
  await card.locator('[data-remix-kind="button"]').click();
  await page.waitForTimeout(300);
  const kitRows = card.locator('[data-remix-row-kind="kit"]');
  check(`${site}: …its button styles are the rows`, (await kitRows.count()) > 0, `${await kitRows.count()} kits`);
  const lib = await page.evaluate(async () => { const r = await new Promise((done) => { const q = indexedDB.open("builder.docs", 1); q.onsuccess = () => { const g = q.result.transaction("docs").objectStore("docs").get("builder.learned"); g.onsuccess = () => done(g.result ?? null); g.onerror = () => done(null); }; q.onerror = () => done(null); }); return r ?? localStorage.getItem("builder.learned"); });
  const learned = lib ? JSON.parse(lib) : null;
  const kitId = await kitRows.first().getAttribute("data-remix-row").catch(() => null);
  const kit = learned?.sites?.[host]?.kits?.find((k) => k.id === kitId);
  check(`${site}: …each one of the kits the library learned from ${from}`, !!kit, kitId ?? "none");

  /* Kept: a new button in exactly that kit. */
  if (kit) {
    await card.locator("[data-remix-keep]").click();
    await page.waitForTimeout(200);
    const d0 = await s.undoDepth();
    const before = new Set(here.nodes.map((n) => n.id));
    await card.locator(`[data-remix-place="${kitId}"]`).click();
    await page.waitForTimeout(700);
    const doc1 = await s.doc();
    const placed = doc1.nodes.filter((n) => !before.has(n.id));
    const p = placed[0];
    const base = { id: "kit", featureId: "cta-primary", colour: null, font: null, edge: null, radius: null };
    const want = lookOf({ ...base, ...lookPatch(base, lookOfKit(kit, { button: true }), KIT_FACETS) });
    const off = p ? KIT_FACETS.filter((f) => J(lookOf(p).facets[f]) !== J(want.facets[f])) : ["none placed"];
    check(`${site}: kept, it is a new button wearing exactly ${from}'s kit, in one undo step`, placed.length === 1 && p.featureId === "cta-primary" && off.length === 0 && (await s.undoDepth()) === d0 + 1, `${off.join(", ")}; depth ${d0} → ${await s.undoDepth()}`);
    if (p) {
      const board = await page.evaluate(PAINT, `[data-node-id="${p.id}"] [data-part-box]`);
      const url = await s.served();
      const out = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
      await out.goto(url, { waitUntil: "load" });
      await out.waitForTimeout(1200);
      const exp = await out.evaluate(PAINT, `#${p.id} > *`);
      check(`${site}: …and the export paints it as the board does`, !!board && J(colours(exp)) === J(colours(board)), `${J(colours(exp))} against ${J(colours(board))}`);
      await out.close();
    }
    /* Not kept: this site's look. */
    await card.locator("[data-remix-keep]").click();
    await page.waitForTimeout(200);
    const before2 = new Set(doc1.nodes.map((n) => n.id));
    await card.locator(`[data-remix-place="${kitId}"]`).click();
    await page.waitForTimeout(700);
    const q = (await s.doc()).nodes.find((n) => !before2.has(n.id));
    check(`${site}: placed without keeping, it wears this site's look, not ${from}'s`, !!q && q.remix?.kept === false && KIT_FACETS.some((f) => J(lookOf(q).facets[f]) !== J(want.facets[f])), q ? "" : "nothing placed");
  }

  /* A learned motion on the picked part. */
  await page.keyboard.press("Escape");
  await s.pick(button.id);
  await openRemix();
  await card.locator(`[data-remix-source="learned"][data-remix-site="${host}"]`).click();
  await page.waitForTimeout(300);
  await card.locator('[data-remix-kind="motions"]').click();
  await page.waitForTimeout(300);
  const put = card.locator("[data-remix-put]").first();
  if (await put.count()) {
    const was = J((await s.doc()).nodes.find((n) => n.id === button.id));
    const d1 = await s.undoDepth();
    await put.click();
    await page.waitForTimeout(600);
    const now = (await s.doc()).nodes.find((n) => n.id === button.id);
    check(`${site}: a motion ${from} taught is put on the picked part, in one undo step`, J(now) !== was && (await s.undoDepth()) === d1 + 1, `depth ${d1} → ${await s.undoDepth()}`);
  } else check(`${site}: ${from} taught a motion to offer`, false, "no motion rows");
  await page.keyboard.press("Escape");

  /* The Styles row: learned styles too. */
  await s.pick(button.id);
  const styles = page.locator("[data-kit-styles-learned] [data-kit-style]");
  await styles.first().scrollIntoViewIfNeeded().catch(() => {});
  const paint = () => page.evaluate(PAINT, `[data-node-id="${button.id}"] [data-part-box]`);
  const p0 = await paint(), w0 = J((await s.doc()).nodes.find((n) => n.id === button.id));
  let worn = null;
  for (let i = 0; i < Math.min(6, await styles.count()); i++) {
    await styles.nth(i).hover();
    await page.waitForTimeout(250);
    if (J(await paint()) !== J(p0)) { worn = i; break; }
  }
  check(`${site}: the Styles row offers styles learned from other sites; pointed at, the part wears one, nothing written`, worn !== null && J((await s.doc()).nodes.find((n) => n.id === button.id)) === w0, `${await styles.count()} learned styles`);
  if (worn !== null) {
    const d2 = await s.undoDepth();
    await styles.nth(worn).click();
    await page.waitForTimeout(500);
    check(`${site}: …clicked, it is written, in one undo step`, J((await s.doc()).nodes.find((n) => n.id === button.id)) !== w0 && (await s.undoDepth()) === d2 + 1);
  }

  /* A saved component, back through the same window. */
  /* Its section is folded until opened. */
  if (!(await page.locator(`[data-save-component="${button.id}"]`).count())) await page.getByRole("button", { name: /Save as a component/ }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  const save = page.locator(`[data-save-component="${button.id}"] [data-save-component-go]`).first();
  if (await save.count()) {
    await save.scrollIntoViewIfNeeded().catch(() => {});
    await save.click();
    await page.waitForTimeout(500);
    await openRemix();
    const saved = card.locator('[data-remix-source="saved"]');
    check(`${site}: a part saved as a component is offered under Saved components`, (await saved.count()) === 1);
    if (await saved.count()) {
      await saved.click();
      await page.waitForTimeout(300);
      const place = card.locator('[data-remix-row-kind="saved"] [data-remix-place]').first();
      const before3 = new Set((await s.doc()).nodes.map((n) => n.id));
      const d3 = await s.undoDepth();
      await place.click();
      await page.waitForTimeout(700);
      const added = (await s.doc()).nodes.filter((n) => !before3.has(n.id));
      check(`${site}: …placed whole, in one undo step`, added.length >= 1 && (await s.undoDepth()) === d3 + 1 && added.every((n) => n.remix), `${added.length} placed; depth ${d3} → ${await s.undoDepth()}`);
    }
  } else check(`${site}: the part panel offers Save as component`, false, "not found");
  check(`${site}: no page errors`, s.errors.length === 0, s.errors.slice(0, 2).join(" | "));
  await s.close();
}
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
