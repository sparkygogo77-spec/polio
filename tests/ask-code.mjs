#!/usr/bin/env node
/**
 * "ASK THE CODE CHAT" REACHES A CODE CHAT: THE REQUEST BRANCH, AND A LINE IN
 * polio/NEXT.md POINTING AT IT.
 *
 * Audit (2026-10-11): asking from a part wrote only a request/ branch and a
 * draft pull request, which no code chat is told to read; its brief named
 * kit:check and kit:diff (on PST those check the kit's starter builder.json)
 * and not `npm run hooks`; and its picture in the pull request's body was a
 * relative link GitHub shows broken. Now the ask is kept on the board and the
 * next Publish writes it into NEXT.md, where code chats look first. Pure node,
 * a fake GitHub, no server and no browser:
 *
 *   node tests/ask-code.mjs
 *
 * Covers: src/features/studio/askCode.ts, src/features/studio/fixLoop.ts, src/features/studio/publishAsks.ts, src/features/studio/panels/inspector/codeView.tsx, src/features/studio/CodeSiteButtons.tsx
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const A = await jiti.import(join(here, "..", "src", "features", "studio", "askCode.ts"));
const F = await jiti.import(join(here, "..", "src", "features", "studio", "fixLoop.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* A fake GitHub: answers what askCode asks for, and keeps every write. */
const REPO = "someone/site";
const SHA = "c0ffee0000000000000000000000000000000001";
const writes = [];
const fake = async (url, init = {}) => {
  const path = url.replace(/^https:\/\/api\.github\.com/, "");
  const method = init.method ?? "GET";
  const body = init.body ? JSON.parse(init.body) : null;
  if (method !== "GET") writes.push({ path, method, body });
  const answer = (status, json) => ({ status, json: async () => json });
  if (method === "GET" && path === `/repos/${REPO}`) return answer(200, { default_branch: "main" });
  if (method === "GET" && path === `/repos/${REPO}/git/ref/heads/main`) return answer(200, { object: { sha: "base0" } });
  if (method === "GET" && path === `/repos/${REPO}/git/commits/base0`) return answer(200, { tree: { sha: "tree0" } });
  if (path === `/repos/${REPO}/git/blobs`) return answer(201, { sha: `blob${writes.length}` });
  if (path === `/repos/${REPO}/git/trees`) return answer(201, { sha: "tree1" });
  if (path === `/repos/${REPO}/git/commits`) return answer(201, { sha: SHA });
  if (path === `/repos/${REPO}/git/refs`) return answer(201, { ref: body.ref });
  if (path === `/repos/${REPO}/pulls`) return answer(201, { html_url: `https://github.com/${REPO}/pull/7` });
  return answer(404, null);
};

const ask = { text: "Make it shake when the timer runs out", hook: "play-button", name: "Play", page: "web/index.html", refs: [{ file: "web/app.js", line: 12, fn: "start" }], picture: "iVBORw0KGgo=" };
const date = new Date("2026-10-11T20:30:00Z");
const got = await A.askCode(ask, REPO, "STANDIN_TOKEN", { date, fetch: fake });
check("The ask is made", got.ok === true, got.says);

/* (a) Only ever a new request/ branch, never the default one. */
const refs = writes.filter((w) => w.path.endsWith("/git/refs"));
check("The branch it makes is a request/ branch", refs.length === 1 && refs[0].body.ref === "refs/heads/request/play-button-2026-10-11", JSON.stringify(refs.map((r) => r.body.ref)));
check("Nothing is written to main", !writes.some((w) => /heads\/main/.test(w.path) || w.body?.ref === "refs/heads/main" || (w.path.endsWith("/pulls") && w.body.head === "main")));
const pr = writes.find((w) => w.path.endsWith("/pulls"));
check("The pull request is a draft from the request branch into main", pr?.body.draft === true && pr.body.head === got.branch && pr.body.base === "main");

/* (b) The picture in the pull request's body is a full link to the committed file. */
const png = `requests/play-button-202610112030.png`;
check("The pull request's picture is an absolute link to the commit's file", pr?.body.body.includes(`](https://github.com/${REPO}/blob/${SHA}/${png}?raw=true)`), pr?.body.body.match(/!\[[^\]]*\]\([^)]*\)/)?.[0]);
const blobs = writes.filter((w) => w.path.endsWith("/git/blobs"));
const mdBlob = blobs.find((b) => b.body.encoding === "utf-8")?.body.content ?? "";
check("The committed request keeps its link beside it", mdBlob.includes("](play-button-202610112030.png)"));

/* (c) The brief names the repository's own checks, npm run hooks first. */
const md = A.requestMarkdown(ask, { repo: REPO, base: "main", picture: null, when: "2026-10-11" });
check("The brief names npm run hooks", md.includes("`npm run hooks`"));
check("The brief points at the root builder.json and the repository's CLAUDE.md", md.includes("root builder.json") && md.includes("CLAUDE.md"));
check("The brief tells the chat to tick its NEXT.md line", md.includes("polio/NEXT.md"));

/* (d) The ask as a NEXT.md issue. */
const issue = A.askIssue(ask, got, { repo: REPO, page: "Home" });
check("The issue is kind ask, on the part's hook", issue.kind === "ask" && issue.hook === "play-button" && issue.page === "Home");
check("Its key is the request file's name", issue.key === "ask-play-button-202610112030", issue.key);
check("It says what J asked and where the request is", issue.says.includes(ask.text) && issue.says.includes(got.pull) && issue.says.includes(got.branch), issue.says);
const noPull = A.askIssue({ ...ask, picture: null }, { ...got, pull: null }, { repo: REPO, page: "Home" });
check("Without a pull request it links the branch", noPull.says.includes(`https://github.com/${REPO}/tree/${got.branch}`) && noPull.says.includes("The request is in"), noPull.says);
const sneaky = A.askIssue({ ...ask, text: "end it --> here\nand <!-- there" }, got, { repo: REPO, page: "Home" });
check("What J typed cannot break the line's fix comment", !/<!--|-->/.test(sneaky.says) && !sneaky.says.includes("\n"));

/* (e) Publish sends it once; Refresh lands it and forgets it. */
const loop = { ticked: [], sent: [], asked: [issue] };
const adding = F.asksToSend(loop, loop.asked);
const next = F.nextMd(adding, { site: "Site", when: "2026-10-11" });
const lines = next.split("\n").filter((l) => l.startsWith("- [ ]"));
check("NEXT.md gets one line for it", lines.length === 1 && lines[0].includes(`<!-- fix:${issue.key} -->`) && lines[0].includes("`play-button`"), lines[0]);
check("The line says what done looks like for an ask", lines[0]?.includes(`Done when ${F.DONE_WHEN.ask}`));
const sent = { ...loop, sent: [...loop.sent, ...adding] };
check("Once sent it is not asked again", F.asksToSend(sent, sent.asked).length === 0);
check("Ticked by the code chat, Refresh finds it fixed", F.fixedIn(sent.sent, next.replace("- [ ]", "- [x]")).map((i) => i.key).join() === issue.key);
check("Still open, Refresh leaves it", F.fixedIn(sent.sent, next).length === 0);

/* The wiring: Publish gathers the asks, Refresh keeps them, the box keeps the ask. */
const src = (p) => readFileSync(join(here, "..", "src", "features", "studio", ...p.split("/")), "utf8");
check("Publish's NEXT.md lines include what J asked", /asksToSend\(loop, \[\.\.\.asksNow\(source, fresh\), \.\.\.\(loop\.asked \?\? \[\]\)\]\)/.test(src("publishAsks.ts")));
check("Refresh keeps the rest of the loop and drops a landed ask", /setFixLoop\(\{ \.\.\.loop, [^\n]*asked: \(loop\.asked \?\? \[\]\)\.filter/.test(src("CodeSiteButtons.tsx")));
check("The Ask box keeps the ask on the board", /asked: \[\.\.\.\(loop\.asked \?\? \[\]\), askIssue\(/.test(src("panels/inspector/codeView.tsx")));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
