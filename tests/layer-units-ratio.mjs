#!/usr/bin/env node
/**
 * A PICTURE SIZED AS A SHARE OF ITS BLOCK KEEPS ITS SHAPE ON THE PUBLISHED PAGE.
 *
 * thesolface.site, published from a fresh import (the hand-edit pass,
 * 2026-10-22): the stickers on the "how to buy" cards are `width: 75%` of
 * their card, with no height of their own (an img keeps its shape). On the
 * board they were 242×180. On the published page they were 242×48.
 *
 * `layerUnits.ts#layerStyle` gave such a picture the height `width × h/w`,
 * written out of the width's own expression, and then read that height
 * against the block's height like any share. The card grows with the window,
 * so its width holds `min(1340px, 100%)`, a share of the page's width, and
 * read against the card's 393px height that `100%` became 393: 48px.
 *
 *   1. `layerStyle` says such a picture's height as its shape: no height
 *      written from the width, an aspect-ratio of w / h.
 *   2. Drawn in a browser on a page laid out as the export lays it, the
 *      picture is 242×180 at 1440 and keeps its shape at 1100.
 *
 *   node tests/layer-units-ratio.mjs
 *
 * Covers: src/features/studio/layerUnits.ts, src/features/studio/send-out/exportSite.ts
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { layerStyle } = await jiti.import(join(here, "..", "src", "features", "studio", "layerUnits.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* The card, as the export places it: a column 1340 wide at most, centred, so its left and width are written of the page's width. */
const block = {
  left: "calc(389px + (0.5 * (100% - min(1340px, 100%))))",
  top: "5124px",
  width: "calc(323px + (0.25 * (-1340px + min(1340px, 100%))))",
  height: "393px",
};
const units = { top: "8%", right: "-15%", width: "75%" };
const st = layerStyle(units, block, 242, 180, 180 / 242, { x: 130, y: 31 });

/* 1. */
check("1. no height is written out of the width's expression", !st?.height, st?.height ?? "(none)");
const ar = st?.aspectRatio ? st.aspectRatio.split("/").map(Number) : null;
check("…its shape is said instead: aspect-ratio 242 / 180", !!ar && Math.abs(ar[0] / ar[1] - 242 / 180) < 0.01, st?.aspectRatio ?? "(none)");

/* 2. */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  for (const width of [1440, 1100]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.setContent(`<!doctype html><html><body style="margin:0"><div id="root" style="position:relative;width:100%;height:10000px"><div id="sticker"></div></div></body></html>`);
    const got = await page.evaluate((st) => {
      const el = document.getElementById("sticker");
      Object.assign(el.style, { position: "absolute", display: "flex", flexDirection: "column", minHeight: "180px", background: "red" });
      /* As exportSite applies a layer's style. */
      if (st.left) el.style.left = st.left;
      if (st.top) el.style.top = st.top;
      if (st.width) el.style.width = st.width;
      if (st.height) { el.style.height = st.height; el.style.minHeight = st.height; }
      else if (st.aspectRatio) { el.style.aspectRatio = st.aspectRatio; el.style.height = "auto"; el.style.minHeight = "0px"; }
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
    }, st ?? {});
    const shape = got.h > 0 ? got.w / got.h : 0;
    if (width === 1440) check("2. at 1440 the sticker is 242×180, as on the board", Math.abs(got.w - 242) <= 1 && Math.abs(got.h - 180) <= 1, JSON.stringify(got));
    else check("…and at 1100 it keeps its shape (242:180)", Math.abs(shape - 242 / 180) < 0.02, JSON.stringify(got));
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
process.exit(results.every(Boolean) ? 0 : 1);
