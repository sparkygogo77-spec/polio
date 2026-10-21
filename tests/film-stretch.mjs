/**
 * A MOVING PICTURE IS NEVER STRETCHED FAR PAST THE FRAMES IT WAS FILMED AT.
 *
 * J (2026-10-21, a screenshot of thesolface.site brought in): a blurry copy
 * of the whole hero, its fixed header with it, lay over the board, and he
 * could not find what it was. It was the hero's film (`n_frames_11`,
 * `section:nth-of-type(1)::frames`): frames filmed at 512×320, laid over a
 * 1440×991 part edge to edge, 2.8 times their size. A film stretched that far
 * is a smear over the part it stands for, not a picture of it.
 *
 * So a film is drawn only while its layer is at most 1.5 times its frames'
 * size either way. Past that it draws nothing, and the part it was filmed
 * over shows through as it is. A film at its own size, or a little over,
 * still plays.
 *
 *   node tests/film-stretch.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
const parts$ = join(here, "..", "src", "features", "studio", "shelf", "parts");
const { Picture } = await jiti.import(join(parts$, "Media.tsx"));
const { themeFrom } = await jiti.import(join(parts$, "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const t = themeFrom({ "palette.mode": "dark" });
/** A film layer as `captured.ts` lays it: its picture the frames, its box the part's. */
const film = (picW, picH, w, h, kind = "pointer") => renderToStaticMarkup(React.createElement(Picture, {
  id: "picture", label: "Moving picture of the hero", content: "", options: {}, w, h, mode: "board", theme: t,
  picture: { pic: { id: "pic_f", path: "assets/pictures/pic_f.svg", type: "image/svg+xml", w: picW, h: picH, bytes: 0, alt: "", from: "upload", seeThrough: true, moving: { kind } }, src: "data:image/svg+xml,%3Csvg%2F%3E" },
}));
const plays = (html) => /data-moving-frames=/.test(html);
const { filmPic } = await jiti.import(join(parts$, "primitives.tsx"));
/** A film part as J's board holds it, drawn as `blocks.tsx` draws it: its picture through `filmPic`. */
const onBoard = (n) => renderToStaticMarkup(React.createElement(Picture, {
  id: "picture", label: n.label, content: "", options: {}, w: n.w, h: n.h, mode: "board", theme: t,
  picture: { pic: filmPic(n), src: "data:image/svg+xml,%3Csvg%2F%3E" },
}));
const jFilm = (id, selector, w, h, fw, fh, kind, position) => ({ id, label: `Moving picture ${id}`, w, h, from: { selector, ...(position ? { position } : {}) }, picture: { id: `pic_${id}`, path: `assets/pictures/pic_${id}.svg`, type: "image/svg+xml", w: fw, h: fh, bytes: 0, alt: "", from: "upload", seeThrough: true, moving: { kind } } });
/* J's three, as his board holds them (2026-10-21): the hero, the ticker, and the cursor glow. */
check("J's n_frames_11, the hero (512×320 over 1440×991), is held back", !plays(onBoard(jFilm("n_frames_11", "body > main > section:nth-of-type(1)::frames", 1440, 991, 512, 320, "pointer"))));
check("J's n_frames_5, the ticker (512×59 over 1917×124), is held back", !plays(onBoard(jFilm("n_frames_5", "body > main > div > div::frames", 1917, 124, 512, 59, "live"))));
check("J's n_frames_8, the cursor glow (353×341 over 450×450, only 1.32×), is held back: its part is pinned to the window and draws the glow itself", !plays(onBoard(jFilm("n_frames_8", "body > div:nth-of-type(3)::frames", 450, 450, 353, 341, "live", "fixed"))));
check("control: the SOL VISION button's film, in the fixed header but not itself pinned, plays", plays(onBoard(jFilm("n_frames_1", "body > header > div > div > button::frames", 98, 44, 98, 44, "live"))));

check("the hero's film, 512×320 frames over a 1440×991 part (2.8×), draws nothing", !plays(film(512, 320, 1440, 991)));
check("…and leaves no picture of its own over the part", !/<img/.test(film(512, 320, 1440, 991)));
check("a film past 1.5× one way only (512×320 over 800×320) draws nothing", !plays(film(512, 320, 800, 320)));
check("control: the header button's film at its own size (98×44 over 98×44) plays", plays(film(98, 44, 98, 44, "live")));
check("control: a film at exactly 1.5× (512×320 over 768×480) still plays", plays(film(512, 320, 768, 480)));
check("control: a film laid smaller than its frames plays", plays(film(643, 643, 320, 320, "drift")));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
