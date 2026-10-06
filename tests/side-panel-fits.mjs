#!/usr/bin/env node
/**
 * THE PART PANEL SHOWS WHAT FITS THE PART. The pure half, with no server:
 *
 *   · a mark is for a new idea drawn on the board: not on a part brought in
 *     from a site, not on a button, a link or a control's words, but kept
 *     on any part already given one;
 *   · Make a picture is offered on boxes, sections and pictures, never on a
 *     button, a link or a line of words;
 *   · a button has no prompt of its own (it says what it does where its
 *     link is); a link and a box keep theirs;
 *   · Position and size is locked when the page's code places the part: a
 *     script line that styles its left, top or transform, or a position
 *     variable among its CSS variables; a script that only writes its
 *     words, or a colour variable, leaves it free;
 *   · the Code line counts scripts, not references.
 *
 * Every part here is made up for the test: the rules are general.
 *
 *   node tests/side-panel-fits.mjs
 */
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { panelFits, codePlaced, scriptCount } = await jiti.import("../src/features/studio/partKind.ts");

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (v) => JSON.stringify(v);

const part = (kind, more = {}) => ({ kind, label: false, brought: false, glyph: null, picture: false, ...more });

/* the mark */
check("a new box drawn here offers a mark", panelFits(part("Box")).mark === true);
check("a box brought in from a site does not", panelFits(part("Box", { brought: true })).mark === false);
check("…unless it was given one", panelFits(part("Box", { brought: true, glyph: "✦" })).mark === true);
check("a button and a link do not", !panelFits(part("Button")).mark && !panelFits(part("Link")).mark);
check("a control's words do not", panelFits(part("Words", { label: true })).mark === false);

/* make a picture */
check("a box, a section and a picture offer Make a picture", ["Box", "Section", "Picture"].every((k) => panelFits(part(k)).picture), J(["Box", "Section", "Picture"].map((k) => panelFits(part(k)).picture)));
check("a button, a link and a line of words do not", ["Button", "Link", "Words", "Heading"].every((k) => !panelFits(part(k)).picture));
check("a button's label does not", panelFits(part("Words", { label: true })).picture === false);
check("a part that holds a picture always does", panelFits(part("Button", { picture: true })).picture === true);

/* the prompt */
check("a button has no prompt of its own", panelFits(part("Button")).prompt === false);
check("…nor do the words on it", panelFits(part("Words", { label: true })).prompt === false);
check("a link, a box and a section keep theirs", ["Link", "Box", "Section"].every((k) => panelFits(part(k)).prompt));

/* placed by code */
const ref = (kind, code, file = "web/app.js") => ({ kind, code, file, line: 1, fn: null, via: "data-hook=x" });
check("no code: free", codePlaced(null) === false && codePlaced(undefined) === false);
check("a script that styles its left is placing it", codePlaced({ refs: [ref("styles", "el.style.left = x + 'px'")] }));
check("…or its transform", codePlaced({ refs: [ref("styles", "box.style.transform = `translate(${x}px)`")] }));
check("a position variable among its CSS variables places it", codePlaced({ refs: [], vars: ["--site-marker-left", "--site-ink"] }));
check("…and an x or y variable", codePlaced({ refs: [], vars: ["--tour-box-x"] }));
check("a script that only writes its words leaves it free", codePlaced({ refs: [ref("writes", "el.textContent = left")] }) === false);
check("a colour styled by a script leaves it free", codePlaced({ refs: [ref("styles", "el.style.color = ink")] }) === false);
check("a colour variable leaves it free", codePlaced({ refs: [], vars: ["--site-ink", "--site-size-chart-height"] }) === false);

/* the code line */
check("scripts are counted, not references", scriptCount({ refs: [ref("reads", "a"), ref("writes", "b"), ref("listens", "c", "web/other.js")] }) === 2);
check("no code is no scripts", scriptCount(null) === 0);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} passed`);
process.exit(failed ? 1 : 0);
