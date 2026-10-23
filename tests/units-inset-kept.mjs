#!/usr/bin/env node
/**
 * A LAYER PLACED FROM ITS BLOCK'S FOOT STAYS AT THAT FOOT WHEN THE BLOCK HAS GROWN.
 *
 * trumpmorty.fun's hero (1440×900) holds its deserts placed from its foot
 * (`bottom: 13%; height: 36%`). A bigger title (a hand edit, 2026-10-23)
 * grew the hero 85px on the board, and the board moved the deserts down with
 * its foot; the published page left them 85px up, over the title. The export
 * read the block's insets off the block as it is now (`layerUnits.ts
 * #innerBlock`), and the growth read as an 85px bottom inset.
 *
 *   1. the capture writes the block's insets beside its box (`units.of.inset`);
 *   2. with them, the inner block of a grown hero is the whole hero;
 *   3. a desert placed from the foot of the grown hero moves down by the growth;
 *   4. without them (an older capture) nothing changes: the box is read as before;
 *   5. the board moves and grows that desert as the published page does: by the
 *      growth less its shares, and by its share (`textFit.ts#fitTree`).
 *
 *   node tests/units-inset-kept.mjs
 *
 * Covers: src/features/studio/layerUnits.ts, src/features/studio/send-out/exportSite.ts, capture/site/capture/capture-to-document.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { innerBlock, layerStyle } = await jiti.import(join(here, "..", "src", "features", "studio", "layerUnits.ts"));
const { fitRows } = await jiti.import(join(here, "..", "src", "features", "studio", "textFit.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* 1. */
const conv = readFileSync(join(here, "..", "capture", "site", "capture", "capture-to-document.mjs"), "utf8");
check("1. the converter writes the block's insets beside its box", /box: of\.box, \.\.\.blockInsetOf\(el, of\.box\)/.test(conv) && /function blockInsetOf\(el, box\)/.test(conv));

const box = [0, 0, 1440, 900];
const grown = { x: 0, y: 0, w: 1440, h: 985 };
const block = { left: "0px", top: "0px", width: "1440px", height: "985px" };
/* 2. */
const kept = innerBlock(block, grown, box, [0, 0, 0, 0]);
check("2. with the insets kept, the inner block of the grown hero is the whole hero", kept.height === "985px", JSON.stringify(kept));
/* 3. */
const desert = { left: "-5%", right: "-5%", bottom: "13%", height: "36%" };
const at = (b) => { const st = layerStyle(desert, b, 1584, 324); return st?.top ?? ""; };
const px = (css) => Function(`return ${css.replace(/calc/g, "").replace(/px/g, "")}`)();
const topGrown = px(at(kept)), topCaptured = px(at(innerBlock({ ...block, height: "900px" }, { ...grown, h: 900 }, box, [0, 0, 0, 0])));
check("3. a desert placed from the foot moves down with the growth (85px)", Math.round(topGrown - topCaptured) === Math.round(85 - 0.36 * 0 - 0.13 * 85 + 0.36 * 85 - 0.36 * 85) || Math.abs(topGrown - topCaptured - 85 * (1 - 0.13 - 0.36)) < 1, `${Math.round(topCaptured)} → ${Math.round(topGrown)}`);
/* 4. */
const old = innerBlock(block, grown, box);
check("4. an older capture with no insets is read as before (its growth an inset)", old.height !== "985px", JSON.stringify(old));
/* 5. */
const H = "body > main > section:nth-of-type(1)";
const fit = new Map(fitRows([
  { id: "hero", x: 0, y: 0, w: 1440, h: 900, drew: 900, path: H, words: false },
  { id: "title", x: 100, y: 215, w: 635, h: 213, drew: 298, path: `${H} > h1`, words: true },
  { id: "desert", x: -72, y: 459, w: 1584, h: 324, drew: 324, path: `${H} > div:nth-of-type(2)`, words: false, out: true, foot: true, footShare: { bottom: 0.13, height: 0.36 } },
]).map((x) => [x.id, x]));
const d = fit.get("desert");
check("5. the board moves the desert down by the growth less its shares and grows it by its share, where the published page has it", !!d && Math.abs(d.y - topGrown) <= 1 && Math.abs(d.h - (324 + 85 * 0.36)) <= 1, JSON.stringify(d));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
process.exit(results.every(Boolean) ? 0 : 1);
