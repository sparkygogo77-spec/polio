#!/usr/bin/env node
/**
 * THE GLOW ON THE WORDS IS THE SAME IN THE PREVIEW, ON THE BOARD AND ON THE SITE.
 *
 * J (2026-10-09), on PonsStars, Look > Colours > The page: the glow he gave
 * the page's words showed on the preview's heading but not on the board (only
 * one TV caption, hidden until the match ends, wore it); the Glow size slider
 * changed nothing in the preview; and "No glow" left a black glow, the
 * caption's hard 2px drop shadow taken for one.
 *
 *   1. a glow is a shadow that blurs; a hard drop shadow is not one;
 *   2. wearing a glow replaces every glow and keeps the drop shadow; none leaves only the drop shadow, or nothing;
 *   3. the preview draws a glow only when most of the words wear it, at the size they wear it;
 *   4. the style layer sends a glow taken off back as `text-shadow: none`;
 *   5. on the PST board: the page's glow colour reaches every word on the page, one undo step;
 *   6. Glow size moves the board's glow and the preview's together;
 *   7. No glow takes the glow off, leaves the caption's drop shadow, and no black glow is offered after;
 *      the preview loses it too, even after a Glow size drag let go where it began;
 *   8. a kind's glow (PonsStars' label badges) reaches its words and the preview, bright at 20px.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/page-glow.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/SiteColours.tsx, src/features/studio/themeKinds.ts, src/features/studio/look/siteColours.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { glowsIn, setGlow } from "../src/features/studio/look/siteColours.ts";
import { siteKinds } from "../src/features/studio/themeKinds.ts";
import { changedDeclarations } from "../src/features/studio/send-out/styleLayer.ts";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* 1–2. */
const TV = "rgba(160, 255, 90, 0.9) 0px 0px 6px, rgb(0, 0, 0) 2px 2px 0px";
check("1. a glow is a shadow that blurs", JSON.stringify(glowsIn(TV)) === JSON.stringify([{ colour: "rgba(160, 255, 90, 0.9)", blur: 6 }]), JSON.stringify(glowsIn(TV)));
check("…and a hard drop shadow is not one", glowsIn("rgb(0, 0, 0) 2px 2px 0px").length === 0 && glowsIn("rgb(0, 0, 0) 2px 2px").length === 0);
check("2. wearing a glow replaces the old one and keeps the drop shadow", setGlow(TV, "rgb(107, 37, 193)", 9) === "rgb(107, 37, 193) 0px 0px 2px, rgb(107, 37, 193) 0px 0px 5px, rgb(107, 37, 193) 0px 0px 9px, rgb(0, 0, 0) 2px 2px 0px", setGlow(TV, "rgb(107, 37, 193)", 9));
check("…drawn as neon is, tight rings under the full spread, so a wide glow stays bright (J, 2026-10-10)", setGlow(undefined, "rgb(107, 37, 193)", 6) === "rgb(107, 37, 193) 0px 0px 2px, rgb(107, 37, 193) 0px 0px 3px, rgb(107, 37, 193) 0px 0px 6px", setGlow(undefined, "rgb(107, 37, 193)", 6));

check("…no glow leaves only the drop shadow, or nothing", setGlow(TV, null, 6) === "rgb(0, 0, 0) 2px 2px 0px" && setGlow("red 0px 0px 4px", null, 6) === undefined);

/* 3. */
const ink = "rgb(17, 17, 17)";
const words = (id, textShadow) => ({ id, pageId: "p", featureId: "prose", x: 0, y: id.length * 40, w: 100, h: 20, colour: { text: ink }, ...(textShadow ? { art: { textShadow } } : {}) });
const few = siteKinds([words("a", TV), words("bb"), words("ccc"), words("dddd")], { bg: "rgb(253, 240, 220)" }).page;
check("3. one caption's glow is the page's glow to edit, but the preview does not draw it", few.glow === "rgba(160, 255, 90, 0.9)" && few.glowShown === false && few.glowSize === 6, JSON.stringify(few));
const most = siteKinds(["a", "bb", "ccc"].map((id) => words(id, "rgb(107, 37, 193) 0px 0px 11px")), { bg: "rgb(253, 240, 220)" }).page;
check("…worn by most of the words it is drawn, at their size", most.glowShown === true && most.glowSize === 11, JSON.stringify(most));
const hard = siteKinds([words("a", "rgb(0, 0, 0) 2px 2px 0px")], { bg: "rgb(253, 240, 220)" }).page;
check("…a drop shadow alone is no glow", hard.glow === null, JSON.stringify(hard));

const ringed = siteKinds(["a", "bb"].map((id) => words(id, setGlow(undefined, "rgb(255, 0, 0)", 20))), { bg: "rgb(253, 240, 220)" }).page;
check("…a ringed glow's size reads back as its full spread", ringed.glowSize === 20, JSON.stringify(ringed));

/* 4. */
const box = { w: 10, h: 10 };
const off = changedDeclarations({ box, art: { "text-shadow": TV } }, { box, art: {} }, { dx: 0, dy: 0 });
check("4. a glow taken off goes back to the site as text-shadow: none", off.includes("text-shadow: none"), off.join("; "));

/* 5–7. On the PST board. */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await openBoard(ui, URL_BASE, "pst");
await ui.waitForTimeout(1000);
await ui.evaluate(() => window.__studioSetLeftPanel?.("look"));
await ui.waitForTimeout(1500);
await ui.locator('[data-theme-preview] [data-preview-part="heading"]').first().evaluate((e) => e.click());
await ui.waitForTimeout(600);

/* The picker keeps how see-through the old glow was, so the purple may be written as oklch with its alpha. */
const PURPLE = /107, 37, 193|oklch\(0\.46\d* 0\.2\d* 29\d/;
const WORDS = "n_home_text_12", CAPTION = "n_home_text_175";
const shadowOn = (id) => ui.evaluate((id) => {
  const n = window.__studioNodes().find((x) => x.id === id);
  const el = document.querySelector(`[data-node-id="${id}"]`);
  const drawn = el ? [el, ...el.querySelectorAll("*")].map((e) => getComputedStyle(e).textShadow).find((s) => s && s !== "none") ?? "none" : "(not on the board)";
  return { saved: n?.art?.textShadow ?? null, drawn };
}, id);
const previewShadow = () => ui.evaluate(() => getComputedStyle(document.querySelector('[data-theme-preview] [data-preview-part="heading"]')).textShadow);

check("the page's editor offers its words' glow", (await ui.locator('[data-kind-editor="The page"] [data-kind-colour="glow"] input[type="color"]').count()) === 1);
const p0 = await previewShadow();
check("3. before: the preview draws no glow only one hidden caption wears", p0 === "none", p0);

/* 5. Purple, as J picked. */
const u0 = await ui.evaluate(() => window.__studioUndoDepth());
await ui.locator('[data-kind-editor="The page"] [data-kind-colour="glow"] input[type="color"]').evaluate((el) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "#6b25c1");
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
await ui.waitForTimeout(200);
await ui.locator('[data-kind-editor="The page"] [data-kind-colour="glow"] input[type="color"]').evaluate((el) => el.dispatchEvent(new Event("change", { bubbles: true })));
await ui.waitForTimeout(1200);
const w1 = await shadowOn(WORDS), c1 = await shadowOn(CAPTION), p1 = await previewShadow();
check("5. the page's words on the board wear the new glow", PURPLE.test(w1.drawn) && PURPLE.test(w1.saved ?? ""), JSON.stringify(w1));
check("…the caption too, its drop shadow kept", PURPLE.test(c1.saved ?? "") && /rgb\(0, 0, 0\) 2px 2px 0px/.test(c1.saved ?? ""), JSON.stringify(c1));
check("…and the preview draws the same glow", PURPLE.test(p1) && /6px/.test(p1), p1);
const u1 = await ui.evaluate(() => window.__studioUndoDepth());
check("…one undo step", u1 === u0 + 1, `${u0} -> ${u1}`);

/* 6. */
const thumb = ui.locator('[data-kind-editor="The page"] [data-kind-glow] [role="slider"]').first();
await thumb.focus();
for (let i = 0; i < 4; i++) await ui.keyboard.press("ArrowRight");
await ui.waitForTimeout(1200);
const w2 = await shadowOn(WORDS), p2 = await previewShadow();
check("6. Glow size spreads the board's glow, as see-through as it was", /10px/.test(w2.drawn) && PURPLE.test(w2.drawn) && /0\.9\)/.test(w2.saved ?? ""), JSON.stringify(w2));
check("…and the preview's with it", /10px/.test(p2), p2);

/* A drag that ends where it began (J, 2026-10-10: after No glow the preview kept its glow): the slider never
   commits, and the gesture it opened kept the side panel standing still, so the preview showed the glow gone from the board. */
const tb = await thumb.boundingBox();
await ui.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
await ui.mouse.down();
for (let i = 1; i <= 6; i++) await ui.mouse.move(tb.x + tb.width / 2 + i * 8, tb.y + tb.height / 2);
for (let i = 5; i >= 0; i--) await ui.mouse.move(tb.x + tb.width / 2 + i * 8, tb.y + tb.height / 2);
await ui.mouse.up();
await ui.waitForTimeout(600);

/* 7. */
await ui.locator('[data-kind-editor="The page"] [data-kind-glow-off]').click();
await ui.waitForTimeout(1200);
const w3 = await shadowOn(WORDS), c3 = await shadowOn(CAPTION), p3 = await previewShadow();
check("7. No glow takes it off the board's words: no shadow at all", w3.saved === null && w3.drawn === "none", JSON.stringify(w3));
check("…the caption keeps only its drop shadow", c3.saved === "rgb(0, 0, 0) 2px 2px 0px", JSON.stringify(c3));
check("…the preview draws none", p3 === "none", p3);
const after = await ui.evaluate(() => ({ glow: !!document.querySelector('[data-kind-editor="The page"] [data-kind-colour="glow"]'), add: !!document.querySelector('[data-kind-editor="The page"] [data-kind-glow-add]') }));
check("…and no black glow is offered in its place: Add a glow instead", !after.glow && after.add, JSON.stringify(after));
const u3 = await ui.evaluate(() => window.__studioUndoDepth());
await ui.evaluate(() => document.activeElement?.blur?.());
await ui.keyboard.press("Control+z");
await ui.waitForTimeout(800);
const w4 = await shadowOn(WORDS);
check("…one Undo brings the glow back", PURPLE.test(w4.saved ?? "") && /10px/.test(w4.saved ?? ""), `${u3} undo steps; ${JSON.stringify(w4)}`);

/* 8. A kind's words: PonsStars' label badges (Main fill), red at 20px (J, 2026-10-10: "glow for main fill badges don't work"). */
await ui.locator('[data-kind-editor] button', { hasText: /^Close$/ }).first().click();
await ui.locator('[data-theme-preview] [data-preview-part="tab"]').first().evaluate((e) => e.click());
await ui.waitForTimeout(600);
const kindPick = ui.locator('[data-kind-editor="Main fill"] [data-kind-colour="glow"] input[type="color"]');
check("8. the Main fill badges' editor offers their words' glow", (await kindPick.count()) === 1);
await kindPick.evaluate((el) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "#ff0000"); el.dispatchEvent(new Event("input", { bubbles: true })); });
await ui.waitForTimeout(200);
await kindPick.evaluate((el) => el.dispatchEvent(new Event("change", { bubbles: true })));
await ui.waitForTimeout(800);
await ui.locator('[data-kind-editor="Main fill"] [data-kind-glow] [role="slider"]').first().focus();
await ui.keyboard.press("End");
await ui.waitForTimeout(1200);
const RED = /oklch\(0\.62\d* 0\.25\d* 29/;
const badge = await shadowOn("n_home_text_85");
const tabGlow = await ui.evaluate(() => getComputedStyle(document.querySelector('[data-theme-preview] [data-preview-part="tab"]')).textShadow);
check("…the WALLET badge's words wear it on the board, in bright rings out to 20px", RED.test(badge.drawn) && /0px 0px 5px/.test(badge.drawn) && /0px 0px 20px/.test(badge.drawn), JSON.stringify(badge));
check("…and the preview's badge the same", RED.test(tabGlow) && /0px 0px 20px/.test(tabGlow), tabGlow);

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
