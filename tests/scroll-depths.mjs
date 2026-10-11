#!/usr/bin/env node
/**
 * A STRIP OF DEPTHS SHOWS THE BAND FOR WHERE THE SCROLL IS.
 *
 * sunkcoin.fun (J, 2026-10-11): "the scrollbar on the right is a static
 * image in the preview instead of a live scroll bar that shows you the depth
 * of the site", and the sea "ceases just below the first page and becomes a
 * static view". The capturer now reads a canvas pinned to the window at
 * every depth of the page and the converter lays the stills in one strip
 * (`picture.depths`, capture/site/capture/check-depths.mjs). Here, the
 * Builder's side of it:
 *
 *   1. The hand-over (`captured.ts`) gives a part whose picture is a strip
 *      the "Follows the scroll" feature, with the strip's band count.
 *   2. The feature's script, in the kit's own file (vendor/builder-motion.js,
 *      what a published page runs): on a plain page, scrolled to the foot,
 *      the strip has slid up by all but one band; half way, by half.
 *   3. The Preview, on a seeded page with such a layer fixed under it: as
 *      the page opens the top band shows, scrolled to the foot the last.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/scroll-depths.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/shelf/library/behaviourScripts/effects.ts, src/features/studio/shelf/library/captured.ts, src/features/studio/shelf/parts/primitives.tsx, src/features/studio/send-out/kitMotion.ts, kit/starter/vendor/builder-motion.js
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { boardWith, captured, openPreview, part } from "./lib/seeded.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const L = join(here, "..", "src", "features", "studio", "shelf", "library");
const { attachCaptured } = await jiti.import(join(L, "captured.ts"));
const { usesOf } = await jiti.import(join(L, "works.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* The strip: three bands, 1440 × 900 each, blue then green then red, as an svg the picture store can hold. */
const BANDS = ["#1b4fd8", "#2aa84a", "#d8321b"];
const STRIP = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="2700" viewBox="0 0 1440 2700">${BANDS.map((c, i) => `<rect x="0" y="${i * 900}" width="1440" height="900" fill="${c}"/>`).join("")}</svg>`;
const pic = { id: "pic_depths", path: "assets/pictures/pic_depths.svg", type: "image/svg+xml", w: 1440, h: 2700, bytes: STRIP.length, alt: "", from: "upload", depths: { bands: 3, band: 900, at: [0, 1050, 2100] } };

/* 1. */
const sea = part("n_sea", 0, 0, 1440, 900, { featureId: "picture", picture: pic, ...captured("body > canvas", "fixed") });
const given = attachCaptured([structuredClone(sea), part("n_plain", 0, 1000, 600, 200, captured("body > section"))], { version: 1 });
const use = usesOf(given[0].work).find((u) => u.id === "scroll-depths");
check("1. The hand-over gives a part whose picture is a strip of depths the Follows-the-scroll feature, with its 3 bands", !!use && use.inputs.bands === "3", JSON.stringify(given[0].work));
check("…and nothing to a part with a plain picture or none", !usesOf(given[1].work).some((u) => u.id === "scroll-depths"), JSON.stringify(given[1].work));
const second = attachCaptured([structuredClone(sea)], null);
check("…even when the capture brought no behaviours record at all", usesOf(second[0].work).some((u) => u.id === "scroll-depths"), JSON.stringify(second[0].work));

const kit = readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8");
check("2. The kit's motion file carries the feature", /siteFeatures\.define\("scroll-depths"/.test(kit));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  /* 2. A published page's shape: the part's element holds the strip's holder and the strip; the kit's file runs the feature named on it. */
  const p = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  const strip = `data:image/svg+xml;utf8,${encodeURIComponent(STRIP.replace(/1440/g, "1000").replace(/2700/g, "1800").replace(/900/g, "600"))}`;
  await p.setContent(`<!doctype html><html><head><style>:root{} [data-hook="sea"]{--builder-motion:"scroll-depths?bands=3"} body{margin:0;height:3000px}</style></head>
    <body data-hook="page"><div data-hook="sea" style="position:fixed;inset:0;width:1000px;height:600px"><div data-picture-depths="3" style="width:100%;height:100%;overflow:hidden;position:relative"><img data-depth-strip="" src="${strip}" style="width:100%;height:auto;display:block"></div></div>
    <script>${kit.replace(/<\/script/g, "<\\/script")}</script></body></html>`);
  await p.waitForTimeout(400);
  const read = () => p.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const img = document.querySelector("[data-depth-strip]");
    return { band: img.closest("[data-hook]").getAttribute("data-depth"), translate: getComputedStyle(img).translate, tall: img.getBoundingClientRect().height };
  });
  const top = await read();
  check("…on a published page, as it opens, the top band shows (no slide)", top.band === "0" && /^(none|0px(\s0px)?)$/.test(top.translate), JSON.stringify(top));
  await p.evaluate(() => scrollTo(0, 1200));
  const mid = await read();
  check("…half way down, the strip has slid up one band (of three)", mid.band === "1" && /-600px/.test(mid.translate), JSON.stringify(mid));
  await p.evaluate(() => scrollTo(0, 2400));
  const foot = await read();
  check("…at the foot, by two: the last band shows", foot.band === "2" && /-1200px/.test(foot.translate), JSON.stringify(foot));
  await p.close();

  /* 3. */
  const parts = [
    { ...sea, work: { id: "scroll-depths", inputs: { bands: "3" } } },
    part("n_s1", 120, 100, 1200, 700, { ...captured("body > section:nth-of-type(1)"), colour: { bg: "rgba(255,255,255,0.3)" } }),
    part("n_s2", 120, 1100, 1200, 700, { ...captured("body > section:nth-of-type(2)"), colour: { bg: "rgba(255,255,255,0.3)" } }),
    part("n_s3", 120, 2100, 1200, 800, { ...captured("body > section:nth-of-type(3)"), colour: { bg: "rgba(255,255,255,0.3)" } }),
  ];
  const board = boardWith(parts, { pictures: [{ id: pic.id, type: pic.type, bytes: STRIP }] });
  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, board);
  await openPreview(ui, URL_BASE);
  const seen = await ui.evaluate(async () => {
    const el = document.querySelector('[data-live-node="n_sea"]');
    const img = el?.querySelector("[data-depth-strip]");
    const scroller = el?.closest("[data-live-scroller]");
    if (!img || !scroller) return { found: false, el: !!el, img: !!img, scroller: !!scroller };
    const out = [];
    const max = scroller.scrollHeight - scroller.clientHeight;
    for (const to of [0, max, 0]) {
      scroller.scrollTop = to;
      await new Promise((r) => setTimeout(r, 120));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const r = img.getBoundingClientRect(), s = scroller.getBoundingClientRect();
      out.push({ to, band: el.getAttribute("data-depth"), slid: Math.round(s.top - r.top), tall: Math.round(r.height / 3), pos: getComputedStyle(el).position });
    }
    return { found: true, max, out };
  });
  check("3. The Preview draws the layer's strip, fixed under the page", seen.found === true && seen.max > 1500 && seen.out.every((o) => o.pos === "fixed"), JSON.stringify(seen));
  check("…as the page opens the top band shows", seen.out?.[0]?.band === "0" && seen.out[0].slid === 0, JSON.stringify(seen.out?.[0]));
  check("…scrolled to the foot, the strip has slid up two bands: the last shows", seen.out?.[1]?.band === "2" && Math.abs(seen.out[1].slid - 2 * seen.out[1].tall) <= 2, JSON.stringify(seen.out?.[1]));
  check("…and back at the top, the first again", seen.out?.[2]?.band === "0" && seen.out[2].slid === 0, JSON.stringify(seen.out?.[2]));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
