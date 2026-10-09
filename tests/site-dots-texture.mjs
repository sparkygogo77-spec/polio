#!/usr/bin/env node
/**
 * A SITE'S OWN DOTS ARE ITS PAGE TEXTURE; THE REFRESH CHOICES FIT.
 *
 * J (2026-10-09), PonsStars brought in: the Texture row said None while the
 * page was dotted (PST's own CSS draws the dots), Dots added a second set,
 * and with every layer deleted and the page set to None the dots stayed.
 * And the Refresh dialog, with "Reset to last bring-in" added, pushed a
 * button out of its footer.
 *
 *   1. PST's dot gradient reads as dots (colour, how solid, tile), is
 *      rewritten in place and taken off cleanly (`siteDots.ts`);
 *   2. on the saved PST board, the page pressed in the Colours preview shows
 *      Original (the site's own dots), and no layer list is left under Texture;
 *   3. its dials rewrite the site's own gradient; None takes it off the page
 *      part, one undo puts it back;
 *   4. Refresh: three choices, one row each, every one inside the dialog.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/site-dots-texture.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/look/lookparts/siteDots.ts, src/features/studio/PieceTexture.tsx, src/features/studio/look/LookPanel.tsx, src/features/studio/CodeSiteButtons.tsx, src/features/studio/bring-in/fromasite/FromASite.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { dropSiteDots, siteDotsOf, writeSiteDots } from "../src/features/studio/look/lookparts/siteDots.ts";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* 1. */
const PST = { background: "radial-gradient(rgba(26, 15, 11, 0.07) 15%, rgba(0, 0, 0, 0) 16%), none", backgroundOptions: ["18px 18px, auto", "0px 0px, 0% 0%", "repeat, repeat"] };
const d = siteDotsOf(PST);
check("1. PST's page gradient reads as dots", d?.index === 0 && d.colour === "#1a0f0b" && d.opacity === 0.07 && d.scale === 18 && d.stop === 15, JSON.stringify(d));
const w = writeSiteDots(PST, d, { opacity: 0.2, scale: 24 });
check("…rewritten in place", w.background === "radial-gradient(rgba(26, 15, 11, 0.2) 15%, rgba(0, 0, 0, 0) 16%), none" && w.backgroundOptions[0] === "24px 24px, auto", `${w.background} / ${w.backgroundOptions[0]}`);
check("…and taken off to none", dropSiteDots(PST, d).background === "none");
check("…a gradient that is not a dot pattern is not dots", siteDotsOf({ background: "radial-gradient(circle at 30% 25%, #fff, #f3d440 60%)", backgroundOptions: ["auto"] }) === null);

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());
await openBoard(ui, URL_BASE, "pst");
await ui.waitForTimeout(1000);
const app = () => ui.evaluate(() => window.__studioNodes().find((n) => n.pageId === "page_home" && n.hooks?.["data-hook"] === "app")?.art?.background ?? null);

/* 2. */
await ui.locator('[aria-label="Side panel"] button', { hasText: /^Look$/ }).first().click({ force: true });
await ui.locator("[data-look-texture]").first().waitFor({ timeout: 60000 }).catch(() => {});
await ui.locator("[data-theme-preview]").first().click({ position: { x: 4, y: 4 }, force: true });
await ui.waitForTimeout(500);
const row = ui.locator("[data-kind-texture]").first();
const pressed = () => row.locator("[data-texture-sample][aria-pressed=\"true\"]").getAttribute("data-texture-sample").catch(() => null);
/* Its own dots are its "Original" texture, not the builder's Dots (J, 2026-10-09; tests/original-texture.mjs). */
check("2. the page shows Original, the site's own dots", (await pressed()) === "original" && (await row.getAttribute("data-texture-site")) === "", `${await pressed()}`);
check("…and no list of layers is left under Texture", (await ui.locator("[data-texture-layers-open], [data-look-stack]").count()) === 0);

/* 3. */
const was = await app();
/* A press along the Scale track, as a hand does. */
await row.locator('[aria-label="Scale"]').first().scrollIntoViewIfNeeded();
const track = await row.locator('[aria-label="Scale"]').first().boundingBox();
await ui.mouse.click(track.x + track.width * 0.2, track.y + track.height / 2);
await ui.waitForTimeout(400);
const bigger = await app();
const size = await ui.evaluate(() => window.__studioNodes().find((n) => n.pageId === "page_home" && n.hooks?.["data-hook"] === "app")?.art?.backgroundOptions?.[0]);
check("3. Scale rewrites the site's own gradient", /^(\d+)px \1px, auto$/.test(size ?? "") && !size.startsWith("18px") && bigger === was, `${size}`);
await row.locator('[data-texture-sample="none"]').click();
await ui.waitForTimeout(500);
const gone = await app();
const after = await pressed();
check("…None takes the dots off the page", gone === "none" && after === "none", `${gone}, ${after} pressed, ${await ui.evaluate(() => window.__studioNodes().filter((n) => /radial-gradient\(rgba\(26, 15, 11/.test(n.art?.background ?? "")).map((n) => n.pageId).join())} still dotted`);
await ui.keyboard.press("Escape");
await ui.locator("[data-studio-pane]").first().focus().catch(() => {});
await ui.keyboard.press("Control+z");
await ui.waitForTimeout(600);
check("…one undo puts them back", (await app()) === was, `${await app()}`);

/* 4. */
await ui.keyboard.press("Escape");
await ui.locator("header [data-code-refresh]").first().click();
await ui.waitForTimeout(600);
const fit = await ui.evaluate(() => {
  const dlg = document.querySelector("[data-code-refresh-choices]")?.closest("[role=dialog]");
  if (!dlg) return null;
  const box = dlg.getBoundingClientRect();
  const rows = [...dlg.querySelectorAll("[data-code-refresh-choices] > button")].map((b) => b.getBoundingClientRect());
  const buttons = [...dlg.querySelectorAll("button")].map((b) => b.getBoundingClientRect());
  return { rows: rows.length, inside: buttons.every((r) => r.left >= box.left - 0.5 && r.right <= box.right + 0.5), stacked: rows.every((r, i) => i === 0 || r.top >= rows[i - 1].bottom - 0.5) };
});
check("4. Refresh: three choices, one row each, every button inside the dialog", fit?.rows === 3 && fit.inside && fit.stacked, JSON.stringify(fit));

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
