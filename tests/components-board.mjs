#!/usr/bin/env node
/**
 * A BUTTON IS ONE THING ON THE BOARD: PICKED, MOVED, RESIZED AND RECOLOURED WHOLE.
 *
 * On sink's trumpmorty.fun, BUY $TRORTY is a box (fill, border, shadow, link,
 * hover), a gloss over it, its words, and the drips under it, stacked in
 * capture order. Held here through the real board and panels:
 *
 *   · a press on its words picks the button, and its part panel shows the
 *     button's options as one set (fill, words, outline, shadow, lighting
 *     bar, where it leads, under the hand, motion) with its layers listed;
 *   · the Element tab's flat list shows it as one row ("Button: BUY
 *     $TRORTY", "5 layers"), none of its layers a row of its own, and a
 *     press on that row picks the button; under "Show nesting" the tree
 *     shows it as one group, its layers folded inside, each named for its
 *     job when opened;
 *   · a drag moves every layer by the same distance; a resize keeps every
 *     layer in its place and share on the button;
 *   · recolouring the fill changes the box and not the words; recolouring the
 *     words changes the words and not the box;
 *   · a layer can still be opened and edited alone;
 *   · the Look tab's colours count it as one button;
 *   · and once every edit is undone, the published page is the same, byte
 *     for byte and pixel for pixel, as before anything was touched:
 *     recognising components writes nothing to the document.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/components-board.mjs http://127.0.0.1:3013
 */
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, statSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { board, checker, J } from "./fixtures/draw-board.mjs";

const { check, done } = checker();
const b = await board(process.argv[2] ?? "http://127.0.0.1:3013", { viewport: { width: 1500, height: 1000 } });
const p = b.page;
await b.load();
const wait = (ms) => p.waitForTimeout(ms);
const nodes = async () => (await b.nodes());
const by = async () => new Map((await nodes()).map((n) => [n.id, n]));
const selection = () => p.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.selection ?? []);
const liveSel = () => p.evaluate(() => window.__studioPublishDoc && window.__studioSelection ? window.__studioSelection() : null);
await p.evaluate(() => window.__studioSetLeftPanel?.("inspector"));
await p.evaluate(() => window.__studioSetLibrary?.(true));
await wait(500);

/* The export as it stands before anything is touched. */
const exportOf = async () => p.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
const htmlOf = (files) => (files ?? []).filter((f) => typeof f.content === "string").map((f) => `${f.path}\n${f.content}`).join("\n");
const before = await exportOf();
const startNodes = J((await nodes()).map((n) => [n.id, n.x, n.y, n.w, n.h, n.colour, n.edge]));

/* The button: the box whose words are BUY $TRORTY, found by what it is, not by id. */
const all0 = await nodes();
const words = all0.find((n) => typeof n.content === "string" && n.content.trim() === "BUY $TRORTY") ?? all0.find((n) => JSON.stringify(n.content).includes("BUY $TRORTY") && n.featureId !== "box");
const host = all0.filter((n) => n.featureId === "box" && /BUY \$TRORTY/.test(n.label) && n.x <= words.x && n.y <= words.y && n.x + n.w >= words.x + words.w && n.y + n.h >= words.y + words.h).sort((a, b2) => a.w * a.h - b2.w * b2.h)[0];
check("the board has BUY $TRORTY: a box and its words", !!host && !!words, `${host?.id} ${words?.id}`);

/* ------------------------------------------------------------ a press on the words picks the button */
const el = p.locator(`[data-node-id="${words.id}"]`).first();
await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
await wait(400);
let wb = await el.boundingBox();
await p.keyboard.press("v");
await p.mouse.click(wb.x + wb.width / 2, wb.y + wb.height / 2);
await wait(700);
check("a press on its words picks the whole button", (await p.locator(`[data-part-panel="${host.id}"]`).count()) === 1);
const panel = p.locator(`[data-part-panel="${host.id}"]`);
check("its part panel shows the button's options as one set", (await panel.locator('[data-component-fields="button"]').count()) === 1
  && (await panel.locator('[data-component-slot="fill"]').count()) === 1 && (await panel.locator('[data-component-slot="words"]').count()) === 1
  && (await panel.locator('[data-component-slot="outline"]').count()) === 1 && (await panel.locator('[data-component-slot="shadow"]').count()) === 1
  && (await panel.locator('[data-component-slot="lighting"]').count()) === 1);
check("…where it leads and what it does under the hand", /Leads to/.test(await panel.locator("[data-component-link]").innerText()) && /Under the hand/.test(await panel.locator("[data-component-hover]").innerText()), await panel.locator("[data-component-hover]").innerText());
const layerIds = await panel.locator("[data-component-layer]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-component-layer"), e.getAttribute("data-layer-role")]));
check("…and its layers listed by job", layerIds.some(([id, r]) => id === words.id && r === "words") && layerIds.some(([, r]) => r === "lighting"), J(layerIds));

/* ------------------------------------------------------------ the flat list: one row */
await p.locator("[data-back-to-tree]").first().click();
await wait(600);
const nesting = p.locator("[data-show-nesting]").first();
if ((await nesting.getAttribute("aria-checked")) === "true") { await nesting.click(); await wait(400); }
const listRow = p.locator(`[data-list-row="${host.id}"]`);
check("the flat list shows it as one row with its layers counted", (await listRow.count()) === 1 && (await listRow.getAttribute("data-list-component")) === "button" && /layers?/.test(await listRow.locator("[data-list-layers]").innerText()), await listRow.innerText().catch(() => "no row"));
check("…named for what it is", /^Button: BUY \$TRORTY/.test(await listRow.locator("[data-list-name]").innerText()), await listRow.locator("[data-list-name]").innerText().catch(() => ""));
const rowsHolding = await p.locator("[data-list-row]").evaluateAll((els, ids) => els.filter((e) => (e.getAttribute("data-list-ids") ?? "").split(" ").some((id) => ids.includes(id))).map((e) => e.getAttribute("data-list-row")), [host.id, ...layerIds.map(([id]) => id)]);
check("…and none of its layers is a row of its own", rowsHolding.length === 1 && rowsHolding[0] === host.id, J(rowsHolding));
await listRow.locator("[data-element-row]").click();
await wait(600);
check("a press on that row picks the button, with its options as one set", (await p.locator(`[data-part-panel="${host.id}"] [data-component-fields="button"]`).count()) === 1);
await p.locator("[data-back-to-tree]").first().click();
await wait(600);

/* ------------------------------------------------------------ under Show nesting: one group, layers folded */
await p.locator("[data-show-nesting]").first().click();
await wait(500);
const row = p.locator(`[data-tree-row="${host.id}"]`);
check("under Show nesting it is one group with its layers counted", (await row.locator('[data-tree-component="button"]').count()) === 1, await row.innerText().catch(() => "no row"));
const open = await row.locator("[data-tree-toggle]").getAttribute("aria-expanded").catch(() => null);
if (open === "true") { await row.locator("[data-tree-toggle]").click(); await wait(200); }
check("…its layers folded inside it", (await p.locator(`[data-tree-row="${words.id}"]`).count()) === 0);
await row.locator("[data-tree-toggle]").click();
await wait(300);
check("…and opened, each named for its job", (await p.locator(`[data-tree-row="${words.id}"] [data-tree-layer="words"]`).count()) === 1 && /^Words:/.test(await p.locator(`[data-tree-row="${words.id}"] [data-tree-name]`).innerText()));
/* Back to the flat list, as the owner leaves it. */
await p.locator("[data-show-nesting]").first().click();
await wait(300);

/* ------------------------------------------------------------ a drag moves every layer */
const parts = [host.id, ...layerIds.map(([id]) => id)];
const at0 = await by();
await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
await wait(300);
wb = await el.boundingBox();
await p.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2);
await p.mouse.down();
await p.mouse.move(wb.x + wb.width / 2 + 60, wb.y + wb.height / 2 + 40, { steps: 8 });
await p.mouse.up();
await wait(600);
const at1 = await by();
const deltas = parts.map((id) => [Math.round(at1.get(id).x - at0.get(id).x), Math.round(at1.get(id).y - at0.get(id).y)]);
check("a drag moves every layer by the same distance", deltas.every((d) => d[0] === deltas[0][0] && d[1] === deltas[0][1]) && (deltas[0][0] !== 0 || deltas[0][1] !== 0), J(deltas));

/* ------------------------------------------------------------ a resize keeps every layer on it */
const handle = p.locator(`[data-node-id="${host.id}"] [data-resize="se"]`).first();
if (!(await handle.count())) { const hb = await p.locator(`[data-node-id="${host.id}"]`).first().boundingBox(); await p.mouse.click(hb.x + 6, hb.y + 6); await wait(300); }
const hb2 = await p.locator(`[data-node-id="${host.id}"] [data-resize="se"]`).first().boundingBox();
const rel = (m, h) => [(m.x - h.x) / h.w, (m.y - h.y) / h.h, m.w / h.w];
const r0 = new Map(parts.map((id) => [id, rel(at1.get(id), at1.get(host.id))]));
await p.mouse.move(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2);
await p.mouse.down();
await p.mouse.move(hb2.x + hb2.width / 2 + 70, hb2.y + hb2.height / 2 + 30, { steps: 8 });
await p.mouse.up();
await wait(600);
const at2 = await by();
const h2 = at2.get(host.id);
const drift = parts.filter((id) => id !== host.id).map((id) => { const a = r0.get(id), c = rel(at2.get(id), h2); return Math.max(...a.map((v, i) => Math.abs(v - c[i]))); });
check("a resize keeps every layer in its place and share on the button", h2.w > at1.get(host.id).w + 20 && drift.every((d) => d < 0.03), J({ w: [at1.get(host.id).w, h2.w], drift: drift.map((d) => +d.toFixed(3)) }));

/* ------------------------------------------------------------ recolour hits the right layer */
/* Picked afresh, so its panel shows (the tree was shown last). */
await p.keyboard.press("Escape");
await p.keyboard.press("Escape");
await wait(300);
{ const wb2 = await el.boundingBox(); await p.mouse.click(wb2.x + wb2.width / 2, wb2.y + wb2.height / 2); await wait(700); }
const fillChip = panel.locator('[data-component-slot="fill"] [data-component-colour]').nth(2);
const fillTo = await fillChip.getAttribute("data-component-colour");
const w0 = (await by()).get(words.id).colour?.text ?? null;
await fillChip.click();
await wait(400);
let now = await by();
check("recolour the fill: the box changes, the words do not", now.get(host.id).colour?.bg === fillTo && (now.get(words.id).colour?.text ?? null) === w0, J({ bg: now.get(host.id).colour?.bg, to: fillTo, words: now.get(words.id).colour }));
const wordsChip = panel.locator('[data-component-slot="words"] [data-component-colour]').nth(1);
const wordsTo = await wordsChip.getAttribute("data-component-colour");
await wordsChip.click();
await wait(400);
now = await by();
check("recolour the words: the words change, the box does not", now.get(words.id).colour?.text === wordsTo && now.get(host.id).colour?.bg === fillTo, J({ words: now.get(words.id).colour?.text, to: wordsTo }));

/* ------------------------------------------------------------ one layer, alone */
await panel.locator(`[data-component-layer="${words.id}"]`).click();
await wait(500);
check("a layer can be opened alone, and says whose it is", (await p.locator(`[data-part-panel="${words.id}"]`).count()) === 1 && (await p.locator(`[data-part-panel="${words.id}"] [data-layer-of="${host.id}"]`).count()) === 1);

/* ------------------------------------------------------------ colours count it once */
await p.evaluate(() => window.__studioSetLeftPanel?.("look"));
await wait(800);
const says = await p.locator("[data-role-says], [data-look-panel] span").evaluateAll((els) => els.map((e) => e.textContent).filter((t) => /buttons: \d+ button/.test(t ?? "")));
check("the Look tab's colours count buttons as buttons", says.length > 0, J(says.slice(0, 3)));

/* ------------------------------------------------------------ undone, the export is what it was */
await p.evaluate(() => window.__studioSetLeftPanel?.("inspector"));
await p.keyboard.press("Escape");
for (let i = 0; i < 6 && J((await nodes()).map((n) => [n.id, n.x, n.y, n.w, n.h, n.colour, n.edge])) !== startNodes; i++) {
  await p.locator("[data-history-undo]").click().catch(() => {});
  await wait(350);
}
check("every edit undone, the board is as it was", J((await nodes()).map((n) => [n.id, n.x, n.y, n.w, n.h, n.colour, n.edge])) === startNodes);
const after = await exportOf();
check("the published page is the same, byte for byte", htmlOf(after) === htmlOf(before) && htmlOf(before).length > 1000, `${htmlOf(before).length} vs ${htmlOf(after).length}`);
check("…and carries nothing of the grouping", !/data-component|data-tree-component|components\.ts/.test(htmlOf(after)));
const shot = async (files) => {
  const out = mkdtempSync(join(tmpdir(), "components-board-"));
  for (const f of files ?? []) { mkdirSync(dirname(join(out, f.path)), { recursive: true }); writeFileSync(join(out, f.path), f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
  const types = { html: "text/html", css: "text/css", js: "text/javascript", png: "image/png", webp: "image/webp", jpg: "image/jpeg", svg: "image/svg+xml", woff2: "font/woff2" };
  const server = http.createServer((req, res) => {
    let f = join(out, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, ""));
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[f.split(".").pop()] ?? "application/octet-stream" });
    res.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const site = await b.browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await site.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
  await site.waitForTimeout(1500);
  const png = await site.screenshot({ fullPage: true, animations: "disabled" });
  await site.close();
  server.close();
  return png;
};
const [s0, s1] = [await shot(before), await shot(after)];
check("…and pixel for pixel", Buffer.compare(s0, s1) === 0, `${s0.length} vs ${s1.length} bytes`);

check("no page errors", b.errors.length === 0, J(b.errors.slice(0, 3)));
void selection; void liveSel;
await b.browser.close();
done();
