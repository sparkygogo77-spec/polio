#!/usr/bin/env node
/**
 * THE APP'S OWN /site PAGE DRAWS NO BUILDER NOTES.
 *
 * Audit 2026-10-11 (site-draws-builder-notes): `/site` (PublishedPage, "what
 * publishing would show everyone else") drew what only the Builder should:
 * a dashed "in the layout, and nothing has been built for it yet" box for a
 * section of the brief with no part in it, and "— not written yet —" in a
 * text part with no words. PreviewPage knew it was the published page but
 * only hid its bar; it never told LiveSite. Now it passes `visitor`, which
 * drops the notes and stand-ins as `published` does and keeps the features
 * and the shell running. Rendered on a small hand-made page (no browser):
 *   · without `visitor` (the Preview): the note and the stand-in are drawn;
 *   · with `visitor` (/site): neither;
 *   · PreviewPage passes `visitor` from its `published`.
 *
 *   node tests/site-no-builder-notes.mjs
 *
 * Covers: src/features/studio/live/LiveSite.tsx, src/features/studio/live/PreviewPage.tsx
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
const { LiveSite } = await jiti.import(join(here, "..", "src", "features", "studio", "live", "LiveSite.tsx"));
const { NOT_WRITTEN } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "sample.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const home = "page_home";
const pages = [{ id: home, name: "Home", path: "/", prompt: "", scroll: "inherit" }];
/* A text part with no words, near the top. */
const nodes = [{
  id: "n_text", pageId: home, featureId: "prose", label: "Text", prompt: "", content: "",
  x: 40, y: 40, w: 600, h: 120, groupId: null, options: {}, priority: "should", custom: false,
  glyph: null, hue: null, locked: false, link: null, data: "", colour: null,
}];
/* A section of the brief's layout, lower down, that nothing on the board stands in. */
const shapes = [{ id: "s_pricing", pageId: home, kind: "frame", points: [[40, 400], [900, 600]], hue: 200, width: 2, label: "Pricing", prompt: "three plans side by side" }];

const draw = (extra) => renderToStaticMarkup(React.createElement(LiveSite, { pages, nodes, pageId: home, device: "desktop", frameWidth: 1280, format: {}, shapes, features: true, ...extra }));

const builder = draw({});
check("In the Preview, the unbuilt section is a note", builder.includes(`data-live-section="s_pricing"`) && builder.includes("nothing has been built for it yet"));
check("…and the text with no words says so", builder.includes(NOT_WRITTEN));

const site = draw({ visitor: true });
check("On /site, no unbuilt-section note", !site.includes("data-live-section") && !site.includes("nothing has been built for it yet"));
check("…and no \"not written yet\" stand-in", !site.includes(NOT_WRITTEN));
check("…but the part itself is still drawn", site.includes(`data-live-node="n_text"`));

const exported = draw({ published: true });
check("The exported page (published) stays clean as before", !exported.includes("data-live-section") && !exported.includes(NOT_WRITTEN));

/* PreviewPage, the one renderer of /site, hands its `published` on as `visitor`. */
const src = readFileSync(join(here, "..", "src", "features", "studio", "live", "PreviewPage.tsx"), "utf8");
check("PreviewPage passes visitor={published} to LiveSite", /<LiveSite\b[^>]*\bvisitor=\{published\}/s.test(src));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
