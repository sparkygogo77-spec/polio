/**
 * A PART SHIFTED BY ITS OWN TRANSFORM IS CUT AT THE PAGE WHERE IT IS DRAWN.
 *
 * J (2026-10-21), thesolface.site on a fresh import (df44832, capture run
 * 39688255459): the hero's frog was cut in half by a hard vertical edge, and
 * its paint-splash backdrop ended in one. The frog is an img whose box the
 * capture records at x 1049, 690 wide, with `transform: translateX(-345px)`:
 * on the page it is drawn at 704 to 1394, wholly inside the 1440 page.
 *
 * The board cuts a part at the page's top, left and right edges
 * (`pageClip.ts`). It measured the box before the transform: 1049 + 690 runs
 * 299px past 1440, so the part was given `inset(0 299px 0 0)`. An inset cuts
 * at the part's own box, and the transform had drawn the frog's left half
 * outside it, so the frog lost its left half and kept a cut at 1394.
 *
 * A part moved by its own translation is cut where it is drawn: nothing at
 * all where the drawing stands inside the page, and where it does not, a cut
 * that follows the drawing.
 *
 *   node tests/page-clip-shifted.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { pageClip } = await jiti.import(join(here, "..", "src", "features", "studio", "pageClip.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* thesolface's frog, as the capture records it. */
const frog = { x: 1049, y: 145, w: 690, h: 863, art: { transform: "matrix(1, 0, 0, 1, -345, 0)", origin: "345px 431.09px", clipPath: "inset(0px 0px 17px 0px)" } };
check("the frog, drawn at 704 to 1394, is not cut at all", pageClip(frog, 1440) === undefined, String(pageClip(frog, 1440)));

/* Shifted, and still past the right edge: the cut follows the drawing (drawn 1200 to 1500, 60 past the edge). */
const past = { x: 1300, y: 10, w: 300, h: 50, art: { transform: "matrix(1, 0, 0, 1, -100, 0)" } };
const cut = pageClip(past, 1440);
check("a part shifted left but still 60px past the right edge is cut at the edge where it is drawn", cut === "polygon(-100px 0px, 140px 0px, 140px 100000px, -100px 100000px)", String(cut));

/* Shifted by its own `translate` (a seal set at translate: -50% 0 is not this; px only). */
const nudged = { x: 1200, y: 0, w: 300, h: 40, art: { translate: "-60px 0px" } };
check("a part moved by its own translate in px, drawn inside the page, is not cut", pageClip(nudged, 1440) === undefined, String(pageClip(nudged, 1440)));

/* Unchanged: a part with no transform keeps the inset it had. */
check("control: trumpmorty's planet at -355,-441, unturned, is cut at the top and the left as before", pageClip({ x: -355, y: -441, w: 900, h: 900 }, 1440) === "inset(441px 0px 0px 355px)", String(pageClip({ x: -355, y: -441, w: 900, h: 900 }, 1440)));
check("control: a part inside the page is not cut", pageClip({ x: 10, y: 10, w: 100, h: 100 }, 1440) === undefined);
check("control: a part turned (rotated) is cut by its box as before", pageClip({ x: 1300, y: 0, w: 300, h: 40, art: { transform: "matrix(0.97, 0.24, -0.24, 0.97, 0, 0)" } }, 1440) === "inset(0px 160px 0px 0px)", String(pageClip({ x: 1300, y: 0, w: 300, h: 40, art: { transform: "matrix(0.97, 0.24, -0.24, 0.97, 0, 0)" } }, 1440)));

/*
 * AND THE FROG'S OWN CUT. The capture cut the frog where it hangs out of the
 * hero's foot, `inset(0 0 17px 0)`. It animates, so the board wears that cut
 * on a still box round it (`blocks.tsx#StillCut`), outside the -345px shift:
 * an inset cuts every side at the box, so the shifted frog lost its left half
 * there too. Shifted, only the sides the capture cut are cut.
 */
const { stillCutOf } = await jiti.import(join(here, "..", "src", "features", "studio", "pageClip.ts"));
const frogCut = stillCutOf(frog.art.clipPath, frog.art);
check("the frog's still cut keeps its foot cut (17px) and leaves its other sides open", frogCut === "polygon(-100000px -100000px, calc(100% + 100000px) -100000px, calc(100% + 100000px) calc(100% - 17px), -100000px calc(100% - 17px))", String(frogCut));
check("control: an unshifted part keeps the capture's cut as written", stillCutOf("inset(0px 0px 17px 0px)", { transform: "matrix(0.97, 0.24, -0.24, 0.97, 0, 0)" }) === "inset(0px 0px 17px 0px)");
check("control: a shifted part with no cut has none", stillCutOf(undefined, frog.art) === undefined);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
