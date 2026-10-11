#!/usr/bin/env node
/**
 * A SECOND PUBLISH KEEPS WHAT THE CODE CHAT WROTE IN polio/NEXT.md, AND
 * REFRESH ONLY CALLS A LINE FIXED WHEN ITS BOX IS TICKED OR IT IS GONE.
 *
 * Audit nextmd-drops-lines (dissect #39): Publish used to rewrite NEXT.md with
 * only the lines in the Builder's exact format, so a note under a line, text
 * after a line's comment or an indented line vanished, and Refresh showed an
 * open line the chat had only annotated as fixed. No server needed.
 *
 *   node tests/next-md-notes.mjs
 *
 * Covers: src/features/studio/fixLoop.ts, src/features/studio/publishAsks.ts, src/features/studio/CodeSiteButtons.tsx
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const F = await jiti.import(join(here, "..", "src", "features", "studio", "fixLoop.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const issue = (key, hook) => ({ key, kind: "nowhere", hook, page: "Play", says: `${hook} does nothing yet.` });
const abc = issue("nowhere:abc", "wallet-panel");
const def = issue("nowhere:def", "tv-box-start");
const ghi = issue("nowhere:ghi", "player-card-name");
const jkl = issue("nowhere:jkl", "chart-frame");
const mno = issue("nowhere:mno", "score-row");
const gone = issue("nowhere:gone", "old-part");
const fresh = issue("nowhere:new", "new-part");

/* What a code chat leaves behind after the first Publish. */
const first = F.nextMd([abc, def, ghi, jkl, mno, gone], { site: "PonsStars", when: "2026-10-08" });
const ticked = F.nextLine(abc).replace("- [ ]", "- [x]") + " (needs J's key)";
const note = "  - Blocked: J must add the devnet key in Render first.";
const started = F.nextLine(ghi) + " (started)";
const star = F.nextLine(jkl).replace("- [ ]", "* [ ]");
const indented = "  " + F.nextLine(mno);
const prev = first
  .replace(F.nextLine(abc), ticked)
  .replace(F.nextLine(def), `${F.nextLine(def)}\n${note}`)
  .replace(F.nextLine(ghi), started)
  .replace(F.nextLine(jkl), star)
  .replace(F.nextLine(mno), indented)
  .replace(F.nextLine(gone) + "\n", "");

/* Publish again with one new issue and one already in the file. */
const again = F.nextMd([fresh, ghi], { site: "PonsStars", when: "2026-10-09", prev });
for (const [name, line] of [["a ticked line with text after its comment", ticked], ["a note under a line", note], ["an open line with text after its comment", started], ["a * bullet line", star], ["an indented line", indented]]) {
  check(`${name} is kept word for word`, again.split("\n").includes(line), line);
}
check("the note stays right under its line", again.includes(`${F.nextLine(def)}\n${note}\n`));
check("the header is written once, with today's date", (again.match(/^# Next for the code chat/gm) ?? []).length === 1 && (again.match(/Last written by the Builder on/g) ?? []).length === 1 && again.includes("on 2026-10-09."));
check("the header says where a note goes", /A note for J goes on its own indented line under the item/.test(again));
check("a new issue is added", again.includes(F.nextLine(fresh)));
check("a key already on an annotated line is not written twice", (again.match(/fix:nowhere:ghi -->/g) ?? []).length === 1);
check("publishing the same file again changes nothing but the date", F.nextMd([fresh], { site: "PonsStars", when: "2026-10-09", prev: again }) === again);
check("Windows line ends are read too", F.nextMd([], { site: "PonsStars", when: "2026-10-09", prev: prev.replace(/\n/g, "\r\n") }) === F.nextMd([], { site: "PonsStars", when: "2026-10-09", prev }));

/* Refresh reads it back. */
const fixed = F.fixedIn([abc, def, ghi, jkl, mno, gone], again).map((i) => i.key).sort().join();
check("only the ticked and the deleted lines show as fixed", fixed === "nowhere:abc,nowhere:gone", fixed);
check("an open line with a note after its comment stays open", !F.fixedIn([ghi], again).length);
check("a line with no readable box stays open", !F.fixedIn([def], `Look at <!-- fix:${def.key} --> later`).length);
check("a ticked line still counts as fixed", F.fixedIn([abc], F.nextLine(abc).replace("- [ ]", "- [X]")).length === 1);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
