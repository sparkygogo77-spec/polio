#!/usr/bin/env node
/**
 * polio/NEXT.md AND hooks.json ARE READ WHERE PUBLISH MERGES: THE DEFAULT BRANCH.
 *
 * The audit (2026-10-11, dissect #34): a board brought in from another
 * branch (the redesign board, claude/elaborate-redesign) built NEXT.md from
 * that branch's copy, then Publish cut its style/ branch from the default
 * branch and merged it there, overwriting the lines and ticks only the
 * default branch had. Refresh read NEXT.md back from the brought-in branch,
 * where the code chat's ticks never land, so nothing turned blue, and the
 * Publish dialog named the brought-in branch as where it merges.
 *
 *   1. `kitRun.ts#fileOnDefault` reads a file on the repository's default
 *      branch, and on HEAD when GitHub will not say which that is.
 *   2. Publish (`publishAsks.ts`) and Refresh (`CodeSiteButtons.tsx`) read
 *      NEXT.md through it; the design record's hooks.json (`codeSend.ts`,
 *      `exportForCode.ts`) is read on the branch the layer is cut from; the
 *      dialog names the default branch, and says when the board came from
 *      another one. GitHub is a stand-in here.
 *
 *   node tests/next-on-default.mjs
 *
 * Covers: src/features/studio/kitRun.ts, src/features/studio/publishAsks.ts, src/features/studio/CodeSiteButtons.tsx, src/features/studio/codeSend.ts, src/features/studio/exportForCode.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const src = (...p) => readFileSync(join(here, "..", "src", "features", "studio", ...p), "utf8");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const K = await jiti.import(join(here, "..", "src", "features", "studio", "kitRun.ts"));
const F = await jiti.import(join(here, "..", "src", "features", "studio", "fixLoop.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* 1. A stand-in GitHub: x/y's default branch is main, and NEXT.md differs between main and the redesign branch. */
const tv = { key: "nowhere:n1", kind: "nowhere", hook: "tv-box-start", page: "Play", says: "Start does nothing yet." };
const words = { key: "link:n2", kind: "link", hook: "player-card-name", page: "Play", says: "The player's name links to an X profile." };
const onMain = F.nextMd([tv], { site: "PonsStars", when: "2026-10-10" }).replace("- [ ]", "- [x]");
const onRedesign = F.nextMd([], { site: "PonsStars", when: "2026-10-09" });
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const stub = (repoStatus = 200) => {
  const seen = [];
  const f = async (url) => {
    const u = new URL(url);
    seen.push(u.pathname + u.search);
    const json = (status, body) => ({ status, json: async () => body });
    if (u.pathname === "/repos/x/y") return repoStatus === 200 ? json(200, { default_branch: "main" }) : json(repoStatus, { message: "no" });
    if (u.pathname === `/repos/x/y/contents/${F.NEXT_PATH}`) {
      const ref = u.searchParams.get("ref");
      const body = ref === "main" || ref === "HEAD" ? onMain : ref === "claude/elaborate-redesign" ? onRedesign : null;
      return body === null ? json(404, {}) : json(200, { content: b64(body) });
    }
    return json(404, {});
  };
  return { f, seen };
};

const gh = stub();
const prev = await K.fileOnDefault(gh.f, "t", "x/y", F.NEXT_PATH);
check("NEXT.md is read on the default branch", prev === onMain, JSON.stringify(gh.seen));
check("…never on the branch the board came from", gh.seen.some((p) => /ref=main$/.test(p)) && !gh.seen.some((p) => /elaborate-redesign/.test(p)), JSON.stringify(gh.seen));
const md = F.nextMd([words], { site: "PonsStars", when: "2026-10-11", prev });
check("Publish keeps the default branch's lines and ticks and adds the new one", md.includes("- [x] `tv-box-start`") && md.includes("<!-- fix:link:n2 -->"));
check("Refresh then sees the code chat's tick there", F.fixedIn([tv, words], md).map((i) => i.key).join() === "nowhere:n1");
const quiet = stub(500);
check("when GitHub will not name the default branch, HEAD (its own default) is read", (await K.fileOnDefault(quiet.f, "t", "x/y", F.NEXT_PATH)) === onMain && quiet.seen.some((p) => /ref=HEAD$/.test(p)), JSON.stringify(quiet.seen));

/* 2. Every reader goes there. */
const asks = src("publishAsks.ts"), buttons = src("CodeSiteButtons.tsx"), send = src("codeSend.ts"), exp = src("exportForCode.ts");
check("Publish builds NEXT.md from the default branch's copy", /await defaultBranch\(fetch, token, source\.repo\)/.test(asks) && /fileOrGone\(fetch, token, source\.repo, main\?\.ok \? main\.branch : "HEAD", NEXT_PATH\)/.test(asks) && /prev: prev\.text/.test(asks));
check("Refresh reads NEXT.md back from the default branch", /await fileOnDefault\(fetch, token, source\.repo, NEXT_PATH\)/.test(buttons));
check("the design record's hooks.json is read where the layer is cut from", /fileAt\(fetch, token, source\.repo, prepared\.base, mapPath\)/.test(send) && /fileAt\(opts\.fetch \?\? fetch, token, source\.repo, main\.branch, mapPath\)/.test(exp));
check("no reader is left on the brought-in branch", ![asks, buttons, send, exp].some((s) => /fileAt\([^)]*source\.ref \|\| "HEAD"/.test(s)));
check("the dialog names the default branch as where it merges", /merged into \{main \?\? "the default branch"\}/.test(buttons) && !/merged into \{source\.ref/.test(buttons));
check("…and says when the board came from another branch", /data-code-publish-base=""[^]*This board came from \{source\.ref\}; Publish merges into \{main\}/.test(buttons));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
