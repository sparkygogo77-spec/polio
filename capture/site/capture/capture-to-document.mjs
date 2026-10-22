#!/usr/bin/env node
/**
 * The page captures become the Builder's document.
 *
 * A capture is a mechanical dump of a live page: every visible element
 * with its real box, its own text, and its computed styles, taken from the
 * running browser (`capture-route.mjs`). `routes.json` lists the pages the
 * site has — read from its source, not guessed — and where each capture
 * is. This turns them into `site/document.json`, the file the Builder's
 * exact-copy path loads whole (polio: `repoRun.ts` reads it out of a
 * repository, `store.ts#loadDoc` → `docTake.ts#takeDoc` lays it over the
 * board). Written against polio trunk b73babb; every field name is read
 * from `store.ts`, `parts/theme.ts`, `parts/types.ts`, `fonts.ts` and
 * `vector.ts` there and cited where it is used.
 *
 * Every rule here is a declaration keyed on the capture's own tags and
 * numbers, in the manner of polio's `recreate.ts`. Nothing is described to
 * a model, and nothing is invented where nothing was measured: a property
 * the document format cannot hold is written down as such in the ledger
 * this prints, rather than approximated.
 *
 *   node capture-to-document.mjs <routes.json> <out-dir> [--assets <dir>]
 *
 * Writes <out-dir>/site/document.json, the pictures under
 * <out-dir>/assets/pictures, and prints the ledger: for every captured
 * property, where it went. `--assets` is where the captures' bytes were
 * saved (pictures and font files, by file name); without it a picture is
 * kept as its address and a face as its address, and the ledger says so.
 *
 * WHAT A CAPTURED ELEMENT BECOMES. The part is chosen by what the element
 * itself draws — its own words, its picture, its strokes, or nothing —
 * never by folding its children into it, because the capture recorded
 * every child with a box of its own and a composite part (a top bar, a
 * row of tiles) draws its children where it likes. So:
 *
 *   body, and the wrapper that is the page's own box   → the page's look
 *   svg whose strokes were captured with their `d`     → `drawn-icon`, holding them as `node.vector`
 *   svg whose strokes were not                         → `box` (an icon with no geometry)
 *   img                                                 → the `picture` part, holding the picture as its own
 *   own text, h1..h6                                    → `value-prop` (a heading)
 *   own text, button or a, painted or edged             → `cta-primary` (a button)
 *   own text, anything else                             → `prose`
 *   no text of its own                                  → `box`, the plain part that draws nothing of its own
 *
 * WHAT A THING IS, BEFORE WHAT IT LOOKS LIKE. Each captured element carries
 * the role the browser's accessibility tree computed for it (`role`), its
 * accessible name (`name`), its states (`state`) and, for a field, its
 * `type` and `placeholder`. The part is chosen from the role first —
 * heading, paragraph, image, button — and from shape only where the tree
 * gave none. Where the library has no part for a role (link, navigation,
 * banner, main, complementary, contentinfo, list, listitem, textbox) the
 * look stays exactly what the shape rule draws today, and the role still
 * travels: in the label every surface shows, in the prompt the blueprint
 * writes, and — for the interactive roles, textbox, button and link — in
 * `data`, which the blueprint writes under "What the backend must
 * provide", with the type, placeholder, name and state. His search field
 * is a `textbox` named "Ask or search..." with that placeholder; the page
 * declares no search role, so none is written, and the placeholder travels
 * as evidence rather than as a decision. A typed field for the role would
 * be cleaner than label, prompt and data; that is a change to polio's
 * `StudioNode`, not to this converter.
 *
 * A BUTTON IS A BUTTON, IN ITS OWN CLOTHES (polio trunk b73babb). Every
 * element the tree calls a button, its words on it or in a child (the
 * eight entries of his sidebar: a `button` holding an `svg` and a `span`),
 * is `cta-primary` carrying those words. The part's rule on trunk is "the
 * node where the node spoke, the part's own where it did not"
 * (parts/theme.ts#NodeSaid, parts/Cta.tsx), so a button node here says
 * everything the capture measured, and the part stands aside for each:
 *   colour.text   its words' colour — the part draws them in it
 *   colour.bg     its fill, when it had one — `Fill` paints it, the part paints nothing over it
 *   font          size, weight, face — `t.fontWeight` is only ever the node's
 *   text.align    left, when it was — the part sets its words there rather than centred
 *   edge          as measured, or an edge of none — the wrapper draws it and the part draws none,
 *                 where before it drew a 2px edge of its own (or a transparent one 2px wide)
 *   pad           where its words start inside it: the measured padding, or, when the words were
 *                 in a child beside an icon, the child's own offset, so the words land where the
 *                 page put them and the icon (its own part) in the gap.
 *                 The wrapper does not paint a fill, and `Fill` paints the node's inside the
 *                 padding, so a padded button WITH a fill shows it inset by the padding: a
 *                 gap on the polio side, said here rather than worked around.
 * The span that held the words is folded into the button's content; the
 * icon beside it stays its own drawn-icon at its own box. Where the button
 * had no fill, `variant` is `outline`, the one variant that paints nothing,
 * and the edge of none keeps it edgeless. The ledger says which of these
 * each button said.
 *
 * A BOX CARRIES ITS OWN ARRANGEMENT. `StudioNode` has four optional box
 * fields (parts/theme.ts#NodeBox, store.ts): `layout` (display, direction,
 * align, justify, gap, wrap, columns), `pad` (four sides), `edge` (width,
 * style, colour) and `text` (align, transform). They are filled from the
 * captured values as recorded, and only where the value says something: a
 * CSS default is left off, so a node that says nothing gets its part
 * alone. A button is the one part that draws its own box — its edge and
 * its padding are the part's — so a button node carries neither, and the
 * ledger says so. Margins and a stroke's geometry stay out of the box
 * fields, as the format keeps them out.
 *
 * FACES COME THROUGH ONE TO ONE, OR SAY WHY NOT (polio `fonts.ts`). The
 * captures carry the pages' `@font-face` rules; the faces some part is
 * set in (`font.face`) are carried into `look.fonts` as `CarriedFont`
 * entries, Latin subsets only, the bytes as a data URI when the file is
 * in --assets, by the rules `carryFaces` applies, transcribed. A generic
 * keyword (`ui-monospace`) is the machine's own face and cannot be
 * carried; it is named in the ledger.
 *
 * NOTHING WRAPS A CONTAINER. A container is a box holding its children by
 * geometry; there are no groups, because a group is a second object over
 * the same children that takes every click for the whole section.
 *
 * WHAT FIXED MEANS ON A BOARD WITH NO VIEWPORT. Each page was captured at
 * scroll 0, so a fixed element's box is its box on the page, and it keeps
 * it: nothing is moved, and the overlaps that were measured — a fixed bar
 * over the top of the column that scrolls beneath it — stay in the
 * geometry, because they are the page's own. What a fixed or absolute
 * element loses without a viewport is only its place in the stack, and the
 * board's stack is the order of the nodes. So the parts that flow are
 * written first, in the capture's order, and every positioned band (an
 * element placed fixed or absolute, with everything inside it) is written
 * after them, lowest z-index first, each band in its own capture order:
 * painted over what scrolls beneath it, exactly as the browser painted it.
 *
 * WHERE A LINK GOES. An `href` whose path is one of the site's routes
 * becomes `{ kind: "page", target: <that page's id> }` — a page in the
 * document, not an address on the web (LiveSite.tsx#resolvePageLink reads
 * the id). Any other address stays `{ kind: "url" }`; a bare `#` is the
 * page itself and goes nowhere. A sidebar button leads to the page its
 * section was captured as, by the `sections` map in routes.json.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { measureParts, verdicts } from "./join-arbiter.mjs";
import { holesIn, placeHoles } from "./hole-arbiter.mjs";
import { inlineLines, foldRuns, gapSide, wordsPart } from "./inline-runs.mjs";
/** Why a line's own words became parts of their own rather than runs of it. */
const SPLIT_WHY = (kids) => (kids.every((k) => k.link) ? "its own words only separate its links" : "its own words only separate them");
import { imageSize } from "./image-size.mjs";
import { assetFile } from "./asset-name.mjs";
import { siteMap } from "./network.mjs";
import { glideRule } from "./glide.mjs";

/* ------------------------------------------------------------------ */
/* Arguments                                                            */
/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const routesPath = args[0];
const outDir = args[1];
const assetsDir = (() => { const i = args.indexOf("--assets"); return i >= 0 ? args[i + 1] : null; })();
if (!routesPath || !outDir) {
  console.error("usage: node capture-to-document.mjs <routes.json> <out-dir> [--assets <dir>]");
  process.exit(2);
}
const routes = JSON.parse(readFileSync(routesPath, "utf8"));
const routesDir = dirname(resolve(routesPath));

/* ------------------------------------------------------------------ */
/* Constants transcribed from polio, cited                              */
/* ------------------------------------------------------------------ */

/** The site's base type size: `NodeFont.size` is a multiplier on it (parts/theme.ts). */
const BASE_PX = 16;
/** `applyFont` clamps: size 0.6..2, weight 300..800 to the hundred, spacing -0.05..0.3em, leading 1..2 (parts/theme.ts). */
const CLAMP = { size: [0.6, 2], weight: [300, 800], spacing: [-0.05, 0.3], leading: [1, 2] };
/** What each part multiplies the base by when it draws its words, so the captured pixels land as captured. */
const PART_SCALE = { "value-prop": 1.6, "cta-primary": 1, prose: 1, box: 1 };
/** The lamp as a new document has it (look.ts#defaultLight). */
const DEFAULT_LIGHT = { on: false, x: 0.5, y: 0.12, height: 0.55, strength: 0.45, lift: 10, warmth: 80, wash: 0 };
/** `parseColor` (look.ts) reads `#hex`, `rgb()` / `rgba()` (alpha dropped) and `oklch()`; nothing else. */
const PARSEABLE = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+\s*[,\s]\s*[\d.]+\s*[,\s]\s*[\d.]+|oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+)/i;
/** Generic family keywords that name no face (fonts.ts#GENERIC_FACES). */
const GENERIC = /^(ui-monospace|ui-sans-serif|ui-serif|ui-rounded|system-ui|-apple-system|BlinkMacSystemFont|monospace|sans-serif|serif|cursive|fantasy|math|emoji|fangsong|inherit|initial|unset)$/i;
/** What `NodeLayout`, `NodeEdge` and `NodeText` accept (parts/theme.ts). */
const DISPLAYS = new Set(["block", "flex", "grid"]);
const DIRECTIONS = new Set(["row", "column"]);
const EDGE_STYLES = new Set(["solid", "dashed", "dotted", "double", "none"]);
const TEXT_ALIGNS = new Set(["start", "left", "center", "end", "right", "justify"]);
const TEXT_TRANSFORMS = new Set(["none", "uppercase", "lowercase", "capitalize"]);
/** fonts.ts: the most one file may weigh, all of a page's together, and how many rules of one family are carried. */
const FONT_FILE_MAX = 600 * 1024;
const FONT_TOTAL_MAX = 2 * 1024 * 1024;
const FONT_RULES_MAX = 4;
/** vector.ts: how many paths an icon keeps before merging (ICON_PATHS); DrawnIcon's `paths` option goes to 24. */
const ICON_PATHS_MAX = 24;

/** The family the page was set in, as one of the app's own (recreate.ts#familyOf). */
function familyOf(stack) {
  const s = stack.toLowerCase();
  if (/mono|courier|consolas|menlo/.test(s)) return "monospace";
  if (/georgia|times|garamond|serif/.test(s) && !/sans-serif/.test(s)) return "serif";
  if (/impact|black|display/.test(s)) return "display";
  if (/narrow|condensed/.test(s)) return "condensed";
  if (/futura|avenir|century gothic|poppins|montserrat/.test(s)) return "geometric sans";
  if (/helvetica|inter|arial|roboto/.test(s)) return "grotesque sans";
  if (/segoe|trebuchet|tahoma/.test(s)) return "humanist sans";
  if (/comic|cursive|script/.test(s)) return "handwritten";
  return /sans/.test(s) ? "system sans" : undefined;
}

/** A colour the browser reported, as [r, g, b, a] (recreate.ts#rgba). */
function rgba(v) {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/i.exec(v ?? "");
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
}
/** How far from grey, 0..1: what makes an accent an accent (recreate.ts#chroma). */
function chroma(v) {
  const c = rgba(v);
  if (!c) return 0;
  return (Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2])) / 255;
}
/** Relative lightness of an rgb() colour, 0..1 (recreate.ts#light). */
function light(v) {
  const c = rgba(v);
  if (!c) return 0;
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
}
/** The alpha of any colour string the browser writes, 1 when it has none: `oklab(… / 0.1)`, `rgba(…, 0.5)`. */
function alphaOf(v) {
  const s = (v ?? "").trim();
  const inner = /^\w+\((.*)\)$/.exec(s)?.[1];
  if (inner === undefined) return 1;
  const pct = (x) => (x.endsWith("%") ? Number(x.slice(0, -1)) / 100 : Number(x));
  if (/^rgba?\(/i.test(s)) {
    const nums = inner.split(/[\s,/]+/).filter(Boolean);
    return nums.length >= 4 ? pct(nums[3]) : 1;
  }
  const slash = inner.indexOf("/");
  return slash >= 0 ? pct(inner.slice(slash + 1).trim()) : 1;
}
const isNone = (v) => !v || v === "none" || v === "transparent" || v === "rgba(0, 0, 0, 0)";

/**
 * Any colour the browser writes, as sRGB [r, g, b, a] with r, g, b in 0..255:
 * rgb(), rgba(), and the oklab() / oklch() a Tailwind v4 `/10` tint computes to.
 * Null for anything else.
 */
function srgbaOf(v) {
  const s = (v ?? "").trim();
  const c = rgba(s);
  if (c && /^rgba?\(/i.test(s)) return c;
  /* color(srgb r g b / a), as the browser writes a colour given with an alpha in that space (share.xyz's headline). */
  const cs = /^color\(\s*srgb\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i.exec(s);
  if (cs) return [cs[1], cs[2], cs[3]].map((x) => Math.min(255, Math.max(0, Number(x) * 255))).concat(cs[4] === undefined ? 1 : cs[4].endsWith("%") ? Number(cs[4].slice(0, -1)) / 100 : Number(cs[4]));
  const m = /^(oklab|oklch)\(\s*([-\d.]+%?)\s+([-\d.]+%?)\s+([-\d.]+)(?:deg)?%?\s*(?:\/\s*[\d.]+%?\s*)?\)$/i.exec(s);
  if (!m) return null;
  const num = (x, pctOf) => (x.endsWith("%") ? (Number(x.slice(0, -1)) / 100) * pctOf : Number(x));
  const L = num(m[2], 1);
  let a, b;
  if (m[1].toLowerCase() === "oklab") { a = num(m[3], 0.4); b = num(m[4], 0.4); }
  else { const C = num(m[3], 0.4), h = (Number(m[4]) * Math.PI) / 180; a = C * Math.cos(h); b = C * Math.sin(h); }
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const ss = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * ss,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * ss,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * ss,
  ];
  const gamma = (x) => { const y = Math.min(1, Math.max(0, x)); return 255 * (y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055); };
  return [...lin.map(gamma), alphaOf(s)];
}
/** `fg` laid over an opaque `bg`, as the browser composites: in sRGB, by fg's alpha. */
const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
const rgbText = (c) => `rgb(${c.slice(0, 3).map((x) => Math.round(x)).join(", ")})`;

const round2 = (n) => Math.round(n * 100) / 100;
const cut = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

/* ------------------------------------------------------------------ */
/* The ledger: where every captured property went                       */
/* ------------------------------------------------------------------ */

/**
 * One line per property per element. `to` is one of:
 *   field      — a typed field on the node or the document, and the part draws it
 *   stored     — a typed field on the node, but the part it landed on does not draw it
 *   folded     — carried into the parent it belongs to (an icon's strokes)
 *   default    — the CSS default, which says nothing and needs no home
 *   n/a        — a text property on an element that has no text
 *   nowhere    — the document format has no place for it
 */
const ledger = [];
let notePage = "";
/* Quiet while a page's pressed states are read: their elements are the page's own, already said once. */
let muted = false;
const note = (sel, prop, to, how) => { if (!muted) ledger.push({ page: notePage, sel, prop, to, how }); };

/* ------------------------------------------------------------------ */
/* Pictures: the part's own, as a reference, with the bytes beside it    */
/* ------------------------------------------------------------------ */

/**
 * A picture is the part's own: `node.picture`, "the picture this part
 * holds, as a reference and never as bytes" (polio `store.ts`). The
 * document keeps the id, the path, the type and the size; the bytes go in
 * the repository at that path, which is where the exact-copy path fetches
 * them from (`repoRun.ts#copyOf`) and where a published site serves them
 * (`staticSite.ts`). The path follows `pictures.ts#put`. Never a
 * `look.texture` layer: a layer is the page's, and one aimed at surfaces
 * is worn by every card-styled part on the board.
 */
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
const pictures = new Map();
function pictureFor(src, pageUrl) {
  /*
   * A picture written into the page as a `data:` address (the PonsStars
   * preview's chart: each canvas copied as an <img> of what it drew) holds
   * its own bytes: read from the address, never fetched
   * (check-script-built.mjs (3)).
   */
  const data = /^data:([^;,]*)(;base64)?,/i.exec(src);
  if (data) {
    const key = `data:${createHash("sha1").update(src).digest("hex")}`;
    if (pictures.has(key)) return pictures.get(key);
    const body = src.slice(data[0].length);
    const bytes = data[2] ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body));
    return pictureOf(key, `picture.${(data[1].split("/")[1] ?? "png").replace(/\+xml$/, "")}`, bytes);
  }
  const name = basename(new URL(src, pageUrl).pathname);
  /* One address, one file (asset-name.mjs); a capture taken before kept the bare file name. */
  const file = assetFile(assetsDir, new URL(src, pageUrl).href);
  if (!file) return null;
  if (pictures.has(src)) return pictures.get(src);
  return pictureOf(src, name, readFileSync(file));
}
/** An svg kept whole (dump.mjs#svgWhole): its file under --assets, or its markup when the capture holds it. */
function pictureOfSvg(el) {
  const key = `svg:${el.svgFile ?? createHash("sha1").update(el.svgMarkup ?? "").digest("hex")}`;
  if (pictures.has(key)) return pictures.get(key);
  const file = el.svgFile && assetsDir ? join(assetsDir, el.svgFile) : null;
  const bytes = file && existsSync(file) ? readFileSync(file) : el.svgMarkup ? Buffer.from(el.svgMarkup) : null;
  return bytes ? pictureOf(key, el.svgFile ?? "svg.svg", bytes) : null;
}
/**
 * A canvas's pixels as the dump read them (dump.mjs, `drawn`): a PNG data
 * address. One that repainted while it was watched (`frames`,
 * capture-route.mjs) is its frames played back instead: one svg at its box,
 * each picture it showed once, each shown for as long as it stood, on a
 * loop, drawn square where the page drew it square. An `<img>` plays it; a
 * machine that plays no animation shows the first.
 *
 * A run the pointer or the scroll drives (`__still`) is written with no
 * animation at all: it shows its first picture until a script picks another
 * (the Builder's `moving-frames` feature), on the board as on a page with no
 * script. Each of its `<use>` says how long its picture stood (`data-ms`),
 * in the order the pictures were shown, so the script can tell which picture
 * went with which moment of the recording.
 */
function flipbookOf(el) {
  const f = el.frames;
  const W = Math.max(1, el.w), H = Math.max(1, el.h);
  const total = f.steps.reduce((n, [, d]) => n + d, 0);
  if (!(total > 0)) return null;
  const square = /pixelated|crisp-edges/.test(el.ir ?? "");
  const pct = (n) => Math.round((n / total) * 100000) / 1000;
  /* A press's answer (a state's canvas, `__st`) plays once from the press and holds its last picture, as the device's "still an egg." comes and goes once; the page's own loops. */
  const once = !!el.__st;
  const still = !!el.__still;
  let at = 0;
  const keys = [], uses = [];
  f.steps.forEach(([frame, d], i) => {
    const a = pct(at), b = pct(at + d);
    at += d;
    const last = once && i === f.steps.length - 1;
    if (!still) keys.push(`@keyframes s${i}{0%{opacity:0}${a > 0 ? `${a}%{opacity:0}` : ""}${a}%{opacity:1}${last ? "" : `${b}%{opacity:0}`}100%{opacity:${last ? 1 : 0}}}`);
    uses.push(`<use href="#f${frame}"${still ? ` data-ms="${Math.round(d)}"` : ""} style="opacity:${i === 0 ? 1 : 0}${still ? "" : `;animation:s${i} ${Math.round(total)}ms step-end ${once ? "1 forwards" : "infinite"}`}"/>`);
  });
  const frames = f.frames.map((u, i) => `<image id="f${i}" href="${u}" width="${W}" height="${H}" preserveAspectRatio="none"${square ? ` style="image-rendering:pixelated" image-rendering="optimizeSpeed"` : ""}/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${still ? "" : `<style>${keys.join("")}</style>`}<defs>${frames}</defs>${uses.join("")}</svg>`;
}
/**
 * A CANVAS THAT FOLLOWS THE SCROLL, AS ONE STRIP (capture-route.mjs
 * `sampleDepths`: sunkcoin.fun's sea and its minimap). The stills it showed
 * at each depth of the page, top first, laid one under another in one svg
 * the width of the canvas and `bands` times its height: a board with no
 * window shows the strip whole where the layer is stretched over the page
 * (the sea at every depth, in order), and the Preview and the published
 * page show the band for where the scroll is (`scroll-depths`). The top band
 * keeps the flipbook the canvas played at rest, so the water still moves
 * where the page opens. `picture.depths` says how many bands, how tall
 * each is, and the scroll each was read at.
 */
function depthStripOf(el) {
  const d = el.depths;
  const W = Math.max(1, el.w), H = Math.max(1, el.h);
  const square = /pixelated|crisp-edges/.test(el.ir ?? "");
  const img = (href, id, y) => `<image${id ? ` id="${id}"` : ""} href="${href}" x="0" y="${y}" width="${W}" height="${H}" preserveAspectRatio="none"${square ? ` style="image-rendering:pixelated" image-rendering="optimizeSpeed"` : ""}/>`;
  const parts = [];
  let top = "";
  const f = el.frames;
  if (f?.frames?.length > 1 && !el.world?.stage) {
    const total = f.steps.reduce((n, [, t]) => n + t, 0);
    if (total > 0) {
      const pct = (n) => Math.round((n / total) * 100000) / 1000;
      let at = 0;
      const keys = [], uses = [];
      f.steps.forEach(([frame, t], i) => {
        const a = pct(at), b = pct(at + t);
        at += t;
        keys.push(`@keyframes s${i}{0%{opacity:0}${a > 0 ? `${a}%{opacity:0}` : ""}${a}%{opacity:1}${b}%{opacity:0}100%{opacity:0}}`);
        uses.push(`<use href="#f${frame}" style="opacity:${i === 0 ? 1 : 0};animation:s${i} ${Math.round(total)}ms step-end infinite"/>`);
      });
      top = `<style>${keys.join("")}</style><defs>${f.frames.map((u, i) => img(u, `f${i}`, 0)).join("")}</defs>${uses.join("")}`;
    }
  }
  if (!top) top = img(d.stills[0], null, 0);
  parts.push(top);
  d.stills.slice(1).forEach((u, i) => parts.push(img(u, null, (i + 1) * H)));
  const bands = d.stills.length;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H * bands}" viewBox="0 0 ${W} ${H * bands}">${parts.join("")}</svg>`, depths: { bands, band: H, at: d.at } };
}
function pictureOfCanvas(el) {
  if (el.depths?.stills?.length > 1) {
    const { svg, depths } = depthStripOf(el);
    const bytes = Buffer.from(svg);
    const key = `canvas-depths:${createHash("sha1").update(bytes).digest("hex")}`;
    const got = pictures.get(key) ?? pictureOf(key, "canvas-depths.svg", bytes);
    return got ? { ...got, record: { ...got.record, depths } } : null;
  }
  /* A world drawn again live (worlds.mjs `stage`) keeps the still it showed: the engine does the moving. */
  if (el.frames?.frames?.length > 1 && !el.world?.stage) {
    const svg = flipbookOf(el);
    if (svg) {
      const bytes = Buffer.from(svg);
      const key = `canvas-frames:${createHash("sha1").update(bytes).digest("hex")}`;
      return pictures.get(key) ?? pictureOf(key, "canvas-frames.svg", bytes);
    }
  }
  const bytes = Buffer.from(String(el.drawn).split(",")[1] ?? "", "base64");
  const key = `canvas:${createHash("sha1").update(bytes).digest("hex")}`;
  return pictures.get(key) ?? pictureOf(key, /^data:image\/webp/.test(String(el.drawn)) ? "canvas.webp" : "canvas.png", bytes);
}
/*
 * A CANVAS WORLD (worlds.mjs, check-worlds.mjs): the characters the page
 * drew on it, each with where it stands in every frame of the flipbook (as
 * fractions of the canvas box, so it follows the picture wherever it is
 * drawn) and what pressing it opens: a dialog, as its markup dressed in the
 * page's own look, or an address. Only the look the dialogs use is carried.
 * An address on the site's own host is kept as its path, as a page link is;
 * one off the site is kept as `offsite`, never as a link.
 */
function worldOf(el, sel, pageUrl) {
  const w = el.world;
  const host = (() => { try { return new URL(pageUrl).host; } catch { return ""; } })();
  const hrefOf = (u) => { try { const a = new URL(u, pageUrl); return a.host === host ? `${a.pathname}${a.search}${a.hash}` : a.href; } catch { return u; } };
  const used = new Set();
  /* A look is worn by a class, or named in what a press changes (`data-world-change`). */
  for (const d of w.dialogs ?? []) for (const m of d.html.matchAll(/\bsw[0-9a-z]+\b/g)) used.add(m[0]);
  const css = Object.fromEntries(Object.entries(w.css ?? {}).filter(([c]) => used.has(c)));
  /* A character that led within the site is a link to that path; one that led off it is a press that does nothing, the address kept for a backend. */
  /* In a sprite world, what the engine needs of each: its scene, sprite, home, range, foot, pace, the host it rides, its label (stage.mjs). */
  const STAGED = ["scene", "sprite", "face", "at", "range", "foot", "speed", "rides", "ride", "label"];
  const chars = (w.chars ?? []).map((c) => { const to = c.href ? hrefOf(c.href) : null; return { key: c.key, ...(c.name ? { name: c.name } : {}), boxes: c.boxes, ...(Number.isInteger(c.dialog) ? { dialog: c.dialog } : {}), ...(to ? (to.startsWith("/") ? { href: to } : { offsite: to }) : {}), ...Object.fromEntries(STAGED.filter((k) => c[k] !== undefined).map((k) => [k, c[k]])) }; });
  const frames = w.frames ?? 0;
  note(sel, "world", "field", `node.world: ${chars.length} characters to press over ${frames} frames of ${w.every}ms, ${chars.filter((c) => c.href).length} of them links within the site, ${chars.filter((c) => c.offsite).length} off it, ${(w.dialogs ?? []).length} dialogs dressed in ${Object.keys(css).length} looks`);
  if (w.stage) note(sel, "stage", "field", `node.world.stage: drawn again live from ${w.stage.scenes.length} scene${w.stage.scenes.length === 1 ? "" : "s"}, ${Object.keys(w.stage.sprites).length} sprites, ${w.stage.images.length} pictures, the page's scale at ${(w.stage.scaleAt ?? []).length} widths`);
  return { every: w.every, frames, chars, dialogs: (w.dialogs ?? []).map((d) => ({ html: d.html, ...(d.backdrop ? { backdrop: d.backdrop } : {}) })), css, ...(w.stage ? { stage: w.stage } : {}) };
}
/*
 * A VIDEO'S OWN FILE (capture-route.mjs downloaded it beside the pictures):
 * written into the site's pictures folder and named as a picture record in
 * node.media.file, so polio brings it in and publishes it as it does a
 * picture, and the page plays it from itself (check-media.mjs (4)).
 */
const VIDEO_TYPES = { mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/quicktime", ogv: "video/ogg", ogg: "video/ogg" };
const videoFiles = new Map();
function videoFileOf(el) {
  const name = el.video?.file;
  if (!name || !assetsDir) return null;
  if (videoFiles.has(name)) return videoFiles.get(name);
  const from = join(assetsDir, name);
  if (!existsSync(from)) { videoFiles.set(name, null); return null; }
  const bytes = readFileSync(from);
  const ext = name.split(".").pop().toLowerCase();
  const id = `vid_${createHash("sha1").update(bytes).digest("hex").slice(0, 8)}`;
  const path = `assets/pictures/${id}.${ext}`;
  mkdirSync(join(outDir, "assets", "pictures"), { recursive: true });
  writeFileSync(join(outDir, path), bytes);
  const rec = { id, path, type: VIDEO_TYPES[ext] ?? "video/mp4", w: Math.round(el.w), h: Math.round(el.h), bytes: bytes.length, alt: "", from: "upload" };
  videoFiles.set(name, rec);
  return rec;
}
function pictureOf(src, name, bytes) {
  const size = imageSize(bytes) ?? pngSize(bytes);
  if (!size) return null;
  const id = `pic_${createHash("sha1").update(src).digest("hex").slice(0, 8)}`;
  const path = `assets/pictures/${id}.${size.ext ?? "png"}`;
  mkdirSync(join(outDir, "assets", "pictures"), { recursive: true });
  writeFileSync(join(outDir, path), bytes);
  // `from` names where a picture came from and knows two answers, chosen from a machine or drawn; a copied site's pictures are kept as "upload" (FromASite.tsx), so this is too.
  const record = { id, path, type: size.type ?? "image/png", w: size.w, h: size.h, bytes: bytes.length, alt: "", from: "upload" };
  const got = { record, name, size, bytes: bytes.length };
  pictures.set(src, got);
  return got;
}

/* ------------------------------------------------------------------ */
/* Readings: the typed fields a captured element gives a node           */
/* ------------------------------------------------------------------ */

/** "1.11111px solid rgb(45, 55, 72)" → its three parts, the width as measured. */
function borderOf(s) {
  const m = /^([\d.]+)px\s+(\w+)\s+(.+)$/.exec(s ?? "");
  return m ? { width: Number(m[1]), style: m[2], colour: m[3].trim() } : null;
}

/** The type, as a part's own override (recreate.ts#fontFrom), scaled to the part that draws it. */
function fontOf(el, featureId, exact = false) {
  const f = {};
  const fam = familyOf(el.ff ?? "");
  if (fam) f.family = fam;
  const face = (el.ff ?? "").trim().replace(/^["']|["']$/g, "");
  if (face && !GENERIC.test(face)) f.face = face;
  /* A capture taken since boxes are measured untransformed keeps the size exactly, and in px: rounded to two places of a rem, 30px set at 29.95 and "Renewed for S2" stopped wrapping. */
  if (el.fs > 0) f.size = exact ? el.fs / BASE_PX / (PART_SCALE[featureId] ?? 1) : round2(el.fs / BASE_PX / (PART_SCALE[featureId] ?? 1));
  if (exact && el.fs > 0) f.px = el.fs;
  if (exact && el.ffs) f.stack = el.ffs;
  /* Set with the window (`fsu`: the title's clamp): the size as written, beside the px it measured. */
  if (exact && el.fsu) f.fluid = el.fsu;
  const weight = Number(el.fw);
  if (weight) f.weight = weight;
  /* Slanted (an <em>): read by `runOf` when the element folds into its sentence as a run. */
  if (el.fst === "italic") f.italic = true;
  if (el.ls && el.ls !== "normal" && el.fs > 0) {
    const em = Math.round(((parseFloat(el.ls) || 0) / el.fs) * 1000) / 1000;
    if (Math.abs(em) > 0.005) f.spacing = em;
  }
  if (el.lh > 0 && el.fs > 0) f.leading = round2(el.lh / el.fs);
  /* Its face's axes as the page set them (`font-variation-settings`, check-font-variation.mjs). */
  if (el.fvs) f.variation = el.fvs;
  /*
   * A LINE SET AT `line-height: normal` IS AS TALL AS THE PAGE DREW IT. The
   * dump reads no number for `normal`, so the part fell to the theme's own
   * leading: share.xyz's banner "and" (44px Inter, drawn 54px tall) was set
   * on a 68px line, its words 7px low. One line of its own words (`tb`, one
   * line tall) gives the face's normal line as it was drawn.
   */
  else if (el.nlh > 0 && el.fs > 0) f.leading = round2(el.nlh / el.fs);
  else if (el.fs > 0 && el.tb && el.tb[3] > 0 && el.tb[3] < el.fs * 1.9) f.leading = round2(el.tb[3] / el.fs);
  /*
   * AND IT IS SAID TO BE `normal`, the number kept beside it as the line this
   * machine drew. A normal line is the reader's own face's: the same Archivo
   * Black draws "100%" at 30px in a 40px line on Windows and 32 on the
   * capture's Linux, so the number alone froze the capture machine's line
   * into every board (thesolface's sections 6px short each on J's). The
   * Builder draws these at `normal` (theme.ts#lineOf).
   */
  if (!(el.lh > 0) && el.fs > 0) f.leadingNormal = true;
  /*
   * A LINE TALLER THAN THE BOX THE PAGE SET IT IN. thesolface's ✳ is a 38px
   * square (grid, centred, a 1px border) holding a 39.1px line: the page fixed
   * the square and let the line run past it. A flex or grid box laid out by
   * its contents is never shorter inside than its line, so one that is was
   * sized by the page. Drawn at its own line, the square grew to 41 and moved
   * the page down by 3. Its words go on a line as tall as its inside, centred
   * as before (check-line-in-box.mjs). A transformed box's height is its
   * turned outline, so it is left alone. A line at `normal` is the line this
   * machine drew (#community's 𝕏, 36 in a 25px inside, drew 39 at `normal`):
   * fitted, it is set as a number, since the reader's face would overflow too.
   */
  const drawn = el.lh > 0 ? el.lh : (f.leading ?? 0) * (el.fs ?? 0);
  if (f.leading && drawn > 0 && el.fs > 0 && el.h > 0 && /^(flex|grid)$/.test(el.disp ?? "") && !el.tf && !el.ptf) {
    const edge = borderOf(el.border)?.width ?? 0;
    const inside = el.h - (el.pad?.[0] ?? 0) - (el.pad?.[2] ?? 0) - 2 * edge;
    if (inside > 0 && drawn > inside + 0.5) { f.leading = Math.floor((inside / el.fs) * 100) / 100; delete f.leadingNormal; }
  }
  return f;
}

const DEFAULT_OF = {
  ls: (v) => v === "normal",
  tt: (v) => v === "none",
  ta: (v) => v === "start",
  minh: (v) => v === "auto",
  maxw: (v) => v === "none" || v === "100%",
  gap: (v) => v === "normal",
  just: (v) => v === "normal",
  align: (v) => v === "normal",
  items: (v) => v === "normal" || v === "legacy" || v === "stretch",
  wrap: (v) => v === "nowrap",
  z: (v) => v === "auto",
};

/**
 * The layout the capture recorded, as `NodeLayout` (parts/theme.ts).
 * Only what the page said: `disp` is written when it was flex or grid (a
 * block says nothing a box does not); `dir` when it was recorded; `gap`,
 * `just`, `align` when not their `normal` default; `wrap` when it wraps;
 * `cols` as the count of tracks the grid was measured with.
 */
function layoutOf(el) {
  const l = {};
  if (el.disp && DISPLAYS.has(el.disp) && el.disp !== "block") l.display = el.disp;
  if (el.dir && DIRECTIONS.has(el.dir)) l.direction = el.dir;
  if (el.align && !DEFAULT_OF.align(el.align)) l.align = el.align;
  if (el.just && !DEFAULT_OF.just(el.just)) l.justify = el.just;
  /* A grid's `justify-items` (`place-items: center`): the step's emoji sits in the middle of its circle across as well as down. */
  if (el.items && el.disp === "grid" && !DEFAULT_OF.items(el.items)) l.items = el.items;
  if (el.gap && !DEFAULT_OF.gap(el.gap)) { const px = parseFloat(el.gap); if (Number.isFinite(px)) l.gap = px; }
  if (el.wrap && !DEFAULT_OF.wrap(el.wrap)) l.wrap = true;
  if (el.cols && el.disp === "grid") { const n = el.cols.trim().split(/\s+/).length; if (n > 0) l.columns = n; }
  return Object.keys(l).length ? l : null;
}
/** `pad: [top, right, bottom, left]` → `NodePad`. */
const padOf = (el) => (Array.isArray(el.pad) && el.pad.length === 4 ? { top: el.pad[0], right: el.pad[1], bottom: el.pad[2], left: el.pad[3] } : null);
/** The border as measured → `NodeEdge`: the width unrounded, the style as said, the colour as said. */
/** A sticky element's inset, the sides that are set, in px. */
function insetOf(ins) {
  const out = {};
  for (const [i, side] of ["top", "right", "bottom", "left"].entries()) {
    const n = parseFloat(ins?.[i]);
    if (Number.isFinite(n)) out[side] = n;
  }
  return out;
}
function edgeOf(border) {
  if (!border) return null;
  const e = { width: border.width };
  if (EDGE_STYLES.has(border.style)) e.style = border.style;
  if (PARSEABLE.test(border.colour)) e.colour = border.colour;
  return e;
}
/** How far a box-shadow reaches past the box on each side, [top, right, bottom, left], outer shadows only. */
function shadowReach(v) {
  const out = [0, 0, 0, 0];
  if (!v || v === "none") return out;
  const parts = []; let depth = 0, cur = "";
  for (const ch of v) { if (ch === "(") depth++; else if (ch === ")") depth--; if (ch === "," && !depth) { parts.push(cur); cur = ""; } else cur += ch; }
  parts.push(cur);
  for (const p of parts) {
    if (/\binset\b/.test(p)) continue;
    const n = (p.replace(/\w+\([^)]*\)/g, " ").match(/-?[\d.]+px/g) ?? []).map(parseFloat);
    const [ox = 0, oy = 0, blur = 0, spread = 0] = n;
    const g = blur + spread;
    out[0] = Math.max(out[0], g - oy); out[1] = Math.max(out[1], g + ox); out[2] = Math.max(out[2], g + oy); out[3] = Math.max(out[3], g - ox);
  }
  return out.map((x) => Math.max(0, Math.ceil(x)));
}
/** `ta`, `tt`, `tw` → `NodeText`, when not their defaults. */
function textOf(el) {
  const x = {};
  if (el.ta && !DEFAULT_OF.ta(el.ta) && TEXT_ALIGNS.has(el.ta)) x.align = el.ta;
  if (el.tt && !DEFAULT_OF.tt(el.tt) && TEXT_TRANSFORMS.has(el.tt)) x.transform = el.tt;
  if (el.tw === "balance" || el.tw === "pretty") x.wrap = el.tw;
  return Object.keys(x).length ? x : null;
}

/**
 * An icon's strokes as `DrawnVector` (vector.ts): the svg's viewBox and
 * each stroke's `d` as captured, with `share` — how much of the icon's box
 * the stroke covers — from the stroke's own measured box against the
 * svg's, floored for a thin line the way `readVector` floors it, so no
 * stroke is dropped as noise. `from` says it was captured, not drawn.
 */
function vectorOf(el, strokes, exact = false) {
  if (!el.vb) return null;
  const area = Math.max(1, el.w * el.h);
  const side = Math.max(1, el.w, el.h);
  const paths = strokes.filter((s) => s.d).map((s) => {
    const span = Math.max(s.w, s.h) / side;
    return { d: s.d, share: Math.min(1, Math.max((s.w * s.h) / area, span * span * 0.25)) };
  });
  if (!paths.length) return null;
  /*
   * How its lines are drawn, when not the drawn icon's own (2 wide, round):
   * a 3-wide square-capped menu stays a drawn icon the Builder can recolour,
   * drawn at its width and caps (check-svg-paint.mjs (3)). Only when every
   * outline agrees, and in a capture taken since boxes are measured
   * untransformed (SOLCINERATOR converts byte for byte).
   */
  const lines = strokes.filter((s) => s.d && !isNone(s.stroke));
  const agree = (f) => (lines.length && lines.every((s) => f(s) === f(lines[0])) ? f(lines[0]) : undefined);
  const width = agree((s) => s.sw), cap = agree((s) => s.cap ?? "butt"), join = agree((s) => s.join ?? "miter");
  const stroke = exact && lines.length && width !== undefined && (Math.abs(width - 2) > 0.01 || cap !== "round" || join !== "round") ? { width, cap, join } : null;
  return { viewBox: el.vb, paths, from: "captured", ...(stroke ? { stroke } : {}), ...(exact && el.crisp ? { crisp: true } : {}) };
}

/* ------------------------------------------------------------------ */
/* Links                                                                */
/* ------------------------------------------------------------------ */

const site = new URL(routes.site);
const pageByRoute = new Map(routes.pages.filter((p) => !p.click).map((p) => [p.route, p.id]));
/** The template a path is a page of, and the page it was captured as. */
const TEMPLATES = [
  ...(routes.templates ?? []).map((t) => ({ pattern: t.pattern, page: t.representative })),
  ...(routes.crawl?.patterns ?? []).map((t) => ({ pattern: t.pattern, page: routes.pages.find((x) => x.pattern === t.pattern)?.id ?? null })),
].filter((t) => t.page).map((t) => ({ ...t, re: new RegExp(`^${t.pattern.split("/").map((seg) => (seg === ":id" ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/")}/?$`) }));
function templateOf(path) { return TEMPLATES.find((t) => t.re.test(path)) ?? null; }
/** An href → where it goes in the document: a page, an address, or nowhere. */
function linkOf(href, pageUrl) {
  if (!href) return { link: null, how: null };
  if (href.trim() === "#" || href.trim() === "") return { link: null, how: "an anchor on the page itself; it goes nowhere" };
  let u;
  try { u = new URL(href, pageUrl); } catch { return { link: null, how: "not an address" }; }
  /* An anchor on this page (`#lore`, or this page's own address with one): the part that is that element, settled once every part has its id. */
  const on = new URL(pageUrl);
  if (u.hash.length > 1 && u.host === on.host && u.pathname === on.pathname && u.search === on.search) {
    const id = decodeURIComponent(u.hash.slice(1));
    return { link: { kind: "node", target: `#${id}` }, anchor: id, how: `link (node): #${id}, an anchor on this page` };
  }
  /* A page of a template taken once (routes.json `templates`, a crawl's `patterns`): its representative page, whichever id it names. */
  if (u.host === site.host && !pageByRoute.has(u.pathname)) {
    const t = templateOf(u.pathname);
    if (t) return { link: { kind: "page", target: t.page }, how: `link (page ${t.page}): ${u.pathname} is a page of ${t.pattern}, captured once as that page` };
  }
  if (u.host === site.host && pageByRoute.has(u.pathname)) {
    const id = pageByRoute.get(u.pathname);
    return { link: { kind: "page", target: id }, how: `link (page ${id}): ${u.pathname} is a route of the site, captured as a page of the document` };
  }
  if (u.host === site.host) return { link: { kind: "url", target: u.toString() }, how: `link (url): ${u.pathname} is on the site but not a route in its source, so the address is kept` };
  return { link: { kind: "url", target: u.toString() }, how: "link (url): an address off the site" };
}

/* ------------------------------------------------------------------ */
/* One capture → its page's nodes                                       */
/* ------------------------------------------------------------------ */

const STROKE_TAGS = new Set(["path", "polyline", "polygon", "line", "circle", "ellipse", "rect", "g", "use"]);
const TEXT_PROPS = ["color", "fs", "fw", "ff", "lh", "ls", "ta", "tt"];
const LAYOUT_PROPS = ["disp", "dir", "gap", "just", "align", "items", "wrap", "cols"];
const LAYOUT_FIELD = { disp: "display", dir: "direction", gap: "gap", just: "justify", align: "align", items: "items", wrap: "wrap", cols: "columns" };
const FEATURE = { icon: "drawn-icon", "icon-blind": "box", picture: "picture", heading: "value-prop", button: "cta-primary", words: "prose", box: "box", embed: "box" };

const embedHost = (u) => { try { return new URL(u).hostname || "no address"; } catch { return "no address"; } };

/** The artistic properties, as the browser computed them, for the importer to read. */
/*
 * THE TRANSFORM, ABOUT THE PART'S OWN CENTRE. A capture taken since boxes
 * were measured untransformed (dump.mjs: `untransformed`) carries `ptf`,
 * everything that moves the element — its own transform and its ancestors' —
 * as one page-space matrix. polio turns a part about its centre, so the
 * matrix is written about the centre of the part's box: a rotated ribbon
 * and the words on it turn together, about the ribbon's middle. A capture
 * taken before carries the element's own transform as it was (`tf`).
 */
/*
 * EXCEPT WHAT ANIMATES A TURN. A keyframe `rotate(-24deg)` turns the element
 * about its own `transform-origin` (trumpmorty's antenna rods: `bottom
 * center`), and about the centre it swung the rods through each other. So an
 * element that runs an animation, and one that moves only because an
 * ancestor does (the red ball, the rod's `::after`), is written about that
 * point, `pivot`, px from its box's top left, and carries it as `art.origin`.
 */
function transformOf(el, untransformed) {
  if (!untransformed) return el.tf ?? null;
  if (!el.ptf) return null;
  const [a, b, c, d, e, f] = el.ptf;
  const cx = el.x + (el.pivot ? el.pivot[0] : el.w / 2), cy = el.y + (el.pivot ? el.pivot[1] : el.h / 2);
  const tx = round2(a * cx + c * cy + e - cx), ty = round2(b * cx + d * cy + f - cy);
  if (a === 1 && b === 0 && c === 0 && d === 1 && Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5) return null;
  return `matrix(${a}, ${b}, ${c}, ${d}, ${tx}, ${ty})`;
}
/*
 * WHAT AN ANIMATION REPLACES, AND WHAT IT MUST KEEP (J, 2026-10-11, sunkcoin
 * .fun's "scroll to dive" arrow). The arrow is `rotate(45deg)` inside a cue
 * placed `left: 50%; transform: translateX(-50%)`, nudged by a keyframe that
 * writes `transform: rotate(45deg) translate(4px, 4px)` at 50%. The part's
 * transform is everything that moves it, the cue's shift included; the
 * keyframe replaces the whole of it, so at 50% the arrow jumped 62px to the
 * right and back every 1.2s. A keyframe replaces the element's own
 * transform and nothing of its ancestors': so an animated element whose
 * ancestors move it carries that part, `base`, on each of its animations
 * (about the same point as art.transform), and polio composes every
 * transform frame on it (capturedMotion.ts). `check-animation-base.mjs`.
 */
function animationBaseOf(el) {
  if (!el.ptf || !el.anim) return null;
  const ownM = /^matrix\(([^)]+)\)$/.exec(el.tf ?? "");
  const o = ownM ? ownM[1].split(",").map(Number) : [1, 0, 0, 1, 0, 0];
  if (o.length !== 6 || o.some((n) => !Number.isFinite(n))) return null;
  const [a, b, c, d, e, f] = el.ptf;
  const cx = el.x + (el.pivot ? el.pivot[0] : el.w / 2), cy = el.y + (el.pivot ? el.pivot[1] : el.h / 2);
  /* Its own transform as the page applied it: about its transform-origin (`pivot`, the animation's point), in page space. */
  const origin = /^(-?[\d.]+)px (-?[\d.]+)px/.exec(el.tfo ?? "");
  const ox = el.x + (origin ? Number(origin[1]) : el.w / 2), oy = el.y + (origin ? Number(origin[2]) : el.h / 2);
  const own = [o[0], o[1], o[2], o[3], ox - o[0] * ox - o[2] * oy + o[4], oy - o[1] * ox - o[3] * oy + o[5]];
  const k = own[0] * own[3] - own[1] * own[2] || 1;
  const inv = [own[3] / k, -own[1] / k, -own[2] / k, own[0] / k, (own[2] * own[5] - own[3] * own[4]) / k, (own[1] * own[4] - own[0] * own[5]) / k];
  /* ptf × own⁻¹: the ancestors' part alone. */
  const [A, B, C, D, E, F] = [a * inv[0] + c * inv[1], b * inv[0] + d * inv[1], a * inv[2] + c * inv[3], b * inv[2] + d * inv[3], a * inv[4] + c * inv[5] + e, b * inv[4] + d * inv[5] + f];
  const tx = round2(A * cx + C * cy + E - cx), ty = round2(B * cx + D * cy + F - cy);
  const r4 = (n) => Math.round(n * 10000) / 10000;
  if (Math.abs(A - 1) < 1e-4 && Math.abs(B) < 1e-4 && Math.abs(C) < 1e-4 && Math.abs(D - 1) < 1e-4 && Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5) return null;
  return `matrix(${r4(A)}, ${r4(B)}, ${r4(C)}, ${r4(D)}, ${tx}, ${ty})`;
}
/* A background taken as the box's picture still travels whole when gradients are layered with it (thesolface's hero laid a dark fade over its splash): the Builder draws the stack with the picture's own file in place of its address (theme.ts#layeredPicture). */
/* The layer taken as the box's picture names the stored file, never the page's address: a published copy draws its own picture, and nothing fetches from the site it came from (the first url() that is not data, as the picture was chosen). */
function storedStack(bgi, picture) {
  let done = false;
  return bgi.replace(/url\((["']?)([^)"']+)\1\)/g, (m, _q, u) => (done || /^data:/.test(u) ? m : ((done = true), `url("${picture.path}")`)));
}
function artOf(el, picture, untransformed = false) {
  const tf = transformOf(el, untransformed);
  const art = { ...(el.blend ? { blend: el.blend } : {}), ...(el.filter ? { filter: el.filter } : {}), ...(el.bfilter ? { backdrop: el.bfilter } : {}), ...(el.clip ? { clipPath: el.clip } : el.clipIn ? { clipPath: el.clipIn } : {}), ...(tf ? { transform: tf } : {}), ...(el.turnsWith && untransformed ? { turnsWith: el.turnsWith } : {}), ...(el.pivot && untransformed ? { origin: `${round2(el.pivot[0])}px ${round2(el.pivot[1])}px` } : {}), ...(el.anim ? { animation: el.anim } : {}), ...(el.mask ? { mask: el.mask[0], maskOptions: el.mask.slice(1) } : {}), ...(el.ov && el.kind === "box" ? { overflow: el.ov.x === el.ov.y ? el.ov.x : `${el.ov.x} ${el.ov.y}` } : {}), ...(el.tsh ? { textShadow: el.tsh } : {}), ...(el.tstroke ? { textStroke: el.tstroke } : {}), ...(el.porder ? { paintOrder: el.porder } : {}), ...(el.bgi && (!picture || /gradient\(/.test(el.bgi)) ? { background: picture ? storedStack(el.bgi, picture) : el.bgi, ...(el.bgo ? { backgroundOptions: el.bgo } : {}), ...(el.bgclip ? { backgroundClip: el.bgclip } : {}) } : {}), ...(el.letterTf ? { letterTransform: el.letterTf } : {}) };
  return Object.keys(art).length ? { art } : {};
}

function convert(pageDef, cap) {
  notePage = pageDef.id;
  const PAGE_ID = pageDef.id;
  const page = { w: cap.page[0], h: cap.page[1] };
  const url = new URL(cap.url);
  const host = url.host;
  const at = Date.parse(cap.capturedAt);

  /** A selector the element can be found again by, as siteRead.ts#path writes one. */
  function selectorOf(el) {
    if (el.t === "body") return "body";
    /* A pseudo-element is its element's, named as CSS names it: `… > article::before`. */
    if (el.pseudo) return `${selectorOf(el.parent)}${el.t}`;
    const bits = [];
    let node = el;
    while (node && node.t !== "body") {
      const parent = node.parent;
      const same = parent.kids.filter((c) => c.t === node.t);
      bits.unshift(same.length > 1 ? `${node.t}:nth-of-type(${same.indexOf(node) + 1})` : node.t);
      node = parent;
    }
    return `body > ${bits.join(" > ")}`;
  }

  /* A layer's written placement, its containing block found `up` levels above it in the tree. */
  const unitsOf = (el) => {
    const { of, ...au } = el.au;
    if (of.by !== "block") return { ...au, of };
    let cb = el;
    for (let i = 0; i < of.up && cb; i++) cb = cb.parent;
    return { ...au, of: { by: "block", selector: cb?.sel ?? null, box: of.box, el: cb ?? null } };
  };
  const all = [];
  const anchors = [];
  (function walk(el, parent, depth) {
    el.parent = parent;
    el.depth = depth;
    /* A layer that paints nothing is not kept: a film-grain sheet at 5% opacity, a toast at 0 until shown, an inert cover with nothing in it. Kept, a fixed one would pin everything under it. */
    const [vw, vh] = cap.viewport ?? [Infinity, Infinity];
    /* Where it is shown: its box, or, when its box was measured untransformed, the box round where its transform puts it (a toast held 220px below the window until shown). */
    const shown = (k) => {
      if (!k.ptf) return k;
      const [a, b, c, d, e, f] = k.ptf;
      const pts = [[k.x, k.y], [k.x + k.w, k.y], [k.x, k.y + k.h], [k.x + k.w, k.y + k.h]].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    };
    const offscreenFixed = (k0) => { const k = shown(k0); return k0.pos === "fixed" && (k.y >= vh || k.x >= vw || k.y + k.h <= 0 || k.x + k.w <= 0); };
    /* A faint sheet with a picture of its own (trumpmorty's fixed grain, 5% multiply) is the page's texture: kept, in a capture taken since, as a fixed part that takes no clicks. */
    const faint = (k) => k.op !== undefined && k.op !== null && k.op <= 0.05 && !(cap.untransformed && k.op > 0 && /url\(/.test(k.bgi ?? ""));
    /* A shadow is paint too: a screen's vignette is an inset shadow on a layer that takes no clicks and draws nothing else (`check-overlays.mjs`). */
    const shades = (k) => cap.untransformed && !!k.shadow;
    el.kids = (el.kids ?? []).filter((k) => !(faint(k) || (k.inert && !k.text && !(k.kids ?? []).length && !k.bg && !k.src && !k.bgi && !k.d && !shades(k)) || (k.inert && offscreenFixed(k))));
    all.push(el);
    for (const k of el.kids) walk(k, el, depth + 1);
  })(cap.tree, null, 0);
  all.forEach((el, i) => { el.sel = selectorOf(el); el.order = i; });

  const isPageBox = (el) => el.x === 0 && el.y === 0 && el.w === page.w && Math.abs(el.h - page.h) <= 1;
  const within = (el, tag) => { for (let n = el.parent; n; n = n.parent) if (n.t === tag) return true; return false; };
  const wordsWithin = (el) => { const out = []; (function g(n) { if (n.text) out.push(n.text.trim()); for (const k of n.kids) g(k); })(el); return out.join(" ").replace(/\s+/g, " ").trim(); };

  /** What each element becomes. Declared, in order, most particular first. */
  /**
   * What each element becomes. The role first, where the tree computed
   * one; the shape only where it did not. A role the library has no part
   * for keeps the shape's part and carries the role beside it.
   */
  /*
   * WHAT A BUTTON FOLDS IS WHAT LOOKS LIKE IT. A button's words in a child
   * span are the button's own, folded into it — when the children holding
   * words look alike and paint nothing of their own. trumpmorty.fun's `.ca`
   * is three spans in three sets of clothes ("CA" on yellow, the address in
   * mono on dark, "COPY" on teal behind an edge): folded, they were one run
   * in one colour, dark on dark. And a remote key `<a><small>00</small>HOME</a>`
   * set its `<small>` in another face and size: folded under the key's own
   * words, it was dropped. So children that differ from each other, or from
   * the button's own words, in colour, size, face or weight, or that paint a
   * fill, a picture, an edge or a shadow of their own, are not folded: each
   * is its own part at its own box, and a button whose words were all in
   * them is the box they sit in.
   */
  const foldable = (btn) => btn.kids.filter((k) => !k.pseudo && (k.text ?? "").trim() && !k.kids.length);
  const looks = (n) => JSON.stringify([n.color ?? null, n.fs ?? null, n.ff ?? null, n.fw ?? null]);
  function foldsApart(btn) {
    const ks = foldable(btn);
    if (!ks.length) return false;
    if (ks.some((k) => (k.bg && !isNone(k.bg)) || k.bgi || k.border || k.shadow)) return true;
    const kinds = new Set(ks.map(looks));
    if ((btn.text ?? "").trim()) kinds.add(looks(btn));
    return kinds.size > 1;
  }
  function classify(el) {
    if (el.t === "body") return "page";
    if (el.parent?.t === "body" && isPageBox(el)) return "page";
    /* A pseudo-element that draws (dump.mjs#pseudoOf): a box, or words when its content is words. */
    /* A box cut by a mask was kept as a picture of itself (dump.mjs#maskWhole): its colour through its shape, not a square of it. */
    if (el.masked && (el.svgFile || el.svgMarkup)) return "picture";
    if (el.pseudo) return (el.text ?? "").trim() ? "words" : "box";
    if (STROKE_TAGS.has(el.t) || (el.parent && el.parent.kind === "stroke")) return "stroke";
    /* An svg drawn through its <defs> was kept whole: a picture of itself. */
    if (el.t === "svg" && (el.svgFile || el.svgMarkup)) return "picture";
    if (el.t === "svg") { let d = false; (function g(n) { for (const k of n.kids) { if (k.d) d = true; g(k); } })(el); return d && el.vb ? "icon" : "icon-blind"; }
    if (el.t === "img") return "picture";
    if (el.t === "canvas" && (el.drawn || el.frames)) return "picture";
    /* A video as it stands: its poster, else the frame it showed (its source and how it plays go in node.media). */
    if (el.t === "video" && (el.src || el.drawn)) return "picture";
    /* A frame of another page is an embed: what it loads, never a picture of it. */
    if (el.t === "iframe") return "embed";
    // A role of image on something that is not an <img> (a tag, a badge) holds no picture: its words are words, and with none it is a box.
    if (el.role === "image") return (el.text ?? "").trim() ? "words" : "box";
    const words = (el.text ?? "").trim();
    if (el.role === "heading" && words) return "heading";
    if (el.role === "paragraph" && words) return "words";
    // A button by role with words on it, its own or a child's: the button part, in the captured clothes (see the head of this file).
    if (el.role === "button" && wordsWithin(el)) return !words && foldsApart(el) ? "box" : "button";
    // The words a button holds in a child are the button's, the child folded into it — when the children look alike (above); else each is its own part.
    if (el.parent && el.parent.kind === "button" && words && !el.kids.length && !el.pseudo) return foldsApart(el.parent) ? "words" : "folded";
    if (words) {
      if (/^h[1-6]$/.test(el.t)) return "heading";
      if ((el.t === "button" || el.t === "a") && (el.bg || el.border)) return "button";
      return "words";
    }
    return "box";
  }
  /*
   * AN EMPTY FIELD SHOWS ITS PLACEHOLDER, FROM A CAPTURE TAKEN BEFORE THE DUMP
   * READ IT. The dump now writes what an empty field shows (its placeholder,
   * in the placeholder's own colour, `phShown`, check-search-box.mjs); a
   * capture taken before that holds the placeholder only as a name, and the
   * field came out blank (share.xyz's "Search Markets"). Converted again, it
   * shows it, set in the middle of a one-line field as the browser does, in
   * the browser's own placeholder colour (darkgray), since the page's was
   * never read; a retake reads it.
   */
  for (const el of all) {
    const texty = el.t === "textarea" || (el.t === "input" && /^(text|search|email|url|tel|number|password)$/i.test(el.type ?? "text"));
    if (!texty || !el.placeholder || el.value || (el.text ?? "").trim() || el.phShown) continue;
    el.text = el.placeholder; el.color = "rgb(169, 169, 169)"; el.phShown = true;
    if (el.t === "input") {
      const line = el.lh ?? (el.fs ?? 16) * 1.2, v = Math.max(0, Math.round((el.h - line) / 2)), pad = el.pad ?? [0, 0, 0, 0];
      el.pad = [v, pad[1], v, pad[3]];
    }
    note(el.sel, "placeholder", "field", `content “${el.placeholder}”: the empty field shows its placeholder, in the browser's own placeholder colour (the capture predates reading the page's)`);
  }
  for (const el of all) el.kind = classify(el);

  /*
   * A CSS MARQUEE IS THE BUILDER'S OWN MARQUEE (J, 2026-10-11, sunkcoin.fun's
   * ticker strip: "they also have their banner where ours doesnt"). The strip's
   * `.run` is a flex row of spans, `padding-left: 100%`, carried left by a
   * stylesheet animation, `translateX(-100%)` over 60s, forever, inside a box
   * that clips. Measured at rest its words all stood past the page's right
   * edge, wholly outside the box that clips them, so none became a part and
   * the strip came out an empty bar; and the row's own animation, run on each
   * part, would slide each by its own width. So an element run forever by a
   * keyframe that slides it across by its own width (`cap.keyframes`) is read
   * as a marquee: its words, one copy of them (the page repeats them to fill
   * the loop), are folded into it as runs with the gaps the row set, its
   * animation is taken off it, and `behaviours.loops` names it a marquee at
   * the page's own pace, so polio gives it the Marquee feature
   * (captured.ts). `check-marquee-css.mjs`.
   */
  const keyframesByName = new Map((cap.keyframes ?? []).map((k) => [k.name, k]));
  const slideOf = (name) => {
    const rule = keyframesByName.get(name);
    let best = null;
    for (const f of rule?.frames ?? []) {
      const m = /translate(?:X|3d)?\(\s*(-?[\d.]+)(%|px)/.exec(f.style?.transform ?? "");
      if (m && (!best || Math.abs(Number(m[1])) > Math.abs(best.n))) best = { n: Number(m[1]), unit: m[2] };
    }
    return best;
  };
  const msOf = (v) => { const m = /^(-?[\d.]+)(ms|s)$/.exec(String(v ?? "").trim()); return m ? Number(m[1]) * (m[2] === "s" ? 1000 : 1) : 0; };
  const wordsIn = (e) => [...(e.ot ?? []).map((r) => ({ x: r[1], text: r[0] })), ...(e.kids ?? []).filter((k) => !k.pseudo).map((k) => ({ x: k.x, kid: k }))].sort((a, b) => a.x - b.x).map((i) => (i.kid ? wordsIn(i.kid) : i.text)).join("") || (e.text ?? "");
  const runsOf = (e, colour) => {
    const items = [...(e.ot ?? []).map((r) => ({ x: r[1], text: r[0] })), ...(e.kids ?? []).filter((k) => !k.pseudo).map((k) => ({ x: k.x, kid: k }))].sort((a, b) => a.x - b.x);
    if (!items.length) return (e.text ?? "").trim() ? [{ text: e.text.trim(), ...(e.color && e.color !== colour ? { colour: e.color } : {}) }] : [];
    const each = items.map((i) => (i.kid ? runsOf(i.kid, colour) : (i.text ? [{ text: i.text, ...(e.color && e.color !== colour ? { colour: e.color } : {}) }] : []))).filter((r) => r.length);
    /* A flex row's gap stands between its items (mochi.trade's ticker: "MochiMan closed $Kimchi ▼6.9%", each a span in a row with an 8px gap; foldRuns). */
    const gap = /flex$/.test(e.disp ?? "") && !/column/.test(e.dir ?? "") ? parseFloat(e.gap) || 0 : 0;
    if (!gap) return each.flat();
    const side = gapSide(gap, e.fs ?? e.kids?.find((k) => k.fs)?.fs);
    return each.flatMap((r, i) => (i ? [{ text: " ", pad: [0, side, 0, side] }, ...r] : r));
  };
  for (const el of all) {
    const a = (el.motion?.animation ?? []).find((x) => x.iterations === "infinite" && slideOf(x.name));
    if (!a || el.kind === "page" || !el.kids?.length || el.w <= 0) continue;
    const slide = slideOf(a.name);
    const distance = slide.unit === "%" ? (slide.n / 100) * el.w : slide.n;
    const ms = msOf(a.duration);
    if (Math.abs(distance) < Math.max(200, el.w / 4) || ms <= 0) continue;
    const kids = el.kids.filter((k) => !k.pseudo && wordsIn(k).trim());
    if (!kids.length || kids.length !== el.kids.filter((k) => !k.pseudo).length) continue;
    const texts = kids.map((k) => wordsIn(k).trim());
    let copies = 1;
    for (let k = 8; k >= 2; k--) { const n = texts.length / k; if (Number.isInteger(n) && n > 0 && texts.every((t, i) => t === texts[i % n])) { copies = k; break; } }
    const one = kids.slice(0, texts.length / copies);
    const first = one[0];
    const gap = parseFloat(el.gap) || 0;
    const fs = first.fs || 0;
    const runs = [];
    one.forEach((k, i) => {
      if (i && gap > 0) runs.push({ text: " ", pad: [0, Math.max(0, Math.round(gap / 2 - fs * 0.3)), 0, Math.max(0, Math.round(gap / 2 - fs * 0.3))] });
      runs.push(...runsOf(k, first.color));
    });
    if (!runs.length) continue;
    /* The row wears its words' type: the spans carried it, the row itself none. */
    for (const prop of ["fs", "fw", "ff", "ffs", "lh", "ls", "ta", "tt", "color", "fst", "tsh"]) if (first[prop] !== undefined && el[prop] === undefined) el[prop] = first[prop];
    el.text = runs.map((r) => r.text).join("");
    el.kind = "words";
    /* Its entry from off the page (`padding-left: 100%`) is the loop's own; the part starts at its box. */
    if (Array.isArray(el.pad)) el.pad = [el.pad[0], el.pad[1], el.pad[2], 0];
    /* Only what the page shows of it: the box that clips it, else the page's width. */
    let clipper = el.parent;
    while (clipper && clipper.kind !== "page" && !(clipper.ov && clipper.ov.x !== "visible")) clipper = clipper.parent;
    const right = clipper && clipper.kind !== "page" ? clipper.ov.box[0] + clipper.ov.box[2] : page.w;
    if (el.x + el.w > right) el.w = Math.max(1, right - el.x);
    el.cssMarquee = { runs, speed: Math.round((Math.abs(distance) / ms) * 1000 * 10) / 10, direction: distance < 0 ? "left" : "right", copies, gap: Math.round(gap), name: a.name, width: Math.round(el.w), loopWidth: Math.round(el.w / copies) };
    el.motion = { ...el.motion, animation: el.motion.animation.filter((x) => x !== a) };
    if (!el.motion.animation.length) delete el.motion.animation;
    if (!Object.keys(el.motion).length) delete el.motion;
    if (el.anim === a.name) delete el.anim;
    (function mark(e) { for (const k of e.kids ?? []) { k.inMarquee = el; mark(k); } })(el);
    note(el.sel, "(marquee)", "field", `a stylesheet marquee (${a.name}, ${slide.n}${slide.unit} over ${ms}ms, forever): its ${kids.length} words folded in as ${runs.length} runs (${copies} cop${copies === 1 ? "y" : "ies"} of ${one.length}), its animation taken off, behaviours.loops names it a marquee at ${el.cssMarquee.speed}px/s ${el.cssMarquee.direction}`);
  }

  /*
   * WHAT ANIMATES TURNS ABOUT ITS OWN POINT, AND WHAT IT HOLDS TURNS WITH IT.
   * An element that runs an animation is written about its
   * `transform-origin` (`pivot`, transformOf). An element inside one, with no
   * animation or transform of its own, moved with it on the page and is its
   * own part here: it takes the same animation, about the same point (the
   * ancestor's origin, measured from its own box), so trumpmorty's red balls
   * stay on the tips of the rods they sit on, and sway with them.
   */
  const originOf = (el) => { const m = /^(-?[\d.]+)px (-?[\d.]+)px/.exec(el.tfo ?? ""); return m ? [Number(m[1]), Number(m[2])] : null; };
  if (cap.untransformed) for (const el of all) {
    if (el.anim && originOf(el)) { el.pivot = originOf(el); continue; }
    if (el.anim || el.tf || el.kind === "letter" || el.kind === "page") continue;
    let a = el.parent;
    while (a && a.kind !== "page" && !a.anim) a = a.parent;
    if (el.inMarquee) continue;
    const o = a?.anim ? originOf(a) : null;
    if (!o || !a.motion?.animation) continue;
    el.anim = a.anim;
    el.motion = { ...(el.motion ?? {}), animation: a.motion.animation };
    el.pivot = [a.x + o[0] - el.x, a.y + o[1] - el.y];
    note(el.sel, "(moves with)", "field", `motion.animation ${a.anim} about ${round2(el.pivot[0])}px ${round2(el.pivot[1])}px (art.origin): it moved with ${a.sel}, whose animation it runs about the same point`);
  }
  /*
   * WHAT TURNS ONLY BECAUSE WHAT HOLDS IT TURNS. trumpmorty's ribbon words
   * are a track inside a `rotate(-2.5deg)` row: the track's own transform is
   * the marquee's slide, and the tilt is the row's. Written flat, each part
   * turns about its own centre, which agrees at the capture's width and
   * drifts apart where the row is placed in shares of the window (the words
   * sat 12px off the band's middle at 2000). So such a part says which part
   * it turns with and its own transform (`art.turnsWith`): a page that can,
   * draws it inside that part's turned box (polio's export).
   */
  if (cap.untransformed) for (const el of all) {
    if (!el.ptf || el.anim || el.pivot || ["letter", "page", "folded", "stroke"].includes(el.kind)) continue;
    let a = el.parent;
    while (a && a.kind !== "page" && !a.tf) a = a.parent;
    if (!a || a.kind === "page" || !a.tf || a.anim || a.holder || ["letter", "folded", "stroke"].includes(a.kind)) continue;
    el.turnsWith = { selector: a.sel, ...(el.tf ? { own: el.tf, ...(el.tfo ? { origin: el.tfo } : {}) } : {}) };
    note(el.sel, "(turns with)", "field", `art.turnsWith ${a.sel}${el.tf ? `, its own transform ${el.tf}` : ""}: turned only by what holds it`);
  }
  for (const el of all) if (el.kind === "words" && el.parent && ["button", "box"].includes(el.parent.kind) && foldable(el.parent).includes(el) && foldsApart(el.parent)) note(el.sel, "(button)", "field", `its own part, not folded into the button (${el.parent.sel}): its words are set apart from their neighbours' in colour, size, face or weight, or it paints something of its own`);

  /*
   * WHAT A BOX CLIPS. A box whose overflow is not visible (dump.mjs: `ov`,
   * with its padding box) cuts what pokes out of it: share.xyz's carousel
   * track holds cards past its right edge, and drawn they covered the
   * sidebar. The clip that reaches an element is every such ancestor it is
   * laid out inside, as CSS has it: one placed absolute answers only to
   * ancestors from its containing block up (a positioned or transformed
   * box), one placed fixed to none. A part wholly outside is not drawn; one
   * across the edge carries the cut as `art.clipPath`, an inset of its own box.
   */
  /*
   * A box clips in its own frame, and the element is drawn through its own
   * transform (`ptf`, page-space): a point q of the element's untransformed
   * box is shown where A's clip lets M_el·q through, so its window in the
   * element's frame is M_el⁻¹·M_A applied to A's window — the box round it,
   * exact for a slide, close for a turn. A capture taken before has no `ptf`:
   * both are the identity and the window is A's as it was.
   */
  const affine = (m) => m ?? [1, 0, 0, 1, 0, 0];
  const times = ([a, b, c, d, e, f], [A, B, C, D, E, F]) => [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
  const inverse = ([a, b, c, d, e, f]) => { const k = a * d - b * c || 1; return [d / k, -b / k, -c / k, a / k, (c * f - d * e) / k, (b * e - a * f) / k]; };
  function clipInto(el, a, w) {
    if (!el.ptf && !a.ptf) return w;
    const [p, q, r, t, u, v] = times(inverse(affine(el.ptf)), affine(a.ptf));
    const xs = [], ys = [];
    for (const [x, y] of [[w.x0, w.y0], [w.x1, w.y0], [w.x0, w.y1], [w.x1, w.y1]]) { xs.push(p * x + r * y + u); ys.push(q * x + t * y + v); }
    const open = (lo, hi) => lo <= -1e6 + 1 && hi >= 1e6 - 1;
    return {
      x0: open(w.x0, w.x1) && Math.abs(r) < 1e-9 ? -Infinity : Math.min(...xs), x1: open(w.x0, w.x1) && Math.abs(r) < 1e-9 ? Infinity : Math.max(...xs),
      y0: open(w.y0, w.y1) && Math.abs(q) < 1e-9 ? -Infinity : Math.min(...ys), y1: open(w.y0, w.y1) && Math.abs(q) < 1e-9 ? Infinity : Math.max(...ys),
    };
  }
  /* How much a box's frame is stretched in the element's (a picture scaled 1.02 inside its screen sees the screen's curve 1.02 times smaller). */
  function scaleInto(el, a) {
    if (!el.ptf && !a.ptf) return [1, 1];
    const [p, q, r, t] = times(inverse(affine(el.ptf)), affine(a.ptf));
    return [Math.hypot(p, q) || 1, Math.hypot(r, t) || 1];
  }
  function clipOf(el) {
    if (el.pos === "fixed") return null;
    let rect = null;
    const windows = [];
    let skip = el.pos === "absolute";
    for (let a = el.parent; a && a.kind !== "page"; a = a.parent) {
      const block = !!a.pos || !!a.tf;
      if (skip && !block) continue;
      skip = false;
      if (a.ov) {
        const [bx, by, bw, bh] = a.ov.box;
        const r = rect ?? { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
        /* The clip in the element's own frame: the box's window carried through the box's transform, then back through the element's (a marquee slid 1259px inside its ribbon sees a window 1259px further along itself). */
        const w = clipInto(el, a, { x0: a.ov.x !== "visible" ? bx : -1e6, y0: a.ov.y !== "visible" ? by : -1e6, x1: a.ov.x !== "visible" ? bx + bw : 1e6, y1: a.ov.y !== "visible" ? by + bh : 1e6 });
        r.x0 = Math.max(r.x0, w.x0); r.x1 = Math.min(r.x1, w.x1); r.y0 = Math.max(r.y0, w.y0); r.y1 = Math.min(r.y1, w.y1);
        rect = r;
        if (a.ov.rad) { const [sx, sy] = scaleInto(el, a); windows.push({ w, rad: a.ov.rad.map(([rx, ry]) => [rx * sx, ry * sy]) }); }
      }
      if (a.pos === "fixed") break;
      if (a.pos === "absolute") skip = true;
    }
    /*
     * ITS CURVE. A rounded box cuts to its padding box's curve, not its
     * square: the CA bar's yellow ends, the picture's corners inside the TV's
     * screen. The window that bounds the clip on all four sides lends it its
     * corners; where two boxes each bound a side, the square is all that is
     * certain.
     */
    if (rect) {
      const near = (u, v) => Math.abs(u - v) < 0.75;
      const own = windows.find(({ w }) => near(w.x0, rect.x0) && near(w.x1, rect.x1) && near(w.y0, rect.y0) && near(w.y1, rect.y1));
      if (own && [rect.x0, rect.x1, rect.y0, rect.y1].every(Number.isFinite)) rect.rad = own.rad;
    }
    return rect;
  }

  /*
   * A TITLE SPLIT INTO LETTERS IS ONE TITLE. A script that wobbles a headline
   * (trumpmorty.fun's "TRUMP & MORTY") wraps each letter in a span of its
   * own, so each letter is an element with a box, and each would be a part.
   * The lowest element holding only single-character spans, touching in a
   * line, and containers of them, becomes one part with their words: the
   * letters of one parent run on, and a new parent (a row, the "&") starts
   * a new word. What every letter shares (the colour, the size, the
   * outline and shadow they inherit from their row) is the part's; a
   * colour, size or effect that differs is kept on that letter's run; a
   * transform or animation is kept per letter when the letters differ, and
   * once for every letter (`motion.letter`, `art.letterTransform`) when
   * they agree, since a transform on the whole part is not one on each.
   */
  const NOT_LETTER = new Set(["svg", "img", "iframe", "canvas", "input", "textarea", "select", "video", "button", "a", ...STROKE_TAGS]);
  const isLetter = (n) => !n.kids.length && [...(n.text ?? "").trim()].length === 1 && !NOT_LETTER.has(n.t);
  const isGap = (n) => !n.kids.length && !(n.text ?? "").trim() && !NOT_LETTER.has(n.t) && !n.bg && !n.bgi && !n.border && !n.src;
  const lettersIn = (el) => {
    const out = [];
    let ok = !(el.text ?? "").trim() && !NOT_LETTER.has(el.t) && el.kind !== "button";
    (function g(n) { for (const k of n.kids) { if (!ok) return; if (k.pseudo) continue; if (isLetter(k)) out.push(k); else if (isGap(k)) out.push(null); else if ((k.text ?? "").trim() || NOT_LETTER.has(k.t) || !k.kids.length || k.kind === "button") ok = false; else g(k); } })(el);
    const letters = out.filter(Boolean);
    if (!ok || letters.length < 3) return null;
    /* In a line: each letter of a parent starts where the one before it ended, give or take a third of its size (a wobble moves a letter a few pixels). */
    for (let i = 1; i < letters.length; i++) {
      const a = letters[i - 1], b = letters[i];
      if (a.parent !== b.parent) continue;
      const fs = a.fs ?? a.h;
      if (Math.abs(b.x - (a.x + a.w)) > fs / 3 || Math.abs(b.y - a.y) > a.h / 2) return null;
    }
    return out;
  };
  for (const el of all) {
    if (el.kind === "page" || el.kind === "letter" || el.kind === "stroke") continue;
    let seq = lettersIn(el);
    if (!seq) continue;
    let rootEl = el;
    /* The lowest element that still holds every letter. */
    for (;;) {
      const inner = rootEl.kids.filter((k) => !isGap(k));
      if (inner.length !== 1 || isLetter(inner[0])) break;
      const next = lettersIn(inner[0]);
      if (!next || next.filter(Boolean).length !== seq.filter(Boolean).length) break;
      rootEl = inner[0]; seq = next;
    }
    const letters = seq.filter(Boolean);
    let text = "";
    for (let i = 0; i < seq.length; i++) {
      const n = seq[i];
      if (!n) { if (text && !text.endsWith(" ")) text += " "; continue; }
      const prev = seq.slice(0, i).reverse().find(Boolean);
      if (prev && prev.parent !== n.parent && !text.endsWith(" ")) text += " ";
      n.letterAt = text.length;
      text += n.text.trim();
    }
    rootEl.kind = /^h[1-6]$/.test(rootEl.t) || rootEl.role === "heading" ? "heading" : "words";
    rootEl.letters = { text, seq, letters };
    (function mark(n) { for (const k of n.kids) { if (k.pseudo) continue; k.kind = "letter"; k.foldedInto = rootEl; mark(k); } })(rootEl);
  }
  /*
   * A button's words are its own, else the words of the children folded into
   * it, and nothing deeper. Gathering deeper than folding drew his wallet
   * button's address and age twice: once by the button, in white, and once
   * by the spans below its direct child, which are parts of their own.
   */
  const buttonWords = (el) => (el.text ?? "").trim() || el.kids.filter((k) => k.kind === "folded").map((k) => (k.text ?? "").trim()).join(" ").replace(/\s+/g, " ").trim();

  const positioned = (el) => el.pos === "fixed" || el.pos === "absolute";
  function bandOf(el) {
    let band = null;
    for (let n = el; n && n.kind !== "page"; n = n.parent) if (positioned(n)) band = n;
    return band;
  }
  const zOf = (el) => (el?.z && el.z !== "auto" ? Number(el.z) || 0 : 0);

  /** The part a folded title makes: its base letter (what most letters share), its runs, and what every letter agrees on. */
  const PER_LETTER = { colour: (n) => n.color, size: (n) => n.fs, fluid: (n) => n.fsu, face: (n) => n.ff, weight: (n) => n.fw, textShadow: (n) => n.tsh, textStroke: (n) => n.tstroke, paintOrder: (n) => n.porder };
  const EACH_LETTER = { transform: (n) => n.tf, motion: (n) => n.motion };
  const key = (v) => JSON.stringify(v ?? null);
  const mode = (xs) => { const c = new Map(); for (const x of xs) c.set(key(x), (c.get(key(x)) ?? 0) + 1); let best = null, bn = 0; for (const [k, v] of c) if (v > bn) { best = k; bn = v; } return best; };
  function foldLetters(el) {
    const { letters, seq } = el.letters;
    const base = Object.fromEntries(Object.entries(PER_LETTER).map(([k, f]) => [k, mode(letters.map(f))]));
    const baseLetter = letters.find((n) => ["colour", "size", "face", "weight"].every((k) => key(PER_LETTER[k](n)) === base[k])) ?? letters[0];
    const agree = Object.fromEntries(Object.entries(EACH_LETTER).map(([k, f]) => [k, new Set(letters.map((n) => key(f(n)))).size === 1 ? f(letters[0]) ?? null : undefined]));
    const runs = [];
    const push = (text, props) => {
      const last = runs[runs.length - 1];
      if (last && key({ ...last, text: "" }) === key({ ...props, text: "" }) && !("transform" in props) && !("motion" in props)) { last.text += text; return; }
      runs.push({ text, ...props });
    };
    let prev = null;
    for (const n of seq) {
      if (!n) continue;
      if (prev && (n.letterAt ?? 0) > (prev.letterAt ?? 0) + 1) push(" ", {});
      const props = {};
      for (const [k, f] of Object.entries(PER_LETTER)) if (key(f(n)) !== base[k] && f(n) !== undefined) props[k] = f(n);
      for (const [k, f] of Object.entries(EACH_LETTER)) if (agree[k] === undefined && f(n) !== undefined) props[k] = f(n);
      push(n.text.trim(), props);
      prev = n;
    }
    return { base: baseLetter, runs, agree, plain: runs.every((r) => Object.keys(r).length === 1) };
  }

  const made = [];
  for (const el of all) {
    const { sel, kind } = el;
    if (el.inMarquee) { note(sel, "(marquee)", "folded", `a run of the marquee it is in (${el.inMarquee.sel})`); continue; }
    if (kind === "letter") {
      const into = el.foldedInto.sel;
      for (const p of Object.keys(el).filter((p) => !["t", "kids", "parent", "depth", "sel", "order", "kind", "foldedInto", "letterAt"].includes(p))) note(sel, p, "folded", `the title's letters (${into}): ${p === "text" ? "its words" : "the part's, or this letter's run where it differs"}`);
      continue;
    }
    note(sel, "t", "field", `the tag picks the part (${kind}) and is kept in from.selector`);
    if (kind === "page") {
      note(sel, "x", "default", "the page's own origin");
      note(sel, "y", "default", "the page's own origin");
      note(sel, "w", "field", "the page's own width: frameWidth");
      note(sel, "h", "nowhere", "the frame's height is derived from the lowest part, never stored");
      if (el.bg) note(sel, "bg", "field", "look.palette.bg");
      for (const p of LAYOUT_PROPS) if (p in el) note(sel, p, DEFAULT_OF[p]?.(el[p]) ? "default" : "nowhere", "the page is not a part; its bands are placed by box");
      if ("minh" in el) note(sel, "minh", DEFAULT_OF.minh(el.minh) ? "default" : "nowhere", "the page's height is derived");
      continue;
    }
    if (kind === "folded") {
      note(sel, "text", "folded", `the button's content (${el.parent.sel})`);
      for (const p of ["x", "y", "w", "h"]) note(sel, p, "folded", "the button's box holds it; where the words start is the button's pad");
      for (const p of TEXT_PROPS) if (p in el) note(sel, p, "folded", `the button's ${p === "color" ? "colour.text" : "font"}`);
      for (const p of [...LAYOUT_PROPS, "minh", "maxw", "mar", "pad"]) if (p in el) note(sel, p, "folded", "");
      continue;
    }
    if (kind === "stroke") {
      const icon = (() => { let n = el; while (n && n.t !== "svg") n = n.parent; return n; })();
      if (icon?.kind === "picture") { for (const p of Object.keys(el).filter((p) => !["t", "kids", "parent", "depth", "sel", "order", "kind"].includes(p))) note(sel, p, "folded", `the svg it is part of is carried whole as a picture (${icon.sel})`); continue; }
      const drawn = icon?.kind === "icon";
      for (const p of ["x", "y", "w", "h"]) note(sel, p, drawn ? "folded" : "nowhere", drawn ? `vector.paths[].share: how much of the icon's box this stroke covers (${icon.sel})` : "a stroke's box: the icon keeps only its own box, and the path geometry was not captured");
      if (el.d) note(sel, "d", drawn ? "folded" : "nowhere", drawn ? `vector.paths[].d, as captured (${icon.sel})` : "the icon has no viewBox to draw it in");
      if (el.color) note(sel, "color", "folded", `the icon's colour.text (${icon?.sel ?? "svg"}): drawn-icon draws its paths in the text role`);
      if ("stroke" in el) note(sel, "stroke", drawn ? "folded" : "nowhere", drawn ? `the icon's "drawn as" option: an outline when the stroke is painted, a fill when only the fill is (${icon.sel})` : "");
      if ("fill" in el) note(sel, "fill", drawn ? "folded" : "nowhere", drawn ? "with stroke, above" : "");
      if ("sw" in el) note(sel, "sw", "nowhere", "drawn-icon draws every outline at 2 units; the measured stroke width is not kept");
      if ("cap" in el) note(sel, "cap", "nowhere", `stroke-linecap ${el.cap}: vector.paths[] holds a path's geometry and its share, no cap`);
      if ("join" in el) note(sel, "join", "nowhere", `stroke-linejoin ${el.join}: vector.paths[] holds a path's geometry and its share, no join`);
      for (const p of TEXT_PROPS) if (p !== "color" && p in el) note(sel, p, "n/a", "a text property on a stroke");
      if ("minh" in el) note(sel, "minh", DEFAULT_OF.minh(el.minh) ? "default" : "nowhere", "a stroke has no size field");
      continue;
    }

    if (el.holder) { note(sel, "holder", "nowhere", "a box of no size whose children draw (an antenna holding its rods): its children are parts, it is none"); continue; }
    const clipped = clipOf(el);
    if (clipped) {
      const [x0, y0, x1, y1] = [Math.max(el.x, clipped.x0), Math.max(el.y, clipped.y0), Math.min(el.x + el.w, clipped.x1), Math.min(el.y + el.h, clipped.y1)];
      if (x1 <= x0 || y1 <= y0) { note(sel, "(clip)", "nowhere", "wholly outside a box that clips its overflow, so the page never showed it: no part"); continue; }
      /* Where the clipping box reaches past the part, its own drop shadow may show there, as far as the shadow reaches (a ribbon's shadow below it): a negative inset, in a capture taken since. */
      const reach = cap.untransformed ? shadowReach(el.shadow) : [0, 0, 0, 0];
      const raw = [clipped.y0 - el.y, el.x + el.w - clipped.x1, el.y + el.h - clipped.y1, clipped.x0 - el.x];
      /* Rounded, the window is placed exactly, past the part's own box where it is bigger, so its corners fall where the page's did. */
      const rad = clipped.rad;
      const inset = raw.map((v, i) => (rad ? round2(v) : Math.round(v > 0 ? v : Math.max(v, -reach[i]))) || 0);
      /* A corner of the curve cuts it when the part reaches into that corner's square. */
      const [wx0, wy0, wx1, wy1] = [clipped.x0, clipped.y0, clipped.x1, clipped.y1];
      const inCorner = !!rad && [[el.x < wx0 + rad[0][0], el.y < wy0 + rad[0][1]], [el.x + el.w > wx1 - rad[1][0], el.y < wy0 + rad[1][1]], [el.x + el.w > wx1 - rad[2][0], el.y + el.h > wy1 - rad[2][1]], [el.x < wx0 + rad[3][0], el.y + el.h > wy1 - rad[3][1]]].some(([a, b], i) => a && b && rad[i][0] > 0 && rad[i][1] > 0);
      if (inset.some((v) => v > 0) || inCorner) {
        const round = inCorner ? ` round ${rad.map(([rx]) => `${round2(rx)}px`).join(" ")} / ${rad.map(([, ry]) => `${round2(ry)}px`).join(" ")}` : "";
        if (el.clip) note(sel, "(clip)", "nowhere", `cut by a box that clips its overflow (inset ${inset.join("px ")}px${round}), but it has a clip-path of its own, which is kept`);
        else { el.clipIn = `inset(${inset.join("px ")}px${round})`; note(sel, "(clip)", "field", `art.clipPath ${el.clipIn}: the part of it outside the box that clips its overflow is cut, as the page cut it${round ? ", to the box's rounded corners" : ""}`); }
      }
    }
    const featureId = FEATURE[kind];
    const folded = el.letters ? foldLetters(el) : null;
    const words = kind === "button" ? buttonWords(el) : folded ? el.letters.text : (el.text ?? "").trim();
    /* A button's type is read off the element that held its words: the child span, when the words were in one. A folded title's, off the letter most of its letters are set like. */
    const wordsEl = kind === "button" && !(el.text ?? "").trim() ? all.find((k) => k.parent === el && k.kind === "folded") ?? el : folded ? folded.base : el;

    /* Words. */
    let content = "";
    if (words) { content = words; note(sel, "text", "field", kind === "button" && wordsEl !== el ? "content, from the child that held the words" : "content"); }
    if (el.cssMarquee) { content = el.cssMarquee.runs; note(sel, "(marquee)", "field", `content: ${el.cssMarquee.runs.length} runs, one copy of the words the row carries`); }
    if (folded) {
      if (!folded.plain) content = folded.runs;
      note(sel, "letters", "field", `${el.letters.letters.length} per-letter elements folded back into one ${featureId} reading ${JSON.stringify(words)}${folded.plain ? "" : `, as ${folded.runs.length} runs keeping ${[...new Set(folded.runs.flatMap((r) => Object.keys(r).filter((k) => k !== "text")))].join(", ")} where a letter differs`}${folded.agree.transform ? "; every letter's transform in art.letterTransform" : ""}${folded.agree.motion ? "; every letter's motion in motion.letter" : ""}`);
    }

    /* Colour roles (recreate.ts#colourFrom): bg is what it is painted on, text what its words are set in,
       accent the most coloured thing in it; a button's edge is always its accent, because that is what the part draws the edge in. */
    const colour = {};
    const border = borderOf(el.border);
    /*
     * A translucent fill is carried as the colour it looks. The document reads
     * #hex, rgb() and oklch() and drops alpha, so `bg-[#00ff00]/10` (the
     * browser writes oklab(… / 0.1)) was dropped outright and his active
     * time-range button drew as an empty outline. It is composited here, in
     * sRGB as the browser does, over what is painted behind it: the nearest
     * ancestor's fill, itself composited if it is translucent, else the
     * page's ground. Measured values only; the ledger says it was done.
     */
    const behind = (n) => {
      for (let p = n.parent; p; p = p.parent) {
        const c = !isNone(p.bg) && srgbaOf(p.bg);
        if (c && c[3] > 0) return c[3] >= 1 ? c : over(c, behind(p));
      }
      return srgbaOf(cap.bodyBg) ?? [255, 255, 255, 1];
    };
    let fill = el.bg;
    if (cap.untransformed && el.bg && !isNone(el.bg) && alphaOf(el.bg) < 1) {
      /* Its alpha kept (a gloss of white at 35% over a key): what is behind it shows through as it does on the page. */
      const c = srgbaOf(el.bg);
      if (c && c[3] > 0) { fill = PARSEABLE.test(el.bg) && /^rgba\(/.test(el.bg) ? el.bg : `rgba(${c.slice(0, 3).map((x) => Math.round(x)).join(", ")}, ${round2(c[3])})`; note(sel, "bg", "field", `${el.bg} kept with its alpha as ${fill}`); }
    } else if (el.bg && !isNone(el.bg) && (alphaOf(el.bg) < 1 || !PARSEABLE.test(el.bg))) {
      const c = srgbaOf(el.bg);
      if (c && c[3] > 0) {
        fill = rgbText(c[3] >= 1 ? c : over(c, behind(el)));
        note(sel, "bg", "field", `${el.bg} carried as ${fill}: ${c[3] >= 1 ? "converted" : "composited over what is painted behind it"}, because the document reads no alpha and no ${el.bg.split("(")[0]}()`);
      }
    }
    if (fill && el.masked) note(sel, "bg", "folded", "the colour the mask cuts, drawn inside the picture: under it, it would be the square the mask cuts it from");
    else if (fill) {
      if (PARSEABLE.test(fill)) {
        if (kind === "button") { colour.bg = fill; colour.accent = fill; note(sel, "bg", "field", "colour.bg: the node's own fill, painted by Fill; the button part paints nothing over a fill the node named"); }
        else if (kind === "box") {
          colour.bg = fill; colour.surface = fill;
          note(sel, "bg", "field", "colour.bg and colour.surface");
        }
        else { colour.bg = fill; note(sel, "bg", kind === "picture" ? "stored" : "field", kind === "picture" ? "colour.bg, under the picture" : "colour.bg"); }
      } else {
        note(sel, "bg", "nowhere", `${el.bg.split("(")[0]}() is not a colour the document reads (parseColor: #hex, rgb, oklch; alpha dropped)`);
      }
    }
    const ink = kind === "button" ? wordsEl.color ?? el.color : folded ? wordsEl.color : el.color;
    if (ink) {
      if (kind === "picture") note(sel, "color", "n/a", "a text property on a picture");
      else if (PARSEABLE.test(ink)) {
        colour.text = ink;
        note(sel, "color", "field", kind === "button" ? "colour.text: the button draws its words in a colour the node named" : "colour.text");
      } else if (srgbaOf(ink)?.[3] > 0) {
        /* A colour the document does not read (share.xyz's headline in color(srgb 1 1 1 / 0.9)): carried as the colour it looks, over what is behind it, as a fill is. */
        const c = srgbaOf(ink);
        colour.text = rgbText(c[3] >= 1 ? c : over(c, behind(el)));
        note(sel, "color", "field", `${ink} carried as ${colour.text}: ${c[3] >= 1 ? "converted" : "composited over what is painted behind it"}, because the document reads no alpha and no ${ink.split("(")[0]}()`);
      } else note(sel, "color", "nowhere", `${ink.split("(")[0]}() is not a colour the document reads`);
    }
    let strokes = [];
    let inks = [];
    let lineIcon = true;
    if (kind === "icon" || kind === "icon-blind") {
      (function gather(n) { for (const k of n.kids) { strokes.push(k); gather(k); } })(el);
      inks = [...new Set(strokes.map((s) => (isNone(s.stroke) ? s.fill : s.stroke) || s.color).filter((c) => c && !isNone(c)))];
      lineIcon = strokes.some((s) => !isNone(s.stroke)) || strokes.every((s) => isNone(s.fill));
      if (inks.length && PARSEABLE.test(inks[0])) colour.text = inks[0];
      else if (inks.length) note(sel, "color", "nowhere", `${inks[0].split("(")[0]}() is not a colour the document reads; the icon takes the site's text colour`);
    }

    /* The box: layout, padding, edge, text (parts/theme.ts#NodeBox). */
    const layout = layoutOf(el);
    /*
     * A button whose words were in a child: its words start where the child started, not where its padding ends — the icon sits in the difference.
     * Unless the child stands in the middle, as much room left of it as right (trumpmorty's COPY CA, `<button><span>COPY CA</span></button>`,
     * text-align centre, padding 16 0 10): nothing stands in that difference, it is the centring. Taken as the left padding, 227 of 550, the
     * words were centred again in what was left and stood 113px right of the middle. There the measured padding is kept.
     */
    const inMiddle = wordsEl !== el && Math.abs((wordsEl.x - el.x) - (el.x + el.w - wordsEl.x - wordsEl.w)) <= 2;
    let pad = kind === "button" && wordsEl !== el && !inMiddle
      ? { ...(padOf(el) ?? { top: 0, right: 0, bottom: 0 }), left: Math.max(0, wordsEl.x - el.x) }
      : padOf(el);
    /* A button whose folded line sits beside lines of their own (share.xyz's "Download the App" over its two big lines): its words are set in that line's box, top and bottom too, not centred over the others. */
    if (cap.untransformed && kind === "button" && wordsEl !== el && el.kids.some((k) => k.kind !== "folded" && wordsWithin(k))) {
      pad = { ...pad, top: Math.max(0, wordsEl.y - el.y), bottom: Math.max(0, el.y + el.h - wordsEl.y - wordsEl.h) };
      note(sel, "(beside)", "field", `pad.top ${pad.top}, pad.bottom ${pad.bottom}: the folded line is set where it was, above or beside the button's lines of their own`);
    }
    /*
     * A BUTTON CENTRES ITS WORDS DOWN ITS HEIGHT. stonkfun.xyz's sort pills
     * ("Market cap", "Newest", "24h volume") are 36px `<button>`s with no
     * padding above or below a 20px line: the browser sets a button's
     * contents in the middle of its height, whatever its display, and the
     * part set the words at the top, 8px high (the two with no fill are parts
     * of words, the same). A `<button>` laid out as a block,
     * holding its own line, carries the room above and below it as padding,
     * as the dump does for a field.
     */
    if ((kind === "button" || kind === "words") && wordsEl === el && el.t === "button" && !/flex|grid/.test(el.disp ?? "") && el.lh > 0) {
      const bw = border?.width ?? 0, p0 = pad ?? { top: 0, right: 0, bottom: 0, left: 0 };
      const free = el.h - 2 * bw - (p0.top ?? 0) - (p0.bottom ?? 0) - el.lh;
      if (free >= 2 && el.h < el.lh * 1.9 + (p0.top ?? 0) + (p0.bottom ?? 0) + 2 * bw) {
        pad = { ...p0, top: (p0.top ?? 0) + Math.floor(free / 2), bottom: (p0.bottom ?? 0) + Math.ceil(free / 2) };
        note(sel, "(middle)", "field", `pad.top ${pad.top}, pad.bottom ${pad.bottom}: a button sets its line in the middle of its height`);
      }
    }
    /*
     * A BUTTON'S FOLDED WORDS BESIDE A PART OF ITS OWN. share.xyz's YES / NO
     * keys are `<button><span>Yes</span><span class=bar/></button>`, a grid
     * of the words and a price bar: the words folded into the button, the bar
     * a part beside them. The left padding stood where the words did, the
     * right was the button's own 8px, so the words were centred over the
     * words and the bar together and ran into it. With a part of its own
     * beside them, the words are set in their own box, right edge too.
     */
    if (kind === "button" && wordsEl !== el && el.kids.some((k) => k !== wordsEl && !k.pseudo && k.kind !== "folded")) {
      pad = { ...(pad ?? { top: 0, bottom: 0, left: 0 }), right: Math.max(0, el.x + el.w - wordsEl.x - wordsEl.w) };
      note(sel, "(beside)", "field", `pad.right ${pad.right}: the folded words are set in their own box, not over the part beside them`);
    }
    /*
     * WORDS BESIDE AN ICON KEEP THEIR PLACE. share.xyz's "Unified" tab is
     * `<button><svg/>Unified</button>`: its own words, drawn after the icon
     * in a row. The part draws the words from the box's left edge, over the
     * icon. So when an element's own words share its box with an icon or a
     * picture standing in the left half, the words start after it: the
     * left padding is the icon's right edge plus the row's gap, measured.
     */
    const beside = (el.text ?? "").trim() && (!el.dir || el.dir === "row")
      ? el.kids.filter((k) => (k.kind === "icon" || k.kind === "icon-blind" || k.kind === "picture") && k.x + k.w <= el.x + el.w / 2 + 1)
      : [];
    /* A button with words of its own beside children set apart (a remote key's HOME under its <small>00</small>): its words are set in the box the page drew them in (dump.mjs: `tb`), not centred over the child. */
    if (kind === "button" && wordsEl === el && el.tb && el.kids.some((k) => k.kind === "words")) {
      const [tx, ty, tw, th] = el.tb;
      pad = { top: Math.max(0, ty - el.y), right: Math.max(0, el.x + el.w - tx - tw), bottom: Math.max(0, el.y + el.h - ty - th), left: Math.max(0, tx - el.x) };
      note(sel, "tb", "field", `pad {${[pad.top, pad.right, pad.bottom, pad.left].join(", ")}}: the button's own words are set where the page drew them, beside the children set apart`);
    }
    /*
     * A HEADING'S OWN WORDS AMONG CHILDREN SET APART. share.xyz's banner
     * heading is `<h1><span>Make Predictions Across</span><span>…Polymarket</span>and<span>…Hyperliquid</span></h1>`,
     * a wrapping row: the kicker on a row of its own, the two names and its
     * own "and" on the next. The children became parts of their own, and the
     * heading's lone "and", centred in the whole 105px box, stood 19px above
     * the row it was set in. Its words are set in the box the page drew them
     * in (dump.mjs: `tb`), as a button's are. Only in a flex or grid box,
     * whose children are items apart from its words: a sentence with inline
     * elements in it takes their words back later (the holes, below).
     */
    if (el.tb && (kind === "words" || kind === "heading") && !folded && /flex|grid/.test(el.disp ?? "") && el.kids.some((k) => !k.pseudo && wordsWithin(k))) {
      const [tx, ty, tw, th] = el.tb;
      pad = { top: Math.max(0, ty - el.y), right: Math.max(0, el.x + el.w - tx - tw), bottom: Math.max(0, el.y + el.h - ty - th), left: Math.max(0, tx - el.x) };
      note(sel, "tb", "field", `pad {${[pad.top, pad.right, pad.bottom, pad.left].join(", ")}}: its own words are set where the page drew them, among children with words of their own`);
    }
    /*
     * A LINE WHOSE LETTERS STAND TALLER THAN THE LINE. gotchi.gg's wordmark
     * is 96px Pixelify Sans on a 96px line in an inline span: the span's box
     * is its letters' (115px, 10px above the line and 9 below), and the part
     * set its 96px line at the top of that box, 10px high. The letters of one
     * line sit in the middle of their line, so the line starts half the
     * difference above where they were drawn (`tb`); that room is carried as
     * padding. Words on an ordinary line come out at 0 and are not touched,
     * and so are two lines (their letters, 24 + 18px, are not one line's).
     */
    if (cap.untransformed && el.tb && (kind === "words" || kind === "heading") && !folded && !(pad?.top) && el.lh > 0 && el.fs > 0 && el.tb[3] > el.lh + 2 && el.tb[3] <= el.fs * 1.45) {
      const top = Math.round(el.tb[1] - el.y - (el.lh - el.tb[3]) / 2);
      if (top >= 2 && top + el.lh <= el.h) {
        pad = { ...(pad ?? { right: 0, left: 0 }), top, bottom: Math.max(0, el.h - top - el.lh) };
        note(sel, "tb", "field", `pad.top ${pad.top}, pad.bottom ${pad.bottom}: its ${el.lh}px line starts where the page set it, its ${el.tb[3]}px letters standing past it`);
      }
    }
    /* Its own words start where the page drew them (trumpmorty's LIVE badge: after its dot and the gap), from the box round them, when nothing else of it has words. */
    if (cap.untransformed && el.tb && (kind === "words" || kind === "heading") && !folded && !el.kids.some((k) => !k.pseudo && wordsWithin(k))) {
      const left = Math.max(0, el.tb[0] - el.x);
      if (left > (pad?.left ?? 0)) { pad = { ...(pad ?? { top: 0, right: 0, bottom: 0, left: 0 }), left }; note(sel, "tb", "field", `pad.left ${left}: its words start where the page drew them, after what stands before them`); }
    }
    if (beside.length && (kind === "words" || kind === "heading" || (kind === "button" && wordsEl === el))) {
      const after = Math.max(...beside.map((k) => k.x + k.w)) + (parseFloat(el.gap) || 0) - el.x;
      pad = { ...(pad ?? { top: 0, right: 0, bottom: 0, left: 0 }), left: Math.max(pad?.left ?? 0, after) };
      /*
       * …and end where they ended. gotchi.gg's "adopt a gotchi" is an egg and
       * its words in a row centred in the button: the left padding stood after
       * the egg, the right was the button's own 28px, and the words were
       * centred in what was left, 10px right of the page's. Where the capture
       * has the box the words were drawn in (`tb`), both sides come from it.
       */
      if (el.tb && el.tb[0] > Math.max(...beside.map((k) => k.x + k.w / 2))) pad = { ...pad, left: Math.max(0, el.tb[0] - el.x), right: Math.max(0, el.x + el.w - el.tb[0] - el.tb[2]) };
      note(sel, "(beside)", "field", `pad.left ${pad.left}${el.tb ? `, pad.right ${pad.right}` : ""}: the words start after the icon beside them, as measured, not over it`);
    }
    let edge = kind === "button" ? (edgeOf(border) ?? { width: 0, style: "none" }) : edgeOf(border);
    /*
     * AN EDGE ON SOME SIDES ONLY. A node's edge is one width all round, so
     * trumpmorty's COPY (a left edge only) drew a box round itself inside its
     * button's. The sides are drawn instead as inset lines of the edge's
     * colour, one per side and as wide as it was, on the edge's shadow, which
     * polio draws; the padding takes their widths, so the words stay where
     * they were.
     */
    if (border && Array.isArray(el.bsides)) {
      const [t, r, b, l] = el.bsides;
      /* Each side in its own colour where the capture recorded them apart (`bcolours`), else the edge's. */
      const [ct, cr, cb, cl] = Array.isArray(el.bcolours) && el.bcolours.length === 4 ? el.bcolours : [border.colour, border.colour, border.colour, border.colour];
      const lines = [t && `inset 0 ${t}px 0 0 ${ct}`, r && `inset -${r}px 0 0 0 ${cr}`, b && `inset 0 -${b}px 0 0 ${cb}`, l && `inset ${l}px 0 0 0 ${cl}`].filter(Boolean);
      edge = { width: 0, style: "none", shadow: [...lines, ...(el.shadow ? [el.shadow] : [])].join(", ") };
      pad = { top: (pad?.top ?? 0) + t, right: (pad?.right ?? 0) + r, bottom: (pad?.bottom ?? 0) + b, left: (pad?.left ?? 0) + l };
      note(sel, "bsides", "field", `an edge on some sides only (${el.bsides.join(", ")})${Array.isArray(el.bcolours) ? `, each in its own colour (${el.bcolours.join(", ")})` : ""}: drawn as inset lines on edge.shadow, the padding taking their widths`);
    }
    /* The box-shadow as the browser computed it (his cards' faint green glow, share.xyz's card ring): on the edge, where polio draws it (parts/theme.ts#boxStyle reads edge.shadow). */
    if (el.shadow && !(border && Array.isArray(el.bsides))) edge = { ...(edge ?? { width: 0, style: "none" }), shadow: el.shadow };
    /* Rounded corners: one radius, the largest of the four, as node.radius (px). */
    const radius = el.radius ? Math.max(...el.radius) : null;
    let text = kind === "button" ? (textOf(wordsEl) ?? textOf(el)) : folded ? textOf(wordsEl) : textOf(el);
    /*
     * A BUTTON LAID OUT AS A ROW SETS ITS WORDS BY ITS ROW. share.xyz's "View
     * Resolved" (a 908px `display: flex` button) and "Market" (text-align
     * centre, but a flex row) have their words at the start: in a flex row
     * the words are an item, placed by `justify-content`, and `text-align`
     * places nothing. The part centred both, a button's default. A row
     * button's own words take their side from its row.
     */
    if (kind === "button" && wordsEl === el && /flex/.test(el.disp ?? "") && (!el.dir || el.dir === "row")) {
      const side = /^(normal|flex-start|start|left)$/.test(el.just ?? "normal") ? "left" : /^(flex-end|end|right)$/.test(el.just) ? "right" : el.just === "center" ? "center" : null;
      if (side && text?.align !== side) {
        text = { ...(text ?? {}), align: side };
        note(sel, "just", "field", `text.align ${side}: a flex row places its words by justify-content (${el.just ?? "normal"}), not text-align (${el.ta ?? "start"})`);
      }
    } else if (kind === "button" && wordsEl === el && !/flex|grid/.test(el.disp ?? "") && /^(start|left)$/.test(el.ta ?? "") && !text?.align) {
      /* Not a row: `text-align` places the words, and `start` is not a button's default (the browser centres a button's words), so the page set it: share.xyz's outcome rows, "June 30, 2027" at the left of a 400px button. */
      text = { ...(text ?? {}), align: "left" };
      note(sel, "ta", "field", `text.align left: a button's words are centred unless the page says otherwise, and it said ${el.ta}`);
    }
    /*
     * WORDS ITS OWN LAYOUT CENTRES. gotchi.gg's step numbers are a 44px dot
     * holding "1", a grid that sets it in the middle (`place-items: center`),
     * and the part set it at the top left. A box holding only its own words,
     * centred across by its grid (`justify-items`) or row (`justify-content`),
     * and down (`align-items`), carries the words centred across and the
     * padding that stands one line in the middle.
     */
    if (cap.untransformed && (kind === "words" || kind === "heading") && !el.kids.length && (el.text ?? "").trim() && (el.disp === "grid" || el.disp === "flex")) {
      const across = el.disp === "grid" ? /center/.test(el.ji ?? "") : el.dir !== "column" ? /center/.test(el.just ?? "") : /center/.test(el.align ?? "");
      const down = el.disp === "grid" || el.dir !== "column" ? /center/.test(el.align ?? "") : /center/.test(el.just ?? "");
      if (across && (!text?.align || text.align === "start" || text.align === "left")) { text = { ...(text ?? {}), align: "center" }; note(sel, "ji", "field", `text.align center: its ${el.disp} centres its words across`); }
      const line = el.lh ?? el.fs ?? null;
      const inner = el.h - (pad?.top ?? 0) - (pad?.bottom ?? 0);
      /* One line only: a box two lines tall or more (a sticker's three centred lines) may hold several, and is left to set them. */
      if (down && line && inner - line >= 2 && inner < 2 * line) {
        const add = Math.floor((inner - line) / 2);
        pad = { top: (pad?.top ?? 0) + add, right: pad?.right ?? 0, bottom: (pad?.bottom ?? 0) + add, left: pad?.left ?? 0 };
        note(sel, "align", "field", `pad.top and pad.bottom +${add}: its ${el.disp} centres its one line down its ${el.h}px`);
      }
    }

    if (border) {
      if (kind === "button") {
        if (!colour.accent && PARSEABLE.test(border.colour)) colour.accent = border.colour;
        note(sel, "border", "field", `edge {width ${border.width}, style ${border.style}, colour}: the wrapper draws it and the button part draws none of its own`);
      } else {
        note(sel, "border", "field", `edge {width ${border.width}, style ${border.style}, colour}${edge && !edge.colour ? "; the colour is not one the document reads, so the edge takes the site's line colour" : ""}`);
      }
    }
    if (!colour.accent && el.bg && chroma(el.bg) > 0.12 && kind !== "button" && PARSEABLE.test(el.bg)) colour.accent = el.bg;

    for (const p of LAYOUT_PROPS) {
      if (!(p in el)) continue;
      if (DEFAULT_OF[p]?.(el[p])) { note(sel, p, "default", ""); continue; }
      if (p === "disp" && el.disp === "block") { note(sel, p, "default", "a block says nothing a box does not"); continue; }
      if (p === "cols" && el.disp !== "grid") { note(sel, p, "nowhere", "tracks on something that is not a grid"); continue; }
      if (layout && LAYOUT_FIELD[p] in layout) {
        const seen = kind === "box";
        note(sel, p, seen ? "field" : "stored", `layout.${LAYOUT_FIELD[p]}${seen ? "" : ": the part fills the box, so a layout round it has one child and nothing to arrange"}`);
      } else note(sel, p, "nowhere", "not a value NodeLayout takes");
    }
    if (kind === "button" && wordsEl !== el) note(sel, "pad", "field", `pad {${[pad.top, pad.right, pad.bottom, pad.left].join(", ")}}: the left is where the words were measured to start inside the button, the icon in the difference; the rest is the measured padding`);
    else if (el.pad) note(sel, "pad", "field", `pad {${el.pad.join(", ")}}; the theme is set tight so the part adds no padding of its own${kind === "button" ? "; the button's words start where the page started them" : ""}`);
    if (el.shadow) note(sel, "shadow", "field", `edge.shadow ${JSON.stringify(el.shadow)}, as the browser computed it; the box wrapper draws it (parts/theme.ts#boxStyle)`);
    if (el.radius) note(sel, "radius", "field", `radius ${radius}${el.radius.every((r) => r === radius) ? "" : `: the largest of {${el.radius.join(", ")}}; the node holds one radius for its four corners`}`);
    if (kind === "button" && !border) note(sel, "border", "field", "edge {none}: the page drew no edge, and the button part draws a 2px edge of its own unless the node names one, so none is named");
    if ("ta" in el && kind !== "picture") note(sel, "ta", DEFAULT_OF.ta(el.ta) ? "default" : text?.align ? "field" : "nowhere", DEFAULT_OF.ta(el.ta) ? "" : text?.align ? `text.align ${el.ta}${kind === "button" ? "; the button sets its words where the node said" : ""}` : "not a value NodeText takes");
    if ("tt" in el && kind !== "picture") note(sel, "tt", DEFAULT_OF.tt(el.tt) ? "default" : text?.transform ? "field" : "nowhere", DEFAULT_OF.tt(el.tt) ? "" : text?.transform ? `text.transform ${el.tt}` : "not a value NodeText takes");

    /* Type. */
    let font = null;
    if (words) {
      font = fontOf(wordsEl, featureId, !!cap.untransformed);
      const drawsWeight = kind === "words" || kind === "button";
      const drawsLeading = kind !== "heading";
      note(sel, "fs", "field", `font.size ${font.size} × base ${BASE_PX}${PART_SCALE[featureId] !== 1 ? ` × the part's own ${PART_SCALE[featureId]}` : ""} = ${(folded ? wordsEl : el).fs}px`);
      if ("fw" in el) note(sel, "fw", drawsWeight ? (font.weight > CLAMP.weight[1] ? "stored" : "field") : "stored", drawsWeight ? (font.weight > CLAMP.weight[1] ? `font.weight; the theme clamps it to ${CLAMP.weight[1]}` : `font.weight${kind === "button" ? ": the button's weight is the node's, else 700" : ""}`) : `font.weight; ${featureId} sets its own weight (700)`);
      if ("ff" in el) note(sel, "ff", "field", `font.${font.face ? `face "${font.face}"` : ""}${font.face && font.family ? " and " : ""}${font.family ? `family "${font.family}"` : ""}${font.face ? "; the face is carried in look.fonts when its file is" : `; "${el.ff}" is a generic keyword, the machine's own face, which cannot be carried`}`);
      if ("lh" in el) note(sel, "lh", drawsLeading ? "field" : "stored", drawsLeading ? `font.leading ${font.leading} (${el.lh}/${el.fs})` : `font.leading; ${featureId} sets its own line height (1.2)`);
      if ("ls" in el) note(sel, "ls", DEFAULT_OF.ls(el.ls) ? "default" : font.spacing !== undefined ? "field" : "nowhere", DEFAULT_OF.ls(el.ls) ? "" : font.spacing !== undefined ? `font.spacing ${font.spacing}em` : "under the 0.005em the reading keeps");
      if (!Object.keys(font).length) font = null;
    } else if (kind === "picture") {
      for (const p of TEXT_PROPS) if (p in el && p !== "color") note(sel, p, "n/a", "a text property on a picture");
    }

    /* Where it goes. */
    let link = null;
    if (el.href !== undefined) {
      const got = linkOf(el.href, cap.url);
      link = got.link;
      if (got.anchor !== undefined) anchors.push({ link, id: got.anchor, sel });
      if (!link) note(sel, "href", "nowhere", got.how);
      else note(sel, "href", kind === "button" ? "field" : "stored", `${got.how}${kind === "button" ? "" : `; ${featureId} is not a linkable part, so the link is written but not pressed`}`);
    }
    /* A sidebar button: the page its section was captured as. On the box that is the button, not pressed by it — see the head of this file. */
    if (pageDef.route === "/" && el.t === "button" && within(el, "aside") && routes.sections?.[wordsWithin(el)]) {
      link = { kind: "page", target: routes.sections[wordsWithin(el)] };
      note(sel, "(sidebar)", "stored", `link (page ${link.target}): "${wordsWithin(el)}" leads to the page its section was captured as; the box does not press a link, so it is carried until the button ruling is settled`);
    }
    if (el.title) note(sel, "title", el.name ? "field" : "nowhere", el.name ? `the accessible name the tree computed from it ("${el.name}"): label and data, never words drawn in the box` : `"${el.title}" is shown on hover; the tree gave the element no name from it`);

    /* What it is: the role, its name, its states, and a field's type and placeholder. */
    const roleBits = [];
    if (el.role) {
      const drawnBy = { heading: "value-prop", paragraph: "prose", image: featureId, button: kind === "button" ? "cta-primary" : null }[el.role] ?? null;
      note(sel, "role", "field", drawnBy ? `${el.role}: the part (${drawnBy}) is chosen from it; written in label and prompt` : `${el.role}: no part in the library draws it, so the look is the shape's (${featureId}) and the role is written in label and prompt${["textbox", "button", "link"].includes(el.role) ? " and data" : ""}`);
      roleBits.push(el.role);
      if (el.name) { roleBits.push(`named “${el.name}”`); note(sel, "name", "field", `the accessible name: label${["textbox", "button", "link"].includes(el.role) ? " and data" : ""}${words && words === el.name ? " (the same as its words)" : ""}`); }
      if (el.state) { roleBits.push(...Object.entries(el.state).map(([k, v]) => (v === true ? k : `${k} ${v}`))); note(sel, "state", "field", `${Object.keys(el.state).join(", ")}: prompt${["textbox", "button", "link"].includes(el.role) ? " and data" : ""}`); }
    }
    if (el.type) { roleBits.push(`type ${el.type}`); note(sel, "type", "field", `a ${el.type} field: prompt and data`); }
    if (el.placeholder) { roleBits.push(`placeholder “${el.placeholder}”`); note(sel, "placeholder", "field", el.phShown ? "prompt and data, and the words the empty field shows (content, in the placeholder's colour)" : "prompt and data, as evidence of what the field is for"); }
    if (el.value) { roleBits.push(`value “${el.value}”`); note(sel, "value", "field", "prompt and data"); }
    if (el.aria) note(sel, "aria", el.name ? "folded" : "nowhere", el.name ? "the accessible name" : "");
    const roleLine = roleBits.join(", ");
    const roleSaid = el.role ? `The browser computes it as a ${roleLine}.` : "";

    /* The picture. */
    let picture = null;
    let data = "";
    let label;
    if (kind === "picture") {
      const whole = el.t === "svg" || !!el.masked;
      const canvas = (el.t === "canvas" && (el.drawn || el.frames || el.depths)) || (el.t === "video" && !el.src && el.drawn);
      const got = canvas ? pictureOfCanvas(el) : whole ? pictureOfSvg(el) : pictureFor(el.src, cap.url);
      data = el.t === "video" ? `a video (${el.video?.src ?? "no source"}), as it stands as the page opens: ${el.src ? "its poster" : "the frame it shows"}` : canvas ? "what the canvas drew, as a PNG" : el.masked ? "its colour cut by its mask-image, carried as a picture of itself" : whole ? "an svg carried whole, every shape in its own paint" : /^data:/i.test(el.src ?? "") ? `a picture written into the page as a data: address (${el.src.length} characters), carried as its bytes` : el.src;
      if (got) {
        /* Pixel art the page drew square stays square when drawn larger than its pixels. */
        picture = /pixelated|crisp-edges/.test(el.ir ?? "") ? { ...got.record, pixelated: true } : got.record;
        if (picture.pixelated) note(sel, "ir", "field", `picture.pixelated: image-rendering ${el.ir}`);
        if (el.frames) note(sel, "frames", el.frames.frames?.length > 1 && /^canvas-(frames|depths)\.svg$/.test(got.name) ? "field" : "nowhere", `${el.frames.frames?.length ?? 0} pictures over ${el.frames.ms}ms${got.name === "canvas-frames.svg" ? ", played back as one svg" : got.name === "canvas-depths.svg" ? ", played back in the strip's top band" : ""}`);
        if (el.depths) note(sel, "depths", got.name === "canvas-depths.svg" ? "field" : "nowhere", `${el.depths.stills?.length ?? 0} depths of the page (every ${el.depths.every}px of scroll)${got.name === "canvas-depths.svg" ? `, laid in one strip; picture.depths: ${JSON.stringify(got.record.depths)}; the Builder shows the band for where the scroll is (scroll-depths)` : ""}`);
        label = got.name.replace(/\.[^.]+$/, "") || "Picture";
        if (el.name) label = `image “${cut(el.name, 36)}”`;
        note(sel, "src", "field", `node.picture: a reference to ${got.record.path} (${got.bytes} bytes, ${got.size.w}×${got.size.h}), the bytes committed beside the document; the address itself is kept in data as words only`);
      } else if (whole) {
        label = "svg";
        note(sel, "svgFile", "nowhere", "the svg's file was not beside the captures (--assets)");
      } else {
        label = canvas ? "canvas" : basename(new URL(el.src, cap.url).pathname);
        note(sel, "src", "nowhere", "the bytes were not supplied (--assets), so the address is kept in data as words only");
      }
    } else if (el.bgi) {
      /* A background picture on a box: the first `url()` the browser computed, carried as the box's own picture. A gradient is kept for the importer to read. */
      const urls = Array.from(el.bgi.matchAll(/url\((["']?)([^)"']+)\1\)/g)).map((m) => m[2]).filter((u) => !/^data:/.test(u));
      const got = urls.length ? pictureFor(urls[0], cap.url) : null;
      if (got) { picture = got.record; note(sel, "bgi", "field", `node.picture: the background picture ${got.record.path} (${got.size.w}×${got.size.h}), drawn behind the box`); }
      else if (urls.length) note(sel, "bgi", "nowhere", "the background picture's bytes were not supplied (--assets)");
      else note(sel, "bgi", "stored", "node.bgi: a gradient, as the browser computed it; polio draws no gradient yet");
      if ("maxw" in el) note(sel, "maxw", DEFAULT_OF.maxw(el.maxw) ? "default" : "nowhere", "");
    }

    /* The icon. */
    let vector = null;
    if (kind === "icon") {
      vector = vectorOf(el, strokes, !!cap.untransformed);
      note(sel, "vb", "field", `vector.viewBox; ${vector.paths.length} stroke${vector.paths.length === 1 ? "" : "s"} as vector.paths, drawn by drawn-icon${lineIcon ? " as outlines" : " as fills"}`);
    } else if (kind === "icon-blind") {
      if (el.vb) note(sel, "vb", "nowhere", "the strokes have no geometry to draw in it");
    }

    /* Geometry: exactly as captured. */
    for (const p of ["x", "y", "w", "h"]) note(sel, p, "field", p);
    if (el.pseudo) note(sel, "pseudo", "field", `a ${el.t} that draws, placed where the browser placed it inside its containing block: a part of its own`);
    if (el.grown) note(sel, "grown", "field", "no box at the top of the page: a script grew it as the page was scrolled, and the largest box it was seen at is kept");
    if (cap.untransformed && el.ptf) { const tf = transformOf(el, true); note(sel, "ptf", tf ? "field" : "default", tf ? `art.transform ${tf}: the box is the one the layout gave, and what moves it (its own transform after its ancestors') turns it about its centre` : "moves it by nothing"); }
    if (el.ov) note(sel, "ov", "field", `overflow ${el.ov.x} ${el.ov.y}: what pokes out of its padding box is cut from the parts inside it (clip)`);
    if (el.domId) note(sel, "domId", "field", `#${el.domId}: an in-page link to it goes to this part`);

    /* What has no field on any part. */
    if (el.mar) note(sel, "mar", "nowhere", "a node has no margin field; the box already stands where the margin put it");
    if ("minh" in el && kind !== "page") note(sel, "minh", DEFAULT_OF.minh(el.minh) ? "default" : "nowhere", DEFAULT_OF.minh(el.minh) ? "" : "a node has a size, not a constraint on one");
    if ("maxw" in el && kind !== "picture") note(sel, "maxw", DEFAULT_OF.maxw(el.maxw) ? "default" : /^[\d.]+px$/.test(el.maxw) ? "field" : "nowhere", DEFAULT_OF.maxw(el.maxw) ? "" : /^[\d.]+px$/.test(el.maxw) ? `node.maxw ${parseFloat(el.maxw)}: the width it grows to and no further` : "a share or a sum, not a px limit: the node's size stands");
    if (el.pos) {
      const relativeStill = el.pos === "relative" && (el.ins ?? []).every((v) => v === "0px" || v === "auto");
      if (relativeStill) {
        note(sel, "pos", "default", "relative with no offset");
        if (el.ins) note(sel, "ins", "default", "");
        if ("z" in el) note(sel, "z", DEFAULT_OF.z(el.z) ? "default" : "nowhere", DEFAULT_OF.z(el.z) ? "" : "stacking is the order of the nodes array, never a number");
      } else {
        note(sel, "pos", "field", `${el.pos}: the box stays where it was measured, and the band is written after the parts that flow, so it paints over them as the browser did${el.pos === "absolute" || el.pos === "fixed" ? "; kept as from.position, out of the flow" : el.pos === "sticky" ? "; kept as from.position sticky with its inset, so the published page holds it there" : ""}`);
        if (el.ins) note(sel, "ins", el.pos === "sticky" ? "field" : "nowhere", el.pos === "sticky" ? "from.inset: the sides that stick it" : "the inset that placed it; its box already carries the result");
        if ("z" in el) note(sel, "z", DEFAULT_OF.z(el.z) ? "default" : "field", DEFAULT_OF.z(el.z) ? "" : "the order of the positioned bands in the nodes array; the number itself is not kept");
      }
    }

    /* A frame of another page: what it loads and may do, and its size. */
    const embed = kind === "embed" ? { src: el.embed?.src ?? "", ...(el.embed?.allow ? { allow: el.embed.allow } : {}), ...(el.embed?.sandbox !== undefined ? { sandbox: el.embed.sandbox } : {}), ...(el.embed?.title ? { title: el.embed.title } : {}), ...(el.embed?.loading ? { loading: el.embed.loading } : {}), size: { w: el.w, h: el.h } } : null;
    if (embed) note(sel, "embed", "stored", `node.embed {src, allow, sandbox, size ${el.w}×${el.h}}: a frame of ${embedHost(embed.src)}; polio draws no embed yet, so the part is a box of that size`);
    /* Its own motion: the animation with every longhand, the transitions, and the :hover / :focus rules that move it. polio replays none of it yet. */
    let motion = el.motion || folded?.agree.motion ? { ...(el.motion ?? {}), ...(folded?.agree.motion ? { letter: folded.agree.motion } : {}) } : null;
    const base = cap.untransformed && motion?.animation?.length ? animationBaseOf(el) : null;
    if (base) { motion = { ...motion, animation: motion.animation.map((x) => ({ ...x, base })) }; note(sel, "(base)", "field", `motion.animation[].base ${base}: what its ancestors' transforms add, kept through every frame of its animation`); }
    if (el.motion) for (const [k, v] of Object.entries(el.motion)) note(sel, `motion.${k}`, "stored", `node.motion.${k}: ${v.map((x) => x.name ?? x.property ?? x.selector).join(", ")}`);

    /* Its name on the board: what it is, then what it says or holds. */
    const said = el.role ? `${el.role}${el.name ? ` “${cut(el.name, 36)}”` : ""}` : null;
    if (kind === "icon" || kind === "icon-blind") {
      const kinds = [...new Set(strokes.map((s) => s.t))];
      label = `${said ?? "icon"} · ${strokes.length} stroke${strokes.length === 1 ? "" : "s"}`;
      data = kind === "icon"
        ? `${strokes.length} stroke${strokes.length === 1 ? "" : "s"} (${kinds.join(", ")})${inks.length ? ` in ${inks.join(", ")}` : ""}`
        : `${strokes.length} stroke${strokes.length === 1 ? "" : "s"} (${kinds.join(", ")})${inks.length ? ` in ${inks.join(", ")}` : ""}; the path geometry was not captured`;
    } else if (kind === "picture") {
      /* named above */
    } else if (embed) {
      label = `${said ?? "embed"} · ${embedHost(embed.src)}`;
      data = embed.src;
    } else if (said && el.name && el.name === words) {
      label = said;
    } else if (said) {
      label = words ? `${said}: ${cut(words, 36)}` : `${said} · ${el.kids.length} inside`;
    } else if (words) {
      label = cut(words, 36);
    } else {
      label = `${el.t} · ${el.kids.length} inside`;
    }
    /* The interactive roles say what they are where the backend list is written. */
    if (["textbox", "button", "link"].includes(el.role)) data = [data, roleLine].filter(Boolean).join("; ");

    /* Options a real part reads. */
    const options = {};
    if (kind === "button") {
      // No radius was captured on any element, and the capture leaves a zero property out (as it does bg and pad), so every corner is square.
      options.shape = "square";
      // A fill the node named is painted by Fill and the part paints nothing over it; with no fill, outline is the one variant that paints nothing of its own, and the edge of none keeps it edgeless.
      options.variant = colour.bg ? "solid" : "outline";
      if (el.bg && !colour.bg) note(sel, "bg", "nowhere", `the fill could not be carried, so the variant is outline rather than a solid accent the page never had`);
      options.size = "medium";
    }
    if (kind === "heading") options.turn = "none";
    if (kind === "icon") {
      // DrawnIcon (parts/DrawnIcon.tsx): "drawn as" line or solid, "paths" how many it keeps before merging, "size" the share of the box the icon fills — 100 so it stands at the size it was measured.
      options["drawn as"] = lineIcon ? "line" : "solid";
      options.paths = String(Math.min(ICON_PATHS_MAX, Math.max(1, vector.paths.length)));
      options.size = "100";
    }

    made.push({
      el,
      /* A pseudo-element with no z-index above its element's paints with it, straight after it (a z -1 gloss inside an isolated button is over the button's fill, not under the page). */
      band: cap.untransformed && el.pseudo && !(zOf(el) > 0) ? bandOf(el.parent) : bandOf(el),
      node: {
        id: "",
        pageId: PAGE_ID,
        featureId,
        label,
        prompt: `Captured from ${host}${url.pathname}${cap.section ? ` (${cap.section})` : ""} as ${sel}. The box, the words, the colours and the type are the ones measured on the page.${roleSaid ? ` ${roleSaid}` : ""}`,
        content,
        data,
        x: el.x, y: el.y, w: el.w, h: el.h,
        groupId: null,
        options,
        priority: "must",
        custom: false,
        glyph: null,
        hue: null,
        locked: false,
        link,
        colour: Object.keys(colour).length ? colour : null,
        font,
        anim: null,
        animSpeed: 1,
        animDelay: 0,
        animEase: "smooth",
        shape: null,
        outline: null,
        kind: null,
        vector,
        role: vector ? "icon" : null,
        cube: null,
        mesh: null,
        code: null,
        aura: null,
        auraSize: 1,
        auraStyle: "glow",
        texture: null,
        ...(picture ? { picture } : {}),
        sketch: null,
        /* Out of the flow, as the capture measured it: an absolute or fixed element
           sizes nothing that holds it (his SOL WORKS badge overhangs its header on
           purpose), so a wrapper is never grown to take it in. */
        ...(radius !== null ? { radius } : {}),
        /* All four corners, clockwise from the top left, when they differ (the remote's 48 48 70 70): `radius` stays the largest. */
        ...(cap.untransformed && el.radius && !el.radius.every((r) => r === el.radius[0]) ? { radii: el.radius } : {}),
        /* A corner rounded as an ellipse (the TV screen's 28px / 34px): the across radii in \`radii\`, the down ones in \`radiiY\`. */
        ...(el.rxy ? { radii: el.rxy.map(([rx]) => rx), radiiY: el.rxy.map(([, ry]) => ry) } : {}),
        /* A height in the window's units (a hero min-height: 100vh), with the px it measured at this window. */
        ...(el.vu ? { vh: { ...el.vu, px: el.vu.minHeight ? parseFloat(el.minh) || el.h : el.h } } : {}),
        /*
         * Placed in the window's units or a share of its block, as written
         * (trumpmorty's planet `left: -16vw; top: -22vw`, its deserts
         * `bottom: 13%; height: 36%`), and the block they are taken of: the
         * window, or the positioned ancestor by its selector, its box, and
         * the part it became (named once the parts have their ids).
         */
        ...(el.au ? { units: unitsOf(el) } : {}),
        /* It takes no clicks (pointer-events: none): a sheet over the page lets them through. */
        ...(cap.untransformed && el.inert ? { inert: true } : {}),
        /* The artistic properties, as the browser computed them, for the importer to read: polio draws none of them yet. */
        ...(el.op !== undefined && el.op !== null ? { opacity: el.op } : {}),
        ...artOf(folded ? { ...el, tsh: wordsEl.tsh, tstroke: wordsEl.tstroke, porder: wordsEl.porder, letterTf: folded.agree.transform } : el, picture, !!cap.untransformed),
        /* Additive: the motion it replays (docs/motion.md) and, for a frame, what it embeds. */
        ...(motion ? { motion } : {}),
        ...(embed ? { embed } : {}),
        /* The px max-width the page gave it (stonkfun.xyz's 1440px page wrapper): polio holds it there, centred, on a wider window (check-maxwidth.mjs). */
        ...(/^[\d.]+px$/.test(el.maxw ?? "") && parseFloat(el.maxw) > 0 ? { maxw: parseFloat(el.maxw) } : {}),
        /* A long or endless list cut to a little more than one window (list-trim.js): what live had, what is kept. */
        ...(el.rows?.trimmed ? { rows: el.rows } : {}),
        /* A canvas world (worlds.mjs): the characters to press, where each stands frame by frame, and the dialog each opens (check-worlds.mjs). */
        ...(kind === "picture" && picture && el.world ? { world: worldOf(el, sel, cap.url) } : {}),
        /* A video: where it plays from and how; the backend (or a video part) plays it, the picture stands in. */
        ...(el.video ? { media: { kind: "video", ...Object.fromEntries(Object.entries(el.video).filter(([k, v]) => v !== null && v !== false && k !== "file" && k !== "at")), ...(videoFileOf(el) ? { file: videoFileOf(el) } : {}) } } : {}),
        /* A sticky band: its position and the inset that sticks it, in px, for polio's fluidSite.ts to hold it at. */
        from: { url: cap.url, host, selector: sel, at, ...(typeof el.domId === "string" && el.domId.trim() ? { id: el.domId.trim().slice(0, 64) } : {}), ...(el.pos === "absolute" || el.pos === "fixed" ? { position: el.pos } : el.pos === "sticky" ? { position: "sticky", inset: insetOf(el.ins) } : {}) },
        ...(layout ? { layout } : {}),
        ...(pad ? { pad } : {}),
        ...(edge ? { edge } : {}),
        ...(text ? { text } : {}),
      },
    });
  }

  /* The stack: what flows first, then each positioned band, lowest z-index first. */
  const bands = [...new Set(made.map((m) => m.band).filter(Boolean))];
  /*
   * The stacking context a part paints in, as CSS stacks it: the nearest
   * `relative` ancestor (itself included) with a z-index (a fixed or absolute
   * one is a band of its own; a sticky one is placed by polio). A band with none of
   * its own takes its ancestor's; a part that flows under a `relative;
   * z-index: 3` ancestor is lifted to paint with it, above a z-auto band
   * that came later in the page (trumpmorty.fun's title above its planet). A
   * band with a negative z-index is painted before the flow: its rank is
   * below the flow's 0.
   */
  /*
   * A STICKY ELEMENT WITH A Z-INDEX IS A STACKING CONTEXT TOO. sunkcoin.fun's
   * header is `position: sticky; z-index: 40` over a fixed canvas at z-index
   * 0 (the sea) and a `main` at 1. Read as flow it was written first and the
   * sea, a band written after it, painted over it: no header on the board or
   * in the Preview. A sticky one ranks by its z-index as a relative one does;
   * it keeps its place in the flow (from.position sticky) and only paints
   * where the browser painted it. `check-paint-order.mjs`.
   */
  const reach = (b) => (b.pos === "fixed" ? { x: b.x, y: 0, w: b.w, h: Math.max(b.y + b.h, page.h) } : b);
  const meets = (a, b) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
  const under = (a, b) => { for (let n = b.parent; n; n = n.parent) if (n === a) return true; return false; };
  /*
   * Only a sticky one that a later band actually paints over counts: a docs
   * page's sticky header with nothing positioned after it (SOLCINERATOR) is
   * written as the flow it was, in its place, as before.
   */
  const stuckOver = new Set(all.filter((n) => n.pos === "sticky" && n.z !== undefined && n.z !== "auto" && Number.isFinite(Number(n.z)) && bands.some((b) => b.order > n.order && !under(n, b) && meets(reach(b), n))));
  const stackOf = (el) => { for (let n = el; n && n.kind !== "page"; n = n.parent) if ((n.pos === "relative" || stuckOver.has(n)) && n.z !== undefined && n.z !== "auto" && Number.isFinite(Number(n.z))) return n; return null; };
  for (const m of made) if (!m.band) { const st = stackOf(m.el); if (st && zOf(st) > 0) m.lift = st; }
  const bandZ = (b) => (b.z && b.z !== "auto" ? zOf(b) : zOf(stackOf(b)));
  /*
   * Where a band or a lifted box paints: the z-index of the context it sits
   * in, then its own within it. trumpmorty.fun's ribbon rows are both
   * absolute inside `.tape` (relative, z-index 6): the red one has z-index 2,
   * the navy one none. Ranked by one number the navy row took the tape's 6
   * and the red row its own 2, and navy painted over red where they cross;
   * the browser paints both inside the tape, navy at 0 and red at 2 (and the
   * whole tape above a z-index 5 band outside it). `check-paint-order.mjs`.
   */
  const paintKey = (el) => { const ctx = stackOf(el.parent); return ctx ? [zOf(ctx), zOf(el)] : [zOf(el), 0]; };
  /*
   * A `relative` box paints with the positioned ones, in the order of the
   * page: share.xyz's headline sits in a `relative` box after the hero's
   * `absolute` backdrop picture, and the browser paints it over the picture.
   * Written as flow it went under the band, and the headline was gone. So a
   * part inside a relative box (z-index auto) that comes after a band of
   * z-index auto it overlaps paints with that box, after the band: the
   * outermost such box lifts everything in it together.
   */
  const flatBands = bands.filter((b) => bandZ(b) === 0);
  /*
   * A FIXED BAND MEETS THE WHOLE PAGE. sunkcoin.fun's sea is a fixed canvas,
   * `z-index: 0`, the first child of `main` (relative, z-index 1): measured at
   * scroll 0 it is the window's box, but it follows the window, so every
   * section scrolled over it is painted over it. Its relative sections
   * (`section.wrap`, `.payday > *`) come after it in the page, so the browser
   * paints them over the sea; ranked only with `main` they were written
   * before the canvas and drowned. So a band's box, for who paints over it,
   * is the page's whole height when it is fixed; and the same rule holds
   * inside a lifted context, up to the lift, between a band and a relative
   * box of the one context. `check-paint-order.mjs`.
   */
  const sameContext = (b, n) => stackOf(b.parent) === stackOf(n.parent);
  if (flatBands.length) for (const m of made) {
    if (m.band) continue;
    let over = null;
    for (let n = m.el; n && n.kind !== "page" && n !== m.lift; n = n.parent) if (n.pos === "relative" && zOf(n) === 0 && flatBands.some((b) => b.order < n.order && meets(reach(b), n) && sameContext(b, n))) over = n;
    if (over) { m.lift = over; note(m.el.sel, "(stack)", "field", `painted with its relative box (${over.sel}), after the positioned band it comes after in the page and overlaps, as the browser paints it`); }
  }
  const lifts = [...new Set(made.map((m) => m.lift).filter(Boolean))];
  const stacks = [...bands, ...lifts].map((el) => ({ el, k: paintKey(el) })).map((s) => ({ ...s, z: s.k[0] })).sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.el.order - b.el.order);
  const bandRank = new Map(stacks.map((s, i) => [s.el, s.z < 0 ? -(stacks.length - i) : i + 1]));
  const rankOf = (m) => (m.band ? bandRank.get(m.band) : m.lift ? bandRank.get(m.lift) : 0);
  made.sort((a, b) => rankOf(a) - rankOf(b) || a.el.order - b.el.order);

  /*
   * THE PAGE'S OWN BACKGROUND. A body painted with a picture or gradient
   * (parasiteonsol.fun's grid paper) is a backdrop part under everything:
   * the page's size, the body's colour and background, taking no press.
   * look.palette.bg keeps the colour alone (check-media.mjs).
   */
  const body = cap.tree;
  if (body?.t === "body" && body.bgi) {
    note("body", "bgi", "field", `a backdrop part under the page: art.background ${cut(body.bgi, 60)}`);
    made.unshift({ el: body, band: null, node: { id: "", pageId: PAGE_ID, featureId: "box", label: "page background", prompt: `The page's own background on ${host}: the body's colour and background, under everything.`, content: "", data: "", x: 0, y: 0, w: page.w, h: page.h, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: body.bg ? { bg: body.bg } : null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, inert: true, art: { background: body.bgi, ...(body.bgo ? { backgroundOptions: body.bgo } : {}) }, from: { url: cap.url, host, selector: "body", at } } });
  }

  /* Overlaps in the measured geometry: kept; the paint order settles which shows. */
  const holds = (o, i) => o.x <= i.x && o.y <= i.y && o.x + o.w >= i.x + i.w && o.y + o.h >= i.y + i.h;
  const isAncestor = (a, b) => { for (let n = b.parent; n; n = n.parent) if (n === a) return true; return false; };
  const overlaps = [];
  /* Not for a pressed state (`muted`): its overlaps are never read, and the pass is every part against every other. */
  for (let i = 0; !muted && i < made.length; i++) {
    for (let j = i + 1; j < made.length; j++) {
      const a = made[i].el, b = made[j].el;
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (w <= 0 || h <= 0 || holds(a, b) || holds(b, a)) continue;
      const kin = isAncestor(a, b) || isAncestor(b, a);
      overlaps.push({ a, b, w, h, kin, positioned: !kin && !!(made[i].band || made[j].band) && made[i].band !== made[j].band });
    }
  }

  const byKind = {};
  for (const el of all) byKind[el.kind] = (byKind[el.kind] ?? 0) + 1;
  const lists = all.filter((e) => e.rows?.trimmed).map((e) => ({ el: e, selector: e.sel }));
  return { made, bands, overlaps, byKind, elements: all.length, page, anchors, all, lists };
}

/* ------------------------------------------------------------------ */
/* Every page                                                           */
/* ------------------------------------------------------------------ */

note("(routes)", "pages", "field", `${routes.pages.length} pages, read from the site's source (routes.json)`);
/*
 * WHAT A PRESS SHOWS (capture-route.mjs --states: `cap.states`). Each state
 * is the page as it opened with what the press changed put in its place:
 * the changed elements, each at its place in the page's tree (`p`), replacing
 * the one there, or added beside its parent, or taken out. That page is read
 * as every page is (quietly: its elements were said once already), and only
 * the parts read from the changed elements are kept: the state's parts. The
 * parts of the page as it opened that they stand in for are what the press
 * hides. They go into the document after the joins and the holes, marked
 * `state`, and the press into `behaviours.states`.
 */
const within = (p, at) => !!p && (p === at || p.startsWith(`${at}>`) || p.startsWith(`${at}::`));
/*
 * A PRESS THAT ALSO TOUCHED THE PAGE ITSELF. A menu or a modal that opens
 * often locks the page's scroll or sets a class on <body> as it does, and the
 * capture then said the whole page changed (`at: "body"`, the page after the
 * press as its element): no part could be read from it. Read inside instead:
 * what came into the page with the press and what left it, topmost first. An
 * element that stayed and only changed in place (a live price) is not the
 * press's: the capture's own reading of what changes on its own is not kept.
 */
function narrowRoot(st, tree) {
  const root = tree.p ?? "body";
  if (!st.changes.some((c) => c.at === root && c.el)) return st;
  const before = new Map();
  (function go(e) { if (e.p) before.set(e.p, e); (e.kids ?? []).forEach(go); })(tree);
  const changes = [];
  for (const c of st.changes) {
    if (c.at !== root || !c.el) { changes.push(c); continue; }
    const after = new Set();
    (function go(e, up) {
      if (e.p) after.add(e.p);
      if (e.p && e.p !== root && !before.has(e.p)) { changes.push({ at: e.p, el: e, ...(up?.p ? { parent: up.p } : {}) }); return; }
      (e.kids ?? []).forEach((k) => go(k, e));
    })(c.el, null);
    const gone = [...before.keys()].filter((p) => p !== root && !after.has(p));
    for (const p of gone) if (!gone.some((q) => q !== p && within(p, q))) changes.push({ at: p, el: null });
  }
  return { ...st, changes };
}
/** A copy of a capture's plain data (objects, arrays, strings, numbers), without the parse of its text again: `convert` writes onto every element it reads. */
function cloneData(v) {
  if (Array.isArray(v)) { const a = new Array(v.length); for (let i = 0; i < v.length; i++) a[i] = cloneData(v[i]); return a; }
  if (v && typeof v === "object") { const o = {}; for (const k in v) o[k] = cloneData(v[k]); return o; }
  return v;
}
function pressedStates(pageDef, raw, base) {
  /* The capture read once, untouched: each state converts its own copy of the page (not the text parsed again per state, which took longer than the conversion). */
  const cap0 = JSON.parse(raw);
  const { states, ...rest } = cap0;
  const out = [];
  for (const st0 of states ?? []) {
    const st = narrowRoot(st0, cap0.tree);
    if (!st.changes.length) continue;
    const cap = cloneData(rest);
    const byPath = new Map();
    (function go(e, up) { byPath.set(e.p, { e, up }); (e.kids ?? []).forEach((k) => go(k, e)); })(cap.tree, null);
    const mark = (e) => { e.__st = true; (e.kids ?? []).forEach(mark); };
    for (const c of st.changes) {
      /* The page's own element, put back by the opening press: nothing to read again, its parts are the page's (below). */
      if (c.opens) continue;
      const at = byPath.get(c.at);
      if (c.el) mark(c.el);
      if (at?.up) {
        const i = at.up.kids.indexOf(at.e);
        if (c.el) at.up.kids.splice(i, 1, c.el); else at.up.kids.splice(i, 1);
      } else if (c.el && byPath.get(c.parent)) {
        const up = byPath.get(c.parent).e;
        (up.kids ??= []).push(c.el);
      }
    }
    muted = true;
    const r = convert(pageDef, cap);
    muted = false;
    notePage = pageDef.id;
    const made = r.made.filter((m) => m.el.__st);
    const changed = st.changes.filter((c) => !c.opens);
    const hides = base.made.filter((m) => changed.some((c) => within(m.el.p, c.at)));
    /* The opening press shows the page's own parts where the group's other presses change it, besides what its own press changed. */
    const opens = base.made.filter((m) => st.changes.some((c) => c.opens && within(m.el.p, c.at)) && !changed.some((c) => within(m.el.p, c.at)));
    const trigger = base.made.find((m) => m.el.p === st.trigger) ?? base.made.filter((m) => within(m.el.p, st.trigger)).sort((a, b) => b.el.w * b.el.h - a.el.w * a.el.h)[0] ?? null;
    const shows = made.length + opens.length;
    note(st.trigger ?? "(states)", "states", shows && trigger ? "field" : "nowhere", shows && trigger ? `pressing "${st.name}" shows ${made.length} parts in place of ${hides.length}${opens.length ? `, and ${opens.length} of the page as it opened` : ""}` : `pressing "${st.name}": ${trigger ? "nothing it changed became a part" : "the control became no part to press"}`);
    /* Its parts' links to places on the page (`#questions`), settled with the page's own below. */
    const anchors = r.anchors.filter((a) => made.some((m) => m.node.link === a.link));
    /*
     * A press that flashed (capture-route.mjs, presses.mjs `holdAfterPress`):
     * how long each change stayed before the page put it back (`lasts`, ms
     * after the press), and where a part came in from (`from`: a toast set
     * below the window and slid up). Both belong to the part made from that
     * change and to the part it stood in for, which comes back as it goes.
     */
    const flash = (m) => {
      const c = changed.find((x) => within(m.el.p, x.at));
      const lasts = c ? st.lasts?.[c.at] : undefined, from = c ? st.from?.[c.at] : undefined;
      return lasts === undefined && !from ? null : { ...(lasts !== undefined ? { lasts } : {}), ...(from ? { from } : {}) };
    };
    if (shows && trigger) out.push({ group: st.group, option: st.option, name: st.name, made, hides, opens, trigger, anchors, all: r.all, flash, ...(st.opening ? { opening: true } : {}), ...(st.inferred ? { inferred: st.inferred } : {}) });
  }
  return out;
}

const converted = [];
const facesRead = { faces: [], links: [] };
let first = null;
for (const p of routes.pages) {
  const file = join(routesDir, "routes", `${p.id}.json`);
  if (!existsSync(file)) { console.error(`${p.id}: no capture at ${file}`); process.exit(1); }
  const raw = readFileSync(file, "utf8");
  const cap = JSON.parse(raw);
  first ??= cap;
  for (const f of cap.faces?.faces ?? []) if (!facesRead.faces.some((g) => JSON.stringify(g) === JSON.stringify(f))) facesRead.faces.push(f);
  for (const l of cap.faces?.links ?? []) if (!facesRead.links.some((g) => g.href === l.href)) facesRead.links.push(l);
  /*
   * WHERE A PRESS WENT (capture-route.mjs, presses.mjs): a button whose script
   * loaded another page, moved the address by pushState or opened a window
   * goes there, as if it had been written as a link: its href, read like any
   * other (a page of the site, an address kept).
   */
  if (cap.pressed?.length) {
    const byP = new Map();
    (function walk(e) { if (e.p) byP.set(e.p, e); (e.kids ?? []).forEach(walk); })(cap.tree);
    for (const x of cap.pressed) {
      const el = x.does === "link" ? byP.get(x.trigger) : null;
      if (el && el.href === undefined) { el.href = x.href; el.pressedTo = true; if (x.inferred) el.hrefInferred = x.inferred.from; }
    }
  }
  const res = convert(p, cap);
  converted.push({ def: p, cap, ...res, pressed: pressedStates(p, raw, res) });
}
notePage = "";

let n = 0;
/** Which part each captured element became, for the sources section to name. */
const partOfEl = new Map();
const nodes = converted.flatMap((c) => c.made.map((m) => {
  const id = `n_${m.node.featureId.replace(/-/g, "")}_${++n}`;
  partOfEl.set(m.el, id);
  return { ...m.node, id };
}));
/*
 * THE LISTS CUT TO A WINDOW AND A LITTLE MORE (list-trim.js): each with the
 * part it became (or none: a wrapper folded away), the parts its kept items
 * became, how many items live had when it was cut and how many are kept, and
 * whether it grew as it was scrolled (`endless`) or was redrawn by the page
 * (`rebuilt`). The backend fills it with live data; the fidelity report's
 * "Functions not captured" hand-off names it for POLIO.md.
 */
const lists = converted.flatMap((c) => (c.lists ?? []).map(({ el, selector }) => {
  const items = (el.kids ?? []).map((k) => partOfEl.get(k) ?? (k.kids ?? []).map((q) => partOfEl.get(q)).find(Boolean)).filter(Boolean);
  return { page: c.def.id, selector, part: partOfEl.get(el) ?? null, items, of: el.rows.of, kept: el.rows.kept, ...(el.rows.endless ? { endless: true } : {}), ...(el.rows.rebuilt ? { rebuilt: true } : {}) };
}));
for (const l of lists) note("(lists)", "rows", "field", `${l.page} ${l.selector}: ${l.kept} of ${l.of} items kept (a window and a little more)${l.endless ? ", grows as it is scrolled" : ""}${l.rebuilt ? ", redrawn by the page" : ""}; doc.lists`);
/* The block a layer's units are taken of, by the part it became (null when it became none: a wrapper folded away). */
for (const node of nodes) {
  if (!node.units?.of || !("el" in node.units.of)) continue;
  const { el, ...of } = node.units.of;
  node.units = { ...node.units, of: { by: of.by, selector: of.selector, part: partOfEl.get(el) ?? null, box: of.box } };
}
/* The tags: a span the browser computes as an image (a "Save 71×" badge, a venue tab's chip). Its words are its own; neither arbiter touches them. */
const tagParts = new Set(converted.flatMap((c) => c.made.filter((m) => m.el.t !== "img" && m.el.role === "image").map((m) => partOfEl.get(m.el))));

/* ------------------------------------------------------------------ */
/* The faces (fonts.ts#carryFaces, transcribed)                         */
/* ------------------------------------------------------------------ */

const FORBIDS = [
  { host: /(^|\.)typekit\.(net|com)$/i, says: "Adobe Fonts' licence forbids carrying the file; its stylesheet link is kept, and the face loads from Adobe only where Adobe allows the site to" },
  { host: /(^|\.)fonts\.adobe\.com$/i, says: "Adobe Fonts' licence forbids carrying the file; its stylesheet link is kept, and the face loads from Adobe only where Adobe allows the site to" },
  { host: /(^|\.)typography\.com$/i, says: "Cloud.typography's licence forbids carrying the file; its stylesheet link is kept, and the face loads only where the licence allows" },
  { host: /(^|\.)fonts\.com$/i, says: "Monotype's licence forbids carrying the file; its stylesheet link is kept, and the face loads only where the licence allows" },
  { host: /(^|\.)myfonts\.net$/i, says: "MyFonts' licence forbids carrying the file; its stylesheet link is kept, and the face loads only where the licence allows" },
];
const OPEN = /(^|\.)(fonts\.gstatic\.com|fonts\.googleapis\.com|fonts\.bunny\.net|cdn\.jsdelivr\.net|unpkg\.com|fontlibrary\.org)$/i;
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ""; } };
const forbids = (u) => FORBIDS.find((f) => f.host.test(hostOf(u)))?.says ?? null;
const licenceOf = (u) => (OPEN.test(hostOf(u)) ? "an open face (OFL or Apache), carried with the page" : "the page's own file, carried as the page serves it; its licence is the page's");
function isLatin(range) {
  if (!range || !range.trim()) return true;
  return range.split(",").some((part) => {
    const m = /u\+([0-9a-f?]+)/i.exec(part.trim());
    if (!m) return false;
    const start = parseInt(m[1].replace(/\?/g, "0"), 16);
    return Number.isFinite(start) && start <= 0x7a;
  });
}
/**
 * Whether a range draws the letters a–z. A face split by unicode-range is
 * several rules of one family, weight and style, and a document holds one
 * file for each: gotchi.gg's Pixelify Sans is a digits-only file first and
 * Google's Latin file after it, and the first was kept. The rules whose
 * range covers a–z are taken first.
 */
function coversLetters(range) {
  if (!range || !range.trim()) return true;
  const spans = range.split(",").map((part) => {
    const m = /u\+([0-9a-f?]+)(?:-([0-9a-f]+))?/i.exec(part.trim());
    if (!m) return null;
    const lo = parseInt(m[1].replace(/\?/g, "0"), 16), hi = m[2] ? parseInt(m[2], 16) : parseInt(m[1].replace(/\?/g, "f"), 16);
    return [lo, hi];
  }).filter(Boolean);
  for (let c = 0x61; c <= 0x7a; c++) if (!spans.some(([lo, hi]) => c >= lo && c <= hi)) return false;
  return true;
}
const FORMAT_OF = [[/\.woff2(\?|#|$)/i, "woff2"], [/\.woff(\?|#|$)/i, "woff"], [/\.ttf(\?|#|$)/i, "truetype"], [/\.otf(\?|#|$)/i, "opentype"]];
function formatOf(s) {
  const f = (s.format ?? "").toLowerCase().replace(/["']/g, "");
  if (f) return /^(woff2|woff|truetype|opentype)$/.test(f) ? f : f === "ttf" ? "truetype" : f === "otf" ? "opentype" : null;
  return FORMAT_OF.find(([re]) => re.test(s.url))?.[1] ?? null;
}
const MIME = { woff2: "font/woff2", woff: "font/woff", truetype: "font/ttf", opentype: "font/otf" };
/*
 * A RULE FOR SOME CHARACTERS ONLY. gotchi.gg sets its digits in a file of
 * its own under the same family (`Pixelify Sans`, U+30-39) beside Google's
 * Latin file. Both are Latin by `isLatin`, both had one id, and the first
 * (the digits, ten glyphs) was carried as the whole face: every letter fell
 * to the fallback. A rule whose range holds no Latin letter is its own entry,
 * its range in its id, and every entry keeps its range (`unicodeRange`) so
 * the face is drawn only where the page drew it.
 */
const rangeTag = (range) => (coversLetters(range) ? "" : `:${range.toLowerCase().replace(/u\+/g, "u").replace(/[^0-9a-fu?-]+/g, "_")}`);
const fontId = (family, weight, style, range) => `font:${family.toLowerCase().replace(/\s+/g, "-")}:${(weight ?? "400").replace(/\s+/g, "-")}:${style ?? "normal"}${range ? rangeTag(range) : ""}`;
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** The fetcher: the file the capture saved under --assets, by name. */
function fetchBytes(u) {
  const file = assetFile(assetsDir, u);
  if (!file) return { error: assetsDir ? "the file was not saved beside the captures" : "no --assets folder to read it from" };
  return { bytes: readFileSync(file) };
}
/** A rule's weight as the numbers it covers: "400", "bold", "100 900". */
const weightsOf = (w) => String(w ?? "400").trim().split(/\s+/).map((x) => (x === "normal" ? 400 : x === "bold" ? 700 : Number(x))).filter(Number.isFinite);
/** A unicode-range as [lo, hi] spans; none is everything. */
function spansOf(range) {
  if (!range || !range.trim()) return [[0, 0x10ffff]];
  return range.split(",").map((part) => {
    const m = /u\+([0-9a-f?]+)(?:-([0-9a-f]+))?/i.exec(part.trim());
    if (!m) return null;
    return [parseInt(m[1].replace(/\?/g, "0"), 16), m[2] ? parseInt(m[2], 16) : parseInt(m[1].replace(/\?/g, "f"), 16)];
  }).filter(Boolean);
}
/**
 * THE RULES THE PAGE'S WORDS ARE DRAWN WITH. A face split by unicode-range
 * is many rules of one family (Google serves M PLUS Rounded 1c as 126 per
 * weight: Japanese in numbered slices, ASCII letters in one, then Latin
 * with the space and `$`), and the browser draws each character with the
 * last rule declared whose range holds it. Four rules were taken per
 * family, by whether they drew a to z: gotchi.gg's body face came as one
 * numbered slice per weight for 400 and 500, without the space or `$`, and
 * none for 700 and 800, so every line was set with a fallback's spaces and
 * its bold in a made-up weight (check-font-ranges.mjs). Now, for each weight
 * the page sets the family in, the rules chosen are the ones that win a
 * character the page's words use.
 */
function winningRules(latin, wants) {
  if (!wants || !wants.chars.size) return null;
  const groups = new Map();
  for (const f of latin) { const k = `${f.weight ?? "400"}|${f.style ?? "normal"}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
  const chosen = new Set();
  for (const w of wants.weights) {
    for (const style of new Set(latin.map((f) => f.style ?? "normal"))) {
      const inStyle = [...groups.entries()].filter(([k]) => k.endsWith(`|${style}`));
      if (!inStyle.length) continue;
      const span = (k) => { const ws = weightsOf(k.split("|")[0]); return [Math.min(...ws), Math.max(...ws)]; };
      const dist = (k) => { const [lo, hi] = span(k); return w < lo ? lo - w : w > hi ? w - hi : 0; };
      const best = inStyle.sort((a, b) => dist(a[0]) - dist(b[0]) || (w > 500 ? span(b[0])[1] - span(a[0])[1] : span(a[0])[0] - span(b[0])[0]))[0][1];
      const spans = best.map((f) => spansOf(f.unicodeRange));
      for (const c of wants.chars) {
        let win = -1;
        spans.forEach((sp, i) => { if (sp.some(([lo, hi]) => c >= lo && c <= hi)) win = i; });
        if (win >= 0) chosen.add(best[win]);
      }
    }
  }
  return chosen.size ? latin.filter((f) => chosen.has(f)) : null;
}
function carryFaces(read, used, pageUrl, wanted = new Map()) {
  const fonts = [];
  const named = [];
  let weight = 0;
  const seen = new Set();
  /*
   * ONE FILE, CARRIED ONCE. A variable face is one file its stylesheet
   * declares once per weight (trumpmorty.fun's Fredoka, from Google Fonts:
   * four rules, one file), and each rule carried it again: ~90 KB, four
   * times. A rule whose file is byte for byte one already carried for the
   * same family and style widens that entry's weight to a range instead.
   */
  const sameFile = new Map();
  for (const name of used) {
    const family = (name ?? "").trim();
    if (!family || seen.has(family.toLowerCase())) continue;
    seen.add(family.toLowerCase());
    const latin = read.faces.filter((f) => same(f.family, family) && isLatin(f.unicodeRange));
    /* The rules that draw a-z are chosen first, and are then carried in the page's order: the browser gives a character two ranges hold to the rule declared last. */
    const rules = winningRules(latin, wanted.get(family.toLowerCase())) ?? [...latin.filter((f) => coversLetters(f.unicodeRange)), ...latin.filter((f) => !coversLetters(f.unicodeRange))].slice(0, FONT_RULES_MAX).sort((a, b) => latin.indexOf(a) - latin.indexOf(b));
    if (!rules.length) {
      const link = read.links.find((l) => new RegExp(`family=${family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "(\\+|%20|\\s)")}`, "i").test(l.href));
      if (link) fonts.push({ id: fontId(family), family, source: { kind: "link", href: link.href }, from: { url: pageUrl, sheet: link.href }, licence: licenceOf(link.href), carried: true });
      else named.push(family);
      continue;
    }
    for (const rule of rules) {
      let id = fontId(family, rule.weight, rule.style, rule.unicodeRange);
      /* Two rules of one weight that both draw a to z (a numbered slice and Latin): the second keeps its range in its id. */
      if (fonts.some((f) => f.id === id && f.unicodeRange !== rule.unicodeRange)) id = `${id}:${(rule.unicodeRange ?? "").toLowerCase().replace(/u\+/g, "u").replace(/[^0-9a-fu?-]+/g, "_").slice(0, 80)}`;
      if (fonts.some((f) => f.id === id)) continue;
      const src = rule.sources.map((s) => ({ ...s, format: formatOf(s) })).find((s) => s.format);
      const base = { id, family, ...(rule.weight ? { weight: rule.weight } : {}), ...(rule.style ? { style: rule.style } : {}), ...(rule.unicodeRange ? { unicodeRange: rule.unicodeRange } : {}), from: { url: pageUrl, sheet: rule.sheet } };
      if (!src) { fonts.push({ ...base, source: { kind: "url", url: rule.sources[0]?.url ?? "" }, licence: "no source in a format a browser draws", carried: false, says: `${family} is declared in a format no browser here draws` }); continue; }
      const no = forbids(src.url);
      if (no) { fonts.push({ ...base, source: rule.sheet ? { kind: "link", href: rule.sheet } : { kind: "url", url: src.url, format: src.format }, licence: no, carried: false, says: `${family} could not be carried: ${no}` }); continue; }
      const got = fetchBytes(src.url);
      if (got.error !== undefined) { fonts.push({ ...base, source: { kind: "url", url: src.url, format: src.format }, licence: licenceOf(src.url), carried: false, says: `${family} could not be fetched from ${src.url}: ${got.error}` }); continue; }
      const size = got.bytes.length;
      if (size > FONT_FILE_MAX || weight + size > FONT_TOTAL_MAX) { fonts.push({ ...base, source: { kind: "url", url: src.url, format: src.format }, licence: licenceOf(src.url), carried: false, says: `${family} could not be carried: its file is ${Math.round(size / 1024)}KB, past the ${Math.round(FONT_FILE_MAX / 1024)}KB a face may weigh` }); continue; }
      const same = `${family.toLowerCase()}|${rule.style ?? "normal"}|${rule.unicodeRange ?? ""}|${createHash("sha1").update(got.bytes).digest("hex")}`;
      const had = sameFile.get(same);
      if (had) {
        const ws = [...weightsOf(had.weight), ...weightsOf(rule.weight)];
        const lo = Math.min(...ws), hi = Math.max(...ws);
        const was = had.id;
        had.weight = lo === hi ? String(lo) : `${lo} ${hi}`;
        had.id = fontId(family, had.weight, rule.style, rule.unicodeRange);
        note("(faces)", family, "folded", `weight ${rule.weight ?? "400"}: the same file as ${was}, so that entry is carried once for both (${had.id})`);
        continue;
      }
      weight += size;
      const entry = { ...base, source: { kind: "data", src: `data:${MIME[src.format] ?? "font/woff2"};base64,${Buffer.from(got.bytes).toString("base64")}`, format: src.format }, licence: licenceOf(src.url), carried: true, bytes: size };
      sameFile.set(same, entry);
      fonts.push(entry);
    }
  }
  /* A range is kept where it decides something: a family carried as more than one rule. One rule alone draws what it has either way. */
  for (const f of fonts) if (f.unicodeRange && fonts.filter((g) => g.family === f.family).length < 2) delete f.unicodeRange;
  return { fonts, named };
}
const used = [...new Set(nodes.map((nd) => nd.font?.face).filter(Boolean))];
const generics = [...new Set(converted.flatMap((c) => c.made.map((m) => m.el.ff)).filter((f) => f && GENERIC.test(f)))];
/* The characters and weights each face is set in, across every page: the rules that draw them are the ones carried. */
const wanted = new Map();
for (const nd of nodes) {
  const runs = Array.isArray(nd.content) ? nd.content : [{ text: typeof nd.content === "string" ? nd.content : "" }];
  for (const r of runs) {
    const face = (r.face ?? nd.font?.face ?? "").trim().toLowerCase();
    if (!face) continue;
    if (!wanted.has(face)) wanted.set(face, { chars: new Set(), weights: new Set() });
    const w = wanted.get(face);
    for (const ch of String(r.text ?? "")) w.chars.add(ch.codePointAt(0));
    w.weights.add(Number(r.weight ?? nd.font?.weight ?? 400) || 400);
  }
}
const carried = carryFaces(facesRead, used, routes.site, wanted);
const declared = [...new Set(facesRead.faces.map((f) => f.family))];
for (const f of carried.fonts) note("(faces)", f.family, f.carried ? "field" : "stored", f.carried ? `look.fonts: ${f.id}, ${Math.round((f.bytes ?? 0) / 1024)}KB as ${f.source.kind}; ${f.licence}` : `look.fonts, by address: ${f.says}`);
for (const f of carried.named) note("(faces)", f, "nowhere", "a system face: no rule declares it, so it is named and needs no file");
for (const f of declared) if (!used.some((u) => same(u, f))) note("(faces)", f, "default", "declared by the page but no captured element is set in it, so it is not carried");
for (const g of generics) note("(faces)", g, "nowhere", `a generic keyword: the machine's own face, a different face on a different machine, and it cannot be carried — every box set in it was measured in this machine's`);

/* ------------------------------------------------------------------ */
/* The joins, settled by the boxes (join-arbiter.mjs)                   */
/* ------------------------------------------------------------------ */

/*
 * `own()` joined each element's text nodes with a space and trimmed the
 * ends, so a part's words can carry a space the page never drew ("$ 116.59")
 * or have lost one it did (" project"). The box was measured off the laid-out
 * page, so it settles which, and only where it can: one candidate space, or
 * one touching neighbour. Anything else is left as captured and noted. The
 * widths are this machine's; the ledger says what they were.
 */
{
  const measured = await measureParts(nodes, carried.fonts, BASE_PX);
  if (!measured) {
    note("(joins)", "text", "nowhere", "not settled: no browser to measure in (set PLAYWRIGHT_MODULE), so every part keeps its words as captured");
    console.warn("joins: no Playwright found, so the captured joins are kept as they are");
  } else {
    note("(joins)", "metrics", "field", `measured on this machine: "$116.59" in the site's monospace is ${measured.probe.toFixed(1)}px; the capture recorded that box at 59`);
    const byId = new Map(nodes.map((x) => [x.id, x]));
    for (const v of verdicts(nodes, measured, BASE_PX, tagParts)) {
      const part = byId.get(v.id);
      notePage = v.pageId;
      if (v.verdict === "unclear") {
        note(v.sel, "text", "stored", `kept as captured, ${JSON.stringify(v.text)}: ${v.why} (words ${v.words}px in a ${v.inner}px box)`);
        continue;
      }
      if (part.label === part.content) part.label = v.to.trim();
      part.content = v.to;
      note(v.sel, "text", "field", v.verdict === "drop"
        ? `content ${JSON.stringify(v.to)}: the join put a space in that the page did not draw; ${JSON.stringify(v.text)} is ${v.words}px in a ${v.inner}px box, one space (${v.space}px) too wide`
        : `content ${JSON.stringify(v.to)}: the trim took a space the page drew; ${JSON.stringify(v.text)} is ${v.words}px in a ${v.inner}px box, exactly one space (${v.space}px) short, and a run touches it on the ${v.verdict === "lead" ? "left" : "right"}`);
    }
    notePage = "";
  }
}

/* ------------------------------------------------------------------ */
/* The holes, filled from inside (hole-arbiter.mjs)                     */
/* ------------------------------------------------------------------ */

/*
 * A sentence whose own words were read without the elements inside it takes
 * their words back, where its measured line puts them; the elements stop
 * being parts. Run after the joins, so a child's words are already settled
 * (the footer's " project" has its space). Spacing the box cannot tell apart
 * follows the convention, and the ledger says so, per sentence.
 */
{
  /** A child's words as a run of the sentence `p` it is folded into: its ink, weight, face, link, and a chip's dress. */
  const runOf = (k, p) => {
    const s = { text: k.content };
    if (k.colour?.text) s.colour = k.colour.text;
    if (k.font?.weight && k.font.weight !== (p.font?.weight ?? 400)) s.weight = k.font.weight;
    if (k.font?.face && k.font.face !== p.font?.face) s.face = k.font.face;
    /* sunkcoin.fun's "your sunk cost." and "buys the dip": the same serif, slanted and lighter and orange, inside its heading. */
    if (k.font?.italic && !p.font?.italic) s.italic = true;
    /* Its own size where the sentence's is not it (a <small>, a <sup>): in px, as the chip below keeps its. */
    if (k.font?.px && p.font?.px && k.font.px !== p.font.px) s.size = k.font.px;
    if (k.link) s.link = k.link;
    /* Words with no ink of their own: outlined (-webkit-text-stroke) or a gradient clipped to them (background-clip: text). Their colour stays the transparent ink the page set. */
    if (k.art?.textStroke) s.textStroke = k.art.textStroke;
    if (k.art?.backgroundClip === "text" && k.art.background) s.fill = { image: k.art.background, clip: "text" };
    /* A chip in the sentence (parasiteonsol.fun's dark "HOST" tag) keeps its fill, padding and rounding: white words on nothing were gone (check-chips.mjs). */
    if (k.colour?.bg && k.colour.bg !== p.colour?.bg) {
      s.bg = k.colour.bg;
      if (k.pad) s.pad = [k.pad.top ?? 0, k.pad.right ?? 0, k.pad.bottom ?? 0, k.pad.left ?? 0];
      if (k.radius) s.radius = k.radius;
      /* A chip is its own small label: its size, where it is not the sentence's. */
      if (k.font?.px && k.font.px !== p.font?.px) s.size = k.font.px;
    }
    return s;
  };
  /*
   * WORDS ON ONE LINE BESIDE ELEMENTS, recorded run by run (inline-runs.mjs):
   * put back in the order the page drew them, before the arbiter guesses.
   */
  const handled = new Set(tagParts);
  {
    const elOfPart = new Map([...partOfEl].map(([el, id]) => [id, el]));
    const gone = new Set();
    const after = new Map();
    /*
     * The deepest first, so a child that folds its own children (mochi's
     * "86.7%" holding its "▼") is runs before the sentence holding it takes
     * them; the other way round, the sentence took the child's words alone
     * and the ▼ went with the child.
     */
    const kidRuns = (k, p) => {
      if (!Array.isArray(k.content)) return runOf(k, p);
      const dress = runOf({ ...k, content: "" }, p);
      delete dress.text;
      return k.content.map((r) => ({ ...dress, ...r }));
    };
    for (const line of inlineLines(nodes, (id) => elOfPart.get(id), tagParts).reverse()) {
      const { p, kids } = line;
      notePage = p.pageId;
      const was = p.content;
      handled.add(p.id);
      if (line.mode === "fold") {
        const el = elOfPart.get(p.id);
        const row = /flex$/.test(el?.disp ?? "") && !/column/.test(el?.dir ?? "") ? { gap: parseFloat(el.gap) || 0, fs: el.fs ?? p.font?.px ?? BASE_PX } : null;
        p.content = foldRuns(line.runs, (k) => kidRuns(k, p), row);
        /*
         * ITS OWN PADDING, AND NO ROOM ROUND ITS WORDS ALONE. Set where the page
         * drew its words beside its children (`tb`), the part was padded by
         * their room; folded, the children are runs of the words, and that room
         * is not the words' any more. mochi's "▼ 91.7%" kept 15 on the left and
         * 1 + 2 round an 18px inside, so the ▼ drew 15px right and the 21px
         * line grew the part by 3 (check-fold-pad.mjs).
         */
        const own = Array.isArray(el?.pad) ? el.pad : null;
        p.pad = own && own.some((v) => v > 0) ? { top: own[0], right: own[1], bottom: own[2], left: own[3] } : null;
        const reads = p.content.map((x) => x.text).join("");
        if (p.label === was) p.label = reads;
        for (const k of kids) { gone.add(k.id); handled.add(k.id); }
        note(p.from.selector, "ot", "field", `${JSON.stringify(was)} -> ${JSON.stringify(reads)}: its own words and ${kids.length} element${kids.length === 1 ? "" : "s"}${line.ordered ? "" : " on one line"}, in the order the page drew them (each run's box recorded), folded in as runs with the spaces its text holds${line.ordered ? "; by the order the page wrote them (`before` on each run), so a sentence that wraps folds too, its <br>s kept" : ""}`);
      } else {
        const made = line.own.map((o) => wordsPart(p, o, `n_prose_${++n}`));
        p.content = "";
        /*
         * NO WORDS OF ITS OWN LEFT: A BOX. Left a words part with no words, the
         * Builder filled thesolface's sign-off row with sample prose over the
         * real words, and its label still named it by the words it gave away
         * (check-split-holder-box.mjs). It keeps its look and its place.
         */
        if (p.featureId === "prose" || p.featureId === "value-prop") p.featureId = "box";
        const said = String(was ?? "").replace(/\s+/g, " ").trim().slice(0, 12);
        if (said && String(p.label ?? "").replace(/\s+/g, " ").includes(said)) p.label = "";
        for (const k of kids) handled.add(k.id);
        for (const m of made) handled.add(m.id);
        after.set(p.id, made);
        note(p.from.selector, "ot", "field", `${JSON.stringify(was)} -> ${made.length} part${made.length === 1 ? "" : "s"} of its own words (${made.map((m) => JSON.stringify(m.content)).join(", ")}), each at the box the page drew it in, between its ${kids.length} element${kids.length === 1 ? "" : "s"}, which stay parts: ${SPLIT_WHY(kids)}`);
      }
    }
    notePage = "";
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (gone.has(nodes[i].id)) { nodes.splice(i, 1); continue; }
      const made = after.get(nodes[i].id);
      if (made) nodes.splice(i + 1, 0, ...made);
    }
  }
  /* Older captures: two or more elements with room for words between them are not one block of words (the nav's links between its bars); left as captured. */
  const apart = ({ kids }) => kids.some((k, i) => { const nx = kids[i + 1]; return nx && (Math.abs(nx.y - k.y) > 2 || nx.x - (k.x + k.w) > 0.4 * (k.font?.size ?? 1) * BASE_PX); });
  const holes = holesIn(nodes, handled).filter((h) => {
    if (h.kids.length < 2 || !apart(h)) return true;
    notePage = h.p.pageId;
    note(h.p.from.selector, "text", "stored", `kept as captured: ${h.kids.length} elements with words between them, and the capture did not record where each of its own words is`);
    notePage = "";
    return false;
  });
  const placed = await placeHoles(holes, carried.fonts, BASE_PX);
  if (!placed) {
    if (holes.length) note("(holes)", "text", "nowhere", `not filled: no browser to measure in, so ${holes.length} sentences keep their words as captured and their elements stay parts`);
  } else {
    const gone = new Set();
    holes.forEach(({ p, kids }, i) => {
      const r = placed[i];
      notePage = p.pageId;
      if (r.place === null) { note(p.from.selector, "text", "stored", `kept as captured: ${r.why}`); return; }
      const run = (k) => runOf(k, p);
      const was = p.content;
      const runs = [...(r.A + r.before ? [{ text: r.A + r.before }] : []), ...kids.map(run), ...(r.after + r.B ? [{ text: r.after + r.B }] : [])];
      const reads = runs.map((x) => x.text).join("");
      if (p.label === was) p.label = reads;
      p.content = runs;
      for (const k of kids) gone.add(k.id);
      note(p.from.selector, "text", "field", `${JSON.stringify(was)} -> ${JSON.stringify(reads)}: ${kids.length} element${kids.length === 1 ? "" : "s"} folded back in as run${kids.length === 1 ? "" : "s"} (${kids.map((k) => k.from.selector.split(" > ").pop()).join(", ")}), placed where the line puts the first at its recorded x (${r.off >= 0 ? "+" : ""}${r.off}px); spacing ${r.measured ? "MEASURED" : `CONVENTION (the box allows ${r.readings} spacings and cannot tell them apart; chose ${JSON.stringify(r.A.slice(-8) + r.before + "…" + r.after + r.B.slice(0, 8))})`}`);
    });
    notePage = "";
    for (let i = nodes.length - 1; i >= 0; i--) if (gone.has(nodes[i].id)) nodes.splice(i, 1);
    note("(holes)", "parts", "folded", `${gone.size} parts folded into ${holes.filter((_, i) => placed[i].place !== null).length} sentences`);
  }
}

/* ------------------------------------------------------------------ */
/* The pressed states' parts, after the joins and the holes             */
/* ------------------------------------------------------------------ */

/* Each state's parts join the document marked with the press that shows them (`state`); the parts of the page as it opened are never touched. Kept apart from the joins and the holes: those read parts by where they sit, and a state's parts sit where the parts they stand in for do. */
/** The part a captured element's path became, or the nearest part holding it. */
function partByTrigger(c, path) {
  if (!path) return null;
  let found = null;
  (function walk(e) { if (found) return; if (e.p === path) { found = e; return; } (e.kids ?? []).forEach(walk); })(c.cap.tree);
  for (let e = found; e; e = e.parent) { const id = partOfEl.get(e); if (id) return id; }
  return null;
}
const pressedOut = [];
for (const c of converted) {
  for (const st of c.pressed ?? []) {
    const group = `${c.def.id}:g${st.group}`;
    const shows = st.made.map((m) => {
      const id = `n_${m.node.featureId.replace(/-/g, "")}_${++n}`;
      partOfEl.set(m.el, id);
      nodes.push({ ...m.node, id, state: { group, option: st.option } });
      return id;
    });
    for (const node of shows.length ? nodes.slice(-shows.length) : []) {
      if (!node.units?.of || !("el" in node.units.of)) continue;
      const { el, ...of } = node.units.of;
      node.units = { ...node.units, of: { by: of.by, selector: of.selector, part: partOfEl.get(el) ?? null, box: of.box } };
    }
    const alive = new Set(nodes.map((x) => x.id));
    const hides = st.hides.map((m) => partOfEl.get(m.el)).filter((id) => id && alive.has(id));
    const opens = [...new Set(st.opens.map((m) => partOfEl.get(m.el)).filter((id) => id && alive.has(id)))];
    const trigger = partOfEl.get(st.trigger.el);
    /* A twin's state was not pressed: told from its representative's (capture-route.mjs, TWINS), and said so, with the part it was told from. */
    const from = st.inferred ? partByTrigger(c, st.inferred.from) : null;
    /* What flashed: each part's time and where it came in from, the parts shown and the ones they stood in for alike. */
    const timing = [];
    st.made.forEach((m, i) => { const f = st.flash?.(m); if (f) timing.push({ part: shows[i], ...f }); });
    for (const m of st.hides) { const id = partOfEl.get(m.el), f = st.flash?.(m); if (f?.lasts !== undefined && id && alive.has(id) && !timing.some((t) => t.part === id)) timing.push({ part: id, lasts: f.lasts }); }
    if (timing.length) note(st.name, "states", "field", `pressing "${st.name}" flashes: ${timing.map((t) => `${t.part}${t.lasts !== undefined ? ` for ${t.lasts} ms` : ""}${t.from ? ` in from ${JSON.stringify(t.from)}` : ""}`).join(", ")}`);
    if (trigger && alive.has(trigger) && shows.length + opens.length) pressedOut.push({ page: c.def.id, group, option: st.option, name: st.name, part: trigger, shows: [...shows, ...opens], hides, ...(timing.length ? { timing } : {}), ...(st.opening ? { opening: true } : {}), ...(st.inferred ? { inferred: { from } } : {}) });
  }
}

/* ------------------------------------------------------------------ */
/* In-page anchors, settled now every part has its id                  */
/* ------------------------------------------------------------------ */

/*
 * trumpmorty.fun's nav and remote go to `#lore`, `#buy`, `#chart`,
 * `#roadmap`: places on the one page, not the home page. A link to `#id` on
 * its own page goes to the part the element with that id became
 * (`{ kind: "node" }`, polio's in-page link), or, when that element became
 * no part of its own, to the nearest part holding it; to the top of the page
 * when it was the page itself; and stays the address `#id` when no element
 * on the page has that id.
 */
{
  const alive = new Set(nodes.map((x) => x.id));
  for (const c of converted) {
    notePage = c.def.id;
    /* A press's parts too (an answer's "back to the questions"): the place is looked for on the page, then in what the press shows. */
    for (const a of [...c.anchors, ...(c.pressed ?? []).flatMap((st) => (st.anchors ?? []).map((x) => ({ ...x, all: st.all })))]) {
      const target = c.all.find((e) => e.domId === a.id) ?? a.all?.find((e) => e.domId === a.id);
      let part = null;
      for (let e = target; e && !part; e = e.parent) { const id = partOfEl.get(e); if (id && alive.has(id)) part = id; }
      if (part) { a.link.target = part; note(a.sel, "href", "field", `link (node ${part}): #${a.id} is the element made into that part, on this page`); }
      else if (target) { a.link.kind = "page"; a.link.target = c.def.id; note(a.sel, "href", "field", `link (page ${c.def.id}): #${a.id} is the page itself, so the link goes to its top`); }
      else { a.link.kind = "url"; a.link.target = `#${a.id}`; note(a.sel, "href", "stored", `link (url #${a.id}): no element on the page has that id, so the anchor is kept as written`); }
    }
  }
  notePage = "";
}

/* ------------------------------------------------------------------ */
/* Where the live values come from (sources-recorder.js)                */
/* ------------------------------------------------------------------ */

/*
 * A capture taken with `--sources` says which address each live value came
 * from and which element it fed. Here the element becomes the part it was
 * made into (or, where it was folded into a button or a sentence, the part
 * that holds it), and the same address seen on several pages is one
 * source. The section is optional and versioned: a capture without it adds
 * nothing to the document, so the committed captures convert as they did,
 * and polio's importer (docTake.ts), which reads the fields it knows, takes
 * the document as it always has.
 */
const SOURCES_VERSION = 1;
const sourcesSection = (() => {
  const withSources = converted.filter((c) => c.cap.sources && Array.isArray(c.cap.sources.sources));
  if (!withSources.length) return null;
  const alive = new Set(nodes.map((x) => x.id));
  const partFor = (el) => { for (let e = el; e; e = e.parent) { const id = partOfEl.get(e); if (id && alive.has(id)) return id; } return null; };
  const sources = [];
  const feeds = [];
  const idOf = (key) => `src_${createHash("sha1").update(key).digest("hex").slice(0, 8)}`;
  for (const c of withSources) {
    const s = c.cap.sources;
    notePage = c.def.id;
    if (s.version !== SOURCES_VERSION) { note("(sources)", "version", "nowhere", `a sources section of version ${s.version}; this converter reads version ${SOURCES_VERSION}, so it is left out`); continue; }
    const local = new Map();
    for (const src of s.sources) {
      const id = idOf(src.key ?? `${src.kind} ${src.method} ${src.url} ${src.rpc ?? ""}`);
      local.set(src.id, { id, src });
      const { id: _local, key: _key, ...rest } = src;
      const had = sources.find((x) => x.id === id);
      if (!had) sources.push({ id, ...rest, pages: [c.def.id] });
      else {
        if (!had.pages.includes(c.def.id)) had.pages.push(c.def.id);
        had.needsWallet = had.needsWallet || !!src.needsWallet;
        /* The page that watched it longest says how often it refreshes. */
        if ((src.count ?? 0) > (had.count ?? 0)) Object.assign(had, { count: src.count, everyMs: src.everyMs, steady: src.steady });
      }
    }
    const els = [];
    (function walk(el) { if (el.feeds) els.push(el); el.kids.forEach(walk); })(c.cap.tree);
    for (const f of s.feeds ?? []) {
      const el = els.find((e) => e.feeds.includes(f.id));
      const src = local.get(f.source);
      if (!el || !src) { note("(sources)", "feed", "nowhere", `feed ${f.id}: ${!el ? "no captured element carries it (it was not visible when the page was dumped)" : "its source is not in the capture"}`); continue; }
      const part = partFor(el);
      if (!part) { note("(sources)", "feed", "nowhere", `feed ${f.id}: its element became no part`); continue; }
      feeds.push({
        part,
        page: c.def.id,
        source: src.id,
        path: f.path,
        ...(f.scale !== 1 ? { scale: f.scale } : {}),
        everyMs: src.src.everyMs ?? null,
        confidence: f.confidence,
        seen: f.seen,
        shown: f.shown,
        needsWallet: !!src.src.needsWallet,
        ...(f.alternatives ? { alternatives: f.alternatives } : {}),
      });
      note(el.sel ?? "(sources)", "feeds", "field", `sources.feeds: ${part} from ${src.src.method} ${src.src.url} at ${f.path}${src.src.everyMs ? `, every ${src.src.everyMs}ms` : ""}, confidence ${f.confidence}`);
    }
    note("(sources)", "sources", "field", `${s.sources.length} sources, ${(s.feeds ?? []).length} feeds, watched ${Math.round((s.watchedMs ?? 0) / 1000)}s`);
  }
  notePage = "";
  return { version: SOURCES_VERSION, sources, feeds };
})();

/* ------------------------------------------------------------------ */
/* What the page's scripts do (behaviours-recorder.js)                  */
/* ------------------------------------------------------------------ */

/*
 * A capture taken with `--behaviours` says what the page's own script does
 * to it, which no stylesheet names: a loader over the page as it opens, an
 * intro, sections revealed as they scroll in, a header that changes once
 * the page is scrolled, layers that follow the pointer, a marquee, and the
 * loops that run forever. Each element the recorder named (`bh`) becomes
 * the part it was made into; where it was folded into another part, that
 * part, said so with `folded: true`; where it was not kept at all, no part.
 * Optional and versioned like `sources`: a capture without it adds nothing,
 * so the committed captures convert as they did (docs/behaviours.md).
 */
const BEHAVIOURS_VERSION = 1;
const behavioursSection = (() => {
  const withB = converted.filter((c) => c.cap.behaviours && c.cap.behaviours.version !== undefined);
  if (!withB.length) return null;
  const alive = new Set(nodes.map((x) => x.id));
  const out = { version: BEHAVIOURS_VERSION, intro: [], reveal: [], scrollClass: [], pointer: [], loops: [], idle: [] };
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
  for (const c of withB) {
    const b = c.cap.behaviours;
    notePage = c.def.id;
    if (b.version !== BEHAVIOURS_VERSION) { note("(behaviours)", "version", "nowhere", `a behaviours section of version ${b.version}; this converter reads version ${BEHAVIOURS_VERSION}, so it is left out`); continue; }
    const elOf = new Map();
    for (const e of c.all) for (const id of e.bh ?? []) elOf.set(id, e);
    /** The part an element became, or the part it was folded into. */
    const at = (bid) => {
      const el = elOf.get(bid);
      if (!el) return { part: null, kept: false };
      for (let e = el; e; e = e.parent) { const id = partOfEl.get(e); if (id && alive.has(id)) return { part: id, ...(e === el ? {} : { folded: true }), sel: el.sel }; }
      return { part: null, kept: true, sel: el.sel };
    };
    const place = (bid, what) => {
      const p = at(bid);
      note(p.sel ?? "(behaviours)", "bh", p.part ? "field" : "nowhere", p.part ? `behaviours.${what}: part ${p.part}${p.folded ? " (the part it was folded into)" : ""}` : `behaviours.${what}: ${p.kept ? "the element became no part" : "the element was not kept by the capture (it painted nothing when measured)"}`);
      return { part: p.part, ...(p.folded ? { folded: true } : {}), ...(p.sel ? { selector: p.sel } : {}) };
    };
    /* The loader: gone by the time of the dump, so it is kept as what it showed. */
    /* A fixed sheet over the window that shows nothing (no words, no picture) is not a loader. */
    for (const l of (b.loaders ?? []).filter((x) => (x.words ?? []).length || (x.pictures ?? []).length)) {
      if (out.loader) break;
      const words = (l.words ?? []).map((w) => ({ text: w.text, ...(w.size ? { size: w.size } : {}), ...(w.cls ? { cls: w.cls } : {}) }));
      const counts = [];
      let label = null;
      for (const t of (l.texts ?? []).map((x) => x.split("\n").find((line) => /\d\s*%/.test(line)) ?? "")) {
        const m = /([A-Za-z]+)?\s*(\d{1,3})\s*%/.exec(t);
        if (!m) continue;
        const v = Number(m[2]);
        if (counts.at(-1) !== v) counts.push(v);
        if (m[1] && !label) label = m[1];
      }
      const channel = words.map((w) => w.text).find((t) => /^CH\s*\d+$/i.test(t)) ?? null;
      const ranked = words.filter((w) => w.text !== channel && !/\d+\s*%/.test(w.text) && !/^●/.test(w.text)).sort((p, q) => (q.size ?? 0) - (p.size ?? 0));
      out.loader = {
        covers: true,
        words, counts, label, channel,
        title: ranked[0]?.text ?? null,
        ticker: ranked[1]?.text ?? null,
        pictures: l.pictures ?? [],
        canvases: l.canvases ?? 0,
        animations: l.animations ?? [],
        lastedMs: (l.gone ?? l.hidden ?? l.from) - l.from,
        off: l.off ?? null,
        /* From the navigation's start (ms): when it was seen, switched off, gone. `nav.off` is when the page starts to show through; a player times its own switch-off to it. */
        ...(l.nav && Number.isFinite(l.nav.off) ? { nav: l.nav } : {}),
        removed: !!l.removed,
        bodyClass: l.bodyClass ?? [],
        ...(l.bodyOff ? { bodyOff: l.bodyOff } : {}),
      };
      /* The window as the loader stood over it (capture-route.mjs, THE LOADING SCREEN AS IT LOOKED): one svg that plays once and holds its last picture, the Builder's `loader-film`. */
      if (l.film?.frames?.length) {
        const svg = flipbookOf({ frames: { frames: l.film.frames, steps: l.film.steps }, w: l.film.w, h: l.film.h, __st: true });
        const bytes = svg ? Buffer.from(svg) : null;
        const key = bytes ? `loader-film:${createHash("sha1").update(bytes).digest("hex")}` : null;
        const got = bytes ? pictures.get(key) ?? pictureOf(key, "loader-film.svg", bytes) : null;
        if (got) {
          out.loader.film = { picture: { id: got.record.id, path: got.record.path, w: got.record.w, h: got.record.h }, frames: l.film.frames.length, from: l.film.from, to: l.film.to };
          note("(behaviours)", "loader.film", "field", `behaviours.loader.film: ${l.film.frames.length} pictures of the window under the loader, ${l.film.from}-${l.film.to}ms after the navigation started, played once as ${got.record.path}`);
        } else note("(behaviours)", "loader.film", "nowhere", `${l.film.frames.length} pictures of the loader made no picture`);
      }
      note("(behaviours)", "loader", "field", `behaviours.loader: a fixed element over the window reading ${JSON.stringify(out.loader.title)}, counting ${counts.length} values to ${counts.at(-1)}, ${out.loader.lastedMs}ms, switched off with .${l.off?.class ?? "?"}${out.loader.nav ? ` ${out.loader.nav.off}ms after the navigation started` : ""}`);
    }
    for (const a of b.intro ?? []) out.intro.push({ ...place(a.el, "intro"), keyframes: a.keyframes, duration: num(a.duration), delay: num(a.delay), easing: a.easing, fill: a.fill, iterations: a.iterations, atMs: a.t });
    for (const r of b.reveal ?? []) out.reveal.push({ ...place(r.el, "reveal"), class: r.class, rest: r.rest, shown: r.shown, transition: r.transition, delayMs: r.delayMs, atScroll: r.atScroll, top: r.top, enterAt: r.enterAt });
    for (const s of b.scrolled ?? []) out.scrollClass.push({ ...place(s.el, "scrollClass"), class: s.class, at: s.at, toggles: s.toggles, before: s.before, after: s.after, transition: s.transition, ...(s.rules?.length ? { rules: s.rules } : {}) });
    for (const p of b.pointer ?? []) out.pointer.push({ ...place(p.el, "pointer"), kind: p.kind, at: p.at, ...(p.kind === "move" ? { perX: p.perX, perY: p.perY, ...(p.perScroll !== undefined ? { perScroll: p.perScroll } : {}) } : {}), ...(p.depth !== null && p.depth !== undefined ? { depth: num(p.depth) } : {}) });
    for (const e of c.all) {
      const q = e.cssMarquee, part = partOfEl.get(e);
      if (!q || !part || !alive.has(part)) continue;
      out.loops.push({ part, selector: e.sel, kind: "marquee", css: true, name: q.name, speed: q.speed, direction: q.direction, copies: q.copies, width: q.width, loopWidth: q.loopWidth, gap: q.gap });
      note(e.sel, "(marquee)", "field", `behaviours.loops: part ${part}, a stylesheet marquee at ${q.speed}px/s ${q.direction}, gap ${q.gap}px`);
    }
    for (const l of b.loops ?? []) out.loops.push({ ...place(l.el, "loops"), kind: l.kind, speed: l.speed, ...(l.perFrame !== undefined ? { perFrame: l.perFrame, fps: l.fps } : {}), ...(l.clock ? { clock: l.clock } : {}), ...(l.slowed ? { slowed: l.slowed } : {}), direction: l.direction, copies: l.copies, width: l.width, loopWidth: l.loopWidth });
    for (const f of b.forever ?? []) out.idle.push({ ...place(f.el, "idle"), ...(f.pseudo ? { pseudo: f.pseudo } : {}), name: f.name, css: f.css, duration: num(f.duration), easing: f.easing, delay: num(f.delay), direction: f.direction });
    /* Motion sampled as drawn (motion-drive.mjs): spins, floats, hovers, the scroll's own, canvases repainted. */
    if (b.motion) {
      const m = (out.motion ??= { spin: [], float: [], hover: [], scrollSpeed: [], scrollGrow: [], canvases: [] });
      /* Only a page with a fixed progress bar has the key, so every other document is as it was. */
      const on = (list, what, extra = () => ({})) => (list ?? []).map((x) => { const { el, ...r } = x; return { ...place(el, `motion.${what}`), ...r, ...extra(x) }; });
      m.spin.push(...on(b.motion.spin, "spin"));
      m.float.push(...on(b.motion.float, "float"));
      m.hover.push(...on(b.motion.hover, "hover", (h) => { const p = at(h.host); return { host: p.part ?? null }; }));
      m.scrollSpeed.push(...on(b.motion.scrollSpeed, "scrollSpeed"));
      m.scrollGrow.push(...on(b.motion.scrollGrow, "scrollGrow"));
      if (b.motion.scrollProgress?.length) (m.scrollProgress ??= []).push(...on(b.motion.scrollProgress, "scrollProgress"));
      /* A canvas is no part: its box, and the parts painted either side of it, where polio puts a layer of its own. */
      for (const c of b.motion.canvases ?? []) {
        const { el, host, below, above, ...r } = c;
        const self = at(el), side = (id) => (id ? at(id) : { part: null });
        m.canvases.push({ ...(self.part ? { part: self.part } : {}), ...(self.sel ? { selector: self.sel } : {}), host: side(host).part ?? null, below: side(below).folded ? null : side(below).part ?? null, above: side(above).folded ? null : side(above).part ?? null, ...r });
        note(self.sel ?? "(behaviours)", "bh", "field", `behaviours.motion.canvases: a ${r.kind} canvas at ${JSON.stringify(r.box)}${r.kind === "particles" ? `, ${r.specks} specks drifting ${r.drift}` : ""}`);
      }
      /*
       * Pictures of what moves (frames-drive.mjs): each moving part's frames
       * played back as one svg at its own size, as a canvas's are, kept as a
       * picture of the document; beside it what the part does (a loop and its
       * period, a once, a drift, a live, the pointer's, the scroll's), what
       * changed on it and who moves it. A `once` plays once and holds.
       */
      for (const f of b.motion.frames ?? []) {
        const { el, frames, steps, greys, ...r } = f;
        void greys;
        /* The pointer's and the scroll's runs stand still until the page's script (the Builder's `moving-frames` feature) picks the picture for where the pointer or the scroll is. */
        const svg = flipbookOf({ frames: { frames, steps }, w: f.w, h: f.h, __st: f.kind === "once", __still: f.kind === "pointer" || f.kind === "scroll" });
        const bytes = svg ? Buffer.from(svg) : null;
        const key = bytes ? `motion-frames:${createHash("sha1").update(bytes).digest("hex")}` : null;
        const got = bytes ? pictures.get(key) ?? pictureOf(key, "motion-frames.svg", bytes) : null;
        if (!got) { note("(behaviours)", "motion.frames", "nowhere", `a ${f.kind} of ${frames.length} frames made no picture`); continue; }
        const p = place(el, "motion.frames");
        (m.frames ??= []).push({ ...p, ...r, frames: frames.length, picture: { id: got.record.id, path: got.record.path, w: got.record.w, h: got.record.h } });
        note(p.selector ?? "(behaviours)", "motion.frames", "field", `behaviours.motion.frames: a ${f.kind}${f.period ? ` every ${f.period} ms` : ""} of ${frames.length} pictures over ${f.ms} ms at ${JSON.stringify(f.box)}, ${f.what?.length ? `${f.what.join(", ")} changing` : "nothing in its styles changing"}${f.text ? ", its words changing" : ""}, by ${f.via}; played back as ${got.record.path}`);
      }
      note("(behaviours)", "motion", "field", `${m.spin.length} spins, ${m.float.length} floats, ${m.hover.length} hovers, ${m.scrollSpeed.length} sped up by the scroll, ${m.scrollGrow.length} grown by the scroll, ${m.canvases.length} canvases${m.frames ? `, ${m.frames.length} moving parts pictured` : ""}`);
    }
    if (b.heldVisible?.length) out.heldVisible = [...(out.heldVisible ?? []), ...b.heldVisible.map((h) => ({ ...place(h.el, "heldVisible"), name: h.name, opacity: h.opacity }))];
    /* How the page goes to its own places (glide.mjs): one rule per page, the pages' first, since a site scrolls one way. */
    if (b.glide && !out.glide) {
      const rule = glideRule(b.glide);
      if (rule) {
        out.glide = { ...rule, page: c.def.id, pressed: b.glide.links.map(({ id, top, from, to, ms }) => ({ id, top, from, to, ms })) };
        note("(behaviours)", "glide", "field", `behaviours.glide: in-page links ${rule.how === "jump" ? "jump" : `glide (${rule.how}) over ${rule.ms.base} ms${rule.ms.perPx ? ` + ${rule.ms.perPx} ms a px` : ""}${rule.ms.max ? `, at most ${rule.ms.max} ms` : ""}, ${rule.ease ?? "a curve of its own"}`}, stopping ${rule.offset} px from the place`);
      }
    }
    note("(behaviours)", "behaviours", "field", `${out.intro.length} intro, ${out.reveal.length} reveal, ${out.scrollClass.length} scrolled states, ${out.pointer.length} following the pointer, ${out.loops.length} loops, ${out.idle.length} running forever`);
  }
  notePage = "";
  return out;
})();

/* ------------------------------------------------------------------ */
/* The document                                                         */
/* ------------------------------------------------------------------ */

/* The page's @keyframes, every page's, by name (a later page's rule of the same name replaces an earlier one): what node.motion's animations name. */
const keyframes = [...new Map(converted.flatMap((c) => c.cap.keyframes ?? []).map((k) => [k.name, k])).values()];
if (keyframes.length) note("(capture)", "keyframes", "stored", `doc.keyframes: ${keyframes.length} rules (${keyframes.map((k) => k.name).join(", ")}), name and frames; polio replays none yet`);
note("(capture)", "url", "field", "from.url on every part; pages[].path from routes.json");
note("(capture)", "title", "field", "brief.name");
note("(capture)", "capturedAt", "field", "from.at on every part");
note("(capture)", "viewport[0]", "field", "frameWidth");
note("(capture)", "viewport[1]", "nowhere", "the frame has no viewport height");
note("(capture)", "page[1]", "nowhere", "the frame's height is derived from the lowest part");
note("(capture)", "bodyBg", "field", "look.palette.bg; palette.mode from its lightness");
note("(capture)", "bodyColor", "field", "look.palette.text");
note("(capture)", "font", "field", `type.bodyFamily and type.headingFamily as the class "${familyOf(first.font)}"; the stack itself has no field`);
note("(capture)", "wallet", first.wallet ? "nowhere" : "default", first.wallet ? "a stand-in wallet was connected so the sidebar and its sections would render; the address on the wallet button is the stand-in's, not his" : "");

/*
 * THE HEAD (check-head.mjs): what a link preview and a tab are drawn from.
 * The home page's is the site's (`doc.head`), its share picture and icons
 * pictures like any other; a page whose head says something else holds
 * only that (`page.head`). A capture taken before holds none.
 */
function headFor(cap) {
  const h = cap.head;
  if (!h) return null;
  const m = h.meta ?? {};
  const out = {};
  if (h.title) out.title = h.title;
  const description = h.description ?? m["og:description"] ?? m["twitter:description"];
  if (description) out.description = description;
  if (m["og:site_name"]) out.siteName = m["og:site_name"];
  out.url = m["og:url"] ?? cap.url;
  if (h.themeColor) out.themeColor = h.themeColor;
  if (m["twitter:card"]) out.card = m["twitter:card"];
  const src = m["og:image:secure_url"] ?? m["og:image"] ?? m["og:image:url"] ?? m["twitter:image"] ?? m["twitter:image:src"];
  const shot = src ? pictureFor(src, cap.url) : null;
  if (shot) out.image = { picture: shot.record, from: src, ...(m["og:image:alt"] ?? m["twitter:image:alt"] ? { alt: m["og:image:alt"] ?? m["twitter:image:alt"] } : {}), w: shot.size.w, h: shot.size.h };
  else if (src) note("(head)", "og:image", "nowhere", `the share picture ${src} was not beside the captures`);
  const icons = [];
  for (const l of h.links ?? []) {
    if (l.rel === "manifest") { out.manifest = l.href; continue; }
    const got = pictureFor(l.href, cap.url);
    if (!got) { note("(head)", l.rel, "nowhere", `${l.href} was not beside the captures`); continue; }
    icons.push({ rel: l.rel, picture: got.record, from: l.href, ...(l.sizes ? { sizes: l.sizes } : {}), ...(l.type ? { type: l.type } : {}), ...(l.color ? { color: l.color } : {}) });
  }
  if (icons.length) out.icons = icons;
  if (Object.keys(m).length) out.meta = m;
  return out;
}
const heads = new Map(converted.map((c) => [c.def.id, headFor(c.cap)]));
const siteHead = heads.get((routes.pages.find((p) => p.path === "/") ?? routes.pages[0]).id) ?? [...heads.values()].find(Boolean) ?? null;
const pageHead = (id) => {
  const h = heads.get(id);
  if (!h || !siteHead || h === siteHead) return null;
  const differs = Object.fromEntries(Object.entries(h).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(siteHead[k])));
  return Object.keys(differs).length ? differs : null;
};
if (siteHead) note("(head)", "head", "field", `doc.head: ${Object.keys(siteHead).join(", ")}; a page whose head differs holds what differs in page.head`);

/* The parts that are canvas worlds, for polio to give each the feature that opens its characters' dialogs. */
const worldsOut = nodes.filter((n) => n.world).map((n) => { const told = n.world.dialogs.filter((d) => /\sdata-world-inferred="/.test(d.html)).length; return { part: n.id, ...(told ? { toldDialogs: told } : {}) }; });
/*
 * A WORLD DRAWN AGAIN LIVE SWITCHES ITS OWN SCENES. A press on a scene's tab
 * was also read as a press state, which kept the canvas it changed as a
 * picture of its own and hid the world: shown on the press, that still would
 * stand over the live world. Those copies are taken out, and the world is
 * never hidden by a press; what else the press changes (the tab's own look)
 * stays.
 */
for (const n of nodes.filter((x) => x.world?.stage)) {
  const sel = n.from?.selector;
  const copies = new Set(nodes.filter((m) => m.state && m.pageId === n.pageId && m.featureId === "picture" && m.from?.selector === sel).map((m) => m.id));
  for (const st of pressedOut) {
    if (st.page !== n.pageId) continue;
    st.shows = st.shows.filter((id) => !copies.has(id));
    st.hides = st.hides.filter((id) => id !== n.id);
  }
  for (let i = nodes.length - 1; i >= 0; i--) if (copies.has(nodes[i].id)) nodes.splice(i, 1);
  if (copies.size) note(sel ?? "(behaviours)", "states", "field", `${copies.size} pictures a press kept of the world taken out: the world switches its own scenes`);
}
for (let i = pressedOut.length - 1; i >= 0; i--) if (!pressedOut[i].shows.length && !pressedOut[i].hides.length) pressedOut.splice(i, 1);
/* A scene's tab, read as its words and its box in the page: the biggest part standing there no bigger than the tab (its button, else its words). polio listens for a press within its box. */
for (const n of nodes.filter((x) => x.world?.stage)) {
  for (const sc of n.world.stage.scenes) {
    const t = sc.tab;
    if (!t || typeof t !== "object") continue;
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    const hit = nodes.filter((m) => m.pageId === n.pageId && !m.state && m.id !== n.id && m.x <= cx && m.x + m.w >= cx && m.y <= cy && m.y + m.h >= cy && m.w <= t.w + 40 && m.h <= t.h + 20).sort((a, b) => b.w * b.h - a.w * a.h)[0];
    sc.tab = hit ? hit.id : null;
    note("(behaviours)", "scene", hit ? "field" : "nowhere", hit ? `node.world.stage scene "${t.text}": its tab is part ${hit.id}` : `node.world.stage scene "${t.text}": no part stands where its tab was`);
  }
}
for (const w of worldsOut) note("(behaviours)", "worlds", "field", `behaviours.worlds: part ${w.part}`);
/*
 * WHAT THE CAPTURE HELD BACK (worlds.mjs): every control an automatic capture
 * did not press because its press would call a server, prompt a wallet or
 * leave the site, with enough to find it again (its page, its part, the
 * character whose dialog holds it, its stable name, a selector within the
 * published page) and what was seen of it. A later step lets the owner
 * choose which of these to press.
 */
const heldOut = [];
for (const n of nodes.filter((x) => x.world)) {
  const attr = (tag, name) => { const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag); return m ? m[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") : null; };
  n.world.dialogs.forEach((d, k) => {
    const who = n.world.chars.filter((c) => c.dialog === k);
    for (const m of d.html.matchAll(/<[a-z][a-z0-9-]*\b[^>]*\sdata-world-held="[^"]*"[^>]*>/g)) {
      const tag = m[0], control = attr(tag, "data-world-control"), at = attr(tag, "data-world-el");
      heldOut.push({
        page: n.pageId, part: n.id, character: who.map((c) => c.key), held: attr(tag, "data-world-held"),
        ...(control ? { control } : {}),
        /* Its place among the dialog's elements as the page drew it: where Learn presses it once the character's dialog is open on live. */
        ...(at !== null && /^\d+$/.test(at) ? { el: Number(at) } : {}),
        /* Its dialog's controls were told from a twin dialog's, not pressed (worlds.mjs): which one. */
        ...(attr(tag, "data-world-inferred") !== null ? { inferred: { fromDialog: Number(attr(tag, "data-world-inferred")) } } : {}),
        selector: `#${n.id} dialog[data-world-dialog="${k}"] ${control ? `[data-world-control="${control}"]` : `[data-world-el]`}`,
        ...(attr(tag, "data-world-hook") ? { saw: attr(tag, "data-world-hook") } : {}),
        ...(attr(tag, "data-world-offsite") ? { offsite: attr(tag, "data-world-offsite") } : {}),
        attrs: [...tag.matchAll(/\s(data-(?!world-)[a-z0-9-]+)(?:="([^"]*)")?/g)].map((a) => a[1]),
      });
    }
  });
  n.world.chars.forEach((c, i) => { if (c.offsite) heldOut.push({ page: n.pageId, part: n.id, character: [c.key], held: "off-site", selector: `#${n.id} [data-world-hit="${i}"]`, offsite: c.offsite }); });
}
/* WHAT A PRESS COPIED: its part and the words, for polio to give the part its copy (`behaviours.presses`). */
const pressesOut = [];
{
  const alive = new Set(nodes.map((x) => x.id));
  const partFor = (el) => { for (let e = el; e; e = e.parent) { const id = partOfEl.get(e); if (id && alive.has(id)) return id; } return null; };
  for (const c of converted) {
    if (!c.cap.pressed?.length) continue;
    const byP = new Map();
    (function walk(e) { if (e.p) byP.set(e.p, e); (e.kids ?? []).forEach(walk); })(c.cap.tree);
    for (const x of c.cap.pressed) {
      if (x.does !== "copy") continue;
      const part = partFor(byP.get(x.trigger));
      if (part && !pressesOut.some((q) => q.part === part)) pressesOut.push({ page: c.def.id, part, does: "copy", copy: x.copy, ...(x.inferred ? { inferred: { from: partFor(byP.get(x.inferred.from)) } } : {}) });
    }
  }
  if (pressesOut.length) note("(behaviours)", "presses", "field", `behaviours.presses: ${pressesOut.length} controls that copy`);
}
/*
 * THE PAGE'S OWN HELD PRESSES (held.mjs): a form's button, words that spend,
 * sign, connect or write, marked where they stood and read into the
 * element's `held`; and a press the states pass stopped because it tried to
 * write (`heldPresses`). Each with the part it became (or the nearest part
 * holding it) and its place on the live page, which is where Learn presses.
 */
{
  const alive = new Set(nodes.map((x) => x.id));
  const partFor = (el) => { for (let e = el; e; e = e.parent) { const id = partOfEl.get(e); if (id && alive.has(id)) return id; } return null; };
  for (const c of converted) {
    const byP = new Map();
    const els = [];
    (function walk(el) { if (el.p) byP.set(el.p, el); if (el.held) els.push(el); (el.kids ?? []).forEach(walk); })(c.cap.tree);
    const add = (el, h) => {
      const part = el ? partFor(el) : null;
      if (!part) { notePage = c.def.id; note(h.selector ?? "(held)", "held", "nowhere", `held: ${h.held} "${h.label ?? ""}": its element became no part`); notePage = ""; return; }
      if (heldOut.some((x) => x.page === c.def.id && x.selector === h.selector)) return;
      heldOut.push({
        page: c.def.id, part, held: h.held,
        ...(h.control ? { control: h.control } : {}),
        selector: h.selector, live: true,
        ...(h.label ? { label: h.label } : {}),
        ...(h.hook ? { hook: h.hook } : {}),
        ...(h.form ? { form: true, fields: h.fields ?? [] } : {}),
        ...(h.inferred ? { inferred: { from: partByTrigger(c, h.inferred.from) } } : {}),
      });
    };
    for (const el of els) add(el, el.held);
    for (const h of c.cap.heldPresses ?? []) add(byP.get(h.trigger) ?? null, h);
  }
}
if (heldOut.length) note("(behaviours)", "held", "field", `doc.held: ${heldOut.length} controls not pressed (${[...new Set(heldOut.map((h) => h.held))].map((w) => `${heldOut.filter((h) => h.held === w).length} ${w}`).join(", ")})`);
/*
 * THE API MAP (network.mjs): every data request each page made on its own,
 * one entry an endpoint across the site, values redacted, with its answers'
 * shape and how often the page asked again; one sample answer of each read
 * beside it. `api/map.json` and `api/samples/`; the document names them.
 */
/*
 * WHAT WAS TOLD, NOT PRESSED (capture-route.mjs, TWINS): every part whose
 * behaviour was inferred from a twin's press, what it does, and the part it
 * was told from, for the Builder to say so.
 */
const inferredOut = [];
{
  const alive = new Set(nodes.map((x) => x.id));
  for (const c of converted) {
    (function walk(e) {
      if (e.hrefInferred) { const part = partOfEl.get(e); if (part && alive.has(part)) inferredOut.push({ page: c.def.id, part, does: "link", from: partByTrigger(c, e.hrefInferred) }); }
      (e.kids ?? []).forEach(walk);
    })(c.cap.tree);
  }
  for (const st of pressedOut) if (st.inferred) inferredOut.push({ page: st.page, part: st.part, does: "state", from: st.inferred.from });
  for (const x of pressesOut) if (x.inferred) inferredOut.push({ page: x.page, part: x.part, does: x.does, from: x.inferred.from });
  for (const h of heldOut) if (h.inferred?.from) inferredOut.push({ page: h.page, part: h.part, does: `held: ${h.held}`, from: h.inferred.from });
  if (inferredOut.length) note("(behaviours)", "inferred", "field", `behaviours.inferred: ${inferredOut.length} parts told what a twin's press did, not pressed`);
}
const api = (() => {
  const pages = converted.filter((c) => c.cap.network).map((c) => ({ page: c.def.id, network: c.cap.network }));
  if (!pages.length) return null;
  const m = siteMap(pages);
  mkdirSync(join(outDir, "api", "samples"), { recursive: true });
  for (const x of m.samples) writeFileSync(join(outDir, "api", x.file), JSON.stringify(x.sample, null, 1) + "\n");
  writeFileSync(join(outDir, "api", "map.json"), JSON.stringify({ version: m.version, site: site.origin, endpoints: m.endpoints }, null, 1) + "\n");
  note("(network)", "api", "field", `api/map.json: ${m.endpoints.length} endpoints, ${m.endpoints.filter((e) => e.read).length} reads, ${m.samples.length} samples`);
  return { version: m.version, map: "api/map.json", endpoints: m.endpoints.length, reads: m.endpoints.filter((e) => e.read).length, samples: m.samples.length };
})();
/*
 * THE PAGE AT A TABLET AND A PHONE (capture-widths.mjs, <capture>/widths/):
 * where the site's own stylesheet puts each part at 834 and 390, by the part
 * it is in this document. Per device and page: each part's box (`place`),
 * its words' type (`font`), the parts it hides, the reading order, what
 * shows at that width only (`added`, by its box and words), and the phone's
 * menu: its trigger and what its panel shows.
 *
 * And, as the Builder reads it (polio docs/RESPONSIVE.md, Lane D): on each
 * part itself, `widths.tablet` / `widths.phone` as `{ x, y, w, h }` in
 * pixels from the page's top left at that width, or `{ 0, 0, 0, 0, hidden:
 * true }` where the site does not draw it; `capturedWidths` on the
 * document. A menu button shown only at a small width (a hamburger) is a
 * part of its own: a desktop box of zero size, its box in `widths`.
 */
const smallParts = [];
const layoutsSection = (() => {
  const dir = join(dirname(routesPath), "widths");
  if (!existsSync(dir)) return null;
  const alive = new Set(nodes.map((x) => x.id));
  const nodeById = new Map(nodes.map((x) => [x.id, x]));
  const setWidth = (id, device, box) => { const nd = nodeById.get(id); if (!nd || (device !== "tablet" && device !== "phone")) return; nd.widths = { ...(nd.widths ?? {}), [device]: box }; };
  const triggers = new Map();
  const byPage = new Map();
  for (const c of converted) { const m = new Map(); for (const mm of c.made) { const id = mm.el?.p ? partOfEl.get(mm.el) : null; if (id && alive.has(id)) m.set(mm.el.p, id); } byPage.set(c.def.id, m); }
  const out = {};
  /* A width from 600 to 1023 is the tablet, under 600 the phone; read at two for one device, the one nearer the Builder's frame (834, 390) is kept. Its boxes go across to that frame (x and w scaled; y and h as read). */
  const FRAME = { tablet: 834, phone: 390 };
  const deviceOf = (W) => (W < 600 ? "phone" : W < 1024 ? "tablet" : `w${W}`);
  const files = readdirSync(dir).filter((x) => /\.\d+\.json$/.test(x)).sort().map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  const nearest = {};
  for (const w of files) { const d = `${w.page}|${deviceOf(w.width)}`; if (nearest[d] == null || Math.abs(w.width - (FRAME[deviceOf(w.width)] ?? w.width)) < Math.abs(nearest[d] - (FRAME[deviceOf(w.width)] ?? w.width))) nearest[d] = w.width; }
  for (const w of files) {
    const ids = byPage.get(w.page);
    if (!ids) continue;
    /* A path's own part, or the nearest part it sits in. */
    const partAt = (p) => { for (let q = String(p).split("::")[0]; q.includes(">"); q = q.slice(0, q.lastIndexOf(">"))) { const id = ids.get(q); if (id) return id; } return null; };
    const device = deviceOf(w.width);
    if (nearest[`${w.page}|${device}`] !== w.width) continue;
    const sx = FRAME[device] ? FRAME[device] / w.width : 1;
    const dev = (out[device] ??= { width: w.width, height: w.height, pages: {} });
    const place = {}, font = {};
    for (const [p, box] of Object.entries(w.parts ?? {})) { const id = ids.get(p); if (id) place[id] = box; }
    for (const [p, ft] of Object.entries(w.fonts ?? {})) { const id = ids.get(p); if (id) font[id] = ft; }
    const hidden = [...new Set((w.hidden ?? []).map((p) => ids.get(p)).filter(Boolean))].filter((id) => !place[id]);
    const order = [...new Set((w.order ?? []).map(partAt).filter(Boolean))];
    /* Its words' type at this width rides on the box (`px`, live/small.ts): the site's 30 px phone heading, not the desktop's 48. */
    for (const [id, [x, y, bw, bh]] of Object.entries(place)) setWidth(id, device, { x: Math.round(x * sx), y, w: Math.round(bw * sx), h: bh, ...(typeof font[id]?.[0] === "number" && font[id][0] > 0 ? { px: font[id][0] } : {}) });
    for (const id of hidden) setWidth(id, device, { x: 0, y: 0, w: 0, h: 0, hidden: true });
    /* The menu's button: its own part, or one made for it when it shows at this width only. */
    let triggerId = w.menu ? ids.get(w.menu.trigger.p) ?? null : null;
    if (w.menu && !triggerId) {
      const key = `${w.page}|${w.menu.trigger.p}`;
      let nd = triggers.get(key);
      if (!nd) {
        const label = w.menu.trigger.label || "Menu";
        nd = { id: `n_ctaprimary_small_${triggers.size + 1}`, pageId: w.page, featureId: "cta-primary", label: `button “${label}”`, prompt: `The site's own menu button, shown at a tablet or a phone only (${w.menu.trigger.p}). Captured at ${w.width} wide.`, content: label, data: `button, named “${label}”`, x: 0, y: 0, w: 0, h: 0, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, from: { selector: w.menu.trigger.p, at: 0, ...(nodes.find((q) => q.pageId === w.page && q.from?.url)?.from?.url ? { url: nodes.find((q) => q.pageId === w.page && q.from?.url).from.url } : {}) }, widths: {} };
        triggers.set(key, nd);
        smallParts.push(nd);
        nodeById.set(nd.id, nd);
      }
      triggerId = nd.id;
      const [x, y, bw, bh] = w.menu.trigger.box;
      setWidth(nd.id, device, { x, y, w: bw, h: bh });
    }
    const menu = w.menu ? { trigger: triggerId, label: w.menu.trigger.label, box: w.menu.trigger.box, panel: w.menu.panel.map((x) => ({ ...(ids.get(x.p) ? { part: ids.get(x.p) } : {}), box: x.box, ...(x.text ? { text: x.text } : {}) })) } : null;
    dev.pages[w.page] = { height: w.pageHeight, ...(w.overflowX ? { overflowX: true } : {}), place, font, hidden, order, added: (w.added ?? []).map((a) => ({ box: a.box, text: a.text, t: a.t })), ...(menu ? { menu } : {}) };
    note(w.page, `layouts.${device}`, "field", `${Object.keys(place).length} parts placed at ${w.width}, ${hidden.length} hidden, ${(w.added ?? []).length} shown there only${menu ? `, a menu of ${menu.panel.length}` : ""}`);
  }
  /* A menu button made for a small width: hidden at the other one where it was not seen there. */
  for (const nd of smallParts) for (const dev of Object.keys(out)) if ((dev === "tablet" || dev === "phone") && !nd.widths[dev] && out[dev].pages[nd.pageId]) nd.widths[dev] = { x: 0, y: 0, w: 0, h: 0, hidden: true };
  return Object.keys(out).length ? out : null;
})();
nodes.push(...smallParts);
const capturedWidths = layoutsSection ? [...new Set([first.viewport?.[0] ?? 1440, ...Object.values(layoutsSection).map((l) => l.width)])].sort((a, b) => b - a) : null;
const doc = {
  pages: routes.pages.map((p) => { const ph = pageHead(p.id); return { id: p.id, name: p.name, path: p.path, prompt: p.click ? `The ${p.name} section of ${p.route} on ${site.host}, reached by pressing "${p.click}" in the sidebar; on the live site it is a state of that page, not a route.` : p.note ?? "", scroll: "inherit", ...(ph ? { head: ph } : {}) }; }),
  nodes,
  groups: [],
  shapes: [],
  format: {
    "type.headingFamily": familyOf(first.font) ?? "geometric sans",
    "type.bodyFamily": familyOf(first.font) ?? "system sans",
    "type.baseSize": BASE_PX,
    "layout.radius": 0,
    "palette.mode": light(first.bodyBg) < 0.5 ? "dark" : "light",
  },
  brief: { name: first.title, gimmick: "", master: "" },
  look: {
    palette: { bg: first.bodyBg, text: first.bodyColor },
    texture: [],
    target: "page",
    light: DEFAULT_LIGHT,
    ...(carried.fonts.length ? { fonts: carried.fonts } : {}),
  },
  motion: [],
  activePageId: routes.pages[0].id,
  hiddenFeatures: [],
  /* The width the page was laid out in: the window less a scrollbar that takes room (parasiteonsol.fun's scrollbar-gutter: stable, 1425 of 1440), so a full-width band spans the frame (check-scrollbar-width.mjs). */
  frameWidth: first.page?.[0] > 0 && first.page[0] < first.viewport[0] ? first.page[0] : first.viewport[0],
  companion: null,
  ...(sourcesSection ? { sources: sourcesSection } : {}),
  ...(keyframes.length ? { keyframes } : {}),
  ...(behavioursSection || pressedOut.length || worldsOut.length || pressesOut.length || inferredOut.length ? { behaviours: { version: 1, ...(behavioursSection ?? {}), ...(pressedOut.length ? { states: pressedOut } : {}), ...(worldsOut.length ? { worlds: worldsOut } : {}), ...(pressesOut.length ? { presses: pressesOut } : {}), ...(inferredOut.length ? { inferred: inferredOut } : {}) } } : {}),
  ...(siteHead ? { head: siteHead } : {}),
  ...(heldOut.length ? { held: heldOut } : {}),
  ...(api ? { api } : {}),
  /* What this capturer can do for the Builder: Learn on click presses held server calls once each, on request (learn.mjs). */
  capturer: { name: "sink", learn: true, can: ["held", "network", "learn"] },
  ...(lists.length ? { lists } : {}),
  ...(layoutsSection ? { layouts: layoutsSection, capturedWidths } : {}),
};

mkdirSync(join(outDir, "site"), { recursive: true });
writeFileSync(join(outDir, "site", "document.json"), JSON.stringify(doc, null, 2) + "\n");

/* ------------------------------------------------------------------ */
/* The ledger, said plainly                                             */
/* ------------------------------------------------------------------ */

const count = (xs, f) => xs.reduce((m, x) => { const k = f(x); return { ...m, [k]: (m[k] ?? 0) + 1 }; }, {});
console.log(`${converted.reduce((s, c) => s + c.elements, 0)} captured elements on ${converted.length} pages → ${nodes.length} parts, ${doc.groups.length} groups, ${pictures.size} pictures${pictures.size ? ` (${[...pictures.values()].map((p) => p.record.path).join(", ")})` : ""}, ${carried.fonts.filter((f) => f.carried).length} faces carried`);
for (const c of converted) {
  console.log(`\n${c.def.id} (${c.def.name}, ${c.def.path}${c.cap.reached ? `, after pressing "${c.cap.reached.click}"` : ""}): ${c.elements} elements → ${c.made.length} parts`);
  console.log("  elements by kind:", JSON.stringify(c.byKind));
  console.log("  parts by feature:", JSON.stringify(count(c.made, (m) => m.node.featureId)));
  console.log("  parts carrying a box field:", JSON.stringify({ layout: c.made.filter((m) => m.node.layout).length, pad: c.made.filter((m) => m.node.pad).length, edge: c.made.filter((m) => m.node.edge).length, text: c.made.filter((m) => m.node.text).length }));
  console.log(`  links: ${JSON.stringify(count(c.made.filter((m) => m.node.link), (m) => `${m.node.link.kind}:${m.node.link.target}`))}`);
  console.log(`  roles: ${JSON.stringify(count(c.made.filter((m) => m.el.role), (m) => m.el.role))}; ${c.made.filter((m) => !m.el.role).length} with none`);
  console.log(`  paint order: ${c.made.filter((m) => !m.band).length} parts that flow, then ${c.bands.length} positioned band${c.bands.length === 1 ? "" : "s"}: ${c.bands.map((b) => `${b.t} (${b.pos}, z ${b.z ?? "auto"}, ${c.made.filter((m) => m.band === b).length} parts)`).join(", ")}`);
  console.log(`  overlaps in the measured geometry: ${c.overlaps.length} — ${c.overlaps.filter((o) => o.positioned).length} a positioned band over what flows beneath it, ${c.overlaps.filter((o) => o.kin).length} a child poking out of its own parent`);
}
console.log(`\nfaces: ${carried.fonts.map((f) => `${f.family} ${f.weight ?? ""} ${f.carried ? `carried (${Math.round((f.bytes ?? 0) / 1024)}KB)` : `not carried: ${f.says}`}`).join("; ") || "none carried"}${carried.named.length ? `; system faces: ${carried.named.join(", ")}` : ""}${generics.length ? `; generic keywords, the machine's own face: ${generics.join(", ")}` : ""}`);

const props = new Map();
for (const l of ledger) {
  const p = props.get(l.prop) ?? { total: 0, to: {}, how: new Map() };
  p.total++;
  p.to[l.to] = (p.to[l.to] ?? 0) + 1;
  if (l.how) p.how.set(`${l.to}: ${l.how}`, (p.how.get(`${l.to}: ${l.how}`) ?? 0) + 1);
  props.set(l.prop, p);
}
console.log("\nWHERE EACH CAPTURED PROPERTY WENT (all pages)");
for (const [prop, p] of [...props.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`\n${prop}  (${p.total}): ${Object.entries(p.to).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  for (const [how, k] of [...p.how.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`    ${k}× ${how}`);
}
if (sourcesSection) console.log(`\nsources: ${sourcesSection.sources.length} addresses feeding ${sourcesSection.feeds.length} parts${sourcesSection.feeds.length ? ` — ${sourcesSection.feeds.map((f) => `${f.part} ← ${f.path}`).join(", ")}` : ""}`);
writeFileSync(join(outDir, "ledger.json"), JSON.stringify(ledger, null, 1));
