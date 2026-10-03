#!/usr/bin/env node
/**
 * A SITE FROM CODE IS PUBLISHED AS ITS CODE LAYS IT OUT.
 *
 * Measured against live PonsStars at 1440 and 1920 (its own page, signed
 * out, the first screen):
 *   1. The body's margin is not a centred box: PonsStars' app, 8px in from
 *      both edges, was frozen at 1424 centred at every window. It spans the
 *      page and grows with it (`fluidSite.ts`).
 *   2. A max-width the page gave a part is kept (`siteRead.ts` reads it,
 *      node.maxw): play-layout grows to 1680 and no further.
 *   3. A flex row read as one (node.layout): the widest child of a row its
 *      children fill takes the growth (play-center, 844 → 1100 at 1920).
 *   4. A part in a corner of a rounded part that clips is rounded there too
 *      (`pageParts.ts#clippedCorners`): the TV's chart has the screen's
 *      corners, not square ones.
 *
 *   node tests/code-site-fidelity.mjs
 *
 * Covers: src/features/studio/fluidSite.ts, src/features/studio/pageParts.ts, src/features/studio/siteRead.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const F = await jiti.import(join(here, "..", "src", "features", "studio", "fluidSite.ts"));
const P = await jiti.import(join(here, "..", "src", "features", "studio", "pageParts.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const W = 1440;
const part = (id, sel, x, w, extra = {}) => ({ id, x, y: 0, w, h: 100, selector: sel, ...extra });
const row = { display: "flex", direction: "row", justify: "normal", align: "flex-start", gap: 20 };
const parts = [
  part("app", "body > div", 8, 1424),
  part("layout", "body > div > div", 8, 1424, { maxw: 1680, layout: row }),
  part("left", "body > div > div > aside:nth-of-type(1)", 8, 270),
  part("center", "body > div > div > main", 298, 844),
  part("right", "body > div > div > aside:nth-of-type(2)", 1162, 270),
];
const k = F.fluidParts(parts, W);
const widthAt = (id, at) => {
  const f = k.get(id).width;
  if (!f.css) return f.c + f.k * (at - W);
  return f.css;
};
check("the app spans the page between the body's margins, and grows with it", k.get("app").width.k === 1 && !k.get("app").width.css, J(k.get("app").width));
check("play-layout keeps its max-width: it grows to 1680 and no further", /min\(1680px/.test(widthAt("layout", 1920)), J(k.get("layout").width));
const centre = k.get("center").width;
check("the widest child of a row its children fill takes the growth", (centre.css && /- 1424px\)/.test(centre.css)) || centre.k === 1, J(centre));
check("the side panels keep their width", !k.get("left").width.css && k.get("left").width.k === 0 && !k.get("right").width.css && k.get("right").width.k === 0, J([k.get("left").width, k.get("right").width]));
const centred = F.fluidParts([part("box", "body > div", 320, 800)], W);
check("a box really centred in the page, well in from the edges, still holds its width", /min\(800px/.test(centred.get("box").width.css ?? ""), J(centred.get("box").width));

/* 4. corners */
const style = (o = {}) => ({ px: 16, weight: 400, family: "x", italic: false, colour: "#000", bg: null, border: null, radius: 0, pad: [0, 0, 0, 0], align: "left", leading: 20, transform: "none", ...o });
const rp = [
  { parent: -1, box: { x: 0, y: 0, w: 702, h: 480 }, style: style({ radius: 28, clips: true }) },
  { parent: 0, box: { x: 0, y: 0, w: 702, h: 480 }, style: style() },
  { parent: 0, box: { x: 0, y: 0, w: 200, h: 40 }, style: style() },
  { parent: 0, box: { x: 300, y: 200, w: 50, h: 50 }, style: style() },
  { parent: -1, box: { x: 0, y: 600, w: 300, h: 100 }, style: style({ radius: 12 }) },
];
rp.push({ parent: 4, box: { x: 0, y: 600, w: 300, h: 100 }, style: style() });
check("a part filling a rounded part that clips takes its radius", P.clippedCorners(rp, 1).radius === 28);
check("one in a corner takes that corner alone", J(P.clippedCorners(rp, 2).radii) === J([28, 0, 0, 0]), J(P.clippedCorners(rp, 2)));
check("one in the middle keeps its square corners", P.clippedCorners(rp, 3).radius === 0 && !P.clippedCorners(rp, 3).radii);
check("a rounded part that does not clip rounds nothing inside it", P.clippedCorners(rp, 5).radius === 0);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
