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
import { readFileSync } from "node:fs";
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
for (const kind of ["molten", "ember", "verdant"]) {
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
  Object.keys(MOLTEN_MEANS).length === 3 && /iteration/.test(MOLTEN_MEANS.verdant) && /drawing/.test(MOLTEN_MEANS.ember));
check("the stylesheet says the same thing, for the branch that reads it",
  /--verdant-\*\s+an ITERATION/.test(css) && /--ember-\*\s+a DRAWING/.test(css));

/* ------------------------------------------------------------------ */
/* 3. Texture, not a smooth gradient                                   */
/* ------------------------------------------------------------------ */

check("there is grain, and it is one shared tile rather than a filter per box",
  /--molten-grain:\s*url\("data:image\/svg\+xml/.test(css) && !/filter:\s*url\(#/.test(css));
check("the body is veined: several blobs at irregular sizes", (() => {
  const vein = /\.molten::before,\s*\n\.molten::after \{[\s\S]*?\n\}/.exec(css)?.[0] ?? "";
  return (vein.match(/radial-gradient/g) ?? []).length >= 4;
})());
check("the density is uneven, because two veinings overlap",
  /\.molten::after \{[\s\S]*?transform: scaleX\(-1\)/.test(css));
check("nothing is a single smooth even gradient end to end",
  (css.match(/radial-gradient/g) ?? []).length >= 6);

/* ------------------------------------------------------------------ */
/* 4. Always moving, never demanding                                   */
/* ------------------------------------------------------------------ */

check("there are exactly five keyframes named", MOLTEN_KEYFRAMES.length === 5);
for (const k of MOLTEN_KEYFRAMES) {
  check(`${k} is declared`, new RegExp(`@keyframes ${k}\\b`).test(css));
  check(`${k} says what it is for`, (MOLTEN_MOTION[k] ?? "").length > 20);
}
const durations = [...css.matchAll(/animation:\s*molten-[a-z]+\s+([\d.]+)s/g)].map((m) => Number(m[1]));
check("every animation is slow: nothing under nine seconds", durations.length > 0 && durations.every((d) => d >= 9),
  durations.join("s, ") + "s");
check("nothing is a timer: no two are the same length", new Set(durations).size === durations.length);
check("only transform and opacity are animated, never a colour or a size", (() => {
  const frames = [...css.matchAll(/@keyframes molten-[a-z]+ \{([\s\S]*?)\n\}/g)].map((m) => m[1]);
  const props = new Set(frames.flatMap((f) => [...f.matchAll(/\n\s*([a-z-]+):/g)].map((m) => m[1])));
  return [...props].every((p) => p === "opacity" || p === "transform");
})());
check("the edge breathes rather than blinking: under a quarter of its range", (() => {
  const b = /@keyframes molten-breathe \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const o = [...b.matchAll(/opacity: ([\d.]+)/g)].map((m) => Number(m[1]));
  return o.length >= 2 && Math.max(...o) - Math.min(...o) <= 0.25;
})());
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
check("no mask on an animated layer", !/mask-image:/.test(css));
check("one veining layer moves and one stands still, for the same picture at half the cost",
  /\.molten::after \{[\s\S]*?animation: none/.test(css));
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
  (css.match(/animation-delay: calc\(var\(--molten-seed\)/g) ?? []).length >= 4);

const timeline = readFileSync("src/features/studio/Timeline.tsx", "utf8");
check("an iteration is the green construct", /moltenClass\("verdant"\)/.test(timeline));
check("a drawing is the red one", /moltenClass\("ember"\)/.test(timeline));
check("and nothing on the timeline still asks for the base set", !/moltenClass\("lantern"\)/.test(timeline));
check("each carries the edge, the flare and the ember on one node",
  (timeline.match(/<span data-molten="" \/>/g) ?? []).length === 2);
check("and each is seeded from its own id", (timeline.match(/moltenSeed\(thread\.id\)/g) ?? []).length === 2);

const key = readFileSync("src/features/studio/DrawQueue.tsx", "utf8");
check("Finish is green, because it is the key to the green boards", /moltenClass\("verdant"\)/.test(key));
check("and it carries the same edge node", /<span data-molten="" \/>/.test(key));
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
console.log(`\nall good — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
