#!/usr/bin/env node
/**
 * WORDS TYPED AFTER A LETTER THAT MOVES ON ITS OWN ARE A RUN OF THEIR OWN.
 *
 * trumpmorty.fun's title "TRUMP & MORTY" is one run per letter, each with its
 * own wobble, and each is drawn as a box of its own. Words typed after the
 * last letter (the hand-edit pass on a fourth site, 2026-10-23) went into that
 * letter's run, so its box held the whole new sentence: one line that could
 * not break, 3,900px past the title.
 *
 *   1. the letters keep their runs and their motion;
 *   2. what is typed after them is one run, with the letter's look and no motion;
 *   3. typing inside a plain run still writes into that run (control).
 *
 *   node tests/letters-typed-plain.mjs
 *
 * Covers: src/features/studio/shelf/parts/spans.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { reword } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "spans.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const wob = (d) => ({ animation: [{ name: "wob", duration: "2.6s", delay: `${d}s`, iterations: "infinite" }] });
const title = [..."TRUMP"].map((ch, i) => ({ text: ch, colour: "rgb(255, 255, 255)", motion: wob(-0.22 * i) }));
const out = reword(title, "TRUMP and more words");
check("1. the letters keep their runs and their motion", out.slice(0, 5).every((s, i) => s.text === "TRUMP"[i] && !!s.motion), JSON.stringify(out.slice(0, 5).map((s) => s.text)));
const added = out.slice(5);
check("2. what is typed after them is one run, the letter's look, no motion", added.length === 1 && added[0].text === " and more words" && !added[0].motion && added[0].colour === "rgb(255, 255, 255)", JSON.stringify(added));
const plainRuns = [{ text: "Hello " }, { text: "world", colour: "red" }];
const typed = reword(plainRuns, "Hello world again");
check("3. control: typing after a plain run still writes into it", typed.length === 2 && typed[1].text === "world again" && typed[1].colour === "red", JSON.stringify(typed));
/* 4. Drawn: the letters of a word are held together, the typed run is not held with them. */
const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const jsx = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
const { Runs } = await jsx.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "Runs.tsx"));
const { themeFrom } = await jsx.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "theme.ts"));
const html = renderToStaticMarkup(React.createElement(Runs, { spans: out, t: themeFrom({}), mode: "board" }));
check("4. drawn, the typed words are not held on one line with the letters", !/white-space:nowrap[^]*and more words/.test(html.replace(/<span style="white-space:nowrap">(?:<span[^>]*>[A-Z&]<\/span>)+<\/span>/g, "")) && html.includes("and more words"), html.slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
process.exit(results.every(Boolean) ? 0 : 1);
