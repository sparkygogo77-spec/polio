#!/usr/bin/env node
/**
 * THE PREVIEW DRAWS THE PAGE'S TEXTURE, AND "ORIGINAL" IS THE SITE'S OWN.
 *
 * J (2026-10-09), on PonsStars: its page's dots, made by its own code, were on
 * the board and the site but not in the Colours preview, though the Texture
 * row said Dots; taking them off and picking Dots again made the builder's
 * dots, which did not show in the preview either. "There should be a texture
 * option as Original, which is what the code chat created, since it's
 * different from the builder's version."
 *
 *   1. brought in, the page's Texture row has Original first after None, and it is the one on;
 *   2. the preview's page draws the site's own dots, as the board does;
 *   3. Dots is the builder's: picked, it replaces the site's dots on the board, and the preview draws it;
 *   4. Original puts the code's dots back as they were and the builder's layer goes, one undo step;
 *   5. None takes it off: the preview is plain again.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/original-texture.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/PieceTexture.tsx, src/features/studio/SiteColours.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());
await openBoard(ui, URL_BASE, "pst");
await ui.waitForTimeout(1000);
await ui.evaluate(() => window.__studioSetLeftPanel?.("look"));
await ui.waitForTimeout(1500);
await ui.locator('[data-theme-preview] [data-preview-part="heading"]').first().evaluate((e) => e.click());
await ui.waitForTimeout(600);

const SITE_DOTS = /radial-gradient\(rgba\(26, 15, 11, 0\.07\) 15%/;
const row = ui.locator('[data-kind-editor="The page"] [data-kind-texture]').first();
const order = () => row.locator("[data-texture-sample]").evaluateAll((els) => els.map((e) => e.dataset.textureSample));
const pressed = () => row.locator('[data-texture-sample][aria-pressed="true"]').evaluateAll((els) => els.map((e) => e.dataset.textureSample).join());
const app = () => ui.evaluate(() => window.__studioNodes().find((n) => n.pageId === "page_home" && n.hooks?.["data-hook"] === "app")?.art?.background ?? null);
const preview = () => ui.evaluate(() => getComputedStyle(document.querySelector("[data-theme-preview]")).backgroundImage);
const undo = () => ui.evaluate(() => window.__studioUndoDepth());

/* 1. */
const o1 = await order();
check("1. the page's Texture row offers Original first after None", o1[0] === "none" && o1[1] === "original", o1.join(" "));
check("…and it is the one on, not the builder's Dots", (await pressed()) === "original", await pressed());

/* 2. */
const p1 = await preview();
check("2. the preview's page draws the site's own dots", SITE_DOTS.test(p1), p1.slice(0, 120));

/* 3. */
const u0 = await undo();
await row.locator('[data-texture-sample="dots"]').click();
await ui.waitForTimeout(800);
const a3 = await app(), p3 = await preview();
check("3. Dots is the builder's: picked, the site's dots come off the page part", !SITE_DOTS.test(a3 ?? ""), String(a3));
check("…it is on, Original is not", (await pressed()) === "dots", await pressed());
check("…and the preview draws the builder's dots", p3 !== "none" && /gradient|url\(/.test(p3) && !SITE_DOTS.test(p3), p3.slice(0, 120));
check("…one undo step", (await undo()) === u0 + 1, `${u0} -> ${await undo()}`);

/* 4. */
await row.locator('[data-texture-sample="original"]').click();
await ui.waitForTimeout(800);
const a4 = await app(), p4 = await preview();
check("4. Original puts the code's dots back as they were", a4 === "radial-gradient(rgba(26, 15, 11, 0.07) 15%, rgba(0, 0, 0, 0) 16%), none", String(a4));
check("…the builder's layer goes", (await pressed()) === "original" && SITE_DOTS.test(p4), `${await pressed()}; ${p4.slice(0, 80)}`);
check("…one undo step", (await undo()) === u0 + 2, `${u0} -> ${await undo()}`);

/* 5. */
await row.locator('[data-texture-sample="none"]').click();
await ui.waitForTimeout(800);
check("5. None takes it off: the preview is plain", (await preview()) === "none" && (await app()) === "none", `${await preview()} / ${await app()}`);
check("…Original stays offered to bring it back", (await order()).includes("original"));

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
