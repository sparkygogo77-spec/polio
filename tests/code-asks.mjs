#!/usr/bin/env node
/**
 * WHAT J SETS ON THE BOARD REACHES THE CODE: AS CSS WHERE CSS CAN CARRY IT,
 * AS A polio/NEXT.md LINE WHERE IT CANNOT.
 *
 * J (2026-10-10, "go ahead" on polio/next-issues.md): on PonsStars a part's
 * Shape, a movement switched off in the Motion tab and a builder texture
 * (Dots, Stripes…) showed on the board but Publish sent nothing for them; an
 * effect from the shelf, a Format whole-site switch and a page added in Pages
 * went nowhere at all. Run on the saved PST board's document (no browser):
 *
 *   node tests/code-asks.mjs
 *
 * Covers: src/features/studio/send-out/styleLayer.ts, src/features/studio/look/lookparts/textureCss.ts, src/features/studio/codeAsks.ts, src/features/studio/fixLoop.ts, src/features/studio/CodeSiteButtons.tsx
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const S = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "styleLayer.ts"));
const T = await jiti.import(join(here, "..", "src", "features", "studio", "look", "lookparts", "textureCss.ts"));
const A = await jiti.import(join(here, "..", "src", "features", "studio", "codeAsks.ts"));
const F = await jiti.import(join(here, "..", "src", "features", "studio", "fixLoop.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* The saved PST board's document, as the Builder holds it. */
const saved = JSON.parse(gunzipSync(readFileSync(join(here, "fixtures", "boards", "pst.json.gz"))).toString("utf8"));
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs.find((r) => r.key === "builder.studio").value).state;
const source = doc.look.styleSource;
const nodes = doc.nodes;
const palette = { bg: "#f4efe2", surface: "#ffffff", text: "#141414", muted: "#666666", accent: "#e8ff6a", highlight: "#ff3b6b", ...(doc.look.palette ?? {}) };
const layerOf = (list, layers = []) => S.buildLayer(S.wearTextures(list, layers, (l, o) => T.wornPaint(l, palette, o)), doc.look.palette, source);
const ruleFor = (layer, id) => layer.rules.find((r) => r.nodeId === id && !r.selector.includes(":") && !r.selector.includes("[data-state"));

const before = layerOf(nodes);
check("the board as saved still writes the same layer (nothing new from parts no one changed)", before.css === S.buildLayer(nodes, doc.look.palette, source).css, `${before.rules.length} rules`);

const hooked = nodes.filter((n) => n.source?.hook && n.source?.was && !n.source.svg && !n.source.pseudo);
const swap = (id, patch) => nodes.map((n) => (n.id === id ? { ...n, ...patch } : n));

/* 1. Shape. */
const box = hooked.find((n) => n.w > 40 && n.h > 20 && !ruleFor(before, n.id));
const circle = ruleFor(layerOf(swap(box.id, { shape: "circle" })), box.id);
check("Shape circle on a PST part is sent as border-radius: 50%", !!circle?.declarations.includes("border-radius: 50%"), `${box.source.hook.value}: ${circle?.declarations.join("; ")}`);
const rounded = ruleFor(layerOf(swap(box.id, { shape: "rounded" })), box.id);
const want = Math.round(Math.min(28, Math.min(box.w, box.h) / 6) * 100) / 100;
check("Shape rounded is cut as the board cuts it", !!rounded?.declarations.includes(`border-radius: ${want}px`), rounded?.declarations.join("; "));

/* 2. A movement switched off in the Motion tab. */
const mover = hooked.find((n) => n.motion?.animation?.length && !ruleFor(before, n.id));
if (mover) {
  const off = ruleFor(layerOf(swap(mover.id, { motion: { ...mover.motion, off: true } })), mover.id);
  check("A PST animation switched off is sent as animation: none", !!off?.declarations.includes("animation: none"), `${mover.source.hook.value}: ${off?.declarations.join("; ")}`);
  const on = ruleFor(layerOf(swap(mover.id, { motion: { ...mover.motion } })), mover.id);
  check("…and left on, nothing is written for it", !on, on?.declarations.join("; "));
} else check("PST has a hooked part that animates", false);

/* 3. A builder texture: a kind's (on its parts) and the page's (laid against the window). */
const stripes = { id: "tex-test-stripes", kind: "stripes", role: "accent", colour: "#ff3b6b", scale: 24, angle: 45, opacity: 0.4, contrast: 0.5, blend: "normal", target: "surfaces", on: false, drift: 0 };
const panel = hooked.find((n) => n.colour?.bg && !/transparent/.test(n.colour.bg) && !ruleFor(before, n.id));
const worn = ruleFor(layerOf(swap(panel.id, { texture: stripes.id }), [stripes]), panel.id);
const img = worn?.declarations.find((d) => d.startsWith("background-image:")) ?? "";
check("Stripes given to a kind reach its PST part as a background picture", /repeating-linear-gradient/.test(img), `${panel.source.hook.value}: ${img.slice(0, 90)}`);
check("…over its own fill, which stays", !worn?.declarations.some((d) => d.startsWith("background-color:")));
const dots = { ...stripes, id: "tex-test-dots", kind: "dots", target: "page", on: true, drift: 1 };
const pageWorn = ruleFor(layerOf(swap(panel.id, { texture: dots.id }), [dots]), panel.id);
check("The page's texture holds still against the window (the part's own pictures still scroll), so the bands line up", !!pageWorn?.declarations.some((d) => /^background-attachment: fixed(, scroll)*$/.test(d)), pageWorn?.declarations.filter((d) => d.startsWith("background-attachment")).join("; "));
const drifted = layerOf(swap(panel.id, { texture: dots.id }), [dots]);
check("A drifting texture writes the keyframes it names", /@keyframes tex-drift-/.test(drifted.css) && /animation: [^;]*tex-drift-/.test(drifted.css));
const bare = hooked.find((n) => !n.colour?.bg && !n.art?.background && !ruleFor(before, n.id));
if (bare) check("A see-through part wears no second copy of the page's texture", !ruleFor(layerOf(swap(bare.id, { texture: dots.id }), [dots]), bare.id));

/* 4. What CSS cannot carry: a line each for NEXT.md. */
const pages = doc.pages;
const coded = new Set(source.files.map((f) => f.pageId));
const base = { nodes, pages, format: {}, switches: [{ key: "build.darkLight", label: "Dark and light versions", on: true, off: false }], coded, effect: (id) => (id === "tilt-hover" ? { name: "Tilt on hover", blurb: "Tilts toward the pointer." } : null) };
check("The saved PST board, untouched, asks the code for nothing", A.codeAsks(base).length === 0, A.codeAsks(base).map((i) => i.says).join(" | "));
const tilted = nodes.map((n) => (n.id === box.id ? { ...n, work: { id: "tilt-hover", inputs: { strength: "8" } } } : n));
const asks = A.codeAsks({ ...base, nodes: tilted, format: { "build.darkLight": true }, pages: [...pages.map((p, i) => (i === 0 ? { ...p, scroll: "snap to sections" } : p)), { id: "page_new", name: "Leaderboard", path: "/leaderboard", scroll: "inherit" }] });
const effect = asks.find((i) => i.key.startsWith("build-effect-"));
check("An effect on a PST part asks the code to build it on that hook", effect?.hook === box.source.hook.value && /Tilt on hover/.test(effect.says), effect?.says);
check("A Format switch turned on asks for it on every page", asks.some((i) => i.key === "build-format-build.darkLight~on" && i.page === "every page"));
check("A page added in the Builder asks for its page", asks.some((i) => i.key.startsWith("build-page-page_new~") && /\/leaderboard/.test(i.says)));
check("A page's scroll set in Pages asks for it", asks.some((i) => i.key.startsWith("build-scroll-") && /snap to sections/.test(i.says)));
const md = F.nextMd(asks, { site: "PonsStars", when: "2026-10-10" });
check("Each goes into NEXT.md as a line the Refresh can read back", asks.every((i) => md.includes(`<!-- fix:${i.key} -->`)) && F.fixedIn(asks, md).length === 0);
const loop = { ticked: [], sent: [asks[0]], done: [asks[1].key] };
const again = F.asksToSend(loop, asks);
check("One already sent or built is not asked again", !again.some((i) => i.key === asks[0].key || i.key === asks[1].key) && again.length === asks.length - 2);
const offEffect = A.codeAsks({ ...base, nodes: nodes.map((n) => (n.id === box.id ? { ...n, work: { id: "tilt-hover", inputs: {}, off: true } } : n)) });
check("An effect switched off asks for nothing", offEffect.length === 0);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
