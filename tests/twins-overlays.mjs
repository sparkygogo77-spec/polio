/**
 * AN OVERLAY IS NOT A DUPLICATE: A BOX THAT PAINTS SOMETHING ITS TWIN DOES
 * NOT IS KEPT.
 *
 * THE OWNER'S REPORT, trumpmorty.fun: the hero TV's screen has no scanlines
 * and no glare. On the page the screen is a picture with two boxes laid over
 * it at exactly its size: `.tv__scan` (a repeating 2px stripe) and
 * `.tv__glare` (a light in the corner and a dark rim), captured as boxes that
 * paint `art.background`. The duplicate pass (`twins.ts`) took any stack of
 * boxes the same size as one box emitted twice and kept only the one that
 * said or drew the most, so both overlays went and the screen came out flat.
 * A copy is spare only when it paints nothing its keeper does not.
 *
 *   node tests/twins-overlays.mjs
 */
import { twins } from "../src/features/studio/twins.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const n = (id, extra = {}) => ({ id, pageId: "p0", featureId: "box", x: 815, y: 229, w: 398, h: 398, content: "", ...extra });

const screen = [
  n("screen", { featureId: "picture", picture: { id: "pic_cba8086a" } }),
  n("scan", { art: { background: "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.14) 0px, rgba(0, 0, 0, 0.14) 2px, rgba(0, 0, 0, 0) 2px, rgba(0, 0, 0, 0) 4px)" } }),
  n("glare", { art: { background: "radial-gradient(at 25% 15%, rgba(255, 255, 255, 0.35), rgba(0, 0, 0, 0) 45%)" } }),
];
const gone = twins(screen).map((t) => t.id);
check("the TV's scanlines and glare stay over its picture", !gone.includes("scan") && !gone.includes("glare"), JSON.stringify(gone));

/* Controls: what the pass is for. */
const wrap = [n("div", {}), n("button", { featureId: "cta-primary", content: "Connect", colour: { bg: "rgb(0, 255, 0)" } })];
check("control: a bare div round a button the same size is still the spare", JSON.stringify(twins(wrap).map((t) => t.id)) === '["div"]');
const panel = [n("p1", { colour: { bg: "rgb(21, 25, 34)" } }), n("p2", { colour: { bg: "rgb(21, 25, 34)" } })];
check("control: the same panel twice, painted the same, is still one spare", twins(panel).length === 1);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
