#!/usr/bin/env node
/**
 * PUBLISH DOES NOT TURN REFRESH GREEN OVER A CODE CHAT'S CHANGE.
 *
 * Audit (2026-10-11): a code chat merged into the site (head A to B, Refresh
 * orange), J pressed Publish anyway, and the board recorded the merge commit
 * C as the commit it was read at: Refresh went green "Up to date" while the
 * board still showed the code at A, and nothing asked him to bring B in.
 * Now the board moves up to the merge only when the merge sat straight on
 * the commit it was read at (the squash merge's parent); otherwise it keeps
 * its commit, Refresh stays orange, and the Publish dialog says so first.
 * GitHub is a stand-in here.
 *
 *   node tests/publish-keeps-behind.mjs
 *
 * Covers: src/features/studio/send-out/codePublish.ts, src/features/studio/CodeSiteButtons.tsx
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const C = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "codePublish.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const src = { repo: "him/site", ref: "main", commit: "aaaaaaa1", sent: null };
const print = C.layerPrint("/* head */\n[data-hook=\"x\"] { color: red; }");

/* 1. Nothing moved: the merge sits on the board's commit, and Refresh goes green. */
const same = C.commitAfterPublish("aaaaaaa1", "aaaaaaa1", "ccccccc3");
check("the merge sat on the board's commit: the board moves up to it", same === "ccccccc3", J(same));
const green = C.codeStatus({ ...src, sent: print, commit: same }, "ccccccc3", print, false);
check("…and Refresh is green, nothing pending", green.at === "current" && green.pending === false, J(green));

/* 2. A code chat merged B in between: the board keeps A, Refresh stays orange, the design is not pending. */
const kept = C.commitAfterPublish("aaaaaaa1", "bbbbbbb2", "ccccccc3");
check("a code chat's change under the merge: the board keeps the commit it was read at", kept === "aaaaaaa1", J(kept));
const behind = C.codeStatus({ ...src, sent: print, commit: kept }, "ccccccc3", print, false);
check("…so Refresh says the code moved on, and the published design is not pending", behind.at === "behind" && behind.pending === false && /aaaaaaa → ccccccc/.test(behind.says), J(behind));

/* 3. Not known is not up to date. */
check("a board with no commit stays without one", C.commitAfterPublish(null, "aaaaaaa1", "ccccccc3") === null && C.commitAfterPublish(undefined, null, "ccccccc3") === null);
check("a parent GitHub would not show keeps the old commit", C.commitAfterPublish("aaaaaaa1", null, "ccccccc3") === "aaaaaaa1");

/* 4. The merge's parent, through a stand-in GitHub. */
let asked = "";
const answer = (status, json) => async (url) => { asked = String(url); return new Response(JSON.stringify(json), { status }); };
const parent = await C.parentOf("him/site", "ccccccc3", "t", answer(200, { sha: "ccccccc3", parents: [{ sha: "bbbbbbb2" }] }));
check("the merge commit's parent is read from GitHub", parent === "bbbbbbb2" && /\/repos\/him\/site\/git\/commits\/ccccccc3$/.test(asked), `${J(parent)} ${asked}`);
check("a commit GitHub will not show has no parent", (await C.parentOf("him/site", "ccccccc3", "t", answer(404, { message: "Not Found" }))) === null);
check("a commit with no parents has none", (await C.parentOf("him/site", "ccccccc3", "t", answer(200, { sha: "ccccccc3", parents: [] }))) === null);

/* 5. The Builder's own wiring, read. */
const cs = readFileSync(join(here, "..", "src", "features", "studio", "CodeSiteButtons.tsx"), "utf8");
const pub = cs.slice(cs.indexOf("const publishNow"), cs.indexOf("const green"));
check("Publish no longer records the merge commit outright (source read)", !/commit: merged\.sha/.test(cs));
check("Publish reads the merge's parent and records commitAfterPublish (source read)", /parentOf\(source\.repo, merged\.sha/.test(pub) && /commitAfterPublish\(/.test(pub) && /styleSource: \{ \.\.\.now, sent: sent\.print, commit \}/.test(pub));
check("Refresh is set green only when the board moved up to the merge (source read)", /if \(commit === merged\.sha\) setHead\(merged\.sha\); else void read\(\);/.test(pub));
check("the Publish dialog says when the code has moved on (source read)", /status\?\.at === "behind" \? <p data-code-publish-behind=""/.test(cs));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
