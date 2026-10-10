#!/usr/bin/env node
/**
 * A PANEL WITH AN EFFECT CARRIES WHAT IS ON IT, IN THE PREVIEW.
 *
 * J (2026-10-10, polio/shelf-items-audit.md fix 2): an effect given to a
 * panel moved only the panel's own box in the Preview; its words and
 * buttons stood still, because the Preview draws every part on its own.
 * Now a panel with an effect draws the parts it holds inside its box, as
 * the published page does, and the whole-site Tilt leans a whole card, not
 * the one word under the pointer. Run on the saved PST board (no browser):
 *
 *   node tests/panel-carries.mjs
 *
 * Covers: src/features/studio/live/carry.ts, src/features/studio/live/LiveSite.tsx, src/features/studio/live/LiveShell.tsx
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
const C = await jiti.import(join(here, "..", "src", "features", "studio", "live", "carry.ts"));
const { LiveSite } = await jiti.import(join(here, "..", "src", "features", "studio", "live", "LiveSite.tsx"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const saved = JSON.parse(gunzipSync(readFileSync(join(here, "fixtures", "boards", "pst.json.gz"))).toString("utf8"));
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs.find((r) => r.key === "builder.studio").value).state;
const home = doc.pages[0].id;
const page = doc.nodes.filter((n) => n.pageId === home);
const panel = page.find((n) => n.source?.hook?.value === "wallet-panel");
const inside = (o, i) => o.id !== i.id && i.x >= o.x - 1 && i.y >= o.y - 1 && i.x + i.w <= o.x + o.w + 1 && i.y + i.h <= o.y + o.h + 1;
const onIt = page.filter((n) => page.indexOf(n) > page.indexOf(panel) && inside(panel, n) && !n.state);
check("The saved board has the wallet panel with parts on it", !!panel && onIt.length > 0, `${onIt.length} parts`);

/* The map, on its own. */
const box = (n, moves) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, moves, still: !!n.state });
const lifted = (n) => (n.id === panel.id ? { ...n, work: { id: "hover-lift", inputs: {} } } : n);
check("Without an effect, nothing is carried", C.carriers(page.map((n) => box(n, C.movesWhole(n.work)))).size === 0 || ![...C.carriers(page.map((n) => box(n, C.movesWhole(n.work)))).values()].includes(panel.id));
const by = C.carriers(page.map(lifted).map((n) => box(n, C.movesWhole(n.work))));
check("Lift on hover on the panel: every part on it is carried by it, or by a panel inside it", onIt.every((n) => { let at = by.get(n.id); while (at && at !== panel.id) at = by.get(at); return at === panel.id; }));
check("An effect switched off carries nothing", !C.movesWhole({ id: "hover-lift", inputs: {}, off: true }) && !C.movesWhole({ id: "copy-toast", inputs: {} }));
check("A part hidden until a press is not carried", page.filter((n) => n.state).every((n) => !by.has(n.id)));

/* Drawn: the parts on the panel are inside its box. */
const draw = (nodes) => renderToStaticMarkup(React.createElement(LiveSite, { pages: doc.pages, nodes, pageId: home, device: "desktop", frameWidth: 1280, format: doc.format ?? {}, look: doc.look }));
const within = (html, id) => {
  const at = html.indexOf(`data-live-node="${id}"`);
  if (at < 0) return null;
  const open = html.lastIndexOf("<div", at);
  const tag = /<\/?div\b/g;
  tag.lastIndex = open + 1;
  let depth = 1, m;
  while (depth && (m = tag.exec(html))) depth += m[0] === "<div" ? 1 : -1;
  return html.slice(open, m ? m.index : html.length);
};
const flat = within(draw(page), panel.id) ?? "";
check("Drawn without an effect, the panel holds none of its parts", onIt.every((n) => !flat.includes(`data-live-node="${n.id}"`)));
const html = draw(page.map(lifted));
const carriedHtml = within(html, panel.id) ?? "";
check("Drawn with a lift, the panel's box holds every part on it", onIt.every((n) => carriedHtml.includes(`data-live-node="${n.id}"`)));
const drawnTimes = (h, id) => h.split(`data-live-node="${id}"`).length - h.split(`[data-live-node="${id}"]`).length;
check("…each drawn once", onIt.every((n) => drawnTimes(html, n.id) === 1), onIt.map((n) => drawnTimes(html, n.id)).join());
const first = onIt[0];
const m = new RegExp(`data-live-node="${first.id}"[^>]*style="[^"]*left:([-\\d.]+)px;top:([-\\d.]+)px`).exec(html);
check("…placed against the panel's corner", !!m && Math.abs(Number(m[1]) - (first.x - panel.x)) < 2 && Math.abs(Number(m[2]) - (first.y - panel.y)) < 2, m ? `${m[1]},${m[2]}` : "no style");

/* The whole-site Tilt: the card, not the word. */
const r = (left, top, width, height) => ({ left, top, width, height });
const boxes = [
  { el: "band", r: r(0, 0, 1000, 600) },
  { el: "card", r: r(100, 100, 300, 200) },
  { el: "title", r: r(120, 120, 100, 20) },
  { el: "button", r: r(120, 240, 80, 30) },
  { el: "other", r: r(500, 100, 100, 100) },
];
const hit = C.leanSet(boxes, 130, 125, 900);
check("Tilt over a card's title leans the card", hit?.card.el === "card");
check("…with its title and button, and nothing else", JSON.stringify(hit?.set.map((b) => b.el).sort()) === JSON.stringify(["button", "card", "title"]));
check("Over a part on no card, that part leans alone", C.leanSet(boxes, 550, 150, 900)?.set.map((b) => b.el).join() === "other");
check("A full-width band never leans", C.leanSet(boxes, 50, 500, 900)?.card.el === "band" && C.leanSet(boxes, 50, 500, 900).set.length === 1);

const passed = results.filter(Boolean).length;
console.log(`\n${passed} of ${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
