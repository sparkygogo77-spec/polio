#!/usr/bin/env node
/**
 * ONE PUBLISH, ONE DEPLOYMENT: ONLY THE PUBLISHED BRANCH DEPLOYS.
 *
 * A Vercel project connected to a repository deploys a push to any branch,
 * a preview for each that is not the production one, and each is one of the
 * Hobby plan's hundred deployments a day. The Builder's own repository says
 * in vercel.json that only trunk deploys (and Vercel has built nothing else
 * of it since); a site the Builder writes now says the same in its own:
 * every branch off, the branch it publishes to on. Held here:
 *
 *   1. the rule itself (`deployBranch.ts`): every branch off, the named one
 *      on, the file's other settings kept, text that is not JSON left alone;
 *   2. what the Builder writes: the export's vercel.json and Build's app's
 *      both carry it, for main;
 *   3. the publish route names the branch the push actually goes to, once
 *      that branch is known (source read; tests/build-runs.mjs pushes
 *      through the real route and reads the file back);
 *   4. the Builder's own vercel.json still says only trunk deploys.
 *
 *   node tests/deploy-only-published-branch.mjs
 *
 * Covers: src/features/studio/send-out/deployBranch.ts, src/features/studio/send-out/exportSite.ts, src/features/studio/scaffolding/app.ts, src/app/api/studio/publish/route.ts, vercel.json
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(ROOT, "src") } });
const D = await jiti.import(join(ROOT, "src/features/studio/send-out/deployBranch.ts"));
const A = await jiti.import(join(ROOT, "src/features/studio/scaffolding/app.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok !== true && detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

/* 1. The rule. */
check("1 every branch is off and main is on, when nothing names a branch", J(D.onlyBranchDeploys()) === J({ deploymentEnabled: { "**": false, main: true } }));
const site = D.deployOnlyFrom(J({ cleanUrls: true, trailingSlash: false, git: { deploymentEnabled: { "**": false, main: true }, other: 1 } }), "site");
check("1 a site published to another branch has that branch on instead of main, its other settings kept", J(JSON.parse(site ?? "null")) === J({ cleanUrls: true, trailingSlash: false, git: { deploymentEnabled: { "**": false, site: true }, other: 1 } }), site);
check("1 a vercel.json with no git settings gains them", J(JSON.parse(D.deployOnlyFrom('{"framework":"nextjs"}', "main") ?? "null")) === J({ framework: "nextjs", git: { deploymentEnabled: { "**": false, main: true } } }));
check("1 a file that is not a JSON object is left as it came", D.deployOnlyFrom("not json", "main") === null && D.deployOnlyFrom("[1]", "main") === null);
check("1 the same file stamped twice is the same bytes", D.deployOnlyFrom(site, "site") === site);

/* 2. What the Builder writes. */
const input = { name: "Site", frameWidth: 1440, pages: [], parts: [], palette: {}, tokens: {} };
const appVercel = JSON.parse(A.appFiles(input).find((f) => f.path === "vercel.json").content);
check("2 Build's app says Next.js, and only main deploys", appVercel.framework === "nextjs" && J(appVercel.git) === J(D.onlyBranchDeploys()), J(appVercel));
const exp = readFileSync(join(ROOT, "src/features/studio/send-out/exportSite.ts"), "utf8");
check("2 the export's vercel.json carries the rule beside clean addresses (source read)", /path: "vercel\.json", content: `\$\{JSON\.stringify\(\{ cleanUrls: true, trailingSlash: false, git: onlyBranchDeploys\(\) \}/.test(exp));

/* 3. The route names the branch the push goes to. */
const route = readFileSync(join(ROOT, "src/app/api/studio/publish/route.ts"), "utf8");
const after = route.slice(route.indexOf("const branch = (typeof body.branch"));
check("3 the route stamps vercel.json with the branch it pushes to, once that is known (source read)", /stampVercel\(files, branch\);/.test(after) && after.indexOf("stampVercel(files, branch)") < after.indexOf("if (stage)"));
check("3 …and keeps Build's record of vercel.json in step (source read)", /built\?\.\["vercel\.json"\] === was\) record\.content = buildRecordFile\(/.test(route));

/* 4. The Builder's own repository. */
const own = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8"));
const on = Object.entries(own.git?.deploymentEnabled ?? {}).filter(([, v]) => v === true).map(([k]) => k);
check("4 the Builder's own vercel.json turns every branch off but trunk", own.git?.deploymentEnabled?.["**"] === false && J(on) === J(["claude/template-ui-website-builder-11bfgl"]), J(own.git));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
