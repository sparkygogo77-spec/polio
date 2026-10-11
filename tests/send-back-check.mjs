#!/usr/bin/env node
/**
 * THE REPO MENU'S "OPEN A PULL REQUEST" RUNS THE BOARD'S CHECK LIST FIRST, AS PUBLISH DOES.
 *
 * Audit 2026-10-11 (repo-menu-send-skips-publish-and-marks-asks-sent): the
 * repo menu's "Send the design back" is a second door to the code. Publish
 * in the top bar reads the board first (`PublishCheck.tsx`: links off the
 * site, buttons that do nothing, pictures this browser lost) and lists what
 * is wrong before anything is sent; "Open a pull request" sent straight
 * away, so J got a pull request for a board with problems nobody had named.
 * Now both doors run the same checkThenPublish: a clean board sends at
 * once, otherwise the list opens over the repo menu and the pull request
 * opens only on Publish anyway; a line's Show closes the menu as it picks
 * the part, so the part is not left under it. The other half of the
 * finding (its NEXT.md lines marked sent before any merge) was fixed by
 * #243 and is held by tests/send-back-pending.mjs. Source reads: the check
 * needs the browser.
 *
 *   node tests/send-back-check.mjs
 *
 * Covers: src/features/studio/StyleLayerPanel.tsx, src/features/studio/CodeSiteButtons.tsx, src/features/studio/PublishCheck.tsx, src/features/studio/RepoPicker.tsx
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "src", "features", "studio");
const src = (f) => readFileSync(join(dir, f), "utf8");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* 1. The check itself: a clean board goes on at once; otherwise the list, and on only by Publish anyway. */
const pc = src("PublishCheck.tsx");
check("checkThenPublish reads the board, goes on when it is clean, and otherwise opens the list holding the send", /export async function checkThenPublish\(go: \(\) => void\)/.test(pc) && /const problems = await readBoard\(\);\s*if \(!problems\.length\) \{ go\(\); return; \}\s*useCheck\.setState\(\{ open: true, problems, go \}\);/.test(pc));
check("…which Publish anyway lets through", /data-publish-anyway="" onClick=\{\(\) => \{ const g = go; close\(\); g\?\.\(\); \}\}/.test(pc));
/* Opened over the repo menu, a line's Show closes the menu too, or the part it picks stays under it. */
const picker = src("RepoPicker.tsx");
check("a line's Show closes the repo menu as it picks the part", /useCheck\.setState\(\{ open: false \}\);[\s\S]{0,140}closeRepoPicker\(\);\s*requestAnimationFrame\(\(\) => goToPart\(p\.id\)\);/.test(pc) && /import \{ closeRepoPicker, openRepoPicker \} from "\.\/RepoPicker";/.test(pc));
check("…the menu's one host listening for it", /export function closeRepoPicker\(\): void \{\s*window\.dispatchEvent\(new CustomEvent\("studio:bring-repo-close"\)\);/.test(picker) && /window\.addEventListener\("studio:bring-repo-close", off\);/.test(picker) && /window\.removeEventListener\("studio:bring-repo-close", off\);/.test(picker));

/* 2. Every door that sends the design to its code runs it first. */
const doors = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && /import \{[^}]*\bsendDesign\b[^}]*\} from "\.\/codeSend"/.test(src(f)));
check("the doors that send the design to the code are Publish and the repo menu", doors.sort().join() === "CodeSiteButtons.tsx,StyleLayerPanel.tsx", doors.join());
for (const f of doors) check(`${f} takes checkThenPublish from PublishCheck`, /import \{ checkThenPublish \} from "\.\/PublishCheck";/.test(src(f)));

/* 3. The repo menu: its button goes through the check, and only the check's go reaches the send. */
const panel = src("StyleLayerPanel.tsx");
check("Open a pull request presses send, which runs the check with the send as its go", /data-style-layer-send="" disabled=\{busy\} onClick=\{send\}/.test(panel) && /const send = \(\) => void checkThenPublish\(\(\) => void sendNow\(\)\);/.test(panel));
const now = panel.indexOf("const sendNow = async () => {"), sent = panel.indexOf("await sendDesign("), drawn = panel.indexOf("<section data-repo-section=\"style-layer\"");
check("the design is sent only inside sendNow", now > 0 && sent > now && drawn > sent && (panel.match(/await sendDesign\(/g) ?? []).length === 1);
check("…and nothing else calls sendNow", (panel.match(/\bsendNow\(\)/g) ?? []).length === 1);
check("its lines still go in as pending, not sent, until a merge (#243)", /setFixLoop\(sentUnmerged\(fixLoopOf\(useStudio\.getState\(\)\.look\), asks\.adding\)\)/.test(panel) && !/sent: \[\.\.\.l\.sent/.test(panel));

/* 4. Publish, as it was: the check, then what changes and his yes, then the send. */
const buttons = src("CodeSiteButtons.tsx");
check("Publish runs the same check before its own dialog", /void checkThenPublish\(\(\) => setAsk\("publish"\)\);/.test(buttons));
check("…whose Publish and merge is the only way to its send", /data-code-publish-go="" onClick=\{\(\) => void publishNow\(\)\}/.test(buttons) && buttons.indexOf("await sendDesign(") > buttons.indexOf("const publishNow = async () => {") && (buttons.match(/publishNow\(\)/g) ?? []).length === 1);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
