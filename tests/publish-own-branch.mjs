#!/usr/bin/env node
/**
 * A BOARD BROUGHT IN FROM A SIDE BRANCH PUBLISHES INTO THAT BRANCH.
 *
 * J (2026-10-11, the builder audit's decision card): a board brought in from
 * owner/name@branch (the redesign board, from claude/elaborate-redesign)
 * publishes into that same branch, not the repository's default branch.
 * Publish cut its style/ branch from the default branch and opened the pull
 * request into it, so a redesign's styles landed on the live site's branch.
 *
 *   1. `kitRun.ts#publishBranch` is the board's own branch when it names one,
 *      the default branch when it names none (or HEAD, or the default
 *      itself), and a branch the repository no longer has is refused in
 *      words, never swapped for the default branch.
 *   2. `styleLayerRun.ts#publishLayer` cuts the style/ branch from that
 *      branch's head and opens the pull request into it; a board from the
 *      default branch still goes into the default branch.
 *   3. `prepareLayer` reads the code there, and every other reader (Publish's
 *      NEXT.md in `publishAsks.ts`, Refresh in `CodeSiteButtons.tsx`, the
 *      design round in `kitRun.ts#readRound`) goes through publishBranch.
 *      GitHub is a stand-in here.
 *
 *   node tests/publish-own-branch.mjs
 *
 * Covers: src/features/studio/kitRun.ts, src/features/studio/styleLayerRun.ts, src/features/studio/publishAsks.ts, src/features/studio/CodeSiteButtons.tsx
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const src = (...p) => readFileSync(join(here, "..", "src", "features", "studio", ...p), "utf8");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const K = await jiti.import(join(here, "..", "src", "features", "studio", "kitRun.ts"));
const S = await jiti.import(join(here, "..", "src", "features", "studio", "styleLayerRun.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* A stand-in GitHub: x/y's default branch is main (head m1); claude/elaborate-redesign is at r1. */
const heads = { main: "m1", "claude/elaborate-redesign": "r1" };
const stub = () => {
  const seen = [];
  const pulls = [];
  const commits = [];
  const f = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    seen.push(`${method} ${u.pathname}${u.search}`);
    const json = (status, b) => ({ status, json: async () => b });
    const p = decodeURIComponent(u.pathname);
    if (p === "/repos/x/y") return json(200, { default_branch: "main" });
    const ref = p.match(/^\/repos\/x\/y\/git\/ref\/heads\/(.+)$/);
    if (ref) return heads[ref[1]] ? json(200, { ref: `refs/heads/${ref[1]}`, object: { sha: heads[ref[1]] } }) : json(404, { message: "Not Found" });
    if (/^\/repos\/x\/y\/git\/commits\/[^/]+$/.test(p) && method === "GET") return json(200, { tree: { sha: `tree-of-${p.split("/").pop()}` } });
    if (p === "/repos/x/y/git/blobs") return json(201, { sha: "b1" });
    if (p === "/repos/x/y/git/trees") return json(201, { sha: "t1" });
    if (p === "/repos/x/y/git/commits") { commits.push(body); return json(201, { sha: "c1" }); }
    if (p === "/repos/x/y/git/refs") return json(201, { ref: body.ref });
    if (p === "/repos/x/y/pulls") { pulls.push(body); return json(201, { html_url: "https://github.com/x/y/pull/9" }); }
    if (p.startsWith("/repos/x/y/contents/")) {
      const at = u.searchParams.get("ref");
      return at === "claude/elaborate-redesign" ? json(200, { content: Buffer.from("on the redesign", "utf8").toString("base64") }) : json(404, {});
    }
    return json(404, {});
  };
  return { f, seen, pulls, commits };
};

/* 1. Which branch. */
const side = { repo: "x/y", ref: "claude/elaborate-redesign" };
let gh = stub();
const a = await K.publishBranch(gh.f, "t", side);
check("a board from a side branch publishes into that branch", a.ok && a.branch === "claude/elaborate-redesign" && a.main === "main", JSON.stringify(a));
for (const ref of ["", "HEAD", "main", null]) {
  const b = await K.publishBranch(stub().f, "t", { repo: "x/y", ref });
  check(`a board from ${JSON.stringify(ref)} publishes into the default branch`, b.ok && b.branch === "main", JSON.stringify(b));
}
const gone = await K.publishBranch(stub().f, "t", { repo: "x/y", ref: "claude/deleted" });
check("a branch the repository no longer has is refused, not swapped for the default", !gone.ok && /claude\/deleted/.test(gone.says) && /Nothing was sent/.test(gone.says), JSON.stringify(gone));
check("NEXT.md and other files are read back on the board's branch", (await K.fileWherePublished(stub().f, "t", side, "polio/NEXT.md")) === "on the redesign");

/* 2. The pull request goes into the board's branch, cut from its head. */
const prepared = { files: [{ path: "web/style-layer.css", content: ":root{}" }], layer: { says: "One rule.", css: ":root{}" }, base: "", kit: true, skipped: [], cssPath: "web/style-layer.css" };
gh = stub();
const sent = await S.publishLayer(prepared, { ...side, dir: "web/", files: [] }, "t", { site: "PonsStars", date: new Date("2026-10-11T22:00:00Z"), fetch: gh.f });
check("Publish opens the pull request into the side branch", sent.ok && gh.pulls.length === 1 && gh.pulls[0].base === "claude/elaborate-redesign", JSON.stringify(gh.pulls));
check("…from a style/ branch cut from that branch's head", gh.commits[0]?.parents?.[0] === "r1" && /^style\//.test(gh.pulls[0]?.head ?? ""), JSON.stringify(gh.commits));
check("…and says so", sent.ok && /into claude\/elaborate-redesign/.test(sent.says) && !/into main/.test(sent.says), sent.says);
gh = stub();
const onMain = await S.publishLayer(prepared, { repo: "x/y", ref: "main", dir: "web/", files: [] }, "t", { site: "PonsStars", date: new Date("2026-10-11T22:00:00Z"), fetch: gh.f });
check("a board from the default branch still goes into the default branch", onMain.ok && gh.pulls[0]?.base === "main" && gh.commits[0]?.parents?.[0] === "m1", JSON.stringify(gh.pulls));
gh = stub();
const refused = await S.publishLayer(prepared, { repo: "x/y", ref: "claude/deleted", dir: "web/", files: [] }, "t", { site: "PonsStars", fetch: gh.f });
check("a board whose branch is gone sends nothing", !refused.ok && !gh.seen.some((s) => s.startsWith("POST")), JSON.stringify(gh.seen));

/* 3. Every reader goes there. */
const layerRun = src("styleLayerRun.ts"), kit = src("kitRun.ts"), asks = src("publishAsks.ts"), buttons = src("CodeSiteButtons.tsx");
check("prepareLayer and publishLayer pick the branch with publishBranch", (layerRun.match(/await publishBranch\(f, token, source\)/g) ?? []).length === 2 && !/defaultBranch/.test(layerRun));
check("the design round reads the code where Publish merges", /readRound[^]*?await publishBranch\(f, token, source\)/.test(kit));
check("Publish builds NEXT.md on the board's branch", /await publishBranch\(fetch, token, source\)/.test(asks) && /fileOrGone\(fetch, token, source\.repo, into\?\.ok \? into\.branch : "HEAD", NEXT_PATH\)/.test(asks) && !/defaultBranch/.test(asks));
check("Refresh reads NEXT.md back on the board's branch", /await fileWherePublished\(fetch, token, source, NEXT_PATH\)/.test(buttons) && !/defaultBranch|fileOnDefault/.test(buttons));
check("the dialog names the board's branch, and says the default one is left alone", /merged into \{into\?\.branch \?\? /.test(buttons) && /data-code-publish-base=""[^]*This board came from \{into\.branch\}, so Publish merges there and leaves \{into\.main\} as it is/.test(buttons));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
