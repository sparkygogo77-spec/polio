#!/usr/bin/env node
/**
 * A SITE FROM CODE: REFRESH FROM IT, PUBLISH INTO IT, AND WHAT THE BOARD
 * CANNOT FIX GOES TO A CODE BRANCH.
 *
 * J (2026-10-04): Go live on a site from code is replaced by Refresh (green
 * while the board is up to date with its repository) and Publish (the
 * style layer on a branch, merged after he confirms); the check list stops
 * calling buttons its code wires "buttons that do nothing", and what is left
 * can go to a new branch for a code chat. GitHub is a stand-in here.
 *
 *   node tests/code-site-publish.mjs
 *
 * Covers: src/features/studio/send-out/codePublish.ts, src/features/studio/send-out/publishCheck.ts, src/features/studio/CodeSiteButtons.tsx, src/features/studio/GoLiveButton.tsx, src/features/studio/PublishCheck.tsx, src/features/studio/bring-in/FromASite.tsx
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const C = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "codePublish.ts"));
const Q = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "publishCheck.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

/* 1. Where the board stands. */
const src = { repo: "him/site", ref: "main", commit: "aaaaaaa1", sent: null };
const layer = "/* head */\n[data-hook=\"x\"] { color: red; }";
const print = C.layerPrint(layer);
check("up to date with the commit it was read at, nothing to publish: green", J(C.codeStatus(src, "aaaaaaa1", print, true)).includes('"at":"current"') && C.codeStatus(src, "aaaaaaa1", print, true).pending === false);
check("a design on the board not yet published is pending", C.codeStatus(src, "aaaaaaa1", print, false).pending === true);
check("once published (its print kept), it is not", C.codeStatus({ ...src, sent: print }, "aaaaaaa1", print, false).pending === false);
check("the code moved on: behind, and it says from which commit to which", C.codeStatus(src, "bbbbbbb2", print, true).at === "behind" && /aaaaaaa → bbbbbbb/.test(C.codeStatus(src, "bbbbbbb2", print, true).says));
check("the same layer with other spacing or another date in its head is the same print", C.layerPrint("/* other head */\n[data-hook=\"x\"]  {\n color: red; }") === print);

/* 2. Merging, through a stand-in GitHub. */
const answer = (status, json) => async () => new Response(JSON.stringify(json), { status });
const ok = await C.mergePull("him/site", "https://github.com/him/site/pull/7", "t", { fetch: answer(200, { sha: "ccc" }) });
check("a pull request merged gives the merge commit", ok.ok && ok.sha === "ccc");
const no = await C.mergePull("him/site", "https://github.com/him/site/pull/7", "t", { fetch: answer(405, { message: "checks" }) });
check("a merge GitHub refuses leaves it open, says why, and links it", !no.ok && /required has not passed|protected/.test(no.says) && /pull\/7/.test(no.says), no.says);

/* 3. The list for a code chat. */
const files = C.issueFiles([{ kind: "Words that are hard to read", hook: "tour-dot-welcome", page: "Play", says: "2.5 to 1" }], { repo: "him/site", site: "Site 10", when: "2026-10-04" });
check("the issues go as design/ISSUES.md and design/issues.json, by hook", files.map((f) => f.path).join(",") === "design/ISSUES.md,design/issues.json" && /- \[ \] `tour-dot-welcome` on Play: 2.5 to 1/.test(files[0].content));
const refused = await C.pushBranch("him/site", "t", files, { branch: "main", message: "x", fetch: answer(200, { default_branch: "main" }) });
check("never onto the default branch", !refused.ok && /never main/.test(refused.says));

/* 4. A button its code wires does something. */
const nodes = [
  { id: "b1", pageId: "p", featureId: "cta-primary", content: "Find a match", x: 0, y: 0, w: 100, h: 40, source: { code: { refs: [{ kind: "listens" }] } } },
  { id: "b2", pageId: "p", featureId: "cta-primary", content: "Nowhere", x: 0, y: 100, w: 100, h: 40 },
];
const got = Q.checkBoard({ nodes, pages: [{ id: "p", name: "Play" }], held: new Set(), palette: {} }).filter((p) => p.kind === "nowhere").map((p) => p.id);
check("a button its own code wires is not 'a button that does nothing'", J(got) === J(["b2"]), J(got));

/* 5. The Builder's own wiring, read. */
const go = readFileSync(join(here, "..", "src", "features", "studio", "GoLiveButton.tsx"), "utf8");
const pc = readFileSync(join(here, "..", "src", "features", "studio", "PublishCheck.tsx"), "utf8");
const fa = ["FromASite.tsx", ...["bring.tsx", "FromASite.tsx", "bits.tsx"].map((f) => `fromasite/${f}`)].map((f) => `src/features/studio/bring-in/${f}`).map((f) => readFileSync(join(here, "..", f), "utf8")).join("\n");
check("a site from code shows Refresh and Publish in Go live's place (source read)", /if \(fromCode\) return <CodeSiteButtons source=\{fromCode\} \/>/.test(go));
check("the check list sends its lines to a code branch (source read)", /data-check-to-branch/.test(pc) && /pushBranch\(code\.repo/.test(pc));
check("an import keeps the commit it read, and reads at his window's width (source read)", /styleSource\.commit = (at \?\? )?await headOf/.test(fa) && /width: String\(readAt\)/.test(fa));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
