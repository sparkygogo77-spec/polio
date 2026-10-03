#!/usr/bin/env node
/**
 * REMIX ACROSS SITES: a part (with what is drawn inside it) taken from one
 * site's board and placed on another, restyled to the site it lands on,
 * with a switch to keep the look it had.
 *
 * Three boards in Builds, each opened in turn with the next one's parts on
 * offer (Trump & Morty takes from gotchi, Parasite from Trump & Morty,
 * gotchi from Parasite), and the most worn button of the other site is
 * placed:
 *
 *   · a part's wheel tray offers Bring from another site (the page's does
 *     too, where the bare page can be reached);
 *   · it lands as one undo step, with the parts inside it, its words its
 *     own, marked with where it came from;
 *   · every placed part wears exactly what remix.ts gives it for this site
 *     (the site's button style, else its colours and faces), read here on
 *     the same documents; where the site has a button style, it paints as
 *     the site's own buttons do;
 *   · Keep its original look, switched on in its panel: it wears the look
 *     it had on the other site, facet for facet, as one undo step;
 *   · the export paints it as the board does;
 *   · Undo takes it all off again.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/remix.mjs http://127.0.0.1:3013 <the capture folder>
 */
import { createJiti } from "jiti";
import { sinkRoot, siteDoc, launch, openSite, PAINT } from "./fixtures/look-sites.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const ROOT = sinkRoot(process.argv[3]);
const jiti = createJiti(import.meta.url);
const { lookOf, FACETS } = await jiti.import("../src/features/studio/partLook.ts");
const { kitsFromDoc } = await jiti.import("../src/features/studio/styleKits.ts");
const { componentOf, siteLookOf, remixParts } = await jiti.import("../src/features/studio/remix.ts");
const { kindKey } = await jiti.import("../src/features/studio/partKind.ts");

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);
const colours = (p) => p && { box: p.box && { bg: p.box.bg, border: p.box.border.replace(/^[\d.]+px /, "") }, words: p.words && { family: p.words.family, colour: p.words.colour } };
/* As the panel reads a board for its kits (DrawKits.tsx, kitDocOf). */
const kitDoc = (doc) => ({ nodes: doc.nodes, palette: doc.look?.palette ?? null, name: doc.brief?.name ?? null, host: doc.nodes.find((n) => n.from?.host)?.from?.host ?? null, keyframes: doc.look?.keyframes ?? null, behaviours: doc.behaviours ?? null });

const PAIRS = [["trumpmorty-fun", "gotchi-gg"], ["parasiteonsol-fun", "trumpmorty-fun"], ["gotchi-gg", "parasiteonsol-fun"]];
const browser = await launch();
for (const [site, from] of PAIRS) {
  console.log(`\n${site}, taking from ${from}`);
  const s = await openSite(browser, BASE, ROOT, site, { others: [from] });
  const { page } = s;
  const here = await s.doc();
  const src = siteDoc(ROOT, from);

  /* A part's wheel (a captured page leaves no bare page to right-click): its tray brings one too. */
  const anyPart = here.nodes.find((n) => n.pageId === here.activePageId && n.featureId === "cta-primary") ?? here.nodes.find((n) => n.pageId === here.activePageId);
  await s.pick(anyPart.id);
  const at = await page.evaluate((id) => { const r = document.querySelector(`[data-node-id="${id}"]`)?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; }, anyPart.id);
  if (at) await page.mouse.click(at.x, at.y, { button: "right" });
  await page.waitForTimeout(600);
  /* The tray is a tab under the wheel that opens into its row on hover. */
  await page.locator("[data-tray]").first().hover().catch(() => {});
  await page.waitForTimeout(400);
  const item = page.locator('[data-tray-item="remix"]').first();
  check(`${site}: a part's wheel offers Bring from another site`, (await item.count()) > 0);
  if (await item.count()) await item.click();
  await page.waitForTimeout(400);
  const card = page.locator("[data-remix-card]");
  check(`${site}: …which opens, offering ${from}`, (await card.count()) === 1 && (await card.locator(`[data-remix-site="${from}"]`).count()) === 1);
  if (!(await card.count())) { await s.close(); continue; }
  await card.locator(`[data-remix-site="${from}"]`).click();
  await page.waitForFunction(() => Number(document.querySelector("[data-remix-rows]")?.getAttribute("data-remix-rows") ?? 0) > 0, null, { timeout: 30000 }).catch(() => {});
  const row = card.locator("[data-remix-row]").first();
  const partId = await row.getAttribute("data-remix-row").catch(() => null);
  const part = src.nodes.find((n) => n.id === partId);
  check(`${site}: ${from}'s buttons are listed, one row a look`, !!part && kindKey(part) === "button", partId ?? "none");
  if (!part) { await s.close(); continue; }

  const depth0 = await s.undoDepth();
  await card.locator(`[data-remix-place="${partId}"]`).click();
  await page.waitForTimeout(800);
  const placed = await page.evaluate((from) => window.__studioPublishDoc().nodes.filter((n) => n.remix?.site === from), from);
  const comp = componentOf(src.nodes, part, true);
  check(`${site}: placed as one undo step, with the ${comp.length - 1} parts inside it`, (await s.undoDepth()) === depth0 + 1 && placed.length === comp.length, `${placed.length} placed of ${comp.length}; depth ${depth0} → ${await s.undoDepth()}`);
  const lead = placed.find((n) => n.remix.part === part.id);
  check(`${site}: …its words its own, marked as from ${from}`, !!lead && J(lead.content) === J(part.content) && lead.remix.kept === false);

  /* Exactly what remix.ts gives it for this site, part by part. */
  const look = siteLookOf(here.nodes, kitsFromDoc(kitDoc(here)));
  const want = remixParts(comp, { site: from }, look, false, { x: 0, y: 0 }, here.frameWidth ?? 1440);
  const off = want.filter((w) => { const got = placed.find((n) => n.remix.part === w.remix.part); return !got || J(lookOf(got).facets) !== J(lookOf(w).facets); });
  check(`${site}: every placed part wears what this site gives it`, off.length === 0, off.slice(0, 3).map((w) => w.remix.part).join(", "));
  const kit = look.kits.find((k) => k.role === "button");
  const paint = (id) => page.evaluate(PAINT, `[data-node-id="${id}"] [data-part-box]`);
  if (kit && lead) {
    const ownBtn = here.nodes.find((n) => kit.from.includes(n.id) && n.pageId === here.activePageId) ?? here.nodes.find((n) => kit.from.includes(n.id));
    const mine = await paint(lead.id), theirs = ownBtn ? await paint(ownBtn.id) : null;
    check(`${site}: …and with this site's button style, it paints as the site's own buttons do`, !!theirs && J(colours(mine)?.box) === J(colours(theirs)?.box), `${J(colours(mine))} against ${J(colours(theirs))} (${ownBtn?.id})`);
  }

  /* Export as the board. */
  if (lead) {
    const board = await paint(lead.id);
    const url = await s.served();
    const out = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    await out.goto(url, { waitUntil: "load" });
    await out.waitForTimeout(1200);
    const exp = await out.evaluate(PAINT, `#${lead.id} > *`);
    check(`${site}: the export paints it as the board does`, J(colours(exp)) === J(colours(board)), `${J(colours(exp))} against ${J(colours(board))}`);
    await out.close();
  }

  /* Keep its original look. */
  if (lead) {
    await s.pick(lead.id);
    const sw = page.locator("[data-remix-kept]").first();
    await sw.scrollIntoViewIfNeeded().catch(() => {});
    const d1 = await s.undoDepth();
    await sw.click();
    await page.waitForTimeout(500);
    const now = await s.node(lead.id);
    const theirLook = lookOf(part).facets, mineNow = lookOf(now).facets;
    const differ = FACETS.filter((f) => J(theirLook[f]) !== J(mineNow[f]));
    check(`${site}: Keep its original look: it wears the look it had on ${from}, facet for facet, in one step`, now.remix.kept === true && differ.length === 0 && (await s.undoDepth()) === d1 + 1, `${differ.join(", ")}; depth ${d1} → ${await s.undoDepth()}`);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(300);
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(500);
  check(`${site}: Undo takes it all off again`, (await page.evaluate(() => window.__studioPublishDoc().nodes.filter((n) => n.remix).length)) === 0);
  check(`${site}: no page errors`, s.errors.length === 0, s.errors.slice(0, 2).join(" | "));
  await s.close();
}
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
