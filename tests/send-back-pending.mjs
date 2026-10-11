#!/usr/bin/env node
/**
 * NEXT.md LINES IN A PULL REQUEST NOT MERGED ARE PENDING, NOT SENT: REFRESH
 * NEVER CALLS THEM FIXED, AND THE NEXT SEND ASKS FOR THEM AGAIN.
 *
 * Audit 2026-10-11 (sendback-records-sent-before-merge, and dissect #21):
 * "Send the design back" only opens a pull request, yet it marked its
 * polio/NEXT.md lines as sent. Refresh reads NEXT.md on the default branch,
 * where those lines are not yet, read their absence as "deleted, so fixed",
 * landed blue boxes and put the build asks in `done`, so they were never
 * asked again. A Publish GitHub would not merge forgot its lines instead.
 * Both now keep them `pending` until the default branch has their line.
 * GitHub is a stand-in here.
 *
 *   node tests/send-back-pending.mjs
 *
 * Covers: src/features/studio/fixLoop.ts, src/features/studio/StyleLayerPanel.tsx, src/features/studio/CodeSiteButtons.tsx, src/features/studio/useFixLoop.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const F = await jiti.import(join(here, "..", "src", "features", "studio", "fixLoop.ts"));
const src = (...p) => readFileSync(join(here, "..", "src", "features", "studio", ...p), "utf8");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const keys = (xs) => xs.map((i) => i.key).join();

const old = { key: "build:old", kind: "build", hook: "hero-title", page: "Home", says: "Give it the glow." };
const tilt = { key: "build:tilt", kind: "build", hook: "play-button", page: "Play", says: "Tilt it on hover." };
const tv = { key: "nowhere:n1", kind: "nowhere", hook: "tv-box-start", page: "Play", says: "Start does nothing yet." };
/* The default branch's NEXT.md from an earlier Publish: one open line, none for the tilt. */
const onDefault = F.nextMd([old], { site: "PonsStars", when: "2026-10-10" });

/* 1. Send the design back opens a pull request: its lines are pending. */
let loop = F.sentUnmerged({ ...F.NO_LOOP, sent: [old], ticked: [tv.key] }, [tilt, tv]);
check("the pull request's lines are pending, not sent", keys(loop.sent) === "build:old" && keys(loop.pending) === "build:tilt,nowhere:n1");
check("Refresh does not read a pending line as fixed while the default branch lacks it", F.fixedIn(loop.sent, onDefault).length === 0);
check("…and promoting leaves it pending", F.promotePending(loop, onDefault) === loop);
check("the board still asks for it, so a Publish carries it", keys(F.asksToSend(loop, [old, tilt])) === "build:tilt" && keys(F.toSend(loop, [tv])) === "nowhere:n1");
check("a second send keeps each key once", keys(F.sentUnmerged(loop, [tilt]).pending) === "build:tilt,nowhere:n1");
check("an unreadable file promotes nothing", F.promotePending(loop, null) === loop);

/* 2. He merges it: the line is on the default branch, open. Refresh makes it sent, not fixed. */
const merged = F.nextMd([tilt, tv], { site: "PonsStars", when: "2026-10-11", prev: onDefault });
const after = F.promotePending(loop, merged);
check("a pending line found on the default branch becomes sent", keys(after.sent) === "build:old,build:tilt,nowhere:n1" && after.pending.length === 0);
check("…and is not fixed while its line is open", F.fixedIn(after.sent, merged).length === 0);
check("ticked by the code chat, it is fixed", keys(F.fixedIn(after.sent, merged.replace("- [ ] `play-button`", "- [x] `play-button`"))) === "build:tilt");
const ticked = F.promotePending(loop, merged.replace("- [ ] `play-button`", "- [x] `play-button`"));
check("a line merged and already ticked is promoted too", keys(ticked.sent).includes("build:tilt"));

/* 3. Publish merged: what it carried is sent, any other pending line stays pending. */
const pub = F.sentMerged(loop, [tilt]);
check("Publish's merge sends what it carried and keeps the rest pending", keys(pub.sent) === "build:old,build:tilt" && keys(pub.pending) === "nowhere:n1");
check("a loop with no pending field still merges", keys(F.sentMerged(F.NO_LOOP, [tv]).sent) === "nowhere:n1");

/* 4. The buttons use them. */
const panel = src("StyleLayerPanel.tsx"), buttons = src("CodeSiteButtons.tsx");
check("Send the design back records its lines as pending", /setFixLoop\(sentUnmerged\(fixLoopOf\(useStudio\.getState\(\)\.look\), asks\.adding\)\)/.test(panel) && !/sent: \[\.\.\.l\.sent, \.\.\.asks\.adding\]/.test(panel));
check("Publish not merged records them as pending, both ways", /const unmerged = \(says: string\) => \{ if \(adding\.length\) setFixLoop\(sentUnmerged\(/.test(buttons) && /if \(!sent\.pull\) \{ unmerged\(sent\.says\); return; \}/.test(buttons) && /if \(!merged\.ok\) \{ unmerged\(merged\.says\); return; \}/.test(buttons));
check("Publish merged records them as sent", /setFixLoop\(sentMerged\(fixLoopOf\(useStudio\.getState\(\)\.look\), adding\)\)/.test(buttons));
check("Refresh promotes pending lines before it reads what is fixed, and keeps the rest", /if \(!was\.sent\.length && !was\.pending\?\.length\) return;/.test(buttons) && /const loop = promotePending\(was, md\);\s*const fixed = fixedIn\(loop\.sent, md\);/.test(buttons) && /setFixLoop\(\{ \.\.\.loop, ticked:/.test(buttons));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} ok`);
process.exit(failed ? 1 : 0);
