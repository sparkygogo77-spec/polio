/**
 * A FILM OF A STYLESHEET ANIMATION THE PART ALREADY PLAYS IS NOT LAID.
 *
 * thesolface.site's hero, once its frog was whole (J, 2026-10-21): a hard
 * square of splash and backdrop stood over the "uptrend" picture beside the
 * frog. It is `n_frames_1`, the capture's film of that picture floating: 16
 * frames, filmed with what was behind it, recorded `via: "css"` (its float
 * is the stylesheet's `floatSmall`). The picture already replays `floatSmall`
 * as captured, so the film shows the same float a second time, as an opaque
 * square. `captured.ts` skips a film the part already plays, by the
 * animation's name, and this film carries no name, so it was laid.
 *
 * A film the capture made of a stylesheet animation is not laid over a part
 * that plays a stylesheet animation of its own, named or not. A film of
 * movement the part does not play (a script's, a canvas's) is laid as before.
 *
 *   node tests/film-css-twice.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { attachCaptured } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "library", "captured.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const H = "body > main > section:nth-of-type(1) > div:nth-of-type(4) > div:nth-of-type(2)";
const part = (id, selector, x, y, w, h, extra = {}) => ({ id, pageId: "page_home", featureId: "picture", label: id, x, y, w, h, from: { selector }, ...extra });
const floatSmall = { animation: [{ name: "floatSmall", duration: "8s", timing: "ease-in-out", delay: "0s", iterations: "infinite", direction: "normal", fill: "none" }] };
const nodes = [
  /* The uptrend picture, replaying its own float as captured. */
  part("uptrend", `${H} > img:nth-of-type(2)`, 758, 312, 246, 246, { motion: floatSmall, art: { animation: "floatSmall" } }),
  /* A part whose movement is its script's, not a stylesheet's. */
  part("chart", "body > main > section:nth-of-type(6) > div > canvas", 50, 6600, 1338, 560),
  /* A part that moves by a stylesheet animation it does not carry. */
  part("dot", `${H} > div:nth-of-type(1) > span`, 65, 195, 7, 7),
];
const pic = (n, w, h) => ({ id: `pic_${n}`, path: `assets/pictures/pic_${n}.svg`, w, h });
/* The films as thesolface's capture wrote them. */
const behaviours = { version: 1, motion: { frames: [
  { part: "uptrend", selector: `${H} > img:nth-of-type(2)`, kind: "drift", box: [725, 268, 313, 313], what: ["translate"], via: "css", self: true, picture: pic(1, 313, 313) },
  { part: "chart", selector: "body > main > section:nth-of-type(6) > div > canvas", kind: "live", box: [50, 6600, 1338, 560], via: "script", picture: pic(2, 1338, 560) },
  { part: "dot", selector: `${H} > div:nth-of-type(1) > span`, kind: "live", box: [65, 195, 7, 7], via: "css", picture: pic(3, 7, 7) },
] } };
const out = attachCaptured(nodes, behaviours);
const film = (host) => out.find((n) => n.from?.selector === `${nodes.find((p) => p.id === host).from.selector}::frames`);

check("the uptrend picture's float, which it already replays, is not filmed over it", !film("uptrend"));
check("control: a script's movement is still laid as a film", !!film("chart"));
check("control: a stylesheet movement the part does not carry is still laid as a film", !!film("dot"));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
