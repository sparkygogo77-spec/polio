#!/usr/bin/env node
/**
 * AN EFFECT FROM THE SHELF PLAYS WITH A PART'S OWN MOTION ON THE SITE, NOT IN ITS PLACE.
 *
 * Audit 2026-10-11 (dissect #40): a PonsStars picture with a living picture
 * or a drifting texture that also got Float, Spin, Blink, Switch on or
 * Reveal lost its living motion when J Published. The board and Preview
 * played both; the style layer wrote only the effect's animation, so the
 * picture stood still on the site. Lift on hover and Push on press likewise
 * replaced the part's own transition. Now the layer joins them
 * (`styleLayer.ts#withEffect`): the part's animations first, the effect's
 * after, timelines and ranges padded per entry, and the keyframes and the
 * reduced-motion rule written for both. Pure, no browser, no server:
 *
 *   node tests/effect-keeps-motion.mjs
 *
 * Covers: src/features/studio/send-out/styleLayer.ts, src/features/studio/send-out/motionCss.ts, src/features/studio/living.ts
 */
import { newLiving } from "../src/features/studio/living.ts";
import { buildLayer, lookOf, wearTextures } from "../src/features/studio/send-out/styleLayer.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* A PonsStars panel, as brought in, and the layer for a builder-ready repository and for one that is not. */
const panel = { id: "p1", pageId: "play", featureId: "box", x: 40, y: 80, w: 480, h: 260, content: "", hooks: { "data-hook": "match-panel" } };
const brought = (more = {}) => { const n = { ...panel, ...more }; return { ...n, source: { file: "play.html", hook: { attr: "data-hook", value: "match-panel" }, was: lookOf({ ...panel, motion: more.motion }) } }; };
const source = { repo: "x/PST", ref: "main", dir: "web", files: [{ file: "play.html", pageId: "play", hooks: [{ attr: "data-hook", value: "match-panel", line: 3, imported: true }], vars: [] }] };
const SEL = '[data-hook="match-panel"]';
const decl = (layer) => layer.rules.find((r) => r.selector === SEL)?.declarations ?? [];
const one = (d, prop) => d.filter((x) => x.startsWith(`${prop}:`));
const SRC = ["data:image/png;base64,FRONT", "data:image/png;base64,MID", "data:image/png;base64,BACK"];
const drift = { ...newLiving("drift"), layers: SRC };

for (const kit of [true, false]) {
  const k = kit ? "builder-ready" : "plain";
  /* 1. A drifting living picture with Float. */
  const floated = buildLayer([brought({ art: { live: drift }, work: { id: "float", inputs: {} } })], null, source, { kit });
  const fd = decl(floated);
  check(`${k}: Float plays after the living picture, in one animation`, one(fd, "animation").length === 1 && /^animation: polio-live-drift-3 .*, pb-float-y-12 /.test(one(fd, "animation")[0] ?? ""), fd.join("; ").slice(0, 300));
  check(`${k}: both keyframes are written, the living picture's once`, floated.css.split("@keyframes polio-live-drift-3 ").length === 2 && floated.css.includes("@keyframes pb-float-y-12 "));
  check(`${k}: and held still for a visitor who asks for less motion`, /prefers-reduced-motion: reduce\) \{\s*[^}]*\[data-hook="match-panel"\][^{]*\{ animation: none !important; \}/.test(floated.css));
  check(`${k}: a clock-driven pair writes no timeline or range`, !one(fd, "animation-timeline").length && !one(fd, "animation-range").length, fd.join("; ").slice(0, 300));

  /* 2. A breathing living picture with Reveal: its own clock, the reveal on the scroll. */
  const revealed = decl(buildLayer([brought({ art: { live: newLiving("breathe") }, work: { id: "reveal", inputs: {} } })], null, source, { kit }));
  const ra = one(revealed, "animation")[0] ?? "";
  check(`${k}: Reveal plays with the living picture`, ra.includes("polio-live-breathe") && ra.includes("pb-reveal-up-32"), ra);
  check(`${k}: each keeps its own timeline, after the shorthand`, one(revealed, "animation-timeline")[0] === "animation-timeline: auto, view()" && revealed.indexOf("animation-timeline: auto, view()") > revealed.indexOf(ra), revealed.join("; ").slice(0, 300));
  check(`${k}: and its own range`, one(revealed, "animation-range")[0] === "animation-range: normal, entry 0% entry 60%", one(revealed, "animation-range").join(" | "));

  /* 3. An animation the page already had (unchanged, so not otherwise written) keeps playing beside Spin. */
  const pulse = { animation: [{ name: "pst-pulse", duration: "2s", iterations: "infinite" }] };
  const spun = decl(buildLayer([brought({ motion: pulse, work: { id: "spin", inputs: {} } })], null, source, { kit }));
  check(`${k}: Spin plays after the page's own animation`, one(spun, "animation")[0] === "animation: pst-pulse 2s infinite, pb-spin-cw 20s linear infinite", one(spun, "animation").join(" | "));

  /* 4. A transition the page already had, with Lift on hover. */
  const tr = { transition: [{ property: "background-color", duration: "0.3s", timing: "ease" }] };
  const lifted = decl(buildLayer([brought({ motion: tr, work: { id: "hover-lift", inputs: {} } })], null, source, { kit }));
  check(`${k}: Lift on hover keeps the part's own transition, ahead of the lift's`, one(lifted, "transition")[0] === "transition: background-color 0.3s ease, translate 200ms ease, rotate 200ms ease, scale 200ms ease", one(lifted, "transition").join(" | "));
  /* And nothing to keep: the effect alone, as before. */
  const bare = decl(buildLayer([brought({ work: { id: "float", inputs: {} } })], null, source, { kit }));
  check(`${k}: a part with no motion of its own plays the effect alone`, one(bare, "animation")[0] === "animation: pb-float-y-12 6s ease-in-out infinite", bare.join("; "));
}

/* 5. A page part wearing a drifting texture, with Spin. */
const layer = { id: "t1", kind: "image", role: "accent", scale: 160, angle: 0, opacity: 1, contrast: 0.5, blend: "normal", target: "page", on: true, src: "data:image/png;base64,X", live: { ...newLiving("drift"), layers: SRC } };
const palette = { bg: "#fdf0dc", surface: "#ffffff", text: "#111111", muted: "#555555", accent: "#f0a040", highlight: "#a0ff5a" };
const top = (() => { const n = { id: "a", pageId: "play", featureId: "box", x: 0, y: 0, w: 1440, h: 400, content: "", hooks: { "data-hook": "page-top" } }; return { ...n, texture: "t1", work: { id: "spin", inputs: {} }, source: { file: "play.html", hook: { attr: "data-hook", value: "page-top" }, was: lookOf(n) } }; })();
const tsource = { repo: "x/PST", ref: "main", dir: "web", files: [{ file: "play.html", pageId: "play", hooks: [{ attr: "data-hook", value: "page-top", line: 3, imported: true }], vars: [] }] };
const worn = buildLayer(wearTextures([top], [layer]), palette, tsource, { kit: true });
const wa = (worn.rules.find((r) => r.selector === '[data-hook="page-top"]')?.declarations ?? []).find((d) => d.startsWith("animation:")) ?? "";
check("a drifting texture keeps drifting with Spin", /^animation: polio-live-drift-3 .*, pb-spin-cw 20s linear infinite$/.test(wa), wa);
check("…with its keyframes and Spin's written", worn.css.includes("@keyframes polio-live-drift-3 ") && worn.css.includes("@keyframes pb-spin-cw"));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
