#!/usr/bin/env node
/**
 * WHAT THE BOARD HOLDS GOES OUT BY EVERY DOOR, AND A PLAIN LOOK DRESSES A DRAWN SHAPE.
 *
 * J (2026-10-10): a star drawn as a PST button, linked, with a note and a
 * tilt, sent nothing from "Send the design back" (only Publish wrote
 * polio/NEXT.md and gave new parts a data-hook); Copy look from a button
 * onto the star left the star as it was; a real mouse's double press on a
 * point in the outline editor did nothing.
 *
 *   1. Publish and Send the design back take their asks from one place
 *      (`publishAsks.ts#gatherAsks`): a part made in the Builder gets its
 *      hook and its NEXT.md line whichever button sent it.
 *   2. `lookPatch`: the fill of a plain part becomes a drawn shape's picked
 *      fill, and its hover and press become the shape's own switches; a
 *      token colour leaves the kit's fill alone.
 *   3. The point editor captures the pointer on the point itself.
 *
 *   node tests/send-back-asks.mjs
 *
 * Covers: src/features/studio/publishAsks.ts, src/features/studio/StyleLayerPanel.tsx, src/features/studio/CodeSiteButtons.tsx, src/features/studio/look/partLook.ts, src/features/studio/DrawKits.tsx
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const src = (...p) => readFileSync(join(here, "..", "src", "features", "studio", ...p), "utf8");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const P = await jiti.import(join(here, "..", "src", "features", "studio", "look", "partLook.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* 1. One door for the asks. */
const panel = src("StyleLayerPanel.tsx"), buttons = src("CodeSiteButtons.tsx"), asks = src("publishAsks.ts");
check("Send the design back gathers the asks before sending", /gatherAsks\(/.test(panel) && /extra: asks\.extra, fresh: asks\.fresh/.test(panel));
check("…and records what it sent in the fix loop as pending, since its pull request is not merged (tests/send-back-pending.mjs)", /setFixLoop\(sentUnmerged\(fixLoopOf\(useStudio\.getState\(\)\.look\), asks\.adding\)\)/.test(panel));
check("Publish takes its asks from the same place", /gatherAsks\(/.test(buttons) && !/function freshNow|function asksNow/.test(buttons));
check("the shared gatherer writes polio/NEXT.md and stamps each new part's hook", /NEXT_PATH/.test(asks) && /"data-hook": hook/.test(asks) && /freshHooks\(/.test(asks));

/* 2. A plain look on a drawn shape. */
const kit = { id: "k", name: "kit", site: "s", host: null, role: "button", fill: { kind: "solid", colour: "rgb(10, 20, 30)" }, swatches: [], border: null, shadows: [], bar: null, radius: 8 };
const star = { id: "star", worn: { pts: [[0, 0], [1, 0], [0.5, 1]], smooth: false, snap: null, raw: null, kit, fill: null, bar: null, motion: null, hover: false, press: false, what: "button" } };
const button = { id: "b", colour: { bg: "#ff3b6b", fg: "#fff" }, motion: { hover: { transform: "translateY(-2px)" }, active: { transform: "scale(0.98)" } } };
const look = P.lookOf(button);
check("a plain part's look has no worn record of its own", Object.values(look.facets).every((f) => !f.worn));
const patch = P.lookPatch(star, look, ["fill", "hover"]);
check("its fill becomes the drawn shape's picked fill", patch.worn?.fill === "#ff3b6b", JSON.stringify(patch.worn));
check("…with its outline kept", JSON.stringify(patch.worn?.pts) === JSON.stringify(star.worn.pts) && patch.worn?.kit?.id === "k");
check("its hover and press become the shape's own switches", patch.worn?.hover === true && patch.worn?.press === true);
const plain = P.lookPatch(star, P.lookOf({ id: "c", colour: { bg: "#00aa88" } }), ["fill", "hover"]);
check("a look with no hover switches them off", plain.worn?.hover === false && plain.worn?.press === false && plain.worn?.fill === "#00aa88");
const token = P.lookPatch(star, P.lookOf({ id: "t", colour: { bg: "var(--accent)" } }), ["fill"]);
check("a token colour leaves the kit's own fill", token.worn?.fill === null || token.worn?.fill === undefined, JSON.stringify(token.worn));
const box = P.lookPatch({ id: "box", colour: { bg: "#000" } }, look, ["fill", "hover"]);
check("a plain target takes no worn record", !("worn" in box));
const drawn = P.lookPatch(star, P.lookOf({ id: "d", worn: { ...star.worn, fill: "#123456", hover: true, press: false } }), ["fill", "hover"]);
check("a drawn shape's look still dresses a drawn shape as before", drawn.worn?.fill === "#123456" && drawn.worn?.hover === true && drawn.worn?.press === false);

/* 3. The point editor. */
const kits = src("DrawKits.tsx");
check("the outline editor captures the pointer on the point, not the svg", /e\.currentTarget\.setPointerCapture\(e\.pointerId\)/.test(kits) && !/ownerSVGElement as SVGSVGElement\)\.setPointerCapture/.test(kits));
check("…and a second press on the same point takes it away", /last\.current\.i === i && now - last\.current\.at < 450/.test(kits));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} ok`);
process.exit(failed ? 1 : 0);
