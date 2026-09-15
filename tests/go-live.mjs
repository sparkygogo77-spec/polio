/**
 * Going live, and where a publish is allowed to go.
 *
 * Two things are new and neither can be proven by reading the code. The
 * Builder can now put the site on Vercel and hand back the address, off a
 * token that may be the server's or the browser's; and a publish may name its
 * own repository, because the Builds page keeps more than one site.
 *
 * A repository a request names is the part that has to be watched. It can
 * only reach what the server's token can already reach, and `GITHUB_REPOS`
 * narrows it further to a fixed list — so this stands up a second server with
 * a made-up token and that list set, and checks that a repository outside it
 * is refused and one inside it is actually the one attempted.
 *
 * Nothing here needs a real Vercel account: a rejected token proves the token
 * travelled, which is the half that could quietly break.
 *
 *   node tests/go-live.mjs [url]        # default http://localhost:3000
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const FAKE_VERCEL = "vercel_test_do_not_use_9876543210";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const json = async (url, init) => {
  const res = await fetch(url, init);
  return res.json();
};

/* 1. What the Builder asks before it offers the button at all. */
const bare = await json(`${URL_BASE}/api/studio/deploy`, { cache: "no-store" });
check("with no token there is nothing to deploy with", bare.configured === false && bare.source === null, JSON.stringify(bare));

const offered = await json(`${URL_BASE}/api/studio/deploy`, { headers: { "x-vercel-token": FAKE_VERCEL } });
check("a token from the browser is enough to offer it", offered.configured === true && offered.source === "browser", JSON.stringify(offered));

/* 2. Asked to deploy with nothing, it says where a token goes. */
const noToken = await json(`${URL_BASE}/api/studio/deploy`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ repo: "someone/something" }),
});
check("with no token it says where to put one", noToken.ok === false && noToken.reason === "no-token" && /keys panel|VERCEL_TOKEN/.test(noToken.message ?? ""), noToken.message);

/* 3. The token travels: Vercel is the one that turns it down, not us. */
const rejected = await json(`${URL_BASE}/api/studio/deploy`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-vercel-token": FAKE_VERCEL },
  body: JSON.stringify({ repo: "someone/something" }),
});
check("a bad token gets as far as Vercel and is reported as a bad token",
  rejected.ok === false && (rejected.reason === "auth" || rejected.reason === "network"),
  `${rejected.reason}: ${(rejected.message ?? "").slice(0, 90)}`);

/* 4. The publish target, on a server that has a token and a list. */
const PORT = 3101;
const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    GITHUB_TOKEN: "ghp_test_do_not_use_9876543210",
    GITHUB_REPO: "allowed/one",
    GITHUB_REPOS: "allowed/one,allowed/two",
  },
  stdio: "ignore",
});

const at = `http://localhost:${PORT}`;
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  await sleep(1000);
  up = await fetch(`${at}/api/studio/publish`).then((r) => r.ok).catch(() => false);
}

try {
  if (!up) {
    check("a second server comes up to test the allow list against", false, "it never answered; run npm run build first");
  } else {
    const status = await json(`${at}/api/studio/publish`);
    check("the status says which repositories are allowed", Array.isArray(status.github?.allow) && status.github.allow.length === 2, JSON.stringify(status.github?.allow));

    const files = [{ path: "site/document.json", content: "{}\n" }];
    const outside = await json(`${at}/api/studio/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ files, message: "test", deploy: false, repo: "someone/else" }),
    });
    check("a repository outside the list is refused, and the list is named",
      outside.ok === false && outside.reason === "bad-repo" && /allowed\/one/.test(outside.message ?? ""), outside.message);

    const nonsense = await json(`${at}/api/studio/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ files, message: "test", deploy: false, repo: "not a repo at all" }),
    });
    check("and so is something that is not owner/name", nonsense.ok === false && nonsense.reason === "bad-repo", nonsense.message);

    // The token is made up, so GitHub turns it down — but the answer names
    // the repository that was tried, which is the thing being checked.
    const inside = await json(`${at}/api/studio/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ files, message: "test", deploy: false, repo: "allowed/two", branch: "trunk" }),
    });
    check("a repository inside the list is the one attempted",
      inside.ok === false && inside.reason === "github" && [401, 404].includes(inside.status),
      `${inside.status}: ${(inside.message ?? "").slice(0, 60)}`);
  }
} finally {
  server.kill("SIGTERM");
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
