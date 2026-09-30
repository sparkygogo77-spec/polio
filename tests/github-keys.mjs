/**
 * The GitHub token belongs to the person, and the first publish makes the repo.
 *
 * The architecture rule, the same one the renderer follows for Replicate: an
 * account is somebody's, so the token that writes to it is theirs — typed
 * into the Keys panel, held in their browser, riding with the call. The
 * environment variable stays as a silent fallback rather than the path.
 *
 * These are HTTP checks against the running route rather than a browser
 * drive, because what is being checked is the contract: which token wins,
 * what comes back, and — the one that matters — that nothing the route says
 * ever contains the token.
 *
 * The last check measures what leaves the server, so the server is pointed
 * at a stand-in GitHub this file serves (a token-free machine, and nothing
 * else on 4319):
 *
 *   env -u GITHUB_TOKEN GITHUB_API=http://127.0.0.1:4319 npx next start -p 3013
 *   node tests/github-keys.mjs [url]
 */
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const URL_ = process.argv[2] ?? "http://localhost:3000";
const PUB = `${URL_}/api/studio/publish`;

/* A token shaped like a real one and deliberately not one: every check here
   wants a token GitHub will reject, so that the interesting path is the error
   path — which is where a token leaks if it is going to. */
const FAKE = "ghp_00000000000000000000000000000000TEST";

/*
 * Every POST carries the fake token, always, with no exceptions.
 *
 * Not tidiness — safety. This route can now *make a repository*, and it falls
 * back to `GITHUB_TOKEN` from the environment when a request offers none. A
 * check written to exercise "no token" by simply leaving the header off will,
 * on any machine that has that variable set, hand somebody's real account a
 * `create` and make them a repository. The first draft of this file did
 * exactly that; the environment it ran in happened to bind its token to one
 * repository, so `/user/repos` was refused and nothing was made. That was
 * luck, not design. So: `post` always sends a token GitHub will refuse, and
 * the absence of a token is tested against GET, which writes nothing.
 */
const post = (body, headers = {}) =>
  fetch(PUB, {
    method: "POST",
    headers: { "content-type": "application/json", "x-github-token": FAKE, ...headers },
    body: JSON.stringify(body),
  });

/* What the server itself has, so the checks that are only meaningful without
   one can say why they are not being made rather than failing on a machine
   that is set up. */
const serverHas = (await (await fetch(PUB, { cache: "no-store" })).json()).github.token === "server";

/* ---------------------------------------------------- what GET now means */
const bare = await (await fetch(PUB, { cache: "no-store" })).json();
if (serverHas) {
  console.log("  --   with no token anywhere, GET says it cannot push — skipped: this machine has GITHUB_TOKEN set");
  check(
    "the server's own token is reported as the server's",
    bare.github.configured === true && bare.github.token === "server",
    `configured ${bare.github.configured}, token ${JSON.stringify(bare.github.token)}`,
  );
} else {
  check(
    "with no token anywhere, GET says it cannot push",
    bare.github.configured === false && bare.github.token === null,
    `configured ${bare.github.configured}, token ${JSON.stringify(bare.github.token)}`,
  );
}
/*
 * GET is not handed the token, and that is the point of it.
 *
 * It used to read `x-github-token` so it could answer "can this push", which
 * meant the person's real token crossed to this server on every page load
 * that asked \u2014 to answer a question the browser could answer itself, since the
 * browser is the thing holding it. So this no longer checks that GET says
 * "browser"; it checks that offering GET a token changes nothing about what
 * comes back, which is the regression the contract exists to stop.
 */
const bareRaw = await (await fetch(PUB, { cache: "no-store" })).text();
const offeredRaw = await (await fetch(PUB, { cache: "no-store", headers: { "x-github-token": FAKE } })).text();
check(
  "GET is a status probe, so offering it a token changes nothing it says",
  offeredRaw === bareRaw,
  offeredRaw === bareRaw ? "the same answer with a token as without" : `without: ${bareRaw.slice(0, 90)} / with: ${offeredRaw.slice(0, 90)}`,
);
check(
  "and GET never says what the token is",
  !offeredRaw.includes(FAKE),
  offeredRaw.includes(FAKE) ? "the token came back" : "nothing of it comes back",
);

/* --------------------------------------------- no token, no publish, no repo */
/* Deliberately not a POST: see the note on `post`. A publish with no token is
   the one case that cannot be exercised safely by leaving the header off, so
   what is checked is the message the route is built to give, read off the
   source rather than provoked out of a live account. */
if (serverHas) {
  console.log("  --   without a token it names the Keys panel first — skipped: cannot be provoked safely where GITHUB_TOKEN is set");
} else {
  const none = await (await fetch(PUB, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files: [{ path: "a.txt", content: "x" }] }),
  })).json();
  check(
    "without a token it says where to put one, and names the Keys panel first",
    none.ok === false && none.reason === "no-github" && /Keys panel/.test(none.message),
    none.message,
  );
}

/* -------------------------------------- the token is never echoed anywhere */
const rejected = await post({ files: [{ path: "a.txt", content: "x" }], create: "builder-test-repo" }, { "x-github-token": FAKE });
const body = await rejected.text();
check(
  "a rejected token is not repeated back in the answer",
  !body.includes(FAKE),
  body.includes(FAKE) ? `the answer contains it: ${body.slice(0, 120)}` : "the answer carries none of it",
);
check(
  "nor in any header",
  ![...rejected.headers.values()].some((v) => v.includes(FAKE)),
  "no header carries it",
);
const parsed = JSON.parse(body);
check(
  "and it says GitHub refused rather than pretending it worked",
  parsed.ok === false,
  `${parsed.reason ?? "?"}: ${(parsed.message ?? "").slice(0, 90)}`,
);

/* ------------------------------------------- a site with no name and no repo */
const unnamed = await (await post({ files: [{ path: "a.txt", content: "x" }] }, { "x-github-token": FAKE })).json();
check(
  "with nowhere to push and nothing to name it after, it says so plainly",
  unnamed.ok === false && unnamed.reason === "no-repo",
  unnamed.message,
);

/* ------------------------------- whose token actually reaches GitHub */
/*
 * The claim "a token from the browser is enough on its own" is a claim about
 * what leaves this server, not about what GET says, so it is measured where
 * it happens: a stand-in for GitHub on the address the route was started
 * against, which writes down the Authorization header it was shown and
 * refuses everything.
 *
 * This is the check that would catch `tokenFor` being turned around to prefer
 * the environment \u2014 which would quietly push one person's site into whatever
 * account the machine happens to be set up with. It needs the address to be
 * free; where something is already answering on it, it says so rather than
 * guessing.
 */
const STUB = Number(process.env.STUB_PORT ?? 4319);
const seen = [];
let stub = null;
try {
  const { createServer } = await import("node:http");
  stub = await new Promise((good, bad) => {
    const srv = createServer((req, res) => {
      seen.push(req.headers.authorization ?? "");
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Bad credentials" }));
    });
    srv.on("error", bad);
    srv.listen(STUB, "127.0.0.1", () => good(srv));
  });
} catch {
  stub = null;
}

if (!stub) {
  console.log(`  --   the browser's token is the one that reaches GitHub \u2014 skipped: something else is on 127.0.0.1:${STUB}`);
} else {
  /* An explicit repository, so the route goes straight out to GitHub rather
     than stopping at "nothing to push to". Nothing is created and nothing is
     pushed: the stand-in refuses the first call. */
  const reached = await (await post({ files: [{ path: "a.txt", content: "x" }], repo: "someone/a-site" }, { "x-github-token": FAKE })).json();
  const auth = seen.join(" | ");
  check(
    "a token from the browser is the one that reaches GitHub",
    seen.length > 0 && seen.every((a) => a === `Bearer ${FAKE}`),
    seen.length === 0
      ? "the route never called GitHub at all, so nothing was measured"
      : `GitHub was shown ${seen.length} call${seen.length === 1 ? "" : "s"}, all bearing the browser's token`,
  );
  check(
    "and the server's own token is not what went out",
    !!process.env.GITHUB_TOKEN === false || !auth.includes(process.env.GITHUB_TOKEN.trim()),
    process.env.GITHUB_TOKEN ? "the environment's token stayed here" : "this machine has none to confuse it with",
  );
  check(
    "and a refusal from GitHub is reported rather than swallowed",
    reached.ok === false && typeof reached.message === "string" && reached.message.length > 0,
    `${reached.reason ?? "?"}: ${(reached.message ?? "").slice(0, 90)}`,
  );
  await new Promise((r) => stub.close(r));
}

console.log("");
const bad = results.filter((r) => !r.ok);
console.log(`${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
