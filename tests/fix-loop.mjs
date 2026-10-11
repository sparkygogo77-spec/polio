#!/usr/bin/env node
/**
 * THE FIX LOOP: REAL ISSUES BECOME LANE CARDS, TICKED ONES GO TO
 * polio/NEXT.md ON PUBLISH, AND REFRESH MARKS THE FIXED ONES.
 *
 * J (2026-10-08): "if the code generates an issue and builder recognizes it
 * you can view it and choose what needs a fix through the blue boxes and the
 * api queues a fix in the document for the next code chat to interpret and
 * fix". Audit item 7. GitHub is a stand-in here.
 *
 *   node tests/fix-loop.mjs
 *
 * Covers: src/features/studio/fixLoop.ts, src/features/studio/useFixLoop.ts, src/features/studio/publishAsks.ts, src/features/studio/loop/Lanes.tsx, src/features/studio/CodeSiteButtons.tsx, src/features/studio/codeSend.ts, kit/CLAUDE.md, kit/PIPELINE.md
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const F = await jiti.import(join(here, "..", "src", "features", "studio", "fixLoop.ts"));
const L = await jiti.import(join(here, "..", "src", "features", "studio", "loop", "lanes.ts"));
const read = (f) => readFileSync(join(here, "..", f), "utf8");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const tv = { key: "nowhere:n1", kind: "nowhere", hook: "tv-box-start", page: "Play", says: "Start does nothing yet." };
const words = { key: "link:n2", kind: "link", hook: "player-card-name", page: "Play", says: "The player's name links to an X profile." };
const spill = { key: "fit:n3", kind: "fit", hook: null, page: "Home", says: "The chart runs off the page at phone width." };

/* 1. Spot: each problem is a fix card, laned by how hard it is. */
const items = [tv, words, spill].map(F.issueItem);
check("an issue is a fix card carrying the issue", items.every((it, i) => it.kind === "fix" && it.issue === [tv, words, spill][i]) && items[0].id === "issue:nowhere:n1");
check("its card names the hook, the page and what done looks like", /tv-box-start · Play/.test(items[0].detail) && /Done when pressing it does something/.test(items[0].detail));
const lanes = L.lanesOf(items);
check("cheap fixes go green, a spill goes red", lanes[0].items.some((it) => it.id === "issue:link:n2") && lanes[2].items.some((it) => it.id === "issue:fit:n3"), lanes.map((l) => l.items.map((i) => i.id).join("+")).join(" | "));

/* 2. Pick: ticks. */
let loop = F.NO_LOOP;
loop = F.toggleTick(loop, tv.key);
loop = F.toggleTick(loop, spill.key);
loop = F.toggleTick(loop, spill.key);
check("tick and untick", loop.ticked.join() === "nowhere:n1");
loop = F.toggleTick(loop, words.key);
check("only ticked and not yet sent issues go", F.toSend(loop, [tv, words, spill]).map((i) => i.key).join() === "nowhere:n1,link:n2");
check("an issue already in NEXT.md is not sent again", F.toSend({ ...loop, sent: [tv] }, [tv, words, spill]).map((i) => i.key).join() === "link:n2");

/* 3. Queue: the file. */
const md = F.nextMd([tv], { site: "PonsStars", when: "2026-10-08" });
check("NEXT.md says to read it first and how to close a line", /^# Next for the code chat: PonsStars/.test(md) && /Read this first/.test(md) && /tick its box/.test(md));
check("each line: box, hook, page, problem, done when, key", md.includes("- [ ] `tv-box-start` on Play: Start does nothing yet. Done when pressing it does something: it leads somewhere or runs its script. <!-- fix:nowhere:n1 -->"));
const more = F.nextMd([tv, words], { site: "PonsStars", when: "2026-10-09", prev: md.replace("- [ ]", "- [x]") });
check("lines already there are kept as the code chat left them, none written twice", (more.match(/fix:nowhere:n1/g) ?? []).length === 1 && more.includes("- [x] `tv-box-start`") && more.includes("<!-- fix:link:n2 -->"));
check("no hook is said, not hidden", F.nextLine(spill).startsWith("- [ ] (no hook) on Home:"));

/* 4. Land: Refresh reads it back. */
check("a ticked line is fixed", F.fixedIn([tv, words], more).map((i) => i.key).join() === "nowhere:n1");
check("a deleted line is fixed", F.fixedIn([tv, words], md).map((i) => i.key).join() === "link:n2");
check("an unreadable file fixes nothing", F.fixedIn([tv, words], null).length === 0);

/* Wiring (source read). */
const lanesTsx = read("src/features/studio/loop/Lanes.tsx");
const csb = read("src/features/studio/CodeSiteButtons.tsx");
const send = read("src/features/studio/codeSend.ts");
check("the lanes show real issues when there are any, the sample otherwise", /useIssues\(\)/.test(lanesTsx) && /given \?\? real \?\? SAMPLE/.test(lanesTsx));
check("an issue card ticks, and turns blue when ticked", /data-lane-tick/.test(lanesTsx) && /moltenClass\(issue && !ticked \? "lantern" : "azure"\)/.test(lanesTsx));
check("Publish sends NEXT.md with the design, and keeps what went", /extra/.test(send) && /path: NEXT_PATH, content: nextMd\(adding/.test(read("src/features/studio/publishAsks.ts")) && /setFixLoop\(sentMerged\(fixLoopOf\(useStudio\.getState\(\)\.look\), adding\)\)/.test(csb));
check("Refresh reads NEXT.md back and lands the fixed ones as blue boxes", /fixedIn\(loop\.sent, md\)/.test(csb) && /landThread\(\{ mode: LANE_MODE/.test(csb));
check("the kit tells every code chat to read polio/NEXT.md first", /First, read `polio\/NEXT\.md`/.test(read("kit/CLAUDE.md")) && /polio\/NEXT\.md/.test(read("kit/PIPELINE.md")) && F.NEXT_PATH === "polio/NEXT.md");

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
