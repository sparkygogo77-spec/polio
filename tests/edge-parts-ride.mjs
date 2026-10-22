#!/usr/bin/env node
/**
 * A PART ON A PANEL'S EDGE MOVES WITH THE PANEL.
 *
 * J (2026-10-10): "the badge is not connected which i would like it to be to
 * the panel ... even if the badge isnt entirely on the panel it should still
 * be considered one part", and "the antennas didnt move with the tv which
 * they should be considered attached ... if its touching", without a button
 * on the TV dragging the whole TV, and without the red bar going with the TV.
 * Run on the saved PST board (no browser):
 *
 *   node tests/edge-parts-ride.mjs
 *
 * Covers: src/features/studio/live/carry.ts, src/features/studio/live/LiveSite.tsx, src/features/studio/motionShow.ts, src/features/studio/send-out/styleLayer.ts, src/features/studio/send-out/kitMotion.ts, src/features/studio/shelf/library/behaviourScripts/motion.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
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
const C = await jiti.import(join(here, "..", "src", "features", "studio", "live", "carry.ts"));
const { LiveSite } = await jiti.import(join(here, "..", "src", "features", "studio", "live", "LiveSite.tsx"));
const S = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "styleLayer.ts"));
const K = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "kitMotion.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const saved = JSON.parse(gunzipSync(readFileSync(join(here, "fixtures", "boards", "pst.json.gz"))).toString("utf8"));
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs.find((r) => r.key === "builder.studio").value).state;
const home = doc.pages[0].id;
const page = doc.nodes.filter((n) => n.pageId === home);
const hook = (h) => page.find((n) => n.source?.hook?.value === h);
const id = (h) => hook(h)?.id;
const box = (n, moves = false) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, path: n.from?.selector, moves, still: !!n.state });

/* 1. What is attached to what, standing still. */
const att = C.attachments(page.filter((n) => !n.state).map((n) => box(n)));
check("The WALLET badge, on the panel's top edge, belongs to the wallet panel", att.get(id("wallet-title"))?.includes(id("wallet-panel")), JSON.stringify(att.get(id("wallet-title"))));
check("…and the BALANCE badge to the balance panel", att.get(id("balance-title"))?.includes(id("balance-panel")));
const antennas = ["chart-tv-antenna-left", "chart-tv-antenna-right", "chart-tv-antenna-left-ball", "chart-tv-antenna-right-ball"];
check("The antennas and their balls belong to the TV's body, not its screen", antennas.every((h) => att.get(id(h))?.join() === id("chart-tv-body")), antennas.map((h) => att.get(id(h))?.length).join());
check("The red bar over the TV belongs to nothing", !att.has(id("next-step")));
check("A button on the TV is inside it, never attached to it", !att.has(id("chart-tv-watch-button")) && !att.has(id("chart-tv-knob-channel")));

/* Moved down onto the antennas' balls (as on J's board), the red bar still does not take them. */
const bar = hook("next-step");
const lowered = page.map((n) => (n === bar ? { ...n, y: n.y + 40 } : n));
const touchingBall = (() => { const b = hook("chart-tv-antenna-left-ball"); const r = { ...bar, y: bar.y + 40 }; return r.y + r.h >= b.y; })();
const att2 = C.attachments(lowered.filter((n) => !n.state).map((n) => box(n)));
check("The red bar lowered onto the balls: they still belong to the TV", touchingBall && att2.get(id("chart-tv-antenna-left-ball"))?.join() === id("chart-tv-body"), JSON.stringify(att2.get(id("chart-tv-antenna-left-ball"))));

/* 2. Carried: only when the body moves. */
const by = (moving) => C.carriers(page.map((n) => box(n, moving.includes(n.source?.hook?.value))));
const lift = by(["wallet-panel"]);
check("Lift on the wallet panel carries its badge", lift.get(id("wallet-title")) === id("wallet-panel"));
check("…and the badge's icon and words ride inside the badge", lift.get(id("wallet-title-text")) === id("wallet-title") && lift.get(id("wallet-title-icon")) === id("wallet-title"));
const tv = by(["chart-tv-body"]);
check("Lift on the TV's body carries its antennas and feet", [...antennas, "chart-tv-feet"].every((h) => { let at = tv.get(id(h)); while (at && at !== id("chart-tv-body")) at = tv.get(at); return at === id("chart-tv-body"); }));
check("…and not the red bar", !tv.has(id("next-step")));
const red = by(["next-step"]);
check("Lift on the red bar carries no antenna", antennas.every((h) => !red.has(id(h))));
const btn = by(["chart-tv-knob-channel"]);
check("An effect on a knob carries no TV", !btn.has(id("chart-tv-body")) && !btn.has(id("chart-tv")) && btn.size <= 2, `${btn.size} carried`);
check("Nothing moving, nothing carried", by([]).size === 0);

/* 3. The Preview draws them inside the body; one drawn behind it stays behind. */
const give = (hooks, work) => page.map((n) => (hooks.includes(n.source?.hook?.value) ? { ...n, work } : n));
const draw = (nodes) => renderToStaticMarkup(React.createElement(LiveSite, { pages: doc.pages, nodes, pageId: home, device: "desktop", frameWidth: 1280, format: doc.format ?? {}, look: doc.look }));
const within = (html, nid) => {
  const at = html.indexOf(`data-live-node="${nid}"`);
  if (at < 0) return "";
  const open = html.lastIndexOf("<div", at);
  const tag = /<\/?div\b/g;
  tag.lastIndex = open + 1;
  let depth = 1, m;
  while (depth && (m = tag.exec(html))) depth += m[0] === "<div" ? 1 : -1;
  return html.slice(open, m ? m.index : html.length);
};
const html = draw(give(["wallet-panel", "chart-tv-body"], { id: "hover-lift", inputs: {}, also: [{ id: "tilt", inputs: {} }] }));
check("Preview: the wallet panel's box holds its badge", within(html, id("wallet-panel")).includes(`data-live-node="${id("wallet-title")}"`));
const badge = new RegExp(`data-live-node="${id("wallet-title")}"[^>]*style="[^"]*left:([-\\d.]+)px;top:([-\\d.]+)px`).exec(html);
check("…placed against the panel's corner, still over its top edge", !!badge && Number(badge[2]) < 0 && Math.abs(Number(badge[2]) - (hook("wallet-title").y - hook("wallet-panel").y)) < 2, badge ? `${badge[1]},${badge[2]}` : "none");
const body = within(html, id("chart-tv-body"));
check("Preview: the TV's body holds its antennas", antennas.every((h) => body.includes(`data-live-node="${id(h)}"`)));
const stick = new RegExp(`data-live-node="${id("chart-tv-antenna-left")}"[^>]*style="[^"]*z-index:-1`).test(html);
check("…drawn behind the body, as on the page", stick && /isolation:isolate/.test(body.slice(0, body.indexOf(">"))));
check("…and the red bar is not in it", !body.includes(`data-live-node="${id("next-step")}"`));

/* 4. Publish: what the code keeps outside the body moves by the body's hover, and its tilt leans it. */
const source = doc.look.styleSource;
const palette = { ...(doc.look.palette ?? {}), accent: "#e8ff6a" };
const layer = (nodes) => S.buildLayer(nodes.concat(doc.nodes.filter((n) => n.pageId !== home)), palette, source, { kit: true });
const L = layer(give(["chart-tv-body"], { id: "hover-lift", inputs: {}, also: [{ id: "tilt", inputs: {} }] }));
const ruleOf = (sel) => L.rules.find((r) => r.selector === sel);
/* PST draws both antennas in one box beside the TV's body (`chart-tv-antenna`), and the feet under it. */
const rides = ruleOf(':root:has([data-hook="chart-tv-body"]:hover) [data-hook="chart-tv-antenna"]');
check("Publish: the body's hover lifts the antennas beside it, and the feet", !!rides && rides.declarations.some((d) => d.startsWith("translate:")) && !!ruleOf(':root:has([data-hook="chart-tv-body"]:hover) [data-hook="chart-tv-feet"]'), JSON.stringify(rides));
check("…once: each stick and ball rides inside that box", !L.rules.some((r) => /chart-tv-antenna-(left|right)/.test(r.selector)));
check("…easing as the body does", /transition: translate 200ms/.test(ruleOf('[data-hook="chart-tv-antenna"]')?.declarations.join() ?? ""));
const tiltWord = ruleOf('[data-hook="chart-tv-body"]')?.declarations.find((d) => d.startsWith("--builder-motion:")) ?? "";
check("…and its Tilt names the antennas to lean with it", /tilt\?parts=chart-tv-antenna,chart-tv-feet"/.test(decodeURIComponent(tiltWord)), tiltWord);
const W = layer(give(["wallet-panel"], { id: "hover-lift", inputs: {} }));
check("The badge is inside its panel in PST's code: no rule of its own", !W.rules.some((r) => r.selector.includes(":has(") && r.selector.includes('"wallet-title"]')));
check("A tilt with nothing riding names nothing", K.motionValue({ id: "tilt", inputs: {} }) === '"tilt"');

/* 5. The kit file finds a published part by its hook. */
const file = readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8");
check("vendor/builder-motion.js is current, and finds carried parts by hook", file === K.kitMotionJs() && file.includes(`querySelector('[data-hook="' + id`));

const passed = results.filter(Boolean).length;
console.log(`\n${passed} of ${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
