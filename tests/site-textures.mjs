#!/usr/bin/env node
/**
 * A SITE'S OWN TEXTURES ARE OFFERED ON ANY PART, AND CAN BE SAVED.
 *
 * J (2026-10-10), on PonsStars' TV: the screen's grainy static "should be
 * considered an original texture", and "I should also be able to save
 * original textures". The bring-in keeps what the site's code painted on
 * every part; its textures (noise, repeating lines, tiled patterns) are now
 * listed in the Texture row as "From the site", wearable on any panel, and a
 * texture worn can be kept on a shelf saved in this browser.
 *
 *   P. pure: PST's static, scanlines and speaker lines are read as textures, the TV body's
 *      shading and icons are not; wearing one keeps a part's shading under it; the style
 *      layer sends it back as the same CSS;
 *   1. a panel kind's Texture row lists the site's textures, marked as from the site;
 *   2. picking Noise puts the TV static on every part of the kind, the preview draws it, one undo;
 *   3. Save keeps it in this browser, and the Saved shelf offers it, on the page too;
 *   4. None takes it off those parts again;
 *   5. removing it from Saved empties the shelf.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/site-textures.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/look/lookparts/siteTextures.ts, src/features/studio/PieceTexture.tsx, src/features/studio/SiteColours.tsx
 */
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { siteTexturesOf, wearTexture, wornTexture } from "../src/features/studio/look/lookparts/siteTextures.ts";
import { artCss } from "../src/features/studio/send-out/styleLayer.ts";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* P. */
const saved = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/boards/pst.json.gz", import.meta.url))).toString());
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs[0].value);
const parts = doc.components.flatMap((c) => c.nodes);
const found = siteTexturesOf(parts);
const by = (hook) => found.find((t) => t.from === hook);
check("P. the TV static is read as the site's Noise", by("chart-tv-static")?.name === "Noise", found.map((t) => `${t.name}<${t.from}`).join(", "));
check("…its scanlines and speaker grille are textures too", !!by("chart-tv-scanlines") && !!by("chart-tv-speaker"));
check("…the TV body's shading and icons are not", !by("chart-tv-body") && !found.some((t) => /data-hook/.test(decodeURIComponent(t.image))));
const body = parts.find((n) => n.source?.hook?.value === "chart-tv-body");
const worn = wearTexture(body.art, by("chart-tv-static"));
check("…worn, it goes on top and the part's shading stays under it", /^url\(/.test(worn.background) && worn.background.includes("linear-gradient(160deg") && wornTexture(worn)?.key === by("chart-tv-static").key, worn.backgroundOptions?.join(" | "));
check("…taken off, only the shading is left", wearTexture(worn, null).background === body.art.background);
const css = artCss({ art: worn });
check("…the style layer sends back the same CSS", css["background-image"] === worn.background && css["background-size"] === "180px 180px, auto", css["background-size"]);

/* The board. */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());
await openBoard(ui, URL_BASE, "pst");
await ui.waitForTimeout(1000);
await ui.evaluate(() => { try { localStorage.removeItem("builder.savedTextures"); } catch {} window.__studioSetLeftPanel?.("look"); });
await ui.waitForTimeout(1500);

const noisy = () => ui.evaluate(() => window.__studioNodes().filter((n) => /feTurbulence/.test(n.art?.background ?? "")).length);
const undo = () => ui.evaluate(() => window.__studioUndoDepth());
const surface = ui.locator('[data-theme-preview] [data-preview-part="surface"]').first();
const kind = await surface.getAttribute("data-preview-kind");
await surface.evaluate((e) => e.click());
await ui.waitForTimeout(600);
const editor = ui.locator("[data-kind-editor]").filter({ has: ui.locator("[data-kind-texture]") }).first();
const shelf = editor.locator('[data-texture-shelf="site"]');

/* 1. */
const names = await shelf.locator("[data-texture-sample]").evaluateAll((els) => els.map((e) => `${e.dataset.textureSample}/${e.dataset.textureFrom}`));
check("1. a panel's Texture row lists the site's own textures, marked from the site", names.includes("site:Noise/site") && names.some((n) => n.startsWith("site:Lines")), `kind ${kind}: ${names.join(" ")}`);

/* 2. */
const n0 = await noisy(), u0 = await undo();
await shelf.locator('[data-texture-sample="site:Noise"]').click();
await ui.waitForTimeout(800);
const n2 = await noisy();
check("2. Noise puts the TV static on every part of the kind", n2 > n0, `${n0} -> ${n2}`);
check("…its tile is the one on", (await shelf.locator('[data-texture-sample="site:Noise"]').getAttribute("aria-pressed")) === "true");
const drawn = await ui.locator(`[data-theme-preview] [data-preview-kind="${kind}"]`).first().evaluate((e) => getComputedStyle(e).backgroundImage);
check("…the preview draws it on that kind", /feTurbulence/.test(drawn), drawn.slice(0, 80));
check("…one undo step", (await undo()) === u0 + 1, `${u0} -> ${await undo()}`);

/* 3. */
await editor.locator("[data-texture-save]").click();
await ui.waitForTimeout(400);
const kept = await ui.evaluate(() => JSON.parse(localStorage.getItem("builder.savedTextures") ?? "[]").map((t) => t.name));
check("3. Save keeps it in this browser", kept.join() === "Noise", kept.join());
check("…the Saved shelf offers it", (await editor.locator('[data-texture-shelf="saved"] [data-texture-sample="saved:Noise"]').count()) === 1);
check("…and Save is gone for it", (await editor.locator("[data-texture-save]").count()) === 0);

/* 4. */
await editor.locator('[data-texture-sample="none"]').click();
await ui.waitForTimeout(800);
const n4 = await noisy();
check("4. None takes it off those parts again", n4 <= n0 && (await editor.locator('[data-texture-sample="none"]').getAttribute("aria-pressed")) === "true", `${n0} -> ${n2} -> ${n4}`);

/* The page's row has the saved shelf too. */
await ui.locator('[data-theme-preview] [data-preview-part="heading"]').first().evaluate((e) => e.click());
await ui.waitForTimeout(600);
check("…the page's Texture row offers the saved texture too", (await ui.locator('[data-kind-editor="The page"] [data-texture-shelf="saved"] [data-texture-sample="saved:Noise"]').count()) === 1);

/* 5. */
await ui.locator('[data-kind-editor="The page"] [data-texture-unsave="Noise"]').click();
await ui.waitForTimeout(400);
const left = await ui.evaluate(() => JSON.parse(localStorage.getItem("builder.savedTextures") ?? "[]").length);
check("5. removing it from Saved empties the shelf", left === 0 && (await ui.locator('[data-texture-shelf="saved"]').count()) === 0, String(left));

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
