/**
 * A box carries its layout, its padding, its edge and how its words are set,
 * and the reflow keeps a laid-out box's children inside it.
 *
 * The ledger of his captured page: display 37, direction 37, align 33, pad
 * 29, gap 19, justify 15, border 13 — all "nowhere: a node has no layout
 * field". And at any device narrower than the 1763px frame the live page
 * stacked every part into a column, so a board that read as a page read as
 * a pile in Preview. Now a node has the four fields, the dispatcher puts
 * them round the part on every surface, and `placeNodes` keeps the parts a
 * laid-out box holds inside it.
 *
 * Measured on the board and in Preview at Tablet, off a page shaped like
 * his: a header that is a row with a logo and a button, a line of words set
 * centred and uppercase, a wrapping strip of three cards, and a foot.
 *   · on the board the header's box wears its padding, its edge and its
 *     flex layout, and the words wear their alignment and case;
 *   · a part that says nothing gets no box at all, so nothing already on a
 *     board moves;
 *   · at Tablet the logo and the button are still on the header's line,
 *     inside it; the cards wrap into lines inside the strip; the foot sits
 *     under the strip, not on it.
 *
 *   node tests/box-fields.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const FW = 1763;
const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const EDGE = "rgb(45, 55, 72)";
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("hdr", "box", "", 0, 0, FW, 82, {
      colour: { bg: "rgb(10, 14, 26)", surface: "rgb(10, 14, 26)" },
      layout: { display: "flex", direction: "row", align: "center", justify: "space-between", gap: 12 },
      pad: { top: 16, right: 24, bottom: 16, left: 24 },
      edge: { width: 1, style: "solid", colour: EDGE },
    }),
    node("logo", "prose", "SOLCINERATOR", 24, 21, 200, 40),
    node("cta", "cta-primary", "Connect wallet", 1539, 21, 200, 40),
    node("tag", "value-prop", "Burn it all", 24, 100, 1715, 60, { text: { align: "center", transform: "uppercase" } }),
    node("strip", "box", "", 0, 180, FW, 232, { layout: { display: "flex", direction: "row", wrap: true, gap: 16 }, pad: { top: 16, right: 24, bottom: 16, left: 24 } }),
    ...[0, 1, 2].map((i) => node(`card${i}`, "box", `Card ${i + 1}`, 24 + i * 572, 196, 556, 200, { colour: { bg: "rgb(20, 28, 48)", surface: "rgb(20, 28, 48)" }, edge: { width: 1, style: "solid", colour: "accent" } })),
    node("foot", "prose", "The foot of the page", 24, 440, 1715, 60),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "Capture", gimmick: "", master: "" },
  frameWidth: FW, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

/* ---------------------------------------------------------------- board */
const boxOf = (id) => page.evaluate((id) => {
  const el = document.querySelector(`[data-node-id="${id}"] [data-part-box]`);
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { display: cs.display, direction: cs.flexDirection, align: cs.alignItems, justify: cs.justifyContent, gap: cs.gap, padding: cs.padding, border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`, wrap: cs.flexWrap, textAlign: cs.textAlign, transform: cs.textTransform };
}, id);

const hdr = await boxOf("hdr");
check("the header's box is on the board, laid out as the row it said", !!hdr && hdr.display === "flex" && hdr.direction === "row" && hdr.align === "center" && hdr.justify === "space-between" && hdr.gap === "12px", JSON.stringify(hdr));
check("padded as it said", hdr?.padding === "16px 24px", hdr?.padding ?? "-");
check("and edged as it said", hdr?.border === `1px solid ${EDGE}`, hdr?.border ?? "-");
const painted = await page.evaluate(() => { const el = document.querySelector('[data-node-id="hdr"] [data-part="box"]'); return el ? getComputedStyle(el).backgroundColor : null; });
check("with the part's own colour inside the edge", painted === "rgb(10, 14, 26)", painted ?? "-");

const strip = await boxOf("strip");
check("a wrapping row says so on its box", !!strip && strip.display === "flex" && strip.wrap === "wrap" && strip.gap === "16px", JSON.stringify(strip));
const card = await boxOf("card0");
const accent = await page.evaluate(() => { const b = document.querySelector('[data-node-id="card0"] [data-part-box]'); return b ? getComputedStyle(b).borderTopColor : null; });
check("an edge may name a palette role, and is drawn in it", !!card && /^1px solid/.test(card.border) && accent && accent !== "rgba(0, 0, 0, 0)" && accent !== EDGE, `${card?.border ?? "-"}`);

const tag = await page.evaluate(() => {
  const box = document.querySelector('[data-node-id="tag"] [data-part-box]');
  if (!box) return null;
  const words = [...box.querySelectorAll("*")].find((e) => e.children.length === 0 && /Burn it all/i.test(e.textContent ?? ""));
  const cs = words ? getComputedStyle(words) : null;
  return { boxAlign: getComputedStyle(box).textAlign, boxCase: getComputedStyle(box).textTransform, wordsAlign: cs?.textAlign, wordsCase: cs?.textTransform, tag: words?.tagName };
});
check("the words' box carries their alignment and case", !!tag && tag.boxAlign === "center" && tag.boxCase === "uppercase", JSON.stringify(tag));
check("and the part sets its words that way: the element holding them is centred and uppercase", !!tag && tag.wordsAlign === "center" && tag.wordsCase === "uppercase", JSON.stringify(tag));

const none = await page.evaluate(() => ["logo", "cta", "foot"].map((id) => document.querySelectorAll(`[data-node-id="${id}"] [data-part-box]`).length));
check("a part that says nothing about its box gets no box: nothing already on a board moves", none.every((n) => n === 0), none.join(", "));

/* -------------------------------------------------------------- preview */
await page.keyboard.press("p");
await page.waitForTimeout(900);
const scroller = page.locator("[data-live-scroller]");
check("p flips the board to Preview", (await scroller.count()) === 1);
await scroller.click({ button: "right", position: { x: 40, y: 40 } });
await page.waitForTimeout(400);
await page.getByRole("menuitem", { name: "Device" }).hover();
await page.waitForTimeout(400);
await page.getByRole("menuitemcheckbox", { name: "Tablet" }).click();
await page.waitForTimeout(900);

const live = (id) => page.evaluate((id) => {
  const el = document.querySelector(`[data-live-node="${id}"]`);
  if (!el) return null;
  return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
}, id);
const H = await live("hdr"), L = await live("logo"), C = await live("cta");
check("at Tablet the header is full bleed, as before", !!H && H.x === 0 && H.w === 834 && H.y === 0, H ? `${H.x},${H.y} ${H.w}×${H.h}` : "not placed");
check("its logo and button are on its line, inside it, the button to the right — not queued under it in a pile", !!L && !!C && L.y === H.y + 21 && C.y === H.y + 21 && L.x >= H.x && C.x + C.w <= H.x + H.w + 1 && C.x > L.x + L.w, L && C ? `logo ${L.x},${L.y} ${L.w}×${L.h} · button ${C.x},${C.y} ${C.w}×${C.h}` : "not placed");
const liveEdge = await page.evaluate(() => { const b = document.querySelector('[data-live-node="hdr"] [data-part-box]'); return b ? `${getComputedStyle(b).borderTopWidth} ${getComputedStyle(b).borderTopStyle} ${getComputedStyle(b).borderTopColor}` : null; });
check("and the header wears its edge live too, so the board and the site agree", liveEdge === `1px solid ${EDGE}`, liveEdge ?? "-");

const S = await live("strip"), K = [await live("card0"), await live("card1"), await live("card2")], F = await live("foot");
check("the cards wrap into lines inside the strip", K.every(Boolean) && !!S && K[1].y > K[0].y && K[2].y > K[1].y && K.every((k) => k.x >= S.x && k.x + k.w <= S.x + S.w + 1 && k.y >= S.y && k.y + k.h <= S.y + S.h + 1), K.map((k) => k ? `${k.x},${k.y} ${k.w}×${k.h}` : "-").join(" · ") + (S ? ` in ${S.x},${S.y} ${S.w}×${S.h}` : ""));
check("the strip grew to hold them", !!S && S.h > 232, S ? `${S.h} tall` : "-");
check("and the foot sits under the strip, not on it", !!F && !!S && F.y >= S.y + S.h, F && S ? `foot at ${F.y}, strip ends ${S.y + S.h}` : "-");

await page.evaluate(() => localStorage.clear());
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
