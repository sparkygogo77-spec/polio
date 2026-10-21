/**
 * THE MOVING PICTURE OF A PART IN A FIXED BAND IS LAID ON THE PART.
 *
 * MEASURED on thesolface.site brought in through the Capture a site door
 * (run 39670562970, 2026-10-21). The capture films what moves window by
 * window, scrolling as it goes (`frames-drive.mjs`), and writes each film's
 * box at its page y: the window's top plus how far it had scrolled. A part in
 * a fixed band does not scroll, so its box came out as far down the page as
 * the window had gone: the header's SOL VISION button, at y 31, had its film
 * at y 924; the header's own scroll film at 167 for a header at 14. Laid
 * where the capture wrote it, the button's film stood 893px below its button,
 * and the sweep's grow step, which grows a box round what it owns, took the
 * header from 78 to 954 tall to hold it.
 *
 * Scrolling moves nothing in a fixed band, so the film of a part in one is
 * laid at its part's own height on the page; across, it stays where it was
 * filmed. A part in the flow keeps the box the capture wrote.
 *
 *   node tests/fixed-frames.mjs
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

const part = (id, selector, x, y, w, h, position) => ({ id, pageId: "page_home", featureId: "box", label: id, x, y, w, h, from: { selector, ...(position ? { position } : {}) } });
const nodes = [
  part("header", "body > header", 0, 14, 1440, 78, "fixed"),
  part("bar", "body > header > div", 35, 14, 1370, 78),
  part("button", "body > header > div > div > button", 1151, 31, 98, 44),
  part("glow", "body > div:nth-of-type(3)", 327, 320, 450, 450, "fixed"),
  part("hero", "body > main > section:nth-of-type(1)", 0, 0, 1440, 991),
  part("leaf", "body > main > section:nth-of-type(2) > img", 35, 1363, 643, 643),
];
const pic = (n) => ({ id: `pic_${n}`, path: `assets/pictures/pic_${n}.svg`, w: 10, h: 10 });
/* The films as thesolface's capture wrote them. */
const behaviours = { version: 1, motion: { frames: [
  { part: "button", selector: "body > header > div > div > button", box: [1151, 924, 98, 44], kind: "live", picture: pic(1) },
  { part: "bar", selector: "body > header > div", box: [35, 167, 1370, 78], kind: "scroll", picture: pic(2) },
  { part: "glow", selector: "body > div:nth-of-type(3)", box: [-97, 2339, 450, 450], kind: "pointer", picture: pic(3) },
  { part: "hero", selector: "body > main > section:nth-of-type(1)", box: [0, 0, 1440, 991], kind: "pointer", picture: pic(4) },
  { part: "leaf", selector: "body > main > section:nth-of-type(2) > img", box: [35, 1363, 643, 643], kind: "drift", picture: pic(5) },
] } };
const out = attachCaptured(nodes, behaviours);
const film = (host) => out.find((n) => n.from?.selector === `${nodes.find((p) => p.id === host).from.selector}::frames`);

check("the header button's film is laid on the button, at y 31", film("button")?.y === 31, `at ${film("button")?.y}`);
check("…and stays where it was filmed across, at x 1151", film("button")?.x === 1151, `x ${film("button")?.x}`);
check("the header bar's scroll film is laid on the bar, at y 14", film("bar")?.y === 14, `at ${film("bar")?.y}`);
check("a fixed part's own film (the cursor glow) is laid at its part's y, 320", film("glow")?.y === 320, `at ${film("glow")?.y}`);
check("…keeping the x it was filmed at, -97", film("glow")?.x === -97, `x ${film("glow")?.x}`);
check("control: a film in the flow keeps the box the capture wrote (the hero, at 0)", film("hero")?.y === 0, `at ${film("hero")?.y}`);
check("control: and so does one further down the page (the lore leaf, at 1363)", film("leaf")?.y === 1363, `at ${film("leaf")?.y}`);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
