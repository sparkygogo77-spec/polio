/**
 * A CAPTURED BUTTON, OR ANY CAPTURED PART, NEVER CUTS ITS OWN WORDS.
 *
 * THE OWNER'S REPORT, trumpmorty.fun's remote: HOME read HOMI, CHART CHAR1,
 * ROADMAP ROADMAF, TWITTER lost its first T. Each key is captured with the
 * padding that put its label where the page had it (53 57 21 58 on HOME), so
 * its inside is exactly as wide and tall as the label measured there, and
 * the label drawn here is a few px wider (59 against 51). The box round the
 * part and the part's own fill both clipped (`overflow: hidden`), so the
 * difference was cut off every edge. The page's key cuts nothing. A captured
 * control's words overflow its padding rather than vanish; a hand-placed
 * button, which says nothing of itself, is unchanged.
 *
 *   node tests/button-words-whole.mjs
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
await jiti.import("@/features/studio/board/store"); // the store door first: through jiti on Windows its create/builds/heldView cycle only forms when this loads first
const { Block } = await jiti.import(join(here, "..", "src", "features", "studio", "blocks.tsx"));
const { themeFrom, resolvePalette } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const format = { "palette.mode": "dark" };
const t = themeFrom(format), palette = resolvePalette(format, undefined);
const node = (id, content, extra = {}) => ({
  id, pageId: "p0", featureId: "cta-primary", label: id, prompt: "", content, data: "", x: 445, y: 4825, w: 173, h: 96, groupId: null,
  options: { shape: "square", variant: "solid", size: "medium" }, priority: "must", custom: false, locked: false, link: null, colour: null, font: null, texture: null, ...extra,
});
const draw = (n) => renderToStaticMarkup(React.createElement(Block, { node: n, t, palette, mode: "live", size: { w: n.w, h: n.h } }));
/* The elements that hold the words, from the part's box inward to the button. */
const holders = (html) => {
  const upTo = html.slice(0, html.indexOf("<button"));
  return [...upTo.matchAll(/<div[^>]*style="([^"]*)"/g)].map((m) => m[1]);
};

const key = draw(node("home", "HOME", {
  from: { url: "https://trumpmorty.fun/", host: "trumpmorty.fun", selector: "body > main > section:nth-of-type(6) > div > div:nth-of-type(2) > div:nth-of-type(2) > a:nth-of-type(1)" },
  pad: { top: 53, right: 58, bottom: 21, left: 57 },
  colour: { bg: "rgb(243, 212, 64)", accent: "rgb(243, 212, 64)", text: "rgb(26, 15, 11)" },
  edge: { width: 4, style: "solid", colour: "rgb(26, 15, 11)" }, radius: 22,
  font: { face: "Luckiest Guy", size: 1.38, weight: 400, spacing: 0.023, leading: 1.05 }, text: { align: "center" },
  layout: { display: "flex", direction: "column", align: "center", justify: "center", gap: 2 },
}));
const hs = holders(key);
check("the remote key draws its label", key.includes(">HOME<"));
check("nothing between the key's edge and its label cuts it", hs.length > 0 && hs.every((s) => !/overflow:\s*hidden/.test(s)), hs.map((s) => (s.match(/overflow:[^;]*/) ?? ["-"])[0]).join(" | "));

/* The lore's stat tile: "eyes open", set in capitals, 77.4px of words in the 77px the capture measured. */
const tile = draw(node("eyes", "eyes open", {
  featureId: "prose", x: 779, y: 1537, w: 77, h: 17,
  from: { url: "https://trumpmorty.fun/", host: "trumpmorty.fun", selector: "body > main > section:nth-of-type(2) > div > div:nth-of-type(2) > div:nth-of-type(1) > span" },
  font: { face: "Fredoka", size: 0.88, weight: 700, spacing: 0.036, leading: 1.45 }, text: { align: "center", transform: "uppercase" },
}));
const th = [...tile.matchAll(/<div[^>]*style="([^"]*)"/g)].map((m) => m[1]);
check("a captured line of words (the lore tile's EYES OPEN) is not cut by its own box either", th.length > 0 && th.every((s) => !/overflow:\s*hidden/.test(s)), th.map((s) => (s.match(/overflow:[^;]*/) ?? ["-"])[0]).join(" | "));

const plain = draw(node("plain", "Get started", { x: 0, y: 0, w: 160, h: 44, options: { shape: "rounded", variant: "solid", size: "medium" } }));
check("control: a hand-placed button is drawn as before, its fill clipping", holders(plain).some((s) => /overflow:\s*hidden/.test(s)), holders(plain).join(" | ").slice(0, 200));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
