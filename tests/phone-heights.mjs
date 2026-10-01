/**
 * At phone width a part that reflows its text gets the height it needs (inventory C11).
 *
 * Narrower than the board's width, rows reflow: every part stacks at the
 * device width, and every part kept its desktop height. A picture keeps its
 * aspect, which is right. A text part narrowed from 1200 to 366 px needs
 * about three times the lines, and was clipped by its own fill at the height
 * it had on the desktop. And full width was an exact test, the frame less
 * one, so a header drawn at 1400 of 1440 got gutters on a phone. Now:
 *
 *   · a text part narrowed by some factor grows in height by that factor,
 *     bounded, so what it says is not cut off;
 *   · a part as wide as the frame is (nine tenths, the reshape rule) is
 *     full bleed at the phone width.
 *
 * Read off the board's own Preview at Phone, the way a person flips it.
 *
 *   node tests/phone-heights.mjs [url]      # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();
const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The header's id, off the catalogue's own source. */
const HEADER = (readFileSync("src/features/studio/parts/index.ts", "utf8").match(/component: Header, ids: \["([\w-]+)"/) ?? [])[1] ?? "header";
const WORDS = "The quick brown fox jumps over the lazy dog and keeps going across the whole of the page, sentence after sentence, so that at a third of the width it needs three times the lines it needed on the desktop, and a part that kept its desktop height would cut it off after the first few.";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear());
await page.evaluate(({ header, words }) => {
  const base = (id, featureId, x, y, w, h, content) => ({ id, pageId: "page_home", featureId, label: featureId, prompt: "", content, x, y, w, h, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, data: "", colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "out", shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null });
  const doc = JSON.parse(localStorage.getItem("builder.studio") || "{}");
  const st = doc.state ?? {};
  const pageId = st.activePageId ?? st.pages?.[0]?.id ?? "page_home";
  st.nodes = [
    { ...base("n_head", header, 0, 0, 1400, 76, "Home, Work, About, Contact"), pageId },
    { ...base("n_text", "prose", 120, 140, 1200, 80, words), pageId },
  ];
  st.selection = [];
  doc.state = st;
  localStorage.setItem("builder.studio", JSON.stringify(doc));
}, { header: HEADER, words: WORDS });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

await page.keyboard.press("p");
await page.waitForTimeout(900);
const scroller = page.locator("[data-live-scroller]");
check("p flips the board to Preview", (await scroller.count()) === 1);
const box = async (id) => page.locator(`[data-live-node="${id}"]`).first().boundingBox();
const desk = await box("n_text");
/* The drawn height is a minimum, not a height: a part grows past it when its
   words need the room (`parts/primitives.tsx`), so on the desktop it is the
   drawn width, at least the drawn height, and nothing is cut off. */
const deskClip = await page.locator('[data-live-node="n_text"] [data-part]').first().evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight })).catch(() => null);
check("on the desktop the text part is the width it was drawn, at least its height, words whole", !!desk && Math.round(desk.width) === 1200 && Math.round(desk.height) >= 80 && !!deskClip && deskClip.scroll <= deskClip.client + 2, desk ? `${Math.round(desk.width)} × ${Math.round(desk.height)}, content ${deskClip?.scroll} in ${deskClip?.client}` : "not placed");

await scroller.click({ button: "right", position: { x: 40, y: 40 } });
await page.waitForTimeout(400);
await page.getByRole("menuitem", { name: "Device" }).hover();
await page.waitForTimeout(400);
await page.getByRole("menuitemcheckbox", { name: "Phone" }).click();
await page.waitForTimeout(900);

const head = await box("n_head");
check("a header at nine tenths of the frame or more is full bleed at the phone width", !!head && Math.round(head.width) === 390, head ? `${Math.round(head.width)} wide` : "not placed");
const text = await box("n_text");
const clipped = await page.locator('[data-live-node="n_text"] [data-part]').first().evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
const factor = text ? 1200 / text.width : 0;
check("the text part is narrowed to the phone", !!text && text.width <= 390, text ? `${Math.round(text.width)} wide, ${factor.toFixed(2)}× narrower` : "not placed");
/* The phone's page flows (docs/RESPONSIVE.md): a part is as tall as its words need, measured, not its desktop height times a guess. */
check("and grew in height to hold its words, none cut off", !!text && text.height > 80 && clipped.scroll <= clipped.client + 2, `${Math.round(text?.height ?? 0)} tall (was 80), content ${clipped.scroll} in ${clipped.client}`);

await page.evaluate(() => localStorage.clear());
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
