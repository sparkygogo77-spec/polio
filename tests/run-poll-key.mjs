/**
 * A CAPTURE RUN FOUND STILL GOING AFTER A RELOAD IS FOLLOWED WITH THE KEY ONCE IT OPENS.
 *
 * The Capture dialog picks up a run that was still going when the page
 * loaded, at once. This browser's keys open a moment later (IndexedDB and a
 * decrypt, `keysReady`), or only after the PIN. The run was followed with the
 * key read once at the start, so it was followed with no key at all: every
 * poll went out as "Bearer " and GitHub answered 401, every five seconds,
 * forever, and the dialog never saw the run end (thesolface run 39707081826,
 * 52 errors in the console). The dispatch had worked: it is made later, on a
 * press, with the key open.
 *
 * Now the key is asked for at each poll, and no poll goes out while there is
 * none.
 *
 *   node --experimental-strip-types tests/run-poll-key.mjs
 */
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const { watchCapture } = await import("../src/features/studio/bring-in/captureSite.ts");

const TOKEN = "stand-in-for-his-token";
const repo = { owner: "someone", name: "polio" };
const sent = [];
let polls = 0, sleeps = 0;
const github = {
  fetch: async (url, init = {}) => {
    const auth = String((init.headers ?? {}).Authorization ?? "");
    sent.push(auth);
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (auth !== `Bearer ${TOKEN}`) return json(401, { message: "Bad credentials" });
    const u = String(url);
    if (u.endsWith("/actions/runs/9/jobs")) return json(200, { jobs: [] });
    if (u.endsWith("/actions/runs/9/artifacts?per_page=100")) return json(200, { artifacts: [] });
    if (u.endsWith("/actions/runs/9")) { polls++; return json(200, { id: 9, status: polls > 1 ? "completed" : "in_progress", conclusion: polls > 1 ? "success" : null, html_url: "https://github.test/run/9" }); }
    return json(404, { message: "not here" });
  },
  /* A watch that never ends stops the test instead. */
  sleep: async () => { if (++sleeps > 20) throw new Error("still polling after 20 waits"); },
};

/* The key opens after the third wait, the way it opens a moment after the page. */
const held = () => (sleeps >= 3 ? TOKEN : "");
let end = null, threw = null;
try { end = await watchCapture({ repo, token: held, runId: 9, name: "thesolface", onProgress: () => {}, ...github }); } catch (e) { threw = e.message; }

check("the run is followed to its end once the key opens", end?.done === true && end.ok === true, threw ?? JSON.stringify(end));
check("no poll goes out without a key", sent.every((a) => a === `Bearer ${TOKEN}`), `${sent.filter((a) => a !== `Bearer ${TOKEN}`).length} of ${sent.length} sent without it`);
/* Control: a key held from the start is used from the first poll, as before. */
polls = 0; sleeps = 0; sent.length = 0;
const plain = await watchCapture({ repo, token: TOKEN, runId: 9, name: "thesolface", onProgress: () => {}, ...github });
check("control: a key given as it is still follows the run", plain.ok === true && sent[0] === `Bearer ${TOKEN}`, `${sent.length} asks`);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
