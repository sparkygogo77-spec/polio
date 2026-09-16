/**
 * The molten surface, and the fact that there is only one of it.
 *
 * Two branches render glowing constructs — the timeline's iteration boxes
 * here, the element cards on the sibling — so the failure this guards against
 * is two reds that nearly match. There is one definition, in one file, and
 * everything else reads from it.
 *
 *   · five stops, hottest to coldest, each a colour rather than an opacity of
 *     one colour, running near-white to almost-black red;
 *   · the keyframes are declared once and nowhere else;
 *   · the body is veined and grainy, never a smooth even gradient;
 *   · motion is always present and never demanding: nothing fast, nothing
 *     crossing a range that could read as a flash, nothing under the words;
 *   · and it is cheap by construction — transform and opacity, one shared
 *     grain, containment, no loop and no canvas.
 *
 *   node tests/molten.mjs [url]      # default http://localhost:3000
 */
import { existsSync, readFileSync } from "node:fs";
import { MOLTEN_KEYFRAMES, MOLTEN_MEANS, MOLTEN_MOTION, MOLTEN_STOPS, moltenClass, moltenSeed } from "../src/core/ui/molten.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const css = readFileSync("src/core/ui/molten.css", "utf8");
const lightOf = (c) => Number(/oklch\(([\d.]+)/.exec(c)?.[1]);
const chromaOf = (c) => Number(/oklch\([\d.]+ ([\d.]+)/.exec(c)?.[1]);
const stop = (name) => {
  const m = new RegExp(`--${name}:\\s*(oklch\\([^)]*\\))`).exec(css);
  return m?.[1] ?? "";
};

/* ------------------------------------------------------------------ */
/* 1. One definition, in one file                                      */
/* ------------------------------------------------------------------ */

check("the stops and the keyframes live in core/ui/molten.css",
  /--molten-white:/.test(css) && /@keyframes molten-drift/.test(css));

const elsewhere = ["src/features/studio/Timeline.tsx", "src/features/studio/TimelineDetail.tsx", "src/app/globals.css"];
for (const f of elsewhere) {
  const src = readFileSync(f, "utf8");
  check(`${f.split("/").pop()} declares no molten property of its own`, !/--molten-(white|hot|body|deep|char)\s*:/.test(src));
  check(`${f.split("/").pop()} declares no molten keyframe of its own`, !/@keyframes\s+molten-/.test(src));
}
check("the stylesheet is actually loaded", /@import ".*molten\.css"/.test(readFileSync("src/app/globals.css", "utf8")));

/* ------------------------------------------------------------------ */
/* 2. Five stops, a bright leaning edge down to a dark unlit field     */
/* ------------------------------------------------------------------ */

check("there are five stops, not one colour at five opacities", MOLTEN_STOPS.length === 5);
for (const kind of ["molten", "ember", "verdant", "azure"]) {
  const stops = MOLTEN_STOPS.map((n) => stop(`${kind}-${n}`));
  check(`${kind}: every stop is declared`, stops.every(Boolean), stops.filter(Boolean).length + "/5");
  const lights = stops.map(lightOf);
  check(`${kind}: they run hottest to coldest`, lights.every((l, i) => i === 0 || l < lights[i - 1]), lights.join(" > "));
  /* The locked relationship, not the old one.
     These three used to read "the hottest is a near-white", "the body is a
     deep blood red" and "the outer edge falls to almost black". A reference
     was given since, and it supersedes all three: the edge is not near-white
     but a thin very bright colour at full chroma, the body is stronger and
     lighter, and the field is dark without being almost black. Matching the
     relationship is the instruction, so that is what is checked. */
  check(`${kind}: the edge is bright and saturated, not a near-white`,
    lights[0] >= 0.85 && lights[0] <= 0.93 && chromaOf(stops[0]) >= 0.18, stops[0]);
  check(`${kind}: the body is strong and saturated`,
    lights[2] >= 0.46 && lights[2] <= 0.56 && chromaOf(stops[2]) >= 0.13, stops[2]);
  check(`${kind}: the field is dark AND unsaturated`,
    lights[4] >= 0.2 && lights[4] <= 0.3 && chromaOf(stops[4]) <= 0.09, stops[4]);
  check(`${kind}: the field is far less saturated than the body`,
    chromaOf(stops[2]) >= chromaOf(stops[4]) * 1.8, `${chromaOf(stops[2])} vs ${chromaOf(stops[4])}`);
  check(`${kind}: no two stops are the same colour`, new Set(stops).size === 5);

  /* One family, with the edge leaning towards yellow on purpose.
     The lean is signed: yellow is near hue 90, so a green family shifts DOWN
     towards it and a red family shifts UP. Rotating both the same way sends
     one of them the wrong way round the wheel, which is the mistake this
     catches. */
  const hue = (c) => Number(/oklch\([\d.]+ [\d.]+ ([\d.]+)/.exec(c)?.[1]);
  const hues = stops.map(hue);
  const anchor = hues[2];
  const towardsYellow = anchor > 90 ? -1 : 1;
  check(`${kind}: every stop is the same family`, hues.every((h) => Math.abs(h - anchor) <= 26), hues.join(","));
  check(`${kind}: the edge leans towards yellow, and the right way`,
    (hues[0] - anchor) * towardsYellow >= 10 && (hues[1] - anchor) * towardsYellow >= 5,
    `anchor ${anchor}, edge ${hues[1]} then ${hues[0]}`);
}
check("the two temperatures are not the same red twice",
  MOLTEN_STOPS.some((n) => stop(`molten-${n}`) !== stop(`ember-${n}`)));
check("what each temperature means is written down, not left to taste",
  Object.keys(MOLTEN_MEANS).length === 4 && /iteration/.test(MOLTEN_MEANS.verdant) && /drawing/.test(MOLTEN_MEANS.ember) && /lane/.test(MOLTEN_MEANS.azure));
check("the stylesheet says the same thing, for the branch that reads it",
  /--verdant-\*\s+an ITERATION/.test(css) && /--ember-\*\s+a DRAWING/.test(css) && /--azure-\*\s+an ITERATION A LANE CARRIED OUT/.test(css));

/* ------------------------------------------------------------------ */
/* 3. Texture, not a smooth gradient                                   */
/* ------------------------------------------------------------------ */

check("there is grain, and it is one shared tile rather than a filter per box",
  /--molten-grain:\s*url\("data:image\/svg\+xml/.test(css) && !/filter:\s*url\(#/.test(css));
/*
 * The surface is a nebula now, not veining: one cloud tile per temperature,
 * painted once by the ground's own noise and slid by transform. The
 * stylesheet reads the tile; it never makes one.
 */
check("the face is a nebula tile the stylesheet is handed, one per temperature",
  /--mo-nebula: var\(--nebula-ember, none\)/.test(css) && /--mo-nebula: var\(--nebula-verdant, none\)/.test(css));
check("the nebula layer is one period wider than the box and slides exactly one period",
  /width: calc\(100% \+ var\(--nebula-period, 180px\)\)/.test(css)
  && /to\s+\{ transform: translate3d\(var\(--nebula-period, 180px\), 0, 0\); \}/.test(css));
check("the centre is the darkest part, and it is not black", (() => {
  const core = /--molten-core:\s*oklch\(([\d.]+) ([\d.]+)/.exec(css);
  return !!core && Number(core[1]) > 0.08 && Number(core[1]) < 0.18 && Number(core[2]) > 0.02;
})(), /--molten-core:[^;]*/.exec(css)?.[0]);
check("every temperature has its own core", /--ember-core:/.test(css) && /--verdant-core:/.test(css));
check("the face is lit from around the centre, easing in rather than falling off",
  /radial-gradient\(70% 88% at 50% 50%, var\(--mo-core\) 0%, var\(--mo-core\) 18%, var\(--mo-char\) 62%/.test(css));
/*
 * The face is J's own render now, not a likeness of it painted here from
 * noise: seamless 512 tiles cut out of the lantern boxes he rendered,
 * served from `public/construct/` as files — cacheable, and not a quarter
 * of a megabyte of base64 on the root element.
 */
check("the face is J's tile, served as a file rather than painted or inlined", (() => {
  const tile = readFileSync("src/features/studio/nebulaTile.ts", "utf8");
  return /\/construct\/face-green-dark\.png/.test(tile) && /\/construct\/face-red-dark\.png/.test(tile)
    && !/toDataURL/.test(tile) && !/nebulaNoise/.test(tile);
})());
check("…the dark cut of it, with the bright one there to compare against", (() => {
  const tile = readFileSync("src/features/studio/nebulaTile.ts", "utf8");
  return /export function mountNebula\(pair: FacePair = "dark"\)/.test(tile) && /bright: \{/.test(tile);
})());
check("…and the files are where they are served from", (() => {
  for (const f of ["face-green-dark.png", "face-red-dark.png", "face-green.png", "face-red.png"]) {
    if (!existsSync(`public/construct/${f}`)) return false;
  }
  return true;
})());
/*
 * The centre stays thin, so it is calm where it is read. It was baked into
 * the painted tile's alpha; a photograph has no alpha, so it is the same
 * curve as a mask on the same layers instead.
 */
check("and its centre is thin, so it is calm where it is read",
  /--molten-vignette: linear-gradient\(/.test(css) && /rgb\(0 0 0 \/ 0\.3\) 50%/.test(css)
  && /rgb\(0 0 0 \/ 1\) 0%/.test(css) && /rgb\(0 0 0 \/ 1\) 100%/.test(css));
check("…on both cloud layers, and nowhere else", (() => (
  (css.match(/mask-image: var\(--molten-vignette\);/g) ?? []).length === 4
))(), `${(css.match(/mask-image: var\(--molten-vignette\);/g) ?? []).length} of them, prefixed and not`);
check("the tile keeps its own shape rather than being stretched to the card",
  /background-size: var\(--nebula-period, 180px\) auto;/.test(css));
/*
 * THE MATCH. J's two tiles are cuts of two different renders and are not the
 * same brightness, so the same pair of cloud opacities over them made the
 * red read 21% lighter than the green — two systems rather than two
 * temperatures. The cloud's opacity is the lever, per temperature, and the
 * two layers pull opposite ways: the gliding copy is more of J's picture and
 * stays high for both, while the still copy at 1.7× samples a darker part of
 * the same tile, so the green takes almost none of it and the red nearly all.
 *
 * Measured on a board, mean of a card's lower third in oklab L, red against
 * green: 1.211 before, 1.115 after; at the 99th percentile 1.487 before,
 * 1.328 after. Red is still the hotter, which is the point.
 */
check("how much cloud is a dial per temperature, not a number in the rule", (() => (
  /--mo-cloud: 0\.92;/.test(css) && /--mo-cloud-still: 0\.38;/.test(css)
  && /opacity: var\(--mo-cloud, 0\.92\);/.test(css)
  && /opacity: var\(--mo-cloud-still, 0\.38\);/.test(css)
))());
check("each temperature sets how much of the cloud it takes, and the green's back layer is the heavier", (() => {
  const v = /\.molten-verdant \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const e = /\.molten-ember \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  return /--mo-cloud: 0\.5;/.test(v) && /--mo-cloud-still: 0\.7;/.test(v)
    && /--mo-cloud: 0\.52;/.test(e) && /--mo-cloud-still: 0\.58;/.test(e);
})());
check("red is still the hotter of the two: it shows a little less of its own tile, which is the brighter one", (() => {
  const dial = (sel, name) => {
    const b = new RegExp(`\\.molten-${sel} \\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1] ?? "";
    return Number(new RegExp(`--mo-${name}: ([\\d.]+);`).exec(b)?.[1]);
  };
  // Less cloud is more of the dark face under it, so the red — the hot tile
  // — carries the lighter pair. Measured, oklab L of a card's lower third:
  // green 0.234, red 0.249, a ratio of 1.066 with red the hotter.
  const g = dial("verdant", "cloud") + dial("verdant", "cloud-still");
  const r = dial("ember", "cloud") + dial("ember", "cloud-still");
  return r < g;
})());
check("forming scales the same dials rather than the numbers they replaced",
  /opacity: calc\(var\(--form-surface, 1\) \* var\(--mo-cloud, 0\.92\)\);/.test(css)
  && /opacity: calc\(var\(--form-surface, 1\) \* var\(--mo-cloud-still, 0\.38\)\);/.test(css));
/*
 * IT HAS TO READ AS MOVING, AND AS CLOUD.
 *
 * Both were notes off a screenshot. The surface crept: one period per turn
 * of the drift, 512 pixels over 150 seconds, is three and a half pixels a
 * second, and on the red it was worse than that because the still layer sat
 * over the moving one. And the tile drew at one to one, so a card held a
 * third of the picture's width and a seventh of its height — five or six
 * fat filaments, which read as big lines rather than as cloud.
 *
 * One number fixes both, because the glide is exactly one period: a smaller
 * period is more of the render in view AND more of it going past per second
 * of the same animation.
 */
check("the tile draws small enough that a card holds a field of filaments rather than a few", (() => {
  const tile = readFileSync("src/features/studio/nebulaTile.ts", "utf8");
  const p = Number(/export const NEBULA_PERIOD = (\d+);/.exec(tile)?.[1]);
  // A card is about 220 across: the period has to be under it for a whole
  // tile to be in view, and the files are 512 square.
  return p > 0 && p <= 220;
})(), `${/export const NEBULA_PERIOD = (\d+);/.exec(readFileSync("src/features/studio/nebulaTile.ts", "utf8"))?.[1]}px of a 512px file`);
check("…and goes past fast enough to be seen moving at a glance", (() => {
  const tile = readFileSync("src/features/studio/nebulaTile.ts", "utf8");
  const p = Number(/export const NEBULA_PERIOD = (\d+);/.exec(tile)?.[1]);
  const secs = Number(/animation: molten-drift ([\d.]+)s/.exec(css)?.[1]);
  const speed = p / secs;
  // Plain at a glance and never busy: it crept at 3.4 and it may not race.
  return speed >= 6 && speed <= 14;
})(), `${(Number(/export const NEBULA_PERIOD = (\d+);/.exec(readFileSync("src/features/studio/nebulaTile.ts", "utf8"))?.[1]) / Number(/animation: molten-drift ([\d.]+)s/.exec(css)?.[1])).toFixed(1)}px a second`);
/*
 * And the one that moves is the one in front. Under a still layer at 0.95 —
 * which is what the red wore to match the green's brightness — five per
 * cent of the card was the only part of it that glided, and the card read
 * as static. A still sheet behind a moving one is depth; in front of one it
 * is a lid.
 */
check("the layer that slides across is in front of the one that slides back", (() => {
  const before = /\.molten::before \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const after = /\.molten::after \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const z = (rule) => Number(/z-index: (-?\d+);/.exec(rule)?.[1]);
  return z(before) > z(after);
})());
check("…and each slides exactly one of its own background periods, or the loop shows", (() => {
  const drift = /@keyframes molten-drift \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const ebb = /@keyframes molten-ebb \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const after = /\.molten::after \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  return /translate3d\(var\(--nebula-period, 180px\), 0, 0\)/.test(drift)
    && /translate3d\(calc\(-1\.7 \* var\(--nebula-period, 180px\)\), 0, 0\)/.test(ebb)
    && /background-size: calc\(var\(--nebula-period, 180px\) \* 1\.7\) auto;/.test(after)
    && /width: calc\(100% \+ 1\.7 \* var\(--nebula-period, 180px\)\);/.test(after);
})());
check("the still copy is a different size rather than the same one mirrored, which put an axis down every card", (() => {
  // The churn keyframe still mirrors, and nothing uses it; what matters is
  // that the layer itself no longer does.
  const after = /\.molten::after \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  return /background-size: calc\(var\(--nebula-period, 180px\) \* 1\.7\) auto;/.test(after) && !/scaleX\(-1\)/.test(after);
})());

/* ------------------------------------------------------------------ */
/* 4. Always moving, never demanding                                   */
/* ------------------------------------------------------------------ */

check("every keyframe is named and accounted for", MOLTEN_KEYFRAMES.length === 6, MOLTEN_KEYFRAMES.join(", "));
for (const k of MOLTEN_KEYFRAMES) {
  check(`${k} is declared`, new RegExp(`@keyframes ${k}\\b`).test(css));
  check(`${k} says what it is for`, (MOLTEN_MOTION[k] ?? "").length > 20);
}
const runs = [...css.matchAll(/animation:\s*(molten-[a-z]+)\s+([\d.]+)s/g)].map((m) => ({ name: m[1], s: Number(m[2]) }));
const durations = runs.map((r) => r.s);
check("every animation is slow: nothing under nine seconds", durations.length > 0 && durations.every((d) => d >= 9),
  durations.join("s, ") + "s");
/* Nothing lands on a beat: every length on the card is its own, so the
   picture never comes back round to where it was. The glide is the one that
   runs twice at one rate, on a box's face and on a vine, because they are
   one weather; every other pair of lengths differs. */
check("nothing is a timer: no two motions on a construct are the same length",
  new Set(durations).size === new Set(runs.map((r) => `${r.name}:${r.s}`)).size,
  runs.map((r) => `${r.name} ${r.s}s`).join(", "));
check("…and the glide is the only one that runs at one rate in two places, because it is one weather", (() => {
  const twice = runs.filter((r, i) => runs.findIndex((o) => o.name === r.name && o.s === r.s) !== i);
  return twice.every((r) => r.name === "molten-drift");
})());
check("only transform and opacity are animated, never a colour or a size", (() => {
  const frames = [...css.matchAll(/@keyframes molten-[a-z]+ \{([\s\S]*?)\n\}/g)].map((m) => m[1]);
  const props = new Set(frames.flatMap((f) => [...f.matchAll(/\n\s*([a-z-]+):/g)].map((m) => m[1])));
  return [...props].every((p) => p === "opacity" || p === "transform");
})());
/*
 * The edge's breath, as it is actually built.
 *
 * It was `molten-breathe`, 0.78 to 1 on the rim node itself, and that is a
 * full-card repaint per card per frame. It is now `molten-swell` on two
 * strips that composite, and a strip goes the whole way from nothing to
 * itself — the trough has to be the card without it, or every card is
 * permanently brighter for the sake of a wobble. So the rule that keeps the
 * edge from blinking is not a small range on a big surface; it is that the
 * surface is small and the range is the whole of it.
 */
check("the edge swells on a strip rather than dimming the whole card", (() => {
  const b = /@keyframes molten-swell \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const o = [...b.matchAll(/opacity: ([\d.]+)/g)].map((m) => Number(m[1]));
  const strip = /\[data-molten\]::before,\n\[data-molten\]::after \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  return o.includes(0) && o.includes(1)
    && /height: var\(--mo-breath, 8px\)/.test(strip)
    && /animation: molten-swell/.test(strip);
})());
check("and `molten-breathe` is gone rather than declared and unused",
  !/molten-breathe/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")) && !MOLTEN_KEYFRAMES.includes("molten-breathe"));
check("the flare is occasional: dark for most of its turn", (() => {
  const f = /@keyframes molten-flare \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  return /62%\s*\{ opacity: 0/.test(f);
})());
check("the ember fades up rather than switching on", (() => {
  const e = /@keyframes molten-ember \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const o = [...e.matchAll(/opacity: ([\d.]+)/g)].map((m) => Number(m[1]));
  return o.includes(0.5) || o.some((v) => v > 0 && v < 0.6);
})());
check("the interior is calm where the words are", /calm where it is read/.test(css) && /\.molten > \* \{[\s\S]*?z-index: 2/.test(css));
check("reduced motion stops all of it and leaves the construct lit",
  /prefers-reduced-motion: reduce/.test(css) && /animation: none !important/.test(css));

/* ------------------------------------------------------------------ */
/* 5. Cheap by construction                                            */
/* ------------------------------------------------------------------ */

check("a construct's boil is contained to the construct", /contain: layout paint/.test(css));
check("no blend mode, which costs a read-back of everything under it", !/mix-blend-mode/.test(css));
/*
 * A mask that does not itself change is rasterised once and then only
 * composited, so it costs nothing on a layer whose animation is a
 * transform. Measured at thirty boards, against the same build with the
 * painted tile: idle style 168.2ms against 168.8ms, idle tasks 714.8ms
 * against 739.0ms — inside the noise between two runs of the same build.
 * What would cost is a mask whose own value animates, and none does.
 */
check("no mask is animated: the ones there are still, and cost nothing", (() => {
  const framed = [...css.matchAll(/@keyframes molten-[a-z]+ \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join("\n");
  return !/mask/.test(framed) && !/transition:[^;]*mask/.test(css);
})());
/*
 * NO TWO FEATURES SHARE A DIRECTION.
 *
 * One tile sliding is one vector, and every filament on the card shares it:
 * measured as the spread of headings across a card's patches — 0 being every
 * moving part of it going the same way, 1 being no agreement at all — a card
 * with one layer gliding over a still one came out at 0.000 on both
 * temperatures. That is a photograph being dragged behind a window rather
 * than a surface that is alive, and it was the note.
 *
 * Two layers of the same material now, opposed: one slides across, one
 * slides back over a bigger tile at a different rate. The same measure, 0.44
 * to 0.52 green.
 *
 * TWO, AND NOT THREE. There was a third that turned, and it is the one thing
 * here that was reverted rather than kept. It cost a quarter to a third of
 * the timeline's frames while nothing was moving — 14.0 to 15.8 frames per
 * 900ms at thirty boards with it against 18.2 to 20.4 without, and 11.3
 * against 16.5 on the run that first found it — because a third composited
 * layer per construct is the cliff, whatever that layer does. The spread it
 * was built for was no worse without it and slightly better, green 0.44 to
 * 0.52 against 0.40 to 0.41 over three runs each, and brightness did not
 * move (whole-face oklab L 0.2370 to 0.2363 green), so no dial had to be
 * re-tuned when it came out. The full table is in the stylesheet, at
 * `[data-molten]::before`.
 *
 * So: exactly two moving layers on a face, and a third is a thing to
 * measure against that table before it goes in.
 */
check("two layers of the same material, and they do not move the same way", (() => {
  const rule = (sel) => new RegExp(`${sel} \\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1] ?? "";
  const front = rule("\\.molten::before"), back = rule("\\.molten::after");
  const of = (r) => /animation: (molten-[a-z]+) ([\d.]+)s[^;]*/.exec(r)?.slice(1).join(" ");
  const moves = [of(front), of(back)];
  return moves.every(Boolean) && new Set(moves).size === 2
    && /animation: molten-drift/.test(front) && /animation: molten-ebb/.test(back);
})());
/*
 * The rim node's two carry the edge's swell and nothing that slides.
 *
 * They were empty, and before that they carried the turning layer that cost
 * a third of the timeline's frames. What is on them now is the opposite kind
 * of thing: an eight-pixel band at the top and one at the bottom, fading
 * their own light in and out. No tile, no transform, no period — so the
 * check is that they hold a swell and that nothing which slides has crept
 * back onto them.
 */
check("…and what moves on the rim node is a swell, not anything that slides", (() => {
  const both = /\[data-molten\]::before,\n\[data-molten\]::after \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  return /animation: molten-swell /.test(both)
    && /height: var\(--mo-breath, 8px\);/.test(both)
    && !/background-image/.test(both) && !/nebula-period/.test(both)
    && !/--molten-swirl/.test(css) && !/@keyframes molten-turn\b/.test(css);
})());
/*
 * And it swells from nothing rather than dimming from full, so a card at the
 * trough of the cycle is exactly the card as it would be without any of
 * this. The old one faded the whole rim between 0.78 and 1 — a permanent
 * change to every card for a wobble nobody could see.
 */
check("…the edge gathers light and lets it go, so the resting card is untouched", (() => {
  const k = /@keyframes molten-swell \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const both = /\[data-molten\]::before,\n\[data-molten\]::after \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  return /from \{ opacity: 0; \}/.test(k) && /to\s+\{ opacity: 1; \}/.test(k) && /\n  opacity: 0;/.test(both);
})());
/*
 * On the two long edges and not on the short sides, because two
 * pseudo-elements is what a construct has and a ring is not a rectangle.
 * A whole-card element could carry all four and costs what it always cost:
 * measured at twelve boards, a breath on a whole card is 31.5 frames per
 * 900ms against 38.0 for one on a strip, with nothing added at 36.1.
 */
check("…and it is on a strip rather than a whole card, which is the whole reason it can exist",
  /a whole-card breath, not promoted      31\.5/.test(css) && /a 14px strip breath, not promoted      38\.0/.test(css));
check("…and the cost of having had a third is written down rather than forgotten", (() => {
  const note = /\* {3}with the turn\s+([\d.]+)\s+([\d.]+)/.exec(css);
  return /AND NOTHING TURNING\. THE MEASUREMENT/.test(css) && !!note
    && /no layer on a card turns/.test(css);
})());
check("…and the two sliding ones are near enough in weight that neither is the only thing on the card", (() => {
  const w = (sel) => {
    const b = new RegExp(`\\.molten-${sel} \\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1] ?? "";
    return [Number(/--mo-cloud: ([\d.]+);/.exec(b)?.[1]), Number(/--mo-cloud-still: ([\d.]+);/.exec(b)?.[1])];
  };
  // An opaque front layer hides everything behind it, and a card with one
  // layer on it slides as one picture. The green sat at 1 and measured 0.002.
  return ["verdant", "ember", "azure"].every((k) => {
    const [front, back] = w(k);
    return front > 0 && back > 0 && front <= 0.8 && Math.max(front, back) / Math.min(front, back) <= 1.6;
  });
})(), ["verdant", "ember", "azure"].map((k) => `${k} ${/--mo-cloud: ([\d.]+);/.exec(new RegExp(`\\.molten-${k} \\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1] ?? "")?.[1]}/${/--mo-cloud-still: ([\d.]+);/.exec(new RegExp(`\\.molten-${k} \\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1] ?? "")?.[1]}`).join(", "));
check("nothing is thrown past the rim: no outward shadow on the edge, and no spark", (() => {
  // The drawn rim is a named set now, because a temperature with one of J's
  // sprites wears that instead and the ones without still need this. Both
  // are the edge, so both are read.
  const edge = /^\[data-molten\] \{([\s\S]*?)\n\}/m.exec(css)?.[1] ?? "";
  const lines = /--molten-rim-lines:([\s\S]*?);\n/.exec(css)?.[1] ?? "";
  const shadows = [...`${lines}\n${edge}`.matchAll(/^\s+(inset )?0 /gm)];
  return shadows.length > 0 && shadows.every((m) => m[1] === "inset ");
})());
/*
 * THE RIM IS ONE OF J'S, CUT INTO NINE.
 *
 * The rim is the most particular part of one of his boxes — a moulded bezel
 * with its own glass, its own highlight along the top and its own light
 * caught in the corners — and an inset shadow will never be that. It is also
 * the part a stretched photograph ruins fastest, because a card is a band on
 * one row and a square on another. So the sheet is cut into nine: the four
 * corners are drawn at their own size and keep their moulding and their
 * radius at every card size, and only the four sides stretch.
 */
check("the rim is a nine-slice of J's sprite, so only the sides stretch", (() => {
  const edge = /^\[data-molten\] \{([\s\S]*?)\n\}/m.exec(css)?.[1] ?? "";
  return /border-image: var\(--mo-rim\) var\(--mo-rim-slice, 20\) \/ var\(--mo-rim-width\) stretch;/.test(edge)
    && /border: var\(--mo-rim-width\) solid transparent;/.test(edge)
    && /box-sizing: border-box;/.test(edge);
})());
check("…with no `fill`, so the middle is J's face rather than J's sheet", (() => {
  const edge = /^\[data-molten\] \{([\s\S]*?)\n\}/m.exec(css)?.[1] ?? "";
  return !/border-image:[^;]*\bfill\b/.test(edge);
})());
check("…and the sheets are cut and served", (() => {
  for (const f of ["rim-green.png", "rim-red.png"]) if (!existsSync(`public/construct/${f}`)) return false;
  return existsSync("scripts/cut-rims.mjs");
})());
check("each temperature names its own sheet, and the plain construct has none", (() => {
  const v = /\.molten-verdant \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const e = /\.molten-ember \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const base = /^\.molten \{([\s\S]*?)\n\}/m.exec(css)?.[1] ?? "";
  return /--mo-rim: url\("\/construct\/rim-green\.png"\);/.test(v)
    && /--mo-rim: url\("\/construct\/rim-red\.png"\);/.test(e)
    && /--mo-rim: none;/.test(base) && /--mo-rim-shadow: var\(--molten-rim-lines\);/.test(base);
})());
check("a construct with a sprite drops the drawn rim, so there are never two", (() => {
  const v = /\.molten-verdant \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const e = /\.molten-ember \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  return /--mo-rim-shadow: none;/.test(v) && /--mo-rim-shadow: none;/.test(e);
})());
/*
 * A bar is ten pixels tall and the bezel is nine on each side: the two would
 * meet in the middle and there would be no bar left. The drawn line is the
 * right rim at that size, and it is the one a bar has always had.
 */
check("a bar keeps the drawn rim, because a moulded bezel would eat it", (() => {
  const bar = /\.molten-bar \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  return /--mo-rim: none;/.test(bar) && /--mo-rim-width: 0px;/.test(bar) && /--mo-rim-shadow: var\(--molten-rim-lines\);/.test(bar);
})());
check("…and it wins, because the shape is declared after the temperatures", css.indexOf(".molten-bar {") > css.indexOf(".molten-ember {"));
check("the bezel thickens as the construct forms, rather than arriving whole at the end",
  /border-width: calc\(var\(--form-surface, 1\) \* var\(--mo-rim-width\)\);/.test(css)
  && /border-image-width: calc\(var\(--form-surface, 1\) \* var\(--mo-rim-width\)\);/.test(css));
/*
 * The tabs. Every one of J's boxes has a small decorative tab sticking out at
 * the middle of a left or right edge — which is exactly where a nine-slice's
 * side strip is, and a side strip stretches. One tab would be a bar down the
 * whole side of the card. The cut leaves them outside the sheet, and this is
 * the pin that says so: the sheet's own edges are where the box's edges are.
 */
check("the sheets have no tab hanging off a side, which a stretched strip would smear", (() => {
  const cut = readFileSync("scripts/cut-rims.mjs", "utf8");
  return /The tabs come off/.test(cut) && /\["box-green\.png", "rim-green\.png", \[6, 5, 530, 268\]\]/.test(cut);
})());
check("and the boxes throw only weight, never colour",
  !/0 0 2\dpx -\dpx oklch\(0\.[78]/.test(readFileSync("src/features/studio/Timeline.tsx", "utf8")));
check("there is no canvas and no loop in any of it", (() => {
  // The word appears in the file's own account of itself; what matters is
  // that no rule draws into one and nothing here runs a frame loop.
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return !/canvas/i.test(rules) && !/requestAnimationFrame|setInterval/.test(readFileSync("src/core/ui/molten.ts", "utf8"));
})());

/* ------------------------------------------------------------------ */
/* 6. The handle both branches use                                     */
/* ------------------------------------------------------------------ */

check("a construct is asked for by name",
  moltenClass("lantern") === "molten" && moltenClass("ember") === "molten molten-ember" && moltenClass("verdant") === "molten molten-verdant");
check("all three classes exist in the stylesheet",
  /^\.molten \{/m.test(css) && /^\.molten-ember \{/m.test(css) && /^\.molten-verdant \{/m.test(css));
check("a seed is stable for the same id", moltenSeed("t7")["--molten-seed"] === moltenSeed("t7")["--molten-seed"]);
check("and different for different ones", moltenSeed("t7")["--molten-seed"] !== moltenSeed("t8")["--molten-seed"]);
check("the delays are built from it", /calc\(var\(--molten-seed\) \* -[\d.]+s\)/.test(css));
check("every animation gets its own offset, so thirty are not one machine",
  // Two: the glide and the rim's breath. The flare and the ember had the
  // other two and are gone on purpose: the reference is a rim and a nebula
  // and nothing else, and the ember was the one thing that left the rim.
  (css.match(/animation-delay: calc\(var\(--molten-seed\)/g) ?? []).length >= 2);

const timeline = readFileSync("src/features/studio/Timeline.tsx", "utf8");
check("an iteration is the green construct, and a lane's work the blue one", /moltenClass\(lane \? "azure" : "verdant"\)/.test(timeline));
check("a drawing is the red one", /moltenClass\("ember"\)/.test(timeline));
check("and nothing on the timeline still asks for the base set", !/moltenClass\("lantern"\)/.test(timeline));
check("each carries the edge, the flare and the ember on one node",
  (timeline.match(/<span data-molten="" \/>/g) ?? []).length === 2);
check("and each is seeded from its own id", (timeline.match(/moltenSeed\(thread\.id\)/g) ?? []).length === 2);

const key = readFileSync("src/features/studio/DrawQueue.tsx", "utf8");
/*
 * The key is the same green, and it is not a construct.
 *
 * It was one — the key that opens the green boards made of what they are
 * made of — and that was reverted on the sibling branch for a reason worth
 * keeping written down: the material is a slow drift across a surface, and a
 * key 28px tall in the corner of a bar has no surface for anything to drift
 * across. It read as noise on a button. So the same family, flat: the stop
 * the words already sat on for the face and the hot stop for the edge,
 * which is the whole of what a construct would have given it at that size.
 *
 * The pin is on the colours rather than on the class, because the agreement
 * is that it stays in the family — a second green here is the thing this
 * file exists to prevent — and on the absence of the surface, so nobody puts
 * three animated layers back into the bar by accident.
 */
/*
 * The key wears the construct now, at the size of a key.
 *
 * These two pinned the opposite: a flat slab painted straight from
 * --verdant-body and --verdant-hot, with the construct kept off it because
 * a key was held to be too small to be a surface anything drifts across.
 * One tile at two settings settled that the other way — `moltenKeyClass` is
 * `moltenClass` plus `molten-key`, the same construct at a key's scale —
 * so a key carrying a surface is the intent rather than an accident, and
 * asking for flatness here asks for the change to be undone.
 *
 * What is still worth pinning is the part that has not changed: it is the
 * verdant family and not a second green, and it goes through the one
 * definition rather than painting its own. That is what this file exists
 * to prevent, and it survives the key growing a surface.
 */
check("Finish is the same green as the boards it opens",
  /moltenKeyClass\("verdant"\)/.test(key) && !/--ember-|--molten-body/.test(key.slice(key.indexOf("process-key") - 400, key.indexOf("process-key") + 400)));
check("…and wears the construct at the size of a key, through the one definition",
  /<span data-molten="" \/>/.test(key) && /moltenSeed\("finish"\)/.test(key) && !/moltenClass\("verdant"\)[\s\S]{0,40}process-key/.test(key));
check("the key still presses, because a construct that did not would be a picture of one",
  /process-key/.test(key) && /\.process-key:active/.test(readFileSync("src/app/globals.css", "utf8")));
check("nothing is painted on top of the light to make it look lit",
  !/textShadow/.test(key) && !/background: linear-gradient\(oklch\(0\.31 0\.075 150\)/.test(readFileSync("src/app/globals.css", "utf8")));

/* ------------------------------------------------------------------ */
/* 7. In the browser                                                   */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
