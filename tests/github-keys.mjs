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
const offered = await (await fetch(PUB, { cache: "no-store", headers: { "x-github-token": FAKE } })).json();
check(
  "a token from the browser is enough on its own",
  offered.github.configured === true && offered.github.token === "browser",
  `configured ${offered.github.configured}, token ${JSON.stringify(offered.github.token)}`,
);
check(
  "and GET never says what the token is",
  !JSON.stringify(offered).includes(FAKE),
  JSON.stringify(offered).includes(FAKE) ? "the token came back" : "nothing of it comes back",
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

console.log("");
const bad = results.filter((r) => !r.ok);
console.log(`${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
