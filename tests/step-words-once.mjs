#!/usr/bin/env node
/**
 * A STATE'S WORDS ARE DRAWN ONCE, WHEN A HOOK HOLDS ANOTHER.
 *
 * J (2026-10-06): PST's queue panel read "Pot: - SOL.-Pot: - SOL." in both
 * its states. The line "Pot: <span queue-pot>-</span> SOL." is three runs,
 * the outer two on the line's hook, and a screen's words for that hook are
 * the whole line, so each of the two took all of it. A hook that holds others
 * now only adds what lies between their words.
 *
 *   node tests/step-words-once.mjs
 *
 * Covers: src/features/studio/states/boardStates.ts
 */
import { stepLook } from "../src/features/studio/states/boardStates.ts";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const r = (text, h) => ({ text, ...(h ? { hooks: { "data-hook": h } } : {}) });
const node = (content) => ({ id: "n", x: 0, y: 0, w: 100, h: 20, hooks: {}, content });
const words = (look) => (look?.content ?? []).map((x) => x.text).join("");
const screen = (texts) => ({ name: "s", label: "s", shows: Object.keys(texts), texts });

const pot = node([r("Pot: ", "queue-numbers-line"), r("-", "queue-pot"), r(" SOL.", "queue-numbers-line")]);
check("the same words as it opens change nothing", stepLook(pot, screen({ "queue-numbers-line": "Pot: - SOL.", "queue-pot": "-" })) === null);
check("a new pot is drawn once", words(stepLook(pot, screen({ "queue-numbers-line": "Pot: 0.2 SOL.", "queue-pot": "0.2" }))) === "Pot: 0.2 SOL.", words(stepLook(pot, screen({ "queue-numbers-line": "Pot: 0.2 SOL.", "queue-pot": "0.2" }))));
check("the line's own words change round it", words(stepLook(pot, screen({ "queue-numbers-line": "Prize: 0.2 SOL!", "queue-pot": "0.2" }))) === "Prize: 0.2 SOL!");
const ends = node([r("Pot: ", "line"), r("-", "pot")]);
check("a hook that ends on the one it holds", words(stepLook(ends, screen({ line: "Pot: 5", pot: "5" }))) === "Pot: 5");
const sides = node([r("a", "x"), r(" "), r("b", "y")]);
check("hooks side by side each take their own", words(stepLook(sides, screen({ x: "1", y: "2" }))) === "1 2");
const looks = node([r("Pot: ", "line"), { ...r("5", "line"), weight: 700 }]);
check("one hook in two looks is drawn once", words(stepLook(looks, screen({ line: "Pot: 7" }))) === "Pot: 7");

const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
