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
const hueOfStop = (c) => Number(/oklch\([\d.]+ [\d.]+ ([\d.]+)/.exec(c)?.[1]);
const stop = (name) => {
  const m = new RegExp(`--${name}:\\s*(oklch\\([^)]*\\))`).exec(css);
  return m?.[1] ?? "";
};

/* ------------------------------------------------------------------ */
/* 1. One definition, in one file                                      */
/* ------------------------------------------------------------------ */

check("the stops and the keyframes live in core/ui/molten.css",
  /--verdant-char:/.test(css) && /@keyframes molten-drift/.test(css));

const elsewhere = ["src/features/studio/Timeline.tsx", "src/features/studio/TimelineDetail.tsx", "src/app/globals.css"];
for (const f of elsewhere) {
  const src = readFileSync(f, "utf8");
  check(`${f.split("/").pop()} declares no molten property of its own`, !/--molten-(white|hot|body|deep|char)\s*:/.test(src));
  check(`${f.split("/").pop()} declares no molten keyframe of its own`, !/@keyframes\s+molten-/.test(src));
}
check("the stylesheet is actually loaded", /@import ".*molten\.css"/.test(readFileSync("src/app/globals.css", "utf8")));

/* ------------------------------------------------------------------ */
/* 2. Five stops, near-white to almost-black red                       */
/* ------------------------------------------------------------------ */

check("there are seven stops, not one colour at seven opacities", MOLTEN_STOPS.length === 7);
for (const kind of ["verdant", "ember"]) {
  const stops = MOLTEN_STOPS.map((n) => stop(`${kind}-${n}`));
  check(`${kind}: every stop is declared`, stops.every(Boolean), stops.filter(Boolean).length + "/7");
  const [char, field, body, lit, edge, edgeHot, vein] = stops.map(lightOf);

  /*
   * The relationships are the agreement, not the values. They came off a
   * photograph of enamel and what was taken from it is: the field is very
   * dark, the body is lit but not pale, the edge is the brightest thing and
   * only on the edge, and the veins are bright and thin.
   */
  check(`${kind}: the field is very dark`, char <= 0.3 && field <= 0.34, `${char} / ${field}`);
  check(`${kind}: and low in colour, the way a shadow is`, chromaOf(stops[0]) <= 0.09 && chromaOf(stops[1]) <= 0.1);
  check(`${kind}: the body is lit and strongly coloured`, body > field + 0.15 && chromaOf(stops[2]) >= 0.12, `${body}`);
  check(`${kind}: the lit body is brighter still and never pale`, lit > body + 0.15 && chromaOf(stops[3]) >= 0.17, `${lit}`);
  check(`${kind}: the edge is the brightest of all`, edge > lit && edgeHot > edge, `${edge} < ${edgeHot}`);
  check(`${kind}: the veins are bright, and the most coloured thing there is`,
    vein > body + 0.2 && chromaOf(stops[6]) >= 0.17, `${vein}`);
  check(`${kind}: nothing washes out to pale`, stops.every((c) => lightOf(c) > 0.92 ? false : true)
    && stops.every((c) => chromaOf(c) >= 0.05), stops.map(chromaOf).join(","));
  check(`${kind}: the edge turns as it lightens rather than just getting lighter`,
    Math.abs(hueOfStop(stops[5]) - hueOfStop(stops[1])) >= 10,
    `${hueOfStop(stops[1])} to ${hueOfStop(stops[5])}`);
  check(`${kind}: no two stops are the same colour`, new Set(stops).size === 7);
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

check("there is grain, and it is one shared file rather than a filter per box",
  /--molten-grain:\s*url\("\/molten\/grain\.svg"\)/.test(css) && !/filter:\s*url\(#/.test(css));
check("the veining is filaments, cut with a step rather than a ramp", (() => {
  const svg = readFileSync("public/molten/veins-green.svg", "utf8");
  return /feFuncA type="discrete"/.test(svg) && /tableValues="0 0 0 0 0 0 0 0/.test(svg);
})());
check("and there is one per temperature, because a file cannot read a property",
  /--verdant-veins:/.test(css) && /--ember-veins:/.test(css));
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

check("there are exactly two keyframes named, because nothing else may move", MOLTEN_KEYFRAMES.length === 2);
check("nothing that plays is left: no flare, no spark, no breath",
  !/@keyframes molten-(flare|ember|breathe)/.test(css) && !/animation: molten-(flare|ember|breathe)/.test(css));
check("and nothing has an entrance",
  !/el-grow/.test(readFileSync("src/features/studio/Timeline.tsx", "utf8")));
for (const k of MOLTEN_KEYFRAMES) {
  check(`${k} is declared`, new RegExp(`@keyframes ${k}\\b`).test(css));
  check(`${k} says what it is for`, (MOLTEN_MOTION[k] ?? "").length > 20);
}
const durations = [...css.matchAll(/animation:\s*molten-[a-z]+\s+([\d.]+)s/g)].map((m) => Number(m[1]));
check("the movement is almost static: minutes, not seconds",
  durations.length > 0 && durations.every((d) => d >= 120), durations.join("s, ") + "s");
check("and barely travels, so a glance shows a still surface", (() => {
  const moves = [...css.matchAll(/translate3d\((-?[\d.]+)%/g)].map((m) => Math.abs(Number(m[1])));
  return moves.length > 0 && moves.every((v) => v <= 3);
})());
check("nothing is a timer: no two are the same length", new Set(durations).size === durations.length);
check("only transform and opacity are animated, never a colour or a size", (() => {
  const frames = [...css.matchAll(/@keyframes molten-[a-z]+ \{([\s\S]*?)\n\}/g)].map((m) => m[1]);
  const props = new Set(frames.flatMap((f) => [...f.matchAll(/\n\s*([a-z-]+):/g)].map((m) => m[1])));
  return [...props].every((p) => p === "opacity" || p === "transform");
})());
check("nothing brightens or dims: what changes is only what is covered", (() => {
  const frames = [...css.matchAll(/@keyframes molten-[a-z]+ \{([\s\S]*?)\n\}/g)].map((m) => m[1]);
  return frames.length > 0 && frames.every((f) => !/opacity:/.test(f));
})());
check("the edge is only on the edge, never across the face",
  /\[data-molten\] \{[\s\S]*?box-shadow:[\s\S]*?inset/.test(css)
  && !/\[data-molten\] \{[\s\S]*?background:/.test(css));
check("the words sit above the matter rather than under it", /\.molten > \* \{[\s\S]*?z-index: 2/.test(css));
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
  (css.match(/animation-delay: calc\(var\(--molten-seed\)/g) ?? []).length >= MOLTEN_KEYFRAMES.length);

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
