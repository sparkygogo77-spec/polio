#!/usr/bin/env node
/**
 * THE TURNABLE ORB IS PUBLISHED AS THE BOARD SHOWS IT.
 *
 * The audit (2026-10-11, orb-webgl-published-as-2d): "Orb, turnable" was a
 * three.js ball in glass, metal or matte on the board, and everywhere it went
 * out it became the plain drawn planet: the published page ran the planet
 * script, which knew no surface; a builder-ready site's NEXT.md line asked for
 * plain `planet`; and its card said the site shows it still until a build
 * makes it real, which no build did. J styled a glass orb and the live site
 * had another one. Now one script draws it everywhere (`library/planetJs.ts`):
 * its surface rides on `data-planet-surface` and is lit on the graphics card
 * (WebGL, no library), and where WebGL is missing the page draws the same
 * light itself. Checked with a stand-in page and a stand-in graphics card,
 * no browser:
 *
 *   1. the board draws the turnable orb with that script, not three.js, and
 *      hands it its surface;
 *   2. the script draws a surface on the graphics card: every uniform it sets
 *      is declared in its shader, the shader keeps to WebGL 1's rules, and
 *      the surface's numbers reach it; without WebGL, or with a shader that
 *      does not compile, it draws the same surface on a fresh 2D canvas and
 *      says so; a ball with no surface never asks for WebGL;
 *   3. the 2D drawing shows the surface: glass gleams white and brighter
 *      than matte, metal's highlight takes the key light's colour;
 *   4. the published page carries it (the planet feature ships for the orb,
 *      its settings kept), and so does the kit's vendor/builder-motion.js;
 *   5. the NEXT.md line for a new orb on a builder-ready site gives the exact
 *      value with its surface; the drawn orb and the cube keep theirs;
 *   6. its card says it works when published, and promises no refraction.
 *
 *   node tests/orb-turnable-published.mjs
 *
 * The board, the Preview and a served page drawing it on a real graphics
 * card: tests/orb-turns.mjs and tests/orb-planet.mjs (browser).
 *
 * Covers: src/features/studio/shelf/library/planetJs.ts, src/features/studio/shelf/parts/Orb.tsx, src/features/studio/shelf/library/works.ts, src/features/studio/codeAsks.ts, src/features/studio/shelf/shelfPlan.ts, src/features/studio/shelf/catalog.ts, src/features/studio/send-out/kitMotion.ts, kit/starter/vendor/builder-motion.js
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });
const studio = (f) => join(root, "src", "features", "studio", f);
const P = await jiti.import(studio("shelf/library/planetJs.ts"));
const W = await jiti.import(studio("shelf/library/works.ts"));
const A = await jiti.import(studio("codeAsks.ts"));
const K = await jiti.import(studio("send-out/kitMotion.ts"));
const SP = await jiti.import(studio("shelf/shelfPlan.ts"));
const SF = await jiti.import(studio("shelfFacts.ts"));
const C = await jiti.import(studio("shelf/catalog.ts"));
const read = (f) => readFileSync(join(root, f), "utf8");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* ------------------------------------------------------------ a stand-in page */
/** The skin the 2D drawing reads back: one colour, so what differs between surfaces is the light alone. */
const SKIN = [92, 108, 70];
function flat(c) {
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 1, lineJoin: "",
    fillRect() {}, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, save() {}, restore() {}, clip() {}, setTransform() {}, clearRect() {}, drawImage() {},
    createRadialGradient: () => ({ addColorStop() {} }),
    getImageData(x, y, w, h) { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < d.length; i += 4) d.set([...SKIN, 255], i); return { data: d }; },
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData(img) { c.drawn = img.data; },
  };
}

/** A stand-in graphics card: it records what it is asked, and compiles a shader unless told not to. */
function card({ compiles = true } = {}) {
  const k = { sources: [], uniforms: {}, looked: [], drawn: 0, uploads: 0, lost: false };
  const names = () => new Set(k.sources.flatMap((s) => [...s.matchAll(/uniform\s+\w+\s+([^;]+);/g)].flatMap((m) => m[1].split(",").map((x) => x.trim()))));
  const set = (u, v) => { if (u) k.uniforms[u.name] = [...v]; };
  const consts = Object.fromEntries(["VERTEX_SHADER", "FRAGMENT_SHADER", "COMPILE_STATUS", "LINK_STATUS", "ARRAY_BUFFER", "STATIC_DRAW", "FLOAT", "TEXTURE0", "TEXTURE_2D", "TEXTURE_WRAP_S", "TEXTURE_WRAP_T", "REPEAT", "CLAMP_TO_EDGE", "TEXTURE_MIN_FILTER", "TEXTURE_MAG_FILTER", "LINEAR", "RGBA", "UNSIGNED_BYTE", "COLOR_BUFFER_BIT", "TRIANGLES"].map((n, i) => [n, i + 1]));
  const gl = {
    ...consts,
    createShader: (t) => ({ t }), shaderSource: (s, src) => { k.sources.push(src); }, compileShader() {}, getShaderParameter: () => compiles,
    createProgram: () => ({}), attachShader() {}, linkProgram() {}, getProgramParameter: () => true, useProgram() {},
    createBuffer: () => ({}), bindBuffer() {}, bufferData() {}, getAttribLocation: () => 0, enableVertexAttribArray() {}, vertexAttribPointer() {},
    activeTexture() {}, createTexture: () => ({}), bindTexture() {}, texParameteri() {}, texImage2D: () => { k.uploads++; },
    getUniformLocation: (pr, name) => { k.looked.push(name); return names().has(name) ? { name } : null; },
    uniform1i: (u, v) => set(u, [v]), uniform1f: (u, v) => set(u, [v]), uniform2f: (u, ...v) => set(u, v), uniform3f: (u, ...v) => set(u, v), uniform4f: (u, ...v) => set(u, v),
    uniform3fv: (u, v) => set(u, v), uniformMatrix3fv: (u, t, v) => set(u, v),
    viewport() {}, clearColor() {}, clear() {}, drawArrays: () => { k.drawn++; },
    getExtension: (n) => (n === "WEBGL_lose_context" ? { loseContext: () => { k.lost = true; } } : null),
  };
  return { gl, k };
}

let gpu = null;
function canvasEl() {
  const c = {
    tag: "canvas", attrs: {}, style: {}, width: 300, height: 150, asked: [], parent: null,
    setAttribute(k, v) { this.attrs[k] = v; },
    remove() { if (this.parent) this.parent.kids.splice(this.parent.kids.indexOf(this), 1); this.parent = null; },
    addEventListener() {}, getBoundingClientRect: () => ({ width: 200, height: 200 }),
    getContext(type) {
      this.asked.push(type);
      if (type === "2d") return this.webgl ? null : (this.flat ??= flat(this));
      if (this.flat || !gpu) return null;
      return (this.webgl = gpu.gl);
    },
  };
  return c;
}
globalThis.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: false }) };
globalThis.getComputedStyle = () => ({ position: "relative" });
globalThis.document = { createElement: () => canvasEl() };

/** One ball in a 200px box, still, with these `data-planet-*` settings; `with` is the graphics card it is given, if any. */
function ball(data, withCard = null) {
  gpu = withCard;
  const host = {
    dataset: { planetSpin: "no", planetHands: "no", ...data }, style: {}, isConnected: true, kids: [],
    getBoundingClientRect: () => ({ width: 200, height: 200 }),
    querySelectorAll(sel) { return sel.startsWith("canvas") ? this.kids.filter((k) => k.tag === "canvas") : []; },
    appendChild(c) { this.kids.push(c); c.parent = this; },
  };
  const p = new Function(`${P.PLANET_JS}\nreturn polioPlanet;`)()(host, {});
  return { host, p, cv: host.kids[0] ?? null };
}

/* ------------------------------------------------------------------ 1 */
const orb = read("src/features/studio/shelf/parts/Orb.tsx");
check("1. the board draws the turnable orb with the planet script, in the surface he picked",
  /id === "orb-webgl"[\s\S]{0,400}<PlanetBall s=\{s\} surface=\{opt\(options, "surface", "glass"\)\}/.test(orb) && /data-planet-surface=\{surface \|\| undefined\}/.test(orb));
check("1. …and three.js is no longer how the board draws it", !/import\("three"\)|from "three"/.test(orb));
check("1. …and the board hears when the page drew it instead, as before (its tag says so)", /if \(surface && p && !p\.gl\) onFlat\?\.\(\)/.test(orb) && /tag=\{failed \? "Drawn, no WebGL here"/.test(orb));

/* ------------------------------------------------------------------ 2 */
const glass = card();
const g = ball({ planetHue: "96", planetSurface: "glass" }, glass);
check("2. a ball in glass is drawn on the graphics card", g.p?.gl === true && glass.k.drawn > 0 && g.host.kids.length === 1, `gl ${g.p?.gl}, ${glass.k.drawn} draw(s)`);
check("2. …wearing its own skin, uploaded to the card", glass.k.uploads === 1);
const [vs, fs] = glass.k.sources;
const declared = new Set([vs, fs].flatMap((s) => [...(s ?? "").matchAll(/uniform\s+\w+\s+([^;]+);/g)].flatMap((m) => m[1].split(",").map((x) => x.trim()))));
const looked = new Set(glass.k.looked);
check("2. every uniform the script sets is declared in its shader, and every one declared is set",
  declared.size > 5 && [...looked].every((n) => declared.has(n)) && [...declared].every((n) => looked.has(n)), [...declared].join(", "));
check("2. the surface's numbers reach the shader (glass: body, rims, tightness, shine; tint and gleam)",
  JSON.stringify(glass.k.uniforms.A) === JSON.stringify([0.78, 1.35, 140, 0.95]) && JSON.stringify(glass.k.uniforms.B) === JSON.stringify([0, 0.7]), `${glass.k.uniforms.A} / ${glass.k.uniforms.B}`);
check("2. …and where the ball faces, as a turn", glass.k.uniforms.M?.length === 9 && glass.k.uniforms.S?.[0] === 200);
/* WebGL 1's shading language has no implicit int-to-float and reserves some plain words: a slip there compiles nowhere. */
const body = (fs ?? "").split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
const ints = body.match(/(?<![\w.])\d+(?![\w.])/g) ?? [];
const reserved = body.match(/\b(half|fixed|input|output|sample|filter|cast|namespace|using|long|short|double|unsigned|inline|volatile|public|static|extern|external|interface|flat|superp|template|this|packed|goto|switch|default|class|union|enum|typedef|sizeof|asm)\b|__/g) ?? [];
check("2. the shader keeps to WebGL 1: a float precision, no bare whole numbers, no reserved words",
  /precision highp float;/.test(fs ?? "") && /precision mediump float;/.test(fs ?? "") && ints.length === 0 && reserved.length === 0, [...ints, ...reserved].join(" "));
/* The 2D drawing works out the same light: the numbers in its sums are the shader's. */
const sizeAt = P.PLANET_JS.indexOf("function size()");
const sums = P.PLANET_JS.slice(sizeAt, P.PLANET_JS.indexOf("return true;\n  }", sizeAt));
const lightNums = ["0.14", "0.92", "0.25", "0.9", "0.2", "0.85", "0.18", "2.2", "300"];
check("2. the shader works out the 2D drawing's light, number for number", lightNums.every((x) => sums.includes(x) && (fs ?? "").includes(x)), lightNums.filter((x) => !sums.includes(x) || !(fs ?? "").includes(x)).join(", "));
g.p.stop();
check("2. stopped, it lets go of the graphics card at once and leaves the box empty", glass.k.lost === true && g.host.kids.length === 0);

const none = ball({ planetHue: "96", planetSurface: "glass" }, null);
check("2. with no WebGL the glass ball is drawn by the page instead, and says so", none.p?.gl === false && !!none.cv?.drawn && none.host.kids.length === 1);
const broken = card({ compiles: false });
const b = ball({ planetHue: "96", planetSurface: "glass" }, broken);
check("2. a shader the card will not compile: drawn by the page, on a fresh canvas (one that asked for WebGL cannot draw 2D)",
  b.p?.gl === false && b.host.kids.length === 1 && b.cv.asked.join(",") === "2d" && !!b.cv.drawn, `asked ${b.cv?.asked.join(",")}`);
const plainCard = card();
const plain = ball({ planetHue: "96" }, plainCard);
check("2. a ball with no surface (the drawn orb) never asks for WebGL", plain.p?.gl === false && plain.cv.asked.join(",") === "2d" && plainCard.k.sources.length === 0);
const cube = ball({ planetShape: "cube", planetSurface: "glass" }, card());
check("2. a cube is drawn face by face as before, surface or not", cube.p?.gl === false && cube.cv.asked.join(",") === "2d");

/* ------------------------------------------------------------------ 3 */
/** A 2D-drawn ball in a surface: its brightest point, how coloured that is, and how many points gleam white. */
function shine(surface) {
  const x = ball({ planetHue: "96", ...(surface ? { planetSurface: surface } : {}) }, null);
  const d = x.cv.drawn;
  let best = [0, 0, 0], lum = -1, white = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 250) continue;
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    if (l > lum) { lum = l; best = [d[i], d[i + 1], d[i + 2]]; }
    if (Math.min(d[i], d[i + 1], d[i + 2]) > 230) white++;
  }
  return { lum, best, white, colour: Math.max(...best) - Math.min(...best) };
}
const sGlass = shine("glass"), sMatte = shine("matte"), sMetal = shine("metal"), sPlain = shine(null);
check("3. drawn by the page, glass gleams white, and matte and the plain ball do not",
  sGlass.white > 20 && sGlass.colour < 30 && sMatte.white === 0 && sPlain.white === 0, `white points: glass ${sGlass.white}, matte ${sMatte.white}, plain ${sPlain.white}`);
check("3. matte is the dullest of the three surfaces", sMatte.lum < sMetal.lum && sMetal.lum < sGlass.lum, `brightest: matte ${sMatte.lum.toFixed(0)}, metal ${sMetal.lum.toFixed(0)}, glass ${sGlass.lum.toFixed(0)}`);
const KEY = (() => { const s = 0.95, l = 0.58, h = 96, k = (q) => (q + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (q) => l - a * Math.max(-1, Math.min(k(q) - 3, 9 - k(q), 1)); return [f(0), f(8), f(4)]; })();
const keyChannel = KEY.indexOf(Math.max(...KEY));
check("3. metal's highlight takes the key light's colour", sMetal.colour > 60 && sMetal.best.indexOf(Math.max(...sMetal.best)) === keyChannel, sMetal.best.join(","));

/* ------------------------------------------------------------------ 4 */
const nodes = [{ id: "n_orb", featureId: "orb-webgl", options: { surface: "glass" } }];
const page = W.pageFeatures(nodes);
check("4. a published page with the turnable orb binds it to the planet feature and loads its script",
  page.bindings.some((x) => x.part === "n_orb" && x.feature === "planet") && page.scripts.includes("planet.js"), page.scripts.join(", "));
const shipped = W.featureFiles(nodes).find((f) => f.path === "assets/features/planet.js")?.content ?? "";
check("4. …and that script reads the surface and draws it on the graphics card", /planetSurface/.test(shipped) && /gl_FragColor/.test(shipped) && shipped.includes(P.PLANET_JS));
check("4. the export keeps the ball's data-planet-* settings, surface among them", /if \(a\.name\.startsWith\("data-planet"\)\) continue;/.test(read("src/features/studio/send-out/exportSite.ts")));
const kitFile = read("kit/starter/vendor/builder-motion.js");
check("4. the kit's vendor/builder-motion.js carries the same ball, and is current", kitFile === K.kitMotionJs() && kitFile.includes(P.PLANET_JS));

/* ------------------------------------------------------------------ 5 */
check("5. the exact motion value: the turnable orb names its surface, glass unless picked",
  typeof A.partMotion === "function" && A.partMotion("orb-webgl", {}) === "planet?surface=glass" && A.partMotion("orb-webgl", { surface: "matte" }) === "planet?surface=matte" && A.partMotion("orb-css", {}) === "planet" && A.partMotion("shape-cube", {}) === "planet?shape=cube" && A.partMotion("before-after", {}) === "compare" && A.partMotion("box", {}) === null);
const pages = [{ id: "p_home", name: "Home", path: "/" }];
const made = [
  { id: "n_hero", pageId: "p_home", label: "Hero", source: { hook: { value: "hero", attr: "data-hook" } }, x: 0, y: 0, w: 1440, h: 600 },
  { id: "n_glass", pageId: "p_home", featureId: "orb-webgl", label: "Orb", options: { surface: "glass" }, content: "", x: 100, y: 700, w: 560, h: 560 },
  { id: "n_metal", pageId: "p_home", featureId: "orb-webgl", label: "Metal orb", options: { surface: "metal" }, content: "", x: 700, y: 700, w: 560, h: 560 },
  { id: "n_drawn", pageId: "p_home", featureId: "orb-css", label: "Drawn orb", options: {}, content: "", x: 100, y: 1300, w: 560, h: 560 },
];
const coded = new Set(["p_home"]);
const name = (id) => ({ "orb-webgl": "Orb, turnable", "orb-css": "Orb, drawn" })[id] ?? null;
const fresh = A.freshHooks(made, coded, ["hero"], { part: name, pages });
const asks = A.codeAsks({ nodes: made, pages, format: {}, switches: [], coded, fresh, part: name, kit: true, effect: () => null, lookCss: () => [] });
/* A part's line is keyed by what it asks now (`build-part-<id>~<print>`, `codeAsks.ts`). */
const lineOf = (id) => asks.find((i) => i.key.split("~")[0] === `build-part-${id}`)?.says ?? "";
check("5. the NEXT.md line for a glass orb gives planet?surface=glass, in the page's own stylesheet",
  lineOf("n_glass").includes('`--builder-motion: "planet?surface=glass"`') && lineOf("n_glass").includes(A.OWN_CSS), lineOf("n_glass").slice(0, 160));
check("5. …a metal one, planet?surface=metal", lineOf("n_metal").includes('`--builder-motion: "planet?surface=metal"`'));
check("5. …and the drawn orb keeps plain planet", lineOf("n_drawn").includes('`--builder-motion: "planet"`'));

/* ------------------------------------------------------------------ 6 */
const notStill = Object.keys(W.PART_SCRIPT).filter((k) => !["draws", "runs"].includes(SP.publishOf(k).kind));
check("6. every part the published page draws with its own script says so, the turnable orb among them", notStill.length === 0 && SP.publishOf("orb-webgl").kind === "draws", notStill.join(", "));
check("6. the turnable orb's card says it works when published", SF.statusOf("orb-webgl") === "works", SF.statusOf("orb-webgl"));
const def = C.FEATURES.find((x) => x.id === "orb-webgl");
check("6. its words promise what the page does: a surface, the graphics card, no refraction", !!def && /glass, metal or matte/.test(def.blurb) && /graphics card/.test(def.explain ?? "") && !/refract/i.test(`${def.blurb} ${def.explain}`));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
