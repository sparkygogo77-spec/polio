/**
 * WHAT THE TOP BAR SAYS ABOUT A PUBLISH IS PLAIN WORDS.
 *
 * The owner's walk-through: the bar showed Vercel's own text, 'Resource is
 * limited - try again in 24 hours (more than 100, code:
 * "api-deployments-free-per-day")', and nothing about whether the change was
 * saved. A publish is three steps a person can follow, and each failure is
 * one sentence saying what happened to the change and what to do; the
 * provider's words go behind "details" (`publishWords.ts`).
 *
 *   node --experimental-strip-types tests/publish-words.mjs
 */
const { plainFailure, stepWords, aboutWhen } = await import("../src/features/studio/publishWords.ts");

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = JSON.stringify;
const NOW = Date.parse("2026-09-30T12:00:00Z");

check("the steps, in order", stepWords({ at: "saving" }) === "Saving to GitHub…" && stepWords({ at: "waiting" }) === "Saved to GitHub ✓, waiting for Vercel…" && /^Live ✓ at /.test(stepWords({ at: "live", url: "https://x.vercel.app", when: NOW }, NOW)), stepWords({ at: "live", url: "u", when: NOW }, NOW));

const raw = 'Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day").';
const limit = plainFailure({ stage: "vercel", message: raw, status: 429, code: "api-deployments-free-per-day", reset: Math.round((NOW + 3 * 3600_000) / 1000), saved: { repo: "him/site", branch: "main" } }, NOW);
check("Vercel's daily limit: the change is saved on GitHub and goes live when Vercel allows, about a time", limit.kind === "vercel-limit" && limit.saved && /saved on GitHub \(him\/site on main\)/.test(limit.says) && /goes live when Vercel allows, about \d/.test(limit.says), limit.says);
check("…in plain words: no code, no 'Resource is limited'", !/api-deployments|Resource is limited|code:/.test(limit.says));
check("…and the provider's words are kept whole for the details fold", limit.detail?.includes(raw), limit.detail);
const limitNoReset = plainFailure({ stage: "vercel", message: raw }, NOW);
check("with no reset given, the time comes from 'try again in 24 hours'", /about .*tomorrow/.test(limitNoReset.says), limitNoReset.says);
check("a Git build Vercel rate limited is the same limit", plainFailure({ stage: "build", message: "Deployment rate limited" }, NOW).kind === "vercel-limit");

const server = plainFailure({ stage: "github", serverStatus: 502, message: "The Builder's server answered 502." }, NOW);
check("the Builder's own server failing says so, with the status code", server.kind === "server" && /Builder's own server failed \(status 502\)/.test(server.says) && !server.saved, server.says);
const serverLater = plainFailure({ stage: "vercel", serverStatus: 500, saved: { repo: "him/site", branch: "main" } }, NOW);
check("…after the save, it says the change is saved", serverLater.saved && /saved on GitHub/.test(serverLater.says), serverLater.says);

const noKey = plainFailure({ stage: "vercel", reason: "no-token", message: "No Vercel token, on the server or in this browser." }, NOW);
check("a missing key names the key and where it goes", noKey.kind === "no-key" && /Needs a Vercel key/.test(noKey.says) && /Keys panel/.test(noKey.says), noKey.says);
const unreachable = plainFailure({ stage: "github", message: "Failed to fetch", reason: "network" }, NOW);
check("GitHub unreachable: nothing was saved, and says so", unreachable.kind === "github-unreachable" && /GitHub could not be reached, so nothing was saved/.test(unreachable.says), unreachable.says);
const notStarted = plainFailure({ stage: "vercel", reason: "not-started", message: "Vercel has not started a deployment…" }, NOW);
check("a push Vercel never built says the change is saved and why it may not be live", notStarted.kind === "not-started" && /saved on GitHub/.test(notStarted.says) && /daily limit/.test(notStarted.says), notStarted.says);
const blocked = plainFailure({ stage: "github", reason: "blocked", message: "Trump & Morty already publishes to him/tm on main, so Update live site is off for this site." }, NOW);
check("a press the Builder held back says its own sentence", blocked.kind === "blocked" && /Trump & Morty already publishes/.test(blocked.says), blocked.says);

const own = plainFailure({ stage: "github", reason: "too-big", message: "“a.png” is 5.1 MB even packed, more than one request to the Builder carries." }, NOW);
check("the Builder's own refusal is shown in its own plain words, not folded away", own.says === "Nothing was saved: “a.png” is 5.1 MB even packed, more than one request to the Builder carries.", own.says);
const hinted = plainFailure({ stage: "vercel", reason: "vercel", message: "You don't have permission to create the project.", hint: "Check the token's scope includes the team." }, NOW);
check("a Vercel refusal with the Builder's hint says the hint, and keeps Vercel's words for details", /Vercel would not build it\. Check the token's scope/.test(hinted.says) && /permission/.test(hinted.detail ?? ""), hinted.says);

/* Every sentence is plain: no em dash, no bare abbreviation a person has to decode. */
const all = [limit, limitNoReset, server, serverLater, noKey, unreachable, notStarted].map((f) => f.says);
check("no em dash in anything said", all.every((s) => !s.includes("—")), J(all.filter((s) => s.includes("—"))));
check("no provider codes or HTTP jargon in the sentence", all.every((s) => !/\b(HTTP|API|5xx|4xx|ECONN|ENOTFOUND)\b/.test(s)));
check("aboutWhen reads a reset given in seconds and in milliseconds alike", aboutWhen(1_790_000_000, NOW) === aboutWhen(1_790_000_000_000, NOW));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
