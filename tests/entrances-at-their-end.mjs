#!/usr/bin/env node
/**
 * WHAT IS HIDDEN IS READ WITH ITS ENTRANCE FINISHED, NOT AT FRAME 0.
 *
 * PonsStars' redesign shows its sign, match, result and player panels by
 * state, each fading up from nothing 24 px low. Revealed for its read, a
 * panel's entrance started over, and every part in it came in see-through
 * and low: 254 parts on Play, 97 on Profile (J, 2026-10-11). Hidden
 * panels, the panels hidden inside them, template rows and lifted boxes
 * are read at the end of every entrance that ends; a look the page sets
 * itself (opacity .4) is kept, and nothing is left running.
 *
 *   node tests/entrances-at-their-end.mjs
 */
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { launch } from "./fixtures/look-sites.mjs";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
await page.setContent(`<!doctype html><html><head><style>
body{margin:0;font:16px Arial}
@keyframes in{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
.up{animation:in .4s both;padding:10px;background:#cde}
[data-hook=panel]{animation:in .4s backwards;padding:20px;background:#edc}
.closed [data-hook=panel]{display:none}
[data-hook=stamp]{display:none;animation:in .4s backwards;background:#fe9}
.on [data-hook=stamp]{display:block}
[data-hook=row]{animation:in .4s both;padding:6px;background:#dfd}
.dim{opacity:.4;padding:10px;background:#ccc}
</style></head><body>
<div class="up" data-hook="hello">Hello there</div>
<div class="closed" data-hook="shell">
  <section data-hook="panel"><p data-hook="panel-line">Sign in to play</p><div data-hook="stamp">Test networks only</div></section>
</div>
<ul data-hook="list"><template data-hook="template-row"><li data-hook="row">A row of the list</li></template></ul>
<div class="dim" data-hook="dim">Quiet words</div>
</body></html>`);
/* Where each box rests, entrance over: read with every animation switched off and the panel shown. */
const rest = await page.evaluate(() => {
  const st = document.createElement("style");
  st.textContent = "*{animation:none!important} .closed [data-hook=panel]{display:block!important}";
  document.head.appendChild(st);
  const y = (h) => Math.round(document.querySelector(`[data-hook="${h}"]`).getBoundingClientRect().top + scrollY);
  const out = { hello: y("hello"), panel: y("panel") };
  st.remove();
  return out;
});
const read = await page.evaluate(PARTS, 1500);
const by = (h) => read.parts.find((p) => p.hooks?.["data-hook"] === h);
const op = (p) => p?.style?.opacity;

const hello = by("hello");
check("(a) a shown entrance with fill both is read at its end: no opacity", !!hello && op(hello) === undefined, JSON.stringify(op(hello)));
check("(a) and at its resting top", !!hello && Math.abs(hello.box.y - rest.hello) <= 1, JSON.stringify({ read: hello?.box.y, rest: rest.hello }));
const panel = by("panel");
const line = by("panel-line");
check("(b) the hidden panel is read whole, not see-through", !!panel && !(op(panel) < 1), JSON.stringify(panel ? op(panel) : "no part"));
check("(b) its hooked child too", !!line && !(op(line) < 1), JSON.stringify(line ? op(line) : "no part"));
check("(b) the panel at its resting top, not 40 px low", !!panel && Math.abs(panel.box.y - rest.panel) <= 1, JSON.stringify({ read: panel?.box.y, rest: rest.panel }));
const stamp = by("stamp");
check("(c) a hidden stamp inside the hidden panel has no opacity", !!stamp && op(stamp) === undefined, JSON.stringify(stamp ? op(stamp) : "no part"));
const row = by("row");
check("(d) a template's row is read at its entrance's end", !!row && op(row) === undefined, JSON.stringify(row ? op(row) : "no part"));
const dim = by("dim");
check("(e) a look the page sets itself stays: opacity .4", !!dim && op(dim) === 0.4, JSON.stringify(dim ? op(dim) : "no part"));
const running = await page.evaluate(() => document.getAnimations().filter((a) => Number.isFinite(a.effect?.getTiming?.().iterations) && a.playState !== "finished").length);
check("(f) no entrance is left running after the read", running === 0, `${running} running`);
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
