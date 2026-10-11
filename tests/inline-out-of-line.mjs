#!/usr/bin/env node
/**
 * AN INLINE ELEMENT THE PAGE TOOK OUT OF ITS LINE IS A PART OF ITS OWN.
 *
 * PonsStars' redesign stamps "Test networks only" over its desk: a <span>
 * placed absolutely at the top right and turned 6 degrees. Inline, it was
 * folded into its section's first line of words: no hook, no turn, and a
 * place in the flow the page never gave it (J, 2026-10-11). A span the
 * page placed absolutely or turned is read as a part where the page put
 * it, hook and turn kept; a plain span in a sentence is still a run of
 * that sentence.
 *
 *   node tests/inline-out-of-line.mjs
 */
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { launch } from "./fixtures/look-sites.mjs";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.setContent(`<!doctype html><body style="margin:0;font:16px Arial">
<section data-hook="desk" style="position:relative;width:600px;padding:40px 20px;background:#e9d6b4">
  <span data-hook="stamp" style="position:absolute;top:-14px;right:18px;rotate:6deg;padding:4px 10px;border:3px double #a33;color:#a33;font-weight:700">Test networks only</span>
  <p data-hook="note">The chart shows <em data-hook="note-em">the server's</em> price readings.</p>
  <span data-hook="tag" style="display:inline-block;transform:rotate(-4deg);padding:2px 8px;background:#f6c56a">On air</span>
</section></body>`);
const real = await page.evaluate(() => Object.fromEntries(["stamp", "tag", "note"].map((h) => { const e = document.querySelector(`[data-hook="${h}"]`); const r = e.getBoundingClientRect(); return [h, [r.left, r.top, r.width, r.height].map(Math.round)]; })));
const read = await page.evaluate(PARTS, 1500);
const by = (h) => read.parts.find((p) => p.hooks?.["data-hook"] === h);
const stamp = by("stamp");
check("the absolutely placed stamp is a part with its hook", !!stamp && stamp.words === "Test networks only", JSON.stringify(stamp?.words));
check("it keeps its turn", !!stamp && !!stamp.turn && stamp.turn !== "none", JSON.stringify(stamp?.turn));
check("its box is the stamp's own, not a line of the desk", !!stamp && Math.abs(stamp.box.y - real.stamp[1]) <= 12 && stamp.box.w < 220, JSON.stringify({ read: stamp?.box, real: real.stamp }));
const tag = by("tag");
check("the turned inline-block tag is a part with its hook and turn", !!tag && tag.words === "On air" && !!tag.turn, JSON.stringify({ words: tag?.words, turn: tag?.turn }));
const note = by("note");
check("a plain span in a sentence is still a run of it", !!note && /the server's/.test(note.words) && (note.runs ?? []).some((r) => r.hooks?.["data-hook"] === "note-em"), JSON.stringify(note?.runs));
check("no line of the desk carries the stamp's words", !read.parts.some((p) => !p.hooks?.["data-hook"] && /Test networks only/.test(p.words ?? "")), "");
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
