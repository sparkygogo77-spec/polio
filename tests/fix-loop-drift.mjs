#!/usr/bin/env node
/**
 * NEXT.md LINES THE CODE CHAT REFORMATTED OR ANNOTATED STAY OPEN, AND PUBLISH
 * KEEPS THEM.
 *
 * Refresh used to call a line fixed when it no longer matched the exact shape
 * the Builder wrote (a note after the key, `* [ ]`, an indent), toast "Fixed in
 * the code", and the next Publish dropped that line and any note under it.
 * Dissect #39. Only a ticked box or a key gone from the file counts as fixed.
 *
 *   node tests/fix-loop-drift.mjs
 *
 * Covers: src/features/studio/fixLoop.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const F = await jiti.import(join(here, "..", "src", "features", "studio", "fixLoop.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const tv = { key: "nowhere:n1", kind: "nowhere", hook: "tv-box-start", page: "Play", says: "Start does nothing yet." };
const words = { key: "link:n2", kind: "link", hook: "player-card-name", page: "Play", says: "The player's name links to an X profile." };
const md = F.nextMd([tv], { site: "PonsStars", when: "2026-10-08" });
const line = F.nextLine(tv);
const keys = (xs) => xs.map((i) => i.key).join();
const count = (s, k) => (s.match(new RegExp(`fix:${k}`, "g")) ?? []).length;

/* Refresh: a line still there and not ticked is open, whatever its shape. */
check("a note after the key leaves it open", keys(F.fixedIn([tv], md.replace(line, `${line} (blocked: needs J's key)`))) === "");
check("`* [ ]` leaves it open", keys(F.fixedIn([tv], md.replace("- [ ]", "* [ ]"))) === "");
check("an indented line stays open", keys(F.fixedIn([tv], md.replace(line, `  ${line}`))) === "");
check("Windows line ends leave it open", keys(F.fixedIn([tv], md.replace(/\n/g, "\r\n"))) === "");
check("`* [x]` is fixed", keys(F.fixedIn([tv], md.replace("- [ ]", "* [x]"))) === "nowhere:n1");
const headerOnly = md.replace(`${line}\n`, "");
check("a deleted line is fixed, and the header's own `<!-- fix:... -->` is not a key", headerOnly.includes("<!-- fix:... -->") && keys(F.fixedIn([tv], headerOnly)) === "nowhere:n1");

/* Publish: what the code chat wrote is kept. */
const noted = md.replace(line, `${line}\n  - waiting on J`);
const next = F.nextMd([words], { site: "PonsStars", when: "2026-10-09", prev: noted });
check("a note under a line survives Publish", next.includes(`${line}\n  - waiting on J`) && count(next, "nowhere:n1") === 1 && count(next, "link:n2") === 1, next.split("\n").slice(7).join(" | "));
check("the header is written once", (next.match(/Last written by the Builder/g) ?? []).length === 1 && next.includes("2026-10-09") && !next.includes("2026-10-08"));
const starred = md.replace("- [ ]", "* [ ]");
const again = F.nextMd([tv, words], { site: "PonsStars", when: "2026-10-09", prev: starred });
check("a reformatted line is kept and not written twice", again.includes("* [ ] `tv-box-start`") && count(again, "nowhere:n1") === 1 && count(again, "link:n2") === 1);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
